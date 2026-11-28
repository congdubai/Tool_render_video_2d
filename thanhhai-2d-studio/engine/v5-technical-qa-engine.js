// engine/v5-technical-qa-engine.js — Technical QA Engine, Severity Matrix & Automatic Safe Repair (V5 Phase 5)
// Consolidates structural, kinematic, asset, audio, and storytelling quality checks into a unified QA pipeline.

import fs from 'node:fs';
import { validateCameraAndVisuals } from './v5-camera-engine.js';
import { validateSceneAnimation } from './v5-animation-director.js';

export const QA_SEVERITY = {
  BLOCKER: 'BLOCKER',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export const SCENE_QA_STATUS = {
  READY: 'READY',
  READY_WITH_WARNINGS: 'READY_WITH_WARNINGS',
  NEEDS_REPAIR: 'NEEDS_REPAIR',
  BLOCKED: 'BLOCKED',
  RENDERED: 'RENDERED',
  APPROVED: 'APPROVED',
  LOCKED: 'LOCKED'
};

export class TechnicalQaEngine {
  constructor() {
    this.repairLog = [];
  }

  /**
   * Runs comprehensive technical QA on project scenes and animation
   */
  validateProject(projectData = {}) {
    const issues = [];
    const scenes = Array.isArray(projectData.scenes) ? projectData.scenes : [];
    const animations = projectData.animations || {};
    const audioDuration = Number(projectData.audioDuration) || 0;

    if (scenes.length === 0) {
      issues.push({
        severity: QA_SEVERITY.BLOCKER,
        code: 'NO_SCENES',
        description: 'Dự án không có phân cảnh nào để dựng.',
        suggestedFix: 'Bổ sung ít nhất một scene vào kịch bản.'
      });
      return { isValid: false, issues, blockers: issues, errors: [], warnings: [] };
    }

    let totalDuration = 0;
    const characterAppearanceCounts = {};

    scenes.forEach((scene, idx) => {
      const sceneId = scene.id || `scene_${idx + 1}`;
      const dur = Number(scene.duration) || 0;
      totalDuration += dur;

      // 1. Duration check
      if (dur <= 0) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          sceneId,
          code: 'INVALID_DURATION',
          description: `Thời lượng scene "${sceneId}" (${dur}s) không hợp lệ.`,
          suggestedFix: 'Đặt thời lượng > 0s (ví dụ tối thiểu 1.0s).'
        });
      }

      // 2. Background check
      if (!scene.background && !scene.bg && !scene.backgroundId) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          sceneId,
          code: 'MISSING_BACKGROUND',
          description: `Scene "${sceneId}" thiếu bối cảnh nền (background).`,
          suggestedFix: 'Gán bối cảnh hoặc chọn background từ thư viện.'
        });
      }

      // 3. Characters check
      const chars = scene.characters || [];
      if (chars.length === 0 && !scene.isEducationalGraphicOnly) {
        issues.push({
          severity: QA_SEVERITY.WARNING,
          sceneId,
          code: 'EMPTY_CHARACTERS',
          description: `Scene "${sceneId}" không có nhân vật nào xuất hiện.`,
          suggestedFix: 'Thêm nhân vật nếu đây không phải cảnh đồ họa thuần túy.'
        });
      }

      chars.forEach(ch => {
        const cId = ch.id || ch.characterId;
        if (cId) {
          characterAppearanceCounts[cId] = (characterAppearanceCounts[cId] || 0) + 1;
        }

        // Check scale bounds
        const scale = ch.scale ?? 1.0;
        if (scale <= 0.05 || scale > 8.0) {
          issues.push({
            severity: QA_SEVERITY.ERROR,
            sceneId,
            objectId: cId,
            code: 'OUT_OF_BOUNDS_SCALE',
            description: `Tỉ lệ phóng to nhân vật ${cId} (${scale}) vượt ngưỡng cho phép.`,
            suggestedFix: 'Tự động clamp scale về khoảng an toàn [0.2, 3.0].'
          });
        }
      });

      // 4. Props check
      const props = scene.props || [];
      props.forEach(p => {
        if (p.attachedTo && !chars.some(c => (c.id || c.characterId) === p.attachedTo)) {
          issues.push({
            severity: QA_SEVERITY.ERROR,
            sceneId,
            objectId: p.id,
            code: 'DANGLING_PROP_ATTACHMENT',
            description: `Đạo cụ "${p.id}" được gắn vào nhân vật "${p.attachedTo}" nhưng nhân vật này không có trong scene.`,
            suggestedFix: 'Bỏ attachment hoặc thêm nhân vật vào scene.'
          });
        }
      });
    });

    // 5. Audio synchronization check
    if (audioDuration > 0) {
      const delta = Math.abs(totalDuration - audioDuration);
      if (delta > 2.0) {
        issues.push({
          severity: QA_SEVERITY.WARNING,
          code: 'AUDIO_TIMELINE_MISMATCH',
          description: `Thời lượng hình ảnh (${totalDuration.toFixed(1)}s) lệch so với âm thanh (${audioDuration.toFixed(1)}s).`,
          suggestedFix: 'Khớp lại thời lượng các scene bằng Master Timeline Finalizer.'
        });
      }
    }

    // 6. Character consistency check
    const characterConsistency = this.checkCharacterConsistency(scenes);
    issues.push(...characterConsistency.issues);

    // 7. Missing Assets & Dependency Blocker Check
    const missingAssets = Array.isArray(projectData.missingAssets) ? projectData.missingAssets : [];
    if (missingAssets.length > 0) {
      missingAssets.forEach(m => {
        const reqId = m.id || m.requirementId || 'UNKNOWN_REQ';
        const name = m.name || reqId;
        const type = m.type || m.category || 'asset';
        const reason = (m.reasons && m.reasons[0]) || m.reason || 'Chưa liên kết trong dự án';
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          code: 'MISSING_REQUIRED_ASSET',
          objectId: reqId,
          description: `Thiếu tài nguyên bắt buộc: "${name}" (${type}) [${reqId}]. Lý do: ${reason}`,
          suggestedFix: 'Mở Bước 2 (Smart Asset Manager) để gán tài nguyên hoặc tự vẽ bằng code (CODE GEN).'
        });
      });
    }

    // 8. Rendered Video Output File Validation
    if (projectData.outputPath) {
      const outPath = projectData.outputPath;
      if (!fs.existsSync(outPath)) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          code: 'OUTPUT_FILE_MISSING',
          description: `File video đầu ra "${outPath}" không tồn tại trên ổ đĩa.`,
          suggestedFix: 'Tiến hành kết xuất (render) trước khi kiểm định hợp lệ.'
        });
      } else {
        const stats = fs.statSync(outPath);
        if (stats.size < 1024) { // Less than 1KB
          issues.push({
            severity: QA_SEVERITY.BLOCKER,
            code: 'OUTPUT_FILE_EMPTY',
            description: `File video đầu ra "${outPath}" rỗng hoặc dung lượng không hợp lệ (${stats.size} bytes).`,
            suggestedFix: 'Kiểm tra tiến trình FFmpeg và kết xuất lại video.'
          });
        }
      }
    }

    const blockers = issues.filter(x => x.severity === QA_SEVERITY.BLOCKER);
    const errors = issues.filter(x => x.severity === QA_SEVERITY.ERROR);
    const warnings = issues.filter(x => x.severity === QA_SEVERITY.WARNING);
    const infos = issues.filter(x => x.severity === QA_SEVERITY.INFO);

    const storytellingReport = this.generateStorytellingReport(scenes, audioDuration, characterAppearanceCounts);

    return {
      isValid: blockers.length === 0,
      totalIssues: issues.length,
      blockers,
      errors,
      warnings,
      infos,
      issues,
      storytellingReport
    };
  }

  /**
   * Checks character identity and asset continuity across multiple scenes
   */
  checkCharacterConsistency(scenes = []) {
    const issues = [];
    const charRegistry = {};

    scenes.forEach(scene => {
      (scene.characters || []).forEach(ch => {
        const id = ch.id || ch.characterId;
        if (!id) return;

        if (!charRegistry[id]) {
          charRegistry[id] = {
            skin: ch.skin,
            outfit: ch.outfit,
            firstScene: scene.id
          };
        } else {
          // If outfit changed without explicit outfit directive
          if (ch.outfit && charRegistry[id].outfit && ch.outfit !== charRegistry[id].outfit && !ch.allowOutfitChange) {
            issues.push({
              severity: QA_SEVERITY.WARNING,
              sceneId: scene.id,
              objectId: id,
              code: 'CHARACTER_OUTFIT_INCONSISTENCY',
              description: `Nhân vật "${id}" đổi trang phục bất thường từ "${charRegistry[id].outfit}" sang "${ch.outfit}".`,
              suggestedFix: 'Đảm bảo tính nhất quán của trang phục nhân vật suốt video.'
            });
          }
        }
      });
    });

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  /**
   * Generates storytelling statistics report
   */
  generateStorytellingReport(scenes = [], audioDuration = 0, charCounts = {}) {
    const totalScenes = scenes.length;
    const avgDuration = totalScenes > 0 ? (scenes.reduce((s, c) => s + (Number(c.duration) || 0), 0) / totalScenes) : 0;
    const backgrounds = scenes.map(s => s.background || s.bg || 'default');
    const uniqueBackgrounds = new Set(backgrounds).size;

    return {
      totalScenes,
      averageSceneDurationSec: Number(avgDuration.toFixed(2)),
      audioDurationSec: audioDuration,
      uniqueBackgroundsCount: uniqueBackgrounds,
      characterAppearanceCounts: charCounts,
      pacingAssessment: avgDuration < 2.0 ? 'Rất nhanh (Fast-paced)' : (avgDuration > 8.0 ? 'Chậm rãi (Relaxed)' : 'Cân bằng (Balanced)')
    };
  }

  /**
   * Automatic Safe Repair: fixes simple deterministically repairable issues
   */
  autoRepairSafeIssues(projectData = {}) {
    const scenes = Array.isArray(projectData.scenes) ? projectData.scenes : [];
    let repairsCount = 0;

    scenes.forEach(scene => {
      // 1. Clamp invalid character scale
      (scene.characters || []).forEach(ch => {
        if (typeof ch.scale === 'number') {
          if (ch.scale < 0.2) {
            this.repairLog.push(`Scene ${scene.id}: Clamp scale của ${ch.id} từ ${ch.scale} lên 0.2.`);
            ch.scale = 0.2;
            repairsCount++;
          } else if (ch.scale > 3.0) {
            this.repairLog.push(`Scene ${scene.id}: Clamp scale của ${ch.id} từ ${ch.scale} xuống 3.0.`);
            ch.scale = 3.0;
            repairsCount++;
          }
        }
      });

      // 2. Fix minor duration inaccuracies
      if (typeof scene.duration === 'number' && scene.duration <= 0) {
        this.repairLog.push(`Scene ${scene.id}: Sửa thời lượng không hợp lệ từ ${scene.duration} thành 3.0s.`);
        scene.duration = 3.0;
        repairsCount++;
      }

      // 3. Remove dangling prop attachments
      (scene.props || []).forEach(p => {
        if (p.attachedTo && !scene.characters?.some(c => (c.id || c.characterId) === p.attachedTo)) {
          this.repairLog.push(`Scene ${scene.id}: Gỡ bỏ attachment lơ lửng của prop ${p.id}.`);
          p.attachedTo = null;
          repairsCount++;
        }
      });
    });

    return {
      success: true,
      repairsCount,
      repairedScenes: scenes,
      repairLog: this.repairLog
    };
  }

  /**
   * V5.2 Phase 5B: Unified Quality Control across Technical, Geometry, Character, Animation & Camera QA.
   */
  runComprehensiveQA(projectData = {}) {
    const base = this.validateProject(projectData);
    const issues = [...(base.issues || [])];
    const scenes = Array.isArray(projectData.scenes) ? projectData.scenes : [];
    const animations = projectData.animations || {};
    const cameraTracks = projectData.cameraTracks || {};
    const sceneReports = [];

    scenes.forEach((scene, idx) => {
      const sceneId = scene.id || `scene_${idx + 1}`;
      const seenIds = new Set();

      // Geometry & NaN/Duplicate checks
      for (const ch of (scene.characters || [])) {
        const cid = ch.characterId || ch.id;
        if (cid && seenIds.has(cid)) {
          issues.push({ severity: QA_SEVERITY.ERROR, sceneId, objectId: cid, code: 'DUPLICATE_INSTANCE_ID', description: `Trùng ID nhân vật "${cid}" trong ${sceneId}.`, autoRepairable: false });
        }
        if (cid) seenIds.add(cid);

        if (Array.isArray(ch.position)) {
          const [px, py] = ch.position;
          if (!Number.isFinite(px) || !Number.isFinite(py)) {
            issues.push({ severity: QA_SEVERITY.ERROR, sceneId, objectId: cid, code: 'NAN_TRANSFORM', description: `Tọa độ NaN/Infinity trên ${cid}.`, autoRepairable: true });
          } else {
            if (px < 0.02 || px > 0.98) {
              issues.push({ severity: QA_SEVERITY.WARNING, sceneId, objectId: cid, code: 'CHARACTER_OFF_SCREEN', description: `Nhân vật ${cid} nằm sát/ngoài mép ngang (${px}).`, autoRepairable: true });
            }
            if (py > 0.94) {
              issues.push({ severity: QA_SEVERITY.WARNING, sceneId, objectId: cid, code: 'FLOOR_PENETRATION', description: `Chân nhân vật ${cid} vượt quá mặt đất (${py}).`, autoRepairable: true });
            }
          }
        }
      }

      // Text Safe Area Geometry check
      for (const txt of (scene.texts || [])) {
        const tx = txt.x ?? 0.5;
        const ty = txt.y ?? 0.14;
        if (tx < 0.06 || tx > 0.94 || ty < 0.05 || ty > 0.92) {
          issues.push({ severity: QA_SEVERITY.WARNING, sceneId, code: 'TEXT_OUTSIDE_SAFE_AREA', description: `Text "${txt.text || ''}" ngoài safe area.`, autoRepairable: true });
        }
      }

      // Camera QA integration
      const camTrack = cameraTracks[sceneId] || scene.cameraTrack || { shots: [] };
      const camIssues = validateCameraAndVisuals(scene, camTrack);
      for (const ci of camIssues) {
        issues.push({
          severity: ci.level === 'ERROR' ? QA_SEVERITY.ERROR : (ci.level === 'INFO' ? QA_SEVERITY.INFO : QA_SEVERITY.WARNING),
          sceneId,
          code: ci.code,
          description: ci.message,
          autoRepairable: ci.code === 'TEXT_OUTSIDE_SAFE_AREA' || ci.code === 'ZOOM_OUT_OF_BOUNDS'
        });
      }

      // Animation QA integration
      const animScene = animations[sceneId];
      if (animScene?.characterTracks) {
        const animIssues = validateSceneAnimation(scene, animScene.characterTracks, scene.renderMode || 'procedural_rig');
        for (const ai of animIssues) {
          issues.push({
            severity: ai.level === 'ERROR' ? QA_SEVERITY.ERROR : (ai.level === 'INFO' ? QA_SEVERITY.INFO : QA_SEVERITY.WARNING),
            sceneId,
            objectId: ai.characterId,
            code: ai.code,
            description: ai.message,
            autoRepairable: false
          });
        }
      }

      const scIssues = issues.filter(i => i.sceneId === sceneId);
      const hasBlocker = scIssues.some(i => i.severity === QA_SEVERITY.BLOCKER);
      const hasError = scIssues.some(i => i.severity === QA_SEVERITY.ERROR);
      const hasWarn = scIssues.some(i => i.severity === QA_SEVERITY.WARNING);
      const status = scene.locked
        ? SCENE_QA_STATUS.LOCKED
        : (hasBlocker ? SCENE_QA_STATUS.BLOCKED : (hasError ? SCENE_QA_STATUS.NEEDS_REPAIR : (hasWarn ? SCENE_QA_STATUS.READY_WITH_WARNINGS : SCENE_QA_STATUS.READY)));

      sceneReports.push({
        sceneId,
        status,
        errors: scIssues.filter(i => i.severity === QA_SEVERITY.ERROR || i.severity === QA_SEVERITY.BLOCKER),
        warnings: scIssues.filter(i => i.severity === QA_SEVERITY.WARNING)
      });
    });

    const blockers = issues.filter(i => i.severity === QA_SEVERITY.BLOCKER);
    const errors = issues.filter(i => i.severity === QA_SEVERITY.ERROR);
    const warnings = issues.filter(i => i.severity === QA_SEVERITY.WARNING);

    return {
      isValid: blockers.length === 0 && errors.length === 0,
      issues,
      blockers,
      errors,
      warnings,
      sceneReports
    };
  }

  /**
   * V5.2 Phase 5B: Bounded Automatic Repair Loop with undoable audit records.
   * Never modifies script content, main character identity, audio duration, or locked scenes.
   */
  runAutomaticRepairLoop(projectData = {}, options = {}) {
    const maxIterations = Math.min(5, Math.max(1, Number(options.maxIterations ?? 3)));
    const history = [];
    let current = JSON.parse(JSON.stringify(projectData));
    let lastQa = null;

    for (let iter = 1; iter <= maxIterations; iter++) {
      lastQa = this.runComprehensiveQA(current);
      if (lastQa.isValid && lastQa.warnings.every(w => !w.autoRepairable)) {
        break;
      }

      let repairedInIter = 0;
      for (const scene of (current.scenes || [])) {
        if (scene.locked) continue;

        if (typeof scene.duration === 'number' && scene.duration <= 0) {
          history.push({ iter, sceneId: scene.id, code: 'INVALID_DURATION', before: scene.duration, after: 3.0, reason: 'Restore positive scene duration' });
          scene.duration = 3.0;
          repairedInIter++;
        }

        for (const ch of (scene.characters || [])) {
          if (typeof ch.scale === 'number' && (ch.scale < 0.2 || ch.scale > 3.0)) {
            const clamped = Math.min(3.0, Math.max(0.2, ch.scale));
            history.push({ iter, sceneId: scene.id, code: 'OUT_OF_BOUNDS_SCALE', before: ch.scale, after: clamped, reason: 'Clamp character scale to [0.2, 3.0]' });
            ch.scale = clamped;
            repairedInIter++;
          }
          if (Array.isArray(ch.position)) {
            const [px, py] = ch.position;
            const nx = Number.isFinite(px) ? Math.min(0.95, Math.max(0.05, px)) : 0.45;
            const ny = Number.isFinite(py) ? Math.min(0.88, Math.max(0.20, py)) : 0.78;
            if (nx !== px || ny !== py) {
              history.push({ iter, sceneId: scene.id, code: 'SAFE_POSITION', before: [...ch.position], after: [nx, ny], reason: 'Clamp character position to safe screen bounds' });
              ch.position = [nx, ny];
              repairedInIter++;
            }
          }
        }

        for (const txt of (scene.texts || [])) {
          const tx = txt.x ?? 0.5;
          const ty = txt.y ?? 0.14;
          const ntx = Math.min(0.88, Math.max(0.12, tx));
          const nty = Math.min(0.90, Math.max(0.08, ty));
          if (ntx !== tx || nty !== ty) {
            history.push({ iter, sceneId: scene.id, code: 'TEXT_OUTSIDE_SAFE_AREA', before: [tx, ty], after: [ntx, nty], reason: 'Clamp text overlay into safe area' });
            txt.x = ntx;
            txt.y = nty;
            repairedInIter++;
          }
        }
      }

      if (repairedInIter === 0) break;
    }

    const finalQa = this.runComprehensiveQA(current);
    return {
      success: finalQa.isValid,
      repairedProjectData: current,
      repairHistory: history,
      repairsCount: history.length,
      qaResult: finalQa
    };
  }

  /**
   * Builds detailed Missing Asset Inspector entries (never generic "missing N assets").
   */
  buildMissingAssetReport(missingAssets = []) {
    return (missingAssets || []).map(m => ({
      name: m.name || m.requirementId || m.id,
      assetId: m.resolvedAssetId || m.targetAssetId || m.id,
      requirementId: m.requirementId || m.id,
      type: m.type || m.category || 'unknown',
      sceneUsages: m.sceneUsages || m.scenes || [],
      reason: m.reason || 'Chưa có tài nguyên phù hợp trong thư viện hoặc binding.',
      repairOptions: ['CODE_GEN', 'LIBRARY', 'IMPORT', 'COPY_PROMPT', 'AI_REPAIR']
    }));
  }
}

export const defaultQaEngine = new TechnicalQaEngine();

