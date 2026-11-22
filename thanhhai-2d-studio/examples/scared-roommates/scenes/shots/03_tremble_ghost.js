// scenes/shots/03_tremble_ghost.js — Beat 3: Ghost thought bubble & intense shivering
import { E, V, registerShot, ease, prog, lerp, circle, poly } from '/engine/core.js';
import { drawFigure, drawSpookyGhostThoughtBubble } from '/engine/rig2d.js';
import { livingRoomNight, drawCozyBlanket, drawLivingRoomForeground } from '../sets/living_room_night.js';
import { ALEX, BEN } from '../cast.js';

registerShot('s003_ghost', {
  draw(g, t) {
    // Camera framing matched precisely to reference image
    const camZ = lerp(1.15, 1.22, ease.inOut(prog(t, 0, 3.0)));
    const camY = lerp(-30, -45, ease.inOut(prog(t, 0, 3.0)));
    const cam = { z: camZ, x: -30, y: camY };

    // 1. Living room background
    const set = livingRoomNight(g, t, cam);

    // 2. Roommates intense trembling animation
    const shiverVal = 1.0;
    const rimLeft = { color: '#ffcf85', dir: [-0.9, -0.4], w: 5.5 };
    const rimRight = { color: '#bce0fd', dir: [0.9, -0.4], w: 5.5 };

    // Alex (Left) — terrified screaming face
    drawFigure(g, {
      x: set.alexX,
      y: set.sofaSeatY - 8,
      s: 1.28,
      facing: 1,
      outfit: ALEX,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: 'terrified',
      look: [0.65, 0],
      rim: rimLeft,
      shiver: shiverVal,
      shadow: false
    });

    // Ben (Right) — terrified grimace face
    drawFigure(g, {
      x: set.benX,
      y: set.sofaSeatY - 6,
      s: 1.26,
      facing: 1,
      outfit: BEN,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: 'terrified',
      look: [0.55, 0],
      rim: rimRight,
      shiver: shiverVal,
      shadow: false
    });

    // 3. Yellow jagged shock sparks bursting beside their heads (like reference image!)
    const sparkAlpha = Math.min(1.0, t * 2.5);
    drawShockSparks(g, set.alexX + 55, set.sofaSeatY - 210, sparkAlpha, t);
    drawShockSparks(g, set.benX + 110, set.sofaSeatY - 140, sparkAlpha * 0.85, t + 1.2);

    // 4. Shivering blanket pulled right up to their chins
    drawCozyBlanket(g, set.sofaX, set.sofaSeatY + 20, 530, 245, t, { shiver: 1.2 });

    // 5. White cartoon hands clutching blanket fold tightly
    drawClutchingHands(g, set.alexX, set.sofaSeatY - 85, 1.28, t);
    drawClutchingHands(g, set.benX, set.sofaSeatY - 83, 1.26, t + 0.4);

    // 6. Spooky Ghost Thought Bubble floating above right (exactly like reference image!)
    // Pops in from t = 0.5s to 3.0s
    const bubbleProgress = ease.out(prog(t, 0.4, 1.4));
    if (bubbleProgress > 0) {
      const bx = set.benX + 130;
      const by = set.sofaSeatY - 325;
      drawSpookyGhostThoughtBubble(g, bx, by, t, 0.88 * bubbleProgress, {
        alpha: bubbleProgress
      });
    }

    // 7. Foreground coffee table with popcorn and mugs
    drawLivingRoomForeground(g, t);
  }
});

// Helper for hands clutching blanket with shiver
function drawClutchingHands(g, cx, cy, s = 1.28, t = 0) {
  const shX = Math.sin(t * 45) * 2;
  const shY = Math.cos(t * 38) * 1.5;

  g.save();
  g.translate(cx + shX, cy + shY);
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 4.5 * s;

  // Left hand knuckles
  g.beginPath();
  g.ellipse(-30 * s, 14 * s, 15 * s, 11 * s, 0.15, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Right hand knuckles
  g.beginPath();
  g.ellipse(30 * s, 14 * s, 15 * s, 11 * s, -0.15, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

// Helper for yellow comic shock sparks
function drawShockSparks(g, x, y, a = 1, t = 0) {
  if (a <= 0) return;
  const pulse = 1 + 0.15 * Math.sin(t * 22);

  g.save();
  g.globalAlpha *= a;
  g.translate(x, y);
  g.scale(pulse, pulse);

  // Jagged yellow spark polygon
  g.fillStyle = '#ffcf24';
  g.strokeStyle = '#12141a';
  g.lineWidth = 3.5;
  g.lineJoin = 'miter';

  poly(g, [
    [-18, 12], [-4, 2], [-14, -14], [8, -6], [2, -26],
    [24, -4], [10, 8], [22, 18], [4, 14], [-6, 26]
  ], '#ffcf24');

  g.stroke();
  g.restore();
}
