# Data Contracts

**Create Event**

* **POST /events**
* **Request:**

  ```json
  {
    "owner_user_id": "uuid",
    "event_details": {
      "name": "Team Standup",
      "start_date": "2025-09-20T14:00:00Z",
      "end_date": "2025-09-20T14:30:00Z",
      "extra_details": {"location": "Zoom"}
    },
    "public": true,
    "allowed_user_ids": []
  }
  ```
* **Response (201):**

  ```json
  {
    "event_id": "uuid",
    "workflow_status": "CREATED"
  }
  ```
* **Errors:**

  * `400`: invalid payload
  * `401`: unauthorized

---

**Update Event**

* **PATCH /events/{event\_id}**
* **Request:**

  ```json
  {
    "updated_by_user_id": "uuid",
    "update_type": "TIME",
    "update_content": {
      "start_date": "2025-09-20T15:00:00Z",
      "end_date": "2025-09-20T15:30:00Z"
    }
  }
  ```
* **Response (200):**

  ```json
  {
    "event_id": "uuid",
    "workflow_status": "UPDATED",
    "next_notification_time": "2025-09-20T14:50:00Z"
  }
  ```

---

**Add Participant**

* **POST /events/{event\_id}/participants**
* **Request:**

  ```json
  {
    "participant_email": "jane@example.com",
    "notification_tags": ["email"],
    "custom_frequency": "BEFORE",
    "custom_time_delta_seconds": 1800
  }
  ```
* **Response (201):**

  ```json
  {
    "participant_id": "uuid",
    "subscription_status": "ACTIVE"
  }
  ```

---

**Remove Participant**

* **DELETE /events/{event\_id}/participants/{participant\_id}**
* **Response (200):**

  ```json
  {
    "participant_id": "uuid",
    "subscription_status": "REMOVED"
  }
  ```

---

**NotificationSent (Logging Hook)**

* **Internal POST /notifications/log**
* **Request:**

  ```json
  {
    "notification_id": "uuid",
    "event_id": "uuid",
    "participant_id": "uuid",
    "status": "SUCCESS",
    "timestamp": "2025-09-20T13:59:00Z",
    "delivery_channel": "email"
  }
  ```
* **Response (202):**

  ```json
  { "logged": true }
  ```

---

**Participant Query (Future)**

* **POST /events/{event\_id}/queries**
* **Request:**

  ```json
  {
    "participant_id": "uuid",
    "query_text": "Is there parking available?"
  }
  ```
* **Response (201):**

  ```json
  {
    "query_id": "uuid",
    "status": "PENDING"
  }
  ```
