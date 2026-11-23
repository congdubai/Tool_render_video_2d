// engine/imported-rig2d.js — Kinematic Renderer for Imported Layered Characters (Character System V3)
// Solves hierarchical bone transformations, sprite rendering, expression replacement, and poses.

import { clamp, lerp, ease } from './core.js';

// Image cache to avoid reloading images on every frame
const imageCache = new Map();

export function getCachedImage(src) {
  if (!src) return null;
  if (imageCache.has(src)) {
    return imageCache.get(src);
  }
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    imageCache.set(src, img);
    return img;
  }
  return null;
}

/**
 * Standard Joint Angles (in degrees) for Basic Poses in Imported Rig
 */
export const IMPORTED_POSE_ANGLES = {
  stand: {
    torso: 0,
    head: 0,
    upperArm_L: 10, forearm_L: 5, hand_L: 0,
    upperArm_R: -10, forearm_R: -5, hand_R: 0,
    thigh_L: 0, shin_L: 0, foot_L: 0,
    thigh_R: 0, shin_R: 0, foot_R: 0
  },
  idle: (t = 0) => {
    const breathe = Math.sin(t * 3) * 1.5;
    return {
      torso: breathe * 0.5,
      head: -breathe * 0.4,
      upperArm_L: 10 + breathe, forearm_L: 5, hand_L: 0,
      upperArm_R: -10 - breathe, forearm_R: -5, hand_R: 0,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  },
  walk: (t = 0, speed = 1.0) => {
    const rad = (t * speed * 2.0 * Math.PI) % (Math.PI * 2);
    const swing = Math.sin(rad) * 28;
    return {
      torso: Math.sin(rad * 2) * 2,
      head: -Math.sin(rad * 2) * 1.5,
      upperArm_L: -swing * 0.8, forearm_L: Math.max(0, -swing * 0.5), hand_L: 0,
      upperArm_R: swing * 0.8, forearm_R: Math.max(0, swing * 0.5), hand_R: 0,
      thigh_L: swing, shin_L: swing > 0 ? swing * 0.8 : 5, foot_L: 0,
      thigh_R: -swing, shin_R: -swing > 0 ? -swing * 0.8 : 5, foot_R: 0
    };
  },
  run: (t = 0, speed = 1.3) => {
    const rad = (t * speed * 2.8 * Math.PI) % (Math.PI * 2);
    const swing = Math.sin(rad) * 45;
    return {
      torso: 12 + Math.sin(rad * 2) * 3,
      head: -8,
      upperArm_L: -swing * 1.1, forearm_L: 45 + Math.sin(rad) * 30, hand_L: 0,
      upperArm_R: swing * 1.1, forearm_R: 45 - Math.sin(rad) * 30, hand_R: 0,
      thigh_L: swing, shin_L: swing > 0 ? swing * 1.2 : 10, foot_L: -10,
      thigh_R: -swing, shin_R: -swing > 0 ? -swing * 1.2 : 10, foot_R: -10
    };
  },
  sit: {
    torso: 0,
    head: 0,
    upperArm_L: 20, forearm_L: 40, hand_L: 0,
    upperArm_R: 20, forearm_R: 40, hand_R: 0,
    thigh_L: 90, shin_L: -90, foot_L: 0,
    thigh_R: 90, shin_R: -90, foot_R: 0
  },
  wave: (t = 0) => {
    const waveAngle = Math.sin(t * 8) * 22;
    return {
      torso: 0,
      head: 2,
      upperArm_L: 10, forearm_L: 5, hand_L: 0,
      upperArm_R: -130, forearm_R: -45 + waveAngle, hand_R: waveAngle * 0.8,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  },
  point: {
    torso: 4,
    head: 4,
    upperArm_L: 10, forearm_L: 5, hand_L: 0,
    upperArm_R: -85, forearm_R: -5, hand_R: 0,
    thigh_L: 0, shin_L: 0, foot_L: 0,
    thigh_R: 0, shin_R: 0, foot_R: 0
  },
  jump: (t = 0) => {
    return {
      torso: -6,
      head: -4,
      upperArm_L: -120, forearm_L: -30, hand_L: 0,
      upperArm_R: -120, forearm_R: -30, hand_R: 0,
      thigh_L: 45, shin_L: -65, foot_L: 20,
      thigh_R: 45, shin_R: -65, foot_R: 20
    };
  },
  surprised: (t = 0) => {
    const shiver = Math.sin(t * 36) * 3;
    return {
      torso: -8,
      head: -12 + shiver,
      upperArm_L: -110 + shiver, forearm_L: -40, hand_L: shiver,
      upperArm_R: -110 - shiver, forearm_R: -40, hand_R: -shiver,
      thigh_L: 15, shin_L: -20, foot_L: 5,
      thigh_R: 15, shin_R: -20, foot_R: 5
    };
  },
  talking: (t = 0) => {
    const talkBob = Math.sin(t * 10) * 4;
    return {
      torso: talkBob * 0.3,
      head: talkBob,
      upperArm_L: 15 + talkBob, forearm_L: 25 - talkBob, hand_L: 0,
      upperArm_R: -20 + talkBob, forearm_R: -45 + talkBob, hand_R: 0,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  }
};

/**
 * Giải ma trận chuyển vị phân cấp xương (Hierarchical Forward Kinematics)
 */
export function solveImportedBoneTransforms(parts = {}, poseAngles = {}) {
  const transforms = {};
  const partKeys = Object.keys(parts);

  function computeTransform(partId) {
    if (transforms[partId]) return transforms[partId];
    const p = parts[partId];
    if (!p) return null;

    let parentT = { x: 0, y: 0, rot: 0, scaleX: 1, scaleY: 1 };
    if (p.parent && p.parent !== 'root' && parts[p.parent]) {
      parentT = computeTransform(p.parent);
    }

    const poseRotDeg = poseAngles[partId] ?? poseAngles[p.name] ?? 0;
    const baseRotDeg = p.rotation || 0;
    const totalRotRad = ((baseRotDeg + poseRotDeg) * Math.PI) / 180;

    const cosP = Math.cos(parentT.rot);
    const sinP = Math.sin(parentT.rot);
    const localX = (p.position ? p.position[0] : (p.x || 0)) * (p.scaleX || 1);
    const localY = (p.position ? p.position[1] : (p.y || 0)) * (p.scaleY || 1);

    const worldX = parentT.x + (localX * cosP - localY * sinP) * parentT.scaleX;
    const worldY = parentT.y + (localX * sinP + localY * cosP) * parentT.scaleY;
    const worldRot = parentT.rot + totalRotRad;

    transforms[partId] = {
      x: worldX,
      y: worldY,
      rot: worldRot,
      rotation: worldRot,
      scaleX: parentT.scaleX * (p.scaleX || 1),
      scaleY: parentT.scaleY * (p.scaleY || 1),
      part: p
    };

    return transforms[partId];
  }

  partKeys.forEach(computeTransform);
  return transforms;
}

/**
 * Render một nhân vật nhập ngoài (Mode B — Imported Layered Character)
 */
export function drawImportedFigure(g, o = {}) {
  const char = o.outfit || o.character || {};
  const parts = char.parts || {};
  const partKeys = Object.keys(parts);
  if (partKeys.length === 0) return;

  const x = o.x ?? 0;
  const y = o.y ?? 0;
  const s = (o.s ?? 1) * (char.proportions?.scale || 1.0);
  const facing = o.facing ?? 1;
  const flipX = facing < 0 ? -1 : 1;
  const t = o.t ?? 0;
  const expr = o.expr || char.defaultExpression || 'neutral';

  g.save();
  if (o.alpha != null) g.globalAlpha *= o.alpha;

  // 1. Bóng đổ tiếp xúc trên mặt sàn
  if (o.shadow !== false) {
    g.fillStyle = 'rgba(0, 0, 0, 0.28)';
    g.beginPath();
    g.ellipse(x, y + 2, 40 * s, 8 * s, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 2. Tính toán góc quay của từng khớp từ Pose / Action
  let poseAngles = IMPORTED_POSE_ANGLES.stand;
  const poseName = typeof o.pose === 'string' ? o.pose : (o.action || 'stand');

  if (typeof IMPORTED_POSE_ANGLES[poseName] === 'function') {
    poseAngles = IMPORTED_POSE_ANGLES[poseName](t, o.speed || 1.0);
  } else if (IMPORTED_POSE_ANGLES[poseName]) {
    poseAngles = IMPORTED_POSE_ANGLES[poseName];
  }

  // Nếu o.pose chứa góc tùy biến trực tiếp
  if (o.pose && typeof o.pose === 'object' && o.pose.angles) {
    poseAngles = { ...poseAngles, ...o.pose.angles };
  }

  // 3. Giải ma trận chuyển vị phân cấp xương (Hierarchical Forward Kinematics)
  const transforms = solveImportedBoneTransforms(parts, poseAngles);

  // 4. Sắp xếp các bộ phận theo zIndex để vẽ từ sau ra trước
  const sortedParts = partKeys
    .map(k => transforms[k])
    .filter(Boolean)
    .sort((a, b) => (a.part.zIndex || 0) - (b.part.zIndex || 0));

  // 5. Render từng bộ phận lên canvas
  g.translate(x, y);
  g.scale(flipX * s, s);

  for (const tNode of sortedParts) {
    const p = tNode.part;
    // Kiểm tra xem có ảnh thay thế biểu cảm cho bộ phận này không (thường là head)
    let imgSrc = p.image || p.imagePath || p.dataUrl;
    if (char.expressions && char.expressions[expr] && char.expressions[expr][p.id]) {
      imgSrc = char.expressions[expr][p.id];
    } else if (p.id === 'head' && char.expressions && char.expressions[expr]?.head) {
      imgSrc = char.expressions[expr].head;
    }

    const img = getCachedImage(imgSrc);
    if (!img) continue;

    const pw = p.width || (img.naturalWidth ? img.naturalWidth : 60);
    const ph = p.height || (img.naturalHeight ? img.naturalHeight : 60);

    const pvX = p.pivotX != null ? p.pivotX : 0.5;
    const pvY = p.pivotY != null ? p.pivotY : 0.5;

    g.save();
    g.translate(tNode.x, tNode.y);
    g.rotate(tNode.rot);
    g.scale(tNode.scaleX, tNode.scaleY);

    if (img.complete && img.naturalWidth > 0) {
      g.drawImage(img, -pvX * pw, -pvY * ph, pw, ph);
    }

    g.restore();
  }

  g.restore();
}
