import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { renderSegmentedProject } from '../thanhhai-2d-studio/engine/v5-segmented-renderer.js';
import { RenderCacheManager } from '../thanhhai-2d-studio/engine/v5-render-engine.js';
import { defaultFfmpegAssembler } from '../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

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

await check('5C-1: Hardware encoder probe detects real ffmpeg/encoder capabilities without crash', () => {
  const hw = defaultFfmpegAssembler.detectHardwareCapabilities();
  assert.ok(hw.preferredEncoder === 'h264_nvenc' || hw.preferredEncoder === 'libx264');
  assert.ok(hw.totalRamGb > 0);
});

const tempCacheDir = path.join(ROOT, 'scratch', 'p5c_cache');
const tempWorkDir = path.join(ROOT, 'scratch', 'p5c_segs');
const tempCp = path.join(ROOT, 'scratch', 'p5c_cp.json');
fs.rmSync(tempCacheDir, { recursive: true, force: true });
fs.rmSync(tempWorkDir, { recursive: true, force: true });
if (fs.existsSync(tempCp)) fs.unlinkSync(tempCp);

const cache = new RenderCacheManager(tempCacheDir);
const twoScenePlan = {
  schemaVersion: '5.2',
  project: { id: 'p5c_resume_test', title: 'Phase 5C Resume & Incremental Test', fps: 30, resolution: { width: 1280, height: 720 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'night',
  scenes: [
    { id: 'seg_1', duration: 2, background: { assetId: 'bg_street' }, characters: [{ characterId: 'chibi_max', position: [0.3, 0.78], actions: [{ type: 'walk', start: 0, end: 2, to: [0.5, 0.78] }] }] },
    { id: 'seg_2', duration: 2, background: { assetId: 'bg_street' }, characters: [{ characterId: 'chibi_max', position: [0.5, 0.78], actions: [{ type: 'wave', start: 0, end: 2, expression: 'happy' }] }] },
  ],
};
const out5c = path.join(OUT_DIR, 'v52_p5c_resume_4s.mp4');

// Step A: Simulate interrupt after rendering 1st segment
const intRes = await renderSegmentedProject(
  { id: 'p5c_resume_test', scenePlan: twoScenePlan, compiledScenes: twoScenePlan.scenes },
  { cache, workDir: tempWorkDir, checkpointFile: tempCp, outputPath: out5c, resolution: { width: 1280, height: 720 }, simulateInterruptAfterScene: 1 }
);
await check('5C-2: Interrupt after scene 1 saves valid checkpoint', () => {
  assert.equal(intRes.interrupted, true);
  assert.equal(intRes.renderedCount, 1);
  assert.ok(fs.existsSync(tempCp));
});

// Step B: Resume — must skip seg_1 (cache hit) and render ONLY seg_2, then concat & verify 4s MP4
const resResume = await renderSegmentedProject(
  { id: 'p5c_resume_test', scenePlan: twoScenePlan, compiledScenes: twoScenePlan.scenes },
  { cache, workDir: tempWorkDir, checkpointFile: tempCp, outputPath: out5c, resolution: { width: 1280, height: 720 } }
);
await check('5C-3: Resume skips completed seg_1, renders seg_2, assembles & verifies MP4', () => {
  assert.equal(resResume.success, true);
  assert.equal(resResume.resumedFromCacheCount, 1);
  assert.equal(resResume.renderedCount, 1);
  assert.equal(resResume.verification.isValid, true);
});

// Step C: Edit ONLY seg_2 -> incremental rebuild must hit cache on seg_1 and re-render ONLY seg_2
const editedPlan = JSON.parse(JSON.stringify(twoScenePlan));
editedPlan.scenes[1].characters[0].actions[0].expression = 'excited';
const resInc = await renderSegmentedProject(
  { id: 'p5c_resume_test', scenePlan: editedPlan, compiledScenes: editedPlan.scenes },
  { cache, workDir: tempWorkDir, checkpointFile: tempCp, outputPath: out5c, resolution: { width: 1280, height: 720 } }
);
await check('5C-4: Incremental rebuild invalidates ONLY edited seg_2 and reuses seg_1', () => {
  assert.equal(resInc.success, true);
  assert.equal(resInc.resumedFromCacheCount, 1);
  assert.equal(resInc.renderedCount, 1);
});

console.log(`\nPhase 5C Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

