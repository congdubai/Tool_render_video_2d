// engine/v5-shot-compiler.js — Real Scene-to-Shot Compiler (V5.2 Phase 2)
// Compiles Scene Plan + Asset Bindings + Animation Tracks + Live Character Library
// + Procedural Vector Backgrounds & Props (with Style, Lighting, Perspective, Detail Level)
// into deterministic executable Thanh Hai 2D Studio Canvas shots.
// ZERO demo copies, ZERO hardcoded characters, ZERO debug overlays.

import fs from 'node:fs';
import path from 'node:path';
import { listCharacters } from '../../lib/character-library.mjs';
import { generateProceduralBackground } from './v5-procedural-backgrounds.js';
import { generateProceduralProp } from './v5-procedural-props.js';
import { resolveLightingProfile } from './v5-style-engine.js';

/**
 * Computes Smart Composition character scale & ground position based on camera shotType.
 * Reference heights in 1280x720 logical space (base character height ~ 160 units):
 *  - wide: 25-45% of 720 (~180-324px -> scale 1.55 - 2.0)
 *  - full / medium (default): 50-75% of 720 (~360-540px -> scale 2.35 - 2.75)
 *  - closeup: larger framing (~3.4)
 */
function computeSmartCharacterScale(shotType = 'full', explicitScale = null) {
  if (explicitScale !== null && explicitScale !== undefined && Number(explicitScale) > 0 && Number(explicitScale) !== 1.0) {
    return Number(explicitScale);
  }
  const st = String(shotType || 'full').toLowerCase();
  if (st.includes('wide') || st.includes('establishing')) return 1.85;
  if (st.includes('close')) return 3.1;
  if (st.includes('medium')) return 2.6;
  return 2.45; // ~392px = 54.4% of 720p height — clear, expressive & well-proportioned
}

export function compileProjectToShots(projectDir, payload = {}) {
  if (!projectDir) {
    throw new Error('Thiếu projectDir để biên dịch Shot Compiler.');
  }

  const {
    projectId = path.basename(projectDir),
    scenePlan = {},
    compiledScenes = [],
    animationTracks = {},
    bindings = {},
    fps = scenePlan?.project?.fps || 30,
    width = scenePlan?.project?.resolution?.width || 1920,
    height = scenePlan?.project?.resolution?.height || 1080
  } = payload;

  if (!Array.isArray(compiledScenes) || compiledScenes.length === 0) {
    throw new Error('Shot Compiler: Không có compiledScenes hợp lệ để biên dịch.');
  }

  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'story'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'scenes', 'shots'), { recursive: true });

  // 1. Load REAL live character profiles from data/characters/*.json
  const liveLibraryCharacters = listCharacters('all');
  fs.writeFileSync(
    path.join(projectDir, 'scenes', 'cast.js'),
    `export const cast = ${JSON.stringify({ characters: liveLibraryCharacters, generatedAt: new Date().toISOString() }, null, 2)};\n`,
    'utf8'
  );

  // 2. Build deterministic frame-locked timeline & compile procedural vector specs
  let cursor = 0;
  const shots = [];
  const planScenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];
  const projectStyle = scenePlan?.style?.profileId || scenePlan?.styleProfile || 'educational_cartoon';
  const projectLighting = scenePlan?.lighting || scenePlan?.timeOfDay || scenePlan?.environment?.lighting || 'daylight';
  const projectDetail = scenePlan?.detailLevel || 'medium';
  const projectSeed = scenePlan?.seed ?? 101;

  const compiledRenderDescriptors = compiledScenes.map((scene, idx) => {
    const planScene = planScenes.find(ps => ps.id === scene.id) || planScenes[idx] || {};
    const rawDuration = Math.max(0.5, Number(scene.duration || planScene.duration || 4));
    // Frame-locked duration to guarantee exact frame count (e.g. 8s @ 30fps = 240 frames)
    const sceneFrames = Math.round(rawDuration * fps);
    const duration = Number((sceneFrames / fps).toFixed(4));
    const start = Number(cursor.toFixed(4));
    const end = Number((cursor + duration).toFixed(4));
    cursor = end;

    shots.push({
      id: scene.id,
      name: scene.name || planScene.name || `Scene ${idx + 1}`,
      start,
      end,
      duration
    });

    const animScene = animationTracks[scene.id] || {};
    const bgId = scene.background?.assetId || scene.background?.id || planScene.background?.assetId || planScene.background?.id || 'bg_modern_lab';
    const bgBinding = bindings[bgId] || Object.values(bindings).find(b => b && (b.resolvedAssetId === bgId || b.requirementId === bgId)) || null;

    const sceneLighting = planScene.lighting || planScene.timeOfDay || planScene.background?.lighting || planScene.background?.timeOfDay || scene.lighting || bgBinding?.lighting || projectLighting;
    const sceneStyle = planScene.styleProfile || planScene.style?.profileId || scene.styleProfile || bgBinding?.styleProfile || projectStyle;
    const sceneDetail = planScene.detailLevel || scene.detailLevel || bgBinding?.detailLevel || projectDetail;
    const sceneSeed = planScene.seed ?? bgBinding?.seed ?? (projectSeed + idx * 7);
    const lightingProfile = resolveLightingProfile(sceneLighting);

    // Generate deterministic multi-layer procedural background vectorSpec (1280x720 logical design space)
    const bgAsset = generateProceduralBackground(String(bgId), {
      width: 1280,
      height: 720,
      styleProfile: sceneStyle,
      lighting: lightingProfile.id,
      timeOfDay: lightingProfile.id,
      detailLevel: sceneDetail,
      seed: sceneSeed,
      perspective: planScene.perspective || 'one_point'
    });

    const groundY = bgAsset.groundY || 560;
    const workbenchZone = bgAsset.placementZones?.workbenchZone || { x: 0.75, y: 0.62 };

    // Compile characters with Smart Composition & Ground Contact
    const rawChars = Array.isArray(scene.characters) && scene.characters.length > 0
      ? scene.characters
      : (Array.isArray(planScene.characters) ? planScene.characters : []);

    const shotType = planScene.camera?.shotType || scene.camera?.shotType || 'full';

    const characters = rawChars.map((c, cIdx) => {
      const planChar = (Array.isArray(planScene.characters) ? planScene.characters[cIdx] : null) || {};
      const charId = c.characterId || c.id || planChar.characterId || planChar.id;
      const trackKey = c.id || c.characterId || planChar.id || planChar.characterId || `char_${cIdx + 1}`;
      const track = animScene.characterTracks?.[trackKey] || animScene.characterTracks?.[charId] || Object.values(animScene.characterTracks || {})[cIdx] || {};

      let posX = Math.round(1280 * (0.30 + cIdx * 0.22));
      if (Array.isArray(planChar.position) && planChar.position.length >= 1) {
        posX = planChar.position[0] <= 1.5 ? Math.round(planChar.position[0] * 1280) : Math.round(planChar.position[0]);
      } else if (Array.isArray(c.position) && c.position.length >= 1) {
        posX = c.position[0] <= 1.5 ? Math.round(c.position[0] * 1280) : Math.round(c.position[0]);
      }

      // Ground contact strictly locked to background's perspective ground plane
      const posY = groundY;
      const action = (planChar.action || c.action || track.basePose || planScene.action || 'stand').toLowerCase();
      const emotion = (planChar.emotion || c.emotion || track.emotionKeyframes?.[0]?.emotion || planScene.emotion || 'neutral').toLowerCase();
      const secondaryEmotion = planChar.secondaryEmotion || planScene.secondaryEmotion || null;
      const view = planChar.facing || planChar.view || (typeof c.facing === 'string' ? c.facing : (c.facing === -1 ? 'three_quarter_left' : 'three_quarter_right'));
      const scale = computeSmartCharacterScale(shotType, planChar.scale || c.scale);

      return {
        characterId: charId,
        x: posX,
        y: posY,
        scale,
        view,
        action,
        emotion,
        secondaryEmotion,
        targetX: planChar.targetPosition
          ? (planChar.targetPosition[0] <= 1.5 ? Math.round(planChar.targetPosition[0] * 1280) : Math.round(planChar.targetPosition[0]))
          : (action.includes('walk') || action.includes('run') ? Math.min(960, posX + 260) : posX)
      };
    });

    // Compile Props with real Procedural Vector Specs + Anchor placement
    const rawProps = [
      ...(Array.isArray(scene.props) && scene.props.length > 0 ? scene.props : (planScene.props || []))
    ];
    for (const pc of (planScene.characters || [])) {
      if (pc.prop && pc.prop.assetId) {
        rawProps.push({
          assetId: pc.prop.assetId,
          attachedTo: pc.prop.attachedTo || null
        });
      }
    }

    const compiledProps = rawProps.map((p, pIdx) => {
      const pid = String(p.assetId || p.id || 'vintage_computer');
      const propAsset = generateProceduralProp(pid, {
        width: 512,
        height: 512,
        styleProfile: sceneStyle,
        lighting: lightingProfile.id,
        detailLevel: sceneDetail,
        seed: sceneSeed + pIdx * 13
      });

      const isBulb = pid.toLowerCase().includes('bulb') || pid.toLowerCase().includes('idea');
      const isComputer = pid.toLowerCase().includes('computer') || pid.toLowerCase().includes('eniac');

      // Place computer cleanly on lab workbench; lightbulb above head without covering face
      const drawW = isBulb ? 120 : (isComputer ? 260 : 180);
      const drawH = drawW;
      const px = isComputer ? Math.round(workbenchZone.x * 1280) : (p.position?.[0] <= 1.5 ? Math.round(p.position[0] * 1280) : (p.position?.[0] || 840));
      const py = isComputer ? Math.round(workbenchZone.y * 720) : (p.position?.[1] <= 1.5 ? Math.round(p.position[1] * 720) : groundY);

      return {
        assetId: pid,
        templateId: propAsset.templateId,
        isBulb,
        x: px,
        y: py,
        width: drawW,
        height: drawH,
        vectorSpec: propAsset.vectorSpec
      };
    });

    const vfx = Array.isArray(scene.vfx) && scene.vfx.length > 0 ? scene.vfx : (planScene.vfx || []);

    return {
      id: scene.id,
      duration,
      lighting: lightingProfile,
      styleProfile: sceneStyle,
      detailLevel: sceneDetail,
      backgroundSpec: bgAsset.vectorSpec,
      characters,
      props: compiledProps,
      vfx
    };
  });

  const totalDuration = Number(cursor.toFixed(4));

  // 3. Write story/shots.json
  const shotsJson = {
    fps,
    duration: totalDuration,
    shots
  };
  fs.writeFileSync(path.join(projectDir, 'story', 'shots.json'), JSON.stringify(shotsJson, null, 2), 'utf8');

  // 4. Write config.json
  const configJson = {
    name: scenePlan?.project?.title || projectId,
    version: '5.2',
    character: 'chibi',
    bars: 'none',
    fadeIn: 0.0,
    fadeOut: 0.0,
    fps,
    duration: totalDuration,
    width,
    height,
    resolution: height >= 1080 ? '1080p' : '720p',
    aspect: '16:9',
    timeline: shotsJson
  };
  fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8');

  // 5. Write scenes/shots/01_compiled_scenes.js — renders directly via Unified Vector Canvas & Unified Character Renderer
  const shotModuleCode = `// Auto-compiled by Thanh Hai 2D Studio V5.2 Phase 2 Shot Compiler
// Project: ${projectId} | Duration: ${totalDuration}s | Scenes: ${compiledRenderDescriptors.length}
import { registerShot } from '/engine/core.js';
import {
  drawUnifiedCharacter,
  registerCharacterProfiles
} from '/engine/unified-character-renderer.js';
import { renderToCanvas2d } from '/engine/v5-vector-canvas.js';
import { cast } from '../cast.js';

registerCharacterProfiles(cast.characters || []);

const COMPILED_SCENES = ${JSON.stringify(compiledRenderDescriptors, null, 2)};

function renderCompiledScene(ctx, scene, t) {
  ctx.save();
  ctx.scale(1.5, 1.5); // 1280x720 logical design space -> 1920x1080 output

  // 1. Render Multi-Layer Procedural Background Vector Spec
  if (scene.backgroundSpec) {
    renderToCanvas2d(ctx, scene.backgroundSpec, { useLayers: true });
  }

  const progress = Math.min(1, Math.max(0, t / Math.max(0.1, scene.duration)));
  const blinkCycle = t % 3.4;
  const isBlinking = blinkCycle > 3.22 && blinkCycle < 3.36;

  // 2. Render Grounded Props behind/beside characters
  let primaryCharX = 510;
  let primaryCharHeadY = 260;
  const chars = scene.characters || [];
  if (chars.length > 0) {
    const c0 = chars[0];
    const isMoving = c0.action.includes('walk') || c0.action.includes('run');
    primaryCharX = isMoving ? (c0.x + (c0.targetX - c0.x) * progress) : c0.x;
    primaryCharHeadY = c0.y - Math.round(145 * (c0.scale || 2.45));
  }

  for (const prop of (scene.props || [])) {
    if (!prop.vectorSpec || prop.isBulb) continue;
    ctx.save();
    // Anchor bottom-center of prop at (prop.x, prop.y)
    ctx.translate(prop.x - prop.width / 2, prop.y - prop.height * 0.92);
    renderToCanvas2d(ctx, prop.vectorSpec, {
      useLayers: true,
      targetWidth: prop.width,
      targetHeight: prop.height
    });
    ctx.restore();
  }

  // 3. Render Characters via Unified Character Renderer (V5.2 Phase 1)
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const isMoving = c.action.includes('walk') || c.action.includes('run');
    const curX = isMoving ? (c.x + (c.targetX - c.x) * progress) : c.x;
    const expr = (c.secondaryEmotion && t >= scene.duration * 0.5) ? c.secondaryEmotion : c.emotion;

    drawUnifiedCharacter(ctx, {
      characterId: c.characterId,
      x: curX,
      y: c.y,
      s: c.scale || 2.45,
      view: c.view || 'three_quarter_right',
      pose: c.action || 'stand',
      expr: expr || 'neutral',
      blink: isBlinking,
      t,
      shadow: true,
      debug: false,
      strict: true
    });

    // Subtle environmental lighting rim/tint if night or sunset
    if (scene.lighting?.characterTint) {
      ctx.save();
      ctx.fillStyle = scene.lighting.characterTint;
      ctx.beginPath();
      ctx.ellipse(curX, c.y - 75 * (c.scale || 2.45), 42 * (c.scale || 2.45), 82 * (c.scale || 2.45), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 4. Render Floating Idea Bulb Props cleanly above head (never covering face!)
  for (const prop of (scene.props || [])) {
    if (!prop.vectorSpec || !prop.isBulb) continue;
    const pop = Math.min(1, t / 0.35);
    const pulse = 0.85 + 0.15 * pop + Math.sin(t * 7) * 0.04;
    const bx = primaryCharX;
    const by = Math.max(70, primaryCharHeadY - 40);
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pulse, pulse);
    ctx.translate(-prop.width / 2, -prop.height / 2);
    renderToCanvas2d(ctx, prop.vectorSpec, {
      useLayers: true,
      targetWidth: prop.width,
      targetHeight: prop.height
    });
    ctx.restore();
  }

  // 5. Render Scene VFX (Smoke, Sparkles)
  for (const v of (scene.vfx || [])) {
    const vtype = String(v.type || '').toLowerCase();
    if (vtype.includes('smoke')) {
      const vx = Array.isArray(v.position) ? (v.position[0] <= 1.5 ? v.position[0] * 1280 : v.position[0]) : 920;
      const vy = Array.isArray(v.position) ? (v.position[1] <= 1.5 ? v.position[1] * 720 : v.position[1]) : 230;
      for (let smoke = 0; smoke < 4; smoke++) {
        const smokeOffset = (t * 42 + smoke * 22) % 90;
        const smokeAlpha = Math.max(0, 1 - smokeOffset / 90);
        ctx.fillStyle = 'rgba(203, 213, 225, ' + (smokeAlpha * 0.45) + ')';
        ctx.beginPath();
        ctx.arc(vx + smoke * 22 + Math.sin(t * 3 + smoke) * 8, vy - smokeOffset, 16 + smoke * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

for (const scene of COMPILED_SCENES) {
  registerShot(scene.id, {
    draw(ctx, t) {
      renderCompiledScene(ctx, scene, t);
    }
  });
}
`;

  fs.writeFileSync(path.join(projectDir, 'scenes', 'shots', '01_compiled_scenes.js'), shotModuleCode, 'utf8');

  return {
    success: true,
    projectDir,
    totalDuration,
    fps,
    width,
    height,
    shotsCount: shots.length,
    castCount: liveLibraryCharacters.length
  };
}
