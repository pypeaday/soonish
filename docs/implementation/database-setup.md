# Database Setup

**Status**: Authoritative  
**Last Updated**: 2025-10-04  
**Purpose**: Quick database initialization for development (no migrations, blow away and rebuild).

---

## Development Philosophy

**During development**: Blow away the database and recreate it from scratch using a script. This keeps things simple and reproducible.

**For production**: We'll add Alembic migrations later. For now, iterate fast.

---

## Quick Start

### 1. Install Dependencies

```bash
# From project root
uv pip install sqlalchemy aiosqlite cryptography
```

### 2. Create Database Initialization Script

Save as `scripts/init_db.py`:

```python
#!/usr/bin/env python3
"""
Database initialization script for development.
Blows away existing DB and creates fresh schema with sample data.
"""
import asyncio
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from cryptography.fernet import Fernet

# Add src to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.base import Base
from src.db.models import User, Event, Integration, Subscription, SubscriptionSelector

# Database path
DB_PATH = Path(__file__).parent.parent / "soonish.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

# Encryption key (auto-generate for dev)
ENCRYPTION_KEY = Fernet.generate_key().decode()


async def drop_and_create_db():
    """Drop existing database and create fresh schema"""
    print(f"🗑️  Dropping existing database at {DB_PATH}")
    if DB_PATH.exists():
        DB_PATH.unlink()
    
    print("🔨 Creating new database schema")
    engine = create_async_engine(DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database schema created")
    return engine


async def seed_sample_data(engine):
    """Add sample data for testing"""
    print("\n🌱 Seeding sample data")
    
    # Import here to ensure encryption is set up
    os.environ['ENCRYPTION_KEY'] = ENCRYPTION_KEY
    from src.db.encryption import encrypt_field
    
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Create test users
        print("  👤 Creating users")
        organizer = User(
            email="organizer@example.com",
            name="Event Organizer",
            password_hash="$2b$12$dummy_hash_for_dev",  # Password: "password123"
            is_verified=True
        )
        session.add(organizer)
        
        subscriber = User(
            email="subscriber@example.com",
            name="Test Subscriber",
            is_verified=False  # Anonymous/unverified user
        )
        session.add(subscriber)
        
        await session.flush()  # Get IDs
        
        # Create test integrations
        print("  🔔 Creating integrations")
        
        # Gotify integration for organizer
        gotify_integration = Integration(
            user_id=organizer.id,
            name="Gotify Server",
            tag="urgent"
        )
        gotify_integration.apprise_url = "gotify://hostname/token"  # Uses encryption
        session.add(gotify_integration)
        
        # Email integration for subscriber (default)
        email_integration = Integration(
            user_id=subscriber.id,
            name="Email",
            tag="email"
        )
        email_integration.apprise_url = f"mailto://{subscriber.email}"
        session.add(email_integration)
        
        await session.flush()
        
        # Create test event
        print("  📅 Creating event")
        now = datetime.now(timezone.utc)
        event = Event(
            name="Team Standup",
            description="Weekly team sync meeting",
            start_date=now + timedelta(hours=2),
            end_date=now + timedelta(hours=3),
            timezone="UTC",
            location="Conference Room A",
            is_public=True,
            temporal_workflow_id="event-1-test-workflow-id",
            organizer_user_id=organizer.id
        )
        session.add(event)
        await session.flush()
        
        # Create subscription
        print("  ✉️  Creating subscription")
        subscription = Subscription(
            event_id=event.id,
            user_id=subscriber.id
        )
        session.add(subscription)
        await session.flush()
        
        # Create subscription selectors
        selector = SubscriptionSelector(
            subscription_id=subscription.id,
            tag="email"  # Route to email integration
        )
        session.add(selector)
        
        await session.commit()
        
        print(f"\n✅ Sample data created:")
        print(f"   - Users: {organizer.email}, {subscriber.email}")
        print(f"   - Event ID: {event.id} ({event.name})")
        print(f"   - Subscription ID: {subscription.id}")
        print(f"   - Integrations: {gotify_integration.name}, {email_integration.name}")


async def inspect_db(engine):
    """Show what's in the database"""
    print("\n🔍 Database contents:")
    
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        from sqlalchemy import select, func
        
        # Count tables
        for model in [User, Event, Integration, Subscription, SubscriptionSelector]:
            result = await session.execute(select(func.count()).select_from(model))
            count = result.scalar()
            print(f"   - {model.__tablename__}: {count} rows")


async def main():
    print("=" * 60)
    print("Soonish Database Initialization")
    print("=" * 60)
    
    # Drop and create
    engine = await drop_and_create_db()
    
    # Seed data
    await seed_sample_data(engine)
    
    # Inspect
    await inspect_db(engine)
    
    # Show encryption key
    print(f"\n🔑 Encryption key (add to .env):")
    print(f"   ENCRYPTION_KEY={ENCRYPTION_KEY}")
    
    print("\n" + "=" * 60)
    print("✅ Database ready! Location: soonish.db")
    print("=" * 60)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
```

### 3. Run the Script

```bash
# Make it executable
chmod +x scripts/init_db.py

# Run it
uv run scripts/init_db.py
```

**Expected output**:
```
============================================================
Soonish Database Initialization
============================================================
🗑️  Dropping existing database at /home/user/soonish/soonish.db
🔨 Creating new database schema
✅ Database schema created

🌱 Seeding sample data
  👤 Creating users
  🔔 Creating integrations
  📅 Creating event
  ✉️  Creating subscription

✅ Sample data created:
   - Users: organizer@example.com, subscriber@example.com
   - Event ID: 1 (Team Standup)
   - Subscription ID: 1
   - Integrations: Gotify Server, Email

🔍 Database contents:
   - users: 2 rows
   - events: 1 rows
   - integrations: 2 rows
   - subscriptions: 1 rows
   - subscription_selectors: 1 rows

🔑 Encryption key (add to .env):
   ENCRYPTION_KEY=abc123...

============================================================
✅ Database ready! Location: soonish.db
============================================================
```

---

## Inspecting the Database

### Using SQLite CLI

```bash
# Open database
sqlite3 soonish.db

# List tables
.tables

# Show users
SELECT * FROM users;

# Show events
SELECT * FROM events;

# Show integrations (apprise_url will be encrypted blob)
SELECT id, user_id, name, tag, is_active FROM integrations;

# Exit
.quit
```

### Using Python REPL

```python
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
from src.db.models import User, Event, Integration

async def inspect():
    engine = create_async_engine("sqlite+aiosqlite:///soonish.db")
    async_session = async_sessionmaker(engine)
    
    async with async_session() as session:
        # Get all users
        result = await session.execute(select(User))
        users = result.scalars().all()
        for user in users:
            print(f"User: {user.email} (verified={user.is_verified})")
        
        # Get all events
        result = await session.execute(select(Event))
        events = result.scalars().all()
        for event in events:
            print(f"Event: {event.name} at {event.start_date}")
    
    await engine.dispose()

asyncio.run(inspect())
```

---

## Development Workflow

### Every Time You Change Models

When you modify `src/db/models.py`:

```bash
# 1. Update the model
vim src/db/models.py

# 2. Blow away and recreate database
uv run scripts/init_db.py

# 3. Test your changes
uv run scripts/test_something.py
```

**No migration files to manage during development!**

---

## Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL=sqlite+aiosqlite:///soonish.db

# Encryption (copy from init_db.py output)
ENCRYPTION_KEY=your-key-here

# Temporal
TEMPORAL_URL=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soonish-task-queue

# API
SECRET_KEY=your-secret-key-for-jwt
DEBUG=true
```

Generate keys:

```bash
# Encryption key (Fernet)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Secret key (JWT)
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Testing Database Operations

### Quick Test Script

Save as `scripts/test_db.py`:

```python
#!/usr/bin/env python3
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import select
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.models import User, Event
from src.db.repositories import UserRepository, EventRepository

async def test():
    engine = create_async_engine("sqlite+aiosqlite:///soonish.db", echo=True)
    async_session = async_sessionmaker(engine)
    
    async with async_session() as session:
        # Test UserRepository
        user_repo = UserRepository(session)
        user = await user_repo.get_by_email("organizer@example.com")
        print(f"✅ Found user: {user.name}")
        
        # Test EventRepository
        event_repo = EventRepository(session)
        events = await event_repo.get_by_organizer(user.id)
        print(f"✅ User has {len(events)} events")
    
    await engine.dispose()

asyncio.run(test())
```

```bash
uv run scripts/test_db.py
```

---

## Migration to Production (Later)

When you're ready for production with proper migrations:

### 1. Install Alembic

```bash
uv pip install alembic
```

### 2. Initialize Alembic

```bash
alembic init alembic
```

### 3. Configure Alembic

Edit `alembic/env.py`:

```python
from src.db.base import Base
from src.db.models import *  # Import all models
target_metadata = Base.metadata
```

### 4. Generate Initial Migration

```bash
alembic revision --autogenerate -m "Initial schema"
```

### 5. Apply Migration

```bash
alembic upgrade head
```

**But for now**: Just use `scripts/init_db.py` and iterate fast!

---

## Troubleshooting

### Database Locked Error

**Problem**: `database is locked`

**Solution**: Close any open SQLite connections or restart Python REPL.

### Encryption Key Changed

**Problem**: Can't decrypt existing data after regenerating key

**Solution**: Blow away DB and recreate with new key:

```bash
uv run scripts/init_db.py
# Copy new ENCRYPTION_KEY to .env
```

### Foreign Key Constraint Error

**Problem**: Can't delete due to foreign key constraint

**Solution**: SQLite doesn't enforce foreign keys by default. To enable:

```python
# In src/db/session.py
from sqlalchemy import event

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()
```

---

## Summary

**Development workflow**:
1. Run `uv run scripts/init_db.py` to get fresh database
2. Build your features
3. Change models? Re-run init script
4. Test with sample data already there

**No migration headaches during rapid development!**

**When ready for production**: Add Alembic migrations for controlled schema changes.
