"""
CORS Configuration Module

Centralized CORS (Cross-Origin Resource Sharing) configuration.
"""

import os
from flask import Flask
from flask_cors import CORS


def setup_cors(app: Flask) -> None:
    """
    Configure CORS for the Flask application.

    Args:
        app: Flask application instance
    """
    # Parse allowed origins from environment
    ALLOWED_ORIGINS = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")

    # Add ngrok URL if configured
    NGROK_URL = os.getenv("NGROK_URL", "")
    if NGROK_URL:
        ALLOWED_ORIGINS.append(NGROK_URL)

    # Configure CORS
    CORS(app, resources={
        r"/api/*": {
            "origins": ALLOWED_ORIGINS,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-CSRF-Token", "Authorization"],
            "expose_headers": ["X-RateLimit-Remaining", "X-RateLimit-Reset"],
            "supports_credentials": False,
            "max_age": 3600
        }
    })
