// engine/outfit-engine-v4.js — Outfit Library, Character Identity & Clothing Rig System (V4)
// Decouples character identity (face, skin, hair, proportions) from modifiable clothing & accessories.
// Manages Body Profiles, Outfit Slots, Layer Order, Bone Attachment, Occlusion Masking & Presets.

import { clamp, lerp, seg, circle, ring, alpha, shade, mix, rr, poly, ease } from './core.js';
import { WHITE_CARTOON_PRESETS } from './white-cartoon-rig2d.js';

/**
 * 1. BODY PROFILES SPECIFICATION
 * Declares structural dimensions, supported slots, bone mappings and compatibility rules for each body archetype.
 */
export const BODY_PROFILES = {
  white_cartoon: {
    id: 'white_cartoon',
    name: 'Hoạt hình Trắng (White Cartoon 2D)',
    style: 'vector_white_cartoon',
    proportions: { headRatio: 0.32, armLength: 42, legLength: 48, torsoHeight: 46 },
    supportedSlots: [
      'headwear', 'facewear', 'inner_top', 'outer_top', 'torso',
      'sleeves_upper', 'sleeves_lower', 'pants', 'shoes', 'gloves', 'back_accessory'
    ],
    anchors: {
      head: [0, -126],
      face: [0, -126],
      chest: [0, -82],
      hip: [0, -44],
      hand_R: [18, -42],
      hand_L: [-18, -42],
      foot_R: [4, 0],
      foot_L: [-4, 0]
    },
    boneMapping: {
      torso: 'torso',
      upperArm_R: 'upperArm_R',
      forearm_R: 'forearm_R',
      upperArm_L: 'upperArm_L',
      forearm_L: 'forearm_L',
      thigh_R: 'thigh_R',
      shin_R: 'shin_R',
      thigh_L: 'thigh_L',
      shin_L: 'shin_L'
    },
    capabilities: {
      skeletalIK: true,
      vectorOutfits: true,
      layeredSprites: true,
      colorTinting: true,
      multiLayerClothing: true
    }
  },

  chibi_standard: {
    id: 'chibi_standard',
    name: 'Chibi Chuẩn (Chibi Standard Cut-out)',
    style: 'chibi_v9',
    proportions: { headRatio: 0.45, armLength: 32, legLength: 36, torsoHeight: 38 },
    supportedSlots: [
      'headwear', 'facewear', 'outer_top', 'torso', 'pants', 'shoes', 'back_accessory'
    ],
    anchors: {
      head: [0, -110],
      face: [0, -110],
      chest: [0, -70],
      hip: [0, -36],
      hand_R: [24, -38],
      hand_L: [-24, -38],
      foot_R: [8, 0],
      foot_L: [-8, 0]
    },
    capabilities: {
      skeletalIK: true,
      vectorOutfits: true,
      layeredSprites: true,
      colorTinting: true,
      multiLayerClothing: true
    }
  },

  chibi_short: {
    id: 'chibi_short',
    name: 'Chibi Nhỏ / Trẻ Em (Chibi Kid / Short)',
    style: 'chibi_v9_kid',
    proportions: { headRatio: 0.52, armLength: 26, legLength: 28, torsoHeight: 30 },
    supportedSlots: ['headwear', 'facewear', 'outer_top', 'pants', 'shoes'],
    capabilities: { skeletalIK: true, vectorOutfits: true, layeredSprites: false }
  },

  imported_custom: {
    id: 'imported_custom',
    name: 'Nhân Vật Ghép Xương Tách Lớp (Mode B)',
    style: 'layered_sprites',
    supportedSlots: ['headwear', 'facewear', 'outer_top', 'torso', 'pants', 'shoes'],
    capabilities: {
      skeletalIK: false,
      hierarchicalFK: true,
      vectorOutfits: false,
      layeredSprites: true,
      colorTinting: false,
      multiLayerClothing: true
    }
  },

  simple_doodle: {
    id: 'simple_doodle',
    name: 'Nhân Vật PNG Đơn Khối (Mode C / Monolithic)',
    style: 'monolithic_png',
    supportedSlots: ['headwear', 'facewear', 'back_accessory'],
    capabilities: {
      skeletalIK: false,
      hierarchicalFK: false,
      vectorOutfits: false,
      layeredSprites: false,
      overlayAccessories: true,
      fullSpriteReplacement: true
    }
  }
};

/**
 * 2. CORE OUTFIT LIBRARY (BUILT-IN FUNCTIONAL OUTFITS)
 */
export const OUTFIT_LIBRARY = {
  // 1. SCIENTIST LAB COAT (Áo Blouse Nhà Khoa Học)
  outfit_scientist_labcoat: {
    id: 'outfit_scientist_labcoat',
    name: 'Áo Blouse Nhà Khoa Học (Scientist Lab Coat)',
    category: 'professional',
    description: 'Áo blouse trắng tinh của nhà khoa học với túi ngực cắm bút, ve áo chữ V, áo trong sơ mi xanh thắt cà vạt, quần âu xám đen và giày công sở.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'labcoat',
    color: '#f8fafc',
    innerTop: 'shirt',
    innerColor: '#e0f2fe',
    tieColor: '#1e3a8a',
    legs: '#1e293b',
    shoes: '#0f172a',
    shoeType: 'casual',
    face: 'glasses',
    penColor: '#2563eb',
    hasPen: true,
    buttons: '#334155',
    slots: {
      outer_top: { type: 'labcoat', color: '#f8fafc', layer: 20 },
      inner_top: { type: 'shirt', color: '#e0f2fe', layer: 15 },
      torso_accessory: { type: 'tie', color: '#1e3a8a', layer: 18 },
      pants: { type: 'trousers', color: '#1e293b', layer: 10 },
      shoes: { type: 'casual', color: '#0f172a', layer: 12 },
      facewear: { type: 'glasses', color: '#1e293b', layer: 35 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    },
    variants: [
      { id: 'white', label: 'Trắng chuẩn (Classic White)', color: '#f8fafc', legs: '#1e293b' },
      { id: 'light_gray', label: 'Xám phòng thí nghiệm (Lab Gray)', color: '#e2e8f0', legs: '#0f172a' },
      { id: 'cream', label: 'Kem cổ điển (Vintage Cream)', color: '#fef3c7', legs: '#292524' }
    ]
  },

  // 2. BUSINESS SUIT (Bộ Áo Vest Doanh Nhân / Công Sở)
  outfit_business_suit: {
    id: 'outfit_business_suit',
    name: 'Áo Vest Doanh Nhân (Business Suit)',
    category: 'professional',
    description: 'Bộ âu phục sang trọng: áo vest xẻ ve lịch lãm, sơ mi trắng, cà vạt đỏ nổi bật, quần âu tối màu phẳng phiu và giày da đen bóng.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'suit',
    color: '#1e293b', // Charcoal / Navy
    innerTop: 'shirt',
    innerColor: '#ffffff',
    tieColor: '#dc2626', // Red power tie
    legs: '#1e293b',
    shoes: '#090d16',
    shoeType: 'formal',
    buttons: '#cbd5e1',
    slots: {
      outer_top: { type: 'suit', color: '#1e293b', layer: 20 },
      inner_top: { type: 'shirt', color: '#ffffff', layer: 15 },
      torso_accessory: { type: 'tie', color: '#dc2626', layer: 18 },
      pants: { type: 'trousers', color: '#1e293b', layer: 10 },
      shoes: { type: 'formal', color: '#090d16', layer: 12 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    },
    variants: [
      { id: 'navy', label: 'Xanh Navy (Navy Blue)', color: '#1e3a8a', legs: '#1e3a8a', tieColor: '#dc2626' },
      { id: 'charcoal', label: 'Than chì (Charcoal)', color: '#1e293b', legs: '#1e293b', tieColor: '#d97706' },
      { id: 'black', label: 'Đen quý phái (Classic Black)', color: '#090d16', legs: '#090d16', tieColor: '#ef4444' }
    ]
  },

  // 3. CASUAL HOODIE (Áo Hoodie & Quần Jeans Dạo Phố)
  outfit_casual_hoodie: {
    id: 'outfit_casual_hoodie',
    name: 'Áo Hoodie & Quần Jeans (Casual Hoodie & Jeans)',
    category: 'everyday',
    description: 'Trang phục năng động thoải mái: áo hoodie túi bụng kangaroo, dây rút trắng, quần jeans ống suông và giày sneakers thể thao.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'hoodie',
    color: '#d64a33', // Crimson red
    drawstrings: '#ffffff',
    legs: '#2e384d', // Denim
    shoes: '#111827',
    shoeType: 'sneakers',
    slots: {
      outer_top: { type: 'hoodie', color: '#d64a33', layer: 20 },
      pants: { type: 'jeans', color: '#2e384d', layer: 10 },
      shoes: { type: 'sneakers', color: '#111827', layer: 12 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    },
    variants: [
      { id: 'red', label: 'Đỏ thể thao (Crimson Red)', color: '#d64a33', legs: '#2e384d' },
      { id: 'black', label: 'Đen Streetwear (Onyx Black)', color: '#18181b', legs: '#3f3f46' },
      { id: 'forest', label: 'Xanh rêu (Forest Green)', color: '#15803d', legs: '#1e293b' }
    ]
  },

  // 4. WINTER COAT (Áo Măng Tô & Khăn Len Mùa Đông)
  outfit_winter_coat: {
    id: 'outfit_winter_coat',
    name: 'Áo Khoác Mùa Đông & Khăn Quàng Len (Winter Parka & Scarf)',
    category: 'seasonal',
    description: 'Trang phục giữ ấm mùa đông: áo khoác dày bo cổ lông ấm áp, khăn len đỏ quàng quanh cổ, quần giữ nhiệt và ủng tuyết cao cổ.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'winter_coat',
    color: '#0f766e', // Teal / Dark green
    furColor: '#f1f5f9',
    scarfColor: '#dc2626',
    legs: '#1e293b',
    shoes: '#334155',
    shoeType: 'boots',
    hasScarf: true,
    slots: {
      outer_top: { type: 'winter_coat', color: '#0f766e', layer: 20 },
      neck_accessory: { type: 'scarf', color: '#dc2626', layer: 25 },
      pants: { type: 'winter_pants', color: '#1e293b', layer: 10 },
      shoes: { type: 'boots', color: '#334155', layer: 12 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    },
    variants: [
      { id: 'teal', label: 'Xanh Teal (Nordic Teal)', color: '#0f766e', scarfColor: '#dc2626' },
      { id: 'maroon', label: 'Đỏ đun (Winter Maroon)', color: '#881337', scarfColor: '#fef08a' }
    ]
  },

  // 5. HISTORICAL INVENTOR (Áo Gile & Kính Kỹ Sư Thế Kỷ 19)
  outfit_historical_inventor: {
    id: 'outfit_historical_inventor',
    name: 'Nhà Phát Minh Lịch Sử Thế Kỷ 19 (Historical Inventor)',
    category: 'historical',
    metadata: { era: 'industrial_revolution', region: 'Europe', century: 19 },
    description: 'Trang phục nhà sáng chế thời kỳ Cách mạng Công nghiệp: áo gile vải tweed nâu, sơ mi kem xắn tay, dây đồng hồ quả quýt vàng, quần âu cổ điển và kính bảo hộ.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'inventor_vest',
    color: '#78350f', // Brown tweed
    shirtColor: '#fef3c7', // Cream vintage shirt
    watchChain: '#d97706', // Gold watch chain
    legs: '#292524',
    shoes: '#451a03',
    shoeType: 'boots',
    face: 'goggles',
    slots: {
      inner_top: { type: 'shirt', color: '#fef3c7', layer: 15 },
      outer_top: { type: 'vest', color: '#78350f', layer: 20 },
      torso_accessory: { type: 'watch_chain', color: '#d97706', layer: 22 },
      pants: { type: 'trousers', color: '#292524', layer: 10 },
      shoes: { type: 'boots', color: '#451a03', layer: 12 },
      facewear: { type: 'goggles', color: '#78350f', layer: 35 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    }
  },

  // 6. CASUAL T-SHIRT (Áo Thun & Quần Đùi Dạo Phố)
  outfit_casual_tshirt: {
    id: 'outfit_casual_tshirt',
    name: 'Áo Thun & Quần Đùi (Casual T-Shirt & Shorts)',
    category: 'everyday',
    description: 'Áo phông tay ngắn thoải mái, cổ áo tròn, quần soóc mát mẻ đi kèm mũ lưỡi trai và giày sneakers.',
    compatibleProfiles: ['white_cartoon', 'chibi_standard', 'imported_custom'],
    top: 'tshirt',
    color: '#3a6ea5',
    legs: '#374151',
    head: 'cap',
    headColor: '#f2c21a',
    shoes: '#111827',
    shoeType: 'sneakers',
    slots: {
      outer_top: { type: 'tshirt', color: '#3a6ea5', layer: 20 },
      pants: { type: 'shorts', color: '#374151', layer: 10 },
      headwear: { type: 'cap', color: '#f2c21a', layer: 30 },
      shoes: { type: 'sneakers', color: '#111827', layer: 12 }
    },
    occlusionMasks: {
      hideBaseTorso: true,
      hideBaseArms: false,
      hideBaseLegs: true
    }
  }
};

/**
 * 3. ACCESSORIES CATALOG
 */
export const ACCESSORIES_CATALOG = {
  // Head
  hat_cap_yellow: { id: 'hat_cap_yellow', name: 'Mũ lưỡi trai vàng (Yellow Cap)', slot: 'headwear', anchor: 'head', color: '#f2c21a' },
  hat_beanie_winter: { id: 'hat_beanie_winter', name: 'Mũ len mùa đông (Winter Beanie)', slot: 'headwear', anchor: 'head', color: '#0f766e' },
  hat_fedora_vintage: { id: 'hat_fedora_vintage', name: 'Mũ phớt cổ điển (Vintage Fedora)', slot: 'headwear', anchor: 'head', color: '#451a03' },
  hat_crown_gold: { id: 'hat_crown_gold', name: 'Vương miện hoàng gia (Royal Gold Crown)', slot: 'headwear', anchor: 'head', color: '#f59e0b' },
  // Face
  face_glasses_round: { id: 'face_glasses_round', name: 'Kính cận tròn (Round Glasses)', slot: 'facewear', anchor: 'face', color: '#1e293b' },
  face_sunglasses_dark: { id: 'face_sunglasses_dark', name: 'Kính râm thời trang (Dark Sunglasses)', slot: 'facewear', anchor: 'face', color: '#090d16' },
  face_goggles_inventor: { id: 'face_goggles_inventor', name: 'Kính bảo hộ kỹ sư (Inventor Goggles)', slot: 'facewear', anchor: 'face', color: '#78350f' },
  // Body
  tie_red_silk: { id: 'tie_red_silk', name: 'Cà vạt lụa đỏ (Red Silk Tie)', slot: 'torso', anchor: 'chest', color: '#dc2626' },
  bowtie_black: { id: 'bowtie_black', name: 'Nơ bướm trang trọng (Black Bowtie)', slot: 'torso', anchor: 'chest', color: '#090d16' },
  scarf_red_knit: { id: 'scarf_red_knit', name: 'Khăn len đỏ (Red Knit Scarf)', slot: 'torso', anchor: 'chest', color: '#dc2626' },
  backpack_travel: { id: 'backpack_travel', name: 'Balo du lịch (Traveler Backpack)', slot: 'back_accessory', anchor: 'chest', color: '#334155' }
};

/**
 * 4. CHARACTER IDENTITY SYSTEM
 * Decouples character identity (face, skin, hair, proportions) from modifiable clothing & accessories.
 */
export function getCharacterIdentity(char) {
  if (!char) return null;
  return {
    id: char.id || 'char_custom',
    name: char.name || 'Custom Character',
    skin: char.skin || '#FFFDF8',
    outline: char.outline || '#20202A',
    hair: char.hair || 'none',
    hairColor: char.hairColor || '#18181b',
    blush: char.blush ?? false,
    kid: char.kid ?? false,
    bodyProfile: char.bodyProfile || (char.character === 'white_cartoon' ? 'white_cartoon' : 'white_cartoon'),
    characterEngine: char.characterEngine || char.character || 'white_cartoon'
  };
}

/**
 * Applies an outfit specification or preset to a character while STRICTLY preserving their identity attributes.
 */
export function applyOutfitToCharacter(character, outfitOrSpec, variantId = null) {
  const base = typeof character === 'string' ? (WHITE_CARTOON_PRESETS[character] || WHITE_CARTOON_PRESETS.character_A) : character;
  const identity = getCharacterIdentity(base);

  let outfit = outfitOrSpec;
  if (typeof outfitOrSpec === 'string') {
    outfit = OUTFIT_LIBRARY[outfitOrSpec] || { top: outfitOrSpec };
  }

  // Handle color variant or custom property overrides
  let variantOverrides = {};
  if (typeof variantId === 'string' && outfit.variants && Array.isArray(outfit.variants)) {
    const foundVar = outfit.variants.find(v => v.id === variantId);
    if (foundVar) {
      variantOverrides = { ...foundVar };
      delete variantOverrides.id;
      delete variantOverrides.label;
    }
  } else if (typeof variantId === 'object' && variantId !== null) {
    variantOverrides = { ...variantId };
  }

  // Create clean combined character: identity locked + outfit styling updated
  const combined = {
    ...base,
    ...outfit,
    ...variantOverrides,
    // Strictly preserve identity attributes!
    id: identity.id,
    name: identity.name,
    skin: identity.skin,
    outline: identity.outline,
    hair: identity.hair,
    hairColor: identity.hairColor,
    blush: identity.blush,
    kid: identity.kid,
    bodyProfile: identity.bodyProfile,
    characterEngine: identity.characterEngine,
    currentOutfitId: outfit.id || outfit.top || 'custom_outfit'
  };

  return combined;
}

/**
 * 5. CLOTHING RIG & OCCLUSION MASKING RENDERER
 * Specialized renderer for detailed modular clothing (Lab coat, Business suit, Winter coat, Inventor vest, accessories).
 */
export function drawWhiteCartoonModularClothing(g, p, char, inkCol, dir, isSit = false) {
  const [sx, sy] = p.sh;
  const [hx, hy] = p.hip;
  const topType = char.top || 'hoodie';
  const topCol = char.color || (topType === 'labcoat' ? '#f8fafc' : topType === 'suit' ? '#1e293b' : '#d64a33');
  const beltY = hy - 10;
  const wTop = dir === 'front' ? 20 : 17;
  const wBot = dir === 'front' ? 16 : 14;

  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 1. SCIENTIST LAB COAT (Áo Blouse trắng, ve V, cổ áo sơ mi, túi ngực cắm bút)
  if (topType === 'labcoat') {
    // Ve áo sơ mi xanh bên trong
    g.fillStyle = char.innerColor || '#e0f2fe';
    g.beginPath();
    g.moveTo(sx - 7, sy);
    g.lineTo(sx + 7, sy);
    g.lineTo(sx, sy + 22);
    g.closePath();
    g.fill();

    // Cà vạt xanh đậm
    g.fillStyle = char.tieColor || '#1e3a8a';
    g.beginPath();
    g.moveTo(sx - 2, sy + 3);
    g.lineTo(sx + 2, sy + 3);
    g.lineTo(sx + 3.5, sy + 18);
    g.lineTo(sx, sy + 22);
    g.lineTo(sx - 3.5, sy + 18);
    g.closePath();
    g.fill();

    // Viền ve áo blouse
    g.strokeStyle = inkCol;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(sx - 7, sy);
    g.lineTo(sx, sy + 22);
    g.lineTo(sx + 7, sy);
    g.stroke();

    // Vạt áo labcoat xòe dài qua hông
    g.fillStyle = topCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(hx - wBot, beltY);
    g.lineTo(hx - wBot - 4, hy + 16);
    g.lineTo(hx + wBot + 4, hy + 16);
    g.lineTo(hx + wBot, beltY);
    g.closePath();
    g.fill();
    g.stroke();

    // Túi ngực với cây bút xanh (Lab Pen Pocket)
    const px = sx + 7;
    const py = sy + 9;
    g.fillStyle = shade(topCol, -0.08);
    g.strokeStyle = inkCol;
    g.lineWidth = 1.8;
    rr(g, px - 4, py, 9, 8, 1);
    g.fill();
    g.stroke();

    // Thân bút bi
    g.strokeStyle = char.penColor || '#2563eb';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(px, py - 3);
    g.lineTo(px, py + 4);
    g.stroke();

    // Hàng cúc áo dọc thân
    g.fillStyle = char.buttons || '#334155';
    [sy + 26, sy + 34, sy + 42].forEach(cy => {
      circle(g, sx, cy, 1.8, char.buttons || '#334155');
    });
  }

  // 2. BUSINESS SUIT (Áo vest xẻ ve, sơ mi trắng, cà vạt đỏ, cúc áo)
  else if (topType === 'suit') {
    // Sơ mi trắng chữ V bên trong
    g.fillStyle = char.innerColor || '#ffffff';
    g.beginPath();
    g.moveTo(sx - 8, sy);
    g.lineTo(sx + 8, sy);
    g.lineTo(sx, sy + 24);
    g.closePath();
    g.fill();

    // Cà vạt đỏ quyền lực (Power Red Tie)
    g.fillStyle = char.tieColor || '#dc2626';
    g.beginPath();
    g.moveTo(sx - 3, sy + 2);
    g.lineTo(sx + 3, sy + 2);
    g.lineTo(sx + 4.5, sy + 20);
    g.lineTo(sx, sy + 25);
    g.lineTo(sx - 4.5, sy + 20);
    g.closePath();
    g.fill();

    // Nút thắt cà vạt (Knot)
    poly(g, [[sx - 3, sy + 2], [sx + 3, sy + 2], [sx + 2, sy + 6], [sx - 2, sy + 6]], shade(char.tieColor || '#dc2626', -0.2));

    // Ve áo vest (Lapels) xẻ 2 bên
    g.fillStyle = topCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 2.6;

    // Ve trái
    poly(g, [[sx - 14, sy], [sx - 8, sy], [sx - 1, sy + 22], [sx - 10, sy + 18]], topCol);
    g.stroke();
    // Ve phải
    poly(g, [[sx + 14, sy], [sx + 8, sy], [sx + 1, sy + 22], [sx + 10, sy + 18]], topCol);
    g.stroke();

    // Vạt áo vest dưới thắt lưng
    g.fillStyle = topCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(hx - wBot, beltY);
    g.lineTo(hx - wBot - 2, hy + 8);
    g.lineTo(hx + wBot + 2, hy + 8);
    g.lineTo(hx + wBot, beltY);
    g.closePath();
    g.fill();
    g.stroke();

    // 2 cúc áo vest kim loại
    circle(g, sx, sy + 26, 2.0, '#cbd5e1');
    circle(g, sx, sy + 32, 2.0, '#cbd5e1');
  }

  // 3. WINTER COAT (Áo măng tô mùa đông bo cổ lông & khăn len quàng)
  else if (topType === 'winter_coat') {
    // Vạt áo khoác dày qua hông
    g.fillStyle = topCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(hx - wBot, beltY);
    g.lineTo(hx - wBot - 3, hy + 18);
    g.lineTo(hx + wBot + 3, hy + 18);
    g.lineTo(hx + wBot, beltY);
    g.closePath();
    g.fill();
    g.stroke();

    // Bo viền lông cừu ấm áp ở cổ
    g.fillStyle = char.furColor || '#f1f5f9';
    g.strokeStyle = inkCol;
    g.lineWidth = 2.4;
    rr(g, sx - 16, sy - 6, 32, 12, 6);
    g.fill();
    g.stroke();

    // Khăn quàng len đỏ ấm áp (Scarf)
    if (char.hasScarf !== false) {
      g.fillStyle = char.scarfColor || '#dc2626';
      g.strokeStyle = inkCol;
      g.lineWidth = 2.4;
      // Vòng khăn quanh cổ
      rr(g, sx - 13, sy - 2, 26, 10, 4);
      g.fill();
      g.stroke();
      // Đuôi khăn rủ xuống ngực
      g.beginPath();
      g.moveTo(sx + 3, sy + 6);
      g.lineTo(sx + 10, sy + 6);
      g.lineTo(sx + 8, sy + 26);
      g.lineTo(sx + 1, sy + 26);
      g.closePath();
      g.fill();
      g.stroke();
    }
  }

  // 4. HISTORICAL INVENTOR (Gile tweed nâu, sơ mi kem, dây đồng hồ quả quýt vàng)
  else if (topType === 'inventor_vest') {
    // Cổ sơ mi kem cổ điển
    g.fillStyle = char.shirtColor || '#fef3c7';
    g.beginPath();
    g.moveTo(sx - 6, sy);
    g.lineTo(sx + 6, sy);
    g.lineTo(sx, sy + 20);
    g.closePath();
    g.fill();

    // Áo gile nâu tweed
    g.fillStyle = topCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(sx - 15, sy);
    g.lineTo(sx - 6, sy);
    g.lineTo(sx, sy + 20);
    g.lineTo(sx + 6, sy);
    g.lineTo(sx + 15, sy);
    g.lineTo(hx + wBot, beltY);
    g.lineTo(hx - wBot, beltY);
    g.closePath();
    g.fill();
    g.stroke();

    // Dây đồng hồ quả quýt vàng (Pocket Watch Chain)
    g.strokeStyle = char.watchChain || '#d97706';
    g.lineWidth = 2.0;
    g.beginPath();
    g.moveTo(sx - 4, sy + 18);
    g.quadraticCurveTo(sx + 3, sy + 26, sx + 9, sy + 20);
    g.stroke();

    // Cúc áo gile gỗ
    circle(g, sx, sy + 12, 1.8, '#451a03');
    circle(g, sx, sy + 16, 1.8, '#451a03');
  }

  g.restore();
}

/**
 * 6. ACCESSORY RENDERING AT ANCHORS
 * Renders glasses, goggles, hats, caps, watches and attachments at exact skeletal transforms.
 */
export function drawWhiteCartoonAccessory(g, accSpec, anchorPos, inkCol = '#20202A', facing = 1) {
  if (!accSpec) return;
  const { slot, type, color, anchor } = accSpec;
  const [ax, ay] = anchorPos || [0, 0];

  g.save();
  g.translate(ax, ay);
  g.scale(facing, 1);

  // Kính mắt tròn (Round Glasses)
  if (type === 'glasses' || slot === 'facewear' && (type === 'glasses_round' || type === 'glasses')) {
    g.strokeStyle = inkCol;
    g.lineWidth = 2.4;
    // Mắt kính trái và phải
    circle(g, -11, 0, 8, 'rgba(255, 255, 255, 0.45)');
    ring(g, -11, 0, 8, 2.4, inkCol);
    circle(g, 11, 0, 8, 'rgba(255, 255, 255, 0.45)');
    ring(g, 11, 0, 8, 2.4, inkCol);
    // Cầu nối kính giữa 2 mắt
    g.beginPath();
    g.moveTo(-3, -2);
    g.quadraticCurveTo(0, -5, 3, -2);
    g.stroke();
    // Gọng kính sang 2 tai
    g.beginPath();
    g.moveTo(-19, -2);
    g.lineTo(-27, -4);
    g.moveTo(19, -2);
    g.lineTo(27, -4);
    g.stroke();
  }

  // Kính bảo hộ kỹ sư (Inventor Goggles)
  else if (type === 'goggles') {
    g.fillStyle = color || '#78350f';
    g.strokeStyle = inkCol;
    g.lineWidth = 2.6;
    // Vòng da bảo hộ
    rr(g, -24, -8, 48, 16, 5);
    g.fill();
    g.stroke();
    // 2 mắt kính đồng
    circle(g, -11, 0, 7, '#fef08a');
    ring(g, -11, 0, 7, 2.2, '#d97706');
    circle(g, 11, 0, 7, '#fef08a');
    ring(g, 11, 0, 7, 2.2, '#d97706');
  }

  // Mũ lưỡi trai (Cap)
  else if (type === 'cap') {
    const capCol = color || '#f2c21a';
    g.fillStyle = capCol;
    g.strokeStyle = inkCol;
    g.lineWidth = 3.2;
    // Mũ chụp đầu
    g.beginPath();
    g.arc(0, 0, 32, Math.PI * 0.9, Math.PI * 2.1);
    g.closePath();
    g.fill();
    g.stroke();
    // Vành mũ chìa ra trước
    g.beginPath();
    g.moveTo(22, -10);
    g.lineTo(45, -6);
    g.lineTo(26, 4);
    g.closePath();
    g.fill();
    g.stroke();
  }

  // Vương miện hoàng gia vàng (Gold Crown)
  else if (type === 'crown') {
    g.fillStyle = '#f59e0b';
    g.strokeStyle = inkCol;
    g.lineWidth = 2.8;
    poly(g, [
      [-22, 0], [-20, -18], [-10, -8], [0, -24], [10, -8], [20, -18], [22, 0]
    ], '#f59e0b');
    g.stroke();
    // Ngọc đỏ đính đỉnh
    circle(g, 0, -24, 3, '#dc2626');
  }

  g.restore();
}

/**
 * 7. TIMELINE OUTFIT CHANGE RESOLVER
 * Solves active outfit for character at any given timestamp on the timeline.
 */
export function solveCharacterOutfitAtTime(characterDef, outfitTimeline = [], t = 0) {
  if (!outfitTimeline || outfitTimeline.length === 0) {
    return characterDef;
  }

  let activeOutfitSpec = null;
  for (const item of outfitTimeline) {
    if (t >= item.start && t < item.end) {
      activeOutfitSpec = item;
      break;
    }
  }

  // If outside all intervals, fallback to last or initial
  if (!activeOutfitSpec) {
    activeOutfitSpec = outfitTimeline[0];
  }

  return applyOutfitToCharacter(characterDef, activeOutfitSpec.outfitId || activeOutfitSpec, activeOutfitSpec.variant);
}

/**
 * 8. OUTFIT PRESET SYSTEM
 */
export const OUTFIT_PRESETS = {
  // Doc Presets
  doc_default: { id: 'doc_default', name: 'Doc — Mặc định', outfitId: 'outfit_scientist_labcoat', characterId: 'doc' },
  doc_scientist: { id: 'doc_scientist', name: 'Doc — Nhà khoa học chuẩn', outfitId: 'outfit_scientist_labcoat', characterId: 'doc', accessories: ['face_glasses_round'] },
  doc_businessman: { id: 'doc_businessman', name: 'Doc — Doanh nhân lịch lãm', outfitId: 'outfit_business_suit', characterId: 'doc', accessories: ['face_glasses_round'] },
  doc_historical_inventor: { id: 'doc_historical_inventor', name: 'Doc — Nhà phát minh TK 19', outfitId: 'outfit_historical_inventor', characterId: 'doc', accessories: ['face_goggles_inventor'] },
  doc_winter: { id: 'doc_winter', name: 'Doc — Mùa đông ấm áp', outfitId: 'outfit_winter_coat', characterId: 'doc', accessories: ['face_glasses_round', 'scarf_red_knit'] },

  // Jake Presets
  jake_casual: { id: 'jake_casual', name: 'Jake — Thể thao dạo phố', outfitId: 'outfit_casual_tshirt', characterId: 'jake' },
  jake_businessman: { id: 'jake_businessman', name: 'Jake — Công sở trẻ trung', outfitId: 'outfit_business_suit', characterId: 'jake' },

  // Alex Presets
  alex_casual: { id: 'alex_casual', name: 'Alex — Hoodie đường phố', outfitId: 'outfit_casual_hoodie', characterId: 'character_A' },
  alex_scientist: { id: 'alex_scientist', name: 'Alex — Trợ tá phòng thí nghiệm', outfitId: 'outfit_scientist_labcoat', characterId: 'character_A' }
};

export function getOutfitPreset(id) {
  return OUTFIT_PRESETS[id] || null;
}

export function listOutfitPresets() {
  return Object.values(OUTFIT_PRESETS);
}
