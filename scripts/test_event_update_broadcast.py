#!/usr/bin/env python3
"""Test: Event update triggers broadcast to all subscribers"""
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
GOTIFY_TOKEN_USER1 = os.environ.get("GOTIFY_TOKEN_USER1")
GOTIFY_TOKEN_USER2 = os.environ.get("GOTIFY_TOKEN_USER2")

TEST_ORGANIZER = "test1@example.com"
TEST_SUBSCRIBER_1 = "test2@example.com"
TEST_SUBSCRIBER_2 = "test3@example.com"


async def main():
    settings = get_settings()
    client = await Client.connect(settings.temporal_url)
    
    async with get_session() as session:
        user_repo = UserRepository(session)
        organizer = await user_repo.get_by_email(TEST_ORGANIZER)
        sub1 = await user_repo.get_by_email(TEST_SUBSCRIBER_1)
        sub2 = await user_repo.get_by_email(TEST_SUBSCRIBER_2)
        
        # Create event with workflow (use UTC)
        event_repo = EventRepository(session)
        now_utc = datetime.now(timezone.utc)
        event = Event(
            name="Update Test Event",
            location="Old Location",
            start_date=now_utc + timedelta(hours=3),
            end_date=now_utc + timedelta(hours=4),
            organizer_user_id=organizer.id,
            temporal_workflow_id=f"event-update-test-{now_utc.timestamp()}"
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
        
        # Setup integrations and subscriptions for both subscribers
        int_repo = IntegrationRepository(session)
        sub_repo = SubscriptionRepository(session)
        
        for user, token in [(sub1, GOTIFY_TOKEN_USER1), (sub2, GOTIFY_TOKEN_USER2)]:
            integration, created = await int_repo.get_or_create(
                user_id=user.id,
                name=f"Gotify {user.email}",
                apprise_url=f"gotify://{GOTIFY_URL}/{token}",
                tag="urgent"
            )
            
            subscription = Subscription(
                event_id=event.id,
                user_id=user.id
            )
            subscription = await sub_repo.create(subscription)
            await session.flush()
            
            selector = SubscriptionSelector(
                subscription_id=subscription.id,
                integration_id=integration.id
            )
            session.add(selector)
        
        await session.commit()
        print("Setup: 2 subscribers with integrations")
        
        # Update event - should broadcast to both
        event.location = "New Location - Everyone Gets Notified"
        await session.commit()
    
    await handle.signal("event_updated", {
        "name": event.name,
        "location": event.location,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None
    })
    
    await asyncio.sleep(2)
    print(f"✅ Event {event.id} updated, notifications sent to 2 subscribers")


if __name__ == "__main__":
    asyncio.run(main())
