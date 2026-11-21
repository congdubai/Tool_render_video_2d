/**
 * Module nhận diện Engine thông minh cho Tab 3 AI Code Render (Multi-Engine Detector)
 * Hỗ trợ nhận diện tự động và chính xác 3 loại Engine:
 * 1. Remotion (React, TypeScript, TSX)
 * 2. Thanh Hai 2D Studio (JavaScript Canvas + Three.js + Playwright + FFmpeg)
 * 3. Python 2D Long Form (Python, Skia, Timeline, Storyboard, FFmpeg)
 *
 * Tuyệt đối không tự ý thực thi mã nguồn trong quá trình nhận diện.
 * Hỗ trợ giải nén lồng thư mục, phân biệt rõ ràng và không phụ thuộc vào tên file ZIP.
 */

import path from "path";
import fs from "fs";
import { findThanhHaiProjectRoot, detectThanhHaiConfig } from "./thanhhai-render-adapter.mjs";
import { detectProjectConfig as detectRemotionConfig } from "./project-loader.mjs";

export const ENGINE_TYPES = {
  REMOTION: "remotion",
  THANH_HAI: "thanhhai-2d-studio",
  PYTHON_LONG_FORM: "python-2d-long-form",
  UNKNOWN: "unknown"
};

export const ENGINE_ALIASES = {
  "python-longform": ENGINE_TYPES.PYTHON_LONG_FORM,
  "python_longform": ENGINE_TYPES.PYTHON_LONG_FORM,
  "python-2d-long-form": ENGINE_TYPES.PYTHON_LONG_FORM,
  "python_2d_long_form": ENGINE_TYPES.PYTHON_LONG_FORM,
  "python": ENGINE_TYPES.PYTHON_LONG_FORM,
  "python2d": ENGINE_TYPES.PYTHON_LONG_FORM,
  "thanhhai": ENGINE_TYPES.THANH_HAI,
  "thanhhai_2d": ENGINE_TYPES.THANH_HAI,
  "thanhhai-2d-studio": ENGINE_TYPES.THANH_HAI,
  "thanhhai_2d_studio": ENGINE_TYPES.THANH_HAI,
  "remotion": ENGINE_TYPES.REMOTION,
  "remotion-2d": ENGINE_TYPES.REMOTION,
  "remotion_2d": ENGINE_TYPES.REMOTION,
  "unknown": ENGINE_TYPES.UNKNOWN
};

/**
 * Chuẩn hóa chuỗi engine từ người dùng hoặc metadata về chuẩn nội bộ
 * @param {string} raw
 * @returns {string|null}
 */
export function normalizeEngineType(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "auto") return "auto";
  return ENGINE_ALIASES[s] || s;
}

export const ENGINE_DISPLAY_NAMES = {
  [ENGINE_TYPES.REMOTION]: "Remotion 2D Engine (React / TypeScript)",
  [ENGINE_TYPES.THANH_HAI]: "Thanh Hai 2D Studio (Canvas + Three.js)",
  [ENGINE_TYPES.PYTHON_LONG_FORM]: "Python 2D Long Form (Python / Skia / FFmpeg)",
  [ENGINE_TYPES.UNKNOWN]: "Chưa xác định Engine"
};

const METADATA_FILENAME = ".project-metadata.json";

/**
 * Đọc metadata định danh engine được lưu trong thư mục dự án
 * @param {string} projectDir
 * @returns {object|null}
 */
export function loadProjectMetadata(projectDir) {
  try {
    const metaPath = path.join(projectDir, METADATA_FILENAME);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    }
  } catch (e) {}
  return null;
}

/**
 * Lưu metadata định danh engine vào thư mục dự án
 * @param {string} projectDir
 * @param {object} metadata
 * @returns {object|null}
 */
export function saveProjectMetadata(projectDir, metadata) {
  try {
    if (!fs.existsSync(projectDir)) return null;
    const metaPath = path.join(projectDir, METADATA_FILENAME);
    const existing = loadProjectMetadata(projectDir) || {};
    const merged = {
      ...existing,
      ...metadata,
      updatedAt: new Date().toISOString()
    };
    if (!merged.createdAt) {
      merged.createdAt = new Date().toISOString();
    }
    fs.writeFileSync(metaPath, JSON.stringify(merged, null, 2), "utf-8");
    return merged;
  } catch (e) {
    return null;
  }
}

const DEFAULT_PYTHON_KIT = path.resolve(process.cwd(), "python-2d-long-form");

/**
 * Tìm kiếm đệ quy thư mục gốc dự án Python 2D Long Form
 * @param {string} dir Thư mục bắt đầu
 * @param {number} [depth=0]
 * @returns {{ projectDir: string, engineDir: string, storyPath: string | null } | null}
 */
export function findPythonLongFormProject(dir, depth = 0) {
  if (!dir || !fs.existsSync(dir) || depth > 5) return null;

  // 1. Kiểm tra nếu thư mục hiện tại có story.json
  const currentStory = path.join(dir, "story.json");
  if (fs.existsSync(currentStory)) {
    let engineDir = DEFAULT_PYTHON_KIT;
    if (fs.existsSync(path.join(dir, "engine/render.py")) || fs.existsSync(path.join(dir, "render.py"))) {
      engineDir = dir;
    } else if (fs.existsSync(path.join(path.dirname(dir), "engine/render.py"))) {
      engineDir = path.dirname(dir);
    }
    return { projectDir: path.resolve(dir), engineDir: path.resolve(engineDir), storyPath: currentStory };
  }

  // 2. Tìm kiếm ưu tiên trong projects/ và examples/
  const candidateParentDirs = [
    path.join(dir, "projects"),
    path.join(dir, "examples"),
    path.join(dir, "2d-long-form/projects"),
    path.join(dir, "2d-long-form/examples"),
    path.join(dir, "python-2d-long-form/projects"),
    path.join(dir, "python-2d-long-form/examples")
  ];

  for (const parent of candidateParentDirs) {
    if (fs.existsSync(parent)) {
      try {
        const subs = fs.readdirSync(parent, { withFileTypes: true });
        for (const s of subs) {
          if (s.isDirectory() && s.name !== "build" && s.name !== "out" && s.name !== "work") {
            const pPath = path.join(parent, s.name);
            const subStory = path.join(pPath, "story.json");
            if (fs.existsSync(subStory)) {
              let engDir = DEFAULT_PYTHON_KIT;
              if (fs.existsSync(path.join(dir, "engine/render.py"))) engDir = dir;
              else if (fs.existsSync(path.join(pPath, "engine/render.py"))) engDir = pPath;
              else if (fs.existsSync(path.join(path.dirname(pPath), "engine/render.py"))) engDir = path.dirname(pPath);
              return { projectDir: path.resolve(pPath), engineDir: path.resolve(engDir), storyPath: subStory };
            }
          }
        }
      } catch (e) {}
    }
  }

  // 3. Quét đệ quy tất cả các thư mục con khác tìm story.json (bao gồm cả thư mục bọc lồng)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (
        ent.isDirectory() &&
        ent.name !== ".git" &&
        ent.name !== "__MACOSX" &&
        ent.name !== "node_modules" &&
        ent.name !== "build" &&
        ent.name !== "work" &&
        ent.name !== "out" &&
        ent.name !== "dist" &&
        ent.name !== "engine" &&
        ent.name !== "__pycache__"
      ) {
        const found = findPythonLongFormProject(path.join(dir, ent.name), depth + 1);
        if (found) return found;
      }
    }
  } catch (e) {}

  // 4. Fallback nhận diện theo file engine Python cốt lõi:
  // Nếu thư mục có engine/render.py, engine/kit.py, engine/__main__.py hoặc render.py
  // thì xác định ĐÂY LÀ DỰ ÁN PYTHON LONG FORM (dù chưa có story.json ở root hoặc đang thiếu story.json)
  const hasEngineFiles =
    fs.existsSync(path.join(dir, "engine/render.py")) ||
    fs.existsSync(path.join(dir, "engine/kit.py")) ||
    fs.existsSync(path.join(dir, "engine/__main__.py")) ||
    fs.existsSync(path.join(dir, "render.py"));

  if (hasEngineFiles) {
    const engineDir = fs.existsSync(path.join(dir, "engine/render.py")) ? dir : (fs.existsSync(path.join(dir, "render.py")) ? path.dirname(dir) : DEFAULT_PYTHON_KIT);
    return {
      projectDir: path.resolve(dir),
      engineDir: path.resolve(engineDir),
      storyPath: null
    };
  }

  return null;
}

/**
 * Tìm kiếm thư mục Remotion Project
 * @param {string} dir
 * @param {number} [depth=0]
 * @returns {string | null}
 */
export function findRemotionProject(dir, depth = 0) {
  if (!dir || !fs.existsSync(dir) || depth > 4) return null;

  // 1. Kiểm tra các dấu hiệu đặc trưng của Remotion
  const hasRemotionConfig =
    fs.existsSync(path.join(dir, "remotion.config.ts")) ||
    fs.existsSync(path.join(dir, "remotion.config.js")) ||
    fs.existsSync(path.join(dir, "video.config.json"));

  const hasRemotionSource =
    fs.existsSync(path.join(dir, "src/Root.tsx")) ||
    fs.existsSync(path.join(dir, "src/index.ts")) ||
    fs.existsSync(path.join(dir, "src/index.tsx")) ||
    fs.existsSync(path.join(dir, "src/Video.tsx"));

  if (hasRemotionConfig || hasRemotionSource) {
    return path.resolve(dir);
  }

  // 2. Kiểm tra package.json xem có remotion không
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (allDeps["remotion"] || allDeps["@remotion/renderer"] || allDeps["@remotion/cli"]) {
        return path.resolve(dir);
      }
    } catch (e) {}
  }

  // 3. Quét thư mục con cấp 1 (tránh node_modules, out, dist, .git)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (
        ent.isDirectory() &&
        ent.name !== ".git" &&
        ent.name !== "__MACOSX" &&
        ent.name !== "node_modules" &&
        ent.name !== "out" &&
        ent.name !== "build" &&
        ent.name !== "dist" &&
        ent.name !== "thanhhai-2d-studio" &&
        ent.name !== "python-2d-long-form"
      ) {
        const found = findRemotionProject(path.join(dir, ent.name), depth + 1);
        if (found) return found;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Đọc cấu hình tóm tắt của dự án Python 2D Long Form
 * @param {string} projectDir Thư mục chứa story.json
 * @returns {object}
 */
export function detectPythonProjectConfig(projectDir) {
  const storyPath = path.join(projectDir, "story.json");
  const scriptPath = path.join(projectDir, "script.txt");
  const timingPath = path.join(projectDir, "timing.json");
  const langPath = path.join(projectDir, "lang.txt");

  let story = { title: path.basename(projectDir), shots: [], cast: {} };
  if (fs.existsSync(storyPath)) {
    try {
      story = JSON.parse(fs.readFileSync(storyPath, "utf-8"));
    } catch (e) {}
  }

  let duration = 0;
  let hasVoice = false;
  let voiceFile = null;

  // Kiểm tra file âm thanh
  try {
    const files = fs.readdirSync(projectDir);
    for (const f of files) {
      if (f.toLowerCase().startsWith("voice.") || f.toLowerCase().startsWith("voiceover.")) {
        hasVoice = true;
        voiceFile = f;
        break;
      }
    }
  } catch (e) {}

  // Lấy thời lượng từ timing.json nếu có
  if (fs.existsSync(timingPath)) {
    try {
      const timing = JSON.parse(fs.readFileSync(timingPath, "utf-8"));
      duration = timing.duration || 0;
    } catch (e) {}
  }

  // Hoặc ước tính thời lượng từ script.txt
  let wordCount = 0;
  let sentenceCount = 0;
  if (fs.existsSync(scriptPath)) {
    try {
      const scriptText = fs.readFileSync(scriptPath, "utf-8");
      const lines = scriptText.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      sentenceCount = lines.length;
      wordCount = lines.join(" ").split(/\s+/).filter(Boolean).length;
      if (!duration) {
        // Tốc độ chuẩn: ~150 từ/phút (2.5 từ/giây)
        duration = Math.max(10, Math.round(wordCount / 2.5));
      }
    } catch (e) {}
  }

  if (!duration) {
    duration = (story.shots && story.shots.length ? story.shots.length * 4.5 : 30);
  }

  const fps = 30; // Python 2D Long Form mặc định 30 FPS
  const durationInFrames = Math.round(duration * fps);

  let lang = "en";
  if (fs.existsSync(langPath)) {
    try {
      lang = fs.readFileSync(langPath, "utf-8").trim().toLowerCase() || "en";
    } catch (e) {}
  }

  return {
    projectName: story.title || path.basename(projectDir),
    engine: ENGINE_TYPES.PYTHON_LONG_FORM,
    engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.PYTHON_LONG_FORM],
    aspect: "16:9",
    resolution: "1080p",
    width: 1920,
    height: 1080,
    fps,
    duration: Math.round(duration * 10) / 10,
    durationInFrames,
    shotsCount: (story.shots || []).length,
    shots: story.shots || [],
    castCount: Object.keys(story.cast || {}).length,
    mood: story.mood || "mystery",
    lang,
    hasVoice,
    voiceFile,
    hasScript: fs.existsSync(scriptPath),
    hasTiming: fs.existsSync(timingPath),
    sentenceCount,
    wordCount,
    configSource: "story.json",
    effectiveDir: projectDir
  };
}

/**
 * Nhận diện toàn diện Engine của dự án (Multi-Engine Detection)
 * @param {string} targetDir Thư mục dự án đã giải nén
 * @param {object} [options]
 * @param {string} [options.manualEngine] Người dùng chủ động chọn engine ghi đè
 * @returns {{
 *   engineType: string,
 *   engineName: string,
 *   projectRoot: string,
 *   entryPoint: string,
 *   projectName: string,
 *   config: object,
 *   validationErrors: string[],
 *   warnings: string[],
 *   availableEngines: string[],
 *   isMultiEngine: boolean
 * }}
 */
export function detectEngine(targetDir, options = {}) {
  const normalizedDir = path.resolve(targetDir);
  const detectedEngines = [];
  const warnings = [];
  const validationErrors = [];

  // Chuẩn hóa manualEngine nếu người dùng truyền vào
  const manualEngine = normalizeEngineType(options.manualEngine);

  // Đọc metadata đã lưu trước đó (nếu có) để duy trì tính nhất quán khi reload
  const savedMeta = loadProjectMetadata(normalizedDir);
  const savedEngine = savedMeta ? normalizeEngineType(savedMeta.engineType || savedMeta.engine) : null;

  // 1. Kiểm tra dấu hiệu Python 2D Long Form
  const pyMatch = findPythonLongFormProject(normalizedDir);
  if (pyMatch) {
    detectedEngines.push({
      type: ENGINE_TYPES.PYTHON_LONG_FORM,
      root: pyMatch.projectDir,
      engineDir: pyMatch.engineDir,
      entryPoint: "engine/__main__.py"
    });
  }

  // 2. Kiểm tra dấu hiệu Thanh Hai 2D Studio
  const thMatch = findThanhHaiProjectRoot(normalizedDir);
  if (thMatch) {
    detectedEngines.push({
      type: ENGINE_TYPES.THANH_HAI,
      root: thMatch,
      entryPoint: "render.mjs"
    });
  }

  // 3. Kiểm tra dấu hiệu Remotion
  const rmMatch = findRemotionProject(normalizedDir);
  if (rmMatch) {
    detectedEngines.push({
      type: ENGINE_TYPES.REMOTION,
      root: rmMatch,
      entryPoint: "src/index.ts"
    });
  }

  // Xác định engine được chọn:
  let selected = null;
  if (manualEngine && manualEngine !== "auto") {
    // 1. Người dùng chỉ định thủ công
    selected = detectedEngines.find(e => e.type === manualEngine) || {
      type: manualEngine,
      root: normalizedDir,
      entryPoint: manualEngine === ENGINE_TYPES.PYTHON_LONG_FORM ? "engine/__main__.py" : manualEngine === ENGINE_TYPES.THANH_HAI ? "render.mjs" : "src/index.ts"
    };
  } else if (savedEngine && savedEngine !== ENGINE_TYPES.UNKNOWN) {
    // 2. Tái sử dụng engine đã lưu trong metadata (kể cả khi reload hoặc thư mục đang chuẩn bị)
    selected = detectedEngines.find(e => e.type === savedEngine) || {
      type: savedEngine,
      root: normalizedDir,
      entryPoint: savedEngine === ENGINE_TYPES.PYTHON_LONG_FORM ? "engine/__main__.py" : savedEngine === ENGINE_TYPES.THANH_HAI ? "render.mjs" : "src/index.ts"
    };
  } else {
    // 3. Tự động nhận diện theo thứ tự ưu tiên
    selected = detectedEngines[0] || null;
  }

  const isMultiEngine = detectedEngines.length > 1;
  if (isMultiEngine && (!options.manualEngine || options.manualEngine === "auto")) {
    warnings.push(`Dự án có dấu hiệu của nhiều Engine (${detectedEngines.map(e => ENGINE_DISPLAY_NAMES[e.type] || e.type).join(", ")}). Hệ thống tự động chọn "${ENGINE_DISPLAY_NAMES[selected.type]}".`);
  }

  if (!selected) {
    return {
      engineType: ENGINE_TYPES.UNKNOWN,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.UNKNOWN],
      projectRoot: normalizedDir,
      entryPoint: "unknown",
      projectName: path.basename(normalizedDir),
      config: null,
      validationErrors: [
        "Không nhận diện được Engine phù hợp. Dự án cần có cấu trúc của một trong ba Engine:\n" +
        "1. Remotion: Thư mục src/ chứa index.ts / Root.tsx hoặc file video.config.json.\n" +
        "2. Python 2D Long Form: File story.json (storyboard), script.txt và mã nguồn engine.\n" +
        "3. Thanh Hai 2D Studio: File config.json kèm thư mục scenes/ hoặc story/shots.json."
      ],
      warnings,
      availableEngines: [],
      isMultiEngine: false
    };
  }

  // Trích xuất cấu hình chi tiết theo engine được chọn
  let config = null;
  let projectName = path.basename(selected.root);

  if (selected.type === ENGINE_TYPES.PYTHON_LONG_FORM) {
    config = detectPythonProjectConfig(selected.root);
    projectName = config.projectName || projectName;
  } else if (selected.type === ENGINE_TYPES.THANH_HAI) {
    config = detectThanhHaiConfig(selected.root);
    projectName = config.projectName || projectName;
  } else if (selected.type === ENGINE_TYPES.REMOTION) {
    config = detectRemotionConfig(selected.root);
    projectName = config.projectName || projectName;
    if (config?.isStickmanV2) {
      selected.engineName = "Remotion 2D Engine (Stickman Rig V2)";
    }
  }

  // Lưu lại metadata đã nhận diện để duy trì nhất quán
  saveProjectMetadata(normalizedDir, {
    engineType: selected.type,
    engineName: selected.engineName || ENGINE_DISPLAY_NAMES[selected.type] || selected.type,
    effectiveRoot: selected.root,
    entryPoint: selected.entryPoint
  });

  return {
    engineType: selected.type,
    engineName: selected.engineName || ENGINE_DISPLAY_NAMES[selected.type] || selected.type,
    projectRoot: selected.root,
    entryPoint: selected.entryPoint,
    projectName,
    config,
    validationErrors,
    warnings,
    availableEngines: detectedEngines.map(e => e.type),
    isMultiEngine
  };
}

