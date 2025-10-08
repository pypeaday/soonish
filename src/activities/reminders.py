from temporalio import activity
from src.activities.notifications import send_notification_to_subscribers
import logging

logger = logging.getLogger(__name__)


@activity.defn
async def send_reminder_notification(
    event_id: int,
    reminder_type: str,
    event_data: dict
) -> dict:
    """Send scheduled reminder notification
    
    Args:
        event_id: Event database ID
        reminder_type: "1day" or "1hour"
        event_data: Current event details
    
    Returns:
        Delivery statistics
    """
    # Format reminder message based on type
    if reminder_type == "1day":
        title = f"Reminder: {event_data['name']} is tomorrow"
        body = f"Don't forget! Your event '{event_data['name']}' starts tomorrow."
        level = "info"
    elif reminder_type == "1hour":
        title = f"Starting Soon: {event_data['name']}"
        body = f"Your event '{event_data['name']}' starts in 1 hour!"
        level = "warning"
    else:
        title = f"Reminder: {event_data['name']}"
        body = f"Reminder for '{event_data['name']}'"
        level = "info"
    
    # Add event details to body
    if event_data.get('location'):
        body += f"\n\nLocation: {event_data['location']}"
    if event_data.get('start_date'):
        body += f"\nTime: {event_data['start_date']}"
    
    logger.info(f"Sending {reminder_type} reminder for event {event_id}")
    
    # Use the subscriber notification activity
    result = await send_notification_to_subscribers(
        event_id=event_id,
        title=title,
        body=body,
        level=level
    )
    
    logger.info(
        f"Reminder sent for event {event_id}: "
        f"{result.get('success', 0)} success, {result.get('failed', 0)} failed"
    )
    
    return result
