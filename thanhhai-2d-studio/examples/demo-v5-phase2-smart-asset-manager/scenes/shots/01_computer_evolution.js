import { registerShot } from '/engine/core.js';

function drawEvolutionScene(ctx, t, shotId, title, sub, propName) {
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 1280, 720);

  // Ground line
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 560);
  ctx.lineTo(1280, 560);
  ctx.stroke();

  // Header Title
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('THANH HAI 2D STUDIO V5 — SỰ TIẾN HÓA CỦA MÁY TÍNH', 60, 80);

  // Subtitle banner
  ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(60, 110, 1160, 90, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(title, 80, 150);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, 80, 180);

  // Character
  const cx = 360 + Math.sin(t * 3) * 15;
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(cx, 440, 55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOC', cx, 448);

  // Prop representation
  ctx.fillStyle = '#10b981';
  ctx.fillRect(720, 360, 180, 180);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BOUND ASSET:', 810, 430);
  ctx.fillStyle = '#fef08a';
  ctx.fillText(propName, 810, 470);

  // Footer metadata
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '14px monospace';
  ctx.fillText('Cảnh: ' + shotId + ' | Time: ' + t.toFixed(2) + 's | Smart Asset Manager V5', 60, 690);

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's001', 'Cảnh 1: Năm 1945 — Siêu máy tính ENIAC ra đời', 'Nhân vật: Doc (Labcoat) | Đạo cụ đã bind: REQ_PROP_ENIAC_1.png', 'ENIAC Mainframe'); } });
registerShot('s002', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's002', 'Cảnh 2: 1950s — Phát minh transistor bán dẫn', 'Thu nhỏ kích thước máy tính hàng ngàn lần | Đạo cụ đã bind: REQ_PROP_TRANSISTOR.png', 'Transistor 2N2222'); } });
registerShot('s003', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's003', 'Cảnh 3: So sánh kích thước ENIAC và vi xử lý', 'Cùng một đạo cụ ENIAC dùng lại trong 2 cảnh khác nhau', 'ENIAC (Reused)'); } });
registerShot('s004', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's004', 'Cảnh 4: Kỷ nguyên PC và Laptop cá nhân', 'Nhân vật: Jake (Hoodie) | Đạo cụ thư viện: prop_laptop', 'Laptop Modern'); } });
registerShot('s005', { draw(ctx, t) { drawEvolutionScene(ctx, t, 's005', 'Cảnh 5: Phòng lab hiện đại & Cà phê sáng tạo', 'Hành động drink_coffee được patch thành idle_talk | Đạo cụ semantic: coffee_mug', 'Coffee Cup (Semantic)'); } });
