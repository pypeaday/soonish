# Domain Event Catalog

**File:** `domain_events.md`

**EventCreated** – Organizer creates event
**EventUpdated** – Event changes (TIME, NAME, CANCEL, EXTRA\_DETAILS)
**ParticipantAdded** – Attendee subscribes
**ParticipantRemoved** – Attendee unsubscribes
**NotificationRequested** – Workflow triggers Apprise call
**NotificationSent** – Apprise result, optional logging
**ParticipantQuery (Future)** – Participant asks question

**Payload and consumers are detailed as per previous draft.**

**NotificationRequested** – workflow triggers Apprise call

* **Trigger:** Scheduled notification step in Event workflow
* **Payload:**

  ```json
  {
    "event_id": "uuid",
    "participants": [
      {
        "participant_id": "uuid",
        "config_key": "string",
        "tags": ["tag1","tag2"]
      }
    ],
    "message": "string"
  }
  ```
* **Consumers:**

  * Temporal activity posts to Apprise: `/notify/{config_key}` with `tags` and message.
  * Temporal handles retries; success/failure logged optionally via `NotificationSent`.

**NotificationSent** – Apprise result, optional logging

* Status is returned from Apprise API call.
