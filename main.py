import sqlite3
import os
import json
import base64
import random
import difflib
import re
import asyncio
import logging
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)
from typing import Optional, List, Union
from pydantic import BaseModel
from fastapi import FastAPI, Request, Form, UploadFile, File, Response, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from app.ai_service import (
    init_whisper_model, transcribe_audio_file, compare_recitation, normalize_arabic,
    ikhtebaar_sessions, tasmee_sessions, IkhtebaarSession, RecitationSession,
    trim_to_last_n_seconds, are_words_phonetically_equivalent, is_model_ready, get_model_health,
    decode_audio_bytes_to_numpy, is_voice_active, align_recited_words
)
from app.routers.tafsir import router as tafsir_router

TEMP_AUDIO_DIR = os.path.join(os.path.abspath("."), "temp_audio")

def init_analytics_db():
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recitation_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            module_type TEXT,
            range_mode TEXT,
            start_val INTEGER,
            end_val INTEGER,
            score INTEGER,
            total_words INTEGER,
            match_count INTEGER,
            mistake_count INTEGER,
            transcription TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS frequent_mistakes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            word TEXT,
            norm_word TEXT,
            error_count INTEGER DEFAULT 1,
            last_missed DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, norm_word)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ayah_retention_state (
            username TEXT,
            surah_number INTEGER,
            ayah_number INTEGER,
            page_number INTEGER,
            juz_number INTEGER,
            total_attempts INTEGER DEFAULT 0,
            consecutive_passes INTEGER DEFAULT 0,
            current_status TEXT DEFAULT 'unattempted',
            last_attempt_timestamp DATETIME,
            last_mistake_timestamp DATETIME,
            last_cured_timestamp DATETIME,
            active_mistake_words TEXT DEFAULT '[]',
            PRIMARY KEY (username, surah_number, ayah_number)
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS session_verse_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            username TEXT,
            surah_number INTEGER,
            ayah_number INTEGER,
            page_number INTEGER,
            status TEXT,
            missed_words TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_analytics_db()
    os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
    print(f"Created/Verified temporary audio folder at: {TEMP_AUDIO_DIR}")
    print("Initializing Whisper AI Model (tarteel-ai/whisper-base-ar-quran)...")
    asyncio.create_task(asyncio.to_thread(init_whisper_model))
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key="super_secret_academic_key")
app.include_router(tafsir_router, prefix="/api/tafsir", tags=["tafsir"])

# DIRECTORY MOUNTS
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data", StaticFiles(directory="data"), name="data")
# Mounts the audio folder directly if needed by the frontend
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

templates = Jinja2Templates(directory="templates")

@app.get("/vite.svg")
@app.get("/favicon.ico")
async def get_portal_favicon():
    svg_icon = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>"""
    return Response(content=svg_icon, media_type="image/svg+xml")

# ==========================================
# 1. AUTHENTICATION ROUTES
# ==========================================
@app.get("/")
async def home(request: Request):
    # Serve the React application immediately; React handles auth routing via /api/me
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/register")
async def register_page(request: Request):
    return RedirectResponse(url="/")

@app.post("/register")
async def process_register(request: Request, username: str = Form(...), password: str = Form(...)):
    if len(username) != 5 or not username.isdigit():
        return {"error": "Identification Number must be exactly 5 numeric digits."}
    
    if len(password) < 5:
        return {"error": "Passcode must be at least 5 characters long."}
    
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return {"error": "This Identification Number is already registered."}
    
    conn.close()
    return {"success": True, "user": username}

@app.get("/login")
async def login_page(request: Request):
    return RedirectResponse(url="/")

@app.post("/login")
async def process_login(request: Request, username: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        request.session["user"] = username
        return {"success": True, "user": username}
    else:
        return {"error": "Invalid Identification Number or Passcode."}

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)

@app.get("/api/me")
async def get_current_user(request: Request):
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT, profile_photo TEXT)")
    
    cursor.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in cursor.fetchall()]
    if "display_name" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "profile_photo" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_photo TEXT")
    conn.commit()
        
    cursor.execute("SELECT display_name, profile_photo FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    display_name = row[0] if row else None
    profile_photo = row[1] if row and len(row) > 1 else None
    conn.close()
    
    return {
        "id": username,
        "username": username,
        "display_name": display_name,
        "profile_photo": profile_photo,
        "is_first_login": display_name is None or display_name.strip() == ""
    }

@app.post("/api/update_profile")
@app.post("/api/user/update-profile")
async def update_profile(request: Request, data: dict):
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    display_name = data.get("display_name", "").strip()
    profile_photo = data.get("profile_photo", "")
    
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT, profile_photo TEXT)")
    
    cursor.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in cursor.fetchall()]
    if "display_name" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
    if "profile_photo" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN profile_photo TEXT")
    conn.commit()
        
    if profile_photo:
        cursor.execute("UPDATE users SET display_name = ?, profile_photo = ? WHERE username = ?", (display_name, profile_photo, username))
    else:
        cursor.execute("UPDATE users SET display_name = ? WHERE username = ?", (display_name, username))
    conn.commit()
    conn.close()
    
    return {"status": "success", "display_name": display_name}

@app.post("/api/user/change-password")
async def user_change_password(request: Request, data: dict):
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")
    
    if not new_password or len(new_password) < 5:
        raise HTTPException(status_code=400, detail="New password must be at least 5 characters long.")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("SELECT password FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    if not row or row[0] != current_password:
        conn.close()
        raise HTTPException(status_code=400, detail="Current password entered is incorrect.")
        
    cursor.execute("UPDATE users SET password = ? WHERE username = ?", (new_password, username))
    conn.commit()
    conn.close()
    
    return {"status": "success"}

@app.post("/api/login")
async def api_login(request: Request, data: dict):
    username = data.get("username")
    password = data.get("password")
    
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        request.session["user"] = username
        return {"status": "success", "username": username}
    else:
        raise HTTPException(status_code=401, detail="Invalid username or passcode")

@app.post("/api/logout")
async def api_logout(request: Request):
    request.session.clear()
    return {"status": "success"}

# ==========================================
# 2. TILAWAT MANUSCRIPT & MAPPING ROUTES
# ==========================================
@app.get("/api/page_image/{page_number}")
async def get_page_image(page_number: int):
    if page_number < 1 or page_number > 604:
        raise HTTPException(status_code=404, detail="Page number out of range (1-604)")
    
    file_path = f"quran_pages/{page_number}.jpg"
    if os.path.exists(file_path):
        return FileResponse(
            file_path,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable"
            }
        )
    raise HTTPException(status_code=404, detail="Page image not found")

@app.get("/api/page_boxes/{page_number}")
async def get_page_boxes(page_number: int):
    try:
        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        
        cursor_map.execute("""
            SELECT sura_number, ayah_number, 
                   MIN(min_x), MAX(max_x), MIN(min_y), MAX(max_y)
            FROM glyphs_publication_1 
            WHERE page_number = ?
            GROUP BY sura_number, ayah_number, line_number
        """, (page_number,))
        
        boxes = cursor_map.fetchall()
        conn_map.close()

        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        
        result = []
        for b in boxes:
            cursor_text.execute("SELECT id FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (b[0], b[1]))
            row = cursor_text.fetchone()
            if row:
                global_id = row[0]
                result.append({
                    "sura": b[0], "ayah": b[1], "global_id": global_id,
                    "min_x": b[2], "max_x": b[3], "min_y": b[4], "max_y": b[5]
                })
                
        conn_text.close()
        return {"boxes": result}
    except Exception as e:
        print(f"Database Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/audio/{global_id}")
async def get_audio(global_id: int):
    file_path = f"audio/{global_id}.mp3"
    
    if os.path.exists(file_path):
        return FileResponse(
            file_path, 
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    else:
        print(f"ERROR: Could not find {file_path}")
        raise HTTPException(status_code=404, detail="Audio file not found.")

SURAH_NAMES = [
    "", "Al-Fatiha", "Al-Baqarah", "Ali 'Imran", "An-Nisa", "Al-Ma'idah", "Al-An'am", "Al-A'raf", "Al-Anfal", "At-Tawbah", "Yunus",
    "Hud", "Yusuf", "Ar-Ra'd", "Ibrahim", "Al-Hijr", "An-Nahl", "Al-Isra", "Al-Kahf", "Maryam", "Taha",
    "Al-Anbiya", "Al-Hajj", "Al-Mu'minun", "An-Nur", "Al-Furqan", "Ash-Shu'ara", "An-Naml", "Al-Qasas", "Al-'Ankabut", "Ar-Rum",
    "Luqman", "As-Sajdah", "Al-Ahzab", "Saba", "Fatir", "Ya-Sin", "As-Saffat", "Sad", "Az-Zumar", "Ghafir",
    "Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah", "Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf",
    "Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid", "Al-Mujadila", "Al-Hashr", "Al-Mumtahanah",
    "As-Saff", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim", "Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij",
    "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat", "An-Naba", "An-Nazi'at", "'Abasa",
    "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad",
    "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-'Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-'Adiyat",
    "Al-Qari'ah", "At-Takathur", "Al-'Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr",
    "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"
]

@app.get("/api/ayah_info/{global_id}")
async def get_ayah_info(global_id: int):
    try:
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        cursor_text.execute("SELECT surah_number, ayah_number FROM quran_text WHERE id = ?", (global_id,))
        row = cursor_text.fetchone()
        conn_text.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="Ayah not found")
            
        surah, ayah = row[0], row[1]
        
        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        cursor_map.execute("SELECT page_number FROM glyphs_publication_1 WHERE sura_number = ? AND ayah_number = ? LIMIT 1", (surah, ayah))
        p_row = cursor_map.fetchone()
        conn_map.close()
        
        page = p_row[0] if p_row else 1
        surah_name = SURAH_NAMES[surah] if 1 <= surah <= 114 else f"Surah {surah}"
        
        return {
            "global_id": global_id,
            "surah": surah,
            "ayah": ayah,
            "surah_name": surah_name,
            "page": page
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

_cached_quran_simple = None

def get_page_for_juz(page: int) -> int:
    if page <= 21:
        return 1
    if page >= 582:
        return 30
    return min(30, max(1, 2 + (page - 22) // 20))

@app.get("/api/quran-simple")
async def get_quran_simple():
    global _cached_quran_simple
    if _cached_quran_simple is not None:
        return _cached_quran_simple

    try:
        # 1. Map surah + ayah -> page from file1.db
        conn_map = sqlite3.connect("file1.db")
        c_map = conn_map.cursor()
        c_map.execute("SELECT sura_number, ayah_number, page_number FROM glyphs_publication_1 GROUP BY sura_number, ayah_number")
        page_map = {(row[0], row[1]): row[2] for row in c_map.fetchall()}
        conn_map.close()

        # 2. Get text from file2.db
        conn_text = sqlite3.connect("file2.db")
        c_text = conn_text.cursor()
        c_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in c_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")

        c_text.execute(f"SELECT surah_number, ayah_number, {text_col} FROM quran_text ORDER BY surah_number, ayah_number")
        rows = c_text.fetchall()
        conn_text.close()

        surahs_dict = {}
        for s_num in range(1, 115):
            name = SURAH_NAMES[s_num] if s_num < len(SURAH_NAMES) else f"Surah {s_num}"
            surahs_dict[s_num] = {
                "number": s_num,
                "englishName": name,
                "ayahs": []
            }

        for surah_num, ayah_num, text in rows:
            if surah_num in surahs_dict:
                page = page_map.get((surah_num, ayah_num), 1)
                juz = get_page_for_juz(page)
                surahs_dict[surah_num]["ayahs"].append({
                    "numberInSurah": ayah_num,
                    "text": text or "",
                    "page": page,
                    "juz": juz
                })

        _cached_quran_simple = list(surahs_dict.values())
        return _cached_quran_simple
    except Exception as e:
        logger.error(f"Error building quran-simple: {e}")
        raise HTTPException(status_code=500, detail=str(e))


def to_arabic_digits(num: int) -> str:
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    return "".join(arabic_digits[int(d)] for d in str(num))

def get_words_metadata_for_range(mode: str, start_val: int, end_val: int) -> tuple[str, list[dict], list[dict]]:
    """
    Returns (expected_full_text, pages_list, words_metadata) for the given Quran range.
    Each metadata item contains {"sura": s, "ayah": a, "page": p, "surah_name": name, "word": w}.
    """
    try:
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")

        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()

        query = "SELECT page_number, sura_number, ayah_number FROM glyphs_publication_1 WHERE "
        if mode == "page":
            cursor_map.execute(query + "page_number BETWEEN ? AND ? GROUP BY page_number, sura_number, ayah_number ORDER BY page_number, sura_number, ayah_number", (int(start_val), int(end_val)))
        elif mode == "surah":
            cursor_map.execute(query + "sura_number BETWEEN ? AND ? GROUP BY page_number, sura_number, ayah_number ORDER BY sura_number, ayah_number", (int(start_val), int(end_val)))
        elif mode == "juz":
            juz_bounds = [
                (1, 21), (22, 41), (42, 61), (62, 81), (82, 101),
                (102, 121), (122, 141), (142, 161), (162, 181), (182, 201),
                (202, 221), (222, 241), (242, 261), (262, 281), (282, 301),
                (302, 321), (322, 341), (342, 361), (362, 381), (382, 401),
                (402, 421), (422, 441), (442, 461), (462, 481), (482, 501),
                (502, 521), (522, 541), (542, 561), (562, 581), (582, 604)
            ]
            j_idx = max(1, min(30, int(start_val))) - 1
            sp, ep = juz_bounds[j_idx]
            cursor_map.execute(query + "page_number BETWEEN ? AND ? GROUP BY page_number, sura_number, ayah_number ORDER BY page_number, sura_number, ayah_number", (sp, ep))
        else:
            cursor_map.execute(query + "page_number BETWEEN ? AND ? GROUP BY page_number, sura_number, ayah_number ORDER BY page_number, sura_number, ayah_number", (int(start_val), int(end_val)))

        rows = cursor_map.fetchall()
        conn_map.close()

        pages_dict = {}
        all_texts = []
        word_metadata = []

        for r in rows:
            p_num, sura, ayah = r[0], r[1], r[2]
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (sura, ayah))
            t_row = cursor_text.fetchone()
            if t_row and t_row[0]:
                txt = t_row[0]
                all_texts.append(txt)
                formatted_txt = f"{txt} ﴿{to_arabic_digits(ayah)}﴾"
                if p_num not in pages_dict:
                    pages_dict[p_num] = []
                pages_dict[p_num].append(formatted_txt)

                s_name = SURAH_NAMES[sura] if 1 <= sura <= 114 else f"Surah {sura}"
                for w in txt.split():
                    word_metadata.append({
                        "sura": sura,
                        "ayah": ayah,
                        "page": p_num,
                        "surah_name": s_name,
                        "word": w
                    })

        conn_text.close()
        expected_text = " ".join(all_texts)
        pages_list = [
            {"page_number": p, "label": f"Page {p}", "text": " ".join(txts)}
            for p, txts in sorted(pages_dict.items())
        ]
        return expected_text, pages_list, word_metadata
    except Exception as e:
        logger.error(f"Error getting words metadata for range: {e}")
        return "", [], []

# ==========================================
# 3. TASMEE ROUTES (PAGINATED RANGE SUPPORT)
# ==========================================
@app.get("/api/tasmee_target")
async def get_tasmee_target(mode: str, start_val: int, end_val: int):
    expected_text, pages_list, word_metadata = get_words_metadata_for_range(mode, start_val, end_val)
    if not expected_text:
        return {"error": "No text found for this selection in the database."}
    return {
        "expected_text": expected_text,
        "pages": pages_list,
        "verse_metadata": word_metadata
    }

@app.post("/api/tasmee_chunk_process")
async def process_tasmee_chunk(file: UploadFile = File(...), expected_word: str = Form(...)):
    """ REAL-TIME EVALUATION ENDPOINT for Tasmee using Whisper STT """
    try:
        audio_bytes = await file.read()
        transcription = await transcribe_audio_file(audio_bytes, expected_word)
        norm_user = normalize_arabic(transcription)
        norm_expected = normalize_arabic(expected_word)
        
        status = "match" if (norm_user and (norm_user in norm_expected or norm_expected in norm_user)) else "mistake"
        return {"status": status, "transcription": transcription}
    except Exception as e:
        print(f"Tasmee chunk evaluation error: {e}")
        return {"status": "mistake", "transcription": ""}


# ==========================================
# 4. IKHTEBAAR ROUTES (REMOVED JUZ)
# ==========================================
class IkhtebaarQuestionRequest(BaseModel):
    mode: Optional[str] = "page"
    start_val: Optional[Union[int, str]] = 1
    end_val: Optional[Union[int, str]] = 1
    difficulty: Optional[str] = "easy"
    exclude: Optional[str] = ""
    excluded_ids: Optional[List[str]] = []

def _generate_ikhtebaar_logic(mode: str, start_val: int, end_val: int, difficulty: str, exclude_list: list):
    try:
        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        
        excluded_set = set()
        if exclude_list:
            for item in exclude_list:
                if isinstance(item, str) and "-" in item:
                    parts = item.split("-")
                    if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
                        excluded_set.add((int(parts[0]), int(parts[1])))

        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")

        query_map = "SELECT DISTINCT sura_number, ayah_number, page_number FROM glyphs_publication_1 WHERE "
        
        if mode == "page":
            cursor_map.execute(query_map + "page_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (start_val, end_val))
        elif mode == "surah":
            cursor_map.execute(query_map + "sura_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (start_val, end_val))
            
        ayahs_pool = cursor_map.fetchall()

        if not ayahs_pool:
            return {"error": "No ayahs found for this range."}

        valid_starts = [a for a in ayahs_pool if (a[0], a[1]) not in excluded_set]
        
        if not valid_starts:
            return {"error": "All unique questions in this specific range and difficulty have been exhausted! Change the range or refresh the page."}

        selected_start = None
        if difficulty == "easy":
            easy_pool = [a for a in valid_starts if a[1] == 1 or a == ayahs_pool[0]]
            selected_start = random.choice(easy_pool) if easy_pool else random.choice(valid_starts)
            
        elif difficulty == "medium":
            mid_idx = len(valid_starts) // 2
            medium_pool = valid_starts[max(0, mid_idx - 10) : min(len(valid_starts), mid_idx + 10)]
            selected_start = random.choice(medium_pool) if medium_pool else random.choice(valid_starts)
            
        elif difficulty == "hard":
            hard_pool = []
            for start_ayah in valid_starts:
                idx_in_main = ayahs_pool.index(start_ayah)
                if idx_in_main < len(ayahs_pool) - 1:
                    if ayahs_pool[idx_in_main][2] != ayahs_pool[idx_in_main+1][2]:
                        hard_pool.append(start_ayah)
            selected_start = random.choice(hard_pool) if hard_pool else random.choice(valid_starts)

        start_idx = ayahs_pool.index(selected_start)
        start_page = selected_start[2]
        
        # Calculate the starting position ratio on start_page
        start_page_ayahs = [a for a in ayahs_pool if a[2] == start_page]
        start_idx_in_page = start_page_ayahs.index(selected_start) if selected_start in start_page_ayahs else 0
        n_start = len(start_page_ayahs) or 1
        p_start = start_idx_in_page / n_start

        # Scan for ending candidates whose distance is strictly between 1.0 and 1.5 pages
        candidates = []
        for idx in range(start_idx + 1, len(ayahs_pool)):
            curr = ayahs_pool[idx]
            curr_page = curr[2]
            curr_page_ayahs = [a for a in ayahs_pool if a[2] == curr_page]
            curr_idx_in_page = curr_page_ayahs.index(curr) if curr in curr_page_ayahs else 0
            n_curr = len(curr_page_ayahs) or 1
            p_curr = curr_idx_in_page / n_curr
            
            dist = (curr_page - start_page) + (p_curr - p_start)
            if 1.0 <= dist <= 1.5:
                candidates.append((idx, curr))

        # Handle page boundary edge case (near the end of the Quran, or if no candidates)
        if not candidates or start_page >= 603:
            stop_idx = len(ayahs_pool) - 1
            selected_stop = ayahs_pool[stop_idx]
        else:
            # Select candidate closer to 1.25 pages (around 60% of candidates list)
            chosen_idx, chosen_curr = candidates[min(int(len(candidates) * 0.6), len(candidates) - 1)]
            stop_idx = chosen_idx
            selected_stop = chosen_curr

        target_page = selected_start[2]
        target_surah = selected_start[0]

        def get_text(surah, ayah):
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (surah, ayah))
            res = cursor_text.fetchone()
            return res[0] if res else ""

        start_text = get_text(selected_start[0], selected_start[1])
        stop_text = get_text(selected_stop[0], selected_stop[1])
        
        full_text_list = []
        verse_metadata_list = []
        for i in range(start_idx, stop_idx + 1):
            s_i, a_i, p_i = ayahs_pool[i][0], ayahs_pool[i][1], ayahs_pool[i][2]
            txt_i = get_text(s_i, a_i)
            full_text_list.append(txt_i)
            s_name_i = SURAH_NAMES[s_i] if 1 <= s_i <= 114 else f"Surah {s_i}"
            for w in txt_i.split():
                verse_metadata_list.append({
                    "sura": s_i,
                    "ayah": a_i,
                    "page": p_i,
                    "surah_name": s_name_i,
                    "word": w
                })
        expected_full_text = " ".join(full_text_list)

        cursor_map.execute("SELECT sura_number, ayah_number FROM glyphs_publication_1 WHERE page_number = ? ORDER BY sura_number, ayah_number LIMIT 1", (target_page,))
        first_ayah_page = cursor_map.fetchone()
        hint_1 = get_text(first_ayah_page[0], first_ayah_page[1]) if first_ayah_page else ""

        hint_2 = f"Surah Number: {target_surah}"

        hint_3_list = []
        cursor_map.execute("SELECT DISTINCT sura_number, ayah_number FROM glyphs_publication_1 WHERE page_number = ? ORDER BY sura_number, ayah_number", (target_page,))
        page_ayahs = cursor_map.fetchall()
        for pa in page_ayahs:
            if pa[0] == selected_start[0] and pa[1] == selected_start[1]:
                break
            hint_3_list.append(get_text(pa[0], pa[1]))
        
        hint_3 = " ".join(hint_3_list)
        if not hint_3:
            hint_3 = "(This is the very first Ayah on the page. No preceding Ayahs exist on this page.)"

        conn_map.close()
        conn_text.close()

        surah_num = selected_start[0]
        surah_name = SURAH_NAMES[surah_num] if 1 <= surah_num <= 114 else f"Surah {surah_num}"
        ayah_number = selected_start[1]
        
        end_surah_num = selected_stop[0]
        end_surah_name = SURAH_NAMES[end_surah_num] if 1 <= end_surah_num <= 114 else f"Surah {end_surah_num}"
        end_ayah_number = selected_stop[1]
        end_page_number = selected_stop[2]

        return {
            "question_id": f"{selected_start[0]}-{selected_start[1]}", 
            "surah_number": surah_num,
            "surah_name": surah_name,
            "ayah_number": ayah_number,
            "page_number": target_page,
            "arabic_text": start_text,
            "start_text": start_text,
            "start_arabic_text": start_text,
            "stop_text": stop_text,
            "end_arabic_text": stop_text,
            "expected_full_text": expected_full_text,
            "verse_metadata": verse_metadata_list,
            "end_surah_number": end_surah_num,
            "end_surah_name": end_surah_name,
            "end_ayah_number": end_ayah_number,
            "end_page_number": end_page_number,
            "hint_1": hint_1,
            "hint_2": hint_2,
            "hint_3": hint_3
        }

    except Exception as e:
        print(f"Ikhtebaar Error: {e}")
        return {"error": str(e)}

@app.get("/api/generate_ikhtebaar")
async def generate_ikhtebaar_get(mode: str = "page", start_val: int = 1, end_val: int = 1, difficulty: str = "easy", exclude: str = ""):
    exclude_list = [item for item in exclude.split(",") if item] if exclude else []
    return _generate_ikhtebaar_logic(mode, int(start_val), int(end_val), difficulty, exclude_list)

@app.post("/api/generate_ikhtebaar")
async def generate_ikhtebaar_post(req: IkhtebaarQuestionRequest):
    exclude_list = list(req.excluded_ids or [])
    if req.exclude:
        for item in req.exclude.split(","):
            if item and item not in exclude_list:
                exclude_list.append(item)
    return _generate_ikhtebaar_logic(req.mode or "page", int(req.start_val or 1), int(req.end_val or 1), req.difficulty or "easy", exclude_list)

@app.get("/api/ikhtebaar/question")
async def get_ikhtebaar_question(mode: str = "page", start_val: int = 1, end_val: int = 1, difficulty: str = "easy", exclude: str = ""):
    exclude_list = [item for item in exclude.split(",") if item] if exclude else []
    return _generate_ikhtebaar_logic(mode, int(start_val), int(end_val), difficulty, exclude_list)

@app.post("/api/ikhtebaar/question")
async def post_ikhtebaar_question(req: IkhtebaarQuestionRequest):
    exclude_list = list(req.excluded_ids or [])
    if req.exclude:
        for item in req.exclude.split(","):
            if item and item not in exclude_list:
                exclude_list.append(item)
    return _generate_ikhtebaar_logic(req.mode or "page", int(req.start_val or 1), int(req.end_val or 1), req.difficulty or "easy", exclude_list)

async def process_live_recitation_chunk(sess: RecitationSession, new_audio_bytes: bytes):
    # ── Step 1: Merge incoming chunk into rolling buffer ──────────────────────
    if not sess.rolling_buffer:
        sess.rolling_buffer = new_audio_bytes
    else:
        payload = new_audio_bytes[44:] if len(new_audio_bytes) > 44 else new_audio_bytes
        sess.rolling_buffer = sess.rolling_buffer + payload

    # ── Step 2: Hard-cap rolling buffer to last 6.0 seconds (96,000 samples @ 16kHz × 2 bytes = 192,000 bytes PCM)
    # This keeps Whisper inference time constant regardless of session length.
    sess.rolling_buffer = trim_to_last_n_seconds(sess.rolling_buffer, seconds=6.0)

    if sess.confirmed_index >= sess.total_words:
        correct_cnt = sum(1 for w in sess.word_status if w["status"] in ("correct", "bismillah_skipped"))
        acc = round((correct_cnt / sess.total_words) * 100, 1) if sess.total_words > 0 else 0.0
        return {
            "status": "completed",
            "confirmed_index": sess.confirmed_index,
            "total_words": sess.total_words,
            "newly_confirmed": [],
            "nudge": False,
            "word_status": sess.word_status,
            "accuracy_score": acc,
            "score": int(round(acc))
        }

    upcoming_prompt = sess.get_upcoming_prompt(count=8)

    # ── Step 3: RMS Voice Activity Detection ─────────────────────────────────
    # Decode audio to check energy BEFORE dispatching to Whisper.
    # If the buffer is essentially silence (breathing, room noise, thinking pause),
    # skip the Whisper call entirely — zero CPU cost, zero hallucination risk.
    test_array, _ = decode_audio_bytes_to_numpy(sess.rolling_buffer)
    if test_array is None or not is_voice_active(test_array, threshold=0.003):
        logger.info(f"[VAD] Session {sess.session_id}: Silence detected in rolling buffer — skipping Whisper inference.")
        return {
            "status": "silence",
            "transcription": "",
            "newly_confirmed": [],
            "nudge": False,
            "confirmed_index": sess.confirmed_index,
            "total_words": sess.total_words,
            "word_status": sess.word_status,
            "accuracy_score": round(
                sum(1 for w in sess.word_status if w["status"] in ("correct", "bismillah_skipped")) / sess.total_words * 100, 1
            ) if sess.total_words > 0 else 0.0,
            "score": 0,
            "model_loaded": is_model_ready()
        }

    # ── Step 4: Whisper Inference with Quranic Context Guidance ─────────────
    # Biases the ASR decoder towards authentic Quranic orthography and prevents acoustic drift
    already_said_start = max(0, sess.confirmed_index - 4)
    upcoming_end = min(sess.total_words, sess.confirmed_index + 10)
    chunk_prompt = " ".join(sess.display_words[already_said_start:upcoming_end])

    transcription = await transcribe_audio_file(
        audio_bytes=sess.rolling_buffer,
        initial_prompt=chunk_prompt,
        max_new_tokens=48
    )

    if transcription:
        sess.transcriptions.append(transcription)

    norm_user_words = normalize_arabic(transcription).split()

    # 1. Bismillah auto-skip check if student starts directly at Ayah 1
    sess.check_and_apply_bismillah_skip(norm_user_words)

    norm_remainder = sess.norm_expected_words[sess.confirmed_index:]
    newly_confirmed = []

    if norm_user_words and norm_remainder:
        # Dynamic programming phonetic alignment (LCS) — matches words monotonically
        # even with Whisper hallucinations, insertions, phonetic shifts, or noise
        matched_indices = align_recited_words(norm_remainder, norm_user_words, max_window=30)
        
        if matched_indices:
            for rel_idx in matched_indices:
                abs_idx = sess.confirmed_index + rel_idx
                if abs_idx < sess.total_words:
                    if sess.word_status[abs_idx]["status"] not in ("correct", "bismillah_skipped"):
                        sess.word_status[abs_idx]["status"] = "correct"
                        newly_confirmed.append(sess.display_words[abs_idx])
            
            furthest_idx = matched_indices[-1]
            sess.confirmed_index = min(sess.total_words, sess.confirmed_index + furthest_idx + 1)
            sess.consecutive_misses = 0
        else:
            if is_model_ready():
                sess.consecutive_misses += 1
    else:
        if is_model_ready():
            sess.consecutive_misses += 1

    nudge = sess.consecutive_misses >= 3

    correct_cnt = sum(1 for w in sess.word_status if w["status"] in ("correct", "bismillah_skipped"))
    accuracy = round((correct_cnt / sess.total_words) * 100, 1) if sess.total_words > 0 else 0.0

    return {
        "status": "success",
        "transcription": transcription,
        "newly_confirmed": newly_confirmed,
        "nudge": nudge,
        "confirmed_index": sess.confirmed_index,
        "total_words": sess.total_words,
        "word_status": sess.word_status,
        "accuracy_score": accuracy,
        "score": int(round(accuracy)),
        "model_loaded": is_model_ready()
    }

def update_verse_retention_from_session(username: str, session_id: str, range_mode: str, start_val: int, end_val: int, word_status_list: list):
    """
    Updates the Ayah-Level Retention State Machine and logs session verse results.
    Maps words in word_status_list to their respective (sura, ayah, page) in order.
    """
    try:
        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")

        query = "SELECT DISTINCT page_number, sura_number, ayah_number FROM glyphs_publication_1 WHERE "
        if range_mode == "page":
            cursor_map.execute(query + "page_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (start_val, end_val))
        elif range_mode == "surah":
            cursor_map.execute(query + "sura_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (start_val, end_val))
        elif range_mode == "juz":
            juz_bounds = [
                (1, 21), (22, 41), (42, 61), (62, 81), (82, 101),
                (102, 121), (122, 141), (142, 161), (162, 181), (182, 201),
                (202, 221), (222, 241), (242, 261), (262, 281), (282, 301),
                (302, 321), (322, 341), (342, 361), (362, 381), (382, 401),
                (402, 421), (422, 441), (442, 461), (462, 481), (482, 501),
                (502, 521), (522, 541), (542, 561), (562, 581), (582, 604)
            ]
            j_idx = max(1, min(30, int(start_val))) - 1
            sp, ep = juz_bounds[j_idx]
            cursor_map.execute(query + "page_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (sp, ep))
        else:
            cursor_map.execute(query + "page_number BETWEEN ? AND ? ORDER BY sura_number, ayah_number", (start_val, end_val))

        verses_pool = cursor_map.fetchall()
        conn_map.close()

        if not verses_pool:
            conn_text.close()
            return

        verse_word_map = []
        for p_num, s_num, a_num in verses_pool:
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (s_num, a_num))
            res = cursor_text.fetchone()
            txt = res[0] if res else ""
            words = txt.split()
            verse_word_map.append({
                "page_number": p_num,
                "surah_number": s_num,
                "ayah_number": a_num,
                "words": words,
                "word_count": len(words)
            })
        conn_text.close()

        word_idx = 0
        conn_users = sqlite3.connect("users.db")
        cursor_users = conn_users.cursor()

        juz_bounds = [
            (1, 21), (22, 41), (42, 61), (62, 81), (82, 101),
            (102, 121), (122, 141), (142, 161), (162, 181), (182, 201),
            (202, 221), (222, 241), (242, 261), (262, 281), (282, 301),
            (302, 321), (322, 341), (342, 361), (362, 381), (382, 401),
            (402, 421), (422, 441), (442, 461), (462, 481), (482, 501),
            (502, 521), (522, 541), (542, 561), (562, 581), (582, 604)
        ]

        for v in verse_word_map:
            v_words_count = v["word_count"]
            v_statuses = word_status_list[word_idx : word_idx + v_words_count]
            word_idx += v_words_count

            if not v_statuses:
                continue

            missed_words = []
            for item in v_statuses:
                st = item.get("status") if isinstance(item, dict) else "mistake"
                w = item.get("word") if isinstance(item, dict) else str(item)
                if st not in ("match", "correct", "bismillah_skipped"):
                    missed_words.append(w)

            is_pass = len(missed_words) == 0
            p = v["page_number"]
            juz_num = 1
            for j_i, (b_s, b_e) in enumerate(juz_bounds):
                if b_s <= p <= b_e:
                    juz_num = j_i + 1
                    break

            cursor_users.execute("""
                INSERT INTO session_verse_logs (session_id, username, surah_number, ayah_number, page_number, status, missed_words)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (session_id, username, v["surah_number"], v["ayah_number"], v["page_number"], "pass" if is_pass else "fail", json.dumps(missed_words)))

            cursor_users.execute("""
                SELECT current_status, consecutive_passes, total_attempts 
                FROM ayah_retention_state 
                WHERE username = ? AND surah_number = ? AND ayah_number = ?
            """, (username, v["surah_number"], v["ayah_number"]))
            prev_row = cursor_users.fetchone()

            if is_pass:
                new_status = "cured" if (prev_row and prev_row[0] == "active_mistake") else "mastered"
                prev_passes = (prev_row[1] if prev_row else 0) + 1
                prev_attempts = (prev_row[2] if prev_row else 0) + 1

                cursor_users.execute("""
                    INSERT INTO ayah_retention_state (
                        username, surah_number, ayah_number, page_number, juz_number,
                        total_attempts, consecutive_passes, current_status, last_attempt_timestamp,
                        last_cured_timestamp, active_mistake_words
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CASE WHEN ? = 'cured' THEN CURRENT_TIMESTAMP ELSE NULL END, '[]')
                    ON CONFLICT(username, surah_number, ayah_number) DO UPDATE SET
                        total_attempts = total_attempts + 1,
                        consecutive_passes = consecutive_passes + 1,
                        current_status = excluded.current_status,
                        last_attempt_timestamp = CURRENT_TIMESTAMP,
                        last_cured_timestamp = CASE WHEN excluded.current_status = 'cured' THEN CURRENT_TIMESTAMP ELSE last_cured_timestamp END,
                        active_mistake_words = '[]'
                """, (username, v["surah_number"], v["ayah_number"], v["page_number"], juz_num, prev_attempts, prev_passes, new_status, new_status))
            else:
                prev_attempts = (prev_row[2] if prev_row else 0) + 1
                cursor_users.execute("""
                    INSERT INTO ayah_retention_state (
                        username, surah_number, ayah_number, page_number, juz_number,
                        total_attempts, consecutive_passes, current_status, last_attempt_timestamp,
                        last_mistake_timestamp, active_mistake_words
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 0, 'active_mistake', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
                    ON CONFLICT(username, surah_number, ayah_number) DO UPDATE SET
                        total_attempts = total_attempts + 1,
                        consecutive_passes = 0,
                        current_status = 'active_mistake',
                        last_attempt_timestamp = CURRENT_TIMESTAMP,
                        last_mistake_timestamp = CURRENT_TIMESTAMP,
                        active_mistake_words = excluded.active_mistake_words
                """, (username, v["surah_number"], v["ayah_number"], v["page_number"], juz_num, prev_attempts, json.dumps(missed_words)))

        conn_users.commit()
        conn_users.close()
    except Exception as err:
        print(f"Verse retention update error: {err}")

def finalize_recitation_session(sess: RecitationSession, session_id: str, request: Request = None):
    # Any word not yet verified as correct or skipped is marked as a mistake
    for idx in range(sess.total_words):
        if sess.word_status[idx]["status"] == "pending":
            sess.word_status[idx]["status"] = "mistake"

    correct_count = sum(1 for w in sess.word_status if w["status"] in ("correct", "bismillah_skipped"))
    mistake_count = sess.total_words - correct_count
    accuracy_score = round((correct_count / sess.total_words) * 100, 1) if sess.total_words > 0 else 0.0

    comparison_payload = [
        {
            "word": w["word"],
            "status": "match" if w["status"] in ("correct", "bismillah_skipped") else "mistake",
            "raw_status": w.get("status", "mistake"),
            "sura": w.get("sura", 1),
            "ayah": w.get("ayah", 1),
            "page": w.get("page", 1),
            "surah_name": w.get("surah_name", "")
        }
        for w in sess.word_status
    ]

    user_transcription = sess.final_transcription or (" ".join(sess.transcriptions) if sess.transcriptions else "")

    result = {
        "status": "success",
        "session_id": session_id,
        "score": int(round(accuracy_score)),
        "accuracy_score": accuracy_score,
        "correct_words_count": correct_count,
        "matches": correct_count,
        "mistake_count": mistake_count,
        "mistakes": mistake_count,
        "total_words": sess.total_words,
        "total": sess.total_words,
        "user_transcription": user_transcription,
        "comparison": comparison_payload,
        "instant_finalized": True
    }

    # Record analytics in users.db
    try:
        username = (request.session.get("user") if request else None) or "guest"
        conn = sqlite3.connect("users.db")
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO recitation_sessions 
            (username, module_type, range_mode, start_val, end_val, score, total_words, match_count, mistake_count, transcription)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            username,
            sess.module_type,
            sess.range_mode,
            sess.start_val,
            sess.end_val,
            int(round(accuracy_score)),
            sess.total_words,
            correct_count,
            mistake_count,
            user_transcription
        ))

        for item in comparison_payload:
            if item["status"] == "mistake":
                w_raw = item["word"]
                w_cleaned = re.sub(r'[\uFD3E\uFD3F0-9\u0660-\u0669\s]+', '', w_raw).strip()
                w_norm = normalize_arabic(w_cleaned)
                if w_norm:
                    cursor.execute("""
                        INSERT INTO frequent_mistakes (username, word, norm_word, error_count)
                        VALUES (?, ?, ?, 1)
                        ON CONFLICT(username, norm_word) DO UPDATE SET
                            error_count = error_count + 1,
                            last_missed = CURRENT_TIMESTAMP
                    """, (username, w_cleaned, w_norm))
        conn.commit()
        conn.close()

        # Update Ayah-Level Retention State Machine
        update_verse_retention_from_session(
            username=username,
            session_id=session_id,
            range_mode=sess.range_mode,
            start_val=sess.start_val,
            end_val=sess.end_val,
            word_status_list=sess.word_status
        )
    except Exception as db_err:
        print(f"Recitation analytics log warning: {db_err}")

    return result

# ----------------- IKHTEBAAR STATEFUL ENDPOINTS -----------------
@app.post("/api/ikhtebaar/start_session")
async def ikhtebaar_start_session(
    session_id: str = Form(...), 
    expected_text: str = Form(...),
    range_mode: str = Form("custom"),
    start_val: int = Form(1),
    end_val: int = Form(1),
    question_id: str = Form("")
):
    if not is_model_ready():
        return {
            "status": "error",
            "error": "AI_MODEL_NOT_READY",
            "message": "Whisper AI Quran model is currently initializing. Please wait a moment before reciting.",
            "model_loaded": False
        }
    
    # Extract metadata for words in question if available
    word_metadata = []
    try:
        _, _, word_metadata = get_words_metadata_for_range(range_mode, start_val, end_val)
    except Exception as e:
        logger.warning(f"Could not build ikhtebaar word metadata: {e}")

    sess = RecitationSession(
        session_id=session_id, 
        expected_text=expected_text, 
        module_type="ikhtebaar",
        range_mode=range_mode,
        start_val=start_val,
        end_val=end_val,
        word_metadata=word_metadata
    )
    ikhtebaar_sessions[session_id] = sess
    return {
        "status": "success",
        "session_id": session_id,
        "total_words": sess.total_words,
        "model_loaded": True,
        "word_status": sess.word_status
    }

@app.post("/api/ikhtebaar/chunk")
async def ikhtebaar_chunk(session_id: str = Form(...), file: UploadFile = File(...)):
    if session_id not in ikhtebaar_sessions:
        return {"error": "Session not found or expired"}
    if not is_model_ready():
        return {
            "status": "error",
            "error": "AI_MODEL_NOT_READY",
            "message": "Whisper AI model is not ready.",
            "word_status": ikhtebaar_sessions[session_id].word_status
        }
    audio_bytes = await file.read()
    return await process_live_recitation_chunk(ikhtebaar_sessions[session_id], audio_bytes)

async def final_audio_sweep(sess: RecitationSession, final_audio_bytes: bytes):
    """
    Performs one final full-audio Whisper transcription pass over the entire recitation.
    This safety net guarantees that conclude_session grading reflects the COMPLETE recording,
    recovering any words that rolling 6s chunks missed or cut off.
    """
    if not final_audio_bytes or len(final_audio_bytes) < 44:
        return

    # Decode to check voice activity — skip if the final blob is silence/noise
    test_array, _ = decode_audio_bytes_to_numpy(final_audio_bytes)
    if test_array is None or not is_voice_active(test_array, threshold=0.003):
        logger.info(f"[FinalSweep] Session {sess.session_id}: final audio is silent — skipping final Whisper pass.")
        return

    logger.info(f"[FinalSweep] Session {sess.session_id}: Running final full-audio Whisper pass. (Current confirmed_index={sess.confirmed_index}/{sess.total_words})")

    try:
        final_prompt = " ".join(sess.display_words[:40]) if sess.display_words else ""
        final_transcription = await transcribe_audio_file(
            audio_bytes=final_audio_bytes,
            initial_prompt=final_prompt,
            max_new_tokens=256  # Allows full decode of long recitations / full pages
        )
    except Exception as e:
        logger.error(f"[FinalSweep] Whisper error: {e}")
        return

    if not final_transcription:
        return

    sess.final_transcription = final_transcription
    sess.transcriptions.append(final_transcription)
    norm_user_words = normalize_arabic(final_transcription).split()
    logger.info(f"[FinalSweep] Final transcription: '{final_transcription}'")

    if not norm_user_words:
        return

    # Bismillah auto-skip check if student started directly at Ayah 1
    sess.check_and_apply_bismillah_skip(norm_user_words)

    # Monotonic DP alignment across the entire target text
    matched_indices = align_recited_words(sess.norm_expected_words, norm_user_words, max_window=0)

    if matched_indices:
        for idx in matched_indices:
            if idx < sess.total_words:
                sess.word_status[idx]["status"] = "correct"
        
        furthest_idx = matched_indices[-1]
        sess.confirmed_index = max(sess.confirmed_index, min(sess.total_words, furthest_idx + 1))
        logger.info(f"[FinalSweep] Confirmed {len(matched_indices)} total matching words. Final confirmed_index={sess.confirmed_index}/{sess.total_words}")


@app.post("/api/ikhtebaar/conclude_session")
async def ikhtebaar_conclude_session(request: Request, session_id: str = Form(...), file: UploadFile = File(None)):
    if session_id not in ikhtebaar_sessions:
        return {"error": "Session not found"}
    sess = ikhtebaar_sessions.pop(session_id)

    # Run final sweep if frontend sent the complete audio blob
    if file is not None:
        try:
            final_audio_bytes = await file.read()
            await final_audio_sweep(sess, final_audio_bytes)
        except Exception as e:
            logger.warning(f"[ikhtebaar conclude] Final audio sweep failed: {e}")

    return finalize_recitation_session(sess, session_id, request=request)

# ----------------- TASMEE STATEFUL ENDPOINTS -----------------
@app.get("/api/model_status")
async def get_model_status():
    return get_model_health()

@app.post("/api/tasmee/start_session")
async def tasmee_start_session(
    session_id: str = Form(...),
    expected_text: str = Form(...),
    range_mode: str = Form("custom"),
    start_val: int = Form(1),
    end_val: int = Form(1)
):
    if not is_model_ready():
        return {
            "status": "error",
            "error": "AI_MODEL_NOT_READY",
            "message": "Whisper AI Quran model is currently initializing. Please wait a moment before reciting.",
            "model_loaded": False
        }
    
    # Retrieve word metadata
    _, _, word_metadata = get_words_metadata_for_range(range_mode, start_val, end_val)

    sess = RecitationSession(
        session_id=session_id,
        expected_text=expected_text,
        module_type="tasmee",
        range_mode=range_mode,
        start_val=start_val,
        end_val=end_val,
        word_metadata=word_metadata
    )
    tasmee_sessions[session_id] = sess
    return {
        "status": "success",
        "session_id": session_id,
        "total_words": sess.total_words,
        "model_loaded": True,
        "word_status": sess.word_status
    }

@app.post("/api/tasmee/chunk")
async def tasmee_chunk(session_id: str = Form(...), file: UploadFile = File(...)):
    if session_id not in tasmee_sessions:
        return {"error": "Session not found or expired"}
    if not is_model_ready():
        return {
            "status": "error",
            "error": "AI_MODEL_NOT_READY",
            "message": "Whisper AI model is not ready.",
            "word_status": tasmee_sessions[session_id].word_status
        }
    audio_bytes = await file.read()
    return await process_live_recitation_chunk(tasmee_sessions[session_id], audio_bytes)

@app.post("/api/tasmee/conclude_session")
async def tasmee_conclude_session(request: Request, session_id: str = Form(...), file: UploadFile = File(None)):
    if session_id not in tasmee_sessions:
        return {"error": "Session not found"}
    sess = tasmee_sessions.pop(session_id)

    # Run final sweep if frontend sent the complete audio blob
    if file is not None:
        try:
            final_audio_bytes = await file.read()
            await final_audio_sweep(sess, final_audio_bytes)
        except Exception as e:
            logger.warning(f"[tasmee conclude] Final audio sweep failed: {e}")

    return finalize_recitation_session(sess, session_id, request=request)

@app.post("/api/cancel_session")
async def cancel_session(session_id: str = Form(...), module_type: str = Form("tasmee")):
    """ Safely aborts and cleans up an in-progress recitation or exam session without writing to users.db """
    try:
        tasmee_sessions.pop(session_id, None)
        ikhtebaar_sessions.pop(session_id, None)

        # Clean up any temporary files recorded for this session
        cleaned_files = 0
        if os.path.exists(TEMP_AUDIO_DIR):
            for f in os.listdir(TEMP_AUDIO_DIR):
                if f.startswith(session_id):
                    try:
                        os.remove(os.path.join(TEMP_AUDIO_DIR, f))
                        cleaned_files += 1
                    except Exception:
                        pass

        print(f"[Session Cancel] Aborted session {session_id}, cleaned {cleaned_files} temp audio chunks.")
        return {"status": "success", "session_id": session_id, "cleaned_files": cleaned_files}
    except Exception as e:
        print(f"[Session Cancel Error] {e}")
        return {"error": str(e)}

@app.post("/transcribe_chunk")
async def transcribe_chunk(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    chunk_index: int = Form(...)
):
    """ Real-time chunk transcription endpoint. Saves chunks physically. """
    try:
        os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
        filename = f"{session_id}_chunk_{chunk_index}.wav"
        filepath = os.path.join(TEMP_AUDIO_DIR, filename)
        
        audio_bytes = await file.read()
        with open(filepath, "wb") as f:
            f.write(audio_bytes)
            
        print(f"[Chunk Save] Saved incoming chunk to file: {filepath}")
        
        # Transcribe the chunk with cpu float32 / fp16=False optimization
        transcription = await transcribe_audio_file(audio_bytes)
        
        return {
            "chunk_index": chunk_index,
            "transcription": transcription,
            "status": "success",
            "file_path": filepath
        }
    except Exception as e:
        print(f"Chunk transcription error: {e}")
        return {"error": str(e)}

@app.post("/api/cleanup_temp")
async def cleanup_temp(session_id: str = Form(None)):
    """ Wipes files in /temp_audio associated with session_id, or all files if not specified """
    try:
        if not os.path.exists(TEMP_AUDIO_DIR):
            return {"status": "success", "cleaned": 0}
            
        count = 0
        for f in os.listdir(TEMP_AUDIO_DIR):
            if session_id is None or f.startswith(session_id):
                try:
                    os.remove(os.path.join(TEMP_AUDIO_DIR, f))
                    count += 1
                except Exception:
                    pass
        return {"status": "success", "cleaned": count}
    except Exception as e:
        return {"error": str(e)}

@app.post("/transcribe_and_compare")
async def transcribe_and_compare(
    request: Request,
    file: UploadFile = File(...),
    expected_text: str = Form(...),
    module_type: str = Form("tasmee"),
    range_mode: str = Form("juz"),
    start_val: int = Form(1),
    end_val: int = Form(1)
):
    """ Final Grading Endpoint for Tasmee & Ikhtebaar using Genuine Whisper AI STT """
    try:
        audio_bytes = await file.read()
        
        # Save complete recording physically before passing it to the Whisper model
        sess_id = f"sess_{module_type}_{start_val}_{end_val}"
        full_filepath = os.path.join(TEMP_AUDIO_DIR, f"{sess_id}_full.wav")
        with open(full_filepath, "wb") as f:
            f.write(audio_bytes)
        print(f"[Full Save] Saved complete session audio to file: {full_filepath}")
        
        # Genuine Whisper AI Speech-to-Text Transcription (with CPU float32 / fp16=False optimization)
        user_transcription = await transcribe_audio_file(audio_bytes, expected_text)
        
        orig_words = expected_text.split()
        display_words = []
        norm_words = []
        for w in orig_words:
            cleaned = re.sub(r'[\uFD3E\uFD3F0-9\u0660-\u0669\s]+', '', w).strip()
            norm = normalize_arabic(cleaned)
            if norm:
                display_words.append(w)
                norm_words.append(norm)

        norm_user_words = normalize_arabic(user_transcription).split()

        # Handle Silence / No Speech Spoken
        if not norm_user_words or not norm_words:
            comparison = [{"word": w, "status": "mistake"} for w in display_words]
            res_payload = {
                "score": 0,
                "user_transcription": user_transcription or "(Silence / No speech detected)",
                "transcription": user_transcription or "",
                "comparison": comparison,
                "matches": 0,
                "mistakes": len(display_words),
                "total": len(display_words)
            }
            # Record 0% session log
            try:
                username = request.session.get("user") or "guest"
                conn = sqlite3.connect("users.db")
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO recitation_sessions 
                    (username, module_type, range_mode, start_val, end_val, score, total_words, match_count, mistake_count, transcription)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (username, module_type, range_mode, start_val, end_val, 0, len(display_words), 0, len(display_words), user_transcription or ""))
                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Log Error: {e}")
            return res_payload

        # Sequence Diff Matcher against Normalized Arabic Ground Truth
        matcher = difflib.SequenceMatcher(None, norm_words, norm_user_words)
        status_map = {}
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                for i in range(i1, i2):
                    status_map[i] = 'match'
            else:
                for i in range(i1, i2):
                    status_map[i] = 'mistake'

        # Retrieve word metadata
        _, _, word_metadata = get_words_metadata_for_range(range_mode, start_val, end_val)

        comparison = []
        match_count = 0
        for idx, w in enumerate(display_words):
            st = status_map.get(idx, 'mistake')
            if st == 'match':
                match_count += 1
            meta = word_metadata[idx] if idx < len(word_metadata) else {}
            comparison.append({
                "word": w, 
                "status": st,
                "sura": meta.get("sura", 1),
                "ayah": meta.get("ayah", 1),
                "page": meta.get("page", 1),
                "surah_name": meta.get("surah_name", "")
            })

        score = int(round((match_count / len(display_words)) * 100)) if display_words else 0

        # Record session log & frequent mistakes in database
        try:
            username = request.session.get("user") or "guest"
            conn = sqlite3.connect("users.db")
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT INTO recitation_sessions 
                (username, module_type, range_mode, start_val, end_val, score, total_words, match_count, mistake_count, transcription)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (username, module_type, range_mode, start_val, end_val, score, len(display_words), match_count, len(display_words) - match_count, user_transcription))
            
            # Log mistake words in frequent_mistakes table
            for item in comparison:
                if item["status"] == "mistake":
                    w_raw = item["word"]
                    w_cleaned = re.sub(r'[\uFD3E\uFD3F0-9\u0660-\u0669\s]+', '', w_raw).strip()
                    w_norm = normalize_arabic(w_cleaned)
                    if w_norm:
                        cursor.execute("""
                            INSERT INTO frequent_mistakes (username, word, norm_word, error_count)
                            VALUES (?, ?, ?, 1)
                            ON CONFLICT(username, norm_word) DO UPDATE SET
                                error_count = error_count + 1,
                                last_missed = CURRENT_TIMESTAMP
                        """, (username, w_cleaned, w_norm))
                        
            conn.commit()
            conn.close()
        except Exception as db_err:
            print(f"Analytics DB Log Warning: {db_err}")

        return {
            "score": score,
            "user_transcription": user_transcription,
            "transcription": user_transcription,
            "comparison": comparison,
            "matches": match_count,
            "mistakes": len(display_words) - match_count,
            "total": len(display_words)
        }
    except Exception as e:
        print(f"Recitation evaluation error: {e}")
        return {"error": f"Failed to grade recitation: {str(e)}"}

@app.get("/api/analytics")
async def get_user_analytics(request: Request):
    """ Fetch Student Analytics Summary & 30-Juz Heatmap """
    username = request.session.get("user") or "guest"
    
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    
    # 1. Fetch total sessions & accuracy
    cursor.execute("SELECT COUNT(*), AVG(score) FROM recitation_sessions WHERE username = ?", (username,))
    row = cursor.fetchone()
    total_sessions = row[0] if row else 0
    avg_score = int(round(row[1])) if (row and row[1] is not None) else 0
    
    # 2. Fetch recent sessions
    cursor.execute("""
        SELECT module_type, range_mode, start_val, end_val, score, total_words, match_count, mistake_count, timestamp
        FROM recitation_sessions
        WHERE username = ?
        ORDER BY id DESC LIMIT 10
    """, (username,))
    recent_rows = cursor.fetchall()
    recent_sessions = []
    for r in recent_rows:
        recent_sessions.append({
            "module_type": r[0],
            "range_mode": r[1],
            "start_val": r[2],
            "end_val": r[3],
            "score": r[4],
            "total_words": r[5],
            "match_count": r[6],
            "mistake_count": r[7],
            "timestamp": r[8]
        })
        
    # 3. Fetch Frequent Mistakes (Mutashabihat Queue)
    cursor.execute("""
        SELECT word, error_count, last_missed
        FROM frequent_mistakes
        WHERE username = ?
        ORDER BY error_count DESC, id DESC LIMIT 15
    """, (username,))
    mistake_rows = cursor.fetchall()
    frequent_mistakes = [{"word": r[0], "error_count": r[1], "last_missed": r[2]} for r in mistake_rows]
    
    # 4. Calculate 30-Juz Retention Heatmap (Juz 1 to 30) from ayah_retention_state & sessions
    juz_heatmap = []
    for j in range(1, 31):
        cursor.execute("""
            SELECT 
                COUNT(*) as total_logged,
                SUM(CASE WHEN current_status IN ('mastered', 'cured') THEN 1 ELSE 0 END) as mastered_or_cured,
                SUM(CASE WHEN current_status = 'active_mistake' THEN 1 ELSE 0 END) as active_mistakes,
                SUM(total_attempts) as sum_attempts
            FROM ayah_retention_state
            WHERE username = ? AND juz_number = ?
        """, (username, j))
        r_state = cursor.fetchone()
        
        total_logged = r_state[0] if (r_state and r_state[0]) else 0
        mastered_cured = r_state[1] if (r_state and r_state[1]) else 0
        active_mistakes = r_state[2] if (r_state and r_state[2]) else 0
        sum_attempts = r_state[3] if (r_state and r_state[3]) else 0

        if total_logged > 0:
            score = int(round((mastered_cured / total_logged) * 100))
            status = "mastered" if (score >= 85 and active_mistakes == 0) else "in_progress" if score >= 60 else "needs_revision"
            attempts = sum_attempts or 1
        else:
            cursor.execute("SELECT score FROM recitation_sessions WHERE username = ? AND range_mode = 'juz' AND start_val = ?", (username, j))
            j_sess = cursor.fetchall()
            if j_sess:
                sc_list = [s[0] for s in j_sess]
                score = int(round(sum(sc_list) / len(sc_list)))
                attempts = len(sc_list)
                status = "mastered" if score >= 85 else "in_progress" if score >= 60 else "needs_revision"
            else:
                score = 0
                attempts = 0
                status = "unattempted"

        juz_heatmap.append({
            "juz": j,
            "score": score,
            "attempts": attempts,
            "status": status,
            "active_mistakes": active_mistakes
        })
        
    conn.close()
    
    return {
        "username": username,
        "total_sessions": total_sessions,
        "avg_score": avg_score,
        "mastery_level": "Hafiz Candidate" if avg_score >= 85 else "Advanced Reciter" if avg_score >= 70 else "Developing Reciter",
        "recent_sessions": recent_sessions,
        "frequent_mistakes": frequent_mistakes,
        "juz_heatmap": juz_heatmap
    }

@app.post("/api/delete_mistake")
async def delete_mistake(request: Request, word: str = Form(...)):
    """ Delete mistaken word from frequent_mistakes queue """
    username = request.session.get("user") or "guest"
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    norm = normalize_arabic(word)
    cursor.execute("DELETE FROM frequent_mistakes WHERE username = ? AND (word = ? OR norm_word = ?)", (username, word, norm))
    conn.commit()
    conn.close()
    return {"success": True}

@app.get("/api/locate_word")
async def locate_word(word: str):
    """ Locate a word or phrase in the Quran and return its Surah, Ayah, Page, and Arabic text """
    try:
        norm_query = normalize_arabic(word).strip()
        if not norm_query:
            return {"error": "Empty word query", "results": []}

        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")
        
        cursor_text.execute(f"SELECT surah_number, ayah_number, {text_col} FROM quran_text")
        all_ayahs = cursor_text.fetchall()
        conn_text.close()

        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()

        matches = []
        for s_num, a_num, txt in all_ayahs:
            if not txt:
                continue
            norm_txt = normalize_arabic(txt)
            if norm_query in norm_txt:
                cursor_map.execute("SELECT page_number FROM glyphs_publication_1 WHERE sura_number = ? AND ayah_number = ? LIMIT 1", (s_num, a_num))
                p_row = cursor_map.fetchone()
                p_num = p_row[0] if p_row else 1
                s_name = SURAH_NAMES[s_num] if 1 <= s_num <= 114 else f"Surah {s_num}"
                matches.append({
                    "surah_number": s_num,
                    "surah_name": s_name,
                    "ayah_number": a_num,
                    "page_number": p_num,
                    "arabic_text": txt
                })
                if len(matches) >= 5:
                    break

        conn_map.close()
        return {"word": word, "results": matches}
    except Exception as e:
        print(f"Locate word error: {e}")
        return {"error": str(e), "results": []}

@app.get("/api/analytics/juz_mistakes")
async def get_juz_mistakes(request: Request, juz: int):
    """ Legacy helper: returns mistake occurrences for backwards compatibility """
    return await get_juz_retention_map(request, juz)

@app.get("/api/analytics/retention_map")
async def get_juz_retention_map(request: Request, juz: int = 1):
    """
    Returns the comprehensive verse-level multi-session retention status for a specific Juz.
    Includes states: 'active_mistake', 'cured', 'mastered', 'unattempted'.
    """
    try:
        username = request.session.get("user") or "guest"
        juz_idx = max(1, min(30, int(juz)))

        juz_bounds = [
            (1, 21), (22, 41), (42, 61), (62, 81), (82, 101),
            (102, 121), (122, 141), (142, 161), (162, 181), (182, 201),
            (202, 221), (222, 241), (242, 261), (262, 281), (282, 301),
            (302, 321), (322, 341), (342, 361), (362, 381), (382, 401),
            (402, 421), (422, 441), (442, 461), (462, 481), (482, 501),
            (502, 521), (522, 541), (542, 561), (562, 581), (582, 604)
        ]
        start_p, end_p = juz_bounds[juz_idx - 1]

        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        cursor_map.execute("""
            SELECT DISTINCT page_number, sura_number, ayah_number 
            FROM glyphs_publication_1 
            WHERE page_number BETWEEN ? AND ?
            ORDER BY page_number, sura_number, ayah_number
        """, (start_p, end_p))
        juz_verses = cursor_map.fetchall()
        conn_map.close()

        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        text_col = next((col for col in ["text_uthmani", "text", "ayah_text", "content", "ar"] if col in columns), "text")

        verse_texts = {}
        for p, s, a in juz_verses:
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (s, a))
            row = cursor_text.fetchone()
            verse_texts[(s, a)] = row[0] if row else ""
        conn_text.close()

        conn_users = sqlite3.connect("users.db")
        cursor_users = conn_users.cursor()
        cursor_users.execute("""
            SELECT surah_number, ayah_number, current_status, consecutive_passes, total_attempts, active_mistake_words, last_attempt_timestamp, last_cured_timestamp
            FROM ayah_retention_state
            WHERE username = ? AND juz_number = ?
        """, (username, juz_idx))
        state_rows = cursor_users.fetchall()
        conn_users.close()

        user_states = {}
        for r in state_rows:
            user_states[(r[0], r[1])] = {
                "current_status": r[2],
                "consecutive_passes": r[3],
                "total_attempts": r[4],
                "active_mistake_words": json.loads(r[5]) if r[5] else [],
                "last_attempt_timestamp": r[6],
                "last_cured_timestamp": r[7]
            }

        mastered_count = 0
        cured_count = 0
        active_mistake_count = 0
        unattempted_count = 0

        verses_list = []
        mistake_pages = set()
        cured_pages = set()

        for p_num, s_num, a_num in juz_verses:
            v_state = user_states.get((s_num, a_num))
            st = v_state["current_status"] if v_state else "unattempted"
            attempts = v_state["total_attempts"] if v_state else 0
            passes = v_state["consecutive_passes"] if v_state else 0
            missed_words = v_state["active_mistake_words"] if v_state else []
            last_ts = v_state["last_attempt_timestamp"] if v_state else None
            cured_ts = v_state["last_cured_timestamp"] if v_state else None

            if st == "mastered":
                mastered_count += 1
            elif st == "cured":
                cured_count += 1
                cured_pages.add(p_num)
            elif st == "active_mistake":
                active_mistake_count += 1
                mistake_pages.add(p_num)
            else:
                unattempted_count += 1

            s_name = SURAH_NAMES[s_num] if 1 <= s_num <= 114 else f"Surah {s_num}"
            verses_list.append({
                "page_number": p_num,
                "surah_number": s_num,
                "surah_name": s_name,
                "ayah_number": a_num,
                "status": st,
                "total_attempts": attempts,
                "consecutive_passes": passes,
                "active_mistake_words": missed_words,
                "last_attempt_timestamp": last_ts,
                "last_cured_timestamp": cured_ts,
                "arabic_text": verse_texts.get((s_num, a_num), "")
            })

        total_v = len(juz_verses)
        attempted_v = total_v - unattempted_count
        mastery_pct = int(round(((mastered_count + cured_count) / total_v) * 100)) if total_v > 0 else 0

        return {
            "juz": juz_idx,
            "start_page": start_p,
            "end_page": end_p,
            "stats": {
                "total_verses": total_v,
                "attempted_verses": attempted_v,
                "mastered_count": mastered_count,
                "cured_count": cured_count,
                "active_mistake_count": active_mistake_count,
                "unattempted_count": unattempted_count,
                "mastery_percentage": mastery_pct
            },
            "verses": verses_list,
            "mistake_pages": sorted(list(mistake_pages)),
            "cured_pages": sorted(list(cured_pages)),
            "mistakes": [v for v in verses_list if v["status"] == "active_mistake"]
        }
    except Exception as e:
        print(f"Retention map error: {e}")
        return {"error": str(e), "verses": [], "mistakes": []}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)