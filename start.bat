@echo off
title Thanh Hai 2D Studio Local
cd /d "%~dp0"

echo ========================================================
echo   KHOI DONG THANH HAI 2D STUDIO LOCAL
echo ========================================================
echo.

if exist ".env" goto check_node
copy ".env.example" ".env" >nul

:check_node
where node >nul 2>nul
if %errorlevel% equ 0 goto check_modules
echo [LOI] Khong tim thay Node.js tren may tinh!
echo Vui long cai dat Node.js tu: https://nodejs.org/
echo.
pause
exit /b 1

:check_modules
if exist "node_modules\" goto run_server
echo Dang cai dat thu vien npm install, vui long doi...
call npm.cmd install
if %errorlevel% equ 0 goto run_server
echo [LOI] Cai dat thu vien that bai!
pause
exit /b 1

:run_server
echo.
echo May chu dang chay tai: http://127.0.0.1:3001
echo De dung ung dung, hay dong cua so nay hoac an Ctrl+C.
echo.

node app/server.mjs

echo.
echo May chu da dung.
pause
