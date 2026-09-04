@echo off
title Academic Quranic Portal - Offline App
cls
cd /d "%~dp0"

echo ====================================================================
echo             ACADEMIC QURANIC PORTAL (OFFLINE STANDALONE)
echo ====================================================================
echo.
echo Initializing Speech Recognition AI Engine and Digital Mushaf...

:: 1. Locate local Python interpreter
if exist "%~dp0runtime\python.exe" (
    set "PY_BIN=%~dp0runtime\python.exe"
) else if exist "%~dp0.venv\Scripts\python.exe" (
    set "PY_BIN=%~dp0.venv\Scripts\python.exe"
) else (
    set "PY_BIN=python"
)

:: 2. Auto-launch web browser to the app
start "" "http://localhost:8000"

:: 3. Run FastAPI Production Server
"%PY_BIN%" main.py --host 0.0.0.0 --port 8000
pause
