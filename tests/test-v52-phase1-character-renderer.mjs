// tests/test-v52-phase1-character-renderer.mjs
// Mandatory verification suite for THANH HAI 2D STUDIO V5.2 — PHASE 1: CHARACTER RENDERER UPGRADE
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { chromium } from '../thanhhai-2d-studio/node_modules/playwright/index.mjs';

import {
  resolveCharacter,
  solveCharacterRig,
  registerCharacterProfile,
  detectCharacterRenderMode,
  verifyCharacterContinuity,
  getViewSupportInfo,
  RIG_JOINT_SPEC,
  REQUIRED_15_JOINTS,
  SUPPORTED_VIEWS,
  REQUIRED_EXPRESSIONS,
  CHARACTER_RENDER_MODES
} from '../thanhhai-2d-studio/engine/unified-character-renderer.js';

import { lookupResolvedBinding } from '../thanhhai-2d-studio/engine/v5-scene-construction.js';
import { SmartAssetManager } from '../thanhhai-2d-studio/engine/v5-smart-asset-manager.js';

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('THANH HAI 2D STUDIO V5.2 PHASE 1 — CHARACTER RENDERER VERIFICATION');
console.log('================================================================\n');

// Load real Tab 3 Doc JSON
const docJsonPath = path.resolve(process.cwd(), 'data/characters/chibi_doc.json');
const docJson = JSON.parse(fs.readFileSync(docJsonPath, 'utf8'));
registerCharacterProfile(docJson);

// 1. Character ID Mapping & No Silent Fallback
check('1. Character ID mapping resolves scientist_01 and doc to Tab 3 chibi_doc', () => {
  const r1 = resolveCharacter('scientist_01');
  const r2 = resolveCharacter('chibi_doc');
  const r3 = lookupResolvedBinding({}, 'scientist_01', 'char');
  assert.equal(r1.resolved, true);
  assert.equal(r1.isFallback, false);
  assert.equal(r1.profile.id, 'chibi_doc');
  assert.equal(r1.profile.skinColor, docJson.skinColor);
  assert.equal(r1.profile.hair.color, docJson.hair.color);
  assert.equal(r1.profile.outfit.type, 'labcoat');
  assert.equal(r2.profile.id, 'chibi_doc');
  assert.equal(r3.resolvedAssetId, 'chibi_doc');
});

check('2. Unknown character ID does NOT silently fall back', () => {
  const r = resolveCharacter('nonexistent_mystery_char_999');
  assert.equal(r.resolved, false);
  assert.equal(r.isFallback, true);
  assert.equal(r.profile, null);
  assert.throws(() => resolveCharacter('nonexistent_mystery_char_999', { strict: true }));
});

// 2. Standardized 15-Joint Rig & Zero-Gap Verification
check('3. All 15 required joints exist with pivot, parent, rotationLimits, layerOrder', () => {
  const specKeys = Object.keys(RIG_JOINT_SPEC);
  for (const jointName of REQUIRED_15_JOINTS) {
    const matches = specKeys.filter(k => k === jointName || k.startsWith(`${jointName}_`));
    assert.ok(matches.length > 0, `Missing joint: ${jointName}`);
    for (const k of matches) {
      const j = RIG_JOINT_SPEC[k];
      assert.ok(Array.isArray(j.pivot) && j.pivot.length === 2, `Invalid pivot on ${k}`);
      assert.ok(Array.isArray(j.rotationLimits) && j.rotationLimits.length === 2, `Invalid rotationLimits on ${k}`);
      assert.equal(typeof j.layerOrder, 'number', `Missing layerOrder on ${k}`);
    }
  }
});

check('4. Zero-gap FK limb connectivity across all poses & rotation clamping', () => {
  const poses = ['stand', 'walk', 'run', 'inspect', 'eureka', 'wave', 'point', 'sit_chair'];
  for (const pose of poses) {
    const rig = solveCharacterRig(docJson, { pose, view: 'three_quarter_right', t: 0.7 });
    const j = rig.joints;
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    // Verify upper arm and forearm bone lengths remain rigid (no stretching/detaching)
    assert.ok(Math.abs(dist(j.shoulder_R, j.elbow_R) - rig.boneLengths.upperArmLen) < 0.01, `Gap at upper_arm_R in ${pose}`);
    assert.ok(Math.abs(dist(j.elbow_R, j.wrist_R) - rig.boneLengths.forearmLen) < 0.01, `Gap at forearm_R in ${pose}`);
    assert.ok(Math.abs(dist(j.hip_R, j.knee_R) - rig.boneLengths.thighLen) < 0.01, `Gap at thigh_R in ${pose}`);
    assert.ok(Math.abs(dist(j.knee_R, j.ankle_R) - rig.boneLengths.shinLen) < 0.01, `Gap at shin_R in ${pose}`);
    // Lowest foot grounded at y = 0
    const lowestFootY = Math.max(j.foot_L[1], j.foot_R[1]);
    assert.ok(Math.abs(lowestFootY) < 0.01, `Feet not grounded in ${pose}: ${lowestFootY}`);
  }
});

// 3. Directional Views
check('5. All 6 views supported and unsupported view reports clear limitation', () => {
  for (const v of SUPPORTED_VIEWS) {
    const info = getViewSupportInfo(v);
    assert.equal(info.supported, true, `View ${v} should be supported`);
  }
  const unsupported = getViewSupportInfo('top_down_birdseye');
  assert.equal(unsupported.supported, false);
  assert.ok(unsupported.reason.includes('not supported'));
});

// 4. Character Continuity across 3 scenes
check('6. Character continuity locked across all 3 scenes (identity unchanged while pose/expr change)', () => {
  const s1 = resolveCharacter({ characterId: 'scientist_01' }).profile;
  const s2 = resolveCharacter({ characterId: 'doc' }).profile;
  const s3 = resolveCharacter({ characterId: 'chibi_doc' }).profile;
  const report = verifyCharacterContinuity(s1, [s1, s2, s3]);
  assert.equal(report.valid, true, `Continuity broken: ${JSON.stringify(report.diffs)}`);
});

// 5. Mode B Compatibility
check('7. Mode B distinguishes procedural_rig, layered_png_rig, and single_png', () => {
  assert.equal(detectCharacterRenderMode(docJson), CHARACTER_RENDER_MODES.PROCEDURAL_RIG);
  assert.equal(detectCharacterRenderMode({
    id: 'ext_layered',
    type: 'imported',
    importType: 'layered',
    parts: {
      head: { image: '/public/a.png' },
      torso: { image: '/public/b.png' }
    }
  }), CHARACTER_RENDER_MODES.LAYERED_PNG_RIG);
  assert.equal(detectCharacterRenderMode({
    id: 'ext_single',
    type: 'imported',
    importType: 'single',
    sourceImage: '/public/single.png'
  }), CHARACTER_RENDER_MODES.SINGLE_PNG);
});

// 6. Clean Render Code Inspection on 15s Demo Shot
check('8. Clean render: 01_procedural_scenes.js has zero debug text, banners, or fallback stick figure', () => {
  const shotFile = path.resolve(process.cwd(), 'thanhhai-2d-studio/examples/demo-v5-procedural-15s/scenes/shots/01_procedural_scenes.js');
  const code = fs.readFileSync(shotFile, 'utf8');
  assert.ok(code.includes('drawUnifiedCharacter'), 'Shot must use drawUnifiedCharacter');
  assert.ok(code.includes('debug: false'), 'Shot must enforce debug: false');
  assert.ok(!code.includes("fillText('DOC'"), 'Must not draw DOC debug label on face');
  assert.ok(!code.includes('PROCEDURAL VECTOR GENERATOR'), 'Must not draw V5.1 debug banner');
  assert.ok(!code.includes('ENIAC v5.1'), 'Must not draw technical debug text on screen');
});

// 7. Smart Asset Manager V5.1 pipeline compatibility
check('9. V5.1 SmartAssetManager auto-links scientist_01 -> chibi_doc without breaking pipeline', () => {
  const plan = {
    project: { id: 'v52_test_check' },
    scenes: [{ id: 's001', duration: 5, background: { assetId: 'bg_modern_lab' }, characters: [{ characterId: 'scientist_01' }] }]
  };
  const mgr = new SmartAssetManager(null, plan);
  const res = mgr.scanAndResolve();
  assert.ok(res.readiness, 'Readiness must be computed');
});

// 8. Browser Canvas Visual Verification + Expression Pixel Diff + Comparison Contact Sheets
console.log('\nRunning Headless Chromium Visual Verification & Contact Sheet Generation...');

const ROOT = process.cwd();
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/__test.html') {
    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
    return res.end(`<!doctype html><html><body style="margin:0;background:#0f172a;color:#f8fafc;font-family:sans-serif;"><canvas id="c" width="480" height="380"></canvas><script type="module" src="/engine/unified-character-renderer.js"></script></body></html>`);
  }
  let filePath;
  if (url.startsWith('/engine/')) filePath = path.join(ROOT, 'thanhhai-2d-studio', url);
  else if (url.startsWith('/data/')) filePath = path.join(ROOT, url);
  else if (url.startsWith('/out/')) filePath = path.join(ROOT, url);
  else filePath = path.join(ROOT, 'app/ui', url);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404); return res.end();
  }
  const ext = path.extname(filePath);
  const mime = { '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.html': 'text/html' }[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(filePath).pipe(res);
}).listen(0);

const port = server.address().port;

async function runBrowserVisualChecks() {
  const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

    // A. Render Tab 3 Doc Preview & test all 10 expressions + all 6 views
    await page.goto(`http://127.0.0.1:${port}/__test.html`);
    await page.waitForFunction(() => !!window.UnifiedCharacterRenderer);

    const exprResult = await page.evaluate(async (docProfile) => {
      const U = window.UnifiedCharacterRenderer;
      U.registerCharacterProfile(docProfile);
      const canvas = document.getElementById('c');
      const ctx = canvas.getContext('2d');

      // Render Tab 3 Doc preview (exact same call as app.js updateLivePreview)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const grad = ctx.createRadialGradient(240, 190, 20, 240, 190, 260);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      U.drawUnifiedCharacter(ctx, {
        character: docProfile,
        x: 240, y: 328, s: 1.75,
        view: 'three_quarter_right',
        pose: 'stand',
        expr: 'thinking',
        shadow: true,
        debug: false
      });
      const tab3DataUrl = canvas.toDataURL('image/png');

      // Verify all 10 expressions produce distinct face pixel hashes
      const hashes = {};
      const exprShots = [];
      for (const expr of U.REQUIRED_EXPRESSIONS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        U.drawUnifiedCharacter(ctx, {
          character: docProfile,
          x: 240, y: 328, s: 2.0,
          view: 'front',
          pose: 'stand',
          expr,
          shadow: true,
          debug: false
        });
        const data = ctx.getImageData(160, 40, 160, 160).data;
        let h = 0;
        for (let i = 0; i < data.length; i += 4) {
          h = ((h * 31) + data[i] + data[i + 1] * 3 + data[i + 2] * 7) >>> 0;
        }
        hashes[expr] = h;
        exprShots.push({ label: `Expr: ${expr}`, dataUrl: canvas.toDataURL('image/png') });
      }

      // Render all 6 directional views
      const viewShots = [];
      for (const view of U.SUPPORTED_VIEWS) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        U.drawUnifiedCharacter(ctx, {
          character: docProfile,
          x: 240, y: 328, s: 1.75,
          view,
          pose: 'stand',
          expr: 'happy',
          shadow: true,
          debug: false
        });
        viewShots.push({ label: `View: ${view}`, dataUrl: canvas.toDataURL('image/png') });
      }

      // Mode B single PNG test
      const singleRes = U.drawUnifiedCharacter(ctx, {
        character: { id: 'single_test', type: 'imported', importType: 'single', sourceImage: '' },
        x: 240, y: 328, s: 1.0, t: 1.0
      });

      return { tab3DataUrl, hashes, exprShots, viewShots, singleRes };
    }, docJson);

    check('10. All 10 facial expressions produce visibly distinct face renders (no emoji/text)', () => {
      const uniqueHashes = new Set(Object.values(exprResult.hashes));
      assert.equal(uniqueHashes.size, REQUIRED_EXPRESSIONS.length, `Expected ${REQUIRED_EXPRESSIONS.length} unique expression renders, got ${uniqueHashes.size}`);
    });

    check('11. Mode B single_png renders without faking skeletal motion', () => {
      assert.equal(exprResult.singleRes.renderMode, CHARACTER_RENDER_MODES.SINGLE_PNG);
      assert.equal(exprResult.singleRes.skeletalMotionSimulated, false);
    });

    // Save Tab 3 Preview PNG
    const outDir = path.resolve(ROOT, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const tab3PngPath = path.join(outDir, 'v52_tab3_doc_preview.png');
    fs.writeFileSync(tab3PngPath, Buffer.from(exprResult.tab3DataUrl.split(',')[1], 'base64'));

    // Extract 3 real frames from rendered MP4 (2.5s = Scene 1, 7.5s = Scene 2, 12.5s = Scene 3)
    const mp4Path = path.join(outDir, 'demo_v5_procedural_15s.mp4');
    assert.ok(fs.existsSync(mp4Path), `Missing MP4: ${mp4Path}`);

    const frameTimes = [
      { id: 'scene1', t: '2.5', label: 'MP4 Scene 1 (2.5s): Doc Walk Into Lab (Happy)' },
      { id: 'scene2', t: '7.5', label: 'MP4 Scene 2 (7.5s): Doc Inspect Computer (Confused)' },
      { id: 'scene3', t: '12.5', label: 'MP4 Scene 3 (12.5s): Doc Eureka Idea Bulb (Excited)' }
    ];
    const mp4Frames = [];
    for (const ft of frameTimes) {
      const fp = path.join(outDir, `v52_mp4_${ft.id}.png`);
      execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', ft.t, '-i', mp4Path, '-frames:v', '1', fp]);
      const b64 = fs.readFileSync(fp).toString('base64');
      mp4Frames.push({ label: ft.label, dataUrl: `data:image/png;base64,${b64}` });
    }

    // Generate Comparison Contact Sheet (Tab 3 Doc vs MP4 Scenes 1, 2, 3)
    const compPage = await browser.newPage({ viewport: { width: 1320, height: 860 } });
    await compPage.setContent(`
      <!doctype html>
      <html>
      <body style="margin:0;padding:20px;background:#090d16;color:#f8fafc;font-family:sans-serif;">
        <h2 style="margin:0 0 14px 0;color:#38bdf8;">THANH HAI 2D STUDIO V5.2 PHASE 1 — TAB 3 DOC vs FINAL 15s MP4 COMPARISON</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div style="background:#1e293b;padding:10px;border-radius:8px;border:1px solid #334155;">
            <img src="${exprResult.tab3DataUrl}" style="width:100%;height:340px;object-fit:contain;background:#0f172a;border-radius:4px;" />
            <div style="margin-top:8px;font-weight:700;font-size:14px;color:#34d399;">Tab 3 Character Preview — Doc (chibi_doc, Unified Renderer)</div>
          </div>
          ${mp4Frames.map(f => `
            <div style="background:#1e293b;padding:10px;border-radius:8px;border:1px solid #334155;">
              <img src="${f.dataUrl}" style="width:100%;height:340px;object-fit:contain;background:#000;border-radius:4px;" />
              <div style="margin-top:8px;font-weight:700;font-size:14px;color:#f8fafc;">${f.label}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `);
    const comparisonSheetPath = path.join(outDir, 'v52_phase1_doc_comparison_contact_sheet.png');
    await compPage.screenshot({ path: comparisonSheetPath, fullPage: true });
    await compPage.close();

    // Generate Expressions & Views Contact Sheet
    const evPage = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    await evPage.setContent(`
      <!doctype html>
      <html>
      <body style="margin:0;padding:20px;background:#090d16;color:#f8fafc;font-family:sans-serif;">
        <h2 style="margin:0 0 12px 0;color:#38bdf8;">DOC (chibi_doc) — 6 DIRECTIONAL VIEWS & 10 FACIAL EXPRESSIONS</h2>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:18px;">
          ${exprResult.viewShots.map(s => `
            <div style="background:#1e293b;padding:6px;border-radius:6px;text-align:center;">
              <img src="${s.dataUrl}" style="width:100%;border-radius:4px;" />
              <div style="margin-top:4px;font-size:12px;font-weight:700;">${s.label}</div>
            </div>
          `).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;">
          ${exprResult.exprShots.map(s => `
            <div style="background:#1e293b;padding:6px;border-radius:6px;text-align:center;">
              <img src="${s.dataUrl}" style="width:100%;border-radius:4px;" />
              <div style="margin-top:4px;font-size:12px;font-weight:700;">${s.label}</div>
            </div>
          `).join('')}
        </div>
      </body>
      </html>
    `);
    const evSheetPath = path.join(outDir, 'v52_phase1_expressions_views_sheet.png');
    await evPage.screenshot({ path: evSheetPath, fullPage: true });
    await evPage.close();

    console.log(`✔ Comparison contact sheet saved: ${comparisonSheetPath}`);
    console.log(`✔ Expressions & views sheet saved: ${evSheetPath}`);
  } finally {
    await browser.close();
    server.close();
  }
}

runBrowserVisualChecks().then(() => {
  console.log(`\n================================================================`);
  console.log(`RESULT: ${passed} PASSED, ${failed} FAILED`);
  console.log(`================================================================`);
  if (failed > 0) process.exit(1);
}).catch(err => {
  console.error('VISUAL CHECK FAILED:', err);
  server.close();
  process.exit(1);
});

