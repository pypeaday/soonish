#!/usr/bin/env python3
"""Test: User subscribes to event, schedules created"""
import asyncio
import os
from datetime import datetime, timedelta, timezone
from temporalio.client import Client
from src.db.session import get_session
from src.db.repositories import (
    EventRepository, UserRepository, 
    SubscriptionRepository, IntegrationRepository
)
from src.db.models import Event, Integration, Subscription, SubscriptionSelector
from src.config import get_settings

# Stub - fill in your Gotify details
GOTIFY_URL = os.environ.get("GOTIFY_URL")
GOTIFY_TOKEN_USER1 = os.environ.get("GOTIFY_TOKEN_USER1")

TEST_ORGANIZER = "test1@example.com"
TEST_SUBSCRIBER = "test2@example.com"


async def main():
    settings = get_settings()
    
    async with get_session() as session:
        user_repo = UserRepository(session)
        organizer = await user_repo.get_by_email(TEST_ORGANIZER)
        subscriber = await user_repo.get_by_email(TEST_SUBSCRIBER)
        assert organizer and subscriber, "Users not found"
        
        # Create event (use UTC to avoid timezone issues)
        event_repo = EventRepository(session)
        now_utc = datetime.now(timezone.utc)
        event = Event(
            name="Subscription Test Event",
            start_date=now_utc + timedelta(hours=2),
            end_date=now_utc + timedelta(hours=3),
            organizer_user_id=organizer.id,
            temporal_workflow_id=f"event-sub-test-{now_utc.timestamp()}"
        )
        event = await event_repo.create(event)
        await session.commit()
        
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
        
        # Create integration for subscriber
        int_repo = IntegrationRepository(session)
        integration = Integration(
            user_id=subscriber.id,
            name="Gotify Test",
            apprise_url=f"gotify://{GOTIFY_URL}/{GOTIFY_TOKEN_USER1}",
            tag="urgent"
        )
        integration = await int_repo.create(integration)
        await session.commit()
        
        # Subscribe
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
    
    # Signal workflow about new participant
    await handle.signal(
        "participant_added",
        {"subscription_id": subscription.id, "user_id": subscriber.id}
    )
    await asyncio.sleep(1)
    
    print(f"✅ Subscription {subscription.id} created")
    
    # Update event to trigger notification
    async with get_session() as session:
        event_repo = EventRepository(session)
        event_obj = await event_repo.get_by_id(event.id)
        event_obj.location = "Updated Location - Check Gotify"
        await session.commit()
    
    # Signal workflow about update
    await handle.signal("event_updated", {
        "name": event.name,
        "location": "Updated Location - Check Gotify",
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None
    })
    await asyncio.sleep(2)
    
    print(f"✅ Event updated, notification sent to subscriber")


if __name__ == "__main__":
    asyncio.run(main())
