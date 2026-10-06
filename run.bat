@echo off
title PixelForge AI
cd /d "%~dp0frontend"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

echo.
echo Starting PixelForge AI...
echo Open http://localhost:5173 in your browser.
echo.
call npm run dev -- --host 0.0.0.0
pause
