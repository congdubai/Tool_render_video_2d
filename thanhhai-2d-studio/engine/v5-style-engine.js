// engine/v5-style-engine.js — Visual Style Engine, Lighting Engine & Perspective System (V5.2 Phase 2)
// Pure JS (Node + Browser compatible).
// Provides 8 unified Visual Styles, 8 Lighting Modes, Perspective & Depth calculations, and Contact Shadows.

// ============================================================================
// 1. VISUAL STYLE ENGINE (8 CORE STYLES + ALIASES)
// ============================================================================

export const STYLE_PROFILES = {
  clean_cartoon: {
    id: 'clean_cartoon',
    name: 'Clean Cartoon 2D',
    outlineColor: '#1b1d24',
    outlineWidth: 4,
    cornerRadius: 10,
    shading: 'cel_2tone',
    shadingIntensity: 0.25,
    shadowIntensity: 0.28,
    highlightIntensity: 0.35,
    detailLevel: 'medium',
    perspectiveRules: { mode: 'one_point', horizonRatio: 0.54, atmosphericHaze: 0.12 },
    objectProportions: { chunkyFactor: 1.0, bevelScale: 1.0 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#2563eb',
      secondary: '#f8fafc',
      accent: '#f59e0b',
      floor: '#475569',
      wall: '#e2e8f0',
      metal: '#94a3b8',
      wood: '#b45309',
      screenGlow: '#38bdf8',
      highlight: '#ffffff'
    }
  },
  educational_cartoon: {
    id: 'educational_cartoon',
    name: 'Educational Cartoon',
    outlineColor: '#1e293b',
    outlineWidth: 4,
    cornerRadius: 8,
    shading: 'cel_2tone',
    shadingIntensity: 0.22,
    shadowIntensity: 0.24,
    highlightIntensity: 0.3,
    detailLevel: 'medium',
    perspectiveRules: { mode: 'one_point', horizonRatio: 0.56, atmosphericHaze: 0.1 },
    objectProportions: { chunkyFactor: 1.02, bevelScale: 1.0 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#0284c7',
      secondary: '#ffffff',
      accent: '#10b981',
      floor: '#cbd5e1',
      wall: '#f1f5f9',
      metal: '#94a3b8',
      wood: '#92400e',
      screenGlow: '#0ea5e9',
      highlight: '#ffffff'
    }
  },
  flat_vector: {
    id: 'flat_vector',
    name: 'Flat Vector',
    outlineColor: '#0f172a',
    outlineWidth: 3,
    cornerRadius: 6,
    shading: 'flat',
    shadingIntensity: 0.1,
    shadowIntensity: 0.16,
    highlightIntensity: 0.18,
    detailLevel: 'medium',
    perspectiveRules: { mode: 'three_quarter', horizonRatio: 0.55, atmosphericHaze: 0.08 },
    objectProportions: { chunkyFactor: 0.96, bevelScale: 0.85 },
    lightingRules: { rimLight: false, softShadow: true },
    palette: {
      primary: '#3b82f6',
      secondary: '#f8fafc',
      accent: '#f97316',
      floor: '#334155',
      wall: '#1e293b',
      metal: '#64748b',
      wood: '#92400e',
      screenGlow: '#38bdf8',
      highlight: '#ffffff'
    }
  },
  chibi_cartoon: {
    id: 'chibi_cartoon',
    name: 'Chibi Cartoon',
    outlineColor: '#27272a',
    outlineWidth: 5,
    cornerRadius: 16,
    shading: 'soft_cel',
    shadingIntensity: 0.2,
    shadowIntensity: 0.22,
    highlightIntensity: 0.4,
    detailLevel: 'medium',
    perspectiveRules: { mode: 'one_point', horizonRatio: 0.58, atmosphericHaze: 0.12 },
    objectProportions: { chunkyFactor: 1.15, bevelScale: 1.3 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#f472b6',
      secondary: '#fff7ed',
      accent: '#facc15',
      floor: '#cbd5e1',
      wall: '#e0f2fe',
      metal: '#cbd5e1',
      wood: '#d97706',
      screenGlow: '#38bdf8',
      highlight: '#ffffff'
    }
  },
  minimal_white_cartoon: {
    id: 'minimal_white_cartoon',
    name: 'Minimal White Cartoon',
    outlineColor: '#20202a',
    outlineWidth: 4.5,
    cornerRadius: 10,
    shading: 'minimal_cel',
    shadingIntensity: 0.15,
    shadowIntensity: 0.25,
    highlightIntensity: 0.25,
    detailLevel: 'low',
    perspectiveRules: { mode: 'front', horizonRatio: 0.56, atmosphericHaze: 0.05 },
    objectProportions: { chunkyFactor: 1.05, bevelScale: 1.1 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#38bdf8',
      secondary: '#f8fafc',
      accent: '#facc15',
      floor: '#334155',
      wall: '#1e293b',
      metal: '#94a3b8',
      wood: '#b45309',
      screenGlow: '#0ea5e9',
      highlight: '#ffffff'
    }
  },
  historical_cartoon: {
    id: 'historical_cartoon',
    name: 'Historical Cartoon (1940–1980)',
    outlineColor: '#292524',
    outlineWidth: 4.5,
    cornerRadius: 6,
    shading: 'sepia_warm',
    shadingIntensity: 0.32,
    shadowIntensity: 0.35,
    highlightIntensity: 0.28,
    detailLevel: 'high',
    perspectiveRules: { mode: 'one_point', horizonRatio: 0.54, atmosphericHaze: 0.16 },
    objectProportions: { chunkyFactor: 1.04, bevelScale: 0.9 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#d97706',
      secondary: '#fef3c7',
      accent: '#b45309',
      floor: '#57534e',
      wall: '#78716c',
      metal: '#44403c',
      wood: '#78350f',
      screenGlow: '#22c55e',
      highlight: '#fef08a'
    }
  },
  soft_pastel: {
    id: 'soft_pastel',
    name: 'Soft Pastel',
    outlineColor: '#475569',
    outlineWidth: 3,
    cornerRadius: 14,
    shading: 'pastel_gradient',
    shadingIntensity: 0.18,
    shadowIntensity: 0.15,
    highlightIntensity: 0.35,
    detailLevel: 'medium',
    perspectiveRules: { mode: 'three_quarter', horizonRatio: 0.56, atmosphericHaze: 0.18 },
    objectProportions: { chunkyFactor: 1.08, bevelScale: 1.2 },
    lightingRules: { rimLight: true, softShadow: true },
    palette: {
      primary: '#818cf8',
      secondary: '#fdf4ff',
      accent: '#fb7185',
      floor: '#e2e8f0',
      wall: '#f5f3ff',
      metal: '#cbd5e1',
      wood: '#d97706',
      screenGlow: '#67e8f9',
      highlight: '#ffffff'
    }
  },
  comic_illustration: {
    id: 'comic_illustration',
    name: 'Comic Illustration',
    outlineColor: '#09090b',
    outlineWidth: 5.5,
    cornerRadius: 5,
    shading: 'bold_ink_shadow',
    shadingIntensity: 0.42,
    shadowIntensity: 0.45,
    highlightIntensity: 0.45,
    detailLevel: 'high',
    perspectiveRules: { mode: 'two_point', horizonRatio: 0.52, atmosphericHaze: 0.1 },
    objectProportions: { chunkyFactor: 1.0, bevelScale: 0.8 },
    lightingRules: { rimLight: true, softShadow: false },
    palette: {
      primary: '#ef4444',
      secondary: '#fef9c3',
      accent: '#eab308',
      floor: '#27272a',
      wall: '#3f3f46',
      metal: '#71717a',
      wood: '#9a3412',
      screenGlow: '#22d3ee',
      highlight: '#ffffff'
    }
  }
};

// Backward compatibility aliases
STYLE_PROFILES.white_cartoon = STYLE_PROFILES.minimal_white_cartoon;
STYLE_PROFILES.minimal_educational = STYLE_PROFILES.educational_cartoon;
STYLE_PROFILES.doodle = STYLE_PROFILES.comic_illustration;

export function getStyleTheme(profileId = 'educational_cartoon') {
  const norm = String(profileId || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return STYLE_PROFILES[norm] || STYLE_PROFILES.educational_cartoon;
}

// ============================================================================
// 2. LIGHTING ENGINE (8 REAL LIGHTING MODES)
// ============================================================================

export const LIGHTING_PRESETS = {
  morning: {
    id: 'morning',
    label: 'Buổi Sáng (Morning)',
    skyTop: '#38bdf8',
    skyMid: '#bae6fd',
    skyBottom: '#fef9c3',
    hasSun: true,
    sunColor: '#fde047',
    sunYRatio: 0.22,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#fef3c7',
    ambientOpacity: 0.08,
    wallTint: '#e0f2fe',
    floorTint: '#94a3b8',
    shadowColor: 'rgba(15, 23, 42, 0.22)',
    shadowAngle: 0.35,
    shadowLength: 1.15,
    windowGlow: 0.35,
    windowColor: '#fef9c3',
    streetLightOn: false,
    streetLightColor: '#fef08a',
    highlightColor: '#fef9c3',
    characterTint: null
  },
  daylight: {
    id: 'daylight',
    label: 'Ban Ngày (Daylight)',
    skyTop: '#0284c7',
    skyMid: '#7dd3fc',
    skyBottom: '#e0f2fe',
    hasSun: true,
    sunColor: '#fde047',
    sunYRatio: 0.14,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#ffffff',
    ambientOpacity: 0.0,
    wallTint: null,
    floorTint: null,
    shadowColor: 'rgba(15, 23, 42, 0.24)',
    shadowAngle: 0.12,
    shadowLength: 1.0,
    windowGlow: 0.25,
    windowColor: '#e0f2fe',
    streetLightOn: false,
    streetLightColor: '#fef08a',
    highlightColor: '#ffffff',
    characterTint: null
  },
  afternoon: {
    id: 'afternoon',
    label: 'Buổi Chiều (Afternoon)',
    skyTop: '#0ea5e9',
    skyMid: '#fde68a',
    skyBottom: '#fed7aa',
    hasSun: true,
    sunColor: '#fbbf24',
    sunYRatio: 0.26,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#fed7aa',
    ambientOpacity: 0.1,
    wallTint: '#fef3c7',
    floorTint: '#78716c',
    shadowColor: 'rgba(41, 37, 36, 0.28)',
    shadowAngle: -0.45,
    shadowLength: 1.35,
    windowGlow: 0.4,
    windowColor: '#fde68a',
    streetLightOn: false,
    streetLightColor: '#fef08a',
    highlightColor: '#fde68a',
    characterTint: 'rgba(251, 191, 36, 0.08)'
  },
  sunset: {
    id: 'sunset',
    label: 'Hoàng Hôn (Sunset)',
    skyTop: '#312e81',
    skyMid: '#be185d',
    skyBottom: '#fb923c',
    hasSun: true,
    sunColor: '#f97316',
    sunYRatio: 0.44,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#fb7185',
    ambientOpacity: 0.16,
    wallTint: '#4c1d3d',
    floorTint: '#3b1d30',
    shadowColor: 'rgba(30, 27, 75, 0.36)',
    shadowAngle: -0.65,
    shadowLength: 1.6,
    windowGlow: 0.72,
    windowColor: '#fdba74',
    streetLightOn: true,
    streetLightColor: '#fde047',
    highlightColor: '#fdba74',
    characterTint: 'rgba(249, 115, 22, 0.12)'
  },
  night: {
    id: 'night',
    label: 'Ban Đêm (Night)',
    skyTop: '#020617',
    skyMid: '#0f172a',
    skyBottom: '#1e1b4b',
    hasSun: false, // STRICT: NEVER draw daytime sun at night!
    sunColor: null,
    sunYRatio: 0,
    hasMoon: true,
    moonColor: '#f8fafc',
    hasStars: true,
    ambientColor: '#0f172a',
    ambientOpacity: 0.24,
    wallTint: '#090d16',
    floorTint: '#111827',
    shadowColor: 'rgba(2, 6, 23, 0.52)',
    shadowAngle: 0.2,
    shadowLength: 1.1,
    windowGlow: 0.92,
    windowColor: '#fde047',
    streetLightOn: true,
    streetLightColor: '#fde047',
    highlightColor: '#38bdf8',
    characterTint: 'rgba(15, 23, 42, 0.16)'
  },
  cloudy: {
    id: 'cloudy',
    label: 'Trời Âm U (Cloudy)',
    skyTop: '#64748b',
    skyMid: '#94a3b8',
    skyBottom: '#cbd5e1',
    hasSun: false,
    sunColor: null,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#94a3b8',
    ambientOpacity: 0.14,
    wallTint: '#cbd5e1',
    floorTint: '#64748b',
    shadowColor: 'rgba(15, 23, 42, 0.18)',
    shadowAngle: 0.0,
    shadowLength: 0.85,
    windowGlow: 0.35,
    windowColor: '#e2e8f0',
    streetLightOn: false,
    streetLightColor: '#fef08a',
    highlightColor: '#e2e8f0',
    characterTint: 'rgba(148, 163, 184, 0.08)'
  },
  indoor_warm: {
    id: 'indoor_warm',
    label: 'Ánh Đèn Ấm (Indoor Warm)',
    skyTop: '#1e1b4b',
    skyMid: '#312e81',
    skyBottom: '#4338ca',
    hasSun: false,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#f59e0b',
    ambientOpacity: 0.12,
    wallTint: '#451a03',
    floorTint: '#292524',
    shadowColor: 'rgba(28, 25, 23, 0.34)',
    shadowAngle: 0.18,
    shadowLength: 1.0,
    windowGlow: 0.85,
    windowColor: '#fef08a',
    streetLightOn: false,
    streetLightColor: '#fef08a',
    highlightColor: '#fde68a',
    characterTint: 'rgba(251, 191, 36, 0.09)'
  },
  indoor_cool: {
    id: 'indoor_cool',
    label: 'Ánh Đèn Lạnh (Indoor Cool)',
    skyTop: '#0f172a',
    skyMid: '#1e293b',
    skyBottom: '#334155',
    hasSun: false,
    hasMoon: false,
    hasStars: false,
    ambientColor: '#38bdf8',
    ambientOpacity: 0.08,
    wallTint: '#0f172a',
    floorTint: '#1e293b',
    shadowColor: 'rgba(2, 6, 23, 0.36)',
    shadowAngle: 0.1,
    shadowLength: 0.95,
    windowGlow: 0.75,
    windowColor: '#7dd3fc',
    streetLightOn: false,
    streetLightColor: '#38bdf8',
    highlightColor: '#7dd3fc',
    characterTint: 'rgba(56, 189, 248, 0.06)'
  }
};

export function normalizeLightingName(lighting = 'daylight') {
  const l = String(lighting || 'daylight').toLowerCase().trim();
  if (l === 'day' || l === 'daytime' || l === 'noon') return 'daylight';
  if (l === 'dark' || l === 'midnight' || l === 'evening_night') return 'night';
  if (l === 'dusk' || l === 'golden_hour') return 'sunset';
  if (l === 'dawn' || l === 'sunrise') return 'morning';
  if (l === 'overcast' || l === 'rain') return 'cloudy';
  if (l === 'warm' || l === 'indoor_warm_light') return 'indoor_warm';
  if (l === 'cool' || l === 'indoor_cool_light' || l === 'lab') return 'indoor_cool';
  return LIGHTING_PRESETS[l] ? l : 'daylight';
}

export function resolveLightingProfile(lighting = 'daylight') {
  const key = normalizeLightingName(lighting);
  return { ...LIGHTING_PRESETS[key] };
}

export function applyTimeOfDay(palette = {}, timeOfDay = 'day') {
  const lp = resolveLightingProfile(timeOfDay);
  const p = { ...palette };
  if (lp.wallTint) p.wall = lp.wallTint;
  if (lp.floorTint) p.floor = lp.floorTint;
  if (lp.highlightColor) p.highlight = lp.highlightColor;
  return p;
}

// ============================================================================
// 3. PERSPECTIVE & DEPTH SYSTEM
// ============================================================================

export const PERSPECTIVE_MODES = ['front', 'side', 'three_quarter', 'one_point', 'two_point'];

/**
 * Computes deterministic perspective geometry for a scene canvas.
 */
export function computePerspectiveLayout(width = 1920, height = 1080, options = {}) {
  const mode = PERSPECTIVE_MODES.includes(options.perspective) ? options.perspective : 'one_point';
  const horizonY = Math.round(height * (options.horizonRatio ?? 0.56));
  const groundY = Math.round(height * (options.groundLevel ?? 0.78));
  const vanishingPointX = mode === 'three_quarter' ? Math.round(width * 0.62) : Math.round(width * 0.5);
  const vanishingPointY = horizonY;

  return {
    mode,
    width,
    height,
    horizonY,
    groundY,
    vanishingPoint: [vanishingPointX, vanishingPointY],
    depthBands: {
      background: { zIndex: 10, scaleRange: [0.35, 0.55], hazeOpacity: 0.25 },
      midground:  { zIndex: 20, scaleRange: [0.65, 0.90], hazeOpacity: 0.08 },
      foreground: { zIndex: 30, scaleRange: [1.0,  1.25], hazeOpacity: 0.0  }
    }
  };
}

/**
 * Relative object scale based on normalized depth z (0 = far horizon, 1 = camera foreground).
 */
export function computeDepthScale(zDepth = 0.7) {
  const z = Math.max(0, Math.min(1, Number(zDepth)));
  return Number((0.4 + z * 0.75).toFixed(3));
}

/**
 * Generates contact shadow primitive for grounded props/furniture.
 */
export function buildContactShadow(cx, groundY, rx = 80, ry = 14, lighting = 'daylight') {
  const lp = resolveLightingProfile(lighting);
  const offsetX = Math.round((lp.shadowAngle || 0) * 18);
  return {
    type: 'ellipse',
    cx: Math.round(cx + offsetX),
    cy: Math.round(groundY + 3),
    rx: Math.round(rx * (lp.shadowLength || 1)),
    ry: Math.round(ry),
    fill: lp.shadowColor
  };
}

// ============================================================================
// 4. DETERMINISTIC SEEDED PRNG
// ============================================================================

export function createRng(seed = 12345) {
  let s = 0;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      s = ((s << 5) - s) + seed.charCodeAt(i);
      s |= 0;
    }
  } else {
    s = Number(seed) || 12345;
  }

  return function random() {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
