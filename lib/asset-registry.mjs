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

  // Khởi tạo các asset built-in chuẩn nếu thư mục rỗng
  const existingFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
  if (existingFiles.length === 0) {
    seedBuiltinAssets();
  }
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

    // 5. CARTOON VFX
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
      id: "vfx_golden_aura",
      name: "Hào Quang Hoàng Kim (Golden Aura)",
      type: "vfx",
      category: "energy",
      tags: ["power", "glow", "energy"],
      description: "Quầng sáng vàng bừng nở bao quanh nhân vật và các hạt năng lượng bay lên.",
      dimensions: { width: 200, height: 300, scale: 1.0 },
      anchor: [100, 200],
      compatibility: { bodyProfile: ["all"] },
      isBuiltin: true
    },

    // 6. WEATHER & ENVIRONMENT
    {
      id: "weather_rain_cinematic",
      name: "Mưa Rơi Điện Ảnh (Cinematic Rain)",
      type: "weather",
      category: "precipitation",
      tags: ["rain", "storm", "wet"],
      description: "Hạt mưa rơi chéo góc theo chiều gió với vệt mờ motion blur và gợn nước chân sàn.",
      parameters: { intensity: 0.8, angle: 15, speed: 1.4, splash: true },
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
      parameters: { intensity: 0.5, speed: 0.6, drift: 1.2 },
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
    const fullData = {
      ...item,
      version: 1,
      thumbnail: `/public/assets/${item.type}/${safeId}/thumb.png`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), "utf-8");
  }
}
