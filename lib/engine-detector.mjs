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

export const ENGINE_DISPLAY_NAMES = {
  [ENGINE_TYPES.REMOTION]: "Remotion 2D Engine (React / TypeScript)",
  [ENGINE_TYPES.THANH_HAI]: "Thanh Hai 2D Studio (Canvas + Three.js)",
  [ENGINE_TYPES.PYTHON_LONG_FORM]: "Python 2D Long Form (Python / Skia / FFmpeg)",
  [ENGINE_TYPES.UNKNOWN]: "Chưa xác định Engine"
};

const DEFAULT_PYTHON_KIT = path.resolve(process.cwd(), "python-2d-long-form");

/**
 * Tìm kiếm đệ quy thư mục gốc dự án Python 2D Long Form
 * @param {string} dir Thư mục bắt đầu
 * @param {number} [depth=0]
 * @returns {{ projectDir: string, engineDir: string, storyPath: string } | null}
 */
export function findPythonLongFormProject(dir, depth = 0) {
  if (!dir || !fs.existsSync(dir) || depth > 5) return null;

  // 1. Kiểm tra nếu thư mục hiện tại có story.json
  const currentStory = path.join(dir, "story.json");
  if (fs.existsSync(currentStory)) {
    // Tìm engineDir (trong thư mục mẹ hoặc kit gốc)
    let engineDir = DEFAULT_PYTHON_KIT;
    if (fs.existsSync(path.join(dir, "engine/render.py")) || fs.existsSync(path.join(dir, "render.py"))) {
      engineDir = dir;
    } else if (fs.existsSync(path.join(path.dirname(dir), "engine/render.py"))) {
      engineDir = path.dirname(dir);
    }
    return { projectDir: path.resolve(dir), engineDir: path.resolve(engineDir), storyPath: currentStory };
  }

  // 2. Ưu tiên hàng đầu: Tìm trong projects/ của người dùng
  const projectParentDirs = [
    path.join(dir, "projects"),
    path.join(dir, "2d-long-form/projects"),
    path.join(dir, "python-2d-long-form/projects")
  ];

  for (const parent of projectParentDirs) {
    if (fs.existsSync(parent)) {
      try {
        const subs = fs.readdirSync(parent, { withFileTypes: true });
        for (const s of subs) {
          if (s.isDirectory() && s.name !== "build" && s.name !== "out" && s.name !== "work") {
            const pPath = path.join(parent, s.name);
            if (fs.existsSync(path.join(pPath, "story.json"))) {
              const engDir = fs.existsSync(path.join(dir, "engine/render.py")) ? dir : DEFAULT_PYTHON_KIT;
              return { projectDir: path.resolve(pPath), engineDir: path.resolve(engDir), storyPath: path.join(pPath, "story.json") };
            }
          }
        }
      } catch (e) {}
    }
  }

  // 3. Quét các thư mục con khác (bỏ qua examples và work/out/build/node_modules)
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
        ent.name !== "examples"
      ) {
        const found = findPythonLongFormProject(path.join(dir, ent.name), depth + 1);
        if (found) return found;
      }
    }
  } catch (e) {}

  // 4. Fallback: Kiểm tra thư mục examples (như examples/marshmallow)
  const candidateExamples = [
    path.join(dir, "examples/marshmallow"),
    path.join(dir, "2d-long-form/examples/marshmallow"),
    path.join(dir, "python-2d-long-form/examples/marshmallow")
  ];
  for (const cand of candidateExamples) {
    if (fs.existsSync(path.join(cand, "story.json"))) {
      const engDir = fs.existsSync(path.join(dir, "engine/render.py")) ? dir : DEFAULT_PYTHON_KIT;
      return { projectDir: path.resolve(cand), engineDir: path.resolve(engDir), storyPath: path.join(cand, "story.json") };
    }
  }

  // 5. Kiểm tra nếu chính thư mục này là bộ kit 2d-long-form (có engine/render.py và examples/)
  if (fs.existsSync(path.join(dir, "engine/render.py")) || fs.existsSync(path.join(dir, "engine/kit.py"))) {
    const defaultEx = path.join(dir, "examples/marshmallow");
    if (fs.existsSync(path.join(defaultEx, "story.json"))) {
      return { projectDir: path.resolve(defaultEx), engineDir: path.resolve(dir), storyPath: path.join(defaultEx, "story.json") };
    }
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
  // Nếu người dùng chủ động chỉ định (options.manualEngine):
  let selected = null;
  if (options.manualEngine && options.manualEngine !== "auto") {
    selected = detectedEngines.find(e => e.type === options.manualEngine);
    if (!selected) {
      // Dù không phát hiện cấu trúc chuẩn, vẫn tôn trọng lựa chọn thủ công của người dùng
      selected = {
        type: options.manualEngine,
        root: normalizedDir,
        entryPoint: options.manualEngine === ENGINE_TYPES.PYTHON_LONG_FORM ? "engine/__main__.py" : options.manualEngine === ENGINE_TYPES.THANH_HAI ? "render.mjs" : "src/index.ts"
      };
    }
  } else {
    // Tự động nhận diện: Ưu tiên Python và Thanh Hai nếu có cấu trúc đặc thù, rồi đến Remotion
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
        "2. Thanh Hai 2D Studio: File config.json kèm thư mục scenes/ hoặc story/shots.json.\n" +
        "3. Python 2D Long Form: File story.json (storyboard), script.txt và mã nguồn engine."
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

