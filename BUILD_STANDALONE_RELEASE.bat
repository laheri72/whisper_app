@echo off
title Academic Quranic Portal - Build Standalone Portable Release
cls
echo ====================================================================
echo      ACADEMIC QURANIC PORTAL - STANDALONE OFFLINE RELEASE BUILDER
echo ====================================================================
echo.

echo [1/2] Compiling Production Frontend Assets (Vite)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed! Check npm packages.
    pause
    exit /b
)

echo.
echo [2/2] Building Standalone Portable Release Package...
if exist ".venv\Scripts\python.exe" (
    set "PY_EXEC=.venv\Scripts\python.exe"
) else (
    set "PY_EXEC=python"
)

"%PY_EXEC%" package_offline_portable.py
if %errorlevel% neq 0 (
    echo [ERROR] Packaging script failed!
    pause
    exit /b
)

echo.
echo ====================================================================
echo  [SUCCESS] Standalone Portable Release is ready in:
echo          dist_release\Academic_Quran_Portal_v1.0_Portable
echo  (You can now zip this folder manually at full speed)
echo ====================================================================
pause
