# Ứng Dụng Local Dựng Video 2D Bằng Remotion (2 Chức Năng)

Ứng dụng web chạy cục bộ trên máy tính cá nhân (chỉ lắng nghe `127.0.0.1`), hỗ trợ dựng video giải thích 2D (kênh YouTube dạng *"nếu... thì sao?"*).

---

## 🌟 Tính năng nổi bật

1. **Tab 1 - Giọng đọc & Timeline:**
   - Dán kịch bản, tự động tách dòng linh hoạt (theo dòng hoặc theo câu tối đa N từ).
   - Danh sách xem trước cho phép sửa lời đọc, gộp dòng, tách dòng, xóa dòng trực tiếp.
   - Tạo giọng đọc tự động bằng Microsoft Edge TTS (giọng nữ `vi-VN-HoaiMyNeural`, giọng nam `vi-VN-NamMinhNeural`).
   - Tự động lấy **mốc thời gian từng từ** (`WordBoundary`) chính xác tuyệt đối.
   - **Bộ nhớ đệm thông minh (Cache):** Băm SHA-256 từ ngữ và tốc độ; chỉ tạo lại những dòng có thay đổi, tiết kiệm 100% thời gian khi chạy lại.
   - Tự động gộp toàn bộ thành một file audio hoàn chỉnh `out/voice_full.mp3` có khoảng lặng (`pause`) chuẩn xác bằng `ffmpeg-static`.
   - Xuất phụ đề `out/voice.srt` và bảng Markdown `out/timeline_for_ai.md` (đánh dấu cam các dòng dài > 8s kèm mốc ngắt câu để AI chia ảnh).
   - Nút **"Sao chép bảng cho AI"** 1-click đưa vào Clipboard.

2. **Tab 2 - Dựng video & Ghép giọng:**
   - Dán `scenes.json` do AI tạo, bấm **"Kiểm tra dữ liệu"** để bắt lỗi thời gian (hở cảnh, chồng lấn, thiếu ảnh, cú pháp sai vị trí).
   - Danh sách ảnh cần thiết có dấu kiểm `✓ Đã có` hoặc `✗ Còn thiếu`.
   - Khu vực **Kéo & Thả nhiều ảnh** tự động đưa ảnh vào `public/backgrounds/` hoặc `public/characters/`.
   - Remotion Composition chuẩn:
     - **SceneView:** Zoom và pan chậm mượt mà, chuyển cảnh cross-fade.
     - **Character:** Nảy lên sinh động với hiệu ứng spring (overshoot), nhấp nhô nhẹ chu kỳ 1.2s, bóng đổ mềm ellipse dưới chân, hỗ trợ lật ngang (`flip`).
     - **Foreground:** Lớp tiền cảnh đè lên nhân vật (chăn phủ, bàn ghế...).
     - **Subtitles:** Phụ đề tiếng Việt chuẩn (`Be Vietnam Pro`), chữ đang đọc tô vàng rực rỡ, chữ đã đọc màu trắng, viền đen dày, tự xuống dòng tối đa 28 ký tự/dòng.
     - **Audio:** Tự động ghép giọng đọc từng dòng và nhạc nền ducking (tự giảm âm lượng khi có giọng nói).
   - Hỗ trợ xem video trực tiếp trên trang sau khi dựng xong.

3. **Tăng tốc phần cứng GPU (Tùy chọn & Tự phục hồi):**
   - Hỗ trợ mã hóa phần cứng qua **NVIDIA NVENC** (nhanh hơn CPU từ 25% - 40%).
   - Tùy chọn vẽ khung hình GPU qua Chromium ANGLE.
   - **Tự động Fallback về CPU:** Nếu GPU NVENC/ANGLE gặp sự cố driver hay tràn bộ nhớ, hệ thống tự động quay về CPU tiêu chuẩn mà không làm hỏng video.
   - Nút **"Đo thử tốc độ (5s)"** tự đo và gợi ý cấu hình nhanh nhất cho máy tính của bạn.

4. **Script xóa nền trắng nhân vật thông minh (`scripts/cutout.mjs`):**
   - Sử dụng thuật toán Flood Fill từ 4 cạnh mép ảnh.
   - **Bảo toàn chi tiết bên trong:** Các vùng màu trắng nằm trong viền đen (mặt, áo, mắt) và chi tiết tách rời như dấu hỏi `?` được giữ nguyên 100%.
   - Tự động crop sát khung bao (bounding box) và làm mềm nhẹ mép biên.

---

## 💻 Yêu cầu hệ thống & Tính di động (Portable)

- **Hệ điều hành:** Windows 10/11 hoặc macOS/Linux.
- **Node.js:** Phiên bản 18+ (Đã kiểm thử hoạt động hoàn hảo trên Node `v24.22.1`).
- **Phần cứng:**
  - Máy CPU thuần: Tối thiểu 8GB RAM.
  - Máy có GPU rời: NVIDIA GTX 1650, RTX 3050, RTX 4050 (6GB VRAM) trở lên.
- **Tính di động 100%:** Mọi đường dẫn đều tính tương đối theo `process.cwd()`. Bạn có thể sao chép toàn bộ thư mục dự án từ máy công ty về Laptop cá nhân ở nhà mà không sợ lỗi đường dẫn.

---

## 🚀 Cài đặt & Khởi động nhanh

### 1. Cài đặt các gói phụ thuộc
Mở PowerShell hoặc Command Prompt tại thư mục dự án:
```powershell
# Trên Windows PowerShell, khuyến nghị dùng npm.cmd:
npm.cmd install
```

### 2. Khởi động ứng dụng giao diện web
```powershell
npm.cmd start
```
Trình duyệt sẽ tự động mở địa chỉ: `http://127.0.0.1:3000`.

---

## 📖 Quy trình làm việc chuẩn 4 bước

```
[Bước 1: Tab 1] Dán kịch bản -> Bấm "Tạo giọng đọc" -> Bấm "Sao chép bảng cho AI"
                                     │
[Bước 2: Gửi AI] AI dựa vào bảng timeline trả về scenes.json và prompt ảnh
                                     │
[Bước 3: Tạo ảnh] Tạo ảnh ở Midjourney/Stable Diffusion/Canva -> Kéo thả vào Tab 2
                                     │
[Bước 4: Tab 2] Dán scenes.json -> Bấm "Kiểm tra" -> Bấm "Dựng video" -> Nhận MP4!
```

---

## 🛠️ Danh mục lệnh dòng lệnh (CLI Scripts)

Dự án tái sử dụng toàn bộ thư viện lõi trong `lib/` nên bạn có thể chạy dòng lệnh độc lập mà không cần mở trình duyệt:

| Lệnh | Ý nghĩa |
| :--- | :--- |
| `npm.cmd start` | Khởi động máy chủ web local 2 Tab và tự mở trình duyệt |
| `npm.cmd run voice` | Tạo giọng đọc TTS, ghi `timeline.json`, `voice.srt` và `timeline_for_ai.md` |
| `npm.cmd run voice -- --only=line_002` | Chỉ tạo lại riêng cho một dòng cụ thể |
| `npm.cmd run cutout` | Xóa nền trắng mọi ảnh trong `raw/characters/` sang `public/characters/` |
| `npm.cmd run render:test` | Dựng thử 10 giây đầu (720p) để kiểm tra nhanh |
| `npm.cmd run render` | Dựng video hoàn chỉnh xuất file `out/video.mp4` |
| `npm.cmd run gpu-check` | Kiểm tra thông tin card đồ họa NVIDIA và driver |
| `npm.cmd run bench` | Đo tốc độ dựng 5 giây thực tế giữa CPU vs GPU NVENC vs GPU ANGLE |
| `npm.cmd run check` | Kiểm tra kiểu dữ liệu TypeScript và kiểm tra tính toàn vẹn của JSON |
| `npm.cmd run dev` | Mở Remotion Studio để xem trực quan từng khung hình |
| `npm.cmd run import-srt -- --file=sub.srt` | Nhập file SRT có sẵn từ nơi khác |

---

## 📂 Cấu trúc thư mục

```
Tool_gender_video_2d/
├── public/
│   ├── backgrounds/        # Ảnh nền 16:9 (scene_001.png, ...)
│   ├── characters/         # Ảnh nhân vật PNG trong suốt đã cutout
│   ├── foregrounds/        # Ảnh tiền cảnh đè lên nhân vật (chăn, bàn, ...)
│   ├── audio/lines/        # File MP3 giọng đọc từng dòng (do TTS tự sinh)
│   └── audio/music.mp3     # Nhạc nền (tùy chọn)
├── raw/characters/         # Ảnh nhân vật gốc nền trắng để chạy lệnh cutout
├── samples/                # Bộ ảnh mẫu kiểm thử tự động
├── out/                    # video.mp4, voice_full.mp3, voice.srt, timeline_for_ai.md
├── src/
│   ├── components/         # SceneView, Character, Subtitles, Vignette
│   ├── data/
│   │   ├── script.json     # Kịch bản lời đọc
│   │   ├── timeline.json   # Mốc thời gian từng dòng, từng từ do lệnh voice tạo
│   │   └── scenes.json     # Dữ liệu cảnh hình do AI sinh ra
│   ├── index.ts, Root.tsx, Video.tsx, types.ts
├── lib/
│   ├── voice.mjs           # Edge TTS WebSocket + Cache băm SHA-256 + Gộp MP3
│   ├── timeline.mjs        # Xử lý SRT, ước tính ngắt câu, format markdown cho AI
│   ├── validate.mjs        # Bắt lỗi cú pháp, kiểm tra an toàn Path Traversal
│   ├── render.mjs          # Remotion Bundler & Renderer, SSE, CPU Fallback
│   ├── gpu.mjs             # Phát hiện nvidia-smi & cấu hình NVENC/ANGLE
│   └── cutout-core.mjs     # Thuật toán Flood Fill 4 cạnh xóa nền trắng
├── app/
│   ├── server.mjs          # Express server (chỉ lắng nghe 127.0.0.1)
│   └── ui/                 # Giao diện HTML5, CSS3, JavaScript thuần
```

---

## ⚡ Tối ưu hiệu năng cho máy RAM 20GB & Laptop RTX 4050

1. **Số luồng Concurrency:** Mặc định được giới hạn bằng `Math.min(CPU cores - 1, 4)`. Khi render bản dài (trên 5 phút), không nên tăng concurrency quá 4 để tránh vượt ngưỡng 20GB RAM.
2. **Cấu hình GPU khuyến nghị:**
   - Trên card **NVIDIA RTX 3050** và **RTX 4050 6GB Laptop**: Chế độ **Mã hóa bằng GPU (NVENC)** cho tốc độ nhanh nhất (rút ngắn ~30% thời gian render so với CPU).
   - Không nên bật ANGLE cho các video dài vì Chrome ANGLE có thể bị tăng bộ nhớ đệm nếu chạy liên tục nhiều phút.
3. **Chất lượng hình ảnh:** Ảnh nền nên có kích thước chuẩn **1280x720** (hoặc 1920x1080). Tránh dùng ảnh nhỏ hơn vì khi camera zoom sẽ bị vỡ nét.

