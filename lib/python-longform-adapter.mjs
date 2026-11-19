/**
 * Python 2D Long Form Render Adapter
 * Tích hợp engine Python / Skia / FFmpeg vào Tab 3 AI Code Render
 * Quản lý vòng đời: Detect, Validate, Preview (Stills/Short), Full Render, Audio Pipeline, Cancel và Progress SSE.
 */

import path from "path";
import fs from "fs";
import { spawn, execSync } from "child_process";
import { listProjectFiles } from "./project-loader.mjs";
import { findPythonLongFormProject, detectPythonProjectConfig } from "./engine-detector.mjs";

const DEFAULT_PYTHON_KIT = path.resolve(process.cwd(), "python-2d-long-form");

/**
 * Tìm kiếm đường dẫn Python thực thi khả dụng trên Windows
 * Ưu tiên: process.env.PYTHON_PATH -> D:\Python311\python.exe -> venv -> python trong PATH
 * @returns {string}
 */
export function getPythonBinary() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  const cands = [
    "D:\\Python311\\python.exe",
    path.resolve(process.cwd(), "venv/Scripts/python.exe"),
    path.resolve(process.cwd(), ".venv/Scripts/python.exe"),
    "C:\\Python311\\python.exe",
    "C:\\Python310\\python.exe"
  ];

  for (const cand of cands) {
    if (fs.existsSync(cand)) return cand;
  }

  // Fallback to "python" in PATH
  return "python";
}

/**
 * Kiểm tra các dependencies Python (skia, numpy, scipy, soundfile, ffmpeg)
 * @returns {{
 *   ok: boolean,
 *   pythonPath: string,
 *   pythonVersion: string,
 *   skia: boolean,
 *   numpy: boolean,
 *   scipy: boolean,
 *   soundfile: boolean,
 *   ffmpeg: boolean,
 *   missing: string[]
 * }}
 */
export function checkPythonDependencies() {
  const py = getPythonBinary();
  const res = {
    ok: true,
    pythonPath: py,
    pythonVersion: "Unknown",
    skia: false,
    numpy: false,
    scipy: false,
    soundfile: false,
    ffmpeg: false,
    missing: []
  };

  try {
    const ver = execSync(`"${py}" --version`, { encoding: "utf-8", timeout: 5000 }).trim();
    res.pythonVersion = ver;
  } catch (e) {
    res.ok = false;
    res.missing.push(`Không tìm thấy Python runtime tại "${py}".`);
    return res;
  }

  // Kiểm tra từng module một cách an toàn và tương thích 100% trên Windows
  const checkPkg = (pkgName, importName = pkgName) => {
    try {
      execSync(`"${py}" -c "import ${importName}"`, { stdio: "ignore", timeout: 4000 });
      return true;
    } catch (e) {
      res.missing.push(pkgName);
      return false;
    }
  };

  res.skia = checkPkg("skia-python", "skia");
  res.numpy = checkPkg("numpy");
  res.scipy = checkPkg("scipy");
  res.soundfile = checkPkg("soundfile");

  // Kiểm tra ffmpeg
  try {
    execSync("ffmpeg -version", { stdio: "ignore", timeout: 4000 });
    res.ffmpeg = true;
  } catch (e) {
    res.missing.push("ffmpeg (chưa có trong PATH)");
  }

  if (res.missing.length > 0) {
    res.ok = false;
  }

  return res;
}

/**
 * Thẩm định dự án Python 2D Long Form theo đúng chuẩn Skia Engine
 * (Tuyệt đối không yêu cầu src/index.ts hoặc các file Remotion)
 * @param {string} projectDir
 * @returns {object}
 */
export function validatePythonProject(projectDir) {
  const errors = [];
  const warnings = [];

  const found = findPythonLongFormProject(projectDir);
  const effectiveDir = found ? found.projectDir : path.resolve(projectDir);
  const files = listProjectFiles(effectiveDir);
  const config = detectPythonProjectConfig(effectiveDir);

  // 1. Kiểm tra file story.json
  const storyPath = path.join(effectiveDir, "story.json");
  if (!fs.existsSync(storyPath)) {
    errors.push("Thiếu file cấu trúc hoạt hình cốt lõi: 'story.json'. Dự án cần có storyboard.");
  } else {
    try {
      const story = JSON.parse(fs.readFileSync(storyPath, "utf-8"));
      if (!story.shots || !Array.isArray(story.shots) || story.shots.length === 0) {
        errors.push("File story.json không có danh sách các cảnh quay ('shots').");
      }
      if (!story.cast || typeof story.cast !== "object") {
        warnings.push("File story.json chưa khai báo danh sách nhân vật ('cast').");
      }
    } catch (e) {
      errors.push("Lỗi cú pháp trong story.json: " + e.message);
    }
  }

  // 2. Kiểm tra file kịch bản script.txt hoặc timing.json
  const scriptPath = path.join(effectiveDir, "script.txt");
  const timingPath = path.join(effectiveDir, "timing.json");
  if (!fs.existsSync(scriptPath) && !fs.existsSync(timingPath)) {
    errors.push("Dự án cần có file kịch bản 'script.txt' hoặc file thời lượng từng từ 'timing.json'.");
  }

  // 3. Kiểm tra file âm thanh giọng đọc (voice.*)
  if (!config.hasVoice) {
    warnings.push("Chưa tìm thấy file giọng đọc (voice.wav/voice.mp3/voice.m4a). Khi render, hệ thống sẽ tự động tổng hợp giọng đọc AI từ script.txt.");
  }

  // 4. Kiểm tra dependencies hệ thống (Python, Skia, FFmpeg)
  const deps = checkPythonDependencies();
  if (!deps.skia) {
    errors.push("Thiếu thư viện 'skia-python'. Vui lòng cài đặt bằng lệnh: `pip install skia-python`.");
  }
  if (!deps.ffmpeg) {
    errors.push("Hệ thống chưa tìm thấy công cụ 'ffmpeg' trong biến môi trường PATH.");
  }
  if (!deps.numpy || !deps.scipy || !deps.soundfile) {
    warnings.push(`Một số thư viện âm thanh/xử lý số còn thiếu: ${deps.missing.join(", ")}.`);
  }

  // 5. Kiểm tra engine có sẵn (trong project hoặc trong base kit)
  const engineDir = (found && found.engineDir) || DEFAULT_PYTHON_KIT;
  if (!fs.existsSync(path.join(engineDir, "engine/render.py")) && !fs.existsSync(path.join(engineDir, "render.py"))) {
    errors.push("Không tìm thấy bộ engine Python 2D ('engine/render.py').");
  }

  const valid = errors.length === 0;

  return {
    valid,
    engine: "python-2d-long-form",
    engineName: "Python 2D Long Form (Python / Skia / FFmpeg)",
    config,
    files,
    assets: {
      found: config.hasVoice ? [config.voiceFile] : [],
      missing: !config.hasVoice ? ["voice.wav"] : []
    },
    dependencies: {
      allowed: ["skia-python", "numpy", "scipy", "soundfile", "ffmpeg"],
      unknown: deps.missing
    },
    systemDeps: deps,
    errors,
    warnings,
    effectiveDir
  };
}

/**
 * Đảm bảo file giọng đọc voice.wav tồn tại (nếu chưa có thì tự động sinh bằng Edge TTS hoặc âm thanh chuẩn)
 * @param {string} effectiveDir
 * @param {object} config
 */
async function ensureVoiceFile(effectiveDir, config) {
  let hasVoice = false;
  let voiceFile = null;

  try {
    const files = fs.readdirSync(effectiveDir);
    for (const f of files) {
      if (f.toLowerCase().startsWith("voice.") || f.toLowerCase().startsWith("voiceover.")) {
        hasVoice = true;
        voiceFile = path.join(effectiveDir, f);
        break;
      }
    }
  } catch (e) {}

  if (hasVoice && voiceFile) return voiceFile;

  // Nếu chưa có, tạo voice.wav từ script.txt bằng Edge TTS hoặc ffmpeg
  const scriptPath = path.join(effectiveDir, "script.txt");
  const targetVoiceWav = path.join(effectiveDir, "voice.wav");

  let scriptText = "Welcome to the animated video.";
  if (fs.existsSync(scriptPath)) {
    try {
      scriptText = fs.readFileSync(scriptPath, "utf-8").replace(/#/g, "").trim();
    } catch (e) {}
  }

  // Thử gọi synthesizeSingleLine từ lib/voice.mjs nếu có kết nối
  try {
    const { synthesizeSingleLine } = await import("./voice.mjs");
    const lang = config.lang || "en";
    const voiceName = lang === "vi" ? "vi-VN-NamMinhNeural" : "en-US-ChristopherNeural";
    const tempMp3 = path.join(effectiveDir, "voice_temp.mp3");

    await synthesizeSingleLine(scriptText.slice(0, 3000), voiceName, "+0%", tempMp3);
    execSync(`ffmpeg -y -i "${tempMp3}" -ar 16000 -ac 1 "${targetVoiceWav}"`, { stdio: "ignore" });
    if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
    if (fs.existsSync(targetVoiceWav)) return targetVoiceWav;
  } catch (e) {
    // Fallback: Tạo file âm thanh chuẩn dài theo số từ của script
    const dur = Math.max(10, Math.round((config.duration || 30)));
    execSync(`ffmpeg -y -f lavfi -i "sine=frequency=380:duration=${dur}" -ar 16000 -ac 1 "${targetVoiceWav}"`, { stdio: "ignore" });
    return targetVoiceWav;
  }

  return targetVoiceWav;
}

/**
 * Tạo bản xem trước nhanh (Stills contact sheet hoặc video 5s đầu)
 * @param {string} projectDir
 * @param {object} [options]
 * @returns {Promise<{ type: "image" | "video", url: string, filePath: string }>}
 */
export async function renderPythonPreview(projectDir, options = {}) {
  const found = findPythonLongFormProject(projectDir);
  const effectiveDir = found ? found.projectDir : path.resolve(projectDir);
  const engineDir = (found && found.engineDir) || DEFAULT_PYTHON_KIT;
  const config = detectPythonProjectConfig(effectiveDir);
  const py = getPythonBinary();

  // Đảm bảo voice và timing
  await ensureVoiceFile(effectiveDir, config);
  const timingPath = path.join(effectiveDir, "timing.json");
  if (!fs.existsSync(timingPath)) {
    execSync(`"${py}" -m engine align "${effectiveDir}"`, {
      cwd: engineDir,
      stdio: "pipe",
      timeout: 30000
    });
  }

  // Tạo stills contact sheet của 4 shot đầu tiên
  const workDir = path.join(effectiveDir, "work");
  fs.mkdirSync(workDir, { recursive: true });

  execSync(`"${py}" -m engine stills "${effectiveDir}" --shots 0,1,2,3`, {
    cwd: engineDir,
    stdio: "pipe",
    timeout: 30000
  });

  const sheetPath = path.join(workDir, "sheet_1.jpg");
  if (fs.existsSync(sheetPath)) {
    const previewOut = path.join(process.cwd(), "out", `preview_${path.basename(effectiveDir)}.jpg`);
    fs.copyFileSync(sheetPath, previewOut);
    return {
      type: "image",
      url: `/out/${path.basename(previewOut)}?t=${Date.now()}`,
      filePath: previewOut
    };
  }

  throw new Error("Không thể tạo bản xem trước cho dự án Python.");
}

/**
 * Render hoàn chỉnh dự án Python 2D Long Form thành video MP4
 * @param {object} params
 * @param {string} params.projectDir Đường dẫn dự án
 * @param {string} params.outputPath Đường dẫn file MP4 xuất xưởng
 * @param {boolean} [params.isTest=false] Chế độ test 5 giây / 1 shot
 * @param {string} [params.customResolution=null] "720p" hoặc "1080p"
 * @param {function} [params.onProgress] Callback cập nhật tiến độ
 * @param {function} [params.checkCanceled] Hàm kiểm tra trạng thái hủy
 * @returns {Promise<{ success: boolean, outputPath: string, duration: number, frames: number }>}
 */
export async function renderPythonVideo({
  projectDir,
  outputPath,
  isTest = false,
  customResolution = null,
  onProgress = null,
  checkCanceled = null
}) {
  const found = findPythonLongFormProject(projectDir);
  const effectiveDir = found ? found.projectDir : path.resolve(projectDir);
  const engineDir = (found && found.engineDir) || DEFAULT_PYTHON_KIT;
  const config = detectPythonProjectConfig(effectiveDir);
  const py = getPythonBinary();

  const finalOut = outputPath || path.join(process.cwd(), "out", `${path.basename(effectiveDir)}.mp4`);
  fs.mkdirSync(path.dirname(finalOut), { recursive: true });

  const workDir = path.join(effectiveDir, "work");
  fs.mkdirSync(workDir, { recursive: true });

  // 1. Đảm bảo file voice.* tồn tại
  await ensureVoiceFile(effectiveDir, config);

  // 2. Chạy align nếu chưa có timing.json
  const timingPath = path.join(effectiveDir, "timing.json");
  if (!fs.existsSync(timingPath)) {
    if (onProgress) onProgress({ progress: 0.05, renderedFrames: 0, totalFrames: config.durationInFrames, fps: 30, timeRemainingInMilliseconds: 30000 });
    try {
      execSync(`"${py}" -m engine align "${effectiveDir}"`, {
        cwd: engineDir,
        stdio: "pipe",
        timeout: 45000
      });
    } catch (e) {
      console.warn("Cảnh báo align fallback:", e.message);
    }
  }

  // 3. Chuẩn bị đối số render frame
  const is720 = customResolution === "720p";
  const renderArgs = ["-m", "engine", "render", effectiveDir];
  if (is720) renderArgs.push("--res", "720");
  if (isTest) renderArgs.push("--shots", "0"); // Test shot đầu tiên

  // 4. Khởi chạy tiến trình render song song của Skia Engine
  await new Promise((resolve, reject) => {
    const child = spawn(py, renderArgs, {
      cwd: engineDir,
      windowsHide: true
    });

    const currentChildPid = child.pid;

    // Lắng nghe lệnh hủy render
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

      // Phân tích tiến độ: "[3/31] shot 2 rendered 5s | 14/136s of video | ETA 1.2 min"
      const match = text.match(/\[(\d+)\/(\d+)\]\s+shot\s+(\d+).*?\|\s+(\d+)\/(\d+)s.*?ETA\s+([\d.]+)\s+min/i);
      if (match && onProgress) {
        const doneShots = parseInt(match[1], 10);
        const totalShots = parseInt(match[2], 10);
        const doneSecs = parseInt(match[4], 10);
        const totalSecs = parseInt(match[5], 10);
        const etaMin = parseFloat(match[6]);

        const pct = totalSecs > 0 ? doneSecs / totalSecs : doneShots / totalShots;
        onProgress({
          renderedFrames: Math.round(doneSecs * 30),
          totalFrames: Math.round(totalSecs * 30),
          progress: Math.min(0.85, Math.max(0.1, pct * 0.85)),
          fps: 30,
          timeRemainingInMilliseconds: etaMin * 60 * 1000
        });
      }
    });

    child.stderr.on("data", (chunk) => {
      outputLog += chunk.toString();
    });

    child.on("close", (code) => {
      clearInterval(cancelCheckInterval);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Render Python thất bại (mã thoát: ${code}):\n${outputLog.slice(-500)}`));
      }
    });
  });

  // 5. Tổng hợp âm thanh (Music bed + SFX + Ducking mix)
  if (onProgress) onProgress({ progress: 0.9, renderedFrames: config.durationInFrames, totalFrames: config.durationInFrames, fps: 30, timeRemainingInMilliseconds: 5000 });
  try {
    execSync(`"${py}" -m engine audio "${effectiveDir}"`, {
      cwd: engineDir,
      stdio: "pipe",
      timeout: 60000
    });
  } catch (e) {
    console.warn("Cảnh báo tổng hợp audio mix:", e.message);
  }

  // 6. Ghép hoàn chỉnh (Final Muxing) vào finalOut
  if (onProgress) onProgress({ progress: 0.95, renderedFrames: config.durationInFrames, totalFrames: config.durationInFrames, fps: 30, timeRemainingInMilliseconds: 2000 });

  const rawVideoPath = path.join(workDir, "video.mp4");
  const segsDir = path.join(workDir, is720 ? "segs720" : "segs");
  const mixWav = path.join(workDir, "mix.wav");

  let inputVideo = rawVideoPath;
  if (!fs.existsSync(inputVideo)) {
    // Nếu là test hoặc chưa concat, lấy file shot đầu tiên
    const testSeg = path.join(segsDir, "0000.mp4");
    if (fs.existsSync(testSeg)) inputVideo = testSeg;
  }

  if (!fs.existsSync(inputVideo)) {
    throw new Error("Không tìm thấy video đã render từ Skia Engine.");
  }

  // Mux video với âm thanh mix (nếu có)
  if (fs.existsSync(mixWav)) {
    execSync(`ffmpeg -y -i "${inputVideo}" -i "${mixWav}" -c:v copy -c:a aac -b:a 192k -shortest "${finalOut}"`, {
      stdio: "pipe"
    });
  } else {
    fs.copyFileSync(inputVideo, finalOut);
  }

  // 7. Tạo metadata JSON
  const baseName = path.parse(finalOut).name;
  const metaDir = path.join(process.cwd(), "out/metadata");
  fs.mkdirSync(metaDir, { recursive: true });
  const metaPath = path.join(metaDir, `${baseName}.json`);

  fs.writeFileSync(metaPath, JSON.stringify({
    title: config.projectName || baseName,
    engine: "python-2d-long-form",
    engineName: "Python 2D Long Form (Python / Skia / FFmpeg)",
    resolution: is720 ? "1280x720" : "1920x1080",
    fps: 30,
    duration: config.duration,
    shotsCount: config.shotsCount,
    createdAt: new Date().toISOString()
  }, null, 2), "utf-8");

  return {
    success: true,
    outputPath: finalOut,
    duration: config.duration,
    frames: config.durationInFrames
  };
}
