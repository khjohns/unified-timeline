"""
SvarService - Business logic for Svar (client response) operations.

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
from core.generated_constants import (
    SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS,
    get_vederlag_svar_label, get_frist_svar_label
)
from core.status_helpers import krever_revisjon
from utils.logger import get_logger

logger = get_logger(__name__)


class SvarService:
    """
    Service for handling Svar (client response) business logic.

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
        Initialize SvarService.

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

    def submit_svar(
        self,
        sak_id: str,
        form_data: Dict[str, Any],
        topic_guid: Optional[str] = None,
        submitted_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Submit a BH svar (client response) for a case.

        Business rules:
        1. Auto-populate svar submission date and signature on latest BH svar-revisjon
        2. Check if response requires contractor to revise KOE
        3. Save svar data to case
        4. If revision required: create new KOE revision + new BH svar template
        5. Log event to history
        6. Post comment to Catenda with response details (if service available)
        7. Return appropriate next mode (koe or completed)

        Args:
            sak_id: Case identifier
            form_data: Complete form data including bh_svar_revisjoner
            topic_guid: Optional Catenda topic GUID for posting comment
            submitted_by: Optional name of person submitting (defaults to sak byggherre)

        Returns:
            Dict with success status and next mode

        Raises:
            ValueError: If case not found or invalid data
        """
        logger.info(f"📥 Processing BH svar submission for case {sak_id}")

        # 1. Validate case exists
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            logger.error(f"❌ Case not found: {sak_id}")
            raise ValueError(f"Case not found: {sak_id}")

        # 2. Auto-populate latest BH svar-revisjon metadata
        bh_svar_revisjoner = form_data.get('bh_svar_revisjoner', [])
        if not bh_svar_revisjoner:
            logger.error(f"❌ No BH svar revisions found for case {sak_id}")
            raise ValueError("No BH svar revisions found in form data")

        siste_svar = bh_svar_revisjoner[-1]

        # Ensure sign object exists
        if 'sign' not in siste_svar:
            siste_svar['sign'] = {}

        # Auto-populate submission date
        siste_svar['sign']['dato_svar_bh'] = datetime.now().strftime('%Y-%m-%d')

        # Auto-populate signature
        if submitted_by:
            siste_svar['sign']['for_byggherre'] = submitted_by
        else:
            # Fall back to sak byggherre or default
            sak = form_data.get('sak', case_data.get('sak', {}))
            siste_svar['sign']['for_byggherre'] = sak.get('byggherre', 'Demo Byggherre')

        logger.info(f"✅ Auto-populated BH svar for case {sak_id}")

        # 3. Extract response details to determine next step
        vederlag_svar = siste_svar.get('vederlag', {})
        bh_svar_vederlag = vederlag_svar.get('bh_svar_vederlag', '')

        frist_svar = siste_svar.get('frist', {})
        bh_svar_frist = frist_svar.get('bh_svar_frist', '')

        # Check if revision is required
        trenger_revisjon = krever_revisjon(bh_svar_vederlag, bh_svar_frist)
        logger.info(f"Revision required: {trenger_revisjon}")

        # 4. Save initial data
        try:
            self.repo.update_case(sak_id, form_data)
            logger.info(f"✅ Case {sak_id} updated with BH svar data")
        except Exception as e:
            logger.error(f"❌ Failed to save case {sak_id}: {e}")
            raise ValueError(f"Failed to save case data: {e}")

        # 5. If revision required, create new KOE and BH svar revisions
        next_mode = "completed"  # Default if no revision needed

        if trenger_revisjon:
            logger.info(f"Creating new revision cycle for case {sak_id}")
            self._create_revision_cycle(sak_id, form_data)
            next_mode = "koe"  # Contractor needs to submit revised KOE

        # 6. Update sak status based on outcome
        sak = form_data.get('sak', case_data.get('sak', {}))
        if trenger_revisjon:
            sak['status'] = SAK_STATUS['UNDER_AVKLARING']
            sak['modus'] = 'koe'
        else:
            # Case can be closed (requires manual closure by user)
            sak['status'] = SAK_STATUS['VURDERES_AV_TE']
            sak['modus'] = 'completed'

        form_data['sak'] = sak

        # Save updated status
        try:
            self.repo.update_case(sak_id, form_data)
        except Exception as e:
            logger.error(f"❌ Failed to update status: {e}")

        # 7. Log to history
        if hasattr(self.repo, '_log_historikk'):
            self.repo._log_historikk(sak_id, 'bh_svar', 'Byggherre har svart')

        # 8. Post comment to Catenda (if service available)
        if self.catenda_service and topic_guid:
            try:
                self._post_catenda_comment(sak_id, topic_guid, siste_svar, trenger_revisjon)
            except Exception as e:
                # Don't fail the whole operation if Catenda comment fails
                logger.warning(f"⚠️ Failed to post Catenda comment for {sak_id}: {e}")

        logger.info(f"🎉 BH svar submission completed for case {sak_id}, next mode: {next_mode}")

        return {
            "success": True,
            "nextMode": next_mode,
            "sakId": sak_id,
            "requiresRevision": trenger_revisjon
        }

    def _create_revision_cycle(self, sak_id: str, form_data: Dict[str, Any]):
        """
        Create new KOE revision and BH svar revision for next round.

        This is called when the client partially rejects or requests changes.

        Args:
            sak_id: Case identifier
            form_data: Current form data (will be mutated)
        """
        koe_revisjoner = form_data.get('koe_revisjoner', [])
        if not koe_revisjoner:
            logger.warning(f"No KOE revisions found for case {sak_id}, cannot create revision cycle")
            return

        # Determine new revision number
        siste_krav = koe_revisjoner[-1]
        nytt_revisjonsnr = str(int(siste_krav.get('koe_revisjonsnr', '0')) + 1)

        # Create new KOE revision (empty template)
        ny_krav_revisjon = KoeRevisjon.create_initial_revision()
        ny_krav_dict = ny_krav_revisjon.to_dict()
        ny_krav_dict['koe_revisjonsnr'] = nytt_revisjonsnr

        # Create new BH svar revision (empty template)
        ny_bh_svar_revisjon = BHSvarRevisjon.create_initial_response()
        ny_svar_dict = ny_bh_svar_revisjon.to_dict()

        # Append to form_data
        form_data['koe_revisjoner'].append(ny_krav_dict)
        form_data['bh_svar_revisjoner'].append(ny_svar_dict)

        # Save
        try:
            self.repo.update_case(sak_id, form_data)
            logger.info(f"✅ Created revision cycle {nytt_revisjonsnr} for case {sak_id}")
        except Exception as e:
            logger.error(f"❌ Failed to create revision cycle: {e}")
            raise ValueError(f"Failed to create revision cycle: {e}")

    def _post_catenda_comment(
        self,
        sak_id: str,
        topic_guid: str,
        siste_svar: Dict[str, Any],
        trenger_revisjon: bool
    ):
        """
        Post comment to Catenda about BH svar submission.

        Args:
            sak_id: Case identifier
            topic_guid: Catenda topic GUID
            siste_svar: Latest BH svar revision data
            trenger_revisjon: Whether revision is required

        Note:
            This is a helper method that requires catenda_service and
            magic_link_generator to be configured.
        """
        if not self.catenda_service:
            logger.debug("Catenda service not configured, skipping comment")
            return

        # Extract response details
        vederlag_svar = siste_svar.get('vederlag', {})
        bh_svar_vederlag = vederlag_svar.get('bh_svar_vederlag', '')
        godkjent_belop = vederlag_svar.get('bh_godkjent_vederlag_belop', '')

        frist_svar = siste_svar.get('frist', {})
        bh_svar_frist = frist_svar.get('bh_svar_frist', '')
        godkjente_dager = frist_svar.get('bh_godkjent_frist_dager', '')

        # Build comment text
        comment_text = "✍️ **Svar fra byggherre**\n\n**Beslutning:**\n"

        if bh_svar_vederlag:
            svar_tekst = get_vederlag_svar_label(bh_svar_vederlag)
            if godkjent_belop:
                comment_text += f"💰 Vederlag: {svar_tekst} ({godkjent_belop} NOK)\n"
            else:
                comment_text += f"💰 Vederlag: {svar_tekst}\n"

        if bh_svar_frist:
            svar_tekst = get_frist_svar_label(bh_svar_frist)
            if godkjente_dager:
                comment_text += f"📆 Frist: {svar_tekst} ({godkjente_dager} dager)\n"
            else:
                comment_text += f"📆 Frist: {svar_tekst}\n"

        # Add next step
        if trenger_revisjon:
            comment_text += f"\n**Neste steg:** Entreprenør sender revidert krav\n"
        else:
            comment_text += f"\n**Status:** Sak kan lukkes\n"

        # Generate magic link if generator available
        if self.magic_link_generator and self.react_base_url:
            try:
                magic_token = self.magic_link_generator.generate(sak_id=sak_id)
                form_link = f"{self.react_base_url}?magicToken={magic_token}"
                comment_text += f"👉 [Åpne skjema]({form_link})"
            except Exception as e:
                logger.warning(f"Failed to generate magic link: {e}")

        # Post comment
        try:
            self.catenda_service.create_comment(topic_guid, comment_text)
            logger.info(f"✅ Posted Catenda comment for case {sak_id}")
        except Exception as e:
            logger.error(f"❌ Failed to post Catenda comment: {e}")
            raise

    def get_bh_svar_revisjoner(self, sak_id: str) -> list:
        """
        Get all BH svar revisions for a case.

        Args:
            sak_id: Case identifier

        Returns:
            List of BH svar revisions

        Raises:
            ValueError: If case not found
        """
        case_data = self.repo.get_case(sak_id)
        if not case_data:
            raise ValueError(f"Case not found: {sak_id}")

        return case_data.get('bh_svar_revisjoner', [])

    def get_latest_svar(self, sak_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest BH svar revision for a case.

        Args:
            sak_id: Case identifier

        Returns:
            Latest BH svar revision or None if no revisions exist

        Raises:
            ValueError: If case not found
        """
        svar_revisjoner = self.get_bh_svar_revisjoner(sak_id)
        if not svar_revisjoner:
            return None

        return svar_revisjoner[-1]
