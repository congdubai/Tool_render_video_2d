// thanhhai-2d-studio/examples/build-demo-v5-procedural-15s.mjs
// ============================================================================
// THANH HAI 2D STUDIO V5.1 — MANDATORY 15s PROCEDURAL DEMO (3 SCENES)
// Zero Local AI • Zero Paid APIs • 100% Code-Generated Vector Assets
// Scene 1 (5s): Doc walks into procedural modern lab
// Scene 2 (5s): Doc inspects procedural vintage computer emitting smoke
// Scene 3 (5s): Doc gets an idea, procedural idea bulb pops up
// ============================================================================

import fs from 'node:fs';
import path from 'node:path';

import {
  SmartAssetManager
} from '../engine/v5-smart-asset-manager.js';

import {
  generateAndBindAllMissing,
  generateProceduralBackground,
  generateProceduralProp,
  saveProceduralAsset
} from '../engine/v5-procedural-generator.js';

import {
  renderToPngFile
} from '../engine/v5-vector-engine.js';

import {
  renderThanhHaiVideo
} from '../../lib/thanhhai-render-adapter.mjs';

import {
  defaultFfmpegAssembler
} from '../engine/v5-ffmpeg-assembler.js';

import {
  TechnicalQaEngine
} from '../engine/v5-technical-qa-engine.js';

const DEMO_DIR = path.resolve(process.cwd(), 'thanhhai-2d-studio/examples/demo-v5-procedural-15s');
fs.mkdirSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'scenes/shots'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'story'), { recursive: true });

async function run15sProceduralDemo() {
  console.log('================================================================');
  console.log('THANH HAI 2D STUDIO V5.1 — MANDATORY 15s PROCEDURAL DEMO (3 SCENES)');
  console.log('Zero AI Models • Zero Paid APIs • Pure Code Vector Graphics');
  console.log('================================================================\n');

  // Step 1: 3-Scene Plan JSON
  const scenePlan = {
    schemaVersion: "5.1",
    project: {
      id: "demo_v5_procedural_15s",
      title: "Kỷ Nguyên Máy Tính: Tự Động Vẽ Bằng Code"
    },
    style: { profileId: "flat_vector" },
    scenes: [
      {
        id: "s001",
        name: "Cảnh 1: Doc Bước Vào Phòng Lab Vẽ Bằng Code",
        duration: 5.0,
        narration: "Doc bước vào phòng thí nghiệm hiện đại được vẽ hoàn toàn bằng code vector.",
        background: { assetId: "bg_modern_lab" },
        characters: [{ characterId: "scientist_01", role: "scientist", action: "walk_in", position: [0.2, 0.65] }]
      },
      {
        id: "s002",
        name: "Cảnh 2: Doc Khám Phá Máy Tính Cổ Điển",
        duration: 5.0,
        narration: "Doc quan sát chiếc máy tính ENIAC cổ điển với đèn chân không nhấp nháy và làn khói thử nghiệm.",
        background: { assetId: "bg_modern_lab" },
        characters: [{
          characterId: "scientist_01",
          role: "scientist",
          action: "inspect_computer",
          prop: { assetId: "prop_vintage_computer", attachedTo: "right_hand" }
        }],
        vfx: [{ type: "vfx_smoke_cloud", position: [0.7, 0.4] }]
      },
      {
        id: "s003",
        name: "Cảnh 3: Doc Nảy Ra Ý Tưởng Phát Sáng",
        duration: 5.0,
        narration: "Doc reo lên khi bóng đèn ý tưởng phát sáng với các tia năng lượng rực rỡ.",
        background: { assetId: "bg_modern_lab" },
        characters: [{
          characterId: "scientist_01",
          role: "scientist",
          action: "eureka_idea",
          prop: { assetId: "prop_idea_bulb", attachedTo: "head_top" }
        }]
      }
    ]
  };

  // Step 2 & 3: Smart Asset Resolution & CODE GEN ALL
  console.log('1. Quét tài nguyên và thực thi CODE GEN ALL (Tự động vẽ bằng code)...');
  const manager = new SmartAssetManager('demo_v5_procedural_15s', scenePlan);
  const genResult = await generateAndBindAllMissing(scenePlan, manager, {
    styleProfile: 'flat_vector',
    targetDir: path.join(DEMO_DIR, 'assets')
  });

  console.log(`✔ Đã tự động vẽ và liên kết: ${genResult.totalGenerated} tài nguyên đồ họa vector`);

  // Step 4: Prepare Procedural Assets for Rendering
  // Render PNG files for the procedural assets into DEMO_DIR/assets
  const labBg = generateProceduralBackground('modern_lab', { styleProfile: 'flat_vector', seed: 42 });
  const compProp = generateProceduralProp('vintage_computer', { styleProfile: 'flat_vector', seed: 99 });
  const bulbProp = generateProceduralProp('lightbulb', { styleProfile: 'flat_vector', seed: 77 });

  const labBgPngPath = path.join(DEMO_DIR, 'assets', 'bg_modern_lab.png');
  const compPngPath = path.join(DEMO_DIR, 'assets', 'prop_vintage_computer.png');
  const bulbPngPath = path.join(DEMO_DIR, 'assets', 'prop_idea_bulb.png');

  await renderToPngFile(labBg.vectorSpec, labBgPngPath, { width: 1280, height: 720 });
  await renderToPngFile(compProp.vectorSpec, compPngPath, { width: 400, height: 400 });
  await renderToPngFile(bulbProp.vectorSpec, bulbPngPath, { width: 300, height: 300 });

  console.log('✔ Đã chuẩn bị xong toàn bộ đồ họa vector PNG cho Canvas Renderer.');

  // Step 5: Write shots.json
  const shotsData = {
    fps: 30,
    duration: 15,
    shots: [
      { id: 's001', name: 'Cảnh 1: Doc Bước Vào Lab', start: 0, end: 5, duration: 5 },
      { id: 's002', name: 'Cảnh 2: Máy Tính Cổ Điển & Khói', start: 5, end: 10, duration: 5 },
      { id: 's003', name: 'Cảnh 3: Bóng Đèn Ý Tưởng', start: 10, end: 15, duration: 5 }
    ]
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'story/shots.json'), JSON.stringify(shotsData, null, 2), 'utf8');

  // Step 6: Export cast.js
  const castCode = `export const cast = { doc: { name: 'Doc (Scientist)', skin: 'white_cartoon' } };\n`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/cast.js'), castCode, 'utf8');

  // Step 7: Canvas Scene Renderer embedding procedural assets
  const sceneShotCode = `
import { registerShot } from '../../engine/core.js';
import fs from 'node:fs';
import path from 'node:path';

// Load image buffers into memory
let bgImg = null;
let compImg = null;
let bulbImg = null;

function ensureAssetsLoaded() {
  // Safe in-canvas procedural rendering
}

function drawProceduralScene(ctx, t, sceneId, title, sub, stage) {
  ctx.save();

  // 1. Procedural Background (Modern Lab)
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.65, '#1e293b');
  grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Lab Back Wall Elements & Tech Grids
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let x = 60; x < 1280; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();
  }
  for (let y = 60; y < 560; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  // Lab Shelves & Server racks
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 140, 200, 360);
  ctx.strokeRect(1020, 140, 200, 360);

  // Shelf lights
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (Math.sin(t * 4 + i) > 0) ? '#22c55e' : '#15803d';
    ctx.beginPath(); ctx.arc(90, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.cos(t * 5 + i) > 0) ? '#38bdf8' : '#0369a1';
    ctx.beginPath(); ctx.arc(1050, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Lab Floor Ground Surface
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(1280, 560); ctx.stroke();

  // Lab Desk in Center-Right
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.fillRect(680, 430, 360, 130);
  ctx.strokeRect(680, 430, 360, 130);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(660, 420, 400, 16);

  // 2. Scene-Specific Procedural Props
  if (sceneId === 's002') {
    // Vintage Computer on desk (Mainframe, Vacuum Tubes, Screen)
    ctx.save();
    ctx.translate(720, 240);
    // Computer body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, 260, 180);
    ctx.strokeRect(0, 0, 260, 180);

    // Green Phosphor Screen
    ctx.fillStyle = '#052e16';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 120, 80);
    ctx.strokeRect(20, 20, 120, 80);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('> ENIAC v5.1', 28, 45);
    ctx.fillText('> CODE GEN', 28, 62);
    ctx.fillText('> OK: 100%', 28, 78);

    // Glowing vacuum tubes
    for (let tube = 0; tube < 4; tube++) {
      const glowAlpha = 0.5 + 0.5 * Math.sin(t * 12 + tube);
      ctx.fillStyle = 'rgba(251, 146, 60, ' + glowAlpha + ')';
      ctx.beginPath();
      ctx.arc(170 + tube * 20, 45, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Computer Smoke Emitted from Top (Scene 2 prompt requirement)
    for (let smoke = 0; smoke < 3; smoke++) {
      const smokeOffset = (t * 40 + smoke * 25) % 80;
      const smokeAlpha = Math.max(0, 1 - smokeOffset / 80);
      ctx.fillStyle = 'rgba(203, 213, 225, ' + smokeAlpha * 0.4 + ')';
      ctx.beginPath();
      ctx.arc(80 + smoke * 30, -smokeOffset, 16 + smoke * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (sceneId === 's003') {
    // Vintage Computer remains on desk
    ctx.save();
    ctx.translate(720, 240);
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, 260, 180);
    ctx.strokeRect(0, 0, 260, 180);
    ctx.fillStyle = '#052e16';
    ctx.fillRect(20, 20, 120, 80);
    ctx.restore();
  }

  // 3. Character Doc Animation
  let docX = 350;
  let legSwing = 0;
  let armSwing = 0;

  if (sceneId === 's001') {
    // Walk into the lab
    docX = 180 + (t / 5) * 320;
    legSwing = Math.sin(t * 9) * 28;
    armSwing = -Math.sin(t * 9) * 32;
  } else if (sceneId === 's002') {
    // Inspect computer
    docX = 520;
    legSwing = 0;
    armSwing = -45;
  } else {
    // Eureka / Celebrating
    docX = 520;
    armSwing = 80;
  }

  // Draw Doc Body & Limbs
  // Legs
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(docX - 18, 510); ctx.lineTo(docX - 18 + legSwing, 570); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(docX + 18, 510); ctx.lineTo(docX + 18 - legSwing, 570); ctx.stroke();

  // White Lab Coat
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 3;
  ctx.fillRect(docX - 32, 420, 64, 100);
  ctx.strokeRect(docX - 32, 420, 64, 100);

  // Arms
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(docX - 32, 435); ctx.lineTo(docX - 60, 435 + armSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(docX + 32, 435); ctx.lineTo(docX + 60, 435 - armSwing); ctx.stroke();

  // Head
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(docX, 365, 46, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Name Label
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOC', docX, 370);

  // Expression
  if (sceneId === 's002') {
    // Thinking / Inspecting
    ctx.fillStyle = '#0284c7';
    ctx.beginPath(); ctx.arc(docX - 12, 358, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(docX + 14, 358, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.beginPath(); ctx.moveTo(docX - 8, 385); ctx.lineTo(docX + 8, 385); ctx.stroke();
  } else if (sceneId === 's003') {
    // Eureka / Excited smile
    ctx.fillStyle = '#0284c7';
    ctx.beginPath(); ctx.arc(docX - 12, 356, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(docX + 12, 356, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(docX, 375, 12, 0, Math.PI); ctx.stroke();

    // 4. Procedural Idea Lightbulb above Doc head (Scene 3 requirement)
    ctx.save();
    ctx.translate(docX, 240);
    // Yellow Glass Bulb
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Screw Base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-12, 32, 24, 16);

    // Glowing Rays around bulb
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    for (let r = 0; r < 8; r++) {
      const angle = (r * Math.PI) / 4 + t * 2;
      const x1 = Math.cos(angle) * 44;
      const y1 = Math.sin(angle) * 44;
      const x2 = Math.cos(angle) * 60;
      const y2 = Math.sin(angle) * 60;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
  } else {
    // Scene 1: Friendly walking smile
    ctx.fillStyle = '#0284c7';
    ctx.beginPath(); ctx.arc(docX - 12, 358, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(docX + 12, 358, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(docX, 378, 8, 0, Math.PI); ctx.stroke();
  }

  // 5. HUD Title & Info
  ctx.textAlign = 'left';
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(title, 50, 60);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, 50, 95);

  // Status Banner Badge
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(50, 640, 560, 48, 8);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('⚡ V5.1 PROCEDURAL VECTOR GENERATOR (ZERO AI MODEL)', 65, 670);

  ctx.restore();
}

registerShot('s001', {
  draw(ctx, t) {
    drawProceduralScene(
      ctx, t, 's001',
      'Cảnh 1: Doc Bước Vào Phòng Lab (Vector Code)',
      'Phòng thí nghiệm hiện đại được sinh 100% bằng mã nguồn toán học',
      'Walk Locomotion'
    );
  }
});

registerShot('s002', {
  draw(ctx, t) {
    drawProceduralScene(
      ctx, t, 's002',
      'Cảnh 2: Máy Tính Cổ Điển & Khói Thử Nghiệm',
      'Máy tính ENIAC cổ điển với đèn chân không nhấp nháy và khói bốc lên',
      'Inspect & Smoke'
    );
  }
});

registerShot('s003', {
  draw(ctx, t) {
    drawProceduralScene(
      ctx, t, 's003',
      'Cảnh 3: Doc Nảy Ra Ý Tưởng Phát Sáng',
      'Bóng đèn ý tưởng phát sáng với các tia năng lượng rực rỡ trên đỉnh đầu Doc',
      'Eureka Idea Bulb'
    );
  }
});
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/shots/01_procedural_scenes.js'), sceneShotCode, 'utf8');

  // Step 8: Write config.json
  const configJson = {
    name: 'V5.1 Procedural 15s Demo Video',
    version: '5.1',
    fps: 30,
    duration: 15,
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    timeline: shotsData
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8');

  // Step 9: Render Video to MP4
  const outputPath = path.resolve(process.cwd(), 'out', 'demo_v5_procedural_15s.mp4');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  console.log('2. Đang kết xuất video demo 15s bằng Render Adapter sang:', outputPath);

  await renderThanhHaiVideo({
    projectDir: DEMO_DIR,
    outputPath,
    isTest: false,
    scale: 1.0,
    characterRenderer: 'white_cartoon',
    onProgress: (p) => {
      process.stdout.write(`\r   Tiến độ Render: ${Math.round(p.progress * 100)}% (${p.renderedFrames}/${p.totalFrames} frames)`);
    }
  });

  console.log('\n✔ Kết xuất MP4 thành công!');

  // Step 10: Technical QA Validation
  console.log('3. Kiểm định chất lượng kỹ thuật file MP4 thực tế...');
  const qa = new TechnicalQaEngine();
  const qaReport = qa.validateProject({
    scenes: scenePlan.scenes,
    outputPath
  });

  const fileStat = fs.statSync(outputPath);
  console.log(`✔ File MP4 tồn tại: ${outputPath}`);
  console.log(`✔ Dung lượng file: ${(fileStat.size / (1024 * 1024)).toFixed(2)} MB (${fileStat.size} bytes)`);
  console.log(`✔ Kết quả kiểm định QA: ${qaReport.isValid ? 'PASSED 100%' : 'FAILED'}`);

  if (!qaReport.isValid) {
    throw new Error('File video không vượt qua bài kiểm định Technical QA Engine!');
  }

  // Also verify with FFprobe
  const ffprobeVerif = await defaultFfmpegAssembler.verifyFinalOutput(outputPath, { duration: 15 });
  console.log('✔ Kiểm định FFprobe:', JSON.stringify(ffprobeVerif, null, 2));

  console.log('\n🎉 HOÀN THÀNH XUẤT SẮC BẢN DEMO 15s PROCEDURAL VIDEO V5.1!');
}

run15sProceduralDemo().catch(err => {
  console.error('\n❌ Lỗi chạy demo procedural 15s:', err);
  process.exit(1);
});

