// scripts/patch-ui-phase3.mjs
// Adds VFX & Weather Engine Panel and Sprite Sheet Import Modal to UI

import fs from "fs";
import path from "path";

const indexHtmlPath = path.resolve("app", "ui", "index.html");
const appJsPath = path.resolve("app", "ui", "app.js");

// 1. PATCH INDEX.HTML
let html = fs.readFileSync(indexHtmlPath, "utf-8");

// A. Add Toolbar button
const buttonTarget = `<button class="btn btn-sm btn-outline" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700;" onclick="toggleV4ExpressionsPropsPanel()">
            📦 Expressions & Props V4 Test
          </button>`;

const newButton = `<button class="btn btn-sm btn-outline" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700;" onclick="toggleV4ExpressionsPropsPanel()">
            📦 Expressions & Props V4 Test
          </button>
          <button class="btn btn-sm btn-outline" style="border-color: #a855f7; color: #c084fc; font-weight: 700;" onclick="toggleV4VfxWeatherPanel()">
            ✨ VFX & Weather Engine V4
          </button>`;

if (html.includes(buttonTarget) && !html.includes("toggleV4VfxWeatherPanel")) {
  html = html.replace(buttonTarget, newButton);
  console.log("✔ Added toggleV4VfxWeatherPanel button to index.html");
}

// B. Add v4VfxWeatherPanel right after v4ExpressionsPropsPanel
const panelEndTarget = `              </div>
            </div>

            <!-- 1. Tùy chọn cấu hình xuất video & Engine -->`;

const vfxPanelHtml = `              </div>
            </div>

            <!-- Khu vực Cartoon VFX & Weather Engine V4 (Phase 3) -->
            <div id="v4VfxWeatherPanel" class="hidden" style="background: #0f172a; border: 1px solid #a855f7; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #334155; padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: #c084fc; font-size: 14px;">✨ BỘ ĐIỀU KHIỂN HOẠT HÌNH VFX & THỜI TIẾT V4</strong>
                  <span class="asset-type-badge badge-vfx" style="position: static;">PHASE 3</span>
                </div>
                <span class="hint-small" style="color: #94a3b8;">Deterministic Particles • 6-Layer Compositing • Skeletal Attachment</span>
              </div>

              <!-- Hàng chọn nhóm hiệu ứng & hiệu ứng cụ thể -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px;">
                <div class="setting-item">
                  <label for="v4VfxCategorySelect">Nhóm Hiệu Ứng (Category):</label>
                  <select id="v4VfxCategorySelect" class="select-control" onchange="updateV4VfxCategoryOptions()">
                    <option value="emotion" selected>🎭 Hiệu ứng Cảm xúc (Emotion VFX)</option>
                    <option value="action">💥 Hiệu ứng Hành động (Action VFX)</option>
                    <option value="energy">⚡ Hiệu ứng Năng lượng (Energy & Auras)</option>
                    <option value="scene">🎬 Hiệu ứng Toàn cảnh (Scene & Camera)</option>
                    <option value="weather">🌧️ Thời tiết & Môi trường (Weather & Env)</option>
                  </select>
                </div>

                <div class="setting-item">
                  <label for="v4VfxItemSelect">Hiệu Ứng (VFX Item):</label>
                  <select id="v4VfxItemSelect" class="select-control" onchange="updateV4VfxLivePreview()">
                    <!-- Populated dynamically via JS -->
                  </select>
                </div>

                <div class="setting-item">
                  <label for="v4VfxAttachmentSelect">Vị Trí Gắn (Attachment):</label>
                  <select id="v4VfxAttachmentSelect" class="select-control" onchange="updateV4VfxLivePreview()">
                    <option value="head" selected>Đầu nhân vật (Head)</option>
                    <option value="face">Khuôn mặt (Face)</option>
                    <option value="chest">Ngực nhân vật (Chest)</option>
                    <option value="left_hand">Bàn tay trái (Left Hand)</option>
                    <option value="right_hand">Bàn tay phải (Right Hand)</option>
                    <option value="body_center">Trọng tâm cơ thể (Body Center)</option>
                    <option value="feet">Bàn chân / Mặt đất (Feet / Ground)</option>
                    <option value="world">Tọa độ cảnh tự do (World Position)</option>
                    <option value="screen">Toàn màn hình (Screen Overlay)</option>
                  </select>
                </div>

                <div class="setting-item">
                  <label for="v4VfxLayerSelect">Phân Lớp Hiển Thị (Layer):</label>
                  <select id="v4VfxLayerSelect" class="select-control" onchange="updateV4VfxLivePreview()">
                    <option value="front_character" selected>Phía trước nhân vật (Front Character)</option>
                    <option value="behind_character">Phía sau nhân vật (Behind Character)</option>
                    <option value="background">Hậu cảnh bối cảnh (Background VFX)</option>
                    <option value="foreground">Tiền cảnh che mặt (Foreground VFX)</option>
                    <option value="screen_overlay">Lớp phủ màn hình (Screen Overlay)</option>
                  </select>
                </div>
              </div>

              <!-- Hàng thanh trượt tham số: Kích thước, Tốc độ, Cường độ, Hạt, Màu sắc -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 12px; background: #090d16; padding: 10px; border-radius: 6px;">
                <div class="setting-item">
                  <label for="v4VfxScale">Kích thước: <span id="v4VfxScaleVal" style="color: #38bdf8;">1.0x</span></label>
                  <input type="range" id="v4VfxScale" min="0.3" max="2.5" step="0.1" value="1.0" oninput="updateV4VfxLivePreview()" />
                </div>
                <div class="setting-item">
                  <label for="v4VfxSpeed">Tốc độ: <span id="v4VfxSpeedVal" style="color: #38bdf8;">1.0x</span></label>
                  <input type="range" id="v4VfxSpeed" min="0.2" max="3.0" step="0.1" value="1.0" oninput="updateV4VfxLivePreview()" />
                </div>
                <div class="setting-item">
                  <label for="v4VfxIntensity">Cường độ: <span id="v4VfxIntensityVal" style="color: #38bdf8;">1.0</span></label>
                  <input type="range" id="v4VfxIntensity" min="0.2" max="2.0" step="0.1" value="1.0" oninput="updateV4VfxLivePreview()" />
                </div>
                <div class="setting-item">
                  <label for="v4VfxParticleCount">Số lượng hạt: <span id="v4VfxParticleVal" style="color: #38bdf8;">25</span></label>
                  <input type="range" id="v4VfxParticleCount" min="5" max="80" step="5" value="25" oninput="updateV4VfxLivePreview()" />
                </div>
                <div class="setting-item">
                  <label for="v4VfxColor">Màu hiệu ứng:</label>
                  <input type="color" id="v4VfxColor" value="#fbbf24" style="height: 32px; padding: 2px; border-radius: 4px; cursor: pointer; background: transparent; width: 100%; border: 1px solid #334155;" oninput="updateV4VfxLivePreview()" />
                </div>
              </div>

              <!-- Hàng nút demo & áp dụng -->
              <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button class="btn btn-sm btn-outline" style="border-color: #fbbf24; color: #fbbf24;" onclick="runV4VfxInteractiveDemo('storm_aura')">
                    ⚡ Demo Giông Bão & Hào Quang Hoàng Kim
                  </button>
                  <button class="btn btn-sm btn-outline" style="border-color: #f43f5e; color: #f43f5e;" onclick="runV4VfxInteractiveDemo('fight_smoke')">
                    🥊 Demo Khói Đánh Nhau (Fight Brawl)
                  </button>
                  <button class="btn btn-sm btn-outline" style="border-color: #38bdf8; color: #38bdf8;" onclick="openSpriteSheetImportModal()">
                    🎞️ Import Sprite Sheet Ngoài
                  </button>
                </div>
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-sm btn-primary" onclick="applyVfxToCurrentShot()">
                    ➕ Thêm VFX vào Cảnh Hiện Tại
                  </button>
                </div>
              </div>
            </div>

            <!-- 1. Tùy chọn cấu hình xuất video & Engine -->`;

if (html.includes(panelEndTarget) && !html.includes("v4VfxWeatherPanel")) {
  html = html.replace(panelEndTarget, vfxPanelHtml);
  console.log("✔ Added v4VfxWeatherPanel to index.html");
}

// C. Add Sprite Sheet Modal before closing body
const modalTarget = `  <!-- Toast thông báo -->`;
const spriteSheetModalHtml = `  <!-- MODAL: Import Sprite Sheet / Sequence Ngoài (Phase 3) -->
  <div id="vfxSpriteSheetModal" class="modal-overlay hidden">
    <div class="modal-card" style="max-width: 600px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3 style="color: #c084fc;">🎞️ Import Animation Sprite Sheet / PNG Hiệu Ứng Ngoài</h3>
        <button class="modal-close-btn" onclick="closeSpriteSheetImportModal()">✕</button>
      </div>
      <div class="modal-body" style="display: flex; flex-direction: column; gap: 14px;">
        <div class="ai-dropzone" id="spriteSheetDropzone" style="min-height: 120px;" onclick="document.getElementById('spriteSheetFileInput').click()">
          <input type="file" id="spriteSheetFileInput" accept="image/png,image/svg+xml" class="hidden-file-input" onchange="handleSpriteSheetFileSelected(event)" />
          <div class="dropzone-content">
            <div class="dropzone-icon">🖼️</div>
            <div class="dropzone-title">Chọn tệp Sprite Sheet PNG trong suốt hoặc SVG an toàn</div>
            <div class="dropzone-sub">Hỗ trợ ảnh lưới sprite sheet nhiều khung hình hoặc ảnh PNG động</div>
          </div>
        </div>

        <!-- Cấu hình lưới Sprite Sheet -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; background: #0f172a; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
          <div class="setting-item">
            <label for="ssRows">Số hàng (Rows):</label>
            <input type="number" id="ssRows" class="text-input" value="1" min="1" max="32" oninput="updateSpriteSheetPreviewCalc()" />
          </div>
          <div class="setting-item">
            <label for="ssCols">Số cột (Cols):</label>
            <input type="number" id="ssCols" class="text-input" value="4" min="1" max="32" oninput="updateSpriteSheetPreviewCalc()" />
          </div>
          <div class="setting-item">
            <label for="ssFps">Tốc độ (FPS):</label>
            <input type="number" id="ssFps" class="text-input" value="12" min="1" max="60" oninput="updateSpriteSheetPreviewCalc()" />
          </div>
          <div class="setting-item">
            <label for="ssLoop">Lặp lại (Loop):</label>
            <select id="ssLoop" class="select-control">
              <option value="true" selected>Có lặp lại</option>
              <option value="false">Chỉ chạy 1 lần</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="setting-item">
            <label for="ssAssetName">Tên hiệu ứng:</label>
            <input type="text" id="ssAssetName" class="text-input" placeholder="Ví dụ: Hiệu ứng Cầu Lửa Ma Thuật" />
          </div>
          <div class="setting-item">
            <label for="ssAssetCategory">Nhóm hiệu ứng:</label>
            <select id="ssAssetCategory" class="select-control">
              <option value="action" selected>💥 Hành động (Action)</option>
              <option value="energy">⚡ Năng lượng (Energy)</option>
              <option value="emotion">🎭 Cảm xúc (Emotion)</option>
              <option value="scene">🎬 Bối cảnh (Scene)</option>
            </select>
          </div>
        </div>

        <!-- Canvas xem trước chuyển động Sprite Sheet -->
        <div style="display: flex; flex-direction: column; align-items: center; background: #090d16; padding: 12px; border-radius: 6px; border: 1px solid #334155;">
          <strong style="color: #cbd5e1; font-size: 12px; margin-bottom: 6px;">👀 Preview Chuyển Động Thực Tế Trước Khi Lưu:</strong>
          <canvas id="spriteSheetPreviewCanvas" width="160" height="160" style="background: #1e293b; border-radius: 6px; border: 1px dashed #64748b;"></canvas>
          <span id="spriteSheetFrameInfo" style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Kích thước khung hình: ...</span>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #334155; padding-top: 12px;">
          <button class="btn btn-secondary" onclick="closeSpriteSheetImportModal()">Hủy</button>
          <button id="btnSaveSpriteSheetAsset" class="btn btn-success" style="font-weight: 700;" onclick="saveCustomSpriteSheetAsset()" disabled>💾 Lưu Vào Thư Viện Tài Nguyên</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast thông báo -->`;

if (html.includes(modalTarget) && !html.includes("vfxSpriteSheetModal")) {
  html = html.replace(modalTarget, spriteSheetModalHtml);
  console.log("✔ Added vfxSpriteSheetModal to index.html");
}

fs.writeFileSync(indexHtmlPath, html, "utf-8");
console.log("✔ Saved index.html successfully!");

