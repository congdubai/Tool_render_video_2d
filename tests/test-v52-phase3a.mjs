import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import {
  SEMANTIC_BONES_20,
  SEMANTIC_TO_RIG15,
  getRigCapabilities,
  solveTwoBoneIKAngles,
  evaluateWalkCycle,
  evaluateMotionPrimitive,
  compileCharacterActingTracks,
  evaluateActingFrame,
} from '../thanhhai-2d-studio/engine/v5-character-acting-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
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

await check('3A-1: 20 semantic bones and mapping to rig15 exist', () => {
  assert.equal(SEMANTIC_BONES_20.length, 20);
  assert.ok(SEMANTIC_TO_RIG15.spine && SEMANTIC_TO_RIG15.head && SEMANTIC_TO_RIG15.left_foot && SEMANTIC_TO_RIG15.right_foot);
  const capA = getRigCapabilities('procedural_rig');
  assert.equal(capA.skeletalAnimation, true);
  assert.equal(capA.twoBoneIK, true);
});

await check('3A-2: Two-bone IK solver computes valid finite angles', () => {
  const res = solveTwoBoneIKAngles([0, 0], [18, 22], 20, 20, { poleDir: 1 });
  assert.equal(res.reachable, true);
  assert.ok(Number.isFinite(res.upperDeg) && Number.isFinite(res.foreDeg));
});

await check('3A-3: 5-phase walk cycle produces distinct leg & arm poses over time', () => {
  const p0 = evaluateWalkCycle(0.0, { speed: 1.0 });
  const p25 = evaluateWalkCycle(0.2, { speed: 1.0 });
  const p50 = evaluateWalkCycle(0.4, { speed: 1.0 });
  const p75 = evaluateWalkCycle(0.6, { speed: 1.0 });
  assert.notEqual(p0.thigh_L, p50.thigh_L, 'Left thigh must swing between 0% and 50% stride');
  assert.notEqual(p25.shin_L, p75.shin_L, 'Left shin must bend differently at 25% vs 75% stride');
  assert.ok(Math.abs(p0.thigh_L - p50.thigh_L) > 20, 'Walk stride amplitude must be clearly visible (>20 deg)');
});

await check('3A-4: Wave primitive raises right arm and waves forearm across time', () => {
  const w1 = evaluateMotionPrimitive({ type: 'wave', start: 4, end: 7 }, 0.5, 0.25);
  const w2 = evaluateMotionPrimitive({ type: 'wave', start: 4, end: 7 }, 1.2, 0.45);
  assert.equal(w1.supported, true);
  assert.ok(Math.abs(w1.channels.right_arm.angles.upper_arm_R) > 60, 'Wave should raise right upper arm');
  assert.notEqual(w1.channels.right_arm.angles.forearm_R, w2.channels.right_arm.angles.forearm_R, 'Wave forearm should oscillate');
});

await check('3A-5: Compile & deterministic seek evaluation for Demo A timeline', () => {
  const track = compileCharacterActingTracks({
    characterId: 'chibi_max',
    position: [0.18, 0.78],
    view: 'side_r',
    actions: [
      { type: 'walk', start: 0, end: 3, to: [0.42, 0.78], decelerate: false },
      { type: 'walk', start: 3, end: 4, to: [0.48, 0.78], decelerate: true },
      { type: 'turn_head', start: 3, end: 4, targetView: 'front' },
      { type: 'wave', start: 4, end: 7, expression: 'happy' },
      { type: 'lower_arm', start: 7, end: 8 },
    ],
  }, 8, 101);
  const f1a = evaluateActingFrame(track, 1.5);
  const f1b = evaluateActingFrame(track, 1.5);
  assert.deepEqual(f1a, f1b, 'Deterministic evaluation at identical tSec');
  const f5 = evaluateActingFrame(track, 5.5);
  assert.equal(f5.expression, 'happy');
  assert.equal(f5.view, 'front');
  assert.ok(Math.abs(f5.jointAngles.upper_arm_R) > 60);
});

const demoAPlan = {
  schemaVersion: '5.2',
  project: { id: 'demo_v52_p3a_max_night_street', title: 'Phase 3A Demo A: Max Night Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'night',
  detailLevel: 'high',
  scenes: [
    {
      id: 'p3a_demoA_s1',
      duration: 8,
      lighting: 'night',
      background: { assetId: 'bg_street' },
      characters: [
        {
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
        },
      ],
    },
  ],
};

const demoABindings = {
  REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' },
};

const outMp4 = path.join(OUT_DIR, 'v52_p3a_demoA_max_night_8s.mp4');
console.log('\nRendering Phase 3A Demo A (Max Night Street 8s / 240 frames)...');
const res = await new ProductionOrchestrator().produceVideo(
  { id: 'demo_v52_p3a_max_night_street', scenePlan: demoAPlan, bindings: demoABindings, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outMp4 }
);

await check('3A-6: Real MP4 render succeeds with exact 240 frames @ 30fps (8.00s)', async () => {
  assert.equal(res.success, true, `Render failed: ${res.error || JSON.stringify(res)}`);
  const vCheck = await defaultFfmpegAssembler.verifyFinalOutput(outMp4, { duration: 8, resolution: '1920x1080', fps: 30 });
  assert.equal(vCheck.isValid, true, `ffprobe verification failed: ${JSON.stringify(vCheck)}`);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames,width,height', '-of', 'json', outMp4], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 240, `Expected 240 frames, got ${vs.nb_frames}`);
});

// Extract frames at 0.5s, 1.5s, 3.5s, 5.5s, 7.5s and create contact sheet
const timestamps = [0.5, 1.5, 3.5, 5.5, 7.5];
const framePaths = [];
for (const ts of timestamps) {
  const fp = path.join(OUT_DIR, `v52_p3a_f_${String(ts).replace('.', '_')}.png`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(ts), '-i', outMp4, '-frames:v', '1', fp]);
  framePaths.push({ ts, fp });
}

const contactPath = path.join(OUT_DIR, 'v52_p3a_demoA_contact.png');
const ffArgs = ['-y', '-v', 'error'];
for (const { fp } of framePaths) {
  ffArgs.push('-i', fp);
}
ffArgs.push('-filter_complex', 'hstack=inputs=5,scale=1920:-1', contactPath);
execFileSync('ffmpeg', ffArgs);

console.log(`\nPhase 3A Summary: ${passed} passed, ${failed} failed`);
console.log(`Contact Sheet: ${contactPath}`);
if (failed > 0) process.exit(1);
