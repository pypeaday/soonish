from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client
from fastapi import Depends, HTTPException, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from src.db.session import get_db_session
from src.db.repositories import UserRepository
from src.db.models import User
from src.config import get_settings
from src.api.auth.session import get_session as get_session_data
from src.api.auth.jwt import decode_access_token

security = HTTPBearer(auto_error=False)


# Database dependency
async def get_session() -> AsyncSession:
    """Get database session"""
    async for session in get_db_session():
        yield session


# Temporal client (create once, reuse)
_temporal_client: Client | None = None


async def get_temporal_client() -> Client:
    """Get Temporal client"""
    global _temporal_client
    if _temporal_client is None:
        settings = get_settings()
        _temporal_client = await Client.connect(settings.temporal_url)
    return _temporal_client


# Authentication dependencies
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_id: Optional[str] = Cookie(default=None),
    db_session: AsyncSession = Depends(get_session)
) -> User:
    """
    Get current user from either JWT or session cookie.
    Raises 401 if not authenticated.
    """
    user_id = None
    
    # Try JWT first
    if credentials:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
    
    # Try session cookie
    elif session_id:
        session_data = get_session_data(session_id)
        if session_data:
            user_id = session_data["user_id"]
    
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )
    
    # Load user from database
    repo = UserRepository(db_session)
    user = await repo.get_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_id: Optional[str] = Cookie(default=None),
    db_session: AsyncSession = Depends(get_session)
) -> Optional[User]:
    """
    Get current user if authenticated, otherwise return None.
    Used for endpoints that support both anonymous and authenticated access.
    """
    try:
        return await get_current_user(credentials, session_id, db_session)
    except HTTPException:
        return None
