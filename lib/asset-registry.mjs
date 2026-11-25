/**
 * lib/asset-registry.mjs
 * Universal Animation & Asset Library Registry (Thanh Hai 2D Studio V4)
 * Manages storage, indexing, search, import/export, and lifecycle of shared assets across all 8 categories:
 * Expressions, Outfits, Props, Actions, VFX, Weather, Backgrounds, and Composite Actions.
 */

import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import { validateAssetSchema, isSafeAssetPath, ASSET_TYPES } from "./asset-validator.mjs";

const DATA_DIR = path.resolve(process.cwd(), "data", "assets");
const PUBLIC_ASSETS_DIR = path.resolve(process.cwd(), "public", "assets");

/**
 * Đảm bảo thư mục lưu trữ assets tồn tại và nạp các preset mặc định nếu thư mục trống
 */
export function ensureAssetStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_ASSETS_DIR)) {
    fs.mkdirSync(PUBLIC_ASSETS_DIR, { recursive: true });
  }

  // Tạo các thư mục danh mục con trong public/assets
  for (const t of ASSET_TYPES) {
    const subDir = path.join(PUBLIC_ASSETS_DIR, t);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
  }

  // Khởi tạo hoặc bổ sung các asset built-in chuẩn
  seedBuiltinAssets();
}

/**
 * Lấy danh sách các tài nguyên (hỗ trợ lọc theo loại, danh mục, tìm kiếm và thẻ tag)
 * @param {object} [filter]
 * @param {string} [filter.type]
 * @param {string} [filter.category]
 * @param {string} [filter.query]
 * @param {string} [filter.tag]
 * @returns {Array<object>}
 */
export function listAssets(filter = {}) {
  ensureAssetStorage();
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  const assets = [];

  const { type, category, query, tag } = filter;
  const qLower = query ? query.toLowerCase().trim() : null;
  const tagLower = tag ? tag.toLowerCase().trim() : null;

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const asset = JSON.parse(content);

      if (type && asset.type !== type) continue;
      if (category && asset.category !== category) continue;
      if (tagLower && (!asset.tags || !asset.tags.some(t => t.toLowerCase() === tagLower))) continue;

      if (qLower) {
        const nameMatch = asset.name && asset.name.toLowerCase().includes(qLower);
        const descMatch = asset.description && asset.description.toLowerCase().includes(qLower);
        const tagMatch = asset.tags && asset.tags.some(t => t.toLowerCase().includes(qLower));
        const idMatch = asset.id && asset.id.toLowerCase().includes(qLower);
        if (!nameMatch && !descMatch && !tagMatch && !idMatch) continue;
      }

      assets.push(asset);
    } catch (e) {
      console.warn(`Lỗi đọc file asset ${file}:`, e.message);
    }
  }

  return assets.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Lấy chi tiết một tài nguyên theo ID
 * @param {string} id Asset ID
 * @returns {object|null}
 */
export function getAsset(id) {
  ensureAssetStorage();
  if (!id || typeof id !== "string") return null;
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
 * Lưu hoặc cập nhật một tài nguyên vào thư viện
 * @param {object} assetData
 * @returns {object} Dữ liệu đã lưu
 */
export function saveAsset(assetData) {
  ensureAssetStorage();
  const validation = validateAssetSchema(assetData);
  if (!validation.valid) {
    throw new Error(`Dữ liệu asset không hợp lệ: ${validation.errors.join("; ")}`);
  }

  const safeId = path.basename(assetData.id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);

  const now = new Date().toISOString();
  let existing = null;
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {}
  }

  const fullData = {
    id: safeId,
    name: assetData.name.trim(),
    type: assetData.type,
    category: assetData.category || "general",
    version: assetData.version || 1,
    thumbnail: assetData.thumbnail || `/public/assets/${assetData.type}/${safeId}/thumb.png`,
    tags: Array.isArray(assetData.tags) ? assetData.tags : [],
    description: assetData.description || "",
    filePath: assetData.filePath || null,
    dimensions: assetData.dimensions || { width: 100, height: 100, scale: 1.0 },
    anchor: assetData.anchor || [50, 50],
    holdOffset: assetData.holdOffset || [0, 0],
    motion: assetData.motion || null,
    parameters: assetData.parameters || {},
    tracks: assetData.tracks || [],
    duration: assetData.duration || (assetData.type === "composite_action" ? 4.0 : null),
    compatibility: {
      bodyProfile: ["all"],
      requires: [],
      ...(assetData.compatibility || {})
    },
    license: assetData.license || "Proprietary",
    author: assetData.author || "Thanh Hai 2D Studio",
    isBuiltin: assetData.isBuiltin ?? (existing ? existing.isBuiltin : false),
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };

  fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), "utf-8");
  return fullData;
}

/**
 * Nhân bản tài nguyên thành một ID mới
 * @param {string} sourceId
 * @returns {object} Asset mới
 */
export function duplicateAsset(sourceId) {
  const source = getAsset(sourceId);
  if (!source) {
    throw new Error(`Không tìm thấy tài nguyên gốc ID: "${sourceId}".`);
  }

  let newId = `${source.id}_copy`;
  let counter = 1;
  while (fs.existsSync(path.join(DATA_DIR, `${newId}.json`))) {
    counter++;
    newId = `${source.id}_copy${counter}`;
  }

  const newAsset = JSON.parse(JSON.stringify(source));
  newAsset.id = newId;
  newAsset.name = `${source.name} (Bản sao)`;
  newAsset.isBuiltin = false;
  newAsset.createdAt = new Date().toISOString();
  newAsset.updatedAt = new Date().toISOString();

  // Sao chép thư mục tệp asset media nếu có
  const srcDir = path.join(PUBLIC_ASSETS_DIR, source.type, source.id);
  const dstDir = path.join(PUBLIC_ASSETS_DIR, source.type, newId);
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const f of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, f), path.join(dstDir, f));
    }
    // Cập nhật lại đường dẫn file
    if (newAsset.thumbnail && newAsset.thumbnail.includes(`/${source.id}/`)) {
      newAsset.thumbnail = newAsset.thumbnail.replace(`/${source.id}/`, `/${newId}/`);
    }
    if (newAsset.filePath && newAsset.filePath.includes(`/${source.id}/`)) {
      newAsset.filePath = newAsset.filePath.replace(`/${source.id}/`, `/${newId}/`);
    }
  }

  return saveAsset(newAsset);
}

/**
 * Kiểm tra xem tài nguyên có đang được tham chiếu trong project nào không
 * @param {string} assetId
 * @returns {{ inUse: boolean, projects: string[] }}
 */
export function checkAssetUsage(assetId) {
  const projects = [];
  const searchDirs = [
    path.resolve(process.cwd(), "thanhhai-2d-studio", "examples"),
    path.resolve(process.cwd(), "imported_projects")
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    const subEntries = fs.readdirSync(dir, { withFileTypes: true });
    for (const sub of subEntries) {
      if (sub.isDirectory()) {
        const configPath = path.join(dir, sub.name, "config.json");
        const metadataPath = path.join(dir, sub.name, ".project-metadata.json");
        let content = "";
        if (fs.existsSync(configPath)) {
          content += fs.readFileSync(configPath, "utf-8");
        }
        if (fs.existsSync(metadataPath)) {
          content += fs.readFileSync(metadataPath, "utf-8");
        }
        if (content.includes(`"${assetId}"`) || content.includes(assetId)) {
          projects.push(sub.name);
        }
      }
    }
  }

  return {
    inUse: projects.length > 0,
    projects
  };
}

/**
 * Xóa một tài nguyên khỏi thư viện
 * @param {string} id
 * @param {boolean} [force=false]
 * @returns {{ success: boolean, inUse?: boolean, projects?: string[] }}
 */
export function deleteAsset(id, force = false) {
  ensureAssetStorage();
  const safeId = path.basename(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(DATA_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    return { success: false, error: "Tài nguyên không tồn tại." };
  }

  // Kiểm tra cảnh báo phụ thuộc
  const usage = checkAssetUsage(safeId);
  if (usage.inUse && !force) {
    return {
      success: false,
      inUse: true,
      projects: usage.projects,
      error: `Tài nguyên "${safeId}" đang được sử dụng trong các dự án: [${usage.projects.join(", ")}]. Hãy xác nhận xóa cưỡng bức nếu muốn tiếp tục.`
    };
  }

  // Đọc loại asset trước khi xóa để dọn thư mục media
  try {
    const asset = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    if (asset.type) {
      const mediaDir = path.join(PUBLIC_ASSETS_DIR, asset.type, safeId);
      if (fs.existsSync(mediaDir)) {
        fs.rmSync(mediaDir, { recursive: true, force: true });
      }
    }
  } catch (e) {}

  fs.unlinkSync(filePath);
  return { success: true };
}

/**
 * Xuất một hoặc nhiều tài nguyên thành gói ZIP chuẩn V4
 * @param {string|string[]} assetIds
 * @returns {Buffer}
 */
export function exportAssetPackage(assetIds) {
  ensureAssetStorage();
  const ids = Array.isArray(assetIds) ? assetIds : [assetIds];
  const zip = new AdmZip();

  const manifest = {
    schemaVersion: 1,
    packageName: ids.length === 1 ? `Asset_${ids[0]}` : "ThanhHai_Asset_Pack",
    exportedAt: new Date().toISOString(),
    generator: "Thanh Hai 2D Studio V4 Asset Exporter",
    assetCount: 0,
    assets: []
  };

  for (const id of ids) {
    const asset = getAsset(id);
    if (!asset) continue;

    manifest.assets.push(asset);
    manifest.assetCount++;

    // Thêm các tệp media đi kèm trong public/assets/<type>/<id>
    const mediaDir = path.join(PUBLIC_ASSETS_DIR, asset.type, asset.id);
    if (fs.existsSync(mediaDir)) {
      const files = fs.readdirSync(mediaDir);
      for (const f of files) {
        const fullPath = path.join(mediaDir, f);
        if (fs.statSync(fullPath).isFile()) {
          zip.addLocalFile(fullPath, `media/${asset.type}/${asset.id}`);
        }
      }
    }
  }

  zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
  return zip.toBuffer();
}

/**
 * Nhập gói tài nguyên (.zip) vào thư viện (Bảo vệ Path Traversal & Trùng ID)
 * @param {Buffer} zipBuffer
 * @param {object} [options]
 * @param {"rename"|"overwrite"} [options.collisionStrategy="rename"]
 * @returns {{ success: boolean, importedCount: number, importedAssets: object[] }}
 */
export function importAssetPackage(zipBuffer, options = {}) {
  ensureAssetStorage();
  const collisionStrategy = options.collisionStrategy || "rename";
  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();

  // 1. Kiểm tra an ninh toàn bộ entry (Chống Zip Slip & Path Traversal)
  for (const entry of entries) {
    if (entry.entryName.includes("..") || entry.entryName.startsWith("/") || entry.entryName.startsWith("\\")) {
      throw new Error(`Phát hiện đường dẫn không an toàn trong gói ZIP: "${entry.entryName}". Huỷ nhập để bảo vệ hệ thống.`);
    }
  }

  // 2. Tìm và đọc manifest.json
  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) {
    throw new Error("Gói ZIP không hợp lệ: Thiếu file manifest.json.");
  }

  let manifest = null;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf-8"));
  } catch (e) {
    throw new Error("Không thể phân tích nội dung manifest.json: " + e.message);
  }

  const assetsToImport = Array.isArray(manifest.assets) ? manifest.assets : (manifest.asset ? [manifest.asset] : []);
  if (assetsToImport.length === 0) {
    throw new Error("Gói ZIP không chứa bất kỳ định nghĩa tài nguyên nào trong manifest.");
  }

  const importedAssets = [];

  // 3. Xử lý từng asset và giải nén media an toàn
  for (const rawAsset of assetsToImport) {
    if (!rawAsset || typeof rawAsset !== "object" || !rawAsset.id || !rawAsset.type) {
      throw new Error("Tài nguyên trong manifest thiếu id hoặc type hợp lệ.");
    }
    let targetId = rawAsset.id;

    if (fs.existsSync(path.join(DATA_DIR, `${targetId}.json`))) {
      if (collisionStrategy === "rename") {
        let count = 1;
        while (fs.existsSync(path.join(DATA_DIR, `${targetId}_imp${count}.json`))) {
          count++;
        }
        targetId = `${targetId}_imp${count}`;
      }
    }

    const assetData = { ...rawAsset, id: targetId };

    // Trích xuất các tệp media tương ứng
    const mediaPrefix = `media/${rawAsset.type}/${rawAsset.id}/`;
    const targetMediaDir = path.join(PUBLIC_ASSETS_DIR, assetData.type, targetId);

    for (const entry of entries) {
      if (!entry.isDirectory && entry.entryName.startsWith(mediaPrefix)) {
        const subFileName = path.basename(entry.entryName);
        if (!fs.existsSync(targetMediaDir)) {
          fs.mkdirSync(targetMediaDir, { recursive: true });
        }
        fs.writeFileSync(path.join(targetMediaDir, subFileName), entry.getData());

        // Cập nhật đường dẫn nếu trùng tên
        if (assetData.thumbnail && assetData.thumbnail.includes(subFileName)) {
          assetData.thumbnail = `/public/assets/${assetData.type}/${targetId}/${subFileName}`;
        }
        if (assetData.filePath && assetData.filePath.includes(subFileName)) {
          assetData.filePath = `/public/assets/${assetData.type}/${targetId}/${subFileName}`;
        }
      }
    }

    const saved = saveAsset(assetData);
    importedAssets.push(saved);
  }

  return {
    success: true,
    importedCount: importedAssets.length,
    importedAssets
  };
}

/**
 * Tạo dữ liệu mẫu khởi tạo cho 8 nhóm tài nguyên chuẩn V4
 */
function seedBuiltinAssets() {
  const seedList = [
    // 1. EXPRESSIONS
    {
      id: "expr_neutral",
      name: "Bình Thường (Neutral)",
      type: "expression",
      category: "standard",
      tags: ["calm", "default", "talking"],
      description: "Biểu cảm khuôn mặt điềm tĩnh, chuẩn mực cho mọi nhân vật.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "expr_happy",
      name: "Vui Vẻ Cười (Happy Smile)",
      type: "expression",
      category: "positive",
      tags: ["smile", "joy", "laugh"],
      description: "Mắt cong vui vẻ và miệng cười rạng rỡ.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "expr_angry",
      name: "Tức Giận (Angry Furious)",
      type: "expression",
      category: "negative",
      tags: ["anger", "rage", "cross"],
      description: "Lông mày nhíu sắc cạnh và miệng gầm gừ giận dữ.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "expr_shocked",
      name: "Sốc Kinh Ngạc (Shocked)",
      type: "expression",
      category: "extreme",
      tags: ["shock", "surprise", "jaw-drop"],
      description: "Mắt trợn tròn đồng tử thu nhỏ và miệng há to kinh ngạc.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "expr_scared",
      name: "Sợ Hãi Hoảng Hốt (Scared)",
      type: "expression",
      category: "extreme",
      tags: ["horror", "panic", "fear"],
      description: "Mắt rung bàng hoàng, miệng méo xệch và mặt tái đi.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "expr_love_eyes",
      name: "Mắt Trái Tim (Love Eyes)",
      type: "expression",
      category: "comic",
      tags: ["love", "heart", "romance"],
      description: "Đôi mắt biến thành hai trái tim đỏ đập thình thịch phong cách hoạt hình.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // 2. OUTFITS
    {
      id: "outfit_hoodie_red",
      name: "Áo Hoodie Đỏ Năng Động",
      type: "outfit",
      category: "casual",
      tags: ["streetwear", "hoodie", "teen"],
      description: "Áo hoodie thể thao có túi bụng kangaroo và dây nón trắng.",
      dimensions: { width: 140, height: 180, scale: 1.0 },
      anchor: [70, 40],
      compatibility: { bodyProfile: ["white_cartoon", "chibi"] },
      isBuiltin: true
    },
    {
      id: "outfit_scientist_labcoat",
      name: "Áo Blouse Nhà Khoa Học",
      type: "outfit",
      category: "scientist",
      tags: ["lab", "doctor", "researcher"],
      description: "Áo blouse trắng dài tay kèm kính mắt tri thức và bút cài ngực.",
      dimensions: { width: 140, height: 200, scale: 1.0 },
      anchor: [70, 40],
      compatibility: { bodyProfile: ["white_cartoon", "chibi"] },
      isBuiltin: true
    },

    // 3. PROPS
    {
      id: "prop_coffee_cup",
      name: "Ly Cà Phê Gốm Sứ",
      type: "prop",
      category: "everyday",
      tags: ["drink", "cafe", "mug"],
      description: "Ly cà phê gốm sứ có quai cầm tay và hơi nóng bốc lên.",
      dimensions: { width: 40, height: 40, scale: 1.0 },
      anchor: [20, 36],
      holdOffset: [4, -8],
      compatibility: { requires: ["hand_anchor"] },
      isBuiltin: true
    },
    {
      id: "prop_laptop_modern",
      name: "Laptop Mở Màn Hình",
      type: "prop",
      category: "office",
      tags: ["computer", "work", "tech"],
      description: "Máy tính xách tay siêu mỏng phát ánh sáng xanh dịu vào mặt nhân vật.",
      dimensions: { width: 80, height: 50, scale: 1.0 },
      anchor: [40, 46],
      holdOffset: [0, -12],
      compatibility: { requires: ["hand_anchor"] },
      isBuiltin: true
    },
    {
      id: "prop_broom_stick",
      name: "Cây Chổi Quét Nhà",
      type: "prop",
      category: "household",
      tags: ["cleaning", "weapon", "defense"],
      description: "Cây chổi rơm cán dài, nhân vật có thể cầm ngang ngực để tự vệ.",
      dimensions: { width: 30, height: 160, scale: 1.0 },
      anchor: [15, 80],
      holdOffset: [0, 0],
      compatibility: { requires: ["hand_anchor"] },
      isBuiltin: true
    },

    // 4. ACTIONS
    {
      id: "action_walk_cycle",
      name: "Bước Đi Tự Tin (Walk Cycle)",
      type: "action",
      category: "locomotion",
      tags: ["walk", "step", "stride"],
      description: "Chuyển động bước đi nhịp nhàng đồng bộ chân, hông và tay đánh đều.",
      duration: 1.0,
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "action_sneak_walk",
      name: "Rón Rén Khom Người (Sneak Walk)",
      type: "action",
      category: "locomotion",
      tags: ["sneak", "careful", "stealth"],
      description: "Dáng đi nhón gót, đầu gối chùng và mắt đảo quanh cảnh giác.",
      duration: 1.5,
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "action_wave_hand",
      name: "Vẫy Tay Chào (Wave Hand)",
      type: "action",
      category: "gesture",
      tags: ["hello", "greet", "bye"],
      description: "Đưa tay lên cao và vẫy qua lại thân thiện.",
      duration: 1.2,
      compatibility: { requires: ["hand_anchor"] },
      isBuiltin: true
    },

    // 5. CARTOON VFX (PHASE 3)
    // A. Emotion VFX
    {
      id: "vfx_sweat_drop",
      name: "Giọt Mồ Hôi Bối Rối (Sweat Drop)",
      type: "vfx",
      category: "emotion",
      tags: ["sweat", "nervous", "embarrassed"],
      description: "Giọt nước màu xanh lam nhạt lăn xuống bên thái dương phong cách anime/cartoon.",
      dimensions: { width: 32, height: 48, scale: 1.0 },
      anchor: [16, 24],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_anger_mark",
      name: "Dấu Gân Giận Dữ (Anger Cross)",
      type: "vfx",
      category: "emotion",
      tags: ["anger", "furious", "vein"],
      description: "Ký hiệu 4 vạch đỏ co giật trên trán khi tức giận cực độ.",
      dimensions: { width: 36, height: 36, scale: 1.0 },
      anchor: [18, 18],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_anger_smoke",
      name: "Khói Bốc Trên Đầu (Anger Smoke)",
      type: "vfx",
      category: "emotion",
      tags: ["anger", "smoke", "rage", "steam"],
      description: "Khói trắng bốc lên cuồn cuộn từ thái dương khi phát hỏa.",
      dimensions: { width: 60, height: 80, scale: 1.0 },
      anchor: [30, 75],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_question_mark",
      name: "Dấu Hỏi Băn Khoăn (Question Mark)",
      type: "vfx",
      category: "emotion",
      tags: ["question", "confused", "curious"],
      description: "Biểu tượng dấu hỏi màu xanh nổi bồng bềnh trên đầu.",
      dimensions: { width: 40, height: 50, scale: 1.0 },
      anchor: [20, 45],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_exclamation_mark",
      name: "Dấu Chấm Than Bất Ngờ (Exclamation Mark)",
      type: "vfx",
      category: "emotion",
      tags: ["alert", "surprise", "notice"],
      description: "Dấu chấm than màu cam giật nảy khi chú ý hoặc ngạc nhiên.",
      dimensions: { width: 36, height: 55, scale: 1.0 },
      anchor: [18, 50],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_love_hearts",
      name: "Trái Tim Tình Yêu (Love Hearts)",
      type: "vfx",
      category: "emotion",
      tags: ["love", "heart", "romance"],
      description: "Trái tim màu hồng bay bổng lãng mạn dập dờn quanh đầu.",
      dimensions: { width: 60, height: 70, scale: 1.0 },
      anchor: [30, 60],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_cartoon_tears",
      name: "Nước Mắt Thác Nước (Cartoon Tears)",
      type: "vfx",
      category: "emotion",
      tags: ["cry", "tears", "sad", "waterfall"],
      description: "Dòng nước mắt phun trào như thác nước hoạt hình từ hai khóe mắt.",
      dimensions: { width: 80, height: 70, scale: 1.0 },
      anchor: [40, 10],
      compatibility: { requires: ["face_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_dizzy_stars",
      name: "Ngôi Sao Choáng Váng (Dizzy Stars)",
      type: "vfx",
      category: "emotion",
      tags: ["dizzy", "stars", "faint", "orbit"],
      description: "Vòng sao vàng xoay tít quanh đầu khi bị choáng.",
      dimensions: { width: 90, height: 40, scale: 1.0 },
      anchor: [45, 20],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_embarrassment_lines",
      name: "Vạch Ngại Ngùng (Embarrassment Lines)",
      type: "vfx",
      category: "emotion",
      tags: ["blush", "shy", "embarrassed"],
      description: "Các vạch gạch chéo ửng đỏ hai bên gò má.",
      dimensions: { width: 50, height: 30, scale: 1.0 },
      anchor: [25, 15],
      compatibility: { requires: ["face_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_shock_lines",
      name: "Tia Nét Giật Mình (Shock Lines)",
      type: "vfx",
      category: "emotion",
      tags: ["shock", "scared", "spikes"],
      description: "Tia nét sắc nhọn giật chớp xung quanh đầu khi sốc.",
      dimensions: { width: 100, height: 100, scale: 1.0 },
      anchor: [50, 50],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_dark_gloom",
      name: "Bóng Đen U Ám (Dark Gloom)",
      type: "vfx",
      category: "emotion",
      tags: ["gloom", "depressed", "shadow"],
      description: "Bóng tối tím sẫm đổ bóng che nửa trên khuôn mặt phong cách anime.",
      dimensions: { width: 90, height: 70, scale: 1.0 },
      anchor: [45, 35],
      compatibility: { requires: ["face_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_idea_bulb",
      name: "Bóng Đèn Ý Tưởng (Idea Bulb)",
      type: "vfx",
      category: "emotion",
      tags: ["idea", "bulb", "eureka", "smart"],
      description: "Bóng đèn vàng phát sáng bừng nở trên đầu khi nảy ra sáng kiến.",
      dimensions: { width: 60, height: 75, scale: 1.0 },
      anchor: [30, 70],
      compatibility: { requires: ["head_anchor"] },
      isBuiltin: true
    },

    // B. Action VFX
    {
      id: "vfx_dust_cloud",
      name: "Đám Bụi Cuộn (Dust Cloud)",
      type: "vfx",
      category: "action",
      tags: ["dust", "smoke", "puff", "run"],
      description: "Đám khói bụi hoạt hình cuộn tròn bung ra sau bước chạy.",
      dimensions: { width: 90, height: 70, scale: 1.0 },
      anchor: [45, 65],
      compatibility: { requires: ["feet_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_fight_smoke",
      name: "Khói Đánh Nhau Hoạt Hình (Fight Smoke)",
      type: "vfx",
      category: "action",
      tags: ["fight", "smoke", "brawl", "punch"],
      description: "Khối khói ẩu đả quay cuồng thò nắm đấm, chân đá và sao va chạm, hỗ trợ che nhân vật.",
      dimensions: { width: 180, height: 180, scale: 1.0 },
      anchor: [90, 90],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_impact_flash",
      name: "Chớp Sáng Va Chạm (Impact Flash)",
      type: "vfx",
      category: "action",
      tags: ["impact", "hit", "flash", "strike"],
      description: "Tia sáng sao nhiều cánh bừng lóe tại điểm va chạm đòn đánh.",
      dimensions: { width: 120, height: 120, scale: 1.0 },
      anchor: [60, 60],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_cartoon_explosion",
      name: "Vụ Nổ Hoạt Hình (Cartoon Explosion)",
      type: "vfx",
      category: "action",
      tags: ["explosion", "boom", "blast", "fire"],
      description: "Vụ nổ truyện tranh cam vàng kèm mảnh vỡ bay tỏa.",
      dimensions: { width: 160, height: 160, scale: 1.0 },
      anchor: [80, 80],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_speed_lines",
      name: "Vệt Tốc Độ (Speed Lines)",
      type: "vfx",
      category: "action",
      tags: ["speed", "lines", "fast", "motion"],
      description: "Các đường gạch tốc độ ngang thể hiện chuyển động cực nhanh.",
      dimensions: { width: 300, height: 150, scale: 1.0 },
      anchor: [150, 75],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_shockwave",
      name: "Sóng Xung Kích (Shockwave)",
      type: "vfx",
      category: "action",
      tags: ["shockwave", "wave", "ground", "ring"],
      description: "Vòng tròn sóng xung kích nở rộng trên mặt đất.",
      dimensions: { width: 220, height: 100, scale: 1.0 },
      anchor: [110, 50],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_ground_dust",
      name: "Bụi Bước Chân (Ground Dust)",
      type: "vfx",
      category: "action",
      tags: ["footstep", "dust", "ground"],
      description: "Bụi xịt nhẹ dưới chân khi nhân vật di chuyển hoặc thắng gấp.",
      dimensions: { width: 80, height: 40, scale: 1.0 },
      anchor: [40, 35],
      compatibility: { requires: ["feet_anchor"] },
      isBuiltin: true
    },
    {
      id: "vfx_crash_stars",
      name: "Ngôi Sao Va Chạm (Crash Stars)",
      type: "vfx",
      category: "action",
      tags: ["stars", "crash", "sparks"],
      description: "Chùm sao nhiều màu bắn tung tóe khi va đập.",
      dimensions: { width: 90, height: 90, scale: 1.0 },
      anchor: [45, 45],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_smoke_puff",
      name: "Khói Xuất Hiện (Smoke Puff)",
      type: "vfx",
      category: "action",
      tags: ["poof", "puff", "vanish", "appear"],
      description: "Làn khói poof bung nhanh rồi tan cho cảnh biến mất hoặc xuất hiện.",
      dimensions: { width: 100, height: 100, scale: 1.0 },
      anchor: [50, 50],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_comic_burst",
      name: "Bùng Nổ Truyện Tranh (Comic Burst POW)",
      type: "vfx",
      category: "action",
      tags: ["comic", "burst", "pow", "bam"],
      description: "Bong bóng răng cưa truyện tranh viền đen nổi bật kèm chữ hành động.",
      dimensions: { width: 140, height: 130, scale: 1.0 },
      anchor: [70, 65],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // C. Energy VFX
    {
      id: "vfx_golden_aura",
      name: "Hào Quang Hoàng Kim (Golden Aura)",
      type: "vfx",
      category: "energy",
      tags: ["power", "glow", "energy", "aura"],
      description: "Quầng sáng vàng bừng nở bao quanh nhân vật và các hạt năng lượng bay lên.",
      dimensions: { width: 200, height: 300, scale: 1.0 },
      anchor: [100, 200],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_blue_aura",
      name: "Hào Quang Lam Ngọc (Blue Aura)",
      type: "vfx",
      category: "energy",
      tags: ["power", "blue", "cyan", "spiritual"],
      description: "Hào quang xanh lam huyền ảo bao phủ cơ thể nhân vật.",
      dimensions: { width: 200, height: 300, scale: 1.0 },
      anchor: [100, 200],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_red_aura",
      name: "Hào Quang Huyết Diễm (Red Aura)",
      type: "vfx",
      category: "energy",
      tags: ["power", "rage", "red", "fire"],
      description: "Quầng lửa đỏ rực cuồng nộ bốc cháy quanh thân.",
      dimensions: { width: 200, height: 300, scale: 1.0 },
      anchor: [100, 200],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_energy_ring",
      name: "Vòng Đai Năng Lượng (Energy Ring)",
      type: "vfx",
      category: "energy",
      tags: ["ring", "orbit", "torus", "sci-fi"],
      description: "Vòng đai năng lượng xoay quanh thắt lưng có chiều sâu trước/sau.",
      dimensions: { width: 180, height: 80, scale: 1.0 },
      anchor: [90, 40],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_lightning_energy",
      name: "Tia Điện Quanh Thân (Lightning Energy)",
      type: "vfx",
      category: "energy",
      tags: ["lightning", "electricity", "sparks"],
      description: "Các tia điện xanh trắng chớp giật liên tục quanh cơ thể.",
      dimensions: { width: 140, height: 180, scale: 1.0 },
      anchor: [70, 90],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_body_glow",
      name: "Phát Sáng Cơ Thể (Body Glow)",
      type: "vfx",
      category: "energy",
      tags: ["glow", "silhouette", "soft"],
      description: "Vầng hào quang dịu nhẹ tỏa sáng quanh đường viền cơ thể.",
      dimensions: { width: 160, height: 220, scale: 1.0 },
      anchor: [80, 110],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_power_burst",
      name: "Bùng Phát Năng Lượng (Power Burst)",
      type: "vfx",
      category: "energy",
      tags: ["burst", "nova", "wave"],
      description: "Vòng tròn sóng nova phát nổ từ ngực nhân vật ra toàn khung hình.",
      dimensions: { width: 200, height: 200, scale: 1.0 },
      anchor: [100, 100],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_sparkles",
      name: "Hạt Sáng Lấp Lánh (Sparkles)",
      type: "vfx",
      category: "energy",
      tags: ["sparkles", "glitter", "twinkle", "magic"],
      description: "Các đốm sáng 4 cánh lấp lánh như kim cương.",
      dimensions: { width: 140, height: 140, scale: 1.0 },
      anchor: [70, 70],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // D. Scene VFX
    {
      id: "vfx_camera_shake",
      name: "Rung Chấn Máy Quay (Camera Shake)",
      type: "vfx",
      category: "scene",
      tags: ["camera", "shake", "earthquake", "impact"],
      description: "Rung lắc góc máy điện ảnh tác động lên camera mà không đổi tọa độ nhân vật.",
      dimensions: { width: 100, height: 100, scale: 1.0 },
      anchor: [50, 50],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_screen_flash",
      name: "Chớp Sáng Toàn Cảnh (Screen Flash)",
      type: "vfx",
      category: "scene",
      tags: ["flash", "whiteout", "lightning", "screen"],
      description: "Chớp trắng lóe sáng toàn màn hình tạo điểm nhấn kịch tính.",
      dimensions: { width: 1920, height: 1080, scale: 1.0 },
      anchor: [960, 540],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_vignette",
      name: "Tối Góc Điện Ảnh (Vignette)",
      type: "vfx",
      category: "scene",
      tags: ["vignette", "cinematic", "focus", "dark"],
      description: "Quầng tối 4 góc màn hình tập trung thị giác vào hành động chính.",
      dimensions: { width: 1920, height: 1080, scale: 1.0 },
      anchor: [960, 540],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "vfx_focus_lines",
      name: "Tia Nét Hội Tụ (Focus Lines)",
      type: "vfx",
      category: "scene",
      tags: ["focus", "radial", "speed", "action"],
      description: "Các đường kẻ tốc độ tỏa ra từ tâm màn hình.",
      dimensions: { width: 1920, height: 1080, scale: 1.0 },
      anchor: [960, 540],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // 6. WEATHER & ENVIRONMENT (PHASE 3)
    {
      id: "weather_rain_cinematic",
      name: "Mưa Rơi Điện Ảnh (Cinematic Rain)",
      type: "weather",
      category: "precipitation",
      tags: ["rain", "storm", "wet"],
      description: "Hạt mưa rơi chéo góc theo chiều gió với vệt mờ motion blur và gợn nước chân sàn.",
      parameters: { intensity: "moderate", windAngle: 0.18, speed: 2200, splash: true },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_rain_heavy",
      name: "Mưa To Xối Xả (Heavy Torrential Rain)",
      type: "weather",
      category: "precipitation",
      tags: ["rain", "storm", "heavy", "wet"],
      description: "Cơn mưa lớn xối xả trắng trời kèm hiệu ứng tạt nước mạnh mẽ.",
      parameters: { intensity: "heavy", windAngle: 0.28, speed: 2800, splash: true },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_snow_gentle",
      name: "Tuyết Rơi Êm Đềm (Gentle Snow)",
      type: "weather",
      category: "precipitation",
      tags: ["snow", "winter", "cold"],
      description: "Bông tuyết trắng bồng bềnh lượn lờ rơi chậm trong không khí.",
      parameters: { intensity: "gentle", speed: 70, wind: 30 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_wind_breeze",
      name: "Cơn Gió Hoạt Hình (Cartoon Wind)",
      type: "weather",
      category: "atmosphere",
      tags: ["wind", "breeze", "air", "gust"],
      description: "Luồng gió trắng uốn lượn thổi ngang qua khung cảnh.",
      parameters: { count: 18, speed: 650 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_sunshine_rays",
      name: "Tia Nắng Hoàng Kim (God Rays)",
      type: "weather",
      category: "light",
      tags: ["sun", "rays", "light", "golden"],
      description: "Tia nắng vàng ấm áp chiếu xuyên qua tán cây hoặc cửa sổ.",
      parameters: { count: 8, alphaVal: 0.14 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_fog_mystic",
      name: "Sương Mù Huyền Ảo (Mystic Fog)",
      type: "weather",
      category: "atmosphere",
      tags: ["fog", "mist", "mystery", "haze"],
      description: "Dải sương mù trắng trôi lững lờ sát mặt sàn và ngang tầm mắt.",
      parameters: { density: 0.38, speed: 25 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_storm_thunder",
      name: "Bão Tố Sấm Sét (Thunderstorm)",
      type: "weather",
      category: "storm",
      tags: ["storm", "thunder", "lightning", "rain"],
      description: "Mưa bão dữ dội kèm theo những tia sét chói lòa xé toạc màn đêm.",
      parameters: { rainColor: "#93c5fd", lightning: true },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_env_leaves",
      name: "Lá Thu Vàng Rơi (Autumn Leaves)",
      type: "weather",
      category: "particles",
      tags: ["leaves", "autumn", "nature", "fall"],
      description: "Những chiếc lá phong vàng cam chao liệng rơi xuống đất.",
      parameters: { count: 24, speed: 80 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_env_petals",
      name: "Cánh Hoa Bay (Cherry Petals)",
      type: "weather",
      category: "particles",
      tags: ["petals", "sakura", "cherry", "flower"],
      description: "Cánh hoa anh đào phớt hồng bay phất phơ trong gió.",
      parameters: { count: 32, speed: 60 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "weather_env_fireflies",
      name: "Đom Đóm Phát Sáng (Fireflies)",
      type: "weather",
      category: "particles",
      tags: ["fireflies", "glow", "night", "magic"],
      description: "Những chú đom đóm xanh vàng nhấp nháy phát sáng trong đêm tĩnh mịch.",
      parameters: { count: 18, color: "#a3e635" },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // 7. BACKGROUNDS
    {
      id: "bg_cafe_cozy",
      name: "Quán Café Ấm Cúng (Cozy Café)",
      type: "background",
      category: "indoor",
      tags: ["cafe", "table", "coffee", "cozy"],
      description: "Không gian quán cà phê ấm áp ánh đèn vàng, cửa kính nhìn ra phố hoàng hôn.",
      dimensions: { width: 1280, height: 720, scale: 1.0 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "bg_street_night",
      name: "Khu Phố Ban Đêm (Night Street)",
      type: "background",
      category: "outdoor",
      tags: ["street", "night", "horror", "lamp"],
      description: "Con phố đêm vắng người với ánh đèn đường hiu hắt và bóng tối rình rập.",
      dimensions: { width: 1280, height: 720, scale: 1.0 },
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // 8. COMPOSITE ACTIONS
    {
      id: "composite_fight_cloud",
      name: "Đám Khói Đánh Nhau Hoạt Hình (Fight Cloud)",
      type: "composite_action",
      category: "comic_fight",
      tags: ["fight", "smoke", "brawl", "funny"],
      description: "Hành động 2 nhân vật lao vào nhau, bọc kín trong đám khói hoạt hình quay tít, thò đầu/chân/sao và kết thúc choáng váng.",
      duration: 4.0,
      participants: 2,
      parameters: {
        smokeScale: 1.2,
        shakeIntensity: 0.7,
        rotationSpeed: 1.5,
        popOutRate: 3.0
      },
      tracks: [
        { target: "participants", type: "approach", start: 0.0, end: 0.6 },
        { target: "participants", type: "collision_impact", start: 0.6, end: 0.8 },
        { target: "participants", type: "visibility", start: 0.8, end: 3.5, value: false },
        { target: "effect", type: "vfx", asset: "vfx_dust_cloud", start: 0.8, end: 3.5 },
        { target: "camera", type: "shake", start: 0.8, end: 3.5, intensity: 0.7 },
        { target: "popouts", type: "character_limbs", start: 1.0, end: 3.2, frequency: 0.4 },
        { target: "participants", type: "visibility", start: 3.5, end: 4.0, value: true },
        { target: "participants", type: "expression", start: 3.5, end: 4.0, value: "dizzy" }
      ],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "composite_chase",
      name: "Cuộc Đuổi Bắt Hoạt Hình (Cartoon Chase)",
      type: "composite_action",
      category: "action",
      tags: ["chase", "run", "speed", "funny"],
      description: "Nhân vật A chạy thục mạng phía trước với vệt tốc độ, nhân vật B hùng hổ đuổi sát phía sau.",
      duration: 3.5,
      participants: 2,
      parameters: { speed: 1.8, dustCount: 20 },
      tracks: [
        { target: "leader", type: "action", asset: "action_run", start: 0.0, end: 3.5 },
        { target: "chaser", type: "action", asset: "action_run", start: 0.0, end: 3.5 },
        { target: "scene", type: "vfx", asset: "vfx_speed_lines", start: 0.5, end: 3.5 }
      ],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },
    {
      id: "composite_power_up",
      name: "Bùng Nổ Sức Mạnh (Power Up Surge)",
      type: "composite_action",
      category: "energy",
      tags: ["power", "shout", "surge", "glow"],
      description: "Nhân vật gồng mình, mặt đất rung chuyển, hào quang vàng bùng phát và năng lượng cuộn trào.",
      duration: 3.0,
      participants: 1,
      parameters: { auraColor: "#f59e0b", pulseRate: 2.0 },
      tracks: [
        { target: "character", type: "expression", asset: "expr_angry", start: 0.0, end: 3.0 },
        { target: "character", type: "vfx", asset: "vfx_golden_aura", start: 0.5, end: 3.0 },
        { target: "camera", type: "shake", start: 0.8, end: 2.8, intensity: 0.8 }
      ],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    }
  ];

  for (const item of seedList) {
    const safeId = item.id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = path.join(DATA_DIR, `${safeId}.json`);
    if (!fs.existsSync(filePath)) {
      const fullData = {
        ...item,
        version: 1,
        thumbnail: `/public/assets/${item.type}/${safeId}/thumb.png`,
        filePath: `/public/assets/${item.type}/${safeId}/${item.type === 'prop' ? 'prop.png' : item.type === 'expression' ? 'sprite.png' : item.type === 'weather' ? 'weather.png' : 'vfx.png'}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), "utf-8");
    }
  }
}
