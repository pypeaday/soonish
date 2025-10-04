# Getting Started with Soonish

**You're ready to build!** This guide gets you from zero to first API call in 10 minutes.

---

## Prerequisites

- Python 3.11+
- `uv` installed ([installation](https://github.com/astral-sh/uv))
- Temporal CLI installed (optional, for running Temporal server)

---

## Quick Start (10 minutes)

### 1. Set Up Environment

```bash
# Create virtual environment
uv venv
source .venv/bin/activate

# Install core dependencies
uv pip install \
    fastapi uvicorn \
    sqlalchemy aiosqlite \
    cryptography \
    python-jose passlib[bcrypt] \
    httpx
```

### 2. Configure Environment

```bash
# Generate encryption keys
python -c "from cryptography.fernet import Fernet; print('ENCRYPTION_KEY=' + Fernet.generate_key().decode())" > .env
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))" >> .env

# Add other config
cat >> .env << 'EOF'
DATABASE_URL=sqlite+aiosqlite:///soonish.db
TEMPORAL_URL=localhost:7233
TEMPORAL_TASK_QUEUE=soonish-task-queue
DEBUG=true
EOF
```

### 3. Create Directory Structure

```bash
mkdir -p src/{api,db,worker,workflows,activities}
mkdir -p src/api/routes src/api/auth
mkdir -p scripts tests
touch src/__init__.py src/api/__init__.py src/db/__init__.py
```

### 4. Initialize Database

**Option A**: Copy the initialization script from `docs/implementation/database-setup.md` and run:

```bash
uv run scripts/init_db.py
```

**Option B**: Start simple - you'll build the database layer in Phase 1.

---

## Your First 30 Minutes

Now follow the **[Phase Plan](./docs/implementation/phase-plan.md)**:

### Phase 0: Project Setup (5 min)
- ✅ Virtual environment (done above)
- ✅ Dependencies installed
- ✅ `.env` file created
- ✅ Directory structure

### Phase 1: Database Layer (next 25 min)

Build in this order:

1. **`src/db/base.py`** - Base model class
2. **`src/db/encryption.py`** - Fernet encryption helpers
3. **`src/db/models.py`** - SQLAlchemy models (User, Event, Integration, etc.)
4. **`src/db/session.py`** - Async session management
5. **`src/db/repositories.py`** - Database query functions
6. **`scripts/init_db.py`** - Database initialization script

**Test it**:
```bash
uv run scripts/init_db.py
# Expected: Database created with sample data
```

---

## Documentation Navigation

**Building the system?** Follow this path:

1. 📖 **[Phase Plan](./docs/implementation/phase-plan.md)** - Your roadmap (Phases 0-10)
2. 🗄️ **[Database Setup](./docs/implementation/database-setup.md)** - Copy-paste database init script
3. 🧪 **[Testing Strategy](./docs/implementation/testing-strategy.md)** - How to validate each phase
4. ⚙️ **[Configuration](./docs/operations/configuration.md)** - All environment variables

**Understanding the system?** Read the specs:

1. 🏗️ **[System Overview](./docs/architecture/system-overview.md)** - Architecture & design decisions
2. 💾 **[Data Models](./docs/specifications/data-models.md)** - Database schema & repositories
3. 🔄 **[Temporal Spec](./docs/specifications/temporal-specification.md)** - Workflows & activities
4. 🌐 **[API Spec](./docs/specifications/api-specification.md)** - REST endpoints
5. 🔐 **[Authentication](./docs/specifications/authentication.md)** - Auth flows

**Everything else**: See **[docs/README.md](./docs/README.md)**

---

## Development Workflow

Once you have Phase 1 working:

```bash
# Morning routine: Fresh database
uv run scripts/init_db.py

# Terminal 1: Temporal server (when you reach Phase 6)
temporal server start-dev

# Terminal 2: Worker (when you reach Phase 6)
uv run python -m src.worker.main

# Terminal 3: API server (when you reach Phase 3)
uvicorn src.api.main:app --reload

# Terminal 4: Testing
curl http://localhost:8000/api/health
```

---

## Key Principles

From your `.windsurfrules`:

1. **Async everything** - All database and API calls are async
2. **No migrations during dev** - Blow away database and recreate
3. **Minimal code** - Every line is a liability
4. **Small changes** - 30-50 lines max per commit
5. **Environment config** - Use `.env` for all settings
6. **Run ruff after changes** - `uv run ruff check --fix`

---

## What You're Building

**Soonish** is a notification-first event service. Users get updates where they already are (Gotify, Discord, email, SMS, etc.), not in a siloed app.

**MVP Features**:
- Create public events
- Subscribe (anonymous or authenticated)
- Manage notification channels (Apprise-based)
- Automatic reminders (T-1d, T-1h)
- Manual notifications from organizers
- Real-time event updates

---

## Phase Roadmap

| Phase | What You'll Build | Time | Status |
|-------|-------------------|------|--------|
| 0 | Project setup | 30 min | ✅ Done |
| 1 | Database layer | 1 day | 👉 **Start here** |
| 2 | Configuration | 30 min | |
| 3 | Basic FastAPI | 1 hour | |
| 4 | Authentication | 1 day | |
| 5 | Events API | 1 day | |
| 6 | Temporal integration | 1 day | |
| 7 | Subscriptions | 1 day | |
| 8 | Notifications | 1 day | |
| 9 | Temporal Schedules | 1 day | |
| 10 | Integrations API | 1 day | |

**After Phase 10**: You have a working MVP!

---

## Common Commands

```bash
# Database
uv run scripts/init_db.py               # Fresh database with sample data
sqlite3 soonish.db                      # Inspect database

# Development
uvicorn src.api.main:app --reload       # API server (Phase 3+)
uv run python -m src.worker.main        # Temporal worker (Phase 6+)
temporal server start-dev               # Temporal server (Phase 6+)

# Testing
curl http://localhost:8000/api/health   # API health check
open http://localhost:8000/docs         # Swagger UI
open http://localhost:8233              # Temporal UI

# Code quality
uv run ruff check --fix                 # Lint and auto-fix
```

---

## Getting Unstuck

**Import errors?**
- Check you're in virtual environment: `source .venv/bin/activate`

**Database locked?**
- Close any open SQLite connections
- Restart Python REPL

**Workflow not starting?**
- Check worker is running
- Check task queue name matches in config and workflow start

**Need help?**
1. Check **[docs/troubleshooting.md](./docs/troubleshooting.md)**
2. Check phase-specific testing in **[testing-strategy.md](./docs/implementation/testing-strategy.md)**
3. Check Temporal UI: http://localhost:8233
4. Inspect database: `sqlite3 soonish.db`

---

## Next Steps

1. **Read Phase 1** in [phase-plan.md](./docs/implementation/phase-plan.md)
2. **Copy database script** from [database-setup.md](./docs/implementation/database-setup.md)
3. **Start building** the database layer
4. **Test immediately** after each component

---

## Tips for Success

1. **Build in order** - Each phase depends on the previous
2. **Test as you go** - Don't wait until the end
3. **Blow away DB often** - It's faster than debugging migrations
4. **Keep it minimal** - Resist the urge to add features early
5. **Use the specs** - Everything is documented, no guessing needed
6. **Commit frequently** - Small, focused commits

---

## You've Got This! 🚀

The docs are complete. The path is clear. Every question has an answer in the specs.

**Start with Phase 1 and build one piece at a time.**

Good luck, have fun, and remember: **every line of code is a liability - keep it minimal!**

---

*For detailed navigation, see [docs/README.md](./docs/README.md)*
