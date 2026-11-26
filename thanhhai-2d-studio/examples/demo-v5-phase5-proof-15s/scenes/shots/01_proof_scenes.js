
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
