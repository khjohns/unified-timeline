"""
Project access control decorator.

Checks that the current user (identified by email from magic link or Entra ID)
has membership in the project specified by X-Project-ID header.

Backward compatibility: The default project ('oslobygg') is open access
until all users have been migrated to project memberships.
"""

import logging
from functools import wraps

from flask import g, jsonify, request

logger = logging.getLogger(__name__)

# Projects that don't require membership checks (backward compat)
OPEN_ACCESS_PROJECTS = {"oslobygg"}


def _get_user_email() -> str | None:
    """Extract user email from request context.

    Supports:
    - Magic links: request.magic_link_data["email"]
    - Entra ID: g.entra_user.email (future)
    - DISABLE_AUTH: test@example.com
    """
    # Magic link auth
    if hasattr(request, "magic_link_data") and request.magic_link_data:
        return request.magic_link_data.get("email")

    # Entra ID auth (future)
    if hasattr(g, "entra_user") and g.entra_user:
        return g.entra_user.email

    return None


def get_container():
    """Import here to avoid circular imports."""
    from core.container import get_container

    return get_container()


def require_project_access(min_role: str = "viewer"):
    """
    Decorator that checks project membership.

    Must be used AFTER @require_magic_link or @require_entra_auth
    so that user email is available in request context.

    Args:
        min_role: Minimum required role. "viewer" < "member" < "admin"
    """
    ROLE_HIERARCHY = {"viewer": 0, "member": 1, "admin": 2}

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            project_id = getattr(g, "project_id", "oslobygg")

            # Open access projects bypass membership check
            if project_id in OPEN_ACCESS_PROJECTS:
                return f(*args, **kwargs)

            email = _get_user_email()
            if not email:
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": "Bruker-e-post ikke tilgjengelig for tilgangskontroll",
                }), 403

            repo = get_container().membership_repository
            role = repo.get_role(project_id, email)

            if role is None:
                logger.warning(
                    f"Access denied: {email} is not a member of project {project_id}"
                )
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": "Du har ikke tilgang til dette prosjektet",
                }), 403

            # Check role hierarchy
            if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get(min_role, 0):
                logger.warning(
                    f"Insufficient role: {email} has '{role}' but needs '{min_role}' "
                    f"in project {project_id}"
                )
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": f"Krever '{min_role}'-tilgang til dette prosjektet",
                }), 403

            # Store membership info in request context
            g.project_role = role
            g.user_email = email

            return f(*args, **kwargs)

        return decorated_function

    return decorator
