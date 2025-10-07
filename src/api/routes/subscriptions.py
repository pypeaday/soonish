from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from temporalio.client import Client

from src.api.schemas import SubscribeRequest
from src.api.dependencies import get_session, get_temporal_client, get_current_user_optional
from src.db.models import User, Integration, Subscription, SubscriptionSelector, UnsubscribeToken
from src.db.repositories import EventRepository, UserRepository, SubscriptionRepository

router = APIRouter(prefix="/api/events", tags=["subscriptions"])


@router.post("/{event_id}/subscribe", status_code=201)
async def subscribe_to_event(
    event_id: int,
    request: SubscribeRequest,
    session: AsyncSession = Depends(get_session),
    temporal_client: Client = Depends(get_temporal_client),
    current_user: User | None = Depends(get_current_user_optional)
):
    """Subscribe to an event (anonymous or authenticated)"""
    repo_event = EventRepository(session)
    repo_user = UserRepository(session)
    repo_sub = SubscriptionRepository(session)
    
    # Get event
    event = await repo_event.get_by_id(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    if not event.is_public and not current_user:
        raise HTTPException(status_code=403, detail="Event is private")
    
    # Handle anonymous vs authenticated
    if not current_user:
        # Anonymous: create or get user by email
        if not request.email:
            raise HTTPException(status_code=400, detail="Email required")
        
        # TODO: SECURITY - add some verification or rate limiting here to avoid spam
        user, created = await repo_user.get_or_create_by_email(
            email=request.email,
            name=request.name or request.email.split('@')[0]
        )
        
        # Create default mailto integration
        if created:
            integration = Integration(
                user_id=user.id,
                name="Email",
                tag="email",
                is_active=True
            )
            integration.apprise_url = f"mailto://{user.email}"
            session.add(integration)
            await session.flush()
    else:
        user = current_user
    
    # Check for existing subscription
    existing = await repo_sub.get_by_event_and_user(event_id, user.id)
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    # Create subscription
    subscription = Subscription(event_id=event_id, user_id=user.id)
    subscription = await repo_sub.create(subscription)
    await session.flush()
    
    # Create selectors
    selectors_data = []
    if current_user and (request.integration_ids or request.tags):
        # Authenticated: explicit selectors
        for int_id in (request.integration_ids or []):
            selector = SubscriptionSelector(
                subscription_id=subscription.id,
                integration_id=int_id
            )
            session.add(selector)
            selectors_data.append({"integration_id": int_id, "tag": None})
        
        for tag in (request.tags or []):
            selector = SubscriptionSelector(
                subscription_id=subscription.id,
                tag=tag
            )
            session.add(selector)
            selectors_data.append({"integration_id": None, "tag": tag})
    else:
        # Anonymous: default to all integrations via "email" tag
        selector = SubscriptionSelector(
            subscription_id=subscription.id,
            tag="email"
        )
        session.add(selector)
        selectors_data.append({"integration_id": None, "tag": "email"})
    
    # Signal workflow
    try:
        workflow_handle = temporal_client.get_workflow_handle(event.temporal_workflow_id)
        await workflow_handle.signal("participant_added", {
            "subscription_id": subscription.id,
            "user_id": user.id
        })
    except Exception:
        session.rollback()
        pass  # Non-critical if signal fails
    
    await session.commit()

    # Generate unsubscribe token
    token = UnsubscribeToken.generate(subscription.id)
    session.add(token)
    await session.commit()
    
    return {
        "success": True,
        "data": {
            "subscription_id": subscription.id,
            "event_id": event_id,
            "user_id": user.id,
            "selectors": selectors_data
        },
        "message": "Subscribed successfully. Check your email for confirmation."
    }
