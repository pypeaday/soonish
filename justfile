api-server:
    uv run uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

temporal-worker:
    uv run python -m src.worker.main &

new-db:
    uv run scripts/init_db.py

up:
    @just new-db
    @just api-server
    @just temporal-worker

check-services:
    uv run scripts/check_services.py

integration:
    @just temporal-worker
    @just check-services
    uv run scripts/test_workflow_integration.py
