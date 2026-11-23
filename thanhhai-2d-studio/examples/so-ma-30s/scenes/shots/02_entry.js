// scenes/shots/02_entry.js — Cảnh 2: Nam bước vào phòng, bật đèn và ngồi xuống sofa
import { E, registerShot, clamp, lerp, ease } from '/engine/core.js';
import { drawFigure, POSES, solveWalkCycle } from '/engine/rig2d.js';
import { drawEntryHallwaySceneV3, drawCozyLivingRoomSceneV3, drawCinematicVignette, SHOT_TYPES } from '/engine/cinematic-scene.js';
import { solveSitDownTransition, solveReliefSigh } from '/engine/action-engine.js';
import { NAM } from '../cast.js';

registerShot('s002_entry', {
  draw(g, t) {
    const W = E.W || 1920;
    const H = E.H || 1080;

    const isLightOn = t >= 2.5;
    const lightProg = clamp((t - 2.5) / 0.45, 0, 1);

    const s = 1.55;
    let namX, namPose, namExpr, namLook, namFacing = 1;

    // Phân cảnh 2 giai đoạn:
    // Giai đoạn 1 (0 -> 3.2s): Vào cửa tối, với tay bật công tắc đèn
    // Giai đoạn 2 (3.2 -> 6.0s): Phòng sáng, Nam thở phào, đi tới ghế sofa và ngồi xuống
    const isLivingRoomPhase = t >= 3.6;

    if (t < 2.5) {
      // Nam bước vào từ cửa, giơ tay với tới công tắc
      const prog = t / 2.5;
      namX = lerp(W * 0.28, W * 0.46, prog);
      const walk = solveWalkCycle(t, { speed: 0.85 });
      const reachProg = ease.out(clamp(prog * 1.5, 0, 1));
      namPose = {
        ...walk,
        hF: [lerp(walk.hF[0], 28, reachProg), lerp(walk.hF[1], -70, reachProg)],
        eF: [lerp(walk.eF[0], 22, reachProg), lerp(walk.eF[1], -50, reachProg)]
      };
      namExpr = 'scared';
      namLook = [0.9, -0.4];
    } else if (t < 3.2) {
      // Bấm công tắc "TÁCH", đèn bừng sáng, ngạc nhiên
      namX = W * 0.46;
      namPose = {
        ...POSES.stand,
        hF: [26, -72],
        eF: [20, -54]
      };
      namExpr = 'surprised';
      namLook = [0.2, -0.1];
    } else if (t < 4.2) {
      // Thở phào nhẹ nhõm, bắt đầu bước về phía sofa
      const walkProg = (t - 3.2) / 1.0;
      namX = lerp(W * 0.46, W * 0.54, walkProg);
      namPose = solveWalkCycle(t * 1.2, { speed: 1.0 });
      namExpr = 'relief';
      namLook = [0.6, 0];
    } else {
      // 4.2 -> 6.0s: Đi đến sofa và ngồi xuống êm ái
      const sitProg = clamp((t - 4.2) / 1.2, 0, 1);
      namX = lerp(W * 0.54, W * 0.58, Math.min(sitProg * 1.5, 1));
      namPose = solveSitDownTransition(sitProg);
      namExpr = 'happy';
      namLook = [0.2, 0.1];
    }

    // Camera Framing (Medium Shot z = 1.55, nâng trục Y để nhân vật ở trung tâm)
    const targetCamX = -(namX - W * 0.5);
    const cam = {
      z: SHOT_TYPES.MEDIUM.z,
      x: targetCamX,
      y: -60
    };

    // 1. Vẽ bối cảnh chuyển tiếp mượt mà từ cửa vào sang phòng khách
    let groundY, switchX, switchY;
    if (!isLivingRoomPhase) {
      const entryScene = drawEntryHallwaySceneV3(g, t, isLightOn, lightProg, cam);
      groundY = entryScene.groundY;
      switchX = entryScene.switchX;
      switchY = entryScene.switchY;
    } else {
      const roomScene = drawCozyLivingRoomSceneV3(g, t, cam);
      groundY = roomScene.groundY;
    }

    // 2. Vẽ nhân vật Nam
    g.save();
    g.translate(W / 2, H / 2);
    g.scale(cam.z, cam.z);
    g.translate(-W / 2 + cam.x, -H / 2 + cam.y);

    // Bóng đổ tiếp xúc chân
    g.fillStyle = 'rgba(0, 0, 0, 0.35)';
    g.beginPath();
    g.ellipse(namX, groundY + 4, 34 * s, 9 * s, 0, 0, Math.PI * 2);
    g.fill();

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
      rimWarm: isLightOn ? '#fef08a' : null,
      rimCool: !isLightOn ? '#93c5fd' : null,
      t
    });

    // 3. Hiệu ứng comic khi bấm đèn "TÁCH!" tại 2.5s
    if (t >= 2.5 && t <= 3.3 && switchX) {
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

    // 4. Tối viền điện ảnh
    drawCinematicVignette(g, isLightOn ? 0.22 : 0.45);
  }
});
