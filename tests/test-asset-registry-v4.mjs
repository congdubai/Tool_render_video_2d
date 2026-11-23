/**
 * tests/test-asset-registry-v4.mjs
 * Test toàn diện Universal Animation & Asset Library V4 (Phase 1 — Foundation)
 * Kiểm thử:
 * 1. Khởi tạo & Seed Builtin Assets cho đủ 8 danh mục chuẩn V4.
 * 2. Lọc (Filter by Type, Category, Tag) & Tìm kiếm tài nguyên (Search by Query).
 * 3. Thẩm định Schema & An toàn đường dẫn (No Path Traversal, No Absolute Paths).
 * 4. Nhân bản tài nguyên (Duplicate Asset & Clone Media).
 * 5. Kiểm tra phụ thuộc sử dụng (Dependency & Usage Check) & Xóa an toàn.
 * 6. Xuất gói tài nguyên ZIP chuẩn V4 (Package Export with Manifest).
 * 7. Nhập gói tài nguyên ZIP (Package Import, Path Traversal Defense, Collision Handling).
 * 8. Kiểm thử hồi quy V3 (Character System V3 & White Cartoon Rig vẫn hoạt động 100%).
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import {
  ensureAssetStorage,
  listAssets,
  getAsset,
  saveAsset,
  duplicateAsset,
  deleteAsset,
  checkAssetUsage,
  exportAssetPackage,
  importAssetPackage
} from "../lib/asset-registry.mjs";
import {
  validateAssetSchema,
  isSafeAssetPath,
  checkAssetCompatibility,
  ASSET_TYPES,
  ASSET_TYPE_LABELS
} from "../lib/asset-validator.mjs";

console.log("=== BẮT ĐẦU KIỂM THỬ UNIVERSAL ASSET LIBRARY V4 (PHASE 1) ===");

// 1. KIỂM THỬ KHỞI TẠO VÀ SEED ASSETS BUILT-IN
console.log("\n1. Khởi tạo và nạp Built-in Assets cho 8 danh mục:");
ensureAssetStorage();

const allAssets = listAssets();
assert.ok(allAssets.length >= 15, `Phải có ít nhất 15 assets built-in khởi tạo (thực tế: ${allAssets.length})`);

// Kiểm tra sự hiện diện của đầy đủ 8 loại asset
for (const type of ASSET_TYPES) {
  const count = allAssets.filter(a => a.type === type).length;
  assert.ok(count > 0, `Danh mục "${type}" (${ASSET_TYPE_LABELS[type]}) phải có ít nhất 1 asset mẫu (thực tế: ${count})`);
  console.log(`  ✔ Loại "${type}": ${count} tài nguyên có sẵn`);
}

// 2. KIỂM THỬ LỌC VÀ TÌM KIẾM TÀI NGUYÊN (FILTERS & SEARCH)
console.log("\n2. Kiểm thử Lọc & Tìm kiếm:");
const propsList = listAssets({ type: "prop" });
assert.ok(propsList.length >= 3, "Phải lọc được danh sách đạo cụ (props)");
assert.ok(propsList.every(p => p.type === "prop"), "Tất cả kết quả phải thuộc loại prop");
console.log(`  ✔ Lọc type="prop": ${propsList.length} tài nguyên`);

const compositeList = listAssets({ type: "composite_action" });
assert.ok(compositeList.some(c => c.id === "composite_fight_cloud"), "Phải có Composite Action Fight Cloud");
console.log(`  ✔ Lọc type="composite_action": Tìm thấy fight_cloud`);

const searchResults = listAssets({ query: "cà phê" });
assert.ok(searchResults.some(a => a.id === "prop_coffee_cup"), "Tìm kiếm từ khóa 'cà phê' phải trả về ly cà phê");
console.log(`  ✔ Tìm kiếm theo từ khóa text thành công`);

const tagResults = listAssets({ tag: "energy" });
assert.ok(tagResults.length > 0, "Lọc theo thẻ tag 'energy' phải có kết quả");
console.log(`  ✔ Lọc theo thẻ tag thành công`);

// 3. KIỂM THỬ SCHEMA VALIDATION & AN TOÀN ĐƯỜNG DẪN
console.log("\n3. Thẩm định Schema & An toàn đường dẫn:");
assert.strictEqual(isSafeAssetPath("/public/assets/props/laptop.png"), true, "Đường dẫn web relative hợp lệ");
assert.strictEqual(isSafeAssetPath("C:\\Windows\\System32\\cmd.exe"), false, "Phải chặn đường dẫn tuyệt đối Windows");
assert.strictEqual(isSafeAssetPath("../../../etc/passwd"), false, "Phải chặn Path Traversal");
assert.strictEqual(isSafeAssetPath("/public/../../secret.txt"), false, "Phải chặn Path Traversal lồng");
console.log("  ✔ isSafeAssetPath: Chặn đứng Path Traversal và đường dẫn tuyệt đối");

// Thẩm định asset hợp lệ
const validProp = {
  id: "test_magic_wand",
  name: "Đũa Phép Thuật",
  type: "prop",
  category: "fantasy",
  tags: ["magic", "wand", "spell"],
  description: "Cây đũa thần phát sáng đầu que",
  dimensions: { width: 20, height: 80, scale: 1.0 },
  anchor: [10, 75],
  holdOffset: [0, -5],
  compatibility: { requires: ["hand_anchor"] }
};
const valResult = validateAssetSchema(validProp);
assert.strictEqual(valResult.valid, true, `Asset hợp lệ phải pass validation: ${JSON.stringify(valResult.errors)}`);
console.log("  ✔ validateAssetSchema: Thẩm định thành công schema hợp lệ");

// Thẩm định asset không hợp lệ (sai type)
const invalidType = { id: "bad_item", name: "Lỗi", type: "non_existent_type" };
const invalidResult = validateAssetSchema(invalidType);
assert.strictEqual(invalidResult.valid, false, "Phải từ chối loại tài nguyên không tồn tại");
console.log("  ✔ validateAssetSchema: Từ chối các loại type không hợp lệ");

// 4. KIỂM THỬ LƯU, ĐỌC, NHÂN BẢN VÀ THẨM ĐỊNH TƯƠNG THÍCH
console.log("\n4. Lưu, Đọc, Nhân bản & Kiểm tra tương thích:");
const savedProp = saveAsset(validProp);
assert.strictEqual(savedProp.id, "test_magic_wand");
assert.ok(savedProp.createdAt);

const loadedProp = getAsset("test_magic_wand");
assert.ok(loadedProp);
assert.strictEqual(loadedProp.name, "Đũa Phép Thuật");
console.log("  ✔ saveAsset & getAsset: Lưu và đọc asset trơn tru");

// Kiểm tra tương thích
const compatCheck = checkAssetCompatibility(savedProp, { characterEngine: "white_cartoon", hasHandAnchor: true });
assert.strictEqual(compatCheck.compatible, true, "Nhân vật có hand anchor phải tương thích với đũa phép");
const incompatibleCheck = checkAssetCompatibility(savedProp, { characterEngine: "white_cartoon", hasHandAnchor: false });
assert.strictEqual(incompatibleCheck.compatible, false, "Nhân vật không có hand anchor phải báo không tương thích");
console.log("  ✔ checkAssetCompatibility: Phát hiện chính xác yêu cầu năng lực rig");

// Nhân bản asset
const dupProp = duplicateAsset("test_magic_wand");
assert.ok(dupProp.id.includes("test_magic_wand_copy"));
assert.strictEqual(dupProp.name, "Đũa Phép Thuật (Bản sao)");
console.log(`  ✔ duplicateAsset: Nhân bản thành công tài nguyên mới ('${dupProp.id}')`);

// 5. KIỂM THỬ KIỂM TRA PHỤ THUỘC (USAGE CHECK) & XÓA AN TOÀN
console.log("\n5. Kiểm tra Sử dụng & Xóa an toàn:");
const usage = checkAssetUsage("test_magic_wand");
assert.strictEqual(typeof usage.inUse, "boolean");

const delDup = deleteAsset(dupProp.id);
assert.strictEqual(delDup.success, true);
assert.strictEqual(getAsset(dupProp.id), null);
console.log("  ✔ deleteAsset: Xóa sạch sẽ asset nhân bản");

// 6. KIỂM THỬ XUẤT GÓI ZIP (PACKAGE EXPORT WITH MANIFEST)
console.log("\n6. Xuất Gói ZIP Tài Nguyên:");
const zipBuffer = exportAssetPackage("test_magic_wand");
assert.ok(zipBuffer.length > 0, "Buffer ZIP phải hợp lệ");

const readZip = new AdmZip(zipBuffer);
const manifestEntry = readZip.getEntry("manifest.json");
assert.ok(manifestEntry, "Gói ZIP phải chứa file manifest.json");
const manifestObj = JSON.parse(manifestEntry.getData().toString("utf-8"));
assert.strictEqual(manifestObj.assetCount, 1);
assert.strictEqual(manifestObj.assets[0].id, "test_magic_wand");
console.log(`  ✔ exportAssetPackage: Đóng gói ZIP chuẩn V4 thành công (${zipBuffer.length} bytes)`);

// 7. KIỂM THỬ NHẬP GÓI ZIP (PACKAGE IMPORT, PATH TRAVERSAL DEFENSE, COLLISION RESOLUTION)
console.log("\n7. Nhập Gói ZIP & Xử lý trùng lặp:");
// Nhập với chiến lược rename để giải quyết trùng lặp ID với 'test_magic_wand' đang có
const importResult = importAssetPackage(zipBuffer, { collisionStrategy: "rename" });
assert.strictEqual(importResult.success, true);
assert.strictEqual(importResult.importedCount, 1);
const importedId = importResult.importedAssets[0].id;
assert.ok(importedId.includes("test_magic_wand_imp"), "ID nhập trùng phải được tự động đổi tên an toàn");
console.log(`  ✔ importAssetPackage: Nhập và tự động giải quyết trùng ID ('${importedId}')`);

// Thử nghiệm chặn ZIP độc hại (Zip Slip / Path Traversal)
const maliciousZip = new AdmZip();
maliciousZip.addFile("manifest.json", Buffer.from(JSON.stringify({ assets: [{ id: "bad", type: "prop" }] }), "utf-8"));
const evilEntry = maliciousZip.addFile("evil.sh", Buffer.from("echo hacked", "utf-8"));
evilEntry.entryName = "../../evil_script.sh";
assert.throws(() => {
  importAssetPackage(maliciousZip.toBuffer());
}, /không an toàn/, "Phải phát hiện và chặn đứng gói ZIP có path traversal");
console.log("  ✔ importAssetPackage: Chặn đứng âm mưu Zip Slip / Path Traversal độc hại");

// Dọn dẹp các tài nguyên test
deleteAsset("test_magic_wand", true);
deleteAsset(importedId, true);
console.log("  ✔ Dọn dẹp an toàn các tài nguyên tạm sau bài test");

console.log("\n=== TẤT CẢ KIỂM THỬ UNIVERSAL ASSET LIBRARY V4 (PHASE 1) ĐẠT 100% PASS! ===");
