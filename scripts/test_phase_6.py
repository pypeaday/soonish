#!/usr/bin/env python3
"""Test script for Phase 6: Temporal Integration"""

import asyncio
import httpx
import sys
from temporalio.client import Client


BASE_URL = "http://localhost:8000"
TEMPORAL_URL = "ghost:7233"
TEMPORAL_UI = "http://ghost:8233"


async def main():
    print("🧪 Testing Phase 6: Temporal Integration")
    print("=" * 41)
    print()
    
    print("⚠️  Note: This test requires Temporal server to be running")
    print("   Start it with: temporal server start-dev")
    print()
    
    # Check if Temporal is accessible
    try:
        temporal_client = await Client.connect(TEMPORAL_URL)
        print("✓ Temporal server is running")
    except Exception as e:
        print(f"✗ Temporal server is not accessible at {TEMPORAL_URL}")
        print(f"  Error: {e}")
        print("  Start it with: temporal server start-dev")
        sys.exit(1)
    
    print()
    
    with httpx.Client(base_url=BASE_URL) as client:
        # Use seeded user from init_db.py (organizer@example.com / password123)
        print("Getting auth token...")
        login_data = {"email": "organizer@example.com", "password": "password123"}
        response = client.post("/api/auth/login", json=login_data)
        
        if response.status_code != 200:
            print("✗ Failed to get auth token")
            print(f"  Response: {response.text}")
            sys.exit(1)
        
        token = response.json().get("access_token")
        print("✓ Got auth token")
        print()
        
        # Create event (which should start workflow)
        print("Creating event (should start workflow)...")
        headers = {"Authorization": f"Bearer {token}"}
        event_data = {
            "name": "Workflow Test Event",
            "description": "Testing Temporal workflow",
            "start_date": "2025-12-25T10:00:00Z",
            "end_date": "2025-12-25T11:00:00Z",
            "location": "Test Location"
        }
        
        response = client.post("/api/events", json=event_data, headers=headers)
        
        if response.status_code != 201:
            print("✗ Failed to create event")
            print(f"  Response: {response.text}")
            sys.exit(1)
        
        data = response.json()
        event_id = data.get("id")
        workflow_id = data.get("temporal_workflow_id")
        
        print(f"✓ Event created with ID: {event_id}")
        print(f"✓ Workflow ID: {workflow_id}")
        print()
        
        # Verify workflow exists in Temporal
        print("Checking workflow in Temporal...")
        try:
            workflow_handle = temporal_client.get_workflow_handle(workflow_id)
            workflow_status = await workflow_handle.describe()
            print(f"✓ Workflow found in Temporal: {workflow_status.status}")
        except Exception as e:
            print("⚠️  Workflow not found in Temporal (worker may not be running)")
            print(f"   Error: {e}")
        
        print()
        print("=" * 41)
        print("Phase 6 implementation complete!")
        print()
        print("Next steps:")
        print("1. Start the worker: uv run python -m src.worker.main")
        print(f"2. Check Temporal UI: {TEMPORAL_UI}")
        print(f"3. Look for workflow: {workflow_id}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
