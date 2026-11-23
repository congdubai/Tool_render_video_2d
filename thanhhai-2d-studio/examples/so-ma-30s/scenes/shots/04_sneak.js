// scenes/shots/04_sneak.js — Cảnh 4: Nam cầm chổi, rón rén tiến đến cửa
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { drawTenseHallwayScene, drawCinematicVignette } from '/engine/cinematic-scene.js';
import { solveSneakWalkCycle, drawBroom } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s004_sneak', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    // Camera trượt chậm theo góc nhìn hồi hộp
    const camX = lerp(-40, 40, clamp(t / 6.0, 0, 1));
    const cam = { z: 1.14, x: camX, y: 15 };

    // 1. Vẽ bối cảnh hành lang căng thẳng
    const { groundY, doorEndX } = drawTenseHallwayScene(g, t, cam);

    // 2. Chuyển động rón rén và cầm chổi của Nam
    const s = 1.35;
    const prog = clamp(t / 6.0, 0, 1);
    const namX = lerp(W * 0.26, doorEndX - 120, prog);

    const sneakPose = solveSneakWalkCycle(t, { speed: 0.65 });

    // Hướng nhìn quét qua quét lại đầy nghi ngờ
    const scanLookX = 0.8 + Math.sin(t * 3.5) * 0.3;
    const scanLookY = Math.cos(t * 4.0) * 0.2;

    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    // 3. Bóng đổ bám sàn của Nam
    g.fillStyle = 'rgba(0, 0, 0, 0.45)';
    g.beginPath();
    g.ellipse(namX, groundY + 4, 34 * s, 8 * s, 0, 0, Math.PI * 2);
    g.fill();

    // 4. Vẽ Nam ở tư thế rón rén
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

    // 5. Vẽ cây chổi quét nhà trên tay Nam (Chĩa về phía cánh cửa tối om)
    // Tay cầm chổi nằm tại vị trí bàn tay của Nam
    const broomAngle = 0.65 + Math.sin(t * 4) * 0.05;
    const broomX = namX + sneakPose.hF[0] * s;
    const broomY = groundY + sneakPose.hF[1] * s;
    drawBroom(g, broomX, broomY, broomAngle, 115);

    // 6. Chữ comic thì thầm hồi hộp "RÓN RÉN... RÓN RÉN..."
    const textA = 0.6 + Math.sin(t * 3) * 0.3;
    g.save();
    g.translate(namX - 40, groundY - 210);
    g.fillStyle = `rgba(147, 197, 253, ${textA})`;
    g.strokeStyle = `rgba(15, 23, 42, ${textA})`;
    g.lineWidth = 3;
    g.font = 'italic bold 28px sans-serif';
    g.strokeText('👣 Rón rén... rón rén...', 0, 0);
    g.fillText('👣 Rón rén... rón rén...', 0, 0);
    g.restore();

    g.restore();

    // 7. Tối viền điện ảnh căng thẳng
    drawCinematicVignette(g, 0.48);
  }
});
