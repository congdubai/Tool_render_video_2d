@echo off
title Ung Dung Local Dung Video 2D Remotion

cd /d "%~dp0"

if not exist ".env" (
    copy ".env.example" ".env" >nul
)

if not exist "node_modules\" (
    echo [1/2] Dang cai dat thu vien lan dau (npm install)...
    call npm.cmd install
)

echo.
echo ========================================================
echo   KHOI DONG TRINH DUNG VIDEO 2D REMOTION LOCAL
echo   Dia chi web: http://127.0.0.1:3000
echo   De dung ung dung, hay dong cua so nay hoac an Ctrl + C
echo ========================================================
echo.

call npm.cmd start

if %errorlevel% neq 0 (
    echo.
    echo [LOI] Khong the khoi dong ung dung. Ma loi: %errorlevel%
    pause
)
