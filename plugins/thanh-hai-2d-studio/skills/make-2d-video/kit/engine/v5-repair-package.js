// engine/v5-repair-package.js — AI Repair Package Generator (V5)
// Packages validation errors, faulty scenes, and available replacement IDs
// into an actionable prompt for ChatGPT / Claude to fix issues without regenerating the entire project.

import { exportFullAiCapabilityRegistry } from './v5-capability-registry.js';

export function buildAiRepairPackage(scenePlan = {}, validationResult = {}) {
  const errors = validationResult.errors || [];
  const warnings = validationResult.warnings || [];
  const caps = exportFullAiCapabilityRegistry().capabilities;

  // Group errors by scene
  const sceneErrorMap = {};
  for (const err of errors) {
    const sId = err.sceneId || 'GLOBAL';
    if (!sceneErrorMap[sId]) sceneErrorMap[sId] = [];
    sceneErrorMap[sId].push(err);
  }

  // Extract only faulty scene snippets
  const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  const faultySceneSnippets = {};
  for (const s of scenes) {
    if (sceneErrorMap[s.id]) {
      faultySceneSnippets[s.id] = s;
    }
  }

  const repairPrompt = `# YÊU CẦU SỬA LỖI SCENE PLAN (AI REPAIR REQUEST)
Hệ thống Thanh Hai 2D Studio đã kiểm tra Scene Plan bạn vừa tạo và phát hiện **${errors.length} LỖI CẦN SỬA**.
Vui lòng đọc các lỗi dưới đây, xem các tài nguyên thay thế hợp lệ và xuất lại khối JSON đã sửa (Scene Patch JSON).

---

## 1. DANH SÁCH LỖI CỤ THỂ (ERROR REPORT)
${Object.entries(sceneErrorMap).map(([sId, errs]) => `
### Cảnh: ${sId}
${errs.map(e => `- ❌ [${e.code}]: ${e.message}`).join('\n')}
`).join('\n')}

---

## 2. CÁC TÀI NGUYÊN THAY THẾ HỢP LỆ TRONG ENGINE (VALID REPLACEMENTS)
- **Bối Cảnh Hợp Lệ:** ${caps.backgrounds.map(b => `\`${b.id}\``).join(', ')}
- **Đạo Cụ Hợp Lệ:** ${caps.props.map(p => `\`${p.id}\``).join(', ')}
- **Hành Động Hợp Lệ:** ${caps.compositeActions.map(a => `\`${a.id}\``).join(', ')}, \`idle_breathe\`, \`walk_cycle\`, \`run_cycle\`, \`point_forward\`, \`thinking\`
- **Biểu Cảm Hợp Lệ:** ${caps.expressions.map(e => `\`${e.id}\``).join(', ')}

---

## 3. CÁC PHÂN CẢNH BỊ LỖI CẦN SỬA (FAULTY SCENES JSON)
\`\`\`json
${JSON.stringify(faultySceneSnippets, null, 2)}
\`\`\`

---

## 4. HƯỚNG DẪN XUẤT KẾT QUẢ SỬA LỖI (REPAIR OUTPUT FORMAT)
Hãy trả về duy nhất một khối mã JSON hợp lệ chứa các cảnh đã được sửa chữa:
\`\`\`json
{
  "patchType": "AI_SCENE_REPAIR",
  "scenes": [
    /* Chỉ trả về các scene đã được sửa ID tài nguyên hoặc mốc thời gian */
  ]
}
\`\`\`
`;

  return {
    errorCount: errors.length,
    sceneErrors: sceneErrorMap,
    faultySceneSnippets,
    repairPromptMarkdown: repairPrompt
  };
}
