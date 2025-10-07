#!/bin/bash
# Test script for Phase 4 & 5 acceptance criteria

set -e

echo "🧪 Testing Phase 4 & 5 Implementation"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

echo "Phase 3: Basic API"
echo "------------------"

# Test health endpoint
if curl -s http://localhost:8000/api/health | grep -q "healthy"; then
    test_pass "Health endpoint returns healthy status"
else
    test_fail "Health endpoint failed"
fi

echo ""
echo "Phase 4: Authentication"
echo "----------------------"

# Test registration
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@example.com","password":"testpass123","name":"Test User"}')

if echo "$REGISTER_RESPONSE" | grep -q "testuser@example.com"; then
    test_pass "User registration works"
else
    test_fail "User registration failed"
fi

# Test login
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"testuser@example.com","password":"testpass123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$TOKEN" != "null" ] && [ -n "$TOKEN" ]; then
    test_pass "Login returns JWT token"
else
    test_fail "Login failed to return token"
fi

# Test protected endpoint without auth
if curl -s http://localhost:8000/api/users/me | grep -q "Not authenticated"; then
    test_pass "Protected endpoint returns 401 without auth"
else
    test_fail "Protected endpoint should require auth"
fi

# Test protected endpoint with JWT
ME_RESPONSE=$(curl -s http://localhost:8000/api/users/me \
    -H "Authorization: Bearer $TOKEN")

if echo "$ME_RESPONSE" | grep -q "testuser@example.com"; then
    test_pass "Protected endpoint works with JWT token"
else
    test_fail "Protected endpoint failed with JWT"
fi

echo ""
echo "Phase 5: Events API"
echo "-------------------"

# Test create event without auth
if curl -s -X POST http://localhost:8000/api/events \
    -H "Content-Type: application/json" \
    -d '{"name":"Test"}' | grep -q "Not authenticated"; then
    test_pass "Create event requires authentication"
else
    test_fail "Create event should require auth"
fi

# Test create event with auth
EVENT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/events \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Test Event",
        "description": "A test event",
        "start_date": "2025-12-25T10:00:00Z",
        "end_date": "2025-12-25T11:00:00Z",
        "location": "Test Location"
    }')

EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.id')

if [ "$EVENT_ID" != "null" ] && [ -n "$EVENT_ID" ]; then
    test_pass "Create event works with authentication"
else
    test_fail "Create event failed"
fi

# Test get event by ID (public access)
GET_EVENT=$(curl -s http://localhost:8000/api/events/$EVENT_ID)

if echo "$GET_EVENT" | grep -q "Test Event"; then
    test_pass "Get event by ID works (public access)"
else
    test_fail "Get event by ID failed"
fi

# Test list events
LIST_EVENTS=$(curl -s http://localhost:8000/api/events)

if echo "$LIST_EVENTS" | jq -e '. | length > 0' > /dev/null; then
    test_pass "List events returns results"
else
    test_fail "List events failed"
fi

# Test update event
UPDATE_RESPONSE=$(curl -s -X PUT http://localhost:8000/api/events/$EVENT_ID \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Updated Event","location":"New Location"}')

if echo "$UPDATE_RESPONSE" | grep -q "Updated Event"; then
    test_pass "Update event works (organizer only)"
else
    test_fail "Update event failed"
fi

# Test authorization - create another user and try to update
TOKEN2=$(curl -s -X POST http://localhost:8000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"user2@example.com","password":"pass123","name":"User Two"}' \
    | jq -r '.id')

TOKEN2=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"user2@example.com","password":"pass123"}' \
    | jq -r '.access_token')

AUTH_TEST=$(curl -s -w "%{http_code}" -X PUT http://localhost:8000/api/events/$EVENT_ID \
    -H "Authorization: Bearer $TOKEN2" \
    -H "Content-Type: application/json" \
    -d '{"name":"Hacked"}')

if echo "$AUTH_TEST" | grep -q "403"; then
    test_pass "Authorization check prevents unauthorized updates"
else
    test_fail "Authorization check failed"
fi

# Test delete event
DELETE_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null -X DELETE http://localhost:8000/api/events/$EVENT_ID \
    -H "Authorization: Bearer $TOKEN")

if [ "$DELETE_RESPONSE" = "204" ]; then
    test_pass "Delete event works (organizer only)"
else
    test_fail "Delete event failed"
fi

# Verify event was deleted
if curl -s http://localhost:8000/api/events/$EVENT_ID | grep -q "Event not found"; then
    test_pass "Deleted event returns 404"
else
    test_fail "Event should be deleted"
fi

echo ""
echo "======================================"
echo "Test Results:"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "======================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed ✗${NC}"
    exit 1
fi
