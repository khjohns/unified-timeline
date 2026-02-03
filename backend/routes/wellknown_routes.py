"""
OAuth well-known endpoints for MCP discovery.

These endpoints are required by Claude.ai to determine if the MCP server
requires authentication. For authless servers, we return 404 to indicate
no OAuth configuration is available.

See: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
"""

from flask import Blueprint, Response

from utils.logger import get_logger

logger = get_logger(__name__)

wellknown_bp = Blueprint("wellknown", __name__, url_prefix="/.well-known")


@wellknown_bp.route("/oauth-authorization-server", methods=["GET"])
@wellknown_bp.route("/oauth-authorization-server/<path:resource>", methods=["GET"])
def oauth_authorization_server(resource: str = "") -> Response:
    """
    OAuth 2.0 Authorization Server Metadata (RFC 8414).

    Returns 404 to indicate this server does not have OAuth configured.
    Claude.ai will then proceed without authentication.
    """
    logger.debug(f"OAuth discovery request: oauth-authorization-server/{resource}")
    return Response(
        status=404,
        response='{"error": "not_configured", "message": "OAuth not configured for this MCP server"}',
        content_type="application/json"
    )


@wellknown_bp.route("/oauth-protected-resource", methods=["GET"])
@wellknown_bp.route("/oauth-protected-resource/<path:resource>", methods=["GET"])
def oauth_protected_resource(resource: str = "") -> Response:
    """
    OAuth 2.0 Protected Resource Metadata.

    Returns 404 to indicate this resource does not require OAuth protection.
    """
    logger.debug(f"OAuth discovery request: oauth-protected-resource/{resource}")
    return Response(
        status=404,
        response='{"error": "not_configured", "message": "This MCP server does not require authentication"}',
        content_type="application/json"
    )


@wellknown_bp.route("/openid-configuration", methods=["GET"])
def openid_configuration() -> Response:
    """
    OpenID Connect Discovery.

    Returns 404 to indicate OpenID Connect is not configured.
    """
    logger.debug("OpenID Connect discovery request")
    return Response(
        status=404,
        response='{"error": "not_configured", "message": "OpenID Connect not configured"}',
        content_type="application/json"
    )
