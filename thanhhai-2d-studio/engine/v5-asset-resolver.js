// engine/v5-asset-resolver.js — Central Asset Resolution Engine (V5 Phase 2)
// Implements 5-tier priority matching: Exact ID, Existing Binding, Semantic Match,
// Compatible Alternative, and Missing Requirement with confidence scoring.

import { getAsset, listAssets } from '../../lib/asset-registry.mjs';
import { CAPABILITY_REGISTRY } from './v5-capability-registry.js';
import { COMPOSITE_ACTION_TEMPLATES } from './action-engine-v4.js';

// Predefined semantic aliases mapping for rule-based matching without local LLM
const SEMANTIC_ALIASES = {
  coffee_cup: ['coffee_cup', 'coffee_mug', 'cup_coffee', 'coc_ca_phe', 'tach_ca_phe', 'ly_ca_phe', 'prop_coffee_cup'],
  eniac_computer: ['eniac', 'eniac_computer', 'may_tinh_eniac', 'mainframe_computer', 'vintage_computer', 'vacuum_tube_computer', 'computer', 'prop_computer', 'may_tinh'],
  vintage_book: ['vintage_book', 'sach_co', 'old_book', 'cuon_sach', 'prop_vintage_book'],
  smartphone: ['smartphone', 'dien_thoai', 'mobile_phone', 'prop_smartphone', 'cellphone'],
  laptop: ['laptop', 'may_tinh_xach_tay', 'prop_laptop', 'notebook'],
  desk: ['desk', 'ban_lam_viec', 'table', 'office_desk', 'ban_hoc'],
  chair: ['chair', 'ghe_tua', 'office_chair', 'ghe_lam_viec'],
  pen: ['pen', 'but_viet', 'pencil', 'ballpoint_pen'],
  broom: ['broom', 'choi_quet', 'cleaning_broom'],
  vacuum_tube: ['vacuum_tube', 'bong_den_chan_khong', 'electronic_tube', 'den_dien_tu'],
  microprocessor: ['microprocessor', 'vi_xu_ly', 'cpu', 'chip_xu_ly', 'silicon_chip'],
  transistor: ['transistor', 'bong_ban_dan', 'linh_kien_ban_dan'],
  smoke_vfx: ['smoke', 'vfx_smoke', 'smoke_puff', 'khoi', 'vfx_smoke_cloud', 'vfx_dust_cloud', 'smoke_dust'],
  light_bulb_vfx: ['light_bulb', 'vfx_light_bulb', 'idea_bulb', 'bong_den', 'vfx_idea_bulb', 'bulb']
};

export function resolveAssetRequirement(requirement = {}, projectBindings = {}, options = {}) {
  const reqId = requirement.id;
  const targetId = requirement.targetAssetId || reqId;
  const reqType = requirement.type || requirement.category || 'prop';
  const reqName = normalizeText(requirement.name || '');
  const reqDesc = normalizeText(requirement.description || '');

  // -------------------------------------------------------------
  // Priority 1: Exact Asset ID Match in V4 Universal Asset Registry
  // -------------------------------------------------------------
  const exactAsset = getAsset(targetId);
  if (exactAsset) {
    if (isTypeCompatible(exactAsset.type, reqType)) {
      return {
        requirementId: reqId,
        resolvedAssetId: exactAsset.id,
        resolutionMethod: 'EXACT_ASSET_ID',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Tìm thấy tài nguyên khớp chính xác ID "${exactAsset.id}" trong Thư viện V4`],
        asset: exactAsset
      };
    } else {
      // Incompatible Asset Type! (e.g. Requested background, but targetAssetId is a prop)
      return {
        requirementId: reqId,
        resolvedAssetId: exactAsset.id,
        resolutionMethod: 'INCOMPATIBLE_ASSET_TYPE',
        matchScore: 0,
        confidence: 'INCOMPATIBLE',
        status: 'INCOMPATIBLE',
        reasons: [`Tài nguyên "${exactAsset.id}" thuộc loại "${exactAsset.type}", không tương thích với loại yêu cầu "${reqType}".`],
        asset: exactAsset
      };
    }
  }

  // Character Resolution (Exact ID + Semantic Role & Identity Matching)
  if (reqType === 'character') {
    const knownChars = ['doc', 'jake', 'chibi_doc'];
    const normTarget = targetId.toLowerCase();
    const normName = (requirement.name || '').toLowerCase();
    const normDesc = (requirement.description || '').toLowerCase();
    const role = (requirement.role || '').toLowerCase();

    // 1. Direct match
    let matchedChar = knownChars.find(c => normTarget === c || normTarget.includes(c));

    // 2. Semantic role matching: scientist / nhà khoa học / giáo sư -> Doc
    if (!matchedChar) {
      const isScientist = normTarget.includes('scientist') || normName.includes('scientist') || 
                          normName.includes('khoa_hoc') || normDesc.includes('khoa_hoc') || 
                          role.includes('scientist') || role.includes('khoa_hoc');
      if (isScientist) {
        matchedChar = normTarget.includes('chibi') ? 'chibi_doc' : 'doc';
      }
    }

    if (matchedChar) {
      const isChibi = matchedChar.startsWith('chibi');
      return {
        requirementId: reqId,
        resolvedAssetId: matchedChar,
        resolutionMethod: (normTarget === matchedChar) ? 'EXACT_CHARACTER_ID' : 'SEMANTIC_ROLE_MATCH',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Khớp nhân vật ${matchedChar === 'doc' ? 'Doc (Nhà Khoa Học)' : matchedChar} theo vai trò/danh tính`],
        asset: { id: matchedChar, type: 'character', mode: isChibi ? 'chibi' : 'built_in' }
      };
    }
  }

  // Built-in Character Rig for Mode A / Chibi Characters (Doc, Jake, Chibi Doc)
  if (reqType === 'character_rig') {
    const knownChars = ['doc', 'jake', 'chibi_doc'];
    const normTarget = targetId.toLowerCase();
    let matchedChar = knownChars.find(c => normTarget === c || normTarget.includes(c));
    if (!matchedChar && (normTarget.includes('scientist') || normTarget.includes('khoa_hoc'))) {
      matchedChar = normTarget.includes('chibi') ? 'chibi_doc' : 'doc';
    }
    if (matchedChar) {
      const isChibi = matchedChar.startsWith('chibi');
      return {
        requirementId: reqId,
        resolvedAssetId: matchedChar,
        resolutionMethod: isChibi ? 'CHIBI_RIG' : 'BUILTIN_RIG',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Rig nhân vật ${isChibi ? 'Chibi' : 'Mode A'} "${matchedChar}" đã tích hợp sẵn đầy đủ cấu trúc xương`],
        asset: { id: matchedChar, type: 'character_rig', mode: isChibi ? 'chibi' : 'built_in' }
      };
    }
  }

  // Built-in Hand Anchors for Rig
  if (reqType === 'anchor_point') {
    const norm = targetId.toLowerCase();
    const isKnownChar = norm.includes('doc') || norm.includes('jake') || norm.includes('scientist');
    const knownAnchors = ['left_hand', 'right_hand', 'head_top', 'chest', 'hand'];
    const hasValidAnchor = knownAnchors.some(a => norm.includes(a));
    if (isKnownChar || hasValidAnchor) {
      return {
        requirementId: reqId,
        resolvedAssetId: targetId,
        resolutionMethod: 'BUILTIN_RIG_ANCHOR',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Điểm neo "${targetId}" đã sẵn có trên hệ thống xương nhân vật`],
        anchor: { x: 0.5, y: 0.85 }
      };
    }
  }

  // -------------------------------------------------------------
  // Priority 2: Existing Project Binding
  // -------------------------------------------------------------
  if (projectBindings[reqId]) {
    const binding = projectBindings[reqId];
    return {
      requirementId: reqId,
      resolvedAssetId: binding.resolvedAssetId,
      resolutionMethod: 'EXISTING_PROJECT_BINDING',
      matchScore: 100,
      confidence: 'EXACT_MATCH',
      status: binding.status || 'READY',
      reasons: [`Sử dụng liên kết có sẵn của dự án: ${binding.resolvedAssetId}`],
      binding
    };
  }

  // -------------------------------------------------------------
  // Expressions Check (Built-in + Assets)
  // -------------------------------------------------------------
  if (reqType === 'expression') {
    const exprAsset = getAsset(`expr_${targetId}`) || getAsset(targetId);
    if (exprAsset) {
      return {
        requirementId: reqId,
        resolvedAssetId: exprAsset.id,
        resolutionMethod: 'EXACT_ASSET_ID',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Khớp chính xác biểu cảm "${exprAsset.id}" trong Thư viện V4`],
        asset: exprAsset
      };
    }
    const standardExpressions = new Set([
      'neutral', 'happy', 'laughing', 'thoughtful', 'thinking', 'focused',
      'surprised', 'shocked', 'curious', 'sad', 'crying', 'dizzy', 'talking',
      'furious', 'angry', 'love_eyes', 'scared'
    ]);
    const normExpr = targetId.toLowerCase().replace(/^expr_/, '');
    if (standardExpressions.has(normExpr)) {
      return {
        requirementId: reqId,
        resolvedAssetId: `expr_${normExpr}`,
        resolutionMethod: 'BUILTIN_EXPRESSION',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Biểu cảm nét mặt "${normExpr}" có sẵn trong thư viện biểu cảm hoạt hình`],
        expression: { id: normExpr }
      };
    }
  }

  // -------------------------------------------------------------
  // Capability Check for Actions / VFX / Weather
  // -------------------------------------------------------------
  if (reqType === 'action' || reqType === 'composite_action') {
    // 1. Exact action asset in Universal Library
    const actionAsset = getAsset(targetId) || getAsset(`action_${targetId}`) || getAsset(`composite_${targetId}`);
    if (actionAsset) {
      return {
        requirementId: reqId,
        resolvedAssetId: actionAsset.id,
        resolutionMethod: 'EXACT_ASSET_ID',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Khớp chính xác file hành động "${actionAsset.id}" trong Thư viện V4`],
        asset: actionAsset
      };
    }

    // 2. Composite Action Templates
    const normAct = targetId.toLowerCase();
    const compTemplates = COMPOSITE_ACTION_TEMPLATES || {};
    const foundComp = compTemplates[normAct] || compTemplates[`composite_${normAct}`] || compTemplates[normAct.replace(/^composite_/, '')];
    if (foundComp) {
      return {
        requirementId: reqId,
        resolvedAssetId: foundComp.id,
        resolutionMethod: 'COMPOSITE_ACTION_TEMPLATE',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Hành động phức hợp "${foundComp.id}" được hỗ trợ sẵn bởi Composite Action Engine`],
        action: foundComp
      };
    }

    // 3. CAPABILITY_REGISTRY composite actions
    const verifiedActions = CAPABILITY_REGISTRY.compositeActions || [];
    const foundAction = verifiedActions.find(a => a.id === targetId || a.id === `composite_${targetId}` || a.id === targetId.replace(/^composite_/, ''));
    if (foundAction) {
      return {
        requirementId: reqId,
        resolvedAssetId: foundAction.id,
        resolutionMethod: 'CAPABILITY_REGISTRY',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Hành động "${foundAction.id}" được hỗ trợ đầy đủ bởi engine`],
        action: foundAction
      };
    }

    // 4. Standard Built-in Procedural Actions supported by Universal Motion Engine
    const STANDARD_PROCEDURAL_ACTIONS = new Set([
      'idle', 'idle_talk', 'idle_breathe', 'stand', 'talk', 'talking',
      'walk', 'walk_cycle', 'walk_in', 'walk_out', 'run', 'run_cycle', 'sneak_walk', 'approach',
      'sit', 'sit_down', 'wave_hand', 'raise_arm', 'point_forward',
      'scratch_head', 'fall_backward', 'celebrate', 'thinking', 'thoughtful',
      'look_around', 'bow', 'shrug', 'nod', 'shake_head', 'dance', 'jump',
      'surprised', 'shocked', 'angry', 'laughing',
      'inspect', 'inspect_computer', 'eureka', 'eureka_idea', 'examine'
    ]);
    const bareAct = normAct.replace(/^act_/, '').replace(/^action_/, '');
    if (STANDARD_PROCEDURAL_ACTIONS.has(bareAct) || STANDARD_PROCEDURAL_ACTIONS.has(normAct)) {
      return {
        requirementId: reqId,
        resolvedAssetId: bareAct,
        resolutionMethod: 'BUILTIN_ACTION_ENGINE',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Hành động "${bareAct}" được hỗ trợ đầy đủ bởi Universal Motion Engine V4`],
        action: { id: bareAct, type: 'action', mode: 'procedural' }
      };
    }

    // 5. Truly Unsupported Action
    return {
      requirementId: reqId,
      resolvedAssetId: null,
      resolutionMethod: 'UNSUPPORTED_ACTION_CAPABILITY',
      matchScore: 0,
      confidence: 'MISSING_CAPABILITY',
      status: 'MISSING_CAPABILITY',
      reasons: [`Engine chưa hỗ trợ diễn hoạt hành động "${targetId}". Cần phương án thay thế hoặc AI Repair Package.`]
    };
  }

  // -------------------------------------------------------------
  // VFX Check (Built-in VFX Engine + Assets)
  // -------------------------------------------------------------
  if (reqType === 'vfx') {
    const vfxAsset = getAsset(targetId) || getAsset(`vfx_${targetId.replace(/^vfx_/, '')}`);
    if (vfxAsset) {
      return {
        requirementId: reqId,
        resolvedAssetId: vfxAsset.id,
        resolutionMethod: 'EXACT_ASSET_ID',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Khớp chính xác hiệu ứng VFX "${vfxAsset.id}" trong Thư viện V4`],
        asset: vfxAsset
      };
    }
    const normVfx = targetId.toLowerCase().replace(/^vfx_/, '');
    if (normVfx.includes('smoke') || normVfx.includes('dust') || normVfx.includes('cloud')) {
      const smokeAsset = getAsset('vfx_smoke_puff') || getAsset('vfx_dust_cloud');
      if (smokeAsset) {
        return {
          requirementId: reqId,
          resolvedAssetId: smokeAsset.id,
          resolutionMethod: 'SEMANTIC_VFX_MATCH',
          matchScore: 95,
          confidence: 'HIGH_CONFIDENCE',
          status: 'READY',
          reasons: [`Khớp hiệu ứng khói "${smokeAsset.id}" từ Thư viện VFX`],
          asset: smokeAsset
        };
      }
    }
    if (normVfx.includes('bulb') || normVfx.includes('light') || normVfx.includes('idea')) {
      const bulbAsset = getAsset('vfx_idea_bulb');
      if (bulbAsset) {
        return {
          requirementId: reqId,
          resolvedAssetId: bulbAsset.id,
          resolutionMethod: 'SEMANTIC_VFX_MATCH',
          matchScore: 95,
          confidence: 'HIGH_CONFIDENCE',
          status: 'READY',
          reasons: [`Khớp hiệu ứng bóng đèn ý tưởng "${bulbAsset.id}" từ Thư viện VFX`],
          asset: bulbAsset
        };
      }
    }
  }

  // -------------------------------------------------------------
  // Priority 3: Semantic Match & Aliases
  // -------------------------------------------------------------
  const allLibraryAssets = listAssets() || [];
  let bestCandidate = null;
  let bestScore = 0;
  let matchReasons = [];

  for (const asset of allLibraryAssets) {
    if (!isTypeCompatible(asset.type, reqType)) continue;

    let score = 0;
    const reasons = [];
    const assetIdNorm = normalizeText(asset.id);
    const assetNameNorm = normalizeText(asset.name || '');
    const assetTags = (asset.tags || []).map(t => normalizeText(t));

    // A. Check Semantic Alias Match
    const aliasGroup = findAliasGroup(targetId) || findAliasGroup(reqName);
    if (aliasGroup && aliasGroup.some(a => assetIdNorm.includes(a) || assetNameNorm.includes(a))) {
      score += 85;
      reasons.push(`Khớp từ đồng nghĩa trong nhóm alias "${aliasGroup[0]}"`);
    }

    // B. Direct Name or ID Token Match
    if (assetIdNorm === reqName || assetNameNorm === reqName) {
      score += 80;
      reasons.push('Tên hoặc ID trùng khớp ngữ nghĩa');
    } else if (reqName.length >= 6 && assetNameNorm.length >= 6 && (assetNameNorm.includes(reqName) || reqName.includes(assetNameNorm))) {
      score += 60;
      reasons.push('Một phần tên trùng khớp');
    }

    // C. Tag Overlaps
    for (const tag of assetTags) {
      if (reqName.includes(tag) || reqDesc.includes(tag)) {
        score += 20;
        reasons.push(`Trùng tag "${tag}"`);
        break;
      }
    }

    // D. Style & Category Compatibility
    if (asset.style === requirement.styleProfileId) {
      score += 10;
      reasons.push('Đồng nhất phong cách đồ họa');
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = asset;
      matchReasons = reasons;
    }
  }

  if (bestCandidate && bestScore >= 80) {
    return {
      requirementId: reqId,
      resolvedAssetId: bestCandidate.id,
      resolutionMethod: 'SEMANTIC_MATCH',
      matchScore: Math.min(95, bestScore),
      confidence: 'CONFIDENT_MATCH',
      status: 'READY',
      reasons: matchReasons,
      asset: bestCandidate
    };
  }

  if (bestCandidate && bestScore >= 50) {
    return {
      requirementId: reqId,
      resolvedAssetId: bestCandidate.id,
      resolutionMethod: 'SEMANTIC_SUGGESTION',
      matchScore: bestScore,
      confidence: 'REVIEW_REQUIRED',
      status: 'REVIEW_REQUIRED',
      reasons: [...matchReasons, 'Cần người dùng xác nhận tính phù hợp trước khi sử dụng'],
      asset: bestCandidate
    };
  }

  // -------------------------------------------------------------
  // Priority 4: Compatible Alternative in Same Category
  // -------------------------------------------------------------
  const sameCategoryFallback = allLibraryAssets.find(a => isTypeCompatible(a.type, reqType));
  if (sameCategoryFallback && options.suggestAlternatives) {
    return {
      requirementId: reqId,
      resolvedAssetId: sameCategoryFallback.id,
      resolutionMethod: 'COMPATIBLE_ALTERNATIVE',
      matchScore: 35,
      confidence: 'REVIEW_REQUIRED',
      status: 'REVIEW_REQUIRED',
      reasons: [`Đề xuất tài nguyên thay thế trong cùng nhóm: ${sameCategoryFallback.name}`],
      asset: sameCategoryFallback
    };
  }

  // -------------------------------------------------------------
  // Priority 5: Missing Requirement
  // -------------------------------------------------------------
  return {
    requirementId: reqId,
    resolvedAssetId: null,
    resolutionMethod: 'UNRESOLVED',
    matchScore: 0,
    confidence: 'NO_MATCH',
    status: 'MISSING',
    reasons: ['Chưa có tài nguyên phù hợp trong thư viện. Cần sinh ảnh hoặc import từ ngoài.']
  };
}

export function batchResolveRequirements(requirements = [], projectBindings = {}, options = {}) {
  const results = [];
  for (const req of requirements) {
    results.push(resolveAssetRequirement(req, projectBindings, options));
  }
  return {
    results,
    summary: {
      total: results.length,
      readyCount: results.filter(r => r.status === 'READY').length,
      missingCount: results.filter(r => r.status === 'MISSING').length,
      reviewRequiredCount: results.filter(r => r.status === 'REVIEW_REQUIRED').length,
      missingCapabilityCount: results.filter(r => r.status === 'MISSING_CAPABILITY').length
    }
  };
}

function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function findAliasGroup(term) {
  if (!term) return null;
  const norm = normalizeText(term);
  const tokens = norm.split('_').filter(t => t.length >= 3 && t !== 'req' && t !== 'prop' && t !== 'bg');

  for (const [key, aliases] of Object.entries(SEMANTIC_ALIASES)) {
    const normAliases = aliases.map(a => normalizeText(a));
    // Exact full alias match
    if (normAliases.includes(norm)) return aliases;
    // Multi-token match: all key tokens match or primary keyword matches exactly
    for (const token of tokens) {
      if (normAliases.some(a => a === token || a === `${token}_${key}` || a === `${key}_${token}`)) {
        return aliases;
      }
    }
  }
  return null;
}

function isTypeCompatible(libType, reqType) {
  if (libType === reqType) return true;
  if (reqType === 'prop' && libType === 'prop') return true;
  if (reqType === 'background' && libType === 'background') return true;
  if (reqType === 'outfit' && libType === 'outfit') return true;
  if (reqType === 'expression' && libType === 'expression') return true;
  if (reqType === 'vfx' && libType === 'vfx') return true;
  if (reqType === 'weather' && libType === 'weather') return true;
  if ((reqType === 'composite_action' || reqType === 'action') && (libType === 'composite_action' || libType === 'action')) return true;
  return false;
}
