# Local Dev & Validation Scripts

## Purpose

Before implementing API routes or frontend flows, **all features must be prototyped as standalone local Python scripts.** These scripts allow us to validate DB interactions, Temporal workflow behavior, and Apprise notification logic in isolation.

This approach ensures:

* **Fast iteration** without waiting for FastAPI scaffolding.
* **Correctness of models** and persistence before exposing them via API.
* **Early testing of Temporal workflows and activities.**

---

## Required Prototype Scripts

All scripts go in `scripts/` directory.

### 1. `create_event.py`

* Creates a test user (if one doesn’t exist).
* Creates an event with minimal details (name, start date).
* Starts a Temporal workflow instance for that event.
* Prints resulting event and workflow IDs.

---

### 2. `add_subscriber.py`

* Reads event ID from local state (file/ENV).
* Creates a new user (if needed).
* Adds user to `EventParticipants` table with chosen tags.
* Signals the event’s workflow that a participant was added.
* Prints participant row and workflow confirmation.

---

### 3. `update_event.py`

* Reads event ID from local state.
* Updates event details (e.g., new start date).
* Persists changes to DB.
* Signals workflow that event was updated.
* Confirms schedule re-generation or update from workflow logs.

---

## Ground Rules for Agent

* **No FastAPI routes** until these scripts run correctly end-to-end.
* **No frontend** until the backend state + workflows can be validated through these scripts.
* Scripts should be **under 50 lines each**, using direct SQLAlchemy or DB calls, and direct Temporal SDK client calls.
* Each script should print results clearly (so we can visually inspect the behavior).
* Once these work reliably, convert logic into API routes and services.
