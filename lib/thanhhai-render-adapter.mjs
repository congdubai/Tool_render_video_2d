/**
 * Thanh Hai Learn AI 2D Studio Engine Adapter
 * Tích hợp engine vẽ Canvas/Three.js + Playwright + FFmpeg vào Tab 3 AI Code Render
 * Nhận diện thông minh cấu trúc dự án Thanh Hai 2D Studio (kể cả khi nén lồng thư mục)
 */

import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { listProjectFiles } from "./project-loader.mjs";

const KIT_ROOT = path.resolve(process.cwd(), "thanhhai-2d-studio");
const PYTHON_PATH = "D:\\Python311\\python.exe";

/**
 * Tìm kiếm đệ quy thư mục gốc thực sự của project Thanh Hai 2D Studio
 * Hỗ trợ các kiểu đóng gói ZIP:
 * 1. Nén trực tiếp các file: targetDir/config.json, targetDir/scenes
 * 2. Nén cả thư mục: targetDir/<folder>/config.json, targetDir/<folder>/scenes
 * 3. Nén cả bộ studio: targetDir/thanhhai-2d-studio/examples/reaction-time
 * 4. Nén plugin: targetDir/skills/make-2d-video/kit/examples/reaction-time
 * @param {string} dir Thư mục bắt đầu tìm kiếm
 * @param {number} [depth=0] Độ sâu đệ quy tối đa
 * @returns {string | null} Đường dẫn thư mục project thực tế hoặc null nếu không phải
 */
export function findThanhHaiProjectRoot(dir, depth = 0) {
  if (!dir || !fs.existsSync(dir) || depth > 5) return null;

  // 1. Kiểm tra ngay tại thư mục hiện tại
  const hasConfig = fs.existsSync(path.join(dir, "config.json"));
  const hasShots =
    fs.existsSync(path.join(dir, "story/shots.json")) ||
    fs.existsSync(path.join(dir, "story")) ||
    fs.existsSync(path.join(dir, "shots.json"));
  const hasScenes = fs.existsSync(path.join(dir, "scenes"));

  if (hasConfig && (hasShots || hasScenes)) {
    return path.resolve(dir);
  }

  // 2. ƯU TIÊN HÀNG ĐẦU: Tìm trong thư mục "projects" của người dùng (projects/cinematic-character-v1...)
  const projectParentDirs = [
    path.join(dir, "projects"),
    path.join(dir, "thanhhai-2d-studio/projects"),
    path.join(dir, "skills/make-2d-video/kit/projects")
  ];

  for (const parent of projectParentDirs) {
    if (fs.existsSync(parent)) {
      try {
        const subs = fs.readdirSync(parent, { withFileTypes: true });
        for (const s of subs) {
          if (s.isDirectory() && s.name !== "build" && s.name !== "out") {
            const pPath = path.join(parent, s.name);
            if (
              fs.existsSync(path.join(pPath, "config.json")) &&
              (fs.existsSync(path.join(pPath, "scenes")) || fs.existsSync(path.join(pPath, "story")))
            ) {
              return path.resolve(pPath);
            }
          }
        }
      } catch (e) {}
    }
  }

  // 3. Quét các thư mục con khác (nhưng BỎ QUA thư mục "examples" để không chọn nhầm mẫu demo)
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (
        ent.isDirectory() &&
        ent.name !== "node_modules" &&
        ent.name !== ".git" &&
        ent.name !== "__MACOSX" &&
        ent.name !== "build" &&
        ent.name !== "out" &&
        ent.name !== "examples" // Bỏ qua examples trong lượt tìm dự án người dùng
      ) {
        const found = findThanhHaiProjectRoot(path.join(dir, ent.name), depth + 1);
        if (found) return found;
      }
    }
  } catch (e) {}

  // 4. Fallback cuối cùng: Nếu không có dự án người dùng, mới lấy mẫu demo trong examples
  const candidateSubs = [
    "thanhhai-2d-studio/examples/reaction-time",
    "skills/make-2d-video/kit/examples/reaction-time",
    "examples/reaction-time",
    "reaction-time"
  ];
  for (const sub of candidateSubs) {
    const subP = path.join(dir, sub);
    if (
      fs.existsSync(path.join(subP, "config.json")) &&
      (fs.existsSync(path.join(subP, "scenes")) || fs.existsSync(path.join(subP, "story/shots.json")))
    ) {
      return path.resolve(subP);
    }
  }

  return null;
}

/**
 * Nhận diện xem dự án có phải là Thanh Hai 2D Studio Project không
 * @param {string} projectDir
 * @returns {boolean}
 */
export function isThanhHaiProject(projectDir) {
  return findThanhHaiProjectRoot(projectDir) !== null;
}

/**
 * Lấy thư mục gốc thực tế của dự án Thanh Hai 2D Studio
 * @param {string} projectDir
 * @returns {string}
 */
export function getThanhHaiProjectDir(projectDir) {
  return findThanhHaiProjectRoot(projectDir) || path.resolve(projectDir);
}

/**
 * Đọc cấu hình chi tiết của dự án Thanh Hai 2D Studio
 * @param {string} projectDir
 */
export function detectThanhHaiConfig(projectDir) {
  const effectiveDir = getThanhHaiProjectDir(projectDir);

  let cfg = {
    title: path.basename(effectiveDir),
    lang: "vi",
    aspect: "16:9",
    resolution: "1080p",
    fps: 24,
    style: "dusk",
    voiceover: null,
    script: null,
    duration: 0
  };

  const configPath = path.join(effectiveDir, "config.json");
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      cfg = { ...cfg, ...parsed };
    } catch (e) {}
  }

  const shotsPath = path.join(effectiveDir, "story/shots.json");
  let shots = [];
  let totalDur = 0;
  if (fs.existsSync(shotsPath)) {
    try {
      const parsedShots = JSON.parse(fs.readFileSync(shotsPath, "utf-8"));
      shots = parsedShots.shots || [];
      totalDur = parsedShots.duration || (shots.length > 0 ? shots[shots.length - 1].end : 0);
    } catch (e) {}
  }

  cfg.duration = totalDur || cfg.duration || 10;
  cfg.durationInFrames = Math.max(1, Math.round(cfg.duration * (cfg.fps || 24)));

  // Tính width / height theo aspect và resolution
  let width = 1920;
  let height = 1080;
  const isVertical = cfg.aspect === "9:16";

  if (cfg.resolution === "720p") {
    width = isVertical ? 720 : 1280;
    height = isVertical ? 1280 : 720;
  } else if (cfg.resolution === "1440p") {
    width = isVertical ? 1440 : 2560;
    height = isVertical ? 2560 : 1440;
  } else if (cfg.resolution === "2160p" || cfg.resolution === "4k") {
    width = isVertical ? 2160 : 3840;
    height = isVertical ? 3840 : 2160;
  } else {
    // 1080p
    width = isVertical ? 1080 : 1920;
    height = isVertical ? 1920 : 1080;
  }

  return {
    projectName: cfg.title || path.basename(effectiveDir),
    engine: "thanhhai-2d-studio",
    engineName: "Thanh Hai Learn AI 2D Studio (Canvas + Three.js)",
    aspect: cfg.aspect,
    resolution: cfg.resolution,
    width,
    height,
    fps: cfg.fps || 24,
    duration: cfg.duration,
    durationInFrames: cfg.durationInFrames,
    style: cfg.style,
    shotsCount: shots.length,
    shots,
    voiceover: cfg.voiceover,
    hasVoiceover: Boolean(cfg.voiceover && fs.existsSync(path.join(effectiveDir, cfg.voiceover))),
    configSource: "config.json",
    effectiveDir
  };
}

/**
 * Thẩm định dự án Thanh Hai 2D Studio theo đúng cấu trúc thực tế của plugin
 * (KHÔNG yêu cầu src/index.ts hay bất kỳ quy tắc nào của Remotion)
 * @param {string} projectDir
 */
export function validateThanhHaiProject(projectDir) {
  const errors = [];
  const warnings = [];

  const effectiveDir = getThanhHaiProjectDir(projectDir);
  const files = listProjectFiles(effectiveDir);
  const config = detectThanhHaiConfig(effectiveDir);

  // 1. Kiểm tra file config.json
  const configPath = path.join(effectiveDir, "config.json");
  if (!fs.existsSync(configPath)) {
    errors.push("Thiếu file config.json định nghĩa thông số của dự án Thanh Hai 2D Studio.");
  }

  // 2. Kiểm tra file story/shots.json
  const shotsPath = path.join(effectiveDir, "story/shots.json");
  if (!fs.existsSync(shotsPath)) {
    errors.push("Thiếu file story/shots.json định nghĩa danh sách các shots (cảnh quay).");
  }

  // 3. Kiểm tra thư mục scenes/
  const scenesDir = path.join(effectiveDir, "scenes");
  if (!fs.existsSync(scenesDir)) {
    errors.push("Thiếu thư mục scenes/ chứa mã nguồn hoạt hình Canvas/Three.js.");
  }

  // 4. Kiểm tra sự tồn tại của bộ kit engine Thanh Hai trong tool
  const engineFiles = ["engine/core.js", "engine/rig2d.js", "engine/fx2d.js", "engine/three-kit.js", "render.mjs", "player.html"];
  for (const ef of engineFiles) {
    if (!fs.existsSync(path.join(KIT_ROOT, ef))) {
      errors.push(`Thiếu file engine hệ thống trong thanhhai-2d-studio: "${ef}".`);
    }
  }

  // 5. Quét các file shot đã được hiện thực trong scenes/
  const foundShotFiles = new Set();
  function walkScenes(dir) {
    if (!fs.existsSync(dir)) return;
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, item.name);
      if (item.isDirectory()) walkScenes(p);
      else if (item.name.endsWith(".js") && !item.name.startsWith("_")) {
        try {
          const content = fs.readFileSync(p, "utf-8");
          const regMatches = content.matchAll(/registerShot\(\s*['"]([^'"]+)['"]/g);
          for (const m of regMatches) {
            foundShotFiles.add(m[1]);
          }
        } catch (e) {}
      }
    }
  }
  walkScenes(scenesDir);

  const missingShots = [];
  for (const shot of config.shots) {
    if (!foundShotFiles.has(shot.id)) {
      missingShots.push(shot.id);
    }
  }

  if (missingShots.length > 0) {
    warnings.push(
      `Có ${missingShots.length} shot chưa có file scene .js tương ứng trong scenes/: ${missingShots.slice(0, 8).join(", ")}${missingShots.length > 8 ? "..." : ""}`
    );
  }

  if (config.shots.length === 0) {
    errors.push("story/shots.json không chứa bất kỳ shot cảnh nào.");
  }

  if (!config.hasVoiceover) {
    warnings.push("Dự án chưa có file voiceover âm thanh (sẽ xuất video câm hoặc tạo nhạc nền tự động).");
  }

  return {
    valid: errors.length === 0,
    engine: "thanhhai-2d-studio",
    engineName: "Thanh Hai Learn AI 2D Studio (Canvas + Three.js)",
    config,
    files,
    shots: config.shots,
    missingShots,
    effectiveDir,
    assets: {
      found: config.hasVoiceover ? [config.voiceover] : [],
      missing: !config.hasVoiceover && config.voiceover ? [config.voiceover] : []
    },
    dependencies: {
      allowed: [
        "HTML5 Canvas 2D API",
        "Three.js (0.169.0)",
        "Playwright Chromium Headless",
        "FFmpeg Video Encoding",
        "Nunito / Fredoka Fonts",
        "Python 3.11 + SciPy (Audio Pipeline)"
      ],
      unknown: []
    },
    errors,
    warnings
  };
}

/**
 * Chụp 1 frame still tại thời điểm giây `time`
 * Hỗ trợ nhận cả đối tượng params hoặc tham số rời
 * @param {object | string} arg1
 * @param {number} [arg2=1.0]
 * @param {number} [arg3=0.5]
 * @returns {Promise<{ framePath: string, stillPath: string, time: number, url: string }>}
 */
export function renderThanhHaiStill(arg1, arg2, arg3) {
  return new Promise((resolve, reject) => {
    let projectDir, time = 1.0, scale = 0.5, characterRenderer = 'original';
    if (typeof arg1 === 'object' && arg1 !== null) {
      projectDir = arg1.projectDir;
      time = Number(arg1.time ?? arg1.frame ?? 1.0);
      scale = Number(arg1.scale ?? 0.5);
      characterRenderer = arg1.characterRenderer || arg1.character || 'original';
    } else {
      projectDir = arg1;
      time = typeof arg2 === 'number' ? arg2 : 1.0;
      scale = typeof arg3 === 'number' ? arg3 : 0.5;
    }

    const effectiveDir = getThanhHaiProjectDir(projectDir);
    const previewsDir = path.join(process.cwd(), "out/previews");
    fs.mkdirSync(previewsDir, { recursive: true });

    const args = [
      "render.mjs",
      "--project", effectiveDir,
      "--stills", String(time),
      "--scale", String(scale)
    ];
    if (characterRenderer === 'chibi' || characterRenderer === 'chibi_v9') {
      args.push("--character", "chibi");
    } else if (characterRenderer === 'white_cartoon' || characterRenderer === 'white-cartoon' || characterRenderer === 'white-cartoon-2d' || characterRenderer === 'white_cartoon_2d') {
      args.push("--character", "white_cartoon");
    }

    const child = spawn("node", args, {
      cwd: KIT_ROOT,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Lỗi render still frame: ${stderr || stdout}`));
      }

      // Tìm file trong build/stills của effectiveDir
      const stillsDir = path.join(effectiveDir, "build/stills");
      if (fs.existsSync(stillsDir)) {
        const files = fs.readdirSync(stillsDir).filter((f) => f.endsWith(".png") || f.endsWith(".jpeg"));
        if (files.length > 0) {
          const srcStill = path.join(stillsDir, files[0]);
          const destName = `thanhhai_${path.basename(effectiveDir)}_${Math.round(time * 100)}.png`;
          const destPath = path.join(previewsDir, destName);
          fs.copyFileSync(srcStill, destPath);
          return resolve({ framePath: destPath, stillPath: destPath, time, url: `/out/previews/${destName}` });
        }
      }
      reject(new Error("Không tìm thấy file still xuất ra trong build/stills"));
    });
  });
}

/**
 * Render Contact Sheet (Bảng tổng hợp tất cả các cảnh)
 * Hỗ trợ nhận cả đối tượng params hoặc tham số rời
 * @param {object | string} arg1
 * @param {number} [arg2=0.3]
 * @returns {Promise<{ sheetPath: string, url: string }>}
 */
export function renderThanhHaiContactSheet(arg1, arg2) {
  return new Promise((resolve, reject) => {
    let projectDir, scale = 0.3, characterRenderer = 'original';
    if (typeof arg1 === 'object' && arg1 !== null) {
      projectDir = arg1.projectDir;
      scale = Number(arg1.scale ?? 0.3);
      characterRenderer = arg1.characterRenderer || arg1.character || 'original';
    } else {
      projectDir = arg1;
      scale = typeof arg2 === 'number' ? arg2 : 0.3;
    }

    const effectiveDir = getThanhHaiProjectDir(projectDir);
    const previewsDir = path.join(process.cwd(), "out/previews");
    fs.mkdirSync(previewsDir, { recursive: true });

    const args = [
      "render.mjs",
      "--project", effectiveDir,
      "--sheet",
      "--scale", String(scale)
    ];
    if (characterRenderer === 'chibi' || characterRenderer === 'chibi_v9') {
      args.push("--character", "chibi");
    } else if (characterRenderer === 'white_cartoon' || characterRenderer === 'white-cartoon' || characterRenderer === 'white-cartoon-2d' || characterRenderer === 'white_cartoon_2d') {
      args.push("--character", "white_cartoon");
    }

    const child = spawn("node", args, {
      cwd: KIT_ROOT,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d.toString(); });
    child.stderr.on("data", (d) => { stderr += d.toString(); });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Lỗi render contact sheet: ${stderr || stdout}`));
      }

      const sheetsDir = path.join(effectiveDir, "build/sheets");
      if (fs.existsSync(sheetsDir)) {
        const files = fs.readdirSync(sheetsDir).filter((f) => f.startsWith("sheet_") && f.endsWith(".png"));
        if (files.length > 0) {
          const srcSheet = path.join(sheetsDir, files[0]);
          const destName = `sheet_${path.basename(effectiveDir)}.png`;
          const destPath = path.join(previewsDir, destName);
          fs.copyFileSync(srcSheet, destPath);
          return resolve({ sheetPath: destPath, url: `/out/previews/${destName}` });
        }
      }
      reject(new Error("Không tìm thấy file sheet_01.png trong build/sheets"));
    });
  });
}

/**
 * Render Video hoàn chỉnh bằng engine Canvas/Three.js + Playwright + FFmpeg
 * Kèm pipeline tổng hợp âm thanh qua mix.py hoặc FFmpeg mux
 * @param {object} params
 * @param {string} params.projectDir
 * @param {string} params.outputPath
 * @param {boolean} [params.isTest=false]
 * @param {number} [params.scale=1.0]
 * @param {string} [params.characterRenderer='original']
 * @param {(p: { progress: number, renderedFrames: number, totalFrames: number, fps: number, timeRemainingInMilliseconds: number | null }) => void} [params.onProgress]
 * @param {() => boolean} [params.checkCanceled]
 */
export async function renderThanhHaiVideo({
  projectDir,
  outputPath,
  isTest = false,
  scale = 1.0,
  characterRenderer = "original",
  onProgress = null,
  checkCanceled = null
}) {
  const effectiveDir = getThanhHaiProjectDir(projectDir);
  const config = detectThanhHaiConfig(effectiveDir);
  const startTime = Date.now();

  const buildDir = path.join(effectiveDir, "build");
  fs.mkdirSync(buildDir, { recursive: true });

  const silentMp4 = path.join(buildDir, isTest ? "preview.mp4" : "video_silent.mp4");
  const finalOut = outputPath || path.join(process.cwd(), "out", `${path.basename(effectiveDir)}.mp4`);
  fs.mkdirSync(path.dirname(finalOut), { recursive: true });

  // 1. Chuẩn bị đối số render
  const renderArgs = ["render.mjs", "--project", effectiveDir, "--scale", String(scale), "--out", silentMp4];
  if (characterRenderer === "chibi" || characterRenderer === "chibi_v9") {
    renderArgs.push("--character", "chibi");
  } else if (characterRenderer === "white_cartoon" || characterRenderer === "white-cartoon" || characterRenderer === "white-cartoon-2d" || characterRenderer === "white_cartoon_2d") {
    renderArgs.push("--character", "white_cartoon");
  }
  if (isTest) {
    renderArgs.push("--from", "0", "--to", String(Math.min(5, config.duration)));
  }

  // 2. Chạy render.mjs của Thanh Hai Studio
  await new Promise((resolve, reject) => {
    const child = spawn("node", renderArgs, {
      cwd: KIT_ROOT,
      windowsHide: true
    });

    let currentChildPid = child.pid;

    // Lắng nghe lệnh hủy
    const cancelCheckInterval = setInterval(() => {
      if (checkCanceled && checkCanceled()) {
        clearInterval(cancelCheckInterval);
        try {
          if (process.platform === "win32") {
            spawn("taskkill", ["/F", "/PID", String(currentChildPid), "/T"]);
          } else {
            child.kill("SIGKILL");
          }
        } catch (e) {}
        reject(new Error("RENDER_CANCELED_BY_USER"));
      }
    }, 500);

    let outputLog = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      outputLog += text;

      // Phân tích tiến độ: "  48/300 frames  12.50 fps  elapsed 0m04s  eta 0m20s"
      const match = text.match(/(\d+)\/(\d+)\s+frames\s+([\d.]+)\s+fps.*?eta\s+(\w+)/i);
      if (match) {
        const done = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        const fps = parseFloat(match[3]);
        const pct = Math.round((done / total) * 100);
        if (onProgress) {
          onProgress({
            renderedFrames: done,
            totalFrames: total,
            progress: pct / 100,
            fps,
            timeRemainingInMilliseconds: Math.max(0, (total - done) / (fps || 1)) * 1000
          });
        }
      }
    });

    child.stderr.on("data", (chunk) => {
      outputLog += chunk.toString();
    });

    child.on("close", (code) => {
      clearInterval(cancelCheckInterval);
      if (code === 0 && fs.existsSync(silentMp4)) {
        resolve();
      } else {
        reject(new Error(`Render thất bại (mã thoát: ${code}):\n${outputLog.slice(-500)}`));
      }
    });
  });

  // 3. Xử lý âm thanh (Audio Pipeline)
  let hasAudio = false;
  let audioMethod = "none";

  // Thử dùng mix.py nếu có Python 3.11
  const mixScript = path.join(KIT_ROOT, "audio/mix.py");
  if (fs.existsSync(mixScript) && fs.existsSync(PYTHON_PATH)) {
    try {
      console.log("[ThanhHaiAdapter] Chạy pipeline âm thanh mix.py...");
      await new Promise((resMix, rejMix) => {
        const mixChild = spawn(
          PYTHON_PATH,
          [mixScript, "--project", effectiveDir, "--video", silentMp4, "--out", finalOut],
          { cwd: KIT_ROOT, windowsHide: true }
        );
        mixChild.on("close", (code) => {
          if (code === 0 && fs.existsSync(finalOut) && fs.statSync(finalOut).size > 1024) {
            hasAudio = true;
            audioMethod = "algorithmic_mix";
            resMix();
          } else {
            // Không lỗi nghiêm trọng, fallback sang ghép thủ công hoặc video câm
            resMix();
          }
        });
      });
    } catch (e) {
      console.warn("[ThanhHaiAdapter] mix.py warning:", e.message);
    }
  }

  // Nếu mix.py chưa tạo ra finalOut (hoặc không có audio), kiểm tra file voiceover
  if (!fs.existsSync(finalOut) || fs.statSync(finalOut).size < 1024) {
    const voiceoverFile = config.voiceover ? path.join(effectiveDir, config.voiceover) : null;
    if (voiceoverFile && fs.existsSync(voiceoverFile)) {
      // Ghép âm thanh voiceover bằng FFmpeg
      await new Promise((resFf, rejFf) => {
        const ff = spawn(
          "ffmpeg",
          ["-y", "-v", "error", "-i", silentMp4, "-i", voiceoverFile, "-c:v", "copy", "-c:a", "aac", "-shortest", finalOut],
          { windowsHide: true }
        );
        ff.on("close", (c) => {
          if (c === 0 && fs.existsSync(finalOut)) {
            hasAudio = true;
            audioMethod = "voiceover_mux";
            resFf();
          } else {
            rejFf(new Error("FFmpeg mux voiceover thất bại."));
          }
        });
      });
    } else {
      // Video câm (Silent video)
      fs.copyFileSync(silentMp4, finalOut);
      hasAudio = false;
      audioMethod = "silent";
    }
  }

  // 4. Output verification
  if (!fs.existsSync(finalOut) || fs.statSync(finalOut).size < 1024) {
    throw new Error(`File MP4 xuất ra không hợp lệ hoặc bị lỗi: ${finalOut}`);
  }

  const executionTimeSec = Math.round((Date.now() - startTime) / 1000);

  return {
    outputPath: finalOut,
    durationSec: config.duration,
    executionTimeSec,
    hasAudio,
    audioMethod,
    hardwareAccelerated: true,
    engine: "thanhhai-2d-studio"
  };
}
