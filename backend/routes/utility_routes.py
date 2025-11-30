"""
Utility Routes Blueprint

Endpoints for:
- CSRF token generation
- Magic link verification
- Health checks
- User validation (Catenda project membership)
"""
import logging
from flask import Blueprint, request, jsonify

from csrf_protection import generate_csrf_token
from magic_link import MagicLinkManager

logger = logging.getLogger(__name__)

# Create Blueprint
utility_bp = Blueprint('utility', __name__)

# Magic link manager instance (shared across routes)
magic_link_mgr = MagicLinkManager()


@utility_bp.route('/api/csrf-token', methods=['GET'])
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
        return jsonify({
            "csrfToken": token,
            "expiresIn": 3600  # 1 time
        }), 200
    except Exception as e:
        logger.error(f"Feil ved generering av CSRF-token: {e}")
        return jsonify({"error": "Failed to generate CSRF token"}), 500


@utility_bp.route('/api/magic-link/verify', methods=['GET'])
def verify_magic_link():
    """
    Verifiserer et Magic Link token.
    Returnerer den interne sakId-en hvis token er gyldig.
    """
    token = request.args.get('token', '')
    valid, error, token_data = magic_link_mgr.verify(token)

    if not valid:
        return jsonify({"error": "Invalid or expired link", "detail": error}), 403

    return jsonify({
        "success": True,
        "sakId": token_data["sak_id"]
    }), 200


@utility_bp.route('/api/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({"status": "healthy", "service": "koe-backend"}), 200


@utility_bp.route('/api/validate-user', methods=['POST'])
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
    email = payload.get('email')
    sak_id = payload.get('sakId')

    if not email or not sak_id:
        return jsonify({"error": "Mangler 'email' eller 'sakId'"}), 400

    # Finn prosjekt-ID fra saken
    sak_data = sys.db.get_form_data(sak_id)
    if not sak_data:
        return jsonify({"error": "Finner ikke sak"}), 404

    project_id = sak_data.get('sak', {}).get('catenda_project_id')
    if not project_id:
        return jsonify({"error": "Finner ikke prosjekt-ID for saken"}), 404

    # Kall den nye metoden for å finne brukeren
    user_details = sys.catenda.find_user_in_project(project_id, email)

    if user_details and user_details.get('name'):
        return jsonify({
            "success": True,
            "name": user_details['name'],
            "email": user_details.get('username', email),
            "company": user_details.get('company', '')
        }), 200
    else:
        return jsonify({
            "success": False,
            "error": "Brukeren er ikke medlem i dette Catenda-prosjektet."
        }), 404
