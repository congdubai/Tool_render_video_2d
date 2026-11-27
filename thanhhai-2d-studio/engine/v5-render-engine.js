// engine/v5-render-engine.js — Scene-Based Rendering, Render Cache & Incremental Repair (V5 Phase 5)
// Fingerprints scene parameters, caches rendered segments, supports incremental repair and scene locking.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getCharacter } from '../../lib/character-library.mjs';

export const RENDER_ENGINE_VERSION = '5.2.1';
const MIN_VALID_MP4_BYTES = 2048;

function isValidMp4File(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size < MIN_VALID_MP4_BYTES) return false;
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, header, 0, 12, 0);
    if (bytesRead < 8) return false;
    // ISO Base Media / MP4 must contain 'ftyp' box marker at bytes 4..8
    return header.subarray(4, 8).toString('ascii') === 'ftyp';
  } finally {
    fs.closeSync(fd);
  }
}

export const SCENE_APPROVAL_STATUS = {
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  NEEDS_CHANGES: 'needs_changes',
  LOCKED: 'locked',
  REJECTED: 'rejected',
  REBUILT: 'rebuilt'
};

export class RenderCacheManager {
  constructor(cacheDir = path.resolve(process.cwd(), 'data', 'v5-render-cache')) {
    this.cacheDir = cacheDir;
    this.approvalMap = new Map();
    this._ensureStorage();
  }

  _ensureStorage() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Computes deterministic SHA-256 fingerprint for a scene render.
   * Incorporates rendererVersion, live characterProfiles, assetVersions, sceneRevision, and animation data.
   */
  computeFingerprint(scene = {}, animTracks = {}, renderSettings = {}) {
    // Resolve live character profiles for every character in the scene so hair/skin/outfit edits invalidate cache
    const resolvedCharProfiles = {};
    const providedProfiles = renderSettings.characterProfiles || {};
    for (const c of (scene.characters || [])) {
      const cid = c.characterId || c.id;
      if (!cid) continue;
      if (providedProfiles[cid]) {
        resolvedCharProfiles[cid] = providedProfiles[cid];
      } else {
        const liveProfile = getCharacter(cid) || (cid === 'doc' || cid === 'scientist_01' ? getCharacter('chibi_doc') : null) || (cid === 'max' ? getCharacter('chibi_max') : null);
        if (liveProfile) {
          resolvedCharProfiles[cid] = {
            id: liveProfile.id,
            skinColor: liveProfile.skinColor,
            hair: liveProfile.hair,
            face: liveProfile.face,
            proportions: liveProfile.proportions,
            outfit: liveProfile.outfit,
            updatedAt: liveProfile.updatedAt
          };
        }
      }
    }

    // Extract asset version map from bindings or explicit assetVersions
    const assetVersions = { ...(renderSettings.assetVersions || {}) };
    if (renderSettings.bindings && typeof renderSettings.bindings === 'object') {
      for (const [k, b] of Object.entries(renderSettings.bindings)) {
        if (b && typeof b === 'object') {
          assetVersions[k] = {
            resolvedAssetId: b.resolvedAssetId || b.assetId || null,
            assetVersion: b.assetVersion || 1,
            updatedAt: b.updatedAt || null
          };
        }
      }
    }

    const canonical = {
      sceneId: scene.id,
      sceneRevision: scene.revision || scene.updatedAt || renderSettings.sceneRevision || '1.0',
      background: scene.background,
      characters: scene.characters,
      characterProfiles: resolvedCharProfiles,
      assetVersions,
      props: scene.props,
      camera: scene.camera,
      duration: scene.duration,
      animationTracks: animTracks,
      resolution: renderSettings.resolution || '1920x1080',
      fps: renderSettings.fps || 30,
      codec: renderSettings.codec || 'libx264',
      rendererVersion: renderSettings.rendererVersion || RENDER_ENGINE_VERSION,
      engineVersion: RENDER_ENGINE_VERSION
    };

    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(canonical));
    return hash.digest('hex');
  }

  /**
   * Checks if a REAL valid MP4 cached render file exists for fingerprint (rejects placeholders/empty files)
   */
  hasValidCache(fingerprint) {
    const cachedFile = path.join(this.cacheDir, `${fingerprint}.mp4`);
    return isValidMp4File(cachedFile);
  }

  getCachedFilePath(fingerprint) {
    return path.join(this.cacheDir, `${fingerprint}.mp4`);
  }

  saveToCache(fingerprint, sourceFilePath) {
    if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
      throw new Error(`RenderCache: Không thể lưu cache vì file nguồn không tồn tại (${sourceFilePath || 'empty'}). Placeholder đã bị vô hiệu hóa.`);
    }
    if (!isValidMp4File(sourceFilePath)) {
      throw new Error(`RenderCache: File nguồn không phải MP4 hợp lệ (${sourceFilePath}).`);
    }
    const targetFile = path.join(this.cacheDir, `${fingerprint}.mp4`);
    fs.copyFileSync(sourceFilePath, targetFile);
    return targetFile;
  }

  invalidateCache(fingerprint) {
    const cachedFile = path.join(this.cacheDir, `${fingerprint}.mp4`);
    if (fs.existsSync(cachedFile)) {
      fs.unlinkSync(cachedFile);
      return true;
    }
    return false;
  }

  /**
   * Scene Approval & Lock Workflow
   */
  setApprovalStatus(sceneId, status, notes = '') {
    this.approvalMap.set(sceneId, {
      status,
      notes,
      updatedAt: new Date().toISOString()
    });
  }

  getApprovalStatus(sceneId) {
    return this.approvalMap.get(sceneId) || {
      status: SCENE_APPROVAL_STATUS.PENDING_REVIEW,
      notes: '',
      updatedAt: null
    };
  }

  isSceneLocked(sceneId) {
    const record = this.getApprovalStatus(sceneId);
    return record.status === SCENE_APPROVAL_STATUS.LOCKED;
  }

  /**
   * Plans incremental render: determines which scenes need re-render vs which hit cache
   */
  planIncrementalRender(scenes = [], animations = {}, renderSettings = {}) {
    const plan = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const scene of scenes) {
      const animTrack = animations[scene.id] || {};
      const fingerprint = this.computeFingerprint(scene, animTrack, renderSettings);
      const isLocked = this.isSceneLocked(scene.id);
      const isCached = this.hasValidCache(fingerprint);

      if (isCached) {
        cacheHits++;
      } else {
        cacheMisses++;
      }

      plan.push({
        sceneId: scene.id,
        fingerprint,
        isLocked,
        useCache: isCached,
        cachedPath: isCached ? this.getCachedFilePath(fingerprint) : null,
        needsRender: !isCached
      });
    }

    return {
      totalScenes: scenes.length,
      cacheHits,
      cacheMisses,
      cacheHitRatePercent: scenes.length > 0 ? Math.round((cacheHits / scenes.length) * 100) : 0,
      plan
    };
  }
}

export const defaultRenderCache = new RenderCacheManager();

