from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import HTTPException
from fastapi.security import HTTPBearer
from src.config import get_settings
from src.db.models import User

security = HTTPBearer()


def create_access_token(user: User) -> str:
    """Create a JWT access token"""
    settings = get_settings()
    
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "is_verified": user.is_verified,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc)
    }
    
    token = jwt.encode(payload, settings.secret_key, algorithm="HS256")
    return token


def decode_access_token(token: str) -> dict:
    """Decode and validate JWT token"""
    settings = get_settings()
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )
