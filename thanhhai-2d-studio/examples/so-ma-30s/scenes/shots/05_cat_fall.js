// scenes/shots/05_cat_fall.js — Cảnh 5: Mèo nhảy ra, Nam ngã ngửa comic rồi cười trừ (Medium Action & Resolution)
import { E, registerShot, clamp, lerp, ease, circle, poly } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { drawTenseHallwaySceneV3, drawCinematicVignette, SHOT_TYPES } from '/engine/cinematic-scene.js';
import { solveFallBackwardAction, drawBroom, drawBlackCat } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s005_cat_fall', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // Rung lắc giật nảy màn hình khi giật mình và ngã đập lưng xuống sàn (1.2 -> 2.4s)
    let shakeX = 0, shakeY = 0;
    if (t >= 1.2 && t <= 2.4) {
      const sAmp = (1 - (t - 1.2) / 1.2) * 14;
      shakeX = Math.sin(t * 54) * sAmp;
      shakeY = Math.cos(t * 46) * sAmp;
    }

    const s = 1.55;
    const namX = W * 0.44;

    // CAMERA DIRECTOR:
    // 0 -> 3.5s: Medium Action Framing (z = 1.55) bắt trọn cú nhảy của mèo và cú ngã nảy người
    // 3.8 -> 6.0s: Easing in to Medium-Close (z = 1.75) cận cảnh Nam cười trừ và chú mèo cute
    const isResolution = t >= 3.8;
    const camZ = isResolution ? lerp(1.55, 1.80, ease.out(clamp((t - 3.8) / 1.2, 0, 1))) : 1.55;
    const targetCamX = -(namX - W * 0.46) + shakeX;

    const cam = {
      z: camZ,
      x: targetCamX,
      y: (isResolution ? -80 : -110) + shakeY
    };

    // 1. Vẽ bối cảnh hành lang 5 lớp điện ảnh (V3)
    const { groundY, doorEndX } = drawTenseHallwaySceneV3(g, t, cam);

    // 2. Chuyển động ngã comic của Nam
    let namPose, namExpr, namLook;

    if (t < 1.2) {
      // Nam đứng thủ thế cầm chổi sẵn sàng tấn công
      namPose = {
        hip: [0, -40],
        sh: [2, -78],
        head: [4, -122],
        eF: [28, -80], hF: [36, -92],
        eB: [14, -80], hB: [22, -92],
        kF: [10, -20], fF: [12, 0],
        kB: [-10, -20], fB: [-10, 0]
      };
      namExpr = 'surprised';
      namLook = [1.0, -0.2];
    } else if (t < 3.8) {
      // 1.2 -> 3.8s: Mèo nhảy ra -> Nam hoảng hốt ngã ngửa ra sau, hai chân giơ lên trời!
      const fallProg = (t - 1.2) / 2.0;
      namPose = solveFallBackwardAction(fallProg);
      namExpr = 'terrified';
      namLook = [0.8, -0.5];
    } else {
      // 3.8 -> 6.0s: Nằm trên sàn, gượng ngồi dậy nhìn con mèo rồi gãi đầu cười sảng khoái
      const recoverProg = clamp((t - 3.8) / 0.8, 0, 1);
      namPose = {
        hip: [-20, -10],
        sh: [-50 + recoverProg * 10, -32 * recoverProg],
        head: [-85 + recoverProg * 18, -65 * recoverProg],
        eF: [-35, -12], hF: [-15, -4],
        eB: [-60, -8], hB: [-40, -4],
        kF: [-4, -16], fF: [18, -4],
        kB: [-12, -14], fB: [8, -4]
      };
      namExpr = 'laughing';
      namLook = [0.9, 0.2];
    }

    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    // 3. Vẽ Nam
    drawFigure(g, {
      x: namX,
      y: groundY,
      s,
      facing: 1,
      outfit: NAM,
      pose: namPose,
      expr: namExpr,
      look: namLook,
      shadow: true,
      rimCool: '#93c5fd',
      rimWarm: '#fef08a',
      t
    });

    // 4. Cây chổi bị hất văng lên không trung xoay tít rồi rơi xuống sàn
    if (t < 1.2) {
      drawBroom(g, namX + 45, groundY - 110, 0.45, 120);
    } else if (t < 2.5) {
      // Bay xoay tròn trên không
      const flyProg = (t - 1.2) / 1.3;
      const bx = namX + 40 - flyProg * 50;
      const by = (groundY - 120) - Math.sin(flyProg * Math.PI) * 160;
      const bRot = flyProg * Math.PI * 4;
      drawBroom(g, bx, by, bRot, 120);
    } else {
      // Nằm yên trên sàn
      drawBroom(g, namX - 50, groundY + 12, 1.45, 120);
    }

    // 5. Chú mèo đen nhảy vọt ra từ cửa (The Leaping Black Cat)
    if (t >= 1.0 && t < 2.8) {
      // Pha mèo bay qua không trung
      const leapProg = (t - 1.0) / 1.6;
      const catX = lerp(doorEndX + 40, doorEndX - 340, leapProg);
      const catY = groundY - 100 - Math.sin(leapProg * Math.PI) * 95;
      drawBlackCat(g, catX, catY, 'leap', t);

      // Chữ comic tiếng kêu MEOWWW!
      g.save();
      g.translate(catX - 30, catY - 55);
      g.rotate(-0.15);
      g.fillStyle = '#fef08a';
      g.strokeStyle = '#111827';
      g.lineWidth = 4.5;
      g.font = 'bold 36px sans-serif';
      g.strokeText('🐱 NGOAOOO... MEOW! 🐱', 0, 0);
      g.fillText('🐱 NGOAOOO... MEOW! 🐱', 0, 0);
      g.restore();
    } else if (t >= 2.8) {
      // Mèo tiếp đất an toàn, ngồi liếm lông ngoan ngoãn
      const catX = doorEndX - 350;
      const catY = groundY + 8;
      drawBlackCat(g, catX, catY, 'sit', t);

      // Bong bóng trái tim từ chú mèo
      const heartA = 0.55 + Math.sin(t * 4) * 0.45;
      g.fillStyle = `rgba(244, 63, 94, ${heartA})`;
      circle(g, catX + 10, catY - 60, 6.5);
      circle(g, catX + 20, catY - 60, 6.5);
      poly(g, [[catX + 4, catY - 58], [catX + 26, catY - 58], [catX + 15, catY - 45]], `rgba(244, 63, 94, ${heartA})`);
    }

    // 6. Hiệu ứng ngã bẹp sàn: Ngôi sao choáng váng và bụi va chạm (1.8 -> 3.2s)
    if (t >= 1.8 && t <= 3.2) {
      const starProg = (t - 1.8) / 1.4;
      const starA = 1 - starProg;
      const starAngle = t * 6;
      [-18, 18].forEach((sx, idx) => {
        const starX = namX - 80 + sx;
        const starY = groundY - 80 + Math.sin(starAngle + idx) * 14;
        circle(g, starX, starY, 6.5, `rgba(254, 240, 138, ${starA})`);
      });
    }

    // 7. Chữ comic Nam cười sảng khoái (4.2 -> 6.0s)
    if (t >= 4.2) {
      const textA = clamp((t - 4.2) / 0.8, 0, 1);
      g.save();
      g.translate(namX - 120, groundY - 150);
      g.fillStyle = `rgba(254, 240, 138, ${textA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${textA})`;
      g.lineWidth = 4.5;
      g.font = 'bold 32px sans-serif';
      g.strokeText('😅 Hóa ra là Mèo... làm hú hồn! 😅', 0, 0);
      g.fillText('😅 Hóa ra là Mèo... làm hú hồn! 😅', 0, 0);
      g.restore();
    }

    g.restore();

    // 8. Tối viền điện ảnh
    drawCinematicVignette(g, 0.35);
  }
});
