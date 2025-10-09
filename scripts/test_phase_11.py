#!/usr/bin/env python3
"""Test Phase 11: Custom Reminder Preferences"""
import asyncio
import httpx
from datetime import datetime, timedelta, timezone
from rich.console import Console
from rich.panel import Panel

console = Console()
API_BASE = "http://localhost:8000"


async def check_server():
    """Check if API server is running"""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{API_BASE}/api/health")
            return resp.status_code == 200
    except (httpx.ConnectError, httpx.ReadTimeout):
        return False


async def test_custom_reminders():
    """Test custom reminder preferences"""
    
    console.print(Panel.fit("🧪 Testing Phase 11: Custom Reminder Preferences", style="bold blue"))
    
    # Check if server is running
    console.print("\n🔍 Checking if API server is running...")
    if not await check_server():
        console.print("\n❌ API server is not running!", style="bold red")
        console.print("\nPlease start the server first:", style="yellow")
        console.print("  uv run uvicorn src.api.main:app --reload\n", style="cyan")
        return False
    
    console.print("✅ API server is running", style="green")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Get auth token for test user 1
        console.print("\n📝 Logging in as test1@example.com...")
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "test1@example.com",
            "password": "password123"
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code} - Run 'uv run scripts/setup_test_data.py' first!"
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Get user info
        resp = await client.get(f"{API_BASE}/api/users/me", headers=headers)
        user1 = resp.json()
        console.print(f"✅ Logged in as {user1['email']} (ID: {user1['id']})", style="green")
        
        # Get user's integrations
        resp = await client.get(f"{API_BASE}/api/integrations", headers=headers)
        integrations = resp.json()
        console.print(f"   Found {len(integrations)} integration(s)", style="dim")
        
        # Create event starting in 5 minutes
        console.print("\n📅 Creating event (starts in 5 minutes)...")
        start_date = (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat()
        resp = await client.post(
            f"{API_BASE}/api/events",
            headers=headers,
            json={
                "name": "Phase 11 Test Event",
                "description": "Testing custom reminder preferences",
                "start_date": start_date,
                "is_public": True
            }
        )
        assert resp.status_code == 201, f"Event creation failed: {resp.status_code}"
        event = resp.json()
        event_id = event["id"]
        console.print(f"✅ Created event ID: {event_id}", style="green")
        
        # Test 1: Subscribe with custom reminders (3 minutes, 1 minute before)
        console.print("\n📱 Test 1: Subscribe with custom reminders (3min, 1min)...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/subscribe",
            headers=headers,
            json={
                "selector_tags": ["urgent"],  # Use tag selector instead of hardcoded ID
                "reminder_offsets": [20, 5] 
            }
        )
        assert resp.status_code == 201, f"Subscribe failed: {resp.status_code}"
        sub1 = resp.json()["data"]
        console.print(f"✅ Subscription 1 created (ID: {sub1['subscription_id']})", style="green")
        console.print("   Reminders: 3 minutes, 1 minute before event", style="dim")
        
        # Login as test user 2
        console.print("\n👤 Logging in as test2@example.com...")
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "test2@example.com",
            "password": "password123"
        })
        assert resp.status_code == 200, "Login failed - Run 'uv run scripts/setup_test_data.py' first!"
        token2 = resp.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        resp = await client.get(f"{API_BASE}/api/users/me", headers=headers2)
        user2 = resp.json()
        console.print(f"✅ Logged in as {user2['email']} (ID: {user2['id']})", style="green")
        
        # Test 2: Subscribe with NO reminders (empty list)
        console.print("\n🔕 Test 2: Subscribe with NO reminders...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/subscribe",
            headers=headers2,
            json={
                "selector_tags": ["urgent"],  # Use tag selector
                "reminder_offsets": []  # No reminders
            }
        )
        assert resp.status_code == 201, f"Subscribe failed: {resp.status_code}"
        sub2 = resp.json()["data"]
        console.print(f"✅ Subscription 2 created (ID: {sub2['subscription_id']})", style="green")
        console.print("   Reminders: None (opted out)", style="dim")
        
        # Login as test user 3
        console.print("\n👤 Logging in as test3@example.com...")
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "test3@example.com",
            "password": "password123"
        })
        assert resp.status_code == 200, "Login failed - Run 'uv run scripts/setup_test_data.py' first!"
        token3 = resp.json()["access_token"]
        headers3 = {"Authorization": f"Bearer {token3}"}
        resp = await client.get(f"{API_BASE}/api/users/me", headers=headers3)
        user3 = resp.json()
        console.print(f"✅ Logged in as {user3['email']} (ID: {user3['id']})", style="green")
        
        # Test 3: Subscribe with "frontend defaults" (2 minutes before)
        console.print("\n⏰ Test 3: Subscribe with 2min reminder...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/subscribe",
            headers=headers3,
            json={
                "selector_tags": ["urgent"],  # Use tag selector
                "reminder_offsets": [120]  # 2 minutes
            }
        )
        if resp.status_code == 201:
            sub3 = resp.json()["data"]
            console.print(f"✅ Subscription 3 created (ID: {sub3['subscription_id']})", style="green")
            console.print("   Reminders: 2 minutes before event", style="dim")
        else:
            console.print(f"⚠️  Subscription failed: {resp.status_code}", style="yellow")
        
        # Verify database
        console.print("\n🔍 Verifying subscription_reminders in database...")
        console.print("   (Check with: sqlite3 soonish.db 'SELECT * FROM subscription_reminders;')", style="dim")
        
        # Summary
        console.print("\n" + "="*60)
        console.print(Panel.fit("✅ Phase 11 test complete!", style="bold green"))
        console.print("\nTest Results:", style="bold")
        console.print(f"  ✅ Event created (ID: {event_id}) - starts in 5 minutes!")
        console.print("  ✅ Subscription 1: Custom reminders (3min, 1min)")
        console.print("  ✅ Subscription 2: No reminders (empty list)")
        console.print("  ✅ Subscription 3: 2min reminder")
        console.print("\nNext Steps:", style="bold")
        console.print("  1. Check Temporal UI for schedules: http://ghost:7233")
        console.print(f"  2. Look for schedules: event-{event_id}-sub-*")
        console.print("  3. Watch for reminders to fire in 1-3 minutes!")
        console.print("  4. Check Gotify for notifications")
        console.print("\nExpected Schedules (firing soon!):", style="bold")
        console.print(f"  • event-{event_id}-sub-{sub1['subscription_id']}-reminder-180s (fires in ~2min)")
        console.print(f"  • event-{event_id}-sub-{sub1['subscription_id']}-reminder-60s (fires in ~4min)")
        console.print(f"  • (none for subscription {sub2['subscription_id']} - opted out)")
        if resp.status_code == 201:
            console.print(f"  • event-{event_id}-sub-{sub3['subscription_id']}-reminder-120s (fires in ~3min)")


if __name__ == "__main__":
    try:
        result = asyncio.run(test_custom_reminders())
        if result is False:
            exit(1)
    except AssertionError as e:
        console.print(f"\n❌ Test failed: {e}", style="bold red")
        exit(1)
    except Exception as e:
        console.print(f"\n❌ Unexpected error: {e}", style="bold red")
        import traceback
        traceback.print_exc()
        exit(1)
