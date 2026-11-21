/**
 * lib/character-library.mjs
 * Character Library System V2 - Quản lý, lưu trữ, thẩm định và tái sử dụng nhân vật Chibi 2D
 */

import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data", "characters");

/**
 * Đảm bảo thư mục lưu trữ nhân vật tồn tại
 */
export function ensureCharacterStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Khởi tạo các nhân vật mặc định nếu thư mục trống
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    initDefaultCharacters();
  }
}

/**
 * Danh mục các nhân vật preset chuẩn Chibi V2
 */
export const DEFAULT_PRESET_CHARACTERS = [
  {
    id: "chibi_max",
    name: "Max",
    gender: "boy",
    skinColor: "#ffdfc4",
    hair: {
      style: "short",
      color: "#4a3728",
      highlight: "#7a5c43"
    },
    face: {
      eyeStyle: "oval",
      eyeColor: "#111116",
      browStyle: "soft",
      mouthStyle: "smile",
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
      id: "hoodie_explorer",
      type: "hoodie",
      topColor: "#d64a33",
      topColor2: "#b83822",
      pantsColor: "#2e384d",
      shoeColor: "#1e1e24",
      headwear: "none",
      accessories: ["backpack"]
    },
    defaultExpression: "happy",
    defaultFacing: "three_quarter_right",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "chibi_jake",
    name: "Jake",
    gender: "boy",
    skinColor: "#fcdcc6",
    hair: {
      style: "spiky",
      color: "#232029",
      highlight: "#423d4c"
    },
    face: {
      eyeStyle: "oval",
      eyeColor: "#111116",
      browStyle: "sharp",
      mouthStyle: "grin",
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
      id: "tshirt_cap",
      type: "tshirt",
      topColor: "#3b82f6",
      topColor2: "#1d4ed8",
      pantsColor: "#374151",
      shoeColor: "#111827",
      headwear: "cap",
      headwearColor: "#f2c21a",
      accessories: []
    },
    defaultExpression: "smile",
    defaultFacing: "three_quarter_right",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "chibi_doc",
    name: "Doc",
    gender: "boy",
    skinColor: "#ffe5d4",
    hair: {
      style: "side_part",
      color: "#6b7280",
      highlight: "#9ca3af"
    },
    face: {
      eyeStyle: "oval",
      eyeColor: "#111116",
      browStyle: "soft",
      mouthStyle: "smile",
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
      id: "labcoat_scientist",
      type: "labcoat",
      topColor: "#f3f4f6",
      topColor2: "#cbd5e1",
      pantsColor: "#1f2937",
      shoeColor: "#0f172a",
      headwear: "none",
      accessories: ["glasses", "pen"]
    },
    defaultExpression: "thinking",
    defaultFacing: "three_quarter_right",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "chibi_luna",
    name: "Luna",
    gender: "girl",
    skinColor: "#ffe8d6",
    hair: {
      style: "bun",
      color: "#5b3a29",
      highlight: "#8c583e"
    },
    face: {
      eyeStyle: "sparkle",
      eyeColor: "#1a1a24",
      browStyle: "soft",
      mouthStyle: "smile",
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
      id: "casual_dress",
      type: "dress",
      topColor: "#ec4899",
      topColor2: "#db2777",
      pantsColor: "#fbcfe8",
      shoeColor: "#831843",
      headwear: "headband",
      headwearColor: "#f472b6",
      accessories: []
    },
    defaultExpression: "happy",
    defaultFacing: "three_quarter_right",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function initDefaultCharacters() {
  for (const char of DEFAULT_PRESET_CHARACTERS) {
    const filePath = path.join(DATA_DIR, `${char.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(char, null, 2), "utf-8");
  }
}

/**
 * Lấy danh sách tất cả nhân vật trong thư viện
 */
export function listCharacters() {
  ensureCharacterStorage();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const characters = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const char = JSON.parse(content);
      characters.push(char);
    } catch (e) {
      console.warn(`Lỗi đọc file nhân vật ${file}:`, e.message);
    }
  }

  return characters.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Lấy chi tiết một nhân vật theo ID
 */
export function getCharacter(id) {
  ensureCharacterStorage();
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return null;
  }
}

/**
 * Lưu hoặc cập nhật một nhân vật
 */
export function saveCharacter(characterData) {
  ensureCharacterStorage();
  if (!characterData.id || typeof characterData.id !== "string") {
    throw new Error("Thiếu mã nhân vật (character.id) hợp lệ.");
  }

  const safeId = path.basename(characterData.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);

  const existing = getCharacter(safeId);
  const now = new Date().toISOString();

  const fullData = {
    ...characterData,
    id: safeId,
    name: characterData.name || safeId,
    skinColor: characterData.skinColor || "#ffdfc4",
    hair: {
      style: "short",
      color: "#333333",
      highlight: "#555555",
      ...(characterData.hair || {})
    },
    face: {
      eyeStyle: "oval",
      eyeColor: "#111116",
      browStyle: "soft",
      mouthStyle: "smile",
      blush: false,
      freckles: false,
      ...(characterData.face || {})
    },
    proportions: {
      headScale: 1.0,
      torsoLength: 36,
      armLength: 34,
      legLength: 46,
      ...(characterData.proportions || {})
    },
    outfit: {
      id: "default_outfit",
      type: "casual",
      topColor: "#3b82f6",
      pantsColor: "#1f2937",
      shoeColor: "#111827",
      ...(characterData.outfit || {})
    },
    defaultExpression: characterData.defaultExpression || "neutral",
    defaultFacing: characterData.defaultFacing || "three_quarter_right",
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), "utf-8");
  return fullData;
}

/**
 * Nhân bản nhân vật
 */
export function duplicateCharacter(sourceId) {
  const source = getCharacter(sourceId);
  if (!source) {
    throw new Error(`Không tìm thấy nhân vật nguồn ID: "${sourceId}".`);
  }

  let newId = `${source.id}_copy`;
  let counter = 1;
  while (fs.existsSync(path.join(DATA_DIR, `${newId}.json`))) {
    counter++;
    newId = `${source.id}_copy${counter}`;
  }

  const newChar = {
    ...JSON.parse(JSON.stringify(source)),
    id: newId,
    name: `${source.name} (Bản sao)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return saveCharacter(newChar);
}

/**
 * Xóa một nhân vật
 */
export function deleteCharacter(id) {
  ensureCharacterStorage();
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

