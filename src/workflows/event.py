from datetime import timedelta, datetime, timezone
from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.activities.events import validate_event_exists, get_event_details
    from src.activities.notifications import send_notification_to_subscribers
    from src.activities.schedules import create_reminder_schedules, delete_reminder_schedules, get_subscription_reminders


@workflow.defn
class EventWorkflow:
    """Workflow to manage event lifecycle"""
    
    def __init__(self):
        self.event_id: int = 0
        self.event_data: dict = {}
        self.is_cancelled: bool = False
    
    @workflow.run
    async def run(self, event_id: int, event_data: dict) -> str:
        """Run the event workflow"""
        self.event_id = event_id
        self.event_data = event_data
        
        # Validate event exists
        exists = await workflow.execute_activity(
            validate_event_exists,
            event_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not exists:
            return f"Event {event_id} not found"
        
        # Get event details
        details = await workflow.execute_activity(
            get_event_details,
            event_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=3)
        )
        
        if not details:
            return f"Could not load event {event_id} details"
        
        # Create reminder schedules if start_date is set
        if details.get('start_date'):
            try:
                # Get custom reminder preferences for all subscriptions
                subscription_reminders = await workflow.execute_activity(
                    get_subscription_reminders,
                    event_id,
                    start_to_close_timeout=timedelta(seconds=30),
                    retry_policy=RetryPolicy(maximum_attempts=2)
                )
                
                # Create schedules (frontend always sends reminder_offsets)
                schedule_result = await workflow.execute_activity(
                    create_reminder_schedules,
                    args=[event_id, details['start_date'], subscription_reminders],
                    start_to_close_timeout=timedelta(minutes=1),
                    retry_policy=RetryPolicy(maximum_attempts=2)
                )
                workflow.logger.info(
                    f"Created reminder schedules for event {event_id}: "
                    f"{schedule_result.get('schedules_created', [])}"
                )
            except Exception as e:
                workflow.logger.error(f"Failed to create reminder schedules: {e}")
                # Non-critical - continue workflow
        
        # Parse event times (ensure timezone-aware for comparison with workflow.now())
        end_date = None
        if details.get("end_date"):
            end_date = datetime.fromisoformat(details["end_date"])
            # Ensure timezone-aware (workflow.now() returns UTC)
            if end_date.tzinfo is None:
                end_date = end_date.replace(tzinfo=timezone.utc)
        
        # Wait until event ends or is cancelled
        # TODO: Validate the end date so it's not infinity or something crazy
        if end_date:
            wait_timeout = end_date - workflow.now()
        else:
            wait_timeout = timedelta(days=365)

        try:
            await workflow.wait_condition(
                lambda: self.is_cancelled or (end_date and workflow.now() >= end_date),
                timeout=wait_timeout
            )
        except Exception:
            pass
        
        # Cleanup: delete reminder schedules
        try:
            await workflow.execute_activity(
                delete_reminder_schedules,
                event_id,
                start_to_close_timeout=timedelta(seconds=30)
            )
            workflow.logger.info(f"Deleted reminder schedules for event {event_id}")
        except Exception as e:
            workflow.logger.error(f"Failed to delete reminder schedules: {e}")
        
        if self.is_cancelled:
            return f"Event {event_id} cancelled"
        
        return f"Event {event_id} completed"
    
    @workflow.signal
    async def cancel_event(self):
        """Signal to cancel the event
        
        EVENT-DRIVEN: Broadcasts cancellation to ALL subscribers immediately.
        """
        workflow.logger.info(f"Event {self.event_id} cancelled")
        
        # EVENT-DRIVEN: Broadcast cancellation to ALL subscribers
        try:
            await workflow.execute_activity(
                send_notification_to_subscribers,
                args=[
                    self.event_id,
                    f"Event Cancelled: {self.event_data.get('name', 'Event')}",
                    "This event has been cancelled by the organizer.",
                    "critical"
                ],
                start_to_close_timeout=timedelta(minutes=2)
            )
        except Exception as e:
            workflow.logger.error(f"Failed to send cancellation notification: {e}")
        
        self.is_cancelled = True
    
    @workflow.signal
    async def event_updated(self, updated_data: dict):
        """Signal that event was updated
        
        EVENT-DRIVEN: Broadcasts update to ALL subscribers immediately.
        Also reschedules personal reminders if start_date changed.
        """
        old_start_date = self.event_data.get('start_date')
        self.event_data.update(updated_data)
        new_start_date = updated_data.get('start_date')
        
        # If start_date changed, recreate ALL personal reminder schedules
        if new_start_date and new_start_date != old_start_date:
            workflow.logger.info(
                f"Event {self.event_id} start_date changed from {old_start_date} to {new_start_date}, "
                f"recreating reminder schedules"
            )
            try:
                # Delete old schedules
                await workflow.execute_activity(
                    delete_reminder_schedules,
                    self.event_id,
                    start_to_close_timeout=timedelta(seconds=30)
                )
                
                # Get subscription reminders
                subscription_reminders = await workflow.execute_activity(
                    get_subscription_reminders,
                    self.event_id,
                    start_to_close_timeout=timedelta(seconds=30)
                )
                
                # Create new schedules with custom reminders
                await workflow.execute_activity(
                    create_reminder_schedules,
                    args=[self.event_id, new_start_date, subscription_reminders],
                    start_to_close_timeout=timedelta(minutes=1)
                )
                workflow.logger.info(f"Recreated reminder schedules for event {self.event_id}")
            except Exception as e:
                workflow.logger.error(f"Failed to recreate reminder schedules: {e}")
        
        # Send update notification to subscribers
        await workflow.execute_activity(
            send_notification_to_subscribers,
            args=[
                self.event_id,
                f"Event Updated: {updated_data.get('name', 'Event')}",
                "The event has been updated. Check the details for changes.",
                "info"
            ],
            start_to_close_timeout=timedelta(minutes=2)
        )
    
    @workflow.signal
    async def participant_added(self, participant_data: dict):
        """Signal that a participant subscribed to the event
        
        SUBSCRIBER-DRIVEN: Creates personal reminder schedules for THIS subscription only (incremental).
        Does NOT send welcome notification (API handles that).
        """
        workflow.logger.info(
            f"Participant added to event {self.event_id}: "
            f"subscription_id={participant_data.get('subscription_id')}, "
            f"user_id={participant_data.get('user_id')}"
        )
        
        # SUBSCRIBER-DRIVEN: Create personal reminder schedules for this subscription only
        if self.event_data.get('start_date'):
            try:
                subscription_id = participant_data.get('subscription_id')
                
                # Get reminders for just this subscription
                subscription_reminders = await workflow.execute_activity(
                    get_subscription_reminders,
                    self.event_id,
                    start_to_close_timeout=timedelta(seconds=30)
                )
                
                # Filter to only the new subscription's reminders
                new_sub_reminders = {
                    subscription_id: subscription_reminders.get(subscription_id, [])
                }
                
                # Create schedules only for this subscription
                await workflow.execute_activity(
                    create_reminder_schedules,
                    args=[self.event_id, self.event_data['start_date'], new_sub_reminders],
                    start_to_close_timeout=timedelta(minutes=1)
                )
                workflow.logger.info(f"Created reminder schedules for subscription {subscription_id}")
            except Exception as e:
                workflow.logger.error(f"Failed to create schedules for new subscription: {e}")
    
    @workflow.query
    def get_status(self) -> dict:
        """Query current workflow status"""
        return {
            "event_id": self.event_id,
            "is_cancelled": self.is_cancelled,
            "event_data": self.event_data
        }
