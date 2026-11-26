// engine/v5-master-timeline-finalizer.js — Master Timeline & Frame-Accurate Synchronization (V5 Phase 5)
// Ensures audio is master clock, calculates continuous global frame boundaries without drift or black frames.

export class MasterTimelineFinalizer {
  constructor(fps = 30) {
    this.fps = fps;
  }

  /**
   * Finalizes master timeline from scene sequence and audio duration
   */
  finalizeTimeline(scenes = [], audioDuration = 0, subtitles = []) {
    const issues = [];
    let currentGlobalFrame = 0;
    const alignedScenes = [];

    // Calculate total expected frames
    const totalDuration = scenes.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
    const effectiveDuration = audioDuration > 0 ? Math.max(totalDuration, audioDuration) : totalDuration;
    const globalTotalFrames = Math.ceil(effectiveDuration * this.fps);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const rawDuration = Number(scene.duration) || 3.0;

      if (rawDuration <= 0) {
        issues.push({ type: 'ERROR', code: 'INVALID_DURATION', sceneId: scene.id, message: `Thời lượng scene "${scene.id}" <= 0.` });
      }

      // Frame-accurate boundaries
      const sceneFrameCount = Math.ceil(rawDuration * this.fps);
      const startFrame = currentGlobalFrame;
      const endFrame = startFrame + sceneFrameCount;

      const startTimeSec = Number((startFrame / this.fps).toFixed(3));
      const endTimeSec = Number((endFrame / this.fps).toFixed(3));
      const exactDurationSec = Number((sceneFrameCount / this.fps).toFixed(3));

      alignedScenes.push({
        ...scene,
        timelineIndex: i,
        startFrame,
        endFrame,
        frameCount: sceneFrameCount,
        startTime: startTimeSec,
        endTime: endTimeSec,
        duration: exactDurationSec
      });

      currentGlobalFrame = endFrame;
    }

    // Check for gaps / overlaps
    for (let i = 0; i < alignedScenes.length - 1; i++) {
      const cur = alignedScenes[i];
      const next = alignedScenes[i + 1];
      if (cur.endFrame !== next.startFrame) {
        issues.push({
          type: 'ERROR',
          code: 'FRAME_BOUNDARY_MISMATCH',
          message: `Lệch ranh giới frame giữa scene ${cur.id} (${cur.endFrame}) và ${next.id} (${next.startFrame}).`
        });
      }
    }

    // Audio duration check
    if (audioDuration > 0) {
      const sceneSum = alignedScenes[alignedScenes.length - 1]?.endTime || 0;
      const delta = Math.abs(sceneSum - audioDuration);
      if (delta > 1.5) {
        issues.push({
          type: 'WARNING',
          code: 'AUDIO_DURATION_MISMATCH',
          message: `Tổng thời lượng hình ảnh (${sceneSum.toFixed(2)}s) lệch đáng chú ý so với audio (${audioDuration.toFixed(2)}s, chênh ${delta.toFixed(2)}s).`
        });
      }
    }

    return {
      isValid: issues.filter(x => x.type === 'ERROR').length === 0,
      fps: this.fps,
      globalTotalFrames,
      totalDuration: Number((currentGlobalFrame / this.fps).toFixed(3)),
      scenes: alignedScenes,
      issues
    };
  }

  /**
   * Aligns subtitles to scene boundaries
   */
  alignSubtitles(subtitles = [], alignedScenes = []) {
    return subtitles.map(sub => {
      const matchingScene = alignedScenes.find(s => sub.start >= s.startTime && sub.start < s.endTime);
      return {
        ...sub,
        sceneId: matchingScene ? matchingScene.id : null
      };
    });
  }
}

export const defaultTimelineFinalizer = new MasterTimelineFinalizer(30);

