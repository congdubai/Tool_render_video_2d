// engine/v5-asset-binding-registry.js — Asset Binding Registry & Version Manager (V5 Phase 2)
// Manages concrete asset bindings to declarative requirement IDs, handles versioning,
// tracks scene dependencies, supports rollback, and persists state to project files.

import fs from 'node:fs';
import path from 'node:path';

export class AssetBindingRegistry {
  constructor(projectDir = null, dependencyGraph = null) {
    this.projectDir = projectDir;
    this.dependencyGraph = dependencyGraph;
    
    // requirementId -> Binding Record
    this.bindings = new Map();
    // requirementId -> Array of Version Records [{ version: 1, assetId, imagePath, timestamp }]
    this.versionHistory = new Map();
    // requirementId -> boolean
    this.lockedBindings = new Set();
  }

  bind(requirementId, resolvedAssetId, options = {}) {
    if (this.lockedBindings.has(requirementId) && !options.force) {
      throw new Error(`Liên kết của yêu cầu "${requirementId}" đã bị khóa (Locked). Không thể thay đổi.`);
    }

    const currentVersion = (this.versionHistory.get(requirementId) || []).length + 1;
    const isShared = options.isSharedAsset ?? false;
    const isProject = !isShared;

    const binding = {
      requirementId,
      resolvedAssetId,
      resolutionMethod: options.resolutionMethod || 'MANUAL_BIND',
      status: options.status || 'READY',
      assetVersion: currentVersion,
      requiredByScenes: options.requiredByScenes || [],
      isProjectAsset: isProject,
      isSharedAsset: isShared,
      anchor: options.anchor || { x: 0.5, y: 0.5 },
      imagePath: options.imagePath || null,
      dimensions: options.dimensions || null,
      updatedAt: new Date().toISOString()
    };

    this.bindings.set(requirementId, binding);

    // Save version history
    if (!this.versionHistory.has(requirementId)) {
      this.versionHistory.set(requirementId, []);
    }
    this.versionHistory.get(requirementId).push({
      version: currentVersion,
      resolvedAssetId,
      imagePath: options.imagePath || null,
      anchor: binding.anchor,
      timestamp: binding.updatedAt
    });

    // Notify dependency graph to propagate scene readiness
    let affectedScenes = [];
    if (this.dependencyGraph) {
      affectedScenes = this.dependencyGraph.setRequirementStatus(requirementId, binding.status);
    }

    if (this.projectDir && options.autoSave !== false) {
      this.save();
    }

    return {
      binding,
      affectedScenes
    };
  }

  unbind(requirementId) {
    if (this.lockedBindings.has(requirementId)) {
      throw new Error(`Liên kết của "${requirementId}" đang bị khóa, không thể hủy liên kết.`);
    }

    this.bindings.delete(requirementId);
    let affectedScenes = [];
    if (this.dependencyGraph) {
      affectedScenes = this.dependencyGraph.setRequirementStatus(requirementId, 'MISSING');
    }

    if (this.projectDir) {
      this.save();
    }

    return { success: true, requirementId, affectedScenes };
  }

  lock(requirementId) {
    this.lockedBindings.add(requirementId);
    return true;
  }

  unlock(requirementId) {
    this.lockedBindings.delete(requirementId);
    return true;
  }

  rollback(requirementId, targetVersion) {
    const history = this.versionHistory.get(requirementId);
    if (!history || history.length === 0) {
      throw new Error(`Không tìm thấy lịch sử phiên bản cho yêu cầu "${requirementId}"`);
    }

    const versionRecord = history.find(v => v.version === targetVersion);
    if (!versionRecord) {
      throw new Error(`Không tồn tại phiên bản ${targetVersion} của yêu cầu "${requirementId}"`);
    }

    return this.bind(requirementId, versionRecord.resolvedAssetId, {
      imagePath: versionRecord.imagePath,
      anchor: versionRecord.anchor,
      force: true
    });
  }

  promoteToShared(requirementId) {
    const binding = this.bindings.get(requirementId);
    if (!binding) {
      throw new Error(`Yêu cầu "${requirementId}" chưa được liên kết với tài nguyên nào`);
    }
    binding.isSharedAsset = true;
    binding.isProjectAsset = false;
    if (this.projectDir) {
      this.save();
    }
    return binding;
  }

  getBinding(requirementId) {
    return this.bindings.get(requirementId) || null;
  }

  getAllBindings() {
    return Object.fromEntries(this.bindings.entries());
  }

  save(targetDir = this.projectDir) {
    if (!targetDir) return;
    fs.mkdirSync(targetDir, { recursive: true });

    const bindingsFile = path.join(targetDir, 'asset_bindings.json');
    const historyFile = path.join(targetDir, 'asset_version_history.json');
    const lockedFile = path.join(targetDir, 'asset_locked_bindings.json');

    fs.writeFileSync(bindingsFile, JSON.stringify(Object.fromEntries(this.bindings.entries()), null, 2), 'utf8');
    fs.writeFileSync(historyFile, JSON.stringify(Object.fromEntries(this.versionHistory.entries()), null, 2), 'utf8');
    fs.writeFileSync(lockedFile, JSON.stringify(Array.from(this.lockedBindings), null, 2), 'utf8');
  }

  load(targetDir = this.projectDir) {
    if (!targetDir || !fs.existsSync(targetDir)) return;

    const bindingsFile = path.join(targetDir, 'asset_bindings.json');
    if (fs.existsSync(bindingsFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(bindingsFile, 'utf8'));
        this.bindings = new Map(Object.entries(data));
      } catch (err) {
        console.error('Lỗi khi tải asset_bindings.json:', err.message);
      }
    }

    const historyFile = path.join(targetDir, 'asset_version_history.json');
    if (fs.existsSync(historyFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
        this.versionHistory = new Map(Object.entries(data));
      } catch (err) {
        console.error('Lỗi khi tải asset_version_history.json:', err.message);
      }
    }

    const lockedFile = path.join(targetDir, 'asset_locked_bindings.json');
    if (fs.existsSync(lockedFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(lockedFile, 'utf8'));
        this.lockedBindings = new Set(data);
      } catch (err) {
        console.error('Lỗi khi tải asset_locked_bindings.json:', err.message);
      }
    }
  }
}

