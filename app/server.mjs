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

const execAsync = promisify(exec);
const app = express();
const projectRoot = process.cwd();
const PORT = process.env.PORT || 3000;
const HOST = "127.0.0.1"; // Tuyệt đối chỉ lắng nghe trên 127.0.0.1

// Middleware phân tích JSON và dữ liệu gửi lên
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Phục vụ giao diện tĩnh và tài nguyên an toàn
app.use(express.static(path.join(projectRoot, "app/ui")));
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
 * 5. Kéo thả tải ảnh lên an toàn (chống Path Traversal)
 */
app.post("/api/assets/upload", (req, res) => {
  try {
    const { filename, base64Data, type, overwrite = false } = req.body;

    if (!filename || !base64Data) {
      return res.status(400).json({ success: false, error: "Thiếu tên file hoặc dữ liệu ảnh." });
    }

    // Bảo mật: Sử dụng path.basename() để triệt tiêu mọi ký tự ../ hay \
    const safeFilename = path.basename(filename);
    if (!safeFilename || safeFilename === "." || safeFilename.includes("..")) {
      return res.status(400).json({ success: false, error: "Tên file không an toàn (phát hiện Path Traversal)." });
    }

    const subDir = type === "character" ? "characters" : "backgrounds";
    const targetDir = path.join(projectRoot, "public", subDir);
    fs.mkdirSync(targetDir, { recursive: true });

    const targetPath = path.join(targetDir, safeFilename);

    if (fs.existsSync(targetPath) && !overwrite) {
      return res.json({
        success: false,
        fileExists: true,
        message: `File '${safeFilename}' đã tồn tại trong ${subDir}/. Bạn có muốn ghi đè không?`
      });
    }

    // Gỡ bỏ header data:image/png;base64,... nếu có
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(targetPath, Buffer.from(cleanBase64, "base64"));

    res.json({
      success: true,
      path: `${subDir}/${safeFilename}`,
      message: `Đã tải ảnh lên: public/${subDir}/${safeFilename}`
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
 * 7. Bắt đầu Render video (Toàn bộ hoặc Dựng thử 10s)
 */
app.post("/api/render/start", async (req, res) => {
  if (isRendering) {
    return res.status(400).json({ success: false, error: "Một tiến trình dựng video khác đang chạy." });
  }

  try {
    const { isTest = false, accelerationMode = "cpu", concurrency = null } = req.body;

    const scriptPath = path.join(projectRoot, "src/data/script.json");
    const timelinePath = path.join(projectRoot, "src/data/timeline.json");
    const scenesPath = path.join(projectRoot, "src/data/scenes.json");

    if (!fs.existsSync(timelinePath) || !fs.existsSync(scenesPath)) {
      return res.status(400).json({
        success: false,
        error: "Thiếu dữ liệu dựng video (timeline.json hoặc scenes.json)."
      });
    }

    const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    const timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
    const scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));

    const fps = scriptData.meta?.fps || 30;
    const totalFrames = Math.max(1, Math.round(timelineData.totalSeconds * fps));
    const frameRange = isTest ? [0, Math.min(10 * fps - 1, totalFrames - 1)] : null;

    isRendering = true;
    currentRenderCancellation = false;

    // Trả về response ngay để client theo dõi qua SSE
    res.json({ success: true, message: "Bắt đầu dựng video..." });

    // Chạy render ở tiến trình nền
    (async () => {
      try {
        const renderResult = await renderVideo({
          scriptData,
          timelineData,
          scenesData,
          projectRoot,
          accelerationMode,
          frameRange,
          concurrency,
          forceRebundle: true,
          checkCanceled: () => currentRenderCancellation,
          onProgress: (p) => {
            const pct = Math.round(p.progress * 100);
            broadcastSse("render_progress", {
              progress: pct,
              renderedFrames: p.renderedFrames,
              totalFrames: p.totalFrames,
              timeRemainingMs: p.timeRemainingInMilliseconds
            });
          }
        });

        broadcastSse("render_complete", {
          success: true,
          videoUrl: "/out/video.mp4?t=" + Date.now(),
          executionTimeSec: renderResult.executionTimeSec,
          fallbackUsed: renderResult.fallbackUsed,
          fallbackReason: renderResult.fallbackReason
        });
      } catch (err) {
        broadcastSse("render_error", {
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
 * 10. Mở thư mục out/ trên File Explorer (Windows / macOS)
 */
app.post("/api/open-folder", async (req, res) => {
  try {
    const outDir = path.join(projectRoot, "out");
    fs.mkdirSync(outDir, { recursive: true });

    if (process.platform === "win32") {
      await execAsync(`explorer.exe "${outDir}"`);
    } else if (process.platform === "darwin") {
      await execAsync(`open "${outDir}"`);
    } else {
      await execAsync(`xdg-open "${outDir}"`);
    }
    res.json({ success: true, message: "Đã mở thư mục out/" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
        const openCmd =
          process.platform === "win32"
            ? `start ${url}`
            : process.platform === "darwin"
            ? `open ${url}`
            : `xdg-open ${url}`;
        exec(openCmd, () => {});
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

