@echo off
chcp 65001 >nul
title Vetch101 (Rust + Tauri + React)
echo ========================================================
echo   Starting Vetch101 (Rust + Tauri + React)
echo ========================================================

set "CARGO_TARGET_DIR=C:\Users\aomzi\.cargo-targets\tauri-app"
npm run tauri dev
