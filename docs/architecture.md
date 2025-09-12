# Architecture

**Tech Stack**

* Backend: Python + Temporal.io (Event workflows)
* Frontend: htmx
* DB: SQLite initially, PostgreSQL migration path

**System Overview**

1. **Temporal Workflows**

   * Event lifecycle, reminders, notifications
   * EventUpdates handled via workflow signals
2. **Python App Layer**

   * REST API for CRUD, participant management, integrations
   * Emits workflow signals
3. **Frontend (htmx)**

   * Organizer portal and attendee pages
4. **Notifications:**

   * Each **verified user** can configure integrations via the UI. Each integration produces a `config_key` that maps to an Apprise configuration (URL).
   * Notifications are sent by making a **POST request** to:

     ```
  {apprise-api-url}/notify/{config_key}
  ```

  * Request body contains `tags` to target specific channels for the participant.
  * No notification queue is maintained; Temporal workflow handles retry and timing.
* Reference pattern: [Apprise API – persistent stateful storage solution](https://github.com/caronc/apprise-api?tab=readme-ov-file#persistent-stateful-storage-solution)


**Data Model Overview**

| Model              | Storage          | Notes                          |
| ------------------ | ---------------- | ------------------------------ |
| Organization       | Table            | Admins, users                  |
| User               | Table            | Identity & preferences         |
| Integrations       | Table            | Apprise configs                |
| Event              | Workflow         | Lifecycle, notifications       |
| EventDetails       | Table            | Name, start/end, extra details |
| EventParticipants  | Table            | Maps users to events           |
| EventUpdates       | Workflow signals | Changes to events              |
| EventUpdateContent | Table            | Payload for updates            |

**Deployment (MVP)**

* Containerized Python app + Temporal server
* Static assets served by app

## Implementation Notes (stub)

* Python + Temporal SDK for workflows
* Apprise call per participant in workflow activity
* Event workflow handles: reminders, notifications, update signals
* SQLite for MVP, Postgres when scaling
* htmx frontend communicates with API via progressive enhancement
* Optional logging of notifications in DB for observability
* **Apprise integration:**

  1. Each verified user sets up integrations via UI → generates `config_key`
  2. Temporal workflow activity posts to:

     ```
     {apprise-api-url}/notify/{config_key}
     ```

     Body contains `tags` and notification message
  3. Temporal handles retries and scheduling; DB may optionally log outcomes via `NotificationSent`

* **Event workflow responsibility:**

  * Determine participants, their tags, and `config_key`s
  * Trigger Apprise notifications at scheduled times or on event updates