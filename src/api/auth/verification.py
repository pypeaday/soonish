"""Email verification token management"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException
from src.config import get_settings
from src.db.models import User


def create_verification_token(user: User) -> str:
    """Create email verification token (24-hour expiry)"""
    settings = get_settings()
    
    payload = {
        "sub": "email_verification",
        "user_id": user.id,
        "email": user.email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24),
        "iat": datetime.now(timezone.utc)
    }
    
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_verification_token(token: str) -> dict:
    """Decode and validate verification token"""
    settings = get_settings()
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        
        if payload.get("sub") != "email_verification":
            raise ValueError("Invalid token type")
        
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid or expired verification token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid verification token: {str(e)}"
        )
