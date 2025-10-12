# Organizations Documentation

**Last Updated**: 2025-10-11  
**Status**: ✅ Final Specification - Tag-Based Auto-Subscribe Model

---

## 📚 Current Documentation

### Active Documents (Use These!)

1. **`docs/specifications/organizations.md`** - **THE SPEC**
   - Complete specification with tag-based auto-subscribe model
   - Data model, API endpoints, implementation details
   - This is the single source of truth

2. **`docs/implementation/organizations-checklist.md`** - **IMPLEMENTATION GUIDE**
   - Step-by-step checklist for implementation
   - Estimated timelines per phase
   - Files to create/modify
   - Test commands

### Archived Documents (For Reference Only)

All brainstorming and old versions moved to:
- `docs/archive/organizations-brainstorm/`

These are kept for historical reference but should NOT be used for implementation.

---

## 🎯 The Model (Quick Summary)

### Core Concept
**Organizations enable tag-based auto-subscription to events.**

### How It Works

1. **Setup Phase**:
   - Engineer creates personal Gotify with tags: `["jira", "personal"]`
   - Admin creates org Slack with tags: `["jira", "critical"]`

2. **Event Creation**:
   - Event created with tags: `["jira", "critical"]`

3. **Auto-Subscribe**:
   - System finds integrations matching tags
   - Engineer's Gotify matches "jira" → subscribed
   - Org Slack matches "jira" and "critical" → all members subscribed

4. **Result**:
   - Notifications sent automatically
   - No manual subscription needed!

### Key Insight
**Event tags match integration tags → automatic subscriptions**

---

## 🏗️ Data Model

### New Tables (2)
- `organizations` - Org metadata and billing
- `organization_memberships` - Who's in what org

### Modified Tables (2)
- `integrations` + `organization_id` - Can be org-owned or user-owned
- `events` + `organization_id` + `tags` - Org association and tags for auto-subscribe

### Existing Pattern Reused
- **One tag per row** (already in current model)
- Frontend sends `["jira", "personal"]`
- Backend creates 2 integration rows (one per tag)

---

## 🚀 Implementation

### Quick Start
```bash
# 1. Wipe and recreate DB
uv run scripts/setup_db_with_orgs.py

# 2. Test
uv run scripts/test_organizations_full.py

# 3. Run API
uv run uvicorn src.api.main:app --reload
```

### Development Approach
- ✅ No migrations - just wipe and recreate DB
- ✅ Test after each phase
- ✅ Follow checklist in order
- ✅ ~2-3 days of work

---

## 📖 Reading Order

If you're new to this feature:

1. Read **`docs/specifications/organizations.md`** (15 min)
   - Understand the model and use cases

2. Review **`docs/implementation/organizations-checklist.md`** (5 min)
   - See the implementation plan

3. Start implementing Phase 1
   - Follow checklist step-by-step

---

## 🤔 Key Decisions

### Why Tag-Based Auto-Subscribe?
- ✅ Fully automatic - no manual subscription
- ✅ Flexible - users control which events they get
- ✅ Simple - event tags match integration tags
- ✅ Reuses existing model - one tag per row

### Why Admin-Only for Org Integrations?
- ✅ Prevents misuse of company channels
- ✅ Clear responsibility
- ✅ Members still benefit via auto-subscribe
- ✅ Members have full control over personal integrations

### Why One Tag Per Row?
- ✅ Already in current model
- ✅ Makes queries simple
- ✅ Easy to match event tags to integration tags

---

## 💡 Use Case Example

**Engineer who doesn't want Slack on phone**:

```
Setup:
  Company: Notifiq Team plan ($50/month, 20 seats)
  Admin: Creates org Slack with tags ["jira", "critical"]
  Engineer: Creates personal Gotify with tags ["jira", "personal"]

Event:
  Monitoring system creates event via API:
  Event(name="JIRA-123: DB Down", tags=["jira", "critical"])

Auto-Subscribe:
  System finds:
    - Org Slack (matches "jira" + "critical") → all members
    - Engineer's Gotify (matches "jira") → engineer only

Notifications:
  - Company Slack gets notified
  - Engineer's Gotify gets notified
  - Engineer deletes Slack from phone! 🎉
```

---

## 📊 Estimated Effort

- **Code**: ~390 lines (plus ~100 for tests)
- **Time**: 11-16 hours (2-3 days)
- **Complexity**: Low (reuses existing patterns)

---

## ✅ What's Ready

- ✅ Complete specification
- ✅ Implementation checklist
- ✅ Data model defined
- ✅ API endpoints specified
- ✅ Auto-subscribe logic documented
- ✅ Test scenarios outlined

**Ready to implement!** 🚀

---

## 📝 Notes

### Development Philosophy
- **Wipe DB freely** - No migration complexity
- **Test often** - After each phase
- **Minimal code** - Every line necessary
- **Reuse patterns** - Leverage existing subscription model

### Questions?
All details are in `docs/specifications/organizations.md`. If something is unclear, that's the place to look first.

---

## 🗂️ File Structure

```
docs/
├── specifications/
│   └── organizations.md              ← THE SPEC (use this!)
├── implementation/
│   └── organizations-checklist.md    ← IMPLEMENTATION GUIDE
├── archive/
│   └── organizations-brainstorm/     ← Old versions (reference only)
└── ORGANIZATIONS_README.md           ← This file
```

---

**Start here**: `docs/specifications/organizations.md` 📖
