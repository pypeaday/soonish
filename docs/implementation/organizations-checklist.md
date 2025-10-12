# Organizations Implementation Checklist

**Model**: Tag-based auto-subscription  
**Approach**: Wipe DB and recreate (no migrations)  
**Estimated**: ~390 lines of code, 2-3 days

---

## Phase 1: Database Models (~1-2 hours)

### Step 1: Add Organization Model
- [ ] Add `Organization` model to `src/db/models.py`
  - Fields: id, name, slug, description, plan, max_seats, is_active, timestamps
  - Relationships to memberships

### Step 2: Add OrganizationMembership Model
- [ ] Add `OrganizationMembership` model to `src/db/models.py`
  - Fields: id, organization_id, user_id, role, uses_personal_seat, joined_at
  - Relationships to Organization and User

### Step 3: Modify Integration Model
- [ ] Add `organization_id` field to `Integration` model
  - Nullable, foreign key to organizations
  - Index on organization_id
  - Document: exactly one of user_id or organization_id must be set

### Step 4: Modify Event Model
- [ ] Add `organization_id` field to `Event` model
  - Nullable, foreign key to organizations
  - Index on organization_id
- [ ] Add `tags` field to `Event` model
  - Store as JSON array or comma-separated string
  - Index on tags for lookups

### Step 5: Update User Model
- [ ] Add `organization_memberships` relationship to `User` model

### Step 6: Create DB Setup Script
- [ ] Create `scripts/setup_db_with_orgs.py`
  - Drop all tables
  - Recreate all tables
  - Print success message

### Step 7: Test DB Setup
```bash
uv run scripts/setup_db_with_orgs.py
```

---

## Phase 2: Repository Layer (~2-3 hours)

### Step 1: Create OrganizationRepository
- [ ] Create `OrganizationRepository` class in `src/db/repositories.py`

### Step 2: Implement Core Methods
- [ ] `create(name, slug, plan, max_seats)` - Create organization
- [ ] `get_by_id(org_id)` - Get org with relationships
- [ ] `get_by_slug(slug)` - Get org by slug
- [ ] `get_user_organizations(user_id)` - List user's orgs

### Step 3: Implement Membership Methods
- [ ] `add_member(org_id, user_id, role, uses_personal_seat)` - Add member
- [ ] `get_membership(org_id, user_id)` - Get membership
- [ ] `is_admin(org_id, user_id)` - Check admin status
- [ ] `update_member_role(org_id, user_id, role)` - Change role
- [ ] `remove_member(org_id, user_id)` - Remove member
- [ ] `get_member_ids(org_id)` - Get all member user IDs

### Step 4: Implement Seat Management
- [ ] `check_seat_availability(org_id)` - Check if seats available
- [ ] `get_seats_used(org_id)` - Count seats in use

### Step 5: Extend IntegrationRepository
- [ ] `get_by_tag_and_org(tag, org_id)` - Get integrations matching tag for org
- [ ] `create_multiple_tags(user_id, org_id, name, type, url, tags)` - Create one row per tag

### Step 6: Test Repository
- [ ] Create `scripts/test_org_repository.py`
- [ ] Test org CRUD
- [ ] Test membership operations
- [ ] Test tag-based integration queries

---

## Phase 3: Auto-Subscribe Service (~1-2 hours)

### Step 1: Create Auto-Subscribe Service
- [ ] Create `src/api/services/auto_subscribe.py`

### Step 2: Implement Core Functions
- [ ] `create_event_with_auto_subscribe(event_data, org_id, session)` - Create event + auto-subscribe
- [ ] `auto_subscribe_by_tags(event_id, org_id, tags, session)` - Auto-subscribe logic

### Step 3: Test Auto-Subscribe
- [ ] Create `scripts/test_auto_subscribe.py`
- [ ] Test personal integration matching
- [ ] Test org integration matching
- [ ] Test subscription count

---

## Phase 4: API Schemas (~30 min)

### Step 1: Organization Schemas
- [ ] `OrganizationCreate` - Create request
- [ ] `OrganizationResponse` - Basic response
- [ ] `OrganizationDetailResponse` - With members and integrations
- [ ] `OrganizationMemberResponse` - Member info

### Step 2: Membership Schemas
- [ ] `AddMemberRequest` - Add member request
- [ ] `UpdateMemberRoleRequest` - Update role request

### Step 3: Integration Schemas
- [ ] `OrganizationIntegrationCreate` - Create org integration (with tags list)
- [ ] Reuse existing `IntegrationResponse`

### Step 4: Event Schemas
- [ ] Update `EventCreate` to include `tags` field
- [ ] Update `EventResponse` to include `tags` and `auto_subscribed_count`

---

## Phase 5: API Dependencies (~30 min)

### Step 1: Permission Helpers
- [ ] `get_organization_membership(org_id, current_user)` - Verify membership
- [ ] `require_org_admin(org_id, current_user)` - Verify admin

---

## Phase 6: API Routes (~2-3 hours)

### Step 1: Create Organizations Router
- [ ] Create `src/api/routes/organizations.py`
- [ ] `POST /api/organizations` - Create org (user becomes admin)
- [ ] `GET /api/organizations` - List user's orgs
- [ ] `GET /api/organizations/{org_id}` - Get org details

### Step 2: Member Management Routes
- [ ] `POST /api/organizations/{org_id}/members` - Add member (admin only)
- [ ] `PATCH /api/organizations/{org_id}/members/{user_id}` - Update role (admin only)
- [ ] `DELETE /api/organizations/{org_id}/members/{user_id}` - Remove member (admin only)

### Step 3: Integration Management Routes
- [ ] `POST /api/organizations/{org_id}/integrations` - Create org integration (admin only)
- [ ] `GET /api/organizations/{org_id}/integrations` - List org integrations (any member)
- [ ] `DELETE /api/organizations/{org_id}/integrations/{int_id}` - Delete (admin only)

### Step 4: Event Routes
- [ ] `POST /api/organizations/{org_id}/events` - Create org event with auto-subscribe
- [ ] Update existing `POST /api/events` to support tags

### Step 5: Register Router
- [ ] Add `organizations.router` to `src/api/main.py`

---

## Phase 7: Update Event Creation (~1 hour)

### Step 1: Update Event Creation Logic
- [ ] Modify event creation to use `create_event_with_auto_subscribe`
- [ ] Add tags support to event creation
- [ ] Return auto-subscription count in response

### Step 2: Update Integration Creation
- [ ] Modify integration creation to support multiple tags
- [ ] Use `create_multiple_tags` for both personal and org integrations

---

## Phase 8: Testing (~2-3 hours)

### Step 1: Create Comprehensive Test Script
- [ ] Create `scripts/test_organizations_full.py`

### Step 2: Test Scenarios
- [ ] Create org → Add members → Create org integration with tags
- [ ] Engineer creates personal integration with tags
- [ ] Create event with tags → Verify auto-subscribe count
- [ ] Verify engineer's personal integration subscribed
- [ ] Verify org integration subscribed all members
- [ ] Test tag matching logic (partial matches)
- [ ] Test seat limit enforcement
- [ ] Test admin vs member permissions

### Step 3: Manual API Testing
```bash
uv run scripts/test_organizations_api.py
```

---

## Phase 9: Documentation (~30 min)

### Step 1: Update README
- [ ] Add organizations section
- [ ] Document auto-subscribe behavior
- [ ] Document tag-based model
- [ ] Document setup script usage

### Step 2: Update .env.example
- [ ] Add organization-related env vars (if any)

---

## Quick Start Commands

### Wipe and Recreate DB
```bash
uv run scripts/setup_db_with_orgs.py
```

### Test Organizations
```bash
uv run scripts/test_organizations_full.py
```

### Run API Server
```bash
uv run uvicorn src.api.main:app --reload
```

---

## Estimated Timeline

| Phase | Task | Time |
|-------|------|------|
| 1 | Database Models | 1-2 hours |
| 2 | Repository Layer | 2-3 hours |
| 3 | Auto-Subscribe Service | 1-2 hours |
| 4 | API Schemas | 30 min |
| 5 | API Dependencies | 30 min |
| 6 | API Routes | 2-3 hours |
| 7 | Update Event Creation | 1 hour |
| 8 | Testing | 2-3 hours |
| 9 | Documentation | 30 min |
| **Total** | | **11-16 hours** |

**Realistically**: 2-3 days of focused work

---

## Files to Create

### New Files
- `scripts/setup_db_with_orgs.py` - DB setup script
- `scripts/test_organizations_full.py` - Comprehensive test script
- `src/api/routes/organizations.py` - Organizations router
- `src/api/services/auto_subscribe.py` - Auto-subscribe service

### Files to Modify
- `src/db/models.py` - Add Organization, OrganizationMembership, modify Integration and Event
- `src/db/repositories.py` - Add OrganizationRepository, extend IntegrationRepository
- `src/api/schemas.py` - Add organization schemas, update event schemas
- `src/api/dependencies.py` - Add permission helpers
- `src/api/routes/events.py` - Use auto-subscribe service
- `src/api/routes/integrations.py` - Support multiple tags
- `src/api/main.py` - Register organizations router

---

## Code Size Estimate

| Component | Lines |
|-----------|-------|
| Database models | ~60 |
| Repository | ~100 |
| Auto-subscribe service | ~80 |
| API schemas | ~50 |
| API routes | ~150 |
| Test scripts | ~100 |
| **Total** | **~540 lines** |

(Slightly more than estimate due to test scripts)

---

## Development Flow

1. **Start**: Wipe DB and recreate with org support
2. **Implement**: Add models → repositories → auto-subscribe → routes
3. **Test**: Run test scripts after each phase
4. **Iterate**: Wipe DB and test again as needed
5. **No migrations**: Just recreate DB anytime

---

## Key Principles

- ✅ **Tag-based auto-subscribe** - Event tags match integration tags
- ✅ **One tag per row** - Already in current model
- ✅ **Wipe and recreate** - No migration complexity
- ✅ **Test often** - Run test scripts after each change
- ✅ **Minimal code** - Every line necessary
- ✅ **Reuse existing** - Leverage current subscription model

---

## Auto-Subscribe Logic Summary

```python
# Event created with tags ["jira", "critical"]
# 
# For each tag:
#   1. Find personal integrations of org members with this tag
#   2. Find org integrations with this tag
#   3. Create subscriptions:
#      - Personal integration → subscribe that user
#      - Org integration → subscribe all org members
#
# Result: Automatic subscriptions based on tag matches!
```

---

## Ready to Start?

1. Review `docs/specifications/organizations.md`
2. Start with Phase 1 (Database Models)
3. Run `setup_db_with_orgs.py` after each change
4. Test incrementally with test scripts

**Let's build it!** 🚀
