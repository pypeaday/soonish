from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.dependencies import get_session, get_current_user
from src.db.repositories import EventRepository, IntegrationRepository
from src.db.models import User

router = APIRouter(tags=["web"])


@router.get("/api/events", response_class=HTMLResponse)
async def get_events_html(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Return events as HTML fragments for HTMX"""
    repo = EventRepository(session)
    events = await repo.list_public_events(limit=50)
    
    if not events:
        return '<div class="card"><p>No events yet. Create your first event!</p></div>'
    
    html = ""
    for event in events:
        is_organizer = event.organizer_user_id == current_user.id
        html += f'''
        <div class="card">
            <h3>{event.name}</h3>
            <p>{event.description or "No description"}</p>
            <p><strong>Start:</strong> {event.start_date.strftime("%Y-%m-%d %H:%M")}</p>
            {f'<p><strong>Location:</strong> {event.location}</p>' if event.location else ''}
            <p><strong>Organizer:</strong> {"You" if is_organizer else "Other"}</p>
        </div>
        '''
    return html


@router.get("/api/integrations", response_class=HTMLResponse)
async def get_integrations_html(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """Return integrations as HTML fragments for HTMX"""
    repo = IntegrationRepository(session)
    integrations = await repo.get_by_user(current_user.id, active_only=False)
    
    if not integrations:
        return '<div class="card"><p>No integrations yet. Add your first notification channel!</p></div>'
    
    html = ""
    for integration in integrations:
        status = "✅ Active" if integration.is_active else "❌ Inactive"
        html += f'''
        <div class="card">
            <h3>{integration.name}</h3>
            <p><strong>Tag:</strong> {integration.tag}</p>
            <p><strong>Status:</strong> {status}</p>
            <button hx-post="/api/integrations/{integration.id}/test" 
                    hx-target="this" 
                    hx-swap="outerHTML"
                    class="secondary">Test</button>
        </div>
        '''
    return html
