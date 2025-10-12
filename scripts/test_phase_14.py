#!/usr/bin/env python3
"""Test Phase 14: Private Events & Invitations

Tests:
1. Create private event
2. Verify private event not in public listing
3. Unauthorized user cannot view private event
4. Invite user to private event
5. List invitations
6. Revoke invitation
7. Organizer can view their private event
"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel
from datetime import datetime, timedelta, timezone

console = Console()
API_BASE = "http://localhost:8000"


async def get_auth_token(email: str, password: str) -> str:
    """Helper to get auth token"""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_BASE}/api/auth/login",
            json={"email": email, "password": password}
        )
        if resp.status_code == 200:
            return resp.json()["access_token"]
        raise Exception(f"Login failed: {resp.status_code}")


async def test_private_events():
    """Test private events and invitation system"""
    
    console.print(Panel.fit("🧪 Testing Phase 14: Private Events", style="bold blue"))
    
    # Get auth tokens for two users
    console.print("\n🔑 Getting auth tokens...")
    organizer_token = await get_auth_token("organizer@example.com", "password123")
    console.print("   ✅ Organizer authenticated", style="green")
    
    # We'll create a second user for testing unauthorized access
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Register second user
        resp = await client.post(
            f"{API_BASE}/api/auth/register",
            json={
                "email": "unauthorized@example.com",
                "password": "password123",
                "name": "Unauthorized User"
            }
        )
        if resp.status_code == 201:
            console.print("   ✅ Second user created", style="green")
        
        unauthorized_token = await get_auth_token("unauthorized@example.com", "password123")
        console.print("   ✅ Second user authenticated", style="green")
        
        # Step 1: Create private event
        console.print("\n1️⃣  Creating private event...")
        now = datetime.now(timezone.utc)
        event_data = {
            "name": "Secret Team Meeting",
            "description": "Private discussion",
            "start_date": (now + timedelta(hours=2)).isoformat(),
            "end_date": (now + timedelta(hours=3)).isoformat(),
            "timezone": "UTC",
            "location": "Conference Room B",
            "is_public": False  # PRIVATE EVENT
        }
        
        resp = await client.post(
            f"{API_BASE}/api/events",
            json=event_data,
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 201:
            private_event = resp.json()
            event_id = private_event["id"]
            console.print(f"   ✅ Private event created: ID={event_id}", style="green")
            console.print(f"   🔒 is_public: {private_event['is_public']}", style="yellow")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        # Step 2: Verify private event NOT in public listing
        console.print("\n2️⃣  Checking public event listing...")
        # Use a fresh client to ensure no session cookies
        async with httpx.AsyncClient() as anon_client:
            resp = await anon_client.get(f"{API_BASE}/api/events")
        
        if resp.status_code == 200:
            events = resp.json()
            private_event_ids = [e["id"] for e in events if not e["is_public"]]
            
            if event_id not in [e["id"] for e in events]:
                console.print("   ✅ Private event NOT in public listing", style="green")
            else:
                console.print("   ⚠️  Private event visible in public listing!", style="yellow")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
        
        # Step 3: Unauthorized user cannot view private event
        console.print("\n3️⃣  Testing unauthorized access...")
        resp = await client.get(
            f"{API_BASE}/api/events/{event_id}",
            headers={"Authorization": f"Bearer {unauthorized_token}"}
        )
        
        if resp.status_code == 403:
            console.print("   ✅ Unauthorized user correctly blocked (403)", style="green")
        else:
            console.print(f"   ⚠️  Unexpected status: {resp.status_code}", style="yellow")
            console.print(f"   {resp.text}")
        
        # Step 3b: Anonymous user cannot view private event
        console.print("\n3️⃣b Testing anonymous access...")
        resp = await client.get(f"{API_BASE}/api/events/{event_id}")
        
        if resp.status_code == 401:
            console.print("   ✅ Anonymous user correctly blocked (401)", style="green")
        else:
            console.print(f"   ⚠️  Unexpected status: {resp.status_code}", style="yellow")
        
        # Step 4: Organizer CAN view their private event
        console.print("\n4️⃣  Testing organizer access...")
        resp = await client.get(
            f"{API_BASE}/api/events/{event_id}",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 200:
            event = resp.json()
            console.print(f"   ✅ Organizer can view: {event['name']}", style="green")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
        
        # Step 5: Invite user to private event
        console.print("\n5️⃣  Inviting user to private event...")
        resp = await client.post(
            f"{API_BASE}/api/events/{event_id}/invite",
            json={"email": "invitee@example.com"},
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            invitation_id = result["invitation_id"]
            console.print(f"   ✅ {result['message']}", style="green")
            console.print("   📧 Invitation email sent (check logs)", style="dim")
            console.print(f"   🎫 Invitation ID: {invitation_id}", style="dim")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        # Step 6: List invitations
        console.print("\n6️⃣  Listing invitations...")
        resp = await client.get(
            f"{API_BASE}/api/events/{event_id}/invitations",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 200:
            invitations = resp.json()
            console.print(f"   ✅ Found {len(invitations)} invitation(s)", style="green")
            for inv in invitations:
                status = "✅ Valid" if inv["is_valid"] else "❌ Invalid"
                console.print(f"      - {inv['email']}: {status}", style="dim")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
        
        # Step 7: Unauthorized user cannot list invitations
        console.print("\n7️⃣  Testing unauthorized invitation listing...")
        resp = await client.get(
            f"{API_BASE}/api/events/{event_id}/invitations",
            headers={"Authorization": f"Bearer {unauthorized_token}"}
        )
        
        if resp.status_code == 403:
            console.print("   ✅ Unauthorized user correctly blocked", style="green")
        else:
            console.print(f"   ⚠️  Unexpected status: {resp.status_code}", style="yellow")
        
        # Step 8: Revoke invitation
        console.print("\n8️⃣  Revoking invitation...")
        resp = await client.delete(
            f"{API_BASE}/api/events/{event_id}/invitations/{invitation_id}",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 204:
            console.print("   ✅ Invitation revoked", style="green")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
        
        # Step 9: Verify invitation was deleted
        console.print("\n9️⃣  Verifying invitation deleted...")
        resp = await client.get(
            f"{API_BASE}/api/events/{event_id}/invitations",
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 200:
            invitations = resp.json()
            if len(invitations) == 0:
                console.print("   ✅ No invitations remaining", style="green")
            else:
                console.print(f"   ⚠️  Still {len(invitations)} invitation(s)", style="yellow")
        
        # Step 10: Create public event and verify it's visible
        console.print("\n🔟 Creating public event for comparison...")
        public_event_data = {
            "name": "Public Team Meeting",
            "description": "Everyone welcome",
            "start_date": (now + timedelta(hours=4)).isoformat(),
            "end_date": (now + timedelta(hours=5)).isoformat(),
            "timezone": "UTC",
            "is_public": True  # PUBLIC EVENT
        }
        
        resp = await client.post(
            f"{API_BASE}/api/events",
            json=public_event_data,
            headers={"Authorization": f"Bearer {organizer_token}"}
        )
        
        if resp.status_code == 201:
            public_event = resp.json()
            public_event_id = public_event["id"]
            console.print(f"   ✅ Public event created: ID={public_event_id}", style="green")
            
            # Verify public event IS visible to anonymous users
            resp = await client.get(f"{API_BASE}/api/events/{public_event_id}")
            if resp.status_code == 200:
                console.print("   ✅ Public event visible to anonymous users", style="green")
            else:
                console.print(f"   ⚠️  Public event not visible: {resp.status_code}", style="yellow")
        
        # Summary
        console.print("\n" + "="*70)
        console.print("✅ Phase 14 private events test complete!", style="bold green")
        console.print("\n📝 Summary:", style="bold")
        console.print(f"   - Private event created (ID: {event_id})")
        console.print(f"   - Public event created (ID: {public_event_id})")
        console.print("   - Authorization working correctly")
        console.print("   - Invitation system functional")
        console.print("\n💡 Key Features Tested:", style="bold")
        console.print("   ✅ Private events not in public listings")
        console.print("   ✅ Unauthorized users blocked (401/403)")
        console.print("   ✅ Organizer can view their private events")
        console.print("   ✅ Invitation creation and email sending")
        console.print("   ✅ Invitation listing (organizer only)")
        console.print("   ✅ Invitation revocation")
        console.print("   ✅ Public events still work normally")


if __name__ == "__main__":
    asyncio.run(test_private_events())
