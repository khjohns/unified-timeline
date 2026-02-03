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

# Rate limit strategy (Flask-Limiter 4.x)
# - fixed-window: Enkleste, lavest ressursbruk (default)
# - moving-window: Mer nøyaktig, krever Redis
# - sliding-window-counter: Balanse mellom de to
RATE_LIMIT_STRATEGY = os.getenv("RATE_LIMIT_STRATEGY", "fixed-window")

# Rate limit headers (Flask-Limiter 4.x)
# Når aktivert, legges følgende headers til i responses:
# - X-RateLimit-Limit: Maks antall requests
# - X-RateLimit-Remaining: Gjenstående requests
# - X-RateLimit-Reset: Unix timestamp for når vinduet nullstilles
# - Retry-After: Sekunder til neste request tillates (kun ved 429)
RATE_LIMIT_HEADERS_ENABLED = (
    os.getenv("RATE_LIMIT_HEADERS_ENABLED", "true").lower() == "true"
)

# Meta limits (Flask-Limiter 4.x)
# Overordnet beskyttelse mot misbruk - begrenser antall rate limit brudd.
# Hvis en klient bryter limits for ofte, blokkeres de midlertidig.
# Format: "antall per tidsperiode" (f.eks. "10 per hour, 50 per day")
# Tom streng = deaktivert
RATE_LIMIT_META = os.getenv("RATE_LIMIT_META", "10 per hour, 50 per day")

# Paths som er unntatt fra rate limiting (kommaseparert)
# Typisk: health checks, metrics, readiness probes
RATE_LIMIT_EXEMPT_PATHS = os.getenv(
    "RATE_LIMIT_EXEMPT_PATHS", "/health,/ready,/metrics"
).split(",")

# IP-adresser som er unntatt fra rate limiting (kommaseparert)
# Typisk: localhost, interne lastbalanserere, monitoring
RATE_LIMIT_EXEMPT_IPS = os.getenv(
    "RATE_LIMIT_EXEMPT_IPS", "127.0.0.1,::1"
).split(",")

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
        from flask import request
        from flask_limiter import Limiter
        from flask_limiter.util import get_remote_address

        # Parse meta limits (hvis konfigurert)
        meta_limits = []
        if RATE_LIMIT_META:
            meta_limits = [limit.strip() for limit in RATE_LIMIT_META.split(",")]

        limiter = Limiter(
            app=app,
            key_func=get_remote_address,
            default_limits=[RATE_LIMIT_DEFAULT],
            storage_uri=RATE_LIMIT_STORAGE,
            strategy=RATE_LIMIT_STRATEGY,
            headers_enabled=RATE_LIMIT_HEADERS_ENABLED,
            meta_limits=meta_limits if meta_limits else None,
        )

        # Request filter: Unnta spesifikke paths (health checks, metrics, etc.)
        @limiter.request_filter
        def exempt_paths():
            return request.path in RATE_LIMIT_EXEMPT_PATHS

        # Request filter: Unnta spesifikke IP-adresser (localhost, interne tjenester)
        @limiter.request_filter
        def exempt_ips():
            return request.remote_addr in RATE_LIMIT_EXEMPT_IPS

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
            if meta_limits:
                logger.info(f"   Meta limits: {meta_limits}")

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
