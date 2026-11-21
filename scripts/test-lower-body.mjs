/**
 * scripts/test-lower-body.mjs
 * Test suite and renderer for Chibi V9 Lower Body, Legs & Shoes overhaul.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getCharacter } from '../lib/character-library.mjs';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'test-character-v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

// --- Advanced Lower Body & Shoe Renderer ---

export function renderChibiShoe({
  x,
  y,
  shoeType = 'sneakers',
  shoeCol = '#1e1e24',
  ink = '#191918',
  isFront = true,
  isLeftFoot = false, // false = character right (screen left), true = character left (screen right)
  facing = 'front',
  footAngle = 0,
  isGrounded = true
}) {
  const isSide = facing === 'side_left' || facing === 'side_right';
  const is3Q = facing.startsWith('three_quarter');

  // Foot symmetry in Front view:
  // When grounded (on floor y=0), keep sole strictly flat against ground y=0, no tilt!
  let rot = isGrounded ? 0 : footAngle;

  let s = `<g transform="translate(${x} ${y}) rotate(${rot})">\n`;

  if (shoeType === 'boots') {
    // Sturdy Boot with high shaft & lug sole
    const bootW = isFront ? 22 : 24;
    const xOff = isFront ? (isLeftFoot ? -9 : -12) : -11;
    // 1. Lug sole (flat at y=0)
    s += `  <path d="M ${xOff} -4 L ${xOff + bootW} -4 L ${xOff + bootW} 0 L ${xOff} 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />\n`;
    s += `  <line x1="${xOff + 5}" y1="-2" x2="${xOff + 5}" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
    s += `  <line x1="${xOff + 11}" y1="-2" x2="${xOff + 11}" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
    s += `  <line x1="${xOff + 17}" y1="-2" x2="${xOff + 17}" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
    // 2. Boot body & shaft up to y=-15
    s += `  <path d="M ${xOff + 2} -14 L ${xOff + 18} -14 L ${xOff + 19} -7 Q ${xOff + bootW} -6 ${xOff + bootW} -4 L ${xOff} -4 Z" fill="${shoeCol}" stroke="${ink}" stroke-width="2.5" />\n`;
    // 3. Cuff rim
    s += `  <rect x="${xOff + 1}" y="-16" width="18" height="3" rx="1" fill="#334155" stroke="${ink}" stroke-width="1.8" />\n`;
  } else if (shoeType === 'casual') {
    // Sleek casual loafers / flats
    const shoeW = isFront ? 21 : 23;
    const xOff = isFront ? (isLeftFoot ? -9 : -12) : -10;
    // 1. Slim dark sole (flat at y=0)
    s += `  <path d="M ${xOff} -2.2 L ${xOff + shoeW} -2.2 L ${xOff + shoeW} 0 L ${xOff} 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.8" />\n`;
    // 2. Sleek shoe upper
    s += `  <path d="M ${xOff + 1} -7 Q ${xOff + 8} -8 ${xOff + 15} -7 Q ${xOff + shoeW} -6 ${xOff + shoeW} -2.2 L ${xOff} -2.2 Z" fill="${shoeCol}" stroke="${ink}" stroke-width="2.2" />\n`;
    // 3. Low-cut collar scoop
    s += `  <path d="M ${xOff + 4} -7 Q ${xOff + 9} -5 ${xOff + 14} -7" stroke="${ink}" stroke-width="1.8" fill="none" />\n`;
    // 4. Subtle leather shine
    s += `  <path d="M ${xOff + 13} -5.5 Q ${xOff + 17} -4.5 ${xOff + 18} -3.5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.45" />\n`;
  } else {
    // Default: Sneakers
    const shoeW = isFront ? 23 : 25;
    const xOff = isFront ? (isLeftFoot ? -9 : -13) : -11;
    // 1. Thick white rubber sole (flat at y=0)
    s += `  <path d="M ${xOff} -3.5 L ${xOff + shoeW} -3.5 L ${xOff + shoeW} 0 L ${xOff} 0 Z" fill="#ffffff" stroke="${ink}" stroke-width="2" />\n`;
    s += `  <line x1="${xOff + 1}" y1="-1.6" x2="${xOff + shoeW - 1}" y2="-1.6" stroke="${ink}" stroke-width="1" opacity="0.3" />\n`;
    // 2. Sneaker body
    s += `  <path d="M ${xOff + 1} -8 Q ${xOff + 8} -9 ${xOff + 16} -8 Q ${xOff + shoeW} -7 ${xOff + shoeW} -3.5 L ${xOff} -3.5 Z" fill="${shoeCol}" stroke="${ink}" stroke-width="2.4" />\n`;
    // 3. White rubber toe bumper
    const toeBumperX = isFront && !isLeftFoot ? xOff : xOff + shoeW - 6;
    s += `  <path d="M ${xOff + shoeW - 6} -3.5 Q ${xOff + shoeW - 4} -6 ${xOff + shoeW} -4 Q ${xOff + shoeW} -3.5 ${xOff + shoeW} -3.5 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />\n`;
    // 4. Collar opening where ankle enters
    s += `  <ellipse cx="${xOff + 8}" cy="-8" rx="6" ry="2" fill="#334155" stroke="${ink}" stroke-width="1.8" />\n`;
    // 5. White sneaker laces
    s += `  <line x1="${xOff + 10}" y1="-7" x2="${xOff + 15}" y2="-5.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />\n`;
    s += `  <line x1="${xOff + 11}" y1="-5.2" x2="${xOff + 16}" y2="-3.8" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />\n`;
  }

  s += `</g>\n`;
  return s;
}

export function renderChibiLowerBody({
  hipFar, kFar, fFar,
  hipNear, kNear, fNear,
  bottomType = 'pants', // 'pants' | 'shorts' | 'skirt' | 'dress'
  shoeType = 'sneakers', // 'sneakers' | 'casual' | 'boots'
  pantsCol = '#2e384d',
  shoeCol = '#1e1e24',
  skin = '#ffdfc4',
  hipY = -42,
  ink = '#191918',
  isFront = true,
  isSide = false,
  flipX = 1
}) {
  let s = '';

  const isBareLeg = bottomType === 'skirt' || bottomType === 'dress' || bottomType === 'shorts';

  // 1. Far Leg (Bone: hipFar -> kFar -> fFar)
  s += `  <!-- Far Leg -->\n`;
  if (bottomType === 'pants') {
    // Tapered pants leg
    s += `  <line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${pantsCol}" stroke-width="14" stroke-linecap="round" />\n`;
    s += `  <line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${fFar[1] - 3}" stroke="${pantsCol}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kFar[0]}" cy="${kFar[1]}" r="6.5" fill="${pantsCol}" />\n`;
    // Pants cuff hem
    s += `  <line x1="${fFar[0] - 6}" y1="${fFar[1] - 5}" x2="${fFar[0] + 6}" y2="${fFar[1] - 5}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" />\n`;
  } else {
    // Bare skin leg (under skirt or shorts)
    s += `  <line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${fFar[1] - 3}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kFar[0]}" cy="${kFar[1]}" r="5.5" fill="${skin}" />\n`;
    // Cute subtle knee blush / crease
    s += `  <ellipse cx="${kFar[0]}" cy="${kFar[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />\n`;
  }

  // 2. Far Shoe
  s += `  <!-- Far Shoe -->\n`;
  s += renderChibiShoe({
    x: fFar[0],
    y: fFar[1],
    shoeType,
    shoeCol,
    ink,
    isFront,
    isLeftFoot: false,
    facing: isFront ? 'front' : isSide ? 'side' : '3q',
    footAngle: fFar[1] < 0 ? -12 : 0,
    isGrounded: fFar[1] === 0
  });

  // 3. Near Leg (Bone: hipNear -> kNear -> fNear)
  s += `  <!-- Near Leg -->\n`;
  if (bottomType === 'pants') {
    s += `  <line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${pantsCol}" stroke-width="14" stroke-linecap="round" />\n`;
    s += `  <line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${fNear[1] - 3}" stroke="${pantsCol}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kNear[0]}" cy="${kNear[1]}" r="6.5" fill="${pantsCol}" />\n`;
    // Pants cuff hem
    s += `  <line x1="${fNear[0] - 6}" y1="${fNear[1] - 5}" x2="${fNear[0] + 6}" y2="${fNear[1] - 5}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" />\n`;
  } else {
    s += `  <line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${fNear[1] - 3}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kNear[0]}" cy="${kNear[1]}" r="5.5" fill="${skin}" />\n`;
    s += `  <ellipse cx="${kNear[0]}" cy="${kNear[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />\n`;
  }

  // 4. Near Shoe
  s += `  <!-- Near Shoe -->\n`;
  s += renderChibiShoe({
    x: fNear[0],
    y: fNear[1],
    shoeType,
    shoeCol,
    ink,
    isFront,
    isLeftFoot: true,
    facing: isFront ? 'front' : isSide ? 'side' : '3q',
    footAngle: fNear[1] < 0 ? -12 : 0,
    isGrounded: fNear[1] === 0
  });

  // 5. Pelvis & Garment (Drawn OVER upper legs so legs naturally emerge from inside/below!)
  s += `  <!-- Pelvis & Garment Layer -->\n`;
  if (bottomType === 'skirt' || bottomType === 'dress') {
    // Flared A-line skirt with pleat folds
    if (isFront) {
      s += `  <path d="M -18 ${hipY} L 18 ${hipY} L 25 ${hipY + 20} Q 0 ${hipY + 24} -25 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      // Pleat shadows
      s += `  <path d="M -7 ${hipY + 4} L -9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
      s += `  <path d="M 7 ${hipY + 4} L 9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
    } else if (isSide) {
      s += `  <path d="M -13 ${hipY} L 13 ${hipY} L 17 ${hipY + 20} Q 0 ${hipY + 24} -15 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
    } else {
      // 3/4 view
      s += `  <path d="M -17 ${hipY} L 18 ${hipY} L 24 ${hipY + 20} Q 2 ${hipY + 24} -22 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <path d="M 4 ${hipY + 4} L 5 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
    }
  } else if (bottomType === 'shorts') {
    // Cute shorts ending above knee
    if (isFront) {
      s += `  <polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 14} -20,${hipY + 14}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      // Crotch notch
      s += `  <polygon points="-5,${hipY + 14} 0,${hipY + 8} 5,${hipY + 14}" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;
      // Shorts hem folds
      s += `  <line x1="-20" y1="${hipY + 13}" x2="-5" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <line x1="5" y1="${hipY + 13}" x2="20" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />\n`;
    } else {
      s += `  <polygon points="-16,${hipY - 4} 17,${hipY - 4} 18,${hipY + 14} -15,${hipY + 14}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
    }
  } else {
    // Long Pants Pelvis / Waistband & Crotch seam
    if (isFront) {
      s += `  <polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 8} -20,${hipY + 8}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      // Organic crotch seam J-stitch
      s += `  <path d="M 0 ${hipY - 2} L 0 ${hipY + 6} Q 0 ${hipY + 9} 2 ${hipY + 10}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />\n`;
      // Waistband separation line
      s += `  <line x1="-18" y1="${hipY - 3}" x2="18" y2="${hipY - 3}" stroke="${ink}" stroke-width="2" opacity="0.5" />\n`;
    } else if (isSide) {
      s += `  <polygon points="-12,${hipY - 4} 12,${hipY - 4} 13,${hipY + 8} -11,${hipY + 8}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
    } else {
      s += `  <polygon points="-16,${hipY - 4} 18,${hipY - 4} 19,${hipY + 8} -15,${hipY + 8}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <path d="M 2 ${hipY - 2} L 2 ${hipY + 6}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />\n`;
    }
  }

  return s;
}

// Function to generate full character SVG using the improved lower body & shoe system
export function renderFullChibiSvg(char, {
  pose = 'stand',
  facing = 'front',
  expr = 'neutral',
  bottomType,
  shoeType,
  talk = 0,
  blink = false,
  showShadow = true
} = {}) {
  const isFront = facing === 'front';
  const is3QLeft = facing === 'three_quarter_left';
  const is3QRight = facing === 'three_quarter_right';
  const isSideLeft = facing === 'side_left';
  const isSideRight = facing === 'side_right';
  const isSide = isSideLeft || isSideRight;
  const isLeft = is3QLeft || isSideLeft;
  const flipX = isLeft ? -1 : 1;

  const ink = '#191918';
  const skin = char.skinColor || '#ffdfc4';
  const hairCol = char.hair?.color || '#333333';
  const hairHi = char.hair?.highlight || '#555555';
  const outfit = char.outfit || {};
  const topCol = outfit.topColor || '#d64a33';
  const topCol2 = outfit.topColor2 || '#b83822';
  const pantsCol = outfit.pantsColor || '#2e384d';
  const shoeCol = outfit.shoeColor || '#1e1e24';
  const headScale = char.proportions?.headScale || 1.0;

  // Inferred bottom and shoe types
  const bType = bottomType || outfit.bottomType || (outfit.type === 'dress' ? 'skirt' : 'pants');
  const sType = shoeType || outfit.shoeType || (outfit.type === 'suit' ? 'casual' : outfit.type === 'explorer' ? 'boots' : 'sneakers');

  // Key Rig Landmarks
  const headY = -118;
  const shY = -76;
  const hipY = -42;

  let shFar, eFar, hFar, shNear, eNear, hNear;
  let hipFar, kFar, fFar, hipNear, kNear, fNear;

  if (isFront) {
    shFar = [-22, -76]; eFar = [-25, -57]; hFar = [-25, -40];
    shNear = [22, -76]; eNear = [25, -57]; hNear = [25, -40];
    hipFar = [-13, -40]; kFar = [-14, -20]; fFar = [-15, 0];
    hipNear = [13, -40]; kNear = [14, -20]; fNear = [15, 0];

    if (pose === 'walk') {
      shFar = [-22, -76]; eFar = [-24, -62]; hFar = [-22, -48];
      shNear = [22, -76]; eNear = [26, -60]; hNear = [28, -46];
      kFar = [-14, -22]; fFar = [-15, -4];
      kNear = [14, -18]; fNear = [16, 0];
    } else if (pose === 'run') {
      shFar = [-22, -78]; eFar = [-26, -70]; hFar = [-28, -54];
      shNear = [22, -78]; eNear = [28, -68]; hNear = [30, -50];
      hipFar = [-13, -42]; kFar = [-16, -26]; fFar = [-18, -8];
      hipNear = [13, -42]; kNear = [16, -18]; fNear = [18, 0];
    } else if (pose === 'sit') {
      shFar = [-22, -68]; eFar = [-20, -50]; hFar = [-14, -34];
      shNear = [22, -68]; eNear = [20, -50]; hNear = [14, -34];
      hipFar = [-13, -32]; kFar = [-20, -28]; fFar = [-22, 0];
      hipNear = [13, -32]; kNear = [20, -28]; fNear = [22, 0];
    } else if (pose === 'sit_chair') {
      shFar = [-22, -70]; eFar = [-20, -52]; hFar = [-14, -36];
      shNear = [22, -70]; eNear = [20, -52]; hNear = [14, -36];
      hipFar = [-13, -36]; kFar = [-13, -36]; fFar = [-13, 0];
      hipNear = [13, -36]; kNear = [13, -36]; fNear = [13, 0];
    } else if (pose === 'wave') {
      shNear = [22, -76]; eNear = [34, -80]; hNear = [38, -104];
    } else if (pose === 'point') {
      shNear = [22, -76]; eNear = [34, -76]; hNear = [48, -76];
    }
  } else if (isSide) {
    shFar = [-4, -76]; eFar = [-8, -58]; hFar = [-8, -42];
    shNear = [4, -76]; eNear = [8, -58]; hNear = [10, -42];
    hipFar = [-4, -40]; kFar = [-4, -20]; fFar = [-2, 0];
    hipNear = [4, -40]; kNear = [6, -20]; fNear = [8, 0];

    if (pose === 'walk') {
      shFar = [-4, -76]; eFar = [14, -66]; hFar = [24, -56];
      shNear = [4, -76]; eNear = [-8, -66]; hNear = [-18, -52];
      hipFar = [-4, -40]; kFar = [-16, -24]; fFar = [-18, -4];
      hipNear = [4, -40]; kNear = [18, -22]; fNear = [20, 0];
    } else if (pose === 'run') {
      shFar = [-4, -76]; eFar = [20, -70]; hFar = [30, -62];
      shNear = [4, -76]; eNear = [-12, -70]; hNear = [-22, -58];
      hipFar = [-4, -40]; kFar = [-20, -28]; fFar = [-24, -10];
      hipNear = [4, -40]; kNear = [22, -26]; fNear = [24, 0];
    } else if (pose === 'sit') {
      hipFar = [-4, -32]; kFar = [18, -32]; fFar = [20, 0];
      hipNear = [4, -32]; kNear = [22, -32]; fNear = [24, 0];
    } else if (pose === 'sit_chair') {
      hipFar = [-4, -36]; kFar = [16, -36]; fFar = [16, 0];
      hipNear = [4, -36]; kNear = [20, -36]; fNear = [20, 0];
    }
  } else {
    // 3/4 view
    shFar = [-16, -76]; eFar = [-19, -58]; hFar = [-19, -42];
    shNear = [16, -76]; eNear = [20, -58]; hNear = [20, -42];
    hipFar = [-10, -40]; kFar = [-10, -20]; fFar = [-10, 0];
    hipNear = [10, -40]; kNear = [12, -20]; fNear = [12, 0];

    if (pose === 'walk') {
      shFar = [-16, -76]; eFar = [4, -65]; hFar = [16, -54];
      shNear = [16, -76]; eNear = [-2, -65]; hNear = [-12, -50];
      hipFar = [-10, -40]; kFar = [-16, -24]; fFar = [-16, -4];
      hipNear = [10, -40]; kNear = [18, -22]; fNear = [18, 0];
    } else if (pose === 'run') {
      shFar = [-16, -76]; eFar = [14, -70]; hFar = [26, -62];
      shNear = [16, -76]; eNear = [-8, -70]; hNear = [-18, -56];
      hipFar = [-10, -40]; kFar = [-18, -28]; fFar = [-20, -10];
      hipNear = [10, -40]; kNear = [20, -26]; fNear = [22, 0];
    } else if (pose === 'sit') {
      hipFar = [-10, -32]; kFar = [16, -32]; fFar = [18, 0];
      hipNear = [10, -32]; kNear = [20, -32]; fNear = [22, 0];
    } else if (pose === 'sit_chair') {
      hipFar = [-10, -36]; kFar = [16, -36]; fFar = [16, 0];
      hipNear = [10, -36]; kNear = [20, -36]; fNear = [20, 0];
    }
  }

  let s = `<g transform="scale(${flipX} 1)" stroke-linecap="round" stroke-linejoin="round">\n`;

  // 1. Shadow
  if (showShadow) {
    const shadowRx = isFront ? 34 : 30;
    s += `  <ellipse cx="0" cy="2" rx="${shadowRx}" ry="6" fill="rgba(0,0,0,0.22)" />\n`;
  }

  // 2. Far Arm
  s += `  <!-- Far Arm -->\n`;
  s += `  <line x1="${shFar[0]}" y1="${shFar[1]}" x2="${eFar[0]}" y2="${eFar[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eFar[0]}" y1="${eFar[1]}" x2="${hFar[0]}" y2="${hFar[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eFar[0]}" cy="${eFar[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <circle cx="${hFar[0]}" cy="${hFar[1]}" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  // 3. Lower Body (Legs, Shoes & Pants/Skirt/Shorts)
  s += renderChibiLowerBody({
    hipFar, kFar, fFar,
    hipNear, kNear, fNear,
    bottomType: bType,
    shoeType: sType,
    pantsCol,
    shoeCol,
    skin,
    hipY,
    ink,
    isFront,
    isSide,
    flipX
  });

  // 4. Neck
  const neckX = isFront ? 0 : 1;
  const neckW = isFront ? 8 : 7;
  s += `  <!-- Neck -->\n`;
  s += `  <path d="M ${neckX - neckW} ${headY + 28} L ${neckX + neckW} ${headY + 28} L ${neckX + neckW + 2} ${shY + 2} L ${neckX - neckW - 2} ${shY + 2} Z" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  s += `  <ellipse cx="${neckX}" cy="${headY + 31}" rx="${neckW}" ry="3" fill="rgba(0,0,0,0.12)" />\n`;

  // 5. Torso
  s += `  <!-- Torso & Clothing -->\n`;
  const torsoBotY = outfit.type === 'labcoat' ? hipY + 12 : hipY;
  if (isFront) {
    s += `  <path d="M -23 ${shY} Q 0 ${shY - 6} 23 ${shY} L 19 ${torsoBotY} Q 0 ${torsoBotY + 3} -19 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -11 ${shY - 1} Q 0 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;

    if (outfit.type === 'hoodie') {
      s += `  <path d="M -12 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -14 ${hipY - 2} Z" fill="${topCol2}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-4" y1="${shY + 3}" x2="-4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
      s += `  <line x1="4" y1="${shY + 3}" x2="4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
    } else if (outfit.type === 'labcoat') {
      s += `  <line x1="0" y1="${shY + 6}" x2="0" y2="${torsoBotY}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <polygon points="-9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <rect x="-14" y="${shY + 18}" width="7" height="9" rx="1" fill="#f8fafc" stroke="${ink}" stroke-width="1.8" />\n`;
      s += `  <line x1="-10" y1="${shY + 15}" x2="-10" y2="${shY + 20}" stroke="#2563eb" stroke-width="2" />\n`;
      s += `  <polygon points="-2,${shY + 10} 2,${shY + 10} 3,${shY + 22} 0,${shY + 25} -3,${shY + 22}" fill="#dc2626" />\n`;
    } else if (outfit.type === 'suit') {
      s += `  <line x1="0" y1="${shY + 16}" x2="0" y2="${hipY}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <polygon points="-10,${shY + 4} 0,${shY + 18} -6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="10,${shY + 4} 0,${shY + 18} 6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="-3,${shY + 6} 3,${shY + 6} 4,${shY + 20} 0,${shY + 23} -4,${shY + 20}" fill="${topCol2}" />\n`;
    }
  } else if (isSide) {
    s += `  <path d="M -13 ${shY} Q 2 ${shY - 5} 15 ${shY} L 13 ${torsoBotY} Q 0 ${torsoBotY + 3} -11 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -6 ${shY - 1} Q 2 ${shY + 5} 10 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;
  } else {
    s += `  <path d="M -18 ${shY} Q 2 ${shY - 6} 20 ${shY} L 17 ${torsoBotY} Q 0 ${torsoBotY + 3} -16 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -9 ${shY - 1} Q 1 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;

    if (outfit.type === 'hoodie') {
      s += `  <path d="M -10 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -11 ${hipY - 2} Z" fill="${topCol2}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-1" y1="${shY + 3}" x2="-1" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
      s += `  <line x1="6" y1="${shY + 3}" x2="6" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
    }
  }

  // 6. Head Group
  const headCenterX = isFront ? 0 : 1;
  s += `  <!-- Head Group -->\n`;
  s += `  <g transform="translate(${headCenterX} ${headY})">\n`;

  const r = 36 * headScale;
  const hairStyle = char.hair?.style || 'short';
  if (hairStyle === 'ponytail') {
    if (isFront) {
      s += `    <path d="M 12 -28 Q 38 -36 34 8 Q 28 4 18 -10" stroke="${hairCol}" stroke-width="14" stroke-linecap="round" fill="none" />\n`;
      s += `    <circle cx="16" cy="-24" r="5" fill="#f43f5e" />\n`;
    } else {
      s += `    <path d="M ${-r * 0.4} ${-r * 0.3} Q ${-r * 1.5} ${-r * 0.2} ${-r * 1.2} ${r * 0.8}" stroke="${hairCol}" stroke-width="20" stroke-linecap="round" fill="none" />\n`;
      s += `    <circle cx="${-r * 0.4}" cy="${-r * 0.3}" r="5.5" fill="#f43f5e" />\n`;
    }
  } else if (hairStyle === 'bun') {
    s += `    <circle cx="${-r * 0.65}" cy="${-r * 0.7}" r="17" fill="${hairCol}" stroke="${ink}" stroke-width="4" />\n`;
  }

  // Skull contour
  if (isFront) {
    s += `    <path d="M 0 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 38 19, 31 29 C 24 37, 10 38, 0 38 C -10 38, -24 37, -31 29 C -38 19, -37 12, -37 -4 C -37 -22, -23 -36, 0 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M -37 -4 Q -45 2 -36 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
    s += `    <path d="M 37 -4 Q 45 2 36 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  } else if (isSide) {
    s += `    <path d="M 2 -36 C 22 -36, 34 -22, 34 -8 C 34 -2, 36 2, 37 4 C 35 10, 34 16, 28 28 C 22 36, 8 38, -2 36 C -18 32, -32 18, -32 -4 C -32 -22, -18 -36, 2 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M -18 -4 Q -26 2 -18 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  } else {
    s += `    <path d="M -2 -36 C 21 -36, 35 -22, 36 -6 C 37 10, 38 18, 33 28 C 26 37, 14 38, 4 38 C -8 38, -22 36, -30 26 C -36 16, -35 8, -34 -4 C -34 -22, -21 -36, -2 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M -34 -4 Q -42 2 -33 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  }

  // Facial features
  const eyeY = 2;
  const eyeX = isFront ? [-14, 14] : isSide ? [16] : [-5, 18];

  if (char.face?.blush && !blink) {
    if (isFront) {
      s += `    <ellipse cx="-16" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />\n`;
      s += `    <ellipse cx="16" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />\n`;
    } else if (isSide) {
      s += `    <ellipse cx="18" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />\n`;
    } else {
      s += `    <ellipse cx="-5" cy="${eyeY + 12}" rx="5" ry="3" fill="#fca5a5" opacity="0.4" />\n`;
      s += `    <ellipse cx="19" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />\n`;
    }
  }

  if (blink || expr === 'sad') {
    eyeX.forEach(ex => {
      s += `    <path d="M ${ex - 5} ${eyeY + 2} Q ${ex} ${eyeY + 5} ${ex + 5} ${eyeY + 2}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" fill="none" />\n`;
    });
  } else if (expr === 'happy' || expr === 'laughing') {
    eyeX.forEach(ex => {
      s += `    <path d="M ${ex - 6} ${eyeY + 3} Q ${ex} ${eyeY - 4} ${ex + 6} ${eyeY + 3}" stroke="${ink}" stroke-width="3.8" stroke-linecap="round" fill="none" />\n`;
    });
  } else {
    eyeX.forEach((ex, i) => {
      const rx = !isFront && i === 0 ? 4.6 : 5.4;
      s += `    <ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="7.2" fill="${ink}" />\n`;
      s += `    <circle cx="${ex + 1.8}" cy="${eyeY - 2.2}" r="2.2" fill="#ffffff" />\n`;
    });
  }

  eyeX.forEach(ex => {
    let dy = 0;
    if (expr === 'worried') dy = -2;
    if (expr === 'angry') dy = 3;
    if (expr === 'surprised' || expr === 'confused') dy = -3.5;
    s += `    <path d="M ${ex - 6} ${eyeY - 10 + dy} Q ${ex} ${eyeY - 12 + dy} ${ex + 6} ${eyeY - 10 - dy}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" fill="none" />\n`;
  });

  if (!isFront) {
    const nx = isSide ? 25 : 10;
    s += `    <path d="M ${nx} 5 Q ${nx + 2} 7 ${nx} 9" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" fill="none" />\n`;
  }

  const mx = isFront ? 0 : isSide ? 14 : 7;
  const my = eyeY + 18;
  if (talk > 0.1 || expr === 'laughing') {
    const openH = 3 + talk * 7 + (expr === 'laughing' ? 4 : 0);
    s += `    <ellipse cx="${mx}" cy="${my}" rx="5.5" ry="${openH}" fill="${ink}" />\n`;
    s += `    <path d="M ${mx - 4} ${my} Q ${mx} ${my + openH - 1} ${mx + 4} ${my}" fill="#f87171" />\n`;
  } else if (expr === 'sad') {
    s += `    <path d="M ${mx - 5} ${my + 2} Q ${mx} ${my - 2} ${mx + 5} ${my + 2}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />\n`;
  } else {
    s += `    <path d="M ${mx - 5} ${my - 1} Q ${mx} ${my + 4} ${mx + 5} ${my - 1}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />\n`;
  }

  // Front Hair
  if (hairStyle === 'ponytail' || hairStyle === 'long') {
    if (isFront) {
      s += `    <path d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 8, 36 22, 33 26 C 32 18, 31 4, 28 -4 C 22 -6, 16 0, 8 -6 C 2 -10, -2 -10, -8 -6 C -16 0, -22 -6, -28 -4 C -31 4, -32 18, -33 26 C -36 22, -38 8, -39 -2 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -22 -32 Q 0 -36 22 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    } else {
      s += `    <path d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 22, 32 26 C 30 16, 29 2, 24 -4 C 18 -6, 12 0, 4 -6 C -6 0, -18 -6, -26 -4 C -28 4, -30 18, -32 25 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    }
  } else {
    if (isFront) {
      s += `    <path d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 6, 36 14, 34 16 C 33 11, 33 2, 31 -4 L 26 -2 L 18 -10 L 10 2 L 3 -6 L -4 2 L -12 -8 L -20 -1 L -26 -7 C -31 0, -32 9, -34 16 C -36 12, -38 4, -39 -2 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -22 -32 Q 0 -36 22 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    } else if (isSide) {
      s += `    <path d="M -34 -4 C -34 -26, -18 -40, 4 -40 C 24 -40, 36 -26, 36 -6 C 34 2, 32 10, 24 6 C 22 -2, 16 -6, 12 -2 L 4 -12 L -6 -2 C -14 -6, -20 4, -22 14 C -26 10, -32 4, -34 -4 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    } else {
      s += `    <path d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 15, 33 16 C 31 10, 30 2, 26 -4 L 20 -2 L 12 -10 L 4 2 L -3 -8 L -12 2 L -20 -8 C -26 -1, -29 8, -32 15 C -34 10, -36 2, -36 -4 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    }
  }

  if (outfit.accessories?.includes('glasses')) {
    eyeX.forEach(ex => {
      s += `    <circle cx="${ex}" cy="${eyeY}" r="9" stroke="${ink}" stroke-width="2.5" fill="none" />\n`;
    });
    if (eyeX.length > 1) {
      s += `    <line x1="${eyeX[0] + 9}" y1="${eyeY}" x2="${eyeX[1] - 9}" y2="${eyeY}" stroke="${ink}" stroke-width="2.5" />\n`;
    }
  }

  s += `  </g>\n`; // Head group

  // 7. Near Arm (Top layer)
  s += `  <!-- Near Arm -->\n`;
  s += `  <line x1="${shNear[0]}" y1="${shNear[1]}" x2="${eNear[0]}" y2="${eNear[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eNear[0]}" y1="${eNear[1]}" x2="${hNear[0]}" y2="${hNear[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eNear[0]}" cy="${eNear[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <g transform="translate(${hNear[0]} ${hNear[1]})">\n`;
  s += `    <circle cx="0" cy="0" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;
  if (pose === 'point') {
    s += `    <line x1="2" y1="-2" x2="10" y2="-2" stroke="${skin}" stroke-width="4" stroke-linecap="round" />\n`;
    s += `    <line x1="2" y1="-2" x2="10" y2="-2" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
  } else if (pose === 'wave') {
    s += `    <circle cx="2" cy="-3" r="3" fill="${skin}" />\n`;
    s += `    <line x1="0" y1="-5" x2="2" y2="-8" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
    s += `    <line x1="3" y1="-4" x2="6" y2="-6" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
  }
  s += `  </g>\n`;

  s += `</g>\n`; // Character root
  return s;
}

async function run() {
  const max = getCharacter('chibi_max');
  const luna = getCharacter('chibi_luna');
  const jake = getCharacter('chibi_jake');
  const doc = getCharacter('chibi_doc');

  // Sheet 1: Outfits Comparison (Pants, Shorts, Skirt/Dress, Boots)
  const outfitVariations = [
    { char: max, label: 'Max: Long Pants &amp; Sneakers', opts: { bottomType: 'pants', shoeType: 'sneakers' } },
    { char: luna, label: 'Luna: Flared Skirt &amp; Flats', opts: { bottomType: 'skirt', shoeType: 'casual' } },
    { char: jake, label: 'Jake: Dress Pants &amp; Loafers', opts: { bottomType: 'pants', shoeType: 'casual' } },
    { char: doc, label: 'Doc: Shorts &amp; Boots', opts: { bottomType: 'shorts', shoeType: 'boots' } }
  ];

  let outSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320" style="background:#ffffff;">\n`;
  outSvg += `  <line x1="0" y1="260" x2="1000" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  outfitVariations.forEach((v, i) => {
    const cx = 125 + i * 250;
    outSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#334155">${v.label}</text>\n`;
    outSvg += `  <g transform="translate(${cx} 260)">\n`;
    outSvg += renderFullChibiSvg(v.char, { pose: 'stand', facing: 'front', ...v.opts });
    outSvg += `  </g>\n`;
  });
  outSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_lower_body_outfits.svg'), outSvg);
  await sharp(Buffer.from(outSvg)).png().toFile(path.join(OUT_DIR, 'after_lower_body_outfits.png'));
  console.log('✓ after_lower_body_outfits.png created.');

  // Sheet 2: 4 Poses (Stand, Walk, Run, Sit)
  const poses = [
    { id: 'stand', label: 'Stand' },
    { id: 'walk', label: 'Walk' },
    { id: 'run', label: 'Run' },
    { id: 'sit', label: 'Sit' }
  ];

  let poseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320" style="background:#ffffff;">\n`;
  poseSvg += `  <line x1="0" y1="260" x2="1000" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  poses.forEach((p, i) => {
    const cx = 125 + i * 250;
    poseSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#334155">${p.label}</text>\n`;
    poseSvg += `  <g transform="translate(${cx} 260)">\n`;
    poseSvg += renderFullChibiSvg(max, { pose: p.id, facing: 'front' });
    poseSvg += `  </g>\n`;
  });
  poseSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_lower_body_poses.svg'), poseSvg);
  await sharp(Buffer.from(poseSvg)).png().toFile(path.join(OUT_DIR, 'after_lower_body_poses.png'));
  console.log('✓ after_lower_body_poses.png created.');

  // Sheet 3: Luna & Jake Close-up Comparison (as requested by user)
  let closeSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="600" height="360" style="background:#ffffff;">\n`;
  closeSvg += `  <line x1="0" y1="300" x2="600" y2="300" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;
  closeSvg += `  <text x="160" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#db2777">Luna (Váy Hồng &amp; Giày Búp Bê)</text>\n`;
  closeSvg += `  <text x="440" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#2563eb">Jake (Áo Xanh, Quần Âu &amp; Loafers)</text>\n`;
  closeSvg += `  <g transform="translate(160 300)">\n`;
  closeSvg += renderFullChibiSvg(luna, { pose: 'stand', facing: 'front', bottomType: 'skirt', shoeType: 'casual' });
  closeSvg += `  </g>\n`;
  closeSvg += `  <g transform="translate(440 300)">\n`;
  closeSvg += renderFullChibiSvg(jake, { pose: 'stand', facing: 'front', bottomType: 'pants', shoeType: 'casual' });
  closeSvg += `  </g>\n`;
  closeSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_luna_jake_lower_body.svg'), closeSvg);
  await sharp(Buffer.from(closeSvg)).png().toFile(path.join(OUT_DIR, 'after_luna_jake_lower_body.png'));
  console.log('✓ after_luna_jake_lower_body.png created.');

  // Sheet 4: Luna (Skirt) in 5 Facings
  const facings = [
    { id: 'side_left', label: 'Side Left' },
    { id: 'three_quarter_left', label: '3/4 Left' },
    { id: 'front', label: 'Front' },
    { id: 'three_quarter_right', label: '3/4 Right' },
    { id: 'side_right', label: 'Side Right' }
  ];

  let lunaFacingsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320" style="background:#ffffff;">\n`;
  lunaFacingsSvg += `  <line x1="0" y1="260" x2="1000" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  facings.forEach((f, i) => {
    const cx = 100 + i * 200;
    lunaFacingsSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#db2777">${f.label} (Skirt)</text>\n`;
    lunaFacingsSvg += `  <g transform="translate(${cx} 260)">\n`;
    lunaFacingsSvg += renderFullChibiSvg(luna, { pose: 'stand', facing: f.id, bottomType: 'skirt', shoeType: 'casual' });
    lunaFacingsSvg += `  </g>\n`;
  });
  lunaFacingsSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_luna_skirt_5_facings.svg'), lunaFacingsSvg);
  await sharp(Buffer.from(lunaFacingsSvg)).png().toFile(path.join(OUT_DIR, 'after_luna_skirt_5_facings.png'));
  console.log('✓ after_luna_skirt_5_facings.png created.');

  // Sheet 5: Jake (Pants) in 5 Facings
  let jakeFacingsSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320" style="background:#ffffff;">\n`;
  jakeFacingsSvg += `  <line x1="0" y1="260" x2="1000" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  facings.forEach((f, i) => {
    const cx = 100 + i * 200;
    jakeFacingsSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#2563eb">${f.label} (Pants)</text>\n`;
    jakeFacingsSvg += `  <g transform="translate(${cx} 260)">\n`;
    jakeFacingsSvg += renderFullChibiSvg(jake, { pose: 'stand', facing: f.id, bottomType: 'pants', shoeType: 'casual' });
    jakeFacingsSvg += `  </g>\n`;
  });
  jakeFacingsSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_jake_pants_5_facings.svg'), jakeFacingsSvg);
  await sharp(Buffer.from(jakeFacingsSvg)).png().toFile(path.join(OUT_DIR, 'after_jake_pants_5_facings.png'));
  console.log('✓ after_jake_pants_5_facings.png created.');
}

run().catch(console.error);
