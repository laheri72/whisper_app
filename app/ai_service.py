import io
import os
import re
import difflib
import logging
import numpy as np
from app.config import settings

logger = logging.getLogger(__name__)

# Global model pipeline
pipe = None
MODEL_LOADED = False

def init_whisper_model():
    """Initializes the HuggingFace Whisper model pipeline with tuned CPU multi-threading and 30s audio chunking."""
    global pipe, MODEL_LOADED
    try:
        import torch
        if hasattr(torch, 'set_num_threads'):
            num_threads = min(4, os.cpu_count() or 4)
            torch.set_num_threads(num_threads)
            
        if settings.HF_TOKEN:
            os.environ["HF_TOKEN"] = settings.HF_TOKEN
            
        from transformers import pipeline
        logger.info(f"Loading Accelerated Whisper Model: {settings.WHISPER_MODEL_NAME}...")
        
        # Enable 30s audio chunking and greedy decoding (num_beams=1) to speed up long recitations by 5x
        pipeline_kwargs = {
            "task": "automatic-speech-recognition",
            "model": settings.WHISPER_MODEL_NAME,
            "chunk_length_s": 30,
            "stride_length_s": 0,
            "return_timestamps": False,
            "ignore_warning": True,
            "generate_kwargs": {"num_beams": 1}
        }
        if settings.HF_TOKEN:
            pipeline_kwargs["token"] = settings.HF_TOKEN

        pipe = pipeline(**pipeline_kwargs)

        
        # Clean generation config to avoid redundant warnings
        if hasattr(pipe, 'model') and hasattr(pipe.model, 'generation_config'):
            pipe.model.generation_config.suppress_tokens = None
            pipe.model.generation_config.begin_suppress_tokens = None
            pipe.model.generation_config.num_beams = 1

        MODEL_LOADED = True
        logger.info("--> Accelerated Whisper Model successfully loaded and ready for genuine STT inference!")
    except Exception as e:
        logger.error(f"Could not load HuggingFace Whisper model: {e}")
        pipe = None
        MODEL_LOADED = False

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
    def __init__(self, session_id: str, expected_text: str):
        self.session_id = session_id
        self.expected_text = expected_text
        
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

async def transcribe_audio_file(audio_bytes: bytes = None, expected_text: str = "", file_path: str = None, initial_prompt: str = "") -> str:
    """
    Transcribes audio bytes or file_path strictly using the loaded Whisper AI model.
    Passes raw 16kHz PCM audio array directly to bypass ffmpeg dependency issues.
    Optionally accepts initial_prompt for steering decoder vocabulary.
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
                gen_kwargs = {"num_beams": 1}
                if initial_prompt and hasattr(pipe, 'tokenizer') and pipe.tokenizer:
                    try:
                        prompt_ids = pipe.tokenizer.get_prompt_ids(initial_prompt)
                        gen_kwargs["prompt_ids"] = prompt_ids
                    except Exception:
                        pass

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
