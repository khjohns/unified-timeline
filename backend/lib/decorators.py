"""
Route Decorators

Provides reusable decorators for Flask route handlers.
"""
from functools import wraps
from flask import jsonify

from utils.logger import get_logger

logger = get_logger(__name__)


def handle_service_errors(f):
    """
    Decorator for consistent error handling in route handlers.

    Catches common exceptions and returns standardized JSON error responses:
    - ValueError → 400 VALIDATION_ERROR
    - RuntimeError → 502 CATENDA_ERROR
    - Exception → 500 INTERNAL_ERROR

    Usage:
        @app.route('/api/example', methods=['POST'])
        @handle_service_errors
        def example_endpoint():
            # Your logic here - exceptions are handled automatically
            return jsonify({"success": True, "data": ...})
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"Validation failed: {e}")
            return jsonify({
                "success": False,
                "error": "VALIDATION_ERROR",
                "message": str(e)
            }), 400
        except RuntimeError as e:
            logger.error(f"Catenda/Runtime error: {e}")
            return jsonify({
                "success": False,
                "error": "CATENDA_ERROR",
                "message": str(e)
            }), 502
        except Exception as e:
            logger.exception("Unexpected error in route handler")
            return jsonify({
                "success": False,
                "error": "INTERNAL_ERROR",
                "message": "En uventet feil oppstod"
            }), 500
    return wrapper
