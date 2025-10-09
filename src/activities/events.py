from temporalio import activity
from src.db.repositories import EventRepository
from src.db.session import get_session


@activity.defn
async def validate_event_exists(event_id: int) -> bool:
    """Validate event exists in database"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        return event is not None


@activity.defn
async def get_event_details(event_id: int) -> dict | None:
    """Get current event details"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        if not event:
            return None
        return {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "timezone": event.timezone
        }
