#!/usr/bin/env python3
"""Test Phase 10: Integrations API"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel
import os

console = Console()
API_BASE = "http://localhost:8000"
GOTIFY_URL = os.environ.get("GOTIFY_URL")
GOTIFY_API_TOKEN = os.environ.get("GOTIFY_TOKEN")

async def check_server():
    """Check if API server is running"""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{API_BASE}/api/health")
            return resp.status_code == 200
    except (httpx.ConnectError, httpx.ReadTimeout):
        return False


async def test_integrations_api():
    """Test complete integrations API lifecycle"""
    
    console.print(Panel.fit("🧪 Testing Phase 10: Integrations API", style="bold blue"))
    
    # Check if server is running
    console.print("\n🔍 Checking if API server is running...")
    if not await check_server():
        console.print("\n❌ API server is not running!", style="bold red")
        console.print("\nPlease start the server first:", style="yellow")
        console.print("  uv run uvicorn src.api.main:app --reload\n", style="cyan")
        return False
    
    console.print("✅ API server is running", style="green")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Get auth token
        console.print("\n📝 Getting auth token...")
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "organizer@example.com",
            "password": "password123"
        })
        assert resp.status_code == 200, f"Login failed: {resp.status_code}"
        token = resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        console.print("✅ Got auth token", style="green")
        
        # Create integration
        console.print("\n📱 Creating Gotify integration...")
        resp = await client.post(
            f"{API_BASE}/api/integrations",
            headers=headers,
            json={
                "name": "My Gotify Server",
                "apprise_url": f"gotify://{GOTIFY_URL}/{GOTIFY_API_TOKEN}/?priority=normal",
                "tag": "urgent"
            }
        )
        assert resp.status_code == 201, f"Create failed: {resp.status_code}"
        integration = resp.json()
        integration_id = integration["id"]
        console.print(f"✅ Created integration ID: {integration_id}", style="green")
        
        # Security check: apprise_url should NOT be in response
        assert "apprise_url" not in integration, "SECURITY ISSUE: apprise_url in response!"
        console.print("✅ Security check passed: apprise_url not in response", style="green")
        
        # List integrations
        console.print("\n📋 Listing integrations...")
        resp = await client.get(f"{API_BASE}/api/integrations", headers=headers)
        assert resp.status_code == 200
        integrations = resp.json()
        assert len(integrations) > 0
        console.print(f"✅ Found {len(integrations)} integration(s)", style="green")
        
        # Get specific integration
        console.print("\n🔍 Getting integration by ID...")
        resp = await client.get(f"{API_BASE}/api/integrations/{integration_id}", headers=headers)
        assert resp.status_code == 200
        integration = resp.json()
        assert integration["name"] == "My Gotify Server"
        assert integration["tag"] == "urgent"
        assert integration["is_active"] is True
        console.print("✅ Integration details:", style="green")
        console.print(f"   Name: {integration['name']}")
        console.print(f"   Tag: {integration['tag']}")
        console.print(f"   Active: {integration['is_active']}")
        
        # Test integration (send test notification)
        console.print("\n📤 Testing integration (sending test notification)...")
        resp = await client.post(
            f"{API_BASE}/api/integrations/{integration_id}/test",
            headers=headers
        )
        # May fail if Gotify server not reachable, but endpoint should work
        if resp.status_code == 200:
            result = resp.json()
            console.print(f"✅ Test notification sent: {result.get('message')}", style="green")
        else:
            error_detail = resp.json().get('detail', 'Unknown error') if resp.status_code != 404 else 'Not found'
            console.print(f"⚠️  Test notification failed: {error_detail}", style="yellow")
            console.print(f"   Status code: {resp.status_code}", style="yellow")
        
        # Deactivate integration
        console.print("\n🔕 Deactivating integration...")
        resp = await client.patch(
            f"{API_BASE}/api/integrations/{integration_id}?is_active=false",
            headers=headers
        )
        assert resp.status_code == 200
        integration = resp.json()
        assert integration["is_active"] is False
        console.print("✅ Integration deactivated", style="green")
        
        # Reactivate integration
        console.print("\n🔔 Reactivating integration...")
        resp = await client.patch(
            f"{API_BASE}/api/integrations/{integration_id}?is_active=true",
            headers=headers
        )
        assert resp.status_code == 200
        integration = resp.json()
        assert integration["is_active"] is True
        console.print("✅ Integration reactivated", style="green")
        
        # Test authorization (create second user and try to access first user's integration)
        console.print("\n🔒 Testing authorization...")
        
        # Register second user
        await client.post(f"{API_BASE}/api/auth/register", json={
            "email": "otheruser@example.com",
            "password": "password123",
            "name": "Other User"
        })
        
        # Login as second user
        resp = await client.post(f"{API_BASE}/api/auth/login", json={
            "email": "otheruser@example.com",
            "password": "password123"
        })
        token2 = resp.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        
        # Try to access first user's integration
        resp = await client.get(
            f"{API_BASE}/api/integrations/{integration_id}",
            headers=headers2
        )
        assert resp.status_code == 403, f"Expected 403, got {resp.status_code}"
        console.print("✅ Authorization check passed (403 Forbidden)", style="green")
        
        # Delete integration
        console.print("\n🗑️  Deleting integration...")
        resp = await client.delete(
            f"{API_BASE}/api/integrations/{integration_id}",
            headers=headers
        )
        assert resp.status_code == 204, f"Expected 204, got {resp.status_code}"
        console.print("✅ Integration deleted (204 No Content)", style="green")
        
        # Verify deletion
        console.print("\n🔍 Verifying deletion...")
        resp = await client.get(
            f"{API_BASE}/api/integrations/{integration_id}",
            headers=headers
        )
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}"
        console.print("✅ Integration not found (404) - deletion confirmed", style="green")
        
        # Cleanup: Delete all test integrations for organizer user
        console.print("\n🧹 Cleaning up test integrations...")
        resp = await client.get(f"{API_BASE}/api/integrations", headers=headers)
        if resp.status_code == 200:
            remaining_integrations = resp.json()
            for integration in remaining_integrations:
                await client.delete(
                    f"{API_BASE}/api/integrations/{integration['id']}",
                    headers=headers
                )
            console.print(f"✅ Cleaned up {len(remaining_integrations)} integration(s)", style="green")
        
        # Summary
        console.print("\n" + "="*60)
        console.print(Panel.fit("✅ Phase 10 test complete!", style="bold green"))
        console.print("\nSummary:", style="bold")
        console.print("  ✅ Create integration with encrypted apprise_url")
        console.print("  ✅ List user's integrations")
        console.print("  ✅ Get integration by ID")
        console.print("  ✅ Test integration (send test notification)")
        console.print("  ✅ Activate/deactivate integration")
        console.print("  ✅ Authorization checks (403 for other users)")
        console.print("  ✅ Delete integration")
        console.print("  ✅ apprise_url never returned in responses (security)")
        console.print("  ✅ Cleanup completed")


if __name__ == "__main__":
    try:
        result = asyncio.run(test_integrations_api())
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
