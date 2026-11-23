// scenes/shots/02_entry.js — Cảnh 2: Nam mở cửa bước vào phòng và bật đèn
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure, POSES, solveWalkCycle } from '/engine/rig2d.js';
import { drawEntryHallwayScene, drawCinematicVignette } from '/engine/cinematic-scene.js';
import { NAM } from '../cast.js';

registerShot('s002_entry', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    const isLightOn = t >= 2.5;
    const lightProg = clamp((t - 2.5) / 0.45, 0, 1);

    const cam = { z: 1.08, x: lerp(40, -20, clamp(t / 6.0, 0, 1)), y: 10 };

    // 1. Vẽ bối cảnh căn hộ tối và công tắc
    const { groundY, doorX, switchX, switchY } = drawEntryHallwayScene(g, t, isLightOn, lightProg, cam);

    // 2. Chuyển động của Nam
    const s = 1.35;
    let namX, namPose, namExpr, namLook;

    if (t < 2.5) {
      // Nam bước từ cửa vào phòng tối, tay với tới công tắc trên tường
      const prog = t / 2.5;
      namX = lerp(doorX + 80, switchX - 45, prog);
      const walk = solveWalkCycle(t, { speed: 0.8 });
      // Cánh tay gần (hF) giơ cao với về phía công tắc
      const reachProg = ease.out(clamp(prog * 1.5, 0, 1));
      namPose = {
        ...walk,
        hF: [lerp(walk.hF[0], 28, reachProg), lerp(walk.hF[1], -70, reachProg)],
        eF: [lerp(walk.eF[0], 22, reachProg), lerp(walk.eF[1], -50, reachProg)]
      };
      namExpr = 'scared';
      namLook = [0.9, -0.4];
    } else if (t < 3.2) {
      // Vừa bấm công tắc 'TÁCH', ánh sáng bừng lên, chớp mắt ngạc nhiên
      namX = switchX - 45;
      namPose = {
        ...POSES.stand,
        hF: [26, -72],
        eF: [20, -54]
      };
      namExpr = 'surprised';
      namLook = [0.2, -0.1];
    } else {
      // 3.2 -> 6.0s: An tâm vì đã có đèn, hạ tay xuống, thở phào nhẹ nhõm (Relief)
      namX = switchX - 45;
      const breatheProg = (t - 3.2) / 2.8;
      const chestBob = Math.sin(breatheProg * Math.PI * 2) * 2.5;
      namPose = {
        ...POSES.stand,
        sh: [POSES.stand.sh[0], POSES.stand.sh[1] + chestBob],
        head: [POSES.stand.head[0], POSES.stand.head[1] + chestBob * 0.8],
        eF: [16, -60], hF: [16, -42],
        eB: [-16, -60], hB: [-16, -42]
      };
      namExpr = 'relief';
      namLook = [0, 0];
    }

    // 3. Vẽ nhân vật Nam
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

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
      rimWarm: isLightOn ? '#fef08a' : null,
      rimCool: !isLightOn ? '#93c5fd' : null,
      t
    });

    // 4. Chữ comic hiệu ứng bấm đèn "TÁCH!" tại thời điểm 2.5s
    if (t >= 2.5 && t <= 3.3) {
      const clickA = clamp(Math.sin((t - 2.5) / 0.8 * Math.PI), 0, 1);
      g.save();
      g.translate(switchX, switchY - 40);
      g.fillStyle = `rgba(254, 240, 138, ${clickA})`;
      g.strokeStyle = `rgba(17, 24, 39, ${clickA})`;
      g.lineWidth = 4;
      g.font = 'bold 32px sans-serif';
      g.strokeText('✨ TÁCH! ✨', -60, 0);
      g.fillText('✨ TÁCH! ✨', -60, 0);
      g.restore();
    }

    g.restore();

    // 5. Tối viền điện ảnh
    drawCinematicVignette(g, isLightOn ? 0.22 : 0.45);
  }
});
