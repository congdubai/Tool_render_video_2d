// engine/prop-v4.js — Universal Prop & Object System (Thanh Hai 2D Studio V4)
// Handles transparent PNG props, hand-tracking, pick up / hold / drop states, and scene rendering.

const propImageCache = new Map();

/**
 * Lấy hoặc nạp ảnh cho đạo cụ từ URL hoặc relative path
 * @param {string} src
 * @returns {HTMLImageElement|null}
 */
export function getCachedPropImage(src) {
  if (!src) return null;
  if (propImageCache.has(src)) {
    return propImageCache.get(src);
  }
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    propImageCache.set(src, img);
    return img;
  }
  return null;
}

/**
 * Danh mục URL mặc định cho các đạo cụ chuẩn V4
 */
export const BUILTIN_PROP_URLS = {
  coffee_cup: '/public/assets/prop/prop_coffee_cup/prop.png',
  cup: '/public/assets/prop/prop_coffee_cup/prop.png',
  prop_coffee_cup: '/public/assets/prop/prop_coffee_cup/prop.png',

  laptop: '/public/assets/prop/prop_laptop_modern/prop.png',
  prop_laptop: '/public/assets/prop/prop_laptop_modern/prop.png',
  prop_laptop_modern: '/public/assets/prop/prop_laptop_modern/prop.png',

  phone: '/public/assets/prop/prop_phone_smart/prop.png',
  prop_phone: '/public/assets/prop/prop_phone_smart/prop.png',
  prop_phone_smart: '/public/assets/prop/prop_phone_smart/prop.png',

  book: '/public/assets/prop/prop_book_magic/prop.png',
  prop_book: '/public/assets/prop/prop_book_magic/prop.png',
  prop_book_magic: '/public/assets/prop/prop_book_magic/prop.png',

  broom: '/public/assets/prop/prop_broom_stick/prop.png',
  prop_broom: '/public/assets/prop/prop_broom_stick/prop.png',
  prop_broom_stick: '/public/assets/prop/prop_broom_stick/prop.png',

  desk: '/public/assets/prop/prop_desk_wood/prop.png',
  table: '/public/assets/prop/prop_desk_wood/prop.png',
  prop_desk: '/public/assets/prop/prop_desk_wood/prop.png',
  prop_desk_wood: '/public/assets/prop/prop_desk_wood/prop.png',

  chair: '/public/assets/prop/prop_chair_cafe/prop.png',
  prop_chair: '/public/assets/prop/prop_chair_cafe/prop.png',
  prop_chair_cafe: '/public/assets/prop/prop_chair_cafe/prop.png',

  pen: '/public/assets/prop/prop_pen_tool/prop.png',
  prop_pen: '/public/assets/prop/prop_pen_tool/prop.png',
  prop_pen_tool: '/public/assets/prop/prop_pen_tool/prop.png'
};

/**
 * Chuẩn hóa đối tượng prop từ string hoặc object
 */
export function normalizePropSpec(prop) {
  if (!prop) return null;
  if (typeof prop === 'string') {
    const rawType = prop.toLowerCase().trim();
    const url = BUILTIN_PROP_URLS[rawType] || `/public/assets/prop/${rawType}/prop.png`;
    return {
      type: rawType,
      id: rawType,
      imageUrl: url,
      scale: 1.0,
      rotation: 0,
      anchor: [0.5, 0.8],
      holdOffset: [0, -10],
      state: 'held' // 'held' | 'dropped' | 'placed' | 'pick_up'
    };
  }

  const rawType = (prop.type || prop.id || 'prop').toLowerCase().trim();
  const url = prop.imageUrl || prop.filePath || prop.image || BUILTIN_PROP_URLS[rawType] || `/public/assets/prop/${rawType}/prop.png`;
  return {
    type: rawType,
    id: prop.id || rawType,
    imageUrl: url,
    scale: prop.scale ?? 1.0,
    rotation: prop.rotation ?? 0,
    anchor: prop.anchor || [0.5, 0.8],
    holdOffset: prop.holdOffset || [0, -10],
    state: prop.state || 'held',
    sceneX: prop.sceneX ?? prop.x ?? 0,
    sceneY: prop.sceneY ?? prop.y ?? 0,
    pickupTime: prop.pickupTime ?? null,
    dropTime: prop.dropTime ?? null,
    hand: prop.hand || 'F' // 'F' (near hand) or 'B' (far hand)
  };
}

/**
 * Tính toán trạng thái động theo thời gian timeline của Prop
 * Hỗ trợ các hành động: nhặt đồ vật (pick_up), cầm (hold), và thả (drop / put_down)
 */
export function solvePropTimelineState(propSpec, t, handWorldPos) {
  if (!propSpec) return null;
  const p = { ...propSpec };

  // 1. Nếu có dropTime và t >= dropTime -> Chuyển sang trạng thái dropped
  if (p.dropTime != null && t >= p.dropTime) {
    p.state = 'dropped';
    // Nếu chưa có vị trí thả cố định, lấy vị trí bàn tay ngay tại thời điểm dropTime
    if (p.dropPos) {
      p.x = p.dropPos[0];
      p.y = p.dropPos[1];
    } else if (p.sceneX != null && p.sceneY != null) {
      p.x = p.sceneX;
      p.y = p.sceneY;
    } else if (handWorldPos) {
      p.x = handWorldPos[0];
      p.y = Math.min(handWorldPos[1] + (t - p.dropTime) * 120, handWorldPos[1] + 80); // Rơi nhẹ xuống mặt bàn/sàn
    }
    return p;
  }

  // 2. Nếu có pickupTime và t < pickupTime -> Đang nằm tại cảnh ban đầu
  if (p.pickupTime != null && t < p.pickupTime) {
    p.state = 'placed';
    p.x = p.sceneX || (handWorldPos ? handWorldPos[0] - 60 : 0);
    p.y = p.sceneY || (handWorldPos ? handWorldPos[1] + 40 : 0);
    return p;
  }

  // 3. Đang được nhân vật cầm trên tay (held)
  p.state = 'held';
  return p;
}

/**
 * Vẽ một đạo cụ (Prop) độc lập tại tọa độ cảnh (Scene space)
 */
export function drawSceneProp(g, prop, x, y, scale = 1.0, rotationDeg = 0) {
  const p = normalizePropSpec(prop);
  if (!p) return;

  g.save();
  g.translate(x, y);
  if (rotationDeg) {
    g.rotate((rotationDeg * Math.PI) / 180);
  }
  const s = (p.scale || 1.0) * scale;
  g.scale(s, s);

  renderPropVisual(g, p);
  g.restore();
}

/**
 * Vẽ đạo cụ gắn với bàn tay nhân vật (Hand-tracking)
 * Khi bàn tay chuyển động qua các frame (walk, wave, point, breathe), đạo cụ tự động bám theo
 */
export function drawHandAttachedProp(g, prop, handPos, facing = 1, charScale = 1.0) {
  const p = normalizePropSpec(prop);
  if (!p) return;

  g.save();
  // Di chuyển đến tọa độ của bàn tay
  g.translate(handPos[0], handPos[1]);

  // Áp dụng holdOffset điều chỉnh điểm cầm nắm
  const ox = (p.holdOffset ? p.holdOffset[0] : 0) * facing;
  const oy = p.holdOffset ? p.holdOffset[1] : -10;
  g.translate(ox, oy);

  // Áp dụng góc xoay của prop
  const rot = (p.rotation || 0) * (facing < 0 ? -1 : 1);
  if (rot) {
    g.rotate((rot * Math.PI) / 180);
  }

  // Áp dụng tỷ lệ
  const s = p.scale || 1.0;
  g.scale(s, s);

  renderPropVisual(g, p);
  g.restore();
}

/**
 * Render hình ảnh hoặc vector dự phòng của đạo cụ
 */
function renderPropVisual(g, p) {
  const img = getCachedPropImage(p.imageUrl);
  const w = p.dimensions?.width || 48;
  const h = p.dimensions?.height || 48;
  const anchorX = Array.isArray(p.anchor) ? (p.anchor[0] <= 1.0 ? p.anchor[0] * w : p.anchor[0]) : w / 2;
  const anchorY = Array.isArray(p.anchor) ? (p.anchor[1] <= 1.0 ? p.anchor[1] * h : p.anchor[1]) : h * 0.8;

  // Nếu ảnh PNG đã nạp thành công và có kích thước thực
  if (img && img.complete && img.naturalWidth > 0) {
    try {
      g.drawImage(img, -anchorX, -anchorY, w, h);
      return;
    } catch (e) {}
  }

  // Fallback vector vẽ sạch sẽ nếu ảnh chưa nạp xong
  drawFallbackVectorProp(g, p.type, w, h, anchorX, anchorY);
}

/**
 * Hình vẽ vector dự phòng sắc nét cho từng loại đạo cụ
 */
function drawFallbackVectorProp(g, type, w, h, ax, ay) {
  g.save();
  g.translate(-ax, -ay);

  if (type.includes('cup') || type.includes('coffee')) {
    // Ceramic cup with steam
    g.fillStyle = '#f8fafc';
    g.strokeStyle = '#1e293b';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(w * 0.25, h * 0.35);
    g.lineTo(w * 0.3, h * 0.85);
    g.quadraticCurveTo(w * 0.5, h * 0.95, w * 0.7, h * 0.85);
    g.lineTo(w * 0.75, h * 0.35);
    g.closePath();
    g.fill();
    g.stroke();
    // Handle
    g.beginPath();
    g.arc(w * 0.75, h * 0.55, h * 0.18, -Math.PI / 2, Math.PI / 2);
    g.stroke();
    // Coffee top
    g.fillStyle = '#78350f';
    g.beginPath();
    g.ellipse(w * 0.5, h * 0.35, w * 0.25, h * 0.08, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  } else if (type.includes('laptop')) {
    // Open laptop
    g.fillStyle = '#0f172a';
    g.strokeStyle = '#334155';
    g.lineWidth = 2.5;
    g.fillRect(w * 0.15, h * 0.2, w * 0.7, h * 0.5);
    g.strokeRect(w * 0.15, h * 0.2, w * 0.7, h * 0.5);
    g.fillStyle = '#0284c7';
    g.fillRect(w * 0.2, h * 0.25, w * 0.6, h * 0.4);
    // Base
    g.fillStyle = '#cbd5e1';
    g.strokeStyle = '#1e293b';
    g.beginPath();
    g.moveTo(w * 0.05, h * 0.78);
    g.lineTo(w * 0.95, h * 0.78);
    g.lineTo(w * 0.85, h * 0.7);
    g.lineTo(w * 0.15, h * 0.7);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (type.includes('phone')) {
    // Smartphone
    g.fillStyle = '#020617';
    g.strokeStyle = '#334155';
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(w * 0.25, h * 0.1, w * 0.5, h * 0.8, 6);
    g.fill();
    g.stroke();
    g.fillStyle = '#1e1b4b';
    g.beginPath();
    g.roundRect(w * 0.28, h * 0.15, w * 0.44, h * 0.7, 4);
    g.fill();
  } else if (type.includes('book')) {
    // Hardcover book
    g.fillStyle = '#991b1b';
    g.strokeStyle = '#1c1917';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(w * 0.15, h * 0.2, w * 0.7, h * 0.65, 4);
    g.fill();
    g.stroke();
    g.fillStyle = '#fef3c7';
    g.fillRect(w * 0.25, h * 0.25, w * 0.55, h * 0.55);
  } else if (type.includes('broom')) {
    // Broomstick
    g.strokeStyle = '#78350f';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(w * 0.8, h * 0.1);
    g.lineTo(w * 0.3, h * 0.75);
    g.stroke();
    g.fillStyle = '#fde047';
    g.strokeStyle = '#1c1917';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(w * 0.35, h * 0.7);
    g.lineTo(w * 0.1, h * 0.95);
    g.lineTo(w * 0.45, h * 0.95);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (type.includes('chair')) {
    // Chair
    g.strokeStyle = '#1e293b';
    g.lineWidth = 3.5;
    g.strokeRect(w * 0.25, h * 0.2, w * 0.5, h * 0.45);
    g.fillStyle = '#d97706';
    g.fillRect(w * 0.2, h * 0.6, w * 0.6, h * 0.08);
    g.strokeRect(w * 0.2, h * 0.6, w * 0.6, h * 0.08);
    g.beginPath();
    g.moveTo(w * 0.25, h * 0.68); g.lineTo(w * 0.2, h * 0.95);
    g.moveTo(w * 0.75, h * 0.68); g.lineTo(w * 0.8, h * 0.95);
    g.stroke();
  } else if (type.includes('desk') || type.includes('table')) {
    // Desk
    g.fillStyle = '#b45309';
    g.strokeStyle = '#1c1917';
    g.lineWidth = 3;
    g.fillRect(w * 0.1, h * 0.35, w * 0.8, h * 0.12);
    g.strokeRect(w * 0.1, h * 0.35, w * 0.8, h * 0.12);
    g.beginPath();
    g.moveTo(w * 0.18, h * 0.47); g.lineTo(w * 0.16, h * 0.92);
    g.moveTo(w * 0.82, h * 0.47); g.lineTo(w * 0.84, h * 0.92);
    g.stroke();
  } else {
    // Generic cute box
    g.fillStyle = '#38bdf8';
    g.strokeStyle = '#0284c7';
    g.lineWidth = 2.5;
    g.beginPath();
    g.roundRect(w * 0.2, h * 0.2, w * 0.6, h * 0.6, 6);
    g.fill();
    g.stroke();
  }

  g.restore();
}

