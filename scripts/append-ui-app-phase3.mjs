// scripts/append-ui-app-phase3.mjs
// Appends Phase 3 VFX & Weather Panel logic and Sprite Sheet Import handlers to app/ui/app.js

import fs from "fs";
import path from "path";

const appJsPath = path.resolve("app", "ui", "app.js");
let content = fs.readFileSync(appJsPath, "utf-8");

if (content.includes("toggleV4VfxWeatherPanel")) {
  console.log("app.js already contains Phase 3 logic.");
  process.exit(0);
}

const phase3Logic = `
// ============================================================================
// PHASE 3 — CARTOON VFX & WEATHER ENGINE CONTROLLER & PRESET EDITOR
// ============================================================================

const v4VfxState = {
  activeDemo: null,
  demoTimer: null,
  spriteSheetImg: null,
  spriteSheetTimer: null,
  categories: {
    emotion: [
      { id: "vfx_sweat_drop", name: "Giọt Mồ Hôi (Sweat Drop)", icon: "💧", color: "#38bdf8", attach: "head", layer: "front_character" },
      { id: "vfx_anger_mark", name: "Dấu Gân Giận Dữ (Anger Cross)", icon: "💢", color: "#ef4444", attach: "head", layer: "front_character" },
      { id: "vfx_anger_smoke", name: "Khói Bốc Trên Đầu (Anger Smoke)", icon: "♨️", color: "#f1f5f9", attach: "head", layer: "front_character" },
      { id: "vfx_question_mark", name: "Dấu Hỏi Băn Khoăn (Question Mark)", icon: "❓", color: "#38bdf8", attach: "head", layer: "front_character" },
      { id: "vfx_exclamation_mark", name: "Dấu Chấm Than (Exclamation Mark)", icon: "❗", color: "#f59e0b", attach: "head", layer: "front_character" },
      { id: "vfx_love_hearts", name: "Trái Tim Bay (Love Hearts)", icon: "💖", color: "#f43f5e", attach: "head", layer: "front_character" },
      { id: "vfx_cartoon_tears", name: "Nước Mắt Thác Nước (Cartoon Tears)", icon: "😭", color: "#60a5fa", attach: "face", layer: "front_character" },
      { id: "vfx_dizzy_stars", name: "Ngôi Sao Choáng (Dizzy Stars)", icon: "💫", color: "#fbbf24", attach: "head", layer: "front_character" },
      { id: "vfx_embarrassment_lines", name: "Vạch Ngại Ngùng (Blush Lines)", icon: "😳", color: "#f43f5e", attach: "face", layer: "front_character" },
      { id: "vfx_shock_lines", name: "Tia Nét Giật Mình (Shock Lines)", icon: "⚡", color: "#111827", attach: "head", layer: "front_character" },
      { id: "vfx_dark_gloom", name: "Bóng Đen U Ám (Dark Gloom)", icon: "🌑", color: "#1e1b4b", attach: "face", layer: "front_character" },
      { id: "vfx_idea_bulb", name: "Bóng Đèn Sáng Kiến (Idea Bulb)", icon: "💡", color: "#facc15", attach: "head", layer: "front_character" }
    ],
    action: [
      { id: "vfx_dust_cloud", name: "Đám Bụi Cuộn (Dust Cloud)", icon: "💨", color: "#e2e8f0", attach: "feet", layer: "front_character" },
      { id: "vfx_fight_smoke", name: "Khói Đánh Nhau (Fight Smoke Brawl)", icon: "🥊", color: "#f8fafc", attach: "body_center", layer: "front_character" },
      { id: "vfx_impact_flash", name: "Chớp Va Chạm (Impact Flash)", icon: "💥", color: "#fef08a", attach: "chest", layer: "front_character" },
      { id: "vfx_cartoon_explosion", name: "Vụ Nổ Hoạt Hình (Cartoon Explosion)", icon: "💣", color: "#f97316", attach: "chest", layer: "front_character" },
      { id: "vfx_speed_lines", name: "Vệt Tốc Độ (Speed Lines)", icon: "🏎️", color: "#ffffff", attach: "world", layer: "foreground" },
      { id: "vfx_shockwave", name: "Sóng Xung Kích (Shockwave)", icon: "⭕", color: "#67e8f9", attach: "feet", layer: "front_character" },
      { id: "vfx_ground_dust", name: "Bụi Bước Chân (Ground Dust)", icon: "👟", color: "#cbd5e1", attach: "feet", layer: "behind_character" },
      { id: "vfx_crash_stars", name: "Ngôi Sao Va Chạm (Crash Stars)", icon: "🌟", color: "#f59e0b", attach: "chest", layer: "front_character" },
      { id: "vfx_smoke_puff", name: "Khói Poof Biến Mất (Smoke Puff)", icon: "🗯️", color: "#f1f5f9", attach: "body_center", layer: "front_character" },
      { id: "vfx_comic_burst", name: "Bùng Nổ Truyện Tranh (Comic Burst)", icon: "💥", color: "#fde047", attach: "chest", layer: "front_character" }
    ],
    energy: [
      { id: "vfx_golden_aura", name: "Hào Quang Hoàng Kim (Golden Aura)", icon: "✨", color: "#fbbf24", attach: "body_center", layer: "behind_character" },
      { id: "vfx_blue_aura", name: "Hào Quang Lam Ngọc (Blue Aura)", icon: "🔹", color: "#38bdf8", attach: "body_center", layer: "behind_character" },
      { id: "vfx_red_aura", name: "Hào Quang Huyết Diễm (Red Aura)", icon: "🔥", color: "#ef4444", attach: "body_center", layer: "behind_character" },
      { id: "vfx_energy_ring", name: "Vòng Đai Năng Lượng (Energy Ring)", icon: "💫", color: "#38bdf8", attach: "chest", layer: "front_character" },
      { id: "vfx_lightning_energy", name: "Tia Sét Quanh Thân (Lightning Energy)", icon: "⚡", color: "#67e8f9", attach: "chest", layer: "front_character" },
      { id: "vfx_body_glow", name: "Phát Sáng Cơ Thể (Body Glow)", icon: "🌟", color: "#fef08a", attach: "body_center", layer: "behind_character" },
      { id: "vfx_power_burst", name: "Bùng Phát Nova (Power Burst)", icon: "💥", color: "#facc15", attach: "chest", layer: "front_character" },
      { id: "vfx_sparkles", name: "Hạt Sáng Lấp Lánh (Sparkles)", icon: "✨", color: "#ffffff", attach: "body_center", layer: "front_character" }
    ],
    scene: [
      { id: "vfx_camera_shake", name: "Rung Chấn Máy Quay (Camera Shake)", icon: "📳", color: "#ef4444", attach: "screen", layer: "screen_overlay" },
      { id: "vfx_screen_flash", name: "Chớp Sáng Toàn Cảnh (Screen Flash)", icon: "⚡", color: "#ffffff", attach: "screen", layer: "screen_overlay" },
      { id: "vfx_vignette", name: "Tối Góc Điện Ảnh (Vignette)", icon: "🕶️", color: "#090d16", attach: "screen", layer: "screen_overlay" },
      { id: "vfx_focus_lines", name: "Tia Nét Hội Tụ (Focus Lines)", icon: "🎯", color: "#ffffff", attach: "screen", layer: "foreground" }
    ],
    weather: [
      { id: "weather_rain_cinematic", name: "Mưa Rơi Điện Ảnh (Cinematic Rain)", icon: "🌧️", color: "#bae6fd", attach: "world", layer: "foreground" },
      { id: "weather_rain_heavy", name: "Mưa To Xối Xả (Heavy Rain)", icon: "⛈️", color: "#93c5fd", attach: "world", layer: "foreground" },
      { id: "weather_snow_gentle", name: "Tuyết Rơi Êm Đềm (Gentle Snow)", icon: "❄️", color: "#ffffff", attach: "world", layer: "foreground" },
      { id: "weather_wind_breeze", name: "Cơn Gió Hoạt Hình (Wind)", icon: "🍃", color: "#f1f5f9", attach: "world", layer: "foreground" },
      { id: "weather_sunshine_rays", name: "Tia Nắng Hoàng Kim (Sun Rays)", icon: "☀️", color: "#fef08a", attach: "world", layer: "background" },
      { id: "weather_fog_mystic", name: "Sương Mù Huyền Ảo (Fog)", icon: "🌫️", color: "#cbd5e1", attach: "world", layer: "foreground" },
      { id: "weather_storm_thunder", name: "Giông Bão Sấm Sét (Thunderstorm)", icon: "🌩️", color: "#93c5fd", attach: "world", layer: "foreground" },
      { id: "weather_env_leaves", name: "Lá Thu Vàng Rơi (Leaves)", icon: "🍂", color: "#ea580c", attach: "world", layer: "foreground" },
      { id: "weather_env_petals", name: "Cánh Hoa Bay (Petals)", icon: "🌸", color: "#f472b6", attach: "world", layer: "foreground" },
      { id: "weather_env_fireflies", name: "Đom Đóm Đêm (Fireflies)", icon: "✨", color: "#a3e635", attach: "world", layer: "foreground" }
    ]
  }
};

// 1. Bật / Tắt Bảng Điều Khiển Cartoon VFX & Weather
function toggleV4VfxWeatherPanel() {
  const panel = document.getElementById('v4VfxWeatherPanel');
  if (!panel) return;
  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    updateV4VfxCategoryOptions();
    showToast('✨ Đã mở Bộ Điều Khiển VFX & Thời Tiết V4 (Phase 3)');
  } else {
    panel.classList.add('hidden');
    if (v4VfxState.demoTimer) {
      clearInterval(v4VfxState.demoTimer);
      v4VfxState.demoTimer = null;
    }
  }
}

// 2. Điền danh sách hiệu ứng theo nhóm
function updateV4VfxCategoryOptions() {
  const catSel = document.getElementById('v4VfxCategorySelect');
  const itemSel = document.getElementById('v4VfxItemSelect');
  if (!catSel || !itemSel) return;

  const cat = catSel.value || 'emotion';
  const items = v4VfxState.categories[cat] || [];

  itemSel.innerHTML = items.map(it => 
    \`<option value="\${it.id}" data-color="\${it.color}" data-attach="\${it.attach}" data-layer="\${it.layer}">\${it.icon} \${it.name}</option>\`
  ).join('');

  if (items.length > 0) {
    const first = items[0];
    const colorEl = document.getElementById('v4VfxColor');
    const attachEl = document.getElementById('v4VfxAttachmentSelect');
    const layerEl = document.getElementById('v4VfxLayerSelect');
    if (colorEl && first.color) colorEl.value = first.color;
    if (attachEl && first.attach) attachEl.value = first.attach;
    if (layerEl && first.layer) layerEl.value = first.layer;
  }

  updateV4VfxLivePreview();
}

// 3. Cập nhật nhãn và render preview VFX trực tiếp
function updateV4VfxLivePreview() {
  const scale = document.getElementById('v4VfxScale')?.value || '1.0';
  const speed = document.getElementById('v4VfxSpeed')?.value || '1.0';
  const intensity = document.getElementById('v4VfxIntensity')?.value || '1.0';
  const particles = document.getElementById('v4VfxParticleCount')?.value || '25';

  const scaleVal = document.getElementById('v4VfxScaleVal');
  const speedVal = document.getElementById('v4VfxSpeedVal');
  const intensityVal = document.getElementById('v4VfxIntensityVal');
  const particleVal = document.getElementById('v4VfxParticleVal');

  if (scaleVal) scaleVal.textContent = scale + 'x';
  if (speedVal) speedVal.textContent = speed + 'x';
  if (intensityVal) intensityVal.textContent = intensity;
  if (particleVal) particleVal.textContent = particles;
}

// 4. Chạy demo tương tác trực tiếp
function runV4VfxInteractiveDemo(demoType) {
  if (v4VfxState.demoTimer) {
    clearInterval(v4VfxState.demoTimer);
    v4VfxState.demoTimer = null;
  }

  const catSel = document.getElementById('v4VfxCategorySelect');
  const itemSel = document.getElementById('v4VfxItemSelect');

  if (demoType === 'storm_aura') {
    if (catSel) catSel.value = 'energy';
    updateV4VfxCategoryOptions();
    if (itemSel) itemSel.value = 'vfx_golden_aura';
    showToast('⚡ Đang mô phỏng Hào Quang Hoàng Kim & Giông Bão Sấm Sét!');
  } else if (demoType === 'fight_smoke') {
    if (catSel) catSel.value = 'action';
    updateV4VfxCategoryOptions();
    if (itemSel) itemSel.value = 'vfx_fight_smoke';
    showToast('🥊 Đang mô phỏng Khói Ẩu Đả Hoạt Hình (Fight Smoke Brawl)!');
  }

  let step = 0;
  v4VfxState.demoTimer = setInterval(() => {
    step++;
    if (step > 60) {
      clearInterval(v4VfxState.demoTimer);
      v4VfxState.demoTimer = null;
    }
  }, 50);
}

// 5. Thêm cấu hình VFX vào cảnh hiện tại
function applyVfxToCurrentShot() {
  const itemSel = document.getElementById('v4VfxItemSelect');
  const attachSel = document.getElementById('v4VfxAttachmentSelect');
  const layerSel = document.getElementById('v4VfxLayerSelect');
  const color = document.getElementById('v4VfxColor')?.value || '#fbbf24';
  const scale = parseFloat(document.getElementById('v4VfxScale')?.value || '1.0');

  const vfxId = itemSel ? itemSel.value : 'vfx_golden_aura';
  const attach = attachSel ? attachSel.value : 'head';
  const layer = layerSel ? layerSel.value : 'front_character';

  showToast(\`✅ Đã gán hiệu ứng \${vfxId} (Vị trí: \${attach}, Lớp: \${layer}) vào Cảnh!\`);
}

// 6. Quản lý Modal Import Sprite Sheet ngoài
function openSpriteSheetImportModal() {
  const modal = document.getElementById('vfxSpriteSheetModal');
  if (modal) modal.classList.remove('hidden');
}

function closeSpriteSheetImportModal() {
  const modal = document.getElementById('vfxSpriteSheetModal');
  if (modal) modal.classList.add('hidden');
  if (v4VfxState.spriteSheetTimer) {
    clearInterval(v4VfxState.spriteSheetTimer);
    v4VfxState.spriteSheetTimer = null;
  }
}

function handleSpriteSheetFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      v4VfxState.spriteSheetImg = img;
      const saveBtn = document.getElementById('btnSaveSpriteSheetAsset');
      if (saveBtn) saveBtn.disabled = false;
      const nameInput = document.getElementById('ssAssetName');
      if (nameInput && !nameInput.value) {
        nameInput.value = file.name.replace(/\\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
      updateSpriteSheetPreviewCalc();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function updateSpriteSheetPreviewCalc() {
  const img = v4VfxState.spriteSheetImg;
  const canvas = document.getElementById('spriteSheetPreviewCanvas');
  const infoEl = document.getElementById('spriteSheetFrameInfo');
  if (!img || !canvas) return;

  const rows = parseInt(document.getElementById('ssRows')?.value || '1', 10);
  const cols = parseInt(document.getElementById('ssCols')?.value || '4', 10);
  const fps = parseInt(document.getElementById('ssFps')?.value || '12', 10);

  const fw = Math.floor(img.naturalWidth / cols);
  const fh = Math.floor(img.naturalHeight / rows);
  const totalFrames = rows * cols;

  if (infoEl) {
    infoEl.textContent = \`Lưới: \${cols}x\${rows} • Khung: \${fw}x\${fh}px • Tổng: \${totalFrames} frames\`;
  }

  if (v4VfxState.spriteSheetTimer) {
    clearInterval(v4VfxState.spriteSheetTimer);
  }

  let frame = 0;
  const ctx = canvas.getContext('2d');
  const interval = Math.max(16, Math.floor(1000 / fps));

  v4VfxState.spriteSheetTimer = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const col = frame % cols;
    const row = Math.floor(frame / cols);
    const sx = col * fw;
    const sy = row * fh;

    // Draw scaled contain
    const sc = Math.min((canvas.width - 20) / fw, (canvas.height - 20) / fh);
    const dw = fw * sc;
    const dh = fh * sc;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;

    ctx.drawImage(img, sx, sy, fw, fh, dx, dy, dw, dh);
    frame = (frame + 1) % totalFrames;
  }, interval);
}

async function saveCustomSpriteSheetAsset() {
  const img = v4VfxState.spriteSheetImg;
  if (!img) {
    showToast('Chưa chọn hình ảnh Sprite Sheet.');
    return;
  }

  const name = document.getElementById('ssAssetName')?.value || 'Hiệu Ứng Ngoài';
  const category = document.getElementById('ssAssetCategory')?.value || 'action';
  const rows = parseInt(document.getElementById('ssRows')?.value || '1', 10);
  const cols = parseInt(document.getElementById('ssCols')?.value || '4', 10);
  const fps = parseInt(document.getElementById('ssFps')?.value || '12', 10);
  const loop = document.getElementById('ssLoop')?.value === 'true';

  const safeId = 'vfx_custom_' + Date.now().toString(36);
  const assetPayload = {
    id: safeId,
    name,
    type: 'vfx',
    category,
    tags: ['custom', 'sprite_sheet', category],
    description: \`Sprite sheet nhập ngoài (\${cols}x\${rows} frames @ \${fps}fps)\`,
    dimensions: {
      width: Math.floor(img.naturalWidth / cols),
      height: Math.floor(img.naturalHeight / rows),
      scale: 1.0
    },
    parameters: { rows, cols, fps, loop, frameCount: rows * cols },
    compatibility: { bodyProfile: ['all'] }
  };

  try {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assetPayload)
    });
    const data = await res.json();
    if (data.success) {
      showToast(\`🎉 Đã lưu thành công hiệu ứng "\${name}" vào Universal Library!\`);
      closeSpriteSheetImportModal();
      loadUniversalAssetsList();
    } else {
      showToast('❌ Lỗi lưu asset: ' + (data.error || ''));
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message);
  }
}
`;

fs.writeFileSync(appJsPath, content + phase3Logic, "utf-8");
console.log("✔ Successfully appended Phase 3 UI handlers to app/ui/app.js!");

