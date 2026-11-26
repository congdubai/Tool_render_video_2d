/**
 * Máy chủ Web Local cho ứng dụng dựng video hoạt hình 2D - Thanh Hai 2D Studio
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
import { unzipProjectSafe, listProjectFiles } from "../lib/project-loader.mjs";
import {
  ENGINE_TYPES,
  ENGINE_DISPLAY_NAMES,
  detectEngine,
  validateEngine,
  getEngineConfig,
  previewEngine,
  renderEngineVideo
} from "../lib/engine-manager.mjs";
import {
  normalizeEngineType,
  loadProjectMetadata,
  saveProjectMetadata
} from "../lib/engine-detector.mjs";
import {
  isThanhHaiProject,
  detectThanhHaiConfig,
  validateThanhHaiProject,
  renderThanhHaiStill,
  renderThanhHaiContactSheet,
  renderThanhHaiVideo
} from "../lib/thanhhai-render-adapter.mjs";
import {
  listCharacters,
  getCharacter,
  saveCharacter,
  duplicateCharacter,
  deleteCharacter,
  saveCharacterPartAsset,
  getImportedAssetDir
} from "../lib/character-library.mjs";
import { validateCharacterRig } from "../lib/character-validator.mjs";
import {
  listAssets,
  getAsset,
  saveAsset,
  duplicateAsset,
  deleteAsset,
  checkAssetUsage,
  exportAssetPackage,
  importAssetPackage,
  ensureAssetStorage
} from "../lib/asset-registry.mjs";
import {
  validateAssetSchema,
  checkAssetCompatibility,
  ASSET_TYPES,
  ASSET_TYPE_LABELS
} from "../lib/asset-validator.mjs";
import {
  scanScenePlanRequirements,
  AssetDependencyGraph,
  resolveAssetRequirement,
  batchResolveRequirements,
  deduplicateAssetRequirements,
  buildAssetGenerationPrompt,
  exportPromptsMarkdown,
  exportFilenameMappingCsv,
  validateImageFile,
  ANCHOR_PRESETS,
  matchFilenameToRequirement,
  processImportedFiles,
  importZipArchive,
  AssetBindingRegistry,
  calculateProjectReadiness,
  buildSceneBuilderContract,
  SmartAssetManager
} from "../thanhhai-2d-studio/engine/v5-smart-asset-manager.js";
import {
  generateProceduralAsset,
  saveProceduralAsset,
  generateAndBindAllMissing,
  canGenerateProcedurally,
  BACKGROUND_CATEGORIES,
  PROP_CATALOG
} from "../thanhhai-2d-studio/engine/v5-procedural-generator.js";
import {
  executeAutoBuildAll,
  executeBuildSingleScene,
  executeIncrementalRebuild,
  executeApplyUserOverride,
  executeLockScene,
  executeApplyScenePatch,
  getGlobalSceneBuilder
} from "../thanhhai-2d-studio/engine/v5-automatic-scene-builder.js";

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
app.use("/imported_projects", express.static(path.join(projectRoot, "imported_projects")));
app.use("/data", express.static(path.join(projectRoot, "data")));

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

    const scriptPath = path.join(projectRoot, "out/script.json");
    const timelinePath = path.join(projectRoot, "out/timeline.json");

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
      timelineMd: fs.existsSync(path.join(projectRoot, "out/timeline_for_ai.md"))
        ? fs.readFileSync(path.join(projectRoot, "out/timeline_for_ai.md"), "utf-8")
        : ""
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
 * 9. Hủy render
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
 * TAB 2 API: THANH HAI 2D STUDIO PROJECT PIPELINE
 * =========================================================================
 */

/**
 * 12. Lấy danh sách các project Thanh Hai 2D Studio (Mẫu demo & Dự án import)
 */
app.get("/api/ai-code/projects", (req, res) => {
  try {
    const importedDir = path.join(projectRoot, "imported_projects");
    const thanhhaiExamplesDir = path.join(projectRoot, "thanhhai-2d-studio/examples");
    fs.mkdirSync(importedDir, { recursive: true });

    const sampleProjects = [];
    const importedProjects = [];

    // 1. Quét mẫu Thanh Hai 2D Studio trong examples/
    if (fs.existsSync(thanhhaiExamplesDir)) {
      const thEntries = fs.readdirSync(thanhhaiExamplesDir, { withFileTypes: true });
      for (const ent of thEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(thanhhaiExamplesDir, ent.name);
          if (isThanhHaiProject(pDir)) {
            const config = detectThanhHaiConfig(pDir);
            let displayLabel = ent.name;
            if (ent.name === "so-ma-30s") {
              displayLabel = "so-ma-30s • Nếu Bạn Là Một Người Cực Kỳ Sợ Ma? (White Cartoon 2D - 30s)";
            } else if (ent.name === "reaction-time") {
              displayLabel = "reaction-time • Thanh Hai 2D (White Cartoon 2D)";
            } else {
              displayLabel = `${ent.name} • Thanh Hai 2D Studio`;
            }

            const pObj = {
              id: `thanhhai_${ent.name}`,
              name: `⭐ [MẪU DEMO] ${displayLabel}`,
              folderName: ent.name,
              type: "sample",
              engine: ENGINE_TYPES.THANH_HAI,
              engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
              isDemo: true,
              path: pDir,
              config
            };

            if (ent.name === "so-ma-30s") {
              sampleProjects.unshift(pObj);
            } else {
              sampleProjects.push(pObj);
            }
          }
        }
      }
    }

    // 2. Quét imported projects (Tất cả được quản lý theo chuẩn Thanh Hai 2D)
    if (fs.existsSync(importedDir)) {
      const importedEntries = fs.readdirSync(importedDir, { withFileTypes: true });
      for (const ent of importedEntries) {
        if (ent.isDirectory()) {
          const pDir = path.join(importedDir, ent.name);
          const stats = fs.statSync(pDir);
          const detected = detectEngine(pDir);

          const engine = ENGINE_TYPES.THANH_HAI;
          const engineName = ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI];
          const config = detected.config || detectThanhHaiConfig(pDir);

          const cleanName = ent.name.replace(/_\d{8}_\d{6}$/, "");
          const timeStr = new Date(stats.mtime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
          const dateStr = new Date(stats.mtime).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });

          importedProjects.push({
            id: ent.name,
            name: `📦 [DỰ ÁN] ${cleanName} (${timeStr} ${dateStr}) • Thanh Hai 2D`,
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
 * 13. Tải lên và giải nén file ZIP dự án Thanh Hai 2D Studio
 */
app.post("/api/ai-code/upload-zip", async (req, res) => {
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

    // Giải nén an toàn với cơ chế bảo mật cao chống Zip Slip
    const extractResult = unzipProjectSafe(zipBuffer, targetDir);

    // Nhận diện và thẩm định cấu trúc dự án Thanh Hai 2D
    const detected = detectEngine(targetDir);
    const validation = validateEngine(targetDir);

    // Lưu metadata định danh dự án
    saveProjectMetadata(targetDir, {
      projectId,
      rawName: baseSlug,
      engineType: ENGINE_TYPES.THANH_HAI,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
      effectiveRoot: detected.projectRoot,
      entryPoint: detected.entryPoint
    });

    res.json({
      success: true,
      projectId,
      projectName: detected.projectName || path.parse(filename).name,
      cleanName: baseSlug,
      targetDir,
      engine: ENGINE_TYPES.THANH_HAI,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
      extractedCount: extractResult.extractedFiles.length,
      validation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 14. Thẩm định dự án Thanh Hai 2D Studio
 */
app.post("/api/ai-code/validate", async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: `Không tìm thấy dự án tại: ${targetDir}` });
    }

    const validation = validateEngine(targetDir);

    res.json({
      success: true,
      projectId,
      engine: ENGINE_TYPES.THANH_HAI,
      engineName: ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI],
      validation
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 15. Chụp và xem trước Frame bất kỳ từ dự án Thanh Hai 2D Studio
 */
app.post("/api/ai-code/preview-frame", async (req, res) => {
  try {
    const { projectId, frame = 0, characterRenderer = null } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const cfg = detectThanhHaiConfig(targetDir);
    const fps = cfg.fps || 24;
    const timeInSec = Number(frame) / fps;

    const stillResult = await renderThanhHaiStill({
      projectDir: targetDir,
      time: timeInSec,
      scale: 0.5,
      characterRenderer
    });

    const relPath = path.relative(path.join(projectRoot, "out"), stillResult.framePath).replace(/\\/g, "/");
    return res.json({
      success: true,
      engine: "thanhhai-2d-studio",
      frameUrl: `/out/${relPath}?t=${Date.now()}`,
      frame: Number(frame),
      time: stillResult.time,
      width: cfg.width,
      height: cfg.height
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 15b. Render Contact Sheet cho dự án Thanh Hai Studio
 */
app.post("/api/ai-code/contact-sheet", async (req, res) => {
  try {
    const { projectId, characterRenderer = null } = req.body;
    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(400).json({ success: false, error: "Dự án không tồn tại." });
    }

    const previewRes = await previewEngine(targetDir, ENGINE_TYPES.THANH_HAI, { contactSheet: true, characterRenderer });

    res.json({
      success: true,
      sheetUrl: previewRes.url
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 16. Render video hoàn chỉnh bằng Thanh Hai 2D Studio Engine
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
      customFps = null,
      characterRenderer = null
    } = req.body;

    if (!projectId) {
      return res.status(400).json({ success: false, error: "Thiếu mã dự án (projectId)." });
    }

    let targetDir = path.join(projectRoot, "imported_projects", projectId);
    if (projectId.startsWith("thanhhai_")) {
      targetDir = path.join(projectRoot, "thanhhai-2d-studio/examples", projectId.replace("thanhhai_", ""));
    } else if (projectId.startsWith("sample_")) {
      targetDir = path.join(projectRoot, "sample-projects", projectId.replace("sample_", ""));
    }

    if (!fs.existsSync(targetDir)) {
      return res.status(404).json({ success: false, error: "Dự án không tồn tại." });
    }

    const config = detectThanhHaiConfig(targetDir);
    const engine = ENGINE_TYPES.THANH_HAI;
    const engineName = ENGINE_DISPLAY_NAMES[ENGINE_TYPES.THANH_HAI];

    // Thẩm định dự án trước khi render
    const val = validateThanhHaiProject(targetDir);
    if (!val.valid) {
      return res.status(400).json({
        success: false,
        error: `Dự án Thanh Hai 2D không hợp lệ để render:\n${val.errors.map((e) => `• ${e}`).join("\n")}`
      });
    }

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
      const prefix = "thanhhai";

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
          outputPath: finalOutputPath,
          isTest,
          customResolution,
          customFps,
          accelerationMode,
          concurrency: concurrency || 4,
          characterRenderer,
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
          audioMethod: renderResult.audioMethod || "synthesized_mix"
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
 * 17. Xóa dự án đã import (Xóa 1 dự án hoặc dọn sạch tất cả)
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

    if (!projectId || projectId.startsWith("sample_") || projectId.startsWith("thanhhai_")) {
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

/**
 * =========================================================================
 * 18. CHARACTER LIBRARY SYSTEM V2 REST API
 * =========================================================================
 */

// Lấy danh sách toàn bộ nhân vật đã lưu
app.get("/api/characters", (req, res) => {
  try {
    const characters = listCharacters();
    res.json({ success: true, characters });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy chi tiết một nhân vật
app.get("/api/characters/:id", (req, res) => {
  try {
    const char = getCharacter(req.params.id);
    if (!char) {
      return res.status(404).json({ success: false, error: "Không tìm thấy nhân vật." });
    }
    res.json({ success: true, character: char });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tạo mới hoặc cập nhật nhân vật
app.post("/api/characters", (req, res) => {
  try {
    const saved = saveCharacter(req.body);
    res.json({ success: true, character: saved, message: `Đã lưu nhân vật "${saved.name}" thành công!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Cập nhật nhân vật theo ID
app.put("/api/characters/:id", (req, res) => {
  try {
    const saved = saveCharacter({ ...req.body, id: req.params.id });
    res.json({ success: true, character: saved, message: `Đã cập nhật nhân vật "${saved.name}" thành công!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Nhân bản nhân vật
app.post("/api/characters/:id/duplicate", (req, res) => {
  try {
    const duplicated = duplicateCharacter(req.params.id);
    res.json({ success: true, character: duplicated, message: `Đã nhân bản thành "${duplicated.name}"!` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Xóa nhân vật
app.delete("/api/characters/:id", (req, res) => {
  try {
    const success = deleteCharacter(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: "Không tìm thấy nhân vật để xóa." });
    }
    res.json({ success: true, message: `Đã xóa nhân vật ${req.params.id} thành công.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Thẩm định tính toàn vẹn Character Rig V2 / V3
app.post("/api/characters/validate", (req, res) => {
  try {
    const { character, context } = req.body;
    const result = validateCharacterRig(character, context);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload 1 ảnh bộ phận (part) cho nhân vật import
app.post("/api/characters/upload-part", (req, res) => {
  try {
    const { charId, partId, data, filename } = req.body;
    if (!charId || !data) {
      return res.status(400).json({ success: false, error: "Thiếu charId hoặc dữ liệu ảnh (data)." });
    }
    const url = saveCharacterPartAsset(charId, partId, data, filename);
    res.json({ success: true, url, partId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload hàng loạt ảnh bộ phận (batch upload)
app.post("/api/characters/upload-batch", (req, res) => {
  try {
    const { charId, parts } = req.body;
    if (!charId || !Array.isArray(parts)) {
      return res.status(400).json({ success: false, error: "Thiếu charId hoặc danh sách parts." });
    }
    const uploaded = {};
    for (const p of parts) {
      if (p.id && p.data) {
        const url = saveCharacterPartAsset(charId, p.id, p.data, p.filename);
        uploaded[p.id] = url;
      }
    }
    res.json({ success: true, uploaded });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xuất gói nhân vật (.zip package)
app.get("/api/characters/:id/export-package", async (req, res) => {
  try {
    const char = getCharacter(req.params.id);
    if (!char) {
      return res.status(404).json({ success: false, error: "Không tìm thấy nhân vật." });
    }

    const AdmZipModule = (await import("adm-zip")).default;
    const zip = new AdmZipModule();

    // 1. Thêm tệp character.json
    zip.addFile("character.json", Buffer.from(JSON.stringify(char, null, 2), "utf8"));

    // 2. Thêm toàn bộ tệp assets trong thư mục nếu là imported character
    const assetDir = getImportedAssetDir(char.id);
    if (fs.existsSync(assetDir)) {
      for (const f of fs.readdirSync(assetDir)) {
        const fullPath = path.join(assetDir, f);
        if (fs.statSync(fullPath).isFile()) {
          zip.addLocalFile(fullPath, "assets");
        }
      }
    }

    const zipBuffer = zip.toBuffer();
    const downloadFilename = `${char.name || char.id}_character_package.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadFilename)}"`);
    res.send(zipBuffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Nhập gói nhân vật (.zip hoặc .json package)
app.post("/api/characters/import-package", async (req, res) => {
  try {
    const { zipBase64, jsonPackage } = req.body;

    if (jsonPackage && jsonPackage.id) {
      // Trường hợp gói JSON thuần
      const saved = saveCharacter(jsonPackage);
      return res.json({ success: true, character: saved, message: `Đã nhập nhân vật "${saved.name}" thành công!` });
    }

    if (!zipBase64) {
      return res.status(400).json({ success: false, error: "Thiếu dữ liệu tệp zipBase64 hoặc jsonPackage." });
    }

    const rawBase64 = zipBase64.replace(/^data:application\/[a-zA-Z+.-]+;base64,/, "").replace(/^data:.*?;base64,/, "");
    const zipBuf = Buffer.from(rawBase64, "base64");

    const AdmZipModule = (await import("adm-zip")).default;
    const zip = new AdmZipModule(zipBuf);
    const zipEntries = zip.getEntries();

    // Tìm manifest / character.json
    let charJsonEntry = zipEntries.find(e => e.entryName === "character.json" || e.entryName === "manifest.json" || e.entryName.endsWith(".json"));
    if (!charJsonEntry) {
      return res.status(400).json({ success: false, error: "Không tìm thấy file cấu hình character.json trong tệp ZIP." });
    }

    const charData = JSON.parse(charJsonEntry.getData().toString("utf8"));
    const safeId = path.basename(charData.id || `imported_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "");
    charData.id = safeId;
    charData.type = "imported";

    const assetDir = getImportedAssetDir(safeId);

    // Giải nén các tệp ảnh vào thư mục assets
    for (const entry of zipEntries) {
      if (!entry.isDirectory && (entry.entryName.startsWith("assets/") || entry.entryName.endsWith(".png") || entry.entryName.endsWith(".jpg") || entry.entryName.endsWith(".webp"))) {
        const fname = path.basename(entry.entryName);
        fs.writeFileSync(path.join(assetDir, fname), entry.getData());
      }
    }

    // Cập nhật lại đường dẫn ảnh trong parts
    if (charData.parts && typeof charData.parts === "object") {
      for (const pKey of Object.keys(charData.parts)) {
        const p = charData.parts[pKey];
        if (p.image) {
          const fname = path.basename(p.image);
          p.image = `/public/characters/imported/${safeId}/${fname}`;
        }
      }
    }

    const saved = saveCharacter(charData);
    res.json({ success: true, character: saved, message: `Đã nhập gói nhân vật "${saved.name}" thành công!` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ================= UNIVERSAL ASSET LIBRARY (V4) API ENDPOINTS =================

// Lấy danh mục các loại tài nguyên hỗ trợ (Types & Labels)
app.get("/api/assets/types", (req, res) => {
  res.json({
    success: true,
    types: ASSET_TYPES,
    labels: ASSET_TYPE_LABELS
  });
});

// Lấy danh sách toàn bộ tài nguyên trong thư viện (hỗ trợ search, filter type, category, tag)
app.get("/api/assets", (req, res) => {
  try {
    const assets = listAssets(req.query);
    res.json({
      success: true,
      assets,
      total: assets.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lấy chi tiết một tài nguyên kèm thông tin phụ thuộc/sử dụng trong dự án
app.get("/api/assets/:id", (req, res) => {
  try {
    const asset = getAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên." });
    }
    const usage = checkAssetUsage(req.params.id);
    res.json({ success: true, asset, usage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tạo mới tài nguyên vào thư viện
app.post("/api/assets", (req, res) => {
  try {
    const saved = saveAsset(req.body);
    res.json({
      success: true,
      asset: saved,
      message: `Đã lưu tài nguyên "${saved.name}" thành công!`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Cập nhật tài nguyên theo ID
app.put("/api/assets/:id", (req, res) => {
  try {
    const saved = saveAsset({ ...req.body, id: req.params.id });
    res.json({
      success: true,
      asset: saved,
      message: `Đã cập nhật tài nguyên "${saved.name}" thành công!`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Nhân bản tài nguyên
app.post("/api/assets/:id/duplicate", (req, res) => {
  try {
    const duplicated = duplicateAsset(req.params.id);
    res.json({
      success: true,
      asset: duplicated,
      message: `Đã nhân bản tài nguyên thành "${duplicated.name}"!`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Xóa tài nguyên (có cảnh báo nếu đang được dự án sử dụng, hỗ trợ ?force=true)
app.delete("/api/assets/:id", (req, res) => {
  try {
    const force = req.query.force === "true" || req.body?.force === true;
    const result = deleteAsset(req.params.id, force);
    if (!result.success) {
      if (result.inUse) {
        return res.status(409).json({
          success: false,
          inUse: true,
          projects: result.projects,
          error: result.error
        });
      }
      return res.status(404).json({ success: false, error: result.error || "Không thể xóa tài nguyên." });
    }
    res.json({ success: true, message: `Đã xóa tài nguyên "${req.params.id}" thành công.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Kiểm tra việc sử dụng tài nguyên trong dự án
app.get("/api/assets/:id/usage", (req, res) => {
  try {
    const usage = checkAssetUsage(req.params.id);
    res.json({ success: true, ...usage });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xuất 1 tài nguyên thành gói ZIP
app.get("/api/assets/:id/export", (req, res) => {
  try {
    const asset = getAsset(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, error: "Không tìm thấy tài nguyên." });
    }
    const zipBuf = exportAssetPackage(req.params.id);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="asset_${asset.id}.zip"`,
      "Content-Length": zipBuf.length
    });
    res.send(zipBuf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Xuất toàn bộ tài nguyên theo danh mục (Type) thành gói ZIP (e.g. cartoon_props.zip)
app.get("/api/assets/export-type/:type", (req, res) => {
  try {
    const { type } = req.params;
    const assets = listAssets({ type });
    if (assets.length === 0) {
      return res.status(404).json({ success: false, error: `Không có tài nguyên nào thuộc loại "${type}".` });
    }
    const ids = assets.map(a => a.id);
    const zipBuf = exportAssetPackage(ids);
    res.set({
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="assets_${type}.zip"`,
      "Content-Length": zipBuf.length
    });
    res.send(zipBuf);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Nhập gói tài nguyên ZIP (.zip package)
app.post("/api/assets/import-pack", async (req, res) => {
  try {
    const { zipBase64, collisionStrategy = "rename" } = req.body;
    if (!zipBase64) {
      return res.status(400).json({ success: false, error: "Thiếu dữ liệu tệp zipBase64." });
    }

    const rawBase64 = zipBase64.replace(/^data:application\/[a-zA-Z+.-]+;base64,/, "").replace(/^data:.*?;base64,/, "");
    const zipBuf = Buffer.from(rawBase64, "base64");

    const result = importAssetPackage(zipBuf, { collisionStrategy });
    res.json({
      success: true,
      importedCount: result.importedCount,
      importedAssets: result.importedAssets,
      message: `Đã nhập thành công ${result.importedCount} tài nguyên vào thư viện!`
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Upload tệp media độc lập cho một asset
app.post("/api/assets/upload-media", (req, res) => {
  try {
    const { assetId, type = "props", filename, data } = req.body;
    if (!assetId || !data) {
      return res.status(400).json({ success: false, error: "Thiếu assetId hoặc dữ liệu data." });
    }

    const safeId = path.basename(assetId).replace(/[^a-zA-Z0-9_-]/g, "");
    const safeType = path.basename(type).replace(/[^a-zA-Z0-9_-]/g, "");
    const safeFname = path.basename(filename || "media.png").replace(/[^a-zA-Z0-9_.-]/g, "");

    const targetDir = path.resolve(process.cwd(), "public", "assets", safeType, safeId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filePath = path.join(targetDir, safeFname);
    let buf = null;
    if (typeof data === "string") {
      const match = data.match(/^data:.*?;base64,(.+)$/);
      buf = Buffer.from(match ? match[1] : data, "base64");
    } else if (Buffer.isBuffer(data)) {
      buf = data;
    }

    if (!buf) {
      return res.status(400).json({ success: false, error: "Dữ liệu ảnh không hợp lệ." });
    }

    fs.writeFileSync(filePath, buf);
    const publicUrl = `/public/assets/${safeType}/${safeId}/${safeFname}`;
    res.json({ success: true, url: publicUrl, filename: safeFname });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// V5 SMART ASSET MANAGER & AUTOMATIC ASSET RESOLUTION API (PHASE 2)
// =========================================================================

// In-memory or project-persisted manager cache: projectId -> SmartAssetManager
const smartAssetManagers = new Map();

function getProjectManager(projectId, scenePlan = {}) {
  const safeId = path.basename(projectId || "default_v5_project").replace(/[^a-zA-Z0-9_-]/g, "");
  const pDir = path.resolve(projectRoot, "imported_projects", safeId);
  fs.mkdirSync(pDir, { recursive: true });

  if (!smartAssetManagers.has(safeId)) {
    const manager = new SmartAssetManager(pDir, scenePlan);
    smartAssetManagers.set(safeId, manager);
  }
  const manager = smartAssetManagers.get(safeId);
  if (scenePlan && Object.keys(scenePlan).length > 0) {
    manager.scenePlan = scenePlan;
  }
  return manager;
}

// 1. Quét toàn bộ Scene Plan và tự động tìm kiếm tài nguyên (Scan & Auto-Resolve)
app.post("/api/v5/smart-assets/scan", (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project", styleProfileId, protagonist } = req.body;
    if (!scenePlan || !Array.isArray(scenePlan.scenes)) {
      return res.status(400).json({ success: false, error: "Dữ liệu Scene Plan JSON không hợp lệ hoặc thiếu mảng scenes." });
    }

    const manager = getProjectManager(projectId, scenePlan);
    const result = manager.scanAndResolve({ styleProfileId, protagonist });

    res.json({
      success: true,
      projectId,
      ...result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Gán / Liên kết thủ công tài nguyên cho một requirement (Bind Asset)
app.post("/api/v5/smart-assets/bind", (req, res) => {
  try {
    const { projectId = "default_v5_project", requirementId, resolvedAssetId, anchor, isSharedAsset, force } = req.body;
    if (!requirementId || !resolvedAssetId) {
      return res.status(400).json({ success: false, error: "Thiếu requirementId hoặc resolvedAssetId." });
    }

    const manager = getProjectManager(projectId);
    const bindResult = manager.bindingRegistry.bind(requirementId, resolvedAssetId, {
      anchor,
      isSharedAsset,
      force
    });

    // Auto-link Mode A characters (Doc, Jake, Chibi Doc) with rig and hand anchors
    const resolvedNorm = (resolvedAssetId || '').toLowerCase();
    const reqNorm = (requirementId || '').toLowerCase();
    if (resolvedNorm.includes('doc') || resolvedNorm.includes('jake') || reqNorm.startsWith('req_char_')) {
      const knownChars = ['chibi_doc', 'doc', 'jake'];
      const matchedChar = knownChars.find(c => resolvedNorm.includes(c) || reqNorm.includes(c)) ||
                          (resolvedNorm.includes('scientist') ? 'doc' : null);
      if (matchedChar) {
        const isChibi = matchedChar.startsWith('chibi');
        const rigReqId = `REQ_RIG_${matchedChar.toUpperCase()}`;
        if (!manager.bindingRegistry.getBinding(rigReqId)) {
          manager.bindingRegistry.bind(rigReqId, matchedChar, {
            resolutionMethod: isChibi ? 'CHIBI_RIG' : 'BUILTIN_RIG',
            status: 'READY'
          });
        }
        manager.dependencyGraph.setRequirementStatus(rigReqId, 'READY');

        if (matchedChar.includes('doc')) {
          manager.dependencyGraph.setRequirementStatus('REQ_RIG_DOC', 'READY');
          if (!manager.bindingRegistry.getBinding('REQ_RIG_DOC')) {
            manager.bindingRegistry.bind('REQ_RIG_DOC', matchedChar, {
              resolutionMethod: isChibi ? 'CHIBI_RIG' : 'BUILTIN_RIG',
              status: 'READY'
            });
          }
        }

        // Hand anchors
        for (const hand of ['RIGHT_HAND', 'LEFT_HAND']) {
          const anchorReqId = `REQ_ANCHOR_${matchedChar.toUpperCase()}_${hand}`;
          if (!manager.bindingRegistry.getBinding(anchorReqId)) {
            manager.bindingRegistry.bind(anchorReqId, `${matchedChar}:${hand.toLowerCase()}`, {
              resolutionMethod: 'BUILTIN_RIG_ANCHOR',
              status: 'READY'
            });
          }
          manager.dependencyGraph.setRequirementStatus(anchorReqId, 'READY');

          if (matchedChar.includes('doc')) {
            const docAnchorId = `REQ_ANCHOR_DOC_${hand}`;
            manager.dependencyGraph.setRequirementStatus(docAnchorId, 'READY');
            if (!manager.bindingRegistry.getBinding(docAnchorId)) {
              manager.bindingRegistry.bind(docAnchorId, `${matchedChar}:${hand.toLowerCase()}`, {
                resolutionMethod: 'BUILTIN_RIG_ANCHOR',
                status: 'READY'
              });
            }
          }
        }
      }
    }

    // Recalculate project readiness immediately
    const readiness = calculateProjectReadiness(manager.scenePlan, manager.dependencyGraph, manager.bindingRegistry);

    res.json({
      success: true,
      ...bindResult,
      readiness,
      bindings: manager.bindingRegistry.getAllBindings()
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Hủy liên kết tài nguyên (Unbind Asset)
app.post("/api/v5/smart-assets/unbind", (req, res) => {
  try {
    const { projectId = "default_v5_project", requirementId } = req.body;
    if (!requirementId) {
      return res.status(400).json({ success: false, error: "Thiếu requirementId." });
    }

    const manager = getProjectManager(projectId);
    const unbindResult = manager.bindingRegistry.unbind(requirementId);
    const readiness = calculateProjectReadiness(manager.scenePlan, manager.dependencyGraph, manager.bindingRegistry);

    res.json({
      success: true,
      ...unbindResult,
      readiness,
      bindings: manager.bindingRegistry.getAllBindings()
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Alias for V4 Assets API
app.get("/api/v4/assets", (req, res) => {
  try {
    const assets = listAssets(req.query);
    res.json({
      success: true,
      assets,
      total: assets.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Thư viện đầy đủ phục vụ Visual Asset Picker (Mode A characters, backgrounds, props, outfits, vfx)
app.get("/api/v5/smart-assets/picker-library", (req, res) => {
  try {
    const baseAssets = listAssets(req.query) || [];
    
    // Built-in Mode A characters
    const builtInCharacters = [
      {
        id: "doc",
        name: "Doc (Nhà Khoa Học / Max)",
        type: "character",
        category: "character",
        description: "Nhân vật White Cartoon 2D Mode A với hệ thống xương Rig đầy đủ, tóc bạc, mắt biểu cảm và điểm neo tay",
        preview: "/assets/doc_preview.png",
        tags: ["protagonist", "scientist", "white_cartoon", "mode_a", "rigged"]
      },
      {
        id: "jake",
        name: "Jake (Cộng Sự / Alex)",
        type: "character",
        category: "character",
        description: "Nhân vật White Cartoon 2D Mode A với hệ thống xương Rig đầy đủ, tóc đen, mắt biểu cảm và điểm neo tay",
        preview: "/assets/jake_preview.png",
        tags: ["companion", "young", "white_cartoon", "mode_a", "rigged"]
      }
    ];

    // Standard backgrounds
    const builtInBackgrounds = [
      {
        id: "bg_historical_computer_lab",
        name: "Phòng Thí Nghiệm Máy Tính Cổ Điển (ENIAC Lab)",
        type: "background",
        category: "background",
        description: "Bối cảnh phòng máy tính đèn chân không năm 1946 phong cách hoạt hình giáo dục 16:9",
        tags: ["educational", "lab", "vintage", "16:9"]
      },
      {
        id: "bg_lab_modern",
        name: "Phòng Nghiên Cứu Công Nghệ Hiện Đại",
        type: "background",
        category: "background",
        description: "Bối cảnh phòng thí nghiệm vi xử lý và robot hiện đại phong cách hoạt hình 16:9",
        tags: ["modern", "tech", "lab", "16:9"]
      },
      {
        id: "bg_cafe_cozy",
        name: "Quán Cà Phê Ấm Cúng (Cozy Cafe)",
        type: "background",
        category: "background",
        description: "Bối cảnh quán cà phê phong cách hoạt hình thư giãn",
        tags: ["cafe", "indoor", "warm", "16:9"]
      },
      {
        id: "bg_street_night",
        name: "Đường Phố Ban Đêm (Night Street)",
        type: "background",
        category: "background",
        description: "Bối cảnh phố đi bộ về đêm với đèn đường lung linh",
        tags: ["outdoor", "city", "night", "16:9"]
      }
    ];

    const merged = [...builtInCharacters];
    for (const bg of builtInBackgrounds) {
      if (!baseAssets.some(a => a.id === bg.id)) {
        merged.push(bg);
      }
    }
    for (const a of baseAssets) {
      merged.push(a);
    }

    res.json({
      success: true,
      assets: merged,
      total: merged.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Khôi phục phiên bản tài nguyên cũ (Rollback Version)
app.post("/api/v5/smart-assets/rollback", (req, res) => {
  try {
    const { projectId = "default_v5_project", requirementId, version } = req.body;
    if (!requirementId || !version) {
      return res.status(400).json({ success: false, error: "Thiếu requirementId hoặc số phiên bản version." });
    }

    const manager = getProjectManager(projectId);
    const rollbackResult = manager.bindingRegistry.rollback(requirementId, parseInt(version, 10));

    res.json({
      success: true,
      ...rollbackResult
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Xuất danh sách Prompt sinh ảnh (Markdown / CSV)
app.post("/api/v5/smart-assets/export-prompts", (req, res) => {
  try {
    const { requirements = [], format = "markdown", styleProfileId, protagonist } = req.body;
    if (format === "csv") {
      const csv = exportFilenameMappingCsv(requirements, { styleProfileId, protagonist });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="filename_mapping.csv"');
      return res.send(csv);
    }

    const md = exportPromptsMarkdown(requirements, { styleProfileId, protagonist });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    return res.send(md);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Xuất Gói Chuẩn Bị Tài Nguyên ZIP (Asset Generation Package)
app.post("/api/v5/smart-assets/export-package", (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project", styleProfileId, protagonist } = req.body;
    const manager = getProjectManager(projectId, scenePlan);

    const safeId = path.basename(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
    const tempZip = path.resolve(projectRoot, "imported_projects", safeId, "ASSET_GENERATION_PACKAGE.zip");
    
    const zipResult = manager.exportGenerationPackageZip(tempZip, { styleProfileId, protagonist });
    const zipData = fs.readFileSync(tempZip);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="ASSET_GENERATION_PACKAGE.zip"');
    res.send(zipData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Nhập ảnh hàng loạt hoặc file ZIP và tự động liên kết (Bulk Import)
app.post("/api/v5/smart-assets/bulk-import", (req, res) => {
  try {
    const { projectId = "default_v5_project", files = [], zipBase64, activeRequirements = [] } = req.body;
    const safeId = path.basename(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
    const targetDir = path.resolve(projectRoot, "imported_projects", safeId, "assets");
    fs.mkdirSync(targetDir, { recursive: true });

    const manager = getProjectManager(projectId);
    let importResult;

    if (zipBase64) {
      const rawBase64 = zipBase64.replace(/^data:application\/[a-zA-Z+.-]+;base64,/, "").replace(/^data:.*?;base64,/, "");
      const tempZipPath = path.join(targetDir, `temp_import_${Date.now()}.zip`);
      fs.writeFileSync(tempZipPath, Buffer.from(rawBase64, "base64"));
      
      importResult = importZipArchive(tempZipPath, targetDir, activeRequirements, manager.contentHashes);
      try { fs.unlinkSync(tempZipPath); } catch {}
    } else {
      const writtenPaths = [];
      for (const f of files) {
        if (!f.fileName || !f.base64) continue;
        const safeFname = path.basename(f.fileName).replace(/[^a-zA-Z0-9_.-]/g, "");
        const rawBase64 = f.base64.replace(/^data:.*?;base64,/, "");
        const filePath = path.join(targetDir, safeFname);
        fs.writeFileSync(filePath, Buffer.from(rawBase64, "base64"));
        writtenPaths.push(filePath);
      }
      importResult = processImportedFiles(writtenPaths, targetDir, activeRequirements, manager.contentHashes);
    }

    // Tự động bind các file đã khớp chính xác với requirement ID
    for (const m of importResult.matched) {
      manager.bindingRegistry.bind(m.requirementId, m.fileName, {
        resolutionMethod: m.matchMethod,
        imagePath: `/imported_projects/${safeId}/assets/${m.fileName}`,
        anchor: m.recommendedAnchor,
        dimensions: m.dimensions,
        status: "READY"
      });
    }

    res.json({
      success: true,
      projectId,
      ...importResult,
      activeBindings: manager.bindingRegistry.getAllBindings()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Báo cáo mức độ sẵn sàng của dự án (Project Readiness Report)
app.post("/api/v5/smart-assets/readiness", (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project" } = req.body;
    const manager = getProjectManager(projectId, scenePlan);
    const report = calculateProjectReadiness(manager.scenePlan, manager.dependencyGraph, manager.bindingRegistry);

    res.json({
      success: true,
      report
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Hợp đồng tích hợp cho Scene Builder Phase 3 (Scene Builder Integration Contract)
app.post("/api/v5/smart-assets/compile-contract", (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project" } = req.body;
    const manager = getProjectManager(projectId, scenePlan);
    const readiness = calculateProjectReadiness(manager.scenePlan, manager.dependencyGraph, manager.bindingRegistry);
    const contract = buildSceneBuilderContract(manager.scenePlan, manager.bindingRegistry, readiness);

    res.json({
      success: true,
      contract
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// PROCEDURAL ASSET GENERATOR (V5.1) - ZERO LOCAL AI, ZERO PAID APIS
// ============================================================================

// 1. Danh sách templates hỗ trợ Procedural
app.get("/api/v5/procedural/templates", (req, res) => {
  try {
    res.json({
      success: true,
      backgrounds: BACKGROUND_CATEGORIES,
      props: PROP_CATALOG,
      styles: [
        { id: "white_cartoon", name: "Hoạt Hình Nét Trắng (White Cartoon)" },
        { id: "chibi_cartoon", name: "Chibi Dễ Thương (Chibi Cartoon)" },
        { id: "flat_vector", name: "Đồ Họa Phẳng Hiện Đại (Flat Vector)" },
        { id: "minimal_educational", name: "Tối Giản Giáo Dục (Minimal Educational)" },
        { id: "historical_cartoon", name: "Lịch Sử Cổ Điển (Historical Vintage)" },
        { id: "doodle", name: "Nét Vẽ Tay Phác Thảo (Doodle Sketch)" }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Tạo xem trước tài nguyên Procedural (In-Memory Preview)
app.post("/api/v5/procedural/generate", async (req, res) => {
  try {
    const { requirement, type, template, styleProfileId, options = {}, seed } = req.body;
    const reqId = requirement?.id || req.body.requirementId || `req_${type || 'prop'}_${Date.now()}`;
    const templateCandidate = String(template || reqId).toLowerCase();
    const isKnownBg = ['modern_lab', 'lab_modern', 'vintage_lab', 'office', 'classroom', 'city_street', 'street', 'park', 'city', 'forest', 'cafe', 'lab', 'room'].some(t => templateCandidate.includes(t)) || reqId.toLowerCase().includes('bg');
    const isKnownDiag = ['historical_timeline', 'principle_diagram', 'comparison_chart'].some(t => templateCandidate.includes(t)) || reqId.toLowerCase().includes('diagram');
    const detectedType = type || requirement?.type || (isKnownBg ? 'background' : (isKnownDiag ? 'diagram' : 'prop'));
    
    const reqObj = requirement || {
      id: reqId,
      type: detectedType,
      proceduralTemplateId: template,
      name: options.name || template || 'Procedural Asset'
    };
    if (template) reqObj.proceduralTemplateId = template;
    reqObj.type = detectedType;

    const asset = generateProceduralAsset(reqObj, {
      ...options,
      template,
      styleProfile: styleProfileId || options.styleProfile || 'flat_vector',
      seed: seed !== undefined ? seed : (options.seed || 12345)
    });

    const svg = asset.getSvg ? asset.getSvg() : '';
    let previewBase64 = null;
    try {
      const { renderToPngBuffer } = await import("../thanhhai-2d-studio/engine/v5-vector-engine.js");
      const pngBuf = await renderToPngBuffer(asset.vectorSpec, {
        width: Math.min(asset.width || 512, 512),
        height: Math.min(asset.height || 512, 512)
      });
      previewBase64 = `data:image/png;base64,${pngBuf.toString('base64')}`;
    } catch (e) {
      console.warn("PNG preview generation warning:", e.message);
    }

    res.json({
      success: true,
      asset: {
        id: asset.id,
        name: asset.name,
        type: asset.type,
        width: asset.width,
        height: asset.height,
        layers: asset.layers || [],
        gripPoint: asset.gripPoint,
        groundContact: asset.groundContact,
        pivot: asset.pivot,
        svg,
        previewBase64
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Lưu và liên kết tài nguyên Procedural vào Requirement (Save & Bind)
app.post("/api/v5/procedural/save-and-bind", async (req, res) => {
  try {
    const { projectId = "default_v5_project", requirementId, type, template, styleProfileId, options = {}, seed, customName } = req.body;
    if (!requirementId) {
      return res.status(400).json({ success: false, error: "Thiếu requirementId." });
    }

    const detectedType = type || (requirementId.toLowerCase().includes('bg') || requirementId.toLowerCase().includes('background') ? 'background' : (requirementId.toLowerCase().includes('diagram') ? 'diagram' : 'prop'));
    const manager = getProjectManager(projectId);
    const reqObj = {
      id: requirementId,
      type: detectedType,
      proceduralTemplateId: template,
      name: customName || template || requirementId
    };

    const asset = generateProceduralAsset(reqObj, {
      ...options,
      template,
      styleProfile: styleProfileId || 'flat_vector',
      seed: seed !== undefined ? seed : (options.seed || 12345)
    });

    const safeId = path.basename(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
    const targetDir = path.resolve(projectRoot, "imported_projects", safeId, "assets");
    fs.mkdirSync(targetDir, { recursive: true });

    const saveRes = await saveProceduralAsset(asset, targetDir, options);

    // Bind into project registry
    manager.bindingRegistry.bind(requirementId, saveRes.assetId, {
      resolutionMethod: 'PROCEDURAL_CODE_GEN',
      status: 'READY',
      imagePath: `/imported_projects/${safeId}/assets/${saveRes.assetId}.png`,
      svgPath: `/imported_projects/${safeId}/assets/${saveRes.assetId}.svg`,
      anchor: asset.gripPoint,
      dimensions: { width: asset.width, height: asset.height },
      procedural: true,
      layers: asset.layers
    });

    manager.dependencyGraph.setRequirementStatus(requirementId, 'READY');

    const readiness = calculateProjectReadiness(manager.scenePlan, manager.dependencyGraph, manager.bindingRegistry);

    res.json({
      success: true,
      assetId: saveRes.assetId,
      savedPaths: {
        png: saveRes.pngPath,
        svg: saveRes.svgPath,
        meta: saveRes.metaPath
      },
      readiness,
      bindings: manager.bindingRegistry.getAllBindings()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Tự động vẽ và gán toàn bộ tài nguyên còn thiếu (CODE GEN ALL)
app.post("/api/v5/procedural/generate-all", async (req, res) => {
  try {
    const { projectId = "default_v5_project", scenePlan, styleProfileId, options = {} } = req.body;
    const manager = getProjectManager(projectId, scenePlan);

    const safeId = path.basename(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
    const targetDir = path.resolve(projectRoot, "imported_projects", safeId, "assets");
    fs.mkdirSync(targetDir, { recursive: true });

    const result = await generateAndBindAllMissing(manager.scenePlan, manager, {
      ...options,
      styleProfile: styleProfileId || 'flat_vector',
      targetDir
    });

    res.json({
      success: true,
      ...result,
      bindings: manager.bindingRegistry.getAllBindings()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// THANH HAI 2D STUDIO V5 — PHASE 3: AUTOMATIC SCENE BUILDER ENDPOINTS
// ============================================================================

// 1. Tự động dựng toàn bộ cảnh (Batch Build All)
app.post("/api/v5/builder/build-all", async (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project", resolvedBindings } = req.body;
    if (!scenePlan || !Array.isArray(scenePlan.scenes)) {
      return res.status(400).json({ success: false, error: "Dữ liệu Scene Plan JSON không hợp lệ." });
    }

    const manager = getProjectManager(projectId, scenePlan);
    const bindings = resolvedBindings || manager.bindingRegistry.getAllBindings();
    const result = await executeAutoBuildAll(scenePlan, bindings, {
      projectContext: {
        projectId,
        characterBindings: scenePlan.characterBindings || []
      }
    });

    res.json({
      success: result.success,
      projectStatus: result.projectStatus,
      stats: result.stats,
      scenes: result.compiledScenes,
      compiledScenes: result.compiledScenes,
      failedScenes: result.failedScenes || [],
      v4Project: result.v4Project || result.compiledProject
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Dựng một cảnh đơn lẻ hoặc dựng lại (Build Single Scene)
app.post("/api/v5/builder/build-scene", (req, res) => {
  try {
    const { scene, sceneDescriptor, projectId = "default_v5_project", resolvedBindings } = req.body;
    const desc = scene || sceneDescriptor;
    if (!desc || !desc.id) {
      return res.status(400).json({ success: false, error: "Thiếu thông tin scene descriptor hoặc scene id." });
    }

    const manager = getProjectManager(projectId);
    const bindings = resolvedBindings || manager.bindingRegistry.getAllBindings();
    const result = executeBuildSingleScene(desc, bindings, {
      forceRebuild: true,
      projectContext: {
        projectId,
        characterBindings: manager.scenePlan?.characterBindings || []
      }
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Tự động dựng lại tăng tiến (Incremental Rebuild)
app.post("/api/v5/builder/incremental-rebuild", (req, res) => {
  try {
    const { scenePlan, projectId = "default_v5_project", resolvedBindings } = req.body;
    const manager = getProjectManager(projectId, scenePlan);
    const bindings = resolvedBindings || manager.bindingRegistry.getAllBindings();
    const result = executeIncrementalRebuild(scenePlan, bindings);

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Lưu User Overrides cho Scene
app.post("/api/v5/builder/override", (req, res) => {
  try {
    const { sceneId, overrides = {} } = req.body;
    if (!sceneId) {
      return res.status(400).json({ success: false, error: "Thiếu sceneId." });
    }
    const result = executeApplyUserOverride(sceneId, overrides);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Khóa hoặc Mở khóa cảnh (Lock Scene)
app.post("/api/v5/builder/lock", (req, res) => {
  try {
    const { sceneId, locked = true } = req.body;
    if (!sceneId) {
      return res.status(400).json({ success: false, error: "Thiếu sceneId." });
    }
    const result = executeLockScene(sceneId, locked);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Áp dụng AI Scene Patch (Patch Scene)
app.post("/api/v5/builder/patch", (req, res) => {
  try {
    const { targetSceneId, patch = {}, scenePlan = {} } = req.body;
    if (!targetSceneId) {
      return res.status(400).json({ success: false, error: "Thiếu targetSceneId." });
    }
    const result = executeApplyScenePatch(targetSceneId, patch, scenePlan);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Lấy trạng thái hiện tại của Builder (Builder Status)
app.get("/api/v5/builder/status", (req, res) => {
  try {
    const builder = getGlobalSceneBuilder();
    const statuses = {};
    for (const [id, st] of builder.sceneStatuses.entries()) {
      statuses[id] = st;
    }
    res.json({
      success: true,
      compiledSceneCount: builder.compiledScenes.size,
      lockedSceneCount: builder.lockedScenes.size,
      statuses
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Xuất sang Tab 2 (Export Project to Tab 2)
app.post("/api/v5/builder/export-tab2", (req, res) => {
  try {
    const { projectId = "v5_auto_project", projectData } = req.body;
    const safeId = path.basename(projectId).replace(/[^a-zA-Z0-9_-]/g, "");
    const targetDir = path.resolve(projectRoot, "imported_projects", safeId);
    fs.mkdirSync(targetDir, { recursive: true });

    const configPath = path.join(targetDir, "config.json");
    fs.writeFileSync(configPath, JSON.stringify(projectData || {}, null, 2), "utf-8");

    res.json({
      success: true,
      message: `Đã xuất dự án thành công sang Tab 2 tại imported_projects/${safeId}`,
      projectId: safeId,
      configPath
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// THANH HAI 2D STUDIO V5 — PHASE 5 PRODUCTION PIPELINE ENDPOINTS
// =========================================================================
import { defaultOrchestrator, PRODUCTION_MODES, PRODUCTION_STATES } from "../thanhhai-2d-studio/engine/v5-production-orchestrator.js";
import { defaultJobManager } from "../thanhhai-2d-studio/engine/v5-production-job-manager.js";
import { defaultQaEngine } from "../thanhhai-2d-studio/engine/v5-technical-qa-engine.js";
import { defaultRenderCache, SCENE_APPROVAL_STATUS } from "../thanhhai-2d-studio/engine/v5-render-engine.js";
import { defaultFfmpegAssembler } from "../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js";
import { defaultAiDirectorPackage } from "../thanhhai-2d-studio/engine/v5-ai-director-package.js";
import { defaultProjectManager } from "../thanhhai-2d-studio/engine/v5-project-manager.js";

// 1. One-Click Production Orchestrator (Run Mode A / B / C)
app.post("/api/v5/production/orchestrate", async (req, res) => {
  try {
    const { projectData, mode = PRODUCTION_MODES.MODE_B_FULL_AUTO, options = {} } = req.body;
    const result = await defaultOrchestrator.produceVideo(projectData || {}, mode, options);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Production Job Status & Logs
app.get("/api/v5/production/job-status/:jobId", (req, res) => {
  try {
    const job = defaultJobManager.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, error: "Không tìm thấy Job ID." });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Pause Job
app.post("/api/v5/production/pause/:jobId", (req, res) => {
  try {
    const job = defaultJobManager.pauseJob(req.params.jobId);
    res.json({ success: !!job, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Resume Job
app.post("/api/v5/production/resume/:jobId", (req, res) => {
  try {
    const job = defaultJobManager.resumeJob(req.params.jobId);
    res.json({ success: !!job, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Cancel Job
app.post("/api/v5/production/cancel/:jobId", (req, res) => {
  try {
    const job = defaultJobManager.cancelJob(req.params.jobId, req.body.reason);
    res.json({ success: !!job, job });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Technical QA & Safe Repair
app.post("/api/v5/production/qa", (req, res) => {
  try {
    const { projectData = {}, autoRepair = false } = req.body;
    let qaResult = defaultQaEngine.validateProject(projectData);
    let repairResult = null;

    if (autoRepair) {
      repairResult = defaultQaEngine.autoRepairSafeIssues(projectData);
      qaResult = defaultQaEngine.validateProject(projectData);
    }

    res.json({ success: true, qaResult, repairResult });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Hardware Capabilities Detection
app.get("/api/v5/production/hardware", (req, res) => {
  try {
    const hw = defaultFfmpegAssembler.detectHardwareCapabilities();
    res.json({ success: true, hardware: hw });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Scene Approval & Lock Workflow
app.post("/api/v5/production/lock-scene", (req, res) => {
  try {
    const { sceneId, status = SCENE_APPROVAL_STATUS.LOCKED, notes = "" } = req.body;
    defaultRenderCache.setApprovalStatus(sceneId, status, notes);
    res.json({ success: true, sceneId, status, notes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Incremental Scene Repair Exporter & Importer
app.post("/api/v5/production/export-repair-package", (req, res) => {
  try {
    const { scene, compiledScene, animTrack, userFeedback } = req.body;
    const pkg = defaultAiDirectorPackage.exportSceneRepairPackage(scene, compiledScene, animTrack, userFeedback);
    res.json({ success: true, repairPackage: pkg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Merge Multi-batch Scene Plans
app.post("/api/v5/production/merge-batches", (req, res) => {
  try {
    const { batches = [] } = req.body;
    const merged = defaultAiDirectorPackage.mergeScenePlanBatches(batches);
    res.json(merged);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. Projects List, Create & Save
app.get("/api/v5/production/projects", (req, res) => {
  try {
    const projects = defaultProjectManager.listProjects();
    res.json({ success: true, projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/v5/production/projects/create", (req, res) => {
  try {
    const { name, options } = req.body;
    const project = defaultProjectManager.createProject(name, options);
    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/v5/production/projects/save", (req, res) => {
  try {
    const { project } = req.body;
    defaultProjectManager.saveProjectAtomic(project);
    res.json({ success: true, projectId: project.id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Đảm bảo mọi request /api/* không tìm thấy luôn trả về JSON
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
      console.log(`🎨 Thanh Hai 2D Studio Local Server sẵn sàng tại: ${url}`);
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
