// engine/cinematic-scene.js — Cinematic Scene Engine V3: 5-Layer Illustration & Camera Director
// Implements 5-Layer Architecture (Background, Mid-background, Action, Foreground, Lighting & Atmosphere),
// CameraDirector with cinematic framing presets, and high-detail 2D cartoon environments without empty voids.

import { E, clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease, linGrad, radGrad, glow } from './core.js';
import { drawUniversalVfx, normalizeVfxSpec, solveVfxCameraShake, VFX_DISPATCHER } from './vfx-engine-v4.js';

/**
 * CAMERA DIRECTOR V3 — SHOT TYPES & PRESETS
 */
export const SHOT_TYPES = {
  ESTABLISHING: { z: 1.0, label: 'Toàn cảnh thiết lập bối cảnh', charScale: 1.0 },
  WIDE: { z: 1.15, label: 'Góc rộng bao quát hành động', charScale: 1.25 },
  MEDIUM: { z: 1.55, label: 'Trung cảnh ngang người, tập trung cử chỉ', charScale: 1.55 },
  MEDIUM_CLOSE_UP: { z: 2.1, label: 'Trung cận từ ngực đến đầu', charScale: 2.0 },
  CLOSE_UP: { z: 2.7, label: 'Cận cảnh khuôn mặt, bắt trọn biểu cảm', charScale: 2.6 },
  EXTREME_CLOSE_UP: { z: 3.8, label: 'Đặc tả chi tiết mắt, miệng, cảm xúc tột độ', charScale: 3.5 },
  TRACKING: { z: 1.5, label: 'Góc máy tracking bám theo đối tượng', charScale: 1.55 }
};

/**
 * CameraDirector Class for Dynamic Cinematic Framing
 */
export class CameraDirector {
  constructor(o = {}) {
    this.shotType = o.shotType || 'MEDIUM';
    const preset = SHOT_TYPES[this.shotType] || SHOT_TYPES.MEDIUM;
    this.z = o.z ?? preset.z;
    this.x = o.x ?? 0;
    this.y = o.y ?? 0;
    this.targetZ = this.z;
    this.targetX = this.x;
    this.targetY = this.y;
    this.shakeAmp = 0;
    this.leadRoom = o.leadRoom ?? 0.15; // Tỷ lệ khoảng trống phía trước hướng nhìn
  }

  setShot(type, smooth = false) {
    this.shotType = type;
    const preset = SHOT_TYPES[type] || SHOT_TYPES.MEDIUM;
    this.targetZ = preset.z;
    if (!smooth) {
      this.z = this.targetZ;
    }
  }

  frameTarget(targetX, targetY, facing = 1, o = {}) {
    const W = E.W || 1920;
    const H = E.H || 1080;
    const shot = SHOT_TYPES[this.shotType] || SHOT_TYPES.MEDIUM;
    this.targetZ = o.z ?? shot.z;

    // Rule of Thirds & Lead Room (Nhường khoảng trống trước mặt nhân vật)
    const lookOffset = facing * (W * this.leadRoom) / this.targetZ;
    this.targetX = -(targetX - W / 2) + lookOffset + (o.offsetX || 0);
    this.targetY = -(targetY - H * 0.6) + (o.offsetY || 0);
  }

  applyShake(amp) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  update(dt = 0.016, t = 0) {
    this.z = lerp(this.z, this.targetZ, dt * 5.0);
    this.x = lerp(this.x, this.targetX, dt * 6.0);
    this.y = lerp(this.y, this.targetY, dt * 6.0);

    let shakeX = 0, shakeY = 0;
    if (this.shakeAmp > 0.01) {
      shakeX = Math.sin(t * 55) * this.shakeAmp;
      shakeY = Math.cos(t * 48) * this.shakeAmp;
      this.shakeAmp = Math.max(0, this.shakeAmp - dt * 25);
    }

    return {
      z: this.z,
      x: this.x + shakeX,
      y: this.y + shakeY
    };
  }
}

/**
 * 5-LAYER CINEMATIC PIPELINE RENDERER
 * 1. Background (Parallax ~ 0.2)
 * 2. Mid-background (Parallax ~ 0.5)
 * 3. Action Layer (Parallax 1.0)
 * 4. Foreground (Parallax ~ 1.3)
 * 5. Lighting & Atmosphere (Screen overlays, bloom, mist, vignette)
 */
export function renderCinematic5Layers(g, t, cam = { z: 1, x: 0, y: 0 }, layers = {}) {
  const W = E.W || 1920;
  const H = E.H || 1080;

  // Xử lý VFX theo 6 lớp chuyên biệt (Phase 3)
  const sceneVfxList = layers.vfx ? (Array.isArray(layers.vfx) ? layers.vfx : [layers.vfx]).map(normalizeVfxSpec) : [];

  // Layer 1: Background
  if (layers.background) {
    g.save();
    const p1 = layers.parallax1 ?? 0.2;
    g.translate(W / 2, H / 2);
    g.scale(1 + (cam.z - 1) * 0.35, 1 + (cam.z - 1) * 0.35);
    g.translate(-W / 2 + (cam.x || 0) * p1, -H / 2 + (cam.y || 0) * p1);
    layers.background(g, t);
    g.restore();
  }

  // Layer 1b: Background VFX
  if (layers.backgroundVfx) {
    g.save();
    layers.backgroundVfx(g, t, cam);
    g.restore();
  }
  for (const vfx of sceneVfxList) {
    if (vfx.layer === 'background') {
      g.save();
      drawUniversalVfx(g, vfx, t, { camera: cam, currentLayer: 'background' });
      g.restore();
    }
  }

  // Layer 2: Mid-Background
  if (layers.midBackground) {
    g.save();
    const p2 = layers.parallax2 ?? 0.55;
    g.translate(W / 2, H / 2);
    g.scale(1 + (cam.z - 1) * 0.65, 1 + (cam.z - 1) * 0.65);
    g.translate(-W / 2 + (cam.x || 0) * p2, -H / 2 + (cam.y || 0) * p2);
    layers.midBackground(g, t);
    g.restore();
  }

  // Layer 3: Action Layer (Characters & Interactive Props)
  if (layers.action) {
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z || 1, cam.z || 1);
    g.translate(-W / 2 + (cam.x || 0), -H / 2 + (cam.y || 0));
    layers.action(g, t);
    g.restore();
  }

  // Layer 4: Foreground
  if (layers.foreground) {
    g.save();
    const p4 = layers.parallax4 ?? 1.25;
    g.translate(W / 2, H / 2);
    g.scale(1 + (cam.z - 1) * 1.3, 1 + (cam.z - 1) * 1.3);
    g.translate(-W / 2 + (cam.x || 0) * p4, -H / 2 + (cam.y || 0) * p4);
    layers.foreground(g, t);
    g.restore();
  }

  // Layer 4b: Foreground VFX
  if (layers.foregroundVfx) {
    g.save();
    layers.foregroundVfx(g, t, cam);
    g.restore();
  }
  for (const vfx of sceneVfxList) {
    if (vfx.layer === 'foreground') {
      g.save();
      drawUniversalVfx(g, vfx, t, { camera: cam, currentLayer: 'foreground' });
      g.restore();
    }
  }

  // Layer 5: Weather & Lighting & Screen Overlays
  if (layers.weather) {
    g.save();
    layers.weather(g, t, cam);
    g.restore();
  }
  if (layers.lighting) {
    g.save();
    layers.lighting(g, t, cam);
    g.restore();
  }
  if (layers.screenOverlay) {
    g.save();
    layers.screenOverlay(g, t, cam);
    g.restore();
  }
  for (const vfx of sceneVfxList) {
    if (vfx.layer === 'screen_overlay' || vfx.layer === 'screen') {
      g.save();
      drawUniversalVfx(g, vfx, t, { camera: cam, currentLayer: 'screen_overlay' });
      g.restore();
    }
  }
}

/**
 * STANDARD CINEMATIC COLOR PALETTES
 */
export const CINEMATIC_PALETTES = {
  night_exterior: {
    skyTop: '#060914',
    skyMid: '#0e172e',
    skyBot: '#1e294b',
    moon: '#fef08a',
    moonGlow: 'rgba(254, 240, 138, 0.22)',
    cloud: 'rgba(30, 41, 59, 0.5)',
    star: '#f8fafc',
    buildingFar: '#0c1222',
    buildingMid: '#162038',
    buildingTrim: '#233054',
    windowLit: '#fef08a',
    street: '#141724',
    sidewalk: '#22283d',
    curb: '#333c56',
    lampPost: '#1b2234',
    lampLight: '#fef08a',
    lampGlow: 'rgba(254, 240, 138, 0.35)',
    ink: '#111827'
  },
  dark_entry: {
    wallDark: '#090d18',
    wallTrim: '#151d30',
    doorWood: '#1c1917',
    doorFrame: '#292524',
    floor: '#0f1422',
    moonSlit: 'rgba(147, 197, 253, 0.28)',
    switchPlate: '#334155',
    switchOn: '#22c55e',
    switchOff: '#94a3b8',
    warmFlood: '#fffbeb',
    ink: '#090d16'
  },
  cozy_living_room: {
    wall: '#1a2238',
    wallStripe: '#222d48',
    baseboard: '#111624',
    floor: '#382620',
    floorPlank: '#2c1e19',
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
    lampGlow: 'rgba(254, 240, 138, 0.32)',
    blanket: '#1e3a5f',
    blanketPlaid: '#60a5fa',
    ink: '#0f172a'
  },
  tense_hallway: {
    wallLeft: '#0f172a',
    wallRight: '#0b1120',
    wallBack: '#030712',
    doorOpen: '#020617',
    floor: '#1e293b',
    floorShadow: 'rgba(0,0,0,0.68)',
    shadowLength: 360,
    ink: '#090d16'
  }
};

/**
 * 1. BỐI CẢNH NGOÀI PHỐ ĐÊM ĐIỆN ẢNH V3 (Night Exterior Street V3)
 * Loại bỏ hoàn toàn khoảng trống, chia 5 lớp chi tiết điện ảnh
 */
export function drawStreetNightBackgroundV3(g, t, cam = { z: 1, x: 0, y: 0 }, o = {}) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.night_exterior;
  const groundY = H * 0.78;
  const lampX = W * 0.38;
  const lampFootY = groundY + 25;

  renderCinematic5Layers(g, t, cam, {
    // LAYER 1: SKY, STARS, MOON & CLOUDS
    background(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
      sky.addColorStop(0, pal.skyTop);
      sky.addColorStop(0.5, pal.skyMid);
      sky.addColorStop(1, pal.skyBot);
      ctx.fillStyle = sky;
      ctx.fillRect(-W * 0.3, -H * 0.3, W * 1.6, H * 1.4);

      // Ngôi sao lấp lánh trên nền trời đêm
      ctx.fillStyle = pal.star;
      const stars = [
        [W * 0.1, H * 0.1, 1.8], [W * 0.18, H * 0.08, 1.2], [W * 0.28, H * 0.14, 2.0],
        [W * 0.42, H * 0.09, 1.5], [W * 0.55, H * 0.12, 1.8], [W * 0.68, H * 0.06, 1.3],
        [W * 0.88, H * 0.15, 2.2], [W * 0.94, H * 0.09, 1.6]
      ];
      stars.forEach(([sx, sy, sr]) => {
        const twinkle = 0.6 + Math.sin(t * 3 + sx) * 0.4;
        ctx.globalAlpha = twinkle;
        circle(ctx, sx, sy, sr, pal.star);
      });
      ctx.globalAlpha = 1.0;

      // Mặt trăng tròn sáng với quầng sáng mềm
      const moonX = W * 0.78;
      const moonY = H * 0.20;
      glow(ctx, moonX, moonY, 200, pal.moonGlow, 1.0);
      circle(ctx, moonX, moonY, 56, pal.moon);
      // Hố mặt trăng
      circle(ctx, moonX - 14, moonY - 12, 13, 'rgba(202, 138, 4, 0.24)');
      circle(ctx, moonX + 16, moonY + 8, 16, 'rgba(202, 138, 4, 0.2)');
      circle(ctx, moonX - 6, moonY + 20, 10, 'rgba(202, 138, 4, 0.2)');

      // Dải mây đêm trôi nhẹ
      for (let c = 0; c < 3; c++) {
        const cx = (W * 0.15 + c * 520 + t * 16) % (W * 1.4) - W * 0.2;
        const cy = H * 0.16 + c * 48;
        ctx.fillStyle = pal.cloud;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 160, 30, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 45, cy - 12, 90, 25, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    // LAYER 2: MID-BACKGROUND BUILDINGS, ROOFTOPS, TREES & FENCES
    midBackground(ctx) {
      const bldgBaseY = groundY - 10;

      // Dãy nhà xa (Far Skyline)
      ctx.fillStyle = pal.buildingFar;
      const farBldgs = [
        [W * 0.02, 340, 240], [W * 0.20, 300, 200], [W * 0.38, 380, 270],
        [W * 0.60, 320, 230], [W * 0.78, 360, 290]
      ];
      farBldgs.forEach(([bx, bw, bh]) => {
        ctx.fillRect(bx, bldgBaseY - bh, bw, bh + 50);
        // Cửa sổ xa sáng đèn
        ctx.fillStyle = 'rgba(254, 240, 138, 0.32)';
        for (let r = 0; r < 4; r++) {
          for (let col = 0; col < 3; col++) {
            if ((r + col + bx) % 2 === 0) {
              ctx.fillRect(bx + 20 + col * 45, bldgBaseY - bh + 25 + r * 46, 22, 28);
            }
          }
        }
        ctx.fillStyle = pal.buildingFar;
      });

      // Dãy nhà gần (Mid Buildings with details)
      const midBldgs = [
        [W * 0.08, 280, 280], [W * 0.32, 320, 320], [W * 0.68, 300, 310]
      ];
      midBldgs.forEach(([bx, bw, bh]) => {
        ctx.fillStyle = pal.buildingMid;
        ctx.fillRect(bx, bldgBaseY - bh, bw, bh + 50);
        // Mái ngói tam giác có ống khói
        poly(ctx, [[bx - 12, bldgBaseY - bh], [bx + bw / 2, bldgBaseY - bh - 65], [bx + bw + 12, bldgBaseY - bh]], pal.buildingMid);
        // Ống khói
        ctx.fillRect(bx + bw * 0.75, bldgBaseY - bh - 80, 28, 45);

        // Ban công & cửa sổ lớn có rèm
        ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
        rr(ctx, bx + bw * 0.25, bldgBaseY - bh + 50, 70, 95, 6);
        ctx.fill();
        // Khung cửa sổ
        ctx.strokeStyle = pal.buildingTrim;
        ctx.lineWidth = 4;
        ctx.strokeRect(bx + bw * 0.25, bldgBaseY - bh + 50, 70, 95);
      });

      // Hàng rào hoa sắt và rặng cây xanh bóng đêm
      ctx.fillStyle = '#0b1120';
      for (let tx = -40; tx < W + 100; tx += 85) {
        ctx.beginPath();
        ctx.ellipse(tx + 40, bldgBaseY + 12, 58, 35, 0, Math.PI, Math.PI * 2);
        ctx.fill();
      }
      // Hàng rào sắt nhọn
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      for (let fx = 0; fx < W; fx += 35) {
        ctx.beginPath();
        ctx.moveTo(fx, bldgBaseY + 10);
        ctx.lineTo(fx, bldgBaseY - 35);
        ctx.lineTo(fx + 3, bldgBaseY - 45);
        ctx.lineTo(fx + 6, bldgBaseY - 35);
        ctx.stroke();
      }
    },

    // LAYER 3: ACTION LAYER (STREET, SIDEWALK, LAMP POST & LIGHT CONE)
    action(ctx) {
      // Vỉa hè lát gạch
      const sidewalkGrad = ctx.createLinearGradient(0, groundY, 0, H);
      sidewalkGrad.addColorStop(0, pal.sidewalk);
      sidewalkGrad.addColorStop(0.2, pal.curb);
      sidewalkGrad.addColorStop(0.26, pal.street);
      sidewalkGrad.addColorStop(1, '#090b12');
      ctx.fillStyle = sidewalkGrad;
      ctx.fillRect(-W * 0.3, groundY, W * 1.6, H - groundY + 100);

      // Nan gạch vỉa hè
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2.5;
      for (let px = -W * 0.1; px < W * 1.2; px += 75) {
        ctx.beginPath();
        ctx.moveTo(px, groundY);
        ctx.lineTo(px - 15, groundY + 36);
        ctx.stroke();
      }

      // Gờ vỉa hè
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, groundY + 36);
      ctx.lineTo(W * 1.3, groundY + 36);
      ctx.stroke();

      // Vạch kẻ đường đứt đoạn
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 6;
      ctx.setLineDash([48, 48]);
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, groundY + 125);
      ctx.lineTo(W * 1.3, groundY + 125);
      ctx.stroke();
      ctx.setLineDash([]);

      // CỘT ĐÈN ĐƯỜNG CỔ ĐIỂN
      const lampHeadY = groundY - 400;

      // Trụ đèn
      ctx.strokeStyle = pal.lampPost;
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.moveTo(lampX, lampFootY);
      ctx.lineTo(lampX, lampHeadY);
      ctx.stroke();

      // Đế cột đèn có họa tiết gờ đúc
      ctx.fillStyle = pal.lampPost;
      rr(ctx, lampX - 25, lampFootY - 30, 50, 30, 6);
      ctx.fill();
      rr(ctx, lampX - 16, lampFootY - 55, 32, 25, 4);
      ctx.fill();

      // Cần uốn cong treo đèn
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(lampX, lampHeadY);
      ctx.quadraticCurveTo(lampX, lampHeadY - 45, lampX + 50, lampHeadY - 45);
      ctx.lineTo(lampX + 72, lampHeadY - 22);
      ctx.stroke();

      // Chao đèn & bóng đèn sáng
      poly(ctx, [
        [lampX + 44, lampHeadY - 22],
        [lampX + 100, lampHeadY - 22],
        [lampX + 108, lampHeadY + 8],
        [lampX + 36, lampHeadY + 8]
      ], pal.lampPost);

      circle(ctx, lampX + 72, lampHeadY + 18, 20, pal.lampLight);

      // Nón ánh sáng vàng rọi xuống vỉa hè (Volumetric Light Cone)
      ctx.save();
      const coneGrad = ctx.createRadialGradient(lampX + 72, groundY + 60, 25, lampX + 72, groundY + 60, 420);
      coneGrad.addColorStop(0, 'rgba(254, 240, 138, 0.48)');
      coneGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.22)');
      coneGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.ellipse(lampX + 72, groundY + 55, 420, 130, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },

    // LAYER 4: FOREGROUND SILHOUETTES (TREE BRANCHES & BUSHES NEAR CAMERA)
    foreground(ctx) {
      ctx.fillStyle = '#05070e';
      // Cành lá cây rủ xuống từ góc trên bên trái
      ctx.beginPath();
      ctx.moveTo(-40, -40);
      ctx.lineTo(340, -40);
      ctx.quadraticCurveTo(240, 140, 110, 180);
      ctx.quadraticCurveTo(40, 110, -40, 140);
      ctx.closePath();
      ctx.fill();

      // Hộp thư ven đường hoặc bụi cây tiền cảnh bên phải
      ctx.beginPath();
      ctx.ellipse(W - 80, H - 20, 140, 90, 0, 0, Math.PI * 2);
      ctx.fill();
    },

    // LAYER 5: LIGHTING & ATMOSPHERE
    lighting(ctx) {
      // Hạt bụi/phấn sáng bay trong chùm đèn đường
      ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
      for (let p = 0; p < 18; p++) {
        const px = lampX + 30 + Math.sin(t * 1.5 + p * 2.3) * 120;
        const py = groundY - 320 + ((p * 22 + t * 24) % 320);
        circle(ctx, px, py, 1.8 + (p % 2) * 1.2, 'rgba(254, 240, 138, 0.65)');
      }

      // Lớp sương đêm nhẹ trên mặt đất
      const mist = ctx.createLinearGradient(0, groundY - 40, 0, groundY + 60);
      mist.addColorStop(0, 'rgba(147, 197, 253, 0.0)');
      mist.addColorStop(0.5, 'rgba(147, 197, 253, 0.08)');
      mist.addColorStop(1, 'rgba(147, 197, 253, 0.0)');
      ctx.fillStyle = mist;
      ctx.fillRect(0, groundY - 40, W, 100);

      // Vignette
      drawCinematicVignette(ctx, 0.38);
    }
  });

  return { groundY, lampX, lampFootY };
}

// Giữ lại hàm cũ để backward compatibility
export const drawStreetNightBackground = drawStreetNightBackgroundV3;

/**
 * 2. BỐI CẢNH CỬA VÀO VÀ BẬT CÔNG TẮC ĐIỆN ẢNH V3 (Entry Hallway V3)
 */
export function drawEntryHallwaySceneV3(g, t, isLightOn = false, lightProgress = 0, cam = { z: 1, x: 0, y: 0 }) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.dark_entry;
  const groundY = H * 0.82;
  const doorW = 280;
  const doorH = 620;
  const doorX = W * 0.22;
  const doorY = groundY - doorH;
  const switchX = doorX + doorW + 80;
  const switchY = groundY - 320;

  renderCinematic5Layers(g, t, cam, {
    // 1. BACKGROUND WALL & STRIPES
    background(ctx) {
      const wallCol = isLightOn
        ? mix('#181824', '#f1e7d0', ease.out(lightProgress))
        : '#0c0f18';
      ctx.fillStyle = wallCol;
      ctx.fillRect(-W * 0.3, -H * 0.3, W * 1.6, H * 1.6);

      if (isLightOn && lightProgress > 0.05) {
        ctx.strokeStyle = 'rgba(217, 119, 6, 0.08)';
        ctx.lineWidth = 3.5;
        for (let x = -W * 0.2; x < W * 1.4; x += 44) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, groundY);
          ctx.stroke();
        }
      }
    },

    // 2. MID-BACKGROUND (DOORWAY, FRAME & PICTURES)
    midBackground(ctx) {
      // Khung cửa gỗ
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(doorX - 20, doorY - 20, doorW + 40, doorH + 20);
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 4;
      ctx.strokeRect(doorX - 20, doorY - 20, doorW + 40, doorH + 20);

      // Cánh cửa hé mở
      const doorOpenAngle = 0.35;
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(doorX, doorY);
      ctx.lineTo(doorX + doorW * Math.cos(doorOpenAngle), doorY + 25);
      ctx.lineTo(doorX + doorW * Math.cos(doorOpenAngle), groundY);
      ctx.lineTo(doorX, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Khe sáng trăng ngoài cửa
      if (!isLightOn || lightProgress < 0.8) {
        const slitAlpha = (1 - lightProgress) * 0.55;
        ctx.save();
        ctx.fillStyle = `rgba(147, 197, 253, ${slitAlpha})`;
        ctx.beginPath();
        ctx.moveTo(doorX + doorW * Math.cos(doorOpenAngle), doorY + 25);
        ctx.lineTo(doorX + doorW * Math.cos(doorOpenAngle) + 160, groundY + 90);
        ctx.lineTo(doorX - 90, groundY + 90);
        ctx.lineTo(doorX, groundY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Tay nắm cửa
      const knobX = doorX + doorW * Math.cos(doorOpenAngle) - 24;
      const knobY = doorY + doorH * 0.54;
      circle(ctx, knobX, knobY, 9, '#d97706');
      circle(ctx, knobX - 2, knobY - 2, 3, '#fef08a');

      // Tranh treo tường gia đình / phong cảnh bên phải
      const picX = switchX + 160;
      const picY = groundY - 450;
      ctx.fillStyle = isLightOn ? '#78350f' : '#1e293b';
      rr(ctx, picX, picY, 140, 180, 6);
      ctx.fill();
      ctx.fillStyle = isLightOn ? '#0f172a' : '#090d16';
      rr(ctx, picX + 10, picY + 10, 120, 160, 4);
      ctx.fill();
    },

    // 3. ACTION LAYER (SWITCH & FLOOR)
    action(ctx) {
      // Sàn gỗ phòng
      const floorCol = isLightOn
        ? mix('#14101b', '#451a03', ease.out(lightProgress))
        : '#090c14';
      ctx.fillStyle = floorCol;
      ctx.fillRect(-W * 0.3, groundY, W * 1.6, H - groundY + 100);

      // Nẹp chân tường
      ctx.fillStyle = isLightOn ? '#292524' : '#0c0f18';
      ctx.fillRect(-W * 0.3, groundY - 14, W * 1.6, 14);

      // Nan gỗ lát sàn
      ctx.strokeStyle = isLightOn ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 3.5;
      for (let px = -W * 0.1; px < W * 1.3; px += 160) {
        ctx.beginPath();
        ctx.moveTo(px, groundY);
        ctx.lineTo(px + (px - W / 2) * 0.45, H + 80);
        ctx.stroke();
      }

      // Công tắc đèn trên tường
      ctx.fillStyle = isLightOn ? '#f8fafc' : '#334155';
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      rr(ctx, switchX - 18, switchY - 28, 36, 56, 4);
      ctx.fill();
      ctx.stroke();

      // Nút bật
      ctx.fillStyle = isLightOn ? '#22c55e' : '#64748b';
      rr(ctx, switchX - 8, isLightOn ? switchY - 18 : switchY + 4, 16, 16, 3);
      ctx.fill();
      ctx.stroke();
    },

    // 4. FOREGROUND LAYER
    foreground(ctx) {
      // Không che khuất
    },

    // 5. LIGHTING & ATMOSPHERE
    lighting(ctx) {
      if (isLightOn && lightProgress > 0) {
        const burstA = ease.out(lightProgress);
        ctx.save();
        const lightGrad = ctx.createRadialGradient(W * 0.55, H * 0.15, 20, W * 0.55, H * 0.4, W * 0.85);
        lightGrad.addColorStop(0, `rgba(254, 240, 138, ${0.48 * burstA})`);
        lightGrad.addColorStop(0.5, `rgba(254, 243, 199, ${0.24 * burstA})`);
        lightGrad.addColorStop(1, 'rgba(254, 243, 199, 0)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
      drawCinematicVignette(ctx, isLightOn ? 0.22 : 0.45);
    }
  });

  return { groundY, doorX, switchX, switchY };
}

export const drawEntryHallwayScene = drawEntryHallwaySceneV3;

/**
 * 3. BỐI CẢNH PHÒNG KHÁCH BAN ĐÊM ĐIỆN ẢNH V3 (Cozy Living Room V3)
 * Tái hiện xuất sắc không khí ảnh tham chiếu: Sofa lớn, đèn bàn vàng, bàn trà bắp rang bơ, cửa sổ trăng
 */
export function drawCozyLivingRoomSceneV3(g, t, cam = { z: 1, x: 0, y: 0 }, o = {}) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.cozy_living_room;
  const groundY = H * 0.80;

  const sofaX = W * 0.24;
  const sofaY = groundY - 260;
  const sofaW = 860;
  const sofaH = 280;

  const tableX = W * 0.38;
  const tableY = groundY - 30;
  const tableW = 460;
  const tableH = 110;

  const winX = W * 0.72;
  const winY = H * 0.12;

  renderCinematic5Layers(g, t, cam, {
    // 1. BACKGROUND WALL, STRIPES, ART & SHELF
    background(ctx) {
      const wallGrad = ctx.createLinearGradient(0, 0, 0, groundY);
      wallGrad.addColorStop(0, '#151b2b');
      wallGrad.addColorStop(1, '#212a42');
      ctx.fillStyle = wallGrad;
      ctx.fillRect(-W * 0.3, -H * 0.3, W * 1.6, H * 1.6);

      // Sọc dọc trang trí tường
      ctx.fillStyle = 'rgba(255, 255, 255, 0.038)';
      for (let x = -W * 0.2; x < W * 1.4; x += 60) {
        ctx.fillRect(x, -H * 0.2, 26, groundY + H * 0.2);
      }

      // Tranh treo tường nghệ thuật
      const frameX = W * 0.28;
      const frameY = H * 0.18;
      const frameW = 220;
      const frameH = 150;
      ctx.fillStyle = '#78350f';
      rr(ctx, frameX, frameY, frameW, frameH, 6);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      rr(ctx, frameX + 12, frameY + 12, frameW - 24, frameH - 24, 4);
      ctx.fill();
      poly(ctx, [[frameX + 30, frameY + frameH - 12], [frameX + 85, frameY + 60], [frameX + 140, frameY + frameH - 12]], '#166534');
      poly(ctx, [[frameX + 110, frameY + frameH - 12], [frameX + 160, frameY + 75], [frameX + 200, frameY + frameH - 12]], '#14532d');
      circle(ctx, frameX + 70, frameY + 45, 12, '#fef08a');

      // Kệ sách với tượng con ma cute (như ảnh tham chiếu!)
      const shelfX = W * 0.08;
      const shelfY = H * 0.26;
      ctx.fillStyle = pal.shelfWood;
      rr(ctx, shelfX, shelfY, 200, 16, 4);
      ctx.fill();
      const bookColors = ['#dc2626', '#2563eb', '#16a34a', '#d97706', '#9333ea'];
      bookColors.forEach((bc, idx) => {
        ctx.fillStyle = bc;
        rr(ctx, shelfX + 15 + idx * 24, shelfY - 60 - (idx % 2) * 12, 18, 60 + (idx % 2) * 12, 3);
        ctx.fill();
      });
      // Con ma nhỏ trên kệ sách
      const ghostToyX = shelfX + 165;
      const ghostToyY = shelfY - 32;
      circle(ctx, ghostToyX, ghostToyY, 14, '#FFFDF8');
      circle(ctx, ghostToyX - 4, ghostToyY - 3, 2.5, '#111827');
      circle(ctx, ghostToyX + 4, ghostToyY - 3, 2.5, '#111827');

      // Chậu cây xanh
      const plantX = shelfX + 24;
      const plantY = shelfY - 95;
      poly(ctx, [[plantX, plantY + 30], [plantX + 36, plantY + 30], [plantX + 30, plantY + 52], [plantX + 6, plantY + 52]], '#b45309');
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 6;
      for (let l = -1; l <= 1; l++) {
        ctx.beginPath();
        ctx.moveTo(plantX + 18, plantY + 30);
        ctx.quadraticCurveTo(plantX + 18 + l * 25, plantY + 15, plantX + 18 + l * 35, plantY + 45);
        ctx.stroke();
      }
    },

    // 2. MID-BACKGROUND (WINDOW WITH NIGHT SKY & CURTAINS)
    midBackground(ctx) {
      const winW = 320;
      const winH = 440;

      // Khung kính
      ctx.save();
      rr(ctx, winX, winY, winW, winH, 8);
      ctx.clip();
      const skyWin = ctx.createLinearGradient(winX, winY, winX, winY + winH);
      skyWin.addColorStop(0, '#090d1a');
      skyWin.addColorStop(1, '#172554');
      ctx.fillStyle = skyWin;
      ctx.fillRect(winX, winY, winW, winH);

      // Trăng ngoài cửa sổ
      glow(ctx, winX + winW * 0.75, winY + 95, 120, 'rgba(254, 240, 138, 0.28)');
      circle(ctx, winX + winW * 0.75, winY + 95, 42, '#fef08a');
      ctx.strokeStyle = '#050811';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(winX + winW, winY + 180);
      ctx.quadraticCurveTo(winX + winW - 80, winY + 140, winX + winW - 130, winY + 110);
      ctx.stroke();
      ctx.restore();

      // Khung gỗ cửa sổ
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 14;
      ctx.strokeRect(winX, winY, winW, winH);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(winX + winW / 2, winY);
      ctx.lineTo(winX + winW / 2, winY + winH);
      ctx.moveTo(winX, winY + winH * 0.45);
      ctx.lineTo(winX + winW, winY + winH * 0.45);
      ctx.stroke();

      // Rèm cửa
      ctx.fillStyle = pal.curtain;
      ctx.beginPath();
      ctx.moveTo(winX - 30, winY - 20);
      ctx.lineTo(winX + 45, winY - 20);
      ctx.quadraticCurveTo(winX + 20, winY + winH * 0.5, winX + 60, winY + winH + 40);
      ctx.lineTo(winX - 30, winY + winH + 40);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(winX + winW + 30, winY - 20);
      ctx.lineTo(winX + winW - 45, winY - 20);
      ctx.quadraticCurveTo(winX + winW - 20, winY + winH * 0.5, winX + winW - 60, winY + winH + 40);
      ctx.lineTo(winX + winW + 30, winY + winH + 40);
      ctx.closePath();
      ctx.fill();
    },

    // 3. ACTION LAYER (FLOOR, RUG, SOFA, TABLE, LAMP)
    action(ctx) {
      // Sàn nhà & thảm
      ctx.fillStyle = pal.floor;
      ctx.fillRect(-W * 0.3, groundY, W * 1.6, H - groundY + 100);
      ctx.fillStyle = pal.baseboard;
      ctx.fillRect(-W * 0.3, groundY - 16, W * 1.6, 16);

      // Thảm trải sàn đỏ viền vàng
      const rugX = W * 0.18;
      const rugY = groundY + 15;
      const rugW = W * 0.62;
      const rugH = 150;
      ctx.fillStyle = pal.rug;
      ctx.beginPath();
      ctx.ellipse(rugX + rugW / 2, rugY + rugH / 2, rugW / 2, rugH / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.rugBorder;
      ctx.lineWidth = 4;
      ctx.setLineDash([8, 8]);
      ctx.stroke();
      ctx.setLineDash([]);

      // SOFA LỚN
      ctx.fillStyle = pal.sofaBody;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 4.5;
      rr(ctx, sofaX, sofaY, sofaW, sofaH - 30, 24);
      ctx.fill();
      ctx.stroke();

      // Nút rút đệm lưng
      for (let nx = 0; nx < 4; nx++) {
        circle(ctx, sofaX + 110 + nx * 190, sofaY + 70, 7, '#172554');
        circle(ctx, sofaX + 110 + nx * 190, sofaY + 130, 7, '#172554');
      }

      // Đệm ngồi sofa
      ctx.fillStyle = pal.sofaCushion;
      rr(ctx, sofaX + 25, sofaY + 155, sofaW - 50, 95, 18);
      ctx.fill();
      ctx.stroke();

      // Tay vịn sofa
      ctx.fillStyle = pal.sofaBody;
      rr(ctx, sofaX - 35, sofaY + 90, 80, 165, 20);
      ctx.fill();
      ctx.stroke();
      rr(ctx, sofaX + sofaW - 45, sofaY + 90, 80, 165, 20);
      ctx.fill();
      ctx.stroke();

      // Chân gỗ
      ctx.fillStyle = pal.sofaWood;
      [sofaX + 40, sofaX + sofaW - 70].forEach(cx => {
        poly(ctx, [[cx, sofaY + sofaH - 20], [cx + 25, sofaY + sofaH - 20], [cx + 20, groundY + 18], [cx + 5, groundY + 18]], pal.sofaWood);
      });

      // Gối tựa vàng
      ctx.save();
      ctx.translate(sofaX + 80, sofaY + 120);
      ctx.rotate(-0.25);
      ctx.fillStyle = '#eab308';
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 3.5;
      rr(ctx, -40, -40, 80, 80, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // ĐÈN BÀN VÀNG ẤM
      const lampTableX = W * 0.12;
      const lampTableY = groundY - 160;
      ctx.fillStyle = pal.sofaWood;
      rr(ctx, lampTableX, lampTableY, 110, 165, 8);
      ctx.fill();
      ctx.stroke();

      const lampFootX = lampTableX + 55;
      const lampHeadY = lampTableY - 170;
      ctx.strokeStyle = pal.lampStand;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(lampFootX, lampTableY + 8);
      ctx.lineTo(lampFootX, lampHeadY + 50);
      ctx.stroke();

      poly(ctx, [
        [lampFootX - 45, lampHeadY + 50],
        [lampFootX + 45, lampHeadY + 50],
        [lampFootX + 28, lampHeadY],
        [lampFootX - 28, lampHeadY]
      ], pal.lampShade);
      ctx.strokeStyle = '#b45309';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Nón sáng đèn bàn tỏa ra
      ctx.save();
      const lampGlow = ctx.createRadialGradient(lampFootX, lampHeadY + 35, 15, lampFootX, lampHeadY + 140, 440);
      lampGlow.addColorStop(0, 'rgba(254, 240, 138, 0.58)');
      lampGlow.addColorStop(0.4, 'rgba(254, 240, 138, 0.24)');
      lampGlow.addColorStop(0.85, 'rgba(254, 240, 138, 0.05)');
      lampGlow.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
      ctx.fillStyle = lampGlow;
      ctx.beginPath();
      ctx.moveTo(lampFootX - 35, lampHeadY + 50);
      ctx.lineTo(lampFootX + 35, lampHeadY + 50);
      ctx.lineTo(lampFootX + 360, groundY + 90);
      ctx.lineTo(lampFootX - 240, groundY + 90);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // BÀN TRÀ
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(tableX + tableW / 2, tableY, tableW / 2, 45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      [tableX + 60, tableX + tableW - 80].forEach(cx => {
        poly(ctx, [[cx, tableY + 20], [cx + 18, tableY + 20], [cx + 14, groundY + 65], [cx + 2, groundY + 65]], '#451a03');
      });

      // Bát bắp rang bơ sọc đỏ trắng
      const popX = tableX + tableW * 0.55;
      const popY = tableY - 45;
      poly(ctx, [[popX - 36, popY], [popX + 36, popY], [popX + 24, popY + 44], [popX - 24, popY + 44]], '#ffffff');
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 6;
      [-16, 0, 16].forEach(sx => {
        ctx.beginPath();
        ctx.moveTo(popX + sx, popY);
        ctx.lineTo(popX + sx * 0.7, popY + 44);
        ctx.stroke();
      });
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3;
      ctx.stroke();
      for (let px = -30; px <= 30; px += 10) {
        circle(ctx, popX + px, popY - 6 - Math.abs(px * 0.2), 9, '#fef08a');
        circle(ctx, popX + px, popY - 14 + Math.sin(px * 3) * 5, 8, '#fef08a');
      }

      // Cốc Gamer
      const mugX = tableX + tableW * 0.32;
      const mugY = tableY - 32;
      ctx.fillStyle = '#0284c7';
      rr(ctx, mugX, mugY, 34, 40, 5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(mugX - 4, mugY + 20, 10, Math.PI * 0.5, Math.PI * 1.5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      rr(ctx, mugX + 7, mugY + 12, 20, 12, 3);
      ctx.fill();

      // Điều khiển TV
      const remX = tableX + tableW * 0.20;
      const remY = tableY - 10;
      ctx.fillStyle = '#1e293b';
      rr(ctx, remX, remY, 40, 16, 3);
      ctx.fill();
      ctx.stroke();
    },

    // 4. FOREGROUND (TV CORNER SILHOUETTE GIVING CINEMATIC DEPTH)
    foreground(ctx) {
      // Góc màn hình TV tiền cảnh phía dưới bên phải (Over-the-shoulder feeling)
      ctx.fillStyle = '#070a12';
      ctx.beginPath();
      ctx.moveTo(W, H);
      ctx.lineTo(W - 220, H);
      ctx.lineTo(W - 160, H - 180);
      ctx.lineTo(W, H - 160);
      ctx.closePath();
      ctx.fill();
      // Ánh sáng xanh hắt nhẹ từ TV
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.25)';
      ctx.lineWidth = 4;
      ctx.stroke();
    },

    // 5. LIGHTING & ATMOSPHERE
    lighting(ctx) {
      drawCinematicVignette(ctx, 0.32);
    }
  });

  return { groundY, sofaX, sofaY, sofaW, sofaH, tableX, tableY, winX, winY };
}

export const drawCozyLivingRoomScene = drawCozyLivingRoomSceneV3;

/**
 * 4. BỐI CẢNH HÀNH LANG CĂNG THẲNG ĐIỆN ẢNH V3 (Tense Hallway V3)
 */
export function drawTenseHallwaySceneV3(g, t, cam = { z: 1, x: 0, y: 0 }) {
  const W = E.W || 1920;
  const H = E.H || 1080;
  const pal = CINEMATIC_PALETTES.tense_hallway;
  const vpX = W * 0.72;
  const vpY = H * 0.46;
  const groundY = H * 0.82;
  const doorEndW = 120;
  const doorEndH = 260;
  const doorEndX = vpX - 60;
  const doorEndY = groundY - doorEndH;

  renderCinematic5Layers(g, t, cam, {
    // 1. BACKGROUND WALL
    background(ctx) {
      ctx.fillStyle = pal.wallBack;
      ctx.fillRect(-W * 0.3, -H * 0.3, W * 1.6, H * 1.6);
    },

    // 2. MID-BACKGROUND (PERSPECTIVE WALLS & OPEN DOOR)
    midBackground(ctx) {
      // Tường trái phối cảnh
      poly(ctx, [
        [-W * 0.3, -H * 0.3],
        [vpX - 160, vpY - 240],
        [vpX - 160, groundY - 40],
        [-W * 0.3, groundY + 140]
      ], pal.wallLeft);

      // Nẹp chân tường và khung tranh lệch trên hành lang
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-W * 0.3, groundY + 140);
      ctx.lineTo(vpX - 160, groundY - 40);
      ctx.stroke();

      // Khung tranh nghiêng tạo cảm giác bất an
      ctx.save();
      ctx.translate(W * 0.25, H * 0.35);
      ctx.rotate(0.08);
      ctx.fillStyle = '#1e293b';
      rr(ctx, -40, -50, 80, 100, 4);
      ctx.fill();
      ctx.restore();

      // Khoang cửa mở hé nơi phát ra âm thanh bí ẩn
      ctx.fillStyle = pal.doorOpen;
      ctx.fillRect(doorEndX, doorEndY, doorEndW, doorEndH);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.strokeRect(doorEndX, doorEndY, doorEndW, doorEndH);

      // Cánh cửa mở hé
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(doorEndX, doorEndY);
      ctx.lineTo(doorEndX - 35, doorEndY + 10);
      ctx.lineTo(doorEndX - 35, groundY);
      ctx.lineTo(doorEndX, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Luồng ánh trăng xanh lạnh rọi xiên qua khe cửa
      ctx.save();
      const moonBeam = ctx.createLinearGradient(doorEndX, doorEndY + 60, doorEndX - 420, groundY + 80);
      moonBeam.addColorStop(0, 'rgba(147, 197, 253, 0.45)');
      moonBeam.addColorStop(0.5, 'rgba(147, 197, 253, 0.15)');
      moonBeam.addColorStop(1, 'rgba(147, 197, 253, 0)');
      ctx.fillStyle = moonBeam;
      ctx.beginPath();
      ctx.moveTo(doorEndX, doorEndY + 20);
      ctx.lineTo(doorEndX + 40, doorEndY);
      ctx.lineTo(doorEndX - 380, groundY + 120);
      ctx.lineTo(doorEndX - 520, groundY + 120);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    // 3. ACTION LAYER (FLOOR & RUNNING SHADOWS)
    action(ctx) {
      // Sàn nhà hành lang
      poly(ctx, [
        [-W * 0.3, groundY + 140],
        [vpX - 160, groundY - 40],
        [W * 1.3, groundY - 40],
        [W * 1.3, H * 1.3]
      ], pal.floor);

      // Nan sàn gỗ hành lang hội tụ về vanishing point
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 2.5;
      for (let fx = -W * 0.2; fx < W * 1.2; fx += 140) {
        ctx.beginPath();
        ctx.moveTo(fx, H + 60);
        ctx.lineTo(vpX - 40, groundY - 40);
        ctx.stroke();
      }

      // Vệt bóng đổ dài ghê rợn
      ctx.fillStyle = 'rgba(0, 0, 0, 0.58)';
      poly(ctx, [
        [doorEndX, groundY - 30],
        [doorEndX + doorEndW, groundY - 30],
        [doorEndX + 300, H + 60],
        [doorEndX - 280, H + 60]
      ], 'rgba(0, 0, 0, 0.58)');
    },

    // 4. FOREGROUND ARCHWAY (PEEKING PERSPECTIVE)
    foreground(ctx) {
      // Khung vòm cửa tiền cảnh bên phải tạo góc máy nhìn trộm
      ctx.fillStyle = '#060a14';
      ctx.beginPath();
      ctx.moveTo(W, -H * 0.2);
      ctx.lineTo(W - 120, -H * 0.2);
      ctx.quadraticCurveTo(W - 140, H * 0.5, W - 90, H * 1.2);
      ctx.lineTo(W, H * 1.2);
      ctx.closePath();
      ctx.fill();
    },

    // 5. LIGHTING & ATMOSPHERE
    lighting(ctx) {
      drawCinematicVignette(ctx, 0.48);
    }
  });

  return { groundY, doorEndX, doorEndY };
}

export const drawTenseHallwayScene = drawTenseHallwaySceneV3;

/**
 * Vẽ Chăn Trùm Kẻ Caro (Cozy Plaid Blanket)
 */
export function drawCozyBlanket(g, cx, cy, w, h, t = 0, isShivering = false) {
  g.save();
  const shiverX = isShivering ? Math.sin(t * 44) * 2.0 : 0;
  const shiverY = isShivering ? Math.cos(t * 48) * 1.5 : 0;
  g.translate(cx + shiverX, cy + shiverY);

  const pal = CINEMATIC_PALETTES.cozy_living_room;

  // Thân chăn
  g.fillStyle = pal.blanket;
  g.strokeStyle = pal.ink;
  g.lineWidth = 4.2;

  g.beginPath();
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

  // Họa tiết kẻ sọc Plaid
  g.save();
  g.clip();
  g.strokeStyle = pal.blanketPlaid;
  g.lineWidth = 4.0;
  for (let x = -w * 0.6; x <= w * 0.6; x += 48) {
    g.beginPath();
    g.moveTo(x, -h);
    g.lineTo(x + 10, h);
    g.stroke();
  }
  for (let y = -h * 0.6; y <= h * 0.6; y += 38) {
    g.beginPath();
    g.moveTo(-w, y);
    g.quadraticCurveTo(0, y + 12, w, y);
    g.stroke();
  }
  g.restore();

  // Mép gập chăn trên
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
