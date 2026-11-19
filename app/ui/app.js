/**
 * Client Application Logic (app.js)
 * Giao tiếp với API Local Server, quản lý SSE, Audio Player và Drag-Drop Upload
 */

let appState = {
  lines: [],
  timelineData: null,
  scriptData: null,
  scenesData: null,
  requiredAssets: [],
  currentAudioPlayer: null,
  batchQueue: [],
  isBatchRunning: false,
  videosList: [],
  currentPlayingFilename: null
};

// ================= KHỞI TẠO ỨNG DỤNG =================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupDropZone();
  setupSse();
  loadVideosList();
});

async function initApp() {
  try {
    const res = await fetch("/api/init");
    const data = await res.json();
    if (!data.success) return;

    // 1. Cập nhật GPU Badge
    const gpu = data.gpuInfo;
    const gpuText = document.getElementById("gpuText");
    const gpuBadge = document.getElementById("gpuBadge");
    if (gpu.hasNvidia) {
      gpuText.textContent = `${gpu.gpuName} (${gpu.vramTotal}) - Driver ${gpu.driverVersion}`;
      gpuBadge.className = "badge badge-gpu";
    } else {
      gpuText.textContent = "Chế độ CPU đa luồng (Không có GPU rời)";
      gpuBadge.className = "badge btn-secondary";
    }

    // 2. Nạp dữ liệu script.json nếu có
    if (data.scriptData && data.scriptData.lines) {
      appState.scriptData = data.scriptData;
      appState.lines = data.scriptData.lines;
      renderLinesList();

      // Cài đặt voice
      if (data.scriptData.meta?.voice?.name) {
        document.getElementById("voiceSelect").value = data.scriptData.meta.voice.name;
      }
      if (data.scriptData.meta?.voice?.rate) {
        document.getElementById("rateSelect").value = data.scriptData.meta.voice.rate;
      }
    }

    // 3. Nạp dữ liệu timeline.json nếu có
    if (data.timelineData) {
      appState.timelineData = data.timelineData;
      renderTimelineResults(data.timelineData, data.scriptData);
    }

    // 4. Nạp dữ liệu scenes.json nếu có
    if (data.scenesData) {
      appState.scenesData = data.scenesData;
      document.getElementById("scenesJsonInput").value = JSON.stringify(data.scenesData, null, 2);
      renderAssetChecklist(data.requiredAssets || []);
    }

    // 5. Nạp danh sách video đã dựng
    loadVideosList();
  } catch (err) {
    console.error("Lỗi khởi tạo:", err);
  }
}

// Chuyển đổi giữa 2 Tab
function switchTab(tabNum) {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.remove("active"));

  const btn = document.getElementById(`tabBtn${tabNum}`);
  const pane = document.getElementById(`tabContent${tabNum}`);
  if (btn) btn.classList.add("active");
  if (pane) pane.classList.add("active");

  if (tabNum === 3) {
    loadAiProjectsList();
  }
}

// ================= TAB 1: GIỌNG ĐỌC & TIMELINE =================

// Tách kịch bản lời đọc
async function splitScriptText() {
  const rawText = document.getElementById("rawScriptInput").value;
  const splitMode = document.querySelector('input[name="splitMode"]:checked').value;
  const maxWords = parseInt(document.getElementById("maxWordsPerLine").value, 10) || 25;

  if (!rawText.trim()) {
    showToast("Vui lòng dán kịch bản vào ô văn bản!");
    return;
  }

  try {
    const res = await fetch("/api/voice/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, mode: splitMode, maxWords })
    });
    const data = await res.json();
    if (data.success) {
      appState.lines = data.lines;
      renderLinesList();
      showToast(`Đã tách thành ${data.lines.length} dòng lời đọc!`);
    }
  } catch (err) {
    showToast("Lỗi khi tách kịch bản: " + err.message);
  }
}

// Hiển thị danh sách các dòng cho phép chỉnh sửa
function renderLinesList() {
  const container = document.getElementById("linesPreviewContainer");
  const countLabel = document.getElementById("lineCountLabel");
  countLabel.textContent = appState.lines.length;

  if (appState.lines.length === 0) {
    container.innerHTML = `<div class="empty-state">Chưa có dòng lời đọc nào. Hãy dán kịch bản ở trên và bấm "Tách kịch bản".</div>`;
    return;
  }

  container.innerHTML = appState.lines
    .map(
      (line, index) => `
    <div class="line-item" data-index="${index}">
      <span class="line-id">${line.id}</span>
      <input type="text" class="line-text-input" value="${escapeHtml(line.narration)}" onchange="updateLineText(${index}, this.value)" />
      <div class="line-actions">
        ${index < appState.lines.length - 1 ? `<button class="btn btn-sm btn-outline" title="Gộp với dòng dưới" onclick="mergeLineWithNext(${index})">🔗</button>` : ""}
        <button class="btn btn-sm btn-outline" title="Xóa dòng này" onclick="deleteLine(${index})">🗑️</button>
      </div>
    </div>
  `
    )
    .join("");
}

function updateLineText(index, newText) {
  if (appState.lines[index]) {
    appState.lines[index].narration = newText.trim();
  }
}

function addNewLine() {
  const nextIdx = appState.lines.length + 1;
  appState.lines.push({
    id: `line_${String(nextIdx).padStart(3, "0")}`,
    narration: "Dòng lời đọc mới",
    pause: 0.35
  });
  renderLinesList();
}

function deleteLine(index) {
  appState.lines.splice(index, 1);
  // Đánh lại số thứ tự ID
  appState.lines.forEach((l, idx) => {
    l.id = `line_${String(idx + 1).padStart(3, "0")}`;
  });
  renderLinesList();
}

function mergeLineWithNext(index) {
  if (index >= appState.lines.length - 1) return;
  appState.lines[index].narration += " " + appState.lines[index + 1].narration;
  appState.lines.splice(index + 1, 1);
  appState.lines.forEach((l, idx) => {
    l.id = `line_${String(idx + 1).padStart(3, "0")}`;
  });
  renderLinesList();
}

// Bắt đầu tạo giọng đọc
async function startGenerateVoice() {
  if (appState.lines.length === 0) {
    showToast("Vui lòng nhập và tách dòng kịch bản trước!");
    return;
  }

  const voice = document.getElementById("voiceSelect").value;
  const rate = document.getElementById("rateSelect").value;
  const pause = parseFloat(document.getElementById("pauseInput").value) || 0.35;

  const btn = document.getElementById("btnGenerateVoice");
  const progressWrap = document.getElementById("voiceProgressWrap");
  const progressBar = document.getElementById("voiceProgressBar");
  const progressText = document.getElementById("voiceProgressText");

  btn.disabled = true;
  progressWrap.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = `Chuẩn bị tạo 0/${appState.lines.length}...`;

  try {
    const res = await fetch("/api/voice/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: appState.lines, voice, rate, pause })
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }

    appState.timelineData = data.timelineData;
    appState.scriptData = data.scriptData;

    renderTimelineResults(data.timelineData, data.scriptData);
    showToast("🎉 Đã tạo xong giọng đọc và timeline!");
  } catch (err) {
    showToast("❌ Lỗi tạo giọng đọc: " + err.message);
  } finally {
    btn.disabled = false;
    progressWrap.classList.add("hidden");
  }
}

// Hiển thị kết quả Timeline
function renderTimelineResults(timelineData, scriptData) {
  const section = document.getElementById("timelineResultSection");
  section.classList.remove("hidden");

  const totalSec = timelineData.totalSeconds || 0;
  document.getElementById("totalDurationText").textContent = `${totalSec.toFixed(2)}s (${(totalSec / 60).toFixed(1)} phút)`;
  document.getElementById("totalLinesText").textContent = timelineData.lines.length;

  const scriptMap = new Map((scriptData?.lines || []).map((l) => [l.id, l.narration]));

  // 1. Vẽ Timeline Visualizer Bar
  const visualBar = document.getElementById("timelineVisualizerBar");
  const colors = ["#0284c7", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#10b981", "#14b8a6"];

  visualBar.innerHTML = timelineData.lines
    .map((line, idx) => {
      const dur = line.end - line.start;
      const widthPct = ((dur / totalSec) * 100).toFixed(2);
      const color = colors[idx % colors.length];
      return `
      <div class="visual-block" style="width: ${widthPct}%; background-color: ${color};" title="${line.id}: ${line.start.toFixed(1)}s - ${line.end.toFixed(1)}s (${dur.toFixed(1)}s)">
        ${dur > 1 ? line.id.replace("line_", "") : ""}
      </div>
    `;
    })
    .join("");

  // 2. Điền Bảng dữ liệu
  const tbody = document.getElementById("timelineTableBody");
  tbody.innerHTML = timelineData.lines
    .map((line, idx) => {
      const narration = scriptMap.get(line.id) || "";
      const dur = line.end - line.start;
      const isLong = dur > 8;

      let suggestion = `<span class="hint">1 ảnh</span>`;
      if (isLong) {
        suggestion = `<span style="color: #f97316; font-weight: 600;">⚠️ Nên chia 2 ảnh (khoảng giữa ~${(line.start + dur / 2).toFixed(1)}s)</span>`;
      }

      return `
      <tr class="${isLong ? "highlight-orange" : ""}">
        <td>${idx + 1}</td>
        <td><code>${line.id}</code></td>
        <td><strong>${line.start.toFixed(2)}s</strong> - <strong>${line.end.toFixed(2)}s</strong></td>
        <td>${dur.toFixed(2)}s</td>
        <td>${escapeHtml(narration)}</td>
        <td>
          <button class="audio-btn" onclick="playAudio('/public/${line.audio}')">▶️ Nghe</button>
        </td>
        <td>${suggestion}</td>
      </tr>
    `;
    })
    .join("");
}

// Nghe thử âm thanh
function playAudio(audioUrl) {
  if (appState.currentAudioPlayer) {
    appState.currentAudioPlayer.pause();
  }
  const audio = new Audio(audioUrl + "?t=" + Date.now());
  appState.currentAudioPlayer = audio;
  audio.play();
}

// Sao chép Markdown timeline cho AI
async function copyTimelineForAi() {
  try {
    const res = await fetch("/out/timeline_for_ai.md?t=" + Date.now());
    const md = await res.text();
    await navigator.clipboard.writeText(md);
    showToast("📋 Đã sao chép bảng Timeline Markdown vào Clipboard! Giờ bạn có thể dán cho AI.");
  } catch (err) {
    showToast("Lỗi khi sao chép: " + err.message);
  }
}

// ================= TAB 2: DỰNG VIDEO =================

// Nạp scenes.json mẫu
function loadSampleScenes() {
  const sample = {
    scenes: [
      {
        id: "scene_001",
        start: 0,
        end: 4.72,
        line: "line_001",
        bg: "backgrounds/scene_001.png",
        camera: { zoom: [1, 1.08], pan: [0, 0] },
        character: {
          image: "characters/ngac-nhien.png",
          enterAt: 0.5,
          x: 0.45,
          baseY: 0.82,
          height: 0.55,
          bob: true,
          flip: false
        },
        foreground: { image: "foregrounds/blanket.png", x: 0.5, baseY: 0.85, height: 0.25 }
      },
      {
        id: "scene_002",
        start: 4.72,
        end: 9.27,
        line: "line_002",
        bg: "backgrounds/scene_001.png",
        camera: { zoom: [1.05, 1.15], pan: [0.03, -0.02] },
        character: null,
        foreground: null
      },
      {
        id: "scene_003",
        start: 9.27,
        end: 13.83,
        line: "line_002",
        bg: "backgrounds/scene_001.png",
        camera: { zoom: [1.1, 1.0], pan: [-0.02, 0] },
        character: {
          image: "characters/ngac-nhien.png",
          enterAt: 0.2,
          x: 0.6,
          baseY: 0.8,
          height: 0.5,
          bob: true,
          flip: true
        },
        foreground: null
      }
    ]
  };

  document.getElementById("scenesJsonInput").value = JSON.stringify(sample, null, 2);
  validateScenesData();
}

// Kiểm tra scenes.json
async function validateScenesData() {
  const scenesText = document.getElementById("scenesJsonInput").value;
  const resultBox = document.getElementById("validationResultBox");

  if (!scenesText.trim()) {
    showToast("Vui lòng dán nội dung scenes.json!");
    return;
  }

  try {
    const res = await fetch("/api/scenes/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenesText })
    });
    const data = await res.json();

    resultBox.classList.remove("hidden");

    if (data.syntaxError) {
      resultBox.className = "validation-box val-error";
      resultBox.innerHTML = `<strong>❌ Lỗi Cú Pháp JSON:</strong><br>${escapeHtml(data.syntaxError)}`;
      return;
    }

    if (!data.valid) {
      resultBox.className = "validation-box val-error";
      resultBox.innerHTML = `
        <strong>❌ Phát hiện ${data.errors.length} lỗi cần sửa:</strong>
        <ul style="margin: 6px 0 0 20px;">
          ${data.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}
        </ul>
      `;
    } else {
      let warningHtml = "";
      if (data.warnings && data.warnings.length > 0) {
        warningHtml = `
          <div style="margin-top: 8px; color: #fed7aa;">
            <strong>⚠️ Cảnh báo:</strong>
            <ul style="margin: 4px 0 0 20px;">
              ${data.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}
            </ul>
          </div>
        `;
      }
      resultBox.className = "validation-box val-success";
      resultBox.innerHTML = `
        <strong>✅ Dữ liệu cảnh scenes.json hoàn toàn hợp lệ!</strong>
        <div style="margin-top: 4px;">Tổng số cảnh: <strong>${data.scenesData.scenes.length} cảnh</strong>, khớp hoàn hảo với timeline.</div>
        ${warningHtml}
      `;
    }

    if (data.scenesData) {
      appState.scenesData = data.scenesData;
    }

    renderAssetChecklist(data.requiredAssets || []);
  } catch (err) {
    console.error("Lỗi kiểm tra dữ liệu:", err);
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError"))) {
      showToast("❌ Không thể kết nối tới máy chủ Local! Vui lòng đảm bảo cửa sổ start.bat đang mở.");
    } else {
      showToast("Lỗi kiểm tra dữ liệu: " + err.message);
    }
  }
}

// Quản lý trạng thái sửa/thay ảnh cho từng vị trí
let activeSlotEdit = {
  sceneIndex: null,
  role: null // 'bg' | 'character'
};

// Mở hộp thoại chọn file cho từng slot cảnh cụ thể
function openSlotPicker(sceneIndex, role) {
  activeSlotEdit = { sceneIndex, role };
  const input = document.getElementById("slotFilePicker");
  if (input) {
    input.value = "";
    input.click();
  }
}

// Đọc file ảnh từ máy và tự động tối ưu hóa kích thước (Full HD, nén nhẹ để Base64 siêu nhanh, siêu nhẹ)
function readFileAsOptimizedDataUrl(file) {
  return new Promise((resolve) => {
    if (!file.type || !file.type.startsWith("image/") || file.type.includes("svg")) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
      const mimeType = isPng ? "image/png" : "image/jpeg";
      const quality = isPng ? undefined : 0.88;

      resolve(canvas.toDataURL(mimeType, quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    };

    img.src = url;
  });
}

// Mở thư mục trên máy tính
async function openFolder(type) {
  try {
    const res = await fetch("/api/open-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`📁 Đã mở thư mục: ${type}`);
    }
  } catch (err) {
    showToast("Không thể mở thư mục: " + err.message);
  }
}

// Xử lý khi người dùng chọn file ảnh từ máy (Tải lên server và lưu vào folder public/)
async function handleSlotFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const { sceneIndex, role } = activeSlotEdit;
  if (sceneIndex === null) {
    showToast("Không xác định được cảnh cần cập nhật ảnh!");
    return;
  }

  ensureScenesDataInitialized();
  if (!appState.scenesData.scenes[sceneIndex]) {
    showToast(`Không tìm thấy cảnh số ${sceneIndex + 1}!`);
    return;
  }

  try {
    showToast("⏳ Đang tải và lưu ảnh vào thư mục...");
    const dataUrl = await readFileAsOptimizedDataUrl(file);
    if (!dataUrl) {
      showToast("❌ Không thể đọc file ảnh này!");
      return;
    }

    const uploadType = role === "character" ? "character" : "background";
    const uploadRes = await fetch("/api/assets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        base64Data: dataUrl,
        type: uploadType,
        overwrite: true
      })
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) {
      throw new Error(uploadData.error || "Không thể lưu ảnh vào máy tính");
    }

    const savedPath = uploadData.path; // Ví dụ: "backgrounds/anh_nen_1234.jpg"
    const targetScene = appState.scenesData.scenes[sceneIndex];

    if (role === "bg") {
      targetScene.bg = savedPath;
      showToast(`✅ Đã lưu vào public/${savedPath} và gán vào Cảnh ${sceneIndex + 1}`);
    } else if (role === "character") {
      if (!targetScene.character) {
        targetScene.character = {
          image: savedPath,
          position: "right",
          scale: 0.8,
          flip: false
        };
      } else {
        targetScene.character.image = savedPath;
      }
      showToast(`✅ Đã lưu vào public/${savedPath} và gán vào Cảnh ${sceneIndex + 1}`);
    }

    syncScenesToInputAndValidate();
  } catch (err) {
    showToast("Lỗi khi tải ảnh: " + err.message);
  }
}

// Xóa ảnh khỏi slot cảnh (ảnh nền hoặc nhân vật)
function deleteSlotAsset(sceneIndex, role) {
  ensureScenesDataInitialized();
  if (!appState.scenesData || !appState.scenesData.scenes || !appState.scenesData.scenes[sceneIndex]) {
    return;
  }

  const targetScene = appState.scenesData.scenes[sceneIndex];
  if (role === "bg") {
    targetScene.bg = null;
    showToast(`🗑️ Đã xóa ảnh nền Cảnh ${sceneIndex + 1}`);
  } else if (role === "character") {
    targetScene.character = null;
    showToast(`🗑️ Đã xóa nhân vật Cảnh ${sceneIndex + 1}`);
  }

  syncScenesToInputAndValidate();
}

// Nút nhanh thêm ảnh nền hoặc nhân vật cho cảnh đầu tiên còn thiếu
function triggerQuickUpload(role) {
  ensureScenesDataInitialized();
  let targetIndex = 0;
  const scenes = appState.scenesData.scenes;
  for (let i = 0; i < scenes.length; i++) {
    if (role === "bg" && !scenes[i].bg) {
      targetIndex = i;
      break;
    }
    if (role === "character" && (!scenes[i].character || !scenes[i].character.image)) {
      targetIndex = i;
      break;
    }
  }
  openSlotPicker(targetIndex, role);
}

// Đảm bảo đối tượng appState.scenesData luôn hợp lệ và khớp với Timeline
function ensureScenesDataInitialized() {
  if (!appState.scenesData || !Array.isArray(appState.scenesData.scenes) || appState.scenesData.scenes.length === 0) {
    const raw = document.getElementById("scenesJsonInput").value.trim();
    if (raw) {
      try {
        appState.scenesData = JSON.parse(raw);
      } catch (e) {}
    }

    if (!appState.scenesData || !Array.isArray(appState.scenesData.scenes) || appState.scenesData.scenes.length === 0) {
      // Nếu đã có timeline từ Tab 1, tự động sinh số cảnh khớp 100% với từng dòng
      if (appState.timelineData && Array.isArray(appState.timelineData.lines) && appState.timelineData.lines.length > 0) {
        appState.scenesData = {
          scenes: appState.timelineData.lines.map((l, idx) => ({
            id: `scene_${String(idx + 1).padStart(3, "0")}`,
            line: l.id,
            bg: null,
            character: null
          }))
        };
      } else {
        appState.scenesData = {
          scenes: [
            {
              id: "scene_001",
              line: "line_001",
              bg: null,
              character: null
            }
          ]
        };
      }
    }
  }
}

// Đồng bộ đối tượng scenesData ra textarea và gọi validate
function syncScenesToInputAndValidate() {
  document.getElementById("scenesJsonInput").value = JSON.stringify(appState.scenesData, null, 2);
  validateScenesData();
}

// Thiết lập Drag and Drop lưu trực tiếp vào folder máy tính
function setupDropZone() {
  const dropZone = document.getElementById("dropZone");
  if (!dropZone) return;

  ["dragenter", "dragover"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((evt) => {
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", async (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    ensureScenesDataInitialized();
    const scenes = appState.scenesData.scenes;

    for (const file of files) {
      const isChar = /char|nhanvat|nhân vật|stick|ngac|vui|buon/i.test(file.name);
      const role = isChar ? "character" : "bg";
      const uploadType = isChar ? "character" : "background";

      let targetIndex = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (role === "bg" && !scenes[i].bg) {
          targetIndex = i;
          break;
        }
        if (role === "character" && (!scenes[i].character || !scenes[i].character.image)) {
          targetIndex = i;
          break;
        }
      }

      try {
        const dataUrl = await readFileAsOptimizedDataUrl(file);
        if (!dataUrl) continue;

        const uploadRes = await fetch("/api/assets/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            base64Data: dataUrl,
            type: uploadType,
            overwrite: true
          })
        });
        const uploadData = await uploadRes.json();
        if (!uploadData.success) continue;

        const savedPath = uploadData.path;
        if (role === "bg") {
          scenes[targetIndex].bg = savedPath;
        } else {
          if (!scenes[targetIndex].character) {
            scenes[targetIndex].character = { image: savedPath, position: "right", scale: 0.8, flip: false };
          } else {
            scenes[targetIndex].character.image = savedPath;
          }
        }
        showToast(`✅ Đã lưu ${isChar ? "nhân vật" : "ảnh nền"} vào public/${savedPath}`);
      } catch (err) {
        showToast("Lỗi tải ảnh: " + err.message);
      }
    }

    syncScenesToInputAndValidate();
  });
}

// Mở modal xem ảnh phóng to sắc nét
function viewLargeImage(src) {
  const existing = document.getElementById("imageModalOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "imageModalOverlay";
  overlay.className = "image-modal-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay || e.target.classList.contains("image-modal-close")) {
      overlay.remove();
    }
  };

  overlay.innerHTML = `
    <div class="image-modal-content">
      <button class="image-modal-close" title="Đóng">✕</button>
      <img src="${src}" alt="Xem ảnh phóng to" />
    </div>
  `;
  document.body.appendChild(overlay);
}

// Hiển thị danh sách kiểm tra & quản lý ảnh trực quan theo từng cảnh
function renderAssetChecklist(assets) {
  const container = document.getElementById("assetChecklist");
  if (!container) return;

  const scenes = appState.scenesData?.scenes;
  if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
    container.innerHTML = `<div class="empty-state">Chưa có dữ liệu cảnh. Hãy dán <code>scenes.json</code> hoặc bấm "Dán mẫu kịch bản" rồi bấm "Kiểm tra dữ liệu".</div>`;
    return;
  }

  container.innerHTML = scenes
    .map((scene, idx) => {
      const sceneNum = idx + 1;
      const sceneId = scene.id || `scene_${String(sceneNum).padStart(3, "0")}`;

      // 1. Slot Ảnh nền
      const hasBg = Boolean(scene.bg);
      const isBgBase64 = hasBg && scene.bg.startsWith("data:");
      const bgSrc = hasBg ? (isBgBase64 ? scene.bg : `/public/${scene.bg}?t=${Date.now()}`) : null;
      const bgLabel = hasBg
        ? (isBgBase64 ? "⚡ RAM (Base64)" : `📁 public/${scene.bg}`)
        : "Chưa chọn ảnh nền";

      const bgHtml = hasBg
        ? `
        <div class="slot-box">
          <img src="${bgSrc}" class="slot-thumb" title="Click để phóng to ảnh nền" onclick="viewLargeImage('${bgSrc}')" alt="Nền cảnh ${sceneNum}" />
          <div class="slot-info">
            <span class="slot-role">🖼️ Ảnh Nền</span>
            <span class="slot-status" title="${escapeHtml(bgLabel)}">${escapeHtml(bgLabel)}</span>
          </div>
          <div class="slot-actions">
            <button class="btn-slot-edit" onclick="openSlotPicker(${idx}, 'bg')" title="Chọn ảnh khác thay thế">✏️ Đổi</button>
            <button class="btn-slot-delete" onclick="deleteSlotAsset(${idx}, 'bg')" title="Xóa ảnh nền khỏi cảnh này">🗑️ Xóa</button>
          </div>
        </div>
      `
        : `
        <div class="slot-box empty">
          <div class="slot-thumb-empty">🖼️<br>Trống</div>
          <div class="slot-info">
            <span class="slot-role">🖼️ Ảnh Nền</span>
            <span class="slot-status missing">Chưa có ảnh</span>
          </div>
          <div class="slot-actions">
            <button class="btn-slot-add" onclick="openSlotPicker(${idx}, 'bg')" title="Chọn ảnh nền từ máy">➕ Chọn</button>
          </div>
        </div>
      `;

      // 2. Slot Nhân vật
      const hasChar = Boolean(scene.character && scene.character.image);
      const isCharBase64 = hasChar && scene.character.image.startsWith("data:");
      const charSrc = hasChar ? (isCharBase64 ? scene.character.image : `/public/${scene.character.image}?t=${Date.now()}`) : null;
      const charPos = scene.character?.position ? `(${scene.character.position})` : "";
      const charLabel = hasChar
        ? (isCharBase64 ? `⚡ RAM ${charPos}` : `📁 public/${scene.character.image} ${charPos}`)
        : "Không có nhân vật";

      const charHtml = hasChar
        ? `
        <div class="slot-box">
          <img src="${charSrc}" class="slot-thumb" style="background-color: #334155;" title="Click để phóng to nhân vật" onclick="viewLargeImage('${charSrc}')" alt="Nhân vật cảnh ${sceneNum}" />
          <div class="slot-info">
            <span class="slot-role">👤 Nhân Vật</span>
            <span class="slot-status" title="${escapeHtml(charLabel)}">${escapeHtml(charLabel)}</span>
          </div>
          <div class="slot-actions">
            <button class="btn-slot-edit" onclick="openSlotPicker(${idx}, 'character')" title="Chọn ảnh nhân vật khác thay thế">✏️ Đổi</button>
            <button class="btn-slot-delete" onclick="deleteSlotAsset(${idx}, 'character')" title="Xóa nhân vật khỏi cảnh này">🗑️ Xóa</button>
          </div>
        </div>
      `
        : `
        <div class="slot-box empty">
          <div class="slot-thumb-empty">👤<br>Trống</div>
          <div class="slot-info">
            <span class="slot-role">👤 Nhân Vật</span>
            <span class="slot-status" style="color: #64748b;">(Tùy chọn)</span>
          </div>
          <div class="slot-actions">
            <button class="btn-slot-add" onclick="openSlotPicker(${idx}, 'character')" title="Thêm nhân vật cho cảnh này">➕ Thêm</button>
          </div>
        </div>
      `;

      return `
      <div class="scene-card-manager">
        <div class="scene-card-header">
          <span class="scene-title">🎬 Cảnh ${sceneNum}: <code>${escapeHtml(sceneId)}</code></span>
          <span class="hint-small" style="color: #94a3b8;">${scene.line ? 'Khớp: ' + escapeHtml(scene.line) : ''}</span>
        </div>
        <div class="scene-slots">
          ${bgHtml}
          ${charHtml}
        </div>
      </div>
    `;
    })
    .join("");
}

// ================= RENDER ENGINE =================

// Đo tốc độ GPU Benchmark
async function runGpuBenchmark() {
  const benchBox = document.getElementById("benchResultBox");
  benchBox.classList.remove("hidden");
  benchBox.innerHTML = `<span>⏳ Đang đo thử tốc độ 5 giây video với từng cấu hình (CPU vs NVENC vs ANGLE)... Vui lòng đợi trong giây lát!</span>`;

  try {
    const res = await fetch("/api/render/bench", { method: "POST" });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }

    const rows = data.results
      .map(
        (r) => `
      <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #1e293b;">
        <span>${r.name}:</span>
        <strong style="color: ${r.success ? "#34d399" : "#f87171"}">${r.success ? `${r.seconds}s` : "Thất bại"}</strong>
      </div>
    `
      )
      .join("");

    benchBox.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 8px; color: #38bdf8;">📊 KẾT QUẢ ĐO TỐC ĐỘ 5s (BENCHMARK):</div>
      ${rows}
      ${
        data.bestMode
          ? `<div style="margin-top: 10px; color: #fbbf24; font-weight: 600;">💡 Gợi ý: Cấu hình nhanh nhất là "${data.bestMode.name}" (${data.bestMode.seconds}s). Hãy chọn cấu hình này ở trên!</div>`
          : ""
      }
    `;
  } catch (err) {
    benchBox.innerHTML = `<span style="color: #f87171;">Lỗi đo tốc độ: ${escapeHtml(err.message)}</span>`;
  }
}

// 1. Dựng riêng 1 cảnh thành 1 video độc lập để xem thử (Nút Xem thử)
async function startRenderScene(sceneIndex = 0, isTest = true) {
  ensureScenesDataInitialized();
  const scenes = appState.scenesData?.scenes || [];
  if (scenes.length === 0) {
    showToast("Chưa có dữ liệu cảnh nào để dựng thử!");
    return;
  }

  const gpuMode = document.getElementById("gpuModeSelect").value;
  const concurrency = parseInt(document.getElementById("concurrencyInput").value, 10) || 4;

  const btnTest = document.getElementById("btnRenderTest");
  const btnFull = document.getElementById("btnRenderFull");
  const btnCancel = document.getElementById("btnCancelRender");
  const progressWrap = document.getElementById("renderProgressWrap");

  btnTest.disabled = true;
  btnFull.disabled = true;
  btnCancel.classList.remove("hidden");
  progressWrap.classList.remove("hidden");

  document.getElementById("renderProgressBar").style.width = "0%";
  document.getElementById("renderPercentText").textContent = "0%";
  document.getElementById("renderFramesText").textContent = "0 khung hình";
  document.getElementById("renderStatusText").textContent = `Đang dựng thử 1 video (Cảnh ${sceneIndex + 1})...`;

  try {
    const res = await fetch("/api/render/scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneIndex, isTest, accelerationMode: gpuMode, concurrency })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    showToast(`▶️ Đang bắt đầu dựng thử 1 video cho Cảnh ${sceneIndex + 1}...`);
  } catch (err) {
    showToast("❌ Lỗi khi dựng thử: " + err.message);
    btnTest.disabled = false;
    btnFull.disabled = false;
    btnCancel.classList.add("hidden");
    progressWrap.classList.add("hidden");
  }
}

// 2. Bắt đầu sinh HẾT tất cả video dựa theo kịch bản JSON (Có bao nhiêu cảnh sinh hết bấy nhiêu video)
let isBatchGeneratingAll = false;

async function startRenderAllScenes() {
  ensureScenesDataInitialized();
  const scenes = appState.scenesData?.scenes || [];
  if (scenes.length === 0) {
    showToast("Chưa có cảnh nào trong kịch bản JSON!");
    return;
  }

  if (isBatchGeneratingAll) {
    showToast("Đang trong quá trình sinh video hàng loạt!");
    return;
  }

  const total = scenes.length;
  if (!confirm(`Bạn có muốn bắt đầu sinh TOÀN BỘ ${total} video dựa theo ${total} cảnh trong JSON không?`)) {
    return;
  }

  isBatchGeneratingAll = true;
  const gpuMode = document.getElementById("gpuModeSelect").value;
  const concurrency = parseInt(document.getElementById("concurrencyInput").value, 10) || 4;

  const btnTest = document.getElementById("btnRenderTest");
  const btnFull = document.getElementById("btnRenderFull");
  const btnCancel = document.getElementById("btnCancelRender");
  const progressWrap = document.getElementById("renderProgressWrap");

  btnTest.disabled = true;
  btnFull.disabled = true;
  btnCancel.classList.remove("hidden");
  progressWrap.classList.remove("hidden");

  showToast(`🚀 Bắt đầu sinh ${total} video hàng loạt theo JSON...`);

  for (let i = 0; i < total; i++) {
    if (!isBatchGeneratingAll) {
      showToast("⏹️ Quá trình sinh hàng loạt đã bị hủy.");
      break;
    }

    const scene = scenes[i];
    const sceneId = scene.id || `scene_${String(i + 1).padStart(3, "0")}`;

    document.getElementById("renderProgressBar").style.width = "0%";
    document.getElementById("renderPercentText").textContent = "0%";
    document.getElementById("renderStatusText").textContent = `[${i + 1}/${total}] Đang dựng video: ${sceneId}...`;

    try {
      const res = await fetch("/api/render/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneIndex: i,
          isTest: false,
          accelerationMode: gpuMode,
          concurrency
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Chờ video này render xong qua Promise SSE
      await waitForRenderComplete();
      loadVideosList();
    } catch (err) {
      console.error(err);
      showToast(`❌ Lỗi tại video cảnh ${i + 1}: ${err.message}`);
    }
  }

  isBatchGeneratingAll = false;
  btnTest.disabled = false;
  btnFull.disabled = false;
  btnCancel.classList.add("hidden");
  progressWrap.classList.add("hidden");
  loadVideosList();
  showToast(`🎉 Đã hoàn thành sinh tất cả ${total} video theo kịch bản JSON!`);
}

// 3. Dựng 1 file video gộp toàn bộ tất cả các cảnh (Full Video)
async function startRender(isTest = false) {
  const gpuMode = document.getElementById("gpuModeSelect").value;
  const concurrency = parseInt(document.getElementById("concurrencyInput").value, 10) || 4;
  const videoNameInput = document.getElementById("videoNameInput");
  const videoName = videoNameInput ? videoNameInput.value.trim() : "";

  const btnTest = document.getElementById("btnRenderTest");
  const btnFull = document.getElementById("btnRenderFull");
  const btnCancel = document.getElementById("btnCancelRender");
  const progressWrap = document.getElementById("renderProgressWrap");

  btnTest.disabled = true;
  btnFull.disabled = true;
  btnCancel.classList.remove("hidden");
  progressWrap.classList.remove("hidden");

  document.getElementById("renderProgressBar").style.width = "0%";
  document.getElementById("renderPercentText").textContent = "0%";
  document.getElementById("renderFramesText").textContent = "0 khung hình";
  document.getElementById("renderStatusText").textContent = `Đang dựng video gộp hoàn chỉnh...`;

  try {
    const res = await fetch("/api/render/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTest, accelerationMode: gpuMode, concurrency, videoName })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
  } catch (err) {
    showToast("❌ Không thể bắt đầu dựng: " + err.message);
    btnTest.disabled = false;
    btnFull.disabled = false;
    btnCancel.classList.add("hidden");
    progressWrap.classList.add("hidden");
  }
}

// Hủy Render
async function cancelRender() {
  isBatchGeneratingAll = false;
  try {
    await fetch("/api/render/cancel", { method: "POST" });
    showToast("Đã gửi yêu cầu dừng.");
  } catch (err) {}
}

// Mở thư mục out/
async function openOutputFolder() {
  try {
    await fetch("/api/open-folder", { method: "POST" });
  } catch (err) {
    showToast("Lỗi mở thư mục: " + err.message);
  }
}

// ================= THƯ VIỆN & DANH SÁCH VIDEO =================

// Tải danh sách toàn bộ video đã tạo từ server
async function loadVideosList() {
  const container = document.getElementById("videosListContainer");
  const countLabel = document.getElementById("totalVideosCount");
  if (!container) return;

  try {
    const res = await fetch("/api/videos");
    const rawText = await res.text();

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      // Nếu server trả về HTML (<!DOCTYPE) do chưa khởi động lại start.bat hoặc chưa nạp API mới
      container.innerHTML = `
        <div class="empty-state" style="color: #fbbf24; line-height: 1.8; text-align: left; padding: 15px; background: rgba(245, 158, 11, 0.1); border: 1px dashed #f59e0b; border-radius: 8px;">
          <div style="font-size: 14px; font-weight: bold; color: #f59e0b; margin-bottom: 8px;">
            ⚠️ Máy chủ Node.js chưa nạp API danh sách video mới!
          </div>
          <div style="color: #e2e8f0; font-size: 13px;">
            Trình duyệt nhận phản hồi dạng HTML thay vì dữ liệu JSON do tiến trình máy chủ cũ trong CMD chưa được tắt và khởi động lại.<br/>
            <strong>Cách khắc phục cực kỳ đơn giản:</strong>
            <ol style="margin: 8px 0 10px 20px; padding: 0;">
              <li>Đóng cửa sổ CMD (terminal) đang chạy máy chủ cũ.</li>
              <li>Chạy lại file <code style="background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px;">start.bat</code> để nạp bản code mới.</li>
              <li>Quay lại trình duyệt nhấn <strong style="color: #38bdf8;">Ctrl + F5</strong> (hoặc bấm nút dưới đây).</li>
            </ol>
          </div>
          <button class="btn btn-sm btn-outline" onclick="loadVideosList()" style="margin-top: 5px; color: #38bdf8; border-color: #38bdf8;">
            🔄 Thử kết nối lại ngay
          </button>
        </div>
      `;
      return;
    }

    if (!data.success) {
      container.innerHTML = `<div class="empty-state" style="color: #f87171;">Lỗi từ máy chủ: ${escapeHtml(data.error || "Không rõ nguyên nhân")}</div>`;
      return;
    }

    appState.videosList = data.videos || [];
    if (countLabel) countLabel.textContent = `${appState.videosList.length} video`;

    if (appState.videosList.length === 0) {
      container.innerHTML = `<div class="empty-state">Chưa có video nào trong thư mục out/. Hãy bấm "Dựng thử 1 video" hoặc "Dựng tất cả video"!</div>`;
      return;
    }

    container.innerHTML = appState.videosList
      .map((v) => {
        const isActive = appState.currentPlayingFilename === v.filename ? "active" : "";
        return `
        <div class="video-item-card ${isActive}" id="videoCard_${escapeHtml(v.filename)}">
          <div class="video-card-left">
            <span class="video-card-icon">🎬</span>
            <div class="video-card-info">
              <span class="video-card-name" title="${escapeHtml(v.filename)}">${escapeHtml(v.filename)}</span>
              <div class="video-card-meta">
                <span>📦 ${v.sizeMb} MB</span>
                <span>🕒 ${v.formattedTime}</span>
              </div>
            </div>
          </div>
          <div class="video-card-actions">
            <button class="btn-card-action btn-act-play" onclick="playVideo('${v.url}', '${escapeHtml(v.filename)}')" title="Xem video này">▶️ Xem</button>
            <button class="btn-card-action btn-act-regen" onclick="regenerateVideo('${escapeHtml(v.filename)}')" title="Dựng lại video này với thông số ban đầu">🔄 Gen lại</button>
            <a href="${v.url}" download="${escapeHtml(v.filename)}" class="btn-card-action btn-act-download" title="Tải file video về máy">⬇️ Tải</a>
            <button class="btn-card-action btn-act-delete" onclick="deleteVideo('${escapeHtml(v.filename)}')" title="Xóa video khỏi danh sách">🗑️ Xóa</button>
          </div>
        </div>
      `;
      })
      .join("");

    if (!appState.currentPlayingFilename && appState.videosList.length > 0) {
      playVideo(appState.videosList[0].url, appState.videosList[0].filename, false);
    }

    // Nếu đang đứng ở Tab 3 và đã chọn dự án, cập nhật kiểm tra video xem trước
    if (typeof aiState !== "undefined" && aiState.selectedProjectId) {
      loadPreviewForCurrentProject();
    }
  } catch (err) {
    const isDocType = err.message && (err.message.includes("Unexpected token '<'") || err.message.includes("<!DOCTYPE") || err.message.includes("is not valid JSON"));
    if (isDocType) {
      container.innerHTML = `
        <div class="empty-state" style="color: #fbbf24; line-height: 1.8; text-align: left; padding: 15px; background: rgba(245, 158, 11, 0.1); border: 1px dashed #f59e0b; border-radius: 8px;">
          <div style="font-size: 14px; font-weight: bold; color: #f59e0b; margin-bottom: 8px;">
            ⚠️ Máy chủ chưa được khởi động lại để nhận bản cập nhật mới!
          </div>
          <div style="color: #e2e8f0; font-size: 13px;">
            Trình duyệt nhận phản hồi dạng HTML thay vì dữ liệu JSON.<br/>
            <strong>Cách khắc phục:</strong>
            <ol style="margin: 8px 0 10px 20px; padding: 0;">
              <li>Tắt (Đóng) cửa sổ CMD đang chạy máy chủ cũ.</li>
              <li>Chạy lại file <code style="background: #1e293b; color: #38bdf8; padding: 2px 6px; border-radius: 4px;">start.bat</code>.</li>
              <li>Tải lại trang web (nhấn <strong style="color: #38bdf8;">Ctrl + F5</strong>).</li>
            </ol>
          </div>
          <button class="btn btn-sm btn-outline" onclick="loadVideosList()" style="margin-top: 5px; color: #38bdf8; border-color: #38bdf8;">
            🔄 Thử kết nối lại ngay
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state" style="color: #f87171;">
          Lỗi tải danh sách video: ${escapeHtml(err.message)}
          <br/><button class="btn btn-sm btn-outline" onclick="loadVideosList()" style="margin-top: 10px; color: #38bdf8; border-color: #38bdf8;">🔄 Thử lại</button>
        </div>
      `;
    }
  }
}

// Chọn và phát video trên player chính
function playVideo(url, filename, autoPlay = true) {
  appState.currentPlayingFilename = filename;
  const player = document.getElementById("outputVideoPlayer");
  const title = document.getElementById("nowPlayingTitle");
  const pathHint = document.getElementById("outputVideoPath");
  const btnDownload = document.getElementById("btnDownloadCurrent");

  if (title) title.textContent = `▶️ Đang phát: ${filename}`;
  if (pathHint) pathHint.textContent = `out/${filename}`;
  if (btnDownload) {
    btnDownload.href = url;
    btnDownload.download = filename;
    btnDownload.classList.remove("hidden");
  }

  if (player) {
    player.src = url;
    player.load();
    if (autoPlay) {
      player.play().catch(() => {});
    }
  }

  document.querySelectorAll(".video-item-card").forEach((c) => c.classList.remove("active"));
  const activeCard = document.getElementById(`videoCard_${filename}`);
  if (activeCard) {
    activeCard.classList.add("active");
  }
}

// Xóa video khỏi máy tính
async function deleteVideo(filename) {
  if (!confirm(`Bạn có chắc chắn muốn xóa video "${filename}"?`)) {
    return;
  }

  try {
    const res = await fetch("/api/videos/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🗑️ Đã xóa video ${filename}`);
      if (appState.currentPlayingFilename === filename) {
        appState.currentPlayingFilename = null;
        const player = document.getElementById("outputVideoPlayer");
        if (player) {
          player.pause();
          player.src = "";
        }
        document.getElementById("nowPlayingTitle").textContent = "▶️ Chưa chọn video để phát";
        document.getElementById("btnDownloadCurrent").classList.add("hidden");
      }
      loadVideosList();
    } else {
      showToast("❌ Không thể xóa video: " + data.error);
    }
  } catch (err) {
    showToast("Lỗi khi xóa: " + err.message);
  }
}

// Gen lại (Dựng lại) video đã có dựa trên snapshot metadata
async function regenerateVideo(filename) {
  if (!confirm(`Bạn có muốn dựng lại (Gen lại) video "${filename}" không?`)) {
    return;
  }

  const gpuMode = document.getElementById("gpuModeSelect").value;
  const concurrency = parseInt(document.getElementById("concurrencyInput").value, 10) || 4;

  const btnCancel = document.getElementById("btnCancelRender");
  const progressWrap = document.getElementById("renderProgressWrap");

  btnCancel.classList.remove("hidden");
  progressWrap.classList.remove("hidden");
  document.getElementById("renderProgressBar").style.width = "0%";
  document.getElementById("renderPercentText").textContent = "0%";
  document.getElementById("renderFramesText").textContent = "0 khung hình";
  document.getElementById("renderStatusText").textContent = `Đang gen lại: ${filename}...`;

  try {
    const res = await fetch("/api/videos/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, accelerationMode: gpuMode, concurrency })
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error);
    }
    showToast(`🔄 Đang tiến hành dựng lại video "${filename}"...`);
  } catch (err) {
    showToast("❌ Không thể gen lại video: " + err.message);
    progressWrap.classList.add("hidden");
    btnCancel.classList.add("hidden");
  }
}

// ================= HÀNG ĐỢI DỰNG VIDEO HÀNG LOẠT =================

// Thêm kịch bản hiện tại vào hàng đợi dựng hàng loạt
function addToBatchQueue() {
  ensureScenesDataInitialized();
  if (!appState.scenesData || !appState.scenesData.scenes || appState.scenesData.scenes.length === 0) {
    showToast("Vui lòng dán và kiểm tra kịch bản scenes trước khi thêm vào hàng đợi!");
    return;
  }

  const nameInput = document.getElementById("videoNameInput");
  const customName = nameInput.value.trim() || `video_tap_${String(appState.batchQueue.length + 1).padStart(2, "0")}`;
  const gpuMode = document.getElementById("gpuModeSelect").value;
  const concurrency = parseInt(document.getElementById("concurrencyInput").value, 10) || 4;

  const queueItem = {
    id: `queue_${Date.now()}`,
    name: customName,
    scriptData: JSON.parse(JSON.stringify(appState.scriptData || {})),
    timelineData: JSON.parse(JSON.stringify(appState.timelineData || {})),
    scenesData: JSON.parse(JSON.stringify(appState.scenesData || {})),
    gpuMode,
    concurrency,
    status: "pending"
  };

  appState.batchQueue.push(queueItem);
  renderBatchQueue();
  nameInput.value = "";
  showToast(`✅ Đã thêm "${customName}" vào hàng đợi dựng hàng loạt!`);
}

// Hiển thị danh sách hàng đợi
function renderBatchQueue() {
  const box = document.getElementById("batchQueueBox");
  const countBadge = document.getElementById("queueCountBadge");
  const container = document.getElementById("batchQueueList");
  if (!box || !container) return;

  if (appState.batchQueue.length === 0) {
    box.classList.add("hidden");
    return;
  }

  box.classList.remove("hidden");
  countBadge.textContent = `${appState.batchQueue.length} video`;

  const statusLabels = {
    pending: '<span style="color: #94a3b8;">⏳ Đang chờ</span>',
    rendering: '<span style="color: #38bdf8; font-weight: 700;">⚙️ Đang dựng...</span>',
    done: '<span style="color: #34d399; font-weight: 700;">✅ Hoàn tất</span>',
    error: '<span style="color: #f87171; font-weight: 700;">❌ Lỗi</span>'
  };

  container.innerHTML = appState.batchQueue
    .map(
      (item, idx) => `
    <div class="queue-item">
      <div class="queue-item-info">
        <span class="queue-item-title">${idx + 1}. ${escapeHtml(item.name)}</span>
        <span class="queue-item-meta">${item.scenesData.scenes.length} cảnh • GPU: ${item.gpuMode}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        ${statusLabels[item.status] || ""}
        ${
          !appState.isBatchRunning
            ? `<button class="btn btn-sm btn-outline" onclick="removeFromBatchQueue(${idx})" title="Xóa khỏi hàng đợi">🗑️</button>`
            : ""
        }
      </div>
    </div>
  `
    )
    .join("");
}

// Xóa 1 video khỏi hàng đợi
function removeFromBatchQueue(index) {
  if (appState.isBatchRunning) return;
  appState.batchQueue.splice(index, 1);
  renderBatchQueue();
}

// Xóa sạch hàng đợi
function clearBatchQueue() {
  if (appState.isBatchRunning) return;
  appState.batchQueue = [];
  renderBatchQueue();
}

// Bắt đầu dựng toàn bộ video trong hàng đợi
async function startBatchRender() {
  if (appState.batchQueue.length === 0) {
    showToast("Hàng đợi đang trống!");
    return;
  }
  if (appState.isBatchRunning) return;

  appState.isBatchRunning = true;
  document.getElementById("btnStartBatch").disabled = true;
  document.getElementById("batchProgressInfo").classList.remove("hidden");

  const total = appState.batchQueue.length;

  for (let i = 0; i < total; i++) {
    const item = appState.batchQueue[i];
    item.status = "rendering";
    renderBatchQueue();

    document.getElementById("batchProgressText").textContent = `Đang dựng video ${i + 1}/${total}: ${item.name}...`;

    try {
      const res = await fetch("/api/render/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoName: item.name,
          customScriptData: item.scriptData,
          customTimelineData: item.timelineData,
          customScenesData: item.scenesData,
          accelerationMode: item.gpuMode,
          concurrency: item.concurrency,
          isTest: false
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Chờ hoàn thành qua Promise
      await waitForRenderComplete();
      item.status = "done";
    } catch (err) {
      console.error(err);
      item.status = "error";
    }

    renderBatchQueue();
    loadVideosList();
  }

  appState.isBatchRunning = false;
  document.getElementById("btnStartBatch").disabled = false;
  document.getElementById("batchProgressInfo").classList.add("hidden");
  showToast("🎉 Đã hoàn thành toàn bộ quá trình dựng video hàng loạt!");
}

function waitForRenderComplete() {
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener("sse_render_complete", handler);
      window.removeEventListener("sse_render_error", handler);
      window.removeEventListener("sse_render_canceled", handler);
      resolve();
    };
    window.addEventListener("sse_render_complete", handler);
    window.addEventListener("sse_render_error", handler);
    window.addEventListener("sse_render_canceled", handler);
  });
}

// ================= LẮNG NGHE SSE =================
function setupSse() {
  const evtSource = new EventSource("/api/render/progress");

  evtSource.addEventListener("voice_progress", (e) => {
    const p = JSON.parse(e.data);
    const pct = Math.round((p.current / p.total) * 100);
    document.getElementById("voiceProgressBar").style.width = `${pct}%`;
    document.getElementById("voiceProgressText").textContent = `[${p.current}/${p.total}] ${p.cached ? "⚡ Cache" : "🌐 Tạo mới"} dòng ${p.lineId}`;
  });

  evtSource.addEventListener("render_progress", (e) => {
    const p = JSON.parse(e.data);
    
    // Cập nhật giao diện Tab 2
    const bar2 = document.getElementById("renderProgressBar");
    if (bar2) bar2.style.width = `${p.progress}%`;
    const pct2 = document.getElementById("renderPercentText");
    if (pct2) pct2.textContent = `${p.progress}%`;
    const fr2 = document.getElementById("renderFramesText");
    if (fr2) fr2.textContent = `${p.renderedFrames} / ${p.totalFrames} khung hình`;
    if (p.timeRemainingMs) {
      const time2 = document.getElementById("renderTimeRemainingText");
      if (time2) time2.textContent = `Còn lại: ~${Math.round(p.timeRemainingMs / 1000)}s`;
    }

    // Cập nhật giao diện Tab 3 (AI Code Render)
    const bar3 = document.getElementById("aiRenderProgressBar");
    if (bar3) bar3.style.width = `${p.progress}%`;
    const pct3 = document.getElementById("aiRenderPercentText");
    if (pct3) pct3.textContent = `${p.progress}%`;
    const fr3 = document.getElementById("aiRenderFramesText");
    if (fr3) fr3.textContent = `${p.renderedFrames} / ${p.totalFrames} khung hình`;
    if (p.timeRemainingMs) {
      const time3 = document.getElementById("aiRenderTimeRemainingText");
      if (time3) time3.textContent = `Còn lại: ~${Math.round(p.timeRemainingMs / 1000)}s`;
    }
  });

  const handleRenderFinished = (data) => {
    // Reset Tab 2
    const btnTest = document.getElementById("btnRenderTest");
    if (btnTest) btnTest.disabled = false;
    const btnFull = document.getElementById("btnRenderFull");
    if (btnFull) btnFull.disabled = false;
    const btnCancel = document.getElementById("btnCancelRender");
    if (btnCancel) btnCancel.classList.add("hidden");
    const prog2 = document.getElementById("renderProgressWrap");
    if (prog2) prog2.classList.add("hidden");

    // Reset Tab 3
    aiState.isRendering = false;
    const btnAiFull = document.getElementById("btnAiRenderFull");
    if (btnAiFull) btnAiFull.disabled = false;
    const btnAiCancel = document.getElementById("btnCancelAiRender");
    if (btnAiCancel) btnAiCancel.classList.add("hidden");
    const prog3 = document.getElementById("aiRenderProgressWrap");
    if (prog3) prog3.classList.add("hidden");

    const logsContent = document.getElementById("aiRenderLogsContent");
    if (logsContent) {
      logsContent.innerHTML += `<div style="color: #38bdf8;">[${new Date().toLocaleTimeString()}] 🎉 Hoàn tất xuất MP4: "${data.videoName || 'video'}" trong ${data.executionTimeSec || 0}s!</div>`;
    }

    loadVideosList();
    playVideo(data.videoUrl, data.videoName || "video.mp4", true);
    showToast(`🎉 Dựng xong video "${data.videoName || 'video'}" trong ${data.executionTimeSec || 0}s!`);

    // Đồng thời nạp và phát trực tiếp tại màn hình Section C của Tab 3 (Video Preview)
    const previewVideo = document.getElementById("previewVideoPlayer");
    const previewImg = document.getElementById("previewFrameImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const previewStatusInfo = document.getElementById("previewStatusInfo");
    const previewStatusText = document.getElementById("previewStatusText");
    const btnPlayExisting = document.getElementById("btnPlayExistingVideo");

    if (previewVideo && data.videoUrl) {
      previewVideo.src = data.videoUrl;
      previewVideo.classList.remove("hidden");
      if (previewImg) previewImg.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
      if (previewStatusInfo && previewStatusText) {
        previewStatusInfo.classList.remove("hidden");
        previewStatusText.innerHTML = `🎥 Đang phát video xem trước: <strong>${escapeHtml(data.videoName || "video.mp4")}</strong> (${data.executionTimeSec || 0}s)`;
      }
      if (btnPlayExisting) {
        btnPlayExisting.classList.remove("hidden");
        btnPlayExisting.textContent = `▶️ Phát Video Đã Dựng`;
      }
      switchPreviewMode("video");
      previewVideo.load();
      previewVideo.play().catch(() => {});
    }

    window.dispatchEvent(new Event("sse_render_complete"));

    if (data.fallbackUsed) {
      alert(`⚠️ Lưu ý: Bộ tăng tốc GPU gặp lỗi nên hệ thống đã tự động quay về CPU an toàn:\n${data.fallbackReason}`);
    }
  };

  evtSource.addEventListener("render_complete", (e) => {
    handleRenderFinished(JSON.parse(e.data));
  });

  evtSource.addEventListener("render_done", (e) => {
    handleRenderFinished(JSON.parse(e.data));
  });

  evtSource.addEventListener("render_error", (e) => {
    const data = JSON.parse(e.data);
    
    // Reset Tab 2
    const btnTest = document.getElementById("btnRenderTest");
    if (btnTest) btnTest.disabled = false;
    const btnFull = document.getElementById("btnRenderFull");
    if (btnFull) btnFull.disabled = false;
    const btnCancel = document.getElementById("btnCancelRender");
    if (btnCancel) btnCancel.classList.add("hidden");
    const prog2 = document.getElementById("renderProgressWrap");
    if (prog2) prog2.classList.add("hidden");

    // Reset Tab 3
    aiState.isRendering = false;
    const btnAiFull = document.getElementById("btnAiRenderFull");
    if (btnAiFull) btnAiFull.disabled = false;
    const btnAiCancel = document.getElementById("btnCancelAiRender");
    if (btnAiCancel) btnAiCancel.classList.add("hidden");
    const prog3 = document.getElementById("aiRenderProgressWrap");
    if (prog3) prog3.classList.add("hidden");

    const logsContent = document.getElementById("aiRenderLogsContent");
    if (logsContent) {
      logsContent.innerHTML += `<div style="color: #ef4444;">[${new Date().toLocaleTimeString()}] ❌ Lỗi render: ${escapeHtml(data.error)}</div>`;
    }

    showToast("❌ Lỗi trong quá trình dựng: " + data.error);
    window.dispatchEvent(new Event("sse_render_error"));
  });

  evtSource.addEventListener("render_canceled", () => {
    // Reset Tab 2
    const btnTest = document.getElementById("btnRenderTest");
    if (btnTest) btnTest.disabled = false;
    const btnFull = document.getElementById("btnRenderFull");
    if (btnFull) btnFull.disabled = false;
    const btnCancel = document.getElementById("btnCancelRender");
    if (btnCancel) btnCancel.classList.add("hidden");
    const prog2 = document.getElementById("renderProgressWrap");
    if (prog2) prog2.classList.add("hidden");

    // Reset Tab 3
    aiState.isRendering = false;
    const btnAiFull = document.getElementById("btnAiRenderFull");
    if (btnAiFull) btnAiFull.disabled = false;
    const btnAiCancel = document.getElementById("btnCancelAiRender");
    if (btnAiCancel) btnAiCancel.classList.add("hidden");
    const prog3 = document.getElementById("aiRenderProgressWrap");
    if (prog3) prog3.classList.add("hidden");

    const logsContent = document.getElementById("aiRenderLogsContent");
    if (logsContent) {
      logsContent.innerHTML += `<div style="color: #fbbf24;">[${new Date().toLocaleTimeString()}] ⏹️ Quá trình dựng video đã bị hủy.</div>`;
    }

    showToast("⏹️ Quá trình dựng video đã bị hủy.");
    window.dispatchEvent(new Event("sse_render_canceled"));
  });
}

// ================= TIỆN ÍCH =================
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =========================================================================
// TAB 3: AI CODE RENDER LOGIC
// =========================================================================

// State dành riêng cho Tab 3
const aiState = {
  projects: [],
  selectedProjectId: null,
  currentValidation: null,
  currentFrame: 0,
  isRendering: false
};

// 1. Tải danh sách các dự án Remotion AI
async function loadAiProjectsList() {
  const select = document.getElementById("aiProjectSelect");
  if (!select) return;

  try {
    const res = await fetch("/api/ai-code/projects");
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    aiState.projects = data.projects || [];
    select.innerHTML = "";

    if (aiState.projects.length === 0) {
      select.innerHTML = '<option value="">-- Chưa có dự án nào (Hãy tải lên file ZIP) --</option>';
      return;
    }

    aiState.projects.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      const typeLabel = p.isDemo ? "⭐ [MẪU DEMO]" : "📁 [DỰ ÁN]";
      opt.textContent = `${typeLabel} ${p.name || p.folderName}`;
      select.appendChild(opt);
    });

    // Mặc định chọn dự án demo nếu chưa chọn
    if (!aiState.selectedProjectId) {
      const demo = aiState.projects.find((p) => p.isDemo);
      if (demo) {
        select.value = demo.id;
      } else {
        select.value = aiState.projects[0].id;
      }
    } else {
      select.value = aiState.selectedProjectId;
    }

    handleAiProjectChanged();
  } catch (err) {
    console.error("Lỗi tải danh sách AI projects:", err);
    showToast("Không thể tải danh sách dự án AI: " + err.message);
  }
}

// Chọn nhanh Demo project 10s (Remotion)
function selectDemoProject() {
  const select = document.getElementById("aiProjectSelect");
  const demo = aiState.projects.find((p) => p.id === "sample_demo-10s" || (p.isDemo && p.engine === "remotion"));
  if (demo && select) {
    select.value = demo.id;
    handleAiProjectChanged();
    showToast(`⭐ Đã chọn dự án mẫu Remotion: "${demo.name}"`);
  } else {
    showToast("Đang tải lại danh sách dự án...");
    loadAiProjectsList();
  }
}

// Chọn nhanh Demo project Thanh Hai 2D Studio (Reaction Time - 14 Shots)
function selectThanhHaiDemoProject() {
  const select = document.getElementById("aiProjectSelect");
  const thDemo = aiState.projects.find((p) => p.id === "thanhhai_reaction-time" || p.id.includes("reaction-time"));
  if (thDemo && select) {
    select.value = thDemo.id;
    handleAiProjectChanged();
    showToast(`🎨 Đã chọn dự án mẫu Thanh Hai 2D Studio: "${thDemo.name}"`);
  } else {
    showToast("Đang tải lại danh sách dự án...");
    loadAiProjectsList();
  }
}

// Khi người dùng đổi lựa chọn dự án trên dropdown
function handleAiProjectChanged() {
  const select = document.getElementById("aiProjectSelect");
  if (!select) return;

  const projectId = select.value;
  aiState.selectedProjectId = projectId;

  const project = aiState.projects.find((p) => p.id === projectId);
  const overviewBox = document.getElementById("aiProjectOverview");
  if (!project || !overviewBox) {
    if (overviewBox) overviewBox.classList.add("hidden");
    return;
  }

  overviewBox.classList.remove("hidden");

  const isTH = project.engine === "thanhhai-2d-studio" || project.engine === "thanhhai_2d";
  const engineBadge = document.getElementById("aiBadgeEngine");
  const engineTag = document.getElementById("aiEngineTag");
  const btnContactSheet = document.getElementById("btnContactSheet");

  if (engineBadge) {
    engineBadge.textContent = isTH ? "Engine: Thanh Hai 2D Studio" : "Engine: Remotion 2D";
    engineBadge.style.color = isTH ? "#c084fc" : "#38bdf8";
    engineBadge.style.borderColor = isTH ? "#a855f7" : "#0284c7";
  }
  if (engineTag) {
    engineTag.textContent = isTH ? "CANVAS / THREE.JS" : "REMOTION TSX";
    engineTag.style.backgroundColor = isTH ? "#7c3aed" : "#0284c7";
  }
  if (btnContactSheet) {
    if (isTH) btnContactSheet.classList.remove("hidden");
    else btnContactSheet.classList.add("hidden");
  }

  // Hiển thị thông tin tổng quan
  document.getElementById("aiProjectNameTitle").textContent = project.name || project.folderName;
  document.getElementById("aiProjectTag").textContent = project.isDemo ? "MẪU KIỂM THỬ CHUẨN" : "DỰ ÁN ĐÃ IMPORT";

  const cfg = project.config || {};
  document.getElementById("aiBadgeRes").textContent = `${cfg.width || 1920}×${cfg.height || 1080}`;
  document.getElementById("aiBadgeFps").textContent = `${cfg.fps || 30} FPS`;
  const durSec = ((cfg.durationInFrames || 300) / (cfg.fps || 30)).toFixed(1);
  document.getElementById("aiBadgeDuration").textContent = `${cfg.durationInFrames || 300} frames (~${durSec}s)`;
  document.getElementById("aiBadgeComp").textContent = isTH
    ? `Shots: ${cfg.shotsCount || 14} cảnh (${cfg.style || 'dusk'})`
    : `Comp: ${cfg.compositionId || "MainVideo"}`;

  // Cập nhật thanh timeline
  const slider = document.getElementById("previewFrameSlider");
  if (slider) {
    slider.min = 0;
    slider.max = (cfg.durationInFrames || 300) - 1;
    slider.value = 0;
    aiState.currentFrame = 0;
    document.getElementById("currentFrameLabel").textContent = "Frame: 0 (0.00s)";
    document.getElementById("totalFramesLabel").textContent = `${cfg.durationInFrames || 300} frames`;
  }

  // Tự động kiểm tra và nạp video đã có của dự án này vào màn hình xem trước
  loadPreviewForCurrentProject();

  // Tự động thẩm định (Validation) để nạp danh sách file và assets
  validateCurrentAiProject();
}

// Xử lý upload file ZIP
async function handleAiZipSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith(".zip")) {
    showToast("Vui lòng chỉ chọn file nén định dạng .zip");
    return;
  }

  showToast(`📦 Đang tải lên và giải nén an toàn: "${file.name}"...`);

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const base64Data = reader.result.split(",")[1];
      const res = await fetch("/api/ai-code/upload-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipBase64: base64Data,
          filename: file.name
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      showToast(`✅ Đã giải nén thành công ${data.extractedCount} files vào dự án!`);
      aiState.selectedProjectId = data.projectId;
      await loadAiProjectsList();
    } catch (err) {
      showToast("❌ Lỗi upload ZIP: " + err.message);
      console.error(err);
    }
  };
  reader.readAsDataURL(file);
}

// 2. Thẩm định dự án Remotion hoặc Thanh Hai 2D Studio (Validate Project)
async function validateCurrentAiProject() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án trước khi thẩm định!");
    return;
  }

  const resultBox = document.getElementById("validationResultBox");
  const filesTree = document.getElementById("aiFilesTree");
  const assetsList = document.getElementById("aiAssetsList");
  const filesCount = document.getElementById("aiFilesCount");

  resultBox.innerHTML = '<div class="empty-state">⏳ Đang phân tích cấu trúc dự án và kiểm tra engine...</div>';

  try {
    const res = await fetch("/api/ai-code/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const val = data.validation;
    aiState.currentValidation = val;
    const isTH = data.engine === "thanhhai-2d-studio" || val.engine === "thanhhai-2d-studio";

    // Cập nhật nhãn Badge Engine
    const engineBadge = document.getElementById("aiBadgeEngine");
    const engineTag = document.getElementById("aiEngineTag");
    const btnContactSheet = document.getElementById("btnContactSheet");

    if (engineBadge) {
      engineBadge.textContent = isTH ? "Engine: Thanh Hai 2D Studio" : "Engine: Remotion 2D";
      engineBadge.style.color = isTH ? "#c084fc" : "#38bdf8";
      engineBadge.style.borderColor = isTH ? "#a855f7" : "#0284c7";
    }
    if (engineTag) {
      engineTag.textContent = isTH ? "CANVAS / THREE.JS" : "REMOTION TSX";
      engineTag.style.backgroundColor = isTH ? "#7c3aed" : "#0284c7";
    }
    if (btnContactSheet) {
      if (isTH) btnContactSheet.classList.remove("hidden");
      else btnContactSheet.classList.add("hidden");
    }

    // A. Cập nhật cây file
    if (filesTree && val.files) {
      filesCount.textContent = val.files.length;
      filesTree.innerHTML = val.files
        .map((f) => {
          const isDir = f.isDirectory;
          const icon = isDir ? "📁" : "📄";
          const sizeStr = isDir ? "" : `(${(f.size / 1024).toFixed(1)} KB)`;
          return `<div class="file-item ${isDir ? 'is-dir' : ''}"><span>${icon} ${f.path}</span> <span>${sizeStr}</span></div>`;
        })
        .join("");
    }

    // B. Cập nhật danh sách Assets
    if (assetsList && val.assets) {
      let html = "";
      if (val.assets.found.length === 0 && val.assets.missing.length === 0) {
        html = '<div class="empty-state" style="padding: 10px;">Dự án dùng tài nguyên dựng sẵn hoặc vẽ trực tiếp bằng Canvas/Three.js.</div>';
      } else {
        val.assets.found.forEach((a) => {
          html += `<div class="asset-item"><span>🖼️ ${escapeHtml(a)}</span> <span class="asset-badge-found">✅ Đã có</span></div>`;
        });
        val.assets.missing.forEach((a) => {
          html += `<div class="asset-item"><span>⚠️ ${escapeHtml(a)}</span> <span class="asset-badge-missing">❌ Chưa có</span></div>`;
        });
      }
      assetsList.innerHTML = html;
    }

    // C. Bảng báo cáo thẩm định
    const statusClass = val.valid ? "val-status-valid" : "val-status-invalid";
    const statusText = val.valid ? "✅ DỰ ÁN HỢP LỆ — SẴN SÀNG ĐỂ XEM TRƯỚC VÀ DỰNG VIDEO" : "❌ PHÁT HIỆN LỖI TRONG DỰ ÁN — CẦN KHẮC PHỤC TRƯỚC KHI RENDER";

    let reportHtml = `
      <div class="val-status-banner ${statusClass}">
        ${statusText}
      </div>
    `;

    // Chi tiết kiểm tra theo từng Engine tương ứng
    if (isTH) {
      // Giao diện thẩm định chuẩn cho Thanh Hai 2D Studio
      reportHtml += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">ENGINE:</span><br/>
            <strong style="color: #c084fc; font-family: monospace;">Thanh Hai 2D Studio (Canvas/Three.js)</strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">KỊCH BẢN & SHOTS:</span><br/>
            <strong style="color: #38bdf8; font-family: monospace;">${val.shots?.length || val.config?.shotsCount || 0} cảnh (${val.config?.style || 'dusk'} style)</strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">MÔI TRƯỜNG THỰC THI:</span><br/>
            <strong style="color: #10b981;">Playwright Chromium + FFmpeg</strong>
          </div>
        </div>
      `;
    } else {
      // Giao diện thẩm định chuẩn cho Remotion
      reportHtml += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">ENTRYPOINT:</span><br/>
            <strong style="color: ${val.errors.some(e => e.includes('entrypoint')) ? '#f87171' : '#38bdf8'}; font-family: monospace;">
              ${val.config?.entryPoint || 'src/index.ts'}
            </strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">COMPOSITION ID:</span><br/>
            <strong style="color: #38bdf8; font-family: monospace;">${val.config?.compositionId || 'MainVideo'}</strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">DEPENDENCIES:</span><br/>
            <strong style="color: #10b981;">${val.dependencies?.allowed?.join(', ') || 'react, remotion'}</strong>
          </div>
        </div>
      `;
    }

    // Danh sách lỗi
    if (val.errors && val.errors.length > 0) {
      reportHtml += `<div class="val-section-title" style="color: #f87171;">DANH SÁCH LỖI (${val.errors.length}):</div>`;
      reportHtml += '<ul class="val-msg-list">';
      val.errors.forEach((err) => {
        reportHtml += `<li class="val-msg-item error">❌ ${escapeHtml(err)}</li>`;
      });
      reportHtml += '</ul>';
    }

    // Danh sách cảnh báo
    if (val.warnings && val.warnings.length > 0) {
      reportHtml += `<div class="val-section-title" style="color: #fcd34d;">CẢNH BÁO TỐI ƯU (${val.warnings.length}):</div>`;
      reportHtml += '<ul class="val-msg-list">';
      val.warnings.forEach((warn) => {
        reportHtml += `<li class="val-msg-item warning">⚠️ ${escapeHtml(warn)}</li>`;
      });
      reportHtml += '</ul>';
    }

    resultBox.innerHTML = reportHtml;
  } catch (err) {
    resultBox.innerHTML = `<div class="empty-state" style="color: #ef4444;">❌ Lỗi thẩm định: ${escapeHtml(err.message)}</div>`;
  }
}

// 3. Điều khiển Timeline & Soi Frame (Frame Inspector) & Video Preview
function findExistingVideoForProject(projectId, projectName = "") {
  if (!appState.videosList || appState.videosList.length === 0) return null;

  // 1. Khớp theo projectId trong metadata
  let match = appState.videosList.find((v) => v.projectId === projectId);
  if (match) return match;

  // 2. Khớp theo tên file hoặc tiêu đề
  const safeId = (projectId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const safeName = (projectName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  match = appState.videosList.find((v) => {
    const fn = (v.filename || "").toLowerCase();
    const title = (v.title || "").toLowerCase();
    if (safeId && (fn.includes(safeId) || title.includes(safeId))) return true;
    if (safeName && (fn.includes(safeName) || title.includes(safeName))) return true;
    return false;
  });
  if (match) return match;

  // 3. Quy tắc riêng cho các dự án demo
  if (projectId.includes("reaction-time") || projectId.includes("thanhhai")) {
    match = appState.videosList.find((v) => v.filename.includes("reaction_time") || v.filename.includes("thanhhai"));
  } else if (projectId.includes("demo-10s")) {
    match = appState.videosList.find((v) => v.filename.includes("DemoAnimation10s") || v.filename.includes("CharacterRig"));
  }

  return match || null;
}

// Tự động nạp bản xem trước (nếu đã có video) cho dự án đang chọn
function loadPreviewForCurrentProject() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) return;

  const project = aiState.projects.find((p) => p.id === projectId);
  const previewVideo = document.getElementById("previewVideoPlayer");
  const previewImg = document.getElementById("previewFrameImage");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const previewStatusInfo = document.getElementById("previewStatusInfo");
  const previewStatusText = document.getElementById("previewStatusText");
  const btnPlayExisting = document.getElementById("btnPlayExistingVideo");

  const existing = findExistingVideoForProject(projectId, project?.name || project?.folderName);

  if (existing) {
    if (btnPlayExisting) {
      btnPlayExisting.classList.remove("hidden");
      btnPlayExisting.textContent = `▶️ Phát Video Đã Dựng (${existing.sizeMb}MB)`;
    }

    if (previewVideo) {
      previewVideo.src = existing.url;
      previewVideo.classList.remove("hidden");
      if (previewImg) previewImg.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
      if (previewStatusInfo && previewStatusText) {
        previewStatusInfo.classList.remove("hidden");
        previewStatusText.innerHTML = `🎥 Đang nạp video có sẵn: <strong>${escapeHtml(existing.filename)}</strong> (${existing.sizeMb} MB - ${existing.formattedTime})`;
      }
      switchPreviewMode("video");
      previewVideo.load();
    }
  } else {
    if (btnPlayExisting) btnPlayExisting.classList.add("hidden");
    if (previewVideo) {
      previewVideo.pause();
      previewVideo.removeAttribute("src");
      previewVideo.classList.add("hidden");
    }
    if (previewImg) previewImg.classList.add("hidden");
    if (previewStatusInfo) previewStatusInfo.classList.add("hidden");
    if (previewPlaceholder) {
      previewPlaceholder.classList.remove("hidden");
      previewPlaceholder.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 10px;">🎞️</div>
        <div style="font-weight: 600; color: #e2e8f0; font-size: 15px;">Chưa có bản xem trước</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; line-height: 1.6;">
          Bấm <strong style="color: #38bdf8;">"▶ Dựng bản xem trước nhanh (5s)"</strong> bên dưới để xem video hoạt hình chuyển động,<br/>
          hoặc chọn frame rồi bấm <strong style="color: #c084fc;">"📷 Soi Khung Hình Này"</strong> để chụp ảnh khung hình bất kỳ!
        </div>
      `;
    }
    switchPreviewMode("video");
  }
}

// Chuyển chế độ hiển thị giữa Video và Soi Frame
function switchPreviewMode(mode) {
  const btnVideo = document.getElementById("btnModeVideo");
  const btnFrame = document.getElementById("btnModeFrame");
  const previewVideo = document.getElementById("previewVideoPlayer");
  const previewImg = document.getElementById("previewFrameImage");
  const previewPlaceholder = document.getElementById("previewPlaceholder");

  if (mode === "video") {
    if (btnVideo) btnVideo.classList.add("active");
    if (btnFrame) btnFrame.classList.remove("active");

    if (previewVideo && previewVideo.getAttribute("src")) {
      previewVideo.classList.remove("hidden");
      if (previewImg) previewImg.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
    } else {
      if (previewPlaceholder) previewPlaceholder.classList.remove("hidden");
      if (previewVideo) previewVideo.classList.add("hidden");
      if (previewImg) previewImg.classList.add("hidden");
    }
  } else if (mode === "frame") {
    if (btnFrame) btnFrame.classList.add("active");
    if (btnVideo) btnVideo.classList.remove("active");

    if (previewImg && previewImg.getAttribute("src")) {
      previewImg.classList.remove("hidden");
      if (previewVideo) previewVideo.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
    } else {
      // Nếu chưa có ảnh chụp frame, tự động chụp frame hiện tại
      inspectCurrentFrame();
    }
  }
}

// Phát video có sẵn của dự án
function playExistingProjectVideo() {
  const projectId = aiState.selectedProjectId;
  const project = aiState.projects.find((p) => p.id === projectId);
  const existing = findExistingVideoForProject(projectId, project?.name || project?.folderName);
  if (!existing) {
    showToast("Chưa có video nào được dựng cho dự án này. Hãy bấm 'Dựng bản xem trước nhanh (5s)'!");
    return;
  }
  const previewVideo = document.getElementById("previewVideoPlayer");
  const previewImg = document.getElementById("previewFrameImage");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const previewStatusInfo = document.getElementById("previewStatusInfo");
  const previewStatusText = document.getElementById("previewStatusText");

  if (previewVideo) {
    previewVideo.src = existing.url;
    previewVideo.classList.remove("hidden");
    if (previewImg) previewImg.classList.add("hidden");
    if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `🎥 Đang phát: <strong>${escapeHtml(existing.filename)}</strong> (${existing.sizeMb} MB)`;
    }
    switchPreviewMode("video");
    previewVideo.load();
    previewVideo.play().catch(() => {});
    showToast(`▶️ Đang phát video "${existing.filename}"`);
  }
}

// Chuyển sang Tab Thư viện Video
function switchToLibraryTab() {
  switchTab("tab2");
  const target = document.getElementById("videosListContainer");
  if (target) target.scrollIntoView({ behavior: "smooth" });
}

function onFrameSliderInput(event) {
  const frame = parseInt(event.target.value, 10) || 0;
  aiState.currentFrame = frame;
  const fps = aiState.currentValidation?.config?.fps || 30;
  const sec = (frame / fps).toFixed(2);
  const label = document.getElementById("currentFrameLabel");
  if (label) label.textContent = `Frame: ${frame} (${sec}s)`;

  // Nếu đang hiển thị video trong player preview, đồng bộ tua video tới giây đó luôn
  const previewVideo = document.getElementById("previewVideoPlayer");
  if (previewVideo && !previewVideo.classList.contains("hidden") && previewVideo.duration) {
    previewVideo.currentTime = Math.min(previewVideo.duration, Number(sec));
  }
}

function stepFrame(delta) {
  const slider = document.getElementById("previewFrameSlider");
  if (!slider) return;
  let newFrame = (parseInt(slider.value, 10) || 0) + delta;
  const max = parseInt(slider.max, 10) || 300;
  newFrame = Math.max(0, Math.min(max, newFrame));
  slider.value = newFrame;
  onFrameSliderInput({ target: slider });
}

// Chụp và soi 1 frame tức thì
async function inspectCurrentFrame() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án!");
    return;
  }

  const frame = aiState.currentFrame;
  const btn = document.getElementById("btnInspectFrame");
  btn.disabled = true;
  btn.textContent = "⏳ Đang chụp frame...";

  try {
    const res = await fetch("/api/ai-code/preview-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, frame })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const img = document.getElementById("previewFrameImage");
    const video = document.getElementById("previewVideoPlayer");
    const placeholder = document.getElementById("previewPlaceholder");
    const previewStatusInfo = document.getElementById("previewStatusInfo");
    const previewStatusText = document.getElementById("previewStatusText");

    img.src = data.frameUrl;
    img.classList.remove("hidden");
    video.classList.add("hidden");
    placeholder.classList.add("hidden");

    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `📷 Đang soi Frame tĩnh: <strong>Frame ${data.frame}</strong> (${data.width}×${data.height}) - ${(data.frame / (aiState.currentValidation?.config?.fps || 30)).toFixed(2)}s`;
    }

    const btnVideo = document.getElementById("btnModeVideo");
    const btnFrame = document.getElementById("btnModeFrame");
    if (btnFrame) btnFrame.classList.add("active");
    if (btnVideo) btnVideo.classList.remove("active");

    showToast(`📷 Đã chụp Frame ${data.frame} (${data.width}×${data.height}) thành công!`);
  } catch (err) {
    showToast("❌ Lỗi chụp frame: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "📷 Soi Khung Hình Này";
  }
}

// Chụp và hiển thị Contact Sheet toàn bộ cảnh (Dành riêng cho Thanh Hai 2D Studio)
async function inspectContactSheet() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án!");
    return;
  }

  const btn = document.getElementById("btnContactSheet");
  btn.disabled = true;
  btn.textContent = "⏳ Đang tạo Contact Sheet...";

  try {
    const res = await fetch("/api/ai-code/contact-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const img = document.getElementById("previewFrameImage");
    const video = document.getElementById("previewVideoPlayer");
    const placeholder = document.getElementById("previewPlaceholder");
    const previewStatusInfo = document.getElementById("previewStatusInfo");
    const previewStatusText = document.getElementById("previewStatusText");

    img.src = data.sheetUrl;
    img.classList.remove("hidden");
    video.classList.add("hidden");
    placeholder.classList.add("hidden");

    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `📋 Đang hiển thị: <strong>Contact Sheet toàn bộ 14 Shots</strong>`;
    }

    const btnVideo = document.getElementById("btnModeVideo");
    const btnFrame = document.getElementById("btnModeFrame");
    if (btnFrame) btnFrame.classList.add("active");
    if (btnVideo) btnVideo.classList.remove("active");

    showToast("📋 Đã nạp thành công Contact Sheet toàn bộ 14 Shots!");
  } catch (err) {
    showToast("❌ Lỗi nạp Contact Sheet: " + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "📋 Xem Contact Sheet (Toàn Bộ Shots)";
  }
}

// 4. Render Video MP4 từ AI Project
async function startAiRender(isTest = false) {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án!");
    return;
  }

  if (aiState.isRendering) {
    showToast("Đang có tiến trình dựng video đang chạy.");
    return;
  }

  const resSelect = document.getElementById("aiResolutionSelect").value;
  const fpsSelect = document.getElementById("aiFpsSelect").value;
  const gpuMode = document.getElementById("aiGpuModeSelect").value;
  const nameInput = document.getElementById("aiCustomVideoName").value.trim();

  const progressWrap = document.getElementById("aiRenderProgressWrap");
  const logsBox = document.getElementById("aiRenderLogsBox");
  const logsContent = document.getElementById("aiRenderLogsContent");
  const btnFull = document.getElementById("btnAiRenderFull");
  const btnCancel = document.getElementById("btnCancelAiRender");

  progressWrap.classList.remove("hidden");
  logsBox.classList.remove("hidden");
  logsContent.innerHTML = `<div>[${new Date().toLocaleTimeString()}] Bắt đầu yêu cầu render ${isTest ? '(Bản xem trước 5s)' : '(Bản đầy đủ)'}...</div>`;

  btnFull.disabled = true;
  btnCancel.classList.remove("hidden");
  aiState.isRendering = true;

  // Nếu là dựng thử 5s, cập nhật ngay màn hình Preview
  if (isTest) {
    const previewVideo = document.getElementById("previewVideoPlayer");
    const previewImg = document.getElementById("previewFrameImage");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const previewStatusInfo = document.getElementById("previewStatusInfo");
    const previewStatusText = document.getElementById("previewStatusText");

    if (previewVideo) previewVideo.classList.add("hidden");
    if (previewImg) previewImg.classList.add("hidden");
    if (previewPlaceholder) {
      previewPlaceholder.classList.remove("hidden");
      previewPlaceholder.innerHTML = `
        <div style="font-size: 40px; margin-bottom: 10px;" class="pulse-anim">⚡</div>
        <div style="color: #38bdf8; font-weight: bold; font-size: 16px;">Đang dựng nhanh 5 giây xem trước...</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; line-height: 1.5;">
          Hệ thống đang chạy Playwright & FFmpeg xuất 5 giây đầu.<br/>
          Video sẽ tự động nạp và phát ngay tại đây khi hoàn thành!
        </div>
      `;
    }
    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `⏳ Đang dựng bản xem trước 5 giây...`;
    }
    switchPreviewMode("video");
  }

  try {
    const res = await fetch("/api/ai-code/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        accelerationMode: gpuMode,
        isTest,
        customVideoName: nameInput,
        customResolution: resSelect === "project" ? null : resSelect,
        customFps: fpsSelect === "project" ? null : fpsSelect
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`🚀 ${data.message}`);
    logsContent.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Máy chủ đã nhận lệnh, đang nạp Remotion Engine...</div>`;
  } catch (err) {
    aiState.isRendering = false;
    btnFull.disabled = false;
    btnCancel.classList.add("hidden");
    progressWrap.classList.add("hidden");
    showToast("❌ Không thể bắt đầu render: " + err.message);
  }
}

// Đăng ký sự kiện kéo thả cho Dropzone
window.addEventListener("DOMContentLoaded", () => {
  const dropzone = document.getElementById("aiDropzone");
  if (dropzone) {
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleAiZipSelected({ target: { files: e.dataTransfer.files } });
      }
    });
  }
});


