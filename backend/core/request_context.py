"""
Request Context Module

Provides request ID tracking for logging and debugging.
Each request gets a unique ID that's included in all log messages.
"""

import logging
import uuid

from flask import g, has_request_context, request


class RequestIdFilter(logging.Filter):
    """Add request_id to log records."""

    def filter(self, record):
        if has_request_context():
            record.request_id = getattr(g, "request_id", "-")
        else:
            record.request_id = "-"
        return True


def init_request_context(app):
    """Initialize request context tracking."""

    @app.before_request
    def set_request_id():
        # Use existing X-Request-ID header or generate new
        request_id = request.headers.get("X-Request-ID")
        if not request_id:
            request_id = uuid.uuid4().hex[:8]
        g.request_id = request_id
        g.request_start_time = __import__("time").time()

    @app.after_request
    def log_request(response):
        if hasattr(g, "request_start_time"):
            duration_ms = int((__import__("time").time() - g.request_start_time) * 1000)
            # Skip logging for static files and health checks in production
            if not request.path.startswith("/static"):
                logger = logging.getLogger("request")
                logger.info(
                    f"{request.method} {request.path} {response.status_code} {duration_ms}ms"
                )
        # Add request ID to response headers for client debugging
        response.headers["X-Request-ID"] = getattr(g, "request_id", "-")
        return response

    return app
