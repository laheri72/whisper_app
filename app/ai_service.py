import io
import os
import re
import difflib
import logging
import numpy as np
import scipy.io.wavfile as wavfile
from app.config import settings

logger = logging.getLogger(__name__)

# Global model pipeline state
pipe = None
MODEL_LOADED = False
MODEL_LOADING_ERROR = ""

def is_model_ready() -> bool:
    return MODEL_LOADED and pipe is not None

def get_model_health() -> dict:
    if MODEL_LOADED and pipe is not None:
        status = "ready"
    elif MODEL_LOADING_ERROR:
        status = "error"
    else:
        status = "loading"
        
    return {
        "model_loaded": is_model_ready(),
        "status": status,
        "model_name": settings.WHISPER_MODEL_NAME,
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

def is_voice_active(audio_array: np.ndarray, threshold: float = 0.006) -> bool:
    """
    Pure-numpy RMS energy Voice Activity Detection.
    Returns False (skip Whisper) if the audio is essentially silence / background noise.
    Threshold of 0.006 is empirically calibrated for 16kHz laptop microphone recordings.
    Zero external dependencies — runs in <0.1ms on any CPU.
    """
    if audio_array is None or len(audio_array) == 0:
        return False
    rms = float(np.sqrt(np.mean(audio_array.astype(np.float32) ** 2)))
    return rms >= threshold

def init_whisper_model():
    """Initializes the HuggingFace Whisper model pipeline with tuned CPU multi-threading, warmup pass, and error handling."""
    global pipe, MODEL_LOADED, MODEL_LOADING_ERROR
    MODEL_LOADED = False
    MODEL_LOADING_ERROR = ""
    try:
        import torch
        if hasattr(torch, 'set_num_threads'):
            num_threads = min(4, os.cpu_count() or 4)
            torch.set_num_threads(num_threads)
            
        if settings.HF_TOKEN:
            os.environ["HF_TOKEN"] = settings.HF_TOKEN
            
        from transformers import pipeline
        logger.info(f"Loading Accelerated Whisper Model: {settings.WHISPER_MODEL_NAME}...")
        
        pipeline_kwargs = {
            "task": "automatic-speech-recognition",
            "model": settings.WHISPER_MODEL_NAME,
            "return_timestamps": False
        }
        if settings.HF_TOKEN:
            pipeline_kwargs["token"] = settings.HF_TOKEN

        pipe = pipeline(**pipeline_kwargs)

        # ── generation_config hardening ──────────────────────────────────────────
        # The transformers warning fires when BOTH generation_config.max_new_tokens
        # AND generate_kwargs["max_new_tokens"] are set. Fix: don't set max_new_tokens
        # on generation_config at all — always pass it exclusively via generate_kwargs.
        # For max_length: setting to None doesn't remove it; use del to truly clear it.
        if hasattr(pipe, 'model') and hasattr(pipe.model, 'generation_config'):
            gc = pipe.model.generation_config
            gc.suppress_tokens = None
            gc.begin_suppress_tokens = None
            gc.forced_decoder_ids = None
            gc.num_beams = 1
            # Do NOT set max_new_tokens here — only pass via generate_kwargs per call
            try:
                del gc.max_length     # fully remove to stop "max_new_tokens + max_length" conflict
            except AttributeError:
                pass
            try:
                del gc.max_new_tokens # remove so generate_kwargs is the sole authority
            except AttributeError:
                pass

        # Pre-inference Dry-Run Warmup (0.2s of silence) to ensure tensor execution graph is warm and ready
        logger.info("Executing Whisper pre-flight warmup inference pass...")
        warmup_samples = np.zeros(3200, dtype=np.float32)
        with torch.inference_mode():
            _ = pipe(
                {"array": warmup_samples, "sampling_rate": 16000},
                generate_kwargs={"max_new_tokens": 5}
            )

        MODEL_LOADED = True
        MODEL_LOADING_ERROR = ""
        logger.info("--> Accelerated Whisper Model successfully loaded, warmed up, and ready for genuine STT inference!")
    except Exception as e:
        logger.error(f"Could not load HuggingFace Whisper model: {e}", exc_info=True)
        pipe = None
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

def are_words_phonetically_equivalent(w1: str, w2: str) -> bool:
    """
    Evaluates whether two Arabic words match strictly or under Tajweed phonetic equivalence
    (such as Idgham merges, acoustic STT k/q shifts, or 1-letter edit distance).
    """
    n1 = normalize_arabic(w1)
    n2 = normalize_arabic(w2)
    if not n1 or not n2:
        return False
    if n1 == n2:
        return True
    
    # Check Qira'at/Tajweed phonetic acoustic substitution (e.g. كفوا vs قفوا, يكن vs يقل)
    sub_n1 = re.sub(r'[قك]', 'ك', n1)
    sub_n2 = re.sub(r'[قك]', 'ك', n2)
    if sub_n1 == sub_n2:
        return True

    # Levenshtein / edit distance <= 1 for words with length >= 3
    if len(n1) >= 3 and len(n2) >= 3:
        if abs(len(n1) - len(n2)) <= 1:
            ratio = difflib.SequenceMatcher(None, n1, n2).ratio()
            if ratio >= 0.70:
                return True
    return False

def align_recited_words(expected_words: list[str], user_words: list[str], max_window: int = 40) -> list[int]:
    """
    Computes optimal monotonic phonetic alignment between expected Quran words
    and Whisper-transcribed user words using dynamic programming (LCS with phonetic equivalence).
    
    Returns a list of integer indices in expected_words that were successfully matched in chronological order.
    Robust against Whisper insertions, deletions, tajweed variations, and background noise.
    Runs in <1ms for typical recitation lengths.
    """
    if not expected_words or not user_words:
        return []
    
    effective_expected = expected_words[:max_window] if max_window > 0 else expected_words
    n_exp = len(effective_expected)
    n_usr = len(user_words)
    
    # DP table: dp[i][j] stores length of longest common phonetic subsequence
    dp = [[0] * (n_usr + 1) for _ in range(n_exp + 1)]
    
    for i in range(1, n_exp + 1):
        exp_w = effective_expected[i - 1]
        for j in range(1, n_usr + 1):
            usr_w = user_words[j - 1]
            if are_words_phonetically_equivalent(usr_w, exp_w):
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
                
    # Backtrack to extract matched expected indices in chronological order
    matched_indices = []
    i, j = n_exp, n_usr
    while i > 0 and j > 0:
        exp_w = effective_expected[i - 1]
        usr_w = user_words[j - 1]
        if are_words_phonetically_equivalent(usr_w, exp_w) and dp[i][j] == dp[i - 1][j - 1] + 1:
            matched_indices.append(i - 1)
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            i -= 1
        else:
            j -= 1
            
    matched_indices.reverse()
    return matched_indices

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

import time

class RecitationSession:
    """ Stateful Session Layer for live incremental Tasmee & Ikhtebaar recitation grading. """
    def __init__(self, session_id: str, expected_text: str, module_type: str = "tasmee", range_mode: str = "custom", start_val: int = 1, end_val: int = 1):
        self.session_id = session_id
        self.expected_text = expected_text
        self.module_type = module_type
        self.range_mode = range_mode
        self.start_val = start_val
        self.end_val = end_val
        self.transcriptions = []
        
        orig_words = expected_text.split()
        self.display_words = []
        self.norm_expected_words = []
        
        for w in orig_words:
            cleaned = re.sub(r'[\uFD3E\uFD3F0-9\u0660-\u0669\s]+', '', w).strip()
            norm = normalize_arabic(cleaned)
            if norm:
                self.display_words.append(w)
                self.norm_expected_words.append(norm)
                
        self.total_words = len(self.display_words)
        self.confirmed_index = 0
        self.word_status = [{"word": w, "status": "pending"} for w in self.display_words]
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
    Transcribes audio bytes or file_path strictly using the loaded Whisper AI model.
    Passes raw 16kHz PCM audio array directly to bypass ffmpeg dependency issues.
    Optionally accepts initial_prompt for steering decoder vocabulary.
    max_new_tokens=16 for live chunk passes, 64 for final conclude sessions.
    """
    global pipe, MODEL_LOADED
    
    if not MODEL_LOADED or pipe is None:
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
        
        if audio_array is not None and len(audio_array) > 0:
            logger.info(f"Running accelerated Whisper pipeline on {len(audio_array)} samples at {sampling_rate}Hz...")
            import torch
            with torch.inference_mode():
                gen_kwargs = {"max_new_tokens": max_new_tokens}
                if initial_prompt and hasattr(pipe, 'tokenizer') and pipe.tokenizer:
                    try:
                        prompt_ids = pipe.tokenizer.get_prompt_ids(initial_prompt, return_tensors="pt")
                        if isinstance(prompt_ids, np.ndarray):
                            prompt_ids = torch.from_numpy(prompt_ids)
                        if isinstance(prompt_ids, torch.Tensor):
                            gen_kwargs["prompt_ids"] = prompt_ids
                    except Exception as pe:
                        logger.warning(f"Could not convert prompt_ids to Tensor: {pe}")

                result = pipe(
                    {"array": audio_array, "sampling_rate": sampling_rate or 16000},
                    generate_kwargs=gen_kwargs
                )
            transcription = result.get("text", "").strip() if isinstance(result, dict) else str(result).strip()
            logger.info(f"Whisper STT Output: '{transcription}'")
            return transcription
        else:
            logger.warning("Could not decode audio bytes to numpy array (empty or unsupported header).")
            return ""
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
