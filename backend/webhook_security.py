"""
Webhook Security Module

Implementerer sikkerhet for webhook-endepunktet som mottar events fra Catenda.

Catenda Webhook Security:
Catenda API støtter IKKE HMAC-signering av webhooks (ingen X-Signature header).
Derfor bruker vi "Secret Token in URL" som autentiseringsmetode:
- Webhook URL: https://ngrok.io/webhook/catenda?token=SECRET
- Backend validerer 'token' query parameter

Dette er standard "Plan B" når API ikke tilbyr innebygd signering.

Security Features:
1. Secret Token Validation - Verifiser at request kom fra Catenda
2. Idempotency Check - Forhindre duplikat-prosessering av samme event
3. Event ID Tracking - Hold styr på prosesserte events

Referanser:
- Catenda Webhook API.yaml
- OWASP Webhook Security
- GitHub Webhooks Security (bruker samme pattern)

VIKTIG:
- Hold CATENDA_WEBHOOK_TOKEN hemmelig!
- Generer sterk random token (minimum 32 bytes)
- Aldri commit token til git
- Roter token regelmessig

Forfatter: Claude
Dato: 2025-11-24
"""

import os
import hmac
from flask import request
from typing import Tuple, Set
from datetime import datetime, timedelta

# Webhook secret token (MUST be set in environment)
# Generer med: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
WEBHOOK_SECRET_TOKEN = os.getenv("CATENDA_WEBHOOK_TOKEN", "")

# Idempotency tracking (in-memory for prototype)
# I produksjon: Bruk Redis eller database med TTL
processed_events: Set[str] = set()

# TTL for processed events (hvor lenge vi husker at event er prosessert)
IDEMPOTENCY_TTL_HOURS = 24


def validate_webhook_token() -> Tuple[bool, str]:
    """
    Valider Secret Token fra URL query parameter.

    Catenda kaller webhook URL: https://ngrok.io/webhook/catenda?token=SECRET
    Vi må sjekke at 'token' parameter matcher vår SECRET.

    Security:
    - Bruker hmac.compare_digest for constant-time comparison
    - Dette forhindrer timing attacks hvor angriper kan gjette token
      ved å måle responstid

    Returns:
        Tuple[bool, str]:
        - is_valid: True hvis token er korrekt
        - error_message: Feilmelding hvis ugyldig (tom hvis gyldig)

    Example:
        # Request from Catenda (correct token)
        GET /webhook/catenda?token=abc123xyz...
        → (True, "")

        # Request from attacker (wrong token)
        GET /webhook/catenda?token=wrong
        → (False, "Invalid webhook token")

        # Request without token
        GET /webhook/catenda
        → (False, "Missing token parameter in URL")
    """
    # Hent token fra URL query parameter
    received_token = request.args.get("token", "")

    if not received_token:
        return False, "Missing token parameter in URL"

    # Sjekk at server har konfigurert webhook token
    if not WEBHOOK_SECRET_TOKEN:
        return False, "Server configuration error: WEBHOOK_SECRET_TOKEN not set"

    # Constant-time comparison (timing attack protection)
    # hmac.compare_digest sikrer at sammenligningen tar like lang tid
    # uavhengig av hvor mange tegn som matcher
    if not hmac.compare_digest(received_token, WEBHOOK_SECRET_TOKEN):
        return False, "Invalid webhook token"

    return True, ""


def is_duplicate_event(event_id: str) -> bool:
    """
    Sjekk om webhook event allerede er prosessert (idempotency check).

    Webhooks kan potensielt sendes flere ganger hvis:
    - Catenda tror at request feilet (timeout, network error)
    - Retry-logikk i Catenda
    - Manual re-delivery for testing

    For å unngå duplikat-prosessering (f.eks. opprette samme sak to ganger),
    holder vi styr på event IDs vi har sett før.

    Implementasjon (Prototype):
    - In-memory Set (rask, men data går tapt ved restart)
    - Ingen TTL cleanup (vil vokse over tid)

    Implementasjon (Production):
    - Redis med TTL (data persistert, automatisk cleanup)
    - Database tabell med created_at + periodic cleanup job

    Args:
        event_id: Unik ID for webhook event (fra Catenda payload)

    Returns:
        bool: True hvis event allerede er prosessert

    Example:
        >>> is_duplicate_event("evt_12345")
        False  # Første gang
        >>> is_duplicate_event("evt_12345")
        True   # Andre gang
    """
    if event_id in processed_events:
        return True

    # Marker som prosessert
    processed_events.add(event_id)

    # TODO (Production): Implement TTL cleanup
    # For prototype: Events forblir i memory til server restart
    # For production: Bruk Redis SETEX eller database med scheduled cleanup

    return False


def clear_old_events():
    """
    Cleanup-funksjon for å fjerne gamle event IDs fra idempotency tracking.

    Denne funksjonen er kun en placeholder for prototype.
    I produksjon må dette kjøres periodisk (f.eks. hver time).

    Implementation ideas:
    1. Scheduled job (APScheduler, Celery Beat)
    2. Database cleanup: DELETE FROM events WHERE created_at < NOW() - INTERVAL '24 hours'
    3. Redis TTL: SETEX event_id 86400 "processed" (automatisk cleanup)

    For prototype:
    - Kan ignoreres (minne brukes opp over tid, men ok for demo)
    - Ved restart: processed_events Set tømmes automatisk
    """
    # Placeholder - implementer i produksjon
    # cutoff_time = datetime.utcnow() - timedelta(hours=IDEMPOTENCY_TTL_HOURS)
    # ... fjern events eldre enn cutoff_time ...
    pass


def validate_webhook_event_structure(payload: dict) -> Tuple[bool, str]:
    """
    Valider at webhook payload har forventet struktur.

    Catenda webhook events har denne strukturen:
    {
        "id": "evt_12345",              # Event ID (for idempotency)
        "event": "issue.created",       # Event type
        "topic": { ... },               # BCF Topic data
        "project": { "id": "..." }      # Project reference
    }

    Event types (ref: Webhook API.yaml):
    - "issue.created": Ny BCF Topic opprettet
    - "issue.modified": BCF Topic endret
    - "issue.status.changed": Topic status endret

    Args:
        payload: JSON payload fra webhook request

    Returns:
        Tuple[bool, str]:
        - is_valid: True hvis struktur er ok
        - error_message: Feilmelding hvis ugyldig

    Example:
        >>> validate_webhook_event_structure({"id": "evt_1", "event": "issue.created"})
        (True, "")
        >>> validate_webhook_event_structure({"foo": "bar"})
        (False, "Missing required field: id")
    """
    # Sjekk at payload er dict
    if not isinstance(payload, dict):
        return False, "Payload must be JSON object"

    # Sjekk required fields
    if "id" not in payload:
        return False, "Missing required field: id (event ID)"

    if "event" not in payload:
        return False, "Missing required field: event (event type)"

    event_id = payload.get("id")
    event_type = payload.get("event")

    # Validate event ID (ikke-tomt)
    if not event_id or not isinstance(event_id, str):
        return False, "Invalid event ID (must be non-empty string)"

    # Validate event type
    valid_event_types = [
        "issue.created",
        "issue.modified",
        "issue.status.changed",
        "issue.deleted"  # For fremtidig support
    ]

    if event_type not in valid_event_types:
        return False, f"Unknown event type: {event_type} (expected: {', '.join(valid_event_types)})"

    # Alt ok
    return True, ""


def get_webhook_event_id(payload: dict) -> str:
    """
    Hent event ID fra webhook payload.

    Prøver flere felt for bakoverkompatibilitet:
    - "id" (standard BCF/Catenda)
    - "eventId" (eventuell alternativ naming)
    - "event_id" (snake_case variant)

    Args:
        payload: Webhook JSON payload

    Returns:
        str: Event ID eller tom string hvis ikke funnet

    Example:
        >>> get_webhook_event_id({"id": "evt_12345"})
        'evt_12345'
    """
    return (
        payload.get("id") or
        payload.get("eventId") or
        payload.get("event_id") or
        ""
    )


# Helper function for testing
def _test_webhook_security():
    """
    Test webhook security functions.
    Kjør med: CATENDA_WEBHOOK_TOKEN=testsecret python -c "from webhook_security import _test_webhook_security; _test_webhook_security()"
    """
    print("Testing webhook security...")

    # Test event structure validation
    valid_payload = {
        "id": "evt_12345",
        "event": "issue.created",
        "topic": {}
    }
    is_valid, error = validate_webhook_event_structure(valid_payload)
    assert is_valid, f"Valid payload rejected: {error}"
    print("✓ Valid payload accepted")

    invalid_payload = {"foo": "bar"}
    is_valid, error = validate_webhook_event_structure(invalid_payload)
    assert not is_valid, "Invalid payload accepted"
    print(f"✓ Invalid payload rejected: {error}")

    # Test idempotency
    event_id = "evt_test_123"
    assert not is_duplicate_event(event_id), "First event marked as duplicate"
    print("✓ First event processed")

    assert is_duplicate_event(event_id), "Duplicate event not detected"
    print("✓ Duplicate event detected")

    # Test event ID extraction
    event_id = get_webhook_event_id({"id": "evt_456"})
    assert event_id == "evt_456", "Event ID not extracted"
    print("✓ Event ID extracted")

    print("✅ All webhook security tests passed!")


if __name__ == "__main__":
    _test_webhook_security()
