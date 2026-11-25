// scenes/shots/01_computer_evolution.js — Phase 6 Final 60-Second Video Demo
// Story: "Sự Tiến Hóa Của Máy Tính — Từ Cỗ Máy Khổng Lồ Đến Thiết Bị Nhỏ Gọn"
// 8 Complete Storytelling Scenes with Dynamic Backgrounds, Character Continuity, Educational Graphics & Camera.

import { E, registerShot, clamp, lerp, circle, ring, poly, rr } from '/engine/core.js';
import { drawSceneBackground, getSceneGroundY } from '/engine/background-engine-v4.js';
import { drawEducationalGraphic, solveCameraState } from '/engine/master-timeline-v4.js';
import { drawWhiteCartoonFigure, drawWhiteCartoonHead, WHITE_CARTOON_PRESETS } from '/engine/white-cartoon-rig2d.js';
import { drawUniversalVfx, drawVfxFightSmoke, drawVfxImpactFlash, solveVfxCameraShake } from '/engine/vfx-engine-v4.js';
import { applyOutfitToCharacter } from '/engine/outfit-engine-v4.js';
import { solveWalkCycle } from '/engine/action-engine.js';
import { DOC, ALEX } from '../cast.js';

// Pre-configured character outfits with strict identity preservation
const docLabcoat = applyOutfitToCharacter(DOC, 'outfit_scientist_labcoat');
const docSuit = applyOutfitToCharacter(DOC, 'outfit_business_suit');
const docHoodie = applyOutfitToCharacter(DOC, 'outfit_casual_hoodie');

// Subtitle overlay helper function
function drawSubtitleBar(ctx, text, W, H) {
  if (!text) return;
  const cx = W / 2;
  const cy = H - 50;

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - 480, cy - 24, 960, 48, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, cy + 6);
  ctx.restore();
}

// ============================================================================
// SCENE 1 (0.0s - 7.0s): Hook Mở Đầu & So Sánh Kích Thước
// ============================================================================
registerShot('s001', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const p = clamp(lt / 7.0, 0, 1);
    const camera = { z: lerp(1.0, 1.10, p), x: 0, y: -5 };

    // 1. Background: Technical Blueprint
    drawSceneBackground(g, { id: 'bg_chalkboard_blueprint' }, camera, lt, W, H);

    // 2. Educational Title Card
    drawEducationalGraphic(g, {
      type: 'title_card',
      title: 'SỰ TIẾN HÓA CỦA MÁY TÍNH',
      subtitle: 'Từ Cỗ Máy Khổng Lồ Đến Thiết Bị Bỏ Túi Nhỏ Gọn',
      y: 95,
      start: 0.0,
      end: 7.0
    }, lt, W, H);

    // 3. Comparison Card
    drawEducationalGraphic(g, {
      type: 'comparison_card',
      leftTitle: 'MÁY TÍNH 1946 (ENIAC)',
      leftText: 'Nặng 30 Tấn • Rộng 167 m² • 150 kW',
      rightTitle: 'SMARTPHONE HIỆN ĐẠI',
      rightText: 'Nặng 180g • Bỏ Túi • Hàng Tỷ Transistor',
      y: 200,
      start: 1.0,
      end: 7.0
    }, lt, W, H);

    // 4. Silhouette illustration of giant room vs small phone on table
    const groundY = H * 0.80;
    g.save();
    g.fillStyle = 'rgba(255, 255, 255, 0.08)';
    g.strokeStyle = '#38bdf8';
    g.lineWidth = 2;
    // Giant ENIAC outline silhouette
    g.strokeRect(W / 2 - 420, groundY - 220, 260, 220);
    g.fillStyle = '#38bdf8';
    g.font = 'bold 12px monospace';
    g.textAlign = 'center';
    g.fillText('ENIAC CABINETS', W / 2 - 290, groundY - 100);

    // Small modern smartphone outline
    g.fillStyle = '#10b981';
    g.beginPath();
    g.roundRect(W / 2 + 250, groundY - 80, 45, 80, 6);
    g.fill();
    g.fillStyle = '#f8fafc';
    g.fillText('PHONE', W / 2 + 272, groundY - 35);
    g.restore();

    // 5. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 2 (7.0s - 15.0s): Phòng Máy Tính Lịch Sử 1946 & ENIAC
// ============================================================================
registerShot('s002', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const groundY = H * 0.82;
    const p = clamp(lt / 8.0, 0, 1);
    const camera = { z: 1.15, x: lerp(-30, 20, p), y: -10 };

    // 1. Background: Historical ENIAC Room
    drawSceneBackground(g, { id: 'bg_historical_computer_lab', groundY: 0.82 }, camera, lt, W, H);

    // 2. Scientist Doc walking and explaining
    const isWalking = lt < 4.0;
    const walkX = isWalking ? lerp(200, 480, lt / 4.0) : 480;

    drawWhiteCartoonFigure(g, {
      x: walkX,
      y: groundY,
      outfit: docLabcoat,
      pose: isWalking ? solveWalkCycle(lt * 1.6) : 'custom',
      armR: isWalking ? null : -0.7, // Pointing towards ENIAC
      armL: isWalking ? null : 0.2,
      facing: 1,
      expr: 'talking',
      mouth: (Math.sin(lt * 10) > 0) ? 0.35 : 0.1,
      ink: '#20202A',
      scale: 1.05
    });

    // 3. Technical Callout Info Box on right
    drawEducationalGraphic(g, {
      type: 'callout_box',
      x: 680,
      y: 140,
      w: 420,
      h: 210,
      title: '🏛️ CỖ MÁY TÍNH ENIAC (1946):',
      items: [
        'Địa điểm: Đại học Pennsylvania (Mỹ)',
        'Trọng lượng: 30 Tấn kim loại',
        'Diện tích: Chiếm trọn 167 m²',
        'Tốc độ: 5,000 phép cộng/giây'
      ],
      start: 1.0,
      end: 8.0
    }, lt, W, H);

    // 4. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 3 (15.0s - 23.0s): Sơ Đồ Cấu Tạo & Thách Thức Nhiệt Lượng
// ============================================================================
registerShot('s003', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const camera = { z: 1.12, x: 0, y: -10 };

    // 1. Background: Technical Diagram Grid
    drawSceneBackground(g, { id: 'bg_diagram_grid' }, camera, lt, W, H);

    // 2. Info Box: Heat & Vacuum Tube Problems
    drawEducationalGraphic(g, {
      type: 'callout_box',
      x: 100,
      y: 150,
      w: 480,
      h: 220,
      title: '⚡ THÁCH THỨC VẬN HÀNH KHỔNG LỒ:',
      items: [
        'Sử dụng: 18,000 bóng đèn chân không',
        'Điện năng: 150 Kilowatt liên tục',
        'Tỏa nhiệt cực lớn, đòi hỏi hệ thống thông gió',
        'Bóng đèn hỏng liên tục, cần bảo trì hàng ngày'
      ],
      start: 0.0,
      end: 8.0
    }, lt, W, H);

    // 3. Glowing Vacuum Tube Diagram on the right
    const tx = 820;
    const ty = 250;
    g.save();
    // Glass tube cylinder
    g.fillStyle = 'rgba(245, 158, 11, 0.15)';
    g.strokeStyle = '#f59e0b';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(tx - 60, ty - 90, 120, 180, 40);
    g.fill();
    g.stroke();

    // Hot filament inside
    const flicker = Math.sin(lt * 12) * 0.15 + 0.85;
    g.fillStyle = `rgba(254, 240, 138, ${flicker})`;
    g.fillRect(tx - 6, ty - 50, 12, 100);

    // Heat waves rising
    g.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const hx = tx - 30 + i * 30;
      const hy = ty - 110 - ((lt * 50 + i * 20) % 60);
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx + Math.sin(lt * 6 + i) * 8, hy - 25);
      g.stroke();
    }

    g.fillStyle = '#f8fafc';
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    g.fillText('BÓNG ĐÈN CHÂN KHÔNG (VACUUM TUBE)', tx, ty + 120);
    g.restore();

    // 4. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 4 (23.0s - 31.0s): Nghiên Cứu Phòng Thí Nghiệm & Eureka
// ============================================================================
registerShot('s004', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const groundY = H * 0.82;
    const isEureka = lt >= 3.0;
    const camera = { z: isEureka ? 1.25 : 1.15, x: 0, y: isEureka ? -20 : -10 };

    // 1. Background: Modern Research Lab
    drawSceneBackground(g, { id: 'bg_lab_modern' }, camera, lt, W, H);

    // 2. Doc pondering -> Eureka idea
    drawWhiteCartoonFigure(g, {
      x: W / 2,
      y: groundY,
      outfit: docLabcoat,
      pose: 'custom',
      armR: isEureka ? -1.3 : -0.6,
      armL: 0.2,
      expr: isEureka ? 'surprised' : 'thinking',
      mouth: isEureka ? 0.45 : 0.1,
      ink: '#20202A',
      scale: 1.05
    });

    // 3. Eureka Lightbulb & Sparkles
    if (isEureka) {
      drawUniversalVfx(g, W / 2, groundY - 180, 'vfx_idea_bulb', lt - 3.0, { scale: 1.3 });
      g.save();
      g.fillStyle = '#fbbf24';
      g.font = 'bold 18px sans-serif';
      g.textAlign = 'center';
      g.fillText('💡 "TÌM RA GIẢI PHÁP: CHẤT BÁN DẪN!"', W / 2, groundY - 225);
      g.restore();
    }

    // 4. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 5 (31.0s - 39.0s): Thử Nghiệm Cháy Bóng & Khói Nổ
// ============================================================================
registerShot('s005', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const groundY = H * 0.82;
    const isExplode = lt >= 1.5 && lt <= 4.5;

    let camShake = 0;
    if (isExplode) {
      camShake = 12.0;
    }
    const camera = { z: 1.20, x: 0, y: -10, shake: camShake };

    // 1. Background: Historical Lab
    drawSceneBackground(g, { id: 'bg_historical_computer_lab' }, camera, lt, W, H);

    // 2. Shock / Flash effect on explosion
    if (lt >= 1.5 && lt <= 2.2) {
      drawVfxImpactFlash(g, W / 2, groundY - 100, lt - 1.5, { scale: 2.0 });
    }

    // 3. Smoke Cloud billowing
    if (isExplode) {
      drawVfxFightSmoke(g, W / 2 + 100, groundY - 80, lt - 1.5, { scale: 1.4 });
    }

    // 4. Doc shocked but standing firm, identity preserved!
    drawWhiteCartoonFigure(g, {
      x: W / 2 - 80,
      y: groundY,
      outfit: docLabcoat,
      pose: 'custom',
      armR: isExplode ? -1.1 : -0.3,
      armL: isExplode ? -0.9 : 0.2,
      expr: isExplode ? 'shocked' : 'determined',
      mouth: isExplode ? 0.4 : 0.15,
      ink: '#20202A',
      scale: 1.05
    });

    // 5. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 6 (39.0s - 47.0s): Phát Minh Transistor & Dòng Thời Gian
// ============================================================================
registerShot('s006', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const camera = { z: 1.10, x: 0, y: -10 };

    // 1. Background: Blueprint Technical Grid
    drawSceneBackground(g, { id: 'bg_chalkboard_blueprint' }, camera, lt, W, H);

    // 2. Timeline Badges
    drawEducationalGraphic(g, {
      type: 'timeline_badge',
      year: '1947',
      event: 'Transistor ra đời (Bell Labs)',
      x: 120,
      y: 120,
      start: 0.0,
      end: 8.0
    }, lt, W, H);

    drawEducationalGraphic(g, {
      type: 'timeline_badge',
      year: '1971',
      event: 'Vi xử lý Intel 4004',
      x: 120,
      y: 200,
      start: 2.0,
      end: 8.0
    }, lt, W, H);

    // 3. Info Callout Box
    drawEducationalGraphic(g, {
      type: 'callout_box',
      x: 480,
      y: 120,
      w: 620,
      h: 210,
      title: '💎 KỶ NGUYÊN BÁN DẪN & VI XỬ LÝ (MICROPROCESSOR):',
      items: [
        'Transistor thay thế hoàn toàn bóng đèn chân không',
        'Kích thước thu nhỏ từ milimet xuống nanomet',
        'Tích hợp hàng triệu transistor lên tấm silicon nhỏ bằng móng tay',
        'Tiết kiệm điện năng vượt trội, độ bền hàng chục năm'
      ],
      start: 1.0,
      end: 8.0
    }, lt, W, H);

    // 4. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 7 (47.0s - 54.0s): Camera Pan So Sánh 4 Thế Hệ Máy Tính
// ============================================================================
registerShot('s007', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const p = clamp(lt / 7.0, 0, 1);
    // Smooth Camera Pan across 4 generations
    const camera = { z: 1.10, x: lerp(-120, 120, p), y: -5 };

    // 1. Background: Diagram Grid
    drawSceneBackground(g, { id: 'bg_diagram_grid' }, camera, lt, W, H);

    // 2. Four Generations Strip
    const groundY = H * 0.75;
    const items = [
      { year: '1946', label: 'ENIAC (Gian phòng 30T)', col: '#f59e0b', w: 140, h: 180 },
      { year: '1981', label: 'Desktop PC (Bàn máy)', col: '#38bdf8', w: 100, h: 110 },
      { year: '2000', label: 'Laptop (Xách tay 2kg)', col: '#a855f7', w: 80, h: 65 },
      { year: '2026', label: 'Smartphone (Túi 180g)', col: '#10b981', w: 40, h: 75 }
    ];

    g.save();
    items.forEach((item, i) => {
      const ix = 180 + i * 260 - camera.x * 0.5;
      const iy = groundY - item.h;

      // Item Box
      g.fillStyle = 'rgba(30, 41, 59, 0.85)';
      g.strokeStyle = item.col;
      g.lineWidth = 3;
      g.beginPath();
      g.roundRect(ix - item.w / 2, iy, item.w, item.h, 6);
      g.fill();
      g.stroke();

      // Year badge
      g.fillStyle = item.col;
      g.font = 'bold 15px monospace';
      g.textAlign = 'center';
      g.fillText(item.year, ix, groundY + 28);

      g.fillStyle = '#f8fafc';
      g.font = '11px sans-serif';
      g.fillText(item.label, ix, groundY + 48);
    });
    g.restore();

    // 3. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});

// ============================================================================
// SCENE 8 (54.0s - 60.0s): Kết Luận, Studio Hiện Đại & Chào Tạm Biệt
// ============================================================================
registerShot('s008', {
  draw(g, lt, info) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const groundY = H * 0.82;
    const p = clamp(lt / 6.0, 0, 1);
    const camera = { z: lerp(1.20, 1.05, p), x: 0, y: -10 };

    // 1. Background: Minimal Modern Studio
    drawSceneBackground(g, { id: 'bg_minimal_studio' }, camera, lt, W, H);

    // 2. Doc in Business Suit waving goodbye and smiling
    const waveAngle = Math.sin(lt * 3) * 0.3 - 0.9;
    drawWhiteCartoonFigure(g, {
      x: W / 2,
      y: groundY,
      outfit: docSuit,
      pose: 'custom',
      armR: waveAngle,
      armL: 0.15,
      expr: 'happy',
      mouth: 0.25,
      ink: '#20202A',
      scale: 1.05
    });

    // 3. Final Title Banner
    g.save();
    g.fillStyle = 'rgba(15, 23, 42, 0.92)';
    g.strokeStyle = '#10b981';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(W / 2 - 320, 60, 640, 60, 8);
    g.fill();
    g.stroke();

    g.fillStyle = '#10b981';
    g.font = 'bold 18px sans-serif';
    g.textAlign = 'center';
    g.fillText('THANH HAI 2D STUDIO V4 — HOÀN THÀNH SẢN XUẤT!', W / 2, 98);
    g.restore();

    // 4. Subtitle
    drawSubtitleBar(g, info.line, W, H);
  }
});
