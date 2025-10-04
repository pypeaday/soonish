# API Specification

**Status**: Authoritative  
**Last Updated**: 2025-10-03  
**Purpose**: Defines all FastAPI endpoints, request/response schemas, and HTTP contracts for Soonish.

---

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Events API](#events-api)
4. [Subscriptions API](#subscriptions-api)
5. [Integrations API](#integrations-api)
6. [Users API](#users-api)
7. [Health & Ops API](#health--ops-api)
8. [Error Responses](#error-responses)

---

## Overview

### Base URL
```
Development: http://localhost:8000
Production: https://api.soonish.app
```

### Response Format
All responses use JSON with consistent structure:

```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Headers
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt_token>  (for JWT auth)
Cookie: session_id=<session>       (for session auth)
```

---

## Authentication

See [authentication.md](./authentication.md) for complete auth flows.

### Quick Reference

**JWT Authentication** (for API clients):
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Session Authentication** (for web UI):
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}

Response:
Set-Cookie: session_id=<secure_token>; HttpOnly; Secure; SameSite=Lax
```

---

## Events API

### Create Event

Create a new event and start its Temporal workflow.

```http
POST /api/events
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Team Standup",
  "description": "Weekly team sync meeting",
  "start_date": "2025-10-10T10:00:00Z",
  "end_date": "2025-10-10T11:00:00Z",
  "timezone": "America/Chicago",
  "location": "Conference Room A",
  "is_public": true
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Team Standup",
    "description": "Weekly team sync meeting",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z",
    "timezone": "America/Chicago",
    "location": "Conference Room A",
    "is_public": true,
    "temporal_workflow_id": "event-42-uuid",
    "organizer_user_id": 1,
    "created_at": "2025-10-03T12:00:00Z",
    "updated_at": "2025-10-03T12:00:00Z"
  }
}
```

**Implementation**:
```python
# src/api/routes/events.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client
from src.db.session import get_db_session
from src.db.repositories import EventRepository
from src.db.models import Event
from src.api.dependencies import get_current_user, get_temporal_client
from src.workflows.event import EventWorkflow
import uuid

router = APIRouter(prefix="/api/events", tags=["events"])

@router.post("", status_code=201)
async def create_event(
    request: EventCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    # Generate unique workflow ID
    workflow_id = f"event-{uuid.uuid4()}"
    
    # Create event in database
    repo = EventRepository(session)
    event = Event(
        name=request.name,
        description=request.description,
        start_date=request.start_date,
        end_date=request.end_date,
        timezone=request.timezone or "UTC",
        location=request.location,
        is_public=request.is_public,
        temporal_workflow_id=workflow_id,
        organizer_user_id=current_user.id
    )
    event = await repo.create(event)
    await session.commit()
    
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
        task_queue="soonish-task-queue"
    )
    
    return {"success": True, "data": event}
```

---

### Get Event

Retrieve event details.

```http
GET /api/events/{event_id}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Team Standup",
    "description": "Weekly team sync meeting",
    "start_date": "2025-10-10T10:00:00Z",
    "end_date": "2025-10-10T11:00:00Z",
    "timezone": "America/Chicago",
    "location": "Conference Room A",
    "is_public": true,
    "organizer_user_id": 1,
    "subscriber_count": 5,
    "created_at": "2025-10-03T12:00:00Z"
  }
}
```

**Authorization**:
- Public events: No auth required
- Private events: Must be organizer or subscriber

---

### Update Event

Update event details and notify subscribers.

```http
PATCH /api/events/{event_id}
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body** (all fields optional):
```json
{
  "name": "Updated Team Standup",
  "description": "Changed description",
  "start_date": "2025-10-10T11:00:00Z",
  "location": "Conference Room B"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 42,
    "name": "Updated Team Standup",
    ...
  },
  "message": "Event updated and subscribers notified"
}
```

**Implementation**:
```python
@router.patch("/{event_id}")
async def update_event(
    event_id: int,
    request: EventUpdateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update fields
    update_data = request.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)
    
    await repo.update(event)
    await session.commit()
    
    # Signal workflow
    workflow_handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
    await workflow_handle.signal("event_updated", update_data)
    
    return {
        "success": True,
        "data": event,
        "message": "Event updated and subscribers notified"
    }
```

---

### Send Manual Notification

Send custom notification to subscribers.

```http
POST /api/events/{event_id}/notify
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "Important Update",
  "body": "Please bring your laptops to the meeting.",
  "notification_level": "warning",
  "subscription_ids": [1, 2, 3]
}
```

**Fields**:
- `title` (required): Notification title
- `body` (required): Notification message
- `notification_level` (optional): "info" (default), "warning", or "critical"
- `subscription_ids` (optional): Specific subscriptions to notify (omit for all)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Notification sent to 3 subscribers"
}
```

---

### Delete Event

Cancel event and notify subscribers.

```http
DELETE /api/events/{event_id}
Authorization: Bearer <token> | Cookie: session_id
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Event cancelled and subscribers notified"
}
```

**Implementation**:
```python
@router.delete("/{event_id}")
async def cancel_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404)
    
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403)
    
    # Signal workflow to cancel
    workflow_handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
    await workflow_handle.signal("cancel_event")
    
    # Wait a moment for workflow to process cancellation
    await asyncio.sleep(1)
    
    # Delete from database
    await session.delete(event)
    await session.commit()
    
    return {
        "success": True,
        "message": "Event cancelled and subscribers notified"
    }
```

---

## Subscriptions API

### Subscribe to Event

Subscribe to an event (anonymous or authenticated).

```http
POST /api/events/{event_id}/subscribe
Content-Type: application/json
```

**Anonymous Request** (no auth header):
```json
{
  "email": "user@example.com",
  "name": "John Doe"
}
```

**Authenticated Request** (with auth):
```json
{
  "integration_ids": [1, 2],
  "tags": ["urgent", "email"]
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "subscription_id": 123,
    "event_id": 42,
    "user_id": 5,
    "selectors": [
      {"integration_id": 1, "tag": null},
      {"integration_id": null, "tag": "urgent"}
    ]
  },
  "message": "Subscribed successfully. Check your email for confirmation."
}
```

**Implementation**:
```python
@router.post("/{event_id}/subscribe", status_code=201)
async def subscribe_to_event(
    event_id: int,
    request: SubscribeRequest,
    session: AsyncSession = Depends(get_db_session),
    temporal_client: Client = Depends(get_temporal_client),
    current_user: User | None = Depends(get_current_user_optional)
):
    repo_event = EventRepository(session)
    repo_user = UserRepository(session)
    repo_sub = SubscriptionRepository(session)
    
    # Get event
    event = await repo_event.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.is_public and not current_user:
        raise HTTPException(status_code=403, detail="Event is private")
    
    # Handle anonymous vs authenticated
    if not current_user:
        # Anonymous: create or get user by email
        if not request.email:
            raise HTTPException(status_code=400, detail="Email required")
        
        user, created = await repo_user.get_or_create_by_email(
            email=request.email,
            name=request.name or request.email.split('@')[0]
        )
        
        # Create default mailto integration
        if created:
            integration = Integration(
                user_id=user.id,
                name="Email",
                apprise_url=f"mailto://{user.email}",
                tag="email",
                is_active=True
            )
            session.add(integration)
            await session.flush()
    else:
        user = current_user
    
    # Check for existing subscription
    existing = await repo_sub.get_by_event_and_user(event_id, user.id)
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    # Create subscription
    subscription = Subscription(event_id=event_id, user_id=user.id)
    subscription = await repo_sub.create(subscription)
    
    # Create selectors
    if current_user and (request.integration_ids or request.tags):
        # Authenticated: explicit selectors
        for int_id in (request.integration_ids or []):
            selector = SubscriptionSelector(
                subscription_id=subscription.id,
                integration_id=int_id
            )
            session.add(selector)
        
        for tag in (request.tags or []):
            selector = SubscriptionSelector(
                subscription_id=subscription.id,
                tag=tag
            )
            session.add(selector)
    else:
        # Anonymous: default to all integrations via "email" tag
        selector = SubscriptionSelector(
            subscription_id=subscription.id,
            tag="email"
        )
        session.add(selector)
    
    await session.commit()
    
    # Signal workflow
    workflow_handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
    await workflow_handle.signal("participant_added", {
        "subscription_id": subscription.id,
        "user_id": user.id
    })
    
    # Generate unsubscribe token
    token = UnsubscribeToken.generate(subscription.id)
    session.add(token)
    await session.commit()
    
    return {
        "success": True,
        "data": {
            "subscription_id": subscription.id,
            "event_id": event_id,
            "user_id": user.id
        },
        "message": "Subscribed successfully. Check your email for confirmation."
    }
```

---

### Update Subscription Preferences

Modify notification preferences for a subscription.

```http
PATCH /api/events/{event_id}/subscribe
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "mode": "add",
  "integration_ids": [3],
  "tags": ["sms"]
}
```

**Modes**:
- `add` (default): Add new selectors
- `remove`: Remove specified selectors
- `replace`: Replace all selectors with specified ones

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "subscription_id": 123,
    "selectors": [
      {"integration_id": 1, "tag": null},
      {"integration_id": 3, "tag": null},
      {"integration_id": null, "tag": "sms"}
    ]
  }
}
```

---

### Unsubscribe (Token-Based)

One-click unsubscribe via token from email.

```http
POST /api/unsubscribe
Content-Type: application/json
```

**Request Body**:
```json
{
  "token": "abcdef123456..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Successfully unsubscribed from event"
}
```

**Implementation**:
```python
@router.post("/unsubscribe")
async def unsubscribe_via_token(
    request: UnsubscribeRequest,
    session: AsyncSession = Depends(get_db_session),
    temporal_client: Client = Depends(get_temporal_client)
):
    # Get token
    result = await session.execute(
        select(UnsubscribeToken).where(UnsubscribeToken.token == request.token)
    )
    token = result.scalar_one_or_none()
    
    if not token:
        raise HTTPException(status_code=404, detail="Invalid token")
    
    if not token.is_valid():
        raise HTTPException(status_code=400, detail="Token expired or already used")
    
    # Get subscription
    repo = SubscriptionRepository(session)
    subscription = await repo.get_by_id(token.subscription_id)
    
    if not subscription:
        raise HTTPException(status_code=404, detail="Subscription not found")
    
    # Mark token as used
    token.mark_used()
    
    # Delete subscription
    event_id = subscription.event_id
    workflow_id = subscription.event.temporal_workflow_id
    
    await repo.delete(subscription)
    await session.commit()
    
    # Signal workflow
    workflow_handle = temporal_client.get_workflow_handle(workflow_id)
    await workflow_handle.signal("participant_removed", {
        "subscription_id": token.subscription_id
    })
    
    return {
        "success": True,
        "message": "Successfully unsubscribed from event"
    }
```

---

## Integrations API

### List Integrations

Get all integrations for current user.

```http
GET /api/integrations
Authorization: Bearer <token> | Cookie: session_id
```

**Query Parameters**:
- `active_only` (boolean, default: true): Filter to active integrations only

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Gotify",
      "tag": "urgent",
      "is_active": true,
      "created_at": "2025-10-01T12:00:00Z"
    },
    {
      "id": 2,
      "name": "Email",
      "tag": "email",
      "is_active": true,
      "created_at": "2025-10-01T12:00:00Z"
    }
  ]
}
```

**Note**: `apprise_url` is never returned in responses (security)

---

### Create Integration

Add a new notification integration.

```http
POST /api/integrations
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "My Gotify Server",
  "apprise_url": "gotify://hostname/token",
  "tag": "urgent"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": 3,
    "name": "My Gotify Server",
    "tag": "urgent",
    "is_active": true,
    "created_at": "2025-10-03T12:00:00Z"
  }
}
```

**Implementation**:
```python
@router.post("", status_code=201)
async def create_integration(
    request: IntegrationCreateRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session)
):
    # Create integration (encryption happens automatically)
    integration = Integration(
        user_id=current_user.id,
        name=request.name,
        apprise_url=request.apprise_url,  # Property setter encrypts
        tag=request.tag.lower(),
        is_active=True
    )
    
    session.add(integration)
    await session.commit()
    
    return {
        "success": True,
        "data": {
            "id": integration.id,
            "name": integration.name,
            "tag": integration.tag,
            "is_active": integration.is_active,
            "created_at": integration.created_at
        }
    }
```

---

### Update Integration

Update integration name or active status (cannot update URL - delete and recreate instead).

```http
PATCH /api/integrations/{integration_id}
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "is_active": false
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Updated Name",
    "tag": "urgent",
    "is_active": false,
    "created_at": "2025-10-01T12:00:00Z"
  }
}
```

---

### Test Integration

Test an integration by sending a test notification.

```http
POST /api/integrations/{integration_id}/test
Authorization: Bearer <token> | Cookie: session_id
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Test notification sent successfully"
}
```

---

### Delete Integration

Delete an integration (removes from all subscription selectors).

```http
DELETE /api/integrations/{integration_id}
Authorization: Bearer <token> | Cookie: session_id
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Integration deleted"
}
```

---

## Users API

### Get Current User

Get authenticated user's profile.

```http
GET /api/users/me
Authorization: Bearer <token> | Cookie: session_id
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "is_verified": true,
    "created_at": "2025-10-01T12:00:00Z"
  }
}
```

---

### Update Profile

Update user profile information.

```http
PATCH /api/users/me
Authorization: Bearer <token> | Cookie: session_id
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "John Smith",
  "password": "newpassword123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Smith",
    "is_verified": true
  }
}
```

---

## Health & Ops API

### Health Check

Check service health.

```http
GET /api/health
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-10-03T12:00:00Z",
    "version": "1.0.0"
  }
}
```

---

### Temporal Connection Check

Check Temporal server connectivity.

```http
GET /api/temporal/connection
Authorization: Bearer <token> | Cookie: session_id
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "connected": true,
    "server_url": "ghost:7233",
    "namespace": "default"
  }
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Event not found",
    "details": {
      "event_id": 999
    }
  }
}
```

### Common HTTP Status Codes

| Code | Name | Usage |
|------|------|-------|
| 200 | OK | Successful GET/PATCH/DELETE |
| 201 | Created | Successful POST creating resource |
| 400 | Bad Request | Invalid request data |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Auth valid but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource conflict (e.g., already subscribed) |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server error |

---

## Request/Response Schemas

### Pydantic Models

```python
# src/api/schemas.py
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
from typing import Optional

class EventCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: datetime
    end_date: Optional[datetime] = None
    timezone: str = "UTC"
    location: Optional[str] = None
    is_public: bool = True

class EventUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    location: Optional[str] = None

class SubscribeRequest(BaseModel):
    # For anonymous
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    
    # For authenticated
    integration_ids: Optional[list[int]] = None
    tags: Optional[list[str]] = None
    
    @validator('tags')
    def lowercase_tags(cls, v):
        return [t.lower() for t in v] if v else None

class IntegrationCreateRequest(BaseModel):
    name: str
    apprise_url: str
    tag: str
    
    @validator('tag')
    def lowercase_tag(cls, v):
        return v.lower()

class ManualNotificationRequest(BaseModel):
    title: str
    body: str
    notification_level: str = "info"
    subscription_ids: Optional[list[int]] = None
    
    @validator('notification_level')
    def validate_level(cls, v):
        if v not in ['info', 'warning', 'critical']:
            raise ValueError('Must be info, warning, or critical')
        return v
```

---

## Summary

This specification provides:
- ✅ Complete REST API with all CRUD endpoints
- ✅ Dual authentication support (JWT + sessions)
- ✅ Anonymous and authenticated subscription flows
- ✅ Request/response schemas with validation
- ✅ Error handling and status codes
- ✅ Implementation examples for complex endpoints
- ✅ Integration management with encrypted URLs

**Next Steps**: Implement authentication.md to detail auth flows and token management.
