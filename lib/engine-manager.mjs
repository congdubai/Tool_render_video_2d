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
  ENGINE_ALIASES,
  normalizeEngineType,
  detectEngine,
  detectPythonProjectConfig,
  loadProjectMetadata,
  saveProjectMetadata
} from "./engine-detector.mjs";
import { validateProject, detectProjectConfig, listProjectFiles } from "./project-loader.mjs";
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

export { ENGINE_TYPES, ENGINE_DISPLAY_NAMES, ENGINE_ALIASES, normalizeEngineType, detectEngine };

/**
 * Thẩm định dự án theo đúng Engine tương ứng
 * (Tuyệt đối không ép dự án Python hoặc Chưa xác định sang chuẩn Remotion)
 * @param {string} projectDir Đường dẫn dự án
 * @param {string} [specifiedEngine=null] Engine cụ thể do người dùng chọn (hoặc auto)
 * @returns {object}
 */
export function validateEngine(projectDir, specifiedEngine = null) {
  const normEngine = normalizeEngineType(specifiedEngine);
  const detected = detectEngine(projectDir, { manualEngine: normEngine });
  const engineType = (normEngine && normEngine !== "auto") ? normEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  // Nếu không nhận diện được engine hoặc engine là unknown, trả về thông báo lỗi rõ ràng, KHÔNG mặc định Remotion
  if (engineType === ENGINE_TYPES.UNKNOWN) {
    return {
      valid: false,
      engine: ENGINE_TYPES.UNKNOWN,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.UNKNOWN],
      projectRoot: effectiveRoot,
      config: null,
      files: listProjectFiles(effectiveRoot),
      assets: { found: [], missing: [] },
      dependencies: { allowed: [], unknown: [] },
      errors: detected.validationErrors && detected.validationErrors.length > 0 ? detected.validationErrors : [
        "Không thể xác định loại Engine của dự án. Dự án cần có cấu trúc của một trong các chuẩn:\n" +
        "• Remotion: Thư mục src/ chứa index.ts / Root.tsx hoặc file video.config.json.\n" +
        "• Python 2D Long Form: File story.json (storyboard), script.txt và mã nguồn engine.\n" +
        "• Thanh Hai 2D Studio: File config.json kèm thư mục scenes/ hoặc story/shots.json."
      ],
      warnings: detected.warnings || [],
      availableEngines: detected.availableEngines || [],
      isMultiEngine: false
    };
  }

  let validation = null;

  switch (engineType) {
    case ENGINE_TYPES.PYTHON_LONG_FORM:
      validation = validatePythonProject(effectiveRoot);
      break;

    case ENGINE_TYPES.THANH_HAI:
      validation = validateThanhHaiProject(effectiveRoot);
      break;

    case ENGINE_TYPES.REMOTION:
      validation = validateProject(effectiveRoot);
      break;

    default:
      validation = {
        valid: false,
        engine: engineType,
        engineName: ENGINE_DISPLAY_NAMES[engineType] || engineType,
        projectRoot: effectiveRoot,
        errors: [`Engine không được hỗ trợ để thẩm định: "${engineType}".`],
        warnings: []
      };
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
  const normEngine = normalizeEngineType(specifiedEngine);
  const detected = detectEngine(projectDir, { manualEngine: normEngine });
  const engineType = (normEngine && normEngine !== "auto") ? normEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  switch (engineType) {
    case ENGINE_TYPES.PYTHON_LONG_FORM:
      return detectPythonProjectConfig(effectiveRoot);

    case ENGINE_TYPES.THANH_HAI:
      return detectThanhHaiConfig(effectiveRoot);

    case ENGINE_TYPES.REMOTION:
      return detectProjectConfig(effectiveRoot);

    default:
      return {
        projectName: path.basename(effectiveRoot),
        engine: engineType || ENGINE_TYPES.UNKNOWN,
        engineName: ENGINE_DISPLAY_NAMES[engineType] || "Chưa xác định Engine"
      };
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
  const normEngine = normalizeEngineType(engineType);
  const detected = detectEngine(projectDir, { manualEngine: normEngine });
  const finalEngine = (normEngine && normEngine !== "auto") ? normEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  if (finalEngine === ENGINE_TYPES.PYTHON_LONG_FORM) {
    return await renderPythonPreview(effectiveRoot, options);
  }

  if (finalEngine === ENGINE_TYPES.THANH_HAI) {
    if (options.contactSheet) {
      const res = await renderThanhHaiContactSheet({
        projectDir: effectiveRoot,
        characterRenderer: options.characterRenderer
      });
      return { type: "image", url: res.url, filePath: res.sheetPath };
    }
    const frame = Number(options.frame) || 0;
    const res = await renderThanhHaiStill({
      projectDir: effectiveRoot,
      frame,
      characterRenderer: options.characterRenderer
    });
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
  characterRenderer = "original",
  onProgress = null,
  checkCanceled = null
}) {
  const normEngine = normalizeEngineType(engineType);
  const detected = detectEngine(projectDir, { manualEngine: normEngine });
  const finalEngine = (normEngine && normEngine !== "auto") ? normEngine : detected.engineType;
  const effectiveRoot = detected.projectRoot || path.resolve(projectDir);

  if (finalEngine === ENGINE_TYPES.UNKNOWN) {
    throw new Error(
      "Không thể render: Dự án chưa được xác định loại Engine hợp lệ (Remotion, Python 2D Long Form hoặc Thanh Hai 2D Studio). Vui lòng kiểm tra lại cấu trúc file dự án hoặc chọn Engine thủ công."
    );
  }

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
      characterRenderer,
      onProgress,
      checkCanceled
    });
  }

  if (finalEngine === ENGINE_TYPES.REMOTION) {
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

  throw new Error(`Loại engine không được hỗ trợ để render: "${finalEngine}".`);
}

