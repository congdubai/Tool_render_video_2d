/**
 * Script CLI & Module: Đo thử tốc độ dựng video 5 giây đầu (Benchmark) giữa CPU và GPU
 * Lệnh: npm run bench
 */

import fs from "fs";
import path from "path";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderMedia } from "@remotion/renderer";
import { detectGpu, getRenderAccelerationConfig } from "../lib/gpu.mjs";

export async function runBenchmark(projectRoot = process.cwd()) {
  const scriptPath = path.join(projectRoot, "src/data/script.json");
  const timelinePath = path.join(projectRoot, "src/data/timeline.json");
  const scenesPath = path.join(projectRoot, "src/data/scenes.json");

  if (!fs.existsSync(timelinePath) || !fs.existsSync(scenesPath)) {
    throw new Error("Cần có timeline.json và scenes.json trước khi đo tốc độ.");
  }

  const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
  const scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));

  const fps = scriptData.meta?.fps || 30;
  // Dựng 5 giây đầu (150 frames)
  const benchFrames = [0, 5 * fps - 1];

  const gpuInfo = await detectGpu();
  const testModes = ["cpu"];
  if (gpuInfo.hasNvidia) {
    testModes.push("gpu_nvenc");
    testModes.push("gpu_angle");
  }

  const benchDir = path.join(projectRoot, "out/bench");
  fs.mkdirSync(benchDir, { recursive: true });

  // 1. Bundle 1 lần duy nhất cho toàn bộ quá trình đo
  const entryPoint = path.join(projectRoot, "src/index.ts");
  const serveUrl = await bundle({ entryPoint });

  const inputProps = { scriptData, timelineData, scenesData };

  // 2. Select composition 1 lần duy nhất
  const composition = await selectComposition({
    serveUrl,
    id: "Video2D",
    inputProps,
    port: 5120
  });

  const results = [];

  for (let i = 0; i < testModes.length; i++) {
    const mode = testModes[i];
    const outPath = path.join(benchDir, `bench_${mode}.mp4`);
    const accelConfig = getRenderAccelerationConfig(mode);
    const assignedPort = 5130 + i * 10;

    const startTime = Date.now();
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: "h264",
        outputLocation: outPath,
        inputProps,
        frameRange: benchFrames,
        concurrency: 4,
        hardwareAcceleration: accelConfig.hardwareAcceleration,
        chromiumOptions: accelConfig.chromiumOptions,
        port: assignedPort
      });

      const seconds = Number(((Date.now() - startTime) / 1000).toFixed(1));
      results.push({
        mode,
        name:
          mode === "cpu"
            ? "CPU (Mặc định)"
            : mode === "gpu_nvenc"
            ? "GPU NVENC (Mã hóa phần cứng)"
            : "GPU NVENC + ANGLE (Mã hóa & vẽ GPU)",
        seconds,
        success: true
      });
    } catch (err) {
      results.push({
        mode,
        name: mode,
        seconds: 0,
        error: err.message,
        success: false
      });
    }

    // Nghỉ 500ms giữa các lần đo
    await new Promise((r) => setTimeout(r, 500));
  }

  const successfulResults = results.filter((r) => r.success);
  successfulResults.sort((a, b) => a.seconds - b.seconds);
  const bestMode = successfulResults[0] || null;

  return {
    gpuInfo,
    results,
    bestMode
  };
}

async function main() {
  console.log("⏱️ Bắt đầu đo thử tốc độ dựng 5 giây video với từng cấu hình...\n");
  const { results, bestMode } = await runBenchmark();

  console.log("================ KẾT QUẢ ĐO TỐC ĐỘ (5s) ================");
  for (const r of results) {
    if (r.success) {
      console.log(`• ${r.name.padEnd(38)}: ${r.seconds}s`);
    } else {
      console.log(`• ${r.name.padEnd(38)}: Thất bại (${r.error})`);
    }
  }
  console.log("========================================================");
  if (bestMode) {
    console.log(`\n💡 Gợi ý tối ưu: Cấu hình nhanh nhất là "${bestMode.name}" (${bestMode.seconds}s)!`);
  }
}

if (process.argv[1]?.endsWith("bench.mjs")) {
  main().catch((err) => {
    console.error("Lỗi đo tốc độ:", err);
    process.exit(1);
  });
}
