"""
BIM Link Routes Blueprint

REST API for BIM-to-case linking.

Endpoints:
- GET    /api/saker/<sak_id>/bim-links                    - List links for a case
- POST   /api/saker/<sak_id>/bim-links                    - Create a new link
- DELETE /api/saker/<sak_id>/bim-links/<id>                - Remove a link
- GET    /api/saker/<sak_id>/bim-links/<id>/related        - Related BIM objects
- GET    /api/bim/models                                   - List cached models for active project
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


def _get_catenda_client():
    """Get CatendaClient from DI Container."""
    from core.container import get_container

    return get_container().catenda_client


def _get_metadata_repo():
    """Get SakMetadataRepository from DI Container."""
    from core.container import get_container

    return get_container().metadata_repository


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


RELATION_CATEGORY_LABELS = {
    "parent": "Overordnet",
    "children": "I samme rom/etasje",
    "type": "Samme type",
    "systems": "Samme system",
    "zones": "Samme sone",
    "groups": "Grupper",
}


@bim_bp.route(
    "/api/saker/<sak_id>/bim-links/<int:link_id>/related", methods=["GET"]
)
@require_magic_link
@require_project_access()
def get_related_bim_objects(sak_id: str, link_id: int):
    """Get related BIM objects for a linked IFC product."""
    try:
        # 1. Find the link and validate it has an object_id
        bim_repo = _get_bim_repo()
        links = bim_repo.get_links_for_sak(sak_id)
        link = next((l for l in links if l.id == link_id), None)
        if not link:
            return jsonify({"error": "NOT_FOUND", "message": "Link not found"}), 404
        if not link.object_id:
            return jsonify({"groups": []})

        # 2. Get catenda_project_id from metadata
        metadata = _get_metadata_repo().get(sak_id)
        if not metadata or not metadata.catenda_project_id:
            return jsonify({"groups": []})

        # 3. Fetch relations from Catenda
        catenda = _get_catenda_client()
        if not catenda:
            return jsonify({"groups": []})

        relations = catenda.get_ifc_product_relations(
            metadata.catenda_project_id, link.object_id
        )
        if not relations:
            return jsonify({"groups": []})

        # 4. Build set of already-linked object_ids for filtering
        linked_object_ids = {
            l.object_id for l in links if l.object_id is not None
        }

        # 5. Group and filter related objects
        # Catenda returns lists for children/systems/zones/groups,
        # but single dicts (or null) for parent/type.
        groups = []
        for category, label in RELATION_CATEGORY_LABELS.items():
            raw = relations.get(category)
            if raw is None:
                continue
            # Normalise: single dict → list of one
            if isinstance(raw, dict):
                raw_items = [raw]
            elif isinstance(raw, list):
                raw_items = raw
            else:
                continue

            items = []
            for item in raw_items:
                obj_id = item.get("objectId") or item.get("object_id")
                if obj_id is None or obj_id in linked_object_ids:
                    continue
                items.append(
                    {
                        "object_id": obj_id,
                        "global_id": item.get("globalId", ""),
                        "name": item.get("name"),
                        "ifc_type": item.get("ifcType"),
                    }
                )

            if items:
                groups.append(
                    {"category": category, "label": label, "items": items}
                )

        return jsonify({"groups": groups})
    except Exception as e:
        logger.error(
            f"Failed to get related BIM objects for link {link_id}: {e}",
            exc_info=True,
        )
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@bim_bp.route("/api/bim/ifc-products", methods=["GET"])
@require_magic_link
@require_project_access()
def list_ifc_products():
    """List IFC products with filtering, search, and fag lookup."""
    try:
        prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
        ifc_type = request.args.get("ifc_type")
        search = request.args.get("search", "").strip()
        page = int(request.args.get("page", 1))
        page_size = int(request.args.get("page_size", 20))

        models = _get_bim_repo().get_cached_models(prosjekt_id)
        if not models:
            return jsonify(
                {"items": [], "total": 0, "page": page, "page_size": page_size}
            )

        catenda = _get_catenda_client()
        if not catenda:
            return jsonify(
                {"items": [], "total": 0, "page": page, "page_size": page_size}
            )

        catenda_project_id = models[0].catenda_project_id

        # Build model_id → fag lookup from cached models
        model_fag: dict[str, str] = {}
        for m in models:
            if m.model_id and m.fag:
                model_fag[m.model_id] = m.fag

        if search:
            # Use query API for name search
            query: dict = {}
            if ifc_type:
                query["ifcType"] = {"$ifcType": ifc_type}
            query["attributes.Name"] = {"$regex": search, "$options": "i"}

            products = catenda.query_ifc_products(
                catenda_project_id,
                query=query,
                page=page,
                page_size=page_size,
            )
        else:
            # Simple list with optional type filter
            products = catenda.list_ifc_products(
                catenda_project_id,
                ifc_type=ifc_type,
                page=page,
                page_size=page_size,
            )

        # Map products to response format with fag lookup
        items = []
        for p in products:
            attrs = p.get("attributes", {})
            name_val = attrs.get("Name", "")
            # Name can be string or dict with value
            if isinstance(name_val, dict):
                name_val = name_val.get("value", "")
            global_id_val = attrs.get("GlobalId", "")
            if isinstance(global_id_val, dict):
                global_id_val = global_id_val.get("value", "")

            # Fag lookup: revisionId → find matching model
            fag = None
            model_name = None
            revision_id = p.get("revisionId")
            if revision_id:
                for m in models:
                    if m.fag:
                        fag = fag or m.fag
                        model_name = model_name or m.model_name

            items.append(
                {
                    "object_id": p.get("objectId"),
                    "global_id": str(global_id_val),
                    "name": str(name_val) if name_val else None,
                    "ifc_type": p.get("ifcType"),
                    "model_name": model_name,
                    "fag": fag,
                }
            )

        # Total count: use type summary for accurate count when filtering by type
        total = len(products)
        if ifc_type and not search:
            types = catenda.get_ifc_type_summary(catenda_project_id)
            total = int(types.get(ifc_type, total))

        return jsonify(
            {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )
    except Exception as e:
        logger.error(f"Failed to list IFC products: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@bim_bp.route("/api/bim/ifc-types", methods=["GET"])
@require_magic_link
@require_project_access()
def list_ifc_types():
    """Get IFC type summary (type → count) for the active Catenda project."""
    try:
        prosjekt_id = request.headers.get("X-Project-ID", "oslobygg")
        models = _get_bim_repo().get_cached_models(prosjekt_id)
        if not models:
            return jsonify({"types": {}})

        catenda = _get_catenda_client()
        if not catenda:
            return jsonify({"types": {}})

        # Use first model's catenda_project_id (all models share the same project)
        catenda_project_id = models[0].catenda_project_id
        types = catenda.get_ifc_type_summary(catenda_project_id)
        return jsonify({"types": types})
    except Exception as e:
        logger.error(f"Failed to get IFC types: {e}", exc_info=True)
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
