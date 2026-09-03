import io
import os
import re
import difflib
import logging
import time
import numpy as np
import scipy.io.wavfile as wavfile
from app.config import settings

logger = logging.getLogger(__name__)

# Global model state
whisper_engine = None  # WhisperModel (faster_whisper) or pipeline (transformers)
ENGINE_TYPE = "none"   # "faster-whisper" | "transformers" | "none"
MODEL_LOADED = False
MODEL_LOADING_ERROR = ""

def is_model_ready() -> bool:
    return MODEL_LOADED and whisper_engine is not None

def get_model_health() -> dict:
    if MODEL_LOADED and whisper_engine is not None:
        status = "ready"
    elif MODEL_LOADING_ERROR:
        status = "error"
    else:
        status = "loading"
        
    return {
        "model_loaded": is_model_ready(),
        "status": status,
        "engine": ENGINE_TYPE,
        "model_name": settings.WHISPER_MODEL_NAME,
        "is_local": os.path.exists(settings.LOCAL_MODEL_DIR),
        "local_path": settings.LOCAL_MODEL_DIR if os.path.exists(settings.LOCAL_MODEL_DIR) else None,
        "error": MODEL_LOADING_ERROR
    }

def decode_audio_bytes_to_numpy(audio_bytes: bytes):
    """
    Decodes in-memory WAV audio bytes into a 1D float32 NumPy array and sample rate.
    Handles mono/stereo and int16/int32/float32 WAV formats without requiring ffmpeg.
    """
    if not audio_bytes or len(audio_bytes) < 44:
        return None, 16000
    try:
        sample_rate, data = wavfile.read(io.BytesIO(audio_bytes))
        if data is None or len(data) == 0:
            return None, sample_rate
            
        # Convert multi-channel (stereo) to mono
        if data.ndim > 1:
            data = data.mean(axis=1)
            
        # Normalize to float32 range [-1.0, 1.0]
        if np.issubdtype(data.dtype, np.integer):
            info = np.iinfo(data.dtype)
            max_abs = max(abs(info.min), abs(info.max))
            data = data.astype(np.float32) / float(max_abs)
        elif np.issubdtype(data.dtype, np.floating):
            data = data.astype(np.float32)
            
        return data, int(sample_rate)
    except Exception as e:
        logger.error(f"Error decoding audio bytes to numpy array via scipy: {e}")
        # Fallback raw PCM decode
        try:
            raw_payload = audio_bytes[44:] if (len(audio_bytes) > 44 and audio_bytes[:4] == b'RIFF') else audio_bytes
            raw_data = np.frombuffer(raw_payload, dtype=np.int16).astype(np.float32) / 32768.0
            if len(raw_data) > 0:
                return raw_data, 16000
        except Exception as fb_err:
            logger.error(f"Fallback raw PCM decode failed: {fb_err}")
        return None, 16000

def is_voice_active(audio_array: np.ndarray, threshold: float = 0.005) -> bool:
    """
    Pure-numpy RMS energy Voice Activity Detection.
    Returns False (skip Whisper) if the audio is silence or low background noise.
    """
    if audio_array is None or len(audio_array) == 0:
        return False
    rms = float(np.sqrt(np.mean(audio_array.astype(np.float32) ** 2)))
    return rms >= threshold

def init_whisper_model():
    """
    Initializes the Whisper model with priority for local faster-whisper CTranslate2 int8 engine.
    Gracefully falls back to PyTorch transformers pipeline if CTranslate2 is unavailable.
    """
    global whisper_engine, ENGINE_TYPE, MODEL_LOADED, MODEL_LOADING_ERROR
    MODEL_LOADED = False
    MODEL_LOADING_ERROR = ""
    
    # 1. Check for Local Quantized faster-whisper CTranslate2 Engine
    local_dir = settings.LOCAL_MODEL_DIR
    if os.path.exists(local_dir) and os.path.exists(os.path.join(local_dir, "model.bin")):
        try:
            logger.info(f"Loading local faster-whisper (CTranslate2 int8) model from {local_dir}...")
            from faster_whisper import WhisperModel
            
            # Auto-detect CUDA vs CPU
            device = "cpu"
            compute_type = "int8"
            try:
                import torch
                if torch.cuda.is_available():
                    device = "cuda"
                    compute_type = "float16"
                    logger.info("NVIDIA CUDA GPU detected: Accelerating Whisper with float16 on GPU!")
            except Exception:
                pass

            cpu_threads = min(4, os.cpu_count() or 4)
            whisper_engine = WhisperModel(
                local_dir,
                device=device,
                compute_type=compute_type,
                cpu_threads=cpu_threads,
                num_workers=1
            )
            ENGINE_TYPE = f"faster-whisper ({device.upper()} {compute_type})"
            
            # Pre-flight Warmup inference pass on 0.2s silence
            logger.info("Executing faster-whisper pre-flight warmup pass...")
            warmup_samples = np.zeros(3200, dtype=np.float32)
            segments, _ = whisper_engine.transcribe(warmup_samples, language="ar", beam_size=1)
            list(segments)  # consume generator
            
            MODEL_LOADED = True
            MODEL_LOADING_ERROR = ""
            logger.info(f"--> Local {ENGINE_TYPE} model loaded and warmed up in ~400ms! Ready for 100% offline STT inference.")
            return
        except Exception as fw_err:
            logger.warning(f"faster-whisper local loading failed: {fw_err}. Falling back to HuggingFace pipeline...", exc_info=True)

    # 2. Fallback to HuggingFace transformers pipeline
    try:
        import torch
        if hasattr(torch, 'set_num_threads'):
            num_threads = min(4, os.cpu_count() or 4)
            torch.set_num_threads(num_threads)
            
        if settings.HF_TOKEN:
            os.environ["HF_TOKEN"] = settings.HF_TOKEN
            
        from transformers import pipeline
        logger.info(f"Loading HuggingFace Whisper Pipeline: {settings.WHISPER_MODEL_NAME}...")
        
        pipeline_kwargs = {
            "task": "automatic-speech-recognition",
            "model": settings.WHISPER_MODEL_NAME,
            "return_timestamps": False
        }
        if settings.HF_TOKEN:
            pipeline_kwargs["token"] = settings.HF_TOKEN

        pipe = pipeline(**pipeline_kwargs)

        if hasattr(pipe, 'model') and hasattr(pipe.model, 'generation_config'):
            gc = pipe.model.generation_config
            gc.suppress_tokens = None
            gc.begin_suppress_tokens = None
            gc.forced_decoder_ids = None
            gc.num_beams = 1
            try:
                del gc.max_length
            except AttributeError:
                pass
            try:
                del gc.max_new_tokens
            except AttributeError:
                pass

        logger.info("Executing HuggingFace Whisper pre-flight warmup pass...")
        warmup_samples = np.zeros(3200, dtype=np.float32)
        with torch.inference_mode():
            _ = pipe(
                {"array": warmup_samples, "sampling_rate": 16000},
                generate_kwargs={"max_new_tokens": 5}
            )

        whisper_engine = pipe
        ENGINE_TYPE = "transformers-pipeline"
        MODEL_LOADED = True
        MODEL_LOADING_ERROR = ""
        logger.info("--> HuggingFace Whisper Pipeline successfully loaded and ready for STT inference.")
    except Exception as e:
        logger.error(f"Could not load HuggingFace Whisper model: {e}", exc_info=True)
        whisper_engine = None
        ENGINE_TYPE = "none"
        MODEL_LOADED = False
        MODEL_LOADING_ERROR = str(e)

def normalize_arabic(text: str) -> str:
    """
    Normalizes Arabic text by converting Uthmani script symbols, stripping all Harakat/Tashkeel,
    unifying Alif variants, and mapping Uthmani spelling variants for 100% accurate letter matching.
    """
    if not text:
        return ""
    # 1. Convert Alif Khanjariya (dagger Alif \u0670) to explicit Alif 'ا' BEFORE stripping harakat
    text = re.sub(r'\u0670', 'ا', text)
    # 2. Strip all Tashkeel / Harakat and Quranic waqf marks
    text = re.sub(r'[\u0610-\u061A\u064B-\u065F\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED]', '', text)
    # 3. Normalize Alif forms (أ, إ, آ, ٱ -> ا)
    text = re.sub(r'[أإآٱ]', 'ا', text)
    # 4. Normalize Alef Maqsoora / Ya (ى -> ي)
    text = re.sub(r'ى', 'ي', text)
    # 5. Normalize Ta Marbouta / Ha (ة -> ه)
    text = re.sub(r'ة', 'ه', text)
    # 6. Normalize common Uthmani vs Standard spelling variants
    text = re.sub(r'الرحمان', 'الرحمن', text)
    text = re.sub(r'صلوة', 'صلاة', text)
    text = re.sub(r'زكوة', 'زكاة', text)
    text = re.sub(r'سماوات', 'سموات', text)
    # 7. Remove non-Arabic punctuation, digits, brackets & Uthmani symbols
    text = re.sub(r'[^\w\s\u0600-\u06FF]', '', text)
    text = re.sub(r'[0-9\u0660-\u0669]', '', text)
    # 8. Remove Tatweel
    text = re.sub(r'ـ', '', text)
    return text.strip()

def to_phonetic_sound_key(norm_text: str) -> str:
    """
    Maps Arabic characters to a canonical Tajweed & acoustic equivalence key.
    Handles acoustic confusions common in Quranic ASR:
    - ث (Thaa) / س (Seen) / ص (Saad) -> 'س'
    - ذ (Dhaal) / ز (Zay) / ظ (Zhaa) -> 'ز'
    - ض (Daad) / د (Daal) / ظ -> 'د'
    - ت (Taa) / ط (Taa') -> 'ت'
    - ق (Qaaf) / ك (Kaaf) -> 'ك'
    - ح (Haa) / ه (Haa') / خ -> 'ه'
    - ج (Jeem) / ش (Sheen) -> 'ش'
    - Idgham: ن/ Tanween followed by ي/ر/م/ل/و/ن (يَرْمَلُون) -> assimilates into following letter
    """
    if not norm_text:
        return ""
    s = norm_text
    # 1. Acoustic consonant cluster mapping
    s = re.sub(r'[ثص]', 'س', s)
    s = re.sub(r'[ذظ]', 'ز', s)
    s = re.sub(r'[ض]', 'د', s)
    s = re.sub(r'[ط]', 'ت', s)
    s = re.sub(r'[ق]', 'ك', s)
    s = re.sub(r'[حخ]', 'ه', s)
    s = re.sub(r'[ج]', 'ش', s)
    # 2. Idgham assimilation: e.g. من يعمل -> مييعمل
    s = re.sub(r'ن([يرملون])', r'\1\1', s)
    # 3. Collapse consecutive duplicate letters
    s = re.sub(r'(.)\1+', r'\1', s)
    return s

def are_words_phonetically_equivalent(w1: str, w2: str) -> bool:
    """
    Evaluates whether two Arabic words match strictly or under Tajweed phonetic equivalence
    (such as Idgham merges, acoustic STT shifts, sound keys, or <=1 edit distance).
    """
    n1 = normalize_arabic(w1)
    n2 = normalize_arabic(w2)
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True

    # 1. Compare canonical phonetic sound keys
    k1 = to_phonetic_sound_key(n1)
    k2 = to_phonetic_sound_key(n2)
    if k1 and k2:
        if k1 == k2:
            return True
        if len(k1) >= 2 and len(k2) >= 2 and abs(len(k1) - len(k2)) <= 1:
            ratio = difflib.SequenceMatcher(None, k1, k2).ratio()
            if ratio >= 0.70:
                return True

    # 2. Direct sequence similarity on normalized strings
    if len(n1) >= 3 and len(n2) >= 3 and abs(len(n1) - len(n2)) <= 1:
        ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
        if ratio >= 0.75:
            return True
                
    return False

def trim_to_last_n_seconds(audio_bytes: bytes, seconds: float = 8.0) -> bytes:
    """
    Trims WAV audio bytes to keep only the last N seconds of PCM payload,
    re-attaching a valid 44-byte WAV header so Whisper receives a valid standalone WAV file.
    """
    if not audio_bytes or len(audio_bytes) <= 44:
        return audio_bytes

    try:
        header = audio_bytes[:44]
        payload = audio_bytes[44:]
        
        import struct
        channels = struct.unpack('<H', header[22:24])[0] if len(header) >= 24 else 1
        sample_rate = struct.unpack('<I', header[24:28])[0] if len(header) >= 28 else 16000
        bits_per_sample = struct.unpack('<H', header[34:36])[0] if len(header) >= 36 else 16

        bytes_per_sec = int(sample_rate * channels * (bits_per_sample / 8))
        max_bytes = int(bytes_per_sec * seconds)

        if len(payload) > max_bytes:
            trimmed_payload = payload[-max_bytes:]
        else:
            trimmed_payload = payload

        data_size = len(trimmed_payload)
        riff_size = data_size + 36
        
        new_header = bytearray(header)
        new_header[4:8] = struct.pack('<I', riff_size)
        new_header[40:44] = struct.pack('<I', data_size)

        return bytes(new_header) + trimmed_payload
    except Exception as e:
        logger.error(f"Error trimming audio bytes: {e}")
        return audio_bytes

class RecitationSession:
    """ Stateful Session Layer for live incremental Tasmee & Ikhtebaar recitation grading. """
    def __init__(
        self, 
        session_id: str, 
        expected_text: str, 
        module_type: str = "tasmee", 
        range_mode: str = "custom", 
        start_val: int = 1, 
        end_val: int = 1,
        word_metadata: list = None
    ):
        self.session_id = session_id
        self.expected_text = expected_text
        self.module_type = module_type
        self.range_mode = range_mode
        self.start_val = start_val
        self.end_val = end_val
        self.transcriptions = []
        self.final_transcription = ""
        
        orig_words = expected_text.split()
        self.display_words = []
        self.norm_expected_words = []
        filtered_metadata = []
        
        for idx, w in enumerate(orig_words):
            cleaned = re.sub(r'[\uFD3E\uFD3F0-9\u0660-\u0669\s]+', '', w).strip()
            norm = normalize_arabic(cleaned)
            if norm:
                self.display_words.append(w)
                self.norm_expected_words.append(norm)
                if word_metadata and idx < len(word_metadata):
                    filtered_metadata.append(word_metadata[idx])
                
        self.total_words = len(self.display_words)
        self.confirmed_index = 0
        
        self.word_status = []
        for i in range(self.total_words):
            meta = filtered_metadata[i] if i < len(filtered_metadata) else {}
            self.word_status.append({
                "word": self.display_words[i],
                "status": "pending",
                "sura": meta.get("sura", 1),
                "ayah": meta.get("ayah", 1),
                "page": meta.get("page", 1),
                "surah_name": meta.get("surah_name", "")
            })
            
        self.rolling_buffer = b""
        self.consecutive_misses = 0
        self.created_at = time.time()

    def check_and_apply_bismillah_skip(self, first_spoken_words: list[str]) -> bool:
        """
        If target text starts with Bismillah (first 4 words), but student starts
        reciting directly at Ayah 1 (index 4), auto-advance confirmed_index to 4
        and mark Bismillah as 'bismillah_skipped' without docking points.
        """
        if self.confirmed_index != 0 or self.total_words < 5:
            return False
        
        bismillah_norm = ["بسم", "الله", "الرحمن", "الرحيم"]
        expected_start = self.norm_expected_words[:4]
        
        if expected_start == bismillah_norm:
            first_user = first_spoken_words[0] if first_spoken_words else ""
            target_ayah1_word = self.norm_expected_words[4]
            
            if first_user and are_words_phonetically_equivalent(first_user, target_ayah1_word):
                logger.info(f"[Bismillah Auto-Skip] Student skipped opening Bismillah and started directly at Ayah 1 ('{self.display_words[4]}'). Auto-advancing pointer.")
                for i in range(4):
                    self.word_status[i]["status"] = "bismillah_skipped"
                self.confirmed_index = 4
                return True
        return False

    def get_upcoming_prompt(self, count: int = 8) -> str:
        upcoming = self.display_words[self.confirmed_index : self.confirmed_index + count]
        return " ".join(upcoming)

# Alias for backwards compatibility
IkhtebaarSession = RecitationSession

ikhtebaar_sessions: dict[str, RecitationSession] = {}
tasmee_sessions: dict[str, RecitationSession] = {}

async def transcribe_audio_file(audio_bytes: bytes = None, expected_text: str = "", file_path: str = None, initial_prompt: str = "", max_new_tokens: int = 64) -> str:
    """
    Transcribes audio bytes or file_path using the loaded local faster-whisper or HuggingFace engine.
    Passes raw 16kHz PCM audio array directly to bypass ffmpeg dependency.
    Applies Quranic prompt conditioning for high accuracy Tajweed transcription.
    """
    global whisper_engine, ENGINE_TYPE, MODEL_LOADED
    
    if not MODEL_LOADED or whisper_engine is None:
        logger.warning("Whisper model is still loading or unavailable.")
        return ""

    try:
        if file_path and os.path.exists(file_path):
            with open(file_path, "rb") as f:
                audio_bytes = f.read()

        if not audio_bytes or len(audio_bytes) < 44:
            logger.info("Audio bytes empty or too small.")
            return ""

        # Decode audio bytes into float32 array
        audio_array, sampling_rate = decode_audio_bytes_to_numpy(audio_bytes)
        
        if audio_array is None or len(audio_array) == 0:
            logger.warning("Could not decode audio bytes to numpy array.")
            return ""

        # Check Voice Activity Detection
        if not is_voice_active(audio_array):
            logger.info("VAD: Audio is silence / background noise below threshold. Skipping inference.")
            return ""

        # Target Quran prompt conditioning
        prompt_candidate = initial_prompt or expected_text
        clean_prompt = normalize_arabic(prompt_candidate)[:250] if prompt_candidate else None

        # 1. If using faster-whisper (CTranslate2 int8)
        if "faster-whisper" in ENGINE_TYPE:
            t0 = time.time()
            segments, info = whisper_engine.transcribe(
                audio_array,
                language="ar",
                initial_prompt=clean_prompt or None,
                beam_size=1,
                best_of=1,
                temperature=0.0,
                condition_on_previous_text=False,
                vad_filter=False
            )
            transcription = " ".join([seg.text for seg in segments]).strip()
            elapsed = (time.time() - t0) * 1000
            logger.info(f"faster-whisper STT in {elapsed:.1f}ms: '{transcription}'")
            return transcription

        # 2. If using HuggingFace pipeline fallback
        else:
            import torch
            with torch.inference_mode():
                gen_kwargs = {"max_new_tokens": max_new_tokens}
                if clean_prompt and hasattr(whisper_engine, 'tokenizer') and whisper_engine.tokenizer:
                    try:
                        prompt_ids = whisper_engine.tokenizer.get_prompt_ids(clean_prompt, return_tensors="pt")
                        if isinstance(prompt_ids, np.ndarray):
                            prompt_ids = torch.from_numpy(prompt_ids)
                        if isinstance(prompt_ids, torch.Tensor):
                            gen_kwargs["prompt_ids"] = prompt_ids
                    except Exception as pe:
                        logger.warning(f"Could not convert prompt_ids to Tensor: {pe}")

                result = whisper_engine(
                    {"array": audio_array, "sampling_rate": sampling_rate or 16000},
                    generate_kwargs=gen_kwargs
                )
            transcription = result.get("text", "").strip() if isinstance(result, dict) else str(result).strip()
            logger.info(f"HuggingFace Whisper STT: '{transcription}'")
            return transcription

    except Exception as e:
        logger.error(f"Whisper inference error: {e}", exc_info=True)
        return ""

def compare_recitation(expected_text: str, user_transcription: str):
    """
    Compares expected Quran ground truth text vs user transcribed text, 
    calculating word-level accuracy and detailed diff breakdown.
    """
    norm_truth = normalize_arabic(expected_text)
    norm_user = normalize_arabic(user_transcription)

    truth_words = norm_truth.split()
    user_words = norm_user.split()

    if not truth_words:
        return {
            "user_transcription": user_transcription,
            "ground_truth": expected_text,
            "comparison": [],
            "accuracy_score": 0.0,
            "correct_words_count": 0,
            "total_words": 0
        }

    matcher = difflib.SequenceMatcher(None, truth_words, user_words)
    comparison_results = []
    correct_words_count = 0
    total_words = len(truth_words)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            words = truth_words[i1:i2]
            correct_words_count += len(words)
            comparison_results.append({"status": "correct", "words": words})
        elif tag == 'delete':
            comparison_results.append({"status": "missed", "words": truth_words[i1:i2]})
        elif tag == 'insert':
            comparison_results.append({"status": "extra", "words": user_words[j1:j2]})
        elif tag == 'replace':
            comparison_results.append({
                "status": "incorrect", 
                "expected": truth_words[i1:i2], 
                "user_said": user_words[j1:j2]
            })

    accuracy_score = round((correct_words_count / total_words) * 100, 1) if total_words > 0 else 0.0

    return {
        "user_transcription": user_transcription,
        "ground_truth": expected_text,
        "comparison": comparison_results,
        "accuracy_score": accuracy_score,
        "correct_words_count": correct_words_count,
        "total_words": total_words
    }

def align_recited_words(expected_words: list, recited_words: list, max_window: int = 0) -> list[int]:
    """
    Monotonically aligns recited words against expected words using phonetic, Tajweed,
    and compound multi-word matching.
    Returns a list of integer indices in expected_words that were correctly recited.
    """
    if not expected_words or not recited_words:
        return []

    norm_exp = [normalize_arabic(w) for w in expected_words]
    norm_rec = [normalize_arabic(w) for w in recited_words if normalize_arabic(w)]

    search_len = min(len(norm_exp), max_window) if max_window > 0 else len(norm_exp)
    matched_indices = set()
    curr_exp_idx = 0
    rec_idx = 0

    while rec_idx < len(norm_rec) and curr_exp_idx < search_len:
        r_w = norm_rec[rec_idx]
        next_r_w = norm_rec[rec_idx + 1] if rec_idx + 1 < len(norm_rec) else ""
        lookahead = min(search_len, curr_exp_idx + 8)
        found = False

        for i in range(curr_exp_idx, lookahead):
            exp_w = norm_exp[i]
            next_exp_w = norm_exp[i + 1] if i + 1 < len(norm_exp) else ""

            # 1. Direct 1-to-1 phonetic match
            if are_words_phonetically_equivalent(exp_w, r_w):
                matched_indices.add(i)
                curr_exp_idx = i + 1
                rec_idx += 1
                found = True
                break

            # 2. 2-to-1 compound match: Expected ["اوحي", "لها"] -> Recited "اوحالها" / "اوهانها"
            if next_exp_w and are_words_phonetically_equivalent(exp_w + next_exp_w, r_w):
                matched_indices.add(i)
                matched_indices.add(i + 1)
                curr_exp_idx = i + 2
                rec_idx += 1
                found = True
                break

            # 3. 1-to-2 split match: Expected "يومئذ" -> Recited ["يوم", "اذ"]
            if next_r_w and are_words_phonetically_equivalent(exp_w, r_w + next_r_w):
                matched_indices.add(i)
                curr_exp_idx = i + 1
                rec_idx += 2
                found = True
                break

        if not found:
            # Advance recited pointer if no match found within window
            rec_idx += 1

    return sorted(list(matched_indices))

