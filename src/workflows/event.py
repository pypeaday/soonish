from datetime import timedelta, datetime
from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from src.activities.events import validate_event_exists, get_event_details


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
        
        # Parse event times
        end_date = datetime.fromisoformat(details["end_date"]) if details.get("end_date") else None
        
        # Wait until event ends or is cancelled
        # TODO: Validate the end date so it's not infinity or something crazy
        if end_date:
            wait_timeout = end_date - workflow.now()
        else:
            wait_timeout = timedelta(days=365)

        try:
            await workflow.wait_condition(
                lambda: self.is_cancelled or workflow.now() >= end_date,
                timeout=wait_timeout
            )
        except Exception:
            pass
        
        if self.is_cancelled:
            return f"Event {event_id} cancelled"
        
        return f"Event {event_id} completed"
    
    @workflow.signal
    async def cancel_event(self):
        """Signal to cancel the event"""
        self.is_cancelled = True
    
    @workflow.signal
    async def event_updated(self, updated_data: dict):
        """Signal that event was updated"""
        self.event_data.update(updated_data)
    
    @workflow.signal
    async def participant_added(self, participant_data: dict):
        """Signal that a participant subscribed to the event"""
        # For now, just log it - Phase 8 will use this for notifications
        workflow.logger.info(
            f"Participant added to event {self.event_id}: "
            f"subscription_id={participant_data.get('subscription_id')}, "
            f"user_id={participant_data.get('user_id')}"
        )
    
    @workflow.query
    def get_status(self) -> dict:
        """Query current workflow status"""
        return {
            "event_id": self.event_id,
            "is_cancelled": self.is_cancelled,
            "event_data": self.event_data
        }
