"""Integration configuration models for Phase 15

Each integration type has a Pydantic model that defines what users need to provide.
The backend converts these configs to Apprise URLs.
"""

from pydantic import BaseModel, HttpUrl, EmailStr, field_validator
from typing import Literal


class GotifyConfig(BaseModel):
    """Gotify self-hosted notification server configuration
    
    Backend converts to: gotify[s]://{hostname}/{token}?priority={priority}
    """
    server_url: HttpUrl
    token: str
    priority: Literal["low", "normal", "high"] = "normal"
    
    @field_validator('token')
    @classmethod
    def validate_token(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Token cannot be empty")
        return v.strip()
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "server_url": "https://gotify.example.com",
                "token": "AbCdEf123456",
                "priority": "normal"
            }
        }
    }


class EmailConfig(BaseModel):
    """Email (SMTP) notification configuration
    
    Backend converts to: mailto://{user}:{password}@{host}:{port}?from={from_email}&to={to_email}
    """
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str
    smtp_password: str
    from_email: EmailStr
    to_email: EmailStr
    use_tls: bool = True
    
    @field_validator('smtp_port')
    @classmethod
    def validate_port(cls, v: int) -> int:
        if not 1 <= v <= 65535:
            raise ValueError("Port must be between 1 and 65535")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "smtp_host": "smtp.gmail.com",
                "smtp_port": 587,
                "smtp_user": "notifications@example.com",
                "smtp_password": "app-password",
                "from_email": "notifications@example.com",
                "to_email": "user@example.com",
                "use_tls": True
            }
        }
    }


class NtfyConfig(BaseModel):
    """Ntfy self-hosted/cloud notification configuration
    
    Backend converts to: ntfy://{hostname}/{topic}
    """
    server_url: HttpUrl = "https://ntfy.sh"
    topic: str
    priority: Literal["min", "low", "default", "high", "max"] = "default"
    
    @field_validator('topic')
    @classmethod
    def validate_topic(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Topic cannot be empty")
        # Ntfy topics should be alphanumeric with underscores/hyphens
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError("Topic must be alphanumeric (underscores and hyphens allowed)")
        return v.strip()
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "server_url": "https://ntfy.sh",
                "topic": "my-notifications",
                "priority": "default"
            }
        }
    }


class DiscordConfig(BaseModel):
    """Discord webhook notification configuration
    
    Backend converts to: discord://{webhook_id}/{webhook_token}
    """
    webhook_url: HttpUrl
    
    @field_validator('webhook_url')
    @classmethod
    def validate_webhook(cls, v: HttpUrl) -> HttpUrl:
        url_str = str(v)
        # Accept both discord.com and discordapp.com
        if '/api/webhooks/' not in url_str or not any(domain in url_str for domain in ['discord.com', 'discordapp.com']):
            raise ValueError("Must be a valid Discord webhook URL")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "webhook_url": "https://discord.com/api/webhooks/123456789/abcdefg"
            }
        }
    }


class SlackConfig(BaseModel):
    """Slack webhook notification configuration
    
    Backend converts to: slack://{webhook_token}
    """
    webhook_url: HttpUrl
    
    @field_validator('webhook_url')
    @classmethod
    def validate_webhook(cls, v: HttpUrl) -> HttpUrl:
        url_str = str(v)
        if 'hooks.slack.com/services/' not in url_str:
            raise ValueError("Must be a valid Slack webhook URL")
        return v
    
    model_config = {
        "json_schema_extra": {
            "example": {
                "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX"
            }
        }
    }
