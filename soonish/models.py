"""
Database models for Soonish application.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
    event,
)
from sqlalchemy.orm import relationship
from soonish.database import Base


class Category(Base):
    """Category model for organizing events."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    color = Column(String, default="#3B82F6")  # Default to primary blue
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="categories")
    events = relationship("Event", back_populates="category")


class User(Base):
    """User model."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    oauth_provider = Column(String)  # 'github' or 'google'
    oauth_id = Column(String, unique=True)

    # Relationships
    events = relationship("Event", back_populates="user", cascade="all, delete-orphan")
    categories = relationship(
        "Category", back_populates="user", cascade="all, delete-orphan"
    )


class Event(Base):
    """Event model."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    description = Column(Text, nullable=True)
    target_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notify_before = Column(Integer, nullable=True)  # Minutes before event to notify
    is_recurring = Column(Boolean, default=False)
    recurrence_pattern = Column(String, nullable=True)  # daily, weekly, monthly, yearly
    user_id = Column(Integer, ForeignKey("users.id"))
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)

    # Relationships
    user = relationship("User", back_populates="events")
    category = relationship("Category", back_populates="events")


# SQLAlchemy event listeners to ensure updated_at is set
@event.listens_for(Event, "before_update")
def set_updated_at(mapper, connection, target):
    target.updated_at = datetime.utcnow()
