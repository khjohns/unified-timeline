"""
OAuth well-known endpoints for MCP discovery.

These endpoints are required by Claude.ai to determine if the MCP server
requires authentication. When MCP_REQUIRE_AUTH=true, we return OAuth metadata
pointing to Supabase as the authorization server.

See: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
"""

import json
import os

from flask import Blueprint, Response, request

from utils.logger import get_logger

logger = get_logger(__name__)

wellknown_bp = Blueprint("wellknown", __name__, url_prefix="/.well-known")


def _is_auth_enabled() -> bool:
    """Check if MCP OAuth authentication is enabled."""
    return os.getenv("MCP_REQUIRE_AUTH", "").lower() == "true"


def _get_supabase_url() -> str:
    """Get Supabase URL from environment."""
    return os.getenv("SUPABASE_URL", "")


@wellknown_bp.route("/oauth-authorization-server", methods=["GET"])
@wellknown_bp.route("/oauth-authorization-server/<path:resource>", methods=["GET"])
def oauth_authorization_server(resource: str = "") -> Response:
    """
    OAuth 2.0 Authorization Server Metadata (RFC 8414).

    When MCP_REQUIRE_AUTH=true, returns metadata pointing to Supabase.
    Otherwise returns 404 to indicate OAuth is not configured.
    """
    logger.debug(f"OAuth discovery request: oauth-authorization-server/{resource}")

    if not _is_auth_enabled():
        return Response(
            status=404,
            response='{"error": "not_configured", "message": "OAuth not configured for this MCP server"}',
            content_type="application/json"
        )

    supabase_url = _get_supabase_url()
    if not supabase_url:
        logger.error("MCP_REQUIRE_AUTH=true but SUPABASE_URL not set")
        return Response(
            status=500,
            response='{"error": "misconfigured", "message": "OAuth enabled but authorization server not configured"}',
            content_type="application/json"
        )

    # Supabase OAuth 2.1 endpoints
    auth_base = f"{supabase_url}/auth/v1"

    metadata = {
        "issuer": auth_base,
        "authorization_endpoint": f"{auth_base}/authorize",
        "token_endpoint": f"{auth_base}/token",
        "userinfo_endpoint": f"{auth_base}/userinfo",
        "jwks_uri": f"{supabase_url}/auth/v1/.well-known/jwks.json",
        "registration_endpoint": None,  # Dynamic registration not supported
        "scopes_supported": ["openid", "profile", "email"],
        "response_types_supported": ["code"],
        "response_modes_supported": ["query"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],  # PKCE required
        "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
        "service_documentation": "https://supabase.com/docs/guides/auth",
    }

    logger.info(f"Returning OAuth metadata pointing to {auth_base}")
    return Response(
        status=200,
        response=json.dumps(metadata),
        content_type="application/json"
    )


@wellknown_bp.route("/oauth-protected-resource", methods=["GET"])
@wellknown_bp.route("/oauth-protected-resource/<path:resource>", methods=["GET"])
def oauth_protected_resource(resource: str = "") -> Response:
    """
    OAuth 2.0 Protected Resource Metadata (RFC 9470).

    When MCP_REQUIRE_AUTH=true, returns metadata indicating this resource
    requires OAuth authentication via Supabase.
    """
    logger.debug(f"OAuth discovery request: oauth-protected-resource/{resource}")

    if not _is_auth_enabled():
        return Response(
            status=404,
            response='{"error": "not_configured", "message": "This MCP server does not require authentication"}',
            content_type="application/json"
        )

    supabase_url = _get_supabase_url()
    if not supabase_url:
        logger.error("MCP_REQUIRE_AUTH=true but SUPABASE_URL not set")
        return Response(
            status=500,
            response='{"error": "misconfigured", "message": "OAuth enabled but authorization server not configured"}',
            content_type="application/json"
        )

    # Get the base URL of this MCP server
    mcp_base_url = request.url_root.rstrip("/")

    metadata = {
        "resource": f"{mcp_base_url}/mcp/",
        "authorization_servers": [f"{supabase_url}/auth/v1"],
        "scopes_supported": ["openid", "profile", "email"],
        "bearer_methods_supported": ["header"],
    }

    logger.info(f"Returning protected resource metadata for {mcp_base_url}/mcp/")
    return Response(
        status=200,
        response=json.dumps(metadata),
        content_type="application/json"
    )


@wellknown_bp.route("/openid-configuration", methods=["GET"])
def openid_configuration() -> Response:
    """
    OpenID Connect Discovery.

    When MCP_REQUIRE_AUTH=true, redirects to Supabase's OIDC configuration.
    Otherwise returns 404.
    """
    logger.debug("OpenID Connect discovery request")

    if not _is_auth_enabled():
        return Response(
            status=404,
            response='{"error": "not_configured", "message": "OpenID Connect not configured"}',
            content_type="application/json"
        )

    supabase_url = _get_supabase_url()
    if not supabase_url:
        logger.error("MCP_REQUIRE_AUTH=true but SUPABASE_URL not set")
        return Response(
            status=500,
            response='{"error": "misconfigured", "message": "OAuth enabled but authorization server not configured"}',
            content_type="application/json"
        )

    # Supabase OIDC configuration endpoint
    auth_base = f"{supabase_url}/auth/v1"

    # Return OIDC-compatible metadata
    metadata = {
        "issuer": auth_base,
        "authorization_endpoint": f"{auth_base}/authorize",
        "token_endpoint": f"{auth_base}/token",
        "userinfo_endpoint": f"{auth_base}/userinfo",
        "jwks_uri": f"{supabase_url}/auth/v1/.well-known/jwks.json",
        "scopes_supported": ["openid", "profile", "email"],
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "code_challenge_methods_supported": ["S256"],
    }

    logger.info(f"Returning OIDC configuration pointing to {auth_base}")
    return Response(
        status=200,
        response=json.dumps(metadata),
        content_type="application/json"
    )
