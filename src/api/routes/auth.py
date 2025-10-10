from fastapi import APIRouter, Depends, Response, HTTPException, Cookie, Request as FastAPIRequest
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from src.api.schemas import (
    LoginRequest, RegisterRequest, UserResponse,
    VerifyEmailRequest, ResendVerificationRequest
)
from src.api.dependencies import get_session
from src.api.auth.password import hash_password, verify_password
from src.api.auth.jwt import create_access_token
from src.api.auth.session import create_session, delete_session
from src.api.auth.verification import create_verification_token, decode_verification_token
from src.api.services.email import send_verification_email, send_welcome_email
from src.db.models import User
from src.db.repositories import UserRepository

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    http_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session)
):
    """Register new user or set password for existing unverified user"""
    # Handle both form data and JSON
    content_type = http_request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        data = await http_request.json()
        request = RegisterRequest(**data)
    else:
        # Form data
        form = await http_request.form()
        request = RegisterRequest(
            email=form.get("email"),
            password=form.get("password"),
            name=form.get("name")
        )
    
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
        
        # Send verification email
        token = create_verification_token(existing_user)
        await send_verification_email(existing_user.email, token)
        
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
    
    # Send verification email
    token = create_verification_token(user)
    await send_verification_email(user.email, token)
    
    return user


@router.post("/login")
async def login(
    http_request: FastAPIRequest,
    response: Response,
    session: AsyncSession = Depends(get_session)
):
    """Login with email and password (returns JWT and sets session cookie)"""
    # Handle both form data and JSON
    content_type = http_request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        data = await http_request.json()
        request = LoginRequest(**data)
    else:
        # Form data
        form = await http_request.form()
        request = LoginRequest(
            email=form.get("email"),
            password=form.get("password")
        )
    
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


@router.api_route("/verify", methods=["GET", "POST"])
async def verify_email(
    http_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session)
):
    """Verify email address with token (supports GET and POST)"""
    # Handle GET request (from email link)
    if http_request.method == "GET":
        token = http_request.query_params.get("token")
        if not token:
            raise HTTPException(status_code=400, detail="Token is required")
        request = VerifyEmailRequest(token=token)
    else:
        # Handle POST with form data or JSON
        content_type = http_request.headers.get("content-type", "")
        
        if "application/json" in content_type:
            data = await http_request.json()
            request = VerifyEmailRequest(**data)
        else:
            # Form data or query params
            form = await http_request.form()
            token = form.get("token")
            if not token:
                # Try query params
                token = http_request.query_params.get("token")
            if not token:
                raise HTTPException(status_code=400, detail="Token is required")
            request = VerifyEmailRequest(token=token)
    
    # Decode and validate token
    payload = decode_verification_token(request.token)
    user_id = payload["user_id"]
    
    # Get user from database
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_verified:
        return {
            "success": True,
            "message": "Email already verified",
            "already_verified": True
        }
    
    # Mark user as verified
    user.is_verified = True
    await session.commit()
    
    # Send welcome email (non-blocking, ignore failures)
    try:
        await send_welcome_email(user.email)
    except Exception:
        pass  # Don't fail verification if welcome email fails
    
    return {
        "success": True,
        "message": "Email verified successfully",
        "already_verified": False
    }


@router.post("/resend-verification")
async def resend_verification(
    http_request: FastAPIRequest,
    session: AsyncSession = Depends(get_session)
):
    """Resend verification email"""
    # Handle both form data and JSON
    content_type = http_request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        data = await http_request.json()
        request = ResendVerificationRequest(**data)
    else:
        # Form data
        form = await http_request.form()
        request = ResendVerificationRequest(email=form.get("email"))
    
    repo = UserRepository(session)
    user = await repo.get_by_email(request.email)
    
    # Don't reveal if email exists (security best practice)
    if not user:
        return {
            "success": True,
            "message": "If the email exists, a verification link has been sent"
        }
    
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    
    # Generate and send new token
    token = create_verification_token(user)
    email_sent = await send_verification_email(user.email, token)
    
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="Failed to send verification email. SMTP not configured."
        )
    
    return {
        "success": True,
        "message": "Verification email sent"
    }
