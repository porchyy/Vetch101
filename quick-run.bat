@echo off
chcp 65001 >nul
title Vetch101 - Quick Run

echo [1] Starting Vite dev server...
start /B npx vite --port 1420

echo [2] Waiting for Vite to be ready...
timeout /t 5 /nobreak >nul

echo [3] Launching app (no recompile)...
set "EXE=C:\Users\aomzi\.cargo-targets\tauri-app\x86_64-pc-windows-gnu\debug\tauri-app.exe"

if exist "%EXE%" (
    start "" "%EXE%"
    echo Done! App should be visible now.
) else (
    echo EXE not found, falling back to full build...
    npm run tauri dev
)
pause
