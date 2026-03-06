@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Game-X - запуск...
echo.

if not exist "node_modules" (
    echo Встановлення залежностей...
    call npm install
    echo.
)

echo Запуск dev-сервера на http://localhost:3000
echo.
call npm run dev

pause
