"""
Dependencies and middleware for Soonish application.
"""
from fastapi import Request, HTTPException
from fastapi.responses import RedirectResponse
from starlette import status
from functools import wraps
from typing import Callable
import inspect

def redirect_to_landing(request: Request, exc: HTTPException) -> RedirectResponse:
    """Redirect unauthorized users to the landing page."""
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        return RedirectResponse(url='/', status_code=status.HTTP_302_FOUND)
    raise exc

def login_required(func: Callable):
    """Decorator to ensure a route requires login, redirecting to landing if not."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Get the request object from the function arguments
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break
        if not request:
            for arg in kwargs.values():
                if isinstance(arg, Request):
                    request = arg
                    break
        
        if not request:
            raise ValueError("No request object found in route arguments")
        
        # Check if user is logged in via cookie
        if not request.cookies.get("access_token"):
            return RedirectResponse(url='/', status_code=status.HTTP_302_FOUND)
        
        return await func(*args, **kwargs)
    
    # If the original function was async, return as is
    if inspect.iscoroutinefunction(func):
        return wrapper
    
    # If it was a regular function, make it async
    async def async_wrapper(*args, **kwargs):
        return wrapper(*args, **kwargs)
    return async_wrapper
