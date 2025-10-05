from fastapi import FastAPI
from src.api.routes import health

app = FastAPI(
    title="Soonish API",
    description="Event notification service",
    version="0.1.0"
)

# Include routers
app.include_router(health.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Soonish API - see /docs for API documentation"}
