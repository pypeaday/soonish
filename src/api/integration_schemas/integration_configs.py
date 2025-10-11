"""Integration configuration models for Phase 15

Each integration type has a Pydantic model that defines what users need to provide.
The backend converts these configs to Apprise URLs.
"""

from pydantic import BaseModel, HttpUrl, field_validator
from typing import Literal


class GotifyConfig(BaseModel):
    """Gotify self-hosted notification server configuration
    
    User provides:
    - server_url: Full URL to Gotify server (e.g., https://gotify.example.com)
    - token: Application token from Gotify
    - priority: Optional message priority
    
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


# TODO: Add more integration configs as we expand beyond Gotify
# - EmailConfig (SMTP details)
# - NtfyConfig (server, topic, auth)
# - DiscordConfig (webhook URL)
# - SlackConfig (webhook URL, channel)
# - TelegramConfig (bot token, chat ID)
