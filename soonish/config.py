"""
Configuration module for Soonish application.
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings."""
    
    database_url: str = "sqlite+aiosqlite:///./soonish.db"
    environment: str = "development"
    
    # Auth settings
    secret_key: str = "your-secret-key-here"  # Change this in production!
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # GitHub OAuth
    github_client_id: Optional[str] = None
    github_client_secret: Optional[str] = None
    
    # Google OAuth
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    
    # Notification settings
    notification_provider: Optional[str] = None
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = False
