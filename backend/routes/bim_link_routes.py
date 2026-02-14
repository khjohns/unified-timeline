"""
BIM Link Routes Blueprint

REST API for BIM-to-case linking.

Endpoints:
- GET    /api/saker/<sak_id>/bim-links      - List links for a case
- POST   /api/saker/<sak_id>/bim-links      - Create a new link
- DELETE /api/saker/<sak_id>/bim-links/<id>  - Remove a link
- GET    /api/bim/models                     - List cached models for active project
"""

from flask import Blueprint, jsonify, request
from pydantic import ValidationError

from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from utils.logger import get_logger

logger = get_logger(__name__)

bim_bp = Blueprint("bim", __name__)


def _get_bim_repo():
    """Get BimLinkRepository from DI Container."""
    from core.container import get_container

    return get_container().bim_link_repository


@bim_bp.route("/api/saker/<sak_id>/bim-links", methods=["GET"])
@require_magic_link
@require_project_access()
def list_bim_links(sak_id: str):
    """List all BIM links for a case."""
    try:
        links = _get_bim_repo().get_links_for_sak(sak_id)
        return jsonify([link.model_dump(mode="json") for link in links])
    except Exception as e:
        logger.error(f"Failed to get BIM links for {sak_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@bim_bp.route("/api/saker/<sak_id>/bim-links", methods=["POST"])
@require_magic_link
@require_project_access(min_role="member")
def create_bim_link(sak_id: str):
    """Create a new BIM link."""
    try:
        from models.bim_link import BimLinkCreate

        data = request.get_json()
        link_data = BimLinkCreate.model_validate(data)
        user_email = request.magic_link_data.get("email", "unknown")

        created = _get_bim_repo().create_link(sak_id, link_data, linked_by=user_email)
        return jsonify(created.model_dump(mode="json")), 201
    except ValidationError as e:
        return jsonify({"error": "VALIDATION_ERROR", "details": e.errors()}), 422
    except Exception as e:
        logger.error(f"Failed to create BIM link for {sak_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@bim_bp.route("/api/saker/<sak_id>/bim-links/<int:link_id>", methods=["DELETE"])
@require_magic_link
@require_project_access(min_role="member")
def delete_bim_link(sak_id: str, link_id: int):
    """Delete a BIM link."""
    try:
        deleted = _get_bim_repo().delete_link(link_id)
        if not deleted:
            return jsonify({"error": "NOT_FOUND", "message": "Link not found"}), 404
        return "", 204
    except Exception as e:
        logger.error(f"Failed to delete BIM link {link_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@bim_bp.route("/api/bim/models", methods=["GET"])
@require_magic_link
@require_project_access()
def list_bim_models():
    """List cached Catenda models for the active project."""
    try:
        prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
        models = _get_bim_repo().get_cached_models(prosjekt_id)
        return jsonify([m.model_dump(mode="json") for m in models])
    except Exception as e:
        logger.error(f"Failed to get BIM models: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
