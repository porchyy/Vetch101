@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title Vetch101 - Web
where node >nul 2>nul || (echo Install Node.js 22.12+ first. & pause & exit /b 1)
if not exist node_modules (call npm ci || exit /b 1)
if not exist server\node_modules (call npm ci --prefix server || exit /b 1)
call npm run build || (pause & exit /b 1)
echo Open http://127.0.0.1:3001 in your browser. Press Ctrl+C to stop.
start "" "http://127.0.0.1:3001"
node server/index.js
pause
