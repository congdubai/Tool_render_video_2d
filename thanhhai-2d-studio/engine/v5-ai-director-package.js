// engine/v5-ai-director-package.js — AI Director Package, Long Script Chunking & AI Repair Exporter (V5 Phase 5)
// Exports comprehensive prompt packages for ChatGPT/Claude and merges multi-batch Scene Plans.

import { CAPABILITY_REGISTRY as AI_CAPABILITY_REGISTRY } from './v5-capability-registry.js';
import { BUILTIN_STYLE_PROFILES as STYLE_PROFILES } from './v5-style-profiles.js';

export class AiDirectorPackageManager {
  /**
   * Generates complete AI Director Package to paste or upload to ChatGPT/Claude
   */
  exportDirectorPackage(scriptText = '', timelineData = {}, styleProfileId = 'vietnamese_cartoon', options = {}) {
    const styleProfile = STYLE_PROFILES[styleProfileId] || STYLE_PROFILES.educational_cartoon || Object.values(STYLE_PROFILES)[0] || { id: 'default', name: 'Mặc định' };

    const manifest = {
      packageVersion: '5.0',
      exportedAt: new Date().toISOString(),
      script: scriptText,
      audioDuration: timelineData.totalDuration || 0,
      srtEntries: timelineData.subtitles || [],
      styleProfile: {
        id: styleProfile.id,
        name: styleProfile.name,
        colorPalette: styleProfile.colorPalette,
        aspectRatio: styleProfile.aspectRatio || '16:9'
      },
      capabilities: {
        actions: AI_CAPABILITY_REGISTRY.actions || [],
        compositeActions: [
          'composite_fight_cloud',
          'composite_cartoon_chase',
          'composite_funny_fall',
          'composite_power_up',
          'composite_cartoon_argument'
        ],
        expressions: ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared', 'confused', 'thinking', 'dizzy'],
        cameraMovements: ['static', 'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'follow_target', 'camera_shake'],
        vfx: ['cartoon_dust', 'sparks', 'sweat_drops', 'question_mark', 'exclamation_mark', 'thought_bubble', 'rain', 'snow']
      },
      instructionsForAi: `
Bạn là AI Director chuyên về 2D Animation cho Thanh Hai 2D Studio V5.
Nhiệm vụ: Phân tích kịch bản và danh sách SRT, tạo ra một mảng 'scenes' chuẩn JSON.
Mỗi scene cần:
- id: "scene_001", "scene_002",...
- startTime & endTime (khớp thời gian audio)
- duration (số giây)
- narration (lời đọc tương ứng)
- background: { id, description, prompt }
- characters: [ { id, skin: "white_cartoon", action, emotion, position: [x, y], scale } ]
- props: [ { id, action, attachedTo, position: [x, y] } ]
- camera: { shotType: "close_up"|"medium"|"wide", movement: "static"|"zoom_in"|"pan_right" }
- vfx: [ { type, startTime, duration } ]
CHÚ Ý: Chỉ sử dụng các action, composite action, và expression đã liệt kê trong capabilities!
`
    };

    return {
      success: true,
      manifest,
      jsonString: JSON.stringify(manifest, null, 2)
    };
  }

  /**
   * Splits long script (8-10 mins) into manageable chapter batches
   */
  chunkLongScript(scriptText = '', srtEntries = [], scenesPerBatch = 10) {
    const batches = [];
    const totalSrt = srtEntries.length;

    if (totalSrt === 0) {
      // Chunk by paragraph if no SRT
      const paragraphs = scriptText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      for (let i = 0; i < paragraphs.length; i += scenesPerBatch) {
        batches.push({
          batchIndex: Math.floor(i / scenesPerBatch) + 1,
          name: `Chương ${Math.floor(i / scenesPerBatch) + 1}`,
          content: paragraphs.slice(i, i + scenesPerBatch).join('\n\n')
        });
      }
      return batches;
    }

    for (let i = 0; i < totalSrt; i += scenesPerBatch) {
      const slice = srtEntries.slice(i, i + scenesPerBatch);
      batches.push({
        batchIndex: Math.floor(i / scenesPerBatch) + 1,
        name: `Chapter ${Math.floor(i / scenesPerBatch) + 1}`,
        startTime: slice[0].start,
        endTime: slice[slice.length - 1].end,
        srtEntries: slice
      });
    }

    return batches;
  }

  /**
   * Merges multiple Scene Plan batches into a single unified master Scene Plan
   */
  mergeScenePlanBatches(batches = []) {
    const mergedScenes = [];
    const seenIds = new Set();
    const warnings = [];

    batches.forEach((batch, bIdx) => {
      const scenes = Array.isArray(batch.scenes) ? batch.scenes : (batch.items || []);
      scenes.forEach(scene => {
        let sid = scene.id || `scene_b${bIdx + 1}_${mergedScenes.length + 1}`;
        if (seenIds.has(sid)) {
          sid = `${sid}_dup${mergedScenes.length + 1}`;
          warnings.push(`Trùng Scene ID: đã tự động đổi tên thành "${sid}".`);
        }
        seenIds.add(sid);
        mergedScenes.push({
          ...scene,
          id: sid
        });
      });
    });

    return {
      success: true,
      totalScenes: mergedScenes.length,
      scenes: mergedScenes,
      warnings
    };
  }

  /**
   * Exports AI Repair Package for single problematic scene
   */
  exportSceneRepairPackage(scene = {}, compiledScene = {}, animTrack = {}, userFeedback = '') {
    return {
      sceneId: scene.id,
      userFeedback,
      currentScenePlan: scene,
      currentCompiledScene: compiledScene,
      currentAnimation: animTrack,
      instructionsForAi: `
Người dùng muốn chỉnh sửa scene "${scene.id}" với phản hồi: "${userFeedback}".
Vui lòng trả về "Scene Patch JSON" chỉ chứa các trường thay đổi (ví dụ: action, camera, vfx, emotion).
Không thay đổi các scene khác!
`
    };
  }
}

export const defaultAiDirectorPackage = new AiDirectorPackageManager();
