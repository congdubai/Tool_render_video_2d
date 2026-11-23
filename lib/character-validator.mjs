/**
 * lib/character-validator.mjs
 * Bộ kiểm tra lỗi tự động tính toàn vẹn của Character Rig V3 (Mode A: Built-in & Mode B: Imported)
 */

export const SUPPORTED_FACINGS = [
  "front",
  "three_quarter_left",
  "three_quarter_right",
  "side_left",
  "side_right",
  "back"
];

export const SUPPORTED_POSES = [
  "idle",
  "stand",
  "standing",
  "walk",
  "walking",
  "run",
  "running",
  "sit",
  "sitting",
  "sit_chair",
  "standing_up",
  "wave",
  "waving",
  "point",
  "pointing",
  "talk",
  "talking",
  "hold_object",
  "phone",
  "cup",
  "look_around",
  "jump",
  "surprised"
];

export const SUPPORTED_EXPRESSIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "confused",
  "thinking",
  "laughing",
  "worried",
  "scared",
  "talking"
];

/**
 * Kiểm tra tính toàn vẹn của cấu hình nhân vật (Mode A hoặc Mode B)
 * @param {object} character Cấu hình nhân vật
 * @param {object} [context] Ngữ cảnh cảnh quay (pose, facing, action, chair)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateCharacterRig(character, context = {}) {
  const errors = [];
  const warnings = [];

  if (!character) {
    return {
      valid: false,
      errors: ["Dữ liệu nhân vật trống (null hoặc undefined)."],
      warnings
    };
  }

  // 1. Kiểm tra Identity
  if (!character.id || typeof character.id !== "string") {
    errors.push("Thiếu Character ID cố định.");
  }

  const isImported = character.type === "imported" || !!character.parts || !!character.importType;

  if (isImported) {
    // ================= MODE B: IMPORTED CHARACTER VALIDATION =================
    const parts = character.parts || {};
    const partKeys = Object.keys(parts);

    if (partKeys.length === 0) {
      errors.push("Nhân vật import chưa có bất kỳ bộ phận (part) nào trong cấu hình rig.");
    }

    // Kiểm tra root bone (thường là torso hoặc root)
    const isRoot = (p) => !p.parent || p.parent === 'root' || p.parent === 'scene' || p.parent === '';
    const rootBones = partKeys.filter(k => isRoot(parts[k]));
    if (rootBones.length === 0 && partKeys.length > 0) {
      errors.push("Thiếu khớp gốc (Root Bone) không có cha. Cần ít nhất 1 bộ phận làm gốc (vd: Torso).");
    } else if (rootBones.length > 2) {
      warnings.push(`Có ${rootBones.length} khớp gốc độc lập (${rootBones.join(', ')}). Khuyến nghị liên kết về một gốc chung.`);
    }

    // Kiểm tra tính hợp lệ của phân cấp cha/con (Hierarchical loops)
    for (const key of partKeys) {
      const part = parts[key];
      if (part.parent && !isRoot(part) && !parts[part.parent]) {
        errors.push(`Bộ phận "${key}" tham chiếu đến khớp cha không tồn tại ("${part.parent}").`);
      }

      // Phát hiện vòng lặp cha-con (Circular dependency)
      let curr = part.parent;
      const visited = new Set([key]);
      while (curr && !isRoot({ parent: curr }) && parts[curr]) {
        if (visited.has(curr)) {
          errors.push(`Phát hiện vòng lặp phân cấp xương vô hạn tại bộ phận "${key}" -> "${curr}".`);
          break;
        }
        visited.add(curr);
        curr = parts[curr].parent;
      }

      // Kiểm tra pivot
      if (part.pivotX != null && (typeof part.pivotX !== "number" || isNaN(part.pivotX))) {
        warnings.push(`Điểm xoay pivotX của "${key}" không phải là số hợp lệ.`);
      }
      if (part.pivotY != null && (typeof part.pivotY !== "number" || isNaN(part.pivotY))) {
        warnings.push(`Điểm xoay pivotY của "${key}" không phải là số hợp lệ.`);
      }

      // Kiểm tra image asset
      if (!part.image && !part.imagePath && !part.dataUrl) {
        warnings.push(`Bộ phận "${key}" chưa có đường dẫn hình ảnh asset.`);
      }
    }

    // Kiểm tra Expression Manager
    if (character.expressions) {
      for (const expr of Object.keys(character.expressions)) {
        if (!SUPPORTED_EXPRESSIONS.includes(expr)) {
          warnings.push(`Biểu cảm "${expr}" không nằm trong danh mục chuẩn 8 biểu cảm hoạt hình.`);
        }
      }
    }

  } else {
    // ================= MODE A: BUILT-IN CHIBI / WHITE CARTOON VALIDATION =================
    if (!character.skinColor || !/^#[0-9a-fA-F]{3,8}$/.test(character.skinColor)) {
      warnings.push("Màu da không đúng mã Hex màu chuẩn, đang dùng màu mặc định (#ffdfc4).");
    }

    // Kiểm tra tỷ lệ cơ thể (Proportions) & giới hạn chiều dài tay chân
    const props = character.proportions || {};
    const torsoL = props.torsoLength ?? 36;
    const armL = props.armLength ?? 34;
    const legL = props.legLength ?? 46;
    const headS = props.headScale ?? 1.0;

    if (armL < 20 || armL > 60) {
      errors.push(`Chiều dài cánh tay (${armL}) vượt quá giới hạn an toàn [20, 60] units.`);
    }

    if (legL < 25 || legL > 75) {
      errors.push(`Chiều dài chân (${legL}) vượt quá giới hạn an toàn [25, 75] units.`);
    }

    if (torsoL < 20 || torsoL > 60) {
      errors.push(`Chiều dài thân (${torsoL}) ngoài phạm vi chuẩn [20, 60] units.`);
    }

    if (headS < 0.6 || headS > 1.6) {
      warnings.push(`Tỉ lệ đầu (${headS}) bất thường so với phong cách Chibi V9 [0.8, 1.3].`);
    }

    // Kiểm tra phụ kiện xung đột
    const outfit = character.outfit || {};
    const accessories = outfit.accessories || [];
    if (accessories.includes("backpack") && context.pose === "sit_chair") {
      warnings.push("Đang đeo ba lô khi ngồi ghế có thể gây chồng lấn thị giác phía sau lưng.");
    }

    // Kiểm tra ngữ cảnh tương tác
    if (context.action === "hold_object" && !context.heldObject) {
      warnings.push("Hành động cầm nắm (hold_object) nhưng chưa khai báo đạo cụ đi kèm.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
