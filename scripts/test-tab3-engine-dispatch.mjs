import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { normalizeEngineType, detectEngine, saveProjectMetadata, loadProjectMetadata } from "../lib/engine-detector.mjs";
import { validateEngine, renderEngineVideo, ENGINE_TYPES } from "../lib/engine-manager.mjs";
import { unzipProjectSafe } from "../lib/project-loader.mjs";

console.log("=== BẮT ĐẦU KIỂM THỬ HỆ THỐNG ENGINE DISPATCH & VALIDATION TAB 3 ===\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
  }
}

// 1. Kiểm tra chuẩn hóa Engine Aliases
console.log("--- 1. Kiểm tra chuẩn hóa Engine Aliases ---");
assert(normalizeEngineType("python-longform") === ENGINE_TYPES.PYTHON_LONG_FORM, "Alias 'python-longform' chuẩn hóa thành 'python-2d-long-form'");
assert(normalizeEngineType("python_longform") === ENGINE_TYPES.PYTHON_LONG_FORM, "Alias 'python_longform' chuẩn hóa thành 'python-2d-long-form'");
assert(normalizeEngineType("python-2d-long-form") === ENGINE_TYPES.PYTHON_LONG_FORM, "Alias 'python-2d-long-form' chuẩn hóa đúng");
assert(normalizeEngineType("python") === ENGINE_TYPES.PYTHON_LONG_FORM, "Alias 'python' chuẩn hóa thành 'python-2d-long-form'");
assert(normalizeEngineType("remotion") === ENGINE_TYPES.REMOTION, "Alias 'remotion' chuẩn hóa thành 'remotion'");
assert(normalizeEngineType("thanhhai") === ENGINE_TYPES.THANH_HAI, "Alias 'thanhhai' chuẩn hóa thành 'thanhhai-2d-studio'");
assert(normalizeEngineType("unknown") === ENGINE_TYPES.UNKNOWN, "Alias 'unknown' chuẩn hóa thành 'unknown'");

// 2. Kiểm tra Dự án Python chuẩn (What If Chibi Demo)
console.log("\n--- 2. Kiểm tra Dự án Python chuẩn (What If Chibi Demo) ---");
const pySampleDir = path.resolve("sample-projects/whatif-1cm-chibi-demo-30s");
const pyVal = validateEngine(pySampleDir);
assert(pyVal.valid === true, "Dự án What If Python Long Form hợp lệ");
assert(pyVal.engine === ENGINE_TYPES.PYTHON_LONG_FORM, "Nhận diện đúng engine là python-2d-long-form");
assert(pyVal.errors.length === 0, "Không có lỗi Remotion nào (0 errors)");
assert(pyVal.config?.shotsCount === 4, "Đọc đúng 4 cảnh quay từ story.json");

// 3. Kiểm tra Dự án Remotion chuẩn (Chibi Engine Demo 10s)
console.log("\n--- 3. Kiểm tra Dự án Remotion chuẩn ---");
const rmSampleDir = path.resolve("sample-projects/chibi-engine-demo-10s");
const rmVal = validateEngine(rmSampleDir);
assert(rmVal.valid === true, "Dự án Remotion hợp lệ");
assert(rmVal.engine === ENGINE_TYPES.REMOTION, "Nhận diện đúng engine là remotion");
assert(rmVal.config?.entryPoint === "src/index.ts", "Remotion vẫn kiểm tra src/index.ts bình thường");
assert(rmVal.compositions?.length > 0, "Remotion có danh sách compositions thực tế");

// 4. Kiểm tra Dự án Python thiếu story.json (Trường hợp phát sinh lỗi trước đây)
console.log("\n--- 4. Kiểm tra Dự án Python dạng patch thiếu story.json ---");
const patchDir = path.resolve("imported_projects/python-2d-geometry-hand-hair-test_20261121_080846");
const patchVal = validateEngine(patchDir);
assert(patchVal.engine === ENGINE_TYPES.PYTHON_LONG_FORM, "Dự án có engine/render.py được nhận diện là python-2d-long-form");
assert(patchVal.valid === false, "Dự án thiếu story.json báo valid = false");
assert(!patchVal.errors.some(e => e.includes("src/index.ts")), "TUYỆT ĐỐI KHÔNG báo lỗi entrypoint src/index.ts");
assert(!patchVal.errors.some(e => e.includes("TypeScript/JavaScript")), "TUYỆT ĐỐI KHÔNG báo lỗi thư mục src/ thiếu file .ts/.tsx");
assert(patchVal.errors.some(e => e.includes("story.json")), "Báo đúng lỗi schema Python: thiếu 'story.json'");

// 5. Kiểm tra Dự án ZIP có thư mục bọc ngoài (Single root folder flattening)
console.log("\n--- 5. Kiểm tra ZIP có thư mục bọc ngoài lồng nhau ---");
const testZip = new AdmZip();
testZip.addFile("my_wrapped_folder/inner_folder/story.json", Buffer.from(JSON.stringify({
  title: "Test Wrapped Project",
  shots: [{ id: "shot_1", duration: 5, action: "idle" }],
  cast: { "hero": "chibi_v9" }
})));
testZip.addFile("my_wrapped_folder/inner_folder/script.txt", Buffer.from("Day la kich ban test"));
const testZipBuffer = testZip.toBuffer();

const testExtractDir = path.resolve("imported_projects/test_wrapped_zip_temp");
if (fs.existsSync(testExtractDir)) fs.rmSync(testExtractDir, { recursive: true, force: true });

const extractRes = unzipProjectSafe(testZipBuffer, testExtractDir);
assert(extractRes.success === true, "Giải nén ZIP an toàn thành công");

const wrappedVal = validateEngine(testExtractDir);
assert(wrappedVal.engine === ENGINE_TYPES.PYTHON_LONG_FORM, "Dự án bọc thư mục lồng nhau được nhận diện đúng là python-2d-long-form");
assert(wrappedVal.valid === true, "Dự án bọc thư mục được làm phẳng và thẩm định thành công (valid = true)");
assert(wrappedVal.config?.projectName === "Test Wrapped Project", "Đọc đúng projectName từ story.json sau khi unwrap");

// Dọn dẹp thư mục test
fs.rmSync(testExtractDir, { recursive: true, force: true });

// 6. Kiểm tra Dự án UNKNOWN không bao giờ bị ép sang Remotion
console.log("\n--- 6. Kiểm tra Dự án UNKNOWN ---");
const unknownDir = path.resolve("imported_projects/test_unknown_temp");
if (fs.existsSync(unknownDir)) fs.rmSync(unknownDir, { recursive: true, force: true });
fs.mkdirSync(unknownDir, { recursive: true });
fs.writeFileSync(path.join(unknownDir, "data.csv"), "a,b,c\n1,2,3");

const unknownVal = validateEngine(unknownDir);
assert(unknownVal.engine === ENGINE_TYPES.UNKNOWN, "Dự án lạ được nhận diện là UNKNOWN");
assert(unknownVal.valid === false, "Dự án UNKNOWN báo valid = false");
assert(!unknownVal.errors.some(e => e.includes("src/index.ts")), "Dự án UNKNOWN không bao giờ sinh lỗi Remotion src/index.ts");
assert(unknownVal.errors[0].includes("Không nhận diện được Engine") || unknownVal.errors[0].includes("Không thể xác định loại Engine"), "Trả về thông báo giải thích rõ ràng các Engine được hỗ trợ");

fs.rmSync(unknownDir, { recursive: true, force: true });

// 7. Kiểm tra tính bền vững của Metadata (.project-metadata.json) khi reload
console.log("\n--- 7. Kiểm tra tính bền vững Metadata khi reload ---");
const metaTestDir = path.resolve("imported_projects/test_meta_temp");
if (fs.existsSync(metaTestDir)) fs.rmSync(metaTestDir, { recursive: true, force: true });
fs.mkdirSync(metaTestDir, { recursive: true });
saveProjectMetadata(metaTestDir, {
  projectId: "test_meta_temp",
  engineType: ENGINE_TYPES.PYTHON_LONG_FORM,
  engineName: "Python 2D Long Form (Python / Skia / FFmpeg)"
});

const reloadedMeta = loadProjectMetadata(metaTestDir);
assert(reloadedMeta?.engineType === ENGINE_TYPES.PYTHON_LONG_FORM, "Metadata được nạp lại chính xác sau khi lưu");

const reloadedDetected = detectEngine(metaTestDir);
assert(reloadedDetected.engineType === ENGINE_TYPES.PYTHON_LONG_FORM, "detectEngine ưu tiên tôn trọng engine đã lưu trong metadata");

fs.rmSync(metaTestDir, { recursive: true, force: true });

console.log(`\n========================================`);
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} TESTS PASS (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`========================================\n`);

process.exit(passedTests === totalTests ? 0 : 1);
