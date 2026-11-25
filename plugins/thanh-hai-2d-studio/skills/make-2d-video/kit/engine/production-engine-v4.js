// engine/production-engine-v4.js — Production Workflow, Scene Templates, Continuity & Project Persistence (V4)
// Implements 9 Scene Templates, Character Continuity Guardian, Project Asset Auditing,
// Autosave & Recovery, and secure ZIP Project Export / Import.

import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { createDefaultScene, SCENE_SCHEMA_VERSION } from './scene-model-v4.js';
import { listAssets, getAsset } from '../../lib/asset-registry.mjs';

/**
 * 1. SCENE TEMPLATE LIBRARY (9 Core Production Templates)
 */
export const SCENE_TEMPLATES = {
  template_introduction: {
    id: 'template_introduction',
    name: '1. Cảnh Giới Thiệu (Introduction Scene)',
    category: 'hook',
    duration: 6.0,
    description: 'Nhân vật đứng trung tâm, tiêu đề lớn hiển thị cùng hiệu ứng máy quay reveal chào đón khán giả.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Giới Thiệu',
        duration: options.duration || 6.0,
        camera: { preset: 'reveal_shot', zoom: 1.15 },
        characters: [{ role: 'presenter', characterId: options.characterId || 'doc', outfitId: options.outfitId || 'outfit_casual_hoodie', position: [640, 580] }],
        textGraphics: [{ type: 'title_card', title: options.title || 'TIÊU ĐỀ VIDEO HOẠT HÌNH', subtitle: options.subtitle || 'Thanh Hai 2D Studio V4 Production', start: 0.0, end: 5.5 }]
      });
    }
  },

  template_explanation: {
    id: 'template_explanation',
    name: '2. Cảnh Thuyết Trình & Sơ Đồ (Explanation Scene)',
    category: 'educational',
    duration: 7.0,
    description: 'Nhân vật đứng bên trái giải thích, bên phải hiển thị khung bảng thông số và đồ họa kiến thức.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Thuyết Trình',
        duration: options.duration || 7.0,
        camera: { preset: 'medium_shot', zoom: 1.15 },
        characters: [{ role: 'explainer', characterId: options.characterId || 'doc', outfitId: options.outfitId || 'outfit_scientist_labcoat', position: [360, 580] }],
        textGraphics: [{ type: 'callout_box', x: 580, y: 150, w: 420, h: 220, title: options.title || 'THÔNG SỐ CHÍNH:', items: options.items || ['Điểm nhấn 1', 'Điểm nhấn 2', 'Điểm nhấn 3'], start: 0.0, end: 7.0 }]
      });
    }
  },

  template_historical: {
    id: 'template_historical',
    name: '3. Cảnh Bối Cảnh Lịch Sử (Historical Reenactment)',
    category: 'narrative',
    duration: 8.0,
    description: 'Bối cảnh xưởng hoặc phòng máy tính lịch sử, nhân vật mặc âu phục cổ điển tương ứng.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Lịch Sử',
        duration: options.duration || 8.0,
        background: { id: options.backgroundId || 'bg_historical_computer_lab', groundY: 0.82 },
        characters: [{ role: 'historian', characterId: options.characterId || 'doc', outfitId: options.outfitId || 'outfit_scientist_labcoat', position: [640, 590] }],
        camera: { preset: 'wide_shot', keyframes: [{ t: 0.0, x: -40, zoom: 1.05 }, { t: 1.0, x: 40, zoom: 1.12 }] }
      });
    }
  },

  template_discovery: {
    id: 'template_discovery',
    name: '4. Cảnh Phát Minh & Eureka (Discovery Scene)',
    category: 'storytelling',
    duration: 6.0,
    description: 'Nhân vật trầm ngâm suy nghĩ rồi bừng nở ý tưởng Eureka với bóng đèn phát sáng trên đầu.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Phát Minh Eureka',
        duration: options.duration || 6.0,
        compositeActions: [{ id: 'composite_storytelling', startTime: 0.0, duration: 6.0, roles: { actor: options.characterId || 'doc' } }],
        camera: { preset: 'reaction_shot', zoom: 1.25 }
      });
    }
  },

  template_failure: {
    id: 'template_failure',
    name: '5. Cảnh Thất Bại & Khói Bốc (Failure & Smoke Reaction)',
    category: 'comic',
    duration: 5.0,
    description: 'Thí nghiệm phát nổ bốc khói mịt mù, nhân vật giật mình kinh ngạc nhưng giữ nguyên ngoại hình.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Thử Nghiệm Thất Bại',
        duration: options.duration || 5.0,
        vfx: [{ type: 'vfx_fight_smoke', layer: 'front_character', start: 0.5, end: 4.5, scale: 1.2 }],
        camera: { preset: 'reaction_shot', shake: 12.0 }
      });
    }
  },

  template_success: {
    id: 'template_success',
    name: '6. Cảnh Thành Công Rực Rỡ (Success Scene)',
    category: 'storytelling',
    duration: 6.0,
    description: 'Phát minh hoạt động trơn tru, nhân vật mừng rỡ với hào quang năng lượng hoàng kim.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Đột Phá Thành Công',
        duration: options.duration || 6.0,
        vfx: [{ type: 'vfx_golden_aura', layer: 'behind_character', start: 0.5, end: 5.5, scale: 1.4 }],
        camera: { preset: 'reveal_shot', zoom: 1.2 }
      });
    }
  },

  template_comparison: {
    id: 'template_comparison',
    name: '7. Cảnh So Sánh Đối Trọng (Comparison Scene)',
    category: 'educational',
    duration: 7.0,
    description: 'Hiển thị thẻ so sánh song song giữa hai thế hệ thiết bị hoặc hai giải pháp kỹ thuật.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh So Sánh Trực Quan',
        duration: options.duration || 7.0,
        background: { id: 'bg_diagram_grid' },
        textGraphics: [{
          type: 'comparison_card',
          leftTitle: options.leftTitle || 'MÁY TÍNH 1946 (ENIAC)',
          leftText: options.leftText || '30 Tấn • 18,000 Đèn Chân Không',
          rightTitle: options.rightTitle || 'ĐIỆN THOẠI HIỆN ĐẠI',
          rightText: options.rightText || '180g • Hàng Tỷ Transistor',
          start: 0.0,
          end: 7.0
        }]
      });
    }
  },

  template_timeline: {
    id: 'template_timeline',
    name: '8. Cảnh Dòng Thời Gian Lịch Sử (Timeline Scene)',
    category: 'educational',
    duration: 6.0,
    description: 'Hiển thị huy hiệu mốc năm tháng lịch sử kèm chú thích sự kiện kỹ thuật.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Dòng Thời Gian',
        duration: options.duration || 6.0,
        textGraphics: [{
          type: 'timeline_badge',
          year: options.year || '1947',
          event: options.event || 'Phát minh Transistor thu nhỏ',
          start: 0.0,
          end: 6.0
        }]
      });
    }
  },

  template_conversation: {
    id: 'template_conversation',
    name: '9. Cảnh Khẩu Chiến & Tranh Luận (Conversation Scene)',
    category: 'dialogue',
    duration: 6.0,
    description: 'Hai nhân vật đối đầu hoặc trò chuyện qua lại, đổi lượt biểu cảm và cử chỉ.',
    create(options = {}) {
      return createDefaultScene(options.id, {
        name: options.name || 'Cảnh Trò Chuyện & Tranh Luận',
        duration: options.duration || 6.0,
        compositeActions: [{
          id: 'composite_cartoon_argument',
          startTime: 0.0,
          duration: 6.0,
          roles: { debater_a: 'doc', debater_b: 'alex' }
        }],
        camera: { preset: 'two_shot', zoom: 1.15 }
      });
    }
  }
};

/**
 * 2. CHARACTER CONTINUITY GUARDIAN
 * Audits character consistency across all scenes in the project timeline.
 */
export function validateCharacterContinuity(projectOrScenes = []) {
  const issues = [];
  const characterTrackers = {};
  const scenes = Array.isArray(projectOrScenes) ? projectOrScenes : (projectOrScenes?.scenes || []);

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const chars = s.characters || [];

    for (const c of chars) {
      const cid = c.characterId || c.id;
      if (!cid) continue;

      if (!characterTrackers[cid]) {
        characterTrackers[cid] = {
          firstScene: s.id,
          skin: c.skinColor || c.skin,
          hairColor: c.hairColor,
          scale: c.scale || 1.0,
          outfit: c.outfitId || c.outfit
        };
      } else {
        const prev = characterTrackers[cid];
        const curSkin = c.skinColor || c.skin;

        // 1. Check skin color continuity
        if (curSkin && prev.skin && curSkin !== prev.skin) {
          issues.push({
            severity: 'ERROR',
            characterId: cid,
            sceneId: s.id,
            message: `Màu da nhân vật "${cid}" bị thay đổi bất thường từ ${prev.skin} sang ${curSkin} tại cảnh "${s.name}".`
          });
        }

        // 2. Check hair color continuity
        if (c.hairColor && prev.hairColor && c.hairColor !== prev.hairColor) {
          issues.push({
            severity: 'WARNING',
            characterId: cid,
            sceneId: s.id,
            message: `Màu tóc nhân vật "${cid}" bị thay đổi bất thường (hairColor: ${prev.hairColor} -> ${c.hairColor}) tại cảnh "${s.name}".`
          });
        }

        // 3. Check drastic unintended scale jumps
        if (c.scale && prev.scale && Math.abs(c.scale - prev.scale) > 0.8) {
          issues.push({
            severity: 'WARNING',
            characterId: cid,
            sceneId: s.id,
            message: `Tỉ lệ kích thước nhân vật "${cid}" thay đổi đột ngột (${prev.scale}x -> ${c.scale}x).`
          });
        }
      }
    }
  }

  return {
    passed: issues.filter(i => i.severity === 'ERROR').length === 0,
    issues
  };
}

/**
 * 3. PROJECT ASSET AUDITOR
 * Lists all used, missing, and unused assets in project.
 */
export function auditProjectAssets(project = {}) {
  const scenes = project.scenes || [];
  const usedMap = {
    characters: new Set(),
    backgrounds: new Set(),
    outfits: new Set(),
    props: new Set(),
    actions: new Set(),
    vfx: new Set(),
    audio: new Set()
  };

  for (const s of scenes) {
    if (s.background?.id) usedMap.backgrounds.add(s.background.id);
    if (s.narration?.audioFile) usedMap.audio.add(s.narration.audioFile);
    if (s.audio?.bgmTrack) usedMap.audio.add(s.audio.bgmTrack);

    for (const c of (s.characters || [])) {
      if (c.characterId) usedMap.characters.add(c.characterId);
      if (c.outfitId) usedMap.outfits.add(c.outfitId);
    }
    for (const p of (s.props || [])) {
      if (p.propId || p.id) usedMap.props.add(p.propId || p.id);
    }
    for (const a of (s.actions || [])) {
      if (a.actionId || a.id) usedMap.actions.add(a.actionId || a.id);
    }
    for (const ca of (s.compositeActions || [])) {
      if (ca.id) usedMap.actions.add(ca.id);
    }
    for (const v of (s.vfx || [])) {
      if (v.vfxId || v.type) usedMap.vfx.add(v.vfxId || v.type);
    }
  }

  const usedSummary = {
    characters: Array.from(usedMap.characters),
    backgrounds: Array.from(usedMap.backgrounds),
    outfits: Array.from(usedMap.outfits),
    props: Array.from(usedMap.props),
    actions: Array.from(usedMap.actions),
    vfx: Array.from(usedMap.vfx),
    audio: Array.from(usedMap.audio)
  };

  // Check missing assets in registry
  const missing = [];
  for (const oid of usedSummary.outfits) {
    if (!getAsset(oid) && !['hoodie', 'tshirt', 'suit', 'labcoat'].includes(oid)) {
      missing.push({ type: 'outfit', id: oid });
    }
  }

  return {
    usedAssets: usedSummary,
    missingAssets: missing,
    totalReferenced: Object.values(usedSummary).reduce((acc, arr) => acc + arr.length, 0)
  };
}

/**
 * 4. PROJECT PERSISTENCE: Save, Autosave, Recovery & ZIP Export / Import
 */
export function saveProjectV4(arg1, arg2) {
  let projectDir, projectData;
  if (typeof arg1 === 'object' && typeof arg2 === 'string') {
    projectData = arg1;
    projectDir = arg2;
  } else {
    projectDir = arg1;
    projectData = arg2 || {};
  }

  let projectJsonPath;
  if (projectDir.endsWith('.json')) {
    projectJsonPath = projectDir;
    const parentDir = path.dirname(projectJsonPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
  } else {
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }
    projectJsonPath = path.join(projectDir, 'config.json');
  }

  const manifest = {
    schemaVersion: SCENE_SCHEMA_VERSION,
    title: projectData.title || projectData.metadata?.name || 'Dự Án Thanh Hai 2D Studio V4',
    metadata: projectData.metadata || { name: projectData.title || 'Dự Án Thanh Hai 2D Studio V4' },
    savedAt: new Date().toISOString(),
    generator: 'Thanh Hai 2D Studio V4 Production Engine',
    aspect: projectData.aspect || '16:9',
    resolution: projectData.resolution || projectData.settings?.resolution || '720p',
    fps: projectData.fps || projectData.settings?.fps || 24,
    scenes: projectData.scenes || [],
    assets: projectData.assets || {},
    audio: projectData.audio || {}
  };

  fs.writeFileSync(projectJsonPath, JSON.stringify(manifest, null, 2), 'utf-8');
  return { success: true, path: projectJsonPath };
}

export function loadProjectV4(pathOrDir) {
  let projectJsonPath;
  if (typeof pathOrDir === 'string' && pathOrDir.endsWith('.json')) {
    projectJsonPath = pathOrDir;
  } else {
    projectJsonPath = path.join(pathOrDir, 'config.json');
  }
  if (!fs.existsSync(projectJsonPath)) {
    throw new Error(`Không tìm thấy file cấu hình dự án tại: ${projectJsonPath}`);
  }

  const data = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
  if (!data.metadata && data.title) {
    data.metadata = { name: data.title };
  }
  return data;
}

export function autosaveProjectV4(arg1, arg2) {
  let projectDir, projectData;
  if (typeof arg1 === 'object' && typeof arg2 === 'string') {
    projectData = arg1;
    projectDir = arg2;
  } else {
    projectDir = arg1;
    projectData = arg2 || {};
  }
  const autoDir = path.join(projectDir, '.autosave');
  if (!fs.existsSync(autoDir)) {
    fs.mkdirSync(autoDir, { recursive: true });
  }
  const autoFile = path.join(autoDir, 'autosave_latest.json');
  fs.writeFileSync(autoFile, JSON.stringify({ ...projectData, autosavedAt: new Date().toISOString() }, null, 2), 'utf-8');
  return autoFile;
}

export function recoverAutosaveV4(projectDir) {
  const autoFile = path.join(projectDir, '.autosave', 'autosave_latest.json');
  if (!fs.existsSync(autoFile)) return null;
  return JSON.parse(fs.readFileSync(autoFile, 'utf-8'));
}

export function exportProjectZip(projectOrDir, outZipPath = null) {
  const zip = new AdmZip();
  let projectConfig;

  if (typeof projectOrDir === 'string') {
    projectConfig = loadProjectV4(projectOrDir);
    // Bundle story and scenes folder if present
    const scenesDir = path.join(projectOrDir, 'scenes');
    if (fs.existsSync(scenesDir)) {
      zip.addLocalFolder(scenesDir, 'scenes');
    }
    const storyDir = path.join(projectOrDir, 'story');
    if (fs.existsSync(storyDir)) {
      zip.addLocalFolder(storyDir, 'story');
    }
  } else {
    projectConfig = projectOrDir;
  }

  zip.addFile('config.json', Buffer.from(JSON.stringify(projectConfig, null, 2), 'utf-8'));

  if (outZipPath) {
    zip.writeZip(outZipPath);
    return outZipPath;
  }
  return zip.toBuffer();
}

export function importProjectZip(zipBufferOrPath, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  let zip;
  if (typeof zipBufferOrPath === 'string') {
    zip = new AdmZip(zipBufferOrPath);
  } else {
    zip = new AdmZip(zipBufferOrPath);
  }
  const entries = zip.getEntries();

  // Validate Zip Slip security
  for (const entry of entries) {
    const entryName = entry.entryName;
    if (entryName.includes('..') || path.isAbsolute(entryName)) {
      throw new Error(`Phát hiện âm mưu Path Traversal nguy hiểm trong file ZIP: "${entryName}"`);
    }
  }

  zip.extractAllTo(targetDir, true);
  return loadProjectV4(targetDir);
}
