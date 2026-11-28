// engine/v5-production-orchestrator.js — Production Orchestrator & State Machine (V5 Phase 5)
// Master coordinator for Thanh Hai 2D Studio: orchestrates Asset Resolution, Scene Construction,
// Animation Compilation, Technical QA, Timeline Finalization, and Rendering Pipeline.

import fs from 'fs';
import path from 'path';
import { defaultJobManager, JOB_STATUS } from './v5-production-job-manager.js';
import { compileProjectAnimations } from './v5-animation-director.js';
import { buildBatchScenes } from './v5-batch-scene-builder.js';
import { resolveAssetRequirements } from './v5-smart-asset-manager.js';
import { defaultQaEngine } from './v5-technical-qa-engine.js';
import { defaultFfmpegAssembler } from './v5-ffmpeg-assembler.js';
import { compileProjectToShots } from './v5-shot-compiler.js';
import { renderThanhHaiVideo } from '../../lib/thanhhai-render-adapter.mjs';

export const PRODUCTION_STATES = {
  IDLE: 'IDLE',
  DRAFT: 'DRAFT',
  PLAN_IMPORTED: 'PLAN_IMPORTED',
  VALIDATING: 'VALIDATING',
  RESOLVING_ASSETS: 'RESOLVING_ASSETS',
  GENERATING_ASSETS: 'GENERATING_ASSETS',
  WAITING_FOR_ASSETS: 'WAITING_FOR_ASSETS',
  WAITING_FOR_USER: 'WAITING_FOR_USER',
  ASSETS_READY: 'ASSETS_READY',
  BUILDING_SCENES: 'BUILDING_SCENES',
  SCENES_BUILT: 'SCENES_BUILT',
  COMPILING_ANIMATION: 'COMPILING_ANIMATION',
  COMPILING_CAMERA: 'COMPILING_CAMERA',
  ANIMATIONS_READY: 'ANIMATIONS_READY',
  RUNNING_QA: 'RUNNING_QA',
  CHECKING_QUALITY: 'CHECKING_QUALITY',
  REPAIRING: 'REPAIRING',
  QA_BLOCKED: 'QA_BLOCKED',
  PREVIEW_READY: 'PREVIEW_READY',
  READY_TO_RENDER: 'READY_TO_RENDER',
  RENDERING: 'RENDERING',
  ENCODING: 'ENCODING',
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
  MODE_C_SELECTIVE: 'MODE_C_SELECTIVE',
  MODE_C_HIGH_QUALITY: 'MODE_C_HIGH_QUALITY'
};

// Valid transition map
const VALID_TRANSITIONS = {
  [PRODUCTION_STATES.IDLE]: [PRODUCTION_STATES.DRAFT, PRODUCTION_STATES.PLAN_IMPORTED, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.DRAFT]: [PRODUCTION_STATES.PLAN_IMPORTED, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.PLAN_IMPORTED]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.VALIDATING]: [PRODUCTION_STATES.RESOLVING_ASSETS, PRODUCTION_STATES.WAITING_FOR_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.RESOLVING_ASSETS]: [PRODUCTION_STATES.GENERATING_ASSETS, PRODUCTION_STATES.WAITING_FOR_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.GENERATING_ASSETS]: [PRODUCTION_STATES.WAITING_FOR_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.WAITING_FOR_ASSETS]: [PRODUCTION_STATES.WAITING_FOR_USER, PRODUCTION_STATES.RESOLVING_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.WAITING_FOR_USER]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.RESOLVING_ASSETS, PRODUCTION_STATES.ASSETS_READY, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.ASSETS_READY]: [PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.BUILDING_SCENES]: [PRODUCTION_STATES.SCENES_BUILT, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.PAUSED],
  [PRODUCTION_STATES.SCENES_BUILT]: [PRODUCTION_STATES.COMPILING_ANIMATION, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.COMPILING_ANIMATION]: [PRODUCTION_STATES.COMPILING_CAMERA, PRODUCTION_STATES.ANIMATIONS_READY, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.PAUSED],
  [PRODUCTION_STATES.COMPILING_CAMERA]: [PRODUCTION_STATES.ANIMATIONS_READY, PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.CHECKING_QUALITY, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.ANIMATIONS_READY]: [PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.CHECKING_QUALITY, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.RUNNING_QA]: [PRODUCTION_STATES.REPAIRING, PRODUCTION_STATES.QA_BLOCKED, PRODUCTION_STATES.PREVIEW_READY, PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.CHECKING_QUALITY]: [PRODUCTION_STATES.REPAIRING, PRODUCTION_STATES.QA_BLOCKED, PRODUCTION_STATES.PREVIEW_READY, PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.REPAIRING]: [PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.CHECKING_QUALITY, PRODUCTION_STATES.QA_BLOCKED, PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.QA_BLOCKED]: [PRODUCTION_STATES.WAITING_FOR_USER, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.RUNNING_QA, PRODUCTION_STATES.REPAIRING, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.PREVIEW_READY]: [PRODUCTION_STATES.READY_TO_RENDER, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.COMPLETED, PRODUCTION_STATES.STALE],
  [PRODUCTION_STATES.READY_TO_RENDER]: [PRODUCTION_STATES.RENDERING, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.PAUSED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.RENDERING]: [PRODUCTION_STATES.PAUSED, PRODUCTION_STATES.ENCODING, PRODUCTION_STATES.MERGING, PRODUCTION_STATES.VERIFYING_OUTPUT, PRODUCTION_STATES.FAILED, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.ENCODING]: [PRODUCTION_STATES.VERIFYING_OUTPUT, PRODUCTION_STATES.MERGING, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.PAUSED]: [PRODUCTION_STATES.RENDERING, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.CANCELLED],
  [PRODUCTION_STATES.MERGING]: [PRODUCTION_STATES.VERIFYING_OUTPUT, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.VERIFYING_OUTPUT]: [PRODUCTION_STATES.COMPLETED, PRODUCTION_STATES.COMPLETED_WITH_WARNINGS, PRODUCTION_STATES.FAILED],
  [PRODUCTION_STATES.COMPLETED]: [PRODUCTION_STATES.STALE, PRODUCTION_STATES.READY_TO_RENDER],
  [PRODUCTION_STATES.COMPLETED_WITH_WARNINGS]: [PRODUCTION_STATES.STALE, PRODUCTION_STATES.READY_TO_RENDER],
  [PRODUCTION_STATES.FAILED]: [PRODUCTION_STATES.VALIDATING, PRODUCTION_STATES.RESOLVING_ASSETS, PRODUCTION_STATES.BUILDING_SCENES, PRODUCTION_STATES.RENDERING],
  [PRODUCTION_STATES.CANCELLED]: [PRODUCTION_STATES.IDLE, PRODUCTION_STATES.DRAFT, PRODUCTION_STATES.PLAN_IMPORTED],
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
    const scenePlan = projectData.scenePlan || {};
    const projectId = projectData.id || projectData.projectId || scenePlan?.project?.id || `proj_${Date.now()}`;
    const revision = projectData.revision || scenePlan?.project?.revision || '1.0';
    const projectDir = projectData.projectDir || path.resolve(process.cwd(), 'imported_projects', projectId);

    const job = defaultJobManager.createJob(projectId, revision, mode, options);
    this.currentJob = job;
    job.startedAt = new Date().toISOString();

    try {
      // 1. Initial validation
      this.state = PRODUCTION_STATES.DRAFT;
      this.transitionTo(PRODUCTION_STATES.PLAN_IMPORTED, 'Nhập dữ liệu dự án');
      defaultJobManager.updateJobStage(job.jobId, 'Validate Scene Plan', 5);

      this.transitionTo(PRODUCTION_STATES.VALIDATING, 'Kiểm tra Scene Plan');
      if (!Array.isArray(scenePlan.scenes) || scenePlan.scenes.length === 0) {
        throw new Error('Scene Plan không chứa danh sách phân cảnh hợp lệ.');
      }

      // 2. Resolve Assets (V5 Phase 2) — synchronized with real binding registry
      defaultJobManager.updateJobStage(job.jobId, 'Resolve Assets', 15);
      const assetResolution = await resolveAssetRequirements(scenePlan, {
        projectId,
        projectDir,
        bindings: projectData.bindings || options.bindings
      });

      if (assetResolution.missingAssets && assetResolution.missingAssets.length > 0) {
        this.transitionTo(PRODUCTION_STATES.WAITING_FOR_ASSETS, `Thiếu ${assetResolution.missingAssets.length} tài nguyên`);
        this.saveCheckpoint(projectId, 'waiting_for_assets', { missingAssets: assetResolution.missingAssets });
        defaultJobManager.updateJobStage(job.jobId, `Tạm dừng: Thiếu ${assetResolution.missingAssets.length} tài nguyên bắt buộc`, 20);
        const resObj = {
          success: false,
          status: this.state,
          missingAssets: assetResolution.missingAssets,
          jobId: job.jobId
        };
        job.result = resObj;
        defaultJobManager.failJob(job.jobId, new Error(`Thiếu ${assetResolution.missingAssets.length} tài nguyên bắt buộc`));
        return resObj;
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

      const resolvedBindings = {
        ...(assetResolution.bindings || {}),
        ...(projectData.bindings || {}),
        ...(options.bindings || {})
      };

      const buildResult = buildBatchScenes(targetScenes, {
        projectContext: {
          styleProfile: projectData.styleProfile || scenePlan.style?.profileId || 'flat_vector',
          scenePlan
        },
        resolvedBindings,
        characterBindings: scenePlan.characterBindings || []
      });
      if (!buildResult.success && buildResult.failedScenes?.length > 0) {
        throw new Error(`Lỗi dựng cảnh tại các scene: ${buildResult.failedScenes.map(s => s.sceneId).join(', ')}`);
      }
      this.transitionTo(PRODUCTION_STATES.SCENES_BUILT, `Đã dựng ${buildResult.compiledScenes?.length || 0} cảnh`);

      // 4. Automatic Animation Compilation (V5 Phase 4)
      defaultJobManager.updateJobStage(job.jobId, 'Biên dịch chuyển động', 50);
      this.transitionTo(PRODUCTION_STATES.COMPILING_ANIMATION, 'Biên dịch animation tracks');
      const animResult = compileProjectAnimations(buildResult.compiledScenes, scenePlan);
      this.transitionTo(PRODUCTION_STATES.ANIMATIONS_READY, 'Animation sẵn sàng');

      // 5. Technical QA (V5 Phase 5) — synchronized with real project bindings & missing assets
      defaultJobManager.updateJobStage(job.jobId, 'Kiểm định kỹ thuật QA', 65);
      this.transitionTo(PRODUCTION_STATES.RUNNING_QA, 'Kiểm tra lỗi blocker');
      const qaCheckData = {
        ...projectData,
        scenes: buildResult.compiledScenes || targetScenes,
        bindings: resolvedBindings,
        missingAssets: assetResolution.missingAssets || []
      };
      const qaResult = options.qaResult || defaultQaEngine.validateProject(qaCheckData);
      if (!qaResult.isValid && qaResult.blockers?.length > 0) {
        this.transitionTo(PRODUCTION_STATES.QA_BLOCKED, `Phát hiện ${qaResult.blockers.length} lỗi chặn`);
        const resObj = {
          success: false,
          status: this.state,
          qaResult,
          jobId: job.jobId
        };
        job.result = resObj;
        defaultJobManager.failJob(job.jobId, new Error(`QA Blocked: ${qaResult.blockers.length} lỗi chặn`));
        return resObj;
      }

      // If Mode A, complete at Preview Ready
      if (mode === PRODUCTION_MODES.MODE_A_PREVIEW) {
        this.transitionTo(PRODUCTION_STATES.PREVIEW_READY, 'Preview hoàn tất (Mode A)');
        const resObj = {
          success: true,
          status: this.state,
          compiledScenes: buildResult.compiledScenes,
          animations: animResult.scenes,
          qaResult,
          jobId: job.jobId
        };
        job.result = resObj;
        defaultJobManager.completeJob(job.jobId, { previewReady: true });
        return resObj;
      }

      // 6. Real Shot Compilation & Rendering (Mode B / C) — ZERO demo video copy!
      this.transitionTo(PRODUCTION_STATES.READY_TO_RENDER, 'Chuẩn bị kết xuất video');
      defaultJobManager.updateJobStage(job.jobId, 'Biên dịch Shot & Kết xuất Render', 75);
      this.transitionTo(PRODUCTION_STATES.RENDERING, 'Tiến hành render frames thực tế');

      // Create snapshot before render
      defaultJobManager.createImmutableSnapshot(job.jobId, {
        scenePlan,
        compiledScenes: buildResult.compiledScenes,
        animationTracks: animResult.scenes
      });

      const fps = scenePlan?.project?.fps || projectData.fps || 30;
      const width = scenePlan?.project?.resolution?.width || 1920;
      const height = scenePlan?.project?.resolution?.height || 1080;

      // 6a. Compile real scenes + live characters + animations into executable Canvas shots
      const shotCompileRes = compileProjectToShots(projectDir, {
        projectId,
        scenePlan,
        compiledScenes: buildResult.compiledScenes,
        animationTracks: animResult.scenes,
        bindings: resolvedBindings,
        fps,
        width,
        height
      });

      const outputPath = options.outputPath || path.resolve(process.cwd(), 'out', `${projectId}_final.mp4`);
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      // Remove any stale output file before rendering so we NEVER reuse old videos
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }

      // 6b. Execute REAL Playwright Canvas -> FFmpeg video rendering
      await renderThanhHaiVideo({
        projectDir,
        outputPath,
        isTest: false,
        scale: options.scale ?? 1.0,
        characterRenderer: 'chibi',
        onProgress: (p) => {
          const pct = 75 + Math.round((p.progress || 0) * 15);
          defaultJobManager.updateJobStage(job.jobId, `Render Frames (${p.renderedFrames || 0}/${p.totalFrames || 0})`, pct);
        }
      });

      // 7. Merging (completed by renderThanhHaiVideo audio+video pipeline)
      defaultJobManager.updateJobStage(job.jobId, 'Ghép âm thanh và phụ đề', 90);
      this.transitionTo(PRODUCTION_STATES.MERGING, 'Ghép video, audio và SRT');

      // 8. Output verification & REAL FFPROBE INSPECTION
      defaultJobManager.updateJobStage(job.jobId, 'Kiểm tra thành phẩm MP4', 95);
      this.transitionTo(PRODUCTION_STATES.VERIFYING_OUTPUT, 'Kiểm định luồng stream MP4');

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
        throw new Error(`Render thất bại: Không tạo được file MP4 thực tế tại ${outputPath}`);
      }

      const expectedDuration = shotCompileRes.totalDuration || projectData.duration || 5.0;
      const expectedResolution = `${width}x${height}`;

      // Inspect real file with FFprobe — NEVER use fake mock sizes or demo copies
      const probeRes = await defaultFfmpegAssembler.verifyFinalOutput(outputPath, {
        duration: expectedDuration,
        resolution: expectedResolution,
        fps
      });

      if (!probeRes.isValid || !probeRes.fileSize || probeRes.fileSize < 1024) {
        throw new Error(`Kiểm định file MP4 thất bại: ${probeRes.error || 'Dung lượng file 0 bytes hoặc luồng video không hợp lệ'}`);
      }

      const finalOutput = {
        outputPath,
        duration: probeRes.duration || expectedDuration,
        resolution: probeRes.resolution || expectedResolution,
        fps: probeRes.fps || fps,
        fileSize: probeRes.fileSize,
        videoCodec: probeRes.videoCodec || 'h264',
        audioCodec: probeRes.audioCodec || 'aac',
        verified: true,
        checks: probeRes.checks
      };

      this.transitionTo(
        qaResult.warnings?.length > 0 ? PRODUCTION_STATES.COMPLETED_WITH_WARNINGS : PRODUCTION_STATES.COMPLETED,
        'Hoàn tất 100%'
      );
      const resObj = {
        success: true,
        status: this.state,
        finalOutput,
        qaResult,
        jobId: job.jobId
      };
      job.result = resObj;
      defaultJobManager.completeJob(job.jobId, finalOutput);

      return resObj;
    } catch (err) {
      if (this.state !== PRODUCTION_STATES.FAILED) {
        this.state = PRODUCTION_STATES.FAILED;
      }
      const resObj = {
        success: false,
        status: this.state,
        error: err.message,
        jobId: job.jobId
      };
      job.result = resObj;
      defaultJobManager.failJob(job.jobId, err);
      return resObj;
    }
  }
}

export const defaultOrchestrator = new ProductionOrchestrator();
