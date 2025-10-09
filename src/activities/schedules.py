from temporalio import activity
from temporalio.client import Client, Schedule, ScheduleActionStartWorkflow, ScheduleSpec, ScheduleState, ScheduleCalendarSpec, ScheduleRange
from src.config import get_settings
from src.db.repositories import SubscriptionRepository
from src.db.session import get_session
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

@activity.defn
async def create_reminder_schedules(
    event_id: int,
    start_date_iso: str,
    subscription_reminders: dict[int, list[int]]
) -> dict:
    """Create Temporal Schedules for event reminders
    
    Args:
        event_id: Event database ID
        start_date_iso: Event start date as ISO8601 string
        subscription_reminders: Dict of {subscription_id: [offset_seconds]}
                               Empty dict = no subscriptions
                               Empty list for a subscription = no reminders for that subscription
                               Frontend handles defaults (e.g., [86400, 3600] for 1d, 1h)
    
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
    
    # Create per-subscription custom reminders
    # Frontend always sends reminder_offsets (empty list = no reminders)
    if not subscription_reminders:
        logger.info(f"No subscription reminders for event {event_id}")
        return {"event_id": event_id, "schedules_created": []}
    
    for sub_id, offsets in subscription_reminders.items():
        logger.info(f"Processing subscription {sub_id}, offsets type: {type(offsets)}, value: {offsets}")
        if not offsets:
            # Empty list = no reminders for this subscription
            logger.info(f"No reminders for subscription {sub_id}")
            continue
        
        # Ensure offsets is a list
        if not isinstance(offsets, list):
            logger.error(f"Expected list for offsets, got {type(offsets)}: {offsets}")
            offsets = [offsets] if isinstance(offsets, int) else []
        
        for offset_seconds in offsets:
            schedule_id = f"event-{event_id}-sub-{sub_id}-reminder-{offset_seconds}s"
            trigger_time = start_date - timedelta(seconds=offset_seconds)
            
            if trigger_time < datetime.now(timezone.utc):
                logger.warning(f"Skipping reminder {schedule_id} (trigger time in past)")
                continue
            
            try:
                await client.create_schedule(
                    schedule_id,
                    Schedule(
                        action=ScheduleActionStartWorkflow(
                            "ReminderWorkflow",
                            args=[event_id, sub_id, offset_seconds],  # event_id, subscription_id, offset_seconds
                            id=f"reminder-{event_id}-sub-{sub_id}-{offset_seconds}s-{int(trigger_time.timestamp())}",
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
                            note=f"Reminder for event {event_id}, subscription {sub_id} ({offset_seconds}s before)",
                            paused=False
                        )
                    )
                )
                schedules_created.append(schedule_id)
                logger.info(f"Created schedule {schedule_id} to trigger at {trigger_time}")
            except Exception as e:
                error_msg = str(e).lower()
                if "already exists" in error_msg or "already running" in error_msg:
                    logger.info(f"Schedule {schedule_id} already exists, skipping")
                    schedules_created.append(schedule_id)
                else:
                    logger.error(f"Failed to create schedule {schedule_id}: {e}")
    
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
    
    # List all schedules and find ones for this event
    try:
        # List schedules with prefix matching this event
        schedule_iterator = await client.list_schedules()
        async for schedule in schedule_iterator:
            schedule_id = schedule.id
            # Delete if it's for this event (matches pattern: event-{event_id}-*)
            if schedule_id.startswith(f"event-{event_id}-"):
                try:
                    handle = client.get_schedule_handle(schedule_id)
                    await handle.delete()
                    schedules_deleted.append(schedule_id)
                    logger.info(f"Deleted schedule {schedule_id}")
                except Exception as e:
                    if "not found" in str(e).lower() or "does not exist" in str(e).lower():
                        logger.info(f"Schedule {schedule_id} already deleted")
                    else:
                        logger.error(f"Failed to delete schedule {schedule_id}: {e}")
    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
    
    return {
        "event_id": event_id,
        "schedules_deleted": schedules_deleted
    }


@activity.defn
async def get_subscription_reminders(event_id: int) -> dict[int, list[int]]:
    """Get reminder preferences for all subscriptions to an event
    
    Returns:
        Dict of {subscription_id: [offset_seconds, ...]}
        Empty list means no reminders for that subscription
        If subscription has no custom reminders, it's not in the dict (use defaults)
    """
    async with get_session() as session:
        repo = SubscriptionRepository(session)
        subscriptions = await repo.get_by_event(event_id)
        
        result = {}
        for sub in subscriptions:
            # Load reminders relationship
            await session.refresh(sub, ["reminders"])
            if sub.reminders:
                # User has custom reminders
                offsets_list = [r.offset_seconds for r in sub.reminders]
                logger.info(f"Sub {sub.id} reminders: {offsets_list} (type: {type(offsets_list)})")
                result[sub.id] = offsets_list
        
        logger.info(f"get_subscription_reminders returning: {result}")
        return result
