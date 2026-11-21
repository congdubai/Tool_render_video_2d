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
  showToast(`🎭 Character Renderer: ${charSelect.value === 'chibi' ? 'Chibi V9 (Cut-out Animation)' : 'Nhân vật gốc Thanh Hai'}`);
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

  const rawEngine = (project.engine || "").toLowerCase();
  const isPython = rawEngine === "python-2d-long-form" || rawEngine === "python-longform" || rawEngine === "python_longform" || rawEngine === "python";
  const isTH = rawEngine === "thanhhai-2d-studio" || rawEngine === "thanhhai_2d" || rawEngine === "thanhhai";
  const isRemotion = rawEngine === "remotion" || rawEngine === "remotion-2d";
  const isUnknown = !isPython && !isTH && !isRemotion;

  // Cập nhật dropdown engine
  const engineSelect = document.getElementById("aiEngineSelect");
  if (engineSelect && (!aiState.manualEngineOverride || aiState.manualEngineOverride === "auto")) {
    engineSelect.value = isPython ? "python-2d-long-form" : isTH ? "thanhhai-2d-studio" : isRemotion ? "remotion" : "auto";
  }

  const engineBadge = document.getElementById("aiBadgeEngine");
  const engineTag = document.getElementById("aiEngineTag");
  const btnContactSheet = document.getElementById("btnAiContactSheet");
  const compSettingItem = document.getElementById("aiCompositionSettingItem");
  const charSettingItem = document.getElementById("aiCharacterSettingItem");

  if (compSettingItem) {
    if (isRemotion) compSettingItem.classList.remove("hidden");
    else compSettingItem.classList.add("hidden");
  }

  if (charSettingItem) {
    if (isTH) charSettingItem.classList.remove("hidden");
    else charSettingItem.classList.add("hidden");
  }

  if (engineBadge) {
    if (isPython) {
      engineBadge.textContent = "Engine: Python 2D Long Form (Skia)";
      engineBadge.style.color = "#34d399";
      engineBadge.style.borderColor = "#10b981";
    } else if (isTH) {
      engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
      engineBadge.style.color = "#c084fc";
      engineBadge.style.borderColor = "#a855f7";
    } else if (isRemotion) {
      engineBadge.textContent = "Engine: Remotion 2D";
      engineBadge.style.color = "#38bdf8";
      engineBadge.style.borderColor = "#0284c7";
    } else {
      engineBadge.textContent = "Engine: Chưa xác định";
      engineBadge.style.color = "#f87171";
      engineBadge.style.borderColor = "#ef4444";
    }
  }

  if (engineTag) {
    if (isPython) {
      engineTag.textContent = "PYTHON / SKIA";
      engineTag.style.backgroundColor = "#059669";
    } else if (isTH) {
      engineTag.textContent = "CANVAS / THREE.JS";
      engineTag.style.backgroundColor = "#7c3aed";
    } else if (isRemotion) {
      engineTag.textContent = "REMOTION TSX";
      engineTag.style.backgroundColor = "#0284c7";
    } else {
      engineTag.textContent = "CHƯA RÕ ENGINE";
      engineTag.style.backgroundColor = "#dc2626";
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
      if (isPython) {
        engineBadge.textContent = "Engine: Python 2D Long Form (Skia)";
        engineBadge.style.color = "#34d399";
        engineBadge.style.borderColor = "#10b981";
      } else if (isTH) {
        engineBadge.textContent = "Engine: Thanh Hai 2D Studio";
        engineBadge.style.color = "#c084fc";
        engineBadge.style.borderColor = "#a855f7";
      } else if (isRemotion) {
        engineBadge.textContent = "Engine: Remotion 2D";
        engineBadge.style.color = "#38bdf8";
        engineBadge.style.borderColor = "#0284c7";
      } else {
        engineBadge.textContent = "Engine: Chưa xác định";
        engineBadge.style.color = "#f87171";
        engineBadge.style.borderColor = "#ef4444";
      }
    }
    if (engineTag) {
      if (isPython) {
        engineTag.textContent = "PYTHON / SKIA";
        engineTag.style.backgroundColor = "#059669";
      } else if (isTH) {
        engineTag.textContent = "CANVAS / THREE.JS";
        engineTag.style.backgroundColor = "#7c3aed";
      } else if (isRemotion) {
        engineTag.textContent = "REMOTION TSX";
        engineTag.style.backgroundColor = "#0284c7";
      } else {
        engineTag.textContent = "CHƯA RÕ ENGINE";
        engineTag.style.backgroundColor = "#dc2626";
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
    } else if (isRemotion) {
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
    } else {
      // Giao diện khi Chưa xác định Engine
      reportHtml += `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 12px; border-radius: 6px; margin-bottom: 12px; color: #fca5a5;">
          <strong>⚠️ Dự án chưa được nhận diện là Remotion, Python 2D Long Form hoặc Thanh Hai 2D Studio.</strong>
          <div style="font-size: 12px; margin-top: 4px; color: #cbd5e1;">
            Vui lòng kiểm tra lại cấu trúc file dự án, hoặc chọn thủ công loại Engine phù hợp ở danh sách bên dưới rồi bấm <strong>Thẩm định lại</strong>.
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
    const charSelect = document.getElementById("aiCharacterSelect");
    const characterRenderer = charSelect ? charSelect.value : "chibi";

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
    const characterRenderer = charSelect ? charSelect.value : "chibi";

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
    const characterRenderer = charSelect ? charSelect.value : "chibi";

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
    const characterRenderer = charSelect ? charSelect.value : "chibi";

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

// =========================================================================
// TAB 3: CHARACTER SYSTEM V2 (QUẢN LÝ & DIỄN HOẠT NHÂN VẬT CHIBI 2D)
// =========================================================================

const characterState = {
  characters: [],
  activeCharacter: null
};

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

    // Chọn nhân vật đầu tiên để hiển thị trên editor nếu chưa chọn
    if (!characterState.activeCharacter && characterState.characters.length > 0) {
      selectCharacterForEditing(characterState.characters[0].id);
    }
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color: #ef4444;">❌ Lỗi nạp thư viện nhân vật: ${escapeHtml(err.message)}</div>`;
  }
}

// Hiển thị các thẻ nhân vật trong Grid
function renderCharacterCards() {
  const container = document.getElementById("characterCardsContainer");
  if (!container) return;

  if (characterState.characters.length === 0) {
    container.innerHTML = '<div class="empty-state">Chưa có nhân vật nào trong thư viện. Bấm "+ Tạo Nhân Vật Mới" để bắt đầu!</div>';
    return;
  }

  container.innerHTML = characterState.characters
    .map((c) => {
      const isSelected = characterState.activeCharacter && characterState.activeCharacter.id === c.id;
      const borderCol = isSelected ? "#38bdf8" : "#334155";
      const bgCol = isSelected ? "rgba(56, 189, 248, 0.08)" : "#1e293b";
      const outfitName = c.outfit?.type ? c.outfit.type.toUpperCase() : "CASUAL";

      return `
        <div class="card" style="border: 2px solid ${borderCol}; background-color: ${bgCol}; padding: 14px; display: flex; flex-direction: column; gap: 10px; transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${escapeHtml(c.name || c.id)}</div>
              <div style="font-size: 11px; color: #94a3b8; font-family: monospace;">ID: ${escapeHtml(c.id)}</div>
            </div>
            <span class="badge" style="background-color: #0f172a; color: #38bdf8; font-size: 10px; padding: 3px 8px; border: 1px solid #0284c7;">
              ${escapeHtml(outfitName)}
            </span>
          </div>

          <!-- Color swatches preview -->
          <div style="display: flex; gap: 6px; align-items: center; margin: 4px 0;">
            <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.skinColor || '#ffdfc4'}; border: 1px solid #475569;" title="Màu da"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.hair?.color || '#333'}; border: 1px solid #475569;" title="Màu tóc"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.outfit?.topColor || '#d64a33'}; border: 1px solid #475569;" title="Màu áo"></div>
            <div style="width: 18px; height: 18px; border-radius: 50%; background-color: ${c.outfit?.pantsColor || '#2e384d'}; border: 1px solid #475569;" title="Màu quần"></div>
            <span style="font-size: 11px; color: #94a3b8; margin-left: auto;">${escapeHtml(c.hair?.style || 'short')} hair</span>
          </div>

          <!-- Action buttons -->
          <div style="display: flex; gap: 6px; margin-top: auto; padding-top: 8px; border-top: 1px solid #334155;">
            <button class="btn btn-sm btn-primary" style="flex: 1;" onclick="selectCharacterForEditing('${c.id}')">✏️ Sửa</button>
            <button class="btn btn-sm btn-outline" onclick="duplicateCharacterById('${c.id}')" title="Nhân bản">📑</button>
            <button class="btn btn-sm btn-outline" style="border-color: #ef4444; color: #ef4444;" onclick="deleteCharacterById('${c.id}')" title="Xóa">🗑️</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Chọn một nhân vật để hiển thị trên form editor
function selectCharacterForEditing(id) {
  const char = characterState.characters.find((c) => c.id === id);
  if (!char) return;

  characterState.activeCharacter = char;

  const badge = document.getElementById("editingCharacterBadge");
  if (badge) badge.textContent = `Đang chọn: ${char.name} (${char.id})`;

  // Điền dữ liệu vào form editor
  const elId = document.getElementById("charEditorId");
  const elName = document.getElementById("charEditorName");
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

  if (elId) { elId.value = char.id; elId.disabled = true; }
  if (elName) elName.value = char.name || "";
  if (elSkin) elSkin.value = char.skinColor || "#ffdfc4";
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

  renderCharacterCards();
  updateLivePreview();
}

// Bắt đầu tạo một nhân vật hoàn toàn mới
function createNewCharacter() {
  const newId = `chibi_hero_${Math.floor(1000 + Math.random() * 9000)}`;
  const newChar = {
    id: newId,
    name: "Nhân Vật Mới",
    skinColor: "#ffdfc4",
    hair: { style: "short", color: "#343536", highlight: "#5a5b5c" },
    face: { eyeStyle: "oval", eyeColor: "#111116", browStyle: "soft", mouthStyle: "smile", blush: true },
    proportions: { headScale: 1.0, torsoLength: 36, armLength: 34, legLength: 46 },
    outfit: { id: "outfit_casual", type: "hoodie", topColor: "#0284c7", pantsColor: "#1e293b", shoeColor: "#0f172a", accessories: [] },
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

// Lưu nhân vật đang chỉnh sửa lên máy chủ
async function saveCurrentEditingCharacter() {
  const elId = document.getElementById("charEditorId");
  const elName = document.getElementById("charEditorName");
  if (!elId || !elId.value.trim()) {
    showToast("Vui lòng nhập ID nhân vật!");
    return;
  }

  const charData = {
    id: elId.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
    name: elName?.value.trim() || elId.value.trim(),
    skinColor: document.getElementById("charEditorSkin")?.value || "#ffdfc4",
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
  if (blink || expr === "sad") {
    eyeX.forEach((ex) => {
      html += `<path d="M ${ex - 5} ${eyeY + 2} Q ${ex} ${eyeY + 5} ${ex + 5} ${eyeY + 2}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round" fill="none" />`;
    });
  } else if (expr === "happy" || expr === "laughing") {
    eyeX.forEach((ex) => {
      html += `<path d="M ${ex - 6} ${eyeY + 3} Q ${ex} ${eyeY - 4} ${ex + 6} ${eyeY + 3}" stroke="${ink}" stroke-width="3.8" stroke-linecap="round" fill="none" />`;
    });
  } else {
    eyeX.forEach((ex, i) => {
      const rx = !isFront && i === 0 ? 4.6 : 5.4;
      html += `<ellipse cx="${ex}" cy="${eyeY}" rx="${rx}" ry="7.2" fill="${ink}" />`;
      html += `<circle cx="${ex + 1.8}" cy="${eyeY - 2.2}" r="2.2" fill="#ffffff" />`;
    });
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



