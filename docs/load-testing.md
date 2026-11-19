# Load testing: DB-scheduler architecture

Measured 2026-11-16 on commit `1a0e334` (DB-backed `scheduled_jobs` + polling
worker, post-Temporal). Harness: `backend/scripts/load.py` +
`backend/scripts/sink_gotify.py` (local gotify HTTP sink; no outbound traffic
leaves the test network).

Targets: `aurora` (local e2e stack) and `ghost` (isolated compose project
`notifiq-e2e-notifiq-load[-pg]`, separate volumes, loopback-only port). Prod
was never touched. Each target ran sqlite (`docker-compose.stack.yml`) and
postgres (`+ docker-compose.postgres.yml`).

## Conditions that move the numbers

- **FastAPI Radar is the single biggest API cost.** It captures every request
  + its SQL into the same database and is unconditional in `main.py`. On
  aurora, Radar-excluded `/api/v1/health` served ~585 rps while instrumented
  endpoints capped ~18 rps. Prod runs Radar on.
- **`DEBUG=true` enables SQLAlchemy echo** (`session.py`). Prod runs with it.
  Small cost on an idle box, amplifies under contention.
- **`API_RATE_LIMIT_PER_MINUTE=600`** (per-IP sliding window) will 429 a single
  client at ~10 rps regardless of architecture. Sweeps below ran with it
  raised.
- **Ghost is a busy box.** Load average 11–18 on 16 cores during the runs.
  Ghost numbers are "prod-like noisy neighbor", not clean-hardware numbers.

## API sweep (8s windows; rps / p50 / errors)

### Aurora, sqlite, prod-like config (Radar ON + DEBUG)

| workload | c=1 | c=8 | c=32 |
|---|---|---|---|
| read | ~17 rps | ~18 rps | ~19 rps |
| write | ~4.5 rps | ~8 rps | ~8.4 rps, **16–18 HTTP 500 (lock)** |

### Aurora, sqlite, Radar OFF + limiter raised

| workload | c=1 | c=8 | c=32 | c=64 |
|---|---|---|---|---|
| read rps / p50 | 92 / 10ms | 49 / 163ms | 42 / 826ms | 44 / 1.7s |
| write rps / p50 | 17 / 51ms | 18 / 114ms | 14 / 1.2s, **18/114 500** | 19 / 4.4s, **41/151 500** |

sqlite reads *degrade* with concurrency (aiosqlite single connection
serializes). Writes plateau ~17–19 rps and start failing past c≈32 — the
implicit busy queue fills, then `database is locked` 500s.

### Aurora, postgres, Radar OFF + limiter raised

| workload | c=1 | c=8 | c=32 |
|---|---|---|---|
| read rps / p50 | 109 / 8.7ms | 104 / 70ms | 76 / 409ms |
| write rps / p50 | 41 / 22ms | 49 / 145ms | 36 / 721ms |

**Zero errors at every concurrency.** Writes scale instead of failing.

### Ghost, sqlite vs postgres, prod-like config (Radar ON + DEBUG, host load ~13–18)

| workload | sqlite | postgres |
|---|---|---|
| read c=1 | 7.8 rps / 123ms | 8.6 rps / 110ms |
| read c=8 | 11.4 / 723ms | 13.0 / 622ms |
| read c=32 | 13.4 / 3.0s | 14.1 / 2.6s |
| write c=1 | 3.2 / 296ms | 3.4 / 300ms |
| write c=8 | 4.6 / 1.1s, **4/37 err** | 4.6 / 1.7s, **0 err** |
| write c=32 | 7.4 / 6.3s, **12/59 500** | 7.4 / 5.3s, **0 err** |

On a saturated host the DB choice barely moves throughput — Radar + host
contention dominate — but postgres removes the failure mode entirely.

## Scheduler drain (200 due `reminder` jobs, single worker)

| target | sqlite | postgres |
|---|---|---|
| aurora, send (real gotify POST per job) | ~26 j/s | ~76 j/s |
| aurora, no-send | ~60 j/s | ~193 j/s |
| ghost, send | ~28 j/s | ~72 j/s |
| ghost, no-send | ~186 j/s | ~943 j/s |

Send-mode is bounded by per-send apprise latency executed **serially inside
one worker** (`run_due_jobs` awaits handlers one at a time). No-send shows
the pure scheduler loop is never the limit.

Broadcast `notify_subscribers` fan-out to 100 subs: **0.05–1s** everywhere
(LAN sink; sync `apprise_notify` blocks the worker per send).

## Mixed load: 200 send-jobs draining while API writes at c=16

| target | drain time | API writes |
|---|---|---|
| aurora sqlite | 21.5s | 21 failures (lock errors + disconnects) |
| aurora pg | 8.6s | **0 errors** |
| ghost sqlite | **>300s (starved)** | 4.7 rps, **63% errors** |
| ghost pg | **6.3s** | 4.9 rps, **0 errors** |

sqlite's single writer makes the worker and API fight; under ghost's real
host load the scheduler effectively stalls. Postgres keeps both lanes moving.

## Bottleneck ranking (current single-api/single-worker arch)

1. **Radar middleware** — biggest API tax, on unconditionally, ~5× on reads.
2. **sqlite single-writer** — lock 500s under concurrent writes, scheduler
   starvation under mixed load.
3. **Serial worker + sync apprise** — send throughput = 1/send-latency,
   no matter how many cores.
4. **Host contention on ghost** — ~2× slower than aurora for the same code.
5. Per-IP rate limit (600/min) — policy, sits below the architecture ceiling.

## Deployment guidance

- **postgres for anything beyond personal-scale.** It's the documented
  migration path and removes the only failure mode observed.
- **sqlite is fine for single-user/low-write** if Radar is off; add WAL +
  `busy_timeout` in `session.py` to push the lock wall out if it stays.
- **Gate Radar behind a setting** and turn it off in prod — biggest cheap win.
- **`DEBUG=false` in prod** — SQL echo per request.
- Scheduler capacity is fine for realistic reminder volumes (thousands/day).
  If send-rate ever matters: make all notification paths async
  (`apprise_anotify`) and process claimed jobs concurrently in the worker.
- These numbers are for **one API + one worker**; horizontal scaling is a
  different architecture, not tested here.
