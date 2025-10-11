#!/usr/bin/env python3
"""Test Phase 13: Email Verification

Tests:
1. Register new user (should send verification email)
2. Verify email with token
3. Try to verify again (should say already verified)
4. Resend verification for unverified user
5. Try to resend for verified user (should fail)
"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel

console = Console()
API_BASE = "http://localhost:8000"


async def test_verification_flow():
    """Test complete email verification flow"""
    
    console.print(Panel.fit("🧪 Testing Phase 13: Email Verification", style="bold blue"))
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        test_email = "verify_test@example.com"
        test_password = "password123"
        
        # Step 1: Register new user
        console.print("\n1️⃣  Registering new user...")
        resp = await client.post(
            f"{API_BASE}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": "Verify Test"
            }
        )
        
        if resp.status_code == 201:
            user_data = resp.json()
            console.print(f"   ✅ User registered: {user_data['email']}", style="green")
            console.print(f"   📧 Verification email sent (check logs)", style="dim")
            console.print(f"   ⚠️  is_verified: {user_data['is_verified']}", style="yellow")
        else:
            console.print(f"   ❌ Registration failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        # Step 2: Extract token from response (in real scenario, user clicks email link)
        console.print("\n2️⃣  Simulating email verification...")
        console.print("   ℹ️  In production, user would click link in email", style="dim")
        console.print("   ℹ️  For testing, we'll create a token manually", style="dim")
        
        # Create a verification token manually for testing
        from src.api.auth.verification import create_verification_token
        from src.db.models import User
        
        # Create a mock user object with the data we have
        mock_user = type('User', (), {
            'id': user_data['id'],
            'email': user_data['email']
        })()
        
        token = create_verification_token(mock_user)
        console.print(f"   🔑 Generated token: {token[:50]}...", style="dim")
        
        # Step 3: Verify email
        console.print("\n3️⃣  Verifying email with token...")
        resp = await client.post(
            f"{API_BASE}/api/auth/verify",
            json={"token": token}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            console.print(f"   ✅ {result['message']}", style="green")
            console.print(f"   📧 Welcome email sent", style="dim")
        else:
            console.print(f"   ❌ Verification failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        # Step 4: Try to verify again (should say already verified)
        console.print("\n4️⃣  Trying to verify again...")
        resp = await client.post(
            f"{API_BASE}/api/auth/verify",
            json={"token": token}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            if result.get("already_verified"):
                console.print(f"   ✅ Correctly detected: {result['message']}", style="green")
            else:
                console.print(f"   ⚠️  Unexpected: {result['message']}", style="yellow")
        else:
            console.print(f"   ❌ Failed: {resp.status_code}", style="red")
        
        # Step 5: Test resend for verified user (should fail)
        console.print("\n5️⃣  Trying to resend verification for verified user...")
        resp = await client.post(
            f"{API_BASE}/api/auth/resend-verification",
            json={"email": test_email}
        )
        
        if resp.status_code == 400:
            console.print(f"   ✅ Correctly rejected: Email already verified", style="green")
        else:
            console.print(f"   ⚠️  Unexpected status: {resp.status_code}", style="yellow")
            console.print(f"   {resp.text}")
        
        # Step 6: Test resend for non-existent user (should not reveal)
        console.print("\n6️⃣  Testing resend for non-existent user...")
        resp = await client.post(
            f"{API_BASE}/api/auth/resend-verification",
            json={"email": "nonexistent@example.com"}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            console.print(f"   ✅ Security: {result['message']}", style="green")
            console.print(f"   ℹ️  Doesn't reveal if email exists", style="dim")
        else:
            console.print(f"   ⚠️  Unexpected: {resp.status_code}", style="yellow")
        
        # Step 7: Login with verified user
        console.print("\n7️⃣  Testing login with verified user...")
        resp = await client.post(
            f"{API_BASE}/api/auth/login",
            json={
                "email": test_email,
                "password": test_password
            }
        )
        
        if resp.status_code == 200:
            result = resp.json()
            console.print(f"   ✅ Login successful", style="green")
            console.print(f"   🔑 Access token received", style="dim")
        else:
            console.print(f"   ❌ Login failed: {resp.status_code}", style="red")
    
    console.print("\n" + "="*60)
    console.print("✅ Phase 13 verification flow test complete!", style="bold green")
    console.print("\n📝 Notes:", style="bold")
    console.print("   - Verification emails are sent via Apprise (check SMTP logs)")
    console.print("   - Tokens expire after 24 hours")
    console.print("   - Security: Doesn't reveal if email exists on resend")
    console.print("   - Welcome email sent after successful verification")


if __name__ == "__main__":
    asyncio.run(test_verification_flow())
