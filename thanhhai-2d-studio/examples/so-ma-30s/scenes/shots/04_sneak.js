// scenes/shots/04_sneak.js — Cảnh 4: Nam cầm chổi rón rén kiểm tra hành lang (Tracking Medium Shot)
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { drawTenseHallwaySceneV3, drawCinematicVignette, SHOT_TYPES } from '/engine/cinematic-scene.js';
import { solveSneakWalkCycle, drawBroom } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s004_sneak', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // CAMERA DIRECTOR: Tracking Medium Shot (z = 1.6) bám sát hành động rón rén
    // Nhân vật và cây chổi chiếm trọn sự chú ý, không bị lọt thỏm
    const s = 1.55;
    const prog = clamp(t / 6.0, 0, 1);

    // Đi từ đầu hành lang đến gần cánh cửa hé mở
    const namStartX = W * 0.32;
    const namEndX = W * 0.62;
    const namX = lerp(namStartX, namEndX, prog);

    const sneakPose = solveSneakWalkCycle(t, { speed: 0.65 });

    // Hướng nhìn quét qua quét lại cảnh giác cao độ
    const scanLookX = 0.85 + Math.sin(t * 3.5) * 0.25;
    const scanLookY = Math.cos(t * 4.0) * 0.2;

    // Camera Tracking: Tâm ngắm theo bước chân của Nam, nhường khoảng trống (lead-room) phía cánh cửa
    const targetCamX = -(namX - W * 0.46);
    const cam = {
      z: SHOT_TYPES.MEDIUM.z,
      x: targetCamX,
      y: -90
    };

    // 1. Vẽ bối cảnh hành lang căng thẳng 5 lớp điện ảnh (V3)
    const { groundY, doorEndX } = drawTenseHallwaySceneV3(g, t, cam);

    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    // 2. Bóng đổ bám sàn của Nam
    g.fillStyle = 'rgba(0, 0, 0, 0.48)';
    g.beginPath();
    g.ellipse(namX, groundY + 4, 34 * s, 9 * s, 0, 0, Math.PI * 2);
    g.fill();

    // 3. Vẽ Nam ở tư thế rón rén
    drawFigure(g, {
      x: namX,
      y: groundY,
      s,
      facing: 1,
      outfit: NAM,
      pose: sneakPose,
      expr: 'scared',
      look: [scanLookX, scanLookY],
      shadow: false,
      rimCool: '#93c5fd',
      rimWarm: '#fef08a',
      t
    });

    // 4. Vẽ cây chổi quét nhà trên tay Nam (Chĩa về phía cánh cửa tối om)
    const broomAngle = 0.65 + Math.sin(t * 4) * 0.05;
    const broomX = namX + sneakPose.hF[0] * s;
    const broomY = groundY + sneakPose.hF[1] * s;
    drawBroom(g, broomX, broomY, broomAngle, 120);

    // 5. Chữ comic thì thầm hồi hộp "RÓN RÉN... RÓN RÉN..."
    const textA = 0.6 + Math.sin(t * 3.2) * 0.35;
    g.save();
    g.translate(namX - 50, groundY - 240);
    g.fillStyle = `rgba(147, 197, 253, ${textA})`;
    g.strokeStyle = `rgba(15, 23, 42, ${textA})`;
    g.lineWidth = 3.5;
    g.font = 'italic bold 30px sans-serif';
    g.strokeText('👣 Rón rén... rón rén...', 0, 0);
    g.fillText('👣 Rón rén... rón rén...', 0, 0);
    g.restore();

    g.restore();

    // 6. Tối viền điện ảnh căng thẳng
    drawCinematicVignette(g, 0.48);
  }
});
