import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  TRANSITION_TYPES,
  normalizeTransition,
  evaluateSceneTransition,
} from '../thanhhai-2d-studio/engine/v5-transition-engine.js';
import { validateCameraAndVisuals } from '../thanhhai-2d-studio/engine/v5-camera-engine.js';
import { AiDirectorPackageManager } from '../thanhhai-2d-studio/engine/v5-ai-director-package.js';

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

await check('4D-1: Transition Engine supports all 13 transitions without altering duration', () => {
  assert.equal(TRANSITION_TYPES.length, 13);
  assert.equal(normalizeTransition('hard_cut').duration, 0);
  const trFade = evaluateSceneTransition({ type: 'fade_to_black', duration: 0.5 }, 'hard_cut', 0.1, 4.0);
  assert.ok(trFade.fadeAlpha > 0.5 && trFade.fadeColor === '#000000');
  const trWipe = evaluateSceneTransition({ type: 'wipe_left', duration: 0.6 }, 'hard_cut', 0.3, 4.0);
  assert.ok(trWipe.wipeProgress > 0.4 && trWipe.wipeProgress < 0.6);
});

await check('4D-2: Camera & Visual QA detects invalid shot duration, gaps, overlaps, missing targets, safe area', () => {
  const issues = validateCameraAndVisuals(
    { duration: 4, texts: [{ text: 'Edge', x: 10, y: 10 }], transition: { duration: 3.0 }, characters: [{ characterId: 'doc' }] },
    {
      shots: [
        { id: 's1', startSec: 0, endSec: 2, targetIds: ['ghost'], movement: { type: 'camera_shake', intensity: 4.0 } },
        { id: 's2', startSec: 1.5, endSec: 1.2, targetIds: [] },
      ],
    },
    { strictTargets: true }
  );
  assert.ok(issues.some(i => i.code === 'INVALID_SHOT_DURATION'));
  assert.ok(issues.some(i => i.code === 'SHOT_OVERLAP'));
  assert.ok(issues.some(i => i.code === 'MISSING_CAMERA_TARGET'));
  assert.ok(issues.some(i => i.code === 'EXCESSIVE_SHAKE'));
  assert.ok(issues.some(i => i.code === 'TEXT_OUTSIDE_SAFE_AREA'));
  assert.ok(issues.some(i => i.code === 'TRANSITION_EXCEEDS_HALF_SCENE'));
});

await check('4D-3: AI Director Package V5.2 exports real cameraShots, sceneTypes, transitions, graphics', () => {
  const pkg = new AiDirectorPackageManager().exportDirectorPackage('Test script', { totalDuration: 15 });
  assert.equal(pkg.manifest.packageVersion, '5.2');
  assert.ok(pkg.manifest.capabilities.cameraShots.includes('object_closeup'));
  assert.ok(pkg.manifest.capabilities.sceneTypes.includes('diagram_explanation'));
  assert.ok(pkg.manifest.capabilities.transitions.includes('cross_dissolve'));
  assert.ok(pkg.manifest.capabilities.educationalGraphics.includes('flowchart'));
});

await check('4D-4: Tab 4 Camera & Storyboard Inspector UI controls exist', () => {
  const html = fs.readFileSync('app/ui/index.html', 'utf8');
  const appJs = fs.readFileSync('app/ui/app.js', 'utf8');
  assert.ok(html.includes('v5CamShotSelect') && html.includes('v5CamTransitionSelect') && html.includes('v5CamLockToggle'));
  assert.ok(appJs.includes('updateCameraInspectorOverride') && appJs.includes('rebuildCameraOnlyUi'));
});

console.log(`\nPhase 4D Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
