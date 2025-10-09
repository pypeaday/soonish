# Temporal Specification

**Status**: Authoritative  
**Last Updated**: 2025-10-03  
**Purpose**: Defines Temporal workflows, activities, schedules, and orchestration patterns for Soonish.

---

## Table of Contents
1. [Overview](#overview)
2. [Workflows](#workflows)
3. [Activities](#activities)
4. [Temporal Schedules](#temporal-schedules)
5. [Signals](#signals)
6. [Error Handling](#error-handling)
7. [Testing](#testing)

---

## Overview

### Architecture Decisions

**Temporal Usage Strategy**:
- One `EventWorkflow` per event (primary orchestration)
- `ReminderWorkflow` triggered by Temporal Schedules for subscriber-specific reminders
- `workflow.sleep` for ad-hoc "remind me in X hours" features
- Activities manage all external I/O (database, Apprise)
- Schedules created/managed in activities for idempotency

**Scaling Approach**:
- Start with single task queue: `soonish-task-queue`
- Tune worker concurrency settings
- Optional split to `soonish-workflows` and `soonish-activities` queues later

**Key Patterns**:
- Signal-based event updates (no polling)
- Batch notifications for large audiences
- Continue-As-New after 100 notifications to avoid history bloat
- Deterministic workflow code (all side effects in activities)

### Two Notification Patterns

**CRITICAL DISTINCTION**: Soonish has two fundamentally different notification patterns:

#### 1. Event-Driven Notifications (Broadcast)
- **Trigger**: Organizer action (event update, cancellation, manual announcement)
- **Recipients**: ALL subscribers at once
- **Timing**: Immediate (when event changes)
- **Implementation**: Direct activity call from signal handler
- **No Schedules**: These are real-time, not time-based
- **Examples**:
  - "Event location changed!" → Notify all subscribers NOW
  - "Event cancelled" → Notify all subscribers NOW
  - Organizer sends announcement → Notify all subscribers NOW

#### 2. Subscriber-Driven Reminders (Personal)
- **Trigger**: Time-based (subscriber's chosen reminder times)
- **Recipients**: Individual subscriber
- **Timing**: Scheduled (X minutes/hours before event)
- **Implementation**: Temporal Schedules → ReminderWorkflow → Activity
- **Per-Subscription Schedules**: Each subscription gets its own schedules
- **Examples**:
  - User A wants reminder 1 day before → Schedule fires, sends to User A only
  - User B wants reminder 30 minutes before → Schedule fires, sends to User B only
  - User C opts out → No schedules created

**Schedule Naming Convention**:
```
Per-Subscription (Personal Reminders):
  event-{event_id}-sub-{subscription_id}-reminder-{offset_seconds}s

Examples:
  event-123-sub-456-reminder-86400s  (User's 1-day reminder)
  event-123-sub-789-reminder-3600s   (Different user's 1-hour reminder)
```

---

## Workflows

### EventWorkflow

Primary workflow managing complete event lifecycle.

#### Purpose
- Orchestrate event lifecycle
- Handle event-driven notifications (broadcast to all subscribers)
- Manage per-subscription reminder schedules
- Listen for real-time updates via signals
- Run until event completion or cancellation

#### Responsibilities

**Event-Driven (Immediate Broadcast)**:
- Event updates → Notify ALL subscribers immediately
- Event cancellation → Notify ALL subscribers immediately
- Manual announcements → Notify ALL/selected subscribers immediately

**Subscriber-Driven (Scheduled Reminders)**:
- Create schedules when event is created (for existing subscriptions)
- Create schedules when new subscriber joins (incremental)
- Delete schedules when event completes/cancels (cleanup)

#### Signature

```python
@workflow.defn
class EventWorkflow:
    @workflow.run
    async def run(self, event_id: int, event_data: dict) -> str:
        """
        Main event lifecycle workflow.
        
        Args:
            event_id: Database ID of the event
            event_data: Initial event details (name, start_date, end_date, etc.)
        
        Returns:
            Completion status string
        """
```

#### Implementation

```python
# src/workflows/event.py
from temporalio import workflow
from datetime import timedelta
from src.activities.notifications import (
    send_notification,
    create_reminder_schedules,
    delete_reminder_schedules
)
from src.activities.events import validate_event_exists

@workflow.defn
class EventWorkflow:
    def __init__(self):
        self.event_id: int = 0
        self.event_data: dict = {}
        self.notification_count: int = 0
        self.is_cancelled: bool = False
        self.MAX_NOTIFICATIONS = 100
    
    @workflow.run
    async def run(self, event_id: int, event_data: dict) -> str:
        """Main event lifecycle workflow"""
        self.event_id = event_id
        self.event_data = event_data
        
        workflow.logger.info(
            f"Starting EventWorkflow for event {event_id}: {event_data['name']}"
        )
        
        # Validate event exists in database
        exists = await workflow.execute_activity(
            validate_event_exists,
            event_id,
            start_to_close_timeout=timedelta(seconds=30)
        )
        if not exists:
            raise ValueError(f"Event {event_id} not found in database")
        
        # Send event creation notification to organizer
        await self._send_notification(
            title=f"Event Created: {event_data['name']}",
            body=f"Your event has been created and is now active.",
            notification_level="info"
        )
        
        # Create reminder schedules (T-1d, T-1h before start)
        await workflow.execute_activity(
            create_reminder_schedules,
            args=[event_id, event_data['start_date']],
            start_to_close_timeout=timedelta(seconds=60)
        )
        
        # Main event loop - wait for signals or event completion
        try:
            await workflow.wait_condition(
                lambda: self.is_cancelled or self._is_event_complete()
            )
        finally:
            # Cleanup: Delete reminder schedules
            await workflow.execute_activity(
                delete_reminder_schedules,
                event_id,
                start_to_close_timeout=timedelta(seconds=60)
            )
        
        status = "cancelled" if self.is_cancelled else "completed"
        workflow.logger.info(f"EventWorkflow {event_id} {status}")
        return status
    
    def _is_event_complete(self) -> bool:
        """Check if event has ended based on end_date"""
        if not self.event_data.get('end_date'):
            return False
        
        from datetime import datetime
        end_date = datetime.fromisoformat(self.event_data['end_date'])
        return workflow.now() >= end_date
    
    async def _send_notification(
        self,
        title: str,
        body: str,
        subscription_ids: list[int] | None = None,
        notification_level: str = "info"
    ):
        """Helper to send notifications with Continue-As-New check"""
        await workflow.execute_activity(
            send_notification,
            args=[self.event_id, notification_level, title, body, subscription_ids],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=workflow.RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=1),
                maximum_interval=timedelta(seconds=10),
            )
        )
        
        self.notification_count += 1
        
        # Continue-As-New to avoid workflow history bloat
        if self.notification_count >= self.MAX_NOTIFICATIONS:
            workflow.logger.info(
                f"Notification count reached {self.MAX_NOTIFICATIONS}, continuing as new"
            )
            workflow.continue_as_new(self.event_id, self.event_data)
    
    # Signals defined below
    @workflow.signal
    async def participant_added(self, subscription_data: dict):
        """Signal: New participant subscribed to event
        
        Creates per-subscription reminder schedules incrementally.
        Does NOT send welcome notification (that's handled by API).
        """
        workflow.logger.info(
            f"Participant added to event {self.event_id}: {subscription_data}"
        )
        
        subscription_id = subscription_data['subscription_id']
        
        # Create reminder schedules for this subscription only
        if self.event_data.get('start_date'):
            await workflow.execute_activity(
                create_reminder_schedules_for_subscription,
                args=[self.event_id, subscription_id, self.event_data['start_date']],
                start_to_close_timeout=timedelta(minutes=1)
            )
    
    @workflow.signal
    async def participant_removed(self, subscription_data: dict):
        """Signal: Participant unsubscribed from event"""
        workflow.logger.info(
            f"Participant removed from event {self.event_id}: {subscription_data}"
        )
        # No notification needed for unsubscribe
    
    @workflow.signal
    async def event_updated(self, updated_data: dict):
        """Signal: Event details changed
        
        EVENT-DRIVEN NOTIFICATION: Broadcasts to ALL subscribers immediately.
        This is NOT a scheduled reminder - it's a real-time update.
        """
        workflow.logger.info(
            f"Event {self.event_id} updated: {updated_data}"
        )
        
        # Update internal state
        self.event_data.update(updated_data)
        
        # If start_date changed, reschedule ALL reminders
        if 'start_date' in updated_data:
            workflow.logger.info("Start date changed, rescheduling reminders")
            
            # Delete old schedules (all subscriptions)
            await workflow.execute_activity(
                delete_reminder_schedules,
                self.event_id,
                start_to_close_timeout=timedelta(seconds=60)
            )
            
            # Recreate schedules for ALL subscriptions
            await workflow.execute_activity(
                create_reminder_schedules,
                args=[self.event_id, updated_data['start_date']],
                start_to_close_timeout=timedelta(seconds=60)
            )
        
        # EVENT-DRIVEN: Notify ALL subscribers immediately (broadcast)
        await self._send_notification(
            title=f"Event Update: {self.event_data['name']}",
            body=self._format_update_message(updated_data),
            notification_level="warning"
        )
    
    @workflow.signal
    async def send_manual_notification(
        self,
        title: str,
        body: str,
        subscription_ids: list[int] | None = None,
        notification_level: str = "info"
    ):
        """Signal: Organizer sends custom notification"""
        workflow.logger.info(
            f"Manual notification for event {self.event_id}: {title}"
        )
        
        await self._send_notification(
            title=title,
            body=body,
            subscription_ids=subscription_ids,
            notification_level=notification_level
        )
    
    @workflow.signal
    async def cancel_event(self):
        """Signal: Event cancelled by organizer"""
        workflow.logger.info(f"Event {self.event_id} cancelled")
        
        await self._send_notification(
            title=f"Event Cancelled: {self.event_data['name']}",
            body="This event has been cancelled by the organizer.",
            notification_level="critical"
        )
        
        self.is_cancelled = True
    
    def _format_update_message(self, updated_data: dict) -> str:
        """Format update notification message"""
        changes = []
        if 'name' in updated_data:
            changes.append(f"Name: {updated_data['name']}")
        if 'start_date' in updated_data:
            changes.append(f"Start time: {updated_data['start_date']}")
        if 'location' in updated_data:
            changes.append(f"Location: {updated_data['location']}")
        if 'description' in updated_data:
            changes.append(f"Description updated")
        
        return "Event details have been updated:\n" + "\n".join(f"• {c}" for c in changes)
```

---

### ReminderWorkflow

Short-lived workflow triggered by Temporal Schedules to send subscriber-specific reminders.

#### Purpose
- Execute SUBSCRIBER-DRIVEN scheduled reminder notifications
- Fire at subscriber's chosen times before events (custom offsets)
- Triggered by per-subscription Temporal Schedules
- Send to INDIVIDUAL subscriber only (not broadcast)

#### Signature

```python
@workflow.defn
class ReminderWorkflow:
    @workflow.run
    async def run(self, event_id: int, subscription_id: int, offset_seconds: int) -> str:
        """
        Send a scheduled reminder to a SINGLE subscriber.
        
        Args:
            event_id: Database ID of the event
            subscription_id: Specific subscription to notify
            offset_seconds: How many seconds before event this reminder is for
        
        Returns:
            Success status
        """
```

#### Implementation

```python
# src/workflows/reminder.py
from temporalio import workflow
from datetime import timedelta
from src.activities.notifications import send_reminder_notification
from src.activities.events import get_event_details

@workflow.defn
class ReminderWorkflow:
    @workflow.run
    async def run(self, event_id: int, reminder_type: str) -> str:
        """Send scheduled reminder notification"""
        workflow.logger.info(
            f"Starting ReminderWorkflow for event {event_id}, type {reminder_type}"
        )
        
        # Get current event details (in case of updates since schedule creation)
        event_data = await workflow.execute_activity(
            get_event_details,
            event_id,
            start_to_close_timeout=timedelta(seconds=30)
        )
        
        if not event_data:
            workflow.logger.error(f"Event {event_id} not found, skipping reminder")
            return "event_not_found"
        
        # Send reminder notification
        result = await workflow.execute_activity(
            send_reminder_notification,
            args=[event_id, reminder_type, event_data],
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=workflow.RetryPolicy(
                maximum_attempts=3,
                initial_interval=timedelta(seconds=2),
                maximum_interval=timedelta(seconds=30),
            )
        )
        
        workflow.logger.info(
            f"ReminderWorkflow completed for event {event_id}: {result}"
        )
        return "success"
```

---

## Activities

Activities handle all external operations (database, Apprise, Temporal Schedules).

### Notification Activities

#### send_notification

Send notifications to event subscribers via Apprise.

```python
# src/activities/notifications.py
from temporalio import activity
from datetime import timedelta
import httpx
from src.db.session import get_session
from src.db.repositories import SubscriptionRepository, IntegrationRepository

@activity.defn
async def send_notification(
    event_id: int,
    notification_level: str,
    title: str,
    body: str,
    subscription_ids: list[int] | None = None
) -> dict:
    """
    Send notification to event subscribers.
    
    Args:
        event_id: Event database ID
        notification_level: "info", "warning", or "critical"
        title: Notification title
        body: Notification body
        subscription_ids: Optional list of specific subscriptions to notify
    
    Returns:
        Dictionary with delivery statistics
    """
    activity.logger.info(
        f"Sending notification for event {event_id}: {title} (level={notification_level})"
    )
    
    async with get_session() as session:
        sub_repo = SubscriptionRepository(session)
        int_repo = IntegrationRepository(session)
        
        # Get subscriptions (all or specific IDs)
        if subscription_ids:
            subscriptions = [
                await sub_repo.get_by_id(sub_id) for sub_id in subscription_ids
            ]
            subscriptions = [s for s in subscriptions if s]  # Filter None
        else:
            subscriptions = await sub_repo.get_by_event(event_id)
        
        activity.logger.info(f"Delivering to {len(subscriptions)} subscriptions")
        
        delivered = 0
        failed = 0
        results = []
        
        # Resolve and deliver for each subscription
        for subscription in subscriptions:
            # Resolve target integrations via selectors
            target_integrations = await _resolve_integration_targets(
                subscription, int_repo
            )
            
            if not target_integrations:
                activity.logger.warning(
                    f"No active integrations for subscription {subscription.id}"
                )
                results.append({
                    "subscription_id": subscription.id,
                    "status": "no_targets",
                    "integrations_tried": 0
                })
                failed += 1
                continue
            
            # Deliver to each integration
            sub_delivered = 0
            sub_failed = 0
            
            for integration in target_integrations:
                try:
                    success = await _send_via_apprise(
                        integration.apprise_url,
                        title,
                        body,
                        notification_level
                    )
                    if success:
                        sub_delivered += 1
                    else:
                        sub_failed += 1
                except Exception as e:
                    activity.logger.error(
                        f"Failed to send via integration {integration.id}: {e}"
                    )
                    sub_failed += 1
            
            # Record result for this subscription
            results.append({
                "subscription_id": subscription.id,
                "status": "delivered" if sub_delivered > 0 else "failed",
                "integrations_tried": len(target_integrations),
                "delivered": sub_delivered,
                "failed": sub_failed
            })
            
            if sub_delivered > 0:
                delivered += 1
            else:
                failed += 1
        
        activity.logger.info(
            f"Notification delivery complete: {delivered} delivered, {failed} failed"
        )
        
        return {
            "delivered": delivered,
            "failed": failed,
            "total": len(subscriptions),
            "results": results
        }


async def _resolve_integration_targets(subscription, int_repo):
    """
    Resolve subscription selectors to actual integration targets.
    Returns deduplicated list of active integrations.
    """
    targets = set()
    
    for selector in subscription.selectors:
        if selector.integration_id:
            # Explicit integration
            integration = await int_repo.get_by_id(selector.integration_id)
            if integration and integration.is_active:
                targets.add(integration.id)
        elif selector.tag:
            # Tag-based: get all user integrations matching tag
            integrations = await int_repo.get_by_user_and_tag(
                subscription.user_id,
                selector.tag,
                active_only=True
            )
            for integration in integrations:
                targets.add(integration.id)
    
    # Load full integration objects
    return [
        await int_repo.get_by_id(int_id)
        for int_id in targets
    ]


async def _send_via_apprise(
    apprise_url: str,
    title: str,
    body: str,
    notification_level: str
) -> bool:
    """
    Send notification via Apprise URL.
    Returns True if at least one service succeeded (handles 424 partial failures).
    """
    # Map notification_level to Apprise notify_type
    notify_type_map = {
        "info": "info",
        "warning": "warning",
        "critical": "failure"
    }
    notify_type = notify_type_map.get(notification_level, "info")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                "http://localhost:8000/notify",  # Apprise API endpoint
                json={
                    "urls": apprise_url,
                    "title": title,
                    "body": body,
                    "type": notify_type
                }
            )
            
            # 200 = full success
            if response.status_code == 200:
                return True
            
            # 424 = partial failure (some services succeeded)
            if response.status_code == 424:
                # Parse response to check if ANY notifications succeeded
                data = response.json()
                if "Sent" in str(data):
                    activity.logger.warning(
                        f"Partial delivery success (424): {data}"
                    )
                    return True
                activity.logger.error(f"All deliveries failed (424): {data}")
                return False
            
            # Other errors
            activity.logger.error(
                f"Apprise API error {response.status_code}: {response.text}"
            )
            return False
            
        except Exception as e:
            activity.logger.error(f"Failed to call Apprise API: {e}")
            return False
```

---

#### send_reminder_notification

Specialized activity for reminder notifications (called by ReminderWorkflow).

```python
@activity.defn
async def send_reminder_notification(
    event_id: int,
    reminder_type: str,
    event_data: dict
) -> dict:
    """
    Send scheduled reminder notification.
    
    Args:
        event_id: Event database ID
        reminder_type: "1day" or "1hour"
        event_data: Current event details
    
    Returns:
        Delivery statistics
    """
    # Format reminder message
    if reminder_type == "1day":
        title = f"Reminder: {event_data['name']} is tomorrow"
        body = f"Don't forget! Your event '{event_data['name']}' starts tomorrow."
    elif reminder_type == "1hour":
        title = f"Starting Soon: {event_data['name']}"
        body = f"Your event '{event_data['name']}' starts in 1 hour!"
    else:
        title = f"Reminder: {event_data['name']}"
        body = f"Reminder for '{event_data['name']}'"
    
    # Add event details to body
    if event_data.get('location'):
        body += f"\n\nLocation: {event_data['location']}"
    if event_data.get('start_date'):
        body += f"\nTime: {event_data['start_date']}"
    
    # Use the main notification activity
    return await send_notification(
        event_id=event_id,
        notification_level="warning",  # Reminders are elevated
        title=title,
        body=body,
        subscription_ids=None  # Send to all subscribers
    )
```

---

### Schedule Management Activities

#### create_reminder_schedules

Create Temporal Schedules for event reminders.

```python
@activity.defn
async def create_reminder_schedules(event_id: int, start_date_iso: str) -> dict:
    """
    Create Temporal Schedules for event reminders.
    
    Args:
        event_id: Event database ID
        start_date_iso: Event start date as ISO8601 string
    
    Returns:
        Dictionary with created schedule IDs
    """
    from datetime import datetime, timedelta
    from temporalio.client import Client
    from src.config import get_settings
    
    settings = get_settings()
    start_date = datetime.fromisoformat(start_date_iso.replace('Z', '+00:00'))
    
    activity.logger.info(
        f"Creating reminder schedules for event {event_id}, start_date={start_date}"
    )
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    schedules_created = []
    
    # Define reminder times
    reminders = [
        {"type": "1day", "offset": timedelta(days=1)},
        {"type": "1hour", "offset": timedelta(hours=1)}
    ]
    
    for reminder in reminders:
        schedule_id = f"event-{event_id}-reminder-{reminder['type']}"
        trigger_time = start_date - reminder['offset']
        
        # Skip if reminder time is in the past
        if trigger_time < datetime.now(timezone.utc):
            activity.logger.warning(
                f"Skipping {reminder['type']} reminder (trigger time in past)"
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
                        id=f"{schedule_id}-{event_id}",
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
                        note=f"Reminder for event {event_id}",
                        paused=False
                    )
                )
            )
            
            schedules_created.append(schedule_id)
            activity.logger.info(f"Created schedule {schedule_id} at {trigger_time}")
            
        except Exception as e:
            # Schedule might already exist (idempotency)
            if "already exists" in str(e).lower():
                activity.logger.info(f"Schedule {schedule_id} already exists")
                schedules_created.append(schedule_id)
            else:
                activity.logger.error(f"Failed to create schedule {schedule_id}: {e}")
                raise
    
    return {
        "event_id": event_id,
        "schedules_created": schedules_created
    }
```

---

#### delete_reminder_schedules

Delete Temporal Schedules for event reminders.

```python
@activity.defn
async def delete_reminder_schedules(event_id: int) -> dict:
    """
    Delete Temporal Schedules for event reminders.
    
    Args:
        event_id: Event database ID
    
    Returns:
        Dictionary with deleted schedule IDs
    """
    from temporalio.client import Client
    from src.config import get_settings
    
    settings = get_settings()
    
    activity.logger.info(f"Deleting reminder schedules for event {event_id}")
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    schedules_deleted = []
    
    # Schedule IDs to delete
    reminder_types = ["1day", "1hour"]
    
    for reminder_type in reminder_types:
        schedule_id = f"event-{event_id}-reminder-{reminder_type}"
        
        try:
            handle = client.get_schedule_handle(schedule_id)
            await handle.delete()
            
            schedules_deleted.append(schedule_id)
            activity.logger.info(f"Deleted schedule {schedule_id}")
            
        except Exception as e:
            # Schedule might not exist (already deleted or never created)
            if "not found" in str(e).lower():
                activity.logger.info(f"Schedule {schedule_id} not found (already deleted)")
            else:
                activity.logger.error(f"Failed to delete schedule {schedule_id}: {e}")
                # Don't raise - cleanup is best-effort
    
    return {
        "event_id": event_id,
        "schedules_deleted": schedules_deleted
    }
```

---

### Event Activities

#### validate_event_exists

```python
@activity.defn
async def validate_event_exists(event_id: int) -> bool:
    """Validate that event exists in database"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        return event is not None
```

#### get_event_details

```python
@activity.defn
async def get_event_details(event_id: int) -> dict | None:
    """Get current event details from database"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        if not event:
            return None
        return {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "timezone": event.timezone
        }
```

### ⚠️ Critical: Database Session Handling in Activities

**IMPORTANT**: All Temporal activities MUST use `get_session()` context manager, NOT `get_db_session()` generator.

**❌ WRONG - Causes greenlet errors**:
```python
from src.db.session import get_db_session

async for session in get_db_session():  # ❌ DON'T DO THIS
    repo = SomeRepository(session)
    data = await repo.get_by_id(id)
```

**✅ CORRECT - Works in Temporal activities**:
```python
from src.db.session import get_session

async with get_session() as session:  # ✅ USE THIS
    repo = SomeRepository(session)
    data = await repo.get_by_id(id)
```

**Why**: `get_db_session()` is designed for FastAPI dependency injection. Temporal's execution context doesn't support the async generator pattern, resulting in:
```
greenlet_spawn has not been called; can't call await_only() here
```

**Additional Requirement**: Repositories must eagerly load relationships to prevent lazy loading outside session context:
```python
# In repositories
result = await self.session.execute(
    select(Model)
    .where(Model.id == id)
    .options(selectinload(Model.relationship))  # ✅ Eager load
)
```

**See Also**: [`docs/implementation/phase-plan.md`](../implementation/phase-plan.md#67-critical-database-session-handling-in-activities) for complete documentation.

---

## Temporal Schedules

### Overview

Temporal Schedules are used for **SUBSCRIBER-DRIVEN** personal reminders.

**Key Principle**: Each subscription gets its own schedules based on the subscriber's chosen reminder times.

### Naming Convention

```
Per-Subscription Format:
  event-{event_id}-sub-{subscription_id}-reminder-{offset_seconds}s

Examples:
  event-123-sub-456-reminder-86400s   (User A's 1-day reminder)
  event-123-sub-456-reminder-3600s    (User A's 1-hour reminder)
  event-123-sub-789-reminder-1800s    (User B's 30-min reminder)
  event-123-sub-999-reminder-300s     (User C's 5-min reminder)
```

### Lifecycle

1. **Initial Creation**: When event is created, create schedules for ALL existing subscriptions
2. **Incremental Creation**: When new subscriber joins, create schedules for THAT subscription only
3. **Rescheduling**: If event start_date changes, delete ALL schedules and recreate for ALL subscriptions
4. **Deletion**: When event completes/cancels, delete ALL schedules for that event
5. **Unsubscribe**: When user unsubscribes, delete schedules for THAT subscription only

### Idempotency

- Schedule IDs are deterministic (based on event_id + subscription_id + offset)
- Creation handles "already exists" errors gracefully (treat as success)
- Deletion handles "not found" errors gracefully (already deleted)
- Multiple signals can safely try to create same schedule

---

## Signals

EventWorkflow accepts the following signals:

| Signal | Purpose | Arguments | Response | Notification Type |
|--------|---------|-----------|----------|-------------------|
| `participant_added` | New subscription | `{subscription_id, user_id}` | Creates per-subscription reminder schedules | SUBSCRIBER-DRIVEN (schedules) |
| `participant_removed` | Unsubscribe | `{subscription_id}` | Deletes schedules for that subscription | N/A |
| `event_updated` | Event details changed | `{name?, start_date?, location?, ...}` | **EVENT-DRIVEN**: Broadcasts to ALL subscribers immediately, reschedules if needed | EVENT-DRIVEN (broadcast) |
| `send_manual_notification` | Custom organizer message | `{title, body, subscription_ids?, notification_level?}` | **EVENT-DRIVEN**: Sends to ALL/selected subscribers | EVENT-DRIVEN (broadcast) |
| `cancel_event` | Event cancelled | None | **EVENT-DRIVEN**: Broadcasts cancellation to ALL, ends workflow | EVENT-DRIVEN (broadcast) |

---

## Error Handling

### Retry Policies

**Notification Activities**:
```python
retry_policy=workflow.RetryPolicy(
    maximum_attempts=3,
    initial_interval=timedelta(seconds=1),
    maximum_interval=timedelta(seconds=10),
)
```

**Schedule Management Activities**:
```python
retry_policy=workflow.RetryPolicy(
    maximum_attempts=2,
    initial_interval=timedelta(seconds=2),
    maximum_interval=timedelta(seconds=30),
)
```

### Failure Handling

- **Partial notification failures**: Log and continue (tracked in activity results)
- **Schedule creation failures**: Raise exception, fail workflow start
- **Schedule deletion failures**: Log and continue (best-effort cleanup)
- **Database connection failures**: Retry via activity retry policy

---

## Testing

### Unit Tests

```python
# tests/test_workflows.py
import pytest
from temporalio.testing import WorkflowEnvironment
from src.workflows.event import EventWorkflow

@pytest.mark.asyncio
async def test_event_workflow_creation():
    async with await WorkflowEnvironment.start_local() as env:
        async with Worker(
            env.client,
            task_queue="test-queue",
            workflows=[EventWorkflow],
            activities=[send_notification, create_reminder_schedules]
        ):
            result = await env.client.execute_workflow(
                EventWorkflow.run,
                args=[1, {"name": "Test Event", "start_date": "2025-10-10T10:00:00Z"}],
                id="test-workflow",
                task_queue="test-queue"
            )
            assert result == "completed"
```

### Integration Tests

Test with real Temporal server:

```bash
# Start Temporal dev server
temporal server start-dev

# Run integration tests
pytest tests/integration/test_workflows_integration.py
```

---

## Summary

This specification provides:
- ✅ Complete EventWorkflow with signal handling
- ✅ ReminderWorkflow triggered by per-subscription Temporal Schedules
- ✅ Schedule management in activities (idempotent)
- ✅ Notification activities with selector-based routing
- ✅ Error handling and retry policies
- ✅ Continue-As-New to prevent history bloat
- ✅ Testing strategies

### Critical Architectural Distinction

**Two Fundamentally Different Notification Patterns:**

#### 1. Event-Driven Notifications (Broadcast)
- **When**: Organizer takes action (update, cancel, announce)
- **Who**: ALL subscribers at once
- **How**: Direct activity call from signal handler
- **Timing**: Immediate (real-time)
- **Examples**: Event updated, event cancelled, manual announcement

#### 2. Subscriber-Driven Reminders (Personal)
- **When**: Time-based (subscriber's chosen times)
- **Who**: Individual subscriber
- **How**: Temporal Schedule → ReminderWorkflow → Activity
- **Timing**: Scheduled (X seconds before event)
- **Examples**: "Remind me 1 day before", "Remind me 30 minutes before"

**DO NOT MIX THESE**: Event updates are NOT schedules. Personal reminders are NOT broadcasts.

**Next Steps**: Implement api-specification.md to define HTTP endpoints and request/response contracts.
