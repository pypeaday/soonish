"""
Database initialization script for development.
Blows away existing DB and creates fresh schema with sample data.
"""
import asyncio
from pathlib import Path
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from src.config import get_settings

settings = get_settings()

# Add src to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.db.base import Base
from src.db.models import User, Event, Integration, Subscription, SubscriptionSelector, SubscriptionReminder

# Database path
DB_PATH = Path(__file__).parent.parent / "soonish.db"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH}"

# Encryption key (auto-generate for dev)
ENCRYPTION_KEY = settings.encryption_key


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
    
    # Import password hashing
    from src.api.auth.password import hash_password
    
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        # Create test users
        print("  👤 Creating users")
        organizer = User(
            email="organizer@example.com",
            name="Event Organizer",
            password_hash=hash_password("password123"),  # Real bcrypt hash
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
        
        print("\n✅ Sample data created:")
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
    print("\n🔑 Encryption key (add to .env):")
    print(f"   ENCRYPTION_KEY={ENCRYPTION_KEY}")
    
    print("\n" + "=" * 60)
    print("✅ Database ready! Location: soonish.db")
    print("=" * 60)
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
