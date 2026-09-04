@echo off
chcp 65001 >nul
title Vetch101 - Video Downloader

echo ========================================
echo   Vetch101 - Video Downloader
echo ========================================

:: Install server deps if needed
if not exist "server\node_modules" (
  echo [1/3] Installing backend dependencies...
  cd server
  npm install
  cd ..
)

:: Start backend
echo [2/3] Starting backend (port 3001)...
start /B node server/index.js

:: Wait a moment for backend to start
timeout /t 2 /nobreak >nul

:: Start frontend (opens browser automatically)
echo [3/3] Starting frontend (port 1420)...
npx vite --open
