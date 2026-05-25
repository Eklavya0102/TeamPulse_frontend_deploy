@echo off
title AI Team Brain - Frontend
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║   AI Team Brain — Frontend Dev Server    ║
echo  ╚══════════════════════════════════════════╝
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found.
    echo         Install from https://nodejs.org (LTS version^)
    pause & exit /b 1
)

if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] Created .env from template
    )
)

if not exist node_modules (
    echo [INFO] Installing npm packages (first time only^)...
    npm install
)

echo [OK] Starting frontend on http://localhost:3000
echo [OK] Press Ctrl+C to stop
echo.
npm run dev
