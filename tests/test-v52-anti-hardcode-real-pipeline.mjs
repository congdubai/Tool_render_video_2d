// tests/test-v52-anti-hardcode-real-pipeline.mjs
// THANH HAI 2D STUDIO V5.2 — TASK 4: ANTI-HARDCODE REAL RENDER PIPELINE E2E VERIFICATION
// Proves:
// 1. Production pipeline renders real MP4s even when out/demo_v5_procedural_15s.mp4 is REMOVED.
// 2. Project A (Doc, Lab, 15s) and Project B (Max, Street, 8s) produce genuinely different videos.
// 3. Editing Max's hair color in Character Library (#4a3728 -> #ef4444) and re-rendering Project B
//    visibly changes the rendered video frames (zero stale cache / zero hardcoded preset).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '../thanhhai-2d-studio/node_modules/playwright/index.mjs';

import { ProductionOrchestrator, PRODUCTION_MODES } from '../thanhhai-2d-studio/engine/v5-production-orchestrator.js';
import { defaultFfmpegAssembler } from '../thanhhai-2d-studio/engine/v5-ffmpeg-assembler.js';
import { getCharacter, saveCharacter } from '../lib/character-library.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.resolve(ROOT, 'out');
const DEMO_MP4 = path.join(OUT_DIR, 'demo_v5_procedural_15s.mp4');
const DEMO_BACKUP = path.resolve(ROOT, 'scratch', 'demo_v5_procedural_15s_backup.mp4');

// Preserve original Max character so we cleanly restore after hair-color mutation test
const originalMax = JSON.parse(JSON.stringify(getCharacter('chibi_max')));
assert.ok(originalMax, 'chibi_max must exist in data/characters/');

let movedDemo = false;

async function run() {
  console.log('================================================================');
  console.log('V5.2 TASK 4 — ANTI-HARDCODE REAL RENDER PIPELINE VERIFICATION');
  console.log('================================================================\n');

  try {
    // STEP 1: Move demo MP4 completely out of out/ directory
    fs.mkdirSync(path.dirname(DEMO_BACKUP), { recursive: true });
    if (fs.existsSync(DEMO_MP4)) {
      fs.renameSync(DEMO_MP4, DEMO_BACKUP);
      movedDemo = true;
      console.log('1. Đã di chuyển out/demo_v5_procedural_15s.mp4 ra khỏi thư mục out/ (không còn file demo để copy).');
    } else {
      console.log('1. Thư mục out/ không có file demo_v5_procedural_15s.mp4.');
    }
    assert.equal(fs.existsSync(DEMO_MP4), false, 'Demo MP4 must NOT exist in out/ during test!');

    // STEP 2: Project A — Doc, Modern Lab, 15s (3 scenes x 5s)
    const projectAPlan = {
      schemaVersion: '5.2',
      project: { id: 'proj_v52_project_a_doc_lab', title: 'Project A: Doc in Lab (15s)', fps: 30, resolution: { width: 1920, height: 1080 } },
      style: { profileId: 'flat_vector' },
      scenes: [
        {
          id: 'projA_s01',
          duration: 5,
          background: { assetId: 'bg_modern_lab' },
          characters: [{ characterId: 'chibi_doc', action: 'walk', emotion: 'happy', position: [0.18, 0.78], targetPosition: [0.42, 0.78] }]
        },
        {
          id: 'projA_s02',
          duration: 5,
          background: { assetId: 'bg_modern_lab' },
          characters: [{ characterId: 'chibi_doc', action: 'inspect', emotion: 'thinking', secondaryEmotion: 'confused', position: [0.40, 0.78], prop: { assetId: 'prop_vintage_computer' } }],
          vfx: [{ type: 'vfx_smoke_cloud', position: [0.64, 0.33] }]
        },
        {
          id: 'projA_s03',
          duration: 5,
          background: { assetId: 'bg_modern_lab' },
          characters: [{ characterId: 'chibi_doc', action: 'eureka', emotion: 'excited', position: [0.40, 0.78], prop: { assetId: 'prop_idea_bulb' } }]
        }
      ]
    };

    const projectABindings = {
      REQ_BG_modern_lab: { requirementId: 'REQ_BG_modern_lab', resolvedAssetId: 'bg_modern_lab', status: 'READY' },
      REQ_PROP_vintage_computer: { requirementId: 'REQ_PROP_vintage_computer', resolvedAssetId: 'prop_vintage_computer', status: 'READY' },
      REQ_PROP_idea_bulb: { requirementId: 'REQ_PROP_idea_bulb', resolvedAssetId: 'prop_idea_bulb', status: 'READY' }
    };

    console.log('\n2. Đang render Project A (Doc + Phòng thí nghiệm + 15s) qua Tab 4 ProductionOrchestrator...');
    const orchA = new ProductionOrchestrator();
    const outA = path.join(OUT_DIR, 'proj_v52_project_a_doc_lab_final.mp4');
    const resA = await orchA.produceVideo(
      { id: 'proj_v52_project_a_doc_lab', scenePlan: projectAPlan, bindings: projectABindings },
      PRODUCTION_MODES.MODE_B_FULL_AUTO,
      { outputPath: outA }
    );
    assert.equal(resA.success, true, `Project A failed: ${resA.error || JSON.stringify(resA.missingAssets || resA.qaResult)}`);
    const probeA = await defaultFfmpegAssembler.verifyFinalOutput(outA, { duration: 15, resolution: '1920x1080', fps: 30 });
    assert.equal(probeA.isValid, true, `Project A FFprobe invalid: ${probeA.error}`);
    assert.ok(Math.abs(probeA.duration - 15) < 0.6, `Expected Project A duration ~15s, got ${probeA.duration}`);
    console.log(`   ✔ Project A PASS: ${outA} (${probeA.duration}s, ${(probeA.fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // STEP 3: Project B — Max, Street, 8s (2 scenes x 4s)
    const projectBPlan = {
      schemaVersion: '5.2',
      project: { id: 'proj_v52_project_b_max_street', title: 'Project B: Max on Street (8s)', fps: 30, resolution: { width: 1920, height: 1080 } },
      style: { profileId: 'flat_vector' },
      scenes: [
        {
          id: 'projB_s01',
          duration: 4,
          background: { assetId: 'bg_street' },
          characters: [{ characterId: 'chibi_max', action: 'walk', emotion: 'happy', position: [0.22, 0.78], targetPosition: [0.48, 0.78] }]
        },
        {
          id: 'projB_s02',
          duration: 4,
          background: { assetId: 'bg_street' },
          characters: [{ characterId: 'chibi_max', action: 'wave', emotion: 'excited', position: [0.48, 0.78] }]
        }
      ]
    };

    const projectBBindings = {
      REQ_BG_street: { requirementId: 'REQ_BG_street', resolvedAssetId: 'bg_street', status: 'READY' }
    };

    console.log('\n3. Đang render Project B (Max + Đường phố + 8s) qua Tab 4 ProductionOrchestrator...');
    const orchB = new ProductionOrchestrator();
    const outB = path.join(OUT_DIR, 'proj_v52_project_b_max_street_final.mp4');
    const resB = await orchB.produceVideo(
      { id: 'proj_v52_project_b_max_street', scenePlan: projectBPlan, bindings: projectBBindings },
      PRODUCTION_MODES.MODE_B_FULL_AUTO,
      { outputPath: outB }
    );
    assert.equal(resB.success, true, `Project B failed: ${resB.error || JSON.stringify(resB.missingAssets || resB.qaResult)}`);
    const probeB = await defaultFfmpegAssembler.verifyFinalOutput(outB, { duration: 8, resolution: '1920x1080', fps: 30 });
    assert.equal(probeB.isValid, true, `Project B FFprobe invalid: ${probeB.error}`);
    assert.ok(Math.abs(probeB.duration - 8) < 0.6, `Expected Project B duration ~8s, got ${probeB.duration}`);
    console.log(`   ✔ Project B PASS: ${outB} (${probeB.duration}s, ${(probeB.fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // STEP 4: Mutate Max's hair color (#4a3728 -> #ef4444 bright red) in Character Library & re-render Project B
    console.log('\n4. Thay đổi màu tóc nhân vật Max (#4a3728 -> #ef4444) trong thư viện và render lại Project B...');
    saveCharacter({
      ...originalMax,
      hair: { ...originalMax.hair, color: '#ef4444', highlight: '#fca5a5' }
    });

    const orchBRed = new ProductionOrchestrator();
    const outBRed = path.join(OUT_DIR, 'proj_v52_project_b_max_redhair_final.mp4');
    const resBRed = await orchBRed.produceVideo(
      { id: 'proj_v52_project_b_max_redhair', scenePlan: { ...projectBPlan, project: { ...projectBPlan.project, id: 'proj_v52_project_b_max_redhair' } }, bindings: projectBBindings },
      PRODUCTION_MODES.MODE_B_FULL_AUTO,
      { outputPath: outBRed }
    );
    assert.equal(resBRed.success, true, `Project B (Red Hair) failed: ${resBRed.error}`);
    const probeBRed = await defaultFfmpegAssembler.verifyFinalOutput(outBRed, { duration: 8, resolution: '1920x1080', fps: 30 });
    assert.equal(probeBRed.isValid, true, `Project B (Red Hair) FFprobe invalid: ${probeBRed.error}`);
    console.log(`   ✔ Project B (Red Hair) PASS: ${outBRed} (${probeBRed.duration}s, ${(probeBRed.fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // STEP 5: Extract real frames from all 3 videos & verify actual pixel differences (NOT just FFprobe!)
    console.log('\n5. Trích xuất khung hình thực tế và kiểm tra khác biệt nội dung pixel...');
    const frameA = path.join(OUT_DIR, 'v52_task4_projA_doc_lab.png');
    const frameB = path.join(OUT_DIR, 'v52_task4_projB_max_street.png');
    const frameBRed = path.join(OUT_DIR, 'v52_task4_projB_max_redhair.png');

    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '12.0', '-i', outA, '-frames:v', '1', frameA]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '5.5', '-i', outB, '-frames:v', '1', frameB]);
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '5.5', '-i', outBRed, '-frames:v', '1', frameBRed]);

    const b64A = fs.readFileSync(frameA).toString('base64');
    const b64B = fs.readFileSync(frameB).toString('base64');
    const b64BRed = fs.readFileSync(frameBRed).toString('base64');

    assert.notEqual(b64A, b64B, 'Project A and Project B frames MUST be different!');
    assert.notEqual(b64B, b64BRed, 'Project B (brown hair) and Project B (red hair) frames MUST be different!');

    // Render side-by-side verification contact sheet + compute real pixel diff stats in headless browser
    const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist'] });
    try {
      const page = await browser.newPage({ viewport: { width: 1500, height: 640 } });
      await page.setContent(`
        <!doctype html>
        <html>
        <body style="margin:0;padding:18px;background:#090d16;color:#f8fafc;font-family:sans-serif;">
          <h2 style="margin:0 0 12px 0;color:#38bdf8;">V5.2 TASK 4 — ANTI-HARDCODE REAL PIPELINE VERIFICATION (NO DEMO COPY)</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
            <div style="background:#1e293b;padding:8px;border-radius:8px;border:1px solid #334155;">
              <img id="imgA" src="data:image/png;base64,${b64A}" style="width:100%;border-radius:4px;" />
              <div style="margin-top:6px;font-weight:700;font-size:13px;">Project A: Doc • Lab • 15.0s</div>
            </div>
            <div style="background:#1e293b;padding:8px;border-radius:8px;border:1px solid #334155;">
              <img id="imgB" src="data:image/png;base64,${b64B}" style="width:100%;border-radius:4px;" />
              <div style="margin-top:6px;font-weight:700;font-size:13px;">Project B: Max (Brown Hair) • Street • 8.0s</div>
            </div>
            <div style="background:#1e293b;padding:8px;border-radius:8px;border:1px solid #334155;">
              <img id="imgBRed" src="data:image/png;base64,${b64BRed}" style="width:100%;border-radius:4px;" />
              <div style="margin-top:6px;font-weight:700;font-size:13px;color:#f87171;">Project B Re-render: Max (RED Hair #ef4444) • 8.0s</div>
            </div>
          </div>
        </body>
        </html>
      `);

      const pixelStats = await page.evaluate(async () => {
        const load = (id) => {
          const img = document.getElementById(id);
          const c = document.createElement('canvas');
          c.width = 480; c.height = 270;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0, 480, 270);
          return ctx.getImageData(0, 0, 480, 270).data;
        };
        const dA = load('imgA');
        const dB = load('imgB');
        const dBR = load('imgBRed');
        let diffAB = 0;
        let diffBRed = 0;
        let redHairPixelsAdded = 0;
        for (let i = 0; i < dA.length; i += 4) {
          if (Math.abs(dA[i] - dB[i]) + Math.abs(dA[i + 1] - dB[i + 1]) + Math.abs(dA[i + 2] - dB[i + 2]) > 30) diffAB++;
          if (Math.abs(dB[i] - dBR[i]) + Math.abs(dB[i + 1] - dBR[i + 1]) + Math.abs(dB[i + 2] - dBR[i + 2]) > 30) {
            diffBRed++;
            if (dBR[i] > 180 && dBR[i + 1] < 100 && dBR[i + 2] < 100) redHairPixelsAdded++;
          }
        }
        return { totalPixels: dA.length / 4, diffAB, diffBRed, redHairPixelsAdded };
      });

      assert.ok(pixelStats.diffAB > 80000, `Project A & B must differ dramatically in pixels, got ${pixelStats.diffAB}`);
      assert.ok(pixelStats.diffBRed > 200, `Hair color edit must change real rendered pixels, got ${pixelStats.diffBRed}`);
      assert.ok(pixelStats.redHairPixelsAdded > 100, `Red hair (#ef4444) pixels must appear in re-rendered frame, got ${pixelStats.redHairPixelsAdded}`);

      const sheetPath = path.join(OUT_DIR, 'v52_task4_anti_hardcode_contact_sheet.png');
      await page.screenshot({ path: sheetPath, fullPage: true });
      console.log(`   ✔ Pixel diff A vs B: ${pixelStats.diffAB}/${pixelStats.totalPixels} pixels (${Math.round(pixelStats.diffAB / pixelStats.totalPixels * 100)}%)`);
      console.log(`   ✔ Pixel diff B vs B(red hair): ${pixelStats.diffBRed} changed pixels (${pixelStats.redHairPixelsAdded} new #ef4444 red hair pixels)`);
      console.log(`   ✔ Anti-hardcode contact sheet saved: ${sheetPath}`);
    } finally {
      await browser.close();
    }

    console.log('\n================================================================');
    console.log('🎉 ALL V5.2 TASK 4 ANTI-HARDCODE CHECKS PASSED 100%!');
    console.log('================================================================');
  } finally {
    // Always restore original Max hair color & demo backup
    saveCharacter(originalMax);
    if (movedDemo && fs.existsSync(DEMO_BACKUP)) {
      fs.renameSync(DEMO_BACKUP, DEMO_MP4);
      console.log('✔ Đã khôi phục màu tóc gốc của Max và file demo backup sau kiểm thử.');
    }
  }
}

run().catch(err => {
  console.error('\n❌ TASK 4 FAILED:', err);
  process.exit(1);
});
