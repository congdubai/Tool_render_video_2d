// engine/v5-technical-qa-engine.js — Technical QA Engine, Severity Matrix & Automatic Safe Repair (V5 Phase 5)
// Consolidates structural, kinematic, asset, audio, and storytelling quality checks into a unified QA pipeline.

import fs from 'node:fs';

export const QA_SEVERITY = {
  BLOCKER: 'BLOCKER',
  ERROR: 'ERROR',
  WARNING: 'WARNING',
  INFO: 'INFO'
};

export class TechnicalQaEngine {
  constructor() {
    this.repairLog = [];
  }

  /**
   * Runs comprehensive technical QA on project scenes and animation
   */
  validateProject(projectData = {}) {
    const issues = [];
    const scenes = Array.isArray(projectData.scenes) ? projectData.scenes : [];
    const animations = projectData.animations || {};
    const audioDuration = Number(projectData.audioDuration) || 0;

    if (scenes.length === 0) {
      issues.push({
        severity: QA_SEVERITY.BLOCKER,
        code: 'NO_SCENES',
        description: 'Dự án không có phân cảnh nào để dựng.',
        suggestedFix: 'Bổ sung ít nhất một scene vào kịch bản.'
      });
      return { isValid: false, issues, blockers: issues, errors: [], warnings: [] };
    }

    let totalDuration = 0;
    const characterAppearanceCounts = {};

    scenes.forEach((scene, idx) => {
      const sceneId = scene.id || `scene_${idx + 1}`;
      const dur = Number(scene.duration) || 0;
      totalDuration += dur;

      // 1. Duration check
      if (dur <= 0) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          sceneId,
          code: 'INVALID_DURATION',
          description: `Thời lượng scene "${sceneId}" (${dur}s) không hợp lệ.`,
          suggestedFix: 'Đặt thời lượng > 0s (ví dụ tối thiểu 1.0s).'
        });
      }

      // 2. Background check
      if (!scene.background && !scene.bg && !scene.backgroundId) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          sceneId,
          code: 'MISSING_BACKGROUND',
          description: `Scene "${sceneId}" thiếu bối cảnh nền (background).`,
          suggestedFix: 'Gán bối cảnh hoặc chọn background từ thư viện.'
        });
      }

      // 3. Characters check
      const chars = scene.characters || [];
      if (chars.length === 0 && !scene.isEducationalGraphicOnly) {
        issues.push({
          severity: QA_SEVERITY.WARNING,
          sceneId,
          code: 'EMPTY_CHARACTERS',
          description: `Scene "${sceneId}" không có nhân vật nào xuất hiện.`,
          suggestedFix: 'Thêm nhân vật nếu đây không phải cảnh đồ họa thuần túy.'
        });
      }

      chars.forEach(ch => {
        const cId = ch.id || ch.characterId;
        if (cId) {
          characterAppearanceCounts[cId] = (characterAppearanceCounts[cId] || 0) + 1;
        }

        // Check scale bounds
        const scale = ch.scale ?? 1.0;
        if (scale <= 0.05 || scale > 8.0) {
          issues.push({
            severity: QA_SEVERITY.ERROR,
            sceneId,
            objectId: cId,
            code: 'OUT_OF_BOUNDS_SCALE',
            description: `Tỉ lệ phóng to nhân vật ${cId} (${scale}) vượt ngưỡng cho phép.`,
            suggestedFix: 'Tự động clamp scale về khoảng an toàn [0.2, 3.0].'
          });
        }
      });

      // 4. Props check
      const props = scene.props || [];
      props.forEach(p => {
        if (p.attachedTo && !chars.some(c => (c.id || c.characterId) === p.attachedTo)) {
          issues.push({
            severity: QA_SEVERITY.ERROR,
            sceneId,
            objectId: p.id,
            code: 'DANGLING_PROP_ATTACHMENT',
            description: `Đạo cụ "${p.id}" được gắn vào nhân vật "${p.attachedTo}" nhưng nhân vật này không có trong scene.`,
            suggestedFix: 'Bỏ attachment hoặc thêm nhân vật vào scene.'
          });
        }
      });
    });

    // 5. Audio synchronization check
    if (audioDuration > 0) {
      const delta = Math.abs(totalDuration - audioDuration);
      if (delta > 2.0) {
        issues.push({
          severity: QA_SEVERITY.WARNING,
          code: 'AUDIO_TIMELINE_MISMATCH',
          description: `Thời lượng hình ảnh (${totalDuration.toFixed(1)}s) lệch so với âm thanh (${audioDuration.toFixed(1)}s).`,
          suggestedFix: 'Khớp lại thời lượng các scene bằng Master Timeline Finalizer.'
        });
      }
    }

    // 6. Character consistency check
    const characterConsistency = this.checkCharacterConsistency(scenes);
    issues.push(...characterConsistency.issues);

    // 7. Missing Assets & Dependency Blocker Check
    const missingAssets = Array.isArray(projectData.missingAssets) ? projectData.missingAssets : [];
    if (missingAssets.length > 0) {
      missingAssets.forEach(m => {
        const reqId = m.id || m.requirementId || 'UNKNOWN_REQ';
        const name = m.name || reqId;
        const type = m.type || m.category || 'asset';
        const reason = (m.reasons && m.reasons[0]) || m.reason || 'Chưa liên kết trong dự án';
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          code: 'MISSING_REQUIRED_ASSET',
          objectId: reqId,
          description: `Thiếu tài nguyên bắt buộc: "${name}" (${type}) [${reqId}]. Lý do: ${reason}`,
          suggestedFix: 'Mở Bước 2 (Smart Asset Manager) để gán tài nguyên hoặc tự vẽ bằng code (CODE GEN).'
        });
      });
    }

    // 8. Rendered Video Output File Validation
    if (projectData.outputPath) {
      const outPath = projectData.outputPath;
      if (!fs.existsSync(outPath)) {
        issues.push({
          severity: QA_SEVERITY.BLOCKER,
          code: 'OUTPUT_FILE_MISSING',
          description: `File video đầu ra "${outPath}" không tồn tại trên ổ đĩa.`,
          suggestedFix: 'Tiến hành kết xuất (render) trước khi kiểm định hợp lệ.'
        });
      } else {
        const stats = fs.statSync(outPath);
        if (stats.size < 1024) { // Less than 1KB
          issues.push({
            severity: QA_SEVERITY.BLOCKER,
            code: 'OUTPUT_FILE_EMPTY',
            description: `File video đầu ra "${outPath}" rỗng hoặc dung lượng không hợp lệ (${stats.size} bytes).`,
            suggestedFix: 'Kiểm tra tiến trình FFmpeg và kết xuất lại video.'
          });
        }
      }
    }

    const blockers = issues.filter(x => x.severity === QA_SEVERITY.BLOCKER);
    const errors = issues.filter(x => x.severity === QA_SEVERITY.ERROR);
    const warnings = issues.filter(x => x.severity === QA_SEVERITY.WARNING);
    const infos = issues.filter(x => x.severity === QA_SEVERITY.INFO);

    const storytellingReport = this.generateStorytellingReport(scenes, audioDuration, characterAppearanceCounts);

    return {
      isValid: blockers.length === 0,
      totalIssues: issues.length,
      blockers,
      errors,
      warnings,
      infos,
      issues,
      storytellingReport
    };
  }

  /**
   * Checks character identity and asset continuity across multiple scenes
   */
  checkCharacterConsistency(scenes = []) {
    const issues = [];
    const charRegistry = {};

    scenes.forEach(scene => {
      (scene.characters || []).forEach(ch => {
        const id = ch.id || ch.characterId;
        if (!id) return;

        if (!charRegistry[id]) {
          charRegistry[id] = {
            skin: ch.skin,
            outfit: ch.outfit,
            firstScene: scene.id
          };
        } else {
          // If outfit changed without explicit outfit directive
          if (ch.outfit && charRegistry[id].outfit && ch.outfit !== charRegistry[id].outfit && !ch.allowOutfitChange) {
            issues.push({
              severity: QA_SEVERITY.WARNING,
              sceneId: scene.id,
              objectId: id,
              code: 'CHARACTER_OUTFIT_INCONSISTENCY',
              description: `Nhân vật "${id}" đổi trang phục bất thường từ "${charRegistry[id].outfit}" sang "${ch.outfit}".`,
              suggestedFix: 'Đảm bảo tính nhất quán của trang phục nhân vật suốt video.'
            });
          }
        }
      });
    });

    return {
      consistent: issues.length === 0,
      issues
    };
  }

  /**
   * Generates storytelling statistics report
   */
  generateStorytellingReport(scenes = [], audioDuration = 0, charCounts = {}) {
    const totalScenes = scenes.length;
    const avgDuration = totalScenes > 0 ? (scenes.reduce((s, c) => s + (Number(c.duration) || 0), 0) / totalScenes) : 0;
    const backgrounds = scenes.map(s => s.background || s.bg || 'default');
    const uniqueBackgrounds = new Set(backgrounds).size;

    return {
      totalScenes,
      averageSceneDurationSec: Number(avgDuration.toFixed(2)),
      audioDurationSec: audioDuration,
      uniqueBackgroundsCount: uniqueBackgrounds,
      characterAppearanceCounts: charCounts,
      pacingAssessment: avgDuration < 2.0 ? 'Rất nhanh (Fast-paced)' : (avgDuration > 8.0 ? 'Chậm rãi (Relaxed)' : 'Cân bằng (Balanced)')
    };
  }

  /**
   * Automatic Safe Repair: fixes simple deterministically repairable issues
   */
  autoRepairSafeIssues(projectData = {}) {
    const scenes = Array.isArray(projectData.scenes) ? projectData.scenes : [];
    let repairsCount = 0;

    scenes.forEach(scene => {
      // 1. Clamp invalid character scale
      (scene.characters || []).forEach(ch => {
        if (typeof ch.scale === 'number') {
          if (ch.scale < 0.2) {
            this.repairLog.push(`Scene ${scene.id}: Clamp scale của ${ch.id} từ ${ch.scale} lên 0.2.`);
            ch.scale = 0.2;
            repairsCount++;
          } else if (ch.scale > 3.0) {
            this.repairLog.push(`Scene ${scene.id}: Clamp scale của ${ch.id} từ ${ch.scale} xuống 3.0.`);
            ch.scale = 3.0;
            repairsCount++;
          }
        }
      });

      // 2. Fix minor duration inaccuracies
      if (typeof scene.duration === 'number' && scene.duration <= 0) {
        this.repairLog.push(`Scene ${scene.id}: Sửa thời lượng không hợp lệ từ ${scene.duration} thành 3.0s.`);
        scene.duration = 3.0;
        repairsCount++;
      }

      // 3. Remove dangling prop attachments
      (scene.props || []).forEach(p => {
        if (p.attachedTo && !scene.characters?.some(c => (c.id || c.characterId) === p.attachedTo)) {
          this.repairLog.push(`Scene ${scene.id}: Gỡ bỏ attachment lơ lửng của prop ${p.id}.`);
          p.attachedTo = null;
          repairsCount++;
        }
      });
    });

    return {
      success: true,
      repairsCount,
      repairedScenes: scenes,
      repairLog: this.repairLog
    };
  }
}

export const defaultQaEngine = new TechnicalQaEngine();

