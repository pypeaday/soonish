from fastapi import Request, HTTPException
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Simple in-memory rate limiter with IP logging.
    
    TODO Phase 15: Replace with Redis-backed implementation for production.
    Current implementation loses rate limit state on restart.
    """
    
    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list[datetime]] = defaultdict(list)
    
    def get_client_ip(self, request: Request) -> str:
        """Extract client IP, handling proxies and load balancers"""
        # Check X-Forwarded-For header (set by proxies/load balancers)
        if forwarded := request.headers.get("X-Forwarded-For"):
            # X-Forwarded-For can be: "client, proxy1, proxy2"
            # Take the first (leftmost) IP as the original client
            client_ip = forwarded.split(",")[0].strip()
        # Check X-Real-IP header (alternative proxy header)
        elif real_ip := request.headers.get("X-Real-IP"):
            client_ip = real_ip.strip()
        # Fallback to direct connection IP
        else:
            client_ip = request.client.host if request.client else "unknown"
        
        return client_ip
    
    async def check_rate_limit(self, request: Request):
        """
        Check if request should be rate limited.
        Raises HTTPException(429) if limit exceeded.
        """
        client_ip = self.get_client_ip(request)
        now = datetime.now(timezone.utc)
        minute_ago = now - timedelta(minutes=1)
        
        # Clean old requests (sliding window)
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if req_time > minute_ago
        ]
        
        # Check limit
        current_count = len(self.requests[client_ip])
        if current_count >= self.requests_per_minute:
            logger.warning(
                f"Rate limit exceeded: IP={client_ip}, "
                f"path={request.url.path}, "
                f"method={request.method}, "
                f"requests_in_window={current_count}"
            )
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute."
            )
        
        # Record request
        self.requests[client_ip].append(now)
        
        # Log request (info level for normal traffic)
        logger.info(
            f"Request: IP={client_ip}, "
            f"path={request.url.path}, "
            f"method={request.method}, "
            f"requests_in_window={current_count + 1}/{self.requests_per_minute}"
        )


# Global rate limiter instance
# TODO Phase 15: Move to dependency injection with Redis backend
_rate_limiter = RateLimiter(requests_per_minute=60)


async def rate_limit_middleware(request: Request, call_next):
    """
    Middleware to apply rate limiting to all requests.
    
    Usage in main.py:
        from src.api.middleware.rate_limit import rate_limit_middleware
        app.middleware("http")(rate_limit_middleware)
    """
    from fastapi.responses import JSONResponse
    
    # Skip rate limiting for health checks
    if request.url.path == "/api/health":
        return await call_next(request)
    
    # Check rate limit - catch HTTPException and convert to response
    try:
        await _rate_limiter.check_rate_limit(request)
    except HTTPException as exc:
        # Return proper JSON response for rate limit errors
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    
    # Continue with request
    response = await call_next(request)
    return response
