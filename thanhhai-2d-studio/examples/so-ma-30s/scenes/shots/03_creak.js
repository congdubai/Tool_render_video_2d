// scenes/shots/03_creak.js — Cảnh 3: Nam nghe tiếng động, giật mình quay đầu
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure, POSES, drawSpookyGhostThoughtBubble } from '/engine/rig2d.js';
import { drawCozyLivingRoomScene, drawCozyBlanket, drawCinematicVignette } from '/engine/cinematic-scene.js';
import { solveScaredReactionAction } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s003_creak', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // Rung lắc nhẹ camera khi có tiếng kêu rùng rợn (2.5 -> 3.2s)
    let camShakeX = 0, camShakeY = 0;
    if (t >= 2.5 && t <= 3.2) {
      const shakeAmp = (1 - (t - 2.5) / 0.7) * 8;
      camShakeX = Math.sin(t * 50) * shakeAmp;
      camShakeY = Math.cos(t * 45) * shakeAmp;
    }

    const cam = { z: 1.12, x: camShakeX, y: camShakeY + 20 };

    // 1. Vẽ bối cảnh phòng khách ban đêm ấm áp
    const { groundY, sofaX, sofaY, sofaW } = drawCozyLivingRoomScene(g, t, cam);

    // 2. Chuyển động và biểu cảm của Nam
    const s = 1.35;
    const namBaseX = sofaX + sofaW * 0.45;
    const namBaseY = groundY - 60; // Ngồi trên đệm sofa

    let namPose, namExpr, namLook, isShivering;

    if (t < 2.5) {
      // 0 -> 2.5s: Nam ngồi thư thái trên sofa trùm chăn
      namPose = {
        ...POSES.sit,
        head: [0, -145],
        eF: [16, -90], hF: [18, -78],
        eB: [-14, -90], hB: [-10, -78]
      };
      namExpr = 'happy';
      namLook = [0.4, 0];
      isShivering = false;
    } else if (t < 3.6) {
      // 2.5 -> 3.6s: Tiếng KÉT vang lên -> Giật bắn người, ngoái phắt đầu ra sau
      const shockProg = (t - 2.5) / 1.1;
      namPose = solveScaredReactionAction(t, shockProg);
      namExpr = 'terrified';
      namLook = [-1.0, -0.2]; // Nhìn trừng trừng về phía hành lang tối
      isShivering = true;
    } else {
      // 3.6 -> 6.0s: Kéo chăn lên tận mũi, cả người run bần bật vì sợ ma
      const shiverAmp = Math.sin(t * 42) * 2.2;
      namPose = {
        ...POSES.sit,
        head: [shiverAmp, -148 + Math.cos(t * 48) * 1.5],
        // Hai tay ôm chặt lấy mép chăn trước ngực
        eF: [14, -92], hF: [16, -110],
        eB: [-12, -92], hB: [-6, -110]
      };
      namExpr = 'scared';
      namLook = [-0.85 + Math.sin(t * 6) * 0.15, -0.1];
      isShivering = true;
    }

    // 3. Vẽ Nam trên sofa
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    drawFigure(g, {
      x: namBaseX,
      y: namBaseY,
      s,
      facing: 1,
      outfit: NAM,
      pose: namPose,
      expr: namExpr,
      look: namLook,
      shadow: false,
      rimWarm: '#fef08a',
      rimCool: '#93c5fd',
      t
    });

    // 4. Vẽ chăn trùm caro phủ lên người Nam
    const blanketW = 320;
    const blanketH = 170;
    const blanketY = namBaseY - 25;
    drawCozyBlanket(g, namBaseX + 5, blanketY, blanketW, blanketH, t, isShivering);

    // 5. Hiệu ứng âm thanh rùng rợn "KÉTTTT...!!!" (2.5 -> 3.8s)
    if (t >= 2.5 && t <= 3.8) {
      const soundA = clamp(Math.sin((t - 2.5) / 1.3 * Math.PI), 0, 1);
      g.save();
      g.translate(W * 0.15, groundY - 340);
      g.rotate(0.12);
      g.fillStyle = `rgba(239, 68, 68, ${soundA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${soundA})`;
      g.lineWidth = 5;
      g.font = 'bold 44px sans-serif';
      g.strokeText('⚡ KÉTTTTT...!!! ⚡', 0, 0);
      g.fillText('⚡ KÉTTTTT...!!! ⚡', 0, 0);
      g.restore();
    }

    // 6. Bong bóng suy nghĩ hiện hình con ma (Spooky Ghost Bubble) từ 3.6 -> 6.0s
    if (t >= 3.6) {
      const ghostProg = clamp((t - 3.6) / 0.6, 0, 1);
      const ghostScale = ease.out(ghostProg) * 1.05;
      drawSpookyGhostThoughtBubble(g, namBaseX + 160, namBaseY - 330, t, ghostScale, {
        alpha: ghostProg
      });
    }

    g.restore();

    // 7. Tối viền điện ảnh
    drawCinematicVignette(g, 0.35);
  }
});
