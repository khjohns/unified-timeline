"""
Rate Limiting Module

Sentralisert rate limiting for hele applikasjonen.
Kan importeres av blueprints og andre moduler.

For produksjon:
- Bytt storage_uri til Redis: "redis://localhost:6379"
- Eller Azure Redis: "redis://hostname:6380?password=xxx&ssl=True"

Referanser:
- Flask-Limiter docs: https://flask-limiter.readthedocs.io/
"""

import logging
import os

logger = logging.getLogger(__name__)

# Rate limit verdier fra miljøvariabler (eller defaults)
RATE_LIMIT_SUBMIT = os.getenv("RATE_LIMIT_SUBMIT", "10")  # per minutt
RATE_LIMIT_WEBHOOK = os.getenv("RATE_LIMIT_WEBHOOK", "100")  # per minutt
RATE_LIMIT_DEFAULT = os.getenv("RATE_LIMIT_DEFAULT", "2000 per day, 500 per hour")

# Storage backend
# For prototype: memory://
# For produksjon: redis://host:port eller Azure Redis
RATE_LIMIT_STORAGE = os.getenv("RATE_LIMIT_STORAGE", "memory://")

# Limiter instance (initialized when Flask app is created)
limiter = None


def init_limiter(app):
    """
    Initialize rate limiter with Flask app.

    Must be called from app.py after Flask app is created.

    Args:
        app: Flask application instance

    Returns:
        Limiter instance or None if Flask-Limiter not installed
    """
    global limiter

    try:
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address

        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            default_limits=[RATE_LIMIT_DEFAULT],
            storage_uri=RATE_LIMIT_STORAGE,
        )

        # Only log once (skip in reloader parent process)
        is_reloader = os.getenv("WERKZEUG_RUN_MAIN") == "true"
        is_debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
        if is_reloader or not is_debug:
            if RATE_LIMIT_STORAGE == "memory://":
                logger.warning(
                    "⚠️  Rate limiting: in-memory storage (bruk Redis i prod)"
                )
            else:
                logger.info(f"✅ Rate limiting: {RATE_LIMIT_STORAGE}")

        return limiter

    except ImportError:
        logger.warning("⚠️  Flask-Limiter ikke installert. Rate limiting deaktivert.")
        logger.warning("   Installer med: pip install Flask-Limiter")
        return None


def get_limiter():
    """
    Get limiter instance.

    Returns:
        Limiter instance or None if not initialized
    """
    return limiter


def limit_submit(f):
    """
    Decorator for submit endpoints.

    Applies rate limit for form submissions (default: 10 per minute).

    Usage:
        @app.route('/api/submit', methods=['POST'])
        @limit_submit
        def submit():
            ...
    """
    if limiter is None:
        return f
    return limiter.limit(f"{RATE_LIMIT_SUBMIT} per minute")(f)


def limit_webhook(f):
    """
    Decorator for webhook endpoints.

    Applies rate limit for webhooks (default: 100 per minute).

    Usage:
        @app.route('/webhook', methods=['POST'])
        @limit_webhook
        def webhook():
            ...
    """
    if limiter is None:
        return f
    return limiter.limit(f"{RATE_LIMIT_WEBHOOK} per minute")(f)
