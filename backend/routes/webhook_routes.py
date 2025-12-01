"""
Webhook Routes Blueprint

Endpoints for:
- Receiving Catenda webhook events

Uses WebhookService for business logic (framework-agnostic).
"""
import os
import logging
from flask import Blueprint, request, jsonify

from lib.security.webhook_security import (
    validate_webhook_event_structure,
    is_duplicate_event,
    get_webhook_event_id
)
from lib.security.rate_limiter import limit_webhook
from lib.monitoring.audit import audit
from services.webhook_service import WebhookService
from repositories.csv_repository import CSVRepository
from integrations.catenda import CatendaClient
from core.config import settings

logger = logging.getLogger(__name__)

# Create Blueprint
webhook_bp = Blueprint('webhook', __name__)

# Get webhook secret path from environment
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")
if not WEBHOOK_SECRET_PATH:
    logger.warning("⚠️  WEBHOOK_SECRET_PATH er ikke satt i .env. Webhook-endepunktet er deaktivert.")
    # Bruk en placeholder-path som alltid returnerer 404 for sikkerhet
    WEBHOOK_SECRET_PATH = "__disabled__"


def get_webhook_service() -> WebhookService:
    """
    Get or create WebhookService instance.

    Uses dependency injection to provide:
    - CSVRepository for data access
    - CatendaClient for Catenda API integration
    - Config from settings
    - MagicLinkManager for generating links

    Returns:
        Configured WebhookService instance
    """
    # Import here to avoid circular dependencies
    from app import get_magic_link_manager
    magic_link_mgr = get_magic_link_manager()

    # Get config from settings
    config = settings.get_catenda_config()

    # Create repository
    repository = CSVRepository(config.get('data_dir', 'koe_data'))

    # Create and authenticate Catenda client
    catenda_client = CatendaClient(
        client_id=config['catenda_client_id'],
        client_secret=config.get('catenda_client_secret')
    )

    # Try to authenticate
    access_token = config.get('catenda_access_token')
    if access_token:
        catenda_client.set_access_token(access_token)
    elif config.get('catenda_client_secret'):
        catenda_client.authenticate()

    # Create and return service
    return WebhookService(
        repository=repository,
        catenda_client=catenda_client,
        config=config,
        magic_link_generator=magic_link_mgr
    )


@webhook_bp.route(f'/webhook/catenda/<secret_path>', methods=['POST'])
@limit_webhook  # Rate limiting (100/min default)
def webhook(secret_path):
    """
    Webhook endpoint for Catenda events.

    This endpoint receives webhooks from Catenda when:
    - New topic/issue is created
    - Topic is modified (status change, comment added, etc.)

    Security:
    - Secret path in URL (security through obscurity)
    - Idempotency Check (forhindrer duplikat-prosessering)
    - Event Structure Validation

    Supported Event Types:
    - issue.created / bcf.issue.created: New topic created
    - issue.modified: Topic modified (e.g., status change)
    - bcf.comment.created: New comment added
    - issue.status.changed: Status changed

    Returns:
        JSON with processing result:
        - {"status": "created", ...} for new topic
        - {"status": "updated", ...} for modification
        - {"status": "ignored"} for unknown event types
        - {"status": "already_processed"} for duplicate events
    """
    # 0. Valider secret path
    expected_secret = os.getenv("WEBHOOK_SECRET_PATH")
    if not expected_secret or secret_path != expected_secret:
        logger.warning(f"Ugyldig webhook path forsøk: /{secret_path[:8]}...")
        return jsonify({"error": "Not found"}), 404

    # Get webhook service instance (dependency injection)
    webhook_service = get_webhook_service()

    # 1. Parse payload
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400

    # 2. Valider event structure
    valid_structure, structure_error = validate_webhook_event_structure(payload)
    if not valid_structure:
        logger.warning(f"Invalid webhook structure: {structure_error}")
        return jsonify({"error": "Invalid event structure", "detail": structure_error}), 400

    # 3. Idempotency check (forhindre duplikat-prosessering)
    event_id = get_webhook_event_id(payload)
    if is_duplicate_event(event_id):
        logger.info(f"Duplicate webhook event ignored: {event_id}")
        return jsonify({"status": "already_processed"}), 202

    # 4. Hent event type
    event_obj = payload.get('event', {})
    event_type = event_obj.get('type')

    # 5. Log webhook mottatt
    audit.log_webhook_received(event_type=event_type, event_id=event_id)
    logger.info(f"✅ Processing webhook event: {event_type} (ID: {event_id})")

    # 6. Prosesser event basert på type (using WebhookService)
    if event_type in ['issue.created', 'bcf.issue.created']:
        result = webhook_service.handle_new_topic_created(payload)
        return jsonify(result), 200

    elif event_type in ['issue.modified', 'bcf.comment.created']:
        result = webhook_service.handle_topic_modification(payload)
        return jsonify(result), 200

    elif event_type == 'issue.status.changed':
        result = webhook_service.handle_topic_modification(payload)
        return jsonify(result), 200

    # Unknown event type (log men aksepter)
    logger.info(f"Unknown webhook event type: {event_type}")
    return jsonify({"status": "ignored", "event_type": event_type}), 200
