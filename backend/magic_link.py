# backend/magic_link.py
import uuid
from datetime import datetime, timedelta
from typing import Optional, Dict

class MagicLinkManager:
    """
    Håndterer generering og validering av Magic Links.

    Features:
    - UUID v4 tokens
    - TTL ≤ 72 timer
    - One-time use (revokering)
    - Personlig (1:1 e-post binding)
    """

    def __init__(self):
        # In-memory storage (bruk database i prod)
        self.tokens: Dict[str, Dict] = {}

    def generate(self, sak_id: str, email: str = None, ttl_hours: int = 72) -> str:
        """
        Generer Magic Link token.

        Args:
            sak_id: Sak som lenken gir tilgang til
            email: E-postadresse (valgfri, for fremtidig 1:1 binding)
            ttl_hours: Time-to-live (max 72)

        Returns:
            Token (UUID v4)
        """
        if ttl_hours > 72:
            raise ValueError("TTL cannot exceed 72 hours")

        # Generer UUID v4
        token = str(uuid.uuid4())

        # Lagre token metadata
        self.tokens[token] = {
            "sak_id": sak_id,
            "email": email.lower().strip() if email else None,
            "created_at": datetime.utcnow(),
            "expires_at": datetime.utcnow() + timedelta(hours=ttl_hours),
            "used": False,
            "revoked": False
        }

        return token

    def verify(self, token: str) -> tuple[bool, str, Optional[Dict]]:
        """
        Verifiser Magic Link token.

        Args:
            token: Token fra URL

        Returns:
            (valid, error_message, token_data)
        """
        # Sjekk at token eksisterer
        if token not in self.tokens:
            return False, "Invalid token", None

        meta = self.tokens[token]

        # Sjekk at token ikke er revokert
        if meta["revoked"]:
            return False, "Token has been revoked", None

        # Sjekk at token ikke er brukt (one-time)
        if meta["used"]:
            return False, "Token already used", None

        # Sjekk at token ikke er utløpt (TTL)
        if datetime.utcnow() > meta["expires_at"]:
            return False, f"Token expired at {meta['expires_at'].isoformat()}Z", None

        # ✅ Gyldig token - marker som brukt
        meta["used"] = True
        meta["used_at"] = datetime.utcnow()

        # Returner token data (inkl sak_id)
        token_data = {
            "sak_id": meta["sak_id"],
            "email": meta["email"]
        }

        return True, "", token_data

    def revoke(self, token: str):
        """Revoke token (f.eks. ved statusendring)"""
        if token in self.tokens:
            self.tokens[token]["revoked"] = True
            self.tokens[token]["revoked_at"] = datetime.utcnow()

