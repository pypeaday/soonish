"""
Authentication routes for Soonish application.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from datetime import timedelta
from pathlib import Path
import httpx

from soonish.database import get_session
from soonish.models import User
from soonish.auth import create_access_token, get_password_hash, pwd_context
from soonish.config import Settings

settings = Settings()
router = APIRouter(prefix="/auth")

# Setup templates
templates = Jinja2Templates(directory=str(Path(__file__).parent.parent / "templates"))

# OAuth setup
config = Config(".env")
oauth = OAuth(config)

# GitHub OAuth setup
if settings.github_client_id and settings.github_client_secret:
    oauth.register(
        name="github",
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
        access_token_url="https://github.com/login/oauth/access_token",
        access_token_params=None,
        authorize_url="https://github.com/login/oauth/authorize",
        authorize_params=None,
        api_base_url="https://api.github.com/",
        client_kwargs={
            "scope": "user:email",
            "token_endpoint_auth_method": "client_secret_post",
            "token_placement": "header",
        },
    )

# Google OAuth setup
if settings.google_client_id and settings.google_client_secret:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "prompt": "select_account"},
    )


@router.get("/login")
async def login_page(request: Request):
    """Render login page with OAuth options."""
    return templates.TemplateResponse(
        "auth/login.html",
        {
            "request": request,
            "github_enabled": bool(settings.github_client_id),
            "google_enabled": bool(settings.google_client_id),
            "error": request.query_params.get("error"),
        },
    )


@router.get("/register")
async def register_page(request: Request):
    """Render registration page."""
    return templates.TemplateResponse(
        "auth/register.html",
        {
            "request": request,
            "error": request.query_params.get("error"),
        },
    )


@router.post("/register")
async def register(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Handle registration form submission."""
    # Check if user already exists
    result = await session.execute(select(User).filter(User.email == email))
    if result.scalar_one_or_none():
        return templates.TemplateResponse(
            "auth/register.html",
            {
                "request": request,
                "error": "Email already registered",
            },
            status_code=400,
        )

    # Create new user
    user = User(email=email, name=name)
    session.add(user)
    await session.commit()

    # Log user in
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    response = RedirectResponse(url="/", status_code=303)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=True,
    )
    return response


@router.post("/login")
async def login(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    """Handle login form submission."""
    # Check user credentials
    result = await session.execute(select(User).filter(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        return templates.TemplateResponse(
            "auth/login.html",
            {
                "request": request,
                "error": "Invalid email or password",
                "github_enabled": bool(settings.github_client_id),
                "google_enabled": bool(settings.google_client_id),
            },
            status_code=400,
        )

    # Temporarily skip password verification until we add password_hash field

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    response = RedirectResponse(url="/", status_code=303)
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=True,
    )
    return response


@router.get("/login/github")
async def github_login(request: Request):
    """Initiate GitHub OAuth flow."""
    if not settings.github_client_id:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")
    redirect_uri = "https://soonish.paynepride.com/auth/github/callback"
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/login/google")
async def google_login(request: Request):
    """Initiate Google OAuth flow."""
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    redirect_uri = "https://soonish.paynepride.com/auth/google/callback"
    try:
        return await oauth.google.authorize_redirect(
            request, redirect_uri, prompt="select_account"
        )
    except Exception as e:
        print(f"Error in Google login: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/github/callback")
async def github_callback(
    request: Request, session: AsyncSession = Depends(get_session)
):
    """Handle GitHub OAuth callback."""
    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get("user", token=token)
    profile = resp.json()

    # Get user's email
    emails = await oauth.github.get("user/emails", token=token)
    primary_email = next(
        (email for email in emails.json() if email["primary"]), emails.json()[0]
    )["email"]

    # Find or create user
    result = await session.execute(
        select(User).filter(User.oauth_id == str(profile["id"]))
    )
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=primary_email,
            name=profile["name"] or profile["login"],
            avatar_url=profile["avatar_url"],
            oauth_provider="github",
            oauth_id=str(profile["id"]),
        )
        session.add(user)
        await session.commit()

    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    response = RedirectResponse(url="/")
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=True,
    )
    return response


@router.get("/google/callback")
async def google_callback(
    request: Request, session: AsyncSession = Depends(get_session)
):
    """Handle Google OAuth callback."""
    try:
        token = await oauth.google.authorize_access_token(request)
        print("Token received:", token.keys())  # Debug log

        # Get user info directly from Google's userinfo endpoint
        headers = {"Authorization": f'Bearer {token["access_token"]}'}
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo", headers=headers
            )
            user_info = resp.json()
            print("User info received:", user_info.keys())  # Debug log

        if not user_info or "sub" not in user_info:
            raise HTTPException(
                status_code=400, detail="Failed to get user info from Google"
            )

        # Find or create user
        result = await session.execute(
            select(User).filter(User.oauth_id == str(user_info["sub"]))
        )
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                email=user_info["email"],
                name=user_info.get("name", user_info["email"]),
                avatar_url=user_info.get("picture"),
                oauth_provider="google",
                oauth_id=str(user_info["sub"]),
            )
            session.add(user)
            await session.commit()

        # Create access token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={"sub": user.email}, expires_delta=access_token_expires
        )

        response = RedirectResponse(url="/")
        response.set_cookie(
            key="access_token",
            value=f"Bearer {access_token}",
            httponly=True,
            max_age=settings.access_token_expire_minutes * 60,
            samesite="lax",
            secure=True,
        )
        return response

    except Exception as e:
        print(f"Error in Google callback: {str(e)}")
        if "token" in locals():
            print("Token data:", token)
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/logout")
async def logout():
    """Log out the current user."""
    response = RedirectResponse(url="/")
    response.delete_cookie("access_token")
    return response
