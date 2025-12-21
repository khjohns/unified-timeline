# backend/magic_link.py
import uuid
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Dict
from pathlib import Path
from threading import RLock
from functools import wraps
from flask import request, jsonify

class MagicLinkManager:
    """
    Håndterer generering og validering av Magic Links med fil-lagring.
    Tokens lagres i `koe_data/magic_links.json` for å overleve server-restarts.

    Session-Based Mode:
    - Tokens are valid for 24-72 hours from creation
    - Can be used multiple times within TTL (session-based access)
    - mark_as_used parameter allows selective one-time-use for critical operations
    """

    def __init__(self, storage_dir="koe_data"):
        self.storage_path = Path(storage_dir) / "magic_links.json"
        self.lock = RLock()
        self.tokens = self._load_tokens()

    def _load_tokens(self) -> Dict[str, Dict]:
        with self.lock:
            if not self.storage_path.exists():
                return {}
            try:
                with open(self.storage_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except (IOError, json.JSONDecodeError):
                return {}

    def _save_tokens(self):
        with self.lock:
            self.storage_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.storage_path, 'w', encoding='utf-8') as f:
                json.dump(self.tokens, f, indent=2)

    def generate(self, sak_id: str, email: str = None, ttl_hours: int = 72) -> str:
        """
        Generer Magic Link token og lagre til fil.
        """
        if ttl_hours > 72:
            raise ValueError("TTL cannot exceed 72 hours")

        token = str(uuid.uuid4())
        now = datetime.utcnow()
        expires_at = now + timedelta(hours=ttl_hours)

        self.tokens[token] = {
            "sak_id": sak_id,
            "email": email.lower().strip() if email else None,
            "created_at": now.isoformat() + "Z",
            "expires_at": expires_at.isoformat() + "Z",
            "used": False,
            "used_at": None,
            "revoked": False,
            "revoked_at": None
        }
        self._save_tokens()
        return token

    def verify(self, token: str, mark_as_used: bool = False) -> tuple[bool, str, Optional[Dict]]:
        """
        Verifiser Magic Link token fra fil.

        Args:
            token: Token string to verify
            mark_as_used: If True, mark token as consumed (for one-time operations)
                         If False, allow reuse within TTL (for session-based access)

        Returns:
            (is_valid, message, token_data)

        Examples:
            # Session-based access (default, allow multiple requests)
            valid, msg, data = manager.verify(token)

            # One-time-use (for critical operations like admin actions)
            valid, msg, data = manager.verify(token, mark_as_used=True)
        """
        # Kritisk: Last inn tokens på nytt for å garantere at vi har siste versjon
        self.tokens = self._load_tokens()

        if token not in self.tokens:
            return False, "Invalid token", None

        meta = self.tokens[token]

        if meta.get("revoked"):
            return False, "Token has been revoked", None

        # Check if already used (only relevant if mark_as_used was previously True)
        if meta.get("used"):
            return False, "Token already used", None

        # Konverter expires_at fra string til datetime for sammenligning
        try:
            # Håndterer "Z" for UTC
            expires_at_dt = datetime.fromisoformat(meta["expires_at"].replace("Z", "+00:00"))
        except (TypeError, ValueError):
             return False, "Invalid token metadata: unparseable expiry date", None

        if datetime.utcnow().replace(tzinfo=expires_at_dt.tzinfo) > expires_at_dt:
            return False, f"Token expired at {meta['expires_at']}", None

        # Update last_accessed for monitoring
        meta["last_accessed"] = datetime.utcnow().isoformat() + "Z"

        # ✅ Gyldig token - marker som brukt bare hvis eksplisitt forespurt
        if mark_as_used:
            meta["used"] = True
            meta["used_at"] = datetime.utcnow().isoformat() + "Z"

        self._save_tokens()

        token_data = {
            "sak_id": meta["sak_id"],
            "email": meta["email"]
        }
        return True, "", token_data

    def revoke(self, token: str):
        """Revoke token og lagre endringen."""
        if token in self.tokens:
            with self.lock:
                if token in self.tokens: # Dobbeltsjekk etter lås
                    self.tokens[token]["revoked"] = True
                    self.tokens[token]["revoked_at"] = datetime.utcnow().isoformat() + "Z"
                    self._save_tokens()


# ============ DECORATOR ============

# Singleton instance
_magic_link_manager = None

def get_magic_link_manager():
    """Get or create the singleton MagicLinkManager instance."""
    global _magic_link_manager
    if _magic_link_manager is None:
        _magic_link_manager = MagicLinkManager()
    return _magic_link_manager


def require_magic_link(f):
    """
    Dekoratør som krever gyldig magic link token.

    Token må sendes i Authorization header som Bearer token.
    Ved suksess legges token-data i request.magic_link_data.

    Token is verified in session-based mode (allows multiple requests).
    Use mark_as_used=True manually for one-time critical operations.

    Set DISABLE_AUTH=true to bypass authentication (for testing only).
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Allow bypassing auth for testing (NOT for production!)
        if os.environ.get('DISABLE_AUTH', '').lower() == 'true':
            request.magic_link_data = {"sak_id": None, "email": "test@example.com"}
            return f(*args, **kwargs)

        # Hent token fra Authorization header
        auth_header = request.headers.get('Authorization', '')
        token = auth_header.replace('Bearer ', '').strip()

        if not token:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Mangler magic link token"
            }), 401

        # Verifiser token i session-based mode (mark_as_used=False)
        manager = get_magic_link_manager()
        valid, message, data = manager.verify(token, mark_as_used=False)

        if not valid:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": f"Ugyldig token: {message}"
            }), 401

        # Legg token-data i request context
        request.magic_link_data = data

        return f(*args, **kwargs)

    return decorated_function

