// engine/v5-readiness-engine.js — Project Readiness Engine & Scene Builder Contract (V5 Phase 2)
// Calculates granular readiness rates for assets, scenes, and capabilities.
// Provides unsupported action handling and prepares the unified Scene Builder Integration Contract.

export function calculateProjectReadiness(scenePlan = {}, dependencyGraph, bindingRegistry) {
  const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  const sceneStatuses = dependencyGraph ? dependencyGraph.sceneStatus : new Map();
  const reqStatuses = dependencyGraph ? dependencyGraph.requirementStatus : new Map();

  let readyAssetCount = 0;
  let missingAssetCount = 0;
  let reviewRequiredAssetCount = 0;
  let incompatibleAssetCount = 0;
  let missingCapabilityCount = 0;

  for (const [rId, st] of reqStatuses.entries()) {
    if (st === 'READY') readyAssetCount++;
    else if (st === 'MISSING') missingAssetCount++;
    else if (st === 'REVIEW_REQUIRED') reviewRequiredAssetCount++;
    else if (st === 'INCOMPATIBLE' || st === 'REQUIRES_RIG_SETUP') incompatibleAssetCount++;
    else if (st === 'MISSING_CAPABILITY') missingCapabilityCount++;
  }

  const totalAssets = reqStatuses.size;
  const assetReadinessRate = totalAssets > 0 ? Math.round((readyAssetCount / totalAssets) * 100) : 100;

  let readySceneCount = 0;
  let blockedByAssetsSceneCount = 0;
  let blockedByCapabilitySceneCount = 0;
  let reviewRequiredSceneCount = 0;

  for (const [sId, st] of sceneStatuses.entries()) {
    if (st === 'READY') readySceneCount++;
    else if (st === 'BLOCKED_BY_ASSETS') blockedByAssetsSceneCount++;
    else if (st === 'BLOCKED_BY_CAPABILITY') blockedByCapabilitySceneCount++;
    else if (st === 'REVIEW_REQUIRED') reviewRequiredSceneCount++;
  }

  const totalScenes = scenes.length;
  const sceneReadinessRate = totalScenes > 0 ? Math.round((readySceneCount / totalScenes) * 100) : 100;
  const capabilityReadinessRate = totalAssets > 0 ? Math.round(((totalAssets - missingCapabilityCount) / totalAssets) * 100) : 100;

  let projectStatus = 'BLOCKED';
  if (missingCapabilityCount > 0) {
    projectStatus = 'BLOCKED';
  } else if (missingAssetCount === 0 && reviewRequiredAssetCount === 0 && incompatibleAssetCount === 0) {
    projectStatus = 'ASSETS_READY';
  } else if (readyAssetCount > 0) {
    projectStatus = 'PARTIALLY_READY';
  }

  return {
    projectStatus,
    rates: {
      assetReadinessRate,
      sceneReadinessRate,
      capabilityReadinessRate
    },
    counts: {
      totalAssets,
      readyAssetCount,
      missingAssetCount,
      reviewRequiredAssetCount,
      incompatibleAssetCount,
      missingCapabilityCount,
      totalScenes,
      readySceneCount,
      blockedByAssetsSceneCount,
      blockedByCapabilitySceneCount,
      reviewRequiredSceneCount
    },
    isReadyForSceneBuilding: projectStatus === 'ASSETS_READY'
  };
}

export function buildSceneBuilderContract(scenePlan = {}, bindingRegistry, readinessReport) {
  const bindings = bindingRegistry ? bindingRegistry.getAllBindings() : {};

  return {
    contractVersion: '5.2.0',
    timestamp: new Date().toISOString(),
    project: scenePlan.project || {},
    style: scenePlan.style || {},
    resolvedBindings: bindings,
    readiness: readinessReport,
    sceneCount: (scenePlan.scenes || []).length,
    canCompile: readinessReport.isReadyForSceneBuilding
  };
}

