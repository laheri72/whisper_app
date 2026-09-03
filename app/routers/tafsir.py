import sqlite3
import os
import re
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tafsir.db")

def get_db_connection():
    if not os.path.exists(DB_PATH):
        raise HTTPException(status_code=500, detail="Tafsir database (tafsir.db) not found.")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def normalize_arabic(text: str) -> str:
    if not text or not isinstance(text, str):
        return ""
    # Strip tashkeel (harakat)
    text = re.sub(r'[\u064B-\u0652\u0670]', '', text)
    # Normalize alef variants
    text = re.sub(r'[\u0622\u0623\u0625\u0671]', '\u0627', text)
    # Normalize teh marbuta
    text = re.sub(r'\u0629', '\u0647', text)
    # Normalize alef maqsura
    text = re.sub(r'\u0649', '\u064A', text)
    return text.strip().lower()

def highlight_snippet(text: str, query: str, max_chars: int = 240) -> str:
    if not text:
        return ""
    if not query:
        return text[:max_chars] + ("..." if len(text) > max_chars else "")
    
    norm_text = normalize_arabic(text)
    norm_q = normalize_arabic(query)
    
    pos = norm_text.find(norm_q)
    if pos == -1:
        # Fallback exact search
        pos = text.lower().find(query.lower())
    
    if pos == -1:
        return text[:max_chars] + ("..." if len(text) > max_chars else "")
    
    start = max(0, pos - 60)
    end = min(len(text), pos + len(query) + 140)
    
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
        
    try:
        pattern = re.compile(f"({re.escape(query)})", re.IGNORECASE)
        snippet = pattern.sub(r"<mark class='highlight-query'>\1</mark>", snippet)
    except Exception:
        pass
        
    return snippet

@router.get("/stats")
async def get_tafsir_stats():
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT count(*), count(distinct surah_no), count(distinct page_no) FROM quran_tafsir")
    row = c.fetchone()
    conn.close()
    return {
        "total_verses": row[0],
        "total_surahs": row[1],
        "total_pages": row[2],
        "scholars": [
            {"id": "ja", "name": "تفسير الجلالين", "scholar": "Al-Jalalayn", "era": "Classical", "type": "Lexical and Contextual"},
            {"id": "ik", "name": "تفسير ابن كثير", "scholar": "Ibn Kathir", "era": "774 AH", "type": "Hadith and Narration"},
            {"id": "qu", "name": "تفسير القرطبي", "scholar": "Al-Qurtubi", "era": "671 AH", "type": "Fiqh and Legal Rulings"},
            {"id": "sa", "name": "تفسير السعدي", "scholar": "As-Sa'di", "era": "1376 AH", "type": "Thematic and Spiritual"},
            {"id": "ta", "name": "تفسير الطبري", "scholar": "Al-Tabari", "era": "310 AH", "type": "Historical and Dialectal"}
        ]
    }

@router.get("/verse/{surah_no}/{ayah_no}")
async def get_verse_tafsir(surah_no: int, ayah_no: int):
    if surah_no < 1 or surah_no > 114 or ayah_no < 1:
        raise HTTPException(status_code=400, detail="Invalid Surah or Ayah index.")
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT seq_no, surah_no, surah_name, ayah_no, ayaat_mt, ayaat_bt, page_no, juz,
               tafsir_ik, tafsir_qu, tafsir_ja, tafsir_sa, tafsir_ta
        FROM quran_tafsir 
        WHERE surah_no = ? AND ayah_no = ?
    """, (surah_no, ayah_no))
    row = c.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Verse not found.")
    
    seq_no = row["seq_no"]
    
    # Get previous verse info
    prev_verse = None
    if seq_no > 1:
        c.execute("SELECT surah_no, ayah_no, surah_name FROM quran_tafsir WHERE seq_no = ?", (seq_no - 1,))
        p_row = c.fetchone()
        if p_row:
            prev_verse = {"surah": p_row["surah_no"], "ayah": p_row["ayah_no"], "surah_name": p_row["surah_name"]}
            
    # Get next verse info
    next_verse = None
    if seq_no < 6236:
        c.execute("SELECT surah_no, ayah_no, surah_name FROM quran_tafsir WHERE seq_no = ?", (seq_no + 1,))
        n_row = c.fetchone()
        if n_row:
            next_verse = {"surah": n_row["surah_no"], "ayah": n_row["ayah_no"], "surah_name": n_row["surah_name"]}
            
    # Get total ayahs in this surah
    c.execute("SELECT max(ayah_no) FROM quran_tafsir WHERE surah_no = ?", (surah_no,))
    total_ayahs = c.fetchone()[0]
    
    conn.close()
    
    has_sa = bool(row["tafsir_sa"] and len(row["tafsir_sa"].strip()) > 0)
    
    return {
        "seq_no": row["seq_no"],
        "surah_no": row["surah_no"],
        "surah_name": row["surah_name"],
        "ayah_no": row["ayah_no"],
        "ayaat_mt": row["ayaat_mt"],
        "ayaat_bt": row["ayaat_bt"],
        "page_no": row["page_no"],
        "juz": row["juz"],
        "total_ayahs_in_surah": total_ayahs,
        "audio_url": f"/api/audio/{row['seq_no']}",
        "prev_verse": prev_verse,
        "next_verse": next_verse,
        "tafsir": {
            "ja": {
                "id": "ja",
                "name": "تفسير الجلالين",
                "author": "جلال الدين المحلي وجلال الدين السيوطي",
                "era": "القرن العاشر الهجري",
                "badge": "وجيز ولغوي",
                "text": row["tafsir_ja"] or "",
                "available": bool(row["tafsir_ja"])
            },
            "ik": {
                "id": "ik",
                "name": "تفسير القرآن العظيم (ابن كثير)",
                "author": "الحافظ عماد الدين ابن كثير",
                "era": "774 هـ",
                "badge": "مأثور وحديث",
                "text": row["tafsir_ik"] or "",
                "available": bool(row["tafsir_ik"])
            },
            "qu": {
                "id": "qu",
                "name": "الجامع لأحكام القرآن (القرطبي)",
                "author": "الإمام أبو عبد الله القرطبي",
                "era": "671 هـ",
                "badge": "فقهي وأحكام",
                "text": row["tafsir_qu"] or "",
                "available": bool(row["tafsir_qu"])
            },
            "sa": {
                "id": "sa",
                "name": "تيسير الكريم الرحمن (السعدي)",
                "author": "الشيخ عبد الرحمن بن ناصر السعدي",
                "era": "1376 هـ",
                "badge": "تربوي وموضوعي",
                "text": row["tafsir_sa"] or "",
                "available": has_sa
            },
            "ta": {
                "id": "ta",
                "name": "جامع البيان عن تأويل آي القرآن (الطبري)",
                "author": "الإمام محمد بن جرير الطبري",
                "era": "310 هـ",
                "badge": "عمدة المفسرين والروايات",
                "text": row["tafsir_ta"] or "",
                "available": bool(row["tafsir_ta"])
            }
        }
    }

@router.get("/surah/{surah_no}")
async def get_surah_tafsir_list(surah_no: int):
    if surah_no < 1 or surah_no > 114:
        raise HTTPException(status_code=400, detail="Invalid Surah number.")
    
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("""
        SELECT seq_no, surah_no, surah_name, ayah_no, ayaat_mt, page_no, juz,
               tafsir_ja, tafsir_sa
        FROM quran_tafsir 
        WHERE surah_no = ?
        ORDER BY ayah_no ASC
    """, (surah_no,))
    rows = c.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        results.append({
            "seq_no": r["seq_no"],
            "surah_no": r["surah_no"],
            "surah_name": r["surah_name"],
            "ayah_no": r["ayah_no"],
            "ayaat_mt": r["ayaat_mt"],
            "page_no": r["page_no"],
            "juz": r["juz"],
            "audio_url": f"/api/audio/{r['seq_no']}",
            "tafsir_ja": r["tafsir_ja"] or "",
            "tafsir_sa": r["tafsir_sa"] or ""
        })
        
    return {
        "surah_no": surah_no,
        "count": len(results),
        "verses": results
    }

@router.get("/search")
async def search_tafsir(
    q: str = Query(..., min_length=2, description="Search query string"),
    scholar: str = Query("all", description="Filter by scholar: all, quran, ja, ik, qu, sa, ta"),
    surah_no: Optional[int] = Query(None, description="Optional Surah filter"),
    juz: Optional[int] = Query(None, description="Optional Juz filter"),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    start_time = time.time()
    norm_q = normalize_arabic(q)
    
    conn = get_db_connection()
    c = conn.cursor()
    
    conditions = []
    params = []
    
    if surah_no:
        conditions.append("surah_no = ?")
        params.append(surah_no)
    if juz:
        conditions.append("juz = ?")
        params.append(juz)
        
    scholar_map = {
        "quran": "ayaat_mt",
        "ja": "tafsir_ja",
        "ik": "tafsir_ik",
        "qu": "tafsir_qu",
        "sa": "tafsir_sa",
        "ta": "tafsir_ta"
    }
    
    if scholar in scholar_map:
        col = scholar_map[scholar]
        conditions.append(f"({col} LIKE ? OR norm_body LIKE ?)")
        params.extend([f"%{q}%", f"%{norm_q}%"])
    else:
        conditions.append("norm_body LIKE ?")
        params.append(f"%{norm_q}%")
        
    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    
    c.execute(f"SELECT count(*) FROM quran_tafsir {where_clause}", params)
    total_count = c.fetchone()[0]
    
    c.execute(f"""
        SELECT seq_no, surah_no, surah_name, ayah_no, ayaat_mt, page_no, juz,
               tafsir_ja, tafsir_ik, tafsir_qu, tafsir_sa, tafsir_ta
        FROM quran_tafsir
        {where_clause}
        ORDER BY seq_no ASC
        LIMIT ? OFFSET ?
    """, params + [limit, offset])
    
    rows = c.fetchall()
    conn.close()
    
    hits = []
    scholar_labels = {
        "ja": ("تفسير الجلالين", "Al-Jalalayn"),
        "ik": ("تفسير ابن كثير", "Ibn Kathir"),
        "qu": ("تفسير القرطبي", "Al-Qurtubi"),
        "sa": ("تفسير السعدي", "As-Sa'di"),
        "ta": ("تفسير الطبري", "Al-Tabari")
    }
    
    for r in rows:
        matched_scholars = []
        
        if norm_q in normalize_arabic(r["ayaat_mt"]):
            matched_scholars.append({
                "scholar_id": "quran",
                "name": "الآية الكريمة",
                "englishName": "Quran Verse",
                "snippet": highlight_snippet(r["ayaat_mt"], q)
            })
            
        for s_id, col_name in [("ja", "tafsir_ja"), ("ik", "tafsir_ik"), ("qu", "tafsir_qu"), ("sa", "tafsir_sa"), ("ta", "tafsir_ta")]:
            t_text = r[col_name] or ""
            if t_text and norm_q in normalize_arabic(t_text):
                matched_scholars.append({
                    "scholar_id": s_id,
                    "name": scholar_labels[s_id][0],
                    "englishName": scholar_labels[s_id][1],
                    "snippet": highlight_snippet(t_text, q)
                })
                
        if not matched_scholars:
            snippet_text = r["tafsir_ja"] or r["tafsir_ik"] or r["ayaat_mt"]
            matched_scholars.append({
                "scholar_id": "ja",
                "name": "تفسير الجلالين",
                "englishName": "Al-Jalalayn",
                "snippet": highlight_snippet(snippet_text, q)
            })
            
        hits.append({
            "seq_no": r["seq_no"],
            "surah_no": r["surah_no"],
            "surah_name": r["surah_name"],
            "ayah_no": r["ayah_no"],
            "ayaat_mt": r["ayaat_mt"],
            "page_no": r["page_no"],
            "juz": r["juz"],
            "audio_url": f"/api/audio/{r['seq_no']}",
            "matches": matched_scholars,
            "has_sa": bool(r["tafsir_sa"])
        })
        
    elapsed_ms = int(round((time.time() - start_time) * 1000))
    
    return {
        "query": q,
        "scholar": scholar,
        "total": total_count,
        "hits": hits,
        "offset": offset,
        "limit": limit,
        "elapsed_ms": elapsed_ms
    }
