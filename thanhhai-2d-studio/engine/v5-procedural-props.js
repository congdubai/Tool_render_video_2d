// engine/v5-procedural-props.js — Procedural Prop Generator (V5.1)
// Generates parametric, multi-layered 2D cartoon props with built-in hand grips, ground contacts,
// and independent animatable layers on transparent backgrounds (PNG Alpha).

import { getStyleTheme, createRng } from './v5-style-engine.js';
import { renderToSvg, renderToPngFile } from './v5-vector-engine.js';

export const PROP_CATALOG = [
  'vintage_computer', 'modern_computer', 'laptop', 'smartphone',
  'microchip', 'transistor', 'lightbulb', 'vintage_book',
  'coffee_cup', 'desk', 'chair', 'box', 'lab_equipment', 'machine', 'gear', 'tool'
];

/**
 * Builds a procedural prop vector specification
 */
export function generateProceduralProp(templateId = 'vintage_computer', options = {}) {
  const normId = String(templateId || 'vintage_computer').toLowerCase()
    .replace(/^prop_/, '')
    .replace(/^req_prop_/, '')
    .replace(/^req_/, '');

  const width = options.width || 512;
  const height = options.height || 512;
  const seed = options.seed || 101;
  const rng = createRng(seed);

  const styleProfile = options.styleProfile || 'white_cartoon';
  const theme = getStyleTheme(styleProfile);
  const palette = { ...theme.palette, ...(options.palette || {}) };
  const strokeColor = theme.outlineColor;
  const strokeWidth = theme.outlineWidth;

  const builder = PROP_BUILDERS[normId] || PROP_BUILDERS.vintage_computer;
  const result = builder({ width, height, palette, strokeColor, strokeWidth, rng, options });

  const vectorSpec = {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    styleProfile,
    templateId: normId,
    seed,
    elements: result.elements
  };

  return {
    id: `prop_${normId}`,
    templateId: normId,
    type: 'prop',
    name: result.name || getPropTitle(normId),
    width,
    height,
    gripPoint: result.gripPoint || { x: 0.5, y: 0.85 },
    groundContact: result.groundContact || { x: 0.5, y: 0.98 },
    pivot: result.pivot || { x: 0.5, y: 0.5 },
    layers: result.layers || [
      { id: 'main', name: 'Thân chính (Main Body)', elements: result.elements }
    ],
    vectorSpec,
    getSvg: () => renderToSvg(vectorSpec),
    renderPng: (outPath) => renderToPngFile(vectorSpec, outPath, { width, height })
  };
}

function getPropTitle(id) {
  const map = {
    vintage_computer: 'Máy Tính Cổ Điển (Vintage Computer)',
    modern_computer: 'Máy Tính Để Bàn Hiện Đại',
    laptop: 'Máy Tính Xách Tay (Laptop)',
    smartphone: 'Điện Thoại Thông Minh (Smartphone)',
    microchip: 'Vi Xử Lý (Microchip CPU)',
    transistor: 'Linh Kiện Bán Dẫn (Transistor)',
    lightbulb: 'Bóng Đèn Sáng Kiến (Idea Bulb)',
    vintage_book: 'Cuốn Sách Cổ (Vintage Book)',
    coffee_cup: 'Cốc Cà Phê Nóng (Coffee Cup)',
    desk: 'Bàn Làm Việc Phòng Lab',
    chair: 'Ghế Tựa Văn Phòng',
    box: 'Thùng Gỗ / Thùng Carton',
    lab_equipment: 'Bình Cầu Thí Nghiệm (Lab Flask)',
    gear: 'Bánh Răng Cơ Khí (Gear)'
  };
  return map[id] || `Đạo cụ ${id}`;
}

// =========================================================================
// PROP TEMPLATE BUILDERS
// =========================================================================

const PROP_BUILDERS = {
  // 1. VINTAGE COMPUTER (Mainframe / 1950s Terminal with separate screen & dials)
  vintage_computer: ({ width, height, palette, strokeColor, strokeWidth, rng }) => {
    // Separate layers: main_body, screen, vacuum_tubes, dials_and_lights
    const mainBody = [
      // Chassis
      { type: 'rounded_rect', x: 60, y: 100, width: 392, height: 350, rx: 16, fill: '#3f3f46', stroke: strokeColor, strokeWidth },
      // Ventilation Grill at bottom
      { type: 'line', x1: 100, y1: 400, x2: 412, y2: 400, stroke: '#18181b', strokeWidth: 4 },
      { type: 'line', x1: 100, y1: 415, x2: 412, y2: 415, stroke: '#18181b', strokeWidth: 4 }
    ];

    const screen = [
      // CRT Bezel
      { type: 'rounded_rect', x: 90, y: 130, width: 220, height: 160, rx: 12, fill: '#18181b', stroke: strokeColor, strokeWidth: 4 },
      // Glowing green phosphor screen
      { type: 'rounded_rect', x: 105, y: 145, width: 190, height: 130, rx: 10, fill: '#14532d', stroke: '#22c55e', strokeWidth: 2 },
      // Scanlines & terminal cursor
      { type: 'line', x1: 120, y1: 175, x2: 240, y2: 175, stroke: '#4ade80', strokeWidth: 4 },
      { type: 'line', x1: 120, y1: 195, x2: 210, y2: 195, stroke: '#4ade80', strokeWidth: 4 },
      { type: 'rect', x: 120, y: 210, width: 12, height: 16, fill: '#4ade80' } // Blinking cursor
    ];

    const vacuumTubes = [
      // Top row of vacuum tubes
      { type: 'rounded_rect', x: 140, y: 55, width: 35, height: 45, rx: 14, fill: '#fef08a', opacity: 0.85, stroke: strokeColor, strokeWidth: 3 },
      { type: 'rounded_rect', x: 235, y: 55, width: 35, height: 45, rx: 14, fill: '#fef08a', opacity: 0.85, stroke: strokeColor, strokeWidth: 3 },
      { type: 'rounded_rect', x: 330, y: 55, width: 35, height: 45, rx: 14, fill: '#fef08a', opacity: 0.85, stroke: strokeColor, strokeWidth: 3 }
    ];

    const dialsAndLights = [
      // Dials on the right panel
      { type: 'circle', cx: 370, cy: 160, r: 24, fill: '#27272a', stroke: strokeColor, strokeWidth: 3 },
      { type: 'line', x1: 370, y1: 160, x2: 385, y2: 150, stroke: '#ef4444', strokeWidth: 3 },
      { type: 'circle', cx: 370, cy: 230, r: 24, fill: '#27272a', stroke: strokeColor, strokeWidth: 3 },
      { type: 'line', x1: 370, y1: 230, x2: 360, y2: 215, stroke: '#38bdf8', strokeWidth: 3 },
      // Colored indicator lights
      { type: 'circle', cx: 120, cy: 330, r: 10, fill: '#ef4444', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 160, cy: 330, r: 10, fill: '#facc15', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 200, cy: 330, r: 10, fill: '#22c55e', stroke: strokeColor, strokeWidth: 2 },
      // Patch cable ports
      { type: 'circle', cx: 280, cy: 330, r: 8, fill: '#09090b', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 320, cy: 330, r: 8, fill: '#09090b', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 360, cy: 330, r: 8, fill: '#09090b', stroke: strokeColor, strokeWidth: 2 }
    ];

    const layers = [
      { id: 'vacuum_tubes', name: 'Đèn Chân Không (Vacuum Tubes)', zIndex: 5, elements: vacuumTubes },
      { id: 'main_body', name: 'Thân Máy Cổ (Main Body)', zIndex: 10, elements: mainBody },
      { id: 'screen', name: 'Màn Hình CRT (Screen)', zIndex: 20, elements: screen },
      { id: 'dials_and_lights', name: 'Đèn Báo & Nút Vặn (Dials & Lights)', zIndex: 30, elements: dialsAndLights }
    ];

    return {
      name: 'Máy Tính Cổ Điển Thập Niên 1950',
      elements: [...vacuumTubes, ...mainBody, ...screen, ...dialsAndLights],
      layers,
      gripPoint: { x: 0.5, y: 0.8 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 2. LIGHTBULB / IDEA BULB (Yellow glow, filament, idea sparkles)
  lightbulb: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const glass = [
      // Yellow Bulb Glass
      { type: 'circle', cx: 256, cy: 190, r: 120, fill: '#fde047', stroke: strokeColor, strokeWidth },
      { type: 'polygon', points: [[176, 260], [336, 260], [300, 340], [212, 340]], fill: '#fde047', stroke: strokeColor, strokeWidth },
      // Inner glowing filament
      { type: 'polyline', points: [[230, 260], [240, 180], [256, 160], [272, 180], [282, 260]], stroke: '#eab308', strokeWidth: 5, strokeLinejoin: 'round' }
    ];

    const base = [
      // Screw Base (Metallic bands)
      { type: 'rounded_rect', x: 210, y: 340, width: 92, height: 22, rx: 6, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 4 },
      { type: 'rounded_rect', x: 215, y: 365, width: 82, height: 20, rx: 6, fill: '#64748b', stroke: strokeColor, strokeWidth: 4 },
      { type: 'rounded_rect', x: 225, y: 388, width: 62, height: 18, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth: 4 },
      // Bottom contact point
      { type: 'circle', cx: 256, cy: 412, r: 10, fill: '#1e293b' }
    ];

    const sparkles = [
      // Energy / Idea Rays popping around the bulb
      { type: 'line', x1: 256, y1: 20, x2: 256, y2: 50, stroke: '#f59e0b', strokeWidth: 6, strokeLinecap: 'round' },
      { type: 'line', x1: 100, y1: 80, x2: 125, y2: 105, stroke: '#f59e0b', strokeWidth: 6, strokeLinecap: 'round' },
      { type: 'line', x1: 412, y1: 80, x2: 387, y2: 105, stroke: '#f59e0b', strokeWidth: 6, strokeLinecap: 'round' },
      { type: 'line', x1: 50, y1: 190, x2: 80, y2: 190, stroke: '#f59e0b', strokeWidth: 6, strokeLinecap: 'round' },
      { type: 'line', x1: 462, y1: 190, x2: 432, y2: 190, stroke: '#f59e0b', strokeWidth: 6, strokeLinecap: 'round' }
    ];

    const layers = [
      { id: 'sparkles', name: 'Tia Sáng Ý Tưởng (Idea Sparkles)', zIndex: 5, elements: sparkles },
      { id: 'glass', name: 'Bóng Đèn Thủy Tinh (Glass Bulb)', zIndex: 10, elements: glass },
      { id: 'base', name: 'Đui Đèn Kim Loại (Screw Base)', zIndex: 20, elements: base }
    ];

    return {
      name: 'Bóng Đèn Sáng Kiến (Idea Bulb)',
      elements: [...sparkles, ...glass, ...base],
      layers,
      gripPoint: { x: 0.5, y: 0.8 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 3. COFFEE CUP
  coffee_cup: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const saucer = [
      { type: 'ellipse', cx: 256, cy: 400, rx: 160, ry: 24, fill: '#e2e8f0', stroke: strokeColor, strokeWidth }
    ];
    const mug = [
      // Cup Body
      { type: 'path', d: 'M 140 180 L 160 380 Q 256 410 352 380 L 372 180 Z', fill: '#f8fafc', stroke: strokeColor, strokeWidth },
      // Cup Rim & Coffee liquid
      { type: 'ellipse', cx: 256, cy: 180, rx: 116, ry: 22, fill: '#78350f', stroke: strokeColor, strokeWidth: 4 },
      // Handle
      { type: 'path', d: 'M 360 210 Q 430 210 430 280 Q 430 350 340 350', fill: 'none', stroke: strokeColor, strokeWidth: 12, strokeLinecap: 'round' }
    ];
    const steam = [
      // Steam curls
      { type: 'path', d: 'M 220 140 Q 200 100 220 60', fill: 'none', stroke: '#cbd5e1', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.7 },
      { type: 'path', d: 'M 260 130 Q 280 90 260 50', fill: 'none', stroke: '#cbd5e1', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.7 },
      { type: 'path', d: 'M 300 140 Q 290 100 310 60', fill: 'none', stroke: '#cbd5e1', strokeWidth: 4, strokeLinecap: 'round', opacity: 0.7 }
    ];

    const layers = [
      { id: 'steam', name: 'Làn Khói Nóng (Steam)', zIndex: 5, elements: steam },
      { id: 'saucer', name: 'Đĩa Lót (Saucer)', zIndex: 10, elements: saucer },
      { id: 'mug', name: 'Tách Cà Phê (Mug)', zIndex: 20, elements: mug }
    ];

    return {
      name: 'Tách Cà Phê Nóng',
      elements: [...saucer, ...mug, ...steam],
      layers,
      gripPoint: { x: 0.8, y: 0.55 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 4. LAPTOP
  laptop: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const screen = [
      // Screen Housing
      { type: 'polygon', points: [[90, 80], [422, 80], [392, 330], [120, 330]], fill: '#1e293b', stroke: strokeColor, strokeWidth },
      // Screen Display
      { type: 'polygon', points: [[115, 100], [397, 100], [372, 310], [140, 310]], fill: palette.screenGlow || '#38bdf8', stroke: strokeColor, strokeWidth: 3 }
    ];
    const base = [
      // Keyboard base
      { type: 'polygon', points: [[120, 330], [392, 330], [452, 430], [60, 430]], fill: '#64748b', stroke: strokeColor, strokeWidth },
      // Trackpad
      { type: 'rounded_rect', x: 216, y: 395, width: 80, height: 26, rx: 4, fill: '#475569', stroke: strokeColor, strokeWidth: 2 }
    ];

    return {
      name: 'Máy Tính Xách Tay (Laptop)',
      elements: [...screen, ...base],
      layers: [
        { id: 'screen', name: 'Màn Hình (Display)', zIndex: 10, elements: screen },
        { id: 'base', name: 'Thân Phím (Keyboard Base)', zIndex: 20, elements: base }
      ],
      gripPoint: { x: 0.5, y: 0.85 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 5. MICROCHIP (CPU with pins)
  microchip: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const pins = [];
    // Top and bottom pins
    for (let x = 110; x <= 400; x += 36) {
      pins.push({ type: 'rect', x: x - 6, y: 60, width: 12, height: 35, fill: '#f59e0b', stroke: strokeColor, strokeWidth: 2 });
      pins.push({ type: 'rect', x: x - 6, y: 417, width: 12, height: 35, fill: '#f59e0b', stroke: strokeColor, strokeWidth: 2 });
    }
    // Left and right pins
    for (let y = 110; y <= 400; y += 36) {
      pins.push({ type: 'rect', x: 60, y: y - 6, width: 35, height: 12, fill: '#f59e0b', stroke: strokeColor, strokeWidth: 2 });
      pins.push({ type: 'rect', x: 417, y: y - 6, width: 35, height: 12, fill: '#f59e0b', stroke: strokeColor, strokeWidth: 2 });
    }

    const body = [
      { type: 'rounded_rect', x: 90, y: 90, width: 332, height: 332, rx: 16, fill: '#18181b', stroke: strokeColor, strokeWidth },
      // Silicon die in center
      { type: 'rounded_rect', x: 156, y: 156, width: 200, height: 200, rx: 8, fill: '#334155', stroke: '#f59e0b', strokeWidth: 4 },
      { type: 'text', x: 256, y: 265, text: 'CPU 2D', fontSize: 30, fill: '#f8fafc', fontWeight: 'bold', textAnchor: 'middle' }
    ];

    return {
      name: 'Vi Xử Lý (Microchip CPU)',
      elements: [...pins, ...body],
      layers: [
        { id: 'pins', name: 'Chân Nối Đồng (Pins)', zIndex: 5, elements: pins },
        { id: 'body', name: 'Đế Silicon (Chip Body)', zIndex: 10, elements: body }
      ],
      gripPoint: { x: 0.5, y: 0.5 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 6. TRANSISTOR (3-pin component)
  transistor: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const pins = [
      { type: 'line', x1: 200, y1: 260, x2: 200, y2: 440, stroke: '#94a3b8', strokeWidth: 8, strokeLinecap: 'round' },
      { type: 'line', x1: 256, y1: 260, x2: 256, y2: 460, stroke: '#94a3b8', strokeWidth: 8, strokeLinecap: 'round' },
      { type: 'line', x1: 312, y1: 260, x2: 312, y2: 440, stroke: '#94a3b8', strokeWidth: 8, strokeLinecap: 'round' }
    ];
    const can = [
      // Metal cylinder
      { type: 'path', d: 'M 176 260 L 176 160 A 80 80 0 0 1 336 160 L 336 260 Z', fill: '#334155', stroke: strokeColor, strokeWidth }
    ];

    return {
      name: 'Linh Kiện Bán Dẫn (Transistor)',
      elements: [...pins, ...can],
      layers: [
        { id: 'pins', name: '3 Chân Linh Kiện (Pins)', zIndex: 5, elements: pins },
        { id: 'can', name: 'Vỏ Kim Loại (Metal Can)', zIndex: 10, elements: can }
      ],
      gripPoint: { x: 0.5, y: 0.6 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 7. LAB EQUIPMENT (Flask)
  lab_equipment: ({ width, height, palette, strokeColor, strokeWidth }) => {
    const flask = [
      // Flask outline
      { type: 'polygon', points: [[216, 80], [296, 80], [296, 180], [420, 390], [92, 390], [216, 180]], fill: 'none', stroke: strokeColor, strokeWidth: 6 },
      // Bubbling colored liquid
      { type: 'polygon', points: [[130, 380], [382, 380], [332, 290], [180, 290]], fill: '#38bdf8', opacity: 0.75 },
      { type: 'circle', cx: 220, cy: 330, r: 8, fill: '#ffffff' },
      { type: 'circle', cx: 280, cy: 310, r: 12, fill: '#ffffff' }
    ];

    return {
      name: 'Bình Cầu Thí Nghiệm',
      elements: flask,
      layers: [{ id: 'flask', name: 'Bình Hóa Chất (Flask)', zIndex: 10, elements: flask }],
      gripPoint: { x: 0.5, y: 0.35 },
      groundContact: { x: 0.5, y: 0.95 },
      pivot: { x: 0.5, y: 0.5 }
    };
  }
};

// Aliases
PROP_BUILDERS.eniac = PROP_BUILDERS.vintage_computer;
PROP_BUILDERS.eniac_computer = PROP_BUILDERS.vintage_computer;
PROP_BUILDERS.prop_laptop = PROP_BUILDERS.laptop;
PROP_BUILDERS.prop_coffee_cup = PROP_BUILDERS.coffee_cup;
PROP_BUILDERS.idea_bulb = PROP_BUILDERS.lightbulb;
PROP_BUILDERS.prop_eniac = PROP_BUILDERS.vintage_computer;
PROP_BUILDERS.prop_transistor = PROP_BUILDERS.transistor;

