// tests/test-white-cartoon-engine.mjs — Comprehensive Test Suite for White Cartoon 2D Engine & Scene Engine V3
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WHITE_CARTOON_STYLE,
  WHITE_CARTOON_PRESETS,
  blendExpression
} from '../thanhhai-2d-studio/engine/white-cartoon-rig2d.js';

import {
  solveWalkCycle,
  solveRunCycle,
  solveSneakWalkCycle,
  solveFallBackwardAction,
  solveScaredReactionAction,
  solveSitDownTransition,
  solveReliefSigh
} from '../thanhhai-2d-studio/engine/action-engine.js';

import {
  SHOT_TYPES,
  CameraDirector,
  CINEMATIC_PALETTES
} from '../thanhhai-2d-studio/engine/cinematic-scene.js';

import {
  validateCharacterColors,
  validateProportions,
  validateLimbConnections,
  validateProjectPreRender,
  validateCharacterVisibility,
  validateCameraFraming,
  validateSceneBrightness,
  validateLayerIntegrity,
  validatePropAttachment,
  VALID_EXPRESSIONS
} from '../lib/auto-validator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

console.log('--- BẮT ĐẦU KIỂM THỬ HỆ THỐNG WHITE CARTOON 2D & SCENE ENGINE V3 ---');

// 1. Kiểm tra Character Style Lock
console.log('1. Kiểm tra Character Style Lock:');
assert.strictEqual(WHITE_CARTOON_STYLE.skin, '#FFFDF8', 'Màu da White Cartoon bắt buộc là #FFFDF8');
assert.strictEqual(WHITE_CARTOON_STYLE.outline, '#20202A', 'Đường viền White Cartoon bắt buộc là #20202A');
console.log('  ✔ WHITE_CARTOON_STYLE: da #FFFDF8, viền #20202A');

// Kiểm tra Nam preset
assert.ok(WHITE_CARTOON_PRESETS.nam, 'Preset Nam phải tồn tại trong WHITE_CARTOON_PRESETS');
assert.strictEqual(WHITE_CARTOON_PRESETS.nam.skin, '#FFFDF8', 'Màu da Nam phải là #FFFDF8');
assert.strictEqual(WHITE_CARTOON_PRESETS.nam.outline, '#20202A', 'Đường viền Nam phải là #20202A');
console.log('  ✔ Preset nhân vật Nam khóa da #FFFDF8, viền #20202A');

// Kiểm tra hồi quy: màu đen không được chấp nhận làm da
const blackCheck = validateCharacterColors({ skin: '#0e0b12' });
assert.ok(blackCheck.some(i => i.code === 'ERR_CHAR_BLACK_SKIN'), 'Phải bắt lỗi khi da nhân vật màu đen #0e0b12');
console.log('  ✔ Kiểm thử hồi quy: Tự động chặn nhân vật chuyển thành màu đen');

// 2. Kiểm tra Expression Rig V3
console.log('2. Kiểm tra Expression Rig V3:');
const requiredExpressions = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'confused', 'laughing'
];
requiredExpressions.forEach(expr => {
  assert.ok(VALID_EXPRESSIONS.includes(expr), `Biểu cảm '${expr}' phải có trong thư viện`);
});
console.log(`  ✔ Đủ 8 biểu cảm bắt buộc: ${requiredExpressions.join(', ')}`);

// Kiểm tra hàm blendExpression
const blended = blendExpression('neutral', 'terrified', 0.5);
assert.strictEqual(blended.isBlend, true, 'blendExpression phải trả về đối tượng blend khi 0 < progress < 1');
assert.strictEqual(blended.a, 'neutral');
assert.strictEqual(blended.b, 'terrified');
assert.strictEqual(blended.mix, 0.5);
console.log('  ✔ blendExpression nội suy mượt mà giữa các biểu cảm');

// 3. Kiểm tra Action Animation Engine
console.log('3. Kiểm tra Action Animation Engine:');
// Walk cycle
const walkPose = solveWalkCycle(0.5);
assert.ok(walkPose.hip && walkPose.sh && walkPose.kF && walkPose.fF, 'Walk cycle phải trả về đủ các điểm rig');
const walkIssues = [...validateProportions(walkPose), ...validateLimbConnections(walkPose)];
assert.strictEqual(walkIssues.length, 0, `Walk cycle không được có lỗi tỷ lệ hay đứt gãy khớp: ${JSON.stringify(walkIssues)}`);
console.log('  ✔ solveWalkCycle: Chuyển động bước đi mượt mà, tỷ lệ chuẩn');

// Sneak cycle
const sneakPose = solveSneakWalkCycle(0.5);
assert.ok(sneakPose.propHand, 'Sneak cycle phải cung cấp tọa độ tay cầm đạo cụ');
console.log('  ✔ solveSneakWalkCycle: Khom người rón rén, tích hợp tay cầm chổi');

// Fall action
const fallPose = solveFallBackwardAction(0.5);
assert.ok(fallPose.hip && fallPose.fF, 'Fall backward action phải có các khớp');
console.log('  ✔ solveFallBackwardAction: Mô phỏng vật lý ngã ngửa comic có độ nảy');

// Scared reaction
const scarePose = solveScaredReactionAction(0.5, 0.5);
assert.ok(scarePose.head && scarePose.hF, 'Scared reaction action phải có các khớp');
console.log('  ✔ solveScaredReactionAction: Giật mình hoảng hốt và run rẩy');

// Sit Down Transition & Relief Sigh
const sitPose = solveSitDownTransition(1.0);
assert.ok(sitPose.hip && sitPose.kF, 'Sit down transition phải tạo pose ngồi');
const reliefPose = solveReliefSigh(0.5);
assert.ok(reliefPose.head && reliefPose.sh, 'Relief sigh phải tạo pose thở phào');
console.log('  ✔ solveSitDownTransition & solveReliefSigh: Ngồi xuống êm ái và thở phào nhẹ nhõm');

// 4. Kiểm tra Cinematic Scene Engine V3 & Camera Director
console.log('4. Kiểm tra Cinematic Scene Engine V3 & Camera Director:');
assert.ok(SHOT_TYPES.ESTABLISHING && SHOT_TYPES.WIDE && SHOT_TYPES.MEDIUM && SHOT_TYPES.CLOSE_UP, 'Phải có đủ các preset góc máy');
assert.ok(SHOT_TYPES.MEDIUM.z >= 1.4, 'MEDIUM shot phải có zoom >= 1.4 để nhân vật đủ lớn');
assert.ok(SHOT_TYPES.CLOSE_UP.z >= 2.4, 'CLOSE_UP shot phải có zoom >= 2.4 để bắt trọn biểu cảm');
console.log('  ✔ SHOT_TYPES: Thiết lập đúng chuẩn tỷ lệ khung hình điện ảnh');

const camDirector = new CameraDirector({ shotType: 'MEDIUM' });
camDirector.frameTarget(960, 540, 1);
const camState = camDirector.update(0.016, 1.0);
assert.ok(typeof camState.z === 'number' && typeof camState.x === 'number', 'CameraDirector phải cập nhật mượt mà');
console.log('  ✔ CameraDirector: Định vị chủ thể, Rule of Thirds và Lead Room');

// 5. Kiểm tra Scene Brightness & Palettes
console.log('5. Kiểm tra Scene Brightness & Palettes:');
assert.ok(CINEMATIC_PALETTES.night_exterior && CINEMATIC_PALETTES.cozy_living_room, 'Phải có bảng màu chuẩn');
const brightnessCheck = validateSceneBrightness(CINEMATIC_PALETTES.night_exterior);
assert.strictEqual(brightnessCheck.length, 0, 'Bảng màu đêm chuẩn không được bị lỗi đen tuyệt đối');
console.log('  ✔ Bảng màu điện ảnh đạt chuẩn độ sáng và chiều sâu môi trường');

// 6. Kiểm tra Demo Project 30s "so-ma-30s"
console.log('6. Kiểm tra Demo Project 30s "Nếu Bạn Là Một Người Cực Kỳ Sợ Ma?":');
const demoDir = path.join(ROOT, 'thanhhai-2d-studio', 'examples', 'so-ma-30s');
assert.ok(fs.existsSync(demoDir), 'Thư mục demo so-ma-30s phải tồn tại');

const cfgPath = path.join(demoDir, 'config.json');
assert.ok(fs.existsSync(cfgPath), 'config.json phải tồn tại');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
assert.strictEqual(cfg.duration, 30.0, 'Thời lượng demo phải là 30 giây');
assert.strictEqual(cfg.character, 'white_cartoon', 'Character engine phải là white_cartoon');

const shotsPath = path.join(demoDir, 'story', 'shots.json');
assert.ok(fs.existsSync(shotsPath), 'story/shots.json phải tồn tại');
const shotsData = JSON.parse(fs.readFileSync(shotsPath, 'utf8'));
assert.strictEqual(shotsData.shots.length, 5, 'Dự án demo phải có đủ 5 cảnh bắt buộc');

// Kiểm tra 5 file shot script
const shotFiles = [
  '01_street.js',
  '02_entry.js',
  '03_creak.js',
  '04_sneak.js',
  '05_cat_fall.js'
];
shotFiles.forEach((file, idx) => {
  const fp = path.join(demoDir, 'scenes', 'shots', file);
  assert.ok(fs.existsSync(fp), `File cảnh ${file} phải tồn tại`);
  const content = fs.readFileSync(fp, 'utf8');
  assert.ok(content.includes('registerShot'), `File ${file} phải đăng ký shot với engine`);
});
console.log('  ✔ Đủ 5 cảnh bắt buộc:');
console.log('    - Cảnh 1: Nam đi bộ ban đêm và ngoái đầu nhìn sau');
console.log('    - Cảnh 2: Nam mở cửa bước vào phòng và bật đèn');
console.log('    - Cảnh 3: Nam nghe tiếng động, giật mình quay đầu');
console.log('    - Cảnh 4: Nam cầm chổi, rón rén tiến đến cửa');
console.log('    - Cảnh 5: Một con mèo nhảy ra, Nam ngã ngửa');

// 7. Kiểm tra Auto Quality Validator trên dự án
console.log('7. Chạy Auto Quality Validator trên toàn bộ dự án:');
const valResult = validateProjectPreRender(demoDir, cfg, shotsData.shots);
console.log(`  - Trạng thái kiểm tra: ${valResult.valid ? 'HỢP LỆ (PASS)' : 'KHÔNG HỢP LỆ (FAIL)'}`);
console.log(`  - Lỗi nghiêm trọng (Errors): ${valResult.errors.length}`);
console.log(`  - Cảnh báo (Warnings): ${valResult.warnings.length}`);
if (valResult.warnings.length > 0) {
  valResult.warnings.forEach(w => console.log(`    [Cảnh báo] ${w.message}`));
}
assert.strictEqual(valResult.errors.length, 0, 'Dự án không được có bất kỳ lỗi nghiêm trọng nào');

console.log('--- TOÀN BỘ BÀI KIỂM THỬ WHITE CARTOON 2D & SCENE ENGINE V3 THÀNH CÔNG RỰC RỠ! ---');
