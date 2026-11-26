// engine/v5-asset-prompt-manager.js — AI Image Prompt Management & Generation Package (V5 Phase 2)
// Generates strict, production-ready AI image prompts combined with Visual Style Profile,
// Character Continuity locks, and asset type constraints (transparency, aspect ratio, clean outlines).

import { getStyleProfile, buildCharacterContinuityProfile } from './v5-style-profiles.js';

export const NON_IMAGE_TYPES = new Set([
  'character_rig',
  'anchor_point',
  'action',
  'composite_action',
  'camera',
  'weather'
]);

export function isVisualAssetRequirement(req = {}) {
  const type = req.type || req.category;
  return !NON_IMAGE_TYPES.has(type);
}

export function buildAssetGenerationPrompt(requirement = {}, options = {}) {
  const type = requirement.type || requirement.category || 'prop';

  // Do not generate image prompts for structural / procedural / engine capabilities
  if (NON_IMAGE_TYPES.has(type)) {
    return {
      requirementId: requirement.id,
      isNonImageAsset: true,
      suggestedFilename: '',
      prompt: '',
      negativePrompt: '',
      aspectRatio: '1:1',
      recommendedDimensions: { width: 0, height: 0 },
      transparentBackground: false
    };
  }

  const styleProfileId = requirement.styleProfileId || options.styleProfileId || 'educational_cartoon';
  const style = getStyleProfile(styleProfileId) || {};
  const continuity = buildCharacterContinuityProfile(options.protagonist || 'doc');

  const assetName = requirement.name || requirement.id;
  const assetDesc = requirement.description || '';
  const viewDir = requirement.viewDirection ? `, ${requirement.viewDirection} view` : '';
  const state = requirement.state ? `, ${requirement.state} state` : '';

  let prompt = '';
  let negativePrompt = 'realistic, photorealistic, 3d render, blurry, watermark, text, signature, low quality, grainy, messy';

  if (type === 'prop') {
    prompt = `Flat 2D educational cartoon illustration of a ${assetName}${viewDir}${state}. ${assetDesc ? assetDesc + '. ' : ''}Clean consistent solid outlines, simple flat vector shading, vibrant harmonious palette matching ${style.name || '2D animation'}. Isolated object centered, completely transparent background (PNG alpha cutout), no shadows on ground, no text, no watermark, entire object fully in frame.`;
    negativePrompt += ', background, complex environment, drop shadow, realistic textures';
  } else if (type === 'background') {
    prompt = `Wide 16:9 historical educational cartoon background: ${assetName}. ${assetDesc ? assetDesc + '. ' : ''}Flat 2D animation style with clean linework, vibrant friendly colors, pleasant lighting. Clear floor space in center and foreground for animated characters, atmospheric perspective. No characters, no people, no text, no captions, no watermark.`;
    negativePrompt += ', characters, people, text, labels, foreground obstacles';
  } else if (type === 'character' || type === 'character_part') {
    const lock = continuity.appearanceLock || {};
    prompt = `2D cartoon character asset: ${assetName}, ${continuity.name} (${continuity.role}). Face: ${lock.faceFeatures || 'cartoon face'}, Skin: ${lock.skinColor || '#FFFDF8'}, Hair: ${lock.hairColor || '#D8D8D8'}. Wearing ${requirement.outfit || 'signature outfit'}. Flat 2D vector animation style, crisp uniform outlines, isolated on pure white or transparent background, no text, no watermark.`;
    negativePrompt += ', different face, different hair color, 3d, realistic human skin';
  } else if (type === 'illustration' || type === 'diagram') {
    prompt = `Flat 2D educational diagram illustration: ${assetName}. ${assetDesc ? assetDesc + '. ' : ''}Modern clean cartoon infographic aesthetic, clear visual elements, high contrast outlines, transparent background, isolated graphics, no text, no labels.`;
    negativePrompt += ', confusing clutter, realistic photos, unreadable text';
  } else {
    prompt = `2D cartoon asset: ${assetName}. ${assetDesc ? assetDesc + '. ' : ''}Flat vector animation style, clean outlines, vibrant colors, transparent background, no text, no watermark.`;
  }

  const suggestedFilename = `${requirement.id || 'REQ_ASSET'}.png`;

  return {
    requirementId: requirement.id,
    suggestedFilename,
    prompt,
    negativePrompt,
    aspectRatio: requirement.aspectRatio || (type === 'background' ? '16:9' : '1:1'),
    recommendedDimensions: requirement.recommendedDimensions || (type === 'background' ? { width: 1920, height: 1080 } : { width: 1024, height: 1024 }),
    transparentBackground: requirement.transparentBackground ?? (type !== 'background')
  };
}

export function exportPromptsMarkdown(requirements = [], options = {}) {
  const visualReqs = requirements.filter(isVisualAssetRequirement);
  let md = `# DANH SÁCH PROMPT SINH ẢNH AI — THANH HAI 2D STUDIO V5\n\n`;
  md += `> Tự động tạo bởi Smart Asset Manager V5. Copy từng prompt vào Midjourney, ChatGPT DALL-E, Google Flow, hoặc Stable Diffusion.\n\n`;
  md += `---\n\n`;

  for (let i = 0; i < visualReqs.length; i++) {
    const req = visualReqs[i];
    const pInfo = buildAssetGenerationPrompt(req, options);

    md += `### ${i + 1}. [${req.type.toUpperCase()}] ${req.name || req.id}\n`;
    md += `- **ID Yêu Cầu:** \`${req.id}\`\n`;
    md += `- **File đầu ra khuyến nghị:** \`${pInfo.suggestedFilename}\`\n`;
    md += `- **Kích thước / Tỷ lệ:** ${pInfo.recommendedDimensions.width}x${pInfo.recommendedDimensions.height} (${pInfo.aspectRatio})\n`;
    md += `- **Yêu cầu nền trong suốt (PNG Alpha):** ${pInfo.transparentBackground ? '✅ BẮT BUỘC' : '❌ Nền đầy đủ (16:9)'}\n`;
    md += `- **Số cảnh cần dùng:** ${(req.requiredByScenes || []).length} cảnh (${(req.requiredByScenes || []).join(', ')})\n\n`;
    md += `**Prompt Sinh Ảnh:**\n\`\`\`text\n${pInfo.prompt}\n\`\`\`\n\n`;
    md += `**Negative Prompt:**\n\`\`\`text\n${pInfo.negativePrompt}\n\`\`\`\n\n`;
    md += `---\n\n`;
  }

  return md;
}

export function exportFilenameMappingCsv(requirements = [], options = {}) {
  const visualReqs = requirements.filter(isVisualAssetRequirement);
  let csv = 'requirement_id,suggested_filename,type,name,scenes,transparent,dimensions\n';
  for (const req of visualReqs) {
    const pInfo = buildAssetGenerationPrompt(req, options);
    const scenes = (req.requiredByScenes || []).join(';');
    csv += `"${req.id}","${pInfo.suggestedFilename}","${req.type}","${(req.name || '').replace(/"/g, '""')}","${scenes}","${pInfo.transparentBackground}","${pInfo.recommendedDimensions.width}x${pInfo.recommendedDimensions.height}"\n`;
  }
  return csv;
}
