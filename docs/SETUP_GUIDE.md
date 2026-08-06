# 🛠️ Setup & Local Execution Guide

## 1. Prerequisites
- **Python**: Version 3.10, 3.11, or 3.12 installed.
- **Pip**: Latest package installer for Python.
- **Git**: Installed for source control.

---

## 2. Quickstart Step-by-Step

### Step 1: Clone or Navigate to Directory
```bash
cd "D:\My Sites\whisper_app"
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Run the Development Server
```bash
python -m uvicorn main:app --reload --port 8000
```

### Step 4: Open in Web Browser
Navigate to:
👉 **`http://127.0.0.1:8000`**

---

## 🔑 Default Login Credentials
- **Username**: `24425` (or any valid ID from the seed list e.g. `24739`, `25008`)
- **Default Password**: `24425` *(same as username)*
- *Note: On first login, you will be automatically prompted to set a new password.*

---

## 🧪 Testing & Verification

### Running Automated Diagnostic Checks
To verify database seeding, password hashing, and Arabic normalization:
```bash
python -c "
from main import app
from app.database import SessionLocal
from app.models import User
from app.ai_service import compare_recitation

db = SessionLocal()
print('Seeded User Count:', db.query(User).count())
truth = 'قُلْ هُوَ اللَّهُ أَحَدٌ'
user = 'قل هو الله احد'
print('Diff Test Accuracy:', compare_recitation(truth, user)['accuracy_score'], '%')
db.close()
"
```

---

## ❓ Troubleshooting & FAQs

### Q: Why does the first server startup take 10-20 seconds?
On first startup, Hugging Face automatically downloads the fine-tuned Whisper model weights (`tarteel-ai/whisper-base-ar-quran` ~290 MB) into `C:\Users\<User>\.cache\huggingface\hub\`. Subsequent server restarts will load instantly from cache.

### Q: Does the app require `ffmpeg` to be installed?
**No!** The application includes a pure JavaScript 16kHz PCM WAV encoder in the browser and in-memory NumPy array decoding in Python (`scipy.io.wavfile`), bypassing `ffmpeg` binary requirements completely.
