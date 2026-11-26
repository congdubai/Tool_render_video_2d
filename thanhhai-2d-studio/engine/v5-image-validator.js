// engine/v5-image-validator.js — Image Validation & Anchor Assistance (V5 Phase 2)
// Validates image formats, dimensions, aspect ratios, alpha channel transparency,
// computes SHA-256 content hashes, and assists with anchor/pivot coordinates.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ANCHOR_PRESETS = {
  center: { x: 0.5, y: 0.5, name: 'Tâm giữa (Center)' },
  bottom_center: { x: 0.5, y: 1.0, name: 'Chân đế (Bottom Center)' },
  top_center: { x: 0.5, y: 0.0, name: 'Đỉnh giữa (Top Center)' },
  left_center: { x: 0.0, y: 0.5, name: 'Mép trái (Left Center)' },
  right_center: { x: 1.0, y: 0.5, name: 'Mép phải (Right Center)' },
  hand_grip: { x: 0.5, y: 0.85, name: 'Điểm cầm tay (Hand Grip)' },
  ground_contact: { x: 0.5, y: 0.98, name: 'Tiếp xúc mặt sàn (Ground Contact)' }
};

export function validateImageFile(filePath, expectedType = 'prop', options = {}) {
  const result = {
    valid: false,
    filePath,
    fileName: path.basename(filePath),
    format: null,
    fileSize: 0,
    contentHash: null,
    hasAlpha: false,
    dimensions: null,
    warnings: [],
    errors: [],
    recommendedAnchor: ANCHOR_PRESETS.center
  };

  // 1. Existence Check
  if (!fs.existsSync(filePath)) {
    result.errors.push(`File không tồn tại: ${filePath}`);
    return result;
  }

  // 2. Read file stats & size limit (max 50MB)
  const stat = fs.statSync(filePath);
  result.fileSize = stat.size;
  if (result.fileSize === 0) {
    result.errors.push('File rỗng (0 bytes)');
    return result;
  }
  if (result.fileSize > 50 * 1024 * 1024) {
    result.errors.push(`Kích thước file quá lớn (${(result.fileSize / 1024 / 1024).toFixed(1)}MB > 50MB)`);
    return result;
  }

  // 3. Format & Magic bytes check
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);
  
  // Calculate SHA-256 content hash
  result.contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check header signatures
  if (isPng(buffer)) {
    result.format = 'png';
    const pngInfo = parsePngHeader(buffer);
    result.dimensions = pngInfo.dimensions;
    result.hasAlpha = pngInfo.hasAlpha;
  } else if (isJpeg(buffer)) {
    result.format = 'jpeg';
    result.hasAlpha = false; // JPEG does not support alpha
  } else if (isWebp(buffer)) {
    result.format = 'webp';
    result.hasAlpha = parseWebpHasAlpha(buffer);
  } else {
    result.errors.push(`Định dạng không được hỗ trợ (chỉ chấp nhận PNG, JPG, JPEG, WebP)`);
    return result;
  }

  // 4. Alpha transparency validation
  const requiresAlpha = options.requiresAlpha ?? (expectedType === 'prop' || expectedType === 'character' || expectedType === 'outfit' || expectedType === 'illustration');
  if (requiresAlpha && !result.hasAlpha) {
    result.warnings.push(`Tài nguyên loại "${expectedType}" cần nền trong suốt (Alpha Channel), nhưng file hiện tại không có alpha.`);
  }

  // 5. Recommended Anchor Determination
  if (expectedType === 'prop') {
    const fn = result.fileName.toLowerCase();
    if (fn.includes('cup') || fn.includes('mug') || fn.includes('book') || fn.includes('pen') || fn.includes('phone') || fn.includes('wand')) {
      result.recommendedAnchor = ANCHOR_PRESETS.hand_grip;
    } else if (fn.includes('table') || fn.includes('desk') || fn.includes('chair') || fn.includes('computer') || fn.includes('eniac')) {
      result.recommendedAnchor = ANCHOR_PRESETS.ground_contact;
    } else {
      result.recommendedAnchor = ANCHOR_PRESETS.bottom_center;
    }
  } else if (expectedType === 'character') {
    result.recommendedAnchor = ANCHOR_PRESETS.bottom_center;
  } else if (expectedType === 'background') {
    result.recommendedAnchor = ANCHOR_PRESETS.center;
  }

  result.valid = result.errors.length === 0;
  return result;
}

function isPng(buf) {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

function isJpeg(buf) {
  return buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
}

function isWebp(buf) {
  return buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
}

function parsePngHeader(buf) {
  let width = 0;
  let height = 0;
  let hasAlpha = false;

  if (buf.length >= 29) {
    width = buf.readUInt32BE(16);
    height = buf.readUInt32BE(20);
    const colorType = buf[25]; // 0: Gray, 2: RGB, 3: Indexed, 4: Gray+Alpha, 6: RGBA
    hasAlpha = (colorType === 4 || colorType === 6 || colorType === 3);
  }

  return { dimensions: { width, height }, hasAlpha };
}

function parseWebpHasAlpha(buf) {
  const vp8x = buf.indexOf('VP8X');
  if (vp8x !== -1 && buf.length > vp8x + 8) {
    const flags = buf[vp8x + 8];
    return !!(flags & 0x10); // Alpha flag bit
  }
  return false;
}

