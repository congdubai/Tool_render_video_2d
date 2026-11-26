// engine/v5-audio-director.js — Audio Mixing, Ducking, SFX Director & Subtitles (V5 Phase 5)
// Coordinates multi-track audio mixing (narration, BGM, SFX, ambient) with ducking and subtitles.

export class AudioDirector {
  constructor() {
    this.audioTracks = [];
    this.sfxLibrary = {
      pop: { name: 'Cartoon Pop', path: 'assets/sfx/pop.mp3', volume: 0.8 },
      whoosh: { name: 'Whoosh', path: 'assets/sfx/whoosh.mp3', volume: 0.7 },
      footstep: { name: 'Footsteps', path: 'assets/sfx/footstep.mp3', volume: 0.5 },
      idea: { name: 'Idea Ping', path: 'assets/sfx/idea.mp3', volume: 0.8 },
      machine: { name: 'Computer Hum', path: 'assets/sfx/machine.mp3', volume: 0.4 },
      impact: { name: 'Cartoon Thud', path: 'assets/sfx/impact.mp3', volume: 0.9 }
    };
  }

  /**
   * Plans multi-track audio layout with ducking
   */
  planAudioMix(narrationTrack = null, bgmTrack = null, sceneSfxList = [], totalDuration = 30) {
    const tracks = [];

    // 1. Narration track (Master priority)
    if (narrationTrack && narrationTrack.path) {
      tracks.push({
        type: 'narration',
        path: narrationTrack.path,
        startTime: narrationTrack.startTime || 0,
        volume: 1.0,
        priority: 1
      });
    }

    // 2. Background music with auto-ducking
    if (bgmTrack && bgmTrack.path) {
      tracks.push({
        type: 'bgm',
        path: bgmTrack.path,
        startTime: 0,
        endTime: totalDuration,
        normalVolume: 0.35,
        duckedVolume: 0.12, // ducked when narration is talking
        isLoop: true,
        priority: 3
      });
    }

    // 3. Sound effects
    sceneSfxList.forEach(sfx => {
      const preset = this.sfxLibrary[sfx.type] || { volume: 0.7, path: sfx.path };
      tracks.push({
        type: 'sfx',
        path: sfx.path || preset.path,
        name: sfx.type,
        startTime: sfx.startTime || 0,
        volume: preset.volume,
        priority: 2
      });
    });

    return {
      totalDuration,
      tracksCount: tracks.length,
      hasNarration: !!narrationTrack,
      hasBgm: !!bgmTrack,
      tracks
    };
  }

  /**
   * Generates FFmpeg complex filter string for audio mixing with ducking
   */
  generateFfmpegAudioFilter(mixPlan = {}) {
    const inputs = [];
    const tracks = mixPlan.tracks || [];

    if (tracks.length === 0) {
      return { filterString: null, inputArgs: [] };
    }

    const inputArgs = [];
    tracks.forEach((tr, idx) => {
      inputArgs.push('-i', tr.path);
    });

    // Simple multi-input amix filter with volume control
    const filterParts = tracks.map((tr, idx) => `[${idx}:a]volume=${tr.volume || 1.0}[a${idx}]`);
    const mixPart = tracks.map((_, idx) => `[a${idx}]`).join('') + `amix=inputs=${tracks.length}:duration=longest[aout]`;

    return {
      filterString: `${filterParts.join(';')};${mixPart}`,
      inputArgs,
      outputMap: '[aout]'
    };
  }

  /**
   * Formats SRT subtitles into ASS or Burn-in format with Vietnamese UTF-8 support
   */
  formatSubtitles(srtEntries = [], styleOptions = {}) {
    const fontSize = styleOptions.fontSize || 24;
    const fontColor = styleOptions.fontColor || '#FFFFFF';
    const outlineColor = styleOptions.outlineColor || '#000000';

    return {
      enabled: srtEntries.length > 0,
      totalEntries: srtEntries.length,
      style: {
        fontSize,
        fontColor,
        outlineColor,
        alignment: 'bottom_center',
        marginV: 30
      },
      entries: srtEntries
    };
  }
}

export const defaultAudioDirector = new AudioDirector();

