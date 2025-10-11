# Phase 14: Private Events - Implementation Spec

**Status**: 📝 Ready for Review  
**Estimated Lines**: ~150-200

---

## Overview

Add event visibility controls and invitation system for private events.

## Current State

- All events have `is_public` field (boolean)
- No enforcement of privacy rules
- Anyone can view/subscribe to any event

## Requirements

### 1. Privacy Enforcement

**Public Events** (`is_public=True`):
- ✅ Anyone can view
- ✅ Anyone can subscribe
- ✅ Listed in public event listings

**Private Events** (`is_public=False`):
- ❌ Only organizer and subscribers can view
- ❌ Only invited users can subscribe
- ❌ Not listed in public event listings

### 2. Invitation System

**Invitations**:
- Organizer can invite users by email
- Invited users get email with subscribe link
- Invitation tokens expire after 7 days
- Can revoke invitations

---

## Database Changes

### New Table: `event_invitations`

```sql
CREATE TABLE event_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    invited_by_user_id INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(event_id, email)
);

CREATE INDEX idx_event_invitations_token ON event_invitations(token);
CREATE INDEX idx_event_invitations_event ON event_invitations(event_id);
```

---

## API Changes

### 1. Update Event Endpoints

#### GET /api/events (List Events)
**Change**: Only return public events OR events user is subscribed to

```python
@router.get("", response_model=list[EventResponse])
async def list_events(
    skip: int = 0,
    limit: int = 100,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """List events (public + user's private events)"""
    repo = EventRepository(db)
    
    if current_user:
        # Get public events + user's private events
        events = await repo.list_visible_for_user(
            user_id=current_user.id,
            skip=skip,
            limit=limit
        )
    else:
        # Get only public events
        events = await repo.list_public_events(skip=skip, limit=limit)
    
    return events
```

#### GET /api/events/{event_id}
**Change**: Check authorization for private events

```python
@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Get event by ID"""
    repo = EventRepository(db)
    event = await repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization for private events
    if not event.is_public:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Check if user is organizer or subscriber
        is_authorized = await repo.can_view_event(
            event_id=event_id,
            user_id=current_user.id
        )
        
        if not is_authorized:
            raise HTTPException(status_code=403, detail="Not authorized to view this event")
    
    return event
```

### 2. New Invitation Endpoints

#### POST /api/events/{event_id}/invite
**Create invitation**

```python
@router.post("/{event_id}/invite")
async def invite_to_event(
    event_id: int,
    email: EmailStr,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Invite user to private event"""
    # Get event
    event_repo = EventRepository(db)
    event = await event_repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check if user is organizer
    if event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only organizer can invite")
    
    # Create invitation
    invitation_repo = EventInvitationRepository(db)
    invitation = await invitation_repo.create_invitation(
        event_id=event_id,
        email=email,
        invited_by_user_id=current_user.id
    )
    
    await db.commit()
    
    # Send invitation email
    from src.api.services.email import send_invitation_email
    await send_invitation_email(
        email=email,
        event_name=event.name,
        organizer_name=current_user.name,
        token=invitation.token
    )
    
    return {
        "success": True,
        "message": f"Invitation sent to {email}",
        "invitation_id": invitation.id
    }
```

#### GET /api/events/{event_id}/invitations
**List invitations for event**

```python
@router.get("/{event_id}/invitations")
async def list_invitations(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List invitations for event (organizer only)"""
    # Check authorization
    event_repo = EventRepository(db)
    event = await event_repo.get_by_id(event_id)
    
    if not event or event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get invitations
    invitation_repo = EventInvitationRepository(db)
    invitations = await invitation_repo.get_by_event(event_id)
    
    return {
        "success": True,
        "data": invitations
    }
```

#### DELETE /api/events/{event_id}/invitations/{invitation_id}
**Revoke invitation**

```python
@router.delete("/{event_id}/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    event_id: int,
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Revoke invitation (organizer only)"""
    # Check authorization
    event_repo = EventRepository(db)
    event = await event_repo.get_by_id(event_id)
    
    if not event or event.organizer_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete invitation
    invitation_repo = EventInvitationRepository(db)
    invitation = await invitation_repo.get_by_id(invitation_id)
    
    if not invitation or invitation.event_id != event_id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    await db.delete(invitation)
    await db.commit()
```

### 3. Update Subscribe Endpoint

#### POST /api/events/{event_id}/subscribe
**Change**: Check invitation for private events

```python
@router.post("/{event_id}/subscribe")
async def subscribe_to_event(
    event_id: int,
    request: SubscribeRequest,
    invitation_token: str | None = None,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """Subscribe to event"""
    event_repo = EventRepository(db)
    event = await event_repo.get_by_id(event_id)
    
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check authorization for private events
    if not event.is_public:
        if not current_user and not invitation_token:
            raise HTTPException(
                status_code=401,
                detail="Private event requires authentication or invitation"
            )
        
        # If using invitation token
        if invitation_token:
            invitation_repo = EventInvitationRepository(db)
            invitation = await invitation_repo.validate_token(invitation_token)
            
            if not invitation or invitation.event_id != event_id:
                raise HTTPException(status_code=403, detail="Invalid invitation")
            
            # Mark invitation as used
            invitation.used_at = datetime.now(timezone.utc)
        
        # If authenticated, check if already subscribed or is organizer
        elif current_user:
            is_authorized = await event_repo.can_subscribe_to_event(
                event_id=event_id,
                user_id=current_user.id
            )
            
            if not is_authorized:
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized. Request an invitation from the organizer."
                )
    
    # Continue with normal subscription logic...
```

---

## Models

### EventInvitation Model

```python
# src/db/models.py
class EventInvitation(Base):
    __tablename__ = "event_invitations"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String)
    token: Mapped[str] = mapped_column(String, unique=True, index=True)
    invited_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    event: Mapped["Event"] = relationship(back_populates="invitations")
    invited_by: Mapped["User"] = relationship()
    
    def is_valid(self) -> bool:
        """Check if invitation is still valid"""
        if self.used_at:
            return False
        if datetime.now(timezone.utc) > self.expires_at:
            return False
        return True
```

---

## Repository Methods

### EventRepository

```python
async def can_view_event(self, event_id: int, user_id: int) -> bool:
    """Check if user can view event"""
    # Check if user is organizer
    result = await self.session.execute(
        select(Event).where(
            Event.id == event_id,
            Event.organizer_user_id == user_id
        )
    )
    if result.scalar_one_or_none():
        return True
    
    # Check if user is subscriber
    result = await self.session.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == user_id
        )
    )
    return result.scalar_one_or_none() is not None

async def list_visible_for_user(
    self, user_id: int, skip: int = 0, limit: int = 100
) -> list[Event]:
    """List events visible to user (public + subscribed private)"""
    # Get public events
    public_query = select(Event).where(Event.is_public == True)
    
    # Get private events user is subscribed to
    private_query = (
        select(Event)
        .join(EventParticipant)
        .where(
            Event.is_public == False,
            EventParticipant.user_id == user_id
        )
    )
    
    # Union and paginate
    query = public_query.union(private_query).offset(skip).limit(limit)
    result = await self.session.execute(query)
    return list(result.scalars().all())
```

### EventInvitationRepository

```python
class EventInvitationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_invitation(
        self, event_id: int, email: str, invited_by_user_id: int
    ) -> EventInvitation:
        """Create invitation with token"""
        import secrets
        
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        invitation = EventInvitation(
            event_id=event_id,
            email=email,
            token=token,
            invited_by_user_id=invited_by_user_id,
            expires_at=expires_at
        )
        
        self.session.add(invitation)
        return invitation
    
    async def validate_token(self, token: str) -> EventInvitation | None:
        """Validate invitation token"""
        result = await self.session.execute(
            select(EventInvitation).where(EventInvitation.token == token)
        )
        invitation = result.scalar_one_or_none()
        
        if invitation and invitation.is_valid():
            return invitation
        return None
    
    async def get_by_event(self, event_id: int) -> list[EventInvitation]:
        """Get all invitations for event"""
        result = await self.session.execute(
            select(EventInvitation)
            .where(EventInvitation.event_id == event_id)
            .order_by(EventInvitation.created_at.desc())
        )
        return list(result.scalars().all())
```

---

## Email Template

### Invitation Email

```python
# src/api/services/email.py
async def send_invitation_email(
    email: str,
    event_name: str,
    organizer_name: str,
    token: str,
    base_url: str = "http://localhost:8000"
) -> bool:
    """Send event invitation email"""
    settings = get_settings()
    
    # Build invitation URL
    encoded_token = quote(token, safe='')
    invitation_url = f"{base_url}/events/invite?token={encoded_token}"
    
    body = f"""
Hello!

{organizer_name} has invited you to a private event:

Event: {event_name}

Click the link below to view details and subscribe:

{invitation_url}

This invitation will expire in 7 days.

---
Soonish Event Notifications
"""
    
    # Send via Apprise...
```

---

## Testing Plan

1. **Create private event** - Verify `is_public=False`
2. **List events** - Verify private events not in public list
3. **Get private event** - Verify 403 for unauthorized users
4. **Invite user** - Verify email sent with token
5. **Subscribe with invitation** - Verify token validation
6. **Subscribe without invitation** - Verify 403
7. **Revoke invitation** - Verify token becomes invalid
8. **Expired invitation** - Verify rejection

---

## Files to Create/Modify

**Create**:
- `src/db/migrations/add_event_invitations.sql` (if using migrations)

**Modify**:
- `src/db/models.py` - Add EventInvitation model
- `src/db/repositories.py` - Add EventInvitationRepository, update EventRepository
- `src/api/routes/events.py` - Add invitation endpoints, update authorization
- `src/api/schemas.py` - Add invitation schemas
- `src/api/services/email.py` - Add send_invitation_email
- `scripts/init_db.py` - Add event_invitations table

---

## Acceptance Criteria

- ✅ Private events not visible in public listings
- ✅ Unauthorized users get 403 on private event access
- ✅ Organizer can invite users by email
- ✅ Invitation emails sent with valid tokens
- ✅ Users can subscribe with valid invitation token
- ✅ Expired/used invitations rejected
- ✅ Organizer can view and revoke invitations
- ✅ All ruff checks pass
- ✅ Test script validates all flows

---

**Estimated Implementation Time**: 2-3 hours  
**Code Complexity**: Medium (authorization logic)  
**Dependencies**: Email service (Phase 13) ✅
