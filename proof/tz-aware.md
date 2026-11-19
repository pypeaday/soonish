# Proof: tz-aware API timestamps — `created_at` emits `Z`, not naive

**

**Claim:** `TimestampMixin` used `DateTime(timezone=True)` — on SQLite that
reads back naive, so every `created_at`/`updated_at` serialized without an
offset and every frontend parsed it as browser-local time. Swapped to the
repo's `UTCDateTime` type: storage format unchanged (UTC naive on disk),
reads come back tz-aware, responses emit `...Z`. Closes #34.


## Change


## Claims

- `POST /api/v1/channels` now emits `"created_at": "...Z"` (before: no offset)
- Mission-control "Created …" renders real elapsed time (before: +5h future)
- New test: response `created_at` parses with `tzinfo` — pins the contract

## Evidence

**Before** (main stack): `"created_at": "2026-10-09T17:51:42.973270"` → UI showed "Created in about 5 hours" for a row seconds old.

**After** (this worktree's stack): `"created_at": "2026-10-09T17:53:52.421062Z"` →

![Mission control channels — created 1 minute ago](assets/tz-aware/channels-created-ago.png)

## Evidence

## Not proven

- Other apps rendering `created_at` (all `frontend-*` use the same
  `parseISO`/`formatDistanceToNow` family — the fix is API-side so all get it).
- Postgres path: `UTCDateTime` is already the intended type; postgres
  `timestamptz` keeps tz natively — this change is a no-op there.
- verify ran VERIFY_FRONTENDS=none (backend-only change; CI runs all).

```bash
curl -s http://localhost:32792/api/v1/channels -H "Authorization: Bearer TOKEN" | head -c 300
```

```output
{"detail":"Not authenticated"}```
```

```bash
curl -s http://localhost:32792/api/v1/channels -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsImlzX3ZlcmlmaWVkIjp0cnVlLCJleHAiOjE3OTE1NzIxNzYsImlhdCI6MTc5MTU2ODU3Nn0.XhxUY4tJ-X5-IU0F5AhntFZbxqWahnYJZlQdN6EVpTE' | python3 -c 'import json,sys; c=json.load(sys.stdin)[-1]; print(c["name"], c["created_at"])'
```

```output
tz-after 2026-10-09T17:53:52.421062Z
```
