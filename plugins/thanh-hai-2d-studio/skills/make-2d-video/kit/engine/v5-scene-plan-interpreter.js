// engine/v5-scene-plan-interpreter.js — Scene Plan Interpreter & V4 Compiler (V5)
// Compiles declarative Scene Plan JSON directly into concrete V4 Scene Objects
// without requiring manual user assembly, ready for real-time preview and MP4 video rendering.

import { createDefaultScene, createDefaultProjectV4 } from './scene-model-v4.js';
import { validateScenePlan } from './v5-scene-plan-validator.js';

export function compileScenePlanToV4(scenePlan = {}, projectContext = {}) {
  const validation = validateScenePlan(scenePlan, projectContext);
  if (!validation.canCompile) {
    throw new Error(`Không thể biên dịch Scene Plan vì có ${validation.errors.length} lỗi nghiêm trọng: ${validation.errors[0]?.message}`);
  }

  const scenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  const v4Scenes = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const startSec = (s.startMs || 0) / 1000;
    const endSec = (s.endMs || (s.startMs + 5000)) / 1000;
    const durationSec = Math.max(0.5, endSec - startSec);

    // Coordinate conversion: Normalized (0..1) -> Canvas Pixels (1280x720)
    const characters = (s.characters || []).map(c => {
      const posX = typeof c.position?.x === 'number' ? (c.position.x <= 1.0 ? Math.round(c.position.x * 1280) : c.position.x) : 640;
      const posY = typeof c.position?.y === 'number' ? (c.position.y <= 1.0 ? Math.round(c.position.y * 720) : c.position.y) : 570;

      return {
        id: c.characterId || c.instanceId || 'doc',
        characterId: c.characterId || c.instanceId || 'doc',
        x: posX,
        y: posY,
        scale: c.scale ?? 1.0,
        facing: c.facing ?? 1,
        outfit: c.outfitId || 'outfit_scientist_labcoat',
        expression: c.expressionId || 'neutral',
        prop: c.prop ? {
          assetId: c.prop.assetId,
          attachedTo: c.prop.attachedTo || 'right_hand'
        } : null
      };
    });

    // Camera keyframes conversion
    const cameraKeyframes = (s.camera?.keyframes || []).map(k => ({
      time: (k.timeMs ?? 0) / 1000,
      zoom: k.zoom ?? 1.0,
      x: k.x ?? 0,
      y: k.y ?? 0
    }));

    // Text graphics mapping
    const textGraphics = (s.textGraphics || []).map(tg => ({
      ...tg,
      type: tg.type || 'title_card',
      title: tg.title || '',
      subtitle: tg.subtitle || ''
    }));

    // Composite actions and visual beats
    const compositeActions = [];
    const vfx = [];
    for (const beat of (s.visualBeats || [])) {
      if (beat.actionId && beat.actionId.startsWith('composite_')) {
        compositeActions.push({
          id: beat.actionId,
          start: Math.max(0, (beat.startMs - s.startMs) / 1000),
          duration: Math.max(0.5, (beat.endMs - beat.startMs) / 1000)
        });
      }
      if (beat.vfxId) {
        vfx.push({
          type: beat.vfxId,
          target: beat.target || 'doc'
        });
      }
    }

    const v4Scene = createDefaultScene(s.id, {
      name: s.visualObjective || s.narrationText?.slice(0, 35) || `Cảnh ${i + 1}`,
      start: startSec,
      startTime: startSec,
      duration: durationSec,
      narration: {
        subtitle: s.narrationText || '',
        start: 0,
        end: durationSec
      },
      subtitle: {
        text: s.narrationText || ''
      },
      background: {
        assetId: s.background?.assetId || 'bg_lab_modern',
        id: s.background?.assetId || 'bg_lab_modern',
        type: 'library',
        groundY: 570
      },
      characters,
      camera: {
        preset: s.camera?.preset || 'medium_shot',
        zoom: s.camera?.zoom ?? 1.15,
        keyframes: cameraKeyframes
      },
      transition: {
        in: {
          type: s.transition?.type || 'cut',
          duration: (s.transition?.durationMs || 0) / 1000
        },
        out: { type: 'cut', duration: 0 }
      },
      textGraphics,
      compositeActions,
      vfx
    });

    v4Scenes.push(v4Scene);
  }

  // Create full compiled V4 Project structure
  const v4Project = createDefaultProjectV4({
    name: scenePlan.project?.title || 'Dự Án AI Storyboard V5',
    author: 'AI Auto Director V5',
    fps: scenePlan.project?.fps || 24,
    width: scenePlan.project?.resolution?.width || 1280,
    height: scenePlan.project?.resolution?.height || 720,
    scenes: v4Scenes
  });

  return {
    success: true,
    compiledProject: v4Project,
    scenes: v4Scenes,
    stats: {
      compiledSceneCount: v4Scenes.length,
      totalDurationSec: v4Scenes.reduce((acc, sc) => acc + sc.duration, 0)
    }
  };
}
