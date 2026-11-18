@echo off
chcp 65001 >nul
title Ứng Dụng Local Dựng Video 2D - Remotion

echo ========================================================
echo       KHỞI ĐỘNG TRÌNH DỰNG VIDEO 2D REMOTION LOCAL       
echo ========================================================
echo.

:: Di chuyển vào đúng thư mục chứa file bat
cd /d "%~dp0"

:: 1. Kiểm tra file cấu hình .env
if not exist ".env" (
    echo [1/3] Đang khởi tạo file cấu hình .env từ .env.example...
    copy ".env.example" ".env" >nul
)

:: 2. Kiểm tra thư viện node_modules
if not exist "node_modules\" (
    echo [2/3] Chưa tìm thấy thư viện, đang tự động cài đặt gói (npm install)...
    echo Quá trình này chỉ diễn ra 1 lần duy nhất khi chạy lần đầu.
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo.
        echo [LỖI] Cài đặt thư viện thất bại! Vui lòng kiểm tra lại kết nối mạng.
        pause
        exit /b %errorlevel%
    )
) else (
    echo [2/3] Thư viện dependencies đã sẵn sàng.
)

:: 3. Khởi động ứng dụng
echo [3/3] Đang khởi động máy chủ Web Local...
echo.
echo ========================================================
echo   🚀 Trình duyệt sẽ tự động mở tại: http://127.0.0.1:3000
echo   🛑 Để dừng ứng dụng, hãy đóng cửa sổ này (hoặc ấn Ctrl + C)
echo ========================================================
echo.

call npm.cmd start
if %errorlevel% neq 0 (
    echo.
    echo [LỖI] Ứng dụng đã dừng với mã lỗi %errorlevel%!
    pause
)
