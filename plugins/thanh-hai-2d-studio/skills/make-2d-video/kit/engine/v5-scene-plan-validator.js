// engine/v5-scene-plan-validator.js — Scene Plan Validation Engine (V5)
// Validates declarative Scene Plan JSON against schema, timeline constraints,
// runtime asset availability, character compatibility, and cinematography bounds.

import { exportFullAiCapabilityRegistry } from './v5-capability-registry.js';
import { checkCharacterActionCompatibility, checkCharacterOutfitCompatibility } from './compatibility-engine-v4.js';

export const QA_LEVEL = {
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export function validateScenePlan(scenePlan = {}, projectContext = {}) {
  const errors = [];
  const warnings = [];
  const info = [];
  const missingRequirements = [];

  // 1. SCHEMA & SYNTAX LEVEL VALIDATION
  if (!scenePlan || typeof scenePlan !== 'object') {
    return {
      valid: false,
      errors: [{ code: 'INVALID_JSON', level: QA_LEVEL.ERROR, message: 'Dữ liệu Scene Plan phải là một đối tượng JSON hợp lệ.' }],
      warnings, info, missingRequirements
    };
  }

  if (!scenePlan.schemaVersion) {
    errors.push({ code: 'MISSING_SCHEMA_VERSION', level: QA_LEVEL.ERROR, message: 'Thiếu trường bắt buộc "schemaVersion".' });
  }

  if (!scenePlan.project || typeof scenePlan.project !== 'object') {
    errors.push({ code: 'MISSING_PROJECT_METADATA', level: QA_LEVEL.ERROR, message: 'Thiếu thông tin project metadata bắt buộc.' });
  }

  const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  if (scenes.length === 0) {
    errors.push({ code: 'EMPTY_SCENES_ARRAY', level: QA_LEVEL.ERROR, message: 'Scene Plan không chứa bất kỳ phân cảnh (scene) nào.' });
    return { valid: false, errors, warnings, info, missingRequirements };
  }

  // Pre-load capability sets
  const caps = exportFullAiCapabilityRegistry().capabilities;
  const validBgIds = new Set(caps.backgrounds.map(b => b.id));
  const validPropIds = new Set(caps.props.map(p => p.id));
  const validExprIds = new Set(caps.expressions.map(e => e.id));
  const validActionIds = new Set(caps.compositeActions.map(a => a.id));
  // Include standard action IDs
  ['idle_breathe', 'walk_cycle', 'run_cycle', 'sit_down', 'wave_hand', 'raise_arm', 'point_forward', 'scratch_head', 'fall_backward', 'thinking', 'idea_discovery'].forEach(id => validActionIds.add(id));

  // Registered asset requirements
  const declaredRequirements = new Map();
  if (Array.isArray(scenePlan.assetRequirements)) {
    for (const req of scenePlan.assetRequirements) {
      if (req.requirementId) {
        declaredRequirements.set(req.requirementId, req);
        missingRequirements.push(req);
      }
    }
  }

  const seenSceneIds = new Set();
  const maxProjectDurationMs = projectContext.durationMs || scenePlan.project?.durationMs || 600000;
  let previousEndMs = 0;

  // 2. SCENE BY SCENE EVALUATION
  for (let idx = 0; idx < scenes.length; idx++) {
    const s = scenes[idx];
    const sId = s.id || `scene_${String(idx + 1).padStart(3, '0')}`;

    // Duplicate Scene ID check
    if (seenSceneIds.has(sId)) {
      errors.push({
        code: 'DUPLICATE_SCENE_ID',
        level: QA_LEVEL.ERROR,
        sceneId: sId,
        message: `Phát hiện trùng lặp Scene ID: "${sId}".`
      });
    }
    seenSceneIds.add(sId);

    // Timeline validity
    if (typeof s.startMs !== 'number' || s.startMs < 0) {
      errors.push({
        code: 'INVALID_START_TIME',
        level: QA_LEVEL.ERROR,
        sceneId: sId,
        message: `Cảnh "${sId}" có thời điểm bắt đầu không hợp lệ (startMs: ${s.startMs}).`
      });
    }

    if (typeof s.endMs !== 'number' || s.endMs <= s.startMs) {
      errors.push({
        code: 'INVALID_END_TIME',
        level: QA_LEVEL.ERROR,
        sceneId: sId,
        message: `Cảnh "${sId}" có thời điểm kết thúc phải lớn hơn bắt đầu (startMs: ${s.startMs}, endMs: ${s.endMs}).`
      });
    }

    // Exceed project / audio duration
    if (s.endMs > maxProjectDurationMs + 100) {
      errors.push({
        code: 'EXCEEDS_AUDIO_DURATION',
        level: QA_LEVEL.ERROR,
        sceneId: sId,
        message: `Cảnh "${sId}" kết thúc tại ${s.endMs}ms vượt quá tổng thời lượng audio (${maxProjectDurationMs}ms).`
      });
    }

    // Unexpected gaps between scenes (> 500ms)
    if (idx > 0 && s.startMs - previousEndMs > 500) {
      warnings.push({
        code: 'UNEXPECTED_TIMELINE_GAP',
        level: QA_LEVEL.WARNING,
        sceneId: sId,
        message: `Khoảng hở thời gian bất thường (${s.startMs - previousEndMs}ms) trước cảnh "${sId}".`
      });
    }
    previousEndMs = Math.max(previousEndMs, s.endMs || 0);

    // 3. ASSET VALIDATION (Backgrounds)
    if (s.background && s.background.assetId) {
      const bgId = s.background.assetId;
      if (!validBgIds.has(bgId) && !declaredRequirements.has(bgId)) {
        errors.push({
          code: 'MISSING_ASSET_ID',
          level: QA_LEVEL.ERROR,
          sceneId: sId,
          assetType: 'background',
          assetId: bgId,
          message: `Bối cảnh "${bgId}" trong cảnh "${sId}" không tồn tại trong thư viện và chưa được khai báo requirement.`
        });
      }
    }

    // 4. CHARACTERS & ACTIONS VALIDATION
    const characters = Array.isArray(s.characters) ? s.characters : [];
    for (const c of characters) {
      const charId = c.characterId || c.id;
      if (!charId) {
        errors.push({
          code: 'MISSING_CHARACTER_ID',
          level: QA_LEVEL.ERROR,
          sceneId: sId,
          message: `Nhân vật trong cảnh "${sId}" thiếu characterId bắt buộc.`
        });
        continue;
      }

      // Check character existence
      if (!['doc', 'jake', 'max', 'alex'].includes(charId.toLowerCase()) && !declaredRequirements.has(charId)) {
        warnings.push({
          code: 'UNKNOWN_CHARACTER_ID',
          level: QA_LEVEL.WARNING,
          sceneId: sId,
          characterId: charId,
          message: `Nhân vật "${charId}" chưa được cấu hình sẵn trong Character Library.`
        });
      }

      // Outfit compatibility
      if (c.outfitId) {
        const outfitCompat = checkCharacterOutfitCompatibility({ characterEngine: 'white_cartoon' }, c.outfitId);
        if (outfitCompat && outfitCompat.status === 'incompatible') {
          errors.push({
            code: 'OUTFIT_INCOMPATIBLE',
            level: QA_LEVEL.ERROR,
            sceneId: sId,
            message: `Trang phục "${c.outfitId}" không tương thích với nhân vật "${charId}".`
          });
        }
      }

      // Prop in character
      if (c.prop && c.prop.assetId) {
        const propId = c.prop.assetId;
        if (!validPropIds.has(propId) && !declaredRequirements.has(propId)) {
          errors.push({
            code: 'MISSING_ASSET_ID',
            level: QA_LEVEL.ERROR,
            sceneId: sId,
            assetType: 'prop',
            assetId: propId,
            message: `Đạo cụ "${propId}" gắn vào nhân vật "${charId}" không tồn tại.`
          });
        }
      }
    }

    // Visual Beats evaluation
    const beats = Array.isArray(s.visualBeats) ? s.visualBeats : [];
    for (const beat of beats) {
      if (beat.actionId && !validActionIds.has(beat.actionId)) {
        errors.push({
          code: 'UNKNOWN_ACTION_ID',
          level: QA_LEVEL.ERROR,
          sceneId: sId,
          actionId: beat.actionId,
          message: `Hành động "${beat.actionId}" trong nhịp ${beat.startMs}-${beat.endMs}ms cảnh "${sId}" không tồn tại trong Engine.`
        });
      }
      if (beat.expressionId && !validExprIds.has(beat.expressionId)) {
        warnings.push({
          code: 'UNKNOWN_EXPRESSION_ID',
          level: QA_LEVEL.WARNING,
          sceneId: sId,
          expressionId: beat.expressionId,
          message: `Biểu cảm "${beat.expressionId}" chưa chuẩn hóa, hệ thống sẽ tự ánh xạ fallback.`
        });
      }
    }

    // 5. CAMERA & CINEMATOGRAPHY VALIDATION
    if (s.camera) {
      if (typeof s.camera.zoom === 'number') {
        if (s.camera.zoom > 2.5 || s.camera.zoom < 0.5) {
          warnings.push({
            code: 'EXTREME_CAMERA_ZOOM',
            level: QA_LEVEL.WARNING,
            sceneId: sId,
            message: `Độ zoom camera (${s.camera.zoom}x) tại cảnh "${sId}" nằm ngoài phạm vi khuyến nghị (0.8x - 2.2x).`
          });
        }
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    valid: isValid,
    canCompile: isValid,
    errors,
    warnings,
    info,
    missingRequirements,
    stats: {
      sceneCount: scenes.length,
      totalDurationMs: previousEndMs,
      errorCount: errors.length,
      warningCount: warnings.length,
      missingAssetCount: missingRequirements.length
    }
  };
}
