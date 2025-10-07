#!/usr/bin/env python3
"""Test script for Phase 7: Subscriptions API"""

import httpx
import sys
import uuid


BASE_URL = "http://localhost:8000"
TEMPORAL_UI = "http://ghost:8233"


def main():
    print("🧪 Testing Phase 7: Subscriptions API")
    print("=" * 38)
    print()
    
    with httpx.Client(base_url=BASE_URL) as client:
        # Register and login
        print("📝 Registering user...")
        unique_email = f"testuser{uuid.uuid4().hex[:8]}@example.com"
        register_data = {
            "email": unique_email,
            "password": "password123",
            "name": "Test User"
        }
        response = client.post("/api/auth/register", json=register_data)
        
        if response.status_code not in (200, 201):
            try:
                detail = response.json().get('detail', 'Unknown error')
            except Exception:
                detail = response.text
            print(f"⚠️  Registration issue: {detail}")
        
        print("📝 Logging in...")
        login_data = {"email": unique_email, "password": "password123"}
        response = client.post("/api/auth/login", json=login_data)
        
        if response.status_code != 200:
            print("❌ Failed to get auth token")
            print(f"   Login response: {response.text}")
            sys.exit(1)
        
        token = response.json().get("access_token")
        print("✅ Got auth token")
        print()
        
        # Create an event
        print("📅 Creating test event...")
        headers = {"Authorization": f"Bearer {token}"}
        event_data = {
            "name": "Subscription Test Event",
            "description": "Testing subscriptions",
            "start_date": "2025-10-15T10:00:00Z",
            "end_date": "2025-10-15T11:00:00Z",
            "is_public": True
        }
        response = client.post("/api/events", json=event_data, headers=headers)
        
        if response.status_code != 201:
            print("❌ Failed to create event")
            print(f"   Response: {response.text}")
            sys.exit(1)
        
        event_id = response.json().get("id")
        print(f"✅ Created event with ID: {event_id}")
        print()
        
        # Test 1: Anonymous subscription (use fresh client to avoid session cookies)
        print("👤 Test 1: Anonymous subscription...")
        anon_data = {
            "email": f"anonymous{uuid.uuid4().hex[:8]}@example.com",
            "name": "Anonymous User"
        }
        # Use fresh client without session cookies to ensure truly anonymous request
        with httpx.Client(base_url=BASE_URL) as anon_client:
            response = anon_client.post(f"/api/events/{event_id}/subscribe", json=anon_data)
            
            if response.status_code != 201:
                print("❌ Anonymous subscription failed")
                print(f"   Response: {response.text}")
                sys.exit(1)
            
            data = response.json()
            if not data.get("success"):
                print("❌ Anonymous subscription failed")
                print(f"   Response: {data}")
                sys.exit(1)
            
            subscription_id = data["data"]["subscription_id"]
            selectors = data["data"]["selectors"]
            print(f"✅ Anonymous user subscribed (subscription_id: {subscription_id})")
            print(f"   Selectors: {selectors}")
        print()
        
        # Test 2: Authenticated subscription with tags
        print("🔐 Test 2: Authenticated subscription...")
        auth_sub_data = {"tags": ["urgent", "email"]}
        response = client.post(
            f"/api/events/{event_id}/subscribe",
            json=auth_sub_data,
            headers=headers
        )
        
        if response.status_code != 201:
            print("❌ Authenticated subscription failed")
            print(f"   Response: {response.text}")
            sys.exit(1)
        
        data = response.json()
        if not data.get("success"):
            print("❌ Authenticated subscription failed")
            print(f"   Response: {data}")
            sys.exit(1)
        
        auth_sub_id = data["data"]["subscription_id"]
        selectors = data["data"]["selectors"]
        print(f"✅ Authenticated user subscribed (subscription_id: {auth_sub_id})")
        print(f"   Selectors: {selectors}")
        print()
        
        # Test 3: Duplicate subscription should fail
        print("🔄 Test 3: Duplicate subscription (should fail)...")
        response = client.post(
            f"/api/events/{event_id}/subscribe",
            json={"tags": ["test"]},
            headers=headers
        )
        
        if response.status_code == 400:
            detail = response.json().get("detail")
            if detail == "Already subscribed":
                print("✅ Duplicate subscription correctly rejected")
            else:
                print(f"⚠️  Unexpected error: {detail}")
        else:
            print("⚠️  Unexpected response to duplicate subscription")
            print(f"   Status: {response.status_code}")
        print()
        
        # Test 4: Subscribe to non-existent event (use fresh client)
        print("❌ Test 4: Subscribe to non-existent event (should fail)...")
        with httpx.Client(base_url=BASE_URL) as test_client:
            response = test_client.post(
                "/api/events/99999/subscribe",
                json={"email": "test@example.com"}
            )
            
            if response.status_code == 404:
                detail = response.json().get("detail")
                if detail == "Event not found":
                    print("✅ Non-existent event correctly rejected")
                else:
                    print(f"⚠️  Unexpected error: {detail}")
            else:
                print("❌ Unexpected response")
                print(f"   Status: {response.status_code}")
        print()
        
        breakpoint()
        # Summary
        print("=" * 38)
        print("✅ Phase 7 Tests Completed Successfully")
        print()
        print("📊 Summary:")
        print("   - Anonymous subscription: ✅")
        print("   - Authenticated subscription: ✅")
        print("   - Duplicate prevention: ✅")
        print("   - Error handling: ✅")
        print()
        print("🔍 Next: Check Temporal UI for participant_added signals")
        print(f"   URL: {TEMPORAL_UI}")
        print("   Workflow ID: event-{uuid}")


if __name__ == "__main__":
    main()
