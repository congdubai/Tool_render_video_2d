# Thanh Hai Learn AI 2D Studio

Biến bất kỳ file giọng đọc nào thành video hoạt hình người que mang chất điện ảnh: người que đen có viền sáng diễn theo lời kể trong bối cảnh 2.5D tối và giàu cảm xúc, cận mặt khổng lồ, khoảnh khắc "đóng băng thời gian", số liệu và biểu đồ chuyển động, sơ đồ kiểu bản vẽ kỹ thuật, cảnh 3D low-poly, kèm nhạc nền và hiệu ứng âm thanh tự tạo.

Mọi khung hình đều được vẽ bằng code và render từng khung. Không dùng AI tạo ảnh hay tạo video, nên nhân vật luôn nhất quán và chữ luôn sắc nét. Hình ảnh được nghĩ mới cho từng kịch bản; phong cách luôn giữ nguyên.

## Luôn hỏi ngôn ngữ video trước
Trước khi cài đặt, tạo file hay chỉnh sửa bất cứ thứ gì, Claude sẽ hỏi: **"Video này dùng ngôn ngữ nào?"** Ngôn ngữ bạn chọn được dùng cho cả quy trình:
- Whisper đánh mốc thời gian đúng ngôn ngữ (`--lang vi`, `--lang en`, …).
- Toàn bộ chữ trên màn hình (tiêu đề, nhãn, đơn vị, phụ đề) viết bằng ngôn ngữ đó.
- Tiếng Việt hiển thị đủ dấu trong cùng một font (tự chuyển sang Nunito cho chữ tiêu đề).

## Bạn có thể nói
- "Làm video 2D từ giọng đọc này" / "Make a 2D video from this voiceover": chạy toàn bộ quy trình.
- `/new-video`: hỏi ngôn ngữ, thiết lập video, đánh mốc thời gian lời đọc, lên danh sách cảnh.
- `/video-styles`: xem chính các cảnh của bạn ở 5 phong cách (Cinematic Dusk, Midnight Blue, Golden Hour, Neon Noir, Soft Storybook), chọn một hoặc tự thiết kế.
- `/render-video`: dựng và kiểm tra cảnh, xem thử, render video cuối.
- `/video-sound`: cảm xúc nhạc, hiệu ứng, âm nền, mix cuối.

## Đầu vào và tùy chọn
- **Ngôn ngữ video** (hỏi đầu tiên).
- **Giọng đọc** (mọi định dạng âm thanh phổ biến).
- **Kịch bản:** không bắt buộc. Có mốc thời gian (SRT/VTT/JSON/TXT) hoặc văn bản thường (tự canh thời gian). Không có kịch bản thì giọng đọc sẽ được chép lời tự động.
- **16:9 hoặc 9:16**, **720p / 1080p / 1440p / 4K**, phụ đề in cứng tùy chọn.
- **Nhạc:** tự tạo theo cảm xúc, nhạc của bạn, hoặc không. **Hiệu ứng:** 36 hiệu ứng có sẵn hoặc file của bạn.

## Cài đặt lần đầu (tự động)
Lần dùng đầu tiên, Claude chép studio vào thư mục dự án (`thanhhai-2d-studio/`) và cài:
- ffmpeg,
- các gói Node.js (renderer, Three.js, font),
- Chromium chạy ẩn,
- numpy, scipy và faster-whisper cho Python.

Whisper tải model giọng nói ở lần chép lời đầu tiên. Tổng cộng cần khoảng 1 GB dung lượng.

## Thời gian render
Máy cloud 2 nhân render 720p khoảng 2 khung hình/giây (video 47 giây mất khoảng 11 phút). 1080p lâu gấp khoảng 2 lần, 4K khoảng 8 lần. Máy bàn hiện đại nhanh hơn 3–5 lần. Video dài ở 4K nên render qua đêm.

## Nội dung
- `skills/make-2d-video/`: toàn bộ quy trình, style bible và tài liệu tham khảo, cùng bộ studio (`kit/`: renderer, engine hoạt hình, công cụ chép lời, tổng hợp âm thanh và một project mẫu).
- `skills/new-video`, `skills/video-styles`, `skills/render-video`, `skills/video-sound`: các lệnh theo từng giai đoạn.

Không cần API key hay connector.

© Thanh Hai Learn AI
