// engine/v5-prompt-generator.js — AI Director Prompt Generator (V5)
// Generates production-grade, highly structured system and task prompts for ChatGPT / Claude
// ensuring strict JSON Schema adherence, character identity locking, visual beat variety, and missing asset declarations.

export function generateDirectorPrompt(projectContext = {}, capabilities = {}, styleProfile = {}) {
  const title = projectContext.title || 'Dự Án Hoạt Hình 2D';
  const durationMs = projectContext.durationMs || 60000;
  const durationSec = (durationMs / 1000).toFixed(1);
  const script = projectContext.script || '';
  const srt = projectContext.srt || '';
  const styleName = styleProfile.name || 'Hoạt Hình Giáo Dục Hiện Đại';
  const characterProfiles = projectContext.characterProfiles || [];

  return `# PROMPT ĐẠO DIỄN HOẠT HÌNH AI (AI SCENE DIRECTOR PROMPT)
**Dự Án:** "${title}"
**Thời Lượng Mục Tiêu:** ${durationSec} giây (${durationMs} ms)
**Phong Cách Hình Ảnh:** ${styleName}
**Độ Phân Giải:** 1280x720 (16:9) @ 24fps

---

## 1. VAI TRÒ CỦA BẠN (ROLE & MISSION)
Bạn là **Senior Animation Storyboard Director** chuyên về sản xuất video hoạt hình 2D phong cách Vector/Comic giải thích khoa học và kể chuyện.
Nhiệm vụ của bạn là:
1. Đọc và phân tích sâu sắc toàn bộ kịch bản và phụ đề SRT dưới đây.
2. Phân rã câu chuyện thành các phân cảnh trực quan (**Visual Beats**) đa dạng, giàu điện ảnh.
3. KHÔNG giới hạn video ở nhân vật đứng nói đơn điệu. Hãy kết hợp phong phú các loại cảnh:
   - \`CHARACTER_ACTING\`: Nhân vật hành động, làm thí nghiệm, tương tác với môi trường.
   - \`CHARACTER_DIALOGUE\`: Hội thoại đối đáp 2 nhân vật (Two Shot).
   - \`OBJECT_EXPLANATION\`: Cận cảnh mô phỏng linh kiện, máy móc, cấu trúc.
   - \`HISTORICAL_REENACTMENT\`: Tái hiện bối cảnh lịch sử với góc máy trôi chậm.
   - \`DIAGRAM_EXPLANATION\`: Sơ đồ bản vẽ kỹ thuật (Blueprint Grid) hoặc bảng trắng.
   - \`VISUAL_COMPARISON\`: Thẻ so sánh đối đầu trực quan giữa 2 thời kỳ/đối tượng (VS Card).
   - \`TIMELINE_EXPLANATION\`: Biểu đồ dòng thời gian mốc năm.
   - \`COMEDY_ACTION\`: Hành động hài hước hoạt hình (Fight cloud khói ẩu đả, văng sao, ngã ngửa).
4. Phân bổ chính xác mốc thời gian (\`startMs\`, \`endMs\`) khớp 100% với phụ đề giọng đọc.
5. Chỉ định tài nguyên từ danh mục có sẵn hoặc khai báo yêu cầu tài nguyên mới (\`assetRequirements\`).
6. Xuất duy nhất **Scene Plan JSON** tuân thủ 100% JSON Schema V5.1 được cung cấp.

---

## 2. NGUYÊN TẮC BẢO TOÀN DANH TÍNH NHÂN VẬT (CHARACTER CONTINUITY)
${characterProfiles.map(c => `
- **Nhân vật ${c.characterId} (${c.name})**:
  - Vai trò: ${c.role}
  - Da: ${c.appearanceLock?.skinColor || '#FFFDF8'} (Khóa 100%)
  - Tóc: ${c.appearanceLock?.hairColor || 'Chuẩn'} (Khóa 100%)
  - Trang phục hợp lệ: ${(c.availableOutfits || []).join(', ')}
  - Biểu cảm hợp lệ: ${(c.availableExpressions || []).join(', ')}
  - Quy tắc: Tuyệt đối không thay đổi khuôn mặt, tóc, màu da, hoặc tỷ lệ cơ thể qua các cảnh.
`).join('\n')}

---

## 3. TÀI NGUYÊN CÓ THẬT ĐANG CÓ TRONG ENGINE (CAPABILITIES CATALOG)
Chỉ sử dụng các ID tài nguyên dưới đây. TUYỆT ĐỐI KHÔNG TỰ BỊA ĐẶT ID KHÔNG TỒN TẠI:

### Bối Cảnh (Backgrounds):
${(capabilities.backgrounds || []).map(b => `- \`${b.id}\`: ${b.name} (${b.category})`).join('\n')}

### Đạo Cụ (Props):
${(capabilities.props || []).map(p => `- \`${p.id}\`: ${p.name} (Gắn: ${p.anchor})`).join('\n')}

### Biểu Cảm (Expressions):
${(capabilities.expressions || []).map(e => `- \`${e.id}\`: ${e.semantic}`).join('\n')}

### Composite Actions (Hành Động Hoạt Hình Phức Hợp):
${(capabilities.compositeActions || []).map(a => `- \`${a.id}\`: ${a.name} (${a.duration}s)`).join('\n')}

### Góc Máy Quay (Camera Presets):
${(capabilities.cinematography?.cameraPresets || []).map(c => `- \`${c.id}\`: ${c.label} (Zoom ${c.defaultZoom}x)`).join('\n')}

### Chuyển Cảnh (Transitions):
${(capabilities.cinematography?.transitions || []).map(t => `- \`${t.id}\`: ${t.name}`).join('\n')}

---

## 4. QUY TẮC KHAI BÁO TÀI NGUYÊN CÒN THIẾU (MISSING ASSETS)
Nếu kịch bản đòi hỏi một đạo cụ, bối cảnh hoặc hình minh họa mà Engine chưa có trong danh mục trên, bạn **BẮT BUỘC** khai báo vào mảng \`assetRequirements\` theo cấu trúc:
\`\`\`json
{
  "requirementId": "REQ_PROP_001",
  "type": "prop",
  "name": "Tên tài nguyên",
  "description": "Mô tả chi tiết mục đích trong cảnh",
  "requiredByScenes": ["scene_001"],
  "generationPrompt": "Mô tả chi tiết bằng tiếng Anh chuẩn cho Stable Diffusion/Midjourney để sinh ảnh 2D flat comic cutout trong suốt",
  "assetSpecification": {
    "format": "png",
    "transparentBackground": true,
    "recommendedWidth": 2048,
    "recommendedHeight": 2048
  },
  "suggestedFilename": "REQ_PROP_001.png"
}
\`\`\`

---

## 5. DỮ LIỆU ĐẦU VÀO DỰ ÁN (PROJECT INPUT DATA)

### Toàn Bộ Kịch Bản (Full Script):
\`\`\`text
${script}
\`\`\`

### Phụ Đề & Mốc Thời Gian SRT (Subtitles Timeline):
\`\`\`text
${srt}
\`\`\`

---

## 6. ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (STRICT JSON OUTPUT)
Bạn phải trả về duy nhất một khối mã JSON hợp lệ (không kèm lời chào mở đầu hay kết thúc), tuân thủ cấu trúc sau:

\`\`\`json
{
  "schemaVersion": "5.1",
  "project": {
    "id": "${projectContext.id || 'project_ai_001'}",
    "title": "${title}",
    "durationMs": ${durationMs},
    "resolution": { "width": 1280, "height": 720 },
    "fps": 24
  },
  "styleProfileId": "${styleProfile.id || 'educational_cartoon'}",
  "characterBindings": [
    { "instanceId": "char_doc", "characterId": "doc", "role": "protagonist" },
    { "instanceId": "char_jake", "characterId": "jake", "role": "companion" }
  ],
  "assetRequirements": [],
  "scenes": [
    {
      "id": "scene_001",
      "type": "HISTORICAL_REENACTMENT",
      "startMs": 0,
      "endMs": 7000,
      "narrationText": "Năm 1946, cỗ máy tính điện tử đầu tiên ENIAC ra đời...",
      "visualObjective": "Tái hiện không gian khổng lồ của cỗ máy tính đầu tiên",
      "background": { "assetId": "bg_historical_computer_lab" },
      "characters": [
        {
          "instanceId": "char_doc",
          "characterId": "doc",
          "position": { "x": 0.5, "y": 0.79 },
          "scale": 1.0,
          "outfitId": "outfit_historical_inventor",
          "expressionId": "thoughtful"
        }
      ],
      "visualBeats": [
        { "startMs": 0, "endMs": 3500, "target": "char_doc", "actionId": "thinking" },
        { "startMs": 3500, "endMs": 7000, "target": "char_doc", "actionId": "point_forward", "expressionId": "talking" }
      ],
      "camera": { "preset": "medium_shot", "zoom": 1.15 },
      "transition": { "type": "crossfade", "durationMs": 800 },
      "textGraphics": [
        { "type": "title_card", "title": "SỰ TIẾN HÓA CỦA MÁY TÍNH", "subtitle": "ENIAC 1946 — 30 TẤN" }
      ]
    }
  ]
}
\`\`\`
`;
}
