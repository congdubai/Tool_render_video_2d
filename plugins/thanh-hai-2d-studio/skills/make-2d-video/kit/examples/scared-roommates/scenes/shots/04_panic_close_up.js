// scenes/shots/04_panic_close_up.js — Beat 4: Extreme close-up panic, head clutching & pointing
import { E, V, registerShot, ease, prog, lerp, circle, seg, poly } from '/engine/core.js';
import { bigFace, drawFigure } from '/engine/rig2d.js';
import { livingRoomNight } from '../sets/living_room_night.js';
import { ALEX, BEN } from '../cast.js';

registerShot('s004_panic', {
  draw(g, t) {
    const W = E.W || 1920, H = E.H || 1080;

    // 1. Heavy blur living room background with dramatic tension lighting
    g.save();
    g.filter = 'blur(16px)';
    livingRoomNight(g, t, { z: 1.5, x: -80, y: -80 });
    g.restore();

    // Dark vignette veil
    g.fillStyle = 'rgba(12, 10, 18, 0.45)';
    g.fillRect(0, 0, W, H);

    // Camera heartbeat tremor
    const heartShake = Math.sin(t * 30) * Math.exp(-((t * 2) % 1.2) * 4) * 5;
    g.save();
    g.translate(0, heartShake);

    // Dual Dramatic Big Faces
    // Left: Alex clutches head in sheer panic
    const alexX = W * 0.32 + Math.sin(t * 50) * 3;
    const alexY = H * 0.52 + Math.cos(t * 42) * 2.5;
    const rAlex = 240 * (1 + 0.02 * Math.sin(t * 8));

    bigFace(g, alexX, alexY, rAlex, {
      outfit: ALEX,
      character: 'white_cartoon',
      expr: 'terrified',
      rimColor: '#ffb969',
      rimSide: -1,
      tilt: -0.06 + Math.sin(t * 35) * 0.03
    });

    // Cartoon hands clutching Alex's head (left & right temples)
    drawHeadClutchHands(g, alexX, alexY, rAlex, t);

    // Right: Ben pointing shaking finger in terror
    const benX = W * 0.72 + Math.sin(t * 45) * 2.5;
    const benY = H * 0.54 + Math.cos(t * 38) * 2;
    const rBen = 230 * (1 + 0.02 * Math.cos(t * 8));

    bigFace(g, benX, benY, rBen, {
      outfit: BEN,
      character: 'white_cartoon',
      expr: 'terrified',
      look: [0.6, 0.05],
      rimColor: '#9fd7ff',
      rimSide: 1,
      tilt: 0.05 + Math.cos(t * 32) * 0.03
    });

    // Shaking cartoon hand pointing toward right
    drawShakingPointHand(g, benX + 175, benY + 90, t);

    // Comic sweat drops flying in close-up
    drawFlyingSweatDrops(g, alexX - 180, alexY - 80, t);
    drawFlyingSweatDrops(g, benX + 170, benY - 70, t + 1.5);

    // Giant yellow comic exclamation / shock spark between them
    drawShockSparksBig(g, W * 0.52, H * 0.38, 1.0, t);

    g.restore();
  }
});

// Helper for white cartoon hands gripping the head in terror
function drawHeadClutchHands(g, hx, hy, r, t) {
  const shX = Math.sin(t * 45) * 2;
  const shY = Math.cos(t * 38) * 1.5;

  g.save();
  g.translate(hx + shX, hy + shY);
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 6;

  // Left hand on left temple
  g.save();
  g.translate(-r * 0.88, -r * 0.22);
  g.rotate(-0.4);
  // Palm
  g.beginPath();
  g.ellipse(0, 0, 36, 44, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Fingers clutching inward
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(14, -20 + i * 20, 16, 10, 0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();

  // Right hand on right temple
  g.save();
  g.translate(r * 0.88, -r * 0.22);
  g.rotate(0.4);
  // Palm
  g.beginPath();
  g.ellipse(0, 0, 36, 44, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // Fingers clutching inward
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.ellipse(-14, -20 + i * 20, 16, 10, -0.3, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();

  g.restore();
}

// Helper for shaking hand pointing finger in horror
function drawShakingPointHand(g, px, py, t) {
  const shX = Math.sin(t * 55) * 4;
  const shY = Math.cos(t * 48) * 3;

  g.save();
  g.translate(px + shX, py + shY);
  g.fillStyle = '#f7f6f2';
  g.strokeStyle = '#12141a';
  g.lineWidth = 6;

  // Arm sleeve/wrist coming from bottom left
  seg(g, [[-40, 90], [0, 10]], 34, '#f7f6f2');

  // Fist base
  g.beginPath();
  g.ellipse(0, 0, 34, 30, 0.2, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Pointing index finger extending rightwards
  g.beginPath();
  g.moveTo(20, -12);
  g.lineTo(85, -18);
  g.arc(85, -8, 10, -Math.PI * 0.5, Math.PI * 0.5);
  g.lineTo(20, 2);
  g.closePath();
  g.fill();
  g.stroke();

  // Shaking motion lines on finger
  g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(95, -8, 16, -Math.PI * 0.35, Math.PI * 0.35);
  g.stroke();
  g.beginPath();
  g.arc(106, -8, 22, -Math.PI * 0.3, Math.PI * 0.3);
  g.stroke();

  g.restore();
}

// Helper for flying sweat drops
function drawFlyingSweatDrops(g, sx, sy, t) {
  g.save();
  g.fillStyle = '#9fe0ff';
  g.strokeStyle = '#12141a';
  g.lineWidth = 3;

  for (let i = 0; i < 3; i++) {
    const age = ((t * 1.8 + i * 0.4) % 1.0);
    const dx = Math.cos(i * 1.5) * age * 60;
    const dy = -Math.sin(i * 1.2) * age * 50 + age * age * 30;
    const a = 1 - age;

    g.globalAlpha = a;
    g.beginPath();
    g.arc(sx + dx, sy + dy, 9 * (1 - age * 0.3), 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawShockSparksBig(g, x, y, a = 1, t = 0) {
  if (a <= 0) return;
  const pulse = 1 + 0.18 * Math.sin(t * 26);

  g.save();
  g.globalAlpha *= a;
  g.translate(x, y);
  g.scale(pulse, pulse);

  g.fillStyle = '#ffcf24';
  g.strokeStyle = '#12141a';
  g.lineWidth = 5;

  poly(g, [
    [-24, 16], [-6, 3], [-20, -20], [10, -8], [3, -35],
    [32, -6], [14, 10], [30, 24], [5, 18], [-8, 35]
  ], '#ffcf24');

  g.stroke();
  g.restore();
}
