"""
Case Routes Blueprint

Endpoints for:
- Getting case details by ID
- Saving draft changes to case
"""
import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

# Create Blueprint
case_bp = Blueprint('case', __name__)


@case_bp.route('/api/cases/<string:sakId>', methods=['GET'])
def get_case(sakId):
    """
    Get case details by ID.

    Args:
        sakId: Case identifier (from URL path)

    Returns:
        JSON with case data including:
        - sakId: Case identifier
        - topicGuid: Catenda topic GUID
        - formData: Complete case data
        - status: Current case status
    """
    # Import here to avoid circular imports
    from app import get_system

    sys = get_system()
    data = sys.db.get_form_data(sakId)

    if data:
        # Extract topicGuid from the nested 'sak' object for the response
        topic_guid = data.get('sak', {}).get('catenda_topic_id')

        # Return in format expected by React frontend
        return jsonify({
            "sakId": sakId,
            "topicGuid": topic_guid,
            "formData": data,
            "status": data.get('sak', {}).get('status', 'Ukjent'),
        }), 200

    return jsonify({"error": "Sak ikke funnet"}), 404


@case_bp.route('/api/cases/<string:sakId>/draft', methods=['PUT'])
def save_draft(sakId):
    """
    Save draft changes to a case (auto-save functionality).

    This endpoint is called frequently by the frontend to save progress
    without submitting the form.

    Args:
        sakId: Case identifier (from URL path)

    Request Body:
        formData: Complete form data to save

    Returns:
        JSON: {"success": True, "message": "Utkast lagret"}
    """
    # Import here to avoid circular imports
    from app import get_system

    sys = get_system()
    payload = request.get_json()
    form_data = payload.get('formData')

    sys.db.save_form_data(sakId, form_data)
    return jsonify({"success": True, "message": "Utkast lagret"}), 200
