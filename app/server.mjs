/**
 * Máy chủ Web Local cho ứng dụng dựng video 2D bằng Remotion
 * Lắng nghe DUY NHẤT tại 127.0.0.1, phòng chống triệt để Path Traversal và không bao giờ dùng eval.
 */

import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { detectGpu } from "../lib/gpu.mjs";
import { safeParseJson, isSafePath, validateAllData, extractRequiredAssets } from "../lib/validate.mjs";
import { generateAllVoices } from "../lib/voice.mjs";
import { renderVideo } from "../lib/render.mjs";
import { runBenchmark } from "../scripts/bench.mjs";
import { unzipProjectSafe, detectProjectConfig, listProjectFiles, validateProject } from "../lib/project-loader.mjs";
import { bundleDynamicProject, renderDynamicStill, renderDynamicVideo } from "../lib/dynamic-render.mjs";

const execAsync = promisify(exec);
const app = express();
const projectRoot = process.cwd();
const PORT = process.env.PORT || 3000;
const HOST = "127.0.0.1"; // Tuyệt đối chỉ lắng nghe trên 127.0.0.1

// Middleware phân tích JSON và dữ liệu gửi lên (Hỗ trợ Base64 lớn không bị lỗi PayloadTooLarge)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Phục vụ giao diện tĩnh và tài nguyên an toàn (Chống cache để client luôn nhận bản mới nhất)
app.use(
  express.static(path.join(projectRoot, "app/ui"), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
    }
  })
);
app.use("/public", express.static(path.join(projectRoot, "public")));
app.use("/out", express.static(path.join(projectRoot, "out")));

// Biến lưu trạng thái render hiện tại và cờ hủy
let currentRenderCancellation = false;
let isRendering = false;
let sseClients = [];

/**
 * Gửi thông điệp SSE tới tất cả client đang kết nối
 * @param {string} event
 * @param {object} data
 */
function broadcastSse(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => {
    try {
      res.write(payload);
    } catch (e) {}
  });
}

// ================= API ENDPOINTS =================

/**
 * 1. Khởi tạo trạng thái ứng dụng: GPU info, dữ liệu script, timeline, scenes hiện có
 */
app.get("/api/init", async (req, res) => {
  try {
    const gpuInfo = await detectGpu();

    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");
    const scenesPath = path.join(projectRoot, "src/data/scenes.json");

    let scriptData = null;
    let timelineData = null;
    let scenesData = null;

    if (fs.existsSync(scriptPath)) {
      try { scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8")); } catch (e) {}
    }
    if (fs.existsSync(timelinePath)) {
      try { timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8")); } catch (e) {}
    }
    if (fs.existsSync(scenesPath)) {
      try { scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8")); } catch (e) {}
    }

    // Danh sách ảnh mẫu hoặc ảnh đã có
    const requiredAssets = scenesData ? extractRequiredAssets(scenesData, projectRoot) : [];

    // Kiểm tra các file out có sẵn
    const outFiles = {
      videoMp4: fs.existsSync(path.join(projectRoot, "out/video.mp4")),
      voiceFull: fs.existsSync(path.join(projectRoot, "out/voice_full.mp3")),
      voiceSrt: fs.existsSync(path.join(projectRoot, "out/voice.srt")),
      timelineMd: fs.existsSync(path.join(projectRoot, "out/timeline_for_ai.md"))
    };

    res.json({
      success: true,
      gpuInfo,
      scriptData,
      timelineData,
      scenesData,
      requiredAssets,
      outFiles
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 2. Tách kịch bản lời đọc thành các dòng xem trước
 */
app.post("/api/voice/split", (req, res) => {
  try {
    const { rawText, mode = "lines", maxWords = 25 } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.json({ success: true, lines: [] });
    }

    let parsedLines = [];

    if (mode === "sentences") {
      // Tách theo câu (. ! ?) rồi gom thành đoạn tối đa maxWords từ
      const rawSentences = rawText
        .split(/([.!?…\n]+)/)
        .reduce((acc, part, idx) => {
          if (idx % 2 === 0) {
            if (part.trim()) acc.push(part.trim());
          } else if (acc.length > 0) {
            acc[acc.length - 1] += part.trim();
          }
          return acc;
        }, [])
        .filter(Boolean);

      let currentChunk = [];
      let currentWordCount = 0;

      for (const sentence of rawSentences) {
        const words = sentence.split(/\s+/).filter(Boolean);
        if (currentWordCount + words.length > maxWords && currentChunk.length > 0) {
          parsedLines.push(currentChunk.join(" "));
          currentChunk = [];
          currentWordCount = 0;
        }
        currentChunk.push(sentence);
        currentWordCount += words.length;
      }
      if (currentChunk.length > 0) {
        parsedLines.push(currentChunk.join(" "));
      }
    } else {
      // Mặc định: Mỗi dòng xuống hàng là 1 dòng lời đọc
      parsedLines = rawText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }

    const lines = parsedLines.map((text, idx) => ({
      id: `line_${String(idx + 1).padStart(3, "0")}`,
      narration: text,
      pause: 0.35
    }));

    res.json({ success: true, lines });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 3. Tạo giọng đọc TTS và bảng timeline
 */
app.post("/api/voice/generate", async (req, res) => {
  try {
    const { lines, voice = "vi-VN-HoaiMyNeural", rate = "+0%", pause = 0.35 } = req.body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ success: false, error: "Danh sách dòng lời đọc đang trống." });
    }

    const scriptData = {
      meta: {
        width: 1280,
        height: 720,
        fps: 30,
        music: null,
        musicVolume: 0.08,
        fadeSeconds: 0.3,
        voice: {
          provider: "edge",
          name: voice,
          rate: rate
        }
      },
      lines: lines.map((l, idx) => ({
        id: l.id || `line_${String(idx + 1).padStart(3, "0")}`,
        narration: l.narration.trim(),
        pause: l.pause !== undefined ? Number(l.pause) : pause
      }))
    };

    // Tiến hành tạo giọng đọc
    const { timelineData } = await generateAllVoices({
      scriptData,
      projectRoot,
      onProgress: ({ current, total, lineId, cached }) => {
        broadcastSse("voice_progress", { current, total, lineId, cached });
      }
    });

    res.json({
      success: true,
      scriptData,
      timelineData,
      timelineMd: fs.readFileSync(path.join(projectRoot, "out/timeline_for_ai.md"), "utf-8")
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 4. Kiểm tra dữ liệu scenes.json (an toàn, không eval, báo lỗi chi tiết)
 */
app.post("/api/scenes/validate", (req, res) => {
  try {
    const { scenesText } = req.body;
    const parsed = safeParseJson(scenesText, "scenes.json");
    if (parsed.error) {
      return res.json({
        success: false,
        valid: false,
        syntaxError: parsed.error,
        errors: [parsed.error],
        warnings: [],
        requiredAssets: []
      });
    }

    const scenesData = parsed.data;

    // Đọc script.json và timeline.json hiện tại
    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");

    let scriptData = null;
    let timelineData = null;

    if (fs.existsSync(scriptPath)) {
      try { scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8")); } catch (e) {}
    }
    if (fs.existsSync(timelinePath)) {
      try { timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8")); } catch (e) {}
    }

    const validation = validateAllData({
      scriptData,
      timelineData,
      scenesData,
      projectRoot
    });

    const requiredAssets = extractRequiredAssets(scenesData, projectRoot);

    // Lưu file scenes.json nếu JSON hợp lệ cú pháp
    if (scenesData && Array.isArray(scenesData.scenes)) {
      const scenesPath = path.join(projectRoot, "src/data/scenes.json");
      fs.writeFileSync(scenesPath, JSON.stringify(scenesData, null, 2), "utf-8");
    }

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      requiredAssets,
      scenesData
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Chuẩn hóa tên file: khử dấu tiếng Việt, khoảng trắng và ký tự lạ để lưu file an toàn
 */
function sanitizeFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const nameWithoutExt = path.basename(filename, ext);

  const cleanName = nameWithoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_\-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 45);

  const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
  const uniqueSuffix = Date.now().toString().slice(-4);
  return `${cleanName || "asset"}_${uniqueSuffix}${safeExt}`;
}

/**
 * 5. Tải ảnh lên an toàn và lưu vào folder public/ máy tính
 */
app.post("/api/assets/upload", (req, res) => {
  try {
    const { filename, base64Data, type, overwrite = true } = req.body;

    if (!filename || !base64Data) {
      return res.status(400).json({ success: false, error: "Thiếu tên file hoặc dữ liệu ảnh." });
    }

    const safeFilename = sanitizeFilename(filename);
    const subDir = type === "character" ? "characters" : "backgrounds";
    const targetDir = path.join(projectRoot, "public", subDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetPath = path.join(targetDir, safeFilename);

    // Gỡ bỏ header data:image/png;base64,... nếu có
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(targetPath, Buffer.from(cleanBase64, "base64"));

    res.json({
      success: true,
      path: `${subDir}/${safeFilename}`,
      message: `Đã lưu ảnh vào: public/${subDir}/${safeFilename}`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 6. Kênh Server-Sent Events (SSE) theo dõi tiến độ render thời gian thực
 */
app.get("/api/render/progress", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: connected\ndata: {}\n\n");

  sseClients.push(res);
  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

/**
 * 7. Lấy danh sách toàn bộ video đã dựng (Thư viện Video)
 */
app.get("/api/videos", (req, res) => {
  try {
    const outDir = path.join(projectRoot, "out");
    if (!fs.existsSync(outDir)) {
      return res.json({ success: true, videos: [] });
    }

    const files = fs.readdirSync(outDir);
    const videos = files
      .filter((file) => file.toLowerCase().endsWith(".mp4"))
      .map((file) => {
        const fullPath = path.join(outDir, file);
        const stats = fs.statSync(fullPath);
        const baseName = path.parse(file).name;
        const metaPath = path.join(projectRoot, "out/metadata", `${baseName}.json`);

        let metadata = null;
        if (fs.existsSync(metaPath)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
          } catch (e) {}
        }

        return {
          filename: file,
          url: `/out/${file}?t=${stats.mtimeMs}`,
          sizeBytes: stats.size,
          sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
          createdAt: stats.mtime,
          formattedTime: new Date(stats.mtime).toLocaleString("vi-VN"),
          hasMetadata: Boolean(metadata),
          title: metadata?.title || file
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, videos });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Xóa video khỏi danh sách và ổ đĩa
 */
app.post("/api/videos/delete", (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: "Thiếu tên file video cần xóa." });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(projectRoot, "out", safeFilename);
    const baseName = path.parse(safeFilename).name;
    const metaPath = path.join(projectRoot, "out/metadata", `${baseName}.json`);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }

    res.json({ success: true, message: `Đã xóa video ${safeFilename}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 9. Bắt đầu Render video (Hỗ trợ đặt tên, lưu metadata để gen lại và sinh hàng loạt)
 */
app.post("/api/render/start", async (req, res) => {
  if (isRendering) {
    return res.status(400).json({ success: false, error: "Một tiến trình dựng video khác đang chạy. Vui lòng đợi hoặc bấm dừng." });
  }

  try {
    const {
      isTest = false,
      accelerationMode = "cpu",
      concurrency = null,
      videoName = null,
      customScriptData = null,
      customTimelineData = null,
      customScenesData = null
    } = req.body;

    let scriptData = customScriptData;
    let timelineData = customTimelineData;
    let scenesData = customScenesData;

    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");
    const scenesPath = path.join(projectRoot, "src/data/scenes.json");

    if (!scriptData && fs.existsSync(scriptPath)) {
      try { scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8")); } catch (e) {}
    }
    if (!timelineData && fs.existsSync(timelinePath)) {
      try { timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8")); } catch (e) {}
    }
    if (!scenesData && fs.existsSync(scenesPath)) {
      try { scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8")); } catch (e) {}
    }

    if (!timelineData || !scenesData) {
      return res.status(400).json({
        success: false,
        error: "Thiếu dữ liệu dựng video (timeline.json hoặc scenes.json)."
      });
    }

    // Tự động tạo tên video độc nhất nếu không chỉ định
    let safeVideoName = "";
    if (videoName && videoName.trim()) {
      safeVideoName = path.basename(videoName.trim());
      if (!safeVideoName.toLowerCase().endsWith(".mp4")) {
        safeVideoName += ".mp4";
      }
    } else {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      safeVideoName = `video_${timeStr}.mp4`;
    }

    const finalOutputPath = path.join(projectRoot, "out", safeVideoName);
    const baseName = path.parse(safeVideoName).name;
    const metadataDir = path.join(projectRoot, "out/metadata");
    fs.mkdirSync(metadataDir, { recursive: true });

    // Lưu snapshot metadata để hỗ trợ tính năng "Gen lại"
    const metaPath = path.join(metadataDir, `${baseName}.json`);
    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          videoName: safeVideoName,
          title: safeVideoName,
          accelerationMode,
          concurrency,
          scriptData,
          timelineData,
          scenesData,
          createdAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    const fps = scriptData.meta?.fps || 30;
    const totalFrames = Math.max(1, Math.round(timelineData.totalSeconds * fps));
    const frameRange = isTest ? [0, Math.min(10 * fps - 1, totalFrames - 1)] : null;

    isRendering = true;
    currentRenderCancellation = false;

    // Trả về response ngay để client theo dõi qua SSE
    res.json({
      success: true,
      videoName: safeVideoName,
      message: `Bắt đầu dựng ${safeVideoName}...`
    });

    // Chạy render ở tiến trình nền
    (async () => {
      try {
        const renderResult = await renderVideo({
          scriptData,
          timelineData,
          scenesData,
          outputPath: finalOutputPath,
          projectRoot,
          accelerationMode,
          frameRange,
          concurrency,
          forceRebundle: true,
          checkCanceled: () => currentRenderCancellation,
          onProgress: (p) => {
            const pct = Math.round(p.progress * 100);
            broadcastSse("render_progress", {
              videoName: safeVideoName,
              progress: pct,
              renderedFrames: p.renderedFrames,
              totalFrames: p.totalFrames,
              timeRemainingMs: p.timeRemainingInMilliseconds
            });
          }
        });

        // Copy thêm bản out/video.mp4 cho tương thích cũ
        try {
          fs.copyFileSync(finalOutputPath, path.join(projectRoot, "out/video.mp4"));
        } catch (e) {}

        broadcastSse("render_complete", {
          success: true,
          videoName: safeVideoName,
          videoUrl: `/out/${safeVideoName}?t=${Date.now()}`,
          executionTimeSec: renderResult.executionTimeSec,
          fallbackUsed: renderResult.fallbackUsed,
          fallbackReason: renderResult.fallbackReason
        });
      } catch (err) {
        broadcastSse("render_error", {
          videoName: safeVideoName,
          error: err.message
        });
      } finally {
        isRendering = false;
        currentRenderCancellation = false;
      }
    })();
  } catch (err) {
    isRendering = false;
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Trích xuất và điều chỉnh dữ liệu để render riêng 1 cảnh thành 1 video độc lập
 */
export function createSingleSceneData(sceneIndex, scriptData, timelineData, scenesData) {
  const scene = scenesData.scenes[sceneIndex];
  if (!scene) throw new Error(`Không tìm thấy cảnh số ${sceneIndex + 1}`);

  const sceneStart = Number(scene.start) || 0;
  const sceneEnd = Number(scene.end) || 5;
  const duration = Math.max(0.5, sceneEnd - sceneStart);

  // 1. Cảnh con: đặt mốc thời gian từ 0 đến duration
  const singleScene = {
    ...scene,
    start: 0,
    end: duration
  };

  // 2. Lấy dòng lời đọc tương ứng
  let matchingLines = [];
  if (scene.line) {
    matchingLines = (timelineData.lines || []).filter((l) => l.id === scene.line);
  }
  if (matchingLines.length === 0) {
    matchingLines = (timelineData.lines || []).filter(
      (l) => l.start >= sceneStart - 0.1 && l.end <= sceneEnd + 0.1
    );
  }
  if (matchingLines.length === 0 && timelineData.lines && timelineData.lines[sceneIndex]) {
    matchingLines = [timelineData.lines[sceneIndex]];
  }

  // Điều chỉnh mốc thời gian âm thanh và phụ đề về gốc 0
  const shiftedLines = matchingLines.map((line) => {
    const lineStart = Math.max(0, line.start - sceneStart);
    const lineEnd = Math.max(lineStart + 0.2, line.end - sceneStart);
    const shiftedWords = (line.words || []).map((w) => ({
      ...w,
      start: Math.max(0, w.start - sceneStart),
      end: Math.max(0, w.end - sceneStart)
    }));

    return {
      ...line,
      start: lineStart,
      end: lineEnd,
      voiceEnd: line.voiceEnd ? Math.max(lineStart, line.voiceEnd - sceneStart) : undefined,
      words: shiftedWords
    };
  });

  const singleTimeline = {
    totalSeconds: duration,
    lines: shiftedLines
  };

  const lineIds = new Set(shiftedLines.map((l) => l.id));
  const singleScript = {
    meta: scriptData.meta,
    lines: (scriptData.lines || []).filter((l) => lineIds.has(l.id))
  };

  return {
    singleSceneData: { scenes: [singleScene] },
    singleTimelineData: singleTimeline,
    singleScriptData: singleScript,
    duration
  };
}

/**
 * 10. Render riêng 1 cảnh cụ thể thành 1 video độc lập
 */
app.post("/api/render/scene", async (req, res) => {
  if (isRendering) {
    return res.status(400).json({ success: false, error: "Một tiến trình dựng video khác đang chạy. Vui lòng đợi hoặc bấm dừng." });
  }

  try {
    const { sceneIndex = 0, isTest = false, accelerationMode = "cpu", concurrency = null, customVideoName = null } = req.body;

    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");
    const scenesPath = path.join(projectRoot, "src/data/scenes.json");

    if (!fs.existsSync(timelinePath) || !fs.existsSync(scenesPath)) {
      return res.status(400).json({ success: false, error: "Thiếu dữ liệu kịch bản." });
    }

    const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    const timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
    const scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));

    if (!scenesData.scenes || !scenesData.scenes[sceneIndex]) {
      return res.status(400).json({ success: false, error: `Không tìm thấy cảnh số ${sceneIndex + 1}.` });
    }

    const { singleSceneData, singleTimelineData, singleScriptData } = createSingleSceneData(
      sceneIndex,
      scriptData,
      timelineData,
      scenesData
    );

    const sceneObj = scenesData.scenes[sceneIndex];
    const sceneId = sceneObj.id || `scene_${String(sceneIndex + 1).padStart(3, "0")}`;

    let videoName = customVideoName;
    if (!videoName) {
      videoName = isTest ? `video_test_${sceneId}.mp4` : `video_${sceneId}.mp4`;
    }
    if (!videoName.toLowerCase().endsWith(".mp4")) {
      videoName += ".mp4";
    }

    // Chuyển sang endpoint render/start với kịch bản con của cảnh này
    req.body.videoName = videoName;
    req.body.customScriptData = singleScriptData;
    req.body.customTimelineData = singleTimelineData;
    req.body.customScenesData = singleSceneData;
    req.body.isTest = false;

    return app._router.handle(
      {
        ...req,
        url: "/api/render/start",
        method: "POST"
      },
      res
    );
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 11. Gen lại (Dựng lại) video đã có dựa trên metadata snapshot
 */
app.post("/api/videos/regenerate", (req, res) => {
  try {
    const { filename, accelerationMode = "cpu", concurrency = null } = req.body;
    if (!filename) {
      return res.status(400).json({ success: false, error: "Thiếu tên file video cần gen lại." });
    }

    const safeFilename = path.basename(filename);
    const baseName = path.parse(safeFilename).name;
    const metaPath = path.join(projectRoot, "out/metadata", `${baseName}.json`);

    let scriptData = null;
    let timelineData = null;
    let scenesData = null;

    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        scriptData = meta.scriptData;
        timelineData = meta.timelineData;
        scenesData = meta.scenesData;
      } catch (e) {}
    }

    if (!timelineData || !scenesData) {
      const scriptPath = path.join(projectRoot, "src/data/script.json");
      const timelinePath = path.join(projectRoot, "src/data/timeline.json");
      const scenesPath = path.join(projectRoot, "src/data/scenes.json");
      if (fs.existsSync(scriptPath)) scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
      if (fs.existsSync(timelinePath)) timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
      if (fs.existsSync(scenesPath)) scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));
    }

    if (!timelineData || !scenesData) {
      return res.status(400).json({ success: false, error: "Không tìm thấy dữ liệu kịch bản để gen lại video này." });
    }

    // Gán dữ liệu vào body và gọi logic render
    req.body.videoName = safeFilename;
    req.body.customScriptData = scriptData;
    req.body.customTimelineData = timelineData;
    req.body.customScenesData = scenesData;
    req.body.isTest = false;

    // Chuyển quyền xử lý sang endpoint render
    return app._router.handle(
      {
        ...req,
        url: "/api/render/start",
        method: "POST"
      },
      res
    );
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 8. Hủy render
 */
app.post("/api/render/cancel", (req, res) => {
  if (isRendering) {
    currentRenderCancellation = true;
    isRendering = false;
    broadcastSse("render_canceled", { message: "Đã hủy dựng video theo yêu cầu." });
    return res.json({ success: true, message: "Đã gửi lệnh hủy." });
  }
  res.json({ success: true, message: "Không có tiến trình render nào đang chạy." });
});

/**
 * 9. Đo tốc độ (Benchmark 5s)
 */
app.post("/api/render/bench", async (req, res) => {
  try {
    const benchData = await runBenchmark(projectRoot);
    res.json({ success: true, ...benchData });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 10. Mở thư mục out/ hoặc thư mục public assets trên File Explorer
 */
app.post("/api/open-folder", async (req, res) => {
  try {
    const { type = "out" } = req.body || {};
    let targetDir = path.join(projectRoot, "out");
    if (type === "backgrounds") targetDir = path.join(projectRoot, "public/backgrounds");
    if (type === "characters") targetDir = path.join(projectRoot, "public/characters");
    if (type === "public") targetDir = path.join(projectRoot, "public");

    fs.mkdirSync(targetDir, { recursive: true });

    if (process.platform === "win32") {
      await execAsync(`explorer.exe "${targetDir}"`);
    } else if (process.platform === "darwin") {
      await execAsync(`open "${targetDir}"`);
    } else {
      await execAsync(`xdg-open "${targetDir}"`);
    }
    res.json({ success: true, message: `Đã mở thư mục ${type}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * =========================================================================
 * TAB 3 API: AI CODE RENDER (DYNAMIC REMOTION ENGINE)
 * =========================================================================
 */

/**
 * 12. Lấy danh sách các project Remotion AI (cả imported và sample demo)
 */
app.get("/api/ai-code/projects", (req, res) => {
  try {
    const importedDir = path.join(projectRoot, "imported_projects");
    const sampleDir = path.join(projectRoot, "sample-projects");
    fs.mkdirSync(importedDir, { recursive: true });

    const projects = [];

    // Quét sample demo
    if (fs.existsSync(sampleDir)) {
      const sampleEntries = fs.readdirSync(sampleDir, { withFileTypes: true });
      for (const ent of sampleEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(sampleDir, ent.name);
          const config = detectProjectConfig(pDir);
          projects.push({
            id: `sample_${ent.name}`,
            name: config.projectName || ent.name,
            folderName: ent.name,
            type: "sample",
            isDemo: true,
            path: pDir,
            config
          });
        }
      }
    }

    // Quét imported projects
    if (fs.existsSync(importedDir)) {
      const importedEntries = fs.readdirSync(importedDir, { withFileTypes: true });
      for (const ent of importedEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(importedDir, ent.name);
          const config = detectProjectConfig(pDir);
          const stats = fs.statSync(pDir);
          projects.push({
            id: ent.name,
            name: config.projectName || ent.name,
            folderName: ent.name,
            type: "imported",
            isDemo: false,
            createdAt: stats.mtime,
            path: pDir,
            config
          });
        }
      }
    }

    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 13. Tải lên và giải nén file ZIP dự án Remotion AI (Bảo mật chống Zip Slip)
 */
app.post("/api/ai-code/upload-zip", (req, res) => {
  try {
    const { zipBase64, filename = "project.zip" } = req.body;
    if (!zipBase64) {
      return res.status(400).json({ success: false, error: "Thiếu dữ liệu file ZIP (zipBase64)." });
    }

    const zipBuffer = Buffer.from(zipBase64, "base64");
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const baseSlug = path.parse(filename).name.replace(/[^a-zA-Z0-9_-]/g, "_") || "project";
    const projectId = `${baseSlug}_${timeStr}`;

    const targetDir = path.join(projectRoot, "imported_projects", projectId);

    // Giải nén an toàn với cơ chế bảo mật cao
    const extractResult = unzipProjectSafe(zipBuffer, targetDir);

    // Thẩm định ngay sau khi giải nén
    const validation = validateProject(targetDir);

    res.json({
      success: true,
      projectId,
      targetDir,
      extractedCount: extractResult.extractedFiles.length,
      validation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 14. Thẩm định dự án Remotion AI (Validate Project)
 */
app.post("/api/ai-code/validate", (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: `Không tìm thấy dự án tại: ${targetDir}` });
    }

    const validation = validateProject(targetDir);
    res.json({ success: true, projectId, validation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 15. Chụp và xem trước Frame bất kỳ từ dự án (Frame Inspector / Preview Frame)
 */
app.post("/api/ai-code/preview-frame", async (req, res) => {
  try {
    const { projectId, frame = 0 } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const config = detectProjectConfig(targetDir);
    const stillResult = await renderDynamicStill({
      projectDir: targetDir,
      config,
      frame: Number(frame)
    });

    const relPath = path.relative(path.join(projectRoot, "out"), stillResult.framePath).replace(/\\/g, "/");

    res.json({
      success: true,
      frameUrl: `/out/${relPath}?t=${Date.now()}`,
      frame: stillResult.frame,
      width: stillResult.width,
      height: stillResult.height
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 16. Render video hoàn chỉnh từ dự án Remotion AI
 */
app.post("/api/ai-code/render", async (req, res) => {
  if (isRendering) {
    return res.status(400).json({
      success: false,
      error: "Một tiến trình dựng video khác đang chạy. Vui lòng đợi hoặc bấm dừng."
    });
  }

  try {
    const {
      projectId,
      accelerationMode = "cpu",
      concurrency = null,
      isTest = false,
      customVideoName = null,
      customResolution = null,
      customFps = null
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const config = detectProjectConfig(targetDir);
    if (customResolution) {
      if (customResolution === "1080p") { config.width = 1920; config.height = 1080; }
      else if (customResolution === "720p") { config.width = 1280; config.height = 720; }
      else if (customResolution === "4k") { config.width = 3840; config.height = 2160; }
    }
    if (customFps) {
      config.fps = Number(customFps);
    }

    // Đặt tên video
    let safeVideoName = "";
    if (customVideoName && customVideoName.trim()) {
      safeVideoName = path.basename(customVideoName.trim());
      if (!safeVideoName.toLowerCase().endsWith(".mp4")) {
        safeVideoName += ".mp4";
      }
    } else {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      safeVideoName = `${config.compositionId || "ai_video"}_${timeStr}.mp4`;
    }

    const finalOutputPath = path.join(projectRoot, "out", safeVideoName);
    const baseName = path.parse(safeVideoName).name;

    // Lưu metadata snapshot để hỗ trợ Thư viện Video
    const metadataDir = path.join(projectRoot, "out/metadata");
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.writeFileSync(
      path.join(metadataDir, `${baseName}.json`),
      JSON.stringify(
        {
          videoName: safeVideoName,
          title: `[AI Code] ${config.projectName || safeVideoName}`,
          projectId,
          accelerationMode,
          concurrency,
          config,
          createdAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    const fps = config.fps || 30;
    const totalFrames = config.durationInFrames || 300;
    const frameRange = isTest ? [0, Math.min(5 * fps - 1, totalFrames - 1)] : null;

    isRendering = true;
    currentRenderCancellation = false;

    // Phản hồi ngay lập tức cho client
    res.json({
      success: true,
      videoName: safeVideoName,
      message: `Bắt đầu dựng dự án "${config.projectName}" thành ${safeVideoName}...`
    });

    // Chạy render ở tiến trình nền
    (async () => {
      try {
        const renderResult = await renderDynamicVideo({
          projectDir: targetDir,
          config,
          outputPath: finalOutputPath,
          accelerationMode,
          concurrency,
          frameRange,
          checkCanceled: () => currentRenderCancellation,
          onProgress: (p) => {
            const pct = Math.round(p.progress * 100);
            broadcastSse("render_progress", {
              videoName: safeVideoName,
              progress: pct,
              renderedFrames: p.renderedFrames,
              totalFrames: p.totalFrames,
              timeRemainingMs: p.timeRemainingInMilliseconds
            });
          }
        });

        isRendering = false;
        broadcastSse("render_done", {
          videoName: safeVideoName,
          outputPath: finalOutputPath,
          videoUrl: `/out/${safeVideoName}?t=${Date.now()}`,
          durationSec: renderResult.durationSec,
          executionTimeSec: renderResult.executionTimeSec,
          hardwareAccelerated: renderResult.hardwareAccelerated,
          fallbackUsed: renderResult.fallbackUsed,
          fallbackReason: renderResult.fallbackReason
        });
      } catch (err) {
        isRendering = false;
        if (err.message === "RENDER_CANCELED_BY_USER") {
          broadcastSse("render_canceled", { message: "Đã hủy dựng video AI theo yêu cầu." });
        } else {
          broadcastSse("render_error", {
            error: err.message,
            stack: err.stack
          });
        }
      }
    })();
  } catch (err) {
    isRendering = false;
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 17. Xóa dự án AI đã import
 */
app.post("/api/ai-code/delete-project", (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId || projectId.startsWith("sample_")) {
      return res.status(400).json({ success: false, error: "Không thể xóa dự án này." });
    }

    const safeId = path.basename(projectId);
    const targetDir = path.join(projectRoot, "imported_projects", safeId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    res.json({ success: true, message: `Đã xóa dự án ${safeId}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Đảm bảo mọi request /api/* không tìm thấy luôn trả về JSON (chống lỗi HTML DOCTYPE)
app.all("/api/*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Đường dẫn API ${req.method} ${req.path} không tồn tại trên máy chủ local.`
  });
});

// Khởi động server với cơ chế tự động thử cổng tiếp theo nếu bị EACCES hoặc EADDRINUSE
function startServer(startPort, maxAttempts = 15) {
  let port = startPort;
  let attempts = 0;

  function tryListen() {
    const server = app.listen(port, HOST, () => {
      const url = `http://${HOST}:${port}`;
      console.log(`\n=====================================================`);
      console.log(`🚀 Máy chủ Local đã sẵn sàng tại: ${url}`);
      console.log(`🔒 Bảo mật: Chỉ lắng nghe cục bộ 127.0.0.1`);
      console.log(`=====================================================\n`);

      // Tự động mở trình duyệt nếu không truyền cờ --no-open
      if (!process.argv.includes("--no-open")) {
        try {
          const openCmd =
            process.platform === "win32"
              ? `start "" "${url}"`
              : process.platform === "darwin"
              ? `open "${url}"`
              : `xdg-open "${url}"`;
          exec(openCmd, () => {});
        } catch (e) {
          console.warn("Không thể tự động mở trình duyệt:", e.message);
        }
      }
    });

    server.on("error", (err) => {
      if ((err.code === "EACCES" || err.code === "EADDRINUSE") && attempts < maxAttempts) {
        console.warn(`⚠️ Cổng ${port} không khả dụng (${err.code}), tự động chuyển sang cổng ${port + 1}...`);
        port++;
        attempts++;
        tryListen();
      } else {
        console.error("❌ Không thể khởi động máy chủ:", err.message);
        process.exit(1);
      }
    });
  }

  tryListen();
}

const initialPort = parseInt(process.env.PORT, 10) || 3001;
startServer(initialPort);

