# Integration Configuration Polish - Implementation Spec

**Status**: 📝 Ready for Review  
**Estimated Lines**: ~200-300

---

## Problem Statement

Currently, users must provide raw Apprise URLs like:
```
gotify://hostname/token
mailto://user:password@smtp.gmail.com
```

This is:
- ❌ Not user-friendly
- ❌ Requires knowledge of Apprise URL format
- ❌ Error-prone
- ❌ No validation

## Solution

Provide integration-specific forms that collect user-friendly inputs and convert to Apprise URLs.

---

## Supported Integrations

### Priority 1 (Implement First)
1. **Gotify** - Self-hosted notification server
2. **Email** - SMTP email notifications
3. **Ntfy** - Simple HTTP notifications

### Priority 2 (Future)
4. **Discord** - Webhook notifications
5. **Slack** - Webhook notifications
6. **Telegram** - Bot notifications
7. **SMS** (Twilio) - Text messages

---

## Integration Schemas

### 1. Gotify Integration

**User Inputs**:
```json
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

**Converts To**:
```
apprise_url: "gotify://gotify.example.com/AbCdEf123456"
```

**Validation**:
- `server_url`: Valid URL (http/https)
- `token`: Non-empty string
- Test connection before saving

---

### 2. Email Integration

**User Inputs**:
```json
{
  "type": "email",
  "name": "My Email",
  "tag": "email",
  "config": {
    "to_email": "notifications@example.com",
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "smtp_user": "sender@gmail.com",
    "smtp_password": "app_password"
  }
}
```

**Converts To**:
```
apprise_url: "mailtos://sender@gmail.com:app_password@smtp.gmail.com:587?to=notifications@example.com"
```

**Validation**:
- `to_email`: Valid email format
- `smtp_server`: Valid hostname
- `smtp_port`: 1-65535
- `smtp_user`: Valid email
- `smtp_password`: Non-empty
- Test SMTP connection

---

### 3. Ntfy Integration

**User Inputs**:
```json
{
  "type": "ntfy",
  "name": "Ntfy Notifications",
  "tag": "mobile",
  "config": {
    "server_url": "https://ntfy.sh",
    "topic": "my-topic",
    "username": "optional_user",
    "password": "optional_pass"
  }
}
```

**Converts To**:
```
apprise_url: "ntfy://ntfy.sh/my-topic"
# or with auth:
apprise_url: "ntfy://user:pass@ntfy.sh/my-topic"
```

**Validation**:
- `server_url`: Valid URL
- `topic`: Non-empty, alphanumeric + hyphens
- `username`/`password`: Optional, both or neither

---

### 4. Discord Integration (Priority 2)

**User Inputs**:
```json
{
  "type": "discord",
  "name": "Discord Channel",
  "tag": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/123/abc"
  }
}
```

**Converts To**:
```
apprise_url: "discord://123/abc"
```

**Validation**:
- `webhook_url`: Must match Discord webhook pattern
- Extract webhook ID and token from URL

---

### 5. Slack Integration (Priority 2)

**User Inputs**:
```json
{
  "type": "slack",
  "name": "Slack Channel",
  "tag": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T00/B00/xxx"
  }
}
```

**Converts To**:
```
apprise_url: "slack://T00/B00/xxx"
```

---

## Database Changes

### Update `integrations` Table

```sql
ALTER TABLE integrations ADD COLUMN integration_type TEXT DEFAULT 'custom';
ALTER TABLE integrations ADD COLUMN config_json TEXT;  -- Encrypted JSON

-- Migration: Set existing integrations to 'custom' type
UPDATE integrations SET integration_type = 'custom' WHERE integration_type IS NULL;
```

**Schema**:
- `integration_type`: 'gotify', 'email', 'ntfy', 'discord', 'slack', 'custom'
- `config_json`: Encrypted JSON blob of configuration
- `apprise_url`: Still stored (generated from config)

---

## API Changes

### 1. New Integration Type Endpoint

#### GET /api/integrations/types
**List available integration types**

```python
@router.get("/types")
async def list_integration_types():
    """List available integration types with schemas"""
    return {
        "success": True,
        "data": [
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
                        "placeholder": "https://gotify.example.com",
                        "required": True
                    },
                    {
                        "name": "token",
                        "label": "Application Token",
                        "type": "password",
                        "placeholder": "AbCdEf123456",
                        "required": True
                    }
                ]
            },
            {
                "type": "email",
                "name": "Email",
                "description": "SMTP email notifications",
                "icon": "📧",
                "fields": [
                    {
                        "name": "to_email",
                        "label": "Recipient Email",
                        "type": "email",
                        "required": True
                    },
                    {
                        "name": "smtp_server",
                        "label": "SMTP Server",
                        "type": "text",
                        "placeholder": "smtp.gmail.com",
                        "required": True
                    },
                    {
                        "name": "smtp_port",
                        "label": "SMTP Port",
                        "type": "number",
                        "default": 587,
                        "required": True
                    },
                    {
                        "name": "smtp_user",
                        "label": "SMTP Username",
                        "type": "email",
                        "required": True
                    },
                    {
                        "name": "smtp_password",
                        "label": "SMTP Password",
                        "type": "password",
                        "required": True,
                        "help": "Use app password for Gmail"
                    }
                ]
            },
            {
                "type": "ntfy",
                "name": "Ntfy",
                "description": "Simple HTTP notifications",
                "icon": "📱",
                "fields": [
                    {
                        "name": "server_url",
                        "label": "Server URL",
                        "type": "url",
                        "default": "https://ntfy.sh",
                        "required": True
                    },
                    {
                        "name": "topic",
                        "label": "Topic",
                        "type": "text",
                        "placeholder": "my-topic",
                        "required": True
                    },
                    {
                        "name": "username",
                        "label": "Username (optional)",
                        "type": "text",
                        "required": False
                    },
                    {
                        "name": "password",
                        "label": "Password (optional)",
                        "type": "password",
                        "required": False
                    }
                ]
            }
        ]
    }
```

### 2. Update Create Integration Endpoint

#### POST /api/integrations
**Updated to accept integration type + config**

```python
@router.post("", response_model=IntegrationResponse, status_code=201)
async def create_integration(
    request: IntegrationCreateRequestV2,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create integration from type-specific config"""
    
    # Convert config to Apprise URL
    from src.api.services.integration_converter import convert_to_apprise_url
    
    try:
        apprise_url = convert_to_apprise_url(
            integration_type=request.type,
            config=request.config
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Encrypt config for storage
    from src.db.encryption import encrypt_field
    config_json = json.dumps(request.config)
    encrypted_config = encrypt_field(config_json)
    
    # Create integration
    repo = IntegrationRepository(db)
    integration = await repo.create(
        user_id=current_user.id,
        name=request.name,
        integration_type=request.type,
        apprise_url=apprise_url,
        config_json=encrypted_config,
        tag=request.tag
    )
    
    await db.commit()
    await db.refresh(integration)
    
    return integration
```

---

## New Service: Integration Converter

### src/api/services/integration_converter.py

```python
"""Convert integration configs to Apprise URLs"""
from urllib.parse import quote


def convert_to_apprise_url(integration_type: str, config: dict) -> str:
    """Convert integration config to Apprise URL"""
    
    converters = {
        'gotify': _convert_gotify,
        'email': _convert_email,
        'ntfy': _convert_ntfy,
        'discord': _convert_discord,
        'slack': _convert_slack,
    }
    
    converter = converters.get(integration_type)
    if not converter:
        raise ValueError(f"Unknown integration type: {integration_type}")
    
    return converter(config)


def _convert_gotify(config: dict) -> str:
    """Convert Gotify config to Apprise URL"""
    server_url = config['server_url'].rstrip('/')
    token = config['token']
    
    # Extract hostname from URL
    from urllib.parse import urlparse
    parsed = urlparse(server_url)
    hostname = parsed.netloc
    
    # Build Apprise URL
    if parsed.scheme == 'https':
        return f"gotifys://{hostname}/{token}"
    else:
        return f"gotify://{hostname}/{token}"


def _convert_email(config: dict) -> str:
    """Convert Email config to Apprise URL"""
    to_email = config['to_email']
    smtp_server = config['smtp_server']
    smtp_port = config.get('smtp_port', 587)
    smtp_user = config['smtp_user']
    smtp_password = config['smtp_password']
    
    # URL encode credentials
    user = quote(smtp_user, safe='')
    password = quote(smtp_password, safe='')
    
    # Build Apprise URL
    return (
        f"mailtos://{user}:{password}@{smtp_server}:{smtp_port}"
        f"?to={to_email}&from={smtp_user}"
    )


def _convert_ntfy(config: dict) -> str:
    """Convert Ntfy config to Apprise URL"""
    server_url = config['server_url'].rstrip('/')
    topic = config['topic']
    username = config.get('username')
    password = config.get('password')
    
    # Extract hostname
    from urllib.parse import urlparse
    parsed = urlparse(server_url)
    hostname = parsed.netloc
    
    # Build Apprise URL
    if username and password:
        user = quote(username, safe='')
        pwd = quote(password, safe='')
        return f"ntfy://{user}:{pwd}@{hostname}/{topic}"
    else:
        return f"ntfy://{hostname}/{topic}"


def _convert_discord(config: dict) -> str:
    """Convert Discord webhook to Apprise URL"""
    webhook_url = config['webhook_url']
    
    # Extract webhook ID and token from URL
    # Format: https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
    import re
    match = re.search(r'/webhooks/(\d+)/([^/]+)', webhook_url)
    if not match:
        raise ValueError("Invalid Discord webhook URL")
    
    webhook_id = match.group(1)
    webhook_token = match.group(2)
    
    return f"discord://{webhook_id}/{webhook_token}"


def _convert_slack(config: dict) -> str:
    """Convert Slack webhook to Apprise URL"""
    webhook_url = config['webhook_url']
    
    # Extract parts from URL
    # Format: https://hooks.slack.com/services/T00/B00/xxx
    import re
    match = re.search(r'/services/([^/]+)/([^/]+)/([^/]+)', webhook_url)
    if not match:
        raise ValueError("Invalid Slack webhook URL")
    
    token_a = match.group(1)
    token_b = match.group(2)
    token_c = match.group(3)
    
    return f"slack://{token_a}/{token_b}/{token_c}"
```

---

## Validation Service

### src/api/services/integration_validator.py

```python
"""Validate integration configurations"""
import re
from urllib.parse import urlparse


def validate_integration_config(integration_type: str, config: dict) -> tuple[bool, str]:
    """Validate integration config
    
    Returns: (is_valid, error_message)
    """
    
    validators = {
        'gotify': _validate_gotify,
        'email': _validate_email,
        'ntfy': _validate_ntfy,
        'discord': _validate_discord,
        'slack': _validate_slack,
    }
    
    validator = validators.get(integration_type)
    if not validator:
        return False, f"Unknown integration type: {integration_type}"
    
    return validator(config)


def _validate_gotify(config: dict) -> tuple[bool, str]:
    """Validate Gotify config"""
    if 'server_url' not in config:
        return False, "server_url is required"
    if 'token' not in config:
        return False, "token is required"
    
    # Validate URL
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


def _validate_email(config: dict) -> tuple[bool, str]:
    """Validate Email config"""
    required = ['to_email', 'smtp_server', 'smtp_user', 'smtp_password']
    for field in required:
        if field not in config or not config[field]:
            return False, f"{field} is required"
    
    # Validate email format
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, config['to_email']):
        return False, "Invalid to_email format"
    if not re.match(email_pattern, config['smtp_user']):
        return False, "Invalid smtp_user format"
    
    # Validate port
    port = config.get('smtp_port', 587)
    if not isinstance(port, int) or port < 1 or port > 65535:
        return False, "Invalid SMTP port"
    
    return True, ""


def _validate_ntfy(config: dict) -> tuple[bool, str]:
    """Validate Ntfy config"""
    if 'server_url' not in config:
        return False, "server_url is required"
    if 'topic' not in config:
        return False, "topic is required"
    
    # Validate URL
    try:
        parsed = urlparse(config['server_url'])
        if not parsed.scheme or not parsed.netloc:
            return False, "Invalid server URL"
    except Exception:
        return False, "Invalid server URL"
    
    # Validate topic (alphanumeric + hyphens/underscores)
    if not re.match(r'^[a-zA-Z0-9_-]+$', config['topic']):
        return False, "Topic must be alphanumeric with hyphens/underscores"
    
    # If username provided, password must be too
    if config.get('username') and not config.get('password'):
        return False, "Password required when username is provided"
    if config.get('password') and not config.get('username'):
        return False, "Username required when password is provided"
    
    return True, ""
```

---

## Updated Schemas

### src/api/schemas.py

```python
class IntegrationConfigGotify(BaseModel):
    server_url: str
    token: str

class IntegrationConfigEmail(BaseModel):
    to_email: EmailStr
    smtp_server: str
    smtp_port: int = 587
    smtp_user: EmailStr
    smtp_password: str

class IntegrationConfigNtfy(BaseModel):
    server_url: str = "https://ntfy.sh"
    topic: str
    username: str | None = None
    password: str | None = None

class IntegrationCreateRequestV2(BaseModel):
    """Create integration with type-specific config"""
    type: str  # 'gotify', 'email', 'ntfy', etc.
    name: str
    tag: str
    config: dict  # Type-specific configuration

class IntegrationResponse(BaseModel):
    """Integration response (never includes apprise_url or config)"""
    id: int
    name: str
    integration_type: str
    tag: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
```

---

## Web UI Updates

### Integration Form (HTMX)

```html
<!-- website/integrations.html -->
<div id="integration-form">
  <!-- Integration Type Selector -->
  <select name="type" hx-get="/api/integrations/types/{value}/form" hx-target="#config-fields">
    <option value="">Select Integration Type</option>
    <option value="gotify">🔔 Gotify</option>
    <option value="email">📧 Email</option>
    <option value="ntfy">📱 Ntfy</option>
  </select>
  
  <!-- Dynamic Config Fields -->
  <div id="config-fields">
    <!-- Populated via HTMX based on selected type -->
  </div>
  
  <!-- Common Fields -->
  <input type="text" name="name" placeholder="Integration Name" required>
  <input type="text" name="tag" placeholder="Tag (e.g., urgent)" required>
  
  <button type="submit">Add Integration</button>
</div>
```

---

## Testing Plan

1. **List integration types** - Verify all types returned with schemas
2. **Create Gotify integration** - Verify Apprise URL generated correctly
3. **Create Email integration** - Verify SMTP URL format
4. **Create Ntfy integration** - Verify with/without auth
5. **Invalid config** - Verify validation errors
6. **Test integration** - Verify notification sent
7. **Backward compatibility** - Verify existing integrations still work

---

## Files to Create/Modify

**Create**:
- `src/api/services/integration_converter.py` (~150 lines)
- `src/api/services/integration_validator.py` (~120 lines)
- `website/integrations.html` (update form)

**Modify**:
- `src/db/models.py` - Add integration_type, config_json fields
- `src/api/routes/integrations.py` - Add /types endpoint, update create
- `src/api/schemas.py` - Add new schemas
- `scripts/init_db.py` - Add new columns

---

## Migration Strategy

### Backward Compatibility

Existing integrations with raw Apprise URLs:
- Set `integration_type = 'custom'`
- Leave `config_json = NULL`
- Continue to work as before

New integrations:
- Use type-specific forms
- Store encrypted config
- Generate Apprise URLs automatically

---

## Acceptance Criteria

- ✅ List integration types with field schemas
- ✅ Create Gotify integration with user-friendly form
- ✅ Create Email integration with SMTP config
- ✅ Create Ntfy integration
- ✅ Validation catches invalid configs
- ✅ Test integration sends notification
- ✅ Existing integrations continue to work
- ✅ Config stored encrypted
- ✅ Apprise URLs never exposed in API responses
- ✅ All ruff checks pass

---

**Estimated Implementation Time**: 3-4 hours  
**Code Complexity**: Medium (conversion logic, validation)  
**Dependencies**: Encryption (existing) ✅
