"""
WebhookService - Business logic for Catenda webhook operations.

This service is framework-agnostic and can be used from:
- Flask routes
- Azure Functions
- CLI tools
- Testing

Extracted from KOEAutomationSystem (app.py) as part of backend refactoring.
"""
import os
import base64
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional
from threading import Thread

from repositories.base_repository import BaseRepository
from core.generated_constants import SAK_STATUS
from utils.logger import get_logger

logger = get_logger(__name__)


class WebhookService:
    """
    Service for handling Catenda webhook events.

    This class is framework-agnostic and contains no Flask dependencies.
    All webhook business rules and integration logic are encapsulated here.
    """

    def __init__(
        self,
        repository: BaseRepository,
        catenda_client: Any,
        config: Optional[Dict[str, Any]] = None,
        magic_link_generator: Optional[Any] = None
    ):
        """
        Initialize WebhookService.

        Args:
            repository: Data repository for case storage
            catenda_client: Authenticated Catenda API client
            config: Optional configuration dict (project_id, library_id, etc.)
            magic_link_generator: Optional magic link generator for URLs
        """
        self.repo = repository
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
        Håndterer ny topic.
        Oppretter sak, henter metadata, og poster lenke til React-app.

        Business rules:
        1. Validate topic passes filters (should_process_topic)
        2. Extract topic_id and board_id from webhook payload
        3. Fetch full topic details from Catenda API
        4. Extract metadata (title, author, custom fields)
        5. Create new case in repository
        6. Generate magic link for React app
        7. Post comment to Catenda topic (async)

        Args:
            webhook_payload: Webhook event payload from Catenda

        Returns:
            Dict with success status and sak_id or error details
        """
        try:
            # Import filtering config (local to avoid circular deps)
            from utils.filtering_config import should_process_topic

            # Extract topic data from webhook payload
            temp_topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            board_id = webhook_payload.get('project_id') or temp_topic_data.get('boardId') or temp_topic_data.get('topic_board_id')

            # Check if topic passes filters
            filter_data = temp_topic_data.copy()
            filter_data['board_id'] = board_id
            filter_data['type'] = temp_topic_data.get('topic_type') or temp_topic_data.get('type')

            should_proc, reason = should_process_topic(filter_data)
            if not should_proc:
                logger.info(f"⏭️  Ignorerer topic (årsak: {reason})")
                return {'success': True, 'action': 'ignored_due_to_filter', 'reason': reason}

            # Extract topic ID
            topic_id = temp_topic_data.get('id') or temp_topic_data.get('guid') or webhook_payload.get('guid')

            if not topic_id or not board_id:
                logger.error(f"Webhook mangler 'topic_id' eller 'board_id'. Payload: {webhook_payload}")
                return {'success': False, 'error': 'Mangler topic_id eller board_id i webhook'}

            # Fetch full topic details from Catenda API
            self.catenda.topic_board_id = board_id
            topic_data = self.catenda.get_topic_details(topic_id)

            if not topic_data:
                logger.error(f"Klarte ikke å hente topic-detaljer for ID {topic_id} fra Catenda API.")
                return {'success': False, 'error': f'Kunne ikke hente topic-detaljer for {topic_id}'}

            # Extract metadata
            title = topic_data.get('title', 'Uten tittel')

            byggherre = 'Ikke spesifisert'
            leverandor = 'Ikke spesifisert'
            saksstatus = SAK_STATUS['UNDER_VARSLING']
            project_name = 'Ukjent prosjekt'
            v2_project_id = None

            # Get project details
            board_details = self.catenda.get_topic_board_details()
            if board_details:
                v2_project_id = board_details.get('bimsync_project_id')
                if v2_project_id:
                    project_details = self.catenda.get_project_details(v2_project_id)
                    if project_details:
                        project_name = project_details.get('name', project_name)

            # Extract custom fields (Byggherre, Leverandør, Saksstatus)
            custom_fields = topic_data.get('bimsync_custom_fields', [])
            for field in custom_fields:
                field_name = field.get('customFieldName')
                field_value = field.get('value')
                if field_name == 'Byggherre' and field_value:
                    byggherre = field_value
                elif field_name == 'Leverandør' and field_value:
                    leverandor = field_value
                elif field_name == 'Saksstatus KOE' and field_value:
                    saksstatus = field_value

            # Extract author
            author_name = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('name', topic_data.get('creation_author', 'Ukjent'))

            # Create case data
            sak_data = {
                'catenda_topic_id': topic_id,
                'catenda_project_id': v2_project_id,
                'catenda_board_id': board_id,
                'sakstittel': title,
                'te_navn': author_name,
                'status': saksstatus,
                'byggherre': byggherre,
                'entreprenor': leverandor,
                'prosjekt_navn': project_name,
            }
            sak_id = self.repo.create_case(sak_data)

            # Generate magic link
            author_email = topic_data.get('bimsync_creation_author', {}).get('user', {}).get('email')
            magic_token = None
            if self.magic_link_generator:
                magic_token = self.magic_link_generator.generate(sak_id=sak_id, email=author_email)

            base_url = self.get_react_app_base_url()
            magic_link = f"{base_url}?magicToken={magic_token}" if magic_token else base_url

            # Post comment to Catenda (async to avoid blocking)
            dato = datetime.now().strftime('%Y-%m-%d')
            comment_text = (
                f"✅ **Ny KOE-sak opprettet**\n\n"
                f"📋 Intern Sak-ID: `{sak_id}`\n"
                f"📅 Dato: {dato}\n"
                f"🏗️ Prosjekt: {project_name}\n\n"
                f"**Neste steg:** Entreprenør sender varsel\n"
                f"👉 [Åpne skjema]({magic_link})"
            )

            def post_comment_async():
                try:
                    self.catenda.create_comment(topic_id, comment_text)
                    logger.info(f"✅ Kommentar sendt til Catenda for sak {sak_id}")
                except Exception as e:
                    logger.error(f"❌ Feil ved posting av kommentar til Catenda: {e}")

            Thread(target=post_comment_async, daemon=True).start()
            logger.info(f"✅ Sak {sak_id} opprettet, kommentar sendes i bakgrunnen.")

            return {'success': True, 'sak_id': sak_id}

        except Exception as e:
            logger.exception(f"Feil i handle_new_topic_created: {e}")
            return {'success': False, 'error': str(e)}

    def handle_topic_modification(self, webhook_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Håndterer endringer på topic (statusendring eller kommentar).

        Business rules:
        1. Extract topic_id from webhook payload
        2. Find existing case by topic_id
        3. If case not found, ignore (not our case)
        4. Detect status changes or relevant comments
        5. Update case status if changed (Godkjent, Avslått, Lukket)
        6. Log to history

        Args:
            webhook_payload: Webhook event payload from Catenda

        Returns:
            Dict with success status and action taken
        """
        try:
            # Extract topic data
            topic_data = webhook_payload.get('issue', {}) or webhook_payload.get('topic', {})
            topic_id = topic_data.get('id') or topic_data.get('guid')

            # Find existing case
            sak = self.repo.get_case_by_topic_id(topic_id)
            if not sak:
                return {'success': True, 'action': 'ignored_unknown_topic'}

            sak_id = sak['sak_id']

            # Extract modification data
            modification_data = webhook_payload.get('modification', {})
            comment_data = webhook_payload.get('comment', {})

            new_status = None

            # Check for status updates
            if modification_data.get('event') == 'status_updated':
                new_status_val = modification_data.get('value', '').lower()
                logger.info(f"Status endret til: {new_status_val}")

                if 'lukket' in new_status_val or 'closed' in new_status_val:
                    new_status = 'Lukket'
                elif 'godkjent' in new_status_val:
                    new_status = 'Godkjent'

            # Check for relevant comments
            elif 'comment' in comment_data:
                comment_text = comment_data.get('comment', '').lower()
                if 'godkjent' in comment_text:
                    new_status = 'Godkjent'
                elif 'avslått' in comment_text or 'avvist' in comment_text:
                    new_status = 'Avslått'

            # Update case if status changed
            if new_status:
                self.repo.update_case_status(sak_id, new_status)

                # Log to history (via repository helper if available)
                if hasattr(self.repo, 'log_historikk'):
                    self.repo.log_historikk(sak_id, 'catenda_oppdatering', f"Status oppdatert til {new_status} via Catenda")

                logger.info(f"✅ Sak {sak_id} oppdatert til {new_status} basert på Catenda-hendelse.")
                return {'success': True, 'action': 'updated', 'status': new_status}

            return {'success': True, 'action': 'no_change'}

        except Exception as e:
            logger.exception(f"Feil i handle_topic_modification: {e}")
            return {'success': False, 'error': str(e)}

    def handle_pdf_upload(self, sak_id: str, pdf_base64: str, filename: str, topic_guid: str) -> Dict[str, Any]:
        """
        Tar imot Base64 PDF, laster opp til Catenda og kobler til topic.

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

            logger.info(f"PDF lagret midlertidig: {temp_path}")

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
                raise Exception("Feil ved opplasting av dokument til Catenda")

            compact_doc_guid = doc_result['id']
            logger.info(f"PDF lastet opp til Catenda. Kompakt GUID: {compact_doc_guid}")

            # Format GUID (add dashes if compact format)
            if len(compact_doc_guid) == 32:
                formatted_doc_guid = (
                    f"{compact_doc_guid[:8]}-{compact_doc_guid[8:12]}-"
                    f"{compact_doc_guid[12:16]}-{compact_doc_guid[16:20]}-{compact_doc_guid[20:]}"
                )
            else:
                formatted_doc_guid = compact_doc_guid

            # Get board ID from case data
            sak_info = self.repo.get_case(sak_id)
            if sak_info and 'sak' in sak_info and sak_info['sak'].get('catenda_board_id'):
                self.catenda.topic_board_id = sak_info['sak']['catenda_board_id']
                logger.info(f"Bruker lagret board ID: {self.catenda.topic_board_id}")
            elif not self.catenda.topic_board_id:
                logger.warning("Fant ikke board ID i sak, prøver default...")
                self.catenda.select_topic_board(0)

            # Try to create document reference with formatted GUID
            ref_result = self.catenda.create_document_reference(topic_guid, formatted_doc_guid)

            if ref_result:
                logger.info(f"PDF koblet til topic {topic_guid}")
                return {'success': True, 'documentGuid': formatted_doc_guid, 'filename': filename}
            else:
                # Try compact GUID as fallback
                logger.warning(f"Kunne ikke koble med formatert GUID. Prøver kompakt GUID: {compact_doc_guid}")
                ref_result_compact = self.catenda.create_document_reference(topic_guid, compact_doc_guid)
                if ref_result_compact:
                    logger.info(f"PDF koblet til topic {topic_guid} med kompakt GUID.")
                    return {'success': True, 'documentGuid': compact_doc_guid, 'filename': filename}
                else:
                    return {'success': False, 'error': 'Kunne ikke koble dokument til topic (begge GUID-formater feilet)'}

        except Exception as e:
            logger.exception(f"Feil ved PDF-håndtering: {e}")
            return {'success': False, 'error': str(e)}
        finally:
            # Clean up temporary file
            if temp_path and os.path.exists(temp_path):
                os.remove(temp_path)
