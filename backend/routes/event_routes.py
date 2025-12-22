"""
Event submission API with optimistic concurrency control and hybrid PDF generation.

This module provides REST endpoints for submitting events to cases,
with full support for:
- Optimistic locking (version-based conflict detection)
- Business rule validation
- Atomic batch submissions
- State computation and caching
- Hybrid PDF generation (client-provided or server fallback)
- Catenda integration (PDF upload + comment posting)
- CloudEvents v1.0 format for all event responses
"""
from flask import Blueprint, request, jsonify
from typing import Optional, Tuple
import base64
import tempfile
import os
from datetime import datetime, timezone

from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator
from repositories.event_repository import ConcurrencyError
from repositories import create_event_repository
from repositories.supabase_sak_metadata_repository import create_metadata_repository
from models.events import parse_event_from_request, parse_event, EventType
from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link, get_magic_link_manager
from services.catenda_service import CatendaService
from lib.catenda_factory import get_catenda_client
from integrations.catenda.client import CatendaAuthError
from core.config import settings
from utils.logger import get_logger
from api.validators import (
    validate_grunnlag_event,
    validate_vederlag_event,
    validate_frist_event,
    validate_respons_event,
    ValidationError as ApiValidationError,
)
from lib.cloudevents import (
    format_event_response,
    format_timeline_response,
)

logger = get_logger(__name__)

events_bp = Blueprint('events', __name__)

# Dependencies (consider DI container for production)
# Uses EVENT_STORE_BACKEND env var: "json" (default) or "supabase"
event_repo = create_event_repository()
metadata_repo = create_metadata_repository()
timeline_service = TimelineService()
validator = BusinessRuleValidator()
magic_link_manager = get_magic_link_manager()


@events_bp.route('/api/events', methods=['POST'])
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
        sak_id = payload.get('sak_id')
        expected_version = payload.get('expected_version')
        event_data = payload.get('event')
        catenda_topic_id = payload.get('catenda_topic_id')

        # Look up catenda_topic_id from metadata if not provided
        if not catenda_topic_id:
            metadata = metadata_repo.get(sak_id)
            if metadata and metadata.catenda_topic_id:
                catenda_topic_id = metadata.catenda_topic_id
                logger.info(f"📋 Retrieved catenda_topic_id from metadata: {catenda_topic_id}")

        # Optional client-generated PDF (PREFERRED)
        client_pdf_base64 = payload.get('pdf_base64')
        client_pdf_filename = payload.get('pdf_filename')

        if not sak_id or expected_version is None or not event_data:
            return jsonify({
                "success": False,
                "error": "MISSING_PARAMETERS",
                "message": "sak_id, expected_version, and event are required"
            }), 400

        logger.info(f"📥 Event submission for case {sak_id}, expected version: {expected_version}")

        if client_pdf_base64:
            logger.info(f"✅ Client provided PDF: {client_pdf_filename}")
        else:
            logger.info(f"⚠️ No client PDF, backend will generate as fallback if needed")

        # 1. Validate event data against constants BEFORE parsing
        event_type = event_data.get('event_type')
        data_payload = event_data.get('data')

        try:
            if event_type in [EventType.GRUNNLAG_OPPRETTET.value, EventType.GRUNNLAG_OPPDATERT.value]:
                validate_grunnlag_event(data_payload)
            elif event_type in [EventType.VEDERLAG_KRAV_SENDT.value, EventType.VEDERLAG_KRAV_OPPDATERT.value]:
                validate_vederlag_event(data_payload)
            elif event_type == EventType.FRIST_KRAV_SENDT.value:
                validate_frist_event(data_payload)
            elif event_type == EventType.FRIST_KRAV_OPPDATERT.value:
                validate_frist_event(data_payload, is_update=True)
            elif event_type == EventType.FRIST_KRAV_SPESIFISERT.value:
                validate_frist_event(data_payload, is_specification=True)
            elif event_type == EventType.RESPONS_GRUNNLAG.value:
                validate_respons_event(data_payload, 'grunnlag')
            elif event_type == EventType.RESPONS_VEDERLAG.value:
                validate_respons_event(data_payload, 'vederlag')
            elif event_type == EventType.RESPONS_FRIST.value:
                validate_respons_event(data_payload, 'frist')
        except ApiValidationError as e:
            logger.error(f"❌ API validation error: {e}")
            response = {
                "success": False,
                "error": "VALIDATION_ERROR",
                "message": e.message if hasattr(e, 'message') else str(e)
            }
            # Include valid_options if available (helps frontend/developers)
            if hasattr(e, 'valid_options') and e.valid_options:
                response["valid_options"] = e.valid_options
            if hasattr(e, 'field') and e.field:
                response["field"] = e.field
            return jsonify(response), 400

        # 2. Parse event (validates server-controlled fields)
        event_data['sak_id'] = sak_id
        event = parse_event_from_request(event_data)

        # 3. Load current state for validation
        existing_events_data, current_version = event_repo.get_events(sak_id)

        # 4. Validate expected version BEFORE business rules
        if current_version != expected_version:
            return jsonify({
                "success": False,
                "error": "VERSION_CONFLICT",
                "expected_version": expected_version,
                "current_version": current_version,
                "message": "Tilstanden har endret seg. Vennligst last inn på nytt."
            }), 409

        # 5. Compute current state and validate business rules
        old_status = None  # Track old status for Catenda sync
        if existing_events_data:
            existing_events = [parse_event(e) for e in existing_events_data]
            current_state = timeline_service.compute_state(existing_events)
            old_status = current_state.overordnet_status
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

        # 5b. Pre-flight check: Verify Catenda token if Catenda integration is requested
        if catenda_topic_id:
            catenda_service = get_catenda_service()
            if catenda_service and catenda_service.client:
                if not catenda_service.client.ensure_authenticated():
                    logger.error("❌ Catenda token expired or invalid - rejecting event submission")
                    raise CatendaAuthError("Catenda access token expired")

        # 6. Persist event (with optimistic lock)
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

        # 7. Compute new state
        all_events = existing_events + [event]
        new_state = timeline_service.compute_state(all_events)

        # 8. Update cached metadata
        metadata_repo.update_cache(
            sak_id=sak_id,
            cached_title=new_state.sakstittel,
            cached_status=new_state.overordnet_status,
            last_event_at=datetime.now(timezone.utc)
        )

        logger.info(f"✅ Event persisted, new version: {new_version}")

        # 9. Catenda Integration (PDF + Comment + Status Sync) - optional
        catenda_success = False
        pdf_source = None

        if catenda_topic_id:
            catenda_success, pdf_source = _post_to_catenda(
                sak_id=sak_id,
                state=new_state,
                event=event,
                topic_id=catenda_topic_id,
                client_pdf_base64=client_pdf_base64,
                client_pdf_filename=client_pdf_filename,
                old_status=old_status
            )

        # 10. Return success with new state
        return jsonify({
            "success": True,
            "event_id": event.event_id,
            "new_version": new_version,
            "state": new_state.model_dump(mode='json'),
            "pdf_uploaded": catenda_success,
            "pdf_source": pdf_source
        }), 201

    except CatendaAuthError as e:
        logger.error(f"❌ Catenda token expired: {e}")
        return jsonify({
            "success": False,
            "error": "CATENDA_TOKEN_EXPIRED",
            "message": "Catenda access token er utgått. Vennligst oppdater token."
        }), 401
    except ValueError as e:
        logger.error(f"❌ Validation error: {e}")
        return jsonify({
            "success": False,
            "error": "VALIDATION_ERROR",
            "message": str(e)
        }), 400
    except Exception as e:
        logger.error(f"❌ Internal error: {e}", exc_info=True)
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

        # 7. Create or update metadata
        if expected_version == 0:
            # New case - create metadata entry
            from models.sak_metadata import SakMetadata
            metadata = SakMetadata(
                sak_id=sak_id,
                prosjekt_id=data.get('prosjekt_id'),
                created_at=datetime.now(timezone.utc),
                created_by=request.magic_link_data.get('email', 'unknown'),
                cached_title=final_state.sakstittel,
                cached_status=final_state.overordnet_status,
                last_event_at=datetime.now(timezone.utc)
            )
            metadata_repo.upsert(metadata)
        else:
            # Existing case - update cache only
            metadata_repo.update_cache(
                sak_id=sak_id,
                cached_title=final_state.sakstittel,
                cached_status=final_state.overordnet_status,
                last_event_at=datetime.now(timezone.utc)
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


@events_bp.route('/api/cases', methods=['GET'])
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
        sakstype = request.args.get('sakstype')

        if sakstype:
            cases = metadata_repo.list_by_sakstype(sakstype)
        else:
            cases = metadata_repo.list_all()

        return jsonify({
            "cases": [
                {
                    "sak_id": c.sak_id,
                    "sakstype": getattr(c, 'sakstype', 'standard'),
                    "cached_title": c.cached_title,
                    "cached_status": c.cached_status,
                    "created_at": c.created_at.isoformat() if c.created_at else None,
                    "created_by": c.created_by,
                    "last_event_at": c.last_event_at.isoformat() if c.last_event_at else None,
                }
                for c in cases
            ]
        })

    except Exception as e:
        logger.error(f"❌ Failed to list cases: {e}", exc_info=True)
        return jsonify({
            "error": "INTERNAL_ERROR",
            "message": str(e)
        }), 500


@events_bp.route('/api/cases/<sak_id>/state', methods=['GET'])
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


@events_bp.route('/api/cases/<sak_id>/timeline', methods=['GET'])
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

    events_data, version = event_repo.get_events(sak_id)
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
    response = jsonify({
        "version": version,
        "events": cloudevents_timeline
    })
    response.headers['Content-Type'] = 'application/cloudevents+json'
    return response


@events_bp.route('/api/cases/<sak_id>/historikk', methods=['GET'])
@require_magic_link
def get_case_historikk(sak_id: str):
    """
    Get revision history for vederlag and frist tracks.

    Returns a chronological list of all claim versions and BH responses,
    with version numbers to enable side-by-side comparison in the UI.
    """
    logger.info(f"📜 Historikk request for sak_id: {sak_id}")

    events_data, version = event_repo.get_events(sak_id)
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

    # Build historikk for both tracks
    vederlag_historikk = timeline_service.get_vederlag_historikk(events)
    frist_historikk = timeline_service.get_frist_historikk(events)

    return jsonify({
        "version": version,
        "vederlag": vederlag_historikk,
        "frist": frist_historikk
    })


# ============================================================
# CATENDA INTEGRATION HELPERS
# ============================================================

def _post_to_catenda(
    sak_id: str,
    state,
    event,
    topic_id: str,
    client_pdf_base64: Optional[str] = None,
    client_pdf_filename: Optional[str] = None,
    old_status: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Post PDF and comment to Catenda (hybrid approach) + sync status.

    Priority:
    1. Use client-generated PDF if provided (PREFERRED)
    2. Generate PDF on server as fallback (WeasyPrint)
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
        (success, pdf_source)  # pdf_source = "client" | "server" | None
    """
    try:
        logger.info(f"🔄 _post_to_catenda called for case {sak_id}, topic {topic_id}")

        catenda_service = get_catenda_service()
        if not catenda_service:
            logger.warning("❌ Catenda service not configured, skipping")
            return False, None
        logger.info("✅ Catenda service available")

        # Get case metadata for project/board IDs
        metadata = metadata_repo.get(sak_id)
        if not metadata:
            logger.warning(f"❌ No metadata found for case {sak_id}")
            return False, None
        logger.info(f"✅ Metadata found: board_id={metadata.catenda_board_id}")

        config = settings.get_catenda_config()
        project_id = config.get('catenda_project_id')
        board_id = metadata.catenda_board_id if metadata else None

        if not project_id or not board_id:
            logger.warning(f"❌ Missing project/board ID for case {sak_id} (project={project_id}, board={board_id})")
            return False, None
        logger.info(f"✅ IDs OK: project={project_id}, board={board_id}")

        catenda_service.set_topic_board_id(board_id)

        # Set library ID for document uploads
        library_id = config.get('catenda_library_id')
        if library_id:
            catenda_service.set_library_id(library_id)
            logger.info(f"✅ Library ID set: {library_id}")
        else:
            logger.warning("⚠️ No library ID configured - PDF upload may fail")

        # Get folder ID for document uploads
        folder_id = config.get('catenda_folder_id')
        if folder_id:
            logger.info(f"✅ Folder ID set: {folder_id}")

        pdf_path = None
        pdf_source = None
        filename = None
        pdf_uploaded = False

        # PRIORITY 1: Try to use client-generated PDF (PREFERRED)
        if client_pdf_base64:
            try:
                logger.info(f"📄 Using client-generated PDF: {client_pdf_filename}")

                # Decode base64 PDF
                pdf_data = base64.b64decode(client_pdf_base64)

                # Save to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_pdf:
                    temp_pdf.write(pdf_data)
                    pdf_path = temp_pdf.name

                filename = client_pdf_filename or f"KOE_{sak_id}.pdf"
                pdf_source = "client"

                logger.info(f"✅ Client PDF decoded: {len(pdf_data)} bytes")

            except Exception as e:
                logger.error(f"❌ Failed to decode client PDF: {e}")
                # Fall through to server generation
                pdf_path = None
                pdf_source = None

        # PRIORITY 2: Fallback - Generate PDF on server (ReportLab)
        if not pdf_path:
            logger.info("📄 Generating PDF on server (fallback)")

            try:
                from services.reportlab_pdf_generator import ReportLabPdfGenerator

                # Get events for PDF (to show last TE/BH events per track)
                events_list = []
                try:
                    events_data, _ = event_repo.get_events(sak_id)  # Returns (events as dicts, version)
                    events_list = events_data  # Already dicts from repository
                except Exception as e:
                    logger.warning(f"Could not get events for PDF: {e}")

                pdf_generator = ReportLabPdfGenerator()
                filename = f"KOE_{sak_id}.pdf"

                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_pdf:
                    pdf_path = temp_pdf.name

                pdf_bytes = pdf_generator.generate_pdf(state, events_list, pdf_path)

                if pdf_bytes is None and pdf_path:
                    # File was written directly
                    pdf_source = "server"
                    logger.info(f"✅ Server PDF generated: {filename}")
                elif pdf_bytes:
                    # Write bytes to file
                    with open(pdf_path, 'wb') as f:
                        f.write(pdf_bytes)
                    pdf_source = "server"
                    logger.info(f"✅ Server PDF generated: {filename}")
                else:
                    logger.error("❌ Failed to generate PDF on server")
                    pdf_path = None

            except ImportError as e:
                logger.warning(f"⚠️ ReportLab not installed - PDF generation skipped: {e}")
                pdf_path = None
            except Exception as e:
                logger.error(f"❌ Failed to generate PDF on server: {e}", exc_info=True)
                pdf_path = None

        # Upload PDF to Catenda (if we have one)
        if pdf_path:
            doc_result = catenda_service.upload_document(project_id, pdf_path, filename, folder_id)

            if doc_result:
                # CatendaClient returns 'id', not 'library_item_id'
                compact_guid = doc_result.get('id') or doc_result.get('library_item_id')
                logger.info(f"✅ PDF uploaded to Catenda: {compact_guid}")

                # Format GUID with dashes for BCF API (32 hex chars -> UUID format)
                if compact_guid and len(compact_guid) == 32:
                    document_guid = (
                        f"{compact_guid[:8]}-{compact_guid[8:12]}-"
                        f"{compact_guid[12:16]}-{compact_guid[16:20]}-{compact_guid[20:]}"
                    )
                else:
                    document_guid = compact_guid

                # Link document to topic
                if document_guid:
                    ref_result = catenda_service.create_document_reference(topic_id, document_guid)
                    if not ref_result and compact_guid != document_guid:
                        # Fallback: try compact GUID
                        logger.warning(f"Formatted GUID failed, trying compact: {compact_guid}")
                        ref_result = catenda_service.create_document_reference(topic_id, compact_guid)
                    pdf_uploaded = ref_result is not None
            else:
                logger.error("❌ Failed to upload PDF to Catenda")

            # Cleanup temp file
            try:
                os.remove(pdf_path)
            except:
                pass

        # Generate and post comment (ALWAYS try, regardless of PDF status)
        comment_posted = False
        try:
            from services.catenda_comment_generator import CatendaCommentGenerator
            from utils.filtering_config import get_frontend_route
            comment_generator = CatendaCommentGenerator()

            # Generate magic link for comment
            magic_token = magic_link_manager.generate(sak_id=sak_id)
            base_url = settings.dev_react_app_url or settings.react_app_url
            # Get sakstype from state, default to 'koe' if not available
            sakstype = getattr(state, 'sakstype', 'koe') or 'koe'
            frontend_route = get_frontend_route(sakstype, sak_id)
            magic_link = f"{base_url}{frontend_route}?magicToken={magic_token}" if base_url else None

            comment_text = comment_generator.generate_comment(state, event, magic_link)
            catenda_service.create_comment(topic_id, comment_text)

            logger.info(f"✅ Comment posted to Catenda for case {sak_id}")
            comment_posted = True

        except ImportError:
            logger.warning("Comment generator not available, skipping comment")
        except Exception as e:
            logger.error(f"❌ Failed to post comment: {e}")

        # Sync topic status if changed
        new_status = state.overordnet_status
        if old_status != new_status:
            logger.info(f"📊 Status changed: {old_status} → {new_status}")
            catenda_service.update_topic_status(topic_id, new_status)

        # Return success if either PDF uploaded or comment posted
        return (pdf_uploaded or comment_posted), pdf_source

    except CatendaAuthError:
        # Re-raise auth errors to trigger proper error handling upstream
        raise
    except Exception as e:
        logger.error(f"❌ Failed to post to Catenda: {e}", exc_info=True)
        return False, None


def get_catenda_service() -> Optional[CatendaService]:
    """Get configured Catenda service or None if not available."""
    try:
        client = get_catenda_client()
        if not client:
            return None
        return CatendaService(catenda_api_client=client)
    except Exception as e:
        logger.warning(f"Catenda service not available: {e}")
        return None
