"""Test notification system with real integrations"""
import asyncio
import os
from src.db.session import get_db_session
from src.db.repositories import UserRepository, IntegrationRepository, EventRepository
from src.activities.notification_builder import NotificationBuilder
from src.activities.notifications import send_notification, send_notification_to_subscribers
from temporalio.testing import ActivityEnvironment


async def setup_real_integrations():
    """Setup real integrations for dogfooding (optional)
    
    Set these environment variables to test with real services:
    - GOTIFY_URL: Your Gotify server URL (e.g., https://gotify.paynepride.com)
    - GOTIFY_TOKEN: Your Gotify API token
    """
    gotify_url = os.getenv("GOTIFY_URL")
    gotify_token = os.getenv("GOTIFY_TOKEN")
    
    if not gotify_url or not gotify_token:
        print("⚠️  No real integrations configured. Set GOTIFY_URL and GOTIFY_TOKEN to test with real notifications.")
        print("   For now, testing with mock data from init_db.py\n")
        return False
    
    print(f"✅ Configuring real Gotify integration: {gotify_url}")
    
    async for session in get_db_session():
        int_repo = IntegrationRepository(session)
        user_repo = UserRepository(session)
        
        # Update organizer's Gotify integration with real URL
        user = await user_repo.get_by_email("organizer@example.com")
        if user:
            integrations = await int_repo.get_by_user(user.id)
            for integration in integrations:
                if integration.name == "Gotify Server":
                    # Update with real Gotify URL
                    integration.apprise_url = f"gotify://{gotify_url.replace('https://', '').replace('http://', '')}/{gotify_token}/?priority=normal"
                    await session.commit()
                    print(f"   Updated integration: {integration.name}\n")
                    return True
    
    return False


async def test_notification_builder():
    """Test building Apprise instances from database"""
    print("Testing NotificationBuilder...")
    
    async for session in get_db_session():
        # Get organizer user (has Gotify integration)
        user_repo = UserRepository(session)
        user = await user_repo.get_by_email("organizer@example.com")
        
        if not user:
            print("❌ Organizer user not found. Run scripts/init_db.py first.")
            return
        
        # Build Apprise instance
        apobj = await NotificationBuilder.build_for_user(user.id)
        print(f"✅ Built Apprise instance with {len(apobj)} integrations")
        
        # List integrations
        int_repo = IntegrationRepository(session)
        integrations = await int_repo.get_by_user(user.id)
        for integration in integrations:
            print(f"  - {integration.name} ({integration.tag})")


async def test_send_notification():
    """Test sending notification to a user"""
    print("\nTesting send_notification activity...")
    
    async for session in get_db_session():
        user_repo = UserRepository(session)
        # Use organizer who has the real Gotify integration configured
        user = await user_repo.get_by_email("organizer@example.com")
        
        if not user:
            print("❌ Organizer user not found")
            return
        
        # Run activity in test environment
        env = ActivityEnvironment()
        result = await env.run(
            send_notification,
            user.id,
            "Test Notification",
            "This is a test notification from Soonish!",
            "info"
        )
            
        print(f"✅ Notification result: {result}")
        if result["success"] > 0:
            print(f"  Sent to channels: {result['channels']}")
        if result["errors"]:
            print(f"  Errors: {result['errors']}")


async def test_send_to_subscribers():
    """Test sending notification to event subscribers
    
    Note: This will only send to subscribers with valid integrations.
    The subscriber user has a mailto:// integration which requires SMTP config.
    """
    print("\nTesting send_notification_to_subscribers activity...")
    print("⚠️  Note: Subscribers with email-only integrations will be skipped (no SMTP configured)")
    
    async for session in get_db_session():
        event_repo = EventRepository(session)
        events = await event_repo.list_public_events(limit=1)
        
        if not events:
            print("❌ No events found")
            return
        
        event = events[0]
        
        # Check if event has any subscribers with non-email integrations
        from src.db.repositories import SubscriptionRepository
        sub_repo = SubscriptionRepository(session)
        subscriptions = await sub_repo.get_by_event(event.id)
        
        print(f"  Event '{event.name}' has {len(subscriptions)} subscriber(s)")
        
        # For now, just report what would happen without actually sending
        # to avoid hanging on email integrations
        for sub in subscriptions:
            int_repo = IntegrationRepository(session)
            integrations = await int_repo.get_by_user(sub.user_id)
            for integration in integrations:
                integration_type = "email" if "mailto" in integration.apprise_url else "other"
                print(f"    - User {sub.user_id}: {integration.name} ({integration_type})")
        
        print("\n  ⏭️  Skipping actual send to avoid hanging on email integrations")
        print("     To test fanout, ensure subscribers have Gotify/other non-email integrations")


async def main():
    # Setup real integrations if env vars are set
    has_real_integrations = await setup_real_integrations()
    
    # Always test the builder
    await test_notification_builder()
    
    # Only test actual sending if we have real integrations configured
    if has_real_integrations:
        await test_send_notification()
        await test_send_to_subscribers()
    else:
        print("⏭️  Skipping send tests (no real integrations configured)")
        print("   To test actual sending, set GOTIFY_URL and GOTIFY_TOKEN environment variables")


if __name__ == "__main__":
    asyncio.run(main())
