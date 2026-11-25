// scripts/generate-phase4-assets.mjs
// Generates valid 32-bit transparent PNG preview & thumbnail files for all 8 Phase 4 Composite Actions,
// and ensures data/assets/ contains the updated composite_action metadata.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { COMPOSITE_ACTION_TEMPLATES } from '../thanhhai-2d-studio/engine/action-engine-v4.js';

// CRC32 implementation for PNG chunks
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function createPngBuffer(width, height, r, g, b, a = 255) {
  const rowBytes = width * 4 + 1; // 1 filter byte + RGBA pixels
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw a subtle border & icon pattern
      const isBorder = (x < 3 || x >= width - 3 || y < 3 || y >= height - 3);
      const isCenter = Math.hypot(x - width / 2, y - height / 2) < (width * 0.38);

      if (isBorder) {
        rawData[pxOffset] = 32;
        rawData[pxOffset + 1] = 32;
        rawData[pxOffset + 2] = 42;
        rawData[pxOffset + 3] = 255;
      } else if (isCenter) {
        rawData[pxOffset] = r;
        rawData[pxOffset + 1] = g;
        rawData[pxOffset + 2] = b;
        rawData[pxOffset + 3] = a;
      } else {
        // Semi-transparent background
        rawData[pxOffset] = 240;
        rawData[pxOffset + 1] = 244;
        rawData[pxOffset + 2] = 248;
        rawData[pxOffset + 3] = 220;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

const ACTION_COLORS = {
  composite_fight_cloud: [239, 68, 68], // Red
  composite_chase: [59, 130, 246], // Blue
  composite_power_up: [245, 158, 11], // Gold
  composite_funny_fall: [234, 179, 8], // Yellow
  composite_shock_reaction: [168, 85, 247], // Purple
  composite_cartoon_argument: [249, 115, 22], // Orange
  composite_object_interaction: [16, 185, 129], // Emerald
  composite_storytelling: [14, 165, 233] // Sky blue
};

const BASE_DIR = process.cwd();
const DATA_DIR = path.join(BASE_DIR, 'data', 'assets');
const PUBLIC_DIR = path.join(BASE_DIR, 'public', 'assets', 'composite_action');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

for (const [id, tmpl] of Object.entries(COMPOSITE_ACTION_TEMPLATES)) {
  const assetDir = path.join(PUBLIC_DIR, id);
  if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

  const color = ACTION_COLORS[id] || [100, 116, 139];
  const thumbBuf = createPngBuffer(128, 128, color[0], color[1], color[2], 255);
  const actionBuf = createPngBuffer(256, 256, color[0], color[1], color[2], 255);

  fs.writeFileSync(path.join(assetDir, 'thumb.png'), thumbBuf);
  fs.writeFileSync(path.join(assetDir, 'action.png'), actionBuf);

  // Write/update data/assets/<id>.json
  const assetData = {
    id: tmpl.id,
    name: tmpl.name,
    type: 'composite_action',
    category: tmpl.category,
    description: tmpl.description,
    duration: tmpl.duration,
    participants: tmpl.roles ? tmpl.roles.length : 1,
    roles: tmpl.roles,
    parameters: tmpl.parameters,
    tracks: [
      { target: 'participants', type: 'composite_motion', start: 0.0, end: tmpl.duration }
    ],
    compatibility: { bodyProfile: ['all'] },
    isBuiltin: true,
    version: 1,
    thumbnail: `/public/assets/composite_action/${id}/thumb.png`,
    filePath: `/public/assets/composite_action/${id}/action.png`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(DATA_DIR, `${id}.json`), JSON.stringify(assetData, null, 2), 'utf-8');
  console.log(`Generated media & asset record for: ${id}`);
}

console.log('All 8 Phase 4 Composite Action media assets generated successfully!');

