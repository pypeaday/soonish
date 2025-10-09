# Notification Patterns Architecture

**Status**: Authoritative  
**Last Updated**: 2025-10-08  
**Purpose**: Clarifies the two distinct notification patterns in Soonish

---

## Overview

Soonish has **two fundamentally different notification patterns** that must not be conflated:

1. **Event-Driven Notifications** (Broadcast)
2. **Subscriber-Driven Reminders** (Personal)

---

## 1. Event-Driven Notifications (Broadcast)

### Characteristics
- **Trigger**: Organizer action (update event, cancel event, send announcement)
- **Recipients**: ALL subscribers at once
- **Timing**: Immediate (when action occurs)
- **Implementation**: Direct activity call from EventWorkflow signal handler
- **No Schedules**: These are real-time, not time-based

### Flow Diagram
```
Organizer Action (via API)
    ↓
EventWorkflow Signal
    ↓
send_notification_to_subscribers Activity
    ↓
Broadcast to ALL Subscribers
    ↓
Apprise → Gotify/Email/etc.
```

### Examples
- **Event Updated**: Location changed → Notify ALL subscribers NOW
- **Event Cancelled**: Organizer cancels → Notify ALL subscribers NOW
- **Manual Announcement**: Organizer sends message → Notify ALL/selected subscribers NOW

### Code Pattern
```python
@workflow.signal
async def event_updated(self, updated_data: dict):
    # EVENT-DRIVEN: Immediate broadcast
    await workflow.execute_activity(
        send_notification_to_subscribers,
        args=[event_id, title, body, level],
        ...
    )
```

---

## 2. Subscriber-Driven Reminders (Personal)

### Characteristics
- **Trigger**: Time-based (subscriber's chosen reminder times)
- **Recipients**: Individual subscriber only
- **Timing**: Scheduled (X seconds before event)
- **Implementation**: Temporal Schedule → ReminderWorkflow → Activity
- **Per-Subscription Schedules**: Each subscription gets its own schedules

### Flow Diagram
```
User Subscribes (via API)
    ↓
EventWorkflow.participant_added Signal
    ↓
create_reminder_schedules_for_subscription Activity
    ↓
Create Temporal Schedules (per-subscription)
    ↓
[Time passes...]
    ↓
Schedule Fires at Chosen Time
    ↓
ReminderWorkflow Starts
    ↓
send_reminder_notification Activity
    ↓
Send to THAT Subscriber Only
    ↓
Apprise → Gotify/Email/etc.
```

### Examples
- **User A**: Wants reminder 1 day before → Schedule: `event-123-sub-456-reminder-86400s`
- **User B**: Wants reminder 30 minutes before → Schedule: `event-123-sub-789-reminder-1800s`
- **User C**: Opts out → No schedules created

### Code Pattern
```python
@workflow.signal
async def participant_added(self, subscription_data: dict):
    # SUBSCRIBER-DRIVEN: Create personal schedules
    await workflow.execute_activity(
        create_reminder_schedules_for_subscription,
        args=[event_id, subscription_id, start_date],
        ...
    )
```

---

## Comparison Table

| Aspect | Event-Driven (Broadcast) | Subscriber-Driven (Personal) |
|--------|--------------------------|------------------------------|
| **Trigger** | Organizer action | Time-based |
| **Recipients** | ALL subscribers | Individual subscriber |
| **Timing** | Immediate | Scheduled |
| **Implementation** | Activity call | Schedule → Workflow → Activity |
| **Schedules?** | ❌ No | ✅ Yes (per-subscription) |
| **Examples** | Event updated, cancelled | "Remind me 1h before" |
| **Signal** | `event_updated`, `cancel_event` | `participant_added` |

---

## Common Mistakes to Avoid

### ❌ DON'T: Use schedules for event updates
```python
# WRONG: Event updates should be immediate, not scheduled
@workflow.signal
async def event_updated(self, updated_data: dict):
    # Don't create a schedule for this!
    await create_schedule_for_update(...)  # ❌ WRONG
```

### ✅ DO: Use direct activity call for event updates
```python
# CORRECT: Event updates are immediate broadcasts
@workflow.signal
async def event_updated(self, updated_data: dict):
    await workflow.execute_activity(
        send_notification_to_subscribers,  # ✅ CORRECT
        args=[event_id, title, body, level]
    )
```

### ❌ DON'T: Broadcast personal reminders to all subscribers
```python
# WRONG: Personal reminders should go to individual subscriber
async def run(self, event_id: int, reminder_type: str):
    # Don't send to ALL subscribers
    await send_notification_to_subscribers(event_id, ...)  # ❌ WRONG
```

### ✅ DO: Send personal reminders to specific subscriber
```python
# CORRECT: Personal reminders go to specific subscription
async def run(self, event_id: int, subscription_id: int, offset: int):
    await send_notification_to_subscription(
        event_id, subscription_id, ...  # ✅ CORRECT
    )
```

---

## Schedule Naming Convention

**Per-Subscription Format**:
```
event-{event_id}-sub-{subscription_id}-reminder-{offset_seconds}s
```

**Examples**:
```
event-123-sub-456-reminder-86400s   # User A's 1-day reminder
event-123-sub-456-reminder-3600s    # User A's 1-hour reminder
event-123-sub-789-reminder-1800s    # User B's 30-min reminder
```

**Why per-subscription?**
- Easy to track which subscriber a reminder is for
- Easy to delete when user unsubscribes
- Clear ownership and debugging
- Idempotent (deterministic IDs)

---

## Implementation Checklist

When implementing notification features, ask:

**Is this event-driven or subscriber-driven?**

### Event-Driven (Broadcast)
- [ ] Triggered by organizer action?
- [ ] Needs to notify ALL subscribers?
- [ ] Needs to happen immediately?
- [ ] → Use direct activity call from signal handler
- [ ] → NO schedules needed

### Subscriber-Driven (Personal)
- [ ] Triggered by time (before event)?
- [ ] Notifies individual subscriber?
- [ ] User chose this reminder time?
- [ ] → Create Temporal Schedule
- [ ] → Schedule triggers ReminderWorkflow
- [ ] → ReminderWorkflow sends to that subscriber only

---

## Summary

**Two patterns, two implementations, don't mix them:**

1. **Event-Driven** = Organizer action → Signal → Activity → Broadcast to ALL
2. **Subscriber-Driven** = User choice → Schedule → Workflow → Send to ONE

**Remember**: Event updates are NOT schedules. Personal reminders are NOT broadcasts.
