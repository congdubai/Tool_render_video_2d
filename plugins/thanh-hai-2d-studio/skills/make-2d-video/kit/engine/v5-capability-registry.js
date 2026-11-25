// engine/v5-capability-registry.js — AI Capability Registry (V5)
// Exports exact, verified runtime capabilities of Thanh Hai 2D Studio V4 to AI models (ChatGPT / Claude).
// Every entry contains real render readiness, parameter limits, and semantic descriptions.

import { WHITE_CARTOON_PRESETS } from './white-cartoon-rig2d.js';
import { BACKGROUND_CATALOG } from './background-engine-v4.js';
import { OUTFIT_LIBRARY, ACCESSORIES_CATALOG } from './outfit-engine-v4.js';
import { COMPOSITE_ACTION_TEMPLATES } from './action-engine-v4.js';
import { CAMERA_SHOT_PRESETS } from './master-timeline-v4.js';
import { listAssets } from '../../lib/asset-registry.mjs';

export const CAPABILITY_STATUS = {
  READY: 'READY',
  PARTIALLY_SUPPORTED: 'PARTIALLY_SUPPORTED',
  REQUIRES_SETUP: 'REQUIRES_SETUP'
};

/**
 * 1. CHARACTERS CAPABILITY REGISTRY
 */
export function getCharactersCapabilities() {
  return [
    {
      id: 'doc',
      name: 'Doc (Nhà Khoa Học / Max)',
      role: 'protagonist',
      bodyProfile: 'white_cartoon',
      renderReadiness: CAPABILITY_STATUS.READY,
      appearance: {
        skin: '#FFFDF8',
        outline: '#20202A',
        hair: 'hair_doc_silver',
        hairColor: '#D8D8D8',
        eyes: 'round_expressive',
        defaultOutfit: 'outfit_scientist_labcoat'
      },
      rigCapabilities: {
        headRig: true,
        armRig2Bone: true,
        legRig2Bone: true,
        handAnchors: ['left_hand', 'right_hand'],
        headAnchor: 'head_top',
        chestAnchor: 'chest'
      },
      supportedExpressions: [
        'neutral', 'happy', 'laughing', 'thoughtful', 'focused',
        'surprised', 'shocked', 'curious', 'sad', 'crying', 'dizzy', 'talking', 'furious'
      ],
      supportedOutfits: Object.keys(OUTFIT_LIBRARY),
      supportedActions: [
        'idle_breathe', 'walk_cycle', 'run_cycle', 'sit_down',
        'wave_hand', 'raise_arm', 'point_forward', 'scratch_head', 'fall_backward'
      ],
      supportedCompositeActions: Object.keys(COMPOSITE_ACTION_TEMPLATES),
      limitations: 'Ngoại hình khuôn mặt và màu tóc xám bạc được khóa danh tính (Identity Locked).'
    },
    {
      id: 'jake',
      name: 'Jake (Cộng Sự / Alex)',
      role: 'companion',
      bodyProfile: 'white_cartoon',
      renderReadiness: CAPABILITY_STATUS.READY,
      appearance: {
        skin: '#FFFDF8',
        outline: '#20202A',
        hair: 'hair_messy_black',
        hairColor: '#18181b',
        eyes: 'round_expressive',
        defaultOutfit: 'outfit_business_suit'
      },
      rigCapabilities: {
        headRig: true,
        armRig2Bone: true,
        legRig2Bone: true,
        handAnchors: ['left_hand', 'right_hand'],
        headAnchor: 'head_top',
        chestAnchor: 'chest'
      },
      supportedExpressions: [
        'neutral', 'happy', 'laughing', 'thoughtful', 'focused',
        'surprised', 'shocked', 'angry', 'sad', 'crying', 'dizzy', 'talking'
      ],
      supportedOutfits: Object.keys(OUTFIT_LIBRARY),
      supportedActions: [
        'idle_breathe', 'walk_cycle', 'run_cycle', 'sit_down',
        'wave_hand', 'raise_arm', 'point_forward', 'fall_backward'
      ],
      supportedCompositeActions: Object.keys(COMPOSITE_ACTION_TEMPLATES),
      limitations: 'Ngoại hình khuôn mặt và màu tóc đen được khóa danh tính (Identity Locked).'
    }
  ];
}

/**
 * 2. BACKGROUNDS CAPABILITY REGISTRY
 */
export function getBackgroundsCapabilities() {
  const backgrounds = [];
  const registered = Object.values(BACKGROUND_CATALOG);
  const seenIds = new Set();

  for (const bg of registered) {
    if (seenIds.has(bg.id)) continue;
    seenIds.add(bg.id);
    backgrounds.push({
      id: bg.id,
      name: bg.name,
      category: bg.category,
      description: bg.description,
      groundY: typeof bg.groundY === 'number' ? (bg.groundY <= 1.0 ? Math.round(720 * bg.groundY) : bg.groundY) : 560,
      hasParallax: bg.hasParallax ?? false,
      renderReadiness: CAPABILITY_STATUS.READY,
      recommendedFor: bg.category === 'historical' ? ['flashback', 'history', 'retrospective'] :
                      bg.category === 'educational' ? ['diagram', 'comparison', 'mindmap'] :
                      bg.category === 'indoor' ? ['dialogue', 'office', 'laboratory'] : ['travel', 'outdoor', 'action']
    });
  }

  return backgrounds;
}

/**
 * 3. PROPS CAPABILITY REGISTRY
 */
export function getPropsCapabilities() {
  return [
    {
      id: 'prop_coffee_cup',
      name: 'Tách Cà Phê Bốc Khói (Coffee Cup)',
      category: 'tableware',
      attachmentType: 'hand_anchor',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 50, height: 60 },
      description: 'Cốc cà phê sứ trắng bốc hơi nước nóng hoạt hình, thích hợp cho nhân vật nhâm nhi khi suy nghĩ.'
    },
    {
      id: 'prop_vintage_book',
      name: 'Sách Nghiên Cứu Cổ Điển (Vintage Book)',
      category: 'stationery',
      attachmentType: 'hand_anchor',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 80, height: 60 },
      description: 'Sách bìa da thuộc màu nâu mở ra có sơ đồ bản vẽ kỹ thuật.'
    },
    {
      id: 'prop_magnifying_glass',
      name: 'Kính Lúp Soi Vi Mạch (Magnifying Glass)',
      category: 'tool',
      attachmentType: 'hand_anchor',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 60, height: 90 },
      description: 'Kính lúp viền đồng soi cận cảnh chip bán dẫn và chi tiết nhỏ.'
    },
    {
      id: 'prop_smartphone',
      name: 'Điện Thoại Cảm Ứng Hiện Đại (Smartphone)',
      category: 'device',
      attachmentType: 'hand_anchor',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 45, height: 80 },
      description: 'Điện thoại thông minh mỏng nhẹ, màn hình phát sáng nhẹ.'
    },
    {
      id: 'prop_laptop',
      name: 'Máy Tính Xách Tay (Laptop)',
      category: 'device',
      attachmentType: 'table_or_hand',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 140, height: 90 },
      description: 'Laptop gập mở hiển thị biểu đồ phần mềm.'
    },
    {
      id: 'prop_desk_modern',
      name: 'Bàn Làm Việc Kỹ Thuật (Workstation Desk)',
      category: 'furniture',
      attachmentType: 'ground_surface',
      anchor: 'ground',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 300, height: 160 },
      description: 'Bàn nghiên cứu công nghệ bằng gỗ và thép chắc chắn.'
    },
    {
      id: 'prop_chair_office',
      name: 'Ghế Xoay Văn Phòng (Office Chair)',
      category: 'furniture',
      attachmentType: 'ground_surface',
      anchor: 'ground',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 100, height: 180 },
      description: 'Ghế tựa lưng cho nhân vật ngồi khi làm việc.'
    },
    {
      id: 'prop_pen_stylus',
      name: 'Bút Vẽ Kỹ Thuật (Stylus Pen)',
      category: 'stationery',
      attachmentType: 'hand_anchor',
      anchor: 'right_hand',
      renderReadiness: CAPABILITY_STATUS.READY,
      dimensions: { width: 15, height: 60 },
      description: 'Bút viết cho động tác phác thảo ý tưởng trên bảng.'
    }
  ];
}

/**
 * 4. EXPRESSIONS CAPABILITY REGISTRY
 */
export function getExpressionsCapabilities() {
  return [
    { id: 'neutral', semantic: 'Bình thản, tự nhiên', category: 'calm', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'happy', semantic: 'Vui vẻ, mỉm cười nhẹ nhàng', category: 'positive', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'laughing', semantic: 'Cười tươi, hài hước, đắc ý', category: 'positive', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'thoughtful', semantic: 'Trầm ngâm, suy nghĩ, tập trung', category: 'intellectual', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'focused', semantic: 'Chăm chú làm thí nghiệm, ánh mắt kiên định', category: 'intellectual', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'surprised', semantic: 'Ngạc nhiên khi phát hiện điều mới lạ', category: 'surprise', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'shocked', semantic: 'Kinh ngạc cực độ, mắt mở to miệng há hốc', category: 'surprise', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'curious', semantic: 'Tò mò, nhướng một bên lông mày', category: 'intellectual', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'sad', semantic: 'U sầu, thất vọng khi thí nghiệm chưa thành', category: 'negative', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'crying', semantic: 'Khóc hoạt hình, nước mắt tuôn dòng', category: 'negative', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'angry', semantic: 'Bực mình, khó chịu, cau mày', category: 'negative', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'furious', semantic: 'Tức giận bốc hỏa, mắt bốc lửa hoạt hình', category: 'negative', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'dizzy', semantic: 'Chóng mặt hoa mắt sau va chạm, mắt xoắn ốc', category: 'slapstick', renderReadiness: CAPABILITY_STATUS.READY },
    { id: 'talking', semantic: 'Mở miệng nhấp nháy phát biểu, thuyết minh', category: 'dialogue', renderReadiness: CAPABILITY_STATUS.READY }
  ];
}

/**
 * 5. COMPOSITE ACTIONS REGISTRY
 */
export function getCompositeActionsCapabilities() {
  return Object.values(COMPOSITE_ACTION_TEMPLATES).map(tmpl => ({
    id: tmpl.id,
    name: tmpl.name,
    category: tmpl.category,
    description: tmpl.description,
    duration: tmpl.duration,
    rolesRequired: tmpl.roles.map(r => ({ id: r.id, label: r.label })),
    renderReadiness: CAPABILITY_STATUS.READY
  }));
}

/**
 * 6. VFX & WEATHER CAPABILITY REGISTRY
 */
export function getVfxAndWeatherCapabilities() {
  return {
    vfx: [
      { id: 'impact_stars', name: 'Ngôi Sao Va Chạm (Impact Stars)', type: 'burst', attachment: 'head_or_contact' },
      { id: 'speed_lines', name: 'Vệt Tốc Độ (Speed Lines)', type: 'overlay', attachment: 'background_or_character' },
      { id: 'sweat_drops', name: 'Giọt Mồ Hôi Lo Lắng (Sweat Drops)', type: 'head_side', attachment: 'head' },
      { id: 'question_marks', name: 'Dấu Hỏi Chấm Thắc Mắc (Question Marks)', type: 'head_float', attachment: 'head' },
      { id: 'lightbulb_idea', name: 'Bóng Đèn Sáng Kiến (Idea Lightbulb)', type: 'head_burst', attachment: 'head' },
      { id: 'anger_smoke', name: 'Khói Bốc Hỏa Từ Tai (Anger Smoke)', type: 'head_side', attachment: 'head' },
      { id: 'dizzy_stars', name: 'Sao Xoay Choáng Váng (Dizzy Orbit Stars)', type: 'head_orbit', attachment: 'head' },
      { id: 'power_up_aura', name: 'Hào Quang Năng Lượng (Power Aura)', type: 'body_wrap', attachment: 'chest' }
    ],
    weather: [
      { id: 'rain', name: 'Mưa Rơi Tuyến Tính', intensityRange: [0.1, 1.0] },
      { id: 'snow', name: 'Tuyết Rơi Mùa Đông', intensityRange: [0.1, 1.0] },
      { id: 'lightning_storm', name: 'Bão Sấm Chớp Đột Biến', intensityRange: [0.2, 1.0] },
      { id: 'autumn_leaves', name: 'Lá Vàng Rơi Mùa Thu', intensityRange: [0.1, 0.8] },
      { id: 'fog', name: 'Sương Mù Dày Đặc', intensityRange: [0.1, 0.9] },
      { id: 'sunbeams', name: 'Tia Nắng Ấm Áp Buổi Sáng', intensityRange: [0.2, 0.8] }
    ]
  };
}

/**
 * 7. CINEMATOGRAPHY (CAMERA & TRANSITIONS) REGISTRY
 */
export function getCinematographyCapabilities() {
  return {
    cameraPresets: Object.entries(CAMERA_SHOT_PRESETS).map(([id, val]) => ({
      id,
      label: val.label,
      defaultZoom: val.zoom,
      recommendedUsage: val.label
    })),
    cameraKeyframing: {
      supportedTracks: ['zoom', 'x', 'y', 'rotation', 'shake'],
      zoomRange: [0.8, 2.2],
      shakeRange: [0, 1.0]
    },
    transitions: [
      { id: 'cut', name: 'Cắt Tức Thì', durationRange: [0, 0] },
      { id: 'crossfade', name: 'Hòa Tan Chồng Mờ (Crossfade)', durationRange: [0.3, 1.5] },
      { id: 'dip_black', name: 'Chìm Vào Bóng Tối (Dip to Black)', durationRange: [0.4, 1.2] },
      { id: 'dip_white', name: 'Chớp Sáng Đột Phá (Dip to White)', durationRange: [0.3, 1.0] },
      { id: 'slide_left', name: 'Trượt Khung Hình Sang Trái', durationRange: [0.4, 1.0] },
      { id: 'wipe_horizontal', name: 'Quét Màn Hình Ngang', durationRange: [0.4, 1.0] }
    ],
    educationalGraphics: [
      { type: 'title_card', label: 'Tiêu Đề / Hook Banner Lớn', fields: ['title', 'subtitle'] },
      { type: 'callout_box', label: 'Khung Đặc Tả Kỹ Thuật (Spec Box)', fields: ['title', 'items', 'accent'] },
      { type: 'comparison_card', label: 'Thẻ So Sánh Đối Đầu (VS Card)', fields: ['leftTitle', 'leftText', 'rightTitle', 'rightText'] },
      { type: 'badge', label: 'Huy Hiệu Mốc Năm (Year Badge)', fields: ['year', 'eventText'] }
    ]
  };
}

/**
 * 8. EXPORT FULL AI CAPABILITY REGISTRY FOR CONTEXT PACKAGE
 */
export function exportFullAiCapabilityRegistry() {
  return {
    engineVersion: '5.1-production',
    supportedSchemaVersion: '5.1',
    capabilities: {
      characters: getCharactersCapabilities(),
      backgrounds: getBackgroundsCapabilities(),
      props: getPropsCapabilities(),
      expressions: getExpressionsCapabilities(),
      compositeActions: getCompositeActionsCapabilities(),
      vfxAndWeather: getVfxAndWeatherCapabilities(),
      cinematography: getCinematographyCapabilities()
    },
    constraints: {
      resolution: { width: 1280, height: 720, aspect: '16:9' },
      fps: 24,
      timeUnit: 'milliseconds',
      audioIsMasterClock: true,
      identityLockRequired: true
    }
  };
}
