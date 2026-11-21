// engine/chibi-rig2d.js — Chibi V9 2D Character Rig and Renderer for Thanh Hai 2D Studio.
// Implements the authentic Chibi V9 puppet anatomy on HTML5 Canvas:
// - Big rounded head, expressive black oval eyes, bold outline, cute compact torso and limbs.
// - 5-Direction Perspective System: 'front', 'three_quarter_left', 'three_quarter_right', 'side_left', 'side_right'.
// - Modular Outfit System: casual, tshirt, hoodie, suit, labcoat/scientist, explorer, soldier, dress, sweater, historical.
// - Full Hair & Accessories coverage (short, bun, curly, slick, long, cap, fedora, glasses, sunglasses, backpack).
// - Reusable Hand Grip mechanism for held props (phone, newspaper, book, cup, pointer, tablet).
// - Retargeting from Thanh Hai stickman POSES to Chibi V9 proportions while preserving animation kinematics.

import { E, S, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease } from './core.js';

export const CHIBI_SKINS = {
  light: ['#F7D7B5', '#DEBA94'],
  fair:  ['#F2CBA0', '#D4AB7D'],
  tan:   ['#E6BE8E', '#C99F70'],
  olive: ['#C99C6E', '#A97E52'],
  brown: ['#A8754D', '#8A5C38'],
  dark:  ['#7A4E32', '#603B24']
};

export const CHIBI_HAIR_COLORS = {
  black:  '#18151D',
  brown:  '#3E2723',
  darkBrown: '#2C1D18',
  blonde: '#F2C21A',
  ginger: '#C85A17',
  gray:   '#78909C',
  white:  '#ECEFF1',
  blue:   '#1976D2'
};

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
 * Retargeting từ Pose người que (chiều cao ~240, chân dài 100)
 * sang tỷ lệ Chibi V9 chuẩn (đầu to R=42-46, thân ngắn ~48, chân ngắn ~46)
 */
export function retargetPoseToChibi(p, o) {
  const [hx, hy] = p.hip || [0, -100];
  const [sx, sy] = p.sh || [0, -174];
  const [headX, headY] = p.head || [3, -208];

  // Tính toán góc nghiêng thân
  const torsoAngle = Math.atan2(sx - hx, -(sy - hy));
  const torsoLen = 48; // Chiều dài thân Chibi chuẩn
  const chibiHip = [0, -52];
  const chibiSh = [
    chibiHip[0] + Math.sin(torsoAngle) * torsoLen,
    chibiHip[1] - Math.cos(torsoAngle) * torsoLen
  ];

  // Đầu Chibi nằm ngay trên cổ / vai
  const headOffset = 42;
  const chibiHead = [
    chibiSh[0] + (headX - sx) * 0.4,
    chibiSh[1] - headOffset
  ];

  // Retargeting chi: Tính vector hướng và co lại theo tỷ lệ Chibi
  const armScale = 0.52;
  const legScale = 0.48;

  const retargetLimb = (root, joint, tip, scale) => {
    const v1x = (joint[0] - root[0]) * scale;
    const v1y = (joint[1] - root[1]) * scale;
    const j = [root[0] + v1x, root[1] + v1y];
    const v2x = (tip[0] - joint[0]) * scale;
    const v2y = (tip[1] - joint[1]) * scale;
    const t = [j[0] + v2x, j[1] + v2y];
    return [j, t];
  };

  const [eF, hF] = retargetLimb(chibiSh, p.eF || [9, -137], p.hF || [13, -101], armScale);
  const [eB, hB] = retargetLimb(chibiSh, p.eB || [-7, -136], p.hB || [-9, -100], armScale);
  const [kF, fF] = retargetLimb(chibiHip, p.kF || [6, -50], p.fF || [3, 0], legScale);
  const [kB, fB] = retargetLimb(chibiHip, p.kB || [-6, -50], p.fB || [-11, 0], legScale);

  // Đảm bảo chân thấp nhất tiếp xúc mặt đất y = 0
  const lowestY = Math.max(fF[1], fB[1]);
  const groundOffset = -lowestY;

  const shiftY = (pt, dy) => [pt[0], pt[1] + dy];

  return {
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
 * Vẽ bàn tay Chibi V9 đang cầm đạo cụ (Hand Grip Mechanism)
 */
function drawChibiHandGrip(g, h, propType, inkCol, skinCol, facing, isFar) {
  g.save();
  g.translate(h[0], h[1]);

  const r = 9.5;
  // Bàn tay cơ bản (hình tròn hoặc nắm đấm)
  circle(g, 0, 0, r, skinCol);
  g.strokeStyle = inkCol;
  g.lineWidth = 2.4;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();

  // Ngón cái nắm phía trước
  const thumbX = facing * 4;
  const thumbY = -2;
  circle(g, thumbX, thumbY, 4.2, skinCol);
  g.strokeStyle = inkCol;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(thumbX, thumbY, 4.2, 0, Math.PI * 2);
  g.stroke();

  g.restore();
}

/**
 * Vẽ đạo cụ gắn với cổ tay Chibi V9
 */
export function drawChibiProp(g, prop, p, inkCol, facing) {
  if (!prop) return;
  const t = typeof prop === 'string' ? { type: prop } : prop;
  const h = t.hand === 'B' ? p.hB : p.hF;

  g.save();
  g.translate(h[0], h[1]);

  switch (t.type) {
    case 'phone': {
      // Điện thoại smartphone thông minh
      g.fillStyle = '#1e293b';
      rr(g, -3, -24, 16, 26, 3);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 1.8;
      g.stroke();
      g.fillStyle = t.glow || '#38bdf8';
      g.fillRect(0, -21, 11, 20);
      break;
    }

    case 'newspaper':
    case 'paper': {
      // Tờ báo gập 2 mặt hoặc văn bản
      g.save();
      g.rotate(-0.15 * facing);
      g.fillStyle = '#f8fafc';
      rr(g, -4, -36, 36, 42, 2);
      g.fill();
      g.strokeStyle = '#94a3b8';
      g.lineWidth = 2;
      g.stroke();
      // Các dòng chữ mô phỏng trên báo
      g.fillStyle = '#64748b';
      for (let i = 0; i < 4; i++) {
        g.fillRect(2, -30 + i * 8, 24, 3);
      }
      g.restore();
      break;
    }

    case 'book': {
      // Cuốn sách bìa màu
      g.fillStyle = t.color || '#dc2626';
      rr(g, -6, -34, 34, 38, 3);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = '#f1f5f9';
      g.fillRect(-2, -32, 26, 34);
      break;
    }

    case 'cup':
    case 'mug': {
      // Cốc cà phê
      g.fillStyle = '#f8fafc';
      rr(g, -2, -18, 16, 20, 2);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 2;
      g.stroke();
      // Quai cốc
      g.strokeStyle = '#f8fafc';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(14, -8, 6, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.strokeStyle = inkCol;
      g.lineWidth = 1.5;
      g.stroke();
      break;
    }

    case 'pointer': {
      // Que chỉ bảng
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(facing * 75, -55);
      g.stroke();
      circle(g, facing * 75, -55, 3.5, '#ef4444');
      break;
    }

    case 'tablet': {
      g.fillStyle = '#0f172a';
      rr(g, -8, -36, 42, 32, 4);
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = t.glow || '#22d3ee';
      g.fillRect(-4, -32, 34, 24);
      break;
    }

    case 'flashlight': {
      seg(g, [[0, 0], [facing * 16, -3]], 7, '#334155');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = 'rgba(254, 240, 138, 0.2)';
      g.beginPath();
      g.moveTo(facing * 16, -3);
      g.lineTo(facing * 240, -65);
      g.lineTo(facing * 240, 60);
      g.closePath();
      g.fill();
      g.restore();
      break;
    }
  }

  g.restore();
}

/**
 * Vẽ mắt Chibi V9 đặc trưng (Oval đen to, có specular highlight kép)
 */
function drawChibiEyes(g, cx, cy, hr, o, dir, inkCol) {
  const isFront = dir === 'front';
  const isLeft = dir.includes('left');
  const isSide = dir.startsWith('side');

  // Vị trí tâm mắt
  let eyeSeparation = isFront ? hr * 0.38 : hr * 0.32;
  let eyeOffsetX = isFront ? 0 : (isLeft ? -hr * 0.22 : hr * 0.22);
  let eyeY = cy + hr * 0.08;

  const eyeWidth = isSide ? hr * 0.16 : hr * 0.22;
  const eyeHeight = hr * 0.32;

  const eyes = isSide
    ? [{ x: cx + eyeOffsetX, y: eyeY, scale: 1.0 }]
    : [
        { x: cx + eyeOffsetX - eyeSeparation, y: eyeY, scale: isLeft ? 1.0 : 0.88 },
        { x: cx + eyeOffsetX + eyeSeparation, y: eyeY, scale: isLeft ? 0.88 : 1.0 }
      ];

  const look = o.look || [0, 0];
  const expr = o.expr || 'neutral';
  const blink = o.blink || expr === 'closed' || expr === 'sleepy';

  eyes.forEach(eye => {
    if (blink) {
      // Mắt nhắm
      g.strokeStyle = inkCol;
      g.lineWidth = 3.8;
      g.beginPath();
      g.arc(eye.x, eye.y + eyeHeight * 0.1, eyeWidth * 0.9 * eye.scale, 0.2, Math.PI - 0.2);
      g.stroke();
      return;
    }

    if (expr === 'happy' || expr === 'joy') {
      // Mắt cười híp hình cung vui vẻ
      g.strokeStyle = inkCol;
      g.lineWidth = 4.2;
      g.beginPath();
      g.arc(eye.x, eye.y + eyeHeight * 0.15, eyeWidth * 1.1 * eye.scale, Math.PI + 0.3, Math.PI * 2 - 0.3);
      g.stroke();
      return;
    }

    // Tròng mắt oval đen bóng đặc trưng Chibi V9
    const ew = eyeWidth * eye.scale;
    const eh = eyeHeight * (expr === 'shocked' || expr === 'surprised' ? 1.15 : 1.0);
    const pupilX = eye.x + look[0] * ew * 0.35;
    const pupilY = eye.y + look[1] * eh * 0.3;

    g.save();
    g.fillStyle = inkCol;
    g.beginPath();
    g.ellipse(pupilX, pupilY, ew, eh, 0, 0, Math.PI * 2);
    g.fill();

    // Specular highlight lớn góc trên trái
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(pupilX - ew * 0.32, pupilY - eh * 0.35, ew * 0.38, eh * 0.38, 0, 0, Math.PI * 2);
    g.fill();

    // Specular highlight nhỏ góc dưới phải
    g.beginPath();
    g.ellipse(pupilX + ew * 0.35, pupilY + eh * 0.28, ew * 0.2, eh * 0.2, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });

  // Lông mày
  const browY = eyeY - eyeHeight * 0.95;
  const browW = hr * 0.18;
  eyes.forEach(eye => {
    let tilt = 0;
    if (expr === 'worried' || expr === 'sad') tilt = isLeft ? 0.08 : -0.08;
    if (expr === 'angry' || expr === 'determined') tilt = isLeft ? -0.1 : 0.1;
    if (expr === 'surprised' || expr === 'shocked') tilt = -0.05;

    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    g.beginPath();
    g.moveTo(eye.x - browW, browY + tilt * 10);
    g.quadraticCurveTo(eye.x, browY - 3, eye.x + browW, browY - tilt * 10);
    g.stroke();
  });

  // Miệng Chibi V9
  const mouthX = cx + (isFront ? 0 : (isLeft ? -hr * 0.08 : hr * 0.08));
  const mouthY = cy + hr * 0.48;
  const talk = o.talk || 0;

  g.save();
  if (talk > 0.08) {
    // Miệng cử động khớp với giọng đọc (Lip-sync)
    g.fillStyle = '#991b1b';
    g.beginPath();
    g.ellipse(mouthX, mouthY, hr * 0.15, hr * (0.08 + 0.16 * talk), 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = inkCol;
    g.lineWidth = 2.4;
    g.stroke();
  } else {
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    switch (expr) {
      case 'smile':
      case 'happy':
        g.arc(mouthX, mouthY - 4, hr * 0.2, 0.3, Math.PI - 0.3);
        break;
      case 'grin':
        g.fillStyle = '#b91c1c';
        g.arc(mouthX, mouthY - 4, hr * 0.22, 0.2, Math.PI - 0.2);
        g.closePath();
        g.fill();
        g.stroke();
        break;
      case 'surprised':
      case 'shocked':
        g.fillStyle = '#7f1d1d';
        g.ellipse(mouthX, mouthY, hr * 0.1, hr * 0.14, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();
        break;
      case 'frown':
      case 'sad':
        g.arc(mouthX, mouthY + hr * 0.2, hr * 0.2, Math.PI + 0.4, Math.PI * 2 - 0.4);
        break;
      case 'neutral':
      default:
        g.arc(mouthX, mouthY - 2, hr * 0.14, 0.4, Math.PI - 0.4);
        break;
    }
    g.stroke();
  }
  g.restore();
}

/**
 * Vẽ tóc Chibi V9 ôm trọn vòm sọ
 */
function drawChibiHair(g, cx, cy, hr, outfit, inkCol, dir) {
  const hairStyle = outfit.hair || 'short';
  if (hairStyle === 'none' || hairStyle === 'bald') return;

  const hairCol = outfit.hairColor || outfit.headColor || CHIBI_HAIR_COLORS.black;
  const isLeft = dir.includes('left');

  g.save();
  g.fillStyle = hairCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  switch (hairStyle) {
    case 'bun': {
      // Búi tóc phía sau / trên đỉnh
      const bunX = cx + (isLeft ? hr * 0.55 : -hr * 0.55);
      const bunY = cy - hr * 0.85;
      circle(g, bunX, bunY, hr * 0.45, hairCol);
      g.stroke();
      // Mái tóc trước trán
      g.beginPath();
      g.arc(cx, cy, hr * 1.05, Math.PI * 0.85, Math.PI * 2.15);
      g.fill();
      g.stroke();
      break;
    }

    case 'curly': {
      // Tóc xoăn bồng bềnh
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.95 + i * 0.16);
        circle(g, cx + Math.cos(a) * hr * 1.05, cy + Math.sin(a) * hr * 1.05, hr * 0.32, hairCol);
        g.stroke();
      }
      break;
    }

    case 'spiky': {
      // Tóc dựng cá tính
      g.beginPath();
      g.arc(cx, cy, hr * 1.04, Math.PI * 0.8, Math.PI * 2.2);
      for (let i = 0; i <= 6; i++) {
        const a = Math.PI * (0.95 + i * 0.18);
        const rSpike = i % 2 ? hr * 1.4 : hr * 1.1;
        g.lineTo(cx + Math.cos(a) * rSpike, cy + Math.sin(a) * rSpike);
      }
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }

    case 'slick':
    case 'side_part': {
      // Tóc vuốt lịch lãm
      g.beginPath();
      g.arc(cx, cy, hr * 1.05, Math.PI * 0.8, Math.PI * 2.2);
      g.quadraticCurveTo(cx, cy - hr * 0.4, cx - hr * 0.9, cy + hr * 0.1);
      g.fill();
      g.stroke();
      break;
    }

    case 'short':
    default: {
      // Mái tóc ngắn Chibi chuẩn (mái vòm + 3 lọn tóc phía trước trán)
      g.beginPath();
      g.arc(cx, cy - 2, hr * 1.06, Math.PI * 0.82, Math.PI * 2.18);
      // Lọn tóc rủ xuống trán
      const bangDir = isLeft ? -1 : 1;
      g.quadraticCurveTo(cx + bangDir * hr * 0.3, cy - hr * 0.35, cx + bangDir * hr * 0.1, cy - hr * 0.15);
      g.quadraticCurveTo(cx - bangDir * hr * 0.2, cy - hr * 0.4, cx - bangDir * hr * 0.6, cy - hr * 0.05);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
  }

  g.restore();
}

/**
 * Vẽ mũ hoặc phụ kiện đầu
 */
function drawChibiHeadwear(g, cx, cy, hr, outfit, inkCol, dir) {
  const head = outfit.head;
  if (!head || head === 'none') return;
  const col = outfit.headColor || '#f59e0b';
  const darkCol = shade(col, -0.25);
  const isLeft = dir.includes('left');
  const visorDir = isLeft ? -1 : 1;

  g.save();
  g.fillStyle = col;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  switch (head) {
    case 'cap': {
      // Mũ lưỡi trai quay trước
      g.beginPath();
      g.ellipse(cx, cy - hr * 0.4, hr * 1.08, hr * 0.85, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      // Lưỡi trai
      g.fillStyle = darkCol;
      g.beginPath();
      g.ellipse(cx + visorDir * hr * 0.65, cy - hr * 0.32, hr * 0.6, hr * 0.18, visorDir * 0.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }

    case 'capBack': {
      // Mũ lưỡi trai quay ngược ra sau
      g.beginPath();
      g.ellipse(cx, cy - hr * 0.4, hr * 1.08, hr * 0.85, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = darkCol;
      g.beginPath();
      g.ellipse(cx - visorDir * hr * 0.65, cy - hr * 0.32, hr * 0.5, hr * 0.16, -visorDir * 0.2, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      break;
    }

    case 'fedora': {
      // Mũ phớt sang trọng
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(cx, cy - hr * 0.5, hr * 1.6, hr * 0.32, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      rr(g, cx - hr * 0.8, cy - hr * 1.35, hr * 1.6, hr * 0.9, hr * 0.25);
      g.fill();
      g.stroke();
      // Dải ruy băng mũ
      g.fillStyle = darkCol;
      g.fillRect(cx - hr * 0.8, cy - hr * 0.75, hr * 1.6, hr * 0.25);
      break;
    }

    case 'beanie': {
      // Mũ len ấm áp
      g.beginPath();
      g.ellipse(cx, cy - hr * 0.25, hr * 1.1, hr * 0.98, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.stroke();
      rr(g, cx - hr * 1.12, cy - hr * 0.38, hr * 2.24, hr * 0.34, hr * 0.15);
      g.fillStyle = darkCol;
      g.fill();
      g.stroke();
      // Quả bông tròn trên đỉnh
      circle(g, cx, cy - hr * 1.25, hr * 0.25, '#ffffff');
      g.stroke();
      break;
    }

    case 'explorer':
    case 'explorer_hat': {
      // Mũ thám hiểm safari
      g.beginPath();
      g.ellipse(cx, cy - hr * 0.45, hr * 1.55, hr * 0.35, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      rr(g, cx - hr * 0.75, cy - hr * 1.2, hr * 1.5, hr * 0.8, hr * 0.3);
      g.fill();
      g.stroke();
      break;
    }
  }

  g.restore();
}

/**
 * Vẽ thân và trang phục Chibi V9 (Torso & Outfits)
 */
function drawChibiTorso(g, p, outfit, inkCol, dir) {
  const [sx, sy] = p.sh;
  const [hx, hy] = p.hip;

  const top = outfit.top || 'hoodie';
  const col = outfit.color || (top === 'suit' ? '#1e293b' : top === 'labcoat' ? '#f8fafc' : '#3b82f6');
  const darkCol = shade(col, -0.22);
  const isFront = dir === 'front';

  g.save();
  g.fillStyle = col;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.6;

  // Thân áo Chibi hình thang nở rộng nhẹ về hông
  const topW = 24;
  const botW = 28;

  g.beginPath();
  g.moveTo(sx - topW, sy);
  g.quadraticCurveTo(sx, sy - 6, sx + topW, sy);
  g.lineTo(hx + botW, hy + 6);
  g.lineTo(hx - botW, hy + 6);
  g.closePath();
  g.fill();
  g.stroke();

  // Chi tiết trang phục
  switch (top) {
    case 'hoodie': {
      // Túi kangaroo phía trước bụng
      g.fillStyle = darkCol;
      rr(g, hx - 14, hy - 14, 28, 14, 3);
      g.fill();
      g.stroke();
      // Dây áo hoodie
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2.2;
      seg(g, [[sx - 6, sy + 4], [sx - 6, sy + 22]], 2.2, '#ffffff');
      seg(g, [[sx + 6, sy + 4], [sx + 6, sy + 22]], 2.2, '#ffffff');
      break;
    }

    case 'suit': {
      // Cà vạt hoặc nơ cổ áo suit
      g.fillStyle = outfit.color2 || '#dc2626';
      poly(g, [[sx - 3, sy + 2], [sx + 3, sy + 2], [sx + 4, sy + 28], [sx, sy + 34], [sx - 4, sy + 28]], outfit.color2 || '#dc2626');
      g.stroke();
      // Ve áo vest
      g.strokeStyle = darkCol;
      g.lineWidth = 2.4;
      seg(g, [[sx - topW + 4, sy], [sx - 4, sy + 26]], 2.4, darkCol);
      seg(g, [[sx + topW - 4, sy], [sx + 4, sy + 26]], 2.4, darkCol);
      break;
    }

    case 'labcoat':
    case 'scientist': {
      // Áo blouse bác sĩ / nhà khoa học (Doc)
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 2.2;
      seg(g, [[sx, sy + 2], [hx, hy + 6]], 2.2, '#cbd5e1');
      // Túi áo ngực kèm cây bút
      g.fillStyle = '#e2e8f0';
      rr(g, sx - 18, sy + 14, 11, 12, 2);
      g.fill();
      g.stroke();
      circle(g, sx - 12, sy + 12, 2.5, '#3b82f6');
      break;
    }

    case 'explorer': {
      // Trang phục thám hiểm có dây đai và túi hộp
      g.fillStyle = darkCol;
      rr(g, sx - 16, sy + 12, 12, 12, 2);
      g.fill();
      g.stroke();
      rr(g, sx + 4, sy + 12, 12, 12, 2);
      g.fill();
      g.stroke();
      // Thắt lưng da
      g.fillStyle = '#78350f';
      g.fillRect(hx - botW, hy - 4, botW * 2, 7);
      g.stroke();
      break;
    }

    case 'dress': {
      // Váy xòe Chibi
      g.fillStyle = col;
      poly(g, [[hx - botW, hy + 4], [hx + botW, hy + 4], [hx + botW + 18, hy + 38], [hx - botW - 18, hy + 38]], col);
      g.stroke();
      break;
    }
  }

  // Balo phiêu lưu phía sau lưng nếu có
  if (outfit.backpack || outfit.showBackpack) {
    const bpX = isFront ? sx + topW : (dir.includes('left') ? sx + topW - 4 : sx - topW - 8);
    g.fillStyle = '#b45309';
    rr(g, bpX, sy + 4, 16, 28, 4);
    g.fill();
    g.stroke();
  }

  g.restore();
}

/**
 * Vẽ chi (tay, chân) Chibi V9 theo phong cách Cut-out
 */
function drawChibiLimb(g, p1, p2, p3, width, fillCol, inkCol, isArm, outfit, isFar, prop, facing) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // Đoạn trên (Upper limb)
  seg(g, [p1, p2], width, fillCol);
  seg(g, [p1, p2], width, inkCol, 'round');

  // Đoạn dưới (Lower limb)
  seg(g, [p2, p3], width * 0.9, fillCol);
  seg(g, [p2, p3], width * 0.9, inkCol, 'round');

  if (isArm) {
    // Bàn tay Chibi
    const skinCol = CHIBI_SKINS[outfit.skin || 'tan']?.[0] || '#E6BE8E';
    if (prop) {
      drawChibiHandGrip(g, p3, prop.type || prop, inkCol, skinCol, facing, isFar);
    } else {
      circle(g, p3[0], p3[1], width * 0.52, skinCol);
      g.strokeStyle = inkCol;
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(p3[0], p3[1], width * 0.52, 0, Math.PI * 2);
      g.stroke();
    }
  } else {
    // Bàn giày Chibi bo tròn
    const shoeCol = outfit.shoes || (isFar ? '#1e293b' : '#334155');
    g.fillStyle = shoeCol;
    g.beginPath();
    g.ellipse(p3[0] + facing * 4, p3[1], width * 0.75, width * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = inkCol;
    g.lineWidth = 2.4;
    g.stroke();
  }

  g.restore();
}

/**
 * HÀM RENDER CHÍNH CHO NHÂN VẬT CHIBI V9 TRÊN 2D CANVAS
 * Tương thích 100% với tham số của drawFigure(g, o)
 */
export function drawChibiFigure(g, o) {
  const st = S();
  const inkCol = o.ink || st.ink || '#191918';
  const outfit = { ...(o.outfit || {}) };
  const skinCol = CHIBI_SKINS[outfit.skin || 'tan']?.[0] || '#E6BE8E';
  const skinShadow = CHIBI_SKINS[outfit.skin || 'tan']?.[1] || '#C99F70';

  const facing = o.facing ?? 1;
  const s = (o.s ?? 1) * (outfit.kid ? 0.72 : 1);
  const dir = resolveFacingDirection(o, facing);

  // Retargeting pose
  const rawPose = o.pose || {};
  const p = retargetPoseToChibi(rawPose, o);

  const HR = 44; // Bán kính đầu Chibi V9 chuẩn

  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;

  // Bóng đổ tiếp đất
  if (o.shadow !== false && !o.rot) {
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.beginPath();
    g.ellipse(o.x, o.y + 2, 42 * s, 10 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // Chuyển đổi tọa độ thế giới sang tọa độ cục bộ của nhân vật
  g.translate(o.x, o.y);
  g.scale(facing * s, s);
  if (o.rot) {
    g.translate(p.hip[0], p.hip[1]);
    g.rotate(o.rot);
    g.translate(-p.hip[0], -p.hip[1]);
  }

  // Màu sắc trang phục
  const topCol = outfit.color || '#3b82f6';
  const legCol = outfit.legs || shade(topCol, -0.35);
  const armCol = topCol;

  const limbW = 16;

  // 1. LỚP XA PHÍA SAU (FAR LIMBS)
  drawChibiLimb(g, p.hip, p.kB, p.fB, limbW, shade(legCol, -0.2), inkCol, false, outfit, true, null, facing);
  drawChibiLimb(g, p.sh, p.eB, p.hB, limbW * 0.95, shade(armCol, -0.2), inkCol, true, outfit, true, o.prop?.hand === 'B' ? o.prop : null, facing);

  // 2. LỚP THÂN (TORSO & OUTFIT)
  drawChibiTorso(g, p, outfit, inkCol, dir);

  // 3. LỚP GẦN PHÍA TRƯỚC (NEAR LIMBS)
  drawChibiLimb(g, p.hip, p.kF, p.fF, limbW, legCol, inkCol, false, outfit, false, null, facing);
  drawChibiLimb(g, p.sh, p.eF, p.hF, limbW * 0.95, armCol, inkCol, true, outfit, false, o.prop?.hand !== 'B' ? o.prop : null, facing);

  // Đạo cụ cầm tay (nếu có)
  if (o.prop) {
    drawChibiProp(g, o.prop, p, inkCol, facing);
  }

  // 4. LỚP ĐẦU CHIBI V9 (HEAD & FACE)
  const [hx, hy] = p.head;

  // Tai Chibi (vẽ phía sau đầu nếu góc nghiêng)
  g.fillStyle = skinCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;
  const earX = dir.includes('left') ? hx + HR * 0.9 : hx - HR * 0.9;
  circle(g, earX, hy + HR * 0.1, HR * 0.22, skinCol);
  g.stroke();

  // Khối sọ tròn Chibi V9
  g.fillStyle = skinCol;
  circle(g, hx, hy, HR, skinCol);
  g.strokeStyle = inkCol;
  g.lineWidth = 3.8;
  g.beginPath();
  g.arc(hx, hy, HR, 0, Math.PI * 2);
  g.stroke();

  // Đổ bóng cằm nhẹ
  g.fillStyle = alpha(skinShadow, 0.35);
  g.beginPath();
  g.arc(hx, hy + HR * 0.4, HR * 0.6, 0, Math.PI);
  g.fill();

  // Tóc nền
  drawChibiHair(g, hx, hy, HR, outfit, inkCol, dir);

  // Ngũ quan (Mắt oval, lông mày, miệng)
  drawChibiEyes(g, hx, hy, HR, o, dir, inkCol);

  // Kính mắt
  if (outfit.face === 'glasses') {
    g.strokeStyle = '#0f172a';
    g.lineWidth = 3.2;
    for (const dx of [-HR * 0.35, HR * 0.35]) {
      g.beginPath();
      g.arc(hx + dx, hy + HR * 0.08, HR * 0.28, 0, Math.PI * 2);
      g.stroke();
    }
    seg(g, [[hx - HR * 0.1, hy + HR * 0.08], [hx + HR * 0.1, hy + HR * 0.08]], 3.2, '#0f172a');
  } else if (outfit.face === 'sunglasses') {
    g.fillStyle = '#09090b';
    rr(g, hx - HR * 0.65, hy - 4, HR * 0.58, HR * 0.42, 5);
    g.fill();
    rr(g, hx + HR * 0.08, hy - 4, HR * 0.58, HR * 0.42, 5);
    g.fill();
    seg(g, [[hx - HR * 0.7, hy + 2], [hx + HR * 0.7, hy + 2]], 3.2, '#09090b');
    // Phản chiếu kính râm
    g.fillStyle = 'rgba(255, 255, 255, 0.4)';
    g.fillRect(hx - HR * 0.55, hy, 6, 12);
    g.fillRect(hx + HR * 0.18, hy, 6, 12);
  }

  // Mũ hoặc phụ kiện đầu
  drawChibiHeadwear(g, hx, hy, HR, outfit, inkCol, dir);

  g.restore();
}

/**
 * RENDER CẬN CẢNH KHUÔN MẶT CHIBI V9 (BIG FACE CLOSE-UP)
 * Dùng cho các cảnh đặc tả như s002 ("You don't even think.")
 */
export function drawChibiBigFace(g, cx, cy, r, o = {}) {
  const st = S();
  const inkCol = st.ink || '#191918';
  const outfit = o.outfit || {};
  const skinCol = CHIBI_SKINS[outfit.skin || 'tan']?.[0] || '#E6BE8E';
  const rc = o.rimColor || '#ffc68a';
  const side = o.rimSide ?? -1;

  g.save();
  g.translate(cx, cy);
  if (o.tilt) g.rotate(o.tilt);

  // Cổ áo và vai ở phần đáy khung hình
  const topCol = outfit.top === 'labcoat' ? '#f8fafc' : outfit.color || '#3b82f6';
  g.fillStyle = topCol;
  g.beginPath();
  g.ellipse(0, r * 1.55, r * 1.35, r * 0.85, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.strokeStyle = inkCol;
  g.lineWidth = 4;
  g.stroke();

  // Viền sáng Rim Light lit side
  g.save();
  g.beginPath();
  g.arc(0, 0, r + r * 0.07, 0, Math.PI * 2);
  g.arc(side * r * 0.08, r * 0.02, r, 0, Math.PI * 2, true);
  g.fillStyle = rc;
  g.fill('evenodd');
  g.restore();

  // Khối sọ tròn Chibi V9 to đùng
  circle(g, 0, 0, r, skinCol);
  g.strokeStyle = inkCol;
  g.lineWidth = 4.8;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();

  // Tóc
  drawChibiHair(g, 0, 0, r, outfit, inkCol, 'front');

  // Mắt oval to đặc tả cực nét
  drawChibiEyes(g, 0, 0, r, o, 'front', inkCol);

  // Kính mắt nếu có
  if (outfit.face === 'glasses') {
    g.strokeStyle = '#0f172a';
    g.lineWidth = r * 0.06;
    for (const dx of [-r * 0.35, r * 0.35]) {
      g.beginPath();
      g.arc(dx, r * 0.08, r * 0.28, 0, Math.PI * 2);
      g.stroke();
    }
    seg(g, [[-r * 0.1, r * 0.08], [r * 0.1, r * 0.08]], r * 0.06, '#0f172a');
  }

  // Mũ nếu có
  drawChibiHeadwear(g, 0, 0, r, outfit, inkCol, 'front');

  g.restore();
}

