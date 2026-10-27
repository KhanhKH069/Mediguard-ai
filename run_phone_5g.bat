@echo off
title MediGuard AI - 5G/Mobile Launcher
chcp 65001 > nul
echo ===================================================================
echo      MEDIGUARD AI - KHOI DONG TRUY CAP 5G / MANG DI DONG
echo ===================================================================

echo [1/3] Dang bat Backend FastAPI (Port 8000)...
start "MediGuard Backend" cmd /k "chcp 65001 > nul && cd /d %~dp0backend && set "PYTHONIOENCODING=utf-8" && set "PYTHONUTF8=1" && python -X utf8 main.py"

timeout /t 2 /nobreak > nul

echo [2/3] Dang bat Frontend React Kiosk (Port 5173)...
start "MediGuard Frontend" cmd /k "chcp 65001 > nul && cd /d %~dp0frontend && npm run dev"

timeout /t 2 /nobreak > nul

echo [3/3] Dang khoi tao Cloudflare Tunnel 5G & Tao ma QR...
python "%~dp0start_phone_tunnel.py"

pause
