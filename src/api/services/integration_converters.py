"""Integration converters for Phase 15

Converts user-friendly configs to Apprise URLs.
Each converter is a simple function that takes a config model and returns an Apprise URL string.
"""

from urllib.parse import urlparse, urlencode, quote
from src.api.integration_schemas.integration_configs import (
    GotifyConfig,
    EmailConfig,
    NtfyConfig,
    DiscordConfig,
    SlackConfig,
)


def convert_gotify_to_apprise(config: GotifyConfig) -> str:
    """Convert Gotify config to Apprise URL
    
    Format: gotify[s]://{hostname}/{token}?priority={priority}
    """
    parsed = urlparse(str(config.server_url))
    hostname = parsed.netloc
    protocol = 'gotifys' if parsed.scheme == 'https' else 'gotify'
    
    apprise_url = f"{protocol}://{hostname}/{config.token}"
    
    params = {}
    if config.priority != "normal":
        params['priority'] = config.priority
    
    if params:
        apprise_url += '?' + urlencode(params)
    
    return apprise_url


def convert_email_to_apprise(config: EmailConfig) -> str:
    """Convert Email config to Apprise URL
    
    Format: mailto://{user}:{password}@{host}:{port}?from={from_email}&to={to_email}&smtp={mode}
    """
    user = quote(config.smtp_user, safe='')
    password = quote(config.smtp_password, safe='')
    
    apprise_url = f"mailto://{user}:{password}@{config.smtp_host}:{config.smtp_port}"
    
    params = {
        'from': config.from_email,
        'to': config.to_email,
    }
    
    # Add TLS mode
    if config.use_tls:
        params['smtp'] = 'starttls'
    
    apprise_url += '?' + urlencode(params)
    
    return apprise_url


def convert_ntfy_to_apprise(config: NtfyConfig) -> str:
    """Convert Ntfy config to Apprise URL
    
    Format: ntfy://{hostname}/{topic}?priority={priority}
    """
    parsed = urlparse(str(config.server_url))
    hostname = parsed.netloc
    
    apprise_url = f"ntfy://{hostname}/{config.topic}"
    
    params = {}
    if config.priority != "default":
        params['priority'] = config.priority
    
    if params:
        apprise_url += '?' + urlencode(params)
    
    return apprise_url


def convert_discord_to_apprise(config: DiscordConfig) -> str:
    """Convert Discord config to Apprise URL
    
    Format: discord://{webhook_id}/{webhook_token}
    
    Extracts webhook_id and webhook_token from the full webhook URL.
    """
    url_str = str(config.webhook_url)
    
    # Extract webhook_id and webhook_token from URL
    # Format: https://discord.com/api/webhooks/{webhook_id}/{webhook_token}
    parts = url_str.split('/webhooks/')
    if len(parts) != 2:
        raise ValueError("Invalid Discord webhook URL format")
    
    webhook_parts = parts[1].split('/')
    if len(webhook_parts) < 2:
        raise ValueError("Invalid Discord webhook URL format")
    
    webhook_id = webhook_parts[0]
    webhook_token = webhook_parts[1]
    
    return f"discord://{webhook_id}/{webhook_token}"


def convert_slack_to_apprise(config: SlackConfig) -> str:
    """Convert Slack config to Apprise URL
    
    Format: slack://{tokenA}/{tokenB}/{tokenC}
    
    Extracts tokens from the full webhook URL.
    """
    url_str = str(config.webhook_url)
    
    # Extract tokens from URL
    # Format: https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX
    parts = url_str.split('/services/')
    if len(parts) != 2:
        raise ValueError("Invalid Slack webhook URL format")
    
    tokens = parts[1].split('/')
    if len(tokens) < 3:
        raise ValueError("Invalid Slack webhook URL format")
    
    return f"slack://{tokens[0]}/{tokens[1]}/{tokens[2]}"
