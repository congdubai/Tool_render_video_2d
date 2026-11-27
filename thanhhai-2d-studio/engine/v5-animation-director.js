// engine/v5-animation-director.js — Automatic Animation Director (V5 Phase 4/5)
// Transforms Scene Plan actions and intent into dynamic multi-track animation data:
// Transforms, Skeletal Poses, Locomotion Cycles, Facial Expressions, Procedural Idles,
// Prop Interactions, Cartoon Physics, VFX Spawns, and Camera Directing.

import {
  MOTION_PRIMITIVES,
  SEMANTIC_BONE_ROLES,
  resolveSemanticBone,
  solveFK,
  solve2BoneIK,
  EASINGS,
  evaluateCustomKeyframeTrack
} from './v5-universal-motion-engine.js';
import {
  SEMANTIC_BONES_20,
  SEMANTIC_TO_RIG15,
  getRigCapabilities,
  compileCharacterActingTracks,
  evaluateActingFrame,
  evaluateMotionPrimitive
} from './v5-character-acting-engine.js';

export const POSE_PRESETS = {
  stand: { label: 'Đứng nghiêm', torsoAngle: 0, leftArmAngle: 15, rightArmAngle: -15, leftLegAngle: 0, rightLegAngle: 0 },
  walk: { label: 'Bước đi', torsoAngle: 5, leftArmAngle: 30, rightArmAngle: -30, leftLegAngle: -25, rightLegAngle: 25 },
  run: { label: 'Chạy nhanh', torsoAngle: 15, leftArmAngle: 60, rightArmAngle: -60, leftLegAngle: -50, rightLegAngle: 50 },
  sit: { label: 'Ngồi', torsoAngle: 0, leftArmAngle: 20, rightArmAngle: -20, leftLegAngle: 90, rightLegAngle: 90 },
  thinking: { label: 'Suy nghĩ', torsoAngle: -5, leftArmAngle: 10, rightArmAngle: -85, leftLegAngle: 0, rightLegAngle: 0, headTilt: -10 },
  pointing: { label: 'Chỉ tay', torsoAngle: 0, leftArmAngle: 10, rightArmAngle: -90, leftLegAngle: 0, rightLegAngle: 0 },
  reading: { label: 'Đọc sách', torsoAngle: 10, leftArmAngle: -45, rightArmAngle: -45, leftLegAngle: 0, rightLegAngle: 0, headTilt: 15 },
  holding_object: { label: 'Cầm đồ vật', torsoAngle: 0, leftArmAngle: -30, rightArmAngle: -30, leftLegAngle: 0, rightLegAngle: 0 },
  surprised: { label: 'Bất ngờ giật mình', torsoAngle: -12, leftArmAngle: 75, rightArmAngle: -75, leftLegAngle: -10, rightLegAngle: 10, headTilt: -5 },
  angry: { label: 'Tức giận', torsoAngle: 8, leftArmAngle: 45, rightArmAngle: -45, leftLegAngle: 0, rightLegAngle: 0 },
  scared: { label: 'Hoảng sợ', torsoAngle: -15, leftArmAngle: 80, rightArmAngle: -80, leftLegAngle: 15, rightLegAngle: -15 },
  crouching: { label: 'Cúi thấp', torsoAngle: 35, leftArmAngle: 20, rightArmAngle: -20, leftLegAngle: 45, rightLegAngle: 45 },
  falling: { label: 'Rơi ngã', torsoAngle: 60, leftArmAngle: 110, rightArmAngle: -110, leftLegAngle: 30, rightLegAngle: -30 },
  celebrating: { label: 'Ăn mừng chiến thắng', torsoAngle: -5, leftArmAngle: -120, rightArmAngle: -120, leftLegAngle: 0, rightLegAngle: 0 },
  dizzy: { label: 'Choáng váng', torsoAngle: 10, leftArmAngle: 30, rightArmAngle: -30, leftLegAngle: 5, rightLegAngle: -5, headTilt: 25 }
};

export const EMOTIONS = {
  NEUTRAL: 'neutral',
  HAPPY: 'happy',
  SAD: 'sad',
  ANGRY: 'angry',
  SURPRISED: 'surprised',
  SCARED: 'scared',
  CONFUSED: 'confused',
  THINKING: 'thinking',
  EXCITED: 'excited',
  TIRED: 'tired',
  DIZZY: 'dizzy'
};

/**
 * Procedural Idle Generator (breathing, eye blink, gentle sway)
 */
export function generateProceduralIdleTrack(durationSec = 5, seed = 123) {
  const fps = 30;
  const totalFrames = Math.ceil(durationSec * fps);
  const keyframes = [];

  for (let f = 0; f <= totalFrames; f += 5) {
    const t = f / fps;
    // Breathing cycle ~ 2.5s
    const breathOffset = Math.sin((t / 2.5) * Math.PI * 2) * 0.02;
    // Subtle sway ~ 4s
    const swayAngle = Math.sin((t / 4.0) * Math.PI * 2 + seed) * 1.5;
    // Periodic blink every 3s
    const blinkCycle = t % 3.2;
    const isBlinking = blinkCycle > 3.0 && blinkCycle < 3.15;

    keyframes.push({
      time: t,
      timeMs: Math.round(t * 1000),
      scaleY: 1.0 + breathOffset,
      rotation: swayAngle,
      isBlinking
    });
  }

  return {
    type: 'procedural_idle',
    keyframes
  };
}

/**
 * Locomotion Cycle Generator (walk or run)
 */
export function generateLocomotionTrack(actionType = 'walk', startPos = [0, 0], endPos = [0, 0], startTime = 0, endTime = 3) {
  const isRun = actionType === 'run';
  const cycleDuration = isRun ? 0.45 : 0.8; // seconds per cycle
  const duration = Math.max(0.1, endTime - startTime);
  const cycleCount = duration / cycleDuration;
  const fps = 30;
  const totalSteps = Math.ceil(duration * fps);
  const keyframes = [];

  for (let i = 0; i <= totalSteps; i++) {
    const tNorm = i / totalSteps;
    const t = startTime + tNorm * duration;
    const phase = (tNorm * cycleCount) * Math.PI * 2;

    const posX = startPos[0] + (endPos[0] - startPos[0]) * tNorm;
    const posY = startPos[1] + (endPos[1] - startPos[1]) * tNorm + Math.abs(Math.sin(phase)) * (isRun ? -15 : -8);

    const legSpread = isRun ? 45 : 25;
    const armSpread = isRun ? 55 : 30;

    keyframes.push({
      time: t,
      timeMs: Math.round(t * 1000),
      position: [posX, posY],
      leftLegAngle: Math.sin(phase) * legSpread,
      rightLegAngle: -Math.sin(phase) * legSpread,
      leftArmAngle: -Math.sin(phase) * armSpread,
      rightArmAngle: Math.sin(phase) * armSpread,
      torsoTilt: isRun ? 12 : 5
    });
  }

  return {
    type: 'locomotion',
    actionType,
    keyframes
  };
}

/**
 * Validates scene animation tracks, bone names, rig capabilities, and floor penetration.
 */
export function validateSceneAnimation(scene = {}, characterTracks = {}, renderMode = 'procedural_rig') {
  const issues = [];
  const caps = getRigCapabilities(renderMode);
  const groundY = Number(scene.groundY || 620);

  for (const [charId, tr] of Object.entries(characterTracks)) {
    const acting = tr.actingTrack;
    if (!acting) continue;
    if (acting.baseY > groundY + 4) {
      issues.push({ level: 'WARNING', code: 'FLOOR_PENETRATION', characterId: charId, message: `Character ${charId} baseY (${acting.baseY}) exceeds groundY (${groundY}).` });
    }
    for (const act of (acting.actions || [])) {
      const probe = evaluateMotionPrimitive(act, 0.1, 0.2);
      if (!probe.supported) {
        issues.push({ level: 'WARNING', code: 'UNSUPPORTED_ACTION', characterId: charId, message: probe.warning || `Unsupported action "${act.type}"` });
      }
      if (!caps.skeletalAnimation && ['walk', 'run', 'wave', 'jump', 'fight_cloud'].includes(act.type)) {
        issues.push({ level: 'INFO', code: 'SINGLE_PNG_FALLBACK', characterId: charId, message: `Mode ${renderMode} uses root/squash-stretch only for "${act.type}" (no fake limb deformation).` });
      }
      if (Array.isArray(act.keyframes)) {
        for (const kf of act.keyframes) {
          for (const bName of Object.keys(kf.bones || kf.angles || {})) {
            if (!SEMANTIC_BONES_20.includes(bName) && !Object.values(SEMANTIC_TO_RIG15).includes(bName) && bName !== 'hipY') {
              issues.push({ level: 'ERROR', code: 'UNKNOWN_BONE', characterId: charId, message: `Unknown bone "${bName}" in custom animation keyframes.` });
            }
          }
        }
      }
    }
  }
  return issues;
}

/**
 * Compiles dynamic animation tracks for a single scene with V5.2 Phase 3 acting tracks,
 * cross-scene continuity, custom animation JSON, and validation.
 */
export function compileSceneAnimations(scene = {}, scenePlanItem = {}, defaultDuration = 4, prevContinuity = null) {
  const duration = Number(scene.duration || scenePlanItem.duration || defaultDuration);
  const characters = Array.isArray(scene.characters) ? scene.characters : (scenePlanItem.characters || []);
  const props = Array.isArray(scene.props) ? scene.props : (scenePlanItem.props || []);
  const cameraPlan = scenePlanItem.camera || scene.camera || {};
  const vfxPlan = scenePlanItem.vfx || scene.vfx || [];

  const characterTracks = {};
  const propTracks = {};
  const vfxTracks = [];
  const cameraTracks = [];

  // 1. Process character animation + Acting Tracks + Continuity
  characters.forEach((char, idx) => {
    const charId = char.characterId || char.id || `char_${idx + 1}`;
    const prevCharState = prevContinuity?.characters?.[charId] || null;
    const action = (char.action || scenePlanItem.action || prevCharState?.pose || 'stand').toLowerCase();
    const emotion = (char.emotion || scenePlanItem.emotion || prevCharState?.expression || EMOTIONS.NEUTRAL).toLowerCase();
    const startPos = char.position || (prevCharState ? [prevCharState.x / 1280, prevCharState.y / 720] : [0.2 + idx * 0.25, 0.78]);
    const endPos = char.targetPosition || startPos;
    const view = char.view || prevCharState?.view || 'three_quarter_right';

    const actingTrack = compileCharacterActingTracks({
      ...char,
      characterId: charId,
      position: startPos,
      targetX: Array.isArray(endPos) ? endPos[0] : undefined,
      view,
      action,
      emotion,
      secondaryEmotion: char.secondaryEmotion || scenePlanItem.secondaryEmotion || null,
      actions: Array.isArray(char.actions) ? char.actions : undefined
    }, duration, 101 + idx * 31);

    const endFrame = evaluateActingFrame(actingTrack, duration);

    const poseKeyframes = [];
    const basePose = POSE_PRESETS[action] || POSE_PRESETS.stand;

    poseKeyframes.push({
      time: 0,
      timeMs: 0,
      pose: action,
      ...basePose
    });

    let locomotion = null;
    if (action.includes('walk') || action.includes('run') || action.includes('approach')) {
      locomotion = generateLocomotionTrack(
        action.includes('run') ? 'run' : 'walk',
        startPos,
        endPos,
        0,
        Math.min(duration, 3.5)
      );
    }

    const emotionKeyframes = [{ time: 0, emotion, intensity: 1.0 }];
    if (scenePlanItem.secondaryEmotion || char.secondaryEmotion) {
      emotionKeyframes.push({
        time: duration * 0.5,
        emotion: char.secondaryEmotion || scenePlanItem.secondaryEmotion,
        intensity: 1.0
      });
    }

    const idleTrack = generateProceduralIdleTrack(duration, idx * 37);

    characterTracks[charId] = {
      characterId: charId,
      basePose: action,
      poseKeyframes,
      locomotion,
      emotionKeyframes,
      idleTrack,
      actingTrack,
      endState: {
        x: endFrame.x,
        y: endFrame.y,
        view: endFrame.view,
        expression: endFrame.expression,
        pose: action
      },
      isTalking: !!(scenePlanItem.narration || scene.narration || (char.actions || []).some(a => a.type === 'talk'))
    };
  });

  // 2. Process Prop interactions
  props.forEach((prop, idx) => {
    const propId = prop.id || prop.assetId || `prop_${idx + 1}`;
    const prevProp = prevContinuity?.props?.[propId] || null;
    const attachedTo = prop.attachedTo || prop.characterId || prevProp?.attachedTo || null;
    const isHeld = !!attachedTo;

    propTracks[propId] = {
      propId,
      attachedTo,
      isHeld,
      zeroJumpPreserved: true,
      keyframes: [
        { time: 0, position: prop.position || prevProp?.position || [0.5, 0.5], scale: prop.scale || 1.0, rotation: 0 }
      ]
    };

    if (prop.action === 'drop' || prop.action === 'fall') {
      propTracks[propId].keyframes.push(
        { time: 1.0, position: prop.position || [0.5, 0.5], easing: 'easeIn' },
        { time: 1.8, position: [(prop.position?.[0] || 0.5), 0.72], easing: 'bounce' }
      );
    }
  });

  // 3. Process VFX Tracks
  if (Array.isArray(vfxPlan)) {
    vfxPlan.forEach(v => {
      vfxTracks.push({
        type: v.type || 'cartoon_dust',
        targetId: v.targetId || null,
        startTime: v.startTime || v.start || 0,
        endTime: Math.min(duration, (v.end || ((v.startTime || 0) + (v.duration || 1.5)))),
        position: v.position || [0.5, 0.5]
      });
    });
  }

  // 4. Process Camera Director Track
  const shotType = cameraPlan.shotType || scene.camera?.shotType || 'medium';
  const movement = cameraPlan.movement || scene.camera?.movement || 'static';

  cameraTracks.push({
    time: 0,
    shotType,
    zoom: cameraPlan.zoom || 1.0,
    pan: cameraPlan.pan || [0, 0]
  });

  if (movement === 'zoom_in') {
    cameraTracks.push({
      time: duration,
      shotType,
      zoom: (cameraPlan.zoom || 1.0) * 1.25,
      pan: cameraPlan.pan || [0, 0],
      easing: 'easeInOut'
    });
  } else if (movement === 'pan_right') {
    cameraTracks.push({
      time: duration,
      shotType,
      zoom: cameraPlan.zoom || 1.0,
      pan: [0.15, 0],
      easing: 'easeInOut'
    });
  }

  const validationIssues = validateSceneAnimation(scene, characterTracks, scene.renderMode || 'procedural_rig');

  const continuityOut = {
    characters: Object.fromEntries(Object.entries(characterTracks).map(([cid, t]) => [cid, t.endState])),
    props: Object.fromEntries(Object.entries(propTracks).map(([pid, p]) => [pid, { attachedTo: p.attachedTo, position: p.keyframes[p.keyframes.length - 1]?.position }]))
  };

  return {
    sceneId: scene.id || scenePlanItem.id || 'scene_001',
    duration,
    characterTracks,
    propTracks,
    vfxTracks,
    cameraTracks,
    validationIssues,
    continuityOut,
    compiledAt: new Date().toISOString()
  };
}

/**
 * Compiles dynamic animation tracks for all scenes in a project with cross-scene continuity
 * and incremental rebuild support for locked scenes.
 */
export function compileProjectAnimations(compiledScenes = [], scenePlan = {}, options = {}) {
  const planItems = scenePlan.scenes || [];
  const lockedSceneIds = new Set(options.lockedSceneIds || []);
  const previousTracks = options.previousTracks || {};
  const results = {};
  const allIssues = [];
  let continuity = null;

  compiledScenes.forEach((scene, idx) => {
    const planItem = planItems.find(p => p.id === scene.id) || planItems[idx] || {};
    if (lockedSceneIds.has(scene.id) && previousTracks[scene.id]) {
      results[scene.id] = previousTracks[scene.id];
      continuity = results[scene.id].continuityOut || continuity;
    } else {
      const compiled = compileSceneAnimations(scene, planItem, scene.duration || 4, continuity);
      results[scene.id] = compiled;
      continuity = compiled.continuityOut;
    }
    for (const iss of (results[scene.id].validationIssues || [])) {
      allIssues.push({ sceneId: scene.id, ...iss });
    }
  });

  return {
    success: true,
    compiledCount: Object.keys(results).length,
    validationIssues: allIssues,
    scenes: results
  };
}

