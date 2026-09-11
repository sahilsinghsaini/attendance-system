from datetime import datetime, timedelta, timezone
from argon2 import PasswordHasher
from jose import jwt
from .config import settings

ALGORITHM = "HS256"
ph = PasswordHasher()

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    try:
        return ph.verify(hashed, password)
    except Exception:
        return False

def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "type": "access", "iat": now, "exp": now + timedelta(minutes=settings.access_token_minutes)}, settings.jwt_secret, algorithm=ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "type": "refresh", "iat": now, "exp": now + timedelta(days=settings.refresh_token_days)}, settings.jwt_secret, algorithm=ALGORITHM)

def decode_token(token: str, expected_type="access"):
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    if payload.get("type") != expected_type:
        raise ValueError("Invalid token type")
    return payload
