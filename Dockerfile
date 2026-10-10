FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS backend-builder

WORKDIR /app

COPY backend ./backend

WORKDIR /app/backend

RUN uv sync --frozen --no-dev

FROM node:22-bookworm-slim AS frontend-builder

ARG FRONTEND_APPS="frontend-website frontend-mission-control frontend-volunteer-coordinator frontend-event-planner frontend-it-team-alerts frontend-developer-user frontend-eisenhower-tasks frontend-theater-volunteer frontend-adhd-reminders frontend-mind"

WORKDIR /app

COPY frontend-website/package.json frontend-website/package-lock.json ./frontend-website/
COPY frontend-mission-control/package.json frontend-mission-control/package-lock.json ./frontend-mission-control/
COPY frontend-volunteer-coordinator/package.json frontend-volunteer-coordinator/package-lock.json ./frontend-volunteer-coordinator/
COPY frontend-event-planner/package.json frontend-event-planner/package-lock.json ./frontend-event-planner/
COPY frontend-it-team-alerts/package.json frontend-it-team-alerts/package-lock.json ./frontend-it-team-alerts/
COPY frontend-developer-user/package.json frontend-developer-user/package-lock.json ./frontend-developer-user/
COPY frontend-eisenhower-tasks/package.json frontend-eisenhower-tasks/package-lock.json ./frontend-eisenhower-tasks/
COPY frontend-theater-volunteer/package.json frontend-theater-volunteer/package-lock.json ./frontend-theater-volunteer/
COPY frontend-adhd-reminders/package.json frontend-adhd-reminders/package-lock.json ./frontend-adhd-reminders/
COPY frontend-mind/package.json frontend-mind/package-lock.json ./frontend-mind/

RUN for app in $FRONTEND_APPS; do npm ci --prefix "$app" --no-audit --no-fund; done

COPY frontend-website ./frontend-website
COPY frontend-mission-control ./frontend-mission-control
COPY frontend-volunteer-coordinator ./frontend-volunteer-coordinator
COPY frontend-event-planner ./frontend-event-planner
COPY frontend-it-team-alerts ./frontend-it-team-alerts
COPY frontend-developer-user ./frontend-developer-user
COPY frontend-eisenhower-tasks ./frontend-eisenhower-tasks
COPY frontend-theater-volunteer ./frontend-theater-volunteer
COPY frontend-adhd-reminders ./frontend-adhd-reminders
COPY frontend-mind ./frontend-mind

RUN for app in $FRONTEND_APPS; do npm run build --prefix "$app"; done

FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/backend/.venv/bin:$PATH \
    DATABASE_URL=sqlite+aiosqlite:////data/notifiq.db \
    SPA_ROOT=/srv/notifiq/frontends/frontend-website/dist \
    SPA_MOUNTS={"/mission-control":"/srv/notifiq/frontends/frontend-mission-control/dist","/volunteer-coordinator":"/srv/notifiq/frontends/frontend-volunteer-coordinator/dist","/event-planner":"/srv/notifiq/frontends/frontend-event-planner/dist","/duty-pager":"/srv/notifiq/frontends/frontend-it-team-alerts/dist","/developer-user":"/srv/notifiq/frontends/frontend-developer-user/dist","/tasks":"/srv/notifiq/frontends/frontend-eisenhower-tasks/dist","/stage-manager":"/srv/notifiq/frontends/frontend-theater-volunteer/dist","/adhd-reminders":"/srv/notifiq/frontends/frontend-adhd-reminders/dist","/mindful":"/srv/notifiq/frontends/frontend-mind/dist"}

WORKDIR /app/backend

COPY --from=backend-builder /app/backend /app/backend
COPY --from=frontend-builder /app/frontend-website/dist /srv/notifiq/frontends/frontend-website/dist
COPY --from=frontend-builder /app/frontend-mission-control/dist /srv/notifiq/frontends/frontend-mission-control/dist
COPY --from=frontend-builder /app/frontend-volunteer-coordinator/dist /srv/notifiq/frontends/frontend-volunteer-coordinator/dist
COPY --from=frontend-builder /app/frontend-event-planner/dist /srv/notifiq/frontends/frontend-event-planner/dist
COPY --from=frontend-builder /app/frontend-it-team-alerts/dist /srv/notifiq/frontends/frontend-it-team-alerts/dist
COPY --from=frontend-builder /app/frontend-developer-user/dist /srv/notifiq/frontends/frontend-developer-user/dist
COPY --from=frontend-builder /app/frontend-eisenhower-tasks/dist /srv/notifiq/frontends/frontend-eisenhower-tasks/dist
COPY --from=frontend-builder /app/frontend-theater-volunteer/dist /srv/notifiq/frontends/frontend-theater-volunteer/dist
COPY --from=frontend-builder /app/frontend-adhd-reminders/dist /srv/notifiq/frontends/frontend-adhd-reminders/dist
COPY --from=frontend-builder /app/frontend-mind/dist /srv/notifiq/frontends/frontend-mind/dist

VOLUME ["/data"]

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
