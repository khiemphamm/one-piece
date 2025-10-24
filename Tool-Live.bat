@echo off
:: Tool Live - YouTube Livestream Viewer Bot
:: Quick Launch Script

echo ===============================================
echo    Tool Live - YouTube Viewer Manager
echo ===============================================
echo.
echo Starting application...
echo.

cd /d "%~dp0"
node_modules\.bin\electron.cmd .

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Failed to start the application!
    echo Please make sure all dependencies are installed.
    echo Run: npm install
    echo.
    pause
)
