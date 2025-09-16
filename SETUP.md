# Soonish - Minimal Working Temporal Project Setup

A notification-first event coordination service built on Temporal.io workflows with Apprise integration.

## Quick Start

### 1. Environment Setup

```bash
# Create and activate virtual environment
uv venv
source .venv/bin/activate

# Install dependencies
uv pip install -e .
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```bash
# Temporal Configuration
TEMPORAL_URL=ghost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soonish-task-queue

# Security
SECRET_KEY=your-secret-key-here

# Development
DEBUG=true
TEST_EMAIL=test@example.com

# Optional: SMTP for email fallback
# SMTP_SERVER=smtp.example.com
# SMTP_USERNAME=user
# SMTP_PASSWORD=pass
# SMTP_FROM=sender@example.com
```

### 3. Start Temporal Server

Ensure Temporal server is running at `ghost:7233`:

```bash
# If using Temporal development server
temporal server start-dev

# Or connect to existing Temporal cluster
```

### 4. Start the Worker

```bash
python -m src.worker.main
```

### 5. Run Demo

In a separate terminal:

```bash
python demo_full_lifecycle.py
```

## Project Structure

```
src/
├── activities/
│   └── notifications.py    # Temporal activities for notifications
├── workflows/
│   └── event.py            # EventWorkflow with lifecycle management
├── worker/
│   └── main.py             # Worker configuration and registration
├── models.py               # Pydantic data models
└── config.py               # Environment configuration

demo_full_lifecycle.py      # Demo script for testing
```

## Key Features Implemented

### Core Components
- **Data Models**: Comprehensive Pydantic models with security-first design
- **Temporal Activities**: Notification handling with partial failure resilience
- **EventWorkflow**: Complete event lifecycle with scheduling and signals
- **Worker Configuration**: Production-ready Temporal worker setup
- **Environment Config**: Security-focused configuration with validation

### Workflow Features
- **Scheduled Reminders**: 24h, 1h, and 15min before events
- **Real-time Updates**: Event updates via Temporal signals
- **Participant Management**: Add/remove participants with notifications
- **Manual Notifications**: Custom notifications from organizers
- **Partial Failure Handling**: Resilient notification delivery

### Security Considerations
- Environment variable configuration
- Encryption field placeholders for future expansion
- No secrets in code or logs
- Production-ready settings

## Testing the Implementation

The demo script demonstrates:

1. **Event Creation**: Creates a test event and starts the workflow
2. **Participant Addition**: Adds a participant and sends welcome notification
3. **Manual Notifications**: Sends custom notifications
4. **Event Updates**: Updates event details and notifies participants

## Next Steps

This minimal working implementation is ready for:

1. **Database Integration**: Replace mock data with actual database queries
2. **FastAPI REST API**: Add HTTP endpoints for event management
3. **Frontend UI**: HTMX + Alpine.js interface
4. **Production Deployment**: PostgreSQL migration and scaling

## Monitoring

- Check Temporal Web UI for workflow execution
- Monitor worker logs for activity execution
- Verify notification delivery through Apprise

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `TEMPORAL_URL` | `ghost:7233` | Temporal server URL |
| `TEMPORAL_NAMESPACE` | `default` | Temporal namespace |
| `TEMPORAL_TASK_QUEUE` | `soonish-task-queue` | Task queue name |
| `SECRET_KEY` | `dev-secret-key...` | Encryption/signing key |
| `DEBUG` | `true` | Debug mode flag |
| `TEST_EMAIL` | `test@example.com` | Test email address |

## Architecture

The system follows async-first principles with:
- **Temporal.io** for durable workflow execution
- **Apprise** for multi-channel notifications
- **Pydantic** for data validation and settings
- **Environment-driven** configuration
- **Security-first** design patterns

This implementation provides a solid foundation for the full Soonish notification service as specified in the documentation.
