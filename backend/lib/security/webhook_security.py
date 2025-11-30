"""
Webhook Security Module

Implementerer sikkerhet for webhook-endepunktet som mottar events fra Catenda.

Catenda Webhook Security:
Catenda API støtter IKKE HMAC-signering av webhooks (ingen X-Signature header).
I tillegg fjerner Catenda query parameters fra webhook URL-er.

Derfor bruker vi "Secret Path in URL" som autentiseringsmetode:
- Webhook URL: https://backend.com/webhook/catenda/{SECRET_PATH}
- Secret er en del av URL-path, ikke query parameter
- Kun requests til riktig path blir prosessert (andre gir 404)

Implementasjon:
- WEBHOOK_SECRET_PATH settes i .env
- Route defineres dynamisk: @webhook_bp.route(f'/webhook/catenda/{SECRET_PATH}')
- Requests til feil path returnerer 404 (Flask default)

Security Features:
1. Secret Path in URL - Kun kjente klienter kan finne endepunktet
2. Idempotency Check - Forhindre duplikat-prosessering av samme event
3. Event Structure Validation - Valider payload-format
4. Event ID Tracking - Hold styr på prosesserte events

Referanser:
- Catenda Webhook API dokumentasjon
- OWASP Webhook Security

VIKTIG:
- Hold WEBHOOK_SECRET_PATH hemmelig!
- Generer sterk random path (minimum 32 bytes): secrets.token_urlsafe(32)
- Aldri commit secret til git
- Roter path regelmessig (krever oppdatering i Catenda)

Forfatter: Claude
Dato: 2025-11-24 (oppdatert: 2025-11-30)
"""

from typing import Tuple, Set
from datetime import datetime, timedelta

# Idempotency tracking (in-memory for prototype)
# I produksjon: Bruk Redis eller database med TTL
processed_events: Set[str] = set()

# TTL for processed events (hvor lenge vi husker at event er prosessert)
IDEMPOTENCY_TTL_HOURS = 24

# NOTE: Webhook-autentisering skjer via secret path i URL, ikke query parameter.
# Se webhook_routes.py: @webhook_bp.route(f'/webhook/catenda/{WEBHOOK_SECRET_PATH}')
# Requests til feil path gir automatisk 404 fra Flask.


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
    """
    # Sjekk at payload er dict
    if not isinstance(payload, dict):
        return False, "Payload must be JSON object"

    # Sjekk for 'event' objektet
    event_obj = payload.get("event")
    if not isinstance(event_obj, dict):
        return False, "Missing or invalid 'event' object in payload"

    # Sjekk required fields inni 'event' objektet
    event_id = event_obj.get("id")
    event_type = event_obj.get("type")

    if not event_id:
        return False, "Missing required field: event.id (event ID)"

    if not event_type:
        return False, "Missing required field: event.type (event type)"
        
    # Valider at feltene har korrekt type
    if not isinstance(event_id, str) or not event_id:
        return False, "Invalid event ID (must be non-empty string)"

    valid_event_types = [
        "issue.created",
        "issue.modified",
        "issue.status.changed",
        "issue.deleted"
    ]

    if event_type not in valid_event_types:
        return False, f"Unknown event type: {event_type} (expected: {', '.join(valid_event_types)})"

    # Alt ok
    return True, ""


def get_webhook_event_id(payload: dict) -> str:
    """
    Hent event ID fra webhook payload.
    Ser nå i det neste 'event' objektet.
    """
    event_obj = payload.get("event", {})
    if not isinstance(event_obj, dict):
        return ""
        
    return event_obj.get("id") or ""


# Helper function for testing
def _test_webhook_security():
    """
    Test webhook security functions.
    Kjør med: python -c "from lib.security.webhook_security import _test_webhook_security; _test_webhook_security()"
    """
    print("Testing webhook security...")

    # Test event structure validation (Catenda payload format)
    valid_payload = {
        "event": {
            "id": "evt_12345",
            "type": "issue.created"
        },
        "issue": {}
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

    # Test event ID extraction (from nested event object)
    extracted_id = get_webhook_event_id({"event": {"id": "evt_456", "type": "issue.created"}})
    assert extracted_id == "evt_456", f"Event ID not extracted correctly: {extracted_id}"
    print("✓ Event ID extracted")

    print("✅ All webhook security tests passed!")


if __name__ == "__main__":
    _test_webhook_security()
