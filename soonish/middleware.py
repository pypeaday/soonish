"""
Custom middleware for the Soonish application.
"""

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
import time
from typing import Dict, Tuple
import asyncio


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware to prevent API abuse.
    Uses a rolling window approach to track request counts.
    """

    def __init__(
        self,
        app,
        rate_limit: int = 100,  # requests per window
        window_size: int = 3600,  # window size in seconds
    ):
        super().__init__(app)
        self.rate_limit = rate_limit
        self.window_size = window_size
        self.requests: Dict[str, list] = {}
        self._cleanup_task = None

    async def dispatch(self, request: Request, call_next):
        """Process each request and apply rate limiting."""
        # Skip rate limiting for static files and documentation
        if request.url.path.startswith(("/static/", "/api/docs", "/api/redoc")):
            return await call_next(request)

        # Get client identifier (IP address or API key)
        client_id = request.client.host

        # Clean up old requests
        now = time.time()
        if client_id in self.requests:
            self.requests[client_id] = [
                ts for ts in self.requests[client_id] if now - ts < self.window_size
            ]
        else:
            self.requests[client_id] = []

        # Check rate limit
        if len(self.requests[client_id]) >= self.rate_limit:
            raise HTTPException(
                status_code=429, detail="Too many requests. Please try again later."
            )

        # Add current request
        self.requests[client_id].append(now)

        # Start cleanup task if not running
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_old_data())

        # Process request
        return await call_next(request)

    async def _cleanup_old_data(self):
        """Periodically clean up old request data."""
        while True:
            await asyncio.sleep(self.window_size)
            now = time.time()
            # Remove old requests and empty client records
            self.requests = {
                client_id: [ts for ts in timestamps if now - ts < self.window_size]
                for client_id, timestamps in self.requests.items()
                if any(now - ts < self.window_size for ts in timestamps)
            }


class RequestSizeMiddleware(BaseHTTPMiddleware):
    """
    Middleware to limit request body size.
    """

    def __init__(self, app, max_size: int = 1024 * 1024):  # 1MB default
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        """Check request size before processing."""
        if request.headers.get("content-length"):
            content_length = int(request.headers.get("content-length", 0))
            if content_length > self.max_size:
                raise HTTPException(
                    status_code=413,
                    detail=f"Request too large. Maximum size is {self.max_size} bytes.",
                )
        return await call_next(request)
