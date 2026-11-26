// engine/v5-dependency-graph.js — Asset & Scene Dependency Graph (V5 Phase 2)
// Builds and manages a directed dependency graph linking scenes, assets, rigs, and capabilities.
// Accurately tracks which scenes are affected when any asset is bound, updated, or removed.

export class AssetDependencyGraph {
  constructor(initialData = {}) {
    // sceneId -> Set of requirementIds
    this.sceneToRequirements = new Map();
    // requirementId -> Set of sceneIds
    this.requirementToScenes = new Map();
    // requirementId -> Set of requirementIds it depends on (e.g. Prop -> Hand Anchor -> Character Rig)
    this.dependencies = new Map();
    // requirementId -> Set of requirementIds that depend on it
    this.dependants = new Map();
    // requirementId -> Status
    this.requirementStatus = new Map();
    // sceneId -> Status
    this.sceneStatus = new Map();

    if (initialData.requirements || initialData.sceneRequirements) {
      this.populate(initialData);
    }
  }

  populate(scanResult = {}) {
    // Clear all existing state before populating to avoid node accumulation across scans
    this.sceneToRequirements.clear();
    this.requirementToScenes.clear();
    this.dependencies.clear();
    this.dependants.clear();
    this.requirementStatus.clear();
    this.sceneStatus.clear();

    const { requirements = [], sceneRequirements = {} } = scanResult;

    // Register requirements
    for (const req of requirements) {
      const rId = req.id;
      if (!this.requirementToScenes.has(rId)) {
        this.requirementToScenes.set(rId, new Set(req.requiredByScenes || []));
      }
      this.requirementStatus.set(rId, req.status || 'MISSING');

      if (Array.isArray(req.dependencies)) {
        for (const depId of req.dependencies) {
          this.addDependency(rId, depId);
        }
      }
    }

    // Register scenes
    for (const [sId, reqs] of Object.entries(sceneRequirements)) {
      if (!this.sceneToRequirements.has(sId)) {
        this.sceneToRequirements.set(sId, new Set());
      }
      const set = this.sceneToRequirements.get(sId);
      for (const r of reqs) {
        set.add(r.reqId);
        if (!this.requirementToScenes.has(r.reqId)) {
          this.requirementToScenes.set(r.reqId, new Set());
        }
        this.requirementToScenes.get(r.reqId).add(sId);
      }
      this.sceneStatus.set(sId, 'BLOCKED_BY_ASSETS');
    }

    this.recalculateAllSceneStatuses();
  }

  addDependency(childReqId, parentReqId) {
    if (!this.dependencies.has(childReqId)) {
      this.dependencies.set(childReqId, new Set());
    }
    this.dependencies.get(childReqId).add(parentReqId);

    if (!this.dependants.has(parentReqId)) {
      this.dependants.set(parentReqId, new Set());
    }
    this.dependants.get(parentReqId).add(childReqId);
  }

  setRequirementStatus(requirementId, status) {
    this.requirementStatus.set(requirementId, status);
    
    // Also propagate status if parent is invalid
    const affectedScenes = this.getAffectedScenes(requirementId);
    for (const sId of affectedScenes) {
      this.recalculateSceneStatus(sId);
    }
    return affectedScenes;
  }

  getRequirementStatus(requirementId) {
    return this.requirementStatus.get(requirementId) || 'MISSING';
  }

  getAffectedScenes(requirementId) {
    const affected = new Set();
    
    // Direct scenes
    const directScenes = this.requirementToScenes.get(requirementId) || [];
    for (const s of directScenes) {
      affected.add(s);
    }

    // Transitive scenes through dependants
    const queue = [requirementId];
    const visited = new Set([requirementId]);

    while (queue.length > 0) {
      const current = queue.shift();
      const children = this.dependants.get(current) || [];
      for (const child of children) {
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
          const childScenes = this.requirementToScenes.get(child) || [];
          for (const s of childScenes) {
            affected.add(s);
          }
        }
      }
    }

    return Array.from(affected);
  }

  recalculateSceneStatus(sceneId) {
    const reqIds = this.sceneToRequirements.get(sceneId) || [];
    let hasMissing = false;
    let hasReviewRequired = false;
    let hasIncompatible = false;
    let hasMissingCapability = false;

    for (const rId of reqIds) {
      const st = this.requirementStatus.get(rId) || 'MISSING';
      if (st === 'MISSING') hasMissing = true;
      else if (st === 'REVIEW_REQUIRED') hasReviewRequired = true;
      else if (st === 'INCOMPATIBLE' || st === 'REQUIRES_RIG_SETUP') hasIncompatible = true;
      else if (st === 'MISSING_CAPABILITY') hasMissingCapability = true;
    }

    let finalStatus = 'READY';
    if (hasMissingCapability) finalStatus = 'BLOCKED_BY_CAPABILITY';
    else if (hasIncompatible) finalStatus = 'BLOCKED_BY_ASSETS';
    else if (hasMissing) finalStatus = 'BLOCKED_BY_ASSETS';
    else if (hasReviewRequired) finalStatus = 'REVIEW_REQUIRED';

    this.sceneStatus.set(sceneId, finalStatus);
    return finalStatus;
  }

  recalculateAllSceneStatuses() {
    for (const sId of this.sceneToRequirements.keys()) {
      this.recalculateSceneStatus(sId);
    }
  }

  toJSON() {
    return {
      sceneToRequirements: Object.fromEntries(
        Array.from(this.sceneToRequirements.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      requirementToScenes: Object.fromEntries(
        Array.from(this.requirementToScenes.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      dependencies: Object.fromEntries(
        Array.from(this.dependencies.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      requirementStatus: Object.fromEntries(this.requirementStatus.entries()),
      sceneStatus: Object.fromEntries(this.sceneStatus.entries())
    };
  }

  static fromJSON(data = {}) {
    const graph = new AssetDependencyGraph();
    if (data.sceneToRequirements) {
      for (const [s, reqs] of Object.entries(data.sceneToRequirements)) {
        graph.sceneToRequirements.set(s, new Set(reqs));
      }
    }
    if (data.requirementToScenes) {
      for (const [r, scenes] of Object.entries(data.requirementToScenes)) {
        graph.requirementToScenes.set(r, new Set(scenes));
      }
    }
    if (data.dependencies) {
      for (const [c, parents] of Object.entries(data.dependencies)) {
        for (const p of parents) {
          graph.addDependency(c, p);
        }
      }
    }
    if (data.requirementStatus) {
      for (const [r, st] of Object.entries(data.requirementStatus)) {
        graph.requirementStatus.set(r, st);
      }
    }
    if (data.sceneStatus) {
      for (const [s, st] of Object.entries(data.sceneStatus)) {
        graph.sceneStatus.set(s, st);
      }
    }
    return graph;
  }
}

