// scenes/shots/05_cat_relief.js — Beat 5: Black cat walks by, comic relief & sudden jump
import { E, V, registerShot, ease, prog, lerp, circle, poly, seg } from '/engine/core.js';
import { drawFigure } from '/engine/rig2d.js';
import { livingRoomNight, drawCozyBlanket, drawLivingRoomForeground } from '../sets/living_room_night.js';
import { ALEX, BEN } from '../cast.js';

registerShot('s005_cat', {
  draw(g, t) {
    const W = E.W || 1920, H = E.H || 1080;
    const cam = { z: 1.08, x: -10, y: -20 };

    // 1. Living room set
    const set = livingRoomNight(g, t, cam);

    // 2. Timing states
    // t 0 -> 1.0: Still tense, staring right
    // t 1.0 -> 2.5: Cat trots across, eyes follow cat downward, relief washes over
    // t 2.5 -> 3.2: Big happy comic relief sigh
    // t 3.2 -> 4.0: Sudden comic jump!
    const reliefProgress = ease.out(prog(t, 1.2, 2.4));
    const jumpProgress = t > 3.2 ? ease.out(prog(t, 3.2, 3.45)) : 0;
    const jumpFall = t > 3.45 ? ease.in(prog(t, 3.45, 3.8)) : 0;
    const jumpY = (jumpProgress - jumpFall) * 28;

    const alexExpr = t < 1.0 ? 'terrified' : (t > 3.2 ? 'shocked' : (reliefProgress > 0.6 ? 'relief' : 'worried'));
    const benExpr = t < 1.0 ? 'terrified' : (t > 3.2 ? 'shocked' : (reliefProgress > 0.6 ? 'relief' : 'worried'));

    // Eyes tracking cat
    const catLookX = lerp(0.6, -0.4, prog(t, 0.8, 2.5));
    const catLookY = lerp(0.1, 0.45, prog(t, 0.8, 2.0));
    const look = reliefProgress > 0.8 ? [0, 0] : [catLookX, catLookY];

    const shiverVal = Math.max(0, 1.0 - reliefProgress * 1.5);
    const rimLeft = { color: '#ffcf85', dir: [-0.9, -0.4], w: 5 };
    const rimRight = { color: '#bce0fd', dir: [0.9, -0.4], w: 5 };

    // Alex
    drawFigure(g, {
      x: set.alexX,
      y: set.sofaSeatY - jumpY,
      s: 1.25,
      facing: 1,
      outfit: ALEX,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: alexExpr,
      look: look,
      rim: rimLeft,
      shiver: shiverVal,
      shadow: false
    });

    // Ben
    drawFigure(g, {
      x: set.benX,
      y: set.sofaSeatY - jumpY * 0.9,
      s: 1.25,
      facing: 1,
      outfit: BEN,
      character: 'white_cartoon',
      pose: 'sit_sofa',
      expr: benExpr,
      look: look,
      rim: rimRight,
      shiver: shiverVal,
      shadow: false
    });

    // 3. Blanket (falls slightly in relief, then jerks on jump)
    const blanketDrop = reliefProgress * 12;
    drawCozyBlanket(g, set.sofaX, set.sofaSeatY + 30 + blanketDrop - jumpY * 0.5, 520, 240, t, { shiver: shiverVal * 0.5 });

    // 4. Hands relaxing on blanket
    drawBlanketHandsRelaxed(g, set.alexX, set.sofaSeatY - 80 + blanketDrop - jumpY * 0.5, 1.25);
    drawBlanketHandsRelaxed(g, set.benX, set.sofaSeatY - 80 + blanketDrop - jumpY * 0.5, 1.25);

    // 5. Sigh of Relief Cloud Puffs at t 2.2 -> 3.2
    if (t > 2.0 && t < 3.2) {
      drawSighPuff(g, set.alexX + 35, set.sofaSeatY - 140, t - 2.0);
      drawSighPuff(g, set.benX + 30, set.sofaSeatY - 135, t - 2.2);
    }

    // 6. Cute Black Cat trotting across floor
    const catT = prog(t, 0.4, 2.8);
    if (catT > 0 && catT < 1.1) {
      const catX = lerp(W * 0.88, W * 0.22, catT);
      const catY = set.GY + 25;
      drawBlackCat(g, catX, catY, t, catT);
    }

    // 7. Foreground
    drawLivingRoomForeground(g, t);
  }
});

function drawBlanketHandsRelaxed(g, cx, cy, s = 1.25) {
  g.save();
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 4 * s;

  g.beginPath();
  g.ellipse(cx - 30 * s, cy + 20 * s, 14 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.beginPath();
  g.ellipse(cx + 30 * s, cy + 20 * s, 14 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.restore();
}

// Helper: Cute Black Cat trotting with waving tail
function drawBlackCat(g, cx, cy, t, catProg) {
  g.save();
  g.translate(cx, cy);

  // Shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  g.beginPath();
  g.ellipse(0, 10, 36, 10, 0, 0, Math.PI * 2);
  g.fill();

  // Walk cycle bobbing
  const bob = Math.sin(t * 16) * 3;
  const legCycle = Math.sin(t * 16);

  // Legs
  g.strokeStyle = '#111217';
  g.lineWidth = 7;
  g.lineCap = 'round';
  // Front legs
  seg(g, [[-16, -6], [-16 - legCycle * 8, 8]], 7, '#111217');
  seg(g, [[-6, -6], [-6 + legCycle * 8, 8]], 7, '#111217');
  // Back legs
  seg(g, [[14, -6], [14 + legCycle * 8, 8]], 7, '#111217');
  seg(g, [[22, -6], [22 - legCycle * 8, 8]], 7, '#111217');

  // Cat Body (Facing left)
  g.fillStyle = '#161820';
  g.beginPath();
  g.ellipse(4, -12 + bob, 26, 16, 0.08, 0, Math.PI * 2);
  g.fill();

  // Cat Head
  const headX = -22, headY = -22 + bob;
  circle(g, headX, headY, 15, '#161820');

  // Pointy cat ears
  poly(g, [[headX - 12, headY - 8], [headX - 16, headY - 26], [headX - 4, headY - 14]], '#161820');
  poly(g, [[headX + 2, headY - 14], [headX + 10, headY - 26], [headX + 12, headY - 8]], '#161820');

  // Glowing yellow cat eyes
  circle(g, headX - 6, headY - 2, 3.5, '#f5d840');
  circle(g, headX + 4, headY - 2, 3.5, '#f5d840');
  // Slit pupils
  g.fillStyle = '#121216';
  g.fillRect(headX - 6.5, headY - 4, 1.5, 4);
  g.fillRect(headX + 3.5, headY - 4, 1.5, 4);

  // Cute pink nose
  poly(g, [[headX - 2, headY + 3], [headX, headY + 5], [headX + 2, headY + 3]], '#ff9bb2');

  // Waving Cat Tail (S-curve upright)
  g.strokeStyle = '#161820';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(26, -14 + bob);
  const tailWave = Math.sin(t * 10) * 8;
  g.bezierCurveTo(40, -25 + bob, 35 + tailWave, -45 + bob, 48 + tailWave, -55 + bob);
  g.stroke();

  // Cute "Meow~" text bubble at t ~ 1.5s
  if (catProg > 0.35 && catProg < 0.75) {
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#12141a';
    g.lineWidth = 2.5;
    g.font = 'bold 16px sans-serif';
    g.fillText('Meow~ 🐾', headX - 35, headY - 35);
  }

  g.restore();
}

// Helper: Comic relief sigh cloud
function drawSighPuff(g, x, y, age) {
  if (age <= 0) return;
  const a = Math.max(0, 1 - age * 0.85);
  const rise = age * 35;
  const grow = 1 + age * 0.8;

  g.save();
  g.globalAlpha = a;
  g.translate(x, y - rise);
  g.scale(grow, grow);

  g.fillStyle = 'rgba(235, 245, 255, 0.75)';
  g.strokeStyle = '#12141a';
  g.lineWidth = 2.5;

  g.beginPath();
  g.arc(-10, 0, 10, 0, Math.PI * 2);
  g.arc(6, -6, 12, 0, Math.PI * 2);
  g.arc(16, 4, 9, 0, Math.PI * 2);
  g.closePath();
  g.fill();
  g.stroke();

  // Little breath trail circles
  circle(g, -18, 12, 4, 'rgba(235, 245, 255, 0.6)');
  circle(g, -24, 20, 2.5, 'rgba(235, 245, 255, 0.4)');
  g.restore();
}
