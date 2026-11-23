/**
 * lib/character-library.mjs
 * Character Library System V3 — Unified Character Management (Mode A: Built-in & Mode B: Imported)
 * Manages Chibi 2D presets, White Cartoon, and external imported characters (single PNG, layered parts, sprite sheets, packages).
 */

import fs from "fs";
import path from "path";
import zlib from "zlib";

const DATA_DIR = path.resolve(process.cwd(), "data", "characters");
const IMPORTED_ASSETS_DIR = path.resolve(process.cwd(), "public", "characters", "imported");

/**
 * Đảm bảo thư mục lưu trữ nhân vật và asset tồn tại
 */
export function ensureCharacterStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(IMPORTED_ASSETS_DIR)) {
    fs.mkdirSync(IMPORTED_ASSETS_DIR, { recursive: true });
  }

  // Khởi tạo các nhân vật mặc định nếu thư mục trống
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  if (files.length === 0) {
    initDefaultCharacters();
  }
}

/**
 * Thư mục chứa asset cho một nhân vật import
 */
export function getImportedAssetDir(charId) {
  const safeId = path.basename(charId).replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = path.join(IMPORTED_ASSETS_DIR, safeId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Lưu tệp ảnh part cho nhân vật import (từ Base64 DataURL hoặc Buffer)
 * @param {string} charId Mã nhân vật
 * @param {string} partId Tên bộ phận (vd: head, torso, upperArm_L)
 * @param {string | Buffer} data Dữ liệu ảnh
 * @param {string} [filename] Tên tệp
 * @returns {string} URL công khai truy cập ảnh qua Express (/public/characters/imported/...)
 */
export function saveCharacterPartAsset(charId, partId, data, filename) {
  ensureCharacterStorage();
  const safeId = path.basename(charId).replace(/[^a-zA-Z0-9_-]/g, "");
  const dir = getImportedAssetDir(safeId);

  const cleanPartName = (partId || "part").replace(/[^a-zA-Z0-9_-]/g, "");
  const fname = filename || `${cleanPartName}.png`;
  const filePath = path.join(dir, fname);

  if (Buffer.isBuffer(data)) {
    fs.writeFileSync(filePath, data);
  } else if (typeof data === "string") {
    // Xử lý data:image/png;base64,...
    const base64Match = data.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
    const rawBase64 = base64Match ? base64Match[1] : data;
    const buf = Buffer.from(rawBase64, "base64");
    fs.writeFileSync(filePath, buf);
  } else {
    throw new Error("Dữ liệu ảnh không hợp lệ (cần base64 string hoặc Buffer).");
  }

  return `/public/characters/imported/${safeId}/${fname}`;
}

/**
 * Danh mục các nhân vật preset chuẩn Chibi V2 (Mode A)
 */
export const DEFAULT_PRESET_CHARACTERS = [
  {
    id: "chibi_max",
    name: "Max",
    type: "builtin",
    characterEngine: "chibi",
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
      bottomType: "pants",
      shoeType: "sneakers",
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
    type: "builtin",
    characterEngine: "chibi",
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
      bottomType: "pants",
      shoeType: "sneakers",
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
    type: "builtin",
    characterEngine: "chibi",
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
      bottomType: "pants",
      shoeType: "casual",
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
    type: "builtin",
    characterEngine: "chibi",
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
      bottomType: "skirt",
      shoeType: "casual",
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
 * Lấy danh sách tất cả nhân vật trong thư viện (hỗ trợ cả Built-in và Imported)
 */
export function listCharacters(filter = "all") {
  ensureCharacterStorage();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const characters = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const char = JSON.parse(content);
      const isImported = char.type === "imported" || !!char.parts || !!char.importType;
      char.type = isImported ? "imported" : (char.type || "builtin");

      if (filter === "builtin" && isImported) continue;
      if (filter === "imported" && !isImported) continue;

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
    const char = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const isImported = char.type === "imported" || !!char.parts || !!char.importType;
    char.type = isImported ? "imported" : (char.type || "builtin");
    return char;
  } catch (e) {
    return null;
  }
}

/**
 * Lưu hoặc cập nhật một nhân vật (Tự động thích ứng Mode A: Built-in hoặc Mode B: Imported)
 */
export function saveCharacter(characterData) {
  ensureCharacterStorage();
  if (!characterData || !characterData.id || typeof characterData.id !== "string") {
    throw new Error("Thiếu mã nhân vật (character.id) hợp lệ.");
  }

  const safeId = path.basename(characterData.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);

  const existing = getCharacter(safeId);
  const now = new Date().toISOString();

  // Kiểm tra Mode B: Imported Character
  const isImported = characterData.type === "imported" || !!characterData.parts || !!characterData.importType;

  let fullData;
  if (isImported) {
    // Cấu trúc Mode B — Imported Character V3
    fullData = {
      ...characterData,
      id: safeId,
      name: characterData.name || safeId,
      type: "imported",
      importType: characterData.importType || "layered",
      thumbnail: characterData.thumbnail || null,
      sourceImage: characterData.sourceImage || null,
      dimensions: characterData.dimensions || { width: 512, height: 512 },
      parts: characterData.parts || {},
      rig: characterData.rig || {},
      expressions: characterData.expressions || {},
      animations: characterData.animations || {},
      defaultExpression: characterData.defaultExpression || "neutral",
      defaultFacing: characterData.defaultFacing || "three_quarter_right",
      proportions: {
        scale: 1.0,
        ...(characterData.proportions || {})
      },
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
  } else {
    // Cấu trúc Mode A — Built-in Chibi / White Cartoon
    fullData = {
      ...characterData,
      id: safeId,
      name: characterData.name || safeId,
      type: "builtin",
      characterEngine: characterData.characterEngine || "chibi",
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
  }

  fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), "utf-8");
  return fullData;
}

/**
 * Nhân bản nhân vật (hỗ trợ cả Built-in và sao chép assets của Imported)
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

  const newChar = JSON.parse(JSON.stringify(source));
  newChar.id = newId;
  newChar.name = `${source.name} (Bản sao)`;
  newChar.createdAt = new Date().toISOString();
  newChar.updatedAt = new Date().toISOString();

  // Nếu là Imported Character: Sao chép toàn bộ thư mục asset
  if (source.type === "imported") {
    const srcDir = path.join(IMPORTED_ASSETS_DIR, source.id);
    const dstDir = path.join(IMPORTED_ASSETS_DIR, newId);
    if (fs.existsSync(srcDir)) {
      fs.mkdirSync(dstDir, { recursive: true });
      for (const f of fs.readdirSync(srcDir)) {
        fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
      }
      // Cập nhật lại đường dẫn URL trong newChar
      const replacePaths = (obj) => {
        if (!obj || typeof obj !== "object") return;
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === "string" && obj[k].includes(`/imported/${source.id}/`)) {
            obj[k] = obj[k].replace(`/imported/${source.id}/`, `/imported/${newId}/`);
          } else if (typeof obj[k] === "object") {
            replacePaths(obj[k]);
          }
        }
      };
      replacePaths(newChar);
    }
  }

  return saveCharacter(newChar);
}

/**
 * Xóa một nhân vật và toàn bộ asset đi kèm
 */
export function deleteCharacter(id) {
  ensureCharacterStorage();
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);

  let deleted = false;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    deleted = true;
  }

  // Xóa thư mục asset nếu có
  const assetDir = path.join(IMPORTED_ASSETS_DIR, safeId);
  if (fs.existsSync(assetDir)) {
    try {
      fs.rmSync(assetDir, { recursive: true, force: true });
    } catch (e) {}
  }

  return deleted;
}
