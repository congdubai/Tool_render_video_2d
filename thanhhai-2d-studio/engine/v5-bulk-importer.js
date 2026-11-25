// engine/v5-bulk-importer.js — Bulk Asset & Image Importer (V5 Phase 2)
// Ingests multiple images or ZIP archives, validates formats, detects duplicates via content hash,
// automatically maps filenames to requirement IDs, and queues unassigned assets.

import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { validateImageFile } from './v5-image-validator.js';

export function matchFilenameToRequirement(fileName, activeRequirements = []) {
  if (!fileName) return null;
  const baseName = path.basename(fileName, path.extname(fileName)).toUpperCase();

  // 1. Exact Requirement ID Match (e.g. "REQ_PROP_001")
  for (const req of activeRequirements) {
    const rId = req.id.toUpperCase();
    if (baseName === rId) {
      return { requirementId: req.id, method: 'FILENAME_EXACT_MATCH', confidence: 'EXACT_MATCH' };
    }
  }

  // 2. Prefix Match with Suffixes (e.g. "REQ_PROP_001_v2", "REQ_PROP_001_FINAL", "REQ_PROP_001_UPSCALED")
  for (const req of activeRequirements) {
    const rId = req.id.toUpperCase();
    if (baseName.startsWith(rId + '_') || baseName.startsWith(rId + '-')) {
      return { requirementId: req.id, method: 'FILENAME_PREFIX_MATCH', confidence: 'CONFIDENT_MATCH' };
    }
  }

  // 3. Substring Token Match
  for (const req of activeRequirements) {
    const rId = req.id.toUpperCase();
    if (baseName.includes(rId)) {
      return { requirementId: req.id, method: 'FILENAME_CONTAINS_MATCH', confidence: 'CONFIDENT_MATCH' };
    }
  }

  // 4. Target Asset ID Match (e.g. "prop_eniac_001.png" matching targetAssetId "prop_eniac_001")
  for (const req of activeRequirements) {
    if (req.targetAssetId) {
      const tId = req.targetAssetId.toUpperCase();
      if (baseName === tId || baseName.startsWith(tId + '_')) {
        return { requirementId: req.id, method: 'FILENAME_TARGET_ID_MATCH', confidence: 'CONFIDENT_MATCH' };
      }
    }
  }

  return null;
}

export function processImportedFiles(filePaths = [], targetDir, activeRequirements = [], existingHashes = new Map()) {
  const matched = [];
  const unassigned = [];
  const duplicates = [];
  const errors = [];

  fs.mkdirSync(targetDir, { recursive: true });

  for (const fPath of filePaths) {
    const fileName = path.basename(fPath);

    // Security check: Path traversal prevention
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      errors.push({ file: fileName, error: 'Tên file không an toàn (Path Traversal)' });
      continue;
    }

    const validation = validateImageFile(fPath);
    if (!validation.valid) {
      errors.push({ file: fileName, error: validation.errors.join('; ') });
      continue;
    }

    // Duplicate Detection via SHA-256 Hash
    if (existingHashes.has(validation.contentHash)) {
      duplicates.push({
        file: fileName,
        contentHash: validation.contentHash,
        existingAssetId: existingHashes.get(validation.contentHash),
        message: 'File có nội dung trùng khớp hoàn toàn với tài nguyên đã có sẵn'
      });
      continue;
    }

    // Automatic Filename Matching
    const match = matchFilenameToRequirement(fileName, activeRequirements);
    
    // Copy file safely to project target directory
    const destPath = path.join(targetDir, fileName);
    if (fPath !== destPath) {
      fs.copyFileSync(fPath, destPath);
    }

    const fileRecord = {
      fileName,
      filePath: destPath,
      relativePath: path.relative(path.dirname(targetDir), destPath).replace(/\\/g, '/'),
      format: validation.format,
      dimensions: validation.dimensions,
      hasAlpha: validation.hasAlpha,
      contentHash: validation.contentHash,
      recommendedAnchor: validation.recommendedAnchor
    };

    if (match) {
      matched.push({
        ...fileRecord,
        requirementId: match.requirementId,
        matchMethod: match.method,
        confidence: match.confidence
      });
      existingHashes.set(validation.contentHash, match.requirementId);
    } else {
      unassigned.push(fileRecord);
      existingHashes.set(validation.contentHash, fileName);
    }
  }

  return {
    matched,
    unassigned,
    duplicates,
    errors,
    summary: {
      total: filePaths.length,
      matchedCount: matched.length,
      unassignedCount: unassigned.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length
    }
  };
}

export function importZipArchive(zipFilePath, extractDir, activeRequirements = [], existingHashes = new Map()) {
  if (!fs.existsSync(zipFilePath)) {
    throw new Error(`File ZIP không tồn tại: ${zipFilePath}`);
  }

  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();
  const extractedFiles = [];

  fs.mkdirSync(extractDir, { recursive: true });

  for (const entry of zipEntries) {
    if (entry.isDirectory) continue;
    
    // Security check: Zip Slip path traversal
    const entryName = entry.entryName;
    if (entryName.includes('..') || entryName.startsWith('/') || entryName.startsWith('\\')) {
      continue; // Skip dangerous entries
    }

    const ext = path.extname(entryName).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
      continue; // Skip non-image files
    }

    const safeBaseName = path.basename(entryName);
    const destFile = path.join(extractDir, safeBaseName);
    fs.writeFileSync(destFile, entry.getData());
    extractedFiles.push(destFile);
  }

  return processImportedFiles(extractedFiles, extractDir, activeRequirements, existingHashes);
}
