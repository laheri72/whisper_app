import sqlite3
import os
import json
import base64
import random
from fastapi import FastAPI, Request, Form, UploadFile, File, Response, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="super_secret_academic_key")

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
    user = request.session.get("user")
    if not user:
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse(request=request, name="index.html")

@app.get("/register")
async def register_page(request: Request):
    return templates.TemplateResponse(request=request, name="register.html")

@app.post("/register")
async def process_register(request: Request, username: str = Form(...), password: str = Form(...)):
    if len(username) != 5 or not username.isdigit():
        return templates.TemplateResponse(
            request=request, name="register.html", 
            context={"error": "Identification Number must be exactly 5 numeric digits."}
        )
    
    if len(password) < 5:
        return templates.TemplateResponse(
            request=request, name="register.html", 
            context={"error": "Passcode must be at least 5 characters long."}
        )
    
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)")
    
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return templates.TemplateResponse(
            request=request, name="register.html", 
            context={"error": "This Identification Number is already registered."}
        )
    
    conn.close()
    return RedirectResponse(url="/login", status_code=303)

@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@app.post("/login")
async def process_login(request: Request, username: str = Form(...), password: str = Form(...)):
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)")
    
    cursor.execute("SELECT * FROM users WHERE username = ? AND password = ?", (username, password))
    user = cursor.fetchone()
    conn.close()
    
    if user:
        request.session["user"] = username
        return RedirectResponse(url="/", status_code=303)
    else:
        return templates.TemplateResponse(
            request=request, name="login.html", 
            context={"error": "Invalid Identification Number or Passcode."}
        )

@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)


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
        return FileResponse(file_path, media_type="audio/mpeg")
    else:
        print(f"❌ ERROR: Could not find {file_path}")
        raise HTTPException(status_code=404, detail="Audio file not found.")


# ==========================================
# 3. TASMEE ROUTES (UPDATED WITH RANGE)
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
        
        if mode == "page":
            conn_map = sqlite3.connect("file1.db")
            cursor_map = conn_map.cursor()
            cursor_map.execute("""
                SELECT DISTINCT sura_number, ayah_number 
                FROM glyphs_publication_1 
                WHERE page_number BETWEEN ? AND ?
                ORDER BY sura_number, ayah_number
            """, (start_val, end_val))
            ayahs = cursor_map.fetchall()
            conn_map.close()
            
            texts = []
            for a in ayahs:
                cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (a[0], a[1]))
                row = cursor_text.fetchone()
                if row and row[0]:
                    texts.append(row[0])
            expected_text = " ".join(texts)
            
        elif mode == "surah":
            cursor_text.execute(f"SELECT {text_col} FROM quran_text WHERE surah_number BETWEEN ? AND ? ORDER BY surah_number, ayah_number", (start_val, end_val))
            rows = cursor_text.fetchall()
            expected_text = " ".join([r[0] for r in rows if r[0]])
                
        conn_text.close()
        
        if not expected_text:
            return {"error": "No text found for this selection in the database."}
            
        return {"expected_text": expected_text}
        
    except Exception as e:
        print(f"Database Error: {e}")
        return {"error": f"Database Error: {str(e)}"}

@app.post("/api/tasmee_chunk_process")
async def process_tasmee_chunk(file: UploadFile = File(...), expected_word: str = Form(...)):
    """ REAL-TIME EVALUATION ENDPOINT for Tasmee """
    # INSERT YOUR WHISPER AI LOGIC HERE
    simulated_status = "match" if random.random() > 0.2 else "mistake"
    return {"status": simulated_status}


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
    """ Final Grading Endpoint for Ikhtebaar """
    # Mocking Whisper AI final grading for now
    words = expected_text.split()
    comparison = [{"word": w, "status": "match" if random.random() > 0.1 else "mistake"} for w in words]
    score = int((sum(1 for i in comparison if i["status"] == "match") / len(comparison)) * 100) if comparison else 0
    
    return {
        "transcription": expected_text,
        "comparison": comparison,
        "score": score
    }