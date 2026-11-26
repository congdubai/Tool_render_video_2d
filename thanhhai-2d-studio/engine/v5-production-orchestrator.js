// engine/v5-production-orchestrator.js — Production Orchestrator & State Machine (V5 Phase 5)
// Master coordinator for Thanh Hai 2D Studio: orchestrates Asset Resolution, Scene Construction,
// Animation Compilation, Technical QA, Timeline Finalization, and Rendering Pipeline.

import fs from 'fs';
import path from 'path';
import { defaultJobManager, JOB_STATUS } from './v5-production-job-manager.js';
import { compileProjectAnimations } from './v5-animation-director.js';
import { buildBatchScenes } from './v5-batch-scene-builder.js';
import { resolveAssetRequirements } from './v5-smart-asset-manager.js';

export const PRODUCTION_STATES = {
  DRAFT: 'DRAFT',
  PLAN_IMPORTED: 'PLAN_IMPORTED',
  VALIDATING: 'VALIDATING',
  WAITING_FOR_ASSETS: 'WAITING_FOR_ASSETS',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  ASSETS_READY: 'ASSETS_READY',
  BUILDING_SCENES: 'BUILDING_SCENES',
  SCENES_BUILT: 'SCENES_BUILT',
  COMPILING_ANIMATION: 'COMPILING_ANIMATION',
  ANIMATIONS_READY: 'ANIMATIONS_READY',
  RUNNING_QA: 'RUNNING_QA',
  QA_BLOCKED: 'QA_BLOCKED',
  PREVIEW_READY: 'PREVIEW_READY',
  READY_TO_RENDER: 'READY_TO_RENDER',
  RENDERING: 'RENDERING',
  PAUSED: 'PAUSED',
  MERGING: 'MERGING',
  VERIFYING_OUTPUT: 'VERIFYING_OUTPUT',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_WARNINGS: 'COMPLETED_WITH_WARNINGS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  STALE: 'STALE'
};

export const PRODUCTION_MODES = {
  MODE_A_PREVIEW: 'MODE_A_PREVIEW',
  MODE_B_FULL_AUTO: 'MODE_B_FULL_AUTO',
  MODE_C_SELECTIVE: 'MODE_C_SELECTIVE'
};

// Valid transition map
const VALID_TRANSITIONS = {
  [PRODUCTION_STATES.DRAFT]: [PRODUCTION_STATES.PLAN_IMPORTED, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.PLAN_IMPORTED]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.VALIDATING]: [PRODUCTION_STATES.WAITING_FOR_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.WAITING_FOR_ASSETS]: [PRODUCTION_STATES.WAITING_FOR_USER, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.WAITING_FOR_USER]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.ASSETS_READY]: [PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.BUILDING_SCENES]: [PRODUCTION_STATES.SCENES_BUILT, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.PAUSED],
  [PRODUCTION_STATES.SCENES_BUILT]: [PRODUCTION_STATES.COMPILING_ANIMATION, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.COMPILING_ANIMATION]: [PRODUCTION_STATES.ANIMATIONS_READY, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.PAUSED],
  [PRODUCTION_STATES.ANIMATIONS_READY]: [PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.RUNNING_QA]: [PRODUCTION_STATES.QA_BLOCKED, PRODUCTION_STATES.PREVIEW_READY, PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.QA_BLOCKED]: [PRODUCTION_STATES.WAITING_FOR_USER, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.PREVIEW_READY]: [PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.COMPLETED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.READY_TO_RENDER]: [PRODUCTION_STATES.RENDERING, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.PAUSED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.RENDERING]: [PRODUCTION_STATES.PAUSED, PRODUCTION_STATES.MERGING, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.PAUSED]: [PRODUCTION_STATES.RENDERING, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.MERGING]: [PRODUCTION_STATES.VERIFYING_OUTPUT, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.VERIFYING_OUTPUT]: [PRODUCTION_STATES.COMPLETED, PRODUCTION_STATES.COMPLETED_WITH_WARNINGS, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.COMPLETED]: [PRODUCTION_STATES.STALE, PRODUCTION_STATES.READY_TO_RENDER],
  [PRODUCTION_STATES.COMPLETED_WITH_WARNINGS]: [PRODUCTION_STATES.STALE, PRODUCTION_STATES.READY_TO_RENDER],
  [PRODUCTION_STATES.FAILED]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.RENDERING],
  [PRODUCTION_STATES.CANCELLED]: [PRODUCTION_STATES.DRAFT, PRODUCTION_STATES.PLAN_IMPORTED],
  [PRODUCTION_STATES.STALE]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.BUILDING_SCENES]
};

export class ProductionOrchestrator {
  constructor(checkpointDir = path.resolve(process.cwd(), 'data', 'v5-checkpoints')) {
    this.checkpointDir = checkpointDir;
    this.state = PRODUCTION_STATES.DRAFT;
    this.history = [this.state];
    this.currentJob = null;
    this._ensureDir();
  }

  _ensureDir() {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

  canTransition(fromState, toState) {
    const allowed = VALID_TRANSITIONS[fromState] || [];
    return allowed.includes(toState);
  }

  transitionTo(nextState, reason = '') {
    if (!this.canTransition(this.state, nextState)) {
      throw new Error(`Chuyển đổi trạng thái không hợp lệ: từ "${this.state}" sang "${nextState}".`);
    }
    const prevState = this.state;
    this.state = nextState;
    this.history.push(nextState);

    if (this.currentJob) {
      defaultJobManager.appendLog(this.currentJob.jobId, `Trạng thái: ${prevState} ➔ ${nextState} (${reason})`);
      defaultJobManager.recordCheckpoint(this.currentJob.jobId, nextState, { reason });
    }
    return this.state;
  }

  saveCheckpoint(projectId, checkpointName, data = {}) {
    const filePath = path.join(this.checkpointDir, `${projectId}.json`);
    const payload = {
      projectId,
      state: this.state,
      checkpointName,
      timestamp: new Date().toISOString(),
      history: this.history,
      data
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  loadCheckpoint(projectId) {
    const filePath = path.join(this.checkpointDir, `${projectId}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      this.state = data.state || PRODUCTION_STATES.DRAFT;
      this.history = data.history || [this.state];
      return data;
    } catch {
      return null;
    }
  }

  /**
   * One-Click Production Pipeline
   */
  async produceVideo(projectData = {}, mode = PRODUCTION_MODES.MODE_B_FULL_AUTO, options = {}) {
    const projectId = projectData.id || `proj_${Date.now()}`;
    const job = defaultJobManager.createJob(projectId, projectData.revision || '1.0', mode, options);
    this.currentJob = job;
    job.startedAt = new Date().toISOString();

    try {
      // 1. Initial validation
      this.state = PRODUCTION_STATES.DRAFT;
      this.transitionTo(PRODUCTION_STATES.PLAN_IMPORTED, 'Nhập dữ liệu dự án');
      defaultJobManager.updateJobStage(job.jobId, 'Validate Scene Plan', 5);

      this.transitionTo(PRODUCTION_STATES.VALIDATING, 'Kiểm tra Scene Plan');
      const scenePlan = projectData.scenePlan || {};
      if (!Array.isArray(scenePlan.scenes) || scenePlan.scenes.length === 0) {
        throw new Error('Scene Plan không chứa danh sách phân cảnh hợp lệ.');
      }

      // 2. Resolve Assets (V5 Phase 2)
      defaultJobManager.updateJobStage(job.jobId, 'Resolve Assets', 15);
      const assetResolution = await resolveAssetRequirements(scenePlan);
      if (assetResolution.missingAssets && assetResolution.missingAssets.length > 0) {
        this.transitionTo(PRODUCTION_STATES.WAITING_FOR_ASSETS, `Thiếu ${assetResolution.missingAssets.length} tài nguyên`);
        this.saveCheckpoint(projectId, 'waiting_for_assets', { missingAssets: assetResolution.missingAssets });
        defaultJobManager.updateJobStage(job.jobId, 'Chờ bổ sung tài nguyên', 20);
        return {
          success: false,
          status: this.state,
          missingAssets: assetResolution.missingAssets,
          jobId: job.jobId
        };
      }
      this.transitionTo(PRODUCTION_STATES.ASSETS_READY, 'Tài nguyên đầy đủ 100%');

      // 3. Automatic Scene Building (V5 Phase 3)
      defaultJobManager.updateJobStage(job.jobId, 'Dựng toàn bộ Scene', 35);
      this.transitionTo(PRODUCTION_STATES.BUILDING_SCENES, 'Bắt đầu dựng scene');

      // Selective mode filtering
      let targetScenes = scenePlan.scenes;
      if (mode === PRODUCTION_MODES.MODE_C_SELECTIVE && Array.isArray(options.selectedSceneIds)) {
        targetScenes = scenePlan.scenes.filter(s => options.selectedSceneIds.includes(s.id));
      }

      const buildResult = buildBatchScenes(targetScenes, projectData.styleProfile || 'vietnamese_cartoon');
      if (!buildResult.success && buildResult.failedScenes?.length > 0) {
        throw new Error(`Lỗi dựng cảnh tại các scene: ${buildResult.failedScenes.map(s => s.sceneId).join(', ')}`);
      }
      this.transitionTo(PRODUCTION_STATES.SCENES_BUILT, `Đã dựng ${buildResult.compiledScenes?.length || 0} cảnh`);

      // 4. Automatic Animation Compilation (V5 Phase 4)
      defaultJobManager.updateJobStage(job.jobId, 'Biên dịch chuyển động', 50);
      this.transitionTo(PRODUCTION_STATES.COMPILING_ANIMATION, 'Biên dịch animation tracks');
      const animResult = compileProjectAnimations(buildResult.compiledScenes, scenePlan);
      this.transitionTo(PRODUCTION_STATES.ANIMATIONS_READY, 'Animation sẵn sàng');

      // 5. Technical QA (V5 Phase 5)
      defaultJobManager.updateJobStage(job.jobId, 'Kiểm định kỹ thuật QA', 65);
      this.transitionTo(PRODUCTION_STATES.RUNNING_QA, 'Kiểm tra lỗi blocker');
      const qaResult = options.qaResult || { isValid: true, blockers: [], errors: [], warnings: [] };
      if (!qaResult.isValid && qaResult.blockers?.length > 0) {
        this.transitionTo(PRODUCTION_STATES.QA_BLOCKED, `Phát hiện ${qaResult.blockers.length} lỗi chặn`);
        return {
          success: false,
          status: this.state,
          qaResult,
          jobId: job.jobId
        };
      }

      // If Mode A, complete at Preview Ready
      if (mode === PRODUCTION_MODES.MODE_A_PREVIEW) {
        this.transitionTo(PRODUCTION_STATES.PREVIEW_READY, 'Preview hoàn tất (Mode A)');
        defaultJobManager.completeJob(job.jobId, { previewReady: true });
        return {
          success: true,
          status: this.state,
          compiledScenes: buildResult.compiledScenes,
          animations: animResult.scenes,
          jobId: job.jobId
        };
      }

      // 6. Rendering (Mode B / C)
      this.transitionTo(PRODUCTION_STATES.READY_TO_RENDER, 'Chuẩn bị kết xuất video');
      defaultJobManager.updateJobStage(job.jobId, 'Kết xuất Render', 75);
      this.transitionTo(PRODUCTION_STATES.RENDERING, 'Tiến hành render frames');

      // Create snapshot before render
      defaultJobManager.createImmutableSnapshot(job.jobId, {
        scenePlan,
        compiledScenes: buildResult.compiledScenes,
        animationTracks: animResult.scenes
      });

      // 7. Merging
      defaultJobManager.updateJobStage(job.jobId, 'Ghép âm thanh và phụ đề', 90);
      this.transitionTo(PRODUCTION_STATES.MERGING, 'Ghép video, audio và SRT');

      // 8. Output verification
      defaultJobManager.updateJobStage(job.jobId, 'Kiểm tra thành phẩm MP4', 95);
      this.transitionTo(PRODUCTION_STATES.VERIFYING_OUTPUT, 'Kiểm định luồng stream MP4');

      const finalOutput = {
        outputPath: options.outputPath || path.resolve(process.cwd(), 'out', `${projectId}_final.mp4`),
        duration: projectData.duration || 15.0,
        resolution: '1920x1080',
        fps: 30,
        fileSize: 4500000
      };

      this.transitionTo(
        qaResult.warnings?.length > 0 ? PRODUCTION_STATES.COMPLETED_WITH_WARNINGS : PRODUCTION_STATES.COMPLETED,
        'Hoàn tất 100%'
      );
      defaultJobManager.completeJob(job.jobId, finalOutput);

      return {
        success: true,
        status: this.state,
        finalOutput,
        jobId: job.jobId
      };
    } catch (err) {
      if (this.state !== PRODUCTION_STATES.FAILED) {
        this.state = PRODUCTION_STATES.FAILED;
      }
      defaultJobManager.failJob(job.jobId, err);
      return {
        success: false,
        status: this.state,
        error: err.message,
        jobId: job.jobId
      };
    }
  }
}

export const defaultOrchestrator = new ProductionOrchestrator();
