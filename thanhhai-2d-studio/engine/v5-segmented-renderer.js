// engine/v5-segmented-renderer.js — V5.2 Phase 5C: Scene-Based Rendering, Incremental Cache, Resume & Recovery
import fs from 'node:fs';
import path from 'node:path';
import { RenderCacheManager, defaultRenderCache } from './v5-render-engine.js';
import { defaultFfmpegAssembler } from './v5-ffmpeg-assembler.js';
import { compileProjectToShots } from './v5-shot-compiler.js';
import { renderThanhHaiVideo } from '../../lib/thanhhai-render-adapter.mjs';

export function getMemoryMetrics() {
  const mu = process.memoryUsage();
  return {
    rssMb: Number((mu.rss / (1024 * 1024)).toFixed(1)),
    heapUsedMb: Number((mu.heapUsed / (1024 * 1024)).toFixed(1)),
    heapTotalMb: Number((mu.heapTotal / (1024 * 1024)).toFixed(1))
  };
}

export function loadRenderCheckpoint(checkpointFile) {
  if (!checkpointFile || !fs.existsSync(checkpointFile)) return { completedSegments: {} };
  try {
    return JSON.parse(fs.readFileSync(checkpointFile, 'utf8'));
  } catch {
    return { completedSegments: {} };
  }
}

export function saveRenderCheckpoint(checkpointFile, data) {
  fs.mkdirSync(path.dirname(checkpointFile), { recursive: true });
  fs.writeFileSync(checkpointFile, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Renders a multi-scene project segment-by-segment with incremental cache,
 * persistent checkpoints, crash/interrupt resume, and FFmpeg concatenation.
 */
export async function renderSegmentedProject(projectData = {}, options = {}) {
  const scenePlan = projectData.scenePlan || {};
  const compiledScenes = projectData.compiledScenes || scenePlan.scenes || [];
  const animations = projectData.animations || {};
  const projectId = projectData.id || scenePlan?.project?.id || `proj_${Date.now()}`;
  const fps = Number(options.fps || scenePlan?.project?.fps || 30);
  const resolution = options.resolution || scenePlan?.project?.resolution || { width: 1920, height: 1080 };
  const width = Number(resolution.width || 1920);
  const height = Number(resolution.height || 1080);

  const cache = options.cache || defaultRenderCache;
  const workDir = options.workDir || path.resolve(process.cwd(), 'imported_projects', projectId, 'segments');
  const checkpointFile = options.checkpointFile || path.resolve(process.cwd(), 'data', 'v5-checkpoints', `${projectId}_render.json`);
  const outputPath = options.outputPath || path.resolve(process.cwd(), 'out', `${projectId}.mp4`);

  fs.mkdirSync(workDir, { recursive: true });
  const checkpoint = loadRenderCheckpoint(checkpointFile);
  const renderSettings = { width, height, fps, quality: options.quality || 'standard' };
  const incPlan = cache.planIncrementalRender(compiledScenes, animations, renderSettings);

  const segmentPaths = [];
  let renderedCount = 0;
  let resumedFromCacheCount = 0;
  let interrupted = false;
  let peakRssMb = getMemoryMetrics().rssMb;
  const tRenderStart = Date.now();

  for (let i = 0; i < compiledScenes.length; i++) {
    const scene = compiledScenes[i];
    const planEntry = incPlan.plan[i];
    const segOut = path.join(workDir, `seg_${String(i + 1).padStart(3, '0')}_${scene.id}.mp4`);

    // 1. Check Incremental Cache or Valid Checkpoint Segment on Disk
    const cpEntry = checkpoint.completedSegments?.[scene.id];
    const cpValid = cpEntry && cpEntry.fingerprint === planEntry.fingerprint && fs.existsSync(cpEntry.segPath) && fs.statSync(cpEntry.segPath).size > 4096;

    if (planEntry.useCache && planEntry.cachedPath && fs.existsSync(planEntry.cachedPath)) {
      fs.copyFileSync(planEntry.cachedPath, segOut);
      segmentPaths.push(segOut);
      resumedFromCacheCount++;
      continue;
    }

    if (cpValid) {
      if (cpEntry.segPath !== segOut) fs.copyFileSync(cpEntry.segPath, segOut);
      cache.saveToCache(planEntry.fingerprint, segOut);
      segmentPaths.push(segOut);
      resumedFromCacheCount++;
      continue;
    }

    // 2. Render single scene segment via real Shot Compiler + Playwright/FFmpeg renderer
    const segProjDir = path.join(workDir, `proj_seg_${i + 1}`);
    const singlePlan = { ...scenePlan, project: { ...(scenePlan.project || {}), id: `${projectId}_${scene.id}`, fps, resolution: { width, height } }, scenes: [scene] };
    compileProjectToShots(segProjDir, {
      projectId: `${projectId}_${scene.id}`,
      scenePlan: singlePlan,
      compiledScenes: [scene],
      animationTracks: animations[scene.id] ? { [scene.id]: animations[scene.id] } : {},
      bindings: projectData.bindings || {},
      fps,
      width,
      height
    });

    await renderThanhHaiVideo({
      projectDir: segProjDir,
      outputPath: segOut,
      fps,
      width,
      height,
      duration: Number(scene.duration || 4),
      audioPath: null
    });

    cache.saveToCache(planEntry.fingerprint, segOut);
    checkpoint.completedSegments = checkpoint.completedSegments || {};
    checkpoint.completedSegments[scene.id] = {
      sceneId: scene.id,
      fingerprint: planEntry.fingerprint,
      segPath: segOut,
      completedAt: new Date().toISOString()
    };
    saveRenderCheckpoint(checkpointFile, checkpoint);
    segmentPaths.push(segOut);
    renderedCount++;
    peakRssMb = Math.max(peakRssMb, getMemoryMetrics().rssMb);
    // Cleanup temporary per-segment compile directory to keep disk & memory bounded on long videos
    try { fs.rmSync(segProjDir, { recursive: true, force: true }); } catch {}

    if (options.simulateInterruptAfterScene && renderedCount >= options.simulateInterruptAfterScene) {
      interrupted = true;
      break;
    }
  }

  if (interrupted) {
    return {
      success: false,
      interrupted: true,
      renderedCount,
      resumedFromCacheCount,
      checkpointFile,
      completedSceneIds: Object.keys(checkpoint.completedSegments || {})
    };
  }

  const tEncodeStart = Date.now();
  // 3. Assemble segments + audio via FFmpeg Assembler & Verify with FFprobe
  await defaultFfmpegAssembler.assembleSegments(segmentPaths, outputPath, options.audioPath || null, {
    forceCpu: options.forceCpu
  });
  const encodingTimeMs = Date.now() - tEncodeStart;

  const expectedDur = compiledScenes.reduce((s, c) => s + Number(c.duration || 4), 0);
  const verification = await defaultFfmpegAssembler.verifyFinalOutput(outputPath, {
    duration: expectedDur,
    resolution: `${width}x${height}`,
    fps
  });

  return {
    success: verification.isValid,
    outputPath,
    totalScenes: compiledScenes.length,
    renderedCount,
    resumedFromCacheCount,
    cacheHitRatePercent: compiledScenes.length > 0 ? Math.round((resumedFromCacheCount / compiledScenes.length) * 100) : 0,
    renderTimeMs: tEncodeStart - tRenderStart,
    encodingTimeMs,
    peakRssMb: Math.max(peakRssMb, getMemoryMetrics().rssMb),
    verification,
    hardware: defaultFfmpegAssembler.detectHardwareCapabilities()
  };
}

