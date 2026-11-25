// engine/qa-validation-v4.js — Quality Assurance Dashboard & Pre-Render Validation Engine (V4)
// Evaluates project readiness across Assets, Characters, Timelines, Composition, and Audio
// Categorizes issues into ERROR (Blocks Render), WARNING (Needs Review), and INFO (Optimization Hint).

import fs from 'fs';
import { checkCharacterOutfitCompatibility, inspectCharacterFullCompatibility } from './compatibility-engine-v4.js';
import { WHITE_CARTOON_PRESETS } from './white-cartoon-rig2d.js';
import { getAsset } from '../../lib/asset-registry.mjs';

export const QA_SEVERITY = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

/**
 * PRE-RENDER COMPREHENSIVE VALIDATION
 * Evaluates full project integrity before launching ffmpeg render.
 */
export function validateProjectForRender(project = {}) {
  const errors = [];
  const warnings = [];
  const info = [];

  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  if (scenes.length === 0) {
    errors.push({
      category: 'TIMELINE',
      severity: QA_SEVERITY.ERROR,
      message: 'Dự án không có bất kỳ cảnh (scene) nào để kết xuất.'
    });
    return { ready: false, errors, warnings, info, stats: { sceneCount: 0, totalDuration: 0 } };
  }

  let expectedTime = 0.0;
  let totalVideoDuration = 0.0;

  for (let idx = 0; idx < scenes.length; idx++) {
    const s = scenes[idx];
    const sId = s.id || `scene_${idx + 1}`;
    const sName = s.name || `Cảnh ${idx + 1}`;

    // 1. TIMELINE VALIDATION
    if (typeof s.duration !== 'number' || s.duration <= 0) {
      errors.push({
        category: 'TIMELINE',
        severity: QA_SEVERITY.ERROR,
        sceneId: sId,
        message: `Cảnh "${sName}" có thời lượng không hợp lệ (duration = ${s.duration}s).`
      });
    }

    if (typeof s.start === 'number' && s.start < 0) {
      errors.push({
        category: 'TIMELINE',
        severity: QA_SEVERITY.ERROR,
        sceneId: sId,
        message: `Cảnh "${sName}" có mốc thời gian bắt đầu âm (start = ${s.start}s).`
      });
    }

    // Gap / Overlap detection
    if (typeof s.start === 'number' && Math.abs(s.start - expectedTime) > 0.05) {
      warnings.push({
        category: 'TIMELINE',
        severity: QA_SEVERITY.WARNING,
        sceneId: sId,
        message: `Phát hiện khoảng hở hoặc chồng lấn thời gian trước cảnh "${sName}" (${s.start.toFixed(2)}s so với dự kiến ${expectedTime.toFixed(2)}s).`
      });
    }
    expectedTime = (s.start || 0) + (s.duration || 0);
    totalVideoDuration += (s.duration || 0);

    // 2. CHARACTER & OUTFIT VALIDATION
    const characters = Array.isArray(s.characters) ? s.characters : [];
    for (const charInstance of characters) {
      const cid = charInstance.characterId || charInstance.id;
      const basePreset = WHITE_CARTOON_PRESETS[cid];

      if (!basePreset && !charInstance.skin) {
        errors.push({
          category: 'CHARACTER',
          severity: QA_SEVERITY.ERROR,
          sceneId: sId,
          characterId: cid,
          message: `Không tìm thấy định nghĩa nhân vật cho ID "${cid}" trong cảnh "${sName}".`
        });
        continue;
      }

      // Check outfit compatibility
      if (charInstance.outfitId) {
        const compat = checkCharacterOutfitCompatibility(basePreset || charInstance, charInstance.outfitId);
        if (compat.status === 'INCOMPATIBLE') {
          errors.push({
            category: 'CHARACTER',
            severity: QA_SEVERITY.ERROR,
            sceneId: sId,
            characterId: cid,
            message: `Trang phục "${charInstance.outfitId}" không tương thích với nhân vật "${cid}" (${compat.reason}).`
          });
        } else if (compat.status === 'REQUIRES_SETUP') {
          warnings.push({
            category: 'CHARACTER',
            severity: QA_SEVERITY.WARNING,
            sceneId: sId,
            characterId: cid,
            message: `Trang phục "${charInstance.outfitId}" cần căn chỉnh fitting tỷ lệ cho nhân vật "${cid}".`
          });
        }
      }

      // 3. COMPOSITION VALIDATION
      const pos = charInstance.position || [640, 580];
      const scale = charInstance.scale ?? 1.0;
      if (pos[0] < -200 || pos[0] > 1480 || pos[1] < -200 || pos[1] > 920) {
        warnings.push({
          category: 'COMPOSITION',
          severity: QA_SEVERITY.WARNING,
          sceneId: sId,
          characterId: cid,
          message: `Nhân vật "${cid}" nằm hoàn toàn ngoài khung hình hiển thị (tọa độ [${pos[0]}, ${pos[1]}]).`
        });
      }

      if (scale > 2.5 || scale < 0.2) {
        warnings.push({
          category: 'COMPOSITION',
          severity: QA_SEVERITY.WARNING,
          sceneId: sId,
          characterId: cid,
          message: `Tỉ lệ phóng to của nhân vật "${cid}" bất thường (${scale}x).`
        });
      }
    }

    // 4. CAMERA VALIDATION
    if (s.camera) {
      const z = s.camera.zoom ?? 1.0;
      if (z > 2.5) {
        warnings.push({
          category: 'CAMERA',
          severity: QA_SEVERITY.WARNING,
          sceneId: sId,
          message: `Độ phóng đại Camera (zoom = ${z}x) quá lớn, có thể làm vỡ hạt nét vẽ hoạt hình.`
        });
      }
    }

    // 5. ASSET INTEGRITY
    if (s.background?.filePath && !fs.existsSync(s.background.filePath)) {
      errors.push({
        code: 'MISSING_ASSET_FILE',
        category: 'ASSET',
        severity: QA_SEVERITY.ERROR,
        sceneId: sId,
        message: `Không tìm thấy file asset nền: ${s.background.filePath}`
      });
    }

    if (s.background?.id && !['bg_lab_modern', 'bg_historical_computer_lab', 'bg_chalkboard_blueprint', 'bg_whiteboard_clean', 'bg_diagram_grid', 'bg_minimal_studio', 'bg_city_street_dusk'].includes(s.background.id)) {
      info.push({
        category: 'ASSET',
        severity: QA_SEVERITY.INFO,
        sceneId: sId,
        message: `Bối cảnh "${s.background.id}" đang sử dụng profile dựng thủ công.`
      });
    }

    // 6. ACTION COMPATIBILITY
    for (const char of (s.characters || [])) {
      if (char.mode === 'B' && char.structure === 'monolithic_png' && char.action) {
        warnings.push({
          code: 'ACTION_INCOMPATIBLE',
          category: 'COMPATIBILITY',
          severity: QA_SEVERITY.WARNING,
          sceneId: sId,
          message: `Nhân vật Mode B nguyên khối không thể thực hiện hành động ${char.action}`
        });
      }
    }
  }

  const isReady = errors.length === 0;

  return {
    ready: isReady,
    canRender: isReady,
    errors,
    warnings,
    info,
    stats: {
      sceneCount: scenes.length,
      totalDuration: totalVideoDuration,
      errorCount: errors.length,
      warningCount: warnings.length,
      infoCount: info.length
    }
  };
}
