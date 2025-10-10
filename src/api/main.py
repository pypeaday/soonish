from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from src.api.routes import health, auth, events, subscriptions, integrations, web
from src.api.schemas import UserResponse
from src.api.dependencies import get_current_user
from src.db.models import User
import os

# TODO Phase 15: Enable rate limiting
# from src.api.middleware.rate_limit import rate_limit_middleware

app = FastAPI(
    title="Soonish API",
    description="Event notification service",
    version="0.1.0"
)

# TODO Phase 15: Uncomment to enable rate limiting with IP logging
# app.middleware("http")(rate_limit_middleware)

# Mount static files
website_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "website")
app.mount("/static", StaticFiles(directory=website_dir), name="static")

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(web.router)
app.include_router(events.router)
app.include_router(subscriptions.router)
app.include_router(integrations.router)

@app.get("/")
async def root():
    """Serve the login page"""
    return FileResponse(os.path.join(website_dir, "login.html"))

@app.get("/dashboard")
async def dashboard():
    """Serve the dashboard page"""
    return FileResponse(os.path.join(website_dir, "dashboard.html"))

@app.get("/integrations")
async def integrations_page():
    """Serve the integrations page"""
    return FileResponse(os.path.join(website_dir, "integrations.html"))

@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info"""
    return current_user
