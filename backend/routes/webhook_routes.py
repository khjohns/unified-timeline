"""
Webhook Routes Blueprint

Endpoints for:
- Receiving Catenda webhook events
"""
import os
import logging
from flask import Blueprint, request, jsonify

from lib.security.webhook_security import (
    validate_webhook_event_structure,
    is_duplicate_event,
    get_webhook_event_id
)
from lib.monitoring.audit import audit

logger = logging.getLogger(__name__)

# Create Blueprint
webhook_bp = Blueprint('webhook', __name__)

# Get webhook secret path from environment
WEBHOOK_SECRET_PATH = os.getenv("WEBHOOK_SECRET_PATH")
if not WEBHOOK_SECRET_PATH:
    logger.warning("⚠️  WEBHOOK_SECRET_PATH er ikke satt i .env. Webhook-endepunktet er deaktivert.")


@webhook_bp.route(f'/webhook/catenda/{WEBHOOK_SECRET_PATH}', methods=['POST'])
def webhook():
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
    # Import here to avoid circular imports
    from app import get_system

    sys = get_system()

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

    # 6. Prosesser event basert på type
    if event_type in ['issue.created', 'bcf.issue.created']:
        result = sys.handle_new_topic_created(payload)
        return jsonify(result), 200

    elif event_type in ['issue.modified', 'bcf.comment.created']:
        result = sys.handle_topic_modification(payload)
        return jsonify(result), 200

    elif event_type == 'issue.status.changed':
        result = sys.handle_topic_modification(payload)
        return jsonify(result), 200

    # Unknown event type (log men aksepter)
    logger.info(f"Unknown webhook event type: {event_type}")
    return jsonify({"status": "ignored", "event_type": event_type}), 200
