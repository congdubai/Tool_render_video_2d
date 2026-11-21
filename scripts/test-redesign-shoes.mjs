/**
 * scripts/test-redesign-shoes.mjs
 * Redesigned Chibi V9 Shoe Geometry Test Suite
 * Components: shoe_upper, toe_cap, heel, collar, sole
 * Tests Front, 3/4, Side, Stand, Walk, and produces high-res close-ups.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { getCharacter } from '../lib/character-library.mjs';

const OUT_DIR = path.resolve(process.cwd(), 'out', 'test-character-v2');
fs.mkdirSync(OUT_DIR, { recursive: true });

const ink = '#191918';

/**
 * Render a single Chibi shoe with exact cartoon geometry
 */
export function renderNewShoe({
  x = 0,
  y = 0,
  shoeType = 'sneakers', // 'sneakers' | 'casual' | 'boots'
  shoeColor = '#1e1e24',
  facing = 'front', // 'front' | 'three_quarter_right' | 'three_quarter_left' | 'side_right' | 'side_left'
  isLeftFoot = false, // false = screen-left / char-right, true = screen-right / char-left
  isNear = true, // for 3/4: near foot vs far foot
  footAngle = 0,
  isGrounded = true
}) {
  const isFront = facing === 'front';
  const isSide = facing === 'side_left' || facing === 'side_right';
  const is3Q = facing.startsWith('three_quarter');

  // Ground plane contact: when grounded, foot angle is strictly 0 against y = 0
  const rot = isGrounded ? 0 : footAngle;

  let s = '';

  if (isFront) {
    // FRONT VIEW:
    // Splay outward symmetrically: isLeftFoot ? scale(1, 1) : scale(-1, 1)
    // Local coords: (0,0) is ankle center at ground line y=0.
    // Inner heel is at -x, outer toe is at +x.
    const scaleX = isLeftFoot ? 1 : -1;
    s += `<g id="${isLeftFoot ? 'left' : 'right'}-shoe-front" transform="translate(${x} ${y}) scale(${scaleX} 1) rotate(${rot})">\n`;

    if (shoeType === 'boots') {
      // 1. Lug Sole (strictly flat at y=0)
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -6 -3.5 L 9.5 -3.5 Q 10.5 -3.5 10.5 -1.5 L 10.5 0 L -6.5 0 L -6.5 -1.5 Q -6.5 -3.5 -6 -3.5 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <line x1="-1.5" y1="-2" x2="-1.5" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
      s += `  <line x1="4.5" y1="-2" x2="4.5" y2="0" stroke="#334155" stroke-width="1.8" />\n`;

      // 2. Boot Upper & Heel & Shaft
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -5.5 -13.5 L 6.5 -13.5 Q 8.5 -8 9.5 -3.5 L -6 -3.5 Q -6.5 -8 -5.5 -13.5 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

      // 3. Collar Cuff
      s += `  <!-- collar -->\n`;
      s += `  <rect x="-6.5" y="-15" width="14" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />\n`;

      // 4. Toe Cap Stitch
      s += `  <!-- toe_cap -->\n`;
      s += `  <path d="M 3.5 -3.5 Q 4 -6.5 8.5 -3.5" fill="none" stroke="${ink}" stroke-width="1.6" />\n`;

    } else if (shoeType === 'casual') {
      // 1. Slim Flat Sole (strictly flat at y=0)
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -5 -2 L 8.5 -2 Q 9.5 -2 9.5 -0.8 L 9.5 0 L -5.5 0 L -5.5 -0.8 Q -5.5 -2 -5 -2 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />\n`;

      // 2. Sleek Loafer Upper & Heel
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -5 -2 Q -5.5 -6 -3 -9 L 4 -9 Q 8.5 -6 8.5 -2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />\n`;

      // 3. Collar Scoop (Low cut)
      s += `  <!-- collar -->\n`;
      s += `  <path d="M -2.5 -9 Q 0.5 -7 3.5 -9" fill="#1e293b" stroke="${ink}" stroke-width="1.6" />\n`;

      // 4. Toe Cap subtle stitch
      s += `  <!-- toe_cap -->\n`;
      s += `  <path d="M 3.5 -2 Q 4.5 -4.5 7.5 -2" fill="none" stroke="${ink}" stroke-width="1.4" opacity="0.6" />\n`;

    } else {
      // SNEAKERS:
      // 1. Thick Flat White Rubber Sole (strictly flat at y=0)
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -5.5 -2.8 L 9 -2.8 Q 10 -2.8 10 -1.2 L 10 0 L -6 0 L -6 -1.2 Q -6 -2.8 -5.5 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />\n`;

      // 2. Sneaker Upper (Body & Heel counter)
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -5 -2.8 Q -5.8 -6.5 -3.5 -9.5 L 4 -9.5 Q 8.5 -6 9 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

      // 3. Collar Opening
      s += `  <!-- collar -->\n`;
      s += `  <ellipse cx="0.5" cy="-9.5" rx="4.8" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />\n`;

      // 4. White Toe Cap (Cleanly closed, contoured to front outer curve)
      s += `  <!-- toe_cap -->\n`;
      s += `  <path d="M 4 -2.8 Q 4 -5.5 6.8 -5.5 Q 9 -4.8 9 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />\n`;

      // 5. Tidy Instep Laces (Centrally placed, strictly inside upper)
      s += `  <!-- laces -->\n`;
      s += `  <line x1="-0.8" y1="-7.8" x2="3.2" y2="-7.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
      s += `  <line x1="0.2" y1="-5.6" x2="4.2" y2="-4.8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
    }

    s += `</g>\n`;
    return s;
  }

  if (isSide) {
    // SIDE PROFILE VIEW:
    // Heel is at -x (rear), Toe is at +x (front pointing in viewing direction)
    s += `<g id="shoe-side" transform="translate(${x} ${y}) rotate(${rot})">\n`;

    if (shoeType === 'boots') {
      // 1. Lug Sole
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -8 -3.8 L 11 -3.8 Q 13 -3.8 13 -1.5 Q 13 0 10.5 0 L -8 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <line x1="-3" y1="-2" x2="-3" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
      s += `  <line x1="3" y1="-2" x2="3" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
      s += `  <line x1="8" y1="-2" x2="8" y2="0" stroke="#334155" stroke-width="1.8" />\n`;

      // 2. Boot Upper & Heel
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -8 -3.8 Q -8.5 -8 -4.5 -14 L 3 -14 Q 7 -8.5 12.5 -4.5 L 12.5 -3.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

      // 3. Collar
      s += `  <!-- collar -->\n`;
      s += `  <rect x="-5.5" y="-15.5" width="10" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />\n`;

      // 4. Toe Cap Stitch
      s += `  <!-- toe_cap -->\n`;
      s += `  <path d="M 6.5 -3.8 Q 7.5 -7 12.5 -4.5" fill="none" stroke="${ink}" stroke-width="1.8" />\n`;

    } else if (shoeType === 'casual') {
      // 1. Sleek Flat Sole
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -7 -2.2 L 10 -2.2 Q 11.5 -2.2 11.5 -0.8 Q 11.5 0 9.5 0 L -7 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />\n`;

      // 2. Upper & Heel Counter
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -7 -2.2 Q -7.5 -6 -3.5 -8.5 Q 0 -6 3.5 -8.5 Q 7.5 -6.5 11 -3.2 L 11 -2.2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />\n`;

      // 3. Collar Curve
      s += `  <!-- collar -->\n`;
      s += `  <path d="M -3.5 -8.5 Q 0 -5.5 3.5 -8.5" fill="none" stroke="${ink}" stroke-width="1.6" />\n`;

    } else {
      // SNEAKERS:
      // 1. White Rubber Sole with subtle toe-spring
      s += `  <!-- sole -->\n`;
      s += `  <path d="M -7.5 -2.8 L 10.5 -2.8 Q 12.5 -2.8 12.5 -1.2 Q 12.5 0 9.5 0 L -7.5 0 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />\n`;

      // 2. Sneaker Upper (Rounded heel, sleek instep slope, toe box)
      s += `  <!-- shoe_upper & heel -->\n`;
      s += `  <path d="M -7.5 -2.8 Q -8.2 -7 -4 -9.5 L 2.5 -9.5 Q 7 -7.5 12 -4 Q 12.5 -3 12 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

      // 3. Collar Opening
      s += `  <!-- collar -->\n`;
      s += `  <ellipse cx="-0.8" cy="-9.5" rx="4.5" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />\n`;

      // 4. White Toe Bumper
      s += `  <!-- toe_cap -->\n`;
      s += `  <path d="M 6.5 -2.8 Q 7.5 -5.2 11.5 -4 Q 12 -3.2 11.8 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />\n`;

      // 5. Instep Laces
      s += `  <!-- laces -->\n`;
      s += `  <line x1="0.5" y1="-8.0" x2="4.5" y2="-6.6" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
      s += `  <line x1="2.2" y1="-5.8" x2="6.2" y2="-4.4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
    }

    s += `</g>\n`;
    return s;
  }

  // THREE-QUARTER VIEW:
  // Differentiate near foot (outer profile) vs far foot (inner profile)
  const sc = isNear ? 1.0 : 0.92;
  s += `<g id="${isNear ? 'near' : 'far'}-shoe-3q" transform="translate(${x} ${y}) scale(${sc}) rotate(${rot})">\n`;

  if (shoeType === 'boots') {
    // 1. Lug Sole
    s += `  <!-- sole -->\n`;
    s += `  <path d="M -7 -3.5 L 10.5 -3.5 Q 12 -3.5 12 -1.5 Q 12 0 10 0 L -7 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />\n`;
    s += `  <line x1="-2" y1="-2" x2="-2" y2="0" stroke="#334155" stroke-width="1.8" />\n`;
    s += `  <line x1="4" y1="-2" x2="4" y2="0" stroke="#334155" stroke-width="1.8" />\n`;

    // 2. Boot Upper & Heel
    s += `  <!-- shoe_upper & heel -->\n`;
    s += `  <path d="M -7 -3.5 Q -7.5 -7.5 -4 -13.5 L 3.5 -13.5 Q 7.5 -8 11.5 -4 L 11.5 -3.5 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

    // 3. Collar
    s += `  <!-- collar -->\n`;
    s += `  <rect x="-5" y="-15" width="10.5" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />\n`;

    // 4. Toe Cap Stitch
    s += `  <!-- toe_cap -->\n`;
    s += `  <path d="M 5.5 -3.5 Q 6.5 -6.5 11.5 -4" fill="none" stroke="${ink}" stroke-width="1.8" />\n`;

  } else if (shoeType === 'casual') {
    // 1. Flat Sole
    s += `  <!-- sole -->\n`;
    s += `  <path d="M -6.5 -2.2 L 9.5 -2.2 Q 11 -2.2 11 -0.8 Q 11 0 9 0 L -6.5 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />\n`;

    // 2. Loafer Upper
    s += `  <!-- shoe_upper & heel -->\n`;
    s += `  <path d="M -6.5 -2.2 Q -7 -5.5 -3 -8.5 Q 0.5 -6 4 -8.5 Q 7.5 -6 10.5 -3.2 L 10.5 -2.2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />\n`;

    // 3. Collar
    s += `  <!-- collar -->\n`;
    s += `  <path d="M -3 -8.5 Q 0.5 -5.8 4 -8.5" fill="none" stroke="${ink}" stroke-width="1.6" />\n`;

  } else {
    // SNEAKERS:
    // 1. Sole
    s += `  <!-- sole -->\n`;
    s += `  <path d="M -7 -2.8 L 10 -2.8 Q 11.8 -2.8 11.8 -1.2 Q 11.8 0 9.2 0 L -7 0 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />\n`;

    // 2. Upper
    s += `  <!-- shoe_upper & heel -->\n`;
    s += `  <path d="M -7 -2.8 Q -7.5 -6.5 -3.5 -9.5 L 3 -9.5 Q 7 -7 11.2 -3.8 L 11.2 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />\n`;

    // 3. Collar
    s += `  <!-- collar -->\n`;
    s += `  <ellipse cx="-0.2" cy="-9.5" rx="4.6" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />\n`;

    // 4. White Toe Bumper
    s += `  <!-- toe_cap -->\n`;
    s += `  <path d="M 5.8 -2.8 Q 6.8 -5 10.8 -3.8 Q 11.2 -3.2 11 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />\n`;

    // 5. Laces
    s += `  <!-- laces -->\n`;
    s += `  <line x1="0.2" y1="-7.8" x2="4.2" y2="-6.4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
    s += `  <line x1="1.8" y1="-5.6" x2="5.8" y2="-4.2" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />\n`;
  }

  s += `</g>\n`;
  return s;
}

/**
 * Render Lower Body with accurate connection between pants/legs and shoes
 */
export function renderNewLowerBody({
  hipFar, kFar, fFar,
  hipNear, kNear, fNear,
  bottomType = 'pants',
  shoeType = 'sneakers',
  pantsCol = '#2e384d',
  shoeCol = '#1e1e24',
  skin = '#ffdfc4',
  hipY = -42,
  ink = '#191918',
  facing = 'front',
  flipX = 1
}) {
  const isFront = facing === 'front';
  const isSide = facing === 'side_left' || facing === 'side_right';
  const is3Q = facing.startsWith('three_quarter');

  let s = '';

  // 1. Far Leg (Leg enters collar cleanly at y = fFar[1] - 8)
  const legAnkleFarY = fFar[1] - 8;
  s += `  <!-- Far Leg -->\n`;
  if (bottomType === 'pants') {
    s += `  <line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${pantsCol}" stroke-width="14" stroke-linecap="round" />\n`;
    s += `  <line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${legAnkleFarY}" stroke="${pantsCol}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kFar[0]}" cy="${kFar[1]}" r="6.5" fill="${pantsCol}" />\n`;
    s += `  <line x1="${fFar[0] - 5.5}" y1="${legAnkleFarY - 1}" x2="${fFar[0] + 5.5}" y2="${legAnkleFarY - 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" />\n`;
  } else {
    s += `  <line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${legAnkleFarY}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kFar[0]}" cy="${kFar[1]}" r="5.5" fill="${skin}" />\n`;
    s += `  <ellipse cx="${kFar[0]}" cy="${kFar[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />\n`;
  }

  // 2. Far Shoe
  s += renderNewShoe({
    x: fFar[0],
    y: fFar[1],
    shoeType,
    shoeColor: shoeCol,
    facing,
    isLeftFoot: false,
    isNear: false,
    footAngle: fFar[1] < 0 ? -12 : 0,
    isGrounded: fFar[1] === 0
  });

  // 3. Near Leg
  const legAnkleNearY = fNear[1] - 8;
  s += `  <!-- Near Leg -->\n`;
  if (bottomType === 'pants') {
    s += `  <line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${pantsCol}" stroke-width="14" stroke-linecap="round" />\n`;
    s += `  <line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${legAnkleNearY}" stroke="${pantsCol}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kNear[0]}" cy="${kNear[1]}" r="6.5" fill="${pantsCol}" />\n`;
    s += `  <line x1="${fNear[0] - 5.5}" y1="${legAnkleNearY - 1}" x2="${fNear[0] + 5.5}" y2="${legAnkleNearY - 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" />\n`;
  } else {
    s += `  <line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />\n`;
    s += `  <line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${legAnkleNearY}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />\n`;
    s += `  <circle cx="${kNear[0]}" cy="${kNear[1]}" r="5.5" fill="${skin}" />\n`;
    s += `  <ellipse cx="${kNear[0]}" cy="${kNear[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />\n`;
  }

  // 4. Near Shoe
  s += renderNewShoe({
    x: fNear[0],
    y: fNear[1],
    shoeType,
    shoeColor: shoeCol,
    facing,
    isLeftFoot: true,
    isNear: true,
    footAngle: fNear[1] < 0 ? -12 : 0,
    isGrounded: fNear[1] === 0
  });

  // 5. Pelvis & Garment (Drawn OVER upper legs so legs emerge from inside!)
  s += `  <!-- Pelvis & Garment -->\n`;
  if (bottomType === 'skirt' || bottomType === 'dress') {
    if (isFront) {
      s += `  <path d="M -18 ${hipY} L 18 ${hipY} L 25 ${hipY + 20} Q 0 ${hipY + 24} -25 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <path d="M -7 ${hipY + 4} L -9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
      s += `  <path d="M 7 ${hipY + 4} L 9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
    } else if (isSide) {
      s += `  <path d="M -13 ${hipY} L 13 ${hipY} L 17 ${hipY + 20} Q 0 ${hipY + 24} -15 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
    } else {
      s += `  <path d="M -17 ${hipY} L 18 ${hipY} L 24 ${hipY + 20} Q 2 ${hipY + 24} -22 ${hipY + 20} Z" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <path d="M 4 ${hipY + 4} L 5 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />\n`;
    }
  } else if (bottomType === 'shorts') {
    if (isFront) {
      s += `  <polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 14} -20,${hipY + 14}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <polygon points="-5,${hipY + 14} 0,${hipY + 8} 5,${hipY + 14}" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-20" y1="${hipY + 13}" x2="-5" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />\n`;
      s += `  <line x1="5" y1="${hipY + 13}" x2="20" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />\n`;
    } else {
      s += `  <polygon points="-16,${hipY - 4} 17,${hipY - 4} 18,${hipY + 14} -15,${hipY + 14}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
    }
  } else {
    // Pants
    if (isFront) {
      s += `  <polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 8} -20,${hipY + 8}" fill="${pantsCol}" stroke="${ink}" stroke-width="3.5" />\n`;
      s += `  <path d="M 0 ${hipY - 2} L 0 ${hipY + 6} Q 0 ${hipY + 9} 2 ${hipY + 10}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />\n`;
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

/**
 * Generate full character SVG using the new lower body & shoe system
 */
export function renderFullChibi({
  char,
  pose = 'stand',
  facing = 'front',
  expr = 'neutral',
  bottomType,
  shoeType,
  talk = 0,
  blink = false,
  showShadow = true
}) {
  const isFront = facing === 'front';
  const is3QLeft = facing === 'three_quarter_left';
  const is3QRight = facing === 'three_quarter_right';
  const isSideLeft = facing === 'side_left';
  const isSideRight = facing === 'side_right';
  const isSide = isSideLeft || isSideRight;
  const isLeft = is3QLeft || isSideLeft;
  const flipX = isLeft ? -1 : 1;

  const skin = char.skinColor || '#ffdfc4';
  const hairCol = char.hair?.color || '#333333';
  const hairHi = char.hair?.highlight || '#555555';
  const outfit = char.outfit || {};
  const topCol = outfit.topColor || '#d64a33';
  const topCol2 = outfit.topColor2 || '#b83822';
  const pantsCol = outfit.pantsColor || '#2e384d';
  const shoeCol = outfit.shoeColor || '#1e1e24';
  const headScale = char.proportions?.headScale || 1.0;

  const bType = bottomType || outfit.bottomType || (outfit.type === 'dress' ? 'skirt' : 'pants');
  const sType = shoeType || outfit.shoeType || (outfit.type === 'suit' ? 'casual' : outfit.type === 'explorer' ? 'boots' : 'sneakers');

  const headY = -118;
  const shY = -76;
  const hipY = -42;

  let shFar, eFar, hFar, shNear, eNear, hNear;
  let hipFar, kFar, fFar, hipNear, kNear, fNear;

  if (isFront) {
    shFar = [-22, -76]; eFar = [-25, -57]; hFar = [-25, -40];
    shNear = [22, -76]; eNear = [25, -57]; hNear = [25, -40];
    hipFar = [-13, -40]; kFar = [-14, -20]; fFar = [-14, 0];
    hipNear = [13, -40]; kNear = [14, -20]; fNear = [14, 0];

    if (pose === 'walk') {
      shFar = [-22, -76]; eFar = [-24, -62]; hFar = [-22, -48];
      shNear = [22, -76]; eNear = [26, -60]; hNear = [28, -46];
      kFar = [-14, -22]; fFar = [-14, -5];
      kNear = [14, -18]; fNear = [15, 0];
    }
  } else if (isSide) {
    shFar = [-4, -76]; eFar = [-8, -58]; hFar = [-8, -42];
    shNear = [4, -76]; eNear = [8, -58]; hNear = [10, -42];
    hipFar = [-4, -40]; kFar = [-4, -20]; fFar = [-2, 0];
    hipNear = [4, -40]; kNear = [6, -20]; fNear = [8, 0];

    if (pose === 'walk') {
      shFar = [-4, -76]; eFar = [14, -66]; hFar = [24, -56];
      shNear = [4, -76]; eNear = [-8, -66]; hNear = [-18, -52];
      hipFar = [-4, -40]; kFar = [-16, -24]; fFar = [-18, -5];
      hipNear = [4, -40]; kNear = [18, -22]; fNear = [20, 0];
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
      hipFar = [-10, -40]; kFar = [-16, -24]; fFar = [-16, -5];
      hipNear = [10, -40]; kNear = [18, -22]; fNear = [18, 0];
    }
  }

  let s = `<g transform="scale(${flipX} 1)" stroke-linecap="round" stroke-linejoin="round">\n`;

  // 1. Shadow
  if (showShadow) {
    const shadowRx = isFront ? 34 : 30;
    s += `  <ellipse cx="0" cy="2" rx="${shadowRx}" ry="6" fill="rgba(0,0,0,0.22)" />\n`;
  }

  // 2. Far Arm
  s += `  <line x1="${shFar[0]}" y1="${shFar[1]}" x2="${eFar[0]}" y2="${eFar[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eFar[0]}" y1="${eFar[1]}" x2="${hFar[0]}" y2="${hFar[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eFar[0]}" cy="${eFar[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <circle cx="${hFar[0]}" cy="${hFar[1]}" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  // 3. Lower Body
  s += renderNewLowerBody({
    hipFar, kFar, fFar,
    hipNear, kNear, fNear,
    bottomType: bType,
    shoeType: sType,
    pantsCol,
    shoeCol,
    skin,
    hipY,
    ink,
    facing,
    flipX
  });

  // 4. Neck
  const neckX = isFront ? 0 : 1;
  const neckW = isFront ? 8 : 7;
  s += `  <path d="M ${neckX - neckW} ${headY + 28} L ${neckX + neckW} ${headY + 28} L ${neckX + neckW + 2} ${shY + 2} L ${neckX - neckW - 2} ${shY + 2} Z" fill="${skin}" stroke="${ink}" stroke-width="3" />\n`;
  s += `  <ellipse cx="${neckX}" cy="${headY + 31}" rx="${neckW}" ry="3" fill="rgba(0,0,0,0.12)" />\n`;

  // 5. Torso
  const torsoBotY = outfit.type === 'labcoat' ? hipY + 12 : hipY;
  if (isFront) {
    s += `  <path d="M -23 ${shY} Q 0 ${shY - 6} 23 ${shY} L 19 ${torsoBotY} Q 0 ${torsoBotY + 3} -19 ${torsoBotY} Z" fill="${topCol}" stroke="${ink}" stroke-width="4" />\n`;
    s += `  <path d="M -11 ${shY - 1} Q 0 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />\n`;
    if (outfit.type === 'hoodie') {
      s += `  <path d="M -12 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -14 ${hipY - 2} Z" fill="${topCol2}" stroke="${ink}" stroke-width="2.5" />\n`;
      s += `  <line x1="-4" y1="${shY + 3}" x2="-4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
      s += `  <line x1="4" y1="${shY + 3}" x2="4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />\n`;
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
  s += `  <g transform="translate(${headCenterX} ${headY})">\n`;
  const r = 36 * headScale;
  const hairStyle = char.hair?.style || 'short';
  if (hairStyle === 'bun') {
    s += `    <circle cx="${-r * 0.65}" cy="${-r * 0.7}" r="17" fill="${hairCol}" stroke="${ink}" stroke-width="4" />\n`;
  }

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

  eyeX.forEach((ex, i) => {
    const rx = !isFront && i === 0 ? 4.6 : 5.4;
    s += `    <ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="7.2" fill="${ink}" />\n`;
    s += `    <circle cx="${ex + 1.8}" cy="${eyeY - 2.2}" r="2.2" fill="#ffffff" />\n`;
  });

  eyeX.forEach(ex => {
    s += `    <path d="M ${ex - 6} ${eyeY - 10} Q ${ex} ${eyeY - 12} ${ex + 6} ${eyeY - 10}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" fill="none" />\n`;
  });

  const mx = isFront ? 0 : isSide ? 14 : 7;
  const my = eyeY + 18;
  s += `    <path d="M ${mx - 5} ${my - 1} Q ${mx} ${my + 4} ${mx + 5} ${my - 1}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />\n`;

  // Front hair
  if (hairStyle === 'spiky') {
    if (isFront) {
      s += `    <path d="M -39 -2 C -40 -26, -24 -42, 0 -42 C 24 -42, 40 -26, 39 -2 L 34 16 L 31 -2 L 24 -6 L 18 4 L 12 -8 L 4 4 L -4 -6 L -12 4 L -18 -8 L -24 -4 L -31 -2 L -34 16 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
    } else {
      s += `    <path d="M -36 -4 C -37 -28, -20 -42, 4 -42 C 28 -42, 40 -26, 38 -4 L 33 16 L 28 -2 L 20 -8 L 12 4 L 2 -8 L -6 4 L -14 -8 L -24 -2 L -32 15 Z" fill="${hairCol}" stroke="${ink}" stroke-width="3.8" />\n`;
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

  // Headwear (Jake's cap)
  if (outfit.headwear === 'cap') {
    s += `    <ellipse cx="0" cy="${-r * 0.35}" rx="${r * 1.05}" ry="${r * 0.8}" fill="${outfit.headwearColor || '#f2c21a'}" stroke="${ink}" stroke-width="4" />\n`;
    s += `    <path d="M 0 ${-r * 0.35} Q ${r * 1.5} ${-r * 0.28} ${r * 1.5} ${-r * 0.12}" stroke="${ink}" stroke-width="5" stroke-linecap="round" fill="none" />\n`;
  }

  s += `  </g>\n`; // Head group

  // 7. Near Arm
  s += `  <line x1="${shNear[0]}" y1="${shNear[1]}" x2="${eNear[0]}" y2="${eNear[1]}" stroke="${topCol}" stroke-width="12" />\n`;
  s += `  <line x1="${eNear[0]}" y1="${eNear[1]}" x2="${hNear[0]}" y2="${hNear[1]}" stroke="${topCol}" stroke-width="10.5" />\n`;
  s += `  <circle cx="${eNear[0]}" cy="${eNear[1]}" r="5.5" fill="${topCol}" />\n`;
  s += `  <circle cx="${hNear[0]}" cy="${hNear[1]}" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />\n`;

  s += `</g>\n`;
  return s;
}

// -------------------------------------------------------------
// Test Runner & PNG Generator
// -------------------------------------------------------------
async function run() {
  const jake = getCharacter('chibi_jake');
  const luna = getCharacter('chibi_luna');

  console.log('Running Redesigned Shoe Test Suite...');

  // 1. High-Res Close-ups of Shoes (Front)
  let svgFront = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -60 240 80" width="960" height="320" style="background:#f8fafc">\n`;
  svgFront += `<line x1="-120" y1="0" x2="120" y2="0" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 4" />\n`;
  svgFront += `<text x="0" y="16" font-family="Arial" font-size="10" fill="#64748b" text-anchor="middle">Ground Line (y = 0)</text>\n`;

  // Left pair: Sneakers (Jake / Max)
  svgFront += `<g transform="translate(-70 0)">\n`;
  svgFront += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Sneakers (Front - Jake)</text>\n`;
  svgFront += `  <line x1="-13" y1="-30" x2="-13" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgFront += `  <line x1="13" y1="-30" x2="13" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgFront += `  <line x1="-18.5" y1="-9" x2="-7.5" y2="-9" stroke="#191918" stroke-width="2.2" stroke-linecap="round" />\n`;
  svgFront += `  <line x1="7.5" y1="-9" x2="18.5" y2="-9" stroke="#191918" stroke-width="2.2" stroke-linecap="round" />\n`;
  svgFront += renderNewShoe({ x: -13, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'front', isLeftFoot: false });
  svgFront += renderNewShoe({ x: 13, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'front', isLeftFoot: true });
  svgFront += `</g>\n`;

  // Center pair: Casual / Loafer (Luna)
  svgFront += `<g transform="translate(0 0)">\n`;
  svgFront += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Casual Flats (Front - Luna)</text>\n`;
  svgFront += `  <line x1="-13" y1="-30" x2="-13" y2="-8" stroke="#ffe8d6" stroke-width="10.5" stroke-linecap="round" />\n`;
  svgFront += `  <line x1="13" y1="-30" x2="13" y2="-8" stroke="#ffe8d6" stroke-width="10.5" stroke-linecap="round" />\n`;
  svgFront += renderNewShoe({ x: -13, y: 0, shoeType: 'casual', shoeColor: '#831843', facing: 'front', isLeftFoot: false });
  svgFront += renderNewShoe({ x: 13, y: 0, shoeType: 'casual', shoeColor: '#831843', facing: 'front', isLeftFoot: true });
  svgFront += `</g>\n`;

  // Right pair: Boots (Doc)
  svgFront += `<g transform="translate(70 0)">\n`;
  svgFront += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Boots (Front - Doc)</text>\n`;
  svgFront += `  <line x1="-13" y1="-30" x2="-13" y2="-13" stroke="#1f2937" stroke-width="12" stroke-linecap="round" />\n`;
  svgFront += `  <line x1="13" y1="-30" x2="13" y2="-13" stroke="#1f2937" stroke-width="12" stroke-linecap="round" />\n`;
  svgFront += renderNewShoe({ x: -13, y: 0, shoeType: 'boots', shoeColor: '#0f172a', facing: 'front', isLeftFoot: false });
  svgFront += renderNewShoe({ x: 13, y: 0, shoeType: 'boots', shoeColor: '#0f172a', facing: 'front', isLeftFoot: true });
  svgFront += `</g>\n`;
  svgFront += `</svg>\n`;

  await sharp(Buffer.from(svgFront)).png().toFile(path.join(OUT_DIR, 'closeup_shoes_front.png'));
  console.log('✓ closeup_shoes_front.png created.');

  // 2. High-Res Close-ups of Shoes (3/4 & Side Angles & Walk Cycle)
  let svgAngles = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-120 -60 240 80" width="960" height="320" style="background:#f8fafc">\n`;
  svgAngles += `<line x1="-120" y1="0" x2="120" y2="0" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 4" />\n`;
  svgAngles += `<text x="0" y="16" font-family="Arial" font-size="10" fill="#64748b" text-anchor="middle">Ground Line (y = 0)</text>\n`;

  // 3/4 View Near & Far
  svgAngles += `<g transform="translate(-70 0)">\n`;
  svgAngles += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">3/4 View (Near &amp; Far)</text>\n`;
  svgAngles += `  <line x1="-10" y1="-30" x2="-10" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgAngles += `  <line x1="12" y1="-30" x2="12" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgAngles += renderNewShoe({ x: -10, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'three_quarter_right', isNear: false });
  svgAngles += renderNewShoe({ x: 12, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'three_quarter_right', isNear: true });
  svgAngles += `</g>\n`;

  // Side View Stand
  svgAngles += `<g transform="translate(0 0)">\n`;
  svgAngles += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Side View (Stand - Profile)</text>\n`;
  svgAngles += `  <line x1="0" y1="-30" x2="0" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgAngles += renderNewShoe({ x: 0, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'side_right', isNear: true });
  svgAngles += `</g>\n`;

  // Side View Walk (Lifted & Grounded)
  svgAngles += `<g transform="translate(70 0)">\n`;
  svgAngles += `  <text x="0" y="-35" font-family="Arial" font-size="11" font-weight="bold" fill="#334155" text-anchor="middle">Side View (Walk Cycle: Lift &amp; Plant)</text>\n`;
  svgAngles += `  <line x1="-15" y1="-28" x2="-16" y2="-13" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgAngles += renderNewShoe({ x: -16, y: -5, shoeType: 'sneakers', shoeColor: '#111827', facing: 'side_right', isNear: false, footAngle: -14, isGrounded: false });
  svgAngles += `  <line x1="16" y1="-26" x2="18" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgAngles += renderNewShoe({ x: 18, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'side_right', isNear: true, isGrounded: true });
  svgAngles += `</g>\n`;
  svgAngles += `</svg>\n`;

  await sharp(Buffer.from(svgAngles)).png().toFile(path.join(OUT_DIR, 'closeup_shoes_angles_walk.png'));
  console.log('✓ closeup_shoes_angles_walk.png created.');

  // 3. Stand vs Walk Comparison (Jake & Luna)
  let svgStandWalk = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 480" width="1000" height="480" style="background:#ffffff">\n`;
  svgStandWalk += `<text x="500" y="35" font-family="Arial" font-size="20" font-weight="bold" fill="#0f172a" text-anchor="middle">REDESIGNED SHOES: JAKE (PANTS/SNEAKERS) &amp; LUNA (SKIRT/CASUAL) — STAND VS WALK</text>\n`;
  svgStandWalk += `<line x1="40" y1="410" x2="960" y2="410" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  const standWalkPairs = [
    { label: 'Jake: Stand (Front)', char: jake, opts: { pose: 'stand', facing: 'front' }, cx: 150 },
    { label: 'Jake: Walk (Front)', char: jake, opts: { pose: 'walk', facing: 'front' }, cx: 380 },
    { label: 'Luna: Stand (Front)', char: luna, opts: { pose: 'stand', facing: 'front' }, cx: 620 },
    { label: 'Luna: Walk (Front)', char: luna, opts: { pose: 'walk', facing: 'front' }, cx: 850 }
  ];

  standWalkPairs.forEach(p => {
    svgStandWalk += `  <text x="${p.cx}" y="80" font-family="Arial" font-size="14" font-weight="bold" fill="#334155" text-anchor="middle">${p.label}</text>\n`;
    svgStandWalk += `  <g transform="translate(${p.cx} 410)">\n`;
    svgStandWalk += renderFullChibi({ char: p.char, ...p.opts });
    svgStandWalk += `  </g>\n`;
  });
  svgStandWalk += `</svg>\n`;

  await sharp(Buffer.from(svgStandWalk)).png().toFile(path.join(OUT_DIR, 'redesigned_shoes_stand_walk_comparison.png'));
  console.log('✓ redesigned_shoes_stand_walk_comparison.png created.');

  // 4. Jake across 5 facings
  const facings = [
    { id: 'front', label: '1. Front' },
    { id: 'three_quarter_right', label: '2. Three-Quarter Right' },
    { id: 'three_quarter_left', label: '3. Three-Quarter Left' },
    { id: 'side_right', label: '4. Side Right' },
    { id: 'side_left', label: '5. Side Left' }
  ];

  let svgJake5 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 360" width="1000" height="360" style="background:#ffffff">\n`;
  svgJake5 += `<text x="500" y="35" font-family="Arial" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">JAKE (BLUE SHIRT / PANTS / SNEAKERS) — 5 FACINGS PREVIEW</text>\n`;
  svgJake5 += `<line x1="40" y1="300" x2="960" y2="300" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  facings.forEach((f, i) => {
    const cx = 110 + i * 195;
    svgJake5 += `  <text x="${cx}" y="70" font-family="Arial" font-size="13" font-weight="bold" fill="#334155" text-anchor="middle">${f.label}</text>\n`;
    svgJake5 += `  <g transform="translate(${cx} 300)">\n`;
    svgJake5 += renderFullChibi({ char: jake, pose: 'stand', facing: f.id });
    svgJake5 += `  </g>\n`;
  });
  svgJake5 += `</svg>\n`;

  await sharp(Buffer.from(svgJake5)).png().toFile(path.join(OUT_DIR, 'redesigned_shoes_5_facings_jake.png'));
  console.log('✓ redesigned_shoes_5_facings_jake.png created.');

  // 5. Luna across 5 facings
  let svgLuna5 = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 360" width="1000" height="360" style="background:#ffffff">\n`;
  svgLuna5 += `<text x="500" y="35" font-family="Arial" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">LUNA (PINK DRESS / SKIRT / CASUAL FLATS) — 5 FACINGS PREVIEW</text>\n`;
  svgLuna5 += `<line x1="40" y1="300" x2="960" y2="300" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  facings.forEach((f, i) => {
    const cx = 110 + i * 195;
    svgLuna5 += `  <text x="${cx}" y="70" font-family="Arial" font-size="13" font-weight="bold" fill="#334155" text-anchor="middle">${f.label}</text>\n`;
    svgLuna5 += `  <g transform="translate(${cx} 300)">\n`;
    svgLuna5 += renderFullChibi({ char: luna, pose: 'stand', facing: f.id });
    svgLuna5 += `  </g>\n`;
  });
  svgLuna5 += `</svg>\n`;

  await sharp(Buffer.from(svgLuna5)).png().toFile(path.join(OUT_DIR, 'redesigned_shoes_5_facings_luna.png'));
  console.log('✓ redesigned_shoes_5_facings_luna.png created.');

  // 6. Before vs After Redesign Comparison
  let svgComp = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 360" width="900" height="360" style="background:#ffffff">\n`;
  svgComp += `<text x="450" y="35" font-family="Arial" font-size="18" font-weight="bold" fill="#0f172a" text-anchor="middle">CHIBI V9 SHOE REDESIGN: BEFORE VS AFTER DIRECT COMPARISON</text>\n`;
  svgComp += `<line x1="30" y1="280" x2="870" y2="280" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6 4" />\n`;

  // Before card
  svgComp += `<g transform="translate(230 0)">\n`;
  svgComp += `  <rect x="-180" y="60" width="360" height="260" rx="8" fill="#fff1f2" stroke="#f43f5e" stroke-width="1.5" />\n`;
  svgComp += `  <text x="0" y="85" font-family="Arial" font-size="14" font-weight="bold" fill="#be123c" text-anchor="middle">❌ TRƯỚC (BEFORE): Lỗi Giày Oval &amp; Mảnh Trắng</text>\n`;
  svgComp += `  <text x="0" y="105" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• Giày oval dẹt nằm ngang, không có mũi và gót</text>\n`;
  svgComp += `  <text x="0" y="122" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• Vệt trắng mảnh hình lỗi xuất hiện lạc quẻ</text>\n`;
  svgComp += `  <text x="0" y="139" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• Cổ chân không ăn khớp cổ giày</text>\n`;
  // Drawing old buggy shoe
  svgComp += `  <g transform="translate(0 280)">\n`;
  svgComp += `    <line x1="-15" y1="-80" x2="-15" y2="-5" stroke="#374151" stroke-width="14" stroke-linecap="round" />\n`;
  svgComp += `    <line x1="15" y1="-80" x2="15" y2="-5" stroke="#374151" stroke-width="14" stroke-linecap="round" />\n`;
  svgComp += `    <g transform="translate(-15 0)">\n`;
  svgComp += `      <path d="M -13 -8 Q -5 -9 11 -8 Q 11 -3.5 11 0 L -13 0 Z" fill="#1e1e24" stroke="#191918" stroke-width="2.5" />\n`;
  svgComp += `      <rect x="-13" y="-3" width="24" height="3" fill="#ffffff" stroke="#191918" stroke-width="1.8" />\n`;
  svgComp += `      <path d="M 5 -3.5 Q 7 -6 11 -4 Q 11 -3.5 11 -3.5 Z" fill="#ffffff" stroke="#191918" stroke-width="1.8" />\n`;
  svgComp += `      <line x1="-3" y1="-7" x2="2" y2="-5.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />\n`;
  svgComp += `    </g>\n`;
  svgComp += `    <g transform="translate(15 0)">\n`;
  svgComp += `      <path d="M -13 -8 Q -5 -9 11 -8 Q 11 -3.5 11 0 L -13 0 Z" fill="#1e1e24" stroke="#191918" stroke-width="2.5" />\n`;
  svgComp += `      <rect x="-13" y="-3" width="24" height="3" fill="#ffffff" stroke="#191918" stroke-width="1.8" />\n`;
  svgComp += `      <path d="M 5 -3.5 Q 7 -6 11 -4 Q 11 -3.5 11 -3.5 Z" fill="#ffffff" stroke="#191918" stroke-width="1.8" />\n`;
  svgComp += `      <line x1="-3" y1="-7" x2="2" y2="-5.5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />\n`;
  svgComp += `    </g>\n`;
  svgComp += `  </g>\n`;
  svgComp += `</g>\n`;

  // After card
  svgComp += `<g transform="translate(670 0)">\n`;
  svgComp += `  <rect x="-180" y="60" width="360" height="260" rx="8" fill="#f0fdf4" stroke="#22c55e" stroke-width="1.5" />\n`;
  svgComp += `  <text x="0" y="85" font-family="Arial" font-size="14" font-weight="bold" fill="#15803d" text-anchor="middle">✓ SAU (AFTER): Hình Học Giày Chibi Chuẩn</text>\n`;
  svgComp += `  <text x="0" y="105" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• 5 thành phần rõ: Upper, Toe Cap, Heel, Collar, Sole</text>\n`;
  svgComp += `  <text x="0" y="122" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• Mũi hướng ra ngoài tự nhiên, đế phẳng chạm sàn y=0</text>\n`;
  svgComp += `  <text x="0" y="139" font-family="Arial" font-size="11" fill="#475569" text-anchor="middle">• Không còn vệt trắng lỗi, cổ chân đi sâu vào cổ giày</text>\n`;
  // Drawing new shoe
  svgComp += `  <g transform="translate(0 280)">\n`;
  svgComp += `    <line x1="-14" y1="-80" x2="-14" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgComp += `    <line x1="14" y1="-80" x2="14" y2="-8" stroke="#374151" stroke-width="12" stroke-linecap="round" />\n`;
  svgComp += `    <line x1="-19.5" y1="-9" x2="-8.5" y2="-9" stroke="#191918" stroke-width="2.2" stroke-linecap="round" />\n`;
  svgComp += `    <line x1="8.5" y1="-9" x2="19.5" y2="-9" stroke="#191918" stroke-width="2.2" stroke-linecap="round" />\n`;
  svgComp += renderNewShoe({ x: -14, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'front', isLeftFoot: false });
  svgComp += renderNewShoe({ x: 14, y: 0, shoeType: 'sneakers', shoeColor: '#111827', facing: 'front', isLeftFoot: true });
  svgComp += `  </g>\n`;
  svgComp += `</g>\n`;

  svgComp += `</svg>\n`;

  await sharp(Buffer.from(svgComp)).png().toFile(path.join(OUT_DIR, 'before_vs_after_shoe_redesign.png'));
  console.log('✓ before_vs_after_shoe_redesign.png created.');
}

run().catch(console.error);
