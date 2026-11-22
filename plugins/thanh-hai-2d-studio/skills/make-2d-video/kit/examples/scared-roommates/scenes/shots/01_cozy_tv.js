// scenes/shots/01_cozy_tv.js — Beat 1: Cozy atmosphere, watching movie under blanket
import { E, V, registerShot, ease, prog, lerp, circle } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { livingRoomNight, drawCozyBlanket, drawLivingRoomForeground } from '../sets/living_room_night.js';
import { ALEX, BEN } from '../cast.js';

registerShot('s001_cozy', {
  draw(g, t) {
    // Cinematic slow push-in
    const camZ = lerp(1.0, 1.05, ease.inOut(prog(t, 0, 4.0)));
    const camY = lerp(0, -15, ease.inOut(prog(t, 0, 4.0)));
    const cam = { z: camZ, x: 0, y: camY };

    // 1. Living room background, lamp, sofa, window
    const set = livingRoomNight(g, t, cam);

    // 2. Roommates on sofa
    const breathA = Math.sin(t * 2.5) * 2;
    const breathB = Math.cos(t * 2.2) * 2;

    // Dual lighting setup
    const rimLeft = { color: '#ffcf85', dir: [-0.9, -0.4], w: 5 };
    const rimRight = { color: '#bce0fd', dir: [0.9, -0.4], w: 5 };

    // Alex (Left) — relaxed watching TV
    drawFigure(g, {
      x: set.alexX,
      y: set.sofaSeatY + breathA,
      s: 1.25,
      facing: 1,
      outfit: ALEX,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: 'neutral',
      look: [0.3 + 0.1 * Math.sin(t * 1.5), 0.1],
      rim: rimLeft,
      shiver: 0,
      shadow: false
    });

    // Ben (Right) — cozy watching TV
    drawFigure(g, {
      x: set.benX,
      y: set.sofaSeatY + breathB,
      s: 1.25,
      facing: 1,
      outfit: BEN,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: 'neutral',
      look: [0.35 + 0.1 * Math.sin(t * 1.8), 0.1],
      rim: rimRight,
      shiver: 0,
      shadow: false
    });

    // 3. Cozy checkered blanket covering their laps up to chest
    drawCozyBlanket(g, set.sofaX, set.sofaSeatY + 30 + (breathA + breathB) * 0.5, 520, 240, t, { shiver: 0 });

    // 4. Roommates' hands resting on top of the blanket fold
    // Alex's cartoon hands holding blanket
    drawBlanketHands(g, set.alexX, set.sofaSeatY + breathA - 5, 1.25);
    // Ben's cartoon hands holding blanket
    drawBlanketHands(g, set.benX, set.sofaSeatY + breathB - 5, 1.25);

    // 5. Foreground coffee table, popcorn, mugs, remote, TV edge
    drawLivingRoomForeground(g, t);
  }
});

// Helper for hands holding blanket
function drawBlanketHands(g, cx, cy, s = 1.25) {
  g.save();
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 4 * s;

  // Left hand clutching blanket edge
  g.beginPath();
  g.ellipse(cx - 30 * s, cy + 20 * s, 14 * s, 11 * s, 0.1, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Right hand clutching blanket edge
  g.beginPath();
  g.ellipse(cx + 30 * s, cy + 20 * s, 14 * s, 11 * s, -0.1, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}
