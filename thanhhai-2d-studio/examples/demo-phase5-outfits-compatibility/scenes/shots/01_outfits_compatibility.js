// scenes/shots/01_outfits_compatibility.js — Phase 5 Demo: Outfit Library & Universal Asset Compatibility
// 30-Second Showcase of 5 Distinct Outfits on the Same Character (Doc) with 100% Identity Preservation:
// S1 (0-5s): Casual Hoodie & Yellow Cap
// S2 (5-10s): Scientist Labcoat & Wire Glasses with Walk Cycle
// S3 (10-15s): Business Suit, Tailored Lapels & Red Silk Tie
// S4 (15-20s): Historical Inventor, Tweed Vest, Gold Watch Chain & Brass Goggles
// S5 (20-25s): Fight Cloud Brawl with Alex — Outfits & Faces Preserved
// S6 (25-30s): Winter Parka with Fur Collar, Red Scarf & Falling Snow

import { E, registerShot, clamp, lerp, circle, ring, poly, rr } from '/engine/core.js';
import { renderCinematic5Layers } from '/engine/cinematic-scene.js';
import {
  solveWalkCycle,
  solveRunCycle
} from '/engine/action-engine.js';
import {
  solveCompositeAction,
  drawCompositeAction
} from '/engine/action-engine-v4.js';
import {
  drawWhiteCartoonFigure,
  drawWhiteCartoonHead,
  WHITE_CARTOON_PRESETS
} from '/engine/white-cartoon-rig2d.js';
import {
  drawUniversalVfx,
  drawVfxFightSmoke,
  drawVfxDizzyStars,
  drawVfxDustCloud,
  drawVfxImpactFlash,
  solveVfxCameraShake
} from '/engine/vfx-engine-v4.js';
import {
  applyOutfitToCharacter,
  solveCharacterOutfitAtTime
} from '/engine/outfit-engine-v4.js';
import { DOC, ALEX } from '../cast.js';

registerShot('s001', {
  draw(g, t) {
    const W = E.W || 1280;
    const H = E.H || 720;
    const groundY = H * 0.82;
    const centerX = W / 2;

    // 1. DYNAMIC CAMERA & SHAKE CONTROLLER
    let camShake = { x: 0, y: 0 };
    let camZ = 1.12;
    let camY = -10;

    if (t >= 21.0 && t <= 24.2) {
      camShake = solveVfxCameraShake(t, { intensity: 10.0, frequency: 45 });
      camZ = 1.22;
    }

    const cam = {
      z: camZ,
      x: camShake.x,
      y: camY + camShake.y
    };

    // 2. TIMELINE OUTFIT SOLVER FOR DOC
    // Stage 1 (0-5s): Casual Hoodie
    // Stage 2 (5-10s): Scientist Labcoat
    // Stage 3 (10-15s): Business Suit
    // Stage 4 (15-20s): Historical Inventor
    // Stage 5 (20-25s): Inventor vs Alex Hoodie in Brawl
    // Stage 6 (25-30s): Winter Parka with Fur Collar
    let activeOutfitId = 'outfit_casual_hoodie';
    let bannerTitle = '1/5: Casual Hoodie — Identity Locked (Skin #FFFDF8, Silver Hair)';
    let bannerColor = '#ef4444';

    if (t < 5.0) {
      activeOutfitId = 'outfit_casual_hoodie';
      bannerTitle = '1/5: Casual Hoodie & Sneakers — Identity Preserved (#FFFDF8 Skin, Gray Hair)';
      bannerColor = '#f59e0b';
    } else if (t < 10.0) {
      activeOutfitId = 'outfit_scientist_labcoat';
      bannerTitle = '2/5: Scientist Labcoat & Wire Glasses — Bone-tracking sleeves & collar snap';
      bannerColor = '#38bdf8';
    } else if (t < 15.0) {
      activeOutfitId = 'outfit_business_suit';
      bannerTitle = '3/5: Business Suit — Tailored Lapels, Red Silk Tie & Formal Trousers';
      bannerColor = '#3b82f6';
    } else if (t < 20.0) {
      activeOutfitId = 'outfit_historical_inventor';
      bannerTitle = '4/5: Historical Inventor — Tweed Vest, Gold Watch Chain & Brass Goggles';
      bannerColor = '#d97706';
    } else if (t < 25.0) {
      activeOutfitId = 'outfit_historical_inventor';
      bannerTitle = 'Fight Cloud Brawl — Outfits & Facial Identity Preserved Before & After!';
      bannerColor = '#ef4444';
    } else {
      activeOutfitId = 'outfit_winter_coat';
      bannerTitle = '5/5: Winter Parka — Fur Collar, Red Scarf & Falling Snow (100% Compatible)';
      bannerColor = '#10b981';
    }

    // Solve Doc with active outfit (Identity stays 100% Doc)
    const docFigure = applyOutfitToCharacter(DOC, activeOutfitId);
    const alexFigure = applyOutfitToCharacter(ALEX, 'outfit_casual_hoodie');

    // 3. RENDER 5-LAYER BACKGROUND & CHARACTER PIPELINE
    renderCinematic5Layers(g, t, cam, {
      background(ctx) {
        // Deep modern lab & studio interior
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        if (t >= 25.0) {
          // Winter cold outdoor dusk
          bgGrad.addColorStop(0, '#020617');
          bgGrad.addColorStop(0.5, '#0f172a');
          bgGrad.addColorStop(1, '#1e293b');
        } else {
          // Warm lab/studio room
          bgGrad.addColorStop(0, '#0a0f1d');
          bgGrad.addColorStop(0.6, '#111827');
          bgGrad.addColorStop(1, '#1e293b');
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(-W * 0.2, -H * 0.2, W * 1.4, H * 1.4);

        // Lab windows & blueprint shelves
        ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.fillRect(centerX - 380, groundY - 320, 240, 200);
        ctx.fillRect(centerX + 140, groundY - 320, 240, 200);

        // Grid lines on blueprint window
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        for (let x = -380; x <= -140; x += 30) {
          ctx.beginPath();
          ctx.moveTo(centerX + x, groundY - 320);
          ctx.lineTo(centerX + x, groundY - 120);
          ctx.stroke();
        }
      },

      midBackground(ctx) {
        // Laboratory bench and presentation table
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(-W * 0.2, groundY - 40, W * 1.4, 40);

        // Equipment rack on left
        ctx.fillStyle = '#374151';
        ctx.fillRect(centerX - 420, groundY - 180, 80, 140);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(centerX - 410, groundY - 165, 12, 12);
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(centerX - 390, groundY - 165, 12, 12);
      },

      actors(ctx) {
        // Floor line
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-W * 0.2, groundY);
        ctx.lineTo(W * 1.2, groundY);
        ctx.stroke();

        // ====================================================================
        // STAGE 1: Doc in Casual Hoodie (t: 0 - 5s)
        // ====================================================================
        if (t < 5.0) {
          const wavePhase = (t * 2.5) % 1;
          const waveAngle = Math.sin(wavePhase * Math.PI * 2) * 0.35 - 1.2;
          const mouthOpen = (Math.sin(t * 12) > 0) ? 0.4 : 0.1;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(centerX, groundY + 4, 38, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Figure
          drawWhiteCartoonFigure(ctx, centerX, groundY, {
            figure: docFigure,
            pose: 'custom',
            look: 'front',
            mouth: mouthOpen,
            expr: 'happy',
            armR: waveAngle,
            armL: 0.2,
            flip: false,
            scale: 1.05
          });

          // Speaking bubble hint
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👋 "Xin chào! Tôi là Doc — cùng kiểm tra hệ thống Outfits V4!"', centerX, groundY - 210);
        }

        // ====================================================================
        // STAGE 2: Doc in Scientist Labcoat & Walk Cycle (t: 5 - 10s)
        // ====================================================================
        else if (t < 10.0) {
          const tRel = t - 5.0;
          // Walk across screen from left to right
          const posX = centerX - 180 + (tRel / 5.0) * 360;
          const walkCycle = solveWalkCycle(tRel * 1.8);

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(posX, groundY + 4, 36, 9, 0, 0, Math.PI * 2);
          ctx.fill();

          // Walk figure with Labcoat
          drawWhiteCartoonFigure(ctx, posX, groundY, {
            figure: docFigure,
            pose: 'walk',
            walkPhase: tRel * 1.8,
            look: 'right',
            mouth: 0.15,
            expr: 'neutral',
            scale: 1.05
          });

          // Lab coat pen & flask sparkle
          drawUniversalVfx(ctx, posX + 25, groundY - 90, 'vfx_idea_bulb', tRel, { scale: 0.4, alpha: 0.7 });
        }

        // ====================================================================
        // STAGE 3: Doc in Business Suit & Presentation (t: 10 - 15s)
        // ====================================================================
        else if (t < 15.0) {
          const tRel = t - 10.0;
          const gestureArm = Math.sin(tRel * 3) * 0.3 - 0.6;

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(centerX - 40, groundY + 4, 40, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Business Suit Figure
          drawWhiteCartoonFigure(ctx, centerX - 40, groundY, {
            figure: docFigure,
            pose: 'custom',
            look: 'front',
            mouth: (Math.sin(tRel * 10) > 0) ? 0.35 : 0.05,
            expr: 'determined',
            armR: gestureArm,
            armL: 0.15,
            scale: 1.05
          });

          // Presentation chalkboard / holographic slide on right
          ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(centerX + 80, groundY - 210, 260, 170, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 13px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText('📊 THÔNG SỐ ÂU PHỤC (SUIT):', centerX + 95, groundY - 180);
          ctx.fillStyle = '#f8fafc';
          ctx.font = '12px monospace';
          ctx.fillText('• Ve áo: Chuẩn chữ V Tailored', centerX + 95, groundY - 155);
          ctx.fillText('• Cà vạt: Lụa đỏ bám ngực', centerX + 95, groundY - 135);
          ctx.fillText('• Quần: Tây âu than gấp nếp', centerX + 95, groundY - 115);
          ctx.fillText('• Giày: Da tây bóng lộn', centerX + 95, groundY - 95);
          ctx.fillText('• Danh tính: Độc lập 100%', centerX + 95, groundY - 75);
        }

        // ====================================================================
        // STAGE 4: Doc in Historical Inventor (t: 15 - 20s)
        // ====================================================================
        else if (t < 20.0) {
          const tRel = t - 15.0;
          const isEureka = (tRel >= 2.0);

          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
          ctx.beginPath();
          ctx.ellipse(centerX, groundY + 4, 38, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Figure
          drawWhiteCartoonFigure(ctx, centerX, groundY, {
            figure: docFigure,
            pose: 'custom',
            look: isEureka ? 'front' : 'up',
            mouth: isEureka ? 0.5 : 0.1,
            expr: isEureka ? 'surprised' : 'thinking',
            armR: isEureka ? -1.3 : -0.7,
            armL: 0.1,
            scale: 1.05
          });

          // Eureka bulb above head
          if (isEureka) {
            drawUniversalVfx(ctx, centerX, groundY - 185, 'vfx_idea_bulb', tRel - 2.0, { scale: 1.2 });
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('💡 "EUREKA! SÁNG CHẾ HOÀN TẤT!"', centerX, groundY - 225);
          } else {
            drawUniversalVfx(ctx, centerX + 30, groundY - 165, 'vfx_question_mark', tRel, { scale: 0.9 });
          }
        }

        // ====================================================================
        // STAGE 5: Fight Cloud Brawl with Alex (t: 20 - 25s)
        // ====================================================================
        else if (t < 25.0) {
          const tRel = t - 20.0;
          const brawlSpec = {
            id: 'composite_fight_cloud',
            startTime: 20.0,
            duration: 5.0,
            roles: { fighter_a: 'doc', fighter_b: 'alex' }
          };

          const actorStates = {
            doc: { ...docFigure, x: centerX - 120, y: groundY },
            alex: { ...alexFigure, x: centerX + 120, y: groundY }
          };

          drawCompositeAction(ctx, brawlSpec, t, actorStates, {
            centerX,
            groundY,
            smokeScale: 1.35
          });
        }

        // ====================================================================
        // STAGE 6: Doc in Winter Parka & Falling Snow (t: 25 - 30s)
        // ====================================================================
        else {
          const tRel = t - 25.0;
          const waveHand = Math.sin(tRel * 3) * 0.3 - 0.9;

          // Snow ground coating
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(-W * 0.2, groundY - 6, W * 1.4, 25);

          // Shadow on snow
          ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
          ctx.beginPath();
          ctx.ellipse(centerX, groundY + 4, 42, 11, 0, 0, Math.PI * 2);
          ctx.fill();

          // Doc in Winter Parka
          drawWhiteCartoonFigure(ctx, centerX, groundY, {
            figure: docFigure,
            pose: 'custom',
            look: 'front',
            mouth: 0.2,
            expr: 'happy',
            armR: waveHand,
            armL: 0.15,
            scale: 1.05
          });

          // Procedural falling snowflakes
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 60; i++) {
            const sx = (centerX - 400 + ((i * 47 + tRel * 85) % 800)) % W;
            const sy = ((i * 31 + tRel * 140) % (groundY + 40));
            const sr = 1.5 + (i % 3) * 1.2;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
          }

          // Greeting caption
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 15px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('❄️ "Thanh Hai 2D Studio V4 — Tương Thích Trang Phục Hoàn Hảo!"', centerX, groundY - 210);
        }
      },

      foreground(ctx) {
        // Top Banner with Title, Stage description & Compatibility Badge
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.strokeStyle = bannerColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(centerX - 360, 24, 720, 52, 8);
        ctx.fill();
        ctx.stroke();

        // Stage text
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bannerTitle, centerX, 55);

        // Progress timeline bar
        const progressW = (t / 30.0) * 700;
        ctx.fillStyle = bannerColor;
        ctx.fillRect(centerX - 350, 70, progressW, 4);

        // Watermark badge on bottom right
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.roundRect(W - 270, H - 42, 250, 30, 4);
        ctx.fill();
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('🛡️ UNIVERSAL COMPATIBILITY V4', W - 258, H - 23);
      }
    });
  }
});
