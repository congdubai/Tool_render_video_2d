// engine/v5-visual-storytelling.js — V5.2 Phase 4B: Visual Storytelling Planner, Beats, Composition, Continuity & Parallax
// Pure JS (Node + Browser/Playwright Canvas 2D compatible, zero eval).

import { normalizeShotType } from './v5-camera-engine.js';

export const SCENE_TYPES = [
  'establishing', 'character_acting', 'character_dialogue', 'object_explanation',
  'historical_reenactment', 'scientific_demonstration', 'visual_comparison',
  'timeline_explanation', 'diagram_explanation', 'environment', 'reaction_shot',
  'object_closeup', 'comedy_action', 'symbolic_animation', 'text_graphic',
  'transition_scene', 'conclusion'
];

export const COMPOSITION_TEMPLATES = {
  rule_of_thirds: { leftAnchorX: 0.33, rightAnchorX: 0.67, focusBiasX: 0 },
  center: { leftAnchorX: 0.50, rightAnchorX: 0.50, focusBiasX: 0 },
  symmetrical: { leftAnchorX: 0.30, rightAnchorX: 0.70, focusBiasX: 0 },
  asymmetrical: { leftAnchorX: 0.26, rightAnchorX: 0.66, focusBiasX: 0.08 },
  negative_space: { leftAnchorX: 0.24, rightAnchorX: 0.76, focusBiasX: -0.1 },
  leading_lines: { leftAnchorX: 0.35, rightAnchorX: 0.72, focusBiasX: 0.04 },
  foreground_framing: { leftAnchorX: 0.34, rightAnchorX: 0.66, focusBiasX: 0 },
  subject_isolation: { leftAnchorX: 0.50, rightAnchorX: 0.50, focusBiasX: 0 },
  visual_hierarchy: { leftAnchorX: 0.28, rightAnchorX: 0.68, focusBiasX: 0.05 }
};

export const VISUAL_RHYTHM_PROFILES = {
  hook: { minShotSec: 2.0, preferredMovement: 'slow_push_in', energy: 'high' },
  introduction: { minShotSec: 3.0, preferredMovement: 'pan_right', energy: 'medium' },
  explanation: { minShotSec: 4.0, preferredMovement: 'static', energy: 'calm' },
  problem: { minShotSec: 2.5, preferredMovement: 'camera_shake', energy: 'tense' },
  discovery: { minShotSec: 2.5, preferredMovement: 'zoom_in', energy: 'high' },
  climax: { minShotSec: 2.0, preferredMovement: 'follow_subject', energy: 'peak' },
  conclusion: { minShotSec: 3.5, preferredMovement: 'pull_back', energy: 'calm' }
};

export const PARALLAX_FACTORS = {
  sky: 0.06,
  far_bg: 0.18,
  distant_bg: 0.18,
  near_bg: 0.36,
  midground: 0.55,
  ground: 1.0,
  foreground: 1.12
};

/**
 * Selects appropriate composition template for a scene type and subjects.
 */
export function selectCompositionForScene(planScene = {}) {
  if (planScene.composition && COMPOSITION_TEMPLATES[planScene.composition]) {
    return { id: planScene.composition, ...COMPOSITION_TEMPLATES[planScene.composition] };
  }
  const st = String(planScene.sceneType || '').toLowerCase();
  const chars = planScene.characters || [];
  const props = planScene.props || [];
  if (st.includes('diagram') || st.includes('timeline') || st.includes('text')) {
    return { id: 'center', ...COMPOSITION_TEMPLATES.center };
  }
  if (st.includes('comparison') || chars.length === 2) {
    return { id: 'symmetrical', ...COMPOSITION_TEMPLATES.symmetrical };
  }
  if (chars.length >= 1 && props.length >= 1) {
    return { id: 'asymmetrical', ...COMPOSITION_TEMPLATES.asymmetrical };
  }
  if (st.includes('reaction') || st.includes('closeup')) {
    return { id: 'subject_isolation', ...COMPOSITION_TEMPLATES.subject_isolation };
  }
  return { id: 'rule_of_thirds', ...COMPOSITION_TEMPLATES.rule_of_thirds };
}

/**
 * Expands narration / visualBeats into timed beats and auto-generates shot sequences
 * when Scene Plan does not hardcode shots[].
 */
export function compileVisualStorytellingPlan(scene = {}, planScene = {}, duration = 4) {
  const sceneType = String(planScene.sceneType || scene.sceneType || 'character_acting').toLowerCase();
  const rhythmKey = String(planScene.rhythm || planScene.visualPurpose || 'explanation').toLowerCase();
  const rhythm = VISUAL_RHYTHM_PROFILES[rhythmKey] || VISUAL_RHYTHM_PROFILES.explanation;
  const composition = selectCompositionForScene(planScene);

  // 1. Visual Beats
  const rawBeats = Array.isArray(planScene.visualBeats) ? planScene.visualBeats : [];
  const beats = rawBeats.map((b, idx) => ({
    id: b.id || `beat_${idx + 1}`,
    start: Number(b.start ?? (b.startMs !== undefined ? b.startMs / 1000 : (idx / Math.max(1, rawBeats.length)) * duration)),
    end: Number(b.end ?? (b.endMs !== undefined ? b.endMs / 1000 : ((idx + 1) / Math.max(1, rawBeats.length)) * duration)),
    narrationRef: b.narrationRef || '',
    visualFocus: b.visualFocus || b.targetId || null,
    cameraInstruction: b.cameraInstruction || null,
    graphicOverlay: b.graphicOverlay || null
  }));

  // 2. Auto Shot Sequencing if shots[] not explicitly declared
  let autoShots = null;
  if (!Array.isArray(planScene.shots) || planScene.shots.length === 0) {
    if (beats.length > 1) {
      autoShots = beats.map((b, idx) => ({
        id: `auto_shot_${idx + 1}`,
        start: b.start,
        end: b.end,
        type: normalizeShotType(b.cameraInstruction?.shotType || (b.visualFocus ? 'medium' : 'wide')),
        targetIds: b.visualFocus ? [b.visualFocus] : [],
        movement: b.cameraInstruction?.movement || { type: idx === 0 ? rhythm.preferredMovement : 'static' },
        reason: `Auto-sequenced from visualBeat "${b.id}"`
      }));
    } else if (duration >= 8 && (planScene.characters || []).some(c => (c.actions || []).some(a => a.type === 'fight_cloud'))) {
      // Comedy Fight Cloud cinematography: Two Shot -> Follow Fight Cloud + Impact Shake -> Reaction Shot
      autoShots = [
        { id: 'fight_est', start: 0, end: 3.2, type: 'two_shot', targetIds: [], movement: { type: 'static' }, reason: 'Comedy fight establishing two-shot' },
        { id: 'fight_cloud_cam', start: 3.2, end: 7.0, type: 'follow_shot', targetIds: [], movement: { type: 'impact_shake', intensity: 0.7 }, reason: 'Fight cloud follow + light impact shake' },
        { id: 'fight_react', start: 7.0, end: duration, type: 'two_shot', targetIds: [], movement: { type: 'static' }, reason: 'Post-fight reaction two-shot' }
      ];
    }
  }

  return {
    sceneType: SCENE_TYPES.includes(sceneType) ? sceneType : 'character_acting',
    rhythm: rhythmKey,
    composition,
    beats,
    autoShots,
    continuityRules: {
      preserveCharacterIdentity: true,
      preservePropOwnership: true,
      preserveScreenDirection: true
    }
  };
}

/**
 * Computes parallax shift for a background layer key given camera state.
 * Only shifts real multi-layer backgrounds; never separates character rig parts.
 */
export function computeLayerParallaxShift(layerName = '', camState = {}) {
  const key = String(layerName || '').toLowerCase();
  let factor = 0;
  for (const [k, f] of Object.entries(PARALLAX_FACTORS)) {
    if (key.includes(k)) { factor = f; break; }
  }
  const dx = ((camState.x ?? 640) - 640) * (factor - 1.0) * 0.18;
  const dy = ((camState.y ?? 360) - 360) * (factor - 1.0) * 0.08;
  // Clamp shift tightly to prevent gaps between adjacent layers
  return [clampVal(dx, -28, 28), clampVal(dy, -14, 14)];
}

function clampVal(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
