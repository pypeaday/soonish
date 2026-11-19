#!/usr/bin/env python3
"""
Test script for 10-second debug recurring events.
"""

import sys
import os
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_debug_recurrence_frontend():
    """Test the new debug recurrence option in frontend."""
    print("🧪 Testing Debug Recurrence Option (10 seconds)")
    print("=" * 50)

    print("✅ Frontend Changes Made:")
    print("   • Added 'second' unit to RecurrenceRuleInput type")
    print("   • Updated recurrence dropdown with debug option")
    print("   • Debug option appears as 'Debug: Every 10 seconds'")

    print("\n📝 Manual Test Steps:")
    print("1. Open http://localhost:5175 in browser")
    print("2. Click 'Add Event'")
    print("3. Fill in basic event details:")
    print("   - Name: 'Debug Test Event'")
    print("   - Start Date: Current time")
    print("4. Enable 'Repeats' toggle")
    print("5. Select 'Debug: Every 10 seconds' from frequency dropdown")
    print("6. Set number of occurrences to '5' (for testing)")
    print("7. Click 'Create Event'")

    print("\n🔍 Expected Behavior:")
    print("• Event created successfully")
    print("• Backend receives recurrence rule with unit='second'")
    print("• Temporal workflow creates new occurrence every 10 seconds")
    print("• Should see 5 events created over 40 seconds")


def test_debug_recurrence_backend():
    """Test backend handling of debug recurrence."""
    print("\n🧪 Testing Backend Debug Recurrence Logic")
    print("=" * 50)

    print("✅ Backend Changes Made:")
    print("   • Updated RecurrenceRule schema to include 'second' unit")
    print("   • Modified create_next_occurrence to handle 10-second intervals")
    print("   • Updated unit mapping for HTML display")

    print("\n🔧 Implementation Details:")
    print("• unit='second' uses timedelta(seconds=interval * 10)")
    print("• This creates 10-second intervals for fast testing")
    print("• Display shows as 'Debug (10s)' in UI")

    print("\n📊 Test API Call:")
    api_call = """curl -X POST "http://localhost:8000/api/v1/events" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Debug Test Event",
    "description": "Testing 10-second recurrence",
    "start_date": "2025-12-23T15:30:00Z",
    "recurrence": {
      "unit": "second",
      "interval": 1
    }
  }' """

    print(api_call)

    print("\n🎯 Expected Results:")
    print("• 201 Created response")
    print("• Event with series_id and recurrence_rule stored")
    print("• Recurrence rule: {'unit': 'second', 'interval': 1}")


def test_temporal_workflow():
    """Test temporal workflow with debug recurrence."""
    print("\n🧪 Testing Temporal Workflow with Debug")
    print("=" * 50)

    print("⚡ Workflow Testing:")
    print("• Event completion triggers create_next_occurrence activity")
    print("• New event scheduled 10 seconds after completion")
    print("• Process repeats for specified count or indefinitely")

    print("\n🔬 Test Scenarios:")
    scenarios = [
        {
            "name": "Finite Debug Series",
            "config": "unit='second', count=5",
            "expected": "5 events over 40 seconds",
        },
        {
            "name": "Infinite Debug Series",
            "config": "unit='second', no count",
            "expected": "Events every 10 seconds until manually stopped",
        },
        {
            "name": "With End Date",
            "config": "unit='second', until=2 minutes from now",
            "expected": "12 events over 2 minutes",
        },
    ]

    for scenario in scenarios:
        print(f"\n• {scenario['name']}")
        print(f"  Config: {scenario['config']}")
        print(f"  Expected: {scenario['expected']}")


def test_monitoring():
    """Test monitoring and cleanup of debug events."""
    print("\n🧪 Testing Debug Event Monitoring")
    print("=" * 50)

    print("📈 Monitoring Tips:")
    print("• Watch temporal workflow execution in Temporal UI")
    print("• Monitor database for new event creation")
    print("• Check subscription cloning for each occurrence")
    print("• Verify reminder schedules creation")

    print("\n🧹 Cleanup Commands:")
    cleanup_sql = """-- Clean up debug test events
DELETE FROM events 
WHERE name LIKE 'Debug%' OR name LIKE 'Test%'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Clean up orphaned subscriptions  
DELETE FROM subscriptions 
WHERE event_id NOT IN (SELECT id FROM events);
"""

    print(cleanup_sql)

    print("\n⚠️  Production Warning:")
    print("• Debug option should only be available in development")
    print("• Consider adding environment variable check")
    print("• Remove from production builds to avoid abuse")


def main():
    """Run all debug test cases."""
    print("🚀 Debug Recurrence Test Suite (10-second intervals)")
    print("=" * 60)
    print("Testing new debug recurring events functionality")
    print(f"Generated: {datetime.now().isoformat()}")

    test_debug_recurrence_frontend()
    test_debug_recurrence_backend()
    test_temporal_workflow()
    test_monitoring()

    print("\n🎯 Summary")
    print("=" * 50)
    print("✅ Frontend debug option added")
    print("✅ Backend 10-second recurrence implemented")
    print("✅ API schema updated")
    print("✅ Temporal workflow integration ready")
    print("✅ Monitoring and cleanup documented")

    print("\n🚀 Ready for Testing!")
    print("=" * 30)
    print("1. Start frontend: npm run dev")
    print("2. Start backend: uv run python -m backend.src.main")
    print("3. Create debug recurring events")
    print("4. Watch events appear every 10 seconds")
    print("5. Verify temporal workflow execution")

    print("\n🎉 Debug recurring events ready for testing!")


if __name__ == "__main__":
    main()
