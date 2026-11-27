// engine/v5-procedural-props.js — Advanced Procedural Prop Generator (V5.2 Phase 2)
// Pure JS (Node + Browser Canvas 2D compatible).
// 18 detailed multi-primitive props with gradients, highlights, shadows, anchors, pivots,
// groundContact, gripPoint, detailLevel (low/medium/high), and independent animatable layers.

import { getStyleTheme, resolveLightingProfile, buildContactShadow, createRng } from './v5-style-engine.js';
import { renderToSvg } from './v5-vector-canvas.js';

export const PROP_CATALOG = [
  'eniac',
  'vintage_computer',
  'modern_computer',
  'laptop',
  'smartphone',
  'transistor',
  'microchip',
  'lightbulb',
  'vintage_book',
  'coffee_cup',
  'desk',
  'chair',
  'cabinet',
  'machine',
  'lab_equipment',
  'gear',
  'tool',
  'vehicle'
];

const PROP_ALIASES = {
  idea_bulb: 'lightbulb',
  bulb: 'lightbulb',
  book: 'vintage_book',
  cup: 'coffee_cup',
  mug: 'coffee_cup',
  table: 'desk',
  phone: 'smartphone',
  desktop: 'modern_computer',
  desktop_computer: 'modern_computer',
  repair_tool: 'tool',
  wrench: 'tool',
  car: 'vehicle',
  simple_vehicle: 'vehicle',
  flask: 'lab_equipment',
  box: 'cabinet'
};

function normalizePropTemplateId(templateId = 'vintage_computer') {
  const raw = String(templateId || 'vintage_computer')
    .toLowerCase()
    .replace(/^prop_/, '')
    .replace(/^req_prop_/, '')
    .replace(/^req_/, '');
  return PROP_ALIASES[raw] || raw;
}

/**
 * Generates an upgraded multi-layer procedural prop vector specification.
 */
export function generateProceduralProp(templateId = 'vintage_computer', options = {}) {
  const normId = normalizePropTemplateId(templateId);
  const width = Number(options.width) || 512;
  const height = Number(options.height) || 512;
  const seed = options.seed ?? 101;
  const rng = createRng(seed);

  const styleProfile = options.styleProfile || 'educational_cartoon';
  const theme = getStyleTheme(styleProfile);
  const lighting = resolveLightingProfile(options.lighting || options.timeOfDay || 'daylight');
  const detailLevel = String(options.detailLevel || theme.detailLevel || 'medium').toLowerCase();
  const palette = { ...theme.palette, ...(options.palette || {}) };
  const strokeColor = theme.outlineColor;
  const strokeWidth = Math.max(2, theme.outlineWidth * 0.85);

  const builder = PROP_BUILDERS[normId] || PROP_BUILDERS.vintage_computer;
  const result = builder({ width, height, palette, theme, lighting, strokeColor, strokeWidth, detailLevel, rng, options });

  const layers = (result.layers || [{ id: 'body', name: 'Thân chính', zIndex: 10, elements: result.elements }]).map((l, idx) => ({
    id: l.id,
    name: l.name,
    zIndex: l.zIndex ?? (idx + 1) * 10,
    animatableProperties: ['position', 'rotation', 'scale', 'opacity', 'color', 'visible'],
    elements: l.elements
  }));

  const fullElements = layers.map(l => ({
    type: 'group',
    id: l.id,
    children: l.elements
  }));

  const vectorSpec = {
    schemaVersion: '5.2',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    styleProfile: theme.id,
    lighting: lighting.id,
    detailLevel,
    templateId: normId,
    seed,
    palette,
    defs: result.defs || { gradients: [] },
    anchors: {
      gripPoint: result.gripPoint || { x: 0.5, y: 0.8 },
      groundContact: result.groundContact || { x: 0.5, y: 0.94 }
    },
    pivots: {
      center: result.pivot || { x: 0.5, y: 0.5 },
      bottom: result.groundContact || { x: 0.5, y: 0.94 }
    },
    layers,
    elements: fullElements
  };

  return {
    id: `prop_${normId}`,
    templateId: normId,
    type: 'prop',
    name: result.name || normId,
    styleProfile: theme.id,
    lighting: lighting.id,
    detailLevel,
    seed,
    width,
    height,
    gripPoint: vectorSpec.anchors.gripPoint,
    groundContact: vectorSpec.anchors.groundContact,
    pivot: vectorSpec.pivots.center,
    layers,
    vectorSpec,
    getSvg: () => renderToSvg(vectorSpec)
  };
}

// ============================================================================
// DETAILED MULTI-LAYER PROP BUILDERS (18 PROPS)
// ============================================================================

const PROP_BUILDERS = {
  // 1. VINTAGE COMPUTER (Body, Screen, Keyboard, Buttons, Indicator Lights, Cables, Shadow)
  vintage_computer: ({ strokeColor, strokeWidth, lighting, detailLevel }) => {
    const defs = {
      gradients: [
        { id: 'vc_chassis', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%', stops: [{ offset: 0, color: '#52525b' }, { offset: 1, color: '#27272a' }] },
        { id: 'vc_crt', type: 'linear', x1: '0%', y1: '0%', x2: '100%', y2: '100%', stops: [{ offset: 0, color: '#064e3b' }, { offset: 1, color: '#022c22' }] }
      ]
    };

    const shadow = [buildContactShadow(256, 466, 175, 16, lighting.id)];

    const body = [
      // Main chassis & top bevel highlight
      { type: 'rounded_rect', x: 64, y: 88, width: 384, height: 300, rx: 18, fill: 'url(#vc_chassis)', stroke: strokeColor, strokeWidth },
      { type: 'rounded_rect', x: 74, y: 96, width: 364, height: 12, rx: 6, fill: '#71717a', opacity: 0.5 },
      // Desk console extension
      { type: 'polygon', points: [[64, 388], [448, 388], [472, 462], [40, 462]], fill: '#3f3f46', stroke: strokeColor, strokeWidth }
    ];

    const screen = [
      { type: 'rounded_rect', x: 92, y: 118, width: 224, height: 168, rx: 14, fill: '#18181b', stroke: strokeColor, strokeWidth: 3.5 },
      { type: 'rounded_rect', x: 108, y: 134, width: 192, height: 136, rx: 10, fill: 'url(#vc_crt)', stroke: '#22c55e', strokeWidth: 2.5 },
      // Glass reflection highlight
      { type: 'polygon', points: [[116, 142], [186, 142], [140, 224], [116, 224]], fill: '#ffffff', opacity: 0.12 },
      // Waveform signal
      { type: 'polyline', points: [[124, 210], [150, 176], [176, 228], [204, 166], [234, 214], [274, 186]], stroke: '#4ade80', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' }
    ];

    const keyboard = [
      { type: 'rounded_rect', x: 84, y: 400, width: 244, height: 46, rx: 6, fill: '#18181b', stroke: strokeColor, strokeWidth: 2.5 },
      { type: 'rect', x: 96, y: 408, width: 30, height: 12, rx: 2, fill: '#d4d4d8' },
      { type: 'rect', x: 134, y: 408, width: 30, height: 12, rx: 2, fill: '#d4d4d8' },
      { type: 'rect', x: 172, y: 408, width: 30, height: 12, rx: 2, fill: '#d4d4d8' },
      { type: 'rect', x: 210, y: 408, width: 30, height: 12, rx: 2, fill: '#d4d4d8' },
      { type: 'rect', x: 248, y: 408, width: 64, height: 12, rx: 2, fill: '#eab308' },
      { type: 'rect', x: 120, y: 426, width: 172, height: 12, rx: 2, fill: '#a1a1aa' }
    ];

    const buttons = [
      // Control panel dials on right
      { type: 'rounded_rect', x: 332, y: 118, width: 92, height: 168, rx: 10, fill: '#27272a', stroke: strokeColor, strokeWidth: 3 },
      { type: 'circle', cx: 378, cy: 160, r: 22, fill: '#18181b', stroke: strokeColor, strokeWidth: 2.5 },
      { type: 'line', x1: 378, y1: 160, x2: 392, y2: 148, stroke: '#f97316', strokeWidth: 3.5, strokeLinecap: 'round' },
      { type: 'circle', cx: 378, cy: 226, r: 22, fill: '#18181b', stroke: strokeColor, strokeWidth: 2.5 },
      { type: 'line', x1: 378, y1: 226, x2: 364, y2: 214, stroke: '#38bdf8', strokeWidth: 3.5, strokeLinecap: 'round' },
      // Toggle switches
      { type: 'rounded_rect', x: 356, y: 404, width: 22, height: 34, rx: 4, fill: '#ef4444', stroke: strokeColor, strokeWidth: 2 },
      { type: 'rounded_rect', x: 390, y: 404, width: 22, height: 34, rx: 4, fill: '#22c55e', stroke: strokeColor, strokeWidth: 2 }
    ];

    const vacuumTubes = [
      { type: 'rounded_rect', x: 130, y: 44, width: 34, height: 46, rx: 14, fill: '#fef08a', stroke: strokeColor, strokeWidth: 3 },
      { type: 'rounded_rect', x: 205, y: 44, width: 34, height: 46, rx: 14, fill: '#fb923c', stroke: strokeColor, strokeWidth: 3 },
      { type: 'rounded_rect', x: 280, y: 44, width: 34, height: 46, rx: 14, fill: '#fef08a', stroke: strokeColor, strokeWidth: 3 }
    ];

    const indicatorLights = [
      { type: 'circle', cx: 116, cy: 326, r: 10, fill: '#ef4444', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 152, cy: 326, r: 10, fill: '#facc15', stroke: strokeColor, strokeWidth: 2 },
      { type: 'circle', cx: 188, cy: 326, r: 10, fill: '#22c55e', stroke: strokeColor, strokeWidth: 2 }
    ];

    const cables = detailLevel === 'low' ? [] : [
      { type: 'bezier', points: [[260, 326], [300, 360], [340, 300], [390, 330]], stroke: '#0ea5e9', strokeWidth: 5, strokeLinecap: 'round' },
      { type: 'bezier', points: [[280, 344], [320, 380], [370, 355], [410, 326]], stroke: '#f59e0b', strokeWidth: 4, strokeLinecap: 'round' }
    ];

    return {
      name: 'Máy Tính Cổ Điển (Vintage Computer)',
      defs,
      layers: [
        { id: 'shadow', name: 'Bóng Đổ (Shadow)', zIndex: 2, elements: shadow },
        { id: 'vacuum_tubes', name: 'Đèn Chân Không (Vacuum Tubes)', zIndex: 5, elements: vacuumTubes },
        { id: 'body', name: 'Thân Máy (Body)', zIndex: 10, elements: body },
        { id: 'screen', name: 'Màn Hình CRT (Screen)', zIndex: 20, elements: screen },
        { id: 'keyboard', name: 'Bàn Phím (Keyboard)', zIndex: 25, elements: keyboard },
        { id: 'buttons', name: 'Nút & Núm Xoay (Buttons)', zIndex: 30, elements: buttons },
        { id: 'indicator_lights', name: 'Đèn Báo (Indicator Lights)', zIndex: 35, elements: indicatorLights },
        { id: 'cables', name: 'Dây Cáp (Cables)', zIndex: 40, elements: cables }
      ],
      gripPoint: { x: 0.5, y: 0.85 },
      groundContact: { x: 0.5, y: 0.92 },
      pivot: { x: 0.5, y: 0.5 }
    };
  },

  // 2. ENIAC MAINFRAME
  eniac: ({ strokeColor, strokeWidth, lighting }) => ({
    name: 'Hệ Thống Mainframe ENIAC',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 468, 195, 16, lighting.id)] },
      {
        id: 'body', name: 'Tủ Máy Chính', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 52, y: 66, width: 132, height: 396, rx: 8, fill: '#27272a', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 192, y: 66, width: 128, height: 396, rx: 8, fill: '#3f3f46', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 328, y: 66, width: 132, height: 396, rx: 8, fill: '#27272a', stroke: strokeColor, strokeWidth }
        ]
      },
      {
        id: 'indicator_lights', name: 'Đèn Chân Không & Công Tắc', zIndex: 20,
        elements: [
          { type: 'circle', cx: 118, cy: 130, r: 28, fill: '#18181b', stroke: strokeColor, strokeWidth: 3 },
          { type: 'circle', cx: 394, cy: 130, r: 28, fill: '#18181b', stroke: strokeColor, strokeWidth: 3 },
          { type: 'circle', cx: 224, cy: 120, r: 10, fill: '#fb923c' },
          { type: 'circle', cx: 256, cy: 120, r: 10, fill: '#facc15' },
          { type: 'circle', cx: 288, cy: 120, r: 10, fill: '#fb923c' },
          { type: 'rect', x: 214, y: 170, width: 84, height: 64, rx: 6, fill: '#052e16', stroke: '#22c55e', strokeWidth: 2.5 }
        ]
      },
      {
        id: 'cables', name: 'Dây Cáp Nối Mạch', zIndex: 30,
        elements: [
          { type: 'bezier', points: [[118, 280], [160, 370], [220, 370], [256, 290]], stroke: '#ef4444', strokeWidth: 5 },
          { type: 'bezier', points: [[256, 290], [300, 390], [360, 380], [394, 280]], stroke: '#38bdf8', strokeWidth: 5 }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.92 }
  }),

  // 3. MODERN DESKTOP COMPUTER
  modern_computer: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Máy Tính Để Bàn Hiện Đại',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 444, 165, 14, lighting.id)] },
      {
        id: 'body', name: 'Khung Màn Hình & Chân Đế', zIndex: 10,
        elements: [
          { type: 'polygon', points: [[226, 340], [286, 340], [312, 424], [200, 424]], fill: '#64748b', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 168, y: 422, width: 176, height: 18, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 56, y: 74, width: 400, height: 270, rx: 14, fill: '#1e293b', stroke: strokeColor, strokeWidth }
        ]
      },
      {
        id: 'screen', name: 'Màn Hình Hiển Thị', zIndex: 20,
        elements: [
          { type: 'rounded_rect', x: 74, y: 92, width: 364, height: 226, rx: 8, fill: palette.screenGlow || '#0ea5e9', stroke: strokeColor, strokeWidth: 2.5 },
          { type: 'polygon', points: [[86, 104], [190, 104], [120, 260], [86, 260]], fill: '#ffffff', opacity: 0.2 }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.87 }
  }),

  // 4. LAPTOP
  laptop: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Máy Tính Xách Tay (Laptop)',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 434, 195, 14, lighting.id)] },
      {
        id: 'screen', name: 'Màn Hình', zIndex: 10,
        elements: [
          { type: 'polygon', points: [[92, 86], [420, 86], [392, 326], [120, 326]], fill: '#1e293b', stroke: strokeColor, strokeWidth },
          { type: 'polygon', points: [[114, 106], [398, 106], [374, 306], [138, 306]], fill: palette.screenGlow || '#38bdf8', stroke: strokeColor, strokeWidth: 2.5 }
        ]
      },
      {
        id: 'keyboard', name: 'Thân & Bàn Phím', zIndex: 20,
        elements: [
          { type: 'polygon', points: [[120, 326], [392, 326], [452, 428], [60, 428]], fill: '#64748b', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 212, y: 392, width: 88, height: 26, rx: 4, fill: '#334155', stroke: strokeColor, strokeWidth: 2 }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.82 },
    groundContact: { x: 0.5, y: 0.86 }
  }),

  // 5. SMARTPHONE
  smartphone: ({ palette, strokeColor, strokeWidth }) => ({
    name: 'Điện Thoại Thông Minh',
    layers: [
      {
        id: 'body', name: 'Vỏ Máy', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 156, y: 60, width: 200, height: 392, rx: 28, fill: '#1e293b', stroke: strokeColor, strokeWidth }
        ]
      },
      {
        id: 'screen', name: 'Màn Hình Cảm Ứng', zIndex: 20,
        elements: [
          { type: 'rounded_rect', x: 172, y: 84, width: 168, height: 332, rx: 18, fill: palette.screenGlow || '#38bdf8', stroke: strokeColor, strokeWidth: 2.5 },
          { type: 'rounded_rect', x: 224, y: 92, width: 64, height: 10, rx: 5, fill: '#0f172a' }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.65 },
    groundContact: { x: 0.5, y: 0.9 }
  }),

  // 6. TRANSISTOR
  transistor: ({ strokeColor, strokeWidth }) => ({
    name: 'Linh Kiện Bán Dẫn (Transistor)',
    layers: [
      {
        id: 'cables', name: 'Chân Kim Loại (Pins)', zIndex: 5,
        elements: [
          { type: 'rect', x: 178, y: 270, width: 14, height: 180, rx: 4, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rect', x: 249, y: 270, width: 14, height: 180, rx: 4, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rect', x: 320, y: 270, width: 14, height: 180, rx: 4, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3 }
        ]
      },
      {
        id: 'body', name: 'Vỏ Nhựa Bán Dẫn', zIndex: 15,
        elements: [
          { type: 'rounded_rect', x: 146, y: 110, width: 220, height: 170, rx: 26, fill: '#1e293b', stroke: strokeColor, strokeWidth },
          { type: 'ellipse', cx: 256, cy: 116, rx: 98, ry: 18, fill: '#475569', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.55 }
  }),

  // 7. MICROCHIP
  microchip: ({ strokeColor, strokeWidth }) => {
    const pins = [];
    for (let i = 0; i < 6; i++) {
      const p = 136 + i * 44;
      pins.push({ type: 'rect', x: p, y: 66, width: 16, height: 48, rx: 3, fill: '#fbbf24', stroke: strokeColor, strokeWidth: 2.5 });
      pins.push({ type: 'rect', x: p, y: 398, width: 16, height: 48, rx: 3, fill: '#fbbf24', stroke: strokeColor, strokeWidth: 2.5 });
      pins.push({ type: 'rect', x: 66, y: p, width: 48, height: 16, rx: 3, fill: '#fbbf24', stroke: strokeColor, strokeWidth: 2.5 });
      pins.push({ type: 'rect', x: 398, y: p, width: 48, height: 16, rx: 3, fill: '#fbbf24', stroke: strokeColor, strokeWidth: 2.5 });
    }
    return {
      name: 'Vi Mạch Tích Hợp (Microchip)',
      layers: [
        { id: 'cables', name: 'Chân Vàng (Gold Pins)', zIndex: 5, elements: pins },
        {
          id: 'body', name: 'Đế Chip Silicon', zIndex: 15,
          elements: [
            { type: 'rounded_rect', x: 112, y: 112, width: 288, height: 288, rx: 18, fill: '#1e293b', stroke: strokeColor, strokeWidth },
            { type: 'rounded_rect', x: 166, y: 166, width: 180, height: 180, rx: 10, fill: '#334155', stroke: '#38bdf8', strokeWidth: 3 },
            { type: 'circle', cx: 138, cy: 138, r: 10, fill: '#94a3b8' }
          ]
        }
      ]
    };
  },

  // 8. LIGHTBULB (IDEA BULB)
  lightbulb: ({ strokeColor, strokeWidth }) => ({
    name: 'Bóng Đèn Ý Tưởng (Idea Bulb)',
    defs: {
      gradients: [
        { id: 'bulb_glow', type: 'radial', cx: '50%', cy: '45%', r: '50%', stops: [{ offset: 0, color: '#fef9c3' }, { offset: 0.7, color: '#fde047' }, { offset: 1, color: '#eab308' }] }
      ]
    },
    layers: [
      {
        id: 'sparkles', name: 'Tia Sáng Ý Tưởng', zIndex: 5,
        elements: [
          { type: 'line', x1: 256, y1: 18, x2: 256, y2: 52, stroke: '#f59e0b', strokeWidth: 7, strokeLinecap: 'round' },
          { type: 'line', x1: 96, y1: 76, x2: 124, y2: 104, stroke: '#f59e0b', strokeWidth: 7, strokeLinecap: 'round' },
          { type: 'line', x1: 416, y1: 76, x2: 388, y2: 104, stroke: '#f59e0b', strokeWidth: 7, strokeLinecap: 'round' },
          { type: 'line', x1: 44, y1: 190, x2: 80, y2: 190, stroke: '#f59e0b', strokeWidth: 7, strokeLinecap: 'round' },
          { type: 'line', x1: 468, y1: 190, x2: 432, y2: 190, stroke: '#f59e0b', strokeWidth: 7, strokeLinecap: 'round' }
        ]
      },
      {
        id: 'body', name: 'Bầu Thủy Tinh & Dây Tóc', zIndex: 15,
        elements: [
          { type: 'circle', cx: 256, cy: 190, r: 118, fill: 'url(#bulb_glow)', stroke: strokeColor, strokeWidth },
          { type: 'polygon', points: [[178, 260], [334, 260], [298, 340], [214, 340]], fill: '#fde047', stroke: strokeColor, strokeWidth },
          { type: 'polyline', points: [[230, 262], [242, 182], [256, 162], [270, 182], [282, 262]], stroke: '#ffffff', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }
        ]
      },
      {
        id: 'buttons', name: 'Đui Đèn Kim Loại', zIndex: 20,
        elements: [
          { type: 'rounded_rect', x: 210, y: 340, width: 92, height: 22, rx: 6, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3.5 },
          { type: 'rounded_rect', x: 215, y: 364, width: 82, height: 20, rx: 6, fill: '#64748b', stroke: strokeColor, strokeWidth: 3.5 },
          { type: 'rounded_rect', x: 225, y: 386, width: 62, height: 18, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth: 3.5 }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.8 },
    groundContact: { x: 0.5, y: 0.92 }
  }),

  // 9. VINTAGE BOOK
  vintage_book: ({ palette, strokeColor, strokeWidth }) => ({
    name: 'Sách Nghiên Cứu',
    layers: [
      {
        id: 'body', name: 'Bìa & Trang Sách', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 110, y: 80, width: 292, height: 356, rx: 12, fill: palette.wood || '#92400e', stroke: strokeColor, strokeWidth },
          { type: 'rect', x: 110, y: 80, width: 42, height: 356, fill: '#78350f', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 184, y: 140, width: 176, height: 86, rx: 6, fill: '#fef3c7', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    gripPoint: { x: 0.25, y: 0.55 }
  }),

  // 10. COFFEE CUP
  coffee_cup: ({ strokeColor, strokeWidth, lighting }) => ({
    name: 'Cốc Cà Phê',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 412, 145, 18, lighting.id)] },
      {
        id: 'body', name: 'Thân Cốc & Quai', zIndex: 10,
        elements: [
          { type: 'ellipse', cx: 256, cy: 396, rx: 154, ry: 24, fill: '#e2e8f0', stroke: strokeColor, strokeWidth },
          { type: 'path', d: 'M 142 180 L 162 378 Q 256 408 350 378 L 370 180 Z', fill: '#f8fafc', stroke: strokeColor, strokeWidth },
          { type: 'ellipse', cx: 256, cy: 180, rx: 114, ry: 22, fill: '#78350f', stroke: strokeColor, strokeWidth: 3.5 },
          { type: 'path', d: 'M 360 212 Q 428 212 428 280 Q 428 348 342 348', stroke: strokeColor, strokeWidth: 12, strokeLinecap: 'round' }
        ]
      },
      {
        id: 'steam', name: 'Làn Khói Nóng', zIndex: 20,
        elements: [
          { type: 'bezier', points: [[220, 140], [200, 100], [235, 75], [220, 48]], stroke: '#cbd5e1', strokeWidth: 5, strokeLinecap: 'round', opacity: 0.75 },
          { type: 'bezier', points: [[280, 140], [300, 100], [265, 75], [280, 48]], stroke: '#cbd5e1', strokeWidth: 5, strokeLinecap: 'round', opacity: 0.75 }
        ]
      }
    ],
    gripPoint: { x: 0.8, y: 0.56 },
    groundContact: { x: 0.5, y: 0.86 }
  }),

  // 11. DESK / TABLE
  desk: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Bàn Làm Việc',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 444, 195, 16, lighting.id)] },
      {
        id: 'body', name: 'Mặt Bàn & Chân Bàn', zIndex: 10,
        elements: [
          { type: 'rect', x: 76, y: 210, width: 26, height: 226, fill: '#475569', stroke: strokeColor, strokeWidth },
          { type: 'rect', x: 410, y: 210, width: 26, height: 226, fill: '#475569', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 48, y: 184, width: 416, height: 32, rx: 6, fill: palette.wood || '#b45309', stroke: strokeColor, strokeWidth }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.88 }
  }),

  // 12. CHAIR
  chair: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Ghế Tựa',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 444, 110, 14, lighting.id)] },
      {
        id: 'body', name: 'Lưng Tựa, Đệm & Chân Ghế', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 162, y: 92, width: 188, height: 150, rx: 14, fill: palette.primary || '#0284c7', stroke: strokeColor, strokeWidth },
          { type: 'rect', x: 170, y: 290, width: 20, height: 148, fill: '#334155', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rect', x: 322, y: 290, width: 20, height: 148, fill: '#334155', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rounded_rect', x: 148, y: 264, width: 216, height: 34, rx: 10, fill: palette.primary || '#0284c7', stroke: strokeColor, strokeWidth }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.88 }
  }),

  // 13. CABINET
  cabinet: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Tủ Thiết Bị',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 464, 140, 14, lighting.id)] },
      {
        id: 'body', name: 'Thân Tủ & Ngăn Kéo', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 124, y: 56, width: 264, height: 400, rx: 10, fill: palette.metal || '#64748b', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 144, y: 78, width: 224, height: 106, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rounded_rect', x: 144, y: 202, width: 224, height: 106, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth: 3 },
          { type: 'rounded_rect', x: 144, y: 326, width: 224, height: 106, rx: 6, fill: '#475569', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.91 }
  }),

  // 14. MACHINE
  machine: ({ strokeColor, strokeWidth, lighting }) => ({
    name: 'Máy Móc Công Nghiệp',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 456, 175, 16, lighting.id)] },
      {
        id: 'body', name: 'Thân Máy & Đồng Hồ Đo', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 84, y: 120, width: 344, height: 326, rx: 14, fill: '#475569', stroke: strokeColor, strokeWidth },
          { type: 'circle', cx: 180, cy: 220, r: 44, fill: '#f8fafc', stroke: strokeColor, strokeWidth: 3.5 },
          { type: 'line', x1: 180, y1: 220, x2: 206, y2: 196, stroke: '#ef4444', strokeWidth: 4, strokeLinecap: 'round' },
          { type: 'rounded_rect', x: 266, y: 178, width: 124, height: 84, rx: 8, fill: '#0f172a', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.9 }
  }),

  // 15. LAB EQUIPMENT
  lab_equipment: ({ strokeColor, strokeWidth, lighting }) => ({
    name: 'Dụng Cụ Thí Nghiệm',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 444, 125, 14, lighting.id)] },
      {
        id: 'body', name: 'Bình Tam Giác & Dung Dịch', zIndex: 10,
        elements: [
          { type: 'polygon', points: [[222, 86], [290, 86], [290, 190], [380, 412], [132, 412], [222, 190]], fill: 'rgba(224, 242, 254, 0.55)', stroke: strokeColor, strokeWidth },
          { type: 'polygon', points: [[172, 316], [340, 316], [374, 408], [138, 408]], fill: '#38bdf8', opacity: 0.88 },
          { type: 'rounded_rect', x: 212, y: 74, width: 88, height: 18, rx: 6, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.3 },
    groundContact: { x: 0.5, y: 0.87 }
  }),

  // 16. GEAR
  gear: ({ strokeColor, strokeWidth }) => {
    const teeth = [];
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const cx = Math.round(256 + Math.cos(a) * 145);
      const cy = Math.round(256 + Math.sin(a) * 145);
      teeth.push({ type: 'circle', cx, cy, r: 30, fill: '#94a3b8', stroke: strokeColor, strokeWidth: 3 });
    }
    return {
      name: 'Bánh Răng Cơ Khí',
      layers: [
        {
          id: 'body', name: 'Bánh Răng', zIndex: 10,
          elements: [
            ...teeth,
            { type: 'circle', cx: 256, cy: 256, r: 132, fill: '#cbd5e1', stroke: strokeColor, strokeWidth },
            { type: 'circle', cx: 256, cy: 256, r: 48, fill: '#334155', stroke: strokeColor, strokeWidth }
          ]
        }
      ]
    };
  },

  // 17. REPAIR TOOL (WRENCH)
  tool: ({ strokeColor, strokeWidth }) => ({
    name: 'Công Cụ Sửa Chữa (Cờ Lê)',
    layers: [
      {
        id: 'body', name: 'Thân Cờ Lê', zIndex: 10,
        elements: [
          { type: 'rounded_rect', x: 224, y: 120, width: 64, height: 290, rx: 22, fill: '#94a3b8', stroke: strokeColor, strokeWidth },
          { type: 'circle', cx: 256, cy: 118, r: 66, fill: '#cbd5e1', stroke: strokeColor, strokeWidth },
          { type: 'rect', x: 234, y: 50, width: 44, height: 74, fill: '#1e293b', stroke: strokeColor, strokeWidth: 3 }
        ]
      }
    ],
    gripPoint: { x: 0.5, y: 0.68 }
  }),

  // 18. SIMPLE VEHICLE
  vehicle: ({ palette, strokeColor, strokeWidth, lighting }) => ({
    name: 'Phương Tiện (Ô Tô Đơn Giản)',
    layers: [
      { id: 'shadow', name: 'Bóng Đổ', zIndex: 2, elements: [buildContactShadow(256, 396, 200, 18, lighting.id)] },
      {
        id: 'body', name: 'Thân Xe & Cửa Kính', zIndex: 10,
        elements: [
          { type: 'polygon', points: [[120, 224], [178, 134], [342, 134], [398, 224]], fill: '#38bdf8', stroke: strokeColor, strokeWidth },
          { type: 'rounded_rect', x: 48, y: 220, width: 416, height: 112, rx: 24, fill: palette.primary || '#ef4444', stroke: strokeColor, strokeWidth },
          { type: 'circle', cx: 136, cy: 336, r: 52, fill: '#1e293b', stroke: strokeColor, strokeWidth },
          { type: 'circle', cx: 136, cy: 336, r: 22, fill: '#cbd5e1' },
          { type: 'circle', cx: 376, cy: 336, r: 52, fill: '#1e293b', stroke: strokeColor, strokeWidth },
          { type: 'circle', cx: 376, cy: 336, r: 22, fill: '#cbd5e1' }
        ]
      }
    ],
    groundContact: { x: 0.5, y: 0.78 }
  })
};
