"""
Azure Functions Entry Point

KOE Automation System - Azure Functions versjon.

Dette er hovedfilen for Azure Functions runtime.
Hver funksjon er en HTTP trigger som delegerer til eksisterende services.

Deployment:
1. Deploy til Azure Functions via VS Code, CLI, eller GitHub Actions
2. Sett miljøvariabler i Azure Portal / App Settings
3. Konfigurer Catenda webhook til Azure Functions URL

Lokal utvikling:
    func start
"""

import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
from datetime import UTC

from dotenv import load_dotenv

load_dotenv()

try:
    import azure.functions as func

    AZURE_FUNCTIONS_AVAILABLE = True
except ImportError:
    logger.warning("azure-functions ikke installert. Kjør: pip install azure-functions")
    AZURE_FUNCTIONS_AVAILABLE = False
    func = None

if AZURE_FUNCTIONS_AVAILABLE:
    from functions.adapters import (
        ServiceContext,
        adapt_request,
        create_error_response,
        create_response,
        validate_required_fields,
    )

    app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

    # =========================================================================
    # Health & Utility Endpoints
    # =========================================================================

    @app.route(route="health", methods=["GET"])
    def health(req: func.HttpRequest) -> func.HttpResponse:
        """Health check endpoint."""
        return create_response(
            {
                "status": "healthy",
                "service": "KOE Automation System",
                "version": "1.0.0",
            }
        )

    @app.route(route="csrf-token", methods=["GET"])
    def get_csrf_token(req: func.HttpRequest) -> func.HttpResponse:
        """
        Generer CSRF token.

        I Azure Functions kan dette forenkles eller brukes Azure's
        innebygde auth mekanismer.
        """
        from lib.auth.csrf_protection import generate_csrf_token

        token = generate_csrf_token()
        return create_response({"csrfToken": token})

    @app.route(route="verify-magic-link", methods=["POST"])
    def verify_magic_link(req: func.HttpRequest) -> func.HttpResponse:
        """Verifiser magic link token."""
        from lib.auth.magic_link import MagicLinkManager

        data = adapt_request(req)
        token = data["json"].get("token")

        if not token:
            return create_error_response("Mangler token", 400)

        mgr = MagicLinkManager()
        is_valid, error, payload = mgr.verify(token)

        if not is_valid:
            return create_error_response(error or "Ugyldig token", 401)

        return create_response(
            {
                "success": True,
                "sakId": payload.get("sak_id"),
                "email": payload.get("email"),
            }
        )

    # =========================================================================
    # Case Management Endpoints
    # =========================================================================

    @app.route(route="cases", methods=["GET"])
    def list_cases(req: func.HttpRequest) -> func.HttpResponse:
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
            sakstype = req.params.get("sakstype")

            with ServiceContext() as ctx:
                if sakstype:
                    cases = ctx.metadata_repository.list_by_sakstype(sakstype)
                else:
                    cases = ctx.metadata_repository.list_all()

                return create_response(
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
                                # Reporting fields
                                "cached_sum_krevd": c.cached_sum_krevd,
                                "cached_sum_godkjent": c.cached_sum_godkjent,
                                "cached_dager_krevd": c.cached_dager_krevd,
                                "cached_dager_godkjent": c.cached_dager_godkjent,
                                "cached_hovedkategori": c.cached_hovedkategori,
                                "cached_underkategori": c.cached_underkategori,
                                # Forsering-specific cached fields
                                "cached_forsering_paalopt": c.cached_forsering_paalopt,
                                "cached_forsering_maks": c.cached_forsering_maks,
                            }
                            for c in cases
                        ]
                    }
                )

        except Exception as e:
            logger.exception(f"Failed to list cases: {e}")
            return create_error_response(f"Internal error: {str(e)}", 500)

    @app.route(route="cases/{sakId}", methods=["GET"])
    def get_case(req: func.HttpRequest) -> func.HttpResponse:
        """Hent sak-data (legacy CSV repository)."""
        sak_id = req.route_params.get("sakId")

        with ServiceContext() as ctx:
            case_data = ctx.repository.get_case(sak_id)

            if not case_data:
                return create_error_response(f"Sak ikke funnet: {sak_id}", 404)

            sak = case_data.get("sak", {})
            return create_response(
                {
                    "sakId": sak_id,
                    "topicGuid": sak.get("catenda_topic_id", ""),
                    "status": sak.get("status", ""),
                    "modus": sak.get("modus", "varsel"),
                    "formData": case_data,
                }
            )

    @app.route(route="cases/{sakId}/state", methods=["GET"])
    def get_case_state(req: func.HttpRequest) -> func.HttpResponse:
        """
        Hent beregnet state for en sak (Event Sourcing).

        Returnerer projisert SakState fra alle events, samt versjonsnummer
        for optimistisk låsing ved senere oppdateringer.
        """
        from models.events import parse_event

        sak_id = req.route_params.get("sakId")

        with ServiceContext() as ctx:
            events_data, version = ctx.event_repository.get_events(sak_id)

            if not events_data:
                return create_error_response(f"Sak ikke funnet: {sak_id}", 404)

            # Parse events from stored data
            events = [parse_event(e) for e in events_data]
            state = ctx.timeline_service.compute_state(events)

            return create_response(
                {"version": version, "state": state.model_dump(mode="json")}
            )

    @app.route(route="cases/{sakId}/timeline", methods=["GET"])
    def get_case_timeline(req: func.HttpRequest) -> func.HttpResponse:
        """
        Hent full event-tidslinje for UI-visning.

        Returnerer alle events formatert for tidslinje-visning,
        med lesbare labels og sammendrag.
        """
        from models.events import parse_event

        sak_id = req.route_params.get("sakId")

        with ServiceContext() as ctx:
            events_data, version = ctx.event_repository.get_events(sak_id)

            if not events_data:
                return create_error_response(f"Sak ikke funnet: {sak_id}", 404)

            # Parse events from stored data
            events = [parse_event(e) for e in events_data]
            timeline = ctx.timeline_service.get_timeline(events)

            return create_response({"version": version, "events": timeline})

    @app.route(route="cases/{sakId}/draft", methods=["PUT"])
    def save_draft(req: func.HttpRequest) -> func.HttpResponse:
        """Lagre utkast."""
        sak_id = req.route_params.get("sakId")
        data = adapt_request(req)

        form_data = data["json"].get("formData")
        if not form_data:
            return create_error_response("Mangler formData", 400)

        with ServiceContext() as ctx:
            ctx.repository.save_form_data(sak_id, form_data)

        return create_response(
            {"success": True, "message": f"Utkast lagret for sak {sak_id}"}
        )

    @app.route(route="cases/{sakId}/pdf", methods=["POST"])
    def upload_pdf(req: func.HttpRequest) -> func.HttpResponse:
        """Last opp PDF til Catenda."""
        sak_id = req.route_params.get("sakId")
        data = adapt_request(req)
        body = data["json"]

        is_valid, error = validate_required_fields(
            body, ["pdfBase64", "filename", "topicGuid"]
        )
        if not is_valid:
            return create_error_response(error, 400)

        pdf_base64 = body["pdfBase64"]
        filename = body["filename"]
        topic_guid = body["topicGuid"]

        try:
            # Import handler fra app.py eller lag dedikert service
            import base64
            import os as os_module
            import tempfile

            with ServiceContext() as ctx:
                # Decode base64 til temp fil
                pdf_data = base64.b64decode(pdf_base64)
                with tempfile.NamedTemporaryFile(
                    delete=False, suffix=".pdf"
                ) as temp_file:
                    temp_file.write(pdf_data)
                    temp_path = temp_file.name

                try:
                    # Hent case for å få board_id
                    case_data = ctx.repository.get_case(sak_id)
                    if case_data:
                        board_id = case_data.get("sak", {}).get("catenda_board_id")
                        if board_id:
                            ctx.catenda_service.set_topic_board_id(board_id)

                    # Last opp dokument
                    doc_result = ctx.catenda_service.upload_document(
                        project_id=os.getenv("CATENDA_PROJECT_ID"),
                        file_path=temp_path,
                        filename=filename,
                    )

                    if not doc_result or "id" not in doc_result:
                        return create_error_response(
                            "Feil ved opplasting til Catenda", 500
                        )

                    # Koble dokument til topic
                    doc_guid = doc_result["id"]
                    ctx.catenda_service.create_document_reference(
                        topic_id=topic_guid, document_guid=doc_guid
                    )

                    return create_response(
                        {
                            "success": True,
                            "documentGuid": doc_guid,
                            "filename": filename,
                        }
                    )

                finally:
                    if os_module.path.exists(temp_path):
                        os_module.remove(temp_path)

        except Exception as e:
            logger.exception(f"Feil ved PDF opplasting: {e}")
            return create_error_response("Intern feil", 500)

    # =========================================================================
    # Webhook Endpoint
    # =========================================================================

    @app.route(route="webhook/catenda/{secret_path}", methods=["POST"])
    def webhook_catenda(req: func.HttpRequest) -> func.HttpResponse:
        """
        Catenda webhook endpoint.

        URL-format: /api/webhook/catenda/{SECRET_PATH}
        Secret path må matche WEBHOOK_SECRET_PATH miljøvariabel.
        """
        secret_path = req.route_params.get("secret_path")
        expected_secret = os.getenv("WEBHOOK_SECRET_PATH")

        if not expected_secret:
            logger.error("WEBHOOK_SECRET_PATH er ikke satt")
            return create_error_response("Server configuration error", 500)

        if secret_path != expected_secret:
            logger.warning("Ugyldig webhook secret path forsøk")
            return create_error_response("Not found", 404)

        from lib.security.webhook_security import (
            get_webhook_event_id,
            is_duplicate_event,
            validate_webhook_event_structure,
        )

        data = adapt_request(req)
        payload = data["json"]

        if not payload:
            return create_error_response("Invalid JSON", 400)

        # Valider event structure
        is_valid, error = validate_webhook_event_structure(payload)
        if not is_valid:
            logger.warning(f"Invalid webhook structure: {error}")
            return create_error_response(f"Invalid event structure: {error}", 400)

        # Idempotency check
        event_id = get_webhook_event_id(payload)
        if is_duplicate_event(event_id):
            logger.info(f"Duplicate webhook event ignored: {event_id}")
            return create_response({"status": "already_processed"}, 202)

        # Prosesser event
        event_obj = payload.get("event", {})
        event_type = event_obj.get("type")

        logger.info(f"Processing webhook event: {event_type} (ID: {event_id})")

        # Her kan vi kalle KOEAutomationSystem.handle_new_topic_created etc.
        # For nå returnerer vi bare success
        return create_response(
            {"status": "received", "event_type": event_type, "event_id": event_id}
        )

    # =========================================================================
    # Event Submission Endpoints
    # =========================================================================

    @app.route(route="events", methods=["POST"])
    def submit_event(req: func.HttpRequest) -> func.HttpResponse:
        """
        Submit a single event to a case.

        Request:
        {
            "event": { "event_type": "vederlag_krav_sendt", "data": {...} },
            "sak_id": "KOE-20251201-001",
            "expected_version": 3
        }
        """
        from datetime import datetime

        from models.events import parse_event, parse_event_from_request
        from repositories.event_repository import ConcurrencyError
        from services.business_rules import BusinessRuleValidator

        data = adapt_request(req)
        payload = data["json"]

        sak_id = payload.get("sak_id")
        expected_version = payload.get("expected_version")
        event_data = payload.get("event")

        if not sak_id or expected_version is None or not event_data:
            return create_error_response(
                "sak_id, expected_version, and event are required", 400
            )

        try:
            # 1. Parse event
            event_data["sak_id"] = sak_id
            event = parse_event_from_request(event_data)

            with ServiceContext() as ctx:
                # 2. Load current state
                existing_events_data, current_version = ctx.event_repository.get_events(
                    sak_id
                )

                # 3. Validate version
                if current_version != expected_version:
                    return create_response(
                        {
                            "success": False,
                            "error": "VERSION_CONFLICT",
                            "expected_version": expected_version,
                            "current_version": current_version,
                            "message": "Tilstanden har endret seg. Vennligst last inn på nytt.",
                        },
                        409,
                    )

                # 4. Validate business rules
                if existing_events_data:
                    existing_events = [parse_event(e) for e in existing_events_data]
                    current_state = ctx.timeline_service.compute_state(existing_events)

                    validator = BusinessRuleValidator()
                    validation = validator.validate(event, current_state)
                    if not validation.is_valid:
                        return create_response(
                            {
                                "success": False,
                                "error": "BUSINESS_RULE_VIOLATION",
                                "rule": validation.violated_rule,
                                "message": validation.message,
                            },
                            400,
                        )
                else:
                    existing_events = []
                    current_state = None

                # 5. Persist event
                try:
                    new_version = ctx.event_repository.append(event, expected_version)
                except ConcurrencyError as e:
                    return create_response(
                        {
                            "success": False,
                            "error": "VERSION_CONFLICT",
                            "message": str(e),
                        },
                        409,
                    )

                # 6. Compute new state
                all_events = existing_events + [event]
                new_state = ctx.timeline_service.compute_state(all_events)

                # 7. Update metadata cache
                # Handle legacy array format for underkategori
                underkategori = new_state.grunnlag.underkategori
                if isinstance(underkategori, list):
                    underkategori = underkategori[0] if underkategori else None

                ctx.metadata_repository.update_cache(
                    sak_id=sak_id,
                    cached_title=new_state.sakstittel,
                    cached_status=new_state.overordnet_status,
                    last_event_at=datetime.now(UTC),
                    # Reporting fields
                    cached_sum_krevd=new_state.vederlag.krevd_belop,
                    cached_sum_godkjent=new_state.vederlag.godkjent_belop,
                    cached_dager_krevd=new_state.frist.krevd_dager,
                    cached_dager_godkjent=new_state.frist.godkjent_dager,
                    cached_hovedkategori=new_state.grunnlag.hovedkategori,
                    cached_underkategori=underkategori,
                    # Forsering-specific cached fields
                    cached_forsering_paalopt=new_state.forsering_data.paalopte_kostnader if new_state.forsering_data else None,
                    cached_forsering_maks=new_state.forsering_data.maks_forseringskostnad if new_state.forsering_data else None,
                )

                return create_response(
                    {
                        "success": True,
                        "event_id": event.event_id,
                        "new_version": new_version,
                        "state": new_state.model_dump(mode="json"),
                    },
                    201,
                )

        except ValueError as e:
            return create_error_response(str(e), 400)
        except Exception as e:
            logger.exception(f"Failed to submit event: {e}")
            return create_error_response(f"Internal error: {str(e)}", 500)

    @app.route(route="events/batch", methods=["POST"])
    def submit_batch(req: func.HttpRequest) -> func.HttpResponse:
        """
        Submit multiple events atomically.

        Used for initial case creation where Grunnlag + Vederlag + Frist
        are submitted together.

        Request:
        {
            "sak_id": "KOE-20251201-001",
            "expected_version": 0,
            "sakstype": "standard",
            "events": [
                { "event_type": "sak_opprettet", ... },
                { "event_type": "grunnlag_opprettet", ... }
            ]
        }
        """
        from datetime import datetime

        from models.events import parse_event, parse_event_from_request
        from repositories.event_repository import ConcurrencyError
        from services.business_rules import BusinessRuleValidator
        from services.sak_creation_service import get_sak_creation_service

        data = adapt_request(req)
        payload = data["json"]

        sak_id = payload.get("sak_id")
        expected_version = payload.get("expected_version")
        event_datas = payload.get("events", [])

        if not sak_id or expected_version is None or not event_datas:
            return create_error_response(
                "sak_id, expected_version og events[] er påkrevd", 400
            )

        try:
            # 1. Parse all events
            events = []
            for ed in event_datas:
                ed["sak_id"] = sak_id
                events.append(parse_event_from_request(ed))

            with ServiceContext() as ctx:
                # 2. Load current state
                existing_events_data, current_version = ctx.event_repository.get_events(
                    sak_id
                )

                # 3. Validate version
                if current_version != expected_version:
                    return create_response(
                        {
                            "success": False,
                            "error": "VERSION_CONFLICT",
                            "expected_version": expected_version,
                            "current_version": current_version,
                            "message": "Saken har blitt oppdatert. Last inn på nytt.",
                        },
                        409,
                    )

                # 4. Validate business rules for each event
                if existing_events_data:
                    existing_events = [parse_event(e) for e in existing_events_data]
                    state = ctx.timeline_service.compute_state(existing_events)
                else:
                    existing_events = []
                    state = None

                validated_events = []
                validator = BusinessRuleValidator()

                for event in events:
                    if state:
                        validation = validator.validate(event, state)
                        if not validation.is_valid:
                            return create_response(
                                {
                                    "success": False,
                                    "error": "BUSINESS_RULE_VIOLATION",
                                    "rule": validation.violated_rule,
                                    "message": validation.message,
                                    "failed_event_type": event.event_type.value,
                                },
                                400,
                            )

                    validated_events.append(event)

                    # Update state for next validation
                    if state:
                        state = ctx.timeline_service.compute_state(
                            existing_events + validated_events
                        )
                    else:
                        state = ctx.timeline_service.compute_state(validated_events)

                # 5. Persist events
                if expected_version == 0:
                    # New case: Use SakCreationService for atomic metadata + events
                    initial_state = ctx.timeline_service.compute_state(validated_events)
                    result = get_sak_creation_service().create_sak(
                        sak_id=sak_id,
                        sakstype=payload.get("sakstype", "standard"),
                        events=validated_events,
                        prosjekt_id=payload.get("prosjekt_id"),
                        metadata_kwargs={
                            "created_by": payload.get("created_by", "unknown"),
                            "cached_title": initial_state.sakstittel,
                            "cached_status": initial_state.overordnet_status,
                        },
                    )
                    if not result.success:
                        return create_error_response(result.error, 500)
                    new_version = result.version
                else:
                    # Existing case: Use direct append_batch
                    try:
                        new_version = ctx.event_repository.append_batch(
                            validated_events, expected_version
                        )
                    except ConcurrencyError as e:
                        return create_response(
                            {
                                "success": False,
                                "error": "VERSION_CONFLICT",
                                "message": str(e),
                            },
                            409,
                        )

                # 6. Compute final state
                all_events = existing_events + validated_events
                final_state = ctx.timeline_service.compute_state(all_events)

                # 7. Update metadata cache
                # Handle legacy array format for underkategori
                underkategori = final_state.grunnlag.underkategori
                if isinstance(underkategori, list):
                    underkategori = underkategori[0] if underkategori else None

                ctx.metadata_repository.update_cache(
                    sak_id=sak_id,
                    cached_title=final_state.sakstittel,
                    cached_status=final_state.overordnet_status,
                    last_event_at=datetime.now(UTC),
                    # Reporting fields
                    cached_sum_krevd=final_state.vederlag.krevd_belop,
                    cached_sum_godkjent=final_state.vederlag.godkjent_belop,
                    cached_dager_krevd=final_state.frist.krevd_dager,
                    cached_dager_godkjent=final_state.frist.godkjent_dager,
                    cached_hovedkategori=final_state.grunnlag.hovedkategori,
                    cached_underkategori=underkategori,
                    # Forsering-specific cached fields
                    cached_forsering_paalopt=final_state.forsering_data.paalopte_kostnader if final_state.forsering_data else None,
                    cached_forsering_maks=final_state.forsering_data.maks_forseringskostnad if final_state.forsering_data else None,
                )

                return create_response(
                    {
                        "success": True,
                        "event_ids": [e.event_id for e in events],
                        "new_version": new_version,
                        "state": final_state.model_dump(mode="json"),
                    },
                    201,
                )

        except Exception as e:
            logger.exception(f"Failed to submit batch: {e}")
            return create_error_response(f"Internal error: {str(e)}", 500)

else:
    # Fallback når azure-functions ikke er installert
    logger.warning(
        "Azure Functions SDK ikke tilgjengelig. Bruk Flask-versjonen for lokal utvikling."
    )
    app = None
