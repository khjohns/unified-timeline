"""
Supabase JWT Token Validation

Validates Supabase Auth JWT tokens for protected API endpoints.
Uses the JWT secret from Supabase dashboard (Settings → API → JWT Secret).
"""

import os
from functools import wraps

import jwt
from flask import g, jsonify, request

# Supabase JWT secret from environment
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")


def validate_supabase_token(token: str) -> dict | None:
    """
    Validate a Supabase JWT token.

    Args:
        token: JWT token string from Authorization header

    Returns:
        Dict with user claims if valid, None if invalid
    """
    if not SUPABASE_JWT_SECRET:
        # If no secret configured, skip validation (dev mode)
        return None

    try:
        # Supabase uses HS256 with JWT secret
        claims = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return claims
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_supabase_auth(f):
    """
    Decorator that requires valid Supabase JWT token.

    Token must be sent in Authorization header as Bearer token.
    On success, user data is available in g.current_user.

    Falls back to magic link auth if Supabase is not configured.
    Set DISABLE_AUTH=true to bypass authentication (for testing only).
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Allow bypassing auth for testing (NOT for production!)
        if os.environ.get("DISABLE_AUTH", "").lower() == "true":
            g.current_user = {
                "id": "test-user",
                "email": "test@example.com",
                "role": "authenticated",
            }
            return f(*args, **kwargs)

        # Check if Supabase JWT secret is configured
        if not SUPABASE_JWT_SECRET:
            # Fall back to magic link auth or allow if not configured
            from .magic_link import require_magic_link

            return require_magic_link(f)(*args, **kwargs)

        # Get token from Authorization header
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify(
                {
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Missing authorization header",
                }
            ), 401

        token = auth_header.split(" ")[1]
        claims = validate_supabase_token(token)

        if not claims:
            return jsonify(
                {
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Invalid or expired token",
                }
            ), 401

        # Set current user in Flask g object
        g.current_user = {
            "id": claims.get("sub"),
            "email": claims.get("email"),
            "role": claims.get("role", "authenticated"),
        }

        return f(*args, **kwargs)

    return decorated_function


def get_current_user() -> dict | None:
    """
    Get the current authenticated user from Flask g object.

    Returns:
        Dict with user info or None if not authenticated
    """
    return getattr(g, "current_user", None)
