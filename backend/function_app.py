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
        adapt_request,
        create_response,
        create_error_response,
        ServiceContext,
        validate_required_fields
    )

    app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

    # =========================================================================
    # Health & Utility Endpoints
    # =========================================================================

    @app.route(route="health", methods=["GET"])
    def health(req: func.HttpRequest) -> func.HttpResponse:
        """Health check endpoint."""
        return create_response({
            "status": "healthy",
            "service": "KOE Automation System",
            "version": "1.0.0"
        })

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
        token = data['json'].get('token')

        if not token:
            return create_error_response("Mangler token", 400)

        mgr = MagicLinkManager()
        is_valid, error, payload = mgr.verify(token)

        if not is_valid:
            return create_error_response(error or "Ugyldig token", 401)

        return create_response({
            "success": True,
            "sakId": payload.get('sak_id'),
            "email": payload.get('email')
        })

    # =========================================================================
    # Case Management Endpoints
    # =========================================================================

    @app.route(route="cases/{sakId}", methods=["GET"])
    def get_case(req: func.HttpRequest) -> func.HttpResponse:
        """Hent sak-data."""
        sak_id = req.route_params.get('sakId')

        with ServiceContext() as ctx:
            case_data = ctx.repository.get_case(sak_id)

            if not case_data:
                return create_error_response(f"Sak ikke funnet: {sak_id}", 404)

            sak = case_data.get('sak', {})
            return create_response({
                "sakId": sak_id,
                "topicGuid": sak.get('catenda_topic_id', ''),
                "status": sak.get('status', ''),
                "modus": sak.get('modus', 'varsel'),
                "formData": case_data
            })

    @app.route(route="cases/{sakId}/draft", methods=["PUT"])
    def save_draft(req: func.HttpRequest) -> func.HttpResponse:
        """Lagre utkast."""
        sak_id = req.route_params.get('sakId')
        data = adapt_request(req)

        form_data = data['json'].get('formData')
        if not form_data:
            return create_error_response("Mangler formData", 400)

        with ServiceContext() as ctx:
            ctx.repository.save_form_data(sak_id, form_data)

        return create_response({
            "success": True,
            "message": f"Utkast lagret for sak {sak_id}"
        })

    # =========================================================================
    # Workflow Endpoints
    # =========================================================================

    @app.route(route="varsel-submit", methods=["POST"])
    def submit_varsel(req: func.HttpRequest) -> func.HttpResponse:
        """Send varsel."""
        data = adapt_request(req)
        body = data['json']

        is_valid, error = validate_required_fields(body, ['sakId', 'formData'])
        if not is_valid:
            return create_error_response(error, 400)

        sak_id = body['sakId']
        form_data = body['formData']
        topic_guid = body.get('topicGuid')

        try:
            with ServiceContext() as ctx:
                result = ctx.varsel_service.submit_varsel(
                    sak_id=sak_id,
                    form_data=form_data,
                    topic_guid=topic_guid
                )
                return create_response({
                    "success": True,
                    "nextMode": "koe",
                    **result
                })
        except ValueError as e:
            return create_error_response(str(e), 400)
        except Exception as e:
            logger.exception(f"Feil ved varsel submit: {e}")
            return create_error_response("Intern feil", 500)

    @app.route(route="koe-submit", methods=["POST"])
    def submit_koe(req: func.HttpRequest) -> func.HttpResponse:
        """Send KOE."""
        data = adapt_request(req)
        body = data['json']

        is_valid, error = validate_required_fields(body, ['sakId', 'formData'])
        if not is_valid:
            return create_error_response(error, 400)

        sak_id = body['sakId']
        form_data = body['formData']
        topic_guid = body.get('topicGuid')
        user_signature = body.get('userSignature')

        try:
            with ServiceContext() as ctx:
                result = ctx.koe_service.submit_koe(
                    sak_id=sak_id,
                    form_data=form_data,
                    topic_guid=topic_guid,
                    user_signature=user_signature
                )
                return create_response({
                    "success": True,
                    "nextMode": "svar",
                    **result
                })
        except ValueError as e:
            return create_error_response(str(e), 400)
        except Exception as e:
            logger.exception(f"Feil ved KOE submit: {e}")
            return create_error_response("Intern feil", 500)

    @app.route(route="svar-submit", methods=["POST"])
    def submit_svar(req: func.HttpRequest) -> func.HttpResponse:
        """Send BH svar."""
        data = adapt_request(req)
        body = data['json']

        is_valid, error = validate_required_fields(body, ['sakId', 'formData'])
        if not is_valid:
            return create_error_response(error, 400)

        sak_id = body['sakId']
        form_data = body['formData']
        topic_guid = body.get('topicGuid')
        user_signature = body.get('userSignature')

        try:
            with ServiceContext() as ctx:
                result = ctx.svar_service.submit_svar(
                    sak_id=sak_id,
                    form_data=form_data,
                    topic_guid=topic_guid,
                    user_signature=user_signature
                )
                return create_response({
                    "success": True,
                    "nextMode": result.get('next_mode', 'lukket'),
                    **result
                })
        except ValueError as e:
            return create_error_response(str(e), 400)
        except Exception as e:
            logger.exception(f"Feil ved svar submit: {e}")
            return create_error_response("Intern feil", 500)

    @app.route(route="cases/{sakId}/pdf", methods=["POST"])
    def upload_pdf(req: func.HttpRequest) -> func.HttpResponse:
        """Last opp PDF til Catenda."""
        sak_id = req.route_params.get('sakId')
        data = adapt_request(req)
        body = data['json']

        is_valid, error = validate_required_fields(body, ['pdfBase64', 'filename', 'topicGuid'])
        if not is_valid:
            return create_error_response(error, 400)

        pdf_base64 = body['pdfBase64']
        filename = body['filename']
        topic_guid = body['topicGuid']

        try:
            # Import handler fra app.py eller lag dedikert service
            import base64
            import tempfile
            import os as os_module

            with ServiceContext() as ctx:
                # Decode base64 til temp fil
                pdf_data = base64.b64decode(pdf_base64)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                    temp_file.write(pdf_data)
                    temp_path = temp_file.name

                try:
                    # Hent case for å få board_id
                    case_data = ctx.repository.get_case(sak_id)
                    if case_data:
                        board_id = case_data.get('sak', {}).get('catenda_board_id')
                        if board_id:
                            ctx.catenda_service.set_topic_board_id(board_id)

                    # Last opp dokument
                    doc_result = ctx.catenda_service.upload_document(
                        project_id=os.getenv('CATENDA_PROJECT_ID'),
                        file_path=temp_path,
                        filename=filename
                    )

                    if not doc_result or 'id' not in doc_result:
                        return create_error_response("Feil ved opplasting til Catenda", 500)

                    # Koble dokument til topic
                    doc_guid = doc_result['id']
                    ctx.catenda_service.create_document_reference(
                        topic_id=topic_guid,
                        document_guid=doc_guid
                    )

                    return create_response({
                        "success": True,
                        "documentGuid": doc_guid,
                        "filename": filename
                    })

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
        secret_path = req.route_params.get('secret_path')
        expected_secret = os.getenv('WEBHOOK_SECRET_PATH')

        if not expected_secret:
            logger.error("WEBHOOK_SECRET_PATH er ikke satt")
            return create_error_response("Server configuration error", 500)

        if secret_path != expected_secret:
            logger.warning(f"Ugyldig webhook secret path forsøk")
            return create_error_response("Not found", 404)

        from lib.security.webhook_security import (
            validate_webhook_event_structure,
            is_duplicate_event,
            get_webhook_event_id
        )

        data = adapt_request(req)
        payload = data['json']

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
        event_obj = payload.get('event', {})
        event_type = event_obj.get('type')

        logger.info(f"Processing webhook event: {event_type} (ID: {event_id})")

        # Her kan vi kalle KOEAutomationSystem.handle_new_topic_created etc.
        # For nå returnerer vi bare success
        return create_response({
            "status": "received",
            "event_type": event_type,
            "event_id": event_id
        })

else:
    # Fallback når azure-functions ikke er installert
    logger.warning("Azure Functions SDK ikke tilgjengelig. Bruk Flask-versjonen for lokal utvikling.")
    app = None
