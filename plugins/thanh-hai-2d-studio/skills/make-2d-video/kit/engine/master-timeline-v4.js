// engine/master-timeline-v4.js — Master Timeline Engine, Camera, Transitions & Educational Graphics (V4)
// Coordinates multi-track scene playback, camera cinematography, seamless transitions,
// and rich Vietnamese/English educational graphics.

import { clamp, lerp, ease } from './core.js';
import { solveVfxCameraShake } from './vfx-engine-v4.js';
import { applyOutfitToCharacter } from './outfit-engine-v4.js';

/**
 * 1. CAMERA SHOT PRESETS SPECIFICATION
 */
export const CAMERA_SHOT_PRESETS = {
  establishing_shot: { label: 'Toàn cảnh Khởi đầu (Establishing Shot)', zoom: 0.95, y: 0, shake: 0 },
  wide_shot: { label: 'Góc Rộng (Wide Shot)', zoom: 1.05, y: -5, shake: 0 },
  medium_shot: { label: 'Trung Cảnh (Medium Shot)', zoom: 1.15, y: -10, shake: 0 },
  medium_close: { label: 'Trung Cận Cảnh (Medium Close-up)', zoom: 1.25, y: -20, shake: 0 },
  close_up: { label: 'Cận Cảnh Khuôn Mặt (Close-up)', zoom: 1.45, y: -35, shake: 0 },
  object_close: { label: 'Cận Cảnh Đồ Vật (Object Close-up)', zoom: 1.50, y: -20, shake: 0 },
  two_shot: { label: 'Cảnh Đôi Hai Nhân Vật (Two Shot)', zoom: 1.12, y: -10, shake: 0 },
  reaction_shot: { label: 'Góc Phản Ứng Cảm Xúc (Reaction Shot)', zoom: 1.35, y: -25, shake: 0 },
  reveal_shot: { label: 'Góc Tiết Lộ Bất Ngờ (Reveal Shot)', zoom: 1.20, y: -15, shake: 0 },
  follow_shot: { label: 'Góc Bám Theo Chuyển Động (Follow Shot)', zoom: 1.15, y: -10, shake: 0 }
};

/**
 * Giải tính trạng thái Camera tại mốc thời gian tLocal trong Scene
 */
export function solveCameraState(cameraSpec = {}, tLocal = 0, duration = 5.0) {
  const presetKey = cameraSpec.preset || 'medium_shot';
  const basePreset = CAMERA_SHOT_PRESETS[presetKey] || CAMERA_SHOT_PRESETS.medium_shot;

  let zoom = cameraSpec.zoom ?? basePreset.zoom;
  let x = cameraSpec.x ?? 0;
  let y = cameraSpec.y ?? basePreset.y;
  let rot = cameraSpec.rotation ?? 0;

  // Keyframes evaluation if present
  if (Array.isArray(cameraSpec.keyframes) && cameraSpec.keyframes.length >= 2) {
    const dur = Math.max(0.1, duration);
    const sorted = [...cameraSpec.keyframes].map(k => ({
      ...k,
      _t: typeof k.t === 'number' ? k.t : (typeof k.time === 'number' ? k.time / dur : 0)
    })).sort((a, b) => a._t - b._t);
    const p = clamp(tLocal / dur, 0, 1);

    for (let i = 0; i < sorted.length - 1; i++) {
      const k0 = sorted[i];
      const k1 = sorted[i + 1];
      if (p >= k0._t && p <= k1._t) {
        const segP = (p - k0._t) / Math.max(0.0001, (k1._t - k0._t));
        const smoothP = 0.5 - 0.5 * Math.cos(segP * Math.PI); // Smooth easeInOut
        zoom = lerp(k0.zoom ?? zoom, k1.zoom ?? zoom, smoothP);
        x = lerp(k0.x ?? x, k1.x ?? x, smoothP);
        y = lerp(k0.y ?? y, k1.y ?? y, smoothP);
        rot = lerp(k0.rot ?? rot, k1.rot ?? rot, smoothP);
        break;
      }
    }
  }

  // Camera Shake calculation
  let shakeOffset = { x: 0, y: 0 };
  const shakeIntensity = cameraSpec.shake || basePreset.shake || 0;
  if (shakeIntensity > 0) {
    shakeOffset = solveVfxCameraShake(tLocal, { intensity: shakeIntensity, frequency: 40 });
  }

  return {
    z: zoom,
    zoom: zoom,
    x: x + shakeOffset.x,
    y: y + shakeOffset.y,
    rotation: rot,
    shake: shakeIntensity
  };
}

/**
 * 2. SCENE TRANSITION ENGINE
 * Renders smooth video transition overlays between scenes.
 */
export function drawSceneTransition(ctx, transitionSpec = {}, progress = 0.0, W = 1280, H = 720) {
  let spec = transitionSpec;
  if (typeof transitionSpec === 'string') {
    spec = { type: transitionSpec };
  }
  const p = clamp(progress, 0.0, 1.0);
  const type = spec.type || 'cut';
  if (p <= 0.0 || p >= 1.0 || type === 'cut') return;

  ctx.save();

  if (type === 'fade' || type === 'cross_dissolve' || type === 'crossfade') {
    ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - p})`;
    ctx.fillRect(0, 0, W, H);
  } else if (type === 'dip_black') {
    const alpha = p < 0.5 ? p * 2 : (1.0 - p) * 2;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, W, H);
  } else if (type === 'dip_white') {
    const alpha = p < 0.5 ? p * 2 : (1.0 - p) * 2;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(0, 0, W, H);
  } else if (type === 'slide_left') {
    const offset = (1.0 - p) * W;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fillRect(W - offset, 0, offset, H);
  } else if (type === 'wipe_horizontal') {
    const curW = p * W;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, curW, H);
  } else if (type === 'smoke_puff') {
    const r = Math.sin(p * Math.PI) * (W * 0.7);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.85)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * 3. EDUCATIONAL GRAPHICS & DIAGRAM ENGINE
 * Renders high-legibility titles, callouts, comparison cards, and timeline graphics with Vietnamese font support.
 */
export function drawEducationalGraphic(ctx, graphicSpec = {}, tLocal = 0, W = 1280, H = 720) {
  const start = graphicSpec.start ?? 0.0;
  const end = graphicSpec.end ?? 999.0;
  if (tLocal < start || tLocal > end) return;

  const age = tLocal - start;
  const fadeIn = clamp(age / 0.35, 0, 1);
  const type = graphicSpec.type || 'callout_box';

  ctx.save();
  ctx.globalAlpha *= fadeIn;

  // ==========================================================================
  // TYPE 1: TITLE BANNER / HOOK CARD
  // ==========================================================================
  if (type === 'title_card') {
    const title = graphicSpec.title || 'SỰ TIẾN HÓA CỦA MÁY TÍNH';
    const subtitle = graphicSpec.subtitle || 'Từ Cỗ Máy Khổng Lồ Đến Thiết Bị Nhỏ Gọn';
    const cx = graphicSpec.x ?? W / 2;
    const cy = graphicSpec.y ?? 100;

    // Card background
    ctx.fillStyle = graphicSpec.bg || 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = graphicSpec.border || '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cx - 360, cy - 45, 720, 90, 10);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, cx, cy - 8);

    // Subtitle
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(subtitle, cx, cy + 24);
  }

  // ==========================================================================
  // TYPE 2: CALLOUT INFO BOX (Khung giải thích kiến thức)
  // ==========================================================================
  else if (type === 'callout_box') {
    const x = graphicSpec.x ?? 80;
    const y = graphicSpec.y ?? 160;
    const w = graphicSpec.w ?? 380;
    const h = graphicSpec.h ?? 200;
    const title = graphicSpec.title || 'THÔNG SỐ KỸ THUẬT:';
    const items = Array.isArray(graphicSpec.items) ? graphicSpec.items : [];

    // Background pill
    ctx.fillStyle = graphicSpec.bg || 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = graphicSpec.border || '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Header title
    ctx.fillStyle = graphicSpec.accent || '#38bdf8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 20, y + 32);

    // Bullet lines
    ctx.fillStyle = '#f8fafc';
    ctx.font = '13px monospace';
    for (let i = 0; i < items.length; i++) {
      ctx.fillText(`• ${items[i]}`, x + 20, y + 64 + i * 26);
    }
  }

  // ==========================================================================
  // TYPE 3: COMPARISON CARD (So sánh 2 thế hệ / đối tượng)
  // ==========================================================================
  else if (type === 'comparison_card') {
    const x = graphicSpec.x ?? (W / 2 - 320);
    const y = graphicSpec.y ?? 120;
    const leftTitle = graphicSpec.leftTitle || graphicSpec.title || 'MÁY TÍNH 1946 (ENIAC)';
    const leftText = graphicSpec.leftText || graphicSpec.subtitle || 'Nặng 30 Tấn • Chiếm 167m²';
    const rightTitle = graphicSpec.rightTitle || 'ĐIỆN THOẠI HIỆN ĐẠI';
    const rightText = graphicSpec.rightText || 'Nặng 180 Gram • Bỏ Túi';

    // Left Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.90)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 290, 110, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(leftTitle, x + 145, y + 35);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px sans-serif';
    ctx.fillText(leftText, x + 145, y + 70);

    // Right Box
    const rx = x + 350;
    ctx.fillStyle = 'rgba(30, 41, 59, 0.90)';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(rx, y, 290, 110, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(rightTitle, rx + 145, y + 35);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px sans-serif';
    ctx.fillText(rightText, rx + 145, y + 70);

    // Center "VS" Badge
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x + 320, y + 55, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', x + 320, y + 60);
  }

  // ==========================================================================
  // TYPE 4: TIMELINE BADGE (Mốc thời gian lịch sử)
  // ==========================================================================
  else if (type === 'timeline_badge') {
    const year = graphicSpec.year || '1946';
    const eventText = graphicSpec.event || 'Ra đời ENIAC';
    const x = graphicSpec.x ?? 80;
    const y = graphicSpec.y ?? 60;

    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, 220, 52, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`📅 ${year}:`, x + 14, y + 32);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(eventText, x + 95, y + 32);
  }

  ctx.restore();
}

/**
 * 4. MASTER TIMELINE COORDINATOR
 * Resolves full multi-track project state at any global timestamp.
 */
export function solveProjectStateAtTime(projectOrScenes = [], globalT = 0.0) {
  const scenes = Array.isArray(projectOrScenes) ? projectOrScenes : (projectOrScenes?.scenes || []);
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return null;
  }

  let activeScene = null;
  let activeSceneIdx = 0;

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    if (globalT >= s.start && globalT < s.end) {
      activeScene = s;
      activeSceneIdx = i;
      break;
    }
  }

  if (!activeScene) {
    activeScene = scenes[scenes.length - 1];
    activeSceneIdx = scenes.length - 1;
  }

  const tLocal = Math.max(0.0, globalT - activeScene.start);

  return {
    scene: activeScene,
    activeScene: activeScene,
    sceneIndex: activeSceneIdx,
    tLocal,
    localTime: tLocal,
    globalT,
    duration: activeScene.duration,
    activeSubtitle: activeScene.subtitle?.text || activeScene.narration?.subtitle || '',
    camera: solveCameraState(activeScene.camera, tLocal, activeScene.duration)
  };
}
