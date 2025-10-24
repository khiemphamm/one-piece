@echo off
title Tool Live - YouTube Viewer Manager
cls
echo.
echo ========================================
echo   Tool Live - Starting...
echo ========================================
echo.

start "" "%~dp0release\Tool Live-win32-x64\Tool Live.exe"

echo Application launched!
timeout /t 2 >nul
exit
