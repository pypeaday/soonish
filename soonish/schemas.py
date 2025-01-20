from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class SortOrder(str, Enum):
    """Sort order enumeration."""

    asc = "asc"
    desc = "desc"


class EventSort(str, Enum):
    """Event sort field enumeration."""

    target_date = "target_date"
    created_at = "created_at"
    title = "title"


class CategoryBase(BaseModel):
    name: str
    color: str = "#3B82F6"  # Default to primary blue


class CategoryCreate(CategoryBase):
    pass


class Category(CategoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: datetime
    notify_before: Optional[int] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    category_id: Optional[int] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    notify_before: Optional[int] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None
    category_id: Optional[int] = None


class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime
    category: Optional[Category] = None

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "title": "Team Meeting",
                "description": "Weekly team sync",
                "target_date": "2024-01-20T15:00:00",
                "notify_before": 15,
                "is_recurring": True,
                "recurrence_pattern": "weekly",
                "category_id": 1,
                "created_at": "2024-01-20T10:00:00",
                "updated_at": "2024-01-20T10:00:00",
                "category": {
                    "id": 1,
                    "name": "Work",
                    "color": "#3B82F6",
                    "created_at": "2024-01-20T10:00:00",
                },
            }
        }


class BulkEventCreate(BaseModel):
    """Schema for bulk event creation."""

    events: List[EventCreate]


class BulkEventDelete(BaseModel):
    """Schema for bulk event deletion."""

    event_ids: List[int] = Field(..., description="List of event IDs to delete")


class PaginatedEvents(BaseModel):
    """Schema for paginated event results."""

    items: List[Event]
    total: int
    page: int
    size: int
    pages: int

    class Config:
        from_attributes = True
