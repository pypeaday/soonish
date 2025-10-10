#!/usr/bin/env python3
"""Setup test data via API for integration testing

Creates users and integrations through the API to dogfood the workflow.
Other test scripts can then discover and use this data.
"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel
import os

GOTIFY_URL = os.environ.get("GOTIFY_URL")
GOTIFY_API_TOKEN = os.environ.get("GOTIFY_TOKEN")

console = Console()
API_BASE = "http://localhost:8000"


async def setup_test_data():
    """Create test users and integrations via API"""
    
    console.print(Panel.fit("🔧 Setting up test data via API", style="bold blue"))
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        created_data = {
            "users": [],
            "integrations": []
        }
        
        # Create test users
        console.print("\n👥 Creating test users...")
        test_users = [
            {
                "email": "test1@example.com",
                "password": "password123",
                "name": "Test User 1"
            },
            {
                "email": "test2@example.com",
                "password": "password123",
                "name": "Test User 2"
            },
            {
                "email": "test3@example.com",
                "password": "password123",
                "name": "Test User 3"
            }
        ]
        
        for user_data in test_users:
            # Try to register
            resp = await client.post(f"{API_BASE}/api/auth/register", json=user_data)
            if resp.status_code == 201:
                console.print(f"  ✅ Created user: {user_data['email']}", style="green")
            elif resp.status_code == 400 and "already exists" in resp.text.lower():
                console.print(f"  ℹ️  User exists: {user_data['email']}", style="dim")
            else:
                console.print(f"  ⚠️  Failed to create {user_data['email']}: {resp.status_code}", style="yellow")
                continue
            
            # Login to get token
            resp = await client.post(f"{API_BASE}/api/auth/login", json={
                "email": user_data["email"],
                "password": user_data["password"]
            })
            if resp.status_code != 200:
                console.print(f"  ❌ Failed to login as {user_data['email']}", style="red")
                continue
            
            token = resp.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Get user info
            resp = await client.get(f"{API_BASE}/api/users/me", headers=headers)
            if resp.status_code == 200:
                user_info = resp.json()
                created_data["users"].append({
                    "id": user_info["id"],
                    "email": user_info["email"],
                    "name": user_info["name"],
                    "token": token
                })
            
            # Create Gotify integration for each user
            console.print(f"  📱 Creating Gotify integration for {user_data['email']}...")
            resp = await client.post(
                f"{API_BASE}/api/integrations",
                headers=headers,
                json={
                    "name": f"Gotify - {user_data['name']}",
                    "apprise_url": f"gotify://{GOTIFY_URL}/{GOTIFY_API_TOKEN}?priority=high",
                    "tag": "urgent"
                }
            )
            if resp.status_code == 201:
                integration = resp.json()
                created_data["integrations"].append({
                    "id": integration["id"],
                    "user_id": user_info["id"],  # Get from user_info, not integration response
                    "name": integration["name"],
                    "tag": integration["tag"]
                })
                console.print(f"    ✅ Created integration ID: {integration['id']}", style="green")
            else:
                console.print(f"    ⚠️  Failed to create integration: {resp.status_code}", style="yellow")
        
        # Summary
        console.print("\n" + "="*60)
        console.print(Panel.fit("✅ Test data setup complete!", style="bold green"))
        console.print("\nCreated Data:", style="bold")
        console.print(f"  👥 Users: {len(created_data['users'])}")
        for user in created_data["users"]:
            console.print(f"    • ID {user['id']}: {user['email']}", style="dim")
        console.print(f"  📱 Integrations: {len(created_data['integrations'])}")
        for integration in created_data["integrations"]:
            console.print(f"    • ID {integration['id']}: {integration['name']} (user {integration['user_id']})", style="dim")
        
        console.print("\n💡 Test scripts can now discover this data via API", style="bold cyan")
        console.print("   Example: GET /api/users/me to get current user")
        console.print("   Example: GET /api/integrations to list user's integrations")
        
        return created_data


if __name__ == "__main__":
    try:
        result = asyncio.run(setup_test_data())
    except Exception as e:
        console.print(f"\n❌ Setup failed: {e}", style="bold red")
        exit(1)
