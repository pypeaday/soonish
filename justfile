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
    uv run python -m src.worker.main &
    datasette serve soonish.db &
    wait

check-services:
    uv run scripts/check_services.py

integration:
    @just check-services
    uv run scripts/test_workflow_integration.py
