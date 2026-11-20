/**
 * Unified Engine Manager & Adapter Dispatcher
 * Điều phối tập trung 3 Engine hoạt hình:
 * 1. Remotion (React, TSX, @remotion/renderer)
 * 2. Thanh Hai 2D Studio (Canvas, Three.js, Playwright, FFmpeg)
 * 3. Python 2D Long Form (Python, Skia, Timeline, FFmpeg)
 */

import path from "path";
import fs from "fs";
import {
  ENGINE_TYPES,
  ENGINE_DISPLAY_NAMES,
  detectEngine,
  detectPythonProjectConfig
} from "./engine-detector.mjs";
import { validateProject, detectProjectConfig } from "./project-loader.mjs";
import { renderDynamicVideo } from "./dynamic-render.mjs";
import {
  validateThanhHaiProject,
  detectThanhHaiConfig,
  renderThanhHaiVideo,
  renderThanhHaiStill,
  renderThanhHaiContactSheet
} from "./thanhhai-render-adapter.mjs";
import {
  validatePythonProject,
  renderPythonVideo,
  renderPythonPreview,
  checkPythonDependencies
} from "./python-longform-adapter.mjs";

export { ENGINE_TYPES, ENGINE_DISPLAY_NAMES, detectEngine };

/**
 * Thẩm định dự án theo đúng Engine tương ứng
 * @param {string} projectDir Đường dẫn dự án
 * @param {string} [specifiedEngine=null] Engine cụ thể do người dùng chọn (hoặc auto)
 * @returns {object}
 */
export function validateEngine(projectDir, specifiedEngine = null) {
  const detected = detectEngine(projectDir, { manualEngine: specifiedEngine });
  const engineType = (specifiedEngine && specifiedEngine !== "auto") ? specifiedEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  let validation = null;

  switch (engineType) {
    case ENGINE_TYPES.PYTHON_LONG_FORM:
      validation = validatePythonProject(effectiveRoot);
      break;

    case ENGINE_TYPES.THANH_HAI:
      validation = validateThanhHaiProject(effectiveRoot);
      break;

    case ENGINE_TYPES.REMOTION:
    default:
      validation = validateProject(effectiveRoot);
      break;
  }

  // Kết hợp warnings từ bộ nhận diện nếu có
  if (detected.warnings && detected.warnings.length > 0) {
    validation.warnings = [...(validation.warnings || []), ...detected.warnings];
  }

  validation.engine = engineType;
  validation.engineName = ENGINE_DISPLAY_NAMES[engineType] || engineType;
  validation.projectRoot = effectiveRoot;
  validation.availableEngines = detected.availableEngines;
  validation.isMultiEngine = detected.isMultiEngine;

  return validation;
}

/**
 * Đọc cấu hình thông số của dự án theo Engine
 * @param {string} projectDir
 * @param {string} [specifiedEngine=null]
 * @returns {object}
 */
export function getEngineConfig(projectDir, specifiedEngine = null) {
  const detected = detectEngine(projectDir, { manualEngine: specifiedEngine });
  const engineType = (specifiedEngine && specifiedEngine !== "auto") ? specifiedEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  switch (engineType) {
    case ENGINE_TYPES.PYTHON_LONG_FORM:
      return detectPythonProjectConfig(effectiveRoot);

    case ENGINE_TYPES.THANH_HAI:
      return detectThanhHaiConfig(effectiveRoot);

    case ENGINE_TYPES.REMOTION:
    default:
      return detectProjectConfig(effectiveRoot);
  }
}

/**
 * Tạo bản xem trước (Preview) theo engine
 * @param {string} projectDir
 * @param {string} engineType
 * @param {object} [options]
 * @returns {Promise<object>}
 */
export async function previewEngine(projectDir, engineType, options = {}) {
  const detected = detectEngine(projectDir, { manualEngine: engineType });
  const finalEngine = (engineType && engineType !== "auto") ? engineType : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  if (finalEngine === ENGINE_TYPES.PYTHON_LONG_FORM) {
    return await renderPythonPreview(effectiveRoot, options);
  }

  if (finalEngine === ENGINE_TYPES.THANH_HAI) {
    if (options.contactSheet) {
      const res = await renderThanhHaiContactSheet(effectiveRoot);
      return { type: "image", url: res.url, filePath: res.sheetPath };
    }
    const frame = Number(options.frame) || 0;
    const res = await renderThanhHaiStill(effectiveRoot, frame);
    return { type: "image", url: res.url, filePath: res.stillPath };
  }

  // Remotion Preview
  return { type: "remotion", message: "Remotion Preview sẵn sàng." };
}

/**
 * Điều phối Render Video thành phẩm theo đúng engine tương ứng
 * @param {object} params
 * @returns {Promise<object>}
 */
export async function renderEngineVideo({
  projectDir,
  engineType = "auto",
  compositionId = null,
  outputPath,
  isTest = false,
  customResolution = null,
  customFps = null,
  accelerationMode = "auto",
  concurrency = 4,
  onProgress = null,
  checkCanceled = null
}) {
  const detected = detectEngine(projectDir, { manualEngine: engineType });
  const finalEngine = (engineType && engineType !== "auto") ? engineType : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  if (finalEngine === ENGINE_TYPES.PYTHON_LONG_FORM) {
    return await renderPythonVideo({
      projectDir: effectiveRoot,
      outputPath,
      isTest,
      customResolution,
      onProgress,
      checkCanceled
    });
  }

  if (finalEngine === ENGINE_TYPES.THANH_HAI) {
    return await renderThanhHaiVideo({
      projectDir: effectiveRoot,
      outputPath,
      isTest,
      scale: customResolution === "720p" ? 0.75 : 1.0,
      onProgress,
      checkCanceled
    });
  }

  // Remotion Dynamic Render
  const config = detectProjectConfig(effectiveRoot);
  const fps = customFps ? parseInt(customFps, 10) : (config.fps || 30);
  const totalFrames = config.durationInFrames || 300;
  const frameRange = isTest ? [0, Math.min(5 * fps - 1, totalFrames - 1)] : null;

  return await renderDynamicVideo({
    projectDir: effectiveRoot,
    config,
    compositionId,
    outputPath,
    accelerationMode,
    concurrency,
    frameRange,
    checkCanceled,
    onProgress
  });
}

