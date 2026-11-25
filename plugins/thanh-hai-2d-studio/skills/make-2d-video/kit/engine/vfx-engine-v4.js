// engine/vfx-engine-v4.js — Universal Cartoon VFX & Weather Engine (V4)
// High-detail 2D Cartoon Visual Effects, Weather Simulation, Deterministic Particle Engine,
// 6-Layer Compositing Architecture, Character Skeletal Attachments & External Sprite Sheet Animation.

import { E, clamp, lerp, prog, ease, seg, poly, circle, ring, rr, linGrad, radGrad, glow, alpha, shade, mix } from './core.js';

// ============================================================================
// 1. DETERMINISTIC PRNG & PARTICLE SYSTEM
// ============================================================================

/**
 * Deterministic hash PRNG: given seed and index, returns pseudo-random float in [0, 1).
 * Completely invariant to frame rate, scrubbing, or execution environment.
 */
export function hashRNG(seed = 1, idx = 0, salt = 0) {
  let h = ((seed ^ (idx * 2654435761)) ^ (salt * 1013904223)) >>> 0;
  h = (h ^ (h >>> 16)) * 0x45d9f3b;
  h = (h ^ (h >>> 16)) * 0x45d9f3b;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * Creates a deterministic sequence generator
 */
export function createDeterministicRNG(seed = 1) {
  let s = (Math.floor(seed) || 1) >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Analytical Continuous Particle Solver:
 * Computes exact state of particle i at timestamp t with zero divergence between preview and render.
 */
export function solveParticle(spec, i, t) {
  const {
    count = 20,
    lifetime = 1.0,
    speed = 1.0,
    seed = 42,
    emitterType = 'point', // 'point' | 'line' | 'rect' | 'circle' | 'character_bounds'
    emitterArea = [0, 0, 0, 0], // [x, y, w, h] or [x, y, r]
    direction = -Math.PI / 2, // angle in radians (default upward)
    spreadAngle = Math.PI * 0.4,
    initialVelocity = 100,
    gravity = 0,
    wind = [0, 0],
    size = 10,
    sizeVariation = 0.5,
    sizeEndFactor = 1.0,
    rotationSpeed = 0,
    opacity = 1.0,
    fadeIn = 0.15,
    fadeOut = 0.25,
    color = '#ffffff',
    colorEnd = null
  } = spec;

  // Individual particle phase and unique duration
  const phi = hashRNG(seed, i, 1) * lifetime;
  const pLife = lifetime * (0.8 + 0.4 * hashRNG(seed, i, 2));
  const age = ((t * speed + phi) % pLife);
  const u = clamp(age / pLife, 0, 1);

  // Emitter spawn location
  let x0 = 0, y0 = 0;
  if (emitterType === 'line') {
    const frac = hashRNG(seed, i, 11);
    x0 = emitterArea[0] + frac * (emitterArea[2] - emitterArea[0]);
    y0 = emitterArea[1] + frac * (emitterArea[3] - emitterArea[1]);
  } else if (emitterType === 'rect' || emitterType === 'character_bounds') {
    x0 = emitterArea[0] + hashRNG(seed, i, 11) * (emitterArea[2] || 60);
    y0 = emitterArea[1] + hashRNG(seed, i, 12) * (emitterArea[3] || 120);
  } else if (emitterType === 'circle') {
    const ang = hashRNG(seed, i, 11) * Math.PI * 2;
    const rad = Math.sqrt(hashRNG(seed, i, 12)) * (emitterArea[2] || 40);
    x0 = emitterArea[0] + Math.cos(ang) * rad;
    y0 = emitterArea[1] + Math.sin(ang) * rad;
  } else {
    // point
    x0 = emitterArea[0] || 0;
    y0 = emitterArea[1] || 0;
  }

  // Initial velocity with directional cone spread
  const angle = direction + (hashRNG(seed, i, 13) - 0.5) * spreadAngle;
  const vMag = initialVelocity * (0.7 + 0.6 * hashRNG(seed, i, 14));
  const vx = Math.cos(angle) * vMag;
  const vy = Math.sin(angle) * vMag;

  // Trajectory: displacement = v0 * t + 0.5 * a * t^2
  const px = x0 + vx * age + 0.5 * (wind[0] || 0) * age * age;
  const py = y0 + vy * age + 0.5 * (gravity + (wind[1] || 0)) * age * age;

  // Size calculation
  const sVar = 1 - sizeVariation * 0.5 + sizeVariation * hashRNG(seed, i, 15);
  const curSize = Math.max(0.5, size * sVar * (1 + (sizeEndFactor - 1) * u));

  // Opacity fade in / out
  let alphaFactor = 1.0;
  if (u < fadeIn && fadeIn > 0) {
    alphaFactor = u / fadeIn;
  } else if (u > 1 - fadeOut && fadeOut > 0) {
    alphaFactor = (1 - u) / fadeOut;
  }
  const curOpacity = clamp(opacity * alphaFactor, 0, 1);

  // Rotation
  const rot0 = hashRNG(seed, i, 16) * Math.PI * 2;
  const curRot = rot0 + rotationSpeed * age;

  // Color interpolation
  let curColor = color;
  if (colorEnd && u > 0.05) {
    curColor = mix(color, colorEnd, u);
  }

  return {
    index: i,
    x: px,
    y: py,
    size: curSize,
    opacity: curOpacity,
    rotation: curRot,
    color: curColor,
    u,
    seed: seed + i
  };
}

// ============================================================================
// 2. GROUP A — EMOTION EFFECTS (Procedural & Animated)
// ============================================================================

/**
 * A1. Sweat Drop: Cartoon blue-white teardrop sliding down and wobbling
 */
export function drawVfxSweatDrop(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#bae6fd', ink = '#0284c7', speed = 1.2 } = o;
  const ph = (t * speed) % 1.0;
  const dropY = y + ph * 32 * scale;
  const dropScale = scale * (0.8 + 0.2 * Math.sin(t * 8));

  g.save();
  g.translate(x, dropY);
  g.scale(dropScale, dropScale);

  // Teardrop path
  g.fillStyle = color;
  g.strokeStyle = ink;
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(0, -18);
  g.bezierCurveTo(8, -8, 12, 4, 12, 10);
  g.arc(0, 10, 12, 0, Math.PI);
  g.bezierCurveTo(-12, 4, -8, -8, 0, -18);
  g.closePath();
  g.fill();
  g.stroke();

  // Highlight
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  g.beginPath();
  g.ellipse(-4, 6, 3, 5, -0.3, 0, Math.PI * 2);
  g.fill();

  g.restore();
}

/**
 * A2. Anger Symbol: 4 curved red cross vein lines pulsing with comic rhythm
 */
export function drawVfxAngerSymbol(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#ef4444', speed = 2.0 } = o;
  const pulse = 1.0 + 0.18 * Math.sin(t * speed * Math.PI * 2);

  g.save();
  g.translate(x, y);
  g.scale(scale * pulse, scale * pulse);
  g.strokeStyle = color;
  g.lineWidth = 4.2;
  g.lineCap = 'round';

  const r = 14;
  for (let rot = 0; rot < 4; rot++) {
    g.save();
    g.rotate((rot * Math.PI) / 2);
    g.beginPath();
    g.arc(r * 0.7, r * 0.7, r * 0.7, Math.PI, Math.PI * 1.5);
    g.stroke();
    g.restore();
  }
  g.restore();
}

/**
 * A3. Anger Smoke: Wisps of anger steam puffs shooting up from temples/head
 */
export function drawVfxAngerSmoke(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 5, color = '#f1f5f9', speed = 1.5, seed = 17 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const life = 0.8;
    const age = ((t * speed + phi * life) % life);
    const u = age / life;

    const spread = (hashRNG(seed, i, 2) - 0.5) * 40;
    const px = spread * (1 + u * 0.8);
    const py = -u * 65;
    const r = (6 + u * 16) * (0.8 + 0.4 * hashRNG(seed, i, 3));
    const op = (1 - u) * 0.85;

    g.fillStyle = alpha(color, op);
    g.strokeStyle = alpha('#94a3b8', op);
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

/**
 * A4. Question Mark: Comic question mark floating with gentle bounce
 */
export function drawVfxQuestionMark(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#38bdf8', ink = '#0369a1', speed = 1.6 } = o;
  const bounce = Math.sin(t * speed * Math.PI * 2) * 6;

  g.save();
  g.translate(x, y + bounce);
  g.scale(scale, scale);

  g.font = 'bold 36px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeStyle = ink;
  g.lineWidth = 5;
  g.strokeText('?', 0, 0);
  g.fillStyle = color;
  g.fillText('?', 0, 0);

  g.restore();
}

/**
 * A5. Exclamation Mark: Sharp alert exclamation point snapping up
 */
export function drawVfxExclamationMark(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#f59e0b', ink = '#b45309', speed = 2.0 } = o;
  const snap = 1.0 + 0.15 * Math.abs(Math.sin(t * speed * Math.PI));

  g.save();
  g.translate(x, y);
  g.scale(scale * snap, scale * snap);

  g.font = '900 38px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.strokeStyle = ink;
  g.lineWidth = 5;
  g.strokeText('!', 0, 0);
  g.fillStyle = color;
  g.fillText('!', 0, 0);

  // Shock shockwave ring around dot
  ring(g, 0, 12, 12 * snap, 2.5, alpha(color, 0.6));
  g.restore();
}

/**
 * A6. Love Hearts: Floating hearts beating and drifting upward in wavy trajectories
 */
export function drawVfxLoveHearts(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 4, color = '#f43f5e', speed = 1.0, seed = 23 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const life = 1.4;
    const age = (t * speed + phi * life) % life;
    const u = age / life;

    const hx = (hashRNG(seed, i, 2) - 0.5) * 50 + Math.sin(t * 3 + i) * 12;
    const hy = -u * 70;
    const hs = (0.6 + 0.5 * hashRNG(seed, i, 3)) * (1.0 + 0.2 * Math.sin(t * 8 + i));
    const op = (1 - u * u);

    g.save();
    g.translate(hx, hy);
    g.scale(hs, hs);
    g.fillStyle = alpha(color, op);
    g.strokeStyle = alpha('#9f1239', op);
    g.lineWidth = 1.8;

    // Heart shape
    g.beginPath();
    g.moveTo(0, 4);
    g.bezierCurveTo(-8, -6, -14, 2, 0, 16);
    g.bezierCurveTo(14, 2, 8, -6, 0, 4);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
}

/**
 * A7. Cartoon Tears: Waterfall comic tears spraying from eyes
 */
export function drawVfxCartoonTears(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#60a5fa', ink = '#1d4ed8', speed = 2.2 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Two streaming waterfalls left and right
  [-22, 22].forEach((tx, side) => {
    g.save();
    g.translate(tx, 0);
    g.fillStyle = color;
    g.strokeStyle = ink;
    g.lineWidth = 2.5;

    // Gushing fountain stream
    g.beginPath();
    const wave = Math.sin(t * 14 + side * 3) * 5;
    g.moveTo(-6, 0);
    g.quadraticCurveTo(-14 + wave, 25, -12, 60);
    g.lineTo(12, 60);
    g.quadraticCurveTo(14 + wave, 25, 6, 0);
    g.closePath();
    g.fill();
    g.stroke();

    // Splashing droplets at bottom
    for (let k = 0; k < 3; k++) {
      const dropU = ((t * speed + k * 0.3) % 1.0);
      const dx = (k - 1) * 14 + wave;
      const dy = 55 + dropU * 22;
      circle(g, dx, dy, 4 * (1 - dropU), color);
    }
    g.restore();
  });
  g.restore();
}

/**
 * A8. Dizzy Stars: Golden 5-point stars orbiting in an ellipse around the head
 */
export function drawVfxDizzyStars(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 4, color = '#fbbf24', ink = '#b45309', speed = 1.5, rx = 44, ry = 16 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Orbit ring trace (subtle)
  g.strokeStyle = 'rgba(251, 191, 36, 0.25)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.stroke();

  for (let i = 0; i < count; i++) {
    const ang = t * speed * Math.PI * 2 + (i * Math.PI * 2) / count;
    const sx = Math.cos(ang) * rx;
    const sy = Math.sin(ang) * ry;
    const starScale = 0.8 + 0.3 * Math.sin(ang); // depth scaling

    g.save();
    g.translate(sx, sy);
    g.rotate(t * 4 + i);
    g.scale(starScale, starScale);

    // 5-point star
    g.fillStyle = color;
    g.strokeStyle = ink;
    g.lineWidth = 1.8;
    g.beginPath();
    for (let p = 0; p < 10; p++) {
      const a = (p * Math.PI) / 5;
      const r = p % 2 === 0 ? 11 : 4.5;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (p === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
}

/**
 * A9. Embarrassment Lines: Slanted hatched blush lines across cheeks or forehead
 */
export function drawVfxEmbarrassmentLines(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#f43f5e', count = 5, spacing = 8, len = 22 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Soft rosy glow behind lines
  glow(g, 0, 0, 28, '#f43f5e', 0.35);

  g.strokeStyle = color;
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  const startX = -((count - 1) * spacing) / 2;

  for (let i = 0; i < count; i++) {
    const lx = startX + i * spacing;
    g.beginPath();
    g.moveTo(lx - 4, -len / 2);
    g.lineTo(lx + 4, len / 2);
    g.stroke();
  }
  g.restore();
}

/**
 * A10. Shock Lines: Radiating jagged shock spikes around head/eyes flashing
 */
export function drawVfxShockLines(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#111827', count = 10, radius = 48, speed = 4.0 } = o;
  const flash = Math.sin(t * speed * Math.PI * 2) > -0.2;
  if (!flash) return;

  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.strokeStyle = color;
  g.lineWidth = 3.0;
  g.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const ang = (i * Math.PI * 2) / count + Math.sin(t * 8 + i) * 0.1;
    const r1 = radius + 6;
    const r2 = r1 + 16 + (i % 2 === 0 ? 8 : 0);
    g.beginPath();
    g.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    g.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    g.stroke();
  }
  g.restore();
}

/**
 * A11. Dark Gloom: Vertical gradient dark purple/blue shade dropping over upper face
 */
export function drawVfxDarkGloom(g, x, y, t, o = {}) {
  const { scale = 1.0, width = 90, height = 70, color = '#1e1b4b', opacity = 0.72 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Vertical linear gradient from top dark to bottom transparent
  const grad = g.createLinearGradient(0, -height / 2, 0, height / 2);
  grad.addColorStop(0, alpha(color, opacity));
  grad.addColorStop(0.7, alpha(color, opacity * 0.6));
  grad.addColorStop(1, alpha(color, 0));

  g.fillStyle = grad;
  g.beginPath();
  g.rect(-width / 2, -height / 2, width, height);
  g.fill();

  // Dark vertical sorrow hatch lines
  g.strokeStyle = alpha('#0f172a', opacity * 0.85);
  g.lineWidth = 1.8;
  for (let lx = -width * 0.4; lx <= width * 0.4; lx += 10) {
    g.beginPath();
    g.moveTo(lx, -height / 2);
    g.lineTo(lx, height * 0.2);
    g.stroke();
  }
  g.restore();
}

/**
 * A12. Idea Bulb: Yellow cartoon lightbulb appearing with radiant bursts
 */
export function drawVfxIdeaBulb(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#fbbf24', bulbColor = '#fef08a', speed = 2.0 } = o;
  const pulse = 1.0 + 0.12 * Math.sin(t * speed * Math.PI * 2);

  g.save();
  g.translate(x, y);
  g.scale(scale * pulse, scale * pulse);

  // Radiant burst rays around bulb
  g.strokeStyle = color;
  g.lineWidth = 3.0;
  g.lineCap = 'round';
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI * 2) / 8;
    g.beginPath();
    g.moveTo(Math.cos(ang) * 22, Math.sin(ang) * 22);
    g.lineTo(Math.cos(ang) * 34, Math.sin(ang) * 34);
    g.stroke();
  }

  // Glow
  glow(g, 0, 0, 40, color, 0.6);

  // Bulb glass body
  g.fillStyle = bulbColor;
  g.strokeStyle = '#d97706';
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(0, -4, 14, 0.7, Math.PI - 0.7, true);
  g.quadraticCurveTo(8, 8, 6, 14);
  g.lineTo(-6, 14);
  g.quadraticCurveTo(-8, 8, -13, 3);
  g.closePath();
  g.fill();
  g.stroke();

  // Filament inside
  g.strokeStyle = '#b45309';
  g.lineWidth = 2.0;
  g.beginPath();
  g.moveTo(-4, 4);
  g.lineTo(-2, -4);
  g.lineTo(2, -4);
  g.lineTo(4, 4);
  g.stroke();

  // Screw base
  g.fillStyle = '#94a3b8';
  g.fillRect(-5, 14, 10, 5);
  g.fillRect(-3, 19, 6, 3);

  g.restore();
}

// ============================================================================
// 3. GROUP B — ACTION EFFECTS (Dust, Smoke, Combat & Explosions)
// ============================================================================

/**
 * B1. Dust Cloud: Cartoon dust puffs billowing and fading
 */
export function drawVfxDustCloud(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 6, color = '#e2e8f0', ink = '#94a3b8', speed = 1.4, seed = 31 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const life = 0.9;
    const age = (t * speed + phi * life) % life;
    const u = age / life;

    const angle = (hashRNG(seed, i, 2) - 0.5) * Math.PI * 0.9;
    const dist = u * 48 * (0.8 + 0.5 * hashRNG(seed, i, 3));
    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist - u * 15;
    const r = (10 + u * 18) * (0.8 + 0.4 * hashRNG(seed, i, 4));
    const op = (1 - u);

    g.fillStyle = alpha(color, op);
    g.strokeStyle = alpha(ink, op);
    g.lineWidth = 2.0;
    g.beginPath();
    g.arc(px, py, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.restore();
}

/**
 * B2. Fight Smoke: Comic brawl dust ball that spins, pops out limbs & stars,
 * and provides masking capabilities for Phase 4 composite fight actions.
 */
export function drawVfxFightSmoke(g, x, y, t, o = {}) {
  const {
    scale = 1.2,
    radius = 70,
    color = '#f8fafc',
    ink = '#334155',
    speed = 2.5,
    seed = 45,
    showLimbs = true,
    maskCharacters = false
  } = o;

  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // 1. Central violently spinning puffy smoke mass
  const puffCount = 9;
  const rot = t * speed * 2.0;

  for (let i = 0; i < puffCount; i++) {
    const a = rot + (i * Math.PI * 2) / puffCount;
    const wobble = Math.sin(t * 12 + i * 2) * 10;
    const pr = radius * 0.55 + wobble;
    const px = Math.cos(a) * pr;
    const py = Math.sin(a) * pr;
    const puffRad = 32 + (i % 3) * 6;

    g.fillStyle = color;
    g.strokeStyle = ink;
    g.lineWidth = 3.2;
    g.beginPath();
    g.arc(px, py, puffRad, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  // Center core filler so character is completely hidden if inside
  circle(g, 0, 0, radius * 0.65, color);

  // 2. Action impact stars & lightning sparks radiating outward
  const sparkCount = 6;
  for (let s = 0; s < sparkCount; s++) {
    const spAge = ((t * speed * 1.5 + s * 0.22) % 0.8) / 0.8;
    const sAng = s * 1.1 + Math.sin(t * 8 + s);
    const sDist = radius * (0.8 + spAge * 0.6);
    const sx = Math.cos(sAng) * sDist;
    const sy = Math.sin(sAng) * sDist;

    // Small cartoon star/cross
    g.save();
    g.translate(sx, sy);
    g.rotate(t * 6 + s);
    g.fillStyle = ['#fbbf24', '#ef4444', '#38bdf8'][s % 3];
    g.strokeStyle = ink;
    g.lineWidth = 1.8;
    g.beginPath();
    for (let p = 0; p < 8; p++) {
      const a = (p * Math.PI) / 4;
      const r = p % 2 === 0 ? 10 * (1 - spAge) : 3;
      if (p === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }

  // 3. Popping cartoon limbs (Fists, kicking shoes) for classic comic brawl
  if (showLimbs) {
    const limbPh = (t * speed) % 1.0;
    const limbSide = (Math.floor(t * speed * 2) % 4);
    const limbAng = (limbSide * Math.PI) / 2 + 0.3;
    const limbDist = radius * 0.85 + Math.sin(limbPh * Math.PI) * 26;

    g.save();
    g.translate(Math.cos(limbAng) * limbDist, Math.sin(limbAng) * limbDist);
    g.rotate(limbAng + Math.PI / 2);

    if (limbSide % 2 === 0) {
      // Clenched white boxing fist
      g.fillStyle = '#fffdf8';
      g.strokeStyle = ink;
      g.lineWidth = 3.0;
      circle(g, 0, 0, 14, '#fffdf8');
      g.stroke();
      // Knuckles
      seg(g, [[-8, -2], [8, -2]], 2.5, ink);
    } else {
      // Kicking shoe
      g.fillStyle = '#2563eb';
      g.strokeStyle = ink;
      g.lineWidth = 3.0;
      rr(g, -12, -8, 24, 16, 6);
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  g.restore();
}

/**
 * B3. Impact Flash: Sharp white/yellow starburst flashing on collision
 */
export function drawVfxImpactFlash(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#ffffff', outerColor = '#fef08a', duration = 0.35, points = 12 } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const flashScale = scale * (1.2 - 0.2 * u);
  const alphaVal = (1 - u);

  g.save();
  g.translate(x, y);
  g.scale(flashScale, flashScale);

  // Sharp multi-point impact star
  g.fillStyle = alpha(outerColor, alphaVal);
  g.beginPath();
  const maxR = 60 * (0.6 + 0.4 * (1 - u));
  const minR = 12;
  for (let i = 0; i < points * 2; i++) {
    const ang = (i * Math.PI) / points;
    const r = i % 2 === 0 ? maxR : minR;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();

  // White center flash core
  circle(g, 0, 0, 18 * (1 - u), alpha(color, alphaVal));
  g.restore();
}

/**
 * B4. Cartoon Explosion: Comic bomb blast with outer spiky cloud and floating embers
 */
export function drawVfxCartoonExplosion(g, x, y, t, o = {}) {
  const { scale = 1.0, duration = 0.7, color = '#f97316', coreColor = '#fef08a', ink = '#1e293b' } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const expScale = scale * (0.5 + 0.8 * Math.sin(u * Math.PI * 0.7));
  const op = clamp(1.2 - u * 1.4, 0, 1);

  g.save();
  g.translate(x, y);
  g.scale(expScale, expScale);

  // 1. Spiky outer blast burst
  g.fillStyle = alpha(color, op);
  g.strokeStyle = alpha(ink, op);
  g.lineWidth = 3.6;
  g.beginPath();
  const pts = 14;
  for (let i = 0; i < pts * 2; i++) {
    const a = (i * Math.PI) / pts;
    const r = i % 2 === 0 ? 80 : 42;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.stroke();

  // 2. Yellow fiery core
  circle(g, 0, 0, 36 * (1 - u * 0.5), alpha(coreColor, op));
  ring(g, 0, 0, 36 * (1 - u * 0.5), 3.0, alpha(ink, op));

  // 3. Flying debris and embers
  for (let e = 0; e < 6; e++) {
    const eAng = (e * Math.PI * 2) / 6 + 0.2;
    const eDist = 95 * u;
    circle(g, Math.cos(eAng) * eDist, Math.sin(eAng) * eDist, 4 * (1 - u), alpha('#ef4444', op));
  }

  g.restore();
}

/**
 * B5. Speed Lines: Comic action horizontal speed streaks
 */
export function drawVfxSpeedLines(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 16, width = 400, height = 240, color = '#ffffff', speed = 2.5, seed = 52 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const u = ((t * speed + phi) % 1.0);
    const ly = -height / 2 + hashRNG(seed, i, 2) * height;
    const len = 60 + hashRNG(seed, i, 3) * 160;
    const lx = -width / 2 + u * (width + len);
    const strokeW = 1.5 + hashRNG(seed, i, 4) * 3.5;
    const op = Math.sin(u * Math.PI) * 0.75;

    g.strokeStyle = alpha(color, op);
    g.lineWidth = strokeW;
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(lx - len, ly);
    g.stroke();
  }
  g.restore();
}

/**
 * B6. Motion Trail: Semi-transparent after-image ghost silhouettes
 */
export function drawVfxMotionTrail(g, targetDrawFn, history = [], currentT = 0, o = {}) {
  const { trailCount = 3, interval = 0.06, baseAlpha = 0.3 } = o;
  g.save();
  for (let i = trailCount; i >= 1; i--) {
    const pastT = currentT - i * interval;
    const pastState = history.find(h => Math.abs(h.t - pastT) < 0.03);
    if (pastState && targetDrawFn) {
      g.save();
      g.globalAlpha = baseAlpha * (1 - i / (trailCount + 1));
      targetDrawFn(g, pastState);
      g.restore();
    }
  }
  g.restore();
}

/**
 * B7. Shockwave: Expanding elliptical shock ring on ground or air
 */
export function drawVfxShockwave(g, x, y, t, o = {}) {
  const { scale = 1.0, maxRadius = 120, duration = 0.6, color = '#67e8f9', ink = '#0891b2' } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const r = maxRadius * ease.out(u);
  const op = (1 - u);

  g.save();
  g.translate(x, y);
  g.scale(scale, scale * 0.45); // isometric/perspective ground ellipse

  g.strokeStyle = alpha(ink, op);
  g.lineWidth = 4.5 * (1 - u * 0.5);
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.stroke();

  g.strokeStyle = alpha(color, op * 0.7);
  g.lineWidth = 2.0;
  g.beginPath();
  g.arc(0, 0, Math.max(0, r - 8), 0, Math.PI * 2);
  g.stroke();

  g.restore();
}

/**
 * B8. Ground Dust: Puffs of dust kicking up behind feet as character moves
 */
export function drawVfxGroundDust(g, x, y, t, o = {}) {
  const { scale = 1.0, facing = 1, speed = 2.0, color = '#cbd5e1', seed = 61 } = o;
  g.save();
  g.translate(x, y);
  g.scale(facing * scale, scale);

  for (let i = 0; i < 4; i++) {
    const phi = (i * 0.25);
    const u = ((t * speed + phi) % 1.0);
    const px = -u * 40 - i * 6;
    const py = -u * 14 - Math.sin(u * Math.PI) * 12;
    const r = (6 + u * 12);
    const op = (1 - u);

    circle(g, px, py, r, alpha(color, op * 0.65));
    ring(g, px, py, r, 1.6, alpha('#64748b', op * 0.8));
  }
  g.restore();
}

/**
 * B9. Crash Stars: Multi-colored cartoon stars flying outward from impact
 */
export function drawVfxCrashStars(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 5, duration = 0.5, seed = 71 } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const op = (1 - u);

  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const ang = (i * Math.PI * 2) / count + hashRNG(seed, i, 1) * 0.5;
    const dist = u * 65 * (0.8 + 0.4 * hashRNG(seed, i, 2));
    const sx = Math.cos(ang) * dist;
    const sy = Math.sin(ang) * dist;
    const starColor = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981'][i % 4];

    g.save();
    g.translate(sx, sy);
    g.rotate(t * 8 + i);
    circle(g, 0, 0, 6 * (1 - u * 0.5), alpha(starColor, op));
    g.restore();
  }
  g.restore();
}

/**
 * B10. Smoke Puff: Single rapid "poof" cloud for appearance / vanishing
 */
export function drawVfxSmokePuff(g, x, y, t, o = {}) {
  const { scale = 1.0, duration = 0.5, color = '#f1f5f9', ink = '#64748b' } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const op = (1 - u);
  const r = 40 * (0.5 + 0.6 * ease.out(u));

  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let a = 0; a < 6; a++) {
    const ang = (a * Math.PI * 2) / 6;
    const px = Math.cos(ang) * r * 0.6;
    const py = Math.sin(ang) * r * 0.6;
    circle(g, px, py, r * 0.5, alpha(color, op));
    ring(g, px, py, r * 0.5, 2.0, alpha(ink, op));
  }
  circle(g, 0, 0, r * 0.5, alpha(color, op));

  g.restore();
}

/**
 * B11. Cartoon Tornado: Funnel cloud spinning with debris
 */
export function drawVfxCartoonTornado(g, x, y, t, o = {}) {
  const { scale = 1.0, height = 140, color = '#e2e8f0', ink = '#475569', speed = 3.0 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const ty = -i * (height / tiers);
    const tw = 18 + i * 16;
    const wobble = Math.sin(t * speed * 2 + i * 0.8) * (8 + i * 3);

    g.save();
    g.translate(wobble, ty);
    g.fillStyle = color;
    g.strokeStyle = ink;
    g.lineWidth = 2.4;
    g.beginPath();
    g.ellipse(0, 0, tw, 10 + i * 2, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.restore();
  }
  g.restore();
}

/**
 * B12. Comic Burst: Spiky comic speech / action blast bubble (POW / BAM)
 */
export function drawVfxComicBurst(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#fef08a', ink = '#1e293b', points = 16, radius = 60, text = '' } = o;
  const pulse = 1.0 + 0.06 * Math.sin(t * 12);

  g.save();
  g.translate(x, y);
  g.scale(scale * pulse, scale * pulse);

  g.fillStyle = color;
  g.strokeStyle = ink;
  g.lineWidth = 3.6;
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const ang = (i * Math.PI) / points;
    const r = i % 2 === 0 ? radius : radius * 0.6;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
  g.stroke();

  if (text) {
    g.font = '900 24px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#dc2626';
    g.strokeStyle = ink;
    g.lineWidth = 4;
    g.strokeText(text, 0, 0);
    g.fillText(text, 0, 0);
  }

  g.restore();
}

// ============================================================================
// 4. GROUP C — ENERGY EFFECTS (Auras, Rings, Electricity & Glows)
// ============================================================================

/**
 * C1. Golden Aura: Encompasses character with fiery golden corona & floating energy
 * Supports 'behind' layer (back glow + corona) and 'front' layer (floating motes & rim).
 */
export function drawVfxGoldenAura(g, x, y, t, o = {}, layer = 'behind') {
  const { scale = 1.0, color = '#fbbf24', coreColor = '#fef08a', speed = 2.0, count = 12, bounds = [-50, -160, 100, 170] } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  const [bx, by, bw, bh] = bounds;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  if (layer === 'behind') {
    // 1. Soft atmospheric back-glow
    glow(g, cx, cy, Math.max(bw, bh) * 0.95, color, 0.7);

    // 2. Rising jagged flame energy corona contour
    g.fillStyle = alpha(coreColor, 0.35);
    g.beginPath();
    const coronaPoints = 16;
    for (let i = 0; i <= coronaPoints; i++) {
      const u = i / coronaPoints;
      const ang = u * Math.PI * 2;
      const wave = Math.sin(t * speed * 4 + i * 2.2) * 14;
      const radX = (bw / 2 + 25) + wave;
      const radY = (bh / 2 + 20) + wave;
      const px = cx + Math.cos(ang) * radX;
      const py = cy + Math.sin(ang) * radY - Math.abs(Math.sin(ang)) * 12; // tendrils rise upwards
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  } else {
    // Front layer: rising sparks & front energy motes
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const phi = hashRNG(99, i, 1);
      const u = ((t * speed * 0.8 + phi) % 1.0);
      const px = cx + (hashRNG(99, i, 2) - 0.5) * bw * 1.1;
      const py = (by + bh) - u * (bh + 40);
      const r = 2.5 + hashRNG(99, i, 3) * 4.5;
      const op = Math.sin(u * Math.PI) * 0.9;

      glow(g, px, py, r * 2.5, color, op);
      circle(g, px, py, r, alpha('#ffffff', op));
    }
    g.restore();
  }

  g.restore();
}

/**
 * C2. Blue Aura: Mystic spiritual blue/cyan energy aura
 */
export function drawVfxBlueAura(g, x, y, t, o = {}, layer = 'behind') {
  return drawVfxGoldenAura(g, x, y, t, { ...o, color: '#38bdf8', coreColor: '#bae6fd' }, layer);
}

/**
 * C3. Red Aura: Fierce berserk crimson flame aura
 */
export function drawVfxRedAura(g, x, y, t, o = {}, layer = 'behind') {
  return drawVfxGoldenAura(g, x, y, t, { ...o, color: '#ef4444', coreColor: '#fca5a5' }, layer);
}

/**
 * C4. Energy Ring: Orbiting torus energy ring around character with true 3D depth wrapping
 */
export function drawVfxEnergyRing(g, x, y, t, o = {}, layer = 'behind') {
  const { scale = 1.0, rx = 65, ry = 22, tilt = -0.2, color = '#38bdf8', speed = 2.0 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.rotate(tilt);

  g.strokeStyle = color;
  g.lineWidth = 4.0;
  glow(g, 0, 0, rx * 1.2, color, 0.4);

  // Split into behind half (top arc) and front half (bottom arc)
  g.beginPath();
  if (layer === 'behind') {
    g.arc(0, 0, rx, Math.PI, 0, false); // top arc behind character
  } else {
    g.arc(0, 0, rx, 0, Math.PI, false); // bottom arc in front of character
  }
  g.stroke();

  // Highlight core
  g.strokeStyle = '#ffffff';
  g.lineWidth = 1.8;
  g.beginPath();
  if (layer === 'behind') {
    g.arc(0, 0, rx, Math.PI + 0.3, -0.3, false);
  } else {
    g.arc(0, 0, rx, 0.3, Math.PI - 0.3, false);
  }
  g.stroke();

  g.restore();
}

/**
 * C5. Lightning Energy: Branching electric arcs crackling across character
 */
export function drawVfxLightningEnergy(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#67e8f9', branches = 4, length = 70, seed = 88 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.strokeStyle = color;
  g.lineWidth = 2.4;
  g.lineCap = 'round';

  for (let b = 0; b < branches; b++) {
    const ang = (b * Math.PI * 2) / branches + hashRNG(seed, b, 1) * 0.8;
    let cx = 0, cy = 0;
    g.beginPath();
    g.moveTo(cx, cy);

    const segments = 4;
    for (let s = 1; s <= segments; s++) {
      const u = s / segments;
      const targetX = Math.cos(ang) * length * u;
      const targetY = Math.sin(ang) * length * u;
      const jitterX = (hashRNG(seed + Math.floor(t * 18), b * 10 + s, 2) - 0.5) * 22;
      const jitterY = (hashRNG(seed + Math.floor(t * 18), b * 10 + s, 3) - 0.5) * 22;
      cx = targetX + jitterX;
      cy = targetY + jitterY;
      g.lineTo(cx, cy);
    }
    g.stroke();
  }
  g.restore();
}

/**
 * C6. Body Glow: Soft diffused silhouette glow around figure
 */
export function drawVfxBodyGlow(g, x, y, t, o = {}) {
  const { scale = 1.0, color = '#fef08a', radius = 80, pulseSpeed = 2.0 } = o;
  const pulse = 1.0 + 0.15 * Math.sin(t * pulseSpeed * Math.PI * 2);
  g.save();
  glow(g, x, y, radius * scale * pulse, color, 0.65);
  g.restore();
}

/**
 * C7. Power Burst: Nova wave exploding outward from character chest
 */
export function drawVfxPowerBurst(g, x, y, t, o = {}) {
  const { scale = 1.0, duration = 0.5, color = '#facc15', maxRadius = 140 } = o;
  const u = clamp((t % duration) / duration, 0, 1);
  const r = maxRadius * ease.out(u);
  const op = (1 - u);

  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  glow(g, 0, 0, r * 1.2, color, op * 0.6);
  ring(g, 0, 0, r, 5.0 * (1 - u * 0.5), alpha(color, op));
  ring(g, 0, 0, Math.max(0, r - 12), 2.0, alpha('#ffffff', op));
  g.restore();
}

/**
 * C8. Sparkles: 4-pointed glitter glints twinkling around character
 */
export function drawVfxSparkles(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 6, color = '#ffffff', area = [-60, -120, 120, 140], seed = 91 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const u = ((t * 1.8 + phi) % 1.0);
    const sx = area[0] + hashRNG(seed, i, 2) * area[2];
    const sy = area[1] + hashRNG(seed, i, 3) * area[3];
    const sSize = 10 * Math.sin(u * Math.PI);

    if (sSize > 0.5) {
      g.save();
      g.translate(sx, sy);
      g.fillStyle = color;
      glow(g, 0, 0, sSize * 2, color, 0.7);

      // 4-point sparkle diamond
      g.beginPath();
      g.moveTo(0, -sSize);
      g.quadraticCurveTo(0, 0, sSize, 0);
      g.quadraticCurveTo(0, 0, 0, sSize);
      g.quadraticCurveTo(0, 0, -sSize, 0);
      g.quadraticCurveTo(0, 0, 0, -sSize);
      g.fill();
      g.restore();
    }
  }
  g.restore();
}

/**
 * C9. Magic Particles: Swirling mystical particle motes
 */
export function drawVfxMagicParticles(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 12, color = '#a855f7', radius = 60, speed = 1.5, seed = 94 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const ang = t * speed + (i * Math.PI * 2) / count;
    const r = radius * (0.6 + 0.4 * Math.sin(t * 3 + i));
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * (r * 0.6) - (i * 3);
    const pSize = 3 + 2 * Math.sin(t * 5 + i);

    glow(g, px, py, pSize * 2.5, color, 0.6);
    circle(g, px, py, pSize, '#ffffff');
  }
  g.restore();
}

/**
 * C10. Floating Energy: Soft plasma motes drifting upwards with wavy path
 */
export function drawVfxFloatingEnergy(g, x, y, t, o = {}) {
  const { scale = 1.0, count = 8, color = '#38bdf8', height = 120, speed = 1.2, seed = 97 } = o;
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const u = ((t * speed + phi) % 1.0);
    const px = (hashRNG(seed, i, 2) - 0.5) * 60 + Math.sin(t * 4 + i) * 10;
    const py = -u * height;
    const r = (3 + hashRNG(seed, i, 3) * 4) * Math.sin(u * Math.PI);

    glow(g, px, py, r * 3, color, 0.7);
    circle(g, px, py, r, '#ffffff');
  }
  g.restore();
}

// ============================================================================
// 5. GROUP D — SCENE EFFECTS (Screen Overlays, Flashes & Camera Transforms)
// ============================================================================

/**
 * D1. Camera Shake solver: High-frequency shake offsets for camera director
 */
export function solveVfxCameraShake(t, o = {}) {
  const { intensity = 1.0, frequency = 45, decay = 0 } = o;
  const shakeX = Math.sin(t * frequency) * 16 * intensity;
  const shakeY = Math.cos(t * (frequency * 0.85)) * 14 * intensity;
  return { x: shakeX, y: shakeY };
}

/**
 * D2. Screen Flash: Fullscreen blinding white or colored flash with smooth decay
 */
export function drawVfxScreenFlash(g, t, o = {}) {
  const { duration = 0.4, color = '#ffffff', intensity = 1.0, startTime = 0 } = o;
  const elapsed = Math.max(0, t - startTime);
  if (elapsed > duration) return;

  const u = elapsed / duration;
  const alphaVal = (1 - u * u) * intensity;
  const W = E.W || 1920, H = E.H || 1080;

  g.save();
  g.fillStyle = alpha(color, alphaVal);
  g.fillRect(0, 0, W, H);
  g.restore();
}

/**
 * D3. Vignette: Cinematic corner shadow falloff
 */
export function drawVfxVignette(g, t, o = {}) {
  const { darkness = 0.55, innerRadius = 0.35, outerRadius = 0.7 } = o;
  const W = E.W || 1920, H = E.H || 1080;
  const maxDim = Math.max(W, H);

  g.save();
  const grad = g.createRadialGradient(W / 2, H / 2, maxDim * innerRadius, W / 2, H / 2, maxDim * outerRadius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(0, 0, 0, ${darkness})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/**
 * D4. Focus Lines: Speed lines converging inward toward focal point
 */
export function drawVfxFocusLines(g, t, o = {}) {
  const { cx = (E.W || 1920) / 2, cy = (E.H || 1080) / 2, count = 48, innerR = 260, color = '#ffffff', opacity = 0.35, seed = 101 } = o;
  const W = E.W || 1920, H = E.H || 1080;
  const outerR = Math.sqrt(W * W + H * H) * 0.6;

  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const ang = (i * Math.PI * 2) / count + (hashRNG(seed, i, 1) - 0.5) * 0.05;
    const r0 = innerR + hashRNG(seed, i, 2) * 60 + Math.sin(t * 20 + i) * 20;
    const r1 = outerR;
    const strokeW = 1.2 + hashRNG(seed, i, 3) * 3.0;

    g.strokeStyle = alpha(color, opacity * (0.5 + 0.5 * hashRNG(seed, i, 4)));
    g.lineWidth = strokeW;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    g.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
    g.stroke();
  }
  g.restore();
}

/**
 * D5. Radial Speed Lines: Fast radial action burst lines from screen center
 */
export function drawVfxRadialSpeedLines(g, t, o = {}) {
  return drawVfxFocusLines(g, t, { ...o, count: 64, innerR: 180, opacity: 0.55 });
}

/**
 * D6. Fade In: Smooth fade in from black/white over specified duration
 */
export function drawVfxFadeIn(g, t, o = {}) {
  const { duration = 0.6, color = '#000000', startTime = 0 } = o;
  const elapsed = Math.max(0, t - startTime);
  if (elapsed >= duration) return;

  const u = elapsed / duration;
  const W = E.W || 1920, H = E.H || 1080;
  g.save();
  g.fillStyle = alpha(color, 1 - u);
  g.fillRect(0, 0, W, H);
  g.restore();
}

/**
 * D7. Fade Out: Smooth fade out to black/white
 */
export function drawVfxFadeOut(g, t, o = {}) {
  const { duration = 0.6, color = '#000000', startTime = 0, totalDuration = 10 } = o;
  const startFade = startTime > 0 ? startTime : (totalDuration - duration);
  if (t < startFade) return;

  const u = clamp((t - startFade) / duration, 0, 1);
  const W = E.W || 1920, H = E.H || 1080;
  g.save();
  g.fillStyle = alpha(color, u);
  g.fillRect(0, 0, W, H);
  g.restore();
}

/**
 * D8. Smoke Transition: Billowing smoke screen wipe
 */
export function drawVfxSmokeTransition(g, t, o = {}) {
  const { progress = 0.5, color = '#1e293b' } = o;
  const W = E.W || 1920, H = E.H || 1080;
  g.save();
  g.fillStyle = color;
  const coverY = H * (1 - progress);
  g.fillRect(0, coverY, W, H);
  g.restore();
}

/**
 * D9. White Flash Transition: Dramatic white blowout cut
 */
export function drawVfxWhiteFlashTransition(g, t, o = {}) {
  return drawVfxScreenFlash(g, t, { ...o, color: '#ffffff', duration: 0.5 });
}

/**
 * D10. Dark Overlay: Semi-transparent dark mood tint
 */
export function drawVfxDarkOverlay(g, t, o = {}) {
  const { opacity = 0.45, color = '#090d16' } = o;
  const W = E.W || 1920, H = E.H || 1080;
  g.save();
  g.fillStyle = alpha(color, opacity);
  g.fillRect(0, 0, W, H);
  g.restore();
}

// ============================================================================
// 6. GROUP E — WEATHER & ENVIRONMENT LIBRARY
// ============================================================================

/**
 * E1. Rain Engine: Light, moderate, heavy, wind-angled rain & ground splashes
 */
export function drawWeatherRain(g, t, o = {}) {
  const {
    intensity = 'moderate', // 'light' | 'moderate' | 'heavy'
    windAngle = 0.18, // radians slant
    color = '#bae6fd',
    alphaVal = 0.38,
    speed = 2200,
    len = 48,
    groundY = (E.H || 1080) * 0.85,
    seed = 105
  } = o;

  const countMap = { light: 140, moderate: 280, heavy: 520 };
  const count = typeof o.count === 'number' ? o.count : (countMap[intensity] || 280);
  const W = E.W || 1920, H = E.H || 1080;
  const dx = Math.sin(windAngle), dy = Math.cos(windAngle);

  g.save();
  g.strokeStyle = alpha(color, alphaVal);
  g.lineWidth = intensity === 'heavy' ? 2.0 : 1.3;
  g.lineCap = 'round';
  g.beginPath();

  for (let i = 0; i < count; i++) {
    const rx = hashRNG(seed, i, 1) * (W + 400) - 200;
    const sp = speed * (0.8 + 0.4 * hashRNG(seed, i, 2));
    const L = len * (0.7 + 0.6 * hashRNG(seed, i, 3));
    const ry = ((hashRNG(seed, i, 4) * (H + 100) + t * sp) % (H + 100)) - 50;
    const px = rx + (ry * dx);

    g.moveTo(px, ry);
    g.lineTo(px + dx * L, ry + dy * L);
  }
  g.stroke();

  // Ground splash ripples
  if (o.splash !== false && groundY > 0) {
    g.strokeStyle = alpha(color, alphaVal * 0.8);
    g.lineWidth = 1.4;
    const splashCount = Math.floor(count * 0.18);
    for (let s = 0; s < splashCount; s++) {
      const sx = hashRNG(seed + 99, s, 1) * W;
      const sy = groundY + hashRNG(seed + 99, s, 2) * 45;
      const u = ((t * 4.0 + hashRNG(seed + 99, s, 3)) % 1.0);
      const splashR = 3 + u * 12;

      g.beginPath();
      g.ellipse(sx, sy, splashR, splashR * 0.35, 0, 0, Math.PI * 2);
      g.stroke();
    }
  }

  g.restore();
}

/**
 * E2. Snow Engine: Light snow, heavy snow, wind drift & foreground/background flakes
 */
export function drawWeatherSnow(g, t, o = {}) {
  const {
    intensity = 'gentle', // 'gentle' | 'heavy' | 'wind'
    color = '#ffffff',
    speed = 70,
    wind = 40,
    seed = 111,
    layer = 'all' // 'background' | 'foreground' | 'all'
  } = o;

  const count = intensity === 'heavy' ? 320 : 160;
  const W = E.W || 1920, H = E.H || 1080;

  g.save();
  for (let i = 0; i < count; i++) {
    const isFg = hashRNG(seed, i, 1) > 0.75;
    if (layer === 'background' && isFg) continue;
    if (layer === 'foreground' && !isFg) continue;

    const s = 0.6 + hashRNG(seed, i, 2) * (isFg ? 2.2 : 1.2);
    const px = ((hashRNG(seed, i, 3) * W + t * wind * s + Math.sin(t * s + i) * 35) % (W + 60)) - 30;
    const py = ((hashRNG(seed, i, 4) * H + t * speed * s) % (H + 40)) - 20;
    const r = (isFg ? 3.5 : 1.8) * s;
    const op = isFg ? 0.9 : 0.65;

    circle(g, px, py, r, alpha(color, op));
  }
  g.restore();
}

/**
 * E3. Wind Engine: Animated wind streaks, flying leaves & blowing dust
 */
export function drawWeatherWind(g, t, o = {}) {
  const { count = 18, color = '#f1f5f9', speed = 650, seed = 117 } = o;
  const W = E.W || 1920, H = E.H || 1080;

  g.save();
  g.strokeStyle = alpha(color, 0.3);
  g.lineWidth = 1.8;
  g.lineCap = 'round';

  for (let i = 0; i < count; i++) {
    const u = ((t * (speed / W) + hashRNG(seed, i, 1)) % 1.0);
    const px = u * (W + 300) - 150;
    const py = hashRNG(seed, i, 2) * H;
    const len = 80 + hashRNG(seed, i, 3) * 160;
    const wave = Math.sin(u * 6 + i) * 14;

    g.beginPath();
    g.moveTo(px, py);
    g.quadraticCurveTo(px + len * 0.5, py + wave, px + len, py);
    g.stroke();
  }
  g.restore();
}

/**
 * E4. Sunshine Engine: Volumetric sun rays (god rays) and soft golden glow
 */
export function drawWeatherSunshine(g, t, o = {}) {
  const { count = 8, color = '#fef08a', angle = Math.PI * 0.35, spread = 0.8, len = 1600, alphaVal = 0.12, origin = [200, -100] } = o;
  const [ox, oy] = origin;

  g.save();
  g.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i++) {
    const ang = angle - spread / 2 + (spread * (i + 0.5)) / count + Math.sin(t * 0.4 + i) * 0.02;
    const w = 0.08 * (0.7 + ((i * 37) % 10) / 10);

    const grad = linGrad(g, ox, oy, ox + Math.cos(ang) * len, oy + Math.sin(ang) * len, [
      alpha(color, alphaVal),
      alpha(color, 0)
    ]);

    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(ox, oy);
    g.lineTo(ox + Math.cos(ang - w) * len, oy + Math.sin(ang - w) * len);
    g.lineTo(ox + Math.cos(ang + w) * len, oy + Math.sin(ang + w) * len);
    g.closePath();
    g.fill();
  }

  g.restore();
}

/**
 * E5. Fog Engine: Drifting horizontal mist layers and ground fog
 */
export function drawWeatherFog(g, t, o = {}) {
  const { color = '#cbd5e1', density = 0.35, y = (E.H || 1080) * 0.65, height = 260, speed = 25 } = o;
  const W = E.W || 1920;

  g.save();
  const grad = linGrad(g, 0, y, 0, y + height, [
    alpha(color, 0),
    alpha(color, density),
    alpha(color, 0)
  ]);

  g.fillStyle = grad;
  g.fillRect(-W * 0.2, y, W * 1.4, height);

  // Wavy drifting mist patches
  for (let p = 0; p < 4; p++) {
    const px = ((p * 500 + t * speed) % (W + 400)) - 200;
    const py = y + p * 35;
    g.fillStyle = alpha(color, density * 0.4);
    g.beginPath();
    g.ellipse(px, py, 220, 35, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * E6. Storm Engine: Heavy slanted rain, lightning flash & branching lightning bolts
 */
export function drawWeatherStorm(g, t, o = {}) {
  const { rainColor = '#93c5fd', lightning = true, seed = 125 } = o;
  // 1. Heavy wind-slanted rain
  drawWeatherRain(g, t, { intensity: 'heavy', windAngle: 0.35, color: rainColor, alphaVal: 0.55 });

  // 2. Intermittent lightning flash and branching bolt
  if (lightning) {
    const cycle = (t * 0.8) % 5.0; // flash every ~5s
    if (cycle < 0.22) {
      // Blinding white screen flash
      drawVfxScreenFlash(g, t, { duration: 0.22, color: '#e0e7ff', intensity: 0.65 });

      // Jagged bolt
      const W = E.W || 1920, H = E.H || 1080;
      g.save();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 4.0;
      glow(g, W * 0.55, H * 0.3, 140, '#a5b4fc', 0.8);

      let lx = W * 0.55, ly = 0;
      g.beginPath();
      g.moveTo(lx, ly);
      for (let step = 0; step < 8; step++) {
        lx += (hashRNG(seed, step, 1) - 0.45) * 120;
        ly += (H * 0.6) / 8;
        g.lineTo(lx, ly);
      }
      g.stroke();
      g.restore();
    }
  }
}

/**
 * E7. Falling Leaves: Autumn maple/oak leaves tumbling down
 */
export function drawEnvLeaves(g, t, o = {}) {
  const { count = 24, colors = ['#f97316', '#ea580c', '#eab308'], speed = 80, seed = 131 } = o;
  const W = E.W || 1920, H = E.H || 1080;

  g.save();
  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const u = ((t * (speed / H) + phi) % 1.0);
    const px = ((hashRNG(seed, i, 2) * W + Math.sin(t * 2 + i) * 60) % W);
    const py = u * (H + 40) - 20;
    const leafColor = colors[i % colors.length];
    const rot = t * 3 + i;

    g.save();
    g.translate(px, py);
    g.rotate(rot);
    g.scale(0.8, 1.4);
    circle(g, 0, 0, 7, leafColor);
    g.restore();
  }
  g.restore();
}

/**
 * E8. Floating Flower Petals: Cherry blossom sakura petals
 */
export function drawEnvPetals(g, t, o = {}) {
  return drawEnvLeaves(g, t, { ...o, colors: ['#fbcfe8', '#f472b6', '#fda4af'], count: 32, speed: 60 });
}

/**
 * E9. Ambient Dust Motes: Floating dust motes in sunbeam or indoor light
 */
export function drawEnvDustMotes(g, t, o = {}) {
  const { count = 45, color = '#fef08a', area = [0, 0, E.W || 1920, E.H || 1080], seed = 137 } = o;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const s = 0.5 + hashRNG(seed, i, 1) * 1.2;
    const px = area[0] + ((hashRNG(seed, i, 2) * area[2] + Math.sin(t * 0.5 + i) * 20) % area[2]);
    const py = area[1] + ((hashRNG(seed, i, 3) * area[3] - t * 15 * s + area[3]) % area[3]);
    const op = 0.45 * (0.4 + 0.6 * Math.sin(t * 2 + i));

    glow(g, px, py, 6 * s, color, op);
    circle(g, px, py, 1.5 * s, alpha(color, op));
  }
  g.restore();
}

/**
 * E10. Drifting Clouds: Soft cartoon cloud puffs
 */
export function drawEnvClouds(g, t, o = {}) {
  const { count = 5, y = (E.H || 1080) * 0.18, color = '#ffffff', opacity = 0.35, speed = 18, seed = 143 } = o;
  const W = E.W || 1920;

  g.save();
  for (let i = 0; i < count; i++) {
    const cx = ((hashRNG(seed, i, 1) * W + t * speed * (0.8 + 0.4 * hashRNG(seed, i, 2))) % (W + 600)) - 300;
    const cy = y + hashRNG(seed, i, 3) * 60;
    const cw = 140 + hashRNG(seed, i, 4) * 180;

    g.fillStyle = alpha(color, opacity);
    g.beginPath();
    g.ellipse(cx, cy, cw, 28, 0, 0, Math.PI * 2);
    g.ellipse(cx + 35, cy - 12, cw * 0.6, 26, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/**
 * E11. Fireflies: Glowing yellow-green motes pulsing in the dark
 */
export function drawEnvFireflies(g, t, o = {}) {
  const { count = 18, color = '#a3e635', area = [0, 0, E.W || 1920, E.H || 1080], seed = 149 } = o;
  g.save();
  g.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i++) {
    const px = area[0] + hashRNG(seed, i, 1) * area[2] + Math.sin(t * 0.8 + i) * 35;
    const py = area[1] + hashRNG(seed, i, 2) * area[3] + Math.cos(t * 0.6 + i) * 25;
    const pulse = Math.max(0, Math.sin(t * 3.5 + i * 1.5));

    if (pulse > 0.05) {
      glow(g, px, py, 18 * pulse, color, 0.8);
      circle(g, px, py, 2.8 * pulse, '#ffffff');
    }
  }
  g.restore();
}

/**
 * E12. Floating Bubbles: Transparent shiny bubbles with specular sheen
 */
export function drawEnvBubbles(g, t, o = {}) {
  const { count = 16, color = '#bae6fd', speed = 55, seed = 153 } = o;
  const W = E.W || 1920, H = E.H || 1080;

  g.save();
  for (let i = 0; i < count; i++) {
    const phi = hashRNG(seed, i, 1);
    const u = ((t * (speed / H) + phi) % 1.0);
    const px = ((hashRNG(seed, i, 2) * W + Math.sin(t * 1.5 + i) * 25) % W);
    const py = H - u * (H + 40);
    const r = 8 + hashRNG(seed, i, 3) * 14;

    // Bubble rim
    ring(g, px, py, r, 1.8, alpha(color, 0.6));
    // Specular highlight
    circle(g, px - r * 0.35, py - r * 0.35, r * 0.25, 'rgba(255, 255, 255, 0.85)');
  }
  g.restore();
}

// ============================================================================
// 7. EFFECT ATTACHMENT SOLVER & SPEC NORMALIZER
// ============================================================================

/**
 * Resolves attachment target coordinates on character skeleton or scene
 */
export function solveEffectAttachment(spec, characterState = null, sceneCam = null) {
  const attachment = spec.attachment || 'head';
  const offsetX = spec.offsetX || 0;
  const offsetY = spec.offsetY || 0;
  const followRotation = spec.followRotation !== false;
  const followScale = spec.followScale !== false;

  let x = spec.x ?? (characterState ? characterState.x : (E.W || 1920) / 2);
  let y = spec.y ?? (characterState ? characterState.y : (E.H || 1080) / 2);
  let rot = spec.rotation || 0;
  let scale = spec.scale || 1.0;
  let facing = characterState?.facing ?? 1;

  if (characterState && characterState.pose) {
    const p = characterState.pose;
    const charS = characterState.s || 1.0;
    const charX = characterState.x || 0;
    const charY = characterState.y || 0;
    facing = characterState.facing ?? 1;

    let bonePos = [0, 0];
    switch (attachment) {
      case 'head':
      case 'face':
        bonePos = p.head || [0, -115];
        break;
      case 'left_hand':
        bonePos = (facing > 0 ? p.hB : p.hF) || [-20, -50];
        break;
      case 'right_hand':
        bonePos = (facing > 0 ? p.hF : p.hB) || [20, -50];
        break;
      case 'chest':
        bonePos = [p.sh[0] * 0.5 + p.hip[0] * 0.5, p.sh[1] * 0.5 + p.hip[1] * 0.5];
        break;
      case 'body_center':
      case 'character_bounds':
        bonePos = p.hip || [0, -45];
        break;
      case 'feet':
        bonePos = [(p.fF[0] + p.fB[0]) / 2, Math.max(p.fF[1], p.fB[1])];
        break;
      case 'prop':
        bonePos = characterState.propHandPos || p.hF || [20, -50];
        break;
      case 'world':
      case 'screen':
      default:
        bonePos = [0, 0];
        break;
    }

    if (attachment !== 'world' && attachment !== 'screen') {
      x = charX + bonePos[0] * facing * charS + offsetX * facing * charS;
      y = charY + bonePos[1] * charS + offsetY * charS;
      if (followScale) scale *= charS;
      if (followRotation && characterState.rot) rot += characterState.rot;
    }
  }

  return { x, y, scale, rotation: rot, facing, attachment };
}

/**
 * Normalizes user / story JSON effect spec into standard schema
 */
export function normalizeVfxSpec(raw) {
  if (typeof raw === 'string') {
    return { id: raw, type: raw, layer: 'front_character', startTime: 0, duration: 999 };
  }
  return {
    instanceId: raw.instanceId || `vfx_${Math.random().toString(36).slice(2, 8)}`,
    assetId: raw.assetId || raw.id || raw.type || 'vfx_sweat_drop',
    type: raw.type || raw.assetId || 'vfx_sweat_drop',
    targetId: raw.targetId || null,
    attachment: raw.attachment || 'head',
    layer: raw.layer || 'front_character', // 'background' | 'behind_character' | 'character' | 'front_character' | 'foreground' | 'screen_overlay'
    startTime: raw.startTime ?? 0,
    endTime: raw.endTime ?? (raw.startTime != null && raw.duration != null ? raw.startTime + raw.duration : 999),
    duration: raw.duration ?? (raw.endTime != null && raw.startTime != null ? raw.endTime - raw.startTime : 999),
    x: raw.x ?? null,
    y: raw.y ?? null,
    offsetX: raw.offsetX || 0,
    offsetY: raw.offsetY || 0,
    scale: raw.scale ?? 1.0,
    rotation: raw.rotation || 0,
    opacity: raw.opacity ?? 1.0,
    speed: raw.speed ?? 1.0,
    intensity: raw.intensity ?? 1.0,
    color: raw.color || null,
    loop: raw.loop !== false,
    seed: raw.seed || 42,
    params: raw.params || {}
  };
}

// ============================================================================
// 8. SPRITE SHEET & EXTERNAL MEDIA ANIMATOR
// ============================================================================

const VFX_TEXTURE_CACHE = new Map();

export function getCachedVfxImage(url) {
  if (!url || typeof document === 'undefined') return null;
  if (VFX_TEXTURE_CACHE.has(url)) return VFX_TEXTURE_CACHE.get(url);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  VFX_TEXTURE_CACHE.set(url, img);
  return img;
}

/**
 * Draws external sprite sheet animation frame
 */
export function drawVfxSpriteSheet(g, img, spec, t, o = {}) {
  const {
    rows = 1,
    cols = 1,
    frameCount = rows * cols,
    fps = 12,
    loop = true,
    startFrame = 0,
    endFrame = frameCount - 1,
    scale = 1.0,
    x = 0,
    y = 0
  } = spec;

  const totalF = Math.max(1, endFrame - startFrame + 1);
  let curIndex = Math.floor(t * fps);
  if (loop) {
    curIndex = startFrame + (curIndex % totalF);
  } else {
    curIndex = Math.min(endFrame, startFrame + curIndex);
  }

  const col = curIndex % cols;
  const row = Math.floor(curIndex / cols);

  if (img && img.complete && img.naturalWidth > 0) {
    const fw = img.naturalWidth / cols;
    const fh = img.naturalHeight / rows;
    const dw = fw * scale;
    const dh = fh * scale;

    g.drawImage(img, col * fw, row * fh, fw, fh, x - dw / 2, y - dh / 2, dw, dh);
  } else {
    // Procedural placeholder if texture is loading
    circle(g, x, y, 20 * scale, 'rgba(56, 189, 248, 0.4)');
  }
}

// ============================================================================
// 9. UNIVERSAL VFX DISPATCHER (All 4 Groups + Weather)
// ============================================================================

export const VFX_DISPATCHER = {
  // A. Emotion Effects
  sweat_drop: drawVfxSweatDrop,
  vfx_sweat_drop: drawVfxSweatDrop,
  anger_symbol: drawVfxAngerSymbol,
  vfx_anger_symbol: drawVfxAngerSymbol,
  vfx_anger_mark: drawVfxAngerSymbol,
  anger_smoke: drawVfxAngerSmoke,
  vfx_anger_smoke: drawVfxAngerSmoke,
  question_mark: drawVfxQuestionMark,
  vfx_question_mark: drawVfxQuestionMark,
  exclamation_mark: drawVfxExclamationMark,
  vfx_exclamation_mark: drawVfxExclamationMark,
  love_hearts: drawVfxLoveHearts,
  vfx_love_hearts: drawVfxLoveHearts,
  cartoon_tears: drawVfxCartoonTears,
  vfx_cartoon_tears: drawVfxCartoonTears,
  dizzy_stars: drawVfxDizzyStars,
  vfx_dizzy_stars: drawVfxDizzyStars,
  embarrassment_lines: drawVfxEmbarrassmentLines,
  vfx_embarrassment_lines: drawVfxEmbarrassmentLines,
  shock_lines: drawVfxShockLines,
  vfx_shock_lines: drawVfxShockLines,
  dark_gloom: drawVfxDarkGloom,
  vfx_dark_gloom: drawVfxDarkGloom,
  idea_bulb: drawVfxIdeaBulb,
  vfx_idea_bulb: drawVfxIdeaBulb,

  // B. Action Effects
  dust_cloud: drawVfxDustCloud,
  vfx_dust_cloud: drawVfxDustCloud,
  fight_smoke: drawVfxFightSmoke,
  vfx_fight_smoke: drawVfxFightSmoke,
  impact_flash: drawVfxImpactFlash,
  vfx_impact_flash: drawVfxImpactFlash,
  cartoon_explosion: drawVfxCartoonExplosion,
  vfx_cartoon_explosion: drawVfxCartoonExplosion,
  speed_lines: drawVfxSpeedLines,
  vfx_speed_lines: drawVfxSpeedLines,
  shockwave: drawVfxShockwave,
  vfx_shockwave: drawVfxShockwave,
  ground_dust: drawVfxGroundDust,
  vfx_ground_dust: drawVfxGroundDust,
  crash_stars: drawVfxCrashStars,
  vfx_crash_stars: drawVfxCrashStars,
  smoke_puff: drawVfxSmokePuff,
  vfx_smoke_puff: drawVfxSmokePuff,
  cartoon_tornado: drawVfxCartoonTornado,
  vfx_cartoon_tornado: drawVfxCartoonTornado,
  comic_burst: drawVfxComicBurst,
  vfx_comic_burst: drawVfxComicBurst,

  // C. Energy Effects
  golden_aura: drawVfxGoldenAura,
  vfx_golden_aura: drawVfxGoldenAura,
  blue_aura: drawVfxBlueAura,
  vfx_blue_aura: drawVfxBlueAura,
  red_aura: drawVfxRedAura,
  vfx_red_aura: drawVfxRedAura,
  energy_ring: drawVfxEnergyRing,
  vfx_energy_ring: drawVfxEnergyRing,
  lightning_energy: drawVfxLightningEnergy,
  vfx_lightning_energy: drawVfxLightningEnergy,
  body_glow: drawVfxBodyGlow,
  vfx_body_glow: drawVfxBodyGlow,
  power_burst: drawVfxPowerBurst,
  vfx_power_burst: drawVfxPowerBurst,
  sparkles: drawVfxSparkles,
  vfx_sparkles: drawVfxSparkles,
  magic_particles: drawVfxMagicParticles,
  vfx_magic_particles: drawVfxMagicParticles,
  floating_energy: drawVfxFloatingEnergy,
  vfx_floating_energy: drawVfxFloatingEnergy,

  // D. Scene Effects
  camera_shake: solveVfxCameraShake,
  vfx_camera_shake: solveVfxCameraShake,
  screen_flash: drawVfxScreenFlash,
  vfx_screen_flash: drawVfxScreenFlash,
  vignette: drawVfxVignette,
  vfx_vignette: drawVfxVignette,
  focus_lines: drawVfxFocusLines,
  vfx_focus_lines: drawVfxFocusLines,
  radial_speed_lines: drawVfxRadialSpeedLines,
  vfx_radial_speed_lines: drawVfxRadialSpeedLines,
  fade_in: drawVfxFadeIn,
  vfx_fade_in: drawVfxFadeIn,
  fade_out: drawVfxFadeOut,
  vfx_fade_out: drawVfxFadeOut,
  smoke_transition: drawVfxSmokeTransition,
  vfx_smoke_transition: drawVfxSmokeTransition,
  white_flash_transition: drawVfxWhiteFlashTransition,
  vfx_white_flash_transition: drawVfxWhiteFlashTransition,
  dark_overlay: drawVfxDarkOverlay,
  vfx_dark_overlay: drawVfxDarkOverlay,

  // E. Weather & Environment
  rain: drawWeatherRain,
  weather_rain: drawWeatherRain,
  weather_rain_cinematic: drawWeatherRain,
  weather_rain_heavy: (g, t, o) => drawWeatherRain(g, t, { ...o, intensity: 'heavy' }),
  snow: drawWeatherSnow,
  weather_snow: drawWeatherSnow,
  weather_snow_gentle: drawWeatherSnow,
  wind: drawWeatherWind,
  weather_wind: drawWeatherWind,
  weather_wind_breeze: drawWeatherWind,
  sunshine: drawWeatherSunshine,
  weather_sunshine: drawWeatherSunshine,
  weather_sunshine_rays: drawWeatherSunshine,
  fog: drawWeatherFog,
  weather_fog: drawWeatherFog,
  weather_fog_mystic: drawWeatherFog,
  storm: drawWeatherStorm,
  weather_storm: drawWeatherStorm,
  weather_storm_thunder: drawWeatherStorm,
  env_leaves: drawEnvLeaves,
  weather_env_leaves: drawEnvLeaves,
  env_petals: drawEnvPetals,
  weather_env_petals: drawEnvPetals,
  env_dust_motes: drawEnvDustMotes,
  weather_env_dust_motes: drawEnvDustMotes,
  env_clouds: drawEnvClouds,
  weather_env_clouds: drawEnvClouds,
  env_fireflies: drawEnvFireflies,
  weather_env_fireflies: drawEnvFireflies,
  env_bubbles: drawEnvBubbles,
  weather_env_bubbles: drawEnvBubbles
};

/**
 * Universal Draw Function: executes any VFX by key or spec
 */
export function drawUniversalVfx(g, rawSpec, t, context = {}) {
  const spec = normalizeVfxSpec(rawSpec);
  if (t < spec.startTime || t > spec.endTime) return;

  const fn = VFX_DISPATCHER[spec.type] || VFX_DISPATCHER[spec.assetId];
  if (!fn) return;

  // If scene effect camera shake, apply transform
  if (spec.type === 'camera_shake' || spec.type === 'vfx_camera_shake') {
    const shake = solveVfxCameraShake(t, spec);
    if (context.camera) {
      context.camera.x += shake.x;
      context.camera.y += shake.y;
    }
    return;
  }

  // Resolve position
  const resolved = solveEffectAttachment(spec, context.character, context.camera);
  const opts = {
    ...spec,
    ...spec.params,
    scale: resolved.scale,
    rotation: resolved.rotation,
    facing: resolved.facing,
    color: spec.color || spec.params?.color,
    t
  };

  g.save();
  if (spec.opacity < 1.0) g.globalAlpha *= spec.opacity;

  // For energy auras and rings supporting layered dual rendering
  const layer = context.currentLayer || spec.layer || 'front_character';
  fn(g, resolved.x, resolved.y, t, opts, layer);
  g.restore();
}
