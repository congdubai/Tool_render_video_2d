// scenes/shots/02_creak_alert.js — Beat 2: Strange creak sound, roommates alert
import { E, V, registerShot, ease, prog, lerp } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { livingRoomNight, drawCozyBlanket, drawLivingRoomForeground } from '../sets/living_room_night.js';
import { ALEX, BEN } from '../cast.js';

registerShot('s002_creak', {
  draw(g, t) {
    // Camera zooms slightly and pans right toward the source of sound
    const p = ease.out(prog(t, 0.2, 1.8));
    const camZ = lerp(1.05, 1.15, p);
    const camX = lerp(0, -60, p);
    const camY = lerp(-15, -25, p);
    const cam = { z: camZ, x: camX, y: camY };

    // 1. Living room set
    const set = livingRoomNight(g, t, cam);

    // 2. Character animation
    // Alex perks up abruptly at t = 0.4s
    const alertTime = ease.out(prog(t, 0.4, 0.9));
    const alexHeadTilt = lerp(0, 0.12, alertTime);
    const alexLookX = lerp(0.3, 0.85, alertTime);
    const alexExpr = t < 0.4 ? 'neutral' : (t < 1.4 ? 'worried' : 'scared');

    // Ben reacts slightly after at t = 1.0s
    const benAlert = ease.out(prog(t, 1.0, 1.7));
    const benLookX = lerp(0.35, 0.8, benAlert);
    const benExpr = t < 1.0 ? 'neutral' : 'worried';

    // Slight nervous shiver begins at t > 1.8s
    const shiverVal = t > 1.8 ? Math.min(1.0, (t - 1.8) * 0.8) : 0;

    const rimLeft = { color: '#ffcf85', dir: [-0.9, -0.4], w: 5 };
    const rimRight = { color: '#bce0fd', dir: [0.9, -0.4], w: 5 };

    // Draw Alex
    drawFigure(g, {
      x: set.alexX,
      y: set.sofaSeatY - alertTime * 6,
      s: 1.25,
      facing: 1,
      outfit: ALEX,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: alexExpr,
      look: [alexLookX, -0.1],
      rim: rimLeft,
      shiver: shiverVal * 0.4,
      shadow: false
    });

    // Draw Ben
    drawFigure(g, {
      x: set.benX,
      y: set.sofaSeatY - benAlert * 5,
      s: 1.25,
      facing: 1,
      outfit: BEN,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: benExpr,
      look: [benLookX, -0.1],
      rim: rimRight,
      shiver: shiverVal * 0.3,
      shadow: false
    });

    // 3. Blanket pulled up slightly as they tense
    const blanketLift = alertTime * 8;
    drawCozyBlanket(g, set.sofaX, set.sofaSeatY + 30 - blanketLift, 520, 240, t, { shiver: shiverVal * 0.4 });

    // 4. Tight grip on blanket
    drawBlanketHands(g, set.alexX, set.sofaSeatY - alertTime * 6 - 80 - blanketLift, 1.25, true);
    drawBlanketHands(g, set.benX, set.sofaSeatY - benAlert * 5 - 80 - blanketLift, 1.25, benAlert > 0.5);

    // 5. Sound indicator vibration ripple on the right
    if (t > 0.3 && t < 1.5) {
      drawCreakIndicator(g, E.W * 0.86, E.H * 0.55, t - 0.3);
    }

    // 6. Foreground
    drawLivingRoomForeground(g, t);
  }
});

function drawBlanketHands(g, cx, cy, s = 1.25, tense = false) {
  g.save();
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 4 * s;

  const squeeze = tense ? 0.85 : 1.0;
  // Left hand
  g.beginPath();
  g.ellipse(cx - 30 * s, cy + 20 * s, 14 * s, 11 * s * squeeze, 0.1, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Right hand
  g.beginPath();
  g.ellipse(cx + 30 * s, cy + 20 * s, 14 * s, 11 * s * squeeze, -0.1, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

function drawCreakIndicator(g, x, y, age) {
  g.save();
  g.strokeStyle = `rgba(255, 220, 140, ${Math.max(0, 1 - age * 0.9)})`;
  g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const r = 25 + i * 22 + age * 40;
    g.beginPath();
    g.arc(x, y, r, -Math.PI * 0.4, Math.PI * 0.4);
    g.stroke();
  }
  g.restore();
}
