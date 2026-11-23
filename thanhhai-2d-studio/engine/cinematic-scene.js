// engine/cinematic-scene.js — Cinematic 2D Illustration Backgrounds & Layered Environments
// Implements multi-layer parallax, dynamic lighting passes, contact shadows, and film atmosphere.

import { E, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease, linGrad, radGrad, glow } from './core.js';

/**
 * Standard Color Palettes for Cinematic Environments
 */
export const CINEMATIC_PALETTES = {
  night_exterior: {
    skyTop: '#080a14',
    skyBot: '#141c30',
    moon: '#fef08a',
    moonGlow: 'rgba(254, 240, 138, 0.18)',
    cloud: 'rgba(30, 41, 59, 0.45)',
    buildingFar: '#0e1424',
    buildingMid: '#161f36',
    street: '#1a1d29',
    sidewalk: '#262a3b',
    curb: '#383d52',
    lampPost: '#1e2433',
    lampLight: '#fef08a',
    lampGlow: 'rgba(254, 240, 138, 0.22)',
    ink: '#111827'
  },
  dark_entry: {
    wallDark: '#0b0f19',
    wallTrim: '#151d30',
    doorWood: '#1c1917',
    doorFrame: '#292524',
    floor: '#0f1422',
    moonSlit: 'rgba(147, 197, 253, 0.25)',
    switchPlate: '#334155',
    switchOn: '#22c55e',
    switchOff: '#94a3b8',
    warmFlood: '#fffbeb',
    ink: '#090d16'
  },
  cozy_living_room: {
    wall: '#1e2538',
    wallStripe: '#252e45',
    baseboard: '#141926',
    floor: '#3a2b25',
    floorPlank: '#2c201c',
    rug: '#991b1b',
    rugBorder: '#fbbf24',
    sofaBody: '#1e3a8a',
    sofaCushion: '#2563eb',
    sofaWood: '#172554',
    shelfWood: '#78350f',
    windowFrame: '#0f172a',
    windowGlass: '#090d16',
    curtain: '#831843',
    lampShade: '#fef08a',
    lampStand: '#d97706',
    lampGlow: 'rgba(254, 240, 138, 0.28)',
    blanket: '#1e3a5f',
    blanketPlaid: '#60a5fa',
    ink: '#0f172a'
  },
  tense_hallway: {
    wallLeft: '#111827',
    wallRight: '#0f172a',
    wallBack: '#030712',
    doorOpen: '#020617',
    floor: '#1f2937',
    floorShadow: 'rgba(0,0,0,0.65)',
    shadowLength: 320,
    ink: '#090d16'
  }
};

/**
 * 1. BỐI CẢNH NGOÀI PHỐ ĐÊM (Night Exterior Street)
 * Dành cho Cảnh 1: Nam đi bộ về nhà ban đêm dưới ánh đèn đường
 */
export function drawStreetNightBackground(g, t, cam = { z: 1, x: 0, y: 0 }, o = {}) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.night_exterior;

  g.save();
  // Camera transform
  g.translate(W / 2, H / 2);
  g.scale(cam.z || 1, cam.z || 1);
  g.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0));

  // --- LAYER 1: SKY & MOON (Distant Parallax 0.15) ---
  const skyGrad = g.createLinearGradient(0, 0, 0, H * 0.7);
  skyGrad.addColorStop(0, pal.skyTop);
  skyGrad.addColorStop(1, pal.skyBot);
  g.fillStyle = skyGrad;
  g.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

  // Mặt trăng tròn sáng
  const moonX = W * 0.78 - (cam.x || 0) * 0.1;
  const moonY = H * 0.22 - (cam.y || 0) * 0.1;
  glow(g, moonX, moonY, 180, pal.moonGlow, 1.0);
  circle(g, moonX, moonY, 54, pal.moon);
  // Hố mặt trăng mờ nhẹ
  circle(g, moonX - 12, moonY - 14, 12, 'rgba(202, 138, 4, 0.22)');
  circle(g, moonX + 16, moonY + 8, 16, 'rgba(202, 138, 4, 0.18)');
  circle(g, moonX - 6, moonY + 18, 9, 'rgba(202, 138, 4, 0.18)');

  // Mây đêm bay lượn nhẹ
  for (let c = 0; c < 3; c++) {
    const cx = (W * 0.2 + c * 480 + t * 14) % (W * 1.3) - W * 0.15;
    const cy = H * 0.18 + c * 50;
    g.fillStyle = pal.cloud;
    g.beginPath();
    g.ellipse(cx, cy, 140, 26, 0, 0, Math.PI * 2);
    g.ellipse(cx + 40, cy - 10, 80, 22, 0, 0, Math.PI * 2);
    g.fill();
  }

  // --- LAYER 2: CITY ROOFTOPS (Mid-Distant Parallax 0.35) ---
  const bldgBaseY = H * 0.65;
  g.fillStyle = pal.buildingFar;
  // Dãy nhà xa
  const farBldgs = [
    [W * 0.05, 320, 220], [W * 0.22, 280, 180], [W * 0.40, 360, 240],
    [W * 0.62, 300, 200], [W * 0.80, 340, 260]
  ];
  farBldgs.forEach(([bx, bw, bh]) => {
    g.fillRect(bx, bldgBaseY - bh, bw, bh + 100);
    // Vài ô cửa sổ bật đèn vàng nhạt
    g.fillStyle = 'rgba(254, 240, 138, 0.35)';
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 2; col++) {
        if ((r + col + bx) % 3 !== 0) {
          g.fillRect(bx + 25 + col * 55, bldgBaseY - bh + 30 + r * 50, 22, 30);
        }
      }
    }
    g.fillStyle = pal.buildingFar;
  });

  // Dãy nhà gần hơn có mái tam giác / ống khói
  g.fillStyle = pal.buildingMid;
  const midBldgs = [
    [W * 0.12, 260, 260], [W * 0.34, 300, 310], [W * 0.70, 280, 290]
  ];
  midBldgs.forEach(([bx, bw, bh]) => {
    g.fillRect(bx, bldgBaseY - bh, bw, bh + 100);
    // Mái chóp
    poly(g, [[bx - 10, bldgBaseY - bh], [bx + bw / 2, bldgBaseY - bh - 60], [bx + bw + 10, bldgBaseY - bh]], pal.buildingMid);
  });

  // Hàng rào và bụi cây đen ven đường
  g.fillStyle = '#0f172a';
  for (let bx = 0; bx < W; bx += 90) {
    g.beginPath();
    g.ellipse(bx + 45, bldgBaseY + 10, 55, 30, 0, Math.PI, Math.PI * 2);
    g.fill();
  }

  // --- LAYER 3: STREET & SIDEWALK (Full Ground Plane Y = 0.78 * H) ---
  const groundY = H * 0.78;
  const streetGrad = g.createLinearGradient(0, groundY, 0, H);
  streetGrad.addColorStop(0, pal.sidewalk);
  streetGrad.addColorStop(0.2, pal.curb);
  streetGrad.addColorStop(0.25, pal.street);
  streetGrad.addColorStop(1, '#0d0f17');
  g.fillStyle = streetGrad;
  g.fillRect(-W * 0.2, groundY, W * 1.4, H - groundY + 100);

  // Gờ vỉa hè (Curb edge line)
  g.strokeStyle = '#475569';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-W * 0.2, groundY + 35);
  g.lineTo(W * 1.2, groundY + 35);
  g.stroke();

  // Vạch kẻ đường đứt đoạn
  g.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  g.lineWidth = 6;
  g.setLineDash([40, 40]);
  g.beginPath();
  g.moveTo(-W * 0.2, groundY + 120);
  g.lineTo(W * 1.2, groundY + 120);
  g.stroke();
  g.setLineDash([]);

  // --- LAYER 4: STREET LAMP (Cột đèn đường cổ điển phát sáng ấm) ---
  const lampX = W * 0.38;
  const lampFootY = groundY + 25;
  const lampHeadY = groundY - 380;

  // Trụ đèn
  g.strokeStyle = pal.lampPost;
  g.lineWidth = 14;
  g.beginPath();
  g.moveTo(lampX, lampFootY);
  g.lineTo(lampX, lampHeadY);
  g.stroke();

  // Chân đế cột đèn
  g.fillStyle = pal.lampPost;
  rr(g, lampX - 22, lampFootY - 25, 44, 25, 5);
  g.fill();

  // Cần uốn cong treo đèn
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(lampX, lampHeadY);
  g.quadraticCurveTo(lampX, lampHeadY - 40, lampX + 45, lampHeadY - 40);
  g.lineTo(lampX + 65, lampHeadY - 20);
  g.stroke();

  // Chao đèn & bóng đèn
  poly(g, [
    [lampX + 40, lampHeadY - 20],
    [lampX + 90, lampHeadY - 20],
    [lampX + 98, lampHeadY + 5],
    [lampX + 32, lampHeadY + 5]
  ], pal.lampPost);

  circle(g, lampX + 65, lampHeadY + 14, 18, pal.lampLight);

  // Vùng sáng rọi xuống mặt đất (Volumetric light cone)
  g.save();
  const coneGrad = g.createRadialGradient(lampX + 65, groundY + 60, 20, lampX + 65, groundY + 60, 360);
  coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  coneGrad.addColorStop(0.5, 'rgba(254, 240, 138, 0.18)');
  coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
  g.fillStyle = coneGrad;
  g.beginPath();
  g.ellipse(lampX + 65, groundY + 50, 360, 110, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.restore();

  return { groundY, lampX, lampFootY };
}

/**
 * 2. BỐI CẢNH CỬA VÀ PHÒNG TỐI KHI VỪA VỀ NHÀ (Dark Entry Hallway)
 * Dành cho Cảnh 2: Nam mở cửa bước vào, phòng tối đen, bật công tắc đèn bừng sáng
 */
export function drawEntryHallwayScene(g, t, isLightOn = false, lightProgress = 0, cam = { z: 1, x: 0, y: 0 }) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.dark_entry;

  g.save();
  g.translate(W / 2, H / 2);
  g.scale(cam.z || 1, cam.z || 1);
  g.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0));

  const groundY = H * 0.82;

  // 1. Màu tường phòng (Tối đen hoặc Vàng ấm khi bật đèn)
  const wallCol = isLightOn
    ? mix('#181824', '#f1e7d0', ease.out(lightProgress))
    : '#0c0f18';
  g.fillStyle = wallCol;
  g.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

  // Sọc họa tiết giấy dán tường sang trọng
  if (isLightOn && lightProgress > 0.1) {
    g.strokeStyle = 'rgba(217, 119, 6, 0.08)';
    g.lineWidth = 3;
    for (let x = -W * 0.1; x < W * 1.2; x += 44) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, groundY);
      g.stroke();
    }
  }

  // 2. Cửa ra vào phía sau (Front Door)
  const doorW = 280;
  const doorH = 620;
  const doorX = W * 0.22;
  const doorY = groundY - doorH;

  // Khung cửa
  g.fillStyle = '#1c1917';
  g.fillRect(doorX - 18, doorY - 18, doorW + 36, doorH + 18);
  g.strokeStyle = '#292524';
  g.lineWidth = 4;
  g.strokeRect(doorX - 18, doorY - 18, doorW + 36, doorH + 18);

  // Cánh cửa hé mở (Perspective Door Leaf)
  const doorOpenAngle = 0.35; // góc mở cửa
  g.fillStyle = '#292524';
  g.beginPath();
  g.moveTo(doorX, doorY);
  g.lineTo(doorX + doorW * Math.cos(doorOpenAngle), doorY + 25);
  g.lineTo(doorX + doorW * Math.cos(doorOpenAngle), groundY);
  g.lineTo(doorX, groundY);
  g.closePath();
  g.fill();
  g.stroke();

  // Khe sáng ban đêm từ ngoài hành lang/đường lọt vào khi chưa bật đèn
  if (!isLightOn || lightProgress < 0.8) {
    const slitAlpha = (1 - lightProgress) * 0.55;
    g.save();
    g.fillStyle = `rgba(147, 197, 253, ${slitAlpha})`;
    g.beginPath();
    g.moveTo(doorX + doorW * Math.cos(doorOpenAngle), doorY + 25);
    g.lineTo(doorX + doorW * Math.cos(doorOpenAngle) + 140, groundY + 80);
    g.lineTo(doorX - 80, groundY + 80);
    g.lineTo(doorX, groundY);
    g.closePath();
    g.fill();
    g.restore();
  }

  // Khóa nắm cửa kim loại tròn
  const knobX = doorX + doorW * Math.cos(doorOpenAngle) - 24;
  const knobY = doorY + doorH * 0.54;
  circle(g, knobX, knobY, 9, '#d97706');
  circle(g, knobX - 2, knobY - 2, 3, '#fef08a');

  // 3. Công tắc đèn trên tường cạnh cửa
  const switchX = doorX + doorW + 80;
  const switchY = groundY - 320;
  // Mặt đế công tắc
  g.fillStyle = isLightOn ? '#f8fafc' : '#334155';
  g.strokeStyle = '#1e293b';
  g.lineWidth = 3;
  rr(g, switchX - 18, switchY - 28, 36, 56, 4);
  g.fill();
  g.stroke();

  // Nút bật/tắt (Toggle lever)
  g.fillStyle = isLightOn ? '#22c55e' : '#64748b';
  rr(g, switchX - 8, isLightOn ? switchY - 18 : switchY + 4, 16, 16, 3);
  g.fill();
  g.stroke();

  // 4. Sàn gỗ phòng (Wooden Floorboards)
  const floorCol = isLightOn
    ? mix('#14101b', '#451a03', ease.out(lightProgress))
    : '#090c14';
  g.fillStyle = floorCol;
  g.fillRect(-W * 0.2, groundY, W * 1.4, H - groundY + 100);

  // Đường viền nẹp chân tường (Baseboard)
  g.fillStyle = isLightOn ? '#292524' : '#0c0f18';
  g.fillRect(-W * 0.2, groundY - 14, W * 1.4, 14);

  // Các đường nan sàn gỗ phối cảnh
  g.strokeStyle = isLightOn ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.04)';
  g.lineWidth = 3;
  for (let px = -W * 0.1; px < W * 1.3; px += 160) {
    g.beginPath();
    g.moveTo(px, groundY);
    g.lineTo(px + (px - W / 2) * 0.45, H + 80);
    g.stroke();
  }

  // 5. HIỆU ỨNG CHIẾU SÁNG TOÀN CẢNH KHI BẬT ĐÈN (Full Light Burst Pass)
  if (isLightOn && lightProgress > 0) {
    const burstA = ease.out(lightProgress);
    g.save();
    // Vầng hào quang từ đèn trần tỏa xuống
    const lightGrad = g.createRadialGradient(W * 0.55, H * 0.15, 20, W * 0.55, H * 0.4, W * 0.85);
    lightGrad.addColorStop(0, `rgba(254, 240, 138, ${0.45 * burstA})`);
    lightGrad.addColorStop(0.5, `rgba(254, 243, 199, ${0.22 * burstA})`);
    lightGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
    g.fillStyle = lightGrad;
    g.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);
    g.restore();
  }

  g.restore();

  return { groundY, doorX, switchX, switchY };
}

/**
 * 3. BỐI CẢNH PHÒNG KHÁCH BAN ĐÊM (Cozy Night Living Room)
 * Bám sát tuyệt đối ảnh tham chiếu: Ghế sofa lớn, chăn trùm, bàn trà, đèn bàn vàng, cửa sổ trăng
 * Dành cho Cảnh 3, 4, 5
 */
export function drawCozyLivingRoomScene(g, t, cam = { z: 1, x: 0, y: 0 }, o = {}) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.cozy_living_room;

  g.save();
  g.translate(W / 2, H / 2);
  g.scale(cam.z || 1, cam.z || 1);
  g.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0));

  const groundY = H * 0.80;

  // --- 1. WALL & STRIPES ---
  const wallGrad = g.createLinearGradient(0, 0, 0, groundY);
  wallGrad.addColorStop(0, '#151b2b');
  wallGrad.addColorStop(1, '#212a42');
  g.fillStyle = wallGrad;
  g.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

  // Sọc dọc trang trí tường như ảnh mẫu
  g.fillStyle = 'rgba(255, 255, 255, 0.035)';
  for (let x = -W * 0.1; x < W * 1.2; x += 60) {
    g.fillRect(x, -H * 0.1, 26, groundY + H * 0.1);
  }

  // Tranh treo tường nghệ thuật (Art Frame on Wall)
  const frameX = W * 0.28;
  const frameY = H * 0.18;
  const frameW = 220;
  const frameH = 150;
  g.fillStyle = '#78350f'; // Khung gỗ
  rr(g, frameX, frameY, frameW, frameH, 6);
  g.fill();
  g.fillStyle = '#0f172a'; // Ruột tranh: ngọn núi và trăng đêm
  rr(g, frameX + 12, frameY + 12, frameW - 24, frameH - 24, 4);
  g.fill();
  // Ngọn núi nhỏ trong tranh
  poly(g, [[frameX + 30, frameY + frameH - 12], [frameX + 85, frameY + 60], [frameX + 140, frameY + frameH - 12]], '#166534');
  poly(g, [[frameX + 110, frameY + frameH - 12], [frameX + 160, frameY + 75], [frameX + 200, frameY + frameH - 12]], '#14532d');
  circle(g, frameX + 70, frameY + 45, 12, '#fef08a');

  // Kệ sách gắn tường với con ma đồ chơi mini (Bookshelf with Ghost Figurine)
  const shelfX = W * 0.08;
  const shelfY = H * 0.26;
  g.fillStyle = pal.shelfWood;
  rr(g, shelfX, shelfY, 200, 16, 4);
  g.fill();
  // Sách xếp trên kệ
  const bookColors = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea'];
  bookColors.forEach((bc, idx) => {
    g.fillStyle = bc;
    rr(g, shelfX + 15 + idx * 24, shelfY - 60 - (idx % 2) * 12, 18, 60 + (idx % 2) * 12, 3);
    g.fill();
  });
  // Chú ma nhỏ cute trên kệ sách (như ảnh mẫu!)
  const ghostToyX = shelfX + 165;
  const ghostToyY = shelfY - 32;
  circle(g, ghostToyX, ghostToyY, 14, '#FFFDF8');
  g.fillStyle = '#111827';
  circle(g, ghostToyX - 4, ghostToyY - 3, 2.5, '#111827');
  circle(g, ghostToyX + 4, ghostToyY - 3, 2.5, '#111827');

  // Chậu cây xanh trên kệ
  const plantX = shelfX + 24;
  const plantY = shelfY - 95;
  g.fillStyle = '#b45309';
  poly(g, [[plantX, plantY + 30], [plantX + 36, plantY + 30], [plantX + 30, plantY + 52], [plantX + 6, plantY + 52]], '#b45309');
  // Lá cây rủ xuống
  g.strokeStyle = '#22c55e';
  g.lineWidth = 6;
  for (let l = -1; l <= 1; l++) {
    g.beginPath();
    g.moveTo(plantX + 18, plantY + 30);
    g.quadraticCurveTo(plantX + 18 + l * 25, plantY + 15, plantX + 18 + l * 35, plantY + 45);
    g.stroke();
  }

  // --- 2. CỬA SỔ PHÒNG KHÁCH BAN ĐÊM (Window to the Night Sky) ---
  const winX = W * 0.72;
  const winY = H * 0.12;
  const winW = 320;
  const winH = 440;

  // Bầu trời đêm bên ngoài cửa sổ
  g.save();
  rr(g, winX, winY, winW, winH, 8);
  g.clip();
  const skyWin = g.createLinearGradient(winX, winY, winX, winY + winH);
  skyWin.addColorStop(0, '#090d1a');
  skyWin.addColorStop(1, '#172554');
  g.fillStyle = skyWin;
  g.fillRect(winX, winY, winW, winH);

  // Mặt trăng rực sáng ngoài cửa sổ
  glow(g, winX + winW * 0.75, winY + 95, 120, 'rgba(254, 240, 138, 0.28)');
  circle(g, winX + winW * 0.75, winY + 95, 42, '#fef08a');
  // Cành cây in bóng ngoài trăng
  g.strokeStyle = '#050811';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(winX + winW, winY + 180);
  g.quadraticCurveTo(winX + winW - 80, winY + 140, winX + winW - 130, winY + 110);
  g.stroke();
  g.restore();

  // Khung cửa sổ gỗ đậm
  g.strokeStyle = '#334155';
  g.lineWidth = 14;
  g.strokeRect(winX, winY, winW, winH);
  // Nan chia ô cửa sổ
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(winX + winW / 2, winY);
  g.lineTo(winX + winW / 2, winY + winH);
  g.moveTo(winX, winY + winH * 0.45);
  g.lineTo(winX + winW, winY + winH * 0.45);
  g.stroke();

  // Rèm cửa màu mận tím (Curtains)
  g.fillStyle = pal.curtain;
  // Rèm trái
  g.beginPath();
  g.moveTo(winX - 30, winY - 20);
  g.lineTo(winX + 45, winY - 20);
  g.quadraticCurveTo(winX + 20, winY + winH * 0.5, winX + 60, winY + winH + 40);
  g.lineTo(winX - 30, winY + winH + 40);
  g.closePath();
  g.fill();
  // Rèm phải
  g.beginPath();
  g.moveTo(winX + winW + 30, winY - 20);
  g.lineTo(winX + winW - 45, winY - 20);
  g.quadraticCurveTo(winX + winW - 20, winY + winH * 0.5, winX + winW - 60, winY + winH + 40);
  g.lineTo(winX + winW + 30, winY + winH + 40);
  g.closePath();
  g.fill();

  // --- 3. FLOOR & RUG ---
  g.fillStyle = pal.floor;
  g.fillRect(-W * 0.2, groundY, W * 1.4, H - groundY + 100);

  // Nẹp chân tường
  g.fillStyle = pal.baseboard;
  g.fillRect(-W * 0.2, groundY - 16, W * 1.4, 16);

  // Thảm trải sàn màu đỏ ấm (Cozy Rug under sofa)
  const rugX = W * 0.18;
  const rugY = groundY + 15;
  const rugW = W * 0.62;
  const rugH = 150;
  g.fillStyle = pal.rug;
  g.beginPath();
  g.ellipse(rugX + rugW / 2, rugY + rugH / 2, rugW / 2, rugH / 2, 0, 0, Math.PI * 2);
  g.fill();
  // Viền vàng tua rua quanh thảm
  g.strokeStyle = pal.rugBorder;
  g.lineWidth = 4;
  g.setLineDash([8, 8]);
  g.stroke();
  g.setLineDash([]);

  // --- 4. SOFA LỚN ÊM ÁI (The Big Comfy Sofa) ---
  const sofaX = W * 0.24;
  const sofaY = groundY - 260;
  const sofaW = 860;
  const sofaH = 280;

  // Thành lưng ghế sofa
  g.fillStyle = pal.sofaBody;
  g.strokeStyle = '#0f172a';
  g.lineWidth = 4.5;
  rr(g, sofaX, sofaY, sofaW, sofaH - 30, 24);
  g.fill();
  g.stroke();

  // Nút rút đệm lưng sofa
  g.fillStyle = '#172554';
  for (let nx = 0; nx < 4; nx++) {
    circle(g, sofaX + 110 + nx * 190, sofaY + 70, 7, '#172554');
    circle(g, sofaX + 110 + nx * 190, sofaY + 130, 7, '#172554');
  }

  // Đệm ngồi sofa
  g.fillStyle = pal.sofaCushion;
  rr(g, sofaX + 25, sofaY + 155, sofaW - 50, 95, 18);
  g.fill();
  g.stroke();

  // Tay vịn sofa 2 bên (Armrests)
  g.fillStyle = pal.sofaBody;
  rr(g, sofaX - 35, sofaY + 90, 80, 165, 20);
  g.fill();
  g.stroke();
  rr(g, sofaX + sofaW - 45, sofaY + 90, 80, 165, 20);
  g.fill();
  g.stroke();

  // Chân gỗ sofa
  g.fillStyle = pal.sofaWood;
  [sofaX + 40, sofaX + sofaW - 70].forEach(cx => {
    poly(g, [[cx, sofaY + sofaH - 20], [cx + 25, sofaY + sofaH - 20], [cx + 20, groundY + 18], [cx + 5, groundY + 18]], pal.sofaWood);
  });

  // Gối tựa vàng ấm trên sofa
  g.fillStyle = '#eab308';
  g.strokeStyle = '#713f12';
  g.lineWidth = 3.5;
  g.save();
  g.translate(sofaX + 80, sofaY + 120);
  g.rotate(-0.25);
  rr(g, -40, -40, 80, 80, 12);
  g.fill();
  g.stroke();
  g.restore();

  // --- 5. ĐÈN BÀN VÀNG ẤM ÁP (Warm Lamp with Volumetric Light Cone) ---
  const lampTableX = W * 0.12;
  const lampTableY = groundY - 160;

  // Bàn phụ kê đèn
  g.fillStyle = pal.sofaWood;
  rr(g, lampTableX, lampTableY, 110, 165, 8);
  g.fill();
  g.stroke();

  // Thân đèn ngủ
  const lampFootX = lampTableX + 55;
  const lampHeadY = lampTableY - 170;
  g.strokeStyle = pal.lampStand;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(lampFootX, lampTableY + 8);
  g.lineTo(lampFootX, lampHeadY + 50);
  g.stroke();

  // Chao đèn hình nón ấm áp
  poly(g, [
    [lampFootX - 45, lampHeadY + 50],
    [lampFootX + 45, lampHeadY + 50],
    [lampFootX + 28, lampHeadY],
    [lampFootX - 28, lampHeadY]
  ], pal.lampShade);
  g.strokeStyle = '#b45309';
  g.lineWidth = 3.5;
  g.stroke();

  // Nón sáng vàng ấm từ đèn ngủ (Warm Glow Cone)
  g.save();
  const lampGlow = g.createRadialGradient(lampFootX, lampHeadY + 35, 15, lampFootX, lampHeadY + 140, 420);
  lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.55)');
  lampGlow.addColorStop(0.4, 'rgba(254, 240, 138, 0.22)');
  lampGlow.addColorStop(0.85, 'rgba(254, 240, 138, 0.05)');
  lampGlow.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
  g.fillStyle = lampGlow;
  g.beginPath();
  g.moveTo(lampFootX - 35, lampHeadY + 50);
  g.lineTo(lampFootX + 35, lampHeadY + 50);
  g.lineTo(lampFootX + 340, groundY + 90);
  g.lineTo(lampFootX - 220, groundY + 90);
  g.closePath();
  g.fill();
  g.restore();

  // --- 6. BÀN TRÀ TRƯỚC SOFA (Coffee Table with Popcorn & Mugs) ---
  const tableX = W * 0.38;
  const tableY = groundY - 30;
  const tableW = 460;
  const tableH = 110;

  // Mặt bàn gỗ bo tròn
  g.fillStyle = '#78350f';
  g.strokeStyle = '#451a03';
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(tableX + tableW / 2, tableY, tableW / 2, 45, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Chân bàn trà
  [tableX + 60, tableX + tableW - 80].forEach(cx => {
    poly(g, [[cx, tableY + 20], [cx + 18, tableY + 20], [cx + 14, groundY + 65], [cx + 2, groundY + 65]], '#451a03');
  });

  // Bát bắp rang bơ sọc đỏ trắng (Popcorn Bowl như ảnh tham chiếu!)
  const popX = tableX + tableW * 0.55;
  const popY = tableY - 45;
  // Bát sọc đỏ trắng
  poly(g, [[popX - 36, popY], [popX + 36, popY], [popX + 24, popY + 44], [popX - 24, popY + 44]], '#ffffff');
  g.strokeStyle = '#dc2626';
  g.lineWidth = 6;
  [-16, 0, 16].forEach(sx => {
    g.beginPath();
    g.moveTo(popX + sx, popY);
    g.lineTo(popX + sx * 0.7, popY + 44);
    g.stroke();
  });
  g.strokeStyle = '#0f172a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(popX - 36, popY);
  g.lineTo(popX + 36, popY);
  g.lineTo(popX + 24, popY + 44);
  g.lineTo(popX - 24, popY + 44);
  g.closePath();
  g.stroke();

  // Bắp nổ tròn vàng ươm đầy ụ phía trên
  g.fillStyle = '#fef08a';
  for (let px = -30; px <= 30; px += 10) {
    circle(g, popX + px, popY - 6 - Math.abs(px * 0.2), 9, '#fef08a');
    circle(g, popX + px, popY - 14 + Math.sin(px * 3) * 5, 8, '#fef08a');
  }

  // Cốc nước Gamer (Mug with gamepad logo như ảnh mẫu!)
  const mugX = tableX + tableW * 0.32;
  const mugY = tableY - 32;
  g.fillStyle = '#0284c7';
  rr(g, mugX, mugY, 34, 40, 5);
  g.fill();
  g.stroke();
  // Quai cốc
  g.strokeStyle = '#0284c7';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(mugX - 4, mugY + 20, 10, Math.PI * 0.5, Math.PI * 1.5);
  g.stroke();
  // Icon tay cầm game nhỏ màu trắng
  g.fillStyle = '#ffffff';
  rr(g, mugX + 7, mugY + 12, 20, 12, 3);
  g.fill();

  // Điều khiển TV (Remote)
  const remX = tableX + tableW * 0.20;
  const remY = tableY - 10;
  g.fillStyle = '#1e293b';
  rr(g, remX, remY, 40, 16, 3);
  g.fill();
  g.stroke();

  g.restore();

  return { groundY, sofaX, sofaY, sofaW, sofaH, tableX, tableY, winX, winY };
}

/**
 * Vẽ Chăn Trùm Kẻ Caro (Cozy Plaid Blanket Covering Characters)
 * Bám sát tuyệt đối ảnh tham chiếu khi 2 nhân vật trùm chăn run sợ
 */
export function drawCozyBlanket(g, cx, cy, w, h, t = 0, isShivering = false) {
  g.save();
  const shiverX = isShivering ? Math.sin(t * 44) * 2.0 : 0;
  const shiverY = isShivering ? Math.cos(t * 48) * 1.5 : 0;
  g.translate(cx + shiverX, cy + shiverY);

  const pal = CINEMATIC_PALETTES.cozy_living_room;

  // 1. Thân chăn phủ xanh sẫm bo tròn
  g.fillStyle = pal.blanket;
  g.strokeStyle = pal.ink;
  g.lineWidth = 4.2;

  g.beginPath();
  // Mép trên chăn có 2 chỗ trũng vừa vặn cho 2 nhân vật thò đầu và 2 bàn tay bấu vào mép
  g.moveTo(-w / 2, h / 2);
  g.quadraticCurveTo(-w / 2 - 15, -h * 0.3, -w * 0.35, -h * 0.45);
  g.quadraticCurveTo(-w * 0.22, -h * 0.38, -w * 0.1, -h * 0.48);
  g.quadraticCurveTo(w * 0.1, -h * 0.48, w * 0.22, -h * 0.38);
  g.quadraticCurveTo(w * 0.35, -h * 0.45, w / 2 + 15, -h * 0.3);
  g.lineTo(w / 2, h / 2);
  g.quadraticCurveTo(0, h / 2 + 25, -w / 2, h / 2);
  g.closePath();
  g.fill();
  g.stroke();

  // 2. Họa tiết kẻ sọc Plaid (Caro xanh nhạt)
  g.save();
  g.clip();
  g.strokeStyle = pal.blanketPlaid;
  g.lineWidth = 4.0;
  // Sọc dọc
  for (let x = -w * 0.6; x <= w * 0.6; x += 48) {
    g.beginPath();
    g.moveTo(x, -h);
    g.lineTo(x + 10, h);
    g.stroke();
  }
  // Sọc ngang
  for (let y = -h * 0.6; y <= h * 0.6; y += 38) {
    g.beginPath();
    g.moveTo(-w, y);
    g.quadraticCurveTo(0, y + 12, w, y);
    g.stroke();
  }
  g.restore();

  // 3. Mép gập chăn trên cùng (Thick folded top hem)
  g.strokeStyle = '#93c5fd';
  g.lineWidth = 5.0;
  g.beginPath();
  g.moveTo(-w * 0.35, -h * 0.45);
  g.quadraticCurveTo(-w * 0.22, -h * 0.38, -w * 0.1, -h * 0.48);
  g.quadraticCurveTo(w * 0.1, -h * 0.48, w * 0.22, -h * 0.38);
  g.quadraticCurveTo(w * 0.35, -h * 0.45, w / 2 + 10, -h * 0.3);
  g.stroke();

  g.restore();
}

/**
 * 4. BỐI CẢNH HÀNH LANG CĂNG THẲNG (Tense Dark Hallway Sneak)
 * Dành cho Cảnh 4: Nam cầm chổi rón rén tiến tới góc cửa phát ra tiếng động
 */
export function drawTenseHallwayScene(g, t, cam = { z: 1, x: 0, y: 0 }) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.tense_hallway;

  g.save();
  g.translate(W / 2, H / 2);
  g.scale(cam.z || 1, cam.z || 1);
  g.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0));

  const vpX = W * 0.72; // Vanishing point cuối hành lang
  const vpY = H * 0.46;
  const groundY = H * 0.82;

  // Tường hậu xa xăm (Back Dark Wall)
  g.fillStyle = pal.wallBack;
  g.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

  // Tường trái hành lang (Left Wall Perspective)
  poly(g, [
    [-W * 0.2, -H * 0.2],
    [vpX - 160, vpY - 240],
    [vpX - 160, groundY - 40],
    [-W * 0.2, groundY + 120]
  ], pal.wallLeft);

  // Cửa mở hé ở cuối hành lang — nơi phát ra tiếng kêu bí ẩn!
  const doorEndW = 120;
  const doorEndH = 260;
  const doorEndX = vpX - 60;
  const doorEndY = groundY - doorEndH;
  // Khoang tối đen ngòm bên trong cửa
  g.fillStyle = pal.doorOpen;
  g.fillRect(doorEndX, doorEndY, doorEndW, doorEndH);
  g.strokeStyle = '#334155';
  g.lineWidth = 4;
  g.strokeRect(doorEndX, doorEndY, doorEndW, doorEndH);

  // Ánh trăng xanh lạnh lẽo rọi xiên từ khe cửa
  g.save();
  const moonBeam = g.createLinearGradient(doorEndX, doorEndY + 60, doorEndX - 420, groundY + 80);
  moonBeam.addColorStop(0, 'rgba(147, 197, 253, 0.45)');
  moonBeam.addColorStop(0.5, 'rgba(147, 197, 253, 0.15)');
  moonBeam.addColorStop(1, 'rgba(147, 197, 253, 0)');
  g.fillStyle = moonBeam;
  g.beginPath();
  g.moveTo(doorEndX, doorEndY + 20);
  g.lineTo(doorEndX + 40, doorEndY);
  g.lineTo(doorEndX - 380, groundY + 120);
  g.lineTo(doorEndX - 520, groundY + 120);
  g.closePath();
  g.fill();
  g.restore();

  // Sàn nhà hành lang (Hallway Floor)
  poly(g, [
    [-W * 0.2, groundY + 120],
    [vpX - 160, groundY - 40],
    [W * 1.2, groundY - 40],
    [W * 1.2, H * 1.2]
  ], pal.floor);

  // Vệt bóng đổ dài căng thẳng từ cuối hành lang tới gần màn hình
  g.fillStyle = 'rgba(0, 0, 0, 0.55)';
  poly(g, [
    [doorEndX, groundY - 30],
    [doorEndX + doorEndW, groundY - 30],
    [doorEndX + 280, H + 50],
    [doorEndX - 260, H + 50]
  ], 'rgba(0, 0, 0, 0.55)');

  g.restore();

  return { groundY, doorEndX, doorEndY };
}

/**
 * 5. BÓNG ĐỔ TIẾP XÚC & HIỆU ỨNG TỐI VIỀN ĐIỆN ẢNH (Cinematic Vignette Pass)
 */
export function drawCinematicVignette(g, intensity = 0.35) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  g.save();
  const vig = g.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.72);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.7, `rgba(5, 7, 15, ${intensity * 0.5})`);
  vig.addColorStop(1, `rgba(5, 7, 15, ${intensity})`);
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  g.restore();
}
