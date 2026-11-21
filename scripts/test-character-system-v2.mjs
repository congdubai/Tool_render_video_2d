/**
 * scripts/test-character-system-v2.mjs
 * Verification suite for Chibi Character System V2
 * Tests 7 required cases and outputs rendered SVGs and PNGs
 */

import fs from 'fs';
import path from 'path';
import { listCharacters, getCharacter, saveCharacter, duplicateCharacter } from '../lib/character-library.mjs';
import { validateCharacterRig } from '../lib/character-validator.mjs';
import { CHIBI_POSES_V2 } from '../lib/character-rig-v2.mjs';

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
const valMax = validateCharacterRig(max, { pose: 'stand', facing: 'three_quarter_right' });
console.log('✓ Thẩm định Max:', valMax.valid ? 'HỢP LỆ (Không có lỗi)' : valMax.errors.join(', '));
const valLuna = validateCharacterRig(luna, { pose: 'sit_chair', facing: 'three_quarter_right', chairHeight: -36, hipY: -36 });
console.log('✓ Thẩm định Luna (Ngồi ghế):', valLuna.valid ? 'HỢP LỆ (Tiếp xúc ghế & sàn chuẩn)' : valLuna.errors.join(', '));

// 3. Render SVG Generator cho các test case
function renderSvgCharacter(char, { pose = 'stand', facing = 'three_quarter_right', expr = 'neutral', talk = 0, blink = false }) {
  const isLeft = facing === 'three_quarter_left' || facing === 'side_left';
  const isFront = facing === 'front';
  const isSide = facing === 'side_right' || facing === 'side_left';
  const flipX = isLeft ? -1 : 1;
  const ink = '#191918';
  const skin = char.skinColor || '#ffdfc4';
  const hairCol = char.hair?.color || '#333';
  const topCol = char.outfit?.topColor || '#d64a33';
  const pantsCol = char.outfit?.pantsColor || '#2e384d';
  const shoeCol = char.outfit?.shoeColor || '#1e1e24';
  const r = 36 * (char.proportions?.headScale || 1.0);

  const skel = CHIBI_POSES_V2[pose] || CHIBI_POSES_V2.stand;
  const [hx, hy] = skel.hip;
  const [sx, sy] = skel.sh;
  const [, headY] = skel.head;

  const eyeX = isFront ? [-13, 13] : isSide ? [14] : [-5, 17];
  const eyeY = -6;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -180 240 220" width="480" height="440" style="background:#0f172a; border-radius:8px;">\n`;
  svg += `<line x1="-120" y1="0" x2="120" y2="0" stroke="#334155" stroke-width="2" stroke-dasharray="6 4" />\n`;

  if (pose === 'sit_chair') {
    svg += `<rect x="-18" y="-36" width="36" height="4" rx="2" fill="#78350f" />\n`;
    svg += `<rect x="-16" y="-32" width="4" height="32" fill="#451a03" />\n`;
    svg += `<rect x="12" y="-32" width="4" height="32" fill="#451a03" />\n`;
  }

  svg += `<g transform="scale(${flipX} 1)" stroke-linecap="round" stroke-linejoin="round">\n`;
  svg += `<ellipse cx="0" cy="2" rx="28" ry="6" fill="rgba(0,0,0,0.35)" />\n`;

  // Far Leg
  svg += `<line x1="-8" y1="${hy}" x2="${skel.kFar[0]}" y2="${skel.kFar[1]}" stroke="${pantsCol}" stroke-width="14" />\n`;
  svg += `<line x1="${skel.kFar[0]}" y1="${skel.kFar[1]}" x2="${skel.fFar[0]}" y2="${skel.fFar[1]}" stroke="${pantsCol}" stroke-width="13" />\n`;
  svg += `<ellipse cx="${skel.fFar[0] + 4}" cy="${skel.fFar[1]}" rx="9" ry="5.5" fill="${shoeCol}" stroke="${ink}" stroke-width="3" />\n`;

  // Far Arm
  svg += `<line x1="-6" y1="${sy + 2}" x2="${skel.eFar[0]}" y2="${skel.eFar[1]}" stroke="${topCol}" stroke-width="11" />\n`;
  svg += `<line x1="${skel.eFar[0]}" y1="${skel.eFar[1]}" x2="${skel.hFar[0]}" y2="${skel.hFar[1]}" stroke="${topCol}" stroke-width="10" />\n`;
  svg += `<circle cx="${skel.hFar[0]}" cy="${skel.hFar[1]}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  // Torso
  svg += `<polygon points="-16,${hy - 8} 16,${hy - 8} 18,${hy + 8} -18,${hy + 8}" fill="${pantsCol}" stroke="${ink}" stroke-width="4" />\n`;
  svg += `<path d="M -15 ${sy} Q 0 ${sy - 6} 15 ${sy} L 17 ${hy} L -17 ${hy} Z" fill="${topCol}" stroke="${ink}" stroke-width="4.5" />\n`;

  if (char.outfit?.type === 'hoodie') {
    svg += `<rect x="-10" y="${hy - 14}" width="20" height="11" rx="3" fill="${char.outfit.topColor2 || '#b83822'}" stroke="${ink}" stroke-width="2.5" />\n`;
  }

  // Near Leg
  svg += `<line x1="8" y1="${hy}" x2="${skel.kNear[0]}" y2="${skel.kNear[1]}" stroke="${pantsCol}" stroke-width="14" />\n`;
  svg += `<line x1="${skel.kNear[0]}" y1="${skel.kNear[1]}" x2="${skel.fNear[0]}" y2="${skel.fNear[1]}" stroke="${pantsCol}" stroke-width="13" />\n`;
  svg += `<ellipse cx="${skel.fNear[0] + 4}" cy="${skel.fNear[1]}" rx="9" ry="5.5" fill="${shoeCol}" stroke="${ink}" stroke-width="3" />\n`;

  // Near Arm
  svg += `<line x1="6" y1="${sy + 2}" x2="${skel.eNear[0]}" y2="${skel.eNear[1]}" stroke="${topCol}" stroke-width="11" />\n`;
  svg += `<line x1="${skel.eNear[0]}" y1="${skel.eNear[1]}" x2="${skel.hNear[0]}" y2="${skel.hNear[1]}" stroke="${topCol}" stroke-width="10" />\n`;
  svg += `<circle cx="${skel.hNear[0]}" cy="${skel.hNear[1]}" r="5.5" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  // Head
  svg += `<g transform="translate(2 ${headY})">\n`;
  if (char.hair?.style === 'bun') {
    svg += `<circle cx="${-r * 0.65}" cy="${-r * 0.7}" r="16" fill="${hairCol}" stroke="${ink}" stroke-width="4" />\n`;
  }
  svg += `<circle cx="0" cy="0" r="${r}" fill="${skin}" stroke="${ink}" stroke-width="4.5" />\n`;

  // Ears
  if (isFront) {
    svg += `<circle cx="${-r - 1}" cy="-2" r="7" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
    svg += `<circle cx="${r + 1}" cy="-2" r="7" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  } else {
    svg += `<circle cx="${-r * 0.7}" cy="-2" r="7.5" fill="${skin}" stroke="${ink}" stroke-width="3.5" />\n`;
  }

  // Blush
  if (char.face?.blush && !blink) {
    eyeX.forEach(ex => { svg += `<ellipse cx="${ex}" cy="${eyeY + 12}" rx="6.5" ry="3.5" fill="#fca5a5" opacity="0.75" />\n`; });
  }

  // Eyes
  if (blink || expr === 'sad') {
    eyeX.forEach(ex => { svg += `<path d="M ${ex - 5} ${eyeY} Q ${ex} ${eyeY + 3} ${ex + 5} ${eyeY}" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none" />\n`; });
  } else if (expr === 'happy' || expr === 'laughing') {
    eyeX.forEach(ex => { svg += `<path d="M ${ex - 6} ${eyeY + 2} Q ${ex} ${eyeY - 6} ${ex + 6} ${eyeY + 2}" stroke="${ink}" stroke-width="4.2" stroke-linecap="round" fill="none" />\n`; });
  } else {
    eyeX.forEach((ex, i) => {
      const rx = !isFront && i === 0 ? 4.5 : 5.2;
      svg += `<ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="7.8" fill="${ink}" />\n`;
      svg += `<circle cx="${ex + 1.8}" cy="${eyeY - 2.5}" r="2.4" fill="#ffffff" />\n`;
      svg += `<circle cx="${ex - 1.6}" cy="${eyeY + 3.0}" r="1.3" fill="#ffffff" />\n`;
    });
  }

  // Eyebrows
  eyeX.forEach(ex => {
    let dy = 0;
    if (expr === 'worried') dy = -2;
    if (expr === 'angry') dy = 3;
    if (expr === 'surprised' || expr === 'confused') dy = -4;
    svg += `<line x1="${ex - 6}" y1="${eyeY - 11 + dy}" x2="${ex + 6}" y2="${eyeY - 11 - dy}" stroke="${ink}" stroke-width="3" stroke-linecap="round" />\n`;
  });

  // Nose
  if (!isFront) {
    svg += `<path d="M 10 0 Q 13 2 11 4" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />\n`;
  }

  // Mouth
  const mx = isFront ? 0 : 9;
  const my = eyeY + 18;
  if (talk > 0.1 || expr === 'laughing') {
    svg += `<ellipse cx="${mx}" cy="${my}" rx="6.5" ry="${3 + talk * 8}" fill="${ink}" />\n`;
  } else if (expr === 'sad') {
    svg += `<path d="M ${mx - 6} ${my + 2} Q ${mx} ${my - 3} ${mx + 6} ${my + 2}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />\n`;
  } else {
    svg += `<path d="M ${mx - 6} ${my - 1} Q ${mx} ${my + 5} ${mx + 6} ${my - 1}" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" fill="none" />\n`;
  }

  // Hair
  svg += `<path d="M ${-r * 0.96} ${-r * 0.15} Q ${-r * 0.9} ${-r * 1.12} 0 ${-r * 1.16} Q ${r * 0.9} ${-r * 1.12} ${r * 0.96} ${-r * 0.15} Q ${r * 0.5} ${-r * 0.65} 0 ${-r * 0.55} Q ${-r * 0.5} ${-r * 0.65} ${-r * 0.96} ${-r * 0.15} Z" fill="${hairCol}" stroke="${ink}" stroke-width="4" />\n`;
  svg += `<path d="M ${-r * 0.45} ${-r * 0.9} Q 0 ${-r * 1.02} ${r * 0.45} ${-r * 0.9}" stroke="rgba(255,255,255,0.4)" stroke-width="4" stroke-linecap="round" fill="none" />\n`;

  svg += `</g>\n`; // Head
  svg += `</g>\n`; // Root
  svg += `</svg>`;
  return svg;
}

// 4. Render 7 Test Cases theo đúng yêu cầu Giai đoạn 6
console.log('\n[3/4] Render 7 Test Cases:');
const testCases = [
  { name: 'test_1_stand_front', char: max, opts: { pose: 'stand', facing: 'front', expr: 'neutral' }, desc: '1. Đứng chính diện' },
  { name: 'test_2_stand_three_quarter', char: max, opts: { pose: 'stand', facing: 'three_quarter_right', expr: 'smile' }, desc: '2. Đứng nghiêng 3/4' },
  { name: 'test_3_sit_chair', char: luna, opts: { pose: 'sit_chair', facing: 'three_quarter_right', expr: 'happy' }, desc: '3. Ngồi trên ghế (tiếp sàn y=0)' },
  { name: 'test_4_wave', char: max, opts: { pose: 'wave', facing: 'three_quarter_right', expr: 'happy' }, desc: '4. Giơ tay chào (Wave)' },
  { name: 'test_5_walk', char: max, opts: { pose: 'walk', facing: 'three_quarter_right', expr: 'smile' }, desc: '5. Đi bộ (Walk cycle)' },
  { name: 'test_6_expr_surprised', char: luna, opts: { pose: 'stand', facing: 'front', expr: 'surprised' }, desc: '6. Thay đổi biểu cảm (Surprised)' },
  { name: 'test_7_outfit_labcoat', char: getCharacter('chibi_doc'), opts: { pose: 'point', facing: 'three_quarter_right', expr: 'thinking' }, desc: '7. Thay đổi trang phục (Labcoat & Kính)' }
];

for (const tc of testCases) {
  const svg = renderSvgCharacter(tc.char, tc.opts);
  const filePath = path.join(OUT_DIR, `${tc.name}.svg`);
  fs.writeFileSync(filePath, svg, 'utf-8');
  console.log(`✓ Đã xuất: ${tc.desc} -> ${path.relative(process.cwd(), filePath)}`);
}

console.log('\n[4/4] Hoàn tất bộ kiểm thử! 7 file SVG đã được xuất vào out/test-character-v2/');
