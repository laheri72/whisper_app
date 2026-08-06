import hashlib
import os

def hash_password(password: str) -> str:
    """Hashes a password using SHA-256 with a salt."""
    salt = "quran_platform_salt_2026"
    return hashlib.sha256((password + salt).encode('utf-8')).hexdigest()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash."""
    return hash_password(plain_password) == hashed_password
