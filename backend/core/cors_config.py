"""
CORS Configuration Module

Centralized CORS (Cross-Origin Resource Sharing) configuration.
"""

import os
import re
from typing import List, Union
from flask import Flask
from flask_cors import CORS


def _get_allowed_origins() -> Union[List[str], str]:
    """
    Get list of allowed origins for CORS.

    Supports:
    - Explicit origins from ALLOWED_ORIGINS env var
    - ngrok URLs
    - Vercel preview deployments (pattern-based)

    Returns:
        List of allowed origins, or regex pattern for dynamic matching
    """
    # Parse allowed origins from environment
    origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")

    # Strip whitespace from origins
    origins = [o.strip() for o in origins if o.strip()]

    # Add ngrok URL if configured
    ngrok_url = os.getenv("NGROK_URL", "")
    if ngrok_url:
        origins.append(ngrok_url)

    return origins


def _origin_allowed(origin: str) -> bool:
    """
    Check if an origin is allowed, including Vercel preview deployments.

    Args:
        origin: The origin to check

    Returns:
        True if origin is allowed
    """
    if not origin:
        return False

    allowed_origins = _get_allowed_origins()

    # Check explicit origins
    if origin in allowed_origins:
        return True

    # Check Vercel preview deployments pattern
    # Format: https://{project}-{hash}-{username}.vercel.app
    # Also matches production: https://{project}.vercel.app
    # The pattern is more permissive to handle all Vercel subdomain formats
    vercel_pattern = r'^https://[a-z0-9][a-z0-9-]*\.vercel\.app$'
    if re.match(vercel_pattern, origin, re.IGNORECASE):
        return True

    # Check for Vercel preview URLs with longer subdomains
    # Format: https://{project}-{git-hash}-{org-slug}.vercel.app
    vercel_preview_pattern = r'^https://[a-z0-9][a-z0-9-]*-[a-z0-9]+-[a-z0-9-]+\.vercel\.app$'
    if re.match(vercel_preview_pattern, origin, re.IGNORECASE):
        return True

    return False


def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the Flask application.

    Args:
        app: Flask application instance
    """
    allowed_origins = _get_allowed_origins()

    # Configure CORS with dynamic origin checking
    CORS(app, resources={
        r"/api/*": {
            "origins": _origin_allowed,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
            "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
            "supports_credentials": False,
            "max_age": 3600
        }
    })
