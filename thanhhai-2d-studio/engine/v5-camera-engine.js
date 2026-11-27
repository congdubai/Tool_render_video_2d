// engine/v5-camera-engine.js — V5.2 Phase 4: Unified 2D Camera, Shot Library, Framing & Movement Engine
// Pure JS (Node + Browser/Playwright Canvas 2D compatible, zero eval).
// Never mutates character/prop world transforms; applies clamped 2D viewport transforms
// so zoom/pan NEVER exposes blank canvas outside background bounds.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

export const CAMERA_EASINGS = {
  linear: t => clamp(t, 0, 1),
  easeIn: t => { const x = clamp(t, 0, 1); return x * x; },
  easeOut: t => { const x = clamp(t, 0, 1); return 1 - (1 - x) * (1 - x); },
  easeInOut: t => { const x = clamp(t, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
  smoothStep: t => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
};

function applyCamEase(t, name = 'easeInOut') {
  return (CAMERA_EASINGS[name] || CAMERA_EASINGS.easeInOut)(clamp(t, 0, 1));
}

// ============================================================================
// 1. CAMERA SHOT LIBRARY (15 SHOTS WITH FRAMING RULES & SAFE BOUNDS)
// ============================================================================

export const SHOT_LIBRARY = {
  extreme_wide: {
    id: 'extreme_wide', label: 'Extreme Wide Shot', targetZoom: 1.0, minZoom: 1.0, maxZoom: 1.15,
    headroom: 0.25, lookRoom: 0.1, safeMargin: 0.05, focusOffsetY: -0.05,
    supportedSceneTypes: ['establishing', 'environment', 'historical_reenactment', 'timeline_explanation']
  },
  wide: {
    id: 'wide', label: 'Wide Shot', targetZoom: 1.0, minZoom: 1.0, maxZoom: 1.25,
    headroom: 0.18, lookRoom: 0.08, safeMargin: 0.06, focusOffsetY: -0.06,
    supportedSceneTypes: ['establishing', 'environment', 'historical_reenactment', 'comedy_action', 'conclusion']
  },
  full_body: {
    id: 'full_body', label: 'Full Body Shot', targetZoom: 1.18, minZoom: 1.0, maxZoom: 1.45,
    headroom: 0.14, lookRoom: 0.12, safeMargin: 0.08, focusOffsetY: -0.14,
    supportedSceneTypes: ['character_acting', 'comedy_action', 'follow_shot', 'establishing']
  },
  medium_wide: {
    id: 'medium_wide', label: 'Medium Wide Shot', targetZoom: 1.32, minZoom: 1.05, maxZoom: 1.6,
    headroom: 0.12, lookRoom: 0.12, safeMargin: 0.08, focusOffsetY: -0.18,
    supportedSceneTypes: ['character_acting', 'object_explanation', 'scientific_demonstration']
  },
  medium: {
    id: 'medium', label: 'Medium Shot', targetZoom: 1.48, minZoom: 1.15, maxZoom: 1.85,
    headroom: 0.11, lookRoom: 0.14, safeMargin: 0.08, focusOffsetY: -0.24,
    supportedSceneTypes: ['character_acting', 'character_dialogue', 'object_explanation', 'conclusion']
  },
  medium_closeup: {
    id: 'medium_closeup', label: 'Medium Close-up', targetZoom: 1.72, minZoom: 1.35, maxZoom: 2.15,
    headroom: 0.09, lookRoom: 0.14, safeMargin: 0.08, focusOffsetY: -0.32,
    supportedSceneTypes: ['character_dialogue', 'reaction_shot', 'character_acting']
  },
  closeup: {
    id: 'closeup', label: 'Close-up', targetZoom: 2.05, minZoom: 1.6, maxZoom: 2.6,
    headroom: 0.08, lookRoom: 0.12, safeMargin: 0.08, focusOffsetY: -0.40,
    supportedSceneTypes: ['reaction_shot', 'character_dialogue', 'character_acting']
  },
  extreme_closeup: {
    id: 'extreme_closeup', label: 'Extreme Close-up', targetZoom: 2.45, minZoom: 1.9, maxZoom: 3.0,
    headroom: 0.06, lookRoom: 0.08, safeMargin: 0.08, focusOffsetY: -0.44,
    supportedSceneTypes: ['reaction_shot', 'object_closeup']
  },
  two_shot: {
    id: 'two_shot', label: 'Two Shot', targetZoom: 1.22, minZoom: 1.0, maxZoom: 1.55,
    headroom: 0.14, lookRoom: 0.06, safeMargin: 0.08, focusOffsetY: -0.18,
    supportedSceneTypes: ['character_dialogue', 'comedy_action', 'visual_comparison']
  },
  group_shot: {
    id: 'group_shot', label: 'Group Shot', targetZoom: 1.12, minZoom: 1.0, maxZoom: 1.4,
    headroom: 0.16, lookRoom: 0.06, safeMargin: 0.07, focusOffsetY: -0.15,
    supportedSceneTypes: ['character_dialogue', 'establishing', 'conclusion']
  },
  object_closeup: {
    id: 'object_closeup', label: 'Object Close-up', targetZoom: 1.85, minZoom: 1.35, maxZoom: 2.5,
    headroom: 0.10, lookRoom: 0.05, safeMargin: 0.08, focusOffsetY: -0.10,
    supportedSceneTypes: ['object_closeup', 'object_explanation', 'scientific_demonstration']
  },
  reaction_shot: {
    id: 'reaction_shot', label: 'Reaction Shot', targetZoom: 1.88, minZoom: 1.45, maxZoom: 2.35,
    headroom: 0.09, lookRoom: 0.12, safeMargin: 0.08, focusOffsetY: -0.36,
    supportedSceneTypes: ['reaction_shot', 'comedy_action', 'character_dialogue']
  },
  diagram_shot: {
    id: 'diagram_shot', label: 'Diagram Shot', targetZoom: 1.0, minZoom: 1.0, maxZoom: 1.25,
    headroom: 0.08, lookRoom: 0.05, safeMargin: 0.06, focusOffsetY: 0.0,
    supportedSceneTypes: ['diagram_explanation', 'visual_comparison', 'timeline_explanation', 'text_graphic']
  },
  follow_shot: {
    id: 'follow_shot', label: 'Follow Shot', targetZoom: 1.28, minZoom: 1.05, maxZoom: 1.65,
    headroom: 0.14, lookRoom: 0.18, safeMargin: 0.08, focusOffsetY: -0.16,
    supportedSceneTypes: ['character_acting', 'comedy_action']
  },
  over_the_shoulder: {
    id: 'over_the_shoulder', label: 'Over-the-Shoulder Shot', targetZoom: 1.55, minZoom: 1.25, maxZoom: 1.95,
    headroom: 0.10, lookRoom: 0.16, safeMargin: 0.08, focusOffsetY: -0.28,
    supportedSceneTypes: ['character_dialogue'] // Only used when asset view supports back/three_quarter
  }
};

export const CAMERA_MOVEMENTS = [
  'static', 'pan_left', 'pan_right', 'pan_up', 'pan_down',
  'zoom_in', 'zoom_out', 'slow_push_in', 'pull_back',
  'follow_subject', 'track_object', 'reveal', 'focus_shift',
  'camera_shake', 'impact_shake', 'whip_pan'
];

export function normalizeShotType(raw = 'medium') {
  const s = String(raw || 'medium').toLowerCase().trim().replace(/[\s-]+/g, '_').replace(/_shot$/, '');
  if (SHOT_LIBRARY[s]) return s;
  if (SHOT_LIBRARY[s + '_shot']) return s + '_shot';
  if (s.includes('extreme_wide') || s === 'ews') return 'extreme_wide';
  if (s.includes('medium_wide') || s === 'mws') return 'medium_wide';
  if (s.includes('medium_close') || s === 'mcu') return 'medium_closeup';
  if (s.includes('extreme_close') || s === 'ecu') return 'extreme_closeup';
  if (s.includes('object')) return 'object_closeup';
  if (s.includes('reaction')) return 'reaction_shot';
  if (s.includes('diagram')) return 'diagram_shot';
  if (s.includes('follow')) return 'follow_shot';
  if (s.includes('two')) return 'two_shot';
  if (s.includes('group')) return 'group_shot';
  if (s.includes('full')) return 'full_body';
  if (s.includes('close')) return 'closeup';
  if (s.includes('wide')) return 'wide';
  return 'medium';
}

// ============================================================================
// 2. SUBJECT FRAMING & BOUNDING BOX CLAMPING (ZERO BLANK CANVAS)
// ============================================================================

export function computeSubjectBounds(entities = {}, targetIds = []) {
  const keys = (Array.isArray(targetIds) && targetIds.length > 0)
    ? targetIds.filter(id => entities[id])
    : Object.keys(entities);

  if (keys.length === 0) {
    return { minX: 320, minY: 160, maxX: 960, maxY: 580, cx: 640, cy: 360, width: 640, height: 420 };
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const e = entities[k];
    const ex = Array.isArray(e) ? e[0] : (e.x ?? 640);
    const ey = Array.isArray(e) ? e[1] : (e.y ?? 560);
    const w = Array.isArray(e) ? 140 : (e.width ?? 140);
    const h = Array.isArray(e) ? 320 : (e.height ?? 320);
    minX = Math.min(minX, ex - w * 0.5);
    maxX = Math.max(maxX, ex + w * 0.5);
    minY = Math.min(minY, ey - h);
    maxY = Math.max(maxY, ey);
  }
  return {
    minX, minY, maxX, maxY,
    cx: (minX + maxX) * 0.5,
    cy: (minY + maxY) * 0.5,
    width: Math.max(80, maxX - minX),
    height: Math.max(120, maxY - minY)
  };
}

export function clampCameraToBounds(cam, viewportW = 1280, viewportH = 720, bgBounds = { width: 1280, height: 720 }) {
  const minZoom = Math.max(1.0, viewportW / bgBounds.width, viewportH / bgBounds.height);
  const zoom = clamp(Number(cam.zoom || 1.0), minZoom, 3.0);
  const halfW = (viewportW / zoom) * 0.5;
  const halfH = (viewportH / zoom) * 0.5;
  const minX = halfW;
  const maxX = Math.max(halfW, bgBounds.width - halfW);
  const minY = halfH;
  const maxY = Math.max(halfH, bgBounds.height - halfH);

  return {
    ...cam,
    x: clamp(Number(cam.x ?? viewportW * 0.5), minX, maxX),
    y: clamp(Number(cam.y ?? viewportH * 0.5), minY, maxY),
    zoom,
    rotationDeg: clamp(Number(cam.rotationDeg || 0), -8, 8)
  };
}

export function computeAutomaticFraming(shotTypeRaw, bounds, options = {}) {
  const shotKey = normalizeShotType(shotTypeRaw);
  const preset = SHOT_LIBRARY[shotKey] || SHOT_LIBRARY.medium;
  const viewportW = options.viewportW || 1280;
  const viewportH = options.viewportH || 720;

  let zoom = preset.targetZoom;
  // Fit bounding box if multiple subjects / wide bounding box
  const fitZoomX = (viewportW * (1 - preset.safeMargin * 2)) / Math.max(120, bounds.width);
  const fitZoomY = (viewportH * (1 - preset.safeMargin * 2 - preset.headroom)) / Math.max(160, bounds.height);
  const maxFitZoom = Math.min(fitZoomX, fitZoomY);
  if (zoom > maxFitZoom && (shotKey === 'two_shot' || shotKey === 'group_shot' || shotKey === 'wide' || shotKey === 'full_body')) {
    zoom = Math.max(preset.minZoom, maxFitZoom);
  }
  zoom = clamp(zoom, preset.minZoom, preset.maxZoom);

  // Shift focus up toward head/upper body for closeup/medium shots so head is never cropped
  const focusY = bounds.cy + bounds.height * preset.focusOffsetY;
  const lookAheadX = Number(options.lookAheadX || 0);
  const clamped = clampCameraToBounds({ x: bounds.cx + lookAheadX, y: focusY, zoom, rotationDeg: 0 }, viewportW, viewportH);

  return {
    ...clamped,
    shotType: shotKey,
    reason: options.reason || `Auto-framed ${preset.label} around subject bounds`
  };
}

// ============================================================================
// 3. AUTOMATIC SHOT SELECTION & CAMERA TRACK COMPILATION
// ============================================================================

export function selectAutomaticShotRule(scene = {}, planScene = {}) {
  const sceneType = String(planScene.sceneType || scene.sceneType || '').toLowerCase();
  const chars = planScene.characters || scene.characters || [];
  const props = planScene.props || scene.props || [];

  if (sceneType.includes('diagram') || planScene.diagram) return { shotType: 'diagram_shot', reason: 'Diagram explanation rule -> diagram_shot' };
  if (sceneType.includes('comparison') || planScene.comparison) return { shotType: 'diagram_shot', reason: 'Visual comparison rule -> diagram_shot' };
  if (sceneType.includes('timeline') || planScene.timeline) return { shotType: 'diagram_shot', reason: 'Historical timeline rule -> diagram_shot' };
  if (sceneType.includes('establish') || sceneType.includes('environment')) return { shotType: 'wide', reason: 'Establishing scene rule -> wide' };
  if (sceneType.includes('object_closeup')) return { shotType: 'object_closeup', reason: 'Object closeup rule -> object_closeup' };
  if (sceneType.includes('reaction')) return { shotType: 'reaction_shot', reason: 'Reaction scene rule -> reaction_shot' };
  if (chars.length >= 3) return { shotType: 'group_shot', reason: '3+ characters -> group_shot' };
  if (chars.length === 2) return { shotType: 'two_shot', reason: '2 characters -> two_shot' };
  if (chars.length === 1) {
    const act = String(chars[0].action || '').toLowerCase();
    if (act.includes('walk') || act.includes('run')) return { shotType: 'follow_shot', reason: 'Moving character -> follow_shot' };
    if (act.includes('eureka') || act.includes('shock') || act.includes('dizzy')) return { shotType: 'reaction_shot', reason: 'Emotional reaction -> reaction_shot' };
    return { shotType: 'medium', reason: 'Single character acting -> medium' };
  }
  if (props.length > 0) return { shotType: 'object_closeup', reason: 'Prop-focused scene -> object_closeup' };
  return { shotType: 'wide', reason: 'Default fallback -> wide' };
}

export function compileSceneCameraTrack(scene = {}, planScene = {}, duration = 4) {
  const explicitCam = planScene.camera || scene.camera || {};
  const explicitShots = Array.isArray(planScene.shots) && planScene.shots.length > 0
    ? planScene.shots
    : (Array.isArray(scene.shots) && scene.shots.length > 0 ? scene.shots : null);

  if (explicitShots) {
    const compiledShots = explicitShots.map((sh, idx) => {
      const startSec = sh.startMs !== undefined ? sh.startMs / 1000 : Number(sh.start ?? 0);
      const endSec = sh.endMs !== undefined ? sh.endMs / 1000 : Number(sh.end ?? duration);
      return {
        id: sh.id || `shot_${idx + 1}`,
        startSec,
        endSec,
        shotType: normalizeShotType(sh.type || sh.shotType || 'medium'),
        targetIds: Array.isArray(sh.targetIds) ? sh.targetIds : (sh.targetId ? [sh.targetId] : []),
        movement: sh.movement || { type: 'static' },
        locked: !!sh.locked,
        reason: sh.reason || 'Declared in Scene Plan shots[]'
      };
    });
    return {
      locked: !!explicitCam.locked,
      shots: compiledShots
    };
  }

  // Fallback single-shot camera from scene.camera or deterministic rule
  const autoRule = explicitCam.shotType
    ? { shotType: normalizeShotType(explicitCam.shotType), reason: 'Declared in Scene Plan camera.shotType' }
    : selectAutomaticShotRule(scene, planScene);

  return {
    locked: !!explicitCam.locked,
    shots: [{
      id: 'shot_1',
      startSec: 0,
      endSec: duration,
      shotType: autoRule.shotType,
      targetIds: explicitCam.targetIds || (explicitCam.targetId ? [explicitCam.targetId] : []),
      movement: typeof explicitCam.movement === 'string'
        ? { type: explicitCam.movement, zoomFrom: explicitCam.zoomFrom, zoomTo: explicitCam.zoomTo }
        : (explicitCam.movement || { type: 'static' }),
      locked: !!explicitCam.locked,
      reason: autoRule.reason
    }]
  };
}

// ============================================================================
// 4. DETERMINISTIC CAMERA FRAME EVALUATOR & CANVAS TRANSFORM
// ============================================================================

export function evaluateCameraFrame(cameraTrack, tSec = 0, context = {}) {
  const shots = cameraTrack?.shots || [{ id: 'shot_1', startSec: 0, endSec: 999, shotType: 'wide', targetIds: [], movement: { type: 'static' } }];
  let activeShot = shots[shots.length - 1];
  for (const sh of shots) {
    if (tSec >= sh.startSec && tSec <= sh.endSec) {
      activeShot = sh;
      break;
    }
  }

  const dur = Math.max(0.05, activeShot.endSec - activeShot.startSec);
  const localT = clamp(tSec - activeShot.startSec, 0, dur);
  const u = clamp(localT / dur, 0, 1);

  // Compute world-space entity positions (with dead-zone smoothing if follow/track)
  const entities = context.entities || {};
  const bounds = computeSubjectBounds(entities, activeShot.targetIds);
  const mov = activeShot.movement || { type: 'static' };
  const movType = String(mov.type || 'static').toLowerCase();

  // Dead-zone quantization for follow shots so tiny bone bob doesn't shake camera
  const isFollow = movType === 'follow_subject' || movType === 'track_object' || activeShot.shotType === 'follow_shot';
  const lookAheadX = isFollow ? Number(mov.lookAheadX ?? 45) : 0;

  const baseCam = computeAutomaticFraming(activeShot.shotType, bounds, {
    lookAheadX,
    reason: activeShot.reason
  });

  let camX = baseCam.x;
  let camY = baseCam.y;
  let zoom = baseCam.zoom;
  let rotationDeg = 0;
  let shakeX = 0;
  let shakeY = 0;

  const e = applyCamEase(u, mov.easing || 'easeInOut');
  const intensity = Number(mov.intensity ?? 1.0);

  if (movType === 'zoom_in' || movType === 'slow_push_in') {
    const z0 = Number(mov.zoomFrom ?? baseCam.zoom);
    const z1 = Number(mov.zoomTo ?? (movType === 'slow_push_in' ? baseCam.zoom * 1.15 : baseCam.zoom * 1.28));
    zoom = lerp(z0, z1, e);
  } else if (movType === 'zoom_out' || movType === 'pull_back') {
    const z0 = Number(mov.zoomFrom ?? Math.max(baseCam.zoom * 1.25, 1.35));
    const z1 = Number(mov.zoomTo ?? 1.0);
    zoom = lerp(z0, z1, e);
  } else if (movType === 'pan_left') {
    camX = baseCam.x + lerp(90 * intensity, -90 * intensity, e);
  } else if (movType === 'pan_right') {
    camX = baseCam.x + lerp(-90 * intensity, 90 * intensity, e);
  } else if (movType === 'pan_up') {
    camY = baseCam.y + lerp(50 * intensity, -50 * intensity, e);
  } else if (movType === 'pan_down') {
    camY = baseCam.y + lerp(-50 * intensity, 50 * intensity, e);
  } else if (movType === 'whip_pan') {
    const whipU = applyCamEase(u, 'easeInOut');
    camX = baseCam.x + lerp(-140 * intensity, 140 * intensity, whipU);
  } else if (movType === 'reveal') {
    zoom = lerp(Math.min(2.2, baseCam.zoom * 1.4), 1.0, e);
  } else if (movType === 'focus_shift' && Array.isArray(mov.toTargetIds)) {
    const b2 = computeSubjectBounds(entities, mov.toTargetIds);
    const cam2 = computeAutomaticFraming(activeShot.shotType, b2);
    camX = lerp(baseCam.x, cam2.x, e);
    camY = lerp(baseCam.y, cam2.y, e);
    zoom = lerp(baseCam.zoom, cam2.zoom, e);
  } else if (movType === 'camera_shake' || movType === 'impact_shake') {
    const decay = movType === 'impact_shake' ? Math.max(0, 1 - u * 1.8) : 1.0;
    const amp = (movType === 'impact_shake' ? 12 : 6) * intensity * decay;
    shakeX = Math.sin(tSec * 48) * amp;
    shakeY = Math.cos(tSec * 57) * amp * 0.7;
  }

  // Clamp final camera to never expose blank canvas outside 1280x720
  const clamped = clampCameraToBounds({ x: camX, y: camY, zoom, rotationDeg }, 1280, 720);

  return {
    ...clamped,
    shakeX,
    shakeY,
    activeShotId: activeShot.id,
    activeShotType: activeShot.shotType,
    movementType: movType,
    reason: activeShot.reason,
    parallaxOffset: [(clamped.x - 640) * 0.15, (clamped.y - 360) * 0.08]
  };
}

export function applyCameraTransform(ctx, camState, viewportW = 1280, viewportH = 720) {
  if (!ctx || !camState) return;
  ctx.translate(viewportW * 0.5 + (camState.shakeX || 0), viewportH * 0.5 + (camState.shakeY || 0));
  if (camState.rotationDeg) ctx.rotate((camState.rotationDeg * Math.PI) / 180);
  ctx.scale(camState.zoom || 1, camState.zoom || 1);
  ctx.translate(-(camState.x ?? viewportW * 0.5), -(camState.y ?? viewportH * 0.5));
}

