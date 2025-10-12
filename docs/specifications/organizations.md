# Organizations Specification

**Status**: ✅ Final - Auto-Subscribe by Tag Model  
**Last Updated**: 2025-10-11  
**Purpose**: Organizations as billing entities with tag-based auto-subscription

---

## Core Concept

**Tag-based auto-subscription for events - works for personal and organization events.**

Key principles:
1. **Auto-subscribe tags** = Tags with `autosub:` prefix trigger automatic subscriptions
2. **Query-scoped namespacing** = Org events only match org members' tags (no global collision)
3. **Opt-in** = Users choose which tags trigger auto-subscribe
4. **Universal feature** = Works for personal public events and org events
5. **Organization** = Billing entity that provides shared integrations and personal seats

---

## The Killer Use Case

**Engineer who doesn't want Slack on their phone**:

```
Setup:
  1. Company has Notifiq Team plan ($50/month, 20 seats)
  2. Admin creates org Slack integration with tags:
     - "jira" (regular tag, manual subscribe)
     - "autosub:critical" (auto-subscribe to "critical" events)
  3. Engineer joins org (gets personal seat)
  4. Engineer creates personal Gotify integration with tags:
     - "jira" (regular tag, manual subscribe)
     - "autosub:critical" (auto-subscribe to "critical" events)

Event Creation:
  5. Monitoring system creates event via API:
     Event(name="JIRA-123: DB Down", organization_id=5, tags=["jira", "critical"])
  
Auto-Subscribe:
  6. System looks for integrations with "autosub:critical" (event tag "critical"):
     - Org Slack has "autosub:critical" → all org members subscribed
     - Engineer's Gotify has "autosub:critical" → engineer subscribed
  
  Note: "jira" tag does NOT trigger auto-subscribe (no integration with "autosub:jira")
  
Notifications:
  7. Company Slack gets notified
  8. Engineer's Gotify gets notified
  9. Engineer deletes Slack from phone! 🎉
```

**Key**: 
- **Integration tags** have `autosub:` prefix (user's opt-in)
- **Event tags** are plain (no prefix)
- Matching: Event tag `"critical"` → finds integration tag `"autosub:critical"`

---

## Data Model

### New Tables

#### 1. organizations
```sql
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Subscription/billing
    plan VARCHAR(50) NOT NULL DEFAULT 'free',  -- 'free', 'team', 'enterprise'
    max_seats INTEGER NOT NULL DEFAULT 0,
    
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_organizations_slug ON organizations(slug);
```

#### 2. organization_memberships
```sql
CREATE TABLE organization_memberships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organization_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',  -- 'admin' or 'member'
    uses_personal_seat BOOLEAN NOT NULL DEFAULT 1,
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(organization_id, user_id)
);

CREATE INDEX ix_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX ix_org_memberships_user ON organization_memberships(user_id);
```

### Modified Tables

#### 3. integrations (add organization_id)
```sql
-- Add organization ownership
ALTER TABLE integrations ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
CREATE INDEX ix_integrations_organization ON integrations(organization_id);

-- Constraint: exactly one of user_id or organization_id must be set
-- (SQLite doesn't enforce, but document it)
```

**Integration ownership**:
- **Personal**: `user_id` set, `organization_id` NULL
- **Organizational**: `user_id` NULL, `organization_id` set

**One tag per row** (already in current model):
```python
# User wants Gotify for regular and auto-subscribe tags
# Frontend: user enters ["jira", "autosub:critical", "autosub:urgent"]
# Backend: creates 3 rows

Integration(user_id=1, name="My Gotify", tag="jira", apprise_url=...)
Integration(user_id=1, name="My Gotify", tag="autosub:critical", apprise_url=...)
Integration(user_id=1, name="My Gotify", tag="autosub:urgent", apprise_url=...)
```

**Tag types**:
- **Regular tags** (e.g., "jira", "personal"): Manual subscription only
- **Auto-subscribe tags** (e.g., "autosub:critical"): Auto-subscribe when event has tag "critical"

**Matching logic**:
- Event tag: `"critical"` → Finds integration tag: `"autosub:critical"`
- Event tag: `"urgent"` → Finds integration tag: `"autosub:urgent"`
- Event tag: `"jira"` → Does NOT match `"autosub:jira"` (user must have that tag)

#### 4. events (add organization_id and tags)
```sql
-- Add organization association
ALTER TABLE events ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
CREATE INDEX ix_events_organization ON events(organization_id);

-- Add tags for auto-subscribe
ALTER TABLE events ADD COLUMN tags TEXT;  -- JSON array or comma-separated
CREATE INDEX ix_events_tags ON events(tags);  -- For tag lookups
```

**Event tags** (plain, no prefix):
```python
# Event with multiple tags (no autosub: prefix)
Event(
    name="JIRA-123: Database Down",
    organization_id=5,
    tags=["jira", "critical", "database"]  # Plain tags
)

# Auto-subscribe logic will look for:
# - Integrations with tag "autosub:jira"
# - Integrations with tag "autosub:critical"
# - Integrations with tag "autosub:database"
```

---

## Auto-Subscribe Logic

### Tag-Based Auto-Subscribe with `autosub:` Prefix

**Key Rules**:
1. **Integration tags** with `autosub:` prefix opt-in to auto-subscribe (e.g., `"autosub:concerts"`)
2. **Event tags** are plain tags (e.g., `"concerts"`) - no prefix needed
3. **Matching**: Event tag `"concerts"` matches integration tag `"autosub:concerts"`
4. Personal events: Only auto-subscribe if `is_public=True`
5. Org events: Only match integrations owned by org members or org itself (query-scoped)

### On Event Creation

```python
async def create_event_with_auto_subscribe(
    event_data: EventCreate,
    organization_id: int | None = None,
    is_public: bool = False
) -> tuple[Event, int]:
    """
    Create event and auto-subscribe based on autosub: tags.
    
    Returns:
        (event, subscription_count)
    """
    # 1. Create event
    event = await event_repo.create(
        name=event_data.name,
        organization_id=organization_id,
        is_public=is_public,
        tags=event_data.tags,
        ...
    )
    
    # 2. Auto-subscribe based on autosub: tags
    subscription_count = 0
    if event.tags:
        # Personal public events OR org events
        if (organization_id is None and is_public) or organization_id:
            subscription_count = await auto_subscribe_by_tags(
                event.id,
                event.tags,
                organization_id,
                is_public
            )
    
    return event, subscription_count


async def auto_subscribe_by_tags(
    event_id: int,
    event_tags: list[str],
    organization_id: int | None,
    is_public: bool
) -> int:
    """
    Auto-subscribe users based on matching tags.
    
    Logic:
    1. For each event tag (e.g., "concerts")
    2. Look for integrations with "autosub:{tag}" (e.g., "autosub:concerts")
    3. For org events: Find integrations owned by org members or org itself
    4. For personal public events: Find any user's personal integrations
    5. Create subscriptions
    
    Returns:
        Number of subscriptions created
    """
    if not event_tags:
        return 0
    
    subscriptions_created = 0
    
    for event_tag in event_tags:
        # Look for integrations with "autosub:{event_tag}"
        autosub_tag = f"autosub:{event_tag}"
        
        if organization_id:
            # Org event: Find integrations scoped to org members
            matching_integrations = await integration_repo.get_by_tag_and_org(
                tag=autosub_tag,
                organization_id=organization_id
            )
        else:
            # Personal public event: Find any user's personal integrations
            matching_integrations = await integration_repo.get_by_tag_public(autosub_tag)
        
        for integration in matching_integrations:
            if integration.user_id:
                # Personal integration - subscribe that user
                await subscription_repo.create_with_selector(
                    user_id=integration.user_id,
                    event_id=event_id,
                    integration_id=integration.id
                )
                subscriptions_created += 1
            
            elif integration.organization_id:
                # Org integration - subscribe all org members
                org = await org_repo.get_by_id(organization_id)
                for member in org.memberships:
                    await subscription_repo.create_with_selector(
                        user_id=member.user_id,
                        event_id=event_id,
                        integration_id=integration.id
                    )
                    subscriptions_created += 1
    
    return subscriptions_created
```

### Query for Matching Integrations

#### For Organization Events (Query-Scoped)

```python
async def get_by_tag_and_org(
    self,
    tag: str,
    organization_id: int
) -> list[Integration]:
    """
    Get integrations matching tag, scoped to org members + org itself.
    
    This provides natural namespacing:
    - Only returns integrations owned by org members or org
    - Tag "autosub:critical" in Org A won't match Org B members
    
    Returns:
    - Personal integrations of org members with this tag
    - Org integrations with this tag
    """
    # Get org member user IDs
    member_ids = await session.execute(
        select(OrganizationMembership.user_id)
        .where(OrganizationMembership.organization_id == organization_id)
    )
    member_ids = [row[0] for row in member_ids]
    
    # Find matching integrations (scoped to org)
    result = await session.execute(
        select(Integration)
        .where(
            Integration.tag == tag,
            or_(
                Integration.user_id.in_(member_ids),  # Member's personal
                Integration.organization_id == organization_id  # Org's
            )
        )
    )
    
    return result.scalars().all()
```

#### For Personal Public Events

```python
async def get_by_tag_public(
    self,
    tag: str
) -> list[Integration]:
    """
    Get personal integrations matching tag (for public events).
    
    Only returns:
    - Personal integrations (user_id IS NOT NULL)
    - Not org integrations
    """
    result = await session.execute(
        select(Integration)
        .where(
            Integration.tag == tag,
            Integration.user_id.is_not(None),  # Personal only
            Integration.organization_id.is_(None)  # Not org
        )
    )
    
    return result.scalars().all()
```

**Key**: Query scoping provides natural namespacing without storing org prefix in tags.

---

## Tag Namespacing & Collision Prevention

### How Namespacing Works

**Problem**: What if multiple orgs use the same tag name (e.g., "autosub:critical")?

**Solution**: Query-scoped namespacing - tags are scoped by the query context, not stored with prefixes.

### Examples

#### Scenario: Two Orgs with Same Tag

```python
# Org A (id=5) - Acme Corp
Integration(organization_id=5, tag="autosub:critical")  # Acme's Slack

# Org B (id=10) - Beta Inc  
Integration(organization_id=10, tag="autosub:critical")  # Beta's Slack

# Org A member
Integration(user_id=1, tag="autosub:critical")  # Alice's Gotify (member of Org A)

# Org B member
Integration(user_id=2, tag="autosub:critical")  # Bob's Gotify (member of Org B)
```

**Event in Org A**:
```python
Event(organization_id=5, tags=["autosub:critical"])

# Query finds (scoped to Org A):
# - Org A's Slack (organization_id=5)
# - Alice's Gotify (user_id=1, member of Org A)
# 
# Does NOT match:
# - Org B's Slack (wrong org)
# - Bob's Gotify (not member of Org A)
```

**Event in Org B**:
```python
Event(organization_id=10, tags=["autosub:critical"])

# Query finds (scoped to Org B):
# - Org B's Slack (organization_id=10)
# - Bob's Gotify (user_id=2, member of Org B)
#
# Does NOT match:
# - Org A's Slack (wrong org)
# - Alice's Gotify (not member of Org B)
```

**Result**: No collision! Same tag name, but scoped by organization membership.

### Personal Public Events

```python
# Personal public event
Event(organization_id=None, is_public=True, tags=["autosub:concerts"])

# Query finds:
# - Any user's personal integration with tag="autosub:concerts"
# - Does NOT match org integrations
```

**Result**: Personal events have their own namespace (personal integrations only).

---

## Permission Model

### Admin Can:
- ✅ Manage org settings
- ✅ Add/remove members
- ✅ Change member roles
- ✅ Create/edit/delete org integrations
- ✅ Create events associated with org
- ✅ View all org members and integrations

### Member Can:
- ✅ View org details and members
- ✅ View org integrations (read-only)
- ✅ Create events associated with org
- ✅ Create personal integrations (auto-subscribe to org events)
- ❌ Cannot manage org or org integrations

### Why Admin-Only for Org Integrations?
- Prevents misuse of company channels
- Clear responsibility (admins control shared channels)
- Members still benefit via auto-subscribe
- Members have full control over personal integrations

---

## API Endpoints

### Organizations

#### Create Organization
```http
POST /api/organizations
Authorization: Bearer {token}

{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "team",
  "max_seats": 20
}

Response 201:
{
  "id": 1,
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "team",
  "max_seats": 20,
  "role": "admin"
}
```

#### List User's Organizations
```http
GET /api/organizations
Authorization: Bearer {token}

Response 200:
[
  {
    "id": 1,
    "name": "Acme Corp",
    "slug": "acme-corp",
    "plan": "team",
    "role": "admin",
    "member_count": 5,
    "seats_used": 5,
    "seats_available": 15
  }
]
```

#### Get Organization Details
```http
GET /api/organizations/{org_id}
Authorization: Bearer {token}

Response 200:
{
  "id": 1,
  "name": "Acme Corp",
  "slug": "acme-corp",
  "plan": "team",
  "max_seats": 20,
  "role": "admin",
  "members": [
    {
      "user_id": 1,
      "name": "Alice Admin",
      "email": "alice@acme.com",
      "role": "admin",
      "uses_personal_seat": true,
      "joined_at": "2025-10-11T12:00:00Z"
    }
  ],
  "integrations": [
    {
      "id": 10,
      "name": "Company Slack",
      "integration_type": "discord",
      "tag": "jira",
      "is_active": true
    },
    {
      "id": 11,
      "name": "Company Slack",
      "integration_type": "discord",
      "tag": "critical",
      "is_active": true
    }
  ]
}
```

---

### Organization Members

#### Add Member
```http
POST /api/organizations/{org_id}/members
Authorization: Bearer {token}  # Must be admin

{
  "email": "bob@acme.com",
  "role": "member"
}

Response 201:
{
  "user_id": 2,
  "name": "Bob Member",
  "email": "bob@acme.com",
  "role": "member",
  "uses_personal_seat": true
}
```

#### Update Member Role
```http
PATCH /api/organizations/{org_id}/members/{user_id}
Authorization: Bearer {token}  # Must be admin

{
  "role": "admin"
}

Response 200:
{
  "user_id": 2,
  "role": "admin"
}
```

#### Remove Member
```http
DELETE /api/organizations/{org_id}/members/{user_id}
Authorization: Bearer {token}  # Must be admin

Response 204
```

---

### Organization Integrations

#### Create Org Integration
```http
POST /api/organizations/{org_id}/integrations
Authorization: Bearer {token}  # Must be admin

{
  "name": "Company Slack",
  "integration_type": "discord",
  "config": {
    "webhook_url": "https://discord.com/api/webhooks/..."
  },
  "tags": ["jira", "autosub:critical", "autosub:urgent"]  # Frontend sends list
}

Response 201:
[
  {
    "id": 10,
    "organization_id": 1,
    "name": "Company Slack",
    "integration_type": "discord",
    "tag": "jira",
    "is_active": true
  },
  {
    "id": 11,
    "organization_id": 1,
    "name": "Company Slack",
    "integration_type": "discord",
    "tag": "autosub:critical",
    "is_active": true
  },
  {
    "id": 12,
    "organization_id": 1,
    "name": "Company Slack",
    "integration_type": "discord",
    "tag": "autosub:urgent",
    "is_active": true
  }
]
```

**Note**: 
- Backend creates one row per tag (same as personal integrations)
- Tags with `autosub:` prefix will trigger auto-subscribe
- Regular tags (e.g., "jira") require manual subscription

#### List Org Integrations
```http
GET /api/organizations/{org_id}/integrations
Authorization: Bearer {token}  # Any member

Response 200:
[
  {
    "id": 10,
    "name": "Company Slack",
    "integration_type": "discord",
    "tag": "jira",
    "is_active": true
  },
  {
    "id": 11,
    "name": "Company Slack",
    "integration_type": "discord",
    "tag": "critical",
    "is_active": true
  }
]
```

#### Delete Org Integration
```http
DELETE /api/organizations/{org_id}/integrations/{integration_id}
Authorization: Bearer {token}  # Must be admin

Response 204
```

---

### Events with Auto-Subscribe

#### Create Event (Personal - Public with Auto-Subscribe)
```http
POST /api/events
Authorization: Bearer {token}

{
  "name": "Community Concert",
  "start_date": "2025-12-01T18:00:00Z",
  "is_public": true,
  "tags": ["music", "concerts"]  # Plain tags, no autosub: prefix
}

Response 201:
{
  "id": 1,
  "name": "Community Concert",
  "organization_id": null,
  "is_public": true,
  "tags": ["music", "concerts"],
  "auto_subscribed_count": 3,  # Users with integration tag "autosub:concerts"
  ...
}
```

**Note**: 
- Event tags are plain (no `autosub:` prefix)
- System looks for integrations with `"autosub:concerts"` tag
- Auto-subscribe only works if `is_public=true`

#### Create Event (Personal - Private, No Auto-Subscribe)
```http
POST /api/events
Authorization: Bearer {token}

{
  "name": "My Birthday Party",
  "start_date": "2025-12-01T18:00:00Z",
  "is_public": false,
  "tags": ["personal", "party"]  # Plain tags
}

Response 201:
{
  "id": 2,
  "name": "My Birthday Party",
  "organization_id": null,
  "is_public": false,
  "tags": ["personal", "party"],
  "auto_subscribed_count": 0,  # No auto-subscribe (private event)
  ...
}
```

**Note**: Private personal events don't trigger auto-subscribe.

#### Create Event (Organization)
```http
POST /api/organizations/{org_id}/events
Authorization: Bearer {token}  # Any member

{
  "name": "JIRA-123: Database Down",
  "start_date": "2025-10-11T16:00:00Z",
  "is_public": false,
  "tags": ["jira", "critical", "urgent"]  # Plain tags, no autosub: prefix
}

Response 201:
{
  "id": 3,
  "name": "JIRA-123: Database Down",
  "organization_id": 1,
  "tags": ["jira", "critical", "urgent"],
  "auto_subscribed_count": 5,  # How many subscriptions created
  ...
}
```

**Auto-subscribe runs**:
1. For each event tag: "jira", "critical", "urgent"
2. Look for integrations with: "autosub:jira", "autosub:critical", "autosub:urgent"
3. Find matching integrations (scoped to org members)
4. Create subscriptions automatically
5. Return count of subscriptions created

**Example**:
- Event tag: `"critical"` → Finds integrations with tag `"autosub:critical"`
- If no one has `"autosub:jira"`, that tag doesn't auto-subscribe anyone

---

## Implementation

### Database Setup Script

```python
# scripts/setup_db_with_orgs.py
"""Wipe and recreate database with organizations support."""
import asyncio
from src.db.base import Base, engine

async def setup_db():
    """Drop all tables and recreate"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Database wiped and recreated with organizations support")

if __name__ == "__main__":
    asyncio.run(setup_db())
```

**Usage**:
```bash
uv run scripts/setup_db_with_orgs.py
```

---

### Repository Methods

```python
class OrganizationRepository:
    """Manage organizations"""
    
    async def create(self, name: str, slug: str, plan: str, max_seats: int) -> Organization:
        """Create organization"""
        
    async def get_by_id(self, org_id: int) -> Organization | None:
        """Get org with members and integrations"""
        
    async def add_member(self, org_id: int, user_id: int, role: str = "member") -> OrganizationMembership:
        """Add user to org"""
        
    async def is_admin(self, org_id: int, user_id: int) -> bool:
        """Check if user is admin"""
        
    async def get_member_ids(self, org_id: int) -> list[int]:
        """Get all member user IDs"""


class IntegrationRepository:
    """Extend existing repository"""
    
    async def get_by_tag_and_org(self, tag: str, organization_id: int) -> list[Integration]:
        """Get integrations matching tag for org members + org itself (query-scoped)"""
        
    async def get_by_tag_public(self, tag: str) -> list[Integration]:
        """Get personal integrations matching tag (for public events)"""
        
    async def create_multiple_tags(
        self, 
        user_id: int | None,
        organization_id: int | None,
        name: str,
        integration_type: str,
        apprise_url: str,
        tags: list[str]
    ) -> list[Integration]:
        """Create one integration row per tag"""
```

---

### Service Functions

```python
# src/api/services/auto_subscribe.py

async def create_event_with_auto_subscribe(
    event_data: EventCreate,
    organization_id: int | None,
    session: AsyncSession
) -> tuple[Event, int]:
    """
    Create event and auto-subscribe org members based on tags.
    
    Returns:
        (event, subscription_count)
    """
    event_repo = EventRepository(session)
    
    # Create event
    event = await event_repo.create(
        name=event_data.name,
        organization_id=organization_id,
        tags=event_data.tags,
        ...
    )
    
    # Auto-subscribe if org event with tags
    subscription_count = 0
    if organization_id and event.tags:
        subscription_count = await auto_subscribe_by_tags(
            event.id,
            organization_id,
            event.tags,
            session
        )
    
    await session.commit()
    
    return event, subscription_count


async def auto_subscribe_by_tags(
    event_id: int,
    organization_id: int,
    event_tags: list[str],
    session: AsyncSession
) -> int:
    """
    Auto-subscribe org members based on matching tags.
    
    Returns:
        Number of subscriptions created
    """
    integration_repo = IntegrationRepository(session)
    subscription_repo = SubscriptionRepository(session)
    org_repo = OrganizationRepository(session)
    
    subscriptions_created = 0
    
    for event_tag in event_tags:
        # Find integrations matching this tag
        matching_integrations = await integration_repo.get_by_tag_and_org(
            tag=event_tag,
            organization_id=organization_id
        )
        
        for integration in matching_integrations:
            if integration.user_id:
                # Personal integration - subscribe that user
                await subscription_repo.create_with_selector(
                    user_id=integration.user_id,
                    event_id=event_id,
                    integration_id=integration.id
                )
                subscriptions_created += 1
            
            elif integration.organization_id:
                # Org integration - subscribe all org members
                member_ids = await org_repo.get_member_ids(organization_id)
                for user_id in member_ids:
                    await subscription_repo.create_with_selector(
                        user_id=user_id,
                        event_id=event_id,
                        integration_id=integration.id
                    )
                    subscriptions_created += 1
    
    return subscriptions_created
```

---

## Testing

### Test Script

```python
# scripts/test_organizations.py
"""Test organizations with auto-subscribe"""
import asyncio
from src.db.session import get_db_session
from src.db.repositories import OrganizationRepository, UserRepository, IntegrationRepository
from src.api.services.auto_subscribe import create_event_with_auto_subscribe

async def test_auto_subscribe():
    async with get_db_session() as session:
        org_repo = OrganizationRepository(session)
        user_repo = UserRepository(session)
        integration_repo = IntegrationRepository(session)
        
        # 1. Create org
        org = await org_repo.create(
            name="Acme Corp",
            slug="acme-corp",
            plan="team",
            max_seats=20
        )
        print(f"✅ Created org: {org.name}")
        
        # 2. Create admin user
        admin = await user_repo.create(
            email="admin@acme.com",
            name="Admin User",
            password_hash="..."
        )
        await org_repo.add_member(org.id, admin.id, role="admin")
        print(f"✅ Added admin: {admin.name}")
        
        # 3. Create engineer user
        engineer = await user_repo.create(
            email="engineer@acme.com",
            name="Engineer User",
            password_hash="..."
        )
        await org_repo.add_member(org.id, engineer.id, role="member")
        print(f"✅ Added engineer: {engineer.name}")
        
        # 4. Admin creates org Slack integration with tags
        org_integrations = await integration_repo.create_multiple_tags(
            user_id=None,
            organization_id=org.id,
            name="Company Slack",
            integration_type="discord",
            apprise_url="discord://webhook...",
            tags=["jira", "critical"]
        )
        print(f"✅ Created org Slack with tags: {[i.tag for i in org_integrations]}")
        
        # 5. Engineer creates personal Gotify with tags
        personal_integrations = await integration_repo.create_multiple_tags(
            user_id=engineer.id,
            organization_id=None,
            name="My Gotify",
            integration_type="gotify",
            apprise_url="gotify://...",
            tags=["jira", "personal"]
        )
        print(f"✅ Created engineer Gotify with tags: {[i.tag for i in personal_integrations]}")
        
        # 6. Create event with tags (auto-subscribe should trigger)
        event, sub_count = await create_event_with_auto_subscribe(
            event_data=EventCreate(
                name="JIRA-123: Database Down",
                start_date=datetime.now(timezone.utc),
                tags=["jira", "critical"]
            ),
            organization_id=org.id,
            session=session
        )
        print(f"✅ Created event: {event.name}")
        print(f"✅ Auto-subscribed {sub_count} subscriptions")
        
        # Expected subscriptions:
        # - Engineer's Gotify (matches "jira") = 1
        # - Org Slack "jira" tag → admin + engineer = 2
        # - Org Slack "critical" tag → admin + engineer = 2
        # Total = 5 subscriptions
        
        await session.commit()

if __name__ == "__main__":
    asyncio.run(test_auto_subscribe())
```

---

## Summary

### What Changed from Current System
- ✅ 2 new tables (`organizations`, `organization_memberships`)
- ✅ 2 new columns (`integrations.organization_id`, `events.organization_id`)
- ✅ 1 new column (`events.tags`)
- ✅ Auto-subscribe logic with `autosub:` prefix
- ✅ Query-scoped namespacing (no global tag collisions)
- ✅ New API routes for org management

### What Stays The Same
- ✅ Integration model (one tag per row)
- ✅ Subscription model (unchanged)
- ✅ Workflows (unchanged)
- ✅ Notification logic (unchanged)

### Lines of Code Estimate
- Database models: ~60 lines
- Repository methods: ~120 lines (added `get_by_tag_public`)
- Auto-subscribe service: ~100 lines (added public event logic)
- API routes: ~150 lines
- **Total: ~430 lines**

### Key Features
- ✅ **`autosub:` prefix** - Opt-in auto-subscribe (e.g., "autosub:critical")
- ✅ **Universal feature** - Works for personal public events and org events
- ✅ **Query-scoped namespacing** - No tag collisions between orgs
- ✅ **Personal public events** - Auto-subscribe if `is_public=true`
- ✅ **Org events** - Auto-subscribe scoped to org members only
- ✅ **Regular tags** - Still work for manual subscription

### Tag Examples

**Integration tags** (user's opt-in):
- **Regular tag**: `"jira"` - Manual subscription only
- **Auto-subscribe tag**: `"autosub:critical"` - Auto-subscribe to events with tag "critical"
- **Mixed**: `["jira", "autosub:critical"]` - Manual for "jira", auto for "critical"

**Event tags** (plain, no prefix):
- Event with tags `["jira", "critical"]`
- Triggers auto-subscribe for integrations with `"autosub:jira"` and `"autosub:critical"`

### Namespacing
- **Org events**: Tags scoped to org members (no collision)
- **Personal public events**: Tags scoped to personal integrations
- **No prefix needed**: Query logic provides natural namespacing

**Ready to implement!** 🚀
