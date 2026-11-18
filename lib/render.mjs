/**
 * Module kết xuất video bằng Remotion Bundler & Renderer
 * Tự động hỗ trợ tăng tốc GPU (NVENC/ANGLE) với cơ chế tự phục hồi (Fallback) về CPU khi gặp lỗi
 */

import path from "path";
import fs from "fs";
import os from "os";
import net from "net";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getRenderAccelerationConfig } from "./gpu.mjs";
import { validateAllData } from "./validate.mjs";

let cachedBundleLocation = null;
let lastBundleTime = 0;

/**
 * Tìm cổng mạng trống khả dụng (tránh xa dải 3000-3010 vốn hay bị Windows khóa EACCES)
 * @param {number} startPort Cổng bắt đầu tìm (mặc định 8500)
 * @returns {Promise<number>}
 */
export function getAvailablePort(startPort = 8500) {
  return new Promise((resolve, reject) => {
    let port = startPort;
    const testPort = (p) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => {
        if (p < startPort + 200) {
          testPort(p + 1);
        } else {
          reject(new Error("Không tìm thấy cổng trống trong dải " + startPort));
        }
      });
      server.listen(p, "127.0.0.1", () => {
        server.close(() => {
          resolve(p);
        });
      });
    };
    testPort(port);
  });
}

/**
 * Đóng gói (bundle) dự án Remotion, có cache thông minh để render nhanh hơn
 * @param {string} projectRoot
 * @param {boolean} forceRebundle Ép buộc gói lại (ví dụ khi thêm ảnh mới)
 * @returns {Promise<string>} Đường dẫn bundle location
 */
export async function getRemotionBundle(projectRoot = process.cwd(), forceRebundle = false) {
  const entryPoint = path.join(projectRoot, "src/index.ts");
  const now = Date.now();

  // Tái sử dụng bundle nếu chưa quá 10 phút và không bị ép rebundle
  if (!forceRebundle && cachedBundleLocation && now - lastBundleTime < 10 * 60 * 1000) {
    if (fs.existsSync(cachedBundleLocation)) {
      return cachedBundleLocation;
    }
  }

  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config
  });

  cachedBundleLocation = bundleLocation;
  lastBundleTime = now;
  return bundleLocation;
}

/**
 * Render video chính với đầy đủ tùy chọn và cơ chế CPU Fallback
 * @param {object} params
 * @param {import('../src/types.js').ScriptData} params.scriptData
 * @param {import('../src/types.js').TimelineData} params.timelineData
 * @param {import('../src/types.js').ScenesData} params.scenesData
 * @param {string} [params.outputPath]
 * @param {string} [params.projectRoot]
 * @param {'cpu' | 'gpu_nvenc' | 'gpu_angle'} [params.accelerationMode='cpu']
 * @param {[number, number]} [params.frameRange] Khoảng frame render (ví dụ dựng thử 10s: [0, 300])
 * @param {number} [params.concurrency] Số luồng song song
 * @param {boolean} [params.forceRebundle=true]
 * @param {(progress: { renderedFrames: number, totalFrames: number, progress: number, timeRemainingInMilliseconds: number | null }) => void} [params.onProgress]
 * @param {() => boolean} [params.checkCanceled] Hàm kiểm tra xem người dùng có bấm Hủy không
 * @returns {Promise<{ outputPath: string, executionTimeSec: number, hardwareAccelerated: boolean, fallbackUsed: boolean, fallbackReason?: string }>}
 */
export async function renderVideo({
  scriptData,
  timelineData,
  scenesData,
  outputPath = null,
  projectRoot = process.cwd(),
  accelerationMode = "cpu",
  frameRange = null,
  concurrency = null,
  forceRebundle = true,
  onProgress = null,
  checkCanceled = null
}) {
  // 1. Kiểm tra dữ liệu đầu vào trước khi render
  const validation = validateAllData({ scriptData, timelineData, scenesData, projectRoot });
  if (!validation.valid) {
    throw new Error(
      `Không thể dựng video vì dữ liệu chưa hợp lệ:\n${validation.errors.map((e) => `• ${e}`).join("\n")}`
    );
  }

  const finalOutputPath = outputPath || path.join(projectRoot, "out/video.mp4");
  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });

  // 2. Tính số luồng an toàn cho RAM 20GB (mặc định thấp hơn số nhân CPU 1 đơn vị, tối đa 4)
  const defaultConcurrency = Math.min(Math.max(1, os.cpus().length - 1), 4);
  const finalConcurrency = concurrency || defaultConcurrency;

  // 3. Chuẩn bị Bundle
  const bundleLocation = await getRemotionBundle(projectRoot, forceRebundle);

  // 4. Lấy composition Video2D (dùng cổng riêng biệt để tránh lỗi Tried 10 times to find a free port)
  const inputProps = {
    scriptData,
    timelineData,
    scenesData
  };

  const renderPort = await getAvailablePort(8500 + Math.floor(Math.random() * 200));

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "Video2D",
    inputProps,
    port: renderPort
  });

  // Xác định khoảng khung hình render
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

  // 5. Thử render với chế độ được yêu cầu
  const startTime = Date.now();
  let fallbackUsed = false;
  let fallbackReason = null;
  let hardwareAccelerated = false;

  const tryRenderWithConfig = async (mode) => {
    const accelConfig = getRenderAccelerationConfig(mode);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: finalOutputPath,
      inputProps,
      frameRange: renderFrameRange,
      concurrency: finalConcurrency,
      hardwareAcceleration: accelConfig.hardwareAcceleration,
      chromiumOptions: accelConfig.chromiumOptions,
      port: renderPort,
      onProgress: (p) => {
        if (checkCanceled && checkCanceled()) {
          throw new Error("Người dùng đã hủy quá trình dựng video.");
        }
        if (onProgress) {
          onProgress(p);
        }
      },
      logLevel: "verbose"
    });

    return mode !== "cpu";
  };

  try {
    hardwareAccelerated = await tryRenderWithConfig(accelerationMode);
  } catch (err) {
    // Nếu người dùng chủ động hủy, không fallback mà ném lỗi ra luôn
    if (err.message && err.message.includes("đã hủy")) {
      throw err;
    }

    // Nếu đang chạy GPU mà gặp lỗi -> Tự động Fallback về CPU!
    if (accelerationMode !== "cpu") {
      fallbackUsed = true;
      fallbackReason = err.message || "Lỗi bộ tăng tốc GPU hoặc driver";
      console.warn(`⚠️ [GPU Fallback] Lỗi khi dựng bằng ${accelerationMode}: ${fallbackReason}`);
      console.warn(`🔄 Đang tự động chuyển sang chế độ CPU tiêu chuẩn (libx264)...`);

      // Thử lại với CPU thuần túy
      await tryRenderWithConfig("cpu");
      hardwareAccelerated = false;
    } else {
      throw err;
    }
  }

  const executionTimeSec = Number(((Date.now() - startTime) / 1000).toFixed(1));

  return {
    outputPath: finalOutputPath,
    executionTimeSec,
    hardwareAccelerated,
    fallbackUsed,
    fallbackReason
  };
}

