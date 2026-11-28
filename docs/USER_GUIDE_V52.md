# Hướng Dẫn Sử Dụng — THANH HAI 2D STUDIO V5.2

## 1. Quy Trình 4 Bước Trong Tab 4 (Simple & Advanced Mode)
1. **Bước 1 — Import Scene Plan JSON**: Dán hoặc chọn file `.json` từ AI Director (hoặc xuất AI Context Package V5.2 để gửi ChatGPT/Claude tạo kịch bản chuẩn).
2. **Bước 2 — Smart Asset Manager**: Hệ thống tự liên kết nhân vật (`chibi_doc`, `chibi_max`), rig, background và đạo cụ procedural. Nếu thiếu tài nguyên tùy biến, dùng **Missing Asset Inspector** để chọn `CODE GEN`, chọn từ thư viện, import ảnh hoặc xuất `AI_REPAIR_PACKAGE.zip`.
3. **Bước 3 — Automatic Scene Builder & Inspector**: Bấm **Tự Động Dựng Toàn Bộ Cảnh**. Có thể mở **Animation & Camera Inspector** để tua timeline, bật/tắt khung xương debug, đổi shot/transition, khóa camera hoặc dựng lại tăng tiến.
4. **Bước 4 — Production Dashboard & Xuất MP4**: Chọn chế độ (**Mode A Preview**, **Mode B Full Auto**, hoặc **Mode C High Quality / Selective**), bấm **Sản xuất tự động**. Hệ thống chạy QA + Auto Repair → Render → FFmpeg → Kiểm định FFprobe trước khi báo `COMPLETED`.

## 2. Quản Lý Dự Án & Khôi Phục Render
- **Export/Import Project ZIP**: Lưu toàn bộ `project.json`, `scene_plan.json`, bindings, animation/camera tracks, QA reports thành file `.zip` di động (tự loại bỏ đường dẫn tuyệt đối và token nhạy cảm).
- **Render Resume & Incremental**: Khi render video dài (1–10 phút), hệ thống lưu checkpoint theo từng segment cảnh. Nếu gián đoạn hoặc sửa 1 cảnh, chỉ cảnh thiếu/sửa được render lại.

