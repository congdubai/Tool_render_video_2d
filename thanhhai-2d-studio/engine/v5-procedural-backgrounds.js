// engine/v5-procedural-backgrounds.js — Procedural Background Generator (V5.1)
// Generates parametric, multi-layered 2D cartoon backgrounds across Indoor, Outdoor, Historical, and Scientific categories.
// Output contains separate background, midground, and foreground layers with deterministic seed variations.

import { getStyleTheme, applyTimeOfDay, createRng } from './v5-style-engine.js';
import { renderToSvg, renderToPngFile } from './v5-vector-engine.js';

export const BACKGROUND_CATEGORIES = {
  INDOOR: ['lab_modern', 'office', 'living_room', 'bedroom', 'classroom', 'hospital', 'factory', 'warehouse', 'cafe', 'store'],
  OUTDOOR: ['street', 'city', 'park', 'forest', 'mountain', 'beach', 'desert', 'countryside', 'construction', 'ancient_village'],
  HISTORICAL: ['vintage_lab', 'industrial_factory', 'inventor_workshop', 'ancient_city', 'vintage_computer_room'],
  SCIENTIFIC: ['physics_lab', 'chemistry_lab', 'research_center', 'space_station', 'inside_machine']
};

/**
 * Builds a procedural background vector specification
 */
export function generateProceduralBackground(templateId = 'lab_modern', options = {}) {
  const normId = String(templateId || 'lab_modern').toLowerCase().replace(/^bg_/, '');
  const width = options.width || 1920;
  const height = options.height || 1080;
  const seed = options.seed || 42;
  const rng = createRng(seed);

  const styleProfile = options.styleProfile || 'white_cartoon';
  const theme = getStyleTheme(styleProfile);
  const palette = applyTimeOfDay(options.palette || theme.palette, options.timeOfDay || 'day');
  const strokeColor = theme.outlineColor;
  const strokeWidth = theme.outlineWidth;

  const groundY = Math.round(height * (options.groundLevel || 0.82));

  // Determine category & builder
  let bgType = 'lab_modern';
  for (const [cat, list] of Object.entries(BACKGROUND_CATEGORIES)) {
    if (list.includes(normId)) {
      bgType = normId;
      break;
    }
  }

  // Builder dispatcher
  const builder = BUILDERS[bgType] || BUILDERS.lab_modern;
  const { backgroundElements, midgroundElements, foregroundElements } = builder({
    width,
    height,
    groundY,
    palette,
    strokeColor,
    strokeWidth,
    rng,
    timeOfDay: options.timeOfDay || 'day',
    options
  });

  const layers = [
    { id: 'layer_background', name: 'Background (Wall / Sky / Floor)', zIndex: 10, elements: backgroundElements },
    { id: 'layer_midground', name: 'Midground (Furniture / Architecture)', zIndex: 20, elements: midgroundElements },
    { id: 'layer_foreground', name: 'Foreground (Framing & Accents)', zIndex: 30, elements: foregroundElements }
  ];

  const fullElements = [
    { type: 'group', id: 'background_layer', children: backgroundElements },
    { type: 'group', id: 'midground_layer', children: midgroundElements },
    { type: 'group', id: 'foreground_layer', children: foregroundElements }
  ];

  const vectorSpec = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    styleProfile,
    templateId: normId,
    seed,
    elements: fullElements
  };

  return {
    id: `bg_${normId}`,
    templateId: normId,
    type: 'background',
    name: getBackgroundTitle(normId),
    width,
    height,
    groundY,
    layers,
    vectorSpec,
    getSvg: () => renderToSvg(vectorSpec),
    renderPng: (outPath) => renderToPngFile(vectorSpec, outPath, { width, height })
  };
}

function getBackgroundTitle(id) {
  const map = {
    lab_modern: 'Phòng Nghiên Cứu Công Nghệ Hiện Đại',
    vintage_lab: 'Phòng Thí Nghiệm Cổ Điển Thập Niên 1940–1980',
    vintage_computer_room: 'Phòng Máy Tính Đèn Chân Không ENIAC',
    physics_lab: 'Phòng Thí Nghiệm Vật Lý',
    chemistry_lab: 'Phòng Thí Nghiệm Hóa Học',
    cafe: 'Quán Cà Phê Ấm Cúng',
    street: 'Đường Phố Thành Thị',
    city: 'Trung Tâm Thành Phố Hiện Đại',
    classroom: 'Lớp Học Trường Học',
    office: 'Văn Phòng Làm Việc',
    space_station: 'Trạm Vũ Trụ Không Gian',
    park: 'Công Viên Cây Xanh'
  };
  return map[id] || `Bối cảnh hoạt hình ${id}`;
}

// =========================================================================
// BACKGROUND TEMPLATE BUILDERS
// =========================================================================

const BUILDERS = {
  // 1. MODERN TECH LAB
  lab_modern: ({ width, height, groundY, palette, strokeColor, strokeWidth, rng }) => {
    const bg = [
      // Wall
      { type: 'rect', x: 0, y: 0, width, height: groundY, fill: palette.wall },
      // Floor
      { type: 'rect', x: 0, y: groundY, width, height: height - groundY, fill: palette.floor, stroke: strokeColor, strokeWidth },
      // Floor perspective tiles
      { type: 'line', x1: 0, y1: groundY + 50, x2: width, y2: groundY + 50, stroke: '#1e293b', strokeWidth: 2 },
      { type: 'line', x1: width * 0.2, y1: groundY, x2: width * 0.1, y2: height, stroke: '#1e293b', strokeWidth: 2 },
      { type: 'line', x1: width * 0.5, y1: groundY, x2: width * 0.5, y2: height, stroke: '#1e293b', strokeWidth: 2 },
      { type: 'line', x1: width * 0.8, y1: groundY, x2: width * 0.9, y2: height, stroke: '#1e293b', strokeWidth: 2 }
    ];

    const mg = [
      // Large Tech Window / Screen in Center
      { type: 'rounded_rect', x: width * 0.28, y: height * 0.12, width: width * 0.44, height: height * 0.42, rx: 12, fill: '#0f172a', stroke: strokeColor, strokeWidth },
      { type: 'rect', x: width * 0.3, y: height * 0.14, width: width * 0.4, height: height * 0.38, fill: palette.screenGlow, opacity: 0.25 },
      // Glowing Hologram Grid on Screen
      { type: 'line', x1: width * 0.3, y1: height * 0.33, x2: width * 0.7, y2: height * 0.33, stroke: palette.screenGlow, strokeWidth: 2, opacity: 0.6 },
      { type: 'line', x1: width * 0.5, y1: height * 0.14, x2: width * 0.5, y2: height * 0.52, stroke: palette.screenGlow, strokeWidth: 2, opacity: 0.6 },
      // Server Rack on the Left
      { type: 'rounded_rect', x: width * 0.04, y: height * 0.22, width: width * 0.18, height: groundY - height * 0.22, rx: 8, fill: '#090d16', stroke: strokeColor, strokeWidth },
      { type: 'line', x1: width * 0.06, y1: height * 0.35, x2: width * 0.2, y2: height * 0.35, stroke: palette.primary, strokeWidth: 3 },
      { type: 'line', x1: width * 0.06, y1: height * 0.48, x2: width * 0.2, y2: height * 0.48, stroke: palette.accent, strokeWidth: 3 },
      { type: 'line', x1: width * 0.06, y1: height * 0.61, x2: width * 0.2, y2: height * 0.61, stroke: palette.primary, strokeWidth: 3 },
      { type: 'circle', cx: width * 0.18, cy: height * 0.28, r: 6, fill: '#22c55e' },
      { type: 'circle', cx: width * 0.18, cy: height * 0.31, r: 6, fill: '#ef4444' },
      // Modern Lab Bench / Desk on Right
      { type: 'rounded_rect', x: width * 0.74, y: groundY - 140, width: width * 0.22, height: 140, rx: 6, fill: palette.metal, stroke: strokeColor, strokeWidth },
      { type: 'rect', x: width * 0.76, y: groundY - 180, width: 80, height: 40, fill: '#0f172a', stroke: strokeColor, strokeWidth: 3 }
    ];

    const fg = [
      // Overhead Modern Sleek Fluorescent Lamp
      { type: 'rounded_rect', x: width * 0.32, y: 10, width: width * 0.36, height: 22, rx: 6, fill: '#ffffff', stroke: strokeColor, strokeWidth: 3 },
      { type: 'line', x1: width * 0.38, y1: 0, x2: width * 0.38, y2: 10, stroke: strokeColor, strokeWidth: 3 },
      { type: 'line', x1: width * 0.62, y1: 0, x2: width * 0.62, y2: 10, stroke: strokeColor, strokeWidth: 3 }
    ];

    return { backgroundElements: bg, midgroundElements: mg, foregroundElements: fg };
  },

  // 2. VINTAGE RESEARCH LAB (1940s–1980s Historical Lab)
  vintage_lab: ({ width, height, groundY, palette, strokeColor, strokeWidth, rng }) => {
    const bg = [
      // Aged wall with brick / panel seams
      { type: 'rect', x: 0, y: 0, width, height: groundY, fill: '#57534e' },
      { type: 'line', x1: 0, y1: height * 0.38, x2: width, y2: height * 0.38, stroke: '#44403c', strokeWidth: 3 },
      // Wooden floorboards
      { type: 'rect', x: 0, y: groundY, width, height: height - groundY, fill: '#78350f', stroke: strokeColor, strokeWidth },
      { type: 'line', x1: 0, y1: groundY + 40, x2: width, y2: groundY + 40, stroke: '#451a03', strokeWidth: 2 },
      { type: 'line', x1: 0, y1: groundY + 90, x2: width, y2: groundY + 90, stroke: '#451a03', strokeWidth: 2 },
      { type: 'line', x1: 0, y1: groundY + 140, x2: width, y2: groundY + 140, stroke: '#451a03', strokeWidth: 2 }
    ];

    const mg = [
      // Big arched vintage window with mullions
      { type: 'rounded_rect', x: width * 0.36, y: height * 0.1, width: width * 0.28, height: height * 0.48, rx: 40, fill: '#fef3c7', stroke: strokeColor, strokeWidth },
      { type: 'line', x1: width * 0.5, y1: height * 0.1, x2: width * 0.5, y2: height * 0.58, stroke: strokeColor, strokeWidth: 4 },
      { type: 'line', x1: width * 0.36, y1: height * 0.34, x2: width * 0.64, y2: height * 0.34, stroke: strokeColor, strokeWidth: 4 },
      // Chalkboard on the Left with mathematical equations
      { type: 'rounded_rect', x: width * 0.05, y: height * 0.18, width: width * 0.25, height: height * 0.38, rx: 6, fill: '#14532d', stroke: '#78350f', strokeWidth: 8 },
      { type: 'text', x: width * 0.08, y: height * 0.3, text: 'E = mc²', fontSize: 32, fill: '#ffffff', fontFamily: 'serif' },
      { type: 'text', x: width * 0.08, y: height * 0.42, text: 'λ = h / p', fontSize: 24, fill: '#fde047', fontFamily: 'serif' },
      // Heavy vintage wooden laboratory workbench on Right
      { type: 'rounded_rect', x: width * 0.68, y: groundY - 160, width: width * 0.28, height: 160, rx: 6, fill: '#451a03', stroke: strokeColor, strokeWidth },
      // Chemistry stand on bench
      { type: 'line', x1: width * 0.75, y1: groundY - 160, x2: width * 0.75, y2: groundY - 260, stroke: strokeColor, strokeWidth: 5 },
      { type: 'line', x1: width * 0.72, y1: groundY - 220, x2: width * 0.78, y2: groundY - 220, stroke: strokeColor, strokeWidth: 4 }
    ];

    const fg = [
      // Industrial hanging pendant lamp
      { type: 'line', x1: width * 0.5, y1: 0, x2: width * 0.5, y2: 80, stroke: strokeColor, strokeWidth: 4 },
      { type: 'path', d: `M ${width * 0.44} 120 L ${width * 0.5} 80 L ${width * 0.56} 120 Z`, fill: '#292524', stroke: strokeColor, strokeWidth: 4 },
      { type: 'ellipse', cx: width * 0.5, cy: 120, rx: width * 0.06, ry: 10, fill: '#fef08a' }
    ];

    return { backgroundElements: bg, midgroundElements: mg, foregroundElements: fg };
  },

  // 3. VINTAGE COMPUTER ROOM (1940s-1950s ENIAC Room)
  vintage_computer_room: ({ width, height, groundY, palette, strokeColor, strokeWidth }) => {
    const bg = [
      { type: 'rect', x: 0, y: 0, width, height: groundY, fill: '#3f3f46' },
      { type: 'rect', x: 0, y: groundY, width, height: height - groundY, fill: '#27272a', stroke: strokeColor, strokeWidth }
    ];

    const mg = [
      // Bank of Mainframe Cabinets across the back
      { type: 'rect', x: width * 0.08, y: height * 0.15, width: width * 0.22, height: groundY - height * 0.15, fill: '#18181b', stroke: strokeColor, strokeWidth },
      { type: 'rect', x: width * 0.34, y: height * 0.15, width: width * 0.32, height: groundY - height * 0.15, fill: '#18181b', stroke: strokeColor, strokeWidth },
      { type: 'rect', x: width * 0.7, y: height * 0.15, width: width * 0.22, height: groundY - height * 0.15, fill: '#18181b', stroke: strokeColor, strokeWidth },
      // Cabinet patch panels & dials
      { type: 'circle', cx: width * 0.42, cy: height * 0.3, r: 24, fill: '#3f3f46', stroke: strokeColor, strokeWidth: 3 },
      { type: 'circle', cx: width * 0.58, cy: height * 0.3, r: 24, fill: '#3f3f46', stroke: strokeColor, strokeWidth: 3 },
      // Row of blinking vacuum tubes in top grill
      { type: 'rounded_rect', x: width * 0.37, y: height * 0.42, width: width * 0.26, height: 70, rx: 6, fill: '#09090b', stroke: strokeColor, strokeWidth: 3 },
      { type: 'circle', cx: width * 0.40, cy: height * 0.45, r: 8, fill: '#f59e0b' },
      { type: 'circle', cx: width * 0.45, cy: height * 0.45, r: 8, fill: '#f59e0b' },
      { type: 'circle', cx: width * 0.50, cy: height * 0.45, r: 8, fill: '#f59e0b' },
      { type: 'circle', cx: width * 0.55, cy: height * 0.45, r: 8, fill: '#f59e0b' },
      { type: 'circle', cx: width * 0.60, cy: height * 0.45, r: 8, fill: '#f59e0b' }
    ];

    const fg = [
      // Overhead industrial conduit pipes
      { type: 'rect', x: 0, y: 14, width, height: 18, fill: '#71717a', stroke: strokeColor, strokeWidth: 3 }
    ];

    return { backgroundElements: bg, midgroundElements: mg, foregroundElements: fg };
  },

  // 4. COZY CAFE
  cafe: ({ width, height, groundY, palette, strokeColor, strokeWidth }) => {
    const bg = [
      { type: 'rect', x: 0, y: 0, width, height: groundY, fill: '#7c2d12' },
      { type: 'rect', x: 0, y: groundY, width, height: height - groundY, fill: '#451a03', stroke: strokeColor, strokeWidth }
    ];
    const mg = [
      // Brick texture accents & Window overlooking street
      { type: 'rounded_rect', x: width * 0.2, y: height * 0.15, width: width * 0.6, height: height * 0.5, rx: 12, fill: '#fef3c7', stroke: strokeColor, strokeWidth },
      { type: 'line', x1: width * 0.5, y1: height * 0.15, x2: width * 0.5, y2: height * 0.65, stroke: strokeColor, strokeWidth: 4 },
      // Cafe counter
      { type: 'rounded_rect', x: width * 0.05, y: groundY - 120, width: width * 0.35, height: 120, rx: 8, fill: '#b45309', stroke: strokeColor, strokeWidth }
    ];
    const fg = [
      // Hanging decorative warm lights
      { type: 'circle', cx: width * 0.25, cy: 70, r: 16, fill: '#fde047', stroke: strokeColor, strokeWidth: 3 },
      { type: 'circle', cx: width * 0.75, cy: 70, r: 16, fill: '#fde047', stroke: strokeColor, strokeWidth: 3 }
    ];
    return { backgroundElements: bg, midgroundElements: mg, foregroundElements: fg };
  },

  // 5. CITY STREET
  street: ({ width, height, groundY, palette, strokeColor, strokeWidth, timeOfDay }) => {
    const isNight = timeOfDay === 'night';
    const bg = [
      // Sky
      { type: 'rect', x: 0, y: 0, width, height: groundY, fill: isNight ? '#090d16' : '#60a5fa' },
      // City skyline in distance
      { type: 'rect', x: width * 0.1, y: height * 0.25, width: width * 0.18, height: groundY - height * 0.25, fill: isNight ? '#1e293b' : '#94a3b8' },
      { type: 'rect', x: width * 0.32, y: height * 0.18, width: width * 0.22, height: groundY - height * 0.18, fill: isNight ? '#0f172a' : '#64748b' },
      { type: 'rect', x: width * 0.58, y: height * 0.22, width: width * 0.28, height: groundY - height * 0.22, fill: isNight ? '#1e293b' : '#94a3b8' },
      // Pavement / Road
      { type: 'rect', x: 0, y: groundY, width, height: height - groundY, fill: '#334155', stroke: strokeColor, strokeWidth },
      { type: 'line', x1: 0, y1: groundY + (height - groundY) * 0.5, x2: width, y2: groundY + (height - groundY) * 0.5, stroke: '#facc15', strokeWidth: 6, strokeDasharray: '40 30' }
    ];

    const mg = [
      // Sidewalk curb
      { type: 'rect', x: 0, y: groundY - 30, width, height: 30, fill: '#64748b', stroke: strokeColor, strokeWidth: 2 }
    ];

    const fg = [
      // Street Lamp on right
      { type: 'rect', x: width * 0.88, y: groundY - 260, width: 14, height: 260, fill: '#1e293b', stroke: strokeColor, strokeWidth: 3 },
      { type: 'circle', cx: width * 0.887, cy: groundY - 270, r: 24, fill: '#fef08a', stroke: strokeColor, strokeWidth: 3 }
    ];

    return { backgroundElements: bg, midgroundElements: mg, foregroundElements: fg };
  }
};

// Aliases for comprehensive category coverage
BUILDERS.chemistry_lab = BUILDERS.vintage_lab;
BUILDERS.physics_lab = BUILDERS.lab_modern;
BUILDERS.research_center = BUILDERS.lab_modern;
BUILDERS.industrial_factory = BUILDERS.vintage_computer_room;
BUILDERS.inventor_workshop = BUILDERS.vintage_lab;
BUILDERS.office = BUILDERS.lab_modern;
BUILDERS.classroom = BUILDERS.vintage_lab;
BUILDERS.city = BUILDERS.street;
BUILDERS.space_station = BUILDERS.lab_modern;
BUILDERS.park = BUILDERS.street;

