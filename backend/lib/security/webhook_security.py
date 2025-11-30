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

Storage Backend:
- Prototype: In-memory Set (data tapt ved restart)
- Produksjon: Redis med TTL (sett REDIS_URL i .env)

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

import os
import logging
from typing import Tuple, Set, Optional

logger = logging.getLogger(__name__)

# TTL for processed events (hvor lenge vi husker at event er prosessert)
IDEMPOTENCY_TTL_SECONDS = int(os.getenv('IDEMPOTENCY_TTL_HOURS', '24')) * 3600

# Redis connection (lazy initialized)
_redis_client: Optional[object] = None
_redis_available: Optional[bool] = None

# Fallback: In-memory storage for prototype
_processed_events: Set[str] = set()


def _get_redis():
    """
    Get Redis client (lazy initialization).

    Returns:
        Redis client or None if not available
    """
    global _redis_client, _redis_available

    if _redis_available is False:
        return None

    if _redis_client is not None:
        return _redis_client

    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        _redis_available = False
        logger.info("REDIS_URL ikke satt - bruker in-memory idempotency tracking")
        return None

    try:
        import redis
        _redis_client = redis.from_url(redis_url)
        # Test connection
        _redis_client.ping()
        _redis_available = True
        logger.info(f"✅ Redis tilkoblet for idempotency tracking")
        return _redis_client
    except ImportError:
        _redis_available = False
        logger.warning("⚠️  redis-py ikke installert. Bruker in-memory storage.")
        logger.warning("   Installer med: pip install redis")
        return None
    except Exception as e:
        _redis_available = False
        logger.warning(f"⚠️  Kunne ikke koble til Redis: {e}. Bruker in-memory storage.")
        return None


def is_duplicate_event(event_id: str) -> bool:
    """
    Sjekk om webhook event allerede er prosessert (idempotency check).

    Webhooks kan potensielt sendes flere ganger hvis:
    - Catenda tror at request feilet (timeout, network error)
    - Retry-logikk i Catenda
    - Manual re-delivery for testing

    For å unngå duplikat-prosessering (f.eks. opprette samme sak to ganger),
    holder vi styr på event IDs vi har sett før.

    Storage:
    - Redis med TTL hvis REDIS_URL er satt (anbefalt for produksjon)
    - In-memory Set som fallback (data tapt ved restart)

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
    redis_client = _get_redis()

    if redis_client:
        # Use Redis with TTL
        key = f"webhook:event:{event_id}"
        try:
            # SETNX returns True if key was set (new event), False if exists
            was_set = redis_client.setnx(key, "1")
            if was_set:
                # Set TTL on new key
                redis_client.expire(key, IDEMPOTENCY_TTL_SECONDS)
                return False  # Not a duplicate
            return True  # Is a duplicate
        except Exception as e:
            logger.error(f"Redis error in idempotency check: {e}")
            # Fall back to in-memory
            return _is_duplicate_memory(event_id)
    else:
        return _is_duplicate_memory(event_id)


def _is_duplicate_memory(event_id: str) -> bool:
    """In-memory fallback for idempotency check."""
    if event_id in _processed_events:
        return True
    _processed_events.add(event_id)
    return False


def clear_processed_events():
    """
    Tøm prosesserte events (for testing eller manuell cleanup).

    For Redis: Ikke nødvendig pga TTL.
    For in-memory: Tømmer settet.
    """
    global _processed_events
    _processed_events = set()
    logger.info("Cleared in-memory processed events")


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
