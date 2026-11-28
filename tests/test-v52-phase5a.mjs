import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  PRODUCTION_STATES,
  PRODUCTION_MODES,
  ProductionOrchestrator,
} from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { resolveAssetRequirements, SmartAssetManager } from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';

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

await check('5A-1: Production State Machine includes all 18 required states', () => {
  const reqStates = [
    'IDLE', 'VALIDATING', 'RESOLVING_ASSETS', 'GENERATING_ASSETS', 'WAITING_FOR_ASSETS',
    'BUILDING_SCENES', 'COMPILING_ANIMATION', 'COMPILING_CAMERA', 'CHECKING_QUALITY',
    'REPAIRING', 'READY_TO_RENDER', 'RENDERING', 'ENCODING', 'VERIFYING_OUTPUT',
    'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED',
  ];
  for (const s of reqStates) {
    assert.ok(PRODUCTION_STATES[s], `Missing state: ${s}`);
  }
});

const basicPlan15s = {
  schemaVersion: '5.2',
  project: { id: 'p5a_demo_15s_doc_lab', title: 'Phase 5A Demo: Doc Lab (15s)', fps: 30, resolution: { width: 1920, height: 1080 } },
  style: { profileId: 'educational_cartoon' },
  lighting: 'indoor_cool',
  detailLevel: 'high',
  scenes: [
    {
      id: 'p5a_s1', duration: 5, background: { assetId: 'bg_modern_lab' },
      characters: [{ characterId: 'chibi_doc', position: [0.22, 0.78], actions: [{ type: 'walk', start: 0, end: 4, to: [0.42, 0.78], decelerate: true }] }],
    },
    {
      id: 'p5a_s2', duration: 5, background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'vintage_computer' }],
      characters: [{ characterId: 'chibi_doc', position: [0.42, 0.78], actions: [{ type: 'press_button', targetId: 'vintage_computer', start: 0.5, end: 4.5 }] }],
    },
    {
      id: 'p5a_s3', duration: 5, background: { assetId: 'bg_modern_lab' },
      props: [{ assetId: 'lightbulb' }],
      characters: [{ characterId: 'chibi_doc', position: [0.42, 0.78], actions: [{ type: 'idea_discovery', start: 0, end: 3 }, { type: 'wave', start: 3, end: 5, expression: 'happy' }] }],
    },
  ],
};

await check('5A-2: Single Source of Truth — SmartAssetManager & resolveAssetRequirements agree 100%', () => {
  const mgr = new SmartAssetManager('p5a_demo_15s_doc_lab', basicPlan15s);
  const scanRes = mgr.scanAndResolve();
  const resReq = resolveAssetRequirements(basicPlan15s, { projectId: 'p5a_demo_15s_doc_lab', bindings: scanRes.bindings });
  assert.equal(resReq.missingAssets.length, scanRes.readiness.counts.missingAssetCount, 'Missing asset count must match readiness 1:1');
  assert.equal(resReq.success, resReq.missingAssets.length === 0);
});

const out15s = path.join(OUT_DIR, 'v52_p5a_demo_doc_lab_15s.mp4');
console.log('\nRendering Phase 5A Demo (15s / 450 frames @ 30fps)...');
const orch = new ProductionOrchestrator();
const res15s = await orch.produceVideo(
  {
    id: 'p5a_demo_15s_doc_lab',
    scenePlan: basicPlan15s,
    bindings: {
      REQ_BG_modern_lab: { requirementId: 'REQ_BG_modern_lab', resolvedAssetId: 'bg_modern_lab', status: 'READY' },
      REQ_PROP_VINTAGE_COMPUTER: { requirementId: 'REQ_PROP_VINTAGE_COMPUTER', resolvedAssetId: 'vintage_computer', status: 'READY' },
      REQ_PROP_LIGHTBULB: { requirementId: 'REQ_PROP_LIGHTBULB', resolvedAssetId: 'lightbulb', status: 'READY' },
    },
    styleProfile: 'educational_cartoon',
  },
  PRODUCTION_MODES.MODE_B_FULL_AUTO,
  { outputPath: out15s }
);

await check('5A-3: Demo 15s reaches COMPLETED with exact 450 frames @ 30fps', () => {
  assert.equal(res15s.success, true, res15s.error || JSON.stringify(res15s));
  assert.equal(orch.state, PRODUCTION_STATES.COMPLETED);
  const ff = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames', '-of', 'json', out15s], { encoding: 'utf8' }));
  const vs = ff.streams.find(s => s.codec_type === 'video');
  assert.equal(Number(vs.nb_frames), 450);
  assert.ok(Math.abs(parseFloat(ff.format.duration) - 15.0) < 0.08);
});

console.log(`\nPhase 5A Summary: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

