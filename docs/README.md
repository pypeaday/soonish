# Soonish Documentation

Complete technical documentation for the Soonish event notification service.

---

## Quick Start

**New to the project?** Start here:

1. 📖 Read [`vision.md`](./vision.md) - Understand what we're building
2. 📊 Read [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) - **What's done, what works**
3. 🏗️ Read [`architecture/system-overview.md`](./architecture/system-overview.md) - High-level design
4. 🚀 Follow [`implementation/phase-plan.md`](./implementation/phase-plan.md) - Start building

---

## Documentation Structure

### 📊 Status & Progress

Current implementation status and recent changes.

- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - ✅ Phases 0-10 complete, critical fixes, testing status
- **[NOTIFICATION_REFACTOR_COMPLETE.md](./NOTIFICATION_REFACTOR_COMPLETE.md)** - Notification patterns refactor (2025-10-08)
- **[ARCHITECTURAL_CLARITY.md](./ARCHITECTURAL_CLARITY.md)** - Architectural decisions and clarity improvements

### 📐 Specifications (Authoritative)

The source of truth for how things work.

- **[data-models.md](./specifications/data-models.md)** - Database schema, SQLAlchemy models, repositories, encryption
- **[temporal-specification.md](./specifications/temporal-specification.md)** - Workflows, activities, schedules, signals
- **[api-specification.md](./specifications/api-specification.md)** - REST API endpoints, request/response schemas
- **[authentication.md](./specifications/authentication.md)** - Auth flows, JWT + sessions, user management

### 🏛️ Architecture

System design and decisions.

- **[system-overview.md](./architecture/system-overview.md)** - Architecture diagrams, tech stack, design decisions, scaling strategy
- **[notification-patterns.md](./architecture/notification-patterns.md)** - Event-driven vs subscriber-driven patterns (critical)

### 🛠️ Implementation

How to build it.

- **[phase-plan.md](./implementation/phase-plan.md)** - Step-by-step build plan (10 phases)
- **[database-setup.md](./implementation/database-setup.md)** - Database initialization, no-migration workflow
- **[testing-strategy.md](./implementation/testing-strategy.md)** - How to test each component

### ⚙️ Operations

Running and configuring the service.

- **[configuration.md](./operations/configuration.md)** - Environment variables reference
- **[security.md](../security.md)** - Security practices (existing)
- **[troubleshooting.md](../troubleshooting.md)** - Common issues (existing)

### 📋 Other

- **[vision.md](./vision.md)** - Product vision and goals (existing)

---

## For Different Audiences

### "I want to understand the system"

1. [`vision.md`](./vision.md) - What and why
2. [`architecture/system-overview.md`](./architecture/system-overview.md) - How it works
3. [`specifications/data-models.md`](./specifications/data-models.md) - Data structure
4. [`specifications/temporal-specification.md`](./specifications/temporal-specification.md) - Workflow orchestration

### "I want to start building"

1. [`implementation/database-setup.md`](./implementation/database-setup.md) - Set up database
2. [`implementation/phase-plan.md`](./implementation/phase-plan.md) - Follow phases 0-10
3. [`implementation/testing-strategy.md`](./implementation/testing-strategy.md) - Test as you go
4. [`operations/configuration.md`](./operations/configuration.md) - Configure environment

### "I want to add a feature"

1. Check relevant spec:
   - New API endpoint? → [`api-specification.md`](./specifications/api-specification.md)
   - New workflow? → [`temporal-specification.md`](./specifications/temporal-specification.md)
   - New table? → [`data-models.md`](./specifications/data-models.md)
2. Blow away database: `uv run scripts/init_db.py`
3. Implement feature
4. Test: [`testing-strategy.md`](./implementation/testing-strategy.md)
5. Run: `uv run ruff check --fix`

### "I'm deploying to production"

1. [`operations/configuration.md`](./operations/configuration.md) - Production env vars
2. [`security.md`](../security.md) - Security checklist
3. [`architecture/system-overview.md`](./architecture/system-overview.md#deployment-architecture) - Deployment setup

---

## Key Design Decisions

From [`architecture/system-overview.md`](./architecture/system-overview.md#design-decisions):

| Decision | Rationale |
|----------|-----------|
| **Temporal for orchestration** | Durable workflows, built-in retries, signal-based updates |
| **Apprise for notifications** | 70+ services out-of-the-box, no per-channel code |
| **Selector-based routing** | Flexible subscription preferences per event |
| **Thin repositories** | Pure data access, orchestration in API routes |
| **Dual auth (JWT + sessions)** | API clients + web UI both supported |
| **Anonymous → authenticated flow** | Easy email-only signup, seamless account creation |
| **Temporal Schedules for reminders** | Event-relative scheduling without bloating workflow |

---

## Technology Stack

**Backend**:
- Python 3.11+ (async/await)
- FastAPI (REST API)
- Temporal.io (workflow orchestration)
- SQLAlchemy 2.x (async ORM)
- SQLite → PostgreSQL
- Apprise (notifications)
- cryptography.fernet (encryption)

**Frontend** (planned):
- HTMX (server-driven UI)
- Alpine.js (minimal JS)

**Tools**:
- `uv` (package management)
- `ruff` (linting)

---

## Development Workflow

```bash
# 1. Fresh database
uv run scripts/init_db.py

# 2. Start services (separate terminals)
temporal server start-dev
uv run python -m src.worker.main
uvicorn src.api.main:app --reload

# 3. Build features
vim src/api/routes/events.py

# 4. Test
curl http://localhost:8000/api/events

# 5. Lint
uv run ruff check --fix

# 6. Commit
git commit -m "feat: add thing"
```

---

## Documentation Principles

1. **Specifications are authoritative** - Implementation follows specs, not vice versa
2. **Examples are concrete** - Real code, not pseudocode
3. **No hand-waving** - Every detail specified
4. **Copy-paste ready** - Code examples work as-is
5. **Implementation-first** - Explain how to build, not just what to build

---

## Contributing to Docs

**When adding a feature**:
1. Update relevant spec first
2. Implement the feature
3. Add testing examples to `testing-strategy.md`

**When changing architecture**:
1. Update `system-overview.md`
2. Update affected specs
3. Update `phase-plan.md` if build order changes

**Documentation standards**:
- Use Markdown
- Include code examples
- Keep specs DRY (don't repeat)
- Reference other docs with relative links
- Update "Last Updated" date

---

## Archived Documentation

See [`archive/`](./archive/) for old docs that have been superseded.

---

## Quick Reference

### File Locations

```
docs/
├── specifications/          # How things work (authoritative)
│   ├── data-models.md
│   ├── temporal-specification.md
│   ├── api-specification.md
│   └── authentication.md
├── architecture/            # System design
│   └── system-overview.md
├── implementation/          # How to build
│   ├── phase-plan.md
│   ├── database-setup.md
│   └── testing-strategy.md
├── operations/              # How to run
│   └── configuration.md
└── archive/                 # Old docs
```

### Key Commands

```bash
# Database
uv run scripts/init_db.py               # Fresh database

# Development
uvicorn src.api.main:app --reload       # API server
uv run python -m src.worker.main        # Temporal worker
temporal server start-dev               # Temporal server

# Testing
curl http://localhost:8000/api/health   # Health check
open http://localhost:8000/docs         # Swagger UI
open http://localhost:8233              # Temporal UI

# Code quality
uv run ruff check --fix                 # Lint and fix
```

### Environment Variables

See [`operations/configuration.md`](./operations/configuration.md) for complete reference.

**Required**:
- `ENCRYPTION_KEY` - Fernet key for Apprise URLs
- `SECRET_KEY` - JWT signing key
- `TEMPORAL_URL` - Temporal server address

**Generate keys**:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Getting Help

1. Check specs in [`specifications/`](./specifications/)
2. Check [`troubleshooting.md`](../troubleshooting.md)
3. Check Temporal UI at http://localhost:8233
4. Inspect database: `sqlite3 soonish.db`
5. Check logs from API and worker

---

## Project Status

**Current Phase**: Documentation complete, ready to build

**What's Working** (from previous work):
- Basic Temporal workflows
- Event lifecycle management
- Notification delivery
- Database models

**What's Next** (Phase-by-phase rebuild):
- Phase 1: Database layer
- Phase 2: Configuration
- Phase 3: Basic API
- Phase 4: Authentication
- ... (see [`phase-plan.md`](./implementation/phase-plan.md))

---

## License & Credits

See project root for license information.

Built with:
- [Temporal](https://temporal.io) - Durable workflow orchestration
- [FastAPI](https://fastapi.tiangolo.com) - Modern Python web framework
- [Apprise](https://github.com/caronc/apprise) - Multi-platform notifications
- [SQLAlchemy](https://www.sqlalchemy.org) - Python SQL toolkit
