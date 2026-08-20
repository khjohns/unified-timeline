"""
CORS Configuration Module

Centralized CORS (Cross-Origin Resource Sharing) configuration.
"""

import os
import re

from flask import Flask, request
from flask_cors import CORS


def _get_allowed_origins() -> list:
    """
    Get list of allowed origins for CORS.

    Supports:
    - Explicit origins from ALLOWED_ORIGINS env var
    - ngrok URLs
    - Regex patterns for Cloud Run, Vercel, and Azure Static Web Apps

    Returns:
        List of allowed origins / regex patterns
    """
    # Parse allowed origins from environment
    origins: list = [
        o.strip()
        for o in os.getenv(
            "ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if o.strip()
    ]

    # Add ngrok URL if configured
    ngrok_url = os.getenv("NGROK_URL", "")
    if ngrok_url:
        origins.append(ngrok_url)

    # Add regex patterns for cloud deployments
    origins.extend([
        re.compile(r"^https://([a-z0-9-]+\.)*run\.app(:[0-9]+)?$", re.IGNORECASE),
        re.compile(r"^https://([a-z0-9-]+\.)*vercel\.app(:[0-9]+)?$", re.IGNORECASE),
        re.compile(r"^https://([a-z0-9-]+\.)*azurestaticapps\.net(:[0-9]+)?$", re.IGNORECASE),
    ])

    return origins


def _is_dynamic_allowed_origin(origin: str) -> bool:
    """
    Check if origin is a dynamic cloud deployment (Cloud Run, Vercel, Azure).

    Args:
        origin: The origin to check

    Returns:
        True if origin is allowed
    """
    if not origin:
        return False

    pattern = r"^https://([a-z0-9-]+\.)*(run\.app|vercel\.app|azurestaticapps\.net)(:[0-9]+)?$"
    return bool(re.match(pattern, origin, re.IGNORECASE))


def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the Flask application.

    Args:
        app: Flask application instance
    """
    allowed_origins = _get_allowed_origins()

    # Configure CORS with explicit origins and regexes
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": allowed_origins,
                "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization", "X-Project-ID"],
                "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
                "supports_credentials": False,
                "max_age": 3600,
            }
        },
    )

    # Add dynamic Cloud Run / Vercel origin support via after_request
    @app.after_request
    def add_dynamic_cors_headers(response):
        origin = request.headers.get("Origin", "")

        # If origin is a recognized cloud deployment, ensure CORS headers are set
        if _is_dynamic_allowed_origin(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, X-CSRF-Token, Authorization, X-Project-ID"
            )
            response.headers["Access-Control-Expose-Headers"] = (
                "X-RateLimit-Remaining, X-RateLimit-Reset"
            )
            response.headers["Access-Control-Max-Age"] = "3600"

        return response
