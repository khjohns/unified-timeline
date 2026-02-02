"""
CatendaSyncService - Gjenbrukbar service for synkronisering av events til Catenda.

Håndterer posting av kommentarer og oppdatering av status for alle sakstyper.
Designet for å kunne utvides med PDF-støtte i fremtiden.
"""

from dataclasses import dataclass
from typing import Any

from core.config import settings
from lib.auth import get_magic_link_manager
from lib.catenda_factory import get_catenda_client
from models.events import AnyEvent
from models.sak_state import SakState
from services.catenda_comment_generator import CatendaCommentGenerator
from services.catenda_service import CatendaService
from utils.filtering_config import get_frontend_route
from utils.logger import get_logger

logger = get_logger(__name__)


@dataclass
class CatendaSyncResult:
    """Resultat fra Catenda-synkronisering."""

    success: bool
    comment_posted: bool
    status_updated: bool
    pdf_uploaded: bool = False
    pdf_source: str | None = None  # 'client', 'server', eller None
    error: str | None = None
    skipped_reason: str | None = None  # 'no_topic_id', 'not_authenticated', 'no_client'


class CatendaSyncService:
    """
    Service for å synkronisere events til Catenda.

    Gjenbrukbar service som kan brukes av alle routes som trenger
    å poste kommentarer og oppdatere status i Catenda.

    Designet for fremtidig PDF-støtte.
    """

    def __init__(
        self,
        catenda_service: CatendaService | None = None,
        comment_generator: CatendaCommentGenerator | None = None,
        magic_link_manager: Any | None = None,
    ):
        """
        Initialiser CatendaSyncService.

        Args:
            catenda_service: CatendaService-instans (opprettes automatisk hvis None)
            comment_generator: CatendaCommentGenerator-instans (opprettes automatisk hvis None)
            magic_link_manager: MagicLinkManager-instans (opprettes automatisk hvis None)
        """
        self._catenda_service = catenda_service
        self._comment_generator = comment_generator or CatendaCommentGenerator()
        self._magic_link_manager = magic_link_manager

    def _get_catenda_service(self) -> CatendaService | None:
        """Lazy-load CatendaService."""
        if self._catenda_service is None:
            client = get_catenda_client()
            if client:
                self._catenda_service = CatendaService(client)
        return self._catenda_service

    def _get_magic_link_manager(self) -> Any:
        """Lazy-load MagicLinkManager."""
        if self._magic_link_manager is None:
            self._magic_link_manager = get_magic_link_manager()
        return self._magic_link_manager

    def sync_event_to_catenda(
        self,
        sak_id: str,
        state: SakState,
        event: AnyEvent,
        topic_id: str,
        old_status: str | None = None,
        # Reservert for fremtidig PDF-støtte
        pdf_base64: str | None = None,
        _pdf_filename: str | None = None,
        _generate_pdf_on_server: bool = False,
    ) -> CatendaSyncResult:
        """
        Synkroniser et event til Catenda.

        Poster kommentar og oppdaterer status. PDF-parametrene er
        reservert for fremtidig bruk.

        Args:
            sak_id: Sak-ID
            state: Nåværende SakState etter event
            event: Eventet som skal synkroniseres
            topic_id: Catenda topic GUID
            old_status: Gammel overordnet_status (for å detektere endring)
            pdf_base64: (Fremtidig) Base64-kodet PDF fra klient
            pdf_filename: (Fremtidig) Filnavn for PDF
            generate_pdf_on_server: (Fremtidig) Om server skal generere PDF

        Returns:
            CatendaSyncResult med status for hver operasjon
        """
        catenda_service = self._get_catenda_service()

        if not catenda_service or not catenda_service.is_configured():
            logger.warning(f"Catenda not configured, skipping sync for {sak_id}")
            return CatendaSyncResult(
                success=False,
                comment_posted=False,
                status_updated=False,
                skipped_reason="no_client",
            )

        comment_posted = False
        status_updated = False
        error = None

        try:
            # 1. Post kommentar
            comment_posted = self._post_comment(
                catenda_service, sak_id, state, event, topic_id
            )

            # 2. Oppdater status hvis endret
            if old_status is not None and old_status != state.overordnet_status:
                status_updated = self._update_status(
                    catenda_service, topic_id, state.overordnet_status
                )

            # 3. (Fremtidig) PDF-håndtering
            # TODO: Implementer PDF-upload når det blir nødvendig for forsering

            success = comment_posted  # Minimum: kommentar postet
            logger.info(
                f"Catenda sync for {sak_id}: comment={comment_posted}, status={status_updated}"
            )

        except Exception as e:
            logger.error(f"Error syncing to Catenda for {sak_id}: {e}")
            error = str(e)
            success = False

        return CatendaSyncResult(
            success=success,
            comment_posted=comment_posted,
            status_updated=status_updated,
            error=error,
        )

    def _post_comment(
        self,
        catenda_service: CatendaService,
        sak_id: str,
        state: SakState,
        event: AnyEvent,
        topic_id: str,
    ) -> bool:
        """Post kommentar til Catenda topic."""
        try:
            # Generer magic link
            magic_link = self._generate_magic_link(sak_id, state)

            # Generer kommentartekst
            comment_text = self._comment_generator.generate_comment(
                state, event, magic_link
            )

            # Post til Catenda
            result = catenda_service.create_comment(topic_id, comment_text)
            return result is not None

        except Exception as e:
            logger.error(f"Failed to post comment for {sak_id}: {e}")
            return False

    def _update_status(
        self, catenda_service: CatendaService, topic_id: str, new_status: str
    ) -> bool:
        """Oppdater topic status i Catenda."""
        try:
            result = catenda_service.update_topic_status(topic_id, new_status)
            return result is not None

        except Exception as e:
            logger.error(f"Failed to update status for topic {topic_id}: {e}")
            return False

    def _generate_magic_link(self, sak_id: str, state: SakState) -> str | None:
        """Generer magic link for saken."""
        try:
            magic_link_manager = self._get_magic_link_manager()
            if not magic_link_manager:
                return None

            magic_token = magic_link_manager.generate(sak_id=sak_id)
            base_url = settings.dev_react_app_url or settings.react_app_url

            if not base_url:
                return None

            # Bestem frontend-rute basert på sakstype
            sakstype = getattr(state, "sakstype", "standard") or "standard"
            frontend_route = get_frontend_route(sakstype, sak_id)

            return f"{base_url}{frontend_route}?magicToken={magic_token}"

        except Exception as e:
            logger.error(f"Failed to generate magic link for {sak_id}: {e}")
            return None


def get_catenda_sync_service() -> CatendaSyncService:
    """Factory function for CatendaSyncService."""
    return CatendaSyncService()
