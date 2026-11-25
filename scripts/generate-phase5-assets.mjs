// scripts/generate-phase5-assets.mjs
// Generates valid 32-bit transparent PNG preview & thumbnail files for Phase 5 Outfits and Accessories,
// and ensures data/assets/ contains the updated outfit & accessory metadata for the Asset Registry.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { OUTFIT_LIBRARY, ACCESSORIES_CATALOG } from '../thanhhai-2d-studio/engine/outfit-engine-v4.js';

// CRC32 implementation for standard PNG chunks
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

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function hexToRgba(hex, alpha = 255) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
    a: alpha
  };
}

function createOutfitPngBuffer(width, height, mainColorHex, secColorHex, accentColorHex) {
  const main = hexToRgba(mainColorHex || '#f8fafc');
  const sec = hexToRgba(secColorHex || '#1e293b');
  const accent = hexToRgba(accentColorHex || '#3b82f6');

  const rowBytes = width * 4 + 1;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      const isBorder = (x < 2 || x >= width - 2 || y < 2 || y >= height - 2);
      const cx = width / 2;
      const cy = height / 2;

      // Draw stylized torso and clothes shape
      const inTorso = (x >= cx - 35 && x <= cx + 35 && y >= cy - 40 && y <= cy + 15);
      const inCollar = (y >= cy - 40 && y <= cy - 25 && Math.abs(x - cx) <= (y - (cy - 40)) * 1.2);
      const inLegs = (x >= cx - 28 && x <= cx + 28 && y > cy + 15 && y <= cy + 60 && Math.abs(x - cx) >= 4);
      const inShoes = (x >= cx - 32 && x <= cx + 32 && y > cy + 60 && y <= cy + 72);
      const inTieOrAccent = (y >= cy - 25 && y <= cy && Math.abs(x - cx) <= 5);

      if (isBorder) {
        rawData[pxOffset] = 32;
        rawData[pxOffset + 1] = 32;
        rawData[pxOffset + 2] = 42;
        rawData[pxOffset + 3] = 200;
      } else if (inTieOrAccent) {
        rawData[pxOffset] = accent.r;
        rawData[pxOffset + 1] = accent.g;
        rawData[pxOffset + 2] = accent.b;
        rawData[pxOffset + 3] = 255;
      } else if (inCollar) {
        rawData[pxOffset] = 250;
        rawData[pxOffset + 1] = 250;
        rawData[pxOffset + 2] = 250;
        rawData[pxOffset + 3] = 255;
      } else if (inTorso) {
        rawData[pxOffset] = main.r;
        rawData[pxOffset + 1] = main.g;
        rawData[pxOffset + 2] = main.b;
        rawData[pxOffset + 3] = 255;
      } else if (inLegs) {
        rawData[pxOffset] = sec.r;
        rawData[pxOffset + 1] = sec.g;
        rawData[pxOffset + 2] = sec.b;
        rawData[pxOffset + 3] = 255;
      } else if (inShoes) {
        rawData[pxOffset] = 24;
        rawData[pxOffset + 1] = 24;
        rawData[pxOffset + 2] = 27;
        rawData[pxOffset + 3] = 255;
      } else {
        // Transparent background
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    sig,
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

function createAccessoryPngBuffer(width, height, colorHex, type) {
  const col = hexToRgba(colorHex || '#fbbf24');
  const rowBytes = width * 4 + 1;
  const rawData = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);

      let isDrawn = false;
      if (type.includes('glasses') || type.includes('goggles')) {
        // Two circular rims
        const d1 = Math.hypot(x - (cx - 20), y - cy);
        const d2 = Math.hypot(x - (cx + 20), y - cy);
        isDrawn = (d1 >= 10 && d1 <= 15) || (d2 >= 10 && d2 <= 15) || (Math.abs(y - cy) <= 2 && Math.abs(x - cx) <= 20);
      } else if (type.includes('crown')) {
        // Crown shape
        const inBase = (Math.abs(x - cx) <= 30 && y >= cy + 10 && y <= cy + 20);
        const inPoints = (Math.abs(x - cx) <= 30 && y >= cy - 15 && y <= cy + 10 && ((x - cx) % 15 === 0 || y > cy));
        isDrawn = inBase || inPoints;
      } else {
        // Beanie / circle
        isDrawn = dist <= 28 && y <= cy + 15;
      }

      if (isDrawn) {
        rawData[pxOffset] = col.r;
        rawData[pxOffset + 1] = col.g;
        rawData[pxOffset + 2] = col.b;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  return Buffer.concat([
    sig,
    createChunk('IHDR', ihdrData),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

// 1. Generate Outfit Assets
const publicOutfitDir = path.resolve(process.cwd(), 'public', 'assets', 'outfit');
const dataAssetsDir = path.resolve(process.cwd(), 'data', 'assets');
fs.mkdirSync(publicOutfitDir, { recursive: true });
fs.mkdirSync(dataAssetsDir, { recursive: true });

for (const [outfitId, spec] of Object.entries(OUTFIT_LIBRARY)) {
  const dir = path.join(publicOutfitDir, outfitId);
  fs.mkdirSync(dir, { recursive: true });

  const thumbBuf = createOutfitPngBuffer(140, 180, spec.color, spec.legs, spec.tieColor || spec.penColor);
  fs.writeFileSync(path.join(dir, 'thumb.png'), thumbBuf);
  fs.writeFileSync(path.join(dir, 'outfit.png'), thumbBuf);

  const assetJson = {
    id: outfitId,
    name: spec.name,
    type: 'outfit',
    category: spec.category || 'general',
    version: 1,
    thumbnail: `/public/assets/outfit/${outfitId}/thumb.png`,
    filePath: `/public/assets/outfit/${outfitId}/outfit.png`,
    tags: ['outfit', spec.category || 'clothing', 'phase5', spec.top || 'modular'],
    description: spec.description || '',
    dimensions: { width: 140, height: 180, scale: 1.0 },
    anchor: [70, 90],
    slots: spec.slots || {},
    occlusionMasks: spec.occlusionMasks || {},
    variants: spec.variants || [],
    compatibility: {
      bodyProfile: spec.compatibleProfiles || ['white_cartoon', 'chibi_standard'],
      requires: []
    },
    license: 'Proprietary',
    author: 'Thanh Hai 2D Studio',
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(dataAssetsDir, `${outfitId}.json`), JSON.stringify(assetJson, null, 2), 'utf-8');
  console.log(`[Phase 5 Outfit] Created: ${outfitId}`);
}

// 2. Generate Accessory Assets
for (const [accId, spec] of Object.entries(ACCESSORIES_CATALOG)) {
  const dir = path.join(publicOutfitDir, accId);
  fs.mkdirSync(dir, { recursive: true });

  const thumbBuf = createAccessoryPngBuffer(100, 100, spec.color, spec.id);
  fs.writeFileSync(path.join(dir, 'thumb.png'), thumbBuf);
  fs.writeFileSync(path.join(dir, 'accessory.png'), thumbBuf);

  const assetJson = {
    id: accId,
    name: spec.name,
    type: 'outfit',
    category: 'accessory',
    version: 1,
    thumbnail: `/public/assets/outfit/${accId}/thumb.png`,
    filePath: `/public/assets/outfit/${accId}/accessory.png`,
    tags: ['accessory', spec.slot, 'phase5', 'wearable'],
    description: spec.description || '',
    dimensions: { width: 100, height: 100, scale: 1.0 },
    anchor: [50, 50],
    slot: spec.slot,
    layer: spec.layer,
    compatibility: {
      bodyProfile: ['white_cartoon', 'chibi_standard', 'imported_custom', 'simple_doodle'],
      requires: [spec.slot === 'headwear' ? 'head_anchor' : 'face_anchor']
    },
    license: 'Proprietary',
    author: 'Thanh Hai 2D Studio',
    isBuiltin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(path.join(dataAssetsDir, `${accId}.json`), JSON.stringify(assetJson, null, 2), 'utf-8');
  console.log(`[Phase 5 Accessory] Created: ${accId}`);
}

console.log('✅ Phase 5 Outfit & Accessory Asset Generation Finished Successfully!');
