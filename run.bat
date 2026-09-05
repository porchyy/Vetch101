@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Vetch101 - Desktop
if not exist node_modules (call npm ci || exit /b 1)
call npm run tauri dev
pause
