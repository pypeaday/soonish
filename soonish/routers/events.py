"""
Events router module for Soonish.

This module handles all event-related API endpoints including CRUD operations,
bulk operations, and filtered queries.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Union
from soonish.database import get_session
from soonish.models import Event as EventModel, User
from soonish.schemas import (
    Event,
    EventCreate,
    EventUpdate,
    BulkEventCreate,
    BulkEventDelete,
    PaginatedEvents,
    EventSort,
    SortOrder,
)
from soonish.auth import get_current_user
from soonish.dependencies import login_required
from datetime import datetime, timedelta

router = APIRouter()


@router.post("/", response_model=Event)
@login_required
async def create_event(
    request: Request, event: EventCreate, session: AsyncSession = Depends(get_session)
):
    """
    Create a new event.

    Parameters:
    - event: Event data including title, description, target date, etc.

    Returns:
    - Event: Created event object

    Raises:
    - 401: Unauthorized
    - 422: Validation Error
    """
    current_user = await get_current_user(request, session)
    db_event = EventModel(**event.model_dump(), user_id=current_user.id)
    session.add(db_event)
    await session.commit()
    await session.refresh(db_event)
    return db_event


@router.post("/bulk", response_model=List[Event])
@login_required
async def bulk_create_events(
    request: Request,
    events: BulkEventCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Create multiple events in a single request.

    Parameters:
    - events: List of event data to create

    Returns:
    - List[Event]: List of created event objects

    Raises:
    - 401: Unauthorized
    - 422: Validation Error
    """
    current_user = await get_current_user(request, session)
    db_events = [
        EventModel(**event.model_dump(), user_id=current_user.id)
        for event in events.events
    ]
    session.add_all(db_events)
    await session.commit()
    for event in db_events:
        await session.refresh(event)
    return db_events


@router.get("/", response_model=Union[PaginatedEvents, List[Event]])
@login_required
async def list_events(
    request: Request,
    session: AsyncSession = Depends(get_session),
    paginate: bool = Query(False, description="Whether to return paginated results"),
    page: int = Query(1, ge=1, description="Page number"),
    size: int = Query(10, ge=1, le=100, description="Items per page"),
    sort_by: EventSort = Query(EventSort.target_date, description="Field to sort by"),
    order: SortOrder = Query(SortOrder.asc, description="Sort order (asc or desc)"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    search: Optional[str] = Query(None, description="Search in title and description"),
    from_date: Optional[datetime] = Query(
        None, description="Filter events from this date"
    ),
    to_date: Optional[datetime] = Query(
        None, description="Filter events until this date"
    ),
):
    """
    List events with optional pagination, sorting, and filtering.

    Parameters:
    - paginate: Whether to return paginated results
    - page: Page number (starts at 1)
    - size: Number of items per page
    - sort_by: Field to sort by (target_date, created_at, title)
    - order: Sort order (asc, desc)
    - category_id: Optional category ID filter
    - search: Optional search term for title and description
    - from_date: Optional start date filter
    - to_date: Optional end date filter

    Returns:
    - Union[PaginatedEvents, List[Event]]: Events list or paginated events

    Raises:
    - 401: Unauthorized
    """
    current_user = await get_current_user(request, session)

    # Build query
    query = select(EventModel).options(selectinload(EventModel.category))
    query = query.filter(EventModel.user_id == current_user.id)

    # Apply filters
    if category_id is not None:
        query = query.filter(EventModel.category_id == category_id)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (EventModel.title.ilike(search_term))
            | (EventModel.description.ilike(search_term))
        )
    if from_date:
        query = query.filter(EventModel.target_date >= from_date)
    if to_date:
        query = query.filter(EventModel.target_date <= to_date)

    # Apply sorting
    sort_column = getattr(EventModel, sort_by.value)
    if order == SortOrder.desc:
        sort_column = sort_column.desc()
    query = query.order_by(sort_column)

    if not paginate:
        # Return all events without pagination
        result = await session.execute(query)
        return result.scalars().all()

    # Get total count for pagination
    count_query = select(func.count()).select_from(query.subquery())
    total = await session.scalar(count_query)

    # Apply pagination
    query = query.offset((page - 1) * size).limit(size)

    # Execute query
    result = await session.execute(query)
    events = result.scalars().all()

    return PaginatedEvents(
        items=events,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size,
    )


@router.get("/{event_id}", response_model=Event)
@login_required
async def get_event(
    request: Request, event_id: int, session: AsyncSession = Depends(get_session)
):
    """
    Get a specific event by ID.

    Parameters:
    - event_id: ID of the event to retrieve

    Returns:
    - Event: Event object if found

    Raises:
    - 401: Unauthorized
    - 404: Event not found
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel)
        .options(selectinload(EventModel.category))
        .filter(EventModel.id == event_id, EventModel.user_id == current_user.id)
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
    session: AsyncSession = Depends(get_session),
):
    """
    Update an existing event.

    Parameters:
    - event_id: ID of the event to update
    - event_update: Updated event data

    Returns:
    - Event: Updated event object

    Raises:
    - 401: Unauthorized
    - 404: Event not found
    - 422: Validation Error
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel)
        .options(selectinload(EventModel.category))
        .filter(EventModel.id == event_id, EventModel.user_id == current_user.id)
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
    request: Request, event_id: int, session: AsyncSession = Depends(get_session)
):
    """
    Delete an event.

    Parameters:
    - event_id: ID of the event to delete

    Returns:
    - dict: Success message

    Raises:
    - 401: Unauthorized
    - 404: Event not found
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel).filter(
            EventModel.id == event_id, EventModel.user_id == current_user.id
        )
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    await session.delete(event)
    await session.commit()
    return {"message": "Event deleted"}


@router.delete("/bulk", response_model=dict)
@login_required
async def bulk_delete_events(
    request: Request,
    events: BulkEventDelete,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete multiple events in a single request.

    Parameters:
    - events: List of event IDs to delete

    Returns:
    - dict: Success message with count of deleted events

    Raises:
    - 401: Unauthorized
    """
    current_user = await get_current_user(request, session)
    result = await session.execute(
        select(EventModel).filter(
            EventModel.id.in_(events.event_ids), EventModel.user_id == current_user.id
        )
    )
    db_events = result.scalars().all()

    for event in db_events:
        await session.delete(event)

    await session.commit()
    return {
        "message": f"Successfully deleted {len(db_events)} events",
        "deleted_count": len(db_events),
    }
