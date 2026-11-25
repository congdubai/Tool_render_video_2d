// engine/scene-model-v4.js — Unified Scene Data Model & Scene Manager (V4)
// Single Source of Truth (SSOT) for video production across Preview, Timeline, and Video Export.
// Supports schema versioning, legacy migration, multi-track scene composition and scene management.

export const SCENE_SCHEMA_VERSION = 4;

/**
 * 1. UNIFIED SCENE MODEL GENERATOR
 * Creates a fully validated, complete scene object adhering to V4 specification.
 */
export function createDefaultScene(sceneId, options = {}) {
  if (typeof sceneId === 'object' && sceneId !== null) {
    options = sceneId;
    sceneId = options.id || options.sceneId;
  }
  const duration = Math.max(0.5, parseFloat(options.duration || 5.0));
  const start = Math.max(0.0, parseFloat(options.start ?? options.startTime ?? 0.0));
  const end = start + duration;

  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: sceneId || `scene_${Date.now()}`,
    name: options.name || `Cảnh ${sceneId || 'mới'}`,
    description: options.description || '',
    start,
    startTime: start,
    end,
    duration,
    locked: options.locked ?? false,
    visible: options.visible ?? true,
    thumbnail: options.thumbnail || null,

    // Narration & Subtitle Segment
    narration: {
      segmentId: options.narration?.segmentId || null,
      audioFile: options.narration?.audioFile || null,
      subtitle: options.narration?.subtitle || options.subtitle?.text || '',
      start: options.narration?.start ?? 0.0,
      end: options.narration?.end ?? duration,
      words: options.narration?.words || [],
      speaker: options.narration?.speaker || 'default'
    },
    subtitle: options.subtitle || { text: options.narration?.subtitle || '' },

    // Background & Multi-layer Environment
    background: {
      id: options.background?.id || options.background?.assetId || 'bg_lab_modern',
      assetId: options.background?.assetId || options.background?.id || 'bg_lab_modern',
      type: options.background?.type || 'indoor',
      filePath: options.background?.filePath || null,
      layers: options.background?.layers || [
        { id: 'sky', depth: 0.1, src: null },
        { id: 'far', depth: 0.3, src: null },
        { id: 'mid', depth: 0.7, src: null },
        { id: 'ground', depth: 1.0, src: null }
      ],
      groundY: options.background?.groundY ?? 560,
      parallax: options.background?.parallax ?? true,
      brightness: options.background?.brightness ?? 1.0,
      contrast: options.background?.contrast ?? 1.0,
      blur: options.background?.blur ?? 0.0,
      colorOverlay: options.background?.colorOverlay || null
    },

    // Environment & Weather
    environment: {
      lighting: options.environment?.lighting || 'dusk',
      ambientColor: options.environment?.ambientColor || 'rgba(0,0,0,0)',
      weather: options.environment?.weather || options.weather?.type || null
    },
    weather: options.weather || (options.environment?.weather ? { type: options.environment.weather } : { type: 'none', intensity: 0.0 }),

    // Characters Bindings & Transform
    characters: Array.isArray(options.characters) ? options.characters : [
      {
        characterId: 'doc',
        role: 'presenter',
        outfitId: 'outfit_scientist_labcoat',
        outfitOverrides: {},
        position: [640, 580],
        scale: 1.05,
        rotation: 0.0,
        facing: 1,
        groundAligned: true,
        zIndex: 10,
        visible: true,
        locked: false
      }
    ],

    // Handheld & World Props
    props: Array.isArray(options.props) ? options.props : [],

    // Character Expressions Track
    expressions: Array.isArray(options.expressions) ? options.expressions : [
      { characterId: 'doc', exprId: 'neutral', start: 0.0, end: duration, intensity: 1.0 }
    ],

    // Actions & Composite Actions Track
    actions: Array.isArray(options.actions) ? options.actions : [],
    compositeActions: Array.isArray(options.compositeActions) ? options.compositeActions : [],

    // Cartoon VFX Track
    vfx: Array.isArray(options.vfx) ? options.vfx : [],

    // 2D Camera Track & Presets
    camera: {
      preset: options.camera?.preset || 'medium_shot',
      zoom: options.camera?.zoom ?? 1.15,
      x: options.camera?.x ?? 0,
      y: options.camera?.y ?? -10,
      rotation: options.camera?.rotation ?? 0,
      shake: options.camera?.shake ?? 0,
      followTarget: options.camera?.followTarget || null,
      keyframes: options.camera?.keyframes || []
    },

    // Scene Transition Engine
    transition: {
      in: { type: options.transition?.in?.type || 'cut', duration: options.transition?.in?.duration || 0.0 },
      out: { type: options.transition?.out?.type || 'cut', duration: options.transition?.out?.duration || 0.0 }
    },

    // Text & Educational Graphics (Diagrams, callouts, arrows, comparison cards)
    textGraphics: Array.isArray(options.textGraphics) ? options.textGraphics : [],

    // Audio Mixing (Volume, SFX, BGM, Ducking)
    audio: {
      narrationVolume: options.audio?.narrationVolume ?? 1.0,
      bgmTrack: options.audio?.bgmTrack || null,
      bgmVolume: options.audio?.bgmVolume ?? 0.25,
      sfx: options.audio?.sfx || [],
      ducking: options.audio?.ducking ?? true
    },

    // Composition & Visual Hierarchy Presets
    composition: {
      layoutPreset: options.composition?.layoutPreset || 'center_presenter',
      safeArea: options.composition?.safeArea ?? true,
      ruleOfThirds: options.composition?.ruleOfThirds ?? false
    },

    // Metadata & Asset Dependencies Tracking
    dependencies: options.dependencies || [],
    validation: { isValid: true, errors: [], warnings: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * 2. MIGRATION ADAPTER: Upgrades legacy V1/V2/V3 project shots into Unified V4 Scene
 */
export function migrateSceneToV4(legacy) {
  if (!legacy || typeof legacy !== 'object') {
    return createDefaultScene('scene_001');
  }

  // If already V4 schema
  if (legacy.schemaVersion === SCENE_SCHEMA_VERSION && legacy.characters && legacy.camera) {
    return legacy;
  }

  const duration = parseFloat(legacy.duration || ((legacy.end || 5.0) - (legacy.start || 0.0)) || 5.0);
  const start = parseFloat(legacy.start || 0.0);

  const migrated = createDefaultScene(legacy.id || legacy.shotId || `scene_${Date.now()}`, {
    name: legacy.name || legacy.title || legacy.line?.slice(0, 30) || 'Cảnh phim',
    description: legacy.scene || legacy.line || '',
    duration,
    start,
    narration: {
      subtitle: legacy.line || legacy.subtitle || '',
      start: 0.0,
      end: duration
    },
    background: {
      id: legacy.background || 'bg_lab_modern',
      groundY: legacy.groundY || 0.80
    },
    environment: {
      lighting: legacy.style || 'dusk'
    }
  });

  return migrated;
}

/**
 * 3. SCENE MANAGER CLASS
 * Provides full lifecycle and manipulation of project scenes.
 */
export class SceneManager {
  constructor(scenes = null) {
    this.scenes = [];
    if (Array.isArray(scenes)) {
      this.scenes = scenes.map(s => migrateSceneToV4(s));
      this.recalculateTimeline();
    } else {
      this.scenes.push(createDefaultScene('s001', { name: 'Cảnh 1: Mở đầu' }));
    }
    this.history = [];
    this.historyIndex = -1;
    this.saveState();
  }

  saveState() {
    // Truncate future history if at middle
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(JSON.stringify(this.scenes));
    if (this.history.length > 50) this.history.shift();
    this.historyIndex = this.history.length - 1;
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.scenes = JSON.parse(this.history[this.historyIndex]);
      return true;
    }
    return false;
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.scenes = JSON.parse(this.history[this.historyIndex]);
      return true;
    }
    return false;
  }

  getScenes() {
    return this.scenes;
  }

  getScene(id) {
    return this.scenes.find(s => s.id === id) || null;
  }

  getSceneIndex(id) {
    return this.scenes.findIndex(s => s.id === id);
  }

  addScene(options = {}, insertIndex = -1) {
    const id = options.id || `s${String(this.scenes.length + 1).padStart(3, '0')}`;
    const newScene = createDefaultScene(id, options);

    if (insertIndex >= 0 && insertIndex <= this.scenes.length) {
      this.scenes.splice(insertIndex, 0, newScene);
    } else {
      this.scenes.push(newScene);
    }

    this.recalculateTimeline();
    this.saveState();
    return newScene;
  }

  duplicateScene(id) {
    const idx = this.getSceneIndex(id);
    if (idx === -1) return null;

    const source = this.scenes[idx];
    const clone = JSON.parse(JSON.stringify(source));
    clone.id = `${source.id}_copy_${Date.now().toString().slice(-4)}`;
    clone.name = `${source.name} (Bản sao)`;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = new Date().toISOString();

    this.scenes.splice(idx + 1, 0, clone);
    this.recalculateTimeline();
    this.saveState();
    return clone;
  }

  deleteScene(id) {
    if (this.scenes.length <= 1) {
      throw new Error('Dự án phải giữ lại ít nhất 1 cảnh.');
    }
    const idx = this.getSceneIndex(id);
    if (idx === -1) return false;

    const removed = this.scenes.splice(idx, 1)[0];
    this.recalculateTimeline();
    this.saveState();
    return true;
  }

  splitScene(id, splitLocalTime) {
    const idx = this.getSceneIndex(id);
    if (idx === -1) return null;

    const orig = this.scenes[idx];
    const splitT = parseFloat(splitLocalTime);
    if (splitT <= 0.2 || splitT >= orig.duration - 0.2) {
      throw new Error('Thời điểm chia cảnh phải nằm trong khoảng hợp lệ.');
    }

    const firstPart = JSON.parse(JSON.stringify(orig));
    firstPart.duration = splitT;
    firstPart.end = firstPart.start + splitT;
    firstPart.name = `${orig.name} (Phần 1)`;

    const secondPart = JSON.parse(JSON.stringify(orig));
    secondPart.id = `${orig.id}_part2_${Date.now().toString().slice(-4)}`;
    secondPart.duration = orig.duration - splitT;
    secondPart.name = `${orig.name} (Phần 2)`;

    // Adjust sub-track intervals for second part
    const offset = splitT;
    if (secondPart.actions) {
      secondPart.actions = secondPart.actions
        .filter(a => a.end > offset)
        .map(a => ({ ...a, start: Math.max(0, a.start - offset), end: a.end - offset }));
    }
    if (secondPart.vfx) {
      secondPart.vfx = secondPart.vfx
        .filter(v => v.end > offset)
        .map(v => ({ ...v, start: Math.max(0, v.start - offset), end: v.end - offset }));
    }

    this.scenes.splice(idx, 1, firstPart, secondPart);
    this.recalculateTimeline();
    this.saveState();
    return [firstPart, secondPart];
  }

  mergeScenes(id1, id2) {
    const idx1 = this.getSceneIndex(id1);
    const idx2 = this.getSceneIndex(id2);
    if (idx1 === -1 || idx2 === -1 || Math.abs(idx1 - idx2) !== 1) {
      throw new Error('Chỉ có thể ghép hai cảnh nằm liền kề nhau.');
    }

    const firstIdx = Math.min(idx1, idx2);
    const s1 = this.scenes[firstIdx];
    const s2 = this.scenes[firstIdx + 1];

    const merged = JSON.parse(JSON.stringify(s1));
    const offset = s1.duration;
    merged.duration = s1.duration + s2.duration;
    merged.name = `${s1.name} + ${s2.name}`;

    // Append actions and vfx from s2 shifted by offset
    if (s2.actions) {
      const shiftedActions = s2.actions.map(a => ({ ...a, start: a.start + offset, end: a.end + offset }));
      merged.actions = [...(merged.actions || []), ...shiftedActions];
    }
    if (s2.vfx) {
      const shiftedVfx = s2.vfx.map(v => ({ ...v, start: v.start + offset, end: v.end + offset }));
      merged.vfx = [...(merged.vfx || []), ...shiftedVfx];
    }
    if (s2.textGraphics) {
      const shiftedText = s2.textGraphics.map(t => ({ ...t, start: t.start + offset, end: t.end + offset }));
      merged.textGraphics = [...(merged.textGraphics || []), ...shiftedText];
    }

    this.scenes.splice(firstIdx, 2, merged);
    this.recalculateTimeline();
    this.saveState();
    return merged;
  }

  reorderScenes(orderedIds) {
    if (!Array.isArray(orderedIds) || orderedIds.length !== this.scenes.length) {
      throw new Error('Danh sách ID sắp xếp không hợp lệ.');
    }

    const newScenes = [];
    for (const id of orderedIds) {
      const found = this.getScene(id);
      if (!found) throw new Error(`Không tìm thấy cảnh ID: ${id}`);
      newScenes.push(found);
    }

    this.scenes = newScenes;
    this.recalculateTimeline();
    this.saveState();
    return this.scenes;
  }

  updateSceneDuration(id, newDuration) {
    const s = this.getScene(id);
    if (!s) return false;
    const dur = Math.max(0.5, parseFloat(newDuration));
    s.duration = dur;
    s.updatedAt = new Date().toISOString();
    this.recalculateTimeline();
    this.saveState();
    return true;
  }

  toggleLock(id) {
    const s = this.getScene(id);
    if (!s) return false;
    s.locked = !s.locked;
    s.updatedAt = new Date().toISOString();
    this.saveState();
    return s.locked;
  }

  toggleVisibility(id) {
    const s = this.getScene(id);
    if (!s) return false;
    s.visible = !s.visible;
    s.updatedAt = new Date().toISOString();
    this.saveState();
    return s.visible;
  }

  reorderScene(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.scenes.length || toIndex < 0 || toIndex >= this.scenes.length) {
      return false;
    }
    const [moved] = this.scenes.splice(fromIndex, 1);
    this.scenes.splice(toIndex, 0, moved);
    this.recalculateTimeline();
    this.saveState();
    return true;
  }

  recalculateTimeline() {
    let currentT = 0.0;
    for (const s of this.scenes) {
      s.start = currentT;
      s.startTime = currentT;
      s.end = currentT + s.duration;
      currentT = s.end;
    }
    return currentT;
  }

  getTotalDuration() {
    return this.recalculateTimeline();
  }

  toJSON() {
    return {
      schemaVersion: SCENE_SCHEMA_VERSION,
      totalDuration: this.getTotalDuration(),
      sceneCount: this.scenes.length,
      scenes: this.scenes
    };
  }
}

/**
 * Creates a default project container for V4 scenes.
 */
export function createDefaultProjectV4(options = {}) {
  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    metadata: {
      name: options.name || 'Thanh Hai 2D Production',
      author: options.author || 'User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    settings: {
      fps: options.fps || 24,
      resolution: {
        width: options.width || 1280,
        height: options.height || 720
      }
    },
    scenes: options.scenes || [],
    assets: options.assets || {},
    audio: options.audio || {
      voiceover: null,
      bgm: null,
      sfx: []
    }
  };
}
