/**
 * Script nghiệm thu toàn diện theo Mục 8 Đặc tả kỹ thuật
 * 1. Kiểm tra phát hiện khoảng hở thời gian giữa các cảnh
 * 2. Kiểm tra phát hiện thời gian chồng lấn
 * 3. Kiểm tra bảo mật chống thực thi mã độc trong scenes.json
 * 4. Kiểm tra bảo mật chống Path Traversal (tên file ../x.png)
 */

import { safeParseJson, validateAllData, isSafePath } from "../lib/validate.mjs";

console.log("================ KIỂM THỬ NGHIỆM THU AN TOÀN & LOGIC ================\n");

// 1. Cố ý làm một cảnh hở thời gian
console.log("🧪 Test 1: Kiểm tra phát hiện khoảng hở thời gian (Gap)...");
const fakeTimeline = {
  totalSeconds: 10,
  lines: [{ id: "line_001", start: 0, end: 5 }, { id: "line_002", start: 5, end: 10 }]
};

const gappedScenes = {
  scenes: [
    { id: "scene_001", start: 0, end: 4, bg: "backgrounds/scene_001.png" },
    // Hở từ 4s đến 5s (khoảng hở 1.0s)
    { id: "scene_002", start: 5, end: 10, bg: "backgrounds/scene_001.png" }
  ]
};

const gapResult = validateAllData({
  timelineData: fakeTimeline,
  scenesData: gappedScenes
});

if (!gapResult.valid && gapResult.errors.some((e) => e.includes("khoảng hở thời gian"))) {
  console.log("  ✅ ĐẠT: Hệ thống đã phát hiện chính xác khoảng hở thời gian:");
  console.log("    -> " + gapResult.errors.find((e) => e.includes("khoảng hở")));
} else {
  console.error("  ❌ THẤT BẠI: Không phát hiện được khoảng hở thời gian!");
}

// 2. Cố ý làm cảnh chồng lấn thời gian
console.log("\n🧪 Test 2: Kiểm tra phát hiện thời gian chồng lấn (Overlap)...");
const overlapScenes = {
  scenes: [
    { id: "scene_001", start: 0, end: 6, bg: "backgrounds/scene_001.png" },
    // Chồng lấn 1s (bắt đầu lúc 5s trong khi cảnh 1 kết thúc lúc 6s)
    { id: "scene_002", start: 5, end: 10, bg: "backgrounds/scene_001.png" }
  ]
};

const overlapResult = validateAllData({
  timelineData: fakeTimeline,
  scenesData: overlapScenes
});

if (!overlapResult.valid && overlapResult.errors.some((e) => e.includes("chồng lấn"))) {
  console.log("  ✅ ĐẠT: Hệ thống đã phát hiện chính xác thời gian chồng lấn:");
  console.log("    -> " + overlapResult.errors.find((e) => e.includes("chồng lấn")));
} else {
  console.error("  ❌ THẤT BẠI: Không phát hiện được thời gian chồng lấn!");
}

// 3. Chuỗi có mã độc giả trong scenes.json
console.log("\n🧪 Test 3: Kiểm tra an toàn mã độc (No Eval / No Execution)...");
const maliciousJsonString = `{
  "scenes": [
    {
      "id": "scene_evil",
      "start": 0,
      "end": 10,
      "payload": require('child_process').execSync('whoami'),
      "bg": "backgrounds/scene_001.png"
    }
  ]
}`;

const evilParseResult = safeParseJson(maliciousJsonString, "scenes.json");
if (evilParseResult.error && !evilParseResult.data) {
  console.log("  ✅ ĐẠT: Mã độc bị chặn hoàn toàn ở tầng Parse JSON (không bao giờ được thực thi):");
  console.log("    -> " + evilParseResult.error);
} else {
  console.error("  ❌ THẤT BẠI: JSON parser không chặn được mã độc!");
}

// 4. Kiểm tra chống Path Traversal (tải lên ../hack.png)
console.log("\n🧪 Test 4: Kiểm tra chống tấn công vượt thư mục (Path Traversal)...");
const dangerousPath1 = "../../Windows/System32/calc.exe";
const dangerousPath2 = "backgrounds/../../../secret.txt";
const dangerousPath3 = "..\\..\\evil.png";

const isSafe1 = isSafePath(dangerousPath1, process.cwd() + "/public");
const isSafe2 = isSafePath(dangerousPath2, process.cwd() + "/public");
const isSafe3 = isSafePath(dangerousPath3, process.cwd() + "/public");

if (!isSafe1 && !isSafe2 && !isSafe3) {
  console.log("  ✅ ĐẠT: isSafePath() đã nhận diện và chặn 100% các đường dẫn vượt thư mục:");
  console.log(`    -> "${dangerousPath1}" => BỊ CHẶN`);
  console.log(`    -> "${dangerousPath2}" => BỊ CHẶN`);
  console.log(`    -> "${dangerousPath3}" => BỊ CHẶN`);
} else {
  console.error("  ❌ THẤT BẠI: Chưa chặn được Path Traversal!");
}

console.log("\n================ KẾT THÚC KIỂM THỬ NGHIỆM THU ================\n");

