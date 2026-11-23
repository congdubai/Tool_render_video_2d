# 🎨 Thanh Hai 2D Studio — Tool Dựng Video Hoạt Hình 2D Local

Ứng dụng web chạy cục bộ trên máy tính cá nhân (chỉ lắng nghe `127.0.0.1`), chuyên về dựng video hoạt hình 2D chuyên nghiệp bằng Canvas 2D, Three.js, Procedural Rigging và FFmpeg.

---

## 🌟 Tính Năng Nổi Bật

### 1. Tab 1 — Giọng đọc TTS & Timeline
- Dán kịch bản, tự động tách dòng linh hoạt (theo dòng hoặc theo câu tối đa N từ).
- Tạo giọng đọc tự động bằng Microsoft Edge TTS chất lượng cao (`vi-VN-HoaiMyNeural`, `vi-VN-NamMinhNeural`).
- **Bộ nhớ đệm thông minh (Cache):** Băm SHA-256 từ ngữ và tốc độ; chỉ tạo lại những dòng có thay đổi.
- Tự động gộp toàn bộ thành file audio `out/voice_full.mp3` có khoảng lặng (`pause`) chuẩn xác bằng `ffmpeg-static`.
- Xuất phụ đề `out/voice.srt` và bảng Markdown `out/timeline_for_ai.md`.

### 2. Tab 2 — Dựng Video Thanh Hai 2D Studio
- **Pipeline hoạt hình Canvas 2D & Three.js:**
  - Diễn hoạt camera mượt mà (Pan, Zoom, Dolly).
  - Ánh sáng cinematic (đèn phòng, bóng trăng, hạt bụi lơ lửng, vignette).
  - Tự động đồng bộ chuyển động nhân vật với timeline audio và phụ đề.
- **Tùy chọn Character Renderer linh hoạt:**
  - 🎨 **Nhân vật gốc Thanh Hai (Original Character):** Phong cách người que đen cổ điển.
  - 👶 **Chibi V9 (Cut-out Character):** Nhân vật Chibi hoạt hình sắc nét, cấu trúc hông, chân và giày chuẩn giải phẫu.
  - 👻 **Hoạt hình Trắng (White Cartoon 2D):** Phong cách nhân vật trắng ngà viền đậm, biểu cảm sợ hãi/hài hước sinh động, bóng đổ mềm.
- **Mẫu dự án có sẵn:**
  - `🎨 reaction-time`: Dự án mẫu 14 cảnh quán cafe đêm với Chibi V9 và Stickman.
  - `👻 scared-roommates`: Dự án mẫu 5 cảnh phòng khách đêm xem phim ma (White Cartoon 2D).
- **Hỗ trợ Import file ZIP:** Tự động giải nén an toàn (chống Zip Slip) và nạp dự án tức thì.
- **Soi Contact Sheet:** Render sheet tổng quan các phân cảnh chỉ trong vài giây.

### 3. Tab 3 — Quản Lý Nhân Vật (Character System V2)
- Trực quan hóa Live Rig, Pose, Expression và Hướng nhìn (5 hướng: Front, 3/4 Trái/Phải, Side Trái/Phải).
- Thư viện trang phục phong phú (Áo Hoodie, Áo thun, Blouse bác sĩ, Vest, Váy, Giày thể thao, Loafers, Boots...).
- Kiểm tra tính toàn vẹn của Rig (Constraint Validator) chống lệch khớp, trượt chân.

---

## 🚀 Khởi Động Nhanh

### 1. Khởi chạy bằng file BAT (Khuyến nghị cho Windows)
Chỉ cần nhấp đúp vào file `start.bat`. Trình duyệt sẽ tự động mở tại `http://127.0.0.1:3001`.

### 2. Khởi chạy bằng dòng lệnh
```bash
node app/server.mjs
```

---

## 📁 Cấu Trúc Dự Án

```
Tool_gender_video_2d/
├── app/
│   ├── server.mjs          # Máy chủ Express API (127.0.0.1)
│   └── ui/                 # Giao diện Web GUI (index.html, app.js, style.css)
├── lib/
│   ├── thanhhai-render-adapter.mjs  # Bộ điều hợp render Thanh Hai 2D
│   ├── character-library.mjs        # Quản lý thư viện nhân vật
│   ├── character-rig-v2.mjs         # Hình học & Rig nhân vật V2
│   ├── character-validator.mjs      # Thẩm định cấu trúc rig
│   ├── engine-detector.mjs          # Định danh dự án Thanh Hai 2D
│   ├── engine-manager.mjs           # Điều phối render & preview
│   ├── project-loader.mjs           # Giải nén ZIP an toàn
│   ├── voice.mjs                    # Xử lý Edge TTS & Timeline
│   └── gpu.mjs                      # Nhận diện phần cứng
├── thanhhai-2d-studio/
│   ├── kit/                         # Kit động cơ hoạt hình (rig2d, core, styles, fx2d)
│   └── examples/
│       ├── reaction-time/           # Dự án mẫu Reaction Time
│       └── scared-roommates/        # Dự án mẫu Scared Roommates
├── sample-projects/                 # File ZIP các dự án mẫu
└── out/                             # Thư mục xuất video MP4, ảnh preview và âm thanh
```
