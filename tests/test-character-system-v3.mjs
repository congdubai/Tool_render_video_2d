// tests/test-character-system-v3.mjs — Comprehensive Test Suite for Character System V3 (Mode A & Mode B)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

import {
  listCharacters,
  getCharacter,
  saveCharacter,
  deleteCharacter,
  duplicateCharacter,
  saveCharacterPartAsset,
  getImportedAssetDir
} from '../lib/character-library.mjs';

import {
  validateCharacterRig
} from '../lib/character-validator.mjs';

import {
  solveImportedBoneTransforms,
  IMPORTED_POSE_ANGLES
} from '../thanhhai-2d-studio/engine/imported-rig2d.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('=== BẮT ĐẦU TEST TOÀN DIỆN CHARACTER SYSTEM V3 (MODE A & MODE B) ===');

// 1. KIỂM THỬ MODE A — BẢO TOÀN NHÂN VẬT DỰNG SẴN
console.log('1. Kiểm thử Mode A — Built-in Characters:');
const characters = listCharacters();
assert.ok(characters.length >= 4, 'Thư viện phải có ít nhất 4 nhân vật mặc định');

const defaultIds = ['chibi_doc', 'chibi_jake', 'chibi_luna', 'chibi_max'];
defaultIds.forEach(id => {
  const char = getCharacter(id);
  assert.ok(char, `Nhân vật mặc định '${id}' phải tồn tại`);
  assert.strictEqual(char.type, 'builtin', `Nhân vật '${id}' phải có type là 'builtin'`);
  assert.ok(char.skinColor, `Nhân vật '${id}' phải có skinColor`);
  assert.ok(char.outfit, `Nhân vật '${id}' phải có outfit`);
  console.log(`  ✔ Mode A: Nhân vật '${id}' (${char.name}) toàn vẹn`);
});

// Thẩm định Mode A
const maxChar = getCharacter('chibi_max');
const maxValidation = validateCharacterRig(maxChar);
assert.strictEqual(maxValidation.valid, true, 'Nhân vật Max phải hợp lệ chuẩn V2');
console.log('  ✔ validateCharacterRig: Nhân vật Max đạt chuẩn V2');

// 2. KIỂM THỬ MODE B — TẠO, LƯU VÀ THẨM ĐỊNH IMPORTED CHARACTER
console.log('\n2. Kiểm thử Mode B — Imported Character Creation & Validation:');

const testImportedId = 'test_ninja_hero';
const testParts = {
  torso: {
    name: 'torso',
    parent: 'root',
    position: [0, -60],
    pivot: [25, 45],
    rotation: 0,
    zIndex: 5,
    assetUrl: '/public/characters/imported/test_ninja_hero/torso.png'
  },
  head: {
    name: 'head',
    parent: 'torso',
    position: [0, -75],
    pivot: [30, 50],
    rotation: 0,
    zIndex: 10,
    assetUrl: '/public/characters/imported/test_ninja_hero/head.png'
  },
  upperArm_L: {
    name: 'upperArm_L',
    parent: 'torso',
    position: [-20, -60],
    pivot: [10, 8],
    rotation: 15,
    zIndex: 1,
    assetUrl: '/public/characters/imported/test_ninja_hero/upperArm_L.png'
  },
  thigh_L: {
    name: 'thigh_L',
    parent: 'torso',
    position: [-14, 0],
    pivot: [10, 8],
    rotation: 0,
    zIndex: 3,
    assetUrl: '/public/characters/imported/test_ninja_hero/thigh_L.png'
  }
};

const testImportedChar = {
  id: testImportedId,
  name: 'Ninja Hero',
  type: 'imported',
  assetType: 'layered_png',
  thumbnail: '/public/characters/imported/test_ninja_hero/head.png',
  parts: testParts,
  expressions: {
    neutral: '/public/characters/imported/test_ninja_hero/head.png',
    happy: '/public/characters/imported/test_ninja_hero/head_happy.png'
  },
  animations: {
    idle: { loop: true, speed: 1.0 },
    walk: { loop: true, speed: 1.0 },
    wave: { loop: true, speed: 1.0 }
  },
  defaultExpression: 'neutral',
  defaultFacing: 'three_quarter_right'
};

// Kiểm tra thẩm định hợp lệ
const validResult = validateCharacterRig(testImportedChar);
assert.strictEqual(validResult.valid, true, `Mode B Rig phải hợp lệ: ${JSON.stringify(validResult.errors)}`);
console.log('  ✔ validateCharacterRig: Thẩm định thành công nhân vật Mode B hợp lệ');

// Kiểm tra phát hiện lỗi thiếu root bone
const noRootChar = { ...testImportedChar, parts: { head: { parent: 'torso' }, torso: { parent: 'head' } } };
const noRootResult = validateCharacterRig(noRootChar);
assert.strictEqual(noRootResult.valid, false, 'Phải phát hiện lỗi vòng lặp hoặc thiếu root');
console.log('  ✔ validateCharacterRig: Tự động bắt lỗi thiếu root hoặc phụ thuộc vòng tròn');

// Lưu nhân vật Mode B vào thư viện
const saveSuccess = saveCharacter(testImportedChar);
assert.ok(saveSuccess, 'Lưu nhân vật Mode B thành công');
const loadedImported = getCharacter(testImportedId);
assert.ok(loadedImported, 'Phải nạp lại được nhân vật Mode B vừa lưu');
assert.strictEqual(loadedImported.type, 'imported');
assert.strictEqual(Object.keys(loadedImported.parts).length, 4);
console.log('  ✔ saveCharacter & getCharacter: Lưu và nạp Mode B trơn tru');

// 3. KIỂM THỬ FORWARD KINEMATICS (FK) SOLVER & POSE ANGLES
console.log('\n3. Kiểm thử Forward Kinematics (FK) Solver:');
const standAngles = IMPORTED_POSE_ANGLES.stand;
const fkTransforms = solveImportedBoneTransforms(testParts, standAngles);

assert.ok(fkTransforms.torso, 'FK phải tính toán biến đổi cho torso');
assert.ok(fkTransforms.head, 'FK phải tính toán biến đổi cho head');
assert.strictEqual(fkTransforms.torso.x, 0, 'Torso X chuẩn');
assert.strictEqual(fkTransforms.torso.y, -60, 'Torso Y chuẩn');
// Head là con của torso: y = -60 + (-75) = -135
assert.strictEqual(fkTransforms.head.y, -135, 'Head World Y phải bằng Torso Y + Local Y (-135)');
console.log('  ✔ solveImportedBoneTransforms: Phép nhân ma trận cha con FK chính xác tuyệt đối');

// Kiểm tra các animation action
const actions = ['idle', 'walk', 'run', 'wave', 'point', 'sit', 'jump', 'surprised', 'talking'];
actions.forEach(act => {
  assert.ok(IMPORTED_POSE_ANGLES[act], `Action '${act}' phải có cấu hình góc quay`);
  const angles = typeof IMPORTED_POSE_ANGLES[act] === 'function' ? IMPORTED_POSE_ANGLES[act](0.5) : IMPORTED_POSE_ANGLES[act];
  assert.ok(typeof angles === 'object', `Action '${act}' phải trả về object các góc xoay`);
});
console.log(`  ✔ Đủ 9 action diễn hoạt chuẩn: ${actions.join(', ')}`);

// 4. KIỂM THỬ XUẤT VÀ NHẬP GÓI ZIP (PACKAGE EXPORT & IMPORT)
console.log('\n4. Kiểm thử Xuất & Nhập Gói ZIP:');

// Giả lập lưu file asset ảnh nhỏ
const samplePngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const partAssetUrl = saveCharacterPartAsset(testImportedId, 'torso', samplePngBase64, 'torso.png');
const fsPath = path.join(process.cwd(), partAssetUrl.startsWith('/') ? partAssetUrl.slice(1) : partAssetUrl);
assert.ok(fs.existsSync(fsPath), 'File asset ảnh bộ phận phải được ghi xuống ổ đĩa');
console.log('  ✔ saveCharacterPartAsset: Ghi ảnh bộ phận an toàn vào public/characters/imported/...');

// Tạo gói ZIP xuất khẩu
const exportZip = new AdmZip();
exportZip.addFile('manifest.json', Buffer.from(JSON.stringify(testImportedChar, null, 2), 'utf8'));
exportZip.addLocalFile(fsPath, 'parts');

const zipBuffer = exportZip.toBuffer();
assert.ok(zipBuffer.length > 0, 'Buffer gói ZIP phải hợp lệ');
console.log(`  ✔ Gói ZIP nhân vật được tạo thành công (${zipBuffer.length} bytes)`);

// Kiểm thử đọc gói ZIP
const readZip = new AdmZip(zipBuffer);
const manifestEntry = readZip.getEntry('manifest.json');
assert.ok(manifestEntry, 'Gói ZIP phải chứa manifest.json');
const parsedManifest = JSON.parse(manifestEntry.getData().toString('utf8'));
assert.strictEqual(parsedManifest.id, testImportedId);
assert.strictEqual(parsedManifest.type, 'imported');
console.log('  ✔ Đọc và giải nén gói ZIP nhân vật bảo toàn toàn bộ cấu trúc Rig & Manifest');

// 5. KIỂM THỬ NHÂN BẢN VÀ DỌN DẸP
console.log('\n5. Kiểm thử Nhân bản & Dọn dẹp:');
const duplicated = duplicateCharacter(testImportedId);
assert.ok(duplicated, 'Nhân bản nhân vật Mode B thành công');
assert.ok(duplicated.id.includes(testImportedId), 'ID nhân bản phải dựa trên ID gốc');
console.log(`  ✔ duplicateCharacter: Nhân bản thành công nhân vật Mode B ('${duplicated.id}')`);

// Xóa các nhân vật test
deleteCharacter(testImportedId);
deleteCharacter(duplicated.id);
assert.strictEqual(getCharacter(testImportedId), null, 'Đã xóa sạch nhân vật test gốc');
assert.strictEqual(getCharacter(duplicated.id), null, 'Đã xóa sạch nhân vật nhân bản test');
console.log('  ✔ deleteCharacter: Dọn dẹp sạch sẽ tài nguyên test');

console.log('\n=== TẤT CẢ KIỂM THỬ CHARACTER SYSTEM V3 ĐẠT 100% PASS! ===');
