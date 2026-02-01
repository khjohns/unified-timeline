"""
Microsoft Entra ID (Azure AD) Token Validation

Validates Entra ID JWT tokens for protected API endpoints.
Used for internal users (Oslobygg ansatte) authenticated via IDA.

IDA er Oslo kommunes sentraliserte identitetstjeneste som wrapper Entra ID.
Konfigurasjon mottas fra IDA-forvaltning etter bestilling via Kompass.
"""

import logging
from functools import wraps
from typing import Optional, Dict, List
from dataclasses import dataclass

import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g

from core.config import settings

logger = logging.getLogger(__name__)

# Cache for JWKS client (reused across requests)
_jwks_client: Optional[PyJWKClient] = None


@dataclass
class EntraUser:
    """Brukerinformasjon fra Entra ID token."""
    id: str  # oid claim
    email: str  # preferred_username
    name: str  # name claim
    groups: List[str]  # group IDs
    roles: List[str]  # app roles
    tenant_id: str  # tid claim

    @property
    def approval_role(self) -> Optional[str]:
        """
        Map Entra ID-grupper til godkjenningsrolle.

        Gruppene konfigureres i IDA og må matche disse navnene:
        - KOE-Godkjenner-PL → PL
        - KOE-Godkjenner-SL → SL
        - KOE-Godkjenner-AL → AL
        - KOE-Godkjenner-DU → DU
        - KOE-Godkjenner-AD → AD

        Returnerer høyeste rolle hvis bruker har flere.
        """
        role_hierarchy = ['AD', 'DU', 'AL', 'SL', 'PL']
        role_groups = {
            'KOE-Godkjenner-AD': 'AD',
            'KOE-Godkjenner-DU': 'DU',
            'KOE-Godkjenner-AL': 'AL',
            'KOE-Godkjenner-SL': 'SL',
            'KOE-Godkjenner-PL': 'PL',
        }

        user_roles = []
        for group in self.groups:
            if group in role_groups:
                user_roles.append(role_groups[group])

        # Returner høyeste rolle
        for role in role_hierarchy:
            if role in user_roles:
                return role

        return None

    def to_dict(self) -> Dict:
        """Konverter til dict for JSON-serialisering."""
        return {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'groups': self.groups,
            'roles': self.roles,
            'tenant_id': self.tenant_id,
            'approval_role': self.approval_role,
        }


def _get_jwks_client() -> Optional[PyJWKClient]:
    """Hent eller opprett JWKS client for token-validering."""
    global _jwks_client

    if not settings.entra_jwks_url:
        return None

    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            settings.entra_jwks_url,
            cache_jwk_set=True,
            lifespan=3600  # Cache keys for 1 hour
        )

    return _jwks_client


def validate_entra_token(token: str) -> Optional[EntraUser]:
    """
    Valider et Entra ID JWT token.

    Args:
        token: JWT token string fra Authorization header

    Returns:
        EntraUser hvis gyldig, None hvis ugyldig
    """
    if not settings.entra_enabled:
        logger.debug("Entra ID er ikke aktivert")
        return None

    if not settings.entra_tenant_id or not settings.entra_client_id:
        logger.warning("Entra ID er aktivert men mangler konfigurasjon")
        return None

    jwks_client = _get_jwks_client()
    if not jwks_client:
        logger.error("Kunne ikke opprette JWKS client")
        return None

    try:
        # Hent signing key fra JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Valider token
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=settings.entra_client_id,
            issuer=settings.entra_issuer_url,
            options={
                "verify_exp": True,
                "verify_aud": True,
                "verify_iss": True,
            }
        )

        # Ekstraher brukerinformasjon
        return EntraUser(
            id=claims.get("oid", ""),
            email=claims.get("preferred_username", claims.get("email", "")),
            name=claims.get("name", ""),
            groups=claims.get("groups", []),
            roles=claims.get("roles", []),
            tenant_id=claims.get("tid", ""),
        )

    except jwt.ExpiredSignatureError:
        logger.warning("Entra ID token har utløpt")
        return None
    except jwt.InvalidAudienceError:
        logger.warning("Entra ID token har feil audience")
        return None
    except jwt.InvalidIssuerError:
        logger.warning("Entra ID token har feil issuer")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Ugyldig Entra ID token: {e}")
        return None
    except Exception as e:
        logger.error(f"Feil ved validering av Entra ID token: {e}")
        return None


def require_entra_auth(f):
    """
    Decorator som krever gyldig Entra ID token.

    Token sendes i Authorization header som Bearer token.
    Ved suksess er brukerdata tilgjengelig i g.entra_user.

    Hvis Entra ID ikke er aktivert, faller tilbake til magic link auth.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Sjekk om Entra ID er aktivert
        if not settings.entra_enabled:
            # Fall tilbake til magic link auth
            from .magic_link import require_magic_link
            return require_magic_link(f)(*args, **kwargs)

        # Hent token fra Authorization header
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Mangler Authorization header"
            }), 401

        token = auth_header.split(' ')[1]
        user = validate_entra_token(token)

        if not user:
            return jsonify({
                "success": False,
                "error": "UNAUTHORIZED",
                "message": "Ugyldig eller utløpt token"
            }), 401

        # Sett bruker i Flask g object
        g.entra_user = user
        g.current_user = {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": "BH",  # Interne brukere er alltid BH (Byggherre)
            "approval_role": user.approval_role,
        }

        return f(*args, **kwargs)

    return decorated_function


def require_approval_role(required_roles: List[str]):
    """
    Decorator som krever spesifikk godkjenningsrolle.

    Args:
        required_roles: Liste over tillatte roller (f.eks. ['PL', 'SL', 'AL'])

    Eksempel:
        @require_approval_role(['PL', 'SL', 'AL', 'DU', 'AD'])
        def approve_package():
            ...
    """
    def decorator(f):
        @wraps(f)
        @require_entra_auth
        def decorated_function(*args, **kwargs):
            user = getattr(g, 'entra_user', None)

            if not user:
                return jsonify({
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Krever Entra ID-autentisering"
                }), 401

            if not user.approval_role:
                return jsonify({
                    "success": False,
                    "error": "FORBIDDEN",
                    "message": "Bruker har ingen godkjenningsrolle"
                }), 403

            if user.approval_role not in required_roles:
                return jsonify({
                    "success": False,
                    "error": "FORBIDDEN",
                    "message": f"Krever en av følgende roller: {', '.join(required_roles)}"
                }), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def get_entra_user() -> Optional[EntraUser]:
    """
    Hent nåværende Entra ID-autentiserte bruker fra Flask g object.

    Returns:
        EntraUser eller None hvis ikke autentisert
    """
    return getattr(g, 'entra_user', None)
