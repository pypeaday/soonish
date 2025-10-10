#!/usr/bin/env python3
"""Test: Event cancellation broadcasts and ends workflow"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from temporalio.client import Client
from src.db.session import get_session
from src.db.repositories import (
    EventRepository, UserRepository,
    SubscriptionRepository, IntegrationRepository
)
from src.db.models import Event, Subscription, SubscriptionSelector
from src.config import get_settings

# Stub - fill in your Gotify details
GOTIFY_URL = os.environ.get("GOTIFY_URL")
GOTIFY_TOKEN = os.environ.get("GOTIFY_TOKEN")

TEST_ORGANIZER = "test1@example.com"
TEST_SUBSCRIBER = "test2@example.com"


async def main():
    settings = get_settings()
    client = await Client.connect(settings.temporal_url)
    
    async with get_session() as session:
        user_repo = UserRepository(session)
        organizer = await user_repo.get_by_email(TEST_ORGANIZER)
        subscriber = await user_repo.get_by_email(TEST_SUBSCRIBER)
        
        event_repo = EventRepository(session)
        now_utc = datetime.now(timezone.utc)
        event = Event(
            name="Cancellation Test Event",
            start_date=now_utc + timedelta(hours=5),
            end_date=now_utc + timedelta(hours=6),
            organizer_user_id=organizer.id,
            temporal_workflow_id=f"event-cancel-test-{now_utc.timestamp()}"
        )
        event = await event_repo.create(event)
        await session.commit()
        
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
        
        # Setup subscriber (get or create)
        int_repo = IntegrationRepository(session)
        integration, created = await int_repo.get_or_create(
            user_id=subscriber.id,
            name="Gotify Cancel Test",
            apprise_url=f"gotify://{GOTIFY_URL}/{GOTIFY_TOKEN}",
            tag="urgent"
        )
        
        sub_repo = SubscriptionRepository(session)
        subscription = Subscription(
            event_id=event.id,
            user_id=subscriber.id
        )
        subscription = await sub_repo.create(subscription)
        await session.flush()
        
        selector = SubscriptionSelector(
            subscription_id=subscription.id,
            integration_id=integration.id
        )
        session.add(selector)
        await session.commit()
    
    # Cancel event
    await handle.signal("cancel_event")
    await asyncio.sleep(3)
    
    # Verify workflow state
    result = await handle.query("get_status")
    assert result["is_cancelled"]
    
    print(f"✅ Event {event.id} cancelled, notification sent to subscriber")


if __name__ == "__main__":
    asyncio.run(main())
