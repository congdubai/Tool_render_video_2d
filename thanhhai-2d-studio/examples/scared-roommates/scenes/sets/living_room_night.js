// scenes/sets/living_room_night.js — Multi-layered night living room set matching reference
import { E, V, circle, ring, rr, poly, seg, shade, alpha, linGrad } from '/engine/core.js';

export function livingRoomNight(g, t, cam = { z: 1, x: 0, y: 0 }, opts = {}) {
  const W = E.W || 1920, H = E.H || 1080;
  const GY = H * 0.78; // Floor ground level

  g.save();
  // Camera transform
  g.translate(W / 2 + (cam.x || 0), H / 2 + (cam.y || 0));
  g.scale(cam.z || 1, cam.z || 1);
  g.translate(-W / 2, -H / 2);

  // 1. Back Wall — moody slate purple/blue
  const wallGrad = g.createLinearGradient(0, 0, 0, H);
  wallGrad.addColorStop(0, '#1c1b2c');
  wallGrad.addColorStop(0.65, '#262438');
  wallGrad.addColorStop(1, '#1a1928');
  g.fillStyle = wallGrad;
  g.fillRect(0, 0, W, H);

  // Subtle vertical wallpaper stripes
  g.fillStyle = 'rgba(255, 255, 255, 0.015)';
  for (let x = 0; x < W; x += 36) {
    g.fillRect(x, 0, 18, GY);
  }

  // Wooden Baseboard / Skirting board
  g.fillStyle = '#161420';
  g.fillRect(0, GY - 16, W, 16);
  g.fillStyle = '#221e30';
  g.fillRect(0, GY - 16, W, 3);

  // Wooden Floorboards
  const floorGrad = g.createLinearGradient(0, GY, 0, H);
  floorGrad.addColorStop(0, '#1f1b26');
  floorGrad.addColorStop(1, '#121017');
  g.fillStyle = floorGrad;
  g.fillRect(0, GY, W, H - GY);

  // Floor plank lines
  g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  g.lineWidth = 2;
  for (let y = GY + 45; y < H; y += 50) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }

  // 2. Wall Art (Mountain landscape above sofa)
  const fx = W * 0.35, fy = H * 0.22, fw = 220, fh = 140;
  // Outer wooden frame
  g.fillStyle = '#543d2b';
  rr(g, fx - fw / 2 - 8, fy - fh / 2 - 8, fw + 16, fh + 16, 6);
  g.fill();
  g.fillStyle = '#7a5a40';
  rr(g, fx - fw / 2 - 4, fy - fh / 2 - 4, fw + 8, fh + 8, 4);
  g.fill();
  // Frame inner shadow
  g.fillStyle = '#11131a';
  g.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
  // Landscape canvas
  g.save();
  g.beginPath();
  g.rect(fx - fw / 2, fy - fh / 2, fw, fh);
  g.clip();
  // Sky
  const artSky = g.createLinearGradient(0, fy - fh / 2, 0, fy + fh / 2);
  artSky.addColorStop(0, '#5a6b82');
  artSky.addColorStop(0.6, '#b88470');
  artSky.addColorStop(1, '#cca578');
  g.fillStyle = artSky;
  g.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
  // Sun/Moon
  circle(g, fx + 30, fy - 15, 16, '#ffe6b3');
  // Mountains
  poly(g, [[fx - fw / 2, fy + fh / 2], [fx - 50, fy - 10], [fx + 10, fy + fh / 2]], '#484059');
  poly(g, [[fx - 20, fy + fh / 2], [fx + 40, fy + 5], [fx + fw / 2, fy + fh / 2]], '#322d42');
  poly(g, [[fx - fw / 2, fy + fh / 2], [fx + 10, fy + 35], [fx + fw / 2, fy + fh / 2]], '#221f2f');
  g.restore();

  // 3. Right Window with Moon & Starry Night Sky
  const wx = W * 0.85, wy = H * 0.36, ww = 320, wh = 420;
  // Window frame outer
  g.fillStyle = '#161424';
  rr(g, wx - ww / 2 - 12, wy - wh / 2 - 12, ww + 24, wh + 24, 8);
  g.fill();

  // Night Sky inside window
  g.save();
  g.beginPath();
  rr(g, wx - ww / 2, wy - wh / 2, ww, wh, 4);
  g.clip();
  const skyGrad = g.createLinearGradient(0, wy - wh / 2, 0, wy + wh / 2);
  skyGrad.addColorStop(0, '#0c152e');
  skyGrad.addColorStop(0.7, '#182b52');
  skyGrad.addColorStop(1, '#1b2342');
  g.fillStyle = skyGrad;
  g.fillRect(wx - ww / 2, wy - wh / 2, ww, wh);

  // Stars
  const stars = [
    [-80, -120], [-40, -150], [60, -130], [100, -80],
    [-110, -40], [120, -30], [-30, 20], [80, 50]
  ];
  g.fillStyle = '#ffffff';
  for (const [sx, sy] of stars) {
    const starAlpha = 0.5 + 0.4 * Math.sin(t * 3 + sx);
    g.globalAlpha = starAlpha;
    circle(g, wx + sx, wy + sy, 1.8, '#ffffff');
  }
  g.globalAlpha = 1;

  // Full Moon
  const mx = wx + 75, my = wy - 100, mr = 48;
  // Moon glow
  const moonGlow = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 2.8);
  moonGlow.addColorStop(0, 'rgba(235, 245, 255, 0.45)');
  moonGlow.addColorStop(0.5, 'rgba(180, 210, 255, 0.12)');
  moonGlow.addColorStop(1, 'rgba(180, 210, 255, 0)');
  g.fillStyle = moonGlow;
  circle(g, mx, my, mr * 2.8);

  // Moon sphere
  circle(g, mx, my, mr, '#f0f5ff');
  // Moon subtle craters
  circle(g, mx - 12, my - 10, 10, '#d9e2f5');
  circle(g, mx + 16, my + 8, 14, '#dbe5f7');
  circle(g, mx + 2, my + 18, 8, '#d4e0f5');

  // Midnight clouds passing moon
  g.fillStyle = 'rgba(26, 42, 74, 0.65)';
  g.beginPath();
  g.ellipse(mx - 30 + Math.sin(t * 0.2) * 8, my + 25, 70, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // Window Panes divider
  g.fillStyle = '#161424';
  g.fillRect(wx - 4, wy - wh / 2, 8, wh); // Vertical
  g.fillRect(wx - ww / 2, wy - 30, ww, 8); // Horizontal

  // Curtains on sides
  // Left curtain
  g.fillStyle = '#22263d';
  g.beginPath();
  g.moveTo(wx - ww / 2 - 16, wy - wh / 2 - 20);
  g.lineTo(wx - ww / 2 + 35, wy - wh / 2 - 20);
  g.bezierCurveTo(wx - ww / 2 + 25, wy, wx - ww / 2 + 45, wy + wh / 2, wx - ww / 2 + 10, wy + wh / 2 + 40);
  g.lineTo(wx - ww / 2 - 26, wy + wh / 2 + 40);
  g.closePath();
  g.fill();

  // Right curtain
  g.beginPath();
  g.moveTo(wx + ww / 2 + 26, wy - wh / 2 - 20);
  g.lineTo(wx + ww / 2 - 35, wy - wh / 2 - 20);
  g.bezierCurveTo(wx + ww / 2 - 25, wy, wx + ww / 2 - 45, wy + wh / 2, wx + ww / 2 - 10, wy + wh / 2 + 40);
  g.lineTo(wx + ww / 2 + 26, wy + wh / 2 + 40);
  g.closePath();
  g.fill();

  // Window Sill
  g.fillStyle = '#28243a';
  rr(g, wx - ww / 2 - 20, wy + wh / 2 + 8, ww + 40, 18, 4);
  g.fill();

  // Wooden cabinet below window
  const cabX = wx, cabY = GY - 80, cabW = 280, cabH = 160;
  g.fillStyle = '#422c1d';
  rr(g, cabX - cabW / 2, cabY, cabW, cabH, 6);
  g.fill();
  g.fillStyle = '#563a27';
  rr(g, cabX - cabW / 2 - 6, cabY - 10, cabW + 12, 14, 4);
  g.fill();

  // Plant on cabinet
  drawPottedPlant(g, cabX - 60, cabY - 10, 0.85);

  // 4. Left Bookshelf with Plants, Books & Cute Mini Ghost
  const bsX = W * 0.12, bsY = H * 0.12, bsW = 190, bsH = 500;
  // Shelves uprights
  g.fillStyle = '#523724';
  g.fillRect(bsX - bsW / 2, bsY, 14, bsH);
  g.fillRect(bsX + bsW / 2 - 14, bsY, 14, bsH);

  // 3 shelves horizontal
  const shelfHeights = [bsY + 110, bsY + 260, bsY + 410];
  for (const sy of shelfHeights) {
    g.fillStyle = '#6b472f';
    rr(g, bsX - bsW / 2 - 6, sy, bsW + 12, 14, 3);
    g.fill();
  }

  // Top shelf: Books & Potted Ivy
  drawBooks(g, bsX - 45, shelfHeights[0], 4, ['#823935', '#485d78', '#a8783e', '#396b58']);
  drawHangingIvy(g, bsX + 45, shelfHeights[0]);

  // Middle shelf: Books & Easter Egg Mini Ghost!
  drawBooks(g, bsX - 50, shelfHeights[1], 3, ['#435570', '#8c4840', '#3b6e5e']);
  // Cute Mini Ghost Figurine on shelf (just like reference image!)
  drawMiniGhostFigurine(g, bsX + 40, shelfHeights[1] - 4);

  // Bottom shelf: Books stacked horizontally and vertically
  drawBooks(g, bsX - 40, shelfHeights[2], 5, ['#36485e', '#783832', '#966d33', '#315c4d', '#583c6b']);

  // 5. Warm Floor Lamp on End Table (Left side, illuminates roommates)
  const lampX = W * 0.22, lampY = GY - 20;
  // Small end table
  g.fillStyle = '#3d281a';
  rr(g, lampX - 50, lampY - 80, 100, 80, 5);
  g.fill();
  g.fillStyle = '#543724';
  rr(g, lampX - 56, lampY - 88, 112, 12, 4);
  g.fill();
  // Potted plant on side table next to lamp
  drawPottedPlant(g, lampX - 35, lampY - 88, 0.65);

  // Lamp base and pole
  g.fillStyle = '#9e7b45';
  g.fillRect(lampX + 16, lampY - 240, 8, 154);
  circle(g, lampX + 20, lampY - 86, 16, '#bfa05d');

  // Lampshade (bell/cone shape)
  const shadeX = lampX + 20, shadeY = lampY - 250;
  g.fillStyle = '#fff3cf';
  g.beginPath();
  g.moveTo(shadeX - 35, shadeY + 50);
  g.lineTo(shadeX - 22, shadeY);
  g.lineTo(shadeX + 22, shadeY);
  g.lineTo(shadeX + 35, shadeY + 50);
  g.closePath();
  g.fill();
  g.strokeStyle = '#e6c88a';
  g.lineWidth = 3;
  g.stroke();

  // Warm Lamp Glow Cone (Subtle warm amber lighting on living room)
  g.save();
  g.globalCompositeOperation = 'screen';
  const warmGlow = g.createRadialGradient(shadeX, shadeY + 25, 20, shadeX, shadeY + 50, 480);
  warmGlow.addColorStop(0, 'rgba(255, 220, 130, 0.45)');
  warmGlow.addColorStop(0.3, 'rgba(255, 200, 100, 0.22)');
  warmGlow.addColorStop(0.7, 'rgba(255, 170, 70, 0.08)');
  warmGlow.addColorStop(1, 'rgba(255, 170, 70, 0)');
  g.fillStyle = warmGlow;
  g.beginPath();
  g.moveTo(shadeX, shadeY);
  g.lineTo(shadeX - 380, GY + 40);
  g.lineTo(shadeX + 520, GY + 40);
  g.closePath();
  g.fill();
  g.restore();

  // 6. Sofa Structure (Backrest and Armrests)
  const sofaX = W * 0.52, sofaY = GY - 20, sofaW = 760, sofaH = 260;
  // Sofa drop shadow on floor
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.beginPath();
  g.ellipse(sofaX, GY + 8, sofaW * 0.54, 30, 0, 0, Math.PI * 2);
  g.fill();

  // Sofa Backrest
  g.fillStyle = '#2f354a';
  rr(g, sofaX - sofaW / 2 + 40, sofaY - sofaH + 30, sofaW - 80, sofaH - 30, 24);
  g.fill();
  g.fillStyle = '#3a425c';
  rr(g, sofaX - sofaW / 2 + 46, sofaY - sofaH + 36, sofaW - 92, sofaH - 42, 20);
  g.fill();

  // Back cushion seams
  g.strokeStyle = '#282d40';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(sofaX, sofaY - sofaH + 40);
  g.lineTo(sofaX, sofaY - 40);
  g.stroke();

  // Left Armrest
  g.fillStyle = '#2a3044';
  rr(g, sofaX - sofaW / 2, sofaY - 160, 80, 160, 20);
  g.fill();
  g.fillStyle = '#353c54';
  rr(g, sofaX - sofaW / 2 + 5, sofaY - 155, 70, 150, 16);
  g.fill();

  // Right Armrest
  g.fillStyle = '#2a3044';
  rr(g, sofaX + sofaW / 2 - 80, sofaY - 160, 80, 160, 20);
  g.fill();
  g.fillStyle = '#353c54';
  rr(g, sofaX + sofaW / 2 - 75, sofaY - 155, 70, 150, 16);
  g.fill();

  // Warm Yellow Throw Pillow on Left (Matching reference image)
  g.save();
  g.translate(sofaX - sofaW / 2 + 100, sofaY - 110);
  g.rotate(-0.15);
  g.fillStyle = '#c9942a';
  rr(g, -40, -40, 80, 80, 16);
  g.fill();
  g.fillStyle = '#e0ab3b';
  rr(g, -35, -35, 70, 70, 12);
  g.fill();
  g.restore();

  // Dark Teal Throw Pillow on Right
  g.save();
  g.translate(sofaX + sofaW / 2 - 105, sofaY - 100);
  g.rotate(0.12);
  g.fillStyle = '#274b52';
  rr(g, -35, -35, 70, 70, 14);
  g.fill();
  g.restore();

  // Sofa Seat Cushions base
  g.fillStyle = '#282e42';
  rr(g, sofaX - sofaW / 2 + 40, sofaY - 80, sofaW - 80, 80, 16);
  g.fill();
  g.fillStyle = '#333b52';
  rr(g, sofaX - sofaW / 2 + 45, sofaY - 76, sofaW - 90, 72, 14);
  g.fill();

  g.restore();

  return {
    GY,
    sofaX,
    sofaY,
    alexX: sofaX - 115,
    benX: sofaX + 115,
    sofaSeatY: sofaY - 45
  };
}

// 7. Cozy Checkered Plaid Blanket (Covering roommates up to chest)
export function drawCozyBlanket(g, cx, cy, w = 520, h = 260, t = 0, opts = {}) {
  const shiverX = (opts.shiver || 0) * (Math.sin(t * 45) * 2.5);
  const shiverY = (opts.shiver || 0) * (Math.cos(t * 38) * 1.5);

  g.save();
  g.translate(cx + shiverX, cy + shiverY);

  // Blanket Base Shape (Bulging mounds over the roommates' laps)
  g.beginPath();
  g.moveTo(-w / 2, h / 2);
  // Left mound
  g.bezierCurveTo(-w / 2 - 10, -h * 0.25, -w * 0.28, -h * 0.55, -w * 0.18, -h * 0.48);
  // Center dip
  g.bezierCurveTo(-w * 0.08, -h * 0.42, 0, -h * 0.38, w * 0.08, -h * 0.44);
  // Right mound
  g.bezierCurveTo(w * 0.22, -h * 0.55, w * 0.42, -h * 0.48, w / 2 + 15, -h * 0.15);
  // Bottom edges
  g.bezierCurveTo(w / 2 + 25, h * 0.35, w * 0.35, h / 2 + 20, 0, h / 2 + 15);
  g.bezierCurveTo(-w * 0.35, h / 2 + 20, -w / 2 - 20, h * 0.35, -w / 2, h / 2);
  g.closePath();

  // Base navy color
  g.fillStyle = '#26344d';
  g.fill();

  // Dark outline
  g.strokeStyle = '#121724';
  g.lineWidth = 6;
  g.stroke();

  // Clip to blanket interior for plaid lines
  g.save();
  g.clip();

  // Shading inside folds
  const blanketShade = g.createLinearGradient(0, -h / 2, 0, h / 2);
  blanketShade.addColorStop(0, '#2e3e5c');
  blanketShade.addColorStop(0.7, '#24324a');
  blanketShade.addColorStop(1, '#172030');
  g.fillStyle = blanketShade;
  g.fill();

  // Checkered Plaid Grid Pattern (Navy / Slate Blue stripes)
  // Diagonal / Curved stripes matching blanket folds
  g.strokeStyle = 'rgba(78, 108, 150, 0.45)';
  g.lineWidth = 14;
  for (let x = -w * 0.6; x <= w * 0.6; x += 55) {
    g.beginPath();
    g.moveTo(x - 30, -h);
    g.bezierCurveTo(x - 10, -h * 0.2, x + 10, h * 0.2, x + 25, h);
    g.stroke();
  }

  // Cross horizontal curves
  g.strokeStyle = 'rgba(78, 108, 150, 0.4)';
  g.lineWidth = 12;
  for (let y = -h * 0.5; y <= h * 0.6; y += 45) {
    g.beginPath();
    g.moveTo(-w, y - 20);
    g.bezierCurveTo(-w * 0.3, y + 25, w * 0.3, y + 20, w, y - 10);
    g.stroke();
  }

  // Intersect dark plaid points
  g.fillStyle = 'rgba(18, 26, 40, 0.35)';
  for (let x = -w * 0.6; x <= w * 0.6; x += 55) {
    for (let y = -h * 0.5; y <= h * 0.6; y += 45) {
      g.fillRect(x - 6, y - 6, 12, 12);
    }
  }

  // Center Crease Shadow between roommates
  const creasGrad = g.createRadialGradient(0, -20, 10, 0, 20, 160);
  creasGrad.addColorStop(0, 'rgba(10, 14, 22, 0.65)');
  creasGrad.addColorStop(1, 'rgba(10, 14, 22, 0)');
  g.fillStyle = creasGrad;
  g.fillRect(-w / 2, -h / 2, w, h);

  g.restore(); // End clip

  // Top Folded Hem (Where hands hold onto blanket)
  g.lineWidth = 5;
  g.strokeStyle = '#121724';
  // Left fold hem
  g.fillStyle = '#37496c';
  g.beginPath();
  g.ellipse(-w * 0.22, -h * 0.44, 95, 18, -0.08, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  // Right fold hem
  g.fillStyle = '#37496c';
  g.beginPath();
  g.ellipse(w * 0.2, -h * 0.42, 95, 18, 0.08, 0, Math.PI * 2);
  g.fill();
  g.stroke();

  g.restore();
}

// 8. Foreground Coffee Table, Popcorn, Mugs & TV Edge
export function drawLivingRoomForeground(g, t, opts = {}) {
  const W = E.W || 1920, H = E.H || 1080;
  const cx = W * 0.58, cy = H * 0.90;

  g.save();

  // Coffee Table (Dark warm wood oval)
  // Table Drop Shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.45)';
  g.beginPath();
  g.ellipse(cx, cy + 42, 340, 50, 0, 0, Math.PI * 2);
  g.fill();

  // Table Legs
  g.fillStyle = '#22150c';
  g.fillRect(cx - 240, cy + 10, 22, 50);
  g.fillRect(cx + 220, cy + 10, 22, 50);

  // Table Top
  g.fillStyle = '#3a2315';
  g.beginPath();
  g.ellipse(cx, cy, 330, 68, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#1d1008';
  g.lineWidth = 5;
  g.stroke();

  // Table Surface Highlight
  g.fillStyle = '#523420';
  g.beginPath();
  g.ellipse(cx, cy - 4, 315, 60, 0, 0, Math.PI * 2);
  g.fill();

  // 1. Popcorn Bowl in Center of Table
  const px = cx + 80, py = cy - 25;
  // Bowl shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  g.beginPath();
  g.ellipse(px, py + 38, 70, 16, 0, 0, Math.PI * 2);
  g.fill();

  // Red and White Striped Popcorn Bucket
  g.save();
  g.beginPath();
  g.moveTo(px - 58, py - 15);
  g.lineTo(px - 44, py + 36);
  g.lineTo(px + 44, py + 36);
  g.lineTo(px + 58, py - 15);
  g.closePath();
  g.fillStyle = '#c9342c';
  g.fill();
  g.clip();

  // White vertical stripes
  g.fillStyle = '#f5f0ea';
  for (let sx = -55; sx <= 55; sx += 22) {
    g.beginPath();
    g.moveTo(px + sx, py - 20);
    g.lineTo(px + sx + 10, py - 20);
    g.lineTo(px + sx * 0.78 + 8, py + 40);
    g.lineTo(px + sx * 0.78, py + 40);
    g.closePath();
    g.fill();
  }
  g.restore();

  // Bowl rim outline
  g.strokeStyle = '#1a0b0b';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(px - 58, py - 15);
  g.lineTo(px - 44, py + 36);
  g.lineTo(px + 44, py + 36);
  g.lineTo(px + 58, py - 15);
  g.closePath();
  g.stroke();

  // Fluffy Popcorn pieces
  const popcorns = [
    [-38, -18, 13], [-20, -26, 14], [-4, -30, 15], [14, -28, 14], [34, -20, 13],
    [-28, -12, 12], [-10, -18, 13], [8, -16, 13], [26, -14, 12],
    [-18, -36, 13], [0, -40, 14], [18, -37, 13]
  ];
  for (const [ox, oy, pr] of popcorns) {
    // Popcorn kernel shadow
    circle(g, px + ox + 1, py + oy + 2, pr, '#e0ca8b');
    // Popcorn yellow/white kernel
    circle(g, px + ox, py + oy, pr, '#fff6db');
    circle(g, px + ox - 2, py + oy - 2, pr * 0.65, '#ffffff');
  }

  // Scattered Popcorn on Table
  circle(g, px + 80, py + 22, 6, '#fff4d1');
  circle(g, px + 95, py + 26, 5, '#fff4d1');
  circle(g, px - 78, py + 24, 6, '#fff4d1');

  // 2. Blue Gamer Controller Mug (Left of Popcorn)
  const mx = cx - 40, my = cy - 12;
  // Mug shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  g.beginPath();
  g.ellipse(mx, my + 30, 26, 10, 0, 0, Math.PI * 2);
  g.fill();

  // Mug handle
  g.strokeStyle = '#275282';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(mx - 25, my + 10, 14, Math.PI * 0.5, Math.PI * 1.5);
  g.stroke();
  g.strokeStyle = '#121f30';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(mx - 25, my + 10, 17, Math.PI * 0.5, Math.PI * 1.5);
  g.stroke();

  // Mug body
  g.fillStyle = '#3569a3';
  rr(g, mx - 22, my - 8, 44, 40, 5);
  g.fill();
  g.strokeStyle = '#121f30';
  g.lineWidth = 3.5;
  g.stroke();

  // Mug top opening
  g.fillStyle = '#221915'; // Coffee inside
  g.beginPath();
  g.ellipse(mx, my - 8, 22, 7, 0, 0, Math.PI * 2);
  g.fill();

  // White Gaming Controller Icon on Mug
  g.fillStyle = '#ffffff';
  rr(g, mx - 10, my + 8, 20, 11, 4);
  g.fill();
  // D-pad & buttons
  g.fillStyle = '#3569a3';
  g.fillRect(mx - 7, my + 11, 5, 5);
  circle(g, mx + 5, my + 13, 2, '#3569a3');

  // 3. Red Skull Mug (Right of Popcorn)
  const rx = cx + 205, ry = cy - 6;
  // Mug shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  g.beginPath();
  g.ellipse(rx, ry + 28, 24, 9, 0, 0, Math.PI * 2);
  g.fill();

  // Mug handle
  g.strokeStyle = '#942b2b';
  g.lineWidth = 6;
  g.beginPath();
  g.arc(rx + 24, ry + 10, 12, -Math.PI * 0.5, Math.PI * 0.5);
  g.stroke();

  // Mug body
  g.fillStyle = '#b83939';
  rr(g, rx - 20, ry - 6, 40, 36, 5);
  g.fill();
  g.strokeStyle = '#1c0c0c';
  g.lineWidth = 3.5;
  g.stroke();

  // Skull icon
  g.fillStyle = '#f0e6e6';
  circle(g, rx, ry + 8, 6);
  g.fillRect(rx - 4, ry + 11, 8, 4);
  g.fillStyle = '#b83939';
  circle(g, rx - 2.5, ry + 7, 1.5);
  circle(g, rx + 2.5, ry + 7, 1.5);

  // 4. Modern TV Remote Control
  const tx = cx - 145, ty = cy - 2;
  g.save();
  g.translate(tx, ty);
  g.rotate(0.25);
  // Remote shadow
  g.fillStyle = 'rgba(0,0,0,0.3)';
  rr(g, -13, -23, 28, 52, 5);
  g.fill();
  // Remote body
  g.fillStyle = '#1e212b';
  rr(g, -15, -25, 30, 50, 4);
  g.fill();
  g.strokeStyle = '#0e0f14';
  g.lineWidth = 2.5;
  g.stroke();
  // Red power button
  circle(g, -7, -17, 3, '#d43333');
  // Directional pad
  circle(g, 0, -4, 6, '#323747');
  // Number buttons
  g.fillStyle = '#444b5e';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      g.fillRect(-8 + c * 6, 6 + r * 5, 4, 3);
    }
  }
  g.restore();

  // 5. TV Corner Bezel in Foreground Right (Casting subtle screen flicker)
  g.save();
  const tvX = W * 0.94, tvY = H * 0.72;
  g.fillStyle = '#0a0b10';
  g.beginPath();
  g.moveTo(W, tvY - 140);
  g.lineTo(tvX - 40, tvY);
  g.lineTo(tvX - 40, H);
  g.lineTo(W, H);
  g.closePath();
  g.fill();

  // Subtle TV screen glow flicker on bottom right
  const tvFlicker = 0.15 + 0.08 * Math.sin(t * 12) + 0.04 * Math.sin(t * 27);
  g.globalCompositeOperation = 'screen';
  const tvGlow = g.createRadialGradient(tvX - 40, tvY + 80, 20, tvX - 40, tvY + 80, 450);
  tvGlow.addColorStop(0, `rgba(140, 200, 255, ${tvFlicker})`);
  tvGlow.addColorStop(1, 'rgba(140, 200, 255, 0)');
  g.fillStyle = tvGlow;
  g.fillRect(0, 0, W, H);
  g.restore();

  g.restore();
}

// Helper: Books on shelf
function drawBooks(g, bx, by, count, colors) {
  let cx = bx;
  for (let i = 0; i < count; i++) {
    const bw = 14 + (i % 3) * 3;
    const bh = 55 + (i * 7) % 25;
    const c = colors[i % colors.length];
    g.fillStyle = c;
    rr(g, cx, by - bh, bw, bh, 2);
    g.fill();
    g.fillStyle = shade(c, -0.3);
    g.fillRect(cx + 2, by - bh + 6, bw - 4, 4);
    cx += bw + 3;
  }
}

// Helper: Hanging Ivy Plant
function drawHangingIvy(g, px, py) {
  // Clay Pot
  g.fillStyle = '#9e5a3f';
  rr(g, px - 16, py - 28, 32, 28, 4);
  g.fill();
  g.fillStyle = '#7a3e28';
  rr(g, px - 18, py - 32, 36, 7, 2);
  g.fill();

  // Hanging green ivy vines
  const vines = [
    [-10, 0, 45], [-3, 5, 75], [5, 2, 60], [12, -2, 40]
  ];
  for (const [vx, vy, vlen] of vines) {
    g.strokeStyle = '#32542a';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(px + vx, py - 10);
    g.bezierCurveTo(px + vx - 8, py + vlen * 0.4, px + vx + 8, py + vlen * 0.7, px + vx, py + vlen);
    g.stroke();

    // Ivy leaves along vine
    for (let l = 15; l <= vlen; l += 14) {
      circle(g, px + vx + (l % 8 - 4), py + l, 5, '#487a3c');
      circle(g, px + vx + (l % 8 - 4), py + l, 4, '#5b964d');
    }
  }
}

// Helper: Cute Mini Ghost Figurine on shelf (Easter egg from reference)
function drawMiniGhostFigurine(g, gx, gy) {
  // Ghost shadow
  g.fillStyle = 'rgba(0, 0, 0, 0.3)';
  g.beginPath();
  g.ellipse(gx, gy, 18, 6, 0, 0, Math.PI * 2);
  g.fill();

  // White sheet body
  g.fillStyle = '#f5f5f7';
  g.beginPath();
  g.arc(gx, gy - 26, 16, Math.PI, 0);
  g.lineTo(gx + 16, gy);
  // Wavy bottom skirt
  g.bezierCurveTo(gx + 11, gy - 4, gx + 6, gy + 3, gx, gy);
  g.bezierCurveTo(gx - 6, gy - 4, gx - 11, gy + 3, gx - 16, gy);
  g.closePath();
  g.fill();
  g.strokeStyle = '#22232a';
  g.lineWidth = 2.5;
  g.stroke();

  // Cute oval ghost eyes
  circle(g, gx - 5, gy - 24, 3, '#1c1d24');
  circle(g, gx + 5, gy - 24, 3, '#1c1d24');
  // Little open mouth
  circle(g, gx, gy - 18, 2.5, '#1c1d24');
}

// Helper: Potted Plant on Table
function drawPottedPlant(g, x, y, scale = 1) {
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);

  // Ceramic pot
  g.fillStyle = '#6b7280';
  rr(g, -18, -26, 36, 26, 4);
  g.fill();
  g.fillStyle = '#9ca3af';
  rr(g, -20, -30, 40, 7, 2);
  g.fill();

  // Green leaves
  const leaves = [
    [-14, -38, 14, -0.6], [0, -48, 16, 0], [14, -38, 14, 0.6],
    [-8, -44, 12, -0.3], [8, -44, 12, 0.3]
  ];
  for (const [lx, ly, lr, lrot] of leaves) {
    g.save();
    g.translate(lx, ly);
    g.rotate(lrot);
    g.fillStyle = '#3f7547';
    g.beginPath();
    g.ellipse(0, 0, lr * 0.6, lr, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  g.restore();
}
