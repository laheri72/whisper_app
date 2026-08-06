# 🏗️ System Architecture & Technical Specifications

## 1. System Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              CLIENT BROWSER                             |
|  - Glassmorphic Web UI (index.html, Amiri & Outfit Fonts)               |
|  - Web Audio API (Live Frequency Waveform Canvas)                       |
|  - Pure JS 16kHz PCM WAV Encoder (converts WebM AudioBuffers)           |
+-----------------------------------┬-------------------------------------+
                                    |
            HTTP GET/POST Requests  |  Audio File Upload / Microhpone Blob
                                    v
+-------------------------------------------------------------------------+
|                           FASTAPI API GATEWAY                           |
|  - SessionMiddleware (Encrypted Cookie Sessions)                        |
|  - Router Layer:                                                        |
|      * auth.py        -> Login, Logout, Change Password                 |
|      * quran.py       -> Student Stats & Recitation History             |
|      * recitation.py  -> Audio Processing & Analysis                    |
+-------------------┬─────────────────────────────────┬-------------------+
                    |                                 |
                    v                                 v
+----------------──────────────────+  +-----------------------------------+
|      DATABASE LAYER (SQLite)     |  |       AI & STT ENGINE LAYER       |
|  - SQLAlchemy ORM (models.py)    |  |  - tarteel-ai/whisper-base-ar-quran|
|  - User Schema                   |  |  - FFmpeg-Free NumPy Decoder      |
|  - RecitationRecord Schema       |  |  - normalize_arabic()             |
|  - Auto-Seeding (129 Users)      |  |  - difflib.SequenceMatcher Diff   |
+----------------------------------+  +-----------------------------------+
```

---

## 2. AI Speech Recognition & Text Normalization Pipeline

### A. FFmpeg-Free Audio Decoding
To avoid `ffmpeg.exe` binary dependencies on Windows host machines:
1. Client-side JavaScript encodes microphone input into a clean 16kHz PCM WAV byte stream (`Blob`).
2. Server function `decode_audio_bytes_to_numpy()` in `app/ai_service.py` parses WAV headers using `scipy.io.wavfile` into a 16kHz float32 NumPy array (`[-1.0, 1.0]`).
3. The NumPy dictionary `{"array": numpy_array, "sampling_rate": 16000}` is fed directly into Hugging Face's `pipe(...)`.

### B. Arabic Text Normalization (`normalize_arabic`)
Strips non-semantic variations before diff calculation:
- **Tashkeel / Harakat**: Removes fathah, dammah, kasrah, sukun, shaddah, tanween (`\u064B-\u0652`).
- **Alif Normalization**: Unifies `أ`, `إ`, `آ`, `ٱ` $\rightarrow$ `ا`.
- **Ya / Alef Maqsoora**: Unifies `ى` $\rightarrow$ `ي`.
- **Punctuation**: Strips Quranic waqf marks (`ۛ`, `ۚ`, `ۖ`, `ۗ`) and Tatweel (`ـ`).

### C. Diff Alignment & Accuracy Metrics (`SequenceMatcher`)
- Compares normalized ground truth words vs user transcribed words using `difflib.SequenceMatcher.get_opcodes()`.
- **Accuracy Formula**:
  $$\text{Accuracy Score} = \max\left(0, \frac{\text{Correct Words Count}}{\text{Total Ground Truth Words}} \times 100\%\right)$$
- Categorizes tokens into: `correct`, `missed`, `extra`, and `incorrect`.

---

## 3. Database Schemas (`app/models.py`)

### `users` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Unique User ID |
| `username` | String | Unique, Index, Not Null | Numeric Student ID (e.g. `24425`) |
| `password_hash` | String | Not Null | Salted SHA-256 password hash |
| `first_login` | Boolean | Default: `True` | Flags mandatory first-time password reset |
| `created_at` | DateTime | Default: `UTC Now` | Registration timestamp |

### `recitation_records` Table
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Index | Record ID |
| `user_id` | Integer | Foreign Key (`users.id`) | Student User ID |
| `mode` | String | Not Null | Test type (`tasmee` or `ikhtebaar`) |
| `target_ref` | String | Not Null | Reference label (e.g. `Surah 1`, `Page 5`) |
| `expected_text` | Text | Not Null | Official Quranic ground truth text |
| `user_transcription` | Text | Nullable | Transcribed speech text from Whisper AI |
| `accuracy_score` | Float | Default: `0.0` | Word accuracy percentage |
| `correct_words` | Integer | Default: `0` | Count of correctly recited words |
| `total_words` | Integer | Default: `0` | Total words in ground truth text |
| `timestamp` | DateTime | Default: `UTC Now` | Test completion timestamp |
