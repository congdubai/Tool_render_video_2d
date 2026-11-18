/**
 * Script CLI: Dựng video hoàn chỉnh hoặc dựng thử 10 giây
 * Lệnh: npm run render
 * Dựng thử 10s: npm run render:test
 */

import fs from "fs";
import path from "path";
import { renderVideo } from "../lib/render.mjs";

async function main() {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "src/data/script.json");
  const timelinePath = path.join(projectRoot, "src/data/timeline.json");
  const scenesPath = path.join(projectRoot, "src/data/scenes.json");

  // Kiểm tra file dữ liệu
  if (!fs.existsSync(timelinePath) || !fs.existsSync(scenesPath)) {
    console.error("❌ Thiếu dữ liệu để dựng video!");
    if (!fs.existsSync(timelinePath)) console.error("  • Chưa có src/data/timeline.json (Hãy chạy: npm run voice)");
    if (!fs.existsSync(scenesPath)) console.error("  • Chưa có src/data/scenes.json");
    process.exit(1);
  }

  const scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
  const timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
  const scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));

  // Đọc cờ --test (dựng thử 10 giây đầu)
  const isTest = process.argv.includes("--test");
  const fps = scriptData.meta?.fps || 30;
  const frameRange = isTest ? [0, Math.min(10 * fps, Math.round(timelineData.totalSeconds * fps) - 1)] : null;

  // Đọc cờ --gpu nếu có
  let accelerationMode = "cpu";
  if (process.argv.includes("--gpu=nvenc")) accelerationMode = "gpu_nvenc";
  if (process.argv.includes("--gpu=angle")) accelerationMode = "gpu_angle";

  console.log(`🎬 Bắt đầu dựng video: ${isTest ? "Bản dựng thử 10 giây" : "Bản đầy đủ"}`);
  console.log(`⚙️ Chế độ xử lý: ${accelerationMode.toUpperCase()}`);

  const res = await renderVideo({
    scriptData,
    timelineData,
    scenesData,
    projectRoot,
    accelerationMode,
    frameRange,
    onProgress: (p) => {
      const pct = Math.round(p.progress * 100);
      const remainingSec = p.timeRemainingInMilliseconds
        ? `${Math.round(p.timeRemainingInMilliseconds / 1000)}s`
        : "...";
      process.stdout.write(`\r⏳ Tiến độ: ${pct}% | Khung hình: ${p.renderedFrames}/${p.totalFrames} | Còn lại: ~${remainingSec}   `);
    }
  });

  console.log(`\n\n🎉 Dựng video thành công trong ${res.executionTimeSec}s!`);
  console.log(`📁 File kết xuất: ${res.outputPath}`);
  if (res.fallbackUsed) {
    console.log(`⚠️ Lưu ý: Quá trình dựng đã tự động quay về CPU do: ${res.fallbackReason}`);
  }
}

main().catch((err) => {
  console.error(`\n❌ Lỗi khi dựng video:`, err.message);
  process.exit(1);
});

