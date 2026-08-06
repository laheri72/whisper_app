# 📖 Whisper Quran Platform - Project Overview

## 🌟 Executive Summary
The **Whisper Quran Platform** is a full-stack AI application for Quranic recitation testing, interactive reading, and automated memorization assessment. It utilizes Hugging Face's fine-tuned `tarteel-ai/whisper-base-ar-quran` Automatic Speech Recognition (ASR) model to transcribe recitations and perform word-by-word accuracy diff analysis against official Uthmani Quranic text.

---

## 🎯 Key Application Features

### 1. 📖 Tilawat & Audio Reader
- **Page Viewer**: Read any page (1–604) of the Holy Quran in clean Uthmani script with basic Tajweed color highlights.
- **Audio Playback**: Click any Ayah to listen toSheikh Mishary Rashed Alafasy's audio recitation.
- **Auto-Loading**: Page 1 loads automatically when entering the portal.

### 2. 🎤 Tasmee Recitation Test (Hidden Text)
- **Recitation Testing**: Test memorization by Page (1–604), Surah (1–114), or Juz (1–30) with Quranic text kept hidden.
- **Dual Recording Options**:
  - Live microphone recording with interactive audio waveform canvas.
  - Local audio file upload (`.wav`, `.mp3`).
- **In-Browser WAV Transcoding**: Converts WebAudio input directly into 16kHz Mono PCM WAV format in JavaScript to ensure 100% compatibility across all browsers.
- **Word-by-Word AI Feedback**: Highlights correct words in green, incorrect pronunciations in red/blue, skipped words in amber, and extra words in purple.

### 3. 🎯 Ikhtebaar Memorization Quiz
- **Random Ayah Prompts**: Select a page range (e.g. Page 1 to 10) to generate random Ayah recitation questions.
- **Visual Prompt Display**: Presents Surah name, Ayah number, and Quranic Arabic prompt.
- **AI Assessment & Scoring**: Real-time accuracy percentage score ($\text{Accuracy} = \frac{\text{Correct Words}}{\text{Total Words}} \times 100\%$) saved to student database records.

### 4. 🔒 Authentication & Profile Progress Tracking
- **Default Credentials**: 129 student IDs pre-seeded in SQLite database (`quran_platform.db`).
- **Forced First-Time Password Reset**: Directs first-time logins to set a secure password.
- **Profile Performance Stats**: Displays average Tasmee accuracy %, average Ikhtebaar score, and total completed sessions on the top dashboard banner.

---

## 🎨 Design System & Aesthetic Guidelines

- **Palette**: Emerald Green (`#061510` to `#134032`), Metallic Gold (`#D4AF37`), Dark Slate (`#0F2A22`), Soft Cream (`#F9F8F3`).
- **Typography**: Google Fonts `Amiri` for Quranic Arabic text & `Outfit` for numerical badges and English subtitles.
- **Glassmorphism**: Backdrop blur effects (`backdrop-filter: blur(16px)`), subtle gold borders, and dark/light theme toggle.

---

## 📂 File Hierarchy

```
whisper_app/
├── app/
│   ├── config.py           # Application settings & environment variables
│   ├── database.py         # SQLAlchemy engine & session factory
│   ├── models.py           # User & RecitationRecord database models
│   ├── security.py         # Salte-based SHA-256 password hashing
│   ├── ai_service.py       # Whisper STT pipeline, Arabic normalization & diff engine
│   └── routers/
│       ├── auth.py         # Login, logout, change_password routes
│       ├── quran.py        # Profile stats & user progress API
│       └── recitation.py   # Audio transcription & comparison API
├── docs/                   # Complete project documentation folder
│   ├── PROJECT_OVERVIEW.md # Features, aesthetics, file structure
│   ├── ARCHITECTURE.md     # System architecture, data flow & database schema
│   └── SETUP_GUIDE.md      # Installation, execution & troubleshooting
├── templates/
│   ├── index.html          # Main Glassmorphic SPA dashboard
│   ├── login.html          # User authentication portal
│   └── change_password.html # Forced first-time password reset page
├── .gitignore              # Ignored files (venvs, databases, bytecode)
├── main.py                 # FastAPI application entry point
├── requirements.txt        # Production dependencies list
└── README.md               # Root repository index
```
