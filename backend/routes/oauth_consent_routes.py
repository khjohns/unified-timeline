"""
OAuth Consent API Routes.

These endpoints proxy OAuth consent operations to Supabase,
since the OAuth Server methods must be called from a server context.
"""

import os

import httpx
from flask import Blueprint, Response, jsonify, request

from utils.logger import get_logger

logger = get_logger(__name__)

oauth_consent_bp = Blueprint("oauth_consent", __name__, url_prefix="/api/oauth")


def _get_supabase_url() -> str:
    """Get Supabase URL from environment."""
    return os.getenv("SUPABASE_URL", "")


def _get_supabase_key() -> str:
    """Get Supabase service key from environment."""
    return (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_KEY")
        or ""
    )


@oauth_consent_bp.route("/authorization/<authorization_id>", methods=["GET"])
def get_authorization_details(authorization_id: str) -> Response:
    """
    Get OAuth authorization details.

    This endpoint proxies the request to Supabase's OAuth Server API,
    which requires server-side authentication.
    """
    supabase_url = _get_supabase_url()
    supabase_key = _get_supabase_key()

    if not supabase_url or not supabase_key:
        logger.error("Supabase not configured for OAuth consent")
        return jsonify({"error": "Server not configured"}), 500

    # Get the user's access token from the Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    user_token = auth_header.replace("Bearer ", "")

    try:
        # Call Supabase OAuth API
        with httpx.Client() as client:
            response = client.get(
                f"{supabase_url}/auth/v1/oauth/authorizations/{authorization_id}",
                headers={
                    "Authorization": f"Bearer {user_token}",
                    "apikey": supabase_key,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.warning(
                    f"Supabase OAuth API error: {response.status_code} - {response.text}"
                )
                return Response(
                    response.text,
                    status=response.status_code,
                    content_type="application/json",
                )

            return jsonify(response.json())

    except httpx.RequestError as e:
        logger.error(f"Failed to contact Supabase: {e}")
        return jsonify({"error": "Failed to contact authorization server"}), 502


@oauth_consent_bp.route("/authorization/<authorization_id>/approve", methods=["POST"])
def approve_authorization(authorization_id: str) -> Response:
    """
    Approve OAuth authorization request.
    """
    supabase_url = _get_supabase_url()
    supabase_key = _get_supabase_key()

    if not supabase_url or not supabase_key:
        return jsonify({"error": "Server not configured"}), 500

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    user_token = auth_header.replace("Bearer ", "")

    try:
        with httpx.Client() as client:
            response = client.post(
                f"{supabase_url}/auth/v1/oauth/authorizations/{authorization_id}/approve",
                headers={
                    "Authorization": f"Bearer {user_token}",
                    "apikey": supabase_key,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.warning(
                    f"Supabase OAuth approve error: {response.status_code} - {response.text}"
                )
                return Response(
                    response.text,
                    status=response.status_code,
                    content_type="application/json",
                )

            return jsonify(response.json())

    except httpx.RequestError as e:
        logger.error(f"Failed to contact Supabase: {e}")
        return jsonify({"error": "Failed to contact authorization server"}), 502


@oauth_consent_bp.route("/authorization/<authorization_id>/deny", methods=["POST"])
def deny_authorization(authorization_id: str) -> Response:
    """
    Deny OAuth authorization request.
    """
    supabase_url = _get_supabase_url()
    supabase_key = _get_supabase_key()

    if not supabase_url or not supabase_key:
        return jsonify({"error": "Server not configured"}), 500

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"error": "Missing or invalid Authorization header"}), 401

    user_token = auth_header.replace("Bearer ", "")

    try:
        with httpx.Client() as client:
            response = client.post(
                f"{supabase_url}/auth/v1/oauth/authorizations/{authorization_id}/deny",
                headers={
                    "Authorization": f"Bearer {user_token}",
                    "apikey": supabase_key,
                    "Content-Type": "application/json",
                },
                timeout=10.0,
            )

            if response.status_code != 200:
                logger.warning(
                    f"Supabase OAuth deny error: {response.status_code} - {response.text}"
                )
                return Response(
                    response.text,
                    status=response.status_code,
                    content_type="application/json",
                )

            return jsonify(response.json())

    except httpx.RequestError as e:
        logger.error(f"Failed to contact Supabase: {e}")
        return jsonify({"error": "Failed to contact authorization server"}), 502
