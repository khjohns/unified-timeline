"""
WebhookService - Event Sourcing compatible webhook handler.

Handles Catenda webhook events by generating appropriate domain events
instead of directly manipulating state.

Architecture:
- Uses EventRepository instead of CSVRepository
- Generates domain events (SakOpprettetEvent) instead of documents
- State is computed from events, not stored directly
"""
import os
import base64
import tempfile
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from threading import Thread

from repositories.event_repository import JsonFileEventRepository
from repositories import create_metadata_repository
from models.events import SakOpprettetEvent
from models.sak_state import SakState
from models.sak_metadata import SakMetadata
from services.timeline_service import TimelineService
from services.catenda_comment_generator import CatendaCommentGenerator
from utils.logger import get_logger

logger = get_logger(__name__)


class WebhookService:
    """
    Service for handling Catenda webhook events (Event Sourcing Architecture).

    This service is framework-agnostic and generates domain events
    instead of directly modifying state.
    """

    def __init__(
        self,
        event_repository: JsonFileEventRepository,
        catenda_client: Any,
        config: Optional[Dict[str, Any]] = None,
        magic_link_generator: Optional[Any] = None
    ):
        """
        Initialize WebhookService.

        Args:
            event_repository: Event store for persisting events
            catenda_client: Authenticated Catenda API client
            config: Optional configuration dict (project_id, library_id, etc.)
            magic_link_generator: Optional magic link generator for URLs
        """
        self.event_repo = event_repository
        self.metadata_repo = create_metadata_repository()
        self.timeline_service = TimelineService()
        self.catenda = catenda_client
        self.config = config or {}
        self.magic_link_generator = magic_link_generator

    def get_react_app_base_url(self) -> str:
        """
        Determines the correct base URL for the React application.

        Priority:
        1. DEV_REACT_APP_URL from config
        2. REACT_APP_URL from config
        3. Fallback to localhost

        Returns:
            Base URL for React app (e.g., "http://localhost:3000")
        """
        from core.config import settings

        if settings.dev_react_app_url:
            return settings.dev_react_app_url
        if settings.react_app_url:
            return settings.react_app_url
        if 'react_app_url' in self.config and self.config['react_app_url']:
            return self.config['react_app_url']

        # Fallback to localhost
        return "http://localhost:3000"

    def handle_new_topic_created(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles new Catenda topic by creating a SakOpprettetEvent.

        Event Sourcing Flow:
        1. Validate topic passes filters
        2. Extract metadata from Catenda
        3. Generate SakOpprettetEvent
        4. Persist event to event store
        5. Create metadata cache entry
        6. Generate magic link
        7. Post comment to Catenda (async)

        Args:
            webhook_payload: Webhook event payload from Catenda

        Returns:
            Dict with success status and sak_id or error details
        """
        try:
            # Import filtering config (local to avoid circular deps)
            from utils.filtering_config import (
                should_process_topic,
                get_sakstype_from_topic_type,
                get_frontend_route
            )

            # Extract basic data from webhook payload
            temp_topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            board_id = webhook_payload.get('project_id') or temp_topic_data.get('boardId') or temp_topic_data.get('topic_board_id')
            topic_id = temp_topic_data.get('id') or temp_topic_data.get('guid') or webhook_payload.get('guid')

            if not topic_id or not board_id:
                logger.error(f"Webhook missing 'topic_id' or 'board_id'. Payload: {webhook_payload}")
                return {'success': False, 'error': 'Missing topic_id or board_id in webhook'}

            # Fetch full topic details from Catenda API FIRST
            # (webhook payload often doesn't include topic_type)
            self.catenda.topic_board_id = board_id
            topic_data = self.catenda.get_topic_details(topic_id)

            if not topic_data:
                logger.error(f"Failed to fetch topic details for ID {topic_id} from Catenda API.")
                return {'success': False, 'error': f'Could not fetch topic details for {topic_id}'}

            # Now check filters with ACTUAL topic data (includes topic_type)
            filter_data = {
                'board_id': board_id,
                'topic_type': topic_data.get('topic_type'),
                'type': topic_data.get('topic_type'),  # Alias for filtering
                'title': topic_data.get('title'),
            }

            should_proc, reason = should_process_topic(filter_data)
            if not should_proc:
                logger.info(f"⏭️  Ignoring topic (reason: {reason})")
                return {'success': True, 'action': 'ignored_due_to_filter', 'reason': reason}

            # Extract metadata
            title = topic_data.get('title', 'Untitled')
            topic_type = topic_data.get('topic_type', '')

            # Determine sakstype from topic_type
            sakstype = get_sakstype_from_topic_type(topic_type)
            logger.info(f"📋 Topic type: '{topic_type}' -> Sakstype: '{sakstype}'")

            byggherre = 'Not specified'
            leverandor = 'Not specified'
            project_name = 'Unknown project'
            v2_project_id = None

            # Get project details
            board_details = self.catenda.get_topic_board_details()
            if board_details:
                v2_project_id = board_details.get('bimsync_project_id')
                if v2_project_id:
                    project_details = self.catenda.get_project_details(v2_project_id)
                    if project_details:
                        project_name = project_details.get('name', project_name)

            # Extract custom fields (Byggherre, Leverandør)
            custom_fields = topic_data.get('bimsync_custom_fields', [])
            for field in custom_fields:
                field_name = field.get('customFieldName')
                field_value = field.get('value')
                if field_name == 'Byggherre' and field_value:
                    byggherre = field_value
                elif field_name == 'Leverandør' and field_value:
                    leverandor = field_value

            # Extract author
            author_name = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('name', topic_data.get('creation_author', 'Unknown'))
            author_email = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('email')

            # Generate sak_id (timestamp-based)
            timestamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
            sak_id = f"SAK-{timestamp}"

            # Create SakOpprettetEvent (Event Sourcing)
            event = SakOpprettetEvent(
                sak_id=sak_id,
                sakstittel=title,
                aktor=author_name,
                aktor_rolle="TE",  # Assume TE created the case
                prosjekt_id=v2_project_id or "unknown",
                catenda_topic_id=topic_id,
                sakstype=sakstype,
            )

            # Persist event (version 0 = new case)
            try:
                new_version = self.event_repo.append(event, expected_version=0)
                logger.info(f"✅ SakOpprettetEvent persisted for {sak_id}, version: {new_version}")
            except Exception as e:
                logger.error(f"❌ Failed to persist SakOpprettetEvent: {e}")
                return {'success': False, 'error': f'Failed to persist event: {e}'}

            # Create metadata cache entry
            metadata = SakMetadata(
                sak_id=sak_id,
                prosjekt_id=v2_project_id,
                catenda_topic_id=topic_id,
                catenda_board_id=board_id,
                catenda_project_id=v2_project_id,
                created_at=datetime.now(timezone.utc),
                created_by=author_name,
                cached_title=title,
                cached_status="UNDER_VARSLING",  # Initial status
            )
            self.metadata_repo.create(metadata)

            # Generate magic link with correct route based on sakstype
            magic_token = None
            if self.magic_link_generator:
                magic_token = self.magic_link_generator.generate(sak_id=sak_id, email=author_email)

            base_url = self.get_react_app_base_url()
            frontend_route = get_frontend_route(sakstype, sak_id)
            magic_link = f"{base_url}{frontend_route}?magicToken={magic_token}" if magic_token else f"{base_url}{frontend_route}"

            # Post comment to Catenda (async to avoid blocking)
            comment_generator = CatendaCommentGenerator()
            comment_text = comment_generator.generate_creation_comment(
                sak_id=sak_id,
                sakstype=sakstype,
                project_name=project_name,
                magic_link=magic_link
            )

            def post_comment_async():
                try:
                    self.catenda.create_comment(topic_id, comment_text)
                    logger.info(f"✅ Comment posted to Catenda for case {sak_id}")
                except Exception as e:
                    logger.error(f"❌ Error posting comment to Catenda: {e}")

            # TODO: Azure Service Bus - Replace with queue for production
            # Background threads are unreliable in Azure Functions (may be killed after HTTP response)
            Thread(target=post_comment_async, daemon=True).start()
            logger.info(f"✅ Case {sak_id} created, comment being posted in background.")

            return {'success': True, 'sak_id': sak_id}

        except Exception as e:
            logger.exception(f"Error in handle_new_topic_created: {e}")
            return {'success': False, 'error': str(e)}

    def handle_topic_modification(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Handles changes to Catenda topic.

        Note: In Event Sourcing architecture, external status changes from Catenda
        are NOT directly synced to our event log. Status is derived from events
        submitted by TE/BH through our API.

        This handler only logs the change for audit purposes and updates metadata cache.

        Args:
            webhook_payload: Webhook event payload from Catenda

        Returns:
            Dict with success status and action taken
        """
        try:
            # Extract topic data
            topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            topic_id = topic_data.get('id') or topic_data.get('guid')

            # Find existing case by topic_id
            metadata = self.metadata_repo.get_by_topic_id(topic_id)
            if not metadata:
                logger.info(f"Topic {topic_id} not found in our system, ignoring modification")
                return {'success': True, 'action': 'ignored_unknown_topic'}

            sak_id = metadata.sak_id

            # Extract modification data
            modification_data = webhook_payload.get('modification', {})
            comment_data = webhook_payload.get('comment', {})

            # Log the modification for audit purposes
            modification_type = None

            # Check for status updates
            if modification_data.get('event') == 'status_updated':
                new_status_val = modification_data.get('value', '')
                logger.info(f"📝 Catenda status changed for {sak_id}: {new_status_val}")
                modification_type = f"catenda_status_changed: {new_status_val}"

            # Check for comments
            elif 'comment' in comment_data:
                comment_text = comment_data.get('comment', '')
                logger.info(f"💬 New Catenda comment on {sak_id}: {comment_text[:100]}...")
                modification_type = "catenda_comment_added"

            # Note: We do NOT create events from Catenda status changes
            # State is only changed through our API (TE/BH submissions)

            if modification_type:
                # Could log to audit trail or history if needed
                logger.info(f"ℹ️ Case {sak_id}: {modification_type} (not syncing to event log)")
                return {'success': True, 'action': 'logged', 'modification': modification_type}

            return {'success': True, 'action': 'no_action_needed'}

        except Exception as e:
            logger.exception(f"Error in handle_topic_modification: {e}")
            return {'success': False, 'error': str(e)}

    def handle_pdf_upload(self, sak_id: str, pdf_base64: str, filename: str, topic_guid: str) -> Dict[str, Any]:
        """
        Receives Base64 PDF, uploads to Catenda and links to topic.

        Note: This method is compatible with both old and new architecture.
        It only handles Catenda document upload, not state management.

        Business rules:
        1. Decode base64 PDF data
        2. Save to temporary file
        3. Upload to Catenda library
        4. Get document GUID
        5. Link document to topic
        6. Try both formatted and compact GUID formats
        7. Clean up temporary file

        Args:
            sak_id: Case identifier (for logging and board ID lookup)
            pdf_base64: Base64-encoded PDF data
            filename: Original filename
            topic_guid: Catenda topic GUID to link document to

        Returns:
            Dict with success status, documentGuid, and filename or error details
        """
        temp_path = None
        try:
            # Decode base64 PDF
            pdf_data = base64.b64decode(pdf_base64)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                temp_file.write(pdf_data)
                temp_path = temp_file.name

            logger.info(f"PDF saved temporarily: {temp_path}")

            # Get project and library IDs from config
            project_id = self.config.get('catenda_project_id')
            library_id = self.config.get('catenda_library_id')

            # Set library ID or auto-select
            if library_id:
                self.catenda.library_id = library_id
            else:
                self.catenda.select_library(project_id)

            # Upload document to Catenda
            doc_result = self.catenda.upload_document(project_id, temp_path, filename)

            if not doc_result or 'id' not in doc_result:
                raise Exception("Error uploading document to Catenda")

            compact_doc_guid = doc_result['id']
            logger.info(f"PDF uploaded to Catenda. Compact GUID: {compact_doc_guid}")

            # Format GUID (add dashes if compact format)
            if len(compact_doc_guid) == 32:
                formatted_doc_guid = (
                    f"{compact_doc_guid[:8]}-{compact_doc_guid[8:12]}-"
                    f"{compact_doc_guid[12:16]}-{compact_doc_guid[16:20]}-{compact_doc_guid[20:]}"
                )
            else:
                formatted_doc_guid = compact_doc_guid

            # Get board ID from metadata
            metadata = self.metadata_repo.get(sak_id)
            if metadata and metadata.catenda_board_id:
                self.catenda.topic_board_id = metadata.catenda_board_id
                logger.info(f"Using stored board ID: {self.catenda.topic_board_id}")
            elif not self.catenda.topic_board_id:
                logger.warning("Board ID not found in metadata, trying default...")
                self.catenda.select_topic_board(0)

            # Try to create document reference with formatted GUID
            ref_result = self.catenda.create_document_reference(topic_guid, formatted_doc_guid)

            if ref_result:
                logger.info(f"PDF linked to topic {topic_guid}")
                return {'success': True, 'documentGuid': formatted_doc_guid, 'filename': filename}
            else:
                # Try compact GUID as fallback
                logger.warning(f"Could not link with formatted GUID. Trying compact GUID: {compact_doc_guid}")
                ref_result_compact = self.catenda.create_document_reference(topic_guid, compact_doc_guid)
                if ref_result_compact:
                    logger.info(f"PDF linked to topic {topic_guid} with compact GUID.")
                    return {'success': True, 'documentGuid': compact_doc_guid, 'filename': filename}
                else:
                    return {'success': False, 'error': 'Could not link document to topic (both GUID formats failed)'}

        except Exception as e:
            logger.exception(f"Error handling PDF: {e}")
            return {'success': False, 'error': str(e)}
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
