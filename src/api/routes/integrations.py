from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_current_user, get_session as get_db
from src.api.schemas import IntegrationCreateRequest, IntegrationResponse
from src.db.models import User
from src.db.repositories import IntegrationRepository
from src.activities.notifications import send_notification

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    request: IntegrationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new notification integration (or update if exists)
    
    Uses get_or_create to prevent duplicates based on (user_id, name, tag).
    If integration exists, updates the apprise_url.
    """
    repo = IntegrationRepository(db)
    
    # Use get_or_create to prevent duplicates
    integration, created = await repo.get_or_create(
        user_id=current_user.id,
        name=request.name,
        apprise_url=request.apprise_url,
        tag=request.tag
    )
    
    await db.commit()
    await db.refresh(integration)
    
    return integration


@router.get("", response_model=list[IntegrationResponse])
async def list_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List user's integrations"""
    repo = IntegrationRepository(db)
    integrations = await repo.get_by_user(current_user.id)
    return integrations


@router.get("/{integration_id}", response_model=IntegrationResponse)
async def get_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get integration by ID"""
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return integration


@router.patch("/{integration_id}", response_model=IntegrationResponse)
async def update_integration(
    integration_id: int,
    is_active: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update integration (activate/deactivate)"""
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update
    integration.is_active = is_active
    await db.commit()
    await db.refresh(integration)
    
    return integration


@router.post("/{integration_id}/test")
async def test_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a test notification to this integration"""
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Send test notification
    try:
        result = await send_notification(
            user_id=current_user.id,
            title="Test Notification",
            body=f"This is a test notification from your '{integration.name}' integration.",
            level="info",
            tags=[integration.tag]  # Filter by this integration's tag
        )
        
        return {
            "success": True,
            "message": "Test notification sent",
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )


@router.delete("/{integration_id}", status_code=204)
async def delete_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete an integration"""
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete
    await db.delete(integration)
    await db.commit()
