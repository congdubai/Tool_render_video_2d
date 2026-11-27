import assert from 'node:assert/strict';
import {
  REQUIRED_EXPRESSIONS,
  drawUnifiedCharacter,
} from '../thanhhai-2d-studio/engine/unified-character-renderer.js';
import {
  evaluateFootGroundIK,
  computeEyeTrackingLook,
  evaluateTalkingState,
  expandComposedActions,
  compileCharacterActingTracks,
  evaluateActingFrame,
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

await check('3B-1: All 14 facial expressions registered & renderable without error', () => {
  const expected = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'confused', 'scared', 'excited', 'tired', 'disappointed', 'embarrassed', 'dizzy', 'shocked'];
  for (const e of expected) {
    assert.ok(REQUIRED_EXPRESSIONS.includes(e), `Missing expression: ${e}`);
  }
  assert.equal(REQUIRED_EXPRESSIONS.length, 14);
});

await check('3B-2: Motion Composition (sequential, parallel, repeat, conditionalFallback)', () => {
  const expanded = expandComposedActions([
    {
      compose: 'sequential',
      start: 0,
      steps: [
        { type: 'walk', duration: 2, to: [0.4, 0.78] },
        { type: 'wave', duration: 1.5 },
      ],
    },
    {
      compose: 'parallel',
      start: 2,
      duration: 1.5,
      steps: [
        { type: 'talk' },
        { type: 'expression', value: 'happy' },
      ],
    },
    {
      compose: 'repeat',
      start: 3.5,
      count: 2,
      step: { type: 'nod', duration: 0.5 },
    },
    {
      compose: 'conditionalFallback',
      start: 4.5,
      duration: 1,
      condition: false,
      primary: { type: 'jump' },
      fallback: { type: 'idle' },
    },
  ], 6);
  assert.equal(expanded.length, 7);
  assert.equal(expanded[0].type, 'walk');
  assert.equal(expanded[1].start, 2);
  assert.equal(expanded[2].type, 'talk');
  assert.equal(expanded[4].type, 'nod');
  assert.equal(expanded[6].type, 'idle');
});

await check('3B-3: Eye tracking look_at computes distinct look vectors toward targets', () => {
  const leftLook = computeEyeTrackingLook([500, 560], [200, 520]);
  const rightLook = computeEyeTrackingLook([500, 560], [900, 420]);
  assert.ok(leftLook[0] < -0.5, 'Looking left should produce negative X');
  assert.ok(rightLook[0] > 0.5, 'Looking right should produce positive X');
  assert.notEqual(leftLook[1], rightLook[1]);
});

await check('3B-4: Talking animation modulates talk & mouthShape over speechIntervals', () => {
  const silent = evaluateTalkingState({ speechIntervals: [[1.0, 2.5]] }, 0.4);
  const speaking = evaluateTalkingState({ speechIntervals: [[1.0, 2.5]] }, 1.5);
  assert.equal(silent.talk, 0);
  assert.equal(silent.mouthShape, 'closed');
  assert.ok(speaking.talk > 0);
  assert.notEqual(speaking.mouthShape, 'closed');
});

await check('3B-5: Smooth expression transition produces intermediate exprBlend in (0, 1)', () => {
  const track = compileCharacterActingTracks({
    characterId: 'chibi_doc',
    emotion: 'neutral',
    actions: [
      { type: 'expression', value: 'happy', start: 1.0, end: 3.0 },
    ],
  }, 3, 202);
  const mid = evaluateActingFrame(track, 1.1);
  assert.equal(mid.expression, 'happy');
  assert.equal(mid.prevExpression, 'neutral');
  assert.ok(mid.exprBlend > 0 && mid.exprBlend < 1, `Expected 0 < exprBlend < 1, got ${mid.exprBlend}`);
});

await check('3B-6: Foot-to-ground IK returns finite thigh/shin/ankle angles', () => {
  const ik = evaluateFootGroundIK(-44, [6, -2], 22, 22);
  assert.ok(Number.isFinite(ik.thighDeg) && Number.isFinite(ik.shinDeg) && Number.isFinite(ik.ankleDeg));
});

console.log(`\nPhase 3B Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
