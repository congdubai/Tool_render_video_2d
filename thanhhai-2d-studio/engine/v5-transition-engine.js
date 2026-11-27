// engine/v5-transition-engine.js — V5.2 Phase 4D: Scene Transition Engine
// Pure JS (Node + Browser/Playwright Canvas 2D compatible, zero eval).
// Transitions never alter total video duration; they execute strictly within scene boundary windows.

export const TRANSITION_TYPES = [
  'hard_cut', 'cross_dissolve', 'fade_to_black', 'fade_to_white',
  'slide_left', 'slide_right', 'wipe_left', 'wipe_right',
  'circle_reveal', 'mask_reveal', 'zoom_transition', 'match_cut', 'whip_transition'
];

const clampT = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function normalizeTransition(raw) {
  if (!raw) return { type: 'hard_cut', duration: 0, easing: 'easeInOut' };
  if (typeof raw === 'string') {
    const t = raw.toLowerCase().trim();
    return { type: TRANSITION_TYPES.includes(t) ? t : 'hard_cut', duration: t === 'hard_cut' ? 0 : 0.45, easing: 'easeInOut' };
  }
  const type = String(raw.type || 'hard_cut').toLowerCase().trim();
  const duration = type === 'hard_cut' ? 0 : clampT(Number(raw.duration ?? (raw.durationMs ? raw.durationMs / 1000 : 0.45)), 0, 1.5);
  return { type: TRANSITION_TYPES.includes(type) ? type : 'hard_cut', duration, easing: raw.easing || 'easeInOut' };
}

/**
 * Evaluates deterministic transition state at scene local time `t` within `[0..sceneDuration]`.
 * Never modifies total duration.
 */
export function evaluateSceneTransition(transitionIn, transitionOut, t, sceneDuration) {
  const inTr = normalizeTransition(transitionIn);
  const outTr = normalizeTransition(transitionOut);

  let alpha = 1.0;
  let fadeColor = null;
  let fadeAlpha = 0;
  let slideX = 0;
  let wipeProgress = 1.0;
  let circleProgress = 1.0;
  let zoomBoost = 1.0;

  if (inTr.type !== 'hard_cut' && inTr.duration > 0 && t < inTr.duration) {
    const u = clampT(t / inTr.duration, 0, 1);
    if (inTr.type === 'cross_dissolve') alpha = u;
    else if (inTr.type === 'fade_to_black') { fadeColor = '#000000'; fadeAlpha = 1 - u; }
    else if (inTr.type === 'fade_to_white') { fadeColor = '#ffffff'; fadeAlpha = 1 - u; }
    else if (inTr.type === 'slide_left') slideX = (1 - u) * 1920;
    else if (inTr.type === 'slide_right') slideX = -(1 - u) * 1920;
    else if (inTr.type === 'wipe_left' || inTr.type === 'wipe_right' || inTr.type === 'mask_reveal') wipeProgress = u;
    else if (inTr.type === 'circle_reveal') circleProgress = u;
    else if (inTr.type === 'zoom_transition') zoomBoost = 1 + (1 - u) * 0.25;
  }

  if (outTr.type !== 'hard_cut' && outTr.duration > 0 && t > sceneDuration - outTr.duration) {
    const u = clampT((sceneDuration - t) / outTr.duration, 0, 1);
    if (outTr.type === 'fade_to_black') { fadeColor = '#000000'; fadeAlpha = Math.max(fadeAlpha, 1 - u); }
    else if (outTr.type === 'fade_to_white') { fadeColor = '#ffffff'; fadeAlpha = Math.max(fadeAlpha, 1 - u); }
    else if (outTr.type === 'cross_dissolve') alpha = Math.min(alpha, u);
  }

  return { alpha, fadeColor, fadeAlpha, slideX, wipeProgress, circleProgress, zoomBoost };
}

export function applyTransitionPre(ctx, trState, W = 1920, H = 1080) {
  if (!trState) return;
  if (trState.alpha < 1) ctx.globalAlpha *= trState.alpha;
  if (trState.slideX) ctx.translate(trState.slideX, 0);
  if (trState.zoomBoost && trState.zoomBoost !== 1) {
    ctx.translate(W * 0.5, H * 0.5);
    ctx.scale(trState.zoomBoost, trState.zoomBoost);
    ctx.translate(-W * 0.5, -H * 0.5);
  }
  if (trState.wipeProgress < 1) {
    ctx.beginPath();
    ctx.rect(0, 0, W * trState.wipeProgress, H);
    ctx.clip();
  }
  if (trState.circleProgress < 1) {
    ctx.beginPath();
    ctx.arc(W * 0.5, H * 0.5, Math.hypot(W, H) * 0.55 * trState.circleProgress, 0, Math.PI * 2);
    ctx.clip();
  }
}

export function applyTransitionPost(ctx, trState, W = 1920, H = 1080) {
  if (!trState || !trState.fadeColor || trState.fadeAlpha <= 0.005) return;
  ctx.save();
  ctx.globalAlpha = clampT(trState.fadeAlpha, 0, 1);
  ctx.fillStyle = trState.fadeColor;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
