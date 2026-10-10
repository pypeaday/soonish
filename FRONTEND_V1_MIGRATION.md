# Frontend API v1 Migration

## Summary
Both frontend applications have been updated to use the new `/api/v1` endpoints.

## Changes Made

### IT Team Alerts Frontend (`frontend-it-team-alerts`)

**File:** `src/api/client.ts`

#### Authentication Endpoints
- ✅ `/api/auth/register` → `/api/v1/auth/register`
- ✅ `/api/auth/login` → `/api/v1/auth/login`
- ✅ `/api/auth/logout` → `/api/v1/auth/logout`
- ✅ `/api/users/me` → `/api/v1/users/me`

#### Event Endpoints
- ✅ `/api/events/my` → `/api/v1/events/my`
- ✅ `/api/events/{id}` → `/api/v1/events/{id}`
- ✅ `/api/events` → `/api/v1/events`
- ✅ `/api/events/{id}/subscribe` → `/api/v1/subscriptions` (with `event_id` in body)

#### Channel Endpoints
- ✅ `/api/channels` → `/api/v1/channels`
- ✅ `/api/channels/{id}` → `/api/v1/channels/{id}`

#### Organization Endpoints
- ✅ `/api/organizations/user/memberships` → `/api/v1/users/me/organizations`
- ✅ `/api/organizations` → `/api/v1/organizations`
- ✅ `/api/organizations/{id}` → `/api/v1/organizations/{id}`
- ✅ `/api/organizations/{id}/members` → `/api/v1/organizations/{id}/members`
- ✅ `/api/organizations/{id}/events` → `/api/v1/organizations/{id}/events`

#### Billing Endpoints
- ✅ `/api/billing/*` → `/api/v1/billing/*`

#### API Token Endpoints
- ✅ `/api/users/tokens` → `/api/v1/users/me/tokens`

---

### Event Planner Frontend (`frontend-event-planner`)

**File:** `src/services/api.ts`

#### Authentication Endpoints
- ✅ `/api/auth/login` → `/api/v1/auth/login`
- ✅ `/api/auth/logout` → `/api/v1/auth/logout`
- ✅ `/api/users/me` → `/api/v1/users/me`

#### Event Endpoints
- ✅ `/api/events/public` → `/api/v1/events/public`
- ✅ `/api/events` → `/api/v1/events`
- ✅ `/api/events/my` → `/api/v1/events/my`
- ✅ `/api/events/{id}` → `/api/v1/events/{id}`
- ✅ `/api/events/{id}/subscribe` → `/api/v1/subscriptions` (with `event_id` in body)

#### Channel Endpoints
- ✅ `/api/channels` → `/api/v1/channels`
- ✅ `/api/channels/{id}` → `/api/v1/channels/{id}`

#### Organization Endpoints
- ✅ `/api/organizations/user/memberships` → `/api/v1/users/me/organizations`
- ✅ `/api/organizations` → `/api/v1/organizations`
- ✅ `/api/organizations/{id}` → `/api/v1/organizations/{id}`
- ✅ `/api/organizations/{id}/members` → `/api/v1/organizations/{id}/members`
- ✅ `/api/organizations/{id}/events` → `/api/v1/organizations/{id}/events`
- ✅ `/api/organizations/public` → `/api/v1/organizations/public`
- ✅ `/api/organizations/public/{slug}` → `/api/v1/organizations/public/{slug}`
- ✅ `/api/organizations/public/{slug}/events` → `/api/v1/organizations/public/{slug}/events`

---

## Key Changes

### 1. Subscription Endpoint Change
**Old:**
```typescript
await client.post(`/api/events/${eventId}/subscribe`, request)
```

**New:**
```typescript
await client.post('/api/v1/subscriptions', {
  event_id: eventId,
  ...request
})
```

### 2. User Organizations Endpoint
**Old:**
```typescript
await client.get('/api/organizations/user/memberships')
```

**New:**
```typescript
await client.get('/api/v1/users/me/organizations')
```

### 3. API Token Endpoints
**Old:**
```typescript
await client.get('/api/users/tokens')
```

**New:**
```typescript
await client.get('/api/v1/users/me/tokens')
```

---

## Testing Checklist

### IT Team Alerts
- [ ] Login/logout flow
- [ ] Create incident
- [ ] View incident details
- [ ] Subscribe to incident
- [ ] Resolve incident
- [ ] Organization management
- [ ] Channel configuration
- [ ] Billing/subscription management

### Event Planner
- [ ] Login/logout flow
- [ ] Browse public events
- [ ] Create event
- [ ] Subscribe to event
- [ ] Organization management
- [ ] Channel configuration
- [ ] Public organization pages

---

## Notes

- All endpoints now use the `/api/v1` prefix for consistency
- The subscription endpoint has been unified under `/api/v1/subscriptions`
- User-specific endpoints are now under `/api/v1/users/me/*`
- No breaking changes to request/response schemas
- Both frontends should work seamlessly with the updated backend

---

## Related Files

- Backend: `/home/nic/projects/personal/soonish/backend/CHANGELOG.md`
- Backend: `/home/nic/projects/personal/soonish/backend/docs/api-v1-migration-summary.md`
