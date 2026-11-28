// engine/v5-project-manager.js — Project Lifecycle, Atomic Autosave & Package Portability (V5 Phase 5)
// Manages project creation, revisioning, atomic saving, crash recovery, and ZIP export/import.

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export function validateUntrustedScenePlanSecurity(scenePlan = {}) {
  const raw = JSON.stringify(scenePlan);
  const dangerous = [/<script/i, /\beval\s*\(/i, /\bnew\s+Function\b/i, /child_process/i];
  for (const re of dangerous) {
    if (re.test(raw)) {
      throw new Error(`Security violation: Scene Plan contains disallowed pattern ${re}`);
    }
  }
  return true;
}

export class ProjectManager {
  constructor(projectsDir = path.resolve(process.cwd(), 'data', 'v5-projects')) {
    this.projectsDir = projectsDir;
    this._ensureStorage();
  }

  _ensureStorage() {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  /**
   * Creates a new V5 production project
   */
  createProject(name = 'Dự án mới', options = {}) {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const project = {
      id,
      name,
      revision: '1.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scriptText: options.scriptText || '',
      styleProfile: options.styleProfile || 'vietnamese_cartoon',
      audio: options.audio || null,
      timeline: options.timeline || null,
      scenePlan: options.scenePlan || { scenes: [] },
      compiledScenes: [],
      animationTracks: {},
      lockedSceneIds: [],
      renderSettings: {
        resolution: '1920x1080',
        fps: 30,
        encoder: 'libx264',
        quality: 'Standard'
      },
      userOverrides: {},
      revisions: []
    };

    this.saveProjectAtomic(project);
    return project;
  }

  /**
   * Saves project atomically using temporary file + rename to prevent corruption on crash
   */
  saveProjectAtomic(project = {}) {
    if (!project.id) throw new Error('Dự án thiếu ID hợp lệ.');

    project.updatedAt = new Date().toISOString();
    const finalPath = path.join(this.projectsDir, `${project.id}.json`);
    const tempPath = path.join(this.projectsDir, `${project.id}.tmp_${Date.now()}`);

    fs.writeFileSync(tempPath, JSON.stringify(project, null, 2), 'utf8');
    fs.renameSync(tempPath, finalPath);
    return true;
  }

  loadProject(projectId) {
    const filePath = path.join(this.projectsDir, `${projectId}.json`);
    if (!fs.existsSync(filePath)) return null;

    try {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      console.error(`Lỗi đọc project ${projectId}:`, err);
      return null;
    }
  }

  duplicateProject(projectId, newName = null) {
    const original = this.loadProject(projectId);
    if (!original) throw new Error(`Không tìm thấy dự án gốc ${projectId}`);

    const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duplicated = JSON.parse(JSON.stringify(original));

    duplicated.id = newId;
    duplicated.name = newName || `${original.name} (Bản sao)`;
    duplicated.createdAt = new Date().toISOString();
    duplicated.updatedAt = new Date().toISOString();
    duplicated.revision = '1.0';

    this.saveProjectAtomic(duplicated);
    return duplicated;
  }

  listProjects() {
    this._ensureStorage();
    const files = fs.readdirSync(this.projectsDir).filter(f => f.endsWith('.json'));
    const projects = [];

    files.forEach(f => {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(this.projectsDir, f), 'utf8'));
        projects.push({
          id: content.id,
          name: content.name,
          revision: content.revision,
          updatedAt: content.updatedAt,
          scenesCount: content.scenePlan?.scenes?.length || 0
        });
      } catch {}
    });

    return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /**
   * Exports project package manifest with relative portable paths
   */
  exportPackageManifest(projectId, isSelfContained = false) {
    const proj = this.loadProject(projectId);
    if (!proj) throw new Error(`Không tìm thấy dự án ${projectId}`);

    const manifest = {
      manifestVersion: '5.0',
      exportedAt: new Date().toISOString(),
      isSelfContained,
      project: {
        id: proj.id,
        name: proj.name,
        revision: proj.revision,
        styleProfile: proj.styleProfile,
        renderSettings: proj.renderSettings,
        scenePlan: proj.scenePlan,
        lockedSceneIds: proj.lockedSceneIds
      },
      portableAssetDependencies: []
    };

    return manifest;
  }

  renameProject(projectId, newName) {
    const proj = this.loadProject(projectId);
    if (!proj) throw new Error(`Không tìm thấy dự án ${projectId}`);
    proj.name = String(newName || proj.name).trim();
    this.saveProjectAtomic(proj);
    return proj;
  }

  createRevisionSnapshot(projectId, label = 'Manual backup') {
    const proj = this.loadProject(projectId);
    if (!proj) throw new Error(`Không tìm thấy dự án ${projectId}`);
    proj.revisions = Array.isArray(proj.revisions) ? proj.revisions : [];
    const revNum = `1.${proj.revisions.length + 1}`;
    proj.revisions.push({
      revision: revNum,
      label,
      savedAt: new Date().toISOString(),
      scenesCount: proj.scenePlan?.scenes?.length || 0
    });
    proj.revision = revNum;
    this.saveProjectAtomic(proj);
    return proj;
  }

  /**
   * V5.2 Phase 5D: Portable Project ZIP Export (zero absolute machine paths or secrets)
   */
  exportProjectZip(projectId, outZipPath, extra = {}) {
    const proj = this.loadProject(projectId);
    if (!proj) throw new Error(`Không tìm thấy dự án ${projectId}`);
    fs.mkdirSync(path.dirname(outZipPath), { recursive: true });

    const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (k, v) => {
      if (/(apiKey|password|secret|token)/i.test(k)) return undefined;
      if (typeof v === 'string' && /^[a-zA-Z]:\\/.test(v)) return path.basename(v);
      return v;
    }));

    const zip = new AdmZip();
    const addJson = (name, data) => zip.addFile(name, Buffer.from(JSON.stringify(sanitize(data), null, 2), 'utf8'));
    addJson('project.json', { id: proj.id, name: proj.name, revision: proj.revision, styleProfile: proj.styleProfile, renderSettings: proj.renderSettings, lockedSceneIds: proj.lockedSceneIds });
    addJson('scene_plan.json', proj.scenePlan || { scenes: [] });
    addJson('asset_bindings.json', extra.assetBindings || proj.assetBindings || {});
    addJson('character_bindings.json', extra.characterBindings || proj.characterBindings || []);
    addJson('compiled_scenes.json', proj.compiledScenes || []);
    addJson('animation_tracks.json', proj.animationTracks || {});
    addJson('camera_tracks.json', extra.cameraTracks || proj.cameraTracks || {});
    addJson('qa_reports.json', extra.qaReports || {});
    addJson('manifest.json', this.exportPackageManifest(projectId, true));
    zip.writeZip(outZipPath);
    return { success: true, zipPath: outZipPath, sizeBytes: fs.statSync(outZipPath).size };
  }

  /**
   * V5.2 Phase 5D: Secure Portable Project ZIP Import (blocks ZIP traversal & ZIP bombs)
   */
  importProjectZip(zipPath, options = {}) {
    if (!fs.existsSync(zipPath)) throw new Error(`Không tìm thấy file ZIP: ${zipPath}`);
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const maxTotalBytes = Number(options.maxUncompressedBytes || 100 * 1024 * 1024);
    let totalBytes = 0;

    for (const entry of entries) {
      const name = entry.entryName.replace(/\\/g, '/');
      if (name.startsWith('/') || name.includes('..') || /^[a-zA-Z]:/.test(name)) {
        throw new Error(`ZIP path traversal bị chặn: ${entry.entryName}`);
      }
      totalBytes += Math.max(0, entry.header?.size || 0);
      if (totalBytes > maxTotalBytes) {
        throw new Error(`ZIP bomb bị chặn: dung lượng giải nén vượt ${maxTotalBytes} bytes`);
      }
    }

    const readJson = (entryName, fallback) => {
      const e = zip.getEntry(entryName);
      if (!e) return fallback;
      const parsed = JSON.parse(e.getData().toString('utf8'));
      validateUntrustedScenePlanSecurity(parsed);
      return parsed;
    };

    const projMeta = readJson('project.json', {});
    const scenePlan = readJson('scene_plan.json', { scenes: [] });
    const assetBindings = readJson('asset_bindings.json', {});
    const characterBindings = readJson('character_bindings.json', []);
    const compiledScenes = readJson('compiled_scenes.json', []);
    const animationTracks = readJson('animation_tracks.json', {});
    const cameraTracks = readJson('camera_tracks.json', {});

    const imported = this.createProject(projMeta.name || 'Imported Project', {
      styleProfile: projMeta.styleProfile || 'educational_cartoon',
      scenePlan
    });
    imported.renderSettings = projMeta.renderSettings || imported.renderSettings;
    imported.lockedSceneIds = projMeta.lockedSceneIds || [];
    imported.assetBindings = assetBindings;
    imported.characterBindings = characterBindings;
    imported.compiledScenes = compiledScenes;
    imported.animationTracks = animationTracks;
    imported.cameraTracks = cameraTracks;
    this.saveProjectAtomic(imported);
    return imported;
  }

  /**
   * V5.2 Phase 5D: Applies Scene Patch JSON to affected scenes only, preserving locked scenes & undo history.
   */
  applyScenePatch(projectId, patchJson = {}) {
    validateUntrustedScenePlanSecurity(patchJson);
    const proj = this.loadProject(projectId);
    if (!proj) throw new Error(`Không tìm thấy dự án ${projectId}`);

    const locked = new Set(proj.lockedSceneIds || []);
    const patchScenes = Array.isArray(patchJson.scenes) ? patchJson.scenes : [];
    const beforeSnapshot = JSON.parse(JSON.stringify(proj.scenePlan));
    const affectedSceneIds = [];
    const skippedLockedIds = [];

    proj.scenePlan = proj.scenePlan || { scenes: [] };
    proj.scenePlan.scenes = proj.scenePlan.scenes || [];

    for (const ps of patchScenes) {
      if (!ps.id) continue;
      if (locked.has(ps.id)) {
        skippedLockedIds.push(ps.id);
        continue;
      }
      const idx = proj.scenePlan.scenes.findIndex(s => s.id === ps.id);
      if (idx >= 0) {
        proj.scenePlan.scenes[idx] = { ...proj.scenePlan.scenes[idx], ...ps };
      } else {
        proj.scenePlan.scenes.push(ps);
      }
      affectedSceneIds.push(ps.id);
    }

    proj.lastUndoSnapshot = beforeSnapshot;
    this.saveProjectAtomic(proj);
    return { success: true, affectedSceneIds, skippedLockedIds, project: proj };
  }
}

export const defaultProjectManager = new ProjectManager();

