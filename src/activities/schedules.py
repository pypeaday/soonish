from temporalio import activity
from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleCalendarSpec, ScheduleState
from datetime import datetime, timedelta, timezone
from src.config import get_settings
import logging

logger = logging.getLogger(__name__)


@activity.defn
async def create_reminder_schedules(event_id: int, start_date_iso: str) -> dict:
    """Create Temporal Schedules for event reminders
    
    Args:
        event_id: Event database ID
        start_date_iso: Event start date as ISO8601 string
    
    Returns:
        Dictionary with created schedule IDs
    """
    settings = get_settings()
    
    # Parse start date
    start_date = datetime.fromisoformat(start_date_iso.replace('Z', '+00:00'))
    if start_date.tzinfo is None:
        start_date = start_date.replace(tzinfo=timezone.utc)
    
    logger.info(f"Creating reminder schedules for event {event_id}, start_date={start_date}")
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    schedules_created = []
    
    # TODO Phase 11: Get reminder preferences from subscription/user settings
    # For now, use hardcoded defaults (T-1d, T-1h)
    # Future: Query subscription_reminders table for custom offsets
    reminders = [
        {"type": "1day", "offset": timedelta(days=1)},
        {"type": "1hour", "offset": timedelta(hours=1)}
    ]
    
    for reminder in reminders:
        schedule_id = f"event-{event_id}-reminder-{reminder['type']}"
        trigger_time = start_date - reminder['offset']
        
        # Skip if reminder time is in the past
        if trigger_time < datetime.now(timezone.utc):
            logger.warning(
                f"Skipping {reminder['type']} reminder for event {event_id} "
                f"(trigger time {trigger_time} is in past)"
            )
            continue
        
        try:
            # Create Temporal Schedule
            await client.create_schedule(
                schedule_id,
                Schedule(
                    action=ScheduleActionStartWorkflow(
                        "ReminderWorkflow",
                        args=[event_id, reminder['type']],
                        id=f"reminder-{event_id}-{reminder['type']}-{int(trigger_time.timestamp())}",
                        task_queue=settings.temporal_task_queue,
                    ),
                    spec=ScheduleSpec(
                        calendars=[
                            ScheduleCalendarSpec(
                                second=trigger_time.second,
                                minute=trigger_time.minute,
                                hour=trigger_time.hour,
                                day_of_month=trigger_time.day,
                                month=trigger_time.month,
                                year=trigger_time.year,
                            )
                        ]
                    ),
                    state=ScheduleState(
                        note=f"Reminder for event {event_id} ({reminder['type']})",
                        paused=False
                    )
                )
            )
            
            schedules_created.append(schedule_id)
            logger.info(f"Created schedule {schedule_id} to trigger at {trigger_time}")
            
        except Exception as e:
            # Schedule might already exist (idempotency)
            if "already exists" in str(e).lower():
                logger.info(f"Schedule {schedule_id} already exists")
                schedules_created.append(schedule_id)
            else:
                logger.error(f"Failed to create schedule {schedule_id}: {e}")
                raise
    
    return {
        "event_id": event_id,
        "schedules_created": schedules_created
    }


@activity.defn
async def delete_reminder_schedules(event_id: int) -> dict:
    """Delete all reminder schedules for an event
    
    Args:
        event_id: Event database ID
    
    Returns:
        Dictionary with deleted schedule IDs
    """
    settings = get_settings()
    
    logger.info(f"Deleting reminder schedules for event {event_id}")
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    schedules_deleted = []
    
    # Schedule IDs to delete
    schedule_ids = [
        f"event-{event_id}-reminder-1day",
        f"event-{event_id}-reminder-1hour"
    ]
    
    for schedule_id in schedule_ids:
        try:
            handle = client.get_schedule_handle(schedule_id)
            await handle.delete()
            schedules_deleted.append(schedule_id)
            logger.info(f"Deleted schedule {schedule_id}")
        except Exception as e:
            # Schedule might not exist (idempotent)
            if "not found" in str(e).lower() or "does not exist" in str(e).lower():
                logger.info(f"Schedule {schedule_id} does not exist (already deleted)")
            else:
                logger.error(f"Failed to delete schedule {schedule_id}: {e}")
                # Don't raise - deletion is best-effort
    
    return {
        "event_id": event_id,
        "schedules_deleted": schedules_deleted
    }
