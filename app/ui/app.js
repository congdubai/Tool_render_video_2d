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
  const engine = project?.engine || "remotion";
  const isRemotion = engine === "remotion" || !engine || engine === "auto";

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

// Chọn nhanh Demo project Chibi 2D Cut-out (10s)
function selectChibiDemoProject() {
  const select = document.getElementById("aiProjectSelect");
  const chibi = aiState.projects.find((p) => p.id === "sample_chibi-engine-demo-10s" || p.id.includes("chibi-engine-demo"));
  if (chibi && select) {
    select.value = chibi.id;
    handleAiProjectChanged();
    showToast(`👶 Đã chọn dự án mẫu Chibi 2D Engine: "${chibi.name}"`);
  } else {
    showToast("Đang tải lại danh sách dự án...");
    loadAiProjectsList();
  }
}

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

// Chọn nhanh Demo project Python 2D Long Form (The Marshmallow Test - 31 Shots)
function selectPythonDemoProject() {
  const select = document.getElementById("aiProjectSelect");
  const pyDemo = aiState.projects.find((p) => p.id === "python_marshmallow" || p.engine === "python-2d-long-form");
  if (pyDemo && select) {
    select.value = pyDemo.id;
    handleAiProjectChanged();
    showToast(`🐍 Đã chọn dự án mẫu Python 2D Long Form: "${pyDemo.name}"`);
  } else {
    showToast("Đang tải lại danh sách dự án...");
    loadAiProjectsList();
  }
}

// Khi người dùng chủ động đổi Engine trên dropdown
function handleEngineSelectChanged() {
  const engineSelect = document.getElementById("aiEngineSelect");
  const chosen = engineSelect ? engineSelect.value : "auto";
  aiState.manualEngineOverride = chosen;
  showToast(`⚙️ Đã chuyển Engine sang: ${chosen === "auto" ? "Tự động nhận diện" : chosen}`);
  validateCurrentAiProject();
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

  const engine = project.engine || "remotion";
  const isPython = engine === "python-2d-long-form";
  const isTH = engine === "thanhhai-2d-studio" || engine === "thanhhai_2d";

  // Cập nhật dropdown engine
  const engineSelect = document.getElementById("aiEngineSelect");
  if (engineSelect && (!aiState.manualEngineOverride || aiState.manualEngineOverride === "auto")) {
    engineSelect.value = isPython ? "python-2d-long-form" : isTH ? "thanhhai-2d-studio" : "remotion";
  }

  const engineBadge = document.getElementById("aiBadgeEngine");
  const engineTag = document.getElementById("aiEngineTag");
  const btnContactSheet = document.getElementById("btnAiContactSheet");

  if (engineBadge) {
    if (isPython) {
      engineBadge.textContent = "Engine: Python 2D Long Form (Skia)";
      engineBadge.style.color = "#34d399";
      engineBadge.style.borderColor = "#10b981";
    } else if (isTH) {
      engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
      engineBadge.style.color = "#c084fc";
      engineBadge.style.borderColor = "#a855f7";
    } else {
      engineBadge.textContent = "Engine: Remotion 2D";
      engineBadge.style.color = "#38bdf8";
      engineBadge.style.borderColor = "#0284c7";
    }
  }

  if (engineTag) {
    if (isPython) {
      engineTag.textContent = "PYTHON / SKIA";
      engineTag.style.backgroundColor = "#059669";
    } else if (isTH) {
      engineTag.textContent = "CANVAS / THREE.JS";
      engineTag.style.backgroundColor = "#7c3aed";
    } else {
      engineTag.textContent = "REMOTION TSX";
      engineTag.style.backgroundColor = "#0284c7";
    }
  }

  if (btnContactSheet) {
    // Contact Sheet hỗ trợ cả Thanh Hai và Python Long Form
    if (isPython || isTH) {
      btnContactSheet.classList.remove("hidden");
    } else {
      btnContactSheet.classList.add("hidden");
    }
  }

  // Hiển thị thông tin tổng quan
  document.getElementById("aiProjectNameTitle").textContent = project.name || project.folderName;
  document.getElementById("aiProjectTag").textContent = project.isDemo ? "MẪU KIỂM THỬ CHUẨN" : "DỰ ÁN ĐÃ IMPORT";

  const cfg = project.config || {};
  document.getElementById("aiBadgeRes").textContent = `${cfg.width || 1920}×${cfg.height || 1080}`;
  document.getElementById("aiBadgeFps").textContent = `${cfg.fps || 30} FPS`;
  const durSec = ((cfg.durationInFrames || 300) / (cfg.fps || 30)).toFixed(1);
  document.getElementById("aiBadgeDuration").textContent = `${cfg.durationInFrames || 300} frames (~${durSec}s)`;

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
    const engine = data.engine || val.engine || "remotion";
    const isPython = engine === "python-2d-long-form";
    const isTH = engine === "thanhhai-2d-studio" || engine === "thanhhai_2d";

    // Cập nhật compositions thực tế nếu là Remotion
    if (!isPython && !isTH) {
      const realComps = data.compositions || val.compositions || [];
      if (realComps.length > 0) {
        aiState.availableCompositions = realComps;
        const exists = realComps.some(c => (typeof c === "string" ? c : c.id) === aiState.selectedCompositionId);
        if (!exists || realComps.length === 1) {
          aiState.selectedCompositionId = typeof realComps[0] === "string" ? realComps[0] : realComps[0].id;
        }
        updateAiCompositionDropdown(aiState.availableCompositions, aiState.selectedCompositionId);
      }
    }

    // Cập nhật nhãn Badge Engine
    const engineBadge = document.getElementById("aiBadgeEngine");
    const engineTag = document.getElementById("aiEngineTag");
    const btnContactSheet = document.getElementById("btnAiContactSheet");

    if (engineBadge) {
      if (isPython) {
        engineBadge.textContent = "Engine: Python 2D Long Form (Skia)";
        engineBadge.style.color = "#34d399";
        engineBadge.style.borderColor = "#10b981";
      } else if (isTH) {
        engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
        engineBadge.style.color = "#c084fc";
        engineBadge.style.borderColor = "#a855f7";
      } else {
        engineBadge.textContent = "Engine: Remotion 2D";
        engineBadge.style.color = "#38bdf8";
        engineBadge.style.borderColor = "#0284c7";
      }
    }
    if (engineTag) {
      if (isPython) {
        engineTag.textContent = "PYTHON / SKIA";
        engineTag.style.backgroundColor = "#059669";
      } else if (isTH) {
        engineTag.textContent = "CANVAS / THREE.JS";
        engineTag.style.backgroundColor = "#7c3aed";
      } else {
        engineTag.textContent = "REMOTION TSX";
        engineTag.style.backgroundColor = "#0284c7";
      }
    }
    if (btnContactSheet) {
      if (isPython || isTH) btnContactSheet.classList.remove("hidden");
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
        html = '<div class="empty-state" style="padding: 10px;">Dự án dùng tài nguyên dựng sẵn hoặc vẽ trực tiếp bằng Skia / Canvas.</div>';
      } else {
        val.assets.found.forEach((a) => {
          html += `<div class="asset-item"><span>🔊 ${escapeHtml(a)}</span> <span class="asset-badge-found">✅ Đã có</span></div>`;
        });
        val.assets.missing.forEach((a) => {
          html += `<div class="asset-item"><span>⚡ ${escapeHtml(a)}</span> <span class="asset-badge-missing">⚡ Tự động tổng hợp AI</span></div>`;
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
    if (isPython) {
      // Giao diện thẩm định chuẩn cho Python 2D Long Form
      const cfg = val.config || {};
      reportHtml += `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 12px;">
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">ENGINE:</span><br/>
            <strong style="color: #34d399; font-family: monospace;">Python 2D Long Form (Skia)</strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">STORYBOARD & SHOTS:</span><br/>
            <strong style="color: #38bdf8; font-family: monospace;">${cfg.shotsCount || 0} cảnh (${cfg.mood || 'mystery'} mood)</strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">GIỌNG ĐỌC:</span><br/>
            <strong style="color: ${cfg.hasVoice ? '#10b981' : '#f59e0b'}; font-family: monospace;">
              ${cfg.hasVoice ? '✅ ' + (cfg.voiceFile || 'voice.wav') : '⚡ Tự động tạo giọng AI khi render'}
            </strong>
          </div>
          <div style="background: #1e293b; padding: 10px; border-radius: 6px;">
            <span style="color: #94a3b8; font-size: 11px;">MÔI TRƯỜNG THỰC THI:</span><br/>
            <strong style="color: #10b981;">Python 3.11 + Skia + FFmpeg</strong>
          </div>
        </div>
      `;
    } else if (isTH) {
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
            <strong style="color: #38bdf8; font-family: monospace;">${aiState.selectedCompositionId || val.config?.compositionId || 'MainVideo'}</strong>
            ${(aiState.availableCompositions && aiState.availableCompositions.length > 1) ? `<span style="color: #94a3b8; font-size: 11px;">(${aiState.availableCompositions.length} comps)</span>` : ''}
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

    const res = await fetch("/api/ai-code/contact-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, engineOverride })
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
    const res = await fetch("/api/ai-code/preview-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, frame, compositionId: aiState.selectedCompositionId })
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
        customFps: fpsSelect === "project" ? null : fpsSelect
      })
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    showToast(`🚀 ${data.message}`);
    const engineDisplay = data.engineName || project?.engineName || (project?.engine === "python-2d-long-form" ? "Python 2D Long Form (Skia + FFmpeg)" : (project?.engine === "thanhhai-2d-studio" || project?.engine === "thanhhai_2d") ? "Thanh Hai 2D Studio (Canvas + Three.js)" : "Remotion 2D Engine");
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


