from temporalio import workflow
from datetime import timedelta
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.activities.events import get_event_details
    from src.activities.reminders import send_reminder_notification


@workflow.defn
class ReminderWorkflow:
    """Short-lived workflow to send scheduled event reminders"""
    
    @workflow.run
    async def run(self, event_id: int, reminder_type: str) -> str:
        """Send scheduled reminder notification
        
        Args:
            event_id: Event database ID
            reminder_type: Type of reminder ("1day" or "1hour")
        
        Returns:
            Success status
        """
        workflow.logger.info(
            f"Starting ReminderWorkflow for event {event_id}, type {reminder_type}"
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
        
        # Send reminder notification
        result = await workflow.execute_activity(
            send_reminder_notification,
            args=[event_id, reminder_type, event_data],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=2),
                maximum_interval=timedelta(seconds=30),
            )
        )
        
        workflow.logger.info(
            f"ReminderWorkflow completed for event {event_id}: "
            f"{result.get('success', 0)} success, {result.get('failed', 0)} failed"
        )
        
        return "success"
