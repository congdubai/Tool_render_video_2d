// engine/v5-automatic-scene-builder.js — Automatic Scene Builder & Composition Facade (V5 Phase 3)
// Primary programmatic facade for Tab 4 AI Auto Director and server endpoints.

import { BatchSceneBuilder } from './v5-batch-scene-builder.js';
import { SceneGraph } from './v5-scene-graph.js';
import { validateCompilerInputContract } from './v5-scene-compiler-contracts.js';
import { LAYOUT_TEMPLATES, selectBestLayoutTemplate } from './v5-layout-templates.js';
import { CAMERA_PRESETS } from './v5-layer-camera-builder.js';
import { RESOLUTIONS } from './v5-coordinate-system.js';

let globalBuilderInstance = null;

export function getGlobalSceneBuilder(projectContext = {}, resolvedBindings = {}) {
  if (!globalBuilderInstance) {
    globalBuilderInstance = new BatchSceneBuilder({
      projectContext,
      resolvedBindings
    });
  } else {
    if (Object.keys(resolvedBindings).length > 0) {
      globalBuilderInstance.resolvedBindings = { ...globalBuilderInstance.resolvedBindings, ...resolvedBindings };
    }
    if (Object.keys(projectContext).length > 0) {
      globalBuilderInstance.projectContext = { ...globalBuilderInstance.projectContext, ...projectContext };
    }
  }
  return globalBuilderInstance;
}

export function resetGlobalSceneBuilder() {
  globalBuilderInstance = null;
}

export async function executeAutoBuildAll(scenePlan = {}, resolvedBindings = {}, options = {}) {
  const builder = getGlobalSceneBuilder(options.projectContext, resolvedBindings);
  return await builder.buildAll(scenePlan, options.onProgress);
}

export function executeBuildSingleScene(sceneDescriptor = {}, resolvedBindings = {}, options = {}) {
  const builder = getGlobalSceneBuilder(options.projectContext, resolvedBindings);
  return builder.buildSingleScene(sceneDescriptor, options);
}

export function executeIncrementalRebuild(scenePlan = {}, resolvedBindings = {}) {
  const builder = getGlobalSceneBuilder({}, resolvedBindings);
  return builder.incrementalRebuild(scenePlan);
}

export function executeApplyUserOverride(sceneId, overrides = {}) {
  const builder = getGlobalSceneBuilder();
  builder.setUserOverride(sceneId, overrides);
  return { success: true, sceneId, overrides: builder.getUserOverride(sceneId) };
}

export function executeLockScene(sceneId, locked = true) {
  const builder = getGlobalSceneBuilder();
  builder.lockScene(sceneId, locked);
  return { success: true, sceneId, locked };
}

export function executeApplyScenePatch(targetSceneId, patch = {}, scenePlan = {}) {
  const builder = getGlobalSceneBuilder();
  return builder.rebuildWithPatch(targetSceneId, patch, scenePlan);
}

export {
  BatchSceneBuilder,
  SceneGraph,
  LAYOUT_TEMPLATES,
  selectBestLayoutTemplate,
  CAMERA_PRESETS,
  RESOLUTIONS,
  validateCompilerInputContract
};

