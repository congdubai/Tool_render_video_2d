import assert from 'node:assert/strict';
import { defaultQaEngine, QA_SEVERITY, SCENE_QA_STATUS } from '../thanhhai-2d-studio/engine/v5-technical-qa-engine.js';

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

await check('5B-1: Comprehensive QA detects NaN transform, out-of-bounds scale, duplicate ID, safe-area text', () => {
  const qa = defaultQaEngine.runComprehensiveQA({
    scenes: [
      {
        id: 's1',
        duration: 4,
        background: { assetId: 'bg_modern_lab' },
        characters: [
          { characterId: 'doc', scale: 12.0, position: [NaN, 0.78] },
          { characterId: 'doc', scale: 1.0, position: [0.5, 0.78] },
        ],
        texts: [{ text: 'Edge', x: 0.01, y: 0.01 }],
      },
    ],
  });
  assert.equal(qa.isValid, false);
  assert.ok(qa.issues.some(i => i.code === 'OUT_OF_BOUNDS_SCALE'));
  assert.ok(qa.issues.some(i => i.code === 'NAN_TRANSFORM'));
  assert.ok(qa.issues.some(i => i.code === 'DUPLICATE_INSTANCE_ID'));
  assert.ok(qa.issues.some(i => i.code === 'TEXT_OUTSIDE_SAFE_AREA'));
});

await check('5B-2: Automatic Repair Loop repairs scale, NaN position, and safe-area text with undo history & respects locked scenes', () => {
  const res = defaultQaEngine.runAutomaticRepairLoop({
    scenes: [
      {
        id: 's1',
        duration: 4,
        background: { assetId: 'bg_modern_lab' },
        characters: [{ characterId: 'doc', scale: 9.0, position: [NaN, 0.99] }],
        texts: [{ text: 'Title', x: 0.01, y: 0.01 }],
      },
      {
        id: 's2_locked',
        locked: true,
        duration: 4,
        background: { assetId: 'bg_street' },
        characters: [{ characterId: 'max', scale: 9.0, position: [0.5, 0.78] }],
      },
    ],
  });
  const s1Rep = res.qaResult.sceneReports.find(r => r.sceneId === 's1');
  const s2Rep = res.qaResult.sceneReports.find(r => r.sceneId === 's2_locked');
  assert.equal(s1Rep.status, SCENE_QA_STATUS.READY, 'Repaired scene s1 must become READY');
  assert.equal(s2Rep.status, SCENE_QA_STATUS.LOCKED, 'Locked scene s2_locked must remain LOCKED');
  assert.ok(res.repairsCount >= 3);
  assert.equal(res.repairedProjectData.scenes[0].characters[0].scale, 3.0);
  assert.equal(res.repairedProjectData.scenes[1].characters[0].scale, 9.0, 'Locked scene must NOT be auto-repaired');
  assert.ok(res.repairHistory.every(h => h.before !== undefined && h.after !== undefined && h.reason));
});

await check('5B-3: Missing Asset Inspector produces structured per-asset detail & repair options', () => {
  const rep = defaultQaEngine.buildMissingAssetReport([
    { requirementId: 'REQ_BG_space', name: 'Space Station', type: 'background', sceneUsages: ['s1', 's2'], reason: 'Not in library' },
  ]);
  assert.equal(rep.length, 1);
  assert.equal(rep[0].requirementId, 'REQ_BG_space');
  assert.ok(rep[0].repairOptions.includes('CODE_GEN') && rep[0].repairOptions.includes('AI_REPAIR'));
});

console.log(`\nPhase 5B Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
