/**
 * lib/character-rig-v2.mjs
 * Shared Kinematic Rig Engine for Chibi Character System V2
 * Hierarchical parent-child transforms, fixed bone lengths, IK/FK solvers, ground contact
 */

// Fixed Chibi V9 bone lengths (units)
export const CHIBI_BONE_LENGTHS = {
  upperArm: 18,
  forearm: 16,
  thigh: 24,
  calf: 22,
  torso: 36,
  headRadius: 36,
  headCenterOffset: 34
};

/**
 * 2-Bone Inverse Kinematics (IK) Solver
 * Computes the mid joint (elbow or knee) position ensuring rigid bone lengths
 */
export function solveIK(
  root,
  target,
  len1 = 24,
  len2 = 22,
  bendDir = 1 // 1 for forward bend (knee/elbow), -1 for reverse
) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  let dist = Math.hypot(dx, dy);

  const maxReach = len1 + len2 - 0.001;
  const clampedDist = Math.max(Math.abs(len1 - len2) + 0.001, Math.min(dist, maxReach));

  const baseAngle = Math.atan2(dy, dx);
  const cosAlpha = (len1 * len1 + clampedDist * clampedDist - len2 * len2) / (2 * len1 * clampedDist);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosAlpha)));

  const angle = baseAngle + bendDir * alpha;
  return [
    root[0] + Math.cos(angle) * len1,
    root[1] + Math.sin(angle) * len1
  ];
}

/**
 * Standard Chibi V9 Skeletal Poses
 * Local space: ground is y=0, up is negative y (-y), forward facing is +x.
 */
export const CHIBI_POSES_V2 = {
  // 1. Idle / Stand
  stand: {
    hip: [0, -46],
    sh: [0, -82],
    head: [2, -116],

    shNear: [6, -80],
    eNear: [10, -64],
    hNear: [12, -48],

    shFar: [-6, -80],
    eFar: [-8, -64],
    hFar: [-9, -48],

    hipNear: [8, -46],
    kNear: [8, -22],
    fNear: [8, 0],

    hipFar: [-8, -46],
    kFar: [-8, -22],
    fFar: [-8, 0]
  },

  // 2. Walk Cycle Base
  walk: {
    hip: [0, -47],
    sh: [2, -83],
    head: [3, -117],

    shNear: [8, -81],
    eNear: [-2, -66],
    hNear: [-10, -52],

    shFar: [-6, -81],
    eFar: [6, -67],
    hFar: [18, -56],

    hipNear: [8, -47],
    kNear: [16, -24],
    fNear: [18, 0],

    hipFar: [-8, -47],
    kFar: [-14, -26],
    fFar: [-16, -4]
  },

  // 3. Run Cycle Base
  run: {
    hip: [4, -49],
    sh: [10, -84],
    head: [14, -118],

    shNear: [14, -82],
    eNear: [-4, -68],
    hNear: [-18, -58],

    shFar: [-2, -82],
    eFar: [16, -72],
    hFar: [28, -66],

    hipNear: [10, -49],
    kNear: [24, -28],
    fNear: [26, 0],

    hipFar: [-6, -49],
    kFar: [-18, -32],
    fFar: [-24, -12]
  },

  // 4. Sitting on ground
  sit: {
    hip: [0, -32],
    sh: [1, -68],
    head: [3, -102],

    shNear: [7, -66],
    eNear: [16, -52],
    hNear: [22, -34],

    shFar: [-7, -66],
    eFar: [4, -54],
    hFar: [12, -36],

    hipNear: [8, -32],
    kNear: [28, -32],
    fNear: [30, 0],

    hipFar: [-6, -32],
    kFar: [24, -30],
    fFar: [26, 0]
  },

  // 5. Sitting on chair
  sit_chair: {
    hip: [0, -36],
    sh: [0, -72],
    head: [2, -106],

    shNear: [6, -70],
    eNear: [14, -54],
    hNear: [18, -38],

    shFar: [-6, -70],
    eFar: [8, -56],
    hFar: [12, -40],

    hipNear: [6, -36],
    kNear: [24, -36],
    fNear: [24, 0],

    hipFar: [-6, -36],
    kFar: [20, -34],
    fFar: [20, 0]
  },

  // 6. Waving hand
  wave: {
    hip: [0, -46],
    sh: [0, -82],
    head: [3, -116],

    shNear: [6, -80],
    eNear: [18, -94],
    hNear: [22, -118],

    shFar: [-6, -80],
    eFar: [-8, -64],
    hFar: [-9, -48],

    hipNear: [8, -46],
    kNear: [8, -22],
    fNear: [8, 0],

    hipFar: [-8, -46],
    kFar: [-8, -22],
    fFar: [-8, 0]
  },

  // 7. Pointing
  point: {
    hip: [0, -46],
    sh: [1, -82],
    head: [4, -116],

    shNear: [8, -80],
    eNear: [24, -80],
    hNear: [40, -80],

    shFar: [-6, -80],
    eFar: [-8, -64],
    hFar: [-9, -48],

    hipNear: [8, -46],
    kNear: [10, -22],
    fNear: [10, 0],

    hipFar: [-8, -46],
    kFar: [-6, -22],
    fFar: [-6, 0]
  },

  // 8. Talking with gesturing hands
  talk: {
    hip: [0, -46],
    sh: [1, -82],
    head: [4, -116],

    shNear: [7, -80],
    eNear: [16, -66],
    hNear: [26, -74],

    shFar: [-6, -80],
    eFar: [8, -68],
    hFar: [18, -76],

    hipNear: [8, -46],
    kNear: [8, -22],
    fNear: [8, 0],

    hipFar: [-8, -46],
    kFar: [-8, -22],
    fFar: [-8, 0]
  },

  // 9. Holding phone
  phone: {
    hip: [0, -46],
    sh: [1, -82],
    head: [5, -115],

    shNear: [7, -80],
    eNear: [16, -72],
    hNear: [18, -96],

    shFar: [-6, -80],
    eFar: [-8, -64],
    hFar: [-9, -48],

    hipNear: [8, -46],
    kNear: [8, -22],
    fNear: [8, 0],

    hipFar: [-8, -46],
    kFar: [-8, -22],
    fFar: [-8, 0]
  },

  // 10. Holding cup
  cup: {
    hip: [0, -46],
    sh: [0, -82],
    head: [3, -116],

    shNear: [6, -80],
    eNear: [14, -66],
    hNear: [20, -70],

    shFar: [-6, -80],
    eFar: [-8, -64],
    hFar: [-9, -48],

    hipNear: [8, -46],
    kNear: [8, -22],
    fNear: [8, 0],

    hipFar: [-8, -46],
    kFar: [-8, -22],
    fFar: [-8, 0]
  }
};

CHIBI_POSES_V2.idle = CHIBI_POSES_V2.stand;
CHIBI_POSES_V2.standing = CHIBI_POSES_V2.stand;
CHIBI_POSES_V2.sitting = CHIBI_POSES_V2.sit;
CHIBI_POSES_V2.walking = CHIBI_POSES_V2.walk;
CHIBI_POSES_V2.running = CHIBI_POSES_V2.run;
CHIBI_POSES_V2.waving = CHIBI_POSES_V2.wave;
CHIBI_POSES_V2.pointing = CHIBI_POSES_V2.point;
CHIBI_POSES_V2.talking = CHIBI_POSES_V2.talk;
CHIBI_POSES_V2.hold_object = CHIBI_POSES_V2.cup;

/**
 * Trộn tuyến tính 2 khung xương Chibi
 */
export function blendSkeletons(a, b, t) {
  const k = Math.max(0, Math.min(1, t));
  const lerp = (p1, p2) => [
    p1[0] + (p2[0] - p1[0]) * k,
    p1[1] + (p2[1] - p1[1]) * k
  ];

  return {
    hip: lerp(a.hip, b.hip),
    sh: lerp(a.sh, b.sh),
    head: lerp(a.head, b.head),

    shNear: lerp(a.shNear, b.shNear),
    eNear: lerp(a.eNear, b.eNear),
    hNear: lerp(a.hNear, b.hNear),

    shFar: lerp(a.shFar, b.shFar),
    eFar: lerp(a.eFar, b.eFar),
    hFar: lerp(a.hFar, b.hFar),

    hipNear: lerp(a.hipNear, b.hipNear),
    kNear: lerp(a.kNear, b.kNear),
    fNear: lerp(a.fNear, b.fNear),

    hipFar: lerp(a.hipFar, b.hipFar),
    kFar: lerp(a.kFar, b.kFar),
    fFar: lerp(a.fFar, b.fFar)
  };
}

/**
 * Lấy khung xương Chibi tương ứng với tên pose
 */
export function getChibiSkeleton(pose) {
  if (!pose) return CHIBI_POSES_V2.stand;
  if (typeof pose === 'string') {
    return CHIBI_POSES_V2[pose] || CHIBI_POSES_V2.stand;
  }
  return {
    ...CHIBI_POSES_V2.stand,
    ...pose
  };
}

