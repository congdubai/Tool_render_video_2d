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

  // Step 6: Load canonical Doc character directly from Tab 3 Character Library (NO fallback!)
  const docCharPath = path.resolve(process.cwd(), 'data/characters/chibi_doc.json');
  if (!fs.existsSync(docCharPath)) {
    throw new Error('Không tìm thấy file nhân vật Tab 3: data/characters/chibi_doc.json');
  }
  const docProfile = JSON.parse(fs.readFileSync(docCharPath, 'utf8'));

  const castCode = `export const cast = { chibi_doc: ${JSON.stringify(docProfile, null, 2)} };\n`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/cast.js'), castCode, 'utf8');

  // Step 7: Clean Production Canvas Scene Renderer using Unified Character Renderer V5.2
  const sceneShotCode = `
import { registerShot } from '/engine/core.js';
import {
  drawUnifiedCharacter,
  registerCharacterProfile
} from '/engine/unified-character-renderer.js';
import { cast } from '../cast.js';

// Register Tab 3's exact Doc profile into Unified Character Renderer (zero silent fallback)
registerCharacterProfile(cast.chibi_doc);

function drawProceduralScene(ctx, t, sceneId) {
  ctx.save();
  // Scale 1280x720 logical design space cleanly to 1920x1080 canvas space
  ctx.scale(1.5, 1.5);

  // 1. Procedural Background (Modern Lab)
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.65, '#1e293b');
  grad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Lab Back Wall Tech Grid
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1;
  for (let x = 60; x < 1280; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();
  }
  for (let y = 60; y < 560; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  // Lab Server Racks
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(60, 140, 200, 380);
  ctx.strokeRect(60, 140, 200, 380);
  ctx.fillRect(1020, 140, 200, 380);
  ctx.strokeRect(1020, 140, 200, 380);

  // Rack Indicator LEDs
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (Math.sin(t * 4 + i) > 0) ? '#22c55e' : '#15803d';
    ctx.beginPath(); ctx.arc(90, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.cos(t * 5 + i) > 0) ? '#38bdf8' : '#0369a1';
    ctx.beginPath(); ctx.arc(1050, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Lab Floor Ground Surface (y = 560)
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
  if (sceneId === 's002' || sceneId === 's003') {
    ctx.save();
    ctx.translate(720, 240);
    // Vintage Mainframe Computer Body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, 260, 180);
    ctx.strokeRect(0, 0, 260, 180);

    // Green Phosphor Screen (clean retro wave graphic, no debug text)
    ctx.fillStyle = '#052e16';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 120, 80);
    ctx.strokeRect(20, 20, 120, 80);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let px = 0; px <= 104; px += 4) {
      const py = 60 + Math.sin(px * 0.12 + t * 6) * 14;
      if (px === 0) ctx.moveTo(28 + px, py);
      else ctx.lineTo(28 + px, py);
    }
    ctx.stroke();

    // Glowing vacuum tubes
    for (let tube = 0; tube < 4; tube++) {
      const glowAlpha = 0.5 + 0.5 * Math.sin(t * 12 + tube);
      ctx.fillStyle = 'rgba(251, 146, 60, ' + glowAlpha + ')';
      ctx.beginPath();
      ctx.arc(170 + tube * 20, 45, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smoke emitted from top in Scene 2
    if (sceneId === 's002') {
      for (let smoke = 0; smoke < 4; smoke++) {
        const smokeOffset = (t * 42 + smoke * 22) % 90;
        const smokeAlpha = Math.max(0, 1 - smokeOffset / 90);
        ctx.fillStyle = 'rgba(203, 213, 225, ' + (smokeAlpha * 0.48) + ')';
        ctx.beginPath();
        ctx.arc(85 + smoke * 26 + Math.sin(t * 3 + smoke) * 8, -smokeOffset, 16 + smoke * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 3. Unified Character Renderer — Doc (chibi_doc) from Tab 3 Character Library
  let docX = 510;
  let docPose = 'stand';
  let docExpr = 'neutral';
  let docLook = [0, 0];
  const blinkCycle = t % 3.4;
  const isBlinking = blinkCycle > 3.22 && blinkCycle < 3.36;

  if (sceneId === 's001') {
    // Scene 1: Doc walks smoothly into the modern lab
    docX = 210 + (t / 5) * 300;
    docPose = 'walk';
    docExpr = 'happy';
    docLook = [0.4, 0];
  } else if (sceneId === 's002') {
    // Scene 2: Doc inspects smoking vintage computer
    docX = 510;
    docPose = 'inspect';
    docExpr = t < 2.2 ? 'thinking' : 'confused';
    docLook = [0.65, -0.15];
  } else {
    // Scene 3: Doc gets an eureka idea
    docX = 510;
    docPose = 'eureka';
    docExpr = t < 1.1 ? 'surprised' : 'excited';
    docLook = [0.2, -0.45];
  }

  drawUnifiedCharacter(ctx, {
    characterId: 'chibi_doc',
    x: docX,
    y: 560,
    s: 1.55,
    view: 'three_quarter_right',
    pose: docPose,
    expr: docExpr,
    look: docLook,
    blink: isBlinking,
    t,
    shadow: true,
    debug: false,
    strict: true
  });

  // 4. Procedural Idea Lightbulb above Doc's head in Scene 3
  if (sceneId === 's003') {
    const bulbPop = Math.min(1, t / 0.45);
    const bulbScale = 0.6 + 0.4 * bulbPop + Math.sin(t * 7) * 0.04;
    ctx.save();
    ctx.translate(docX + 6, 225);
    ctx.scale(bulbScale, bulbScale);

    // Soft radiant glow
    const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 68);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.55)');
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.fill();

    // Yellow Glass Bulb
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Filament
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-3, -4); ctx.lineTo(3, 2); ctx.lineTo(7, -8); ctx.stroke();

    // Screw Base
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillRect(-10, 27, 20, 14);
    ctx.strokeRect(-10, 27, 20, 14);

    // Glowing Rays around bulb
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let r = 0; r < 8; r++) {
      const angle = (r * Math.PI) / 4 + t * 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 38, Math.sin(angle) * 38);
      ctx.lineTo(Math.cos(angle) * 52, Math.sin(angle) * 52);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawProceduralScene(ctx, t, 's001'); } });
registerShot('scene_001', { draw(ctx, t) { drawProceduralScene(ctx, t, 's001'); } });
registerShot('s002', { draw(ctx, t) { drawProceduralScene(ctx, t, 's002'); } });
registerShot('scene_002', { draw(ctx, t) { drawProceduralScene(ctx, t, 's002'); } });
registerShot('s003', { draw(ctx, t) { drawProceduralScene(ctx, t, 's003'); } });
registerShot('scene_003', { draw(ctx, t) { drawProceduralScene(ctx, t, 's003'); } });
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/shots/01_procedural_scenes.js'), sceneShotCode, 'utf8');

  // Step 8: Write config.json (Clean render: bars: 'none', character: 'chibi')
  const configJson = {
    name: 'V5.2 Unified Character Renderer 15s Demo Video',
    version: '5.2',
    character: 'chibi',
    bars: 'none',
    fadeIn: 0.25,
    fadeOut: 0.35,
    fps: 30,
    duration: 15,
    width: 1920,
    height: 1080,
    resolution: '1080p',
    aspectRatio: '16:9',
    timeline: shotsData
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8');

  // Step 9: Render Video to MP4
  const outputPath = path.resolve(process.cwd(), 'out', 'demo_v5_procedural_15s.mp4');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  console.log('2. Đang kết xuất video demo 15s bằng Unified Character Renderer V5.2 sang:', outputPath);

  await renderThanhHaiVideo({
    projectDir: DEMO_DIR,
    outputPath,
    isTest: false,
    scale: 1.0,
    characterRenderer: 'chibi',
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

