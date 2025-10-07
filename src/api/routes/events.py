from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio import workflow
from temporalio.client import Client
from src.api.schemas import EventCreateRequest, EventUpdateRequest, EventResponse
from src.api.dependencies import get_session, get_current_user, get_temporal_client
from src.db.models import Event, User
from src.db.repositories import EventRepository
from src.workflows.event import EventWorkflow
from src.config import get_settings
import uuid

router = APIRouter(prefix="/api/events", tags=["events"])


@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    request: EventCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    """Create a new event (authenticated users only)"""
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
    session: AsyncSession = Depends(get_session)
):
    """Get event by ID (public events or organizer)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
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


@router.get("", response_model=list[EventResponse])
async def list_events(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """List all public events"""
    repo = EventRepository(session)
    events = await repo.list_public_events(skip=skip, limit=limit)
    return events
