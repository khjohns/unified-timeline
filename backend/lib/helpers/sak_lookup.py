"""
Hjelpefunksjoner for å hente sak-IDer fra ulike kilder.

Disse funksjonene eliminerer duplisert kode for sak-oppslag i
endringsordre_service.py og forsering_service.py.
"""

import logging
from typing import Any, List, Optional, Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class CatendaClientProtocol(Protocol):
    """Protocol for Catenda client."""

    def list_topics(self) -> List[dict]:
        """Lister alle topics."""
        ...


@runtime_checkable
class EventRepositoryProtocol(Protocol):
    """Protocol for event repository."""

    def get_events(self, sak_id: str) -> tuple:
        """Henter events for en sak."""
        ...


@runtime_checkable
class MetadataRepositoryProtocol(Protocol):
    """Protocol for metadata repository."""

    def get_by_topic_id(self, topic_id: str) -> Any:
        """Henter metadata basert på topic ID."""
        ...


def get_all_sak_ids(
    catenda_client: Optional[CatendaClientProtocol] = None,
    event_repository: Optional[Any] = None,
    metadata_repository: Optional[MetadataRepositoryProtocol] = None,
    use_metadata_mapping: bool = False,
) -> List[str]:
    """
    Henter alle sak-IDer fra Catenda eller event repository.

    Prøver Catenda først, faller tilbake til lokal repo hvis ingen resultater.

    Args:
        catenda_client: Catenda client for å hente topics
        event_repository: Event repository som fallback
        metadata_repository: Metadata repository for topic->sak_id mapping
        use_metadata_mapping: Hvis True, mapper topic GUIDs til sak_ids via metadata.
                             Hvis False, bruker topic GUIDs direkte som sak_ids.

    Returns:
        Liste med sak-IDer

    Example:
        # Enkel variant - bruker topic GUIDs direkte
        sak_ids = get_all_sak_ids(
            catenda_client=self.client,
            event_repository=self.event_repository
        )

        # Med metadata-mapping
        sak_ids = get_all_sak_ids(
            catenda_client=self.client,
            event_repository=self.event_repository,
            metadata_repository=self.metadata_repository,
            use_metadata_mapping=True
        )
    """
    sak_ids: List[str] = []

    # Prøv Catenda først hvis tilgjengelig
    if catenda_client:
        try:
            topics = catenda_client.list_topics()

            if use_metadata_mapping and metadata_repository:
                # Map Catenda topic GUIDs til sak_ids via metadata
                for topic in topics:
                    topic_guid = topic.get('guid')
                    if not topic_guid:
                        continue
                    metadata = metadata_repository.get_by_topic_id(topic_guid)
                    if metadata:
                        sak_ids.append(metadata.sak_id)
            else:
                # Bruk topic GUIDs direkte som sak_ids
                sak_ids = [t.get('guid') for t in topics if t.get('guid')]

        except Exception as e:
            logger.warning(f"Kunne ikke hente topics fra Catenda: {e}")

    # Fallback til event repository hvis ingen saker fra Catenda
    if not sak_ids and event_repository:
        sak_ids = _get_sak_ids_from_repository(event_repository)

    return sak_ids


def _get_sak_ids_from_repository(event_repository: Any) -> List[str]:
    """
    Henter sak-IDer fra event repository.

    Støtter både JsonFileEventRepository (list_all_sak_ids) og
    SupabaseEventRepository (get_all_sak_ids).

    Args:
        event_repository: Event repository instans

    Returns:
        Liste med sak-IDer
    """
    try:
        # Prøv list_all_sak_ids (JsonFileEventRepository)
        if hasattr(event_repository, 'list_all_sak_ids'):
            sak_ids = event_repository.list_all_sak_ids()
            logger.info(f"Bruker event repository fallback, fant {len(sak_ids)} saker")
            return sak_ids

        # Eller get_all_sak_ids (SupabaseEventRepository)
        if hasattr(event_repository, 'get_all_sak_ids'):
            sak_ids = event_repository.get_all_sak_ids()
            logger.info(f"Bruker event repository fallback, fant {len(sak_ids)} saker")
            return sak_ids

    except Exception as e:
        logger.warning(f"Kunne ikke liste saker fra event repository: {e}")

    return []
