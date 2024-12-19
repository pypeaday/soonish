from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from soonish.database import get_session
from soonish.models import Event as EventModel, User
from soonish.schemas import Event, EventCreate, EventUpdate
from soonish.auth import get_current_user
from soonish.dependencies import login_required

router = APIRouter()

@router.post("/", response_model=Event)
@login_required
async def create_event(
    request: Request,
    event: EventCreate,
    session: AsyncSession = Depends(get_session)
):
    current_user = await get_current_user(request, session)
    print(f"Creating event for user {current_user.email}: {event.model_dump()}")
    db_event = EventModel(**event.model_dump(), user_id=current_user.id)
    session.add(db_event)
    await session.commit()
    await session.refresh(db_event)
    print(f"Created event with ID {db_event.id}")
    return db_event

@router.get("/", response_model=List[Event])
@login_required
async def list_events(
    request: Request,
    session: AsyncSession = Depends(get_session)
):
    current_user = await get_current_user(request, session)
    print(f"Fetching events for user {current_user.email}")
    result = await session.execute(
        select(EventModel).filter(EventModel.user_id == current_user.id)
    )
    events = result.scalars().all()
    print(f"Found {len(events)} events")
    return events

@router.get("/{event_id}", response_model=Event)
@login_required
async def get_event(
    request: Request,
    event_id: int,
    session: AsyncSession = Depends(get_session)
):
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel).filter(
            EventModel.id == event_id,
            EventModel.user_id == current_user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.put("/{event_id}", response_model=Event)
@login_required
async def update_event(
    request: Request,
    event_id: int,
    event_update: EventUpdate,
    session: AsyncSession = Depends(get_session)
):
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel).filter(
            EventModel.id == event_id,
            EventModel.user_id == current_user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)
    
    await session.commit()
    await session.refresh(event)
    return event

@router.delete("/{event_id}")
@login_required
async def delete_event(
    request: Request,
    event_id: int,
    session: AsyncSession = Depends(get_session)
):
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel).filter(
            EventModel.id == event_id,
            EventModel.user_id == current_user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await session.delete(event)
    await session.commit()
    return {"message": "Event deleted"}
