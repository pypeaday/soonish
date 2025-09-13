# Soonish Process Flow Documentation

## 1. **High-Level Flow**

1. **Event Creation**

   * Organizer creates an event via `POST /events`.
   * Event details persisted to DB (`Event`, `EventDetails` tables).
   * `EventWorkflow` instance is started in Temporal.

2. **Participant Subscription**

   * Users subscribe via `POST /events/{event_id}/subscribe`.
   * Participant row added to `EventParticipants` table.
   * Temporal workflow is signaled with new participant info.
   * User’s tags for notifications are validated against `Integrations.tags` for a user_id.

3. **Notification Scheduling**

   * Temporal schedules notifications based on:

     * Participant preferences (`custom_frequency`, `custom_time_delta_seconds`)
     * Event start/end times
   * Each schedule is tied to a workflow execution.

4. **Notification Execution**

   * Temporal executes `send_notifications` activity at scheduled time.
   * Activity:

     * Queries DB for participant integrations filtered by matching tags.
     * Builds `Apprise()` object in memory.
     * Calls `.notify(title, body)`.
     * Raises exception on failure → Temporal retries per policy.
   * Workflow logs outcome and maintains audit trail.

5. **Event Updates**

   * Organizer updates event via `POST /events/{event_id}/update`.
   * Workflow signals triggered for updates.
   * Notifications are scheduled or re-scheduled as needed.

6. **Optional Logging**

   * Success/failure logged in workflow history.
   * Optional `NotificationLog` table stores per-participant delivery attempts.

---

## 2. **Sequence Flow**

```
User/Organizer            FastAPI API                Database                Temporal Workflow             Apprise
     |                        |                          |                           |                       |
     |  POST /events           |                          |                           |                       |
     |----------------------->|                          |                           |                       |
     |                        | Insert Event + Details  |                           |                       |
     |                        |------------------------>|                           |                       |
     |                        |                          | Start EventWorkflow       |                       |
     |                        |                          |-------------------------->|                       |
     |                        |                          |                           |                       |
Participant subscribes        |                          |                           |                       |
     |  POST /events/{id}/subscribe                     |                           |                       |
     |----------------------->|                          | Insert participant        |                       |
     |                        |------------------------>|                           |                       |
     |                        | Signal EventWorkflow    |                           |                       |
     |                        |------------------------>|                           |                       |
Temporal Workflow schedules notifications based on participant tags and timing
     |                        |                          |                           |                       |
     |                        |                          |                           | Build Apprise object  |
     |                        |                          |                           |---------------------->|
     |                        |                          |                           | notify(title, body)  |
     |                        |                          |                           |---------------------->|
     |                        |                          |                           | Return success/fail  |
Temporal Workflow handles retry if activity fails
     |                        |                          |                           |                       |
     |                        |                          |                           |                       |
```

---

## 3. **Process Flow Notes**

* **Schedules:** Each participant can have multiple schedules (e.g., reminder 1 hour before event, daily countdown). Temporal’s overlap policy prevents duplicate notifications if schedules collide.
* **Dynamic Updates:** Changes to participant preferences or event details update or cancel existing schedules automatically.
* **Tag-Driven Delivery:** Notifications are sent only via integrations matching the participant’s selected tags.
* **Retries & Logging:** Temporal SDK handles retry/backoff; workflow history serves as durable log.
* **Extensibility:** Supports multiple notification channels (email, push, Slack, etc.) via Apprise.
* **Observability:** Workflow history + optional `NotificationLog` table provides full auditability of all notification attempts.
