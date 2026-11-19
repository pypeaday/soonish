# Proof: Temporal replaced by a DB-backed job scheduler

## Change

Removes `temporalio` and the Temporal server from the runtime: workflows/,
schedules.py, the Temporal worker, compose services and CI plumbing are gone,
replaced by a `scheduled_jobs` table + a poll loop in the existing worker
(`services/scheduler.py`, `worker/main.py`). Every workflow signal became an
enqueue inside the same DB commit; recurrence chains via `event_end` jobs.
Worktree-only experiment — no deploy intent.

## Claims

1. `temporalio` is gone from the runtime path — no imports remain in backend/src
2. Fresh sqlite runs the migration chain — `scheduled_jobs` created
3. Deterministic scheduler tests pass — dedupe, retry->dead, stale recovery, recurrence
4. Live stack has no temporal container; health reports scheduler=healthy
5. Live queue executes: API-created event -> jobs enqueued -> worker ran them to done
6. Stack smoke: health + front door + all 9 SPA mounts

## Evidence

### Claim 1: temporalio is gone from the runtime path — no imports remain in backend/src

```bash
cd backend && grep -rn 'temporalio\|Temporal' src/ --include='*.py' -l | grep -v 'workflow_helpers\|temporal_workflow_id' ; echo '---'; grep -rn 'import temporalio\|from temporalio' src/ || echo 'NO temporalio imports in src/'
```

```output
src/services/scheduler.py
src/services/usage.py
src/db/models.py
src/worker/main.py
src/tier_config/tier_limits.py
src/api/routes/admin.py
src/api/routes/subscriptions_v1.py
---
NO temporalio imports in src/
```

### Claim 2: fresh sqlite runs the new migration chain — scheduled_jobs table created

```bash
cd backend && rm -f /tmp/proof-mig.db && DATABASE_URL='sqlite+aiosqlite:////tmp/proof-mig.db' uv run alembic upgrade head 2>&1 | tail -4 && sqlite3 /tmp/proof-mig.db "select count(*) as cols from pragma_table_info('scheduled_jobs')"
```

```output
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 3348a46da230, initial schema
INFO  [alembic.runtime.migration] Running upgrade 3348a46da230 -> a7c9d2e41f03, scheduled jobs table (replaces Temporal workflows/schedules)
13
```

### Claim 3: deterministic scheduler tests pass — dedupe, retry->dead, stale recovery, recurrence

```bash
cd backend && uv run pytest tests/test_scheduler.py -q 2>&1 | tail -5
```

```output
collected 9 items

tests/test_scheduler.py .........                                        [100%]

============================== 9 passed in 0.80s ===============================
```

### Claim 4: live stack has no temporal container; health reports scheduler=healthy

```bash
docker compose -f docker-compose.stack.yml -p notifiq-e2e-diy-scheduler ps --format 'table {{.Name}}\t{{.Status}}' && curl -s http://localhost:32787/api/v1/health
```

```output
NAME                                 STATUS
notifiq-e2e-diy-scheduler-api-1      Up 3 hours (healthy)
notifiq-e2e-diy-scheduler-worker-1   Up 3 hours
{"status":"healthy","timestamp":"2026-10-08T01:16:45.319098Z","version":"0.1.0","scheduler":"healthy","database":"healthy"}```
```

### Claim 5: the live queue — event created via API produced an event_end job (pending at end_date) and a notify_subscribers job the worker ran to done

```bash
docker compose -f docker-compose.stack.yml -p notifiq-e2e-diy-scheduler exec api uv run python -c "import sqlite3; c=sqlite3.connect('/data/notifiq.db'); [print(r) for r in c.execute('select id,kind,status,attempts,due_at,dedupe_key from scheduled_jobs order by id')]"
```

```output
(1, 'event_end', 'done', 0, '2026-10-08 00:14:39.000000', 'event-end-1')
(2, 'notify_subscribers', 'done', 0, '2026-10-07 22:14:39.336125', None)
```

### Claim 6: stack smoke — health + front door + all 9 SPA mounts

```bash
just stack-test 2>&1 | tail -14
```

```output
==> smoke test against http://localhost:32787
  PASS  health (/api/v1/health -> 200)
  PASS  front door (/ -> 200)
  PASS  api docs (/docs -> 200)
  PASS  spa:mission-control (/mission-control/ -> 200)
  PASS  spa:volunteer-coordinator (/volunteer-coordinator/ -> 200)
  PASS  spa:event-planner (/event-planner/ -> 200)
  PASS  spa:duty-pager (/duty-pager/ -> 200)
  PASS  spa:developer-user (/developer-user/ -> 200)
  PASS  spa:tasks (/tasks/ -> 200)
  PASS  spa:stage-manager (/stage-manager/ -> 200)
  PASS  spa:adhd-reminders (/adhd-reminders/ -> 200)
  PASS  spa:mindful (/mindful/ -> 200)
==> 0 failure(s)
```


## Not proven

- Multi-worker postgres claim contention — conditional update is correct by
  construction but only exercised on sqlite.
- Real channel delivery (SMTP/webhook) end-to-end from a fired reminder —
  handlers were monkeypatched in unit tests; the stack lane has no mail sink
  wired to a real subscription, though the service lane in `just verify`
  proved outbound SMTP works.
- `temporal_workflow_id` column/field kept as the job-series correlation id
  (API contract consumed by frontend types) — rename deferred.

## Baseline

The proof every change owes, regardless of what it touched.


```bash
just verify
```

```output

######## backend lint
cd backend && just lint
uvx ruff check
All checks passed!

######## backend tests (unit)
uv run pytest tests/ --tb=short -q
============================= test session starts ==============================
platform linux -- Python 3.12.0, pytest-9.0.1, pluggy-1.6.0
rootdir: /home/nic/projects/personal/notifiq-worktrees/diy-scheduler/backend
configfile: pytest.ini (WARNING: ignoring pytest config in pyproject.toml!)
plugins: cov-7.0.0, anyio-4.11.0, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=function, asyncio_default_test_loop_scope=function
collected 84 items

tests/test_auth_workflows.py ssssssssssssssssss                          [ 21%]
tests/test_auto_subscriptions.py ssssss                                  [ 28%]
tests/test_billing_urls.py ......                                        [ 35%]
tests/test_csrf_dependency.py .........                                  [ 46%]
tests/test_health.py sssss                                               [ 52%]
tests/test_integration_converters.py .............                       [ 67%]
tests/test_live_delivery.py sss                                          [ 71%]
tests/test_scheduler.py .........                                        [ 82%]
tests/test_service_delivery.py ssssss                                    [ 89%]
tests/test_subscription_workflows.py ssssss                              [ 96%]
tests/test_token_hashing.py ...                                          [100%]

======================== 40 passed, 44 skipped in 1.74s ========================

######## backend tests (integration)
cd backend && just test-full
==> Starting SMTP sink on port 36441 (captures to /tmp/tmp.pPZhEKOjbD/mail.jsonl)...
warning: Invalid `SSL_CERT_FILE`. Path does not exist: /tmp/tmp.pPZhEKOjbD/sink-cert.pem. No default certificates will be trusted.
sink_smtp listening on 127.0.0.1:36441 -> /tmp/tmp.pPZhEKOjbD/mail.jsonl (cert /tmp/tmp.pPZhEKOjbD/sink-cert.pem)
    SMTP sink ready (PID 3619348)
==> Initializing test database...
INFO  [alembic.runtime.migration] Context impl SQLiteImpl.
INFO  [alembic.runtime.migration] Will assume non-transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade  -> 3348a46da230, initial schema
INFO  [alembic.runtime.migration] Running upgrade 3348a46da230 -> a7c9d2e41f03, scheduled jobs table (replaces Temporal workflows/schedules)
============================================================
Notifiq Database Initialization
============================================================
🗑️  Dropping existing database at test_notifiq_3619332.db
🔨 Creating new database schema
✅ Database schema created

🌱 Seeding sample data
  👤 Creating users
  🔧 DEV MODE: Creating passwordless admin users
     ✅ admin@example.com (passwordless)
2026-10-07 20:17:06,713 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO  [sqlalchemy.engine.Engine] BEGIN (implicit)
2026-10-07 20:17:06,714 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
INFO  [sqlalchemy.engine.Engine] INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:06,714 INFO sqlalchemy.engine.Engine [generated in 0.00018s] ('admin@example.com', 'Dev Admin', None, 1, 'personal_premium', 0, 0, '2026-10-08 01:17:06.714302', None, None, None, None, '2026-10-08 01:17:06.714305', '2026-10-08 01:17:06.714306')
INFO  [sqlalchemy.engine.Engine] [generated in 0.00018s] ('admin@example.com', 'Dev Admin', None, 1, 'personal_premium', 0, 0, '2026-10-08 01:17:06.714302', None, None, None, None, '2026-10-08 01:17:06.714305', '2026-10-08 01:17:06.714306')
2026-10-07 20:17:06,715 INFO sqlalchemy.engine.Engine COMMIT
INFO  [sqlalchemy.engine.Engine] COMMIT

✅ Dev mode: Created passwordless admin users only

🔍 Database contents:
2026-10-07 20:17:06,718 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO  [sqlalchemy.engine.Engine] BEGIN (implicit)
2026-10-07 20:17:06,719 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM users
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM users
2026-10-07 20:17:06,719 INFO sqlalchemy.engine.Engine [generated in 0.00007s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00007s] ()
   - users: 1 rows
2026-10-07 20:17:06,720 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM events
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM events
2026-10-07 20:17:06,720 INFO sqlalchemy.engine.Engine [generated in 0.00007s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00007s] ()
   - events: 0 rows
2026-10-07 20:17:06,721 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM channels
2026-10-07 20:17:06,721 INFO sqlalchemy.engine.Engine [generated in 0.00006s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00006s] ()
   - channels: 0 rows
2026-10-07 20:17:06,721 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM subscriptions
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM subscriptions
2026-10-07 20:17:06,721 INFO sqlalchemy.engine.Engine [generated in 0.00007s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00007s] ()
   - subscriptions: 0 rows
2026-10-07 20:17:06,722 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM subscription_selectors
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM subscription_selectors
2026-10-07 20:17:06,722 INFO sqlalchemy.engine.Engine [generated in 0.00006s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00006s] ()
   - subscription_selectors: 0 rows
2026-10-07 20:17:06,723 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM event_invitations
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM event_invitations
2026-10-07 20:17:06,723 INFO sqlalchemy.engine.Engine [generated in 0.00006s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00006s] ()
   - event_invitations: 0 rows
2026-10-07 20:17:06,723 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM organizations
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM organizations
2026-10-07 20:17:06,723 INFO sqlalchemy.engine.Engine [generated in 0.00006s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00006s] ()
   - organizations: 0 rows
2026-10-07 20:17:06,724 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM organization_memberships
INFO  [sqlalchemy.engine.Engine] SELECT count(*) AS count_1 
FROM organization_memberships
2026-10-07 20:17:06,724 INFO sqlalchemy.engine.Engine [generated in 0.00006s] ()
INFO  [sqlalchemy.engine.Engine] [generated in 0.00006s] ()
   - organization_memberships: 0 rows
2026-10-07 20:17:06,724 INFO sqlalchemy.engine.Engine ROLLBACK
INFO  [sqlalchemy.engine.Engine] ROLLBACK

🔑 Encryption key (add to .env):
   ENCRYPTION_KEY=AHAojqvuJjuqlG-SfmBuyXJ3yZmk31f1Vs4Fx2B4NJY=

============================================================
✅ Database ready! Location: test_notifiq_3619332.db
============================================================
==> Starting test API server on port 41945...
==> Starting scheduler worker (polling scheduled_jobs)...
==> Waiting for API at http://localhost:41945...
INFO:__main__:Worker starting — polling scheduled_jobs
2026-10-07 20:17:07,164 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:07,165 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:07,165 INFO sqlalchemy.engine.Engine [generated in 0.00018s] ('pending', '2026-10-08 01:17:07.165417', 'running', '2026-10-08 01:07:07.125815')
INFO:sqlalchemy.engine.Engine:[generated in 0.00018s] ('pending', '2026-10-08 01:17:07.165417', 'running', '2026-10-08 01:07:07.125815')
2026-10-07 20:17:07,169 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:07,169 INFO sqlalchemy.engine.Engine [generated in 0.00013s] ('pending', '2026-10-08 01:17:07.167776', 20, 0)
INFO:sqlalchemy.engine.Engine:[generated in 0.00013s] ('pending', '2026-10-08 01:17:07.167776', 20, 0)
2026-10-07 20:17:07,170 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:08,171 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:08,171 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:08,171 INFO sqlalchemy.engine.Engine [cached since 1.007s ago] ('pending', '2026-10-08 01:17:08.171885', 'running', '2026-10-08 01:07:08.171013')
INFO:sqlalchemy.engine.Engine:[cached since 1.007s ago] ('pending', '2026-10-08 01:17:08.171885', 'running', '2026-10-08 01:07:08.171013')
2026-10-07 20:17:08,172 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:08,172 INFO sqlalchemy.engine.Engine [cached since 1.003s ago] ('pending', '2026-10-08 01:17:08.172446', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 1.003s ago] ('pending', '2026-10-08 01:17:08.172446', 20, 0)
2026-10-07 20:17:08,173 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     Started server process [3619401]
INFO:     Waiting for application startup.
2026-10-07 20:17:08,428 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:08,463 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users
 LIMIT ? OFFSET ?
2026-10-07 20:17:08,463 INFO sqlalchemy.engine.Engine [generated in 0.00020s] (1, 0)
2026-10-07 20:17:08,465 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:41945 (Press CTRL+C to quit)
INFO:     127.0.0.1:43382 - "GET /health HTTP/1.1" 404 Not Found
    API ready!
==> Running tests with coverage...
2026-10-07 20:17:09,175 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:09,175 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:09,175 INFO sqlalchemy.engine.Engine [cached since 2.01s ago] ('pending', '2026-10-08 01:17:09.175522', 'running', '2026-10-08 01:07:09.174832')
INFO:sqlalchemy.engine.Engine:[cached since 2.01s ago] ('pending', '2026-10-08 01:17:09.175522', 'running', '2026-10-08 01:07:09.174832')
2026-10-07 20:17:09,176 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:09,176 INFO sqlalchemy.engine.Engine [cached since 2.007s ago] ('pending', '2026-10-08 01:17:09.176014', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 2.007s ago] ('pending', '2026-10-08 01:17:09.176014', 20, 0)
2026-10-07 20:17:09,176 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
============================= test session starts ==============================
platform linux -- Python 3.12.0, pytest-9.0.1, pluggy-1.6.0 -- /home/nic/projects/personal/notifiq-worktrees/diy-scheduler/backend/.venv/bin/python
cachedir: .pytest_cache
rootdir: /home/nic/projects/personal/notifiq-worktrees/diy-scheduler/backend
configfile: pytest.ini (WARNING: ignoring pytest config in pyproject.toml!)
plugins: cov-7.0.0, anyio-4.11.0, asyncio-1.3.0
asyncio: mode=Mode.AUTO, debug=False, asyncio_default_fixture_loop_scope=function, asyncio_default_test_loop_scope=function
collecting ... 2026-10-07 20:17:10,178 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:10,178 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:10,178 INFO sqlalchemy.engine.Engine [cached since 3.014s ago] ('pending', '2026-10-08 01:17:10.178896', 'running', '2026-10-08 01:07:10.178195')
INFO:sqlalchemy.engine.Engine:[cached since 3.014s ago] ('pending', '2026-10-08 01:17:10.178896', 'running', '2026-10-08 01:07:10.178195')
2026-10-07 20:17:10,179 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:10,179 INFO sqlalchemy.engine.Engine [cached since 3.01s ago] ('pending', '2026-10-08 01:17:10.179399', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 3.01s ago] ('pending', '2026-10-08 01:17:10.179399', 20, 0)
2026-10-07 20:17:10,180 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
collected 84 items

tests/test_auth_workflows.py::TestRegistration::test_register_new_user_success 2026-10-07 20:17:11,150 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:11,151 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:11,151 INFO sqlalchemy.engine.Engine [generated in 0.00020s] ('test_20261007201711086252@test.example.com',)
(trapped) error reading bcrypt version
Traceback (most recent call last):
  File "/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/backend/.venv/lib/python3.12/site-packages/passlib/handlers/bcrypt.py", line 620, in _load_backend_mixin
    version = _bcrypt.__about__.__version__
              ^^^^^^^^^^^^^^^^^
AttributeError: module 'bcrypt' has no attribute '__about__'
2026-10-07 20:17:11,182 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:11,182 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:11,182 INFO sqlalchemy.engine.Engine [cached since 4.017s ago] ('pending', '2026-10-08 01:17:11.182487', 'running', '2026-10-08 01:07:11.181767')
INFO:sqlalchemy.engine.Engine:[cached since 4.017s ago] ('pending', '2026-10-08 01:17:11.182487', 'running', '2026-10-08 01:07:11.181767')
2026-10-07 20:17:11,183 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:11,183 INFO sqlalchemy.engine.Engine [cached since 4.014s ago] ('pending', '2026-10-08 01:17:11.182980', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 4.014s ago] ('pending', '2026-10-08 01:17:11.182980', 20, 0)
2026-10-07 20:17:11,183 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:11,362 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:11,362 INFO sqlalchemy.engine.Engine [generated in 0.00029s] ('test_20261007201711086252@test.example.com', 'New User', '$2b$12$Txd93mDMJGgkoOgTcymoiu2qUOoidwKFz2w0/Gg6kzRvgVK34HEw2', 0, 'free', 0, 0, '2026-10-08 01:17:11.362457', None, None, None, None, '2026-10-08 01:17:11.362461', '2026-10-08 01:17:11.362461')
2026-10-07 20:17:11,375 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:11,377 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:11,378 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:11,378 INFO sqlalchemy.engine.Engine [generated in 0.00018s] (2,)
2026-10-07 20:17:11,393 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:11,394 INFO sqlalchemy.engine.Engine [generated in 0.00017s] (2, 'Email: test_20261007201711086252@test.example.com', 'autosub:default')
2026-10-07 20:17:11,437 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:11,437 INFO sqlalchemy.engine.Engine [generated in 0.00029s] (2, None, 'Email: test_20261007201711086252@test.example.com', <memory at 0x7f5cbe7fcf40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:11.437652', '2026-10-08 01:17:11.437656')
2026-10-07 20:17:11,444 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:11,444 INFO sqlalchemy.engine.Engine [generated in 0.00018s] ('email', <memory at 0x7f5cbe7fcd00>, '2026-10-08 01:17:11.444203', 1)
2026-10-07 20:17:11,448 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:11,876 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:11,877 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:11,877 INFO sqlalchemy.engine.Engine [generated in 0.00022s] ('88c17d176d444167d19af4dd57765827e337a504a7c20aad02be5955b35da65e', 2, '2026-10-08 01:17:11.877285', '2026-10-15 01:17:11.876116')
INFO:     127.0.0.1:43386 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:12,059 INFO sqlalchemy.engine.Engine COMMIT
PASSED [  1%]
tests/test_auth_workflows.py::TestRegistration::test_register_duplicate_email_rejected 2026-10-07 20:17:12,073 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,073 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:12,073 INFO sqlalchemy.engine.Engine [cached since 0.9226s ago] ('test_20261007201712068675@test.example.com',)
2026-10-07 20:17:12,185 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:12,185 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:12,185 INFO sqlalchemy.engine.Engine [cached since 5.02s ago] ('pending', '2026-10-08 01:17:12.185704', 'running', '2026-10-08 01:07:12.184989')
INFO:sqlalchemy.engine.Engine:[cached since 5.02s ago] ('pending', '2026-10-08 01:17:12.185704', 'running', '2026-10-08 01:07:12.184989')
2026-10-07 20:17:12,186 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:12,186 INFO sqlalchemy.engine.Engine [cached since 5.017s ago] ('pending', '2026-10-08 01:17:12.186272', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 5.017s ago] ('pending', '2026-10-08 01:17:12.186272', 20, 0)
2026-10-07 20:17:12,187 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:12,293 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:12,293 INFO sqlalchemy.engine.Engine [cached since 0.9313s ago] ('test_20261007201712068675@test.example.com', 'Test User', '$2b$12$/83x8mncVIIR9B0fcnjXCeu8HfY4wGT7PJm7MwGeif1yAhJMLC4HC', 0, 'free', 0, 0, '2026-10-08 01:17:12.293481', None, None, None, None, '2026-10-08 01:17:12.293485', '2026-10-08 01:17:12.293486')
2026-10-07 20:17:12,298 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:12,300 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,301 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:12,301 INFO sqlalchemy.engine.Engine [cached since 0.9224s ago] (3,)
2026-10-07 20:17:12,304 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:12,304 INFO sqlalchemy.engine.Engine [cached since 0.911s ago] (3, 'Email: test_20261007201712068675@test.example.com', 'autosub:default')
2026-10-07 20:17:12,308 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:12,308 INFO sqlalchemy.engine.Engine [cached since 0.8709s ago] (3, None, 'Email: test_20261007201712068675@test.example.com', <memory at 0x7f5cbe7fc280>, 'autosub:default', 1, None, None, '2026-10-08 01:17:12.308393', '2026-10-08 01:17:12.308394')
2026-10-07 20:17:12,312 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:12,312 INFO sqlalchemy.engine.Engine [cached since 0.8681s ago] ('email', <memory at 0x7f5ce0073e80>, '2026-10-08 01:17:12.312153', 2)
2026-10-07 20:17:12,315 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:12,329 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,329 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:12,329 INFO sqlalchemy.engine.Engine [cached since 0.452s ago] ('c22b466c5875b299be85a791c90b738cc80d2c9eca66e0cad139eb1d48fd6df2', 3, '2026-10-08 01:17:12.329166', '2026-10-15 01:17:12.328809')
INFO:     127.0.0.1:43968 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:12,359 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:12,365 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,365 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:12,366 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (3,)
2026-10-07 20:17:12,370 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:12,370 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, '2026-10-08 01:17:12.370781', 3)
2026-10-07 20:17:12,374 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:43968 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozLCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTIwNjg2NzVAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjMyLCJpYXQiOjE3OTE0MjIyMzJ9.iGTJW1QyD5O3QNx4F-Ie2sa3MzM7bPvfrxK61lnsxHg HTTP/1.1" 200 OK
2026-10-07 20:17:12,410 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,410 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:12,410 INFO sqlalchemy.engine.Engine [cached since 1.259s ago] ('test_20261007201712068675@test.example.com',)
2026-10-07 20:17:12,426 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:43968 - "POST /api/v1/auth/register HTTP/1.1" 409 Conflict
2026-10-07 20:17:12,431 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,431 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:12,431 INFO sqlalchemy.engine.Engine [cached since 1.281s ago] ('test_20261007201712068675@test.example.com',)
2026-10-07 20:17:12,621 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:12,621 INFO sqlalchemy.engine.Engine [cached since 0.744s ago] ('20fd83add471ab93999cfc789c95ee9c94b959242e4b682cd6a63cfb4e5d0f29', 3, '2026-10-08 01:17:12.621038', '2026-10-15 01:17:12.620706')
2026-10-07 20:17:12,653 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:12,653 INFO sqlalchemy.engine.Engine [generated in 0.00019s] (3, 'sha256:70bafa0b4601c143d7987e4942bdfafe09bc8878d854ee4279e0cb9afdba2f82', '2026-11-07 01:17:12.652139', '2026-10-08 01:17:12.652921', None)
2026-10-07 20:17:12,657 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:43968 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
PASSED [  2%]
tests/test_auth_workflows.py::TestRegistration::test_register_invalid_email_rejected INFO:     127.0.0.1:43982 - "POST /api/v1/auth/register HTTP/1.1" 422 Unprocessable Entity
PASSED [  3%]
tests/test_auth_workflows.py::TestRegistration::test_register_auto_login_works 2026-10-07 20:17:12,706 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,706 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:12,706 INFO sqlalchemy.engine.Engine [cached since 1.555s ago] ('test_20261007201712702662@test.example.com',)
2026-10-07 20:17:12,912 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:12,912 INFO sqlalchemy.engine.Engine [cached since 1.551s ago] ('test_20261007201712702662@test.example.com', 'Auto Login Test', '$2b$12$jnrpQaKcIZZvmmgGmmLBX.VVQcuoILZilKjd7K3rFOTGWxA7u1Knm', 0, 'free', 0, 0, '2026-10-08 01:17:12.912678', None, None, None, None, '2026-10-08 01:17:12.912682', '2026-10-08 01:17:12.912683')
2026-10-07 20:17:12,928 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:12,930 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,931 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:12,931 INFO sqlalchemy.engine.Engine [cached since 1.552s ago] (4,)
2026-10-07 20:17:12,936 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:12,936 INFO sqlalchemy.engine.Engine [cached since 1.543s ago] (4, 'Email: test_20261007201712702662@test.example.com', 'autosub:default')
2026-10-07 20:17:12,941 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:12,941 INFO sqlalchemy.engine.Engine [cached since 1.504s ago] (4, None, 'Email: test_20261007201712702662@test.example.com', <memory at 0x7f5cbd805e40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:12.941508', '2026-10-08 01:17:12.941510')
2026-10-07 20:17:12,945 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:12,945 INFO sqlalchemy.engine.Engine [cached since 1.501s ago] ('email', <memory at 0x7f5cbd8065c0>, '2026-10-08 01:17:12.945284', 3)
2026-10-07 20:17:12,948 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:12,962 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,962 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:12,962 INFO sqlalchemy.engine.Engine [cached since 1.086s ago] ('715c499f8d08c3a9eecee2605b14febe12f5184e1a60714edebdd61c1f5c942f', 4, '2026-10-08 01:17:12.962624', '2026-10-15 01:17:12.962206')
INFO:     127.0.0.1:43990 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:12,994 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:12,999 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:12,999 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:12,999 INFO sqlalchemy.engine.Engine [cached since 0.6335s ago] (4,)
INFO:     127.0.0.1:43990 - "GET /api/v1/users/me HTTP/1.1" 200 OK
2026-10-07 20:17:13,016 INFO sqlalchemy.engine.Engine COMMIT
PASSED [  4%]
tests/test_auth_workflows.py::TestLogin::test_login_success 2026-10-07 20:17:13,026 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,026 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:13,026 INFO sqlalchemy.engine.Engine [cached since 1.875s ago] ('test_20261007201713022642@test.example.com',)
2026-10-07 20:17:13,189 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:13,189 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:13,189 INFO sqlalchemy.engine.Engine [cached since 6.024s ago] ('pending', '2026-10-08 01:17:13.189380', 'running', '2026-10-08 01:07:13.188604')
INFO:sqlalchemy.engine.Engine:[cached since 6.024s ago] ('pending', '2026-10-08 01:17:13.189380', 'running', '2026-10-08 01:07:13.188604')
2026-10-07 20:17:13,190 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:13,190 INFO sqlalchemy.engine.Engine [cached since 6.021s ago] ('pending', '2026-10-08 01:17:13.189905', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 6.021s ago] ('pending', '2026-10-08 01:17:13.189905', 20, 0)
2026-10-07 20:17:13,190 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:13,239 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:13,240 INFO sqlalchemy.engine.Engine [cached since 1.878s ago] ('test_20261007201713022642@test.example.com', 'Test User', '$2b$12$/i7QytSJRyiRdchgZaqz.eWg7/fyGjEp2X0Xrj0xzvRZ.yb4//eBS', 0, 'free', 0, 0, '2026-10-08 01:17:13.239813', None, None, None, None, '2026-10-08 01:17:13.239817', '2026-10-08 01:17:13.239818')
2026-10-07 20:17:13,246 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:13,281 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,282 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:13,282 INFO sqlalchemy.engine.Engine [cached since 1.903s ago] (5,)
2026-10-07 20:17:13,287 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:13,287 INFO sqlalchemy.engine.Engine [cached since 1.893s ago] (5, 'Email: test_20261007201713022642@test.example.com', 'autosub:default')
2026-10-07 20:17:13,291 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:13,291 INFO sqlalchemy.engine.Engine [cached since 1.854s ago] (5, None, 'Email: test_20261007201713022642@test.example.com', <memory at 0x7f5cbd806800>, 'autosub:default', 1, None, None, '2026-10-08 01:17:13.291046', '2026-10-08 01:17:13.291048')
2026-10-07 20:17:13,295 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:13,295 INFO sqlalchemy.engine.Engine [cached since 1.851s ago] ('email', <memory at 0x7f5cbd805900>, '2026-10-08 01:17:13.295268', 4)
2026-10-07 20:17:13,298 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:13,311 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,311 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:13,311 INFO sqlalchemy.engine.Engine [cached since 1.435s ago] ('3c2c0e408339d02e600b46e7134fff4111cc35325d74babf63b8851fa9544a00', 5, '2026-10-08 01:17:13.311700', '2026-10-15 01:17:13.311364')
INFO:     127.0.0.1:44004 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:13,341 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:13,346 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,347 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:13,347 INFO sqlalchemy.engine.Engine [cached since 0.9813s ago] (5,)
2026-10-07 20:17:13,351 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:13,351 INFO sqlalchemy.engine.Engine [cached since 0.9809s ago] (1, '2026-10-08 01:17:13.351569', 5)
2026-10-07 20:17:13,355 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44004 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjo1LCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTMwMjI2NDJAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjMzLCJpYXQiOjE3OTE0MjIyMzN9.uDHJn_WOJ3hx6VL0q0J3tq4BxaRb-WFQ1pGut641a7E HTTP/1.1" 200 OK
2026-10-07 20:17:13,389 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,389 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:13,389 INFO sqlalchemy.engine.Engine [cached since 2.238s ago] ('test_20261007201713022642@test.example.com',)
2026-10-07 20:17:13,584 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:13,584 INFO sqlalchemy.engine.Engine [cached since 1.707s ago] ('affd0260613ed92ddeeed2b4304446beba338cefdfb46314c7f0bbe10003d931', 5, '2026-10-08 01:17:13.584561', '2026-10-15 01:17:13.584223')
2026-10-07 20:17:13,590 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:13,590 INFO sqlalchemy.engine.Engine [cached since 0.9374s ago] (5, 'sha256:6508d6e06a58f05bf99c96a267cdeafdd51f6e3457a3037a6288bea912a2ea56', '2026-11-07 01:17:13.589908', '2026-10-08 01:17:13.590134', None)
2026-10-07 20:17:13,593 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44004 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
PASSED       [  5%]
tests/test_auth_workflows.py::TestLogin::test_login_wrong_password_rejected 2026-10-07 20:17:13,625 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,625 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:13,625 INFO sqlalchemy.engine.Engine [cached since 2.475s ago] ('test_20261007201713622118@test.example.com',)
2026-10-07 20:17:13,823 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:13,824 INFO sqlalchemy.engine.Engine [cached since 2.462s ago] ('test_20261007201713622118@test.example.com', 'Test User', '$2b$12$dWXIYQHA41XMxQdtL.tR/OFQI5jbxOr8CyVatk6YIHYed4gthUhe6', 0, 'free', 0, 0, '2026-10-08 01:17:13.823794', None, None, None, None, '2026-10-08 01:17:13.823798', '2026-10-08 01:17:13.823799')
2026-10-07 20:17:13,848 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:13,850 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,850 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:13,850 INFO sqlalchemy.engine.Engine [cached since 2.472s ago] (6,)
2026-10-07 20:17:13,854 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:13,854 INFO sqlalchemy.engine.Engine [cached since 2.461s ago] (6, 'Email: test_20261007201713622118@test.example.com', 'autosub:default')
2026-10-07 20:17:13,858 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:13,858 INFO sqlalchemy.engine.Engine [cached since 2.421s ago] (6, None, 'Email: test_20261007201713622118@test.example.com', <memory at 0x7f5cbe7fd480>, 'autosub:default', 1, None, None, '2026-10-08 01:17:13.858482', '2026-10-08 01:17:13.858483')
2026-10-07 20:17:13,862 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:13,862 INFO sqlalchemy.engine.Engine [cached since 2.418s ago] ('email', <memory at 0x7f5cbe7fd000>, '2026-10-08 01:17:13.862226', 5)
2026-10-07 20:17:13,865 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:13,878 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,878 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:13,878 INFO sqlalchemy.engine.Engine [cached since 2.001s ago] ('b82f2344871a65824d50004836b6ac8a6da673a0fc22ec989bc72adab027571b', 6, '2026-10-08 01:17:13.878165', '2026-10-15 01:17:13.877839')
INFO:     127.0.0.1:44020 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:13,908 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:13,913 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,913 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:13,913 INFO sqlalchemy.engine.Engine [cached since 1.548s ago] (6,)
2026-10-07 20:17:13,917 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:13,917 INFO sqlalchemy.engine.Engine [cached since 1.547s ago] (1, '2026-10-08 01:17:13.917527', 6)
2026-10-07 20:17:13,921 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44020 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjo2LCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTM2MjIxMThAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjMzLCJpYXQiOjE3OTE0MjIyMzN9.6pYzZHI7-G1tI_4zg_wBBp85XWDXfqx7b5FoIBO5Qak HTTP/1.1" 200 OK
2026-10-07 20:17:13,955 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:13,955 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:13,955 INFO sqlalchemy.engine.Engine [cached since 2.804s ago] ('test_20261007201713622118@test.example.com',)
2026-10-07 20:17:14,182 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44020 - "POST /api/v1/auth/login HTTP/1.1" 401 Unauthorized
PASSED [  7%]
tests/test_auth_workflows.py::TestLogin::test_login_nonexistent_user_rejected 2026-10-07 20:17:14,192 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:14,192 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:14,192 INFO sqlalchemy.engine.Engine [cached since 7.027s ago] ('pending', '2026-10-08 01:17:14.192648', 'running', '2026-10-08 01:07:14.191967')
INFO:sqlalchemy.engine.Engine:[cached since 7.027s ago] ('pending', '2026-10-08 01:17:14.192648', 'running', '2026-10-08 01:07:14.191967')
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine [cached since 7.024s ago] ('pending', '2026-10-08 01:17:14.193177', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 7.024s ago] ('pending', '2026-10-08 01:17:14.193177', 20, 0)
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine [cached since 3.042s ago] ('nonexistent@example.com',)
2026-10-07 20:17:14,193 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:14,211 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44036 - "POST /api/v1/auth/login HTTP/1.1" 401 Unauthorized
PASSED [  8%]
tests/test_auth_workflows.py::TestLogin::test_access_token_works 2026-10-07 20:17:14,221 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,221 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:14,221 INFO sqlalchemy.engine.Engine [cached since 3.07s ago] ('test_20261007201714217864@test.example.com',)
2026-10-07 20:17:14,414 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:14,414 INFO sqlalchemy.engine.Engine [cached since 3.052s ago] ('test_20261007201714217864@test.example.com', 'Test User', '$2b$12$l44k/NGHb2gG1wZ6GqyhO.3lpEgBGldS1wkNaN/CfRflokcdW8HvC', 0, 'free', 0, 0, '2026-10-08 01:17:14.414344', None, None, None, None, '2026-10-08 01:17:14.414351', '2026-10-08 01:17:14.414352')
2026-10-07 20:17:14,444 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:14,446 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,447 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:14,447 INFO sqlalchemy.engine.Engine [cached since 3.069s ago] (7,)
2026-10-07 20:17:14,453 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:14,453 INFO sqlalchemy.engine.Engine [cached since 3.059s ago] (7, 'Email: test_20261007201714217864@test.example.com', 'autosub:default')
2026-10-07 20:17:14,457 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:14,457 INFO sqlalchemy.engine.Engine [cached since 3.02s ago] (7, None, 'Email: test_20261007201714217864@test.example.com', <memory at 0x7f5cbd806800>, 'autosub:default', 1, None, None, '2026-10-08 01:17:14.457516', '2026-10-08 01:17:14.457519')
2026-10-07 20:17:14,462 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:14,462 INFO sqlalchemy.engine.Engine [cached since 3.018s ago] ('email', <memory at 0x7f5cbd806080>, '2026-10-08 01:17:14.462073', 6)
2026-10-07 20:17:14,466 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:14,480 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,480 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:14,480 INFO sqlalchemy.engine.Engine [cached since 2.603s ago] ('29970087c842f0710c0e294a5da21c79b989e9c792bd1f275f663151669cf556', 7, '2026-10-08 01:17:14.480328', '2026-10-15 01:17:14.479808')
INFO:     127.0.0.1:44038 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:14,518 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:14,522 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,523 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:14,523 INFO sqlalchemy.engine.Engine [cached since 2.157s ago] (7,)
2026-10-07 20:17:14,527 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:14,527 INFO sqlalchemy.engine.Engine [cached since 2.157s ago] (1, '2026-10-08 01:17:14.527497', 7)
2026-10-07 20:17:14,531 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44038 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjo3LCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTQyMTc4NjRAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjM0LCJpYXQiOjE3OTE0MjIyMzR9.LyniIDcB_kvaXQKnm1xRbfmMLgyLNr1dYxXz7qCKq_0 HTTP/1.1" 200 OK
2026-10-07 20:17:14,565 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,566 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:14,566 INFO sqlalchemy.engine.Engine [cached since 3.415s ago] ('test_20261007201714217864@test.example.com',)
2026-10-07 20:17:14,760 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:14,760 INFO sqlalchemy.engine.Engine [cached since 2.883s ago] ('974494c9aedc68af4755941862a4dbd9b2e25d7860c52a082f93381f0a00651e', 7, '2026-10-08 01:17:14.759935', '2026-10-15 01:17:14.759605')
2026-10-07 20:17:14,764 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:14,764 INFO sqlalchemy.engine.Engine [cached since 2.112s ago] (7, 'sha256:93c8848898ead7a1466fce3fb3b7e95eb5bc3c59f31e3115e558675b4e36c697', '2026-11-07 01:17:14.764605', '2026-10-08 01:17:14.764812', None)
2026-10-07 20:17:14,768 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44038 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:14,793 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,793 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:14,793 INFO sqlalchemy.engine.Engine [cached since 2.428s ago] (7,)
INFO:     127.0.0.1:44038 - "GET /api/v1/users/me HTTP/1.1" 200 OK
2026-10-07 20:17:14,810 INFO sqlalchemy.engine.Engine COMMIT
PASSED  [  9%]
tests/test_auth_workflows.py::TestTokenRefresh::test_refresh_token_returns_new_access_token 2026-10-07 20:17:14,820 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:14,820 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:14,820 INFO sqlalchemy.engine.Engine [cached since 3.669s ago] ('test_20261007201714816530@test.example.com',)
2026-10-07 20:17:15,011 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:15,011 INFO sqlalchemy.engine.Engine [cached since 3.649s ago] ('test_20261007201714816530@test.example.com', 'Test User', '$2b$12$14DZFdERO6zaeMlUuf/unOIikwOC8zGwLeRTQPanKECB2osW6u6tO', 0, 'free', 0, 0, '2026-10-08 01:17:15.011145', None, None, None, None, '2026-10-08 01:17:15.011149', '2026-10-08 01:17:15.011150')
2026-10-07 20:17:15,015 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:15,018 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,018 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:15,018 INFO sqlalchemy.engine.Engine [cached since 3.64s ago] (8,)
2026-10-07 20:17:15,022 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:15,022 INFO sqlalchemy.engine.Engine [cached since 3.629s ago] (8, 'Email: test_20261007201714816530@test.example.com', 'autosub:default')
2026-10-07 20:17:15,025 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:15,025 INFO sqlalchemy.engine.Engine [cached since 3.588s ago] (8, None, 'Email: test_20261007201714816530@test.example.com', <memory at 0x7f5cbd805e40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:15.025786', '2026-10-08 01:17:15.025788')
2026-10-07 20:17:15,030 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:15,030 INFO sqlalchemy.engine.Engine [cached since 3.586s ago] ('email', <memory at 0x7f5cbd805240>, '2026-10-08 01:17:15.030219', 7)
2026-10-07 20:17:15,033 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:15,047 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,048 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:15,048 INFO sqlalchemy.engine.Engine [cached since 3.171s ago] ('6a8a1abb55b132c204d8b266a463e2d32e9fc2619e51fb18bba41f2734001fe3', 8, '2026-10-08 01:17:15.047977', '2026-10-15 01:17:15.047486')
INFO:     127.0.0.1:44050 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:15,083 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:15,089 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,089 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:15,089 INFO sqlalchemy.engine.Engine [cached since 2.724s ago] (8,)
2026-10-07 20:17:15,093 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:15,093 INFO sqlalchemy.engine.Engine [cached since 2.723s ago] (1, '2026-10-08 01:17:15.093655', 8)
2026-10-07 20:17:15,097 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44050 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjo4LCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTQ4MTY1MzBAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjM1LCJpYXQiOjE3OTE0MjIyMzV9.4YVA69laKwhtt-H--xw4rY2mucPckHHmFpCApx1C6RU HTTP/1.1" 200 OK
2026-10-07 20:17:15,137 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,137 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:15,137 INFO sqlalchemy.engine.Engine [cached since 3.986s ago] ('test_20261007201714816530@test.example.com',)
2026-10-07 20:17:15,195 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:15,196 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:15,196 INFO sqlalchemy.engine.Engine [cached since 8.031s ago] ('pending', '2026-10-08 01:17:15.195968', 'running', '2026-10-08 01:07:15.194997')
INFO:sqlalchemy.engine.Engine:[cached since 8.031s ago] ('pending', '2026-10-08 01:17:15.195968', 'running', '2026-10-08 01:07:15.194997')
2026-10-07 20:17:15,197 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:15,197 INFO sqlalchemy.engine.Engine [cached since 8.028s ago] ('pending', '2026-10-08 01:17:15.196898', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 8.028s ago] ('pending', '2026-10-08 01:17:15.196898', 20, 0)
2026-10-07 20:17:15,198 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:15,329 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:15,330 INFO sqlalchemy.engine.Engine [cached since 3.453s ago] ('b59337ac9d83db411540c189f215fb53a0881305864aced07c20ca1be6aef792', 8, '2026-10-08 01:17:15.329867', '2026-10-15 01:17:15.329467')
2026-10-07 20:17:15,360 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:15,360 INFO sqlalchemy.engine.Engine [cached since 2.708s ago] (8, 'sha256:e4f4b46aee0f8e601668d8ed3b48e2e6e21088d1acccdf41fca469eed50cc672', '2026-11-07 01:17:15.359984', '2026-10-08 01:17:15.360287', None)
2026-10-07 20:17:15,366 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44050 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:15,396 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,397 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:15,397 INFO sqlalchemy.engine.Engine [generated in 0.00013s] ('sha256:e4f4b46aee0f8e601668d8ed3b48e2e6e21088d1acccdf41fca469eed50cc672',)
2026-10-07 20:17:15,401 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:15,401 INFO sqlalchemy.engine.Engine [cached since 3.036s ago] (8,)
2026-10-07 20:17:15,405 INFO sqlalchemy.engine.Engine UPDATE refresh_tokens SET revoked_at=? WHERE refresh_tokens.id = ?
2026-10-07 20:17:15,405 INFO sqlalchemy.engine.Engine [generated in 0.00016s] ('2026-10-08 01:17:15.405120', 4)
2026-10-07 20:17:15,410 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:15,410 INFO sqlalchemy.engine.Engine [cached since 2.758s ago] (8, 'sha256:8b3797ff67de7f95431134f6e64bb4292da2109e9200ff7ba62b1a37e2357131', '2026-11-07 01:17:15.405157', '2026-10-08 01:17:15.410511', None)
2026-10-07 20:17:15,415 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44050 - "POST /api/v1/auth/token/refresh HTTP/1.1" 200 OK
PASSED [ 10%]
tests/test_auth_workflows.py::TestTokenRefresh::test_refresh_rotation_invalidates_previous_refresh_token 2026-10-07 20:17:15,455 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,455 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:15,455 INFO sqlalchemy.engine.Engine [cached since 4.304s ago] ('test_20261007201715451235@test.example.com',)
2026-10-07 20:17:15,657 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:15,657 INFO sqlalchemy.engine.Engine [cached since 4.295s ago] ('test_20261007201715451235@test.example.com', 'Test User', '$2b$12$gkiHyTWmtD9HcXLuDZcGiOELOUxYyupXjwjkeukjFYq/S7j1AGs9S', 0, 'free', 0, 0, '2026-10-08 01:17:15.657245', None, None, None, None, '2026-10-08 01:17:15.657250', '2026-10-08 01:17:15.657251')
2026-10-07 20:17:15,681 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:15,683 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,683 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:15,683 INFO sqlalchemy.engine.Engine [cached since 4.305s ago] (9,)
2026-10-07 20:17:15,689 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:15,689 INFO sqlalchemy.engine.Engine [cached since 4.295s ago] (9, 'Email: test_20261007201715451235@test.example.com', 'autosub:default')
2026-10-07 20:17:15,693 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:15,693 INFO sqlalchemy.engine.Engine [cached since 4.256s ago] (9, None, 'Email: test_20261007201715451235@test.example.com', <memory at 0x7f5ce0073940>, 'autosub:default', 1, None, None, '2026-10-08 01:17:15.693097', '2026-10-08 01:17:15.693099')
2026-10-07 20:17:15,697 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:15,697 INFO sqlalchemy.engine.Engine [cached since 4.253s ago] ('email', <memory at 0x7f5ce00734c0>, '2026-10-08 01:17:15.697517', 8)
2026-10-07 20:17:15,701 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:15,716 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,716 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:15,717 INFO sqlalchemy.engine.Engine [cached since 3.84s ago] ('ae6e2a996353fbe62feab122bcf9c2a0d33a2cd7a49774d60c2d8863a1d76341', 9, '2026-10-08 01:17:15.716880', '2026-10-15 01:17:15.716345')
INFO:     127.0.0.1:44066 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:15,752 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:15,758 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,758 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:15,758 INFO sqlalchemy.engine.Engine [cached since 3.393s ago] (9,)
2026-10-07 20:17:15,763 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:15,763 INFO sqlalchemy.engine.Engine [cached since 3.393s ago] (1, '2026-10-08 01:17:15.763550', 9)
2026-10-07 20:17:15,767 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44066 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjo5LCJlbWFpbCI6InRlc3RfMjAyNjEwMDcyMDE3MTU0NTEyMzVAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjM1LCJpYXQiOjE3OTE0MjIyMzV9.AJepNZZtdix65yRpqvqVr0EzHOjo4BvCtYkQKXQ9KKQ HTTP/1.1" 200 OK
2026-10-07 20:17:15,804 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:15,805 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:15,805 INFO sqlalchemy.engine.Engine [cached since 4.654s ago] ('test_20261007201715451235@test.example.com',)
2026-10-07 20:17:15,997 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:15,997 INFO sqlalchemy.engine.Engine [cached since 4.12s ago] ('f23372a4c85025ef62c42b822be1e245b1a834a3b0bbca8251a23e9184a14e20', 9, '2026-10-08 01:17:15.996997', '2026-10-15 01:17:15.996664')
2026-10-07 20:17:16,026 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:16,026 INFO sqlalchemy.engine.Engine [cached since 3.373s ago] (9, 'sha256:375d8da0b22ab66dba27f7e1e1e39544cc86184b0b646888bdaf8aaba615e12a', '2026-11-07 01:17:16.025747', '2026-10-08 01:17:16.026056', None)
2026-10-07 20:17:16,030 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44066 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:16,059 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,059 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:16,059 INFO sqlalchemy.engine.Engine [cached since 0.6629s ago] ('sha256:375d8da0b22ab66dba27f7e1e1e39544cc86184b0b646888bdaf8aaba615e12a',)
2026-10-07 20:17:16,064 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,064 INFO sqlalchemy.engine.Engine [cached since 3.699s ago] (9,)
2026-10-07 20:17:16,069 INFO sqlalchemy.engine.Engine UPDATE refresh_tokens SET revoked_at=? WHERE refresh_tokens.id = ?
2026-10-07 20:17:16,069 INFO sqlalchemy.engine.Engine [cached since 0.6634s ago] ('2026-10-08 01:17:16.068707', 6)
2026-10-07 20:17:16,072 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:16,072 INFO sqlalchemy.engine.Engine [cached since 3.42s ago] (9, 'sha256:dc878eddc7f51ad2e8978ac7a9008c65ecd9f9da7a59617bb9e478302be71ca9', '2026-11-07 01:17:16.068737', '2026-10-08 01:17:16.072661', None)
2026-10-07 20:17:16,076 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44066 - "POST /api/v1/auth/token/refresh HTTP/1.1" 200 OK
2026-10-07 20:17:16,105 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,105 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:16,105 INFO sqlalchemy.engine.Engine [cached since 0.7089s ago] ('sha256:375d8da0b22ab66dba27f7e1e1e39544cc86184b0b646888bdaf8aaba615e12a',)
2026-10-07 20:17:16,111 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.revoked_at IS NULL AND refresh_tokens.expires_at > ? ORDER BY refresh_tokens.created_at DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:16,111 INFO sqlalchemy.engine.Engine [generated in 0.00024s] ('2026-10-08 01:17:16.110357', 100, 0)
2026-10-07 20:17:16,136 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44066 - "POST /api/v1/auth/token/refresh HTTP/1.1" 401 Unauthorized
2026-10-07 20:17:16,142 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,142 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:16,142 INFO sqlalchemy.engine.Engine [cached since 0.7453s ago] ('sha256:dc878eddc7f51ad2e8978ac7a9008c65ecd9f9da7a59617bb9e478302be71ca9',)
2026-10-07 20:17:16,147 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,147 INFO sqlalchemy.engine.Engine [cached since 3.781s ago] (9,)
2026-10-07 20:17:16,151 INFO sqlalchemy.engine.Engine UPDATE refresh_tokens SET revoked_at=? WHERE refresh_tokens.id = ?
2026-10-07 20:17:16,151 INFO sqlalchemy.engine.Engine [cached since 0.7461s ago] ('2026-10-08 01:17:16.151335', 7)
2026-10-07 20:17:16,188 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:16,188 INFO sqlalchemy.engine.Engine [cached since 3.536s ago] (9, 'sha256:c82c95ff774819bf6e245c5926c8e0a172af164105f8cccb7f3e9fb6d5aaef2a', '2026-11-07 01:17:16.151364', '2026-10-08 01:17:16.188240', None)
2026-10-07 20:17:16,193 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:16,200 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:16,200 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:16,200 INFO sqlalchemy.engine.Engine [cached since 9.035s ago] ('pending', '2026-10-08 01:17:16.200274', 'running', '2026-10-08 01:07:16.199560')
INFO:sqlalchemy.engine.Engine:[cached since 9.035s ago] ('pending', '2026-10-08 01:17:16.200274', 'running', '2026-10-08 01:07:16.199560')
2026-10-07 20:17:16,201 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:16,201 INFO sqlalchemy.engine.Engine [cached since 9.032s ago] ('pending', '2026-10-08 01:17:16.200762', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 9.032s ago] ('pending', '2026-10-08 01:17:16.200762', 20, 0)
2026-10-07 20:17:16,201 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:44066 - "POST /api/v1/auth/token/refresh HTTP/1.1" 200 OK
PASSED [ 11%]
tests/test_auth_workflows.py::TestTokenRefresh::test_new_access_token_works 2026-10-07 20:17:16,228 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,228 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:16,228 INFO sqlalchemy.engine.Engine [cached since 5.077s ago] ('test_20261007201716224813@test.example.com',)
2026-10-07 20:17:16,420 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:16,420 INFO sqlalchemy.engine.Engine [cached since 5.058s ago] ('test_20261007201716224813@test.example.com', 'Test User', '$2b$12$/j//QJUiHgDMrEoZzdPAB.gipGWeSfE.K2XuJa3neOQVEeVrogb9u', 0, 'free', 0, 0, '2026-10-08 01:17:16.420553', None, None, None, None, '2026-10-08 01:17:16.420556', '2026-10-08 01:17:16.420557')
2026-10-07 20:17:16,425 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:16,427 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,428 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,428 INFO sqlalchemy.engine.Engine [cached since 5.05s ago] (10,)
2026-10-07 20:17:16,432 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:16,432 INFO sqlalchemy.engine.Engine [cached since 5.039s ago] (10, 'Email: test_20261007201716224813@test.example.com', 'autosub:default')
2026-10-07 20:17:16,436 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:16,437 INFO sqlalchemy.engine.Engine [cached since 4.999s ago] (10, None, 'Email: test_20261007201716224813@test.example.com', <memory at 0x7f5ce0073e80>, 'autosub:default', 1, None, None, '2026-10-08 01:17:16.436913', '2026-10-08 01:17:16.436916')
2026-10-07 20:17:16,441 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:16,441 INFO sqlalchemy.engine.Engine [cached since 4.997s ago] ('email', <memory at 0x7f5ce0073340>, '2026-10-08 01:17:16.441071', 9)
2026-10-07 20:17:16,444 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:16,458 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,458 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:16,458 INFO sqlalchemy.engine.Engine [cached since 4.582s ago] ('7b66a166b223e3a782ae035c97b66779e95ce256cf8c63ec92e0845ac2233d02', 10, '2026-10-08 01:17:16.458864', '2026-10-15 01:17:16.458396')
INFO:     127.0.0.1:44074 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:16,493 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:16,498 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,498 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,498 INFO sqlalchemy.engine.Engine [cached since 4.133s ago] (10,)
2026-10-07 20:17:16,503 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:16,503 INFO sqlalchemy.engine.Engine [cached since 4.133s ago] (1, '2026-10-08 01:17:16.503453', 10)
2026-10-07 20:17:16,507 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44074 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxMCwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzE2MjI0ODEzQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODYzNiwiaWF0IjoxNzkxNDIyMjM2fQ.IxxljOUuIUqKwr0tvcAxavPtM9KraOKQNkRhvXmSWy8 HTTP/1.1" 200 OK
2026-10-07 20:17:16,544 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,544 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:16,544 INFO sqlalchemy.engine.Engine [cached since 5.393s ago] ('test_20261007201716224813@test.example.com',)
2026-10-07 20:17:16,739 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:16,739 INFO sqlalchemy.engine.Engine [cached since 4.862s ago] ('1bf4f676a810a8b98965cc9edbc9ca01ec34467d99e7d3dec52444d3f1d84713', 10, '2026-10-08 01:17:16.739036', '2026-10-15 01:17:16.738555')
2026-10-07 20:17:16,767 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:16,767 INFO sqlalchemy.engine.Engine [cached since 4.115s ago] (10, 'sha256:de9ce9c41c3a2c1a5b99cf672fa0caf007d387a526e17f644da81dfea5448f9e', '2026-11-07 01:17:16.767297', '2026-10-08 01:17:16.767606', None)
2026-10-07 20:17:16,772 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44074 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:16,802 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,802 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:16,802 INFO sqlalchemy.engine.Engine [cached since 1.406s ago] ('sha256:de9ce9c41c3a2c1a5b99cf672fa0caf007d387a526e17f644da81dfea5448f9e',)
2026-10-07 20:17:16,807 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,807 INFO sqlalchemy.engine.Engine [cached since 4.442s ago] (10,)
2026-10-07 20:17:16,811 INFO sqlalchemy.engine.Engine UPDATE refresh_tokens SET revoked_at=? WHERE refresh_tokens.id = ?
2026-10-07 20:17:16,811 INFO sqlalchemy.engine.Engine [cached since 1.406s ago] ('2026-10-08 01:17:16.811524', 9)
2026-10-07 20:17:16,815 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:16,815 INFO sqlalchemy.engine.Engine [cached since 4.163s ago] (10, 'sha256:f03945cd99afd931a34ae205c8b40cab682b09eb891df72d1a49b3f7950a7682', '2026-11-07 01:17:16.811555', '2026-10-08 01:17:16.815566', None)
2026-10-07 20:17:16,818 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44074 - "POST /api/v1/auth/token/refresh HTTP/1.1" 200 OK
2026-10-07 20:17:16,851 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,851 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:16,851 INFO sqlalchemy.engine.Engine [cached since 4.486s ago] (10,)
INFO:     127.0.0.1:44074 - "GET /api/v1/users/me HTTP/1.1" 200 OK
2026-10-07 20:17:16,871 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 13%]
tests/test_auth_workflows.py::TestTokenRefresh::test_invalid_refresh_token_rejected 2026-10-07 20:17:16,882 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,882 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:16,882 INFO sqlalchemy.engine.Engine [cached since 1.486s ago] ('sha256:301fce4255e3fc08ad6521bf66f0619419dd4e5cbc587a635e8924c6fd7d9314',)
2026-10-07 20:17:16,889 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.revoked_at IS NULL AND refresh_tokens.expires_at > ? ORDER BY refresh_tokens.created_at DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:16,889 INFO sqlalchemy.engine.Engine [cached since 0.7775s ago] ('2026-10-08 01:17:16.888562', 100, 0)
2026-10-07 20:17:16,910 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44086 - "POST /api/v1/auth/token/refresh HTTP/1.1" 401 Unauthorized
PASSED [ 14%]
tests/test_auth_workflows.py::TestLogout::test_logout_clears_session 2026-10-07 20:17:16,922 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:16,922 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:16,922 INFO sqlalchemy.engine.Engine [cached since 5.772s ago] ('test_20261007201716917798@test.example.com',)
2026-10-07 20:17:17,123 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:17,123 INFO sqlalchemy.engine.Engine [cached since 5.761s ago] ('test_20261007201716917798@test.example.com', 'Test User', '$2b$12$0JRiq2HkQ3Q3BLtbsMgc.eLw8nQdYQb1Vtw1jrpGB17WRjAtVVCdy', 0, 'free', 0, 0, '2026-10-08 01:17:17.123549', None, None, None, None, '2026-10-08 01:17:17.123553', '2026-10-08 01:17:17.123553')
2026-10-07 20:17:17,149 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:17,152 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,152 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:17,152 INFO sqlalchemy.engine.Engine [cached since 5.774s ago] (11,)
2026-10-07 20:17:17,158 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:17,158 INFO sqlalchemy.engine.Engine [cached since 5.764s ago] (11, 'Email: test_20261007201716917798@test.example.com', 'autosub:default')
2026-10-07 20:17:17,162 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:17,162 INFO sqlalchemy.engine.Engine [cached since 5.725s ago] (11, None, 'Email: test_20261007201716917798@test.example.com', <memory at 0x7f5cbe7fcc40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:17.162195', '2026-10-08 01:17:17.162197')
2026-10-07 20:17:17,167 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:17,167 INFO sqlalchemy.engine.Engine [cached since 5.723s ago] ('email', <memory at 0x7f5cbe7fd480>, '2026-10-08 01:17:17.166995', 10)
2026-10-07 20:17:17,171 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:17,186 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,186 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:17,186 INFO sqlalchemy.engine.Engine [cached since 5.309s ago] ('0bc05486912f8afe4985c8d133eb5a713e2e19b3fa2aca6a2dc6ad7d88ec440f', 11, '2026-10-08 01:17:17.186397', '2026-10-15 01:17:17.185935')
2026-10-07 20:17:17,203 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:17,203 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:17,203 INFO sqlalchemy.engine.Engine [cached since 10.04s ago] ('pending', '2026-10-08 01:17:17.203702', 'running', '2026-10-08 01:07:17.203030')
INFO:sqlalchemy.engine.Engine:[cached since 10.04s ago] ('pending', '2026-10-08 01:17:17.203702', 'running', '2026-10-08 01:07:17.203030')
INFO:     127.0.0.1:44102 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:17,220 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:17,225 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,225 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:17,225 INFO sqlalchemy.engine.Engine [cached since 4.859s ago] (11,)
2026-10-07 20:17:17,229 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:17,229 INFO sqlalchemy.engine.Engine [cached since 4.859s ago] (1, '2026-10-08 01:17:17.229690', 11)
2026-10-07 20:17:17,234 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:17,238 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:17,238 INFO sqlalchemy.engine.Engine [cached since 10.07s ago] ('pending', '2026-10-08 01:17:17.237838', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 10.07s ago] ('pending', '2026-10-08 01:17:17.237838', 20, 0)
2026-10-07 20:17:17,238 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44102 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxMSwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzE2OTE3Nzk4QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODYzNywiaWF0IjoxNzkxNDIyMjM3fQ.P1KcV7lcd2-PVaaBjiI2iNvwIjt0EJ9CjZDrnK3AlQE HTTP/1.1" 200 OK
2026-10-07 20:17:17,273 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,273 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:17,273 INFO sqlalchemy.engine.Engine [cached since 6.122s ago] ('test_20261007201716917798@test.example.com',)
2026-10-07 20:17:17,465 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:17,465 INFO sqlalchemy.engine.Engine [cached since 5.588s ago] ('3e2575fd8ecc3a0746f4ed9811654a4e1a09238c552207dcfba10d72a51432f8', 11, '2026-10-08 01:17:17.465411', '2026-10-15 01:17:17.465084')
2026-10-07 20:17:17,495 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:17,495 INFO sqlalchemy.engine.Engine [cached since 4.843s ago] (11, 'sha256:31ee70b2fcad64dfc48606888c1ceec5f599fcb865e62801092355911c1b9c53', '2026-11-07 01:17:17.495487', '2026-10-08 01:17:17.495769', None)
2026-10-07 20:17:17,500 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44102 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:17,531 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,531 INFO sqlalchemy.engine.Engine DELETE FROM user_sessions WHERE user_sessions.session_id IN (?, ?)
2026-10-07 20:17:17,531 INFO sqlalchemy.engine.Engine [generated in 0.00015s] ('3e2575fd8ecc3a0746f4ed9811654a4e1a09238c552207dcfba10d72a51432f8', 'ipvMNJNmzwhVCv1gSqw91UNN8LrvZGiXtRuIDO1Srq0')
INFO:     127.0.0.1:44102 - "POST /api/v1/auth/logout HTTP/1.1" 200 OK
2026-10-07 20:17:17,548 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 15%]
tests/test_auth_workflows.py::TestLogout::test_logout_invalidates_refresh_token 2026-10-07 20:17:17,561 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,561 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:17,561 INFO sqlalchemy.engine.Engine [cached since 6.41s ago] ('test_20261007201717556728@test.example.com',)
2026-10-07 20:17:17,755 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:17,755 INFO sqlalchemy.engine.Engine [cached since 6.393s ago] ('test_20261007201717556728@test.example.com', 'Test User', '$2b$12$gPhqWg7fkSyl0eov1OVx.ukIFzIscXartCNXq28N0pqR6afXhfFp2', 0, 'free', 0, 0, '2026-10-08 01:17:17.755033', None, None, None, None, '2026-10-08 01:17:17.755037', '2026-10-08 01:17:17.755038')
2026-10-07 20:17:17,783 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:17,786 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,786 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:17,787 INFO sqlalchemy.engine.Engine [cached since 6.408s ago] (12,)
2026-10-07 20:17:17,826 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:17,826 INFO sqlalchemy.engine.Engine [cached since 6.433s ago] (12, 'Email: test_20261007201717556728@test.example.com', 'autosub:default')
2026-10-07 20:17:17,832 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:17,832 INFO sqlalchemy.engine.Engine [cached since 6.395s ago] (12, None, 'Email: test_20261007201717556728@test.example.com', <memory at 0x7f5ce0073e80>, 'autosub:default', 1, None, None, '2026-10-08 01:17:17.832497', '2026-10-08 01:17:17.832500')
2026-10-07 20:17:17,837 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:17,837 INFO sqlalchemy.engine.Engine [cached since 6.393s ago] ('email', <memory at 0x7f5ce0073940>, '2026-10-08 01:17:17.837236', 11)
2026-10-07 20:17:17,841 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:17,855 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,855 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:17,855 INFO sqlalchemy.engine.Engine [cached since 5.978s ago] ('65d4d71c248720543e669848673c84e55933cb621074a47e170ed3f8bfa2c4a5', 12, '2026-10-08 01:17:17.855620', '2026-10-15 01:17:17.855176')
INFO:     127.0.0.1:44108 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:17,891 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:17,898 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,898 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:17,899 INFO sqlalchemy.engine.Engine [cached since 5.533s ago] (12,)
2026-10-07 20:17:17,903 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:17,903 INFO sqlalchemy.engine.Engine [cached since 5.533s ago] (1, '2026-10-08 01:17:17.903241', 12)
2026-10-07 20:17:17,906 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44108 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxMiwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzE3NTU2NzI4QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODYzNywiaWF0IjoxNzkxNDIyMjM3fQ.-SivEJXR6aWSNVxn644kfREFQvvFjylgkWZJWciJ20A HTTP/1.1" 200 OK
2026-10-07 20:17:17,942 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:17,942 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:17,942 INFO sqlalchemy.engine.Engine [cached since 6.791s ago] ('test_20261007201717556728@test.example.com',)
2026-10-07 20:17:18,135 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:18,136 INFO sqlalchemy.engine.Engine [cached since 6.259s ago] ('3e50fc48ab126719678fc4f38a49e5a249d2533e108e2e5297d8d37c839b6115', 12, '2026-10-08 01:17:18.135836', '2026-10-15 01:17:18.135497')
2026-10-07 20:17:18,141 INFO sqlalchemy.engine.Engine INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:18,142 INFO sqlalchemy.engine.Engine [cached since 5.489s ago] (12, 'sha256:ae67d08f0081cbcbea0eb716419f591ed18c1e3a9d21c53fd4d96a0dddff660c', '2026-11-07 01:17:18.141685', '2026-10-08 01:17:18.141931', None)
2026-10-07 20:17:18,145 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44108 - "POST /api/v1/auth/login HTTP/1.1" 200 OK
2026-10-07 20:17:18,171 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,172 INFO sqlalchemy.engine.Engine DELETE FROM user_sessions WHERE user_sessions.session_id IN (?, ?)
2026-10-07 20:17:18,172 INFO sqlalchemy.engine.Engine [cached since 0.6406s ago] ('3e50fc48ab126719678fc4f38a49e5a249d2533e108e2e5297d8d37c839b6115', 'hDEaSD4HERHEG1gqu1sBjxehGbVhZtYQAPNPNZg_8A8')
2026-10-07 20:17:18,176 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:18,176 INFO sqlalchemy.engine.Engine [cached since 2.78s ago] ('sha256:ae67d08f0081cbcbea0eb716419f591ed18c1e3a9d21c53fd4d96a0dddff660c',)
2026-10-07 20:17:18,180 INFO sqlalchemy.engine.Engine UPDATE refresh_tokens SET revoked_at=? WHERE refresh_tokens.id = ?
2026-10-07 20:17:18,180 INFO sqlalchemy.engine.Engine [cached since 2.775s ago] ('2026-10-08 01:17:18.180106', 12)
2026-10-07 20:17:18,183 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44108 - "POST /api/v1/auth/logout HTTP/1.1" 200 OK
2026-10-07 20:17:18,207 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,207 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.token_hash = ?
2026-10-07 20:17:18,207 INFO sqlalchemy.engine.Engine [cached since 2.81s ago] ('sha256:ae67d08f0081cbcbea0eb716419f591ed18c1e3a9d21c53fd4d96a0dddff660c',)
2026-10-07 20:17:18,211 INFO sqlalchemy.engine.Engine SELECT refresh_tokens.id, refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at, refresh_tokens.created_at, refresh_tokens.revoked_at 
FROM refresh_tokens 
WHERE refresh_tokens.revoked_at IS NULL AND refresh_tokens.expires_at > ? ORDER BY refresh_tokens.created_at DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:18,211 INFO sqlalchemy.engine.Engine [cached since 2.1s ago] ('2026-10-08 01:17:18.211166', 100, 0)
2026-10-07 20:17:18,229 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44108 - "POST /api/v1/auth/token/refresh HTTP/1.1" 401 Unauthorized
PASSED [ 16%]
tests/test_auth_workflows.py::TestProtectedEndpoints::test_protected_endpoint_requires_auth 2026-10-07 20:17:18,240 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:18,240 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:18,240 INFO sqlalchemy.engine.Engine [cached since 11.08s ago] ('pending', '2026-10-08 01:17:18.240695', 'running', '2026-10-08 01:07:18.239973')
INFO:sqlalchemy.engine.Engine:[cached since 11.08s ago] ('pending', '2026-10-08 01:17:18.240695', 'running', '2026-10-08 01:07:18.239973')
2026-10-07 20:17:18,241 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:18,241 INFO sqlalchemy.engine.Engine [cached since 11.07s ago] ('pending', '2026-10-08 01:17:18.241237', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 11.07s ago] ('pending', '2026-10-08 01:17:18.241237', 20, 0)
2026-10-07 20:17:18,242 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:44122 - "GET /api/v1/users/me HTTP/1.1" 401 Unauthorized
PASSED [ 17%]
tests/test_auth_workflows.py::TestProtectedEndpoints::test_invalid_token_rejected INFO:     127.0.0.1:44134 - "GET /api/v1/users/me HTTP/1.1" 401 Unauthorized
PASSED [ 19%]
tests/test_auth_workflows.py::TestProtectedEndpoints::test_expired_token_rejected INFO:     127.0.0.1:44136 - "GET /api/v1/users/me HTTP/1.1" 401 Unauthorized
PASSED [ 20%]
tests/test_auth_workflows.py::TestApiTokens::test_api_token_create_use_revoke 2026-10-07 20:17:18,296 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,297 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:18,297 INFO sqlalchemy.engine.Engine [cached since 7.146s ago] ('test_20261007201718292252@test.example.com',)
2026-10-07 20:17:18,490 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:18,490 INFO sqlalchemy.engine.Engine [cached since 7.128s ago] ('test_20261007201718292252@test.example.com', 'Test User', '$2b$12$E/bs4RS5iSzCVypJeO8JhOI1pg6Rzjkkag7QJy0zA52GU6bp3irgC', 0, 'free', 0, 0, '2026-10-08 01:17:18.490005', None, None, None, None, '2026-10-08 01:17:18.490010', '2026-10-08 01:17:18.490011')
2026-10-07 20:17:18,518 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,520 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,521 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,521 INFO sqlalchemy.engine.Engine [cached since 7.143s ago] (13,)
2026-10-07 20:17:18,527 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:18,527 INFO sqlalchemy.engine.Engine [cached since 7.134s ago] (13, 'Email: test_20261007201718292252@test.example.com', 'autosub:default')
2026-10-07 20:17:18,531 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:18,531 INFO sqlalchemy.engine.Engine [cached since 7.094s ago] (13, None, 'Email: test_20261007201718292252@test.example.com', <memory at 0x7f5ce00734c0>, 'autosub:default', 1, None, None, '2026-10-08 01:17:18.531779', '2026-10-08 01:17:18.531781')
2026-10-07 20:17:18,536 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:18,536 INFO sqlalchemy.engine.Engine [cached since 7.092s ago] ('email', <memory at 0x7f5ce00734c0>, '2026-10-08 01:17:18.536042', 12)
2026-10-07 20:17:18,539 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:18,553 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,554 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:18,554 INFO sqlalchemy.engine.Engine [cached since 6.677s ago] ('72976ce4bc0a653eec8709563541ab8cf6e425b7d2f70f518bb231e5bb74c7aa', 13, '2026-10-08 01:17:18.554129', '2026-10-15 01:17:18.553658')
INFO:     127.0.0.1:44142 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:18,588 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,593 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,594 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,594 INFO sqlalchemy.engine.Engine [cached since 6.228s ago] (13,)
2026-10-07 20:17:18,598 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:18,598 INFO sqlalchemy.engine.Engine [cached since 6.228s ago] (1, '2026-10-08 01:17:18.598368', 13)
2026-10-07 20:17:18,601 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44142 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxMywiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzE4MjkyMjUyQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODYzOCwiaWF0IjoxNzkxNDIyMjM4fQ.Fng1tFk_fa4Z4Dl_2Fe7XbZCdoyjiHKGdMnsjGNPfos HTTP/1.1" 200 OK
2026-10-07 20:17:18,638 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,638 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,638 INFO sqlalchemy.engine.Engine [cached since 6.272s ago] (13,)
2026-10-07 20:17:18,642 INFO sqlalchemy.engine.Engine INSERT INTO api_tokens (user_id, name, token_hash, scope, expires_at, last_used_at, revoked_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:18,642 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (13, 'ci token', 'sha256:bdc173e4bd68d6ffbc5b64b7a8a937de1aed3ec58e5a05a6282c0b65d764a51d', 'read', None, None, None, '2026-10-08 01:17:18.642750', '2026-10-08 01:17:18.642752')
2026-10-07 20:17:18,646 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,648 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,649 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.id = ?
2026-10-07 20:17:18,649 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1,)
INFO:     127.0.0.1:44142 - "POST /api/v1/users/me/tokens HTTP/1.1" 201 Created
2026-10-07 20:17:18,673 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,678 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,678 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.token_hash = ? AND api_tokens.revoked_at IS NULL
2026-10-07 20:17:18,678 INFO sqlalchemy.engine.Engine [generated in 0.00012s] ('sha256:bdc173e4bd68d6ffbc5b64b7a8a937de1aed3ec58e5a05a6282c0b65d764a51d',)
2026-10-07 20:17:18,682 INFO sqlalchemy.engine.Engine UPDATE api_tokens SET last_used_at=?, updated_at=? WHERE api_tokens.id = ?
2026-10-07 20:17:18,682 INFO sqlalchemy.engine.Engine [generated in 0.00013s] ('2026-10-08 01:17:18.682360', '2026-10-08 01:17:18.682721', 1)
2026-10-07 20:17:18,686 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,688 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,688 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,688 INFO sqlalchemy.engine.Engine [cached since 6.323s ago] (13,)
INFO:     127.0.0.1:44142 - "GET /api/v1/users/me HTTP/1.1" 200 OK
2026-10-07 20:17:18,709 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,714 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,714 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,714 INFO sqlalchemy.engine.Engine [cached since 6.349s ago] (13,)
2026-10-07 20:17:18,719 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.user_id = ? AND api_tokens.revoked_at IS NULL ORDER BY api_tokens.created_at DESC
2026-10-07 20:17:18,719 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (13,)
INFO:     127.0.0.1:44142 - "GET /api/v1/users/me/tokens HTTP/1.1" 200 OK
2026-10-07 20:17:18,739 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:18,743 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,743 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:18,743 INFO sqlalchemy.engine.Engine [cached since 6.378s ago] (13,)
2026-10-07 20:17:18,747 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.id = ? AND api_tokens.user_id = ?
2026-10-07 20:17:18,747 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (1, 13)
2026-10-07 20:17:18,751 INFO sqlalchemy.engine.Engine UPDATE api_tokens SET revoked_at=?, updated_at=? WHERE api_tokens.id = ?
2026-10-07 20:17:18,751 INFO sqlalchemy.engine.Engine [generated in 0.00011s] ('2026-10-08 01:17:18.751328', '2026-10-08 01:17:18.751621', 1)
2026-10-07 20:17:18,755 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44142 - "DELETE /api/v1/users/me/tokens/1 HTTP/1.1" 200 OK
2026-10-07 20:17:18,781 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,781 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.token_hash = ? AND api_tokens.revoked_at IS NULL
2026-10-07 20:17:18,781 INFO sqlalchemy.engine.Engine [cached since 0.1026s ago] ('sha256:bdc173e4bd68d6ffbc5b64b7a8a937de1aed3ec58e5a05a6282c0b65d764a51d',)
2026-10-07 20:17:18,785 INFO sqlalchemy.engine.Engine SELECT api_tokens.id, api_tokens.user_id, api_tokens.name, api_tokens.token_hash, api_tokens.scope, api_tokens.expires_at, api_tokens.last_used_at, api_tokens.revoked_at, api_tokens.created_at, api_tokens.updated_at 
FROM api_tokens 
WHERE api_tokens.revoked_at IS NULL ORDER BY api_tokens.created_at DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:18,785 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (100, 0)
2026-10-07 20:17:18,804 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:44142 - "GET /api/v1/users/me HTTP/1.1" 401 Unauthorized
PASSED [ 21%]
tests/test_auto_subscriptions.py::TestOrgAutoSubscription::test_org_member_auto_subscribed_on_event_create 2026-10-07 20:17:18,815 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:18,815 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:18,815 INFO sqlalchemy.engine.Engine [cached since 7.664s ago] ('admin_20261007201718811688@test.example.com',)
2026-10-07 20:17:19,005 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,005 INFO sqlalchemy.engine.Engine [cached since 7.643s ago] ('admin_20261007201718811688@test.example.com', 'Org Admin', '$2b$12$WOfamJ/X8cPj70pcwKepMOT7/OWldaJoOGsPIbig7EdfVHc.kLuAi', 0, 'free', 0, 0, '2026-10-08 01:17:19.005204', None, None, None, None, '2026-10-08 01:17:19.005207', '2026-10-08 01:17:19.005208')
2026-10-07 20:17:19,036 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,039 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,039 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,039 INFO sqlalchemy.engine.Engine [cached since 7.661s ago] (14,)
2026-10-07 20:17:19,077 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:19,077 INFO sqlalchemy.engine.Engine [cached since 7.683s ago] (14, 'Email: admin_20261007201718811688@test.example.com', 'autosub:default')
2026-10-07 20:17:19,081 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,081 INFO sqlalchemy.engine.Engine [cached since 7.644s ago] (14, None, 'Email: admin_20261007201718811688@test.example.com', <memory at 0x7f5cbd903d00>, 'autosub:default', 1, None, None, '2026-10-08 01:17:19.081069', '2026-10-08 01:17:19.081071')
2026-10-07 20:17:19,084 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:19,084 INFO sqlalchemy.engine.Engine [cached since 7.641s ago] ('email', <memory at 0x7f5cbd903f40>, '2026-10-08 01:17:19.084706', 13)
2026-10-07 20:17:19,087 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:19,100 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,101 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:19,101 INFO sqlalchemy.engine.Engine [cached since 7.224s ago] ('ad6f45c8ce57cfecd6bf59fa28fb270ad02c009c052b2a4b629c9d86834396d4', 14, '2026-10-08 01:17:19.100932', '2026-10-15 01:17:19.100520')
INFO:     127.0.0.1:44150 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:19,137 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,142 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,142 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,143 INFO sqlalchemy.engine.Engine [cached since 6.777s ago] (14,)
2026-10-07 20:17:19,147 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:19,147 INFO sqlalchemy.engine.Engine [cached since 6.776s ago] (1, '2026-10-08 01:17:19.147070', 14)
2026-10-07 20:17:19,150 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44150 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxNCwiZW1haWwiOiJhZG1pbl8yMDI2MTAwNzIwMTcxODgxMTY4OEB0ZXN0LmV4YW1wbGUuY29tIiwic291cmNlIjpudWxsLCJyZWRpcmVjdF91cmwiOiJodHRwOi8vbG9jYWxob3N0OjUxNzQiLCJleHAiOjE3OTE1MDg2MzksImlhdCI6MTc5MTQyMjIzOX0.cyQs2gu4uxUbFrA5WyP4vAYC8fkMujrn4wpS7KfP36g HTTP/1.1" 200 OK
2026-10-07 20:17:19,183 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,183 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,183 INFO sqlalchemy.engine.Engine [cached since 6.818s ago] (14,)
2026-10-07 20:17:19,190 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,190 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (14,)
2026-10-07 20:17:19,195 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:19,195 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (14, 'admin')
2026-10-07 20:17:19,199 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.slug = ?
2026-10-07 20:17:19,199 INFO sqlalchemy.engine.Engine [generated in 0.00010s] ('test-org-20261007201718811688',)
2026-10-07 20:17:19,203 INFO sqlalchemy.engine.Engine INSERT INTO organizations (name, slug, description, "plan", max_seats, is_active, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, enforce_role_assignments, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,203 INFO sqlalchemy.engine.Engine [generated in 0.00019s] ('Test Org 20261007201718811688', 'test-org-20261007201718811688', None, 'free', 5, 1, 'team', 0, 0, '2026-10-08 01:17:19.203789', 0, None, None, None, None, '2026-10-08 01:17:19.203791', '2026-10-08 01:17:19.203792')
2026-10-07 20:17:19,208 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:19,208 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, 14, 'admin', 1, '2026-10-08 01:17:19.208153')
2026-10-07 20:17:19,211 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44150 - "POST /api/v1/organizations HTTP/1.1" 201 Created
2026-10-07 20:17:19,243 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:19,243 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:19,243 INFO sqlalchemy.engine.Engine [cached since 12.08s ago] ('pending', '2026-10-08 01:17:19.243663', 'running', '2026-10-08 01:07:19.242975')
INFO:sqlalchemy.engine.Engine:[cached since 12.08s ago] ('pending', '2026-10-08 01:17:19.243663', 'running', '2026-10-08 01:07:19.242975')
2026-10-07 20:17:19,244 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:19,244 INFO sqlalchemy.engine.Engine [cached since 12.08s ago] ('pending', '2026-10-08 01:17:19.244219', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 12.08s ago] ('pending', '2026-10-08 01:17:19.244219', 20, 0)
2026-10-07 20:17:19,244 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:19,246 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,247 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:19,247 INFO sqlalchemy.engine.Engine [cached since 8.096s ago] ('member_20261007201718811688@test.example.com',)
2026-10-07 20:17:19,442 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,442 INFO sqlalchemy.engine.Engine [cached since 8.08s ago] ('member_20261007201718811688@test.example.com', 'Org Member', '$2b$12$lZTGUnrMPF2Yn/g5LKuPou4/LV5dm9PYG/6SOV.FK.ZQEPrzVOYnG', 0, 'free', 0, 0, '2026-10-08 01:17:19.442127', None, None, None, None, '2026-10-08 01:17:19.442131', '2026-10-08 01:17:19.442132')
2026-10-07 20:17:19,446 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,449 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,449 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,449 INFO sqlalchemy.engine.Engine [cached since 8.071s ago] (15,)
2026-10-07 20:17:19,453 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:19,453 INFO sqlalchemy.engine.Engine [cached since 8.06s ago] (15, 'Email: member_20261007201718811688@test.example.com', 'autosub:default')
2026-10-07 20:17:19,457 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,457 INFO sqlalchemy.engine.Engine [cached since 8.02s ago] (15, None, 'Email: member_20261007201718811688@test.example.com', <memory at 0x7f5cbe7fcc40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:19.457755', '2026-10-08 01:17:19.457757')
2026-10-07 20:17:19,462 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:19,462 INFO sqlalchemy.engine.Engine [cached since 8.018s ago] ('email', <memory at 0x7f5cbe7fd240>, '2026-10-08 01:17:19.461979', 14)
2026-10-07 20:17:19,465 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:19,478 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,478 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:19,478 INFO sqlalchemy.engine.Engine [cached since 7.601s ago] ('8624350871deaa3794c7983859748cc2a2a10527fdc82783eb4cc7cb50fda295', 15, '2026-10-08 01:17:19.478335', '2026-10-15 01:17:19.477976')
INFO:     127.0.0.1:44150 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:19,508 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,514 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,514 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,514 INFO sqlalchemy.engine.Engine [cached since 7.149s ago] (15,)
2026-10-07 20:17:19,519 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:19,519 INFO sqlalchemy.engine.Engine [cached since 7.149s ago] (1, '2026-10-08 01:17:19.519300', 15)
2026-10-07 20:17:19,523 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44150 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxNSwiZW1haWwiOiJtZW1iZXJfMjAyNjEwMDcyMDE3MTg4MTE2ODhAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjM5LCJpYXQiOjE3OTE0MjIyMzl9.3p6AYI1LYqTy18bfasmAgujjBUYUIe52KKjgCocwQFU HTTP/1.1" 200 OK
2026-10-07 20:17:19,558 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,558 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,558 INFO sqlalchemy.engine.Engine [cached since 7.193s ago] (14,)
2026-10-07 20:17:19,563 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:19,563 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (1,)
2026-10-07 20:17:19,568 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:19,568 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1,)
2026-10-07 20:17:19,572 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:19,572 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (14,)
2026-10-07 20:17:19,576 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:19,576 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1, 14)
2026-10-07 20:17:19,580 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:19,580 INFO sqlalchemy.engine.Engine [cached since 8.43s ago] ('member_20261007201718811688@test.example.com',)
2026-10-07 20:17:19,584 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:19,584 INFO sqlalchemy.engine.Engine [cached since 0.008054s ago] (1, 15)
2026-10-07 20:17:19,589 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.organization_id = ? AND organization_invitations.email = ? AND organization_invitations.status = ?
2026-10-07 20:17:19,589 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, 'member_20261007201718811688@test.example.com', 'pending')
2026-10-07 20:17:19,594 INFO sqlalchemy.engine.Engine INSERT INTO organization_invitations (organization_id, email, invited_by_user_id, role, status, token, expires_at, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,594 INFO sqlalchemy.engine.Engine [generated in 0.00017s] (1, 'member_20261007201718811688@test.example.com', 14, 'member', 'pending', 'cc3ce901-b551-486a-9f3d-f9a3cdc0680c', '2026-10-15 01:17:19.593501', None, '2026-10-08 01:17:19.594126', '2026-10-08 01:17:19.594127')
2026-10-07 20:17:19,598 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44150 - "POST /api/v1/organizations/1/invitations HTTP/1.1" 201 Created
2026-10-07 20:17:19,653 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,653 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,653 INFO sqlalchemy.engine.Engine [cached since 7.288s ago] (15,)
2026-10-07 20:17:19,659 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.token = ?
2026-10-07 20:17:19,659 INFO sqlalchemy.engine.Engine [generated in 0.00011s] ('cc3ce901-b551-486a-9f3d-f9a3cdc0680c',)
2026-10-07 20:17:19,664 INFO sqlalchemy.engine.Engine SELECT organizations.id AS organizations_id, organizations.name AS organizations_name, organizations.slug AS organizations_slug, organizations.description AS organizations_description, organizations."plan" AS organizations_plan, organizations.max_seats AS organizations_max_seats, organizations.is_active AS organizations_is_active, organizations.tier AS organizations_tier, organizations.billable_credits_used_this_month AS organizations_billable_credits_used_this_month, organizations.total_notifications_this_month AS organizations_total_notifications_this_month, organizations.usage_period_start AS organizations_usage_period_start, organizations.enforce_role_assignments AS organizations_enforce_role_assignments, organizations.stripe_customer_id AS organizations_stripe_customer_id, organizations.stripe_subscription_id AS organizations_stripe_subscription_id, organizations.subscription_status AS organizations_subscription_status, organizations.subscription_current_period_end AS organizations_subscription_current_period_end, organizations.created_at AS organizations_created_at, organizations.updated_at AS organizations_updated_at 
FROM organizations 
WHERE organizations.id IN (?)
2026-10-07 20:17:19,664 INFO sqlalchemy.engine.Engine [generated in 0.00016s] (1,)
2026-10-07 20:17:19,669 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:19,669 INFO sqlalchemy.engine.Engine [generated in 0.00015s] (14,)
2026-10-07 20:17:19,674 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:19,674 INFO sqlalchemy.engine.Engine [cached since 0.09781s ago] (1, 15)
2026-10-07 20:17:19,678 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:19,678 INFO sqlalchemy.engine.Engine [cached since 0.4701s ago] (1, 15, 'member', 1, '2026-10-08 01:17:19.678122')
2026-10-07 20:17:19,682 INFO sqlalchemy.engine.Engine UPDATE organization_invitations SET status=?, accepted_at=?, updated_at=? WHERE organization_invitations.id = ?
2026-10-07 20:17:19,682 INFO sqlalchemy.engine.Engine [generated in 0.00012s] ('accepted', '2026-10-08 01:17:19.681658', '2026-10-08 01:17:19.682138', 1)
2026-10-07 20:17:19,685 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44150 - "GET /api/v1/invites/organizations/accept/cc3ce901-b551-486a-9f3d-f9a3cdc0680c HTTP/1.1" 303 See Other
2026-10-07 20:17:19,719 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,719 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,719 INFO sqlalchemy.engine.Engine [cached since 7.354s ago] (15,)
2026-10-07 20:17:19,724 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:19,724 INFO sqlalchemy.engine.Engine [cached since 0.5291s ago] (15, 'admin')
2026-10-07 20:17:19,728 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:19,728 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (15,)
2026-10-07 20:17:19,732 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:19,732 INFO sqlalchemy.engine.Engine [cached since 8.338s ago] (15, 'Critical Alerts', 'autosub:critical')
2026-10-07 20:17:19,736 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,736 INFO sqlalchemy.engine.Engine [cached since 8.299s ago] (15, None, 'Critical Alerts', <memory at 0x7f5cbd806d40>, 'autosub:critical', 1, None, None, '2026-10-08 01:17:19.736253', '2026-10-08 01:17:19.736255')
2026-10-07 20:17:19,740 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:19,740 INFO sqlalchemy.engine.Engine [cached since 8.296s ago] ('gotify', <memory at 0x7f5cbd806ec0>, '2026-10-08 01:17:19.740385', 15)
2026-10-07 20:17:19,780 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,787 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,789 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:19,789 INFO sqlalchemy.engine.Engine [generated in 0.00018s] (15, 10000, 0)
2026-10-07 20:17:19,794 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,794 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,795 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:19,795 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (15,)
INFO:     127.0.0.1:44150 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:19,831 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,837 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,838 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:19,838 INFO sqlalchemy.engine.Engine [cached since 7.472s ago] (14,)
2026-10-07 20:17:19,844 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,844 INFO sqlalchemy.engine.Engine [generated in 0.00017s] ('Critical Incident', None, '2026-10-08 03:17:19.834872', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 14, 1, 'critical', None, None, None, None, '2026-10-08 01:17:19.844106', '2026-10-08 01:17:19.844107')
2026-10-07 20:17:19,849 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:19,849 INFO sqlalchemy.engine.Engine [generated in 0.00016s] ('notifiq-web/1-critical-incident', '2026-10-08 01:17:19.849256', 1)
2026-10-07 20:17:19,853 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:19,853 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (1,)
2026-10-07 20:17:19,857 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organization_id = ? AND events.end_date > ?
2026-10-07 20:17:19,857 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (1, '2026-10-08 01:17:19.856862')
2026-10-07 20:17:19,861 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:19,861 INFO sqlalchemy.engine.Engine [generated in 0.00009s] (1,)
2026-10-07 20:17:19,866 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:19,866 INFO sqlalchemy.engine.Engine [cached since 0.3029s ago] (1,)
2026-10-07 20:17:19,870 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:19,870 INFO sqlalchemy.engine.Engine [cached since 0.3025s ago] (1,)
2026-10-07 20:17:19,876 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:19,876 INFO sqlalchemy.engine.Engine [cached since 0.3039s ago] (14, 15)
2026-10-07 20:17:19,881 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:19,881 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, 14)
2026-10-07 20:17:19,885 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,885 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (14, 'autosub:critical')
2026-10-07 20:17:19,889 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,889 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, 'autosub:critical')
2026-10-07 20:17:19,893 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:19,893 INFO sqlalchemy.engine.Engine [cached since 0.01283s ago] (1, 15)
2026-10-07 20:17:19,898 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,898 INFO sqlalchemy.engine.Engine [cached since 0.01292s ago] (15, 'autosub:critical')
2026-10-07 20:17:19,902 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,902 INFO sqlalchemy.engine.Engine [cached since 0.01289s ago] (1, 'autosub:critical')
2026-10-07 20:17:19,906 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:19,906 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1, 15, 1, '2026-10-08 01:17:19.906480', '2026-10-08 01:17:19.906482')
2026-10-07 20:17:19,910 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:19,910 INFO sqlalchemy.engine.Engine [generated in 0.00022s] (1, 15, None, '2026-10-08 01:17:19.910822')
2026-10-07 20:17:19,915 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,915 INFO sqlalchemy.engine.Engine [cached since 0.03048s ago] (14, 'autosub:default')
2026-10-07 20:17:19,919 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:19,919 INFO sqlalchemy.engine.Engine [cached since 0.03417s ago] (14, 'autosub:critical')
2026-10-07 20:17:19,923 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:19,923 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1, 14, 0, '2026-10-08 01:17:19.923322', '2026-10-08 01:17:19.923324')
2026-10-07 20:17:19,926 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:19,926 INFO sqlalchemy.engine.Engine [cached since 0.01617s ago] (2, 13, 'autosub:default', '2026-10-08 01:17:19.926857')
2026-10-07 20:17:19,930 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:19,937 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:19,938 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:19,938 INFO sqlalchemy.engine.Engine [generated in 0.00016s] ('event-end-1',)
2026-10-07 20:17:19,944 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,944 INFO sqlalchemy.engine.Engine [generated in 0.00026s] ('event_end', 'event-end-1', 1, None, None, '2026-10-15 01:17:19.937426', 'pending', 0, 3, None, '2026-10-08 01:17:19.944463', '2026-10-08 01:17:19.944466')
2026-10-07 20:17:19,950 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:19,950 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (1,)
2026-10-07 20:17:19,955 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:19,955 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (14, 15)
2026-10-07 20:17:19,960 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:19,960 INFO sqlalchemy.engine.Engine [generated in 0.00016s] (1, 2)
2026-10-07 20:17:19,964 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:19,964 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (1, 2)
2026-10-07 20:17:19,969 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:19,969 INFO sqlalchemy.engine.Engine [generated in 0.00017s] (14, 15)
2026-10-07 20:17:19,974 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:19,974 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (1,)
2026-10-07 20:17:19,979 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:19,979 INFO sqlalchemy.engine.Engine [generated in 0.00018s] (1,)
2026-10-07 20:17:19,984 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:19,984 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (2,)
2026-10-07 20:17:19,989 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:19,989 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (2,)
2026-10-07 20:17:19,993 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:19,993 INFO sqlalchemy.engine.Engine [cached since 0.0488s ago] ('notify_subscribers', None, 1, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:19.992912', 'pending', 0, 3, None, '2026-10-08 01:17:19.993101', '2026-10-08 01:17:19.993102')
2026-10-07 20:17:19,996 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44150 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:20,085 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,086 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,086 INFO sqlalchemy.engine.Engine [cached since 7.72s ago] (14,)
2026-10-07 20:17:20,092 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:20,092 INFO sqlalchemy.engine.Engine [generated in 0.00018s] (1,)
2026-10-07 20:17:20,096 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:20,096 INFO sqlalchemy.engine.Engine [cached since 0.1462s ago] (1,)
2026-10-07 20:17:20,100 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:20,100 INFO sqlalchemy.engine.Engine [cached since 0.1455s ago] (14, 15)
2026-10-07 20:17:20,106 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:20,106 INFO sqlalchemy.engine.Engine [cached since 0.1461s ago] (1, 2)
2026-10-07 20:17:20,110 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:20,110 INFO sqlalchemy.engine.Engine [cached since 0.1461s ago] (1, 2)
2026-10-07 20:17:20,116 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:20,116 INFO sqlalchemy.engine.Engine [cached since 0.1472s ago] (14, 15)
2026-10-07 20:17:20,123 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?, ?)
2026-10-07 20:17:20,123 INFO sqlalchemy.engine.Engine [generated in 0.00019s] (1, 15, 14)
INFO:     127.0.0.1:44150 - "GET /api/v1/events/1/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:20,157 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 22%]
tests/test_auto_subscriptions.py::TestOrgAutoSubscription::test_org_member_not_subscribed_without_matching_channel 2026-10-07 20:17:20,168 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,168 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:20,168 INFO sqlalchemy.engine.Engine [cached since 9.017s ago] ('admin2_20261007201720164492@test.example.com',)
2026-10-07 20:17:20,246 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,246 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:20,246 INFO sqlalchemy.engine.Engine [cached since 13.08s ago] ('pending', '2026-10-08 01:17:20.246775', 'running', '2026-10-08 01:07:20.246022')
INFO:sqlalchemy.engine.Engine:[cached since 13.08s ago] ('pending', '2026-10-08 01:17:20.246775', 'running', '2026-10-08 01:07:20.246022')
2026-10-07 20:17:20,247 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:20,247 INFO sqlalchemy.engine.Engine [cached since 13.08s ago] ('pending', '2026-10-08 01:17:20.247323', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 13.08s ago] ('pending', '2026-10-08 01:17:20.247323', 20, 0)
2026-10-07 20:17:20,248 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:20,248 INFO sqlalchemy.engine.Engine [generated in 0.00012s] ('running', '2026-10-08 01:17:20.248756', 2, 'pending')
INFO:sqlalchemy.engine.Engine:[generated in 0.00012s] ('running', '2026-10-08 01:17:20.248756', 2, 'pending')
2026-10-07 20:17:20,249 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:20,252 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,253 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:20,253 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (2,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00011s] (2,)
2026-10-07 20:17:20,359 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,359 INFO sqlalchemy.engine.Engine [cached since 8.997s ago] ('admin2_20261007201720164492@test.example.com', 'Org Admin', '$2b$12$KuqPHWJDxbLmmvIXNVpVqusRKGNb5lNl29OIBHhYd8Ew31cgmOoKa', 0, 'free', 0, 0, '2026-10-08 01:17:20.359595', None, None, None, None, '2026-10-08 01:17:20.359599', '2026-10-08 01:17:20.359600')
2026-10-07 20:17:20,364 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:20,367 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,367 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,367 INFO sqlalchemy.engine.Engine [cached since 8.989s ago] (16,)
2026-10-07 20:17:20,372 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:20,372 INFO sqlalchemy.engine.Engine [cached since 8.978s ago] (16, 'Email: admin2_20261007201720164492@test.example.com', 'autosub:default')
2026-10-07 20:17:20,375 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,376 INFO sqlalchemy.engine.Engine [cached since 8.938s ago] (16, None, 'Email: admin2_20261007201720164492@test.example.com', <memory at 0x7f5cbd807c40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:20.375938', '2026-10-08 01:17:20.375940')
2026-10-07 20:17:20,380 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:20,380 INFO sqlalchemy.engine.Engine [cached since 8.936s ago] ('email', <memory at 0x7f5cbd806b00>, '2026-10-08 01:17:20.380041', 16)
2026-10-07 20:17:20,383 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:20,396 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,397 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:20,397 INFO sqlalchemy.engine.Engine [cached since 8.52s ago] ('4c4b8127390f57362cf7b93e352b816865e882226b4d09eface9fdec8ef02ea2', 16, '2026-10-08 01:17:20.397100', '2026-10-15 01:17:20.396616')
INFO:     127.0.0.1:44154 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:20,432 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:20,433 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,435 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:20,435 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00012s] (1,)
2026-10-07 20:17:20,436 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:20,437 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,438 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,438 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,438 INFO sqlalchemy.engine.Engine [cached since 8.073s ago] (16,)
2026-10-07 20:17:20,440 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:20,440 INFO sqlalchemy.engine.Engine [generated in 0.00009s] (1,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00009s] (1,)
2026-10-07 20:17:20,442 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:20,442 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1, 2)
INFO:sqlalchemy.engine.Engine:[generated in 0.00012s] (1, 2)
2026-10-07 20:17:20,442 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:20,442 INFO sqlalchemy.engine.Engine [cached since 8.072s ago] (1, '2026-10-08 01:17:20.442699', 16)
2026-10-07 20:17:20,443 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:20,443 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (1, 2)
INFO:sqlalchemy.engine.Engine:[generated in 0.00011s] (1, 2)
2026-10-07 20:17:20,445 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:20,445 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (14, 15)
INFO:sqlalchemy.engine.Engine:[generated in 0.00011s] (14, 15)
2026-10-07 20:17:20,446 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:20,446 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:20,446 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (14, 15)
INFO:sqlalchemy.engine.Engine:[generated in 0.00011s] (14, 15)
2026-10-07 20:17:20,451 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:20,451 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (15,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00010s] (15,)
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44154 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxNiwiZW1haWwiOiJhZG1pbjJfMjAyNjEwMDcyMDE3MjAxNjQ0OTJAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjQwLCJpYXQiOjE3OTE0MjIyNDB9.rpWlVXHSVga-ShAZn1DV4wi2B68QNaVQT8BQLOBfzok HTTP/1.1" 200 OK
2026-10-07 20:17:20,484 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,484 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,484 INFO sqlalchemy.engine.Engine [cached since 8.119s ago] (16,)
2026-10-07 20:17:20,490 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,490 INFO sqlalchemy.engine.Engine [cached since 1.3s ago] (16,)
2026-10-07 20:17:20,494 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:20,495 INFO sqlalchemy.engine.Engine [cached since 1.3s ago] (16, 'admin')
2026-10-07 20:17:20,498 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.slug = ?
2026-10-07 20:17:20,498 INFO sqlalchemy.engine.Engine [cached since 1.299s ago] ('test-org-2-20261007201720164492',)
2026-10-07 20:17:20,503 INFO sqlalchemy.engine.Engine INSERT INTO organizations (name, slug, description, "plan", max_seats, is_active, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, enforce_role_assignments, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,503 INFO sqlalchemy.engine.Engine [cached since 1.299s ago] ('Test Org 2 20261007201720164492', 'test-org-2-20261007201720164492', None, 'free', 5, 1, 'team', 0, 0, '2026-10-08 01:17:20.503005', 0, None, None, None, None, '2026-10-08 01:17:20.503008', '2026-10-08 01:17:20.503009')
2026-10-07 20:17:20,507 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:20,507 INFO sqlalchemy.engine.Engine [cached since 1.299s ago] (2, 16, 'admin', 1, '2026-10-08 01:17:20.507466')
2026-10-07 20:17:20,511 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44154 - "POST /api/v1/organizations HTTP/1.1" 201 Created
2026-10-07 20:17:20,554 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:20,554 INFO sqlalchemy.engine.Engine [cached since 0.1033s ago] (13,)
INFO:sqlalchemy.engine.Engine:[cached since 0.1033s ago] (13,)
2026-10-07 20:17:20,555 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,556 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:20,556 INFO sqlalchemy.engine.Engine [cached since 9.405s ago] ('member2_20261007201720164492@test.example.com',)
2026-10-07 20:17:20,558 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:20,558 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (14,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00011s] (14,)
2026-10-07 20:17:20,558 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to admin_20261007201718811688@test.example.com
2026-10-07 20:17:20,609 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,611 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:20,611 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (1,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00014s] (1,)
2026-10-07 20:17:20,614 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:20,614 INFO sqlalchemy.engine.Engine [generated in 0.00021s] (1, '2026-10-08 01:17:20.614057', 1)
INFO:sqlalchemy.engine.Engine:[generated in 0.00021s] (1, '2026-10-08 01:17:20.614057', 1)
2026-10-07 20:17:20,615 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:20,618 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:20,618 INFO sqlalchemy.engine.Engine [generated in 0.00013s] ('done', '2026-10-08 01:17:20.618293', 2)
INFO:sqlalchemy.engine.Engine:[generated in 0.00013s] ('done', '2026-10-08 01:17:20.618293', 2)
2026-10-07 20:17:20,619 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:20,621 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:20,622 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:20,622 INFO sqlalchemy.engine.Engine [cached since 13.46s ago] ('pending', '2026-10-08 01:17:20.622042', 'running', '2026-10-08 01:07:20.621454')
INFO:sqlalchemy.engine.Engine:[cached since 13.46s ago] ('pending', '2026-10-08 01:17:20.622042', 'running', '2026-10-08 01:07:20.621454')
2026-10-07 20:17:20,622 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:20,622 INFO sqlalchemy.engine.Engine [cached since 13.45s ago] ('pending', '2026-10-08 01:17:20.622594', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 13.45s ago] ('pending', '2026-10-08 01:17:20.622594', 20, 0)
2026-10-07 20:17:20,623 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:20,755 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,756 INFO sqlalchemy.engine.Engine [cached since 9.394s ago] ('member2_20261007201720164492@test.example.com', 'Org Member', '$2b$12$JyysoC.tIgV7MfYv4.O/9Ou9yyno5XSNCzXGzb7OFrbITXAYUtWcW', 0, 'free', 0, 0, '2026-10-08 01:17:20.755822', None, None, None, None, '2026-10-08 01:17:20.755826', '2026-10-08 01:17:20.755827')
2026-10-07 20:17:20,760 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:20,763 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,763 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,763 INFO sqlalchemy.engine.Engine [cached since 9.385s ago] (17,)
2026-10-07 20:17:20,768 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:20,768 INFO sqlalchemy.engine.Engine [cached since 9.374s ago] (17, 'Email: member2_20261007201720164492@test.example.com', 'autosub:default')
2026-10-07 20:17:20,772 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,772 INFO sqlalchemy.engine.Engine [cached since 9.335s ago] (17, None, 'Email: member2_20261007201720164492@test.example.com', <memory at 0x7f5cbd807940>, 'autosub:default', 1, None, None, '2026-10-08 01:17:20.772127', '2026-10-08 01:17:20.772129')
2026-10-07 20:17:20,776 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:20,776 INFO sqlalchemy.engine.Engine [cached since 9.332s ago] ('email', <memory at 0x7f5cbd807c40>, '2026-10-08 01:17:20.776204', 17)
2026-10-07 20:17:20,779 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:20,793 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,793 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:20,793 INFO sqlalchemy.engine.Engine [cached since 8.916s ago] ('1ae180f524d67a96db0d6c8850bb2703403f66d12ed371801f571f9eb7e9562e', 17, '2026-10-08 01:17:20.793171', '2026-10-15 01:17:20.792744')
INFO:     127.0.0.1:44154 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:20,827 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:20,833 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,834 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,834 INFO sqlalchemy.engine.Engine [cached since 8.468s ago] (17,)
2026-10-07 20:17:20,838 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:20,838 INFO sqlalchemy.engine.Engine [cached since 8.468s ago] (1, '2026-10-08 01:17:20.838659', 17)
2026-10-07 20:17:20,842 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44154 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxNywiZW1haWwiOiJtZW1iZXIyXzIwMjYxMDA3MjAxNzIwMTY0NDkyQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0MCwiaWF0IjoxNzkxNDIyMjQwfQ.ckbqoq3YqV9AWasKEmz24sGQNrLB0RTY8KlTkEwpcA4 HTTP/1.1" 200 OK
2026-10-07 20:17:20,880 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,880 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,880 INFO sqlalchemy.engine.Engine [cached since 8.515s ago] (16,)
2026-10-07 20:17:20,885 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:20,885 INFO sqlalchemy.engine.Engine [cached since 1.322s ago] (2,)
2026-10-07 20:17:20,889 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:20,889 INFO sqlalchemy.engine.Engine [cached since 1.321s ago] (2,)
2026-10-07 20:17:20,893 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:20,893 INFO sqlalchemy.engine.Engine [cached since 1.321s ago] (16,)
2026-10-07 20:17:20,897 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:20,897 INFO sqlalchemy.engine.Engine [cached since 1.321s ago] (2, 16)
2026-10-07 20:17:20,900 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:20,900 INFO sqlalchemy.engine.Engine [cached since 9.749s ago] ('member2_20261007201720164492@test.example.com',)
2026-10-07 20:17:20,904 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:20,904 INFO sqlalchemy.engine.Engine [cached since 1.328s ago] (2, 17)
2026-10-07 20:17:20,908 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.organization_id = ? AND organization_invitations.email = ? AND organization_invitations.status = ?
2026-10-07 20:17:20,908 INFO sqlalchemy.engine.Engine [cached since 1.32s ago] (2, 'member2_20261007201720164492@test.example.com', 'pending')
2026-10-07 20:17:20,912 INFO sqlalchemy.engine.Engine INSERT INTO organization_invitations (organization_id, email, invited_by_user_id, role, status, token, expires_at, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:20,912 INFO sqlalchemy.engine.Engine [cached since 1.318s ago] (2, 'member2_20261007201720164492@test.example.com', 16, 'member', 'pending', '8970d2e0-f928-47bb-bdc4-aef74c661db1', '2026-10-15 01:17:20.912205', None, '2026-10-08 01:17:20.912402', '2026-10-08 01:17:20.912404')
2026-10-07 20:17:20,916 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44154 - "POST /api/v1/organizations/2/invitations HTTP/1.1" 201 Created
2026-10-07 20:17:20,969 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:20,969 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:20,969 INFO sqlalchemy.engine.Engine [cached since 8.604s ago] (17,)
2026-10-07 20:17:20,974 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.token = ?
2026-10-07 20:17:20,974 INFO sqlalchemy.engine.Engine [cached since 1.316s ago] ('8970d2e0-f928-47bb-bdc4-aef74c661db1',)
2026-10-07 20:17:20,979 INFO sqlalchemy.engine.Engine SELECT organizations.id AS organizations_id, organizations.name AS organizations_name, organizations.slug AS organizations_slug, organizations.description AS organizations_description, organizations."plan" AS organizations_plan, organizations.max_seats AS organizations_max_seats, organizations.is_active AS organizations_is_active, organizations.tier AS organizations_tier, organizations.billable_credits_used_this_month AS organizations_billable_credits_used_this_month, organizations.total_notifications_this_month AS organizations_total_notifications_this_month, organizations.usage_period_start AS organizations_usage_period_start, organizations.enforce_role_assignments AS organizations_enforce_role_assignments, organizations.stripe_customer_id AS organizations_stripe_customer_id, organizations.stripe_subscription_id AS organizations_stripe_subscription_id, organizations.subscription_status AS organizations_subscription_status, organizations.subscription_current_period_end AS organizations_subscription_current_period_end, organizations.created_at AS organizations_created_at, organizations.updated_at AS organizations_updated_at 
FROM organizations 
WHERE organizations.id IN (?)
2026-10-07 20:17:20,979 INFO sqlalchemy.engine.Engine [cached since 1.315s ago] (2,)
2026-10-07 20:17:20,983 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:20,983 INFO sqlalchemy.engine.Engine [cached since 1.314s ago] (16,)
2026-10-07 20:17:20,987 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:20,987 INFO sqlalchemy.engine.Engine [cached since 1.411s ago] (2, 17)
2026-10-07 20:17:20,990 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:20,990 INFO sqlalchemy.engine.Engine [cached since 1.783s ago] (2, 17, 'member', 1, '2026-10-08 01:17:20.990745')
2026-10-07 20:17:20,994 INFO sqlalchemy.engine.Engine UPDATE organization_invitations SET status=?, accepted_at=?, updated_at=? WHERE organization_invitations.id = ?
2026-10-07 20:17:20,994 INFO sqlalchemy.engine.Engine [cached since 1.313s ago] ('accepted', '2026-10-08 01:17:20.994409', '2026-10-08 01:17:20.994659', 2)
2026-10-07 20:17:20,998 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44154 - "GET /api/v1/invites/organizations/accept/8970d2e0-f928-47bb-bdc4-aef74c661db1 HTTP/1.1" 303 See Other
2026-10-07 20:17:21,036 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,037 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,037 INFO sqlalchemy.engine.Engine [cached since 8.671s ago] (16,)
2026-10-07 20:17:21,042 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,042 INFO sqlalchemy.engine.Engine [cached since 1.198s ago] ('Critical Incident 2', None, '2026-10-08 03:17:21.034335', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 16, 2, 'critical', None, None, None, None, '2026-10-08 01:17:21.042004', '2026-10-08 01:17:21.042006')
2026-10-07 20:17:21,046 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:21,046 INFO sqlalchemy.engine.Engine [cached since 1.197s ago] ('notifiq-web/2-critical-incident-2', '2026-10-08 01:17:21.046410', 2)
2026-10-07 20:17:21,050 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:21,050 INFO sqlalchemy.engine.Engine [cached since 1.197s ago] (2,)
2026-10-07 20:17:21,054 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organization_id = ? AND events.end_date > ?
2026-10-07 20:17:21,054 INFO sqlalchemy.engine.Engine [cached since 1.197s ago] (2, '2026-10-08 01:17:21.053878')
2026-10-07 20:17:21,057 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:21,057 INFO sqlalchemy.engine.Engine [cached since 1.196s ago] (2,)
2026-10-07 20:17:21,061 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:21,061 INFO sqlalchemy.engine.Engine [cached since 1.498s ago] (2,)
2026-10-07 20:17:21,065 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:21,065 INFO sqlalchemy.engine.Engine [cached since 1.497s ago] (2,)
2026-10-07 20:17:21,069 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:21,069 INFO sqlalchemy.engine.Engine [cached since 1.497s ago] (16, 17)
2026-10-07 20:17:21,072 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:21,072 INFO sqlalchemy.engine.Engine [cached since 1.192s ago] (2, 16)
2026-10-07 20:17:21,076 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,076 INFO sqlalchemy.engine.Engine [cached since 1.191s ago] (16, 'autosub:critical')
2026-10-07 20:17:21,080 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,080 INFO sqlalchemy.engine.Engine [cached since 1.191s ago] (2, 'autosub:critical')
2026-10-07 20:17:21,084 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:21,084 INFO sqlalchemy.engine.Engine [cached since 1.203s ago] (2, 17)
2026-10-07 20:17:21,087 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,087 INFO sqlalchemy.engine.Engine [cached since 1.202s ago] (17, 'autosub:critical')
2026-10-07 20:17:21,091 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,091 INFO sqlalchemy.engine.Engine [cached since 1.202s ago] (2, 'autosub:critical')
2026-10-07 20:17:21,096 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,096 INFO sqlalchemy.engine.Engine [cached since 1.211s ago] (16, 'autosub:default')
2026-10-07 20:17:21,100 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:21,100 INFO sqlalchemy.engine.Engine [cached since 1.215s ago] (16, 'autosub:critical')
2026-10-07 20:17:21,104 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:21,104 INFO sqlalchemy.engine.Engine [cached since 1.181s ago] (2, 16, 0, '2026-10-08 01:17:21.104578', '2026-10-08 01:17:21.104581')
2026-10-07 20:17:21,109 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:21,109 INFO sqlalchemy.engine.Engine [cached since 1.198s ago] (3, 16, 'autosub:default', '2026-10-08 01:17:21.109009')
2026-10-07 20:17:21,112 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:21,120 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,121 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:21,121 INFO sqlalchemy.engine.Engine [cached since 1.183s ago] ('event-end-2',)
2026-10-07 20:17:21,127 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,127 INFO sqlalchemy.engine.Engine [cached since 1.183s ago] ('event_end', 'event-end-2', 2, None, None, '2026-10-15 01:17:21.120452', 'pending', 0, 3, None, '2026-10-08 01:17:21.127247', '2026-10-08 01:17:21.127250')
2026-10-07 20:17:21,131 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:21,131 INFO sqlalchemy.engine.Engine [cached since 1.181s ago] (2,)
2026-10-07 20:17:21,135 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:21,135 INFO sqlalchemy.engine.Engine [cached since 1.18s ago] (16,)
2026-10-07 20:17:21,139 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:21,139 INFO sqlalchemy.engine.Engine [cached since 1.18s ago] (3,)
2026-10-07 20:17:21,143 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:21,143 INFO sqlalchemy.engine.Engine [cached since 1.179s ago] (3,)
2026-10-07 20:17:21,147 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:21,147 INFO sqlalchemy.engine.Engine [cached since 1.178s ago] (16,)
2026-10-07 20:17:21,152 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:21,152 INFO sqlalchemy.engine.Engine [cached since 1.167s ago] (3,)
2026-10-07 20:17:21,156 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:21,156 INFO sqlalchemy.engine.Engine [cached since 1.167s ago] (3,)
2026-10-07 20:17:21,159 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,159 INFO sqlalchemy.engine.Engine [cached since 1.216s ago] ('notify_subscribers', None, 2, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:21.159715', 'pending', 0, 3, None, '2026-10-08 01:17:21.159897', '2026-10-08 01:17:21.159899')
2026-10-07 20:17:21,163 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44154 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:21,245 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,245 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,245 INFO sqlalchemy.engine.Engine [cached since 8.879s ago] (16,)
2026-10-07 20:17:21,250 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:21,250 INFO sqlalchemy.engine.Engine [cached since 1.158s ago] (2,)
2026-10-07 20:17:21,253 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:21,253 INFO sqlalchemy.engine.Engine [cached since 1.303s ago] (2,)
2026-10-07 20:17:21,258 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:21,258 INFO sqlalchemy.engine.Engine [cached since 1.303s ago] (16,)
2026-10-07 20:17:21,262 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:21,262 INFO sqlalchemy.engine.Engine [cached since 1.303s ago] (3,)
2026-10-07 20:17:21,266 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:21,266 INFO sqlalchemy.engine.Engine [cached since 1.302s ago] (3,)
2026-10-07 20:17:21,270 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:21,270 INFO sqlalchemy.engine.Engine [cached since 1.301s ago] (16,)
2026-10-07 20:17:21,274 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?)
2026-10-07 20:17:21,274 INFO sqlalchemy.engine.Engine [cached since 1.151s ago] (2, 16)
INFO:     127.0.0.1:44154 - "GET /api/v1/events/2/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:21,308 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 23%]
tests/test_auto_subscriptions.py::TestEventTagUpdateReconciliation::test_tag_added_subscribes_matching_members 2026-10-07 20:17:21,320 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,320 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:21,320 INFO sqlalchemy.engine.Engine [cached since 10.17s ago] ('admin3_20261007201721315706@test.example.com',)
2026-10-07 20:17:21,511 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,511 INFO sqlalchemy.engine.Engine [cached since 10.15s ago] ('admin3_20261007201721315706@test.example.com', 'Org Admin', '$2b$12$FOblWEue3MRNGN9eUt2frOCu/NExBHDDrth9z9Fv9NqyTGnHHw05.', 0, 'free', 0, 0, '2026-10-08 01:17:21.511062', None, None, None, None, '2026-10-08 01:17:21.511067', '2026-10-08 01:17:21.511068')
2026-10-07 20:17:21,516 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:21,519 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,519 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,519 INFO sqlalchemy.engine.Engine [cached since 10.14s ago] (18,)
2026-10-07 20:17:21,524 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:21,524 INFO sqlalchemy.engine.Engine [cached since 10.13s ago] (18, 'Email: admin3_20261007201721315706@test.example.com', 'autosub:default')
2026-10-07 20:17:21,528 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,528 INFO sqlalchemy.engine.Engine [cached since 10.09s ago] (18, None, 'Email: admin3_20261007201721315706@test.example.com', <memory at 0x7f5cbd807c40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:21.528077', '2026-10-08 01:17:21.528079')
2026-10-07 20:17:21,532 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:21,532 INFO sqlalchemy.engine.Engine [cached since 10.09s ago] ('email', <memory at 0x7f5cbd807c40>, '2026-10-08 01:17:21.532804', 18)
2026-10-07 20:17:21,536 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:21,550 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,550 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:21,550 INFO sqlalchemy.engine.Engine [cached since 9.673s ago] ('55a6abdd04ea8d6d6bc0719111b7d36a89b22d1b6481b56141ca0b597beea41a', 18, '2026-10-08 01:17:21.550242', '2026-10-15 01:17:21.549814')
INFO:     127.0.0.1:44168 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:21,601 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:21,607 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,608 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,608 INFO sqlalchemy.engine.Engine [cached since 9.242s ago] (18,)
2026-10-07 20:17:21,613 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:21,613 INFO sqlalchemy.engine.Engine [cached since 9.242s ago] (1, '2026-10-08 01:17:21.612994', 18)
2026-10-07 20:17:21,616 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:21,625 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:21,626 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:21,626 INFO sqlalchemy.engine.Engine [cached since 14.46s ago] ('pending', '2026-10-08 01:17:21.626157', 'running', '2026-10-08 01:07:21.625036')
INFO:sqlalchemy.engine.Engine:[cached since 14.46s ago] ('pending', '2026-10-08 01:17:21.626157', 'running', '2026-10-08 01:07:21.625036')
2026-10-07 20:17:21,627 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:21,627 INFO sqlalchemy.engine.Engine [cached since 14.46s ago] ('pending', '2026-10-08 01:17:21.626831', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 14.46s ago] ('pending', '2026-10-08 01:17:21.626831', 20, 0)
2026-10-07 20:17:21,628 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:21,628 INFO sqlalchemy.engine.Engine [cached since 1.379s ago] ('running', '2026-10-08 01:17:21.628063', 4, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 1.379s ago] ('running', '2026-10-08 01:17:21.628063', 4, 'pending')
2026-10-07 20:17:21,628 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:21,631 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:21,631 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:21,631 INFO sqlalchemy.engine.Engine [cached since 1.378s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 1.378s ago] (4,)
2026-10-07 20:17:21,632 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:21,632 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:21,632 INFO sqlalchemy.engine.Engine [cached since 1.197s ago] (2,)
INFO:sqlalchemy.engine.Engine:[cached since 1.197s ago] (2,)
2026-10-07 20:17:21,633 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:21,633 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:21,633 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:21,633 INFO sqlalchemy.engine.Engine [cached since 1.193s ago] (2,)
INFO:sqlalchemy.engine.Engine:[cached since 1.193s ago] (2,)
2026-10-07 20:17:21,634 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:21,634 INFO sqlalchemy.engine.Engine [cached since 1.193s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 1.193s ago] (3,)
2026-10-07 20:17:21,635 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:21,635 INFO sqlalchemy.engine.Engine [cached since 1.192s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 1.192s ago] (3,)
2026-10-07 20:17:21,636 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:21,636 INFO sqlalchemy.engine.Engine [cached since 1.191s ago] (16,)
INFO:sqlalchemy.engine.Engine:[cached since 1.191s ago] (16,)
2026-10-07 20:17:21,637 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:21,637 INFO sqlalchemy.engine.Engine [cached since 1.191s ago] (16,)
INFO:sqlalchemy.engine.Engine:[cached since 1.191s ago] (16,)
2026-10-07 20:17:21,638 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:21,638 INFO sqlalchemy.engine.Engine [cached since 1.187s ago] (16,)
INFO:sqlalchemy.engine.Engine:[cached since 1.187s ago] (16,)
2026-10-07 20:17:21,639 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:21,639 INFO sqlalchemy.engine.Engine [cached since 1.081s ago] (16,)
INFO:sqlalchemy.engine.Engine:[cached since 1.081s ago] (16,)
2026-10-07 20:17:21,639 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44168 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxOCwiZW1haWwiOiJhZG1pbjNfMjAyNjEwMDcyMDE3MjEzMTU3MDZAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjQxLCJpYXQiOjE3OTE0MjIyNDF9.3f0MniQcC8nzc08k2Jrs4yPfavh7Sq_3P7WJ45nIgKE HTTP/1.1" 200 OK
INFO:apprise:Sent Email to admin2_20261007201720164492@test.example.com
2026-10-07 20:17:21,651 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:21,651 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:21,651 INFO sqlalchemy.engine.Engine [cached since 1.04s ago] (2,)
INFO:sqlalchemy.engine.Engine:[cached since 1.04s ago] (2,)
2026-10-07 20:17:21,652 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:21,652 INFO sqlalchemy.engine.Engine [cached since 1.039s ago] (1, '2026-10-08 01:17:21.652615', 2)
INFO:sqlalchemy.engine.Engine:[cached since 1.039s ago] (1, '2026-10-08 01:17:21.652615', 2)
2026-10-07 20:17:21,653 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:21,656 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:21,656 INFO sqlalchemy.engine.Engine [cached since 1.038s ago] ('done', '2026-10-08 01:17:21.656060', 4)
INFO:sqlalchemy.engine.Engine:[cached since 1.038s ago] ('done', '2026-10-08 01:17:21.656060', 4)
2026-10-07 20:17:21,656 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:21,657 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,657 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,657 INFO sqlalchemy.engine.Engine [cached since 9.292s ago] (18,)
2026-10-07 20:17:21,659 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:21,660 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:21,660 INFO sqlalchemy.engine.Engine [cached since 14.49s ago] ('pending', '2026-10-08 01:17:21.659988', 'running', '2026-10-08 01:07:21.659353')
INFO:sqlalchemy.engine.Engine:[cached since 14.49s ago] ('pending', '2026-10-08 01:17:21.659988', 'running', '2026-10-08 01:07:21.659353')
2026-10-07 20:17:21,660 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:21,660 INFO sqlalchemy.engine.Engine [cached since 14.49s ago] ('pending', '2026-10-08 01:17:21.660456', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 14.49s ago] ('pending', '2026-10-08 01:17:21.660456', 20, 0)
2026-10-07 20:17:21,661 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:21,666 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,666 INFO sqlalchemy.engine.Engine [cached since 2.476s ago] (18,)
2026-10-07 20:17:21,670 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:21,670 INFO sqlalchemy.engine.Engine [cached since 2.475s ago] (18, 'admin')
2026-10-07 20:17:21,674 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.slug = ?
2026-10-07 20:17:21,674 INFO sqlalchemy.engine.Engine [cached since 2.475s ago] ('test-org-3-20261007201721315706',)
2026-10-07 20:17:21,678 INFO sqlalchemy.engine.Engine INSERT INTO organizations (name, slug, description, "plan", max_seats, is_active, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, enforce_role_assignments, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,679 INFO sqlalchemy.engine.Engine [cached since 2.475s ago] ('Test Org 3 20261007201721315706', 'test-org-3-20261007201721315706', None, 'free', 5, 1, 'team', 0, 0, '2026-10-08 01:17:21.678904', 0, None, None, None, None, '2026-10-08 01:17:21.678907', '2026-10-08 01:17:21.678908')
2026-10-07 20:17:21,683 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:21,683 INFO sqlalchemy.engine.Engine [cached since 2.475s ago] (3, 18, 'admin', 1, '2026-10-08 01:17:21.683357')
2026-10-07 20:17:21,687 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44168 - "POST /api/v1/organizations HTTP/1.1" 201 Created
2026-10-07 20:17:21,726 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,727 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:21,727 INFO sqlalchemy.engine.Engine [cached since 10.58s ago] ('member3_20261007201721315706@test.example.com',)
2026-10-07 20:17:21,921 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,922 INFO sqlalchemy.engine.Engine [cached since 10.56s ago] ('member3_20261007201721315706@test.example.com', 'Org Member', '$2b$12$zq2engE4bixH4GV/O7ecfum2sCSjKMpDl4.7JoDPP7KplBfyd0mQm', 0, 'free', 0, 0, '2026-10-08 01:17:21.921806', None, None, None, None, '2026-10-08 01:17:21.921810', '2026-10-08 01:17:21.921811')
2026-10-07 20:17:21,935 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:21,937 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,938 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:21,938 INFO sqlalchemy.engine.Engine [cached since 10.56s ago] (19,)
2026-10-07 20:17:21,943 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:21,943 INFO sqlalchemy.engine.Engine [cached since 10.55s ago] (19, 'Email: member3_20261007201721315706@test.example.com', 'autosub:default')
2026-10-07 20:17:21,947 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:21,947 INFO sqlalchemy.engine.Engine [cached since 10.51s ago] (19, None, 'Email: member3_20261007201721315706@test.example.com', <memory at 0x7f5cbd807940>, 'autosub:default', 1, None, None, '2026-10-08 01:17:21.947047', '2026-10-08 01:17:21.947049')
2026-10-07 20:17:21,950 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:21,950 INFO sqlalchemy.engine.Engine [cached since 10.51s ago] ('email', <memory at 0x7f5cbd807c40>, '2026-10-08 01:17:21.950816', 19)
2026-10-07 20:17:21,954 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:21,968 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:21,968 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:21,968 INFO sqlalchemy.engine.Engine [cached since 10.09s ago] ('610bb5e6dd154e22a1d111ad38c3342e7d372bdb7fd8b665107decab64be497a', 19, '2026-10-08 01:17:21.968821', '2026-10-15 01:17:21.968400')
INFO:     127.0.0.1:44168 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:22,004 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,009 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,010 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,010 INFO sqlalchemy.engine.Engine [cached since 9.644s ago] (19,)
2026-10-07 20:17:22,014 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:22,014 INFO sqlalchemy.engine.Engine [cached since 9.643s ago] (1, '2026-10-08 01:17:22.014120', 19)
2026-10-07 20:17:22,017 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44168 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoxOSwiZW1haWwiOiJtZW1iZXIzXzIwMjYxMDA3MjAxNzIxMzE1NzA2QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0MSwiaWF0IjoxNzkxNDIyMjQxfQ.TdHbzLSbzUzPfT80cH2y8Hv3OLWZAYnxgqrBbMC8arM HTTP/1.1" 200 OK
2026-10-07 20:17:22,053 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,053 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,053 INFO sqlalchemy.engine.Engine [cached since 9.688s ago] (18,)
2026-10-07 20:17:22,059 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,059 INFO sqlalchemy.engine.Engine [cached since 2.496s ago] (3,)
2026-10-07 20:17:22,063 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:22,063 INFO sqlalchemy.engine.Engine [cached since 2.495s ago] (3,)
2026-10-07 20:17:22,104 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:22,104 INFO sqlalchemy.engine.Engine [cached since 2.532s ago] (18,)
2026-10-07 20:17:22,109 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:22,109 INFO sqlalchemy.engine.Engine [cached since 2.533s ago] (3, 18)
2026-10-07 20:17:22,115 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:22,115 INFO sqlalchemy.engine.Engine [cached since 10.96s ago] ('member3_20261007201721315706@test.example.com',)
2026-10-07 20:17:22,119 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:22,119 INFO sqlalchemy.engine.Engine [cached since 2.543s ago] (3, 19)
2026-10-07 20:17:22,123 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.organization_id = ? AND organization_invitations.email = ? AND organization_invitations.status = ?
2026-10-07 20:17:22,123 INFO sqlalchemy.engine.Engine [cached since 2.535s ago] (3, 'member3_20261007201721315706@test.example.com', 'pending')
2026-10-07 20:17:22,127 INFO sqlalchemy.engine.Engine INSERT INTO organization_invitations (organization_id, email, invited_by_user_id, role, status, token, expires_at, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,127 INFO sqlalchemy.engine.Engine [cached since 2.534s ago] (3, 'member3_20261007201721315706@test.example.com', 18, 'member', 'pending', '12f52acc-a443-4660-a186-4fc07e738acc', '2026-10-15 01:17:22.127324', None, '2026-10-08 01:17:22.127595', '2026-10-08 01:17:22.127597')
2026-10-07 20:17:22,131 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:44168 - "POST /api/v1/organizations/3/invitations HTTP/1.1" 201 Created
2026-10-07 20:17:22,183 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,183 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,183 INFO sqlalchemy.engine.Engine [cached since 9.818s ago] (19,)
2026-10-07 20:17:22,188 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.token = ?
2026-10-07 20:17:22,188 INFO sqlalchemy.engine.Engine [cached since 2.529s ago] ('12f52acc-a443-4660-a186-4fc07e738acc',)
2026-10-07 20:17:22,192 INFO sqlalchemy.engine.Engine SELECT organizations.id AS organizations_id, organizations.name AS organizations_name, organizations.slug AS organizations_slug, organizations.description AS organizations_description, organizations."plan" AS organizations_plan, organizations.max_seats AS organizations_max_seats, organizations.is_active AS organizations_is_active, organizations.tier AS organizations_tier, organizations.billable_credits_used_this_month AS organizations_billable_credits_used_this_month, organizations.total_notifications_this_month AS organizations_total_notifications_this_month, organizations.usage_period_start AS organizations_usage_period_start, organizations.enforce_role_assignments AS organizations_enforce_role_assignments, organizations.stripe_customer_id AS organizations_stripe_customer_id, organizations.stripe_subscription_id AS organizations_stripe_subscription_id, organizations.subscription_status AS organizations_subscription_status, organizations.subscription_current_period_end AS organizations_subscription_current_period_end, organizations.created_at AS organizations_created_at, organizations.updated_at AS organizations_updated_at 
FROM organizations 
WHERE organizations.id IN (?)
2026-10-07 20:17:22,192 INFO sqlalchemy.engine.Engine [cached since 2.528s ago] (3,)
2026-10-07 20:17:22,196 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:22,196 INFO sqlalchemy.engine.Engine [cached since 2.527s ago] (18,)
2026-10-07 20:17:22,200 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:22,200 INFO sqlalchemy.engine.Engine [cached since 2.624s ago] (3, 19)
2026-10-07 20:17:22,204 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:22,204 INFO sqlalchemy.engine.Engine [cached since 2.997s ago] (3, 19, 'member', 1, '2026-10-08 01:17:22.204714')
2026-10-07 20:17:22,209 INFO sqlalchemy.engine.Engine UPDATE organization_invitations SET status=?, accepted_at=?, updated_at=? WHERE organization_invitations.id = ?
2026-10-07 20:17:22,209 INFO sqlalchemy.engine.Engine [cached since 2.527s ago] ('accepted', '2026-10-08 01:17:22.208817', '2026-10-08 01:17:22.209088', 3)
2026-10-07 20:17:22,212 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44168 - "GET /api/v1/invites/organizations/accept/12f52acc-a443-4660-a186-4fc07e738acc HTTP/1.1" 303 See Other
2026-10-07 20:17:22,248 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,249 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,249 INFO sqlalchemy.engine.Engine [cached since 9.883s ago] (19,)
2026-10-07 20:17:22,254 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:22,254 INFO sqlalchemy.engine.Engine [cached since 3.059s ago] (19, 'admin')
2026-10-07 20:17:22,258 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:22,258 INFO sqlalchemy.engine.Engine [cached since 2.53s ago] (19,)
2026-10-07 20:17:22,262 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:22,262 INFO sqlalchemy.engine.Engine [cached since 10.87s ago] (19, 'Urgent Alerts', 'autosub:urgent')
2026-10-07 20:17:22,266 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,266 INFO sqlalchemy.engine.Engine [cached since 10.83s ago] (19, None, 'Urgent Alerts', <memory at 0x7f5cbc1b0dc0>, 'autosub:urgent', 1, None, None, '2026-10-08 01:17:22.266442', '2026-10-08 01:17:22.266444')
2026-10-07 20:17:22,270 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:22,270 INFO sqlalchemy.engine.Engine [cached since 10.83s ago] ('gotify', <memory at 0x7f5cbd806b00>, '2026-10-08 01:17:22.270365', 20)
2026-10-07 20:17:22,273 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,276 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,276 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:22,276 INFO sqlalchemy.engine.Engine [cached since 2.487s ago] (19, 10000, 0)
2026-10-07 20:17:22,280 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,281 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,281 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:22,281 INFO sqlalchemy.engine.Engine [cached since 2.486s ago] (20,)
INFO:     127.0.0.1:44168 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:22,317 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,322 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,323 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,323 INFO sqlalchemy.engine.Engine [cached since 9.957s ago] (18,)
2026-10-07 20:17:22,328 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,328 INFO sqlalchemy.engine.Engine [cached since 2.484s ago] ('Some Incident', None, '2026-10-08 03:17:22.320549', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 18, 3, 'info', None, None, None, None, '2026-10-08 01:17:22.328010', '2026-10-08 01:17:22.328012')
2026-10-07 20:17:22,332 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:22,332 INFO sqlalchemy.engine.Engine [cached since 2.483s ago] ('notifiq-web/3-some-incident', '2026-10-08 01:17:22.332555', 3)
2026-10-07 20:17:22,336 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,336 INFO sqlalchemy.engine.Engine [cached since 2.483s ago] (3,)
2026-10-07 20:17:22,340 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organization_id = ? AND events.end_date > ?
2026-10-07 20:17:22,340 INFO sqlalchemy.engine.Engine [cached since 2.483s ago] (3, '2026-10-08 01:17:22.339723')
2026-10-07 20:17:22,344 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,344 INFO sqlalchemy.engine.Engine [cached since 2.483s ago] (3,)
2026-10-07 20:17:22,347 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,347 INFO sqlalchemy.engine.Engine [cached since 2.784s ago] (3,)
2026-10-07 20:17:22,351 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:22,351 INFO sqlalchemy.engine.Engine [cached since 2.783s ago] (3,)
2026-10-07 20:17:22,355 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:22,355 INFO sqlalchemy.engine.Engine [cached since 2.783s ago] (18, 19)
2026-10-07 20:17:22,360 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:22,360 INFO sqlalchemy.engine.Engine [cached since 2.479s ago] (3, 18)
2026-10-07 20:17:22,364 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,364 INFO sqlalchemy.engine.Engine [cached since 2.479s ago] (18, 'autosub:info')
2026-10-07 20:17:22,368 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,368 INFO sqlalchemy.engine.Engine [cached since 2.479s ago] (3, 'autosub:info')
2026-10-07 20:17:22,372 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:22,372 INFO sqlalchemy.engine.Engine [cached since 2.492s ago] (3, 19)
2026-10-07 20:17:22,377 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,377 INFO sqlalchemy.engine.Engine [cached since 2.492s ago] (19, 'autosub:info')
2026-10-07 20:17:22,381 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,381 INFO sqlalchemy.engine.Engine [cached since 2.492s ago] (3, 'autosub:info')
2026-10-07 20:17:22,384 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,384 INFO sqlalchemy.engine.Engine [cached since 2.5s ago] (18, 'autosub:default')
2026-10-07 20:17:22,388 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,388 INFO sqlalchemy.engine.Engine [cached since 2.503s ago] (18, 'autosub:info')
2026-10-07 20:17:22,392 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:22,392 INFO sqlalchemy.engine.Engine [cached since 2.469s ago] (3, 18, 0, '2026-10-08 01:17:22.392500', '2026-10-08 01:17:22.392501')
2026-10-07 20:17:22,396 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:22,396 INFO sqlalchemy.engine.Engine [cached since 2.486s ago] (4, 18, 'autosub:default', '2026-10-08 01:17:22.396460')
2026-10-07 20:17:22,400 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,403 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,404 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:22,404 INFO sqlalchemy.engine.Engine [cached since 2.466s ago] ('event-end-3',)
2026-10-07 20:17:22,409 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,409 INFO sqlalchemy.engine.Engine [cached since 2.465s ago] ('event_end', 'event-end-3', 3, None, None, '2026-10-15 01:17:22.403673', 'pending', 0, 3, None, '2026-10-08 01:17:22.409072', '2026-10-08 01:17:22.409074')
2026-10-07 20:17:22,413 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,413 INFO sqlalchemy.engine.Engine [cached since 2.463s ago] (3,)
2026-10-07 20:17:22,417 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:22,417 INFO sqlalchemy.engine.Engine [cached since 2.462s ago] (18,)
2026-10-07 20:17:22,421 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:22,421 INFO sqlalchemy.engine.Engine [cached since 2.462s ago] (4,)
2026-10-07 20:17:22,425 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:22,425 INFO sqlalchemy.engine.Engine [cached since 2.461s ago] (4,)
2026-10-07 20:17:22,429 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:22,429 INFO sqlalchemy.engine.Engine [cached since 2.46s ago] (18,)
2026-10-07 20:17:22,433 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:22,433 INFO sqlalchemy.engine.Engine [cached since 2.448s ago] (4,)
2026-10-07 20:17:22,437 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:22,437 INFO sqlalchemy.engine.Engine [cached since 2.448s ago] (4,)
2026-10-07 20:17:22,441 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,441 INFO sqlalchemy.engine.Engine [cached since 2.497s ago] ('notify_subscribers', None, 3, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:22.440898', 'pending', 0, 3, None, '2026-10-08 01:17:22.441067', '2026-10-08 01:17:22.441069')
2026-10-07 20:17:22,444 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:44168 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:22,528 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,529 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,529 INFO sqlalchemy.engine.Engine [cached since 10.16s ago] (18,)
2026-10-07 20:17:22,534 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,534 INFO sqlalchemy.engine.Engine [cached since 2.443s ago] (3,)
2026-10-07 20:17:22,538 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,538 INFO sqlalchemy.engine.Engine [cached since 2.588s ago] (3,)
2026-10-07 20:17:22,542 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:22,542 INFO sqlalchemy.engine.Engine [cached since 2.587s ago] (18,)
2026-10-07 20:17:22,546 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:22,546 INFO sqlalchemy.engine.Engine [cached since 2.587s ago] (4,)
2026-10-07 20:17:22,551 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:22,551 INFO sqlalchemy.engine.Engine [cached since 2.586s ago] (4,)
2026-10-07 20:17:22,556 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:22,556 INFO sqlalchemy.engine.Engine [cached since 2.587s ago] (18,)
2026-10-07 20:17:22,560 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?)
2026-10-07 20:17:22,560 INFO sqlalchemy.engine.Engine [cached since 2.438s ago] (3, 18)
INFO:     127.0.0.1:44168 - "GET /api/v1/events/3/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:22,596 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,602 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,602 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,602 INFO sqlalchemy.engine.Engine [cached since 10.24s ago] (18,)
2026-10-07 20:17:22,607 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,607 INFO sqlalchemy.engine.Engine [cached since 2.515s ago] (3,)
2026-10-07 20:17:22,612 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:22,612 INFO sqlalchemy.engine.Engine [cached since 3.036s ago] (3, 18)
2026-10-07 20:17:22,617 INFO sqlalchemy.engine.Engine UPDATE events SET tags=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:22,617 INFO sqlalchemy.engine.Engine [generated in 0.00016s] ('info,urgent', '2026-10-08 01:17:22.617091', 3)
2026-10-07 20:17:22,621 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,621 INFO sqlalchemy.engine.Engine [cached since 3.058s ago] (3,)
2026-10-07 20:17:22,625 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:22,625 INFO sqlalchemy.engine.Engine [cached since 3.057s ago] (3,)
2026-10-07 20:17:22,629 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:22,629 INFO sqlalchemy.engine.Engine [cached since 3.057s ago] (18, 19)
2026-10-07 20:17:22,634 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,634 INFO sqlalchemy.engine.Engine [cached since 2.684s ago] (3,)
2026-10-07 20:17:22,638 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:22,638 INFO sqlalchemy.engine.Engine [cached since 2.683s ago] (18,)
2026-10-07 20:17:22,643 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:22,643 INFO sqlalchemy.engine.Engine [cached since 2.684s ago] (4,)
2026-10-07 20:17:22,648 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:22,648 INFO sqlalchemy.engine.Engine [cached since 2.683s ago] (4,)
2026-10-07 20:17:22,652 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:22,652 INFO sqlalchemy.engine.Engine [cached since 2.683s ago] (18,)
2026-10-07 20:17:22,656 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:22,656 INFO sqlalchemy.engine.Engine [cached since 2.776s ago] (3, 18)
2026-10-07 20:17:22,661 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:22,661 INFO sqlalchemy.engine.Engine [cached since 2.78s ago] (3, 19)
2026-10-07 20:17:22,662 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,662 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:22,662 INFO sqlalchemy.engine.Engine [cached since 15.5s ago] ('pending', '2026-10-08 01:17:22.662826', 'running', '2026-10-08 01:07:22.661991')
INFO:sqlalchemy.engine.Engine:[cached since 15.5s ago] ('pending', '2026-10-08 01:17:22.662826', 'running', '2026-10-08 01:07:22.661991')
2026-10-07 20:17:22,666 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,666 INFO sqlalchemy.engine.Engine [cached since 2.781s ago] (19, 'autosub:urgent')
2026-10-07 20:17:22,670 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,670 INFO sqlalchemy.engine.Engine [cached since 2.781s ago] (3, 'autosub:urgent')
2026-10-07 20:17:22,674 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,674 INFO sqlalchemy.engine.Engine [cached since 2.789s ago] (19, 'autosub:info')
2026-10-07 20:17:22,678 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:22,678 INFO sqlalchemy.engine.Engine [cached since 2.788s ago] (3, 'autosub:info')
2026-10-07 20:17:22,681 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:22,681 INFO sqlalchemy.engine.Engine [cached since 2.775s ago] (3, 19, 1, '2026-10-08 01:17:22.681820', '2026-10-08 01:17:22.681823')
2026-10-07 20:17:22,686 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:22,686 INFO sqlalchemy.engine.Engine [cached since 2.776s ago] (5, 20, None, '2026-10-08 01:17:22.686200')
2026-10-07 20:17:22,690 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,694 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,694 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,694 INFO sqlalchemy.engine.Engine [cached since 2.833s ago] (3,)
2026-10-07 20:17:22,697 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:22,697 INFO sqlalchemy.engine.Engine [cached since 15.53s ago] ('pending', '2026-10-08 01:17:22.697038', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 15.53s ago] ('pending', '2026-10-08 01:17:22.697038', 20, 0)
2026-10-07 20:17:22,698 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:22,698 INFO sqlalchemy.engine.Engine [cached since 2.45s ago] ('running', '2026-10-08 01:17:22.698326', 6, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 2.45s ago] ('running', '2026-10-08 01:17:22.698326', 6, 'pending')
2026-10-07 20:17:22,699 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine [cached since 2.609s ago] (3,)
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:22,701 INFO sqlalchemy.engine.Engine [cached since 2.448s ago] (6,)
INFO:sqlalchemy.engine.Engine:[cached since 2.448s ago] (6,)
2026-10-07 20:17:22,702 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,702 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,702 INFO sqlalchemy.engine.Engine [cached since 2.267s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.267s ago] (3,)
2026-10-07 20:17:22,702 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,703 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,703 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,703 INFO sqlalchemy.engine.Engine [cached since 2.263s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.263s ago] (3,)
2026-10-07 20:17:22,704 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:22,704 INFO sqlalchemy.engine.Engine [cached since 2.262s ago] (4, 5)
INFO:sqlalchemy.engine.Engine:[cached since 2.262s ago] (4, 5)
2026-10-07 20:17:22,704 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:22,704 INFO sqlalchemy.engine.Engine [cached since 2.261s ago] (4, 5)
INFO:sqlalchemy.engine.Engine:[cached since 2.261s ago] (4, 5)
2026-10-07 20:17:22,705 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:22,705 INFO sqlalchemy.engine.Engine [cached since 2.26s ago] (18, 19)
INFO:sqlalchemy.engine.Engine:[cached since 2.26s ago] (18, 19)
2026-10-07 20:17:22,706 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:22,706 INFO sqlalchemy.engine.Engine [cached since 2.259s ago] (18, 19)
INFO:sqlalchemy.engine.Engine:[cached since 2.259s ago] (18, 19)
2026-10-07 20:17:22,706 INFO sqlalchemy.engine.Engine UPDATE events SET last_notified_at=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:22,706 INFO sqlalchemy.engine.Engine [generated in 0.00016s] ('2026-10-08 01:17:22.705931', '2026-10-08 01:17:22.706427', 3)
2026-10-07 20:17:22,707 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:22,707 INFO sqlalchemy.engine.Engine [cached since 2.256s ago] (18,)
INFO:sqlalchemy.engine.Engine:[cached since 2.256s ago] (18,)
2026-10-07 20:17:22,708 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:22,708 INFO sqlalchemy.engine.Engine [cached since 2.15s ago] (18,)
INFO:sqlalchemy.engine.Engine:[cached since 2.15s ago] (18,)
2026-10-07 20:17:22,709 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:22,709 INFO sqlalchemy.engine.Engine [cached since 2.258s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 2.258s ago] (20,)
2026-10-07 20:17:22,709 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,711 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:22,714 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:22,714 INFO sqlalchemy.engine.Engine [cached since 2.77s ago] ('notify_subscribers', None, 3, None, '{"title": "Event Updated: Some Incident", "body": "The event has been updated. Check the details for changes.", "level": "info"}', '2026-10-08 01:17:22.714066', 'pending', 0, 3, None, '2026-10-08 01:17:22.714279', '2026-10-08 01:17:22.714281')
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:22,718 INFO sqlalchemy.engine.Engine COMMIT
INFO:apprise:Sent Email to admin3_20261007201721315706@test.example.com
2026-10-07 20:17:22,720 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,720 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,720 INFO sqlalchemy.engine.Engine [cached since 2.109s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.109s ago] (3,)
2026-10-07 20:17:22,722 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:22,722 INFO sqlalchemy.engine.Engine [cached since 2.109s ago] (1, '2026-10-08 01:17:22.722412', 3)
INFO:sqlalchemy.engine.Engine:[cached since 2.109s ago] (1, '2026-10-08 01:17:22.722412', 3)
2026-10-07 20:17:22,723 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
2026-10-07 20:17:22,728 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:22,728 INFO sqlalchemy.engine.Engine [cached since 2.11s ago] ('done', '2026-10-08 01:17:22.728615', 6)
INFO:sqlalchemy.engine.Engine:[cached since 2.11s ago] ('done', '2026-10-08 01:17:22.728615', 6)
2026-10-07 20:17:22,729 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,731 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,732 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:22,732 INFO sqlalchemy.engine.Engine [cached since 15.57s ago] ('pending', '2026-10-08 01:17:22.732131', 'running', '2026-10-08 01:07:22.731560')
INFO:sqlalchemy.engine.Engine:[cached since 15.57s ago] ('pending', '2026-10-08 01:17:22.732131', 'running', '2026-10-08 01:07:22.731560')
2026-10-07 20:17:22,732 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:22,732 INFO sqlalchemy.engine.Engine [cached since 15.56s ago] ('pending', '2026-10-08 01:17:22.732566', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 15.56s ago] ('pending', '2026-10-08 01:17:22.732566', 20, 0)
2026-10-07 20:17:22,733 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:22,733 INFO sqlalchemy.engine.Engine [cached since 2.485s ago] ('running', '2026-10-08 01:17:22.733609', 7, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 2.485s ago] ('running', '2026-10-08 01:17:22.733609', 7, 'pending')
2026-10-07 20:17:22,734 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,736 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,736 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:22,736 INFO sqlalchemy.engine.Engine [cached since 2.483s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 2.483s ago] (7,)
2026-10-07 20:17:22,737 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,737 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,737 INFO sqlalchemy.engine.Engine [cached since 2.302s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.302s ago] (3,)
2026-10-07 20:17:22,738 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,738 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,738 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,738 INFO sqlalchemy.engine.Engine [cached since 2.299s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.299s ago] (3,)
2026-10-07 20:17:22,740 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:22,740 INFO sqlalchemy.engine.Engine [cached since 2.299s ago] (4, 5)
INFO:sqlalchemy.engine.Engine:[cached since 2.299s ago] (4, 5)
2026-10-07 20:17:22,741 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:22,741 INFO sqlalchemy.engine.Engine [cached since 2.298s ago] (4, 5)
INFO:sqlalchemy.engine.Engine:[cached since 2.298s ago] (4, 5)
2026-10-07 20:17:22,742 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:22,742 INFO sqlalchemy.engine.Engine [cached since 2.297s ago] (18, 19)
INFO:sqlalchemy.engine.Engine:[cached since 2.297s ago] (18, 19)
2026-10-07 20:17:22,743 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:22,743 INFO sqlalchemy.engine.Engine [cached since 2.297s ago] (18, 19)
INFO:sqlalchemy.engine.Engine:[cached since 2.297s ago] (18, 19)
2026-10-07 20:17:22,744 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:22,744 INFO sqlalchemy.engine.Engine [cached since 2.293s ago] (18,)
INFO:sqlalchemy.engine.Engine:[cached since 2.293s ago] (18,)
2026-10-07 20:17:22,745 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:22,745 INFO sqlalchemy.engine.Engine [cached since 2.188s ago] (18,)
INFO:sqlalchemy.engine.Engine:[cached since 2.188s ago] (18,)
2026-10-07 20:17:22,746 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:22,746 INFO sqlalchemy.engine.Engine [cached since 2.295s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 2.295s ago] (20,)
2026-10-07 20:17:22,747 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to admin3_20261007201721315706@test.example.com
2026-10-07 20:17:22,758 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,758 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:22,758 INFO sqlalchemy.engine.Engine [cached since 2.148s ago] (3,)
INFO:sqlalchemy.engine.Engine:[cached since 2.148s ago] (3,)
2026-10-07 20:17:22,759 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:22,759 INFO sqlalchemy.engine.Engine [cached since 2.146s ago] (2, '2026-10-08 01:17:22.759563', 3)
INFO:sqlalchemy.engine.Engine:[cached since 2.146s ago] (2, '2026-10-08 01:17:22.759563', 3)
2026-10-07 20:17:22,760 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
2026-10-07 20:17:22,765 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:22,765 INFO sqlalchemy.engine.Engine [cached since 2.147s ago] ('done', '2026-10-08 01:17:22.765138', 7)
INFO:sqlalchemy.engine.Engine:[cached since 2.147s ago] ('done', '2026-10-08 01:17:22.765138', 7)
2026-10-07 20:17:22,765 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:22,768 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:22,768 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:22,768 INFO sqlalchemy.engine.Engine [cached since 15.6s ago] ('pending', '2026-10-08 01:17:22.768610', 'running', '2026-10-08 01:07:22.768093')
INFO:sqlalchemy.engine.Engine:[cached since 15.6s ago] ('pending', '2026-10-08 01:17:22.768610', 'running', '2026-10-08 01:07:22.768093')
2026-10-07 20:17:22,769 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:22,769 INFO sqlalchemy.engine.Engine [cached since 15.6s ago] ('pending', '2026-10-08 01:17:22.769070', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 15.6s ago] ('pending', '2026-10-08 01:17:22.769070', 20, 0)
2026-10-07 20:17:22,769 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:44168 - "PUT /api/v1/events/3 HTTP/1.1" 200 OK
2026-10-07 20:17:22,801 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,801 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:22,801 INFO sqlalchemy.engine.Engine [cached since 10.44s ago] (18,)
2026-10-07 20:17:22,806 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:22,806 INFO sqlalchemy.engine.Engine [cached since 2.714s ago] (3,)
2026-10-07 20:17:22,810 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:22,810 INFO sqlalchemy.engine.Engine [cached since 2.859s ago] (3,)
2026-10-07 20:17:22,814 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:22,814 INFO sqlalchemy.engine.Engine [cached since 2.859s ago] (18, 19)
2026-10-07 20:17:22,818 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:22,818 INFO sqlalchemy.engine.Engine [cached since 2.859s ago] (4, 5)
2026-10-07 20:17:22,822 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:22,822 INFO sqlalchemy.engine.Engine [cached since 2.858s ago] (4, 5)
2026-10-07 20:17:22,826 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:22,826 INFO sqlalchemy.engine.Engine [cached since 2.857s ago] (18, 19)
2026-10-07 20:17:22,830 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?, ?)
2026-10-07 20:17:22,830 INFO sqlalchemy.engine.Engine [cached since 2.707s ago] (3, 18, 19)
INFO:     127.0.0.1:44168 - "GET /api/v1/events/3/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:22,863 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 25%]
tests/test_auto_subscriptions.py::TestEventTagUpdateReconciliation::test_tag_removed_unsubscribes_auto_subscribed_members 2026-10-07 20:17:22,873 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:22,873 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:22,873 INFO sqlalchemy.engine.Engine [cached since 11.72s ago] ('admin4_20261007201722870018@test.example.com',)
2026-10-07 20:17:23,063 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,063 INFO sqlalchemy.engine.Engine [cached since 11.7s ago] ('admin4_20261007201722870018@test.example.com', 'Org Admin', '$2b$12$nIDRK2mkDREcnrqagrIqr.almAROotybConkxoNGDB2tEfYUfxR.a', 0, 'free', 0, 0, '2026-10-08 01:17:23.063173', None, None, None, None, '2026-10-08 01:17:23.063177', '2026-10-08 01:17:23.063178')
2026-10-07 20:17:23,068 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,071 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,071 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,071 INFO sqlalchemy.engine.Engine [cached since 11.69s ago] (20,)
2026-10-07 20:17:23,076 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:23,076 INFO sqlalchemy.engine.Engine [cached since 11.68s ago] (20, 'Email: admin4_20261007201722870018@test.example.com', 'autosub:default')
2026-10-07 20:17:23,080 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,080 INFO sqlalchemy.engine.Engine [cached since 11.64s ago] (20, None, 'Email: admin4_20261007201722870018@test.example.com', <memory at 0x7f5cbc1b0e80>, 'autosub:default', 1, None, None, '2026-10-08 01:17:23.080358', '2026-10-08 01:17:23.080360')
2026-10-07 20:17:23,085 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:23,085 INFO sqlalchemy.engine.Engine [cached since 11.64s ago] ('email', <memory at 0x7f5cbc1b0dc0>, '2026-10-08 01:17:23.085234', 21)
2026-10-07 20:17:23,089 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:23,103 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,103 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:23,103 INFO sqlalchemy.engine.Engine [cached since 11.23s ago] ('1e81048e5ca0663cc4956a89144cce354a903c06b1ca4493aa5f4a3736347dbc', 20, '2026-10-08 01:17:23.103377', '2026-10-15 01:17:23.102862')
INFO:     127.0.0.1:35192 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:23,141 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,146 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,146 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,146 INFO sqlalchemy.engine.Engine [cached since 10.78s ago] (20,)
2026-10-07 20:17:23,152 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:23,152 INFO sqlalchemy.engine.Engine [cached since 10.78s ago] (1, '2026-10-08 01:17:23.152161', 20)
2026-10-07 20:17:23,155 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35192 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyMCwiZW1haWwiOiJhZG1pbjRfMjAyNjEwMDcyMDE3MjI4NzAwMThAdGVzdC5leGFtcGxlLmNvbSIsInNvdXJjZSI6bnVsbCwicmVkaXJlY3RfdXJsIjoiaHR0cDovL2xvY2FsaG9zdDo1MTc0IiwiZXhwIjoxNzkxNTA4NjQzLCJpYXQiOjE3OTE0MjIyNDN9.y5dDdt3D6gomQMXUGKa1F4AA-gFSTeJocrATqrv_Mjs HTTP/1.1" 200 OK
2026-10-07 20:17:23,194 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,194 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,194 INFO sqlalchemy.engine.Engine [cached since 10.83s ago] (20,)
2026-10-07 20:17:23,199 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,199 INFO sqlalchemy.engine.Engine [cached since 4.009s ago] (20,)
2026-10-07 20:17:23,203 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:23,203 INFO sqlalchemy.engine.Engine [cached since 4.008s ago] (20, 'admin')
2026-10-07 20:17:23,206 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.slug = ?
2026-10-07 20:17:23,206 INFO sqlalchemy.engine.Engine [cached since 4.007s ago] ('test-org-4-20261007201722870018',)
2026-10-07 20:17:23,210 INFO sqlalchemy.engine.Engine INSERT INTO organizations (name, slug, description, "plan", max_seats, is_active, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, enforce_role_assignments, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,210 INFO sqlalchemy.engine.Engine [cached since 4.007s ago] ('Test Org 4 20261007201722870018', 'test-org-4-20261007201722870018', None, 'free', 5, 1, 'team', 0, 0, '2026-10-08 01:17:23.210827', 0, None, None, None, None, '2026-10-08 01:17:23.210831', '2026-10-08 01:17:23.210832')
2026-10-07 20:17:23,215 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:23,215 INFO sqlalchemy.engine.Engine [cached since 4.008s ago] (4, 20, 'admin', 1, '2026-10-08 01:17:23.215744')
2026-10-07 20:17:23,219 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35192 - "POST /api/v1/organizations HTTP/1.1" 201 Created
2026-10-07 20:17:23,257 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,257 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:23,257 INFO sqlalchemy.engine.Engine [cached since 12.11s ago] ('member4_20261007201722870018@test.example.com',)
2026-10-07 20:17:23,449 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,449 INFO sqlalchemy.engine.Engine [cached since 12.09s ago] ('member4_20261007201722870018@test.example.com', 'Org Member', '$2b$12$MQvO5.Maa/WaUFVQiZdqdu0LZkxzuGPy1Vwf8AH4X1fJedUi1Bcvm', 0, 'free', 0, 0, '2026-10-08 01:17:23.449712', None, None, None, None, '2026-10-08 01:17:23.449716', '2026-10-08 01:17:23.449717')
2026-10-07 20:17:23,472 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,475 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,475 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,475 INFO sqlalchemy.engine.Engine [cached since 12.1s ago] (21,)
2026-10-07 20:17:23,480 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:23,480 INFO sqlalchemy.engine.Engine [cached since 12.09s ago] (21, 'Email: member4_20261007201722870018@test.example.com', 'autosub:default')
2026-10-07 20:17:23,485 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,485 INFO sqlalchemy.engine.Engine [cached since 12.05s ago] (21, None, 'Email: member4_20261007201722870018@test.example.com', <memory at 0x7f5cbc1b13c0>, 'autosub:default', 1, None, None, '2026-10-08 01:17:23.485434', '2026-10-08 01:17:23.485437')
2026-10-07 20:17:23,489 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:23,489 INFO sqlalchemy.engine.Engine [cached since 12.05s ago] ('email', <memory at 0x7f5cbc1b0940>, '2026-10-08 01:17:23.489753', 22)
2026-10-07 20:17:23,493 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:23,506 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,506 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:23,506 INFO sqlalchemy.engine.Engine [cached since 11.63s ago] ('f92c8d3a5823613df6a55d0b7392d8664d9d43c8f438101e2f60feea5b06c699', 21, '2026-10-08 01:17:23.506152', '2026-10-15 01:17:23.505772')
INFO:     127.0.0.1:35192 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:23,539 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,544 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,544 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,544 INFO sqlalchemy.engine.Engine [cached since 11.18s ago] (21,)
2026-10-07 20:17:23,549 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:23,549 INFO sqlalchemy.engine.Engine [cached since 11.18s ago] (1, '2026-10-08 01:17:23.549621', 21)
2026-10-07 20:17:23,553 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35192 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyMSwiZW1haWwiOiJtZW1iZXI0XzIwMjYxMDA3MjAxNzIyODcwMDE4QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0MywiaWF0IjoxNzkxNDIyMjQzfQ.obVwRa-UrZwf8yG8UbToHkAFipTnb0kL8-vN3LMzfNE HTTP/1.1" 200 OK
2026-10-07 20:17:23,590 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,591 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,591 INFO sqlalchemy.engine.Engine [cached since 11.23s ago] (20,)
2026-10-07 20:17:23,597 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:23,597 INFO sqlalchemy.engine.Engine [cached since 4.034s ago] (4,)
2026-10-07 20:17:23,601 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:23,601 INFO sqlalchemy.engine.Engine [cached since 4.033s ago] (4,)
2026-10-07 20:17:23,605 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:23,605 INFO sqlalchemy.engine.Engine [cached since 4.033s ago] (20,)
2026-10-07 20:17:23,609 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:23,609 INFO sqlalchemy.engine.Engine [cached since 4.033s ago] (4, 20)
2026-10-07 20:17:23,648 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:23,648 INFO sqlalchemy.engine.Engine [cached since 12.5s ago] ('member4_20261007201722870018@test.example.com',)
2026-10-07 20:17:23,653 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:23,653 INFO sqlalchemy.engine.Engine [cached since 4.077s ago] (4, 21)
2026-10-07 20:17:23,657 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.organization_id = ? AND organization_invitations.email = ? AND organization_invitations.status = ?
2026-10-07 20:17:23,657 INFO sqlalchemy.engine.Engine [cached since 4.068s ago] (4, 'member4_20261007201722870018@test.example.com', 'pending')
2026-10-07 20:17:23,660 INFO sqlalchemy.engine.Engine INSERT INTO organization_invitations (organization_id, email, invited_by_user_id, role, status, token, expires_at, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,660 INFO sqlalchemy.engine.Engine [cached since 4.067s ago] (4, 'member4_20261007201722870018@test.example.com', 20, 'member', 'pending', 'b8947f67-02e4-491d-885f-ae1a853c6bb2', '2026-10-15 01:17:23.660357', None, '2026-10-08 01:17:23.660559', '2026-10-08 01:17:23.660561')
2026-10-07 20:17:23,664 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35192 - "POST /api/v1/organizations/4/invitations HTTP/1.1" 201 Created
2026-10-07 20:17:23,716 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,716 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,716 INFO sqlalchemy.engine.Engine [cached since 11.35s ago] (21,)
2026-10-07 20:17:23,720 INFO sqlalchemy.engine.Engine SELECT organization_invitations.id, organization_invitations.organization_id, organization_invitations.email, organization_invitations.invited_by_user_id, organization_invitations.role, organization_invitations.status, organization_invitations.token, organization_invitations.expires_at, organization_invitations.accepted_at, organization_invitations.created_at, organization_invitations.updated_at 
FROM organization_invitations 
WHERE organization_invitations.token = ?
2026-10-07 20:17:23,720 INFO sqlalchemy.engine.Engine [cached since 4.062s ago] ('b8947f67-02e4-491d-885f-ae1a853c6bb2',)
2026-10-07 20:17:23,724 INFO sqlalchemy.engine.Engine SELECT organizations.id AS organizations_id, organizations.name AS organizations_name, organizations.slug AS organizations_slug, organizations.description AS organizations_description, organizations."plan" AS organizations_plan, organizations.max_seats AS organizations_max_seats, organizations.is_active AS organizations_is_active, organizations.tier AS organizations_tier, organizations.billable_credits_used_this_month AS organizations_billable_credits_used_this_month, organizations.total_notifications_this_month AS organizations_total_notifications_this_month, organizations.usage_period_start AS organizations_usage_period_start, organizations.enforce_role_assignments AS organizations_enforce_role_assignments, organizations.stripe_customer_id AS organizations_stripe_customer_id, organizations.stripe_subscription_id AS organizations_stripe_subscription_id, organizations.subscription_status AS organizations_subscription_status, organizations.subscription_current_period_end AS organizations_subscription_current_period_end, organizations.created_at AS organizations_created_at, organizations.updated_at AS organizations_updated_at 
FROM organizations 
WHERE organizations.id IN (?)
2026-10-07 20:17:23,724 INFO sqlalchemy.engine.Engine [cached since 4.061s ago] (4,)
2026-10-07 20:17:23,728 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:23,728 INFO sqlalchemy.engine.Engine [cached since 4.059s ago] (20,)
2026-10-07 20:17:23,732 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:23,732 INFO sqlalchemy.engine.Engine [cached since 4.156s ago] (4, 21)
2026-10-07 20:17:23,735 INFO sqlalchemy.engine.Engine INSERT INTO organization_memberships (organization_id, user_id, role, uses_personal_seat, joined_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:23,735 INFO sqlalchemy.engine.Engine [cached since 4.528s ago] (4, 21, 'member', 1, '2026-10-08 01:17:23.735632')
2026-10-07 20:17:23,739 INFO sqlalchemy.engine.Engine UPDATE organization_invitations SET status=?, accepted_at=?, updated_at=? WHERE organization_invitations.id = ?
2026-10-07 20:17:23,739 INFO sqlalchemy.engine.Engine [cached since 4.057s ago] ('accepted', '2026-10-08 01:17:23.739237', '2026-10-08 01:17:23.739468', 4)
2026-10-07 20:17:23,742 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35192 - "GET /api/v1/invites/organizations/accept/b8947f67-02e4-491d-885f-ae1a853c6bb2 HTTP/1.1" 303 See Other
2026-10-07 20:17:23,771 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:23,771 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:23,771 INFO sqlalchemy.engine.Engine [cached since 16.61s ago] ('pending', '2026-10-08 01:17:23.771659', 'running', '2026-10-08 01:07:23.770966')
INFO:sqlalchemy.engine.Engine:[cached since 16.61s ago] ('pending', '2026-10-08 01:17:23.771659', 'running', '2026-10-08 01:07:23.770966')
2026-10-07 20:17:23,772 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:23,772 INFO sqlalchemy.engine.Engine [cached since 16.6s ago] ('pending', '2026-10-08 01:17:23.772170', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 16.6s ago] ('pending', '2026-10-08 01:17:23.772170', 20, 0)
2026-10-07 20:17:23,772 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:23,774 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,774 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,774 INFO sqlalchemy.engine.Engine [cached since 11.41s ago] (21,)
2026-10-07 20:17:23,778 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:23,778 INFO sqlalchemy.engine.Engine [cached since 4.584s ago] (21, 'admin')
2026-10-07 20:17:23,782 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:23,782 INFO sqlalchemy.engine.Engine [cached since 4.054s ago] (21,)
2026-10-07 20:17:23,785 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:23,785 INFO sqlalchemy.engine.Engine [cached since 12.39s ago] (21, 'Critical Alerts', 'autosub:critical')
2026-10-07 20:17:23,789 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,789 INFO sqlalchemy.engine.Engine [cached since 12.35s ago] (21, None, 'Critical Alerts', <memory at 0x7f5cbc1b0c40>, 'autosub:critical', 1, None, None, '2026-10-08 01:17:23.789437', '2026-10-08 01:17:23.789438')
2026-10-07 20:17:23,793 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:23,793 INFO sqlalchemy.engine.Engine [cached since 12.35s ago] ('gotify', <memory at 0x7f5cbc1b0dc0>, '2026-10-08 01:17:23.793173', 23)
2026-10-07 20:17:23,796 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,798 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,798 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:23,798 INFO sqlalchemy.engine.Engine [cached since 4.01s ago] (21, 10000, 0)
2026-10-07 20:17:23,802 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,803 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,803 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:23,803 INFO sqlalchemy.engine.Engine [cached since 4.008s ago] (23,)
INFO:     127.0.0.1:35192 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:23,836 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,841 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,842 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:23,842 INFO sqlalchemy.engine.Engine [cached since 11.48s ago] (20,)
2026-10-07 20:17:23,846 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,846 INFO sqlalchemy.engine.Engine [cached since 4.003s ago] ('Critical Incident', None, '2026-10-08 03:17:23.839558', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 20, 4, 'critical', None, None, None, None, '2026-10-08 01:17:23.846490', '2026-10-08 01:17:23.846491')
2026-10-07 20:17:23,850 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:23,850 INFO sqlalchemy.engine.Engine [cached since 4.002s ago] ('notifiq-web/4-critical-incident', '2026-10-08 01:17:23.850681', 4)
2026-10-07 20:17:23,854 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:23,854 INFO sqlalchemy.engine.Engine [cached since 4.001s ago] (4,)
2026-10-07 20:17:23,858 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organization_id = ? AND events.end_date > ?
2026-10-07 20:17:23,858 INFO sqlalchemy.engine.Engine [cached since 4.001s ago] (4, '2026-10-08 01:17:23.857950')
2026-10-07 20:17:23,861 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:23,861 INFO sqlalchemy.engine.Engine [cached since 4s ago] (4,)
2026-10-07 20:17:23,865 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:23,865 INFO sqlalchemy.engine.Engine [cached since 4.302s ago] (4,)
2026-10-07 20:17:23,869 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:23,869 INFO sqlalchemy.engine.Engine [cached since 4.301s ago] (4,)
2026-10-07 20:17:23,872 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:23,872 INFO sqlalchemy.engine.Engine [cached since 4.3s ago] (20, 21)
2026-10-07 20:17:23,876 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:23,876 INFO sqlalchemy.engine.Engine [cached since 3.996s ago] (4, 20)
2026-10-07 20:17:23,880 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,880 INFO sqlalchemy.engine.Engine [cached since 3.995s ago] (20, 'autosub:critical')
2026-10-07 20:17:23,883 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,884 INFO sqlalchemy.engine.Engine [cached since 3.994s ago] (4, 'autosub:critical')
2026-10-07 20:17:23,887 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:23,887 INFO sqlalchemy.engine.Engine [cached since 4.007s ago] (4, 21)
2026-10-07 20:17:23,891 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,891 INFO sqlalchemy.engine.Engine [cached since 4.006s ago] (21, 'autosub:critical')
2026-10-07 20:17:23,894 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,894 INFO sqlalchemy.engine.Engine [cached since 4.005s ago] (4, 'autosub:critical')
2026-10-07 20:17:23,898 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:23,899 INFO sqlalchemy.engine.Engine [cached since 3.993s ago] (4, 21, 1, '2026-10-08 01:17:23.898893', '2026-10-08 01:17:23.898896')
2026-10-07 20:17:23,902 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:23,903 INFO sqlalchemy.engine.Engine [cached since 3.992s ago] (6, 23, None, '2026-10-08 01:17:23.902934')
2026-10-07 20:17:23,906 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,906 INFO sqlalchemy.engine.Engine [cached since 4.021s ago] (20, 'autosub:default')
2026-10-07 20:17:23,910 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:23,910 INFO sqlalchemy.engine.Engine [cached since 4.025s ago] (20, 'autosub:critical')
2026-10-07 20:17:23,913 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:23,913 INFO sqlalchemy.engine.Engine [cached since 3.991s ago] (4, 20, 0, '2026-10-08 01:17:23.913788', '2026-10-08 01:17:23.913790')
2026-10-07 20:17:23,917 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:23,917 INFO sqlalchemy.engine.Engine [cached since 4.007s ago] (7, 21, 'autosub:default', '2026-10-08 01:17:23.917368')
2026-10-07 20:17:23,920 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:23,924 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:23,924 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:23,924 INFO sqlalchemy.engine.Engine [cached since 3.986s ago] ('event-end-4',)
2026-10-07 20:17:23,929 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,929 INFO sqlalchemy.engine.Engine [cached since 3.985s ago] ('event_end', 'event-end-4', 4, None, None, '2026-10-15 01:17:23.924572', 'pending', 0, 3, None, '2026-10-08 01:17:23.929203', '2026-10-08 01:17:23.929205')
2026-10-07 20:17:23,933 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:23,933 INFO sqlalchemy.engine.Engine [cached since 3.983s ago] (4,)
2026-10-07 20:17:23,937 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:23,937 INFO sqlalchemy.engine.Engine [cached since 3.982s ago] (20, 21)
2026-10-07 20:17:23,941 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:23,941 INFO sqlalchemy.engine.Engine [cached since 3.981s ago] (6, 7)
2026-10-07 20:17:23,945 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:23,945 INFO sqlalchemy.engine.Engine [cached since 3.98s ago] (6, 7)
2026-10-07 20:17:23,949 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:23,949 INFO sqlalchemy.engine.Engine [cached since 3.98s ago] (20, 21)
2026-10-07 20:17:23,953 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:23,953 INFO sqlalchemy.engine.Engine [cached since 3.979s ago] (6,)
2026-10-07 20:17:23,956 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:23,957 INFO sqlalchemy.engine.Engine [cached since 3.978s ago] (6,)
2026-10-07 20:17:23,960 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:23,960 INFO sqlalchemy.engine.Engine [cached since 3.976s ago] (7,)
2026-10-07 20:17:23,964 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:23,964 INFO sqlalchemy.engine.Engine [cached since 3.975s ago] (7,)
2026-10-07 20:17:23,968 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:23,968 INFO sqlalchemy.engine.Engine [cached since 4.024s ago] ('notify_subscribers', None, 4, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:23.968273', 'pending', 0, 3, None, '2026-10-08 01:17:23.968458', '2026-10-08 01:17:23.968460')
2026-10-07 20:17:23,971 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35192 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:24,064 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,064 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,064 INFO sqlalchemy.engine.Engine [cached since 11.7s ago] (20,)
2026-10-07 20:17:24,069 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,069 INFO sqlalchemy.engine.Engine [cached since 3.977s ago] (4,)
2026-10-07 20:17:24,073 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:24,073 INFO sqlalchemy.engine.Engine [cached since 4.123s ago] (4,)
2026-10-07 20:17:24,079 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:24,079 INFO sqlalchemy.engine.Engine [cached since 4.124s ago] (20, 21)
2026-10-07 20:17:24,083 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:24,083 INFO sqlalchemy.engine.Engine [cached since 4.123s ago] (6, 7)
2026-10-07 20:17:24,087 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:24,087 INFO sqlalchemy.engine.Engine [cached since 4.122s ago] (6, 7)
2026-10-07 20:17:24,090 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:24,091 INFO sqlalchemy.engine.Engine [cached since 4.122s ago] (20, 21)
2026-10-07 20:17:24,094 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?, ?)
2026-10-07 20:17:24,095 INFO sqlalchemy.engine.Engine [cached since 3.972s ago] (4, 21, 20)
INFO:     127.0.0.1:35192 - "GET /api/v1/events/4/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:24,131 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,137 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,137 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,137 INFO sqlalchemy.engine.Engine [cached since 11.77s ago] (20,)
2026-10-07 20:17:24,143 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,143 INFO sqlalchemy.engine.Engine [cached since 4.051s ago] (4,)
2026-10-07 20:17:24,147 INFO sqlalchemy.engine.Engine SELECT organization_memberships.id, organization_memberships.organization_id, organization_memberships.user_id, organization_memberships.role, organization_memberships.uses_personal_seat, organization_memberships.joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id = ? AND organization_memberships.user_id = ?
2026-10-07 20:17:24,147 INFO sqlalchemy.engine.Engine [cached since 4.571s ago] (4, 20)
2026-10-07 20:17:24,151 INFO sqlalchemy.engine.Engine UPDATE events SET tags=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:24,151 INFO sqlalchemy.engine.Engine [cached since 1.535s ago] ('info', '2026-10-08 01:17:24.151823', 4)
2026-10-07 20:17:24,156 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:24,156 INFO sqlalchemy.engine.Engine [cached since 4.593s ago] (4,)
2026-10-07 20:17:24,160 INFO sqlalchemy.engine.Engine SELECT organization_memberships.organization_id AS organization_memberships_organization_id, organization_memberships.id AS organization_memberships_id, organization_memberships.user_id AS organization_memberships_user_id, organization_memberships.role AS organization_memberships_role, organization_memberships.uses_personal_seat AS organization_memberships_uses_personal_seat, organization_memberships.joined_at AS organization_memberships_joined_at 
FROM organization_memberships 
WHERE organization_memberships.organization_id IN (?)
2026-10-07 20:17:24,160 INFO sqlalchemy.engine.Engine [cached since 4.593s ago] (4,)
2026-10-07 20:17:24,164 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:24,164 INFO sqlalchemy.engine.Engine [cached since 4.592s ago] (20, 21)
2026-10-07 20:17:24,169 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:24,169 INFO sqlalchemy.engine.Engine [cached since 4.219s ago] (4,)
2026-10-07 20:17:24,173 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:24,173 INFO sqlalchemy.engine.Engine [cached since 4.218s ago] (20, 21)
2026-10-07 20:17:24,177 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:24,177 INFO sqlalchemy.engine.Engine [cached since 4.217s ago] (6, 7)
2026-10-07 20:17:24,181 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:24,181 INFO sqlalchemy.engine.Engine [cached since 4.217s ago] (6, 7)
2026-10-07 20:17:24,185 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:24,185 INFO sqlalchemy.engine.Engine [cached since 4.216s ago] (20, 21)
2026-10-07 20:17:24,189 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:24,189 INFO sqlalchemy.engine.Engine [cached since 4.304s ago] (21, 'autosub:info')
2026-10-07 20:17:24,193 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:24,193 INFO sqlalchemy.engine.Engine [cached since 4.304s ago] (4, 'autosub:info')
2026-10-07 20:17:24,200 INFO sqlalchemy.engine.Engine DELETE FROM subscription_selectors WHERE subscription_selectors.id = ?
2026-10-07 20:17:24,200 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (6,)
2026-10-07 20:17:24,203 INFO sqlalchemy.engine.Engine DELETE FROM subscriptions WHERE subscriptions.id = ?
2026-10-07 20:17:24,204 INFO sqlalchemy.engine.Engine [generated in 0.00009s] (6,)
2026-10-07 20:17:24,207 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:24,207 INFO sqlalchemy.engine.Engine [cached since 4.327s ago] (4, 20)
2026-10-07 20:17:24,212 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:24,212 INFO sqlalchemy.engine.Engine [cached since 4.331s ago] (4, 21)
2026-10-07 20:17:24,216 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:24,216 INFO sqlalchemy.engine.Engine [cached since 4.331s ago] (21, 'autosub:info')
2026-10-07 20:17:24,220 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.organization_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:24,220 INFO sqlalchemy.engine.Engine [cached since 4.33s ago] (4, 'autosub:info')
2026-10-07 20:17:24,223 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,226 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,226 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,226 INFO sqlalchemy.engine.Engine [cached since 4.365s ago] (4,)
2026-10-07 20:17:24,230 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,230 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,231 INFO sqlalchemy.engine.Engine [cached since 4.139s ago] (4,)
2026-10-07 20:17:24,234 INFO sqlalchemy.engine.Engine UPDATE events SET last_notified_at=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:24,234 INFO sqlalchemy.engine.Engine [cached since 1.528s ago] ('2026-10-08 01:17:24.234452', '2026-10-08 01:17:24.234692', 4)
2026-10-07 20:17:24,238 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,240 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:24,240 INFO sqlalchemy.engine.Engine [cached since 4.297s ago] ('notify_subscribers', None, 4, None, '{"title": "Event Updated: Critical Incident", "body": "The event has been updated. Check the details for changes.", "level": "info"}', '2026-10-08 01:17:24.240530', 'pending', 0, 3, None, '2026-10-08 01:17:24.240813', '2026-10-08 01:17:24.240815')
2026-10-07 20:17:24,245 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35192 - "PUT /api/v1/events/4 HTTP/1.1" 200 OK
2026-10-07 20:17:24,320 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,320 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,320 INFO sqlalchemy.engine.Engine [cached since 11.95s ago] (20,)
2026-10-07 20:17:24,324 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,325 INFO sqlalchemy.engine.Engine [cached since 4.233s ago] (4,)
2026-10-07 20:17:24,329 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:24,329 INFO sqlalchemy.engine.Engine [cached since 4.378s ago] (4,)
2026-10-07 20:17:24,333 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:24,333 INFO sqlalchemy.engine.Engine [cached since 4.378s ago] (20,)
2026-10-07 20:17:24,337 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:24,337 INFO sqlalchemy.engine.Engine [cached since 4.378s ago] (7,)
2026-10-07 20:17:24,341 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:24,341 INFO sqlalchemy.engine.Engine [cached since 4.377s ago] (7,)
2026-10-07 20:17:24,345 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:24,345 INFO sqlalchemy.engine.Engine [cached since 4.376s ago] (20,)
2026-10-07 20:17:24,349 INFO sqlalchemy.engine.Engine SELECT user_roles.id, user_roles.user_id, user_roles.role_id, user_roles.organization_id, user_roles.status, user_roles.created_at, user_roles.updated_at 
FROM user_roles 
WHERE user_roles.organization_id = ? AND user_roles.user_id IN (?)
2026-10-07 20:17:24,349 INFO sqlalchemy.engine.Engine [cached since 4.226s ago] (4, 20)
INFO:     127.0.0.1:35192 - "GET /api/v1/events/4/subscribers HTTP/1.1" 200 OK
2026-10-07 20:17:24,385 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 26%]
tests/test_auto_subscriptions.py::TestPersonalEventTagUpdate::test_personal_event_tag_change_only_affects_creator 2026-10-07 20:17:24,396 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,396 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:24,396 INFO sqlalchemy.engine.Engine [cached since 13.25s ago] ('creator_20261007201724392184@test.example.com',)
2026-10-07 20:17:24,596 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:24,596 INFO sqlalchemy.engine.Engine [cached since 13.23s ago] ('creator_20261007201724392184@test.example.com', 'Event Creator', '$2b$12$HAetKSC6pxGF1Q8uySfQnurwp5BXEy4ow02i/2iaJvk27YzGMp3tO', 0, 'free', 0, 0, '2026-10-08 01:17:24.596606', None, None, None, None, '2026-10-08 01:17:24.596611', '2026-10-08 01:17:24.596612')
2026-10-07 20:17:24,601 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,604 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,604 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,604 INFO sqlalchemy.engine.Engine [cached since 13.23s ago] (22,)
2026-10-07 20:17:24,609 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:24,610 INFO sqlalchemy.engine.Engine [cached since 13.22s ago] (22, 'Email: creator_20261007201724392184@test.example.com', 'autosub:default')
2026-10-07 20:17:24,614 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:24,614 INFO sqlalchemy.engine.Engine [cached since 13.18s ago] (22, None, 'Email: creator_20261007201724392184@test.example.com', <memory at 0x7f5cbc1b0880>, 'autosub:default', 1, None, None, '2026-10-08 01:17:24.614761', '2026-10-08 01:17:24.614763')
2026-10-07 20:17:24,620 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:24,620 INFO sqlalchemy.engine.Engine [cached since 13.18s ago] ('email', <memory at 0x7f5cbc1b0d00>, '2026-10-08 01:17:24.620017', 24)
2026-10-07 20:17:24,624 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:24,637 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,638 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:24,638 INFO sqlalchemy.engine.Engine [cached since 12.76s ago] ('ac559f60e9ce3ec2bb8813e049aaab3c6e2a596c1629077ca12795502c73d287', 22, '2026-10-08 01:17:24.638087', '2026-10-15 01:17:24.637619')
INFO:     127.0.0.1:35202 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:24,675 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,680 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,680 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,680 INFO sqlalchemy.engine.Engine [cached since 12.31s ago] (22,)
2026-10-07 20:17:24,685 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:24,685 INFO sqlalchemy.engine.Engine [cached since 12.31s ago] (1, '2026-10-08 01:17:24.685311', 22)
2026-10-07 20:17:24,689 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35202 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyMiwiZW1haWwiOiJjcmVhdG9yXzIwMjYxMDA3MjAxNzI0MzkyMTg0QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0NCwiaWF0IjoxNzkxNDIyMjQ0fQ.LVMd8p2k1wjCxNyBwsUZpkQpjll7_EW7OnTe2pmtRLc HTTP/1.1" 200 OK
2026-10-07 20:17:24,724 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,724 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:24,724 INFO sqlalchemy.engine.Engine [cached since 12.36s ago] (22,)
2026-10-07 20:17:24,729 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:24,729 INFO sqlalchemy.engine.Engine [cached since 5.535s ago] (22, 'admin')
2026-10-07 20:17:24,734 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:24,734 INFO sqlalchemy.engine.Engine [cached since 5.006s ago] (22,)
2026-10-07 20:17:24,738 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:24,738 INFO sqlalchemy.engine.Engine [cached since 13.34s ago] (22, 'Personal Alerts', 'autosub:personal')
2026-10-07 20:17:24,742 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:24,742 INFO sqlalchemy.engine.Engine [cached since 13.31s ago] (22, None, 'Personal Alerts', <memory at 0x7f5cbc1b0c40>, 'autosub:personal', 1, None, None, '2026-10-08 01:17:24.742483', '2026-10-08 01:17:24.742485')
2026-10-07 20:17:24,747 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:24,747 INFO sqlalchemy.engine.Engine [cached since 13.3s ago] ('gotify', <memory at 0x7f5cbc1b1840>, '2026-10-08 01:17:24.746999', 25)
2026-10-07 20:17:24,750 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,753 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,753 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:24,753 INFO sqlalchemy.engine.Engine [cached since 4.964s ago] (22, 10000, 0)
2026-10-07 20:17:24,757 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:24,757 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,758 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:24,758 INFO sqlalchemy.engine.Engine [cached since 4.963s ago] (25,)
2026-10-07 20:17:24,774 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,774 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:24,774 INFO sqlalchemy.engine.Engine [cached since 17.61s ago] ('pending', '2026-10-08 01:17:24.774678', 'running', '2026-10-08 01:07:24.773982')
INFO:sqlalchemy.engine.Engine:[cached since 17.61s ago] ('pending', '2026-10-08 01:17:24.774678', 'running', '2026-10-08 01:07:24.773982')
2026-10-07 20:17:24,775 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:24,775 INFO sqlalchemy.engine.Engine [cached since 17.61s ago] ('pending', '2026-10-08 01:17:24.775263', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 17.61s ago] ('pending', '2026-10-08 01:17:24.775263', 20, 0)
2026-10-07 20:17:24,776 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:24,776 INFO sqlalchemy.engine.Engine [cached since 4.528s ago] ('running', '2026-10-08 01:17:24.776396', 9, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 4.528s ago] ('running', '2026-10-08 01:17:24.776396', 9, 'pending')
2026-10-07 20:17:24,777 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:24,777 INFO sqlalchemy.engine.Engine [cached since 4.529s ago] ('running', '2026-10-08 01:17:24.777258', 10, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 4.529s ago] ('running', '2026-10-08 01:17:24.777258', 10, 'pending')
2026-10-07 20:17:24,777 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,780 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,780 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:24,780 INFO sqlalchemy.engine.Engine [cached since 4.527s ago] (9,)
INFO:sqlalchemy.engine.Engine:[cached since 4.527s ago] (9,)
2026-10-07 20:17:24,781 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,781 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,781 INFO sqlalchemy.engine.Engine [cached since 4.346s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.346s ago] (4,)
2026-10-07 20:17:24,781 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,782 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,782 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:24,782 INFO sqlalchemy.engine.Engine [cached since 4.342s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.342s ago] (4,)
2026-10-07 20:17:24,783 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:24,783 INFO sqlalchemy.engine.Engine [cached since 4.341s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 4.341s ago] (7,)
2026-10-07 20:17:24,784 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:24,784 INFO sqlalchemy.engine.Engine [cached since 4.341s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 4.341s ago] (7,)
2026-10-07 20:17:24,784 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:24,784 INFO sqlalchemy.engine.Engine [cached since 4.34s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.34s ago] (20,)
2026-10-07 20:17:24,785 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:24,785 INFO sqlalchemy.engine.Engine [cached since 4.339s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.339s ago] (20,)
2026-10-07 20:17:24,786 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:24,786 INFO sqlalchemy.engine.Engine [cached since 4.335s ago] (21,)
INFO:sqlalchemy.engine.Engine:[cached since 4.335s ago] (21,)
2026-10-07 20:17:24,787 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:24,787 INFO sqlalchemy.engine.Engine [cached since 4.23s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.23s ago] (20,)
2026-10-07 20:17:24,787 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:35202 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:24,792 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:24,798 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:24,798 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:24,798 INFO sqlalchemy.engine.Engine [cached since 13.65s ago] ('other_20261007201724392184@test.example.com',)
INFO:apprise:Sent Email to admin4_20261007201722870018@test.example.com
2026-10-07 20:17:24,799 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,799 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:24,799 INFO sqlalchemy.engine.Engine [cached since 4.188s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.188s ago] (4,)
2026-10-07 20:17:24,800 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:24,800 INFO sqlalchemy.engine.Engine [cached since 4.186s ago] (1, '2026-10-08 01:17:24.800282', 4)
INFO:sqlalchemy.engine.Engine:[cached since 4.186s ago] (1, '2026-10-08 01:17:24.800282', 4)
2026-10-07 20:17:24,800 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,803 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:24,803 INFO sqlalchemy.engine.Engine [cached since 4.185s ago] ('done', '2026-10-08 01:17:24.803488', 9)
INFO:sqlalchemy.engine.Engine:[cached since 4.185s ago] ('done', '2026-10-08 01:17:24.803488', 9)
2026-10-07 20:17:24,804 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,806 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,807 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:24,807 INFO sqlalchemy.engine.Engine [cached since 4.554s ago] (10,)
INFO:sqlalchemy.engine.Engine:[cached since 4.554s ago] (10,)
2026-10-07 20:17:24,807 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,807 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:24,807 INFO sqlalchemy.engine.Engine [cached since 4.373s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.373s ago] (4,)
2026-10-07 20:17:24,808 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,808 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,809 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:24,809 INFO sqlalchemy.engine.Engine [cached since 4.369s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.369s ago] (4,)
2026-10-07 20:17:24,809 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:24,809 INFO sqlalchemy.engine.Engine [cached since 4.368s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 4.368s ago] (7,)
2026-10-07 20:17:24,810 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:24,810 INFO sqlalchemy.engine.Engine [cached since 4.367s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 4.367s ago] (7,)
2026-10-07 20:17:24,811 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:24,811 INFO sqlalchemy.engine.Engine [cached since 4.366s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.366s ago] (20,)
2026-10-07 20:17:24,812 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:24,812 INFO sqlalchemy.engine.Engine [cached since 4.365s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.365s ago] (20,)
2026-10-07 20:17:24,813 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:24,813 INFO sqlalchemy.engine.Engine [cached since 4.362s ago] (21,)
INFO:sqlalchemy.engine.Engine:[cached since 4.362s ago] (21,)
2026-10-07 20:17:24,814 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:24,814 INFO sqlalchemy.engine.Engine [cached since 4.256s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 4.256s ago] (20,)
2026-10-07 20:17:24,814 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to admin4_20261007201722870018@test.example.com
2026-10-07 20:17:24,825 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,825 INFO sqlalchemy.engine.Engine SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:SELECT organizations.id, organizations.name, organizations.slug, organizations.description, organizations."plan", organizations.max_seats, organizations.is_active, organizations.tier, organizations.billable_credits_used_this_month, organizations.total_notifications_this_month, organizations.usage_period_start, organizations.enforce_role_assignments, organizations.stripe_customer_id, organizations.stripe_subscription_id, organizations.subscription_status, organizations.subscription_current_period_end, organizations.created_at, organizations.updated_at 
FROM organizations 
WHERE organizations.id = ?
2026-10-07 20:17:24,825 INFO sqlalchemy.engine.Engine [cached since 4.214s ago] (4,)
INFO:sqlalchemy.engine.Engine:[cached since 4.214s ago] (4,)
2026-10-07 20:17:24,826 INFO sqlalchemy.engine.Engine UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE organizations SET total_notifications_this_month=?, updated_at=? WHERE organizations.id = ?
2026-10-07 20:17:24,826 INFO sqlalchemy.engine.Engine [cached since 4.212s ago] (2, '2026-10-08 01:17:24.826099', 4)
INFO:sqlalchemy.engine.Engine:[cached since 4.212s ago] (2, '2026-10-08 01:17:24.826099', 4)
2026-10-07 20:17:24,826 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,829 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:24,829 INFO sqlalchemy.engine.Engine [cached since 4.211s ago] ('done', '2026-10-08 01:17:24.829154', 10)
INFO:sqlalchemy.engine.Engine:[cached since 4.211s ago] ('done', '2026-10-08 01:17:24.829154', 10)
2026-10-07 20:17:24,829 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,832 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:24,832 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:24,832 INFO sqlalchemy.engine.Engine [cached since 17.67s ago] ('pending', '2026-10-08 01:17:24.832614', 'running', '2026-10-08 01:07:24.832111')
INFO:sqlalchemy.engine.Engine:[cached since 17.67s ago] ('pending', '2026-10-08 01:17:24.832614', 'running', '2026-10-08 01:07:24.832111')
2026-10-07 20:17:24,833 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:24,833 INFO sqlalchemy.engine.Engine [cached since 17.66s ago] ('pending', '2026-10-08 01:17:24.833047', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 17.66s ago] ('pending', '2026-10-08 01:17:24.833047', 20, 0)
2026-10-07 20:17:24,833 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:24,995 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:24,995 INFO sqlalchemy.engine.Engine [cached since 13.63s ago] ('other_20261007201724392184@test.example.com', 'Other User', '$2b$12$uzzeKsv54FC05.ugJQ713.yxI7/tYYhJnSYtGcaVxVEn61LyaR2/S', 0, 'free', 0, 0, '2026-10-08 01:17:24.995453', None, None, None, None, '2026-10-08 01:17:24.995457', '2026-10-08 01:17:24.995458')
2026-10-07 20:17:25,001 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,003 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,003 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,003 INFO sqlalchemy.engine.Engine [cached since 13.63s ago] (23,)
2026-10-07 20:17:25,008 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:25,008 INFO sqlalchemy.engine.Engine [cached since 13.61s ago] (23, 'Email: other_20261007201724392184@test.example.com', 'autosub:default')
2026-10-07 20:17:25,013 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,013 INFO sqlalchemy.engine.Engine [cached since 13.58s ago] (23, None, 'Email: other_20261007201724392184@test.example.com', <memory at 0x7f5cbc1b0880>, 'autosub:default', 1, None, None, '2026-10-08 01:17:25.013024', '2026-10-08 01:17:25.013026')
2026-10-07 20:17:25,017 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:25,017 INFO sqlalchemy.engine.Engine [cached since 13.57s ago] ('email', <memory at 0x7f5cbc1b0100>, '2026-10-08 01:17:25.017490', 26)
2026-10-07 20:17:25,020 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:25,035 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,035 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:25,035 INFO sqlalchemy.engine.Engine [cached since 13.16s ago] ('850ee2e2f08e23cabe2727f6af447aee5ad9fbbea212a5e5d315bbd52f7c68be', 23, '2026-10-08 01:17:25.035628', '2026-10-15 01:17:25.035141')
INFO:     127.0.0.1:35202 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:25,069 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,075 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,075 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,075 INFO sqlalchemy.engine.Engine [cached since 12.71s ago] (23,)
2026-10-07 20:17:25,080 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:25,080 INFO sqlalchemy.engine.Engine [cached since 12.71s ago] (1, '2026-10-08 01:17:25.080101', 23)
2026-10-07 20:17:25,083 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35202 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyMywiZW1haWwiOiJvdGhlcl8yMDI2MTAwNzIwMTcyNDM5MjE4NEB0ZXN0LmV4YW1wbGUuY29tIiwic291cmNlIjpudWxsLCJyZWRpcmVjdF91cmwiOiJodHRwOi8vbG9jYWxob3N0OjUxNzQiLCJleHAiOjE3OTE1MDg2NDUsImlhdCI6MTc5MTQyMjI0NX0.CIWod2NB_RdLAmuynT888gFkRCHdexssx_kJ9ZeQv5s HTTP/1.1" 200 OK
2026-10-07 20:17:25,121 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,121 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,121 INFO sqlalchemy.engine.Engine [cached since 12.76s ago] (23,)
2026-10-07 20:17:25,126 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:25,126 INFO sqlalchemy.engine.Engine [cached since 5.932s ago] (23, 'admin')
2026-10-07 20:17:25,130 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:25,130 INFO sqlalchemy.engine.Engine [cached since 5.402s ago] (23,)
2026-10-07 20:17:25,134 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:25,134 INFO sqlalchemy.engine.Engine [cached since 13.74s ago] (23, 'Personal Alerts', 'autosub:personal')
2026-10-07 20:17:25,137 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,137 INFO sqlalchemy.engine.Engine [cached since 13.7s ago] (23, None, 'Personal Alerts', <memory at 0x7f5cbc1b0940>, 'autosub:personal', 1, None, None, '2026-10-08 01:17:25.137724', '2026-10-08 01:17:25.137725')
2026-10-07 20:17:25,141 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:25,141 INFO sqlalchemy.engine.Engine [cached since 13.7s ago] ('gotify', <memory at 0x7f5cbc1b1900>, '2026-10-08 01:17:25.141431', 27)
2026-10-07 20:17:25,144 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,147 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,147 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:25,147 INFO sqlalchemy.engine.Engine [cached since 5.358s ago] (23, 10000, 0)
2026-10-07 20:17:25,150 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,151 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,151 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:25,151 INFO sqlalchemy.engine.Engine [cached since 5.356s ago] (27,)
INFO:     127.0.0.1:35202 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:25,183 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,188 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,188 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,188 INFO sqlalchemy.engine.Engine [cached since 12.82s ago] (22,)
2026-10-07 20:17:25,192 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,192 INFO sqlalchemy.engine.Engine [cached since 5.348s ago] ('My Personal Event', None, '2026-10-08 03:17:25.186177', None, 'UTC', None, 1, 0, 'notifiq-web', 'pending', 22, None, 'personal', None, None, None, None, '2026-10-08 01:17:25.192429', '2026-10-08 01:17:25.192431')
2026-10-07 20:17:25,197 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:25,197 INFO sqlalchemy.engine.Engine [cached since 5.348s ago] ('notifiq-web/5-my-personal-event', '2026-10-08 01:17:25.197113', 5)
2026-10-07 20:17:25,201 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,201 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (22,)
2026-10-07 20:17:25,204 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? AND events.organization_id IS NULL AND events.end_date > ?
2026-10-07 20:17:25,204 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (22, '2026-10-08 01:17:25.204175')
2026-10-07 20:17:25,208 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,208 INFO sqlalchemy.engine.Engine [cached since 5.347s ago] (5,)
2026-10-07 20:17:25,211 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:25,211 INFO sqlalchemy.engine.Engine [cached since 5.327s ago] (22, 'autosub:default')
2026-10-07 20:17:25,215 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:25,215 INFO sqlalchemy.engine.Engine [cached since 5.33s ago] (22, 'autosub:personal')
2026-10-07 20:17:25,218 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:25,218 INFO sqlalchemy.engine.Engine [cached since 5.295s ago] (5, 22, 0, '2026-10-08 01:17:25.218635', '2026-10-08 01:17:25.218637')
2026-10-07 20:17:25,222 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:25,222 INFO sqlalchemy.engine.Engine [cached since 5.312s ago] (8, 24, 'autosub:default', '2026-10-08 01:17:25.222207')
2026-10-07 20:17:25,225 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:25,225 INFO sqlalchemy.engine.Engine [cached since 5.315s ago] (8, 25, 'autosub:personal', '2026-10-08 01:17:25.225675')
2026-10-07 20:17:25,228 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,232 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,232 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:25,232 INFO sqlalchemy.engine.Engine [cached since 5.294s ago] ('event-end-5',)
2026-10-07 20:17:25,236 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,236 INFO sqlalchemy.engine.Engine [cached since 5.292s ago] ('event_end', 'event-end-5', 5, None, None, '2026-10-15 01:17:25.232415', 'pending', 0, 3, None, '2026-10-08 01:17:25.236467', '2026-10-08 01:17:25.236469')
2026-10-07 20:17:25,240 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:25,240 INFO sqlalchemy.engine.Engine [cached since 5.29s ago] (5,)
2026-10-07 20:17:25,244 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:25,244 INFO sqlalchemy.engine.Engine [cached since 5.289s ago] (22,)
2026-10-07 20:17:25,248 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:25,248 INFO sqlalchemy.engine.Engine [cached since 5.288s ago] (8,)
2026-10-07 20:17:25,251 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:25,251 INFO sqlalchemy.engine.Engine [cached since 5.287s ago] (8,)
2026-10-07 20:17:25,255 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:25,255 INFO sqlalchemy.engine.Engine [cached since 5.286s ago] (22,)
2026-10-07 20:17:25,259 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:25,259 INFO sqlalchemy.engine.Engine [cached since 5.274s ago] (8,)
2026-10-07 20:17:25,262 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:25,262 INFO sqlalchemy.engine.Engine [cached since 5.273s ago] (8,)
2026-10-07 20:17:25,265 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,266 INFO sqlalchemy.engine.Engine [cached since 5.322s ago] ('notify_subscribers', None, 5, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:25.265762', 'pending', 0, 3, None, '2026-10-08 01:17:25.265936', '2026-10-08 01:17:25.265937')
2026-10-07 20:17:25,269 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35202 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:25,335 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,335 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,335 INFO sqlalchemy.engine.Engine [cached since 12.97s ago] (23,)
2026-10-07 20:17:25,341 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,341 INFO sqlalchemy.engine.Engine [cached since 5.249s ago] (5,)
2026-10-07 20:17:25,345 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:25,345 INFO sqlalchemy.engine.Engine [cached since 5.465s ago] (5, 23)
2026-10-07 20:17:25,350 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:25,350 INFO sqlalchemy.engine.Engine [cached since 5.427s ago] (5, 23, 0, '2026-10-08 01:17:25.350305', '2026-10-08 01:17:25.350307')
2026-10-07 20:17:25,355 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,358 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,358 INFO sqlalchemy.engine.Engine INSERT INTO unsubscribe_tokens (token, subscription_id, created_at, used_at, expires_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:25,358 INFO sqlalchemy.engine.Engine [generated in 0.00018s] ('8GluUTe2BZGHpxp6tvI5hSygQ8uMPa5zrQwiuHl9fr1_GF0Ef4p3Aj4CV2rDxQ0K', 9, '2026-10-08 01:17:25.357804', None, '2026-12-07 01:17:25.357804')
2026-10-07 20:17:25,363 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,365 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,365 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,365 INFO sqlalchemy.engine.Engine [cached since 5.422s ago] ('notify_user', None, None, None, '{"user_id": 23, "title": "Event Subscription Confirmation", "body": "You have successfully subscribed to My Personal Event.", "level": "info"}', '2026-10-08 01:17:25.365502', 'pending', 0, 3, None, '2026-10-08 01:17:25.365834', '2026-10-08 01:17:25.365836')
2026-10-07 20:17:25,370 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35202 - "POST /api/v1/subscriptions HTTP/1.1" 201 Created
2026-10-07 20:17:25,408 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,408 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,408 INFO sqlalchemy.engine.Engine [cached since 13.04s ago] (22,)
2026-10-07 20:17:25,414 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,414 INFO sqlalchemy.engine.Engine [cached since 5.322s ago] (5,)
2026-10-07 20:17:25,419 INFO sqlalchemy.engine.Engine UPDATE events SET tags=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:25,419 INFO sqlalchemy.engine.Engine [cached since 2.803s ago] ('other', '2026-10-08 01:17:25.419667', 5)
2026-10-07 20:17:25,425 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:25,425 INFO sqlalchemy.engine.Engine [cached since 5.475s ago] (5,)
2026-10-07 20:17:25,430 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:25,430 INFO sqlalchemy.engine.Engine [cached since 5.475s ago] (22, 23)
2026-10-07 20:17:25,435 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:25,435 INFO sqlalchemy.engine.Engine [cached since 5.476s ago] (8, 9)
2026-10-07 20:17:25,440 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:25,440 INFO sqlalchemy.engine.Engine [cached since 5.476s ago] (8, 9)
2026-10-07 20:17:25,445 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:25,445 INFO sqlalchemy.engine.Engine [cached since 5.476s ago] (22, 23)
2026-10-07 20:17:25,450 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:25,450 INFO sqlalchemy.engine.Engine [cached since 5.569s ago] (5, 22)
2026-10-07 20:17:25,453 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,456 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,456 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,456 INFO sqlalchemy.engine.Engine [cached since 5.595s ago] (5,)
2026-10-07 20:17:25,461 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,461 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,461 INFO sqlalchemy.engine.Engine [cached since 5.369s ago] (5,)
2026-10-07 20:17:25,465 INFO sqlalchemy.engine.Engine UPDATE events SET last_notified_at=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:25,465 INFO sqlalchemy.engine.Engine [cached since 2.759s ago] ('2026-10-08 01:17:25.465263', '2026-10-08 01:17:25.465487', 5)
2026-10-07 20:17:25,469 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,471 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,471 INFO sqlalchemy.engine.Engine [cached since 5.527s ago] ('notify_subscribers', None, 5, None, '{"title": "Event Updated: My Personal Event", "body": "The event has been updated. Check the details for changes.", "level": "info"}', '2026-10-08 01:17:25.471510', 'pending', 0, 3, None, '2026-10-08 01:17:25.471718', '2026-10-08 01:17:25.471720')
2026-10-07 20:17:25,476 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35202 - "PUT /api/v1/events/5 HTTP/1.1" 200 OK
2026-10-07 20:17:25,530 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,530 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,530 INFO sqlalchemy.engine.Engine [cached since 13.16s ago] (23,)
2026-10-07 20:17:25,536 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.user_id = ? ORDER BY subscriptions.created_at DESC
2026-10-07 20:17:25,536 INFO sqlalchemy.engine.Engine [generated in 0.00015s] (23,)
2026-10-07 20:17:25,541 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:25,541 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (9,)
2026-10-07 20:17:25,546 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:25,546 INFO sqlalchemy.engine.Engine [generated in 0.00013s] (9,)
INFO:     127.0.0.1:35202 - "GET /api/v1/subscriptions HTTP/1.1" 200 OK
2026-10-07 20:17:25,573 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 27%]
tests/test_auto_subscriptions.py::TestRetroactiveAutosubscribe::test_channel_creation_retroactively_subscribes_to_existing_events 2026-10-07 20:17:25,585 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,585 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:25,585 INFO sqlalchemy.engine.Engine [cached since 14.43s ago] ('user_20261007201725580972@test.example.com',)
2026-10-07 20:17:25,786 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,786 INFO sqlalchemy.engine.Engine [cached since 14.42s ago] ('user_20261007201725580972@test.example.com', 'Test User', '$2b$12$xB1XD2tWMMndpnvufDV0dOyOE6WyQY/RMZ4musSQbMOVSZyz8wC86', 0, 'free', 0, 0, '2026-10-08 01:17:25.786584', None, None, None, None, '2026-10-08 01:17:25.786588', '2026-10-08 01:17:25.786589')
2026-10-07 20:17:25,791 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,794 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,794 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,794 INFO sqlalchemy.engine.Engine [cached since 14.42s ago] (24,)
2026-10-07 20:17:25,799 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:25,799 INFO sqlalchemy.engine.Engine [cached since 14.41s ago] (24, 'Email: user_20261007201725580972@test.example.com', 'autosub:default')
2026-10-07 20:17:25,803 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,803 INFO sqlalchemy.engine.Engine [cached since 14.37s ago] (24, None, 'Email: user_20261007201725580972@test.example.com', <memory at 0x7f5cbc1b0940>, 'autosub:default', 1, None, None, '2026-10-08 01:17:25.803597', '2026-10-08 01:17:25.803599')
2026-10-07 20:17:25,809 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:25,809 INFO sqlalchemy.engine.Engine [cached since 14.37s ago] ('email', <memory at 0x7f5cbc1b16c0>, '2026-10-08 01:17:25.809750', 28)
2026-10-07 20:17:25,813 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:25,828 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,828 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:25,828 INFO sqlalchemy.engine.Engine [cached since 13.95s ago] ('2e74aebdafaef97b62aaa44b446943ba60a508e7e1633c7bb4c9ea9fb3fcb251', 24, '2026-10-08 01:17:25.828362', '2026-10-15 01:17:25.827940')
2026-10-07 20:17:25,835 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,835 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:25,835 INFO sqlalchemy.engine.Engine [cached since 18.67s ago] ('pending', '2026-10-08 01:17:25.835718', 'running', '2026-10-08 01:07:25.834973')
INFO:sqlalchemy.engine.Engine:[cached since 18.67s ago] ('pending', '2026-10-08 01:17:25.835718', 'running', '2026-10-08 01:07:25.834973')
INFO:     127.0.0.1:35208 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:25,862 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,868 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,868 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,868 INFO sqlalchemy.engine.Engine [cached since 13.5s ago] (24,)
2026-10-07 20:17:25,870 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:25,870 INFO sqlalchemy.engine.Engine [cached since 18.7s ago] ('pending', '2026-10-08 01:17:25.869876', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 18.7s ago] ('pending', '2026-10-08 01:17:25.869876', 20, 0)
2026-10-07 20:17:25,871 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:25,871 INFO sqlalchemy.engine.Engine [cached since 5.623s ago] ('running', '2026-10-08 01:17:25.871313', 12, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 5.623s ago] ('running', '2026-10-08 01:17:25.871313', 12, 'pending')
2026-10-07 20:17:25,872 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:25,872 INFO sqlalchemy.engine.Engine [cached since 5.624s ago] ('running', '2026-10-08 01:17:25.872282', 13, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 5.624s ago] ('running', '2026-10-08 01:17:25.872282', 13, 'pending')
2026-10-07 20:17:25,873 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:25,873 INFO sqlalchemy.engine.Engine [cached since 5.624s ago] ('running', '2026-10-08 01:17:25.872980', 14, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 5.624s ago] ('running', '2026-10-08 01:17:25.872980', 14, 'pending')
2026-10-07 20:17:25,873 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:25,873 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:25,873 INFO sqlalchemy.engine.Engine [cached since 13.5s ago] (1, '2026-10-08 01:17:25.873830', 24)
2026-10-07 20:17:25,875 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,876 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:25,876 INFO sqlalchemy.engine.Engine [cached since 5.623s ago] (12,)
INFO:sqlalchemy.engine.Engine:[cached since 5.623s ago] (12,)
2026-10-07 20:17:25,876 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,877 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,877 INFO sqlalchemy.engine.Engine [cached since 5.442s ago] (5,)
INFO:sqlalchemy.engine.Engine:[cached since 5.442s ago] (5,)
2026-10-07 20:17:25,877 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:25,878 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,878 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:25,878 INFO sqlalchemy.engine.Engine [cached since 5.438s ago] (5,)
INFO:sqlalchemy.engine.Engine:[cached since 5.438s ago] (5,)
2026-10-07 20:17:25,879 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:25,879 INFO sqlalchemy.engine.Engine [cached since 5.438s ago] (8, 9)
INFO:sqlalchemy.engine.Engine:[cached since 5.438s ago] (8, 9)
2026-10-07 20:17:25,880 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:25,880 INFO sqlalchemy.engine.Engine [cached since 5.437s ago] (8, 9)
INFO:sqlalchemy.engine.Engine:[cached since 5.437s ago] (8, 9)
2026-10-07 20:17:25,881 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:25,881 INFO sqlalchemy.engine.Engine [cached since 5.436s ago] (22, 23)
INFO:sqlalchemy.engine.Engine:[cached since 5.436s ago] (22, 23)
2026-10-07 20:17:25,881 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:25,881 INFO sqlalchemy.engine.Engine [cached since 5.435s ago] (22, 23)
INFO:sqlalchemy.engine.Engine:[cached since 5.435s ago] (22, 23)
2026-10-07 20:17:25,882 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:25,882 INFO sqlalchemy.engine.Engine [cached since 5.431s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 5.431s ago] (24,)
2026-10-07 20:17:25,882 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,887 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:25,887 INFO sqlalchemy.engine.Engine [cached since 5.435s ago] (25,)
INFO:sqlalchemy.engine.Engine:[cached since 5.435s ago] (25,)
2026-10-07 20:17:25,887 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:25,887 INFO sqlalchemy.engine.Engine [cached since 5.33s ago] (22,)
INFO:sqlalchemy.engine.Engine:[cached since 5.33s ago] (22,)
2026-10-07 20:17:25,888 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:apprise:Notifying 2 service(s) with threads.
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
Session.login_data is deprecated and will be removed in version 2.0
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to creator_20261007201724392184@test.example.com
2026-10-07 20:17:25,902 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,903 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,903 INFO sqlalchemy.engine.Engine [generated in 0.00014s] (23,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00014s] (23,)
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to other_20261007201724392184@test.example.com
2026-10-07 20:17:25,917 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,917 INFO sqlalchemy.engine.Engine [generated in 0.00015s] (22,)
INFO:sqlalchemy.engine.Engine:[generated in 0.00015s] (22,)
2026-10-07 20:17:25,918 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:25,919 INFO sqlalchemy.engine.Engine [generated in 0.00012s] (1, '2026-10-08 01:17:25.918955', 22)
INFO:sqlalchemy.engine.Engine:[generated in 0.00012s] (1, '2026-10-08 01:17:25.918955', 22)
2026-10-07 20:17:25,919 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:35208 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyNCwiZW1haWwiOiJ1c2VyXzIwMjYxMDA3MjAxNzI1NTgwOTcyQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0NSwiaWF0IjoxNzkxNDIyMjQ1fQ.EYtaxOKorKSy4ZhbO2IIbzsmOAj_pH7xqbyvfENQjas HTTP/1.1" 200 OK
2026-10-07 20:17:25,922 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:25,923 INFO sqlalchemy.engine.Engine [cached since 5.305s ago] ('done', '2026-10-08 01:17:25.922953', 12)
INFO:sqlalchemy.engine.Engine:[cached since 5.305s ago] ('done', '2026-10-08 01:17:25.922953', 12)
2026-10-07 20:17:25,923 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:25,926 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,926 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:25,926 INFO sqlalchemy.engine.Engine [cached since 5.673s ago] (13,)
INFO:sqlalchemy.engine.Engine:[cached since 5.673s ago] (13,)
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine [cached since 5.37s ago] (23,)
INFO:sqlalchemy.engine.Engine:[cached since 5.37s ago] (23,)
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,927 INFO sqlalchemy.engine.Engine [cached since 13.56s ago] (24,)
2026-10-07 20:17:25,929 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:apprise:Notifying 2 service(s) with threads.
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
2026-10-07 20:17:25,933 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,933 INFO sqlalchemy.engine.Engine [cached since 6.09s ago] ('Critical Event', None, '2026-10-08 03:17:25.924690', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 24, None, 'critical', None, None, None, None, '2026-10-08 01:17:25.933596', '2026-10-08 01:17:25.933598')
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:25,938 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:25,938 INFO sqlalchemy.engine.Engine [cached since 6.09s ago] ('notifiq-web/6-critical-event', '2026-10-08 01:17:25.938616', 6)
INFO:apprise:Sent Email to other_20261007201724392184@test.example.com
2026-10-07 20:17:25,942 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:25,942 INFO sqlalchemy.engine.Engine [cached since 5.325s ago] ('done', '2026-10-08 01:17:25.942722', 13)
INFO:sqlalchemy.engine.Engine:[cached since 5.325s ago] ('done', '2026-10-08 01:17:25.942722', 13)
2026-10-07 20:17:25,943 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:25,943 INFO sqlalchemy.engine.Engine [cached since 0.7425s ago] (24,)
2026-10-07 20:17:25,947 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? AND events.organization_id IS NULL AND events.end_date > ?
2026-10-07 20:17:25,947 INFO sqlalchemy.engine.Engine [cached since 0.7431s ago] (24, '2026-10-08 01:17:25.947481')
2026-10-07 20:17:25,951 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,951 INFO sqlalchemy.engine.Engine [cached since 6.09s ago] (6,)
2026-10-07 20:17:25,955 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:25,955 INFO sqlalchemy.engine.Engine [cached since 6.07s ago] (24, 'autosub:default')
2026-10-07 20:17:25,958 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:25,958 INFO sqlalchemy.engine.Engine [cached since 6.073s ago] (24, 'autosub:critical')
2026-10-07 20:17:25,962 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:25,962 INFO sqlalchemy.engine.Engine [cached since 6.039s ago] (6, 24, 0, '2026-10-08 01:17:25.962280', '2026-10-08 01:17:25.962282')
2026-10-07 20:17:25,965 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:25,966 INFO sqlalchemy.engine.Engine [cached since 6.055s ago] (10, 28, 'autosub:default', '2026-10-08 01:17:25.965923')
2026-10-07 20:17:25,969 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:25,975 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:25,976 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:25,976 INFO sqlalchemy.engine.Engine [cached since 6.038s ago] ('event-end-6',)
2026-10-07 20:17:25,977 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:25,979 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,979 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:25,980 INFO sqlalchemy.engine.Engine [cached since 5.727s ago] (14,)
INFO:sqlalchemy.engine.Engine:[cached since 5.727s ago] (14,)
2026-10-07 20:17:25,980 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,980 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:25,980 INFO sqlalchemy.engine.Engine [cached since 5.546s ago] (5,)
INFO:sqlalchemy.engine.Engine:[cached since 5.546s ago] (5,)
2026-10-07 20:17:25,981 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:25,981 INFO sqlalchemy.engine.Engine [cached since 6.037s ago] ('event_end', 'event-end-6', 6, None, None, '2026-10-15 01:17:25.975562', 'pending', 0, 3, None, '2026-10-08 01:17:25.981258', '2026-10-08 01:17:25.981260')
2026-10-07 20:17:25,981 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:25,982 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:25,982 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:25,982 INFO sqlalchemy.engine.Engine [cached since 5.542s ago] (5,)
INFO:sqlalchemy.engine.Engine:[cached since 5.542s ago] (5,)
2026-10-07 20:17:25,983 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:25,983 INFO sqlalchemy.engine.Engine [cached since 5.541s ago] (8, 9)
INFO:sqlalchemy.engine.Engine:[cached since 5.541s ago] (8, 9)
2026-10-07 20:17:25,983 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:25,983 INFO sqlalchemy.engine.Engine [cached since 5.541s ago] (8, 9)
INFO:sqlalchemy.engine.Engine:[cached since 5.541s ago] (8, 9)
2026-10-07 20:17:25,984 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:25,984 INFO sqlalchemy.engine.Engine [cached since 5.54s ago] (22, 23)
INFO:sqlalchemy.engine.Engine:[cached since 5.54s ago] (22, 23)
2026-10-07 20:17:25,985 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:25,985 INFO sqlalchemy.engine.Engine [cached since 6.034s ago] (6,)
2026-10-07 20:17:25,986 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:25,986 INFO sqlalchemy.engine.Engine [cached since 5.54s ago] (22, 23)
INFO:sqlalchemy.engine.Engine:[cached since 5.54s ago] (22, 23)
2026-10-07 20:17:25,987 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:25,987 INFO sqlalchemy.engine.Engine [cached since 5.536s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 5.536s ago] (24,)
2026-10-07 20:17:25,988 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:25,988 INFO sqlalchemy.engine.Engine [cached since 5.537s ago] (25,)
INFO:sqlalchemy.engine.Engine:[cached since 5.537s ago] (25,)
2026-10-07 20:17:25,988 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:25,988 INFO sqlalchemy.engine.Engine [cached since 6.033s ago] (24,)
2026-10-07 20:17:25,989 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:25,989 INFO sqlalchemy.engine.Engine [cached since 5.431s ago] (22,)
INFO:sqlalchemy.engine.Engine:[cached since 5.431s ago] (22,)
2026-10-07 20:17:25,989 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:apprise:Notifying 2 service(s) with threads.
2026-10-07 20:17:25,992 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:25,992 INFO sqlalchemy.engine.Engine [cached since 6.033s ago] (10,)
WARNING:apprise:A Connection error occurred sending Gotify notification to gotify.example.com.
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:25,997 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:25,997 INFO sqlalchemy.engine.Engine [cached since 6.032s ago] (10,)
INFO:apprise:Sent Email to creator_20261007201724392184@test.example.com
2026-10-07 20:17:26,001 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:26,001 INFO sqlalchemy.engine.Engine [cached since 6.032s ago] (24,)
2026-10-07 20:17:26,001 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,001 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,001 INFO sqlalchemy.engine.Engine [cached since 0.09812s ago] (23,)
INFO:sqlalchemy.engine.Engine:[cached since 0.09812s ago] (23,)
2026-10-07 20:17:26,006 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:26,006 INFO sqlalchemy.engine.Engine [cached since 6.022s ago] (10,)
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:26,010 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:26,010 INFO sqlalchemy.engine.Engine [cached since 6.022s ago] (10,)
INFO:apprise:Sent Email to other_20261007201724392184@test.example.com
2026-10-07 20:17:26,013 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,013 INFO sqlalchemy.engine.Engine [cached since 0.09647s ago] (22,)
INFO:sqlalchemy.engine.Engine:[cached since 0.09647s ago] (22,)
2026-10-07 20:17:26,014 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:26,014 INFO sqlalchemy.engine.Engine [cached since 0.09554s ago] (2, '2026-10-08 01:17:26.014376', 22)
INFO:sqlalchemy.engine.Engine:[cached since 0.09554s ago] (2, '2026-10-08 01:17:26.014376', 22)
2026-10-07 20:17:26,014 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:26,014 INFO sqlalchemy.engine.Engine [cached since 6.071s ago] ('notify_subscribers', None, 6, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:26.014627', 'pending', 0, 3, None, '2026-10-08 01:17:26.014809', '2026-10-08 01:17:26.014811')
2026-10-07 20:17:26,018 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,068 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,071 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:26,071 INFO sqlalchemy.engine.Engine [cached since 5.453s ago] ('done', '2026-10-08 01:17:26.071438', 14)
INFO:sqlalchemy.engine.Engine:[cached since 5.453s ago] ('done', '2026-10-08 01:17:26.071438', 14)
2026-10-07 20:17:26,072 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,074 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,074 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:26,074 INFO sqlalchemy.engine.Engine [cached since 18.91s ago] ('pending', '2026-10-08 01:17:26.074868', 'running', '2026-10-08 01:07:26.074286')
INFO:sqlalchemy.engine.Engine:[cached since 18.91s ago] ('pending', '2026-10-08 01:17:26.074868', 'running', '2026-10-08 01:07:26.074286')
2026-10-07 20:17:26,075 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:26,075 INFO sqlalchemy.engine.Engine [cached since 18.91s ago] ('pending', '2026-10-08 01:17:26.075303', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 18.91s ago] ('pending', '2026-10-08 01:17:26.075303', 20, 0)
2026-10-07 20:17:26,076 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:26,076 INFO sqlalchemy.engine.Engine [cached since 5.828s ago] ('running', '2026-10-08 01:17:26.076361', 16, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 5.828s ago] ('running', '2026-10-08 01:17:26.076361', 16, 'pending')
2026-10-07 20:17:26,076 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,079 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,079 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:26,079 INFO sqlalchemy.engine.Engine [cached since 5.826s ago] (16,)
INFO:sqlalchemy.engine.Engine:[cached since 5.826s ago] (16,)
2026-10-07 20:17:26,080 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,080 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:26,080 INFO sqlalchemy.engine.Engine [cached since 5.645s ago] (6,)
INFO:sqlalchemy.engine.Engine:[cached since 5.645s ago] (6,)
2026-10-07 20:17:26,080 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,081 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,081 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:26,081 INFO sqlalchemy.engine.Engine [cached since 5.641s ago] (6,)
INFO:sqlalchemy.engine.Engine:[cached since 5.641s ago] (6,)
2026-10-07 20:17:26,082 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:26,082 INFO sqlalchemy.engine.Engine [cached since 5.64s ago] (10,)
INFO:sqlalchemy.engine.Engine:[cached since 5.64s ago] (10,)
2026-10-07 20:17:26,083 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:26,083 INFO sqlalchemy.engine.Engine [cached since 5.64s ago] (10,)
INFO:sqlalchemy.engine.Engine:[cached since 5.64s ago] (10,)
2026-10-07 20:17:26,083 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:26,084 INFO sqlalchemy.engine.Engine [cached since 5.639s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 5.639s ago] (24,)
2026-10-07 20:17:26,084 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:26,084 INFO sqlalchemy.engine.Engine [cached since 5.638s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 5.638s ago] (24,)
2026-10-07 20:17:26,085 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:26,085 INFO sqlalchemy.engine.Engine [cached since 5.634s ago] (28,)
INFO:sqlalchemy.engine.Engine:[cached since 5.634s ago] (28,)
2026-10-07 20:17:26,086 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:26,086 INFO sqlalchemy.engine.Engine [cached since 5.529s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 5.529s ago] (24,)
2026-10-07 20:17:26,087 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to user_20261007201725580972@test.example.com
2026-10-07 20:17:26,097 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,097 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,097 INFO sqlalchemy.engine.Engine [cached since 0.1806s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 0.1806s ago] (24,)
2026-10-07 20:17:26,098 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:26,098 INFO sqlalchemy.engine.Engine [cached since 0.1796s ago] (1, '2026-10-08 01:17:26.098436', 24)
INFO:sqlalchemy.engine.Engine:[cached since 0.1796s ago] (1, '2026-10-08 01:17:26.098436', 24)
2026-10-07 20:17:26,099 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,101 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:26,101 INFO sqlalchemy.engine.Engine [cached since 5.483s ago] ('done', '2026-10-08 01:17:26.101320', 16)
INFO:sqlalchemy.engine.Engine:[cached since 5.483s ago] ('done', '2026-10-08 01:17:26.101320', 16)
2026-10-07 20:17:26,101 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:26,104 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:26,104 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:26,104 INFO sqlalchemy.engine.Engine [cached since 18.94s ago] ('pending', '2026-10-08 01:17:26.104839', 'running', '2026-10-08 01:07:26.104058')
INFO:sqlalchemy.engine.Engine:[cached since 18.94s ago] ('pending', '2026-10-08 01:17:26.104839', 'running', '2026-10-08 01:07:26.104058')
2026-10-07 20:17:26,105 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:26,105 INFO sqlalchemy.engine.Engine [cached since 18.94s ago] ('pending', '2026-10-08 01:17:26.105344', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 18.94s ago] ('pending', '2026-10-08 01:17:26.105344', 20, 0)
2026-10-07 20:17:26,106 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:35208 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:26,124 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,124 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,124 INFO sqlalchemy.engine.Engine [cached since 13.76s ago] (24,)
2026-10-07 20:17:26,131 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:26,131 INFO sqlalchemy.engine.Engine [cached since 6.287s ago] ('Urgent Event', None, '2026-10-08 04:17:26.121424', None, 'UTC', None, 0, 0, 'notifiq-web', 'pending', 24, None, 'urgent', None, None, None, None, '2026-10-08 01:17:26.131301', '2026-10-08 01:17:26.131304')
2026-10-07 20:17:26,137 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:26,137 INFO sqlalchemy.engine.Engine [cached since 6.288s ago] ('notifiq-web/7-urgent-event', '2026-10-08 01:17:26.136987', 7)
2026-10-07 20:17:26,140 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,140 INFO sqlalchemy.engine.Engine [cached since 0.9397s ago] (24,)
2026-10-07 20:17:26,144 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? AND events.organization_id IS NULL AND events.end_date > ?
2026-10-07 20:17:26,144 INFO sqlalchemy.engine.Engine [cached since 0.9395s ago] (24, '2026-10-08 01:17:26.143946')
2026-10-07 20:17:26,147 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:26,147 INFO sqlalchemy.engine.Engine [cached since 6.286s ago] (7,)
2026-10-07 20:17:26,151 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:26,151 INFO sqlalchemy.engine.Engine [cached since 6.267s ago] (24, 'autosub:default')
2026-10-07 20:17:26,155 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:26,155 INFO sqlalchemy.engine.Engine [cached since 6.27s ago] (24, 'autosub:urgent')
2026-10-07 20:17:26,159 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:26,159 INFO sqlalchemy.engine.Engine [cached since 6.236s ago] (7, 24, 0, '2026-10-08 01:17:26.158975', '2026-10-08 01:17:26.158977')
2026-10-07 20:17:26,163 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:26,163 INFO sqlalchemy.engine.Engine [cached since 6.253s ago] (11, 28, 'autosub:default', '2026-10-08 01:17:26.163317')
2026-10-07 20:17:26,167 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,170 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,170 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:26,171 INFO sqlalchemy.engine.Engine [cached since 6.232s ago] ('event-end-7',)
2026-10-07 20:17:26,175 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:26,175 INFO sqlalchemy.engine.Engine [cached since 6.231s ago] ('event_end', 'event-end-7', 7, None, None, '2026-10-15 01:17:26.170546', 'pending', 0, 3, None, '2026-10-08 01:17:26.175165', '2026-10-08 01:17:26.175167')
2026-10-07 20:17:26,182 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:26,182 INFO sqlalchemy.engine.Engine [cached since 6.232s ago] (7,)
2026-10-07 20:17:26,186 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:26,186 INFO sqlalchemy.engine.Engine [cached since 6.231s ago] (24,)
2026-10-07 20:17:26,190 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:26,190 INFO sqlalchemy.engine.Engine [cached since 6.23s ago] (11,)
2026-10-07 20:17:26,193 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:26,193 INFO sqlalchemy.engine.Engine [cached since 6.229s ago] (11,)
2026-10-07 20:17:26,198 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:26,198 INFO sqlalchemy.engine.Engine [cached since 6.229s ago] (24,)
2026-10-07 20:17:26,203 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:26,203 INFO sqlalchemy.engine.Engine [cached since 6.218s ago] (11,)
2026-10-07 20:17:26,206 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:26,206 INFO sqlalchemy.engine.Engine [cached since 6.218s ago] (11,)
2026-10-07 20:17:26,211 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:26,211 INFO sqlalchemy.engine.Engine [cached since 6.267s ago] ('notify_subscribers', None, 7, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:26.210830', 'pending', 0, 3, None, '2026-10-08 01:17:26.211241', '2026-10-08 01:17:26.211244')
2026-10-07 20:17:26,216 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35208 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:26,288 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,288 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,288 INFO sqlalchemy.engine.Engine [cached since 13.92s ago] (24,)
2026-10-07 20:17:26,292 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.user_id = ? ORDER BY subscriptions.created_at DESC
2026-10-07 20:17:26,292 INFO sqlalchemy.engine.Engine [cached since 0.7556s ago] (24,)
2026-10-07 20:17:26,297 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:26,297 INFO sqlalchemy.engine.Engine [cached since 0.7562s ago] (11, 10)
2026-10-07 20:17:26,301 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:26,301 INFO sqlalchemy.engine.Engine [cached since 0.7552s ago] (11, 10)
INFO:     127.0.0.1:35208 - "GET /api/v1/subscriptions HTTP/1.1" 200 OK
2026-10-07 20:17:26,330 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,335 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,335 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,335 INFO sqlalchemy.engine.Engine [cached since 13.97s ago] (24,)
2026-10-07 20:17:26,341 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:26,341 INFO sqlalchemy.engine.Engine [cached since 7.146s ago] (24, 'admin')
2026-10-07 20:17:26,346 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:26,346 INFO sqlalchemy.engine.Engine [cached since 6.618s ago] (24,)
2026-10-07 20:17:26,350 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:26,351 INFO sqlalchemy.engine.Engine [cached since 14.96s ago] (24, 'Critical Alerts', 'autosub:critical')
2026-10-07 20:17:26,355 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:26,355 INFO sqlalchemy.engine.Engine [cached since 14.92s ago] (24, None, 'Critical Alerts', <memory at 0x7f5cbc1b0dc0>, 'autosub:critical', 1, None, None, '2026-10-08 01:17:26.355042', '2026-10-08 01:17:26.355044')
2026-10-07 20:17:26,359 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:26,359 INFO sqlalchemy.engine.Engine [cached since 14.92s ago] ('gotify', <memory at 0x7f5cbc1b1c00>, '2026-10-08 01:17:26.359333', 29)
2026-10-07 20:17:26,363 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,366 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,366 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? ORDER BY events.start_date DESC
 LIMIT ? OFFSET ?
2026-10-07 20:17:26,366 INFO sqlalchemy.engine.Engine [cached since 6.577s ago] (24, 10000, 0)
2026-10-07 20:17:26,371 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:26,371 INFO sqlalchemy.engine.Engine [cached since 6.49s ago] (6, 24)
2026-10-07 20:17:26,375 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:26,375 INFO sqlalchemy.engine.Engine [cached since 6.464s ago] (10, 29, None, '2026-10-08 01:17:26.374971')
2026-10-07 20:17:26,378 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,380 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,381 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:26,381 INFO sqlalchemy.engine.Engine [cached since 6.586s ago] (29,)
INFO:     127.0.0.1:35208 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:26,419 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:26,425 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,425 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:26,425 INFO sqlalchemy.engine.Engine [cached since 14.06s ago] (24,)
2026-10-07 20:17:26,430 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.user_id = ? ORDER BY subscriptions.created_at DESC
2026-10-07 20:17:26,430 INFO sqlalchemy.engine.Engine [cached since 0.8935s ago] (24,)
2026-10-07 20:17:26,435 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:26,435 INFO sqlalchemy.engine.Engine [cached since 0.8935s ago] (11, 10)
2026-10-07 20:17:26,439 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:26,439 INFO sqlalchemy.engine.Engine [cached since 0.8931s ago] (11, 10)
INFO:     127.0.0.1:35208 - "GET /api/v1/subscriptions HTTP/1.1" 200 OK
2026-10-07 20:17:26,468 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 28%]
tests/test_billing_urls.py::test_get_frontend_url_falls_back_to_frontend_base PASSED [ 29%]
tests/test_billing_urls.py::test_get_billing_urls_supports_legacy_dashboard_path PASSED [ 30%]
tests/test_billing_urls.py::test_get_billing_urls_supports_success_cancel_mapping PASSED [ 32%]
tests/test_billing_urls.py::test_require_stripe_configured_rejects_missing_secret PASSED [ 33%]
tests/test_billing_urls.py::test_require_stripe_configured_returns_runtime_settings PASSED [ 34%]
tests/test_billing_urls.py::test_require_stripe_configured_rejects_missing_dependency PASSED [ 35%]
tests/test_csrf_dependency.py::test_csrf_skips_safe_methods PASSED       [ 36%]
tests/test_csrf_dependency.py::test_csrf_rejects_unsafe_cookie_request_without_origin PASSED [ 38%]
tests/test_csrf_dependency.py::test_csrf_allows_configured_origin PASSED [ 39%]
tests/test_csrf_dependency.py::test_csrf_rejects_disallowed_origin PASSED [ 40%]
tests/test_csrf_dependency.py::test_require_verified_user_allows_verified_user PASSED [ 41%]
tests/test_csrf_dependency.py::test_require_verified_user_rejects_unverified_user PASSED [ 42%]
tests/test_csrf_dependency.py::test_health_check_healthy_when_db_and_jobs_ok PASSED [ 44%]
tests/test_csrf_dependency.py::test_health_check_degraded_when_dead_jobs_exist PASSED [ 45%]
tests/test_csrf_dependency.py::test_health_check_unhealthy_when_db_down PASSED [ 46%]
tests/test_health.py::TestHealthCheck::test_health_endpoint_accessible 2026-10-07 20:17:26,498 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,498 INFO sqlalchemy.engine.Engine SELECT 1
2026-10-07 20:17:26,498 INFO sqlalchemy.engine.Engine [generated in 0.00013s] ()
2026-10-07 20:17:26,500 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ?
2026-10-07 20:17:26,500 INFO sqlalchemy.engine.Engine [generated in 0.00009s] ('dead',)
INFO:     127.0.0.1:35224 - "GET /api/v1/health HTTP/1.1" 200 OK
2026-10-07 20:17:26,501 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 47%]
tests/test_health.py::TestHealthCheck::test_health_returns_valid_response 2026-10-07 20:17:26,508 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,508 INFO sqlalchemy.engine.Engine SELECT 1
2026-10-07 20:17:26,508 INFO sqlalchemy.engine.Engine [cached since 0.009722s ago] ()
2026-10-07 20:17:26,509 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ?
2026-10-07 20:17:26,509 INFO sqlalchemy.engine.Engine [cached since 0.009044s ago] ('dead',)
INFO:     127.0.0.1:35236 - "GET /api/v1/health HTTP/1.1" 200 OK
2026-10-07 20:17:26,509 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 48%]
tests/test_health.py::TestAPIAvailability::test_api_responds 2026-10-07 20:17:26,516 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:26,516 INFO sqlalchemy.engine.Engine SELECT 1
2026-10-07 20:17:26,516 INFO sqlalchemy.engine.Engine [cached since 0.01761s ago] ()
2026-10-07 20:17:26,517 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ?
2026-10-07 20:17:26,517 INFO sqlalchemy.engine.Engine [cached since 0.01696s ago] ('dead',)
INFO:     127.0.0.1:35250 - "GET /api/v1/health HTTP/1.1" 200 OK
2026-10-07 20:17:26,518 INFO sqlalchemy.engine.Engine COMMIT
PASSED      [ 50%]
tests/test_health.py::TestAPIAvailability::test_cors_headers_present INFO:     127.0.0.1:35262 - "OPTIONS /api/v1/health HTTP/1.1" 405 Method Not Allowed
PASSED [ 51%]
tests/test_health.py::TestRateLimitHeaders::test_rate_limit_headers_present_on_non_health_response INFO:     127.0.0.1:35264 - "GET /api/v1/users/me HTTP/1.1" 401 Unauthorized
PASSED [ 52%]
tests/test_integration_converters.py::test_convert_gotify_to_apprise PASSED [ 53%]
tests/test_integration_converters.py::test_convert_email_to_apprise PASSED [ 54%]
tests/test_integration_converters.py::test_convert_sms_to_apprise PASSED [ 55%]
tests/test_integration_converters.py::test_convert_twilio_to_apprise PASSED [ 57%]
tests/test_integration_converters.py::test_convert_ntfy_to_apprise PASSED [ 58%]
tests/test_integration_converters.py::test_convert_discord_to_apprise PASSED [ 59%]
tests/test_integration_converters.py::test_convert_slack_to_apprise PASSED [ 60%]
tests/test_integration_converters.py::test_convert_telegram_to_apprise PASSED [ 61%]
tests/test_integration_converters.py::test_convert_matrix_to_apprise PASSED [ 63%]
tests/test_integration_converters.py::test_convert_msteams_to_apprise PASSED [ 64%]
tests/test_integration_converters.py::test_convert_bluesky_to_apprise PASSED [ 65%]
tests/test_integration_converters.py::test_convert_pushover_to_apprise PASSED [ 66%]
tests/test_integration_converters.py::test_convert_signal_to_apprise PASSED [ 67%]
tests/test_live_delivery.py::test_gotify_roundtrip SKIPPED (live test
(real outbound delivery, secrets required); use --run-live)              [ 69%]
tests/test_live_delivery.py::test_email_via_relay SKIPPED (live test
(real outbound delivery, secrets required); use --run-live)              [ 70%]
tests/test_live_delivery.py::test_sms_via_carrier_gateway SKIPPED (live
test (real outbound delivery, secrets required); use --run-live)         [ 71%]
tests/test_scheduler.py::test_enqueue_dedupe_reschedules_existing PASSED [ 72%]
tests/test_scheduler.py::test_schedule_reminders_skips_past_offsets PASSED [ 73%]
tests/test_scheduler.py::test_reminder_job_fires_and_sends PASSED        [ 75%]
tests/test_scheduler.py::test_failing_job_retries_then_dead PASSED       [ 76%]
tests/test_scheduler.py::test_event_end_creates_next_occurrence PASSED   [ 77%]
tests/test_scheduler.py::test_cancel_event_jobs 2026-10-07 20:17:27,107 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,107 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:27,107 INFO sqlalchemy.engine.Engine [cached since 19.94s ago] ('pending', '2026-10-08 01:17:27.107805', 'running', '2026-10-08 01:07:27.106986')
INFO:sqlalchemy.engine.Engine:[cached since 19.94s ago] ('pending', '2026-10-08 01:17:27.107805', 'running', '2026-10-08 01:07:27.106986')
2026-10-07 20:17:27,109 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:27,109 INFO sqlalchemy.engine.Engine [cached since 19.94s ago] ('pending', '2026-10-08 01:17:27.108565', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 19.94s ago] ('pending', '2026-10-08 01:17:27.108565', 20, 0)
2026-10-07 20:17:27,110 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:27,110 INFO sqlalchemy.engine.Engine [cached since 6.861s ago] ('running', '2026-10-08 01:17:27.109977', 18, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 6.861s ago] ('running', '2026-10-08 01:17:27.109977', 18, 'pending')
2026-10-07 20:17:27,110 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:27,113 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,113 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:27,113 INFO sqlalchemy.engine.Engine [cached since 6.86s ago] (18,)
INFO:sqlalchemy.engine.Engine:[cached since 6.86s ago] (18,)
2026-10-07 20:17:27,114 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,114 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:27,114 INFO sqlalchemy.engine.Engine [cached since 6.679s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 6.679s ago] (7,)
2026-10-07 20:17:27,114 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:27,115 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,115 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:27,115 INFO sqlalchemy.engine.Engine [cached since 6.675s ago] (7,)
INFO:sqlalchemy.engine.Engine:[cached since 6.675s ago] (7,)
2026-10-07 20:17:27,116 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:27,116 INFO sqlalchemy.engine.Engine [cached since 6.674s ago] (11,)
INFO:sqlalchemy.engine.Engine:[cached since 6.674s ago] (11,)
2026-10-07 20:17:27,116 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:27,117 INFO sqlalchemy.engine.Engine [cached since 6.674s ago] (11,)
INFO:sqlalchemy.engine.Engine:[cached since 6.674s ago] (11,)
2026-10-07 20:17:27,117 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:27,117 INFO sqlalchemy.engine.Engine [cached since 6.672s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 6.672s ago] (24,)
2026-10-07 20:17:27,150 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:27,150 INFO sqlalchemy.engine.Engine [cached since 6.704s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 6.704s ago] (24,)
2026-10-07 20:17:27,151 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:27,151 INFO sqlalchemy.engine.Engine [cached since 6.7s ago] (28,)
INFO:sqlalchemy.engine.Engine:[cached since 6.7s ago] (28,)
2026-10-07 20:17:27,152 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:27,152 INFO sqlalchemy.engine.Engine [cached since 6.594s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 6.594s ago] (24,)
2026-10-07 20:17:27,152 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to user_20261007201725580972@test.example.com
2026-10-07 20:17:27,162 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,162 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:27,162 INFO sqlalchemy.engine.Engine [cached since 1.245s ago] (24,)
INFO:sqlalchemy.engine.Engine:[cached since 1.245s ago] (24,)
2026-10-07 20:17:27,163 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:27,163 INFO sqlalchemy.engine.Engine [cached since 1.244s ago] (2, '2026-10-08 01:17:27.163204', 24)
INFO:sqlalchemy.engine.Engine:[cached since 1.244s ago] (2, '2026-10-08 01:17:27.163204', 24)
2026-10-07 20:17:27,163 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
PASSED                   [ 78%]2026-10-07 20:17:27,166 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:27,166 INFO sqlalchemy.engine.Engine [cached since 6.548s ago] ('done', '2026-10-08 01:17:27.166139', 18)
INFO:sqlalchemy.engine.Engine:[cached since 6.548s ago] ('done', '2026-10-08 01:17:27.166139', 18)
2026-10-07 20:17:27,166 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT

tests/test_scheduler.py::test_notify_subscribers_job_dispatches 2026-10-07 20:17:27,169 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:27,169 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:27,169 INFO sqlalchemy.engine.Engine [cached since 20s ago] ('pending', '2026-10-08 01:17:27.169491', 'running', '2026-10-08 01:07:27.169013')
INFO:sqlalchemy.engine.Engine:[cached since 20s ago] ('pending', '2026-10-08 01:17:27.169491', 'running', '2026-10-08 01:07:27.169013')
2026-10-07 20:17:27,170 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:27,170 INFO sqlalchemy.engine.Engine [cached since 20s ago] ('pending', '2026-10-08 01:17:27.169887', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 20s ago] ('pending', '2026-10-08 01:17:27.169887', 20, 0)
2026-10-07 20:17:27,170 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
PASSED   [ 79%]
tests/test_scheduler.py::test_enqueue_replaces_done_job PASSED           [ 80%]
tests/test_scheduler.py::test_stale_running_job_recovered PASSED         [ 82%]
tests/test_service_delivery.py::TestEmailDelivery::test_registration_transmits_verification_email 2026-10-07 20:17:27,362 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,363 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:27,363 INFO sqlalchemy.engine.Engine [cached since 16.21s ago] ('test_20261007201727358234@test.example.com',)
2026-10-07 20:17:27,573 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:27,574 INFO sqlalchemy.engine.Engine [cached since 16.21s ago] ('test_20261007201727358234@test.example.com', 'Sink User', '$2b$12$0QeBDwgakv06PpGC6dAhx.4LtxKJu4w5ztPMDYrmvRUtWEJEKIHKm', 0, 'free', 0, 0, '2026-10-08 01:17:27.573832', None, None, None, None, '2026-10-08 01:17:27.573836', '2026-10-08 01:17:27.573837')
2026-10-07 20:17:27,606 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:27,608 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,608 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:27,609 INFO sqlalchemy.engine.Engine [cached since 16.23s ago] (25,)
2026-10-07 20:17:27,614 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:27,614 INFO sqlalchemy.engine.Engine [cached since 16.22s ago] (25, 'Email: test_20261007201727358234@test.example.com', 'autosub:default')
2026-10-07 20:17:27,618 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:27,618 INFO sqlalchemy.engine.Engine [cached since 16.18s ago] (25, None, 'Email: test_20261007201727358234@test.example.com', <memory at 0x7f5cbc1b1480>, 'autosub:default', 1, None, None, '2026-10-08 01:17:27.618183', '2026-10-08 01:17:27.618186')
2026-10-07 20:17:27,622 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:27,622 INFO sqlalchemy.engine.Engine [cached since 16.18s ago] ('email', <memory at 0x7f5cbc1b1b40>, '2026-10-08 01:17:27.622800', 30)
2026-10-07 20:17:27,626 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:27,640 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,640 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:27,640 INFO sqlalchemy.engine.Engine [cached since 15.76s ago] ('d717e0942dfcf417b2a73b54e9fc192bf348e336b402fa975f49c90bb20b281f', 25, '2026-10-08 01:17:27.640509', '2026-10-15 01:17:27.640115')
INFO:     127.0.0.1:35268 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:27,676 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 83%]
tests/test_service_delivery.py::TestEmailDelivery::test_verification_link_from_delivered_email_works 2026-10-07 20:17:27,689 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,689 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:27,689 INFO sqlalchemy.engine.Engine [cached since 16.54s ago] ('test_20261007201727684356@test.example.com',)
2026-10-07 20:17:27,919 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:27,919 INFO sqlalchemy.engine.Engine [cached since 16.56s ago] ('test_20261007201727684356@test.example.com', 'Sink User', '$2b$12$PAZiSaVh3cmM2N1rPsTMfuZUQeuCT5lf986L64xpVf1S9zp9VTawy', 0, 'free', 0, 0, '2026-10-08 01:17:27.919474', None, None, None, None, '2026-10-08 01:17:27.919478', '2026-10-08 01:17:27.919479')
2026-10-07 20:17:27,924 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:27,926 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,927 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:27,927 INFO sqlalchemy.engine.Engine [cached since 16.55s ago] (26,)
2026-10-07 20:17:27,931 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:27,931 INFO sqlalchemy.engine.Engine [cached since 16.54s ago] (26, 'Email: test_20261007201727684356@test.example.com', 'autosub:default')
2026-10-07 20:17:27,934 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:27,934 INFO sqlalchemy.engine.Engine [cached since 16.5s ago] (26, None, 'Email: test_20261007201727684356@test.example.com', <memory at 0x7f5cbd903f40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:27.934890', '2026-10-08 01:17:27.934891')
2026-10-07 20:17:27,938 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:27,938 INFO sqlalchemy.engine.Engine [cached since 16.49s ago] ('email', <memory at 0x7f5cbd903f40>, '2026-10-08 01:17:27.938585', 31)
2026-10-07 20:17:27,941 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:27,954 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,955 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:27,955 INFO sqlalchemy.engine.Engine [cached since 16.08s ago] ('b34a52ad6879455cad67fa84cd46eb54f33c7979cc4859dd4563334385d0d847', 26, '2026-10-08 01:17:27.954957', '2026-10-15 01:17:27.954603')
INFO:     127.0.0.1:35278 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:27,985 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:27,990 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:27,990 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:27,990 INFO sqlalchemy.engine.Engine [cached since 15.62s ago] (26,)
2026-10-07 20:17:27,995 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:27,995 INFO sqlalchemy.engine.Engine [cached since 15.62s ago] (1, '2026-10-08 01:17:27.995102', 26)
2026-10-07 20:17:27,999 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35278 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyNiwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzI3Njg0MzU2QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0NywiaWF0IjoxNzkxNDIyMjQ3fQ.U8QIY-pzNL9ehiif8epJyCMqtLNeDIt3rPWOjNaD_xw HTTP/1.1" 200 OK
2026-10-07 20:17:28,032 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,033 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,033 INFO sqlalchemy.engine.Engine [cached since 15.67s ago] (26,)
INFO:     127.0.0.1:35278 - "GET /api/v1/users/me HTTP/1.1" 200 OK
2026-10-07 20:17:28,051 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 84%]
tests/test_service_delivery.py::TestEmailDelivery::test_password_reset_transmits_email 2026-10-07 20:17:28,061 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,061 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:28,061 INFO sqlalchemy.engine.Engine [cached since 16.91s ago] ('test_20261007201728057595@test.example.com',)
2026-10-07 20:17:28,172 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:28,172 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:28,172 INFO sqlalchemy.engine.Engine [cached since 21.01s ago] ('pending', '2026-10-08 01:17:28.172709', 'running', '2026-10-08 01:07:28.171992')
INFO:sqlalchemy.engine.Engine:[cached since 21.01s ago] ('pending', '2026-10-08 01:17:28.172709', 'running', '2026-10-08 01:07:28.171992')
2026-10-07 20:17:28,173 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:28,173 INFO sqlalchemy.engine.Engine [cached since 21s ago] ('pending', '2026-10-08 01:17:28.173220', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 21s ago] ('pending', '2026-10-08 01:17:28.173220', 20, 0)
2026-10-07 20:17:28,173 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:28,252 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:28,252 INFO sqlalchemy.engine.Engine [cached since 16.89s ago] ('test_20261007201728057595@test.example.com', 'Test User', '$2b$12$KzfNTis.U55VHaFOSKOnpuX3fGluw2wZc2NmqjFwxN3G5i6cA1VNO', 0, 'free', 0, 0, '2026-10-08 01:17:28.251979', None, None, None, None, '2026-10-08 01:17:28.251982', '2026-10-08 01:17:28.251982')
2026-10-07 20:17:28,280 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,283 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,283 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,283 INFO sqlalchemy.engine.Engine [cached since 16.9s ago] (27,)
2026-10-07 20:17:28,288 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:28,288 INFO sqlalchemy.engine.Engine [cached since 16.89s ago] (27, 'Email: test_20261007201728057595@test.example.com', 'autosub:default')
2026-10-07 20:17:28,291 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:28,292 INFO sqlalchemy.engine.Engine [cached since 16.85s ago] (27, None, 'Email: test_20261007201728057595@test.example.com', <memory at 0x7f5cbc1b2080>, 'autosub:default', 1, None, None, '2026-10-08 01:17:28.291946', '2026-10-08 01:17:28.291947')
2026-10-07 20:17:28,295 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:28,295 INFO sqlalchemy.engine.Engine [cached since 16.85s ago] ('email', <memory at 0x7f5cbc1b1840>, '2026-10-08 01:17:28.295604', 32)
2026-10-07 20:17:28,298 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:28,312 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,312 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:28,312 INFO sqlalchemy.engine.Engine [cached since 16.44s ago] ('e7b934a858390edc045ff6022be25dc7e4b7b4e065b1d9eac36a4e29e6ac25af', 27, '2026-10-08 01:17:28.312857', '2026-10-15 01:17:28.312445')
INFO:     127.0.0.1:35286 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:28,343 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,348 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,348 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,348 INFO sqlalchemy.engine.Engine [cached since 15.98s ago] (27,)
2026-10-07 20:17:28,353 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:28,353 INFO sqlalchemy.engine.Engine [cached since 15.98s ago] (1, '2026-10-08 01:17:28.353377', 27)
2026-10-07 20:17:28,357 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35286 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyNywiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzI4MDU3NTk1QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0OCwiaWF0IjoxNzkxNDIyMjQ4fQ.y0yvwpa2LiA7AHHy31qCFzIJfwo99hMoNfYRehKiSnw HTTP/1.1" 200 OK
2026-10-07 20:17:28,399 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,400 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:28,400 INFO sqlalchemy.engine.Engine [cached since 17.25s ago] ('test_20261007201728057595@test.example.com',)
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35286 - "POST /api/v1/auth/password-reset HTTP/1.1" 200 OK
2026-10-07 20:17:28,431 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 85%]
tests/test_service_delivery.py::TestChannelDelivery::test_email_channel_test_endpoint_transmits 2026-10-07 20:17:28,442 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,442 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:28,442 INFO sqlalchemy.engine.Engine [cached since 17.29s ago] ('test_20261007201728438022@test.example.com',)
2026-10-07 20:17:28,652 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:28,652 INFO sqlalchemy.engine.Engine [cached since 17.29s ago] ('test_20261007201728438022@test.example.com', 'Test User', '$2b$12$hQezUqzSK3dUa6cqoCprtOCw2WmYOEChd0jwRZfCWiRbWOBUC21kS', 0, 'free', 0, 0, '2026-10-08 01:17:28.652044', None, None, None, None, '2026-10-08 01:17:28.652048', '2026-10-08 01:17:28.652049')
2026-10-07 20:17:28,664 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,667 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,667 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,667 INFO sqlalchemy.engine.Engine [cached since 17.29s ago] (28,)
2026-10-07 20:17:28,672 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:28,672 INFO sqlalchemy.engine.Engine [cached since 17.28s ago] (28, 'Email: test_20261007201728438022@test.example.com', 'autosub:default')
2026-10-07 20:17:28,676 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:28,676 INFO sqlalchemy.engine.Engine [cached since 17.24s ago] (28, None, 'Email: test_20261007201728438022@test.example.com', <memory at 0x7f5cbc1b2080>, 'autosub:default', 1, None, None, '2026-10-08 01:17:28.676486', '2026-10-08 01:17:28.676488')
2026-10-07 20:17:28,680 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:28,680 INFO sqlalchemy.engine.Engine [cached since 17.24s ago] ('email', <memory at 0x7f5cbc1b1000>, '2026-10-08 01:17:28.680568', 33)
2026-10-07 20:17:28,684 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:28,698 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,698 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:28,698 INFO sqlalchemy.engine.Engine [cached since 16.82s ago] ('c0004a307d3b24234993725109c6f79b3647d80dbb2cd18b62bed8e1803ae5e5', 28, '2026-10-08 01:17:28.698495', '2026-10-15 01:17:28.698004')
INFO:     127.0.0.1:35298 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:28,734 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,741 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,741 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,741 INFO sqlalchemy.engine.Engine [cached since 16.38s ago] (28,)
2026-10-07 20:17:28,746 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:28,746 INFO sqlalchemy.engine.Engine [cached since 16.38s ago] (1, '2026-10-08 01:17:28.746254', 28)
2026-10-07 20:17:28,750 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35298 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyOCwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzI4NDM4MDIyQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0OCwiaWF0IjoxNzkxNDIyMjQ4fQ.9EegTdwIVuQop6fs1BmGTCzyw8VJIy3prPyyiMr1fXA HTTP/1.1" 200 OK
2026-10-07 20:17:28,791 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,791 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,791 INFO sqlalchemy.engine.Engine [cached since 16.43s ago] (28,)
2026-10-07 20:17:28,797 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:28,797 INFO sqlalchemy.engine.Engine [cached since 9.602s ago] (28, 'admin')
2026-10-07 20:17:28,800 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:28,800 INFO sqlalchemy.engine.Engine [cached since 9.073s ago] (28,)
2026-10-07 20:17:28,805 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:28,805 INFO sqlalchemy.engine.Engine [cached since 17.41s ago] (28, 'Email: sink', 'service-lane-email')
2026-10-07 20:17:28,810 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:28,810 INFO sqlalchemy.engine.Engine [cached since 17.37s ago] (28, None, 'Email: sink', <memory at 0x7f5cbc1b1300>, 'service-lane-email', 1, None, None, '2026-10-08 01:17:28.809992', '2026-10-08 01:17:28.809995')
2026-10-07 20:17:28,814 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:28,814 INFO sqlalchemy.engine.Engine [cached since 17.37s ago] ('email', <memory at 0x7f5cbc1b0e80>, '2026-10-08 01:17:28.814214', 34)
2026-10-07 20:17:28,817 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,820 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,820 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:28,820 INFO sqlalchemy.engine.Engine [cached since 9.025s ago] (34,)
INFO:     127.0.0.1:35298 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:28,855 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:28,861 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,861 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,861 INFO sqlalchemy.engine.Engine [cached since 16.5s ago] (28,)
2026-10-07 20:17:28,867 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:28,867 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (34,)
2026-10-07 20:17:28,871 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,871 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:28,871 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (28,)
2026-10-07 20:17:28,876 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:28,886 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,887 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:28,887 INFO sqlalchemy.engine.Engine [cached since 9.697s ago] (28,)
2026-10-07 20:17:28,892 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:28,892 INFO sqlalchemy.engine.Engine [generated in 0.00017s] (1, '2026-10-08 01:17:28.892815', 28)
2026-10-07 20:17:28,896 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35298 - "POST /api/v1/channels/34/test?title=Service+lane+email&body=email+channel+proof HTTP/1.1" 200 OK
2026-10-07 20:17:28,926 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 86%]
tests/test_service_delivery.py::TestChannelDelivery::test_sms_channel_transmits_to_carrier_gateway 2026-10-07 20:17:28,939 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:28,939 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:28,939 INFO sqlalchemy.engine.Engine [cached since 17.79s ago] ('test_20261007201728933769@test.example.com',)
2026-10-07 20:17:29,137 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,137 INFO sqlalchemy.engine.Engine [cached since 17.78s ago] ('test_20261007201728933769@test.example.com', 'Test User', '$2b$12$Oc3F7gLfrf29iJbPlULazujz5ylMCbcMKeNG7B9feUcIqvUH0jOh.', 0, 'free', 0, 0, '2026-10-08 01:17:29.137269', None, None, None, None, '2026-10-08 01:17:29.137273', '2026-10-08 01:17:29.137274')
2026-10-07 20:17:29,163 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,175 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:29,176 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:29,176 INFO sqlalchemy.engine.Engine [cached since 22.01s ago] ('pending', '2026-10-08 01:17:29.176127', 'running', '2026-10-08 01:07:29.175429')
INFO:sqlalchemy.engine.Engine:[cached since 22.01s ago] ('pending', '2026-10-08 01:17:29.176127', 'running', '2026-10-08 01:07:29.175429')
2026-10-07 20:17:29,199 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,199 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,199 INFO sqlalchemy.engine.Engine [cached since 17.82s ago] (29,)
2026-10-07 20:17:29,204 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:29,204 INFO sqlalchemy.engine.Engine [cached since 17.81s ago] (29, 'Email: test_20261007201728933769@test.example.com', 'autosub:default')
2026-10-07 20:17:29,208 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,208 INFO sqlalchemy.engine.Engine [cached since 17.77s ago] (29, None, 'Email: test_20261007201728933769@test.example.com', <memory at 0x7f5cbc1b2080>, 'autosub:default', 1, None, None, '2026-10-08 01:17:29.208058', '2026-10-08 01:17:29.208060')
2026-10-07 20:17:29,212 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:29,212 INFO sqlalchemy.engine.Engine [cached since 17.77s ago] ('email', <memory at 0x7f5cbc1b1300>, '2026-10-08 01:17:29.212032', 35)
2026-10-07 20:17:29,215 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:29,228 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,228 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:29,228 INFO sqlalchemy.engine.Engine [cached since 17.35s ago] ('e8a91c7a85efa6606631ec5fa5adfabadd7d4fe36f934a438746bcf8e7a8e8fb', 29, '2026-10-08 01:17:29.228694', '2026-10-15 01:17:29.228350')
INFO:     127.0.0.1:35312 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:29,260 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,265 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,265 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,265 INFO sqlalchemy.engine.Engine [cached since 16.9s ago] (29,)
2026-10-07 20:17:29,269 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:29,269 INFO sqlalchemy.engine.Engine [cached since 16.9s ago] (1, '2026-10-08 01:17:29.269761', 29)
2026-10-07 20:17:29,273 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,280 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:29,280 INFO sqlalchemy.engine.Engine [cached since 22.11s ago] ('pending', '2026-10-08 01:17:29.280350', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 22.11s ago] ('pending', '2026-10-08 01:17:29.280350', 20, 0)
2026-10-07 20:17:29,281 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35312 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjoyOSwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzI4OTMzNzY5QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0OSwiaWF0IjoxNzkxNDIyMjQ5fQ.rGc0AT1wKo1XwEMGA_nParq19WUSmqprhhzT_fyMpig HTTP/1.1" 200 OK
2026-10-07 20:17:29,309 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,309 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,309 INFO sqlalchemy.engine.Engine [cached since 16.94s ago] (29,)
2026-10-07 20:17:29,313 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:29,313 INFO sqlalchemy.engine.Engine [cached since 10.12s ago] (29, 'admin')
2026-10-07 20:17:29,317 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:29,317 INFO sqlalchemy.engine.Engine [cached since 9.589s ago] (29,)
2026-10-07 20:17:29,320 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:29,320 INFO sqlalchemy.engine.Engine [cached since 17.93s ago] (29, 'SMS: sink', 'service-lane-sms')
2026-10-07 20:17:29,326 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,326 INFO sqlalchemy.engine.Engine [cached since 17.89s ago] (29, None, 'SMS: sink', <memory at 0x7f5cbc1b1b40>, 'service-lane-sms', 1, None, None, '2026-10-08 01:17:29.326515', '2026-10-08 01:17:29.326517')
2026-10-07 20:17:29,341 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:29,341 INFO sqlalchemy.engine.Engine [cached since 17.9s ago] ('sms', <memory at 0x7f5cbc1b1480>, '2026-10-08 01:17:29.341788', 36)
2026-10-07 20:17:29,346 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,349 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,349 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:29,349 INFO sqlalchemy.engine.Engine [cached since 9.554s ago] (36,)
INFO:     127.0.0.1:35312 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:29,380 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,384 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,385 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,385 INFO sqlalchemy.engine.Engine [cached since 17.02s ago] (29,)
2026-10-07 20:17:29,389 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:29,389 INFO sqlalchemy.engine.Engine [cached since 0.522s ago] (36,)
2026-10-07 20:17:29,392 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,392 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:29,392 INFO sqlalchemy.engine.Engine [cached since 0.5212s ago] (29,)
2026-10-07 20:17:29,396 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:29,406 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,406 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,406 INFO sqlalchemy.engine.Engine [cached since 10.22s ago] (29,)
2026-10-07 20:17:29,411 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:29,411 INFO sqlalchemy.engine.Engine [cached since 0.5183s ago] (1, '2026-10-08 01:17:29.411030', 29)
2026-10-07 20:17:29,414 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35312 - "POST /api/v1/channels/36/test?title=Service+lane+SMS&body=sms+channel+proof HTTP/1.1" 200 OK
2026-10-07 20:17:29,439 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 88%]
tests/test_service_delivery.py::TestChannelDelivery::test_notify_endpoint_fans_out_to_tagged_channels 2026-10-07 20:17:29,449 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,449 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:29,449 INFO sqlalchemy.engine.Engine [cached since 18.3s ago] ('test_20261007201729445651@test.example.com',)
2026-10-07 20:17:29,639 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,639 INFO sqlalchemy.engine.Engine [cached since 18.28s ago] ('test_20261007201729445651@test.example.com', 'Test User', '$2b$12$7Dx2t7z1x/0UtLKjJFkdou7Cm095Cgka32Wvs9ZjZFx1Re7ZM.8nG', 0, 'free', 0, 0, '2026-10-08 01:17:29.639349', None, None, None, None, '2026-10-08 01:17:29.639353', '2026-10-08 01:17:29.639354')
2026-10-07 20:17:29,658 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,661 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,661 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,661 INFO sqlalchemy.engine.Engine [cached since 18.28s ago] (30,)
2026-10-07 20:17:29,666 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:29,666 INFO sqlalchemy.engine.Engine [cached since 18.27s ago] (30, 'Email: test_20261007201729445651@test.example.com', 'autosub:default')
2026-10-07 20:17:29,671 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,671 INFO sqlalchemy.engine.Engine [cached since 18.23s ago] (30, None, 'Email: test_20261007201729445651@test.example.com', <memory at 0x7f5cbc1b1b40>, 'autosub:default', 1, None, None, '2026-10-08 01:17:29.671459', '2026-10-08 01:17:29.671460')
2026-10-07 20:17:29,676 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:29,676 INFO sqlalchemy.engine.Engine [cached since 18.23s ago] ('email', <memory at 0x7f5cbc1b0280>, '2026-10-08 01:17:29.676267', 37)
2026-10-07 20:17:29,680 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:29,694 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,695 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:29,695 INFO sqlalchemy.engine.Engine [cached since 17.82s ago] ('3dadfdbc51a09e2e0140e31aae38ef997b73e5de546b533a22ec01520711f849', 30, '2026-10-08 01:17:29.694979', '2026-10-15 01:17:29.694376')
INFO:     127.0.0.1:35328 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:29,732 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,739 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,740 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,740 INFO sqlalchemy.engine.Engine [cached since 17.37s ago] (30,)
2026-10-07 20:17:29,745 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:29,745 INFO sqlalchemy.engine.Engine [cached since 17.37s ago] (1, '2026-10-08 01:17:29.745472', 30)
2026-10-07 20:17:29,750 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35328 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozMCwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzI5NDQ1NjUxQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY0OSwiaWF0IjoxNzkxNDIyMjQ5fQ.2o27iDm7_vIs2fEVLPU7_gxTT6vs6b2-CjTPSDfXbx0 HTTP/1.1" 200 OK
2026-10-07 20:17:29,792 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,792 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,792 INFO sqlalchemy.engine.Engine [cached since 17.43s ago] (30,)
2026-10-07 20:17:29,797 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:29,797 INFO sqlalchemy.engine.Engine [cached since 10.6s ago] (30, 'admin')
2026-10-07 20:17:29,801 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:29,801 INFO sqlalchemy.engine.Engine [cached since 10.07s ago] (30,)
2026-10-07 20:17:29,806 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:29,806 INFO sqlalchemy.engine.Engine [cached since 18.41s ago] (30, 'Email: fanout', 'fanout')
2026-10-07 20:17:29,810 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,810 INFO sqlalchemy.engine.Engine [cached since 18.37s ago] (30, None, 'Email: fanout', <memory at 0x7f5cbc1b0e80>, 'fanout', 1, None, None, '2026-10-08 01:17:29.810468', '2026-10-08 01:17:29.810470')
2026-10-07 20:17:29,814 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:29,814 INFO sqlalchemy.engine.Engine [cached since 18.37s ago] ('email', <memory at 0x7f5cbc1b1f00>, '2026-10-08 01:17:29.814383', 38)
2026-10-07 20:17:29,818 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,823 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,823 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:29,823 INFO sqlalchemy.engine.Engine [cached since 10.03s ago] (38,)
INFO:     127.0.0.1:35328 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:29,858 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,863 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,864 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,864 INFO sqlalchemy.engine.Engine [cached since 17.5s ago] (30,)
2026-10-07 20:17:29,870 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:29,870 INFO sqlalchemy.engine.Engine [cached since 10.68s ago] (30, 'admin')
2026-10-07 20:17:29,874 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:29,874 INFO sqlalchemy.engine.Engine [cached since 10.15s ago] (30,)
2026-10-07 20:17:29,878 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:29,878 INFO sqlalchemy.engine.Engine [cached since 18.48s ago] (30, 'SMS: fanout', 'fanout')
2026-10-07 20:17:29,882 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:29,882 INFO sqlalchemy.engine.Engine [cached since 18.44s ago] (30, None, 'SMS: fanout', <memory at 0x7f5cbc1b1a80>, 'fanout', 1, None, None, '2026-10-08 01:17:29.881954', '2026-10-08 01:17:29.881956')
2026-10-07 20:17:29,886 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:29,886 INFO sqlalchemy.engine.Engine [cached since 18.44s ago] ('sms', <memory at 0x7f5cbc1b0dc0>, '2026-10-08 01:17:29.886273', 39)
2026-10-07 20:17:29,889 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,892 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,892 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:29,892 INFO sqlalchemy.engine.Engine [cached since 10.1s ago] (39,)
INFO:     127.0.0.1:35328 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:29,923 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:29,928 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,928 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,928 INFO sqlalchemy.engine.Engine [cached since 17.56s ago] (30,)
2026-10-07 20:17:29,932 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:29,932 INFO sqlalchemy.engine.Engine [cached since 10.05s ago] (30, 'fanout')
2026-10-07 20:17:29,936 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,936 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:29,936 INFO sqlalchemy.engine.Engine [cached since 1.065s ago] (30,)
2026-10-07 20:17:29,940 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:29,955 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:29,955 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:29,955 INFO sqlalchemy.engine.Engine [cached since 10.77s ago] (30,)
2026-10-07 20:17:29,959 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:29,959 INFO sqlalchemy.engine.Engine [cached since 1.067s ago] (1, '2026-10-08 01:17:29.959903', 30)
2026-10-07 20:17:29,963 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35328 - "POST /api/v1/channels/notify HTTP/1.1" 200 OK
2026-10-07 20:17:30,021 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 89%]
tests/test_subscription_workflows.py::TestEventSubscription::test_creator_auto_subscribed 2026-10-07 20:17:30,031 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,031 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:30,032 INFO sqlalchemy.engine.Engine [cached since 18.88s ago] ('test_20261007201730028121@test.example.com',)
2026-10-07 20:17:30,222 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,222 INFO sqlalchemy.engine.Engine [cached since 18.86s ago] ('test_20261007201730028121@test.example.com', 'Test User', '$2b$12$g42H2MOELpGnXbQA9mYP9.WZwdG4jFOlrlbfR9RE5fAcHh6BZhhIm', 0, 'free', 0, 0, '2026-10-08 01:17:30.221912', None, None, None, None, '2026-10-08 01:17:30.221916', '2026-10-08 01:17:30.221917')
2026-10-07 20:17:30,226 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,229 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,229 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,229 INFO sqlalchemy.engine.Engine [cached since 18.85s ago] (31,)
2026-10-07 20:17:30,233 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:30,233 INFO sqlalchemy.engine.Engine [cached since 18.84s ago] (31, 'Email: test_20261007201730028121@test.example.com', 'autosub:default')
2026-10-07 20:17:30,237 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,237 INFO sqlalchemy.engine.Engine [cached since 18.8s ago] (31, None, 'Email: test_20261007201730028121@test.example.com', <memory at 0x7f5cbc1b1540>, 'autosub:default', 1, None, None, '2026-10-08 01:17:30.237595', '2026-10-08 01:17:30.237597')
2026-10-07 20:17:30,241 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:30,241 INFO sqlalchemy.engine.Engine [cached since 18.8s ago] ('email', <memory at 0x7f5cbc1b1300>, '2026-10-08 01:17:30.241412', 40)
2026-10-07 20:17:30,244 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:30,257 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,258 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:30,258 INFO sqlalchemy.engine.Engine [cached since 18.38s ago] ('1b6a66437fbc066a7c310476cfc7a8e1a30b8f266e15ab5494b830d27898aa96', 31, '2026-10-08 01:17:30.258109', '2026-10-15 01:17:30.257741')
2026-10-07 20:17:30,283 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:30,283 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:30,283 INFO sqlalchemy.engine.Engine [cached since 23.12s ago] ('pending', '2026-10-08 01:17:30.283412', 'running', '2026-10-08 01:07:30.282708')
INFO:sqlalchemy.engine.Engine:[cached since 23.12s ago] ('pending', '2026-10-08 01:17:30.283412', 'running', '2026-10-08 01:07:30.282708')
INFO:     127.0.0.1:35340 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:30,288 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,292 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:30,292 INFO sqlalchemy.engine.Engine [cached since 23.12s ago] ('pending', '2026-10-08 01:17:30.292227', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 23.12s ago] ('pending', '2026-10-08 01:17:30.292227', 20, 0)
2026-10-07 20:17:30,293 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:30,293 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,293 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,293 INFO sqlalchemy.engine.Engine [cached since 17.93s ago] (31,)
2026-10-07 20:17:30,297 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:30,297 INFO sqlalchemy.engine.Engine [cached since 17.93s ago] (1, '2026-10-08 01:17:30.297754', 31)
2026-10-07 20:17:30,301 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35340 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozMSwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMwMDI4MTIxQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MCwiaWF0IjoxNzkxNDIyMjUwfQ.awRBFs8wnvxgSgC6kGflR-cc11P9uMxdMQ4JSanXtPg HTTP/1.1" 200 OK
2026-10-07 20:17:30,336 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,336 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,336 INFO sqlalchemy.engine.Engine [cached since 17.97s ago] (31,)
2026-10-07 20:17:30,340 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,340 INFO sqlalchemy.engine.Engine [cached since 10.5s ago] ('Test Event', 'A test event for automated testing', '2026-10-08 01:22:30.333723', '2026-10-08 02:22:30.333723', 'UTC', None, 1, 0, 'notifiq-web', 'pending', 31, None, None, None, None, None, None, '2026-10-08 01:17:30.340758', '2026-10-08 01:17:30.340760')
2026-10-07 20:17:30,344 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:30,344 INFO sqlalchemy.engine.Engine [cached since 10.5s ago] ('notifiq-web/8-test-event', '2026-10-08 01:17:30.344583', 8)
2026-10-07 20:17:30,348 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,348 INFO sqlalchemy.engine.Engine [cached since 5.147s ago] (31,)
2026-10-07 20:17:30,351 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? AND events.organization_id IS NULL AND events.end_date > ?
2026-10-07 20:17:30,351 INFO sqlalchemy.engine.Engine [cached since 5.147s ago] (31, '2026-10-08 01:17:30.351448')
2026-10-07 20:17:30,355 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:30,355 INFO sqlalchemy.engine.Engine [cached since 10.49s ago] (8,)
2026-10-07 20:17:30,358 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:30,358 INFO sqlalchemy.engine.Engine [cached since 10.47s ago] (31, 'autosub:default')
2026-10-07 20:17:30,362 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:30,362 INFO sqlalchemy.engine.Engine [cached since 10.44s ago] (8, 31, 0, '2026-10-08 01:17:30.362209', '2026-10-08 01:17:30.362210')
2026-10-07 20:17:30,365 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:30,365 INFO sqlalchemy.engine.Engine [cached since 10.46s ago] (12, 40, 'autosub:default', '2026-10-08 01:17:30.365855')
2026-10-07 20:17:30,369 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,372 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,372 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:30,372 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] ('event-end-8',)
2026-10-07 20:17:30,376 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,376 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] ('event_end', 'event-end-8', 8, None, None, '2026-10-08 02:22:30.333723', 'pending', 0, 3, None, '2026-10-08 01:17:30.376414', '2026-10-08 01:17:30.376416')
2026-10-07 20:17:30,380 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:30,380 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] (8,)
2026-10-07 20:17:30,383 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:30,383 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] (31,)
2026-10-07 20:17:30,387 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:30,387 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] (12,)
2026-10-07 20:17:30,390 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:30,390 INFO sqlalchemy.engine.Engine [cached since 10.43s ago] (12,)
2026-10-07 20:17:30,394 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:30,394 INFO sqlalchemy.engine.Engine [cached since 10.42s ago] (31,)
2026-10-07 20:17:30,397 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:30,398 INFO sqlalchemy.engine.Engine [cached since 10.41s ago] (12,)
2026-10-07 20:17:30,401 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:30,401 INFO sqlalchemy.engine.Engine [cached since 10.41s ago] (12,)
2026-10-07 20:17:30,404 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,404 INFO sqlalchemy.engine.Engine [cached since 10.46s ago] ('notify_subscribers', None, 8, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:30.404726', 'pending', 0, 3, None, '2026-10-08 01:17:30.404891', '2026-10-08 01:17:30.404893')
2026-10-07 20:17:30,408 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35340 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:30,470 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,470 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,470 INFO sqlalchemy.engine.Engine [cached since 18.1s ago] (31,)
2026-10-07 20:17:30,474 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:30,474 INFO sqlalchemy.engine.Engine [cached since 10.38s ago] (8,)
2026-10-07 20:17:30,478 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:30,478 INFO sqlalchemy.engine.Engine [cached since 10.6s ago] (8, 31)
2026-10-07 20:17:30,535 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:35340 - "POST /api/v1/subscriptions HTTP/1.1" 400 Bad Request
PASSED [ 90%]
tests/test_subscription_workflows.py::TestEventSubscription::test_other_user_can_subscribe 2026-10-07 20:17:30,546 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,546 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:30,546 INFO sqlalchemy.engine.Engine [cached since 19.4s ago] ('test_20261007201730542447@test.example.com',)
2026-10-07 20:17:30,739 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,739 INFO sqlalchemy.engine.Engine [cached since 19.38s ago] ('test_20261007201730542447@test.example.com', 'Test User', '$2b$12$5aZkfD8sTqqOFIbvY4B.g.IE.ggDj6BB30wz.2SiF4CEyTD6KMNv2', 0, 'free', 0, 0, '2026-10-08 01:17:30.739679', None, None, None, None, '2026-10-08 01:17:30.739683', '2026-10-08 01:17:30.739683')
2026-10-07 20:17:30,744 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,747 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,747 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,747 INFO sqlalchemy.engine.Engine [cached since 19.37s ago] (32,)
2026-10-07 20:17:30,752 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:30,752 INFO sqlalchemy.engine.Engine [cached since 19.36s ago] (32, 'Email: test_20261007201730542447@test.example.com', 'autosub:default')
2026-10-07 20:17:30,756 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,756 INFO sqlalchemy.engine.Engine [cached since 19.32s ago] (32, None, 'Email: test_20261007201730542447@test.example.com', <memory at 0x7f5cbc1b1480>, 'autosub:default', 1, None, None, '2026-10-08 01:17:30.756399', '2026-10-08 01:17:30.756401')
2026-10-07 20:17:30,760 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:30,760 INFO sqlalchemy.engine.Engine [cached since 19.32s ago] ('email', <memory at 0x7f5cbc1b1cc0>, '2026-10-08 01:17:30.760621', 41)
2026-10-07 20:17:30,764 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:30,778 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,778 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:30,778 INFO sqlalchemy.engine.Engine [cached since 18.9s ago] ('47cd5e44bf04bfc4ad776fd56a4e615cb37da85b4f2a010d96c492e8596066d6', 32, '2026-10-08 01:17:30.778323', '2026-10-15 01:17:30.777888')
INFO:     127.0.0.1:35342 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:30,814 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,819 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,819 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,819 INFO sqlalchemy.engine.Engine [cached since 18.45s ago] (32,)
2026-10-07 20:17:30,824 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:30,824 INFO sqlalchemy.engine.Engine [cached since 18.45s ago] (1, '2026-10-08 01:17:30.824414', 32)
2026-10-07 20:17:30,828 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35342 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozMiwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMwNTQyNDQ3QHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MCwiaWF0IjoxNzkxNDIyMjUwfQ.AjIA34t3s16_4Sa01VQO7ivEBtLNcwAqlZ5COWurQoo HTTP/1.1" 200 OK
2026-10-07 20:17:30,865 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,865 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,865 INFO sqlalchemy.engine.Engine [cached since 18.5s ago] (32,)
2026-10-07 20:17:30,870 INFO sqlalchemy.engine.Engine INSERT INTO events (name, description, start_date, end_date, timezone, content, is_public, notify_on_completion, source, temporal_workflow_id, organizer_user_id, organization_id, tags, last_notified_at, series_id, series_position, recurrence_rule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,870 INFO sqlalchemy.engine.Engine [cached since 11.03s ago] ('Test Event', 'A test event for automated testing', '2026-10-08 01:22:30.862903', '2026-10-08 02:22:30.862903', 'UTC', None, 1, 0, 'notifiq-web', 'pending', 32, None, None, None, None, None, None, '2026-10-08 01:17:30.870519', '2026-10-08 01:17:30.870522')
2026-10-07 20:17:30,875 INFO sqlalchemy.engine.Engine UPDATE events SET temporal_workflow_id=?, updated_at=? WHERE events.id = ?
2026-10-07 20:17:30,875 INFO sqlalchemy.engine.Engine [cached since 11.03s ago] ('notifiq-web/9-test-event', '2026-10-08 01:17:30.875325', 9)
2026-10-07 20:17:30,879 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:30,879 INFO sqlalchemy.engine.Engine [cached since 5.678s ago] (32,)
2026-10-07 20:17:30,882 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.organizer_user_id = ? AND events.organization_id IS NULL AND events.end_date > ?
2026-10-07 20:17:30,882 INFO sqlalchemy.engine.Engine [cached since 5.678s ago] (32, '2026-10-08 01:17:30.882476')
2026-10-07 20:17:30,886 INFO sqlalchemy.engine.Engine SELECT events.id, events.name, events.description, events.start_date, events.end_date, events.timezone, events.content, events.is_public, events.notify_on_completion, events.source, events.temporal_workflow_id, events.organizer_user_id, events.organization_id, events.tags, events.last_notified_at, events.series_id, events.series_position, events.recurrence_rule, events.created_at, events.updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:30,886 INFO sqlalchemy.engine.Engine [cached since 11.03s ago] (9,)
2026-10-07 20:17:30,890 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.tag = ? AND channels.is_active = 1
2026-10-07 20:17:30,890 INFO sqlalchemy.engine.Engine [cached since 11.01s ago] (32, 'autosub:default')
2026-10-07 20:17:30,894 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:30,894 INFO sqlalchemy.engine.Engine [cached since 10.97s ago] (9, 32, 0, '2026-10-08 01:17:30.894224', '2026-10-08 01:17:30.894226')
2026-10-07 20:17:30,898 INFO sqlalchemy.engine.Engine INSERT INTO subscription_selectors (subscription_id, channel_id, tag, created_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:30,898 INFO sqlalchemy.engine.Engine [cached since 10.99s ago] (13, 41, 'autosub:default', '2026-10-08 01:17:30.898318')
2026-10-07 20:17:30,902 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:30,906 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:30,906 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.dedupe_key = ?
2026-10-07 20:17:30,906 INFO sqlalchemy.engine.Engine [cached since 10.97s ago] ('event-end-9',)
2026-10-07 20:17:30,911 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,911 INFO sqlalchemy.engine.Engine [cached since 10.97s ago] ('event_end', 'event-end-9', 9, None, None, '2026-10-08 02:22:30.862903', 'pending', 0, 3, None, '2026-10-08 01:17:30.911874', '2026-10-08 01:17:30.911877')
2026-10-07 20:17:30,916 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:30,916 INFO sqlalchemy.engine.Engine [cached since 10.97s ago] (9,)
2026-10-07 20:17:30,920 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:30,920 INFO sqlalchemy.engine.Engine [cached since 10.97s ago] (32,)
2026-10-07 20:17:30,924 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:30,924 INFO sqlalchemy.engine.Engine [cached since 10.96s ago] (13,)
2026-10-07 20:17:30,928 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:30,928 INFO sqlalchemy.engine.Engine [cached since 10.96s ago] (13,)
2026-10-07 20:17:30,932 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:30,932 INFO sqlalchemy.engine.Engine [cached since 10.96s ago] (32,)
2026-10-07 20:17:30,935 INFO sqlalchemy.engine.Engine SELECT subscriptions.id 
FROM subscriptions 
WHERE subscriptions.id = ?
2026-10-07 20:17:30,935 INFO sqlalchemy.engine.Engine [cached since 10.95s ago] (13,)
2026-10-07 20:17:30,939 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.id AS subscription_reminders_id, subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE ? = subscription_reminders.subscription_id
2026-10-07 20:17:30,939 INFO sqlalchemy.engine.Engine [cached since 10.95s ago] (13,)
2026-10-07 20:17:30,943 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:30,943 INFO sqlalchemy.engine.Engine [cached since 11s ago] ('notify_subscribers', None, 9, None, '{"title": "Event Created", "body": "Your event has been created!", "level": "info"}', '2026-10-08 01:17:30.942780', 'pending', 0, 3, None, '2026-10-08 01:17:30.942982', '2026-10-08 01:17:30.942984')
2026-10-07 20:17:30,946 INFO sqlalchemy.engine.Engine COMMIT
INFO:     127.0.0.1:35342 - "POST /api/v1/events HTTP/1.1" 201 Created
2026-10-07 20:17:31,011 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,011 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:31,011 INFO sqlalchemy.engine.Engine [cached since 19.86s ago] ('subscriber_20261007201731006575@test.example.com',)
2026-10-07 20:17:31,204 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,204 INFO sqlalchemy.engine.Engine [cached since 19.84s ago] ('subscriber_20261007201731006575@test.example.com', 'Subscriber', '$2b$12$KGgxG0EXNXCz.GMVyIE2tOlKaX9hzp2X40tRY2ie/9BHD2q2D4tVy', 0, 'free', 0, 0, '2026-10-08 01:17:31.204101', None, None, None, None, '2026-10-08 01:17:31.204105', '2026-10-08 01:17:31.204106')
2026-10-07 20:17:31,232 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,234 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,234 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,234 INFO sqlalchemy.engine.Engine [cached since 19.86s ago] (33,)
2026-10-07 20:17:31,239 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:31,239 INFO sqlalchemy.engine.Engine [cached since 19.85s ago] (33, 'Email: subscriber_20261007201731006575@test.example.com', 'autosub:default')
2026-10-07 20:17:31,243 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,243 INFO sqlalchemy.engine.Engine [cached since 19.81s ago] (33, None, 'Email: subscriber_20261007201731006575@test.example.com', <memory at 0x7f5cbc1b1fc0>, 'autosub:default', 1, None, None, '2026-10-08 01:17:31.243216', '2026-10-08 01:17:31.243218')
2026-10-07 20:17:31,246 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:31,246 INFO sqlalchemy.engine.Engine [cached since 19.8s ago] ('email', <memory at 0x7f5cbc1b2140>, '2026-10-08 01:17:31.246843', 42)
2026-10-07 20:17:31,250 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:31,263 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,263 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:31,263 INFO sqlalchemy.engine.Engine [cached since 19.39s ago] ('fdf804c004453cdd5ceb9557cae2b9ac935e8312fd1a8c04a0645c9c66c2a845', 33, '2026-10-08 01:17:31.263433', '2026-10-15 01:17:31.263096')
INFO:     127.0.0.1:35344 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:31,294 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,294 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,294 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:31,294 INFO sqlalchemy.engine.Engine [cached since 24.13s ago] ('pending', '2026-10-08 01:17:31.294713', 'running', '2026-10-08 01:07:31.293972')
INFO:sqlalchemy.engine.Engine:[cached since 24.13s ago] ('pending', '2026-10-08 01:17:31.294713', 'running', '2026-10-08 01:07:31.293972')
2026-10-07 20:17:31,298 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:31,298 INFO sqlalchemy.engine.Engine [cached since 24.13s ago] ('pending', '2026-10-08 01:17:31.298404', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 24.13s ago] ('pending', '2026-10-08 01:17:31.298404', 20, 0)
2026-10-07 20:17:31,299 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,299 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,299 INFO sqlalchemy.engine.Engine [cached since 18.93s ago] (33,)
2026-10-07 20:17:31,299 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:31,299 INFO sqlalchemy.engine.Engine [cached since 11.05s ago] ('running', '2026-10-08 01:17:31.299572', 20, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 11.05s ago] ('running', '2026-10-08 01:17:31.299572', 20, 'pending')
2026-10-07 20:17:31,300 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:31,300 INFO sqlalchemy.engine.Engine [cached since 11.05s ago] ('running', '2026-10-08 01:17:31.300404', 22, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 11.05s ago] ('running', '2026-10-08 01:17:31.300404', 22, 'pending')
2026-10-07 20:17:31,300 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine [cached since 11.05s ago] (20,)
INFO:sqlalchemy.engine.Engine:[cached since 11.05s ago] (20,)
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine [cached since 11.21s ago] (9,)
2026-10-07 20:17:31,303 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,304 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:31,304 INFO sqlalchemy.engine.Engine [cached since 10.87s ago] (8,)
INFO:sqlalchemy.engine.Engine:[cached since 10.87s ago] (8,)
2026-10-07 20:17:31,304 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,305 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,305 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:31,305 INFO sqlalchemy.engine.Engine [cached since 10.87s ago] (8,)
INFO:sqlalchemy.engine.Engine:[cached since 10.87s ago] (8,)
2026-10-07 20:17:31,306 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?)
2026-10-07 20:17:31,306 INFO sqlalchemy.engine.Engine [cached since 10.86s ago] (12,)
INFO:sqlalchemy.engine.Engine:[cached since 10.86s ago] (12,)
2026-10-07 20:17:31,306 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?)
2026-10-07 20:17:31,306 INFO sqlalchemy.engine.Engine [cached since 10.86s ago] (12,)
INFO:sqlalchemy.engine.Engine:[cached since 10.86s ago] (12,)
2026-10-07 20:17:31,307 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ? AND subscriptions.user_id = ?
2026-10-07 20:17:31,307 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?)
2026-10-07 20:17:31,307 INFO sqlalchemy.engine.Engine [cached since 11.43s ago] (9, 33)
2026-10-07 20:17:31,307 INFO sqlalchemy.engine.Engine [cached since 10.86s ago] (31,)
INFO:sqlalchemy.engine.Engine:[cached since 10.86s ago] (31,)
2026-10-07 20:17:31,308 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?)
2026-10-07 20:17:31,308 INFO sqlalchemy.engine.Engine [cached since 10.86s ago] (31,)
INFO:sqlalchemy.engine.Engine:[cached since 10.86s ago] (31,)
2026-10-07 20:17:31,309 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:31,309 INFO sqlalchemy.engine.Engine [cached since 10.86s ago] (40,)
INFO:sqlalchemy.engine.Engine:[cached since 10.86s ago] (40,)
2026-10-07 20:17:31,310 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:31,310 INFO sqlalchemy.engine.Engine [cached since 10.75s ago] (31,)
INFO:sqlalchemy.engine.Engine:[cached since 10.75s ago] (31,)
2026-10-07 20:17:31,310 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,311 INFO sqlalchemy.engine.Engine INSERT INTO subscriptions (event_id, user_id, is_auto_subscribed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:31,311 INFO sqlalchemy.engine.Engine [cached since 11.39s ago] (9, 33, 0, '2026-10-08 01:17:31.311831', '2026-10-08 01:17:31.311833')
2026-10-07 20:17:31,315 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:31,318 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,318 INFO sqlalchemy.engine.Engine INSERT INTO unsubscribe_tokens (token, subscription_id, created_at, used_at, expires_at) VALUES (?, ?, ?, ?, ?)
2026-10-07 20:17:31,318 INFO sqlalchemy.engine.Engine [cached since 5.96s ago] ('Umujodar4mDM2BOx-zKIspmpeMkbtX_D58VBdpQzItUaZC4fTwn791Xi77-SUDZb', 14, '2026-10-08 01:17:31.318139', None, '2026-12-07 01:17:31.318139')
INFO:apprise:Sent Email to test_20261007201730028121@test.example.com
2026-10-07 20:17:31,321 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,321 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,321 INFO sqlalchemy.engine.Engine [cached since 5.404s ago] (31,)
INFO:sqlalchemy.engine.Engine:[cached since 5.404s ago] (31,)
2026-10-07 20:17:31,322 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:31,322 INFO sqlalchemy.engine.Engine [cached since 5.403s ago] (1, '2026-10-08 01:17:31.322101', 31)
INFO:sqlalchemy.engine.Engine:[cached since 5.403s ago] (1, '2026-10-08 01:17:31.322101', 31)
2026-10-07 20:17:31,322 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,324 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,324 INFO sqlalchemy.engine.Engine INSERT INTO scheduled_jobs (kind, dedupe_key, event_id, subscription_id, payload, due_at, status, attempts, max_attempts, last_error, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,324 INFO sqlalchemy.engine.Engine [cached since 11.38s ago] ('notify_user', None, None, None, '{"user_id": 33, "title": "Event Subscription Confirmation", "body": "You have successfully subscribed to Test Event.", "level": "info"}', '2026-10-08 01:17:31.324185', 'pending', 0, 3, None, '2026-10-08 01:17:31.324504', '2026-10-08 01:17:31.324507')
2026-10-07 20:17:31,328 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,341 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,343 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,343 INFO sqlalchemy.engine.Engine [cached since 10.73s ago] ('done', '2026-10-08 01:17:31.343678', 20)
INFO:sqlalchemy.engine.Engine:[cached since 10.73s ago] ('done', '2026-10-08 01:17:31.343678', 20)
2026-10-07 20:17:31,344 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,346 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,346 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,346 INFO sqlalchemy.engine.Engine [cached since 11.09s ago] (22,)
INFO:sqlalchemy.engine.Engine:[cached since 11.09s ago] (22,)
2026-10-07 20:17:31,347 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,347 INFO sqlalchemy.engine.Engine SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
INFO:sqlalchemy.engine.Engine:SELECT events.id AS events_id, events.name AS events_name, events.description AS events_description, events.start_date AS events_start_date, events.end_date AS events_end_date, events.timezone AS events_timezone, events.content AS events_content, events.is_public AS events_is_public, events.notify_on_completion AS events_notify_on_completion, events.source AS events_source, events.temporal_workflow_id AS events_temporal_workflow_id, events.organizer_user_id AS events_organizer_user_id, events.organization_id AS events_organization_id, events.tags AS events_tags, events.last_notified_at AS events_last_notified_at, events.series_id AS events_series_id, events.series_position AS events_series_position, events.recurrence_rule AS events_recurrence_rule, events.created_at AS events_created_at, events.updated_at AS events_updated_at 
FROM events 
WHERE events.id = ?
2026-10-07 20:17:31,347 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (9,)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (9,)
2026-10-07 20:17:31,347 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,348 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,348 INFO sqlalchemy.engine.Engine SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
INFO:sqlalchemy.engine.Engine:SELECT subscriptions.id, subscriptions.event_id, subscriptions.user_id, subscriptions.is_auto_subscribed, subscriptions.created_at, subscriptions.updated_at 
FROM subscriptions 
WHERE subscriptions.event_id = ?
2026-10-07 20:17:31,349 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (9,)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (9,)
2026-10-07 20:17:31,349 INFO sqlalchemy.engine.Engine SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_reminders.subscription_id AS subscription_reminders_subscription_id, subscription_reminders.id AS subscription_reminders_id, subscription_reminders.offset_seconds AS subscription_reminders_offset_seconds, subscription_reminders.created_at AS subscription_reminders_created_at 
FROM subscription_reminders 
WHERE subscription_reminders.subscription_id IN (?, ?)
2026-10-07 20:17:31,349 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (13, 14)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (13, 14)
2026-10-07 20:17:31,350 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.id AS subscription_selectors_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE subscription_selectors.subscription_id IN (?, ?)
2026-10-07 20:17:31,350 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (13, 14)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (13, 14)
2026-10-07 20:17:31,351 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id IN (?, ?)
2026-10-07 20:17:31,351 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (32, 33)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (32, 33)
2026-10-07 20:17:31,352 INFO sqlalchemy.engine.Engine SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
INFO:sqlalchemy.engine.Engine:SELECT channels.user_id AS channels_user_id, channels.id AS channels_id, channels.organization_id AS channels_organization_id, channels.name AS channels_name, channels.apprise_url_encrypted AS channels_apprise_url_encrypted, channels.tag AS channels_tag, channels.is_active AS channels_is_active, channels.channel_type AS channels_channel_type, channels.config_json_encrypted AS channels_config_json_encrypted, channels.created_at AS channels_created_at, channels.updated_at AS channels_updated_at 
FROM channels 
WHERE channels.user_id IN (?, ?)
2026-10-07 20:17:31,352 INFO sqlalchemy.engine.Engine [cached since 10.91s ago] (32, 33)
INFO:sqlalchemy.engine.Engine:[cached since 10.91s ago] (32, 33)
2026-10-07 20:17:31,353 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:31,353 INFO sqlalchemy.engine.Engine [cached since 10.9s ago] (41,)
INFO:sqlalchemy.engine.Engine:[cached since 10.9s ago] (41,)
2026-10-07 20:17:31,354 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:31,354 INFO sqlalchemy.engine.Engine [cached since 10.8s ago] (32,)
INFO:sqlalchemy.engine.Engine:[cached since 10.8s ago] (32,)
2026-10-07 20:17:31,354 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to test_20261007201730542447@test.example.com
2026-10-07 20:17:31,365 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,366 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,366 INFO sqlalchemy.engine.Engine [cached since 5.449s ago] (32,)
INFO:sqlalchemy.engine.Engine:[cached since 5.449s ago] (32,)
2026-10-07 20:17:31,367 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:31,367 INFO sqlalchemy.engine.Engine [cached since 5.448s ago] (1, '2026-10-08 01:17:31.367005', 32)
INFO:sqlalchemy.engine.Engine:[cached since 5.448s ago] (1, '2026-10-08 01:17:31.367005', 32)
2026-10-07 20:17:31,367 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
INFO:     127.0.0.1:35344 - "POST /api/v1/subscriptions HTTP/1.1" 201 Created
2026-10-07 20:17:31,400 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
PASSED [ 91%]2026-10-07 20:17:31,400 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,400 INFO sqlalchemy.engine.Engine [cached since 5.497s ago] (33,)
INFO:sqlalchemy.engine.Engine:[cached since 5.497s ago] (33,)

tests/test_subscription_workflows.py::TestChannelManagement::test_create_gotify_channel Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:31,408 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,409 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:31,409 INFO sqlalchemy.engine.Engine [cached since 20.26s ago] ('test_20261007201731403730@test.example.com',)
INFO:apprise:Sent Email to subscriber_20261007201731006575@test.example.com
2026-10-07 20:17:31,413 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,413 INFO sqlalchemy.engine.Engine [cached since 5.496s ago] (32,)
INFO:sqlalchemy.engine.Engine:[cached since 5.496s ago] (32,)
2026-10-07 20:17:31,414 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:31,414 INFO sqlalchemy.engine.Engine [cached since 5.495s ago] (2, '2026-10-08 01:17:31.414034', 32)
INFO:sqlalchemy.engine.Engine:[cached since 5.495s ago] (2, '2026-10-08 01:17:31.414034', 32)
2026-10-07 20:17:31,414 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,418 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,418 INFO sqlalchemy.engine.Engine [cached since 10.8s ago] ('done', '2026-10-08 01:17:31.418507', 22)
INFO:sqlalchemy.engine.Engine:[cached since 10.8s ago] ('done', '2026-10-08 01:17:31.418507', 22)
2026-10-07 20:17:31,419 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,422 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,422 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:31,422 INFO sqlalchemy.engine.Engine [cached since 24.26s ago] ('pending', '2026-10-08 01:17:31.422537', 'running', '2026-10-08 01:07:31.421920')
INFO:sqlalchemy.engine.Engine:[cached since 24.26s ago] ('pending', '2026-10-08 01:17:31.422537', 'running', '2026-10-08 01:07:31.421920')
2026-10-07 20:17:31,423 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:31,423 INFO sqlalchemy.engine.Engine [cached since 24.25s ago] ('pending', '2026-10-08 01:17:31.423000', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 24.25s ago] ('pending', '2026-10-08 01:17:31.423000', 20, 0)
2026-10-07 20:17:31,424 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ? AND scheduled_jobs.status = ?
2026-10-07 20:17:31,424 INFO sqlalchemy.engine.Engine [cached since 11.18s ago] ('running', '2026-10-08 01:17:31.424050', 23, 'pending')
INFO:sqlalchemy.engine.Engine:[cached since 11.18s ago] ('running', '2026-10-08 01:17:31.424050', 23, 'pending')
2026-10-07 20:17:31,424 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,426 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,427 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id AS scheduled_jobs_id, scheduled_jobs.kind AS scheduled_jobs_kind, scheduled_jobs.dedupe_key AS scheduled_jobs_dedupe_key, scheduled_jobs.event_id AS scheduled_jobs_event_id, scheduled_jobs.subscription_id AS scheduled_jobs_subscription_id, scheduled_jobs.payload AS scheduled_jobs_payload, scheduled_jobs.due_at AS scheduled_jobs_due_at, scheduled_jobs.status AS scheduled_jobs_status, scheduled_jobs.attempts AS scheduled_jobs_attempts, scheduled_jobs.max_attempts AS scheduled_jobs_max_attempts, scheduled_jobs.last_error AS scheduled_jobs_last_error, scheduled_jobs.created_at AS scheduled_jobs_created_at, scheduled_jobs.updated_at AS scheduled_jobs_updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,427 INFO sqlalchemy.engine.Engine [cached since 11.17s ago] (23,)
INFO:sqlalchemy.engine.Engine:[cached since 11.17s ago] (23,)
2026-10-07 20:17:31,427 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,427 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
INFO:sqlalchemy.engine.Engine:SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.is_active = 1
2026-10-07 20:17:31,427 INFO sqlalchemy.engine.Engine [cached since 10.87s ago] (33,)
INFO:sqlalchemy.engine.Engine:[cached since 10.87s ago] (33,)
2026-10-07 20:17:31,429 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:apprise:Sent Email to subscriber_20261007201731006575@test.example.com
2026-10-07 20:17:31,439 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,439 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,439 INFO sqlalchemy.engine.Engine [cached since 5.523s ago] (33,)
INFO:sqlalchemy.engine.Engine:[cached since 5.523s ago] (33,)
2026-10-07 20:17:31,440 INFO sqlalchemy.engine.Engine UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE users SET total_notifications_this_month=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:31,440 INFO sqlalchemy.engine.Engine [cached since 5.522s ago] (1, '2026-10-08 01:17:31.440748', 33)
INFO:sqlalchemy.engine.Engine:[cached since 5.522s ago] (1, '2026-10-08 01:17:31.440748', 33)
2026-10-07 20:17:31,441 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,443 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.id = ?
2026-10-07 20:17:31,443 INFO sqlalchemy.engine.Engine [cached since 10.83s ago] ('done', '2026-10-08 01:17:31.443736', 23)
INFO:sqlalchemy.engine.Engine:[cached since 10.83s ago] ('done', '2026-10-08 01:17:31.443736', 23)
2026-10-07 20:17:31,444 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,447 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:31,447 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:31,447 INFO sqlalchemy.engine.Engine [cached since 24.28s ago] ('pending', '2026-10-08 01:17:31.447354', 'running', '2026-10-08 01:07:31.446796')
INFO:sqlalchemy.engine.Engine:[cached since 24.28s ago] ('pending', '2026-10-08 01:17:31.447354', 'running', '2026-10-08 01:07:31.446796')
2026-10-07 20:17:31,448 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:31,448 INFO sqlalchemy.engine.Engine [cached since 24.28s ago] ('pending', '2026-10-08 01:17:31.447767', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 24.28s ago] ('pending', '2026-10-08 01:17:31.447767', 20, 0)
2026-10-07 20:17:31,448 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:31,608 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,608 INFO sqlalchemy.engine.Engine [cached since 20.25s ago] ('test_20261007201731403730@test.example.com', 'Test User', '$2b$12$iHcsF7Bp8FMvJQS9q12Sa.Qoc1FpcIjYS/fIVXgEa8.KNZ.J6Z1XC', 0, 'free', 0, 0, '2026-10-08 01:17:31.608324', None, None, None, None, '2026-10-08 01:17:31.608329', '2026-10-08 01:17:31.608329')
2026-10-07 20:17:31,614 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,617 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,617 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,617 INFO sqlalchemy.engine.Engine [cached since 20.24s ago] (34,)
2026-10-07 20:17:31,622 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:31,622 INFO sqlalchemy.engine.Engine [cached since 20.23s ago] (34, 'Email: test_20261007201731403730@test.example.com', 'autosub:default')
2026-10-07 20:17:31,626 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,626 INFO sqlalchemy.engine.Engine [cached since 20.19s ago] (34, None, 'Email: test_20261007201731403730@test.example.com', <memory at 0x7f5cbc1b1540>, 'autosub:default', 1, None, None, '2026-10-08 01:17:31.626502', '2026-10-08 01:17:31.626507')
2026-10-07 20:17:31,632 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:31,632 INFO sqlalchemy.engine.Engine [cached since 20.19s ago] ('email', <memory at 0x7f5cbc1b1a80>, '2026-10-08 01:17:31.632379', 43)
2026-10-07 20:17:31,636 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:31,652 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,652 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:31,652 INFO sqlalchemy.engine.Engine [cached since 19.78s ago] ('68ce37c1740adcf5a8de640bd72590efd0e0c89789c947ce6485f1b2d2ca264f', 34, '2026-10-08 01:17:31.652272', '2026-10-15 01:17:31.651783')
INFO:     127.0.0.1:35360 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:31,688 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,694 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,694 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,694 INFO sqlalchemy.engine.Engine [cached since 19.33s ago] (34,)
2026-10-07 20:17:31,699 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:31,699 INFO sqlalchemy.engine.Engine [cached since 19.33s ago] (1, '2026-10-08 01:17:31.699326', 34)
2026-10-07 20:17:31,703 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:35360 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozNCwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMxNDAzNzMwQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MSwiaWF0IjoxNzkxNDIyMjUxfQ.JGfdS-EwGs1MC78WgKk-Ex8qSJHrJCxOIK35OV73o18 HTTP/1.1" 200 OK
2026-10-07 20:17:31,744 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,744 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:31,744 INFO sqlalchemy.engine.Engine [cached since 19.38s ago] (34,)
2026-10-07 20:17:31,749 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:31,749 INFO sqlalchemy.engine.Engine [cached since 12.55s ago] (34, 'admin')
2026-10-07 20:17:31,753 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:31,753 INFO sqlalchemy.engine.Engine [cached since 12.03s ago] (34,)
2026-10-07 20:17:31,757 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:31,757 INFO sqlalchemy.engine.Engine [cached since 20.36s ago] (34, 'My Gotify Channel', 'test')
2026-10-07 20:17:31,761 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:31,761 INFO sqlalchemy.engine.Engine [cached since 20.32s ago] (34, None, 'My Gotify Channel', <memory at 0x7f5cbc1b0dc0>, 'test', 1, None, None, '2026-10-08 01:17:31.761768', '2026-10-08 01:17:31.761770')
2026-10-07 20:17:31,766 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:31,766 INFO sqlalchemy.engine.Engine [cached since 20.32s ago] ('gotify', <memory at 0x7f5cbc1b1180>, '2026-10-08 01:17:31.766796', 44)
2026-10-07 20:17:31,770 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:31,773 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,773 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:31,773 INFO sqlalchemy.engine.Engine [cached since 11.98s ago] (44,)
INFO:     127.0.0.1:35360 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:31,812 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 92%]
tests/test_subscription_workflows.py::TestChannelManagement::test_create_channel_requires_valid_type 2026-10-07 20:17:31,823 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:31,823 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:31,823 INFO sqlalchemy.engine.Engine [cached since 20.67s ago] ('test_20261007201731819683@test.example.com',)
2026-10-07 20:17:32,033 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,033 INFO sqlalchemy.engine.Engine [cached since 20.67s ago] ('test_20261007201731819683@test.example.com', 'Test User', '$2b$12$blLHGLGRv0rRyRizZGkvruJMc4i4LatyWEnR.WtkxL66naYaOh9W6', 0, 'free', 0, 0, '2026-10-08 01:17:32.033449', None, None, None, None, '2026-10-08 01:17:32.033453', '2026-10-08 01:17:32.033454')
2026-10-07 20:17:32,039 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,042 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,042 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,042 INFO sqlalchemy.engine.Engine [cached since 20.66s ago] (35,)
2026-10-07 20:17:32,047 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:32,047 INFO sqlalchemy.engine.Engine [cached since 20.65s ago] (35, 'Email: test_20261007201731819683@test.example.com', 'autosub:default')
2026-10-07 20:17:32,052 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,052 INFO sqlalchemy.engine.Engine [cached since 20.61s ago] (35, None, 'Email: test_20261007201731819683@test.example.com', <memory at 0x7f5cbc1b1300>, 'autosub:default', 1, None, None, '2026-10-08 01:17:32.052191', '2026-10-08 01:17:32.052194')
2026-10-07 20:17:32,057 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:32,057 INFO sqlalchemy.engine.Engine [cached since 20.61s ago] ('email', <memory at 0x7f5cbc1b1540>, '2026-10-08 01:17:32.057755', 45)
2026-10-07 20:17:32,061 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:32,076 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,077 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:32,077 INFO sqlalchemy.engine.Engine [cached since 20.2s ago] ('8359b4c0fafd8bf4b01c9a4f4b1084aa0329a398eb4373b92aa25da8bf604619', 35, '2026-10-08 01:17:32.077118', '2026-10-15 01:17:32.076643')
INFO:     127.0.0.1:47554 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:32,112 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,120 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,120 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,120 INFO sqlalchemy.engine.Engine [cached since 19.75s ago] (35,)
2026-10-07 20:17:32,126 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:32,126 INFO sqlalchemy.engine.Engine [cached since 19.76s ago] (1, '2026-10-08 01:17:32.126356', 35)
2026-10-07 20:17:32,130 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:47554 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozNSwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMxODE5NjgzQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MiwiaWF0IjoxNzkxNDIyMjUyfQ.s2D7x92NMDKS0CY-_mS_xRpHnG9INsEPQLM6O4dGjSc HTTP/1.1" 200 OK
2026-10-07 20:17:32,173 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,173 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,173 INFO sqlalchemy.engine.Engine [cached since 19.81s ago] (35,)
2026-10-07 20:17:32,179 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:32,179 INFO sqlalchemy.engine.Engine [cached since 12.98s ago] (35, 'admin')
2026-10-07 20:17:32,183 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:32,183 INFO sqlalchemy.engine.Engine [cached since 12.46s ago] (35,)
2026-10-07 20:17:32,207 INFO sqlalchemy.engine.Engine ROLLBACK
INFO:     127.0.0.1:47554 - "POST /api/v1/channels HTTP/1.1" 400 Bad Request
PASSED [ 94%]
tests/test_subscription_workflows.py::TestChannelManagement::test_list_user_channels 2026-10-07 20:17:32,218 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,219 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:32,219 INFO sqlalchemy.engine.Engine [cached since 21.07s ago] ('test_20261007201732214683@test.example.com',)
2026-10-07 20:17:32,440 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,440 INFO sqlalchemy.engine.Engine [cached since 21.08s ago] ('test_20261007201732214683@test.example.com', 'Test User', '$2b$12$SfFNQ3WgY01Be8wmnSgc6uG8vjKRA6SNQKSNlCpWqHQAsAhq9f0j.', 0, 'free', 0, 0, '2026-10-08 01:17:32.440448', None, None, None, None, '2026-10-08 01:17:32.440452', '2026-10-08 01:17:32.440453')
2026-10-07 20:17:32,445 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,447 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,447 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,448 INFO sqlalchemy.engine.Engine [cached since 21.07s ago] (36,)
2026-10-07 20:17:32,450 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:32,450 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:32,450 INFO sqlalchemy.engine.Engine [cached since 25.29s ago] ('pending', '2026-10-08 01:17:32.450613', 'running', '2026-10-08 01:07:32.449932')
INFO:sqlalchemy.engine.Engine:[cached since 25.29s ago] ('pending', '2026-10-08 01:17:32.450613', 'running', '2026-10-08 01:07:32.449932')
2026-10-07 20:17:32,451 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:32,451 INFO sqlalchemy.engine.Engine [cached since 25.28s ago] ('pending', '2026-10-08 01:17:32.451094', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 25.28s ago] ('pending', '2026-10-08 01:17:32.451094', 20, 0)
2026-10-07 20:17:32,451 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:32,452 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:32,452 INFO sqlalchemy.engine.Engine [cached since 21.06s ago] (36, 'Email: test_20261007201732214683@test.example.com', 'autosub:default')
2026-10-07 20:17:32,457 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,457 INFO sqlalchemy.engine.Engine [cached since 21.02s ago] (36, None, 'Email: test_20261007201732214683@test.example.com', <memory at 0x7f5cbc1b2140>, 'autosub:default', 1, None, None, '2026-10-08 01:17:32.457373', '2026-10-08 01:17:32.457375')
2026-10-07 20:17:32,461 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:32,462 INFO sqlalchemy.engine.Engine [cached since 21.02s ago] ('email', <memory at 0x7f5cbc1b13c0>, '2026-10-08 01:17:32.461907', 46)
2026-10-07 20:17:32,465 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:32,479 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,479 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:32,479 INFO sqlalchemy.engine.Engine [cached since 20.6s ago] ('430cec1ed047ce41552a22c866324143555c2943de4b317c9fc2ef0b2d3915f5', 36, '2026-10-08 01:17:32.479172', '2026-10-15 01:17:32.478829')
INFO:     127.0.0.1:47562 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:32,510 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,515 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,515 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,515 INFO sqlalchemy.engine.Engine [cached since 20.15s ago] (36,)
2026-10-07 20:17:32,519 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:32,519 INFO sqlalchemy.engine.Engine [cached since 20.15s ago] (1, '2026-10-08 01:17:32.519897', 36)
2026-10-07 20:17:32,523 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:47562 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozNiwiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMyMjE0NjgzQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MiwiaWF0IjoxNzkxNDIyMjUyfQ.YxYPBQjhROxauSghIBtWqW7FjoEt2YadHKif8hcEIdU HTTP/1.1" 200 OK
2026-10-07 20:17:32,591 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,591 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,591 INFO sqlalchemy.engine.Engine [cached since 20.23s ago] (36,)
2026-10-07 20:17:32,596 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:32,596 INFO sqlalchemy.engine.Engine [cached since 13.4s ago] (36, 'admin')
2026-10-07 20:17:32,599 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:32,599 INFO sqlalchemy.engine.Engine [cached since 12.87s ago] (36,)
2026-10-07 20:17:32,603 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:32,603 INFO sqlalchemy.engine.Engine [cached since 21.21s ago] (36, 'List Test Channel', 'list-test')
2026-10-07 20:17:32,606 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,606 INFO sqlalchemy.engine.Engine [cached since 21.17s ago] (36, None, 'List Test Channel', <memory at 0x7f5cbc1b1480>, 'list-test', 1, None, None, '2026-10-08 01:17:32.606835', '2026-10-08 01:17:32.606837')
2026-10-07 20:17:32,610 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:32,610 INFO sqlalchemy.engine.Engine [cached since 21.17s ago] ('gotify', <memory at 0x7f5cbc1b0280>, '2026-10-08 01:17:32.610823', 47)
2026-10-07 20:17:32,614 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,616 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,616 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:32,616 INFO sqlalchemy.engine.Engine [cached since 12.82s ago] (47,)
INFO:     127.0.0.1:47562 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:32,647 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,652 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,652 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,652 INFO sqlalchemy.engine.Engine [cached since 20.29s ago] (36,)
2026-10-07 20:17:32,657 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:32,657 INFO sqlalchemy.engine.Engine [generated in 0.00011s] (36,)
INFO:     127.0.0.1:47562 - "GET /api/v1/channels HTTP/1.1" 200 OK
2026-10-07 20:17:32,677 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 95%]
tests/test_subscription_workflows.py::TestChannelManagement::test_delete_channel 2026-10-07 20:17:32,687 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,687 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.email = ?
2026-10-07 20:17:32,687 INFO sqlalchemy.engine.Engine [cached since 21.54s ago] ('test_20261007201732683321@test.example.com',)
2026-10-07 20:17:32,879 INFO sqlalchemy.engine.Engine INSERT INTO users (email, name, password_hash, is_verified, tier, billable_credits_used_this_month, total_notifications_this_month, usage_period_start, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,879 INFO sqlalchemy.engine.Engine [cached since 21.52s ago] ('test_20261007201732683321@test.example.com', 'Test User', '$2b$12$BKO9CUsnDqINljDeHY9l0OwBAaSB5GAfFVLrpuViU105YJc7T28a.', 0, 'free', 0, 0, '2026-10-08 01:17:32.879065', None, None, None, None, '2026-10-08 01:17:32.879069', '2026-10-08 01:17:32.879070')
2026-10-07 20:17:32,884 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,886 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,886 INFO sqlalchemy.engine.Engine SELECT users.id, users.email, users.name, users.password_hash, users.is_verified, users.tier, users.billable_credits_used_this_month, users.total_notifications_this_month, users.usage_period_start, users.stripe_customer_id, users.stripe_subscription_id, users.subscription_status, users.subscription_current_period_end, users.created_at, users.updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,886 INFO sqlalchemy.engine.Engine [cached since 21.51s ago] (37,)
2026-10-07 20:17:32,891 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:32,891 INFO sqlalchemy.engine.Engine [cached since 21.5s ago] (37, 'Email: test_20261007201732683321@test.example.com', 'autosub:default')
2026-10-07 20:17:32,894 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:32,894 INFO sqlalchemy.engine.Engine [cached since 21.46s ago] (37, None, 'Email: test_20261007201732683321@test.example.com', <memory at 0x7f5cbc1b0880>, 'autosub:default', 1, None, None, '2026-10-08 01:17:32.894516', '2026-10-08 01:17:32.894518')
2026-10-07 20:17:32,899 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:32,899 INFO sqlalchemy.engine.Engine [cached since 21.45s ago] ('email', <memory at 0x7f5cbc1b13c0>, '2026-10-08 01:17:32.899055', 48)
2026-10-07 20:17:32,903 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
2026-10-07 20:17:32,916 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,916 INFO sqlalchemy.engine.Engine INSERT INTO user_sessions (session_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)
2026-10-07 20:17:32,916 INFO sqlalchemy.engine.Engine [cached since 21.04s ago] ('5ac1f3f9e48ede84329fd1a8defc95fb5fe8947f1964687a7ef6ee2f43478083', 37, '2026-10-08 01:17:32.916707', '2026-10-15 01:17:32.916342')
INFO:     127.0.0.1:47578 - "POST /api/v1/auth/register HTTP/1.1" 201 Created
2026-10-07 20:17:32,948 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:32,953 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,953 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,953 INFO sqlalchemy.engine.Engine [cached since 20.59s ago] (37,)
2026-10-07 20:17:32,957 INFO sqlalchemy.engine.Engine UPDATE users SET is_verified=?, updated_at=? WHERE users.id = ?
2026-10-07 20:17:32,957 INFO sqlalchemy.engine.Engine [cached since 20.59s ago] (1, '2026-10-08 01:17:32.957281', 37)
2026-10-07 20:17:32,960 INFO sqlalchemy.engine.Engine COMMIT
Session.login_data is deprecated and will be removed in version 2.0
INFO:     127.0.0.1:47578 - "GET /api/v1/auth/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlbWFpbF92ZXJpZmljYXRpb24iLCJ1c2VyX2lkIjozNywiZW1haWwiOiJ0ZXN0XzIwMjYxMDA3MjAxNzMyNjgzMzIxQHRlc3QuZXhhbXBsZS5jb20iLCJzb3VyY2UiOm51bGwsInJlZGlyZWN0X3VybCI6Imh0dHA6Ly9sb2NhbGhvc3Q6NTE3NCIsImV4cCI6MTc5MTUwODY1MiwiaWF0IjoxNzkxNDIyMjUyfQ.MMVoO8IZj6G68n2Yj5_BqGlLFhS8_o_Susf8AGlB6bk HTTP/1.1" 200 OK
2026-10-07 20:17:32,995 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:32,995 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:32,995 INFO sqlalchemy.engine.Engine [cached since 20.63s ago] (37,)
2026-10-07 20:17:32,999 INFO sqlalchemy.engine.Engine SELECT count(distinct(organization_memberships.organization_id)) AS count_1 
FROM organization_memberships 
WHERE organization_memberships.user_id = ? AND organization_memberships.role = ?
2026-10-07 20:17:32,999 INFO sqlalchemy.engine.Engine [cached since 13.8s ago] (37, 'admin')
2026-10-07 20:17:33,003 INFO sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:33,003 INFO sqlalchemy.engine.Engine [cached since 13.28s ago] (37,)
2026-10-07 20:17:33,007 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ? AND channels.name = ? AND channels.tag = ?
2026-10-07 20:17:33,007 INFO sqlalchemy.engine.Engine [cached since 21.61s ago] (37, 'Delete Test Channel', 'delete-test')
2026-10-07 20:17:33,010 INFO sqlalchemy.engine.Engine INSERT INTO channels (user_id, organization_id, name, apprise_url_encrypted, tag, is_active, channel_type, config_json_encrypted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
2026-10-07 20:17:33,011 INFO sqlalchemy.engine.Engine [cached since 21.57s ago] (37, None, 'Delete Test Channel', <memory at 0x7f5cbc1b1cc0>, 'delete-test', 1, None, None, '2026-10-08 01:17:33.010921', '2026-10-08 01:17:33.010923')
2026-10-07 20:17:33,014 INFO sqlalchemy.engine.Engine UPDATE channels SET channel_type=?, config_json_encrypted=?, updated_at=? WHERE channels.id = ?
2026-10-07 20:17:33,014 INFO sqlalchemy.engine.Engine [cached since 21.57s ago] ('gotify', <memory at 0x7f5cbc1b13c0>, '2026-10-08 01:17:33.014750', 49)
2026-10-07 20:17:33,017 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:33,020 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:33,020 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:33,020 INFO sqlalchemy.engine.Engine [cached since 13.23s ago] (49,)
INFO:     127.0.0.1:47578 - "POST /api/v1/channels HTTP/1.1" 201 Created
2026-10-07 20:17:33,050 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:33,054 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:33,055 INFO sqlalchemy.engine.Engine SELECT users.id AS users_id, users.email AS users_email, users.name AS users_name, users.password_hash AS users_password_hash, users.is_verified AS users_is_verified, users.tier AS users_tier, users.billable_credits_used_this_month AS users_billable_credits_used_this_month, users.total_notifications_this_month AS users_total_notifications_this_month, users.usage_period_start AS users_usage_period_start, users.stripe_customer_id AS users_stripe_customer_id, users.stripe_subscription_id AS users_stripe_subscription_id, users.subscription_status AS users_subscription_status, users.subscription_current_period_end AS users_subscription_current_period_end, users.created_at AS users_created_at, users.updated_at AS users_updated_at 
FROM users 
WHERE users.id = ?
2026-10-07 20:17:33,055 INFO sqlalchemy.engine.Engine [cached since 20.69s ago] (37,)
2026-10-07 20:17:33,058 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.id = ?
2026-10-07 20:17:33,058 INFO sqlalchemy.engine.Engine [cached since 4.192s ago] (49,)
2026-10-07 20:17:33,062 INFO sqlalchemy.engine.Engine SELECT subscription_selectors.id AS subscription_selectors_id, subscription_selectors.subscription_id AS subscription_selectors_subscription_id, subscription_selectors.channel_id AS subscription_selectors_channel_id, subscription_selectors.tag AS subscription_selectors_tag, subscription_selectors.created_at AS subscription_selectors_created_at 
FROM subscription_selectors 
WHERE ? = subscription_selectors.channel_id
2026-10-07 20:17:33,062 INFO sqlalchemy.engine.Engine [generated in 0.00010s] (49,)
2026-10-07 20:17:33,067 INFO sqlalchemy.engine.Engine DELETE FROM channels WHERE channels.id = ?
2026-10-07 20:17:33,067 INFO sqlalchemy.engine.Engine [generated in 0.00009s] (49,)
2026-10-07 20:17:33,070 INFO sqlalchemy.engine.Engine COMMIT
2026-10-07 20:17:33,073 INFO sqlalchemy.engine.Engine BEGIN (implicit)
2026-10-07 20:17:33,073 INFO sqlalchemy.engine.Engine SELECT channels.id, channels.user_id, channels.organization_id, channels.name, channels.apprise_url_encrypted, channels.tag, channels.is_active, channels.channel_type, channels.config_json_encrypted, channels.created_at, channels.updated_at 
FROM channels 
WHERE channels.user_id = ?
2026-10-07 20:17:33,073 INFO sqlalchemy.engine.Engine [cached since 0.4165s ago] (37,)
INFO:     127.0.0.1:47578 - "DELETE /api/v1/channels/49 HTTP/1.1" 200 OK
2026-10-07 20:17:33,106 INFO sqlalchemy.engine.Engine COMMIT
PASSED [ 96%]
tests/test_token_hashing.py::test_hash_token_is_deterministic_and_prefixed PASSED [ 97%]
tests/test_token_hashing.py::test_verify_token_with_sha256_hash PASSED   [ 98%]
tests/test_token_hashing.py::test_verify_token_with_legacy_bcrypt_hash 2026-10-07 20:17:33,454 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:33,454 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:33,454 INFO sqlalchemy.engine.Engine [cached since 26.29s ago] ('pending', '2026-10-08 01:17:33.454441', 'running', '2026-10-08 01:07:33.453494')
INFO:sqlalchemy.engine.Engine:[cached since 26.29s ago] ('pending', '2026-10-08 01:17:33.454441', 'running', '2026-10-08 01:07:33.453494')
2026-10-07 20:17:33,455 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:33,455 INFO sqlalchemy.engine.Engine [cached since 26.29s ago] ('pending', '2026-10-08 01:17:33.455079', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 26.29s ago] ('pending', '2026-10-08 01:17:33.455079', 20, 0)
2026-10-07 20:17:33,455 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
PASSED [100%]2026-10-07 20:17:34,457 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:34,458 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:34,458 INFO sqlalchemy.engine.Engine [cached since 27.29s ago] ('pending', '2026-10-08 01:17:34.458293', 'running', '2026-10-08 01:07:34.457075')
INFO:sqlalchemy.engine.Engine:[cached since 27.29s ago] ('pending', '2026-10-08 01:17:34.458293', 'running', '2026-10-08 01:07:34.457075')
2026-10-07 20:17:34,459 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:34,459 INFO sqlalchemy.engine.Engine [cached since 27.29s ago] ('pending', '2026-10-08 01:17:34.459059', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 27.29s ago] ('pending', '2026-10-08 01:17:34.459059', 20, 0)
2026-10-07 20:17:34,460 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT
2026-10-07 20:17:35,461 INFO sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine:BEGIN (implicit)
2026-10-07 20:17:35,461 INFO sqlalchemy.engine.Engine UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
INFO:sqlalchemy.engine.Engine:UPDATE scheduled_jobs SET status=?, updated_at=? WHERE scheduled_jobs.status = ? AND scheduled_jobs.updated_at < ?
2026-10-07 20:17:35,461 INFO sqlalchemy.engine.Engine [cached since 28.3s ago] ('pending', '2026-10-08 01:17:35.461727', 'running', '2026-10-08 01:07:35.460986')
INFO:sqlalchemy.engine.Engine:[cached since 28.3s ago] ('pending', '2026-10-08 01:17:35.461727', 'running', '2026-10-08 01:07:35.460986')
2026-10-07 20:17:35,462 INFO sqlalchemy.engine.Engine SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
INFO:sqlalchemy.engine.Engine:SELECT scheduled_jobs.id, scheduled_jobs.kind, scheduled_jobs.dedupe_key, scheduled_jobs.event_id, scheduled_jobs.subscription_id, scheduled_jobs.payload, scheduled_jobs.due_at, scheduled_jobs.status, scheduled_jobs.attempts, scheduled_jobs.max_attempts, scheduled_jobs.last_error, scheduled_jobs.created_at, scheduled_jobs.updated_at 
FROM scheduled_jobs 
WHERE scheduled_jobs.status = ? AND scheduled_jobs.due_at <= ? ORDER BY scheduled_jobs.due_at
 LIMIT ? OFFSET ?
2026-10-07 20:17:35,462 INFO sqlalchemy.engine.Engine [cached since 28.29s ago] ('pending', '2026-10-08 01:17:35.462277', 20, 0)
INFO:sqlalchemy.engine.Engine:[cached since 28.29s ago] ('pending', '2026-10-08 01:17:35.462277', 20, 0)
2026-10-07 20:17:35,463 INFO sqlalchemy.engine.Engine COMMIT
INFO:sqlalchemy.engine.Engine:COMMIT


================================ tests coverage ================================
_______________ coverage: platform linux, python 3.12.0-final-0 ________________

Name                                                 Stmts   Miss  Cover   Missing
----------------------------------------------------------------------------------
src/activities/__init__.py                               0      0   100%
src/activities/events.py                               103     50    51%   20-23, 32, 54-95, 112, 116, 125, 128-132, 139-141, 150-171, 204-207
src/activities/notification_builder.py                  78     66    15%   11-26, 39-75, 86-138, 146-160
src/activities/notifications.py                        107     99     7%   27-62, 88-140, 160-259
src/api/__init__.py                                      0      0   100%
src/api/auth/__init__.py                                 0      0   100%
src/api/auth/jwt.py                                     19     10    47%   13-25, 30-40
src/api/auth/password.py                                 6      6     0%   1-13
src/api/auth/session.py                                 31     21    32%   12, 17-25, 30-48, 53-57
src/api/auth/tokens.py                                  21      4    81%   12-13, 18, 39
src/api/auth/verification.py                            36     36     0%   3-90
src/api/dependencies.py                                 85     49    42%   23, 33-36, 53, 59-60, 74-139, 152-155
src/api/integration_schemas/__init__.py                  2      0   100%
src/api/integration_schemas/dummy_config.py             13     13     0%   7-32
src/api/integration_schemas/integration_configs.py     231     32    86%   35, 88, 90, 121, 131, 138, 145, 177, 183-193, 215, 223, 243, 263, 284, 291, 315, 325, 332, 352, 355, 384, 410
src/api/main.py                                         51     51     0%   1-118
src/api/middleware/__init__.py                           0      0   100%
src/api/middleware/rate_limit.py                        77     77     0%   1-152
src/api/routes/__init__.py                               0      0   100%
src/api/routes/admin.py                                214    214     0%   2-548
src/api/routes/app.py                                   60     60     0%   2-160
src/api/routes/auth.py                                 300    300     0%   1-609
src/api/routes/billing.py                              161    118    27%   20-21, 48, 53-55, 73-157, 166, 176-198, 210-250, 259-302
src/api/routes/channels.py                             245    245     0%   1-573
src/api/routes/events.py                               259    259     0%   1-587
src/api/routes/health.py                                26      0   100%
src/api/routes/invites.py                               69     69     0%   1-177
src/api/routes/organizations.py                        187    187     0%   4-518
src/api/routes/otel.py                                  14     14     0%   6-29
src/api/routes/roles.py                                364    364     0%   1-880
src/api/routes/subscriptions_v1.py                     200    200     0%   2-484
src/api/routes/tokens.py                                34     34     0%   1-79
src/api/routes/usage.py                                 95     95     0%   2-367
src/api/routes/users.py                                 66     66     0%   3-211
src/api/schemas.py                                     398     27    93%   78-82, 110-114, 119-121, 125-132, 150-152, 255-260
src/api/services/billing_urls.py                        24      1    96%   19
src/api/services/integration_converters.py             121     22    82%   38, 41, 56, 66-67, 92, 97-98, 104-105, 127, 146, 159, 169, 199, 212, 229, 232, 250, 254, 275, 279
src/api/startup.py                                      24     24     0%   2-44
src/api/templates/__init__.py                            7      7     0%   1-19
src/api/utils/__init__.py                                2      2     0%   2-4
src/api/utils/spa.py                                    26     26     0%   2-47
src/cli/__init__.py                                      4      4     0%   10-14
src/cli/client.py                                      137    137     0%   3-379
src/cli/main.py                                        189    189     0%   3-444
src/cli/models.py                                       24     24     0%   3-56
src/config/__init__.py                                  76      9    88%   113-119, 121-125, 128
src/config/pricing.py                                    7      7     0%   7-18
src/db/__init__.py                                       0      0   100%
src/db/base.py                                           9      0   100%
src/db/encryption.py                                    15     15     0%   1-26
src/db/models.py                                       385     78    80%   79, 140, 171, 203, 207-214, 218, 284, 289-290, 295-298, 341-343, 348-350, 355-359, 364-369, 372, 379-380, 411, 436-439, 446-447, 467-468, 477-478, 482, 501, 523, 526, 553-566, 569, 595-606, 610, 613, 639-647, 650, 672-678, 681, 708, 746-747, 778, 814
src/db/repositories.py                                 468    327    30%   31, 34, 37-38, 42-43, 46-48, 55-63, 74-77, 85-86, 89-90, 99-105, 115-126, 131-145, 151-159, 165-180, 186-222, 228-239, 243-248, 253, 258-261, 264-267, 272-276, 282-288, 291-293, 299-303, 309-315, 328-349, 358-368, 385-394, 399-404, 410-422, 425-427, 430-431, 435, 438-440, 443-444, 447-451, 455, 461-474, 477, 481-484, 488-492, 496-501, 506, 510-521, 525-528, 532-535, 539-544, 548-550, 556-561, 565-578, 584-592, 596-597, 601-602, 606-611, 615-620, 634-650, 656-664, 670-679, 685-696, 702-716, 720-730, 735, 738-740, 743, 746-749, 752-758, 761-770, 775, 778-780, 783-786, 789-796, 799-807, 811-823, 828, 831-833, 836, 841-849, 852-857, 860-861, 864-865, 870, 873-875, 878-887, 892-901, 906-917, 922-930, 933-942, 947-959, 962-963, 966-967, 972, 975-977, 980-988, 993-1001, 1004-1012, 1015-1023, 1026-1027, 1030-1031, 1036, 1039-1041, 1044-1053, 1058-1066, 1069-1077, 1080-1088, 1092-1102, 1105-1106, 1109-1110
src/db/session.py                                       41     22    46%   18-30, 40-41, 48, 64-66, 71-78
src/db/types.py                                         18      0   100%
src/services/__init__.py                                 0      0   100%
src/services/event_service.py                           28     28     0%   7-96
src/services/pricing.py                                 21     21     0%   3-38
src/services/scheduler.py                              162     14    91%   74, 103, 107, 137, 145, 248-249, 253-254, 256-257, 263, 284, 358
src/services/stripe_service.py                         121    121     0%   7-285
src/services/tier_enforcement.py                       134    134     0%   7-496
src/services/usage.py                                   61     61     0%   7-221
src/telemetry.py                                        55     48    13%   16-58, 63-66, 71-82, 87-98
src/tier_config/__init__.py                              0      0   100%
src/tier_config/tier_limits.py                          24     24     0%   9-165
----------------------------------------------------------------------------------
TOTAL                                                 5735   4111    28%
Coverage HTML written to dir coverage_html
Coverage XML written to file coverage.xml
======================== 81 passed, 3 skipped in 26.18s ========================

==> Coverage report saved to: coverage_html/index.html
==> Coverage XML saved to: coverage.xml
==> Cleaning up...

######## frontend-adhd-reminders
--> frontend-adhd-reminders: npm ci
INFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [3619401]

added 293 packages in 2s
--> frontend-adhd-reminders: npm run lint

> frontend-adhd-reminders@0.0.0 lint
> eslint .

[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-adhd-reminders/src/contexts/AuthContext.tsx
  32:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-adhd-reminders/src/contexts/AuthContext.tsx:32:7
  30 |         .finally(() => setIsLoading(false));
  31 |     } else {
> 32 |       setIsLoading(false);
     |       ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  33 |     }
  34 |   }, []);
  35 |  react-hooks/set-state-in-effect
  62:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-adhd-reminders/src/pages/LoginPage.tsx
  22:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  37:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-adhd-reminders/src/pages/SettingsPage.tsx
   66:34  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   90:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  285:73  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-adhd-reminders/src/types/api.ts
   88:26  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  105:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 9 problems (9 errors, 0 warnings)

--> frontend-adhd-reminders: lint findings above (advisory — not failing the run)
--> frontend-adhd-reminders: npm run build

> frontend-adhd-reminders@0.0.0 build
> tsc -b && vite build

vite v7.2.4 building client environment for production...
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
transforming...
Browserslist: browsers data (caniuse-lite) is 11 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2390 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.75 kB │ gzip:   0.40 kB
dist/assets/index-DgqTkp50.css   25.21 kB │ gzip:   5.25 kB
dist/assets/index-Ak353jQG.js   449.95 kB │ gzip: 143.36 kB
✓ built in 2.71s

######## frontend-developer-user
--> frontend-developer-user: npm ci

added 297 packages in 2s
--> frontend-developer-user: npm run lint

> frontend-developer-user-app@0.0.0 lint
> eslint .

[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/contexts/AuthContext.tsx
  31:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/contexts/AuthContext.tsx:31:7
  29 |         .finally(() => setIsLoading(false));
  30 |     } else {
> 31 |       setIsLoading(false);
     |       ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  32 |     }
  33 |   }, []);
  34 |  react-hooks/set-state-in-effect
  67:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/lib/utils.ts
  3:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/pages/ApiTokensPage.tsx
  91:21  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/pages/ChannelsPage.tsx
  39:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/pages/IncidentsPage.tsx
  138:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/pages/LoginPage.tsx
  22:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  37:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-developer-user/src/types/api.ts
  71:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  79:26  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  86:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 11 problems (11 errors, 0 warnings)

--> frontend-developer-user: lint findings above (advisory — not failing the run)
--> frontend-developer-user: npm run build

> frontend-developer-user-app@0.0.0 build
> tsc -b && vite build

vite v7.2.4 building client environment for production...
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
transforming...
Browserslist: browsers data (caniuse-lite) is 11 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2089 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.51 kB │ gzip:   0.33 kB
dist/assets/index-DVzcx5N_.css   22.61 kB │ gzip:   4.66 kB
dist/assets/index-rmNz3FyK.js   435.20 kB │ gzip: 136.04 kB
✓ built in 2.50s

######## frontend-eisenhower-tasks
--> frontend-eisenhower-tasks: npm ci

added 306 packages in 2s
--> frontend-eisenhower-tasks: npm run lint

> frontend-eisenhower-tasks@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-eisenhower-tasks/src/contexts/AuthContext.tsx
  68:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-eisenhower-tasks/src/contexts/ThemeContext.tsx
  54:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-eisenhower-tasks/src/pages/SettingsPage.tsx
  20:7  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-eisenhower-tasks/src/pages/SettingsPage.tsx:20:7
  18 |     if ('Notification' in window) {
  19 |       const permission = Notification.permission;
> 20 |       setNotificationPermission(permission);
     |       ^^^^^^^^^^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  21 |     }
  22 |   }, []);
  23 |  react-hooks/set-state-in-effect

✖ 3 problems (3 errors, 0 warnings)

--> frontend-eisenhower-tasks: lint findings above (advisory — not failing the run)
--> frontend-eisenhower-tasks: npm run build

> frontend-eisenhower-tasks@0.0.0 build
> tsc -b && vite build

vite v7.3.0 building client environment for production...
transforming...
Browserslist: browsers data (caniuse-lite) is 10 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2600 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.82 kB │ gzip:   0.49 kB
dist/assets/index-CsQntFdd.css   29.76 kB │ gzip:   6.28 kB
dist/assets/index-CL8PLFoG.js   595.70 kB │ gzip: 188.37 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.96s

######## frontend-event-planner
--> frontend-event-planner: npm ci

added 246 packages in 1s
--> frontend-event-planner: no lint script, skipping lint
--> frontend-event-planner: npm run build

> frontend-event-planner@0.0.0 build
> tsc -b && vite build

vite v7.2.2 building client environment for production...
transforming...
✓ 445 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.50 kB │ gzip:   0.32 kB
dist/assets/index-CcbMJsVL.css   14.12 kB │ gzip:   3.52 kB
dist/assets/index-Cgp00hyu.js   425.59 kB │ gzip: 133.85 kB
✓ built in 1.41s

######## frontend-it-team-alerts
--> frontend-it-team-alerts: npm ci

added 270 packages in 2s
--> frontend-it-team-alerts: npm run lint

> frontend-it-team-alerts@0.0.0 lint
> eslint .

[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/contexts/AuthContext.tsx
  33:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/contexts/AuthContext.tsx:33:7
  31 |         .finally(() => setIsLoading(false));
  32 |     } else {
> 33 |       setIsLoading(false);
     |       ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  34 |     }
  35 |   }, []);
  36 |  react-hooks/set-state-in-effect
  69:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/contexts/OrganizationContext.tsx
  27:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/contexts/OrganizationContext.tsx:27:7
  25 |   useEffect(() => {
  26 |     if (organizations.length > 0 && selectedOrgId === null) {
> 27 |       setSelectedOrgId(organizations[0].id);
     |       ^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  28 |     }
  29 |   }, [organizations, selectedOrgId]);
  30 |  react-hooks/set-state-in-effect
  45:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/contexts/ToastContext.tsx
  25:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/ApiTokensPage.tsx
  36:6   warning  React Hook useEffect has a missing dependency: 'exampleChannel'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  95:21  error    Unexpected any. Specify a different type                                                                           @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/ChannelsPage.tsx
  189:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/ChannelsPage.tsx:189:7
  187 |   useEffect(() => {
  188 |     if (isEdit && channel) {
> 189 |       setName(channel.name);
      |       ^^^^^^^ Avoid calling setState() directly within an effect
  190 |       setTag(channel.tag);
  191 |       setChannelType(channel.channel_type ?? 'sms');
  192 |       setIsActive(channel.is_active);  react-hooks/set-state-in-effect
  209:98  error  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-explicit-any
  214:20  error  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-explicit-any
  227:20  error  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              @typescript-eslint/no-explicit-any
  271:16  error  'e' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         @typescript-eslint/no-unused-vars

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/CreateIncidentPage.tsx
   49:7   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/CreateIncidentPage.tsx:49:7
  47 |   useEffect(() => {
  48 |     if (!selectedOrgId && incidentScope === 'organization') {
> 49 |       setIncidentScope('personal');
     |       ^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  50 |     }
  51 |     setRoleRequirements([]);
  52 |   }, [selectedOrgId, incidentScope]);  react-hooks/set-state-in-effect
   78:30  error  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                @typescript-eslint/no-explicit-any
  100:20  error  Unexpected any. Specify a different type                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/IncidentDetailPage.tsx
  280:39  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  281:45  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  296:53  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  501:46  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/IncidentsPage.tsx
  206:9   warning  The 'allEvents' array makes the dependencies of useMemo Hook (at line 213) change on every render. To fix this, wrap the initialization of 'allEvents' in its own useMemo() Hook                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            react-hooks/exhaustive-deps
  210:20  error    Compilation Skipped: Existing memoization could not be preserved

React Compiler has skipped optimizing this component because the existing manual memoization could not be preserved. This value was memoized in source but not in compilation output.

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/IncidentsPage.tsx:210:20
  208 |
  209 |   // Fetch role requirements for all events
> 210 |   const eventIds = useMemo(() => {
      |                    ^^^^^^^^^^^^^^^
> 211 |     const ids = allEvents.map(e => e.id);
      | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 212 |     return Array.from(new Set(ids));
      | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
> 213 |   }, [allEvents]);
      | ^^^^^^^^^^^^^^^^^^ Could not preserve existing memoization
  214 |
  215 |   const { data: allRoleRequirements = [] } = useQuery({
  216 |     queryKey: ['allRoleRequirements', eventIds.sort()],  react-hooks/preserve-manual-memoization
  213:7   error    Compilation Skipped: Existing memoization could not be preserved

React Compiler has skipped optimizing this component because the existing manual memoization could not be preserved. This dependency may be mutated later, which could cause the value to change unexpectedly.

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/IncidentsPage.tsx:213:7
  211 |     const ids = allEvents.map(e => e.id);
  212 |     return Array.from(new Set(ids));
> 213 |   }, [allEvents]);
      |       ^^^^^^^^^ This dependency may be modified later
  214 |
  215 |   const { data: allRoleRequirements = [] } = useQuery({
  216 |     queryKey: ['allRoleRequirements', eventIds.sort()],                                                                                                                                                                                                                                     react-hooks/preserve-manual-memoization

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/LoginPage.tsx
  22:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  37:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/RegisterPage.tsx
  29:19  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/RolesCatalogPage.tsx
  40:67  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  89:12  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/pages/TeamsPage.tsx
  111:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-it-team-alerts/src/types/api.ts
   61:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
   68:27  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  156:30  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  163:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
  168:31  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

✖ 33 problems (31 errors, 2 warnings)

--> frontend-it-team-alerts: lint findings above (advisory — not failing the run)
--> frontend-it-team-alerts: npm run build

> frontend-it-team-alerts@0.0.0 build
> tsc -b && vite build

vite v7.2.2 building client environment for production...
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
transforming...
Browserslist: browsers data (caniuse-lite) is 11 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2405 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.49 kB │ gzip:   0.32 kB
dist/assets/index-CWWwrgoo.css   54.37 kB │ gzip:   9.41 kB
dist/assets/index-DmW_E3qO.js   566.01 kB │ gzip: 167.63 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.71s

######## frontend-mind
--> frontend-mind: npm ci

added 302 packages in 2s
--> frontend-mind: npm run lint

> frontend-mind@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mind/src/contexts/AuthContext.tsx
  102:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mind/src/contexts/ThemeContext.tsx
   36:14  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components
  226:17  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mind/src/pages/SettingsPage.tsx
  19:7  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mind/src/pages/SettingsPage.tsx:19:7
  17 |   useEffect(() => {
  18 |     if ('Notification' in window) {
> 19 |       setNotificationPermission(Notification.permission);
     |       ^^^^^^^^^^^^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  20 |     }
  21 |   }, []);
  22 |  react-hooks/set-state-in-effect

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mind/src/pages/VerificationPage.tsx
  21:6  warning  React Hook useEffect has a missing dependency: 'handleVerification'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

✖ 5 problems (4 errors, 1 warning)

--> frontend-mind: lint findings above (advisory — not failing the run)
--> frontend-mind: npm run build

> frontend-mind@0.0.0 build
> tsc -b && vite build

vite v7.2.7 building client environment for production...
transforming...
Browserslist: browsers data (caniuse-lite) is 10 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2805 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.70 kB │ gzip:   0.39 kB
dist/assets/index-DsTH7Txh.css   34.63 kB │ gzip:   6.97 kB
dist/assets/index-C6tPb3Zp.js   619.08 kB │ gzip: 191.33 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.20s

######## frontend-mission-control
--> frontend-mission-control: npm ci

added 246 packages in 2s
--> frontend-mission-control: npm run lint

> frontend-mission-control@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mission-control/src/components/ui/Frame.tsx
  4:14  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mission-control/src/contexts/AuthContext.tsx
  31:7   error    Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-mission-control/src/contexts/AuthContext.tsx:31:7
  29 |         .finally(() => setIsLoading(false));
  30 |     } else {
> 31 |       setIsLoading(false);
     |       ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  32 |     }
  33 |   }, []);
  34 |  react-hooks/set-state-in-effect
  68:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         react-refresh/only-export-components

✖ 3 problems (1 error, 2 warnings)

--> frontend-mission-control: lint findings above (advisory — not failing the run)
--> frontend-mission-control: npm run build

> frontend-mission-control@0.0.0 build
> tsc -b && vite build

vite v7.2.7 building client environment for production...
transforming...
✓ 2400 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.84 kB │ gzip:   0.43 kB
dist/assets/index-DxjC0tkv.css   25.54 kB │ gzip:   5.55 kB
dist/assets/index-BYdVpPnt.js   504.77 kB │ gzip: 155.16 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.37s

######## frontend-personal-events-tracker
--> frontend-personal-events-tracker: npm ci

added 269 packages in 2s
--> frontend-personal-events-tracker: no lint script, skipping lint
--> frontend-personal-events-tracker: npm run build

> frontend-personal-events-tracker@0.0.0 build
> tsc -b && vite build

vite v7.2.4 building client environment for production...
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
transforming...
Browserslist: browsers data (caniuse-lite) is 11 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2008 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:   0.31 kB
dist/assets/index-H3h34FGY.css   44.84 kB │ gzip:   7.29 kB
dist/assets/index-JpfS_tv3.js   442.05 kB │ gzip: 128.23 kB
✓ built in 2.42s

######## frontend-standalone-example
--> frontend-standalone-example: npm ci

added 176 packages in 1s
--> frontend-standalone-example: npm run lint

> frontend-standalone-example@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-standalone-example/src/App.tsx
  105:6  warning  React Hook useEffect has a missing dependency: 'fetchEvents'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

✖ 1 problem (0 errors, 1 warning)

--> frontend-standalone-example: npm run build

> frontend-standalone-example@0.0.0 build
> tsc -b && vite build

vite v7.3.0 building client environment for production...
transforming...
✓ 30 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.47 kB │ gzip:  0.31 kB
dist/assets/index-SZD_SaVG.css    2.57 kB │ gzip:  0.93 kB
dist/assets/index-B66zMUs5.js   196.83 kB │ gzip: 61.94 kB
✓ built in 629ms

######## frontend-theater-volunteer
--> frontend-theater-volunteer: npm ci

added 291 packages in 3s
--> frontend-theater-volunteer: npm run lint

> frontend-theater-volunteer@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/components/TagBadge.tsx
  55:14  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components  react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/context/AuthContext.tsx
  46:5   error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/context/AuthContext.tsx:46:5
  44 |     if (!orgsQuery.data?.length) return
  45 |     if (activeOrgId && orgsQuery.data.some((org) => org.id === activeOrgId)) return
> 46 |     setActiveOrgId(orgsQuery.data[0].id)
     |     ^^^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  47 |   }, [orgsQuery.data, activeOrgId])
  48 |
  49 |   const loginMutation = useMutation({  react-hooks/set-state-in-effect
  97:14  error  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/pages/CreateEventPage.tsx
  71:7  error  Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/pages/CreateEventPage.tsx:71:7
  69 |       }
  70 |
> 71 |       setForm({
     |       ^^^^^^^ Avoid calling setState() directly within an effect
  72 |         name: event.name,
  73 |         description: event.description || '',
  74 |         start_date: startDate.toISOString().split('T')[0],  react-hooks/set-state-in-effect

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/pages/LoginPage.tsx
  22:14  error  'err' is defined but never used  @typescript-eslint/no-unused-vars

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/pages/VolunteersPage.tsx
  37:20  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-theater-volunteer/src/types/api.ts
  56:18  error  An interface declaring no members is equivalent to its supertype  @typescript-eslint/no-empty-object-type

✖ 7 problems (7 errors, 0 warnings)

--> frontend-theater-volunteer: lint findings above (advisory — not failing the run)
--> frontend-theater-volunteer: npm run build

> frontend-theater-volunteer@0.0.0 build
> tsc -b && vite build

vite v7.3.0 building client environment for production...
transforming...
Browserslist: browsers data (caniuse-lite) is 10 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2111 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.50 kB │ gzip:   0.32 kB
dist/assets/index-CXXOvmV5.css   21.58 kB │ gzip:   4.46 kB
dist/assets/index-BXDUbe1y.js   482.58 kB │ gzip: 147.78 kB
✓ built in 5.12s

######## frontend-volunteer-coordinator
--> frontend-volunteer-coordinator: npm ci

added 364 packages in 6s
--> frontend-volunteer-coordinator: npm run lint

> frontend-volunteer-coordinator@0.0.0 lint
> eslint .

[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
--> frontend-volunteer-coordinator: npm run build

> frontend-volunteer-coordinator@0.0.0 build
> tsc -b && vite build

vite v7.2.2 building client environment for production...
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
transforming...
Browserslist: browsers data (caniuse-lite) is 11 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme
✓ 2476 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.53 kB │ gzip:   0.33 kB
dist/assets/index-Dvki_uLE.css   22.99 kB │ gzip:   4.90 kB
dist/assets/index-C7-Hm1HO.js   601.18 kB │ gzip: 183.09 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.56s

######## frontend-website
--> frontend-website: npm ci

added 242 packages in 2s
--> frontend-website: npm run lint

> frontend-website@0.0.0 lint
> eslint .


/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-website/src/contexts/AuthContext.tsx
  30:7   error    Error: Calling setState synchronously within an effect can trigger cascading renders

Effects are intended to synchronize state between React and external systems such as manually updating the DOM, state management libraries, or other platform APIs. In general, the body of an effect should do one or both of the following:
* Update external systems with the latest state from React.
* Subscribe for updates from some external system, calling setState in a callback function when external state changes.

Calling setState synchronously within an effect body causes cascading renders that can hurt performance, and is not recommended. (https://react.dev/learn/you-might-not-need-an-effect).

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-website/src/contexts/AuthContext.tsx:30:7
  28 |         .finally(() => setIsLoading(false));
  29 |     } else {
> 30 |       setIsLoading(false);
     |       ^^^^^^^^^^^^ Avoid calling setState() directly within an effect
  31 |     }
  32 |   }, []);
  33 |  react-hooks/set-state-in-effect
  67:17  warning  Fast refresh only works when a file only exports components. Use a new file to share constants or functions between components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 react-refresh/only-export-components

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-website/src/pages/AppPickerPage.tsx
  24:5  error  Error: This value cannot be modified

Modifying a variable defined outside a component or hook is not allowed. Consider using an effect.

/home/nic/projects/personal/notifiq-worktrees/diy-scheduler/frontend-website/src/pages/AppPickerPage.tsx:24:5
  22 |   const handleAppSelect = (app: AppCard) => {
  23 |     apiClient.setPreferredApp(app.id);
> 24 |     window.location.href = app.path;
     |     ^^^^^^^^^^^^^^^ value cannot be modified
  25 |   };
  26 |
  27 |   const handleLogout = async () => {  react-hooks/immutability

✖ 3 problems (2 errors, 1 warning)

--> frontend-website: lint findings above (advisory — not failing the run)
--> frontend-website: npm run build

> frontend-website@0.0.0 build
> tsc -b && vite build

vite v7.2.7 building client environment for production...
transforming...
✓ 2073 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.72 kB │ gzip:   0.40 kB
dist/assets/index-BEk1RcMt.css   31.34 kB │ gzip:   6.38 kB
dist/assets/index-1WE9dpWi.js   613.16 kB │ gzip: 154.15 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 2.10s

================ verify summary ================
  PASS  backend lint
  PASS  backend tests (unit)
  PASS  backend tests (integration)
  PASS  frontend-adhd-reminders
  PASS  frontend-developer-user
  PASS  frontend-eisenhower-tasks
  PASS  frontend-event-planner
  PASS  frontend-it-team-alerts
  PASS  frontend-mind
  PASS  frontend-mission-control
  PASS  frontend-personal-events-tracker
  PASS  frontend-standalone-example
  PASS  frontend-theater-volunteer
  PASS  frontend-volunteer-coordinator
  PASS  frontend-website
  NOTE  eslint findings (advisory, pre-existing on main): frontend-adhd-reminders frontend-developer-user frontend-eisenhower-tasks frontend-it-team-alerts frontend-mind frontend-mission-control frontend-theater-volunteer frontend-website 
  NOTE      -> VERIFY_LINT_STRICT=1 VERIFY_FRONTENDS=<app> just verify  makes lint blocking
===============================================
verify PASSED (15 step(s))
```
