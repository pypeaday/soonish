# Soonish Architecture & Design Specification

## 1. **Overview**

Soonish is a notification-first service for events, targeting users where they already are rather than requiring them to use a specific app. Its primary goal is to allow event organizers to communicate with participants through their preferred channels, leveraging **Apprise** for notifications and **Temporal.io** for workflow orchestration and scheduling.

---

## 2. **Core Components**

### 2.1 Backend

* **Language:** Python
* **Framework:** FastAPI for REST endpoints
* **Workflow Orchestration:** Temporal.io (Python SDK)
* **Database:** SQLite initially; Postgres for scaling
* **Notification Library:** Apprise (Python package)

### 2.2 Frontend

* **Technology:** HTMX for initial prototype
* **UI Features:** Event creation, participant management, integration configuration

### 2.3 Temporal Components

* **EventWorkflows:** Represent lifecycle of events

  * Tracks status (created, updated, canceled)
  * Handles participant subscriptions
  * Receives signals for updates and triggers notification schedules
* **Activities:**

  * `send_notifications`: Constructs Apprise object, sends notifications, raises exceptions on failure
* **Schedules:**

  * Used for participant-specific notification times (e.g., reminders 1 hour before event)
  * Supports dynamic updates, pause/resume, and overlap policies

---

## 3. **Data Model**

### 3.1 User

* `id: uuid`
* `email: string`
* `is_verified: bool`
* `verify_sent_at: datetime`
* `organization_id: uuid`

### 3.2 Organization

* `id: uuid`
* `name: string`
* `owner_user_id: uuid`
* `admin_user_ids: uuid[]`
* `user_ids: uuid[]`

### 3.3 Integrations

* `id: uuid`
* `user_id: uuid`
* `apprise_url: string` (e.g., `mailto://user:pass@gmail.com`)
* `tags: list[string]` (user-defined)
* `last_synced_at: datetime`

### 3.4 Event

* `id: uuid`
* `owner_user_id: uuid`
* `event_details: EventDetails`
* `status: string`
* `public: bool`
* `allowed_user_ids: uuid[]`

### 3.5 EventDetails

* `event_id: uuid`
* `name: string`
* `start_date: datetime`
* `end_date: datetime`
* `extra_details: json`

### 3.6 EventParticipants

* `id: uuid`
* `event_id: uuid`
* `user_id: uuid`
* `notification_tags: list[string]`
* `custom_frequency: enum["EVERY", "BEFORE"]`
* `custom_time_delta_seconds: int`

---

## 4. **REST API Specification**

### Users

* `POST /users`: Create user
* `GET /users/{id}`: Fetch user info

### Integrations

* `POST /integrations`: Add or update user notification integrations
* `GET /integrations/{user_id}`: List user integrations

### Events

* `POST /events`: Create event
* `POST /events/{event_id}/subscribe`: Subscribe participant
* `POST /events/{event_id}/update`: Update event
* `POST /events/{event_id}/unsubscribe`: Remove participant

---

## 5. **Notification Flow**

1. **Trigger Event:** Event update, reminder, or participant query triggers `NotificationRequested`.
2. **Temporal Schedule:** Workflow schedules notification activity at user-specific times.
3. **Activity Execution (`send_notifications`):**

   * Load participant integrations for the specified tags.
   * Build in-memory Apprise object.
   * Call `.notify()` to send messages.
   * Raise exception on failure; Temporal retries automatically.
4. **Logging & Observability:** Workflow history provides audit log; optional `NotificationLog` table captures success/failure per participant.

---

## 6. **Temporal Schedule Integration**

* **Purpose:** Replace custom scheduling for reminders/participant-specific notification timing.
* **Capabilities:**

  * Schedule notifications at fixed times or relative to events (e.g., `custom_time_delta_seconds` before start)
  * Supports dynamic updates (pause/resume/change)
  * Handles overlapping schedules using policies like `Skip`, `BufferOne`, or `TerminateOther`
* **Management:** Each schedule is tied to a workflow instance; updates are propagated when participant preferences or event details change.

---

## 7. **Feature Summary**

* **Event Management**

  * Create, update, cancel events
  * Public or private visibility
* **Participant Management**

  * Subscribe/unsubscribe
  * Tag-based notification preferences
  * Custom notification frequency/delta
* **Notification Backend**

  * Apprise library-based notifications
  * Tag-driven delivery to multiple channels
  * Retry and logging via Temporal
* **Schedules & Timing**

  * Temporal schedules for precise, dynamic timing
  * Handles backfills and missed notifications
* **Security**

  * API auth & rate-limiting
  * User verification
* **Scalability**

  * Start with SQLite; migrate to Postgres
  * Temporal ensures reliability and retry logic

---

## 8. **Design Principles**

1. **Minimal backend orchestration** — leverage Temporal for retry, logging, and scheduling
2. **Dynamic Apprise config** — DB-driven, no server-side config required
3. **User-centric notifications** — users control channels via tags
4. **Extensibility** — support for multiple markets (events, volunteer coordination, IT notifications)
5. **Observability and auditability** — workflow history + optional DB logs
