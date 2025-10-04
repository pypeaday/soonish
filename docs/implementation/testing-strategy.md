# Testing Strategy

**Status**: Authoritative  
**Last Updated**: 2025-10-04  
**Purpose**: How to test each component as you build for quick feedback.

---

## Philosophy

**Test as you build**, not after. Each phase should have immediate validation.

**Levels of testing**:
1. **Manual testing** - Quick curl commands, database inspection
2. **Integration testing** - Test full flows end-to-end
3. **Unit testing** - Test individual functions (later)

**For MVP**: Focus on levels 1-2. Add level 3 when things stabilize.

---

## Testing Tools

### Command Line

```bash
# HTTP requests
curl -X POST http://localhost:8000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test Event"}'

# With jq for pretty JSON
curl http://localhost:8000/api/events/1 | jq

# Save token for reuse
export TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.access_token')
```

### Python REPL

```python
import asyncio
from src.db.session import get_session
from src.db.repositories import UserRepository

async def test():
    async with get_session() as session:
        repo = UserRepository(session)
        user = await repo.get_by_email("test@example.com")
        print(user.name if user else "Not found")

asyncio.run(test())
```

### SQLite CLI

```bash
sqlite3 soonish.db

.tables
SELECT * FROM users;
SELECT * FROM events;
.quit
```

### Temporal UI

```bash
# Start Temporal dev server
temporal server start-dev

# Open UI
open http://localhost:8233

# View workflows, executions, schedules
```

### FastAPI Swagger

```bash
# Start API
uvicorn src.api.main:app --reload

# Open interactive docs
open http://localhost:8000/docs
```

---

## Phase-by-Phase Testing

### Phase 1: Database Layer

#### Test: Database initialization

```bash
# Run init script
uv run scripts/init_db.py

# Expected: ✅ Database created with sample data

# Verify tables exist
sqlite3 soonish.db ".tables"
# Expected: users, events, integrations, subscriptions, subscription_selectors, unsubscribe_tokens

# Count rows
sqlite3 soonish.db "SELECT COUNT(*) FROM users;"
# Expected: 2
```

#### Test: Repositories

```python
# scripts/test_repositories.py
import asyncio
from src.db.session import get_session
from src.db.repositories import UserRepository, EventRepository

async def test_repositories():
    async with get_session() as session:
        # Test UserRepository
        user_repo = UserRepository(session)
        
        # Test get_by_email
        user = await user_repo.get_by_email("organizer@example.com")
        assert user is not None, "User should exist"
        assert user.name == "Event Organizer"
        print("✅ UserRepository.get_by_email() works")
        
        # Test get_or_create_by_email (existing)
        user2, created = await user_repo.get_or_create_by_email(
            "organizer@example.com", "Different Name"
        )
        assert not created, "Should not create duplicate"
        assert user2.id == user.id
        print("✅ UserRepository.get_or_create_by_email() works (existing)")
        
        # Test get_or_create_by_email (new)
        user3, created = await user_repo.get_or_create_by_email(
            "newuser@example.com", "New User"
        )
        assert created, "Should create new user"
        assert user3.email == "newuser@example.com"
        print("✅ UserRepository.get_or_create_by_email() works (new)")
        
        # Test EventRepository
        event_repo = EventRepository(session)
        events = await event_repo.get_by_organizer(user.id)
        assert len(events) > 0, "Organizer should have events"
        print(f"✅ EventRepository.get_by_organizer() works ({len(events)} events)")

asyncio.run(test_repositories())
```

```bash
uv run python scripts/test_repositories.py
```

#### Test: Encryption

```python
# Test encryption roundtrip
from src.db.encryption import encrypt_field, decrypt_field

plaintext = "gotify://hostname/token"
encrypted = encrypt_field(plaintext)
decrypted = decrypt_field(encrypted)

assert decrypted == plaintext
print("✅ Encryption roundtrip works")
print(f"   Original:  {plaintext}")
print(f"   Encrypted: {encrypted[:20]}...")
print(f"   Decrypted: {decrypted}")
```

---

### Phase 2: Configuration

#### Test: Settings load

```bash
python -c "from src.config import get_settings; s = get_settings(); print('Database:', s.database_url)"
# Expected: Database: sqlite+aiosqlite:///soonish.db

python -c "from src.config import get_settings; s = get_settings(); print('Temporal:', s.temporal_url)"
# Expected: Temporal: localhost:7233
```

---

### Phase 3: FastAPI Setup

#### Test: Server starts

```bash
uvicorn src.api.main:app --reload
# Expected: Server starts on http://0.0.0.0:8000
```

#### Test: Health endpoint

```bash
curl http://localhost:8000/api/health | jq
# Expected:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-04T...",
#   "version": "0.1.0"
# }
```

#### Test: OpenAPI docs

```bash
open http://localhost:8000/docs
# Expected: Swagger UI loads
```

---

### Phase 4: Authentication

#### Test: Register user

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }' | jq

# Expected: 
# {
#   "success": true,
#   "message": "Account created. Please verify your email.",
#   "user_id": 3
# }
```

#### Test: Login (JWT)

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }' | jq

# Expected:
# {
#   "access_token": "eyJhbGc...",
#   "token_type": "bearer",
#   "expires_in": 3600
# }
```

#### Test: Login failure

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "wrongpassword"
  }' | jq

# Expected: 401 Unauthorized
```

#### Test: Protected endpoint

```bash
# Get token
export TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Use token
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN" | jq

# Expected: User profile data
```

---

### Phase 5: Events API

#### Test: Create event

```bash
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Event",
    "description": "Testing event creation",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z",
    "location": "Conference Room A"
  }' | jq

# Expected: 201 Created with event data
```

#### Test: Get event

```bash
curl http://localhost:8000/api/events/1 | jq

# Expected: Event details
```

#### Test: Update event

```bash
curl -X PATCH http://localhost:8000/api/events/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"location": "Conference Room B"}' | jq

# Expected: Updated event
```

#### Test: List events

```bash
curl http://localhost:8000/api/events | jq

# Expected: Array of events
```

---

### Phase 6: Temporal Integration

#### Test: Worker starts

```bash
# Terminal 1: Start Temporal dev server
temporal server start-dev

# Terminal 2: Start worker
uv run python -m src.worker.main

# Expected:
# 🚀 Worker starting on task queue: soonish-task-queue
# INFO:temporalio.worker._worker:Started worker...
```

#### Test: Workflow starts on event creation

```bash
# Terminal 3: Create event
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Workflow Test Event",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z"
  }' | jq

# Check worker logs
# Expected: Activity execution logs

# Check Temporal UI
open http://localhost:8233
# Expected: Workflow visible in Recent Workflows
```

#### Test: Workflow validates event

```bash
# Create event with invalid ID (should fail validation)
# Check workflow fails gracefully

# Check Temporal UI for workflow history
# Expected: validate_event_exists activity executed
```

---

### Phase 7: Subscriptions

#### Test: Anonymous subscribe

```bash
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "subscriber@example.com",
    "name": "Anonymous Subscriber"
  }' | jq

# Expected:
# {
#   "success": true,
#   "data": {
#     "subscription_id": 2,
#     "event_id": 1,
#     "user_id": 4
#   }
# }
```

#### Test: Workflow receives signal

```bash
# After subscribing, check Temporal UI
open http://localhost:8233

# Navigate to workflow → Event History
# Expected: participant_added signal received
```

#### Test: Duplicate subscribe fails

```bash
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "subscriber@example.com",
    "name": "Anonymous Subscriber"
  }' | jq

# Expected: 400 Bad Request - Already subscribed
```

---

### Phase 8: Notifications

#### Test: Mock Apprise server

```bash
# Terminal 1: Start mock Apprise
uv run python scripts/mock_apprise.py

# Expected: Server running on port 8001
```

#### Test: Manual notification

```bash
curl -X POST http://localhost:8000/api/events/1/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "Testing notification delivery",
    "notification_level": "info"
  }' | jq

# Check mock Apprise logs
# Expected:
# 📧 Mock notification sent:
#    Title: Test Notification
#    Body: Testing notification delivery
#    Type: info
```

#### Test: Welcome notification on subscribe

```bash
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "New User"
  }'

# Check mock Apprise logs
# Expected: Welcome notification sent
```

---

### Phase 9: Temporal Schedules

#### Test: Schedules created

```bash
# Create event starting in 25 hours
TOMORROW=$(date -u -d '+25 hours' +%Y-%m-%dT%H:%M:%SZ)

curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Reminder Test Event\",
    \"start_date\": \"$TOMORROW\"
  }" | jq

# Check Temporal UI → Schedules
open http://localhost:8233

# Expected: Two schedules visible:
# - event-{id}-reminder-1day
# - event-{id}-reminder-1hour
```

#### Test: Reminder fires

```bash
# Create event starting in 2 minutes (for quick test)
SOON=$(date -u -d '+2 minutes' +%Y-%m-%dT%H:%M:%SZ)

curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Quick Test\",\"start_date\":\"$SOON\"}"

# Wait 2 minutes
# Check mock Apprise logs
# Expected: Reminder notification sent
```

---

### Phase 10: Integrations

#### Test: Create integration

```bash
curl -X POST http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Gotify Server",
    "apprise_url": "gotify://hostname/token",
    "tag": "urgent"
  }' | jq

# Expected: Integration created (apprise_url not returned)
```

#### Test: List integrations

```bash
curl http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" | jq

# Expected: Array of integrations (apprise_url NOT included)
```

#### Test: Test integration

```bash
curl -X POST http://localhost:8000/api/integrations/1/test \
  -H "Authorization: Bearer $TOKEN" | jq

# Check mock Apprise logs
# Expected: Test notification sent
```

#### Test: Encryption works

```bash
# Create integration
curl -X POST http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","apprise_url":"gotify://test","tag":"test"}'

# Check database directly
sqlite3 soonish.db "SELECT id, name, apprise_url_encrypted FROM integrations WHERE name='Test';"

# Expected: apprise_url_encrypted is binary blob, not plaintext
```

---

## Integration Testing

### Full Event Lifecycle

Save as `scripts/test_full_lifecycle.py`:

```python
#!/usr/bin/env python3
"""Test complete event lifecycle"""
import asyncio
import httpx
from datetime import datetime, timedelta, timezone

API_BASE = "http://localhost:8000"

async def test_lifecycle():
    async with httpx.AsyncClient() as client:
        # 1. Register user
        print("1️⃣  Registering user...")
        resp = await client.post(f"{API_BASE}/api/auth/register", json={
            "email": "test@lifecycle.com",
            "password": "password123",
            "name": "Lifecycle Test"
        })
        assert resp.status_code == 200
        print("   ✅ User registered")
        
        # 2. Login
        print("2️⃣  Logging in...")
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "test@lifecycle.com",
            "password": "password123"
        })
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   ✅ Logged in")
        
        # 3. Create event
        print("3️⃣  Creating event...")
        start_date = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        resp = await client.post(f"{API_BASE}/api/events", headers=headers, json={
            "name": "Lifecycle Test Event",
            "start_date": start_date
        })
        event = resp.json()["data"]
        event_id = event["id"]
        print(f"   ✅ Event created (ID: {event_id})")
        
        # 4. Subscribe to event
        print("4️⃣  Subscribing to event...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/subscribe",
            json={"email": "subscriber@lifecycle.com", "name": "Sub"}
        )
        subscription = resp.json()["data"]
        print(f"   ✅ Subscribed (ID: {subscription['subscription_id']})")
        
        # 5. Send notification
        print("5️⃣  Sending notification...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/notify",
            headers=headers,
            json={
                "title": "Test Notification",
                "body": "Testing notifications"
            }
        )
        print("   ✅ Notification sent")
        
        # 6. Update event
        print("6️⃣  Updating event...")
        resp = await client.patch(
            f"{API_BASE}/api/events/{event_id}",
            headers=headers,
            json={"location": "Updated Location"}
        )
        print("   ✅ Event updated")
        
        print("\n🎉 Full lifecycle test passed!")

if __name__ == "__main__":
    asyncio.run(test_lifecycle())
```

```bash
uv run python scripts/test_full_lifecycle.py
```

---

## Automated Testing (Future)

When ready to add proper unit/integration tests:

### Test Framework

```bash
uv pip install pytest pytest-asyncio httpx
```

### Test Structure

```
tests/
├── unit/
│   ├── test_repositories.py
│   ├── test_encryption.py
│   └── test_models.py
├── integration/
│   ├── test_api.py
│   ├── test_auth.py
│   └── test_workflows.py
└── conftest.py
```

### Example Test

```python
# tests/unit/test_repositories.py
import pytest
from src.db.repositories import UserRepository
from src.db.models import User

@pytest.mark.asyncio
async def test_get_by_email(test_session):
    repo = UserRepository(test_session)
    
    # Create user
    user = User(email="test@example.com", name="Test", is_verified=False)
    test_session.add(user)
    await test_session.commit()
    
    # Test get_by_email
    found = await repo.get_by_email("test@example.com")
    assert found is not None
    assert found.email == "test@example.com"
```

### Run Tests

```bash
pytest tests/ -v
```

---

## Debugging Tips

### API Debugging

```python
# Add to route for debugging
import traceback
try:
    # ... your code ...
except Exception as e:
    traceback.print_exc()
    raise
```

### Database Debugging

```python
# Enable SQLAlchemy query logging
engine = create_async_engine(DATABASE_URL, echo=True)
```

### Temporal Debugging

```python
# Enable workflow logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Logs

```bash
# API logs (if using uvicorn)
# Already printed to console with --reload

# Worker logs
# Already printed to console

# Temporal server logs
temporal server start-dev --log-level debug
```

---

## Summary

**Quick validation at each phase**:
- Phase 1: `uv run scripts/init_db.py`
- Phase 3: `curl http://localhost:8000/api/health`
- Phase 4: Login and get token
- Phase 5: Create/get events
- Phase 6: Check Temporal UI
- Phase 7: Subscribe and check signals
- Phase 8: Check notification logs
- Phase 9: Check schedules in Temporal UI
- Phase 10: Create integration and test

**Tools**:
- `curl` + `jq` for API testing
- `sqlite3` for database inspection
- Temporal UI for workflow debugging
- Python REPL for quick tests

**Philosophy**: Test immediately, iterate quickly, keep feedback loop tight.
