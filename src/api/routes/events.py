from fastapi import APIRouter, Depends, HTTPException, Request as FastAPIRequest
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio import workflow
from temporalio.client import Client
from src.api.schemas import EventCreateRequest, EventUpdateRequest, EventResponse, InviteToEventRequest, InvitationResponse
from src.api.dependencies import get_session, get_current_user, get_current_user_optional, get_temporal_client
from src.db.models import Event, User
from src.db.repositories import EventRepository, EventInvitationRepository
from src.api.services.email import send_invitation_email
from src.api.templates import render_template
from typing import Optional
from src.workflows.event import EventWorkflow
from src.config import get_settings
from datetime import datetime, timezone as tz
import uuid

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    http_request: FastAPIRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    """Create a new event (authenticated users only)"""
    # Handle both form data and JSON
    content_type = http_request.headers.get("content-type", "")
    
    if "application/json" in content_type:
        data = await http_request.json()
        request = EventCreateRequest(**data)
    else:
        # Form data - convert datetime-local format to timezone-aware datetime
        form = await http_request.form()
        start_dt = datetime.fromisoformat(form.get("start_date"))
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=tz.utc)
        
        end_dt = None
        if form.get("end_date"):
            end_dt = datetime.fromisoformat(form.get("end_date"))
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=tz.utc)
        
        request = EventCreateRequest(
            name=form.get("name"),
            description=form.get("description"),
            start_date=start_dt,
            end_date=end_dt,
            timezone=form.get("timezone", "UTC"),
            location=form.get("location"),
            is_public=form.get("is_public", "true").lower() == "true"
        )
    settings = get_settings()
    
    # Generate workflow ID
    workflow_id = f"event-{uuid.uuid4()}"
    
    # Create event
    repo = EventRepository(session)
    event = Event(
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        end_date=request.end_date,
        timezone=request.timezone,
        location=request.location,
        is_public=request.is_public,
        temporal_workflow_id=workflow_id,
        organizer_user_id=current_user.id
    )
    event = await repo.create(event)
    await session.flush()
    
    # Start Temporal workflow
    event_data = {
        "name": event.name,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "location": event.location
    }
    
    try:
        await temporal_client.start_workflow(
            EventWorkflow.run,
            args=[event.id, event_data],
            id=workflow_id,
            task_queue=settings.temporal_task_queue
        )
    except Exception as e:
        # Event exists but workflow failed - log and return error
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Event created but workflow failed to start: {str(e)}"
        )

    # Commit and refresh
    await session.commit()
    await session.refresh(event)
    
    return event


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session)
):
    """Get event by ID (public events or authorized users)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization for private events
    if not event.is_public:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Check if user is organizer or subscriber
        is_authorized = await repo.can_view_event(event_id, current_user.id)
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Not authorized to view this event")
    
    return event


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    request: EventUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    """Update event (organizer only)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this event")
    
    # Update fields
    if request.name is not None:
        event.name = request.name
    if request.description is not None:
        event.description = request.description
    if request.start_date is not None:
        event.start_date = request.start_date
    if request.end_date is not None:
        event.end_date = request.end_date
    if request.location is not None:
        event.location = request.location
    
    await session.commit()
    await session.refresh(event)
    
    # Signal workflow about update
    try:
        handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
        await handle.signal(EventWorkflow.event_updated, {
            "name": event.name,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location
        })
    except Exception:
        workflow.logger.warning("Failed to signal workflow for event %s", event_id)
        # Non-critical if signal fails - workflow will use stale data
        pass
    
    return event


@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    """Delete event (organizer only)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    
    # Cancel workflow before deleting event
    try:
        handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
        await handle.signal(EventWorkflow.cancel_event)
    except Exception:
        # Continue with deletion even if cancellation fails
        workflow.logger.warning("Failed to cancel workflow for event %s", event_id)
        pass
    
    await repo.delete(event)
    await session.commit()
    
    return None


@router.get("")
async def list_events(
    current_user: Optional[User] = Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    html: bool = False
):
    """List events (public + user's private events). Set html=true for HTML response."""
    repo = EventRepository(session)
    
    if current_user:
        # Get public events + user's private events
        events = await repo.list_visible_for_user(
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
    else:
        # Get only public events
        events = await repo.list_public_events(skip=skip, limit=limit)
    
    # Return HTML if requested
    if html:
        # Annotate events with is_organizer flag for template
        events_with_context = []
        for event in events:
            event_dict = {
                "id": event.id,
                "name": event.name,
                "description": event.description,
                "start_date": event.start_date,
                "location": event.location,
                "is_organizer": current_user and event.organizer_user_id == current_user.id
            }
            events_with_context.append(event_dict)
        
        html_content = render_template("events_list.html", events=events_with_context)
        return HTMLResponse(html_content)
    
    # Return JSON (validate with response_model)
    return [EventResponse.model_validate(event) for event in events]


@router.post("/{event_id}/invite")
async def invite_to_event(
    event_id: int,
    request: InviteToEventRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Invite user to private event (organizer only)"""
    # Get event
    event_repo = EventRepository(session)
    event = await event_repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user is organizer
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can invite")
    
    # Create invitation
    invitation_repo = EventInvitationRepository(session)
    invitation = await invitation_repo.create_invitation(
        event_id=event_id,
        email=request.email,
        invited_by_user_id=current_user.id
    )
    
    await session.commit()
    
    # Send invitation email
    await send_invitation_email(
        email=request.email,
        event_name=event.name,
        organizer_name=current_user.name,
        token=invitation.token
    )
    
    return {
        "success": True,
        "message": f"Invitation sent to {request.email}",
        "invitation_id": invitation.id
    }


@router.get("/{event_id}/invitations", response_model=list[InvitationResponse])
async def list_invitations(
    event_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """List invitations for event (organizer only)"""
    # Check authorization
    event_repo = EventRepository(session)
    event = await event_repo.get_by_id(event_id)
    
    if not event or event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get invitations
    invitation_repo = EventInvitationRepository(session)
    invitations = await invitation_repo.get_by_event(event_id)
    
    # Add is_valid to response
    return [
        InvitationResponse(
            id=inv.id,
            event_id=inv.event_id,
            email=inv.email,
            invited_by_user_id=inv.invited_by_user_id,
            expires_at=inv.expires_at,
            used_at=inv.used_at,
            is_valid=inv.is_valid(),
            created_at=inv.created_at
        )
        for inv in invitations
    ]


@router.delete("/{event_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    event_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Revoke invitation (organizer only)"""
    # Check authorization
    event_repo = EventRepository(session)
    event = await event_repo.get_by_id(event_id)
    
    if not event or event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete invitation
    invitation_repo = EventInvitationRepository(session)
    invitation = await invitation_repo.get_by_id(invitation_id)
    
    if not invitation or invitation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    await session.delete(invitation)
    await session.commit()
