from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_current_user, get_session as get_db
from src.api.schemas import IntegrationCreateRequest, IntegrationResponse
from src.api.templates import render_template
from src.db.models import User
from src.db.repositories import IntegrationRepository
from src.activities.notifications import send_notification
import json

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    request: IntegrationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create integration with typed config
    
    Users provide integration_type and type-specific config.
    Backend converts to Apprise URL and stores both.
    
    Example for Gotify:
    {
        "name": "My Gotify Server",
        "integration_type": "gotify",
        "config": {
            "server_url": "https://gotify.example.com",
            "token": "AbCdEf123456",
            "priority": "normal"
        },
        "tag": "urgent"
    }
    """
    # Map of supported integration types to their config models and converters
    INTEGRATION_HANDLERS = {
        "gotify": {
            "config_class": "GotifyConfig",
            "converter": "convert_gotify_to_apprise",
        },
        "email": {
            "config_class": "EmailConfig",
            "converter": "convert_email_to_apprise",
        },
        "ntfy": {
            "config_class": "NtfyConfig",
            "converter": "convert_ntfy_to_apprise",
        },
        "discord": {
            "config_class": "DiscordConfig",
            "converter": "convert_discord_to_apprise",
        },
        "slack": {
            "config_class": "SlackConfig",
            "converter": "convert_slack_to_apprise",
        },
    }
    
    # Validate integration type
    if request.integration_type not in INTEGRATION_HANDLERS:
        supported = ", ".join(INTEGRATION_HANDLERS.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported integration type: {request.integration_type}. Supported types: {supported}"
        )
    
    # Convert config to Apprise URL
    try:
        from src.api.integration_schemas import integration_configs
        from src.api.services import integration_converters
        
        handler = INTEGRATION_HANDLERS[request.integration_type]
        
        # Get config class and converter dynamically
        config_class = getattr(integration_configs, handler["config_class"])
        converter_func = getattr(integration_converters, handler["converter"])
        
        # Validate config against schema
        validated_config = config_class(**request.config)
        
        # Convert to Apprise URL
        apprise_url = converter_func(validated_config)
        
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {request.integration_type} configuration: {str(e)}"
        )
    
    # Store original config as encrypted JSON
    config_json = json.dumps(request.config)
    
    # Create integration
    repo = IntegrationRepository(db)
    integration, created = await repo.get_or_create(
        user_id=current_user.id,
        name=request.name,
        apprise_url=apprise_url,
        tag=request.tag
    )
    
    # Set Phase 15 fields
    integration.integration_type = request.integration_type
    integration.config_json = config_json
    
    await db.commit()
    await db.refresh(integration)
    
    return integration


@router.get("")
async def list_integrations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    html: bool = False
):
    """List user's integrations. Set html=true for HTML response."""
    repo = IntegrationRepository(db)
    integrations = await repo.get_by_user(current_user.id)
    
    # Return HTML if requested
    if html:
        html_content = render_template("integrations_list.html", integrations=integrations)
        return HTMLResponse(html_content)
    
    # Return JSON (validate with response_model)
    return [IntegrationResponse.model_validate(integration) for integration in integrations]


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
    title: str | None = None,
    body: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a test notification to this integration
    
    Optional query params:
    - title: Custom notification title (default: "Test Notification")
    - body: Custom notification body (default: auto-generated)
    """
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Use custom or default messages
    notification_title = title or "Test Notification"
    notification_body = body or f"This is a test notification from your '{integration.name}' integration."
    
    # Send test notification
    try:
        result = await send_notification(
            user_id=current_user.id,
            title=notification_title,
            body=notification_body,
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
