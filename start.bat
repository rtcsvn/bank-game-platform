@echo off
chcp 65001 >nul
title Bank Game Platform - Local Setup

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║         BANK GAME PLATFORM - LOCAL DEPLOY               ║
echo ║         Khoi dong tat ca dich vu...                     ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Check Docker
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Docker chua chay! Mo Docker Desktop truoc roi chay lai.
    pause
    exit /b 1
)
echo [OK] Docker dang chay

:: Check Node.js (optional, only needed for frontend outside docker)
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Node.js chua cai - frontend se chay qua Docker
    set USE_DOCKER_FRONTEND=1
) else (
    echo [OK] Node.js san sang
    set USE_DOCKER_FRONTEND=0
)

:: Stop old containers if running
echo.
echo [1/5] Dung container cu (neu co)...
docker-compose down --remove-orphans >nul 2>&1

:: Build and start backend services
echo [2/5] Build va khoi dong: PostgreSQL + Redis + API + Worker...
docker-compose up -d --build postgres redis api worker adminer

echo.
echo [3/5] Cho dich vu khoi dong (45 giay)...
timeout /t 45 /nobreak >nul

:: Check API health
echo [4/5] Kiem tra API...
:CHECK_API
curl -s http://localhost:4000/health >nul 2>&1
if %errorlevel% neq 0 (
    echo     API chua san sang, cho them 10 giay...
    timeout /t 10 /nobreak >nul
    goto CHECK_API
)
echo [OK] API dang chay tai http://localhost:4000

:: Start frontend
echo [5/5] Khoi dong Frontend...
if %USE_DOCKER_FRONTEND%==0 (
    cd frontend
    if not exist node_modules (
        echo     Cai npm packages cho frontend...
        call npm install >nul 2>&1
    )
    start "Bank Game Frontend" cmd /k "npm run dev"
    cd ..
) else (
    docker-compose up -d --build frontend
)

:: Done!
echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║                   KHOI DONG THANH CONG!                 ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║                                                          ║
echo ║  Frontend (Admin UI)  →  http://localhost:5173          ║
echo ║  Backend API          →  http://localhost:4000          ║
echo ║  Database UI (Adminer)→  http://localhost:8080          ║
echo ║  API Health Check     →  http://localhost:4000/health   ║
echo ║                                                          ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  TAI KHOAN DEMO (mat khau: Demo@123456)                 ║
echo ║                                                          ║
echo ║  admin@msb.com.vn     → MSB Bank Admin                  ║
echo ║  marketing@msb.com.vn → Marketing Manager               ║
echo ║  director@msb.com.vn  → Marketing Director              ║
echo ║  gameops@msb.com.vn   → Game Ops                        ║
echo ║  admin@mbbank.com.vn  → MBB Bank Admin                  ║
echo ║  admin@tpbank.vn      → TPB Bank Admin                  ║
echo ║  root@platform.io     → Super Admin (slug: bo trong)    ║
echo ║                                                          ║
echo ╠══════════════════════════════════════════════════════════╣
echo ║  Adminer login:                                          ║
echo ║    Server:   postgres                                    ║
echo ║    Username: bgp                                         ║
echo ║    Password: bgp_dev_secret                              ║
echo ║    Database: bank_game_platform                          ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

:: Open browser
timeout /t 3 /nobreak >nul
start http://localhost:5173
start http://localhost:8080

echo Nhan phim bat ky de thoat (cac dich vu van chay nen)...
pause >nul
