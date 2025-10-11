"""Email sending service using Apprise"""
import apprise
from urllib.parse import quote
from src.config import get_settings


async def send_verification_email(email: str, token: str, base_url: str = "http://localhost:8000") -> bool:
    """Send email verification link to user"""
    settings = get_settings()
    
    # Build verification URL with properly encoded token
    encoded_token = quote(token, safe='')
    verification_url = f"{base_url}/api/auth/verify?token={encoded_token}"
    
    # Email body
    body = f"""
Welcome to Soonish!

Please verify your email address by clicking the link below:

{verification_url}

This link will expire in 24 hours.

If you didn't create an account, you can safely ignore this email.

---
Soonish Event Notifications
"""
    
    # Create Apprise instance
    apobj = apprise.Apprise()
    
    # Add SMTP service (prefer ProtonMail, fallback to Gmail)
    if settings.proton_user and settings.proton_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_proton}'
            f'&user={settings.proton_user}'
            f'&pass={settings.proton_app_password}'
            f'&from=Soonish <{settings.proton_user}>'
        )
    elif settings.gmail_user and settings.gmail_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_gmail}'
            f'&user={settings.gmail_user}'
            f'&pass={settings.gmail_app_password}'
            f'&from=Soonish <{settings.gmail_user}>'
        )
    else:
        # No SMTP configured
        return False
    
    # Send notification
    result = apobj.notify(
        title="Verify your email - Soonish",
        body=body
    )
    
    return result


async def send_welcome_email(email: str, base_url: str = "http://localhost:8000") -> bool:
    """Send welcome email after verification"""
    settings = get_settings()
    
    body = f"""
Welcome to Soonish!

Your email has been verified successfully. You can now:

- Create events and invite others
- Subscribe to events with custom reminders
- Manage your notification preferences

Get started at: {base_url}/dashboard

---
Soonish Event Notifications
"""
    
    # Create Apprise instance
    apobj = apprise.Apprise()
    
    # Add SMTP service
    if settings.proton_user and settings.proton_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_proton}'
            f'&user={settings.proton_user}'
            f'&pass={settings.proton_app_password}'
            f'&from=Soonish <{settings.proton_user}>'
        )
    elif settings.gmail_user and settings.gmail_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_gmail}'
            f'&user={settings.gmail_user}'
            f'&pass={settings.gmail_app_password}'
            f'&from=Soonish <{settings.gmail_user}>'
        )
    else:
        return False
    
    # Send notification
    result = apobj.notify(
        title="Welcome to Soonish!",
        body=body
    )
    
    return result


async def send_invitation_email(
    email: str,
    event_name: str,
    organizer_name: str,
    token: str,
    base_url: str = "http://localhost:8000"
) -> bool:
    """Send event invitation email"""
    settings = get_settings()
    
    # Build invitation URL with encoded token
    encoded_token = quote(token, safe='')
    invitation_url = f"{base_url}/events/invite?token={encoded_token}"
    
    body = f"""
Hello!

{organizer_name} has invited you to a private event:

Event: {event_name}

Click the link below to view details and subscribe:

{invitation_url}

This invitation will expire in 7 days.

---
Soonish Event Notifications
"""
    
    # Create Apprise instance
    apobj = apprise.Apprise()
    
    # Add SMTP service
    if settings.proton_user and settings.proton_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_proton}'
            f'&user={settings.proton_user}'
            f'&pass={settings.proton_app_password}'
            f'&from=Soonish <{settings.proton_user}>'
        )
    elif settings.gmail_user and settings.gmail_app_password:
        apobj.add(
            f'mailtos://?to={email}'
            f'&smtp={settings.smtp_server_gmail}'
            f'&user={settings.gmail_user}'
            f'&pass={settings.gmail_app_password}'
            f'&from=Soonish <{settings.gmail_user}>'
        )
    else:
        return False
    
    # Send notification
    result = apobj.notify(
        title=f"Invitation to {event_name} - Soonish",
        body=body
    )
    
    return result
