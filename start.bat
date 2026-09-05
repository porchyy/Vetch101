@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Vetch101 - Desktop

if exist "Vetch101.exe" (
    start "" "Vetch101.exe"
    exit /b 0
)

if exist "dist-desktop\Vetch101.exe" (
    start "" "dist-desktop\Vetch101.exe"
    exit /b 0
)

echo ไม่พบไฟล์ Vetch101.exe กำลังรันโหมดพัฒนา...
if not exist node_modules (call npm ci || exit /b 1)
call npm run tauri dev
