"""
Academic Quran Portal - Production V1 Standalone Offline Packager
Creates a 100% self-contained, portable, zero-dependency release folder in dist_release/
Excludes .git, node_modules, source code clutter, and unneeded files.
Does NOT zip the folder (user can compress manually with native high-speed GUI archiver).
"""

import os
import sys
import shutil
import zipfile
import time

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR_NAME = "Academic_Quran_Portal_v1.0_Portable"
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "dist_release", OUTPUT_DIR_NAME)

# Essential root files to include in the portable package
ESSENTIAL_FILES = [
    "main.py",
    "file1.db",
    "file2.db",
    "tafsir.db",
    "users.db",
    "quran_platform.db",
    "requirements.txt"
]

# Essential directories to copy
ESSENTIAL_DIRS = [
    "app",
    "models",
    "static",
    "templates",
    "data",
    "audio",
    "quran_pages"
]

def get_dir_size_mb(path):
    total = 0
    for root, dirs, files in os.walk(path):
        for f in files:
            fp = os.path.join(root, f)
            if not os.path.islink(fp) and os.path.exists(fp):
                total += os.path.getsize(fp)
    return total / (1024 * 1024)

def create_portable_package():
    t0 = time.time()
    print("=" * 70)
    print("  ACADEMIC QURANIC PORTAL - STANDALONE OFFLINE PACKAGER (PROD V1)")
    print("=" * 70)

    dist_root = os.path.join(PROJECT_ROOT, "dist_release")
    os.makedirs(dist_root, exist_ok=True)
    
    if os.path.exists(OUTPUT_DIR):
        print(f"\n[0/4] Cleaning previous release folder: {OUTPUT_DIR}...")
        shutil.rmtree(OUTPUT_DIR, ignore_errors=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Copy essential project files
    print("\n[1/4] Copying core application files and SQLite databases...")
    for filename in ESSENTIAL_FILES:
        src = os.path.join(PROJECT_ROOT, filename)
        if os.path.exists(src):
            dst = os.path.join(OUTPUT_DIR, filename)
            shutil.copy2(src, dst)
            sz = os.path.getsize(src) / (1024 * 1024)
            print(f"  + Copied {filename:<20} ({sz:.2f} MB)")
        else:
            if filename in ["main.py", "file1.db", "file2.db", "tafsir.db", "users.db"]:
                print(f"  ! CRITICAL WARNING: Core file {filename} not found!")
            else:
                print(f"  . Optional file {filename} not found, skipping.")

    # 2. Copy essential directories (excluding cache & git)
    print("\n[2/4] Copying frontend assets, models, audio, data, and packages...")
    for dirname in ESSENTIAL_DIRS:
        src = os.path.join(PROJECT_ROOT, dirname)
        if os.path.exists(src):
            dst = os.path.join(OUTPUT_DIR, dirname)
            print(f"  + Copying directory: {dirname}/ ...")
            shutil.copytree(
                src, dst,
                ignore=shutil.ignore_patterns('__pycache__', '*.pyc', '.git*', '*.tmp')
            )
            sz = get_dir_size_mb(dst)
            print(f"    --> {dirname}/ copied ({sz:.1f} MB)")
        else:
            print(f"  ! Warning: Directory {dirname} not found, skipping.")

    # Create empty temp_audio directory
    os.makedirs(os.path.join(OUTPUT_DIR, "temp_audio"), exist_ok=True)

    # 3. Bundle Portable Python Runtime
    print("\n[3/4] Bundling self-contained offline Python runtime...")
    runtime_dst = os.path.join(OUTPUT_DIR, "runtime")
    os.makedirs(runtime_dst, exist_ok=True)

    embed_zip = os.path.join(PROJECT_ROOT, "python_embed.zip")
    if not os.path.exists(embed_zip):
        import urllib.request
        print("  Downloading official Windows Embedded Python 3.12...")
        try:
            urllib.request.urlretrieve(
                "https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip",
                embed_zip
            )
        except Exception as e:
            print(f"  Warning: Could not download embed zip ({e}). Copying existing virtual environment.")

    if os.path.exists(embed_zip):
        print("  Extracting embedded Python binaries into runtime/...")
        with zipfile.ZipFile(embed_zip, 'r') as zf:
            zf.extractall(runtime_dst)

        # Configure python312._pth for site-packages support
        pth_files = [f for f in os.listdir(runtime_dst) if f.endswith('._pth')]
        for pth in pth_files:
            pth_path = os.path.join(runtime_dst, pth)
            with open(pth_path, 'w', encoding='utf-8') as pf:
                pf.write("python312.zip\n.\n..\nLib/site-packages\nimport site\n")

        # Copy installed site-packages from current environment
        site_packages_src = os.path.join(PROJECT_ROOT, ".venv", "Lib", "site-packages")
        site_packages_dst = os.path.join(runtime_dst, "Lib", "site-packages")
        if os.path.exists(site_packages_src):
            print("  Syncing offline site-packages (FastAPI, faster-whisper, PyTorch, CTranslate2)...")
            cmd = f'robocopy "{site_packages_src}" "{site_packages_dst}" /E /MT:16 /XD __pycache__ /XF *.pyc /NFL /NDL /NJH /NJS /nc /ns /np'
            os.system(cmd)
            print("  + Portable embedded Python runtime configured successfully!")
    else:
        # Fallback: copy .venv
        venv_src = os.path.join(PROJECT_ROOT, ".venv")
        if os.path.exists(venv_src):
            print("  Copying full virtual environment into runtime/...")
            cmd = f'robocopy "{venv_src}" "{runtime_dst}" /E /MT:16 /XD __pycache__ /XF *.pyc /NFL /NDL /NJH /NJS /nc /ns /np'
            os.system(cmd)

    # 4. Create 1-Click Launchers and Instructions
    print("\n[4/4] Creating 1-Click Windows Launchers and Documentation...")

    # Launcher 1: Standalone Single-PC App
    launcher_app = os.path.join(OUTPUT_DIR, "Launch_Portal.bat")
    with open(launcher_app, "w", encoding="utf-8") as f:
        f.write('''@echo off
title Academic Quranic Portal - Offline Standalone
cls
cd /d "%~dp0"
echo ====================================================================
echo             ACADEMIC QURANIC PORTAL (PROD V1 OFFLINE)
echo ====================================================================
echo.
echo Starting AI Speech Engine and Digital Mushaf...

if exist "%~dp0runtime\\python.exe" (
    set "PY_EXEC=%~dp0runtime\\python.exe"
) else if exist "%~dp0runtime\\Scripts\\python.exe" (
    set "PY_EXEC=%~dp0runtime\\Scripts\\python.exe"
) else if exist "%~dp0.venv\\Scripts\\python.exe" (
    set "PY_EXEC=%~dp0.venv\\Scripts\\python.exe"
) else (
    set "PY_EXEC=python"
)

start "" "http://localhost:8000"
"%PY_EXEC%" main.py --host 127.0.0.1 --port 8000
pause
''')
    print("  + Created Launch_Portal.bat")

    # Launcher 2: University Campus LAN Server
    launcher_lan = os.path.join(OUTPUT_DIR, "Launch_Campus_Server.bat")
    with open(launcher_lan, "w", encoding="utf-8") as f:
        f.write('''@echo off
title Academic Quranic Portal - University Campus Server
cls
cd /d "%~dp0"
echo ====================================================================
echo        ACADEMIC QURANIC PORTAL - UNIVERSITY CAMPUS SERVER
echo ====================================================================
echo.
echo Starting Offline AI Quranic Portal for all Lab / Classroom PCs...

if exist "%~dp0runtime\\python.exe" (
    set "PY_EXEC=%~dp0runtime\\python.exe"
) else if exist "%~dp0runtime\\Scripts\\python.exe" (
    set "PY_EXEC=%~dp0runtime\\Scripts\\python.exe"
) else if exist "%~dp0.venv\\Scripts\\python.exe" (
    set "PY_EXEC=%~dp0.venv\\Scripts\\python.exe"
) else (
    set "PY_EXEC=python"
)

"%PY_EXEC%" main.py --host 0.0.0.0 --port 8000
pause
''')
    print("  + Created Launch_Campus_Server.bat")

    # README for end-users
    readme_path = os.path.join(OUTPUT_DIR, "INSTRUCTIONS.txt")
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write('''====================================================================
           ACADEMIC QURANIC PORTAL - STANDALONE OFFLINE V1.0
====================================================================

1. HOW TO RUN ON ANY COMPUTER (NO INSTALLATION NEEDED):
   - Double-click "Launch_Portal.bat"
   - It will automatically start the offline Whisper AI speech engine and 
     open the portal in your default web browser (Chrome, Edge, Firefox, Brave).
   - 100% OFFLINE: No internet connection is needed.
   - ZERO PREREQUISITES: Python, PyTorch, CTranslate2, and all models are
     pre-bundled inside this portable package.

2. HOW TO SHARE WITH AN ENTIRE CLASSROOM / LAB (CAMPUS LAN SERVER):
   - Double-click "Launch_Campus_Server.bat" on one host PC.
   - The terminal window will display the Campus LAN URL (e.g. http://192.168.1.50:8000).
   - Any other student or instructor in the classroom/lab can open that URL in their browser.

3. FEATURES INCLUDED:
   - Digital Mushaf with Live Speech Alignment (Tilawat Tab)
   - Tafsir Library: Ibn Kathir, Jalalayn, Saadi, Asbab al-Nuzul & Root Search (Tafseer Tab)
   - Continuous Memorization Assessment (Tasmee Tab)
   - Comprehensive Testing & Exams by Juz/Surah/Page (Ikhtebaar Tab)
   - Similar Verses Index & Comparisons (Mutashabehat Tab)
   - Analytics, Retention Mastery Heatmaps, & Mistake Tracker (Analytics Tab)
   - Arabic Typography & Audio Calibration (Settings Tab)

4. SYSTEM REQUIREMENTS:
   - Windows 10 or Windows 11 (64-bit).
   - Microphone connected for oral recitation testing.
====================================================================
''')
    print("  + Created INSTRUCTIONS.txt")

    total_size_mb = get_dir_size_mb(OUTPUT_DIR)
    elapsed = time.time() - t0

    print("\n" + "=" * 70)
    print("  [SUCCESS] STANDALONE OFFLINE RELEASE FOLDER CREATED SUCCESSFULLY!")
    print("=" * 70)
    print(f"  * Release Directory: {OUTPUT_DIR}")
    print(f"  * Total Size:        {total_size_mb:.1f} MB ({total_size_mb / 1024:.2f} GB)")
    print(f"  * Status:            Standalone folder ready (ZIP skipped for fast manual archive)")
    print(f"  * Time Elapsed:      {elapsed:.1f} seconds")
    print("=" * 70)

if __name__ == "__main__":
    create_portable_package()
