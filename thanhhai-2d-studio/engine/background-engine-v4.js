// engine/background-engine-v4.js — Universal Background Library & Parallax Engine (V4)
// Provides 4 categories of high-fidelity 2D backgrounds (Indoor, Outdoor, Historical, Educational),
// multi-layer parallax depth rendering, ground-line alignment, and image import adjustments.

import { clamp, lerp } from './core.js';

export const BACKGROUND_CATEGORIES = {
  INDOOR: 'indoor',
  OUTDOOR: 'outdoor',
  HISTORICAL: 'historical',
  EDUCATIONAL: 'educational'
};

export const BACKGROUND_CATALOG = {
  // 1. INDOOR BACKGROUNDS
  bg_lab_modern: {
    id: 'bg_lab_modern',
    name: 'Phòng Thí Nghiệm Hiện Đại (Modern Lab)',
    category: BACKGROUND_CATEGORIES.INDOOR,
    description: 'Phòng nghiên cứu công nghệ cao với bảng mạch phát sáng, kệ hóa chất và cửa kính nhìn ra thành phố.',
    groundY: 0.82,
    hasParallax: true,
    layers: [
      { id: 'sky', depth: 0.1, color: '#030712' },
      { id: 'far', depth: 0.3, type: 'city_skyline' },
      { id: 'mid', depth: 0.7, type: 'lab_equipment' },
      { id: 'ground', depth: 1.0, type: 'lab_floor' }
    ]
  },
  bg_workshop_steampunk: {
    id: 'bg_workshop_steampunk',
    name: 'Xưởng Chế Tác Steampunk (Inventor Workshop)',
    category: BACKGROUND_CATEGORIES.INDOOR,
    description: 'Xưởng cơ khí thế kỷ 19 với bánh răng đồng thau khổng lồ, ống dẫn hơi nước và bản vẽ sáng chế.',
    groundY: 0.82,
    hasParallax: true,
    layers: [
      { id: 'sky', depth: 0.1, color: '#1c1917' },
      { id: 'far', depth: 0.3, type: 'gears_wall' },
      { id: 'mid', depth: 0.7, type: 'workbench' },
      { id: 'ground', depth: 1.0, type: 'wood_floor' }
    ]
  },
  bg_office_modern: {
    id: 'bg_office_modern',
    name: 'Văn Phòng Công Nghệ (Modern Tech Office)',
    category: BACKGROUND_CATEGORIES.INDOOR,
    description: 'Không gian văn phòng hiện đại với vách kính, bàn làm việc máy tính và ánh đèn LED âm trần.',
    groundY: 0.80,
    hasParallax: false
  },
  bg_classroom: {
    id: 'bg_classroom',
    name: 'Lớp Học Hoạt Hình (Cartoon Classroom)',
    category: BACKGROUND_CATEGORIES.INDOOR,
    description: 'Phòng học thân thiện với bảng đen lớn, bàn ghế gỗ và cửa sổ đón nắng.',
    groundY: 0.80,
    hasParallax: false
  },

  // 2. OUTDOOR BACKGROUNDS
  bg_city_street_dusk: {
    id: 'bg_city_street_dusk',
    name: 'Phố Chiều Hoàng Hôn (City Street Dusk)',
    category: BACKGROUND_CATEGORIES.OUTDOOR,
    description: 'Đường phố đô thị lúc chạng vạng với ánh đèn cửa hiệu vàng ấm và các tòa cao ốc xa xăm.',
    groundY: 0.80,
    hasParallax: true,
    layers: [
      { id: 'sky', depth: 0.1, color: '#1e1b4b' },
      { id: 'far', depth: 0.3, type: 'distant_towers' },
      { id: 'mid', depth: 0.6, type: 'shopfronts' },
      { id: 'ground', depth: 1.0, type: 'pavement' }
    ]
  },
  bg_park_sunny: {
    id: 'bg_park_sunny',
    name: 'Công Viên Xanh Nắng Ấm (Sunny Park)',
    category: BACKGROUND_CATEGORIES.OUTDOOR,
    description: 'Công viên cây xanh mát mẻ với đồi cỏ uốn lượn, mây trắng bồng bềnh và lối đi dạo.',
    groundY: 0.80,
    hasParallax: true
  },
  bg_snowy_plain: {
    id: 'bg_snowy_plain',
    name: 'Cánh Đồng Tuyết Trắng (Winter Snowy Plain)',
    category: BACKGROUND_CATEGORIES.OUTDOOR,
    description: 'Khung cảnh mùa đông phủ tuyết trắng xóa dưới bầu trời tím sẫm lạnh giá.',
    groundY: 0.82,
    hasParallax: true
  },

  // 3. HISTORICAL BACKGROUNDS
  bg_historical_computer_lab: {
    id: 'bg_historical_computer_lab',
    name: 'Phòng Máy Tính Lịch Sử 1946 (Historical ENIAC Room)',
    category: BACKGROUND_CATEGORIES.HISTORICAL,
    description: 'Phòng đặt cỗ máy tính khổng lồ thời kỳ đầu (ENIAC / Đèn điện tử chân không) với hàng chục tủ thép, dây cáp chằng chịt, đồng hồ kim vạn năng và bóng đèn chân không phát sáng cam dịu.',
    groundY: 0.82,
    hasParallax: true,
    layers: [
      { id: 'sky', depth: 0.1, color: '#090d16' },
      { id: 'far', depth: 0.3, type: 'vacuum_tube_cabinets' },
      { id: 'mid', depth: 0.7, type: 'main_console_panels' },
      { id: 'ground', depth: 1.0, type: 'industrial_floor' }
    ]
  },
  bg_historical_workshop: {
    id: 'bg_historical_workshop',
    name: 'Xưởng Cơ Khí Thế Kỷ 19 (Industrial Revolution Workshop)',
    category: BACKGROUND_CATEGORIES.HISTORICAL,
    description: 'Xưởng máy hơi nước thời kỳ Cách mạng Công nghiệp với trục truyền động dây đai và lò nung.',
    groundY: 0.82,
    hasParallax: true
  },

  // 4. EDUCATIONAL & PRESENTATION BACKGROUNDS
  bg_chalkboard_blueprint: {
    id: 'bg_chalkboard_blueprint',
    name: 'Bản Vẽ Kỹ Thuật Lam (Blueprint Technical Grid)',
    category: BACKGROUND_CATEGORIES.EDUCATIONAL,
    description: 'Phông nền màu xanh lam chuyên dụng với lưới tọa độ mm, thước đo tỷ lệ và ghi chú kỹ thuật.',
    groundY: 0.80,
    hasParallax: false
  },
  bg_whiteboard_clean: {
    id: 'bg_whiteboard_clean',
    name: 'Bảng Trắng Thuyết Trình (Minimal Whiteboard)',
    category: BACKGROUND_CATEGORIES.EDUCATIONAL,
    description: 'Khung bảng trắng sạch sẽ, viền nhôm tinh tế, tối ưu cho sơ đồ tư duy và đồ họa so sánh.',
    groundY: 0.80,
    hasParallax: false
  },
  bg_diagram_grid: {
    id: 'bg_diagram_grid',
    name: 'Lưới Sơ Đồ Công Nghệ (Tech Diagram Grid)',
    category: BACKGROUND_CATEGORIES.EDUCATIONAL,
    description: 'Nền lưới đồ họa công nghệ cao sắc nét để hiển thị sơ đồ linh kiện và mốc thời gian.',
    groundY: 0.80,
    hasParallax: false
  },
  bg_minimal_studio: {
    id: 'bg_minimal_studio',
    name: 'Studio Tối Giản (Minimal Studio)',
    category: BACKGROUND_CATEGORIES.EDUCATIONAL,
    description: 'Không gian studio xám đậm thanh lịch với sàn cong vô cực đổ bóng mềm mại.',
    groundY: 0.80,
    hasParallax: false
  }
};

// Aliases for convenience and hyphenated asset IDs
BACKGROUND_CATALOG['bg-hist-eniac-lab'] = BACKGROUND_CATALOG.bg_historical_computer_lab;
BACKGROUND_CATALOG['bg-indoor-office-room'] = BACKGROUND_CATALOG.bg_office_modern;
BACKGROUND_CATALOG['bg_eniac_lab'] = BACKGROUND_CATALOG.bg_historical_computer_lab;
BACKGROUND_CATALOG['bg_office_room'] = BACKGROUND_CATALOG.bg_office_modern;


/**
 * Lấy vị trí mặt đất (Ground Y) theo tỷ lệ chiều cao Canvas
 */
export function getSceneGroundY(bgSpec = {}, H = 720) {
  const bgId = bgSpec.id || 'bg_lab_modern';
  const def = BACKGROUND_CATALOG[bgId];
  const ratio = bgSpec.groundY ?? (def ? def.groundY : 0.80);
  return ratio <= 1.0 ? H * ratio : ratio;
}

/**
 * 2. PROCEDURAL HIGH-FIDELITY VECTOR BACKGROUND RENDERER
 * Renders rich, deterministic backgrounds across all 4 categories with full parallax support.
 */
export function drawSceneBackground(ctx, bgSpec = {}, camera = { x: 0, y: 0, z: 1.0 }, t = 0, W = 1280, H = 720) {
  const bgId = bgSpec.assetId || bgSpec.id || 'bg_lab_modern';
  const groundY = getSceneGroundY(bgSpec, H);
  const cx = W / 2;
  const camX = camera.x || 0;
  const camY = camera.y || 0;
  const camZ = camera.z || 1.0;

  ctx.save();

  // Apply visual adjustments
  if (bgSpec.brightness && bgSpec.brightness !== 1.0) {
    ctx.filter = `brightness(${bgSpec.brightness})`;
  }
  if (bgSpec.contrast && bgSpec.contrast !== 1.0) {
    ctx.filter = (ctx.filter ? ctx.filter + ' ' : '') + `contrast(${bgSpec.contrast})`;
  }

  // ==========================================================================
  // 1. HISTORICAL ENIAC COMPUTER LAB (1946) — Bối Cảnh Lịch Sử Máy Tính
  // ==========================================================================
  if (bgId === 'bg_historical_computer_lab') {
    // Parallax Layer 1: Deep Studio Wall (Depth 0.2)
    const px1 = -camX * 0.15;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#040711');
    bgGrad.addColorStop(0.5, '#0b1329');
    bgGrad.addColorStop(1, '#172033');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.3, -H * 0.3, W * 1.6, H * 1.6);

    // Parallax Layer 2: Massive Vacuum Tube Racks & Cable Trays (Depth 0.45)
    const px2 = -camX * 0.35;
    const rackCount = 7;
    const rackW = 160;
    const spacing = 180;
    const startX = cx - 550 + px2;

    for (let i = 0; i < rackCount; i++) {
      const rx = startX + i * spacing;
      const ry = groundY - 320;

      // Steel cabinet frame
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.fillRect(rx, ry, rackW, 310);
      ctx.strokeRect(rx, ry, rackW, 310);

      // Vacuum Tube Shelves (Bóng đèn điện tử phát quang cam cổ điển)
      for (let row = 0; row < 4; row++) {
        const sy = ry + 25 + row * 65;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(rx + 10, sy, rackW - 20, 52);

        // Glowing orange/yellow vacuum tubes
        for (let col = 0; col < 6; col++) {
          const tx = rx + 22 + col * 20;
          const ty = sy + 30;
          const flicker = Math.sin(t * 8 + i * 3 + row * 2 + col) * 0.2 + 0.8;

          // Tube glass glow
          ctx.fillStyle = `rgba(245, 158, 11, ${0.15 * flicker})`;
          ctx.beginPath();
          ctx.arc(tx, ty, 9, 0, Math.PI * 2);
          ctx.fill();

          // Inner hot tungsten filament
          ctx.fillStyle = `rgba(254, 240, 138, ${0.9 * flicker})`;
          ctx.fillRect(tx - 2, ty - 6, 4, 12);
        }
      }

      // Blinking signal lights & patch cables
      for (let led = 0; led < 5; led++) {
        const ledCol = (i + led + Math.floor(t * 3)) % 3 === 0 ? '#ef4444' : '#10b981';
        ctx.fillStyle = ledCol;
        ctx.beginPath();
        ctx.arc(rx + 25 + led * 26, ry + 295, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Parallax Layer 3: Overhead Cable Trays & Hanging Wires (Depth 0.6)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.lineWidth = 4;
    for (let c = 0; c < 5; c++) {
      const cy = 40 + c * 18;
      ctx.beginPath();
      ctx.moveTo(-W * 0.1, cy);
      ctx.bezierCurveTo(cx - 200 + px2, cy + 40, cx + 200 + px2, cy + 20, W * 1.1, cy + 10);
      ctx.stroke();
    }

    // Parallax Layer 4: Heavy Steel Floor & Ground Boundary (Depth 1.0)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-W * 0.2, groundY, W * 1.4, H - groundY + 80);

    // Grid tiles on concrete floor
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1.5;
    for (let gx = -W * 0.2; gx <= W * 1.2; gx += 70) {
      ctx.beginPath();
      ctx.moveTo(gx - camX, groundY);
      ctx.lineTo(gx - camX * 1.2, H);
      ctx.stroke();
    }
  }

  // ==========================================================================
  // 2. BLUEPRINT & TECHNICAL CHALKBOARD (Educational)
  // ==========================================================================
  else if (bgId === 'bg_chalkboard_blueprint' || bgId === 'bg_diagram_grid') {
    // Deep blueprint blue
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0c4a6e');
    bgGrad.addColorStop(1, '#075985');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

    // Coordinate Blueprint Grid (10px & 50px)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Major grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x < W; x += 150) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Technical border & corner measurement markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, W - 60, H - 60);

    // Floor horizon line
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  // ==========================================================================
  // 3. MINIMAL CLEAN WHITEBOARD (Educational Presentation)
  // ==========================================================================
  else if (bgId === 'bg_whiteboard_clean') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

    // Board inner shadow & frame
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 8;
    ctx.strokeRect(20, 20, W - 40, H - 40);

    // Floor baseline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  // ==========================================================================
  // 4. MODERN LAB / DEFAULT INDOOR
  // ==========================================================================
  else {
    // Deep twilight sky & modern lab/studio
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0a0f1d');
    bgGrad.addColorStop(0.6, '#111827');
    bgGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

    // Large glass windows looking at distant skyline
    const px = -camX * 0.2;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fillRect(cx - 380 + px, groundY - 320, 240, 200);
    ctx.fillRect(cx + 140 + px, groundY - 320, 240, 200);

    // Floor line
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-W * 0.2, groundY, W * 1.4, H - groundY + 40);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-W * 0.2, groundY);
    ctx.lineTo(W * 1.2, groundY);
    ctx.stroke();
  }

  // Color Overlay tint if provided
  if (bgSpec.colorOverlay) {
    ctx.fillStyle = bgSpec.colorOverlay;
    ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
  }

  ctx.restore();
}

/**
 * Align entity bottom or origin to the scene ground level.
 * @param {number} entityY
 * @param {number} groundY
 * @param {number} offset
 * @returns {number}
 */
export function alignEntityToGround(entityY, groundY = 560, offset = 0) {
  return groundY + offset;
}

