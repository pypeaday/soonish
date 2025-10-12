#!/bin/bash
# Test rate limiting behavior

API_BASE="http://localhost:8000"

echo "============================================================"
echo "Testing Rate Limiting (60 requests/minute per IP)"
echo "============================================================"

# Test 1: Under the limit (should all succeed)
echo ""
echo "Test 1: Sending 50 requests (under limit)..."
success_count=0
for i in {1..50}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/events")
    if [ "$response" == "200" ]; then
        ((success_count++))
    fi
    echo -ne "\rRequest $i/50: $response"
done
echo ""
echo "✅ Success: $success_count/50 requests succeeded"

# Test 2: Over the limit (should get 429s)
echo ""
echo "Test 2: Sending 20 more requests (should hit rate limit)..."
blocked_count=0
for i in {51..70}; do
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/api/events")
    if [ "$response" == "429" ]; then
        ((blocked_count++))
    fi
    echo -ne "\rRequest $i/70: $response"
done
echo ""
echo "✅ Blocked: $blocked_count/20 requests got 429 (rate limited)"

# Test 3: Check rate limit details
echo ""
echo "Test 3: Checking rate limit error message..."
response=$(curl -s "$API_BASE/api/events")
echo "$response" | jq -r '.detail' 2>/dev/null || echo "$response"

echo ""
echo "============================================================"
echo "Rate limiting test complete!"
echo "============================================================"
echo ""
echo "Summary:"
echo "  - Limit: 60 requests/minute per IP"
echo "  - Health check endpoint excluded: /api/health"
echo "  - Logs: Check server output for rate limit warnings"
echo ""
echo "Wait 60 seconds for rate limit to reset, then try again."
