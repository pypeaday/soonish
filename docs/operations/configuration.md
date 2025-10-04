# Configuration Reference

**Status**: Authoritative  
**Last Updated**: 2025-10-04  
**Purpose**: Complete reference for all environment variables and configuration options.

---

## Environment Variables

All configuration is done via environment variables, loaded from `.env` file.

### Quick Start

```bash
# Copy example
cp .env.example .env

# Generate required keys
python -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())" >> .env
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))" >> .env

# Edit other values
vim .env
```

---

## Core Settings

### Database

#### `DATABASE_URL` (required)

**Description**: Database connection string  
**Format**: SQLAlchemy URL format  
**Development**: `sqlite+aiosqlite:///soonish.db`  
**Production**: `postgresql+asyncpg://user:pass@host:5432/soonish`

```bash
# Development (SQLite)
DATABASE_URL=sqlite+aiosqlite:///soonish.db

# Production (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://soonish:password@localhost:5432/soonish
```

**Notes**:
- SQLite is fine for development and small deployments (<1k events)
- PostgreSQL recommended for production
- Must use async drivers (`aiosqlite` or `asyncpg`)

---

### Security

#### `ENCRYPTION_KEY` (required)

**Description**: Fernet encryption key for sensitive data (Apprise URLs)  
**Format**: Base64-encoded 32-byte key  
**Generate**: 
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Example**: `ENCRYPTION_KEY=abc123def456...`

**⚠️ Security Notes**:
- **NEVER commit this to git**
- **Rotate periodically** (requires re-encrypting data)
- **Use different keys** for dev/staging/production
- If lost, encrypted Apprise URLs are unrecoverable

---

#### `SECRET_KEY` (required)

**Description**: Secret key for JWT token signing and session encryption  
**Format**: URL-safe random string  
**Generate**:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Example**: `SECRET_KEY=xyz789abc123...`

**⚠️ Security Notes**:
- **NEVER commit this to git**
- Changing this invalidates all existing JWT tokens
- Use different keys for dev/staging/production

---

### Temporal

#### `TEMPORAL_URL` (required)

**Description**: Temporal server address  
**Development**: `localhost:7233`  
**Production**: `temporal.example.com:7233`

```bash
# Local development
TEMPORAL_URL=localhost:7233

# Production (custom host)
TEMPORAL_URL=ghost:7233

# Temporal Cloud
TEMPORAL_URL=namespace.tmprl.cloud:7233
```

---

#### `TEMPORAL_NAMESPACE` (optional)

**Description**: Temporal namespace to use  
**Default**: `default`  
**Production**: `soonish-prod`

```bash
TEMPORAL_NAMESPACE=default
```

**Notes**:
- Local dev server only has `default` namespace
- Production can have multiple namespaces for isolation

---

#### `TEMPORAL_TASK_QUEUE` (optional)

**Description**: Task queue name for workers  
**Default**: `soonish-task-queue`  

```bash
TEMPORAL_TASK_QUEUE=soonish-task-queue
```

**Scaling Options**:
```bash
# Single queue (default)
TEMPORAL_TASK_QUEUE=soonish-task-queue

# Split queues for scaling
TEMPORAL_WORKFLOW_QUEUE=soonish-workflows
TEMPORAL_ACTIVITY_QUEUE=soonish-activities
```

---

### API Settings

#### `DEBUG` (optional)

**Description**: Enable debug mode  
**Default**: `false`  
**Values**: `true`, `false`, `1`, `0`

```bash
# Development
DEBUG=true

# Production
DEBUG=false
```

**Effects when enabled**:
- Detailed error messages in API responses
- SQLAlchemy query logging
- CORS allows all origins
- Auto-reload on code changes (if using `--reload`)

---

#### `API_HOST` (optional)

**Description**: API server host  
**Default**: `0.0.0.0` (all interfaces)

```bash
API_HOST=0.0.0.0
```

---

#### `API_PORT` (optional)

**Description**: API server port  
**Default**: `8000`

```bash
API_PORT=8000
```

---

#### `CORS_ORIGINS` (optional)

**Description**: Allowed CORS origins (comma-separated)  
**Default**: `*` if DEBUG=true, else none

```bash
# Development (allow all)
CORS_ORIGINS=*

# Production (specific origins)
CORS_ORIGINS=https://app.soonish.com,https://soonish.com
```

---

### Apprise

#### `APPRISE_API_URL` (optional)

**Description**: Apprise API endpoint  
**Default**: `http://localhost:8000/notify`

```bash
# Local Apprise server
APPRISE_API_URL=http://localhost:8000/notify

# Self-hosted Apprise
APPRISE_API_URL=https://apprise.example.com/notify

# Note: Most setups call Apprise library directly, not via API
```

**Note**: By default, Soonish uses the Apprise Python library directly, not an external API. This setting is only needed if you run a separate Apprise API server.

---

### Email (SMTP)

Optional - only needed for email verification and password reset.

#### `SMTP_HOST` (optional)

**Description**: SMTP server hostname

```bash
SMTP_HOST=smtp.gmail.com
```

---

#### `SMTP_PORT` (optional)

**Description**: SMTP server port  
**Default**: `587`

```bash
SMTP_PORT=587
```

---

#### `SMTP_USER` (optional)

**Description**: SMTP username

```bash
SMTP_USER=no-reply@soonish.com
```

---

#### `SMTP_PASSWORD` (optional)

**Description**: SMTP password

```bash
SMTP_PASSWORD=your-app-password
```

---

#### `SMTP_FROM_EMAIL` (optional)

**Description**: From address for outgoing emails  
**Default**: `SMTP_USER`

```bash
SMTP_FROM_EMAIL=Soonish <no-reply@soonish.com>
```

---

#### `SMTP_USE_TLS` (optional)

**Description**: Use TLS for SMTP  
**Default**: `true`

```bash
SMTP_USE_TLS=true
```

---

## Example .env Files

### Development

```bash
# .env.development

# Database
DATABASE_URL=sqlite+aiosqlite:///soonish.db

# Security (generate your own!)
ENCRYPTION_KEY=your-encryption-key-here
SECRET_KEY=your-secret-key-here

# Temporal (local dev server)
TEMPORAL_URL=localhost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soonish-task-queue

# API
DEBUG=true
API_HOST=0.0.0.0
API_PORT=8000

# SMTP (optional - for testing email features)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASSWORD=your-mailtrap-password
```

---

### Production

```bash
# .env.production

# Database (PostgreSQL)
DATABASE_URL=postgresql+asyncpg://soonish:${DB_PASSWORD}@db.example.com:5432/soonish

# Security (NEVER commit these!)
ENCRYPTION_KEY=${ENCRYPTION_KEY_FROM_SECRETS_MANAGER}
SECRET_KEY=${SECRET_KEY_FROM_SECRETS_MANAGER}

# Temporal (production cluster)
TEMPORAL_URL=temporal.example.com:7233
TEMPORAL_NAMESPACE=soonish-prod
TEMPORAL_TASK_QUEUE=soonish-task-queue

# API
DEBUG=false
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=https://app.soonish.com,https://soonish.com

# SMTP (production email)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=${SENDGRID_API_KEY}
SMTP_FROM_EMAIL=Soonish <hello@soonish.com>
```

---

## Configuration in Code

### Loading Settings

```python
# src/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # All environment variables
    database_url: str
    encryption_key: str
    secret_key: str
    # ... etc
    
    model_config = {
        "env_file": ".env"
    }

# Singleton pattern
_settings = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
```

### Using Settings

```python
from src.config import get_settings

settings = get_settings()
print(settings.database_url)
```

---

## Environment-Specific Configurations

### Using Multiple .env Files

```bash
# Different files for different environments
.env.development
.env.staging
.env.production
```

Load specific file:

```bash
# Development
ln -sf .env.development .env
uvicorn src.api.main:app --reload

# Production
ln -sf .env.production .env
uvicorn src.api.main:app
```

Or use environment variable:

```bash
# Override .env file location
ENV_FILE=.env.production uvicorn src.api.main:app
```

---

## Validation

Settings are validated on startup using Pydantic. Missing required fields will raise an error:

```python
# src/config.py
class Settings(BaseSettings):
    # Required field - will raise ValidationError if missing
    encryption_key: str
    
    # Optional field with default
    debug: bool = False
    
    # Custom validation
    @validator('database_url')
    def validate_database_url(cls, v):
        if not v.startswith('sqlite') and not v.startswith('postgresql'):
            raise ValueError('DATABASE_URL must be SQLite or PostgreSQL')
        return v
```

Startup error example:

```
pydantic.error_wrappers.ValidationError: 1 validation error for Settings
encryption_key
  field required (type=value_error.missing)
```

---

## Secrets Management

### Development

Store secrets in `.env` file (gitignored).

### Production

**Don't use .env files in production!** Use a secrets manager:

#### Option 1: Environment Variables (Docker/K8s)

```yaml
# docker-compose.yml
environment:
  - DATABASE_URL=${DATABASE_URL}
  - ENCRYPTION_KEY=${ENCRYPTION_KEY}
  - SECRET_KEY=${SECRET_KEY}
```

#### Option 2: AWS Secrets Manager

```python
import boto3
import json

def get_secrets():
    client = boto3.client('secretsmanager')
    secret = client.get_secret_value(SecretId='soonish/prod')
    return json.loads(secret['SecretString'])

# In config.py __init__
if os.getenv('USE_AWS_SECRETS'):
    secrets = get_secrets()
    self.encryption_key = secrets['encryption_key']
    self.secret_key = secrets['secret_key']
```

#### Option 3: HashiCorp Vault

```python
import hvac

def get_secrets():
    client = hvac.Client(url='https://vault.example.com')
    client.token = os.getenv('VAULT_TOKEN')
    return client.secrets.kv.v2.read_secret_version(
        path='soonish/prod'
    )['data']['data']
```

---

## Health Checks

Settings can be exposed via health endpoint (excluding secrets):

```python
@app.get("/health")
async def health():
    settings = get_settings()
    return {
        "database": "connected" if await check_db() else "disconnected",
        "temporal": {
            "url": settings.temporal_url,
            "namespace": settings.temporal_namespace
        },
        "config": {
            "debug": settings.debug,
            "version": "0.1.0"
        }
    }
```

**Never expose**:
- `encryption_key`
- `secret_key`
- `smtp_password`
- Any passwords or API keys

---

## Troubleshooting

### Settings Not Loading

**Problem**: Environment variables not recognized

**Solutions**:
1. Check `.env` file exists in project root
2. Check `.env` is not gitignored (add `.env.example` instead)
3. Restart the application (changes require restart)
4. Check for typos in variable names

```bash
# Debug what's loaded
python -c "from src.config import get_settings; import pprint; pprint.pprint(get_settings().dict())"
```

---

### Key Generation Errors

**Problem**: `cryptography` not installed

**Solution**:
```bash
uv pip install cryptography
```

**Problem**: Invalid Fernet key

**Solution**: Regenerate key:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

---

### Database Connection Errors

**Problem**: Can't connect to database

**Solutions**:

**SQLite**:
- Check file path is correct
- Check directory exists and is writable
- Check file permissions

**PostgreSQL**:
- Check host/port are correct
- Check credentials
- Check database exists
- Check network connectivity
- Test with psql: `psql $DATABASE_URL`

---

## Summary

**Required variables**:
- `ENCRYPTION_KEY` - For encrypting Apprise URLs
- `SECRET_KEY` - For JWT tokens
- `TEMPORAL_URL` - Temporal server address

**Optional but recommended**:
- `DATABASE_URL` - Defaults to SQLite
- `DEBUG` - Defaults to false
- `TEMPORAL_TASK_QUEUE` - Defaults to `soonish-task-queue`

**Generate keys**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Never commit**:
- `.env` (add to `.gitignore`)
- Any files with real keys/passwords

**Always commit**:
- `.env.example` (with placeholder values)
