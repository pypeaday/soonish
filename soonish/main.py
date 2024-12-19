"""
Main application module for Soonish.
"""
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from datetime import datetime
from soonish.database import init_db
from soonish.routers import events
from fastapi.middleware.cors import CORSMiddleware
from soonish.config import Settings
import json
import uvicorn

app = FastAPI()

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

# Include routers
app.include_router(events.router, prefix="/api/v1/events", tags=["events"])

@app.get("/")
async def index(request: Request):
    """Render the index page."""
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/events/new")
async def new_event(request: Request):
    """Render the new event form."""
    return templates.TemplateResponse("events/new.html", {"request": request})

@app.get("/events/{event_id}/edit")
async def edit_event(request: Request, event_id: int):
    """Render the edit event form."""
    return templates.TemplateResponse("events/edit.html", {"request": request, "event_id": event_id})

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
