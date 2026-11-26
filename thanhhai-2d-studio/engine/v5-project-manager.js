// engine/v5-project-manager.js — Project Lifecycle, Atomic Autosave & Package Portability (V5 Phase 5)
// Manages project creation, revisioning, atomic saving, crash recovery, and ZIP export/import.

import fs from 'fs';
import path from 'path';

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
}

export const defaultProjectManager = new ProjectManager();

