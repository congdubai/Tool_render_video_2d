// scenes/shots/01_street.js — Cảnh 1: Nam đi bộ về nhà ban đêm và ngoái đầu nhìn phía sau
import { E, registerShot, clamp, lerp, ease, circle, rr } from '/engine/core.js';
import { drawFigure, POSES, solveWalkCycle } from '/engine/rig2d.js';
import { drawStreetNightBackground, drawCinematicVignette } from '/engine/cinematic-scene.js';
import { NAM } from '../cast.js';

registerShot('s001_street', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // Camera pan nhẹ theo bước chân
    const camX = lerp(-60, 60, clamp(t / 6.0, 0, 1));
    const cam = { z: 1.05, x: camX, y: 0 };

    // 1. Vẽ bối cảnh đường phố đêm điện ảnh
    const { groundY, lampX } = drawStreetNightBackground(g, t, cam);

    // 2. Tính toán vị trí và chuyển động của Nam
    let namX, namPose, namExpr, namFacing, namLook;
    const s = 1.35;

    if (t < 2.5) {
      // Giai đoạn 1 (0 -> 2.5s): Nam thong thả đi bộ về nhà
      const prog = t / 2.5;
      namX = lerp(W * 0.22, W * 0.44, prog);
      namPose = solveWalkCycle(t, { speed: 1.0 });
      namExpr = 'neutral';
      namFacing = 1;
      namLook = [0.8, -0.1];
    } else if (t < 3.2) {
      // Giai đoạn 2 (2.5 -> 3.2s): Bất ngờ nghe tiếng động lạ sau lưng -> Dừng lại, giật mình
      namX = W * 0.44;
      namPose = POSES.stand;
      namExpr = 'surprised';
      namFacing = 1;
      // Đầu và mắt ngoái mạnh về phía sau (Look back 180 độ)
      namLook = [-1.0, -0.1];
    } else if (t < 4.8) {
      // Giai đoạn 3 (3.2 -> 4.8s): Đứng run rẩy quan sát bóng tối phía sau
      namX = W * 0.44;
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
      // Giai đoạn 4 (4.8 -> 6.0s): Sợ quá rảo bước thật nhanh về nhà!
      const prog = (t - 4.8) / 1.2;
      namX = lerp(W * 0.44, W * 0.72, prog);
      namPose = solveWalkCycle(t * 1.5, { speed: 1.4 });
      namExpr = 'worried';
      namFacing = 1;
      namLook = [1.0, 0];
    }

    // 3. Bóng đổ động trên mặt đường (Dài ra khi xa cột đèn)
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    const distFromLamp = (namX - lampX);
    const shadowStretch = distFromLamp * 0.55;
    g.fillStyle = 'rgba(0, 0, 0, 0.32)';
    g.beginPath();
    g.ellipse(namX + shadowStretch, groundY + 4, 38 * s + Math.abs(shadowStretch) * 0.3, 9 * s, 0, 0, Math.PI * 2);
    g.fill();

    // 4. Vẽ nhân vật Nam White Cartoon
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

    // 5. Hiệu ứng âm thanh chữ comic khi có tiếng xạc xào (2.5 -> 3.5s)
    if (t >= 2.5 && t <= 3.6) {
      const textA = clamp(Math.sin((t - 2.5) / 1.1 * Math.PI), 0, 1);
      g.save();
      g.translate(W * 0.28, groundY - 180);
      g.rotate(-0.1);
      g.fillStyle = `rgba(254, 240, 138, ${textA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${textA})`;
      g.lineWidth = 4;
      g.font = 'bold 36px sans-serif';
      g.strokeText('🎵 XẠO XOẠC...?!', 0, 0);
      g.fillText('🎵 XẠO XOẠC...?!', 0, 0);
      g.restore();
    }

    g.restore();

    // 6. Tối viền điện ảnh (Vignette)
    drawCinematicVignette(g, 0.38);
  }
});
