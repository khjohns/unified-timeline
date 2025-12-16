"""
ForseringService - Håndterer forseringssaker (§ 33.8).

Når BH avslår et berettiget krav om fristforlengelse, kan TE varsle om
at de vil iverksette forsering. Forseringskostnader kan kreves dekket
innenfor 30%-grensen (dagmulkt + 30%).

Denne servicen håndterer opprettelse av forseringssaker som egne saker
med relasjoner til de avslåtte fristforlengelsessakene.
"""
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

from utils.logger import get_logger
from models.sak_state import (
    SaksType,
    SakRelasjon,
    ForseringData,
    SakState,
)
from models.events import AnyEvent

logger = get_logger(__name__)


class ForseringService:
    """
    Service for å håndtere forseringssaker (§ 33.8).

    Forseringssaker opprettes som egne Catenda topics med relasjoner
    til de avslåtte fristforlengelsessakene de er basert på.
    """

    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None
    ):
        """
        Initialiser ForseringService.

        Args:
            catenda_client: CatendaClient instance (eller mock)
            event_repository: EventRepository for å hente events fra saker
            timeline_service: TimelineService for å beregne SakState
        """
        self.client = catenda_client
        self.event_repository = event_repository
        self.timeline_service = timeline_service

        if not self.client:
            logger.warning("ForseringService initialized without Catenda client")
        if not self.event_repository:
            logger.warning("ForseringService initialized without event repository")
        if not self.timeline_service:
            logger.warning("ForseringService initialized without timeline service")

    def opprett_forseringssak(
        self,
        avslatte_sak_ids: List[str],
        estimert_kostnad: float,
        dagmulktsats: float,
        begrunnelse: str,
        avslatte_dager: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Oppretter en ny forseringssak med relasjoner til avslåtte fristforlengelsessaker.

        Args:
            avslatte_sak_ids: Liste med sak-IDs til avslåtte fristforlengelser
            estimert_kostnad: TE's estimerte forseringskostnad
            dagmulktsats: Dagmulktsats fra kontrakten (NOK/dag)
            begrunnelse: TE's begrunnelse for forsering
            avslatte_dager: Sum av avslåtte dager (optional, kan hentes fra saker)

        Returns:
            Dict med den opprettede forseringssaken

        Raises:
            ValueError: Hvis estimert kostnad overstiger 30%-grensen
            RuntimeError: Hvis opprettelse i Catenda feiler
        """
        if not avslatte_sak_ids:
            raise ValueError("Må ha minst én avslått fristforlengelsessak")

        # Beregn avslåtte dager hvis ikke oppgitt
        if avslatte_dager is None:
            avslatte_dager = self._beregn_avslatte_dager(avslatte_sak_ids)

        # Beregn maks forseringskostnad (§ 33.8)
        maks_kostnad = avslatte_dager * dagmulktsats * 1.3

        # Valider 30%-regelen
        if estimert_kostnad > maks_kostnad:
            raise ValueError(
                f"Estimert kostnad ({estimert_kostnad:,.0f} NOK) overstiger "
                f"dagmulkt + 30% ({maks_kostnad:,.0f} NOK)"
            )

        logger.info(
            f"Oppretter forseringssak basert på {len(avslatte_sak_ids)} avslåtte saker, "
            f"estimert kostnad: {estimert_kostnad:,.0f} NOK"
        )

        # Opprett topic i Catenda
        topic = None
        if self.client:
            titler = ", ".join([f"SAK-{id[:8]}" for id in avslatte_sak_ids])
            # NB: "Forsering" må legges til som topic_type i Catenda først
            topic = self.client.create_topic(
                title=f"Forsering § 33.8 - {titler}",
                description=begrunnelse,
                topic_type="Forsering",
                topic_status="Open"
            )

            if not topic:
                raise RuntimeError("Kunne ikke opprette topic i Catenda")

            # Opprett relasjoner til avslåtte saker
            self.client.create_topic_relations(
                topic_id=topic['guid'],
                related_topic_guids=avslatte_sak_ids
            )
            logger.info(f"✅ Forseringssak opprettet: {topic['guid']}")
        else:
            logger.warning("Ingen Catenda client - returnerer mock-data")

        # Bygg forsering data
        sak_id = topic['guid'] if topic else f"mock-{datetime.now().timestamp()}"

        return {
            "sak_id": sak_id,
            "sakstype": SaksType.FORSERING.value,
            "relaterte_saker": [
                {"relatert_sak_id": id}
                for id in avslatte_sak_ids
            ],
            "forsering_data": {
                "avslatte_fristkrav": avslatte_sak_ids,
                "dato_varslet": datetime.now().isoformat(),
                "estimert_kostnad": estimert_kostnad,
                "bekreft_30_prosent_regel": True,
                "avslatte_dager": avslatte_dager,
                "dagmulktsats": dagmulktsats,
                "maks_forseringskostnad": maks_kostnad,
                "er_iverksatt": False,
                "er_stoppet": False,
                "kostnad_innenfor_grense": estimert_kostnad <= maks_kostnad
            }
        }

    def hent_relaterte_saker(self, sak_id: str) -> List[SakRelasjon]:
        """
        Henter alle relaterte saker for en gitt sak.

        Args:
            sak_id: Catenda topic GUID

        Returns:
            Liste med SakRelasjon objekter
        """
        if not self.client:
            logger.warning("Ingen Catenda client - returnerer tom liste")
            return []

        related = self.client.list_related_topics(sak_id)

        relasjoner = []
        for rel in related:
            # Hent tittel fra relatert sak
            relatert_guid = rel.get('related_topic_guid')
            if not relatert_guid:
                continue

            topic = self.client.get_topic_details(relatert_guid)

            relasjoner.append(SakRelasjon(
                relatert_sak_id=relatert_guid,
                relatert_sak_tittel=topic.get('title') if topic else None,
                bimsync_issue_board_ref=rel.get('bimsync_issue_board_ref'),
                bimsync_issue_number=rel.get('bimsync_issue_number')
            ))

        logger.info(f"Hentet {len(relasjoner)} relaterte saker for {sak_id}")
        return relasjoner

    def hent_hendelser_fra_relaterte_saker(
        self,
        sak_ids: List[str],
        spor_filter: Optional[List[str]] = None
    ) -> Dict[str, List[AnyEvent]]:
        """
        Henter alle hendelser fra en liste med saker.

        Nyttig for å vise kontekst i en forseringssak - f.eks. hendelser
        om grunnlag og fristforlengelse fra de avslåtte sakene.

        Args:
            sak_ids: Liste med sak-IDs å hente hendelser fra
            spor_filter: Valgfritt filter for spor (f.eks. ['grunnlag', 'frist'])

        Returns:
            Dict med sak_id -> liste av events
        """
        if not self.event_repository:
            logger.warning("Ingen event repository - kan ikke hente hendelser")
            return {}

        result: Dict[str, List[AnyEvent]] = {}

        for sak_id in sak_ids:
            try:
                events, _version = self.event_repository.get_events(sak_id)

                # Filtrer på spor hvis angitt
                if spor_filter:
                    events = [
                        e for e in events
                        if getattr(e, 'spor', None) in spor_filter
                        or e.get('spor') in spor_filter  # For dict-events
                    ]

                result[sak_id] = events
                logger.debug(f"Hentet {len(events)} hendelser fra sak {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved henting av hendelser fra sak {sak_id}: {e}")
                result[sak_id] = []

        total_events = sum(len(events) for events in result.values())
        logger.info(f"Hentet totalt {total_events} hendelser fra {len(sak_ids)} saker")
        return result

    def hent_state_fra_relaterte_saker(
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
                events, _version = self.event_repository.get_events(sak_id)
                if events:
                    state = self.timeline_service.compute_state(events)
                    result[sak_id] = state
                    logger.debug(f"Beregnet state for sak {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved beregning av state for sak {sak_id}: {e}")

        logger.info(f"Hentet state fra {len(result)} av {len(sak_ids)} saker")
        return result

    def hent_komplett_forseringskontekst(
        self,
        forsering_sak_id: str
    ) -> Dict[str, Any]:
        """
        Henter komplett kontekst for en forseringssak, inkludert:
        - Relaterte saker
        - State for hver relatert sak
        - Relevante hendelser (grunnlag, frist, respons)

        Args:
            forsering_sak_id: Forseringssakens ID

        Returns:
            Dict med:
            - relaterte_saker: Liste med SakRelasjon
            - sak_states: Dict[sak_id, SakState]
            - hendelser: Dict[sak_id, List[Event]]
            - oppsummering: Aggregert info (avslåtte dager, grunnlag, etc.)
        """
        # Hent relaterte saker
        relaterte = self.hent_relaterte_saker(forsering_sak_id)
        relaterte_ids = [r.relatert_sak_id for r in relaterte]

        if not relaterte_ids:
            logger.warning(f"Ingen relaterte saker funnet for {forsering_sak_id}")
            return {
                "relaterte_saker": [],
                "sak_states": {},
                "hendelser": {},
                "oppsummering": {}
            }

        # Hent state og hendelser
        states = self.hent_state_fra_relaterte_saker(relaterte_ids)
        hendelser = self.hent_hendelser_fra_relaterte_saker(
            relaterte_ids,
            spor_filter=['grunnlag', 'frist']  # Mest relevante for forsering
        )

        # Bygg oppsummering
        total_avslatte_dager = 0
        total_krevde_dager = 0
        grunnlag_info = []

        for sak_id, state in states.items():
            if state.frist:
                if state.frist.krevd_dager:
                    total_krevde_dager += state.frist.krevd_dager
                if state.frist.bh_resultat == 'avslatt':
                    total_avslatte_dager += state.frist.krevd_dager or 0

            if state.grunnlag and state.grunnlag.hovedkategori:
                grunnlag_info.append({
                    "sak_id": sak_id,
                    "tittel": state.sakstittel,
                    "hovedkategori": state.grunnlag.hovedkategori,
                    "bh_resultat": state.grunnlag.bh_resultat
                })

        oppsummering = {
            "antall_relaterte_saker": len(relaterte_ids),
            "total_krevde_dager": total_krevde_dager,
            "total_avslatte_dager": total_avslatte_dager,
            "grunnlag_oversikt": grunnlag_info
        }

        logger.info(
            f"Hentet komplett kontekst for {forsering_sak_id}: "
            f"{len(relaterte_ids)} saker, {total_avslatte_dager} avslåtte dager"
        )

        return {
            "relaterte_saker": relaterte,
            "sak_states": states,
            "hendelser": hendelser,
            "oppsummering": oppsummering
        }

    def valider_30_prosent_regel(
        self,
        estimert_kostnad: float,
        avslatte_dager: int,
        dagmulktsats: float
    ) -> Dict[str, Any]:
        """
        Validerer om estimert kostnad er innenfor 30%-grensen.

        Args:
            estimert_kostnad: TE's estimerte forseringskostnad
            avslatte_dager: Antall avslåtte dager
            dagmulktsats: Dagmulktsats fra kontrakten (NOK/dag)

        Returns:
            Dict med valideringsresultat:
            - er_gyldig: bool
            - maks_kostnad: float
            - differanse: float (negativ = innenfor, positiv = over)
            - prosent_av_maks: float
        """
        maks_kostnad = avslatte_dager * dagmulktsats * 1.3
        differanse = estimert_kostnad - maks_kostnad
        prosent_av_maks = (estimert_kostnad / maks_kostnad * 100) if maks_kostnad > 0 else 0

        return {
            "er_gyldig": estimert_kostnad <= maks_kostnad,
            "maks_kostnad": maks_kostnad,
            "differanse": differanse,
            "prosent_av_maks": round(prosent_av_maks, 1),
            "dagmulkt_grunnlag": avslatte_dager * dagmulktsats,
            "tillegg_30_prosent": avslatte_dager * dagmulktsats * 0.3
        }

    def _beregn_avslatte_dager(self, sak_ids: List[str]) -> int:
        """
        Beregner sum av avslåtte dager fra fristforlengelsessaker.

        Args:
            sak_ids: Liste med sak-IDs

        Returns:
            Sum av avslåtte dager
        """
        if not self.event_repository or not self.timeline_service:
            logger.warning(
                "Mangler repository/timeline service - kan ikke beregne avslåtte dager. "
                "Send inn avslatte_dager eksplisitt."
            )
            return 0

        states = self.hent_state_fra_relaterte_saker(sak_ids)
        total_avslatte = 0

        for sak_id, state in states.items():
            if state.frist and state.frist.bh_resultat == 'avslatt':
                avslatte = state.frist.krevd_dager or 0
                total_avslatte += avslatte
                logger.debug(f"Sak {sak_id}: {avslatte} avslåtte dager")

        logger.info(f"Totalt {total_avslatte} avslåtte dager fra {len(sak_ids)} saker")
        return total_avslatte

    def is_configured(self) -> bool:
        """
        Sjekker om servicen er konfigurert med en Catenda client.

        Returns:
            True hvis client er tilgjengelig
        """
        return self.client is not None
