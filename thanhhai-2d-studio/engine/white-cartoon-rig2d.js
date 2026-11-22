// engine/white-cartoon-rig2d.js — White Cartoon 2D Rigging & Animation Engine
// Character Design: large ivory-white round head, bold clean dark outline, capsule limbs,
// rich facial expressions (fear/panic/shiver/relief), dual-rim cinematic lighting,
// fear secondary tremors, sweat droplets, thought bubbles, and sofa/blanket occlusion.

import { E, S, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease, linGrad, radGrad } from './core.js';

export const WHITE_CARTOON_PRESETS = {
  character_A: {
    id: 'character_A',
    name: 'Alex',
    skin: '#fbfbfe',
    outline: '#111827',
    rimWarm: '#fde047',
    rimCool: '#93c5fd',
    hair: 'none',
    blush: false,
  },
  character_B: {
    id: 'character_B',
    name: 'Ben',
    skin: '#f8fafc',
    outline: '#111827',
    rimWarm: '#fde047',
    rimCool: '#93c5fd',
    hair: 'none',
    blush: false,
  }
};

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

  // 2. Dual-Rim Light (Warm amber on left, Cool blue on right)
  const rimWarm = o.rimWarm || char.rimWarm || '#fde047';
  const rimCool = o.rimCool || char.rimCool || '#93c5fd';

  // Left warm rim light arc
  g.save();
  g.strokeStyle = rimWarm;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, HR + 2.5, Math.PI * 0.7, Math.PI * 1.3);
  g.stroke();
  g.restore();

  // Right cool rim light arc
  g.save();
  g.strokeStyle = rimCool;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(0, 0, HR + 2.5, -Math.PI * 0.3, Math.PI * 0.3);
  g.stroke();
  g.restore();

  // 3. Main Round Head (Ivory White with Bold Outline)
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.0;
  g.beginPath();
  g.arc(0, 0, HR, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 4. Subtle Ambient Occlusion Chin/Neck Shadow
  g.save();
  g.fillStyle = 'rgba(15, 23, 42, 0.08)';
  g.beginPath();
  g.arc(0, HR * 0.45, HR * 0.55, 0, Math.PI);
  g.fill();
  g.restore();

  // 5. Eyes & Eyebrows
  const look = o.look || [0, 0];
  const lookDx = clamp(look[0], -1, 1) * 4;
  const lookDy = clamp(look[1], -1, 1) * 3;

  let eyeX = isFront ? [-15, 15] : isSide ? [14] : [-6, 18];
  const eyeY = -4;

  if (o.blink) {
    // Blinking eye slits
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(ex, eyeY + 2, 7, Math.PI + 0.3, Math.PI * 2 - 0.3);
      g.stroke();
    });
  } else if (isTerrified) {
    // Terrified wide bulging circular eyes with shrinking trembling pupils
    eyeX.forEach(ex => {
      // Outer white sclera
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.4;
      g.beginPath();
      g.arc(ex + lookDx * 0.5, eyeY + lookDy * 0.5, 11, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Pinprick trembling pupil
      const pupilJitter = Math.sin(t * 36) * 0.8;
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx + pupilJitter, eyeY + lookDy + pupilJitter, 3.2, 0, Math.PI * 2);
      g.fill();

      // Stress lines under eyes (mí mắt dưới co giật)
      g.strokeStyle = inkCol;
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(ex, eyeY + 14, 8, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    });
  } else if (isScared) {
    // Scared / Worried large expressive eyes
    eyeX.forEach(ex => {
      g.fillStyle = '#ffffff';
      g.strokeStyle = inkCol;
      g.lineWidth = 3.2;
      g.beginPath();
      g.ellipse(ex + lookDx * 0.6, eyeY + lookDy * 0.6, 9.5, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.stroke();

      // Dark pupil with specular highlight
      g.fillStyle = inkCol;
      g.beginPath();
      g.arc(ex + lookDx, eyeY + lookDy, 5.2, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + 1.8, eyeY + lookDy - 2.0, 2.2, 0, Math.PI * 2);
      g.fill();
    });
  } else if (expr === 'happy' || expr === 'relief') {
    // Peaceful / Joyful crescent curve eyes
    g.strokeStyle = inkCol;
    g.lineWidth = 3.6;
    eyeX.forEach(ex => {
      g.beginPath();
      g.arc(ex, eyeY + 1, 8, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    });
  } else {
    // Standard cartoon eyes
    eyeX.forEach(ex => {
      g.fillStyle = inkCol;
      g.beginPath();
      g.ellipse(ex + lookDx, eyeY + lookDy, 6.2, 8.5, 0, 0, Math.PI * 2);
      g.fill();

      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(ex + lookDx + 1.8, eyeY + lookDy - 2.2, 2.5, 0, Math.PI * 2);
      g.fill();
    });
  }

  // Eyebrows
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;
  eyeX.forEach((ex, i) => {
    g.beginPath();
    if (isTerrified) {
      // Arched high, trembling wavy brows
      const browWave = Math.sin(t * 30 + i * 2) * 1.5;
      g.moveTo(ex - 7, eyeY - 14 + browWave);
      g.quadraticCurveTo(ex, eyeY - 20 + browWave, ex + 7, eyeY - 15 - browWave);
    } else if (isScared || expr === 'worried') {
      // Slanted high in center, worried
      g.moveTo(ex - 7, eyeY - 14);
      g.quadraticCurveTo(ex, eyeY - 18, ex + 7, eyeY - 13);
    } else if (expr === 'angry') {
      // Furrowed down
      g.moveTo(ex - 7, eyeY - 11);
      g.quadraticCurveTo(ex, eyeY - 15, ex + 7, eyeY - 17);
    } else {
      // Normal soft arch
      g.moveTo(ex - 6, eyeY - 13);
      g.quadraticCurveTo(ex, eyeY - 16, ex + 6, eyeY - 13);
    }
    g.stroke();
  });

  // 6. Mouth Animation
  const mouthX = isFront ? 0 : isSide ? 12 : 6;
  const mouthY = eyeY + 18;
  const talk = o.talk || 0;

  if (isTerrified || expr === 'shocked') {
    // Wide open screaming mouth with dark red inner cavity & tongue
    const screamH = 14 + Math.sin(t * 38) * 2;
    g.fillStyle = '#6b1124'; // Dark red inner mouth
    g.strokeStyle = inkCol;
    g.lineWidth = 3.4;
    g.beginPath();
    g.ellipse(mouthX, mouthY + 3, 11, screamH, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Pink tongue at the bottom
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(mouthX, mouthY + screamH - 2, 7.5, 0, Math.PI);
    g.fill();

    // Clenched upper teeth line
    g.fillStyle = '#ffffff';
    g.fillRect(mouthX - 7, mouthY - screamH + 5, 14, 4);
    g.strokeRect(mouthX - 7, mouthY - screamH + 5, 14, 4);
  } else if (isScared) {
    // Quivering / clattering teeth mouth
    const jitterM = Math.sin(t * 40) * 1.5;
    g.fillStyle = '#ffffff';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    rr(g, mouthX - 9, mouthY - 4 + jitterM, 18, 9, 3);
    g.fill();
    g.stroke();

    // Vertical tooth separation lines
    for (let dx = -4; dx <= 4; dx += 4) {
      g.beginPath();
      g.moveTo(mouthX + dx, mouthY - 4 + jitterM);
      g.lineTo(mouthX + dx, mouthY + 5 + jitterM);
      g.stroke();
    }
  } else if (talk > 0.08) {
    // Talking open mouth
    const openH = 4 + talk * 8;
    g.fillStyle = '#4c0519';
    g.strokeStyle = inkCol;
    g.lineWidth = 3.0;
    g.beginPath();
    g.ellipse(mouthX, mouthY, 7, openH, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#fb7185';
    g.beginPath();
    g.arc(mouthX, mouthY + openH * 0.4, 5, 0, Math.PI);
    g.fill();
  } else if (expr === 'relief') {
    // Small sigh of relief mouth
    g.strokeStyle = inkCol;
    g.lineWidth = 2.6;
    g.beginPath();
    g.arc(mouthX, mouthY - 1, 6, 0.2, Math.PI - 0.2);
    g.stroke();
    // Tiny breath puff "phew"
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 1.8;
    g.beginPath();
    g.arc(mouthX + 14, mouthY - 2, 4, -0.6, 1.2);
    g.stroke();
  } else {
    // Cute subtle smile
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    g.arc(mouthX, mouthY - 2, 7, 0.3, Math.PI - 0.3);
    g.stroke();
  }

  // 7. Secondary Fear FX: Sweat Drops, Vibration Lines & Shock Sparks
  if (isScared || isTerrified) {
    // Flying sweat teardrops
    const sweatCols = ['#e0f2fe', '#bae6fd'];
    const drops = isTerrified
      ? [
          { x: -HR - 8, y: -10, r: 4.5, vx: -6, vy: -4 },
          { x: -HR - 4, y: 12, r: 3.8, vx: -5, vy: 6 },
          { x: HR + 6, y: -14, r: 4.2, vx: 5, vy: -5 },
          { x: HR + 4, y: 16, r: 3.5, vx: 4, vy: 5 },
        ]
      : [
          { x: -HR - 5, y: -6, r: 3.6, vx: -3, vy: -2 },
          { x: HR + 5, y: -8, r: 3.6, vx: 3, vy: -2 },
        ];

    drops.forEach((d, idx) => {
      const dropTime = (t * 4 + idx * 0.5) % 1;
      const curX = d.x + d.vx * dropTime;
      const curY = d.y + d.vy * dropTime;
      g.save();
      g.fillStyle = sweatCols[idx % sweatCols.length];
      g.strokeStyle = inkCol;
      g.lineWidth = 1.8;
      g.beginPath();
      g.arc(curX, curY, d.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.restore();
    });

    // Comic vibration lines around the head (shivering effect)
    g.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    g.lineWidth = 2.4;
    [-HR - 12, HR + 12].forEach((vx, i) => {
      const sign = i === 0 ? -1 : 1;
      for (let k = -1; k <= 1; k++) {
        const vy = k * 18 + Math.sin(t * 35 + k) * 3;
        g.beginPath();
        g.arc(vx, vy, 10, sign > 0 ? Math.PI * 0.8 : -Math.PI * 0.2, sign > 0 ? Math.PI * 1.2 : Math.PI * 0.2);
        g.stroke();
      }
    });

    // Comic Shock / Alert Spark above head
    if (isTerrified) {
      g.save();
      g.translate(0, -HR - 18);
      g.strokeStyle = '#fde047';
      g.fillStyle = '#fde047';
      g.lineWidth = 2.4;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        const r1 = 6;
        const r2 = 14 + Math.sin(t * 25 + a) * 3;
        g.beginPath();
        g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
        g.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
        g.stroke();
      }
      g.restore();
    }
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

  g.save();
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.8;

  if (isSit) {
    // Dáng ngồi: khối hông đặt đệm ghế, ngực hướng về trước, lưng tựa thành ghế
    g.beginPath();
    g.moveTo(sx - 16, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 18, sy);
    g.lineTo(hx + 20, hy);
    g.quadraticCurveTo(hx, hy + 5, hx - 18, hy);
    g.closePath();
    g.fill();
    g.stroke();

    // Khối mông/hông bo tròn tiếp xúc đệm ghế
    g.beginPath();
    g.moveTo(hx - 18, hy - 4);
    g.lineTo(hx + 18, hy - 4);
    g.lineTo(hx + 22, hy + 6);
    g.quadraticCurveTo(hx, hy + 8, hx - 18, hy + 6);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (isFront) {
    g.beginPath();
    g.moveTo(sx - 20, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 20, sy);
    g.lineTo(hx + 16, hy);
    g.quadraticCurveTo(hx, hy + 3, hx - 16, hy);
    g.closePath();
    g.fill();
    g.stroke();
  } else {
    // 3/4 hoặc nghiêng
    g.beginPath();
    g.moveTo(sx - 16, sy);
    g.quadraticCurveTo(sx, sy - 5, sx + 18, sy);
    g.lineTo(hx + 16, hy);
    g.quadraticCurveTo(hx, hy + 3, hx - 14, hy);
    g.closePath();
    g.fill();
    g.stroke();
  }

  g.restore();
}

/**
 * Render White Cartoon Capsule Arm & Hand
 */
export function drawWhiteCartoonArm(g, sh, elbow, hand, inkCol, char, prop, facing, poseMode = 'normal', t = 0) {
  const skin = char.skin || '#fbfbfe';

  g.save();
  // Upper Arm (Bắp tay capsule bo tròn)
  drawWhiteCapsule(g, sh, elbow, 13, skin, inkCol, 3.8);

  // Khớp khuỷu tay
  circle(g, elbow[0], elbow[1], 6.5, skin);

  // Forearm (Cẳng tay capsule bo tròn)
  drawWhiteCapsule(g, elbow, hand, 11, skin, inkCol, 3.8);

  // Hand (Bàn tay hoạt hình bo tròn ngón)
  g.save();
  g.translate(hand[0], hand[1]);
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 3.2;

  if (poseMode === 'clutch_head') {
    // Bàn tay ôm đầu sợ hãi (các ngón bám vào đầu)
    g.beginPath();
    g.ellipse(0, 0, 9, 8, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // 3 ngón tay cong
    for (let f = -4; f <= 4; f += 4) {
      g.beginPath();
      g.arc(f, -6, 3, Math.PI, 0);
      g.stroke();
    }
  } else if (poseMode === 'point') {
    // Bàn tay chỉ ngón trỏ về phía trước
    g.beginPath();
    g.ellipse(0, 0, 7.5, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Ngón trỏ vươn dài
    drawWhiteCapsule(g, [2, -2], [14, -2], 6, skin, inkCol, 2.6);
  } else if (poseMode === 'hold_blanket') {
    // Bàn tay nắm mép chăn (các ngón khép lại gác lên chăn)
    g.beginPath();
    g.ellipse(0, 0, 8.5, 7.5, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // Đường ngón tay nắm
    g.beginPath();
    g.moveTo(-5, -2); g.lineTo(5, -2);
    g.moveTo(-5, 2); g.lineTo(5, 2);
    g.stroke();
  } else {
    // Bàn tay hoạt hình mặc định
    circle(g, 0, 0, 8, skin);
    g.stroke();
  }
  g.restore();

  if (prop) {
    drawWhiteCartoonProp(g, prop, hand, inkCol, facing);
  }

  g.restore();
}

/**
 * Render White Cartoon Capsule Leg & Shoe
 */
export function drawWhiteCartoonLeg(g, hip, knee, foot, inkCol, char) {
  const skin = char.skin || '#fbfbfe';
  const legAnkleY = foot[1] - 8;

  g.save();
  // Thigh (Đùi capsule trắng dày dặn)
  drawWhiteCapsule(g, hip, knee, 14, skin, inkCol, 3.8);

  // Knee joint
  circle(g, knee[0], knee[1], 7, skin);

  // Shin (Cẳng chân capsule)
  drawWhiteCapsule(g, knee, [foot[0], legAnkleY], 12, skin, inkCol, 3.8);

  // Bàn chân / Giày hoạt hình trắng đế đen phẳng trên sàn y = 0
  g.save();
  g.translate(foot[0], foot[1]);
  g.fillStyle = '#111827';
  g.fillRect(-6, -2.5, 16, 2.5); // Đế giày đen phẳng
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 2.8;
  g.beginPath();
  g.ellipse(2, -5.5, 9, 5, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();

  g.restore();
}

/**
 * Đạo cụ White Cartoon
 */
function drawWhiteCartoonProp(g, prop, hand, inkCol, facing) {
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

  // 1. Far Limbs
  drawWhiteCartoonLeg(g, p.hip, p.kB, p.fB, inkCol, char);
  drawWhiteCartoonArm(g, p.sh, p.eB, p.hB, inkCol, char, o.prop?.hand === 'B' ? o.prop : null, facing, o.poseMode || 'normal', t);

  // 2. Neck
  const neckH = 10;
  drawWhiteCapsule(g, [p.head[0], p.head[1] + HR - 6], [p.sh[0], p.sh[1]], 14, char.skin || '#fbfbfe', inkCol, 3.6);

  // 3. Torso
  drawWhiteCartoonTorso(g, p, char, inkCol, dir, p.isSit);

  // 4. Near Limbs
  drawWhiteCartoonLeg(g, p.hip, p.kF, p.fF, inkCol, char);
  drawWhiteCartoonArm(g, p.sh, p.eF, p.hF, inkCol, char, o.prop?.hand !== 'B' ? o.prop : null, facing, o.poseMode || 'normal', t);

  // 5. Head & Facial Expressions
  drawWhiteCartoonHead(g, p.head[0], p.head[1], HR, o, dir, char, inkCol, t);

  g.restore();
}

/**
 * HÀM RENDER ĐẶC TẢ CẬN CẢNH KHUÔN MẶT WHITE CARTOON (BIGFACE CLOSE-UP)
 * Dùng cho các cảnh giật mình kinh hãi (10s - 14s)
 */
export function drawWhiteCartoonBigFace(g, cx, cy, r, o = {}) {
  const st = S();
  const inkCol = st.ink || '#111827';
  const char = { ...WHITE_CARTOON_PRESETS.character_A, ...(o.outfit || {}) };
  const skin = char.skin || '#fbfbfe';
  const t = o.t ?? 0;
  const expr = o.expr || 'terrified';
  const isTerrified = expr === 'terrified';
  const isScared = expr === 'scared' || isTerrified;

  g.save();
  g.translate(cx, cy);
  if (o.tilt) g.rotate(o.tilt);

  // 1. Rung lắc kinh hãi cận cảnh
  if (isScared) {
    const shiverAmp = isTerrified ? 3.5 : 2.0;
    const sx = Math.sin(t * 46) * shiverAmp;
    const sy = Math.cos(t * 51) * (shiverAmp * 0.7);
    g.translate(sx, sy);
  }

  // 2. Cổ và vai ở góc dưới màn hình
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.5;
  g.beginPath();
  g.ellipse(0, r * 1.55, r * 1.25, r * 0.85, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.stroke();

  // 3. Dual Rim Lights (Vàng ấm bên trái, Xanh trăng bên phải)
  const rimWarm = o.rimWarm || char.rimWarm || '#fde047';
  const rimCool = o.rimCool || char.rimCool || '#93c5fd';

  g.save();
  g.strokeStyle = rimWarm;
  g.lineWidth = r * 0.07;
  g.beginPath();
  g.arc(0, 0, r + r * 0.04, Math.PI * 0.65, Math.PI * 1.35);
  g.stroke();
  g.restore();

  g.save();
  g.strokeStyle = rimCool;
  g.lineWidth = r * 0.07;
  g.beginPath();
  g.arc(0, 0, r + r * 0.04, -Math.PI * 0.35, Math.PI * 0.35);
  g.stroke();
  g.restore();

  // 4. Khối đầu lớn trắng ngà
  g.fillStyle = skin;
  g.strokeStyle = inkCol;
  g.lineWidth = 4.8;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // 5. Ngũ quan cận cảnh
  const look = o.look || [0, 0];
  const lookDx = clamp(look[0], -1, 1) * (r * 0.08);
  const lookDy = clamp(look[1], -1, 1) * (r * 0.06);

  const eyeSpacing = r * 0.38;
  const eyeY = -r * 0.08;
  const eyeR = r * 0.28;

  // Hai tròng mắt to kinh hãi
  [-eyeSpacing, eyeSpacing].forEach(ex => {
    // Sclera trắng
    g.fillStyle = '#ffffff';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.arc(ex + lookDx * 0.4, eyeY + lookDy * 0.4, eyeR, 0, Math.PI * 2);
    g.fill();
    g.stroke();

    // Pupil co giật nhỏ
    const pupilJitter = Math.sin(t * 38) * (r * 0.02);
    const pupilR = isTerrified ? eyeR * 0.28 : eyeR * 0.45;
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
    g.lineWidth = r * 0.04;
    g.beginPath();
    g.arc(ex, eyeY + eyeR * 1.25, eyeR * 0.7, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();
  });

  // Lông mày run rẩy
  g.strokeStyle = inkCol;
  g.lineWidth = r * 0.075;
  [-eyeSpacing, eyeSpacing].forEach((ex, i) => {
    const browWave = Math.sin(t * 32 + i * 2) * (r * 0.04);
    g.beginPath();
    g.moveTo(ex - eyeR * 0.8, eyeY - eyeR * 1.1 + browWave);
    g.quadraticCurveTo(ex, eyeY - eyeR * 1.6 + browWave, ex + eyeR * 0.8, eyeY - eyeR * 1.1 - browWave);
    g.stroke();
  });

  // Miệng há to hét lên kinh hãi
  const my = eyeY + r * 0.48;
  const mouthW = r * 0.32;
  const mouthH = r * 0.36 + Math.sin(t * 38) * (r * 0.04);

  g.fillStyle = '#6b1124';
  g.strokeStyle = inkCol;
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.ellipse(0, my, mouthW, mouthH, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Răng trên cắn chặt
  g.fillStyle = '#ffffff';
  g.fillRect(-mouthW * 0.75, my - mouthH + r * 0.08, mouthW * 1.5, r * 0.12);
  g.strokeRect(-mouthW * 0.75, my - mouthH + r * 0.08, mouthW * 1.5, r * 0.12);

  // Lưỡi hồng bên dưới
  g.fillStyle = '#fb7185';
  g.beginPath();
  g.arc(0, my + mouthH - r * 0.08, mouthW * 0.65, 0, Math.PI);
  g.fill();

  // Sweat drops spraying outwards
  const drops = [
    { x: -r * 1.05, y: -r * 0.25, vx: -r * 0.12, vy: -r * 0.08, rad: r * 0.1 },
    { x: -r * 0.95, y: r * 0.3, vx: -r * 0.1, vy: r * 0.1, rad: r * 0.08 },
    { x: r * 1.05, y: -r * 0.3, vx: r * 0.12, vy: -r * 0.08, rad: r * 0.09 },
    { x: r * 0.95, y: r * 0.35, vx: r * 0.1, vy: r * 0.12, rad: r * 0.08 },
  ];
  drops.forEach((d, idx) => {
    const cycle = (t * 3.5 + idx * 0.25) % 1;
    const px = d.x + d.vx * cycle;
    const py = d.y + d.vy * cycle;
    g.fillStyle = '#e0f2fe';
    g.strokeStyle = inkCol;
    g.lineWidth = r * 0.035;
    g.beginPath();
    g.arc(px, py, d.rad, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  });

  // Fear lines
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = r * 0.05;
  [-r * 1.15, r * 1.15].forEach((vx, i) => {
    const sign = i === 0 ? -1 : 1;
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.arc(vx, k * (r * 0.35), r * 0.25, sign > 0 ? Math.PI * 0.8 : -Math.PI * 0.2, sign > 0 ? Math.PI * 1.2 : Math.PI * 0.2);
      g.stroke();
    }
  });

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
