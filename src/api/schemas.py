from pydantic import BaseModel, EmailStr, field_validator, model_validator
from datetime import datetime, timezone, timedelta


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    version: str
    temporal: str


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

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v):
        if v < datetime.now(timezone.utc) - timedelta(hours=1):
            raise ValueError("Start date cannot be more than 1 hour in the past")
        return v

    @model_validator(mode="after")
    def validate_end_date(self):
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("End date must be after start_date")
        return self


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


class SubscribeRequest(BaseModel):
    # For anonymous
    email: EmailStr | None = None
    name: str | None = None
    
    # For authenticated
    integration_ids: list[int] | None = None
    tags: list[str] | None = None
    
    # Reminder preferences (Phase 11)
    reminder_offsets: list[int] | None = None  # Seconds before event, e.g., [86400, 3600] = 1d, 1h


class SubscriptionResponse(BaseModel):
    subscription_id: int
    event_id: int
    user_id: int
    selectors: list[dict]


class IntegrationCreateRequest(BaseModel):
    name: str
    apprise_url: str
    tag: str


class IntegrationResponse(BaseModel):
    id: int
    name: str
    tag: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
