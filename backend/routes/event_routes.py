"""
Event submission API with optimistic concurrency control and hybrid PDF generation.

This module provides REST endpoints for submitting events to cases,
with full support for:
- Optimistic locking (version-based conflict detection)
- Business rule validation
- Atomic batch submissions (via SakCreationService for new cases)
- State computation and caching
- Hybrid PDF generation (client-provided or server fallback)
- Catenda integration (PDF upload + comment posting)
- CloudEvents v1.0 format for all event responses
"""

import base64
import os
import tempfile
from datetime import UTC, datetime
from typing import Any

from flask import Blueprint, jsonify, request

from api.validators import (
    ValidationError as ApiValidationError,
)
from api.validators import (
    validate_frist_event,
    validate_grunnlag_event,
    validate_respons_event,
    validate_vederlag_event,
)
from core.config import settings
from integrations.catenda.client import CatendaAuthError
from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import get_magic_link_manager, require_magic_link
from lib.catenda_factory import get_catenda_client
from lib.cloudevents import (
    format_timeline_response,
)
from lib.helpers.version_control import handle_concurrency_error
from models.events import (
    AnyEvent,
    EventType,
    FristEvent,
    GrunnlagEvent,
    ResponsEvent,
    VederlagEvent,
    parse_event,
    parse_event_from_request,
)
from models.sak_state import SakState
from repositories.event_repository import ConcurrencyError
from services.business_rules import BusinessRuleValidator
from services.catenda_service import CatendaService, map_status_to_catenda
from utils.logger import get_logger

logger = get_logger(__name__)


def enrich_event_with_version(
    event: AnyEvent, current_state: SakState | None
) -> AnyEvent:
    """
    Enrich event with version tracking fields based on current state.

    For TE events (Grunnlag/Vederlag/Frist):
    - Sets 'versjon' to current antall_versjoner + 1 for updates, or 1 for new

    For BH events (Respons):
    - Sets 'respondert_versjon' in data to track which TE version is being responded to

    Returns a new event instance with updated fields (immutable).
    """
    if current_state is None:
        return event

    event_type = event.event_type

    # TE Grunnlag events
    if isinstance(event, GrunnlagEvent):
        if event_type == EventType.GRUNNLAG_OPPRETTET:
            versjon = 1
        else:  # GRUNNLAG_OPPDATERT
            versjon = current_state.grunnlag.antall_versjoner + 1
        return event.model_copy(update={"versjon": versjon})

    # TE Vederlag events
    if isinstance(event, VederlagEvent):
        if event_type == EventType.VEDERLAG_KRAV_SENDT:
            versjon = 1
        else:  # VEDERLAG_KRAV_OPPDATERT
            versjon = current_state.vederlag.antall_versjoner + 1
        return event.model_copy(update={"versjon": versjon})

    # TE Frist events
    if isinstance(event, FristEvent):
        if event_type == EventType.FRIST_KRAV_SENDT:
            versjon = 1
        else:  # FRIST_KRAV_OPPDATERT, FRIST_KRAV_SPESIFISERT
            versjon = current_state.frist.antall_versjoner + 1
        return event.model_copy(update={"versjon": versjon})

    # BH Respons events - set respondert_versjon in data
    if isinstance(event, ResponsEvent):
        spor = event.spor.value if event.spor else None
        respondert_versjon = None

        if spor == "grunnlag":
            # 0-indexed: antall_versjoner=1 means version 0
            respondert_versjon = max(0, current_state.grunnlag.antall_versjoner - 1)
        elif spor == "vederlag":
            respondert_versjon = max(0, current_state.vederlag.antall_versjoner - 1)
        elif spor == "frist":
            respondert_versjon = max(0, current_state.frist.antall_versjoner - 1)

        if respondert_versjon is not None:
            # Update data with respondert_versjon
            updated_data = event.data.model_copy(
                update={"respondert_versjon": respondert_versjon}
            )
            return event.model_copy(update={"data": updated_data})

    return event


events_bp = Blueprint("events", __name__)

# Stateless singletons (safe to keep global)
validator = BusinessRuleValidator()
magic_link_manager = get_magic_link_manager()


# ---------------------------------------------------------------------------
# Dependency access via Container (erstatter globale singletons)
# ---------------------------------------------------------------------------


def _get_container():
    """Hent DI Container."""
    from core.container import get_container

    return get_container()


def _get_event_repo():
    """Hent EventRepository fra DI Container."""
    return _get_container().event_repository


def _get_metadata_repo():
    """Hent SakMetadataRepository fra DI Container."""
    return _get_container().metadata_repository


def _get_timeline_service():
    """Hent TimelineService fra DI Container."""
    return _get_container().timeline_service


# ============================================================================
# Helper functions for submit_event (reduces cyclomatic complexity)
# ============================================================================

# Dispatch table for event validation - replaces if/elif chain
EVENT_VALIDATORS = {
    EventType.GRUNNLAG_OPPRETTET.value: lambda d: validate_grunnlag_event(d),
    EventType.GRUNNLAG_OPPDATERT.value: lambda d: validate_grunnlag_event(
        d, is_update=True
    ),
    EventType.VEDERLAG_KRAV_SENDT.value: lambda d: validate_vederlag_event(d),
    EventType.VEDERLAG_KRAV_OPPDATERT.value: lambda d: validate_vederlag_event(d),
    EventType.FRIST_KRAV_SENDT.value: lambda d: validate_frist_event(d),
    EventType.FRIST_KRAV_OPPDATERT.value: lambda d: validate_frist_event(
        d, is_update=True
    ),
    EventType.FRIST_KRAV_SPESIFISERT.value: lambda d: validate_frist_event(
        d, is_specification=True
    ),
    EventType.RESPONS_GRUNNLAG.value: lambda d: validate_respons_event(d, "grunnlag"),
    EventType.RESPONS_VEDERLAG.value: lambda d: validate_respons_event(d, "vederlag"),
    EventType.RESPONS_FRIST.value: lambda d: validate_respons_event(d, "frist"),
}


def _validate_event_by_type(event_type: str, data_payload: dict) -> None:
    """
    Dispatch event validation to the appropriate validator.

    Uses a dispatch table instead of if/elif chain for cleaner code.

    Args:
        event_type: The event type string (e.g., 'grunnlag_opprettet')
        data_payload: The event data to validate

    Raises:
        ApiValidationError: If validation fails
    """
    validator_func = EVENT_VALIDATORS.get(event_type)
    if validator_func:
        validator_func(data_payload)


def _derive_spor_from_event(event: AnyEvent) -> str | None:
    """
    Derive the spor (track) name from an event.

    Args:
        event: The event to get spor from

    Returns:
        The spor name ('grunnlag', 'vederlag', 'frist') or None
    """
    # Check if event has explicit spor attribute (ResponsEvent)
    event_spor = getattr(event, "spor", None)
    if event_spor:
        return event_spor.value if hasattr(event_spor, "value") else str(event_spor)

    # Derive from event_type for TE events
    if hasattr(event, "event_type"):
        et = (
            event.event_type.value
            if hasattr(event.event_type, "value")
            else str(event.event_type)
        )
        et_lower = et.lower()
        if "grunnlag" in et_lower:
            return "grunnlag"
        elif "vederlag" in et_lower:
            return "vederlag"
        elif "frist" in et_lower:
            return "frist"

    return None


def _build_validation_error_response(e: ApiValidationError) -> dict:
    """
    Build a validation error response dict from an ApiValidationError.

    Args:
        e: The validation error

    Returns:
        Dict ready for jsonify
    """
    response = {
        "success": False,
        "error": "VALIDATION_ERROR",
        "message": e.message if hasattr(e, "message") else str(e),
    }
    if hasattr(e, "valid_options") and e.valid_options:
        response["valid_options"] = e.valid_options
    if hasattr(e, "field") and e.field:
        response["field"] = e.field
    return response


def _build_version_conflict_message(existing_events_data: list, event: AnyEvent) -> str:
    """
    Build a user-friendly version conflict message.

    Checks if the conflict was caused by a BH response to provide
    more helpful context to the user.

    Args:
        existing_events_data: Raw event data from repository
        event: The event that was being submitted

    Returns:
        User-friendly conflict message in Norwegian
    """
    default_message = "Tilstanden har endret seg. Vennligst last inn på nytt."

    if not existing_events_data:
        return default_message

    # Compute state to check for BH responses
    conflict_events = [parse_event(e) for e in existing_events_data]
    conflict_state = _get_timeline_service().compute_state(conflict_events)

    spor_name = _derive_spor_from_event(event)
    if not spor_name:
        return default_message

    spor_state = getattr(conflict_state, spor_name, None)
    if spor_state and spor_state.bh_resultat:
        if spor_name == "grunnlag":
            return "Byggherre har svart på ansvarsgrunnlaget. Last inn på nytt for å se svaret."
        else:
            return "Byggherre har svart på kravet. Last inn på nytt for å se svaret."

    return default_message


def _validate_business_rules_and_compute_state(
    event: AnyEvent, existing_events_data: list
) -> tuple[SakState | None, list, str | None]:
    """
    Compute current state and validate business rules.

    Args:
        event: The event to validate
        existing_events_data: Raw event data from repository

    Returns:
        Tuple of (current_state, existing_events, old_status)
        current_state may be None if no existing events.

    Raises:
        ValueError: If business rules are violated (contains rule and message)
    """
    if not existing_events_data:
        return None, [], None

    existing_events = [parse_event(e) for e in existing_events_data]
    current_state = _get_timeline_service().compute_state(existing_events)
    old_status = current_state.overordnet_status

    validation = validator.validate(event, current_state)
    if not validation.is_valid:
        # Raise with structured info for the caller
        error = ValueError(validation.message)
        error.rule = validation.violated_rule
        raise error

    return current_state, existing_events, old_status


def _ensure_catenda_auth(catenda_topic_id: str | None) -> None:
    """
    Pre-flight check for Catenda authentication.

    Args:
        catenda_topic_id: The Catenda topic ID (if any)

    Raises:
        CatendaAuthError: If Catenda token is expired/invalid
    """
    if not catenda_topic_id:
        return

    catenda_service = get_catenda_service()
    if catenda_service and catenda_service.client:
        if not catenda_service.client.ensure_authenticated():
            logger.error(
                "❌ Catenda token expired or invalid - rejecting event submission"
            )
            raise CatendaAuthError("Catenda access token expired")


@events_bp.route("/api/events", methods=["POST"])
@require_csrf
@require_magic_link
def submit_event():
    """
    Submit a single event with optional client-generated PDF.

    Request:
    {
        "event": {
            "event_type": "vederlag_krav_sendt",
            "data": { ... }
        },
        "sak_id": "KOE-20251201-001",
        "expected_version": 3,
        "catenda_topic_id": "optional-topic-guid",
        "pdf_base64": "optional-base64-pdf",
        "pdf_filename": "optional-filename.pdf"
    }

    Response 201:
    {
        "success": true,
        "event_id": "uuid",
        "new_version": 4,
        "state": { ... computed SakState ... },
        "pdf_uploaded": true,
        "pdf_source": "client" | "server"
    }

    Response 409 (Conflict):
    {
        "success": false,
        "error": "VERSION_CONFLICT",
        "expected_version": 3,
        "current_version": 5,
        "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
    }
    """
    try:
        payload = request.json
        sak_id = payload.get("sak_id")
        expected_version = payload.get("expected_version")
        event_data = payload.get("event")
        catenda_topic_id = payload.get("catenda_topic_id")

        # Look up catenda_topic_id from metadata if not provided
        if not catenda_topic_id:
            metadata = _get_metadata_repo().get(sak_id)
            if metadata and metadata.catenda_topic_id:
                catenda_topic_id = metadata.catenda_topic_id
                logger.info(
                    f"📋 Retrieved catenda_topic_id from metadata: {catenda_topic_id}"
                )

        # Optional client-generated PDF (PREFERRED)
        client_pdf_base64 = payload.get("pdf_base64")
        client_pdf_filename = payload.get("pdf_filename")

        if not sak_id or expected_version is None or not event_data:
            return jsonify(
                {
                    "success": False,
                    "error": "MISSING_PARAMETERS",
                    "message": "sak_id, expected_version, and event are required",
                }
            ), 400

        logger.info(
            f"📥 Event submission for case {sak_id}, expected version: {expected_version}"
        )

        if client_pdf_base64:
            logger.info(f"✅ Client provided PDF: {client_pdf_filename}")
        else:
            logger.info("⚠️ No client PDF, backend will generate as fallback if needed")

        # 1. Validate event data against constants BEFORE parsing
        event_type = event_data.get("event_type")
        data_payload = event_data.get("data")

        try:
            _validate_event_by_type(event_type, data_payload)
        except ApiValidationError as e:
            logger.error(f"❌ API validation error: {e}")
            return jsonify(_build_validation_error_response(e)), 400

        # 2. Parse event (validates server-controlled fields)
        event_data["sak_id"] = sak_id
        event = parse_event_from_request(event_data)

        # 3. Load current state for validation
        existing_events_data, current_version = _get_event_repo().get_events(sak_id)

        # 4. Validate expected version BEFORE business rules
        if current_version != expected_version:
            conflict_message = _build_version_conflict_message(
                existing_events_data, event
            )
            return jsonify(
                {
                    "success": False,
                    "error": "VERSION_CONFLICT",
                    "expected_version": expected_version,
                    "current_version": current_version,
                    "message": conflict_message,
                }
            ), 409

        # 5. Compute current state and validate business rules
        try:
            current_state, existing_events, old_status = (
                _validate_business_rules_and_compute_state(event, existing_events_data)
            )
        except ValueError as e:
            return jsonify(
                {
                    "success": False,
                    "error": "BUSINESS_RULE_VIOLATION",
                    "rule": getattr(e, "rule", None),
                    "message": str(e),
                }
            ), 400

        # 5c. Enrich event with version tracking fields
        event = enrich_event_with_version(event, current_state)

        # 5d. Pre-flight check: Verify Catenda token if Catenda integration is requested
        _ensure_catenda_auth(catenda_topic_id)

        # 6. Persist event (with optimistic lock)
        try:
            new_version = _get_event_repo().append(event, expected_version)
        except ConcurrencyError as e:
            return handle_concurrency_error(e)

        # 7. Compute new state
        all_events = existing_events + [event]
        new_state = _get_timeline_service().compute_state(all_events)

        # 8. Update cached metadata
        _get_metadata_repo().update_cache(
            sak_id=sak_id,
            cached_title=new_state.sakstittel,
            cached_status=new_state.overordnet_status,
            last_event_at=datetime.now(UTC),
        )

        logger.info(f"✅ Event persisted, new version: {new_version}")

        # 9. Catenda Integration (PDF + Comment + Status Sync) - optional
        catenda_success = False
        pdf_source = None
        catenda_documents: list[dict[str, Any]] = []
        catenda_skipped_reason = None

        from core.config import settings

        if settings.is_catenda_enabled and catenda_topic_id:
            catenda_success, pdf_source, catenda_documents = _post_to_catenda(
                sak_id=sak_id,
                state=new_state,
                event=event,
                topic_id=catenda_topic_id,
                client_pdf_base64=client_pdf_base64,
                client_pdf_filename=client_pdf_filename,
                old_status=old_status,
            )
            if not catenda_success:
                catenda_skipped_reason = "error"
        elif not settings.is_catenda_enabled:
            catenda_skipped_reason = "catenda_disabled"
        else:
            catenda_skipped_reason = "no_topic_id"

        # 10. Return success with new state
        return jsonify(
            {
                "success": True,
                "event_id": event.event_id,
                "new_version": new_version,
                "state": new_state.model_dump(mode="json"),
                "pdf_uploaded": catenda_success,
                "pdf_source": pdf_source,
                "catenda_synced": catenda_success,
                "catenda_skipped_reason": catenda_skipped_reason,
                "catenda_documents": catenda_documents,
            }
        ), 201

    except CatendaAuthError as e:
        logger.error(f"❌ Catenda token expired: {e}")
        return jsonify(
            {
                "success": False,
                "error": "CATENDA_TOKEN_EXPIRED",
                "message": "Catenda access token er utgått. Vennligst oppdater token.",
            }
        ), 401
    except ValueError as e:
        logger.error(f"❌ Validation error: {e}")
        return jsonify(
            {"success": False, "error": "VALIDATION_ERROR", "message": str(e)}
        ), 400
    except Exception as e:
        logger.error(f"❌ Internal error: {e}", exc_info=True)
        return jsonify(
            {"success": False, "error": "INTERNAL_ERROR", "message": str(e)}
        ), 500


@events_bp.route("/api/events/batch", methods=["POST"])
@require_csrf
@require_magic_link
def submit_batch():
    """
    Submit multiple events atomically.

    Used for initial case creation where Grunnlag + Vederlag + Frist
    are submitted together.

    Request:
    {
        "sak_id": "KOE-20251201-001",
        "expected_version": 0,
        "events": [
            { "event_type": "sak_opprettet", ... },
            { "event_type": "grunnlag_opprettet", ... },
            { "event_type": "vederlag_krav_sendt", ... }
        ]
    }

    ATOMICITY: All events are persisted in a single transaction.
    If any validation fails, NONE are persisted.
    """
    try:
        data = request.json
        sak_id = data.get("sak_id")
        expected_version = data.get("expected_version")
        event_datas = data.get("events", [])

        if not sak_id or expected_version is None or not event_datas:
            return jsonify(
                {
                    "success": False,
                    "error": "INVALID_REQUEST",
                    "message": "sak_id, expected_version og events[] er påkrevd",
                }
            ), 400

        # 1. Parse all events
        events = []
        for ed in event_datas:
            ed["sak_id"] = sak_id  # Ensure consistent sak_id
            events.append(parse_event_from_request(ed))

        # 2. Load current state
        existing_events_data, current_version = _get_event_repo().get_events(sak_id)

        # 3. Validate version
        if current_version != expected_version:
            return jsonify(
                {
                    "success": False,
                    "error": "VERSION_CONFLICT",
                    "expected_version": expected_version,
                    "current_version": current_version,
                    "message": "Saken har blitt oppdatert. Last inn på nytt for å se endringene.",
                }
            ), 409

        # 4. Validate business rules for EACH event in sequence
        if existing_events_data:
            existing_events = [parse_event(e) for e in existing_events_data]
            state = _get_timeline_service().compute_state(existing_events)
        else:
            existing_events = []
            state = None

        validated_events = []
        for event in events:
            if state:
                validation = validator.validate(event, state)
                if not validation.is_valid:
                    return jsonify(
                        {
                            "success": False,
                            "error": "BUSINESS_RULE_VIOLATION",
                            "rule": validation.violated_rule,
                            "message": validation.message,
                            "failed_event_type": event.event_type.value,
                        }
                    ), 400

            # Enrich event with version tracking fields
            event = enrich_event_with_version(event, state)
            validated_events.append(event)

            # Simulate state after this event for next validation
            if state:
                state = _get_timeline_service().compute_state(
                    existing_events + validated_events
                )
            else:
                # First event in batch, create initial state
                state = _get_timeline_service().compute_state(validated_events)

        # 5. Persist events (use SakCreationService for new cases, direct append for existing)
        if expected_version == 0:
            # New case: Use SakCreationService for atomic metadata + events
            from services.sak_creation_service import get_sak_creation_service

            initial_state = _get_timeline_service().compute_state(validated_events)
            result = get_sak_creation_service().create_sak(
                sak_id=sak_id,
                sakstype=data.get("sakstype", "standard"),
                events=validated_events,
                prosjekt_id=data.get("prosjekt_id"),
                metadata_kwargs={
                    "created_by": request.magic_link_data.get("email", "unknown"),
                    "cached_title": initial_state.sakstittel,
                    "cached_status": initial_state.overordnet_status,
                },
            )
            if not result.success:
                return jsonify(
                    {
                        "success": False,
                        "error": "CREATION_FAILED",
                        "message": result.error,
                    }
                ), 500
            new_version = result.version
        else:
            # Existing case: Use direct append_batch
            try:
                new_version = _get_event_repo().append_batch(
                    validated_events, expected_version
                )
            except ConcurrencyError as e:
                return handle_concurrency_error(e)

        # 6. Compute final state and update metadata cache
        all_events = existing_events + validated_events
        final_state = _get_timeline_service().compute_state(all_events)

        # 7. Update metadata cache (both new and existing cases)
        _get_metadata_repo().update_cache(
            sak_id=sak_id,
            cached_title=final_state.sakstittel,
            cached_status=final_state.overordnet_status,
            last_event_at=datetime.now(UTC),
        )

        return jsonify(
            {
                "success": True,
                "event_ids": [e.event_id for e in events],
                "new_version": new_version,
                "state": final_state.model_dump(mode="json"),
            }
        ), 201

    except Exception as e:
        return jsonify(
            {"success": False, "error": "INTERNAL_ERROR", "message": str(e)}
        ), 500


@events_bp.route("/api/cases", methods=["GET"])
@require_magic_link
def list_cases():
    """
    List all cases with metadata.

    Query parameters:
    - sakstype: Filter by case type (standard, forsering, endringsordre)

    Response 200:
    {
        "cases": [
            {
                "sak_id": "SAK-20251201-001",
                "sakstype": "standard",
                "cached_title": "Grunnforhold - uforutsette forhold",
                "cached_status": "Under behandling",
                "created_at": "2025-01-15T10:30:00Z",
                "created_by": "contractor@example.com",
                "last_event_at": "2025-01-20T14:00:00Z"
            },
            ...
        ]
    }
    """
    try:
        sakstype = request.args.get("sakstype")

        if sakstype:
            cases = _get_metadata_repo().list_by_sakstype(sakstype)
        else:
            cases = _get_metadata_repo().list_all()

        return jsonify(
            {
                "cases": [
                    {
                        "sak_id": c.sak_id,
                        "sakstype": getattr(c, "sakstype", "standard"),
                        "cached_title": c.cached_title,
                        "cached_status": c.cached_status,
                        "created_at": c.created_at.isoformat()
                        if c.created_at
                        else None,
                        "created_by": c.created_by,
                        "last_event_at": c.last_event_at.isoformat()
                        if c.last_event_at
                        else None,
                    }
                    for c in cases
                ]
            }
        )

    except Exception as e:
        logger.error(f"❌ Failed to list cases: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@events_bp.route("/api/cases/<sak_id>/state", methods=["GET"])
@require_magic_link
def get_case_state(sak_id: str):
    """
    Get computed state for a case.

    Response includes version for optimistic locking.
    """
    logger.info(f"📊 State request for sak_id: {sak_id}")

    events_data, version = _get_event_repo().get_events(sak_id)
    logger.info(f"📊 Retrieved {len(events_data)} raw events, version: {version}")

    if not events_data:
        logger.warning(f"⚠️ No events found for sak_id: {sak_id}")
        return jsonify({"error": "Sak ikke funnet"}), 404

    # Parse events from stored data with error handling
    events = []
    for i, e in enumerate(events_data):
        try:
            parsed = parse_event(e)
            events.append(parsed)
        except Exception as parse_error:
            logger.error(f"❌ Failed to parse event {i}: {parse_error}")
            logger.error(f"   Raw event data: {e}")

    logger.info(f"📊 Successfully parsed {len(events)} of {len(events_data)} events")

    if not events:
        logger.error(f"❌ All events failed to parse for sak_id: {sak_id}")
        return jsonify({"error": "Kunne ikke lese hendelser"}), 500

    try:
        state = _get_timeline_service().compute_state(events)
    except Exception as compute_error:
        logger.error(f"❌ Failed to compute state: {compute_error}", exc_info=True)
        return jsonify({"error": "Kunne ikke beregne saksstatus"}), 500

    return jsonify({"version": version, "state": state.model_dump(mode="json")})


@events_bp.route("/api/cases/<sak_id>/timeline", methods=["GET"])
@require_magic_link
def get_case_timeline(sak_id: str):
    """
    Get full event timeline for UI display.

    Returns CloudEvents v1.0 format:
    {
        "version": 5,
        "events": [
            {
                "specversion": "1.0",
                "id": "uuid",
                "source": "/projects/P-001/cases/SAK-001",
                "type": "no.oslo.koe.grunnlag_opprettet",
                "time": "2025-01-15T10:30:00Z",
                "subject": "SAK-001",
                "datacontenttype": "application/json",
                "actor": "Ola Nordmann",
                "actorrole": "TE",
                "data": { ... }
            },
            ...
        ]
    }
    """
    logger.info(f"📋 Timeline request for sak_id: {sak_id}")

    events_data, version = _get_event_repo().get_events(sak_id)
    logger.info(f"📋 Retrieved {len(events_data)} raw events, version: {version}")

    if not events_data:
        logger.warning(f"⚠️ No events found for sak_id: {sak_id}")
        return jsonify({"error": "Sak ikke funnet"}), 404

    # Parse events from stored data with error handling
    events = []
    for i, e in enumerate(events_data):
        try:
            parsed = parse_event(e)
            events.append(parsed)
        except Exception as parse_error:
            logger.error(f"❌ Failed to parse event {i}: {parse_error}")
            logger.error(f"   Raw event data: {e}")

    logger.info(f"📋 Successfully parsed {len(events)} of {len(events_data)} events")

    if not events:
        logger.error(f"❌ All events failed to parse for sak_id: {sak_id}")
        return jsonify({"error": "Kunne ikke lese hendelser"}), 500

    # Always return CloudEvents format
    cloudevents_timeline = format_timeline_response(events)
    response = jsonify({"version": version, "events": cloudevents_timeline})
    response.headers["Content-Type"] = "application/cloudevents+json"
    return response


@events_bp.route("/api/cases/<sak_id>/historikk", methods=["GET"])
@require_magic_link
def get_case_historikk(sak_id: str):
    """
    Get revision history for all three tracks (grunnlag, vederlag, frist).

    Returns a chronological list of all claim versions and BH responses,
    with version numbers to enable side-by-side comparison in the UI.
    """
    logger.info(f"📜 Historikk request for sak_id: {sak_id}")

    events_data, version = _get_event_repo().get_events(sak_id)
    logger.info(f"📜 Retrieved {len(events_data)} raw events, version: {version}")

    if not events_data:
        logger.warning(f"⚠️ No events found for sak_id: {sak_id}")
        return jsonify({"error": "Sak ikke funnet"}), 404

    # Parse events from stored data with error handling
    events = []
    for i, e in enumerate(events_data):
        try:
            parsed = parse_event(e)
            events.append(parsed)
        except Exception as parse_error:
            logger.error(f"❌ Failed to parse event {i}: {parse_error}")
            logger.error(f"   Raw event data: {e}")

    logger.info(f"📜 Successfully parsed {len(events)} of {len(events_data)} events")

    if not events:
        logger.error(f"❌ All events failed to parse for sak_id: {sak_id}")
        return jsonify({"error": "Kunne ikke lese hendelser"}), 500

    # Build historikk for all three tracks
    grunnlag_historikk = _get_timeline_service().get_grunnlag_historikk(events)
    vederlag_historikk = _get_timeline_service().get_vederlag_historikk(events)
    frist_historikk = _get_timeline_service().get_frist_historikk(events)

    return jsonify(
        {
            "version": version,
            "grunnlag": grunnlag_historikk,
            "vederlag": vederlag_historikk,
            "frist": frist_historikk,
        }
    )


# ============================================================
# CATENDA INTEGRATION HELPERS
# ============================================================


class CatendaContext:
    """Container for Catenda integration context."""

    def __init__(self, service, project_id, board_id, library_id, folder_id):
        self.service = service
        self.project_id = project_id
        self.board_id = board_id
        self.library_id = library_id
        self.folder_id = folder_id


def _prepare_catenda_context(sak_id: str) -> CatendaContext | None:
    """
    Prepare Catenda integration context.

    Args:
        sak_id: Case identifier

    Returns:
        CatendaContext if successful, None if Catenda not available
    """
    catenda_service = get_catenda_service()
    if not catenda_service:
        logger.warning("❌ Catenda service not configured, skipping")
        return None

    metadata = _get_metadata_repo().get(sak_id)
    if not metadata:
        logger.warning(f"❌ No metadata found for case {sak_id}")
        return None

    config = settings.get_catenda_config()
    project_id = config.get("catenda_project_id")
    board_id = metadata.catenda_board_id if metadata else None

    if not project_id or not board_id:
        logger.warning(f"❌ Missing project/board ID for case {sak_id}")
        return None

    catenda_service.set_topic_board_id(board_id)

    library_id = config.get("catenda_library_id")
    if library_id:
        catenda_service.set_library_id(library_id)

    folder_id = config.get("catenda_folder_id")

    return CatendaContext(catenda_service, project_id, board_id, library_id, folder_id)


def _resolve_pdf(
    sak_id: str, state, client_pdf_base64: str | None, client_pdf_filename: str | None
) -> tuple[str | None, str | None, str | None]:
    """
    Resolve PDF for Catenda upload.

    Priority: client-generated PDF > server-generated PDF

    Args:
        sak_id: Case identifier
        state: Current SakState
        client_pdf_base64: Optional base64 PDF from client
        client_pdf_filename: Optional filename from client

    Returns:
        (pdf_path, filename, pdf_source) where pdf_source is "client" or "server"
    """
    # PRIORITY 1: Try client-generated PDF
    if client_pdf_base64:
        try:
            pdf_data = base64.b64decode(client_pdf_base64)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
                temp_pdf.write(pdf_data)
                pdf_path = temp_pdf.name
            filename = client_pdf_filename or f"KOE_{sak_id}.pdf"
            logger.info(f"✅ Client PDF decoded: {len(pdf_data)} bytes")
            return pdf_path, filename, "client"
        except Exception as e:
            logger.error(f"❌ Failed to decode client PDF: {e}")

    # PRIORITY 2: Fallback to server generation
    try:
        from services.reportlab_pdf_generator import ReportLabPdfGenerator

        events_list = []
        try:
            events_data, _ = _get_event_repo().get_events(sak_id)
            events_list = events_data
        except Exception as e:
            logger.warning(f"Could not get events for PDF: {e}")

        pdf_generator = ReportLabPdfGenerator()
        filename = f"KOE_{sak_id}.pdf"

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            pdf_path = temp_pdf.name

        pdf_bytes = pdf_generator.generate_pdf(state, events_list, pdf_path)

        if pdf_bytes is None and pdf_path:
            logger.info(f"✅ Server PDF generated: {filename}")
            return pdf_path, filename, "server"
        elif pdf_bytes:
            with open(pdf_path, "wb") as f:
                f.write(pdf_bytes)
            logger.info(f"✅ Server PDF generated: {filename}")
            return pdf_path, filename, "server"

    except ImportError as e:
        logger.warning(f"⚠️ ReportLab not installed: {e}")
    except Exception as e:
        logger.error(f"❌ Failed to generate PDF: {e}", exc_info=True)

    return None, None, None


def _upload_and_link_pdf(
    ctx: CatendaContext, topic_id: str, pdf_path: str, filename: str, source: str
) -> dict[str, Any] | None:
    """
    Upload PDF to Catenda and link to topic.

    Args:
        ctx: Catenda context
        topic_id: Catenda topic GUID
        pdf_path: Path to PDF file
        filename: Filename for upload
        source: PDF source ("client" or "server")

    Returns:
        Document info dict if successful, None otherwise:
        {
            "id": "catenda-document-id",
            "filename": "uploaded-filename.pdf",
            "source": "client" | "server"
        }
    """
    doc_result = ctx.service.upload_document(
        ctx.project_id, pdf_path, filename, ctx.folder_id
    )
    if not doc_result:
        logger.error("❌ Failed to upload PDF to Catenda")
        return None

    compact_guid = doc_result.get("id") or doc_result.get("library_item_id")
    logger.info(f"✅ PDF uploaded to Catenda: {compact_guid}")

    # Format GUID with dashes for BCF API
    if compact_guid and len(compact_guid) == 32:
        document_guid = (
            f"{compact_guid[:8]}-{compact_guid[8:12]}-"
            f"{compact_guid[12:16]}-{compact_guid[16:20]}-{compact_guid[20:]}"
        )
    else:
        document_guid = compact_guid

    # Link document to topic
    if document_guid:
        ref_result = ctx.service.create_document_reference(topic_id, document_guid)
        if not ref_result and compact_guid != document_guid:
            logger.warning(f"Formatted GUID failed, trying compact: {compact_guid}")
            ref_result = ctx.service.create_document_reference(topic_id, compact_guid)

        if ref_result is not None:
            return {"id": compact_guid, "filename": filename, "source": source}

    return None


def _post_catenda_comment(
    ctx: CatendaContext, topic_id: str, sak_id: str, state, event
) -> bool:
    """
    Generate and post comment to Catenda.

    Args:
        ctx: Catenda context
        topic_id: Catenda topic GUID
        sak_id: Case identifier
        state: Current SakState
        event: The triggering event

    Returns:
        True if successful
    """
    try:
        from services.catenda_comment_generator import CatendaCommentGenerator
        from utils.filtering_config import get_frontend_route

        comment_generator = CatendaCommentGenerator()

        magic_token = magic_link_manager.generate(sak_id=sak_id)
        base_url = settings.dev_react_app_url or settings.react_app_url
        sakstype = getattr(state, "sakstype", "koe") or "koe"
        frontend_route = get_frontend_route(sakstype, sak_id)
        magic_link = (
            f"{base_url}{frontend_route}?magicToken={magic_token}" if base_url else None
        )

        comment_text = comment_generator.generate_comment(state, event, magic_link)
        ctx.service.create_comment(topic_id, comment_text)

        logger.info(f"✅ Comment posted to Catenda for case {sak_id}")
        return True

    except ImportError:
        logger.warning("Comment generator not available, skipping comment")
    except Exception as e:
        logger.error(f"❌ Failed to post comment: {e}")

    return False


def _sync_topic_status(
    ctx: CatendaContext, topic_id: str, old_status: str | None, new_status: str
) -> None:
    """
    Sync topic status to Catenda if changed.

    Args:
        ctx: Catenda context
        topic_id: Catenda topic GUID
        old_status: Previous status
        new_status: Current status
    """
    if old_status == new_status:
        logger.debug(f"📊 Status unchanged ({new_status}), skipping Catenda update")
        return

    catenda_status = map_status_to_catenda(new_status)
    logger.info(
        f"📊 Status changed: {old_status} → {new_status} (Catenda: {catenda_status})"
    )

    result = ctx.service.update_topic_status(topic_id, new_status)
    if result:
        logger.info(f"✅ Topic status updated to: {catenda_status}")
    else:
        logger.warning("⚠️ Topic status update failed or returned None")


def _post_to_catenda(
    sak_id: str,
    state,
    event,
    topic_id: str,
    client_pdf_base64: str | None = None,
    client_pdf_filename: str | None = None,
    old_status: str | None = None,
) -> tuple[bool, str | None, list[dict[str, Any]]]:
    """
    Post PDF and comment to Catenda (hybrid approach) + sync status.

    Priority:
    1. Use client-generated PDF if provided (PREFERRED)
    2. Generate PDF on server as fallback (ReportLab)
    3. Sync topic status if changed

    Args:
        sak_id: Case identifier
        state: Current SakState
        event: The event that triggered this
        topic_id: Catenda topic GUID
        client_pdf_base64: Optional base64 PDF from client
        client_pdf_filename: Optional filename from client
        old_status: Previous overordnet_status for status sync

    Returns:
        (success, pdf_source, catenda_documents)
        - success: True if PDF uploaded or comment posted
        - pdf_source: "client" | "server" | None
        - catenda_documents: List of uploaded document info dicts
    """
    try:
        logger.info(f"🔄 _post_to_catenda called for case {sak_id}, topic {topic_id}")

        catenda_documents: list[dict[str, Any]] = []

        # 1. Prepare Catenda context (service, config, IDs)
        ctx = _prepare_catenda_context(sak_id)
        if not ctx:
            return False, None, []

        # 2. Resolve PDF (client or server-generated)
        pdf_path, filename, pdf_source = _resolve_pdf(
            sak_id, state, client_pdf_base64, client_pdf_filename
        )

        # 3. Upload and link PDF to topic
        pdf_uploaded = False
        if pdf_path:
            doc_info = _upload_and_link_pdf(
                ctx, topic_id, pdf_path, filename, pdf_source
            )
            pdf_uploaded = doc_info is not None
            if doc_info:
                catenda_documents.append(doc_info)
            # Cleanup temp file
            try:
                os.remove(pdf_path)
            except OSError:
                pass

        # 4. Post comment (always try, regardless of PDF status)
        comment_posted = _post_catenda_comment(ctx, topic_id, sak_id, state, event)

        # 5. Sync topic status if changed
        _sync_topic_status(ctx, topic_id, old_status, state.overordnet_status)

        # Return success if either PDF uploaded or comment posted
        return (pdf_uploaded or comment_posted), pdf_source, catenda_documents

    except CatendaAuthError:
        # Re-raise auth errors to trigger proper error handling upstream
        raise
    except Exception as e:
        logger.error(f"❌ Failed to post to Catenda: {e}", exc_info=True)
        return False, None, []


def get_catenda_service() -> CatendaService | None:
    """Get configured Catenda service or None if not available."""
    try:
        client = get_catenda_client()
        if not client:
            return None
        return CatendaService(catenda_api_client=client)
    except Exception as e:
        logger.warning(f"Catenda service not available: {e}")
        return None
