from temporalio import activity
from src.activities.notification_builder import NotificationBuilder
from src.db.session import get_db_session
from src.db.repositories import UserRepository
import logging

logger = logging.getLogger(__name__)


@activity.defn
async def send_notification(
    user_id: int,
    title: str,
    body: str,
    level: str = "info",  # info | warning | critical
    tags: list[str] | None = None
) -> dict:
    """Send notification to a single user
    
    Returns: {
        "success": int,
        "failed": int,
        "channels": list[str],
        "errors": list[str]
    }
    """
    try:
        # Build Apprise instance for user
        apobj = await NotificationBuilder.build_for_user(user_id, tags)
        
        # Check if user has any integrations
        if len(apobj) == 0:
            # Fallback to email
            async for session in get_db_session():
                user_repo = UserRepository(session)
                user = await user_repo.get_by_id(user_id)
                if user:
                    apobj = NotificationBuilder.build_fallback_email(
                        user.email,
                        user.is_verified
                    )
        
        # Send notification
        if len(apobj) > 0:
            result = apobj.notify(body=body, title=title)
            
            return {
                "success": 1 if result else 0,
                "failed": 0 if result else 1,
                "channels": [str(s) for s in apobj.urls()],
                "errors": [] if result else ["Notification failed"]
            }
        else:
            return {
                "success": 0,
                "failed": 1,
                "channels": [],
                "errors": ["No notification channels configured"]
            }
    
    except Exception as e:
        logger.error(f"Notification failed for user {user_id}: {e}")
        return {
            "success": 0,
            "failed": 1,
            "channels": [],
            "errors": [str(e)]
        }


@activity.defn
async def send_notification_to_subscribers(
    event_id: int,
    title: str,
    body: str,
    level: str = "info",
    selector_tags: list[str] | None = None
) -> dict:
    """Send notification to all event subscribers
    
    Returns: {
        "total_subscribers": int,
        "success": int,
        "failed": int,
        "details": list[dict]
    }
    """
    try:
        # Build Apprise instances for all subscribers
        subscribers = await NotificationBuilder.build_for_event_subscribers(
            event_id,
            selector_tags
        )
        
        total = len(subscribers)
        success = 0
        failed = 0
        details = []
        
        # Send to each subscriber
        for user_id, apobj in subscribers.items():
            try:
                if len(apobj) > 0:
                    result = apobj.notify(body=body, title=title)
                    if result:
                        success += 1
                        details.append({
                            "user_id": user_id,
                            "status": "success",
                            "channels": len(apobj)
                        })
                    else:
                        failed += 1
                        details.append({
                            "user_id": user_id,
                            "status": "failed",
                            "error": "Notification failed"
                        })
                else:
                    # No integrations, try fallback email
                    async for session in get_db_session():
                        user_repo = UserRepository(session)
                        user = await user_repo.get_by_id(user_id)
                        if user:
                            fallback = NotificationBuilder.build_fallback_email(
                                user.email,
                                user.is_verified
                            )
                            result = fallback.notify(body=body, title=title)
                            if result:
                                success += 1
                                details.append({
                                    "user_id": user_id,
                                    "status": "success",
                                    "channels": 1,
                                    "fallback": "email"
                                })
                            else:
                                failed += 1
                                details.append({
                                    "user_id": user_id,
                                    "status": "failed",
                                    "error": "Fallback email failed"
                                })
            except Exception as e:
                failed += 1
                details.append({
                    "user_id": user_id,
                    "status": "failed",
                    "error": str(e)
                })
        
        return {
            "total_subscribers": total,
            "success": success,
            "failed": failed,
            "details": details
        }
    
    except Exception as e:
        logger.error(f"Failed to send notifications for event {event_id}: {e}")
        return {
            "total_subscribers": 0,
            "success": 0,
            "failed": 0,
            "details": [],
            "error": str(e)
        }
