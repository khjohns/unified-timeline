"""
Auth Routes Blueprint

Endpoints for:
- User role fetching from Supabase user_groups
- Role-based access control (RBAC)
"""

import logging
from flask import Blueprint, request, jsonify, g

from lib.auth import require_supabase_auth, get_current_user

logger = logging.getLogger(__name__)

# Create Blueprint
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/user-role', methods=['GET'])
@require_supabase_auth
def get_user_role():
    """
    Hent brukerens rolle fra Supabase user_groups.

    Returnerer brukerens gruppe (byggherre/entreprenør) og eventuell godkjenningsrolle.
    Krever gyldig Supabase JWT token.

    Returns:
        JSON: {
            "success": true,
            "hasGroup": true/false,
            "userRole": "TE" | "BH" | null,
            "groupName": "entreprenør" | "byggherre" | null,
            "approvalRole": "PL" | "SL" | ... | null,
            "displayName": "Kari Nordmann" | null,
            "department": "Prosjekt A" | null
        }
    """
    from repositories.user_group_repository import create_user_group_repository

    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({
                "success": False,
                "error": "NOT_AUTHENTICATED",
                "message": "Bruker er ikke autentisert"
            }), 401

        user_id = current_user.get("id")
        if not user_id:
            return jsonify({
                "success": False,
                "error": "INVALID_USER",
                "message": "Ugyldig bruker-ID"
            }), 400

        # Try to get user group from Supabase
        repo = create_user_group_repository()

        if not repo:
            # Supabase not configured, return no group
            return jsonify({
                "success": True,
                "hasGroup": False,
                "userRole": None,
                "groupName": None,
                "approvalRole": None,
                "displayName": None,
                "department": None,
                "message": "Supabase ikke konfigurert"
            }), 200

        user_group = repo.get_user_group(user_id)

        if user_group:
            return jsonify({
                "success": True,
                "hasGroup": True,
                "userRole": user_group.get("user_role"),
                "groupName": user_group.get("group_name"),
                "approvalRole": user_group.get("approval_role"),
                "displayName": user_group.get("display_name"),
                "department": user_group.get("department")
            }), 200
        else:
            # User exists but has no group assigned
            return jsonify({
                "success": True,
                "hasGroup": False,
                "userRole": None,
                "groupName": None,
                "approvalRole": None,
                "displayName": None,
                "department": None
            }), 200

    except Exception as e:
        logger.error(f"Feil ved henting av brukerrolle: {e}")
        return jsonify({
            "success": False,
            "error": "SERVER_ERROR",
            "message": "Kunne ikke hente brukerrolle"
        }), 500


@auth_bp.route('/api/auth/user-role', methods=['PUT'])
@require_supabase_auth
def update_user_role():
    """
    Oppdater brukerens rolle (kun for admin/testing).

    Body:
        {
            "groupName": "byggherre" | "entreprenør",
            "approvalRole": "PL" | "SL" | ... | null
        }

    Returns:
        JSON: Updated user group data
    """
    from repositories.user_group_repository import create_user_group_repository

    try:
        current_user = get_current_user()
        if not current_user:
            return jsonify({
                "success": False,
                "error": "NOT_AUTHENTICATED"
            }), 401

        user_id = current_user.get("id")
        payload = request.get_json()

        if not payload:
            return jsonify({
                "success": False,
                "error": "INVALID_PAYLOAD",
                "message": "Mangler request body"
            }), 400

        repo = create_user_group_repository()
        if not repo:
            return jsonify({
                "success": False,
                "error": "NOT_CONFIGURED",
                "message": "Supabase ikke konfigurert"
            }), 503

        # Check if user already has a group
        existing = repo.get_user_group(user_id)

        if existing:
            # Update existing
            updates = {}
            if "groupName" in payload:
                updates["group_name"] = payload["groupName"]
            if "approvalRole" in payload:
                updates["approval_role"] = payload["approvalRole"]

            result = repo.update_user_group(user_id, **updates)
        else:
            # Create new
            result = repo.create_user_group(
                user_id=user_id,
                group_name=payload.get("groupName", "entreprenør"),
                approval_role=payload.get("approvalRole"),
                display_name=current_user.get("email")
            )

        if result:
            return jsonify({
                "success": True,
                "userRole": result.get("user_role"),
                "groupName": result.get("group_name"),
                "approvalRole": result.get("approval_role")
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "UPDATE_FAILED"
            }), 500

    except Exception as e:
        logger.error(f"Feil ved oppdatering av brukerrolle: {e}")
        return jsonify({
            "success": False,
            "error": "SERVER_ERROR"
        }), 500
