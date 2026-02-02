"""
Microsoft Entra ID (Azure AD) Token Validation

Validates Entra ID JWT tokens for protected API endpoints.
Used for all users (both internal BH and external TE) authenticated via IDA.

IDA er Oslo kommunes sentraliserte identitetstjeneste som wrapper Entra ID.
Konfigurasjon mottas fra IDA-forvaltning etter bestilling via Kompass.

HR-systemet er master for:
- Stillingstittel (synkronisert til jobTitle claim)
- Organisasjonshierarki (leder-relasjoner via Graph API /me/manager)
- Organisasjonstilhørighet (brukes til å bestemme TE vs BH)
"""

import logging
from dataclasses import dataclass, field
from functools import wraps
from typing import Literal

import jwt
from flask import g, jsonify, request
from jwt import PyJWKClient

from core.config import settings

logger = logging.getLogger(__name__)

# Cache for JWKS client (reused across requests)
_jwks_client: PyJWKClient | None = None

# Organisasjoner som regnes som BH (Byggherre) - resten er TE
# Konfigureres basert på IDA-oppsett
BH_ORGANIZATIONS = [
    "obf.oslo.kommune.no",  # Oslobygg KF
    "oslo.kommune.no",  # Oslo kommune generelt
    # Legg til flere domener/organisasjoner etter behov
]


@dataclass
class EntraUser:
    """
    Brukerinformasjon fra Entra ID token.

    HR-systemet er master for data som synkroniseres til Entra ID:
    - job_title: Stillingstittel fra HR
    - department: Avdeling/seksjon fra HR
    - Leder-relasjoner hentes via Graph API (/me/manager)
    """

    id: str  # oid claim
    email: str  # preferred_username
    name: str  # name claim
    groups: list[str] = field(default_factory=list)  # group IDs/names
    roles: list[str] = field(default_factory=list)  # app roles
    tenant_id: str = ""  # tid claim

    # HR-synkroniserte felter
    job_title: str = ""  # jobTitle claim (fra HR)
    department: str = ""  # department claim (fra HR)
    company: str = ""  # companyName claim

    @property
    def organization_role(self) -> Literal["BH", "TE"]:
        """
        Bestem om bruker er BH (Byggherre) eller TE (Totalentreprenør).

        Basert på organisasjonstilhørighet:
        - Oslobygg/Oslo kommune → BH
        - Eksterne (entreprenører) → TE

        Logikken kan tilpasses basert på IDA-oppsett (grupper, domene, etc.)
        """
        # Sjekk e-postdomene
        if self.email:
            domain = self.email.split("@")[-1].lower()
            if any(bh_org in domain for bh_org in BH_ORGANIZATIONS):
                return "BH"

        # Sjekk company claim
        if self.company:
            company_lower = self.company.lower()
            if any(org in company_lower for org in ["oslobygg", "obf", "oslo kommune"]):
                return "BH"

        # Sjekk gruppemedlemskap for BH-rolle
        bh_groups = ["KOE-Byggherre", "Oslobygg-Ansatt"]
        if any(g in self.groups for g in bh_groups):
            return "BH"

        # Default: TE (ekstern)
        return "TE"

    @property
    def approval_role(self) -> str | None:
        """
        Map stillingstittel/grupper til godkjenningsrolle.

        Prioritert rekkefølge:
        1. Stillingstittel fra HR (job_title claim)
        2. Entra ID-grupper (fallback)

        Returnerer høyeste rolle hvis bruker har flere.
        """
        role_hierarchy = ["AD", "DU", "AL", "SL", "PL"]

        # 1. Sjekk stillingstittel fra HR (primær kilde)
        if self.job_title:
            title_lower = self.job_title.lower()
            title_mappings = {
                "administrerende direktør": "AD",
                "adm. direktør": "AD",
                "direktør utbygging": "DU",
                "avdelingsleder": "AL",
                "avdelingsdirektør": "AL",
                "seksjonsleder": "SL",
                "seksjonssjef": "SL",
                "prosjektleder": "PL",
                "prosjektsjef": "PL",
            }
            for title_pattern, role in title_mappings.items():
                if title_pattern in title_lower:
                    return role

        # 2. Sjekk Entra ID-grupper (fallback)
        role_groups = {
            "KOE-Godkjenner-AD": "AD",
            "KOE-Godkjenner-DU": "DU",
            "KOE-Godkjenner-AL": "AL",
            "KOE-Godkjenner-SL": "SL",
            "KOE-Godkjenner-PL": "PL",
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

    def to_dict(self) -> dict:
        """Konverter til dict for JSON-serialisering."""
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "groups": self.groups,
            "roles": self.roles,
            "tenant_id": self.tenant_id,
            "job_title": self.job_title,
            "department": self.department,
            "company": self.company,
            "organization_role": self.organization_role,
            "approval_role": self.approval_role,
        }


def _get_jwks_client() -> PyJWKClient | None:
    """Hent eller opprett JWKS client for token-validering."""
    global _jwks_client

    if not settings.entra_jwks_url:
        return None

    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            settings.entra_jwks_url,
            cache_jwk_set=True,
            lifespan=3600,  # Cache keys for 1 hour
        )

    return _jwks_client


def validate_entra_token(token: str) -> EntraUser | None:
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
            },
        )

        # Ekstraher brukerinformasjon inkludert HR-synkroniserte felter
        return EntraUser(
            id=claims.get("oid", ""),
            email=claims.get("preferred_username", claims.get("email", "")),
            name=claims.get("name", ""),
            groups=claims.get("groups", []),
            roles=claims.get("roles", []),
            tenant_id=claims.get("tid", ""),
            # HR-synkroniserte felter
            job_title=claims.get("jobTitle", claims.get("job_title", "")),
            department=claims.get("department", ""),
            company=claims.get("companyName", claims.get("company", "")),
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
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify(
                {
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Mangler Authorization header",
                }
            ), 401

        token = auth_header.split(" ")[1]
        user = validate_entra_token(token)

        if not user:
            return jsonify(
                {
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Ugyldig eller utløpt token",
                }
            ), 401

        # Sett bruker i Flask g object
        g.entra_user = user
        g.current_user = {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.organization_role,  # BH eller TE basert på organisasjon
            "job_title": user.job_title,
            "department": user.department,
            "approval_role": user.approval_role,
        }

        return f(*args, **kwargs)

    return decorated_function


def require_approval_role(required_roles: list[str]):
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
            user = getattr(g, "entra_user", None)

            if not user:
                return jsonify(
                    {
                        "success": False,
                        "error": "UNAUTHORIZED",
                        "message": "Krever Entra ID-autentisering",
                    }
                ), 401

            if not user.approval_role:
                return jsonify(
                    {
                        "success": False,
                        "error": "FORBIDDEN",
                        "message": "Bruker har ingen godkjenningsrolle",
                    }
                ), 403

            if user.approval_role not in required_roles:
                return jsonify(
                    {
                        "success": False,
                        "error": "FORBIDDEN",
                        "message": f"Krever en av følgende roller: {', '.join(required_roles)}",
                    }
                ), 403

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def require_bh_role(f):
    """
    Decorator som krever at bruker er BH (Byggherre/Oslobygg).

    Brukes for endepunkter som kun skal være tilgjengelige for interne brukere,
    f.eks. godkjenning av krav, BH-responser, etc.

    Eksempel:
        @require_bh_role
        def submit_bh_response():
            ...
    """

    @wraps(f)
    @require_entra_auth
    def decorated_function(*args, **kwargs):
        user = getattr(g, "entra_user", None)

        if not user:
            return jsonify(
                {
                    "success": False,
                    "error": "UNAUTHORIZED",
                    "message": "Krever Entra ID-autentisering",
                }
            ), 401

        if user.organization_role != "BH":
            return jsonify(
                {
                    "success": False,
                    "error": "FORBIDDEN",
                    "message": "Kun tilgjengelig for Oslobygg-ansatte (BH)",
                }
            ), 403

        return f(*args, **kwargs)

    return decorated_function


def get_entra_user() -> EntraUser | None:
    """
    Hent nåværende Entra ID-autentiserte bruker fra Flask g object.

    Returns:
        EntraUser eller None hvis ikke autentisert
    """
    return getattr(g, "entra_user", None)
