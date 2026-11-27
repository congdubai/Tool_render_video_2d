// engine/v5-production-job-manager.js — Production Job Manager & Render Queue (V5 Phase 5)
// Tracks lifecycle, queue, immutable snapshots, and execution progress of production jobs.

import fs from 'fs';
import path from 'path';

export const JOB_STATUS = {
  QUEUED: 'Queued',
  PREPARING: 'Preparing',
  RENDERING: 'Rendering',
  PAUSED: 'Paused',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
};

export class ProductionJobManager {
  constructor(storageDir = path.resolve(process.cwd(), 'data', 'v5-jobs')) {
    this.storageDir = storageDir;
    this.activeJobs = new Map();
    this.maxConcurrentHeavyJobs = 1; // Protect CPU/RAM/VRAM
    this._ensureStorage();
  }

  _ensureStorage() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  createJob(projectId, projectRevision = '1.0', mode = 'MODE_B_FULL_AUTO', options = {}) {
    const jobId = options.jobId || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      jobId,
      projectId,
      projectRevision,
      mode,
      status: JOB_STATUS.QUEUED,
      stage: 'Initialized',
      progressPercent: 0,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      checkpoints: [],
      logs: [],
      errorDetails: null,
      retryCount: 0,
      options,
      snapshot: null
    };

    this.activeJobs.set(jobId, job);
    this._saveJobToDisk(job);
    return job;
  }

  createImmutableSnapshot(jobId, projectData = {}) {
    const job = this.getJob(jobId);
    if (!job) throw new Error(`Không tìm thấy Job ID: ${jobId}`);

    // Deep clone project data to ensure immutability during render
    const snapshot = JSON.parse(JSON.stringify({
      projectId: job.projectId,
      revision: job.projectRevision,
      createdAt: new Date().toISOString(),
      scenePlan: projectData.scenePlan || {},
      compiledScenes: projectData.compiledScenes || [],
      animationTracks: projectData.animationTracks || {},
      audio: projectData.audio || {},
      timeline: projectData.timeline || {},
      renderSettings: projectData.renderSettings || {},
      userOverrides: projectData.userOverrides || {},
      lockedSceneIds: projectData.lockedSceneIds || []
    }));

    job.snapshot = snapshot;
    this.appendLog(jobId, `Tạo immutable snapshot dự án thành công cho Revision ${job.projectRevision}.`);
    this._saveJobToDisk(job);
    return snapshot;
  }

  updateJobStage(jobId, stage, progressPercent = null) {
    const job = this.getJob(jobId);
    if (!job) return null;

    job.stage = stage;
    if (typeof progressPercent === 'number') {
      job.progressPercent = Math.min(100, Math.max(0, Math.round(progressPercent)));
    }
    this.appendLog(jobId, `[${stage}] Tiến độ: ${job.progressPercent}%`);
    this._saveJobToDisk(job);
    return job;
  }

  appendLog(jobId, message) {
    const job = this.getJob(jobId);
    if (!job) return;
    const entry = `[${new Date().toLocaleTimeString('vi-VN')}] ${message}`;
    job.logs.push(entry);
    if (job.logs.length > 500) job.logs.shift(); // keep last 500 entries
  }

  recordCheckpoint(jobId, checkpointName, data = {}) {
    const job = this.getJob(jobId);
    if (!job) return;
    const cp = {
      name: checkpointName,
      timestamp: new Date().toISOString(),
      data
    };
    job.checkpoints.push(cp);
    this.appendLog(jobId, `Checkpoint lưu thành công: "${checkpointName}".`);
    this._saveJobToDisk(job);
  }

  pauseJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return null;
    job.status = JOB_STATUS.PAUSED;
    this.appendLog(jobId, 'Job đã được tạm dừng tại checkpoint an toàn.');
    this._saveJobToDisk(job);
    return job;
  }

  resumeJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return null;
    job.status = JOB_STATUS.RENDERING;
    this.appendLog(jobId, 'Tiếp tục thực thi Job từ checkpoint.');
    this._saveJobToDisk(job);
    return job;
  }

  cancelJob(jobId, reason = 'Người dùng hủy yêu cầu') {
    const job = this.getJob(jobId);
    if (!job) return null;
    job.status = JOB_STATUS.CANCELLED;
    job.errorDetails = reason;
    this.appendLog(jobId, `Job đã bị hủy: ${reason}`);
    this._saveJobToDisk(job);
    return job;
  }

  completeJob(jobId, outputDetails = {}) {
    const job = this.getJob(jobId);
    if (!job) return null;
    job.status = JOB_STATUS.COMPLETED;
    job.progressPercent = 100;
    job.completedAt = new Date().toISOString();
    job.outputDetails = outputDetails;
    this.appendLog(jobId, '🎉 Job đã hoàn thành toàn bộ quy trình sản xuất.');
    this._saveJobToDisk(job);
    return job;
  }

  failJob(jobId, error) {
    const job = this.getJob(jobId);
    if (!job) return null;
    job.status = JOB_STATUS.FAILED;
    job.errorDetails = error?.message || String(error);
    this.appendLog(jobId, `❌ Lỗi thực thi Job: ${job.errorDetails}`);
    this._saveJobToDisk(job);
    return job;
  }

  getJob(jobId) {
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId);
    }
    // Attempt load from disk
    const filePath = path.join(this.storageDir, `${jobId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.activeJobs.set(jobId, data);
        return data;
      } catch {
        return null;
      }
    }
    return null;
  }

  listJobs() {
    return Array.from(this.activeJobs.values());
  }

  _saveJobToDisk(job) {
    try {
      const filePath = path.join(this.storageDir, `${job.jobId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(job, null, 2), 'utf8');
    } catch (err) {
      console.error(`Lỗi lưu job ${job.jobId} xuống ổ đĩa:`, err);
    }
  }
}

export const defaultJobManager = new ProductionJobManager();

