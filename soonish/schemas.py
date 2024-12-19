from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    target_date: datetime
    notify_before: Optional[int] = None
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[datetime] = None
    notify_before: Optional[int] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None

class Event(EventBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
