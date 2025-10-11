#!/usr/bin/env python3
"""Test all Phase 15 integration types

Minimal test script showing all supported integration configurations.
Uses environment variables for sensitive values where appropriate.
"""

import asyncio
import httpx
import os
from datetime import datetime


API_BASE = os.getenv("API_BASE", "http://localhost:8000")


async def test_integration(client, headers, integration_type, config, name):
    """Test a single integration type"""
    print(f"\n{integration_type.upper()}")
    
    response = await client.post(
        f"{API_BASE}/api/integrations",
        json={
            "name": name,
            "integration_type": integration_type,
            "config": config,
            "tag": integration_type
        },
        headers=headers
    )
    
    if response.status_code == 201:
        integration = response.json()
        print(f"  ✅ Created: ID={integration['id']}, Type={integration['integration_type']}")
        return integration['id']
    else:
        print(f"  ❌ Failed: {response.status_code} - {response.text}")
        return None


async def main():
    print("=" * 60)
    print("Phase 15: All Integration Types Test")
    print("=" * 60)
    
    async with httpx.AsyncClient() as client:
        # Register and login
        email = f"test_all_{datetime.now().timestamp()}@example.com"
        password = "password123"
        
        await client.post(
            f"{API_BASE}/api/auth/register",
            json={"email": email, "password": password, "name": "Integration Test User"}
        )
        
        login_response = await client.post(
            f"{API_BASE}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        print(f"\n✅ Authenticated as {email}")
        
        # Test each integration type
        integration_ids = []
        
        # 1. Gotify
        gotify_id = await test_integration(
            client, headers, "gotify",
            {
                "server_url": os.getenv("GOTIFY_URL", "https://gotify.example.com"),
                "token": os.getenv("GOTIFY_TOKEN", "ABCDEFG123456"),
                "priority": "high"
            },
            "My Gotify Server"
        )
        if gotify_id:
            integration_ids.append(gotify_id)
        
        # 2. Email (SMTP)
        email_id = await test_integration(
            client, headers, "email",
            {
                "smtp_host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
                "smtp_port": int(os.getenv("SMTP_PORT", "587")),
                "smtp_user": os.getenv("SMTP_USER", "notifications@example.com"),
                "smtp_password": os.getenv("SMTP_PASSWORD", "app-password"),
                "from_email": os.getenv("SMTP_FROM", "notifications@example.com"),
                "to_email": os.getenv("SMTP_TO", "user@example.com"),
                "use_tls": True
            },
            "Email Notifications"
        )
        if email_id:
            integration_ids.append(email_id)
        
        # 3. Ntfy
        ntfy_id = await test_integration(
            client, headers, "ntfy",
            {
                "server_url": os.getenv("NTFY_URL", "https://ntfy.sh"),
                "topic": os.getenv("NTFY_TOPIC", "my-notifications"),
                "priority": "high"
            },
            "Ntfy Notifications"
        )
        if ntfy_id:
            integration_ids.append(ntfy_id)
        
        # 4. Discord
        discord_id = await test_integration(
            client, headers, "discord",
            {
                "webhook_url": os.getenv(
                    "DISCORD_WEBHOOK",
                    "https://discordapp.com/api/webhooks/1426539594924425328/CSeq-3NqNh5KBJodRzfNDdUP9wXAFlPVlxNj3hX0_KzpXZLxpPMgYqFEyFpsQerw1Hc4"
                )
            },
            "Discord Webhook"
        )
        if discord_id:
            integration_ids.append(discord_id)
            
            # Test Discord notification with custom message
            print("  📤 Testing Discord notification...")
            test_response = await client.post(
                f"{API_BASE}/api/integrations/{discord_id}/test",
                params={
                    "title": "🎉 Soonish Integration Test",
                    "body": "Your Discord integration is working perfectly! Phase 15 complete."
                },
                headers=headers
            )
            if test_response.status_code == 200:
                result = test_response.json()
                print(f"  ✅ Notification sent: {result.get('message')}")
            else:
                print(f"  ⚠️  Notification failed: {test_response.status_code}")
        
        # 5. Slack
        slack_id = await test_integration(
            client, headers, "slack",
            {
                "webhook_url": os.getenv(
                    "SLACK_WEBHOOK",
                    "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX"
                )
            },
            "Slack Webhook"
        )
        if slack_id:
            integration_ids.append(slack_id)
        
        # List all integrations
        print("\n" + "=" * 60)
        list_response = await client.get(
            f"{API_BASE}/api/integrations",
            headers=headers
        )
        
        if list_response.status_code == 200:
            integrations = list_response.json()
            print(f"✅ Created {len(integrations)} integration(s):")
            for integ in integrations:
                print(f"   - {integ['name']} ({integ['integration_type']}) [{integ['tag']}]")
        
        print("\n" + "=" * 60)
        print("✅ All integration types tested!")
        print("=" * 60)
        print("\nSupported types:")
        print("  - gotify: Self-hosted notification server")
        print("  - email: SMTP email notifications")
        print("  - ntfy: Self-hosted/cloud push notifications")
        print("  - discord: Discord webhook")
        print("  - slack: Slack webhook")


if __name__ == "__main__":
    asyncio.run(main())
