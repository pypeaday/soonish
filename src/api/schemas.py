from pydantic import BaseModel
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
