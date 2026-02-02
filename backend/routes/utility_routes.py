"""
Utility Routes Blueprint

Endpoints for:
- CSRF token generation
- Magic link verification
- Health checks
- User validation (Catenda project membership)
"""

import logging

from flask import Blueprint, current_app, jsonify, request

from lib.auth import generate_csrf_token, require_csrf

logger = logging.getLogger(__name__)

# Create Blueprint
utility_bp = Blueprint("utility", __name__)


@utility_bp.route("/", methods=["GET"])
def root():
    """Root endpoint - redirects to health check."""
    return jsonify({
        "service": "unified-timeline",
        "status": "running",
        "docs": "/api/routes",
        "health": "/api/health"
    }), 200


@utility_bp.route("/api/routes", methods=["GET"])
def list_routes():
    """List all registered API routes (for debugging/documentation)."""
    routes = []
    for rule in current_app.url_map.iter_rules():
        methods = sorted(rule.methods - {"HEAD", "OPTIONS"})
        if methods:
            routes.append(
                {"path": rule.rule, "methods": methods, "endpoint": rule.endpoint}
            )
    return jsonify(sorted(routes, key=lambda x: x["path"]))


@utility_bp.route("/api/csrf-token", methods=["GET"])
def get_csrf_token():
    """
    Hent CSRF-token for å beskytte state-changing operations.

    CSRF (Cross-Site Request Forgery) beskytter mot at ondsinnede nettsider
    får brukerens browser til å utføre uønskede handlinger.

    Returns:
        JSON: {"csrfToken": "...", "expiresIn": 3600}
    """
    try:
        token = generate_csrf_token()
        return jsonify(
            {
                "csrfToken": token,
                "expiresIn": 3600,  # 1 time
            }
        ), 200
    except Exception as e:
        logger.error(f"Feil ved generering av CSRF-token: {e}")
        return jsonify({"error": "Failed to generate CSRF token"}), 500


@utility_bp.route("/api/magic-link/verify", methods=["GET"])
def verify_magic_link():
    """
    Verifiserer et Magic Link token.
    Returnerer den interne sakId-en hvis token er gyldig.
    """
    from app import get_magic_link_manager

    magic_link_mgr = get_magic_link_manager()

    token = request.args.get("token", "")
    valid, error, token_data = magic_link_mgr.verify(token)

    if not valid:
        return jsonify({"error": "Invalid or expired link", "detail": error}), 403

    return jsonify({"success": True, "sakId": token_data["sak_id"]}), 200


@utility_bp.route("/api/health", methods=["GET"])
def health_check():
    """
    Health check endpoint med database-sjekk og uptime.

    Returnerer:
    - status: "healthy" | "degraded" | "unhealthy"
    - uptime: hvor lenge serveren har kjørt
    - checks: detaljer om hver komponent
    """
    import time

    checks = {
        "database": {"status": "unknown", "latency_ms": None},
        "service": {"status": "healthy"},
    }
    overall_status = "healthy"

    # Calculate uptime
    start_time = current_app.config.get("SERVER_START_TIME")
    if start_time:
        uptime_seconds = int(time.time() - start_time)
        if uptime_seconds < 60:
            uptime_str = f"{uptime_seconds}s"
        elif uptime_seconds < 3600:
            uptime_str = f"{uptime_seconds // 60}m {uptime_seconds % 60}s"
        else:
            hours = uptime_seconds // 3600
            minutes = (uptime_seconds % 3600) // 60
            uptime_str = f"{hours}h {minutes}m"
    else:
        uptime_str = "unknown"
        uptime_seconds = 0

    # Database check - prøv å hente metadata-count
    try:
        from repositories import create_metadata_repository

        start = time.time()
        repo = create_metadata_repository()
        # Enkel spørring for å verifisere tilkobling
        _ = repo.count() if hasattr(repo, "count") else repo.list_all()[:1]
        latency_ms = round((time.time() - start) * 1000, 2)

        checks["database"] = {"status": "healthy", "latency_ms": latency_ms}
    except Exception as e:
        logger.warning(f"Health check: Database unavailable - {e}")
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        overall_status = "degraded"

    status_code = 200 if overall_status == "healthy" else 503
    return jsonify(
        {
            "status": overall_status,
            "service": "unified-timeline",
            "uptime": uptime_str,
            "uptime_seconds": uptime_seconds,
            "checks": checks,
        }
    ), status_code


@utility_bp.route("/api/health/catenda", methods=["GET"])
def catenda_health_check():
    """
    Sjekk om Catenda-tilkoblingen fungerer.

    Prøver å hente prosjektlisten for å verifisere at token er gyldig.

    Returns:
        JSON: {"status": "connected" | "disconnected" | "disabled", "message": "..."}
    """
    from core.config import settings

    # Sjekk om Catenda er aktivert først
    if not settings.is_catenda_enabled:
        return jsonify(
            {"status": "disabled", "message": "Catenda-integrasjon er deaktivert"}
        ), 200

    from app import get_system

    try:
        sys = get_system()

        # Sjekk om Catenda er konfigurert
        if not sys.catenda or not sys.catenda.access_token:
            return jsonify(
                {"status": "unconfigured", "message": "Catenda er ikke konfigurert"}
            ), 200

        # Prøv å liste prosjekter for å verifisere tilkobling
        projects = sys.catenda.list_projects()

        if projects is not None:
            return jsonify(
                {
                    "status": "connected",
                    "message": f"Tilkoblet ({len(projects)} prosjekt(er))",
                }
            ), 200
        else:
            return jsonify(
                {"status": "disconnected", "message": "Kunne ikke koble til Catenda"}
            ), 200

    except Exception as e:
        logger.error(f"Feil ved Catenda health check: {e}")
        return jsonify({"status": "disconnected", "message": str(e)}), 200


@utility_bp.route("/api/metadata/by-topic/<topic_id>", methods=["GET"])
def get_metadata_by_topic(topic_id: str):
    """
    Hent sak-metadata basert på Catenda topic ID.

    Brukes av test-scripts for å verifisere at webhook ble mottatt.
    """
    from repositories import create_metadata_repository

    repo = create_metadata_repository()
    metadata = repo.get_by_topic_id(topic_id)

    if not metadata:
        return jsonify({"error": "No case found for topic", "topic_id": topic_id}), 404

    return jsonify(
        {
            "sak_id": metadata.sak_id,
            "catenda_topic_id": metadata.catenda_topic_id,
            "cached_title": metadata.cached_title,
            "cached_status": metadata.cached_status,
            "created_at": metadata.created_at.isoformat()
            if metadata.created_at
            else None,
        }
    ), 200


@utility_bp.route("/api/validate-user", methods=["POST"])
@require_csrf
def validate_user():
    """
    Validerer om en e-post tilhører en bruker i prosjektet
    og returnerer navnet.

    This endpoint is used to validate that a user email exists in the Catenda project
    before allowing them to sign forms.
    """
    # Import here to avoid circular imports
    from app import get_system

    sys = get_system()
    payload = request.get_json()
    email = payload.get("email")
    sak_id = payload.get("sakId")

    if not email or not sak_id:
        return jsonify({"error": "Mangler 'email' eller 'sakId'"}), 400

    # Finn prosjekt-ID fra saken
    sak_data = sys.db.get_form_data(sak_id)
    if not sak_data:
        return jsonify({"error": "Finner ikke sak"}), 404

    project_id = sak_data.get("sak", {}).get("catenda_project_id")
    if not project_id:
        return jsonify({"error": "Finner ikke prosjekt-ID for saken"}), 404

    # Kall den nye metoden for å finne brukeren
    user_details = sys.catenda.find_user_in_project(project_id, email)

    if user_details and user_details.get("name"):
        return jsonify(
            {
                "success": True,
                "name": user_details["name"],
                "email": user_details.get("username", email),
                "company": user_details.get("company", ""),
            }
        ), 200
    else:
        return jsonify(
            {
                "success": False,
                "error": "Brukeren er ikke medlem i dette Catenda-prosjektet.",
            }
        ), 404
