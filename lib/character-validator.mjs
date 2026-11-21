/**
 * lib/character-validator.mjs
 * Bộ kiểm tra lỗi tự động tính toàn vẹn của Character Rig V2 trước khi render
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
  "look_around"
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
  "worried"
];

/**
 * Kiểm tra tính toàn vẹn của cấu hình nhân vật Chibi V2
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

  if (!character.skinColor || !/^#[0-9a-fA-F]{3,8}$/.test(character.skinColor)) {
    warnings.push("Màu da không đúng mã Hex màu chuẩn, đang dùng màu mặc định (#ffdfc4).");
  }

  // 2. Kiểm tra tỷ lệ cơ thể (Proportions) & giới hạn chiều dài tay chân
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

  // 3. Kiểm tra các khớp nối quan trọng (Joint Anchors)
  // Head -> Neck -> Torso -> Shoulders -> Elbows -> Wrists
  // Torso -> Pelvis -> Hips -> Knees -> Ankles
  if (props.brokenJoints && props.brokenJoints.length > 0) {
    errors.push(`Phát hiện đứt gãy khớp xương: ${props.brokenJoints.join(", ")}.`);
  }

  // 4. Kiểm tra trang phục (Clothing Binding)
  const outfit = character.outfit || {};
  if (!outfit.type) {
    warnings.push("Nhân vật chưa có loại trang phục xác định, dùng trang phục mặc định 'casual'.");
  }

  // 5. Kiểm tra góc nhìn yêu cầu (Facing)
  const requestedFacing = context.facing || character.defaultFacing || "three_quarter_right";
  if (!SUPPORTED_FACINGS.includes(requestedFacing)) {
    warnings.push(`Góc nhìn '${requestedFacing}' chưa có asset góc chuyên dụng, chuyển về góc nhìn gần nhất.`);
  }

  // 6. Kiểm tra tiếp xúc mặt đất và ghế (Ground Contact & Seat Alignment)
  const pose = context.pose || character.defaultPose || "stand";
  const isSitting = pose.includes("sit");
  const groundY = context.groundY ?? 0;
  const charY = context.y ?? 0;

  if (!isSitting && Math.abs(charY - groundY) > 25 && context.enforceGround) {
    warnings.push(`Cảnh báo: Nhân vật đang ở độ cao y=${charY}, có nguy cơ bị lơ lửng so với mặt sàn y=${groundY}.`);
  }

  if (isSitting && context.chairHeight != null) {
    if (context.hipY != null && Math.abs(context.hipY - context.chairHeight) > 15) {
      warnings.push(`Cảnh báo: Khớp hông nhân vật (y=${context.hipY}) lệch khỏi mặt ghế (y=${context.chairHeight}).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

