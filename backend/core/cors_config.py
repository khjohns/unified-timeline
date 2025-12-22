"""
CORS Configuration Module

Centralized CORS (Cross-Origin Resource Sharing) configuration.
"""

import os
import re
from typing import List
from flask import Flask, request
from flask_cors import CORS


def _get_allowed_origins() -> List[str]:
    """
    Get list of allowed origins for CORS.

    Supports:
    - Explicit origins from ALLOWED_ORIGINS env var
    - ngrok URLs

    Returns:
        List of allowed origins
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


def _is_vercel_origin(origin: str) -> bool:
    """
    Check if origin is a Vercel deployment (production or preview).

    Args:
        origin: The origin to check

    Returns:
        True if origin is a Vercel deployment
    """
    if not origin:
        return False

    # Match all Vercel domains: https://*.vercel.app
    vercel_pattern = r'^https://[a-z0-9][a-z0-9-]*\.vercel\.app$'
    return bool(re.match(vercel_pattern, origin, re.IGNORECASE))


def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the Flask application.

    Args:
        app: Flask application instance
    """
    allowed_origins = _get_allowed_origins()

    # Configure CORS with explicit origins
    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
            "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
            "supports_credentials": False,
            "max_age": 3600
        }
    })

    # Add dynamic Vercel origin support via after_request
    @app.after_request
    def add_vercel_cors_headers(response):
        origin = request.headers.get('Origin', '')

        # If origin is a Vercel deployment and not already allowed, add CORS headers
        if _is_vercel_origin(origin) and origin not in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token, Authorization'
            response.headers['Access-Control-Expose-Headers'] = 'X-RateLimit-Remaining, X-RateLimit-Reset'
            response.headers['Access-Control-Max-Age'] = '3600'

        return response
