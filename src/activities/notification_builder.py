import apprise
from src.db.session import get_db_session
from src.db.repositories import IntegrationRepository, SubscriptionRepository
from src.config import get_settings


class NotificationBuilder:
    """Build Apprise instances from user integrations"""
    
    @staticmethod
    async def build_for_user(user_id: int, tags: list[str] | None = None) -> apprise.Apprise:
        """Build Apprise instance for a single user's integrations"""
        async for session in get_db_session():
            repo = IntegrationRepository(session)
            integrations = await repo.get_by_user(user_id)
            
            apobj = apprise.Apprise()
            for integration in integrations:
                if not integration.is_active:
                    continue
                
                # Filter by tags if specified
                if tags and integration.tag not in tags:
                    continue
                
                # Add integration with tag
                apobj.add(integration.apprise_url, tag=integration.tag)
            
            return apobj
    
    @staticmethod
    async def build_for_event_subscribers(
        event_id: int,
        selector_tags: list[str] | None = None
    ) -> dict[int, apprise.Apprise]:
        """Build Apprise instances for all event subscribers
        
        Returns: {user_id: apprise_instance}
        """
        async for session in get_db_session():
            sub_repo = SubscriptionRepository(session)
            int_repo = IntegrationRepository(session)
            
            # Get all subscriptions for event
            subscriptions = await sub_repo.get_by_event(event_id)
            
            result = {}
            for subscription in subscriptions:
                # Get integration IDs from selectors
                integration_ids = [
                    selector.integration_id 
                    for selector in subscription.selectors
                    if selector.integration_id is not None
                ]
                
                # Get selector tags
                sub_tags = [
                    selector.tag 
                    for selector in subscription.selectors
                    if selector.tag is not None
                ]
                
                # Filter by selector_tags if specified
                if selector_tags:
                    sub_tags = [t for t in sub_tags if t in selector_tags]
                
                # Build Apprise instance
                apobj = apprise.Apprise()
                
                # Add integrations by ID
                for int_id in integration_ids:
                    integration = await int_repo.get_by_id(int_id)
                    if integration and integration.is_active:
                        apobj.add(integration.apprise_url, tag=integration.tag)
                
                # Add integrations by tag
                if sub_tags:
                    user_integrations = await int_repo.get_by_user(subscription.user_id)
                    for integration in user_integrations:
                        if integration.is_active and integration.tag in sub_tags:
                            apobj.add(integration.apprise_url, tag=integration.tag)
                
                result[subscription.user_id] = apobj
            
            return result
    
    @staticmethod
    def build_fallback_email(email: str, is_verified: bool = False) -> apprise.Apprise:
        """Build fallback email notification for users without integrations
        
        Uses service-level SMTP to send TO user's email address.
        Service sends FROM Gmail (unverified) or ProtonMail (verified).
        """
        settings = get_settings()
        apobj = apprise.Apprise()
        
        if is_verified and settings.proton_user:
            # Send FROM service ProtonMail TO user's email
            apobj.add(
                f'mailtos://?to={email}'
                f'&smtp={settings.smtp_server_proton}'
                f'&user={settings.proton_user}'
                f'&pass={settings.proton_app_password}'
                f'&from=Soonish <{settings.proton_user}>'
            )
        elif settings.gmail_user:
            # Send FROM service Gmail TO user's email
            apobj.add(
                f'mailtos://?to={email}'
                f'&smtp={settings.smtp_server_gmail}'
                f'&user={settings.gmail_user}'
                f'&pass={settings.gmail_app_password}'
                f'&from=Soonish <{settings.gmail_user}>'
            )
        
        return apobj
