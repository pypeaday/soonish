from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client
from src.db.session import get_db_session
from src.config import get_settings

# Database dependency
async def get_session() -> AsyncSession:
    """Get database session"""
    async for session in get_db_session():
        yield session

# Temporal client (create once, reuse)
_temporal_client: Client | None = None

async def get_temporal_client() -> Client:
    """Get Temporal client"""
    global _temporal_client
    if _temporal_client is None:
        settings = get_settings()
        _temporal_client = await Client.connect(settings.temporal_url)
    return _temporal_client
