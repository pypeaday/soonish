from temporalio import workflow
from datetime import timedelta
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.activities.events import get_event_details
    from src.activities.notifications import send_notification_to_subscription


@workflow.defn
class ReminderWorkflow:
    """Short-lived workflow to send SUBSCRIBER-DRIVEN personal reminders
    
    Sends notification to a SINGLE subscriber at their chosen reminder time.
    This is NOT a broadcast - it's a personal reminder.
    """
    
    @workflow.run
    async def run(self, event_id: int, subscription_id: int, offset_seconds: int) -> str:
        """Send scheduled reminder to SPECIFIC subscriber
        
        Args:
            event_id: Event database ID
            subscription_id: Specific subscription to notify
            offset_seconds: How many seconds before event this reminder is for
        
        Returns:
            Success status
        """
        workflow.logger.info(
            f"Starting ReminderWorkflow for event {event_id}, subscription {subscription_id}, "
            f"offset {offset_seconds}s"
        )
        
        # Get current event details (may have changed since schedule was created)
        event_data = await workflow.execute_activity(
            get_event_details,
            event_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not event_data:
            workflow.logger.error(f"Event {event_id} not found, skipping reminder")
            return "event_not_found"
        
        # Format reminder message based on offset_seconds
        if offset_seconds >= 86400:
            days = offset_seconds // 86400
            title = f"Reminder: {event_data['name']} in {days} day(s)"
            body = f"Don't forget! Your event '{event_data['name']}' starts in {days} day(s)."
        elif offset_seconds >= 3600:
            hours = offset_seconds // 3600
            title = f"Starting Soon: {event_data['name']}"
            body = f"Your event '{event_data['name']}' starts in {hours} hour(s)!"
        else:
            minutes = offset_seconds // 60
            title = f"Starting Soon: {event_data['name']}"
            body = f"Your event '{event_data['name']}' starts in {minutes} minute(s)!"
        
        # Add event details
        if event_data.get('location'):
            body += f"\n\nLocation: {event_data['location']}"
        if event_data.get('start_date'):
            body += f"\nTime: {event_data['start_date']}"
        
        # SUBSCRIBER-DRIVEN: Send to SPECIFIC subscription only (not broadcast)
        result = await workflow.execute_activity(
            send_notification_to_subscription,
            args=[subscription_id, title, body, "warning"],
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=2),
                maximum_interval=timedelta(seconds=30),
            )
        )
        
        workflow.logger.info(
            f"ReminderWorkflow completed for event {event_id}, subscription {subscription_id}: "
            f"{'success' if result.get('success') else 'failed'}"
        )
        
        return "success"
