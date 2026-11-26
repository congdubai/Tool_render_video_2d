// engine/v5-batch-scene-builder.js — 20-Step Pipeline & Batch Scene Builder (V5 Phase 3)
// Executes declarative compilation, incremental rebuild, user overrides, scene locks,
// and produces production-ready V4 scenes and Phase 4 Animation Contracts.

import crypto from 'crypto';
import { createDefaultScene, createDefaultProjectV4 } from './scene-model-v4.js';
import { computeSceneComposition } from './v5-composition-engine.js';
import { constructSceneGraph } from './v5-scene-construction.js';
import { resolveSceneConstraints, applyAutomaticLayoutCorrections } from './v5-constraint-resolver.js';
import { calculateCameraFraming } from './v5-layer-camera-builder.js';
import { SceneContinuityEngine } from './v5-scene-continuity-engine.js';
import { validateCompiledScene } from './v5-scene-validator.js';
import { SCENE_BUILD_STATUS, PROJECT_BUILD_STATUS, createAnimationReadyContract } from './v5-scene-compiler-contracts.js';

export class BatchSceneBuilder {
  constructor(options = {}) {
    this.projectContext = options.projectContext || {};
    this.resolvedBindings = options.resolvedBindings || {};
    this.userOverrides = new Map(); // sceneId -> overrides
    this.lockedScenes = new Set(); // set of locked sceneIds
    this.sceneHashes = new Map(); // sceneId -> contentHash
    this.compiledScenes = new Map(); // sceneId -> V4Scene
    this.sceneGraphs = new Map(); // sceneId -> SceneGraph
    this.animationContracts = new Map(); // sceneId -> AnimationReadyContract
    this.sceneStatuses = new Map(); // sceneId -> SCENE_BUILD_STATUS
    this.validationReports = new Map(); // sceneId -> ValidationReport
    this.continuityEngine = new SceneContinuityEngine();
    this.isCancelled = false;
  }

  cancel() {
    this.isCancelled = true;
  }

  lockScene(sceneId, locked = true) {
    if (locked) this.lockedScenes.add(sceneId);
    else this.lockedScenes.delete(sceneId);
    if (this.compiledScenes.has(sceneId)) {
      this.compiledScenes.get(sceneId).locked = locked;
    }
  }

  setUserOverride(sceneId, overrides = {}) {
    const existing = this.userOverrides.get(sceneId) || {};
    this.userOverrides.set(sceneId, { ...existing, ...overrides, updatedAt: new Date().toISOString() });
  }

  getUserOverride(sceneId) {
    return this.userOverrides.get(sceneId) || null;
  }

  computeSceneHash(sceneDescriptor = {}) {
    const json = JSON.stringify({
      scene: sceneDescriptor,
      bindings: this.resolvedBindings
    });
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Compiles a single scene through the 20-step pipeline
   */
  buildSingleScene(sceneDescriptor = {}, options = {}) {
    const sceneId = sceneDescriptor.id;
    if (!sceneId) {
      return {
        success: false,
        status: SCENE_BUILD_STATUS.FAILED,
        error: 'Thiếu trường bắt buộc id trong Scene Descriptor.'
      };
    }

    if (this.lockedScenes.has(sceneId) && !options.forceRebuild) {
      return {
        success: true,
        status: SCENE_BUILD_STATUS.LOCKED,
        compiledScene: this.compiledScenes.get(sceneId),
        sceneGraph: this.sceneGraphs.get(sceneId),
        animationContract: this.animationContracts.get(sceneId)
      };
    }

    this.sceneStatuses.set(sceneId, SCENE_BUILD_STATUS.BUILDING);

    try {
      // Step 1: Validate descriptor
      if (typeof sceneDescriptor.duration === 'number' && sceneDescriptor.duration <= 0) {
        throw new Error('Thời lượng cảnh phải lớn hơn 0.');
      }

      const duration = parseFloat(
        (sceneDescriptor.endMs && sceneDescriptor.startMs) 
          ? (sceneDescriptor.endMs - sceneDescriptor.startMs) / 1000 
          : (sceneDescriptor.duration || 5.0)
      );

      if (isNaN(duration) || duration <= 0) {
        throw new Error('Thời lượng cảnh không hợp lệ.');
      }
      const startTime = parseFloat(
        typeof sceneDescriptor.startMs === 'number' 
          ? sceneDescriptor.startMs / 1000 
          : (sceneDescriptor.startTime || sceneDescriptor.start || 0.0)
      );

      // Step 2 & 3: Resolve bindings & layout composition
      const composition = computeSceneComposition(sceneDescriptor, this.projectContext);

      // Step 4 to 11: Construct Scene Graph with all nodes
      const sceneGraph = constructSceneGraph(
        { ...sceneDescriptor, ...composition },
        this.resolvedBindings,
        this.projectContext
      );

      // Step 12 & 13: Resolve relative placement constraints
      if (Array.isArray(sceneDescriptor.constraints)) {
        resolveSceneConstraints(sceneGraph, sceneDescriptor.constraints);
      }

      // Step 14 & 15: Layer ordering is already handled in constructSceneGraph

      // Step 16: Prepare VFX & Composite actions
      const compositeActions = (sceneDescriptor.visualBeats || [])
        .filter(b => b.actionId?.startsWith('composite_'))
        .map(b => ({
          id: b.actionId,
          start: Math.max(0, (b.startMs - (sceneDescriptor.startMs || 0)) / 1000),
          duration: Math.max(0.5, (b.endMs - b.startMs) / 1000)
        }));

      // Step 17: Camera framing
      const targetBoxes = [];
      for (const c of composition.characters) {
        const box = sceneGraph.getWorldBoundingBox(c.instanceId);
        if (box) targetBoxes.push(box);
      }
      for (const p of composition.props) {
        const box = sceneGraph.getWorldBoundingBox(p.instanceId);
        if (box) targetBoxes.push(box);
      }
      const cameraConfig = calculateCameraFraming(targetBoxes, {
        preset: composition.cameraPreset,
        keyframes: sceneDescriptor.camera?.keyframes || []
      });

      // Step 18: Validate composition & detect collisions
      const initialReport = validateCompiledScene(
        { ...sceneDescriptor, duration },
        sceneGraph,
        { resolvedBindings: this.resolvedBindings }
      );

      // Step 19: Apply safe automatic layout corrections
      if (initialReport.warnings.length > 0) {
        applyAutomaticLayoutCorrections(sceneGraph, initialReport.warnings);
      }

      // Re-evaluate post-correction
      const finalReport = validateCompiledScene(
        { ...sceneDescriptor, duration },
        sceneGraph,
        { resolvedBindings: this.resolvedBindings }
      );

      // Step 20: Assemble final V4 Scene Model instance
      if (!finalReport.isValid) {
        this.sceneStatuses.set(sceneId, SCENE_BUILD_STATUS.FAILED);
        this.validationReports.set(sceneId, finalReport);
        return {
          success: false,
          status: SCENE_BUILD_STATUS.FAILED,
          validationReport: finalReport,
          error: finalReport.errors.map(e => e.message).join('; ')
        };
      }

      const v4Characters = composition.characters.map(c => {
        const charNode = sceneGraph.getNode(c.instanceId);
        const transform = charNode ? sceneGraph.getWorldTransform(c.instanceId) : { x: c.position.x, y: c.position.y };
        return {
          characterId: c.characterId,
          role: c.role,
          outfitId: c.outfitId,
          position: [Math.round(transform.x * 1280), Math.round(transform.y * 720)],
          scale: Math.round((c.scale || 1.0) * 100) / 100,
          rotation: 0.0,
          facing: c.facing ?? 1,
          groundAligned: true,
          zIndex: c.zIndex || 10,
          visible: true,
          locked: c.locked ?? false
        };
      });

      const v4Props = composition.props.map(p => {
        const propNode = sceneGraph.getNode(p.instanceId);
        const transform = propNode ? sceneGraph.getWorldTransform(p.instanceId) : { x: p.position.x, y: p.position.y };
        return {
          id: p.instanceId,
          assetId: p.assetId,
          target: p.attachedTo || null,
          anchor: p.anchorPreset || 'center',
          position: [Math.round(transform.x * 1280), Math.round(transform.y * 720)],
          scale: Math.round((p.scale || 1.0) * 100) / 100,
          rotation: p.rotation || 0.0,
          zIndex: p.zIndex || 8,
          visible: true,
          locked: p.locked ?? false
        };
      });

      const bgAssetId = sceneDescriptor.background?.assetId || sceneDescriptor.background?.id || 'bg_lab_modern';
      const resolvedBgId = this.resolvedBindings[bgAssetId]?.resolvedAssetId || bgAssetId;

      const v4Scene = createDefaultScene(sceneId, {
        name: sceneDescriptor.visualObjective || sceneDescriptor.narrationText?.slice(0, 35) || `Cảnh ${sceneId}`,
        description: sceneDescriptor.visualObjective || '',
        start: startTime,
        startTime,
        duration,
        narration: {
          subtitle: sceneDescriptor.narrationText || '',
          start: 0,
          end: duration
        },
        subtitle: {
          text: sceneDescriptor.narrationText || ''
        },
        background: {
          id: resolvedBgId,
          assetId: resolvedBgId,
          type: 'library',
          groundY: Math.round(composition.groundY * 720)
        },
        characters: v4Characters,
        props: v4Props,
        camera: cameraConfig,
        textGraphics: composition.textGraphics,
        compositeActions,
        vfx: sceneDescriptor.vfx || [],
        locked: this.lockedScenes.has(sceneId)
      });

      // Apply user overrides if any exist
      const userOverride = this.getUserOverride(sceneId);
      if (userOverride) {
        if (userOverride.camera) v4Scene.camera = { ...v4Scene.camera, ...userOverride.camera };
        if (userOverride.background) v4Scene.background = { ...v4Scene.background, ...userOverride.background };
        if (Array.isArray(userOverride.characters)) v4Scene.characters = userOverride.characters;
        if (Array.isArray(userOverride.props)) v4Scene.props = userOverride.props;
      }

      // Generate Phase 4 Animation Contract
      const animContract = createAnimationReadyContract({
        sceneId,
        durationSec: duration,
        sceneGraphData: sceneGraph.toJSON(),
        characterInstances: v4Characters,
        propInstances: v4Props,
        cameraTargets: targetBoxes,
        continuityState: { mode: sceneDescriptor.continuityMode || 'CONTINUOUS' }
      });

      // Update registries
      this.compiledScenes.set(sceneId, v4Scene);
      this.sceneGraphs.set(sceneId, sceneGraph);
      this.animationContracts.set(sceneId, animContract);
      this.validationReports.set(sceneId, finalReport);
      this.sceneHashes.set(sceneId, this.computeSceneHash(sceneDescriptor));

      const finalStatus = finalReport.hasWarnings ? SCENE_BUILD_STATUS.BUILT_WITH_WARNINGS : SCENE_BUILD_STATUS.BUILT;
      this.sceneStatuses.set(sceneId, finalStatus);

      return {
        success: true,
        status: finalStatus,
        compiledScene: v4Scene,
        sceneGraph,
        animationContract: animContract,
        validationReport: finalReport
      };

    } catch (err) {
      this.sceneStatuses.set(sceneId, SCENE_BUILD_STATUS.FAILED);
      return {
        success: false,
        status: SCENE_BUILD_STATUS.FAILED,
        error: err.message
      };
    }
  }

  /**
   * Batch builds all scenes in a scene plan with progress reporting and isolation
   */
  async buildAll(scenePlan = {}, onProgress = null) {
    this.isCancelled = false;
    const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
    const total = scenes.length;

    // Propagate cross-scene continuity first
    const resolvedScenes = this.continuityEngine.propagateContinuity(scenes);

    let builtCount = 0;
    let failedCount = 0;
    let warningCount = 0;

    for (let i = 0; i < total; i++) {
      if (this.isCancelled) break;

      const s = resolvedScenes[i];
      const result = this.buildSingleScene(s);

      if (result.success) {
        builtCount++;
        if (result.status === SCENE_BUILD_STATUS.BUILT_WITH_WARNINGS) warningCount++;
      } else {
        failedCount++;
      }

      if (typeof onProgress === 'function') {
        onProgress({
          current: i + 1,
          total,
          percent: Math.round(((i + 1) / total) * 100),
          sceneId: s.id,
          status: result.status
        });
      }
    }

    const projectStatus = failedCount > 0 
      ? (builtCount > 0 ? PROJECT_BUILD_STATUS.PARTIALLY_BUILT : PROJECT_BUILD_STATUS.BUILD_FAILED)
      : (warningCount > 0 ? PROJECT_BUILD_STATUS.SCENES_BUILT_WITH_WARNINGS : PROJECT_BUILD_STATUS.SCENES_BUILT);

    const compiledList = [];
    for (const s of scenes) {
      if (this.compiledScenes.has(s.id)) {
        compiledList.push(this.compiledScenes.get(s.id));
      }
    }

    const v4Project = createDefaultProjectV4({
      name: scenePlan.project?.title || 'Dự Án AI Storyboard V5',
      author: 'AI Auto Director V5',
      fps: scenePlan.project?.fps || 24,
      width: scenePlan.project?.resolution?.width || 1280,
      height: scenePlan.project?.resolution?.height || 720,
      scenes: compiledList
    });

    return {
      success: failedCount === 0 && !this.isCancelled,
      projectStatus,
      stats: {
        totalScenes: total,
        builtCount,
        failedCount,
        warningCount,
        lockedCount: this.lockedScenes.size
      },
      compiledProject: v4Project,
      scenes: compiledList
    };
  }

  /**
   * Incremental rebuild: Only rebuilds scenes whose content hash or dependencies changed
   */
  incrementalRebuild(scenePlan = {}) {
    const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
    const rebuiltSceneIds = [];

    for (const s of scenes) {
      const newHash = this.computeSceneHash(s);
      const oldHash = this.sceneHashes.get(s.id);

      if (newHash !== oldHash || !this.compiledScenes.has(s.id)) {
        this.buildSingleScene(s, { forceRebuild: true });
        rebuiltSceneIds.push(s.id);
      }
    }

    return {
      success: true,
      rebuiltCount: rebuiltSceneIds.length,
      rebuiltSceneIds
    };
  }

  /**
   * Rebuilds a target scene with an AI Scene Patch
   */
  rebuildWithPatch(targetSceneId, scenePatch = {}, fullScenePlan = {}) {
    const scenes = fullScenePlan.scenes || [];
    const targetIdx = scenes.findIndex(s => s.id === targetSceneId);
    if (targetIdx === -1) {
      throw new Error(`Không tìm thấy scene "${targetSceneId}" trong Scene Plan.`);
    }

    // Merge patch
    const updatedDescriptor = { ...scenes[targetIdx], ...scenePatch };
    scenes[targetIdx] = updatedDescriptor;

    // Build target scene
    const result = this.buildSingleScene(updatedDescriptor, { forceRebuild: true });
    return result;
  }
}

export function buildBatchScenes(scenesOrPlan, options = {}) {
  const plan = Array.isArray(scenesOrPlan) ? { scenes: scenesOrPlan } : (scenesOrPlan || {});
  const builder = new BatchSceneBuilder(options);
  const scenes = Array.isArray(plan.scenes) ? plan.scenes : [];
  const compiledScenes = [];
  const failedScenes = [];

  for (const s of scenes) {
    const res = builder.buildSingleScene(s);
    if (res.success && res.compiledScene) {
      compiledScenes.push(res.compiledScene);
    } else {
      failedScenes.push({ sceneId: s.id, error: res.error });
    }
  }

  return {
    success: failedScenes.length === 0,
    compiledScenes,
    failedScenes
  };
}

