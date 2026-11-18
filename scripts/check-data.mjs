/**
 * Script CLI: Kiểm tra tính hợp lệ toàn diện của dữ liệu
 * Lệnh: npm run check
 */

import fs from "fs";
import path from "path";
import { validateAllData } from "../lib/validate.mjs";

async function main() {
  const projectRoot = process.cwd();
  const scriptPath = path.join(projectRoot, "src/data/script.json");
  const timelinePath = path.join(projectRoot, "src/data/timeline.json");
  const scenesPath = path.join(projectRoot, "src/data/scenes.json");

  let scriptData = null;
  let timelineData = null;
  let scenesData = null;

  try {
    if (fs.existsSync(scriptPath)) scriptData = JSON.parse(fs.readFileSync(scriptPath, "utf-8"));
    if (fs.existsSync(timelinePath)) timelineData = JSON.parse(fs.readFileSync(timelinePath, "utf-8"));
    if (fs.existsSync(scenesPath)) scenesData = JSON.parse(fs.readFileSync(scenesPath, "utf-8"));
  } catch (err) {
    console.error(`❌ Lỗi phân tích cú pháp JSON: ${err.message}`);
    process.exit(1);
  }

  console.log("🔍 Đang kiểm tra tính hợp lệ của script.json, timeline.json, scenes.json...");

  const res = validateAllData({
    scriptData,
    timelineData,
    scenesData,
    projectRoot
  });

  if (res.warnings.length > 0) {
    console.log("\n⚠️ CẢNH BÁO (Không bắt buộc sửa nhưng nên lưu ý):");
    res.warnings.forEach((w) => console.log(`  • ${w}`));
  }

  if (!res.valid) {
    console.error("\n❌ PHÁT HIỆN LỖI DỮ LIỆU:");
    res.errors.forEach((e) => console.error(`  • ${e}`));
    console.log("\nVui lòng khắc phục các lỗi trên trước khi dựng video.");
    process.exit(1);
  } else {
    console.log("\n✅ Tất cả dữ liệu hợp lệ và sẵn sàng dựng video!");
  }
}

main().catch(console.error);

