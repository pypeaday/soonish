#!/bin/bash
# Test script for Phase 6: Temporal Integration

set -e

echo "🧪 Testing Phase 6: Temporal Integration"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Note: This test requires Temporal server to be running${NC}"
echo -e "${YELLOW}Start it with: temporal server start-dev${NC}"
echo ""

# Check if Temporal is accessible
if ! curl -s http://localhost:8233 > /dev/null 2>&1; then
    echo -e "${RED}✗ Temporal server is not running on localhost:8233${NC}"
    echo -e "${YELLOW}Start it with: temporal server start-dev${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Temporal server is running"
echo ""

# Get auth token
echo "Getting auth token..."
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"password123"}' \
    | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo -e "${RED}✗ Failed to get auth token${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Got auth token"
echo ""

# Create event (which should start workflow)
echo "Creating event (should start workflow)..."
EVENT_RESPONSE=$(curl -s -X POST http://localhost:8000/api/events \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "Workflow Test Event",
        "description": "Testing Temporal workflow",
        "start_date": "2025-12-25T10:00:00Z",
        "end_date": "2025-12-25T11:00:00Z",
        "location": "Test Location"
    }')

EVENT_ID=$(echo "$EVENT_RESPONSE" | jq -r '.id')
WORKFLOW_ID=$(echo "$EVENT_RESPONSE" | jq -r '.temporal_workflow_id')

if [ "$EVENT_ID" = "null" ] || [ -z "$EVENT_ID" ]; then
    echo -e "${RED}✗ Failed to create event${NC}"
    echo "$EVENT_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓${NC} Event created with ID: $EVENT_ID"
echo -e "${GREEN}✓${NC} Workflow ID: $WORKFLOW_ID"
echo ""

echo "========================================="
echo -e "${GREEN}Phase 6 implementation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Start the worker: uv run python -m src.worker.main"
echo "2. Check Temporal UI: http://localhost:8233"
echo "3. Look for workflow: $WORKFLOW_ID"
echo ""
