/**
 * scripts/render-character-sheets.mjs
 * Comprehensive character sheet generator for Chibi V9 Front View Anatomy Fix
 * Tests all presets, facings, poses, expressions, and outfits.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getCharacter } from '../lib/character-library.mjs';
import { renderChibiLowerBody, renderChibiShoe } from './test-lower-body.mjs';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'test-character-v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

export function renderNewChibiSvg(char, {
  pose = 'stand',
  facing = 'front',
  expr = 'neutral',
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

  // Key Rig Landmarks (local space: ground at y = 0, character height ~ 180)
  const headY = -118;
  const shY = -76;
  const hipY = -42;

  // Joint coordinates tailored for view perspective
  let shFar, eFar, hFar, shNear, eNear, hNear;
  let hipFar, kFar, fFar, hipNear, kNear, fNear;

  if (isFront) {
    // Symmetrical front view
    shFar = [-22, -76]; eFar = [-25, -57]; hFar = [-25, -40];
    shNear = [22, -76]; eNear = [25, -57]; hNear = [25, -40];
    hipFar = [-13, -40]; kFar = [-14, -20]; fFar = [-15, 0];
    hipNear = [13, -40]; kNear = [14, -20]; fNear = [15, 0];

    if (pose === 'walk') {
      shFar = [-22, -76]; eFar = [-24, -62]; hFar = [-22, -48];
      shNear = [22, -76]; eNear = [26, -60]; hNear = [28, -46];
      kFar = [-14, -22]; fFar = [-15, -4];
      kNear = [14, -18]; fNear = [16, 0];
    } else if (pose === 'wave') {
      // Waving outward and high so forearm is never blocked by head
      shNear = [22, -76]; eNear = [34, -80]; hNear = [38, -104];
    } else if (pose === 'point') {
      shNear = [22, -76]; eNear = [34, -76]; hNear = [48, -76];
    }
  } else if (isSide) {
    // Side profile view
    shFar = [-4, -76]; eFar = [-8, -58]; hFar = [-8, -42];
    shNear = [4, -76]; eNear = [8, -58]; hNear = [10, -42];
    hipFar = [-4, -40]; kFar = [-4, -20]; fFar = [-2, 0];
    hipNear = [4, -40]; kNear = [6, -20]; fNear = [8, 0];

    if (pose === 'walk') {
      shFar = [-4, -76]; eFar = [14, -66]; hFar = [24, -56];
      shNear = [4, -76]; eNear = [-8, -66]; hNear = [-18, -52];
      hipFar = [-4, -40]; kFar = [-16, -24]; fFar = [-18, -4];
      hipNear = [4, -40]; kNear = [18, -22]; fNear = [20, 0];
    } else if (pose === 'wave') {
      shNear = [4, -76]; eNear = [18, -84]; hNear = [24, -108];
    } else if (pose === 'point') {
      shNear = [4, -76]; eNear = [22, -76]; hNear = [38, -76];
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
    } else if (pose === 'wave') {
      shNear = [16, -76]; eNear = [30, -82]; hNear = [34, -106];
    } else if (pose === 'point') {
      shNear = [16, -76]; eNear = [30, -76]; hNear = [44, -76];
    }
  }

  let s = `<g transform="scale(${flipX} 1)" stroke-linecap="round" stroke-linejoin="round">\n`;

  // 1. Ground Shadow
  if (showShadow) {
    const shadowRx = isFront ? 34 : 30;
    s += `  <ellipse cx="0" cy="2" rx="${shadowRx}" ry="6" fill="rgba(0,0,0,0.22)" />\n`;
  }

  // 2. Far Arm (Screen Left in Front)
  s += `  <!-- Far Arm -->\n`;
  s += `  <line x1="${shFar[0]}" y1="${shFar[1]}" x2="${eFar[0]}" y2="${eFar[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eFar[0]}" y1="${eFar[1]}" x2="${hFar[0]}" y2="${hFar[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eFar[0]}" cy="${eFar[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <circle cx="${hFar[0]}" cy="${hFar[1]}" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  // 3. Lower Body (modular anatomical system)
  const bType = outfit.bottomType || (outfit.type === 'dress' ? 'skirt' : 'pants');
  const sType = outfit.shoeType || (outfit.type === 'suit' ? 'casual' : outfit.type === 'explorer' ? 'boots' : 'sneakers');

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

  // 6. Neck (Visible cute Chibi neck)
  s += `  <!-- Neck -->\n`;
  const neckX = isFront ? 0 : 1;
  const neckW = isFront ? 8 : 7;
  s += `  <path d="M ${neckX - neckW} ${headY + 28} L ${neckX + neckW} ${headY + 28} L ${neckX + neckW + 2} ${shY + 2} L ${neckX - neckW - 2} ${shY + 2} Z" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  s += `  <ellipse cx="${neckX}" cy="${headY + 31}" rx="${neckW}" ry="3" fill="rgba(0,0,0,0.12)" />\n`;

  // 7. Torso & Outfits
  s += `  <!-- Torso & Clothing -->\n`;
  if (isFront) {
    // Symmetrical broad shoulders framing the head, tapering gently to waist
    const torsoBotY = outfit.type === 'labcoat' ? hipY + 12 : hipY;
    s += `  <path d="M -23 ${shY} Q 0 ${shY - 6} 23 ${shY} L 19 ${torsoBotY} Q 0 ${torsoBotY + 3} -19 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -11 ${shY - 1} Q 0 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;

    if (outfit.type === 'hoodie') {
      s += `  <path d="M -12 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -14 ${hipY - 2} Z" fill="${topCol2}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-4" y1="${shY + 3}" x2="-4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
      s += `  <line x1="4" y1="${shY + 3}" x2="4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
    } else if (outfit.type === 'labcoat') {
      // White labcoat front seam, collar lapels and breast pocket
      s += `  <line x1="0" y1="${shY + 6}" x2="0" y2="${torsoBotY}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <!-- Lapels -->\n`;
      s += `  <polygon points="-9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      // Pocket with blue pen
      s += `  <rect x="-14" y="${shY + 18}" width="7" height="9" rx="1" fill="#f8fafc" stroke="${ink}" stroke-width="1.8" />\n`;
      s += `  <line x1="-10" y1="${shY + 15}" x2="-10" y2="${shY + 20}" stroke="#2563eb" stroke-width="2" />\n`;
      // Red tie inside
      s += `  <polygon points="-2,${shY + 10} 2,${shY + 10} 3,${shY + 22} 0,${shY + 25} -3,${shY + 22}" fill="#dc2626" />\n`;
    } else if (outfit.type === 'suit') {
      // Suit blazer lapels and tie
      s += `  <line x1="0" y1="${shY + 16}" x2="0" y2="${hipY}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <polygon points="-10,${shY + 4} 0,${shY + 18} -6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="10,${shY + 4} 0,${shY + 18} 6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="-3,${shY + 6} 3,${shY + 6} 4,${shY + 20} 0,${shY + 23} -4,${shY + 20}" fill="${topCol2}" />\n`;
    }
  } else if (isSide) {
    const torsoBotY = outfit.type === 'labcoat' ? hipY + 12 : hipY;
    s += `  <path d="M -13 ${shY} Q 2 ${shY - 5} 15 ${shY} L 13 ${torsoBotY} Q 0 ${torsoBotY + 3} -11 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -6 ${shY - 1} Q 2 ${shY + 5} 10 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;
  } else {
    // 3/4 view
    const torsoBotY = outfit.type === 'labcoat' ? hipY + 12 : hipY;
    s += `  <path d="M -18 ${shY} Q 2 ${shY - 6} 20 ${shY} L 17 ${torsoBotY} Q 0 ${torsoBotY + 3} -16 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -9 ${shY - 1} Q 1 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;

    if (outfit.type === 'hoodie') {
      s += `  <path d="M -10 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -11 ${hipY - 2} Z" fill="${topCol2}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-1" y1="${shY + 3}" x2="-1" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
      s += `  <line x1="6" y1="${shY + 3}" x2="6" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
    } else if (outfit.type === 'labcoat') {
      s += `  <line x1="2" y1="${shY + 6}" x2="3" y2="${torsoBotY}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <polygon points="-6,${shY + 6} 2,${shY + 16} 2,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <polygon points="10,${shY + 6} 2,${shY + 16} 2,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <rect x="-12" y="${shY + 18}" width="7" height="9" rx="1" fill="#f8fafc" stroke="${ink}" stroke-width="1.8" />\n`;
      s += `  <line x1="-9" y1="${shY + 15}" x2="-9" y2="${shY + 20}" stroke="#2563eb" stroke-width="2" />\n`;
      s += `  <polygon points="0,${shY + 10} 4,${shY + 10} 5,${shY + 22} 2,${shY + 25} -1,${shY + 22}" fill="#dc2626" />\n`;
    }
  }

  // 8. Head & Facial Features Group
  s += `  <!-- Head Group -->\n`;
  const headCenterX = isFront ? 0 : 1;
  s += `  <g transform="translate(${headCenterX} ${headY})">\n`;

  // Back Hair (bun / ponytail)
  const r = 36 * headScale;
  const hairStyle = char.hair?.style || 'short';
  if (hairStyle === 'ponytail') {
    if (isFront) {
      s += `    <!-- Ponytail visible high behind head -->\n`;
      s += `    <path d="M 12 -28 Q 38 -36 34 8 Q 28 4 18 -10" stroke="${hairCol}" stroke-width="14" stroke-linecap="round" fill="none" />\n`;
      s += `    <circle cx="16" cy="-24" r="5" fill="#f43f5e" />\n`; // Cute hair tie
    } else {
      s += `    <path d="M ${-r * 0.4} ${-r * 0.3} Q ${-r * 1.5} ${-r * 0.2} ${-r * 1.2} ${r * 0.8}" stroke="${hairCol}" stroke-width="20" stroke-linecap="round" fill="none" />\n`;
      s += `    <circle cx="${-r * 0.4}" cy="${-r * 0.3}" r="5.5" fill="#f43f5e" />\n`;
    }
  } else if (hairStyle === 'bun') {
    s += `    <circle cx="${-r * 0.65}" cy="${-r * 0.7}" r="17" fill="${hairCol}" stroke="${ink}" stroke-width="4" />\n`;
  }

  // --- Chibi Head Contour Path (Soft cheeks, tapered chin, rounded cranium) ---
  s += `    <!-- Skull Contour -->\n`;
  if (isFront) {
    s += `    <path d="M 0 -36 ` +
      `C 23 -36, 37 -22, 37 -4 ` +
      `C 37 12, 38 19, 31 29 ` +
      `C 24 37, 10 38, 0 38 ` +
      `C -10 38, -24 37, -31 29 ` +
      `C -38 19, -37 12, -37 -4 ` +
      `C -37 -22, -23 -36, 0 -36 Z" ` +
      `fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;

    // Ears
    s += `    <g stroke="${ink}" stroke-width="3">\n`;
    s += `      <path d="M -37 -4 Q -45 2 -36 10" fill="${skin}" />\n`;
    s += `      <path d="M 37 -4 Q 45 2 36 10" fill="${skin}" />\n`;
    s += `    </g>\n`;
  } else if (isSide) {
    s += `    <path d="M 2 -36 ` +
      `C 22 -36, 34 -22, 34 -8 ` +
      `C 34 -2, 36 2, 37 4 ` +
      `C 35 10, 34 16, 28 28 ` +
      `C 22 36, 8 38, -2 36 ` +
      `C -18 32, -32 18, -32 -4 ` +
      `C -32 -22, -18 -36, 2 -36 Z" ` +
      `fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M -18 -4 Q -26 2 -18 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  } else {
    s += `    <path d="M -2 -36 ` +
      `C 21 -36, 35 -22, 36 -6 ` +
      `C 37 10, 38 18, 33 28 ` +
      `C 26 37, 14 38, 4 38 ` +
      `C -8 38, -22 36, -30 26 ` +
      `C -36 16, -35 8, -34 -4 ` +
      `C -34 -22, -21 -36, -2 -36 Z" ` +
      `fill="${skin}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M -34 -4 Q -42 2 -33 10" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  }

  // --- Facial Features (Clean Thanh Hai 2D Studio Style) ---
  const eyeY = 2;
  const eyeX = isFront ? [-14, 14] : isSide ? [16] : [-5, 18];

  // Clean, subtle blush
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

  // Eyes
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
      const ry = 7.2;
      s += `    <ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="${ry}" fill="${ink}" />\n`;
      s += `    <circle cx="${ex + 1.8}" cy="${eyeY - 2.2}" r="2.2" fill="#ffffff" />\n`;
    });
  }

  // Eyebrows
  eyeX.forEach(ex => {
    let dy = 0;
    if (expr === 'worried') dy = -2;
    if (expr === 'angry') dy = 3;
    if (expr === 'surprised' || expr === 'confused') dy = -3.5;
    s += `    <path d="M ${ex - 6} ${eyeY - 10 + dy} Q ${ex} ${eyeY - 12 + dy} ${ex + 6} ${eyeY - 10 - dy}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" fill="none" />\n`;
  });

  // Nose
  if (!isFront) {
    const nx = isSide ? 25 : 10;
    s += `    <path d="M ${nx} 5 Q ${nx + 2} 7 ${nx} 9" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" fill="none" />\n`;
  }

  // Mouth
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

  // --- Front Hair (Natural volume, hairline clumps, sideburns) ---
  s += `    <!-- Hair (Front & Bangs) -->\n`;
  if (hairStyle === 'spiky') {
    if (isFront) {
      s += `    <path d="M -39 -2 ` +
        `C -40 -26, -24 -42, 0 -42 ` +
        `C 24 -42, 40 -26, 39 -2 ` +
        `L 34 16 L 31 -2 L 24 -6 L 18 4 L 12 -8 L 4 4 L -4 -6 L -12 4 L -18 -8 L -24 -4 L -31 -2 L -34 16 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    } else {
      s += `    <path d="M -36 -4 ` +
        `C -37 -28, -20 -42, 4 -42 ` +
        `C 28 -42, 40 -26, 38 -4 ` +
        `L 33 16 L 28 -2 L 20 -8 L 12 4 L 2 -8 L -6 4 L -14 -8 L -24 -2 L -32 15 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    }
  } else if (hairStyle === 'ponytail' || hairStyle === 'long') {
    if (isFront) {
      s += `    <path d="M -39 -2 ` +
        `C -40 -24, -26 -40, 0 -40 ` +
        `C 26 -40, 40 -24, 39 -2 ` +
        `C 38 8, 36 22, 33 26 ` +
        `C 32 18, 31 4, 28 -4 ` +
        `C 22 -6, 16 0, 8 -6 ` +
        `C 2 -10, -2 -10, -8 -6 ` +
        `C -16 0, -22 -6, -28 -4 ` +
        `C -31 4, -32 18, -33 26 ` +
        `C -36 22, -38 8, -39 -2 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -22 -32 Q 0 -36 22 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    } else {
      s += `    <path d="M -36 -4 ` +
        `C -37 -26, -22 -40, 2 -40 ` +
        `C 26 -40, 39 -24, 38 -4 ` +
        `C 37 8, 35 22, 32 26 ` +
        `C 30 16, 29 2, 24 -4 ` +
        `C 18 -6, 12 0, 4 -6 ` +
        `C -6 0, -18 -6, -26 -4 ` +
        `C -28 4, -30 18, -32 25 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    }
  } else {
    if (isFront) {
      s += `    <path d="M -39 -2 ` +
        `C -40 -24, -26 -40, 0 -40 ` +
        `C 26 -40, 40 -24, 39 -2 ` +
        `C 38 6, 36 14, 34 16 ` +
        `C 33 11, 33 2, 31 -4 ` +
        `L 26 -2 L 18 -10 L 10 2 ` +
        `L 3 -6 L -4 2 L -12 -8 ` +
        `L -20 -1 L -26 -7 ` +
        `C -31 0, -32 9, -34 16 ` +
        `C -36 12, -38 4, -39 -2 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -22 -32 Q 0 -36 22 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    } else if (isSide) {
      s += `    <path d="M -34 -4 ` +
        `C -34 -26, -18 -40, 4 -40 ` +
        `C 24 -40, 36 -26, 36 -6 ` +
        `C 34 2, 32 10, 24 6 ` +
        `C 22 -2, 16 -6, 12 -2 ` +
        `L 4 -12 L -6 -2 ` +
        `C -14 -6, -20 4, -22 14 ` +
        `C -26 10, -32 4, -34 -4 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -16 -32 Q 4 -36 20 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    } else {
      s += `    <path d="M -36 -4 ` +
        `C -37 -26, -22 -40, 2 -40 ` +
        `C 26 -40, 39 -24, 38 -4 ` +
        `C 37 8, 35 15, 33 16 ` +
        `C 31 10, 30 2, 26 -4 ` +
        `L 20 -2 L 12 -10 L 4 2 ` +
        `L -3 -8 L -12 2 L -20 -8 ` +
        `C -26 -1, -29 8, -32 15 ` +
        `C -34 10, -36 2, -36 -4 Z" ` +
        `fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
      s += `    <path d="M -18 -32 Q 2 -36 22 -32" stroke="${hairHi}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.6" />\n`;
    }
  }

  // Glasses
  if (outfit.accessories?.includes('glasses')) {
    eyeX.forEach(ex => {
      s += `    <circle cx="${ex}" cy="${eyeY}" r="9" stroke="${ink}" stroke-width="2.5" fill="none" />\n`;
    });
    if (eyeX.length > 1) {
      s += `    <line x1="${eyeX[0] + 9}" y1="${eyeY}" x2="${eyeX[1] - 9}" y2="${eyeY}" stroke="${ink}" stroke-width="2.5" />\n`;
    }
  }

  s += `  </g>\n`; // End head group

  // 9. Near Arm (Drawn over head for gestures, or naturally in front)
  s += `  <!-- Near Arm (Top Layer) -->\n`;
  s += `  <line x1="${shNear[0]}" y1="${shNear[1]}" x2="${eNear[0]}" y2="${eNear[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eNear[0]}" y1="${eNear[1]}" x2="${hNear[0]}" y2="${hNear[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eNear[0]}" cy="${eNear[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <!-- Hand with distinct thumb -->\n`;
  s += `  <g transform="translate(${hNear[0]} ${hNear[1]})">\n`;
  s += `    <circle cx="0" cy="0" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;
  if (pose === 'point') {
    s += `    <line x1="2" y1="-2" x2="10" y2="-2" stroke="${skin}" stroke-width="4" stroke-linecap="round" />\n`;
    s += `    <line x1="2" y1="-2" x2="10" y2="-2" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
  } else if (pose === 'wave') {
    // Cute open waving hand
    s += `    <circle cx="2" cy="-3" r="3" fill="${skin}" />\n`;
    s += `    <line x1="0" y1="-5" x2="2" y2="-8" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
    s += `    <line x1="3" y1="-4" x2="6" y2="-6" stroke="${ink}" stroke-width="2" stroke-linecap="round" />\n`;
  }
  s += `  </g>\n`;
  s += `</g>\n`; // End character root
  return s;
}

async function run() {
  const max = getCharacter('chibi_max');
  const luna = getCharacter('chibi_luna');
  const doc = getCharacter('chibi_doc');
  const jake = getCharacter('chibi_jake');

  // 1. Generate 5-view sheet (Side L, 3/4 L, Front, 3/4 R, Side R)
  const facings = [
    { id: 'side_left', label: 'Side Left' },
    { id: 'three_quarter_left', label: '3/4 Left' },
    { id: 'front', label: 'Front' },
    { id: 'three_quarter_right', label: '3/4 Right' },
    { id: 'side_right', label: 'Side Right' }
  ];

  let sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 320" width="1000" height="320" style="background:#ffffff;">\n`;
  sheetSvg += `  <line x1="0" y1="260" x2="1000" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  facings.forEach((f, i) => {
    const cx = 100 + i * 200;
    sheetSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#334155">${f.label}</text>\n`;
    sheetSvg += `  <g transform="translate(${cx} 260)">\n`;
    sheetSvg += renderNewChibiSvg(max, { pose: 'stand', facing: f.id });
    sheetSvg += `  </g>\n`;
  });
  sheetSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_5_facings_sheet.svg'), sheetSvg);
  await sharp(Buffer.from(sheetSvg)).png().toFile(path.join(OUT_DIR, 'after_5_facings_sheet.png'));
  console.log('✓ after_5_facings_sheet.png created.');

  // 2. Generate 4-pose sheet in Front View (Stand, Walk, Point, Wave)
  const poses = [
    { id: 'stand', label: 'Stand' },
    { id: 'walk', label: 'Walk' },
    { id: 'point', label: 'Point' },
    { id: 'wave', label: 'Wave' }
  ];

  let poseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 320" width="880" height="320" style="background:#ffffff;">\n`;
  poseSvg += `  <line x1="0" y1="260" x2="880" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  poses.forEach((p, i) => {
    const cx = 110 + i * 220;
    poseSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#334155">${p.label} (Front)</text>\n`;
    poseSvg += `  <g transform="translate(${cx} 260)">\n`;
    poseSvg += renderNewChibiSvg(max, { pose: p.id, facing: 'front' });
    poseSvg += `  </g>\n`;
  });
  poseSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_4_poses_front_sheet.svg'), poseSvg);
  await sharp(Buffer.from(poseSvg)).png().toFile(path.join(OUT_DIR, 'after_4_poses_front_sheet.png'));
  console.log('✓ after_4_poses_front_sheet.png created.');

  // 3. Multi-character Sheet: Max, Luna, Doc, Jake in Front View
  const chars = [
    { char: max, label: 'Max (Hoodie)' },
    { char: luna, label: 'Luna (Dress &amp; Ponytail)' },
    { char: doc, label: 'Dr. Doc (Labcoat &amp; Glasses)' },
    { char: jake, label: 'Jake (Suit)' }
  ];

  let charSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 320" width="880" height="320" style="background:#ffffff;">\n`;
  charSvg += `  <line x1="0" y1="260" x2="880" y2="260" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  chars.forEach((c, i) => {
    const cx = 110 + i * 220;
    charSvg += `  <text x="${cx}" y="35" font-family="Arial, sans-serif" font-size="16" font-weight="bold" text-anchor="middle" fill="#334155">${c.label}</text>\n`;
    charSvg += `  <g transform="translate(${cx} 260)">\n`;
    charSvg += renderNewChibiSvg(c.char, { pose: 'stand', facing: 'front' });
    charSvg += `  </g>\n`;
  });
  charSvg += `</svg>\n`;

  fs.writeFileSync(path.join(OUT_DIR, 'after_all_characters_front.svg'), charSvg);
  await sharp(Buffer.from(charSvg)).png().toFile(path.join(OUT_DIR, 'after_all_characters_front.png'));
  console.log('✓ after_all_characters_front.png created.');
}

run().catch(console.error);
