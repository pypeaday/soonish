# Architecture

## Overview

Soonish is a notification-first event communication service. The backend is built with **Python** + **Temporal.io**. Frontend starts with **HTMX**, backend API uses **FastAPI**, and data is stored in **SQLite** initially (migratable to Postgres later).

The key design principle: **notifications where users already are**. Event organizers create events, users subscribe, and notifications are sent through their preferred channels via **Apprise**.

---

## Core Components

### 1. **Temporal Workflows**

* **EventWorkflow** – represents lifecycle of a single event.

  * Tracks state: created, updated, canceled.
  * Handles timers for reminders.
  * Accepts signals for updates (time change, cancellation, etc.).
  * Calls notification activities.

### 2. **Temporal Activities**

* **send\_notifications** – wraps Apprise notification logic.

  * Query database for participants + tags.
  * Build `Apprise()` object with user’s integration URLs.
  * Call `.notify()`.
  * Raise exception on failure to trigger Temporal retries.
* All retries, logging, and idempotency handled via Temporal SDK.

### 3. **FastAPI Backend**

* REST API for event creation, updates, participant subscriptions.
* Endpoints for managing user integrations.
* Auth-protected + rate-limited.

### 4. **Database (SQLite → Postgres)**

* Tables:

  * **Organization**
  * **User** (with `config_key` as deterministic hash)
  * **Integrations** (stores Apprise URLs + tags)
  * **EventDetails**
  * **EventParticipants**
  * **EventUpdateContent**
* DB is source of truth for user integrations and event state.

### 5. **Apprise Integration**

* Soonish stores **Apprise URLs** and associated tags per user.
* No persistent Apprise server config; config is dynamically built per notification.
* Notification call = build Apprise object in-memory + call `.notify()`.

---

# Domain Events

| Event                   | Trigger                        | Workflow Action                            |
| ----------------------- | ------------------------------ | ------------------------------------------ |
| EventCreated            | User creates event             | Start new `EventWorkflow` instance         |
| EventUpdated            | Organizer changes details      | Send signal to workflow + update DB        |
| EventCanceled           | Organizer cancels event        | Workflow issues cancellation notifications |
| ReminderDue             | Workflow timer fires           | Calls `send_notifications` activity        |
| ParticipantSubscribed   | User subscribes                | Add participant to DB + signal workflow    |
| ParticipantUnsubscribed | User unsubscribes              | Remove participant from DB                 |
| NotificationRequested   | Any event needing notification | Calls `send_notifications` activity        |

---

# Data Contracts (Updated)

## **User**

```yaml
id: uuid
email: string
is_verified: bool
config_key: string  # deterministic hash of email + secret salt
verify_sent_at: datetime
organization_id: uuid
```

## **Integrations**

```yaml
id: uuid
user_id: uuid
apprise_url: string  # e.g. "mailto://user:pass@gmail.com"
tags: list[string]  # user-defined tags for grouping
```

## **EventParticipants**

```yaml
id: uuid
event_id: uuid
user_id: uuid
notification_tags: list[string]  # must match user’s integration tags
custom_frequency: enum["EVERY", "BEFORE"]
custom_time_delta_seconds: int
```

## **Notification Payload (to Temporal Activity)**

```yaml
title: string
body: string
event_id: uuid
participant_ids: list[uuid]
```

---

# Notification Flow

1. Workflow (Event or Reminder) triggers **NotificationRequested**.
2. Temporal schedules `send_notifications` activity.
3. Activity:

   * Loads participant list from DB.
   * For each participant, loads integration URLs filtered by matching tags.
   * Builds Apprise object, calls `.notify()`.
   * Raises exception on failure → Temporal retries with backoff.
4. Workflow history + optional `NotificationLog` table give observability.

---

This documentation now explicitly clarifies:

* Apprise integration is fully dynamic (no server config sync).
* Notification logic lives inside Temporal activities with retry policy.
* DB tables are authoritative for integrations + tags.
* No queue or custom retry logic is needed outside Temporal.
