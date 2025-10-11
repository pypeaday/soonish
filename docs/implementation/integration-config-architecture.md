# Integration Configuration Architecture

**Status**: 📝 Specification  
**Date**: 2025-10-10

---

## Guiding Principles

1. **User Abstraction**: Users provide only what's necessary (tokens, URLs, credentials) - never Apprise URLs
2. **Backend Responsibility**: API layer converts user inputs → Apprise URLs → encrypted storage
3. **Future-Proof**: If we move away from Apprise, users don't need to change anything
4. **Extensibility**: Adding new integrations follows a clear, repeatable pattern
5. **Security**: All sensitive data (tokens, passwords) encrypted at rest

---

## Architecture Overview

```
User Input (Gotify token, server URL)
    ↓
API Endpoint (/api/integrations)
    ↓
Integration Converter Service
    ↓
Apprise URL Generation
    ↓
Encryption Service
    ↓
Database (encrypted apprise_url + encrypted config_json)
    ↓
Notification Activity (decrypts → uses Apprise)
```

**Key Insight**: The database stores BOTH:
- `apprise_url` (encrypted) - For current Apprise usage
- `config_json` (encrypted) - Original user inputs for future flexibility

---

## Database Schema Changes

### Updated `integrations` Table

```sql
-- Add new columns (keep apprise_url_encrypted for backward compatibility)
ALTER TABLE integrations ADD COLUMN integration_type TEXT DEFAULT 'custom';
ALTER TABLE integrations ADD COLUMN config_json_encrypted BLOB;

-- Index for filtering by type
CREATE INDEX idx_integrations_type ON integrations(integration_type);

-- Migration: Set existing integrations to 'custom' type
UPDATE integrations SET integration_type = 'custom' WHERE integration_type IS NULL;
```

**Schema**:
```python
class Integration(Base, TimestampMixin):
    __tablename__ = "integrations"
    
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    
    # Integration type: 'gotify', 'email', 'ntfy', 'discord', 'slack', 'telegram', 'custom'
    integration_type: Mapped[str] = mapped_column(String(50), default='custom')
    
    # Encrypted Apprise URL (for current usage)
    apprise_url_encrypted: Mapped[bytes] = mapped_column(LargeBinary)
    
    # Encrypted original config (for future flexibility)
    config_json_encrypted: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    
    tag: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Relationships
    user: Mapped["User"] = relationship(back_populates="integrations")
    
    # Properties for transparent encryption/decryption
    @property
    def apprise_url(self) -> str:
        """Decrypt and return the Apprise URL"""
        from src.db.encryption import decrypt_field
        return decrypt_field(self.apprise_url_encrypted)
    
    @apprise_url.setter
    def apprise_url(self, value: str):
        """Encrypt and store the Apprise URL"""
        from src.db.encryption import encrypt_field
        self.apprise_url_encrypted = encrypt_field(value)
    
    @property
    def config_json(self) -> dict | None:
        """Decrypt and return the config JSON"""
        if not self.config_json_encrypted:
            return None
        from src.db.encryption import decrypt_field
        import json
        return json.loads(decrypt_field(self.config_json_encrypted))
    
    @config_json.setter
    def config_json(self, value: dict):
        """Encrypt and store the config JSON"""
        from src.db.encryption import encrypt_field
        import json
        self.config_json_encrypted = encrypt_field(json.dumps(value))
```

---

## API Design

### Single Endpoint for All Integrations

**Endpoint**: `POST /api/integrations`

**Philosophy**: One endpoint handles all integration types. The `type` field in the request determines which converter to use.

```python
# Request body varies by integration type
{
  "type": "gotify",
  "name": "My Gotify Server",
  "tag": "urgent",
  "config": {
    "server_url": "https://gotify.example.com",
    "token": "AbCdEf123456"
  }
}
```

**Response** (never includes sensitive data):
```json
{
  "id": 1,
  "name": "My Gotify Server",
  "integration_type": "gotify",
  "tag": "urgent",
  "is_active": true,
  "created_at": "2025-10-10T12:00:00Z"
}
```

### Get Integration Types

**Endpoint**: `GET /api/integrations/types`

Returns available integration types with their field schemas (for dynamic form generation).

```json
{
  "types": [
    {
      "type": "gotify",
      "name": "Gotify",
      "description": "Self-hosted notification server",
      "icon": "🔔",
      "fields": [
        {
          "name": "server_url",
          "label": "Server URL",
          "type": "url",
          "required": true,
          "placeholder": "https://gotify.example.com",
          "help": "Your Gotify server URL"
        },
        {
          "name": "token",
          "label": "Application Token",
          "type": "password",
          "required": true,
          "help": "Get from Gotify → Apps → Create Application"
        }
      ]
    }
  ]
}
```

---

## Service Layer Architecture

### 1. Integration Registry

**Purpose**: Central registry of all supported integration types

```python
# src/api/services/integration_registry.py
from typing import Protocol, Dict, Any
from pydantic import BaseModel

class IntegrationConverter(Protocol):
    """Protocol for integration converters"""
    
    def convert(self, config: dict) -> str:
        """Convert config to Apprise URL"""
        ...
    
    def validate(self, config: dict) -> tuple[bool, str]:
        """Validate configuration"""
        ...
    
    def get_fields(self) -> list[dict]:
        """Get form field definitions"""
        ...


class IntegrationRegistry:
    """Registry of all integration types"""
    
    def __init__(self):
        self._converters: Dict[str, IntegrationConverter] = {}
    
    def register(self, integration_type: str, converter: IntegrationConverter):
        """Register a new integration type"""
        self._converters[integration_type] = converter
    
    def get_converter(self, integration_type: str) -> IntegrationConverter:
        """Get converter for integration type"""
        if integration_type not in self._converters:
            raise ValueError(f"Unknown integration type: {integration_type}")
        return self._converters[integration_type]
    
    def list_types(self) -> list[dict]:
        """List all available integration types"""
        return [
            {
                "type": type_name,
                "fields": converter.get_fields()
            }
            for type_name, converter in self._converters.items()
        ]


# Global registry instance
registry = IntegrationRegistry()
```

### 2. Base Converter Class

```python
# src/api/services/integration_converters/base.py
from abc import ABC, abstractmethod
from typing import Any

class BaseIntegrationConverter(ABC):
    """Base class for integration converters"""
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """Description of the integration"""
        pass
    
    @property
    @abstractmethod
    def icon(self) -> str:
        """Icon emoji"""
        pass
    
    @abstractmethod
    def convert(self, config: dict) -> str:
        """Convert user config to Apprise URL"""
        pass
    
    @abstractmethod
    def validate(self, config: dict) -> tuple[bool, str]:
        """Validate configuration
        
        Returns:
            (is_valid, error_message)
        """
        pass
    
    @abstractmethod
    def get_fields(self) -> list[dict]:
        """Get form field definitions"""
        pass
```

### 3. Example: Gotify Converter

```python
# src/api/services/integration_converters/gotify.py
from urllib.parse import urlparse, urlencode
from .base import BaseIntegrationConverter

class GotifyConverter(BaseIntegrationConverter):
    """Gotify integration converter"""
    
    @property
    def name(self) -> str:
        return "Gotify"
    
    @property
    def description(self) -> str:
        return "Self-hosted notification server"
    
    @property
    def icon(self) -> str:
        return "🔔"
    
    def convert(self, config: dict) -> str:
        """Convert Gotify config to Apprise URL"""
        server_url = config['server_url'].rstrip('/')
        token = config['token']
        
        # Parse URL to determine protocol
        parsed = urlparse(server_url)
        hostname = parsed.netloc
        
        # Use gotifys:// for HTTPS, gotify:// for HTTP
        protocol = 'gotifys' if parsed.scheme == 'https' else 'gotify'
        
        # Build base URL
        url = f"{protocol}://{hostname}/{token}"
        
        # Add optional parameters
        params = {}
        if config.get('priority'):
            params['priority'] = config['priority']
        
        if params:
            url += '?' + urlencode(params)
        
        return url
    
    def validate(self, config: dict) -> tuple[bool, str]:
        """Validate Gotify configuration"""
        # Check required fields
        if 'server_url' not in config:
            return False, "server_url is required"
        if 'token' not in config:
            return False, "token is required"
        
        # Validate URL format
        try:
            parsed = urlparse(config['server_url'])
            if not parsed.scheme or not parsed.netloc:
                return False, "Invalid server URL"
        except Exception:
            return False, "Invalid server URL"
        
        # Validate token
        if not config['token'].strip():
            return False, "Token cannot be empty"
        
        return True, ""
    
    def get_fields(self) -> list[dict]:
        """Get form field definitions"""
        return [
            {
                "name": "server_url",
                "label": "Server URL",
                "type": "url",
                "placeholder": "https://gotify.example.com",
                "required": True,
                "help": "Your Gotify server URL (include http:// or https://)"
            },
            {
                "name": "token",
                "label": "Application Token",
                "type": "password",
                "placeholder": "AbCdEf123456",
                "required": True,
                "help": "Get this from Gotify → Apps → Create Application"
            },
            {
                "name": "priority",
                "label": "Priority",
                "type": "select",
                "options": [
                    {"value": "low", "label": "Low"},
                    {"value": "normal", "label": "Normal"},
                    {"value": "high", "label": "High"}
                ],
                "default": "normal",
                "required": False
            }
        ]
```

### 4. Converter Registration

```python
# src/api/services/integration_converters/__init__.py
from .base import BaseIntegrationConverter
from .gotify import GotifyConverter
from .email import EmailConverter
from .ntfy import NtfyConverter
from .discord import DiscordConverter
from .slack import SlackConverter
from .telegram import TelegramConverter

from ..integration_registry import registry

# Register all converters
registry.register('gotify', GotifyConverter())
registry.register('email', EmailConverter())
registry.register('ntfy', NtfyConverter())
registry.register('discord', DiscordConverter())
registry.register('slack', SlackConverter())
registry.register('telegram', TelegramConverter())

__all__ = [
    'BaseIntegrationConverter',
    'GotifyConverter',
    'EmailConverter',
    'NtfyConverter',
    'DiscordConverter',
    'SlackConverter',
    'TelegramConverter',
]
```

---

## Updated API Routes

### Create Integration

```python
# src/api/routes/integrations.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_current_user, get_session
from src.api.schemas import IntegrationCreateRequestV2, IntegrationResponse
from src.db.models import User, Integration
from src.db.repositories import IntegrationRepository
from src.api.services.integration_registry import registry

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    request: IntegrationCreateRequestV2,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Create integration from user-friendly config
    
    User provides only what's necessary (tokens, URLs, etc).
    Backend handles conversion to Apprise URL.
    """
    # Get converter for this integration type
    try:
        converter = registry.get_converter(request.type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Validate configuration
    is_valid, error_msg = converter.validate(request.config)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)
    
    # Convert config to Apprise URL
    try:
        apprise_url = converter.convert(request.config)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to convert configuration: {str(e)}"
        )
    
    # Create integration
    repo = IntegrationRepository(db)
    integration = Integration(
        user_id=current_user.id,
        name=request.name,
        integration_type=request.type,
        tag=request.tag,
        is_active=True
    )
    
    # Set encrypted fields (uses property setters)
    integration.apprise_url = apprise_url
    integration.config_json = request.config
    
    # Use get_or_create to prevent duplicates
    integration, created = await repo.get_or_create(
        user_id=current_user.id,
        name=request.name,
        apprise_url=apprise_url,
        tag=request.tag
    )
    
    await db.commit()
    await db.refresh(integration)
    
    return integration


@router.get("/types")
async def list_integration_types():
    """List available integration types with field schemas
    
    Used for dynamic form generation in UI.
    """
    types = []
    
    for type_name in ['gotify', 'email', 'ntfy', 'discord', 'slack', 'telegram']:
        try:
            converter = registry.get_converter(type_name)
            types.append({
                "type": type_name,
                "name": converter.name,
                "description": converter.description,
                "icon": converter.icon,
                "fields": converter.get_fields()
            })
        except ValueError:
            continue
    
    return {"types": types}
```

### Test Integration

```python
@router.post("/{integration_id}/test")
async def test_integration(
    integration_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """Send a test notification to this integration"""
    repo = IntegrationRepository(db)
    integration = await repo.get_by_id(integration_id)
    
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Check ownership
    if integration.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Send test notification using the Apprise URL
    from src.activities.notifications import send_notification
    
    try:
        result = await send_notification(
            user_id=current_user.id,
            title="Test Notification",
            body=f"This is a test from Soonish using {integration.name}",
            level="info",
            tags=[integration.tag]
        )
        
        return {
            "success": True,
            "message": "Test notification sent",
            "result": result
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to send test notification: {str(e)}"
        )
```

---

## Updated Schemas

```python
# src/api/schemas.py

class IntegrationCreateRequestV2(BaseModel):
    """Create integration with type-specific config
    
    User provides only what's necessary - backend handles Apprise URL generation.
    """
    type: str  # 'gotify', 'email', 'ntfy', 'discord', 'slack', 'telegram'
    name: str
    tag: str
    config: dict  # Type-specific configuration (validated by converter)


class IntegrationResponse(BaseModel):
    """Integration response - NEVER includes sensitive data"""
    id: int
    name: str
    integration_type: str
    tag: str
    is_active: bool
    created_at: datetime
    
    # NOTE: apprise_url and config_json are NEVER returned
    
    class Config:
        from_attributes = True
```

---

## Migration Strategy

### Backward Compatibility

**Existing Integrations** (with raw Apprise URLs):
- `integration_type = 'custom'`
- `config_json_encrypted = NULL`
- `apprise_url_encrypted` remains unchanged
- Continue to work exactly as before

**New Integrations** (via new endpoint):
- `integration_type` = specific type ('gotify', 'email', etc.)
- `config_json_encrypted` = encrypted original user inputs
- `apprise_url_encrypted` = generated Apprise URL
- Can be edited/updated using original config

### Migration Script

```python
# scripts/migrate_integrations.py
"""
Optional: Migrate existing integrations to new format

This is NOT required - existing integrations continue to work.
Only run if you want to enable editing of old integrations.
"""
async def migrate_integration(integration: Integration):
    """Attempt to reverse-engineer config from Apprise URL"""
    # This is optional and only for convenience
    # Most integrations will remain as 'custom' type
    pass
```

---

## File Structure

```
src/api/services/
├── integration_registry.py          # Central registry
└── integration_converters/
    ├── __init__.py                  # Registration
    ├── base.py                      # Base converter class
    ├── gotify.py                    # Gotify converter
    ├── email.py                     # Email converter
    ├── ntfy.py                      # Ntfy converter
    ├── discord.py                   # Discord converter
    ├── slack.py                     # Slack converter
    └── telegram.py                  # Telegram converter
```

---

## Adding New Integrations

### Step-by-Step Process

1. **Create Converter Class**
   ```python
   # src/api/services/integration_converters/pushover.py
   from .base import BaseIntegrationConverter
   
   class PushoverConverter(BaseIntegrationConverter):
       # Implement required methods
       pass
   ```

2. **Register Converter**
   ```python
   # src/api/services/integration_converters/__init__.py
   from .pushover import PushoverConverter
   registry.register('pushover', PushoverConverter())
   ```

3. **That's It!**
   - Endpoint automatically supports new type
   - UI can query `/api/integrations/types` for form fields
   - No database changes needed
   - No route changes needed

---

## Security Considerations

### Encryption

- **All sensitive data encrypted at rest**:
  - `apprise_url_encrypted` (contains tokens, passwords)
  - `config_json_encrypted` (contains user inputs)

- **Never returned in API responses**:
  - Apprise URLs never exposed
  - Config JSON never exposed
  - Only metadata returned (name, type, tag, status)

### Validation

- **Input validation** at converter level
- **Type checking** via Pydantic schemas
- **SQL injection protection** via SQLAlchemy ORM
- **Authorization checks** on all endpoints

---

## Testing Strategy

### Unit Tests

```python
# tests/test_integration_converters.py
def test_gotify_converter():
    """Test Gotify converter"""
    converter = GotifyConverter()
    
    config = {
        "server_url": "https://gotify.example.com",
        "token": "abc123"
    }
    
    # Test validation
    is_valid, error = converter.validate(config)
    assert is_valid
    
    # Test conversion
    url = converter.convert(config)
    assert url == "gotifys://gotify.example.com/abc123"
```

### Integration Tests

```python
# tests/test_integration_api.py
async def test_create_gotify_integration(client, auth_token):
    """Test creating Gotify integration via API"""
    response = await client.post(
        "/api/integrations",
        headers={"Authorization": f"Bearer {auth_token}"},
        json={
            "type": "gotify",
            "name": "My Gotify",
            "tag": "urgent",
            "config": {
                "server_url": "https://gotify.example.com",
                "token": "abc123"
            }
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["integration_type"] == "gotify"
    assert "apprise_url" not in data  # Never exposed
    assert "config" not in data  # Never exposed
```

---

## Summary

### Key Design Decisions

1. ✅ **Single Endpoint**: One `/api/integrations` endpoint for all types
2. ✅ **Registry Pattern**: Extensible converter registry
3. ✅ **Dual Storage**: Both Apprise URL and original config (encrypted)
4. ✅ **User Abstraction**: Users never see Apprise URLs
5. ✅ **Backward Compatible**: Existing integrations continue to work
6. ✅ **Future-Proof**: Can migrate away from Apprise without user impact

### Implementation Estimate

- **Database Migration**: ~20 lines
- **Registry + Base Converter**: ~100 lines
- **6 Converters**: ~600 lines (100 each)
- **API Routes**: ~50 lines (updates)
- **Schemas**: ~20 lines
- **Tests**: ~200 lines

**Total**: ~990 lines of clean, extensible code

### Next Steps

1. Review this spec
2. Discuss any changes
3. Create phase plan with step-by-step implementation
4. Implement in phases (database → converters → API → tests)
