@echo off
title Ung Dung Local Dung Video 2D Remotion
cd /d "%~dp0"

echo ========================================================
echo   KHOI DONG TRINH DUNG VIDEO 2D REMOTION LOCAL
echo ========================================================
echo.

:: 1. Kiem tra Node.js da duoc cai dat hay chua
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Node.js tren may tinh cua ban!
    echo Vui long cai dat Node.js tai: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Kiem tra file cau hinh .env
if not exist ".env" (
    echo [*] Dang khoi tao file .env tu .env.example...
    copy ".env.example" ".env" >nul
)

:: 3. Kiem tra thu vien node_modules
if not exist "node_modules\" (
    echo [*] Dang cai dat thu vien lan dau (npm install)...
    echo     Qua trinh nay co the mat 1-2 phut, xin vui long doi...
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo.
        echo [LOI] Khong the cai dat thu vien! Vui long kiem tra ket noi mang.
        pause
        exit /b 1
    )
)

echo [*] Dang khoi dong may chu local...
echo.
echo ========================================================
echo   Dia chi ung dung: http://127.0.0.1:3001
echo   (Trinh duyet web se tu dong mo len sau vai giay)
echo.
echo   De DUNG ung dung, hay an Ctrl + C hoac dong cua so nay.
echo ========================================================
echo.

:: 4. Chay truc tiep file server bang Node
node app/server.mjs

:: 5. Giu cua so CMD luon mo neu server bi dung
echo.
echo ========================================================
echo [Thong bao] May chu da dung hoat dong.
echo ========================================================
pause
