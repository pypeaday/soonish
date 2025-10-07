from datetime import datetime, timedelta, timezone
import secrets
from src.db.models import User

# In-memory session store (use Redis in production)
_sessions: dict[str, dict] = {}


def create_session(user: User) -> str:
    """Create a new session for a user"""
    session_id = secrets.token_urlsafe(32)
    
    _sessions[session_id] = {
        "user_id": user.id,
        "email": user.email,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    return session_id


def get_session(session_id: str) -> dict | None:
    """Get session data if valid"""
    session = _sessions.get(session_id)
    if not session:
        return None
    
    if datetime.now(timezone.utc) > session["expires_at"]:
        del _sessions[session_id]
        return None
    
    return session


def delete_session(session_id: str):
    """Delete a session"""
    _sessions.pop(session_id, None)
