#!/usr/bin/env python3
"""
Quick health check for all Soonish services.

Checks:
1. Temporal server connectivity
2. Worker status (indirectly via task queue)
3. API server health
4. Database accessibility
"""

import asyncio
import httpx
import sys
from temporalio.client import Client

# Configuration
API_BASE = "http://localhost:8000"
TEMPORAL_URL = "ghost:7233"
TEMPORAL_NAMESPACE = "default"
TASK_QUEUE = "soonish-task-queue"

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


async def check_temporal():
    """Check Temporal server"""
    try:
        client = await Client.connect(TEMPORAL_URL, namespace=TEMPORAL_NAMESPACE)
        # Try to list workflows
        count = 0
        async for _ in client.list_workflows():
            count += 1
            if count >= 1:
                break
        print(f"{GREEN}✅ Temporal server{RESET} - Connected at {TEMPORAL_URL}")
        return True, client
    except Exception as e:
        print(f"{RED}❌ Temporal server{RESET} - Not reachable: {e}")
        print("   Start with: temporal server start-dev")
        return False, None


async def check_worker(client: Client):
    """Check if worker is running"""
    if not client:
        print(f"{RED}❌ Worker{RESET} - Cannot check (Temporal not connected)")
        return False
    
    try:
        # Check for workflows on our task queue
        count = 0
        async for workflow in client.list_workflows(f'TaskQueue="{TASK_QUEUE}"'):
            count += 1
            if count >= 1:
                break
        
        if count > 0:
            print(f"{GREEN}✅ Worker{RESET} - Found {count} workflow(s) on task queue '{TASK_QUEUE}'")
            return True
        else:
            print(f"{YELLOW}⚠️  Worker{RESET} - No workflows found on task queue '{TASK_QUEUE}'")
            print("   Worker may not be running or no workflows started yet")
            print("   Start with: uv run python -m src.worker.main")
            return False
    except Exception as e:
        print(f"{YELLOW}⚠️  Worker{RESET} - Status unknown: {e}")
        return False


async def check_api():
    """Check API server"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{API_BASE}/api/health")
            if response.status_code == 200:
                data = response.json()
                print(f"{GREEN}✅ API server{RESET} - Running at {API_BASE}")
                print(f"   Version: {data.get('version', 'unknown')}")
                return True
            else:
                print(f"{RED}❌ API server{RESET} - Returned status {response.status_code}")
                return False
    except httpx.ConnectError:
        print(f"{RED}❌ API server{RESET} - Not reachable at {API_BASE}")
        print("   Start with: uvicorn src.api.main:app --reload")
        return False
    except Exception as e:
        print(f"{RED}❌ API server{RESET} - Error: {e}")
        return False


async def check_database():
    """Check database"""
    try:
        from pathlib import Path
        
        db_path = Path("soonish.db")
        if db_path.exists():
            size_mb = db_path.stat().st_size / (1024 * 1024)
            print(f"{GREEN}✅ Database{RESET} - Found at {db_path} ({size_mb:.2f} MB)")
            return True
        else:
            print(f"{RED}❌ Database{RESET} - Not found at {db_path}")
            print("   Initialize with: uv run scripts/init_db.py")
            return False
    except Exception as e:
        print(f"{RED}❌ Database{RESET} - Error: {e}")
        return False


async def main():
    """Run all checks"""
    print("\n" + "=" * 50)
    print("🔍 SOONISH SERVICES HEALTH CHECK")
    print("=" * 50 + "\n")
    
    results = []
    
    # Check database first (no async needed)
    db_ok = await check_database()
    results.append(("Database", db_ok))
    
    # Check Temporal
    temporal_ok, temporal_client = await check_temporal()
    results.append(("Temporal", temporal_ok))
    
    # Check worker (needs Temporal client)
    worker_ok = await check_worker(temporal_client)
    results.append(("Worker", worker_ok))
    
    # Check API
    api_ok = await check_api()
    results.append(("API", api_ok))
    
    print("\n" + "=" * 50)
    
    # Summary
    all_ok = all(ok for _, ok in results)
    critical_ok = db_ok and temporal_ok and api_ok
    
    if all_ok:
        print(f"{GREEN}✅ ALL SERVICES RUNNING{RESET}")
        print("\nYou're ready to run integration tests!")
        print("  uv run python scripts/test_workflow_integration.py")
    elif critical_ok:
        print(f"{YELLOW}⚠️  CORE SERVICES RUNNING (Worker status unclear){RESET}")
        print("\nYou can run tests, but worker may need to be started:")
        print("  uv run python -m src.worker.main")
    else:
        print(f"{RED}❌ SOME SERVICES NOT RUNNING{RESET}")
        print("\nStart missing services before running tests.")
    
    print("=" * 50 + "\n")
    
    return 0 if critical_ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
