# Source Field Synchronization

## Overview
Synchronized the `source` field across the backend dev data script and both frontends to ensure proper data isolation between applications.

## Source Values

| Frontend | Source Value | Description |
|----------|-------------|-------------|
| Event Planner | `notifiq-event-planner` | Professional event planning frontend |
| IT Team Alerts | `notifiq-it-console` | PagerDuty-style incident management |
| LOTR (future) | `lotr-themed` | Fantasy-themed events (no frontend yet) |

## Backend Changes

### Dev Data Script (`backend/scripts/setup_dev_data.py`)

**Source assignments:**
- LOTR events: `source="lotr-themed"`
- Event planner events: `source="notifiq-event-planner"`
- IT console incidents: `source="notifiq-it-console"`

**Organizations:**
- Digital Harbor → Event planner events
- Middle-earth Events Co → LOTR events
- IT Operations Team → IT console incidents

## Frontend Changes

### Event Planner (`frontend-event-planner`)

**Files Modified:**
1. `src/pages/Discover.tsx`
   - Added source filter to public events query: `source: 'notifiq-event-planner'`

2. `src/pages/CreateEvent.tsx`
   - Added source field when creating events: `source: 'notifiq-event-planner'`

3. `src/types/api.ts`
   - Added `source?: string | null` to `EventCreateRequest` interface

**API Calls:**
```typescript
// Fetching events
usePublicEvents({ limit: 12, source: 'notifiq-event-planner' })

// Creating events
api.createEvent({
  ...eventData,
  source: 'notifiq-event-planner'
})
```

### IT Team Alerts (`frontend-it-team-alerts`)

**Files Modified:**
1. `src/api/client.ts`
   - Added source filter to `listMyEvents()`: `params: { source: 'notifiq-it-console' }`

2. `src/pages/CreateIncidentPage.tsx`
   - Added source field when creating incidents: `source: 'notifiq-it-console'`

3. `src/types/api.ts`
   - Added `source?: string` to `EventCreateRequest` interface

**API Calls:**
```typescript
// Fetching incidents
await this.client.get('/api/v1/events/my', {
  params: { source: 'notifiq-it-console' }
})

// Creating incidents
apiClient.createEvent({
  ...incidentData,
  source: 'notifiq-it-console'
})
```

## Data Isolation

### How It Works

1. **Backend Populates All Data**
   - The `setup_dev_data.py` script creates events for all frontends
   - Each event is tagged with its appropriate `source` value
   - All events exist in the same database

2. **Frontends Filter by Source**
   - Event Planner only sees `source='notifiq-event-planner'` events
   - IT Console only sees `source='notifiq-it-console'` events
   - Each frontend creates events with its own source value

3. **API Query Parameters**
   - `GET /api/v1/events/my?source=notifiq-event-planner`
   - `GET /api/v1/events/public?source=notifiq-it-console`
   - Backend filters results based on the `source` parameter

## Testing

### Verify Event Planner
```bash
# Should only show event planner events
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/events/my?source=notifiq-event-planner"
```

### Verify IT Console
```bash
# Should only show IT console incidents
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/events/my?source=notifiq-it-console"
```

### Verify Data Isolation
```bash
# Run dev data script
cd backend
uv run python scripts/setup_dev_data.py

# Check event counts by source
sqlite3 backend/soonish.db "SELECT source, COUNT(*) FROM events GROUP BY source;"
```

Expected output:
```
lotr-themed|10
notifiq-event-planner|5
notifiq-it-console|5
```

## Benefits

1. **Single Backend** - One API serves multiple frontends
2. **Data Isolation** - Each frontend only sees its own events
3. **Shared Infrastructure** - Users, organizations, channels are shared
4. **Easy Testing** - One script populates data for all frontends
5. **Scalable** - Easy to add new frontends with different sources

## Future Considerations

- Add source validation in backend to prevent typos
- Consider enum for source values in TypeScript
- Add source field to event response type for better type safety
- Document source values in API specification
