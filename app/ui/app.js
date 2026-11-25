/**
 * Client Application Logic (app.js)
 * Giao tiếp với API Local Server, quản lý SSE, Audio Player và Drag-Drop Upload
 */

let appState = {
  lines: [],
  timelineData: null,
  scriptData: null,
  currentAudioPlayer: null,
  videosList: [],
  currentPlayingFilename: null
};

// ================= KHỞI TẠO ỨNG DỤNG =================
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupSse();
  loadAiProjectsList();
  loadVideosList();
  loadUniversalAssetsList();
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

    // 4. Nạp danh sách video đã dựng
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

  if (tabNum === 2) {
    loadAiProjectsList();
    loadVideosList();
  } else if (tabNum === 3) {
    loadCharacterLibrary();
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
  const player = document.getElementById("previewVideoPlayer") || document.getElementById("outputVideoPlayer");
  const previewImg = document.getElementById("previewFrameImage");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const previewStatusInfo = document.getElementById("previewStatusInfo");
  const previewStatusText = document.getElementById("previewStatusText");

  if (player) {
    player.src = url;
    player.classList.remove("hidden");
    if (previewImg) previewImg.classList.add("hidden");
    if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `🎥 Đang phát: <strong>${escapeHtml(filename)}</strong>`;
    }
    player.load();
    if (autoPlay) {
      player.play().catch(() => {});
    }
    const container = document.getElementById("previewContainer");
    if (container) {
      container.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
  selectedCompositionId: null,
  availableCompositions: [],
  currentValidation: null,
  currentFrame: 0,
  isRendering: false
};

// Cập nhật dropdown chọn Composition
function updateAiCompositionDropdown(compositions = [], selectedId = null) {
  const compSettingItem = document.getElementById("aiCompositionSettingItem");
  const compSelect = document.getElementById("aiCompositionSelect");
  if (!compSelect) return;

  const project = aiState.projects.find((p) => p.id === aiState.selectedProjectId);
  const engine = (project?.engine || "").toLowerCase();
  const isRemotion = engine === "remotion" || engine === "remotion-2d";

  if (!isRemotion) {
    if (compSettingItem) compSettingItem.classList.add("hidden");
    return;
  }

  if (compSettingItem) compSettingItem.classList.remove("hidden");

  compSelect.innerHTML = "";

  if (!compositions || compositions.length === 0) {
    const opt = document.createElement("option");
    opt.value = selectedId || "MainVideo";
    opt.textContent = selectedId || "MainVideo";
    compSelect.appendChild(opt);
    aiState.selectedCompositionId = opt.value;
    updateAiCompBadge(opt.value);
    return;
  }

  // 6. Nếu chỉ có một composition, tự động chọn composition đó
  // 7. Nếu có nhiều composition, hiển thị dropdown để người dùng chọn
  compositions.forEach((c) => {
    const opt = document.createElement("option");
    const id = typeof c === "string" ? c : c.id;
    opt.value = id;
    const meta = typeof c === "object" && c.width ? ` (${c.width}×${c.height}, ${c.fps}fps)` : "";
    opt.textContent = `${id}${meta}`;
    compSelect.appendChild(opt);
  });

  // Chọn composition phù hợp hoặc cái đầu tiên
  const match = compositions.find((c) => (typeof c === "string" ? c : c.id) === selectedId);
  const chosenId = match
    ? (typeof match === "string" ? match : match.id)
    : (typeof compositions[0] === "string" ? compositions[0] : compositions[0].id);

  compSelect.value = chosenId;
  aiState.selectedCompositionId = chosenId;
  updateAiCompBadge(chosenId);
}

function updateAiCompBadge(compTitle) {
  const badge = document.getElementById("aiBadgeComp");
  if (badge) {
    badge.textContent = `Comp: ${compTitle || "MainVideo"}`;
  }
}

// Khi người dùng đổi Composition trên dropdown
function handleAiCompositionChanged() {
  const compSelect = document.getElementById("aiCompositionSelect");
  if (!compSelect) return;

  const newCompId = compSelect.value;
  aiState.selectedCompositionId = newCompId;
  updateAiCompBadge(newCompId);

  // Cập nhật thông số badge nếu có metadata
  const compMeta = aiState.availableCompositions.find((c) => (typeof c === "string" ? c : c.id) === newCompId);
  if (compMeta && typeof compMeta === "object") {
    if (compMeta.width && compMeta.height) {
      const resBadge = document.getElementById("aiBadgeRes");
      if (resBadge) resBadge.textContent = `${compMeta.width}×${compMeta.height}`;
    }
    if (compMeta.fps) {
      const fpsBadge = document.getElementById("aiBadgeFps");
      if (fpsBadge) fpsBadge.textContent = `${compMeta.fps} FPS`;
    }
    if (compMeta.durationInFrames) {
      const fps = compMeta.fps || 30;
      const durSec = (compMeta.durationInFrames / fps).toFixed(1);
      const durBadge = document.getElementById("aiBadgeDuration");
      if (durBadge) durBadge.textContent = `${compMeta.durationInFrames} frames (~${durSec}s)`;

      const slider = document.getElementById("previewFrameSlider");
      if (slider) {
        slider.max = compMeta.durationInFrames - 1;
      }
    }
  }

  showToast(`🎯 Đã chọn Composition: "${newCompId}"`);
}

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
      opt.textContent = p.name || p.folderName;
      select.appendChild(opt);
    });

    // Ưu tiên chọn dự án đang được chỉ định hoặc dự án mới tải lên đầu tiên
    if (aiState.selectedProjectId && aiState.projects.some((p) => p.id === aiState.selectedProjectId)) {
      select.value = aiState.selectedProjectId;
    } else {
      select.value = aiState.projects[0].id;
      aiState.selectedProjectId = select.value;
    }

    handleAiProjectChanged();
  } catch (err) {
    console.error("Lỗi tải danh sách AI projects:", err);
    showToast("Không thể tải danh sách dự án AI: " + err.message);
  }
}

// Xóa dự án AI đang chọn (chỉ xóa dự án import, không xóa demo gốc)
async function deleteCurrentAiProject() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án để xóa!");
    return;
  }

  const project = aiState.projects.find((p) => p.id === projectId);
  if (project && project.isDemo) {
    alert("⚠️ Đây là dự án mẫu demo mặc định của hệ thống, không thể xóa.");
    return;
  }

  const confirmName = project?.name || projectId;
  if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn dự án:\n"${confirmName}"\nkhỏi danh sách và ổ đĩa không?`)) {
    return;
  }

  try {
    const res = await fetch("/api/ai-code/delete-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`🗑️ Đã xóa thành công dự án!`);
    aiState.selectedProjectId = null;
    await loadAiProjectsList();
  } catch (err) {
    showToast("❌ Không thể xóa dự án: " + err.message);
  }
}

// Dọn sạch toàn bộ các dự án đã import để làm trống danh sách
async function deleteAllImportedProjects() {
  if (!confirm("⚠️ Bạn có chắc chắn muốn dọn sạch TOÀN BỘ các dự án đã import trước đây không?\n(Các mẫu demo gốc vẫn được giữ nguyên)")) {
    return;
  }

  try {
    const res = await fetch("/api/ai-code/delete-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleteAll: true })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast("🧹 Đã dọn sạch tất cả các dự án import!");
    aiState.selectedProjectId = null;
    await loadAiProjectsList();
  } catch (err) {
    showToast("❌ Không thể dọn dẹp: " + err.message);
  }
}

// Chọn nhanh Demo project Thanh Hai 2D Studio (Reaction Time - White Cartoon 2D)
function selectThanhHaiDemoProject(demoKey = "reaction-time") {
  const select = document.getElementById("aiProjectSelect");
  let target = aiState.projects.find((p) => p.id.includes(demoKey)) || aiState.projects.find((p) => p.id.includes("reaction-time")) || aiState.projects[0];
  if (target && select) {
    select.value = target.id;
    handleAiProjectChanged();
    showToast(`🎨 Đã chọn dự án: "${target.name}"`);
  } else {
    showToast("Đang tải lại danh sách dự án...");
    loadAiProjectsList();
  }
}

// Giữ lại các alias cũ để tránh lỗi runtime
function selectDemoProject() { selectThanhHaiDemoProject("reaction-time"); }
function selectChibiDemoProject() { selectThanhHaiDemoProject("reaction-time"); }
function selectPythonDemoProject() { selectThanhHaiDemoProject("reaction-time"); }

// Bật/tắt bảng điều khiển Chibi Animation Test Panel
function toggleChibiTestPanel() {
  const panel = document.getElementById("chibiTestPanel");
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");
  if (isHidden) {
    panel.classList.remove("hidden");
    showToast("🎭 Đã mở bảng Chibi Animation Studio");
  } else {
    panel.classList.add("hidden");
  }
}

// Bật/tắt bảng điều khiển Expressions & Props V4 Test Panel
function toggleV4ExpressionsPropsPanel() {
  const panel = document.getElementById("v4ExpressionsPropsPanel");
  if (!panel) return;
  const isHidden = panel.classList.contains("hidden");
  if (isHidden) {
    panel.classList.remove("hidden");
    showToast("📦 Đã mở bảng Expressions & Props V4 Controller");
    updateV4TestPreview();
  } else {
    panel.classList.add("hidden");
  }
}
window.toggleV4ExpressionsPropsPanel = toggleV4ExpressionsPropsPanel;

// Cập nhật canvas preview động cho biểu cảm và đạo cụ V4
function updateV4TestPreview() {
  const charKey = document.getElementById("v4TestCharSelect")?.value || "max";
  const expr = document.getElementById("v4TestExprSelect")?.value || "surprised";
  const propType = document.getElementById("v4TestPropSelect")?.value || "coffee_cup";
  const hand = document.getElementById("v4TestPropHandSelect")?.value || "F";
  const state = document.getElementById("v4TestPropStateSelect")?.value || "held";
  const dropTime = parseFloat(document.getElementById("v4TestDropTime")?.value) || 2.5;

  console.log(`[V4 Test] Character: ${charKey}, Expr: ${expr}, Prop: ${propType}, Hand: ${hand}, State: ${state}, DropTime: ${dropTime}s`);
}
window.updateV4TestPreview = updateV4TestPreview;

// Chạy demo tương tác cầm và thả đạo cụ V4
function runV4PropInteractiveDemo() {
  showToast("🎬 Đang chạy mô phỏng cầm & thả cốc: 0s-2.5s cầm cốc, 2.5s thả rơi!");
  const propStateSelect = document.getElementById("v4TestPropStateSelect");
  const exprSelect = document.getElementById("v4TestExprSelect");
  if (propStateSelect) propStateSelect.value = "held";
  if (exprSelect) exprSelect.value = "happy";
  updateV4TestPreview();

  setTimeout(() => {
    if (propStateSelect) propStateSelect.value = "dropped";
    if (exprSelect) exprSelect.value = "shocked";
    updateV4TestPreview();
    showToast("💥 Cốc đã rơi xuống sàn! Biểu cảm nhân vật: Sốc / Bàng hoàng (Shocked)");
  }, 2500);
}
window.runV4PropInteractiveDemo = runV4PropInteractiveDemo;

// Khi người dùng chủ động đổi Engine trên dropdown
function handleEngineSelectChanged() {
  const engineSelect = document.getElementById("aiEngineSelect");
  const chosen = engineSelect ? engineSelect.value : "auto";
  aiState.manualEngineOverride = chosen;
  showToast(`⚙️ Đã chuyển Engine sang: ${chosen === "auto" ? "Tự động nhận diện" : chosen}`);
  const charSettingItem = document.getElementById("aiCharacterSettingItem");
  if (charSettingItem) {
    if (chosen === "thanhhai-2d-studio") charSettingItem.classList.remove("hidden");
    else if (chosen !== "auto") charSettingItem.classList.add("hidden");
  }
  validateCurrentAiProject();
}

function handleAiCharacterChanged() {
  const charSelect = document.getElementById("aiCharacterSelect");
  if (!charSelect) return;
  aiState.selectedCharacterRenderer = charSelect.value;
  const label = charSelect.value === 'chibi' ? 'Chibi V9 (Cut-out Animation)' : (charSelect.value === 'white_cartoon' ? 'Hoạt hình Trắng (White Cartoon 2D)' : 'Nhân vật gốc Thanh Hai');
  showToast(`🎭 Character Renderer: ${label}`);
}
window.handleAiCharacterChanged = handleAiCharacterChanged;

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

  // Cập nhật dropdown engine
  const engineSelect = document.getElementById("aiEngineSelect");
  if (engineSelect) {
    engineSelect.value = "thanhhai-2d-studio";
  }

  const engineBadge = document.getElementById("aiBadgeEngine");
  const engineTag = document.getElementById("aiEngineTag");
  const btnContactSheet = document.getElementById("btnAiContactSheet");
  const compSettingItem = document.getElementById("aiCompositionSettingItem");
  const charSettingItem = document.getElementById("aiCharacterSettingItem");

  if (compSettingItem) {
    compSettingItem.classList.add("hidden");
  }

  if (charSettingItem) {
    charSettingItem.classList.remove("hidden");
    const charSelect = document.getElementById("aiCharacterSelect");
    if (charSelect) {
      const projChar = project.config?.character;
      if (projChar === "white_cartoon" || projChar === "chibi" || projChar === "original") {
        charSelect.value = projChar;
        aiState.selectedCharacterRenderer = projChar;
      } else {
        charSelect.value = "white_cartoon";
        aiState.selectedCharacterRenderer = "white_cartoon";
      }
    }
  }

  if (engineBadge) {
    engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
    engineBadge.style.color = "#c084fc";
    engineBadge.style.borderColor = "#a855f7";
  }

  if (engineTag) {
    engineTag.textContent = "CANVAS / THREE.JS";
    engineTag.style.backgroundColor = "#7c3aed";
  }

  if (btnContactSheet) {
    btnContactSheet.classList.remove("hidden");
  }

  // Hiển thị thông tin tổng quan
  document.getElementById("aiProjectNameTitle").textContent = project.name || project.folderName;
  document.getElementById("aiProjectTag").textContent = project.isDemo ? "MẪU KIỂM THỬ CHUẨN" : "DỰ ÁN ĐÃ IMPORT";

  const cfg = project.config || {};
  document.getElementById("aiBadgeRes").textContent = `${cfg.width || 1920}×${cfg.height || 1080}`;
  document.getElementById("aiBadgeFps").textContent = `${cfg.fps || 24} FPS`;
  const durSec = cfg.durationInFrames ? (cfg.durationInFrames / (cfg.fps || 24)).toFixed(1) : (cfg.durationSec || 0);
  document.getElementById("aiBadgeDuration").textContent = `~${durSec}s`;

  if (isPython) {
    document.getElementById("aiBadgeComp").textContent = `Shots: ${cfg.shotsCount || 31} cảnh (${cfg.mood || 'mystery'} mood)`;
    updateAiCompositionDropdown([], null);
  } else if (isTH) {
    document.getElementById("aiBadgeComp").textContent = `Shots: ${cfg.shotsCount || 14} cảnh (${cfg.style || 'dusk'} style)`;
    updateAiCompositionDropdown([], null);
  } else {
    const initialComps = cfg.compositions || (cfg.compositionId ? [{ id: cfg.compositionId, width: cfg.width, height: cfg.height, fps: cfg.fps, durationInFrames: cfg.durationInFrames }] : []);
    aiState.availableCompositions = initialComps;
    aiState.selectedCompositionId = cfg.compositionId || (initialComps[0]?.id || initialComps[0] || null);
    updateAiCompositionDropdown(aiState.availableCompositions, aiState.selectedCompositionId);
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

      aiState.selectedProjectId = data.projectId;
      if (data.compositionId) {
        aiState.selectedCompositionId = data.compositionId;
      }
      if (data.compositions) {
        aiState.availableCompositions = data.compositions;
      }
      await loadAiProjectsList();

      const previewContainer = document.getElementById("previewContainer");
      if (previewContainer) {
        previewContainer.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      showToast(`🎉 Đã nạp thành công file mới: "${data.projectName || file.name}"!`);
    } catch (err) {
      showToast("❌ Lỗi upload ZIP: " + err.message);
      console.error(err);
    }
  };
  reader.readAsDataURL(file);
}

// 2. Thẩm định dự án Remotion, Thanh Hai 2D Studio hoặc Python 2D Long Form (Validate Project)
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
    const engineSelect = document.getElementById("aiEngineSelect");
    const engineOverride = (engineSelect && engineSelect.value !== "auto") ? engineSelect.value : (aiState.manualEngineOverride || null);

    const res = await fetch("/api/ai-code/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, engineOverride })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const val = data.validation;
    aiState.currentValidation = val;
    const rawEngine = (data.engine || val.engine || "").toLowerCase();
    const isPython = rawEngine === "python-2d-long-form" || rawEngine === "python-longform" || rawEngine === "python_longform" || rawEngine === "python";
    const isTH = rawEngine === "thanhhai-2d-studio" || rawEngine === "thanhhai_2d" || rawEngine === "thanhhai";
    const isRemotion = rawEngine === "remotion" || rawEngine === "remotion-2d";
    const isUnknown = !isPython && !isTH && !isRemotion;

    // Cập nhật compositions thực tế nếu là Remotion
    const compSettingItem = document.getElementById("aiCompositionSettingItem");
    if (isRemotion) {
      if (compSettingItem) compSettingItem.classList.remove("hidden");
      const realComps = data.compositions || val.compositions || [];
      if (realComps.length > 0) {
        aiState.availableCompositions = realComps;
        const exists = realComps.some(c => (typeof c === "string" ? c : c.id) === aiState.selectedCompositionId);
        if (!exists || realComps.length === 1) {
          aiState.selectedCompositionId = typeof realComps[0] === "string" ? realComps[0] : realComps[0].id;
        }
        updateAiCompositionDropdown(aiState.availableCompositions, aiState.selectedCompositionId);
      }
    } else {
      if (compSettingItem) compSettingItem.classList.add("hidden");
    }

    // Cập nhật nhãn Badge Engine
    const engineBadge = document.getElementById("aiBadgeEngine");
    const engineTag = document.getElementById("aiEngineTag");
    const btnContactSheet = document.getElementById("btnAiContactSheet");

    if (engineBadge) {
      engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
      engineBadge.style.color = "#c084fc";
      engineBadge.style.borderColor = "#a855f7";
    }
    if (engineTag) {
      engineTag.textContent = "CANVAS / THREE.JS";
      engineTag.style.backgroundColor = "#7c3aed";
    }
    if (btnContactSheet) {
      btnContactSheet.classList.remove("hidden");
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
        html = '<div class="empty-state" style="padding: 10px;">Dự án dùng tài nguyên dựng sẵn hoặc vẽ trực tiếp bằng Canvas 2D.</div>';
      } else {
        val.assets.found.forEach((a) => {
          html += `<div class="asset-item"><span>🔊 ${escapeHtml(a)}</span> <span class="asset-badge-found">✅ Đã có</span></div>`;
        });
        val.assets.missing.forEach((a) => {
          html += `<div class="asset-item"><span>⚡ ${escapeHtml(a)}</span> <span class="asset-badge-missing">⚡ Tự động tổng hợp</span></div>`;
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

// 3. Xem trước Contact Sheet (Thanh Hai 2D Studio & Python 2D Long Form)
async function previewCurrentProjectStills() {
  const projectId = aiState.selectedProjectId;
  if (!projectId) {
    showToast("Vui lòng chọn một dự án!");
    return;
  }

  showToast("🖼️ Đang tạo và nạp Contact Sheet...");
  try {
    const engineSelect = document.getElementById("aiEngineSelect");
    const engineOverride = (engineSelect && engineSelect.value !== "auto") ? engineSelect.value : (aiState.manualEngineOverride || null);
    const charSelect = document.getElementById("aiCharacterSelect");
    const characterRenderer = charSelect ? charSelect.value : "white_cartoon";

    const res = await fetch("/api/ai-code/contact-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, engineOverride, characterRenderer })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const previewImg = document.getElementById("previewFrameImage");
    const previewVideo = document.getElementById("previewVideoPlayer");
    const previewPlaceholder = document.getElementById("previewPlaceholder");
    const previewStatusInfo = document.getElementById("previewStatusInfo");
    const previewStatusText = document.getElementById("previewStatusText");

    if (previewImg && data.sheetUrl) {
      previewImg.src = data.sheetUrl;
      previewImg.classList.remove("hidden");
      if (previewVideo) previewVideo.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
      if (previewStatusInfo && previewStatusText) {
        previewStatusInfo.classList.remove("hidden");
        previewStatusText.innerHTML = `🖼️ Đang hiển thị Contact Sheet: <a href="${data.sheetUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline;">Xem ảnh gốc đầy đủ</a>`;
      }
      showToast("🖼️ Đã nạp Contact Sheet thành công!");
    }
  } catch (err) {
    showToast("❌ Không thể nạp Contact Sheet: " + err.message);
  }
}

// 4. Điều khiển Timeline & Soi Frame (Frame Inspector) & Video Preview
function findExistingVideoForProject(projectId, projectName = "") {
  if (!appState.videosList || appState.videosList.length === 0) return null;

  // 1. Khớp chính xác tuyệt đối theo projectId trong metadata
  let match = appState.videosList.find((v) => v.projectId === projectId);
  if (match) return match;

  // 2. Với các dự án mẫu demo hệ thống
  if (projectId === "sample_demo-10s") {
    match = appState.videosList.find((v) => v.filename.includes("remotion_demo-10s") || v.filename.includes("DemoAnimation10s"));
    if (match) return match;
  } else if (projectId === "thanhhai_reaction-time") {
    match = appState.videosList.find((v) => v.filename.includes("thanhhai_reaction-time") || v.filename.includes("reaction_time"));
    if (match) return match;
  } else if (projectId === "python_marshmallow") {
    match = appState.videosList.find((v) => v.filename.includes("python_longform_marshmallow") || v.filename.includes("marshmallow"));
    if (match) return match;
  }

  // 3. Khớp theo id thư mục duy nhất của dự án đã import (ví dụ folder có timestamp)
  const safeId = (projectId || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (safeId && safeId.length > 5) {
    match = appState.videosList.find((v) => {
      const fn = (v.filename || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return fn.includes(safeId);
    });
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
      btnPlayExisting.textContent = `▶️ Phát lại video này (${existing.sizeMb}MB)`;
    }

    if (previewVideo) {
      previewVideo.src = existing.url;
      previewVideo.classList.remove("hidden");
      if (previewImg) previewImg.classList.add("hidden");
      if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
      if (previewStatusInfo && previewStatusText) {
        previewStatusInfo.classList.remove("hidden");
        previewStatusText.innerHTML = `🎥 Video thành phẩm của dự án: <strong>${escapeHtml(existing.filename)}</strong> (${existing.sizeMb} MB)`;
      }
      previewVideo.load();
    }
  } else {
    // Dự án này chưa từng được render: hiển thị màn hình sẵn sàng rõ ràng, KHÔNG nạp video cũ của dự án khác
    if (btnPlayExisting) {
      if (appState.videosList && appState.videosList.length > 0) {
        btnPlayExisting.classList.remove("hidden");
        btnPlayExisting.textContent = `▶️ Xem video gần nhất trong thư viện (${appState.videosList[0].sizeMb}MB)`;
      } else {
        btnPlayExisting.classList.add("hidden");
      }
    }
    if (previewVideo) {
      previewVideo.pause();
      previewVideo.removeAttribute("src");
      previewVideo.classList.add("hidden");
    }
    if (previewImg) previewImg.classList.add("hidden");
    if (previewStatusInfo) previewStatusInfo.classList.add("hidden");
    if (previewPlaceholder) {
      previewPlaceholder.classList.remove("hidden");
      const projTitle = project?.name || project?.folderName || projectId;
      previewPlaceholder.innerHTML = `
        <div style="font-size: 52px; margin-bottom: 12px;">🎬</div>
        <div style="font-weight: 700; color: #f8fafc; font-size: 17px;">${escapeHtml(projTitle)}</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: 8px; line-height: 1.6; max-width: 520px; margin-left: auto; margin-right: auto;">
          Dự án của bạn đã sẵn sàng để dựng thành video hoàn chỉnh.<br/>
          Bấm nút <strong style="color: #38bdf8;">"🚀 Render Video MP4 Hoàn Chỉnh"</strong> hoặc <strong style="color: #c084fc;">"▶️ Dựng thử 5 giây"</strong> ở trên.<br/>
          <span style="color: #34d399; font-weight: 600;">Video render từ file của bạn sẽ tự động hiển thị và phát trực tiếp ngay trên khung hình này!</span>
        </div>
      `;
    }
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
      inspectCurrentFrame();
    }
  }
}

// Phát video có sẵn của dự án hoặc video gần nhất trong thư viện
function playExistingProjectVideo() {
  const projectId = aiState.selectedProjectId;
  const project = aiState.projects.find((p) => p.id === projectId);
  const existing = findExistingVideoForProject(projectId, project?.name || project?.folderName);
  const videoToPlay = existing || (appState.videosList && appState.videosList.length > 0 ? appState.videosList[0] : null);

  if (!videoToPlay) {
    showToast("Chưa có video nào trong thư mục out/. Hãy bấm nút 'Render Video' ở trên!");
    return;
  }
  const previewVideo = document.getElementById("previewVideoPlayer");
  const previewImg = document.getElementById("previewFrameImage");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const previewStatusInfo = document.getElementById("previewStatusInfo");
  const previewStatusText = document.getElementById("previewStatusText");

  if (previewVideo) {
    previewVideo.src = videoToPlay.url;
    previewVideo.classList.remove("hidden");
    if (previewImg) previewImg.classList.add("hidden");
    if (previewPlaceholder) previewPlaceholder.classList.add("hidden");
    if (previewStatusInfo && previewStatusText) {
      previewStatusInfo.classList.remove("hidden");
      previewStatusText.innerHTML = `🎥 Đang phát: <strong>${escapeHtml(videoToPlay.filename)}</strong> (${videoToPlay.sizeMb} MB)`;
    }
    previewVideo.load();
    previewVideo.play().catch(() => {});
    showToast(`▶️ Đang phát video "${videoToPlay.filename}"`);
  }
}

// Chuyển sang Tab Thư viện Video
function switchToLibraryTab() {
  switchTab(2);
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
    const charSelect = document.getElementById("aiCharacterSelect");
    const characterRenderer = charSelect ? charSelect.value : "white_cartoon";

    const res = await fetch("/api/ai-code/preview-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, frame, compositionId: aiState.selectedCompositionId, characterRenderer })
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
    const charSelect = document.getElementById("aiCharacterSelect");
    const characterRenderer = charSelect ? charSelect.value : "white_cartoon";

    const res = await fetch("/api/ai-code/contact-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, characterRenderer })
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

  const project = aiState.projects.find((p) => p.id === projectId);

  if (aiState.isRendering) {
    showToast("Đang có tiến trình dựng video đang chạy.");
    return;
  }

  // 5. Trước khi render, kiểm tra ID có nằm trong danh sách composition thực tế hay không.
  // 6. Nếu chỉ có một composition, tự động chọn composition đó.
  // 7. Nếu có nhiều composition, hiển thị dropdown để người dùng chọn.
  const isRemotion = !project?.engine || project.engine === "remotion" || project.engine === "auto";
  if (isRemotion && aiState.availableCompositions && aiState.availableCompositions.length > 0) {
    if (aiState.availableCompositions.length === 1) {
      const single = aiState.availableCompositions[0];
      aiState.selectedCompositionId = typeof single === "string" ? single : single.id;
    } else {
      const validIds = aiState.availableCompositions.map((c) => (typeof c === "string" ? c : c.id));
      if (!aiState.selectedCompositionId || !validIds.includes(aiState.selectedCompositionId)) {
        aiState.selectedCompositionId = validIds[0];
      }
    }
    updateAiCompBadge(aiState.selectedCompositionId);
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
  const projLabel = project?.rawName || project?.name || projectId;
  logsContent.innerHTML = `<div>[${new Date().toLocaleTimeString()}] Bắt đầu yêu cầu render ${isTest ? '(Bản xem trước 5s)' : '(Bản đầy đủ)'} cho: <strong>${escapeHtml(projLabel)}</strong>...</div>`;

  btnFull.disabled = true;
  btnCancel.classList.remove("hidden");
  aiState.isRendering = true;

  // Cập nhật trạng thái hiển thị trực quan ngay trên Màn hình Video
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
      <div style="font-size: 52px; margin-bottom: 12px;" class="pulse-anim">⚡</div>
      <div style="color: #38bdf8; font-weight: bold; font-size: 17px;">
        Đang dựng ${isTest ? 'bản xem trước 5 giây' : 'video MP4 hoàn chỉnh'}...
      </div>
      <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; line-height: 1.5;">
        Hệ thống đang xuất các khung hình từ file dự án của bạn. Bạn có thể theo dõi thanh tiến độ bên dưới.<br/>
        <strong style="color: #34d399;">Video thành phẩm sẽ tự động nạp và phát tại đây ngay khi hoàn thành!</strong>
      </div>
    `;
  }
  if (previewStatusInfo && previewStatusText) {
    previewStatusInfo.classList.remove("hidden");
    previewStatusText.innerHTML = `⏳ Đang dựng: <strong>${escapeHtml(nameInput || projLabel)}</strong>...`;
  }

  try {
    const engineSelect = document.getElementById("aiEngineSelect");
    const engineOverride = (engineSelect && engineSelect.value !== "auto") ? engineSelect.value : (aiState.manualEngineOverride || null);
    const charSelect = document.getElementById("aiCharacterSelect");
    const characterRenderer = charSelect ? charSelect.value : "white_cartoon";

    const res = await fetch("/api/ai-code/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        compositionId: aiState.selectedCompositionId,
        engineOverride,
        accelerationMode: gpuMode,
        isTest,
        customVideoName: nameInput,
        customResolution: resSelect === "project" ? null : resSelect,
        customFps: fpsSelect === "project" ? null : fpsSelect,
        characterRenderer
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`🚀 ${data.message}`);
    const engineDisplay = data.engineName || "Thanh Hai 2D Studio (Canvas + Three.js)";
    logsContent.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Máy chủ đã nhận lệnh, đang nạp ${engineDisplay}...</div>`;
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

// =========================================================================
// TAB 3: CHARACTER SYSTEM V2 (QUẢN LÝ & DIỄN HOẠT NHÂN VẬT CHIBI 2D)
// =========================================================================

const characterState = {
  characters: [],
  activeCharacter: null,
  filter: "all", // "all" | "builtin" | "imported"
  selectedPartName: null,
  history: [],
  historyIndex: -1,
  // Animation state for Mode B
  anim: {
    action: "idle",
    speed: 1.0,
    loop: true,
    isPlaying: false,
    animFrameId: null,
    time: 0,
    lastTick: 0
  },
  // Viewport for Mode B canvas
  view: {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 }
  },
  // Image cache
  imageCache: {},
  // Import wizard state
  wizard: {
    tab: 1,
    singlePngData: null,
    singlePngImg: null,
    slices: {},
    layeredParts: {},
    spriteSheetImg: null,
    packageFile: null,
    packageData: null
  }
};

// Bộ góc chuẩn của các Action Animation Mode B
const MODE_B_POSE_ANGLES = {
  stand: {
    torso: 0, head: 0,
    upperArm_L: 0, forearm_L: 0, hand_L: 0,
    upperArm_R: 0, forearm_R: 0, hand_R: 0,
    thigh_L: 0, shin_L: 0, foot_L: 0,
    thigh_R: 0, shin_R: 0, foot_R: 0
  },
  idle: (t = 0) => {
    const breathe = Math.sin(t * 3.2) * 1.8;
    return {
      torso: breathe * 0.4,
      head: -breathe * 0.5,
      upperArm_L: breathe * 0.6, forearm_L: 0, hand_L: 0,
      upperArm_R: -breathe * 0.6, forearm_R: 0, hand_R: 0,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  },
  walk: (t = 0, speed = 1.0) => {
    const cycle = t * 6.0 * speed;
    const legL = Math.sin(cycle) * 28;
    const legR = Math.sin(cycle + Math.PI) * 28;
    const armL = Math.sin(cycle + Math.PI) * 24;
    const armR = Math.sin(cycle) * 24;
    const bob = Math.abs(Math.sin(cycle)) * 4;
    return {
      torso: Math.sin(cycle) * 2,
      head: -Math.sin(cycle) * 1.5,
      upperArm_L: armL, forearm_L: Math.max(0, -armL * 0.4), hand_L: 0,
      upperArm_R: armR, forearm_R: Math.max(0, -armR * 0.4), hand_R: 0,
      thigh_L: legL, shin_L: Math.max(0, -legL * 0.7), foot_L: legL * 0.2,
      thigh_R: legR, shin_R: Math.max(0, -legR * 0.7), foot_R: legR * 0.2,
      _bob: bob
    };
  },
  run: (t = 0, speed = 1.0) => {
    const cycle = t * 9.5 * speed;
    const legL = Math.sin(cycle) * 48;
    const legR = Math.sin(cycle + Math.PI) * 48;
    const armL = Math.sin(cycle + Math.PI) * 44;
    const armR = Math.sin(cycle) * 44;
    return {
      torso: 10 + Math.sin(cycle) * 3,
      head: -8 - Math.sin(cycle) * 2,
      upperArm_L: armL, forearm_L: -35 + armL * 0.3, hand_L: 0,
      upperArm_R: armR, forearm_R: -35 + armR * 0.3, hand_R: 0,
      thigh_L: legL, shin_L: Math.max(0, -legL * 0.9), foot_L: 10,
      thigh_R: legR, shin_R: Math.max(0, -legR * 0.9), foot_R: 10
    };
  },
  wave: (t = 0) => {
    const waveHand = Math.sin(t * 12) * 22;
    return {
      torso: 2, head: -3,
      upperArm_L: -125, forearm_L: -40 + waveHand, hand_L: waveHand * 0.5,
      upperArm_R: 5, forearm_R: 5, hand_R: 0,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  },
  point: {
    torso: 4, head: 4,
    upperArm_L: 10, forearm_L: 5, hand_L: 0,
    upperArm_R: -85, forearm_R: -5, hand_R: 0,
    thigh_L: 0, shin_L: 0, foot_L: 0,
    thigh_R: 0, shin_R: 0, foot_R: 0
  },
  sit: {
    torso: -5, head: 5,
    upperArm_L: 20, forearm_L: 60, hand_L: 0,
    upperArm_R: 20, forearm_R: 60, hand_R: 0,
    thigh_L: 80, shin_L: -80, foot_L: 0,
    thigh_R: 80, shin_R: -80, foot_R: 0
  },
  jump: (t = 0) => {
    return {
      torso: -6, head: -4,
      upperArm_L: -120, forearm_L: -30, hand_L: 0,
      upperArm_R: -120, forearm_R: -30, hand_R: 0,
      thigh_L: 45, shin_L: -65, foot_L: 20,
      thigh_R: 45, shin_R: -65, foot_R: 20
    };
  },
  surprised: (t = 0) => {
    const shiver = Math.sin(t * 36) * 3;
    return {
      torso: -8, head: -12 + shiver,
      upperArm_L: -110 + shiver, forearm_L: -40, hand_L: shiver,
      upperArm_R: -110 - shiver, forearm_R: -40, hand_R: -shiver,
      thigh_L: 15, shin_L: -20, foot_L: 5,
      thigh_R: 15, shin_R: -20, foot_R: 5
    };
  },
  talking: (t = 0) => {
    const talkBob = Math.sin(t * 10) * 4;
    return {
      torso: talkBob * 0.3, head: talkBob,
      upperArm_L: 15 + talkBob, forearm_L: 25 - talkBob, hand_L: 0,
      upperArm_R: -20 + talkBob, forearm_R: -45 + talkBob, hand_R: 0,
      thigh_L: 0, shin_L: 0, foot_L: 0,
      thigh_R: 0, shin_R: 0, foot_R: 0
    };
  }
};

// Lọc danh sách nhân vật
function setCharFilter(filter) {
  characterState.filter = filter;
  ["All", "Builtin", "Imported"].forEach(f => {
    const btn = document.getElementById(`filterChar${f}`);
    if (btn) btn.classList.toggle("active", filter.toLowerCase() === f.toLowerCase());
  });
  renderCharacterCards();
}

// Nạp danh sách nhân vật từ máy chủ
async function loadCharacterLibrary() {
  const container = document.getElementById("characterCardsContainer");
  if (!container) return;

  try {
    const res = await fetch("/api/characters");
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    characterState.characters = data.characters || [];
    renderCharacterCards();

    // Chọn nhân vật đầu tiên nếu chưa chọn
    if (!characterState.activeCharacter && characterState.characters.length > 0) {
      selectCharacterForEditing(characterState.characters[0].id);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color: #ef4444;">❌ Lỗi nạp thư viện nhân vật: ${escapeHtml(err.message)}</div>`;
  }
}

// Hiển thị các thẻ nhân vật trong Grid với phân loại Mode A / Mode B
function renderCharacterCards() {
  const container = document.getElementById("characterCardsContainer");
  if (!container) return;

  const all = characterState.characters;
  const builtin = all.filter(c => c.type !== "imported");
  const imported = all.filter(c => c.type === "imported");

  // Cập nhật số lượng
  const countAll = document.getElementById("countCharAll");
  const countBuiltin = document.getElementById("countCharBuiltin");
  const countImported = document.getElementById("countCharImported");
  if (countAll) countAll.textContent = all.length;
  if (countBuiltin) countBuiltin.textContent = builtin.length;
  if (countImported) countImported.textContent = imported.length;

  let displayList = all;
  if (characterState.filter === "builtin") displayList = builtin;
  else if (characterState.filter === "imported") displayList = imported;

  if (displayList.length === 0) {
    container.innerHTML = `<div class="empty-state">Không có nhân vật nào thuộc bộ lọc "${characterState.filter}". Bấm "+ Import Nhân Vật" hoặc "+ Tạo Nhân Vật Mới"!</div>`;
    return;
  }

  container.innerHTML = displayList
    .map((c) => {
      const isSelected = characterState.activeCharacter && characterState.activeCharacter.id === c.id;
      const isImported = c.type === "imported";
      const borderCol = isSelected ? (isImported ? "#10b981" : "#38bdf8") : "#334155";
      const bgCol = isSelected ? (isImported ? "rgba(16, 185, 129, 0.08)" : "rgba(56, 189, 248, 0.08)") : "#1e293b";
      const modeTagBg = isImported ? "#065f46" : "#0f172a";
      const modeTagText = isImported ? "#34d399" : "#38bdf8";
      const modeTagLabel = isImported ? "MODE B: IMPORTED" : "MODE A: BUILT-IN";

      const partCount = isImported && c.parts ? Object.keys(c.parts).length : null;
      const partCountBadge = partCount ? `<span style="font-size: 11px; color: #a7f3d0; background: #064e3b; padding: 2px 6px; border-radius: 4px;">${partCount} bộ phận</span>` : "";

      return `
        <div class="card" style="border: 2px solid ${borderCol}; background-color: ${bgCol}; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${escapeHtml(c.name || c.id)}</div>
              <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">ID: ${escapeHtml(c.id)}</div>
            </div>
            <span class="badge" style="background-color: ${modeTagBg}; color: ${modeTagText}; font-size: 10px; padding: 3px 8px; border: 1px solid ${modeTagText};">
              ${modeTagLabel}
            </span>
          </div>

          <!-- Thumbnail hoặc Color swatches preview -->
          ${
            isImported
              ? `
            <div style="display: flex; gap: 8px; align-items: center; margin: 4px 0;">
              ${c.thumbnail ? `<img src="${c.thumbnail}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px; background: #0f172a;" />` : `<div style="font-size: 20px;">🧩</div>`}
              ${partCountBadge}
              <span style="font-size: 11px; color: #94a3b8; margin-left: auto;">${escapeHtml(c.assetType || "layered_png")}</span>
            </div>`
              : `
            <div style="display: flex; gap: 6px; align-items: center; margin: 4px 0;">
              <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.skinColor || '#FFFDF8'}; border: 1px solid #475569;" title="Màu da"></div>
              <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.hair?.color || '#333'}; border: 1px solid #475569;" title="Màu tóc"></div>
              <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.outfit?.topColor || '#d64a33'}; border: 1px solid #475569;" title="Màu áo"></div>
              <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.outfit?.pantsColor || '#2e384d'}; border: 1px solid #475569;" title="Màu quần"></div>
              <span style="font-size: 11px; color: #94a3b8; margin-left: auto;">${escapeHtml(c.outfit?.type || 'hoodie')}</span>
            </div>`
          }

          <!-- Nút hành động -->
          <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 8px; border-top: 1px solid #334155;">
            <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="selectCharacterForEditing('${c.id}')">✏️ Sửa</button>
            ${isImported ? `<button class="btn btn-sm btn-outline" onclick="exportCharacterById('${c.id}')" title="Xuất gói ZIP">📦</button>` : ""}
            <button class="btn btn-sm btn-outline" onclick="duplicateCharacterById('${c.id}')" title="Nhân bản">📑</button>
            <button class="btn btn-sm btn-outline" style="border-color: #ef4444; color: #ef4444;" onclick="deleteCharacterById('${c.id}')" title="Xóa">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Chọn một nhân vật để hiển thị trên form editor (Tự động chuyển chế độ Mode A / Mode B)
function selectCharacterForEditing(id) {
  const char = characterState.characters.find((c) => c.id === id);
  if (!char) return;

  characterState.activeCharacter = char;
  characterState.history = [JSON.stringify(char)];
  characterState.historyIndex = 0;

  const isImported = char.type === "imported";

  // Cập nhật badges tiêu đề
  const badge = document.getElementById("editingCharacterBadge");
  const modeTag = document.getElementById("editingCharacterModeTag");
  const subtitle = document.getElementById("charEditorModeSubtitle");

  if (badge) badge.textContent = `Đang chọn: ${char.name} (${char.id})`;
  if (modeTag) {
    modeTag.textContent = isImported ? "Mode B: Imported" : "Mode A: Built-in";
    modeTag.style.backgroundColor = isImported ? "#059669" : "#0284c7";
  }
  if (subtitle) {
    subtitle.textContent = isImported
      ? "Chế độ Mode B: Nhân vật nhập ngoài (Visual Canvas Rig Editor, Bones & Hierarchy)"
      : "Chế độ Mode A: Nhân vật dựng sẵn (Chibi / White Cartoon Procedural Rig)";
  }

  // Điền ID & Tên
  const elId = document.getElementById("charEditorId");
  const elName = document.getElementById("charEditorName");
  if (elId) { elId.value = char.id; elId.disabled = true; }
  if (elName) elName.value = char.name || "";

  // Ẩn / hiện container tương ứng
  const modeAEditor = document.getElementById("modeAEditorContainer");
  const modeBEditor = document.getElementById("modeBEditorContainer");
  const modeAPreview = document.getElementById("modeAPreviewControls");
  const modeBPreview = document.getElementById("modeBPreviewControls");
  const liveSvg = document.getElementById("liveCharacterSvg");
  const liveCanvas = document.getElementById("liveModeBCanvas");
  const canvasOverlay = document.getElementById("modeBCanvasOverlay");

  if (isImported) {
    if (modeAEditor) modeAEditor.classList.add("hidden");
    if (modeBEditor) modeBEditor.classList.remove("hidden");
    if (modeAPreview) modeAPreview.classList.add("hidden");
    if (modeBPreview) modeBPreview.classList.remove("hidden");
    if (liveSvg) liveSvg.classList.add("hidden");
    if (liveCanvas) liveCanvas.classList.remove("hidden");
    if (canvasOverlay) canvasOverlay.classList.remove("hidden");

    initModeBEditor(char);
  } else {
    if (modeAEditor) modeAEditor.classList.remove("hidden");
    if (modeBEditor) modeBEditor.classList.add("hidden");
    if (modeAPreview) modeAPreview.classList.remove("hidden");
    if (modeBPreview) modeBPreview.classList.add("hidden");
    if (liveSvg) liveSvg.classList.remove("hidden");
    if (liveCanvas) liveCanvas.classList.add("hidden");
    if (canvasOverlay) canvasOverlay.classList.add("hidden");

    stopModeBAnimLoop();
    initModeAEditor(char);
    updateLivePreview();
  }

  renderCharacterCards();
}

// Khởi tạo Mode A editor
function initModeAEditor(char) {
  const elSkin = document.getElementById("charEditorSkin");
  const elEye = document.getElementById("charEditorEyeStyle");
  const elBlush = document.getElementById("charEditorBlush");
  const elGlasses = document.getElementById("charEditorGlasses");
  const elHairStyle = document.getElementById("charEditorHairStyle");
  const elHairCol = document.getElementById("charEditorHairColor");
  const elOutfit = document.getElementById("charEditorOutfitType");
  const elBottomType = document.getElementById("charEditorBottomType");
  const elShoeType = document.getElementById("charEditorShoeType");
  const elTopCol = document.getElementById("charEditorTopColor");
  const elPantsCol = document.getElementById("charEditorPantsColor");
  const elShoeCol = document.getElementById("charEditorShoeColor");
  const elHeadScale = document.getElementById("charEditorHeadScale");
  const elTorsoLen = document.getElementById("charEditorTorsoLen");

  if (elSkin) elSkin.value = char.skinColor || "#FFFDF8";
  if (elEye) elEye.value = char.face?.eyeStyle || "oval";
  if (elBlush) elBlush.checked = char.face?.blush !== false;
  if (elGlasses) elGlasses.checked = !!char.outfit?.accessories?.includes("glasses");
  if (elHairStyle) elHairStyle.value = char.hair?.style || "short";
  if (elHairCol) elHairCol.value = char.hair?.color || "#4a3728";
  if (elOutfit) elOutfit.value = char.outfit?.type || "hoodie";
  if (elBottomType) elBottomType.value = char.outfit?.bottomType || (char.outfit?.type === "dress" ? "skirt" : "pants");
  if (elShoeType) elShoeType.value = char.outfit?.shoeType || (char.outfit?.type === "suit" ? "casual" : "sneakers");
  if (elTopCol) elTopCol.value = char.outfit?.topColor || "#d64a33";
  if (elPantsCol) elPantsCol.value = char.outfit?.pantsColor || "#2e384d";
  if (elShoeCol) elShoeCol.value = char.outfit?.shoeColor || "#1e1e24";
  if (elHeadScale) {
    elHeadScale.value = char.proportions?.headScale || 1.0;
    const v = document.getElementById("valHeadScale");
    if (v) v.textContent = elHeadScale.value;
  }
  if (elTorsoLen) {
    elTorsoLen.value = char.proportions?.torsoLength || 36;
    const v = document.getElementById("valTorsoLen");
    if (v) v.textContent = elTorsoLen.value;
  }
}

// Khởi tạo Mode B editor (Khung xương, Bộ phận, Biểu cảm, Canvas Rig)
function initModeBEditor(char) {
  renderModeBPartsList(char);
  renderModeBExpressionsGrid(char);

  // Chọn bộ phận đầu tiên (ưu tiên torso hoặc head)
  const partKeys = Object.keys(char.parts || {});
  const defaultPart = partKeys.includes("torso") ? "torso" : partKeys[0] || null;
  selectModeBPart(defaultPart);

  // Thiết lập canvas sự kiện tương tác chuột
  setupModeBCanvasEvents();

  // Bắt đầu vòng lặp render canvas
  startModeBAnimLoop();
}

// Hiển thị danh sách các bộ phận Mode B
function renderModeBPartsList(char) {
  const container = document.getElementById("modeBPartsList");
  if (!container) return;

  const parts = char.parts || {};
  const partKeys = Object.keys(parts);

  if (partKeys.length === 0) {
    container.innerHTML = '<div style="color: #94a3b8; font-size: 12px; padding: 6px;">Chưa có bộ phận nào.</div>';
    return;
  }

  container.innerHTML = partKeys
    .map(key => {
      const p = parts[key];
      const isSelected = characterState.selectedPartName === key;
      const activeClass = isSelected ? "mode-b-part-item active" : "mode-b-part-item";
      const parentName = p.parent || "root";
      const z = p.zIndex ?? 0;

      return `
        <div class="${activeClass}" onclick="selectModeBPart('${key}')">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="color: #38bdf8;">🦴</span>
            <span style="color: #f8fafc; font-size: 12px;">${key}</span>
            <span style="font-size: 10px; color: #94a3b8;">(cha: ${parentName})</span>
          </div>
          <span style="font-size: 10px; color: #a7f3d0; background: #064e3b; padding: 1px 5px; border-radius: 3px;">z: ${z}</span>
        </div>
      `;
    })
    .join("");
}

// Chọn một bộ phận trong Mode B để điều chỉnh thông số
function selectModeBPart(partName) {
  characterState.selectedPartName = partName;
  const char = characterState.activeCharacter;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  const part = char.parts[partName];

  // Cập nhật tên
  const nameEl = document.getElementById("modeBSelectedPartName");
  if (nameEl) nameEl.textContent = `Bộ phận: ${partName}`;

  // Cập nhật dropdown parent
  const parentSelect = document.getElementById("modeBPartParentSelect");
  if (parentSelect) {
    const allParts = Object.keys(char.parts);
    parentSelect.innerHTML = `<option value="root">root (gốc sàn)</option>` +
      allParts.filter(p => p !== partName).map(p => `<option value="${p}">${p}</option>`).join("");
    parentSelect.value = part.parent || "root";
  }

  // Cập nhật góc quay slider
  const angleSlider = document.getElementById("modeBPartAngleSlider");
  const valAngle = document.getElementById("valModeBAngle");
  const angle = part.rotation ?? 0;
  if (angleSlider) angleSlider.value = angle;
  if (valAngle) valAngle.textContent = `${angle}°`;

  // Cập nhật Pivot & Pos
  const pivotX = document.getElementById("modeBPivotX");
  const pivotY = document.getElementById("modeBPivotY");
  const posX = document.getElementById("modeBPosX");
  const posY = document.getElementById("modeBPosY");

  if (pivotX) pivotX.value = part.pivot ? part.pivot[0] : 0;
  if (pivotY) pivotY.value = part.pivot ? part.pivot[1] : 0;
  if (posX) posX.value = part.position ? part.position[0] : 0;
  if (posY) posY.value = part.position ? part.position[1] : 0;

  renderModeBPartsList(char);
  drawModeBRigCanvas();
}

// Đổi góc xoay bộ phận Mode B
function onModeBPartAngleInput(val) {
  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  const angle = parseInt(val, 10) || 0;
  char.parts[partName].rotation = angle;
  const valAngle = document.getElementById("valModeBAngle");
  if (valAngle) valAngle.textContent = `${angle}°`;

  pushModeBHistory();
  drawModeBRigCanvas();
}

// Đổi cha của bộ phận
function onModeBPartParentChanged(newParent) {
  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  char.parts[partName].parent = newParent;
  pushModeBHistory();
  renderModeBPartsList(char);
  drawModeBRigCanvas();
}

// Đổi Pivot
function onModeBPivotChanged() {
  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  const px = parseFloat(document.getElementById("modeBPivotX")?.value) || 0;
  const py = parseFloat(document.getElementById("modeBPivotY")?.value) || 0;
  char.parts[partName].pivot = [px, py];

  pushModeBHistory();
  drawModeBRigCanvas();
}

// Đổi Vị trí (Position)
function onModeBPosChanged() {
  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  const x = parseFloat(document.getElementById("modeBPosX")?.value) || 0;
  const y = parseFloat(document.getElementById("modeBPosY")?.value) || 0;
  char.parts[partName].position = [x, y];

  pushModeBHistory();
  drawModeBRigCanvas();
}

// Thay đổi thứ tự lớp Z-Order của bộ phận
function changePartZOrder(delta) {
  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !char.parts || !partName || !char.parts[partName]) return;

  char.parts[partName].zIndex = (char.parts[partName].zIndex ?? 0) + delta;
  pushModeBHistory();
  renderModeBPartsList(char);
  drawModeBRigCanvas();
}

// Đặt lại T-Pose chuẩn
function resetModeBTPose() {
  const char = characterState.activeCharacter;
  if (!char || !char.parts) return;

  Object.values(char.parts).forEach(p => {
    p.rotation = 0;
  });

  const angleSlider = document.getElementById("modeBPartAngleSlider");
  const valAngle = document.getElementById("valModeBAngle");
  if (angleSlider) angleSlider.value = 0;
  if (valAngle) valAngle.textContent = "0°";

  pushModeBHistory();
  showToast("↺ Đã đặt lại tư thế chuẩn T-Pose.");
  drawModeBRigCanvas();
}

// Quản lý Undo / Redo cho Rig
function pushModeBHistory() {
  const char = characterState.activeCharacter;
  if (!char) return;
  const snap = JSON.stringify(char);
  if (characterState.historyIndex < characterState.history.length - 1) {
    characterState.history = characterState.history.slice(0, characterState.historyIndex + 1);
  }
  characterState.history.push(snap);
  if (characterState.history.length > 30) characterState.history.shift();
  characterState.historyIndex = characterState.history.length - 1;
}

function undoModeBRig() {
  if (characterState.historyIndex > 0) {
    characterState.historyIndex--;
    const prev = JSON.parse(characterState.history[characterState.historyIndex]);
    Object.assign(characterState.activeCharacter, prev);
    selectModeBPart(characterState.selectedPartName);
    showToast("↶ Đã hoàn tác.");
  }
}

function redoModeBRig() {
  if (characterState.historyIndex < characterState.history.length - 1) {
    characterState.historyIndex++;
    const next = JSON.parse(characterState.history[characterState.historyIndex]);
    Object.assign(characterState.activeCharacter, next);
    selectModeBPart(characterState.selectedPartName);
    showToast("↷ Đã làm lại.");
  }
}

// Thay ảnh của một bộ phận qua file picker
async function onModeBReplaceImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const char = characterState.activeCharacter;
  const partName = characterState.selectedPartName;
  if (!char || !partName) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    try {
      const res = await fetch("/api/characters/upload-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          partName,
          base64Data,
          filename: file.name
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      char.parts[partName].assetUrl = data.assetUrl;
      // Xóa cache ảnh cũ để nạp ảnh mới
      delete characterState.imageCache[data.assetUrl];
      pushModeBHistory();
      showToast(`🖼️ Đã thay ảnh cho bộ phận "${partName}"!`);
      drawModeBRigCanvas();
    } catch (err) {
      showToast("❌ Lỗi thay ảnh: " + err.message);
    }
  };
  reader.readAsDataURL(file);
}

// Hiển thị 8 Expression Slots cho Mode B
function renderModeBExpressionsGrid(char) {
  const container = document.getElementById("modeBExpressionsGrid");
  if (!container) return;

  const expressions = char.expressions || {};
  const standardExprs = ["neutral", "happy", "sad", "angry", "surprised", "scared", "thinking", "talking"];

  container.innerHTML = standardExprs
    .map(expr => {
      const asset = expressions[expr] || char.parts?.head?.assetUrl || "";
      const isActive = (char.defaultExpression || "neutral") === expr;
      const activeClass = isActive ? "expr-slot-card active" : "expr-slot-card";

      return `
        <div class="${activeClass}" onclick="setModeBActiveExpression('${expr}')">
          <span style="font-size: 11px; font-weight: 700; color: #f8fafc;">${expr}</span>
          ${asset ? `<img src="${asset}" class="expr-slot-thumb" />` : `<div class="expr-slot-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 14px;">😊</div>`}
          <button class="btn btn-sm btn-outline" style="font-size: 9px; padding: 1px 4px; border-color: #475569;" onclick="event.stopPropagation(); triggerReplaceExpression('${expr}')">Thay</button>
        </div>
      `;
    })
    .join("");
}

function setModeBActiveExpression(expr) {
  const char = characterState.activeCharacter;
  if (!char) return;
  char.defaultExpression = expr;
  const select = document.getElementById("modeBExprSelect");
  if (select) select.value = expr;
  renderModeBExpressionsGrid(char);
  drawModeBRigCanvas();
}

function onModeBExprChanged(val) {
  setModeBActiveExpression(val);
}

function triggerReplaceExpression(expr) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/webp";
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const char = characterState.activeCharacter;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await fetch("/api/characters/upload-part", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: char.id,
            partName: `expr_${expr}`,
            base64Data: ev.target.result,
            filename: file.name
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        if (!char.expressions) char.expressions = {};
        char.expressions[expr] = data.assetUrl;
        delete characterState.imageCache[data.assetUrl];
        pushModeBHistory();
        renderModeBExpressionsGrid(char);
        drawModeBRigCanvas();
        showToast(`😊 Đã cập nhật ảnh biểu cảm "${expr}"!`);
      } catch (err) {
        showToast("❌ Lỗi cập nhật biểu cảm: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

// Điều khiển diễn hoạt (Action Animation) Mode B
function onModeBActionChanged(action) {
  characterState.anim.action = action;
  drawModeBRigCanvas();
}

function onModeBSpeedChanged(speed) {
  characterState.anim.speed = parseFloat(speed) || 1.0;
}

function togglePlayModeBAnim() {
  characterState.anim.isPlaying = !characterState.anim.isPlaying;
  const btn = document.getElementById("btnPlayModeBAnim");
  if (btn) {
    btn.textContent = characterState.anim.isPlaying ? "⏸ Tạm dừng" : "▶ Phát chuyển động";
    btn.className = characterState.anim.isPlaying ? "btn btn-sm btn-secondary" : "btn btn-sm btn-primary";
  }
}

function startModeBAnimLoop() {
  stopModeBAnimLoop();
  characterState.anim.lastTick = performance.now();

  function loop(now) {
    const dt = (now - characterState.anim.lastTick) / 1000;
    characterState.anim.lastTick = now;

    if (characterState.anim.isPlaying) {
      characterState.anim.time += dt * characterState.anim.speed;
      drawModeBRigCanvas();
    }
    characterState.anim.animFrameId = requestAnimationFrame(loop);
  }
  characterState.anim.animFrameId = requestAnimationFrame(loop);
}

function stopModeBAnimLoop() {
  if (characterState.anim.animFrameId) {
    cancelAnimationFrame(characterState.anim.animFrameId);
    characterState.anim.animFrameId = null;
  }
}

// =========================================================================
// CANVAS RIG RENDERER CHO MODE B (FORWARD KINEMATICS & GIZMOS)
// =========================================================================

function setupModeBCanvasEvents() {
  const canvas = document.getElementById("liveModeBCanvas");
  if (!canvas || canvas._hasEvents) return;
  canvas._hasEvents = true;

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    zoomModeBCanvas(factor);
  });

  canvas.addEventListener("mousedown", (e) => {
    characterState.view.isDragging = true;
    characterState.view.dragStart = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mousemove", (e) => {
    if (!characterState.view.isDragging) return;
    const dx = e.clientX - characterState.view.dragStart.x;
    const dy = e.clientY - characterState.view.dragStart.y;
    characterState.view.panX += dx;
    characterState.view.panY += dy;
    characterState.view.dragStart = { x: e.clientX, y: e.clientY };
    drawModeBRigCanvas();
  });

  window.addEventListener("mouseup", () => {
    characterState.view.isDragging = false;
  });
}

function zoomModeBCanvas(factor) {
  characterState.view.zoom = Math.max(0.3, Math.min(4.0, characterState.view.zoom * factor));
  drawModeBRigCanvas();
}

function resetModeBCanvasView() {
  characterState.view.zoom = 1.0;
  characterState.view.panX = 0;
  characterState.view.panY = 0;
  drawModeBRigCanvas();
}

// Nạp ảnh cache
function getModeBCachedImage(url) {
  if (!url) return null;
  if (characterState.imageCache[url]) return characterState.imageCache[url];

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  img.onload = () => drawModeBRigCanvas();
  characterState.imageCache[url] = img;
  return img;
}

// Vẽ toàn bộ Rig và nhân vật Mode B lên Canvas
function drawModeBRigCanvas() {
  const canvas = document.getElementById("liveModeBCanvas");
  if (!canvas || canvas.classList.contains("hidden")) return;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Lưới nền mờ (Checkerboard)
  ctx.save();
  const gridSize = 24;
  for (let x = 0; x < W; x += gridSize) {
    for (let y = 0; y < H; y += gridSize) {
      if ((Math.floor(x / gridSize) + Math.floor(y / gridSize)) % 2 === 0) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
        ctx.fillRect(x, y, gridSize, gridSize);
      }
    }
  }

  // Mặt sàn tham chiếu (Ground Line)
  const groundY = H * 0.78 + characterState.view.panY;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(W, groundY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const char = characterState.activeCharacter;
  if (!char || !char.parts) return;

  const parts = char.parts;
  const partKeys = Object.keys(parts);
  if (partKeys.length === 0) return;

  const zoom = characterState.view.zoom;
  const centerX = W / 2 + characterState.view.panX;
  const centerY = groundY;

  // Lấy góc quay từ Action animation hiện tại
  const action = characterState.anim.action || "idle";
  const t = characterState.anim.time;
  let actionAngles = MODE_B_POSE_ANGLES.stand;

  if (typeof MODE_B_POSE_ANGLES[action] === "function") {
    actionAngles = MODE_B_POSE_ANGLES[action](t, characterState.anim.speed);
  } else if (MODE_B_POSE_ANGLES[action]) {
    actionAngles = MODE_B_POSE_ANGLES[action];
  }

  // 1. Giải hệ FK (Forward Kinematics) từ gốc sàn
  const worldTransforms = {};
  const computed = new Set();

  function computePartTransform(pName) {
    if (computed.has(pName)) return worldTransforms[pName];
    const part = parts[pName];
    if (!part) return null;

    const parentName = part.parent || "root";
    let parentM = { x: 0, y: 0, rotation: 0 };

    if (parentName !== "root" && parts[parentName]) {
      parentM = computePartTransform(parentName) || parentM;
    }

    const localX = part.position ? part.position[0] : 0;
    const localY = part.position ? part.position[1] : 0;
    const baseRot = (part.rotation ?? 0) * (Math.PI / 180);
    const actionRot = ((actionAngles[pName] ?? 0) * Math.PI) / 180;
    const localRot = baseRot + actionRot;

    // Chiếu tọa độ local qua góc xoay của cha
    const cosP = Math.cos(parentM.rotation);
    const sinP = Math.sin(parentM.rotation);
    const wx = parentM.x + (localX * cosP - localY * sinP);
    const wy = parentM.y + (localX * sinP + localY * cosP);
    const wRot = parentM.rotation + localRot;

    worldTransforms[pName] = {
      x: wx,
      y: wy,
      rotation: wRot,
      parentPivot: [parentM.x, parentM.y],
      pivot: part.pivot || [0, 0]
    };
    computed.add(pName);
    return worldTransforms[pName];
  }

  partKeys.forEach(computePartTransform);

  // 2. Sắp xếp bộ phận theo Z-Index
  const sortedParts = [...partKeys].sort((a, b) => (parts[a].zIndex ?? 0) - (parts[b].zIndex ?? 0));

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);

  // Vẽ bóng tiếp xúc
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 45, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Render từng bộ phận
  sortedParts.forEach(pName => {
    const part = parts[pName];
    const tf = worldTransforms[pName];
    if (!part || !tf) return;

    // Nếu là head và có biểu cảm thay thế
    let assetUrl = part.assetUrl;
    if (pName === "head" && char.expressions && char.defaultExpression) {
      if (char.expressions[char.defaultExpression]) {
        assetUrl = char.expressions[char.defaultExpression];
      }
    }

    const img = getModeBCachedImage(assetUrl);

    ctx.save();
    ctx.translate(tf.x, tf.y);
    ctx.rotate(tf.rotation);

    const pvX = part.pivot ? part.pivot[0] : 0;
    const pvY = part.pivot ? part.pivot[1] : 0;

    if (img && img.complete && img.naturalWidth > 0) {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      ctx.drawImage(img, -pvX, -pvY, w, h);

      // Nếu đang được chọn -> vẽ viền highlight
      if (characterState.selectedPartName === pName) {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(-pvX, -pvY, w, h);
        ctx.setLineDash([]);
      }
    } else {
      // Fallback khối chữ nhật tượng trưng
      ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-pvX, -pvY, 40, 40);
      ctx.strokeRect(-pvX, -pvY, 40, 40);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.fillText(pName, -pvX + 4, -pvY + 16);
    }

    // Điểm Pivot đỏ
    if (characterState.selectedPartName === pName) {
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(0, 0, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(-7 / zoom, 0); ctx.lineTo(7 / zoom, 0);
      ctx.moveTo(0, -7 / zoom); ctx.lineTo(0, 7 / zoom);
      ctx.stroke();
    }

    ctx.restore();
  });

  // 4. Vẽ Khung xương & Khớp liên kết (Bones & Joint Lines) nếu được bật
  const showBones = !!document.getElementById("modeBShowBonesToggle")?.checked;
  if (showBones) {
    ctx.save();
    partKeys.forEach(pName => {
      const tf = worldTransforms[pName];
      const part = parts[pName];
      if (!tf || !part || part.parent === "root") return;

      const pTf = worldTransforms[part.parent];
      if (!pTf) return;

      // Đường xương nối từ cha sang con
      ctx.strokeStyle = "rgba(6, 182, 212, 0.75)";
      ctx.lineWidth = 2.5 / zoom;
      ctx.beginPath();
      ctx.moveTo(pTf.x, pTf.y);
      ctx.lineTo(tf.x, tf.y);
      ctx.stroke();

      // Khớp tròn
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(tf.x, tf.y, 3 / zoom, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  ctx.restore();
}

// =========================================================================
// CHARACTER IMPORT WIZARD (MODE B)
// =========================================================================

function openImportModal() {
  const modal = document.getElementById("characterImportModal");
  if (modal) modal.classList.remove("hidden");
  switchImportWizardTab(1);
  renderLayeredPartsSlots();
}

function closeImportModal() {
  const modal = document.getElementById("characterImportModal");
  if (modal) modal.classList.add("hidden");
}

function switchImportWizardTab(tabIdx) {
  characterState.wizard.tab = tabIdx;
  for (let i = 1; i <= 4; i++) {
    const btn = document.getElementById(`importTabBtn${i}`);
    const pane = document.getElementById(`importWizardPane${i}`);
    if (btn) btn.classList.toggle("active", i === tabIdx);
    if (pane) pane.classList.toggle("hidden", i !== tabIdx);
  }
}

// TAB 1: Xử lý PNG Nguyên Khối & Cắt Bounding Box
function handleSinglePngSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    characterState.wizard.singlePngData = e.target.result;
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      characterState.wizard.singlePngImg = img;
      renderSinglePngCanvas();
    };
  };
  reader.readAsDataURL(file);
}

function renderSinglePngCanvas() {
  const canvas = document.getElementById("singlePngCanvas");
  const img = characterState.wizard.singlePngImg;
  if (!canvas || !img) return;

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  // Vẽ các hộp cắt lát bộ phận (Head, Torso, Arms, Legs)
  const W = canvas.width;
  const H = canvas.height;
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 6]);

  // Head: top 32%
  ctx.strokeRect(W * 0.22, 0, W * 0.56, H * 0.32);
  // Torso: 32% - 65%
  ctx.strokeRect(W * 0.28, H * 0.32, W * 0.44, H * 0.33);
  // Limbs: bottom 35%
  ctx.strokeRect(W * 0.15, H * 0.65, W * 0.70, H * 0.35);
  ctx.setLineDash([]);
}

function autoSliceSinglePng() {
  const img = characterState.wizard.singlePngImg;
  if (!img) {
    showToast("Vui lòng tải lên ảnh PNG nhân vật trước.");
    return;
  }

  // Tách 4 bộ phận cơ bản: head, torso, arm, leg từ ảnh gốc
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const slices = {};

  function extractSlice(x, y, w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    g.drawImage(img, x, y, w, h, 0, 0, w, h);
    return c.toDataURL("image/png");
  }

  slices.head = {
    data: extractSlice(W * 0.22, 0, W * 0.56, H * 0.32),
    pivot: [Math.round(W * 0.28), Math.round(H * 0.30)],
    position: [0, -145],
    parent: "torso"
  };
  slices.torso = {
    data: extractSlice(W * 0.28, H * 0.32, W * 0.44, H * 0.33),
    pivot: [Math.round(W * 0.22), Math.round(H * 0.30)],
    position: [0, -60],
    parent: "root"
  };
  slices.thigh_L = {
    data: extractSlice(W * 0.22, H * 0.65, W * 0.26, H * 0.35),
    pivot: [Math.round(W * 0.13), 0],
    position: [-14, -60],
    parent: "torso"
  };
  slices.thigh_R = {
    data: extractSlice(W * 0.52, H * 0.65, W * 0.26, H * 0.35),
    pivot: [Math.round(W * 0.13), 0],
    position: [14, -60],
    parent: "torso"
  };

  characterState.wizard.slices = slices;
  showToast("✂️ Đã tự động nhận diện và cắt lát thành công 4 bộ phận chính!");
}

// TAB 2: Nhân Vật Tách Lớp (Multi-part Slots)
const STANDARD_PART_SLOTS = [
  { id: "head", label: "Đầu (Head)", parent: "torso", pivot: [28, 55], pos: [0, -140], z: 10 },
  { id: "torso", label: "Thân (Torso)", parent: "root", pivot: [25, 45], pos: [0, -60], z: 5 },
  { id: "upperArm_L", label: "Bắp tay T (Arm L)", parent: "torso", pivot: [8, 8], pos: [-22, -125], z: 1 },
  { id: "forearm_L", label: "Cẳng tay T", parent: "upperArm_L", pivot: [6, 6], pos: [0, 42], z: 2 },
  { id: "hand_L", label: "Bàn tay T", parent: "forearm_L", pivot: [6, 6], pos: [0, 36], z: 3 },
  { id: "upperArm_R", label: "Bắp tay P (Arm R)", parent: "torso", pivot: [8, 8], pos: [22, -125], z: 15 },
  { id: "forearm_R", label: "Cẳng tay P", parent: "upperArm_R", pivot: [6, 6], pos: [0, 42], z: 16 },
  { id: "hand_R", label: "Bàn tay P", parent: "forearm_R", pivot: [6, 6], pos: [0, 36], z: 17 },
  { id: "thigh_L", label: "Đùi Trái", parent: "torso", pivot: [10, 8], pos: [-14, -60], z: 2 },
  { id: "shin_L", label: "Cẳng chân T", parent: "thigh_L", pivot: [8, 6], pos: [0, 44], z: 2 },
  { id: "foot_L", label: "Bàn chân T", parent: "shin_L", pivot: [8, 6], pos: [0, 38], z: 2 },
  { id: "thigh_R", label: "Đùi Phải", parent: "torso", pivot: [10, 8], pos: [14, -60], z: 6 },
  { id: "shin_R", label: "Cẳng chân P", parent: "thigh_R", pivot: [8, 6], pos: [0, 44], z: 6 },
  { id: "foot_R", label: "Bàn chân P", parent: "shin_R", pivot: [8, 6], pos: [0, 38], z: 6 }
];

function renderLayeredPartsSlots() {
  const container = document.getElementById("layeredPartsSlotsGrid");
  if (!container) return;

  const parts = characterState.wizard.layeredParts || {};

  container.innerHTML = STANDARD_PART_SLOTS
    .map(slot => {
      const data = parts[slot.id];
      const filledClass = data ? "part-slot-card filled" : "part-slot-card";

      return `
        <div class="${filledClass}" onclick="triggerUploadSlotPart('${slot.id}')">
          <span style="font-size: 11px; font-weight: 700; color: #f8fafc;">${slot.label}</span>
          ${data ? `<img src="${data}" class="part-slot-thumb" />` : `<div class="part-slot-thumb" style="display: flex; align-items: center; justify-content: center; font-size: 18px; color: #64748b;">+</div>`}
          <span style="font-size: 10px; color: ${data ? '#34d399' : '#94a3b8'};">${data ? '✓ Đã nạp' : 'Chưa nạp'}</span>
        </div>
      `;
    })
    .join("");
}

function triggerUploadSlotPart(partId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/webp";
  input.onchange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      if (!characterState.wizard.layeredParts) characterState.wizard.layeredParts = {};
      characterState.wizard.layeredParts[partId] = ev.target.result;
      renderLayeredPartsSlots();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function loadDefaultTemplateParts() {
  // Tạo ảnh mẫu SVG hình học sạch bo tròn cho các bộ phận
  function createPartBlob(w, h, drawFn) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    drawFn(g, w, h);
    return c.toDataURL("image/png");
  }

  const p = {};
  // Head: đầu tròn trắng ngà viền đen
  p.head = createPartBlob(70, 70, (g, w, h) => {
    g.fillStyle = "#FFFDF8"; g.strokeStyle = "#20202A"; g.lineWidth = 4;
    g.beginPath(); g.arc(35, 35, 30, 0, Math.PI * 2); g.fill(); g.stroke();
    // Eyes
    g.fillStyle = "#20202A";
    g.beginPath(); g.arc(28, 34, 3.5, 0, Math.PI * 2); g.arc(44, 34, 3.5, 0, Math.PI * 2); g.fill();
    // Smile
    g.beginPath(); g.arc(36, 42, 6, 0.2, Math.PI - 0.2); g.stroke();
  });

  // Torso: thân áo hoodie đỏ cam
  p.torso = createPartBlob(60, 70, (g, w, h) => {
    g.fillStyle = "#d64a33"; g.strokeStyle = "#20202A"; g.lineWidth = 4;
    g.beginPath(); g.roundRect(10, 8, 40, 54, 8); g.fill(); g.stroke();
  });

  // Limbs
  const armBlob = createPartBlob(24, 50, (g, w, h) => {
    g.fillStyle = "#FFFDF8"; g.strokeStyle = "#20202A"; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(4, 4, 16, 42, 8); g.fill(); g.stroke();
  });
  p.upperArm_L = armBlob; p.upperArm_R = armBlob;
  p.forearm_L = armBlob; p.forearm_R = armBlob;

  const legBlob = createPartBlob(26, 55, (g, w, h) => {
    g.fillStyle = "#2e384d"; g.strokeStyle = "#20202A"; g.lineWidth = 3.5;
    g.beginPath(); g.roundRect(4, 4, 18, 46, 8); g.fill(); g.stroke();
  });
  p.thigh_L = legBlob; p.thigh_R = legBlob;
  p.shin_L = legBlob; p.shin_R = legBlob;

  const footBlob = createPartBlob(36, 22, (g, w, h) => {
    g.fillStyle = "#111827"; g.strokeStyle = "#20202A"; g.lineWidth = 3;
    g.beginPath(); g.roundRect(4, 4, 28, 14, 4); g.fill(); g.stroke();
  });
  p.foot_L = footBlob; p.foot_R = footBlob;

  characterState.wizard.layeredParts = p;
  renderLayeredPartsSlots();
  showToast("⚡ Đã nạp thành công bộ phận mẫu White Cartoon!");
}

// TAB 3: Sprite Sheet
function handleSpriteSheetSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.src = e.target.result;
    img.onload = () => {
      characterState.wizard.spriteSheetImg = img;
      updateSpriteSheetPreview();
    };
  };
  reader.readAsDataURL(file);
}

function updateSpriteSheetPreview() {
  const canvas = document.getElementById("spritePreviewCanvas");
  const img = characterState.wizard.spriteSheetImg;
  if (!canvas || !img) return;

  const cols = parseInt(document.getElementById("spriteColsInput")?.value, 10) || 4;
  const rows = parseInt(document.getElementById("spriteRowsInput")?.value, 10) || 2;
  const total = parseInt(document.getElementById("spriteTotalFramesInput")?.value, 10) || 8;
  const fps = parseInt(document.getElementById("spriteFpsInput")?.value, 10) || 12;

  const fw = img.naturalWidth / cols;
  const fh = img.naturalHeight / rows;

  canvas.width = 160;
  canvas.height = Math.round(160 * (fh / fw));
  const ctx = canvas.getContext("2d");

  let currentFrame = 0;
  if (canvas._animId) clearInterval(canvas._animId);

  canvas._animId = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const col = currentFrame % cols;
    const row = Math.floor(currentFrame / cols);
    ctx.drawImage(img, col * fw, row * fh, fw, fh, 0, 0, canvas.width, canvas.height);
    currentFrame = (currentFrame + 1) % total;
  }, 1000 / fps);
}

// TAB 4: Gói Nhân Vật (.zip / .json)
function handlePackageFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  characterState.wizard.packageFile = file;

  const infoBox = document.getElementById("packagePreviewInfo");
  const nameEl = document.getElementById("packageCharName");
  const detailsEl = document.getElementById("packageCharDetails");

  if (infoBox) infoBox.classList.remove("hidden");
  if (nameEl) nameEl.textContent = `Tệp: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  if (detailsEl) detailsEl.textContent = `Sẵn sàng nhập gói nhân vật "${file.name}". Nhấn nút Xác Nhận bên dưới để tiến hành nạp.`;
}

// Xác nhận tạo nhân vật từ Wizard
async function confirmImportCharacter() {
  const nameInput = document.getElementById("importCharNameInput");
  const charName = nameInput?.value.trim() || `Imported_${Math.floor(100 + Math.random() * 900)}`;
  const charId = charName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");

  const tab = characterState.wizard.tab;

  try {
    if (tab === 4) {
      // Nhập qua gói ZIP / JSON
      const file = characterState.wizard.packageFile;
      if (!file) {
        showToast("Vui lòng chọn file gói nhân vật (.zip hoặc .json)");
        return;
      }
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target.result;
        const res = await fetch("/api/characters/import-package", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Data, filename: file.name })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        showToast(`🎉 ${data.message}`);
        closeImportModal();
        await loadCharacterLibrary();
        selectCharacterForEditing(data.character.id);
      };
      reader.readAsDataURL(file);
      return;
    }

    // Tab 1 hoặc Tab 2 hoặc Tab 3
    let rawParts = {};
    if (tab === 1) {
      if (Object.keys(characterState.wizard.slices).length === 0) {
        autoSliceSinglePng();
      }
      rawParts = characterState.wizard.slices;
    } else if (tab === 2) {
      const partsData = characterState.wizard.layeredParts || {};
      if (Object.keys(partsData).length === 0) {
        showToast("Vui lòng nạp ít nhất một bộ phận hoặc dùng 'Dùng bộ phận mẫu'!");
        return;
      }
      STANDARD_PART_SLOTS.forEach(slot => {
        if (partsData[slot.id]) {
          rawParts[slot.id] = {
            data: partsData[slot.id],
            pivot: slot.pivot,
            position: slot.pos,
            parent: slot.parent,
            zIndex: slot.z
          };
        }
      });
    } else if (tab === 3) {
      const img = characterState.wizard.spriteSheetImg;
      if (!img) {
        showToast("Vui lòng chọn ảnh Sprite Sheet!");
        return;
      }
      rawParts.sprite = {
        data: img.src,
        pivot: [Math.round(img.naturalWidth / 8), Math.round(img.naturalHeight / 4)],
        position: [0, -60],
        parent: "root"
      };
    }

    // Tải các bộ phận lên server qua /api/characters/upload-batch
    showToast("⏳ Đang tải lên các bộ phận nhân vật...");
    const uploadRes = await fetch("/api/characters/upload-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: charId, parts: rawParts })
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success) throw new Error(uploadData.error);

    // Tạo cấu trúc nhân vật Mode B hoàn chỉnh
    const newChar = {
      id: charId,
      name: charName,
      type: "imported",
      assetType: tab === 1 ? "single_png" : tab === 3 ? "sprite_sheet" : "layered_png",
      thumbnail: uploadData.uploadedParts?.head?.assetUrl || uploadData.uploadedParts?.torso?.assetUrl || Object.values(uploadData.uploadedParts || {})[0]?.assetUrl || "",
      parts: uploadData.uploadedParts || {},
      expressions: {
        neutral: uploadData.uploadedParts?.head?.assetUrl || "",
        happy: uploadData.uploadedParts?.head?.assetUrl || ""
      },
      animations: {
        idle: { loop: true, speed: 1.0 },
        walk: { loop: true, speed: 1.0 },
        wave: { loop: true, speed: 1.0 }
      },
      defaultExpression: "neutral",
      defaultFacing: "three_quarter_right"
    };

    // Lưu vào thư viện
    const saveRes = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newChar)
    });
    const saveData = await saveRes.json();
    if (!saveData.success) throw new Error(saveData.error);

    showToast(`🎉 Đã nhập thành công nhân vật Mode B: "${charName}"!`);
    closeImportModal();
    await loadCharacterLibrary();
    selectCharacterForEditing(charId);
  } catch (err) {
    showToast("❌ Lỗi nhập nhân vật: " + err.message);
  }
}

// Bắt đầu tạo một nhân vật hoàn toàn mới (Mode A)
function createNewCharacter() {
  const newId = `hero_${Math.floor(1000 + Math.random() * 9000)}`;
  const newChar = {
    id: newId,
    name: "Nhân Vật Mới",
    type: "builtin",
    skinColor: "#FFFDF8",
    hair: { style: "none", color: "#343536", highlight: "#5a5b5c" },
    face: { eyeStyle: "oval", eyeColor: "#111116", browStyle: "soft", mouthStyle: "smile", blush: true },
    proportions: { headScale: 1.0, torsoLength: 36, armLength: 34, legLength: 46 },
    outfit: { id: "outfit_casual", type: "hoodie", topColor: "#d64a33", pantsColor: "#2e384d", shoeColor: "#111827", shoeType: "sneakers", accessories: [] },
    defaultExpression: "neutral",
    defaultFacing: "three_quarter_right"
  };

  characterState.characters.unshift(newChar);
  characterState.activeCharacter = newChar;

  const elId = document.getElementById("charEditorId");
  if (elId) elId.disabled = false;

  selectCharacterForEditing(newId);
  showToast(`✨ Bắt đầu thiết lập nhân vật mới: ${newId}`);
}

// Khi tên nhân vật thay đổi
function onCharacterNameChanged() {
  const name = document.getElementById("charEditorName")?.value || "";
  if (characterState.activeCharacter) {
    characterState.activeCharacter.name = name;
    renderCharacterCards();
  }
}

// Lưu nhân vật đang chỉnh sửa lên máy chủ (Tự động thích ứng Mode A / Mode B)
async function saveCurrentEditingCharacter() {
  const elId = document.getElementById("charEditorId");
  const elName = document.getElementById("charEditorName");
  if (!elId || !elId.value.trim()) {
    showToast("Vui lòng nhập ID nhân vật!");
    return;
  }

  const active = characterState.activeCharacter;
  let charData;

  if (active && active.type === "imported") {
    // Mode B: Lưu nguyên vẹn cấu trúc imported rig
    active.name = elName?.value.trim() || elId.value.trim();
    charData = active;
  } else {
    // Mode A: Thu thập từ các trường form Mode A
    charData = {
      id: elId.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
      name: elName?.value.trim() || elId.value.trim(),
      type: "builtin",
      skinColor: document.getElementById("charEditorSkin")?.value || "#FFFDF8",
      hair: {
        style: document.getElementById("charEditorHairStyle")?.value || "short",
        color: document.getElementById("charEditorHairColor")?.value || "#4a3728",
        highlight: "#7a5c43"
      },
      face: {
        eyeStyle: document.getElementById("charEditorEyeStyle")?.value || "oval",
        eyeColor: "#111116",
        browStyle: "soft",
        mouthStyle: "smile",
        blush: !!document.getElementById("charEditorBlush")?.checked
      },
      proportions: {
        headScale: parseFloat(document.getElementById("charEditorHeadScale")?.value) || 1.0,
        torsoLength: parseInt(document.getElementById("charEditorTorsoLen")?.value, 10) || 36,
        armLength: 34,
        legLength: 46
      },
      outfit: {
        type: document.getElementById("charEditorOutfitType")?.value || "hoodie",
        bottomType: document.getElementById("charEditorBottomType")?.value || "pants",
        shoeType: document.getElementById("charEditorShoeType")?.value || "sneakers",
        topColor: document.getElementById("charEditorTopColor")?.value || "#d64a33",
        pantsColor: document.getElementById("charEditorPantsColor")?.value || "#2e384d",
        shoeColor: document.getElementById("charEditorShoeColor")?.value || "#1e1e24",
        accessories: document.getElementById("charEditorGlasses")?.checked ? ["glasses"] : []
      },
      defaultExpression: document.getElementById("charPreviewExpr")?.value || "neutral",
      defaultFacing: document.getElementById("charPreviewFacing")?.value || "three_quarter_right"
    };
  }

  try {
    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(charData)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`💾 ${data.message}`);
    await loadCharacterLibrary();
    selectCharacterForEditing(charData.id);
  } catch (err) {
    showToast("❌ Lỗi lưu nhân vật: " + err.message);
  }
}

// Xuất gói nhân vật ZIP
function exportCurrentCharacterPackage() {
  if (characterState.activeCharacter) {
    exportCharacterById(characterState.activeCharacter.id);
  }
}

function exportCharacterById(id) {
  const link = document.createElement("a");
  link.href = `/api/characters/${encodeURIComponent(id)}/export-package`;
  link.download = `${id}_character_package.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`📦 Đang tải xuống gói nhân vật: ${id}_character_package.zip`);
}

// Nhân bản nhân vật từ ID
async function duplicateCharacterById(id) {
  try {
    const res = await fetch(`/api/characters/${encodeURIComponent(id)}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`📑 ${data.message}`);
    await loadCharacterLibrary();
    selectCharacterForEditing(data.character.id);
  } catch (err) {
    showToast("❌ Lỗi nhân bản: " + err.message);
  }
}

function duplicateCurrentCharacter() {
  if (characterState.activeCharacter) {
    duplicateCharacterById(characterState.activeCharacter.id);
  }
}

// Xóa nhân vật
async function deleteCharacterById(id) {
  if (!confirm(`Bạn có chắc chắn muốn xóa nhân vật "${id}" khỏi thư viện?`)) return;

  try {
    const res = await fetch(`/api/characters/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`🗑️ ${data.message}`);
    characterState.activeCharacter = null;
    await loadCharacterLibrary();
  } catch (err) {
    showToast("❌ Lỗi xóa nhân vật: " + err.message);
  }
}

function deleteCurrentCharacter() {
  if (characterState.activeCharacter) {
    deleteCharacterById(characterState.activeCharacter.id);
  }
}

function onSkinPresetChanged(val) {
  const el = document.getElementById("charEditorSkin");
  if (el) { el.value = val; updateLivePreview(); }
}

function onHairPresetChanged(val) {
  const el = document.getElementById("charEditorHairColor");
  if (el) { el.value = val; updateLivePreview(); }
}

// =========================================================================
// TRỰC QUAN HÓA LIVE SVG (RIG, POSES, EXPRESSIONS & FACING)
// =========================================================================

function renderShoeSvg({ x, y, shoeType, shoeColor, ink, isFront, isSide, isLeftFoot, isNear = true, footAngle = 0, isGrounded = true }) {
  const rot = isGrounded ? 0 : footAngle;
  let s = "";

  if (isFront) {
    const scaleX = isLeftFoot ? 1 : -1;
    s += `<g id="${isLeftFoot ? 'left' : 'right'}-shoe-front" transform="translate(${x} ${y}) scale(${scaleX} 1) rotate(${rot})">`;

    if (shoeType === "boots") {
      s += `<path d="M -6 -3.5 L 9.5 -3.5 Q 10.5 -3.5 10.5 -1.5 L 10.5 0 L -6.5 0 L -6.5 -1.5 Q -6.5 -3.5 -6 -3.5 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />`;
      s += `<line x1="-1.5" y1="-2" x2="-1.5" y2="0" stroke="#334155" stroke-width="1.8" />`;
      s += `<line x1="4.5" y1="-2" x2="4.5" y2="0" stroke="#334155" stroke-width="1.8" />`;
      s += `<path d="M -5.5 -13.5 L 6.5 -13.5 Q 8.5 -8 9.5 -3.5 L -6 -3.5 Q -6.5 -8 -5.5 -13.5 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
      s += `<rect x="-6.5" y="-15" width="14" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />`;
      s += `<path d="M 3.5 -3.5 Q 4 -6.5 8.5 -3.5" fill="none" stroke="${ink}" stroke-width="1.6" />`;
    } else if (shoeType === "casual") {
      s += `<path d="M -5 -2 L 8.5 -2 Q 9.5 -2 9.5 -0.8 L 9.5 0 L -5.5 0 L -5.5 -0.8 Q -5.5 -2 -5 -2 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />`;
      s += `<path d="M -5 -2 Q -5.5 -6 -3 -9 L 4 -9 Q 8.5 -6 8.5 -2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />`;
      s += `<path d="M -2.5 -9 Q 0.5 -7 3.5 -9" fill="#1e293b" stroke="${ink}" stroke-width="1.6" />`;
      s += `<path d="M 3.5 -2 Q 4.5 -4.5 7.5 -2" fill="none" stroke="${ink}" stroke-width="1.4" opacity="0.6" />`;
    } else {
      // Sneakers
      s += `<path d="M -5.5 -2.8 L 9 -2.8 Q 10 -2.8 10 -1.2 L 10 0 L -6 0 L -6 -1.2 Q -6 -2.8 -5.5 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />`;
      s += `<path d="M -5 -2.8 Q -5.8 -6.5 -3.5 -9.5 L 4 -9.5 Q 8.5 -6 9 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
      s += `<ellipse cx="0.5" cy="-9.5" rx="4.8" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />`;
      s += `<path d="M 4 -2.8 Q 4 -5.5 6.8 -5.5 Q 9 -4.8 9 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />`;
      s += `<line x1="-0.8" y1="-7.8" x2="3.2" y2="-7.0" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
      s += `<line x1="0.2" y1="-5.6" x2="4.2" y2="-4.8" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
    }
    s += `</g>`;
    return s;
  }

  if (isSide) {
    s += `<g id="shoe-side" transform="translate(${x} ${y}) rotate(${rot})">`;
    if (shoeType === "boots") {
      s += `<path d="M -8 -3.8 L 11 -3.8 Q 13 -3.8 13 -1.5 Q 13 0 10.5 0 L -8 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />`;
      s += `<line x1="-3" y1="-2" x2="-3" y2="0" stroke="#334155" stroke-width="1.8" />`;
      s += `<line x1="3" y1="-2" x2="3" y2="0" stroke="#334155" stroke-width="1.8" />`;
      s += `<line x1="8" y1="-2" x2="8" y2="0" stroke="#334155" stroke-width="1.8" />`;
      s += `<path d="M -8 -3.8 Q -8.5 -8 -4.5 -14 L 3 -14 Q 7 -8.5 12.5 -4.5 L 12.5 -3.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
      s += `<rect x="-5.5" y="-15.5" width="10" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />`;
      s += `<path d="M 6.5 -3.8 Q 7.5 -7 12.5 -4.5" fill="none" stroke="${ink}" stroke-width="1.8" />`;
    } else if (shoeType === "casual") {
      s += `<path d="M -7 -2.2 L 10 -2.2 Q 11.5 -2.2 11.5 -0.8 Q 11.5 0 9.5 0 L -7 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />`;
      s += `<path d="M -7 -2.2 Q -7.5 -6 -3.5 -8.5 Q 0 -6 3.5 -8.5 Q 7.5 -6.5 11 -3.2 L 11 -2.2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />`;
      s += `<path d="M -3.5 -8.5 Q 0 -5.5 3.5 -8.5" fill="none" stroke="${ink}" stroke-width="1.6" />`;
    } else {
      // Sneakers
      s += `<path d="M -7.5 -2.8 L 10.5 -2.8 Q 12.5 -2.8 12.5 -1.2 Q 12.5 0 9.5 0 L -7.5 0 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />`;
      s += `<path d="M -7.5 -2.8 Q -8.2 -7 -4 -9.5 L 2.5 -9.5 Q 7 -7.5 12 -4 Q 12.5 -3 12 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
      s += `<ellipse cx="-0.8" cy="-9.5" rx="4.5" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />`;
      s += `<path d="M 6.5 -2.8 Q 7.5 -5.2 11.5 -4 Q 12 -3.2 11.8 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />`;
      s += `<line x1="0.5" y1="-8.0" x2="4.5" y2="-6.6" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
      s += `<line x1="2.2" y1="-5.8" x2="6.2" y2="-4.4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
    }
    s += `</g>`;
    return s;
  }

  // Three-quarter view
  const sc = isNear ? 1.0 : 0.92;
  s += `<g id="${isNear ? 'near' : 'far'}-shoe-3q" transform="translate(${x} ${y}) scale(${sc}) rotate(${rot})">`;
  if (shoeType === "boots") {
    s += `<path d="M -7 -3.5 L 10.5 -3.5 Q 12 -3.5 12 -1.5 Q 12 0 10 0 L -7 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="2" />`;
    s += `<line x1="-2" y1="-2" x2="-2" y2="0" stroke="#334155" stroke-width="1.8" />`;
    s += `<line x1="4" y1="-2" x2="4" y2="0" stroke="#334155" stroke-width="1.8" />`;
    s += `<path d="M -7 -3.5 Q -7.5 -7.5 -4 -13.5 L 3.5 -13.5 Q 7.5 -8 11.5 -4 L 11.5 -3.5 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
    s += `<rect x="-5" y="-15" width="10.5" height="3" rx="1.5" fill="#334155" stroke="${ink}" stroke-width="1.8" />`;
    s += `<path d="M 5.5 -3.5 Q 6.5 -6.5 11.5 -4" fill="none" stroke="${ink}" stroke-width="1.8" />`;
  } else if (shoeType === "casual") {
    s += `<path d="M -6.5 -2.2 L 9.5 -2.2 Q 11 -2.2 11 -0.8 Q 11 0 9 0 L -6.5 0 Z" fill="#0f172a" stroke="${ink}" stroke-width="1.6" />`;
    s += `<path d="M -6.5 -2.2 Q -7 -5.5 -3 -8.5 Q 0.5 -6 4 -8.5 Q 7.5 -6 10.5 -3.2 L 10.5 -2.2 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2" />`;
    s += `<path d="M -3 -8.5 Q 0.5 -5.8 4 -8.5" fill="none" stroke="${ink}" stroke-width="1.6" />`;
  } else {
    // Sneakers
    s += `<path d="M -7 -2.8 L 10 -2.8 Q 11.8 -2.8 11.8 -1.2 Q 11.8 0 9.2 0 L -7 0 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.8" />`;
    s += `<path d="M -7 -2.8 Q -7.5 -6.5 -3.5 -9.5 L 3 -9.5 Q 7 -7 11.2 -3.8 L 11.2 -2.8 Z" fill="${shoeColor}" stroke="${ink}" stroke-width="2.2" />`;
    s += `<ellipse cx="-0.2" cy="-9.5" rx="4.6" ry="1.6" fill="#334155" stroke="${ink}" stroke-width="1.6" />`;
    s += `<path d="M 5.8 -2.8 Q 6.8 -5 10.8 -3.8 Q 11.2 -3.2 11 -2.8 Z" fill="#ffffff" stroke="${ink}" stroke-width="1.6" />`;
    s += `<line x1="0.2" y1="-7.8" x2="4.2" y2="-6.4" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
    s += `<line x1="1.8" y1="-5.6" x2="5.8" y2="-4.2" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" />`;
  }
  s += `</g>`;
  return s;
}

function updateLivePreview() {
  const svg = document.getElementById("liveCharacterSvg");
  if (!svg) return;

  const skin = document.getElementById("charEditorSkin")?.value || "#ffdfc4";
  const hairStyle = document.getElementById("charEditorHairStyle")?.value || "short";
  const hairColor = document.getElementById("charEditorHairColor")?.value || "#4a3728";
  const eyeStyle = document.getElementById("charEditorEyeStyle")?.value || "oval";
  const blush = !!document.getElementById("charEditorBlush")?.checked;
  const glasses = !!document.getElementById("charEditorGlasses")?.checked;
  const outfitType = document.getElementById("charEditorOutfitType")?.value || "hoodie";
  const bottomType = document.getElementById("charEditorBottomType")?.value || (outfitType === "dress" ? "skirt" : "pants");
  const shoeType = document.getElementById("charEditorShoeType")?.value || (outfitType === "suit" ? "casual" : "sneakers");
  const topColor = document.getElementById("charEditorTopColor")?.value || "#d64a33";
  const pantsColor = document.getElementById("charEditorPantsColor")?.value || "#2e384d";
  const shoeColor = document.getElementById("charEditorShoeColor")?.value || "#1e1e24";
  const headScale = parseFloat(document.getElementById("charEditorHeadScale")?.value) || 1.0;

  const pose = document.getElementById("charPreviewPose")?.value || "stand";
  const expr = document.getElementById("charPreviewExpr")?.value || "neutral";
  const facing = document.getElementById("charPreviewFacing")?.value || "three_quarter_right";
  const talk = parseFloat(document.getElementById("charPreviewTalk")?.value) || 0;
  const blink = !!document.getElementById("charPreviewBlink")?.checked;
  const showShadow = !!document.getElementById("charPreviewShadow")?.checked;

  const isLeft = facing === "three_quarter_left" || facing === "side_left";
  const isFront = facing === "front";
  const isSide = facing === "side_right" || facing === "side_left";
  const flipX = isLeft ? -1 : 1;
  const ink = "#191918";

  // Joint definitions tailored for view perspective
  const headY = -118;
  const shY = -76;
  const hipY = -42;

  let shFar, eFar, hFar, shNear, eNear, hNear;
  let hipFar, kFar, fFar, hipNear, kNear, fNear;

  if (isFront) {
    // Symmetrical front view
    shFar = [-22, -76]; eFar = [-25, -57]; hFar = [-25, -40];
    shNear = [22, -76]; eNear = [25, -57]; hNear = [25, -40];
    hipFar = [-13, -40]; kFar = [-14, -20]; fFar = [-15, 0];
    hipNear = [13, -40]; kNear = [14, -20]; fNear = [15, 0];

    if (pose === "walk") {
      shFar = [-22, -76]; eFar = [-24, -62]; hFar = [-22, -48];
      shNear = [22, -76]; eNear = [26, -60]; hNear = [28, -46];
      kFar = [-14, -22]; fFar = [-15, -4];
      kNear = [14, -18]; fNear = [16, 0];
    } else if (pose === "wave") {
      shNear = [22, -76]; eNear = [34, -80]; hNear = [38, -104];
    } else if (pose === "point") {
      shNear = [22, -76]; eNear = [34, -76]; hNear = [48, -76];
    } else if (pose === "sit_chair") {
      shFar = [-22, -70]; eFar = [-20, -52]; hFar = [-14, -36];
      shNear = [22, -70]; eNear = [20, -52]; hNear = [14, -36];
      hipFar = [-13, -36]; kFar = [-13, -36]; fFar = [-13, 0];
      hipNear = [13, -36]; kNear = [13, -36]; fNear = [13, 0];
    }
  } else if (isSide) {
    // Side profile view
    shFar = [-4, -76]; eFar = [-8, -58]; hFar = [-8, -42];
    shNear = [4, -76]; eNear = [8, -58]; hNear = [10, -42];
    hipFar = [-4, -40]; kFar = [-4, -20]; fFar = [-2, 0];
    hipNear = [4, -40]; kNear = [6, -20]; fNear = [8, 0];

    if (pose === "walk") {
      shFar = [-4, -76]; eFar = [14, -66]; hFar = [24, -56];
      shNear = [4, -76]; eNear = [-8, -66]; hNear = [-18, -52];
      hipFar = [-4, -40]; kFar = [-16, -24]; fFar = [-18, -4];
      hipNear = [4, -40]; kNear = [18, -22]; fNear = [20, 0];
    } else if (pose === "wave") {
      shNear = [4, -76]; eNear = [18, -84]; hNear = [24, -108];
    } else if (pose === "point") {
      shNear = [4, -76]; eNear = [22, -76]; hNear = [38, -76];
    }
  } else {
    // 3/4 view
    shFar = [-16, -76]; eFar = [-19, -58]; hFar = [-19, -42];
    shNear = [16, -76]; eNear = [20, -58]; hNear = [20, -42];
    hipFar = [-10, -40]; kFar = [-10, -20]; fFar = [-10, 0];
    hipNear = [10, -40]; kNear = [12, -20]; fNear = [12, 0];

    if (pose === "walk") {
      shFar = [-16, -76]; eFar = [4, -65]; hFar = [16, -54];
      shNear = [16, -76]; eNear = [-2, -65]; hNear = [-12, -50];
      hipFar = [-10, -40]; kFar = [-16, -24]; fFar = [-16, -4];
      hipNear = [10, -40]; kNear = [18, -22]; fNear = [18, 0];
    } else if (pose === "wave") {
      shNear = [16, -76]; eNear = [30, -82]; hNear = [34, -106];
    } else if (pose === "point") {
      shNear = [16, -76]; eNear = [30, -76]; hNear = [44, -76];
    } else if (pose === "sit_chair") {
      shFar = [-16, -70]; eFar = [4, -54]; hFar = [12, -38];
      shNear = [16, -70]; eNear = [14, -52]; hNear = [18, -36];
      hipFar = [-10, -36]; kFar = [20, -36]; fFar = [20, 0];
      hipNear = [10, -36]; kNear = [24, -36]; fNear = [24, 0];
    }
  }

  // Render SVG string
  let html = "";

  // Ground line reference
  html += '<line x1="-120" y1="0" x2="120" y2="0" stroke="#334155" stroke-width="2" stroke-dasharray="6 4" />';

  // Chair reference when sit_chair
  if (pose === "sit_chair") {
    html += '<rect x="-18" y="-36" width="36" height="4" rx="2" fill="#78350f" />';
    html += '<rect x="-16" y="-32" width="4" height="32" fill="#451a03" />';
    html += '<rect x="12" y="-32" width="4" height="32" fill="#451a03" />';
  }

  // Character root with flipX
  html += `<g transform="scale(${flipX} 1)" stroke-linecap="round" stroke-linejoin="round">`;

  // 1. Shadow
  if (showShadow) {
    const shadowRx = isFront ? 34 : 30;
    html += `<ellipse cx="0" cy="2" rx="${shadowRx}" ry="6" fill="rgba(0,0,0,0.22)" />`;
  }

  // 2. Far Arm
  html += `<line x1="${shFar[0]}" y1="${shFar[1]}" x2="${eFar[0]}" y2="${eFar[1]}" stroke="${topColor}" stroke-width="12" />`;
  html += `<line x1="${eFar[0]}" y1="${eFar[1]}" x2="${hFar[0]}" y2="${hFar[1]}" stroke="${topColor}" stroke-width="10.5" />`;
  html += `<circle cx="${eFar[0]}" cy="${eFar[1]}" r="5.5" fill="${topColor}" />`;
  html += `<circle cx="${hFar[0]}" cy="${hFar[1]}" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />`;

  // 3. Lower Body (Far leg, Far shoe, Near leg, Near shoe, Pelvis/Garment)
  const legAnkleFarY = fFar[1] - 8;
  const legAnkleNearY = fNear[1] - 8;

  // 3a. Far Leg (Bone: hipFar -> kFar -> fFar, enters shoe collar at y = fFar[1] - 8)
  if (bottomType === "pants") {
    html += `<line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${pantsColor}" stroke-width="14" stroke-linecap="round" />`;
    html += `<line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${legAnkleFarY}" stroke="${pantsColor}" stroke-width="12" stroke-linecap="round" />`;
    html += `<circle cx="${kFar[0]}" cy="${kFar[1]}" r="6.5" fill="${pantsColor}" />`;
    html += `<line x1="${fFar[0] - 5.5}" y1="${legAnkleFarY - 1}" x2="${fFar[0] + 5.5}" y2="${legAnkleFarY - 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" />`;
  } else {
    html += `<line x1="${hipFar[0]}" y1="${hipFar[1]}" x2="${kFar[0]}" y2="${kFar[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />`;
    html += `<line x1="${kFar[0]}" y1="${kFar[1]}" x2="${fFar[0]}" y2="${legAnkleFarY}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />`;
    html += `<circle cx="${kFar[0]}" cy="${kFar[1]}" r="5.5" fill="${skin}" />`;
    html += `<ellipse cx="${kFar[0]}" cy="${kFar[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />`;
  }

  // 3b. Far Shoe
  const farFootAngle = fFar[1] < 0 ? -12 : 0;
  html += renderShoeSvg({
    x: fFar[0],
    y: fFar[1],
    shoeType,
    shoeColor,
    ink,
    isFront,
    isSide,
    isLeftFoot: false,
    isNear: false,
    footAngle: farFootAngle,
    isGrounded: fFar[1] === 0
  });

  // 3c. Near Leg (Bone: hipNear -> kNear -> fNear, enters shoe collar at y = fNear[1] - 8)
  if (bottomType === "pants") {
    html += `<line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${pantsColor}" stroke-width="14" stroke-linecap="round" />`;
    html += `<line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${legAnkleNearY}" stroke="${pantsColor}" stroke-width="12" stroke-linecap="round" />`;
    html += `<circle cx="${kNear[0]}" cy="${kNear[1]}" r="6.5" fill="${pantsColor}" />`;
    html += `<line x1="${fNear[0] - 5.5}" y1="${legAnkleNearY - 1}" x2="${fNear[0] + 5.5}" y2="${legAnkleNearY - 1}" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" />`;
  } else {
    html += `<line x1="${hipNear[0]}" y1="${hipNear[1]}" x2="${kNear[0]}" y2="${kNear[1]}" stroke="${skin}" stroke-width="12" stroke-linecap="round" />`;
    html += `<line x1="${kNear[0]}" y1="${kNear[1]}" x2="${fNear[0]}" y2="${legAnkleNearY}" stroke="${skin}" stroke-width="10.5" stroke-linecap="round" />`;
    html += `<circle cx="${kNear[0]}" cy="${kNear[1]}" r="5.5" fill="${skin}" />`;
    html += `<ellipse cx="${kNear[0]}" cy="${kNear[1]}" rx="3" ry="1.5" fill="#fca5a5" opacity="0.5" />`;
  }

  // 3d. Near Shoe
  const nearFootAngle = fNear[1] < 0 ? -12 : 0;
  html += renderShoeSvg({
    x: fNear[0],
    y: fNear[1],
    shoeType,
    shoeColor,
    ink,
    isFront,
    isSide,
    isLeftFoot: true,
    isNear: true,
    footAngle: nearFootAngle,
    isGrounded: fNear[1] === 0
  });

  // 3e. Pelvis & Garment (Drawn OVER upper legs so legs naturally emerge from inside/below!)
  if (bottomType === "skirt" || bottomType === "dress") {
    if (isFront) {
      html += `<path d="M -18 ${hipY} L 18 ${hipY} L 25 ${hipY + 20} Q 0 ${hipY + 24} -25 ${hipY + 20} Z" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
      html += `<path d="M -7 ${hipY + 4} L -9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />`;
      html += `<path d="M 7 ${hipY + 4} L 9 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />`;
    } else if (isSide) {
      html += `<path d="M -13 ${hipY} L 13 ${hipY} L 17 ${hipY + 20} Q 0 ${hipY + 24} -15 ${hipY + 20} Z" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
    } else {
      html += `<path d="M -17 ${hipY} L 18 ${hipY} L 24 ${hipY + 20} Q 2 ${hipY + 24} -22 ${hipY + 20} Z" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
      html += `<path d="M 4 ${hipY + 4} L 5 ${hipY + 21}" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity="0.4" />`;
    }
  } else if (bottomType === "shorts") {
    if (isFront) {
      html += `<polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 14} -20,${hipY + 14}" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
      html += `<polygon points="-5,${hipY + 14} 0,${hipY + 8} 5,${hipY + 14}" fill="${skin}" stroke="${ink}" stroke-width="2.5" />`;
      html += `<line x1="-20" y1="${hipY + 13}" x2="-5" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />`;
      html += `<line x1="5" y1="${hipY + 13}" x2="20" y2="${hipY + 13}" stroke="${ink}" stroke-width="2" />`;
    } else {
      html += `<polygon points="-16,${hipY - 4} 17,${hipY - 4} 18,${hipY + 14} -15,${hipY + 14}" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
    }
  } else {
    // Long pants waistband & crotch
    if (isFront) {
      html += `<polygon points="-19,${hipY - 4} 19,${hipY - 4} 20,${hipY + 8} -20,${hipY + 8}" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
      html += `<path d="M 0 ${hipY - 2} L 0 ${hipY + 6} Q 0 ${hipY + 9} 2 ${hipY + 10}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />`;
      html += `<line x1="-18" y1="${hipY - 3}" x2="18" y2="${hipY - 3}" stroke="${ink}" stroke-width="2" opacity="0.5" />`;
    } else if (isSide) {
      html += `<polygon points="-12,${hipY - 4} 12,${hipY - 4} 13,${hipY + 8} -11,${hipY + 8}" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
    } else {
      html += `<polygon points="-16,${hipY - 4} 18,${hipY - 4} 19,${hipY + 8} -15,${hipY + 8}" fill="${pantsColor}" stroke="${ink}" stroke-width="3.5" />`;
      html += `<path d="M 2 ${hipY - 2} L 2 ${hipY + 6}" stroke="${ink}" stroke-width="2.5" stroke-linecap="round" fill="none" />`;
    }
  }

  // 6. Neck
  const neckX = isFront ? 0 : 1;
  const neckW = isFront ? 8 : 7;
  html += `<path d="M ${neckX - neckW} ${headY + 28} L ${neckX + neckW} ${headY + 28} L ${neckX + neckW + 2} ${shY + 2} L ${neckX - neckW - 2} ${shY + 2} Z" fill="${skin}" stroke="${ink}" stroke-width="3" />`;
  html += `<ellipse cx="${neckX}" cy="${headY + 31}" rx="${neckW}" ry="3" fill="rgba(0,0,0,0.12)" />`;

  // 7. Torso & Clothing
  const torsoBotY = outfitType === "labcoat" ? hipY + 12 : hipY;
  if (isFront) {
    html += `<path d="M -23 ${shY} Q 0 ${shY - 6} 23 ${shY} L 19 ${torsoBotY} Q 0 ${torsoBotY + 3} -19 ${torsoBotY} Z" fill="${topColor}" stroke="${ink}" stroke-width="4" />`;
    html += `<path d="M -11 ${shY - 1} Q 0 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />`;

    if (outfitType === "hoodie") {
      html += `<path d="M -12 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -14 ${hipY - 2} Z" fill="rgba(0,0,0,0.18)" stroke="${ink}" stroke-width="2.5" />`;
      html += `<line x1="-4" y1="${shY + 3}" x2="-4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />`;
      html += `<line x1="4" y1="${shY + 3}" x2="4" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />`;
    } else if (outfitType === "labcoat") {
      html += `<line x1="0" y1="${shY + 6}" x2="0" y2="${torsoBotY}" stroke="${ink}" stroke-width="2.5" />`;
      html += `<polygon points="-9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />`;
      html += `<polygon points="9,${shY + 6} 0,${shY + 16} 0,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />`;
      html += `<rect x="-14" y="${shY + 18}" width="7" height="9" rx="1" fill="#f8fafc" stroke="${ink}" stroke-width="1.8" />`;
      html += `<line x1="-10" y1="${shY + 15}" x2="-10" y2="${shY + 20}" stroke="#2563eb" stroke-width="2" />`;
      html += `<polygon points="-2,${shY + 10} 2,${shY + 10} 3,${shY + 22} 0,${shY + 25} -3,${shY + 22}" fill="#dc2626" />`;
    } else if (outfitType === "suit") {
      html += `<line x1="0" y1="${shY + 16}" x2="0" y2="${hipY}" stroke="${ink}" stroke-width="2.5" />`;
      html += `<polygon points="-10,${shY + 4} 0,${shY + 18} -6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />`;
      html += `<polygon points="10,${shY + 4} 0,${shY + 18} 6,${shY + 18}" fill="#1e293b" stroke="${ink}" stroke-width="2" />`;
      html += `<polygon points="-3,${shY + 6} 3,${shY + 6} 4,${shY + 20} 0,${shY + 23} -4,${shY + 20}" fill="#dc2626" />`;
    }
  } else if (isSide) {
    html += `<path d="M -13 ${shY} Q 2 ${shY - 5} 15 ${shY} L 13 ${torsoBotY} Q 0 ${torsoBotY + 3} -11 ${torsoBotY} Z" fill="${topColor}" stroke="${ink}" stroke-width="4" />`;
    html += `<path d="M -6 ${shY - 1} Q 2 ${shY + 5} 10 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />`;
  } else {
    // 3/4 view
    html += `<path d="M -18 ${shY} Q 2 ${shY - 6} 20 ${shY} L 17 ${torsoBotY} Q 0 ${torsoBotY + 3} -16 ${torsoBotY} Z" fill="${topColor}" stroke="${ink}" stroke-width="4" />`;
    html += `<path d="M -9 ${shY - 1} Q 1 ${shY + 6} 11 ${shY - 1}" stroke="${ink}" stroke-width="3.5" fill="none" />`;

    if (outfitType === "hoodie") {
      html += `<path d="M -10 ${hipY - 14} L 12 ${hipY - 14} L 14 ${hipY - 2} L -11 ${hipY - 2} Z" fill="rgba(0,0,0,0.18)" stroke="${ink}" stroke-width="2.5" />`;
      html += `<line x1="-1" y1="${shY + 3}" x2="-1" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />`;
      html += `<line x1="6" y1="${shY + 3}" x2="6" y2="${shY + 16}" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />`;
    } else if (outfitType === "labcoat") {
      html += `<line x1="2" y1="${shY + 6}" x2="3" y2="${torsoBotY}" stroke="${ink}" stroke-width="2.5" />`;
      html += `<polygon points="-6,${shY + 6} 2,${shY + 16} 2,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />`;
      html += `<polygon points="10,${shY + 6} 2,${shY + 16} 2,${shY + 6}" fill="#e2e8f0" stroke="${ink}" stroke-width="2" />`;
      html += `<rect x="-12" y="${shY + 18}" width="7" height="9" rx="1" fill="#f8fafc" stroke="${ink}" stroke-width="1.8" />`;
      html += `<line x1="-9" y1="${shY + 15}" x2="-9" y2="${shY + 20}" stroke="#2563eb" stroke-width="2" />`;
      html += `<polygon points="0,${shY + 10} 4,${shY + 10} 5,${shY + 22} 2,${shY + 25} -1,${shY + 22}" fill="#dc2626" />`;
    }
  }

  // 8. Head Group
  const headCenterX = isFront ? 0 : 1;
  html += `<g transform="translate(${headCenterX} ${headY})">`;

  // Back Hair
  const r = 36 * headScale;
  if (hairStyle === "ponytail") {
    if (isFront) {
      html += `<path d="M 12 -28 Q 38 -36 34 8 Q 28 4 18 -10" stroke="${hairColor}" stroke-width="14" stroke-linecap="round" fill="none" />`;
      html += `<circle cx="16" cy="-24" r="5" fill="#f43f5e" />`;
    } else {
      html += `<path d="M ${-r * 0.4} ${-r * 0.3} Q ${-r * 1.5} ${-r * 0.2} ${-r * 1.2} ${r * 0.8}" stroke="${hairColor}" stroke-width="20" stroke-linecap="round" fill="none" />`;
      html += `<circle cx="${-r * 0.4}" cy="${-r * 0.3}" r="5.5" fill="#f43f5e" />`;
    }
  } else if (hairStyle === "bun") {
    html += `<circle cx="${-r * 0.65}" cy="${-r * 0.7}" r="17" fill="${hairColor}" stroke="${ink}" stroke-width="4" />`;
  }

  // Head Skull Contour with Cheeks & Tapered Chin
  if (isFront) {
    html += `<path d="M 0 -36 C 23 -36, 37 -22, 37 -4 C 37 12, 38 19, 31 29 C 24 37, 10 38, 0 38 C -10 38, -24 37, -31 29 C -38 19, -37 12, -37 -4 C -37 -22, -23 -36, 0 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />`;
    // Ears
    html += `<path d="M -37 -4 Q -45 2 -36 10" fill="${skin}" stroke="${ink}" stroke-width="3" />`;
    html += `<path d="M 37 -4 Q 45 2 36 10" fill="${skin}" stroke="${ink}" stroke-width="3" />`;
  } else if (isSide) {
    html += `<path d="M 2 -36 C 22 -36, 34 -22, 34 -8 C 34 -2, 36 2, 37 4 C 35 10, 34 16, 28 28 C 22 36, 8 38, -2 36 C -18 32, -32 18, -32 -4 C -32 -22, -18 -36, 2 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />`;
    html += `<path d="M -18 -4 Q -26 2 -18 10" fill="${skin}" stroke="${ink}" stroke-width="3" />`;
  } else {
    html += `<path d="M -2 -36 C 21 -36, 35 -22, 36 -6 C 37 10, 38 18, 33 28 C 26 37, 14 38, 4 38 C -8 38, -22 36, -30 26 C -36 16, -35 8, -34 -4 C -34 -22, -21 -36, -2 -36 Z" fill="${skin}" stroke="${ink}" stroke-width="4" />`;
    html += `<path d="M -34 -4 Q -42 2 -33 10" fill="${skin}" stroke="${ink}" stroke-width="3" />`;
  }

  // Facial Features
  const eyeY = 2;
  const eyeX = isFront ? [-14, 14] : isSide ? [16] : [-5, 18];

  // Blush
  if (blush && !blink) {
    if (isFront) {
      html += `<ellipse cx="-16" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />`;
      html += `<ellipse cx="16" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />`;
    } else if (isSide) {
      html += `<ellipse cx="18" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />`;
    } else {
      html += `<ellipse cx="-5" cy="${eyeY + 12}" rx="5" ry="3" fill="#fca5a5" opacity="0.4" />`;
      html += `<ellipse cx="19" cy="${eyeY + 12}" rx="6" ry="3" fill="#fca5a5" opacity="0.4" />`;
    }
  }

  // Eyes
  if (blink || expr === "sad" || expr === "relief") {
    eyeX.forEach((ex) => {
      html += `<path d="M ${ex - 5} ${eyeY + 2} Q ${ex} ${eyeY + 5} ${ex + 5} ${eyeY + 2}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" fill="none" />`;
    });
  } else if (expr === "happy" || expr === "laughing") {
    eyeX.forEach((ex) => {
      html += `<path d="M ${ex - 6} ${eyeY + 3} Q ${ex} ${eyeY - 4} ${ex + 6} ${eyeY + 3}" stroke="${ink}" stroke-width="3.8" stroke-linecap="round" fill="none" />`;
    });
  } else if (expr === "crying") {
    eyeX.forEach((ex, i) => {
      const sign = i === 0 ? 1 : -1;
      html += `<path d="M ${ex - sign * 5} ${eyeY - 4} L ${ex + sign * 4} ${eyeY} L ${ex - sign * 5} ${eyeY + 4}" stroke="${ink}" stroke-width="3.2" stroke-linecap="round" fill="none" />`;
      html += `<circle cx="${ex}" cy="${eyeY + 14}" r="2.8" fill="#38bdf8" />`;
      html += `<path d="M ${ex - 2} ${eyeY + 4} L ${ex + 2} ${eyeY + 4} L ${ex} ${eyeY + 12} Z" fill="#38bdf8" />`;
    });
  } else if (expr === "dizzy") {
    eyeX.forEach((ex) => {
      html += `<circle cx="${ex}" cy="${eyeY}" r="5.5" stroke="${ink}" stroke-width="2.5" fill="none" stroke-dasharray="4 2" />`;
    });
  } else if (expr === "love_eyes") {
    eyeX.forEach((ex) => {
      html += `<path d="M ${ex} ${eyeY + 4} C ${ex - 7} ${eyeY - 4}, ${ex - 7} ${eyeY - 10}, ${ex} ${eyeY - 5} C ${ex + 7} ${eyeY - 10}, ${ex + 7} ${eyeY - 4}, ${ex} ${eyeY + 4} Z" fill="#ef4444" stroke="#991b1b" stroke-width="1.5" />`;
    });
  } else if (expr === "shocked" || expr === "scared") {
    eyeX.forEach((ex) => {
      html += `<circle cx="${ex}" cy="${eyeY}" r="6.8" fill="#ffffff" stroke="${ink}" stroke-width="3.2" />`;
      html += `<circle cx="${ex}" cy="${eyeY}" r="2.4" fill="${ink}" />`;
    });
    // Giọt mồ hôi bên trán
    html += `<path d="M 24 -122 Q 20 -115 24 -112 Q 28 -115 24 -122 Z" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2" />`;
  } else {
    eyeX.forEach((ex, i) => {
      const rx = !isFront && i === 0 ? 4.6 : 5.4;
      html += `<ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="7.2" fill="${ink}" />`;
      html += `<circle cx="${ex + 1.8}" cy="${eyeY - 2.2}" r="2.2" fill="#ffffff" />`;
    });
  }
  // Dấu gân giận đỏ cho angry
  if (expr === "angry") {
    html += `<path d="M 18 -135 L 26 -127 M 26 -135 L 18 -127" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round" />`;
  }

  // Eyebrows
  eyeX.forEach((ex) => {
    let dy = 0;
    if (expr === "worried") dy = -2;
    if (expr === "angry") dy = 3;
    if (expr === "surprised" || expr === "confused") dy = -3.5;
    html += `<path d="M ${ex - 6} ${eyeY - 10 + dy} Q ${ex} ${eyeY - 12 + dy} ${ex + 6} ${eyeY - 10 - dy}" stroke="${ink}" stroke-width="2.8" stroke-linecap="round" fill="none" />`;
  });

  // Nose
  if (!isFront) {
    const nx = isSide ? 25 : 10;
    html += `<path d="M ${nx} 5 Q ${nx + 2} 7 ${nx} 9" stroke="${ink}" stroke-width="2.2" stroke-linecap="round" fill="none" />`;
  }

  // Mouth
  const mx = isFront ? 0 : isSide ? 14 : 7;
  const my = eyeY + 18;
  if (talk > 0.1 || expr === "laughing") {
    const openH = 3 + talk * 7 + (expr === "laughing" ? 4 : 0);
    html += `<ellipse cx="${mx}" cy="${my}" rx="5.5" ry="${openH}" fill="${ink}" />`;
    html += `<path d="M ${mx - 4} ${my} Q ${mx} ${my + openH - 1} ${mx + 4} ${my}" fill="#f87171" />`;
  } else if (expr === "sad") {
    html += `<path d="M ${mx - 5} ${my + 2} Q ${mx} ${my - 2} ${mx + 5} ${my + 2}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />`;
  } else {
    html += `<path d="M ${mx - 5} ${my - 1} Q ${mx} ${my + 4} ${mx + 5} ${my - 1}" stroke="${ink}" stroke-width="3" stroke-linecap="round" fill="none" />`;
  }

  // Front Hair
  if (hairStyle === "spiky") {
    if (isFront) {
      html += `<path d="M -39 -2 C -40 -26, -24 -42, 0 -42 C 24 -42, 40 -26, 39 -2 L 34 16 L 31 -2 L 24 -6 L 18 4 L 12 -8 L 4 4 L -4 -6 L -12 4 L -18 -8 L -24 -4 L -31 -2 L -34 16 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
    } else {
      html += `<path d="M -36 -4 C -37 -28, -20 -42, 4 -42 C 28 -42, 40 -26, 38 -4 L 33 16 L 28 -2 L 20 -8 L 12 4 L 2 -8 L -6 4 L -14 -8 L -24 -2 L -32 15 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
    }
  } else if (hairStyle === "ponytail" || hairStyle === "long") {
    if (isFront) {
      html += `<path d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 8, 36 22, 33 26 C 32 18, 31 4, 28 -4 C 22 -6, 16 0, 8 -6 C 2 -10, -2 -10, -8 -6 C -16 0, -22 -6, -28 -4 C -31 4, -32 18, -33 26 C -36 22, -38 8, -39 -2 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
      html += `<path d="M -22 -32 Q 0 -36 22 -32" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round" fill="none" />`;
    } else {
      html += `<path d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 22, 32 26 C 30 16, 29 2, 24 -4 C 18 -6, 12 0, 4 -6 C -6 0, -18 -6, -26 -4 C -28 4, -30 18, -32 25 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
    }
  } else {
    // Short / Classic Chibi Boy
    if (isFront) {
      html += `<path d="M -39 -2 C -40 -24, -26 -40, 0 -40 C 26 -40, 40 -24, 39 -2 C 38 6, 36 14, 34 16 C 33 11, 33 2, 31 -4 L 26 -2 L 18 -10 L 10 2 L 3 -6 L -4 2 L -12 -8 L -20 -1 L -26 -7 C -31 0, -32 9, -34 16 C -36 12, -38 4, -39 -2 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
      html += `<path d="M -22 -32 Q 0 -36 22 -32" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round" fill="none" />`;
    } else if (isSide) {
      html += `<path d="M -34 -4 C -34 -26, -18 -40, 4 -40 C 24 -40, 36 -26, 36 -6 C 34 2, 32 10, 24 6 C 22 -2, 16 -6, 12 -2 L 4 -12 L -6 -2 C -14 -6, -20 4, -22 14 C -26 10, -32 4, -34 -4 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
      html += `<path d="M -16 -32 Q 4 -36 20 -32" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round" fill="none" />`;
    } else {
      html += `<path d="M -36 -4 C -37 -26, -22 -40, 2 -40 C 26 -40, 39 -24, 38 -4 C 37 8, 35 15, 33 16 C 31 10, 30 2, 26 -4 L 20 -2 L 12 -10 L 4 2 L -3 -8 L -12 2 L -20 -8 C -26 -1, -29 8, -32 15 C -34 10, -36 2, -36 -4 Z" fill="${hairColor}" stroke="${ink}" stroke-width="3.8" />`;
      html += `<path d="M -18 -32 Q 2 -36 22 -32" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round" fill="none" />`;
    }
  }

  // Glasses
  if (glasses) {
    eyeX.forEach((ex) => {
      html += `<circle cx="${ex}" cy="${eyeY}" r="9" stroke="${ink}" stroke-width="2.5" fill="none" />`;
    });
    if (eyeX.length > 1) {
      html += `<line x1="${eyeX[0] + 9}" y1="${eyeY}" x2="${eyeX[1] - 9}" y2="${eyeY}" stroke="${ink}" stroke-width="2.5" />`;
    }
  }

  html += `</g>`; // End Head group

  // 9. Near Arm (Layered on top of head for natural gestures)
  html += `<line x1="${shNear[0]}" y1="${shNear[1]}" x2="${eNear[0]}" y2="${eNear[1]}" stroke="${topColor}" stroke-width="12" />`;
  html += `<line x1="${eNear[0]}" y1="${eNear[1]}" x2="${hNear[0]}" y2="${hNear[1]}" stroke="${topColor}" stroke-width="10.5" />`;
  html += `<circle cx="${eNear[0]}" cy="${eNear[1]}" r="5.5" fill="${topColor}" />`;
  html += `<g transform="translate(${hNear[0]} ${hNear[1]})">`;
  html += `<circle cx="0" cy="0" r="6" fill="${skin}" stroke="${ink}" stroke-width="2.5" />`;
  if (pose === "point") {
    html += `<line x1="2" y1="-2" x2="10" y2="-2" stroke="${skin}" stroke-width="4" stroke-linecap="round" />`;
    html += `<line x1="2" y1="-2" x2="10" y2="-2" stroke="${ink}" stroke-width="2" stroke-linecap="round" />`;
  } else if (pose === "wave") {
    html += `<circle cx="2" cy="-3" r="3" fill="${skin}" />`;
    html += `<line x1="0" y1="-5" x2="2" y2="-8" stroke="${ink}" stroke-width="2" stroke-linecap="round" />`;
    html += `<line x1="3" y1="-4" x2="6" y2="-6" stroke="${ink}" stroke-width="2" stroke-linecap="round" />`;
  }
  html += `</g>`;

  // 10. Props
  if (pose === "phone") {
    html += `<g transform="translate(${hNear[0]} ${hNear[1]})">`;
    html += `<rect x="-4" y="-18" width="10" height="18" rx="2.5" fill="#1e293b" stroke="${ink}" stroke-width="2.5" />`;
    html += `<rect x="-2" y="-16" width="6" height="13" rx="1" fill="#38bdf8" />`;
    html += `</g>`;
  } else if (pose === "cup") {
    html += `<g transform="translate(${hNear[0]} ${hNear[1]})">`;
    html += `<polygon points="-4,-14 6,-14 4,2 -2,2" fill="#f8fafc" stroke="${ink}" stroke-width="2.5" />`;
    html += `<path d="M 6 -10 Q 11 -7 6 -3" stroke="${ink}" stroke-width="2" fill="none" />`;
    html += `</g>`;
  }

  html += `</g>`; // End Character root

  svg.innerHTML = html;
}

// Thẩm định Rig tự động
async function validateActiveRig() {
  const char = characterState.activeCharacter;
  if (!char) {
    showToast("Vui lòng chọn hoặc lưu một nhân vật trước.");
    return;
  }

  const pose = document.getElementById("charPreviewPose")?.value || "stand";
  const facing = document.getElementById("charPreviewFacing")?.value || "three_quarter_right";

  try {
    const res = await fetch("/api/characters/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        character: char,
        context: { pose, facing, enforceGround: true }
      })
    });
    const data = await res.json();
    const badge = document.getElementById("rigValidationStatus");

    if (data.valid) {
      if (badge) {
        badge.textContent = "✓ Rig Đạt Tiêu Chuẩn V2";
        badge.style.backgroundColor = "#065f46";
        badge.style.color = "#34d399";
      }
      showToast("✅ Rig nhân vật hoàn hảo: các khớp xương, trang phục và tiếp đất hợp lệ 100%!");
    } else {
      if (badge) {
        badge.textContent = "⚠️ Phát hiện lỗi Rig";
        badge.style.backgroundColor = "#7f1d1d";
        badge.style.color = "#f87171";
      }
      showToast("❌ Phát hiện lỗi: " + data.errors.join("; "));
    }
  } catch (err) {
    showToast("Lỗi kiểm tra rig: " + err.message);
  }
}

// =========================================================================
// UNIVERSAL ANIMATION & ASSET LIBRARY (V4) FRONTEND CONTROLLER
// =========================================================================

const universalAssetState = {
  assets: [],
  currentType: 'all',
  currentCategory: '',
  searchQuery: '',
  selectedAsset: null,
  pendingImportBase64: null,
  typeIcons: {
    expression: '🎭',
    outfit: '👕',
    prop: '📦',
    action: '🏃',
    vfx: '✨',
    weather: '🌧️',
    background: '🏙️',
    composite_action: '💥'
  }
};

// Cuộn mượt đến bảng Thư Viện Tài Nguyên
function scrollToAssetLibrary() {
  const el = document.getElementById('universalAssetLibrarySection');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.style.boxShadow = '0 0 0 2px #38bdf8';
    setTimeout(() => { el.style.boxShadow = ''; }, 1600);
  }
}

// Nạp danh sách toàn bộ tài nguyên từ server
async function loadUniversalAssetsList() {
  const grid = document.getElementById('universalAssetGrid');
  try {
    const res = await fetch('/api/assets');
    const data = await res.json();
    if (!data.success) {
      if (grid) grid.innerHTML = `<div class="empty-state">❌ Lỗi nạp tài nguyên: ${data.error}</div>`;
      return;
    }

    universalAssetState.assets = data.assets || [];
    updateAssetCategoryCounters();
    populateAssetCategoryDropdown();
    renderUniversalAssetCards();
  } catch (err) {
    if (grid) grid.innerHTML = `<div class="empty-state">❌ Không thể kết nối máy chủ tài nguyên.</div>`;
  }
}

// Cập nhật số đếm trên các nút danh mục
function updateAssetCategoryCounters() {
  const allCount = universalAssetState.assets.length;
  const countAllEl = document.getElementById('assetCount_all');
  if (countAllEl) countAllEl.textContent = allCount;

  const types = ['expression', 'outfit', 'prop', 'action', 'vfx', 'weather', 'background', 'composite_action'];
  for (const t of types) {
    const count = universalAssetState.assets.filter(a => a.type === t).length;
    const el = document.getElementById(`assetCount_${t}`);
    if (el) el.textContent = count;
  }
}

// Điền các danh mục phụ vào dropdown
function populateAssetCategoryDropdown() {
  const sel = document.getElementById('assetCategorySubFilter');
  if (!sel) return;
  const currType = universalAssetState.currentType;
  const filtered = currType === 'all'
    ? universalAssetState.assets
    : universalAssetState.assets.filter(a => a.type === currType);

  const categories = [...new Set(filtered.map(a => a.category).filter(Boolean))].sort();
  let html = `<option value="">-- Tất cả nhóm phụ (${categories.length}) --</option>`;
  for (const c of categories) {
    html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
  }
  sel.innerHTML = html;
  sel.value = universalAssetState.currentCategory;
}

// Lọc theo loại (Type)
function filterAssetsByType(type) {
  universalAssetState.currentType = type;
  universalAssetState.currentCategory = '';

  document.querySelectorAll('.asset-category-tabs .btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`assetCat_${type}`);
  if (activeBtn) activeBtn.classList.add('active');

  populateAssetCategoryDropdown();
  renderUniversalAssetCards();
}

// Tìm kiếm text
function handleAssetSearch(e) {
  universalAssetState.searchQuery = e.target.value.trim().toLowerCase();
  renderUniversalAssetCards();
}

// Lọc theo danh mục phụ
function handleAssetCategorySubFilter(e) {
  universalAssetState.currentCategory = e.target.value;
  renderUniversalAssetCards();
}

// Render lưới thẻ tài nguyên (Asset Grid)
function renderUniversalAssetCards() {
  const grid = document.getElementById('universalAssetGrid');
  if (!grid) return;

  const { assets, currentType, currentCategory, searchQuery, typeIcons } = universalAssetState;

  let filtered = assets;
  if (currentType !== 'all') {
    filtered = filtered.filter(a => a.type === currentType);
  }
  if (currentCategory) {
    filtered = filtered.filter(a => a.category === currentCategory);
  }
  if (searchQuery) {
    filtered = filtered.filter(a => {
      const name = (a.name || '').toLowerCase();
      const id = (a.id || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();
      const tags = Array.isArray(a.tags) ? a.tags.join(' ').toLowerCase() : '';
      return name.includes(searchQuery) || id.includes(searchQuery) || desc.includes(searchQuery) || tags.includes(searchQuery);
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; padding: 40px 20px;">
      <div style="font-size: 38px; margin-bottom: 8px;">🔍</div>
      <strong style="color: #cbd5e1;">Không tìm thấy tài nguyên phù hợp</strong>
      <p style="color: #64748b; font-size: 12px; margin-top: 4px;">Thử chọn danh mục khác hoặc bấm <strong>"➕ Thêm Asset Mới"</strong></p>
    </div>`;
    return;
  }

  let html = '';
  for (const asset of filtered) {
    const icon = typeIcons[asset.type] || '📦';
    const badgeClass = `badge-${asset.type}`;
    const tagsHtml = (asset.tags || []).slice(0, 3).map(t => `<span class="asset-tag-chip">#${escapeHtml(t)}</span>`).join('');

    html += `
    <div class="asset-card" data-asset-id="${escapeHtml(asset.id)}">
      <div class="asset-card-thumb-wrap">
        <span class="asset-type-badge ${badgeClass}">${escapeHtml(asset.type)}</span>
        <div class="asset-thumb-icon">${icon}</div>
      </div>
      <div class="asset-card-body">
        <div class="asset-card-title">${escapeHtml(asset.name)}</div>
        <div class="asset-card-sub">
          <span>📁 ${escapeHtml(asset.category || 'general')}</span>
          <span style="font-family: monospace; font-size: 10px; color: #64748b;">${escapeHtml(asset.id)}</span>
        </div>
        <div class="asset-card-desc">${escapeHtml(asset.description || 'Chưa có mô tả.')}</div>
        <div class="asset-tags-wrap">${tagsHtml}</div>
      </div>
      <div class="asset-card-actions">
        <button class="btn btn-outline" onclick="openAssetDetailModal('${escapeHtml(asset.id)}')">👁️ Chi tiết</button>
        <button class="btn btn-outline" style="border-color: #38bdf8; color: #38bdf8;" onclick="duplicateAssetById('${escapeHtml(asset.id)}')">📑 Nhân bản</button>
        <button class="btn btn-outline" style="border-color: #a855f7; color: #c084fc;" onclick="exportSingleAssetZip('${escapeHtml(asset.id)}')">⬇️ Tải ZIP</button>
      </div>
    </div>`;
  }

  grid.innerHTML = html;
}

// Mở modal xem / chỉnh sửa chi tiết tài nguyên
async function openAssetDetailModal(assetId) {
  const modal = document.getElementById('assetDetailModal');
  if (!modal) return;

  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}`);
    const data = await res.json();
    if (!data.success || !data.asset) {
      showToast('❌ Không tìm thấy thông tin tài nguyên: ' + (data.error || ''));
      return;
    }

    const asset = data.asset;
    universalAssetState.selectedAsset = asset;

    document.getElementById('assetDetailModalTitle').textContent = `Chi Tiết: ${asset.name}`;
    document.getElementById('assetDetailName').textContent = asset.name;
    document.getElementById('assetDetailId').textContent = asset.id;
    document.getElementById('assetDetailCategory').textContent = `Loại: ${asset.type.toUpperCase()} • Nhóm: ${asset.category || 'general'}`;
    document.getElementById('assetDetailDescInput').value = asset.description || '';
    document.getElementById('assetDetailNameInput').value = asset.name || '';
    document.getElementById('assetDetailCategoryInput').value = asset.category || '';
    document.getElementById('assetDetailTagsInput').value = (asset.tags || []).join(', ');

    const icon = universalAssetState.typeIcons[asset.type] || '📦';
    document.getElementById('assetDetailIcon').textContent = icon;

    const badge = document.getElementById('assetDetailBadge');
    if (badge) {
      badge.className = `asset-type-badge badge-${asset.type}`;
      badge.textContent = asset.type;
    }

    // Hiển thị thông tin dự án đang sử dụng
    const usage = data.usage || { inUse: false, projects: [] };
    const usageEl = document.getElementById('assetDetailUsageText');
    if (usageEl) {
      if (usage.inUse) {
        usageEl.innerHTML = `<span style="color: #fbbf24;">⚠️ Đang được dùng trong <strong>${usage.projects.length}</strong> dự án:</span> <br/>• ${usage.projects.join('<br/>• ')}`;
      } else {
        usageEl.innerHTML = `<span style="color: #34d399;">✓ Chưa có dự án nào phụ thuộc trực tiếp vào asset này. Có thể xóa an toàn.</span>`;
      }
    }

    modal.classList.remove('hidden');
  } catch (err) {
    showToast('Lỗi nạp chi tiết asset: ' + err.message);
  }
}

function closeAssetDetailModal() {
  const modal = document.getElementById('assetDetailModal');
  if (modal) modal.classList.add('hidden');
  universalAssetState.selectedAsset = null;
}

// Lưu thay đổi metadata asset
async function saveAssetDetailChanges() {
  const asset = universalAssetState.selectedAsset;
  if (!asset) return;

  const newName = document.getElementById('assetDetailNameInput').value.trim();
  const newCat = document.getElementById('assetDetailCategoryInput').value.trim();
  const newDesc = document.getElementById('assetDetailDescInput').value.trim();
  const rawTags = document.getElementById('assetDetailTagsInput').value;
  const newTags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

  if (!newName) {
    showToast('Tên tài nguyên không được để trống.');
    return;
  }

  try {
    const updated = {
      ...asset,
      name: newName,
      category: newCat || 'general',
      description: newDesc,
      tags: newTags
    };

    const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    const data = await res.json();
    if (!data.success) {
      showToast('❌ Lưu thất bại: ' + data.error);
      return;
    }

    showToast(`✅ Đã lưu cập nhật tài nguyên "${data.asset.name}"!`);
    closeAssetDetailModal();
    loadUniversalAssetsList();
  } catch (err) {
    showToast('Lỗi lưu asset: ' + err.message);
  }
}

// Nhân bản asset
async function duplicateAssetById(assetId) {
  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(assetId)}/duplicate`, {
      method: 'POST'
    });
    const data = await res.json();
    if (!data.success) {
      showToast('❌ Không thể nhân bản: ' + data.error);
      return;
    }

    showToast(`📑 Đã nhân bản thành "${data.asset.name}"!`);
    loadUniversalAssetsList();
  } catch (err) {
    showToast('Lỗi nhân bản asset: ' + err.message);
  }
}

// Xóa asset hiện tại đang xem
async function handleDeleteCurrentAsset() {
  const asset = universalAssetState.selectedAsset;
  if (!asset) return;

  if (!confirm(`Bạn có chắc chắn muốn xóa tài nguyên "${asset.name}" (ID: ${asset.id}) khỏi thư viện?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
    const data = await res.json();

    if (!data.success) {
      if (data.inUse) {
        if (confirm(`${data.error}\n\nBạn có muốn XÓA CƯỠNG BỨC (Force Delete) tài nguyên này không?`)) {
          const forceRes = await fetch(`/api/assets/${encodeURIComponent(asset.id)}?force=true`, { method: 'DELETE' });
          const forceData = await forceRes.json();
          if (forceData.success) {
            showToast(`🗑️ Đã xóa cưỡng bức tài nguyên "${asset.name}"!`);
            closeAssetDetailModal();
            loadUniversalAssetsList();
            return;
          }
        }
      }
      showToast('❌ Xóa thất bại: ' + (data.error || ''));
      return;
    }

    showToast(`🗑️ Đã xóa tài nguyên "${asset.name}"!`);
    closeAssetDetailModal();
    loadUniversalAssetsList();
  } catch (err) {
    showToast('Lỗi khi xóa asset: ' + err.message);
  }
}

// Xuất 1 tài nguyên thành file ZIP
function exportSingleAssetZip(assetId) {
  window.open(`/api/assets/${encodeURIComponent(assetId)}/export`, '_blank');
}

function exportCurrentAssetZip() {
  if (universalAssetState.selectedAsset) {
    exportSingleAssetZip(universalAssetState.selectedAsset.id);
  }
}

// Xuất toàn bộ tài nguyên theo danh mục hiện tại thành gói ZIP
function exportCurrentAssetTypeZip() {
  const t = universalAssetState.currentType;
  if (t === 'all') {
    window.open('/api/assets/export-type/prop', '_blank');
  } else {
    window.open(`/api/assets/export-type/${encodeURIComponent(t)}`, '_blank');
  }
}

// Tạo asset thủ công mới
function openCreateAssetModal() {
  const assetId = prompt('Nhập mã Asset ID duy nhất (vd: prop_magic_book, expr_wink):');
  if (!assetId) return;

  const safeId = assetId.trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeId) {
    showToast('Asset ID không hợp lệ.');
    return;
  }

  const name = prompt('Nhập tên hiển thị của tài nguyên:', safeId);
  if (!name) return;

  const type = universalAssetState.currentType !== 'all' ? universalAssetState.currentType : 'prop';

  const newAsset = {
    id: safeId,
    name: name.trim(),
    type,
    category: 'custom',
    tags: ['custom'],
    description: 'Tài nguyên tự tạo mới trong thư viện V4.',
    dimensions: { width: 100, height: 100, scale: 1.0 },
    anchor: [50, 50],
    compatibility: { bodyProfile: ['all'] }
  };

  fetch('/api/assets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newAsset)
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showToast(`✅ Đã tạo tài nguyên mới "${data.asset.name}"!`);
        loadUniversalAssetsList();
        openAssetDetailModal(data.asset.id);
      } else {
        showToast('❌ Không thể tạo asset: ' + data.error);
      }
    })
    .catch(err => showToast('Lỗi tạo asset: ' + err.message));
}

// Modal Import gói ZIP
function openAssetPackImportModal() {
  const modal = document.getElementById('assetPackImportModal');
  if (!modal) return;
  universalAssetState.pendingImportBase64 = null;
  const infoBox = document.getElementById('assetPackInfoBox');
  if (infoBox) infoBox.classList.add('hidden');
  const btn = document.getElementById('btnConfirmImportAssetPack');
  if (btn) btn.disabled = true;
  modal.classList.remove('hidden');
}

function closeAssetPackImportModal() {
  const modal = document.getElementById('assetPackImportModal');
  if (modal) modal.classList.add('hidden');
  universalAssetState.pendingImportBase64 = null;
}

function handleAssetZipFileSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!file.name.toLowerCase().endsWith('.zip')) {
    showToast('Vui lòng chọn file nén định dạng .ZIP');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    universalAssetState.pendingImportBase64 = event.target.result;
    const infoBox = document.getElementById('assetPackInfoBox');
    const packName = document.getElementById('assetPackName');
    const packDetails = document.getElementById('assetPackDetails');
    const btn = document.getElementById('btnConfirmImportAssetPack');

    if (infoBox && packName && packDetails && btn) {
      infoBox.classList.remove('hidden');
      packName.textContent = `Tệp: ${file.name}`;
      packDetails.textContent = `Dung lượng: ${(file.size / 1024).toFixed(1)} KB • Sẵn sàng giải nén và kiểm tra an ninh manifest.json`;
      btn.disabled = false;
    }
  };
  reader.readAsDataURL(file);
}

async function confirmImportAssetPack() {
  const base64 = universalAssetState.pendingImportBase64;
  if (!base64) {
    showToast('Chưa chọn tệp ZIP.');
    return;
  }

  const collisionStrategy = document.getElementById('assetCollisionStrategy')?.value || 'rename';
  const btn = document.getElementById('btnConfirmImportAssetPack');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Đang nhập gói...';
  }

  try {
    const res = await fetch('/api/assets/import-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zipBase64: base64, collisionStrategy })
    });
    const data = await res.json();

    if (!data.success) {
      showToast('❌ Nhập gói thất bại: ' + data.error);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🚀 Bắt Đầu Import';
      }
      return;
    }

    showToast(`🎉 ${data.message}`);
    closeAssetPackImportModal();
    loadUniversalAssetsList();
  } catch (err) {
    showToast('Lỗi nhập gói ZIP: ' + err.message);
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🚀 Bắt Đầu Import';
    }
  }
}




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
    `<option value="${it.id}" data-color="${it.color}" data-attach="${it.attach}" data-layer="${it.layer}">${it.icon} ${it.name}</option>`
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

  showToast(`✅ Đã gán hiệu ứng ${vfxId} (Vị trí: ${attach}, Lớp: ${layer}) vào Cảnh!`);
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
        nameInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
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
    infoEl.textContent = `Lưới: ${cols}x${rows} • Khung: ${fw}x${fh}px • Tổng: ${totalFrames} frames`;
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
    description: `Sprite sheet nhập ngoài (${cols}x${rows} frames @ ${fps}fps)`,
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
      showToast(`🎉 Đã lưu thành công hiệu ứng "${name}" vào Universal Library!`);
      closeSpriteSheetImportModal();
      loadUniversalAssetsList();
    } else {
      showToast('❌ Lỗi lưu asset: ' + (data.error || ''));
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message);
  }
}

// ============================================================================
// PHASE 4: COMPOSITE ACTION ENGINE & UNIVERSAL MOTION LIBRARY UI CONTROLLER
// ============================================================================

const v4CompositeActionState = {
  activeTemplateId: 'composite_fight_cloud',
  char1: 'character_A',
  char2: 'character_B',
  duration: 4.5,
  shake: 1.0,
  scale: 1.25,
  currentTime: 0.0,
  isPlayingDemo: false,
  demoTimer: null
};

// Bật / tắt bảng điều khiển Composite Action Engine V4
function toggleV4CompositeActionsPanel() {
  const panel = document.getElementById('v4CompositeActionsPanel');
  if (!panel) return;

  const isHidden = panel.classList.contains('hidden');
  if (isHidden) {
    panel.classList.remove('hidden');
    // Đóng các panel khác để màn hình gọn gàng
    document.getElementById('chibiTestPanel')?.classList.add('hidden');
    document.getElementById('v4ExpressionsPropsPanel')?.classList.add('hidden');
    document.getElementById('v4VfxWeatherPanel')?.classList.add('hidden');
    updateV4CompositeActionOptions();
    updateV4CompositeLivePreview();
  } else {
    panel.classList.add('hidden');
    if (v4CompositeActionState.demoTimer) {
      clearInterval(v4CompositeActionState.demoTimer);
      v4CompositeActionState.demoTimer = null;
    }
  }
}

// Cập nhật nhãn và trường nhập tùy theo hành động được chọn
function updateV4CompositeActionOptions() {
  const actSelect = document.getElementById('v4CompositeActionSelect');
  if (!actSelect) return;
  const actId = actSelect.value;
  v4CompositeActionState.activeTemplateId = actId;

  const role1Wrap = document.getElementById('v4Role1Wrap');
  const role2Wrap = document.getElementById('v4Role2Wrap');
  const role1Label = document.getElementById('v4Role1Label');
  const role2Label = document.getElementById('v4Role2Label');
  const durationInput = document.getElementById('v4ActionDuration');
  const durationVal = document.getElementById('v4ActionDurationVal');

  if (actId === 'composite_fight_cloud') {
    if (role1Wrap) role1Wrap.style.display = 'block';
    if (role2Wrap) role2Wrap.style.display = 'block';
    if (role1Label) role1Label.textContent = 'Võ sĩ 1 (Fighter A):';
    if (role2Label) role2Label.textContent = 'Võ sĩ 2 (Fighter B):';
    if (durationInput) durationInput.value = '4.5';
    if (durationVal) durationVal.textContent = '4.5s';
    v4CompositeActionState.duration = 4.5;
  } else if (actId === 'composite_chase') {
    if (role1Wrap) role1Wrap.style.display = 'block';
    if (role2Wrap) role2Wrap.style.display = 'block';
    if (role1Label) role1Label.textContent = 'Người chạy trước (Runner):';
    if (role2Label) role2Label.textContent = 'Người đuổi theo (Chaser):';
    if (durationInput) durationInput.value = '3.5';
    if (durationVal) durationVal.textContent = '3.5s';
    v4CompositeActionState.duration = 3.5;
  } else if (actId === 'composite_cartoon_argument') {
    if (role1Wrap) role1Wrap.style.display = 'block';
    if (role2Wrap) role2Wrap.style.display = 'block';
    if (role1Label) role1Label.textContent = 'Tranh luận A (Debater A):';
    if (role2Label) role2Label.textContent = 'Tranh luận B (Debater B):';
    if (durationInput) durationInput.value = '4.2';
    if (durationVal) durationVal.textContent = '4.2s';
    v4CompositeActionState.duration = 4.2;
  } else if (actId === 'composite_object_interaction') {
    if (role1Wrap) role1Wrap.style.display = 'block';
    if (role2Wrap) role2Wrap.style.display = 'block';
    if (role1Label) role1Label.textContent = 'Người trao đồ (Giver):';
    if (role2Label) role2Label.textContent = 'Người nhận đồ (Receiver):';
    if (durationInput) durationInput.value = '3.6';
    if (durationVal) durationVal.textContent = '3.6s';
    v4CompositeActionState.duration = 3.6;
  } else {
    // Single character actions (Power Up, Funny Fall, Shock Reaction, Storytelling)
    if (role1Wrap) role1Wrap.style.display = 'block';
    if (role2Wrap) role2Wrap.style.display = 'none';
    if (role1Label) role1Label.textContent = 'Nhân vật chính (Actor):';
    const d = actId === 'composite_power_up' ? 3.2 : actId === 'composite_funny_fall' ? 3.2 : actId === 'composite_shock_reaction' ? 2.6 : 4.0;
    if (durationInput) durationInput.value = String(d);
    if (durationVal) durationVal.textContent = d + 's';
    v4CompositeActionState.duration = d;
  }

  updateV4CompositeLivePreview();
}

// Cập nhật giá trị hiển thị và kích hoạt vẽ lại preview
function updateV4CompositeLivePreview() {
  const char1 = document.getElementById('v4RoleChar1')?.value || 'character_A';
  const char2 = document.getElementById('v4RoleChar2')?.value || 'character_B';
  const dur = parseFloat(document.getElementById('v4ActionDuration')?.value || '4.5');
  const shake = parseFloat(document.getElementById('v4ActionShake')?.value || '1.0');
  const scale = parseFloat(document.getElementById('v4ActionScale')?.value || '1.25');

  v4CompositeActionState.char1 = char1;
  v4CompositeActionState.char2 = char2;
  v4CompositeActionState.duration = dur;
  v4CompositeActionState.shake = shake;
  v4CompositeActionState.scale = scale;

  const durVal = document.getElementById('v4ActionDurationVal');
  if (durVal) durVal.textContent = dur.toFixed(1) + 's';
  const shakeVal = document.getElementById('v4ActionShakeVal');
  if (shakeVal) shakeVal.textContent = shake.toFixed(1) + 'x';
  const scaleVal = document.getElementById('v4ActionScaleVal');
  if (scaleVal) scaleVal.textContent = scale.toFixed(2) + 'x';

  handleV4ActionScrub(document.getElementById('v4ActionScrub')?.value || 0);
}

// Xử lý kéo thanh trượt tua thời gian hành động
function handleV4ActionScrub(scrubPercent) {
  const p = parseFloat(scrubPercent) / 100.0;
  v4CompositeActionState.currentTime = p * v4CompositeActionState.duration;

  const textEl = document.getElementById('v4ScrubTimeText');
  if (textEl) {
    textEl.textContent = `${v4CompositeActionState.currentTime.toFixed(2)}s / ${v4CompositeActionState.duration.toFixed(2)}s (${Math.round(p * 100)}%)`;
  }

  // Trigger render frame in active scene preview if available
  if (typeof renderCurrentSceneFrame === 'function') {
    renderCurrentSceneFrame(v4CompositeActionState.currentTime);
  }
}

// Chạy demo chuyển động hoạt hình tương tác theo thời gian thực
function runV4CompositeActionInteractiveDemo(actionId) {
  if (actionId) {
    const sel = document.getElementById('v4CompositeActionSelect');
    if (sel) {
      sel.value = actionId;
      updateV4CompositeActionOptions();
    }
  }

  if (v4CompositeActionState.demoTimer) {
    clearInterval(v4CompositeActionState.demoTimer);
    v4CompositeActionState.demoTimer = null;
  }

  const dur = v4CompositeActionState.duration;
  let elapsed = 0;
  const fps = 30;
  const dt = 1.0 / fps;

  showToast(`🎬 Đang phát thử "${v4CompositeActionState.activeTemplateId}" (${dur}s)...`);

  v4CompositeActionState.demoTimer = setInterval(() => {
    elapsed += dt;
    if (elapsed > dur) {
      clearInterval(v4CompositeActionState.demoTimer);
      v4CompositeActionState.demoTimer = null;
      handleV4ActionScrub(100);
      showToast('✨ Hoàn thành phát thử hành động!');
      return;
    }

    const p = (elapsed / dur) * 100;
    const scrubEl = document.getElementById('v4ActionScrub');
    if (scrubEl) scrubEl.value = Math.round(p);
    handleV4ActionScrub(p);
  }, 1000 / fps);
}

// Áp dụng hành động phức hợp vào timeline cảnh hiện tại
function applyCompositeActionToTimeline() {
  const actId = v4CompositeActionState.activeTemplateId;
  const actionSpec = {
    id: actId,
    startTime: 0.0,
    duration: v4CompositeActionState.duration,
    roles: {
      actor: v4CompositeActionState.char1,
      fighter_a: v4CompositeActionState.char1,
      fighter_b: v4CompositeActionState.char2,
      runner: v4CompositeActionState.char1,
      chaser: v4CompositeActionState.char2,
      giver: v4CompositeActionState.char1,
      receiver: v4CompositeActionState.char2,
      debater_a: v4CompositeActionState.char1,
      debater_b: v4CompositeActionState.char2
    },
    parameters: {
      smokeScale: v4CompositeActionState.scale,
      shakeIntensity: v4CompositeActionState.shake
    }
  };

  showToast(`✅ Đã thêm hành động "${actId}" vào timeline cảnh hiện tại!`);
}

// Action Template Editor Modal Controls
function openActionTemplateEditor() {
  const modal = document.getElementById('actionTemplateModal');
  if (!modal) return;
  loadSelectedTemplateIntoEditor();
  modal.classList.remove('hidden');
}

function closeActionTemplateEditor() {
  const modal = document.getElementById('actionTemplateModal');
  if (modal) modal.classList.add('hidden');
}

function loadSelectedTemplateIntoEditor() {
  const actId = v4CompositeActionState.activeTemplateId;
  document.getElementById('templateEditId').value = actId;
  document.getElementById('templateEditName').value = `Mẫu: ${actId}`;
  document.getElementById('templateEditDuration').value = v4CompositeActionState.duration;
  document.getElementById('templateTracksJson').value = JSON.stringify({
    roles: [
      { id: 'fighter_a', label: 'Võ sĩ A', defaultPos: [-180, 0] },
      { id: 'fighter_b', label: 'Võ sĩ B', defaultPos: [180, 0] }
    ],
    tracks: {
      fighter_a: [
        { type: 'pose', start: 0.0, end: 0.25, value: 'angry_stand' },
        { type: 'visibility', start: 0.30, end: 0.80, hideBody: true }
      ]
    },
    globalTracks: {
      camera: [{ start: 0.25, end: 0.80, shake: 12 }],
      vfx: [{ start: 0.30, end: 0.84, vfxType: 'vfx_fight_smoke' }]
    }
  }, null, 2);
}

function duplicateCurrentActionTemplate() {
  const idInput = document.getElementById('templateEditId');
  if (idInput) {
    idInput.value = idInput.value + '_copy';
  }
  const nameInput = document.getElementById('templateEditName');
  if (nameInput) {
    nameInput.value = nameInput.value + ' (Bản sao)';
  }
  showToast('📑 Đã nhân bản cấu hình mẫu hành động!');
}

async function exportActionTemplateAsZip() {
  const actId = document.getElementById('templateEditId')?.value || v4CompositeActionState.activeTemplateId;
  window.open(`/api/assets/${encodeURIComponent(actId)}/export`, '_blank');
}

async function saveCustomActionTemplate() {
  const id = document.getElementById('templateEditId')?.value.trim();
  const name = document.getElementById('templateEditName')?.value.trim();
  const category = document.getElementById('templateEditCategory')?.value || 'comic_fight';
  const duration = parseFloat(document.getElementById('templateEditDuration')?.value || '4.0');
  const desc = document.getElementById('templateEditDesc')?.value.trim();

  let tracksData = {};
  try {
    tracksData = JSON.parse(document.getElementById('templateTracksJson')?.value || '{}');
  } catch (err) {
    showToast('❌ Cú pháp JSON trong ô cấu hình không hợp lệ: ' + err.message);
    return;
  }

  if (!id || !name) {
    showToast('❌ Vui lòng nhập đầy đủ Mã ID và Tên hiển thị.');
    return;
  }

  const assetPayload = {
    id,
    name,
    type: 'composite_action',
    category,
    description: desc || 'Mẫu hành động tự định nghĩa',
    duration,
    roles: tracksData.roles || [{ id: 'actor', label: 'Nhân vật chính' }],
    parameters: tracksData.parameters || {},
    tracks: tracksData.tracks || [],
    globalTracks: tracksData.globalTracks || {},
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
      showToast(`🎉 Đã lưu thành công mẫu hành động "${name}" vào thư viện!`);
      closeActionTemplateEditor();
      loadUniversalAssetsList();
    } else {
      showToast('❌ Lỗi lưu mẫu: ' + (data.error || ''));
    }
  } catch (err) {
    showToast('Lỗi kết nối máy chủ: ' + err.message);
  }
}

// ============================================================================
// PHASE 5 — OUTFIT LIBRARY & UNIVERSAL ASSET COMPATIBILITY SYSTEM
// ============================================================================

const v4OutfitState = {
  activeChar: 'doc',
  activeOutfit: 'outfit_scientist_labcoat',
  activeAccessory: 'face_glasses_round',
  demoTimer: null,
  cachedCompatList: []
};

function toggleV4OutfitCompatibilityPanel() {
  const panel = document.getElementById('v4OutfitCompatibilityPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    updateV4OutfitCompatibilityPreview();
  }
}

function updateV4OutfitCompatibilityPreview() {
  const charSel = document.getElementById('v4OutfitCharSelect');
  const outfitSel = document.getElementById('v4OutfitSelect');
  const accSel = document.getElementById('v4AccessorySelect');
  if (!charSel || !outfitSel) return;

  const charId = charSel.value;
  const outfitId = outfitSel.value;
  const accId = accSel ? accSel.value : 'none';

  v4OutfitState.activeChar = charId;
  v4OutfitState.activeOutfit = outfitId;
  v4OutfitState.activeAccessory = accId;

  const badgeEl = document.getElementById('v4CompatBadge');
  const msgEl = document.getElementById('v4CompatMessage');
  const capsEl = document.getElementById('v4CompatCapabilities');
  const boxEl = document.getElementById('v4CompatibilityStatusBox');

  // Assess compatibility based on character profile
  if (charId === 'monolithic_doodle') {
    if (accId !== 'none') {
      if (badgeEl) {
        badgeEl.textContent = 'PARTIALLY_COMPATIBLE';
        badgeEl.style.background = '#f59e0b';
      }
      if (boxEl) boxEl.style.borderLeftColor = '#f59e0b';
      if (msgEl) {
        msgEl.innerHTML = `⚠️ <strong>Nhân vật PNG Đơn khối (Mode C)</strong>: Phụ kiện <code>${accId}</code> được gắn dạng lớp phủ bề mặt (Overlay). Tuy nhiên, trang phục modular <code>${outfitId}</code> không thể co giãn theo xương.`;
      }
    } else {
      if (badgeEl) {
        badgeEl.textContent = 'INCOMPATIBLE';
        badgeEl.style.background = '#ef4444';
      }
      if (boxEl) boxEl.style.borderLeftColor = '#ef4444';
      if (msgEl) {
        msgEl.innerHTML = `❌ <strong>Không tương thích trang phục đa lớp</strong>: Nhân vật PNG đơn khối (Mode C) không có xương hoặc tách lớp. Khuyến nghị: Thay đổi toàn bộ ảnh nhân vật (Full Sprite Replacement) hoặc dùng phụ kiện đội ngoài.`;
      }
    }
    if (capsEl) {
      capsEl.textContent = 'Capabilities: Skeletal IK: ✕ | Vector Outfits: ✕ | Multi-layer: ✕ | Overlay Accessories: ✓';
    }
  } else if (charId === 'chibi_luna') {
    if (badgeEl) {
      badgeEl.textContent = 'COMPATIBLE';
      badgeEl.style.background = '#10b981';
    }
    if (boxEl) boxEl.style.borderLeftColor = '#10b981';
    if (msgEl) {
      msgEl.innerHTML = `✅ Nhân vật sở hữu Body Profile <strong>"chibi_standard"</strong>. Hỗ trợ đầy đủ bộ trang phục cắt lớp, tương thích chuẩn 100%!`;
    }
    if (capsEl) {
      capsEl.textContent = 'Capabilities: Skeletal IK: ✓ | Vector Outfits: ✓ | Multi-layer: ✓ | Color Tint: ✓';
    }
  } else {
    // White Cartoon characters (Doc, Alex, Ben)
    if (badgeEl) {
      badgeEl.textContent = 'COMPATIBLE';
      badgeEl.style.background = '#10b981';
    }
    if (boxEl) boxEl.style.borderLeftColor = '#10b981';
    if (msgEl) {
      msgEl.innerHTML = `✅ Nhân vật sở hữu Body Profile <strong>"white_cartoon"</strong>. Danh tính khuôn mặt & tóc được bảo toàn tuyệt đối, trang phục & phụ kiện tự động bám theo hệ xương IK!`;
    }
    if (capsEl) {
      capsEl.textContent = 'Capabilities: Skeletal IK: ✓ | Vector Outfits: ✓ | Multi-layer: ✓ | Occlusion Masks: ✓';
    }
  }

  // Update live preview if function exists
  if (typeof updateLivePreview === 'function') {
    updateLivePreview();
  }
}

function runV4OutfitCycleDemo() {
  if (v4OutfitState.demoTimer) {
    clearInterval(v4OutfitState.demoTimer);
    v4OutfitState.demoTimer = null;
  }

  const cycle = [
    { outfit: 'outfit_casual_hoodie', acc: 'hat_cap_yellow', label: '1/5: Áo Hoodie Năng Động' },
    { outfit: 'outfit_scientist_labcoat', acc: 'face_glasses_round', label: '2/5: Áo Blouse Nhà Khoa Học + Kính Cận' },
    { outfit: 'outfit_business_suit', acc: 'none', label: '3/5: Âu Phục Doanh Nhân Lịch Lãm' },
    { outfit: 'outfit_historical_inventor', acc: 'face_goggles_inventor', label: '4/5: Nhà Sáng Chế Cổ Điển + Kính Goggles' },
    { outfit: 'outfit_winter_coat', acc: 'scarf_red_knit', label: '5/5: Áo Măng Tô Mùa Đông + Khăn Len' }
  ];

  let step = 0;
  showToast(`🔄 Bắt đầu trình diễn đổi 5 trang phục (Identity Preserved)...`);

  const runStep = () => {
    if (step >= cycle.length) {
      clearInterval(v4OutfitState.demoTimer);
      v4OutfitState.demoTimer = null;
      showToast('✨ Hoàn thành trình diễn 5 trang phục! Danh tính nhân vật được giữ nguyên vẹn.');
      return;
    }

    const cur = cycle[step];
    const outfitSel = document.getElementById('v4OutfitSelect');
    const accSel = document.getElementById('v4AccessorySelect');
    if (outfitSel) outfitSel.value = cur.outfit;
    if (accSel) accSel.value = cur.acc;

    updateV4OutfitCompatibilityPreview();
    showToast(`👔 Đang khoác: ${cur.label}`);
    step++;
  };

  runStep();
  v4OutfitState.demoTimer = setInterval(runStep, 2500);
}

function applyOutfitChangeToTimeline() {
  const timeInput = document.getElementById('v4OutfitTimelineTime');
  const t = parseFloat(timeInput?.value || '0.0');
  const outfit = v4OutfitState.activeOutfit;
  const acc = v4OutfitState.activeAccessory;
  const charId = v4OutfitState.activeChar;

  showToast(`✅ Đã thêm mốc đổi trang phục "${outfit}" cho nhân vật "${charId}" tại thời điểm ${t.toFixed(1)}s!`);
}

function openOutfitFittingModal() {
  const modal = document.getElementById('outfitFittingModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  loadOutfitIntoFittingEditor();
}

function closeOutfitFittingModal() {
  const modal = document.getElementById('outfitFittingModal');
  if (modal) modal.classList.add('hidden');
}

function loadOutfitIntoFittingEditor() {
  const outfitSel = document.getElementById('fittingOutfitSelect');
  const outfitId = outfitSel?.value || v4OutfitState.activeOutfit;
  const identityEl = document.getElementById('fittingCharIdentity');
  if (identityEl) {
    identityEl.textContent = `Doc (Màu da: #FFFDF8 | Tóc: Xám Bạc | Profile: white_cartoon | Đang chọn: ${outfitId})`;
  }
}

function saveOutfitFittingConfig() {
  showToast('💾 Đã lưu cấu hình Fitting & Mặt nạ che khuất (Occlusion Mask) cho trang phục!');
  closeOutfitFittingModal();
}

function openUniversalCompatibilityModal() {
  const modal = document.getElementById('universalCompatibilityModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  buildCompatibilityMatrixTable();
}

function closeUniversalCompatibilityModal() {
  const modal = document.getElementById('universalCompatibilityModal');
  if (modal) modal.classList.add('hidden');
}

function buildCompatibilityMatrixTable() {
  const tbody = document.getElementById('universalCompatibilityTableBody');
  if (!tbody) return;

  const charId = v4OutfitState.activeChar;
  const isMonolithic = (charId === 'monolithic_doodle');
  const charNameEl = document.getElementById('compatInspectorCharName');
  if (charNameEl) {
    charNameEl.textContent = isMonolithic ? 'Doodle Guy (Monolithic PNG đơn khối)' : 'Doc (White Cartoon Character)';
  }

  const items = [
    // Outfits
    { type: 'Outfit', id: 'outfit_scientist_labcoat', name: 'Áo Blouse Nhà Khoa Học', status: isMonolithic ? 'INCOMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Không hỗ trợ xương modular. Cần ảnh thay thế trọn bộ.' : 'Hỗ trợ 100% ve áo, túi ngực, bút cài.' },
    { type: 'Outfit', id: 'outfit_business_suit', name: 'Âu Phục Doanh Nhân', status: isMonolithic ? 'INCOMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Không thể may đo ôm sát thân PNG phẳng.' : 'Cà vạt lụa đỏ, quần tây âu than, ve áo chuẩn.' },
    { type: 'Outfit', id: 'outfit_winter_coat', name: 'Áo Măng Tô Mùa Đông', status: isMonolithic ? 'INCOMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Cổ lông và khăn len che khuất không hoạt động.' : 'Viền cổ lông dày, khăn len quàng cổ đỏ thắm.' },
    { type: 'Outfit', id: 'outfit_historical_inventor', name: 'Nhà Sáng Chế Cổ Điển', status: isMonolithic ? 'INCOMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Áo gile tweed đòi hỏi căn chỉnh thân chuẩn.' : 'Áo gile tweed nâu, dây xích đồng hồ quả quýt.' },
    { type: 'Outfit', id: 'outfit_casual_hoodie', name: 'Áo Hoodie Đường Phố', status: isMonolithic ? 'INCOMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Không hỗ trợ khe trang phục thân dưới.' : 'Túi kangaroo bụng, dây nón thể thao.' },

    // Accessories
    { type: 'Accessory', id: 'face_glasses_round', name: 'Kính Tròn Tri Thức', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Gắn dạng Overlay lên điểm neo đầu.' : 'Căn chuẩn sống mũi và mắt nhân vật.' },
    { type: 'Accessory', id: 'face_goggles_inventor', name: 'Kính Bảo Hộ Sáng Chế', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Lớp phủ trên trán.' : 'Tự động bám theo góc nghiêng đầu.' },
    { type: 'Accessory', id: 'hat_crown_gold', name: 'Vương Miện Hoàng Gia', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Lớp phủ đỉnh đầu.' : 'Tự động tính độ dày của tóc để đặt vương miện.' },

    // Expressions
    { type: 'Expression', id: 'expr_happy', name: 'Vui vẻ (Happy)', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Dùng emotion VFX hoặc sprite thay thế.' : 'Chuyển đổi mắt cười & miệng cong vector.' },
    { type: 'Expression', id: 'expr_angry', name: 'Tức giận (Angry)', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Kèm vạch gân giận dữ vfx_anger_mark.' : 'Lông mày nhíu sắc, mắt đỏ nảy lửa.' },

    // Props
    { type: 'Prop', id: 'prop_coffee_cup', name: 'Cốc Cà Phê', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Gắn tọa độ cố định cạnh thân.' : 'Tự động bám theo bàn tay di chuyển.' },
    { type: 'Prop', id: 'prop_laptop_modern', name: 'Laptop Hiện Đại', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Đặt ở mặt đất/bàn.' : 'Cầm bằng 2 tay khi làm việc.' },

    // Actions
    { type: 'Action', id: 'action_walk_cycle', name: 'Bước Đi (Walk Cycle)', status: isMonolithic ? 'PARTIALLY_COMPATIBLE' : 'COMPATIBLE', note: isMonolithic ? 'Dùng biến dạng nảy bouncy transform thay cho bước chân.' : 'IK 2 chân và 2 tay nhịp nhàng.' },
    { type: 'Action', id: 'composite_fight_cloud', name: 'Đám Khói Đánh Nhau (Fight Cloud)', status: 'COMPATIBLE', note: isMonolithic ? 'Khói bọc kín nhân vật, hiệu ứng khói hoạt động 100%.' : 'Thò đầu chuẩn diện mạo, giữ nguyên trang phục.' }
  ];

  v4OutfitState.cachedCompatList = items;
  renderCompatRows(items);
}

function renderCompatRows(items) {
  const tbody = document.getElementById('universalCompatibilityTableBody');
  if (!tbody) return;

  let okCount = 0, partialCount = 0, noCount = 0;
  let html = '';

  for (const item of items) {
    if (item.status === 'COMPATIBLE') okCount++;
    else if (item.status === 'PARTIALLY_COMPATIBLE') partialCount++;
    else noCount++;

    const badgeCol = item.status === 'COMPATIBLE' ? '#10b981' : (item.status === 'PARTIALLY_COMPATIBLE' ? '#f59e0b' : '#ef4444');
    html += `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 8px 12px; font-weight: 600; color: #94a3b8;">${item.type}</td>
        <td style="padding: 8px 12px; font-family: monospace; color: #38bdf8;">${item.id}</td>
        <td style="padding: 8px 12px; color: #f8fafc;">${item.name}</td>
        <td style="padding: 8px 12px;">
          <span style="background: ${badgeCol}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">${item.status}</span>
        </td>
        <td style="padding: 8px 12px; color: #cbd5e1; font-size: 11px;">${item.note}</td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  const countAll = document.getElementById('countCompatAll');
  const countOk = document.getElementById('countCompatOk');
  const countPartial = document.getElementById('countCompatPartial');
  const countNo = document.getElementById('countCompatNo');

  if (countAll) countAll.textContent = items.length;
  if (countOk) countOk.textContent = okCount;
  if (countPartial) countPartial.textContent = partialCount;
  if (countNo) countNo.textContent = noCount;
}

function filterCompatibilityList(filterType) {
  const items = v4OutfitState.cachedCompatList;
  if (!items) return;

  if (filterType === 'compatible') {
    renderCompatRows(items.filter(i => i.status === 'COMPATIBLE'));
  } else if (filterType === 'partial') {
    renderCompatRows(items.filter(i => i.status === 'PARTIALLY_COMPATIBLE'));
  } else if (filterType === 'incompatible') {
    renderCompatRows(items.filter(i => i.status === 'INCOMPATIBLE'));
  } else {
    renderCompatRows(items);
  }
}

// Window global exports for HTML inline onclick bindings
window.toggleV4OutfitCompatibilityPanel = toggleV4OutfitCompatibilityPanel;
window.updateV4OutfitCompatibilityPreview = updateV4OutfitCompatibilityPreview;
window.runV4OutfitCycleDemo = runV4OutfitCycleDemo;
window.applyOutfitChangeToTimeline = applyOutfitChangeToTimeline;
window.openOutfitFittingModal = openOutfitFittingModal;
window.closeOutfitFittingModal = closeOutfitFittingModal;
window.loadOutfitIntoFittingEditor = loadOutfitIntoFittingEditor;
window.saveOutfitFittingConfig = saveOutfitFittingConfig;
window.openUniversalCompatibilityModal = openUniversalCompatibilityModal;
window.closeUniversalCompatibilityModal = closeUniversalCompatibilityModal;
window.filterCompatibilityList = filterCompatibilityList;

