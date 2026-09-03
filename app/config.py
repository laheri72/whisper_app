import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

class Settings:
    PROJECT_NAME: str = "Whisper Quran Platform"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-quran-key-2026-production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./quran_platform.db")
    
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    LOCAL_MODEL_DIR: str = os.path.join(BASE_DIR, "models", "whisper-base-ar-quran-ct2")
    WHISPER_MODEL_NAME: str = os.getenv("WHISPER_MODEL_NAME", "tarteel-ai/whisper-base-ar-quran")
    
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    USE_STUB_IF_NO_TRANSFORMERS: bool = True

settings = Settings()
