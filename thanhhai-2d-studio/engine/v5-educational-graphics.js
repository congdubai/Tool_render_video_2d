// engine/v5-educational-graphics.js — Educational Graphics & Vietnamese Text Layout (V5 Phase 3)
// Generates diagrams, arrows, comparison cards, timeline nodes, and wraps/fits UTF-8 Vietnamese text.

export const GRAPHIC_TYPES = {
  TITLE_CARD: 'title_card',
  LABEL: 'label',
  CALLOUT: 'callout',
  ARROW: 'arrow',
  LINE: 'line',
  HIGHLIGHT_BOX: 'highlight_box',
  COMPARISON_CARD: 'comparison_card',
  TIMELINE_NODE: 'timeline_node',
  PROCESS_DIAGRAM: 'process_diagram'
};

export const DEFAULT_FONT_FAMILY = "'Be Vietnam Pro', 'Segoe UI', Arial, sans-serif";

/**
 * Wraps text into lines based on maximum character count or estimated width
 */
export function wrapVietnameseText(text = '', maxCharsPerLine = 35) {
  if (!text) return [];
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + (currentLine ? ' ' : '') + word).length <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Creates a formatted text graphic object ready for rendering
 */
export function createTextGraphic(options = {}) {
  const text = options.text || options.title || '';
  const lines = wrapVietnameseText(text, options.maxCharsPerLine || 32);

  return {
    id: options.id || `text_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: options.type || GRAPHIC_TYPES.LABEL,
    text,
    lines,
    position: {
      x: options.position?.x ?? 0.5,
      y: options.position?.y ?? 0.2
    },
    size: {
      width: options.size?.width ?? 0.4,
      height: options.size?.height ?? (lines.length * 0.05 + 0.04)
    },
    style: {
      fontFamily: options.fontFamily || DEFAULT_FONT_FAMILY,
      fontSize: options.fontSize || (options.type === GRAPHIC_TYPES.TITLE_CARD ? 32 : 22),
      fontWeight: options.fontWeight || '700',
      fillColor: options.fillColor || '#FFFFFF',
      strokeColor: options.strokeColor || '#0f172a',
      strokeWidth: options.strokeWidth || 4,
      backgroundColor: options.backgroundColor || (options.type === GRAPHIC_TYPES.CALLOUT ? 'rgba(15, 23, 42, 0.85)' : null),
      borderRadius: options.borderRadius || 8,
      textAlign: options.textAlign || 'center'
    },
    visible: options.visible ?? true,
    zIndex: options.zIndex ?? 30
  };
}

/**
 * Creates an arrow graphic connecting two points
 */
export function createArrowGraphic(options = {}) {
  return {
    id: options.id || `arrow_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: GRAPHIC_TYPES.ARROW,
    from: { x: options.from?.x ?? 0.3, y: options.from?.y ?? 0.5 },
    to: { x: options.to?.x ?? 0.7, y: options.to?.y ?? 0.5 },
    color: options.color || '#38bdf8',
    width: options.width || 4,
    headSize: options.headSize || 12,
    curved: options.curved ?? false,
    label: options.label || null,
    zIndex: options.zIndex ?? 28
  };
}

/**
 * Creates a comparison card graphic
 */
export function createComparisonCard(options = {}) {
  return {
    id: options.id || `comp_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    type: GRAPHIC_TYPES.COMPARISON_CARD,
    title: options.title || 'So sánh',
    position: { x: options.position?.x ?? 0.5, y: options.position?.y ?? 0.5 },
    size: { width: options.width ?? 0.35, height: options.height ?? 0.45 },
    headerColor: options.headerColor || '#38bdf8',
    backgroundColor: options.backgroundColor || 'rgba(30, 41, 59, 0.90)',
    items: Array.isArray(options.items) ? options.items : []
  };
}

/**
 * Creates timeline nodes and connecting horizontal line
 */
export function createTimelineGraphics(milestones = []) {
  const count = milestones.length;
  if (count === 0) return { line: null, nodes: [] };

  const startX = 0.12;
  const endX = 0.88;
  const step = count > 1 ? (endX - startX) / (count - 1) : 0;
  const lineY = 0.65;

  const line = {
    id: 'timeline_axis_line',
    type: GRAPHIC_TYPES.LINE,
    from: { x: startX, y: lineY },
    to: { x: endX, y: lineY },
    color: '#0284c7',
    width: 6,
    zIndex: 25
  };

  const nodes = milestones.map((m, idx) => {
    const x = count > 1 ? startX + (idx * step) : 0.5;
    return {
      id: `timeline_node_${idx}`,
      type: GRAPHIC_TYPES.TIMELINE_NODE,
      position: { x, y: lineY },
      year: m.year || m.date || `${1940 + idx * 20}`,
      title: m.title || `Giai đoạn ${idx + 1}`,
      description: m.description || '',
      color: idx === 0 ? '#38bdf8' : (idx === count - 1 ? '#4ade80' : '#f59e0b'),
      zIndex: 26
    };
  });

  return { line, nodes };
}

// ============================================================================
// V5.2 PHASE 4C — ANIMATED EDUCATIONAL GRAPHICS, DIAGRAMS, COMPARISON, TIMELINE & TEXT
// ============================================================================

export const SUPPORTED_GRAPHIC_TYPES = [
  'arrow', 'circle_highlight', 'rect_highlight', 'callout', 'label',
  'number_marker', 'line', 'connector', 'bracket', 'magnifier',
  'comparison_card', 'progress_bar', 'timeline', 'flowchart',
  'bar_chart', 'line_chart', 'pie_chart'
];

export const SUPPORTED_TEXT_ANIMATIONS = [
  'title', 'subtitle', 'lower_third', 'label', 'keyword_highlight',
  'number_reveal', 'typewriter', 'fade_in', 'slide_in', 'scale_in', 'mask_reveal'
];

const clampG = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const easeOutG = (t) => { const x = clampG(t, 0, 1); return 1 - (1 - x) * (1 - x); };

function toPxX(v, w = 1280) { return v <= 1.5 ? v * w : v; }
function toPxY(v, h = 720) { return v <= 1.5 ? v * h : v; }

export function renderAnimatedArrow(ctx, g, t, W = 1280, H = 720) {
  const start = Number(g.start ?? 0);
  const end = Number(g.end ?? 999);
  if (t < start || t > end) return;
  const u = easeOutG((t - start) / Math.max(0.25, Number(g.drawDuration ?? 0.6)));
  const x1 = toPxX(g.from?.x ?? 0.3, W), y1 = toPxY(g.from?.y ?? 0.5, H);
  const x2 = toPxX(g.to?.x ?? 0.7, W), y2 = toPxY(g.to?.y ?? 0.5, H);
  const cx = x1 + (x2 - x1) * u;
  const cy = y1 + (y2 - y1) * u;

  ctx.save();
  ctx.strokeStyle = g.color || '#38bdf8';
  ctx.fillStyle = g.color || '#38bdf8';
  ctx.lineWidth = g.width || 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(cx, cy);
  ctx.stroke();

  if (u > 0.2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const hs = g.headSize || 14;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - hs * Math.cos(ang - 0.5), cy - hs * Math.sin(ang - 0.5));
    ctx.lineTo(cx - hs * Math.cos(ang + 0.5), cy - hs * Math.sin(ang + 0.5));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function renderAnimatedDiagram(ctx, diagram, t, W = 1280, H = 720) {
  if (!diagram) return;
  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
  const baseStart = Number(diagram.start ?? 0);

  ctx.save();
  // Backdrop panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(100, 120, W - 200, H - 240, 18);
  ctx.fill();
  ctx.stroke();

  if (diagram.title) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 28px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(diagram.title, W * 0.5, 172);
  }

  // Draw animated edges + moving data particles
  for (const edge of edges) {
    const nA = nodes.find(n => n.id === edge.from);
    const nB = nodes.find(n => n.id === edge.to);
    if (!nA || !nB) continue;
    const eStart = Number(edge.start ?? baseStart + 0.4);
    if (t < eStart) continue;
    const u = easeOutG((t - eStart) / 0.6);
    const x1 = toPxX(nA.x, W), y1 = toPxY(nA.y, H);
    const x2 = toPxX(nB.x, W), y2 = toPxY(nB.y, H);
    const cx = x1 + (x2 - x1) * u;
    const cy = y1 + (y2 - y1) * u;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Moving data particle along active connector
    const pU = ((t - eStart) * 0.9) % 1;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x1 + (x2 - x1) * pU, y1 + (y2 - y1) * pU, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw step-by-step nodes with active pulse highlight
  nodes.forEach((n, idx) => {
    const nStart = Number(n.start ?? (baseStart + idx * 1.1));
    if (t < nStart) return;
    const pop = easeOutG((t - nStart) / 0.4);
    const nx = toPxX(n.x, W), ny = toPxY(n.y, H);
    const isHighlighted = t >= nStart && t <= nStart + 1.6;
    const nw = 180, nh = 84;

    ctx.save();
    ctx.translate(nx, ny);
    ctx.scale(pop, pop);
    ctx.fillStyle = isHighlighted ? '#0284c7' : '#1e293b';
    ctx.strokeStyle = isHighlighted ? '#fde047' : '#38bdf8';
    ctx.lineWidth = isHighlighted ? 4 : 2.5;
    ctx.beginPath();
    ctx.roundRect(-nw / 2, -nh / 2, nw, nh, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 20px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label || n.id, 0, n.sublabel ? -10 : 0);
    if (n.sublabel) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 14px ${DEFAULT_FONT_FAMILY}`;
      ctx.fillText(n.sublabel, 0, 16);
    }
    ctx.restore();
  });
  ctx.restore();
}

export function renderVisualComparison(ctx, comp, t, W = 1280, H = 720) {
  if (!comp) return;
  const start = Number(comp.start ?? 0);
  if (t < start) return;
  const pop = easeOutG((t - start) / 0.5);

  ctx.save();
  // Split screen divider
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 90);
  ctx.lineTo(W * 0.5, 90 + (H - 180) * pop);
  ctx.stroke();

  const drawSide = (side, cx, accent, isActive) => {
    if (!side) return;
    const cw = 460, ch = 360;
    ctx.save();
    ctx.translate(cx, H * 0.5);
    ctx.scale(pop, pop);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.strokeStyle = isActive ? '#fde047' : accent;
    ctx.lineWidth = isActive ? 5 : 3;
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = accent;
    ctx.font = `700 26px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(side.title || '', 0, -ch / 2 + 46);

    const lines = wrapVietnameseText(side.description || '', 30);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `500 19px ${DEFAULT_FONT_FAMILY}`;
    lines.forEach((ln, li) => ctx.fillText(ln, 0, -40 + li * 30));

    if (side.badge) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(-110, ch / 2 - 64, 220, 40, 20);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.font = `700 17px ${DEFAULT_FONT_FAMILY}`;
      ctx.fillText(side.badge, 0, ch / 2 - 38);
    }
    ctx.restore();
  };

  const localT = t - start;
  drawSide(comp.left, W * 0.27, '#f59e0b', localT < 3.5);
  drawSide(comp.right, W * 0.73, '#22c55e', localT >= 3.5);
  ctx.restore();
}

export function renderHistoricalTimeline(ctx, tl, t, W = 1280, H = 720) {
  if (!tl || !Array.isArray(tl.milestones) || tl.milestones.length === 0) return;
  const start = Number(tl.start ?? 0);
  if (t < start) return;
  const ms = tl.milestones;
  const startX = 150, endX = W - 150, lineY = H * 0.56;
  const lineU = easeOutG((t - start) / 1.0);

  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.beginPath();
  ctx.roundRect(70, 110, W - 140, H - 220, 18);
  ctx.fill();

  if (tl.title) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 28px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(tl.title, W * 0.5, 165);
  }

  // Animated axis line
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(startX, lineY);
  ctx.lineTo(startX + (endX - startX) * lineU, lineY);
  ctx.stroke();

  const step = ms.length > 1 ? (endX - startX) / (ms.length - 1) : 0;
  ms.forEach((m, idx) => {
    const mStart = Number(m.start ?? (start + idx * 1.1));
    if (t < mStart) return;
    const pop = easeOutG((t - mStart) / 0.4);
    const nx = ms.length > 1 ? startX + idx * step : W * 0.5;
    const isActive = t >= mStart && t <= mStart + 1.4;

    ctx.save();
    ctx.translate(nx, lineY);
    ctx.scale(pop, pop);
    ctx.fillStyle = isActive ? '#fde047' : '#38bdf8';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, isActive ? 20 : 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isActive ? '#fde047' : '#38bdf8';
    ctx.font = `700 22px ${DEFAULT_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(m.year || ''), 0, -34);

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 17px ${DEFAULT_FONT_FAMILY}`;
    ctx.fillText(String(m.title || ''), 0, 42);
    if (m.description) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = `500 13px ${DEFAULT_FONT_FAMILY}`;
      wrapVietnameseText(m.description, 18).slice(0, 2).forEach((ln, li) => {
        ctx.fillText(ln, 0, 66 + li * 18);
      });
    }
    ctx.restore();
  });
  ctx.restore();
}

export function renderAnimatedTextOverlay(ctx, txt, t, W = 1280, H = 720) {
  const start = Number(txt.start ?? 0);
  const end = Number(txt.end ?? 999);
  if (t < start || t > end) return;

  const anim = String(txt.animation || 'fade_in').toLowerCase();
  const dur = Math.max(0.15, Number(txt.animDuration ?? 0.45));
  const u = clampG((t - start) / dur, 0, 1);
  const e = easeOutG(u);

  const rawText = String(txt.text || txt.title || '');
  const displayText = anim === 'typewriter' ? rawText.slice(0, Math.max(1, Math.round(rawText.length * u))) : rawText;

  // Clamp strictly within safe area [80..W-80, 60..H-60]
  const tx = clampG(toPxX(txt.x ?? 0.5, W), 160, W - 160);
  const ty = clampG(toPxY(txt.y ?? 0.14, H), 64, H - 64);
  const slideY = anim === 'slide_in' ? (1 - e) * 24 : 0;
  const scale = anim === 'scale_in' ? (0.75 + 0.25 * e) : 1.0;

  ctx.save();
  ctx.globalAlpha *= (anim === 'fade_in' ? e : 1);
  ctx.translate(tx, ty + slideY);
  ctx.scale(scale, scale);

  const lines = wrapVietnameseText(displayText, txt.maxCharsPerLine || 38);
  const fontSize = Number(txt.fontSize || (txt.variant === 'title' ? 32 : 22));
  ctx.font = `700 ${fontSize}px ${DEFAULT_FONT_FAMILY}`;
  const maxW = Math.max(220, ...lines.map(l => ctx.measureText(l).width + 44));
  const boxH = lines.length * (fontSize + 8) + 20;

  ctx.fillStyle = txt.backgroundColor || 'rgba(15, 23, 42, 0.84)';
  ctx.strokeStyle = txt.borderColor || '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-maxW / 2, -boxH / 2, maxW, boxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = txt.color || '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((ln, li) => {
    const ly = -((lines.length - 1) * (fontSize + 8)) / 2 + li * (fontSize + 8);
    ctx.fillText(ln, 0, ly);
  });
  ctx.restore();
}

export function renderEducationalGraphics(ctx, scene, t, W = 1280, H = 720) {
  if (scene.diagram) renderAnimatedDiagram(ctx, scene.diagram, t, W, H);
  if (scene.comparison) renderVisualComparison(ctx, scene.comparison, t, W, H);
  if (scene.timeline) renderHistoricalTimeline(ctx, scene.timeline, t, W, H);

  for (const g of (scene.graphics || [])) {
    const gStart = Number(g.start ?? 0);
    const gEnd = Number(g.end ?? 999);
    if (t < gStart || t > gEnd) continue;
    const gType = String(g.type || '').toLowerCase();
    if (gType === 'arrow' || gType === 'connector') {
      renderAnimatedArrow(ctx, g, t, W, H);
    } else if (gType === 'circle_highlight' || gType === 'spotlight') {
      const cx = toPxX(g.x ?? 0.5, W), cy = toPxY(g.y ?? 0.5, H);
      const r = Number(g.radius || 75) + Math.sin(t * 6) * 5;
      ctx.save();
      ctx.strokeStyle = g.color || '#fde047';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (gType === 'rect_highlight' || gType === 'highlight_box') {
      const cx = toPxX(g.x ?? 0.5, W), cy = toPxY(g.y ?? 0.5, H);
      const rw = toPxX(g.width ?? 0.2, W), rh = toPxY(g.height ?? 0.2, H);
      ctx.save();
      ctx.strokeStyle = g.color || '#fde047';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(cx - rw / 2, cy - rh / 2, rw, rh, 10);
      ctx.stroke();
      ctx.restore();
    } else if (gType === 'callout' || gType === 'label') {
      renderAnimatedTextOverlay(ctx, g, t, W, H);
    }
  }

  for (const txt of (scene.texts || [])) {
    renderAnimatedTextOverlay(ctx, txt, t, W, H);
  }
}


