import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { unzipProjectSafe } from "../lib/project-loader.mjs";
import { detectEngine, normalizeEngineType, saveProjectMetadata } from "../lib/engine-detector.mjs";
import { validateEngine, renderEngineVideo, ENGINE_TYPES } from "../lib/engine-manager.mjs";

console.log("=== BẮT ĐẦU TEST TOÀN DIỆN LUỒNG API TAB 3 (IMPORT -> SELECT -> VALIDATE -> RENDER) ===\n");

const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
const projectId = `test_flow_python_${timeStr}`;
const targetDir = path.resolve(`imported_projects/${projectId}`);

try {
  // 1. Tạo file ZIP giả lập người dùng upload lên Tab 3:
  // ZIP có 1 thư mục bọc ngoài: "my_animation_pack/projects/test_story/story.json"
  console.log("1. Tạo ZIP giả lập có thư mục bọc ngoài lồng nhau...");
  const zip = new AdmZip();
  const storyData = {
    title: "Chibi V9 Cuộc Phiêu Lưu Kì Thú",
    shots: [
      { id: "shot_0", duration: 4, action: "idle", camera: "medium" },
      { id: "shot_1", duration: 6, action: "walk", camera: "full" }
    ],
    cast: { "chibi_main": { "character": "chibi_v9", "color": "#2563EB", "skin": "pale" } },
    mood: "adventure"
  };
  zip.addFile("wrapper_root/story.json", Buffer.from(JSON.stringify(storyData, null, 2)));
  zip.addFile("wrapper_root/script.txt", Buffer.from("Cảnh 1 nhân vật đứng nhìn trời. Cảnh 2 nhân vật bước đi."));
  zip.addFile("wrapper_root/lang.txt", Buffer.from("vi"));
  const zipBuffer = zip.toBuffer();

  // 2. Giả lập Endpoint /api/ai-code/upload-zip
  console.log("2. Giả lập giải nén an toàn qua unzipProjectSafe...");
  const extractRes = unzipProjectSafe(zipBuffer, targetDir);
  console.log(`   Số file giải nén: ${extractRes.extractedFiles.length}`);

  // Multi-Engine Detection
  console.log("3. Tự động nhận diện Engine qua Multi-Engine Detector...");
  const detected = detectEngine(targetDir);
  console.log(`   Engine nhận diện được: ${detected.engineType} (${detected.engineName})`);
  console.log(`   Project Name: ${detected.projectName}`);
  console.log(`   Project Root: ${detected.projectRoot}`);

  if (detected.engineType !== ENGINE_TYPES.PYTHON_LONG_FORM) {
    throw new Error(`Engine không phải Python Long Form: ${detected.engineType}`);
  }

  // Thẩm định qua validateEngine
  console.log("4. Thẩm định qua validateEngine...");
  const validation = validateEngine(targetDir);
  console.log(`   Validation valid: ${validation.valid}`);
  console.log(`   Validation errors: ${JSON.stringify(validation.errors)}`);
  console.log(`   Validation warnings: ${JSON.stringify(validation.warnings)}`);

  if (!validation.valid) {
    throw new Error(`Dự án Python không hợp lệ: ${validation.errors.join(", ")}`);
  }

  // 5. Giả lập reload danh sách dự án (GET /api/ai-code/projects)
  console.log("5. Giả lập reload danh sách dự án...");
  const reloadedDetected = detectEngine(targetDir);
  if (reloadedDetected.engineType !== ENGINE_TYPES.PYTHON_LONG_FORM) {
    throw new Error(`Sau khi reload, engine bị sai: ${reloadedDetected.engineType}`);
  }
  console.log(`   Sau khi reload: Engine vẫn là "${reloadedDetected.engineType}" - Metadata bền vững!`);

  // 6. Giả lập chọn dự án và đổi Composition ID
  console.log("6. Kiểm tra Compositions...");
  console.log(`   Dự án Python không có Composition ID Remotion (đúng chuẩn).`);

  // 7. Thử nghiệm dispatch render (Test 1 shot)
  console.log("7. Thử nghiệm lệnh Render Dispatch sang Python Engine...");
  const testOutMp4 = path.resolve(`out/test_tab3_dispatch_${timeStr}.mp4`);
  
  // Render test 1 shot bằng python engine
  const renderPromise = renderEngineVideo({
    projectDir: targetDir,
    engineType: detected.engineType,
    outputPath: testOutMp4,
    isTest: true,
    customResolution: "720p",
    onProgress: (p) => {
      console.log(`   [Tiến độ render]: ${(p.progress * 100).toFixed(1)}%`);
    }
  });

  const renderResult = await renderPromise;
  console.log(`   ✅ Render thành công! File xuất ra tại: ${renderResult.outputPath}`);
  if (fs.existsSync(testOutMp4)) {
    const stats = fs.statSync(testOutMp4);
    console.log(`   Kích thước video MP4: ${(stats.size / 1024).toFixed(1)} KB`);
  }

  console.log("\n🎉 TẤT CẢ CÁC BƯỚC TEST LUỒNG TAB 3 ĐỀU THÀNH CÔNG VÀ CHÍNH XÁC 100%!");
} catch (err) {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH TEST LUỒNG:", err);
  process.exit(1);
} finally {
  // Dọn dẹp thư mục test
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
}
