// engine/unified-character-renderer.js — THANH HAI 2D STUDIO V5.2 PHASE 1
// Unified 2D Character Renderer, Standardized 15-Joint Rig, Multi-View Geometry,
// Independent-Layer Facial Expression Engine, Character Continuity & Mode B Compatibility.
//
// Single source of truth used by:
// - Tab 3 Character Preview
// - Tab 2 Scene Preview
// - Tab 4 Automatic Scene Builder
// - Animation Preview
// - Final MP4 Renderer (Playwright Canvas -> FFmpeg)

import { drawImportedFigure } from './imported-rig2d.js';

// ============================================================================
// 1. CONSTANTS: SUPPORTED VIEWS, EXPRESSIONS, MODES & 15-JOINT RIG SPEC
// ============================================================================

export const CHARACTER_RENDER_MODES = {
  PROCEDURAL_RIG: 'procedural_rig',
  LAYERED_PNG_RIG: 'layered_png_rig',
  SINGLE_PNG: 'single_png'
};

export const SUPPORTED_VIEWS = [
  'front',
  'three_quarter_left',
  'three_quarter_right',
  'side_left',
  'side_right',
  'back'
];

export const REQUIRED_EXPRESSIONS = [
  'neutral',
  'happy',
  'sad',
  'angry',
  'surprised',
  'thinking',
  'confused',
  'scared',
  'excited',
  'tired'
];

export const EXPRESSION_ALIAS_MAP = {
  neutral: 'neutral',
  calm: 'neutral',
  idle: 'neutral',
  binh_thuong: 'neutral',

  happy: 'happy',
  smile: 'happy',
  joy: 'happy',
  cheerful: 'happy',
  laughing: 'happy',
  vui: 'happy',

  sad: 'sad',
  sorrow: 'sad',
  crying: 'sad',
  cry: 'sad',
  buon: 'sad',

  angry: 'angry',
  furious: 'angry',
  determined: 'angry',
  tuc_gian: 'angry',

  surprised: 'surprised',
  shocked: 'surprised',
  awe: 'surprised',
  ngac_nhien: 'surprised',

  thinking: 'thinking',
  ponder: 'thinking',
  inspect: 'thinking',
  inspecting: 'thinking',
  suy_nghi: 'thinking',

  confused: 'confused',
  puzzled: 'confused',
  boi_roi: 'confused',

  scared: 'scared',
  terrified: 'scared',
  worried: 'scared',
  nervous: 'scared',
  so_hai: 'scared',

  excited: 'excited',
  eureka: 'excited',
  celebrating: 'excited',
  love_eyes: 'excited',
  hao_hung: 'excited',

  tired: 'tired',
  sleepy: 'tired',
  exhausted: 'tired',
  relief: 'tired',
  met_moi: 'tired'
};

/**
 * Standardized 15-Joint Hierarchical Rig Specification
 * Each joint defines: id, parent, pivot (local offset), length, rotationLimits [minDeg, maxDeg], layerOrder
 */
export const RIG_JOINT_SPEC = {
  hip:         { id: 'hip',         parent: null,          pivot: [0, 0],     length: 0,  rotationLimits: [-30, 30],   layerOrder: 10 },
  torso:       { id: 'torso',       parent: 'hip',         pivot: [0, -34],   length: 34, rotationLimits: [-35, 35],   layerOrder: 12 },
  neck:        { id: 'neck',        parent: 'torso',       pivot: [0, -6],    length: 8,  rotationLimits: [-20, 20],   layerOrder: 14 },
  head:        { id: 'head',        parent: 'neck',        pivot: [0, -34],   length: 34, rotationLimits: [-35, 35],   layerOrder: 20 },

  shoulder_L:  { id: 'shoulder_L',  parent: 'torso',       pivot: [-16, 2],   length: 0,  rotationLimits: [-175, 175], layerOrder: 4  },
  upper_arm_L: { id: 'upper_arm_L', parent: 'shoulder_L',  pivot: [0, 17],    length: 17, rotationLimits: [-165, 165], layerOrder: 5  },
  elbow_L:     { id: 'elbow_L',     parent: 'upper_arm_L', pivot: [0, 0],     length: 0,  rotationLimits: [-145, 15],  layerOrder: 5  },
  forearm_L:   { id: 'forearm_L',   parent: 'elbow_L',     pivot: [0, 15],    length: 15, rotationLimits: [-145, 20],  layerOrder: 6  },
  wrist_L:     { id: 'wrist_L',     parent: 'forearm_L',   pivot: [0, 0],     length: 0,  rotationLimits: [-65, 65],   layerOrder: 6  },
  hand_L:      { id: 'hand_L',      parent: 'wrist_L',     pivot: [0, 4],     length: 6,  rotationLimits: [-45, 45],   layerOrder: 7  },

  shoulder_R:  { id: 'shoulder_R',  parent: 'torso',       pivot: [16, 2],    length: 0,  rotationLimits: [-175, 175], layerOrder: 24 },
  upper_arm_R: { id: 'upper_arm_R', parent: 'shoulder_R',  pivot: [0, 17],    length: 17, rotationLimits: [-165, 165], layerOrder: 25 },
  elbow_R:     { id: 'elbow_R',     parent: 'upper_arm_R', pivot: [0, 0],     length: 0,  rotationLimits: [-145, 15],  layerOrder: 25 },
  forearm_R:   { id: 'forearm_R',   parent: 'elbow_R',     pivot: [0, 15],    length: 15, rotationLimits: [-145, 20],  layerOrder: 26 },
  wrist_R:     { id: 'wrist_R',     parent: 'forearm_R',   pivot: [0, 0],     length: 0,  rotationLimits: [-65, 65],   layerOrder: 26 },
  hand_R:      { id: 'hand_R',      parent: 'wrist_R',     pivot: [0, 4],     length: 6,  rotationLimits: [-45, 45],   layerOrder: 27 },

  thigh_L:     { id: 'thigh_L',     parent: 'hip',         pivot: [-10, 2],   length: 20, rotationLimits: [-110, 100], layerOrder: 6  },
  knee_L:      { id: 'knee_L',      parent: 'thigh_L',     pivot: [0, 20],    length: 0,  rotationLimits: [-10, 145],  layerOrder: 7  },
  shin_L:      { id: 'shin_L',      parent: 'knee_L',      pivot: [0, 20],    length: 20, rotationLimits: [-10, 145],  layerOrder: 8  },
  ankle_L:     { id: 'ankle_L',     parent: 'shin_L',      pivot: [0, 0],     length: 0,  rotationLimits: [-45, 45],   layerOrder: 8  },
  foot_L:      { id: 'foot_L',      parent: 'ankle_L',     pivot: [0, 4],     length: 8,  rotationLimits: [-45, 45],   layerOrder: 9  },

  thigh_R:     { id: 'thigh_R',     parent: 'hip',         pivot: [10, 2],    length: 20, rotationLimits: [-110, 100], layerOrder: 15 },
  knee_R:      { id: 'knee_R',      parent: 'thigh_R',     pivot: [0, 20],    length: 0,  rotationLimits: [-10, 145],  layerOrder: 16 },
  shin_R:      { id: 'shin_R',      parent: 'knee_R',      pivot: [0, 20],    length: 20, rotationLimits: [-10, 145],  layerOrder: 17 },
  ankle_R:     { id: 'ankle_R',     parent: 'shin_R',      pivot: [0, 0],     length: 0,  rotationLimits: [-45, 45],   layerOrder: 17 },
  foot_R:      { id: 'foot_R',      parent: 'ankle_R',     pivot: [0, 4],     length: 8,  rotationLimits: [-45, 45],   layerOrder: 18 }
};

export const REQUIRED_15_JOINTS = [
  'head', 'neck', 'torso', 'shoulder', 'upper_arm', 'elbow', 'forearm', 'wrist', 'hand',
  'hip', 'thigh', 'knee', 'shin', 'ankle', 'foot'
];

// ============================================================================
// 2. CANONICAL CHARACTER LIBRARY & IDENTITY CONTINUITY REGISTRY
// ============================================================================

export const CANONICAL_CHARACTERS = {
  chibi_doc: {
    id: 'chibi_doc',
    name: 'Doc',
    type: 'builtin',
    characterEngine: 'chibi',
    artStyle: 'clean_2d_cartoon',
    gender: 'boy',
    skinColor: '#ffe5d4',
    hair: {
      style: 'side_part',
      color: '#6b7280',
      highlight: '#9ca3af'
    },
    face: {
      shape: 'chibi_tapered',
      eyeStyle: 'oval',
      eyeColor: '#1b1d24',
      browStyle: 'soft',
      mouthStyle: 'smile',
      blush: false,
      freckles: false
    },
    proportions: {
      headScale: 1.0,
      torsoLength: 36,
      armLength: 34,
      legLength: 46
    },
    outfit: {
      id: 'labcoat_scientist',
      type: 'labcoat',
      bottomType: 'pants',
      shoeType: 'casual',
      topColor: '#f3f4f6',
      topColor2: '#cbd5e1',
      pantsColor: '#1f2937',
      shoeColor: '#0f172a',
      headwear: 'none',
      accessories: ['glasses', 'pen']
    },
    defaultExpression: 'thinking',
    defaultFacing: 'three_quarter_right'
  },
  chibi_max: {
    id: 'chibi_max',
    name: 'Max',
    type: 'builtin',
    characterEngine: 'chibi',
    artStyle: 'clean_2d_cartoon',
    gender: 'boy',
    skinColor: '#ffdfc4',
    hair: {
      style: 'short',
      color: '#4a3728',
      highlight: '#7a5c43'
    },
    face: {
      shape: 'chibi_tapered',
      eyeStyle: 'oval',
      eyeColor: '#1b1d24',
      browStyle: 'soft',
      mouthStyle: 'smile',
      blush: true,
      freckles: false
    },
    proportions: {
      headScale: 1.0,
      torsoLength: 36,
      armLength: 34,
      legLength: 46
    },
    outfit: {
      id: 'hoodie_explorer',
      type: 'hoodie',
      bottomType: 'pants',
      shoeType: 'sneakers',
      topColor: '#d64a33',
      topColor2: '#b83822',
      pantsColor: '#2e384d',
      shoeColor: '#1e1e24',
      headwear: 'none',
      accessories: ['backpack']
    },
    defaultExpression: 'happy',
    defaultFacing: 'three_quarter_right'
  },
  chibi_jake: {
    id: 'chibi_jake',
    name: 'Jake',
    type: 'builtin',
    characterEngine: 'chibi',
    artStyle: 'clean_2d_cartoon',
    gender: 'boy',
    skinColor: '#fcdcc6',
    hair: {
      style: 'spiky',
      color: '#232029',
      highlight: '#423d4c'
    },
    face: {
      shape: 'chibi_tapered',
      eyeStyle: 'oval',
      eyeColor: '#1b1d24',
      browStyle: 'sharp',
      mouthStyle: 'grin',
      blush: false,
      freckles: false
    },
    proportions: {
      headScale: 1.0,
      torsoLength: 36,
      armLength: 34,
      legLength: 46
    },
    outfit: {
      id: 'tshirt_cap',
      type: 'tshirt',
      bottomType: 'pants',
      shoeType: 'sneakers',
      topColor: '#3b82f6',
      topColor2: '#1d4ed8',
      pantsColor: '#374151',
      shoeColor: '#111827',
      headwear: 'cap',
      headwearColor: '#f2c21a',
      accessories: []
    },
    defaultExpression: 'happy',
    defaultFacing: 'three_quarter_right'
  },
  chibi_luna: {
    id: 'chibi_luna',
    name: 'Luna',
    type: 'builtin',
    characterEngine: 'chibi',
    artStyle: 'clean_2d_cartoon',
    gender: 'girl',
    skinColor: '#ffe8d6',
    hair: {
      style: 'bun',
      color: '#5b3a29',
      highlight: '#8c583e'
    },
    face: {
      shape: 'chibi_tapered',
      eyeStyle: 'sparkle',
      eyeColor: '#1a1a24',
      browStyle: 'soft',
      mouthStyle: 'smile',
      blush: true,
      freckles: true
    },
    proportions: {
      headScale: 0.98,
      torsoLength: 34,
      armLength: 33,
      legLength: 45
    },
    outfit: {
      id: 'casual_dress',
      type: 'dress',
      bottomType: 'skirt',
      shoeType: 'casual',
      topColor: '#ec4899',
      topColor2: '#db2777',
      pantsColor: '#fbcfe8',
      shoeColor: '#831843',
      headwear: 'headband',
      headwearColor: '#f472b6',
      accessories: []
    },
    defaultExpression: 'happy',
    defaultFacing: 'three_quarter_right'
  }
};

export const CHARACTER_ID_ALIASES = {
  doc: 'chibi_doc',
  chibi_doc: 'chibi_doc',
  scientist_01: 'chibi_doc',
  scientist: 'chibi_doc',
  req_char_scientist_01: 'chibi_doc',
  req_char_doc: 'chibi_doc',
  max: 'chibi_max',
  chibi_max: 'chibi_max',
  req_char_max: 'chibi_max',
  jake: 'chibi_jake',
  chibi_jake: 'chibi_jake',
  req_char_jake: 'chibi_jake',
  luna: 'chibi_luna',
  chibi_luna: 'chibi_luna',
  req_char_luna: 'chibi_luna'
};

// Runtime character registry (populated with canonical presets + any loaded library JSONs)
const runtimeCharacterRegistry = new Map(
  Object.entries(CANONICAL_CHARACTERS).map(([k, v]) => [k, deepClone(v)])
);

function deepClone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : obj;
}

export function registerCharacterProfile(profile) {
  if (!profile || !profile.id) return null;
  const normalized = normalizeCharacterProfile(profile);
  runtimeCharacterRegistry.set(normalized.id, normalized);
  return normalized;
}

export function registerCharacterProfiles(list = []) {
  if (!Array.isArray(list)) return;
  for (const item of list) registerCharacterProfile(item);
}

export function getRegisteredCharacter(idOrAlias) {
  if (!idOrAlias) return null;
  const key = String(idOrAlias).trim();
  if (runtimeCharacterRegistry.has(key)) return deepClone(runtimeCharacterRegistry.get(key));
  const lower = key.toLowerCase();
  if (runtimeCharacterRegistry.has(lower)) return deepClone(runtimeCharacterRegistry.get(lower));
  const aliasTarget = CHARACTER_ID_ALIASES[lower];
  if (aliasTarget && runtimeCharacterRegistry.has(aliasTarget)) {
    return deepClone(runtimeCharacterRegistry.get(aliasTarget));
  }
  return null;
}

/**
 * Classifies a character into one of the 3 Mode A / Mode B render modes.
 */
export function detectCharacterRenderMode(profile = {}) {
  const isImported = profile.type === 'imported' || !!profile.importType || !!profile.sourceImage || (profile.parts && Object.keys(profile.parts).length > 0);
  if (!isImported) return CHARACTER_RENDER_MODES.PROCEDURAL_RIG;

  const partKeys = profile.parts ? Object.keys(profile.parts).filter(k => profile.parts[k] && (profile.parts[k].image || profile.parts[k].imagePath || profile.parts[k].dataUrl)) : [];
  if (profile.importType === 'single' || profile.importType === 'single_png' || (partKeys.length <= 1 && !profile.rig?.bones?.length)) {
    return CHARACTER_RENDER_MODES.SINGLE_PNG;
  }
  if (partKeys.length > 1) {
    return CHARACTER_RENDER_MODES.LAYERED_PNG_RIG;
  }
  return CHARACTER_RENDER_MODES.SINGLE_PNG;
}

/**
 * Normalizes any character definition (Tab 3 JSON, legacy chibi-rig2d outfit, or Mode B object)
 * into a unified, continuity-locked CharacterProfile.
 */
export function normalizeCharacterProfile(raw = {}) {
  const id = raw.id || raw.characterId || 'unknown_character';
  const base = getRegisteredCharacter(id);
  const src = base ? { ...base, ...raw } : raw;

  const isImported = src.type === 'imported' || !!src.importType || !!src.sourceImage || (src.parts && Object.keys(src.parts).length > 0);
  if (isImported) {
    return {
      ...src,
      id,
      name: src.name || id,
      type: 'imported',
      renderMode: detectCharacterRenderMode(src),
      proportions: { scale: 1.0, ...(src.proportions || {}) },
      defaultExpression: normalizeExpression(src.defaultExpression || 'neutral'),
      defaultFacing: normalizeViewDirection(src.defaultFacing || 'three_quarter_right')
    };
  }

  // Support both structured Tab 3 schema (skinColor, hair:{}, outfit:{}) AND legacy flat outfit ({skin, hairColor, top, color, legs, face:'glasses'})
  const rawOutfit = (src.outfit && typeof src.outfit === 'object') ? src.outfit : {};
  const rawHair = (src.hair && typeof src.hair === 'object') ? src.hair : {};
  const rawFace = (src.face && typeof src.face === 'object') ? src.face : {};
  const rawProps = (src.proportions && typeof src.proportions === 'object') ? src.proportions : {};

  const accessories = new Set(Array.isArray(rawOutfit.accessories) ? rawOutfit.accessories : (base?.outfit?.accessories || []));
  if (src.face === 'glasses' || rawOutfit.face === 'glasses' || rawFace.glasses === true) accessories.add('glasses');
  if (src.face === 'sunglasses' || rawOutfit.face === 'sunglasses') accessories.add('sunglasses');

  const topType = rawOutfit.type || src.top || base?.outfit?.type || 'hoodie';
  const bottomType = rawOutfit.bottomType || (topType === 'dress' ? 'skirt' : 'pants');

  return {
    id: base ? base.id : id,
    name: src.name || base?.name || id,
    type: 'builtin',
    characterEngine: 'chibi',
    renderMode: CHARACTER_RENDER_MODES.PROCEDURAL_RIG,
    artStyle: src.artStyle || base?.artStyle || 'clean_2d_cartoon',
    gender: src.gender || base?.gender || 'boy',
    skinColor: src.skinColor || src.skin || base?.skinColor || '#ffdfc4',
    hair: {
      style: rawHair.style || (typeof src.hair === 'string' ? src.hair : null) || base?.hair?.style || 'short',
      color: rawHair.color || src.hairColor || base?.hair?.color || '#4a3728',
      highlight: rawHair.highlight || src.hairHighlight || base?.hair?.highlight || '#7a5c43'
    },
    face: {
      shape: rawFace.shape || base?.face?.shape || 'chibi_tapered',
      eyeStyle: rawFace.eyeStyle || base?.face?.eyeStyle || 'oval',
      eyeColor: rawFace.eyeColor || base?.face?.eyeColor || '#1b1d24',
      browStyle: rawFace.browStyle || base?.face?.browStyle || 'soft',
      mouthStyle: rawFace.mouthStyle || base?.face?.mouthStyle || 'smile',
      blush: rawFace.blush ?? src.blush ?? base?.face?.blush ?? false,
      freckles: rawFace.freckles ?? base?.face?.freckles ?? false
    },
    proportions: {
      headScale: Number(rawProps.headScale ?? base?.proportions?.headScale ?? 1.0),
      torsoLength: Number(rawProps.torsoLength ?? base?.proportions?.torsoLength ?? 36),
      armLength: Number(rawProps.armLength ?? base?.proportions?.armLength ?? 34),
      legLength: Number(rawProps.legLength ?? base?.proportions?.legLength ?? 46)
    },
    outfit: {
      id: rawOutfit.id || base?.outfit?.id || `${topType}_default`,
      type: topType,
      bottomType,
      shoeType: rawOutfit.shoeType || src.shoeType || base?.outfit?.shoeType || (topType === 'labcoat' || topType === 'suit' ? 'casual' : 'sneakers'),
      topColor: rawOutfit.topColor || src.color || base?.outfit?.topColor || '#d64a33',
      topColor2: rawOutfit.topColor2 || src.topColor2 || base?.outfit?.topColor2 || '#b83822',
      pantsColor: rawOutfit.pantsColor || src.legs || base?.outfit?.pantsColor || '#2e384d',
      shoeColor: rawOutfit.shoeColor || src.shoes || base?.outfit?.shoeColor || '#1e1e24',
      headwear: rawOutfit.headwear || src.head || base?.outfit?.headwear || 'none',
      headwearColor: rawOutfit.headwearColor || src.headColor || base?.outfit?.headwearColor || '#f2c21a',
      accessories: Array.from(accessories)
    },
    defaultExpression: normalizeExpression(src.defaultExpression || base?.defaultExpression || 'neutral'),
    defaultFacing: normalizeViewDirection(src.defaultFacing || base?.defaultFacing || 'three_quarter_right')
  };
}

/**
 * Resolves a character by ID/object with strict continuity and NO silent fallback.
 */
export function resolveCharacter(input, options = {}) {
  const strict = options.strict === true;

  // 1. Direct string ID
  if (typeof input === 'string') {
    const found = getRegisteredCharacter(input);
    if (found) {
      return { resolved: true, isFallback: false, profile: normalizeCharacterProfile(found), error: null };
    }
    const err = `Character ID "${input}" not found in Character Registry (silent fallback disabled).`;
    if (strict) throw new Error(err);
    return { resolved: false, isFallback: true, profile: null, error: err };
  }

  // 2. Object with characterId / id / outfit
  if (input && typeof input === 'object') {
    const candidateId = input.characterId || input.id || input.outfit?.characterId || input.outfit?.id;
    if (candidateId) {
      const registered = getRegisteredCharacter(candidateId);
      if (registered) {
        // Continuity lock: preserve identity (id, skin, hair, face, proportions, artStyle),
        // allow scene-level outfit override if explicitly provided
        const merged = {
          ...registered,
          outfit: input.outfitOverride
            ? { ...registered.outfit, ...input.outfitOverride }
            : (input.outfit && typeof input.outfit === 'object' && input.outfit.topColor ? { ...registered.outfit, ...input.outfit } : registered.outfit)
        };
        return { resolved: true, isFallback: false, profile: normalizeCharacterProfile(merged), error: null };
      }
    }
    // If the object itself is a complete character definition (e.g. live Tab 3 editor state or Mode B character)
    if (input.skinColor || input.hair || input.parts || input.sourceImage || input.type === 'imported' || input.type === 'builtin') {
      return { resolved: true, isFallback: false, profile: normalizeCharacterProfile(input), error: null };
    }
    // Legacy outfit heuristic ONLY if explicitly has top/color (never silent fallback for unknown ID!)
    if (input.outfit && (input.outfit.top || input.outfit.color || input.outfit.face)) {
      const of = input.outfit;
      let inferredId = null;
      if (of.top === 'labcoat' || of.face === 'glasses') inferredId = 'chibi_doc';
      else if (of.head === 'cap' || of.top === 'tshirt') inferredId = 'chibi_jake';
      else if (of.top === 'dress' || of.hair === 'twintails' || of.hair === 'bun') inferredId = 'chibi_luna';
      else if (of.top === 'hoodie') inferredId = 'chibi_max';
      if (inferredId) {
        const reg = getRegisteredCharacter(inferredId);
        return { resolved: true, isFallback: false, profile: normalizeCharacterProfile({ ...reg, ...of }), error: null };
      }
    }
  }

  const err = `Unable to resolve character from input: ${JSON.stringify(input).slice(0, 120)}`;
  if (strict) throw new Error(err);
  return { resolved: false, isFallback: true, profile: null, error: err };
}

/**
 * Verifies character continuity across multiple scene states.
 */
export function verifyCharacterContinuity(baseProfile, sceneProfiles = []) {
  const lockedFields = ['id', 'skinColor', 'artStyle'];
  const diffs = [];
  for (let i = 0; i < sceneProfiles.length; i++) {
    const sp = sceneProfiles[i];
    if (!sp) {
      diffs.push({ sceneIndex: i, field: 'profile', expected: baseProfile.id, actual: null });
      continue;
    }
    for (const f of lockedFields) {
      if (sp[f] !== baseProfile[f]) {
        diffs.push({ sceneIndex: i, field: f, expected: baseProfile[f], actual: sp[f] });
      }
    }
    if (sp.hair?.style !== baseProfile.hair?.style || sp.hair?.color !== baseProfile.hair?.color) {
      diffs.push({ sceneIndex: i, field: 'hair', expected: baseProfile.hair, actual: sp.hair });
    }
    if (sp.face?.shape !== baseProfile.face?.shape) {
      diffs.push({ sceneIndex: i, field: 'face.shape', expected: baseProfile.face?.shape, actual: sp.face?.shape });
    }
    if (sp.proportions?.headScale !== baseProfile.proportions?.headScale ||
        sp.proportions?.torsoLength !== baseProfile.proportions?.torsoLength) {
      diffs.push({ sceneIndex: i, field: 'proportions', expected: baseProfile.proportions, actual: sp.proportions });
    }
  }
  return { valid: diffs.length === 0, diffs };
}

// ============================================================================
// 3. VIEW DIRECTION & EXPRESSION NORMALIZERS
// ============================================================================

export function normalizeViewDirection(view, facingNum = 1) {
  if (typeof view === 'string') {
    const v = view.toLowerCase().trim();
    if (SUPPORTED_VIEWS.includes(v)) return v;
    if (v === 'left') return 'three_quarter_left';
    if (v === 'right') return 'three_quarter_right';
    if (v === '3/4_left' || v === 'three-quarter-left') return 'three_quarter_left';
    if (v === '3/4_right' || v === 'three-quarter-right') return 'three_quarter_right';
    if (v === 'profile_left') return 'side_left';
    if (v === 'profile_right') return 'side_right';
  }
  if (typeof facingNum === 'number') {
    return facingNum < 0 ? 'three_quarter_left' : 'three_quarter_right';
  }
  return 'three_quarter_right';
}

export function getViewSupportInfo(view) {
  const v = String(view || '').toLowerCase().trim();
  const supported = SUPPORTED_VIEWS.includes(v);
  return {
    view: v,
    supported,
    supportedViews: [...SUPPORTED_VIEWS],
    reason: supported ? 'Supported natively with view-specific geometry and layer ordering.' : `View "${view}" is not supported. Supported views: ${SUPPORTED_VIEWS.join(', ')}.`
  };
}

export function normalizeExpression(expr) {
  if (!expr || typeof expr !== 'string') return 'neutral';
  const clean = expr.toLowerCase().trim();
  return EXPRESSION_ALIAS_MAP[clean] || 'neutral';
}

// ============================================================================
// 4. HIERARCHICAL 15-JOINT RIG SOLVER (FK + ROTATION LIMITS + ZERO-GAP)
// ============================================================================

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function clampJointAngle(jointId, deg) {
  const spec = RIG_JOINT_SPEC[jointId];
  if (!spec || !spec.rotationLimits) return deg;
  return clamp(deg, spec.rotationLimits[0], spec.rotationLimits[1]);
}

/**
 * Joint angle presets (in degrees, relative to rest downward/upward bone direction)
 * Conventions:
 *  - torso: 0 = upright (+ = lean forward/right)
 *  - neck/head: 0 = upright (+ = tilt forward/right)
 *  - upper_arm: 0 = straight down (+ = swing forward/right, - = swing backward/left)
 *  - forearm: 0 = straight continuation of upper arm (- = bend elbow forward/up)
 *  - thigh: 0 = straight down (+ = swing forward/right, - = swing backward/left)
 *  - shin: 0 = straight continuation (+ = bend knee backward)
 */
export const RIG_POSE_PRESETS = {
  stand: {
    hipY: -44, torso: 0, neck: 0, head: 0,
    upper_arm_L: -6, forearm_L: -8, wrist_L: 0,
    upper_arm_R: 6,  forearm_R: -8, wrist_R: 0,
    thigh_L: -2, shin_L: 2, ankle_L: 0,
    thigh_R: 2,  shin_R: 2, ankle_R: 0
  },
  idle: {
    hipY: -44, torso: 0, neck: 0, head: 0,
    upper_arm_L: -5, forearm_L: -10, wrist_L: 0,
    upper_arm_R: 5,  forearm_R: -10, wrist_R: 0,
    thigh_L: -2, shin_L: 2, ankle_L: 0,
    thigh_R: 2,  shin_R: 2, ankle_R: 0
  },
  walk: (t = 0) => {
    const phase = t * Math.PI * 2.4;
    const s = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 2.5;
    return {
      hipY: -44 - bob,
      torso: 5,
      neck: -2,
      head: -2 + Math.sin(phase * 2) * 1.5,
      upper_arm_L: -s * 28,
      forearm_L: -18 - Math.max(0, -s) * 20,
      wrist_L: 0,
      upper_arm_R: s * 28,
      forearm_R: -18 - Math.max(0, s) * 20,
      wrist_R: 0,
      thigh_L: s * 28,
      shin_L: s < 0 ? Math.abs(s) * 32 : 4,
      ankle_L: s < 0 ? -10 : 0,
      thigh_R: -s * 28,
      shin_R: s > 0 ? Math.abs(s) * 32 : 4,
      ankle_R: s > 0 ? -10 : 0
    };
  },
  run: (t = 0) => {
    const phase = t * Math.PI * 3.8;
    const s = Math.sin(phase);
    const bob = Math.abs(Math.cos(phase)) * 5;
    return {
      hipY: -45 - bob,
      torso: 14,
      neck: -6,
      head: -6,
      upper_arm_L: -s * 50,
      forearm_L: -65,
      wrist_L: 0,
      upper_arm_R: s * 50,
      forearm_R: -65,
      wrist_R: 0,
      thigh_L: s * 46,
      shin_L: s < 0 ? Math.abs(s) * 65 : 10,
      ankle_L: -12,
      thigh_R: -s * 46,
      shin_R: s > 0 ? Math.abs(s) * 65 : 10,
      ankle_R: -12
    };
  },
  wave: (t = 0) => {
    const w = Math.sin(t * 9) * 18;
    return {
      hipY: -44, torso: -3, neck: 2, head: 3,
      upper_arm_L: -8, forearm_L: -10, wrist_L: 0,
      upper_arm_R: 135, forearm_R: -35 + w, wrist_R: w * 0.5,
      thigh_L: -3, shin_L: 2, ankle_L: 0,
      thigh_R: 3,  shin_R: 2, ankle_R: 0
    };
  },
  point: {
    hipY: -44, torso: 4, neck: 0, head: 2,
    upper_arm_L: -10, forearm_L: -12, wrist_L: 0,
    upper_arm_R: 86,  forearm_R: -4,  wrist_R: 0,
    thigh_L: -4, shin_L: 2, ankle_L: 0,
    thigh_R: 6,  shin_R: 2, ankle_R: 0
  },
  thinking: (t = 0) => {
    const bob = Math.sin(t * 2.2) * 1.5;
    return {
      hipY: -44, torso: 4, neck: 4, head: 6 + bob,
      upper_arm_L: -12, forearm_L: -25, wrist_L: 0,
      upper_arm_R: 52,  forearm_R: -105, wrist_R: -10,
      thigh_L: -3, shin_L: 2, ankle_L: 0,
      thigh_R: 4,  shin_R: 2, ankle_R: 0
    };
  },
  inspect: (t = 0) => {
    const nod = Math.sin(t * 2.5) * 3;
    return {
      hipY: -43, torso: 10, neck: 3, head: 5 + nod,
      upper_arm_L: -14, forearm_L: -20, wrist_L: 0,
      upper_arm_R: 58,  forearm_R: -92, wrist_R: -8,
      thigh_L: -5, shin_L: 5, ankle_L: 0,
      thigh_R: 6,  shin_R: 4, ankle_R: 0
    };
  },
  eureka: (t = 0) => {
    const pulse = Math.sin(t * 8) * 6;
    return {
      hipY: -44 - Math.abs(Math.sin(t * 4)) * 3,
      torso: -5, neck: -2, head: -4,
      upper_arm_L: -28, forearm_L: -30, wrist_L: 0,
      upper_arm_R: 145 + pulse * 0.4, forearm_R: -22 + pulse, wrist_R: 0,
      thigh_L: -6, shin_L: 2, ankle_L: 0,
      thigh_R: 6,  shin_R: 2, ankle_R: 0
    };
  },
  celebrate: (t = 0) => {
    const pulse = Math.sin(t * 10) * 10;
    return {
      hipY: -44 - Math.abs(Math.sin(t * 5)) * 4,
      torso: -4, neck: -2, head: -3,
      upper_arm_L: -140 - pulse * 0.4, forearm_L: 22, wrist_L: 0,
      upper_arm_R: 140 + pulse * 0.4,  forearm_R: -22, wrist_R: 0,
      thigh_L: -8, shin_L: 2, ankle_L: 0,
      thigh_R: 8,  shin_R: 2, ankle_R: 0
    };
  },
  sit: {
    hipY: -32, torso: 2, neck: 0, head: 2,
    upper_arm_L: 12, forearm_L: -35, wrist_L: 0,
    upper_arm_R: 20, forearm_R: -40, wrist_R: 0,
    thigh_L: 85, shin_L: 85, ankle_L: 0,
    thigh_R: 85, shin_R: 85, ankle_R: 0
  },
  sit_chair: {
    hipY: -36, torso: 0, neck: 0, head: 2,
    upper_arm_L: 10, forearm_L: -30, wrist_L: 0,
    upper_arm_R: 18, forearm_R: -35, wrist_R: 0,
    thigh_L: 86, shin_L: 86, ankle_L: 0,
    thigh_R: 86, shin_R: 86, ankle_R: 0
  },
  talk: (t = 0) => {
    const g = Math.sin(t * 6) * 12;
    return {
      hipY: -44, torso: 2, neck: 0, head: Math.sin(t * 4) * 3,
      upper_arm_L: -10, forearm_L: -25, wrist_L: 0,
      upper_arm_R: 35 + g, forearm_R: -65 + g * 0.5, wrist_R: 0,
      thigh_L: -2, shin_L: 2, ankle_L: 0,
      thigh_R: 3,  shin_R: 2, ankle_R: 0
    };
  },
  phone: {
    hipY: -44, torso: 3, neck: 4, head: 8,
    upper_arm_L: -8, forearm_L: -10, wrist_L: 0,
    upper_arm_R: 35, forearm_R: -95, wrist_R: -10,
    thigh_L: -2, shin_L: 2, ankle_L: 0,
    thigh_R: 2,  shin_R: 2, ankle_R: 0
  },
  cup: {
    hipY: -44, torso: 0, neck: 0, head: 2,
    upper_arm_L: -8, forearm_L: -10, wrist_L: 0,
    upper_arm_R: 28, forearm_R: -68, wrist_R: 0,
    thigh_L: -2, shin_L: 2, ankle_L: 0,
    thigh_R: 2,  shin_R: 2, ankle_R: 0
  }
};

/**
 * Solves all 15 joints in local character space (feet on y = 0, up = -y).
 * Guarantees zero gaps because every child joint starts strictly at its parent's computed endpoint.
 */
export function solveCharacterRig(profile, options = {}) {
  const view = normalizeViewDirection(options.view || options.facing || profile.defaultFacing, typeof options.facing === 'number' ? options.facing : 1);
  const t = Number(options.t || 0);
  const poseName = typeof options.pose === 'string' ? options.pose.toLowerCase() : (options.action || 'stand').toLowerCase();

  let preset = RIG_POSE_PRESETS[poseName]
    || (poseName.includes('walk') ? RIG_POSE_PRESETS.walk : null)
    || (poseName.includes('run') ? RIG_POSE_PRESETS.run : null)
    || (poseName.includes('inspect') ? RIG_POSE_PRESETS.inspect : null)
    || (poseName.includes('eureka') || poseName.includes('idea') ? RIG_POSE_PRESETS.eureka : null)
    || (poseName.includes('celebrat') || poseName.includes('cheer') ? RIG_POSE_PRESETS.celebrate : null)
    || (poseName.includes('think') ? RIG_POSE_PRESETS.thinking : null)
    || (poseName.includes('point') ? RIG_POSE_PRESETS.point : null)
    || (poseName.includes('wave') ? RIG_POSE_PRESETS.wave : null)
    || (poseName.includes('sit') ? RIG_POSE_PRESETS.sit_chair : null)
    || (poseName.includes('talk') ? RIG_POSE_PRESETS.talk : null)
    || RIG_POSE_PRESETS.stand;

  const baseAngles = typeof preset === 'function' ? preset(t) : { ...preset };

  // Subtle idle breathing if standing/thinking/inspecting
  const breath = Math.sin(t * 2.6) * 0.9;
  const customAngles = (options.pose && typeof options.pose === 'object' && options.pose.angles) ? options.pose.angles : (options.jointAngles || {});
  const a = { ...baseAngles, ...customAngles };

  // Facing sign for horizontal swing (+1 = facing right, -1 = facing left, 0 = front/back symmetric)
  const isFront = view === 'front';
  const isBack = view === 'back';
  const isLeft = view === 'three_quarter_left' || view === 'side_left';
  const isSide = view === 'side_left' || view === 'side_right';
  const faceSign = isLeft ? -1 : 1;

  // Proportions from profile
  const prop = profile.proportions || {};
  const torsoLen = clamp(Number(prop.torsoLength || 36), 28, 46);
  const armLen = clamp(Number(prop.armLength || 34), 26, 44);
  const legLen = clamp(Number(prop.legLength || 46), 34, 58);
  const upperArmLen = armLen * 0.52;
  const forearmLen = armLen * 0.48;
  const thighLen = legLen * 0.46;
  const shinLen = legLen * 0.46; // remaining ~8px is ankle-to-sole inside shoe
  const neckLen = 7;
  const headRadius = 36 * clamp(Number(prop.headScale || 1.0), 0.75, 1.35);

  // Clamped joint rotations
  const torsoRot = degToRad(clampJointAngle('torso', (a.torso || 0)) * (isFront || isBack ? 0.35 : faceSign));
  const neckRot = degToRad(clampJointAngle('neck', (a.neck || 0)) * (isFront || isBack ? 0.5 : faceSign));
  const headRot = degToRad(clampJointAngle('head', (a.head || 0)) * (isFront || isBack ? 0.5 : faceSign));

  // Root hip
  const hip = [0, (a.hipY ?? -44) + breath * 0.3];

  // Spine -> torso top (shoulder line center)
  const torsoTop = [
    hip[0] + Math.sin(torsoRot) * torsoLen,
    hip[1] - Math.cos(torsoRot) * torsoLen
  ];

  // Neck -> head center
  const neckEnd = [
    torsoTop[0] + Math.sin(torsoRot + neckRot) * neckLen,
    torsoTop[1] - Math.cos(torsoRot + neckRot) * neckLen
  ];
  const head = [
    neckEnd[0] + Math.sin(torsoRot + neckRot + headRot) * (headRadius * 0.94),
    neckEnd[1] - Math.cos(torsoRot + neckRot + headRot) * (headRadius * 0.94)
  ];

  // Shoulder & hip lateral offsets depend on view direction (NO naive flip!)
  let shOffL, shOffR, hipOffL, hipOffR;
  if (isFront || isBack) {
    shOffL = -19; shOffR = 19;
    hipOffL = -11; hipOffR = 11;
  } else if (isSide) {
    shOffL = -3 * faceSign; shOffR = 3 * faceSign;
    hipOffL = -3 * faceSign; hipOffR = 3 * faceSign;
  } else {
    // 3/4 view: near shoulder & far shoulder clearly separated
    shOffL = -14 * faceSign; shOffR = 15 * faceSign;
    hipOffL = -9 * faceSign; hipOffR = 10 * faceSign;
  }

  // Rotate lateral offsets with torso
  const cosT = Math.cos(torsoRot), sinT = Math.sin(torsoRot);
  const attachOnTorso = (ox, oy) => [torsoTop[0] + ox * cosT - oy * sinT, torsoTop[1] + ox * sinT + oy * cosT];
  const attachOnHip = (ox, oy) => [hip[0] + ox, hip[1] + oy];

  // Left = far side when facing right; Right = near side when facing right (and vice-versa for left!)
  const shoulder_L = attachOnTorso(shOffL, 3);
  const shoulder_R = attachOnTorso(shOffR, 3);
  const hip_L = attachOnHip(hipOffL, 2);
  const hip_R = attachOnHip(hipOffR, 2);

  // Solve 2-segment downward limb via FK (dirSign mirrors horizontal swing for left-facing views)
  const solveArm = (shPt, upperDeg, foreDeg, wristDeg, sideMult) => {
    const uClamped = clampJointAngle('upper_arm_R', upperDeg);
    const fClamped = clampJointAngle('forearm_R', foreDeg);
    const wClamped = clampJointAngle('wrist_R', wristDeg);
    const uRad = degToRad(uClamped) * sideMult + torsoRot * 0.4;
    const fRad = uRad + degToRad(fClamped) * sideMult;
    const wRad = fRad + degToRad(wClamped) * sideMult;
    // 0 rad = straight down (0, +1); +rad swings toward +x
    const elbow = [shPt[0] + Math.sin(uRad) * upperArmLen, shPt[1] + Math.cos(uRad) * upperArmLen];
    const wrist = [elbow[0] + Math.sin(fRad) * forearmLen, elbow[1] + Math.cos(fRad) * forearmLen];
    const hand  = [wrist[0] + Math.sin(wRad) * 3.5, wrist[1] + Math.cos(wRad) * 3.5];
    return { shoulder: shPt, elbow, wrist, hand, upperAngle: uRad, foreAngle: fRad, wristAngle: wRad };
  };

  const solveLeg = (hPt, thighDeg, shinDeg, ankleDeg, sideMult) => {
    const tClamped = clampJointAngle('thigh_R', thighDeg);
    const sClamped = clampJointAngle('shin_R', shinDeg);
    const aClamped = clampJointAngle('ankle_R', ankleDeg);
    const tRad = degToRad(tClamped) * sideMult;
    // Knee bends backward (opposite of forward swing)
    const sRad = tRad - degToRad(sClamped) * sideMult;
    const knee = [hPt[0] + Math.sin(tRad) * thighLen, hPt[1] + Math.cos(tRad) * thighLen];
    const ankle = [knee[0] + Math.sin(sRad) * shinLen, knee[1] + Math.cos(sRad) * shinLen];
    const foot = [ankle[0], ankle[1] + 6];
    return { hip: hPt, knee, ankle, foot, thighAngle: tRad, shinAngle: sRad, ankleAngle: degToRad(aClamped) * sideMult };
  };

  let armL, armR, legL, legR;
  if (isFront || isBack) {
    // In front/back views, L swings left (-x) and R swings right (+x)
    armL = solveArm(shoulder_L, a.upper_arm_L ?? -6, -(a.forearm_L ?? -8), a.wrist_L ?? 0, 1);
    armR = solveArm(shoulder_R, a.upper_arm_R ?? 6, a.forearm_R ?? -8, a.wrist_R ?? 0, 1);
    legL = solveLeg(hip_L, (a.thigh_L ?? -2) * 0.25, (a.shin_L ?? 2) * 0.2, a.ankle_L ?? 0, 1);
    legR = solveLeg(hip_R, (a.thigh_R ?? 2) * 0.25, (a.shin_R ?? 2) * 0.2, a.ankle_R ?? 0, 1);
  } else {
    armL = solveArm(shoulder_L, a.upper_arm_L ?? -6, a.forearm_L ?? -8, a.wrist_L ?? 0, faceSign);
    armR = solveArm(shoulder_R, a.upper_arm_R ?? 6,  a.forearm_R ?? -8, a.wrist_R ?? 0, faceSign);
    legL = solveLeg(hip_L, a.thigh_L ?? -2, a.shin_L ?? 2, a.ankle_L ?? 0, faceSign);
    legR = solveLeg(hip_R, a.thigh_R ?? 2,  a.shin_R ?? 2, a.ankle_R ?? 0, faceSign);
  }

  // Ground contact enforcement: shift entire skeleton vertically so lowest foot sits on y = 0
  const lowestFootY = Math.max(legL.foot[1], legR.foot[1]);
  const dy = -lowestFootY;
  const shift = (pt) => [pt[0], pt[1] + dy];

  const joints = {
    hip: shift(hip),
    torso: shift(torsoTop),
    neck: shift(neckEnd),
    head: shift(head),
    headRotation: torsoRot + neckRot + headRot,
    torsoRotation: torsoRot,
    headRadius,
    shoulder_L: shift(armL.shoulder),
    upper_arm_L: shift(armL.shoulder),
    elbow_L: shift(armL.elbow),
    forearm_L: shift(armL.elbow),
    wrist_L: shift(armL.wrist),
    hand_L: shift(armL.hand),

    shoulder_R: shift(armR.shoulder),
    upper_arm_R: shift(armR.shoulder),
    elbow_R: shift(armR.elbow),
    forearm_R: shift(armR.elbow),
    wrist_R: shift(armR.wrist),
    hand_R: shift(armR.hand),

    hip_L: shift(legL.hip),
    thigh_L: shift(legL.hip),
    knee_L: shift(legL.knee),
    shin_L: shift(legL.knee),
    ankle_L: shift(legL.ankle),
    foot_L: shift(legL.foot),

    hip_R: shift(legR.hip),
    thigh_R: shift(legR.hip),
    knee_R: shift(legR.knee),
    shin_R: shift(legR.knee),
    ankle_R: shift(legR.ankle),
    foot_R: shift(legR.foot)
  };

  return {
    view,
    isFront,
    isBack,
    isLeft,
    isSide,
    faceSign,
    joints,
    angles: a,
    boneLengths: { torsoLen, upperArmLen, forearmLen, thighLen, shinLen, neckLen, headRadius },
    spec: RIG_JOINT_SPEC
  };
}

// ============================================================================
// 5. COLOR & DRAWING HELPERS
// ============================================================================

function shadeHex(hex, amt) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length < 7) return hex || '#888888';
  const n = parseInt(hex.slice(1, 7), 16);
  const r = clamp(((n >> 16) & 255) + Math.round(amt * 255), 0, 255);
  const g = clamp(((n >> 8) & 255) + Math.round(amt * 255), 0, 255);
  const b = clamp((n & 255) + Math.round(amt * 255), 0, 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function drawCapsuleBone(ctx, p1, p2, width, fillCol, inkCol, strokeW = 3.2) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Outer ink stroke
  ctx.strokeStyle = inkCol;
  ctx.lineWidth = width + strokeW * 2;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
  // Inner fill
  ctx.strokeStyle = fillCol;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(p1[0], p1[1]);
  ctx.lineTo(p2[0], p2[1]);
  ctx.stroke();
  ctx.restore();
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================================
// 6. INDEPENDENT-LAYER FACIAL EXPRESSION RENDERER (10+ REAL EXPRESSIONS)
// ============================================================================

/**
 * Renders facial features with independent Eyes, Pupils, Eyelids, Eyebrows, and Mouth.
 * Zero emojis, zero debug text.
 */
function drawIndependentFacialExpression(ctx, headRadius, profile, view, exprRaw, opts = {}) {
  if (view === 'back') return; // Back view never shows facial features!

  const expr = normalizeExpression(exprRaw);
  const s = headRadius / 36;
  const ink = opts.ink || '#1b1d24';
  const skin = profile.skinColor || '#ffe5d4';
  const eyeColor = profile.face?.eyeColor || '#1b1d24';
  const isFront = view === 'front';
  const isLeft = view === 'three_quarter_left' || view === 'side_left';
  const isSide = view === 'side_left' || view === 'side_right';
  const dirSign = isLeft ? -1 : 1;

  const blink = !!opts.blink;
  const talk = clamp(Number(opts.talk || 0), 0, 1);
  const look = Array.isArray(opts.look) ? opts.look : [0, 0];

  // Eye coordinates in local head space (unscaled 36px radius)
  const eyeY = 2;
  let eyeSpecs;
  if (isFront) {
    eyeSpecs = [
      { x: -13.5, rx: 5.4, ry: 7.0, side: -1 },
      { x: 13.5,  rx: 5.4, ry: 7.0, side: 1 }
    ];
  } else if (isSide) {
    eyeSpecs = [
      { x: 16 * dirSign, rx: 4.8, ry: 7.0, side: dirSign }
    ];
  } else {
    // 3/4 left or right: far eye slightly narrower for authentic perspective
    eyeSpecs = [
      { x: -5 * dirSign,  rx: 4.5, ry: 6.8, side: -dirSign },
      { x: 17.5 * dirSign, rx: 5.5, ry: 7.1, side: dirSign }
    ];
  }

  // Expression parameters for independent layers
  const cfg = {
    eyeOpen: 1.0,
    scleraVisible: false,
    pupilScale: 1.0,
    pupilOffset: [look[0] * 2.2, look[1] * 2.0],
    upperLid: 0.0,       // 0 = open, 0.5 = half-closed (tired), 1.0 = closed
    upperLidTilt: 0.0,   // + = angry inward slant, - = sad/worried outer droop
    lowerLid: 0.0,       // 0 = none, 0.4 = happy cheek push
    browY: 0.0,          // - = raised, + = lowered
    browTiltL: 0.0,      // inner-to-outer slope
    browTiltR: 0.0,
    browArch: 1.5,
    mouthType: 'smile',  // smile, neutral, frown, open_happy, o_surprised, wavy, flat_think, grimace, yawn_tired, excited_grin
    blushBoost: 0
  };

  switch (expr) {
    case 'happy':
      cfg.lowerLid = 0.42;
      cfg.browY = -2.2;
      cfg.browArch = 2.6;
      cfg.mouthType = 'open_happy';
      cfg.blushBoost = 0.2;
      break;
    case 'sad':
      cfg.upperLid = 0.25;
      cfg.upperLidTilt = -0.35;
      cfg.pupilOffset = [dirSign * 0.5, 1.5];
      cfg.browY = -1.0;
      cfg.browTiltL = -3.2;
      cfg.browTiltR = 3.2;
      cfg.mouthType = 'frown';
      break;
    case 'angry':
      cfg.upperLid = 0.32;
      cfg.upperLidTilt = 0.48;
      cfg.pupilScale = 0.85;
      cfg.browY = 3.0;
      cfg.browTiltL = 4.2;
      cfg.browTiltR = -4.2;
      cfg.browArch = 0.2;
      cfg.mouthType = 'grimace';
      break;
    case 'surprised':
      cfg.eyeOpen = 1.2;
      cfg.scleraVisible = true;
      cfg.pupilScale = 0.62;
      cfg.browY = -5.2;
      cfg.browArch = 3.2;
      cfg.mouthType = 'o_surprised';
      break;
    case 'thinking':
      cfg.upperLid = 0.18;
      cfg.pupilOffset = [dirSign * 2.4, -2.4];
      cfg.browY = -1.2;
      cfg.browTiltL = 1.5;
      cfg.browTiltR = -2.2;
      cfg.mouthType = 'flat_think';
      break;
    case 'confused':
      cfg.scleraVisible = true;
      cfg.pupilScale = 0.82;
      cfg.pupilOffset = [dirSign * 1.6, -1.0];
      cfg.browY = -2.0;
      cfg.browTiltL = 3.4;
      cfg.browTiltR = -3.8;
      cfg.mouthType = 'wavy';
      break;
    case 'scared':
      cfg.eyeOpen = 1.18;
      cfg.scleraVisible = true;
      cfg.pupilScale = 0.52;
      cfg.browY = -4.0;
      cfg.browTiltL = -3.6;
      cfg.browTiltR = 3.6;
      cfg.mouthType = 'wavy';
      break;
    case 'excited':
      cfg.eyeOpen = 1.12;
      cfg.pupilScale = 1.12;
      cfg.browY = -4.0;
      cfg.browArch = 3.2;
      cfg.mouthType = 'excited_grin';
      cfg.blushBoost = 0.35;
      break;
    case 'tired':
      cfg.upperLid = 0.54;
      cfg.lowerLid = 0.18;
      cfg.pupilOffset = [0, 1.2];
      cfg.browY = 1.2;
      cfg.browTiltL = -2.0;
      cfg.browTiltR = 2.0;
      cfg.mouthType = 'yawn_tired';
      break;
    default: // neutral
      cfg.mouthType = 'neutral';
      break;
  }

  ctx.save();
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Blush
  const showBlush = profile.face?.blush || cfg.blushBoost > 0;
  if (showBlush) {
    ctx.save();
    ctx.fillStyle = '#fca5a5';
    ctx.globalAlpha *= (0.35 + cfg.blushBoost);
    for (const es of eyeSpecs) {
      ctx.beginPath();
      ctx.ellipse(es.x, eyeY + 11.5, 5.8, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- LAYER A: EYES + SCLERA + PUPILS + EYELIDS ---
  for (let i = 0; i < eyeSpecs.length; i++) {
    const es = eyeSpecs[i];
    const ex = es.x;
    const rx = es.rx * (cfg.scleraVisible ? 1.15 : 1.0);
    const ry = es.ry * cfg.eyeOpen;

    if (blink) {
      // Closed eyelid arc
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.moveTo(ex - rx, eyeY + 1);
      ctx.quadraticCurveTo(ex, eyeY + 4.5, ex + rx, eyeY + 1);
      ctx.stroke();
      continue;
    }

    // 1. Sclera / Base eye shape
    if (cfg.scleraVisible) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 2. Independent Pupil
      const px = ex + clamp(cfg.pupilOffset[0], -rx * 0.45, rx * 0.45);
      const py = eyeY + clamp(cfg.pupilOffset[1], -ry * 0.45, ry * 0.45);
      const pr = 3.8 * cfg.pupilScale;
      ctx.fillStyle = eyeColor;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      // Catchlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px + pr * 0.35, py - pr * 0.35, Math.max(1.1, pr * 0.32), 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Clean cartoon dark oval eye with iris sheen & specular catchlight
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = eyeColor;
      ctx.fill();
      ctx.clip();

      // Subtle lower iris glow
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.ellipse(ex + cfg.pupilOffset[0] * 0.4, eyeY + ry * 0.45, rx * 0.65, ry * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight moving with pupil look
      const cx = ex + clamp(cfg.pupilOffset[0], -2.2, 2.2) + 1.6 * dirSign;
      const cy = eyeY + clamp(cfg.pupilOffset[1], -2.2, 2.2) - 2.3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, expr === 'excited' ? 2.6 : 2.1, 0, Math.PI * 2);
      ctx.fill();
      if (expr === 'excited' || profile.face?.eyeStyle === 'sparkle') {
        ctx.beginPath();
        ctx.arc(cx - 2.6 * dirSign, cy + 4.2, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Independent Upper Eyelid
    if (cfg.upperLid > 0.02) {
      const lidY = eyeY - ry + ry * 2 * cfg.upperLid;
      const tilt = cfg.upperLidTilt * 6 * (es.side < 0 ? 1 : -1);
      ctx.save();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.moveTo(ex - rx - 2, eyeY - ry - 3);
      ctx.lineTo(ex + rx + 2, eyeY - ry - 3);
      ctx.lineTo(ex + rx + 2, lidY + tilt);
      ctx.lineTo(ex - rx - 2, lidY - tilt);
      ctx.closePath();
      ctx.fill();

      // Upper eyelid crease line
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(ex - rx - 0.5, lidY - tilt);
      ctx.lineTo(ex + rx + 0.5, lidY + tilt);
      ctx.stroke();
      ctx.restore();
    }

    // 4. Independent Lower Eyelid (happy cheek push / tired under-eye)
    if (cfg.lowerLid > 0.02) {
      const botY = eyeY + ry - ry * 1.4 * cfg.lowerLid;
      ctx.save();
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.rect(ex - rx - 2, botY, rx * 2 + 4, ry + 3);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(ex - rx, botY + 1);
      ctx.quadraticCurveTo(ex, botY - (expr === 'happy' ? 3.2 : 0.5), ex + rx, botY + 1);
      ctx.stroke();
      ctx.restore();
    }
  }

  // --- LAYER B: INDEPENDENT EYEBROWS ---
  ctx.strokeStyle = profile.hair?.color ? shadeHex(profile.hair.color, -0.25) : ink;
  ctx.lineWidth = 2.7;
  for (let i = 0; i < eyeSpecs.length; i++) {
    const es = eyeSpecs[i];
    const ex = es.x;
    const isLeftEye = es.side < 0;
    const tilt = isLeftEye ? cfg.browTiltL : cfg.browTiltR;
    const by = eyeY - 10.5 + cfg.browY;
    const bw = isSide ? 5.2 : 6.2;
    ctx.beginPath();
    ctx.moveTo(ex - bw, by - tilt * 0.5);
    ctx.quadraticCurveTo(ex, by - cfg.browArch, ex + bw, by + tilt * 0.5);
    ctx.stroke();
  }

  // --- LAYER C: SUBTLE NOSE ---
  if (!isFront) {
    const nx = isSide ? 24 * dirSign : 9.5 * dirSign;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(nx, 5.5);
    ctx.quadraticCurveTo(nx + 2.2 * dirSign, 7.5, nx, 9.5);
    ctx.stroke();
  }

  // --- LAYER D: INDEPENDENT MOUTH ---
  const mx = isFront ? 0 : isSide ? 14 * dirSign : 6.5 * dirSign;
  const my = eyeY + 18.5;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.7;

  if (talk > 0.08) {
    const openH = 2.8 + talk * 6.5;
    ctx.fillStyle = '#3b1518';
    ctx.beginPath();
    ctx.ellipse(mx, my, 5.5, openH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f87171';
    ctx.beginPath();
    ctx.ellipse(mx, my + openH * 0.42, 3.6, openH * 0.42, 0, 0, Math.PI);
    ctx.fill();
  } else {
    switch (cfg.mouthType) {
      case 'open_happy':
      case 'excited_grin': {
        const w = cfg.mouthType === 'excited_grin' ? 8.2 : 6.8;
        const h = cfg.mouthType === 'excited_grin' ? 8.0 : 6.2;
        ctx.fillStyle = '#3b1518';
        ctx.beginPath();
        ctx.moveTo(mx - w, my - 2);
        ctx.lineTo(mx + w, my - 2);
        ctx.quadraticCurveTo(mx + w * 0.8, my + h, mx, my + h);
        ctx.quadraticCurveTo(mx - w * 0.8, my + h, mx - w, my - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Tongue
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.ellipse(mx, my + h * 0.65, w * 0.55, h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Upper teeth line
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - w * 0.72, my - 1.5, w * 1.44, 2.2);
        break;
      }
      case 'frown':
        ctx.beginPath();
        ctx.moveTo(mx - 5.5, my + 3);
        ctx.quadraticCurveTo(mx, my - 2.5, mx + 5.5, my + 3);
        ctx.stroke();
        break;
      case 'grimace':
        ctx.fillStyle = '#ffffff';
        drawRoundedRect(ctx, mx - 6.5, my - 2.5, 13, 5.5, 2.2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx - 6, my + 0.3);
        ctx.lineTo(mx + 6, my + 0.3);
        ctx.stroke();
        break;
      case 'o_surprised':
        ctx.fillStyle = '#3b1518';
        ctx.beginPath();
        ctx.ellipse(mx, my + 1, 4.2, 5.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'flat_think':
        ctx.beginPath();
        ctx.moveTo(mx - 4.8, my + 1);
        ctx.quadraticCurveTo(mx + 1 * dirSign, my - 0.5, mx + 5.2, my + 0.5);
        ctx.stroke();
        break;
      case 'wavy':
        ctx.beginPath();
        ctx.moveTo(mx - 6, my + 1);
        ctx.quadraticCurveTo(mx - 3, my - 2.2, mx, my + 1);
        ctx.quadraticCurveTo(mx + 3, my + 4.0, mx + 6, my + 0.5);
        ctx.stroke();
        break;
      case 'yawn_tired':
        ctx.fillStyle = '#3b1518';
        ctx.beginPath();
        ctx.ellipse(mx, my + 1.5, 4.5, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      default: // neutral / gentle smile
        ctx.beginPath();
        ctx.moveTo(mx - 5.2, my - 0.5);
        ctx.quadraticCurveTo(mx, my + 4.0, mx + 5.2, my - 0.5);
        ctx.stroke();
        break;
    }
  }

  ctx.restore();
}

// ============================================================================
// 7. UPGRADED 2D CARTOON BODY PART RENDERERS (MULTI-VIEW, CLEAN LINEWORK)
// ============================================================================

function drawUnifiedShoe(ctx, footPt, ankleAngle, outfit, ink, view, isNear) {
  const shoeType = outfit.shoeType || 'casual';
  const shoeColor = isNear ? (outfit.shoeColor || '#0f172a') : shadeHex(outfit.shoeColor || '#0f172a', -0.18);
  const isFront = view === 'front';
  const isBack = view === 'back';
  const isLeft = view === 'three_quarter_left' || view === 'side_left';
  const dirSign = isLeft ? -1 : 1;

  ctx.save();
  ctx.translate(footPt[0], footPt[1]);
  if (ankleAngle) ctx.rotate(ankleAngle);

  if (isFront || isBack) {
    const scaleX = isNear ? 1 : -1;
    ctx.scale(scaleX, 1);
    // Sole
    ctx.fillStyle = shoeType === 'sneakers' ? '#ffffff' : '#0f172a';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    drawRoundedRect(ctx, -6.5, -3, 15.5, 3.2, 1.5);
    ctx.fill();
    ctx.stroke();
    // Upper
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.moveTo(-6, -3);
    ctx.quadraticCurveTo(-6.5, -9, -2.5, -10.5);
    ctx.lineTo(4.5, -10.5);
    ctx.quadraticCurveTo(8.5, -7.5, 8.8, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (shoeType === 'sneakers' && isFront) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-1, -7.5); ctx.lineTo(3.5, -7.5); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-0.5, -5.2); ctx.lineTo(4.2, -5.2); ctx.stroke();
    }
  } else {
    // 3/4 or side profile: toe points in dirSign
    ctx.scale(dirSign * (isNear ? 1.0 : 0.94), isNear ? 1.0 : 0.94);
    // Sole flat at y = 0
    ctx.fillStyle = shoeType === 'sneakers' ? '#ffffff' : '#0f172a';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.lineTo(10.5, -3);
    ctx.quadraticCurveTo(12, -3, 12, -1.2);
    ctx.quadraticCurveTo(12, 0, 10, 0);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Upper
    ctx.fillStyle = shoeColor;
    ctx.beginPath();
    ctx.moveTo(-7, -3);
    ctx.quadraticCurveTo(-7.5, -7.5, -3.5, -10);
    ctx.lineTo(3.5, -10);
    ctx.quadraticCurveTo(8, -7, 11.2, -3.5);
    ctx.lineTo(11.2, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Collar rim
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(0, -10, 4.4, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (shoeType === 'sneakers') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(6.5, -3);
      ctx.quadraticCurveTo(7.5, -5.5, 11, -3.8);
      ctx.lineTo(11.2, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawUnifiedLeg(ctx, hipPt, kneePt, anklePt, footPt, profile, ink, view, isNear) {
  const outfit = profile.outfit || {};
  const isPants = outfit.bottomType !== 'skirt' && outfit.bottomType !== 'dress' && outfit.bottomType !== 'shorts';
  const baseCol = isPants ? (outfit.pantsColor || '#1f2937') : (profile.skinColor || '#ffe5d4');
  const col = isNear ? baseCol : shadeHex(baseCol, -0.15);

  // Thigh + Shin drawn as connected zero-gap capsule segments
  drawCapsuleBone(ctx, hipPt, kneePt, 12.5, col, ink, 2.8);
  drawCapsuleBone(ctx, kneePt, anklePt, 11.0, col, ink, 2.8);

  // Knee joint seamless fill cap
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(kneePt[0], kneePt[1], 5.8, 0, Math.PI * 2);
  ctx.fill();

  // Pant cuff seam at ankle
  if (isPants) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(anklePt[0] - 5.2, anklePt[1] - 1);
    ctx.lineTo(anklePt[0] + 5.2, anklePt[1] - 1);
    ctx.stroke();
  }

  // Shoe at foot
  const ankleAngle = footPt[1] < -2 ? -0.18 : 0;
  drawUnifiedShoe(ctx, footPt, ankleAngle, outfit, ink, view, isNear);
}

function drawUnifiedArm(ctx, shPt, elbowPt, wristPt, handPt, profile, ink, view, isNear, poseName = '') {
  const outfit = profile.outfit || {};
  const skin = isNear ? (profile.skinColor || '#ffe5d4') : shadeHex(profile.skinColor || '#ffe5d4', -0.1);
  const topCol = isNear ? (outfit.topColor || '#f3f4f6') : shadeHex(outfit.topColor || '#f3f4f6', -0.14);
  const isShortSleeve = outfit.type === 'tshirt' || outfit.type === 'dress';

  // Upper arm
  drawCapsuleBone(ctx, shPt, elbowPt, 11.5, topCol, ink, 2.8);
  // Forearm
  drawCapsuleBone(ctx, elbowPt, wristPt, 10.2, isShortSleeve ? skin : topCol, ink, 2.8);

  // Seamless elbow cap
  ctx.fillStyle = isShortSleeve ? topCol : topCol;
  ctx.beginPath();
  ctx.arc(elbowPt[0], elbowPt[1], 5.2, 0, Math.PI * 2);
  ctx.fill();

  // Cuff line for long sleeves
  if (!isShortSleeve) {
    const ang = Math.atan2(wristPt[1] - elbowPt[1], wristPt[0] - elbowPt[0]);
    const nx = -Math.sin(ang) * 5.0;
    const ny = Math.cos(ang) * 5.0;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(wristPt[0] - nx, wristPt[1] - ny);
    ctx.lineTo(wristPt[0] + nx, wristPt[1] + ny);
    ctx.stroke();
  }

  // Hand (clean cartoon mitten + thumb)
  ctx.save();
  ctx.translate(handPt[0], handPt[1]);
  ctx.fillStyle = skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Thumb nub
  const dirSign = (view === 'three_quarter_left' || view === 'side_left') ? -1 : 1;
  ctx.beginPath();
  ctx.arc(4.2 * dirSign, -2.2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pointing index finger when pointing/eureka
  if (isNear && (poseName.includes('point') || poseName.includes('eureka'))) {
    const fx = poseName.includes('eureka') ? 1.5 * dirSign : 9.5 * dirSign;
    const fy = poseName.includes('eureka') ? -9.5 : -1.5;
    drawCapsuleBone(ctx, [2 * dirSign, -1], [fx, fy], 3.2, skin, ink, 1.8);
  }
  ctx.restore();
}

function drawUnifiedPelvisAndTorso(ctx, rig, profile, ink) {
  const { joints, view, isFront, isBack, isSide, faceSign } = rig;
  const outfit = profile.outfit || {};
  const topType = outfit.type || 'hoodie';
  const topCol = outfit.topColor || '#f3f4f6';
  const topCol2 = outfit.topColor2 || shadeHex(topCol, -0.15);
  const pantsCol = outfit.pantsColor || '#1f2937';
  const [hx, hy] = joints.hip;
  const [sx, sy] = joints.torso;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Pelvis / Waistband / Skirt over upper legs (eliminates any leg-to-hip gap)
  ctx.fillStyle = pantsCol;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.2;
  const hipHalfW = isFront || isBack ? 19 : isSide ? 12 : 16.5;

  if (outfit.bottomType === 'skirt' || outfit.bottomType === 'dress') {
    ctx.beginPath();
    ctx.moveTo(hx - hipHalfW, hy - 2);
    ctx.lineTo(hx + hipHalfW, hy - 2);
    ctx.lineTo(hx + hipHalfW + 6, hy + 20);
    ctx.quadraticCurveTo(hx, hy + 24, hx - hipHalfW - 6, hy + 20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(hx - hipHalfW, hy - 5);
    ctx.lineTo(hx + hipHalfW, hy - 5);
    ctx.lineTo(hx + hipHalfW + 1, hy + 7);
    ctx.quadraticCurveTo(hx, hy + 10, hx - hipHalfW - 1, hy + 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 2. Neck connecting torso to head seamlessly
  const neckW = isFront || isBack ? 7.5 : 6.8;
  ctx.fillStyle = profile.skinColor || '#ffe5d4';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(joints.neck[0] - neckW, joints.neck[1] - 6);
  ctx.lineTo(joints.neck[0] + neckW, joints.neck[1] - 6);
  ctx.lineTo(sx + neckW + 2, sy + 4);
  ctx.lineTo(sx - neckW - 2, sy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Chin cast shadow on neck
  ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
  ctx.beginPath();
  ctx.ellipse(joints.neck[0], joints.neck[1] - 2, neckW, 2.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Torso Garment
  const shHalfW = isFront || isBack ? 22 : isSide ? 13 : 19;
  const botHalfW = isFront || isBack ? 19.5 : isSide ? 12.5 : 17.5;
  const coatExtend = topType === 'labcoat' ? 13 : 2;
  const botY = hy + coatExtend;

  ctx.fillStyle = topCol;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(sx - shHalfW, sy + 1);
  ctx.quadraticCurveTo(sx, sy - 6, sx + shHalfW, sy + 1);
  ctx.lineTo(hx + botHalfW + (topType === 'labcoat' ? 2 : 0), botY);
  ctx.quadraticCurveTo(hx, botY + 3.5, hx - botHalfW - (topType === 'labcoat' ? 2 : 0), botY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Collar neckline
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.moveTo(sx - 10, sy);
  ctx.quadraticCurveTo(sx, sy + (isBack ? 2 : 6.5), sx + 10, sy);
  ctx.stroke();

  // Outfit-specific details (view-aware!)
  if (isBack) {
    if (topType === 'labcoat') {
      // Back center seam & belt tab
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(sx, sy + 4); ctx.lineTo(hx, botY - 2); ctx.stroke();
      ctx.fillStyle = topCol2;
      drawRoundedRect(ctx, hx - 10, hy - 8, 20, 5, 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.0;
      ctx.stroke();
    } else if (topType === 'hoodie') {
      // Hood resting on back of shoulders
      ctx.fillStyle = topCol2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.0;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 5, 16, 10, 0, 0, Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    if (outfit.accessories?.includes('backpack')) {
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.0;
      drawRoundedRect(ctx, sx - 16, sy + 6, 32, 34, 7);
      ctx.fill();
      ctx.stroke();
    }
  } else {
    const centerShift = isFront ? 0 : isSide ? 8 * faceSign : 3 * faceSign;
    if (topType === 'labcoat') {
      // Inner shirt & red tie
      if (!isSide) {
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(sx + centerShift - 7, sy + 2);
        ctx.lineTo(sx + centerShift + 7, sy + 2);
        ctx.lineTo(sx + centerShift, sy + 18);
        ctx.closePath();
        ctx.fill();
        // Red tie
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.moveTo(sx + centerShift - 2.2, sy + 5);
        ctx.lineTo(sx + centerShift + 2.2, sy + 5);
        ctx.lineTo(sx + centerShift + 3.2, sy + 19);
        ctx.lineTo(sx + centerShift, sy + 23);
        ctx.lineTo(sx + centerShift - 3.2, sy + 19);
        ctx.closePath();
        ctx.fill();
        // Labcoat lapels
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(sx + centerShift - 9, sy + 3);
        ctx.lineTo(sx + centerShift, sy + 16);
        ctx.lineTo(sx + centerShift - 2, sy + 3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + centerShift + 9, sy + 3);
        ctx.lineTo(sx + centerShift, sy + 16);
        ctx.lineTo(sx + centerShift + 2, sy + 3);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
      // Center seam
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sx + centerShift, sy + 16);
      ctx.lineTo(hx + centerShift, botY);
      ctx.stroke();
      // Left breast pocket + blue pen (always on character's left chest, not flipped)
      const pocketX = isFront ? sx - 14 : (isSide ? sx + 2 * faceSign : sx - 12 * faceSign);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.8;
      drawRoundedRect(ctx, pocketX, sy + 16, 8, 9.5, 1.5);
      ctx.fill();
      ctx.stroke();
      // Pen clip
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pocketX + 4, sy + 12.5);
      ctx.lineTo(pocketX + 4, sy + 18.5);
      ctx.stroke();
    } else if (topType === 'hoodie') {
      // Kangaroo pocket
      ctx.fillStyle = topCol2;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(hx + centerShift - 11, hy - 13);
      ctx.lineTo(hx + centerShift + 11, hy - 13);
      ctx.lineTo(hx + centerShift + 13, hy - 2);
      ctx.lineTo(hx + centerShift - 13, hy - 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Drawstrings
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(sx + centerShift - 4, sy + 4); ctx.lineTo(sx + centerShift - 4, sy + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sx + centerShift + 4, sy + 4); ctx.lineTo(sx + centerShift + 4, sy + 16); ctx.stroke();
    } else if (topType === 'suit') {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(sx + centerShift - 2.5, sy + 5);
      ctx.lineTo(sx + centerShift + 2.5, sy + 5);
      ctx.lineTo(sx + centerShift + 3.5, sy + 22);
      ctx.lineTo(sx + centerShift, sy + 26);
      ctx.lineTo(sx + centerShift - 3.5, sy + 22);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawUnifiedHead(ctx, rig, profile, expr, opts = {}) {
  const { joints, view, isFront, isBack, isLeft, isSide, faceSign } = rig;
  const HR = joints.headRadius;
  const s = HR / 36;
  const ink = opts.ink || '#1b1d24';
  const skin = profile.skinColor || '#ffe5d4';
  const hairStyle = profile.hair?.style || 'short';
  const hairCol = profile.hair?.color || '#4a3728';
  const hairHi = profile.hair?.highlight || shadeHex(hairCol, 0.25);
  const outfit = profile.outfit || {};

  ctx.save();
  ctx.translate(joints.head[0], joints.head[1]);
  ctx.rotate(joints.headRotation || 0);

  // 1. Back hair (behind skull)
  ctx.save();
  ctx.scale(s, s);
  if (hairStyle === 'bun') {
    const bx = isFront ? 0 : isBack ? 0 : -24 * faceSign;
    ctx.fillStyle = hairCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.arc(bx, -26, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (hairStyle === 'twintails') {
    ctx.fillStyle = hairCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.ellipse(-34, 10, 14, 24, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(34, 10, 14, 24, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (hairStyle === 'ponytail') {
    ctx.strokeStyle = hairCol;
    ctx.lineWidth = 16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-16 * faceSign, -12);
    ctx.quadraticCurveTo(-46 * faceSign, -8, -40 * faceSign, 24);
    ctx.stroke();
  }

  // 2. Ears (behind/side of skull)
  ctx.fillStyle = skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.2;
  if (isFront || isBack) {
    ctx.beginPath(); ctx.ellipse(-36, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(36, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (isSide) {
    ctx.beginPath(); ctx.ellipse(-18 * faceSign, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.ellipse(-33 * faceSign, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // 3. Anatomical Chibi Skull Contour (view-specific, tapered chin, soft cheeks)
  ctx.fillStyle = isBack ? hairCol : skin;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  if (isFront || isBack) {
    ctx.moveTo(0, -36);
    ctx.bezierCurveTo(23, -36, 37, -22, 37, -4);
    ctx.bezierCurveTo(37, 12, 37, 19, 30, 29);
    ctx.bezierCurveTo(23, 37, 10, 38, 0, 38);
    ctx.bezierCurveTo(-10, 38, -23, 37, -30, 29);
    ctx.bezierCurveTo(-37, 19, -37, 12, -37, -4);
    ctx.bezierCurveTo(-37, -22, -23, -36, 0, -36);
  } else if (isSide) {
    const f = faceSign;
    ctx.moveTo(2 * f, -36);
    ctx.bezierCurveTo(22 * f, -36, 34 * f, -22, 34 * f, -8);
    ctx.bezierCurveTo(34 * f, -2, 37 * f, 2, 36 * f, 5);
    ctx.bezierCurveTo(34 * f, 12, 33 * f, 18, 27 * f, 28);
    ctx.bezierCurveTo(21 * f, 36, 8 * f, 38, -2 * f, 36);
    ctx.bezierCurveTo(-18 * f, 33, -32 * f, 18, -32 * f, -4);
    ctx.bezierCurveTo(-32 * f, -22, -18 * f, -36, 2 * f, -36);
  } else {
    // 3/4 left or right
    const f = faceSign;
    ctx.moveTo(-2 * f, -36);
    ctx.bezierCurveTo(21 * f, -36, 35 * f, -22, 36 * f, -6);
    ctx.bezierCurveTo(37 * f, 10, 37 * f, 18, 32 * f, 28);
    ctx.bezierCurveTo(25 * f, 37, 13 * f, 38, 3 * f, 38);
    ctx.bezierCurveTo(-9 * f, 38, -22 * f, 35, -30 * f, 26);
    ctx.bezierCurveTo(-36 * f, 16, -35 * f, 8, -34 * f, -4);
    ctx.bezierCurveTo(-34 * f, -22, -21 * f, -36, -2 * f, -36);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Facial Expression (drawn on front/3Q/side, skipped on back)
  drawIndependentFacialExpression(ctx, HR, profile, view, expr, opts);

  // 5. Front Hair (or Back Hair highlight for back view)
  ctx.save();
  ctx.scale(s, s);
  ctx.fillStyle = hairCol;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (isBack) {
    // Back hair nape curve & highlight
    ctx.strokeStyle = hairHi;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-20, -24);
    ctx.quadraticCurveTo(0, -30, 20, -24);
    ctx.stroke();
  } else {
    const f = (isFront ? 1 : faceSign);
    if (hairStyle === 'side_part') {
      // Doc's signature neat side-part hair (keeps parting consistent in left/right views)
      ctx.beginPath();
      ctx.moveTo(-37 * f, -2);
      ctx.bezierCurveTo(-38 * f, -25, -24 * f, -41, 0, -41);
      ctx.bezierCurveTo(25 * f, -41, 38 * f, -25, 37 * f, -3);
      ctx.bezierCurveTo(36 * f, 7, 34 * f, 14, 31 * f, 15);
      ctx.bezierCurveTo(30 * f, 9, 28 * f, 1, 25 * f, -4);
      ctx.lineTo(18 * f, -2);
      ctx.lineTo(8 * f, -8);
      ctx.lineTo(-4 * f, -10);
      ctx.lineTo(-14 * f, -4);
      ctx.lineTo(-22 * f, -2);
      ctx.lineTo(-27 * f, -5);
      ctx.bezierCurveTo(-31 * f, 1, -32 * f, 9, -34 * f, 15);
      ctx.bezierCurveTo(-36 * f, 10, -37 * f, 3, -37 * f, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Subtle part line & highlight arc
      ctx.strokeStyle = hairHi;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-18 * f, -31);
      ctx.quadraticCurveTo(0, -36, 18 * f, -31);
      ctx.stroke();
    } else if (hairStyle === 'spiky') {
      ctx.beginPath();
      ctx.moveTo(-38 * f, -2);
      ctx.bezierCurveTo(-39 * f, -26, -24 * f, -42, 0, -42);
      ctx.bezierCurveTo(24 * f, -42, 39 * f, -26, 38 * f, -2);
      ctx.lineTo(33 * f, 15);
      ctx.lineTo(28 * f, -2);
      ctx.lineTo(20 * f, -8);
      ctx.lineTo(12 * f, 3);
      ctx.lineTo(3 * f, -9);
      ctx.lineTo(-6 * f, 3);
      ctx.lineTo(-15 * f, -9);
      ctx.lineTo(-24 * f, -2);
      ctx.lineTo(-33 * f, 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Short / classic bangs
      ctx.beginPath();
      ctx.moveTo(-37 * f, -2);
      ctx.bezierCurveTo(-38 * f, -25, -24 * f, -40, 0, -40);
      ctx.bezierCurveTo(24 * f, -40, 38 * f, -25, 37 * f, -2);
      ctx.bezierCurveTo(36 * f, 7, 34 * f, 14, 32 * f, 15);
      ctx.lineTo(26 * f, -3);
      ctx.lineTo(16 * f, -9);
      ctx.lineTo(8 * f, 1);
      ctx.lineTo(0, -7);
      ctx.lineTo(-8 * f, 1);
      ctx.lineTo(-16 * f, -8);
      ctx.lineTo(-26 * f, -3);
      ctx.lineTo(-32 * f, 15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = hairHi;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-20 * f, -31);
      ctx.quadraticCurveTo(0, -35, 20 * f, -31);
      ctx.stroke();
    }
  }

  // 6. Accessories: Glasses (Doc) & Sunglasses
  if (!isBack && outfit.accessories?.includes('glasses')) {
    const eyeY = 2;
    const gx = isFront ? [-13.5, 13.5] : isSide ? [16 * faceSign] : [-5 * faceSign, 17.5 * faceSign];
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.6;
    for (const x of gx) {
      // Subtle lens tint
      ctx.fillStyle = 'rgba(224, 242, 254, 0.22)';
      ctx.beginPath();
      ctx.arc(x, eyeY, 9.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Tiny lens glint
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, eyeY, 6.2, -2.4, -1.7);
      ctx.stroke();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.6;
    }
    if (gx.length === 2) {
      const x1 = Math.min(gx[0], gx[1]) + 9.2;
      const x2 = Math.max(gx[0], gx[1]) - 9.2;
      ctx.beginPath();
      ctx.moveTo(x1, eyeY);
      ctx.lineTo(x2, eyeY);
      ctx.stroke();
    }
    // Temple arm to ear
    if (!isFront) {
      const outerX = isSide ? 16 * faceSign - 9.2 * faceSign : -5 * faceSign - 9.2 * faceSign;
      const earX = isSide ? -18 * faceSign : -33 * faceSign;
      ctx.beginPath();
      ctx.moveTo(outerX, eyeY);
      ctx.lineTo(earX, eyeY);
      ctx.stroke();
    }
  }

  // 7. Headwear (Cap, Headband, Beanie)
  const headwear = outfit.headwear || 'none';
  if (headwear === 'cap' || headwear === 'capBack') {
    const capCol = outfit.headwearColor || '#f2c21a';
    const visorDir = (headwear === 'capBack' ? -1 : 1) * faceSign;
    ctx.fillStyle = capCol;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.ellipse(0, -14, 37, 26, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (!isFront && !isBack) {
      ctx.beginPath();
      ctx.moveTo(visorDir * 10, -14);
      ctx.quadraticCurveTo(visorDir * 52, -13, visorDir * 50, -6);
      ctx.lineTo(visorDir * 10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  } else if (headwear === 'headband') {
    ctx.strokeStyle = outfit.headwearColor || '#f472b6';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.arc(0, -2, 37, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  ctx.restore();
  ctx.restore();
}

// ============================================================================
// 8. MODE B SINGLE PNG RENDERER (NO FAKE SKELETAL LIMB MOTION)
// ============================================================================

const singlePngCache = new Map();
function getCachedSinglePng(src) {
  if (!src) return null;
  if (singlePngCache.has(src)) return singlePngCache.get(src);
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    singlePngCache.set(src, img);
    return img;
  }
  return null;
}

function drawSinglePngCharacter(ctx, profile, opts = {}) {
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const s = (opts.s ?? 1) * (profile.proportions?.scale || 1.0);
  const t = Number(opts.t || 0);
  const view = normalizeViewDirection(opts.view || opts.facing || profile.defaultFacing, typeof opts.facing === 'number' ? opts.facing : 1);
  const flipX = (view === 'three_quarter_left' || view === 'side_left') ? -1 : 1;

  // Locate single PNG source
  const firstPart = profile.parts ? Object.values(profile.parts)[0] : null;
  const src = profile.sourceImage || profile.thumbnail || firstPart?.image || firstPart?.imagePath || firstPart?.dataUrl;
  const img = getCachedSinglePng(src);

  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;

  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 36 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Whole-body breathing bob ONLY — NEVER fake bone/limb movement on a single PNG!
  const breathScaleY = 1 + Math.sin(t * 2.5) * 0.012;
  ctx.translate(x, y);
  ctx.scale(flipX * s, s * breathScaleY);

  if (img && img.complete && img.naturalWidth > 0) {
    const targetH = 175;
    const aspect = img.naturalWidth / img.naturalHeight;
    const drawW = targetH * aspect;
    ctx.drawImage(img, -drawW / 2, -targetH, drawW, targetH);
  }
  ctx.restore();

  return {
    rendered: true,
    renderMode: CHARACTER_RENDER_MODES.SINGLE_PNG,
    skeletalMotionSimulated: false,
    characterId: profile.id
  };
}

// ============================================================================
// 9. MAIN UNIFIED CHARACTER RENDER ENTRYPOINT
// ============================================================================

/**
 * Draws any character (Mode A Procedural Rig, Mode B Layered PNG Rig, or Mode B Single PNG)
 * identically across Tab 3, Tab 2, Tab 4, Animation Preview, and Final MP4 Renderer.
 *
 * Clean Render by default: debug = false (draws ZERO debug text, IDs, boxes, or markers).
 */
export function drawUnifiedCharacter(ctx, options = {}) {
  const res = resolveCharacter(options.character || options.profile || options.characterId || options, {
    strict: options.strict === true
  });

  if (!res.resolved || !res.profile) {
    // Never silently draw a wrong character!
    if (options.strict) throw new Error(res.error);
    return { rendered: false, isFallback: true, error: res.error };
  }

  const profile = res.profile;
  const renderMode = profile.renderMode || detectCharacterRenderMode(profile);

  // Mode B — Single PNG (no fake skeletal deformation)
  if (renderMode === CHARACTER_RENDER_MODES.SINGLE_PNG) {
    return drawSinglePngCharacter(ctx, profile, options);
  }

  // Mode B — Layered PNG Rig
  if (renderMode === CHARACTER_RENDER_MODES.LAYERED_PNG_RIG) {
    drawImportedFigure(ctx, {
      ...options,
      character: profile,
      outfit: profile,
      facing: (options.view === 'three_quarter_left' || options.view === 'side_left') ? -1 : (options.facing ?? 1)
    });
    return { rendered: true, renderMode, characterId: profile.id, isFallback: false };
  }

  // Mode A — Unified Procedural 15-Joint Cartoon Rig
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const scale = options.s ?? options.scale ?? 1.0;
  const ink = options.ink || '#1b1d24';
  const expr = normalizeExpression(options.expr || options.expression || profile.defaultExpression || 'neutral');
  const rig = solveCharacterRig(profile, options);
  const { joints, view, isFront, isBack, isLeft } = rig;

  ctx.save();
  if (options.alpha != null) ctx.globalAlpha *= options.alpha;

  // Ground contact shadow
  if (options.shadow !== false) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, (isFront || isBack ? 36 : 32) * scale, 7.5 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const poseName = typeof options.pose === 'string' ? options.pose.toLowerCase() : String(options.action || '');

  // Determine far vs near limbs based on view direction
  const farSide = isLeft ? 'R' : 'L';
  const nearSide = isLeft ? 'L' : 'R';

  const drawLimbLeg = (side, isNear) => {
    if (side === 'L') drawUnifiedLeg(ctx, joints.hip_L, joints.knee_L, joints.ankle_L, joints.foot_L, profile, ink, view, isNear);
    else drawUnifiedLeg(ctx, joints.hip_R, joints.knee_R, joints.ankle_R, joints.foot_R, profile, ink, view, isNear);
  };

  const drawLimbArm = (side, isNear) => {
    if (side === 'L') drawUnifiedArm(ctx, joints.shoulder_L, joints.elbow_L, joints.wrist_L, joints.hand_L, profile, ink, view, isNear, poseName);
    else drawUnifiedArm(ctx, joints.shoulder_R, joints.elbow_R, joints.wrist_R, joints.hand_R, profile, ink, view, isNear, poseName);
  };

  // Correct anatomical layer order per view direction
  if (isBack) {
    // Back view: arms -> legs -> torso (covers shoulder/hip attachments cleanly) -> head
    drawLimbArm('L', true);
    drawLimbArm('R', true);
    drawLimbLeg('L', true);
    drawLimbLeg('R', true);
    drawUnifiedPelvisAndTorso(ctx, rig, profile, ink);
    drawUnifiedHead(ctx, rig, profile, expr, { ...options, ink });
  } else {
    // Front / 3Q / Side view:
    // 1. Far arm & far leg
    drawLimbArm(farSide, false);
    drawLimbLeg(farSide, false);
    // 2. Near leg
    drawLimbLeg(nearSide, true);
    // 3. Pelvis, Neck, Torso & Outfit (cleanly overlaps leg & far-arm roots)
    drawUnifiedPelvisAndTorso(ctx, rig, profile, ink);
    // 4. Head, Hair, Independent Facial Expression & Accessories
    drawUnifiedHead(ctx, rig, profile, expr, { ...options, ink });
    // 5. Near arm (on top for natural gesturing, pointing, thinking, eureka)
    drawLimbArm(nearSide, true);
  }

  // OPTIONAL Editor/Debug Overlay ONLY when explicitly requested (NEVER in production MP4!)
  if (options.debug === true) {
    ctx.save();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    const bonePairs = [
      ['hip', 'torso'], ['torso', 'neck'], ['neck', 'head'],
      ['torso', 'shoulder_L'], ['shoulder_L', 'elbow_L'], ['elbow_L', 'wrist_L'], ['wrist_L', 'hand_L'],
      ['torso', 'shoulder_R'], ['shoulder_R', 'elbow_R'], ['elbow_R', 'wrist_R'], ['wrist_R', 'hand_R'],
      ['hip', 'hip_L'], ['hip_L', 'knee_L'], ['knee_L', 'ankle_L'], ['ankle_L', 'foot_L'],
      ['hip', 'hip_R'], ['hip_R', 'knee_R'], ['knee_R', 'ankle_R'], ['ankle_R', 'foot_R']
    ];
    for (const [a, b] of bonePairs) {
      const pa = joints[a], pb = joints[b];
      if (!pa || !pb) continue;
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
    }
    ctx.fillStyle = '#facc15';
    for (const [k, pt] of Object.entries(joints)) {
      if (Array.isArray(pt) && pt.length === 2) {
        ctx.beginPath(); ctx.arc(pt[0], pt[1], 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  ctx.restore();

  return {
    rendered: true,
    renderMode: CHARACTER_RENDER_MODES.PROCEDURAL_RIG,
    characterId: profile.id,
    view,
    expression: expr,
    isFallback: false,
    rig
  };
}

// Expose globally when loaded in browser UI
if (typeof window !== 'undefined') {
  window.UnifiedCharacterRenderer = {
    drawUnifiedCharacter,
    solveCharacterRig,
    resolveCharacter,
    registerCharacterProfile,
    registerCharacterProfiles,
    getRegisteredCharacter,
    normalizeCharacterProfile,
    normalizeExpression,
    normalizeViewDirection,
    getViewSupportInfo,
    detectCharacterRenderMode,
    verifyCharacterContinuity,
    CANONICAL_CHARACTERS,
    CHARACTER_ID_ALIASES,
    RIG_JOINT_SPEC,
    REQUIRED_15_JOINTS,
    SUPPORTED_VIEWS,
    REQUIRED_EXPRESSIONS,
    CHARACTER_RENDER_MODES
  };
}

