# Phase 15: Integration Configuration System

**Status**: 📝 Ready to Implement  
**Estimated Time**: 2-3 days  
**Dependencies**: Phase 10 (Integrations API)

---

## Overview

Transform integration configuration from raw Apprise URLs to user-friendly forms. Users provide only what's necessary (tokens, URLs, credentials) - the backend handles conversion to Apprise URLs.

**Key Principle**: Users never see or manage Apprise URLs. If we move away from Apprise in the future, users won't need to change anything.

---

## Goals

1. ✅ User-friendly integration configuration (no Apprise URLs)
2. ✅ Extensible pattern for adding new integrations
3. ✅ Backward compatible with existing integrations
4. ✅ Store both Apprise URL and original config (encrypted)
5. ✅ Dynamic form generation for UI
6. ✅ Test integration functionality

---

## Architecture Reference

See `docs/implementation/integration-config-architecture.md` for complete architecture details.

**Key Components**:
- Integration Registry (central registry of all types)
- Base Converter Class (protocol for converters)
- Type-specific Converters (Gotify, Email, Ntfy, Discord, Slack, Telegram)
- Updated API endpoints (single endpoint for all types)

---

## Implementation Steps

### Step 1: Database Migration

Add `integration_type` and `config_json_encrypted` columns to integrations table.

**Files**: `scripts/migrate_phase_15.py`, `src/db/models.py`  
**Lines**: ~80 total

### Step 2: Integration Registry

Create registry pattern for managing converters.

**Files**: `src/api/services/integration_registry.py`, `src/api/services/integration_converters/base.py`  
**Lines**: ~100 total

### Step 3: Gotify Converter (Reference)

Implement first converter as reference for others.

**Files**: `src/api/services/integration_converters/gotify.py`  
**Lines**: ~100

### Step 4: Remaining Converters

Implement Email, Ntfy, Discord, Slack, Telegram converters.

**Files**: 5 converter files  
**Lines**: ~490 total

### Step 5: API Updates

Update schemas and routes to use new system.

**Files**: `src/api/schemas.py`, `src/api/routes/integrations.py`  
**Lines**: ~50 total

### Step 6: Testing

Unit tests, integration tests, and manual testing.

**Files**: Test files and scripts  
**Lines**: ~300 total

---

## Files Summary

### Created (~990 lines)
- Registry + Base: ~100 lines
- 6 Converters: ~600 lines
- Scripts: ~100 lines
- Tests: ~200 lines

### Modified (~90 lines)
- Models: ~40 lines
- Schemas: ~30 lines
- Routes: ~20 lines

**Total**: ~1,080 lines

---

## Testing Checklist

- [ ] All converter unit tests pass
- [ ] API integration tests pass
- [ ] Manual test script succeeds
- [ ] Backward compatibility verified
- [ ] No ruff errors

---

## Acceptance Criteria

- ✅ Users can create integrations with simple configs
- ✅ Backend converts to Apprise URLs automatically
- ✅ All 6 integration types supported
- ✅ Existing integrations continue to work
- ✅ Dynamic form generation via `/types` endpoint
- ✅ Test integration functionality works
- ✅ All tests pass
- ✅ Code quality checks pass

---

## Next Steps

After Phase 15:
- Add more integration types (100+ available in Apprise)
- Build UI forms using `/types` endpoint
- Add integration editing (using stored config_json)
- Implement integration health monitoring

---

**See `docs/implementation/integration-config-architecture.md` for detailed implementation guide.**
