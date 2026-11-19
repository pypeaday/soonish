#!/usr/bin/env python3
"""
Test script to verify the new token-based redirect URL system
"""

import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "backend/src"))

from unittest.mock import Mock
from src.api.auth.verification import (
    create_verification_token,
    create_password_reset_token,
)
from src.api.services.frontend_resolver import get_frontend_url
from src.config import get_settings


def test_token_system():
    print("🧪 Testing Token-Based Redirect URL System")
    print("=" * 50)

    # Mock user
    mock_user = Mock()
    mock_user.id = 1
    mock_user.email = "test@example.com"

    # Test 1: Frontend URL resolution
    print("\n1. Testing Frontend URL Resolution:")
    soonish_url = get_frontend_url("soonish")
    default_url = get_frontend_url("unknown")
    print(f"   soonish → {soonish_url}")
    print(f"   unknown → {default_url}")
    assert soonish_url == "http://localhost:5173", (
        f"Expected http://localhost:5173, got {soonish_url}"
    )
    assert default_url == "http://localhost:5173", (
        f"Expected http://localhost:5173, got {default_url}"
    )
    print("   ✅ URL resolution working correctly")

    # Test 2: Verification token with redirect URL
    print("\n2. Testing Verification Token with Redirect URL:")
    redirect_url = get_frontend_url("soonish")
    verify_token = create_verification_token(mock_user, "soonish", redirect_url)
    print(f"   Created token with redirect_url: {redirect_url}")

    # Test 3: Password reset token with redirect URL
    print("\n3. Testing Password Reset Token with Redirect URL:")
    reset_token = create_password_reset_token(mock_user, "soonish", redirect_url)
    print(f"   Created token with redirect_url: {redirect_url}")

    # Test 4: Decode tokens (simplified test)
    import jwt

    settings = get_settings()

    try:
        # Test verification token payload
        verify_payload = jwt.decode(
            verify_token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        assert verify_payload.get("redirect_url") == redirect_url
        assert verify_payload.get("source") == "soonish"
        print("   ✅ Verification token contains redirect_url and source")

        # Test password reset token payload
        reset_payload = jwt.decode(
            reset_token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        assert reset_payload.get("redirect_url") == redirect_url
        assert reset_payload.get("source") == "soonish"
        print("   ✅ Password reset token contains redirect_url and source")

    except Exception as e:
        print(f"   ❌ Token decoding failed: {e}")
        return False

    print("\n4. Configuration Test:")
    print(f"   Frontend base URL: {settings.frontend_base_url}")
    print(f"   Frontend URLs: {settings.frontend_urls}")

    print(
        "\n🎉 All tests passed! The token-based redirect system is working correctly."
    )
    print("\n📧 Email URLs will now point to:")
    print(f"   Verification: {redirect_url}/verify?token=...")
    print(f"   Password Reset: {redirect_url}/reset-password?token=...")

    return True


if __name__ == "__main__":
    success = test_token_system()
    sys.exit(0 if success else 1)
