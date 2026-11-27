// engine/chibi-rig2d.js — Chibi Character System V2 2D Character Rig and Renderer for Thanh Hai 2D Studio.
// Implements the authentic Chibi V2 puppet anatomy on HTML5 Canvas:
// - Anatomical skull contour with tapered chin and rounded cheeks (matching ChibiCharacterV2).
// - 5-Direction Perspective System: 'front', 'three_quarter_left', 'three_quarter_right', 'side_left', 'side_right'.
// - Character Identity integration with Tab 3 Character Library (Max, Jake, Doc, Luna).
// - Modular Outfits: hoodie with pouch & drawstrings, tshirt, labcoat with tie & pen, suit, dress.
// - Full Hair System with highlights (short bangs, spiky, side_part, twintails, cap).
// - Redesigned 5-Component Shoe Geometry: sole flat at ground y=0, upper, heel, collar, toe_cap, laces.
// - Kinematic pose retargeting from Thanh Hai POSES preserving animation and scenery contact.

import { E, S, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease } from './core.js';
import { drawUnifiedCharacter, resolveCharacter, normalizeViewDirection } from './unified-character-renderer.js';

export const CHIBI_SKINS = {
  light: ['#ffdfc4', '#fca5a5'],
  fair:  ['#fcdcc6', '#fca5a5'],
  tan:   ['#f5d0b5', '#e2a882'],
  olive: ['#c99c6e', '#a97e52'],
  brown: ['#a8754d', '#8a5c38'],
  dark:  ['#7a4e32', '#603b24']
};

export const CHIBI_PRESETS = {
  chibi_max: {
    id: 'chibi_max',
    name: 'Max',
    skin: '#ffdfc4',
    hair: 'short',
    hairColor: '#4a3728',
    hairHighlight: '#7a5c43',
    top: 'hoodie',
    color: '#d64a33',
    topColor2: '#b83822',
    legs: '#2e384d',
    shoes: '#1e1e24',
    shoeType: 'sneakers',
    head: 'none',
    face: 'none',
    blush: true
  },
  chibi_jake: {
    id: 'chibi_jake',
    name: 'Jake',
    skin: '#fcdcc6',
    hair: 'spiky',
    hairColor: '#232029',
    hairHighlight: '#423d4c',
    head: 'cap',
    headColor: '#f2c21a',
    top: 'tshirt',
    color: '#3b82f6',
    topColor2: '#1d4ed8',
    legs: '#374151',
    shoes: '#111827',
    shoeType: 'sneakers',
    face: 'none',
    blush: false
  },
  chibi_doc: {
    id: 'chibi_doc',
    name: 'Doc',
    skin: '#ffe5d4',
    hair: 'side_part',
    hairColor: '#6b7280',
    hairHighlight: '#9ca3af',
    head: 'none',
    face: 'glasses',
    top: 'labcoat',
    color: '#f3f4f6',
    topColor2: '#cbd5e1',
    legs: '#1f2937',
    shoes: '#0f172a',
    shoeType: 'casual',
    blush: false
  },
  chibi_luna: {
    id: 'chibi_luna',
    name: 'Luna',
    skin: '#fde2d0',
    hair: 'twintails',
    hairColor: '#7c3aed',
    hairHighlight: '#a78bfa',
    head: 'none',
    face: 'none',
    top: 'dress',
    color: '#f472b6',
    legs: '#fde2d0',
    shoes: '#475569',
    shoeType: 'casual',
    blush: true
  }
};

/**
 * Ánh xạ trang phục sang Character Identity V2 hoàn chỉnh
 */
export function resolveCharacterIdentity(o = {}) {
  const of = o.outfit || {};
  const explicitId = o.characterId || o.id || of.characterId || of.id;
  if (explicitId) {
    const res = resolveCharacter(o.character || o.profile || o);
    if (res.resolved && res.profile) return res.profile;
    // NEVER silently substitute CHIBI_PRESETS.chibi_max for an unresolved explicit ID!
    return null;
  }

  let base = null;
  if (of.name && CHIBI_PRESETS[`chibi_${of.name.toLowerCase()}`]) base = CHIBI_PRESETS[`chibi_${of.name.toLowerCase()}`];
  else if (of.top === 'hoodie' || of.color === '#d64a33') base = CHIBI_PRESETS.chibi_max;
  else if (of.head === 'cap' || of.top === 'tshirt' || of.color === '#3a6ea5' || of.color === '#3b82f6') base = CHIBI_PRESETS.chibi_jake;
  else if (of.top === 'labcoat' || of.face === 'glasses') base = CHIBI_PRESETS.chibi_doc;
  else if (of.top === 'dress' || of.hair === 'twintails') base = CHIBI_PRESETS.chibi_luna;
  else return null;

  return { ...base, ...of };
}

/**
 * Xác định góc nhìn 5 chiều (5-direction perspective)
 */
export function resolveFacingDirection(o, facing) {
  if (o.direction) return o.direction;
  if (o.front) return 'front';
  if (facing > 0.4) return 'three_quarter_right';
  if (facing < -0.4) return 'three_quarter_left';
  return facing >= 0 ? 'side_right' : 'side_left';
}

/**
 * Retargeting từ Pose người que (chiều cao ~240) sang tỷ lệ Chibi V2 chuẩn
 */
export function retargetPoseToChibi(p, o) {
  const [hx, hy] = p.hip || [0, -100];
  const [sx, sy] = p.sh || [0, -174];
  const [headX, headY] = p.head || [3, -208];

  // Phát hiện tư thế ngồi: cờ o.sit hoặc p.hip > -85 hoặc đầu gối gập ngang
  const isSit = o.sit === true || hy > -85 || (p.kF && p.kF[1] < p.hip[1] + 15);
  const torsoLen = isSit ? 40 : 38;
  const torsoAngle = Math.atan2(sx - hx, -(sy - hy));

  const armScale = 0.58;
  const legScale = 0.46;

  // Tính vector chi chính xác: lấy vector từ source joint - source root
  const retargetLimb = (sourceRoot, sourceJoint, sourceTip, targetRoot, scale) => {
    const v1x = (sourceJoint[0] - sourceRoot[0]) * scale;
    const v1y = (sourceJoint[1] - sourceRoot[1]) * scale;
    const j = [targetRoot[0] + v1x, targetRoot[1] + v1y];
    const v2x = (sourceTip[0] - sourceJoint[0]) * scale;
    const v2y = (sourceTip[1] - sourceJoint[1]) * scale;
    const t = [j[0] + v2x, j[1] + v2y];
    return [j, t];
  };

  let chibiHip, chibiSh, chibiHead;
  let kF, fF, kB, fB;
  let eF, hF, eB, hB;

  if (isSit) {
    // 1. Hông đặt vững vàng trên mặt đệm ghế café (y = -72 đến -74), lưng tựa sát thành ghế
    chibiHip = [-8, -72];
    chibiSh = [
      chibiHip[0] + Math.sin(torsoAngle) * torsoLen + 2,
      chibiHip[1] - Math.cos(torsoAngle) * torsoLen
    ];
    chibiHead = [
      chibiSh[0] + (headX - sx) * 0.35 + 2,
      chibiSh[1] - 40
    ];

    // 2. Chân dáng ngồi: đùi vươn ngang qua đệm ghế, cẳng chân buông xuống sàn y = 0
    kF = [28, -72];
    fF = [30, 0];
    kB = [22, -72];
    fB = [24, 0];

    // 3. Tay dáng ngồi: kiểm tra xem pose có cử động tay riêng (cầm điện thoại, giơ tay, gạt cốc...)
    const hasCustomArm = p.eF && (Math.abs(p.eF[0] - p.sh[0]) > 6 || Math.abs(p.eF[1] - p.sh[1]) < 48 || p.hF[1] < p.sh[1] + 10);
    if (hasCustomArm) {
      [eF, hF] = retargetLimb(p.sh, p.eF, p.hF, chibiSh, armScale);
      [eB, hB] = retargetLimb(p.sh, p.eB, p.hB, chibiSh, armScale);
    } else {
      // Dáng ngồi nghỉ ngơi mặc định: tay đặt nhẹ nhàng lên đùi/mặt bàn
      eF = [chibiSh[0] + 10, chibiSh[1] + 24];
      hF = [chibiHip[0] + 26, chibiHip[1] + 2];
      eB = [chibiSh[0] + 6, chibiSh[1] + 24];
      hB = [chibiHip[0] + 20, chibiHip[1] + 2];
    }
  } else {
    chibiHip = [0, -42];
    chibiSh = [
      chibiHip[0] + Math.sin(torsoAngle) * torsoLen,
      chibiHip[1] - Math.cos(torsoAngle) * torsoLen
    ];
    chibiHead = [
      chibiSh[0] + (headX - sx) * 0.35,
      chibiSh[1] - 40
    ];

    [eF, hF] = retargetLimb(p.sh, p.eF || [9, -137], p.hF || [13, -101], chibiSh, armScale);
    [eB, hB] = retargetLimb(p.sh, p.eB || [-7, -136], p.hB || [-9, -100], chibiSh, armScale);
    [kF, fF] = retargetLimb(p.hip, p.kF || [6, -50], p.fF || [3, 0], chibiHip, legScale);
    [kB, fB] = retargetLimb(p.hip, p.kB || [-6, -50], p.fB || [-11, 0], chibiHip, legScale);
  }

  const lowestY = Math.max(fF[1], fB[1]);
  const groundOffset = -lowestY;
  const shiftY = (pt, dy) => [pt[0], pt[1] + dy];

  return {
    isSit,
    hip: shiftY(chibiHip, groundOffset),
    sh: shiftY(chibiSh, groundOffset),
    head: shiftY(chibiHead, groundOffset),
    eF: shiftY(eF, groundOffset),
    hF: shiftY(hF, groundOffset),
    eB: shiftY(eB, groundOffset),
    hB: shiftY(hB, groundOffset),
    kF: shiftY(kF, groundOffset),
    fF: shiftY(fF, groundOffset),
    kB: shiftY(kB, groundOffset),
    fB: shiftY(fB, groundOffset)
  };
}

/**
 * Vẽ khối đầu Chibi V2 có gò má và cằm thon gọn
 */
function drawChibiHead(g, hx, hy, HR, char, inkCol, dir) {
  const isFront = dir === 'front';
  const isSide = dir.startsWith('side');
  const sHead = HR / 36;
  const skin = char.skin || '#ffdfc4';

  g.save();
  g.translate(hx, hy);
  g.scale(sHead, sHead);

  // 1. Tóc sau (Back hair) cho Luna / Twintails
  if (char.hair === 'twintails') {
    g.fillStyle = char.hairColor || '#7c3aed';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    g.beginPath();
    g.ellipse(-34, 10, 16, 26, 0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.ellipse(34, 10, 16, 26, -0.2, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // 2. Khung xương sọ Chibi V2 (Tapered Chin & Cute Cheeks)
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;
  let skullPath;
  if (isFront) {
    skullPath = new Path2D("M 0 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 38 19, 31 29 C 24 37, 10 38, 0 38 C -10 38, -24 37, -31 29 C -38 19, -37 12, -37 -4 C -37 -22, -23 -36, 0 -36 Z");
  } else if (isSide) {
    skullPath = new Path2D("M 4 -36 C 23 -36, 36 -22, 36 -4 C 36 12, 34 20, 27 28 C 18 36, 8 38, 2 38 C -8 38, -18 35, -24 26 C -30 18, -32 10, -32 -4 C -32 -22, -18 -36, 4 -36 Z");
  } else {
    skullPath = new Path2D("M 2 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 36 19, 29 29 C 22 37, 10 38, -2 38 C -14 38, -24 35, -29 27 C -34 19, -35 12, -35 -4 C -35 -22, -21 -36, 2 -36 Z");
  }
  g.fill(skullPath);
  g.stroke(skullPath);

  // 3. Tai Chibi
  const earR = 6.5;
  if (isFront) {
    circle(g, -35, 2, earR, skin); g.stroke();
    circle(g, 35, 2, earR, skin); g.stroke();
  } else if (isSide) {
    circle(g, -24, 2, earR, skin); g.stroke();
  } else {
    circle(g, -32, 2, earR, skin); g.stroke();
  }

  // 4. Má hồng dễ thương
  if (char.blush !== false) {
    g.save();
    g.fillStyle = '#fca5a5';
    g.globalAlpha *= 0.42;
    if (isFront) {
      g.beginPath(); g.ellipse(-16, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(16, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    } else if (isSide) {
      g.beginPath(); g.ellipse(18, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    } else {
      g.beginPath(); g.ellipse(-5, 14, 5.5, 3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(19, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  g.restore();
}

/**
 * Cổ nối tự nhiên giữa đầu và thân
 */
function drawChibiNeck(g, hx, hy, sx, sy, HR, char, inkCol, dir) {
  const sHead = HR / 36;
  const isFront = dir === 'front';
  const neckW = (isFront ? 8 : 7) * sHead;
  const skin = char.skin || '#ffdfc4';

  g.save();
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(hx - neckW, hy + 28 * sHead);
  g.lineTo(hx + neckW, hy + 28 * sHead);
  g.lineTo(sx + neckW + 2, sy + 2);
  g.lineTo(sx - neckW - 2, sy + 2);
  g.closePath();
  g.fill();
  g.stroke();

  // Đổ bóng cằm
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(hx, hy + 31 * sHead, neckW, 3 * sHead, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * Mắt anime và ngũ quan Chibi V2
 */
function drawChibiEyes(g, hx, hy, HR, o, dir, inkCol) {
  const sHead = HR / 36;
  const isFront = dir === 'front';
  const isSide = dir.startsWith('side');
  const eyeY = hy + 2 * sHead;
  const eyeX = isFront ? [hx - 14 * sHead, hx + 14 * sHead] : isSide ? [hx + 16 * sHead] : [hx - 5 * sHead, hx + 18 * sHead];
  const look = o.look || [0, 0];
  const lookDx = (look[0] || 0) * 1.5 * sHead;
  const lookDy = (look[1] || 0) * 1.5 * sHead;
  const expr = o.expr || 'neutral';
  const blink = o.blink || expr === 'closed' || expr === 'sleepy';

  g.save();
  if (blink || expr === 'sad') {
    g.strokeStyle = inkCol;
    g.lineWidth = 3.5;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(ex, eyeY + 2 * sHead, 5 * sHead, 0.2, Math.PI - 0.2);
      g.stroke();
    });
  } else if (expr === 'happy' || expr === 'joy') {
    g.strokeStyle = inkCol;
    g.lineWidth = 3.8;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(ex, eyeY + 3 * sHead, 6 * sHead, Math.PI + 0.3, Math.PI * 2 - 0.3);
      g.stroke();
    });
  } else {
    eyeX.forEach((ex, i) => {
      const rx = (!isFront && i === 0 ? 4.6 : 5.4) * sHead;
      const ry = 7.2 * sHead;
      g.fillStyle = inkCol;
      g.beginPath();
      g.ellipse(ex + lookDx, eyeY + lookDy, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + 1.8 * sHead, eyeY + lookDy - 2.2 * sHead, 2.2 * sHead, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Lông mày
  let browDy = 0;
  if (expr === 'worried') browDy = -2 * sHead;
  if (expr === 'angry' || expr === 'determined') browDy = 3 * sHead;
  if (expr === 'surprised' || expr === 'shocked') browDy = -3.5 * sHead;

  g.strokeStyle = inkCol;
  g.lineWidth = 2.8;
  eyeX.forEach(ex => {
    g.beginPath();
    g.moveTo(ex - 6 * sHead, eyeY - 10 * sHead + browDy);
    g.quadraticCurveTo(ex, eyeY - 12 * sHead + browDy, ex + 6 * sHead, eyeY - 10 * sHead - browDy);
    g.stroke();
  });

  // Miệng
  const mx = isFront ? hx : isSide ? hx + 14 * sHead : hx + 7 * sHead;
  const my = eyeY + 18 * sHead;
  const talk = o.talk || 0;

  if (talk > 0.08 || expr === 'laughing') {
    const openH = (3 + talk * 7 + (expr === 'laughing' ? 4 : 0)) * sHead;
    g.fillStyle = inkCol;
    g.beginPath();
    g.ellipse(mx, my, 5.5 * sHead, openH, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f87171';
    g.beginPath();
    g.arc(mx, my + openH * 0.5, 4 * sHead, 0, Math.PI);
    g.fill();
  } else {
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    if (expr === 'smile' || expr === 'happy') {
      g.arc(mx, my - 2 * sHead, 6 * sHead, 0.3, Math.PI - 0.3);
    } else if (expr === 'smirk') {
      g.arc(mx + 2 * sHead, my - 2 * sHead, 6 * sHead, 0.1, Math.PI - 0.6);
    } else if (expr === 'surprised' || expr === 'shocked') {
      g.ellipse(mx, my, 3.5 * sHead, 5 * sHead, 0, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.arc(mx, my - 2 * sHead, 4.5 * sHead, 0.4, Math.PI - 0.4);
    }
    g.stroke();
  }

  g.restore();
}

/**
 * Tóc Chibi V2 có lọn mái và highlight
 */
function drawChibiHair(g, hx, hy, HR, char, inkCol, dir) {
  const sHead = HR / 36;
  const hairCol = char.hairColor || '#4a3728';
  const hairHi = char.hairHighlight || shade(hairCol, 0.35);

  g.save();
  g.translate(hx, hy);
  g.scale(sHead, sHead);
  g.fillStyle = hairCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  if (char.hair === 'spiky') {
    const spikyP = new Path2D("M -40 -2 C -41 -26, -26 -41, 0 -41 C 26 -41, 41 -26, 40 -2 C 38 8, 36 16, 33 17 C 32 11, 30 2, 27 -2 L 23 2 L 15 -14 L 8 4 L 0 -10 L -8 4 L -16 -12 L -22 3 L -28 -5 C -32 2, -33 10, -35 17 C -37 12, -39 4, -40 -2 Z");
    g.fill(spikyP);
    g.stroke(spikyP);
    g.strokeStyle = hairHi;
    g.lineWidth = 3;
    g.stroke(new Path2D("M -22 -32 Q 0 -36 22 -32"));
  } else if (char.hair === 'side_part') {
    const sidePartP = new Path2D("M -38 -2 C -39 -24, -25 -40, 0 -40 C 25 -40, 39 -24, 38 -2 C 37 8, 35 15, 33 16 C 32 10, 30 2, 28 -3 L 22 0 L 12 -4 L 0 -8 L -12 -6 L -22 -1 L -28 -4 C -32 2, -33 10, -35 16 C -37 11, -38 4, -38 -2 Z");
    g.fill(sidePartP);
    g.stroke(sidePartP);
    g.strokeStyle = hairHi;
    g.lineWidth = 3;
    g.stroke(new Path2D("M -20 -32 Q 0 -36 20 -32"));
  } else {
    // Max / short bangs
    const shortP = new Path2D("M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 6, 36 14, 34 16 C 33 11, 33 2, 31 -4 L 26 -2 L 18 -10 L 10 2 L 3 -6 L -4 2 L -12 -8 L -20 -1 L -26 -7 C -31 0, -32 9, -34 16 C -36 12, -38 4, -39 -2 Z");
    g.fill(shortP);
    g.stroke(shortP);
    g.strokeStyle = hairHi;
    g.lineWidth = 3;
    g.stroke(new Path2D("M -22 -32 Q 0 -36 22 -32"));
  }

  g.restore();
}

/**
 * Mũ & Phụ kiện đầu
 */
function drawChibiHeadwear(g, hx, hy, HR, char, inkCol, dir) {
  const head = char.head;
  if (!head || head === 'none') return;
  const sHead = HR / 36;
  const col = char.headColor || '#f2c21a';
  const isBack = head === 'capBack';
  const visorDir = isBack ? -1 : 1;

  g.save();
  g.translate(hx, hy);
  g.scale(sHead, sHead);
  g.fillStyle = col;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  if (head === 'cap' || head === 'capBack') {
    g.beginPath();
    g.ellipse(0, -36 * 0.35, 36 * 1.05, 36 * 0.8, 0, Math.PI, Math.PI * 2);
    g.fill();
    g.stroke();
    // Lưỡi trai cong
    g.strokeStyle = inkCol;
    g.lineWidth = 5.5;
    g.beginPath();
    g.moveTo(visorDir * 36 * 0.2, -36 * 0.35);
    g.quadraticCurveTo(visorDir * 36 * 1.6, -36 * 0.28, visorDir * 36 * 1.55, -36 * 0.12);
    g.stroke();
  }

  g.restore();
}

/**
 * Thân áo và trang phục Chibi V2
 */
function drawChibiTorso(g, p, char, inkCol, dir, isSit = false) {
  const [sx, sy] = p.sh;
  const [hx, hy] = p.hip;
  const top = char.top || 'hoodie';
  const topCol = char.color || '#d64a33';
  const topCol2 = char.topColor2 || shade(topCol, -0.2);
  const pantsCol = char.legs || '#2e384d';
  const isFront = dir === 'front';

  g.save();
  g.fillStyle = topCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  if (isSit) {
    // 1. Khối hông/mông ngồi vững chắc trên đệm ghế café
    g.fillStyle = pantsCol;
    g.beginPath();
    g.moveTo(hx - 16, hy - 6);
    g.lineTo(hx + 20, hy - 6);
    g.lineTo(hx + 24, hy + 4);
    g.quadraticCurveTo(hx, hy + 7, hx - 18, hy + 4);
    g.closePath();
    g.fill();
    g.stroke();

    // 2. Thân áo dáng ngồi: ngực hướng về bàn (+x), lưng tựa về phía ghế (-x)
    g.fillStyle = topCol;
    g.beginPath();
    g.moveTo(sx - 16, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 19, sy);
    g.lineTo(hx + 22, hy);
    g.quadraticCurveTo(hx, hy + 3, hx - 17, hy);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (isFront) {
    // Thân áo dáng đứng trực diện
    const torsoBotY = top === 'labcoat' ? hy + 12 : hy;
    g.beginPath();
    g.moveTo(sx - 23, sy);
    g.quadraticCurveTo(sx, sy - 6, sx + 23, sy);
    g.lineTo(hx + 19, torsoBotY);
    g.quadraticCurveTo(hx, torsoBotY + 3, hx - 19, torsoBotY);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    // Thân áo dáng đứng 3/4 hoặc nghiêng
    const torsoBotY = top === 'labcoat' ? hy + 12 : hy;
    g.beginPath();
    g.moveTo(sx - 18, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 20, sy);
    g.lineTo(hx + 18, torsoBotY);
    g.quadraticCurveTo(hx, torsoBotY + 3, hx - 16, torsoBotY);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Cổ áo
  g.beginPath();
  g.moveTo(sx - 11, sy - 1);
  g.quadraticCurveTo(sx, sy + 6, sx + 11, sy - 1);
  g.stroke();

  if (top === 'hoodie') {
    // Túi kangaroo
    g.fillStyle = topCol2;
    g.beginPath();
    g.moveTo(hx - 12, hy - 14);
    g.lineTo(hx + 12, hy - 14);
    g.lineTo(hx + 14, hy - 2);
    g.lineTo(hx - 14, hy - 2);
    g.closePath();
    g.fill();
    g.stroke();
    // Dây áo hoodie trắng
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(sx - 4, sy + 3); g.lineTo(sx - 4, sy + 16); g.stroke();
    g.beginPath(); g.moveTo(sx + 4, sy + 3); g.lineTo(sx + 4, sy + 16); g.stroke();
  } else if (top === 'labcoat') {
    // Vạt áo blouse trắng & cà vạt đỏ
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(sx, sy + 6); g.lineTo(hx, hy + 12); g.stroke();
    g.fillStyle = '#dc2626';
    g.beginPath();
    g.moveTo(sx, sy + 8);
    g.lineTo(sx + 4, sy + 8);
    g.lineTo(sx + 5, sy + 22);
    g.lineTo(sx + 2, sy + 25);
    g.lineTo(sx - 1, sy + 22);
    g.closePath();
    g.fill();
    // Túi áo và bút bi xanh
    g.fillStyle = '#ffffff';
    rr(g, sx - 16, sy + 12, 10, 11, 2);
    g.fill();
    g.stroke();
    circle(g, sx - 11, sy + 11, 2.2, '#2563eb');
  } else if (top === 'suit') {
    g.fillStyle = '#dc2626';
    poly(g, [[sx - 3, sy + 2], [sx + 3, sy + 2], [sx + 4, sy + 28], [sx, sy + 34], [sx - 4, sy + 28]], '#dc2626');
    g.stroke();
  }

  g.restore();
}

/**
 * Vẽ giày Chibi V2 (Kiến trúc hình học 5 thành phần: sole, upper, heel, collar, toe_cap)
 */
function drawChibiShoe(g, x, y, shoeType, shoeColor, inkCol, isFront, isLeftFoot, isNear = true, footAngle = 0, isGrounded = true) {
  const rot = isGrounded ? 0 : footAngle;
  g.save();
  g.translate(x, y);

  if (isFront) {
    const scaleX = isLeftFoot ? 1 : -1;
    g.scale(scaleX, 1);
    if (rot) g.rotate(rot);

    if (shoeType === 'boots') {
      g.fillStyle = '#0f172a'; g.strokeStyle = inkCol; g.lineWidth = 2;
      g.fill(new Path2D("M -6 -3.5 L 9.5 -3.5 Q 10.5 -3.5 10.5 -1.5 L 10.5 0 L -6.5 0 L -6.5 -1.5 Q -6.5 -3.5 -6 -3.5 Z"));
      g.stroke(new Path2D("M -6 -3.5 L 9.5 -3.5 Q 10.5 -3.5 10.5 -1.5 L 10.5 0 L -6.5 0 L -6.5 -1.5 Q -6.5 -3.5 -6 -3.5 Z"));
      g.strokeStyle = '#334155'; g.lineWidth = 1.8;
      g.beginPath(); g.moveTo(-1.5, -2); g.lineTo(-1.5, 0); g.stroke();
      g.beginPath(); g.moveTo(4.5, -2); g.lineTo(4.5, 0); g.stroke();
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2.2;
      g.fill(new Path2D("M -5.5 -13.5 L 6.5 -13.5 Q 8.5 -8 9.5 -3.5 L -6 -3.5 Q -6.5 -8 -5.5 -13.5 Z"));
      g.stroke(new Path2D("M -5.5 -13.5 L 6.5 -13.5 Q 8.5 -8 9.5 -3.5 L -6 -3.5 Q -6.5 -8 -5.5 -13.5 Z"));
      g.fillStyle = '#334155'; rr(g, -6.5, -15, 14, 3, 1.5); g.fill(); g.stroke();
      g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.stroke(new Path2D("M 3.5 -3.5 Q 4 -6.5 8.5 -3.5"));
    } else if (shoeType === 'casual') {
      g.fillStyle = '#0f172a'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.fill(new Path2D("M -5 -2 L 8.5 -2 Q 9.5 -2 9.5 -0.8 L 9.5 0 L -5.5 0 L -5.5 -0.8 Q -5.5 -2 -5 -2 Z"));
      g.stroke(new Path2D("M -5 -2 L 8.5 -2 Q 9.5 -2 9.5 -0.8 L 9.5 0 L -5.5 0 L -5.5 -0.8 Q -5.5 -2 -5 -2 Z"));
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2;
      g.fill(new Path2D("M -5 -2 Q -5.5 -6 -3 -9 L 4 -9 Q 8.5 -6 8.5 -2 Z"));
      g.stroke(new Path2D("M -5 -2 Q -5.5 -6 -3 -9 L 4 -9 Q 8.5 -6 8.5 -2 Z"));
      g.fillStyle = '#1e293b'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.stroke(new Path2D("M -2.5 -9 Q 0.5 -7 3.5 -9"));
      g.stroke(new Path2D("M 3.5 -2 Q 4.5 -4.5 7.5 -2"));
    } else {
      // Sneakers
      g.fillStyle = '#ffffff'; g.strokeStyle = inkCol; g.lineWidth = 1.8;
      g.fill(new Path2D("M -5.5 -2.8 L 9 -2.8 Q 10 -2.8 10 -1.2 L 10 0 L -6 0 L -6 -1.2 Q -6 -2.8 -5.5 -2.8 Z"));
      g.stroke(new Path2D("M -5.5 -2.8 L 9 -2.8 Q 10 -2.8 10 -1.2 L 10 0 L -6 0 L -6 -1.2 Q -6 -2.8 -5.5 -2.8 Z"));
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2.2;
      g.fill(new Path2D("M -5 -2.8 Q -5.8 -6.5 -3.5 -9.5 L 4 -9.5 Q 8.5 -6 9 -2.8 Z"));
      g.stroke(new Path2D("M -5 -2.8 Q -5.8 -6.5 -3.5 -9.5 L 4 -9.5 Q 8.5 -6 9 -2.8 Z"));
      g.fillStyle = '#334155'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(0.5, -9.5, 4.8, 1.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffffff'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.fill(new Path2D("M 4 -2.8 Q 4 -5.5 6.8 -5.5 Q 9 -4.8 9 -2.8 Z"));
      g.stroke(new Path2D("M 4 -2.8 Q 4 -5.5 6.8 -5.5 Q 9 -4.8 9 -2.8 Z"));
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(-0.8, -7.8); g.lineTo(3.2, -7.0); g.stroke();
      g.beginPath(); g.moveTo(0.2, -5.6); g.lineTo(4.2, -4.8); g.stroke();
    }
  } else {
    // 3Q / Profile View
    const sc = isNear ? 1.0 : 0.92;
    g.scale(sc, sc);
    if (rot) g.rotate(rot);

    if (shoeType === 'boots') {
      g.fillStyle = '#0f172a'; g.strokeStyle = inkCol; g.lineWidth = 2;
      g.fill(new Path2D("M -7 -3.5 L 10.5 -3.5 Q 12 -3.5 12 -1.5 Q 12 0 10 0 L -7 0 Z"));
      g.stroke(new Path2D("M -7 -3.5 L 10.5 -3.5 Q 12 -3.5 12 -1.5 Q 12 0 10 0 L -7 0 Z"));
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2.2;
      g.fill(new Path2D("M -7 -3.5 Q -7.5 -7.5 -4 -13.5 L 3.5 -13.5 Q 7.5 -8 11.5 -4 L 11.5 -3.5 Z"));
      g.stroke(new Path2D("M -7 -3.5 Q -7.5 -7.5 -4 -13.5 L 3.5 -13.5 Q 7.5 -8 11.5 -4 L 11.5 -3.5 Z"));
      g.fillStyle = '#334155'; rr(g, -5, -15, 10.5, 3, 1.5); g.fill(); g.stroke();
    } else if (shoeType === 'casual') {
      g.fillStyle = '#0f172a'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.fill(new Path2D("M -6.5 -2.2 L 9.5 -2.2 Q 11 -2.2 11 -0.8 Q 11 0 9 0 L -6.5 0 Z"));
      g.stroke(new Path2D("M -6.5 -2.2 L 9.5 -2.2 Q 11 -2.2 11 -0.8 Q 11 0 9 0 L -6.5 0 Z"));
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2;
      g.fill(new Path2D("M -6.5 -2.2 Q -7 -5.5 -3 -8.5 Q 0.5 -6 4 -8.5 Q 7.5 -6 10.5 -3.2 L 10.5 -2.2 Z"));
      g.stroke(new Path2D("M -6.5 -2.2 Q -7 -5.5 -3 -8.5 Q 0.5 -6 4 -8.5 Q 7.5 -6 10.5 -3.2 L 10.5 -2.2 Z"));
    } else {
      // Sneakers
      g.fillStyle = '#ffffff'; g.strokeStyle = inkCol; g.lineWidth = 1.8;
      g.fill(new Path2D("M -7 -2.8 L 10 -2.8 Q 11.8 -2.8 11.8 -1.2 Q 11.8 0 9.2 0 L -7 0 Z"));
      g.stroke(new Path2D("M -7 -2.8 L 10 -2.8 Q 11.8 -2.8 11.8 -1.2 Q 11.8 0 9.2 0 L -7 0 Z"));
      g.fillStyle = shoeColor; g.strokeStyle = inkCol; g.lineWidth = 2.2;
      g.fill(new Path2D("M -7 -2.8 Q -7.5 -6.5 -3.5 -9.5 L 3 -9.5 Q 7 -7 11.2 -3.8 L 11.2 -2.8 Z"));
      g.stroke(new Path2D("M -7 -2.8 Q -7.5 -6.5 -3.5 -9.5 L 3 -9.5 Q 7 -7 11.2 -3.8 L 11.2 -2.8 Z"));
      g.fillStyle = '#334155'; g.strokeStyle = inkCol; g.lineWidth = 1.6;
      g.beginPath(); g.ellipse(-0.2, -9.5, 4.6, 1.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#ffffff';
      g.fill(new Path2D("M 5.8 -2.8 Q 6.8 -5 10.8 -3.8 Q 11.2 -3.2 11 -2.8 Z"));
      g.stroke(new Path2D("M 5.8 -2.8 Q 6.8 -5 10.8 -3.8 Q 11.2 -3.2 11 -2.8 Z"));
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0.2, -7.8); g.lineTo(4.2, -6.4); g.stroke();
      g.beginPath(); g.moveTo(1.8, -5.6); g.lineTo(5.8, -4.2); g.stroke();
    }
  }

  g.restore();
}

/**
 * Vẽ chi chân Chibi V2
 */
function drawChibiLeg(g, hip, knee, foot, pantsCol, inkCol, isPants, char) {
  const legAnkleY = foot[1] - 8;
  const col = isPants ? pantsCol : (char.skin || '#FFFDF8');
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Chân liền mạch từ hông qua khớp gối tới cổ chân
  seg(g, [hip, knee, [foot[0], legAnkleY]], 18, inkCol);
  seg(g, [hip, knee, [foot[0], legAnkleY]], 13.5, col);

  if (isPants) {
    g.strokeStyle = inkCol;
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(foot[0] - 5.5, legAnkleY);
    g.lineTo(foot[0] + 5.5, legAnkleY);
    g.stroke();
  }
  g.restore();
}

/**
 * Vẽ cánh tay và bàn tay cầm đạo cụ
 */
function drawChibiArm(g, sh, elbow, hand, topCol, inkCol, char, prop, facing) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const isShortSleeve = char.top === 'tshirt' || char.top === 'dress';
  const foreCol = isShortSleeve ? (char.skin || '#FFFDF8') : topCol;

  // Cánh tay liền mạch từ vai qua khuỷu tới cổ tay
  seg(g, [sh, elbow, hand], 17, inkCol);
  seg(g, [sh, elbow, hand], 12.5, isShortSleeve ? foreCol : topCol);

  if (isShortSleeve) {
    // Áo cộc tay phủ bắp tay
    seg(g, [sh, elbow], 17, inkCol);
    seg(g, [sh, elbow], 12.5, topCol);
    g.strokeStyle = inkCol;
    g.lineWidth = 2.0;
    g.beginPath();
    g.arc(elbow[0], elbow[1], 6.3, 0, Math.PI * 2);
    g.stroke();
  }

  // 4. Bàn tay Chibi bo tròn dễ thương
  const skin = char.skin || '#FFFDF8';
  circle(g, hand[0], hand[1], 7.5, skin);
  g.strokeStyle = inkCol;
  g.lineWidth = 2.2;
  g.beginPath();
  g.arc(hand[0], hand[1], 7.5, 0, Math.PI * 2);
  g.stroke();

  if (prop) {
    drawChibiProp(g, prop, hand, inkCol, facing);
  }
  g.restore();
}

/**
 * Đạo cụ cầm tay Chibi V2
 */
function drawChibiProp(g, prop, hand, inkCol, facing) {
  const t = typeof prop === 'string' ? { type: prop } : prop;
  g.save();
  g.translate(hand[0], hand[1]);

  switch (t.type) {
    case 'phone':
      g.fillStyle = '#1e293b';
      rr(g, -3, -24, 16, 26, 3);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 1.8;
      g.stroke();
      g.fillStyle = t.glow || '#38bdf8';
      g.fillRect(0, -21, 11, 20);
      break;

    case 'pointer':
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(facing * 75, -55);
      g.stroke();
      circle(g, facing * 75, -55, 3.5, '#ef4444');
      break;

    case 'cup':
    case 'mug':
      g.fillStyle = '#f8fafc';
      rr(g, -2, -18, 16, 20, 2);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 2;
      g.stroke();
      g.beginPath();
      g.arc(14, -8, 6, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      break;
  }
  g.restore();
}

/**
 * HÀM RENDER CHÍNH CHO NHÂN VẬT CHIBI V2 TRÊN 2D CANVAS (THANH HAI STUDIO)
 * Tương thích 100% với tham số của drawFigure(g, o)
 */
export function drawChibiFigure(g, o) {
  const st = S();
  const inkCol = o.ink || st.ink || '#1b1d24';
  const facing = o.facing ?? 1;
  const dir = normalizeViewDirection(o.direction || o.view || (o.front ? 'front' : null), facing);
  const poseName = typeof o.pose === 'string' ? o.pose : (o.action || (o.sit ? 'sit_chair' : 'stand'));

  const res = resolveCharacter(o.characterId || o.profile || o, { strict: o.strict === true });
  if (res.resolved && res.profile) {
    return drawUnifiedCharacter(g, {
      ...o,
      character: res.profile,
      view: dir,
      pose: poseName,
      expr: o.expr || o.expression || res.profile.defaultExpression || 'neutral',
      ink: inkCol,
      debug: o.debug === true
    });
  }

  // Never silently substitute a fallback character when an explicit ID failed to resolve
  const char = resolveCharacterIdentity(o);
  if (!char) {
    const err = res.error || `Character could not be resolved in drawChibiFigure (silent fallback disabled).`;
    if (o.strict === true) throw new Error(err);
    return { rendered: false, isFallback: true, error: err };
  }
  return drawUnifiedCharacter(g, {
    ...o,
    character: char,
    view: dir,
    pose: poseName,
    expr: o.expr || o.expression || 'neutral',
    ink: inkCol,
    debug: o.debug === true
  });
}

/**
 * HÀM RENDER CẬN CẢNH KHUÔN MẶT CHIBI V2 ĐẶC TẢ (BIGFACE)
 * Dùng cho Shot s002 (Max) và Shot s009 (Jake)
 */
export function drawChibiBigFace(g, cx, cy, r, o = {}) {
  const st = S();
  const inkCol = st.ink || '#191918';
  const char = resolveCharacterIdentity(o);
  const skinCol = char.skin || '#ffdfc4';
  const rc = o.rimColor || '#ffc68a';
  const side = o.rimSide ?? -1;

  g.save();
  g.translate(cx, cy);
  if (o.tilt) g.rotate(o.tilt);

  // 1. Cổ áo / Vai ở góc dưới
  const topCol = char.top === 'labcoat' ? '#f3f4f6' : char.color || '#d64a33';
  g.fillStyle = topCol;
  g.beginPath();
  g.ellipse(0, r * 1.55, r * 1.35, r * 0.85, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.strokeStyle = inkCol;
  g.lineWidth = 4;
  g.stroke();

  // 2. Viền sáng Rim Light lit side
  g.save();
  g.beginPath();
  g.arc(0, 0, r + r * 0.07, 0, Math.PI * 2);
  g.arc(side * r * 0.08, r * 0.02, r, 0, Math.PI * 2, true);
  g.fillStyle = rc;
  g.fill('evenodd');
  g.restore();

  // 3. Khối sọ Chibi V2 (Tapered Chin & Cute Cheeks)
  const sHead = r / 36;
  g.save();
  g.scale(sHead, sHead);
  const skullPath = new Path2D("M 0 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 38 19, 31 29 C 24 37, 10 38, 0 38 C -10 38, -24 37, -31 29 C -38 19, -37 12, -37 -4 C -37 -22, -23 -36, 0 -36 Z");
  g.fillStyle = skinCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.8 / sHead;
  g.fill(skullPath);
  g.stroke(skullPath);

  if (char.blush !== false) {
    g.fillStyle = '#fca5a5';
    g.globalAlpha *= 0.45;
    g.beginPath(); g.ellipse(-16, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(16, 14, 6.5, 3.2, 0, 0, Math.PI * 2); g.fill();
    g.globalAlpha /= 0.45;
  }
  g.restore();

  // 4. Tóc
  drawChibiHair(g, 0, 0, r, char, inkCol, 'front');

  // 5. Ngũ quan và hướng nhìn
  drawChibiEyes(g, 0, 0, r, o, 'front', inkCol);

  // 6. Phụ kiện (Kính / Mũ)
  if (char.face === 'glasses') {
    g.strokeStyle = '#0f172a';
    g.lineWidth = r * 0.06;
    for (const dx of [-r * 0.35, r * 0.35]) {
      g.beginPath();
      g.arc(dx, r * 0.08, r * 0.28, 0, Math.PI * 2);
      g.stroke();
    }
    seg(g, [[-r * 0.1, r * 0.08], [r * 0.1, r * 0.08]], r * 0.06, '#0f172a');
  }

  if (char.head === 'cap') {
    drawChibiHeadwear(g, 0, 0, r, char, inkCol, 'front');
  }

  g.restore();
}
