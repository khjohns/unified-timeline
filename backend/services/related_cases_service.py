"""
RelatedCasesService - Gjenbrukbar helper for container-saker.

Brukes av både ForseringService og EndringsordreService for å hente
state og hendelser fra relaterte saker.

Container-saker (forsering, endringsordre) samler flere KOE-saker
og trenger å vise kontekst fra disse.
"""
from typing import Dict, List, Optional, Any, Tuple

from utils.logger import get_logger
from models.sak_state import SakState
from models.events import AnyEvent, parse_event

logger = get_logger(__name__)


class RelatedCasesService:
    """
    Gjenbrukbar service for å hente kontekst fra relaterte saker.

    Brukes av container-saker (forsering, endringsordre) som samler
    flere KOE-saker og trenger tilgang til deres state og hendelser.
    """

    def __init__(
        self,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None
    ):
        """
        Initialiser RelatedCasesService.

        Args:
            event_repository: EventRepository for å hente events fra saker
            timeline_service: TimelineService for å beregne SakState
        """
        self.event_repository = event_repository
        self.timeline_service = timeline_service

        if not self.event_repository:
            logger.warning("RelatedCasesService initialized without event repository")
        if not self.timeline_service:
            logger.warning("RelatedCasesService initialized without timeline service")

    def get_related_cases_context(
        self,
        related_sak_ids: List[str],
        spor_filter: Optional[List[str]] = None
    ) -> Tuple[Dict[str, SakState], Dict[str, List[AnyEvent]]]:
        """
        Henter state og hendelser for alle relaterte saker.

        Gjenbrukbar for både Forsering og Endringsordre.

        Args:
            related_sak_ids: Liste med sak-IDs å hente kontekst for
            spor_filter: Valgfritt filter for hendelser (f.eks. ['grunnlag', 'frist'])

        Returns:
            Tuple med:
            - sak_states: Dict[sak_id, SakState]
            - hendelser: Dict[sak_id, List[Event]]
        """
        sak_states = self.hent_state_fra_saker(related_sak_ids)
        hendelser = self.hent_hendelser_fra_saker(related_sak_ids, spor_filter)

        return sak_states, hendelser

    def hent_hendelser_fra_saker(
        self,
        sak_ids: List[str],
        spor_filter: Optional[List[str]] = None
    ) -> Dict[str, List[AnyEvent]]:
        """
        Henter alle hendelser fra en liste med saker.

        Args:
            sak_ids: Liste med sak-IDs å hente hendelser fra
            spor_filter: Valgfritt filter for spor (f.eks. ['grunnlag', 'frist'])

        Returns:
            Dict med sak_id -> liste av parsed events (AnyEvent objekter)
        """
        if not self.event_repository:
            logger.warning("Ingen event repository - kan ikke hente hendelser")
            return {}

        result: Dict[str, List[AnyEvent]] = {}

        for sak_id in sak_ids:
            try:
                events_data, _version = self.event_repository.get_events(sak_id)

                # Parse events from stored data (dicts -> typed Event objects)
                events = [parse_event(e) for e in events_data] if events_data else []

                # Filtrer på spor hvis angitt
                if spor_filter:
                    events = [e for e in events if getattr(e, 'spor', None) in spor_filter]

                result[sak_id] = events
                logger.debug(f"Hentet {len(events)} hendelser fra sak {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved henting av hendelser fra sak {sak_id}: {e}")
                result[sak_id] = []

        total_events = sum(len(events) for events in result.values())
        logger.info(f"Hentet totalt {total_events} hendelser fra {len(sak_ids)} saker")
        return result

    def hent_state_fra_saker(
        self,
        sak_ids: List[str]
    ) -> Dict[str, SakState]:
        """
        Henter SakState for en liste med saker.

        Args:
            sak_ids: Liste med sak-IDs

        Returns:
            Dict med sak_id -> SakState
        """
        if not self.event_repository or not self.timeline_service:
            logger.warning("Mangler repository eller timeline service")
            return {}

        result: Dict[str, SakState] = {}

        for sak_id in sak_ids:
            try:
                events_data, _version = self.event_repository.get_events(sak_id)
                if events_data:
                    # Parse events from stored data (dicts -> typed Event objects)
                    events = [parse_event(e) for e in events_data]
                    state = self.timeline_service.compute_state(events)
                    result[sak_id] = state
                    logger.debug(f"Beregnet state for sak {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved beregning av state for sak {sak_id}: {e}")

        logger.info(f"Hentet state fra {len(result)} av {len(sak_ids)} saker")
        return result

    def hent_egne_hendelser(self, sak_id: str) -> List[AnyEvent]:
        """
        Henter hendelser for en enkelt sak (container-sakens egne hendelser).

        Args:
            sak_id: Sak-ID

        Returns:
            Liste med parsed events (AnyEvent objekter)
        """
        if not self.event_repository:
            logger.warning("Ingen event repository")
            return []

        try:
            events_data, _version = self.event_repository.get_events(sak_id)
            if events_data:
                # Parse events from stored data (dicts -> typed Event objects)
                return [parse_event(e) for e in events_data]
            return []
        except Exception as e:
            logger.error(f"Feil ved henting av hendelser for sak {sak_id}: {e}")
            return []
