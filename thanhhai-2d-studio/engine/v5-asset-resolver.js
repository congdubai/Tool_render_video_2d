// engine/v5-asset-resolver.js — Central Asset Resolution Engine (V5 Phase 2)
// Implements 5-tier priority matching: Exact ID, Existing Binding, Semantic Match,
// Compatible Alternative, and Missing Requirement with confidence scoring.

import { getAsset, listAssets } from '../../lib/asset-registry.mjs';
import { CAPABILITY_REGISTRY } from './v5-capability-registry.js';

// Predefined semantic aliases mapping for rule-based matching without local LLM
const SEMANTIC_ALIASES = {
  coffee_cup: ['coffee_cup', 'coffee_mug', 'cup_coffee', 'coc_ca_phe', 'tach_ca_phe', 'ly_ca_phe', 'prop_coffee_cup'],
  eniac_computer: ['eniac', 'eniac_computer', 'may_tinh_eniac', 'mainframe_computer', 'vintage_computer', 'vacuum_tube_computer'],
  vintage_book: ['vintage_book', 'sach_co', 'old_book', 'cuon_sach', 'prop_vintage_book'],
  smartphone: ['smartphone', 'dien_thoai', 'mobile_phone', 'prop_smartphone', 'cellphone'],
  laptop: ['laptop', 'may_tinh_xach_tay', 'prop_laptop', 'notebook'],
  desk: ['desk', 'ban_lam_viec', 'table', 'office_desk', 'ban_hoc'],
  chair: ['chair', 'ghe_tua', 'office_chair', 'ghe_lam_viec'],
  pen: ['pen', 'but_viet', 'pencil', 'ballpoint_pen'],
  broom: ['broom', 'choi_quet', 'cleaning_broom'],
  vacuum_tube: ['vacuum_tube', 'bong_den_chan_khong', 'electronic_tube', 'den_dien_tu'],
  microprocessor: ['microprocessor', 'vi_xu_ly', 'cpu', 'chip_xu_ly', 'silicon_chip'],
  transistor: ['transistor', 'bong_ban_dan', 'linh_kien_ban_dan']
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

  // Also check built-in character / rig exact match
  if (reqType === 'character' || reqType === 'character_rig') {
    const knownChars = ['doc', 'jake'];
    const matchedChar = knownChars.find(c => c === targetId.toLowerCase() || targetId.toLowerCase().includes(c));
    if (matchedChar) {
      return {
        requirementId: reqId,
        resolvedAssetId: matchedChar,
        resolutionMethod: 'EXACT_CHARACTER_ID',
        matchScore: 100,
        confidence: 'EXACT_MATCH',
        status: 'READY',
        reasons: [`Khớp chính xác nhân vật tích hợp "${matchedChar}" (Mode A)`],
        asset: { id: matchedChar, type: 'character', mode: 'built_in' }
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
  // Capability Check for Actions / VFX / Weather
  // -------------------------------------------------------------
  if (reqType === 'action' || reqType === 'composite_action') {
    const verifiedActions = CAPABILITY_REGISTRY.compositeActions || [];
    const foundAction = verifiedActions.find(a => a.id === targetId || a.id === `composite_${targetId}`);
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
    } else {
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
