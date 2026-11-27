// engine/v5-vector-engine.js — Universal Vector Drawing Engine (V5.2 Phase 2)
// Re-exports pure declarative vector renderer (SVG + Canvas 2D) and adds Node.js Sharp PNG output.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {
  MAX_PRIMITIVES,
  MAX_GROUP_DEPTH,
  MAX_CANVAS_DIMENSION,
  VECTOR_SCHEMA_VERSION,
  escapeXml,
  validateVectorSpec,
  sanitizeVectorSpec,
  renderToSvg,
  renderToCanvas2d
} from './v5-vector-canvas.js';

export {
  MAX_PRIMITIVES,
  MAX_GROUP_DEPTH,
  MAX_CANVAS_DIMENSION,
  VECTOR_SCHEMA_VERSION,
  escapeXml,
  validateVectorSpec,
  sanitizeVectorSpec,
  renderToSvg,
  renderToCanvas2d
};

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
