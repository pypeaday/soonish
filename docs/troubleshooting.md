# Troubleshooting Guide

## Temporal Workflow Issues

### Import Restrictions in Workflows

**Problem**: Temporal's workflow sandbox restricts certain imports that use non-deterministic operations.

**Error Example**:
```
RestrictedWorkflowAccessError: Cannot access gettext.translation.__call__ from inside a workflow. 
If this is code from a module not used in a workflow or known to only be used deterministically 
from a workflow, mark the import as pass through.
```

**Root Cause**: 
- Importing `apprise` directly in workflow files triggers sandbox restrictions
- Apprise uses `gettext.translation` for internationalization, which is non-deterministic
- Temporal workflows must be deterministic for replay consistency

**Solution**:
1. **Remove direct imports** from workflow files:
   ```python
   # ❌ Don't do this in workflows
   from ..activities.notifications import send_notification
   ```

2. **Use string-based activity references**:
   ```python
   # ✅ Do this instead
   await workflow.execute_activity(
       "send_notification",
       args=[event_id, "creation", title, body, tags],
       schedule_to_close_timeout=timedelta(minutes=5)
   )
   ```

3. **Keep external library imports in activities only**:
   - Activities can import any library (apprise, requests, etc.)
   - Workflows should only import Temporal SDK and standard library

### Timezone Comparison Issues

**Problem**: Comparing offset-naive and offset-aware datetimes in workflows.

**Error Example**:
```
TypeError: can't compare offset-naive and offset-aware datetimes
```

**Root Cause**:
- `workflow.now()` returns timezone-aware datetime
- Database datetimes are often timezone-naive
- Direct comparison fails between different timezone representations

**Solution**:
```python
# Parse datetime from database/input
start_date = datetime.fromisoformat(event_data['start_date'])

# Ensure timezone consistency before comparison
if start_date.tzinfo is None:
    start_date = start_date.replace(tzinfo=workflow.now().tzinfo)

# Now safe to compare
if start_date > workflow.now():
    # Schedule reminder logic
```

**Best Practices**:
1. Always normalize timezones before datetime comparisons
2. Use `workflow.now()` for current time in workflows (not `datetime.now()`)
3. Store datetimes with explicit timezone information when possible

## Database Issues

### SQLAlchemy Async Session Management

**Problem**: Improper session handling can cause connection leaks or transaction issues.

**Solution**:
```python
async with AsyncSessionLocal() as session:
    try:
        # Database operations
        result = await session.execute(query)
        await session.commit()
    finally:
        await session.close()  # Handled by context manager
```

## Development Workflow

### Virtual Environment Setup

**Problem**: Dependencies not found when running scripts.

**Solution**:
```bash
# Ensure virtual environment is activated
source .venv/bin/activate

# Verify correct Python path
which python  # Should show .venv/bin/python

# Install dependencies
uv pip install -e .
```

### Testing Temporal Workflows

**Recommended Testing Order**:
1. Start Temporal worker: `python -m src.worker.main`
2. Create test event: `python scripts/create_event.py "Test Event"`
3. Add subscribers: `python scripts/add_subscriber.py 1 "user@example.com" "general"`
4. Test notifications: `python scripts/test_notification.py`

## Common Patterns

### Workflow Signal Handling

```python
@workflow.signal
async def participant_added(self, participant_data: Dict[str, Any]):
    # Always use string-based activity calls
    await workflow.execute_activity(
        "send_notification",
        args=[self.event_id, "participant_added", title, body, tags],
        schedule_to_close_timeout=timedelta(minutes=5),
        retry_policy=RetryPolicy(maximum_attempts=3)
    )
```

### Activity Implementation

```python
@activity.defn
async def send_notification(event_id: int, notification_type: str, ...):
    # Activities can import external libraries safely
    import apprise
    
    # Handle database operations
    async with AsyncSessionLocal() as session:
        # Implementation
        pass
```

## Security Considerations

### Environment Variables

- Never hardcode sensitive values in code
- Use `.env` files for local development
- Validate required environment variables on startup

### Database Security

- SQLite for development, PostgreSQL for production
- Design models for future field encryption
- Use parameterized queries (SQLAlchemy handles this)

### Notification Security

- Store Apprise URLs encrypted in production
- Validate notification targets
- Implement rate limiting for notification activities
