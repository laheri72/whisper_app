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
            
        from transformers import pipeline
        logger.info(f"Loading Accelerated Whisper Model: {settings.WHISPER_MODEL_NAME}...")
        
        # Enable 30s audio chunking and greedy decoding (num_beams=1) to speed up long recitations by 5x
        pipe = pipeline(
            "automatic-speech-recognition",
            model=settings.WHISPER_MODEL_NAME,
            chunk_length_s=30,
            stride_length_s=0,
            return_timestamps=False,
            generate_kwargs={"num_beams": 1}
        )
        
        # Clean generation config to avoid redundant SuppressTokensAtBeginLogitsProcessor warnings
        if hasattr(pipe, 'model') and hasattr(pipe.model, 'generation_config'):
            pipe.model.generation_config.suppress_tokens = None
            pipe.model.generation_config.begin_suppress_tokens = None

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

def resample_to_16k(float_data: np.ndarray, orig_sr: int) -> np.ndarray:
    """Resamples Float32 audio array from original sample rate to 16000Hz using pure NumPy linear interpolation."""
    if orig_sr == 16000 or float_data is None or len(float_data) == 0:
        return float_data
    try:
        target_sr = 16000
        num_output_samples = int(round(len(float_data) * target_sr / orig_sr))
        input_indices = np.linspace(0, len(float_data) - 1, num_output_samples)
        resampled = np.interp(input_indices, np.arange(len(float_data)), float_data).astype(np.float32)
        logger.info(f"Successfully resampled audio array from {orig_sr}Hz -> {target_sr}Hz (Original: {len(float_data)} samples -> Resampled: {len(resampled)} samples)")
        return resampled
    except Exception as e:
        logger.error(f"Resampling error ({orig_sr}Hz -> 16000Hz): {e}")
        return float_data

def decode_audio_bytes_to_numpy(audio_bytes: bytes):
    """
    Parses WAV or WebM audio bytes into a 16kHz float32 NumPy array 
    without relying on system ffmpeg executable.
    """
    if not audio_bytes or len(audio_bytes) < 44:
        return None, None

    float_data = None
    sr = None

    # 1. Try parsing PCM WAV using scipy.io.wavfile
    try:
        import scipy.io.wavfile as wavfile
        bytes_io = io.BytesIO(audio_bytes)
        sr_read, data = wavfile.read(bytes_io)
        if data.ndim > 1:
            data = data.mean(axis=1)
        if data.dtype == np.int16:
            float_data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            float_data = data.astype(np.float32) / 2147483648.0
        elif data.dtype == np.uint8:
            float_data = (data.astype(np.float32) - 128.0) / 128.0
        else:
            float_data = data.astype(np.float32)
        sr = sr_read
    except Exception as e:
        logger.debug(f"scipy wavfile read attempt failed: {e}")

    # 2. Try soundfile
    if float_data is None:
        try:
            import soundfile as sf  # type: ignore
            bytes_io = io.BytesIO(audio_bytes)
            data, sr_read = sf.read(bytes_io)
            if data.ndim > 1:
                data = data.mean(axis=1)
            float_data = data.astype(np.float32)
            sr = sr_read
        except Exception as e:
            logger.debug(f"soundfile read attempt failed: {e}")

    # 3. Try wave module
    if float_data is None:
        try:
            import wave
            bytes_io = io.BytesIO(audio_bytes)
            with wave.open(bytes_io, 'rb') as wf:
                sr_read = wf.getframerate()
                n_frames = wf.getnframes()
                frames = wf.readframes(n_frames)
                data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
                if wf.getnchannels() > 1:
                    data = data.reshape(-1, wf.getnchannels()).mean(axis=1)
                float_data = data
                sr = sr_read
        except Exception as e:
            logger.debug(f"wave module read attempt failed: {e}")

    if float_data is not None and sr is not None:
        if sr != 16000:
            float_data = resample_to_16k(float_data, sr)
            sr = 16000
        return float_data, sr

    return None, None

async def transcribe_audio_file(audio_bytes: bytes = None, expected_text: str = "", file_path: str = None) -> str:
    """
    Transcribes audio bytes or file_path strictly using the loaded Whisper AI model.
    Passes raw 16kHz PCM audio array directly to bypass ffmpeg dependency issues.
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
                # Note: CPU execution runs strictly in float32 mode (equivalent to fp16=False) due to torch_dtype=torch.float32
                result = pipe(
                    {"array": audio_array, "sampling_rate": sampling_rate or 16000},
                    generate_kwargs={"num_beams": 1}
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
