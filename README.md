# 📖 Whisper Quran Platform (`whisper_app`)

An AI-powered web application for Quranic reading, listening, memorization testing (**Tasmee**), and recitation assessment (**Ikhtebaar**) using speech recognition (`tarteel-ai/whisper-base-ar-quran`).

---

## ⚡ Quickstart

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run local server
python -m uvicorn main:app --reload --port 8000
```
Open **`http://127.0.0.1:8000`** in your browser.

**Default Login**: Username `24425` | Password `24425`

---

## 📁 Complete Documentation Folder (`docs/`)

For detailed technical specifications, architecture diagrams, database schemas, and setup instructions:

- 📖 [**`docs/PROJECT_OVERVIEW.md`**](file:///D:/My%20Sites/whisper_app/docs/PROJECT_OVERVIEW.md) — Features, aesthetics, file structure.
- 🏗️ [**`docs/ARCHITECTURE.md`**](file:///D:/My%20Sites/whisper_app/docs/ARCHITECTURE.md) — System architecture, data flow, AI pipeline, database schemas.
- 🛠️ [**`docs/SETUP_GUIDE.md`**](file:///D:/My%20Sites/whisper_app/docs/SETUP_GUIDE.md) — Step-by-step setup, execution, and troubleshooting.

---

## 🛠️ Built With
- **Backend**: Python 3.12, FastAPI, Starlette Sessions
- **AI / ASR**: Hugging Face Transformers (`tarteel-ai/whisper-base-ar-quran`), Scipy, NumPy
- **Database**: SQLite, SQLAlchemy ORM
- **Frontend**: HTML5, Vanilla CSS, JS WebAudio API, Jinja2 Templates
- **APIs**: AlQuran Cloud API & Islamic Network Audio CDN
