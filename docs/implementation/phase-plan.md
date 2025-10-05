#  Implementation Phase Plan

**Status**: Authoritative  
**Last Updated**: 2025-10-04  
**Purpose**: Step-by-step build plan with clear dependencies and acceptance criteria.

---

## Overview

This plan breaks Soonish into **10 phases** that build on each other. Each phase is **1-3 days of work** and has clear acceptance criteria.

**Philosophy**: Build thin vertical slices. Each phase should result in something you can test/demo.

---

## Phase 0: Project Setup (30 minutes)

**Goal**: Get development environment ready.

### Tasks

```bash
# 1. Create virtual environment
uv venv
source .venv/bin/activate

# 2. Install core dependencies
uv pip install \
    fastapi uvicorn \
    sqlalchemy aiosqlite \
    cryptography \
    python-jose passlib \
    httpx

# 3. Create .env file
cp .env.example .env
# Edit with your keys

# 4. Create directory structure
mkdir -p src/{api,db,worker,workflows,activities}
mkdir -p scripts tests
touch src/__init__.py
```

### Acceptance Criteria

- ✅ Virtual environment activated
- ✅ Dependencies installed
- ✅ `.env` file exists with encryption key
- ✅ Directory structure created

---

## Phase 1: Database Layer (1 day)

**Goal**: Database models, repositories, and initialization script working.

### Build Order

#### 1.1 Base Models (`src/db/base.py`)

```python
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime, timezone
from sqlalchemy import DateTime

class Base(AsyncAttrs, DeclarativeBase):
    """Base for all models"""
    pass

class TimestampMixin:
    """Mixin for created_at/updated_at"""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )
```

#### 1.2 Encryption (`src/db/encryption.py`)

Copy from `specifications/data-models.md` - Encryption Implementation section.

#### 1.3 Models (`src/db/models.py`)

Build **in this order** (dependencies matter):

1. `User` (no dependencies)
2. `Event` (depends on User)
3. `Integration` (depends on User)
4. `Subscription` (depends on Event, User)
5. `SubscriptionSelector` (depends on Subscription, Integration)
6. `UnsubscribeToken` (depends on Subscription)

Copy from `specifications/data-models.md` - SQLAlchemy Models section.

#### 1.4 Session Management (`src/db/session.py`)

Copy from `specifications/data-models.md` - Session Management section.

#### 1.5 Repositories (`src/db/repositories.py`)

Build **in this order**:

1. `UserRepository`
2. `EventRepository`
3. `IntegrationRepository`
4. `SubscriptionRepository`

Copy from `specifications/data-models.md` - Repositories section.

#### 1.6 Database Init Script (`scripts/init_db.py`)

Copy from `implementation/database-setup.md`.

### Testing

```bash
# Run database init
uv run scripts/init_db.py

# Verify database exists
ls -lh soonish.db

# Inspect tables
sqlite3 soonish.db ".tables"

# Test repositories
uv run scripts/test_db.py  # From database-setup.md
```

### Acceptance Criteria

- ✅ `uv run scripts/init_db.py` succeeds
- ✅ Database has all tables (users, events, integrations, subscriptions, subscription_selectors, unsubscribe_tokens)
- ✅ Sample data loaded (2 users, 1 event, 2 integrations, 1 subscription)
- ✅ Encryption key in `.env`
- ✅ `UserRepository.get_by_email()` returns user

**Files created**: `src/db/{base,models,encryption,session,repositories}.py`, `scripts/init_db.py`

---

## Phase 2: Configuration & Dependencies (30 minutes)

**Goal**: Environment configuration and dependency injection ready.

### Build Order

#### 2.1 Config (`src/config.py`)

```python
from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///soonish.db"
    
    # Encryption
    encryption_key: str = ""
    
    # Temporal
    temporal_url: str = "ghost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "soonish-task-queue"
    
    # API
    secret_key: str = ""
    debug: bool = True
    
    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_app_user: str = ""
    smtp_app_password: str = ""
    
    model_config = {
        "env_file": ".env"
    }
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Generate keys if missing (dev only)
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key().decode()
        if not self.secret_key:
            import secrets
            self.secret_key = secrets.token_urlsafe(32)


_settings = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings

```

#### 2.2 API Dependencies (`src/api/dependencies.py`)

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client
from src.db.session import get_db_session
from src.config import get_settings

# Database dependency
async def get_session() -> AsyncSession:
    """Get database session"""
    async for session in get_db_session():
        yield session

# Temporal client (create once, reuse)
_temporal_client: Client | None = None

async def get_temporal_client() -> Client:
    """Get Temporal client"""
    global _temporal_client
    if _temporal_client is None:
        settings = get_settings()
        _temporal_client = await Client.connect(settings.temporal_url)
    return _temporal_client
```

### Testing

```bash
# Test config loads
python -c "from src.config import get_settings; print(get_settings().database_url)"
```

### Acceptance Criteria

- ✅ `Settings` loads from `.env`
- ✅ Auto-generates keys if missing
- ✅ `get_settings()` returns singleton

**Files created**: `src/config.py`, `src/api/dependencies.py`

---

## Phase 3: Basic FastAPI Setup (1 hour)

**Goal**: FastAPI server running with health check.

### Build Order

#### 3.1 API Schemas (`src/api/schemas.py`)

Start with just a few for testing:

```python
from pydantic import BaseModel, EmailStr
from datetime import datetime

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_verified: bool
    
    class Config:
        from_attributes = True
```

#### 3.2 Health Route (`src/api/routes/health.py`)

```python
from fastapi import APIRouter
from datetime import datetime, timezone
from src.api.schemas import HealthResponse

router = APIRouter(tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc),
        version="0.1.0"
    )
```

#### 3.3 Main App (`src/api/main.py`)

```python
from fastapi import FastAPI
from src.api.routes import health

app = FastAPI(
    title="Soonish API",
    description="Event notification service",
    version="0.1.0"
)

# Include routers
app.include_router(health.router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Soonish API - see /docs for API documentation"}
```

### Testing

```bash
# Start server
uvicorn src.api.main:app --reload

# In another terminal, test
curl http://localhost:8000/health

# Check OpenAPI docs
open http://localhost:8000/docs
```

### Acceptance Criteria

- ✅ Server starts without errors
- ✅ `GET /health` returns 200
- ✅ Swagger UI accessible at `/docs`

**Files created**: `src/api/{main,schemas}.py`, `src/api/routes/health.py`

---

## Phase 4: Authentication (1 day)

**Goal**: User registration, login, JWT/session auth working.

### Build Order

#### 4.1 Password Utilities (`src/api/auth/password.py`)

Copy from `specifications/authentication.md` - Password Hashing section.

#### 4.2 JWT Utilities (`src/api/auth/jwt.py`)

Copy from `specifications/authentication.md` - JWT Token Authentication section.

#### 4.3 Session Management (`src/api/auth/session.py`)

Copy from `specifications/authentication.md` - Session Cookie Authentication section.

#### 4.4 Auth Schemas (`src/api/schemas.py`)

Add these:

```python
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
```

#### 4.5 Auth Routes (`src/api/routes/auth.py`)

Copy from `specifications/authentication.md` - Complete Auth Endpoints section.

#### 4.6 Auth Dependencies (`src/api/dependencies.py`)

Add `get_current_user` and `get_current_user_optional` from `specifications/authentication.md`.

### Testing

```bash
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login (JWT)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use token
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer <token>"
```

### Acceptance Criteria

- ✅ Can register new user
- ✅ Can login with correct password
- ✅ Login fails with wrong password
- ✅ JWT token works for authenticated endpoints
- ✅ Session cookie works in browser

**Files created**: `src/api/auth/{password,jwt,session}.py`, `src/api/routes/auth.py`

---

## Phase 5: Events API (1 day)

**Goal**: Create, read, update, delete events via API.

### Build Order

#### 5.1 Event Schemas (`src/api/schemas.py`)

```python
class EventCreateRequest(BaseModel):
    name: str
    description: str | None = None
    start_date: datetime
    end_date: datetime | None = None
    timezone: str = "UTC"
    location: str | None = None
    is_public: bool = True

class EventUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = None

class EventResponse(BaseModel):
    id: int
    name: str
    description: str | None
    start_date: datetime
    end_date: datetime | None
    timezone: str
    location: str | None
    is_public: bool
    temporal_workflow_id: str
    organizer_user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
```

#### 5.2 Events Route (`src/api/routes/events.py`)

Start with basic CRUD (no Temporal yet):

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.schemas import EventCreateRequest, EventResponse
from src.api.dependencies import get_session, get_current_user
from src.db.models import Event, User
from src.db.repositories import EventRepository
import uuid

router = APIRouter(prefix="/api/events", tags=["events"])

@router.post("", response_model=EventResponse, status_code=201)
async def create_event(
    request: EventCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    # Generate workflow ID
    workflow_id = f"event-{uuid.uuid4()}"
    
    # Create event
    repo = EventRepository(session)
    event = Event(
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        end_date=request.end_date,
        timezone=request.timezone,
        location=request.location,
        is_public=request.is_public,
        temporal_workflow_id=workflow_id,
        organizer_user_id=current_user.id
    )
    event = await repo.create(event)
    await session.commit()
    
    # TODO Phase 6: Start Temporal workflow here
    
    return event

@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    session: AsyncSession = Depends(get_session)
):
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
```

### Testing

```bash
# Create event (need auth token first)
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@example.com","password":"password123"}' \
  | jq -r '.access_token')

curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Event",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z"
  }'

# Get event
curl http://localhost:8000/api/events/1
```

### Acceptance Criteria

- ✅ Can create event (authenticated)
- ✅ Can get event by ID
- ✅ Event stored in database
- ✅ Returns 401 if not authenticated
- ✅ Returns 404 if event doesn't exist

**Files created**: `src/api/routes/events.py`

---

## Phase 6: Temporal Integration (1 day)

**Goal**: EventWorkflow starts when event created, handles signals.

### Build Order

#### 6.1 Install Temporal SDK

```bash
uv pip install temporalio
```

#### 6.2 Event Activities (`src/activities/events.py`)

```python
from temporalio import activity
from src.db.session import get_session
from src.db.repositories import EventRepository

@activity.defn
async def validate_event_exists(event_id: int) -> bool:
    """Validate event exists in database"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        return event is not None

@activity.defn
async def get_event_details(event_id: int) -> dict | None:
    """Get current event details"""
    async with get_session() as session:
        repo = EventRepository(session)
        event = await repo.get_by_id(event_id)
        if not event:
            return None
        return {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location,
            "timezone": event.timezone
        }
```

#### 6.3 EventWorkflow (`src/workflows/event.py`)

Copy from `specifications/temporal-specification.md` - EventWorkflow section.

**Start simple**: Skip reminder schedules for now, just get basic workflow running.

#### 6.4 Worker (`src/worker/main.py`)

```python
import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from src.config import get_settings
from src.workflows.event import EventWorkflow
from src.activities.events import validate_event_exists, get_event_details

async def main():
    settings = get_settings()
    
    # Connect to Temporal
    client = await Client.connect(settings.temporal_url)
    
    # Create worker
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[EventWorkflow],
        activities=[validate_event_exists, get_event_details]
    )
    
    print(f"🚀 Worker starting on task queue: {settings.temporal_task_queue}")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
```

#### 6.5 Update Events API

Modify `src/api/routes/events.py` to start workflow:

```python
from src.api.dependencies import get_temporal_client
from temporalio.client import Client
from src.workflows.event import EventWorkflow

@router.post("", ...)
async def create_event(
    ...,
    temporal_client: Client = Depends(get_temporal_client)
):
    # ... create event in DB ...
    
    # Start Temporal workflow
    event_data = {
        "name": event.name,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "location": event.location
    }
    
    await temporal_client.start_workflow(
        EventWorkflow.run,
        args=[event.id, event_data],
        id=workflow_id,
        task_queue=settings.temporal_task_queue
    )
    
    return event
```

### Testing

```bash
# Terminal 1: Start Temporal dev server
temporal server start-dev

# Terminal 2: Start worker
uv run python -m src.worker.main

# Terminal 3: Start API
uvicorn src.api.main:app --reload

# Terminal 4: Create event
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Workflow Test Event",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z"
  }'

# Check Temporal UI
open http://localhost:8233
```

### Acceptance Criteria

- ✅ Worker connects to Temporal
- ✅ Creating event starts workflow
- ✅ Workflow visible in Temporal UI
- ✅ Workflow validates event exists
- ✅ Workflow runs until event ends

**Files created**: `src/workflows/event.py`, `src/activities/events.py`, `src/worker/main.py`

---

## Phase 7: Subscriptions API (1 day)

**Goal**: Users can subscribe to events, workflow gets signaled.

### Build Order

#### 7.1 Subscription Schemas (`src/api/schemas.py`)

```python
class SubscribeRequest(BaseModel):
    # For anonymous
    email: EmailStr | None = None
    name: str | None = None
    
    # For authenticated
    integration_ids: list[int] | None = None
    tags: list[str] | None = None

class SubscriptionResponse(BaseModel):
    subscription_id: int
    event_id: int
    user_id: int
    selectors: list[dict]
```

#### 7.2 Subscriptions Route (`src/api/routes/subscriptions.py`)

Copy subscribe endpoint from `specifications/api-specification.md` - Subscribe to Event section.

#### 7.3 Update EventWorkflow

Add `participant_added` signal handler (from `specifications/temporal-specification.md`).

### Testing

```bash
# Anonymous subscribe
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"subscriber@example.com","name":"Test Subscriber"}'

# Check workflow received signal in Temporal UI
```

### Acceptance Criteria

- ✅ Anonymous user can subscribe with email
- ✅ Creates user if doesn't exist
- ✅ Creates subscription + selector
- ✅ Workflow receives `participant_added` signal
- ✅ Generates unsubscribe token

**Files created**: `src/api/routes/subscriptions.py`

---

## Phase 8: Notification System (1 day)

**Goal**: Notifications delivered via Apprise.

### Build Order

#### 8.1 Notification Activities (`src/activities/notifications.py`)

Copy from `specifications/temporal-specification.md` - Notification Activities section.

**Note**: For development, you can run a mock Apprise server or use real services.

#### 8.2 Mock Apprise Server (for testing)

```python
# scripts/mock_apprise.py
from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.post("/notify")
async def notify(payload: dict):
    print(f"📧 Mock notification sent:")
    print(f"   Title: {payload.get('title')}")
    print(f"   Body: {payload.get('body')}")
    print(f"   Type: {payload.get('type')}")
    return {"status": "success"}

if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8001)
```

#### 8.3 Update Worker

Register notification activities:

```python
from src.activities.notifications import send_notification

worker = Worker(
    ...,
    activities=[..., send_notification]
)
```

### Testing

```bash
# Terminal 1: Start mock Apprise
uv run python scripts/mock_apprise.py

# Terminal 2: Trigger notification via workflow signal
curl -X POST http://localhost:8000/api/events/1/notify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test",
    "notification_level": "info"
  }'

# Check mock Apprise logs
```

### Acceptance Criteria

- ✅ `send_notification` activity executes
- ✅ Calls Apprise API with correct payload
- ✅ Handles 424 partial failures gracefully
- ✅ Returns delivery statistics

**Files created**: `src/activities/notifications.py`, `scripts/mock_apprise.py`

---

## Phase 9: Temporal Schedules (1 day)

**Goal**: Automatic reminders at T-1d, T-1h before events.

### Build Order

#### 9.1 ReminderWorkflow (`src/workflows/reminder.py`)

Copy from `specifications/temporal-specification.md` - ReminderWorkflow section.

#### 9.2 Schedule Management Activities (`src/activities/notifications.py`)

Add `create_reminder_schedules` and `delete_reminder_schedules` from spec.

#### 9.3 Update EventWorkflow

Add schedule creation/deletion:

```python
# In EventWorkflow.run()
await workflow.execute_activity(
    create_reminder_schedules,
    args=[event_id, event_data['start_date']],
    start_to_close_timeout=timedelta(seconds=60)
)

# In finally block
await workflow.execute_activity(
    delete_reminder_schedules,
    event_id,
    start_to_close_timeout=timedelta(seconds=60)
)
```

#### 9.4 Update Worker

Register ReminderWorkflow and schedule activities.

### Testing

```bash
# Create event with near-future start time
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Reminder Test",
    "start_date": "'$(date -u -d '+25 hours' +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Check Temporal UI for schedules
# Wait for T-1d reminder to fire
```

### Acceptance Criteria

- ✅ Schedules created when event created
- ✅ ReminderWorkflow triggered at correct time
- ✅ Reminders sent to all subscribers
- ✅ Schedules deleted when event ends
- ✅ Schedules recreated when start_date changes

**Files created**: `src/workflows/reminder.py`

---

## Phase 10: Integrations API (1 day)

**Goal**: Users can manage notification integrations.

### Build Order

#### 10.1 Integration Schemas (`src/api/schemas.py`)

```python
class IntegrationCreateRequest(BaseModel):
    name: str
    apprise_url: str
    tag: str

class IntegrationResponse(BaseModel):
    id: int
    name: str
    tag: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
```

#### 10.2 Integrations Route (`src/api/routes/integrations.py`)

Copy from `specifications/api-specification.md` - Integrations API section.

### Testing

```bash
# Create integration
curl -X POST http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My Gotify",
    "apprise_url": "gotify://hostname/token",
    "tag": "urgent"
  }'

# List integrations
curl http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN"

# Test integration
curl -X POST http://localhost:8000/api/integrations/1/test \
  -H "Authorization: Bearer $TOKEN"
```

### Acceptance Criteria

- ✅ Can create integration (URL encrypted)
- ✅ Can list user's integrations
- ✅ Can test integration (sends test notification)
- ✅ Can deactivate/activate integration
- ✅ `apprise_url` never returned in responses

**Files created**: `src/api/routes/integrations.py`

---

## Post-MVP Enhancements

After Phase 10, you have a working MVP. Future phases:

### Phase 11: Frontend (HTMX + Alpine.js)
- Event creation form
- Subscription page
- Integration management UI

### Phase 12: Email Verification
- Verification tokens
- Email sending (SMTP)
- Verified user features

### Phase 13: Private Events
- Event visibility controls
- Invitation system

### Phase 14: Event Memberships
- Multi-organizer support
- Role-based permissions

### Phase 15: Production Readiness
- Rate limiting
- Monitoring/observability
- PostgreSQL migration
- Redis for sessions
- Docker deployment

---

## Development Tips

### Daily Workflow

```bash
# Morning: Fresh database
uv run scripts/init_db.py

# Start services
temporal server start-dev &
uv run python -m src.worker.main &
uvicorn src.api.main:app --reload &

# Build features
vim src/api/routes/events.py

# Test
curl http://localhost:8000/api/events

# Check code
uv run ruff check --fix

# Commit
git add .
git commit -m "feat: add event creation endpoint"
```

### When Stuck

1. **Check specs**: `docs/specifications/` has all the answers
2. **Inspect DB**: `sqlite3 soonish.db`
3. **Check Temporal UI**: `http://localhost:8233`
4. **Check logs**: Worker and API both print useful info
5. **Blow away DB**: `uv run scripts/init_db.py`

### Common Issues

**Import errors**: Make sure you're in the virtual environment
**Database locked**: Close SQLite connections
**Workflow not starting**: Check worker is running and task queue name matches
**Auth failing**: Regenerate JWT secret key

---

## Summary

**Build order**:
1. Database → 2. Config → 3. API → 4. Auth → 5. Events → 6. Temporal → 7. Subscriptions → 8. Notifications → 9. Schedules → 10. Integrations

**Each phase**:
- Takes 1-3 days
- Has clear acceptance criteria
- Builds on previous phases
- Results in testable functionality

**You now have everything you need to start building!** 🚀

Good luck, have fun, and remember: **every new line of code is a liability** - keep it minimal and necessary!
