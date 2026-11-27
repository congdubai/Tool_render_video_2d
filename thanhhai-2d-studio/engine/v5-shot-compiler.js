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
import { compileCharacterActingTracks } from './v5-character-acting-engine.js';
import { compileSceneCameraTrack } from './v5-camera-engine.js';

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
      const targetX = planChar.targetPosition
        ? (planChar.targetPosition[0] <= 1.5 ? Math.round(planChar.targetPosition[0] * 1280) : Math.round(planChar.targetPosition[0]))
        : (action.includes('walk') || action.includes('run') ? Math.min(960, posX + 260) : posX);

      // Collect per-character declarative actions from planChar.actions or planScene.actions matching target
      const charActions = [
        ...(Array.isArray(planChar.actions) ? planChar.actions : []),
        ...(Array.isArray(planScene.actions) ? planScene.actions.filter(a => !a.target || a.target === charId || a.target === planChar.id || a.target === c.id) : [])
      ].map(a => ({
        ...a,
        fromX: a.fromX !== undefined ? (a.fromX <= 1.5 ? Math.round(a.fromX * 1280) : a.fromX) : (a.type === 'walk' || a.type === 'walk_in' ? posX : undefined),
        toX: a.toX !== undefined ? (a.toX <= 1.5 ? Math.round(a.toX * 1280) : a.toX) : (a.targetX !== undefined ? (a.targetX <= 1.5 ? Math.round(a.targetX * 1280) : a.targetX) : (a.type === 'walk' || a.type === 'walk_in' ? targetX : undefined))
      }));

      const actingTrack = compileCharacterActingTracks({
        characterId: charId,
        x: posX,
        y: posY,
        targetX,
        view,
        action,
        emotion,
        secondaryEmotion,
        actions: charActions
      }, duration, sceneSeed + cIdx * 31);

      return {
        characterId: charId,
        x: posX,
        y: posY,
        scale,
        view,
        action,
        emotion,
        secondaryEmotion,
        targetX,
        actingTrack
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
    const cameraTrack = compileSceneCameraTrack(scene, planScene, duration);

    return {
      id: scene.id,
      duration,
      lighting: lightingProfile,
      styleProfile: sceneStyle,
      detailLevel: sceneDetail,
      backgroundSpec: bgAsset.vectorSpec,
      characters,
      props: compiledProps,
      vfx,
      cameraTrack
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
import {
  evaluateActingFrame,
  evaluatePropState,
  evaluateObjectInteractions,
  resolveSceneChoreography
} from '/engine/v5-character-acting-engine.js';
import {
  evaluateCameraFrame,
  applyCameraTransform
} from '/engine/v5-camera-engine.js';
import { cast } from '../cast.js';

registerCharacterProfiles(cast.characters || []);

const COMPILED_SCENES = ${JSON.stringify(compiledRenderDescriptors, null, 2)};

function renderCompiledScene(ctx, scene, t) {
  ctx.save();
  ctx.scale(1.5, 1.5); // 1280x720 logical design space -> 1920x1080 output

  const progress = Math.min(1, Math.max(0, t / Math.max(0.1, scene.duration)));
  const blinkCycle = t % 3.4;
  const isBlinking = blinkCycle > 3.22 && blinkCycle < 3.36;

  const chars = scene.characters || [];
  const choreography = resolveSceneChoreography(chars, t);
  const actingFrames = {};
  const charTracksList = [];
  const camEntities = {};
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c.actingTrack) charTracksList.push({ ...c.actingTrack, scale: c.scale || 2.45 });
    const acting = c.actingTrack
      ? evaluateActingFrame(c.actingTrack, t, { sceneEntities: choreography.entities })
      : {
          x: (c.action.includes('walk') || c.action.includes('run')) ? (c.x + (c.targetX - c.x) * progress) : c.x,
          y: c.y,
          view: c.view || 'three_quarter_right',
          expression: (c.secondaryEmotion && t >= scene.duration * 0.5) ? c.secondaryEmotion : (c.emotion || 'neutral'),
          look: [0, 0],
          talk: 0,
          blink: isBlinking,
          squashStretch: [1, 1],
          visible: true,
          vfxEffects: [],
          jointAngles: null
        };
    actingFrames[c.characterId] = acting;
    camEntities[c.characterId] = { x: acting.x, y: acting.y, width: 140, height: Math.round(160 * (c.scale || 2.45)) };
  }
  for (const prop of (scene.props || [])) {
    camEntities[prop.assetId] = { x: prop.x, y: prop.y, width: prop.width || 180, height: prop.height || 180 };
  }

  // Apply Unified 2D Camera Transform to Scene Graph (clamped to never expose blank canvas)
  const camState = evaluateCameraFrame(scene.cameraTrack, t, { entities: camEntities });
  applyCameraTransform(ctx, camState, 1280, 720);

  // 1. Render Multi-Layer Procedural Background Vector Spec
  if (scene.backgroundSpec) {
    renderToCanvas2d(ctx, scene.backgroundSpec, { useLayers: true });
  }

  let primaryCharX = chars.length > 0 ? actingFrames[chars[0].characterId].x : 510;
  let primaryCharHeadY = chars.length > 0 ? (actingFrames[chars[0].characterId].y - Math.round(145 * (chars[0].scale || 2.45))) : 260;

  // 2. Render Grounded / Held / Thrown Props + Object Interaction States
  const objStates = evaluateObjectInteractions(scene.props || [], charTracksList, t);
  for (const prop of (scene.props || [])) {
    if (!prop.vectorSpec || prop.isBulb) continue;
    const pState = evaluatePropState(prop, charTracksList, actingFrames, t);
    const oState = objStates[prop.assetId] || {};
    ctx.save();
    ctx.translate(pState.worldX + (oState.shakeX || 0), pState.worldY);
    if (pState.rotationDeg) ctx.rotate((pState.rotationDeg * Math.PI) / 180);
    ctx.translate(-prop.width / 2, -prop.height * 0.92);
    renderToCanvas2d(ctx, prop.vectorSpec, {
      useLayers: true,
      targetWidth: prop.width,
      targetHeight: prop.height
    });
    if (oState.screenGlow) {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.beginPath();
      ctx.roundRect(prop.width * 0.25, prop.height * 0.22, prop.width * 0.5, prop.height * 0.32, 8);
      ctx.fill();
    }
    if (oState.emitSmoke) {
      for (let sm = 0; sm < 3; sm++) {
        const off = (t * 45 + sm * 20) % 60;
        ctx.fillStyle = 'rgba(203, 213, 225, ' + (0.55 * (1 - off / 60)) + ')';
        ctx.beginPath();
        ctx.arc(prop.width * 0.5 + Math.sin(t * 6 + sm) * 12, prop.height * 0.15 - off, 14 + sm * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 3. Render Characters via Unified Character Renderer + Acting Engine (V5.2 Phase 3)
  const collectedVfx = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const acting = actingFrames[c.characterId];
    for (const fx of (acting.vfxEffects || [])) {
      collectedVfx.push({ ...fx, scale: c.scale || 2.45 });
    }
    if (!acting.visible) continue;

    drawUnifiedCharacter(ctx, {
      characterId: c.characterId,
      x: acting.x,
      y: acting.y,
      s: c.scale || 2.45,
      view: acting.view,
      pose: c.action || 'stand',
      jointAngles: acting.jointAngles,
      squashStretch: acting.squashStretch,
      expr: acting.expression,
      prevExpr: acting.prevExpression,
      exprBlend: acting.exprBlend,
      look: acting.look,
      talk: acting.talk,
      blink: acting.blink,
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
      ctx.ellipse(acting.x, acting.y - 75 * (c.scale || 2.45), 42 * (c.scale || 2.45), 82 * (c.scale || 2.45), 0, 0, Math.PI * 2);
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

  // 5. Render Scene VFX (Smoke, Sparkles) + Bounded Composite Acting VFX (Fight Cloud, Dizzy Stars, Power Aura)
  for (const fx of collectedVfx) {
    if (!fx.active) continue;
    if (fx.type === 'fight_cloud') {
      ctx.save();
      const cx = fx.x;
      const cy = fx.y - 70 * (fx.scale || 2.45);
      const puffCount = 8;
      for (let p = 0; p < puffCount; p++) {
        const ang = (p / puffCount) * Math.PI * 2 + fx.tLocal * 7;
        const rad = 52 + Math.sin(fx.tLocal * 12 + p) * 16;
        ctx.fillStyle = p % 2 === 0 ? 'rgba(241, 245, 249, 0.92)' : 'rgba(203, 213, 225, 0.88)';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * 44, cy + Math.sin(ang) * 32, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // Cartoon impact stars & exclamation bursts around cloud
      ctx.fillStyle = '#facc15';
      for (let st = 0; st < 4; st++) {
        const sa = fx.tLocal * 6 + st * (Math.PI / 2);
        const sx = cx + Math.cos(sa) * 98;
        const sy = cy + Math.sin(sa) * 72;
        ctx.beginPath();
        ctx.arc(sx, sy, 9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (fx.type === 'dizzy_stars') {
      ctx.save();
      const hx = fx.x;
      const hy = fx.y - 165 * (fx.scale || 2.45);
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#854d0e';
      ctx.lineWidth = 2;
      for (let st = 0; st < 3; st++) {
        const a = fx.tLocal * 5 + st * ((Math.PI * 2) / 3);
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * 38, hy + Math.sin(a) * 12, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (fx.type === 'power_aura') {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
      ctx.lineWidth = 5;
      const r = 68 + Math.sin(fx.tLocal * 15) * 10;
      ctx.beginPath();
      ctx.ellipse(fx.x, fx.y - 70 * (fx.scale || 2.45), r, r * 1.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (fx.type === 'smoke_burst') {
      ctx.save();
      for (let sm = 0; sm < 5; sm++) {
        const off = (fx.tLocal * 50 + sm * 18) % 80;
        ctx.fillStyle = 'rgba(148, 163, 184, ' + (0.65 * (1 - off / 80)) + ')';
        ctx.beginPath();
        ctx.arc(fx.x + Math.cos(sm * 1.4) * 30, fx.y - 110 - off, 18 + sm * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  for (const v of (scene.vfx || [])) {
    if (v.start !== undefined && t < Number(v.start)) continue;
    if (v.end !== undefined && t > Number(v.end)) continue;
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
