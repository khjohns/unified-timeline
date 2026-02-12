"""
Project Routes Blueprint

REST API for project management.

Endpoints:
- GET /api/projects - List active projects
- GET /api/projects/<id> - Get a single project
- POST /api/projects - Create a new project
"""

from flask import Blueprint, jsonify, request

from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access, OPEN_ACCESS_PROJECTS
from utils.logger import get_logger

logger = get_logger(__name__)

projects_bp = Blueprint("projects", __name__)


def _get_project_repo():
    """Get ProjectRepository from DI Container."""
    from core.container import get_container

    return get_container().project_repository


@projects_bp.route("/api/projects", methods=["GET"])
@require_magic_link
def list_projects():
    """List projects the current user has access to."""
    try:
        email = request.magic_link_data.get("email")
        if not email:
            projects = _get_project_repo().list_active()
        else:
            from core.container import get_container
            memberships = get_container().membership_repository.get_user_projects(email)
            member_project_ids = {m.project_id for m in memberships}

            all_projects = _get_project_repo().list_active()
            projects = [
                p for p in all_projects
                if p.id in member_project_ids or p.id in OPEN_ACCESS_PROJECTS
            ]

        return jsonify({
            "projects": [p.model_dump(mode="json") for p in projects]
        })
    except Exception as e:
        logger.error(f"Failed to list projects: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@projects_bp.route("/api/projects/<project_id>", methods=["GET"])
@require_magic_link
@require_project_access()
def get_project(project_id: str):
    """Get a single project by ID."""
    try:
        project = _get_project_repo().get(project_id)
        if not project:
            return jsonify({"error": "NOT_FOUND", "message": "Prosjekt ikke funnet"}), 404
        return jsonify(project.model_dump(mode="json"))
    except Exception as e:
        logger.error(f"Failed to get project {project_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@projects_bp.route("/api/projects", methods=["POST"])
@require_csrf
@require_magic_link
def create_project():
    """Create a new project."""
    try:
        from models.project import Project

        payload = request.json
        if not payload or not payload.get("id") or not payload.get("name"):
            return jsonify({
                "error": "MISSING_PARAMETERS",
                "message": "id and name are required",
            }), 400

        # Check for duplicate
        if _get_project_repo().exists(payload["id"]):
            return jsonify({
                "error": "DUPLICATE",
                "message": f"Prosjekt '{payload['id']}' finnes allerede",
            }), 409

        project = Project(
            id=payload["id"],
            name=payload["name"],
            description=payload.get("description"),
            settings=payload.get("settings", {}),
            created_by=request.magic_link_data.get("email", "unknown"),
        )

        _get_project_repo().create(project)
        logger.info(f"Project created: {project.id}")

        return jsonify({"success": True, "project": project.model_dump(mode="json")}), 201

    except Exception as e:
        logger.error(f"Failed to create project: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
