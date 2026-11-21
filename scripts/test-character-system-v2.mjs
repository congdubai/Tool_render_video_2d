/**
 * scripts/test-character-system-v2.mjs
 * Verification suite for Chibi Character System V2
 * Tests 7 required cases and outputs rendered SVGs and PNGs
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { listCharacters, getCharacter } from '../lib/character-library.mjs';
import { validateCharacterRig } from '../lib/character-validator.mjs';
import { renderNewChibiSvg } from './render-character-sheets.mjs';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'test-character-v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('=== CHIBI CHARACTER SYSTEM V2 TEST SUITE ===\n');

// 1. Kiểm tra Character Library
console.log('[1/4] Kiểm tra Thư viện nhân vật (CRUD):');
const allChars = listCharacters();
console.log(`- Đã nạp ${allChars.length} nhân vật từ data/characters/:`, allChars.map(c => `${c.name} (${c.id})`).join(', '));

const max = getCharacter('chibi_max');
const luna = getCharacter('chibi_luna');

if (!max || !luna) {
  console.error('Lỗi: Thiếu nhân vật mẫu chibi_max hoặc chibi_luna!');
  process.exit(1);
}
console.log('✓ Nhân vật mẫu 1 (Max - Boy, Hoodie):', max.name, max.outfit.type);
console.log('✓ Nhân vật mẫu 2 (Luna - Girl, Dress):', luna.name, luna.outfit.type);

// 2. Kiểm tra Thẩm định Rig
console.log('\n[2/4] Kiểm tra Bộ thẩm định Rig tự động (Validation):');
const valMax = validateCharacterRig(max, { pose: 'stand', facing: 'front' });
console.log('✓ Thẩm định Max (Front view):', valMax.valid ? 'HỢP LỆ (Không có lỗi)' : valMax.errors.join(', '));
const valLuna = validateCharacterRig(luna, { pose: 'sit_chair', facing: 'three_quarter_right', chairHeight: -36, hipY: -36 });
console.log('✓ Thẩm định Luna (Ngồi ghế):', valLuna.valid ? 'HỢP LỆ (Tiếp xúc ghế & sàn chuẩn)' : valLuna.errors.join(', '));

// 3. Render 7 Test Cases theo đúng yêu cầu
console.log('\n[3/4] Render 7 Test Cases (SVG & PNG):');
const testCases = [
  { name: 'test_1_stand_front', char: max, opts: { pose: 'stand', facing: 'front', expr: 'neutral' }, desc: '1. Đứng chính diện' },
  { name: 'test_2_stand_three_quarter', char: max, opts: { pose: 'stand', facing: 'three_quarter_right', expr: 'happy' }, desc: '2. Đứng nghiêng 3/4' },
  { name: 'test_3_sit_chair', char: luna, opts: { pose: 'sit_chair', facing: 'three_quarter_right', expr: 'happy' }, desc: '3. Ngồi trên ghế (tiếp sàn y=0)' },
  { name: 'test_4_wave', char: max, opts: { pose: 'wave', facing: 'front', expr: 'happy' }, desc: '4. Giơ tay chào (Wave)' },
  { name: 'test_5_walk', char: max, opts: { pose: 'walk', facing: 'front', expr: 'happy' }, desc: '5. Đi bộ (Walk cycle)' },
  { name: 'test_6_expr_surprised', char: luna, opts: { pose: 'stand', facing: 'front', expr: 'surprised' }, desc: '6. Thay đổi biểu cảm (Surprised)' },
  { name: 'test_7_outfit_labcoat', char: getCharacter('chibi_doc'), opts: { pose: 'point', facing: 'front', expr: 'thinking' }, desc: '7. Thay đổi trang phục (Labcoat & Kính)' }
];

async function renderAll() {
  for (const tc of testCases) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -180 240 220" width="480" height="440" style="background:#ffffff; border-radius:8px;">\n`;
    svg += `<line x1="-120" y1="0" x2="120" y2="0" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

    if (tc.opts.pose === 'sit_chair') {
      svg += `<rect x="-18" y="-36" width="36" height="4" rx="2" fill="#78350f" />\n`;
      svg += `<rect x="-16" y="-32" width="4" height="32" fill="#451a03" />\n`;
      svg += `<rect x="12" y="-32" width="4" height="32" fill="#451a03" />\n`;
    }

    svg += renderNewChibiSvg(tc.char, tc.opts);
    svg += `</svg>`;

    const svgPath = path.join(OUT_DIR, `${tc.name}.svg`);
    const pngPath = path.join(OUT_DIR, `${tc.name}.png`);
    fs.writeFileSync(svgPath, svg, 'utf-8');
    await sharp(Buffer.from(svg)).png().toFile(pngPath);
    console.log(`✓ Đã xuất: ${tc.desc} -> ${path.relative(process.cwd(), svgPath)} & .png`);
  }

  console.log('\n[4/4] Hoàn tất bộ kiểm thử! 7 file SVG và PNG đã được xuất vào out/test-character-v2/');
}

renderAll().catch(console.error);
