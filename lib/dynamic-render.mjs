/**
 * Module kết xuất video cho các dự án Remotion động do AI tạo ra (Dynamic Remotion Project Renderer)
 * Hỗ trợ bundle dự án độc lập, xem trước từng Frame (renderStill) và kết xuất video đầy đủ (renderMedia)
 */

import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition, getCompositions } from "@remotion/renderer";
import { getRenderAccelerationConfig } from "./gpu.mjs";
import { getAvailablePort } from "./render.mjs";
import { validateProject, detectProjectConfig } from "./project-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TOOL_ROOT = path.resolve(__dirname, "..");
const TOOL_NODE_MODULES = path.join(TOOL_ROOT, "node_modules");
const ANIMATION_LIB_ENTRY = path.join(TOOL_ROOT, "src", "animation", "index.ts");

const dynamicBundleCache = new Map();

/**
 * Đóng gói (bundle) dự án Remotion độc lập
 * @param {object} params
 * @param {string} params.projectDir
 * @param {string} params.entryPoint
 * @param {boolean} [params.forceRebundle=false]
 * @returns {Promise<string>} bundleLocation
 */
export async function bundleDynamicProject({ projectDir, entryPoint, forceRebundle = false }) {
  const cacheKey = `${projectDir}::${entryPoint}`;
  const now = Date.now();

  if (!forceRebundle && dynamicBundleCache.has(cacheKey)) {
    const cached = dynamicBundleCache.get(cacheKey);
    if (now - cached.time < 15 * 60 * 1000 && fs.existsSync(cached.location)) {
      return cached.location;
    }
  }

  const absEntryPoint = path.resolve(projectDir, entryPoint);
  if (!fs.existsSync(absEntryPoint)) {
    throw new Error(`Không tìm thấy file entrypoint tại: ${absEntryPoint}`);
  }

  const publicDir = path.join(projectDir, "public");
  const toolNodeModules = path.join(process.cwd(), "node_modules");

  const bundleOptions = {
    entryPoint: absEntryPoint,
    rootDir: projectDir,
    publicDir: fs.existsSync(publicDir) ? publicDir : undefined,
    webpackOverride: (currentConfig) => {
      // Đảm bảo webpack resolve node_modules từ tool chính
      const existingModules = currentConfig.resolve?.modules || [];
      const existingAlias = currentConfig.resolve?.alias || {};

      return {
        ...currentConfig,
        resolve: {
          ...currentConfig.resolve,
          modules: [
            TOOL_NODE_MODULES,
            path.join(projectDir, "node_modules"),
            ...existingModules
          ],
          alias: {
            ...existingAlias,
            // Đảm bảo không bị xung đột multiple React instances
            react: path.join(TOOL_NODE_MODULES, "react"),
            "react-dom": path.join(TOOL_NODE_MODULES, "react-dom"),
            "@animation": ANIMATION_LIB_ENTRY
          }
        }
      };
    }
  };

  const bundleLocation = await bundle(bundleOptions);

  dynamicBundleCache.set(cacheKey, {
    location: bundleLocation,
    time: now
  });

  return bundleLocation;
}

/**
 * Đọc danh sách composition thực tế từ Remotion bundler
 * @param {object} params
 * @param {string} params.projectDir
 * @param {string} [params.entryPoint]
 * @param {boolean} [params.forceRebundle=false]
 * @returns {Promise<Array<{ id: string, width: number, height: number, fps: number, durationInFrames: number }>>}
 */
export async function getProjectCompositions({
  projectDir,
  entryPoint = null,
  forceRebundle = false
}) {
  const finalConfig = detectProjectConfig(projectDir);
  const ep = entryPoint || finalConfig.entryPoint || "src/index.ts";

  const bundleLocation = await bundleDynamicProject({
    projectDir,
    entryPoint: ep,
    forceRebundle
  });

  const renderPort = await getAvailablePort(8700 + Math.floor(Math.random() * 200));
  const comps = await getCompositions(bundleLocation, {
    port: renderPort
  });

  return comps.map((c) => ({
    id: c.id,
    width: c.width,
    height: c.height,
    fps: c.fps,
    durationInFrames: c.durationInFrames
  }));
}

/**
 * Chụp nhanh 1 frame tĩnh chất lượng cao từ dự án (Frame Inspector / Preview Frame)
 * @param {object} params
 * @param {string} params.projectDir
 * @param {object} [params.config]
 * @param {string} [params.compositionId]
 * @param {number} [params.frame=0]
 * @param {string} [params.outputPath]
 * @returns {Promise<{ framePath: string, frame: number, width: number, height: number, compositionId: string }>}
 */
export async function renderDynamicStill({
  projectDir,
  config = null,
  compositionId = null,
  frame = 0,
  outputPath = null
}) {
  const finalConfig = config || detectProjectConfig(projectDir);
  const bundleLocation = await bundleDynamicProject({
    projectDir,
    entryPoint: finalConfig.entryPoint,
    forceRebundle: false
  });

  const renderPort = await getAvailablePort(8700 + Math.floor(Math.random() * 200));

  // Đọc danh sách composition thực tế từ Remotion
  const actualComps = await getCompositions(bundleLocation, { port: renderPort });
  let targetCompId = compositionId || finalConfig.compositionId;

  const matched = actualComps.find((c) => c.id === targetCompId);
  if (!matched) {
    if (actualComps.length === 1) {
      // Tự động dùng composition duy nhất thực tế
      targetCompId = actualComps[0].id;
    } else if (actualComps.length > 1) {
      throw new Error(
        `Không tìm thấy composition "${targetCompId}". Dự án có ${actualComps.length} compositions: [${actualComps.map((c) => c.id).join(", ")}]`
      );
    } else {
      throw new Error("Dự án Remotion không đăng ký bất kỳ Composition nào.");
    }
  }

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: targetCompId,
    port: renderPort
  });

  const safeFrame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round(frame)));

  const previewsDir = path.join(process.cwd(), "out/previews");
  fs.mkdirSync(previewsDir, { recursive: true });

  const finalOutputPath =
    outputPath ||
    path.join(previewsDir, `preview_${path.basename(projectDir)}_frame_${safeFrame}.png`);

  await renderStill({
    composition,
    serveUrl: bundleLocation,
    output: finalOutputPath,
    frame: safeFrame,
    imageFormat: "png",
    port: renderPort
  });

  return {
    framePath: finalOutputPath,
    frame: safeFrame,
    width: composition.width,
    height: composition.height,
    compositionId: targetCompId
  };
}

/**
 * Kết xuất video hoàn chỉnh từ dự án Remotion do AI tạo ra
 * @param {object} params
 * @param {string} params.projectDir
 * @param {object} [params.config]
 * @param {string} [params.compositionId]
 * @param {string} [params.outputPath]
 * @param {'cpu' | 'gpu_nvenc' | 'gpu_angle'} [params.accelerationMode='cpu']
 * @param {number} [params.concurrency]
 * @param {[number, number]} [params.frameRange]
 * @param {(p: { progress: number, renderedFrames: number, totalFrames: number, timeRemainingInMilliseconds: number | null }) => void} [params.onProgress]
 * @param {() => boolean} [params.checkCanceled]
 * @returns {Promise<{ outputPath: string, durationSec: number, executionTimeSec: number, hardwareAccelerated: boolean, fallbackUsed: boolean, compositionId: string }>}
 */
export async function renderDynamicVideo({
  projectDir,
  config = null,
  compositionId = null,
  outputPath = null,
  accelerationMode = "cpu",
  concurrency = null,
  frameRange = null,
  onProgress = null,
  checkCanceled = null
}) {
  // 1. Kiểm tra tính hợp lệ của project trước khi dựng
  const validation = validateProject(projectDir);
  if (!validation.valid) {
    throw new Error(
      `Dự án không hợp lệ để render:\n${validation.errors.map((e) => `• ${e}`).join("\n")}`
    );
  }

  const finalConfig = config || validation.config;

  const defaultVideoName = `${path.basename(projectDir)}.mp4`;
  const finalOutputPath = outputPath || path.join(process.cwd(), "out", defaultVideoName);
  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });

  // 2. Tính số luồng xử lý
  const defaultConcurrency = Math.min(Math.max(1, os.cpus().length - 1), 4);
  const finalConcurrency = concurrency || defaultConcurrency;

  // 3. Đóng gói mã nguồn (Bundle)
  const bundleLocation = await bundleDynamicProject({
    projectDir,
    entryPoint: finalConfig.entryPoint,
    forceRebundle: true
  });

  // 4. Chọn Composition sau khi đối chiếu với danh sách thực tế của Remotion
  const renderPort = await getAvailablePort(8700 + Math.floor(Math.random() * 200));

  const actualComps = await getCompositions(bundleLocation, { port: renderPort });
  let targetCompId = compositionId || finalConfig.compositionId;

  const matched = actualComps.find((c) => c.id === targetCompId);
  if (!matched) {
    if (actualComps.length === 1) {
      // Tự động chọn composition duy nhất
      targetCompId = actualComps[0].id;
    } else if (actualComps.length > 1) {
      throw new Error(
        `Không tìm thấy composition "${targetCompId}". Dự án có ${actualComps.length} compositions thực tế: [${actualComps.map((c) => c.id).join(", ")}]. Vui lòng chọn một composition hợp lệ.`
      );
    } else {
      throw new Error("Dự án Remotion không đăng ký bất kỳ Composition nào trong Root.tsx.");
    }
  }

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: targetCompId,
    port: renderPort
  });

  const totalFrames = composition.durationInFrames;
  let renderFrameRange = frameRange;
  if (!renderFrameRange) {
    renderFrameRange = [0, totalFrames - 1];
  } else {
    renderFrameRange = [
      Math.max(0, renderFrameRange[0]),
      Math.min(totalFrames - 1, renderFrameRange[1])
    ];
  }

  const startTime = Date.now();
  let fallbackUsed = false;
  let fallbackReason = "";

  const runRender = async (mode) => {
    const accelConfig = getRenderAccelerationConfig(mode);
    const renderOptions = {
      composition,
      serveUrl: bundleLocation,
      outputLocation: finalOutputPath,
      inputProps: {},
      codec: "h264",
      port: renderPort,
      frameRange: renderFrameRange,
      concurrency: finalConcurrency,
      overwrite: true,
      chromiumOptions: accelConfig.chromiumOptions,
      ...accelConfig.renderMediaOptions,
      onProgress: (p) => {
        if (checkCanceled && checkCanceled()) {
          throw new Error("RENDER_CANCELED_BY_USER");
        }
        if (onProgress) {
          onProgress({
            renderedFrames: p.renderedFrames,
            totalFrames: p.totalFrames,
            progress: p.progress,
            timeRemainingInMilliseconds: p.timeRemainingInMilliseconds
          });
        }
      }
    };

    return await renderMedia(renderOptions);
  };

  try {
    await runRender(accelerationMode);
  } catch (err) {
    if (err.message === "RENDER_CANCELED_BY_USER") {
      throw err;
    }

    // Nếu đang dùng GPU mà gặp lỗi mã hóa, tự động fallback về CPU
    if (accelerationMode !== "cpu") {
      console.warn(`[DynamicRender] GPU render gặp sự cố (${err.message}). Tự động Fallback sang CPU render...`);
      fallbackUsed = true;
      fallbackReason = err.message;
      await runRender("cpu");
    } else {
      throw err;
    }
  }

  // 5. Kiểm tra tính toàn vẹn của file MP4 đầu ra (Output Verification)
  if (!fs.existsSync(finalOutputPath)) {
    throw new Error(`File video đầu ra không tồn tại: ${finalOutputPath}`);
  }

  const stat = fs.statSync(finalOutputPath);
  if (stat.size < 1024) {
    throw new Error(`File video đầu ra bị lỗi (kích thước quá nhỏ: ${stat.size} bytes).`);
  }

  const executionTimeSec = Math.round((Date.now() - startTime) / 1000);
  const frameCount = renderFrameRange[1] - renderFrameRange[0] + 1;
  const durationSec = Math.round(frameCount / composition.fps);

  return {
    outputPath: finalOutputPath,
    durationSec,
    executionTimeSec,
    hardwareAccelerated: accelerationMode !== "cpu" && !fallbackUsed,
    fallbackUsed,
    fallbackReason
  };
}

