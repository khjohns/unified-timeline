"""
Event submission API with optimistic concurrency control.

This module provides REST endpoints for submitting events to cases,
with full support for:
- Optimistic locking (version-based conflict detection)
- Business rule validation
- Atomic batch submissions
- State computation and caching
"""
from flask import Blueprint, request, jsonify
from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator
from repositories.event_repository import JsonFileEventRepository, ConcurrencyError
from repositories.sak_metadata_repository import SakMetadataRepository
from models.events import parse_event_from_request, parse_event
from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from datetime import datetime

events_bp = Blueprint('events', __name__)

# Dependencies (consider DI container for production)
event_repo = JsonFileEventRepository()
metadata_repo = SakMetadataRepository()
timeline_service = TimelineService()
validator = BusinessRuleValidator()


@events_bp.route('/api/events', methods=['POST'])
@require_csrf
@require_magic_link
def submit_event():
    """
    Submit a single event.

    Request:
    {
        "event_type": "vederlag_krav_sendt",
        "sak_id": "KOE-20251201-001",
        "expected_version": 3,
        "aktor": "ola.nordmann@example.com",
        "aktor_rolle": "TE",
        "data": { ... }
    }

    Response 201:
    {
        "success": true,
        "event_id": "uuid",
        "new_version": 4,
        "state": { ... computed SakState ... }
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
        data = request.json
        expected_version = data.pop('expected_version', None)

        if expected_version is None:
            return jsonify({
                "success": False,
                "error": "MISSING_VERSION",
                "message": "expected_version er påkrevd"
            }), 400

        # 1. Parse event (validates server-controlled fields)
        event = parse_event_from_request(data)

        # 2. Load current state for validation
        existing_events_data, current_version = event_repo.get_events(event.sak_id)

        # 3. Validate expected version BEFORE business rules
        if current_version != expected_version:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": expected_version,
                "current_version": current_version,
                "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
            }), 409

        # 4. Compute current state and validate business rules
        if existing_events_data:
            existing_events = [parse_event(e) for e in existing_events_data]
            current_state = timeline_service.compute_state(existing_events)
            validation = validator.validate(event, current_state)

            if not validation.is_valid:
                return jsonify({
                    "success": False,
                    "error": "BUSINESS_RULE_VIOLATION",
                    "rule": validation.violated_rule,
                    "message": validation.message
                }), 400
        else:
            existing_events = []

        # 5. Persist event (with optimistic lock)
        try:
            new_version = event_repo.append(event, expected_version)
        except ConcurrencyError as e:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": e.expected,
                "current_version": e.actual,
                "message": "Samtidig endring oppdaget. Vennligst last inn på nytt."
            }), 409

        # 6. Compute new state
        all_events = existing_events + [event]
        new_state = timeline_service.compute_state(all_events)

        # 7. Update cached metadata
        metadata_repo.update_cache(
            sak_id=event.sak_id,
            cached_title=new_state.sakstittel,
            cached_status=new_state.overordnet_status,
            last_event_at=datetime.now()
        )

        # 8. Return success with new state
        return jsonify({
            "success": True,
            "event_id": event.event_id,
            "new_version": new_version,
            "state": new_state.model_dump(mode='json')
        }), 201

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": str(e)
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": str(e)
        }), 500


@events_bp.route('/api/events/batch', methods=['POST'])
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
        sak_id = data.get('sak_id')
        expected_version = data.get('expected_version')
        event_datas = data.get('events', [])

        if not sak_id or expected_version is None or not event_datas:
            return jsonify({
                "success": False,
                "error": "INVALID_REQUEST",
                "message": "sak_id, expected_version og events[] er påkrevd"
            }), 400

        # 1. Parse all events
        events = []
        for ed in event_datas:
            ed['sak_id'] = sak_id  # Ensure consistent sak_id
            events.append(parse_event_from_request(ed))

        # 2. Load current state
        existing_events_data, current_version = event_repo.get_events(sak_id)

        # 3. Validate version
        if current_version != expected_version:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": expected_version,
                "current_version": current_version,
                "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
            }), 409

        # 4. Validate business rules for EACH event in sequence
        if existing_events_data:
            existing_events = [parse_event(e) for e in existing_events_data]
            state = timeline_service.compute_state(existing_events)
        else:
            existing_events = []
            state = None

        validated_events = []
        for event in events:
            if state:
                validation = validator.validate(event, state)
                if not validation.is_valid:
                    return jsonify({
                        "success": False,
                        "error": "BUSINESS_RULE_VIOLATION",
                        "rule": validation.violated_rule,
                        "message": validation.message,
                        "failed_event_type": event.event_type.value
                    }), 400

            validated_events.append(event)

            # Simulate state after this event for next validation
            if state:
                state = timeline_service.compute_state(
                    existing_events + validated_events
                )
            else:
                # First event in batch, create initial state
                state = timeline_service.compute_state(validated_events)

        # 5. Persist ALL events atomically
        try:
            new_version = event_repo.append_batch(events, expected_version)
        except ConcurrencyError as e:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": e.expected,
                "current_version": e.actual,
                "message": "Samtidig endring oppdaget. Vennligst last inn på nytt."
            }), 409

        # 6. Compute final state
        all_events = existing_events + events
        final_state = timeline_service.compute_state(all_events)

        # 7. Update cached metadata
        metadata_repo.update_cache(
            sak_id=sak_id,
            cached_title=final_state.sakstittel,
            cached_status=final_state.overordnet_status,
            last_event_at=datetime.now()
        )

        return jsonify({
            "success": True,
            "event_ids": [e.event_id for e in events],
            "new_version": new_version,
            "state": final_state.model_dump(mode='json')
        }), 201

    except Exception as e:
        return jsonify({
            "success": False,
            "error": "INTERNAL_ERROR",
            "message": str(e)
        }), 500


@events_bp.route('/api/case/<sak_id>/state', methods=['GET'])
@require_magic_link
def get_case_state(sak_id: str):
    """
    Get computed state for a case.

    Response includes version for optimistic locking.
    """
    events_data, version = event_repo.get_events(sak_id)

    if not events_data:
        return jsonify({"error": "Sak ikke funnet"}), 404

    # Parse events from stored data
    events = [parse_event(e) for e in events_data]
    state = timeline_service.compute_state(events)

    return jsonify({
        "version": version,
        "state": state.model_dump(mode='json')
    })


@events_bp.route('/api/case/<sak_id>/timeline', methods=['GET'])
@require_magic_link
def get_case_timeline(sak_id: str):
    """
    Get full event timeline for UI display.
    """
    events_data, version = event_repo.get_events(sak_id)

    if not events_data:
        return jsonify({"error": "Sak ikke funnet"}), 404

    # Parse events from stored data
    events = [parse_event(e) for e in events_data]
    timeline = timeline_service.get_timeline(events)

    return jsonify({
        "version": version,
        "events": timeline
    })
