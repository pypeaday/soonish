"""
Main application module for Soonish.
"""
from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from datetime import datetime
from soonish.database import init_db, get_session
from soonish.routers import events, auth
from soonish.auth import get_current_user
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from soonish.config import Settings
from sqlalchemy.ext.asyncio import AsyncSession
import json
from typing import Optional
import uvicorn

app = FastAPI()
settings = Settings()

# Add session middleware for OAuth
app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_path = Path(__file__).parent / "static"
static_path.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")

# Setup templates with custom context
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))

def datetime_handler(x):
    if isinstance(x, datetime):
        return x.isoformat()

templates.env.globals.update({
    "now": datetime.now,
    "year": datetime.now().year,
    "json": lambda x: json.dumps(x, default=datetime_handler)
})

async def get_optional_user(
    request: Request,
    session: AsyncSession = Depends(get_session)
) -> Optional[dict]:
    """Get the current user if authenticated, otherwise return None."""
    try:
        return await get_current_user(request, session)
    except HTTPException:
        return None

# Include routers
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])
app.include_router(auth.router, tags=["auth"])  # Auth router has its own prefix

@app.get("/")
async def index(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    """Render the index page."""
    user = await get_optional_user(request, session)
    return templates.TemplateResponse("index.html", {
        "request": request,
        "user": user
    })

@app.get("/events/new")
async def new_event(
    request: Request,
    current_user=Depends(get_current_user)
):
    """Render the new event form."""
    return templates.TemplateResponse("events/new.html", {
        "request": request,
        "user": current_user
    })

@app.get("/events/{event_id}/edit")
async def edit_event(
    request: Request,
    event_id: int,
    current_user=Depends(get_current_user)
):
    """Render the edit event form."""
    return templates.TemplateResponse("events/edit.html", {
        "request": request,
        "event_id": event_id,
        "user": current_user
    })

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    await init_db()

@app.get("/api/v1/")
async def root():
    """Root endpoint returning application status."""
    return {"status": "running", "app": "soonish"}

if __name__ == "__main__":
    uvicorn.run("soonish.main:app", host="0.0.0.0", port=8000, reload=True)
