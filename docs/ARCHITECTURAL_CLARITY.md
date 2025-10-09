# Architectural Clarity: Notification Patterns

**Date**: 2025-10-08  
**Status**: Critical Design Decision

---

## The Confusion

We initially conflated two fundamentally different notification patterns, leading to:
- Duplicate schedule creation
- Unclear responsibilities
- Mixed broadcast/personal logic
- Idempotency issues

---

## The Clarity

Soonish has **TWO DISTINCT notification patterns**:

### 1. Event-Driven Notifications (Broadcast)
**What**: Organizer sends update to everyone  
**When**: Immediate (when event changes)  
**Who**: ALL subscribers at once  
**How**: Signal → Activity → Broadcast  
**No Schedules**: Real-time, not time-based

**Examples**:
- Event location changed
- Event cancelled
- Organizer sends announcement

### 2. Subscriber-Driven Reminders (Personal)
**What**: User's personal reminder  
**When**: Scheduled (X time before event)  
**Who**: Individual subscriber  
**How**: Schedule → ReminderWorkflow → Activity  
**Per-Subscription Schedules**: Each user's own reminders

**Examples**:
- "Remind me 1 day before"
- "Remind me 30 minutes before"
- User opts out (no schedules)

---

## Implementation Impact

### EventWorkflow Signals

**Event-Driven (Broadcast)**:
- `event_updated` → Notify ALL subscribers NOW
- `cancel_event` → Notify ALL subscribers NOW
- `send_manual_notification` → Notify ALL/selected NOW

**Subscriber-Driven (Schedules)**:
- `participant_added` → Create schedules for THAT subscription
- `participant_removed` → Delete schedules for THAT subscription

### Schedule Naming

**Per-Subscription Format**:
```
event-{event_id}-sub-{subscription_id}-reminder-{offset_seconds}s
```

**NOT** per-event-time (grouped):
```
event-{event_id}-reminder-{offset_seconds}s  # ❌ WRONG
```

### ReminderWorkflow

**Signature**:
```python
async def run(self, event_id: int, subscription_id: int, offset_seconds: int)
```

**NOT**:
```python
async def run(self, event_id: int, reminder_type: str)  # ❌ OLD
```

---

## Documentation Updated

✅ **temporal-specification.md**:
- Added "Two Notification Patterns" section
- Updated EventWorkflow responsibilities
- Updated ReminderWorkflow signature
- Updated schedule naming convention
- Updated signals table with notification types
- Added critical distinction summary

✅ **notification-patterns.md** (NEW):
- Complete architecture guide
- Flow diagrams for both patterns
- Comparison table
- Common mistakes to avoid
- Implementation checklist

---

## Next Steps: Re-implementation

Now that docs are clear, we need to:

1. **Fix EventWorkflow**:
   - `participant_added` → Create schedules incrementally (per-subscription)
   - `event_updated` → Broadcast immediately (no schedule recreation unless start_date changes)
   - Remove welcome notifications from workflow (API handles this)

2. **Fix ReminderWorkflow**:
   - Update signature: `(event_id, subscription_id, offset_seconds)`
   - Send to specific subscription only
   - Format message based on offset_seconds

3. **Fix Schedule Activities**:
   - `create_reminder_schedules_for_subscription` → Create for ONE subscription
   - `create_reminder_schedules` → Create for ALL subscriptions (initial event creation)
   - Handle "already exists" as success (idempotency)

4. **Update Tests**:
   - Test both patterns separately
   - Verify schedules are per-subscription
   - Verify broadcasts go to all subscribers

---

## Key Takeaway

**Event updates are NOT schedules. Personal reminders are NOT broadcasts.**

These are two completely different concerns with different triggers, recipients, timing, and implementations. Keeping them separate makes the system clearer, more maintainable, and easier to debug.
