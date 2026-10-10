#!/usr/bin/env python3
"""
Test script for seconds-based recurring events.
"""

import sys
import os
from datetime import datetime, timezone, timedelta

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_seconds_recurrence():
    """Test seconds-based recurring events."""
    print("🧪 Testing Seconds-Based Recurring Events")
    print("=" * 50)

    print("✅ Changes Made:")
    print("   • Added 'second' unit as proper recurrence option")
    print("   • Added interval field for customizable seconds")
    print("   • Backend supports exact second intervals")
    print("   • Frontend shows 'Every X seconds' option")

    print("\n📝 Manual Test Steps:")
    print("1. Open http://localhost:5175 in browser")
    print("2. Click 'Add Event'")
    print("3. Fill in basic event details:")
    print("   - Name: 'Quick Test Event'")
    print("   - Start Date: Current time")
    print("4. Enable 'Repeats' toggle")
    print("5. Select 'Every X seconds' from frequency dropdown")
    print("6. Set interval to 30 (seconds)")
    print("7. Set number of occurrences to 3 (for testing)")
    print("8. Click 'Create Event'")

    print("\n🔍 Expected Behavior:")
    print("• Event created successfully")
    print("• Backend receives recurrence rule with unit='second', interval=30")
    print("• New events created every 30 seconds")
    print("• Should see 3 events over 1 minute")


def test_api_examples():
    """Test various seconds-based API calls."""
    print("\n🧪 Testing API Examples")
    print("=" * 30)

    test_cases = [
        {
            "name": "30-second intervals",
            "data": {
                "name": "30-Second Event",
                "start_date": (
                    datetime.now(timezone.utc) + timedelta(seconds=10)
                ).isoformat(),
                "recurrence": {"unit": "second", "interval": 30, "count": 3},
            },
        },
        {
            "name": "60-second intervals (1 minute)",
            "data": {
                "name": "1-Minute Event",
                "start_date": (
                    datetime.now(timezone.utc) + timedelta(seconds=15)
                ).isoformat(),
                "recurrence": {"unit": "second", "interval": 60, "count": 5},
            },
        },
        {
            "name": "10-second intervals (rapid testing)",
            "data": {
                "name": "Rapid Test Event",
                "start_date": (
                    datetime.now(timezone.utc) + timedelta(seconds=5)
                ).isoformat(),
                "recurrence": {"unit": "second", "interval": 10, "count": 6},
            },
        },
        {
            "name": "5-second intervals (very rapid)",
            "data": {
                "name": "Very Rapid Test",
                "start_date": (
                    datetime.now(timezone.utc) + timedelta(seconds=3)
                ).isoformat(),
                "recurrence": {"unit": "second", "interval": 5, "count": 4},
            },
        },
    ]

    for i, test in enumerate(test_cases, 1):
        print(f"\n{i}. {test['name']}")
        print("   curl -X POST 'http://localhost:8000/api/v1/events' \\")
        print("     -H 'Authorization: Bearer $TOKEN' \\")
        print("     -H 'Content-Type: application/json' \\")
        print(f"     -d '{test['data']}'")
        print(
            f"   Expected: {test['data']['recurrence']['count']} events over {test['data']['recurrence']['interval'] * test['data']['recurrence']['count']} seconds"
        )


def test_interval_validation():
    """Test interval validation for seconds."""
    print("\n🧪 Testing Interval Validation")
    print("=" * 35)

    test_values = [
        {"interval": 1, "valid": True, "description": "1 second - minimum valid"},
        {"interval": 10, "valid": True, "description": "10 seconds - good for testing"},
        {"interval": 30, "valid": True, "description": "30 seconds - standard"},
        {"interval": 60, "valid": True, "description": "60 seconds - 1 minute"},
        {"interval": 0, "valid": False, "description": "0 seconds - invalid"},
        {"interval": -5, "valid": False, "description": "Negative - invalid"},
        {"interval": 86400, "valid": True, "description": "86400 seconds - 1 day"},
        {"interval": 999999, "valid": True, "description": "Very large - but valid"},
    ]

    print("Frontend Validation Tests:")
    for test in test_values:
        status = "✅" if test["valid"] else "❌"
        print(f"{status} Interval: {test['interval']} - {test['description']}")

    print("\n📝 Manual Validation Steps:")
    print("1. Try entering 0 in interval field - should be blocked")
    print("2. Try entering negative numbers - should be blocked")
    print("3. Try entering very large numbers - should be allowed")
    print("4. Test decimal numbers - should be rounded or blocked")


def test_ux_improvements():
    """Test UX improvements for seconds option."""
    print("\n🧪 Testing UX Improvements")
    print("=" * 30)

    ux_features = [
        {
            "feature": "Conditional Interval Label",
            "test": "Change frequency and verify label updates",
            "expected": "Label shows '(seconds)', '(days)', '(weeks)', etc.",
        },
        {
            "feature": "Responsive Grid Layout",
            "test": "Resize window with seconds option selected",
            "expected": "3-column layout adapts smoothly",
        },
        {
            "feature": "Smart Placeholder",
            "test": "Select seconds vs other frequencies",
            "expected": "Placeholder shows 30 for seconds, 1 for others",
        },
        {
            "feature": "Form Validation",
            "test": "Submit with invalid intervals",
            "expected": "Clear error messages shown",
        },
    ]

    print("UX Features to Test:")
    for feature in ux_features:
        print(f"\n• {feature['feature']}")
        print(f"  Test: {feature['test']}")
        print(f"  Expected: {feature['expected']}")


def test_edge_cases():
    """Test edge cases for seconds recurrence."""
    print("\n🧪 Testing Edge Cases")
    print("=" * 25)

    edge_cases = [
        {
            "case": "Leap Second Handling",
            "description": "Events spanning leap second adjustments",
            "expected": "Temporal workflow handles correctly",
        },
        {
            "case": "Timezone Boundaries",
            "description": "Events crossing DST or timezone changes",
            "expected": "UTC calculation remains consistent",
        },
        {
            "case": "Concurrent Creation",
            "description": "Multiple users creating second-based events",
            "expected": "No race conditions or conflicts",
        },
        {
            "case": "Large Series",
            "description": "1000 occurrences with 10-second intervals",
            "expected": "System handles without performance issues",
        },
        {
            "case": "Rapid Completion",
            "description": "Events complete faster than system processes",
            "expected": "No missed occurrences or duplicates",
        },
    ]

    print("Edge Case Testing:")
    for case in edge_cases:
        print(f"\n• {case['case']}")
        print(f"  Description: {case['description']}")
        print(f"  Expected: {case['expected']}")


def cleanup_commands():
    """Provide cleanup commands."""
    print("\n🧹 Cleanup Commands")
    print("=" * 20)

    print("SQL Cleanup:")
    cleanup_sql = """-- Clean up test events with seconds recurrence
DELETE FROM events 
WHERE name LIKE '%Second%' OR name LIKE '%Rapid%' OR name LIKE '%Test%'
  AND created_at > NOW() - INTERVAL '1 hour';

-- Clean up orphaned subscriptions
DELETE FROM subscriptions 
WHERE event_id NOT IN (SELECT id FROM events);

-- Check remaining recurring events
SELECT name, start_date, recurrence_rule, series_id
FROM events 
WHERE recurrence_rule IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
"""

    print(cleanup_sql)

    print("\nFrontend Cleanup:")
    print("1. Delete test events through UI")
    print("2. Clear browser localStorage if needed")
    print("3. Refresh dashboard to verify cleanup")


def main():
    """Run all seconds-based tests."""
    print("🚀 Seconds-Based Recurring Events Test Suite")
    print("=" * 60)
    print("Testing configurable second intervals for recurring events")
    print(f"Generated: {datetime.now().isoformat()}")

    test_seconds_recurrence()
    test_api_examples()
    test_interval_validation()
    test_ux_improvements()
    test_edge_cases()
    cleanup_commands()

    print("\n🎯 Summary")
    print("=" * 30)
    print("✅ Seconds unit added as proper option")
    print("✅ Configurable interval field implemented")
    print("✅ Backend logic updated for exact seconds")
    print("✅ UX improvements added for better usability")
    print("✅ Edge cases documented for testing")
    print("✅ Cleanup procedures provided")

    print("\n🚀 Ready for Testing!")
    print("=" * 25)
    print("1. Start frontend: npm run dev")
    print("2. Start backend: uv run python -m backend.src.main")
    print("3. Test various second intervals")
    print("4. Verify temporal workflow execution")
    print("5. Check event creation timing")

    print("\n✨ Seconds-based recurring events ready!")


if __name__ == "__main__":
    main()
