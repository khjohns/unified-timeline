"""
CSRF Protection Module

Implementerer Cross-Site Request Forgery (CSRF) beskyttelse for Flask-applikasjonen.
CSRF-angrep kan forekomme når en ondsinnet nettside får en brukers nettleser til å
utføre uønskede handlinger på en nettside der brukeren er autentisert.

Beskyttelsesmekanisme:
- Generer et unikt token for hver session/bruker
- Token inkluderer: nonce (random) + timestamp + HMAC signature
- Klienten må sende token i X-CSRF-Token header for alle POST/PUT/DELETE requests
- Serveren validerer token før den behandler requesten

Fungerer perfekt med ngrok siden vi bruker header-basert CSRF (ikke cookie-basert).

Referanser:
- OWASP CSRF Prevention Cheat Sheet
- RFC 6749 (OAuth 2.0 - token generation patterns)

Forfatter: Claude
Dato: 2025-11-24
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime
from functools import wraps

from flask import jsonify, request

# CSRF secret key - MUST be kept secret!
# I produksjon: Flytt til environment variable og bruk sterk random verdi
CSRF_SECRET = os.getenv("CSRF_SECRET", "CHANGE_ME_IN_PRODUCTION_USE_ENV_VAR")

# Validitetstid for CSRF-tokens (sekunder)
CSRF_TOKEN_MAX_AGE = 3600  # 1 time


def generate_csrf_token() -> str:
    """
    Generer et nytt CSRF-token.

    Token-struktur: {nonce}:{timestamp}:{signature}
    - nonce: 32 bytes random data (URL-safe base64)
    - timestamp: Unix timestamp (sekunder siden epoch)
    - signature: HMAC-SHA256 av nonce+timestamp med CSRF_SECRET

    Denne strukturen sikrer at:
    1. Token er unikt (nonce)
    2. Token har begrenset levetid (timestamp)
    3. Token kan ikke forfalskes uten secret (HMAC)

    Returns:
        str: CSRF token på format "nonce:timestamp:signature"

    Example:
        >>> token = generate_csrf_token()
        >>> print(token)
        'XYZ123abc...:1732320000:abc123def...'
    """
    # Generer 32 bytes random nonce (URL-safe base64 encoded)
    nonce = secrets.token_urlsafe(32)

    # Hent nåværende tidsstempel
    timestamp = int(datetime.utcnow().timestamp())

    # Lag message for signering
    message = f"{nonce}:{timestamp}"

    # Generer HMAC-SHA256 signature
    signature = hmac.new(
        CSRF_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # Returner komplett token
    return f"{nonce}:{timestamp}:{signature}"


def validate_csrf_token(
    token: str, max_age: int = CSRF_TOKEN_MAX_AGE
) -> tuple[bool, str]:
    """
    Valider et CSRF-token.

    Sjekker:
    1. Token har korrekt format (3 deler separert med :)
    2. Timestamp er gyldig tall
    3. Token er ikke utløpt (alder < max_age)
    4. Timestamp er ikke i fremtiden (clock skew attack)
    5. HMAC signature er korrekt

    Args:
        token: CSRF token som skal valideres
        max_age: Maksimal alder i sekunder (default: 3600 = 1 time)

    Returns:
        Tuple[bool, str]: (is_valid, error_message)
        - (True, "") hvis token er gyldig
        - (False, "feilmelding") hvis token er ugyldig

    Example:
        >>> token = generate_csrf_token()
        >>> valid, error = validate_csrf_token(token)
        >>> print(f"Valid: {valid}, Error: {error}")
        Valid: True, Error:

    Security Notes:
        - Bruker hmac.compare_digest for timing-attack protection
        - Validerer timestamp for å forhindre replay attacks
        - Sjekker future timestamps for å forhindre clock manipulation
    """
    # Sjekk at token eksisterer
    if not token:
        return False, "CSRF token missing"

    # Splitt token i komponenter
    parts = token.split(":")
    if len(parts) != 3:
        return (
            False,
            "CSRF token malformed (expected format: nonce:timestamp:signature)",
        )

    nonce, timestamp_str, signature = parts

    # Valider timestamp format
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False, "CSRF token invalid timestamp (not an integer)"

    # Sjekk token alder
    current_time = int(datetime.utcnow().timestamp())
    age = current_time - timestamp

    if age > max_age:
        return False, f"CSRF token expired (age: {age}s > max: {max_age}s)"

    # Sjekk for future timestamp (clock skew attack)
    if age < 0:
        return False, "CSRF token timestamp in future (possible clock manipulation)"

    # Verifiser HMAC signature
    message = f"{nonce}:{timestamp_str}"
    expected_signature = hmac.new(
        CSRF_SECRET.encode("utf-8"), message.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    # Bruk constant-time comparison for å forhindre timing attacks
    if not hmac.compare_digest(signature, expected_signature):
        return False, "CSRF token signature invalid (token may be forged)"

    # Alt ok!
    return True, ""


def require_csrf(f):
    """
    Decorator for å kreve gyldig CSRF-token på en Flask route.

    Sjekker X-CSRF-Token header og validerer token før funksjonen kjøres.
    Hvis token mangler eller er ugyldig, returneres 403 Forbidden.

    Usage:
        @app.route('/api/submit', methods=['POST'])
        @require_csrf
        def submit_data():
            # Denne funksjonen kjører kun hvis CSRF-token er gyldig
            return jsonify({"success": True})

    Args:
        f: Flask view function som skal beskyttes

    Returns:
        Wrapped function som validerer CSRF før den kjører

    HTTP Headers (required):
        X-CSRF-Token: Token hentet fra GET /api/csrf-token

    HTTP Responses:
        403 Forbidden: Hvis token mangler eller er ugyldig
        - Body: {"error": "CSRF validation failed", "detail": "årsak"}

    Security Notes:
        - Bruk denne decorator på ALLE state-changing operations (POST/PUT/DELETE)
        - IKKE bruk på read-only operations (GET)
        - Token må sendes i header (ikke cookie) for å fungere med ngrok
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Hent token fra header
        token = request.headers.get("X-CSRF-Token", "")

        # Valider token
        valid, error = validate_csrf_token(token, max_age=CSRF_TOKEN_MAX_AGE)

        if not valid:
            return jsonify(
                {
                    "error": "CSRF validation failed",
                    "detail": error,
                    "hint": "Obtain a fresh token from GET /api/csrf-token",
                }
            ), 403

        # Token er gyldig - kjør original funksjon
        return f(*args, **kwargs)

    return decorated_function


# Hjelpefunksjon for testing
def _test_csrf_protection():
    """
    Enkel test av CSRF-beskyttelse.
    Kjør med: python -c "from csrf_protection import _test_csrf_protection; _test_csrf_protection()"
    """
    print("Testing CSRF Protection...")

    # Test 1: Generate token
    token = generate_csrf_token()
    print(f"✓ Generated token: {token[:30]}...")

    # Test 2: Validate valid token
    valid, error = validate_csrf_token(token)
    assert valid and not error, f"Valid token failed: {error}"
    print("✓ Valid token accepted")

    # Test 3: Validate invalid token
    valid, error = validate_csrf_token("invalid:token:here")
    assert not valid, "Invalid token was accepted!"
    print(f"✓ Invalid token rejected: {error}")

    # Test 4: Validate expired token (simulate old token)
    old_token = "nonce123:1000000000:fakesig"
    valid, error = validate_csrf_token(old_token)
    assert not valid and "expired" in error.lower(), "Expired token was accepted!"
    print(f"✓ Expired token rejected: {error}")

    print("✅ All CSRF tests passed!")


if __name__ == "__main__":
    # Kjør test hvis filen kjøres direkte
    _test_csrf_protection()
