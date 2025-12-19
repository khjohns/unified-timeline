"""
BaseSakService - Base class for container-saker (forsering, endringsordre).

Inneholder felles funksjonalitet for:
- Resolving av Catenda topic IDs
- Henting av relaterte saker
- Delegering til RelatedCasesService
"""
from typing import Dict, List, Optional, Any

from utils.logger import get_logger
from models.sak_state import SakRelasjon, SakState
from models.events import AnyEvent, parse_event
from services.related_cases_service import RelatedCasesService

logger = get_logger(__name__)


class BaseSakService:
    """
    Base service for container-saker (forsering, endringsordre).

    Disse sakstyper samler flere KOE-saker og trenger felles funksjonalitet
    for å håndtere relasjoner og hente kontekst fra relaterte saker.
    """

    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None
    ):
        """
        Initialiser BaseSakService.

        Args:
            catenda_client: CatendaClient instance (eller mock)
            event_repository: EventRepository for å hente events fra saker
            timeline_service: TimelineService for å beregne SakState
        """
        self.client = catenda_client
        self.event_repository = event_repository
        self.timeline_service = timeline_service

        # Gjenbrukbar helper for relaterte saker
        self.related_cases = RelatedCasesService(
            event_repository=event_repository,
            timeline_service=timeline_service
        )

    def _log_init_warnings(self, service_name: str) -> None:
        """Logger advarsler om manglende dependencies."""
        if not self.client:
            logger.warning(f"{service_name} initialized without Catenda client")
        if not self.event_repository:
            logger.warning(f"{service_name} initialized without event repository")
        if not self.timeline_service:
            logger.warning(f"{service_name} initialized without timeline service")

    def _resolve_catenda_topic_id(self, sak_id: str) -> Optional[str]:
        """
        Slår opp catenda_topic_id fra sakens state.

        Args:
            sak_id: Lokal sak-ID (f.eks. SAK-20251218-201548)

        Returns:
            Catenda topic GUID, eller None hvis ikke funnet
        """
        if not self.timeline_service or not self.event_repository:
            logger.warning("Mangler timeline_service eller event_repository")
            return None

        try:
            events_data, _version = self.event_repository.get_events(sak_id)
            if not events_data:
                return None

            # Parse events from stored data (dicts -> typed Event objects)
            events = [parse_event(e) for e in events_data]
            state = self.timeline_service.compute_state(events)
            return state.catenda_topic_id
        except Exception as e:
            logger.warning(f"Kunne ikke slå opp catenda_topic_id for {sak_id}: {e}")
            return None

    def hent_relaterte_saker(self, sak_id: str) -> List[SakRelasjon]:
        """
        Henter alle relaterte saker for en gitt sak.

        Args:
            sak_id: Sak-ID (lokal ID eller Catenda topic GUID)

        Returns:
            Liste med SakRelasjon objekter
        """
        if not self.client:
            logger.warning("Ingen Catenda client - returnerer tom liste")
            return []

        # Resolve sak_id to catenda_topic_id if needed
        catenda_topic_id = self._resolve_catenda_topic_id(sak_id)
        if not catenda_topic_id:
            # Fallback: assume sak_id is already a Catenda GUID
            catenda_topic_id = sak_id
            logger.debug(f"Bruker sak_id direkte som catenda_topic_id: {sak_id}")
        else:
            logger.debug(f"Resolved {sak_id} -> catenda_topic_id: {catenda_topic_id}")

        related = self.client.list_related_topics(catenda_topic_id)

        relasjoner = []
        for rel in related:
            relatert_guid = rel.get('related_topic_guid')
            if not relatert_guid:
                continue

            topic = self.client.get_topic_details(relatert_guid)

            # Try to resolve Catenda GUID to local sak_id
            local_sak_id = None
            if self.event_repository:
                local_sak_id = self.event_repository.find_sak_id_by_catenda_topic(relatert_guid)
                if local_sak_id:
                    logger.debug(f"Resolved Catenda GUID {relatert_guid} -> local sak_id {local_sak_id}")

            relasjoner.append(SakRelasjon(
                relatert_sak_id=local_sak_id or relatert_guid,  # Prefer local sak_id
                relatert_sak_tittel=topic.get('title') if topic else None,
                bimsync_issue_board_ref=rel.get('bimsync_issue_board_ref'),
                bimsync_issue_number=rel.get('bimsync_issue_number'),
                catenda_topic_id=relatert_guid,  # Keep original GUID for reference
            ))

        logger.info(f"Hentet {len(relasjoner)} relaterte saker for {sak_id}")
        return relasjoner

    def _create_topic_with_relations(
        self,
        title: str,
        description: str,
        topic_type: str,
        related_sak_ids: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        Oppretter topic i Catenda med toveis-relasjoner.

        Args:
            title: Tittel på topic
            description: Beskrivelse
            topic_type: Type topic (f.eks. "Forsering", "Endringsordre")
            related_sak_ids: Liste med sak-IDs å opprette relasjoner til

        Returns:
            Topic-dict fra Catenda, eller None hvis opprettelse feilet

        Raises:
            RuntimeError: Hvis opprettelse feiler
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke opprette topic")
            return None

        topic = self.client.create_topic(
            title=title,
            description=description,
            topic_type=topic_type,
            topic_status="Open"
        )

        if not topic:
            raise RuntimeError("Kunne ikke opprette topic i Catenda")

        # Opprett toveis-relasjoner
        if related_sak_ids:
            # Container → Relaterte (containersaken peker på relaterte saker)
            self.client.create_topic_relations(
                topic_id=topic['guid'],
                related_topic_guids=related_sak_ids
            )
            # Relaterte → Container (hver relatert sak peker tilbake)
            for sak_id in related_sak_ids:
                self.client.create_topic_relations(
                    topic_id=sak_id,
                    related_topic_guids=[topic['guid']]
                )

        logger.info(f"✅ {topic_type} opprettet: {topic['guid']}")
        return topic

    def hent_hendelser_fra_relaterte_saker(
        self,
        sak_ids: List[str],
        spor_filter: Optional[List[str]] = None
    ) -> Dict[str, List[AnyEvent]]:
        """
        Henter alle hendelser fra en liste med saker.
        Delegerer til RelatedCasesService.
        """
        return self.related_cases.hent_hendelser_fra_saker(sak_ids, spor_filter)

    def hent_state_fra_relaterte_saker(
        self,
        sak_ids: List[str]
    ) -> Dict[str, SakState]:
        """
        Henter SakState for en liste med saker.
        Delegerer til RelatedCasesService.
        """
        return self.related_cases.hent_state_fra_saker(sak_ids)

    def is_configured(self) -> bool:
        """
        Sjekker om servicen er konfigurert med en Catenda client.

        Returns:
            True hvis client er tilgjengelig
        """
        return self.client is not None

    def legg_til_relatert_sak(self, container_sak_id: str, relatert_sak_id: str) -> bool:
        """
        Legger til en sak som relatert til containersaken (toveis-relasjon).

        Args:
            container_sak_id: ID for containersaken (forsering/endringsordre)
            relatert_sak_id: ID for saken som skal legges til

        Returns:
            True hvis vellykket

        Raises:
            RuntimeError: Hvis Catenda-operasjon feiler
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke legge til relasjon")
            return False

        try:
            # Toveis-relasjon: Container → Relatert
            self.client.create_topic_relations(
                topic_id=container_sak_id,
                related_topic_guids=[relatert_sak_id]
            )
            # Toveis-relasjon: Relatert → Container
            self.client.create_topic_relations(
                topic_id=relatert_sak_id,
                related_topic_guids=[container_sak_id]
            )
            logger.info(f"✅ Sak {relatert_sak_id} lagt til {container_sak_id} (toveis)")
            return True
        except Exception as e:
            logger.error(f"Feil ved tillegging av relatert sak: {e}")
            raise RuntimeError(f"Kunne ikke legge til relatert sak: {e}")

    def fjern_relatert_sak(self, container_sak_id: str, relatert_sak_id: str) -> bool:
        """
        Fjerner en sak fra containersaken (toveis-relasjon).

        Args:
            container_sak_id: ID for containersaken (forsering/endringsordre)
            relatert_sak_id: ID for saken som skal fjernes

        Returns:
            True hvis vellykket

        Raises:
            RuntimeError: Hvis Catenda-operasjon feiler
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke fjerne relasjon")
            return False

        try:
            # Fjern toveis-relasjon: Container → Relatert
            self.client.delete_topic_relation(
                topic_id=container_sak_id,
                related_topic_id=relatert_sak_id
            )
            # Fjern toveis-relasjon: Relatert → Container
            self.client.delete_topic_relation(
                topic_id=relatert_sak_id,
                related_topic_id=container_sak_id
            )
            logger.info(f"✅ Sak {relatert_sak_id} fjernet fra {container_sak_id} (toveis)")
            return True
        except Exception as e:
            logger.error(f"Feil ved fjerning av relatert sak: {e}")
            raise RuntimeError(f"Kunne ikke fjerne relatert sak: {e}")
