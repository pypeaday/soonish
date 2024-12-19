"""
Database configuration for Soonish application.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import text
from soonish.config import Settings
import os

settings = Settings()

# Create async engine
engine = create_async_engine(settings.database_url, echo=True)

# Create async session factory
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# Create declarative base
Base = declarative_base()

async def get_session() -> AsyncSession:
    """Get a database session."""
    async with async_session() as session:
        yield session

async def init_db():
    """Initialize the database."""
    from soonish.models import Base, User, Event  # Import here to avoid circular imports
    from sqlalchemy import text
    
    async with engine.begin() as conn:
        # Check if tables exist by trying to query the users table
        try:
            result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'"))
            has_tables = bool(await result.scalar())
            
            if not has_tables:
                await conn.run_sync(Base.metadata.create_all)
                print("Database initialized successfully")
            else:
                print("Database tables already exist, skipping initialization")
                
        except Exception as e:
            print(f"Error checking tables, attempting to create them: {e}")
            await conn.run_sync(Base.metadata.create_all)
            print("Database initialized successfully")
