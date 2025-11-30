"""
VarselService - Business logic for Varsel (notification) operations.

This service is framework-agnostic and can be used from:
- Flask routes
- Azure Functions
- CLI tools
- Batch jobs
"""
from typing import Dict, Any, Optional
from datetime import datetime

from models.varsel import Varsel
from models.koe_revisjon import KoeRevisjon
from repositories.base_repository import BaseRepository
from utils.logger import get_logger

logger = get_logger(__name__)


class VarselService:
    """
    Service for handling Varsel (notification) business logic.

    This class is framework-agnostic and contains no Flask dependencies.
    All business rules and validation are encapsulated here.
    """

    def __init__(
        self,
        repository: BaseRepository,
        magic_link_generator: Optional[Any] = None,
        catenda_service: Optional[Any] = None,
        react_base_url: Optional[str] = None
    ):
        """
        Initialize VarselService.

        Args:
            repository: Data repository for case storage
            magic_link_generator: Optional magic link generator (for Catenda comments)
            catenda_service: Optional Catenda integration service
            react_base_url: Optional base URL for React app
        """
        self.repo = repository
        self.magic_link_generator = magic_link_generator
        self.catenda_service = catenda_service
        self.react_base_url = react_base_url

    def submit_varsel(
        self,
        sak_id: str,
        form_data: Dict[str, Any],
        topic_guid: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a varsel (notification) for a case.

        Business rules:
        1. Auto-populate varsel sent date if not provided
        2. Save varsel data to case
        3. Ensure first KOE revision exists (create template if missing)
        4. Log event to history
        5. Post comment to Catenda (if service available)

        Args:
            sak_id: Case identifier
            form_data: Complete form data including varsel
            topic_guid: Optional Catenda topic GUID for posting comment

        Returns:
            Dict with success status and next mode

        Raises:
            ValueError: If case not found or invalid data
        """
        logger.info(f"📥 Processing varsel submission for case {sak_id}")

        # 1. Validate case exists
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            logger.error(f"❌ Case not found: {sak_id}")
            raise ValueError(f"Case not found: {sak_id}")

        # 2. Process and validate varsel data
        try:
            varsel = Varsel.from_form_data(form_data, auto_populate_sent_date=True)
            logger.info(f"✅ Varsel validated for case {sak_id}")
        except Exception as e:
            logger.error(f"❌ Varsel validation failed: {e}")
            raise ValueError(f"Invalid varsel data: {e}")

        # 3. Update form_data with validated varsel
        form_data['varsel'] = varsel.to_dict()

        # 4. Update sak metadata (status and modus)
        sak = form_data.get('sak', case_data.get('sak', {}))
        sak['status'] = '100000001'  # SAK_STATUS['VARSLET']
        sak['modus'] = 'koe'
        form_data['sak'] = sak

        # 5. Ensure first KOE revision exists
        koe_revisjoner = form_data.get('koe_revisjoner', [])
        if not koe_revisjoner or len(koe_revisjoner) == 0:
            logger.info(f"Creating initial KOE revision for case {sak_id}")
            initial_revision = KoeRevisjon.create_initial_revision()
            form_data['koe_revisjoner'] = [initial_revision.to_dict()]

        # 6. Save updated case data
        try:
            self.repo.update_case(sak_id, form_data)
            logger.info(f"✅ Case {sak_id} updated with varsel data")
        except Exception as e:
            logger.error(f"❌ Failed to save case {sak_id}: {e}")
            raise ValueError(f"Failed to save case data: {e}")

        # 7. Log to history (via repository helper if available)
        if hasattr(self.repo, '_log_historikk'):
            self.repo._log_historikk(sak_id, 'varsel_sendt', 'Varsel sendt fra entreprenør')

        # 8. Post comment to Catenda (if service available)
        if self.catenda_service and topic_guid:
            try:
                self._post_catenda_comment(sak_id, topic_guid)
            except Exception as e:
                # Don't fail the whole operation if Catenda comment fails
                logger.warning(f"⚠️ Failed to post Catenda comment for {sak_id}: {e}")

        logger.info(f"🎉 Varsel submission completed for case {sak_id}")

        return {
            "success": True,
            "nextMode": "koe",
            "sakId": sak_id
        }

    def _post_catenda_comment(self, sak_id: str, topic_guid: str):
        """
        Post comment to Catenda about varsel submission.

        Args:
            sak_id: Case identifier
            topic_guid: Catenda topic GUID

        Note:
            This is a helper method that requires catenda_service and
            magic_link_generator to be configured.
        """
        if not self.catenda_service:
            logger.debug("Catenda service not configured, skipping comment")
            return

        # Generate magic link if generator available
        form_link = "N/A"
        if self.magic_link_generator and self.react_base_url:
            try:
                magic_token = self.magic_link_generator.generate(sak_id=sak_id)
                form_link = f"{self.react_base_url}?magicToken={magic_token}"
            except Exception as e:
                logger.warning(f"Failed to generate magic link: {e}")
                form_link = self.react_base_url or "N/A"

        # Build comment text
        comment_text = (
            f"**Varsel for krav om endringsordre (KOE) er sendt**\n\n"
            f"🔢 Sak-ID: `{sak_id}`\n\n"
            f"**Neste steg:** Entreprenør skal nå fylle ut krav\n"
            f"👉 [Åpne skjema]({form_link})\n\n"
            f"📎 PDF-vedlegg tilgjengelig under dokumenter"
        )

        # Post comment
        try:
            self.catenda_service.create_comment(topic_guid, comment_text)
            logger.info(f"✅ Posted Catenda comment for case {sak_id}")
        except Exception as e:
            logger.error(f"❌ Failed to post Catenda comment: {e}")
            raise

    def get_varsel(self, sak_id: str) -> Optional[Dict[str, Any]]:
        """
        Get varsel data for a case.

        Args:
            sak_id: Case identifier

        Returns:
            Varsel data dict or None if not found

        Raises:
            ValueError: If case not found
        """
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            raise ValueError(f"Case not found: {sak_id}")

        return case_data.get('varsel')

    def validate_varsel_data(self, form_data: Dict[str, Any]) -> bool:
        """
        Validate varsel data without submitting.

        Args:
            form_data: Form data to validate

        Returns:
            True if valid

        Raises:
            ValueError: If validation fails with details
        """
        try:
            Varsel.from_form_data(form_data, auto_populate_sent_date=False)
            return True
        except Exception as e:
            raise ValueError(f"Varsel validation failed: {e}")
