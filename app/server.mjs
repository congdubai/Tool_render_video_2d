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
import { safeParseJson, isSafePath } from "../lib/validate.mjs";
import { generateAllVoices } from "../lib/voice.mjs";
import { unzipProjectSafe, detectProjectConfig, listProjectFiles, validateProject } from "../lib/project-loader.mjs";
import {
  bundleDynamicProject,
  renderDynamicStill,
  renderDynamicVideo,
  getProjectCompositions
} from "../lib/dynamic-render.mjs";
import {
  ENGINE_TYPES,
  ENGINE_DISPLAY_NAMES,
  detectEngine,
  validateEngine,
  getEngineConfig,
  previewEngine,
  renderEngineVideo
} from "../lib/engine-manager.mjs";
import { findPythonLongFormProject, detectPythonProjectConfig } from "../lib/engine-detector.mjs";
import {
  isThanhHaiProject,
  detectThanhHaiConfig,
  validateThanhHaiProject,
  renderThanhHaiStill,
  renderThanhHaiContactSheet,
  renderThanhHaiVideo
} from "../lib/thanhhai-render-adapter.mjs";

const execAsync = promisify(exec);
const app = express();
const projectRoot = process.cwd();

// Tự động nạp cấu hình từ .env nếu có
try {
  const envPath = path.join(projectRoot, ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (e) {}

const PORT = parseInt(process.env.PORT, 10) || 3001;
const HOST = "127.0.0.1"; // Tuyệt đối chỉ lắng nghe trên 127.0.0.1

// Middleware phân tích JSON và dữ liệu gửi lên (Hỗ trợ Base64 lớn không bị lỗi PayloadTooLarge)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Route trang chủ với header cấm cache tuyệt đối để browser không bao giờ cache bản giao diện cũ
app.get("/", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(projectRoot, "app/ui/index.html"));
});

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

    let scriptData = null;
    let timelineData = null;

    if (fs.existsSync(scriptPath)) {
      try { scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8")); } catch (e) {}
    }
    if (fs.existsSync(timelinePath)) {
      try { timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8")); } catch (e) {}
    }

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
        try {
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
            projectId: metadata?.projectId || null,
            engine: metadata?.engine || null,
            engineName: metadata?.engineName || null,
            title: metadata?.title || file
          };
        } catch (e) {
          return null;
        }
      })
      .filter(Boolean)
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
 * 12. Lấy danh sách các project AI (Hỗ trợ Remotion, Thanh Hai 2D Studio và Python 2D Long Form)
 */
app.get("/api/ai-code/projects", (req, res) => {
  try {
    const importedDir = path.join(projectRoot, "imported_projects");
    const sampleDir = path.join(projectRoot, "sample-projects");
    const thanhhaiExamplesDir = path.join(projectRoot, "thanhhai-2d-studio/examples");
    const pythonExamplesDir = path.join(projectRoot, "python-2d-long-form/examples");
    fs.mkdirSync(importedDir, { recursive: true });

    const sampleProjects = [];
    const importedProjects = [];

    // 1. Quét mẫu Python 2D Long Form (marshmallow)
    if (fs.existsSync(pythonExamplesDir)) {
      const pyEntries = fs.readdirSync(pythonExamplesDir, { withFileTypes: true });
      for (const ent of pyEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(pythonExamplesDir, ent.name);
          const pyMatch = findPythonLongFormProject(pDir);
          if (pyMatch) {
            const config = detectPythonProjectConfig(pyMatch.projectDir);
            sampleProjects.push({
              id: `python_${ent.name}`,
              name: `⭐ [MẪU DEMO] ${config.projectName || ent.name} • Python 2D Long Form`,
              folderName: ent.name,
              type: "sample",
              engine: ENGINE_TYPES.PYTHON_LONG_FORM,
              engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.PYTHON_LONG_FORM],
              isDemo: true,
              path: pyMatch.projectDir,
              config
            });
          }
        }
      }
    }

    // 2. Quét mẫu Thanh Hai 2D Studio (reaction-time)
    if (fs.existsSync(thanhhaiExamplesDir)) {
      const thEntries = fs.readdirSync(thanhhaiExamplesDir, { withFileTypes: true });
      for (const ent of thEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(thanhhaiExamplesDir, ent.name);
          if (isThanhHaiProject(pDir)) {
            const config = detectThanhHaiConfig(pDir);
            sampleProjects.push({
              id: `thanhhai_${ent.name}`,
              name: `⭐ [MẪU DEMO] ${ent.name} • Thanh Hai 2D (Canvas/Three.js)`,
              folderName: ent.name,
              type: "sample",
              engine: ENGINE_TYPES.THANH_HAI,
              engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
              isDemo: true,
              path: pDir,
              config
            });
          }
        }
      }
    }

    // 3. Quét mẫu Remotion demo
    if (fs.existsSync(sampleDir)) {
      const sampleEntries = fs.readdirSync(sampleDir, { withFileTypes: true });
      for (const ent of sampleEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(sampleDir, ent.name);
          const config = detectProjectConfig(pDir);
          sampleProjects.push({
            id: `sample_${ent.name}`,
            name: `⭐ [MẪU DEMO] ${config.projectName || ent.name} • Remotion 2D`,
            folderName: ent.name,
            type: "sample",
            engine: ENGINE_TYPES.REMOTION,
            engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.REMOTION],
            isDemo: true,
            path: pDir,
            config
          });
        }
      }
    }

    // 4. Quét imported projects (Tự động nhận diện chính xác engine qua Multi-Engine Detector)
    if (fs.existsSync(importedDir)) {
      const importedEntries = fs.readdirSync(importedDir, { withFileTypes: true });
      for (const ent of importedEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(importedDir, ent.name);
          const stats = fs.statSync(pDir);
          const detected = detectEngine(pDir);

          const engine = detected.engineType;
          const engineName = detected.engineName;
          const config = detected.config;

          // Trích xuất tên file sạch và thời gian import
          const cleanName = ent.name.replace(/_\d{8}_\d{6}$/, "");
          const timeStr = new Date(stats.mtime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
          const dateStr = new Date(stats.mtime).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

          let engTag = "Remotion";
          if (engine === ENGINE_TYPES.THANH_HAI) engTag = "Thanh Hai 2D";
          else if (engine === ENGINE_TYPES.PYTHON_LONG_FORM) engTag = "Python 2D";

          importedProjects.push({
            id: ent.name,
            name: `📦 [DỰ ÁN] ${cleanName} (${timeStr} ${dateStr}) • ${engTag}`,
            rawName: cleanName,
            folderName: ent.name,
            type: "imported",
            engine,
            engineName,
            isDemo: false,
            createdAt: stats.mtime,
            path: detected.projectRoot,
            config
          });
        }
      }
    }

    // Sắp xếp các dự án vừa tải lên: MỚI NHẤT LÊN ĐẦU
    importedProjects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Dự án import lên trước, mẫu demo xuống sau
    const projects = [...importedProjects, ...sampleProjects];

    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 13. Tải lên và giải nén file ZIP dự án (Hỗ trợ Remotion, Thanh Hai Studio & Python Long Form)
 */
app.post("/api/ai-code/upload-zip", async (req, res) => {
  try {
    const { zipBase64, filename = "project.zip", manualEngine = null } = req.body;
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

    // Giải nén an toàn với cơ chế bảo mật cao chống Zip Slip
    const extractResult = unzipProjectSafe(zipBuffer, targetDir);

    // Tự động nhận diện loại dự án qua Multi-Engine Detector
    const detected = detectEngine(targetDir, { manualEngine });
    const validation = validateEngine(targetDir, manualEngine || detected.engineType);

    let actualCompositions = validation.compositions || detected.config?.compositions || [];
    if (detected.engineType === ENGINE_TYPES.REMOTION) {
      try {
        const comps = await getProjectCompositions({ projectDir: targetDir });
        if (comps.length > 0) {
          actualCompositions = comps;
          validation.compositions = comps;
          detected.config = detected.config || {};
          detected.config.compositions = comps;
          const match = comps.find((c) => c.id === detected.config.compositionId);
          detected.config.compositionId = match ? match.id : comps[0].id;

          const vCfgPath = path.join(targetDir, "video.config.json");
          if (fs.existsSync(vCfgPath)) {
            try {
              const cur = JSON.parse(fs.readFileSync(vCfgPath, "utf-8"));
              cur.compositionId = detected.config.compositionId;
              fs.writeFileSync(vCfgPath, JSON.stringify(cur, null, 2), "utf-8");
            } catch (e) {}
          }
        }
      } catch (e) {
        console.warn("Không thể bundle đọc composition khi upload:", e.message);
      }
    }

    res.json({
      success: true,
      projectId,
      projectName: detected.projectName || path.parse(filename).name,
      cleanName: baseSlug,
      targetDir,
      engine: detected.engineType,
      engineName: detected.engineName,
      extractedCount: extractResult.extractedFiles.length,
      compositionId: detected.config?.compositionId,
      compositions: actualCompositions,
      validation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 14. Thẩm định dự án AI Code (Tự động định tuyến theo engine tương ứng)
 */
app.post("/api/ai-code/validate", async (req, res) => {
  try {
    const { projectId, engineOverride = null } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    } else if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("python_")) {
      targetDir = path.join(projectRoot, "python-2d-long-form/examples", projectId.replace("python_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: `Không tìm thấy dự án tại: ${targetDir}` });
    }

    const validation = validateEngine(targetDir, engineOverride);

    let actualCompositions = validation.compositions || validation.config?.compositions || [];
    if (validation.engine === ENGINE_TYPES.REMOTION) {
      try {
        const comps = await getProjectCompositions({ projectDir: targetDir });
        if (comps.length > 0) {
          actualCompositions = comps;
          validation.compositions = comps;
          validation.config = validation.config || {};
          validation.config.compositions = comps;
          const match = comps.find((c) => c.id === validation.config.compositionId);
          validation.config.compositionId = match ? match.id : comps[0].id;
        }
      } catch (e) {
        // Fallback to statically scanned compositions
      }
    }
    validation.compositions = actualCompositions;

    res.json({
      success: true,
      projectId,
      engine: validation.engine,
      engineName: validation.engineName,
      compositionId: validation.config?.compositionId,
      compositions: actualCompositions,
      validation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 15. Chụp và xem trước Frame bất kỳ từ dự án (Hỗ trợ Remotion, Thanh Hai Studio & Python Long Form)
 */
app.post("/api/ai-code/preview-frame", async (req, res) => {
  try {
    const { projectId, frame = 0, engineOverride = null, compositionId = null } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    } else if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("python_")) {
      targetDir = path.join(projectRoot, "python-2d-long-form/examples", projectId.replace("python_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const detected = detectEngine(targetDir, { manualEngine: engineOverride });
    const engine = detected.engineType;

    if (engine === ENGINE_TYPES.PYTHON_LONG_FORM) {
      const previewRes = await previewEngine(targetDir, engine);
      return res.json({
        success: true,
        engine,
        frameUrl: previewRes.url,
        frame: Number(frame),
        width: 1920,
        height: 1080
      });
    }

    if (engine === ENGINE_TYPES.THANH_HAI) {
      const cfg = detectThanhHaiConfig(targetDir);
      const timeInSec = Number(frame) / (cfg.fps || 24);
      const stillResult = await renderThanhHaiStill({
        projectDir: targetDir,
        time: timeInSec,
        scale: 0.5
      });

      const relPath = path.relative(path.join(projectRoot, "out"), stillResult.framePath).replace(/\\/g, "/");
      return res.json({
        success: true,
        engine: "thanhhai_2d",
        frameUrl: `/out/${relPath}?t=${Date.now()}`,
        frame: Number(frame),
        time: stillResult.time,
        width: cfg.width,
        height: cfg.height
      });
    }

    // Remotion still
    const config = detectProjectConfig(targetDir);
    const stillResult = await renderDynamicStill({
      projectDir: targetDir,
      config,
      compositionId,
      frame: Number(frame)
    });

    const relPath = path.relative(path.join(projectRoot, "out"), stillResult.framePath).replace(/\\/g, "/");

    res.json({
      success: true,
      engine: "remotion",
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
 * 15b. Render Contact Sheet cho dự án Thanh Hai Studio hoặc Python Long Form
 */
app.post("/api/ai-code/contact-sheet", async (req, res) => {
  try {
    const { projectId, engineOverride = null } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("python_")) {
      targetDir = path.join(projectRoot, "python-2d-long-form/examples", projectId.replace("python_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: "Dự án không tồn tại." });
    }

    const detected = detectEngine(targetDir, { manualEngine: engineOverride });
    const previewRes = await previewEngine(targetDir, detected.engineType, { contactSheet: true });

    res.json({
      success: true,
      sheetUrl: previewRes.url
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 16. Render video hoàn chỉnh (Hỗ trợ Remotion, Thanh Hai 2D Studio & Python 2D Long Form)
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
      compositionId = null,
      engineOverride = null,
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
    } else if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("python_")) {
      targetDir = path.join(projectRoot, "python-2d-long-form/examples", projectId.replace("python_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const detected = detectEngine(targetDir, { manualEngine: engineOverride });
    const engine = detected.engineType;
    const engineName = detected.engineName;
    const config = detected.config || {};

    if (customResolution) {
      if (customResolution === "1080p") { config.width = 1920; config.height = 1080; }
      else if (customResolution === "720p") { config.width = 1280; config.height = 720; }
      else if (customResolution === "4k") { config.width = 3840; config.height = 2160; }
    }
    if (customFps) {
      config.fps = Number(customFps);
    }

    // Đặt tên video an toàn
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
      let prefix = "remotion";
      if (engine === ENGINE_TYPES.PYTHON_LONG_FORM) prefix = "python_longform";
      else if (engine === ENGINE_TYPES.THANH_HAI) prefix = "thanhhai";

      const rawProjectName = config.projectName || projectId;
      const safeProjectSlug = rawProjectName
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 25)
        .replace(/^_|_$/g, "");

      safeVideoName = safeProjectSlug ? `${prefix}_${safeProjectSlug}_${timeStr}.mp4` : `${prefix}_${timeStr}.mp4`;
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
          title: `[${engineName}] ${config.projectName || safeVideoName}`,
          projectId,
          engine,
          engineName,
          accelerationMode,
          concurrency,
          config,
          createdAt: new Date().toISOString()
        },
        null,
        2
      )
    );

    isRendering = true;
    currentRenderCancellation = false;

    // Phản hồi ngay lập tức cho client
    res.json({
      success: true,
      videoName: safeVideoName,
      engine,
      engineName,
      message: `Bắt đầu dựng dự án "${config.projectName}" (${engineName}) thành ${safeVideoName}...`
    });

    // Chạy render ở tiến trình nền
    (async () => {
      try {
        const renderResult = await renderEngineVideo({
          projectDir: targetDir,
          engineType: engine,
          compositionId,
          outputPath: finalOutputPath,
          isTest,
          customResolution,
          customFps,
          accelerationMode,
          concurrency: concurrency || 4,
          checkCanceled: () => currentRenderCancellation,
          onProgress: (p) => {
            const pct = Math.round(p.progress * 100);
            broadcastSse("render_progress", {
              videoName: safeVideoName,
              progress: pct,
              renderedFrames: p.renderedFrames,
              totalFrames: p.totalFrames,
              fps: p.fps,
              timeRemainingMs: p.timeRemainingMs || p.timeRemainingInMilliseconds
            });
          }
        });

        isRendering = false;
        broadcastSse("render_done", {
          videoName: safeVideoName,
          outputPath: finalOutputPath,
          videoUrl: `/out/${safeVideoName}?t=${Date.now()}`,
          durationSec: renderResult.durationSec || renderResult.duration,
          executionTimeSec: renderResult.executionTimeSec,
          hardwareAccelerated: renderResult.hardwareAccelerated,
          engine: renderResult.engine || engine,
          engineName,
          hasAudio: renderResult.hasAudio !== false,
          audioMethod: renderResult.audioMethod || "synthesized_mix",
          fallbackUsed: renderResult.fallbackUsed,
          fallbackReason: renderResult.fallbackReason
        });
      } catch (err) {
        isRendering = false;
        if (err.message === "RENDER_CANCELED_BY_USER") {
          broadcastSse("render_canceled", { message: "Đã hủy dựng video theo yêu cầu." });
        } else {
          broadcastSse("render_error", {
            videoName: safeVideoName,
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
 * 17. Xóa dự án AI đã import (Xóa 1 dự án hoặc dọn sạch tất cả)
 */
app.post("/api/ai-code/delete-project", (req, res) => {
  try {
    const { projectId, deleteAll = false } = req.body;
    const importedDir = path.join(projectRoot, "imported_projects");

    if (deleteAll) {
      if (fs.existsSync(importedDir)) {
        const entries = fs.readdirSync(importedDir, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            fs.rmSync(path.join(importedDir, ent.name), { recursive: true, force: true });
          }
        }
      }
      return res.json({ success: true, message: "Đã dọn sạch tất cả các dự án đã import." });
    }

    if (!projectId || projectId.startsWith("sample_") || projectId.startsWith("thanhhai_") || projectId.startsWith("python_")) {
      return res.status(400).json({ success: false, error: "Không thể xóa dự án mẫu hệ thống." });
    }

    const safeId = path.basename(projectId);
    const targetDir = path.join(importedDir, safeId);
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    res.json({ success: true, message: `Đã xóa thành công dự án ${safeId}` });
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

