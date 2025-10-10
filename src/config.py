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
    
    # JWT
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    
    # SMTP (Service-level - Notifiq sends FROM these addresses)
    # Used for: verification emails, system notifications, fallback email notifications
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_app_user: str = ""
    smtp_app_password: str = ""
    
    # SMTP (Gmail for unverified users)
    gmail_user: str = ""
    gmail_app_password: str = ""
    smtp_server_gmail: str = "smtp.gmail.com"
    
    # SMTP (ProtonMail for verified users)
    proton_user: str = ""
    proton_app_password: str = ""
    smtp_server_proton: str = "smtp.protonmail.ch"
    
    # Note: User-level integrations (Gotify, SMS, etc.) are stored in the database
    # Users provide their own Gotify URLs/tokens, phone numbers, etc. via Integrations API
    
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
            warnings.warn("⚠️  USING EPHEMERAL ENCRYPTION KEY - DATA WILL BE LOST ON RESTART")
            self.encryption_key = Fernet.generate_key().decode()
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
