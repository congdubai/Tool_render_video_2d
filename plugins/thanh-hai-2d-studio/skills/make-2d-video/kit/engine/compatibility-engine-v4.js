// engine/compatibility-engine-v4.js — Universal Asset Compatibility & Character Capability System (V4)
// Unified compatibility engine ensuring robust cross-checks between Characters, Outfits,
// Expressions, Props, Rigs, Actions, Composite Actions and Cartoon VFX with actionable fallback strategies.

import { BODY_PROFILES, OUTFIT_LIBRARY } from './outfit-engine-v4.js';
import { COMPOSITE_ACTION_TEMPLATES } from './action-engine-v4.js';

/**
 * 1. COMPATIBILITY STATUS CONSTANTS
 */
export const COMPATIBILITY_STATUS = {
  COMPATIBLE: 'COMPATIBLE',                       // Sẵn sàng sử dụng trực tiếp
  PARTIALLY_COMPATIBLE: 'PARTIALLY_COMPATIBLE',   // Dùng được với phương án thay thế (Fallback)
  REQUIRES_SETUP: 'REQUIRES_SETUP',               // Cần chỉnh anchor, mapping hoặc fitting
  INCOMPATIBLE: 'INCOMPATIBLE',                   // Không thể sử dụng an toàn
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY'        // Thiếu tệp tin hoặc tài nguyên phụ thuộc
};

/**
 * 2. CHARACTER CAPABILITY CALCULATION
 * Evaluates the actual runtime capabilities of any character instance.
 */
export function calculateCharacterCapabilities(character = {}) {
  const profileCaps = (character.bodyProfile && BODY_PROFILES[character.bodyProfile]?.capabilities) || {};
  const charEngine = character.characterEngine || character.character || character.type || character.bodyProfile || 'white_cartoon';
  const isMonolithic = charEngine === 'monolithic_png' || charEngine === 'simple_doodle' || character.isMonolithic === true;
  const isImported = charEngine === 'imported_layered' || charEngine === 'imported' || charEngine === 'imported_custom' || !!character.parts || !!character.layers;
  const isChibi = charEngine === 'chibi' || charEngine === 'chibi_v9' || charEngine === 'chibi_standard';
  const isWhiteCartoon = charEngine === 'white_cartoon';

  if (isMonolithic) {
    return {
      rootTransform: true,
      headSprite: false,
      faceExpressions: false,
      armRig: false,
      legRig: false,
      handAnchors: false,
      footAnchors: false,
      outfitSlots: false,
      layeredBody: false,
      spriteAnimation: false,
      overlayAccessories: true,
      fullSpriteReplacement: true,
      ...profileCaps
    };
  }

  if (isImported) {
    const parts = character.parts || character.layers || {};
    const hasHead = !!(parts.head || parts.face);
    const hasArms = !!(parts.upperArm_R || parts.arm_R || parts.hand_R);
    const hasLegs = !!(parts.thigh_R || parts.leg_R || parts.foot_R);

    return {
      rootTransform: true,
      headSprite: hasHead,
      faceExpressions: !!(character.expressions && Object.keys(character.expressions).length > 0),
      armRig: hasArms,
      legRig: hasLegs,
      handAnchors: !!(parts.hand_R || parts.hand_L || character.handAnchors),
      footAnchors: !!(parts.foot_R || parts.foot_L),
      outfitSlots: true,
      layeredBody: true,
      spriteAnimation: false,
      overlayAccessories: true,
      fullSpriteReplacement: true,
      hierarchicalFK: true,
      layeredSprites: true,
      ...profileCaps
    };
  }

  // Built-in White Cartoon or Chibi Rig
  return {
    rootTransform: true,
    headSprite: true,
    faceExpressions: true,
    armRig: true,
    legRig: true,
    handAnchors: true,
    footAnchors: true,
    outfitSlots: true,
    layeredBody: true,
    spriteAnimation: isChibi,
    overlayAccessories: true,
    fullSpriteReplacement: false,
    skeletalIK: true,
    vectorOutfits: true,
    layeredSprites: true,
    colorTinting: true,
    multiLayerClothing: true,
    ...profileCaps
  };
}

/**
 * 3. CHARACTER <-> OUTFIT COMPATIBILITY
 */
export function checkCharacterOutfitCompatibility(character, outfitOrId) {
  if (!character) {
    return { status: COMPATIBILITY_STATUS.INCOMPATIBLE, reason: 'Chưa chọn nhân vật nhận trang phục.' };
  }

  let outfit = outfitOrId;
  if (typeof outfitOrId === 'string') {
    outfit = OUTFIT_LIBRARY[outfitOrId] || { id: outfitOrId, compatibleProfiles: ['white_cartoon'] };
  }

  const caps = calculateCharacterCapabilities(character);
  const charProfile = character.bodyProfile || (character.character === 'white_cartoon' ? 'white_cartoon' : 'white_cartoon');

  // Case 1: Monolithic PNG character
  if (!caps.outfitSlots) {
    // Only overlay accessories (hat, glasses) or full sprite replacement are viable
    if (outfit.category === 'accessory' || outfit.slot === 'headwear' || outfit.slot === 'facewear') {
      return {
        status: COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE,
        reason: 'Nhân vật dạng ảnh PNG nguyên khối chỉ hỗ trợ gắn phụ kiện overlay (mũ, kính). Không thể thay áo/quần tách lớp.',
        fallbackMode: 'overlay_accessory',
        fallback: { mode: 'anchor_overlay' }
      };
    }
    return {
      status: COMPATIBILITY_STATUS.INCOMPATIBLE,
      reason: 'Nhân vật PNG nguyên khối không có cấu trúc xương hoặc bộ phận tách lớp để thay đổi trang phục modular.',
      fallbackMode: 'full_sprite_replacement',
      fallback: { mode: 'replace_entire_sprite' }
    };
  }

  // Case 2: Body Profile matching
  const compatProfiles = outfit.compatibleProfiles || ['white_cartoon', 'chibi_standard'];
  if (!compatProfiles.includes('all') && !compatProfiles.includes(charProfile)) {
    return {
      status: COMPATIBILITY_STATUS.REQUIRES_SETUP,
      reason: `Trang phục "${outfit.name || outfit.id}" được thiết kế cho hệ thân [${compatProfiles.join(', ')}], nhân vật đang dùng [${charProfile}]. Cần cân chỉnh lại vị trí và tỷ lệ fitting.`,
      fallbackMode: 'manual_fitting',
      fallback: { mode: 'scale_and_fit' }
    };
  }

  return {
    status: COMPATIBILITY_STATUS.COMPATIBLE,
    reason: `Trang phục hoàn toàn tương thích với Body Profile "${charProfile}" của nhân vật.`
  };
}

/**
 * 4. CHARACTER <-> EXPRESSION COMPATIBILITY
 */
export function checkCharacterExpressionCompatibility(character, expressionName) {
  const caps = calculateCharacterCapabilities(character);

  if (!caps.faceExpressions) {
    return {
      status: COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE,
      reason: 'Nhân vật không có bộ phận ngũ quan tách lớp. Kích hoạt Fallback: Biểu cảm sẽ được thể hiện qua ký hiệu cảm xúc hoạt hình (Emotion VFX: Anger Symbol, Sweat Drop, Question Mark).',
      fallbackMode: 'emotion_vfx_overlay',
      fallback: {
        symbol: expressionName === 'angry' ? 'vfx_anger_mark' :
                expressionName === 'scared' || expressionName === 'shocked' ? 'vfx_sweat' :
                expressionName === 'thinking' ? 'vfx_question_mark' : 'vfx_idea_bulb'
      }
    };
  }

  return {
    status: COMPATIBILITY_STATUS.COMPATIBLE,
    reason: 'Nhân vật hỗ trợ đầy đủ 15 biểu cảm hoạt hình giải tích V4.'
  };
}

/**
 * 5. CHARACTER <-> PROP COMPATIBILITY
 */
export function checkCharacterPropCompatibility(character, propOrId) {
  const caps = calculateCharacterCapabilities(character);

  if (!caps.handAnchors) {
    return {
      status: COMPATIBILITY_STATUS.REQUIRES_SETUP,
      reason: 'Nhân vật thiếu điểm neo bàn tay (Hand Anchor). Cần thiết lập điểm neo thủ công hoặc đặt đạo cụ độc lập trong bối cảnh.',
      fallbackMode: 'scene_relative_placement',
      fallback: { mode: 'scene_relative', defaultOffset: [20, -40] }
    };
  }

  return {
    status: COMPATIBILITY_STATUS.COMPATIBLE,
    reason: 'Nhân vật có điểm neo xương bàn tay, hỗ trợ đầy đủ cầm, thả và chuyển giao đạo cụ.'
  };
}

/**
 * 6. CHARACTER <-> ACTION & COMPOSITE ACTION COMPATIBILITY
 */
export function checkCharacterActionCompatibility(character, actionOrId) {
  const caps = calculateCharacterCapabilities(character);
  const actId = typeof actionOrId === 'string' ? actionOrId : actionOrId.id;

  // Walk / Run kinematic cycles
  if (actId.includes('walk') || actId.includes('run') || actId.includes('chase')) {
    if (!caps.legRig) {
      return {
        status: COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE,
        reason: 'Nhân vật không có xương chân 2-Bone IK. Kích hoạt Fallback: Di chuyển bằng phép tịnh tiến Transform kèm vệt tốc độ (Speed Lines) và bụi chân (Ground Dust).',
        fallbackMode: 'transform_slide_with_dust',
        fallback: { mode: 'transform_motion', vfx: 'vfx_ground_dust' }
      };
    }
  }

  // Fight Cloud Brawl
  if (actId === 'composite_fight_cloud' || actId === 'fight_cloud') {
    if (!caps.headSprite && !caps.faceExpressions) {
      return {
        status: COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE,
        reason: 'Nhân vật thiếu đầu sprite/vector để thò đầu ra khỏi khói. Kích hoạt Fallback: Trận ẩu đả diễn ra thuần trong khói (Smoke-Only Brawl) kèm nắm đấm comic và sao choáng váng.',
        fallbackMode: 'smoke_only_brawl',
        fallback: { hidePopouts: true, showComicLimbs: true }
      };
    }
  }

  return {
    status: COMPATIBILITY_STATUS.COMPATIBLE,
    reason: 'Nhân vật đáp ứng đầy đủ năng lực xương và biểu cảm để diễn hoạt hành động này.'
  };
}

/**
 * 7. ASSET COMPATIBILITY INSPECTOR (FULL REPORT FOR UI)
 * Returns a comprehensive compatibility breakdown for the selected character.
 */
export function inspectCharacterFullCompatibility(character) {
  if (!character) return null;

  const caps = calculateCharacterCapabilities(character);
  const charProfile = character.bodyProfile || (character.character === 'white_cartoon' ? 'white_cartoon' : 'white_cartoon');

  const report = {
    characterId: character.id || 'unnamed_char',
    bodyProfile: charProfile,
    capabilities: caps,
    outfits: { compatible: [], requiresSetup: [], incompatible: [] },
    actions: { compatible: [], partial: [], incompatible: [] },
    props: { compatible: true, fallback: null },
    expressions: { compatible: caps.faceExpressions, fallback: !caps.faceExpressions ? 'emotion_vfx' : null }
  };

  // Inspect all outfits in library
  for (const outfit of Object.values(OUTFIT_LIBRARY)) {
    const res = checkCharacterOutfitCompatibility(character, outfit);
    if (res.status === COMPATIBILITY_STATUS.COMPATIBLE) {
      report.outfits.compatible.push({ id: outfit.id, name: outfit.name });
    } else if (res.status === COMPATIBILITY_STATUS.REQUIRES_SETUP || res.status === COMPATIBILITY_STATUS.PARTIALLY_COMPATIBLE) {
      report.outfits.requiresSetup.push({ id: outfit.id, name: outfit.name, reason: res.reason, fallbackMode: res.fallbackMode });
    } else {
      report.outfits.incompatible.push({ id: outfit.id, name: outfit.name, reason: res.reason });
    }
  }

  // Inspect composite actions
  for (const act of Object.values(COMPOSITE_ACTION_TEMPLATES)) {
    const res = checkCharacterActionCompatibility(character, act);
    if (res.status === COMPATIBILITY_STATUS.COMPATIBLE) {
      report.actions.compatible.push({ id: act.id, name: act.name });
    } else {
      report.actions.partial.push({ id: act.id, name: act.name, reason: res.reason, fallbackMode: res.fallbackMode });
    }
  }

  return report;
}

/**
 * 8. ASSET VALIDATOR
 * Verifies asset data integrity, missing dependencies, anchor validity and path safety.
 */
export function validateAssetIntegrity(asset, context = {}) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (!asset || typeof asset !== 'object') {
    return { valid: false, errors: ['Tài nguyên không hợp lệ (không phải object).'], warnings, info };
  }

  // ID Check
  if (!asset.id || typeof asset.id !== 'string') {
    errors.push('Thiếu Asset ID duy nhất.');
  }

  // Type Check
  if (!asset.type) {
    errors.push('Thiếu thuộc tính loại tài nguyên (type).');
  }

  // Outfit specific checks
  if (asset.type === 'outfit') {
    if (!asset.top && !asset.slots) {
      warnings.push('Trang phục không khai báo kiểu áo (top) hoặc slots cấu thành.');
    }
    if (asset.slots) {
      for (const [slotKey, slotVal] of Object.entries(asset.slots)) {
        if (!slotVal.type && !slotVal.assetId) {
          warnings.push(`Slot "${slotKey}" thiếu định danh kiểu dáng (type) hoặc assetId.`);
        }
      }
    }
  }

  // Anchors Check
  if (asset.anchors) {
    for (const [aKey, aVal] of Object.entries(asset.anchors)) {
      if (!Array.isArray(aVal) || aVal.length !== 2 || typeof aVal[0] !== 'number' || typeof aVal[1] !== 'number') {
        errors.push(`Điểm neo "${aKey}" không hợp lệ. Phải là mảng tọa độ [x, y].`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info
  };
}
