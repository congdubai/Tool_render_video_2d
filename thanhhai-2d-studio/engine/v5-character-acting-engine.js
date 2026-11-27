// engine/v5-character-acting-engine.js — V5.2 Phase 3: Unified Skeletal Animation & Character Acting Engine
// Pure JS (Node + Browser/Playwright Canvas 2D compatible, zero eval).
// Provides:
// - 20-Bone Semantic Mapping & Rig Capability Matrix (Mode A, Mode B Layered, Mode B Single PNG)
// - Forward Kinematics (FK) & 2-Bone Inverse Kinematics (IK) with reach constraints & pole direction
// - Multi-Phase Walk Cycle (Contact, Down, Passing, Up, Opposite Contact), Run Cycle, Jump Cycle
// - Motion Primitive Library (Head/Face, Arms, Torso, Legs, Full Body)
// - Multi-Channel Animation Blending (Root, Body, Head, L/R Arm, L/R Leg, Face, Eyes, Mouth, Props, VFX)
// - Natural Deterministic Idle, Facial Expression Transitions (14 expressions), Eye Tracking, Talking
// - Prop Attachment & Object Interaction State Machine + Multi-Character Choreography + Composite Actions
// - Secondary Motion (spring oscillation for hair/coat/backpack) & Deterministic Frame Evaluation

// ============================================================================
// 1. SEMANTIC BONE MAPPING & RIG CAPABILITY MATRIX
// ============================================================================

export const SEMANTIC_BONES_20 = [
  'root', 'pelvis', 'spine', 'chest', 'neck', 'head',
  'left_shoulder', 'right_shoulder',
  'left_upper_arm', 'right_upper_arm',
  'left_forearm', 'right_forearm',
  'left_hand', 'right_hand',
  'left_thigh', 'right_thigh',
  'left_shin', 'right_shin',
  'left_foot', 'right_foot'
];

export const SEMANTIC_TO_RIG15 = {
  root: 'hip',
  pelvis: 'hip',
  spine: 'torso',
  chest: 'torso',
  neck: 'neck',
  head: 'head',
  left_shoulder: 'shoulder_L',
  right_shoulder: 'shoulder_R',
  left_upper_arm: 'upper_arm_L',
  right_upper_arm: 'upper_arm_R',
  left_forearm: 'forearm_L',
  right_forearm: 'forearm_R',
  left_hand: 'wrist_L',
  right_hand: 'wrist_R',
  left_thigh: 'thigh_L',
  right_thigh: 'thigh_R',
  left_shin: 'shin_L',
  right_shin: 'shin_R',
  left_foot: 'ankle_L',
  right_foot: 'ankle_R'
};

export const RIG_CAPABILITIES = {
  procedural_rig: {
    mode: 'procedural_rig',
    skeletalAnimation: true,
    twoBoneIK: true,
    facialExpressions: true,
    eyeTracking: true,
    talkingMouth: true,
    secondaryMotion: true,
    squashStretch: true,
    supportedChannels: ['root', 'body', 'head', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'face', 'eyes', 'mouth', 'props']
  },
  layered_png_rig: {
    mode: 'layered_png_rig',
    skeletalAnimation: true,
    twoBoneIK: false,
    facialExpressions: true, // via sprite replacement
    eyeTracking: false,
    talkingMouth: false,
    secondaryMotion: false,
    squashStretch: true,
    supportedChannels: ['root', 'body', 'head', 'left_arm', 'right_arm', 'left_leg', 'right_leg', 'face', 'props']
  },
  single_png: {
    mode: 'single_png',
    skeletalAnimation: false, // NEVER fake limb bones on single PNG!
    twoBoneIK: false,
    facialExpressions: false,
    eyeTracking: false,
    talkingMouth: false,
    secondaryMotion: false,
    squashStretch: true,
    supportedChannels: ['root', 'body', 'props']
  }
};

export function getRigCapabilities(renderMode = 'procedural_rig') {
  return RIG_CAPABILITIES[renderMode] || RIG_CAPABILITIES.procedural_rig;
}

// ============================================================================
// 2. EASINGS & MATH HELPERS
// ============================================================================

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export const ACTING_EASINGS = {
  linear: (t) => clamp(t, 0, 1),
  easeIn: (t) => { const x = clamp(t, 0, 1); return x * x; },
  easeOut: (t) => { const x = clamp(t, 0, 1); return 1 - (1 - x) * (1 - x); },
  easeInOut: (t) => { const x = clamp(t, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
  backOut: (t) => { const x = clamp(t, 0, 1); const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  bounce: (t) => {
    let x = clamp(t, 0, 1);
    const n1 = 7.5625, d1 = 2.75;
    if (x < 1 / d1) return n1 * x * x;
    if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
    if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
};

function applyEasing(t, name = 'easeInOut') {
  const fn = ACTING_EASINGS[name] || ACTING_EASINGS.easeInOut;
  return fn(clamp(t, 0, 1));
}

// ============================================================================
// 3. TWO-BONE INVERSE KINEMATICS (REACH CONSTRAINTS & POLE DIRECTION)
// ============================================================================

/**
 * Solves 2-Bone IK in character local space (0 rad = straight down (0, +1), +deg swings forward/+x).
 * Never stretches limbs abnormally: clamps unreachable targets gracefully and reports reachable flag.
 */
export function solveTwoBoneIKAngles(rootPt, targetPt, len1, len2, options = {}) {
  const poleDir = options.poleDir ?? 1; // +1 = bend forward/elbow back, -1 = opposite
  const faceSign = options.faceSign ?? 1;
  const dx = (targetPt[0] - rootPt[0]) * faceSign;
  const dy = targetPt[1] - rootPt[1];
  const rawDist = Math.hypot(dx, dy);
  const maxReach = (len1 + len2) * 0.985;
  const minReach = Math.abs(len1 - len2) + 1.0;
  const reachable = rawDist <= maxReach && rawDist >= minReach;
  const d = clamp(rawDist, minReach, maxReach);

  // Angle from straight-down (+y) toward +x: atan2(dx, dy)
  const baseAngle = Math.atan2(dx, dy);
  const cosA = clamp((len1 * len1 + d * d - len2 * len2) / (2 * len1 * d), -1, 1);
  const cosB = clamp((len1 * len1 + len2 * len2 - d * d) / (2 * len1 * len2), -1, 1);
  const alpha = Math.acos(cosA);
  const beta = Math.acos(cosB);

  const upperRad = baseAngle + poleDir * alpha;
  const localForeRad = -poleDir * (Math.PI - beta);

  return {
    reachable,
    rawDist,
    maxReach,
    upperDeg: (upperRad * 180) / Math.PI,
    foreDeg: (localForeRad * 180) / Math.PI
  };
}

// ============================================================================
// 4. TRUE MULTI-PHASE WALK, RUN & JUMP CYCLES
// ============================================================================

/**
 * 5-Phase Walk Cycle (Contact -> Down -> Passing -> Up -> Opposite Contact)
 * Returns bone angles + vertical hip bob + stride phase.
 */
export function evaluateWalkCycle(t, options = {}) {
  const style = String(options.style || 'normal').toLowerCase();
  const speedMap = { slow: 0.72, normal: 1.0, fast: 1.45, confident: 1.12, tired: 0.75, sneaky: 0.85, holding: 0.95 };
  const speed = Number(options.speed || speedMap[style] || 1.0);
  const intensity = Number(options.intensity ?? 1.0);

  const freq = 1.25 * speed; // cycles per second (left+right step pair)
  const phase = (t * freq * Math.PI * 2) % (Math.PI * 2);
  const u = (phase / (Math.PI * 2)); // 0..1 across full 2-step cycle

  // 5 keyframe phases per half-cycle:
  // u = 0.00: R Contact (R forward, L back)
  // u = 0.12: Down (body lowest, weight absorbs)
  // u = 0.25: Passing (L swings forward with bent knee, body rises)
  // u = 0.38: Up (push off, body highest)
  // u = 0.50: Opposite Contact (L forward, R back)
  const strideAmp = (style === 'sneaky' ? 22 : (style === 'confident' ? 36 : (style === 'tired' ? 20 : 32))) * intensity;
  const armAmp = (style === 'confident' ? 38 : (style === 'tired' ? 16 : 28)) * intensity;
  const torsoLean = style === 'sneaky' ? 12 : (style === 'tired' ? 9 : (style === 'confident' ? -2 : 5));
  const bobAmp = style === 'sneaky' ? 2.0 : 3.5;

  const s = Math.sin(phase);
  const c = Math.cos(phase);

  // Double-frequency vertical bob: lowest at Down (phase ~ pi/4, 5pi/4), highest at Up (phase ~ 3pi/4, 7pi/4)
  const bob = -Math.sin(phase * 2 - Math.PI * 0.35) * bobAmp * intensity;

  // Knee bends sharply during swing/passing phase (when leg is swinging forward)
  const thighR = c * strideAmp;
  const thighL = -c * strideAmp;
  const swingR = Math.max(0, -s);
  const swingL = Math.max(0, s);
  const shinR = (4 + swingR * 44) * intensity;
  const shinL = (4 + swingL * 44) * intensity;

  const upperArmR = -c * armAmp;
  const upperArmL = c * armAmp;
  const foreArmR = -16 - Math.max(0, -c) * 22;
  const foreArmL = -16 - Math.max(0, c) * 22;

  return {
    hipY: -44 + bob - (style === 'sneaky' ? 4 : 0),
    torso: torsoLean + Math.sin(phase * 2) * 1.5,
    neck: -torsoLean * 0.35,
    head: -torsoLean * 0.3 + Math.sin(phase * 2) * 1.8,
    upper_arm_L: upperArmL,
    forearm_L: foreArmL,
    wrist_L: 0,
    upper_arm_R: upperArmR,
    forearm_R: foreArmR,
    wrist_R: 0,
    thigh_L: thighL,
    shin_L: shinL,
    ankle_L: swingL > 0.2 ? -12 : 2,
    thigh_R: thighR,
    shin_R: shinR,
    ankle_R: swingR > 0.2 ? -12 : 2
  };
}

export function evaluateRunCycle(t, options = {}) {
  const speed = Number(options.speed || 1.0);
  const intensity = Number(options.intensity ?? 1.0);
  const phase = t * 2.1 * speed * Math.PI * 2;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  const flight = Math.abs(Math.sin(phase)) * 6.5 * intensity;

  return {
    hipY: -45 - flight,
    torso: 16 * intensity,
    neck: -6,
    head: -7,
    upper_arm_L: c * 54 * intensity,
    forearm_L: -72,
    wrist_L: 0,
    upper_arm_R: -c * 54 * intensity,
    forearm_R: -72,
    wrist_R: 0,
    thigh_L: -c * 48 * intensity,
    shin_L: 12 + Math.max(0, s) * 68,
    ankle_L: -14,
    thigh_R: c * 48 * intensity,
    shin_R: 12 + Math.max(0, -s) * 68,
    ankle_R: -14
  };
}

export function evaluateJumpCycle(u, options = {}) {
  // u in 0..1: 0..0.18 anticipation/crouch, 0.18..0.32 takeoff, 0.32..0.72 airborne, 0.72..0.88 landing, 0.88..1.0 recovery
  const height = Number(options.jumpHeight || 48);
  if (u < 0.18) {
    const k = applyEasing(u / 0.18, 'easeInOut');
    return {
      hipY: -44 + k * 10,
      torso: k * 14,
      upper_arm_L: -k * 28, forearm_L: -25,
      upper_arm_R: -k * 28, forearm_R: -25,
      thigh_L: k * 36, shin_L: k * 62,
      thigh_R: k * 36, shin_R: k * 62,
      squashStretch: [1 + k * 0.08, 1 - k * 0.08]
    };
  }
  if (u < 0.72) {
    const airU = (u - 0.18) / 0.54;
    const arc = Math.sin(airU * Math.PI);
    return {
      hipY: -44 - arc * height,
      torso: -6 + airU * 10,
      upper_arm_L: -135 + airU * 30, forearm_L: -18,
      upper_arm_R: 135 - airU * 30, forearm_R: -18,
      thigh_L: 28 - airU * 16, shin_L: 42,
      thigh_R: -14 + airU * 20, shin_R: 25,
      squashStretch: [0.95, 1.06]
    };
  }
  if (u < 0.88) {
    const landU = (u - 0.72) / 0.16;
    const absorb = Math.sin(landU * Math.PI);
    return {
      hipY: -44 + absorb * 10,
      torso: absorb * 12,
      upper_arm_L: -20, forearm_L: -20,
      upper_arm_R: 20, forearm_R: -20,
      thigh_L: absorb * 32, shin_L: absorb * 56,
      thigh_R: absorb * 32, shin_R: absorb * 56,
      squashStretch: [1 + absorb * 0.08, 1 - absorb * 0.08]
    };
  }
  return { hipY: -44, torso: 0, squashStretch: [1, 1] };
}

// ============================================================================
// 5. NATURAL DETERMINISTIC IDLE & MOTION PRIMITIVES LIBRARY
// ============================================================================

export function evaluateNaturalIdle(t, seed = 101) {
  const s = (Number(seed) % 97) * 0.13;
  const breath = Math.sin(t * 2.2 + s);
  const sway = Math.sin(t * 1.1 + s * 2);
  const headMicro = Math.sin(t * 0.85 + s * 3) * 2.5;
  const blinkMod = (t + s * 0.7) % 3.4;
  const blink = blinkMod > 3.22 && blinkMod < 3.36;

  return {
    angles: {
      hipY: -44 + breath * 0.6,
      torso: sway * 1.4,
      neck: -sway * 0.6,
      head: headMicro,
      upper_arm_L: -6 + breath * 1.5,
      forearm_L: -10 + breath * 1.0,
      upper_arm_R: 6 - breath * 1.5,
      forearm_R: -10 + breath * 1.0,
      thigh_L: -2,
      shin_L: 2,
      thigh_R: 2,
      shin_R: 2
    },
    blink,
    look: [Math.sin(t * 0.7 + s) * 0.25, Math.cos(t * 0.5 + s) * 0.12]
  };
}

export const SUPPORTED_ACTING_EXPRESSIONS = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'scared',
  'confused', 'thinking', 'excited', 'disappointed', 'embarrassed',
  'dizzy', 'shocked', 'tired'
];

/**
 * Evaluates a single Motion Primitive at normalized progress u (0..1) and local time t.
 * Returns channel contributions: { channels: { [channel]: { weight, mode, angles, ... } }, supported }
 */
export function evaluateMotionPrimitive(action, tLocal, u, context = {}) {
  const type = String(action.type || action.action || 'idle').toLowerCase().trim();
  const hand = String(action.hand || 'right').toLowerCase();
  const intensity = Number(action.intensity ?? 1.0);
  const speed = Number(action.speed ?? 1.0);
  const weight = clamp(Number(action.blendWeight ?? 1.0), 0, 1);
  const e = applyEasing(u, action.easing || 'easeInOut');

  // --- WALK / LOCOMOTION ---
  if (type === 'walk' || type === 'walk_in' || type === 'move_to' || type === 'approach' || type === 'sneaky_walk' || type === 'tired_walk') {
    const walkStyle = type.includes('sneak') ? 'sneaky' : (type.includes('tired') ? 'tired' : (action.style || 'normal'));
    const w = evaluateWalkCycle(tLocal, { style: walkStyle, speed, intensity });
    // Smooth start/end deceleration envelope if requested
    const fadeIn = clamp(u / 0.12, 0, 1);
    const fadeOut = action.decelerate ? clamp((1 - u) / 0.18, 0, 1) : 1;
    const amp = fadeIn * fadeOut;
    return {
      supported: true,
      channels: {
        body: { weight: weight * amp, mode: 'override', angles: { hipY: w.hipY, torso: w.torso, neck: w.neck } },
        head: { weight: weight * amp, mode: 'override', angles: { head: w.head } },
        left_arm: { weight: weight * amp, mode: 'override', angles: { upper_arm_L: w.upper_arm_L, forearm_L: w.forearm_L, wrist_L: w.wrist_L } },
        right_arm: { weight: weight * amp, mode: 'override', angles: { upper_arm_R: w.upper_arm_R, forearm_R: w.forearm_R, wrist_R: w.wrist_R } },
        left_leg: { weight: weight * amp, mode: 'override', angles: { thigh_L: w.thigh_L, shin_L: w.shin_L, ankle_L: w.ankle_L } },
        right_leg: { weight: weight * amp, mode: 'override', angles: { thigh_R: w.thigh_R, shin_R: w.shin_R, ankle_R: w.ankle_R } }
      }
    };
  }

  // --- RUN ---
  if (type === 'run' || type === 'chase' || type === 'flee') {
    const r = evaluateRunCycle(tLocal, { speed, intensity });
    return {
      supported: true,
      channels: {
        body: { weight, mode: 'override', angles: { hipY: r.hipY, torso: r.torso, neck: r.neck } },
        head: { weight, mode: 'override', angles: { head: r.head } },
        left_arm: { weight, mode: 'override', angles: { upper_arm_L: r.upper_arm_L, forearm_L: r.forearm_L } },
        right_arm: { weight, mode: 'override', angles: { upper_arm_R: r.upper_arm_R, forearm_R: r.forearm_R } },
        left_leg: { weight, mode: 'override', angles: { thigh_L: r.thigh_L, shin_L: r.shin_L, ankle_L: r.ankle_L } },
        right_leg: { weight, mode: 'override', angles: { thigh_R: r.thigh_R, shin_R: r.shin_R, ankle_R: r.ankle_R } }
      }
    };
  }

  // --- JUMP ---
  if (type === 'jump' || type === 'land') {
    const j = evaluateJumpCycle(u, { jumpHeight: action.jumpHeight || 48 });
    return {
      supported: true,
      squashStretch: j.squashStretch,
      channels: {
        body: { weight, mode: 'override', angles: { hipY: j.hipY, torso: j.torso || 0 } },
        left_arm: { weight, mode: 'override', angles: { upper_arm_L: j.upper_arm_L ?? -10, forearm_L: j.forearm_L ?? -10 } },
        right_arm: { weight, mode: 'override', angles: { upper_arm_R: j.upper_arm_R ?? 10, forearm_R: j.forearm_R ?? -10 } },
        left_leg: { weight, mode: 'override', angles: { thigh_L: j.thigh_L ?? 0, shin_L: j.shin_L ?? 2 } },
        right_leg: { weight, mode: 'override', angles: { thigh_R: j.thigh_R ?? 0, shin_R: j.shin_R ?? 2 } }
      }
    };
  }

  // --- WAVE ---
  if (type === 'wave') {
    const raise = clamp(u / 0.18, 0, 1);
    const lower = clamp((1 - u) / 0.18, 0, 1);
    const env = Math.min(raise, lower);
    const waveOsc = Math.sin(tLocal * 9.5 * speed) * 24 * intensity;
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const angles = hand === 'left'
      ? { upper_arm_L: lerp(-8, -142, env), forearm_L: lerp(-10, 34 + waveOsc, env), wrist_L: waveOsc * 0.5 }
      : { upper_arm_R: lerp(8, 142, env), forearm_R: lerp(-10, -34 + waveOsc, env), wrist_R: waveOsc * 0.5 };
    return {
      supported: true,
      channels: {
        [ch]: { weight, mode: 'override', angles },
        head: { weight: 0.6 * env, mode: 'additive', angles: { head: -3 } }
      }
    };
  }

  // --- RAISE / LOWER / BEND / EXTEND / POINT / REACH / PRESS BUTTON / SCRATCH HEAD ---
  if (type === 'raise_arm') {
    const ang = Number(action.angle ?? 125) * e * intensity;
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const angles = hand === 'left' ? { upper_arm_L: -ang, forearm_L: 18 } : { upper_arm_R: ang, forearm_R: -18 };
    return { supported: true, channels: { [ch]: { weight, mode: 'override', angles } } };
  }
  if (type === 'lower_arm') {
    const fromAng = Number(action.fromAngle ?? 125);
    const ang = lerp(fromAng, 8, e);
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const angles = hand === 'left' ? { upper_arm_L: -ang, forearm_L: -10 } : { upper_arm_R: ang, forearm_R: -10 };
    return { supported: true, channels: { [ch]: { weight, mode: 'override', angles } } };
  }
  if (type === 'bend_elbow') {
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const b = Number(action.angle ?? 85) * e * intensity;
    const angles = hand === 'left' ? { forearm_L: b } : { forearm_R: -b };
    return { supported: true, channels: { [ch]: { weight, mode: 'override', angles } } };
  }
  if (type === 'point' || type === 'point_at_target') {
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const env = Math.min(clamp(u / 0.2, 0, 1), clamp((1 - u) / 0.15, 0, 1));
    const angles = hand === 'left'
      ? { upper_arm_L: -lerp(8, 88, env), forearm_L: 4 }
      : { upper_arm_R: lerp(8, 88, env), forearm_R: -4 };
    return { supported: true, channels: { [ch]: { weight, mode: 'override', angles } } };
  }
  if (type === 'reach' || type === 'grab' || type === 'press_button' || type === 'repair' || type === 'type_keyboard') {
    const ch = hand === 'left' ? 'left_arm' : 'right_arm';
    const pressOsc = (type === 'press_button' || type === 'type_keyboard' || type === 'repair') ? Math.sin(tLocal * 12) * 10 : 0;
    // Compute 2-bone IK if targetCoords provided, otherwise reach forward naturally
    let uDeg = 68 * e + pressOsc * 0.4;
    let fDeg = -32 * e - pressOsc;
    if (Array.isArray(action.targetOffset)) {
      const ik = solveTwoBoneIKAngles([15, -76], action.targetOffset, 18, 16, { poleDir: -1, faceSign: 1 });
      uDeg = ik.upperDeg * e + pressOsc * 0.3;
      fDeg = ik.foreDeg * e - pressOsc * 0.6;
    }
    const angles = hand === 'left'
      ? { upper_arm_L: -uDeg, forearm_L: -fDeg }
      : { upper_arm_R: uDeg, forearm_R: fDeg };
    return {
      supported: true,
      channels: {
        body: { weight: 0.5, mode: 'additive', angles: { torso: 8 * e } },
        [ch]: { weight, mode: 'override', angles }
      }
    };
  }
  if (type === 'scratch_head' || type === 'thinking' || type === 'inspect') {
    const scratch = type === 'scratch_head' ? Math.sin(tLocal * 10) * 10 : Math.sin(tLocal * 2.5) * 3;
    return {
      supported: true,
      channels: {
        body: { weight: 0.7, mode: 'override', angles: { torso: type === 'inspect' ? 9 : 4 } },
        head: { weight: 0.8, mode: 'override', angles: { head: 6 + scratch * 0.2 } },
        right_arm: { weight, mode: 'override', angles: { upper_arm_R: 54, forearm_R: -108 + scratch } }
      }
    };
  }
  if (type === 'eureka' || type === 'celebrate' || type === 'idea_discovery') {
    const pulse = Math.sin(tLocal * 8) * 6;
    return {
      supported: true,
      channels: {
        body: { weight, mode: 'override', angles: { hipY: -44 - Math.abs(Math.sin(tLocal * 4)) * 3, torso: -5 } },
        head: { weight, mode: 'override', angles: { head: -4 } },
        right_arm: { weight, mode: 'override', angles: { upper_arm_R: 145 + pulse * 0.4, forearm_R: -20 + pulse } },
        left_arm: { weight, mode: 'override', angles: { upper_arm_L: -26, forearm_L: -24 } }
      }
    };
  }
  if (type === 'hold_cup' || type === 'drink_coffee') {
    const sip = type === 'drink_coffee' ? Math.sin(clamp((u - 0.3) / 0.4, 0, 1) * Math.PI) : 0;
    return {
      supported: true,
      channels: {
        right_arm: {
          weight,
          mode: 'override',
          angles: { upper_arm_R: lerp(34, 48, sip), forearm_R: lerp(-74, -108, sip), wrist_R: lerp(0, -18, sip) }
        },
        head: { weight: 0.6, mode: 'additive', angles: { head: -10 * sip } }
      }
    };
  }

  // --- HEAD & FACE PRIMITIVES ---
  if (type === 'turn_head' || type === 'tilt_head' || type === 'nod' || type === 'shake_head' || type === 'look_at' || type === 'look_at_target') {
    let headDeg = 0;
    let viewOverride = null;
    let look = [0, 0];

    if (type === 'turn_head') {
      viewOverride = action.view || action.direction || 'front';
    } else if (type === 'tilt_head') {
      headDeg = Number(action.angle ?? 12) * e * intensity;
    } else if (type === 'nod') {
      headDeg = Math.sin(tLocal * 8 * speed) * 10 * intensity;
    } else if (type === 'shake_head') {
      look = [Math.sin(tLocal * 12 * speed) * 0.8, 0];
      headDeg = Math.sin(tLocal * 12 * speed) * 5;
    } else if (type === 'look_at' || type === 'look_at_target') {
      if (Array.isArray(action.look)) look = action.look;
      else if (action.targetId === 'camera') { viewOverride = 'front'; look = [0, 0]; }
      else look = [0.6, -0.15];
    }

    return {
      supported: true,
      viewOverride,
      look,
      channels: {
        head: { weight, mode: 'additive', angles: { head: headDeg } }
      }
    };
  }

  // --- TORSO & BODY PRIMITIVES ---
  if (type === 'lean_forward' || type === 'lean_backward' || type === 'bend' || type === 'crouch' || type === 'sit' || type === 'step_backward' || type === 'recoil') {
    const torsoDeg = type === 'lean_backward' || type === 'recoil' ? -18 * e : (type === 'crouch' ? 24 * e : 16 * e);
    const hipY = type === 'crouch' ? -44 + 12 * e : (type === 'sit' ? -34 : -44);
    const legKnee = type === 'crouch' ? 42 * e : (type === 'sit' ? 85 : 2);
    const legThigh = type === 'crouch' ? 28 * e : (type === 'sit' ? 85 : 0);
    return {
      supported: true,
      channels: {
        body: { weight, mode: 'override', angles: { hipY, torso: torsoDeg } },
        left_leg: { weight, mode: 'override', angles: { thigh_L: legThigh, shin_L: legKnee } },
        right_leg: { weight, mode: 'override', angles: { thigh_R: legThigh, shin_R: legKnee } }
      }
    };
  }

  // --- TALKING / EXPRESSION / IDLE ---
  if (type === 'talk' || type === 'talking') {
    const g = Math.sin(tLocal * 6.5) * 14 * intensity;
    const talkAmp = 0.35 + 0.55 * Math.abs(Math.sin(tLocal * 9.5));
    return {
      supported: true,
      talk: talkAmp,
      channels: {
        head: { weight: 0.5, mode: 'additive', angles: { head: Math.sin(tLocal * 4) * 3.5 } },
        right_arm: { weight: 0.8, mode: 'override', angles: { upper_arm_R: 30 + g * 0.5, forearm_R: -62 + g } }
      }
    };
  }

  if (type === 'expression') {
    return {
      supported: true,
      expression: action.value || action.expression || 'neutral',
      channels: {}
    };
  }

  if (type === 'idle' || type === 'stand' || type === 'hold_pose') {
    return { supported: true, channels: {} };
  }

  // Unknown / unsupported action — reported explicitly (NEVER silently swallowed as horizontal slide!)
  return {
    supported: false,
    warning: `Action "${type}" is not registered in Motion Primitive Library.`,
    channels: {}
  };
}

// ============================================================================
// 6. MULTI-CHANNEL ANIMATION BLENDING & DETERMINISTIC FRAME EVALUATOR
// ============================================================================

const ALL_BONE_KEYS = [
  'hipY', 'torso', 'neck', 'head',
  'upper_arm_L', 'forearm_L', 'wrist_L',
  'upper_arm_R', 'forearm_R', 'wrist_R',
  'thigh_L', 'shin_L', 'ankle_L',
  'thigh_R', 'shin_R', 'ankle_R'
];

/**
 * Compiles a character's declarative actions / presets into deterministic acting tracks.
 */
export function compileCharacterActingTracks(charSpec = {}, sceneDurationSec = 5, seed = 101) {
  const durationMs = Math.round(sceneDurationSec * 1000);
  const rawActions = Array.isArray(charSpec.actions) ? charSpec.actions : [];
  const compiledActions = [];
  const warnings = [];

  let rollingX = charSpec.x ?? 510;
  for (let i = 0; i < rawActions.length; i++) {
    const a = rawActions[i];
    const startMs = Math.max(0, Math.round(a.startMs ?? (a.start !== undefined ? a.start * 1000 : 0)));
    const endMsRaw = a.endMs ?? (a.end !== undefined ? a.end * 1000 : undefined);
    const durMs = Math.max(50, Math.round(
      a.durationMs ?? (a.duration !== undefined ? a.duration * 1000 : (endMsRaw !== undefined ? endMsRaw - startMs : durationMs - startMs))
    ));
    const resolveCoordX = (v, fallback) => {
      if (v === undefined || v === null) return fallback;
      const num = Number(v);
      return num <= 1.5 && num >= 0 ? num * 1920 : num;
    };
    const fromX = a.fromX !== undefined ? resolveCoordX(a.fromX, rollingX) : (Array.isArray(a.from) ? resolveCoordX(a.from[0], rollingX) : rollingX);
    const toX = a.toX !== undefined ? resolveCoordX(a.toX, fromX) : (Array.isArray(a.to) ? resolveCoordX(a.to[0], fromX) : fromX);
    rollingX = toX;

    compiledActions.push({
      ...a,
      type: String(a.type || a.action || 'idle').toLowerCase(),
      startMs,
      durationMs: durMs,
      endMs: startMs + durMs,
      fromX,
      toX,
      priority: Number(a.priority ?? (i + 1))
    });
  }

  // If no explicit actions array, build automatic acting track from legacy action/targetPosition
  if (compiledActions.length === 0) {
    const baseAct = String(charSpec.action || 'stand').toLowerCase();
    compiledActions.push({
      type: baseAct,
      startMs: 0,
      durationMs,
      endMs: durationMs,
      fromX: charSpec.x,
      toX: charSpec.targetX ?? charSpec.x,
      priority: 1
    });
  }

  return {
    characterId: charSpec.characterId,
    durationMs,
    seed,
    baseX: charSpec.x ?? 510,
    baseY: charSpec.y ?? 560,
    baseView: charSpec.view || 'three_quarter_right',
    baseExpression: charSpec.emotion || 'neutral',
    secondaryExpression: charSpec.secondaryEmotion || null,
    actions: compiledActions,
    warnings
  };
}

/**
 * Deterministically evaluates a character's complete acting state at scene local time `tSec`.
 * Supports forward seek, backward seek, preview scrubbing, and sequential MP4 rendering identically.
 */
export function evaluateActingFrame(track, tSec, options = {}) {
  const tMs = Math.max(0, Math.round(tSec * 1000));
  const idle = evaluateNaturalIdle(tSec, track.seed || 101);
  const angles = { ...idle.angles };

  let curX = track.baseX ?? 510;
  let curY = track.baseY ?? 560;
  let curView = track.baseView || 'three_quarter_right';
  let curExpr = track.baseExpression || 'neutral';
  if (track.secondaryExpression && tMs >= (track.durationMs || 4000) * 0.5) {
    curExpr = track.secondaryExpression;
  }

  let curLook = [...idle.look];
  let curTalk = 0;
  let squashStretch = [1, 1];
  let visible = true;

  // Channel accumulators: each bone starts from natural idle and gets blended by active actions
  const active = (track.actions || []).filter(a => tMs >= a.startMs && tMs <= a.endMs);
  active.sort((a, b) => (a.priority || 1) - (b.priority || 1));

  // Root X interpolation & persistent state (view/expression) from completed or active actions
  for (const act of (track.actions || [])) {
    if (act.fromX !== undefined && act.toX !== undefined && act.fromX !== act.toX) {
      if (tMs >= act.endMs) {
        curX = act.toX;
      } else if (tMs >= act.startMs) {
        const u = clamp((tMs - act.startMs) / Math.max(1, act.durationMs), 0, 1);
        const easedU = act.decelerate ? applyEasing(u, 'easeOut') : u;
        curX = lerp(act.fromX, act.toX, easedU);
      }
    }
    if (tMs >= act.endMs) {
      if ((act.type === 'turn_head' || act.type === 'turn_body' || act.type === 'turn') && (act.targetView || act.view)) {
        curView = act.targetView || act.view;
      }
      if (act.type === 'expression' && (act.value || act.expression)) {
        curExpr = act.value || act.expression;
      } else if (act.expression) {
        curExpr = act.expression;
      }
    }
  }

  for (const act of active) {
    const localT = (tMs - act.startMs) / 1000;
    const u = clamp((tMs - act.startMs) / Math.max(1, act.durationMs), 0, 1);
    const evalRes = evaluateMotionPrimitive(act, localT, u, options);

    if (evalRes.viewOverride) curView = evalRes.viewOverride;
    if (evalRes.expression) curExpr = evalRes.expression;
    else if (act.expression) curExpr = act.expression;
    if (evalRes.look) curLook = evalRes.look;
    if (evalRes.talk !== undefined) curTalk = Math.max(curTalk, evalRes.talk);
    if (evalRes.squashStretch) squashStretch = evalRes.squashStretch;

    for (const chData of Object.values(evalRes.channels || {})) {
      const w = clamp(chData.weight ?? 1, 0, 1);
      for (const [boneKey, val] of Object.entries(chData.angles || {})) {
        if (chData.mode === 'additive') {
          angles[boneKey] = (angles[boneKey] || 0) + val * w;
        } else {
          angles[boneKey] = lerp(angles[boneKey] ?? 0, val, w);
        }
      }
    }
  }

  // Secondary motion (hair/coat spring oscillation reacting to velocity & torso angle)
  const secondaryMotion = {
    hairBounce: Math.sin(tSec * 7.5) * (Math.abs(angles.hipY + 44) * 0.25 + 0.6),
    coatSway: -angles.torso * 0.35 + Math.sin(tSec * 4.5) * 1.2
  };

  return {
    x: curX,
    y: curY,
    view: curView,
    expression: curExpr,
    look: curLook,
    talk: curTalk,
    blink: idle.blink,
    squashStretch,
    secondaryMotion,
    visible,
    jointAngles: angles
  };
}

