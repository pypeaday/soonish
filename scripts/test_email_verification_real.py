#!/usr/bin/env python3
"""Test email verification with REAL email address

This script:
1. Registers a new user with your real email
2. Shows you the verification URL that would be in the email
3. Lets you verify by clicking the URL or pasting the token
4. Optionally sends a real email if SMTP is configured
"""
import asyncio
import httpx
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
import sys

console = Console()
API_BASE = "http://localhost:8000"


async def test_real_email_verification():
    """Test email verification with real email address"""
    
    console.print(Panel.fit("📧 Real Email Verification Test", style="bold blue"))
    
    # Get email from user
    console.print("\n[bold yellow]Enter your real email address:[/bold yellow]")
    test_email = Prompt.ask("Email")
    
    if not test_email or "@" not in test_email:
        console.print("❌ Invalid email address", style="red")
        return
    
    test_password = "TestPassword123!"
    test_name = Prompt.ask("Name", default="Test User")
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Step 1: Register new user
        console.print(f"\n1️⃣  Registering user: {test_email}...")
        resp = await client.post(
            f"{API_BASE}/api/auth/register",
            json={
                "email": test_email,
                "password": test_password,
                "name": test_name
            }
        )
        
        if resp.status_code == 400:
            error = resp.json()
            if "already registered" in error.get("detail", "").lower():
                console.print("   ⚠️  User already exists and is verified", style="yellow")
                console.print("   💡 Try logging in or use a different email", style="dim")
                return
        elif resp.status_code != 201:
            console.print(f"   ❌ Registration failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        user_data = resp.json()
        console.print(f"   ✅ User registered: {user_data['email']}", style="green")
        console.print("   📧 Verification email sent (if SMTP configured)", style="dim")
        console.print(f"   ⚠️  is_verified: {user_data['is_verified']}", style="yellow")
        
        # Step 2: Generate verification token and show URL
        console.print("\n2️⃣  Generating verification token...")
        from src.api.auth.verification import create_verification_token
        
        # Create a mock user object
        mock_user = type('User', (), {
            'id': user_data['id'],
            'email': user_data['email']
        })()
        
        token = create_verification_token(mock_user)
        console.print(f"   🔑 Generated token: {token[:50]}...", style="dim")
        
        # Show the verification URL with properly encoded token
        from urllib.parse import quote
        encoded_token = quote(token, safe='')
        verification_url = f"{API_BASE}/api/auth/verify?token={encoded_token}"
        
        console.print("\n" + "="*70)
        console.print("[bold green]📬 VERIFICATION EMAIL CONTENT:[/bold green]")
        console.print("="*70)
        console.print(f"""
Welcome to Soonish!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

---
Soonish Event Notifications
""")
        console.print("="*70)
        
        # Check if SMTP is configured
        from src.config import get_settings
        settings = get_settings()
        
        if settings.gmail_user or settings.proton_user:
            console.print("\n✅ SMTP is configured - email should be sent!", style="green")
            console.print(f"   Check your inbox at: {test_email}", style="dim")
        else:
            console.print("\n⚠️  SMTP not configured - email NOT sent", style="yellow")
            console.print("   To enable emails, set these in .env:", style="dim")
            console.print("   - GMAIL_USER and GMAIL_APP_PASSWORD, or", style="dim")
            console.print("   - PROTON_USER and PROTON_APP_PASSWORD", style="dim")
        
        # Ask user to verify
        console.print("\n3️⃣  Ready to verify?")
        console.print("   Option 1: Click the URL above in your browser")
        console.print("   Option 2: Press Enter to verify automatically")
        console.print("   Option 3: Type 'skip' to skip verification")
        
        choice = Prompt.ask("\nVerify now?", choices=["yes", "skip"], default="yes")
        
        if choice == "skip":
            console.print("\n⏭️  Skipping verification", style="yellow")
            console.print(f"   You can verify later by visiting: {verification_url}")
            return
        
        # Step 3: Verify the email
        console.print("\n4️⃣  Verifying email...")
        resp = await client.post(
            f"{API_BASE}/api/auth/verify",
            json={"token": token}
        )
        
        if resp.status_code == 200:
            result = resp.json()
            console.print(f"   ✅ {result['message']}", style="green")
            if not result.get("already_verified"):
                console.print("   📧 Welcome email sent!", style="dim")
        else:
            console.print(f"   ❌ Verification failed: {resp.status_code}", style="red")
            console.print(f"   {resp.text}")
            return
        
        # Step 4: Test login
        console.print("\n5️⃣  Testing login with verified account...")
        resp = await client.post(
            f"{API_BASE}/api/auth/login",
            json={
                "email": test_email,
                "password": test_password
            }
        )
        
        if resp.status_code == 200:
            result = resp.json()
            console.print("   ✅ Login successful!", style="green")
            console.print(f"   🔑 Access token: {result['access_token'][:50]}...", style="dim")
        else:
            console.print(f"   ❌ Login failed: {resp.status_code}", style="red")
        
        # Summary
        console.print("\n" + "="*70)
        console.print("✅ Email verification test complete!", style="bold green")
        console.print("\n📝 Summary:", style="bold")
        console.print(f"   Email: {test_email}")
        console.print(f"   Password: {test_password}")
        console.print("   Status: Verified ✅")
        console.print("\n💡 Next steps:", style="bold")
        console.print("   - Check your email inbox for verification & welcome emails")
        console.print("   - Login at: http://localhost:8000")
        console.print("   - Create events and test notifications!")


if __name__ == "__main__":
    try:
        asyncio.run(test_real_email_verification())
    except KeyboardInterrupt:
        console.print("\n\n⚠️  Test cancelled by user", style="yellow")
        sys.exit(0)
