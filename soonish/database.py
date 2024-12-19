"""
Database configuration for Soonish application.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
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
    
    # Drop all tables
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
    except Exception as e:
        print(f"Error dropping tables: {e}")
    
    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("Database initialized successfully")
