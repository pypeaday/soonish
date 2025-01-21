"""
Main application module for Soonish.

This module initializes the FastAPI application, sets up middleware,
and configures the main application routes.
"""

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from fastapi.openapi.utils import get_openapi
from pathlib import Path
from datetime import datetime
from soonish.database import init_db, get_session
from soonish.routers import events, auth, categories
from soonish.auth import get_current_user
from soonish.dependencies import redirect_to_landing, login_required
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from soonish.config import Settings
from soonish.middleware import RateLimitMiddleware, RequestSizeMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
import json
from typing import Optional
import uvicorn


def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Soonish API",
        version="1.0.0",
        description="""
        Event management system API with categories and user management.
        
        ## Features
        
        * OAuth2 authentication with GitHub and Google
        * Event management with recurring events support
        * Category organization with color coding
        * User-specific data isolation
        
        ## Rate Limiting
        
        The API is rate limited to 100 requests per hour per IP address.
        Exceeding this limit will result in a 429 Too Many Requests response.
        
        ## Authentication
        
        Most endpoints require authentication. Use the /auth endpoints to
        authenticate via GitHub or Google OAuth.
        """,
        routes=app.routes,
    )

    # Custom extension to add security schemes
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2": {
            "type": "oauth2",
            "flows": {
                "authorizationCode": {
                    "authorizationUrl": "/auth/login",
                    "scopes": {
                        "user": "Read user information",
                        "email": "Read user email",
                    },
                }
            },
        }
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app = FastAPI(
    docs_url="/api/docs", redoc_url="/api/redoc", openapi_url="/api/openapi.json"
)
app.openapi = custom_openapi
settings = Settings()

# Add middleware in order of execution
app.add_middleware(RequestSizeMiddleware, max_size=settings.max_request_size)

app.add_middleware(
    RateLimitMiddleware,
    rate_limit=settings.rate_limit_requests,
    window_size=settings.rate_limit_window,
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key,
    same_site="lax",
    https_only=True,
    max_age=3600,  # 1 hour
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins if settings.cors_origins else ["*"],
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)

# Add exception handlers
app.add_exception_handler(HTTPException, redirect_to_landing)

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Setup templates with custom context
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))


def datetime_handler(x):
    if isinstance(x, datetime):
        return x.isoformat()


templates.env.globals.update(
    {
        "now": datetime.now,
        "year": datetime.now().year,
        "json": lambda x: json.dumps(x, default=datetime_handler),
    }
)


async def get_optional_user(
    request: Request, session: AsyncSession = Depends(get_session)
) -> Optional[dict]:
    """Get the current user if authenticated, otherwise return None."""
    try:
        return await get_current_user(request, session)
    except HTTPException:
        return None


# Include routers
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["categories"])
app.include_router(auth.router, tags=["auth"])  # Auth router has its own prefix


@app.get("/")
async def index(request: Request, session: AsyncSession = Depends(get_session)):
    """Render either the landing page or dashboard based on authentication status."""
    user = await get_optional_user(request, session)

    if user is None:
        return templates.TemplateResponse(
            "landing.html", {"request": request, "user": None}
        )

    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "user": user}
    )


@app.get("/dashboard")
@login_required
async def dashboard(request: Request, current_user=Depends(get_current_user)):
    """Render the dashboard page. Requires authentication."""
    return templates.TemplateResponse(
        "dashboard.html", {"request": request, "user": current_user}
    )


@app.get("/events/new")
@login_required
async def new_event(request: Request, current_user=Depends(get_current_user)):
    """Render the new event form."""
    return templates.TemplateResponse(
        "events/new.html", {"request": request, "user": current_user}
    )


@app.get("/events/{event_id}/edit")
@login_required
async def edit_event(
    request: Request, event_id: int, current_user=Depends(get_current_user)
):
    """Render the edit event form."""
    return templates.TemplateResponse(
        "events/edit.html",
        {"request": request, "event_id": event_id, "user": current_user},
    )


@app.on_event("startup")
async def startup_event():
    """Initialize the database on startup."""
    await init_db()


@app.get("/settings")
@login_required
async def settings(request: Request, current_user=Depends(get_current_user)):
    """Render the settings page."""
    return templates.TemplateResponse(
        "settings.html", {"request": request, "user": current_user}
    )


@app.get("/health")
async def root():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run("soonish.main:app", host="0.0.0.0", port=8000, reload=True)
