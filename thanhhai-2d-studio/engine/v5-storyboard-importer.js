// engine/v5-storyboard-importer.js — Storyboard Importer & Patch Engine (V5)
// Imports, validates, batches, and patches Scene Plan JSON from ChatGPT / Claude.

import { validateScenePlan } from './v5-scene-plan-validator.js';

/**
 * Parses and sanitizes raw JSON input, stripping markdown code fences if present.
 */
export function parseRawScenePlanJson(rawInput) {
  if (typeof rawInput === 'object' && rawInput !== null) {
    return rawInput;
  }
  if (typeof rawInput !== 'string') {
    throw new Error('Dữ liệu đầu vào phải là chuỗi JSON hoặc đối tượng JSON.');
  }

  let sanitized = rawInput.trim();
  // Strip Markdown ```json and ``` wrapper if AI included it
  if (sanitized.startsWith('```')) {
    sanitized = sanitized.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
  }

  try {
    return JSON.parse(sanitized);
  } catch (err) {
    throw new Error(`Lỗi cú pháp JSON: ${err.message}`);
  }
}

/**
 * Imports and validates a Scene Plan.
 */
export function importScenePlan(rawInput, projectContext = {}) {
  const parsed = parseRawScenePlanJson(rawInput);
  const validation = validateScenePlan(parsed, projectContext);

  return {
    success: validation.valid,
    scenePlan: parsed,
    validation,
    scenes: parsed.scenes || [],
    assetRequirements: validation.missingRequirements || []
  };
}

/**
 * Merges a new batch of scenes into an existing Scene Plan (for long 10-minute videos).
 */
export function mergeScenePlanBatch(existingPlan = {}, newBatch = {}) {
  const currentScenes = Array.isArray(existingPlan.scenes) ? [...existingPlan.scenes] : [];
  const incomingScenes = Array.isArray(newBatch.scenes) ? newBatch.scenes : [];
  const currentReqs = Array.isArray(existingPlan.assetRequirements) ? [...existingPlan.assetRequirements] : [];
  const incomingReqs = Array.isArray(newBatch.assetRequirements) ? newBatch.assetRequirements : [];

  const sceneMap = new Map();
  for (const s of currentScenes) {
    sceneMap.set(s.id, s);
  }

  // Merge scenes without overwriting locked scenes
  for (const newScene of incomingScenes) {
    const existing = sceneMap.get(newScene.id);
    if (existing && existing.locked) {
      continue; // Skip locked scenes
    }
    sceneMap.set(newScene.id, newScene);
  }

  // Merge and deduplicate asset requirements
  const reqMap = new Map();
  for (const r of currentReqs) {
    if (r.requirementId) reqMap.set(r.requirementId, r);
  }
  for (const r of incomingReqs) {
    if (r.requirementId) {
      if (reqMap.has(r.requirementId)) {
        // Merge requiredByScenes
        const existingReq = reqMap.get(r.requirementId);
        const mergedScenes = Array.from(new Set([...(existingReq.requiredByScenes || []), ...(r.requiredByScenes || [])]));
        reqMap.set(r.requirementId, { ...existingReq, requiredByScenes: mergedScenes });
      } else {
        reqMap.set(r.requirementId, r);
      }
    }
  }

  const mergedScenes = Array.from(sceneMap.values()).sort((a, b) => a.startMs - b.startMs);

  return {
    schemaVersion: newBatch.schemaVersion || existingPlan.schemaVersion || '5.1',
    project: { ...(existingPlan.project || {}), ...(newBatch.project || {}) },
    styleProfileId: newBatch.styleProfileId || existingPlan.styleProfileId,
    characterBindings: newBatch.characterBindings || existingPlan.characterBindings || [],
    assetRequirements: Array.from(reqMap.values()),
    scenes: mergedScenes
  };
}

/**
 * Applies a Scene Patch to update a single scene without touching other scenes.
 */
export function applyScenePatch(existingPlan = {}, patch = {}) {
  const targetSceneId = patch.targetSceneId || patch.scene?.id || patch.id;
  if (!targetSceneId) {
    throw new Error('Scene Patch phải chỉ định targetSceneId.');
  }

  const scenes = Array.isArray(existingPlan.scenes) ? [...existingPlan.scenes] : [];
  const targetIdx = scenes.findIndex(s => s.id === targetSceneId);
  if (targetIdx === -1) {
    throw new Error(`Không tìm thấy cảnh mục tiêu: "${targetSceneId}".`);
  }

  const oldScene = scenes[targetIdx];
  if (oldScene.locked) {
    throw new Error(`Cảnh "${targetSceneId}" đang bị KHÓA (Locked), không thể ghi đè patch.`);
  }

  const patchedScene = {
    ...oldScene,
    ...(patch.scene || patch),
    id: oldScene.id,
    startMs: patch.scene?.startMs ?? oldScene.startMs,
    endMs: patch.scene?.endMs ?? oldScene.endMs,
    patchedAt: new Date().toISOString(),
    revision: (oldScene.revision || 1) + 1
  };

  scenes[targetIdx] = patchedScene;

  return {
    ...existingPlan,
    scenes
  };
}

