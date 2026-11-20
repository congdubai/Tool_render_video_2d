import fs from "node:fs";
import path from "node:path";
import { unzipProjectSafe, detectProjectConfig, validateProject } from "../lib/project-loader.mjs";
import { getProjectCompositions, renderDynamicStill } from "../lib/dynamic-render.mjs";

async function main() {
  console.log("=== KIỂM THỬ IMPORT FILE ZIP CHIBI ENGINE VÀO TAB 3 ===");
  const zipPath = path.resolve("./sample-projects/chibi-engine-demo-10s.zip");
  if (!fs.existsSync(zipPath)) throw new Error("Chưa có file zip!");

  // Giả lập luồng upload-zip của server
  const importedDir = path.resolve("./imported_projects");
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const targetDir = path.join(importedDir, `chibi_demo_test_import_${timeStr}`);

  console.log("1. Giải nén an toàn file ZIP vào:", targetDir);
  const extractResult = unzipProjectSafe(zipPath, targetDir);
  console.log("Số file giải nén:", extractResult.extractedFiles.length);

  console.log("2. Tự động nhận diện cấu hình project...");
  const config = detectProjectConfig(targetDir);
  console.log("Detected config:", {
    compositionId: config.compositionId,
    fps: config.fps,
    width: config.width,
    height: config.height,
    durationInFrames: config.durationInFrames
  });

  if (config.compositionId !== "ChibiEngineDemo10s") {
    throw new Error(`Expected ChibiEngineDemo10s, got ${config.compositionId}`);
  }

  console.log("3. Đọc compositions qua Remotion runtime...");
  const comps = await getProjectCompositions({ projectDir: targetDir });
  console.log("Dynamic compositions:", comps);
  if (!comps.some(c => c.id === "ChibiEngineDemo10s")) {
    throw new Error("Missing ChibiEngineDemo10s in dynamic compositions!");
  }

  console.log("4. Thẩm định dự án (Validation)...");
  const val = validateProject(targetDir);
  console.log("Valid:", val.valid, "Compositions:", val.compositions);

  console.log("5. Chụp 1 frame từ dự án vừa import...");
  const stillPath = path.resolve("./output_videos/test_imported_chibi_frame.png");
  await renderDynamicStill({
    projectDir: targetDir,
    frame: 100,
    compositionId: "ChibiEngineDemo10s",
    outputPath: stillPath
  });
  console.log("✅ Frame đã chụp thành công:", stillPath, "Size:", fs.statSync(stillPath).size);

  // Dọn dẹp thư mục test import
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.rmSync(stillPath, { force: true });
  console.log("✅ Đã dọn dẹp thư mục test import tạm thời.");

  console.log("\n=== KIỂM THỬ IMPORT ZIP THÀNH CÔNG 100%! ===");
}

main().catch(err => {
  console.error("❌ Thất bại:", err);
  process.exit(1);
});

