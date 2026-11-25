// engine/white-cartoon-rig2d.js — White Cartoon 2D Rigging & Animation Engine
// Character Design: large ivory-white round head, bold clean dark outline, capsule limbs,
// rich facial expressions (fear/panic/shiver/relief), dual-rim cinematic lighting,
// fear secondary tremors, sweat droplets, thought bubbles, and sofa/blanket occlusion.

import { E, S, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease, linGrad, radGrad } from './core.js';
import { drawFacialExpressionV4, normalizeExpressionName } from './expression-v4.js';
import { drawHandAttachedProp, drawSceneProp, solvePropTimelineState, normalizePropSpec } from './prop-v4.js';

export const WHITE_CARTOON_STYLE = {
  skin: '#FFFDF8',
  outline: '#20202A',
  strokeWidth: 3.8,
  shadow: 'rgba(0, 0, 0, 0.28)'
};

export const WHITE_CARTOON_PRESETS = {
  character_A: {
    id: 'character_A',
    name: 'Alex',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'hoodie',
    color: '#d64a33',
    legs: '#2e384d',
    shoes: '#111827',
    shoeType: 'sneakers',
    hair: 'none',
    blush: false,
  },
  character_B: {
    id: 'character_B',
    name: 'Ben',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'tshirt',
    color: '#3a6ea5',
    head: 'cap',
    headColor: '#f2c21a',
    legs: '#374151',
    shoes: '#111827',
    shoeType: 'sneakers',
    hair: 'none',
    blush: false,
  },
  nam: {
    id: 'nam',
    name: 'Nam',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'jacket',
    color: '#15803d',
    legs: '#1e293b',
    shoes: '#111827',
    shoeType: 'sneakers',
    hair: 'none',
    blush: false,
  },
  max: {
    id: 'max',
    name: 'Max',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'hoodie',
    color: '#d64a33',
    legs: '#2e384d',
    shoes: '#111827',
    shoeType: 'sneakers',
    hair: 'none',
    blush: false,
  },
  jake: {
    id: 'jake',
    name: 'Jake',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'tshirt',
    color: '#3a6ea5',
    head: 'cap',
    headColor: '#f2c21a',
    legs: '#374151',
    shoes: '#111827',
    shoeType: 'sneakers',
    hair: 'none',
    blush: false,
  },
  doc: {
    id: 'doc',
    name: 'Doc',
    character: 'white_cartoon',
    skin: '#FFFDF8',
    outline: '#20202A',
    top: 'labcoat',
    color: '#f3f4f6',
    face: 'glasses',
    legs: '#1f2937',
    shoes: '#0f172a',
    shoeType: 'casual',
    hair: 'none',
    blush: false,
  }
};

/**
 * Hàm nội suy mượt mà giữa hai biểu cảm khuôn mặt (Smooth Expression Interpolation)
 */
export function blendExpression(exprA, exprB, progress) {
  const p = clamp(progress, 0, 1);
  if (p <= 0.02) return exprA;
  if (p >= 0.98) return exprB;
  return {
    isBlend: true,
    a: typeof exprA === 'string' ? exprA : (exprA?.expr || 'neutral'),
    b: typeof exprB === 'string' ? exprB : (exprB?.expr || 'neutral'),
    mix: p
  };
}

/**
 * 2-Bone Inverse Kinematics (IK)
 */
export function solve2BoneIK(root, target, len1, len2, bendDir = 1) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dist = Math.hypot(dx, dy);
  const maxReach = len1 + len2 - 0.001;
  const clampedDist = Math.max(Math.abs(len1 - len2) + 0.001, Math.min(dist, maxReach));

  const baseAngle = Math.atan2(dy, dx);
  const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
  const alphaAngle = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const angle = baseAngle + bendDir * alphaAngle;

  return [
    root[0] + Math.cos(angle) * len1,
    root[1] + Math.sin(angle) * len1
  ];
}

/**
 * Procedural capsule segment with bold dark outline and smooth inner fill
 */
export function drawWhiteCapsule(g, p1, p2, width, fillCol = '#fbfbfe', outlineCol = '#111827', strokeW = 3.8) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  // 1. Bold dark outline
  seg(g, [p1, p2], width + strokeW * 2, outlineCol);
  // 2. Clean white fill
  seg(g, [p1, p2], width, fillCol);

  g.restore();
}

/**
 * White Cartoon Standard Poses
 */
export const WHITE_CARTOON_POSES = {
  stand: {
    hip: [0, -44],
    sh: [0, -82],
    head: [1, -126],
    eF: [18, -62], hF: [18, -44],
    eB: [-18, -62], hB: [-18, -44],
    kF: [10, -22], fF: [12, 0],
    kB: [-10, -22], fB: [-10, 0]
  },
  sit_sofa: {
    hip: [-6, -72],
    sh: [-4, -112],
    head: [0, -154],
    eF: [16, -92], hF: [22, -76],
    eB: [-10, -92], hB: [-4, -76],
    kF: [30, -72], fF: [32, 0],
    kB: [24, -72], fB: [26, 0]
  },
  hold_blanket: {
    hip: [-6, -72],
    sh: [-4, -112],
    head: [0, -154],
    // Hands holding top edge of blanket near chest
    eF: [14, -88], hF: [18, -100],
    eB: [-6, -88], hB: [2, -100],
    kF: [30, -72], fF: [32, 0],
    kB: [24, -72], fB: [26, 0]
  },
  panic_head_clutch: {
    hip: [-6, -72],
    sh: [-4, -112],
    head: [0, -154],
    // Both hands clutching sides of head in sheer terror
    eF: [28, -126], hF: [22, -156],
    eB: [-28, -126], hB: [-20, -156],
    kF: [30, -72], fF: [32, 0],
    kB: [24, -72], fB: [26, 0]
  },
  point_fear: {
    hip: [-6, -72],
    sh: [-4, -112],
    head: [4, -154],
    // Right arm pointing trembling finger towards door
    eF: [34, -108], hF: [58, -114],
    eB: [-8, -90], hB: [-2, -100],
    kF: [30, -72], fF: [32, 0],
    kB: [24, -72], fB: [26, 0]
  },
  relief: {
    hip: [-8, -72],
    sh: [-8, -110],
    head: [-4, -150],
    // Hands resting limp on lap after danger passes
    eF: [12, -84], hF: [18, -72],
    eB: [-8, -84], hB: [-2, -72],
    kF: [30, -72], fF: [32, 0],
    kB: [24, -72], fB: [26, 0]
  }
};

/**
 * Retargeting poses for White Cartoon 2D
 */
export function retargetPoseToWhiteCartoon(rawPose, o = {}) {
  let p = rawPose;
  if (typeof rawPose === 'string') {
    p = WHITE_CARTOON_POSES[rawPose] || WHITE_CARTOON_POSES.stand;
  } else if (!rawPose || typeof rawPose !== 'object') {
    p = WHITE_CARTOON_POSES.stand;
  }

  // If already a complete White Cartoon pose, return directly with ground adjustment
  if (p.isWhiteCartoon || (p.hip && p.sh && p.head && p.kF && p.fF && p.eF && p.hF)) {
    const isSit = o.sit === true || (p.hip && p.hip[1] > -85) || (p.kF && p.kF[1] < p.hip[1] + 15);
    const lowestY = Math.max(p.fF[1], p.fB ? p.fB[1] : p.fF[1]);
    const groundOffset = -lowestY;
    const shiftY = (pt, dy) => [pt[0], pt[1] + dy];
    return {
      isSit,
      hip: shiftY(p.hip, groundOffset),
      sh: shiftY(p.sh, groundOffset),
      head: shiftY(p.head, groundOffset),
      eF: shiftY(p.eF, groundOffset),
      hF: shiftY(p.hF, groundOffset),
      eB: shiftY(p.eB || p.eF, groundOffset),
      hB: shiftY(p.hB || p.hF, groundOffset),
      kF: shiftY(p.kF, groundOffset),
      fF: shiftY(p.fF, groundOffset),
      kB: shiftY(p.kB || p.kF, groundOffset),
      fB: shiftY(p.fB || p.fF, groundOffset)
    };
  }

  const [hx, hy] = p.hip || [0, -100];
  const [sx, sy] = p.sh || [0, -174];
  const [headX, headY] = p.head || [3, -208];

  const isSit = o.sit === true || hy > -85 || (p.kF && p.kF[1] < (p.hip ? p.hip[1] + 15 : -85));
  const torsoLen = isSit ? 42 : 38;
  const torsoAngle = Math.atan2(sx - hx, -(sy - hy));

  const armScale = 0.60;
  const legScale = 0.46;

  const retargetLimb = (sourceRoot, sourceJoint, sourceTip, targetRoot, scale) => {
    if (!sourceRoot || !sourceJoint || !sourceTip || !targetRoot) {
      return [[targetRoot ? targetRoot[0] + 10 : 10, targetRoot ? targetRoot[1] + 20 : 20], [targetRoot ? targetRoot[0] + 20 : 20, targetRoot ? targetRoot[1] + 40 : 40]];
    }
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
    chibiHip = [-8, -72];
    chibiSh = [
      chibiHip[0] + Math.sin(torsoAngle) * torsoLen + 2,
      chibiHip[1] - Math.cos(torsoAngle) * torsoLen
    ];
    chibiHead = [
      chibiSh[0] + (headX - sx) * 0.35 + 2,
      chibiSh[1] - 42
    ];

    kF = [28, -72];
    fF = [30, 0];
    kB = [22, -72];
    fB = [24, 0];

    const hasCustomArm = p.eF && (Math.abs(p.eF[0] - p.sh[0]) > 6 || Math.abs(p.eF[1] - p.sh[1]) < 48 || p.hF[1] < p.sh[1] + 10);
    if (hasCustomArm) {
      [eF, hF] = retargetLimb(p.sh, p.eF, p.hF, chibiSh, armScale);
      [eB, hB] = retargetLimb(p.sh, p.eB, p.hB, chibiSh, armScale);
    } else {
      eF = [chibiSh[0] + 12, chibiSh[1] + 24];
      hF = [chibiHip[0] + 26, chibiHip[1] + 2];
      eB = [chibiSh[0] + 6, chibiSh[1] + 24];
      hB = [chibiHip[0] + 20, chibiHip[1] + 2];
    }
  } else {
    chibiHip = [0, -44];
    chibiSh = [
      chibiHip[0] + Math.sin(torsoAngle) * torsoLen,
      chibiHip[1] - Math.cos(torsoAngle) * torsoLen
    ];
    chibiHead = [
      chibiSh[0] + (headX - sx) * 0.35,
      chibiSh[1] - 42
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
 * Render Head & Expressive Facial Features for White Cartoon 2D
 */
export function drawWhiteCartoonHead(g, hx, hy, HR, o, dir, char, inkCol, t = 0) {
  const skin = char.skin || '#fbfbfe';
  const expr = o.expr || 'neutral';
  const isFront = dir === 'front';
  const isSide = dir.startsWith('side');
  const isScared = expr === 'scared' || expr === 'terrified' || expr === 'worried';
  const isTerrified = expr === 'terrified';

  g.save();
  g.translate(hx, hy);

  // 1. Shiver / Tremor transformation when terrified
  if (isScared) {
    const shiverAmp = isTerrified ? 2.2 : 1.2;
    const sx = Math.sin(t * 44) * shiverAmp;
    const sy = Math.cos(t * 49) * (shiverAmp * 0.6);
    g.translate(sx, sy);
  }

  // 2. Main Round Head (Ivory White with Bold Outline)
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.0;
  g.beginPath();
  g.arc(0, 0, HR, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 3. Soft Rim Light (Được clip vào rìa trong của đầu, viền mỏng tự nhiên, không bị vệt dày như tai nghe)
  if (o.rimWarm && o.rimCool) {
    g.save();
    g.beginPath();
    g.arc(0, 0, HR - 2, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = o.rimWarm;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(0, 0, HR - 1, Math.PI * 0.75, Math.PI * 1.25);
    g.stroke();
    g.strokeStyle = o.rimCool;
    g.lineWidth = 2.4;
    g.beginPath();
    g.arc(0, 0, HR - 1, -Math.PI * 0.25, Math.PI * 0.25);
    g.stroke();
    g.restore();
  } else if (o.rim) {
    const rc = o.rim.color || '#ffc68a';
    const dirX = o.rim.dir ? o.rim.dir[0] : -1;
    g.save();
    g.beginPath();
    g.arc(0, 0, HR - 2, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = rc;
    g.lineWidth = 4.5;
    g.beginPath();
    if (dirX < 0) {
      g.arc(0, 0, HR, Math.PI * 0.75, Math.PI * 1.25);
    } else {
      g.arc(0, 0, HR, -Math.PI * 0.25, Math.PI * 0.25);
    }
    g.stroke();
    g.restore();
  }

  // 4. Subtle Ambient Occlusion Chin/Neck Shadow
  g.save();
  g.fillStyle = 'rgba(15, 23, 42, 0.08)';
  g.beginPath();
  g.arc(0, HR * 0.45, HR * 0.55, 0, Math.PI);
  g.fill();
  g.restore();

  // Phụ kiện nón / mũ (Jake's backward cap)
  if (char.head === 'cap') {
    const capCol = char.headColor || '#f2c21a';
    g.save();
    g.fillStyle = capCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;

    // Vòm mũ chụp chóp đỉnh đầu (nằm cao trên trán, y = -18 đến -40)
    const capAngle = Math.asin(18 / HR); // ~0.47 rad
    g.beginPath();
    g.arc(0, 0, HR + 1.2, Math.PI + capAngle, Math.PI * 2 - capAngle);
    g.quadraticCurveTo(0, -14, Math.cos(Math.PI + capAngle) * (HR + 1.2), -18);
    g.closePath();
    g.fill();
    g.stroke();

    // Lưỡi trai quay về phía sau gáy
    g.beginPath();
    g.moveTo(-33, -18);
    g.quadraticCurveTo(-52, -18, -54, -10);
    g.quadraticCurveTo(-40, -8, -24, -14);
    g.closePath();
    g.fill();
    g.stroke();

    // Nút tròn đỉnh nón
    circle(g, 0, -HR - 2, 3.2, capCol);
    g.stroke();
    g.restore();
  }

  // 5. Ngũ quan & Biểu cảm hoạt hình Universal Rig V4
  drawFacialExpressionV4(g, 0, 0, HR, expr, o, dir, inkCol, t);

  // Kính Doc
  if (char.face === 'glasses') {
    const c = inkCol;
    g.strokeStyle = c;
    g.lineWidth = 2.4;
    for (const dx of [-6.5, 10]) {
      g.beginPath();
      g.arc(dx, -4, 7, 0, Math.PI * 2);
      g.stroke();
    }
    seg(g, [[-0.5, -4], [3.5, -4]], 2, c);
  }
  g.restore();
}

/**
 * Render White Cartoon Torso
 */
export function drawWhiteCartoonTorso(g, p, char, inkCol, dir, isSit = false) {
  const [sx, sy] = p.sh;
  const [hx, hy] = p.hip;
  const skin = char.skin || '#fbfbfe';
  const isFront = dir === 'front';

  const hasClothes = char.top ? (char.top !== 'none' && !char.nude) : true;
  const topType = (char.top && char.top !== 'none') ? char.top : 'hoodie';
  const topCol = char.color || (topType === 'labcoat' ? '#f3f4f6' : '#d64a33');
  const pantsCol = char.legs || '#2e384d';

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 3.8;

  if (isSit) {
    // 1. Dáng ngồi — Thân trên (áo)
    g.beginPath();
    g.moveTo(sx - 16, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 18, sy);
    g.lineTo(hx + 18, hy - 4);
    g.quadraticCurveTo(hx, hy, hx - 16, hy - 4);
    g.closePath();
    g.fillStyle = hasClothes ? topCol : skin;
    g.strokeStyle = inkCol;
    g.fill();
    g.stroke();

    // 2. Khối hông / mông quần ngồi trên mặt ghế
    g.beginPath();
    g.moveTo(hx - 17, hy - 6);
    g.lineTo(hx + 19, hy - 6);
    g.lineTo(hx + 24, hy + 8);
    g.quadraticCurveTo(hx, hy + 10, hx - 17, hy + 8);
    g.closePath();
    g.fillStyle = hasClothes ? pantsCol : skin;
    g.fill();
    g.stroke();

    if (hasClothes) {
      if (char.top === 'hoodie') {
        // Túi kangaroo hoodie ở bụng
        g.fillStyle = shade(topCol, -0.15);
        g.strokeStyle = inkCol;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(hx + 6, hy - 20);
        g.lineTo(hx + 16, hy - 14);
        g.lineTo(hx + 14, hy - 6);
        g.lineTo(hx + 2, hy - 6);
        g.closePath();
        g.fill();
        g.stroke();

        // Dây mũ hoodie trắng
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(sx + 2, sy + 2);
        g.quadraticCurveTo(sx + 3, sy + 14, sx + 5, sy + 18);
        g.stroke();
      } else if (char.top === 'tshirt') {
        // Cổ áo thun tròn
        g.strokeStyle = inkCol;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(sx + 2, sy + 1, 9, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (char.top === 'labcoat') {
        // Áo trong tối màu bên trong labcoat
        g.fillStyle = '#1e293b';
        g.beginPath();
        g.moveTo(sx - 4, sy);
        g.lineTo(sx + 8, sy);
        g.lineTo(sx + 2, sy + 18);
        g.closePath();
        g.fill();
        // Ve áo labcoat
        g.strokeStyle = inkCol;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(sx - 4, sy);
        g.lineTo(sx + 2, sy + 18);
        g.lineTo(sx + 8, sy);
        g.stroke();
      }
    }
  } else {
    // Dáng đứng (hoặc bước đi)
    const wTop = isFront ? 20 : 17;
    const wBot = isFront ? 16 : 14;

    // Phân tầng áo và quần
    const beltY = hy - 10;

    // 1. Thân áo (từ vai đến thắt lưng)
    g.beginPath();
    g.moveTo(sx - wTop, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + wTop, sy);
    g.lineTo(hx + wBot + 1, beltY);
    g.quadraticCurveTo(hx, beltY + 3, hx - wBot - 1, beltY);
    g.closePath();
    g.fillStyle = hasClothes ? topCol : skin;
    g.strokeStyle = inkCol;
    g.fill();
    g.stroke();

    // 2. Vùng hông / quần (từ thắt lưng đến đáy đùi)
    g.beginPath();
    g.moveTo(hx - wBot - 1, beltY);
    g.quadraticCurveTo(hx, beltY + 3, hx + wBot + 1, beltY);
    g.lineTo(hx + wBot, hy + 4);
    g.quadraticCurveTo(hx, hy + 6, hx - wBot, hy + 4);
    g.closePath();
    g.fillStyle = hasClothes ? pantsCol : skin;
    g.strokeStyle = inkCol;
    g.fill();
    g.stroke();

    if (hasClothes) {
      if (char.top === 'hoodie') {
        // Túi kangaroo hoodie
        g.fillStyle = shade(topCol, -0.15);
        g.strokeStyle = inkCol;
        g.lineWidth = 2.4;
        rr(g, hx - 9, beltY - 14, 18, 11, 3);
        g.fill();
        g.stroke();

        // 2 dây áo hoodie trắng
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2.2;
        [-4, 4].forEach(dx => {
          g.beginPath();
          g.moveTo(sx + dx, sy + 2);
          g.lineTo(sx + dx, sy + 18);
          g.stroke();
        });
      } else if (char.top === 'tshirt') {
        // Cổ áo tròn
        g.strokeStyle = inkCol;
        g.lineWidth = 2.4;
        g.beginPath();
        g.arc(sx, sy + 1, 9, 0.2, Math.PI - 0.2);
        g.stroke();
      } else if (char.top === 'labcoat') {
        // Cổ áo V và vạt áo labcoat
        g.fillStyle = '#1e293b';
        g.beginPath();
        g.moveTo(sx - 6, sy);
        g.lineTo(sx + 6, sy);
        g.lineTo(sx, sy + 20);
        g.closePath();
        g.fill();

        g.strokeStyle = inkCol;
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(sx - 6, sy);
        g.lineTo(sx, sy + 20);
        g.lineTo(sx + 6, sy);
        g.stroke();

        // Vạt áo labcoat xòe xuống hông
        g.fillStyle = '#f3f4f6';
        g.strokeStyle = inkCol;
        g.lineWidth = 2.6;
        g.beginPath();
        g.moveTo(hx - wBot, beltY);
        g.lineTo(hx - wBot - 3, hy + 14);
        g.lineTo(hx + wBot + 3, hy + 14);
        g.lineTo(hx + wBot, beltY);
        g.closePath();
        g.fill();
        g.stroke();
      }
    }
  }

  g.restore();
}

/**
 * Render White Cartoon Seamless Arm & Hand
 */
export function drawWhiteCartoonArm(g, sh, elbow, hand, inkCol, char, prop, facing, poseMode = 'normal', t = 0, isFar = false) {
  const skin = char.skin || '#fbfbfe';
  const hasClothes = char.top ? (char.top !== 'none' && !char.nude) : true;
  const topType = (char.top && char.top !== 'none') ? char.top : 'hoodie';
  const topCol = char.color || (topType === 'labcoat' ? '#f3f4f6' : '#d64a33');
  const sleeveCol = isFar ? shade(topCol, -0.22) : topCol;

  const isLongSleeve = topType !== 'tshirt';

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const armThickness = 12.0;
  const strokeW = 3.6;

  // 1. CÁNH TAY LIỀN MẠCH (Seamless Continuous Stroke từ sh -> elbow -> hand)
  // Viền đen ngoài cùng cho toàn bộ cánh tay
  g.strokeStyle = inkCol;
  g.lineWidth = armThickness + strokeW * 2;
  g.beginPath();
  g.moveTo(sh[0], sh[1]);
  g.lineTo(elbow[0], elbow[1]);
  g.lineTo(hand[0], hand[1]);
  g.stroke();

  // Ruột da tay trắng bên trong
  g.strokeStyle = skin;
  g.lineWidth = armThickness;
  g.beginPath();
  g.moveTo(sh[0], sh[1]);
  g.lineTo(elbow[0], elbow[1]);
  g.lineTo(hand[0], hand[1]);
  g.stroke();

  // 2. ÁO TAY LIỀN MẠCH (Nếu có trang phục)
  if (hasClothes) {
    if (isLongSleeve) {
      // Tay dài: kéo dài từ vai, qua khuỷu tay đến gần cổ tay
      const wrist = [lerp(elbow[0], hand[0], 0.72), lerp(elbow[1], hand[1], 0.72)];
      const sleeveThickness = armThickness + 2.4;

      // Viền tay áo ngoài
      g.strokeStyle = inkCol;
      g.lineWidth = sleeveThickness + strokeW * 2;
      g.beginPath();
      g.moveTo(sh[0], sh[1]);
      g.lineTo(elbow[0], elbow[1]);
      g.lineTo(wrist[0], wrist[1]);
      g.stroke();

      // Ruột vải tay áo
      g.strokeStyle = sleeveCol;
      g.lineWidth = sleeveThickness;
      g.beginPath();
      g.moveTo(sh[0], sh[1]);
      g.lineTo(elbow[0], elbow[1]);
      g.lineTo(wrist[0], wrist[1]);
      g.stroke();

      // Bo cổ tay áo (cuff line)
      g.strokeStyle = inkCol;
      g.lineWidth = 2.4;
      g.beginPath();
      const cuffDx = -(wrist[1] - elbow[1]);
      const cuffDy = wrist[0] - elbow[0];
      const cuffLen = Math.hypot(cuffDx, cuffDy) || 1;
      const ux = (cuffDx / cuffLen) * (sleeveThickness * 0.5);
      const uy = (cuffDy / cuffLen) * (sleeveThickness * 0.5);
      g.moveTo(wrist[0] - ux, wrist[1] - uy);
      g.lineTo(wrist[0] + ux, wrist[1] + uy);
      g.stroke();
    } else {
      // Tay ngắn (t-shirt): bao phủ từ vai đến 65% bắp tay
      const sleeveEnd = [lerp(sh[0], elbow[0], 0.65), lerp(sh[1], elbow[1], 0.65)];
      const sleeveThickness = armThickness + 2.4;

      g.strokeStyle = inkCol;
      g.lineWidth = sleeveThickness + strokeW * 2;
      g.beginPath();
      g.moveTo(sh[0], sh[1]);
      g.lineTo(sleeveEnd[0], sleeveEnd[1]);
      g.stroke();

      g.strokeStyle = sleeveCol;
      g.lineWidth = sleeveThickness;
      g.beginPath();
      g.moveTo(sh[0], sh[1]);
      g.lineTo(sleeveEnd[0], sleeveEnd[1]);
      g.stroke();

      // Viền gấu tay áo
      g.strokeStyle = inkCol;
      g.lineWidth = 2.4;
      g.beginPath();
      const cuffDx = -(sleeveEnd[1] - sh[1]);
      const cuffDy = sleeveEnd[0] - sh[0];
      const cuffLen = Math.hypot(cuffDx, cuffDy) || 1;
      const ux = (cuffDx / cuffLen) * (sleeveThickness * 0.5);
      const uy = (cuffDy / cuffLen) * (sleeveThickness * 0.5);
      g.moveTo(sleeveEnd[0] - ux, sleeveEnd[1] - uy);
      g.lineTo(sleeveEnd[0] + ux, sleeveEnd[1] + uy);
      g.stroke();
    }
  }

  // 3. BÀN TAY HOẠT HÌNH TRẮNG
  g.save();
  g.translate(hand[0], hand[1]);
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;

  if (poseMode === 'clutch_head') {
    g.beginPath();
    g.ellipse(0, 0, 9, 8, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let f = -4; f <= 4; f += 4) {
      g.beginPath();
      g.arc(f, -6, 3, Math.PI, 0);
      g.stroke();
    }
  } else if (poseMode === 'point') {
    g.beginPath();
    g.ellipse(0, 0, 7.5, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    drawWhiteCapsule(g, [2, -2], [14, -2], 6, skin, inkCol, 2.6);
  } else if (poseMode === 'hold_blanket' || poseMode === 'fist') {
    g.beginPath();
    g.ellipse(0, 0, 8.5, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-5, -2); g.lineTo(5, -2);
    g.moveTo(-5, 2); g.lineTo(5, 2);
    g.stroke();
  } else {
    // Bàn tay hoạt hình đáng yêu: lòng bàn tay bo tròn + ngón cái
    g.beginPath();
    g.ellipse(0, 0, 8.0, 7.0, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Ngón cái nhỏ
    g.beginPath();
    g.arc(4, -3, 3.2, -0.5, Math.PI * 0.8);
    g.stroke();
  }
  g.restore();

  if (prop) {
    drawWhiteCartoonProp(g, prop, hand, inkCol, facing);
  }

  g.restore();
}

/**
 * Render White Cartoon Seamless Leg & Cartoon Shoe
 */
export function drawWhiteCartoonLeg(g, hip, knee, foot, inkCol, char, isFar = false) {
  const skin = char.skin || '#fbfbfe';
  const hasClothes = char.top ? (char.top !== 'none' && !char.nude) : true;
  const pantsCol = hasClothes ? (char.legs ? (isFar ? shade(char.legs, -0.25) : char.legs) : '#2e384d') : skin;

  const ankleY = foot[1] - 8;
  const ankle = [foot[0], ankleY];

  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const legThickness = 13.0;
  const strokeW = 3.6;

  // 1. CHÂN LIỀN MẠCH (Seamless Continuous Stroke từ hip -> knee -> ankle)
  // Viền ngoài
  g.strokeStyle = inkCol;
  g.lineWidth = legThickness + strokeW * 2;
  g.beginPath();
  g.moveTo(hip[0], hip[1]);
  g.lineTo(knee[0], knee[1]);
  g.lineTo(ankle[0], ankle[1]);
  g.stroke();

  // Ruột quần / da chân bên trong
  g.strokeStyle = pantsCol;
  g.lineWidth = legThickness;
  g.beginPath();
  g.moveTo(hip[0], hip[1]);
  g.lineTo(knee[0], knee[1]);
  g.lineTo(ankle[0], ankle[1]);
  g.stroke();

  // 2. GIÀY HOẠT HÌNH (Cartoon Sneaker / Shoe)
  // Giày nối với cổ chân tại ankle và đặt đế tiếp xúc ground (y = foot[1])
  const shoeCol = char.shoes ? (isFar ? shade(char.shoes, -0.2) : char.shoes) : '#1e1e24';
  const shoeSoleCol = '#ffffff';

  g.save();
  g.translate(foot[0], foot[1]);

  // Cổ giày ôm lấy ống quần
  g.fillStyle = shoeCol;
  g.strokeStyle = inkCol;
  g.lineWidth = 2.6;

  // Thân giày (Upper) hình học bo tròn mềm mại
  g.beginPath();
  g.moveTo(-7, -10); // Cổ giày sau
  g.lineTo(5, -10);  // Cổ giày trước
  g.quadraticCurveTo(10, -8, 14, -5); // Mũi giày vát cong xuống
  g.quadraticCurveTo(16, -2, 14, -2.5); // Chóp mũi
  g.lineTo(-7, -2.5); // Đáy thân giày trên đế
  g.quadraticCurveTo(-9, -5, -7, -10); // Gót giày cong lên cổ
  g.closePath();
  g.fill();
  g.stroke();

  // Đế giày cao su trắng phẳng (Sole) nằm ngay trên mặt sàn
  g.fillStyle = shoeSoleCol;
  g.fillRect(-8, -2.5, 23, 2.5);
  g.strokeRect(-8, -2.5, 23, 2.5);

  // Mũi giày cao su trắng (Toe cap)
  g.fillStyle = shoeSoleCol;
  g.beginPath();
  g.moveTo(10, -2.5);
  g.quadraticCurveTo(15, -3, 14, -5.5);
  g.quadraticCurveTo(11, -5.5, 10, -2.5);
  g.closePath();
  g.fill();
  g.stroke();

  // Dây giày / chi tiết trang trí
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(1, -8); g.lineTo(6, -6);
  g.stroke();

  g.restore();

  g.restore();
}

/**
 * Đạo cụ White Cartoon
 */
export function drawWhiteCartoonProp(g, prop, hand, inkCol, facing) {
  drawHandAttachedProp(g, prop, hand, facing, 1.0);
  return;

  const t = typeof prop === 'string' ? { type: prop } : prop;
  g.save();
  g.translate(hand[0], hand[1]);
  if (t.type === 'remote') {
    // TV Remote
    g.fillStyle = '#1e293b';
    g.strokeStyle = inkCol;
    g.lineWidth = 2;
    rr(g, -2, -16, 10, 24, 2);
    g.fill();
    g.stroke();
    circle(g, 3, -12, 1.8, '#ef4444');
  }
  g.restore();
}

/**
 * HÀM RENDER CHÍNH CHO NHÂN VẬT WHITE CARTOON 2D
 */
export function drawWhiteCartoonFigure(g, o) {
  const st = S();
  const inkCol = o.ink || st.ink || '#111827';
  const char = { ...WHITE_CARTOON_PRESETS.character_A, ...(o.outfit || {}) };

  const facing = o.facing ?? 1;
  const s = (o.s ?? 1) * (char.kid ? 0.75 : 1);
  const dir = o.direction || (o.front ? 'front' : facing > 0.4 ? 'three_quarter_right' : facing < -0.4 ? 'three_quarter_left' : 'side_right');
  const isFront = dir === 'front';

  const rawPose = o.pose || {};
  const p = retargetPoseToWhiteCartoon(rawPose, o);
  const HR = 40;
  const t = o.t ?? 0;

  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;

  // Bóng đổ tiếp đất (nếu không ở trên sofa và không tắt shadow)
  if (o.shadow !== false && !p.isSit && !o.rot) {
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.beginPath();
    g.ellipse(o.x, o.y + 2, (isFront ? 38 : 34) * s, 8 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  g.translate(o.x, o.y);
  g.scale(facing * s, s);
  if (o.rot) {
    g.translate(p.hip[0], p.hip[1]);
    g.rotate(o.rot);
    g.translate(-p.hip[0], -p.hip[1]);
  }

  // Xử lý động học và trạng thái của đạo cụ (Held / Dropped / Placed)
  let solvedNearProp = null;
  let solvedFarProp = null;
  let sceneDropProps = [];
  if (o.prop) {
    const rawProps = Array.isArray(o.prop) ? o.prop : [o.prop];
    for (const rawP of rawProps) {
      const pSpec = normalizePropSpec(rawP);
      const isFar = pSpec.hand === 'B';
      const handPos = isFar ? p.hB : p.hF;
      const handWorld = [o.x + handPos[0] * facing * s, o.y + handPos[1] * s];
      const solved = solvePropTimelineState(pSpec, t, handWorld);
      if (solved.state === 'held') {
        if (isFar) solvedFarProp = solved;
        else solvedNearProp = solved;
      } else {
        sceneDropProps.push(solved);
      }
    }
  }

  // 1. Far Limbs (Phía xa, có đổ bóng nhẹ isFar = true)
  drawWhiteCartoonLeg(g, p.hip, p.kB, p.fB, inkCol, char, true);
  drawWhiteCartoonArm(g, p.sh, p.eB, p.hB, inkCol, char, solvedFarProp, facing, o.poseMode || 'normal', t, true);

  // 2. Neck
  const neckH = 10;
  drawWhiteCapsule(g, [p.head[0], p.head[1] + HR - 6], [p.sh[0], p.sh[1]], 14, char.skin || '#fbfbfe', inkCol, 3.6);

  // 3. Torso (Áo & Quần liền mạch)
  drawWhiteCartoonTorso(g, p, char, inkCol, dir, p.isSit);

  // 4. Near Limbs (Phía gần, màu sắc rõ nét isFar = false)
  drawWhiteCartoonLeg(g, p.hip, p.kF, p.fF, inkCol, char, false);
  drawWhiteCartoonArm(g, p.sh, p.eF, p.hF, inkCol, char, solvedNearProp, facing, o.poseMode || 'normal', t, false);

  // Đạo cụ đã thả / đặt (vẽ trong không gian local của nhân vật)
  for (const dp of sceneDropProps) {
    const lx = (dp.x - o.x) / (facing * s);
    const ly = (dp.y - o.y) / s;
    drawSceneProp(g, dp, lx, ly, 1.0 / s, dp.rotation);
  }

  // 5. Head & Facial Expressions
  drawWhiteCartoonHead(g, p.head[0], p.head[1], HR, o, dir, char, inkCol, t);

  g.restore();
}

/**
 * HÀM RENDER ĐẶC TẢ CẬN CẢNH KHUÔN MẶT WHITE CARTOON (BIGFACE CLOSE-UP)
 * Hỗ trợ mọi biểu cảm: determined, surprised, shocked, smirk, happy, scared, terrified, neutral
 */
export function drawWhiteCartoonBigFace(g, cx, cy, r, o = {}) {
  const st = S();
  const inkCol = st.ink || '#111827';
  const char = { ...WHITE_CARTOON_PRESETS.character_A, ...(o.outfit || {}) };
  const skin = char.skin || '#fbfbfe';
  const t = o.t ?? 0;
  const expr = o.expr || 'neutral';
  const isTerrified = expr === 'terrified';
  const isScared = expr === 'scared' || isTerrified;

  const hasClothes = char.top && char.top !== 'none';
  const topCol = char.color || (char.top === 'labcoat' ? '#f3f4f6' : '#d64a33');

  g.save();
  g.translate(cx, cy);
  if (o.tilt) g.rotate(o.tilt);

  // 1. Rung lắc kinh hãi cận cảnh (Chỉ khi sợ hãi / giật mình)
  if (isScared) {
    const shiverAmp = isTerrified ? 3.5 : 2.0;
    const sx = Math.sin(t * 46) * shiverAmp;
    const sy = Math.cos(t * 51) * (shiverAmp * 0.7);
    g.translate(sx, sy);
  }

  // 2. Cổ và vai áo ở góc dưới màn hình (clothed shoulders!)
  g.fillStyle = hasClothes ? topCol : skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.5;
  g.beginPath();
  g.ellipse(0, r * 1.55, r * 1.25, r * 0.85, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();

  // Chi tiết cổ áo / hoodie
  if (hasClothes) {
    if (char.top === 'hoodie') {
      // Dây áo hoodie
      g.strokeStyle = '#ffffff';
      g.lineWidth = r * 0.035;
      [-r * 0.15, r * 0.15].forEach(dx => {
        g.beginPath();
        g.moveTo(dx, r * 0.88);
        g.lineTo(dx, r * 1.25);
        g.stroke();
      });
    } else if (char.top === 'labcoat') {
      // Áo tối màu bên trong
      g.fillStyle = '#1e293b';
      g.beginPath();
      g.moveTo(-r * 0.25, r * 0.85);
      g.lineTo(r * 0.25, r * 0.85);
      g.lineTo(0, r * 1.35);
      g.closePath();
      g.fill();
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.04;
      g.stroke();
    }
  }

  // 3. Khối đầu lớn trắng ngà
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.8;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 4. Rim Lighting (Được clip vào rìa trong của khối đầu, không bị lộ ra ngoài)
  const rimCol = o.rimColor || (o.rimWarm && o.rimCool ? null : o.rimWarm);
  const side = o.rimSide ?? -1;

  if (rimCol) {
    g.save();
    g.beginPath();
    g.arc(0, 0, r - 3, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = rimCol;
    g.lineWidth = r * 0.04;
    g.beginPath();
    if (side < 0) {
      g.arc(0, 0, r, Math.PI * 0.7, Math.PI * 1.3);
    } else {
      g.arc(0, 0, r, -Math.PI * 0.3, Math.PI * 0.3);
    }
    g.stroke();
    g.restore();
  } else if (o.rimWarm && o.rimCool) {
    // Chế độ 2 màu rim viền mỏng tinh tế, không dày cộm như tai nghe
    g.save();
    g.beginPath();
    g.arc(0, 0, r - 3, 0, Math.PI * 2);
    g.clip();
    g.strokeStyle = o.rimWarm;
    g.lineWidth = r * 0.035;
    g.beginPath();
    g.arc(0, 0, r, Math.PI * 0.72, Math.PI * 1.28);
    g.stroke();

    g.strokeStyle = o.rimCool;
    g.lineWidth = r * 0.035;
    g.beginPath();
    g.arc(0, 0, r, -Math.PI * 0.28, Math.PI * 0.28);
    g.stroke();
    g.restore();
  }

  // Phụ kiện nón / mũ trên BigFace (Jake's backward cap)
  if (char.head === 'cap') {
    const capCol = char.headColor || '#f2c21a';
    g.save();
    g.fillStyle = capCol;
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;

    // Vòm mũ chụp chóp đỉnh đầu (nằm cao trên trán)
    const capAngle = Math.asin(0.42);
    g.beginPath();
    g.arc(0, 0, r + r * 0.02, Math.PI + capAngle, Math.PI * 2 - capAngle);
    g.quadraticCurveTo(0, -r * 0.34, -Math.cos(capAngle) * (r + r * 0.02), -r * 0.42);
    g.closePath();
    g.fill();
    g.stroke();

    // Visor quay ngược ra sau gáy
    g.beginPath();
    g.moveTo(-r * 0.88, -r * 0.42);
    g.quadraticCurveTo(-r * 1.32, -r * 0.38, -r * 1.36, -r * 0.18);
    g.quadraticCurveTo(-r * 1.05, -r * 0.15, -r * 0.65, -r * 0.32);
    g.closePath();
    g.fill();
    g.stroke();

    // Nút đỉnh nón
    circle(g, 0, -r - r * 0.03, r * 0.07, capCol);
    g.stroke();
    g.restore();
  }

  // 5. Ngũ quan cận cảnh
  const look = o.look || [0, 0];
  const lookDx = clamp(look[0], -1, 1) * (r * 0.08);
  const lookDy = clamp(look[1], -1, 1) * (r * 0.06);

  const eyeSpacing = r * 0.36;
  const eyeY = -r * 0.08;
  const eyeR = r * 0.25;

  // Hai tròng mắt
  [-eyeSpacing, eyeSpacing].forEach(ex => {
    if (isTerrified) {
      // Sclera trắng
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.07;
      g.beginPath();
      g.arc(ex + lookDx * 0.4, eyeY + lookDy * 0.4, eyeR, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Pupil co giật nhỏ
      const pupilJitter = Math.sin(t * 38) * (r * 0.02);
      const pupilR = eyeR * 0.32;
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx + pupilJitter, eyeY + lookDy + pupilJitter, pupilR, 0, Math.PI * 2);
      g.fill();

      // Specular light dot
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + pupilJitter + pupilR * 0.3, eyeY + lookDy + pupilJitter - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2);
      g.fill();

      // Stress lines under eyes
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.035;
      g.beginPath();
      g.arc(ex, eyeY + eyeR * 1.25, eyeR * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    } else if (expr === 'determined') {
      // Sclera trắng tập trung
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.06;
      g.beginPath();
      g.arc(ex + lookDx * 0.35, eyeY + lookDy * 0.35, eyeR, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Con ngươi đen sắc nét tập trung theo hướng nhìn
      const pupilR = eyeR * 0.52;
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx * 0.9, eyeY + lookDy * 0.9, pupilR, 0, Math.PI * 2);
      g.fill();

      // Điểm sáng mắt sắc bén
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx * 0.9 + pupilR * 0.3, eyeY + lookDy * 0.9 - pupilR * 0.3, pupilR * 0.32, 0, Math.PI * 2);
      g.fill();
    } else if (expr === 'surprised' || expr === 'shocked') {
      // Mắt tròn to ngạc nhiên
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.06;
      g.beginPath();
      g.arc(ex + lookDx * 0.4, eyeY + lookDy * 0.4, eyeR * 1.08, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      const pupilR = expr === 'shocked' ? eyeR * 0.38 : eyeR * 0.48;
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx, eyeY + lookDy, pupilR, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + pupilR * 0.3, eyeY + lookDy - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2);
      g.fill();
    } else if (expr === 'happy' || expr === 'smile') {
      // Mắt cười híp hoặc tròn sáng
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.07;
      g.beginPath();
      g.arc(ex, eyeY + eyeR * 0.1, eyeR * 0.8, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    } else {
      // Mắt tiêu chuẩn sạch đẹp
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.06;
      g.beginPath();
      g.arc(ex + lookDx * 0.3, eyeY + lookDy * 0.3, eyeR, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      const pupilR = eyeR * 0.5;
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx, eyeY + lookDy, pupilR, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + pupilR * 0.3, eyeY + lookDy - pupilR * 0.3, pupilR * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  });

  // Kính Doc cận cảnh
  if (char.face === 'glasses') {
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.045;
    [-eyeSpacing, eyeSpacing].forEach(ex => {
      circle(g, ex, eyeY, eyeR * 1.35, 'rgba(255, 255, 255, 0.2)');
      g.stroke();
    });
    g.beginPath();
    g.moveTo(-eyeSpacing + eyeR * 1.35, eyeY);
    g.lineTo(eyeSpacing - eyeR * 1.35, eyeY);
    g.stroke();
  }

  // Lông mày cận cảnh
  g.strokeStyle = inkCol;
  g.lineWidth = r * 0.075;
  [-eyeSpacing, eyeSpacing].forEach((ex, i) => {
    g.beginPath();
    if (isTerrified) {
      // Lông mày run rẩy lượn sóng
      const browWave = Math.sin(t * 32 + i * 2) * (r * 0.04);
      g.moveTo(ex - eyeR * 0.8, eyeY - eyeR * 1.1 + browWave);
      g.quadraticCurveTo(ex, eyeY - eyeR * 1.6 + browWave, ex + eyeR * 0.8, eyeY - eyeR * 1.1 - browWave);
    } else if (expr === 'determined') {
      // Lông mày sắc bén chéo xuống mũi: \  /
      const sign = i === 0 ? 1 : -1;
      g.moveTo(ex - eyeR * 0.85, eyeY - eyeR * 1.15 - sign * (r * 0.065));
      g.lineTo(ex + eyeR * 0.85, eyeY - eyeR * 1.15 + sign * (r * 0.065));
    } else if (expr === 'surprised' || expr === 'shocked') {
      // Lông mày nhướng cao ngạc nhiên
      g.arc(ex, eyeY - eyeR * 1.25, eyeR * 0.75, Math.PI * 1.15, Math.PI * 1.85);
    } else if (expr === 'smirk') {
      // Một bên nhướng một bên bình thường
      if (i === 0) {
        g.arc(ex, eyeY - eyeR * 1.25, eyeR * 0.75, Math.PI * 1.15, Math.PI * 1.85);
      } else {
        g.moveTo(ex - eyeR * 0.7, eyeY - eyeR * 1.05);
        g.lineTo(ex + eyeR * 0.7, eyeY - eyeR * 1.05);
      }
    } else {
      // Bình thường vòng cung mềm mại
      g.moveTo(ex - eyeR * 0.75, eyeY - eyeR * 1.1);
      g.quadraticCurveTo(ex, eyeY - eyeR * 1.35, ex + eyeR * 0.75, eyeY - eyeR * 1.1);
    }
    g.stroke();
  });

  // Miệng cận cảnh
  const my = eyeY + r * 0.46;
  const talk = o.talk || 0;

  if (talk > 0.05) {
    // Đang nói chuyện (Lip-sync tự nhiên, răng và lưỡi bo tròn bên trong khoang miệng)
    const openH = r * (0.08 + 0.18 * talk);
    const mouthW = r * 0.22;
    g.save();
    g.fillStyle = '#581c24';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.055;
    g.beginPath();
    g.ellipse(0, my, mouthW, openH, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.clip();

    // Răng trên bo tròn trắng bên trong
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, my - openH * 0.5, mouthW * 0.75, openH * 0.4, 0, 0, Math.PI * 2);
    g.fill();

    // Lưỡi hồng mềm mại
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(0, my + openH * 0.45, mouthW * 0.65, 0, Math.PI);
    g.fill();
    g.restore();
  } else if (isTerrified) {
    // Miệng há to hét lên kinh hãi (Hình học bo tròn hữu cơ)
    const mouthW = r * 0.32;
    const mouthH = r * 0.36 + Math.sin(t * 38) * (r * 0.04);
    g.save();
    g.fillStyle = '#6b1124';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.ellipse(0, my, mouthW, mouthH, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Răng trên bo tròn bên trong khoang miệng (Không có viền hộp đen cứng)
    g.beginPath();
    g.ellipse(0, my, mouthW, mouthH, 0, 0, Math.PI * 2);
    g.clip();

    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(0, my - mouthH * 0.45, mouthW * 0.85, mouthH * 0.42, 0, 0, Math.PI * 2);
    g.fill();

    // Lưỡi hồng bên dưới
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(0, my + mouthH - r * 0.04, mouthW * 0.7, 0, Math.PI);
    g.fill();
    g.restore();
  } else if (isScared) {
    // Miệng ngậm răng run lẩy bẩy
    const mouthW = r * 0.28;
    const mouthH = r * 0.16;
    const jitterM = Math.sin(t * 40) * (r * 0.02);
    g.fillStyle = '#ffffff';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    rr(g, -mouthW * 0.6, my - mouthH * 0.5 + jitterM, mouthW * 1.2, mouthH, r * 0.04);
    g.fill();
    g.stroke();

    // Vạch chia răng mờ nhạt
    g.strokeStyle = '#cbd5e1';
    g.lineWidth = r * 0.025;
    for (let dx = -mouthW * 0.3; dx <= mouthW * 0.3; dx += mouthW * 0.3) {
      g.beginPath();
      g.moveTo(dx, my - mouthH * 0.45 + jitterM);
      g.lineTo(dx, my + mouthH * 0.45 + jitterM);
      g.stroke();
    }
  } else if (expr === 'laughing') {
    // Cười to sảng khoái cận cảnh
    g.save();
    g.fillStyle = '#581c24';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.065;
    g.beginPath();
    g.arc(0, my - r * 0.04, r * 0.24, 0.2, Math.PI - 0.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.clip();

    // Lưỡi hồng
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(0, my + r * 0.08, r * 0.15, 0, Math.PI);
    g.fill();
    g.restore();

    // Má hồng ửng
    g.fillStyle = 'rgba(251, 113, 133, 0.45)';
    circle(g, -r * 0.38, my - r * 0.06, r * 0.11);
    circle(g, r * 0.38, my - r * 0.06, r * 0.11);
  } else if (expr === 'sad') {
    // Miệng mếu máo buồn
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.arc(0, my + r * 0.12, r * 0.16, Math.PI * 1.25, Math.PI * 1.75);
    g.stroke();
  } else if (expr === 'confused') {
    // Miệng lượn sóng khó hiểu
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.moveTo(-r * 0.16, my + r * 0.02);
    g.quadraticCurveTo(-r * 0.05, my - r * 0.03, 0.05, my + r * 0.02);
    g.quadraticCurveTo(r * 0.12, my + r * 0.06, r * 0.18, my - r * 0.02);
    g.stroke();
  } else if (expr === 'determined') {
    // Nét miệng mím chặt kiên định, tự tin
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.moveTo(-r * 0.18, my - r * 0.02);
    g.quadraticCurveTo(0, my + r * 0.025, r * 0.18, my - r * 0.035);
    g.stroke();
    // Vết khóe miệng nhỏ
    g.beginPath();
    g.moveTo(r * 0.16, my - r * 0.07);
    g.lineTo(r * 0.2, my);
    g.stroke();
  } else if (expr === 'surprised') {
    // Miệng chữ 'O' nhỏ
    g.fillStyle = '#4c0519';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.055;
    g.beginPath();
    g.ellipse(0, my, r * 0.11, r * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (expr === 'shocked') {
    // Miệng ngạc nhiên chữ 'O' lớn hơn
    g.save();
    g.fillStyle = '#581c24';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.ellipse(0, my, r * 0.2, r * 0.26, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.clip();

    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(0, my + r * 0.12, r * 0.13, 0, Math.PI);
    g.fill();
    g.restore();
  } else if (expr === 'smirk') {
    // Cười nhếch mép
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.moveTo(-r * 0.12, my + r * 0.02);
    g.quadraticCurveTo(r * 0.05, my + r * 0.05, r * 0.2, my - r * 0.06);
    g.stroke();
  } else if (expr === 'happy' || expr === 'smile') {
    // Cười tươi
    g.save();
    g.fillStyle = '#581c24';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.06;
    g.beginPath();
    g.arc(0, my - r * 0.05, r * 0.22, 0.2, Math.PI - 0.2);
    g.closePath();
    g.fill();
    g.stroke();
    g.clip();

    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(0, my + r * 0.06, r * 0.13, 0, Math.PI);
    g.fill();
    g.restore();
  } else if (expr === 'relief') {
    // Thở phào nhẹ nhõm
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.055;
    g.beginPath();
    g.arc(0, my - r * 0.02, r * 0.14, 0.2, Math.PI - 0.2);
    g.stroke();
  } else {
    // Nụ cười mỉm đáng yêu mặc định
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.055;
    g.beginPath();
    g.arc(0, my - r * 0.08, r * 0.18, 0.35, Math.PI - 0.35);
    g.stroke();
  }

  // 6. Hiệu ứng giọt mồ hôi trên trán (Đặt tự nhiên trên bề mặt trán nhân vật)
  if (isScared) {
    const drops = [
      { x: -r * 0.48, y: -r * 0.45, rad: r * 0.065 },
      { x: r * 0.52, y: -r * 0.42, rad: r * 0.075 },
    ];
    drops.forEach((d, idx) => {
      const cycle = (t * 2.5 + idx * 0.4) % 1;
      const py = d.y + cycle * (r * 0.12);
      g.fillStyle = '#bae6fd';
      g.strokeStyle = inkCol;
      g.lineWidth = r * 0.025;
      g.beginPath();
      // Hình giọt nước (teardrop)
      g.moveTo(d.x, py - d.rad * 1.5);
      g.quadraticCurveTo(d.x + d.rad, py, d.x, py + d.rad);
      g.quadraticCurveTo(d.x - d.rad, py, d.x, py - d.rad * 1.5);
      g.closePath();
      g.fill();
      g.stroke();

      // Đốm sáng trên giọt nước
      g.fillStyle = '#ffffff';
      circle(g, d.x - d.rad * 0.3, py - d.rad * 0.2, d.rad * 0.3);
    });

    // Vạch rung giật chớp vàng / đen nhẹ quanh đầu
    g.strokeStyle = '#fde047';
    g.lineWidth = r * 0.04;
    [-r * 0.9, r * 0.9].forEach(sx => {
      for (let k = -1; k <= 1; k++) {
        g.beginPath();
        g.moveTo(sx, k * (r * 0.2));
        g.lineTo(sx + (sx > 0 ? 15 : -15), k * (r * 0.2) + 10);
        g.stroke();
      }
    });
  }

  g.restore();
}

/**
 * Spooky Ghost Thought Bubble (Bong bóng suy nghĩ hiện hình con ma rùng rợn)
 */
export function drawSpookyGhostThoughtBubble(g, cx, cy, arg3 = 0, arg4 = 1.0, arg5 = 0, arg6 = {}) {
  let t = 0, scale = 1.0, opts = {};
  if (typeof arg3 === 'number' && typeof arg4 === 'number' && typeof arg5 === 'number') {
    // Called with (g, cx, cy, w, h, t, opts)
    t = arg5;
    scale = (arg4 ? arg4 / 220 : 1.0);
    opts = arg6 || {};
  } else {
    // Called with (g, cx, cy, t, scale, opts)
    t = typeof arg3 === 'number' ? arg3 : 0;
    scale = typeof arg4 === 'number' ? arg4 : 1.0;
    opts = typeof arg5 === 'object' ? arg5 : {};
  }

  g.save();
  if (opts.alpha != null) g.globalAlpha *= opts.alpha;
  g.translate(cx, cy);
  g.scale(scale, scale);

  const floatY = Math.sin(t * 3.5) * 8;

  // 1. Floating tail thought circles
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#111827';
  g.lineWidth = 3.2;

  circle(g, -110, 80 + floatY * 0.2, 8, '#ffffff'); g.stroke();
  circle(g, -80, 50 + floatY * 0.4, 13, '#ffffff'); g.stroke();
  circle(g, -50, 25 + floatY * 0.6, 19, '#ffffff'); g.stroke();

  // 2. Cloud thought bubble body
  g.save();
  g.translate(0, floatY);

  g.fillStyle = '#1e1b4b'; // Deep dark purple room inside thought
  g.strokeStyle = '#111827';
  g.lineWidth = 4.2;

  // Comic cloud outline
  g.beginPath();
  const cloudR = 125;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const bx = Math.cos(a) * cloudR * 1.1;
    const by = Math.sin(a) * (cloudR * 0.75);
    g.arc(bx, by, 38, 0, Math.PI * 2);
  }
  g.fill();
  g.stroke();

  // Interior dark hallway background
  g.clip();
  const bgGrad = g.createRadialGradient(0, 0, 20, 0, 0, 180);
  bgGrad.addColorStop(0, '#1e1b4b');
  bgGrad.addColorStop(0.7, '#0f172a');
  bgGrad.addColorStop(1, '#020617');
  g.fillStyle = bgGrad;
  g.fillRect(-220, -160, 440, 320);

  // 3. Spooky White Sheet Ghost
  const ghostBob = Math.sin(t * 5) * 6;
  g.save();
  g.translate(0, ghostBob);

  // Ghost eerie blue aura glow
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = 'rgba(147, 197, 253, 0.35)';
  g.beginPath();
  g.ellipse(0, -10, 65, 80, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Ghost sheet body
  g.fillStyle = '#f1f5f9';
  g.strokeStyle = '#0f172a';
  g.lineWidth = 3.6;
  g.beginPath();
  g.moveTo(-45, 45);
  // Wavy bottom skirt
  g.quadraticCurveTo(-30, 35, -20, 50);
  g.quadraticCurveTo(-5, 38, 10, 52);
  g.quadraticCurveTo(25, 40, 45, 48);
  // Right side up to head
  g.quadraticCurveTo(52, -20, 38, -60);
  // Head dome
  g.quadraticCurveTo(0, -92, -38, -60);
  // Left side down
  g.quadraticCurveTo(-52, -10, -45, 45);
  g.closePath();
  g.fill();
  g.stroke();

  // Hollow dark eyes
  g.fillStyle = '#020617';
  g.beginPath();
  g.ellipse(-14, -54, 7.5, 13, -0.15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(14, -54, 7.5, 13, 0.15, 0, Math.PI * 2);
  g.fill();

  // Gaping hollow mouth
  g.beginPath();
  g.ellipse(0, -28, 8, 16, 0, 0, Math.PI * 2);
  g.fill();

  // Spooky reaching arms
  // Left reaching hand
  drawWhiteCapsule(g, [-34, -30], [-72, -38], 11, '#f1f5f9', '#0f172a', 3.2);
  // Right reaching hand
  drawWhiteCapsule(g, [34, -28], [75, -26], 11, '#f1f5f9', '#0f172a', 3.2);

  // Ghost fingers
  [-72, 75].forEach((gx, idx) => {
    const sign = idx === 0 ? -1 : 1;
    for (let f = -5; f <= 5; f += 5) {
      g.beginPath();
      g.moveTo(gx, -32 + f);
      g.lineTo(gx + sign * 11, -32 + f * 1.3);
      g.stroke();
    }
  });

  g.restore(); // End ghost bob
  g.restore(); // End cloud body

  g.restore();
}

// Re-export kinematics and actions from action-engine
export {
  solveWalkCycle,
  solveRunCycle,
  solveSneakWalkCycle,
  solveFallBackwardAction,
  solveScaredReactionAction,
  drawBroom,
  drawBlackCat
} from './action-engine.js';

