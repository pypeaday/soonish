#!/usr/bin/env python3
"""Test: Reminder schedule fires and sends notification"""
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
from temporalio.client import Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleState, ScheduleCalendarSpec, ScheduleRange

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
        
        # Create event starting in 10 minutes (use UTC)
        event_repo = EventRepository(session)
        now_utc = datetime.now(timezone.utc)
        event = Event(
            name="Reminder Test Event",
            start_date=now_utc + timedelta(minutes=5),
            end_date=now_utc + timedelta(minutes=10),
            organizer_user_id=organizer.id,
            temporal_workflow_id=f"event-reminder-test-{now_utc.timestamp()}"
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
        
        # Setup subscriber with integration
        int_repo = IntegrationRepository(session)
        integration = Integration(
            user_id=subscriber.id,
            name="Gotify Reminder Test",
            apprise_url=f"gotify://{GOTIFY_URL}/{GOTIFY_TOKEN}",
            tag="urgent"
        )
        integration = await int_repo.create(integration)
        await session.flush()
        
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
    
    # Reminder: 4 minutes 30 seconds before event start
    offset_seconds = (4 * 60) + 30  # 270 seconds
    trigger_time = event.start_date - timedelta(seconds=offset_seconds)
    schedule_id = f"event-{event.id}-sub-{subscription.id}-reminder-{offset_seconds}s"
    
    await client.create_schedule(
        schedule_id,
        Schedule(
            action=ScheduleActionStartWorkflow(
                "ReminderWorkflow",
                args=[event.id, subscription.id, offset_seconds],
                id=f"reminder-{event.id}-sub-{subscription.id}-{offset_seconds}s-{int(trigger_time.timestamp())}",
                task_queue=settings.temporal_task_queue,
            ),
            spec=ScheduleSpec(
                calendars=[
                    ScheduleCalendarSpec(
                        second=[ScheduleRange(trigger_time.second)],
                        minute=[ScheduleRange(trigger_time.minute)],
                        hour=[ScheduleRange(trigger_time.hour)],
                        day_of_month=[ScheduleRange(trigger_time.day)],
                        month=[ScheduleRange(trigger_time.month)],
                        year=[ScheduleRange(trigger_time.year)],
                    )
                ]
            ),
            state=ScheduleState(
                note=f"Test: Reminder {offset_seconds}s before event {event.id}",
                paused=False
            )
        )
    )
    
    # Calculate wait time
    now_utc = datetime.now(timezone.utc)
    wait_seconds = int((trigger_time - now_utc).total_seconds())
    
    print(f"Event starts: {event.start_date.strftime('%H:%M:%S')}")
    print(f"Reminder fires: {trigger_time.strftime('%H:%M:%S')} ({offset_seconds}s before)")
    print(f"Waiting ~{wait_seconds} seconds...")
    
    await asyncio.sleep(wait_seconds + 5)  # +5 for processing time
    print("✅ Check Gotify for reminder notification")


if __name__ == "__main__":
    asyncio.run(main())
