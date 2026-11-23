/**
 * lib/asset-validator.mjs
 * Validation and compatibility checker for Universal Animation & Asset Library (V4)
 * Enforces schema compliance, security (no path traversal, no unsafe scripts), and rig compatibility.
 */

export const ASSET_TYPES = [
  "expression",
  "outfit",
  "prop",
  "action",
  "vfx",
  "weather",
  "background",
  "composite_action"
];

export const ASSET_TYPE_LABELS = {
  expression: "Biểu Cảm (Expression)",
  outfit: "Trang Phục (Outfit)",
  prop: "Đạo Cụ (Prop & Object)",
  action: "Hành Động (Action & Motion)",
  vfx: "Hiệu Ứng (Cartoon VFX)",
  weather: "Thời Tiết (Weather & Environment)",
  background: "Bối Cảnh (Background)",
  composite_action: "Hành Động Phức Hợp (Composite Action)"
};

export const SUPPORTED_BODY_PROFILES = [
  "all",
  "chibi",
  "white_cartoon",
  "imported_layered",
  "stickman"
];

/**
 * Kiểm tra tính an toàn của đường dẫn asset (chống Path Traversal và không dùng đường dẫn tuyệt đối máy chủ)
 * @param {string} p Đường dẫn kiểm tra
 * @returns {boolean}
 */
export function isSafeAssetPath(p) {
  if (!p || typeof p !== "string") return false;
  // Không cho phép path traversal
  if (p.includes("..") || p.includes("\\..") || p.includes("/..")) return false;
  // Không cho phép đường dẫn tuyệt đối Windows (C:\, D:\) hoặc UNC (\\)
  if (/^[a-zA-Z]:[\\\/]/.test(p) || p.startsWith("\\\\")) return false;
  // Phải là relative URL an toàn trong /public/assets/... hoặc /public/... hoặc data: URI
  if (p.startsWith("data:image/")) return true;
  if (p.startsWith("/public/") || p.startsWith("public/") || p.startsWith("/assets/") || p.startsWith("assets/")) return true;
  return false;
}

/**
 * Thẩm định tính hợp lệ của schema Asset V4
 * @param {object} asset Dữ liệu asset
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAssetSchema(asset) {
  const errors = [];
  const warnings = [];

  if (!asset || typeof asset !== "object") {
    return { valid: false, errors: ["Dữ liệu asset phải là một object."], warnings: [] };
  }

  // 1. Kiểm tra ID
  if (!asset.id || typeof asset.id !== "string") {
    errors.push("Thiếu Asset ID duy nhất.");
  } else if (!/^[a-zA-Z0-9_-]{2,64}$/.test(asset.id)) {
    errors.push(`Asset ID "${asset.id}" không hợp lệ. Chỉ chấp nhận ký tự a-z, A-Z, 0-9, dấu gạch nối và gạch dưới (2-64 ký tự).`);
  }

  // 2. Kiểm tra Tên
  if (!asset.name || typeof asset.name !== "string" || asset.name.trim().length === 0) {
    errors.push("Thiếu tên hiển thị của tài nguyên.");
  }

  // 3. Kiểm tra Loại (Type)
  if (!asset.type || !ASSET_TYPES.includes(asset.type)) {
    errors.push(`Loại tài nguyên "${asset.type}" không hợp lệ. Phải là một trong: ${ASSET_TYPES.join(", ")}.`);
  }

  // 4. Kiểm tra Danh mục (Category)
  if (!asset.category || typeof asset.category !== "string") {
    warnings.push("Tài nguyên nên có phân loại danh mục (category). Đang dùng 'general'.");
  }

  // 5. Kiểm tra Thumbnail & File Path
  if (asset.thumbnail && !isSafeAssetPath(asset.thumbnail)) {
    errors.push("Đường dẫn thumbnail không an toàn hoặc chứa ký tự bị cấm.");
  }

  if (asset.filePath && !isSafeAssetPath(asset.filePath)) {
    errors.push("Đường dẫn file asset (filePath) không an toàn hoặc chứa ký tự bị cấm.");
  }

  // 6. Kiểm tra Kích thước & Điểm neo (Anchor/Pivot)
  if (asset.dimensions) {
    if (typeof asset.dimensions.width !== "number" || typeof asset.dimensions.height !== "number") {
      warnings.push("Kích thước dimensions (width, height) nên là giá trị số.");
    }
  }

  if (asset.anchor) {
    if (!Array.isArray(asset.anchor) || asset.anchor.length < 2 || typeof asset.anchor[0] !== "number" || typeof asset.anchor[1] !== "number") {
      warnings.push("Điểm neo (anchor/pivot) nên là mảng tọa độ [x, y].");
    }
  }

  // 7. Kiểm tra Điều kiện tương thích (Compatibility)
  if (asset.compatibility) {
    if (asset.compatibility.bodyProfile && !Array.isArray(asset.compatibility.bodyProfile)) {
      warnings.push("compatibility.bodyProfile nên là một mảng các kiểu thân tương thích.");
    }
  }

  // 8. Đối với Composite Action: Kiểm tra cấu trúc tracks
  if (asset.type === "composite_action") {
    if (typeof asset.duration !== "number" || asset.duration <= 0) {
      errors.push("Composite Action bắt buộc phải có thời lượng (duration) lớn hơn 0 giây.");
    }
    if (asset.tracks && !Array.isArray(asset.tracks)) {
      errors.push("Composite Action tracks phải là một mảng các lớp diễn hoạt.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Kiểm tra tính tương thích giữa một Asset và Nhân vật / Bối cảnh đích
 * @param {object} asset Tài nguyên trong thư viện
 * @param {object} target Nhân vật hoặc bối cảnh nhận asset
 * @returns {{ compatible: boolean, reason?: string, fallbackAvailable: boolean, fallback?: any }}
 */
export function checkAssetCompatibility(asset, target = {}) {
  if (!asset) {
    return { compatible: false, reason: "Tài nguyên không tồn tại.", fallbackAvailable: false };
  }

  const compat = asset.compatibility || {};
  const targetEngine = target.characterEngine || target.type || "white_cartoon";

  // Kiểm tra bodyProfile
  if (compat.bodyProfile && Array.isArray(compat.bodyProfile) && !compat.bodyProfile.includes("all")) {
    if (!compat.bodyProfile.includes(targetEngine)) {
      return {
        compatible: false,
        reason: `Tài nguyên "${asset.name}" chỉ tương thích với hệ thân [${compat.bodyProfile.join(", ")}], nhưng nhân vật là "${targetEngine}".`,
        fallbackAvailable: true,
        fallback: asset.fallback || null
      };
    }
  }

  // Kiểm tra yêu cầu năng lực rig (requires)
  if (compat.requires && Array.isArray(compat.requires)) {
    for (const req of compat.requires) {
      if (req === "hand_anchor" && target.hasHandAnchor === false) {
        return {
          compatible: false,
          reason: `Tài nguyên yêu cầu điểm neo bàn tay (${req}) nhưng nhân vật không hỗ trợ.`,
          fallbackAvailable: true,
          fallback: { mode: "scene_relative" }
        };
      }
      if (req === "head_anchor" && target.hasHeadAnchor === false) {
        return {
          compatible: false,
          reason: `Tài nguyên yêu cầu điểm neo đỉnh đầu (${req}) nhưng nhân vật không hỗ trợ.`,
          fallbackAvailable: true,
          fallback: { mode: "center_offset" }
        };
      }
    }
  }

  return {
    compatible: true,
    fallbackAvailable: false
  };
}
