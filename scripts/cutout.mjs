/**
 * Script CLI: Xóa nền trắng nhân vật
 * Đọc mọi ảnh trong raw/characters/ (PNG/JPG) -> tạo PNG trong suốt trong public/characters/
 */

import fs from "fs";
import path from "path";
import { processCutoutImage } from "../lib/cutout-core.mjs";

async function main() {
  const projectRoot = process.cwd();
  const rawDir = path.join(projectRoot, "raw/characters");
  const publicDir = path.join(projectRoot, "public/characters");

  if (!fs.existsSync(rawDir)) {
    console.error(`❌ Thư mục không tồn tại: ${rawDir}`);
    process.exit(1);
  }

  // Đọc danh sách file trong raw/characters/
  const files = fs
    .readdirSync(rawDir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

  if (files.length === 0) {
    console.log(`ℹ️ Không có file ảnh nào trong ${rawDir}`);
    return;
  }

  // Đọc tham số threshold nếu có (vd: node scripts/cutout.mjs --threshold=240)
  const thresholdArg = process.argv.find((a) => a.startsWith("--threshold="));
  const threshold = thresholdArg ? parseInt(thresholdArg.split("=")[1], 10) : 235;

  console.log(`🚀 Bắt đầu xóa nền ${files.length} ảnh (ngưỡng trắng: ${threshold})...\n`);

  for (const file of files) {
    const inputPath = path.join(rawDir, file);
    // Xuất ra tên file đuôi .png
    const outName = path.parse(file).name + ".png";
    const outputPath = path.join(publicDir, outName);

    try {
      const res = await processCutoutImage(inputPath, outputPath, { threshold });
      console.log(`✅ [${res.filename}] Kích thước gốc: ${res.origWidth}x${res.origHeight} -> Sau khi cắt: ${res.newWidth}x${res.newHeight}`);
    } catch (err) {
      console.error(`❌ Lỗi khi xử lý ${file}:`, err.message);
    }
  }

  console.log(`\n🎉 Hoàn thành! Các file PNG trong suốt đã được lưu vào public/characters/`);
}

main().catch((err) => {
  console.error("Lỗi:", err);
  process.exit(1);
});

