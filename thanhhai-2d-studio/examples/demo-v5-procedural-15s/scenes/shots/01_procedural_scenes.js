
import { registerShot } from '/engine/core.js';
import {
  drawUnifiedCharacter,
  registerCharacterProfile
} from '/engine/unified-character-renderer.js';
import { cast } from '../cast.js';

// Register Tab 3's exact Doc profile into Unified Character Renderer (zero silent fallback)
registerCharacterProfile(cast.chibi_doc);

function drawProceduralScene(ctx, t, sceneId) {
  ctx.save();
  // Scale 1280x720 logical design space cleanly to 1920x1080 canvas space
  ctx.scale(1.5, 1.5);

  // 1. Procedural Background (Modern Lab)
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.65, '#1e293b');
  grad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  // Lab Back Wall Tech Grid
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1;
  for (let x = 60; x < 1280; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();
  }
  for (let y = 60; y < 560; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  // Lab Server Racks
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(60, 140, 200, 380);
  ctx.strokeRect(60, 140, 200, 380);
  ctx.fillRect(1020, 140, 200, 380);
  ctx.strokeRect(1020, 140, 200, 380);

  // Rack Indicator LEDs
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (Math.sin(t * 4 + i) > 0) ? '#22c55e' : '#15803d';
    ctx.beginPath(); ctx.arc(90, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.cos(t * 5 + i) > 0) ? '#38bdf8' : '#0369a1';
    ctx.beginPath(); ctx.arc(1050, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Lab Floor Ground Surface (y = 560)
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(1280, 560); ctx.stroke();

  // Lab Desk in Center-Right
  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.fillRect(680, 430, 360, 130);
  ctx.strokeRect(680, 430, 360, 130);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(660, 420, 400, 16);

  // 2. Scene-Specific Procedural Props
  if (sceneId === 's002' || sceneId === 's003') {
    ctx.save();
    ctx.translate(720, 240);
    // Vintage Mainframe Computer Body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.fillRect(0, 0, 260, 180);
    ctx.strokeRect(0, 0, 260, 180);

    // Green Phosphor Screen (clean retro wave graphic, no debug text)
    ctx.fillStyle = '#052e16';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fillRect(20, 20, 120, 80);
    ctx.strokeRect(20, 20, 120, 80);
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let px = 0; px <= 104; px += 4) {
      const py = 60 + Math.sin(px * 0.12 + t * 6) * 14;
      if (px === 0) ctx.moveTo(28 + px, py);
      else ctx.lineTo(28 + px, py);
    }
    ctx.stroke();

    // Glowing vacuum tubes
    for (let tube = 0; tube < 4; tube++) {
      const glowAlpha = 0.5 + 0.5 * Math.sin(t * 12 + tube);
      ctx.fillStyle = 'rgba(251, 146, 60, ' + glowAlpha + ')';
      ctx.beginPath();
      ctx.arc(170 + tube * 20, 45, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smoke emitted from top in Scene 2
    if (sceneId === 's002') {
      for (let smoke = 0; smoke < 4; smoke++) {
        const smokeOffset = (t * 42 + smoke * 22) % 90;
        const smokeAlpha = Math.max(0, 1 - smokeOffset / 90);
        ctx.fillStyle = 'rgba(203, 213, 225, ' + (smokeAlpha * 0.48) + ')';
        ctx.beginPath();
        ctx.arc(85 + smoke * 26 + Math.sin(t * 3 + smoke) * 8, -smokeOffset, 16 + smoke * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 3. Unified Character Renderer — Doc (chibi_doc) from Tab 3 Character Library
  let docX = 510;
  let docPose = 'stand';
  let docExpr = 'neutral';
  let docLook = [0, 0];
  const blinkCycle = t % 3.4;
  const isBlinking = blinkCycle > 3.22 && blinkCycle < 3.36;

  if (sceneId === 's001') {
    // Scene 1: Doc walks smoothly into the modern lab
    docX = 210 + (t / 5) * 300;
    docPose = 'walk';
    docExpr = 'happy';
    docLook = [0.4, 0];
  } else if (sceneId === 's002') {
    // Scene 2: Doc inspects smoking vintage computer
    docX = 510;
    docPose = 'inspect';
    docExpr = t < 2.2 ? 'thinking' : 'confused';
    docLook = [0.65, -0.15];
  } else {
    // Scene 3: Doc gets an eureka idea
    docX = 510;
    docPose = 'eureka';
    docExpr = t < 1.1 ? 'surprised' : 'excited';
    docLook = [0.2, -0.45];
  }

  drawUnifiedCharacter(ctx, {
    characterId: 'chibi_doc',
    x: docX,
    y: 560,
    s: 1.55,
    view: 'three_quarter_right',
    pose: docPose,
    expr: docExpr,
    look: docLook,
    blink: isBlinking,
    t,
    shadow: true,
    debug: false,
    strict: true
  });

  // 4. Procedural Idea Lightbulb above Doc's head in Scene 3
  if (sceneId === 's003') {
    const bulbPop = Math.min(1, t / 0.45);
    const bulbScale = 0.6 + 0.4 * bulbPop + Math.sin(t * 7) * 0.04;
    ctx.save();
    ctx.translate(docX + 6, 225);
    ctx.scale(bulbScale, bulbScale);

    // Soft radiant glow
    const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 68);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.55)');
    glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.fill();

    // Yellow Glass Bulb
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#ca8a04';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Filament
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-7, 10); ctx.lineTo(-3, -4); ctx.lineTo(3, 2); ctx.lineTo(7, -8); ctx.stroke();

    // Screw Base
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillRect(-10, 27, 20, 14);
    ctx.strokeRect(-10, 27, 20, 14);

    // Glowing Rays around bulb
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    for (let r = 0; r < 8; r++) {
      const angle = (r * Math.PI) / 4 + t * 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 38, Math.sin(angle) * 38);
      ctx.lineTo(Math.cos(angle) * 52, Math.sin(angle) * 52);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

registerShot('s001', { draw(ctx, t) { drawProceduralScene(ctx, t, 's001'); } });
registerShot('scene_001', { draw(ctx, t) { drawProceduralScene(ctx, t, 's001'); } });
registerShot('s002', { draw(ctx, t) { drawProceduralScene(ctx, t, 's002'); } });
registerShot('scene_002', { draw(ctx, t) { drawProceduralScene(ctx, t, 's002'); } });
registerShot('s003', { draw(ctx, t) { drawProceduralScene(ctx, t, 's003'); } });
registerShot('scene_003', { draw(ctx, t) { drawProceduralScene(ctx, t, 's003'); } });
