"""
Configuration module for Soonish application.
"""

from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings."""

    database_url: str = "sqlite+aiosqlite:///./soonish.db"
    environment: str = "development"

    # Auth settings
    secret_key: str = "your-secret-key-here"  # Change this in production!
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS settings
    cors_origins: List[str] = []  # Empty list means allow all origins
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["*"]
    cors_allow_headers: List[str] = ["*"]

    # Rate limiting settings
    rate_limit_requests: int = 100  # requests per window
    rate_limit_window: int = 3600  # window size in seconds (1 hour)

    # Request size limits
    max_request_size: int = 5 * 1024 * 1024  # 5MB

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
