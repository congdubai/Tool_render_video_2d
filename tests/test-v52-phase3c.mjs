import assert from 'node:assert/strict';
import {
  compileCharacterActingTracks,
  evaluateActingFrame,
  evaluateMotionPrimitive,
  evaluatePropState,
  evaluateObjectInteractions,
  resolveSceneChoreography,
} from '../thanhhai-2d-studio/engine/v5-character-acting-engine.js';

let passed = 0;
let failed = 0;
async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}\n  ${err?.stack || err}`);
  }
}

await check('3C-1: Prop state machine handles on_surface -> held -> transfer_prop -> thrown with zero-jump release', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_max',
    position: [0.35, 0.78],
    actions: [
      { type: 'pick_up', propId: 'cup', hand: 'right', start: 1.0, end: 1.8 },
      { type: 'transfer_prop', propId: 'cup', fromHand: 'right', toHand: 'left', start: 2.0, end: 2.5 },
      { type: 'throw_object', propId: 'cup', start: 3.0, end: 4.0, vx: 220, vy: -260 },
    ],
  }, 5);
  const prop = { assetId: 'cup', x: 520, y: 560 };

  const s0 = evaluatePropState(prop, [tr], {}, 0.5);
  assert.equal(s0.state, 'on_surface');
  assert.equal(s0.worldX, 520);

  const s1 = evaluatePropState(prop, [tr], {}, 1.4);
  assert.equal(s1.state, 'held');
  assert.equal(s1.hand, 'right');

  const s2 = evaluatePropState(prop, [tr], {}, 2.7);
  assert.equal(s2.state, 'held');
  assert.equal(s2.hand, 'left');

  // Zero-jump check at exact release boundary t=3.0 vs t=3.001
  const sRel0 = evaluatePropState(prop, [tr], {}, 3.0);
  const sRel1 = evaluatePropState(prop, [tr], {}, 3.01);
  assert.equal(sRel0.state, 'thrown');
  assert.ok(Math.abs(sRel1.worldX - sRel0.worldX) < 10, 'Zero-jump release position at throw start');
  const sRelLater = evaluatePropState(prop, [tr], {}, 3.4);
  assert.ok(sRelLater.worldX > sRel0.worldX + 50, 'Thrown prop flies along ballistic trajectory');
});

await check('3C-2: Object interactions update screenGlow, indicatorColor, shakeX, emitSmoke', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [
      { type: 'press_button', targetId: 'vintage_computer', start: 1.0, end: 2.0 },
      { type: 'experiment_failure', targetId: 'vintage_computer', start: 3.0, end: 4.0 },
    ],
  }, 5);
  const props = [{ assetId: 'vintage_computer', x: 840, y: 560 }];

  const stBefore = evaluateObjectInteractions(props, [tr], 0.5);
  assert.equal(stBefore.vintage_computer.screenGlow, false);

  const stPress = evaluateObjectInteractions(props, [tr], 1.5);
  assert.equal(stPress.vintage_computer.screenGlow, true);
  assert.equal(stPress.vintage_computer.indicatorColor, '#38bdf8');

  const stFail = evaluateObjectInteractions(props, [tr], 3.5);
  assert.equal(stFail.vintage_computer.emitSmoke, true);
  assert.equal(stFail.vintage_computer.indicatorColor, '#ef4444');
});

await check('3C-3: Multi-character choreography resolves live entity positions for look_at', () => {
  const trA = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    position: [0.3, 0.78],
    actions: [{ type: 'look_at', targetId: 'chibi_max', start: 0, end: 3 }],
  }, 3);
  const trB = compileCharacterActingTracks({
    characterId: 'chibi_max',
    position: [0.7, 0.78],
    actions: [{ type: 'idle', start: 0, end: 3 }],
  }, 3);
  const choreo = resolveSceneChoreography([{ characterId: 'chibi_doc', actingTrack: trA }, { characterId: 'chibi_max', actingTrack: trB }], 1.0);
  const fA = evaluateActingFrame(trA, 1.0, { sceneEntities: choreo.entities });
  assert.ok(fA.look[0] > 0.5, 'Doc should look right toward Max');
});

await check('3C-4: All 8 composite cartoon actions work & fight_cloud VFX disappears cleanly after endMs', () => {
  const composites = ['fight_cloud', 'cartoon_chase', 'funny_fall', 'power_up', 'shock_reaction', 'angry_argument', 'experiment_failure', 'idea_discovery'];
  for (const name of composites) {
    const r = evaluateMotionPrimitive({ type: name, start: 0, end: 2 }, 1.0, 0.5);
    assert.equal(r.supported, true, `Composite action ${name} must be supported`);
  }

  const trFight = compileCharacterActingTracks({
    characterId: 'chibi_max',
    actions: [
      { type: 'fight_cloud', start: 2.0, end: 6.0 },
      { type: 'funny_fall', start: 6.0, end: 8.0 },
    ],
  }, 10);
  const duringFight = evaluateActingFrame(trFight, 4.0);
  assert.ok(duringFight.vfxEffects.some(v => v.type === 'fight_cloud' && v.active), 'Fight cloud active at t=4s');
  assert.equal(duringFight.visible, false, 'Character hidden inside fight cloud at mid-action');

  const afterFight = evaluateActingFrame(trFight, 8.5);
  assert.equal(afterFight.vfxEffects.length, 0, 'Fight cloud & dizzy VFX cleanly disappear at t=8.5s');
  assert.equal(afterFight.visible, true);
});

await check('3C-5: Secondary motion computes finite hairBounce & coatSway', () => {
  const tr = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    actions: [{ type: 'run', start: 0, end: 2, to: [0.7, 0.78] }],
  }, 2);
  const f = evaluateActingFrame(tr, 0.8);
  assert.ok(Number.isFinite(f.secondaryMotion.hairBounce));
  assert.ok(Number.isFinite(f.secondaryMotion.coatSway));
});

console.log(`\nPhase 3C Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
