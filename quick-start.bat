@echo off
REM Quick start script for tool-live project
REM This batch file runs the PowerShell setup script

echo ========================================
echo   tool-live Quick Start
echo ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PowerShell is not available
    echo Please ensure PowerShell is installed on your system
    pause
    exit /b 1
)

echo Starting setup script...
echo.

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

REM Check if script ran successfully
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Setup script failed
    pause
    exit /b 1
)

pause
