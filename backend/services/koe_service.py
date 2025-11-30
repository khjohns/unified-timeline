"""
KoeService - Business logic for KOE (change order request) operations.

This service is framework-agnostic and can be used from:
- Flask routes
- Azure Functions
- CLI tools
- Batch jobs
"""
from typing import Dict, Any, Optional
from datetime import datetime

from models.koe_revisjon import KoeRevisjon
from models.bh_svar import BHSvarRevisjon
from repositories.base_repository import BaseRepository
from utils.logger import get_logger

logger = get_logger(__name__)


class KoeService:
    """
    Service for handling KOE (change order request) business logic.

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
        Initialize KoeService.

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

    def submit_koe(
        self,
        sak_id: str,
        form_data: Dict[str, Any],
        topic_guid: Optional[str] = None,
        submitted_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a KOE (change order request) for a case.

        Business rules:
        1. Auto-populate krav submission date and signature on latest KOE revision
        2. Save KOE data to case
        3. Ensure first BH svar-revisjon exists (create template if missing)
        4. Log event to history
        5. Post comment to Catenda with claim details (if service available)

        Args:
            sak_id: Case identifier
            form_data: Complete form data including koe_revisjoner
            topic_guid: Optional Catenda topic GUID for posting comment
            submitted_by: Optional name of person submitting (defaults to sak creator)

        Returns:
            Dict with success status and next mode

        Raises:
            ValueError: If case not found or invalid data
        """
        logger.info(f"📥 Processing KOE submission for case {sak_id}")

        # 1. Validate case exists
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            logger.error(f"❌ Case not found: {sak_id}")
            raise ValueError(f"Case not found: {sak_id}")

        # 2. Auto-populate latest KOE revision metadata
        koe_revisjoner = form_data.get('koe_revisjoner', [])
        if not koe_revisjoner:
            logger.error(f"❌ No KOE revisions found for case {sak_id}")
            raise ValueError("No KOE revisions found in form data")

        siste_koe = koe_revisjoner[-1]

        # Auto-populate submission date
        siste_koe['dato_krav_sendt'] = datetime.now().strftime('%Y-%m-%d')

        # Auto-populate signature
        if submitted_by:
            siste_koe['for_entreprenor'] = submitted_by
        else:
            # Fall back to sak creator or default
            sak = form_data.get('sak', case_data.get('sak', {}))
            siste_koe['for_entreprenor'] = sak.get('opprettet_av', 'Demo User')

        logger.info(f"✅ Auto-populated KOE revision {siste_koe.get('koe_revisjonsnr', '?')}")

        # 3. Update sak metadata (status and modus)
        sak = form_data.get('sak', case_data.get('sak', {}))
        sak['status'] = '100000002'  # SAK_STATUS['VENTER_PAA_SVAR']
        sak['modus'] = 'svar'
        form_data['sak'] = sak

        # 4. Ensure first BH svar-revisjon exists
        bh_svar_revisjoner = form_data.get('bh_svar_revisjoner', [])
        if not bh_svar_revisjoner or len(bh_svar_revisjoner) == 0:
            logger.info(f"Creating initial BH svar-revisjon for case {sak_id}")
            initial_svar = BHSvarRevisjon.create_initial_response()
            form_data['bh_svar_revisjoner'] = [initial_svar.to_dict()]

        # 5. Save updated case data
        try:
            self.repo.update_case(sak_id, form_data)
            logger.info(f"✅ Case {sak_id} updated with KOE data")
        except Exception as e:
            logger.error(f"❌ Failed to save case {sak_id}: {e}")
            raise ValueError(f"Failed to save case data: {e}")

        # 6. Log to history
        if hasattr(self.repo, '_log_historikk'):
            self.repo._log_historikk(sak_id, 'koe_sendt', 'KOE sendt fra entreprenør')

        # 7. Post comment to Catenda (if service available)
        if self.catenda_service and topic_guid:
            try:
                self._post_catenda_comment(sak_id, topic_guid, siste_koe)
            except Exception as e:
                # Don't fail the whole operation if Catenda comment fails
                logger.warning(f"⚠️ Failed to post Catenda comment for {sak_id}: {e}")

        logger.info(f"🎉 KOE submission completed for case {sak_id}")

        return {
            "success": True,
            "nextMode": "svar",
            "sakId": sak_id
        }

    def _post_catenda_comment(self, sak_id: str, topic_guid: str, siste_koe: Dict[str, Any]):
        """
        Post comment to Catenda about KOE submission.

        Args:
            sak_id: Case identifier
            topic_guid: Catenda topic GUID
            siste_koe: Latest KOE revision data

        Note:
            This is a helper method that requires catenda_service and
            magic_link_generator to be configured.
        """
        if not self.catenda_service:
            logger.debug("Catenda service not configured, skipping comment")
            return

        # Extract claim details
        revisjonsnr = siste_koe.get('koe_revisjonsnr', '0')

        vederlag_info = siste_koe.get('vederlag', {})
        har_vederlag = vederlag_info.get('krav_vederlag', False)
        krevd_belop = vederlag_info.get('krav_vederlag_belop', '')

        frist_info = siste_koe.get('frist', {})
        har_frist = frist_info.get('krav_fristforlengelse', False)
        antall_dager = frist_info.get('krav_frist_antall_dager', '')

        # Build comment text
        comment_text = (
            f"📋 **Krav om endringsordre (KOE) sendt**\n\n"
            f"🔢 Revisjon: {revisjonsnr}\n"
        )

        if har_vederlag and krevd_belop:
            comment_text += f"💰 Vederlag: {krevd_belop} NOK\n"
        if har_frist and antall_dager:
            comment_text += f"📆 Fristforlengelse: {antall_dager} dager\n"

        # Generate magic link if generator available
        form_link = "N/A"
        if self.magic_link_generator and self.react_base_url:
            try:
                magic_token = self.magic_link_generator.generate(sak_id=sak_id)
                form_link = f"{self.react_base_url}?magicToken={magic_token}"
            except Exception as e:
                logger.warning(f"Failed to generate magic link: {e}")
                form_link = self.react_base_url or "N/A"

        comment_text += (
            f"\n**Neste steg:** Byggherre svarer på krav\n"
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

    def get_koe_revisjoner(self, sak_id: str) -> list:
        """
        Get all KOE revisions for a case.

        Args:
            sak_id: Case identifier

        Returns:
            List of KOE revisions

        Raises:
            ValueError: If case not found
        """
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            raise ValueError(f"Case not found: {sak_id}")

        return case_data.get('koe_revisjoner', [])

    def get_latest_koe(self, sak_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest KOE revision for a case.

        Args:
            sak_id: Case identifier

        Returns:
            Latest KOE revision or None if no revisions exist

        Raises:
            ValueError: If case not found
        """
        koe_revisjoner = self.get_koe_revisjoner(sak_id)
        if not koe_revisjoner:
            return None

        return koe_revisjoner[-1]

    def create_new_revision(
        self,
        sak_id: str,
        base_on_previous: bool = True
    ) -> Dict[str, Any]:
        """
        Create a new KOE revision for a case.

        This is used when the client partially rejects or requests changes,
        requiring the contractor to submit a new revision.

        Args:
            sak_id: Case identifier
            base_on_previous: If True, copy data from previous revision

        Returns:
            New KOE revision dict

        Raises:
            ValueError: If case not found
        """
        logger.info(f"Creating new KOE revision for case {sak_id}")

        case_data = self.repo.get_case(sak_id)
        if not case_data:
            raise ValueError(f"Case not found: {sak_id}")

        koe_revisjoner = case_data.get('koe_revisjoner', [])

        # Determine new revision number
        if koe_revisjoner:
            latest_rev_nr = int(koe_revisjoner[-1].get('koe_revisjonsnr', '0'))
            new_rev_nr = str(latest_rev_nr + 1)
        else:
            new_rev_nr = '0'

        # Create new revision
        if base_on_previous and koe_revisjoner:
            # Copy previous revision and update revision number
            new_revision = koe_revisjoner[-1].copy()
            new_revision['koe_revisjonsnr'] = new_rev_nr
            new_revision['dato_krav_sendt'] = ''  # Reset submission date
            new_revision['for_entreprenor'] = ''  # Reset signature
            new_revision['status'] = '100000001'  # KOE_STATUS['UTKAST']
        else:
            # Create fresh revision
            new_revision = KoeRevisjon.create_initial_revision()
            new_revision_dict = new_revision.to_dict()
            new_revision_dict['koe_revisjonsnr'] = new_rev_nr
            new_revision = new_revision_dict

        # Add to case data and save
        koe_revisjoner.append(new_revision)
        case_data['koe_revisjoner'] = koe_revisjoner

        try:
            self.repo.update_case(sak_id, case_data)
            logger.info(f"✅ Created KOE revision {new_rev_nr} for case {sak_id}")
        except Exception as e:
            logger.error(f"❌ Failed to save new revision: {e}")
            raise ValueError(f"Failed to save new revision: {e}")

        return new_revision
