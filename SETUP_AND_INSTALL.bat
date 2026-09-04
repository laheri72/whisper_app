@echo off
title Academic Quranic Portal - Setup & Dependencies Installer
cls
echo ====================================================================
echo      ACADEMIC QURANIC PORTAL - 1-CLICK DEPENDENCY INSTALLER
echo ====================================================================
echo.

echo 1. Verifying Python Installation...
python --version
if %errorlevel% neq 0 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.10, 3.11, or 3.12 from python.org
    pause
    exit /b
)

echo.
echo 2. Creating Python Virtual Environment (.venv)...
if not exist ".venv" (
    python -m venv .venv
)

echo.
echo 3. Upgrading pip and installing all offline dependencies...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt

echo.
echo ====================================================================
echo  [SUCCESS] All dependencies and AI models are installed and ready!
echo  You can now run:
echo    - START_UNIVERSITY_SERVER.bat (To share across entire University LAN)
echo    - START_STANDALONE_APP.bat    (To use locally on this PC)
echo ====================================================================
pause
