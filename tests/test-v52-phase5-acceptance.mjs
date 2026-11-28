import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { renderSegmentedProject } from '../thanhhai-2d-studio/engine/v5-segmented-renderer.js';
import { RenderCacheManager } from '../thanhhai-2d-studio/engine/v5-render-engine.js';
import { compileProjectAnimations } from '../thanhhai-2d-studio/engine/v5-animation-director.js';
import { defaultQaEngine } from '../thanhhai-2d-studio/engine/v5-technical-qa-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { resolveAssetRequirements } from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';

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

// 1. Regression checks on Phase 5A-5D artifacts
await check('5F-1', '15s Basic Production MP4 exists & has 450 frames @ 30fps', () => {
  const p = path.join(OUT_DIR, 'v52_p5a_demo_doc_lab_15s.mp4');
  assert.ok(fs.existsSync(p));
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', p], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 450);
});

await check('5F-2', '30s Character Acting MP4 exists & has 900 frames @ 30fps', () => {
  const p = path.join(OUT_DIR, 'v52_p3e_demoB_scientist_30s.mp4');
  assert.ok(fs.existsSync(p));
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', p], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 900);
});

await check('5F-3', '60s Evolution of Computers MP4 exists & has 1800 frames @ 30fps', () => {
  const p = path.join(OUT_DIR, 'v52_p4e_demoB_computers_60s.mp4');
  assert.ok(fs.existsSync(p));
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', p], { encoding: 'utf8' }));
  assert.equal(Number(ff.streams.find(s => s.codec_type === 'video').nb_frames), 1800);
});

await check('5F-4', 'Portable Project ZIP exists & valid', () => {
  const z = path.join(OUT_DIR, 'v52_p5d_demo_project.zip');
  assert.ok(fs.existsSync(z) && fs.statSync(z).size > 200);
});

// 2. Demo C: Cartoon Action (30s / 900 frames @ 30fps)
const demoC30sPlan = {
  schemaVersion: '5.2',
  project: { id: 'p5f_demoC_cartoon_30s', title: 'Demo C: Cartoon Action (30s)', fps: 30, resolution: { width: 1280, height: 720 } },
  style: { profileId: 'clean_cartoon' },
  lighting: 'daylight',
  scenes: [
    {
      id: 'c30_s1_argue', duration: 8, background: { assetId: 'bg_street' },
      characters: [
        { characterId: 'chibi_max', position: [0.30, 0.78], actions: [{ type: 'angry_argument', start: 0, end: 8 }] },
        { characterId: 'chibi_doc', position: [0.68, 0.78], view: 'three_quarter_left', actions: [{ type: 'angry_argument', start: 0, end: 8 }] },
      ],
    },
    {
      id: 'c30_s2_fight', duration: 12, background: { assetId: 'bg_street' },
      characters: [
        { characterId: 'chibi_max', position: [0.32, 0.78], actions: [{ type: 'walk', start: 0, end: 2.5, to: [0.48, 0.78] }, { type: 'fight_cloud', start: 2.5, end: 10.5 }, { type: 'funny_fall', start: 10.5, end: 12 }] },
        { characterId: 'chibi_doc', position: [0.66, 0.78], view: 'three_quarter_left', actions: [{ type: 'walk', start: 0, end: 2.5, to: [0.50, 0.78] }, { type: 'fight_cloud', start: 2.5, end: 10.5 }, { type: 'recoil', start: 10.5, end: 12, expression: 'shocked' }] },
      ],
    },
    {
      id: 'c30_s3_recover', duration: 10, background: { assetId: 'bg_street' },
      characters: [
        { characterId: 'chibi_max', position: [0.44, 0.78], actions: [{ type: 'idle', start: 0, end: 5, expression: 'dizzy' }, { type: 'wave', start: 5, end: 10, expression: 'happy' }] },
        { characterId: 'chibi_doc', position: [0.56, 0.78], view: 'three_quarter_left', actions: [{ type: 'idle', start: 0, end: 5, expression: 'dizzy' }, { type: 'nod', start: 5, end: 10, expression: 'neutral' }] },
      ],
    },
  ],
};

const outC30 = path.join(OUT_DIR, 'v52_p5f_demoC_cartoon_action_30s.mp4');
console.log('\nRendering Phase 5F Demo C (Cartoon Action 30s / 900 frames)...');
const resC30 = await new ProductionOrchestrator().produceVideo(
  {
    id: 'p5f_demoC_cartoon_30s',
    scenePlan: demoC30sPlan,
    bindings: { REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' } },
    styleProfile: 'clean_cartoon',
  },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: outC30, width: 1280, height: 720, fps: 30 }
);

await check('5F-5', 'Demo C (Cartoon Action 30s) renders cleanly', () => {
  assert.equal(resC30.success, true, resC30.error);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', outC30], { encoding: 'utf8' }));
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 30.0) < 0.12);
});

// 3. Long Video Benchmarks: 30s, 1m (60s), 3m (180s), 5m (300s), 8m (480s)
const longCacheDir = path.join(ROOT, 'scratch', 'p5e_long_cache');
const longWorkDir = path.join(ROOT, 'scratch', 'p5e_long_segs');
fs.rmSync(longCacheDir, { recursive: true, force: true });
fs.rmSync(longWorkDir, { recursive: true, force: true });
const longCache = new RenderCacheManager(longCacheDir);

const chapterTemplates = [
  { id: 'tpl_lab_walk', duration: 5, background: { assetId: 'bg_modern_lab' }, characters: [{ characterId: 'chibi_doc', position: [0.25, 0.78], actions: [{ type: 'walk', start: 0, end: 4, to: [0.45, 0.78] }] }] },
  { id: 'tpl_lab_comp', duration: 5, background: { assetId: 'bg_modern_lab' }, props: [{ assetId: 'vintage_computer' }], characters: [{ characterId: 'chibi_doc', position: [0.45, 0.78], actions: [{ type: 'press_button', targetId: 'vintage_computer', start: 0.5, end: 4.5 }] }] },
  { id: 'tpl_diagram', duration: 5, sceneType: 'diagram_explanation', background: { assetId: 'bg_modern_lab' }, diagram: { title: 'Xử lý thông tin', nodes: [{ id: 'a', label: 'INPUT', x: 0.3, y: 0.5, start: 0 }, { id: 'b', label: 'OUTPUT', x: 0.7, y: 0.5, start: 1.5 }], edges: [{ from: 'a', to: 'b', start: 0.8 }] }, characters: [] },
  { id: 'tpl_street_max', duration: 5, background: { assetId: 'bg_street' }, characters: [{ characterId: 'chibi_max', position: [0.45, 0.78], actions: [{ type: 'wave', start: 0.5, end: 4.5, expression: 'happy' }] }] },
];

const benchmarks = [];
for (const targetSec of [30, 60, 180, 300, 480]) {
  const count = targetSec / 5;
  const scenes = [];
  for (let i = 0; i < count; i++) {
    const tpl = chapterTemplates[i % chapterTemplates.length];
    scenes.push({ ...JSON.parse(JSON.stringify(tpl)), id: `long_${targetSec}_sc_${i + 1}` });
  }
  const plan = {
    schemaVersion: '5.2',
    project: { id: `p5e_long_${targetSec}s`, title: `Long Benchmark ${targetSec}s`, fps: 24, resolution: { width: 1280, height: 720 } },
    style: { profileId: 'educational_cartoon' },
    lighting: 'indoor_cool',
    scenes,
  };

  const tCompile0 = Date.now();
  const animRes = compileProjectAnimations(scenes, plan);
  const compileTimeMs = Date.now() - tCompile0;

  const tQa0 = Date.now();
  const qaRes = defaultQaEngine.runComprehensiveQA({ scenes, animations: animRes.scenes });
  const qaTimeMs = Date.now() - tQa0;
  assert.equal(qaRes.isValid, true);

  const outLong = path.join(OUT_DIR, `v52_p5e_long_${targetSec}s.mp4`);
  const rRes = await renderSegmentedProject(
    { id: `p5e_long_${targetSec}s`, scenePlan: plan, compiledScenes: scenes, animations: animRes.scenes },
    { cache: longCache, workDir: longWorkDir, outputPath: outLong, fps: 24, resolution: { width: 1280, height: 720 } }
  );
  assert.equal(rRes.success, true, `Benchmark ${targetSec}s failed`);
  const sizeMb = Number((fs.statSync(outLong).size / (1024 * 1024)).toFixed(2));
  benchmarks.push({
    targetSec,
    scenes: count,
    compileTimeMs,
    qaTimeMs,
    renderTimeMs: rRes.renderTimeMs,
    encodingTimeMs: rRes.encodingTimeMs,
    peakRssMb: rRes.peakRssMb,
    outputSizeMb: sizeMb,
    cacheHitRatePercent: rRes.cacheHitRatePercent,
    durationActual: rRes.verification.duration,
  });
}

await check('5F-6', 'Long Video Benchmarks (30s, 1m, 3m, 5m, 8m = 480s) all succeed & verify via ffprobe', () => {
  assert.equal(benchmarks.length, 5);
  const b480 = benchmarks[4];
  assert.ok(Math.abs(b480.durationActual - 480.0) < 0.5, `Expected ~480s, got ${b480.durationActual}`);
  console.table(benchmarks);
});

fs.writeFileSync(path.join(OUT_DIR, 'v52_p5e_benchmarks.json'), JSON.stringify(benchmarks, null, 2), 'utf8');
console.log(`\nPhase 5E/5F Acceptance Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

