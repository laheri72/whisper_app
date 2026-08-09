# Academic Quran Portal (Mukhtabir AI) 📖

An enterprise-grade, AI-powered Quranic recitation verification and academic assessment platform. Powered by fine-tuned Quranic speech-to-text models (`tarteel-ai/whisper-base-ar-quran`), pure NumPy audio processing, Uthmani Arabic letter normalization, and student (*Talabat*) memorization tracking.

---

## 👥 Team Information

- **Project Title**: Academic Quran Portal (Portal of Recitation Suite)
- **Team ID / Name**: Team Innovation Challenge — Department of Arts and Vocational Training, Aljamea Marol
- **Target Domain**: AI in Religious & Academic Education / Automated Speech Recognition

---

## 🎯 Problem Statement

Traditional Quranic memorization (*Hifz*) and recitation assessment (*Tasmee*) rely heavily on one-on-one manual testing with teachers. This presents several challenges:
1. **Limited Scale & Availability**: Teachers cannot provide instantaneous, 24/7 feedback for individual student practice sessions.
2. **Diacritic & Spelling Ambiguities**: Existing speech recognition engines penalize minor Uthmani vs. Standard spelling variations (e.g. Alif Khanjariya `\u0670` vs explicit Alif `ا`), leading to inaccurate scoring.
3. **Lack of Analytics & Tracking**: Students lack continuous diagnostic insight into recurring mistake patterns (*Mutashabihat*) across all 30 Juz.

---

## 💡 Proposed Solution

The **Academic Quran Portal** solves these challenges by combining an offline-capable, accelerated speech-to-text pipeline with real-time phoneme-level Arabic normalization:
* **Genuine Speech Recognition**: Integrates `tarteel-ai/whisper-base-ar-quran` with PyTorch CPU multi-threading and 30-second sliding window chunking.
* **Uthmani Normalization Engine**: Strips harakat/tashkeel, converts Uthmani dagger Alifs (`\u0670`), unifies Alif/Ya variants, and aligns spoken words letter-by-letter with ground truth text.
* **Academic Evaluation Suite**: Provides 4 integrated modules (Tilawat Explorer, Tasmee Recitation Engine, Ikhtebaar Oral Exam Suite, and Talabat Analytics Matrix).

---

## ✨ Features Implemented

1. **📖 Tilawat Reading Module (`الـتـلاوة`)**:
   * Interactive 604-page Madani Mushaf manuscript viewer with page jump controls.
   * High-quality audio recitation sync per Ayah with multi-bounding box text highlighting.

2. **🎙️ Tasmee Recitation Engine (`التسميع المباشر`)**:
   * Batch-processed memorization testing with a 450ms tail buffer to capture trailing spoken words.
   * Animated evaluation progress indicator (`0% → 100%`) showing live neural evaluation stages.
   * Color-coded word-by-word diff output (🟢 Green = Match, 🔴 Red = Mistake).

3. **🏆 Ikhtebaar Testing Suite (`الاختبار الأكاديمي`)**:
   * Automated, non-repeating oral examination generator supporting Juz, Page, and Surah boundaries.
   * Progressive 3-tier hints accordion (First Ayah on page, Surah identifier, Preceding context).
   * Real-time audio recording & examination grading report cards.

4. **📊 Talabat Analytics Dashboard (`لوحة الأداء`)**:
   * **30-Juz Memorization Heatmap Matrix**: 30 interactive blocks color-coded by mastery level (Mastered $\ge 85\%$, Progressing $60-84\%$, Needs Revision $< 60\%$).
   * **Mutashabihat Revision Queue**: Tracks recurring mistaken words with error frequency counters and a Dismiss/Delete action.
   * **Session Audit Logs**: Full historical record of past evaluation scores, timestamps, and recognized speech transcriptions stored in SQLite (`users.db`).

---

## 🛠️ Technology Stack Used

* **Backend Framework**: Python 3.12, FastAPI, Uvicorn, Starlette Sessions
* **AI & ASR Pipeline**: Hugging Face Transformers (`tarteel-ai/whisper-base-ar-quran`), PyTorch (CPU Multi-threading), Scipy, NumPy Linear Interpolation
* **Database**: SQLite3, SQLAlchemy ORM (`users.db`)
* **Frontend**: React 18, Vite 5, Tailwind CSS, Lucide React Icons, Web Audio API (`AudioContext` PCM WAV Encoding)

---

## ⚙️ Installation & Setup Instructions

### Prerequisites
* **Python**: Version 3.10+ (Python 3.12 recommended)
* **Node.js**: Version 18+ and `npm`

### Step 1: Clone & Configure Virtual Environment
```bash
git clone <repository_url>
cd whisper_app

# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Install Node Dependencies & Build Frontend
```bash
npm install
npm run build
```

---

## 🚀 Steps to Run the Project

1. Ensure your virtual environment is active.
2. Launch the FastAPI Uvicorn server:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
3. Open your browser and navigate to:
   ```
   http://127.0.0.1:8000
   ```

---

## 🔑 Default Login Credentials

* **Talabat TR no.**: `27137`
* **Passcode**: `27137`

*(Alternatively, you can register a new profile directly from the login page using any 5-digit TR no. and a passcode of at least 5 characters).*

---

## 📝 Additional Notes for Testing & Evaluation

1. **Microphone Access**: Ensure microphone permissions are granted in your web browser when testing **Tasmee** or **Ikhtebaar** modules.
2. **First-Time Model Loading**: On initial server launch, Hugging Face Transformers will download `tarteel-ai/whisper-base-ar-quran` weights (~240MB). Subsequent server boots load the weights instantly from cache.
3. **Database File**: All session history and user accounts are persisted in `users.db` inside the project root.
