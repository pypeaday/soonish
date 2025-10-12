api-server:
    #!/usr/bin/env bash
    set -m
    trap 'kill $(jobs -p) 2>/dev/null' EXIT
    uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
    wait

temporal-worker:
    #!/usr/bin/env bash
    set -m
    trap 'kill $(jobs -p) 2>/dev/null' EXIT
    uv run python -m src.worker.main &
    wait

new-db:
    uv run scripts/init_db.py

datasette:
    #!/usr/bin/env bash
    set -m
    trap 'kill $(jobs -p) 2>/dev/null' EXIT
    datasette serve soonish.db &
    wait

up:
    #!/usr/bin/env bash
    set -m
    trap 'kill $(jobs -p) 2>/dev/null' EXIT
    just new-db
    uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
    # Note: Worker doesn't auto-reload - restart 'just up' after workflow changes
    uv run python -m src.worker.main &
    wait

check-services:
    uv run scripts/check_services.py

integration:
    @just check-services
    uv run scripts/test_workflow_integration.py

find-rogue-workers:
    ps aux | grep "python.*worker" | grep -v grep | grep -v "uv run"