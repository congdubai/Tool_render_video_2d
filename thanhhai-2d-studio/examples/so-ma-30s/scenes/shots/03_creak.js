// scenes/shots/03_creak.js — Cảnh 3: Tiếng động lạ & Camera Close-Up cận cảnh Nam hoảng sợ
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure, POSES, drawSpookyGhostThoughtBubble } from '/engine/rig2d.js';
import { drawCozyLivingRoomSceneV3, drawCozyBlanket, drawCinematicVignette, SHOT_TYPES } from '/engine/cinematic-scene.js';
import { solveScaredReactionAction } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s003_creak', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // KỊCH BẢN MÁY QUAY ĐIỆN ẢNH (Camera Director):
    // 0 -> 2.5s: Medium Shot (z = 1.55) Nam ngồi thư giãn trên sofa trùm chăn ấm.
    // 2.5s: Tiếng động lạ rùng rợn "KÉTTTT...!" -> Rung camera.
    // 2.5 -> 6.0s: CAMERA CUT / ZOOM SANG CLOSE-UP (z = 2.65) cận cảnh đặc tả khuôn mặt Nam
    // Nam chiếm 70% chiều cao khung hình, nhìn rõ mắt trợn tròn, mồ hôi bay, răng run rẩy!
    const isCloseUp = t >= 2.5;

    let camShakeX = 0, camShakeY = 0;
    if (t >= 2.5 && t <= 3.5) {
      const shakeAmp = (1 - (t - 2.5) / 1.0) * 14;
      camShakeX = Math.sin(t * 52) * shakeAmp;
      camShakeY = Math.cos(t * 46) * shakeAmp;
    }

    const namBaseX = W * 0.52;
    const groundY = H * 0.80;
    const namBaseY = groundY - 60; // Ngồi trên đệm sofa
    const s = 1.55;

    // Tính toán góc máy và tâm ngắm
    let cam;
    if (!isCloseUp) {
      cam = {
        z: SHOT_TYPES.MEDIUM.z,
        x: -(namBaseX - W * 0.5) + camShakeX,
        y: -40 + camShakeY
      };
    } else {
      // Close-up: Tâm ngắm vào khuôn mặt của Nam (Y ~ 570)
      const faceY = namBaseY - 145 * s;
      cam = {
        z: 2.65,
        x: -(namBaseX - W * 0.5) + camShakeX,
        y: -(faceY - H * 0.55) + camShakeY
      };
    }

    // 1. Vẽ bối cảnh phòng khách điện ảnh V3
    drawCozyLivingRoomSceneV3(g, t, cam);

    // 2. Chuyển động và biểu cảm của Nam
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
      const shiverAmp = Math.sin(t * 42) * 2.4;
      namPose = {
        ...POSES.sit,
        head: [shiverAmp, -148 + Math.cos(t * 48) * 1.6],
        // Hai tay ôm chặt lấy mép chăn trước ngực
        eF: [14, -92], hF: [16, -112],
        eB: [-12, -92], hB: [-6, -112]
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
    const blanketW = 340;
    const blanketH = 180;
    const blanketY = namBaseY - 25;
    drawCozyBlanket(g, namBaseX + 5, blanketY, blanketW, blanketH, t, isShivering);

    // 5. Hiệu ứng âm thanh rùng rợn "KÉTTTT...!!!" (2.5 -> 3.8s)
    if (t >= 2.5 && t <= 3.8) {
      const soundA = clamp(Math.sin((t - 2.5) / 1.3 * Math.PI), 0, 1);
      g.save();
      g.translate(namBaseX - 220, namBaseY - 260);
      g.rotate(-0.08);
      g.fillStyle = `rgba(239, 68, 68, ${soundA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${soundA})`;
      g.lineWidth = 5;
      g.font = 'bold 42px sans-serif';
      g.strokeText('⚡ KÉTTTTT...!!! ⚡', 0, 0);
      g.fillText('⚡ KÉTTTTT...!!! ⚡', 0, 0);
      g.restore();
    }

    // 6. Bong bóng suy nghĩ hiện hình con ma (Spooky Ghost Bubble) từ 3.6 -> 6.0s
    if (t >= 3.6) {
      const ghostProg = clamp((t - 3.6) / 0.6, 0, 1);
      const ghostScale = ease.out(ghostProg) * 1.15;
      drawSpookyGhostThoughtBubble(g, namBaseX + 170, namBaseY - 340, t, ghostScale, {
        alpha: ghostProg
      });
    }

    g.restore();

    // 7. Lớp tối viền điện ảnh căng thẳng
    drawCinematicVignette(g, isCloseUp ? 0.42 : 0.32);
  }
});
