// scenes/shots/01_vfx_weather.js — Phase 3 Demo: Cartoon VFX, Weather Simulation & Energy Auras
import { E, registerShot } from '/engine/core.js';
import { renderCinematic5Layers } from '/engine/cinematic-scene.js';
import { drawWhiteCartoonFigure } from '/engine/white-cartoon-rig2d.js';
import { POSES } from '/engine/rig2d.js';
import {
  drawWeatherStorm,
  drawVfxScreenFlash,
  drawVfxGoldenAura,
  drawVfxEnergyRing,
  drawVfxPowerBurst,
  drawVfxSparkles,
  drawVfxVignette,
  drawVfxIdeaBulb,
  drawVfxSweatDrop,
  drawVfxShockLines,
  drawVfxGroundDust,
  solveVfxCameraShake
} from '/engine/vfx-engine-v4.js';
import { ALEX } from '../cast.js';

registerShot('s001', {
  draw(g, t) {
    // 1. Camera Director with Earthquake Shake during Power Burst (at t ~ 2.5s)
    let camShake = { x: 0, y: 0 };
    if (t >= 2.5 && t <= 3.4) {
      camShake = solveVfxCameraShake(t, { intensity: 1.4, frequency: 50 });
    }

    const cam = {
      z: 1.25 + 0.15 * Math.sin(t * 0.4),
      x: camShake.x,
      y: -25 + camShake.y
    };

    const W = E.W || 1920;
    const H = E.H || 1080;
    const groundY = H * 0.82;
    const alexX = W / 2;
    const alexS = 1.75;

    // 2. Timeline States for Alex:
    // t: [0.0 - 1.2s]: Sợ hãi trong mưa bão (scared), giọt mồ hôi rơi (sweat drop).
    // t: 1.0s: Chớp sấm sét trắng trời (thunder screen flash).
    // t: [1.2 - 2.5s]: Gồng mình kích hoạt hào quang hoàng kim (golden aura) & vòng năng lượng (energy ring), biểu cảm kiên định (determined).
    // t: [2.5 - 3.8s]: Bùng phát sức mạnh (power burst), rung chuyển máy quay, bụi cuộn dưới chân (ground dust), shock lines.
    // t: [4.0 - 6.0s]: Bình tĩnh, nảy ra ý tưởng (idea bulb), hạt sáng lấp lánh (sparkles), mỉm cười tự tin (happy).
    let alexExpr = 'scared';
    let alexPose = { ...POSES.stand };
    const charVfxList = [];

    if (t >= 4.0) {
      alexExpr = 'happy';
      alexPose = {
        ...POSES.stand,
        hF: [28, -80], // tay hơi giơ lên
        hB: [-24, -40]
      };
      charVfxList.push({ type: 'vfx_idea_bulb', attachment: 'head', scale: 1.1, offsetY: -35 });
      charVfxList.push({ type: 'vfx_sparkles', attachment: 'body_center', count: 8, scale: 1.2 });
    } else if (t >= 2.5) {
      alexExpr = 'angry';
      alexPose = {
        ...POSES.wide,
        eF: [35, -55],
        hF: [45, -75],
        eB: [-35, -55],
        hB: [-45, -75]
      };
      // Dual-layer golden aura (Behind corona + front sparks)
      charVfxList.push({ type: 'vfx_golden_aura', layer: 'behind_character', scale: 1.5 });
      charVfxList.push({ type: 'vfx_golden_aura', layer: 'front_character', scale: 1.5 });
      charVfxList.push({ type: 'vfx_energy_ring', attachment: 'chest', scale: 1.2, tilt: -0.15 });
      charVfxList.push({ type: 'vfx_shock_lines', attachment: 'head', scale: 1.2 });
      charVfxList.push({ type: 'vfx_ground_dust', attachment: 'feet', scale: 1.3 });
    } else if (t >= 1.2) {
      alexExpr = 'determined';
      alexPose = {
        ...POSES.stand,
        hF: [22, -60],
        hB: [-22, -60]
      };
      charVfxList.push({ type: 'vfx_golden_aura', layer: 'behind_character', scale: 1.2 });
      charVfxList.push({ type: 'vfx_golden_aura', layer: 'front_character', scale: 1.2 });
      charVfxList.push({ type: 'vfx_energy_ring', attachment: 'chest', scale: 1.1 });
    } else {
      alexExpr = 'scared';
      charVfxList.push({ type: 'vfx_sweat_drop', attachment: 'head', offsetX: 22, offsetY: -10, scale: 1.0 });
    }

    // 3. Render 5-Layer Cinematic Pipeline with Weather & VFX
    renderCinematic5Layers(g, t, cam, {
      // LAYER 1: Background Night Sky & Distant City Skyline
      background(ctx) {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
        skyGrad.addColorStop(0, '#040714');
        skyGrad.addColorStop(0.5, '#0a1026');
        skyGrad.addColorStop(1, '#162040');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

        // Distant dark skyline silhouette
        ctx.fillStyle = '#060a16';
        const bldgs = [[W * 0.05, 360, 240], [W * 0.25, 300, 210], [W * 0.45, 420, 280], [W * 0.7, 340, 230], [W * 0.88, 380, 260]];
        bldgs.forEach(([bx, bw, bh]) => {
          ctx.fillRect(bx, groundY - bh - 40, bw, bh + 80);
        });
      },

      // LAYER 2: Mid-Background Street Buildings & Windows
      midBackground(ctx) {
        ctx.fillStyle = '#0e172a';
        ctx.fillRect(W * 0.12, groundY - 260, 260, 280);
        ctx.fillRect(W * 0.65, groundY - 280, 280, 300);

        // Soft yellow glowing window in the rain
        ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
        ctx.fillRect(W * 0.18, groundY - 220, 60, 80);
        ctx.fillRect(W * 0.72, groundY - 240, 70, 90);
      },

      // LAYER 3: Action Layer (Street, Character Alex with Skeletal Attachments & Power Burst)
      action(ctx) {
        // Wet asphalt street reflection
        const streetGrad = ctx.createLinearGradient(0, groundY - 10, 0, H);
        streetGrad.addColorStop(0, '#111827');
        streetGrad.addColorStop(0.3, '#0b0f19');
        streetGrad.addColorStop(1, '#05070c');
        ctx.fillStyle = streetGrad;
        ctx.fillRect(-W * 0.3, groundY - 10, W * 1.6, H - groundY + 100);

        // Curbside pavement
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-W * 0.3, groundY - 18, W * 1.6, 12);

        // Power Burst shockwave in action layer at t >= 2.5
        if (t >= 2.5 && t <= 3.3) {
          drawVfxPowerBurst(ctx, alexX, groundY - 70, t - 2.5, { scale: 1.4, maxRadius: 180, color: '#facc15' });
        }

        // Draw Character Alex (White Cartoon 2D Rig with Attached V4 VFX)
        drawWhiteCartoonFigure(ctx, {
          x: alexX,
          y: groundY,
          s: alexS,
          facing: 1,
          outfit: ALEX,
          pose: alexPose,
          expr: alexExpr,
          vfx: charVfxList,
          rim: { color: '#67e8f9', dir: [-0.6, -1], w: 4 },
          shadow: true,
          t
        });
      },

      // LAYER 4: Foreground Rain Splashes & Street Details
      foreground(ctx) {
        // Subtle dark foreground corner posts
        ctx.fillStyle = '#060a12';
        ctx.fillRect(-20, groundY - 120, 45, 140);
        ctx.fillRect(W - 25, groundY - 120, 45, 140);
      },

      // LAYER 5: Weather Simulation & Screen Overlays
      weather(ctx) {
        // Storm engine: Heavy slanted rain, splashing ripples, thunder flashes & lightning
        drawWeatherStorm(ctx, t, { rainColor: '#bae6fd', lightning: true });
      },

      screenOverlay(ctx) {
        // Intermittent thunder screen flash at t ~ 1.0s
        if (t >= 1.0 && t <= 1.25) {
          drawVfxScreenFlash(ctx, t, { startTime: 1.0, duration: 0.25, color: '#e0e7ff', intensity: 0.75 });
        }

        // Cinematic vignette
        drawVfxVignette(ctx, t, { darkness: 0.55 });
      }
    });
  }
});
