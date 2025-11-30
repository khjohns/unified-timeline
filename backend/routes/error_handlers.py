"""
Error Handlers Module

Centralized Flask error handlers.
"""

from flask import Flask, request, jsonify, g

try:
    from lib.monitoring.audit import audit
except ImportError:
    # Fallback audit class for development
    class audit:
        @staticmethod
        def log_security_event(*args, **kwargs): pass
        @staticmethod
        def log_access_denied(*args, **kwargs): pass


def register_error_handlers(app: Flask) -> None:
    """
    Register error handlers for the Flask application.

    Args:
        app: Flask application instance
    """

    @app.errorhandler(429)
    def ratelimit_handler(e):
        """Handler for rate limit exceeded."""
        audit.log_security_event("rate_limit_exceeded", {
            "limit": str(e.description)
        })
        return jsonify({
            "error": "Rate limit exceeded",
            "detail": str(e.description),
            "retry_after": getattr(e, 'retry_after', 60)
        }), 429

    @app.errorhandler(403)
    def forbidden_handler(e):
        """Handler for access denied."""
        user = g.get('user', {})
        audit.log_access_denied(
            user=user.get('email', 'anonymous'),
            resource=request.path,
            reason=str(e)
        )
        return jsonify({"error": "Forbidden", "detail": str(e)}), 403
