from fastapi import APIRouter
from datetime import datetime, timezone
from fastapi import Depends
from temporalio.client import Client
from src.api.schemas import HealthResponse
from src.api.dependencies import get_temporal_client

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check(
    temporal_client: Client = Depends(get_temporal_client)
):
    try:
        await temporal_client.workflow.get_system_info()
        temporal_status = "healthy"
    except Exception:
        temporal_status = "unhealthy"
    
    return HealthResponse(
        status="healthy" if temporal_status == "healthy" else "unhealthy",
        timestamp=datetime.now(timezone.utc),
        version="0.1.0",
        temporal=temporal_status
    )
