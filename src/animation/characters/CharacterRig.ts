import { LimbPoint, PoseJoints, ActionType } from "../types";

export const P = (o: PoseJoints): PoseJoints => o;

export const POSES: Record<string, PoseJoints> = {
  stand: P({
    head: [3, -208],
    sh: [0, -174],
    hip: [0, -100],
    eF: [9, -137],
    hF: [13, -101],
    eB: [-7, -136],
    hB: [-9, -100],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  relaxed: P({
    head: [4, -207],
    sh: [1, -173],
    hip: [0, -100],
    eF: [12, -138],
    hF: [20, -106],
    eB: [-8, -137],
    hB: [-14, -104],
    kF: [8, -50],
    fF: [10, 0],
    kB: [-4, -50],
    fB: [-12, 0]
  }),
  talk: P({
    head: [5, -208],
    sh: [1, -174],
    hip: [0, -100],
    eF: [22, -132],
    hF: [42, -146],
    eB: [-7, -136],
    hB: [-9, -100],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  explain: P({
    head: [5, -208],
    sh: [1, -174],
    hip: [0, -100],
    eF: [24, -136],
    hF: [46, -156],
    eB: [16, -134],
    hB: [34, -148],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  point: P({
    head: [5, -208],
    sh: [1, -174],
    hip: [0, -100],
    eF: [34, -170],
    hF: [68, -172],
    eB: [-7, -136],
    hB: [-9, -100],
    kF: [6, -50],
    fF: [6, 0],
    kB: [-6, -50],
    fB: [-12, 0]
  }),
  pointUp: P({
    head: [4, -209],
    sh: [1, -174],
    hip: [0, -100],
    eF: [18, -206],
    hF: [22, -246],
    eB: [-7, -136],
    hB: [-9, -100],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  wave: P({
    head: [4, -209],
    sh: [1, -174],
    hip: [0, -100],
    eF: [28, -196],
    hF: [36, -236],
    eB: [-7, -136],
    hB: [-9, -100],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  cheer: P({
    head: [3, -212],
    sh: [0, -176],
    hip: [0, -100],
    eF: [22, -206],
    hF: [36, -246],
    eB: [-20, -206],
    hB: [-32, -246],
    kF: [10, -50],
    fF: [16, 0],
    kB: [-10, -50],
    fB: [-16, 0]
  }),
  handsOnHead: P({
    head: [3, -208],
    sh: [0, -174],
    hip: [0, -100],
    eF: [32, -196],
    hF: [12, -230],
    eB: [-28, -196],
    hB: [-8, -232],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  crossArms: P({
    head: [2, -208],
    sh: [0, -174],
    hip: [0, -100],
    eF: [16, -142],
    hF: [-8, -150],
    eB: [10, -144],
    hB: [14, -152],
    kF: [6, -50],
    fF: [6, 0],
    kB: [-6, -50],
    fB: [-12, 0]
  }),
  think: P({
    head: [6, -206],
    sh: [1, -173],
    hip: [0, -100],
    eF: [24, -148],
    hF: [16, -192],
    eB: [16, -134],
    hB: [6, -140],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  sit: P({
    head: [0, -148],
    sh: [-4, -114],
    hip: [-6, -45],
    eF: [8, -78],
    hF: [24, -48],
    eB: [-2, -76],
    hB: [16, -48],
    kF: [32, -45],
    fF: [36, 0],
    kB: [26, -45],
    fB: [28, 0]
  }),
  holdObject: P({
    head: [4, -208],
    sh: [0, -174],
    hip: [0, -100],
    eF: [26, -150],
    hF: [44, -164],
    eB: [12, -148],
    hB: [32, -156],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  holdFront: P({
    head: [5, -207],
    sh: [1, -173],
    hip: [0, -100],
    eF: [22, -140],
    hF: [36, -152],
    eB: [16, -142],
    hB: [30, -154],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  sad: P({
    head: [12, -192],
    sh: [6, -166],
    hip: [0, -100],
    eF: [10, -132],
    hF: [12, -98],
    eB: [-2, -132],
    hB: [-2, -98],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  }),
  ready: P({
    head: [12, -182],
    sh: [6, -148],
    hip: [0, -80],
    eF: [34, -132],
    hF: [56, -146],
    eB: [-26, -132],
    hB: [-46, -146],
    kF: [26, -44],
    fF: [22, 0],
    kB: [-24, -44],
    fB: [-24, 0]
  }),
  shrug: P({
    head: [3, -206],
    sh: [0, -172],
    hip: [0, -100],
    eF: [26, -156],
    hF: [40, -176],
    eB: [-24, -156],
    hB: [-38, -176],
    kF: [6, -50],
    fF: [3, 0],
    kB: [-6, -50],
    fB: [-11, 0]
  })
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpPoint(p1: LimbPoint, p2: LimbPoint, t: number): LimbPoint {
  return [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
}

/**
 * Analytical 2-bone Inverse Kinematics for smooth elbows & knees
 */
export function ik(p0: LimbPoint, p1: LimbPoint, l1: number, l2: number, bendDir: number = 1): LimbPoint {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dist = Math.max(1, Math.hypot(dx, dy));
  const maxL = l1 + l2 - 0.01;
  const d = Math.min(dist, maxL);
  const ang = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  const elbowAng = ang + bendDir * a;
  return [p0[0] + l1 * Math.cos(elbowAng), p0[1] + l1 * Math.sin(elbowAng)];
}

/**
 * Blend smoothly between two complete skeletal poses
 */
export function blendPose(poseA: PoseJoints, poseB: PoseJoints, t: number): PoseJoints {
  const pA = poseA || POSES.stand;
  const pB = poseB || POSES.stand;
  const clampT = Math.max(0, Math.min(1, t));
  return {
    head: lerpPoint(pA.head, pB.head, clampT),
    sh: lerpPoint(pA.sh, pB.sh, clampT),
    hip: lerpPoint(pA.hip, pB.hip, clampT),
    eF: lerpPoint(pA.eF, pB.eF, clampT),
    hF: lerpPoint(pA.hF, pB.hF, clampT),
    eB: lerpPoint(pA.eB, pB.eB, clampT),
    hB: lerpPoint(pA.hB, pB.hB, clampT),
    kF: lerpPoint(pA.kF, pB.kF, clampT),
    fF: lerpPoint(pA.fF, pB.fF, clampT),
    kB: lerpPoint(pA.kB, pB.kB, clampT),
    fB: lerpPoint(pA.fB, pB.fB, clampT)
  };
}

/**
 * Generate walk cycle pose at given phase
 */
export function walkPose(phase: number, options: { stride?: number; lift?: number; bob?: number; arm?: number; lean?: number; run?: boolean } = {}): PoseJoints {
  const { stride = 26, lift = 12, bob = 3.5, arm = 16, lean = 2, run = false } = options;
  const st = run ? 46 : stride;
  const li = run ? 34 : lift;
  const bb = run ? 7 : bob;
  const ar = run ? 30 : arm;
  const le = run ? 14 : lean;

  const hipY = -100 + (run ? 6 : 0) - bb * (1 - Math.abs(Math.sin(phase))) + bb * 0.5;
  const hip: LimbPoint = [0, hipY];
  const sh: LimbPoint = [le, hipY - 74];
  const head: LimbPoint = [le + 4, hipY - 108];

  const foot = (ph: number): LimbPoint => [st * Math.sin(ph), -li * Math.max(0, Math.cos(ph))];
  const fF = foot(phase);
  const fB = foot(phase + Math.PI);

  const kF = ik(hip, fF, 52, 52, 1);
  const kB = ik(hip, fB, 52, 52, 1);

  const hand = (ph: number): LimbPoint => run
    ? [le + ar * Math.sin(ph) * 0.9 + 6, hipY - 46 - Math.cos(ph) * 10]
    : [le * 0.5 - ar * Math.sin(ph) + 4, hipY - 2];

  const hF = hand(phase + Math.PI);
  const hB = hand(phase);

  const elbow = (h: LimbPoint): LimbPoint => run
    ? [lerp(sh[0], h[0], 0.5) - 14, lerp(sh[1], h[1], 0.5) + 6]
    : [lerp(sh[0], h[0], 0.5) - 3, sh[1] + 38];

  return { head, sh, hip, eF: elbow(hF), hF, eB: elbow(hB), hB, kF, fF, kB, fB };
}

/**
 * Natural breathing idle animation
 */
export function breathePose(basePose: PoseJoints, frame: number, speed: number = 0.08, amount: number = 3): PoseJoints {
  const b = Math.sin(frame * speed) * amount;
  const q = Math.sin(frame * speed - 0.4) * (amount * 0.7);

  return {
    head: [basePose.head[0], basePose.head[1] - b],
    sh: [basePose.sh[0], basePose.sh[1] - q],
    hip: [basePose.hip[0], basePose.hip[1] - b * 0.3],
    eF: [basePose.eF[0], basePose.eF[1] - q * 0.8],
    hF: [basePose.hF[0], basePose.hF[1] - q * 0.6],
    eB: [basePose.eB[0], basePose.eB[1] - q * 0.8],
    hB: [basePose.hB[0], basePose.hB[1] - q * 0.6],
    kF: basePose.kF,
    fF: basePose.fF,
    kB: basePose.kB,
    fB: basePose.fB
  };
}

/**
 * Waving arm animation on top of a pose
 */
export function wavingPose(basePose: PoseJoints, frame: number, speed: number = 0.35, angleAmp: number = 18): PoseJoints {
  const waveCycle = Math.sin(frame * speed);
  const waveX = basePose.hF[0] + waveCycle * angleAmp;
  const waveY = basePose.hF[1] + Math.abs(waveCycle) * 4;

  return {
    ...basePose,
    hF: [waveX, waveY],
    eF: [basePose.eF[0] + waveCycle * (angleAmp * 0.4), basePose.eF[1]]
  };
}

/**
 * Convert an array of limb points into a smooth quadratic Bézier SVG path string
 */
export function createSeamlessPath(points: LimbPoint[]): string {
  const valid = points.filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (valid.length < 2) return "";
  let d = `M ${valid[0][0].toFixed(2)} ${valid[0][1].toFixed(2)}`;
  for (let i = 1; i < valid.length - 1; i++) {
    const midX = (valid[i][0] + valid[i + 1][0]) / 2;
    const midY = (valid[i][1] + valid[i + 1][1]) / 2;
    d += ` Q ${valid[i][0].toFixed(2)} ${valid[i][1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`;
  }
  const last = valid[valid.length - 1];
  d += ` L ${last[0].toFixed(2)} ${last[1].toFixed(2)}`;
  return d;
}
