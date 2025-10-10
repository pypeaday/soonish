# Data Models Specification

**Status**: Authoritative  
**Last Updated**: 2025-10-03  
**Purpose**: Defines the complete data model for Soonish, including database schema, SQLAlchemy ORM models, and data access patterns.

---

## Table of Contents
1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [SQLAlchemy Models](#sqlalchemy-models)
4. [Encryption Implementation](#encryption-implementation)
5. [Repositories](#repositories)
6. [Data Access Patterns](#data-access-patterns)

---

## Overview

### Technology Stack
- **Database**: SQLite (development), PostgreSQL (production)
- **ORM**: SQLAlchemy 2.x with async support
- **Drivers**: `aiosqlite` (SQLite), `asyncpg` (PostgreSQL)
- **Migrations**: Alembic
- **Encryption**: `cryptography.fernet` for field-level encryption

### Design Principles
- All datetimes stored in UTC
- Timezone-aware columns: `DateTime(timezone=True)`
- Async-first: `AsyncEngine` + `AsyncSession`
- Field-level encryption for sensitive data
- Cascading deletes handled explicitly in application code

---

## Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),  -- NULL for unverified/social auth users
    is_verified BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX ix_users_email ON users(email);
```

**Notes**:
- `email` is unique and indexed for fast lookups
- `name` cannot be NULL; for anonymous users, derive from email local-part
- `is_verified=False` for anonymous subscribers until they verify
- `password_hash` is NULL until user sets a password

---

#### events
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATETIME NOT NULL,
    end_date DATETIME,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    location VARCHAR(500),
    is_public BOOLEAN NOT NULL DEFAULT 1,
    temporal_workflow_id VARCHAR(255) NOT NULL UNIQUE,
    organizer_user_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(organizer_user_id) REFERENCES users(id)
);
CREATE INDEX ix_events_organizer ON events(organizer_user_id);
CREATE UNIQUE INDEX ix_events_workflow_id ON events(temporal_workflow_id);
CREATE INDEX ix_events_start_date ON events(start_date);
```

**Notes**:
- `temporal_workflow_id` must be unique for idempotent workflow starts
- `timezone` stores IANA timezone name (e.g., "America/Chicago")
- `organizer_user_id` is the primary owner; additional organizers via `event_memberships`

---

#### integrations
```sql
CREATE TABLE integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    apprise_url_encrypted BLOB NOT NULL,  -- Fernet-encrypted Apprise URL
    tag VARCHAR(255) NOT NULL,             -- Stored lowercased
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX ix_integrations_user_id ON integrations(user_id);
CREATE UNIQUE INDEX ix_integrations_user_name_tag ON integrations(user_id, name, LOWER(tag));
```

**Notes**:
- `apprise_url_encrypted` stores Fernet-encrypted bytes
- `tag` is automatically lowercased on insert/update
- Unique constraint on `(user_id, name, tag)` allows same service with different tags
- Example: User can have "Gotify Production" with both "urgent" and "info" tags

---

#### subscriptions
```sql
CREATE TABLE subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_subscriptions_event_user ON subscriptions(event_id, user_id);
CREATE INDEX ix_subscriptions_event_id ON subscriptions(event_id);
CREATE INDEX ix_subscriptions_user_id ON subscriptions(user_id);
```

**Notes**:
- UNIQUE(event_id, user_id) prevents duplicate subscriptions
- Cascading deletes remove subscriptions when event or user is deleted

---

#### subscription_selectors
```sql
CREATE TABLE subscription_selectors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL,
    integration_id INTEGER,                -- Explicit integration target
    tag VARCHAR(255),                      -- Tag-based selector (stored lowercased)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY(integration_id) REFERENCES integrations(id) ON DELETE CASCADE,
    CHECK (integration_id IS NOT NULL OR tag IS NOT NULL)
);
CREATE INDEX ix_subscription_selectors_subscription ON subscription_selectors(subscription_id);
CREATE UNIQUE INDEX uq_selectors_sub_integration ON subscription_selectors(subscription_id, integration_id) WHERE integration_id IS NOT NULL;
CREATE UNIQUE INDEX uq_selectors_sub_tag ON subscription_selectors(subscription_id, LOWER(tag)) WHERE tag IS NOT NULL;
```

**Notes**:
- At least one of `integration_id` or `tag` must be non-NULL
- Unique constraints prevent duplicate selectors per subscription
- Tags are lowercased for case-insensitive matching

---

#### unsubscribe_tokens
```sql
CREATE TABLE unsubscribe_tokens (
    token VARCHAR(64) PRIMARY KEY,
    subscription_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME,
    expires_at DATETIME NOT NULL,  -- created_at + 60 days
    FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);
CREATE INDEX ix_unsubscribe_tokens_created ON unsubscribe_tokens(created_at);
CREATE INDEX ix_unsubscribe_tokens_expires ON unsubscribe_tokens(expires_at);
```

**Notes**:
- Single-use tokens with 60-day expiration
- Cleanup job removes expired tokens (used_at IS NOT NULL OR expires_at < NOW())

---

### Optional Tables (Phase 2+)

#### event_memberships
```sql
CREATE TABLE event_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(16) NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX uq_event_memberships ON event_memberships(event_id, user_id);
CREATE INDEX ix_event_memberships_event ON event_memberships(event_id);
CREATE INDEX ix_event_memberships_user ON event_memberships(user_id);
```

**Notes**:
- Defer to Phase 2 unless multi-organizer support needed immediately
- Application must enforce at least one 'owner' per event

---

## SQLAlchemy Models

### Base Configuration

```python
# src/db/base.py
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from datetime import datetime

class Base(AsyncAttrs, DeclarativeBase):
    """Base class for all SQLAlchemy models"""
    pass

# Common timestamp mixin
class TimestampMixin:
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

---

### User Model

```python
# src/db/models.py
from sqlalchemy import String, Boolean, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List

class User(Base, TimestampMixin):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    # Relationships
    integrations: Mapped[List["Integration"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan"
    )
    organized_events: Mapped[List["Event"]] = relationship(
        back_populates="organizer",
        foreign_keys="Event.organizer_user_id"
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, verified={self.is_verified})>"
```

---

### Event Model

```python
class Event(Base, TimestampMixin):
    __tablename__ = "events"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    temporal_workflow_id: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    organizer_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )
    
    # Relationships
    organizer: Mapped["User"] = relationship(
        back_populates="organized_events",
        foreign_keys=[organizer_user_id]
    )
    subscriptions: Mapped[List["Subscription"]] = relationship(
        back_populates="event",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Event(id={self.id}, name={self.name}, start={self.start_date})>"
```

---

### Integration Model (with Encryption)

```python
from cryptography.fernet import Fernet
from sqlalchemy import event as sa_event

class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"
    __table_args__ = (
        Index('ix_integrations_user_name_tag', 'user_id', 'name', 'tag', unique=True),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    apprise_url_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    tag: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="integrations")
    subscription_selectors: Mapped[List["SubscriptionSelector"]] = relationship(
        back_populates="integration",
        cascade="all, delete-orphan"
    )
    
    # Property for transparent encryption/decryption
    @property
    def apprise_url(self) -> str:
        """Decrypt and return the Apprise URL"""
        from src.db.encryption import decrypt_field
        return decrypt_field(self.apprise_url_encrypted)
    
    @apprise_url.setter
    def apprise_url(self, value: str):
        """Encrypt and store the Apprise URL"""
        from src.db.encryption import encrypt_field
        self.apprise_url_encrypted = encrypt_field(value)
    
    def __repr__(self):
        return f"<Integration(id={self.id}, name={self.name}, tag={self.tag}, active={self.is_active})>"

# Automatically lowercase tags on insert/update
@sa_event.listens_for(Integration, "before_insert")
@sa_event.listens_for(Integration, "before_update")
def lowercase_tag(mapper, connection, target):
    if target.tag:
        target.tag = target.tag.lower()
```

---

### Subscription Model

```python
class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    
    # Relationships
    event: Mapped["Event"] = relationship(back_populates="subscriptions")
    user: Mapped["User"] = relationship(back_populates="subscriptions")
    selectors: Mapped[List["SubscriptionSelector"]] = relationship(
        back_populates="subscription",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Subscription(id={self.id}, event_id={self.event_id}, user_id={self.user_id})>"
```

---

### SubscriptionSelector Model

```python
class SubscriptionSelector(Base):
    __tablename__ = "subscription_selectors"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), index=True, nullable=False
    )
    integration_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("integrations.id"), nullable=True
    )
    tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    
    # Relationships
    subscription: Mapped["Subscription"] = relationship(back_populates="selectors")
    integration: Mapped[Optional["Integration"]] = relationship(
        back_populates="subscription_selectors"
    )
    
    def __repr__(self):
        target = f"integration_id={self.integration_id}" if self.integration_id else f"tag={self.tag}"
        return f"<SubscriptionSelector(id={self.id}, {target})>"

# Automatically lowercase tags on insert/update
@sa_event.listens_for(SubscriptionSelector, "before_insert")
@sa_event.listens_for(SubscriptionSelector, "before_update")
def lowercase_selector_tag(mapper, connection, target):
    if target.tag:
        target.tag = target.tag.lower()
```

---

### UnsubscribeToken Model

```python
from datetime import timedelta
import secrets

class UnsubscribeToken(Base):
    __tablename__ = "unsubscribe_tokens"
    
    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    subscription_id: Mapped[int] = mapped_column(
        ForeignKey("subscriptions.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    
    @classmethod
    def generate(cls, subscription_id: int) -> "UnsubscribeToken":
        """Generate a new unsubscribe token with 60-day expiration"""
        now = datetime.now(timezone.utc)
        return cls(
            token=secrets.token_urlsafe(48),
            subscription_id=subscription_id,
            created_at=now,
            expires_at=now + timedelta(days=60)
        )
    
    def is_valid(self) -> bool:
        """Check if token is valid (not used and not expired)"""
        now = datetime.now(timezone.utc)
        return self.used_at is None and self.expires_at > now
    
    def mark_used(self):
        """Mark token as used"""
        self.used_at = datetime.now(timezone.utc)
```

---

## Encryption Implementation

### Encryption Module

```python
# src/db/encryption.py
from cryptography.fernet import Fernet
from src.config import get_settings
import base64

_cipher_suite: Fernet | None = None

def get_cipher() -> Fernet:
    """Get or create the Fernet cipher suite"""
    global _cipher_suite
    if _cipher_suite is None:
        settings = get_settings()
        key_bytes = settings.encryption_key.encode()
        _cipher_suite = Fernet(key_bytes)
    return _cipher_suite

def encrypt_field(plaintext: str) -> bytes:
    """Encrypt a string field and return bytes"""
    cipher = get_cipher()
    return cipher.encrypt(plaintext.encode())

def decrypt_field(ciphertext: bytes) -> str:
    """Decrypt a bytes field and return string"""
    cipher = get_cipher()
    return cipher.decrypt(ciphertext).decode()
```

### Configuration

```python
# src/config.py
from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet
import base64

class Settings(BaseSettings):
    # ... other settings ...
    
    encryption_key: str = None  # Must be set in production
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Generate a key for development if not provided
        if not self.encryption_key:
            self.encryption_key = Fernet.generate_key().decode()
    
    model_config = {
        "env_file": ".env"
    }
```

### Key Generation (for production)

```bash
# Generate a new Fernet key for production
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Add to .env:
# ENCRYPTION_KEY=<generated-key>
```

---

## Repositories

Thin repository pattern for data access:

```python
# src/db/repositories.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from src.db.models import User, Event, Integration, Subscription, SubscriptionSelector

class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, user_id: int) -> Optional[User]:
        return await self.session.get(User, user_id)
    
    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()  # Get ID without committing
        return user
    
    async def get_or_create_by_email(self, email: str, name: str) -> tuple[User, bool]:
        """
        Get existing user or create new one.
        Returns (user, created) tuple.
        """
        user = await self.get_by_email(email)
        if user:
            return user, False
        
        # Create new user (unverified)
        user = User(
            email=email,
            name=name,
            is_verified=False
        )
        self.session.add(user)
        await self.session.flush()
        return user, True

class EventRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, event_id: int) -> Optional[Event]:
        return await self.session.get(Event, event_id)
    
    async def get_by_workflow_id(self, workflow_id: str) -> Optional[Event]:
        result = await self.session.execute(
            select(Event).where(Event.temporal_workflow_id == workflow_id)
        )
        return result.scalar_one_or_none()
    
    async def create(self, event: Event) -> Event:
        self.session.add(event)
        await self.session.flush()
        return event
    
    async def update(self, event: Event) -> Event:
        await self.session.flush()
        return event

class IntegrationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, integration_id: int) -> Optional[Integration]:
        return await self.session.get(Integration, integration_id)
    
    async def get_by_user(self, user_id: int, active_only: bool = True) -> List[Integration]:
        query = select(Integration).where(Integration.user_id == user_id)
        if active_only:
            query = query.where(Integration.is_active == True)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def get_by_user_and_tag(
        self, user_id: int, tag: str, active_only: bool = True
    ) -> List[Integration]:
        """Get integrations matching a tag (case-insensitive)"""
        query = select(Integration).where(
            and_(
                Integration.user_id == user_id,
                Integration.tag == tag.lower()
            )
        )
        if active_only:
            query = query.where(Integration.is_active == True)
        result = await self.session.execute(query)
        return list(result.scalars().all())
    
    async def create(self, integration: Integration) -> Integration:
        self.session.add(integration)
        await self.session.flush()
        return integration
    
    async def get_or_create(
        self, 
        user_id: int, 
        name: str, 
        apprise_url: str, 
        tag: str
    ) -> tuple[Integration, bool]:
        """Get existing integration or create new one.
        
        Unique key: (user_id, name, tag)
        
        Returns:
            (integration, created) where created is True if new record
        """
        # Try to find existing by unique key
        query = select(Integration).where(
            and_(
                Integration.user_id == user_id,
                Integration.name == name,
                Integration.tag == tag.lower()
            )
        )
        result = await self.session.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update URL if changed
            if existing.apprise_url != apprise_url:
                existing.apprise_url = apprise_url
                await self.session.flush()
            return existing, False
        
        # Create new
        integration = Integration(
            user_id=user_id,
            name=name,
            apprise_url=apprise_url,
            tag=tag
        )
        self.session.add(integration)
        await self.session.flush()
        return integration, True

class SubscriptionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def get_by_id(self, subscription_id: int) -> Optional[Subscription]:
        return await self.session.get(Subscription, subscription_id)
    
    async def get_by_event(self, event_id: int) -> List[Subscription]:
        """Get all subscriptions for an event with selectors and user loaded"""
        result = await self.session.execute(
            select(Subscription)
            .where(Subscription.event_id == event_id)
            .options(
                selectinload(Subscription.selectors),
                selectinload(Subscription.user).selectinload(User.integrations)
            )
        )
        return list(result.scalars().all())
    
    async def get_by_event_and_user(
        self, event_id: int, user_id: int
    ) -> Optional[Subscription]:
        result = await self.session.execute(
            select(Subscription).where(
                and_(
                    Subscription.event_id == event_id,
                    Subscription.user_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def create(self, subscription: Subscription) -> Subscription:
        self.session.add(subscription)
        await self.session.flush()
        return subscription
    
    async def delete(self, subscription: Subscription):
        await self.session.delete(subscription)
        await self.session.flush()
```

---

## Data Access Patterns

### Session Management

```python
# src/db/session.py
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
    AsyncEngine
)
from src.config import get_settings
from contextlib import asynccontextmanager

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None

def get_engine() -> AsyncEngine:
    """Get or create the async engine"""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.debug,
            pool_pre_ping=True,
        )
    return _engine

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Get or create the session factory"""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory

@asynccontextmanager
async def get_session():
    """Context manager for database sessions"""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

async def get_db_session() -> AsyncSession:
    """Dependency for FastAPI route injection"""
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

### Usage in FastAPI Routes

```python
# Example FastAPI route
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import get_db_session
from src.db.repositories import EventRepository

@router.get("/api/events/{event_id}")
async def get_event(
    event_id: int,
    session: AsyncSession = Depends(get_db_session)
):
    repo = EventRepository(session)
    event = await repo.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404)
    return event
```

### Usage in Temporal Activities

```python
# Example activity
from temporalio import activity
from src.db.session import get_session
from src.db.repositories import SubscriptionRepository

@activity.defn
async def send_notification(event_id: int, title: str, body: str):
    async with get_session() as session:
        repo = SubscriptionRepository(session)
        subscriptions = await repo.get_by_event(event_id)
        
        # Process notifications...
        
        return {"delivered": len(subscriptions), "failed": 0}
```

---

## Migration Strategy

### Alembic Setup

```bash
# Initialize Alembic
alembic init alembic

# Generate initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migrations
alembic upgrade head
```

### Migration Configuration

```python
# alembic/env.py
from src.db.base import Base
from src.db.models import *  # Import all models
from src.config import get_settings

# Set target metadata
target_metadata = Base.metadata

# Use async engine for migrations
def run_migrations_online():
    settings = get_settings()
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = settings.database_url
    # ... rest of standard Alembic config
```

---

## Testing Considerations

### Test Fixtures

```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from src.db.base import Base

@pytest.fixture
async def test_db():
    """Create a test database"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    
    yield session_factory
    
    await engine.dispose()
```

---

## Summary

This specification provides:
- ✅ Complete database schema with indexes and constraints
- ✅ SQLAlchemy ORM models with async support
- ✅ Transparent field-level encryption for sensitive data
- ✅ Thin repository pattern for clean data access
- ✅ Session management for FastAPI and Temporal activities
- ✅ Migration strategy with Alembic
- ✅ Testing fixtures for isolated tests

**Next Steps**: Implement temporal-specification.md to define workflow orchestration.
