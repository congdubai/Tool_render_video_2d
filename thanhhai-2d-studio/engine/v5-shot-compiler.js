// engine/v5-shot-compiler.js — Real Scene-to-Shot Compiler (V5.2 Phase 1)
// Transforms compiled V4/V5 scenes + animation tracks + live Character Library profiles
// into executable Thanh Hai 2D Studio Canvas shots (config.json, story/shots.json, scenes/cast.js, scenes/shots/*.js).
// ZERO demo copies, ZERO hardcoded characters, ZERO debug overlays.

import fs from 'node:fs';
import path from 'node:path';
import { listCharacters } from '../../lib/character-library.mjs';

/**
 * Compiles a project's compiledScenes and animationTracks into runnable Thanh Hai 2D Studio files.
 */
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

  // 1. Load REAL live character profiles from data/characters/*.json (NEVER stale defaults!)
  const liveLibraryCharacters = listCharacters('all');
  const castPayload = {
    characters: liveLibraryCharacters,
    generatedAt: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(projectDir, 'scenes', 'cast.js'),
    `export const cast = ${JSON.stringify(castPayload, null, 2)};\n`,
    'utf8'
  );

  // 2. Build deterministic timeline shots from compiledScenes
  let cursor = 0;
  const shots = [];
  const planScenes = Array.isArray(scenePlan.scenes) ? scenePlan.scenes : [];

  const compiledRenderDescriptors = compiledScenes.map((scene, idx) => {
    const planScene = planScenes.find(ps => ps.id === scene.id) || planScenes[idx] || {};
    const duration = Math.max(0.5, Number(scene.duration || planScene.duration || 4));
    const start = Number(cursor.toFixed(3));
    const end = Number((cursor + duration).toFixed(3));
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

    // Normalize characters with their scene action, emotion, facing, position, scale, and animation track
    const rawChars = Array.isArray(scene.characters) && scene.characters.length > 0
      ? scene.characters
      : (Array.isArray(planScene.characters) ? planScene.characters : []);

    const characters = rawChars.map((c, cIdx) => {
      const planChar = (Array.isArray(planScene.characters) ? planScene.characters[cIdx] : null) || {};
      const charId = c.characterId || c.id || planChar.characterId || planChar.id;
      const trackKey = c.id || c.characterId || planChar.id || planChar.characterId || `char_${cIdx + 1}`;
      const track = animScene.characterTracks?.[trackKey] || animScene.characterTracks?.[charId] || Object.values(animScene.characterTracks || {})[cIdx] || {};

      // Position in 1280x720 logical coordinates
      let posX = 480 + cIdx * 240;
      let posY = 560;
      if (Array.isArray(c.position) && c.position.length >= 2) {
        posX = c.position[0] <= 1.5 ? Math.round(c.position[0] * 1280) : Math.round(c.position[0]);
        posY = c.position[1] <= 1.5 ? Math.round(c.position[1] * 720) : Math.round(c.position[1]);
      } else if (Array.isArray(planChar.position) && planChar.position.length >= 2) {
        posX = planChar.position[0] <= 1.5 ? Math.round(planChar.position[0] * 1280) : Math.round(planChar.position[0]);
        posY = planChar.position[1] <= 1.5 ? Math.round(planChar.position[1] * 720) : Math.round(planChar.position[1]);
      }
      // Keep feet cleanly on ground line (560) unless explicitly positioned higher/lower
      posY = Math.max(460, Math.min(620, posY));

      const action = (planChar.action || c.action || track.basePose || planScene.action || 'stand').toLowerCase();
      const emotion = (planChar.emotion || c.emotion || track.emotionKeyframes?.[0]?.emotion || planScene.emotion || 'neutral').toLowerCase();
      const secondaryEmotion = planChar.secondaryEmotion || planScene.secondaryEmotion || null;
      const view = planChar.facing || planChar.view || (typeof c.facing === 'string' ? c.facing : (c.facing === -1 ? 'three_quarter_left' : 'three_quarter_right'));

      return {
        characterId: charId,
        x: posX,
        y: posY,
        scale: Number(c.scale || planChar.scale || 1.55),
        view,
        action,
        emotion,
        secondaryEmotion,
        targetX: planChar.targetPosition
          ? (planChar.targetPosition[0] <= 1.5 ? Math.round(planChar.targetPosition[0] * 1280) : Math.round(planChar.targetPosition[0]))
          : (action.includes('walk') || action.includes('run') ? Math.min(1040, posX + 280) : posX)
      };
    });

    const props = (Array.isArray(scene.props) && scene.props.length > 0 ? scene.props : (planScene.props || [])).map(p => ({
      assetId: p.assetId || p.id || 'prop_generic',
      position: p.position || [820, 420],
      scale: p.scale || 1.0
    }));

    // Also inspect character-attached props from planScene
    for (const pc of (planScene.characters || [])) {
      if (pc.prop && pc.prop.assetId) {
        props.push({
          assetId: pc.prop.assetId,
          attachedTo: pc.prop.attachedTo || null,
          position: [820, 420],
          scale: 1.0
        });
      }
    }

    const vfx = Array.isArray(scene.vfx) && scene.vfx.length > 0 ? scene.vfx : (planScene.vfx || []);

    return {
      id: scene.id,
      duration,
      backgroundId: String(bgId),
      backgroundImage: bgBinding?.imagePath || null,
      characters,
      props,
      vfx
    };
  });

  const totalDuration = Number(cursor.toFixed(3));

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
    fadeIn: 0.2,
    fadeOut: 0.25,
    fps,
    duration: totalDuration,
    width,
    height,
    resolution: height >= 1080 ? '1080p' : '720p',
    aspect: '16:9',
    timeline: shotsJson
  };
  fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8');

  // 5. Write scenes/shots/01_compiled_scenes.js — real dynamic renderer driven strictly by compiledRenderDescriptors
  const shotModuleCode = `// Auto-compiled by Thanh Hai 2D Studio V5.2 Shot Compiler
// Project: ${projectId} | Duration: ${totalDuration}s | Scenes: ${compiledRenderDescriptors.length}
import { registerShot } from '/engine/core.js';
import {
  drawUnifiedCharacter,
  registerCharacterProfiles
} from '/engine/unified-character-renderer.js';
import { cast } from '../cast.js';

// Register live library characters from data/characters/*.json
registerCharacterProfiles(cast.characters || []);

const COMPILED_SCENES = ${JSON.stringify(compiledRenderDescriptors, null, 2)};

function drawBackground(ctx, bgId, t) {
  const id = String(bgId || '').toLowerCase();

  if (id.includes('street') || id.includes('city') || id.includes('road') || id.includes('outdoor')) {
    // --- URBAN STREET / CITY BACKGROUND ---
    const sky = ctx.createLinearGradient(0, 0, 0, 440);
    sky.addColorStop(0, '#38bdf8');
    sky.addColorStop(0.65, '#bae6fd');
    sky.addColorStop(1, '#fef3c7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 460);

    // Sun & Soft Clouds
    ctx.fillStyle = '#fde047';
    ctx.beginPath(); ctx.arc(1060, 110, 48, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    const cloudShift = (t * 14) % 1400;
    for (const [cx, cy, cr] of [[180, 110, 32], [540, 85, 28], [860, 125, 30]]) {
      const x = ((cx + cloudShift) % 1400) - 80;
      ctx.beginPath();
      ctx.arc(x, cy, cr, 0, Math.PI * 2);
      ctx.arc(x + cr * 0.9, cy - 6, cr * 0.85, 0, Math.PI * 2);
      ctx.arc(x + cr * 1.7, cy + 2, cr * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    // City Buildings Silhouette + Windows
    const buildings = [
      { x: 20,  w: 170, h: 270, col: '#f97316' },
      { x: 210, w: 190, h: 320, col: '#fb7185' },
      { x: 420, w: 160, h: 250, col: '#60a5fa' },
      { x: 600, w: 210, h: 340, col: '#a78bfa' },
      { x: 830, w: 180, h: 280, col: '#34d399' },
      { x: 1030,w: 220, h: 310, col: '#fbbf24' }
    ];
    for (const b of buildings) {
      const topY = 470 - b.h;
      ctx.fillStyle = b.col;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.fillRect(b.x, topY, b.w, b.h);
      ctx.strokeRect(b.x, topY, b.w, b.h);
      ctx.fillStyle = '#e0f2fe';
      for (let wy = topY + 24; wy < 430; wy += 44) {
        for (let wx = b.x + 22; wx < b.x + b.w - 32; wx += 42) {
          ctx.fillRect(wx, wy, 24, 28);
          ctx.strokeRect(wx, wy, 24, 28);
        }
      }
    }

    // Sidewalk & Curb
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 470, 1280, 110);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 574, 1280, 12);

    // Asphalt Road + Yellow Dashed Lane Divider
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 586, 1280, 134);
    ctx.fillStyle = '#facc15';
    for (let rx = 30; rx < 1280; rx += 120) {
      ctx.fillRect(rx, 646, 68, 10);
    }

    // Street Lamp Posts
    for (const lx of [160, 1110]) {
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(lx, 565); ctx.lineTo(lx, 260); ctx.lineTo(lx + (lx < 640 ? 45 : -45), 260); ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath(); ctx.arc(lx + (lx < 640 ? 45 : -45), 270, 12, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }

  if (id.includes('park') || id.includes('forest') || id.includes('nature')) {
    const sky = ctx.createLinearGradient(0, 0, 0, 480);
    sky.addColorStop(0, '#60a5fa');
    sky.addColorStop(1, '#dbeafe');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1280, 520);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 490, 1280, 230);
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(0, 540, 1280, 70);
    for (const tx of [180, 980, 1150]) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(tx - 16, 350, 32, 160);
      ctx.fillStyle = '#15803d';
      ctx.beginPath(); ctx.arc(tx, 320, 68, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }

  if (id.includes('cafe') || id.includes('coffee')) {
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 1280, 560);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 560, 1280, 160);
    ctx.fillStyle = '#fef3c7';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.fillRect(280, 110, 720, 290);
    ctx.strokeRect(280, 110, 720, 290);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(60, 430, 360, 130);
    ctx.strokeRect(60, 430, 360, 130);
    return;
  }

  // --- DEFAULT: MODERN RESEARCH LABORATORY ---
  const grad = ctx.createLinearGradient(0, 0, 0, 720);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.65, '#1e293b');
  grad.addColorStop(1, '#0c4a6e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1280, 720);

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.7)';
  ctx.lineWidth = 1;
  for (let x = 60; x < 1280; x += 100) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();
  }
  for (let y = 60; y < 560; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
  }

  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(60, 140, 200, 380);
  ctx.strokeRect(60, 140, 200, 380);
  ctx.fillRect(1020, 140, 200, 380);
  ctx.strokeRect(1020, 140, 200, 380);

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = (Math.sin(t * 4 + i) > 0) ? '#22c55e' : '#15803d';
    ctx.beginPath(); ctx.arc(90, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (Math.cos(t * 5 + i) > 0) ? '#38bdf8' : '#0369a1';
    ctx.beginPath(); ctx.arc(1050, 180 + i * 60, 5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 560, 1280, 160);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(1280, 560); ctx.stroke();

  ctx.fillStyle = '#334155';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 3;
  ctx.fillRect(680, 430, 360, 130);
  ctx.strokeRect(680, 430, 360, 130);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(660, 420, 400, 16);
}

function drawSceneProps(ctx, scene, t, primaryCharX) {
  for (const prop of (scene.props || [])) {
    const pid = String(prop.assetId || '').toLowerCase();
    if (pid.includes('computer') || pid.includes('eniac')) {
      ctx.save();
      ctx.translate(720, 240);
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.fillRect(0, 0, 260, 180);
      ctx.strokeRect(0, 0, 260, 180);
      ctx.fillStyle = '#052e16';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.fillRect(20, 20, 120, 80);
      ctx.strokeRect(20, 20, 120, 80);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let px = 0; px <= 104; px += 4) {
        const py = 60 + Math.sin(px * 0.12 + t * 6) * 14;
        if (px === 0) ctx.moveTo(28 + px, py);
        else ctx.lineTo(28 + px, py);
      }
      ctx.stroke();
      for (let tube = 0; tube < 4; tube++) {
        const glowAlpha = 0.5 + 0.5 * Math.sin(t * 12 + tube);
        ctx.fillStyle = 'rgba(251, 146, 60, ' + glowAlpha + ')';
        ctx.beginPath(); ctx.arc(170 + tube * 20, 45, 8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (pid.includes('bulb') || pid.includes('idea')) {
      const bx = primaryCharX || 510;
      const bulbPop = Math.min(1, t / 0.45);
      const bulbScale = 0.6 + 0.4 * bulbPop + Math.sin(t * 7) * 0.04;
      ctx.save();
      ctx.translate(bx + 6, 225);
      ctx.scale(bulbScale, bulbScale);
      const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 68);
      glow.addColorStop(0, 'rgba(250, 204, 21, 0.55)');
      glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 68, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-10, 27, 20, 14);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      for (let r = 0; r < 8; r++) {
        const angle = (r * Math.PI) / 4 + t * 1.8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * 38, Math.sin(angle) * 38);
        ctx.lineTo(Math.cos(angle) * 52, Math.sin(angle) * 52);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

function drawSceneVfx(ctx, scene, t) {
  for (const v of (scene.vfx || [])) {
    const vtype = String(v.type || '').toLowerCase();
    if (vtype.includes('smoke')) {
      const vx = Array.isArray(v.position) ? (v.position[0] <= 1.5 ? v.position[0] * 1280 : v.position[0]) : 820;
      const vy = Array.isArray(v.position) ? (v.position[1] <= 1.5 ? v.position[1] * 720 : v.position[1]) : 240;
      for (let smoke = 0; smoke < 4; smoke++) {
        const smokeOffset = (t * 42 + smoke * 22) % 90;
        const smokeAlpha = Math.max(0, 1 - smokeOffset / 90);
        ctx.fillStyle = 'rgba(203, 213, 225, ' + (smokeAlpha * 0.48) + ')';
        ctx.beginPath();
        ctx.arc(vx + smoke * 22 + Math.sin(t * 3 + smoke) * 8, vy - smokeOffset, 16 + smoke * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function renderCompiledScene(ctx, scene, t) {
  ctx.save();
  ctx.scale(1.5, 1.5);

  drawBackground(ctx, scene.backgroundId, t);

  const progress = Math.min(1, Math.max(0, t / Math.max(0.1, scene.duration)));
  const blinkCycle = t % 3.4;
  const isBlinking = blinkCycle > 3.22 && blinkCycle < 3.36;

  let primaryCharX = 510;
  for (let i = 0; i < (scene.characters || []).length; i++) {
    const c = scene.characters[i];
    const isMoving = c.action.includes('walk') || c.action.includes('run');
    const curX = isMoving ? (c.x + (c.targetX - c.x) * progress) : c.x;
    if (i === 0) primaryCharX = curX;

    const expr = (c.secondaryEmotion && t >= scene.duration * 0.5) ? c.secondaryEmotion : c.emotion;

    drawUnifiedCharacter(ctx, {
      characterId: c.characterId,
      x: curX,
      y: c.y,
      s: c.scale || 1.55,
      view: c.view || 'three_quarter_right',
      pose: c.action || 'stand',
      expr: expr || 'neutral',
      blink: isBlinking,
      t,
      shadow: true,
      debug: false,
      strict: true
    });
  }

  drawSceneProps(ctx, scene, t, primaryCharX);
  drawSceneVfx(ctx, scene, t);

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

