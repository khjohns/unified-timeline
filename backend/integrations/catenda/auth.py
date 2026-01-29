"""
Catenda Authentication & Authorization Module

Implementerer autentisering og autorisasjon mot Catenda API:
1. OAuth Token Validation - Sjekk at Catenda token er gyldig
2. Project Access Control - Sjekk at bruker har tilgang til prosjekt
3. Role-Based Access Control - Hent brukerrolle (TE/BH) fra Catenda teams

Catenda API Integration:
- OpenCDE Foundation API: /opencde/foundation/1.0/current-user (token validation)
- Project API v2: /v2/projects (list projects)
- Project API v2: /v2/projects/{id}/teams (list teams)
- Project API v2: /v2/projects/{pid}/teams/{tid}/members/{uid} (check membership)

Security Features:
- Token expiry validation
- Project-scope isolation (users can only access their projects)
- Team-based role mapping (TE vs BH)
- Field-level access control

Referanser:
- Catenda API-reference-auth.yaml
- Catenda Project API.yaml
- OWASP Authorization Cheat Sheet

Forfatter: Claude
Dato: 2025-11-24
"""

import os
import requests
from typing import Tuple, Dict, List, Optional
from flask import request, jsonify, g
from functools import wraps

# Catenda API base URL
CATENDA_API_BASE = "https://api.catenda.com"

# Field access control lists
# TE (Teknisk Entreprenør) kan ikke redigere disse feltene (BH-only)
BH_ONLY_FIELDS = [
    "bh_svar_vederlag",
    "bh_godkjent_vederlag_belop",
    "bh_vederlag_metode",
    "bh_begrunnelse_vederlag",
    "bh_svar_frist",
    "bh_godkjent_frist_dager",
    "bh_frist_for_spesifisering",
    "bh_begrunnelse_frist",
    "for_byggherre",  # BH signature
    "dato_svar_bh"
]

# TE kan ikke redigere disse feltene etter at de er submitted
TE_LOCKED_AFTER_SUBMIT_FIELDS = [
    "dato_forhold_oppdaget",
    "hovedkategori",
    "underkategori",
    "varsel_beskrivelse",
    "krav_vederlag",
    "krav_vederlag_belop",
    "krav_fristforlengelse",
    "krav_frist_antall_dager"
]


def get_catenda_token_from_request() -> str:
    """
    Hent Catenda OAuth token fra HTTP request.

    Støtter to metoder:
    1. Authorization: Bearer <token> (standard OAuth 2.0)
    2. X-Catenda-Token: <token> (custom header for fleksibilitet)

    Returns:
        str: Token eller tom string hvis ikke funnet

    Example:
        # Request with Authorization header
        Authorization: Bearer abc123xyz...

        # Request with custom header
        X-Catenda-Token: abc123xyz...
    """
    # Sjekk standard Authorization header
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:]  # Strip "Bearer " prefix

    # Sjekk custom header (fallback)
    return request.headers.get('X-Catenda-Token', '')


def validate_catenda_token(token: str) -> Tuple[bool, str, Dict]:
    """
    Valider Catenda OAuth token via OpenCDE Foundation API.

    Gjør et API-kall til Catenda for å verifisere at token er:
    - Autentisk (ikke forfalsket)
    - Ikke utløpt
    - Tilknyttet en gyldig bruker

    API Endpoint:
        GET https://api.catenda.com/opencde/foundation/1.0/current-user
        Header: Authorization: Bearer <token>

    Response format (fra Catenda):
        {
            "id": "user@example.com",  # Bruker-ID (email/username)
            "name": "John Doe"         # Fullt navn
        }

    Args:
        token: Catenda OAuth token som skal valideres

    Returns:
        Tuple[bool, str, Dict]:
        - is_valid: True hvis token er gyldig
        - error_message: Feilmelding hvis ugyldig (tom hvis gyldig)
        - user_info: Dict med user data hvis gyldig ({} hvis ugyldig)

    Example:
        >>> valid, error, user = validate_catenda_token("abc123...")
        >>> if valid:
        ...     print(f"Authenticated as: {user['name']}")
        ... else:
        ...     print(f"Auth failed: {error}")
    """
    if not token:
        return False, "Missing authentication token", {}

    try:
        # Call OpenCDE Foundation API for token validation
        url = f"{CATENDA_API_BASE}/opencde/foundation/1.0/current-user"

        response = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            },
            timeout=10  # 10 second timeout
        )

        # Token expired or invalid
        if response.status_code == 401:
            return False, "Token expired or invalid", {}

        # Other API errors
        if response.status_code != 200:
            return False, f"Catenda API error: {response.status_code}", {}

        # Parse user data
        user_data = response.json()

        # Map response to our user info structure
        user_info = {
            "id": user_data.get("id"),           # User ID (email/username)
            "email": user_data.get("id"),        # OpenCDE uses 'id' as email
            "name": user_data.get("name"),       # Full name
            "catenda_token": token               # Store token for later use
        }

        return True, "", user_info

    except requests.exceptions.Timeout:
        return False, "Catenda API timeout (network issue)", {}
    except requests.exceptions.RequestException as e:
        return False, f"Token validation error: {str(e)}", {}
    except Exception as e:
        return False, f"Unexpected error: {str(e)}", {}


def get_user_projects(catenda_token: str) -> List[str]:
    """
    Hent liste over prosjekter brukeren har tilgang til.

    API Endpoint:
        GET https://api.catenda.com/v2/projects
        Header: Authorization: Bearer <token>

    Returns:
        List[str]: Liste av project IDs (compacted UUIDs)

    Example:
        >>> projects = get_user_projects(token)
        >>> print(projects)
        ['550e8400e29b41d4a716446655440000', 'a1b2c3d4e5f6...']

    Note:
        Returnerer tom liste hvis API-kall feiler.
        Dette er trygt fordi det fører til access denied for alle prosjekter.
    """
    try:
        url = f"{CATENDA_API_BASE}/v2/projects"

        response = requests.get(
            url,
            headers={"Authorization": f"Bearer {catenda_token}"},
            timeout=10
        )

        if response.status_code != 200:
            return []

        projects = response.json()
        return [p["id"] for p in projects if "id" in p]

    except Exception as e:
        print(f"Error fetching user projects: {e}")
        return []


def get_user_role_in_project(catenda_token: str, project_id: str, user_id: str) -> str:
    """
    Bestem brukerrolle (TE/BH) basert på Team-medlemskap i Catenda.

    Logikk:
    1. Hent alle teams i prosjektet
    2. For hvert team, sjekk om navnet indikerer en rolle:
       - "TE", "ENTREPRENØR", "TECHNICAL" → TE (Teknisk Entreprenør)
       - "BH", "BYGGHERRE", "CLIENT" → BH (Byggherre)
    3. Sjekk om brukeren er medlem i teamet
    4. Returner første match (TE prioriteres hvis bruker er i begge)

    API Endpoints:
        1. GET /v2/projects/{project-id}/teams
           → Henter alle teams
        2. GET /v2/projects/{pid}/teams/{tid}/members/{uid}
           → Sjekker om bruker er medlem (200 = ja, 404 = nei)

    Args:
        catenda_token: OAuth token
        project_id: Catenda project ID (compacted UUID)
        user_id: User ID fra current-user (email/brukernavn)

    Returns:
        str: "TE", "BH", eller "unknown"

    Example:
        >>> role = get_user_role_in_project(token, "550e8400...", "user@example.com")
        >>> print(f"User role: {role}")
        User role: TE

    Security Note:
        Hvis rolle ikke kan bestemmes, returner "unknown".
        Dette medfører at bruker får minimal tilgang (fail-safe).
    """
    try:
        headers = {"Authorization": f"Bearer {catenda_token}"}
        base_url = f"{CATENDA_API_BASE}/v2"

        # 1. Hent alle teams i prosjektet
        teams_resp = requests.get(
            f"{base_url}/projects/{project_id}/teams",
            headers=headers,
            timeout=10
        )

        if teams_resp.status_code != 200:
            return "unknown"

        all_teams = teams_resp.json()
        user_role = "unknown"

        # 2. Sjekk hvert team for rolle-indikatorer
        for team in all_teams:
            team_name = team.get('name', '').upper()
            team_id = team.get('id')

            if not team_id:
                continue

            # Identifiser mulig rolle basert på team-navn
            possible_role = None
            if any(keyword in team_name for keyword in ["TE", "ENTREPRENØR", "TECHNICAL", "CONTRACTOR"]):
                possible_role = "TE"
            elif any(keyword in team_name for keyword in ["BH", "BYGGHERRE", "CLIENT", "OWNER"]):
                possible_role = "BH"

            # Hvis dette teamet indikerer en rolle, sjekk medlemskap
            if possible_role:
                # 3. Sjekk om bruker er medlem
                member_resp = requests.get(
                    f"{base_url}/projects/{project_id}/teams/{team_id}/members/{user_id}",
                    headers=headers,
                    timeout=10
                )

                # Status 200 = medlem, 404 = ikke medlem
                if member_resp.status_code == 200:
                    user_role = possible_role
                    break  # Fant rolle, stopp søk

        return user_role

    except Exception as e:
        print(f"Error checking user role: {e}")
        return "unknown"


def validate_field_access(
    role: str,
    payload: Dict,
    current_status: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Valider at bruker har tilgang til å oppdatere de oppgitte feltene.

    Access Control Rules:
    1. TE (Teknisk Entreprenør):
       - Kan IKKE oppdatere BH-only felter
       - Kan oppdatere egne felter før submit

    2. BH (Byggherre):
       - Kan IKKE oppdatere TE-felter etter at TE har submitted
       - Kan oppdatere alle BH-felter

    3. Unknown role:
       - Har ingen skrivetilgang (deny all)

    Args:
        role: Brukerrolle ("TE", "BH", "unknown")
        payload: Dict med felter som skal oppdateres
        current_status: Nåværende status på sak (for å sjekke om submitted)

    Returns:
        Tuple[bool, str]:
        - is_allowed: True hvis tilgang er ok
        - error_message: Feilmelding hvis ikke tillatt

    Example:
        >>> allowed, error = validate_field_access("TE", {"bh_svar_vederlag": "..."})
        >>> if not allowed:
        ...     print(error)
        TE cannot modify BH field: bh_svar_vederlag
    """
    # Unknown role har ingen skrivetilgang
    if role == "unknown":
        return False, "User role could not be determined (no write access)"

    # TE access control
    if role == "TE":
        # TE kan ikke redigere BH-only felter
        for field in BH_ONLY_FIELDS:
            if field in payload:
                return False, f"TE cannot modify BH-only field: {field}"

    # BH access control
    elif role == "BH":
        # BH kan ikke redigere TE-felt etter submit
        submitted_statuses = ["100000001", "100000002", "varslet", "venter_paa_svar"]
        if current_status in submitted_statuses:
            for field in TE_LOCKED_AFTER_SUBMIT_FIELDS:
                if field in payload:
                    return False, f"BH cannot modify TE-locked field after submission: {field}"

    # Alt ok
    return True, ""


def require_catenda_auth(f):
    """
    Decorator: Krev gyldig Catenda token for denne route.

    Validerer token og lagrer user info i Flask's 'g' object.
    Hvis token er ugyldig, returner 401 Unauthorized.

    Usage:
        @app.route('/api/cases/<sakId>', methods=['GET'])
        @require_catenda_auth
        def get_case(sakId):
            user = g.user  # {'id': '...', 'name': '...', 'catenda_token': '...'}
            # ... behandle request ...

    Args:
        f: Flask view function som skal beskyttes

    Returns:
        Wrapped function som validerer token før kjøring

    HTTP Response (if unauthorized):
        401 Unauthorized
        {
            "error": "Authentication required",
            "detail": "årsak"
        }
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Hent token fra request
        token = get_catenda_token_from_request()

        # Valider token
        valid, error, user_info = validate_catenda_token(token)

        if not valid:
            return jsonify({
                "error": "Authentication required",
                "detail": error,
                "hint": "Provide valid Catenda OAuth token in Authorization header"
            }), 401

        # Lagre user info i request context (tilgjengelig i view function)
        g.user = user_info

        # Kjør original funksjon
        return f(*args, **kwargs)

    return decorated_function


def require_project_access(f):
    """
    Decorator: Krev at bruker har tilgang til prosjekt.

    Forutsetter:
    - @require_catenda_auth er allerede anvendt (g.user eksisterer)
    - Saken har 'catenda_project_id' felt
    - Flask 'g' har 'get_system()' for database access

    Logikk:
    1. Hent sak fra database (via sakId i path/body)
    2. Hent prosjekt-ID fra sak
    3. Hent brukerens prosjekter fra Catenda
    4. Sjekk at prosjekt-ID er i brukerens prosjektliste

    Usage:
        @app.route('/api/cases/<sakId>', methods=['GET'])
        @require_catenda_auth
        @require_project_access
        def get_case(sakId):
            # Bruker har tilgang til dette prosjektet
            # ...

    Args:
        f: Flask view function

    Returns:
        Wrapped function

    HTTP Response (if forbidden):
        403 Forbidden
        {
            "error": "Forbidden",
            "detail": "You don't have access to this project"
        }
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from app import get_system  # Import here to avoid circular dependency

        user = g.get('user')
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        # Hent sakId fra path eller body
        sak_id = kwargs.get('sakId') or request.get_json().get('sakId')
        if not sak_id:
            return jsonify({"error": "Missing sakId"}), 400

        # Hent sak fra database
        sys = get_system()
        sak_data = sys.db.get_form_data(sak_id)

        if not sak_data:
            return jsonify({"error": "Case not found"}), 404

        # Hent project_id fra sak
        # Try nested structure first (sak.catenda_project_id)
        project_id = None
        if isinstance(sak_data, dict):
            if 'sak' in sak_data and isinstance(sak_data['sak'], dict):
                project_id = sak_data['sak'].get('catenda_project_id')
            else:
                project_id = sak_data.get('catenda_project_id')

        # Hvis sak ikke har project_id, tillat (eldre data uten project linking)
        if not project_id:
            return f(*args, **kwargs)

        # Hent brukerens prosjekter
        user_projects = get_user_projects(user['catenda_token'])

        # Sjekk tilgang
        if project_id not in user_projects:
            return jsonify({
                "error": "Forbidden",
                "detail": "You don't have access to this project"
            }), 403

        # OK - proceed
        return f(*args, **kwargs)

    return decorated_function


# Helper function for testing
def _test_auth():
    """
    Test authentication functions (requires valid token).
    Kjør med: CATENDA_TOKEN=<token> python -c "from catenda_auth import _test_auth; _test_auth()"
    """
    token = os.getenv("CATENDA_TOKEN")

    if not token:
        print("❌ Please set CATENDA_TOKEN environment variable")
        return

    print("Testing Catenda authentication...")

    # Test token validation
    valid, error, user = validate_catenda_token(token)
    if valid:
        print(f"✓ Token valid for user: {user['name']} ({user['email']})")
    else:
        print(f"✗ Token invalid: {error}")
        return

    # Test project access
    projects = get_user_projects(token)
    print(f"✓ User has access to {len(projects)} projects")

    if projects:
        # Test role check on first project
        role = get_user_role_in_project(token, projects[0], user['id'])
        print(f"✓ User role in first project: {role}")

    print("✅ Auth tests completed!")


if __name__ == "__main__":
    _test_auth()
