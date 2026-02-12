"""
Membership management routes.

Endpoints:
- GET    /api/projects/<pid>/members           - List members
- POST   /api/projects/<pid>/members           - Add member (admin only)
- DELETE /api/projects/<pid>/members/<email>    - Remove member (admin only)
- PATCH  /api/projects/<pid>/members/<email>    - Update role (admin only)
"""

from flask import Blueprint, jsonify, request

from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from models.project_membership import ProjectMembership
from utils.logger import get_logger

logger = get_logger(__name__)

membership_bp = Blueprint("membership", __name__)


def _get_membership_repo():
    from core.container import get_container

    return get_container().membership_repository


@membership_bp.route("/api/projects/<project_id>/members", methods=["GET"])
@require_magic_link
@require_project_access()
def list_members(project_id: str):
    """List all members of a project."""
    try:
        members = _get_membership_repo().get_by_project(project_id)
        return jsonify({
            "members": [m.model_dump(mode="json") for m in members]
        })
    except Exception as e:
        logger.error(f"Failed to list members for {project_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route("/api/projects/<project_id>/members", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def add_member(project_id: str):
    """Add a member to a project. Requires admin role."""
    try:
        payload = request.json
        if not payload or not payload.get("email"):
            return jsonify({
                "error": "MISSING_PARAMETERS",
                "message": "email is required",
            }), 400

        role = payload.get("role", "member")
        if role not in ("admin", "member", "viewer"):
            return jsonify({
                "error": "INVALID_ROLE",
                "message": "role must be admin, member, or viewer",
            }), 400

        email = request.magic_link_data.get("email", "unknown")

        membership = ProjectMembership(
            project_id=project_id,
            user_email=payload["email"],
            role=role,
            display_name=payload.get("display_name"),
            invited_by=email,
        )

        result = _get_membership_repo().add(membership)
        logger.info(f"Member added: {payload['email']} to {project_id} as {role}")
        return jsonify({
            "success": True,
            "member": result.model_dump(mode="json"),
        }), 201

    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return jsonify({
                "error": "DUPLICATE",
                "message": "Brukeren er allerede medlem av prosjektet",
            }), 409
        logger.error(f"Failed to add member: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route(
    "/api/projects/<project_id>/members/<path:user_email>", methods=["DELETE"]
)
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def remove_member(project_id: str, user_email: str):
    """Remove a member from a project. Requires admin role."""
    try:
        # Prevent removing yourself if you're the last admin
        current_email = request.magic_link_data.get("email", "")
        if user_email.lower() == current_email.lower():
            members = _get_membership_repo().get_by_project(project_id)
            admin_count = sum(1 for m in members if m.role == "admin")
            if admin_count <= 1:
                return jsonify({
                    "error": "LAST_ADMIN",
                    "message": "Kan ikke fjerne siste admin fra prosjektet",
                }), 400

        removed = _get_membership_repo().remove(project_id, user_email)
        if not removed:
            return jsonify({
                "error": "NOT_FOUND",
                "message": "Medlemskap ikke funnet",
            }), 404

        logger.info(f"Member removed: {user_email} from {project_id}")
        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Failed to remove member: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route(
    "/api/projects/<project_id>/members/<path:user_email>", methods=["PATCH"]
)
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def update_member_role(project_id: str, user_email: str):
    """Update a member's role. Requires admin role."""
    try:
        payload = request.json
        if not payload or not payload.get("role"):
            return jsonify({
                "error": "MISSING_PARAMETERS",
                "message": "role is required",
            }), 400

        new_role = payload["role"]
        if new_role not in ("admin", "member", "viewer"):
            return jsonify({
                "error": "INVALID_ROLE",
                "message": "role must be admin, member, or viewer",
            }), 400

        updated = _get_membership_repo().update_role(project_id, user_email, new_role)
        if not updated:
            return jsonify({
                "error": "NOT_FOUND",
                "message": "Medlemskap ikke funnet",
            }), 404

        logger.info(f"Role updated: {user_email} in {project_id} -> {new_role}")
        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Failed to update role: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
