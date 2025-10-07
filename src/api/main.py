from fastapi import FastAPI, Depends
from src.api.routes import health, auth, events
from src.api.dependencies import get_current_user
from src.api.schemas import UserResponse
from src.db.models import User

app = FastAPI(
    title="Soonish API",
    description="Event notification service",
    version="0.1.0"
)

# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(events.router)

@app.get("/")
async def root():
    return {"message": "Soonish API - see /docs for API documentation"}


@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info"""
    return current_user
