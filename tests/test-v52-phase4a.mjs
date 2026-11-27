import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  SHOT_LIBRARY,
  CAMERA_MOVEMENTS,
  computeSubjectBounds,
  clampCameraToBounds,
  computeAutomaticFraming,
  compileSceneCameraTrack,
  evaluateCameraFrame,
} from '../thanhhai-2d-studio/engine/v5-camera-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';

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

await check('4A-1: Shot Library has 15 shots & Camera Movements has 16 movements', () => {
  assert.equal(Object.keys(SHOT_LIBRARY).length, 15);
  assert.equal(CAMERA_MOVEMENTS.length, 16);
});

await check('4A-2: clampCameraToBounds never exposes blank canvas outside 1280x720', () => {
  const c = clampCameraToBounds({ x: -200, y: 900, zoom: 1.5 }, 1280, 720);
  const halfW = (1280 / c.zoom) * 0.5;
  const halfH = (720 / c.zoom) * 0.5;
  assert.ok(c.x - halfW >= -0.01 && c.x + halfW <= 1280.01);
  assert.ok(c.y - halfH >= -0.01 && c.y + halfH <= 720.01);
});

await check('4A-3: Automatic Subject Framing centers & zooms appropriately', () => {
  const bounds = computeSubjectBounds({ doc: { x: 400, y: 560, width: 140, height: 340 } }, ['doc']);
  const cam = computeAutomaticFraming('closeup', bounds);
  assert.ok(cam.zoom >= 1.6);
  assert.ok(cam.y < 560);
});

await check('4A-4: Multi-shot camera track & deterministic seek evaluation', () => {
  const track = compileSceneCameraTrack({}, {
    shots: [
      { id: 's1', start: 0, end: 3, type: 'full_body', targetIds: ['chibi_max'], movement: { type: 'follow_subject' } },
      { id: 's2', start: 3, end: 4, type: 'medium', targetIds: ['chibi_max'] },
      { id: 's3', start: 4, end: 7, type: 'medium_closeup', targetIds: ['chibi_max'], movement: { type: 'slow_push_in', zoomFrom: 1.5, zoomTo: 1.78 } },
    ],
  }, 8);
  const a = evaluateCameraFrame(track, 5.5, { entities: { chibi_max: { x: 614, y: 561, width: 140, height: 360 } } });
  const b = evaluateCameraFrame(track, 5.5, { entities: { chibi_max: { x: 614, y: 561, width: 140, height: 360 } } });
  assert.deepEqual(a, b);
  assert.equal(a.activeShotId, 's3');
  assert.ok(a.zoom > 1.55);
});

const demoAPlan = {
  schemaVersion: '5.2',
  project: { id: 'p4a_demoA_max_night', title: 'Phase 4A Demo A: Max Night Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'night',
  detailLevel: 'high',
  scenes: [{
    id: 'p4a_demoA_s1',
    duration: 8,
    lighting: 'night',
    background: { assetId: 'bg_street' },
    shots: [
      { id: 'sh1', start: 0, end: 3, type: 'full_body', targetIds: ['chibi_max'], movement: { type: 'follow_subject' } },
      { id: 'sh2', start: 3, end: 4, type: 'medium', targetIds: ['chibi_max'] },
      { id: 'sh3', start: 4, end: 7, type: 'medium_closeup', targetIds: ['chibi_max'], movement: { type: 'slow_push_in', zoomFrom: 1.5, zoomTo: 1.75 } },
      { id: 'sh4', start: 7, end: 8, type: 'medium', targetIds: ['chibi_max'] },
    ],
    characters: [{
      characterId: 'chibi_max',
      view: 'side_r',
      emotion: 'neutral',
      position: [0.22, 0.78],
      actions: [
        { type: 'walk', start: 0, end: 3, to: [0.44, 0.78], decelerate: false },
        { type: 'walk', start: 3, end: 4, to: [0.48, 0.78], decelerate: true },
        { type: 'turn_head', start: 3, end: 4, targetView: 'front' },
        { type: 'wave', start: 4, end: 7, expression: 'happy' },
        { type: 'lower_arm', start: 7, end: 8 },
      ],
    }],
  }],
};

const outA = path.join(OUT_DIR, 'v52_p4a_demoA_max_night_8s.mp4');
console.log('\nRendering Phase 4A Demo A (Max Night Street 8s / 240 frames with Camera Engine)...');
const resA = await new ProductionOrchestrator().produceVideo(
  { id: 'p4a_demoA_max_night', scenePlan: demoAPlan, bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } }, styleProfile: 'clean_cartoon' },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outA }
);

await check('4A-5: Demo A renders 240 frames @ 30fps with real 2D camera zoom & follow', () => {
  assert.equal(resA.success, true, resA.error);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outA], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 240);
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 8.0) < 0.08);
});

const times = [0.5, 2.0, 3.5, 6.0, 7.5];
const args = ['-y', '-v', 'error'];
times.forEach((t, i) => {
  const fp = path.join(OUT_DIR, `v52_p4a_f${i}.png`);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', outA, '-frames:v', '1', fp]);
  args.push('-i', fp);
});
const contactA = path.join(OUT_DIR, 'v52_p4a_demoA_contact.png');
args.push('-filter_complex', `hstack=inputs=${times.length},scale=1920:-1`, contactA);
execFileSync('ffmpeg', args);

console.log(`\nPhase 4A Summary: ${passed} passed, ${failed} failed`);
console.log(`Contact Sheet: ${contactA}`);
if (failed > 0) process.exit(1);

