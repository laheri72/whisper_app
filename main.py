import sqlite3
import os
import json
import base64
import random
import difflib
import re
import asyncio
from fastapi import FastAPI, Request, Form, UploadFile, File, Response, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from app.ai_service import init_whisper_model, transcribe_audio_file, compare_recitation, normalize_arabic

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="super_secret_academic_key")

@app.on_event("startup")
async def startup_event():
    # Pre-load Hugging Face Whisper AI model in background thread on server boot
    print("🚀 Initializing Whisper AI Model (tarteel-ai/whisper-base-ar-quran)...")
    asyncio.create_task(asyncio.to_thread(init_whisper_model))

# DIRECTORY MOUNTS
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data", StaticFiles(directory="data"), name="data")
# Mounts the audio folder directly if needed by the frontend
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

templates = Jinja2Templates(directory="templates")

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
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    
    cursor.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in cursor.fetchall()]
    if "display_name" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
        conn.commit()
        
    cursor.execute("SELECT display_name FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    display_name = row[0] if row else None
    conn.close()
    
    return {
        "id": username,
        "username": username,
        "display_name": display_name,
        "is_first_login": display_name is None or display_name.strip() == ""
    }

@app.post("/api/update_profile")
async def update_profile(request: Request, data: dict):
    username = request.session.get("user")
    if not username:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    display_name = data.get("display_name")
    if not display_name or not display_name.strip():
        raise HTTPException(status_code=400, detail="Display name is required")
        
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT, display_name TEXT)")
    
    cursor.execute("PRAGMA table_info(users)")
    columns = [info[1] for info in cursor.fetchall()]
    if "display_name" not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN display_name TEXT")
        conn.commit()
        
    cursor.execute("UPDATE users SET display_name = ? WHERE username = ?", (display_name.strip(), username))
    conn.commit()
    conn.close()
    
    return {"status": "success", "display_name": display_name.strip()}

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
        print(f"❌ ERROR: Could not find {file_path}")
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


def to_arabic_digits(num: int) -> str:
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    return "".join(arabic_digits[int(d)] for d in str(num))

# ==========================================
# 3. TASMEE ROUTES (PAGINATED RANGE SUPPORT)
# ==========================================
@app.get("/api/tasmee_target")
async def get_tasmee_target(mode: str, start_val: int, end_val: int):
    try:
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        
        cursor_text.execute("PRAGMA table_info(quran_text)")
        columns = [info[1] for info in cursor_text.fetchall()]
        
        text_col = "text" 
        for col in ["text_uthmani", "text", "ayah_text", "content", "ar"]:
            if col in columns:
                text_col = col
                break
        
        expected_text = ""
        pages_list = []
        
        if mode == "page":
            conn_map = sqlite3.connect("file1.db")
            cursor_map = conn_map.cursor()
            cursor_map.execute("""
                SELECT page_number, sura_number, ayah_number 
                FROM glyphs_publication_1 
                WHERE page_number BETWEEN ? AND ?
                GROUP BY page_number, sura_number, ayah_number
                ORDER BY page_number, sura_number, ayah_number
            """, (start_val, end_val))
            rows = cursor_map.fetchall()
            conn_map.close()
            
            pages_dict = {}
            all_texts = []
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
                    
            expected_text = " ".join(all_texts)
            pages_list = [
                {"page_number": p, "label": f"Page {p}", "text": " ".join(txts)}
                for p, txts in sorted(pages_dict.items())
            ]
            
        elif mode == "surah":
            cursor_text.execute(f"SELECT surah_number, ayah_number, {text_col} FROM quran_text WHERE surah_number BETWEEN ? AND ? ORDER BY surah_number, ayah_number", (start_val, end_val))
            rows = cursor_text.fetchall()
            
            surah_dict = {}
            all_texts = []
            for r in rows:
                s_num, a_num, txt = r[0], r[1], r[2]
                if txt:
                    all_texts.append(txt)
                    formatted_txt = f"{txt} ﴿{to_arabic_digits(a_num)}﴾"
                    if s_num not in surah_dict:
                        surah_dict[s_num] = []
                    surah_dict[s_num].append(formatted_txt)
                    
            expected_text = " ".join(all_texts)
            pages_list = [
                {
                    "page_number": s, 
                    "label": f"Surah {SURAH_NAMES[s] if 1 <= s < len(SURAH_NAMES) else s}", 
                    "text": " ".join(txts)
                } 
                for s, txts in sorted(surah_dict.items())
            ]
                
        conn_text.close()
        
        if not expected_text:
            return {"error": "No text found for this selection in the database."}
            
        return {
            "expected_text": expected_text,
            "pages": pages_list
        }
        
    except Exception as e:
        print(f"Database Error: {e}")
        return {"error": f"Database Error: {str(e)}"}

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
@app.get("/api/generate_ikhtebaar")
async def generate_ikhtebaar(mode: str, start_val: int, end_val: int, difficulty: str, exclude: str = ""):
    try:
        conn_map = sqlite3.connect("file1.db")
        cursor_map = conn_map.cursor()
        
        conn_text = sqlite3.connect("file2.db")
        cursor_text = conn_text.cursor()
        
        excluded_set = set()
        if exclude:
            for item in exclude.split(","):
                if "-" in item:
                    s, a = item.split("-")
                    excluded_set.add((int(s), int(a)))

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
        stop_idx = min(start_idx + 15, len(ayahs_pool) - 1)
        selected_stop = ayahs_pool[stop_idx]
        
        target_page = selected_start[2]
        target_surah = selected_start[0]

        def get_text(surah, ayah):
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (surah, ayah))
            res = cursor_text.fetchone()
            return res[0] if res else ""

        start_text = get_text(selected_start[0], selected_start[1])
        stop_text = get_text(selected_stop[0], selected_stop[1])
        
        full_text_list = []
        for i in range(start_idx, stop_idx + 1):
            full_text_list.append(get_text(ayahs_pool[i][0], ayahs_pool[i][1]))
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

        return {
            "question_id": f"{selected_start[0]}-{selected_start[1]}", 
            "start_text": start_text,
            "stop_text": stop_text,
            "expected_full_text": expected_full_text,
            "page_number": target_page,
            "hint_1": hint_1,
            "hint_2": hint_2,
            "hint_3": hint_3
        }

    except Exception as e:
        print(f"Ikhtebaar Error: {e}")
        return {"error": str(e)}

@app.post("/transcribe_and_compare")
async def transcribe_and_compare(file: UploadFile = File(...), expected_text: str = Form(...)):
    """ Final Grading Endpoint for Tasmee & Ikhtebaar using Genuine Whisper AI STT """
    try:
        audio_bytes = await file.read()
        
        # Genuine Whisper AI Speech-to-Text Transcription
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
            return {
                "score": 0,
                "user_transcription": user_transcription or "(Silence / No speech detected)",
                "transcription": user_transcription or "",
                "comparison": comparison,
                "matches": 0,
                "mistakes": len(display_words),
                "total": len(display_words)
            }

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

        comparison = []
        match_count = 0
        for idx, w in enumerate(display_words):
            st = status_map.get(idx, 'mistake')
            if st == 'match':
                match_count += 1
            comparison.append({"word": w, "status": st})

        score = int(round((match_count / len(display_words)) * 100)) if display_words else 0

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