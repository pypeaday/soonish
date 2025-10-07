from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet

import logging
import warnings

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///soonish.db"
    
    # Encryption
    encryption_key: str = ""
    
    # Temporal
    temporal_url: str = "ghost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "soonish-task-queue"
    
    # API
    secret_key: str = ""
    debug: bool = True
    
    # SMTP
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_app_user: str = ""
    smtp_app_password: str = ""
    
    model_config = {
        "env_file": ".env"
    }

    log_level: str = "INFO"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Generate keys if missing (dev only)
        if not self.encryption_key:
            if not self.debug:
                raise ValueError("ENCRYPTION_KEY must be set in production")
            # Dev only: warn loudly
            self.encryption_key = Fernet.generate_key().decode()
        warnings.warn("⚠️  USING EPHEMERAL ENCRYPTION KEY - DATA WILL BE LOST ON RESTART")
        if not self.secret_key:
            import secrets
            self.secret_key = secrets.token_urlsafe(32)

    def configure_logging(self):
        logging.basicConfig(level=self.log_level)


_settings = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
