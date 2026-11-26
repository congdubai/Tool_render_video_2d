// engine/v5-universal-motion-engine.js — Universal Motion Engine, Primitives & Kinematics (V5 Phase 4)
// Provides unified animation primitives, semantic bone mapping, Forward Kinematics (FK),
// 2-Bone Inverse Kinematics (IK), custom keyframe interpolation, and character rig validation.

export const MOTION_PRIMITIVES = {
  // Object primitives
  MOVE: 'move',
  ROTATE: 'rotate',
  SCALE: 'scale',
  FADE_IN: 'fade_in',
  FADE_OUT: 'fade_out',
  SHOW: 'show',
  HIDE: 'hide',
  FOLLOW_PATH: 'follow_path',
  BOUNCE: 'bounce',
  SHAKE: 'shake',
  SWING: 'swing',
  PULSE: 'pulse',
  HOLD_POSITION: 'hold_position',

  // Character primitives
  TURN_HEAD: 'turn_head',
  TILT_HEAD: 'tilt_head',
  LOOK_AT_TARGET: 'look_at_target',
  RAISE_ARM: 'raise_arm',
  LOWER_ARM: 'lower_arm',
  BEND_ELBOW: 'bend_elbow',
  EXTEND_ARM: 'extend_arm',
  ROTATE_TORSO: 'rotate_torso',
  LEAN_FORWARD: 'lean_forward',
  LEAN_BACKWARD: 'lean_backward',
  BEND_KNEE: 'bend_knee',
  LIFT_LEG: 'lift_leg',
  CROUCH: 'crouch',
  STAND_UP: 'stand_up',
  JUMP: 'jump',
  LAND: 'land',
  HOLD_POSE: 'hold_pose',

  // Interaction primitives
  REACH_TARGET: 'reach_target',
  ATTACH_PROP: 'attach_prop',
  DETACH_PROP: 'detach_prop',
  MOVE_PROP: 'move_prop',
  TRANSFER_PROP: 'transfer_prop',
  POINT_AT_TARGET: 'point_at_target',
  FACE_CHARACTER: 'face_character',
  APPROACH_TARGET: 'approach_target',
  MOVE_AWAY: 'move_away',

  // Camera primitives
  CAMERA_PAN: 'camera_pan',
  CAMERA_ZOOM: 'camera_zoom',
  CAMERA_FOLLOW: 'camera_follow',
  CAMERA_SHAKE: 'camera_shake',
  CAMERA_HOLD: 'camera_hold',
  CAMERA_REFRAME: 'camera_reframe'
};

export const SEMANTIC_BONE_ROLES = {
  HEAD: 'head',
  NECK: 'neck',
  TORSO: 'torso',
  PELVIS: 'pelvis',
  LEFT_UPPER_ARM: 'left_upper_arm',
  LEFT_FOREARM: 'left_forearm',
  LEFT_HAND: 'left_hand',
  RIGHT_UPPER_ARM: 'right_upper_arm',
  RIGHT_FOREARM: 'right_forearm',
  RIGHT_HAND: 'right_hand',
  LEFT_THIGH: 'left_thigh',
  LEFT_SHIN: 'left_shin',
  LEFT_FOOT: 'left_foot',
  RIGHT_THIGH: 'right_thigh',
  RIGHT_SHIN: 'right_shin',
  RIGHT_FOOT: 'right_foot'
};

export const WHITE_CARTOON_BONE_MAP = {
  [SEMANTIC_BONE_ROLES.HEAD]: 'head',
  [SEMANTIC_BONE_ROLES.TORSO]: 'sh',
  [SEMANTIC_BONE_ROLES.PELVIS]: 'hip',
  [SEMANTIC_BONE_ROLES.RIGHT_UPPER_ARM]: 'sh_to_eF',
  [SEMANTIC_BONE_ROLES.RIGHT_FOREARM]: 'eF_to_hF',
  [SEMANTIC_BONE_ROLES.RIGHT_HAND]: 'hF',
  [SEMANTIC_BONE_ROLES.LEFT_UPPER_ARM]: 'sh_to_eB',
  [SEMANTIC_BONE_ROLES.LEFT_FOREARM]: 'eB_to_hB',
  [SEMANTIC_BONE_ROLES.LEFT_HAND]: 'hB',
  [SEMANTIC_BONE_ROLES.RIGHT_THIGH]: 'hip_to_kF',
  [SEMANTIC_BONE_ROLES.RIGHT_SHIN]: 'kF_to_fF',
  [SEMANTIC_BONE_ROLES.RIGHT_FOOT]: 'fF',
  [SEMANTIC_BONE_ROLES.LEFT_THIGH]: 'hip_to_kB',
  [SEMANTIC_BONE_ROLES.LEFT_SHIN]: 'kB_to_fB',
  [SEMANTIC_BONE_ROLES.LEFT_FOOT]: 'fB'
};

/**
 * Resolves semantic bone name to actual rig joint/bone ID
 */
export function resolveSemanticBone(semanticBone, rigType = 'white_cartoon') {
  if (rigType === 'white_cartoon') {
    return WHITE_CARTOON_BONE_MAP[semanticBone] || semanticBone;
  }
  return semanticBone;
}

/**
 * Validates character rig hierarchy, joint limits, anchors, and checks for disconnected parts
 */
export function validateCharacterRigStructure(rig = {}) {
  const errors = [];
  const warnings = [];

  if (!rig || typeof rig !== 'object') {
    errors.push('Đối tượng rig không hợp lệ hoặc rỗng.');
    return { isValid: false, errors, warnings };
  }

  // Required essential joints
  const requiredJoints = ['head', 'sh', 'hip'];
  for (const j of requiredJoints) {
    if (!rig[j]) {
      errors.push(`Rig thiếu khớp cốt lõi: "${j}".`);
    }
  }

  // Check limb completeness (prevent disconnected limbs)
  const limbs = [
    { name: 'Cánh tay phải', joints: ['sh', 'eF', 'hF'] },
    { name: 'Cánh tay trái', joints: ['sh', 'eB', 'hB'] },
    { name: 'Chân phải', joints: ['hip', 'kF', 'fF'] },
    { name: 'Chân trái', joints: ['hip', 'kB', 'fB'] }
  ];

  for (const limb of limbs) {
    const present = limb.joints.filter(j => !!rig[j]);
    if (present.length > 0 && present.length < limb.joints.length) {
      warnings.push(`${limb.name} không trọn vẹn: thiếu các khớp [${limb.joints.filter(j => !rig[j]).join(', ')}].`);
    }
  }

  // Check for NaN or infinite coordinates
  for (const [k, v] of Object.entries(rig)) {
    if (Array.isArray(v)) {
      if (isNaN(v[0]) || isNaN(v[1]) || !isFinite(v[0]) || !isFinite(v[1])) {
        errors.push(`Khớp "${k}" chứa tọa độ không hợp lệ (NaN hoặc Infinity).`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Forward Kinematics (FK) solver
 * Computes positions of connected limb segments given root position, segment lengths, and relative angles
 */
export function solveFK(rootPosition = [0, 0], segments = []) {
  const points = [[rootPosition[0], rootPosition[1]]];
  let currentX = rootPosition[0];
  let currentY = rootPosition[1];
  let currentAngle = 0.0;

  for (const seg of segments) {
    const len = seg.length || 0;
    const relAngleRad = (seg.angleDeg || 0) * (Math.PI / 180);
    currentAngle += relAngleRad;

    currentX += Math.cos(currentAngle) * len;
    currentY += Math.sin(currentAngle) * len;
    points.push([currentX, currentY]);
  }

  return {
    jointPoints: points,
    endEffector: points[points.length - 1],
    totalAngleDeg: currentAngle * (180 / Math.PI)
  };
}

/**
 * 2-Bone Inverse Kinematics (IK) solver with clamping and joint angle limits
 */
export function solve2BoneIK(root, target, len1, len2, bendDir = 1, constraints = {}) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const dist = Math.hypot(dx, dy);

  // Maximum reachable distance (minus tiny epsilon to prevent division by zero)
  const maxReach = len1 + len2 - 0.001;
  const minReach = Math.abs(len1 - len2) + 0.001;
  const clampedDist = Math.max(minReach, Math.min(dist, maxReach));

  const isOutOfReach = dist > maxReach;

  const baseAngle = Math.atan2(dy, dx);
  const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
  const alphaAngle = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));
  const angle1 = baseAngle + bendDir * alphaAngle;

  const elbowX = root[0] + Math.cos(angle1) * len1;
  const elbowY = root[1] + Math.sin(angle1) * len1;

  // Hand position at end of len2
  const handAngle = Math.atan2(target[1] - elbowY, target[0] - elbowX);
  const handX = elbowX + Math.cos(handAngle) * len2;
  const handY = elbowY + Math.sin(handAngle) * len2;

  return {
    root: [root[0], root[1]],
    joint: [elbowX, elbowY],
    endEffector: [handX, handY],
    isOutOfReach,
    clampedDist,
    angle1Deg: angle1 * (180 / Math.PI),
    angle2Deg: handAngle * (180 / Math.PI)
  };
}

/**
 * Interpolation easing curves
 */
export const EASINGS = {
  linear: t => t,
  easeIn: t => t * t,
  easeOut: t => t * (2 - t),
  easeInOut: t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  anticipate: t => (t * t * ((2.70158 + 1) * t - 2.70158)),
  overshoot: t => {
    const s = 1.70158;
    const p = t - 1;
    return p * p * ((s + 1) * p + s) + 1;
  }
};

/**
 * Evaluates custom keyframe track at given time t (in milliseconds or seconds)
 */
export function evaluateCustomKeyframeTrack(track = {}, timeSec = 0) {
  const keyframes = Array.isArray(track.keyframes) ? track.keyframes : [];
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0].value;

  // Convert time to milliseconds if keyframes use timeMs
  const useMs = typeof keyframes[0].timeMs === 'number';
  const currTime = useMs ? timeSec * 1000 : timeSec;

  if (currTime <= (useMs ? keyframes[0].timeMs : keyframes[0].time)) {
    return keyframes[0].value;
  }
  const lastKf = keyframes[keyframes.length - 1];
  if (currTime >= (useMs ? lastKf.timeMs : lastKf.time)) {
    return lastKf.value;
  }

  // Find spanning keyframe segment
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kfA = keyframes[i];
    const kfB = keyframes[i + 1];
    const tA = useMs ? kfA.timeMs : kfA.time;
    const tB = useMs ? kfB.timeMs : kfB.time;

    if (currTime >= tA && currTime <= tB) {
      const span = tB - tA;
      const progress = span > 0 ? (currTime - tA) / span : 0;
      const easeFn = EASINGS[kfB.easing || kfA.easing || 'linear'] || EASINGS.linear;
      const easedProgress = easeFn(Math.max(0, Math.min(1, progress)));

      // Interpolate numeric, array or object
      if (typeof kfA.value === 'number' && typeof kfB.value === 'number') {
        return kfA.value + (kfB.value - kfA.value) * easedProgress;
      }
      if (Array.isArray(kfA.value) && Array.isArray(kfB.value)) {
        return kfA.value.map((v, idx) => v + ((kfB.value[idx] ?? v) - v) * easedProgress);
      }
      return progress < 0.5 ? kfA.value : kfB.value;
    }
  }

  return lastKf.value;
}

