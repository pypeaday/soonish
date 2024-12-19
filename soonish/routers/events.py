from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from soonish.database import get_session
from soonish.models import Event as EventModel
from soonish.schemas import Event, EventCreate, EventUpdate

router = APIRouter()

@router.post("/", response_model=Event)
async def create_event(event: EventCreate, session: AsyncSession = Depends(get_session)):
    db_event = EventModel(**event.model_dump())
    session.add(db_event)
    await session.commit()
    await session.refresh(db_event)
    return db_event

@router.get("/", response_model=List[Event])
async def list_events(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(EventModel))
    events = result.scalars().all()
    return events

@router.get("/{event_id}", response_model=Event)
async def get_event(event_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(EventModel).filter(EventModel.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.put("/{event_id}", response_model=Event)
async def update_event(event_id: int, event_update: EventUpdate, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(EventModel).filter(EventModel.id == event_id))
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
async def delete_event(event_id: int, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(EventModel).filter(EventModel.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await session.delete(event)
    await session.commit()
    return {"message": "Event deleted"}
