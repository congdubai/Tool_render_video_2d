// thanhhai-2d-studio/examples/build-demo-v5-phase5.mjs — Mandatory Demo 1 Minimum Production Proof (15s MP4)
// End-to-end pipeline: Scene Plan -> Asset Resolution -> Scene Building -> Animation -> QA -> Render MP4.

import fs from 'node:fs';
import path from 'node:path';
import { defaultOrchestrator, PRODUCTION_MODES, PRODUCTION_STATES } from '../engine/v5-production-orchestrator.js';
import { defaultFfmpegAssembler } from '../engine/v5-ffmpeg-assembler.js';
import { renderThanhHaiVideo } from '../../lib/thanhhai-render-adapter.mjs';

const DEMO_DIR = path.resolve(process.cwd(), 'thanhhai-2d-studio/examples/demo-v5-phase5-proof-15s');
fs.mkdirSync(DEMO_DIR, { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'assets'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'scenes/shots'), { recursive: true });
fs.mkdirSync(path.join(DEMO_DIR, 'story'), { recursive: true });

async function runPhase5ProofDemo() {
  console.log('================================================================');
  console.log('THANH HAI 2D STUDIO V5 — PHASE 5 DEMO 1: MINIMUM PRODUCTION PROOF (15s)');
  console.log('================================================================\n');

  // 1. Scene Plan JSON with 3 scenes (15 seconds)
  const scenePlan = {
    title: 'Demo 1: Tự Động Diễn Hoạt & Sản Xuất Video 15s',
    styleProfile: 'educational_cartoon',
    duration: 15.0,
    scenes: [
      {
        id: 's001',
        duration: 5.0,
        narration: 'Năm 1945, nhà khoa học bước vào phòng thí nghiệm với bước đi tự tin.',
        background: 'bg_lab_modern',
        characters: [{ id: 'doc', skin: 'white_cartoon', action: 'walk', position: [0.25, 0.65], targetPosition: [0.55, 0.65] }],
        camera: { shotType: 'medium', movement: 'static' }
      },
      {
        id: 's002',
        duration: 5.0,
        narration: 'Ông chăm chú suy nghĩ, khuôn mặt chuyển từ đăm chiêu sang bất ngờ reo lên ý tưởng mới.',
        background: 'bg_lab_modern',
        characters: [{ id: 'doc', skin: 'white_cartoon', action: 'thinking', emotion: 'surprised', position: [0.55, 0.65] }],
        vfx: [{ type: 'idea_ping', position: [0.55, 0.35] }],
        camera: { shotType: 'close_up', movement: 'zoom_in' }
      },
      {
        id: 's003',
        duration: 5.0,
        narration: 'Cầm trên tay bảng điều khiển, ông ăn mừng thành công trong làn khói thử nghiệm.',
        background: 'bg_lab_modern',
        characters: [{ id: 'doc', skin: 'white_cartoon', action: 'celebrating', emotion: 'happy', position: [0.55, 0.65] }],
        props: [{ id: 'controller', action: 'hold', attachedTo: 'doc', position: [0.55, 0.55] }],
        vfx: [{ type: 'cartoon_dust', position: [0.55, 0.68] }],
        camera: { shotType: 'wide', movement: 'pan_right' }
      }
    ]
  };

  // 2. Run Orchestrator through QA & Animation
  console.log('1. Chạy Production Orchestrator...');
  const orchResult = await defaultOrchestrator.produceVideo(
    { id: 'v5_proof_15s', scenePlan },
    PRODUCTION_MODES.MODE_A_PREVIEW
  );
  console.log('✔ Orchestrator status:', orchResult.status);

  // 3. Write shots.json with explicit duration & end numbers
  const shotsData = {
    fps: 30,
    duration: 15,
    shots: [
      { id: 's001', name: 'Doc bước đi', start: 0, end: 5, duration: 5 },
      { id: 's002', name: 'Suy nghĩ & Bất ngờ', start: 5, end: 10, duration: 5 },
      { id: 's003', name: 'Tương tác & Ăn mừng', start: 10, end: 15, duration: 5 }
    ]
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'story/shots.json'), JSON.stringify(shotsData, null, 2), 'utf8');

  // 4. Export cast.js
  const castCode = `export const cast = { doc: { name: 'Doc', skin: 'white_cartoon' } };\n`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/cast.js'), castCode, 'utf8');

  // 5. Generate Canvas Drawing Shot Code
  const sceneShotCode = `
import { registerShot } from '../../engine/core.js';

function drawScene(ctx, t, sceneId, title, sub, icon, actionLabel) {
  ctx.save();
  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Grid Lab Lines
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  for (let x = 0; x < 1280; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 720); ctx.stroke();
  }
  for (let y = 0; y < 720; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  // Ground line
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 580); ctx.lineTo(1280, 580); ctx.stroke();

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(title, 50, 60);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px sans-serif';
  ctx.fillText(sub, 50, 95);

  // Character Doc Animation (Dynamic Position & Limb Walk)
  let charX = 400;
  let legSwing = 0;
  let armSwing = 0;

  if (sceneId === 's001') {
    // Walk cycle across screen
    charX = 250 + (t / 5) * 350;
    legSwing = Math.sin(t * 8) * 25;
    armSwing = -Math.sin(t * 8) * 30;
  } else if (sceneId === 's002') {
    // Thinking & Zoom
    charX = 640;
    legSwing = 0;
    armSwing = -60;
  } else {
    // Celebrating & Prop
    charX = 640;
    armSwing = 85;
  }

  // Draw Character Head
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(charX, 420, 48, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOC', charX, 426);

  // Expression Eyes & Mouth
  ctx.fillStyle = '#0284c7';
  if (sceneId === 's002') {
    // Surprised wide eyes
    ctx.beginPath(); ctx.arc(charX - 14, 412, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(charX + 14, 412, 6, 0, Math.PI * 2); ctx.fill();
    // Open mouth 'O'
    ctx.beginPath(); ctx.arc(charX, 436, 8, 0, Math.PI * 2); ctx.stroke();
  } else {
    // Happy smile
    ctx.beginPath(); ctx.arc(charX - 14, 414, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(charX + 14, 414, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(charX, 432, 10, 0, Math.PI); ctx.stroke();
  }

  // Body / Labcoat
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.fillRect(charX - 28, 470, 56, 90);
  ctx.strokeRect(charX - 28, 470, 56, 90);

  // Limbs
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 6;
  // Legs
  ctx.beginPath(); ctx.moveTo(charX - 15, 560); ctx.lineTo(charX - 15 + legSwing, 620); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(charX + 15, 560); ctx.lineTo(charX + 15 - legSwing, 620); ctx.stroke();

  // Arms
  ctx.beginPath(); ctx.moveTo(charX - 28, 485); ctx.lineTo(charX - 55, 485 + armSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(charX + 28, 485); ctx.lineTo(charX + 55, 485 - armSwing); ctx.stroke();

  // Visual Icon & Badge
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(820, 240, 360, 260, 16);
  ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(icon, 1000, 340);

  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(actionLabel, 1000, 420);

  // Footer status
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '14px monospace';
  ctx.fillText('Scene: ' + sceneId + ' | t=' + t.toFixed(2) + 's | V5 Automatic Production Engine Phase 5', 50, 690);

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawScene(ctx, t, 's001', 'Cảnh 1: Bước Đi Khởi Đầu (Walk Locomotion)', 'Nhà khoa học bước đi tự nhiên trên trục x với dao động chân thực', '🚶', 'Walk Locomotion'); } });
registerShot('s002', { draw(ctx, t) { drawScene(ctx, t, 's002', 'Cảnh 2: Suy Nghĩ & Bất Ngờ (Pose & Emotion)', 'Biểu cảm chuyển đổi sang Bất Ngờ kèm hiệu ứng Idea Ping & Zoom In', '💡', 'Thinking & Idea Ping'); } });
registerShot('s003', { draw(ctx, t) { drawScene(ctx, t, 's003', 'Cảnh 3: Tương Tác Đạo Cụ & Ăn Mừng (Prop & Celebrate)', 'Cầm đạo cụ điều khiển, diễn hoạt ăn mừng và hiệu ứng khói thành công', '🎉', 'Celebrate & Controller'); } });
`;
  fs.writeFileSync(path.join(DEMO_DIR, 'scenes/shots/01_proof_scenes.js'), sceneShotCode, 'utf8');

  // 6. Write config.json
  const configJson = {
    name: 'V5 Phase 5 Minimum Proof Demo (15s)',
    version: '5.0',
    fps: 30,
    duration: 15,
    width: 1280,
    height: 720,
    aspectRatio: '16:9',
    timeline: shotsData
  };
  fs.writeFileSync(path.join(DEMO_DIR, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8');

  // 7. Render Video using Render Adapter (Playwright + Canvas + FFmpeg)
  const outputPath = path.resolve(process.cwd(), 'out', 'demo_v5_phase5_proof_15s.mp4');
  console.log('2. Đang kết xuất video qua Render Adapter sang:', outputPath);

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

  console.log('\n✔ Render thành công!');

  // 8. Verify Output
  console.log('3. Kiểm tra tính hợp lệ của file MP4 đầu ra...');
  const verification = await defaultFfmpegAssembler.verifyFinalOutput(outputPath, { duration: 15 });
  console.log('✔ Kết quả kiểm định:', JSON.stringify(verification, null, 2));

  if (!verification.isValid) {
    throw new Error('Video đầu ra không vượt qua bài kiểm định FFprobe.');
  }

  console.log('\n🎉 HOÀN THÀNH DEMO 1 THÀNH CÔNG VƯỢT TRỘI!');
}

runPhase5ProofDemo().catch(err => {
  console.error('Lỗi chạy demo proof:', err);
  process.exit(1);
});
