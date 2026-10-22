@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem 서버를 창 없이 켜고 브라우저로 오피스를 연다 (이미 켜져 있으면 그대로 연다)
start "" /b node server.js --log office.log
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:4317/
