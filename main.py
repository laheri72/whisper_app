import sqlite3
import os
from fastapi import FastAPI, Request, Form, UploadFile, File
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.sessions import SessionMiddleware

# ==========================================
# APP INITIALIZATION & MIDDLEWARE
# ==========================================
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key="super_secret_enterprise_key")

# ==========================================
# DIRECTORY MOUNTS
# ==========================================
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/data", StaticFiles(directory="data"), name="data")

# If you have an images or audio folder, uncomment these:
# app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

templates = Jinja2Templates(directory="templates")


# ==========================================
# 1. AUTHENTICATION ROUTES
# ==========================================
# ==========================================
# 1. AUTHENTICATION ROUTES (WITH REGISTRATION)
# ==========================================
@app.get("/")
async def home(request: Request):
    user = request.session.get("user")
    if not user:
        return RedirectResponse(url="/login", status_code=303)
    return templates.TemplateResponse(request=request, name="index.html")

# --- REGISTRATION ---
@app.get("/register")
async def register_page(request: Request):
    return templates.TemplateResponse(request=request, name="register.html")

@app.post("/register")
async def process_register(request: Request, username: str = Form(...), password: str = Form(...)):
    # Rule 1: Username must be exactly 5 digits
    if len(password) < 5:
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": "Username must be exactly 5 numeric digits."}
        )
    
    # Rule 2: Password must be a minimum of 5 digits
    if len(password) < 5 or not password.isdigit():
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": "Password must be at least 5 numeric digits."}
        )
    
    # Save the user to the database
    conn = sqlite3.connect("users.db")
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, password TEXT)")
    
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (username, password))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        # If the username already exists in the database
        return templates.TemplateResponse(
            request=request, 
            name="register.html", 
            context={"error": "This username is already taken."}
        )
    
    conn.close()
    
    # Redirect to login page upon successful registration
    return RedirectResponse(url="/login", status_code=303)


# --- LOGIN ---
@app.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html")

@app.post("/login")
async def process_login(request: Request, username: str = Form(...), password: str = Form(...)):
    # Check the database for the user
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
            request=request, 
            name="login.html", 
            context={"error": "Invalid username or password."}
        )

# --- LOGOUT ---
@app.get("/logout")
async def logout(request: Request):
    request.session.clear()
    return RedirectResponse(url="/login", status_code=303)

# ==========================================
# 2. QURAN DATA & INTERFACE ROUTES
# ==========================================
@app.get("/api/page_boxes/{page_number}")
async def get_page_boxes(page_number: int):
    if not os.path.exists("file1.db"):
        return {"error": "Mapping database (file1.db) not found."}
        
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

    if not os.path.exists("file2.db"):
        return {"error": "Text database (file2.db) not found."}
        
    conn_text = sqlite3.connect("file2.db")
    cursor_text = conn_text.cursor()
    
    box_list = []
    for b in boxes:
        cursor_text.execute("SELECT id FROM quran_text WHERE surah_number = ? AND ayah_number = ?", (b[0], b[1]))
        row = cursor_text.fetchone()
        global_id = row[0] if row else 0
        
        box_list.append({
            "global_id": global_id,
            "min_x": b[2],
            "max_x": b[3],
            "min_y": b[4],
            "max_y": b[5]
        })
        
    conn_text.close()
    return {"boxes": box_list}

@app.get("/api/tasmee_target")
async def get_tasmee_target(mode: str, value: int):
    # Standard shell for fetching the target text
    return {"expected_text": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"}


# ==========================================
# 3. AUDIO & WHISPER AI ROUTES
# ==========================================
@app.get("/api/audio/{global_id}")
async def get_audio(global_id: int):
    # Redirects to local static file or database fetch based on your setup
    return RedirectResponse(url=f"/audio/{global_id}.mp3")

@app.post("/transcribe_and_compare")
async def transcribe_and_compare(file: UploadFile = File(...), expected_text: str = Form(...)):
    # Standard shell to prevent crashes until your specific AI logic is added
    return {
        "comparison": [
            {"word": "بِسْمِ", "status": "match"},
            {"word": "اللَّهِ", "status": "match"}
        ]
    }
