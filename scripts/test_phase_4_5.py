#!/usr/bin/env python3
"""Test script for Phase 4 & 5 acceptance criteria"""

import httpx
import sys


BASE_URL = "http://localhost:8000"
tests_passed = 0
tests_failed = 0


def test_pass(message: str):
    global tests_passed
    print(f"✓ {message}")
    tests_passed += 1


def test_fail(message: str):
    global tests_failed
    print(f"✗ {message}")
    tests_failed += 1


def main():
    print("🧪 Testing Phase 4 & 5 Implementation")
    print("=" * 38)
    print()

    with httpx.Client(base_url=BASE_URL) as client:
        # Phase 3: Basic API
        print("Phase 3: Basic API")
        print("-" * 18)
        
        response = client.get("/api/health")
        if response.status_code == 200 and "healthy" in response.text:
            test_pass("Health endpoint returns healthy status")
        else:
            test_fail("Health endpoint failed")
        
        print()
        print("Phase 4: Authentication")
        print("-" * 22)
        
        # Test registration
        register_data = {
            "email": "testuser@example.com",
            "password": "testpass123",
            "name": "Test User"
        }
        response = client.post("/api/auth/register", json=register_data)
        if response.status_code in (200, 201) and "testuser@example.com" in response.text:
            test_pass("User registration works")
        else:
            test_fail("User registration failed")
        
        # Test login
        login_data = {"email": "testuser@example.com", "password": "testpass123"}
        response = client.post("/api/auth/login", json=login_data)
        token = None
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
        
        if token:
            test_pass("Login returns JWT token")
        else:
            test_fail("Login failed to return token")
            print("=" * 38)
            print(f"Passed: {tests_passed}")
            print(f"Failed: {tests_failed}")
            sys.exit(1)
        
        # Test protected endpoint without auth (use fresh client to avoid session cookies)
        with httpx.Client(base_url=BASE_URL) as fresh_client:
            response = fresh_client.get("/api/users/me")
            if response.status_code == 401:
                test_pass("Protected endpoint returns 401 without auth")
            else:
                test_fail("Protected endpoint should require auth")
        
        # Test protected endpoint with JWT
        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/users/me", headers=headers)
        if response.status_code == 200 and "testuser@example.com" in response.text:
            test_pass("Protected endpoint works with JWT token")
        else:
            test_fail("Protected endpoint failed with JWT")
        
        print()
        print("Phase 5: Events API")
        print("-" * 19)
        
        # Test create event without auth (use fresh client to avoid session cookies)
        event_data = {"name": "Test"}
        with httpx.Client(base_url=BASE_URL) as fresh_client:
            response = fresh_client.post("/api/events", json=event_data)
            if response.status_code == 401:
                test_pass("Create event requires authentication")
            else:
                test_fail("Create event should require auth")
        
        # Test create event with auth
        event_data = {
            "name": "Test Event",
            "description": "A test event",
            "start_date": "2025-12-25T10:00:00Z",
            "end_date": "2025-12-25T11:00:00Z",
            "location": "Test Location"
        }
        response = client.post("/api/events", json=event_data, headers=headers)
        event_id = None
        if response.status_code == 201:
            data = response.json()
            event_id = data.get("id")
        
        if event_id:
            test_pass("Create event works with authentication")
        else:
            test_fail("Create event failed")
            print(f"Response: {response.text}")
        
        # Test get event by ID (public access)
        response = client.get(f"/api/events/{event_id}")
        if response.status_code == 200 and "Test Event" in response.text:
            test_pass("Get event by ID works (public access)")
        else:
            test_fail("Get event by ID failed")
        
        # Test list events
        response = client.get("/api/events")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                test_pass("List events returns results")
            else:
                test_fail("List events failed")
        else:
            test_fail("List events failed")
        
        # Test update event
        update_data = {"name": "Updated Event", "location": "New Location"}
        response = client.put(f"/api/events/{event_id}", json=update_data, headers=headers)
        if response.status_code == 200 and "Updated Event" in response.text:
            test_pass("Update event works (organizer only)")
        else:
            test_fail("Update event failed")
        
        # Test authorization - create another user
        user2_data = {
            "email": "user2@example.com",
            "password": "pass123",
            "name": "User Two"
        }
        client.post("/api/auth/register", json=user2_data)
        
        login2_data = {"email": "user2@example.com", "password": "pass123"}
        response = client.post("/api/auth/login", json=login2_data)
        token2 = response.json().get("access_token") if response.status_code == 200 else None
        
        if token2:
            headers2 = {"Authorization": f"Bearer {token2}"}
            response = client.put(
                f"/api/events/{event_id}",
                json={"name": "Hacked"},
                headers=headers2
            )
            if response.status_code == 403:
                test_pass("Authorization check prevents unauthorized updates")
            else:
                test_fail("Authorization check failed")
        
        # Test delete event
        response = client.delete(f"/api/events/{event_id}", headers=headers)
        if response.status_code == 204:
            test_pass("Delete event works (organizer only)")
        else:
            test_fail("Delete event failed")
        
        # Verify event was deleted
        response = client.get(f"/api/events/{event_id}")
        if response.status_code == 404:
            test_pass("Deleted event returns 404")
        else:
            test_fail("Event should be deleted")
    
    print()
    print("=" * 38)
    print("Test Results:")
    print(f"Passed: {tests_passed}")
    print(f"Failed: {tests_failed}")
    print("=" * 38)
    
    if tests_failed == 0:
        print("All tests passed! ✓")
        sys.exit(0)
    else:
        print("Some tests failed ✗")
        sys.exit(1)


if __name__ == "__main__":
    main()
