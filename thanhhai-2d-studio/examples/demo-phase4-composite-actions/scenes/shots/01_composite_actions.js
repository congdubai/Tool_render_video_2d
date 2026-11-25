// scenes/shots/01_composite_actions.js — Phase 4 Demo: Composite Action Engine & Universal Motion Library
// 30-Second Showcase of 7 Cartoon Motion Stages:
// Stage 1 (0-4s): Walk & Talk
// Stage 2 (4-8s): Cartoon Argument & Forehead Clash
// Stage 3 (8-14s): Fight Cloud Brawl with Real Character Head Pop-outs (Alex & Jake)
// Stage 4 (14-18s): Smoke Dissipation & Dizzy Aftermath
// Stage 5 (18-22s): Alex Power Up Surge (Golden Aura, Sparks, Shockwave)
// Stage 6 (22-26s): Cartoon Chase (Speed Lines & Panicked Sprint)
// Stage 7 (26-30s): Comedic Slip & Fall (Airborne Feet, Floor Slam & Dizzy Stars)

import { E, registerShot, clamp, lerp, circle, ring, poly, rr } from '/engine/core.js';
import { renderCinematic5Layers } from '/engine/cinematic-scene.js';
import {
  solveWalkCycle,
  solveRunCycle,
  solveFallBackwardAction,
  solveSitDownTransition
} from '/engine/action-engine.js';
import {
  solveCompositeAction,
  drawCompositeAction,
  solveCompositeActorPose
} from '/engine/action-engine-v4.js';
import {
  drawWhiteCartoonFigure,
  drawWhiteCartoonHead,
  WHITE_CARTOON_PRESETS
} from '/engine/white-cartoon-rig2d.js';
import {
  drawUniversalVfx,
  drawVfxFightSmoke,
  drawVfxGoldenAura,
  drawVfxDizzyStars,
  drawVfxSpeedLines,
  drawVfxDustCloud,
  drawVfxImpactFlash,
  drawVfxShockwave,
  solveVfxCameraShake
} from '/engine/vfx-engine-v4.js';
import { ALEX, JAKE } from '../cast.js';

registerShot('s001', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;
    const groundY = H * 0.80;
    const centerX = W / 2;

    // 1. DYNAMIC CAMERA & SHAKE CONTROLLER
    let camShake = { x: 0, y: 0 };
    let camZ = 1.15;
    let camY = -15;

    // Camera shake spikes during Fight Cloud collision (t ~ 9.5s), Brawl rumble (t 9.5-13.5s), Power Burst (t ~ 21s), Fall slam (t ~ 27.5s)
    if (t >= 9.2 && t <= 13.8) {
      const brawlShake = t <= 9.8 ? 16 : 7.0;
      camShake = solveVfxCameraShake(t, { intensity: brawlShake, frequency: 45 });
      camZ = 1.25;
    } else if (t >= 19.5 && t <= 21.8) {
      camShake = solveVfxCameraShake(t, { intensity: 12.0, frequency: 50 });
      camZ = 1.30;
    } else if (t >= 27.2 && t <= 28.5) {
      camShake = solveVfxCameraShake(t, { intensity: 10.0, frequency: 40 });
      camZ = 1.20;
    }

    const cam = {
      z: camZ,
      x: camShake.x,
      y: camY + camShake.y
    };

    // 2. RENDER CINEMATIC 5-LAYER BACKGROUND & ACTION PIPELINE
    renderCinematic5Layers(g, t, cam, {
      // LAYER 1: Deep Twilight Sky & Distant High-Rise Skyline
      background(ctx) {
        const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
        sky.addColorStop(0, '#020617');
        sky.addColorStop(0.4, '#0f172a');
        sky.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = sky;
        ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

        // Distant Glowing City Skyline
        const bldCount = 14;
        const bldW = W / (bldCount - 2);
        for (let i = 0; i < bldCount; i++) {
          const bh = 180 + ((i * 73) % 240);
          const bx = i * bldW - W * 0.1;
          const by = groundY - bh - 60;
          ctx.fillStyle = '#0a0f1d';
          ctx.fillRect(bx, by, bldW - 14, bh + 70);

          // Glowing windows
          ctx.fillStyle = (i % 2 === 0) ? '#fef08a' : '#38bdf8';
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 3; c++) {
              if ((i + r + c) % 3 === 0) {
                ctx.fillRect(bx + 12 + c * 24, by + 16 + r * 28, 12, 16);
              }
            }
          }
        }
      },

      // LAYER 2: Mid-ground Shopfronts & Warm Ambient Light
      midBackground(ctx) {
        // Pavement and shop front silhouettes
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-W * 0.2, groundY - 140, W * 1.4, 140);

        // Warm shop windows
        [-380, 0, 380].forEach(sx => {
          ctx.fillStyle = '#334155';
          ctx.fillRect(centerX + sx - 130, groundY - 130, 260, 130);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.15)';
          ctx.fillRect(centerX + sx - 120, groundY - 120, 240, 110);
        });
      },

      // LAYER 3: Action Layer (Sidewalk, Road, Street Lamp & Characters)
      action(ctx) {
        // Sidewalk curb and asphalt road
        ctx.fillStyle = '#334155';
        ctx.fillRect(-W * 0.2, groundY - 10, W * 1.4, 25);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-W * 0.2, groundY + 15, W * 1.4, H - groundY);

        // Road white markings
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        for (let x = -W * 0.1; x < W * 1.1; x += 140) {
          ctx.fillRect(x, groundY + 70, 70, 8);
        }

        // Street Lamp Pole & Light Cones
        [-450, 450].forEach(lx => {
          const lpx = centerX + lx;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(lpx - 6, groundY - 340, 12, 340);
          // Lamp head
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(lpx, groundY - 345, 20, Math.PI, 0);
          ctx.fill();
          // Warm radial glow cone
          const cone = ctx.createRadialGradient(lpx, groundY - 330, 10, lpx, groundY - 100, 320);
          cone.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
          cone.addColorStop(0.6, 'rgba(254, 240, 138, 0.12)');
          cone.addColorStop(1, 'rgba(254, 240, 138, 0)');
          ctx.fillStyle = cone;
          ctx.beginPath();
          ctx.moveTo(lpx, groundY - 330);
          ctx.lineTo(lpx - 220, groundY + 20);
          ctx.lineTo(lpx + 220, groundY + 20);
          ctx.closePath();
          ctx.fill();
        });

        // ====================================================================
        // 3. SEVEN COMPOSITE ACTION STAGES COORDINATION
        // ====================================================================

        // --------------------------------------------------------------------
        // STAGE 1 (0.0s - 4.0s): WALK & TALK
        // --------------------------------------------------------------------
        if (t < 4.0) {
          const p = t / 4.0;
          const walkAlex = solveWalkCycle(t, { speed: 1.1 });
          const walkJake = solveWalkCycle(t + 0.3, { speed: 1.1 });

          const alexX = centerX - 140 + p * 30;
          const jakeX = centerX + 120 + p * 30;

          // Alex talking and gesturing happily
          ctx.save();
          ctx.translate(alexX, groundY);
          drawWhiteCartoonFigure(ctx, {
            x: 0, y: 0, s: 1.55, facing: 1, dir: 'side_right',
            pose: walkAlex, outfit: ALEX, expr: 'talking', ink: '#20202A'
          });
          ctx.restore();

          // Jake walking beside him listening
          ctx.save();
          ctx.translate(jakeX, groundY);
          drawWhiteCartoonFigure(ctx, {
            x: 0, y: 0, s: 1.55, facing: -1, dir: 'side_left',
            pose: walkJake, outfit: JAKE, expr: 'happy', ink: '#20202A'
          });
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 2 (4.0s - 8.0s): CARTOON ARGUMENT & FOREHEAD CLASH
        // --------------------------------------------------------------------
        else if (t < 8.0) {
          const actTime = t - 4.0;
          const stateArgue = solveCompositeAction('composite_cartoon_argument', {
            debater_a: 'character_A',
            debater_b: 'character_B'
          }, actTime, 0, 4.0);

          ctx.save();
          ctx.translate(centerX, groundY);
          ctx.scale(1.55, 1.55);
          drawCompositeAction(ctx, stateArgue, actTime);
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 3 (8.0s - 14.0s): FIGHT CLOUD BRAWL WITH REAL HEAD POP-OUTS!
        // --------------------------------------------------------------------
        else if (t < 14.0) {
          const actTime = t - 8.0;
          const stateFight = solveCompositeAction('composite_fight_cloud', {
            fighter_a: 'character_A',
            fighter_b: 'character_B'
          }, actTime, 0, 6.0, { smokeScale: 1.55, shakeIntensity: 1.25 });

          ctx.save();
          ctx.translate(centerX, groundY);
          ctx.scale(1.55, 1.55);
          drawCompositeAction(ctx, stateFight, actTime);
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 4 (14.0s - 18.0s): SMOKE DISSIPATION & DIZZY AFTERMATH
        // --------------------------------------------------------------------
        else if (t < 18.0) {
          const aftermathTime = t - 14.0;
          const p = clamp(aftermathTime / 4.0, 0, 1);

          const alexX = centerX - 240;
          const jakeX = centerX + 240;

          // Alex dizzy slumped on ground with orbiting stars
          ctx.save();
          ctx.translate(alexX, groundY);
          ctx.scale(1.55, 1.55);
          drawWhiteCartoonFigure(ctx, {
            x: 0, y: 0, s: 1.0, facing: 1, dir: 'front',
            pose: solveSitDownTransition(1.0), outfit: ALEX, expr: 'dizzy', ink: '#20202A',
            vfx: [{ type: 'vfx_dizzy_stars', attachment: 'head', layer: 'front', scale: 1.2 }]
          });
          ctx.restore();

          // Jake dizzy slumped on ground with orbiting stars
          ctx.save();
          ctx.translate(jakeX, groundY);
          ctx.scale(1.55, 1.55);
          drawWhiteCartoonFigure(ctx, {
            x: 0, y: 0, s: 1.0, facing: -1, dir: 'front',
            pose: solveSitDownTransition(1.0), outfit: JAKE, expr: 'dizzy', ink: '#20202A',
            vfx: [{ type: 'vfx_dizzy_stars', attachment: 'head', layer: 'front', scale: 1.2 }]
          });
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 5 (18.0s - 22.0s): ALEX POWER UP SURGE
        // --------------------------------------------------------------------
        else if (t < 22.0) {
          const actTime = t - 18.0;
          const statePower = solveCompositeAction('composite_power_up', {
            actor: 'character_A'
          }, actTime, 0, 4.0);

          // Jake in background cowering in fear
          ctx.save();
          ctx.translate(centerX + 320, groundY);
          ctx.scale(1.4, 1.4);
          drawWhiteCartoonFigure(ctx, {
            x: 0, y: 0, s: 1.0, facing: -1, dir: 'side_left',
            pose: solveSitDownTransition(1.0), outfit: JAKE, expr: 'shocked', ink: '#20202A',
            vfx: [{ type: 'vfx_sweat', attachment: 'head', layer: 'front' }]
          });
          ctx.restore();

          // Alex powering up in center
          ctx.save();
          ctx.translate(centerX - 80, groundY);
          ctx.scale(1.65, 1.65);
          drawCompositeAction(ctx, statePower, actTime);
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 6 (22.0s - 26.0s): CARTOON CHASE
        // --------------------------------------------------------------------
        else if (t < 26.0) {
          const actTime = t - 22.0;
          const stateChase = solveCompositeAction('composite_chase', {
            runner: 'character_B',
            chaser: 'character_A'
          }, actTime, 0, 4.0);

          ctx.save();
          ctx.translate(centerX, groundY);
          ctx.scale(1.55, 1.55);
          drawCompositeAction(ctx, stateChase, actTime);
          ctx.restore();
        }

        // --------------------------------------------------------------------
        // STAGE 7 (26.0s - 30.0s): COMEDIC SLIP & FALL
        // --------------------------------------------------------------------
        else {
          const actTime = t - 26.0;
          const stateFall = solveCompositeAction('composite_funny_fall', {
            actor: 'character_B'
          }, actTime, 0, 4.0);

          // Banana peel on ground
          ctx.save();
          ctx.translate(centerX, groundY + 4);
          ctx.fillStyle = '#facc15';
          ctx.strokeStyle = '#20202A';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(0, 0, 16, 6, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          // Jake slipping & falling
          ctx.save();
          ctx.translate(centerX, groundY);
          ctx.scale(1.55, 1.55);
          drawCompositeAction(ctx, stateFall, actTime);
          ctx.restore();
        }
      },

      // LAYER 4: Foreground Elements (Sidewalk curb & Street lamps)
      foreground(ctx) {
        // Decorative street plants & curb line
        ctx.fillStyle = '#064e3b';
        [-650, 650].forEach(px => {
          ctx.beginPath();
          ctx.arc(centerX + px, groundY + 30, 45, 0, Math.PI * 2);
          ctx.fill();
        });
      },

      // LAYER 5: Lighting & Atmosphere + Cinematic HUD Stage Banners
      lighting(ctx) {
        // Vignette
        const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75);
        vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vig.addColorStop(1, 'rgba(3, 7, 18, 0.7)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);

        // ====================================================================
        // CINEMATIC HUD: STAGE TITLE BANNER
        // ====================================================================
        let stageName = '';
        let stageDesc = '';
        let stageColor = '#38bdf8';

        if (t < 4.0) {
          stageName = 'GIAI ĐOẠN 1: ĐI DẠO & TRÒ CHUYỆN (WALK & TALK)';
          stageDesc = 'Alex & Jake dạo phố cùng chu kỳ bước tự nhiên (Natural Walk Cycle) & trò chuyện.';
          stageColor = '#38bdf8';
        } else if (t < 8.0) {
          stageName = 'GIAI ĐOẠN 2: KHẨU CHIẾN HOẠT HÌNH (CARTOON ARGUMENT)';
          stageDesc = 'Tranh cãi nảy lửa: A chỉ tay quát mắng nhả khói, B lườm nguýt phản công & cụng trán.';
          stageColor = '#fb923c';
        } else if (t < 14.0) {
          stageName = 'GIAI ĐOẠN 3: ĐÁM KHÓI ẨU ĐẢ BỌC KÍN (FIGHT CLOUD BRAWL)';
          stageDesc = 'Bọc kín thân thể trong khói quay tít, thò đầu (giữ nguyên đầu Alex/Jake) & vung đấm đá comic.';
          stageColor = '#ef4444';
        } else if (t < 18.0) {
          stageName = 'GIAI ĐOẠN 4: KHÓI TAN & SAO CHOÁNG VÁNG (DIZZY AFTERMATH)';
          stageDesc = 'Khói tan, thân thể hiện lại, văng ra hai bên nằm bẹp và sao choáng váng bay quanh đầu.';
          stageColor = '#a855f7';
        } else if (t < 22.0) {
          stageName = 'GIAI ĐOẠN 5: BÙNG NỔ HÀO QUANG HOÀNG KIM (POWER UP SURGE)';
          stageDesc = 'Alex tụ khí gồng mình, hào quang vàng bùng phát kèm tia sét & sóng xung kích.';
          stageColor = '#f59e0b';
        } else if (t < 26.0) {
          stageName = 'GIAI ĐOẠN 6: CUỘC ĐUỔI BẮT TỐC ĐỘ (CARTOON CHASE)';
          stageDesc = 'Jake hoảng hốt tháo chạy với vệt tốc độ & mồ hôi, Alex rượt đuổi quyết liệt.';
          stageColor = '#3b82f6';
        } else {
          stageName = 'GIAI ĐOẠN 7: NGÃ TRƯỢT VỎ CHUỐI HÀI HƯỚC (FUNNY FALL)';
          stageDesc = 'Jake trượt chân, hai chân bắn lên trời, rơi đập sàn nảy tưng & sao bay quanh đầu.';
          stageColor = '#eab308';
        }

        ctx.save();
        // Top HUD Box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        ctx.strokeStyle = stageColor;
        ctx.lineWidth = 2.5;
        rr(ctx, W / 2 - 460, 24, 920, 68, 10);
        ctx.fill();
        ctx.stroke();

        // Stage Title
        ctx.fillStyle = stageColor;
        ctx.font = '900 17px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stageName, W / 2, 50);

        // Stage Subtext
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '500 13px sans-serif';
        ctx.fillText(stageDesc, W / 2, 74);

        // Progress Pill in bottom right
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        rr(ctx, W - 180, H - 48, 155, 32, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.font = '700 13px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${t.toFixed(1)}s / 30.0s`, W - 102, H - 28);

        ctx.restore();
      }
    });
  }
});

