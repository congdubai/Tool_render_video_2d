// engine/v5-style-profiles.js — Video Style Profiles & Character Continuity Profiles (V5)
// Defines visual language, color palettes, outline thickness, lighting, and character appearance locks
// to ensure 100% visual consistency across all AI-generated Scene Plans and image prompts.

export const BUILTIN_STYLE_PROFILES = {
  educational_cartoon: {
    id: 'educational_cartoon',
    name: 'Hoạt Hình Giáo Dục Hiện Đại (Educational Cartoon)',
    description: 'Phong cách hoạt hình học đường và khoa học rõ ràng, nét vẽ sắc nét, độ tương phản cao, tối ưu cho việc tiếp thu kiến thức.',
    characterAppearance: {
      proportions: 'white_cartoon_standard (head: 1.0, body: 1.0, limbs: 1.0)',
      outlineStyle: 'solid_clean',
      outlineThickness: 2.8,
      outlineColor: '#20202A',
      shading: 'soft_cel_shade',
      eyes: 'expressive_comic_eyes'
    },
    palette: {
      primaryAccent: '#38bdf8', // Neon Sky
      secondaryAccent: '#fbbf24', // Amber Glow
      backgroundTint: '#0f172a',
      textHighContrast: '#f8fafc'
    },
    backgroundStyle: 'clean_vector_with_parallax',
    propStyle: 'flat_vector_bold_contour',
    cameraStyle: 'educational_follow_and_zoom',
    animationStyle: 'smooth_kinematic_ease_in_out',
    textStyle: { font: 'Inter, Montserrat, sans-serif', weight: 'bold', outline: true }
  },

  minimal_white_cartoon: {
    id: 'minimal_white_cartoon',
    name: 'Hoạt Hình Trắng Tối Giản (Minimal White Cartoon)',
    description: 'Phong cách nhân vật người que trắng ngà nét đen truyện tranh độc đáo (#FFFDF8), hài hước, thanh lịch, tập trung vào biểu cảm và đạo cụ.',
    characterAppearance: {
      proportions: 'white_cartoon_iconic',
      outlineStyle: 'comic_bold_ink',
      outlineThickness: 3.2,
      outlineColor: '#18181b',
      shading: 'flat_unshaded',
      skinColor: '#FFFDF8'
    },
    palette: {
      primaryAccent: '#f59e0b',
      secondaryAccent: '#ef4444',
      backgroundTint: '#1e293b',
      textHighContrast: '#ffffff'
    },
    backgroundStyle: 'minimal_blueprint_or_clean_room',
    propStyle: 'bold_stroke_comic',
    cameraStyle: 'dynamic_slapstick_cuts',
    animationStyle: 'snappy_bouncy_cartoony',
    textStyle: { font: 'system-ui, sans-serif', weight: '900', outline: true }
  },

  chibi_cartoon: {
    id: 'chibi_cartoon',
    name: 'Hoạt Hình Chibi Đáng Yêu (Chibi Cartoon)',
    description: 'Nhân vật đầu to mình nhỏ (tỉ lệ 1:2), mắt to tròn long lanh, biểu cảm vui nhộn khoa trương.',
    characterAppearance: {
      proportions: 'chibi_2_head_tall',
      outlineStyle: 'smooth_curved',
      outlineThickness: 3.0,
      outlineColor: '#292524',
      shading: 'vibrant_gradient',
      eyes: 'large_shiny_anime'
    },
    palette: {
      primaryAccent: '#ec4899',
      secondaryAccent: '#8b5cf6',
      backgroundTint: '#1e1b4b',
      textHighContrast: '#ffffff'
    },
    backgroundStyle: 'pastel_colorful_environment',
    propStyle: 'oversized_cute_props',
    cameraStyle: 'bouncy_reaction_shots',
    animationStyle: 'high_energy_squash_and_stretch',
    textStyle: { font: 'Comic Sans MS, Quicksand, sans-serif', weight: 'bold', outline: true }
  },

  historical_storytelling: {
    id: 'historical_storytelling',
    name: 'Kể Chuyện Lịch Sử Điên Ảnh (Historical Storytelling)',
    description: 'Bầu không khí hoài niệm, màu phim cổ điển nâu ấm hoặc đèn chân không cam dịu, bối cảnh chi tiết và máy quay trôi chậm.',
    characterAppearance: {
      proportions: 'realistic_cartoon',
      outlineStyle: 'fine_tweed_ink',
      outlineThickness: 2.2,
      outlineColor: '#292524',
      shading: 'vintage_warm_shadows'
    },
    palette: {
      primaryAccent: '#d97706',
      secondaryAccent: '#78350f',
      backgroundTint: '#1c1917',
      textHighContrast: '#fef3c7'
    },
    backgroundStyle: 'rich_textured_historical_lab',
    propStyle: 'realistic_vintage_implements',
    cameraStyle: 'cinematic_slow_push_and_pan',
    animationStyle: 'deliberate_measured_kinematics',
    textStyle: { font: 'Georgia, serif', weight: 'bold', outline: false }
  },

  flat_vector_animation: {
    id: 'flat_vector_animation',
    name: 'Đồ Họa Phẳng Công Nghệ Cao (Flat Vector Animation)',
    description: 'Thiết kế phẳng hiện đại, đường nét hình học sắc sảo, thích hợp cho video giải thích công nghệ và AI.',
    characterAppearance: {
      proportions: 'geometric_modern',
      outlineStyle: 'borderless_or_crisp',
      outlineThickness: 2.0,
      outlineColor: '#0f172a',
      shading: 'minimal_flat'
    },
    palette: {
      primaryAccent: '#10b981',
      secondaryAccent: '#06b6d4',
      backgroundTint: '#090d16',
      textHighContrast: '#f1f5f9'
    },
    backgroundStyle: 'isometric_or_clean_grid',
    propStyle: 'clean_flat_geometry',
    cameraStyle: 'smooth_orthographic_pans',
    animationStyle: 'ease_in_out_motion_graphics',
    textStyle: { font: 'Courier New, monospace', weight: 'bold', outline: false }
  },

  doodle_animation: {
    id: 'doodle_animation',
    name: 'Bản Vẽ Phấn Bảng & Doodle (Doodle Animation)',
    description: 'Phong cách vẽ tay bảng đen hoặc bảng trắng như thầy giáo đang trực tiếp giảng bài.',
    characterAppearance: {
      proportions: 'scribble_doodle',
      outlineStyle: 'chalk_or_marker',
      outlineThickness: 3.5,
      outlineColor: '#f8fafc',
      shading: 'hatch_crosshatch'
    },
    palette: {
      primaryAccent: '#38bdf8',
      secondaryAccent: '#f43f5e',
      backgroundTint: '#0f172a',
      textHighContrast: '#ffffff'
    },
    backgroundStyle: 'chalkboard_blueprint_grid',
    propStyle: 'hand_drawn_sketch',
    cameraStyle: 'whiteboard_pan_and_draw',
    animationStyle: 'frame_by_frame_sketchy',
    textStyle: { font: 'Caveat, Kalam, cursive', weight: 'bold', outline: false }
  },

  what_if_animation: {
    id: 'what_if_animation',
    name: 'Giả Thuyết Khoa Học (What If Animation)',
    description: 'Nhịp độ dồn dập, màu sắc tương phản mạnh mẽ, góc quay phóng đại kịch tính.',
    characterAppearance: {
      proportions: 'dynamic_action_hero',
      outlineStyle: 'bold_comic',
      outlineThickness: 3.4,
      outlineColor: '#090d16',
      shading: 'hard_dramatic_shadows'
    },
    palette: {
      primaryAccent: '#ef4444',
      secondaryAccent: '#8b5cf6',
      backgroundTint: '#030712',
      textHighContrast: '#f8fafc'
    },
    backgroundStyle: 'high_contrast_sci_fi',
    propStyle: 'exaggerated_tech_props',
    cameraStyle: 'rapid_whip_pan_and_zoom',
    animationStyle: 'dramatic_impact_accents',
    textStyle: { font: 'Impact, sans-serif', weight: '900', outline: true }
  },

  comedy_animation: {
    id: 'comedy_animation',
    name: 'Hài Hước & Slapstick (Comedy Animation)',
    description: 'Biểu cảm lố hài hoạt hình Tom & Jerry, đánh nhau khói mịt mù, văng sao choáng váng.',
    characterAppearance: {
      proportions: 'flexible_rubber_hose',
      outlineStyle: 'chunky_cartoon_ink',
      outlineThickness: 3.8,
      outlineColor: '#18181b',
      shading: 'bright_comic'
    },
    palette: {
      primaryAccent: '#f59e0b',
      secondaryAccent: '#ef4444',
      backgroundTint: '#1e293b',
      textHighContrast: '#ffffff'
    },
    backgroundStyle: 'whimsical_cartoon_set',
    propStyle: 'bouncy_oversized',
    cameraStyle: 'crash_zooms_and_shakes',
    animationStyle: 'squash_stretch_slapstick',
    textStyle: { font: 'Comic Sans MS, sans-serif', weight: 'bold', outline: true }
  },

  explainer_video: {
    id: 'explainer_video',
    name: 'Video Giải Trình Doanh Nghiệp (Explainer Video)',
    description: 'Bố cục chuẩn mực, card so sánh số liệu trực quan, nhân vật mặc vest hoặc labcoat đĩnh đạc.',
    characterAppearance: {
      proportions: 'professional_vector',
      outlineStyle: 'crisp_subtle',
      outlineThickness: 2.4,
      outlineColor: '#334155',
      shading: 'clean_gradient'
    },
    palette: {
      primaryAccent: '#0284c7',
      secondaryAccent: '#10b981',
      backgroundTint: '#0f172a',
      textHighContrast: '#f8fafc'
    },
    backgroundStyle: 'modern_office_and_charts',
    propStyle: 'corporate_devices_and_charts',
    cameraStyle: 'structured_card_focus',
    animationStyle: 'balanced_fluid_keyframing',
    textStyle: { font: 'Inter, Roboto, sans-serif', weight: '700', outline: false }
  }
};

/**
 * Custom Style Profile Store
 */
const customStyleProfiles = new Map();

export function getStyleProfile(profileId) {
  return customStyleProfiles.get(profileId) || BUILTIN_STYLE_PROFILES[profileId] || BUILTIN_STYLE_PROFILES.educational_cartoon;
}

export function listStyleProfiles() {
  return [...Object.values(BUILTIN_STYLE_PROFILES), ...Array.from(customStyleProfiles.values())];
}

export function saveCustomStyleProfile(profile) {
  if (!profile || !profile.id) throw new Error('Style profile requires a valid id.');
  customStyleProfiles.set(profile.id, { ...profile, isCustom: true });
  return profile;
}

/**
 * Character Continuity Enforcer
 * Creates the strict character profile sent to AI models, enforcing face/hair/skin locking.
 */
export function buildCharacterContinuityProfile(characterId, overrides = {}) {
  const isDoc = characterId === 'doc' || characterId === 'max';
  const isJake = characterId === 'jake' || characterId === 'alex';

  return {
    characterId: isDoc ? 'doc' : (isJake ? 'jake' : characterId),
    name: isDoc ? 'Doc (Nhà Khoa Học)' : (isJake ? 'Jake (Cộng Sự)' : (overrides.name || 'Nhân vật')),
    role: overrides.role || (isDoc ? 'protagonist' : 'companion'),
    appearanceLock: {
      locked: true,
      faceFeatures: isDoc ? 'Silver parted hair, round friendly cartoon eyes, clean shaven' : 'Messy dark hair, wide eyes, casual grin',
      skinColor: '#FFFDF8',
      hairColor: isDoc ? '#D8D8D8' : '#18181b',
      proportions: 'Standard white cartoon 2D rig',
      rules: 'AI tuyệt đối không thay đổi khuôn mặt, tóc, màu da, hoặc tỷ lệ cơ thể của nhân vật này qua tất cả các scene.'
    },
    availableOutfits: [
      'outfit_scientist_labcoat',
      'outfit_business_suit',
      'outfit_casual_hoodie',
      'outfit_historical_inventor',
      'outfit_winter_coat',
      'outfit_cyber_suit'
    ],
    availableExpressions: [
      'neutral', 'happy', 'laughing', 'thoughtful', 'focused',
      'surprised', 'shocked', 'curious', 'sad', 'crying', 'dizzy', 'talking', 'furious'
    ],
    anchors: ['right_hand', 'left_hand', 'head_top', 'chest']
  };
}
