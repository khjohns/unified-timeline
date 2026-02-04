#!/usr/bin/env python3
"""
Register OAuth client for MCP in Supabase.

This script registers Claude.ai (or other MCP clients) as an OAuth client
in your Supabase project. Run this once to get client credentials.

Prerequisites:
    1. Enable OAuth 2.1 Server in Supabase Dashboard:
       Authentication → OAuth Server → Enable
    2. Set Authorization Path (e.g., /oauth/consent)
    3. Have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env

Usage:
    cd backend
    python scripts/register_mcp_oauth_client.py

    # Or with custom name:
    python scripts/register_mcp_oauth_client.py --name "My MCP Client"

Output:
    Client ID and Secret to use in Claude.ai connector settings.
"""

import argparse
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

# Load .env
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


def register_oauth_client(
    name: str = "Claude.ai",
    redirect_uris: list[str] | None = None
) -> dict:
    """
    Register an OAuth client in Supabase.

    Args:
        name: Display name for the client
        redirect_uris: List of allowed callback URLs

    Returns:
        Dict with client_id and client_secret
    """
    try:
        from supabase import create_client
    except ImportError:
        print("Error: supabase-py not installed. Run: pip install supabase")
        sys.exit(1)

    supabase_url = os.getenv("SUPABASE_URL")
    # Try multiple env var names for the service role key
    service_role_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
        os.getenv("SUPABASE_SECRET_KEY") or
        os.getenv("SUPABASE_KEY")
    )

    if not supabase_url:
        print("Error: SUPABASE_URL not set in .env")
        sys.exit(1)

    if not service_role_key:
        print("Error: No Supabase service key found in .env")
        print("Set one of: SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_KEY")
        sys.exit(1)

    # Default redirect URIs for Claude.ai
    if redirect_uris is None:
        redirect_uris = [
            "https://claude.ai/api/mcp/auth_callback",
            "https://claude.com/api/mcp/auth_callback",  # Future URL
        ]

    print(f"Connecting to Supabase: {supabase_url}")
    print(f"Registering OAuth client: {name}")
    print(f"Redirect URIs: {redirect_uris}")
    print()

    try:
        supabase = create_client(supabase_url, service_role_key)

        # Register the OAuth client
        result = supabase.auth.admin.oauth.create_client({
            "name": name,
            "redirect_uris": redirect_uris,
            "scopes": ["openid", "profile", "email"],
        })

        return {
            "client_id": result.client_id,
            "client_secret": result.client_secret,
            "name": name,
        }

    except AttributeError:
        print("Error: supabase.auth.admin.oauth not available.")
        print("This feature requires:")
        print("  1. Supabase OAuth 2.1 Server enabled in dashboard")
        print("  2. supabase-py version with OAuth admin support")
        print()
        print("Alternative: Use curl to register directly:")
        print_curl_example(supabase_url, service_role_key, name, redirect_uris)
        sys.exit(1)

    except Exception as e:
        print(f"Error registering client: {e}")
        print()
        print("Make sure OAuth 2.1 Server is enabled in Supabase Dashboard:")
        print("  Authentication → OAuth Server → Enable")
        sys.exit(1)


def print_curl_example(
    supabase_url: str,
    service_role_key: str,
    name: str,
    redirect_uris: list[str]
) -> None:
    """Print curl command as fallback."""
    import json
    uris_json = json.dumps(redirect_uris)
    print(f"""
curl -X POST "{supabase_url}/auth/v1/admin/oauth/clients" \\
  -H "Authorization: Bearer {service_role_key[:20]}..." \\
  -H "Content-Type: application/json" \\
  -H "apikey: {service_role_key[:20]}..." \\
  -d '{{
    "name": "{name}",
    "redirect_uris": {uris_json},
    "scopes": ["openid", "profile", "email"]
  }}'
""")


def list_oauth_clients() -> None:
    """List existing OAuth clients."""
    try:
        from supabase import create_client
    except ImportError:
        print("Error: supabase-py not installed")
        return

    supabase_url = os.getenv("SUPABASE_URL")
    service_role_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or
        os.getenv("SUPABASE_SECRET_KEY") or
        os.getenv("SUPABASE_KEY")
    )

    if not supabase_url or not service_role_key:
        print("Error: Missing SUPABASE_URL or Supabase service key")
        return

    try:
        supabase = create_client(supabase_url, service_role_key)
        clients = supabase.auth.admin.oauth.list_clients()

        if not clients:
            print("No OAuth clients registered.")
            return

        print("Registered OAuth clients:")
        print("-" * 50)
        for client in clients:
            print(f"  Name: {client.name}")
            print(f"  Client ID: {client.client_id}")
            print(f"  Redirect URIs: {client.redirect_uris}")
            print("-" * 50)

    except Exception as e:
        print(f"Error listing clients: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Register OAuth client for MCP in Supabase"
    )
    parser.add_argument(
        "--name",
        default="Claude.ai",
        help="Display name for the OAuth client"
    )
    parser.add_argument(
        "--redirect-uri",
        action="append",
        dest="redirect_uris",
        help="Redirect URI (can be specified multiple times)"
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List existing OAuth clients"
    )

    args = parser.parse_args()

    if args.list:
        list_oauth_clients()
        return

    result = register_oauth_client(
        name=args.name,
        redirect_uris=args.redirect_uris
    )

    print("=" * 60)
    print("OAuth Client Registered Successfully!")
    print("=" * 60)
    print()
    print("Save these credentials securely:")
    print()
    print(f"  Client ID:     {result['client_id']}")
    print(f"  Client Secret: {result['client_secret']}")
    print()
    print("=" * 60)
    print()
    print("Next steps:")
    print()
    print("1. Add to .env (optional, for reference):")
    print(f"   MCP_OAUTH_CLIENT_ID={result['client_id']}")
    print(f"   MCP_OAUTH_CLIENT_SECRET={result['client_secret']}")
    print()
    print("2. Configure in Claude.ai:")
    print("   Settings → Connectors → Add custom connector")
    print("   URL: https://your-backend.onrender.com/mcp/")
    print("   ▼ Advanced settings")
    print(f"     Client ID: {result['client_id']}")
    print(f"     Client Secret: {result['client_secret']}")
    print()
    print("3. Enable OAuth in MCP (when ready):")
    print("   Set MCP_REQUIRE_AUTH=true in .env")
    print()


if __name__ == "__main__":
    main()
