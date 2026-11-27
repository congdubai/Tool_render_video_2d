// engine/v5-vector-canvas.js — Pure Declarative Universal Vector Engine (V5.2 Phase 2)
// Zero Node.js dependencies — runs identically in Node.js (SVG export) and Browser/Playwright Canvas 2D (Preview & MP4).
// Supports: rect, rounded_rect, circle, ellipse, polygon, polyline, line, path (Bezier), curve, text, group,
// nested transforms, gradients (linear/radial), clipPaths, masks, patterns/textures, soft shadows, highlights,
// independent layers, anchors, pivots, placementZones, perspective metadata, and animatable properties.
// Strictly declarative: zero eval, zero dynamic JS execution.

export const MAX_PRIMITIVES = 3500;
export const MAX_GROUP_DEPTH = 12;
export const MAX_CANVAS_DIMENSION = 4096;

export const VECTOR_SCHEMA_VERSION = '5.2';

export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const VALID_ELEMENT_TYPES = new Set([
  'rect', 'rounded_rect', 'circle', 'ellipse', 'line',
  'polygon', 'polyline', 'path', 'bezier', 'curve', 'text', 'group'
]);

/**
 * Validates a declarative V5.1/V5.2 vector JSON specification against security and schema constraints.
 */
export function validateVectorSpec(spec = {}) {
  const errors = [];
  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: ['Vector specification must be a valid JSON object.'] };
  }

  const width = Number(spec.width) || 0;
  const height = Number(spec.height) || 0;
  if (width <= 0 || width > MAX_CANVAS_DIMENSION || height <= 0 || height > MAX_CANVAS_DIMENSION) {
    errors.push(`Canvas dimensions (${width}x${height}) must be within 1x1 and ${MAX_CANVAS_DIMENSION}x${MAX_CANVAS_DIMENSION}.`);
  }

  const elements = Array.isArray(spec.elements)
    ? spec.elements
    : (Array.isArray(spec.layers) ? spec.layers.flatMap(l => Array.isArray(l.elements) ? l.elements : []) : []);

  let primitiveCount = 0;

  function checkElement(el, depth = 0) {
    if (!el || typeof el !== 'object') return;
    primitiveCount++;
    if (primitiveCount > MAX_PRIMITIVES) {
      errors.push(`Total primitives exceed maximum allowable limit of ${MAX_PRIMITIVES}.`);
      return;
    }
    if (depth > MAX_GROUP_DEPTH) {
      errors.push(`Group nesting depth exceeds maximum allowable depth of ${MAX_GROUP_DEPTH}.`);
      return;
    }

    const type = String(el.type || '').toLowerCase();
    if (!VALID_ELEMENT_TYPES.has(type)) {
      errors.push(`Unsupported element type: "${type}".`);
    }

    for (const [k, v] of Object.entries(el)) {
      if (typeof v === 'string') {
        const valLower = v.toLowerCase();
        if (
          valLower.includes('<script') ||
          valLower.includes('javascript:') ||
          valLower.includes('data:text/html') ||
          valLower.includes('onload=') ||
          valLower.includes('onerror=') ||
          valLower.includes('eval(')
        ) {
          errors.push(`Security violation in property "${k}": script or external code execution is strictly prohibited.`);
        }
      }
    }

    if (type === 'group' && Array.isArray(el.children)) {
      for (const child of el.children) {
        checkElement(child, depth + 1);
      }
    }
  }

  for (const el of elements) {
    checkElement(el, 0);
  }

  return {
    valid: errors.length === 0,
    errors,
    primitiveCount
  };
}

export function sanitizeVectorSpec(spec = {}) {
  const cleanSpec = {
    schemaVersion: spec.schemaVersion || VECTOR_SCHEMA_VERSION,
    width: Math.min(Math.max(Number(spec.width) || 512, 1), MAX_CANVAS_DIMENSION),
    height: Math.min(Math.max(Number(spec.height) || 512, 1), MAX_CANVAS_DIMENSION),
    backgroundColor: spec.backgroundColor || 'transparent',
    styleProfile: spec.styleProfile || 'educational_cartoon',
    lighting: spec.lighting || 'daylight',
    detailLevel: spec.detailLevel || 'medium',
    palette: spec.palette || null,
    defs: spec.defs || null,
    anchors: spec.anchors || null,
    pivots: spec.pivots || null,
    placementZones: spec.placementZones || null,
    perspective: spec.perspective || null,
    animatableProperties: spec.animatableProperties || null,
    layers: Array.isArray(spec.layers) ? spec.layers : undefined,
    elements: []
  };

  const sanitizeElement = (el) => {
    if (!el || typeof el !== 'object') return null;
    const cleanEl = { ...el };
    for (const key of Object.keys(cleanEl)) {
      if (key.startsWith('on') || key.toLowerCase().includes('javascript') || key.toLowerCase().includes('script')) {
        delete cleanEl[key];
      }
    }
    if (typeof cleanEl.text === 'string') {
      cleanEl.text = escapeXml(cleanEl.text);
    }
    if (Array.isArray(cleanEl.children)) {
      cleanEl.children = cleanEl.children.map(sanitizeElement).filter(Boolean);
    }
    return cleanEl;
  };

  if (Array.isArray(spec.elements)) {
    cleanSpec.elements = spec.elements.map(sanitizeElement).filter(Boolean);
  }

  return cleanSpec;
}

function formatColor(color, defaultColor = 'none') {
  if (!color) return defaultColor;
  if (typeof color === 'string' && color.startsWith('url(')) return color;
  return escapeXml(color);
}

function buildTransform(t = {}) {
  if (!t) return null;
  if (typeof t === 'string') return escapeXml(t);
  const parts = [];
  if (Array.isArray(t.translate) && t.translate.length >= 2) {
    parts.push(`translate(${Number(t.translate[0]) || 0}, ${Number(t.translate[1]) || 0})`);
  }
  if (t.rotate !== undefined) {
    const rot = Array.isArray(t.rotate) ? t.rotate.map(Number).join(', ') : Number(t.rotate) || 0;
    parts.push(`rotate(${rot})`);
  }
  if (Array.isArray(t.scale) && t.scale.length >= 1) {
    const sx = Number(t.scale[0]) ?? 1;
    const sy = t.scale[1] !== undefined ? Number(t.scale[1]) : sx;
    parts.push(`scale(${sx}, ${sy})`);
  }
  if (t.skewX !== undefined) {
    const sk = Array.isArray(t.skewX) ? Number(t.skewX[0]) : Number(t.skewX);
    if (!Number.isNaN(sk)) parts.push(`skewX(${sk})`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

function resolveBezierPath(el) {
  if (el.d) return String(el.d);
  // Support declarative curve/bezier points: { points: [[x0,y0], [cx1,cy1], [cx2,cy2], [x1,y1]] }
  const pts = Array.isArray(el.points) ? el.points : [];
  if (pts.length === 3) {
    return `M ${pts[0][0]} ${pts[0][1]} Q ${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`;
  }
  if (pts.length >= 4) {
    return `M ${pts[0][0]} ${pts[0][1]} C ${pts[1][0]} ${pts[1][1]}, ${pts[2][0]} ${pts[2][1]}, ${pts[3][0]} ${pts[3][1]}`;
  }
  return '';
}

function renderElement(el) {
  if (!el || typeof el !== 'object' || el.visible === false) return '';
  const type = String(el.type || '').toLowerCase();
  const idAttr = el.id ? ` id="${escapeXml(el.id)}"` : '';
  const opAttr = el.opacity !== undefined ? ` opacity="${Number(el.opacity)}"` : '';
  const transStr = buildTransform(el.transform);
  const transAttr = transStr ? ` transform="${transStr}"` : '';
  const strokeAttr = el.stroke ? ` stroke="${formatColor(el.stroke)}"` : '';
  const strokeWidthAttr = el.strokeWidth !== undefined ? ` stroke-width="${Number(el.strokeWidth)}"` : '';
  const strokeCapAttr = el.strokeLinecap ? ` stroke-linecap="${escapeXml(el.strokeLinecap)}"` : '';
  const strokeJoinAttr = el.strokeLinejoin ? ` stroke-linejoin="${escapeXml(el.strokeLinejoin)}"` : '';
  const dashAttr = el.strokeDasharray ? ` stroke-dasharray="${escapeXml(el.strokeDasharray)}"` : '';
  const fillAttr = el.fill ? ` fill="${formatColor(el.fill)}"` : ' fill="none"';
  const clipAttr = el.clipPath ? ` clip-path="url(#${escapeXml(el.clipPath)})"` : '';
  const maskAttr = el.mask ? ` mask="url(#${escapeXml(el.mask)})"` : '';
  const filterAttr = el.shadow ? ` filter="url(#__v52_soft_shadow)"` : '';

  switch (type) {
    case 'rect':
    case 'rounded_rect': {
      const rx = el.rx !== undefined ? Number(el.rx) : (type === 'rounded_rect' ? (Number(el.radius) || 8) : 0);
      const ry = el.ry !== undefined ? Number(el.ry) : rx;
      const rxAttr = rx > 0 ? ` rx="${rx}" ry="${ry}"` : '';
      return `<rect${idAttr} x="${Number(el.x) || 0}" y="${Number(el.y) || 0}" width="${Number(el.width) || 0}" height="${Number(el.height) || 0}"${rxAttr}${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeJoinAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}${filterAttr} />`;
    }
    case 'circle': {
      return `<circle${idAttr} cx="${Number(el.cx) || 0}" cy="${Number(el.cy) || 0}" r="${Number(el.r) || 0}"${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}${filterAttr} />`;
    }
    case 'ellipse': {
      return `<ellipse${idAttr} cx="${Number(el.cx) || 0}" cy="${Number(el.cy) || 0}" rx="${Number(el.rx) || 0}" ry="${Number(el.ry) || 0}"${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}${filterAttr} />`;
    }
    case 'line': {
      return `<line${idAttr} x1="${Number(el.x1) || 0}" y1="${Number(el.y1) || 0}" x2="${Number(el.x2) || 0}" y2="${Number(el.y2) || 0}"${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${dashAttr}${opAttr}${transAttr} />`;
    }
    case 'polygon': {
      const points = Array.isArray(el.points) ? el.points.map(p => Array.isArray(p) ? `${p[0]},${p[1]}` : String(p)).join(' ') : escapeXml(el.points || '');
      return `<polygon${idAttr} points="${points}"${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeJoinAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}${filterAttr} />`;
    }
    case 'polyline': {
      const points = Array.isArray(el.points) ? el.points.map(p => Array.isArray(p) ? `${p[0]},${p[1]}` : String(p)).join(' ') : escapeXml(el.points || '');
      return `<polyline${idAttr} points="${points}" fill="none"${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${strokeJoinAttr}${dashAttr}${opAttr}${transAttr} />`;
    }
    case 'path':
    case 'bezier':
    case 'curve': {
      const d = escapeXml(resolveBezierPath(el));
      return `<path${idAttr} d="${d}"${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${strokeJoinAttr}${dashAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}${filterAttr} />`;
    }
    case 'text': {
      const fs = el.fontSize ? ` font-size="${Number(el.fontSize)}"` : ' font-size="16"';
      const ff = el.fontFamily ? ` font-family="${escapeXml(el.fontFamily)}"` : ' font-family="sans-serif"';
      const fw = el.fontWeight ? ` font-weight="${escapeXml(el.fontWeight)}"` : '';
      const ta = el.textAnchor ? ` text-anchor="${escapeXml(el.textAnchor)}"` : '';
      return `<text${idAttr} x="${Number(el.x) || 0}" y="${Number(el.y) || 0}"${fs}${ff}${fw}${ta}${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}>${escapeXml(el.text || '')}</text>`;
    }
    case 'group': {
      const childrenHtml = (Array.isArray(el.children) ? el.children : []).map(renderElement).filter(Boolean).join('\n  ');
      return `<g${idAttr}${opAttr}${transAttr}${clipAttr}${maskAttr}>\n  ${childrenHtml}\n</g>`;
    }
    default:
      return '';
  }
}

function renderDefs(defs = {}, hasAnyShadow = false) {
  const parts = [];
  if (hasAnyShadow) {
    parts.push(`    <filter id="__v52_soft_shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000000" flood-opacity="0.28" />
    </filter>`);
  }

  const gradients = Array.isArray(defs.gradients) ? defs.gradients : [];
  for (const g of gradients) {
    if (!g.id) continue;
    const gType = g.type === 'radial' ? 'radialGradient' : 'linearGradient';
    const coords = g.type === 'radial'
      ? `cx="${g.cx ?? '50%'}" cy="${g.cy ?? '50%'}" r="${g.r ?? '50%'}"`
      : `x1="${g.x1 ?? '0%'}" y1="${g.y1 ?? '0%'}" x2="${g.x2 ?? '0%'}" y2="${g.y2 ?? '100%'}"`;
    const stops = (Array.isArray(g.stops) ? g.stops : []).map(s => {
      const off = s.offset !== undefined ? (typeof s.offset === 'number' ? `${Math.round(s.offset * 100)}%` : s.offset) : '0%';
      const op = s.opacity !== undefined ? ` stop-opacity="${Number(s.opacity)}"` : '';
      return `<stop offset="${escapeXml(off)}" stop-color="${escapeXml(s.color || '#000')}"${op} />`;
    }).join('\n      ');
    parts.push(`    <${gType} id="${escapeXml(g.id)}" ${coords}>\n      ${stops}\n    </${gType}>`);
  }

  const clipPaths = Array.isArray(defs.clipPaths) ? defs.clipPaths : [];
  for (const c of clipPaths) {
    if (!c.id) continue;
    const elSvg = c.element ? renderElement(c.element) : (Array.isArray(c.elements) ? c.elements.map(renderElement).join('') : '');
    parts.push(`    <clipPath id="${escapeXml(c.id)}">\n      ${elSvg}\n    </clipPath>`);
  }

  const masks = Array.isArray(defs.masks) ? defs.masks : [];
  for (const m of masks) {
    if (!m.id) continue;
    const elSvg = m.element ? renderElement(m.element) : (Array.isArray(m.elements) ? m.elements.map(renderElement).join('') : '');
    parts.push(`    <mask id="${escapeXml(m.id)}">\n      ${elSvg}\n    </mask>`);
  }

  const patterns = Array.isArray(defs.patterns) ? defs.patterns : [];
  for (const p of patterns) {
    if (!p.id) continue;
    const pw = Number(p.width) || 24;
    const ph = Number(p.height) || 24;
    const elSvg = Array.isArray(p.elements) ? p.elements.map(renderElement).join('') : '';
    parts.push(`    <pattern id="${escapeXml(p.id)}" width="${pw}" height="${ph}" patternUnits="userSpaceOnUse">\n      ${elSvg}\n    </pattern>`);
  }

  return parts.length > 0 ? `  <defs>\n${parts.join('\n')}\n  </defs>\n` : '';
}

function specHasShadow(elements = []) {
  for (const el of elements) {
    if (!el) continue;
    if (el.shadow) return true;
    if (Array.isArray(el.children) && specHasShadow(el.children)) return true;
  }
  return false;
}

/**
 * Converts a declarative vector JSON specification into valid SVG markup string.
 */
export function renderToSvg(vectorSpec = {}, options = {}) {
  const validation = validateVectorSpec(vectorSpec);
  if (!validation.valid) {
    throw new Error(`Invalid Vector Spec: ${validation.errors.join('; ')}`);
  }

  const width = vectorSpec.width || 1024;
  const height = vectorSpec.height || 1024;
  const viewBox = vectorSpec.viewBox || `0 0 ${width} ${height}`;

  const rawElements = Array.isArray(vectorSpec.elements) && vectorSpec.elements.length > 0
    ? vectorSpec.elements
    : (Array.isArray(vectorSpec.layers) ? vectorSpec.layers.map(l => ({ type: 'group', id: l.id, children: l.elements || [] })) : []);

  const defsSection = renderDefs(vectorSpec.defs || {}, specHasShadow(rawElements));

  let bgRect = '';
  if (vectorSpec.backgroundColor && vectorSpec.backgroundColor !== 'transparent') {
    bgRect = `  <rect width="100%" height="100%" fill="${escapeXml(vectorSpec.backgroundColor)}" />\n`;
  }

  const elements = rawElements
    .map(el => `  ${renderElement(el)}`)
    .filter(Boolean)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">\n${defsSection}${bgRect}${elements}\n</svg>`;
}

// ============================================================================
// DIRECT HTML5 CANVAS 2D VECTOR RENDERER (UNIFIED WITH SVG/PNG EXPORT)
// ============================================================================

function parseGradCoord(val, max) {
  if (typeof val === 'number') return val;
  const s = String(val || '0%').trim();
  if (s.endsWith('%')) return (parseFloat(s) / 100) * max;
  return parseFloat(s) || 0;
}

function resolveCanvasColor(ctx, colorStr, defsMap, w, h) {
  if (!colorStr || colorStr === 'none') return null;
  if (typeof colorStr === 'string' && colorStr.startsWith('url(#')) {
    const id = colorStr.slice(5, -1);
    const g = defsMap.gradients.get(id);
    if (g) {
      let grad;
      if (g.type === 'radial') {
        const cx = parseGradCoord(g.cx ?? '50%', w);
        const cy = parseGradCoord(g.cy ?? '50%', h);
        const r = parseGradCoord(g.r ?? '50%', Math.max(w, h));
        grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      } else {
        const x1 = parseGradCoord(g.x1 ?? '0%', w);
        const y1 = parseGradCoord(g.y1 ?? '0%', h);
        const x2 = parseGradCoord(g.x2 ?? '0%', w);
        const y2 = parseGradCoord(g.y2 ?? '100%', h);
        grad = ctx.createLinearGradient(x1, y1, x2, y2);
      }
      for (const s of (g.stops || [])) {
        const off = typeof s.offset === 'number' ? s.offset : (parseFloat(String(s.offset || '0').replace('%', '')) / 100);
        grad.addColorStop(Math.max(0, Math.min(1, off)), s.color || '#000');
      }
      return grad;
    }
    const pat = defsMap.patterns.get(id);
    if (pat && typeof document !== 'undefined') {
      const pc = document.createElement('canvas');
      pc.width = Number(pat.width) || 24;
      pc.height = Number(pat.height) || 24;
      const pctx = pc.getContext('2d');
      for (const el of (pat.elements || [])) {
        drawCanvasElement(pctx, el, defsMap, pc.width, pc.height);
      }
      return ctx.createPattern(pc, 'repeat');
    }
    return '#94a3b8';
  }
  return colorStr;
}

function applyCanvasTransform(ctx, t) {
  if (!t || typeof t !== 'object') return;
  if (Array.isArray(t.translate) && t.translate.length >= 2) {
    ctx.translate(Number(t.translate[0]) || 0, Number(t.translate[1]) || 0);
  }
  if (t.rotate !== undefined) {
    const deg = Array.isArray(t.rotate) ? Number(t.rotate[0]) : Number(t.rotate);
    if (Array.isArray(t.rotate) && t.rotate.length >= 3) {
      ctx.translate(Number(t.rotate[1]) || 0, Number(t.rotate[2]) || 0);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.translate(-(Number(t.rotate[1]) || 0), -(Number(t.rotate[2]) || 0));
    } else {
      ctx.rotate(((deg || 0) * Math.PI) / 180);
    }
  }
  if (Array.isArray(t.scale) && t.scale.length >= 1) {
    const sx = Number(t.scale[0]) ?? 1;
    const sy = t.scale[1] !== undefined ? Number(t.scale[1]) : sx;
    ctx.scale(sx, sy);
  }
}

function traceCanvasShape(ctx, el) {
  const type = String(el.type || '').toLowerCase();
  switch (type) {
    case 'rect':
    case 'rounded_rect': {
      const x = Number(el.x) || 0;
      const y = Number(el.y) || 0;
      const w = Number(el.width) || 0;
      const h = Number(el.height) || 0;
      const r = Math.min(Number(el.rx ?? (type === 'rounded_rect' ? (el.radius ?? 8) : 0)) || 0, w / 2, h / 2);
      ctx.beginPath();
      if (r > 0) {
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
      } else {
        ctx.rect(x, y, w, h);
      }
      return true;
    }
    case 'circle': {
      ctx.beginPath();
      ctx.arc(Number(el.cx) || 0, Number(el.cy) || 0, Math.max(0, Number(el.r) || 0), 0, Math.PI * 2);
      return true;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(Number(el.cx) || 0, Number(el.cy) || 0, Math.max(0, Number(el.rx) || 0), Math.max(0, Number(el.ry) || 0), 0, 0, Math.PI * 2);
      return true;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(Number(el.x1) || 0, Number(el.y1) || 0);
      ctx.lineTo(Number(el.x2) || 0, Number(el.y2) || 0);
      return true;
    }
    case 'polygon':
    case 'polyline': {
      const pts = Array.isArray(el.points) ? el.points : [];
      if (pts.length === 0) return false;
      ctx.beginPath();
      ctx.moveTo(Number(pts[0][0]) || 0, Number(pts[0][1]) || 0);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(Number(pts[i][0]) || 0, Number(pts[i][1]) || 0);
      }
      if (type === 'polygon') ctx.closePath();
      return true;
    }
    default:
      return false;
  }
}

function drawCanvasElement(ctx, el, defsMap, w, h, layerOverride = null) {
  if (!el || typeof el !== 'object' || el.visible === false) return;
  const type = String(el.type || '').toLowerCase();

  ctx.save();
  if (el.opacity !== undefined) ctx.globalAlpha *= Number(el.opacity);
  if (layerOverride) {
    if (layerOverride.visible === false) { ctx.restore(); return; }
    if (layerOverride.opacity !== undefined) ctx.globalAlpha *= Number(layerOverride.opacity);
    if (layerOverride.position) ctx.translate(Number(layerOverride.position[0]) || 0, Number(layerOverride.position[1]) || 0);
    if (layerOverride.rotation) ctx.rotate((Number(layerOverride.rotation) * Math.PI) / 180);
    if (layerOverride.scale !== undefined) {
      const sc = Array.isArray(layerOverride.scale) ? layerOverride.scale : [layerOverride.scale, layerOverride.scale];
      ctx.scale(Number(sc[0]) || 1, Number(sc[1]) || 1);
    }
  }
  applyCanvasTransform(ctx, el.transform);

  if (el.clipPath && defsMap.clipPaths.has(el.clipPath)) {
    const clipDef = defsMap.clipPaths.get(el.clipPath);
    const clipEl = clipDef.element || (clipDef.elements && clipDef.elements[0]);
    if (clipEl && traceCanvasShape(ctx, clipEl)) {
      ctx.clip();
    }
  }

  if (type === 'group') {
    for (const child of (el.children || [])) {
      drawCanvasElement(ctx, child, defsMap, w, h);
    }
    ctx.restore();
    return;
  }

  if (type === 'text') {
    const fill = resolveCanvasColor(ctx, el.fill, defsMap, w, h);
    ctx.font = `${el.fontWeight || '600'} ${Number(el.fontSize) || 16}px ${el.fontFamily || 'sans-serif'}`;
    ctx.textAlign = el.textAnchor === 'middle' ? 'center' : (el.textAnchor === 'end' ? 'right' : 'left');
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillText(String(el.text || ''), Number(el.x) || 0, Number(el.y) || 0);
    }
    ctx.restore();
    return;
  }

  if (el.shadow) {
    const sh = typeof el.shadow === 'object' ? el.shadow : {};
    ctx.shadowColor = sh.color || 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = Number(sh.blur ?? 8);
    ctx.shadowOffsetX = Number(sh.dx ?? 0);
    ctx.shadowOffsetY = Number(sh.dy ?? 5);
  }

  const fillVal = (layerOverride?.color && el.fill && el.fill !== 'none') ? layerOverride.color : el.fill;
  const fill = resolveCanvasColor(ctx, fillVal, defsMap, w, h);
  const stroke = resolveCanvasColor(ctx, el.stroke, defsMap, w, h);
  if (el.strokeLinecap) ctx.lineCap = el.strokeLinecap;
  if (el.strokeLinejoin) ctx.lineJoin = el.strokeLinejoin;
  if (el.strokeDasharray && ctx.setLineDash) {
    const segs = String(el.strokeDasharray).split(/[\s,]+/).map(Number).filter(n => !Number.isNaN(n));
    if (segs.length > 0) ctx.setLineDash(segs);
  }

  if (type === 'path' || type === 'bezier' || type === 'curve') {
    const d = resolveBezierPath(el);
    if (d && typeof Path2D !== 'undefined') {
      const p2d = new Path2D(d);
      if (fill) { ctx.fillStyle = fill; ctx.fill(p2d); }
      ctx.shadowColor = 'transparent';
      if (stroke && (el.strokeWidth === undefined || Number(el.strokeWidth) > 0)) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = Number(el.strokeWidth) || 2;
        ctx.stroke(p2d);
      }
    }
  } else if (traceCanvasShape(ctx, el)) {
    if (fill && type !== 'line' && type !== 'polyline') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.shadowColor = 'transparent';
    if (stroke && (el.strokeWidth === undefined || Number(el.strokeWidth) > 0)) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = Number(el.strokeWidth) || 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/**
 * Renders a V5.1/V5.2 declarative vectorSpec directly onto an HTML5 Canvas 2D context.
 * Supports per-layer overrides: options.layerOverrides = { [layerId]: { position, rotation, scale, opacity, color, visible } }
 */
export function renderToCanvas2d(ctx, vectorSpec = {}, options = {}) {
  const validation = validateVectorSpec(vectorSpec);
  if (!validation.valid) {
    throw new Error(`Invalid Vector Spec: ${validation.errors.join('; ')}`);
  }

  const w = vectorSpec.width || 1024;
  const h = vectorSpec.height || 1024;
  const defs = vectorSpec.defs || {};
  const defsMap = {
    gradients: new Map((defs.gradients || []).map(g => [g.id, g])),
    clipPaths: new Map((defs.clipPaths || []).map(c => [c.id, c])),
    patterns: new Map((defs.patterns || []).map(p => [p.id, p]))
  };
  const layerOverrides = options.layerOverrides || {};

  ctx.save();
  if (options.targetWidth && options.targetHeight) {
    ctx.scale(options.targetWidth / w, options.targetHeight / h);
  }
  if (vectorSpec.backgroundColor && vectorSpec.backgroundColor !== 'transparent') {
    ctx.fillStyle = vectorSpec.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }

  if (Array.isArray(vectorSpec.layers) && vectorSpec.layers.length > 0 && (!vectorSpec.elements || options.useLayers)) {
    const sorted = [...vectorSpec.layers].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    for (const layer of sorted) {
      const ov = layerOverrides[layer.id] || null;
      if (ov?.visible === false) continue;
      for (const el of (layer.elements || [])) {
        drawCanvasElement(ctx, el, defsMap, w, h, ov);
      }
    }
  } else {
    for (const el of (vectorSpec.elements || [])) {
      const ov = el.id ? layerOverrides[el.id] : null;
      drawCanvasElement(ctx, el, defsMap, w, h, ov);
    }
  }

  ctx.restore();
}
