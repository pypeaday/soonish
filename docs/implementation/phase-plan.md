#  Implementation Phase Plan

**Status**: Authoritative  
**Purpose**: Step-by-step build plan with clear dependencies and acceptance criteria.

---

## Table of Contents

1. [Overview](#overview)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Phase 0: Project Setup](#phase-0-project-setup-30-minutes)
4. [Phase 1: Database Layer](#phase-1-database-layer-1-day)
5. [Phase 2: Configuration & Dependencies](#phase-2-configuration--dependencies-30-minutes)
6. [Phase 3: Basic FastAPI Setup](#phase-3-basic-fastapi-setup-1-hour)
7. [Phase 4: Authentication](#phase-4-authentication-1-day)
8. [Phase 5: Events API](#phase-5-events-api-1-day)
9. [Phase 6: Temporal Integration](#phase-6-temporal-integration-1-day)
10. [Phase 7: Subscriptions API](#phase-7-subscriptions-api-1-day)
11. [Phase 8: Notification System](#phase-8-notification-system-1-day)
12. [Phase 9: Temporal Schedules](#phase-9-temporal-schedules-1-day)
13. [Current Project Structure](#current-project-structure-after-phase-9)
14. [Phase 10: Integrations API](#phase-10-integrations-api-1-day)
15. [Phase 11: Custom Reminder Preferences](#phase-11-custom-reminder-preferences-1-day)
16. [Testing Strategy](#testing-strategy)
17. [Post-MVP Enhancements](#post-mvp-enhancements)
18. [Quick Reference Commands](#quick-reference-commands)
19. [Dependency Checklist](#dependency-checklist)

---

## Overview

This plan breaks Soonish into **11 phases** that build on each other. Each phase is **1 day of work** and has clear acceptance criteria.

**Philosophy**: Build thin vertical slices. Each phase should result in something you can test/demo.

**What's Included:**
- Complete environment setup guide
- Database models with encryption
- FastAPI REST API with JWT auth
- Temporal workflows for event orchestration
- Multi-channel notifications via Apprise
- Temporal Schedules for reminders
- Anonymous + authenticated subscriptions
- Comprehensive testing strategy

**Key Architectural Decisions:**
- **Selector-based subscriptions**: Users specify integrations by ID OR tag (flexible routing)
- **Service vs User config**: Service SMTP in .env, user integrations in database
- **Temporal Schedules**: For reminder timing (not workflow.sleep) to handle event time changes
- **Hardcoded reminders in Phase 9**: T-1d and T-1h defaults, custom reminders in Phase 11
- **Apprise abstraction**: Users provide natural config (Gotify URL + token), backend converts to Apprise URLs

---

## Environment Variables Reference

**Complete `.env` file** - Add these as you progress through phases:

```bash
# Phase 1: Database
DATABASE_URL=sqlite+aiosqlite:///soonish.db

# Phase 2: Security & Encryption
ENCRYPTION_KEY=<generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())">
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_urlsafe(32))">
DEBUG=true

# Phase 4: Authentication
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Phase 6: Temporal
TEMPORAL_URL=localhost:7233
TEMPORAL_TASK_QUEUE=soonish-task-queue

# Phase 8: Service-Level SMTP (for sending emails on behalf of users)
GMAIL_USER=your_service_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
PROTON_USER=your_service_email@proton.me
PROTON_APP_PASSWORD=your_proton_app_password

# Optional: User-level integrations (for dogfooding/testing)
# These go in the database via API, not .env:
# - GOTIFY_URL (via POST /api/integrations)
# - GOTIFY_TOKEN (via POST /api/integrations)
```

**Key Distinctions:**
- **Service-level** (in `.env`): Credentials Soonish uses to send notifications
- **User-level** (in database): Credentials users provide for their own channels
- See Phase 8 for detailed configuration architecture

---

## Phase 0: Project Setup (30 minutes)

**Goal**: Get development environment ready.

### Tasks

```bash
# 1. Create virtual environment
uv venv
source .venv/bin/activate

# 2. Install core dependencies
uv add fastapi uvicorn sqlalchemy aiosqlite cryptography httpx

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

**Key Model Details:**

**SubscriptionSelector** - Implements OR logic for notification routing:
- Has EITHER `integration_id` (FK to integrations) OR `tag` (string)
- Never both - enforced at application level
- Allows two patterns:
  - Specific: "send to my Gotify integration #5"
  - Tag-based: "send to all my 'urgent' integrations"
- Tags are automatically lowercased via SQLAlchemy event listener

**UnsubscribeToken** - One-time use tokens for anonymous unsubscribe:
- Generated when user subscribes (especially anonymous users)
- 30-day expiry (configurable)
- Token is 32-byte random hex string
- Marked as `used_at` when consumed
- Cleanup job deletes expired tokens (future phase)

**Integration** - User's notification channels:
- `apprise_url_encrypted` - Fernet-encrypted Apprise URL
- `tag` - Lowercase string for grouping (e.g., "urgent", "email")
- `is_active` - Soft delete flag
- Encryption key from environment variable

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

### 1.7 Database Performance Indexes

**Critical indexes for query performance** (add after Phase 7 when you have real queries):

```python
# In src/db/models.py, add to Event model:
from sqlalchemy import Index

# After Event class definition:
__table_args__ = (
    Index('ix_events_start_date', 'start_date'),
    Index('ix_events_public_start', 'is_public', 'start_date'),
)

# In Subscription model:
__table_args__ = (
    Index('ix_subscriptions_event_user', 'event_id', 'user_id', unique=True),
)

# In UnsubscribeToken model:
__table_args__ = (
    Index('ix_unsubscribe_expires', 'expires_at'),
)
```

**Why these indexes?**
- `ix_events_start_date` - For "upcoming events" queries
- `ix_events_public_start` - Composite index for public event listing sorted by date
- `ix_subscriptions_event_user` - Prevents duplicate subscriptions, speeds up lookups
- `ix_unsubscribe_expires` - For cleanup jobs that delete expired tokens

**When to add**: After Phase 7 when subscriptions are working. Not critical for dev but essential before production.

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

# Database dependency (for FastAPI routes)
async def get_db() -> AsyncSession:
    """Get database session for FastAPI dependency injection"""
    async for session in get_db_session():
        yield session

# Note: Temporal activities use get_session() directly, not this dependency

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

### Common Issues

- **bcrypt errors with Python 3.13**: Pin bcrypt to 4.x: `uv add "bcrypt<5.0.0"`
- **EmailStr validation errors**: Install email-validator: `uv add email-validator`
- **Import errors**: Ensure virtual environment is activated

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
app.include_router(health.router)

@app.get("/")
async def root():
    return {"message": "Soonish API - see /docs for API documentation"}
```

### Testing

```bash
# Start server
uv run uvicorn src.api.main:app --reload

# In another terminal, test
curl http://localhost:8000/api/health

# Check OpenAPI docs
open http://localhost:8000/docs
```

### Acceptance Criteria

- ✅ Server starts without errors
- ✅ `GET /api/health` returns 200
- ✅ Swagger UI accessible at `/docs`

**Files created**: `src/api/{main,schemas}.py`, `src/api/routes/health.py`

---

## Phase 4: Authentication (1 day)

**Goal**: User registration, login, JWT/session auth working.

### Dependencies

```bash
# Install auth dependencies
uv add "python-jose[cryptography]" "passlib[bcrypt]" "bcrypt<5.0.0" email-validator
```

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

#### 4.7 Test Endpoint (`src/api/main.py`)

Add a protected endpoint to test authentication:

```python
@app.get("/api/users/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Get current authenticated user info"""
    return current_user
```

### Testing

```bash
# Register user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login (returns both JWT and sets session cookie)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Extract token for testing
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Test protected endpoint without auth (should fail)
curl http://localhost:8000/api/users/me

# Test protected endpoint with JWT
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

### Acceptance Criteria

- ✅ Can register new user
- ✅ Can login with correct password
- ✅ Login fails with wrong password
- ✅ Login returns both JWT token and sets session cookie
- ✅ JWT token works for authenticated endpoints
- ✅ Session cookie works in browser
- ✅ Protected endpoint returns 401 without auth
- ✅ `/api/users/me` returns current user info

**Files created**: `src/api/auth/{password,jwt,session}.py`, `src/api/routes/auth.py`

**Files updated**: `src/api/main.py`

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

#### 5.2 Repository Methods (`src/db/repositories.py`)

Add these methods to `EventRepository`:

```python
async def delete(self, event: Event) -> None:
    await self.session.delete(event)
    await self.session.flush()

async def list_public_events(self, skip: int = 0, limit: int = 100) -> List[Event]:
    result = await self.session.execute(
        select(Event).where(Event.is_public).offset(skip).limit(limit)
    )
    return list(result.scalars().all())
```

#### 5.3 Events Route (`src/api/routes/events.py`)

Full CRUD implementation (no Temporal yet):

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
    await session.refresh(event)
    
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

@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    request: EventUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Update event (organizer only)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this event")
    
    # Update fields
    if request.name is not None:
        event.name = request.name
    if request.description is not None:
        event.description = request.description
    if request.start_date is not None:
        event.start_date = request.start_date
    if request.end_date is not None:
        event.end_date = request.end_date
    if request.location is not None:
        event.location = request.location
    
    await session.commit()
    await session.refresh(event)
    return event

@router.delete("/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """Delete event (organizer only)"""
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this event")
    
    await repo.delete(event)
    await session.commit()
    return None

@router.get("", response_model=list[EventResponse])
async def list_events(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
):
    """List all public events"""
    repo = EventRepository(session)
    events = await repo.list_public_events(skip=skip, limit=limit)
    return events
```

### Testing

```bash
# Get auth token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Create event
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Event",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z"
  }'

# Get event by ID (no auth required for public events)
curl http://localhost:8000/api/events/1

# List all public events
curl http://localhost:8000/api/events

# Update event (organizer only)
curl -X PUT http://localhost:8000/api/events/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Event","location":"New Location"}'

# Test authorization (create another user and try to update)
TOKEN2=$(curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user2@example.com","password":"password123","name":"User Two"}' \
  | jq -r '.access_token')

curl -X PUT http://localhost:8000/api/events/1 \
  -H "Authorization: Bearer $TOKEN2" \
  -d '{"name":"Hacked"}'
# Should return 403 Forbidden

# Delete event (organizer only)
curl -X DELETE http://localhost:8000/api/events/1 \
  -H "Authorization: Bearer $TOKEN"
```

### Acceptance Criteria

- ✅ Can create event (authenticated)
- ✅ Can get event by ID (public access)
- ✅ Can list all public events
- ✅ Can update event (organizer only)
- ✅ Can delete event (organizer only)
- ✅ Event stored in database with workflow ID
- ✅ Returns 401 if not authenticated (create/update/delete)
- ✅ Returns 403 if not authorized (update/delete)
- ✅ Returns 404 if event doesn't exist

**Files created**: `src/api/routes/events.py`

**Files updated**: `src/db/repositories.py`

---

## Phase 6: Temporal Integration (1 day)

**Goal**: EventWorkflow starts when event created, handles signals.

### Build Order

#### 6.1 Install Temporal SDK

```bash
uv add temporalio
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

**CRITICAL**: Activities MUST use `async with get_session()` not `async for get_db_session()`. The latter causes greenlet errors in Temporal's execution context.

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

#### 6.5 Events API Integration

Integrate `src/api/routes/events.py` with Temporal workflow:

```python
from src.api.dependencies import get_temporal_client
from temporalio.client import Client
from src.workflows.event import EventWorkflow
from src.config import get_settings

@router.post("", ...)
async def create_event(
    ...,
    temporal_client: Client = Depends(get_temporal_client)
):
    # ... create event in DB ...
    
    # Start Temporal workflow with error handling
    event_data = {
        "name": event.name,
        "start_date": event.start_date.isoformat(),
        "end_date": event.end_date.isoformat() if event.end_date else None,
        "location": event.location
    }
    
    try:
        await temporal_client.start_workflow(
            EventWorkflow.run,
            args=[event.id, event_data],
            id=workflow_id,
            task_queue=settings.temporal_task_queue
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Event created but workflow failed to start: {str(e)}"
        )
    
    return event
```

#### 6.6 Integrate Update/Delete with Workflows

Add workflow signals to update and delete endpoints:

```python
# Update endpoint - signal workflow about changes
@router.put("/{event_id}", ...)
async def update_event(
    ...,
    temporal_client: Client = Depends(get_temporal_client)
):
    # ... update event in DB ...
    
    # Signal workflow about update
    try:
        handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
        await handle.signal(EventWorkflow.event_updated, {
            "name": event.name,
            "start_date": event.start_date.isoformat(),
            "end_date": event.end_date.isoformat() if event.end_date else None,
            "location": event.location
        })
    except Exception:
        pass  # Non-critical if signal fails
    
    return event

# Delete endpoint - cancel workflow before deletion
@router.delete("/{event_id}", ...)
async def delete_event(
    ...,
    temporal_client: Client = Depends(get_temporal_client)
):
    # ... validate authorization ...
    
    # Cancel workflow before deleting
    try:
        handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
        await handle.signal(EventWorkflow.cancel_event)
    except Exception:
        pass  # Continue with deletion even if cancellation fails
    
    await repo.delete(event)
    await session.commit()
    return None
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
- ✅ Workflow start failure returns 500 error
- ✅ Update event signals workflow with new data
- ✅ Delete event cancels workflow before deletion

**Files created**: `src/workflows/event.py`, `src/activities/events.py`, `src/worker/main.py`

**Files updated**: `src/api/routes/events.py`

#### 6.7 Critical: Database Session Handling in Activities

**Problem**: Using `async for session in get_db_session():` in Temporal activities causes greenlet errors:
```
greenlet_spawn has not been called; can't call await_only() here
```

**Root Cause**: `get_db_session()` is designed for FastAPI dependency injection, not Temporal activities. Temporal's execution context doesn't support the async generator pattern used by `get_db_session()`.

**Solution**: Activities MUST use `get_session()` context manager:

```python
# ❌ WRONG - Causes greenlet errors
async for session in get_db_session():
    repo = SomeRepository(session)
    data = await repo.get_by_id(id)

# ✅ CORRECT - Works in Temporal activities  
from src.db.session import get_session

async with get_session() as session:
    repo = SomeRepository(session)
    data = await repo.get_by_id(id)
```

**Additional Fix**: Ensure repositories eagerly load relationships to prevent lazy loading outside session context:

```python
# In SubscriptionRepository.get_by_id()
async def get_by_id(self, subscription_id: int) -> Optional[Subscription]:
    """Get subscription by ID with selectors eagerly loaded"""
    result = await self.session.execute(
        select(Subscription)
        .where(Subscription.id == subscription_id)
        .options(selectinload(Subscription.selectors))  # ✅ Eager load
    )
    return result.scalar_one_or_none()
```

**Impact**: All activities that access the database must follow this pattern. This is critical for the notification system to work.

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

**Endpoint**: `POST /api/events/{event_id}/subscribe`

**Anonymous Subscription Flow:**
1. User provides email (and optionally name)
2. System creates or finds user by email
3. Creates default `mailto://` integration for user
4. Creates subscription with selector pointing to email integration
5. Generates unsubscribe token (30-day expiry)
6. Signals EventWorkflow with `participant_added`
7. Returns subscription details + unsubscribe token

**Authenticated Subscription Flow:**
1. User already logged in (has JWT)
2. User specifies which integrations to use:
   - `integration_ids: [1, 3]` - specific integrations
   - `tags: ["urgent"]` - all integrations with tag "urgent"
   - Both can be combined
3. Creates subscription with selectors for each
4. Generates unsubscribe token
5. Signals EventWorkflow
6. Returns subscription details

**Key Implementation Details:**
- Anonymous users get auto-created with `is_verified=False`
- Default integration created: `mailto://{email}` with tag "email"
- Selectors created for each integration_id and tag specified
- If no selectors specified (anonymous), defaults to tag "email"
- Unsubscribe token included in response for email links
- Workflow signal is non-critical (continues if signal fails)

Copy subscribe endpoint from `specifications/api-specification.md` - Subscribe to Event section.

#### 7.3 EventWorkflow Integration

Implement `participant_added` signal handler (from `specifications/temporal-specification.md`).

### Testing

```bash
# Anonymous subscribe
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"subscriber@example.com","name":"Test Subscriber"}'

# Authenticated subscribe with specific integrations
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"integration_ids":[1,2]}'

# Authenticated subscribe with tags
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tags":["urgent","email"]}'

# Check workflow received signal in Temporal UI
# Check database for subscription and selectors
```

### Acceptance Criteria

- ✅ Anonymous user can subscribe with email
- ✅ Creates user if doesn't exist (is_verified=False)
- ✅ Creates default mailto:// integration for anonymous users
- ✅ Creates subscription + selectors (integration_id OR tag)
- ✅ Authenticated users can specify integration_ids
- ✅ Authenticated users can specify tags
- ✅ Workflow receives `participant_added` signal
- ✅ Generates unsubscribe token (30-day expiry)
- ✅ Returns unsubscribe token in response
- ✅ Prevents duplicate subscriptions (same user + event)

**Files created**: `src/api/routes/subscriptions.py`

---

## Phase 8: Notification System (1 day)

**Goal**: Notifications delivered via Apprise SDK to multiple channels (Gotify, Email, SMS).

### Configuration Architecture

**IMPORTANT: Understand the distinction between service-level and user-level configuration.**

#### Service-Level Configuration (in `src/config.py`)
These are credentials **Soonish/Notifiq uses** to send notifications on behalf of users:

- **SMTP Settings** (Gmail/ProtonMail) - Service sends FROM these addresses
  - Used for: verification emails, system notifications, fallback email notifications
  - Example: Service sends email FROM `notifications@soonish.app` TO `user@example.com`
  - Gmail for unverified users, ProtonMail for verified users

#### User-Level Configuration (in database `integrations` table)
These are credentials **users provide** for their own notification channels:

- **Gotify** - User provides: Gotify server URL + API token
- **Email** - User provides: Email address
- **SMS** - User provides: Phone number + carrier
- **Slack** - User provides: Webhook URL
- **Discord** - User provides: Webhook URL
- **Any other service** - User provides whatever config that service needs

**Apprise is an implementation detail** - Users should never see "apprise_url" in the API. The Integrations API should accept natural fields like:
- `{"type": "gotify", "url": "https://my-server.com", "token": "ABC123"}`
- `{"type": "email", "address": "user@example.com"}`
- `{"type": "sms", "phone": "+15551234567", "carrier": "verizon"}`

The backend converts these to Apprise URLs internally. This abstraction allows us to:
1. Support non-Apprise integrations in the future
2. Provide better validation and UX
3. Change notification backends without breaking user configs

**Example Flow:**
1. User creates Gotify integration: `POST /api/integrations` with `{"type": "gotify", "url": "https://my-server.com", "token": "ABC123"}`
2. Backend stores as encrypted `apprise_url: "gotify://my-server.com/ABC123"` (internal detail)
3. User subscribes to event with that integration
4. When notification fires, service uses Apprise to deliver to user's Gotify server

**Development/Dogfooding:**
- As a developer, you create your own integrations in the database (like any user would)
- Your Gotify URL/token goes in the `integrations` table via the API, not in `.env`
- The `scripts/dev_integrations.py` script shows how Apprise works internally (for testing)

### Dependencies

```bash
uv add apprise
```

### Build Order

#### 8.1 Configuration (`src/config.py`)

Add **service-level** SMTP settings (users provide their own Gotify/SMS via Integrations API):

```python
class Settings(BaseSettings):
    # ... existing fields ...
    
    # SMTP (Service-level - Notifiq sends FROM these addresses)
    # Used for: verification emails, system notifications, fallback email notifications
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_app_user: str = ""
    smtp_app_password: str = ""
    
    # SMTP (Gmail for unverified users)
    gmail_user: str = ""
    gmail_app_password: str = ""
    smtp_server_gmail: str = "smtp.gmail.com"
    
    # SMTP (ProtonMail for verified users)
    proton_user: str = ""
    proton_app_password: str = ""
    smtp_server_proton: str = "smtp.protonmail.ch"
    
    # Note: User-level integrations (Gotify, SMS, etc.) are stored in the database
    # Users provide their own Gotify URLs/tokens, phone numbers, etc. via Integrations API
```

#### 8.2 Notification Builder (`src/activities/notification_builder.py`)

Helper to construct Apprise instances from database integrations:

```python
import apprise
from src.db.session import get_session
from src.db.repositories import IntegrationRepository, SubscriptionRepository
from src.config import get_settings


class NotificationBuilder:
    """Build Apprise instances from user integrations"""
    
    @staticmethod
    async def build_for_user(user_id: int, tags: list[str] | None = None) -> apprise.Apprise:
        """Build Apprise instance for a single user's integrations"""
        async with get_session() as session:
            repo = IntegrationRepository(session)
            integrations = await repo.list_by_user(user_id)
            
            apobj = apprise.Apprise()
            for integration in integrations:
                if not integration.is_active:
                    continue
                
                # Filter by tags if specified
                if tags and integration.tag not in tags:
                    continue
                
                # Add integration with tag
                apobj.add(integration.apprise_url, tag=integration.tag)
            
            return apobj
    
    @staticmethod
    async def build_for_event_subscribers(
        event_id: int,
        selector_tags: list[str] | None = None
    ) -> dict[int, apprise.Apprise]:
        """Build Apprise instances for all event subscribers
        
        Returns: {user_id: apprise_instance}
        """
        async with get_session() as session:
            sub_repo = SubscriptionRepository(session)
            int_repo = IntegrationRepository(session)
            
            # Get all subscriptions for event
            subscriptions = await sub_repo.list_by_event(event_id)
            
            result = {}
            for subscription in subscriptions:
                # Get integration IDs from selectors
                integration_ids = [
                    selector.integration_id 
                    for selector in subscription.selectors
                    if selector.integration_id is not None
                ]
                
                # Get selector tags
                sub_tags = [
                    selector.tag 
                    for selector in subscription.selectors
                    if selector.tag is not None
                ]
                
                # Filter by selector_tags if specified
                if selector_tags:
                    sub_tags = [t for t in sub_tags if t in selector_tags]
                
                # Build Apprise instance
                apobj = apprise.Apprise()
                
                # Add integrations by ID
                for int_id in integration_ids:
                    integration = await int_repo.get_by_id(int_id)
                    if integration and integration.is_active:
                        apobj.add(integration.apprise_url, tag=integration.tag)
                
                # Add integrations by tag
                if sub_tags:
                    user_integrations = await int_repo.list_by_user(subscription.user_id)
                    for integration in user_integrations:
                        if integration.is_active and integration.tag in sub_tags:
                            apobj.add(integration.apprise_url, tag=integration.tag)
                
                result[subscription.user_id] = apobj
            
            return result
    
    @staticmethod
    def build_fallback_email(email: str, is_verified: bool = False) -> apprise.Apprise:
        """Build fallback email notification for users without integrations"""
        settings = get_settings()
        apobj = apprise.Apprise()
        
        if is_verified and settings.proton_user:
            # Use ProtonMail for verified users
            apobj.add(
                f'mailtos://?to={email}'
                f'&smtp={settings.smtp_server_proton}'
                f'&user={settings.proton_user}'
                f'&pass={settings.proton_app_password}'
                f'&from=Soonish <{settings.proton_user}>'
            )
        elif settings.gmail_user:
            # Use Gmail for unverified users
            apobj.add(
                f'mailtos://?to={email}'
                f'&smtp={settings.smtp_server_gmail}'
                f'&user={settings.gmail_user}'
                f'&pass={settings.gmail_app_password}'
                f'&from=Soonish <{settings.gmail_user}>'
            )
        
        return apobj
```

#### 8.3 Notification Activities (`src/activities/notifications.py`)

Core notification activities:

```python
from temporalio import activity
from src.activities.notification_builder import NotificationBuilder
from src.db.session import get_db_session
from src.db.repositories import UserRepository
import logging

logger = logging.getLogger(__name__)


@activity.defn
async def send_notification(
    user_id: int,
    title: str,
    body: str,
    level: str = "info",  # info | warning | critical
    tags: list[str] | None = None
) -> dict:
    """Send notification to a single user
    
    Returns: {
        "success": int,
        "failed": int,
        "channels": list[str],
        "errors": list[str]
    }
    """
    try:
        # Build Apprise instance for user
        apobj = await NotificationBuilder.build_for_user(user_id, tags)
        
        # Check if user has any integrations
        if len(apobj) == 0:
            # Fallback to email
            from src.db.session import get_session
            async with get_session() as session:
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id)
                if user:
                    apobj = NotificationBuilder.build_fallback_email(
                        user.email,
                        user.is_verified
                    )
        
        # Send notification
        if len(apobj) > 0:
            result = apobj.notify(body=body, title=title)
            
            return {
                "success": 1 if result else 0,
                "failed": 0 if result else 1,
                "channels": [str(s) for s in apobj.urls()],
                "errors": [] if result else ["Notification failed"]
            }
        else:
            return {
                "success": 0,
                "failed": 1,
                "channels": [],
                "errors": ["No notification channels configured"]
            }
    
    except Exception as e:
        logger.error(f"Notification failed for user {user_id}: {e}")
        return {
            "success": 0,
            "failed": 1,
            "channels": [],
            "errors": [str(e)]
        }


@activity.defn
async def send_notification_to_subscribers(
    event_id: int,
    title: str,
    body: str,
    level: str = "info",
    selector_tags: list[str] | None = None
) -> dict:
    """Send notification to all event subscribers
    
    Returns: {
        "total_subscribers": int,
        "success": int,
        "failed": int,
        "details": list[dict]
    }
    """
    try:
        # Build Apprise instances for all subscribers
        subscribers = await NotificationBuilder.build_for_event_subscribers(
            event_id,
            selector_tags
        )
        
        total = len(subscribers)
        success = 0
        failed = 0
        details = []
        
        # Send to each subscriber
        for user_id, apobj in subscribers.items():
            try:
                if len(apobj) > 0:
                    result = apobj.notify(body=body, title=title)
                    if result:
                        success += 1
                        details.append({
                            "user_id": user_id,
                            "status": "success",
                            "channels": len(apobj)
                        })
                    else:
                        failed += 1
                        details.append({
                            "user_id": user_id,
                            "status": "failed",
                            "error": "Notification failed"
                        })
                else:
                    # No integrations, try fallback email
                    from src.db.session import get_session
                    async with get_session() as session:
                        user_repo = UserRepository(session)
                        user = await user_repo.get_by_id(user_id)
                        if user:
                            fallback = NotificationBuilder.build_fallback_email(
                                user.email,
                                user.is_verified
                            )
                            result = fallback.notify(body=body, title=title)
                            if result:
                                success += 1
                                details.append({
                                    "user_id": user_id,
                                    "status": "success",
                                    "channels": 1,
                                    "fallback": "email"
                                })
                            else:
                                failed += 1
                                details.append({
                                    "user_id": user_id,
                                    "status": "failed",
                                    "error": "Fallback email failed"
                                })
            except Exception as e:
                failed += 1
                details.append({
                    "user_id": user_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        return {
            "total_subscribers": total,
            "success": success,
            "failed": failed,
            "details": details
        }
    
    except Exception as e:
        logger.error(f"Failed to send notifications for event {event_id}: {e}")
        return {
            "total_subscribers": 0,
            "success": 0,
            "failed": 0,
            "details": [],
            "error": str(e)
        }
```

#### 8.4 Worker Configuration (`src/worker/main.py`)

Register notification activities:

```python
from src.activities.notifications import (
    send_notification,
    send_notification_to_subscribers
)

worker = Worker(
    client,
    task_queue=settings.temporal_task_queue,
    workflows=[EventWorkflow],
    activities=[
        validate_event_exists,
        get_event_details,
        send_notification,
        send_notification_to_subscribers
    ]
)
```

#### 8.5 EventWorkflow Integration (`src/workflows/event.py`)

Add notification calls to EventWorkflow (placeholder for Phase 9 schedules):

```python
# In EventWorkflow.run(), after event validation:

# TODO Phase 9: Add reminder scheduling here
# For now, just log that notifications would be sent
workflow.logger.info(
    f"Event {event_id} ready for notifications. "
    f"Reminders will be added in Phase 9."
)

# Handle event_updated signal - notify subscribers
@workflow.signal
async def event_updated(self, updated_data: dict) -> None:
    self.event_data = updated_data
    
    # Send update notification to subscribers
    await workflow.execute_activity(
        send_notification_to_subscribers,
        args=[
            self.event_id,
            f"Event Updated: {updated_data.get('name', 'Event')}",
            f"The event has been updated. Check the details for changes.",
            "info"
        ],
        start_to_close_timeout=timedelta(minutes=2)
    )
```

### Testing

#### Manual Testing Script (`scripts/test_notifications.py`)

```python
"""Test notification system with real integrations"""
import asyncio
from src.db.session import get_session
from src.db.repositories import UserRepository, IntegrationRepository, EventRepository
from src.activities.notification_builder import NotificationBuilder
from src.activities.notifications import send_notification, send_notification_to_subscribers
from temporalio import activity
from temporalio.testing import ActivityEnvironment


async def test_notification_builder():
    """Test building Apprise instances from database"""
    print("Testing NotificationBuilder...")
    
    async with get_session() as session:
        # Get test user
        user_repo = UserRepository(session)
        user = await user_repo.get_by_email("test@example.com")
        
        if not user:
            print("❌ Test user not found. Run scripts/init_db.py first.")
            return
        
        # Build Apprise instance
        apobj = await NotificationBuilder.build_for_user(user.id)
        print(f"✅ Built Apprise instance with {len(apobj)} integrations")
        
        # List integrations
        int_repo = IntegrationRepository(session)
        integrations = await int_repo.list_by_user(user.id)
        for integration in integrations:
            print(f"  - {integration.name} ({integration.tag})")


async def test_send_notification():
    """Test sending notification to a user"""
    print("\nTesting send_notification activity...")
    
    async with get_session() as session:
        user_repo = UserRepository(session)
        user = await user_repo.get_by_email("test@example.com")
        
        if not user:
            print("❌ Test user not found")
            return
        
        # Run activity in test environment
        async with ActivityEnvironment() as env:
            result = await env.run(
                send_notification,
                user.id,
                "Test Notification",
                "This is a test notification from Soonish!",
                "info"
            )
            
            print(f"✅ Notification result: {result}")
            if result["success"] > 0:
                print(f"  Sent to channels: {result['channels']}")
            if result["errors"]:
                print(f"  Errors: {result['errors']}")


async def test_send_to_subscribers():
    """Test sending notification to event subscribers"""
    print("\nTesting send_notification_to_subscribers activity...")
    
    async with get_session() as session:
        event_repo = EventRepository(session)
        events = await event_repo.list_public_events(limit=1)
        
        if not events:
            print("❌ No events found")
            return
        
        event = events[0]
        
        # Run activity in test environment
        async with ActivityEnvironment() as env:
            result = await env.run(
                send_notification_to_subscribers,
                event.id,
                f"Test: {event.name}",
                "This is a test notification to all subscribers!",
                "info"
            )
            
            print(f"✅ Notification result:")
            print(f"  Total subscribers: {result['total_subscribers']}")
            print(f"  Success: {result['success']}")
            print(f"  Failed: {result['failed']}")
            
            for detail in result.get('details', []):
                status = detail['status']
                user_id = detail['user_id']
                print(f"  - User {user_id}: {status}")


async def main():
    await test_notification_builder()
    await test_send_notification()
    await test_send_to_subscribers()


if __name__ == "__main__":
    asyncio.run(main())
```

#### Testing Steps

```bash
# 1. Install Apprise
uv add apprise

# 2. Add SERVICE-LEVEL SMTP settings to .env (for sending emails)
echo "GMAIL_USER=your_service_email@gmail.com" >> .env
echo "GMAIL_APP_PASSWORD=your_app_password" >> .env
# Optional: ProtonMail for verified users
echo "PROTON_USER=your_service_email@proton.me" >> .env
echo "PROTON_APP_PASSWORD=your_app_password" >> .env

# 3. Ensure database has integrations
uv run scripts/init_db.py

# 4. Create USER-LEVEL integration (dogfooding - your own Gotify server)
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Create your Gotify integration (replace with your server/token)
curl -X POST http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Gotify",
    "apprise_url": "gotify://gotify.paynepride.com/YOUR_TOKEN/?priority=normal",
    "tag": "urgent"
  }'

# 5. Test notification builder
uv run scripts/test_notifications.py

# 6. Test with worker (Terminal 1)
uv run python -m src.worker.main

# 7. Update an event to trigger notification (Terminal 2)
curl -X PUT http://localhost:8000/api/events/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Event","location":"New Location"}'

# 8. Check YOUR Gotify server for notification
```

### Acceptance Criteria

- ✅ Apprise dependency installed
- ✅ Service-level SMTP configured (Gmail/ProtonMail for sending emails)
- ✅ User-level integrations stored in database (Gotify URLs, etc.)
- ✅ `NotificationBuilder` constructs Apprise instances from database integrations
- ✅ `send_notification` activity sends to single user
- ✅ `send_notification_to_subscribers` activity sends to all event subscribers
- ✅ Fallback email works for users without integrations (uses service SMTP)
- ✅ Tag-based filtering works (e.g., only "urgent" notifications)
- ✅ Handles partial failures gracefully
- ✅ Returns delivery statistics
- ✅ EventWorkflow sends notification on event update
- ✅ Real Gotify notifications received during testing (to user's own server)
- ✅ Configuration architecture clearly documented (service vs user level)

**Files created**: 
- `src/activities/notification_builder.py`
- `src/activities/notifications.py`
- `scripts/test_notifications.py`

**Files updated**: 
- `src/config.py`
- `src/worker/main.py`
- `src/workflows/event.py`


---

## Phase 9: Temporal Schedules (1 day)

**Goal**: Automatic reminders at T-1d, T-1h before events using Temporal Schedules.

**Known Limitation**: This phase implements **hardcoded system default reminders** (T-1d and T-1h for all events). Users cannot customize reminder times yet. See Phase 11 for per-subscription custom reminders.

### Why Temporal Schedules?

**Problem**: Event times can change. If we use `workflow.sleep`, reminders become stale:
- Event scheduled for Jan 15, reminder sleeps until Jan 14
- Organizer moves event to Jan 10
- Reminder still fires Jan 14 (4 days late!)

**Solution**: Temporal Schedules can be deleted/recreated when event times change.

### Build Order

#### 9.1 Schedule Management Activities (`src/activities/schedules.py`)

Create activities to manage Temporal Schedules:

```python
@activity.defn
async def create_reminder_schedules(event_id: int, start_date_iso: str) -> dict:
    """Create Temporal Schedules for T-1d and T-1h reminders"""
    # Parse start date
    # Calculate reminder times (start_date - 1 day, start_date - 1 hour)
    # Skip if reminder time is in the past
    # Create Temporal Schedule for each reminder
    # Return list of created schedule IDs

@activity.defn
async def delete_reminder_schedules(event_id: int) -> dict:
    """Delete all reminder schedules for an event"""
    # Connect to Temporal
    # Delete schedules: event-{id}-reminder-1day, event-{id}-reminder-1hour
    # Handle "not found" gracefully (idempotent)
```

#### 9.2 ReminderWorkflow (`src/workflows/reminder.py`)

Short-lived workflow triggered by Temporal Schedules:

```python
@workflow.defn
class ReminderWorkflow:
    @workflow.run
    async def run(self, event_id: int, reminder_type: str) -> str:
        """Send scheduled reminder notification"""
        # Get current event details (may have changed since schedule created)
        # Send reminder notification via send_reminder_notification activity
        # Return success
```

#### 9.3 Reminder Activity (`src/activities/reminders.py`)

Already created - formats reminder messages and calls `send_notification_to_subscribers`.

#### 9.4 EventWorkflow Integration

Update EventWorkflow to manage schedules:

```python
# In EventWorkflow.run() - after validating event
await workflow.execute_activity(
    create_reminder_schedules,
    args=[event_id, details['start_date']],
    start_to_close_timeout=timedelta(minutes=1)
)

# In event_updated signal - if start_date changed
if updated_data.get('start_date') != self.event_data.get('start_date'):
    await workflow.execute_activity(delete_reminder_schedules, event_id, ...)
    await workflow.execute_activity(create_reminder_schedules, ...)

# In finally block or cancel_event signal
await workflow.execute_activity(delete_reminder_schedules, event_id, ...)
```

#### 9.5 Worker Configuration

Register ReminderWorkflow in worker.

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
- ✅ Schedules skipped if reminder time is in past
- ✅ Schedule deletion is idempotent (handles "not found")
- ✅ Schedule creation is idempotent (handles "already exists")

**Files created**: 
- `src/workflows/reminder.py`
- `src/activities/schedules.py`
- `src/activities/reminders.py`
- `scripts/test_phase_9.sh`

**Files updated**:
- `src/workflows/event.py` - Added schedule management
- `src/worker/main.py` - Registered ReminderWorkflow and schedule activities

---

## Current Project Structure (After Phase 9)

```
soonish/
├── src/
│   ├── activities/
│   │   ├── events.py              # Event validation activities
│   │   ├── notification_builder.py # Builds Apprise instances from DB
│   │   ├── notifications.py        # Send notification activities
│   │   ├── reminders.py           # Reminder notification formatting
│   │   └── schedules.py           # Temporal Schedule management
│   │
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py            # Login, register, JWT
│   │   │   ├── events.py          # Event CRUD
│   │   │   ├── health.py          # Health check + Temporal status
│   │   │   └── subscriptions.py   # Subscribe to events
│   │   ├── dependencies.py        # FastAPI dependencies (auth, DB, Temporal)
│   │   ├── main.py               # FastAPI app setup
│   │   └── schemas.py            # Pydantic request/response models
│   │
│   ├── db/
│   │   ├── base.py               # SQLAlchemy base + timestamp mixin
│   │   ├── encryption.py         # Fernet encryption for sensitive fields
│   │   ├── models.py             # All database models
│   │   ├── repositories.py       # Data access layer
│   │   └── session.py            # Async session management
│   │
│   ├── workflows/
│   │   ├── event.py              # EventWorkflow (main orchestrator)
│   │   └── reminder.py           # ReminderWorkflow (triggered by schedules)
│   │
│   ├── worker/
│   │   └── main.py               # Temporal worker registration
│   │
│   └── config.py                 # Environment config (Pydantic Settings)
│
├── scripts/
│   ├── init_db.py                # Database initialization + sample data
│   ├── test_notifications.py     # Test notification system
│   └── test_phase_9.sh          # Test reminder schedules
│
├── docs/
│   ├── implementation/
│   │   └── phase-plan.md         # This file
│   └── specifications/
│       ├── api-specification.md
│       ├── data-models.md
│       └── temporal-specification.md
│
├── .env                          # Environment variables (not in git)
├── .env.example                  # Template for .env
├── pyproject.toml               # uv dependencies
└── soonish.db                   # SQLite database (dev only)
```

**Key Import Dependencies:**
- `api/routes/*` → `db/repositories` → `db/models`
- `api/routes/events` → `api/dependencies` → Temporal client
- `workflows/*` → `activities/*` (via unsafe.imports_passed_through)
- `activities/*` → `db/repositories` → `db/models`
- `worker/main` → registers all workflows + activities

**Data Flow:**
1. API receives request → validates with Pydantic schemas
2. Route uses repository to query/update database
3. Route starts/signals Temporal workflow (if needed)
4. Workflow executes activities (database ops, notifications)
5. Activities use repositories for database access
6. Activities use Apprise SDK for notifications

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

**Endpoints:**
- `POST /api/integrations` - Create integration (encrypts apprise_url)
- `GET /api/integrations` - List user's integrations
- `GET /api/integrations/{id}` - Get integration by ID
- `PATCH /api/integrations/{id}?is_active=true|false` - Activate/deactivate
- `POST /api/integrations/{id}/test` - Send test notification
- `DELETE /api/integrations/{id}` - Delete integration

**Key Implementation:**
- Encrypt `apprise_url` before storing using `encrypt_field()`
- Never return `apprise_url` in responses (security)
- Tag is automatically lowercased
- Authorization checks (user can only access their own integrations)
- Test endpoint uses `send_notification()` activity

### Testing

```bash
# Run comprehensive Python test script
uv run python scripts/test_phase_10.py

# Or manual testing with curl:
# Create integration
curl -X POST http://localhost:8000/api/integrations \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
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

# Deactivate
curl -X PATCH http://localhost:8000/api/integrations/1?is_active=false \
  -H "Authorization: Bearer $TOKEN"
```

### Acceptance Criteria

- ✅ Can create integration (URL encrypted with Fernet)
- ✅ Can list user's integrations
- ✅ Can get integration by ID
- ✅ Can test integration (sends test notification via Apprise)
- ✅ Can activate/deactivate integration
- ✅ Can delete integration
- ✅ `apprise_url` never returned in responses (security check)
- ✅ Authorization enforced (403 for other users' integrations)
- ✅ Tag automatically lowercased

**Files created**: 
- `src/api/routes/integrations.py`
- `scripts/test_phase_10.py` - Python test script (uses httpx + rich for better UX)

**Files updated**:
- `src/api/schemas.py` - Added IntegrationCreateRequest, IntegrationResponse
- `src/api/main.py` - Registered integrations router
- `pyproject.toml` - Added `rich` dependency for test output

**Note**: Starting with Phase 10, test scripts are Python (not bash) for better maintainability, error handling, and cross-platform support.

---

## Phase 11: Custom Reminder Preferences (1 day)

**Goal**: Users can configure custom reminder times per subscription.

**Current Limitation**: Phase 9 hardcodes T-1d and T-1h reminders for all events. Users should be able to set their own reminder preferences.

### Design Decision: Subscription-Level Reminders

Each subscription can have custom reminder offsets. This allows:
- Per-event customization (e.g., "remind me 2 days before this concert")
- Opt-out of reminders (empty list)
- Multiple reminders per event (e.g., 1 week, 1 day, 1 hour)

### Build Order

#### 11.1 Database Migration

Add `subscription_reminders` table:

```sql
CREATE TABLE subscription_reminders (
    id INTEGER PRIMARY KEY,
    subscription_id INTEGER NOT NULL,
    offset_seconds INTEGER NOT NULL,  -- Seconds before event (e.g., 86400 = 1 day)
    created_at DATETIME NOT NULL,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id)
);

CREATE INDEX ix_subscription_reminders_subscription_id 
ON subscription_reminders(subscription_id);
```

#### 11.2 Update Subscription Schema

```python
# src/api/schemas.py
class SubscribeRequest(BaseModel):
    email: str | None = None
    name: str | None = None
    integration_ids: list[int] | None = None
    tags: list[str] | None = None
    reminder_offsets: list[int] | None = None  # NEW: seconds before event
    # Examples: [86400, 3600] = 1 day, 1 hour
    # Empty list = no reminders
    # None = use system defaults (T-1d, T-1h)
```

#### 11.3 Update Schedule Creation Activity

Modify `create_reminder_schedules` to accept subscription-specific reminders:

```python
@activity.defn
async def create_reminder_schedules(
    event_id: int,
    start_date_iso: str,
    subscription_reminders: dict[int, list[int]] | None = None
) -> dict:
    """
    Create Temporal Schedules for event reminders.
    
    Args:
        event_id: Event database ID
        start_date_iso: Event start date as ISO8601 string
        subscription_reminders: Optional dict of {subscription_id: [offset_seconds]}
                               If None, uses system defaults (T-1d, T-1h)
    """
    # If no custom reminders, use defaults
    if subscription_reminders is None:
        reminders = [
            {"type": "1day", "offset": timedelta(days=1)},
            {"type": "1hour", "offset": timedelta(hours=1)}
        ]
    else:
        # Create schedule per subscription per reminder
        # Schedule ID: event-{event_id}-sub-{sub_id}-reminder-{offset}
        pass
```

#### 11.4 Update EventWorkflow

Pass subscription reminder data to schedule creation:

```python
# Get all subscriptions with their reminder preferences
subscription_reminders = await workflow.execute_activity(
    get_subscription_reminders,
    event_id,
    ...
)

# Create schedules with custom reminders
await workflow.execute_activity(
    create_reminder_schedules,
    args=[event_id, details['start_date'], subscription_reminders],
    ...
)
```

#### 11.5 User Preferences Endpoint (Optional)

Add endpoint for users to set default reminder preferences:

```python
# POST /api/users/me/reminder-preferences
{
    "default_reminders": [86400, 3600, 900]  # 1d, 1h, 15min
}
```

### Testing

```bash
# Subscribe with custom reminders (2 days, 1 hour)
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reminder_offsets": [172800, 3600]
  }'

# Subscribe with no reminders
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "reminder_offsets": []
  }'

# Subscribe with system defaults (omit field)
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}'
```

### Acceptance Criteria

- ✅ Users can specify custom reminder offsets when subscribing
- ✅ Empty list = no reminders created
- ✅ Null/omitted = system defaults (T-1d, T-1h)
- ✅ Multiple reminders per subscription supported
- ✅ Schedule IDs include subscription ID for uniqueness
- ✅ Reminder preferences stored in database
- ✅ Schedule recreation handles custom reminders on event update

**Files created**:
- Database migration for `subscription_reminders` table

**Files updated**:
- `src/api/schemas.py` - Add `reminder_offsets` to SubscribeRequest
- `src/api/routes/subscriptions.py` - Store reminder preferences
- `src/activities/schedules.py` - Support per-subscription reminders
- `src/workflows/event.py` - Pass subscription reminders to schedule creation
- `src/db/models.py` - Add SubscriptionReminder model
- `src/db/repositories.py` - Add methods to query subscription reminders

---

## Testing Strategy

### Running All Tests

```bash
# 1. Start Temporal server (Terminal 1)
temporal server start-dev

# 2. Start worker (Terminal 2)
uv run python -m src.worker.main

# 3. Start API server (Terminal 3)
uv run uvicorn src.api.main:app --reload

# 4. Run phase-specific tests
uv run scripts/init_db.py              # Phase 1: Database
uv run scripts/test_notifications.py   # Phase 8: Notifications
./scripts/test_phase_9.sh             # Phase 9: Reminders
```

### Verification Checklist

**After Each Phase:**
1. Run `uv run ruff check --fix .` - All checks pass
2. Check Temporal UI (http://localhost:8233) - Workflows visible
3. Check database - `sqlite3 soonish.db ".tables"` shows expected tables
4. Test API endpoints - Use curl commands from phase testing sections
5. Check logs - No errors in worker/API output

**Integration Test Flow:**
1. Create user: `POST /api/auth/register`
2. Login: `POST /api/auth/login` → get token
3. Create event: `POST /api/events` → starts EventWorkflow
4. Subscribe: `POST /api/events/{id}/subscribe` → signals workflow
5. Update event: `PUT /api/events/{id}` → sends notification + recreates schedules
6. Check Gotify/email for notifications
7. Verify in Temporal UI: EventWorkflow running, schedules created

**Common Issues:**
- Worker not picking up workflows → Check `TEMPORAL_TASK_QUEUE` matches in config and worker
- Notifications not sending → Check integration `is_active=true` and `apprise_url` is valid
- Schedules not firing → Check reminder time is in future, check Temporal UI schedules tab
- Database errors → Run `uv run scripts/init_db.py` to reset

---

## Post-MVP Enhancements

After Phase 11, you have a working MVP with custom reminders. Future phases:

### Phase 12: Frontend (HTMX + Alpine.js)
- Event creation form
- Subscription page with reminder configuration
- Integration management UI

### Phase 13: Email Verification
- Verification tokens
- Email sending (SMTP)
- Verified user features

### Phase 14: Private Events
- Event visibility controls
- Invitation system

### Phase 15: Event Memberships
- Multi-organizer support
- Role-based permissions

### Phase 16: Production Readiness
- Rate limiting (IP-based with logging)
- Monitoring/observability
- PostgreSQL migration
- Redis for sessions
- Docker deployment

**Rate Limiting Implementation**:
```python
# src/api/middleware/rate_limit.py
from fastapi import Request, HTTPException
from collections import defaultdict
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[datetime]] = defaultdict(list)
    
    async def check_rate_limit(self, request: Request):
        # Get client IP (handle proxies)
        client_ip = request.client.host
        if forwarded := request.headers.get("X-Forwarded-For"):
            client_ip = forwarded.split(",")[0].strip()
        
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old requests
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if req_time > minute_ago
        ]
        
        # Check limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            logger.warning(
                f"Rate limit exceeded for IP {client_ip} on {request.url.path}"
            )
            raise HTTPException(status_code=429, detail="Too many requests")
        
        # Record request
        self.requests[client_ip].append(now)
        logger.info(f"Request from {client_ip} to {request.url.path}")
```

---

## Quick Reference Commands

### Daily Development Workflow

```bash
# Start all services (3 terminals)
temporal server start-dev              # Terminal 1
uv run python -m src.worker.main       # Terminal 2  
uv run uvicorn src.api.main:app --reload  # Terminal 3

# Reset database (when needed)
uv run scripts/init_db.py

# Get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer@example.com","password":"password123"}' \
  | jq -r '.access_token')

# Create event
curl -X POST http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Event","start_date":"2025-10-10T10:00:00Z","end_date":"2025-10-10T11:00:00Z"}'

# Subscribe to event
curl -X POST http://localhost:8000/api/events/1/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Check code quality
uv run ruff check --fix .
```

### Debugging Tools

```bash
# Inspect database
sqlite3 soonish.db
> .tables
> SELECT * FROM users;
> .quit

# Check Temporal workflows
open http://localhost:8233

# View worker logs
uv run python -m src.worker.main  # Watch for activity execution

# Test notifications
uv run scripts/test_notifications.py

# Test reminders
./scripts/test_phase_9.sh
```

### When Things Break

1. **Import errors** → Activate venv: `source .venv/bin/activate`
2. **Database locked** → Close all SQLite connections, restart API
3. **Workflow not starting** → Check `TEMPORAL_TASK_QUEUE` in .env matches worker
4. **Auth failing** → Regenerate `SECRET_KEY` in .env
5. **Notifications not sending** → Check integration `is_active=true`, verify Apprise URL
6. **Nuclear option** → `rm soonish.db && uv run scripts/init_db.py`

---

## Dependency Checklist

| Package | Install Command | Purpose | Phase |
|---------|----------------|---------|-------|
| fastapi | `uv add fastapi` | API framework | 0 |
| uvicorn | `uv add uvicorn` | ASGI server | 0 |
| sqlalchemy | `uv add sqlalchemy` | ORM | 0 |
| aiosqlite | `uv add aiosqlite` | Async SQLite | 0 |
| cryptography | `uv add cryptography` | Encryption | 0 |
| httpx | `uv add httpx` | HTTP client | 0 |
| python-jose[cryptography] | `uv add "python-jose[cryptography]"` | JWT tokens | 4 |
| passlib[bcrypt] | `uv add "passlib[bcrypt]"` | Password hashing | 4 |
| bcrypt | `uv add "bcrypt<5.0.0"` | Hash backend (pinned for Python 3.13) | 4 |
| email-validator | `uv add email-validator` | Email validation | 4 |
| temporalio | `uv add temporalio` | Workflow engine | 6 |

---

## Quick Reference Commands

```bash
# Start API server
uv run uvicorn src.api.main:app --reload

# Run database init
uv run python scripts/init_db.py

# Check code quality
uv run ruff check --fix

# Get auth token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  | jq -r '.access_token')

# Use token in requests
curl http://localhost:8000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

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
