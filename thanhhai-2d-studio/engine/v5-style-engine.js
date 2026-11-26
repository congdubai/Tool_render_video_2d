// engine/v5-style-engine.js — Procedural Style Engine (V5.1)
// Enforces harmonious visual design across all generated backgrounds, props, diagrams, and characters.
// Manages unified palettes, outline weights, corner radii, and parametric lighting.

export const STYLE_PROFILES = {
  white_cartoon: {
    id: 'white_cartoon',
    name: 'White Cartoon 2D (Chính Quy)',
    outlineColor: '#20202A',
    outlineWidth: 5,
    cornerRadius: 8,
    shading: 'cel_2tone',
    palette: {
      primary: '#38bdf8',       // Sky blue
      secondary: '#f8fafc',     // Crisp white
      accent: '#facc15',        // Bright yellow
      floor: '#334155',         // Slate floor
      wall: '#1e293b',          // Dark blue-gray wall
      metal: '#94a3b8',         // Clean steel
      wood: '#b45309',          // Warm wood
      screenGlow: '#0ea5e9',    // Vibrant screen
      highlight: '#ffffff'
    }
  },
  chibi_cartoon: {
    id: 'chibi_cartoon',
    name: 'Chibi Cartoon',
    outlineColor: '#27272a',
    outlineWidth: 6,
    cornerRadius: 16,
    shading: 'soft_pastel',
    palette: {
      primary: '#f472b6',       // Bubblegum pink
      secondary: '#fed7aa',     // Peach
      accent: '#fde047',        // Pastel yellow
      floor: '#f1f5f9',         // Light floor
      wall: '#e0f2fe',          // Baby blue wall
      metal: '#cbd5e1',         // Soft gray
      wood: '#d97706',          // Caramel wood
      screenGlow: '#38bdf8',    // Cyan glow
      highlight: '#ffffff'
    }
  },
  flat_vector: {
    id: 'flat_vector',
    name: 'Flat Vector Minimal',
    outlineColor: '#0f172a',
    outlineWidth: 3,
    cornerRadius: 4,
    shading: 'flat',
    palette: {
      primary: '#2563eb',       // Royal blue
      secondary: '#f1f5f9',     // Cool gray
      accent: '#ef4444',        // Bold red
      floor: '#475569',         // Medium slate
      wall: '#f8fafc',          // Clean light wall
      metal: '#64748b',         // Dark metal
      wood: '#92400e',          // Walnut wood
      screenGlow: '#3b82f6',    // Digital blue
      highlight: '#ffffff'
    }
  },
  minimal_educational: {
    id: 'minimal_educational',
    name: 'Minimal Educational',
    outlineColor: '#1e293b',
    outlineWidth: 4,
    cornerRadius: 6,
    shading: 'minimal_contrast',
    palette: {
      primary: '#0284c7',       // Educational blue
      secondary: '#ffffff',     // Pure white
      accent: '#10b981',        // Emerald green
      floor: '#e2e8f0',         // Bright floor
      wall: '#f1f5f9',          // Clean background
      metal: '#94a3b8',         // Neutral steel
      wood: '#78350f',          // Wood tone
      screenGlow: '#0284c7',    // Info cyan
      highlight: '#ffffff'
    }
  },
  historical_cartoon: {
    id: 'historical_cartoon',
    name: 'Historical Vintage (1940–1980)',
    outlineColor: '#292524',
    outlineWidth: 5,
    cornerRadius: 6,
    shading: 'sepia_warm',
    palette: {
      primary: '#d97706',       // Amber / Brass
      secondary: '#fef3c7',     // Parchment
      accent: '#b45309',        // Dark bronze
      floor: '#57534e',         // Stone gray floor
      wall: '#78716c',          // Industrial concrete wall
      metal: '#44403c',         // Cast iron / Bakelite
      wood: '#78350f',          // Antique mahogany
      screenGlow: '#22c55e',    // Green monochrome phosphor screen
      highlight: '#fef08a'      // Warm lamp glow
    }
  },
  doodle: {
    id: 'doodle',
    name: 'Doodle Sketch 2D',
    outlineColor: '#18181b',
    outlineWidth: 5,
    cornerRadius: 12,
    shading: 'sketch_crosshatch',
    palette: {
      primary: '#6366f1',       // Ink indigo
      secondary: '#fafafa',     // Sketchbook paper
      accent: '#f43f5e',        // Marker red
      floor: '#e4e4e7',         // Paper floor
      wall: '#ffffff',          // White paper
      metal: '#71717a',         // Pencil gray
      wood: '#a16207',          // Marker brown
      screenGlow: '#818cf8',    // Light ink
      highlight: '#ffffff'
    }
  }
};

/**
 * Resolves a style profile with fallback
 */
export function getStyleTheme(profileId = 'white_cartoon') {
  const norm = String(profileId || '').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return STYLE_PROFILES[norm] || STYLE_PROFILES.white_cartoon;
}

/**
 * Adjusts color palette according to time of day
 */
export function applyTimeOfDay(palette = {}, timeOfDay = 'day') {
  const p = { ...palette };
  const tod = String(timeOfDay || 'day').toLowerCase();

  if (tod === 'sunset') {
    p.wall = '#4c1d3d';       // Warm purple tint
    p.floor = '#3b1d30';
    p.highlight = '#fde047';   // Golden hour glow
  } else if (tod === 'night') {
    p.wall = '#090d16';       // Deep midnight blue
    p.floor = '#1e1b4b';
    p.highlight = '#38bdf8';   // Neon blue tint
  }
  return p;
}

/**
 * Simple deterministic pseudo-random generator from integer or string seed
 */
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

