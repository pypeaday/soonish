"""Integration converters for Phase 15

Converts user-friendly configs to Apprise URLs.
Each converter is a simple function that takes a config model and returns an Apprise URL string.
"""

from urllib.parse import urlparse, urlencode
from src.api.integration_schemas.integration_configs import GotifyConfig


def convert_gotify_to_apprise(config: GotifyConfig) -> str:
    """Convert Gotify config to Apprise URL
    
    Args:
        config: Validated GotifyConfig model
    
    Returns:
        Apprise URL string (e.g., "gotifys://example.com/token123?priority=high")
    
    Format:
        - gotify:// for HTTP
        - gotifys:// for HTTPS
        - {hostname}/{token}
        - Optional query params: priority
    """
    # Parse the server URL to extract hostname and protocol
    parsed = urlparse(str(config.server_url))
    hostname = parsed.netloc
    
    # Use gotifys:// for HTTPS, gotify:// for HTTP
    protocol = 'gotifys' if parsed.scheme == 'https' else 'gotify'
    
    # Build base URL
    apprise_url = f"{protocol}://{hostname}/{config.token}"
    
    # Add optional query parameters
    params = {}
    if config.priority != "normal":
        params['priority'] = config.priority
    
    if params:
        apprise_url += '?' + urlencode(params)
    
    return apprise_url


# TODO: Add more converters as we expand
# def convert_email_to_apprise(config: EmailConfig) -> str: ...
# def convert_ntfy_to_apprise(config: NtfyConfig) -> str: ...
# def convert_discord_to_apprise(config: DiscordConfig) -> str: ...
# def convert_slack_to_apprise(config: SlackConfig) -> str: ...
# def convert_telegram_to_apprise(config: TelegramConfig) -> str: ...
