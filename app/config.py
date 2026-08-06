import os

class Settings:
    PROJECT_NAME: str = "Whisper Quran Platform"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-quran-key-2026-production")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./quran_platform.db")
    WHISPER_MODEL_NAME: str = os.getenv("WHISPER_MODEL_NAME", "tarteel-ai/whisper-base-ar-quran")
    USE_STUB_IF_NO_TRANSFORMERS: bool = True

settings = Settings()
