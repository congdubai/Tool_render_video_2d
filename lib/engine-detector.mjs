/**
 * Module nhận diện Engine cho Thanh Hai 2D Studio
 * Nhận diện cấu trúc dự án Canvas 2D + Three.js + Playwright + FFmpeg
 */

import path from "path";
import fs from "fs";
import { findThanhHaiProjectRoot, detectThanhHaiConfig } from "./thanhhai-render-adapter.mjs";

export const ENGINE_TYPES = {
  THANH_HAI: "thanhhai-2d-studio",
  UNKNOWN: "unknown"
};

export const ENGINE_ALIASES = {
  "thanhhai": ENGINE_TYPES.THANH_HAI,
  "thanhhai_2d": ENGINE_TYPES.THANH_HAI,
  "thanhhai-2d-studio": ENGINE_TYPES.THANH_HAI,
  "thanhhai_2d_studio": ENGINE_TYPES.THANH_HAI,
  "auto": "auto",
  "unknown": ENGINE_TYPES.UNKNOWN
};

export function normalizeEngineType(raw) {
  if (!raw) return ENGINE_TYPES.THANH_HAI;
  const s = String(raw).trim().toLowerCase();
  if (s === "auto") return ENGINE_TYPES.THANH_HAI;
  return ENGINE_ALIASES[s] || ENGINE_TYPES.THANH_HAI;
}

export const ENGINE_DISPLAY_NAMES = {
  [ENGINE_TYPES.THANH_HAI]: "Thanh Hai 2D Studio (Canvas + Three.js)",
  [ENGINE_TYPES.UNKNOWN]: "Chưa xác định dự án Thanh Hai 2D"
};

const METADATA_FILENAME = ".project-metadata.json";

export function loadProjectMetadata(projectDir) {
  try {
    const metaPath = path.join(projectDir, METADATA_FILENAME);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    }
  } catch {}
  return null;
}

export function saveProjectMetadata(projectDir, metadata) {
  try {
    const metaPath = path.join(projectDir, METADATA_FILENAME);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}

export function detectEngine(projectDir, options = {}) {
  const effectiveRoot = findThanhHaiProjectRoot(projectDir);
  if (effectiveRoot) {
    const config = detectThanhHaiConfig(effectiveRoot);
    return {
      engineType: ENGINE_TYPES.THANH_HAI,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
      confidence: 1.0,
      reasons: ["Phát hiện thư mục dự án chuẩn Thanh Hai 2D Studio"],
      projectRoot: effectiveRoot,
      config
    };
  }

  return {
    engineType: ENGINE_TYPES.THANH_HAI,
    engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
    confidence: 0.5,
    reasons: ["Mặc định Thanh Hai 2D Studio"],
    projectRoot: path.resolve(projectDir),
    config: null
  };
}
