# Apprise Integration Specifications

**Source**: Official Apprise Wiki Documentation  
**Date**: 2025-10-10

This document provides comprehensive specifications for implementing user-friendly integration forms based on Apprise's official configuration documentation.

---

## Overview

Apprise supports 100+ notification services. This document focuses on the most popular integrations for Soonish, providing:
- User-friendly input fields
- Validation rules
- Apprise URL generation logic
- Setup instructions

---

## Priority 1: Core Integrations

### 1. Gotify

**Description**: Self-hosted notification server  
**Icon**: 🔔  
**Complexity**: Low  
**Apprise URL Format**: `gotify://{hostname}/{token}` or `gotifys://{hostname}/{token}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `server_url` | URL | Yes | Valid HTTP/HTTPS URL | Gotify server URL |
| `token` | Password | Yes | Non-empty string | Application token from Gotify |
| `priority` | Select | No | `low`, `normal`, `high` | Message priority (default: normal) |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "server_url",
      "label": "Server URL",
      "type": "url",
      "placeholder": "https://gotify.example.com",
      "required": true,
      "help": "Your Gotify server URL (include http:// or https://)"
    },
    {
      "name": "token",
      "label": "Application Token",
      "type": "password",
      "placeholder": "AbCdEf123456",
      "required": true,
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
      "required": false
    }
  ]
}
```

#### Conversion Logic

```python
def convert_gotify(config: dict) -> str:
    """Convert Gotify config to Apprise URL"""
    from urllib.parse import urlparse, urlencode
    
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
```

#### Setup Instructions

1. Install Gotify server (self-hosted or use existing)
2. Log into Gotify web interface
3. Go to **Apps** → **Create Application**
4. Give it a name (e.g., "Soonish")
5. Copy the **Token** provided
6. Use your server URL and token in Soonish

---

### 2. Email (SMTP)

**Description**: Send notifications via email  
**Icon**: 📧  
**Complexity**: Medium  
**Apprise URL Format**: `mailto://{user}:{password}@{smtp_server}:{port}?to={to_email}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `to_email` | Email | Yes | Valid email format | Recipient email address |
| `smtp_server` | Text | Yes | Valid hostname | SMTP server hostname |
| `smtp_port` | Number | Yes | 1-65535 | SMTP port (587 for TLS, 465 for SSL) |
| `smtp_user` | Email | Yes | Valid email format | SMTP username (usually your email) |
| `smtp_password` | Password | Yes | Non-empty | SMTP password or app password |
| `from_email` | Email | No | Valid email format | From address (defaults to smtp_user) |
| `from_name` | Text | No | Any string | Sender name |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "to_email",
      "label": "Recipient Email",
      "type": "email",
      "placeholder": "notifications@example.com",
      "required": true,
      "help": "Where to send notifications"
    },
    {
      "name": "smtp_server",
      "label": "SMTP Server",
      "type": "text",
      "placeholder": "smtp.gmail.com",
      "required": true,
      "help": "Your email provider's SMTP server"
    },
    {
      "name": "smtp_port",
      "label": "SMTP Port",
      "type": "number",
      "default": 587,
      "min": 1,
      "max": 65535,
      "required": true,
      "help": "Usually 587 (TLS) or 465 (SSL)"
    },
    {
      "name": "smtp_user",
      "label": "SMTP Username",
      "type": "email",
      "placeholder": "your.email@gmail.com",
      "required": true,
      "help": "Usually your full email address"
    },
    {
      "name": "smtp_password",
      "label": "SMTP Password",
      "type": "password",
      "required": true,
      "help": "For Gmail, use an App Password (not your regular password)"
    },
    {
      "name": "from_name",
      "label": "Sender Name (Optional)",
      "type": "text",
      "placeholder": "Soonish Notifications",
      "required": false
    }
  ]
}
```

#### Conversion Logic

```python
def convert_email(config: dict) -> str:
    """Convert Email config to Apprise URL"""
    from urllib.parse import quote, urlencode
    
    to_email = config['to_email']
    smtp_server = config['smtp_server']
    smtp_port = config.get('smtp_port', 587)
    smtp_user = config['smtp_user']
    smtp_password = config['smtp_password']
    from_name = config.get('from_name', '')
    
    # URL encode credentials
    user = quote(smtp_user, safe='')
    password = quote(smtp_password, safe='')
    
    # Determine protocol (mailtos for TLS, mailto for plain)
    protocol = 'mailtos' if smtp_port in [587, 465] else 'mailto'
    
    # Build URL
    url = f"{protocol}://{user}:{password}@{smtp_server}:{smtp_port}"
    
    # Add query parameters
    params = {'to': to_email}
    
    # Add from address
    if from_name:
        params['from'] = f"{from_name} <{smtp_user}>"
    else:
        params['from'] = smtp_user
    
    url += '?' + urlencode(params)
    
    return url
```

#### Built-In Providers

For common providers, use simplified URLs:

```python
BUILTIN_PROVIDERS = {
    'gmail': {
        'smtp_server': 'smtp.gmail.com',
        'smtp_port': 587,
        'help': 'Use an App Password from https://myaccount.google.com/apppasswords'
    },
    'yahoo': {
        'smtp_server': 'smtp.mail.yahoo.com',
        'smtp_port': 587,
        'help': 'Generate app password from account settings'
    },
    'outlook': {
        'smtp_server': 'smtp-mail.outlook.com',
        'smtp_port': 587
    },
    'fastmail': {
        'smtp_server': 'smtp.fastmail.com',
        'smtp_port': 587,
        'help': 'Create app-specific password with SMTP permission'
    }
}
```

---

### 3. Ntfy

**Description**: Simple HTTP-based pub-sub notifications  
**Icon**: 📱  
**Complexity**: Low  
**Apprise URL Format**: `ntfy://{hostname}/{topic}` or `ntfy://{user}:{password}@{hostname}/{topic}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `server_url` | URL | Yes | Valid HTTP/HTTPS URL | Ntfy server URL (default: https://ntfy.sh) |
| `topic` | Text | Yes | Alphanumeric + hyphens/underscores | Topic name |
| `username` | Text | No | Any string | Username for authentication (optional) |
| `password` | Password | No | Any string | Password for authentication (optional) |
| `priority` | Select | No | `max`, `high`, `default`, `low`, `min` | Message priority |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "server_url",
      "label": "Server URL",
      "type": "url",
      "default": "https://ntfy.sh",
      "placeholder": "https://ntfy.sh",
      "required": true,
      "help": "Use https://ntfy.sh for public server or your own server URL"
    },
    {
      "name": "topic",
      "label": "Topic",
      "type": "text",
      "placeholder": "my-notifications",
      "required": true,
      "pattern": "^[a-zA-Z0-9_-]+$",
      "help": "Alphanumeric characters, hyphens, and underscores only"
    },
    {
      "name": "username",
      "label": "Username (Optional)",
      "type": "text",
      "required": false,
      "help": "Only needed if your server requires authentication"
    },
    {
      "name": "password",
      "label": "Password (Optional)",
      "type": "password",
      "required": false,
      "help": "Only needed if your server requires authentication"
    },
    {
      "name": "priority",
      "label": "Priority",
      "type": "select",
      "options": [
        {"value": "max", "label": "Max"},
        {"value": "high", "label": "High"},
        {"value": "default", "label": "Default"},
        {"value": "low", "label": "Low"},
        {"value": "min", "label": "Min"}
      ],
      "default": "default",
      "required": false
    }
  ]
}
```

#### Conversion Logic

```python
def convert_ntfy(config: dict) -> str:
    """Convert Ntfy config to Apprise URL"""
    from urllib.parse import urlparse, quote, urlencode
    
    server_url = config['server_url'].rstrip('/')
    topic = config['topic']
    username = config.get('username')
    password = config.get('password')
    
    # Parse URL
    parsed = urlparse(server_url)
    hostname = parsed.netloc
    
    # Use ntfys:// for HTTPS, ntfy:// for HTTP
    protocol = 'ntfys' if parsed.scheme == 'https' else 'ntfy'
    
    # Build URL with auth if provided
    if username and password:
        user = quote(username, safe='')
        pwd = quote(password, safe='')
        url = f"{protocol}://{user}:{pwd}@{hostname}/{topic}"
    else:
        url = f"{protocol}://{hostname}/{topic}"
    
    # Add optional parameters
    params = {}
    if config.get('priority'):
        params['priority'] = config['priority']
    
    if params:
        url += '?' + urlencode(params)
    
    return url
```

#### Validation Rules

```python
def validate_ntfy(config: dict) -> tuple[bool, str]:
    """Validate Ntfy configuration"""
    import re
    
    # Validate topic format
    if not re.match(r'^[a-zA-Z0-9_-]+$', config['topic']):
        return False, "Topic must contain only alphanumeric characters, hyphens, and underscores"
    
    # If username provided, password must be too (and vice versa)
    if config.get('username') and not config.get('password'):
        return False, "Password required when username is provided"
    if config.get('password') and not config.get('username'):
        return False, "Username required when password is provided"
    
    return True, ""
```

---

## Priority 2: Advanced Integrations

### 4. Discord

**Description**: Discord webhook notifications  
**Icon**: 💬  
**Complexity**: Low  
**Apprise URL Format**: `discord://{webhook_id}/{webhook_token}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `webhook_url` | URL | Yes | Discord webhook URL pattern | Full Discord webhook URL |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "webhook_url",
      "label": "Webhook URL",
      "type": "url",
      "placeholder": "https://discord.com/api/webhooks/123456/abcdef...",
      "required": true,
      "help": "Get this from Discord → Server Settings → Integrations → Webhooks"
    }
  ]
}
```

#### Conversion Logic

```python
def convert_discord(config: dict) -> str:
    """Convert Discord webhook to Apprise URL"""
    import re
    
    webhook_url = config['webhook_url']
    
    # Extract webhook ID and token from URL
    # Format: https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
    match = re.search(r'/webhooks/(\d+)/([^/]+)', webhook_url)
    if not match:
        raise ValueError("Invalid Discord webhook URL")
    
    webhook_id = match.group(1)
    webhook_token = match.group(2)
    
    return f"discord://{webhook_id}/{webhook_token}"
```

#### Setup Instructions

1. Open Discord and go to your server
2. Click **Server Settings** → **Integrations**
3. Click **Webhooks** → **New Webhook**
4. Give it a name and select a channel
5. Click **Copy Webhook URL**
6. Paste the URL into Soonish

---

### 5. Slack

**Description**: Slack webhook notifications  
**Icon**: 💼  
**Complexity**: Medium  
**Apprise URL Format**: `slack://{tokenA}/{tokenB}/{tokenC}` or `slack://{oauth_token}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `webhook_url` | URL | Yes | Slack webhook URL pattern | Full Slack webhook URL |
| `channel` | Text | No | Channel name with # | Override default channel |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "webhook_url",
      "label": "Webhook URL",
      "type": "url",
      "placeholder": "https://hooks.slack.com/services/T00/B00/xxx",
      "required": true,
      "help": "Get this from Slack → Apps → Incoming Webhooks"
    },
    {
      "name": "channel",
      "label": "Channel (Optional)",
      "type": "text",
      "placeholder": "#general",
      "required": false,
      "help": "Override the default channel (include #)"
    }
  ]
}
```

#### Conversion Logic

```python
def convert_slack(config: dict) -> str:
    """Convert Slack webhook to Apprise URL"""
    import re
    
    webhook_url = config['webhook_url']
    channel = config.get('channel', '')
    
    # Extract parts from URL
    # Format: https://hooks.slack.com/services/{tokenA}/{tokenB}/{tokenC}
    match = re.search(r'/services/([^/]+)/([^/]+)/([^/]+)', webhook_url)
    if not match:
        raise ValueError("Invalid Slack webhook URL")
    
    token_a = match.group(1)
    token_b = match.group(2)
    token_c = match.group(3)
    
    url = f"slack://{token_a}/{token_b}/{token_c}"
    
    # Add channel if specified
    if channel:
        # Ensure channel starts with #
        if not channel.startswith('#'):
            channel = f"#{channel}"
        url += f"/{channel}"
    
    return url
```

#### Setup Instructions

**Method 1: Incoming Webhook (Recommended)**
1. Go to https://api.slack.com/apps
2. Create a new app or select existing
3. Enable **Incoming Webhooks**
4. Click **Add New Webhook to Workspace**
5. Select a channel
6. Copy the webhook URL

**Method 2: Bot Token**
1. Create a Slack App
2. Add Bot User OAuth Token permissions
3. Install app to workspace
4. Copy the Bot User OAuth Token (starts with `xoxb-`)

---

### 6. Telegram

**Description**: Telegram bot notifications  
**Icon**: ✈️  
**Complexity**: High  
**Apprise URL Format**: `tgram://{bot_token}/{chat_id}`

#### User Inputs

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `bot_token` | Password | Yes | Format: `123456:ABC-DEF...` | Bot token from BotFather |
| `chat_id` | Text | No | Numeric or @username | Chat ID or username |

#### Form Fields

```json
{
  "fields": [
    {
      "name": "bot_token",
      "label": "Bot Token",
      "type": "password",
      "placeholder": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz",
      "required": true,
      "help": "Get this from @BotFather on Telegram"
    },
    {
      "name": "chat_id",
      "label": "Chat ID (Optional)",
      "type": "text",
      "placeholder": "123456789 or leave empty for yourself",
      "required": false,
      "help": "Leave empty to send to yourself (you must message the bot first)"
    }
  ]
}
```

#### Conversion Logic

```python
def convert_telegram(config: dict) -> str:
    """Convert Telegram config to Apprise URL"""
    bot_token = config['bot_token']
    chat_id = config.get('chat_id', '')
    
    if chat_id:
        return f"tgram://{bot_token}/{chat_id}/"
    else:
        # Auto-detect chat_id if user messaged the bot
        return f"tgram://{bot_token}/"
```

#### Setup Instructions

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow prompts to name your bot
4. Copy the **bot token** provided
5. Send `/start` to your new bot
6. (Optional) Get your chat ID:
   - Message your bot
   - Visit: `https://api.telegram.org/bot{YOUR_BOT_TOKEN}/getUpdates`
   - Find your `chat.id` in the response

---

## Validation Framework

### Common Validation Rules

```python
def validate_url(url: str) -> bool:
    """Validate URL format"""
    from urllib.parse import urlparse
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def validate_email(email: str) -> bool:
    """Validate email format"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_port(port: int) -> bool:
    """Validate port number"""
    return 1 <= port <= 65535
```

### Integration-Specific Validation

```python
VALIDATORS = {
    'gotify': validate_gotify,
    'email': validate_email_config,
    'ntfy': validate_ntfy,
    'discord': validate_discord,
    'slack': validate_slack,
    'telegram': validate_telegram,
}

def validate_integration(integration_type: str, config: dict) -> tuple[bool, str]:
    """Validate integration configuration"""
    validator = VALIDATORS.get(integration_type)
    if not validator:
        return False, f"Unknown integration type: {integration_type}"
    
    return validator(config)
```

---

## Testing Framework

### Test Connection

Each integration should support a "Test" button that sends a test notification:

```python
async def test_integration(integration_type: str, config: dict) -> dict:
    """Test integration by sending a test notification"""
    from src.activities.notifications import send_notification
    
    # Convert config to Apprise URL
    apprise_url = convert_to_apprise_url(integration_type, config)
    
    # Send test notification
    try:
        result = await send_notification(
            user_id=None,  # System test
            title="Test Notification",
            body=f"This is a test from Soonish using {integration_type}",
            level="info",
            apprise_urls=[apprise_url]
        )
        
        return {
            "success": True,
            "message": "Test notification sent successfully"
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Test failed: {str(e)}"
        }
```

---

## Summary

This specification covers **6 major integrations** with complete:
- ✅ User-friendly form fields
- ✅ Validation rules
- ✅ Apprise URL conversion logic
- ✅ Setup instructions
- ✅ Testing framework

**Next Steps**:
1. Implement converter service (`src/api/services/integration_converter.py`)
2. Implement validator service (`src/api/services/integration_validator.py`)
3. Update integration endpoints to use new system
4. Create dynamic forms in web UI
5. Add more integrations as needed (100+ available in Apprise)

**Additional Integrations Available**:
- Pushover, Pushbullet, Prowl
- Matrix, Mattermost, Rocket.Chat
- Microsoft Teams, Google Chat
- SMS (Twilio, AWS SNS, etc.)
- And 90+ more!
