# Soonish Notification System — Technical Specification

## System Overview

Soonish is a notification-first event coordination service built on Temporal.io workflows. The system enables event organizers to create events and automatically notify subscribers through their preferred communication channels without requiring subscribers to install specific applications or create accounts.

### Core Architecture

- **Backend**: FastAPI with async Python
- **Workflow Engine**: Temporal.io for event lifecycle management
- **Database**: SQLite (production-ready for PostgreSQL migration)
- **Notifications**: Apprise library for multi-platform delivery
- **Frontend**: HTMX + Alpine.js for reactive UI
- **Configuration**: Environment-based with Pydantic BaseSettings

---

## Data Models

### User Management
```python
class User(BaseModel):
    id: int
    email: str
    is_verified: bool = False
    created_at: datetime
```

### Event System
```python
class Event(BaseModel):
    id: int
    owner_user_id: int
    name: str
    start_date: datetime
    end_date: Optional[datetime]
    temporal_workflow_id: str
    is_public: bool = True
    created_at: datetime

class Subscription(BaseModel):
    id: int
    event_id: int
    user_id: Optional[int]                 # NULL for anonymous subscribers
    integration_id: int                    # subscription targets a single user integration
    created_at: datetime

class EventUpdate(BaseModel):
    id: int
    event_id: int
    category: str                          # e.g., general, schedule_change
    title: str
    body: str
    created_at: datetime
```

### Integration System
```python
class Integration(BaseModel):
    id: int
    user_id: int
    name: str                # human-readable label (defaults to integration name)
    apprise_url: str         # encrypted at rest (Apprise-compatible URL)
    tag: str                 # case-insensitive, per-user tag (one tag per row)
    is_active: bool = True
    created_at: datetime
    # DB constraint intent: UNIQUE(user_id, apprise_url, tag)
```

---

## Temporal Workflows

### EventWorkflow
Primary workflow managing complete event lifecycle with 30-day timeout.

#### Workflow Execution
```python
@workflow.run
async def run(event_id: int, event_data: Dict[str, Any]) -> str:
    # 1. Send event creation notification
    # 2. Create/maintain Temporal Schedules for ReminderWorkflow(s) (T-1d, T-1h)
    # 3. Listen for signals; finish after event end (cancel reminder schedules)
```

### ReminderWorkflow
Handles scheduled reminder delivery for an event. Instances are started by Temporal Schedules at the configured offsets (T-1d, T-1h).

```python
@workflow.run
async def run(event_id: int, kind: str) -> str:
    # kind: "reminder_1day" | "reminder_1hour"
    # Execute notification activity for this event and reminder kind
    return "ok"
```

#### Workflow Signals
```python
@workflow.signal
async def participant_added(participant_data: Dict[str, Any])
    # Sends welcome notification to new subscription

@workflow.signal  
async def participant_removed(participant_data: Dict[str, Any])
    # Updates subscription count, notifies remaining subscribers

@workflow.signal
async def event_updated(updated_data: Dict[str, Any])
    # Notifies all subscriptions
    # Reschedules reminders if start_date changed

@workflow.signal
async def send_manual_notification(title: str, body: str, subscription_ids: Optional[List[int]] = None)
    # Sends custom notifications to subscriptions (all when subscription_ids omitted)
```

---

## Notification System

### Notification Activity
```python
@activity.defn
async def send_notification(
    event_id: int,
    notification_type: str,
    title: str, 
    body: str,
    subscription_ids: Optional[List[int]] = None,
) -> Dict[str, Any]
```

#### Delivery Semantics (Per-subscription integration)
1. Audience selection:
   - If `subscription_ids` is provided: restrict to those subscriptions.
   - Otherwise: audience = all active subscriptions of the event.
2. Delivery routing per subscription:
   - Load the referenced `integration_id` and ensure it is active.
   - Deliver via the Integration's `apprise_url`.
   - If integration is inactive or missing: mark delivery as `pending`.

#### Supported Integrations (via Apprise)
- **Email**: `mailto://username:password@server/?from=sender&to=recipient`
- **Slack/Discord/SMS/etc.**: Per Apprise URL formats
- **Extensible**: Any Apprise-compatible URL

---

## API Endpoints

### Event Management
```http
POST   /api/events                    # Create new event
GET    /api/events/{id}               # Get event details  
PATCH  /api/events/{id}               # Update event
DELETE /api/events/{id}               # Cancel event
POST   /api/events/{id}/notify        # Send manual notification
```

### Participant (Subscription) Management
```http
POST   /api/events/{id}/subscribe                      # Create subscription (anonymous or authenticated)
DELETE /api/events/{id}/subscriptions/{subscription_id} # Remove subscription (owner only)
POST   /api/unsubscribe                                 # One-click unsubscribe (tokenized)
```

#### Subscribe Request Body (JSON)
```json
{
  "integration_id": 42
}
```

Note: Each subscription targets exactly one user integration via `integration_id`.

### Integration Management
```http
GET    /api/integrations              # List user integrations
POST   /api/integrations              # Add integration
PATCH  /api/integrations/{id}         # Update integration
DELETE /api/integrations/{id}         # Remove integration
POST   /api/integrations/{id}/test    # Test integration
```

### User Management
```http
GET    /api/users/me                  # Current user profile
PATCH  /api/users/me                  # Update profile
POST   /api/auth/login                # Authenticate user
POST   /api/auth/logout               # End session
```

---

## Configuration Management

### Environment Variables
```bash
# Database
DATABASE_URL=sqlite+aiosqlite:///./soonish.db

# Temporal
TEMPORAL_URL=ghost:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=soonish-task-queue

# Security
SECRET_KEY=your-secret-key-here

# Development Defaults
TEST_EMAIL=test@example.com
# Optional SMTP for anonymous mailto fallback
SMTP_SERVER=smtp.example.com
SMTP_USERNAME=user
SMTP_PASSWORD=pass
SMTP_FROM=sender@example.com
```

### Pydantic Configuration
```python
class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./soonish.db"
    temporal_url: str = "ghost:7233"
    temporal_namespace: str = "default"
    temporal_task_queue: str = "soonish-task-queue"
    secret_key: str = "dev-secret-key"
    test_email: str = "test@example.com"
    smtp_server: Optional[str] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    
    class Config:
        env_file = ".env"
```

---

## Management Scripts

### Event Operations
```bash
# Create event with workflow
python scripts/create_event.py

# Update event and notify participants  
# Update event and notify subscribers  
python scripts/update_event.py <event_id> [new_name]

# List all subscribers
python scripts/list_subscribers.py <event_id>
```

### Subscription Operations
```bash
# Add subscriber with notification preferences
python scripts/add_subscriber.py <event_id> [email] [tags]

# Remove subscriber and signal workflow
python scripts/remove_subscriber.py <event_id> [email]
```

### Integration Operations
```bash
# Add notification integration
python scripts/add_integration.py <user_id> [type] [tags]

# Test notification delivery
python scripts/test_notification.py
```

---

## Notification Flow

### Event Creation Flow
1. User creates event via API
2. Event stored in database with generated ID
3. Temporal EventWorkflow started with event data
4. Workflow ID stored in event record
5. Initial creation notification sent to organizer

### Subscription Flow  
1. Participant subscribes via public event link
2. Subscription record created linking the event to a user `integration_id`
3. Workflow signaled with `participant_added`
4. Welcome notification sent to new subscriber
5. Subscription count updated in workflow state

### Event Update Flow
1. Organizer updates event via API
2. Event record updated in database
3. Workflow signaled with `event_updated`
4. All subscribers notified
5. Reminders rescheduled if start_date changed

### Scheduled Reminder Flow
1. Temporal Schedule triggers a ReminderWorkflow at reminder time (1 day, 1 hour before)
2. ReminderWorkflow executes the notification activity
3. All subscriptions delivered
4. Delivery status logged for monitoring

---

## Security Considerations

### Data Protection
- Integration URLs encrypted at rest
- API keys stored in environment variables only
- Database designed for field-level encryption expansion
- No sensitive data in logs or error messages

### Access Control
- Event organizers control subscriber notifications
- Subscribers control their own integration preferences
- Public events allow anonymous subscription
- Private events require explicit approval

### Production Readiness
- PostgreSQL migration path established
- Rate limiting for notification activities
- Retry policies for failed deliveries
- Comprehensive error logging and monitoring

---

## Performance Characteristics

### Scalability Targets
- **Events**: 10,000+ concurrent events
- **Subscriptions**: 100,000+ total subscriptions
- **Notifications**: 1,000+ notifications/minute
- **Workflow Duration**: 30-day maximum per event

### Resource Requirements
- **Database**: SQLite for development, PostgreSQL for production
- **Temporal**: Dedicated cluster recommended for production
- **Memory**: 512MB minimum, 2GB recommended
- **Storage**: 10GB minimum for logs and database

---

## Monitoring & Observability

### Key Metrics
- Notification delivery success rate
- Workflow execution duration
- Database query performance
- Integration failure rates

### Logging Strategy
- Structured JSON logging
- Temporal workflow history
- Activity execution traces
- Integration delivery status

### Health Checks
- Database connectivity
- Temporal cluster status
- Integration endpoint availability
- Notification delivery testing

---

## Development Workflow

### Local Development
1. Clone repository and install dependencies via `uv`
2. Configure `.env` file with local settings
3. Start Temporal development server
4. Run database migrations
5. Execute management scripts for testing

### Testing Strategy
- Unit tests for all activities and workflows
- Integration tests for notification delivery
- End-to-end tests via management scripts
- Load testing for notification throughput

### Deployment Pipeline
1. Code validation and testing
2. Database migration execution
3. Temporal workflow deployment
4. API service deployment
5. Health check verification

---

## Future Enhancements

### Phase 1 Extensions
- Additional integration types (Slack, Discord, SMS)
- Recurring event support
- Advanced subscription management
- Notification scheduling controls

### Phase 2 Features
- Multi-tenant organization support
- Advanced analytics and reporting
- Webhook support for external systems
- Mobile application development

### Phase 3 Capabilities
- AI-powered notification optimization
- Advanced workflow templates
- Enterprise SSO integration
- Global deployment and CDN support
