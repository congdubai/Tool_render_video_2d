// engine/v5-procedural-backgrounds.js — Advanced Procedural Background Generator (V5.2 Phase 2)
// Pure JS (Node + Browser Canvas 2D compatible).
// Features: 8 Visual Styles, 8 Lighting Modes (strict Night vs Day), Perspective & Depth,
// Detail Levels (low/medium/high), Seeded Variations, and Independent Animatable Layers.

import {
  getStyleTheme,
  resolveLightingProfile,
  applyTimeOfDay,
  computePerspectiveLayout,
  computeDepthScale,
  buildContactShadow,
  createRng
} from './v5-style-engine.js';
import { renderToSvg } from './v5-vector-canvas.js';

export const BACKGROUND_CATEGORIES = {
  INDOOR: [
    'lab_modern', 'office', 'living_room', 'bedroom', 'classroom',
    'hospital', 'factory', 'warehouse', 'cafe', 'store', 'workshop'
  ],
  OUTDOOR: [
    'street', 'city', 'park', 'forest', 'mountain',
    'beach', 'desert', 'countryside', 'construction'
  ],
  HISTORICAL: [
    'vintage_computer_room', 'inventor_workshop', 'industrial_factory', 'vintage_lab'
  ],
  SCIENTIFIC: [
    'research_center', 'control_room', 'space_station',
    'physics_lab', 'chemistry_lab', 'inside_machine'
  ]
};

export const ALL_BACKGROUND_TEMPLATES = Object.values(BACKGROUND_CATEGORIES).flat();

const TEMPLATE_ALIASES = {
  modern_lab: 'lab_modern',
  background_laboratory: 'lab_modern',
  laboratory: 'lab_modern',
  city_street: 'street',
  urban_street: 'street',
  night_street: 'street',
  repair_workshop: 'workshop',
  eniac_room: 'vintage_computer_room'
};

function normalizeTemplateId(templateId = 'lab_modern') {
  const raw = String(templateId || 'lab_modern').toLowerCase().replace(/^bg_/, '').replace(/^req_bg_/, '');
  return TEMPLATE_ALIASES[raw] || raw;
}

/**
 * Builds an upgraded multi-layer procedural background vector specification.
 */
export function generateProceduralBackground(templateId = 'lab_modern', options = {}) {
  const normId = normalizeTemplateId(templateId);
  const width = Number(options.width) || 1920;
  const height = Number(options.height) || 1080;
  const seed = options.seed ?? 42;
  const rng = createRng(seed);

  const styleProfile = options.styleProfile || 'educational_cartoon';
  const theme = getStyleTheme(styleProfile);
  const lightingId = options.lighting || options.timeOfDay || 'daylight';
  const lighting = resolveLightingProfile(lightingId);
  const palette = {
    ...applyTimeOfDay(theme.palette, lighting.id),
    ...(options.palette || {})
  };
  const detailLevel = String(options.detailLevel || theme.detailLevel || 'medium').toLowerCase();
  const perspective = computePerspectiveLayout(width, height, {
    perspective: options.perspective || theme.perspectiveRules?.mode || 'one_point',
    horizonRatio: theme.perspectiveRules?.horizonRatio ?? 0.56,
    groundLevel: options.groundLevel ?? 0.78
  });

  const ctx = {
    width,
    height,
    groundY: perspective.groundY,
    horizonY: perspective.horizonY,
    vp: perspective.vanishingPoint,
    perspective,
    palette,
    theme,
    lighting,
    strokeColor: theme.outlineColor,
    strokeWidth: Math.max(2, theme.outlineWidth * 0.85),
    cornerRadius: theme.cornerRadius,
    detailLevel,
    rng,
    options
  };

  let built;
  if (normId === 'lab_modern' || normId === 'research_center' || normId === 'physics_lab' || normId === 'chemistry_lab') {
    built = buildModernLab(ctx, normId);
  } else if (normId === 'street' || normId === 'city') {
    built = buildUrbanStreet(ctx, normId);
  } else if (normId === 'vintage_lab' || normId === 'vintage_computer_room' || normId === 'inventor_workshop') {
    built = buildHistoricalTechRoom(ctx, normId);
  } else if (BACKGROUND_CATEGORIES.OUTDOOR.includes(normId)) {
    built = buildOutdoorEnvironment(ctx, normId);
  } else {
    built = buildIndoorEnvironment(ctx, normId);
  }

  // Optional subtle atmospheric ambient wash (never used alone to fake night!)
  const layers = built.layers.map((l, idx) => ({
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
    defs: built.defs || { gradients: [], clipPaths: [], patterns: [] },
    perspective: {
      mode: perspective.mode,
      horizonY: perspective.horizonY,
      groundY: perspective.groundY,
      vanishingPoint: perspective.vanishingPoint
    },
    placementZones: built.placementZones || {
      characterZone: { xMin: 0.16, xMax: 0.56, groundY: perspective.groundY / height },
      propZone: { xMin: 0.58, xMax: 0.86, groundY: perspective.groundY / height }
    },
    layers: layers.map(({ id, name, zIndex, animatableProperties, elements }) => ({ id, name, zIndex, animatableProperties, elements })),
    elements: fullElements
  };

  return {
    id: `bg_${normId}`,
    templateId: normId,
    type: 'background',
    name: getBackgroundTitle(normId),
    styleProfile: theme.id,
    lighting: lighting.id,
    detailLevel,
    seed,
    width,
    height,
    groundY: perspective.groundY,
    perspective: vectorSpec.perspective,
    placementZones: vectorSpec.placementZones,
    layers,
    vectorSpec,
    getSvg: () => renderToSvg(vectorSpec)
  };
}

function getBackgroundTitle(id) {
  const map = {
    lab_modern: 'Phòng Thí Nghiệm Hiện Đại (Modern Lab)',
    office: 'Văn Phòng Làm Việc (Office)',
    living_room: 'Phòng Khách (Living Room)',
    bedroom: 'Phòng Ngủ (Bedroom)',
    classroom: 'Lớp Học (Classroom)',
    hospital: 'Bệnh Viện (Hospital)',
    factory: 'Nhà Máy Sản Xuất (Factory)',
    warehouse: 'Nhà Kho (Warehouse)',
    cafe: 'Quán Cà Phê (Cafe)',
    store: 'Cửa Hàng (Store)',
    workshop: 'Xưởng Sửa Chữa (Repair Workshop)',
    street: 'Đường Phố Thành Thị (Street)',
    city: 'Trung Tâm Thành Phố (City)',
    park: 'Công Viên (Park)',
    forest: 'Rừng Cây (Forest)',
    mountain: 'Vùng Núi (Mountain)',
    beach: 'Bãi Biển (Beach)',
    desert: 'Sa Mạc (Desert)',
    countryside: 'Đồng Quê (Countryside)',
    construction: 'Công Trường (Construction)',
    vintage_computer_room: 'Phòng Máy Tính Cổ ENIAC',
    inventor_workshop: 'Xưởng Phát Minh Cổ Điển',
    industrial_factory: 'Nhà Máy Thời Kỳ Công Nghiệp',
    research_center: 'Trung Tâm Nghiên Cứu',
    control_room: 'Phòng Điều Khiển',
    space_station: 'Trạm Không Gian',
    vintage_lab: 'Phòng Thí Nghiệm Cổ Điển',
    physics_lab: 'Phòng Thí Nghiệm Vật Lý',
    chemistry_lab: 'Phòng Thí Nghiệm Hóa Học',
    inside_machine: 'Bên Trong Cỗ Máy'
  };
  return map[id] || `Bối cảnh ${id}`;
}

// ============================================================================
// 1. PRIORITY INDOOR GENERATOR: MODERN RESEARCH LABORATORY
// ============================================================================

function buildModernLab(ctx, variantId) {
  const { width: W, height: H, groundY, horizonY, vp, palette, lighting, strokeColor, strokeWidth, detailLevel, rng } = ctx;
  const isNightOrCool = lighting.id === 'night' || lighting.id === 'indoor_cool';
  const wallTopCol = isNightOrCool ? '#0f172a' : (lighting.id === 'indoor_warm' ? '#292524' : palette.wall);
  const wallBotCol = isNightOrCool ? '#1e293b' : (lighting.id === 'indoor_warm' ? '#44403c' : '#cbd5e1');
  const floorTopCol = isNightOrCool ? '#1e293b' : '#475569';
  const floorBotCol = isNightOrCool ? '#090d16' : '#334155';

  const defs = {
    gradients: [
      { id: 'lab_wall_grad', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%', stops: [{ offset: 0, color: wallTopCol }, { offset: 1, color: wallBotCol }] },
      { id: 'lab_floor_grad', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%', stops: [{ offset: 0, color: floorTopCol }, { offset: 1, color: floorBotCol }] },
      { id: 'lab_sky_win', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%', stops: [{ offset: 0, color: lighting.skyTop }, { offset: 1, color: lighting.skyBottom }] },
      { id: 'lab_lamp_cone', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%', stops: [{ offset: 0, color: lighting.highlightColor, opacity: 0.25 }, { offset: 1, color: lighting.highlightColor, opacity: 0.0 }] }
    ]
  };

  // Layer 1: Walls, Ceiling Trim & Perspective Floor
  const wallFloor = [
    { type: 'rect', x: 0, y: 0, width: W, height: groundY, fill: 'url(#lab_wall_grad)' },
    // Upper ceiling bulkhead
    { type: 'rect', x: 0, y: 0, width: W, height: Math.round(H * 0.065), fill: '#0f172a', stroke: strokeColor, strokeWidth: 3 },
    // Baseboard trim
    { type: 'rect', x: 0, y: groundY - 22, width: W, height: 22, fill: '#334155', stroke: strokeColor, strokeWidth: 2 },
    // Ground plane
    { type: 'rect', x: 0, y: groundY, width: W, height: H - groundY, fill: 'url(#lab_floor_grad)', stroke: strokeColor, strokeWidth }
  ];

  // One-point perspective floor lines converging toward vanishing point
  const tileCount = detailLevel === 'low' ? 4 : 8;
  for (let i = 0; i <= tileCount; i++) {
    const bx = Math.round((i / tileCount) * W);
    const tx = Math.round(vp[0] + (bx - vp[0]) * 0.62);
    wallFloor.push({ type: 'line', x1: tx, y1: groundY, x2: bx, y2: H, stroke: 'rgba(56, 189, 248, 0.22)', strokeWidth: 2 });
  }
  if (detailLevel !== 'low') {
    wallFloor.push({ type: 'line', x1: 0, y1: groundY + Math.round((H - groundY) * 0.35), x2: W, y2: groundY + Math.round((H - groundY) * 0.35), stroke: 'rgba(56, 189, 248, 0.18)', strokeWidth: 2 });
    wallFloor.push({ type: 'line', x1: 0, y1: groundY + Math.round((H - groundY) * 0.72), x2: W, y2: groundY + Math.round((H - groundY) * 0.72), stroke: 'rgba(56, 189, 248, 0.18)', strokeWidth: 2 });
  }

  // Layer 2: Panoramic Window & Lab Door (back wall depth)
  const windowDoor = [
    // Left Lab Door
    { type: 'rounded_rect', x: Math.round(W * 0.05), y: Math.round(groundY - H * 0.44), width: Math.round(W * 0.10), height: Math.round(H * 0.44), rx: 8, fill: '#334155', stroke: strokeColor, strokeWidth },
    { type: 'rounded_rect', x: Math.round(W * 0.072), y: Math.round(groundY - H * 0.39), width: Math.round(W * 0.056), height: Math.round(H * 0.15), rx: 6, fill: lighting.windowColor, stroke: strokeColor, strokeWidth: 3 },
    { type: 'circle', cx: Math.round(W * 0.135), cy: Math.round(groundY - H * 0.20), r: 6, fill: '#cbd5e1', stroke: strokeColor, strokeWidth: 2 },

    // Center-Left Panoramic Window showing real outdoor lighting (sky + moon/sun)
    { type: 'rounded_rect', x: Math.round(W * 0.22), y: Math.round(H * 0.13), width: Math.round(W * 0.34), height: Math.round(H * 0.28), rx: 12, fill: 'url(#lab_sky_win)', stroke: strokeColor, strokeWidth },
    ...(lighting.hasMoon ? [{ type: 'circle', cx: Math.round(W * 0.49), cy: Math.round(H * 0.20), r: 20, fill: '#f8fafc', opacity: 0.9 }] : []),
    ...(lighting.hasSun ? [{ type: 'circle', cx: Math.round(W * 0.49), cy: Math.round(H * 0.20), r: 24, fill: lighting.sunColor, opacity: 0.9 }] : []),
    // Window mullions
    { type: 'line', x1: Math.round(W * 0.39), y1: Math.round(H * 0.13), x2: Math.round(W * 0.39), y2: Math.round(H * 0.41), stroke: strokeColor, strokeWidth: 4 },
    { type: 'line', x1: Math.round(W * 0.22), y1: Math.round(H * 0.27), x2: Math.round(W * 0.56), y2: Math.round(H * 0.27), stroke: strokeColor, strokeWidth: 3 }
  ];

  // Layer 3: Equipment Cabinets, Shelves & Lab Workbench (leaving clean center-left acting stage!)
  const benchX = Math.round(W * 0.58);
  const benchW = Math.round(W * 0.35);
  const benchH = Math.round(H * 0.16);
  const benchY = groundY - benchH;

  const furnitureCabinets = [
    // Right Tall Server / Instrument Cabinet with Contact Shadow
    buildContactShadow(W * 0.89, groundY, W * 0.08, 12, lighting.id),
    { type: 'rounded_rect', x: Math.round(W * 0.83), y: Math.round(groundY - H * 0.52), width: Math.round(W * 0.13), height: Math.round(H * 0.52), rx: 10, fill: '#1e293b', stroke: strokeColor, strokeWidth },
    { type: 'rounded_rect', x: Math.round(W * 0.845), y: Math.round(groundY - H * 0.49), width: Math.round(W * 0.10), height: Math.round(H * 0.18), rx: 6, fill: '#0f172a', stroke: palette.primary, strokeWidth: 2 },
    // Rack LEDs
    { type: 'circle', cx: Math.round(W * 0.865), cy: Math.round(groundY - H * 0.45), r: 5, fill: '#22c55e' },
    { type: 'circle', cx: Math.round(W * 0.885), cy: Math.round(groundY - H * 0.45), r: 5, fill: '#38bdf8' },
    { type: 'circle', cx: Math.round(W * 0.905), cy: Math.round(groundY - H * 0.45), r: 5, fill: '#facc15' },

    // Wall Shelf above workbench
    { type: 'rounded_rect', x: Math.round(W * 0.60), y: Math.round(H * 0.21), width: Math.round(W * 0.19), height: 14, rx: 4, fill: palette.metal, stroke: strokeColor, strokeWidth: 3 },

    // Main Lab Workbench (Center-Right, keeps x: 0.16..0.55 open for characters)
    buildContactShadow(benchX + benchW / 2, groundY, benchW * 0.52, 14, lighting.id),
    { type: 'rounded_rect', x: benchX + 18, y: benchY + 18, width: benchW - 36, height: benchH - 18, rx: 6, fill: '#334155', stroke: strokeColor, strokeWidth },
    // Drawer fronts
    { type: 'rounded_rect', x: benchX + 36, y: benchY + 34, width: Math.round(benchW * 0.38), height: Math.round(benchH * 0.34), rx: 4, fill: '#475569', stroke: strokeColor, strokeWidth: 2 },
    { type: 'rounded_rect', x: benchX + Math.round(benchW * 0.50), y: benchY + 34, width: Math.round(benchW * 0.38), height: Math.round(benchH * 0.34), rx: 4, fill: '#475569', stroke: strokeColor, strokeWidth: 2 },
    // Bench Countertop
    { type: 'rounded_rect', x: benchX, y: benchY, width: benchW, height: 22, rx: 6, fill: '#94a3b8', stroke: strokeColor, strokeWidth }
  ];

  // Layer 4: Lab Instruments, Monitors, Flasks, Cables (Detail-level aware)
  const equipmentCables = [
    // Shelf glassware
    { type: 'polygon', points: [[Math.round(W * 0.63), Math.round(H * 0.21)], [Math.round(W * 0.66), Math.round(H * 0.21)], [Math.round(W * 0.65), Math.round(H * 0.16)], [Math.round(W * 0.64), Math.round(H * 0.16)]], fill: '#38bdf8', stroke: strokeColor, strokeWidth: 2.5 },
    { type: 'circle', cx: Math.round(W * 0.70), cy: Math.round(H * 0.185), r: 16, fill: '#22c55e', opacity: 0.85, stroke: strokeColor, strokeWidth: 2.5 },
    { type: 'rect', x: Math.round(W * 0.74), y: Math.round(H * 0.155), width: 22, height: 55, rx: 4, fill: '#f59e0b', stroke: strokeColor, strokeWidth: 2.5 },

    // Wall data monitor
    { type: 'rounded_rect', x: Math.round(W * 0.60), y: Math.round(H * 0.29), width: Math.round(W * 0.19), height: Math.round(H * 0.18), rx: 8, fill: '#0f172a', stroke: strokeColor, strokeWidth: 3.5 },
    { type: 'polyline', points: [[Math.round(W * 0.62), Math.round(H * 0.40)], [Math.round(W * 0.66), Math.round(H * 0.35)], [Math.round(W * 0.70), Math.round(H * 0.42)], [Math.round(W * 0.76), Math.round(H * 0.33)]], stroke: palette.screenGlow, strokeWidth: 3.5 }
  ];

  if (detailLevel !== 'low') {
    // Curved power cables connecting bench to cabinet
    equipmentCables.push({
      type: 'bezier',
      points: [[benchX + benchW - 20, benchY + 60], [benchX + benchW + 40, benchY + 120], [Math.round(W * 0.80), groundY - 20], [Math.round(W * 0.83), groundY - 50]],
      stroke: '#0ea5e9',
      strokeWidth: 4,
      strokeLinecap: 'round'
    });
    if (detailLevel === 'high') {
      equipmentCables.push({
        type: 'bezier',
        points: [[benchX + benchW - 20, benchY + 80], [benchX + benchW + 25, benchY + 140], [Math.round(W * 0.81), groundY - 10], [Math.round(W * 0.83), groundY - 30]],
        stroke: '#f59e0b',
        strokeWidth: 3.5,
        strokeLinecap: 'round'
      });
      // Beaker on left edge of workbench
      equipmentCables.push({
        type: 'polygon',
        points: [[benchX + 26, benchY], [benchX + 58, benchY], [benchX + 49, benchY - 42], [benchX + 35, benchY - 42]],
        fill: '#38bdf8',
        opacity: 0.8,
        stroke: strokeColor,
        strokeWidth: 2.5
      });
    }
  }

  // Layer 5: Overhead Lighting Fixtures & Soft Light Cones
  const lightingLamps = [
    { type: 'line', x1: Math.round(W * 0.36), y1: Math.round(H * 0.065), x2: Math.round(W * 0.36), y2: Math.round(H * 0.095), stroke: strokeColor, strokeWidth: 3 },
    { type: 'line', x1: Math.round(W * 0.64), y1: Math.round(H * 0.065), x2: Math.round(W * 0.64), y2: Math.round(H * 0.095), stroke: strokeColor, strokeWidth: 3 },
    { type: 'rounded_rect', x: Math.round(W * 0.32), y: Math.round(H * 0.09), width: Math.round(W * 0.36), height: 18, rx: 6, fill: lighting.highlightColor, stroke: strokeColor, strokeWidth: 3 },
    { type: 'polygon', points: [[Math.round(W * 0.33), Math.round(H * 0.108)], [Math.round(W * 0.67), Math.round(H * 0.108)], [Math.round(W * 0.82), groundY], [Math.round(W * 0.18), groundY]], fill: 'url(#lab_lamp_cone)', opacity: isNightOrCool ? 0.55 : 0.25 }
  ];

  return {
    defs,
    layers: [
      { id: 'layer_background', name: 'Tường & Sàn Phối Cảnh', zIndex: 10, elements: wallFloor },
      { id: 'window_door', name: 'Cửa Sổ & Cửa Ra Vào', zIndex: 15, elements: windowDoor },
      { id: 'layer_midground', name: 'Bàn Thí Nghiệm & Tủ Thiết Bị', zIndex: 20, elements: furnitureCabinets },
      { id: 'equipment_cables', name: 'Thiết Bị, Dụng Cụ & Dây Điện', zIndex: 25, elements: equipmentCables },
      { id: 'layer_foreground', name: 'Đèn Trần & Ánh Sáng', zIndex: 30, elements: lightingLamps }
    ],
    placementZones: {
      characterZone: { xMin: 0.18, xMax: 0.52, groundY: groundY / H },
      workbenchZone: { x: (benchX + benchW * 0.5) / W, y: benchY / H }
    }
  };
}

// ============================================================================
// 2. PRIORITY OUTDOOR GENERATOR: URBAN STREET (DEPTH, VARIED BUILDINGS, NIGHT/DAY)
// ============================================================================

function buildUrbanStreet(ctx) {
  const { width: W, height: H, groundY, horizonY, palette, lighting, strokeColor, strokeWidth, detailLevel, rng } = ctx;
  const sidewalkTop = Math.round(groundY - H * 0.13);
  const curbY = groundY;
  const roadTop = curbY + 14;
  const isNight = lighting.id === 'night';
  const isSunset = lighting.id === 'sunset';

  const defs = {
    gradients: [
      {
        id: 'street_sky_grad', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%',
        stops: [
          { offset: 0, color: lighting.skyTop },
          { offset: 0.58, color: lighting.skyMid },
          { offset: 1, color: lighting.skyBottom }
        ]
      },
      {
        id: 'street_lamp_glow', type: 'radial', cx: '50%', cy: '30%', r: '60%',
        stops: [
          { offset: 0, color: lighting.streetLightColor, opacity: isNight ? 0.58 : 0.25 },
          { offset: 1, color: lighting.streetLightColor, opacity: 0.0 }
        ]
      },
      {
        id: 'street_road_grad', type: 'linear', x1: '0%', y1: '0%', x2: '0%', y2: '100%',
        stops: [
          { offset: 0, color: isNight ? '#1e293b' : '#334155' },
          { offset: 1, color: isNight ? '#090d16' : '#1e293b' }
        ]
      }
    ]
  };

  // Layer 1: Sky + Celestial Bodies (Strict: NO Sun at Night!)
  const sky = [
    { type: 'rect', x: 0, y: 0, width: W, height: sidewalkTop + 40, fill: 'url(#street_sky_grad)' }
  ];

  if (lighting.hasStars) {
    const starCount = detailLevel === 'low' ? 14 : (detailLevel === 'high' ? 42 : 26);
    for (let i = 0; i < starCount; i++) {
      sky.push({
        type: 'circle',
        cx: Math.round(rng() * W),
        cy: Math.round(rng() * (horizonY * 0.72)),
        r: rng() > 0.7 ? 2.8 : 1.6,
        fill: '#f8fafc',
        opacity: 0.45 + rng() * 0.5
      });
    }
  }
  if (lighting.hasMoon) {
    const mx = Math.round(W * 0.82), my = Math.round(H * 0.14);
    sky.push({ type: 'circle', cx: mx, cy: my, r: 52, fill: 'rgba(248, 250, 252, 0.16)' });
    sky.push({ type: 'circle', cx: mx, cy: my, r: 34, fill: lighting.moonColor || '#f8fafc' });
    sky.push({ type: 'circle', cx: mx - 10, cy: my - 8, r: 6, fill: '#cbd5e1', opacity: 0.45 });
  }
  if (lighting.hasSun) {
    const sx = Math.round(W * 0.82), sy = Math.round(H * (lighting.sunYRatio || 0.15));
    sky.push({ type: 'circle', cx: sx, cy: sy, r: 62, fill: lighting.sunColor, opacity: 0.22 });
    sky.push({ type: 'circle', cx: sx, cy: sy, r: 42, fill: lighting.sunColor });
  }
  // Soft clouds (darker at night/sunset)
  const cloudCol = isNight ? '#1e293b' : (isSunset ? '#fda4af' : '#ffffff');
  const cloudOp = isNight ? 0.35 : 0.85;
  for (const [cx, cy, cr] of [[W * 0.16, H * 0.14, 34], [W * 0.46, H * 0.11, 30], [W * 0.68, H * 0.17, 28]]) {
    sky.push({ type: 'circle', cx: Math.round(cx), cy: Math.round(cy), r: cr, fill: cloudCol, opacity: cloudOp });
    sky.push({ type: 'circle', cx: Math.round(cx + cr * 0.85), cy: Math.round(cy - 6), r: Math.round(cr * 0.82), fill: cloudCol, opacity: cloudOp });
    sky.push({ type: 'circle', cx: Math.round(cx + cr * 1.6), cy: Math.round(cy + 2), r: Math.round(cr * 0.7), fill: cloudCol, opacity: cloudOp });
  }

  // Layer 2: Distant Buildings Silhouette (Atmospheric depth)
  const distantBuildings = [];
  const distCol = isNight ? '#0f172a' : (isSunset ? '#4c1d95' : '#64748b');
  let dx = 0;
  while (dx < W) {
    const bw = Math.round(90 + rng() * 110);
    const bh = Math.round(H * (0.22 + rng() * 0.24));
    distantBuildings.push({
      type: 'rect',
      x: dx,
      y: sidewalkTop - bh,
      width: bw - 6,
      height: bh + 20,
      fill: distCol,
      opacity: 0.72
    });
    dx += bw;
  }

  // Layer 3: Near Buildings (Seeded height, width, color, roof, windows, doors, shop signs)
  const nearBuildings = [];
  const dayPalette = ['#e07a5f', '#f4a261', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24'];
  const nightPalette = ['#1e293b', '#312e81', '#1f2937', '#334155', '#1e1b4b', '#27272a'];
  const bColors = isNight ? nightPalette : dayPalette;

  let bx = 24;
  let bIdx = 0;
  while (bx < W - 80) {
    const bw = Math.round(180 + rng() * 120);
    const bh = Math.round(H * (0.34 + rng() * 0.20));
    const bTop = sidewalkTop - bh;
    const bCol = bColors[Math.floor(rng() * bColors.length)];
    const hasSlantedRoof = bIdx % 2 === 0;

    // Building facade
    nearBuildings.push({
      type: 'rounded_rect',
      x: bx,
      y: bTop,
      width: bw,
      height: bh,
      rx: 4,
      fill: bCol,
      stroke: strokeColor,
      strokeWidth
    });

    // Roof / Cornice
    if (hasSlantedRoof) {
      nearBuildings.push({
        type: 'polygon',
        points: [[bx - 8, bTop], [bx + bw / 2, bTop - 38], [bx + bw + 8, bTop]],
        fill: isNight ? '#090d16' : '#475569',
        stroke: strokeColor,
        strokeWidth: 3
      });
    } else {
      nearBuildings.push({
        type: 'rect',
        x: bx - 6,
        y: bTop - 12,
        width: bw + 12,
        height: 14,
        fill: isNight ? '#0f172a' : '#334155',
        stroke: strokeColor,
        strokeWidth: 2.5
      });
    }

    // Seeded Windows (glowing warm yellow at night!)
    const cols = Math.max(2, Math.floor((bw - 36) / 48));
    const rows = Math.max(2, Math.floor((bh - 95) / 56));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bx + 22 + c * Math.floor((bw - 44) / cols);
        const wy = bTop + 26 + r * 54;
        const lit = isNight ? rng() > 0.28 : false;
        const winFill = lit ? '#fde047' : (isNight ? '#090d16' : '#bae6fd');
        nearBuildings.push({
          type: 'rounded_rect',
          x: wx,
          y: wy,
          width: 28,
          height: 36,
          rx: 4,
          fill: winFill,
          stroke: strokeColor,
          strokeWidth: 2.5
        });
      }
    }

    // Ground-floor Door & Shop Sign
    const doorX = bx + Math.round(bw * 0.16);
    nearBuildings.push({
      type: 'rounded_rect',
      x: doorX,
      y: sidewalkTop - 68,
      width: 44,
      height: 68,
      rx: 4,
      fill: isNight ? '#0f172a' : '#78350f',
      stroke: strokeColor,
      strokeWidth: 3
    });
    if (detailLevel !== 'low') {
      nearBuildings.push({
        type: 'rounded_rect',
        x: bx + Math.round(bw * 0.45),
        y: sidewalkTop - 76,
        width: Math.round(bw * 0.42),
        height: 28,
        rx: 5,
        fill: isNight ? '#0284c7' : '#facc15',
        stroke: strokeColor,
        strokeWidth: 2.5
      });
    }

    bx += bw + Math.round(22 + rng() * 28);
    bIdx++;
  }

  // Layer 4: Sidewalk & Curb
  const sidewalk = [
    { type: 'rect', x: 0, y: sidewalkTop, width: W, height: curbY - sidewalkTop, fill: isNight ? '#475569' : '#cbd5e1', stroke: strokeColor, strokeWidth: 3 },
    { type: 'rect', x: 0, y: curbY, width: W, height: 16, fill: isNight ? '#334155' : '#94a3b8', stroke: strokeColor, strokeWidth: 2.5 }
  ];
  if (detailLevel !== 'low') {
    for (let sx = 120; sx < W; sx += 180) {
      sidewalk.push({ type: 'line', x1: sx, y1: sidewalkTop, x2: sx - 32, y2: curbY, stroke: 'rgba(15,23,42,0.22)', strokeWidth: 2 });
    }
  }

  // Layer 5: Road & Perspective Markings
  const road = [
    { type: 'rect', x: 0, y: roadTop, width: W, height: H - roadTop, fill: 'url(#street_road_grad)' }
  ];
  const laneY = Math.round(roadTop + (H - roadTop) * 0.48);
  for (let rx = 40; rx < W; rx += 150) {
    road.push({ type: 'rounded_rect', x: rx, y: laneY, width: 86, height: 12, rx: 4, fill: '#facc15', opacity: isNight ? 0.82 : 0.95 });
  }

  // Layer 6: Trees with Depth Scaling & Contact Shadows
  const trees = [];
  const treeXs = [Math.round(W * 0.12), Math.round(W * 0.72), Math.round(W * 0.91)];
  for (const tx of treeXs) {
    trees.push(buildContactShadow(tx, groundY - 8, 46, 10, lighting.id));
    trees.push({ type: 'rounded_rect', x: tx - 10, y: groundY - 125, width: 20, height: 118, rx: 5, fill: isNight ? '#3f2e21' : '#78350f', stroke: strokeColor, strokeWidth: 3 });
    const leafCol = isNight ? '#14532d' : '#16a34a';
    const leafHi = isNight ? '#166534' : '#22c55e';
    trees.push({ type: 'circle', cx: tx, cy: groundY - 155, r: 52, fill: leafCol, stroke: strokeColor, strokeWidth: 3.5 });
    trees.push({ type: 'circle', cx: tx - 26, cy: groundY - 135, r: 34, fill: leafCol, stroke: strokeColor, strokeWidth: 3 });
    trees.push({ type: 'circle', cx: tx + 26, cy: groundY - 135, r: 34, fill: leafHi, stroke: strokeColor, strokeWidth: 3 });
  }

  // Layer 7: Streetlights (Glow cones ON at Night/Sunset, OFF in Daylight!)
  const streetlights = [];
  const lampXs = [Math.round(W * 0.22), Math.round(W * 0.56), Math.round(W * 0.84)];
  for (const lx of lampXs) {
    const postTop = Math.round(H * 0.34);
    const armDir = lx < W * 0.5 ? 1 : -1;
    const bulbX = lx + armDir * 52;
    const bulbY = postTop + 14;

    if (lighting.streetLightOn) {
      // Soft radial halo + downward light cone
      streetlights.push({
        type: 'polygon',
        points: [[bulbX - 18, bulbY], [bulbX + 18, bulbY], [bulbX + 130, groundY + 20], [bulbX - 130, groundY + 20]],
        fill: 'url(#street_lamp_glow)',
        opacity: isNight ? 0.72 : 0.35
      });
      streetlights.push({ type: 'circle', cx: bulbX, cy: bulbY, r: 44, fill: lighting.streetLightColor, opacity: 0.24 });
    }

    streetlights.push({ type: 'rect', x: lx - 8, y: groundY - 26, width: 16, height: 22, fill: '#1e293b', stroke: strokeColor, strokeWidth: 2.5 });
    streetlights.push({ type: 'polyline', points: [[lx, groundY - 26], [lx, postTop], [bulbX, postTop]], stroke: '#1e293b', strokeWidth: 9, strokeLinecap: 'round', strokeLinejoin: 'round' });
    streetlights.push({
      type: 'circle',
      cx: bulbX,
      cy: bulbY,
      r: 13,
      fill: lighting.streetLightOn ? '#fef08a' : '#cbd5e1',
      stroke: strokeColor,
      strokeWidth: 2.5
    });
  }

  // Layer 8: Foreground depth framing (subtle blurred curb/hydrant or bollard)
  const foreground = detailLevel === 'high' ? [
    buildContactShadow(W * 0.05, groundY + 18, 22, 6, lighting.id),
    { type: 'rounded_rect', x: Math.round(W * 0.045), y: groundY - 34, width: 18, height: 52, rx: 6, fill: '#ef4444', stroke: strokeColor, strokeWidth: 3 }
  ] : [];

  return {
    defs,
    layers: [
      { id: 'sky', name: 'Bầu Trời (Sky & Sun/Moon)', zIndex: 5, elements: sky },
      { id: 'distant_buildings', name: 'Tòa Nhà Xa (Distant Skyline)', zIndex: 10, elements: distantBuildings },
      { id: 'near_buildings', name: 'Tòa Nhà Gần (Near Buildings)', zIndex: 15, elements: nearBuildings },
      { id: 'sidewalk', name: 'Vỉa Hè (Sidewalk)', zIndex: 20, elements: sidewalk },
      { id: 'road', name: 'Mặt Đường (Road & Lanes)', zIndex: 22, elements: road },
      { id: 'trees', name: 'Cây Xanh (Trees)', zIndex: 25, elements: trees },
      { id: 'streetlights', name: 'Đèn Đường (Streetlights)', zIndex: 28, elements: streetlights },
      { id: 'foreground', name: 'Tiền Cảnh (Foreground)', zIndex: 35, elements: foreground }
    ],
    placementZones: {
      characterZone: { xMin: 0.24, xMax: 0.74, groundY: (groundY - 4) / H }
    }
  };
}

// ============================================================================
// 3. HISTORICAL & SCIENTIFIC ROOMS
// ============================================================================

function buildHistoricalTechRoom(ctx, normId) {
  const { width: W, height: H, groundY, lighting, strokeColor, strokeWidth } = ctx;
  const wallCol = lighting.id === 'night' ? '#1c1917' : '#57534e';
  const floorCol = lighting.id === 'night' ? '#292524' : '#78350f';

  const wallFloor = [
    { type: 'rect', x: 0, y: 0, width: W, height: groundY, fill: wallCol },
    { type: 'line', x1: 0, y1: Math.round(H * 0.36), x2: W, y2: Math.round(H * 0.36), stroke: '#44403c', strokeWidth: 4 },
    { type: 'rect', x: 0, y: groundY, width: W, height: H - groundY, fill: floorCol, stroke: strokeColor, strokeWidth }
  ];

  const windowDoor = [
    { type: 'rounded_rect', x: Math.round(W * 0.36), y: Math.round(H * 0.1), width: Math.round(W * 0.28), height: Math.round(H * 0.44), rx: 36, fill: lighting.windowColor, stroke: strokeColor, strokeWidth },
    { type: 'line', x1: Math.round(W * 0.5), y1: Math.round(H * 0.1), x2: Math.round(W * 0.5), y2: Math.round(H * 0.54), stroke: strokeColor, strokeWidth: 4 },
    { type: 'line', x1: Math.round(W * 0.36), y1: Math.round(H * 0.32), x2: Math.round(W * 0.64), y2: Math.round(H * 0.32), stroke: strokeColor, strokeWidth: 4 }
  ];

  const furniture = [
    // Chalkboard
    { type: 'rounded_rect', x: Math.round(W * 0.05), y: Math.round(H * 0.16), width: Math.round(W * 0.25), height: Math.round(H * 0.36), rx: 8, fill: '#14532d', stroke: '#78350f', strokeWidth: 8 },
    // Wooden Workbench
    buildContactShadow(W * 0.80, groundY, W * 0.15, 12, lighting.id),
    { type: 'rounded_rect', x: Math.round(W * 0.65), y: groundY - 140, width: Math.round(W * 0.29), height: 140, rx: 6, fill: '#451a03', stroke: strokeColor, strokeWidth }
  ];

  const lamps = [
    { type: 'line', x1: Math.round(W * 0.5), y1: 0, x2: Math.round(W * 0.5), y2: 75, stroke: strokeColor, strokeWidth: 4 },
    { type: 'polygon', points: [[Math.round(W * 0.45), 110], [Math.round(W * 0.5), 75], [Math.round(W * 0.55), 110]], fill: '#292524', stroke: strokeColor, strokeWidth: 4 }
  ];

  return {
    layers: [
      { id: 'wall_floor', name: 'Tường & Sàn Gỗ Cổ', zIndex: 10, elements: wallFloor },
      { id: 'window_door', name: 'Cửa Sổ Vòm', zIndex: 15, elements: windowDoor },
      { id: 'furniture_cabinets', name: 'Bảng & Bàn Gỗ', zIndex: 20, elements: furniture },
      { id: 'lighting_lamps', name: 'Đèn Treo Cổ', zIndex: 30, elements: lamps }
    ]
  };
}

// ============================================================================
// 4. GENERAL INDOOR & OUTDOOR ENVIRONMENTS (FULL CATALOG)
// ============================================================================

function buildIndoorEnvironment(ctx, normId) {
  const { width: W, height: H, groundY, palette, lighting, strokeColor, strokeWidth } = ctx;
  const isWarm = ['cafe', 'living_room', 'bedroom', 'store'].includes(normId);
  const isSpace = normId === 'space_station' || normId === 'control_room' || normId === 'inside_machine';

  const wallCol = lighting.id === 'night' ? '#0f172a' : (isSpace ? '#1e293b' : (isWarm ? '#fef3c7' : palette.wall));
  const floorCol = lighting.id === 'night' ? '#1e293b' : (isSpace ? '#334155' : (isWarm ? '#78350f' : palette.floor));

  const wallFloor = [
    { type: 'rect', x: 0, y: 0, width: W, height: groundY, fill: wallCol },
    { type: 'rect', x: 0, y: groundY, width: W, height: H - groundY, fill: floorCol, stroke: strokeColor, strokeWidth }
  ];

  const windowEls = [
    { type: 'rounded_rect', x: Math.round(W * 0.25), y: Math.round(H * 0.14), width: Math.round(W * 0.5), height: Math.round(H * 0.34), rx: 12, fill: isSpace ? '#020617' : lighting.windowColor, stroke: strokeColor, strokeWidth }
  ];
  if (isSpace) {
    for (let i = 0; i < 16; i++) {
      windowEls.push({ type: 'circle', cx: Math.round(W * (0.28 + (i * 0.03))), cy: Math.round(H * (0.18 + ((i * 7) % 10) * 0.025)), r: 2.5, fill: '#f8fafc' });
    }
  }

  const furniture = [
    buildContactShadow(W * 0.78, groundY, 180, 14, lighting.id),
    { type: 'rounded_rect', x: Math.round(W * 0.64), y: groundY - 125, width: Math.round(W * 0.28), height: 125, rx: 8, fill: isWarm ? '#b45309' : palette.metal, stroke: strokeColor, strokeWidth }
  ];

  return {
    layers: [
      { id: 'wall_floor', name: 'Tường & Sàn Trong Nhà', zIndex: 10, elements: wallFloor },
      { id: 'window_door', name: 'Cửa Sổ', zIndex: 15, elements: windowEls },
      { id: 'furniture_cabinets', name: 'Nội Thất', zIndex: 20, elements: furniture }
    ]
  };
}

function buildOutdoorEnvironment(ctx, normId) {
  const { width: W, height: H, groundY, lighting, strokeColor, strokeWidth } = ctx;
  const groundColors = {
    park: '#22c55e',
    forest: '#15803d',
    countryside: '#4ade80',
    mountain: '#64748b',
    beach: '#fde68a',
    desert: '#fbbf24',
    construction: '#78716c'
  };

  const sky = [
    { type: 'rect', x: 0, y: 0, width: W, height: groundY, fill: lighting.skyTop },
    ...(lighting.hasSun ? [{ type: 'circle', cx: Math.round(W * 0.82), cy: Math.round(H * 0.16), r: 42, fill: lighting.sunColor }] : []),
    ...(lighting.hasMoon ? [{ type: 'circle', cx: Math.round(W * 0.82), cy: Math.round(H * 0.16), r: 34, fill: lighting.moonColor }] : [])
  ];

  const distant = [];
  if (normId === 'mountain' || normId === 'countryside' || normId === 'forest') {
    distant.push({ type: 'polygon', points: [[0, groundY], [Math.round(W * 0.25), Math.round(H * 0.34)], [Math.round(W * 0.55), groundY]], fill: '#475569', stroke: strokeColor, strokeWidth: 3 });
    distant.push({ type: 'polygon', points: [[Math.round(W * 0.38), groundY], [Math.round(W * 0.72), Math.round(H * 0.28)], [W, groundY]], fill: '#334155', stroke: strokeColor, strokeWidth: 3 });
  } else if (normId === 'beach') {
    distant.push({ type: 'rect', x: 0, y: Math.round(groundY - H * 0.12), width: W, height: Math.round(H * 0.12), fill: '#0284c7' });
  }

  const gCol = lighting.id === 'night' ? '#14532d' : (groundColors[normId] || '#22c55e');
  const ground = [
    { type: 'rect', x: 0, y: groundY, width: W, height: H - groundY, fill: gCol, stroke: strokeColor, strokeWidth }
  ];

  return {
    layers: [
      { id: 'sky', name: 'Bầu Trời', zIndex: 5, elements: sky },
      { id: 'distant_buildings', name: 'Nền Xa', zIndex: 10, elements: distant },
      { id: 'road', name: 'Mặt Đất', zIndex: 20, elements: ground }
    ]
  };
}
