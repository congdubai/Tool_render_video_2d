/**
 * Unified Engine Manager cho Thanh Hai 2D Studio
 * Quản lý thẩm định, xem trước khung hình và render video chuẩn Canvas/Three.js
 */

import path from "path";
import fs from "fs";
import {
  ENGINE_TYPES,
  ENGINE_DISPLAY_NAMES,
  ENGINE_ALIASES,
  normalizeEngineType,
  detectEngine,
  loadProjectMetadata,
  saveProjectMetadata
} from "./engine-detector.mjs";
import {
  isThanhHaiProject,
  validateThanhHaiProject,
  detectThanhHaiConfig,
  renderThanhHaiVideo,
  renderThanhHaiStill,
  renderThanhHaiContactSheet
} from "./thanhhai-render-adapter.mjs";

export { ENGINE_TYPES, ENGINE_DISPLAY_NAMES, ENGINE_ALIASES, normalizeEngineType, detectEngine };

export function validateEngine(projectDir, specifiedEngine = null) {
  const detected = detectEngine(projectDir);
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);
  return validateThanhHaiProject(effectiveRoot);
}

export function getEngineConfig(projectDir, specifiedEngine = null) {
  const detected = detectEngine(projectDir);
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);
  return detectThanhHaiConfig(effectiveRoot);
}

export async function previewEngine(projectDir, engineType = null, frame = 0, compositionId = null) {
  const detected = detectEngine(projectDir);
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);
  const cfg = detectThanhHaiConfig(effectiveRoot);
  const time = Number(frame) / (cfg.fps || 24);
  const res = await renderThanhHaiStill({
    projectDir: effectiveRoot,
    time,
    scale: 0.5
  });
  return {
    success: true,
    engine: ENGINE_TYPES.THANH_HAI,
    imagePath: res.imagePath,
    time: res.time
  };
}

export async function renderEngineVideo({
  projectDir,
  outputPath,
  engineType = null,
  isTest = false,
  scale = 1.0,
  characterRenderer = 'original',
  onProgress = null,
  checkCanceled = null
}) {
  const detected = detectEngine(projectDir);
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);
  return renderThanhHaiVideo({
    projectDir: effectiveRoot,
    outputPath,
    isTest,
    scale,
    characterRenderer,
    onProgress,
    checkCanceled
  });
}
