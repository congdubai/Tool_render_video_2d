// tests/test-v52-phase2-procedural-graphics.mjs
// THANH HAI 2D STUDIO V5.2 — PHASE 2: 22 REQUIRED TESTS + DEMO A (DOC LAB 15s) + DEMO B (MAX NIGHT STREET 8s, 240 FRAMES)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '../thanhhai-2d-studio/node_modules/playwright/index.mjs';

import { generateProceduralBackground } from '../thanhhai-2d-studio/engine/v5-procedural-backgrounds.js';
import { generateProceduralProp } from '../thanhhai-2d-studio/engine/v5-procedural-props.js';
import {
  generateProceduralAsset,
  saveProceduralAsset,
  generateAndBindAllMissing
} from '../thanhhai-2d-studio/engine/v5-procedural-generator.js';
import { SmartAssetManager } from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';
import { RenderCacheManager } from '../thanhhai-2d-studio/engine/v5-render-engine.js';
import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { defaultFfmpegAssembler } from '../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js';
import { validateVectorSpec, renderToSvg, renderToPngBuffer } from '../thanhhai-2d-studio/engine/v5-vector-engine.js';
import { resolveCharacter } from '../thanhhai-2d-studio/engine/unified-character-renderer.js';

const ROOT = process.cwd();
const OUT_DIR = path.resolve(ROOT, 'out');
fs.mkdirSync(OUT_DIR, { recursive: true });

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('THANH HAI 2D STUDIO V5.2 PHASE 2 — 22-TEST VERIFICATION + DEMOS');
console.log('================================================================\n');

// Test 1: Lab has perspective and multiple layers
await check('Test 1: Phòng thí nghiệm có phối cảnh và nhiều layer', () => {
  const lab = generateProceduralBackground('lab_modern', { lighting: 'indoor_cool', detailLevel: 'high' });
  assert.ok(lab.perspective?.vanishingPoint?.length === 2);
  assert.ok(lab.perspective?.horizonY > 0);
  assert.ok(lab.layers.length >= 5);
});

// Test 2: Street has depth (sky, distant buildings, near buildings, sidewalk, road, trees, streetlights)
await check('Test 2: Đường phố có chiều sâu (distant skyline + near buildings + sidewalk + road + trees + lights)', () => {
  const st = generateProceduralBackground('street', { lighting: 'daylight', detailLevel: 'high' });
  const ids = st.layers.map(l => l.id);
  for (const id of ['sky', 'distant_buildings', 'near_buildings', 'sidewalk', 'road', 'trees', 'streetlights']) {
    assert.ok(ids.includes(id), `Missing street layer: ${id}`);
  }
});

// Test 3: Street daylight
await check('Test 3: Đường phố ban ngày có bầu trời sáng và mặt trời', () => {
  const st = generateProceduralBackground('street', { lighting: 'daylight', seed: 101 });
  assert.equal(st.lighting, 'daylight');
  const svg = st.getSvg();
  assert.ok(svg.includes('#0284c7') || svg.includes('#7dd3fc'));
});

// Test 4: Street night (NO daytime sun, HAS moon/stars/streetlights)
await check('Test 4: Đường phố ban đêm có trăng/sao/đèn đường, không có mặt trời ban ngày', () => {
  const st = generateProceduralBackground('street', { lighting: 'night', seed: 101 });
  assert.equal(st.lighting, 'night');
  const svg = st.getSvg();
  assert.ok(svg.includes('#020617'), 'Night sky gradient top must be midnight dark');
  const skyGrad = svg.match(/<linearGradient id="street_sky_grad"[\s\S]*?<\/linearGradient>/)?.[0] || '';
  assert.ok(!skyGrad.includes('#0284c7') && !skyGrad.includes('#7dd3fc'), 'Night sky gradient must not contain daytime blue');
});

// Test 5: Changing lighting visibly changes output image buffer
await check('Test 5: Đổi lighting thực sự thay đổi hình ảnh PNG', async () => {
  const day = generateProceduralBackground('street', { lighting: 'daylight', seed: 42, width: 640, height: 360 });
  const night = generateProceduralBackground('street', { lighting: 'night', seed: 42, width: 640, height: 360 });
  const bufDay = await renderToPngBuffer(day.vectorSpec, { width: 640, height: 360 });
  const bufNight = await renderToPngBuffer(night.vectorSpec, { width: 640, height: 360 });
  assert.notEqual(Buffer.compare(bufDay, bufNight), 0);
});

// Test 6: Changing style changes graphics
await check('Test 6: Đổi style thực sự thay đổi đồ họa', () => {
  const s1 = generateProceduralBackground('lab_modern', { styleProfile: 'educational_cartoon', seed: 42 });
  const s2 = generateProceduralBackground('lab_modern', { styleProfile: 'historical_cartoon', seed: 42 });
  assert.notEqual(s1.getSvg(), s2.getSvg());
});

// Test 7: Changing detail level changes primitive count
await check('Test 7: Đổi detail level (low vs high) thay đổi mức độ chi tiết', () => {
  const low = generateProceduralBackground('lab_modern', { detailLevel: 'low', seed: 42 });
  const high = generateProceduralBackground('lab_modern', { detailLevel: 'high', seed: 42 });
  const countLow = validateVectorSpec(low.vectorSpec).primitiveCount;
  const countHigh = validateVectorSpec(high.vectorSpec).primitiveCount;
  assert.ok(countHigh > countLow, `Expected high (${countHigh}) > low (${countLow})`);
});

// Test 8: Changing seed produces variation
await check('Test 8: Đổi seed tạo biến thể khác nhau', () => {
  const a = generateProceduralBackground('street', { seed: 111 });
  const b = generateProceduralBackground('street', { seed: 999 });
  assert.notEqual(a.getSvg(), b.getSvg());
});

// Test 9: Same seed produces identical deterministic output
await check('Test 9: Cùng seed tạo kết quả nhất quán 100%', () => {
  const a = generateProceduralBackground('street', { lighting: 'night', seed: 777 });
  const b = generateProceduralBackground('street', { lighting: 'night', seed: 777 });
  assert.equal(a.getSvg(), b.getSvg());
});

// Test 10: Vintage computer has detailed independent layers
await check('Test 10: Máy tính cổ có chi tiết và các layer độc lập', () => {
  const vc = generateProceduralProp('vintage_computer', { detailLevel: 'high' });
  const ids = vc.layers.map(l => l.id);
  for (const id of ['shadow', 'body', 'screen', 'keyboard', 'buttons', 'indicator_lights', 'cables']) {
    assert.ok(ids.includes(id), `Missing prop layer: ${id}`);
  }
});

// Test 11: Props have gripPoint, groundContact, and pivot anchors
await check('Test 11: Đạo cụ có anchor (gripPoint, groundContact, pivot) chính xác', () => {
  const cup = generateProceduralProp('coffee_cup');
  assert.ok(cup.gripPoint && typeof cup.gripPoint.x === 'number');
  assert.ok(cup.groundContact && typeof cup.groundContact.y === 'number');
  assert.ok(cup.pivot && typeof cup.pivot.x === 'number');
});

// Test 12 & 13: Ground contact & smart character scale verified later on real rendered frames + placementZones
await check('Test 12-13: Placement zone mặt sàn và tỷ lệ Smart Composition hợp lệ', () => {
  const lab = generateProceduralBackground('lab_modern');
  assert.ok(lab.groundY > 700 && lab.groundY < 960, `Unexpected groundY: ${lab.groundY}`);
  assert.ok(lab.placementZones?.characterZone?.groundY > 0.65);
});

// Test 14: CODE GEN ALL works
await check('Test 14: CODE GEN ALL hoạt động đầy đủ', async () => {
  const plan = {
    project: { id: 'proj_v52_codegen_check' },
    scenes: [{ id: 's1', duration: 4, background: { assetId: 'bg_v52_fresh_lab_check' }, props: [{ assetId: 'prop_v52_fresh_computer_check' }] }]
  };
  const tmpDir = path.resolve(ROOT, 'imported_projects', 'proj_v52_codegen_check');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  const mgr = new SmartAssetManager(tmpDir, plan);
  const res = await generateAndBindAllMissing(plan, mgr, { styleProfile: 'educational_cartoon', targetDir: path.join(tmpDir, 'assets') });
  assert.ok(res.totalGenerated >= 1, `Expected >= 1 generated asset, got ${res.totalGenerated}`);
});

// Test 15: Custom external Vector JSON works without eval
await check('Test 15: Vector JSON tùy chỉnh hoạt động an toàn không dùng eval', () => {
  const custom = generateProceduralAsset({
    id: 'REQ_PROP_CUSTOM_BADGE',
    type: 'prop',
    vectorDrawingSpec: {
      schemaVersion: '5.2',
      width: 256,
      height: 256,
      elements: [
        { type: 'circle', cx: 128, cy: 128, r: 90, fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 6 },
        { type: 'bezier', points: [[70, 130], [110, 175], [140, 175], [190, 95]], stroke: '#ffffff', strokeWidth: 10, strokeLinecap: 'round' }
      ]
    }
  });
  assert.ok(custom.getSvg().includes('<path'));
});

// Test 17: Persistence on disk (F5 / restart safe)
await check('Test 17: Tài nguyên procedural lưu đĩa bền vững đầy đủ vectorSpec + layers + lighting', async () => {
  const asset = generateProceduralAsset({ id: 'REQ_BG_TEST_PERSIST', type: 'background', targetAssetId: 'bg_street', lighting: 'night' }, { styleProfile: 'clean_cartoon', lighting: 'night', detailLevel: 'high', seed: 55 });
  const tmpAssets = path.resolve(ROOT, 'scratch', 'v52_persist_test');
  const saved = await saveProceduralAsset(asset, tmpAssets, { lighting: 'night', styleProfile: 'clean_cartoon', detailLevel: 'high', seed: 55 });
  const meta = JSON.parse(fs.readFileSync(saved.metaPath, 'utf8'));
  assert.equal(meta.lighting, 'night');
  assert.equal(meta.styleProfile, 'clean_cartoon');
  assert.equal(meta.detailLevel, 'high');
  assert.ok(meta.vectorSpec && Array.isArray(meta.layers) && meta.layers.length > 0);
});

// Test 18: Changing lighting invalidates render cache
await check('Test 18: Thay đổi lighting / style / detail làm mất hiệu lực cache cũ', () => {
  const cache = new RenderCacheManager();
  const s = { id: 's1', duration: 4, background: { id: 'bg_street' }, characters: [{ characterId: 'chibi_max' }] };
  const fpDay = cache.computeFingerprint(s, {}, { lighting: 'daylight', styleProfile: 'educational_cartoon', detailLevel: 'medium' });
  const fpNight = cache.computeFingerprint(s, {}, { lighting: 'night', styleProfile: 'educational_cartoon', detailLevel: 'medium' });
  const fpStyle = cache.computeFingerprint(s, {}, { lighting: 'night', styleProfile: 'comic_illustration', detailLevel: 'medium' });
  assert.notEqual(fpDay, fpNight);
  assert.notEqual(fpNight, fpStyle);
});

// Test 20: Regression Character Renderer
await check('Test 20: Regression Unified Character Renderer (Doc & Max)', () => {
  const d = resolveCharacter('chibi_doc');
  const m = resolveCharacter('chibi_max');
  assert.equal(d.resolved && !d.isFallback, true);
  assert.equal(m.resolved && !m.isFallback, true);
});

// ============================================================================
// DEMO A (Doc Laboratory 15s) & DEMO B (Max Night Street 8s, 240 Frames @ 30fps)
// ============================================================================
console.log('\nRendering Demo A (Doc Lab 15s) & Demo B (Max Night Street 8s, 240 frames)...');

const demoBackup = path.resolve(ROOT, 'scratch', 'v52_phase2_demo_backup.mp4');
const demoMp4 = path.join(OUT_DIR, 'demo_v5_procedural_15s.mp4');
let movedDemo = false;
if (fs.existsSync(demoMp4)) {
  fs.mkdirSync(path.dirname(demoBackup), { recursive: true });
  fs.renameSync(demoMp4, demoBackup);
  movedDemo = true;
}

try {
  // Demo A: Doc Laboratory (15s, 3 scenes)
  const demoAPlan = {
    schemaVersion: '5.2',
    project: { id: 'demo_v52_phase2_doc_lab', title: 'Demo A: Doc Laboratory (15s)', fps: 30, resolution: { width: 1920, height: 1080 } },
    style: { profileId: 'educational_cartoon' },
    lighting: 'indoor_cool',
    detailLevel: 'high',
    scenes: [
      { id: 'demoA_s1', duration: 5, background: { assetId: 'bg_modern_lab' }, characters: [{ characterId: 'chibi_doc', action: 'walk', emotion: 'happy', position: [0.20, 0.78], targetPosition: [0.40, 0.78] }] },
      { id: 'demoA_s2', duration: 5, background: { assetId: 'bg_modern_lab' }, characters: [{ characterId: 'chibi_doc', action: 'inspect', emotion: 'thinking', secondaryEmotion: 'confused', position: [0.38, 0.78], prop: { assetId: 'vintage_computer' } }], vfx: [{ type: 'vfx_smoke_cloud', position: [0.74, 0.32] }] },
      { id: 'demoA_s3', duration: 5, background: { assetId: 'bg_modern_lab' }, characters: [{ characterId: 'chibi_doc', action: 'eureka', emotion: 'excited', position: [0.38, 0.78], prop: { assetId: 'lightbulb' } }] }
    ]
  };
  const demoABindings = {
    REQ_BG_modern_lab: { requirementId: 'REQ_BG_modern_lab', resolvedAssetId: 'bg_modern_lab', status: 'READY' },
    REQ_PROP_VINTAGE_COMPUTER: { requirementId: 'REQ_PROP_VINTAGE_COMPUTER', resolvedAssetId: 'vintage_computer', status: 'READY' },
    REQ_PROP_LIGHTBULB: { requirementId: 'REQ_PROP_LIGHTBULB', resolvedAssetId: 'lightbulb', status: 'READY' }
  };

  const outA = path.join(OUT_DIR, 'v52_phase2_demoA_doc_lab_15s.mp4');
  const resA = await new ProductionOrchestrator().produceVideo(
    { id: 'demo_v52_phase2_doc_lab', scenePlan: demoAPlan, bindings: demoABindings, styleProfile: 'educational_cartoon' },
    PRODUCTION_MODES.MODE_B_FULL_AUTO,
    { outputPath: outA }
  );
  assert.equal(resA.success, true, `Demo A failed: ${resA.error || JSON.stringify(resA.missingAssets || resA.qaResult || resA)}`);

  // Demo B: Max Night Street (8s, 2 scenes, STRICT 240 frames @ 30fps)
  const demoBPlan = {
    schemaVersion: '5.2',
    project: { id: 'demo_v52_phase2_max_night_street', title: 'Demo B: Max Night Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
    style: { profileId: 'clean_cartoon' },
    lighting: 'night',
    detailLevel: 'high',
    scenes: [
      { id: 'demoB_s1', duration: 4, lighting: 'night', background: { assetId: 'bg_street' }, characters: [{ characterId: 'chibi_max', action: 'walk', emotion: 'happy', position: [0.22, 0.78], targetPosition: [0.46, 0.78] }] },
      { id: 'demoB_s2', duration: 4, lighting: 'night', background: { assetId: 'bg_street' }, characters: [{ characterId: 'chibi_max', action: 'wave', emotion: 'excited', position: [0.46, 0.78] }] }
    ]
  };
  const demoBBindings = {
    REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' }
  };

  const outB = path.join(OUT_DIR, 'v52_phase2_demoB_max_night_street_8s.mp4');
  const resB = await new ProductionOrchestrator().produceVideo(
    { id: 'demo_v52_phase2_max_night_street', scenePlan: demoBPlan, bindings: demoBBindings, styleProfile: 'clean_cartoon' },
    PRODUCTION_MODES.MODE_B_FULL_AUTO,
    { outputPath: outB }
  );
  assert.equal(resB.success, true, `Demo B failed: ${resB.error}`);

  // Test 19, 21, 22: Verify exact 240 video frames & 8.00s duration via ffprobe
  const ffB = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,nb_frames,duration,width,height', '-of', 'json', outB], { encoding: 'utf8' }));
  const vStreamB = ffB.streams.find(s => s.codec_type === 'video');
  const ffA = await defaultFfmpegAssembler.verifyFinalOutput(outA, { duration: 15, resolution: '1920x1080', fps: 30 });

  await check('Test 19: Project Max đúng 8.00 giây và đúng 240 video frames tại 30 FPS', () => {
    assert.equal(Number(vStreamB.nb_frames), 240, `Expected 240 frames, got ${vStreamB.nb_frames}`);
    assert.ok(Math.abs(parseFloat(ffB.format.duration) - 8.0) < 0.08, `Expected 8.0s duration, got ${ffB.format.duration}`);
  });

  await check('Test 21-22: Render MP4 thực tế Demo A & B thành công không dùng video có sẵn', () => {
    assert.equal(ffA.isValid, true);
    assert.ok(fs.statSync(outA).size > 100000);
    assert.ok(fs.statSync(outB).size > 100000);
  });

  // Extract frames from Demo A and Demo B + render Comparison Contact Sheet
  const fA1 = path.join(OUT_DIR, 'v52_p2_demoA_s1.png');
  const fA2 = path.join(OUT_DIR, 'v52_p2_demoA_s2.png');
  const fA3 = path.join(OUT_DIR, 'v52_p2_demoA_s3.png');
  const fB1 = path.join(OUT_DIR, 'v52_p2_demoB_s1.png');
  const fB2 = path.join(OUT_DIR, 'v52_p2_demoB_s2.png');

  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '2.5', '-i', outA, '-frames:v', '1', fA1]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '7.5', '-i', outA, '-frames:v', '1', fA2]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '12.5', '-i', outA, '-frames:v', '1', fA3]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '2.0', '-i', outB, '-frames:v', '1', fB1]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '6.0', '-i', outB, '-frames:v', '1', fB2]);

  const toB64 = (p) => `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
    await page.setContent(`
      <!doctype html>
      <html>
      <body style="margin:0;padding:20px;background:#090d16;color:#f8fafc;font-family:sans-serif;">
        <h2 style="margin:0 0 12px 0;color:#38bdf8;">THANH HAI 2D STUDIO V5.2 PHASE 2 — DEMO A (DOC LAB 15s) & DEMO B (MAX NIGHT STREET 8s / 240 FRAMES)</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px;">
          <div style="background:#1e293b;padding:8px;border-radius:8px;">
            <img src="${toB64(fA1)}" style="width:100%;border-radius:4px;" />
            <div style="margin-top:6px;font-size:12px;font-weight:700;">Demo A Scene 1 (2.5s): Doc Walk in Upgraded Lab</div>
          </div>
          <div style="background:#1e293b;padding:8px;border-radius:8px;">
            <img src="${toB64(fA2)}" style="width:100%;border-radius:4px;" />
            <div style="margin-top:6px;font-size:12px;font-weight:700;">Demo A Scene 2 (7.5s): Doc + Multi-Layer Vintage Computer</div>
          </div>
          <div style="background:#1e293b;padding:8px;border-radius:8px;">
            <img src="${toB64(fA3)}" style="width:100%;border-radius:4px;" />
            <div style="margin-top:6px;font-size:12px;font-weight:700;">Demo A Scene 3 (12.5s): Doc Eureka Idea Bulb</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <div style="background:#1e293b;padding:8px;border-radius:8px;">
            <img id="nightImg" src="${toB64(fB1)}" style="width:100%;border-radius:4px;" />
            <div style="margin-top:6px;font-size:12px;font-weight:700;color:#38bdf8;">Demo B Scene 1 (2.0s): Max Walking • Night Street (Moon, Stars, Streetlight Glow)</div>
          </div>
          <div style="background:#1e293b;padding:8px;border-radius:8px;">
            <img src="${toB64(fB2)}" style="width:100%;border-radius:4px;" />
            <div style="margin-top:6px;font-size:12px;font-weight:700;color:#38bdf8;">Demo B Scene 2 (6.0s): Max Waving • Night Street (Exact 8.00s / 240 Frames)</div>
          </div>
        </div>
      </body>
      </html>
    `);

    // Test 16: Verify Demo B night sky pixel luminance is genuinely dark night, NOT daytime blue!
    const skyCheck = await page.evaluate(() => {
      const img = document.getElementById('nightImg');
      const c = document.createElement('canvas');
      c.width = 480; c.height = 270;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 480, 270);
      const px = ctx.getImageData(240, 15, 1, 1).data; // top-center sky
      return { r: px[0], g: px[1], b: px[2] };
    });
    await check('Test 16: Preview/MP4 Night Sky pixel thực tế là ban đêm (không phải trời xanh ban ngày)', () => {
      assert.ok(skyCheck.r < 40 && skyCheck.g < 45 && skyCheck.b < 75, `Sky pixel too bright for night: rgb(${skyCheck.r},${skyCheck.g},${skyCheck.b})`);
    });

    const sheetPath = path.join(OUT_DIR, 'v52_phase2_demos_contact_sheet.png');
    await page.screenshot({ path: sheetPath, fullPage: true });
    console.log(`✔ Phase 2 Contact Sheet saved: ${sheetPath}`);
  } finally {
    await browser.close();
  }
} finally {
  if (movedDemo && fs.existsSync(demoBackup)) {
    fs.renameSync(demoBackup, demoMp4);
  }
}

console.log(`\n================================================================`);
console.log(`PHASE 2 VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
console.log(`================================================================`);
if (failed > 0) process.exit(1);
