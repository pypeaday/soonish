#!/usr/bin/env python3
"""Test: Event creation starts workflow"""
import asyncio
from datetime import datetime, timedelta, timezone
from temporalio.client import Client
from src.db.session import get_session
from src.db.repositories import EventRepository, UserRepository
from src.db.models import Event
from src.config import get_settings

# Test user credentials
TEST_USER = "test1@example.com"
TEST_PASSWORD = "password123"


async def main():
    settings = get_settings()
    
    # Get test user
    async with get_session() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_email(TEST_USER)
        assert user, f"User {TEST_USER} not found - run setup_test_data.py"
        
        # Create event (use UTC)
        event_repo = EventRepository(session)
        now_utc = datetime.now(timezone.utc)
        event = Event(
            name="Test Event",
            description="Testing workflow creation",
            start_date=now_utc + timedelta(hours=1),
            end_date=now_utc + timedelta(hours=2),
            organizer_user_id=user.id,
            temporal_workflow_id=f"event-test-{now_utc.timestamp()}"
        )
        event = await event_repo.create(event)
        await session.commit()
        
        print(f"Created event {event.id}")
    
    # Start workflow
    client = await Client.connect(settings.temporal_url)
    from src.workflows.event import EventWorkflow
    
    event_data = {
        "name": event.name,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "location": event.location
    }
    
    handle = await client.start_workflow(
        EventWorkflow.run,
        args=[event.id, event_data],
        id=event.temporal_workflow_id,
        task_queue=settings.temporal_task_queue
    )
    
    # Verify workflow is running
    status = await handle.describe()
    assert status.status.name == "RUNNING"
    
    # Query workflow
    result = await handle.query("get_status")
    assert result["event_id"] == event.id
    assert not result["is_cancelled"]
    
    print(f"✅ Event {event.id} created with workflow {event.temporal_workflow_id}")


if __name__ == "__main__":
    asyncio.run(main())
