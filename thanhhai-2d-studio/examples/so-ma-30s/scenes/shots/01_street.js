// scenes/shots/01_street.js — Cảnh 1: Nam đi bộ trên đường đêm (Tracking Medium Shot)
import { E, registerShot, clamp, lerp, ease, circle, rr } from '/engine/core.js';
import { drawFigure, POSES, solveWalkCycle } from '/engine/rig2d.js';
import { drawStreetNightBackgroundV3, drawCinematicVignette, SHOT_TYPES } from '/engine/cinematic-scene.js';
import { NAM } from '../cast.js';

registerShot('s001_street', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // CAMERA DIRECTOR: Medium Tracking Shot (z = 1.55) bám theo Nam
    // Nam chiếm 42-45% chiều cao khung hình, không còn bị nhỏ xíu lọt thỏm
    const s = 1.55;
    let namX, namPose, namExpr, namFacing, namLook;

    if (t < 2.5) {
      // Giai đoạn 1 (0 -> 2.5s): Nam thong thả đi bộ về nhà
      const prog = t / 2.5;
      namX = lerp(W * 0.28, W * 0.46, prog);
      namPose = solveWalkCycle(t, { speed: 1.0 });
      namExpr = 'neutral';
      namFacing = 1;
      namLook = [0.8, -0.1];
    } else if (t < 3.2) {
      // Giai đoạn 2 (2.5 -> 3.2s): Nghe tiếng động lạ sau lưng -> Dừng lại, giật mình
      namX = W * 0.46;
      namPose = POSES.stand;
      namExpr = 'surprised';
      namFacing = 1;
      // Quay phắt đầu nhìn lại phía sau vào bóng tối
      namLook = [-1.0, -0.1];
    } else if (t < 4.8) {
      // Giai đoạn 3 (3.2 -> 4.8s): Đứng run rẩy quan sát bóng tối phía sau
      namX = W * 0.46;
      const shiver = Math.sin(t * 36) * 1.5;
      namPose = {
        ...POSES.stand,
        head: [POSES.stand.head[0] + shiver, POSES.stand.head[1]],
        eF: [18, -68], hF: [16, -52],
        eB: [-18, -68], hB: [-16, -52]
      };
      namExpr = 'scared';
      namFacing = 1;
      namLook = [-0.9 + Math.sin(t * 5) * 0.2, 0];
    } else {
      // Giai đoạn 4 (4.8 -> 6.0s): Sợ quá rảo bước nhanh về nhà!
      const prog = (t - 4.8) / 1.2;
      namX = lerp(W * 0.46, W * 0.74, prog);
      namPose = solveWalkCycle(t * 1.5, { speed: 1.4 });
      namExpr = 'worried';
      namFacing = 1;
      namLook = [1.0, 0];
    }

    // Camera Tracking: Tâm ngắm theo bước chân của Nam, nâng độ cao để nhân vật ở vị trí vàng
    const targetCamX = -(namX - W * 0.5) + (namFacing * 60);
    const cam = {
      z: SHOT_TYPES.MEDIUM.z,
      x: targetCamX,
      y: -50
    };

    // 1. Vẽ bối cảnh đường phố đêm 5 lớp điện ảnh (V3)
    const { groundY, lampX } = drawStreetNightBackgroundV3(g, t, cam);

    // 2. Vẽ bóng đổ tiếp xúc và nhân vật Nam
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    // Bóng đổ động trên mặt đường (Dài ra khi xa cột đèn)
    const distFromLamp = (namX - lampX);
    const shadowStretch = distFromLamp * 0.55;
    g.fillStyle = 'rgba(0, 0, 0, 0.38)';
    g.beginPath();
    g.ellipse(namX + shadowStretch, groundY + 4, 38 * s + Math.abs(shadowStretch) * 0.25, 10 * s, 0, 0, Math.PI * 2);
    g.fill();

    // Vẽ nhân vật Nam White Cartoon
    drawFigure(g, {
      x: namX,
      y: groundY,
      s,
      facing: namFacing,
      outfit: NAM,
      pose: namPose,
      expr: namExpr,
      look: namLook,
      shadow: false,
      rimWarm: '#fde047',
      rimCool: '#93c5fd',
      t
    });

    // 3. Hiệu ứng chữ comic khi có tiếng động lạ sau lưng (2.5 -> 3.6s)
    if (t >= 2.5 && t <= 3.6) {
      const textA = clamp(Math.sin((t - 2.5) / 1.1 * Math.PI), 0, 1);
      g.save();
      g.translate(namX - 160, groundY - 240);
      g.rotate(-0.1);
      g.fillStyle = `rgba(254, 240, 138, ${textA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${textA})`;
      g.lineWidth = 4.5;
      g.font = 'bold 36px sans-serif';
      g.strokeText('🎵 XẠO XOẠC...?!', 0, 0);
      g.fillText('🎵 XẠO XOẠC...?!', 0, 0);
      g.restore();
    }

    g.restore();

    // 4. Lớp tối viền điện ảnh
    drawCinematicVignette(g, 0.38);
  }
});
