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
4. **Notifications**

   * Apprise called async from workflow activities
   * User config stored in Integrations table

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
