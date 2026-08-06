from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    first_login = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    records = relationship("RecitationRecord", back_populates="user", cascade="all, delete-orphan")

class RecitationRecord(Base):
    __tablename__ = "recitation_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    mode = Column(String, nullable=False) # 'tasmee' or 'ikhtebaar'
    target_ref = Column(String, nullable=False) # e.g. "Page 1" or "Surah 1"
    expected_text = Column(Text, nullable=False)
    user_transcription = Column(Text, nullable=True)
    accuracy_score = Column(Float, default=0.0)
    correct_words = Column(Integer, default=0)
    total_words = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="records")
