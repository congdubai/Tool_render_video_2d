// engine/v5-vector-engine.js — Universal Vector Drawing Engine (V5.1)
// Interprets declarative JSON geometry into safe, production-grade vector SVG and PNG assets.
// Strictly declarative: no external network requests, no dynamic code execution, full layer support.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_PRIMITIVES = 2500;
export const MAX_GROUP_DEPTH = 10;
export const MAX_CANVAS_DIMENSION = 4096;

/**
 * Validates a declarative vector JSON specification against security and schema constraints.
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

  const elements = Array.isArray(spec.elements) ? spec.elements : [];
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
    const validTypes = new Set([
      'rect', 'rounded_rect', 'circle', 'ellipse', 'line',
      'polygon', 'polyline', 'path', 'text', 'group'
    ]);
    if (!validTypes.has(type)) {
      errors.push(`Unsupported element type: "${type}".`);
    }

    // Safety checks for injections
    for (const [k, v] of Object.entries(el)) {
      if (typeof v === 'string') {
        const valLower = v.toLowerCase();
        if (valLower.includes('<script') || valLower.includes('javascript:') || valLower.includes('data:text/html') || valLower.includes('onload=') || valLower.includes('onerror=')) {
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

/**
 * Escapes unsafe characters for XML/SVG output
 */
export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats a CSS color or gradient reference
 */
function formatColor(color, defaultColor = 'none') {
  if (!color) return defaultColor;
  if (color.startsWith('url(')) return color;
  return escapeXml(color);
}

/**
 * Converts a transform descriptor into an SVG transform string
 */
function buildTransform(t = {}) {
  if (typeof t === 'string') return escapeXml(t);
  const parts = [];
  if (Array.isArray(t.translate) && t.translate.length >= 2) {
    parts.push(`translate(${t.translate[0]}, ${t.translate[1]})`);
  }
  if (t.rotate !== undefined) {
    const rot = Array.isArray(t.rotate) ? t.rotate.join(', ') : t.rotate;
    parts.push(`rotate(${rot})`);
  }
  if (Array.isArray(t.scale) && t.scale.length >= 1) {
    const sy = t.scale[1] !== undefined ? t.scale[1] : t.scale[0];
    parts.push(`scale(${t.scale[0]}, ${sy})`);
  }
  if (Array.isArray(t.skewX)) {
    parts.push(`skewX(${t.skewX})`);
  }
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Renders a single vector element into SVG markup
 */
function renderElement(el) {
  if (!el || typeof el !== 'object') return '';
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

  switch (type) {
    case 'rect':
    case 'rounded_rect': {
      const rx = el.rx !== undefined ? el.rx : (type === 'rounded_rect' ? (el.radius || 8) : 0);
      const ry = el.ry !== undefined ? el.ry : rx;
      const rxAttr = rx > 0 ? ` rx="${rx}" ry="${ry}"` : '';
      return `<rect${idAttr} x="${Number(el.x) || 0}" y="${Number(el.y) || 0}" width="${Number(el.width) || 0}" height="${Number(el.height) || 0}"${rxAttr}${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeJoinAttr}${opAttr}${transAttr}${clipAttr} />`;
    }
    case 'circle': {
      return `<circle${idAttr} cx="${Number(el.cx) || 0}" cy="${Number(el.cy) || 0}" r="${Number(el.r) || 0}"${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}${clipAttr} />`;
    }
    case 'ellipse': {
      return `<ellipse${idAttr} cx="${Number(el.cx) || 0}" cy="${Number(el.cy) || 0}" rx="${Number(el.rx) || 0}" ry="${Number(el.ry) || 0}"${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}${clipAttr} />`;
    }
    case 'line': {
      return `<line${idAttr} x1="${Number(el.x1) || 0}" y1="${Number(el.y1) || 0}" x2="${Number(el.x2) || 0}" y2="${Number(el.y2) || 0}"${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${dashAttr}${opAttr}${transAttr} />`;
    }
    case 'polygon': {
      const points = Array.isArray(el.points) ? el.points.map(p => Array.isArray(p) ? `${p[0]},${p[1]}` : String(p)).join(' ') : escapeXml(el.points || '');
      return `<polygon${idAttr} points="${points}"${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeJoinAttr}${opAttr}${transAttr}${clipAttr} />`;
    }
    case 'polyline': {
      const points = Array.isArray(el.points) ? el.points.map(p => Array.isArray(p) ? `${p[0]},${p[1]}` : String(p)).join(' ') : escapeXml(el.points || '');
      return `<polyline${idAttr} points="${points}" fill="none"${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${strokeJoinAttr}${dashAttr}${opAttr}${transAttr} />`;
    }
    case 'path': {
      const d = escapeXml(el.d || '');
      return `<path${idAttr} d="${d}"${fillAttr}${strokeAttr}${strokeWidthAttr}${strokeCapAttr}${strokeJoinAttr}${opAttr}${transAttr}${clipAttr} />`;
    }
    case 'text': {
      const fs = el.fontSize ? ` font-size="${Number(el.fontSize)}"` : ' font-size="16"';
      const ff = el.fontFamily ? ` font-family="${escapeXml(el.fontFamily)}"` : ' font-family="sans-serif"';
      const fw = el.fontWeight ? ` font-weight="${escapeXml(el.fontWeight)}"` : '';
      const ta = el.textAnchor ? ` text-anchor="${escapeXml(el.textAnchor)}"` : '';
      return `<text${idAttr} x="${Number(el.x) || 0}" y="${Number(el.y) || 0}"${fs}${ff}${fw}${ta}${fillAttr}${strokeAttr}${strokeWidthAttr}${opAttr}${transAttr}>${escapeXml(el.text || '')}</text>`;
    }
    case 'group': {
      const childrenHtml = (Array.isArray(el.children) ? el.children : []).map(renderElement).join('\n  ');
      return `<g${idAttr}${opAttr}${transAttr}${clipAttr}>\n  ${childrenHtml}\n</g>`;
    }
    default:
      return '';
  }
}

/**
 * Builds SVG `<defs>` section for gradients and clip paths
 */
function renderDefs(defs = {}) {
  const parts = [];
  const gradients = Array.isArray(defs.gradients) ? defs.gradients : [];
  for (const g of gradients) {
    if (!g.id) continue;
    const gType = g.type === 'radial' ? 'radialGradient' : 'linearGradient';
    const coords = g.type === 'radial'
      ? `cx="${g.cx ?? '50%'}" cy="${g.cy ?? '50%'}" r="${g.r ?? '50%'}"`
      : `x1="${g.x1 ?? '0%'}" y1="${g.y1 ?? '0%'}" x2="${g.x2 ?? '100%'}" y2="${g.y2 ?? '0%'}"`;
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
    const elSvg = c.element ? renderElement(c.element) : '';
    parts.push(`    <clipPath id="${escapeXml(c.id)}">\n      ${elSvg}\n    </clipPath>`);
  }

  return parts.length > 0 ? `  <defs>\n${parts.join('\n')}\n  </defs>\n` : '';
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
  const defsSection = renderDefs(vectorSpec.defs || {});

  // Background rect if not transparent
  let bgRect = '';
  if (vectorSpec.backgroundColor) {
    bgRect = `  <rect width="100%" height="100%" fill="${escapeXml(vectorSpec.backgroundColor)}" />\n`;
  }

  const elements = (Array.isArray(vectorSpec.elements) ? vectorSpec.elements : [])
    .map(el => `  ${renderElement(el)}`)
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">\n${defsSection}${bgRect}${elements}\n</svg>`;
}

/**
 * Renders a vector JSON specification directly to a PNG Buffer with transparent background.
 */
export async function renderToPngBuffer(vectorSpec = {}, options = {}) {
  const svg = renderToSvg(vectorSpec, options);
  const targetWidth = options.width || vectorSpec.width || 1024;
  const targetHeight = options.height || vectorSpec.height || 1024;

  return await sharp(Buffer.from(svg))
    .resize(targetWidth, targetHeight, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Renders and writes a vector JSON specification directly to a PNG file on disk.
 */
export async function renderToPngFile(vectorSpec = {}, outputPath, options = {}) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const buffer = await renderToPngBuffer(vectorSpec, options);
  fs.writeFileSync(outputPath, buffer);
  return {
    outputPath,
    fileSize: buffer.length,
    width: options.width || vectorSpec.width || 1024,
    height: options.height || vectorSpec.height || 1024
  };
}

/**
 * Sanitizes vector JSON spec, stripping dangerous attributes and script tags.
 */
export function sanitizeVectorSpec(spec = {}) {
  const cleanSpec = {
    width: Math.min(Math.max(Number(spec.width) || 512, 1), MAX_CANVAS_DIMENSION),
    height: Math.min(Math.max(Number(spec.height) || 512, 1), MAX_CANVAS_DIMENSION),
    backgroundColor: spec.backgroundColor || 'transparent',
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
