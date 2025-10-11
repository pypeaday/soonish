#!/usr/bin/env python3
"""Test rate limiting behavior"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel

console = Console()
API_BASE = "http://localhost:8000"


async def test_rate_limit():
    """Test that rate limiting works correctly"""
    
    console.print(Panel.fit("🧪 Testing Rate Limiting", style="bold blue"))
    
    async with httpx.AsyncClient(timeout=5.0) as client:
        # Test 1: Under the limit
        console.print("\n📊 Test 1: Sending 50 requests (under 60/min limit)...")
        success_count = 0
        responses = []
        
        for i in range(50):
            try:
                resp = await client.get(f"{API_BASE}/api/events")
                responses.append(resp.status_code)
                if resp.status_code == 200:
                    success_count += 1
                console.print(f"  Request {i+1}/50: {resp.status_code}", end="\r")
            except Exception as e:
                console.print(f"  Request {i+1}/50: ERROR - {e}", style="red")
        
        console.print(f"\n✅ Success: {success_count}/50 requests succeeded", style="green")
        
        # Test 2: Over the limit
        console.print("\n📊 Test 2: Sending 20 more requests (should hit rate limit)...")
        blocked_count = 0
        
        for i in range(20):
            try:
                resp = await client.get(f"{API_BASE}/api/events")
                responses.append(resp.status_code)
                if resp.status_code == 429:
                    blocked_count += 1
                console.print(f"  Request {51+i}/70: {resp.status_code}", end="\r")
            except Exception as e:
                console.print(f"  Request {51+i}/70: ERROR - {e}", style="red")
        
        console.print(f"\n✅ Blocked: {blocked_count}/20 requests got 429 (rate limited)", style="green")
        
        # Test 3: Check error message
        console.print("\n📊 Test 3: Checking rate limit error message...")
        try:
            resp = await client.get(f"{API_BASE}/api/events")
            if resp.status_code == 429:
                error = resp.json()
                console.print(f"  Status: {resp.status_code}", style="yellow")
                console.print(f"  Message: {error.get('detail', 'No detail')}", style="yellow")
        except Exception as e:
            console.print(f"  ERROR: {e}", style="red")
        
        # Summary
        console.print("\n" + "="*60)
        console.print(Panel.fit("✅ Rate limiting test complete!", style="bold green"))
        console.print("\nResults:", style="bold")
        console.print(f"  • Total requests: {len(responses)}")
        console.print(f"  • 200 responses: {responses.count(200)}")
        console.print(f"  • 429 responses: {responses.count(429)}")
        console.print(f"  • Other responses: {len([r for r in responses if r not in [200, 429]])}")
        
        console.print("\n💡 Rate Limiting Details:", style="bold")
        console.print("  • Limit: 60 requests/minute per IP")
        console.print("  • Algorithm: Sliding window")
        console.print("  • Excluded: /api/health endpoint")
        console.print("  • Logs: Check server output for warnings")
        
        console.print("\n⏰ Wait 60 seconds for rate limit to reset", style="dim")
        
        # Validation
        if blocked_count > 0:
            console.print("\n✅ Rate limiting is working correctly!", style="bold green")
            return True
        else:
            console.print("\n⚠️  No 429 responses - rate limiting may not be working", style="yellow")
            return False


if __name__ == "__main__":
    try:
        result = asyncio.run(test_rate_limit())
        exit(0 if result else 1)
    except KeyboardInterrupt:
        console.print("\n\n⚠️  Test interrupted", style="yellow")
        exit(1)
    except Exception as e:
        console.print(f"\n❌ Test failed: {e}", style="bold red")
        import traceback
        traceback.print_exc()
        exit(1)
