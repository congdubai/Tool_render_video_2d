// lib/auto-validator.mjs — Automatic Pre-Render Quality Validation for White Cartoon 2D
// Validates character color lock, proportions, limb continuity, expressions, scene layers, and actions.

import fs from 'node:fs';
import path from 'node:path';

export const VALID_EXPRESSIONS = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'confused',
  'laughing', 'terrified', 'shocked', 'smirk', 'relief', 'determined'
];

export const LOCKED_WHITE_CARTOON = {
  skin: ['#FFFDF8', '#fbfbfe', '#f8fafc', '#ffffff'],
  outline: ['#20202A', '#111827', '#0f172a', '#1e293b']
};

/**
 * 1. Validate Character Colors
 */
export function validateCharacterColors(char = {}, context = {}) {
  const issues = [];
  const skin = (char.skin || char.skinColor || '').toUpperCase();
  const outline = (char.outline || char.outlineColor || '').toUpperCase();

  // Kiểm tra da nhân vật không được là màu đen (#000000, #0E0B12, v.v.)
  const blackSkinHexes = ['#000000', '#0E0B12', '#111827', '#0F172A', '#1E293B', '#120E16'];
  if (blackSkinHexes.includes(skin)) {
    issues.push({
      type: 'ERROR',
      code: 'ERR_CHAR_BLACK_SKIN',
      message: `Nhân vật ${char.name || char.id || 'Unknown'} bị lỗi da màu đen (${skin}). Bắt buộc dùng màu da trắng ngà #FFFDF8.`,
      context
    });
  }

  // Khuyến nghị khóa màu chuẩn #FFFDF8
  if (skin && !LOCKED_WHITE_CARTOON.skin.map(s => s.toUpperCase()).includes(skin)) {
    issues.push({
      type: 'WARNING',
      code: 'WARN_CHAR_SKIN_COLOR',
      message: `Màu da nhân vật (${skin}) khác màu chuẩn #FFFDF8.`,
      context
    });
  }

  return issues;
}

/**
 * 2. Validate Character Proportion Consistency
 */
export function validateProportions(pose, context = {}) {
  const issues = [];
  if (!pose || typeof pose !== 'object') return issues;

  const { head, sh, hip, eF, hF, kF, fF } = pose;
  if (!head || !sh || !hip) return issues;

  // Tính chiều dài thân (torso: sh -> hip)
  const torsoLen = Math.hypot(sh[0] - hip[0], sh[1] - hip[1]);
  if (torsoLen < 20 || torsoLen > 80) {
    issues.push({
      type: 'WARNING',
      code: 'WARN_TORSO_PROPORTION',
      message: `Tỷ lệ thân bất thường: độ dài thân = ${torsoLen.toFixed(1)}px (kỳ vọng 35 - 55px).`,
      context
    });
  }

  // Tỷ lệ cổ - đầu (head -> sh)
  const neckLen = Math.hypot(head[0] - sh[0], head[1] - sh[1]);
  if (neckLen < 25 || neckLen > 85) {
    issues.push({
      type: 'WARNING',
      code: 'WARN_HEAD_DETACHED',
      message: `Khối đầu có dấu hiệu bị kéo giãn hoặc tách rời khỏi vai: khoảng cách = ${neckLen.toFixed(1)}px.`,
      context
    });
  }

  return issues;
}

/**
 * 3. Validate Limb Connection (Seamless Bones)
 */
export function validateLimbConnections(pose, context = {}) {
  const issues = [];
  if (!pose || typeof pose !== 'object') return issues;

  const { sh, eF, hF, hip, kF, fF } = pose;

  // Kiểm tra tay gần (sh -> eF -> hF)
  if (sh && eF && hF) {
    const upperArm = Math.hypot(eF[0] - sh[0], eF[1] - sh[1]);
    const foreArm = Math.hypot(hF[0] - eF[0], hF[1] - eF[1]);
    if (upperArm > 65 || foreArm > 65) {
      issues.push({
        type: 'WARNING',
        code: 'WARN_ARM_DISLOCATED',
        message: `Khớp tay bị kéo giãn quá mức: bắp tay = ${upperArm.toFixed(1)}px, cẳng tay = ${foreArm.toFixed(1)}px.`,
        context
      });
    }
  }

  // Kiểm tra chân gần (hip -> kF -> fF)
  if (hip && kF && fF) {
    const thigh = Math.hypot(kF[0] - hip[0], kF[1] - hip[1]);
    const shin = Math.hypot(fF[0] - kF[0], fF[1] - kF[1]);
    if (thigh > 75 || shin > 75) {
      issues.push({
        type: 'WARNING',
        code: 'WARN_LEG_DISLOCATED',
        message: `Khớp chân bị kéo giãn quá mức: đùi = ${thigh.toFixed(1)}px, cẳng chân = ${shin.toFixed(1)}px.`,
        context
      });
    }
  }

  return issues;
}

/**
 * 4. Validate Expression Integrity
 */
export function validateExpression(expr, context = {}) {
  const issues = [];
  if (!expr) return issues;

  const exprName = typeof expr === 'string' ? expr : (expr.expr || expr.a || 'neutral');
  if (!VALID_EXPRESSIONS.includes(exprName)) {
    issues.push({
      type: 'WARNING',
      code: 'WARN_UNKNOWN_EXPRESSION',
      message: `Biểu cảm '${exprName}' không thuộc thư viện chuẩn Expression Rig V3.`,
      context
    });
  }

  return issues;
}

/**
 * 5. Validate Action Coverage
 */
export function validateActionCoverage(shots = [], context = {}) {
  const issues = [];
  if (!shots || shots.length === 0) {
    issues.push({
      type: 'ERROR',
      code: 'ERR_NO_SHOTS',
      message: 'Dự án không có bất kỳ cảnh (shot) nào được định nghĩa.',
      context
    });
    return issues;
  }

  shots.forEach((shot, idx) => {
    const dur = shot.duration || shot.dur || (shot.end ? shot.end - shot.start : 0);
    if (dur <= 0) {
      issues.push({
        type: 'WARNING',
        code: 'WARN_SHOT_ZERO_DURATION',
        message: `Cảnh ${shot.id || `Shot_${idx + 1}`} có thời lượng <= 0 giây.`,
        context: { shotId: shot.id, index: idx }
      });
    }
  });

  return issues;
}

/**
 * Toàn diện kiểm tra dự án trước Render (Full Quality Validation)
 */
export function validateProjectPreRender(projectDir, projectConfig = {}, shotsData = []) {
  const allIssues = [];

  // 1. Kiểm tra cấu hình engine và nhân vật
  const charEngine = projectConfig.character || 'white_cartoon';
  if (charEngine !== 'white_cartoon' && charEngine !== 'white_cartoon_2d' && charEngine !== 'white-cartoon-2d') {
    allIssues.push({
      type: 'WARNING',
      code: 'WARN_NOT_WHITE_CARTOON',
      message: `Dự án đang dùng engine '${charEngine}', không phải White Cartoon 2D tiêu chuẩn.`
    });
  }

  // 2. Kiểm tra Cast (các nhân vật)
  const castFile = path.join(projectDir, 'scenes', 'cast.js');
  if (fs.existsSync(castFile)) {
    const content = fs.readFileSync(castFile, 'utf8');
    // Regex tìm các định nghĩa nhân vật
    const skinMatches = content.match(/skin:\s*['"]([^'"]+)['"]/g) || [];
    skinMatches.forEach(sm => {
      const hex = sm.replace(/skin:\s*['"]/, '').replace(/['"]/, '');
      allIssues.push(...validateCharacterColors({ skin: hex }, { file: 'scenes/cast.js' }));
    });
  }

  // 3. Kiểm tra Shots và độ phủ Action
  allIssues.push(...validateActionCoverage(shotsData));

  // Phân loại kết quả
  const errors = allIssues.filter(i => i.type === 'ERROR');
  const warnings = allIssues.filter(i => i.type === 'WARNING');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalIssues: allIssues.length,
      errorCount: errors.length,
      warningCount: warnings.length
    }
  };
}
