from pydantic import BaseModel, EmailStr
from datetime import datetime


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_verified: bool
    
    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600


class EventCreateRequest(BaseModel):
    name: str
    description: str | None = None
    start_date: datetime
    end_date: datetime | None = None
    timezone: str = "UTC"
    location: str | None = None
    is_public: bool = True


class EventUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = None


class EventResponse(BaseModel):
    id: int
    name: str
    description: str | None
    start_date: datetime
    end_date: datetime | None
    timezone: str
    location: str | None
    is_public: bool
    temporal_workflow_id: str
    organizer_user_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
