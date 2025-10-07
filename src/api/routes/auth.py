from fastapi import APIRouter, Depends, Response, HTTPException, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from src.api.schemas import LoginRequest, RegisterRequest, UserResponse
from src.api.dependencies import get_session
from src.api.auth.password import hash_password, verify_password
from src.api.auth.jwt import create_access_token
from src.api.auth.session import create_session, delete_session
from src.db.models import User
from src.db.repositories import UserRepository

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    request: RegisterRequest,
    session: AsyncSession = Depends(get_session)
):
    """Register new user or set password for existing unverified user"""
    repo = UserRepository(session)
    existing_user = await repo.get_by_email(request.email)
    
    if existing_user:
        if existing_user.is_verified:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # User exists but unverified - allow setting password
        existing_user.password_hash = hash_password(request.password)
        existing_user.name = request.name
        await session.commit()
        await session.refresh(existing_user)
        
        return existing_user
    
    # Create new user
    user = User(
        email=request.email,
        name=request.name,
        password_hash=hash_password(request.password),
        is_verified=False
    )
    user = await repo.create(user)
    await session.commit()
    await session.refresh(user)
    
    return user


@router.post("/login")
async def login(
    request: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """Login with email and password (returns JWT and sets session cookie)"""
    repo = UserRepository(session)
    user = await repo.get_by_email(request.email)
    
    if not user or not user.password_hash or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT token
    access_token = create_access_token(user)
    
    # Create session cookie
    session_id = create_session(user)
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=7 * 24 * 60 * 60  # 7 days
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": 3600
    }


@router.post("/logout")
async def logout(
    response: Response,
    session_id: Optional[str] = Cookie(default=None)
):
    """Logout (clear session cookie)"""
    if session_id:
        delete_session(session_id)
        response.delete_cookie("session_id")
    
    return {"success": True, "message": "Logged out successfully"}
