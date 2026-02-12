"""
Auto-consent OAuth route for public MCP servers.

When Supabase OAuth Server redirects to /oauth/consent?authorization_id=xxx,
this route automatically:
1. Creates an anonymous Supabase user
2. Approves the authorization request
3. Redirects back to the client (e.g., Claude.ai)

This is appropriate for MCP servers that serve public data (like KOFA decisions)
where no real user authentication is needed.

Requires:
- Anonymous sign-ins enabled in Supabase Dashboard
- MCP_REQUIRE_AUTH=true in environment
- SUPABASE_PUBLISHABLE_KEY in environment
- OAuth client registered in Supabase (e.g., for Claude.ai)
"""

import os

import httpx
from flask import Blueprint, redirect, request

from utils.logger import get_logger

logger = get_logger(__name__)

oauth_auto_consent_bp = Blueprint(
    "oauth_auto_consent", __name__, url_prefix="/oauth"
)


def _get_supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "")


def _get_supabase_publishable_key() -> str:
    return os.getenv("SUPABASE_PUBLISHABLE_KEY", "")


def _get_supabase_secret_key() -> str:
    return os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_KEY") or ""


@oauth_auto_consent_bp.route("/consent", methods=["GET"])
def auto_consent():
    """
    Handle OAuth consent automatically for public MCP servers.

    Supabase redirects here with ?authorization_id=xxx after the client
    initiates the OAuth flow. We create an anonymous user, approve the
    authorization, and redirect back.
    """
    authorization_id = request.args.get("authorization_id")
    if not authorization_id:
        return "Missing authorization_id", 400

    supabase_url = _get_supabase_url()
    publishable_key = _get_supabase_publishable_key()
    secret_key = _get_supabase_secret_key()

    if not supabase_url or not publishable_key:
        logger.error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY not configured")
        return "Server not configured for OAuth", 500

    try:
        with httpx.Client(timeout=15.0) as client:
            # Step 1: Create anonymous user
            signup_resp = client.post(
                f"{supabase_url}/auth/v1/signup",
                headers={
                    "apikey": publishable_key,
                    "Content-Type": "application/json",
                },
                json={},
            )

            if signup_resp.status_code not in (200, 201):
                logger.error(
                    f"Anonymous signup failed: {signup_resp.status_code} "
                    f"{signup_resp.text}"
                )
                return "Failed to create anonymous session", 502

            signup_data = signup_resp.json()
            access_token = signup_data.get("access_token")
            if not access_token:
                logger.error(f"No access_token in signup response: {signup_data}")
                return "Anonymous signup did not return a session", 502

            logger.info(
                f"Created anonymous user for OAuth consent: "
                f"{signup_data.get('user', {}).get('id', 'unknown')}"
            )

            # Step 2: Approve the authorization
            approve_resp = client.post(
                f"{supabase_url}/auth/v1/oauth/authorize/approve",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": secret_key or publishable_key,
                    "Content-Type": "application/json",
                },
                json={"authorizationId": authorization_id},
            )

            if approve_resp.status_code != 200:
                logger.error(
                    f"OAuth approve failed: {approve_resp.status_code} "
                    f"{approve_resp.text}"
                )
                return (
                    f"Failed to approve authorization: "
                    f"{approve_resp.text}",
                    502,
                )

            approve_data = approve_resp.json()
            redirect_url = approve_data.get("redirect_to") or approve_data.get(
                "redirect_uri"
            )

            if not redirect_url:
                logger.error(f"No redirect URL in approve response: {approve_data}")
                return "Authorization approved but no redirect URL returned", 502

            logger.info("OAuth auto-consent complete, redirecting to client")
            return redirect(redirect_url)

    except httpx.RequestError as e:
        logger.error(f"HTTP error during OAuth auto-consent: {e}")
        return "Failed to contact authorization server", 502
