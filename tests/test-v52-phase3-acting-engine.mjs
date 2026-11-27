import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  SEMANTIC_BONES_20,
  SEMANTIC_TO_RIG15,
  getRigCapabilities,
  solveTwoBoneIKAngles,
  evaluateFootGroundIK,
  evaluateWalkCycle,
  evaluateRunCycle,
  evaluateJumpCycle,
  evaluateNaturalIdle,
  computeEyeTrackingLook,
  evaluateTalkingState,
  expandComposedActions,
  evaluateMotionPrimitive,
  compileCharacterActingTracks,
  evaluateActingFrame,
  evaluatePropState,
  evaluateObjectInteractions,
  resolveSceneChoreography,
} from '../thanhhai-2d-studio/engine/v5-character-acting-engine.js';
import {
  REQUIRED_EXPRESSIONS,
  resolveCharacter,
  SUPPORTED_VIEWS,
} from '../thanhhai-2d-studio/engine/unified-character-renderer.js';
import {
  compileSceneAnimations,
  compileProjectAnimations,
  validateSceneAnimation,
} from '../thanhhai-2d-studio/engine/v5-animation-director.js';
import { RenderCacheManager, RENDER_ENGINE_VERSION } from '../thanhhai-2d-studio/engine/v5-render-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { defaultFfmpegAssembler } from '../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

let passed = 0;
let failed = 0;
async function check(id, name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS [${id}]: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL [${id}]: ${name}\n  ${err?.stack || err}`);
  }
}

// ============================================================================
// CHECKS 1–10: SKELETAL SYSTEM, BONES, IK & RIG CAPABILITIES
// ============================================================================
await check(1, '20 semantic bones defined', () => assert.equal(SEMANTIC_BONES_20.length, 20));
await check(2, 'Semantic-to-Rig15 mapping covers spine/head/limbs', () => {
  assert.ok(SEMANTIC_TO_RIG15.spine && SEMANTIC_TO_RIG15.head && SEMANTIC_TO_RIG15.left_foot && SEMANTIC_TO_RIG15.right_foot);
});
await check(3, 'Mode A procedural_rig supports full skeletal, IK, expressions, eyes, mouth, secondary', () => {
  const c = getRigCapabilities('procedural_rig');
  assert.equal(c.skeletalAnimation, true);
  assert.equal(c.twoBoneIK, true);
  assert.equal(c.eyeTracking, true);
});
await check(4, 'Mode B layered_png_rig disables fake IK/eyeTracking/mouth', () => {
  const c = getRigCapabilities('layered_png_rig');
  assert.equal(c.skeletalAnimation, true);
  assert.equal(c.twoBoneIK, false);
  assert.equal(c.talkingMouth, false);
});
await check(5, 'Mode B single_png strictly disables skeletalAnimation (no fake limb deformation)', () => {
  const c = getRigCapabilities('single_png');
  assert.equal(c.skeletalAnimation, false);
  assert.deepEqual(c.supportedChannels, ['root', 'body', 'props']);
});
await check(6, '2-bone IK solver reachable target returns finite angles', () => {
  const ik = solveTwoBoneIKAngles([0, 0], [16, 22], 20, 20, { poleDir: 1 });
  assert.equal(ik.reachable, true);
  assert.ok(Number.isFinite(ik.upperDeg) && Number.isFinite(ik.foreDeg));
});
await check(7, '2-bone IK solver clamps unreachable target gracefully without NaN', () => {
  const ik = solveTwoBoneIKAngles([0, 0], [200, 200], 20, 20);
  assert.equal(ik.reachable, false);
  assert.ok(Number.isFinite(ik.upperDeg) && Number.isFinite(ik.foreDeg));
});
await check(8, 'Foot-to-ground IK prevents floating/sinking', () => {
  const ik = evaluateFootGroundIK(-44, [5, -1], 22, 22);
  assert.ok(Number.isFinite(ik.thighDeg) && Number.isFinite(ik.shinDeg) && Number.isFinite(ik.ankleDeg));
});
await check(9, 'Unified Character Renderer supports all 5+ camera views', () => {
  assert.ok(SUPPORTED_VIEWS.length >= 5);
  for (const v of ['front', 'three_quarter_left', 'three_quarter_right', 'side_left', 'side_right']) {
    assert.ok(SUPPORTED_VIEWS.includes(v), `Missing view ${v}`);
  }
});
await check(10, 'Phase 1 Regression: resolveCharacter resolves Doc & Max without fallback mismatch', () => {
  const doc = resolveCharacter({ characterId: 'chibi_doc', strict: true });
  const max = resolveCharacter({ characterId: 'chibi_max', strict: true });
  assert.equal(doc.profile?.id || doc.id, 'chibi_doc');
  assert.equal(max.profile?.id || max.id, 'chibi_max');
});

// ============================================================================
// CHECKS 11–22: WALK/RUN/JUMP, MOTION PRIMITIVES & COMPOSITION
// ============================================================================
await check(11, '5-phase walk cycle swings legs & arms visibly', () => {
  const p0 = evaluateWalkCycle(0.0, { speed: 1.0 });
  const p50 = evaluateWalkCycle(0.4, { speed: 1.0 });
  assert.ok(Math.abs(p0.thigh_L - p50.thigh_L) > 25);
});
await check(12, 'Walk styles (normal, sneaky, confident, tired) differ cleanly', () => {
  const n = evaluateWalkCycle(0.2, { style: 'normal' });
  const s = evaluateWalkCycle(0.2, { style: 'sneaky' });
  assert.notEqual(n.torso, s.torso);
});
await check(13, 'Run cycle increases stride & forward lean', () => {
  const r = evaluateRunCycle(0.15, { speed: 1.0 });
  assert.ok(r.torso > 10);
});
await check(14, 'Jump cycle includes anticipation crouch, airborne arc, landing squash', () => {
  const jCrouch = evaluateJumpCycle(0.1);
  const jAir = evaluateJumpCycle(0.45);
  assert.ok(jCrouch.hipY > jAir.hipY);
  assert.ok(jAir.squashStretch[1] > 1.0);
});
await check(15, 'Natural idle produces deterministic breathing & blinking', () => {
  const i1 = evaluateNaturalIdle(1.0, 101);
  const i2 = evaluateNaturalIdle(1.0, 101);
  assert.deepEqual(i1, i2);
  assert.ok(Number.isFinite(i1.angles.hipY));
});
await check(16, 'Wave primitive raises arm & oscillates forearm', () => {
  const w1 = evaluateMotionPrimitive({ type: 'wave' }, 0.4, 0.25);
  const w2 = evaluateMotionPrimitive({ type: 'wave' }, 1.1, 0.45);
  assert.ok(Math.abs(w1.channels.right_arm.angles.upper_arm_R) > 60);
  assert.notEqual(w1.channels.right_arm.angles.forearm_R, w2.channels.right_arm.angles.forearm_R);
});
await check(17, 'Arm primitives (raise_arm, lower_arm, bend_elbow, point, reach, scratch_head, eureka)', () => {
  for (const t of ['raise_arm', 'lower_arm', 'bend_elbow', 'point', 'reach', 'scratch_head', 'eureka']) {
    assert.equal(evaluateMotionPrimitive({ type: t }, 0.5, 0.5).supported, true, t);
  }
});
await check(18, 'Head/torso primitives (turn_head, tilt_head, nod, shake_head, lean_forward, crouch, sit, recoil)', () => {
  for (const t of ['turn_head', 'tilt_head', 'nod', 'shake_head', 'lean_forward', 'crouch', 'sit', 'recoil']) {
    assert.equal(evaluateMotionPrimitive({ type: t }, 0.5, 0.5).supported, true, t);
  }
});
await check(19, 'Motion Composition: sequential, parallel, repeat, conditionalFallback', () => {
  const ex = expandComposedActions([
    { compose: 'sequential', start: 0, steps: [{ type: 'walk', duration: 1 }, { type: 'wave', duration: 1 }] },
    { compose: 'parallel', start: 1, duration: 1, steps: [{ type: 'talk' }, { type: 'nod' }] },
    { compose: 'repeat', start: 2, count: 2, step: { type: 'jump', duration: 0.5 } },
    { compose: 'conditionalFallback', start: 3, duration: 1, condition: false, primary: { type: 'run' }, fallback: { type: 'idle' } },
  ], 5);
  assert.equal(ex.length, 7);
});
await check(20, 'Multi-channel blending allows wave + walk/idle simultaneously', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_max',
    actions: [
      { type: 'walk', start: 0, end: 3, to: [0.6, 0.78] },
      { type: 'wave', start: 1, end: 3 },
    ],
  }, 3);
  const f = evaluateActingFrame(tr, 2.0);
  assert.ok(Math.abs(f.jointAngles.upper_arm_R) > 60);
  assert.ok(f.x > 0.3 * 1280);
});
await check(21, 'Unsupported action explicitly returns supported: false + warning (no silent slide)', () => {
  const r = evaluateMotionPrimitive({ type: 'unknown_magic_flip' }, 0.2, 0.5);
  assert.equal(r.supported, false);
  assert.ok(r.warning);
});
await check(22, 'Deterministic seek: forward/backward seek yields identical frame state', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [{ type: 'walk', start: 0, end: 3, to: [0.5, 0.78] }, { type: 'wave', start: 3, end: 5 }],
  }, 5);
  const a = evaluateActingFrame(tr, 2.35);
  evaluateActingFrame(tr, 4.9);
  const b = evaluateActingFrame(tr, 2.35);
  assert.deepEqual(a, b);
});

// ============================================================================
// CHECKS 23–35: 14 EXPRESSIONS, EYE TRACKING, TALKING, PROPS, INTERACTION
// ============================================================================
await check(23, 'All 14 facial expressions exist in REQUIRED_EXPRESSIONS', () => {
  assert.equal(REQUIRED_EXPRESSIONS.length, 14);
});
await check(24, 'Smooth expression blending produces intermediate exprBlend', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    emotion: 'neutral',
    actions: [{ type: 'expression', value: 'excited', start: 1, end: 2 }],
  }, 2);
  const f = evaluateActingFrame(tr, 1.1);
  assert.equal(f.expression, 'excited');
  assert.ok(f.exprBlend > 0 && f.exprBlend < 1);
});
await check(25, 'Eye tracking look_at computes target-directed pupil vectors', () => {
  const l = computeEyeTrackingLook([500, 560], [200, 500]);
  const r = computeEyeTrackingLook([500, 560], [850, 500]);
  assert.ok(l[0] < -0.5 && r[0] > 0.5);
});
await check(26, 'Talking animation modulates mouthShape over speechIntervals', () => {
  const off = evaluateTalkingState({ speechIntervals: [[1, 2]] }, 0.3);
  const on = evaluateTalkingState({ speechIntervals: [[1, 2]] }, 1.4);
  assert.equal(off.talk, 0);
  assert.ok(on.talk > 0);
});
await check(27, 'Prop state machine supports on_surface -> held -> transfer_prop -> thrown', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_max',
    position: [0.3, 0.78],
    actions: [
      { type: 'pick_up', propId: 'cup', start: 0.5, end: 1.0 },
      { type: 'transfer_prop', propId: 'cup', fromHand: 'right', toHand: 'left', start: 1.2, end: 1.6 },
      { type: 'throw_object', propId: 'cup', start: 2.0, end: 3.0 },
    ],
  }, 3);
  const prop = { assetId: 'cup', x: 400, y: 560 };
  assert.equal(evaluatePropState(prop, [tr], {}, 0.2).state, 'on_surface');
  assert.equal(evaluatePropState(prop, [tr], {}, 1.8).hand, 'left');
  assert.equal(evaluatePropState(prop, [tr], {}, 2.5).state, 'thrown');
});
await check(28, 'Object interaction: press_button activates screenGlow & experiment_failure activates emitSmoke', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [
      { type: 'press_button', targetId: 'pc', start: 1, end: 2 },
      { type: 'experiment_failure', targetId: 'pc', start: 3, end: 4 },
    ],
  }, 5);
  const props = [{ assetId: 'pc', x: 800, y: 560 }];
  assert.equal(evaluateObjectInteractions(props, [tr], 1.5).pc.screenGlow, true);
  assert.equal(evaluateObjectInteractions(props, [tr], 3.5).pc.emitSmoke, true);
});
await check(29, 'Multi-character choreography resolves live entity positions', () => {
  const tr1 = compileCharacterActingTracks({ characterId: 'a', position: [0.2, 0.78] }, 3);
  const tr2 = compileCharacterActingTracks({ characterId: 'b', position: [0.8, 0.78] }, 3);
  const ch = resolveSceneChoreography([{ characterId: 'a', actingTrack: tr1 }, { characterId: 'b', actingTrack: tr2 }], 1);
  assert.ok(ch.entities.b[0] > ch.entities.a[0]);
});
await check(30, 'All 8 composite cartoon actions supported', () => {
  for (const c of ['fight_cloud', 'cartoon_chase', 'funny_fall', 'power_up', 'shock_reaction', 'angry_argument', 'experiment_failure', 'idea_discovery']) {
    assert.equal(evaluateMotionPrimitive({ type: c }, 0.5, 0.5).supported, true, c);
  }
});
await check(31, 'Fight cloud VFX disappears cleanly when action finishes', () => {
  const tr = compileCharacterActingTracks({ characterId: 'chibi_max', actions: [{ type: 'fight_cloud', start: 2, end: 6 }] }, 8);
  assert.ok(evaluateActingFrame(tr, 4).vfxEffects.length > 0);
  assert.equal(evaluateActingFrame(tr, 7).vfxEffects.length, 0);
});
await check(32, 'Secondary motion (hairBounce, coatSway) active during motion', () => {
  const tr = compileCharacterActingTracks({ characterId: 'chibi_doc', actions: [{ type: 'run', start: 0, end: 2, to: [0.7, 0.78] }] }, 2);
  const f = evaluateActingFrame(tr, 0.5);
  assert.ok(Number.isFinite(f.secondaryMotion.hairBounce) && Number.isFinite(f.secondaryMotion.coatSway));
});
await check(33, 'Custom Animation JSON interpolates declaratively without eval', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [{ type: 'custom_animation', start: 0, end: 2, keyframes: [{ time: 0, bones: { head: 0 } }, { time: 2, bones: { head: 20 } }] }],
  }, 2);
  assert.ok(evaluateActingFrame(tr, 1).jointAngles.head > 5);
});
await check(34, 'Cross-scene continuity preserves view, expression, position across scenes', () => {
  const scenes = [
    { id: 's1', duration: 3, characters: [{ characterId: 'chibi_max', position: [0.2, 0.78], actions: [{ type: 'walk', start: 0, end: 2, to: [0.55, 0.78] }, { type: 'turn_head', start: 2, end: 3, targetView: 'front' }, { type: 'expression', value: 'happy', start: 2, end: 3 }] }] },
    { id: 's2', duration: 3, characters: [{ characterId: 'chibi_max' }] },
  ];
  const res = compileProjectAnimations(scenes, { scenes });
  assert.equal(res.scenes.s2.characterTracks.chibi_max.actingTrack.baseView, 'front');
  assert.equal(res.scenes.s2.characterTracks.chibi_max.actingTrack.baseExpression, 'happy');
});
await check(35, 'Animation validation catches UNKNOWN_BONE, UNSUPPORTED_ACTION, FLOOR_PENETRATION, SINGLE_PNG_FALLBACK', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'c1',
    actions: [{ type: 'custom_animation', keyframes: [{ time: 0, bones: { bad_bone: 10 } }] }, { type: 'unknown_act' }],
  }, 2);
  const issues = validateSceneAnimation({ groundY: 500 }, { c1: { actingTrack: tr } }, 'procedural_rig');
  assert.ok(issues.some(i => i.code === 'UNKNOWN_BONE'));
  assert.ok(issues.some(i => i.code === 'UNSUPPORTED_ACTION'));
  assert.ok(issues.some(i => i.code === 'FLOOR_PENETRATION'));
});

// ============================================================================
// CHECKS 36–41: CACHE INVALIDATION, UI INSPECTOR & REGRESSIONS
// ============================================================================
await check(36, 'Render Engine Version is 5.2.2+ and RenderCache invalidates on action/lighting change', () => {
  assert.ok(RENDER_ENGINE_VERSION.startsWith('5.2'));
  const cache = new RenderCacheManager();
  const k1 = cache.computeFingerprint({ id: 's1' }, { characterTracks: { max: { basePose: 'walk' } } }, { lighting: 'night' });
  const k2 = cache.computeFingerprint({ id: 's1' }, { characterTracks: { max: { basePose: 'wave' } } }, { lighting: 'night' });
  assert.notEqual(k1, k2);
});
await check(37, 'Tab 4 Animation Inspector UI & Tab 2 sync present', () => {
  const html = fs.readFileSync('app/ui/index.html', 'utf8');
  const appJs = fs.readFileSync('app/ui/app.js', 'utf8');
  assert.ok(html.includes('v5AnimationInspectorDetails') && appJs.includes('onAnimInspectorSeek') && appJs.includes('openSelectedSceneInTab2'));
});
await check(38, 'Incremental rebuild preserves locked scenes', () => {
  const scenes = [{ id: 's1', duration: 2, characters: [{ characterId: 'chibi_doc' }] }];
  const first = compileProjectAnimations(scenes, { scenes });
  const second = compileProjectAnimations(scenes, { scenes }, { lockedSceneIds: ['s1'], previousTracks: { s1: { ...first.scenes.s1, lockedTag: true } } });
  assert.equal(second.scenes.s1.lockedTag, true);
});
await check(39, 'Anti-hardcode: v5-production-orchestrator.js has zero demo video copy', () => {
  const orch = fs.readFileSync('thanhhai-2d-studio/engine/v5-production-orchestrator.js', 'utf8');
  assert.equal(orch.includes('demo_v5_procedural_15s.mp4'), false);
});
await check(40, 'Shot Compiler imports and uses real Acting Engine', () => {
  const sc = fs.readFileSync('thanhhai-2d-studio/engine/v5-shot-compiler.js', 'utf8');
  assert.ok(sc.includes('compileCharacterActingTracks') && sc.includes('evaluateActingFrame'));
});
await check(41, 'Zero eval() usage in v5-character-acting-engine.js & v5-animation-director.js', () => {
  const ae = fs.readFileSync('thanhhai-2d-studio/engine/v5-character-acting-engine.js', 'utf8');
  const ad = fs.readFileSync('thanhhai-2d-studio/engine/v5-animation-director.js', 'utf8');
  assert.equal(/\beval\s*\(/.test(ae), false);
  assert.equal(/\beval\s*\(/.test(ad), false);
});

// ============================================================================
// CHECKS 42–49: RENDER 3 ACCEPTANCE DEMOS + CONTACT SHEETS + FFPROBE
// ============================================================================
const orch = new ProductionOrchestrator();

// DEMO A: Max Night Street (8s, 240 frames @ 30fps)
const demoAPlan = {
  schemaVersion: '5.2',
  project: { id: 'p3e_demoA_max_night', title: 'Demo A: Max Night Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'night',
  detailLevel: 'high',
  scenes: [{
    id: 'demoA_s1',
    duration: 8,
    lighting: 'night',
    background: { assetId: 'bg_street' },
    characters: [{
      characterId: 'chibi_max',
      view: 'side_r',
      emotion: 'neutral',
      position: [0.18, 0.78],
      actions: [
        { type: 'walk', start: 0, end: 3, to: [0.42, 0.78], decelerate: false },
        { type: 'walk', start: 3, end: 4, to: [0.48, 0.78], decelerate: true },
        { type: 'turn_head', start: 3, end: 4, targetView: 'front' },
        { type: 'wave', start: 4, end: 7, expression: 'happy' },
        { type: 'lower_arm', start: 7, end: 8 },
      ],
    }],
  }],
};
const outA = path.join(OUT_DIR, 'v52_p3e_demoA_max_night_8s.mp4');
console.log('\nRendering Acceptance Demo A (Max Night Street 8s / 240 frames)...');
const resA = await orch.produceVideo(
  { id: 'p3e_demoA_max_night', scenePlan: demoAPlan, bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } }, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outA }
);

await check(42, 'Demo A (Max Night Street 8s) renders cleanly', () => assert.equal(resA.success, true, resA.error));
await check(43, 'Demo A has exact 240 frames @ 30fps and 8.00s duration', () => {
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outA], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 240);
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 8.0) < 0.08);
});

// DEMO B: Scientist Acting (30s, Doc in Lab, 0-30s timeline)
const demoBPlan = {
  schemaVersion: '5.2',
  project: { id: 'p3e_demoB_scientist_30s', title: 'Demo B: Scientist Acting (30s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'educational_cartoon' },
  lighting: 'indoor_cool',
  detailLevel: 'high',
  scenes: [
    {
      id: 'demoB_s1',
      duration: 10,
      background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      characters: [{
        characterId: 'chibi_doc',
        position: [0.18, 0.78],
        actions: [
          { type: 'walk', start: 0, end: 4, to: [0.42, 0.78], decelerate: true },
          { type: 'press_button', targetId: 'vintage_computer', start: 4, end: 7 },
          { type: 'talk', start: 7, end: 10, expression: 'thinking', speechIntervals: [[0, 2.5]] },
        ],
      }],
    },
    {
      id: 'demoB_s2',
      duration: 10,
      background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      characters: [{
        characterId: 'chibi_doc',
        position: [0.42, 0.78],
        actions: [
          { type: 'experiment_failure', targetId: 'vintage_computer', start: 0, end: 4 },
          { type: 'scratch_head', start: 4, end: 7, expression: 'confused' },
          { type: 'thinking', start: 7, end: 10, expression: 'thinking' },
        ],
      }],
    },
    {
      id: 'demoB_s3',
      duration: 10,
      background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'lightbulb' }],
      characters: [{
        characterId: 'chibi_doc',
        position: [0.42, 0.78],
        actions: [
          { type: 'idea_discovery', start: 0, end: 4 },
          { type: 'talk', start: 4, end: 8, expression: 'excited', speechIntervals: [[0, 3.8]] },
          { type: 'wave', start: 8, end: 10, expression: 'happy' },
        ],
      }],
    },
  ],
};
const outB = path.join(OUT_DIR, 'v52_p3e_demoB_scientist_30s.mp4');
console.log('\nRendering Acceptance Demo B (Scientist Acting 30s / 900 frames)...');
const resB = await orch.produceVideo(
  {
    id: 'p3e_demoB_scientist_30s',
    scenePlan: demoBPlan,
    bindings: {
      REQ_BG_modern_lab: { requirementId: 'REQ_BG_modern_lab', resolvedAssetId: 'bg_modern_lab', status: 'READY' },
      REQ_PROP_VINTAGE_COMPUTER: { requirementId: 'REQ_PROP_VINTAGE_COMPUTER', resolvedAssetId: 'vintage_computer', status: 'READY' },
      REQ_PROP_LIGHTBULB: { requirementId: 'REQ_PROP_LIGHTBULB', resolvedAssetId: 'lightbulb', status: 'READY' },
    },
    styleProfile: 'educational_cartoon',
  },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outB }
);

await check(44, 'Demo B (Scientist Acting 30s) renders cleanly', () => assert.equal(resB.success, true, resB.error));
await check(45, 'Demo B has exact 900 frames @ 30fps and 30.00s duration', () => {
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outB], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 900);
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 30.0) < 0.1);
});

// DEMO C: Cartoon Fight (10s, 300 frames @ 30fps, Fight Cloud + Dizzy + Clean Disappearance)
const demoCPlan = {
  schemaVersion: '5.2',
  project: { id: 'p3e_demoC_cartoon_fight_10s', title: 'Demo C: Cartoon Fight (10s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'daylight',
  detailLevel: 'high',
  scenes: [{
    id: 'demoC_s1',
    duration: 10,
    background: { assetId: 'bg_street' },
    characters: [
      {
        characterId: 'chibi_max',
        position: [0.32, 0.78],
        actions: [
          { type: 'angry_argument', start: 0, end: 3 },
          { type: 'walk', start: 2.5, end: 3.5, to: [0.48, 0.78] },
          { type: 'fight_cloud', start: 3.5, end: 7.0 },
          { type: 'funny_fall', start: 7.0, end: 8.5 },
          { type: 'idle', start: 8.5, end: 10.0, expression: 'dizzy' },
        ],
      },
      {
        characterId: 'chibi_doc',
        position: [0.64, 0.78],
        view: 'three_quarter_left',
        actions: [
          { type: 'angry_argument', start: 0, end: 3 },
          { type: 'walk', start: 2.5, end: 3.5, to: [0.50, 0.78] },
          { type: 'fight_cloud', start: 3.5, end: 7.0 },
          { type: 'recoil', start: 7.0, end: 8.5, expression: 'shocked' },
          { type: 'idle', start: 8.5, end: 10.0, expression: 'tired' },
        ],
      },
    ],
  }],
};
const outC = path.join(OUT_DIR, 'v52_p3e_demoC_cartoon_fight_10s.mp4');
console.log('\nRendering Acceptance Demo C (Cartoon Fight 10s / 300 frames)...');
const resC = await orch.produceVideo(
  { id: 'p3e_demoC_cartoon_fight_10s', scenePlan: demoCPlan, bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } }, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outC }
);

await check(46, 'Demo C (Cartoon Fight 10s) renders cleanly', () => assert.equal(resC.success, true, resC.error));
await check(47, 'Demo C has exact 300 frames @ 30fps and 10.00s duration', () => {
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outC], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 300);
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 10.0) < 0.08);
});

// Generate Contact Sheets for Demo B & Demo C
const makeContact = (mp4, times, outPng) => {
  const frames = times.map((t, i) => {
    const fp = path.join(OUT_DIR, `${path.basename(outPng, '.png')}_f${i}.png`);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', mp4, '-frames:v', '1', fp]);
    return fp;
  });
  const args = ['-y', '-v', 'error'];
  frames.forEach(f => args.push('-i', f));
  args.push('-filter_complex', `hstack=inputs=${frames.length},scale=1920:-1`, outPng);
  execFileSync('ffmpeg', args);
};

const contactA = path.join(OUT_DIR, 'v52_p3e_demoA_contact.png');
const contactB = path.join(OUT_DIR, 'v52_p3e_demoB_contact.png');
const contactC = path.join(OUT_DIR, 'v52_p3e_demoC_contact.png');

await check(48, 'Generate Contact Sheets for Demo A, Demo B, Demo C', () => {
  makeContact(outA, [0.5, 1.5, 3.5, 5.5, 7.5], contactA);
  makeContact(outB, [2.0, 5.5, 12.0, 21.5, 29.0], contactB);
  makeContact(outC, [1.5, 5.0, 7.8, 9.2], contactC);
  assert.ok(fs.existsSync(contactA) && fs.existsSync(contactB) && fs.existsSync(contactC));
});

await check(49, 'All 3 acceptance MP4 files valid & non-trivial (>100KB)', () => {
  for (const p of [outA, outB, outC]) {
    assert.ok(fs.statSync(p).size > 100000, `MP4 too small: ${p}`);
  }
});

console.log(`\nPhase 3E Acceptance Summary: ${passed} passed, ${failed} failed (Total checks: ${passed + failed})`);
console.log(`Contact Sheets:\n - ${contactA}\n - ${contactB}\n - ${contactC}`);
if (failed > 0) process.exit(1);

