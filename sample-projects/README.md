# HƯỚNG DẪN TẠO DỰ ÁN REMOTION AI CHO TOOL RENDER VIDEO 2D LOCAL

Hệ thống **AI Code-to-Video Engine** cho phép bạn đưa bất kỳ mã nguồn Remotion nào do AI (Claude Code, ChatGPT, v.v.) tạo ra vào tool và kết xuất trực tiếp thành video MP4 chất lượng cao.

---

## 1. CẤU TRÚC DỰ ÁN CHUẨN

Một dự án Remotion AI có thể nén thành file `.zip` hoặc đặt trong thư mục theo cấu trúc sau:

```text
my-ai-animation/
├── video.config.json          # File cấu hình thông số video (Bắt buộc hoặc khuyến nghị)
├── src/
│   ├── index.ts               # File entrypoint (gọi registerRoot)
│   ├── Root.tsx               # Khai báo Composition
│   ├── Video.tsx              # Component dựng video chính
│   ├── components/            # Các component hoạt hình tùy biến (Character, Camera, Parallax...)
│   └── scenes/                # Các phân cảnh (Scene1, Scene2...)
└── public/                    # Chứa hình ảnh, âm thanh, vector SVG tĩnh
    ├── character.png
    ├── background.png
    └── voice.mp3
```

---

## 2. FILE CẤU HÌNH `video.config.json`

```json
{
  "projectName": "Tên Dự Án Hoạt Hình",
  "entryPoint": "src/index.ts",
  "compositionId": "MainVideo",
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "durationInFrames": 300,
  "description": "Mô tả ngắn gọn về video"
}
```

*Lưu ý: Nếu không có file `video.config.json`, tool sẽ tự động đọc từ thẻ `<Composition id="..." width={...} height={...} fps={...} durationInFrames={...} />` trong file `src/Root.tsx`.*

---

## 3. CÁC THƯ VIỆN ĐƯỢC HỖ TRỢ SẴN (Không cần chạy npm install)

Tool chia sẻ toàn bộ hệ sinh thái Remotion có sẵn, bao gồm:
- `react`, `react-dom`
- `remotion` (interpolate, spring, useCurrentFrame, useVideoConfig, Sequence, Audio, Img, staticFile...)
- `@remotion/google-fonts`
- `@remotion/media-utils`
- `@remotion/shapes`
- `@remotion/paths`
- `@remotion/transitions`

---

## 4. TÀI NGUYÊN (ASSETS)

- Toàn bộ ảnh tĩnh (`.png`, `.jpg`, `.svg`) và âm thanh (`.mp3`, `.wav`) đặt trong thư mục `public/`.
- Trong code Remotion, nạp file qua hàm `staticFile("ten-file.png")`.
- Dự án AI cũng có thể kế thừa tự động các file âm thanh và ảnh nền sẵn có trong thư mục `public/` của tool chính.

---

## 5. QUY TRÌNH SỬ DỤNG TRÊN TOOL

1. Khởi động tool bằng file `start.bat`.
2. Mở Tab 3: **🤖 AI Code Render**.
3. Kéo thả file `.zip` của dự án vào ô Import (hoặc bấm chọn dự án mẫu **Demo Hoạt Hình 2D AI 10s**).
4. Nhấn **🔍 Thẩm Định Dự Án (Validate Project)** để hệ thống kiểm tra cú pháp và tài nguyên.
5. Xem trước từng khung hình bằng thanh Timeline và nút **📷 Soi Khung Hình Này**.
6. Chọn độ phân giải, FPS và nhấn **🚀 Render Video MP4 Hoàn Chỉnh**.
7. Video MP4 sau khi hoàn tất sẽ được tự động lưu vào thư mục `out/` và nạp vào **Thư viện Video** để xem hoặc tải về.
