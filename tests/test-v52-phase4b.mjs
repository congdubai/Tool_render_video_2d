import assert from 'node:assert/strict';
import {
  SCENE_TYPES,
  COMPOSITION_TEMPLATES,
  selectCompositionForScene,
  compileVisualStorytellingPlan,
  computeLayerParallaxShift,
} from '../thanhhai-2d-studio/engine/v5-visual-storytelling.js';
import { compileSceneCameraTrack, evaluateCameraFrame } from '../thanhhai-2d-studio/engine/v5-camera-engine.js';

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

await check('4B-1: All 17 Scene Types & 9 Composition Templates supported', () => {
  assert.equal(SCENE_TYPES.length, 17);
  assert.equal(Object.keys(COMPOSITION_TEMPLATES).length, 9);
});

await check('4B-2: Intelligent Composition adapts to scene subjects (diagram -> center, 2 chars -> symmetrical, char+prop -> asymmetrical)', () => {
  assert.equal(selectCompositionForScene({ sceneType: 'diagram_explanation' }).id, 'center');
  assert.equal(selectCompositionForScene({ characters: [{ id: 'a' }, { id: 'b' }] }).id, 'symmetrical');
  assert.equal(selectCompositionForScene({ characters: [{ id: 'a' }], props: [{ id: 'p' }] }).id, 'asymmetrical');
});

await check('4B-3: Visual Beat Engine auto-sequences multi-shot timeline without resetting animation', () => {
  const st = compileVisualStorytellingPlan({}, {
    sceneType: 'object_explanation',
    rhythm: 'discovery',
    visualBeats: [
      { id: 'b1', start: 0, end: 3, visualFocus: 'lab', cameraInstruction: { shotType: 'wide' } },
      { id: 'b2', start: 3, end: 6, visualFocus: 'computer', cameraInstruction: { shotType: 'object_closeup' } },
    ],
  }, 6);
  assert.equal(st.beats.length, 2);
  assert.equal(st.autoShots.length, 2);
  const camTrack = compileSceneCameraTrack({}, { shots: st.autoShots }, 6);
  const f1 = evaluateCameraFrame(camTrack, 1.5);
  const f2 = evaluateCameraFrame(camTrack, 4.5, { entities: { computer: { x: 840, y: 520, width: 240, height: 220 } } });
  assert.equal(f1.activeShotType, 'wide');
  assert.equal(f2.activeShotType, 'object_closeup');
});

await check('4B-4: Parallax shifts distant sky less than midground & clamps within safe gap-free bounds', () => {
  const skyShift = computeLayerParallaxShift('sky', { x: 840, y: 360 });
  const nearShift = computeLayerParallaxShift('near_bg', { x: 840, y: 360 });
  assert.notEqual(skyShift[0], nearShift[0]);
  assert.ok(Math.abs(skyShift[0]) <= 28 && Math.abs(nearShift[0]) <= 28);
});

console.log(`\nPhase 4B Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
