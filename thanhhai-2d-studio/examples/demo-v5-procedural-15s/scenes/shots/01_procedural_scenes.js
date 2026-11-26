
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
