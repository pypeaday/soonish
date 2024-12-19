"""
Configuration module for Soonish application.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""
    
    database_url: str = "sqlite+aiosqlite:///./soonish.db"
    environment: str = "development"
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        case_sensitive = False
