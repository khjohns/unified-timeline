"""
EndringsordreService - Håndterer endringsordresaker (§31.3).

Endringsordre (EO) er det formelle dokumentet som bekrefter en endring i kontrakten.
En EO kan samle flere KOE-er (Krav om Endringsordre).

Denne servicen håndterer opprettelse og håndtering av endringsordresaker som egne saker
med relasjoner til de KOE-sakene som inngår i endringsordren.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime

from utils.logger import get_logger
from models.sak_state import (
    SaksType,
    SakRelasjon,
    EndringsordreData,
    EOStatus,
    EOKonsekvenser,
    SakState,
)
from models.events import AnyEvent

logger = get_logger(__name__)


class EndringsordreService:
    """
    Service for å håndtere endringsordresaker (§31.3).

    Endringsordresaker opprettes som egne Catenda topics med relasjoner
    til de KOE-sakene som inngår i endringsordren.
    """

    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None
    ):
        """
        Initialiser EndringsordreService.

        Args:
            catenda_client: CatendaClient instance (eller mock)
            event_repository: EventRepository for å hente events fra saker
            timeline_service: TimelineService for å beregne SakState
        """
        self.client = catenda_client
        self.event_repository = event_repository
        self.timeline_service = timeline_service

        if not self.client:
            logger.warning("EndringsordreService initialized without Catenda client")
        if not self.event_repository:
            logger.warning("EndringsordreService initialized without event repository")
        if not self.timeline_service:
            logger.warning("EndringsordreService initialized without timeline service")

    def opprett_endringsordresak(
        self,
        eo_nummer: str,
        beskrivelse: str,
        koe_sak_ids: List[str],
        konsekvenser: Optional[Dict[str, bool]] = None,
        konsekvens_beskrivelse: Optional[str] = None,
        oppgjorsform: Optional[str] = None,
        kompensasjon_belop: Optional[float] = None,
        fradrag_belop: Optional[float] = None,
        er_estimat: bool = False,
        frist_dager: Optional[int] = None,
        ny_sluttdato: Optional[str] = None,
        utstedt_av: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Oppretter en ny endringsordresak med relasjoner til KOE-saker.

        Args:
            eo_nummer: Endringsordre-nummer (prosjektets nummerering)
            beskrivelse: Beskrivelse av hva endringen går ut på (§31.3)
            koe_sak_ids: Liste med sak-IDs til KOE-er som inngår
            konsekvenser: Dict med konsekvens-flagg (sha, kvalitet, fremdrift, pris, annet)
            konsekvens_beskrivelse: Beskrivelse av konsekvensene
            oppgjorsform: Oppgjørsform ved priskonsekvens (ENHETSPRISER, REGNINGSARBEID, FASTPRIS_TILBUD)
            kompensasjon_belop: Kompensasjonsbeløp (positivt = tillegg)
            fradrag_belop: Fradragsbeløp
            er_estimat: Om beløpet er et estimat
            frist_dager: Antall dager fristforlengelse
            ny_sluttdato: Ny sluttdato (YYYY-MM-DD)
            utstedt_av: Navn på person som utsteder EO (BH-representant)

        Returns:
            Dict med den opprettede endringsordresaken

        Raises:
            ValueError: Hvis påkrevde felt mangler
            RuntimeError: Hvis opprettelse i Catenda feiler
        """
        if not eo_nummer:
            raise ValueError("EO-nummer er påkrevd")
        if not beskrivelse:
            raise ValueError("Beskrivelse er påkrevd")

        # Bygg konsekvenser
        eo_konsekvenser = EOKonsekvenser(
            sha=konsekvenser.get('sha', False) if konsekvenser else False,
            kvalitet=konsekvenser.get('kvalitet', False) if konsekvenser else False,
            fremdrift=konsekvenser.get('fremdrift', False) if konsekvenser else False,
            pris=konsekvenser.get('pris', False) if konsekvenser else False,
            annet=konsekvenser.get('annet', False) if konsekvenser else False,
        )

        logger.info(
            f"Oppretter endringsordresak EO-{eo_nummer} "
            f"med {len(koe_sak_ids)} relaterte KOE-er"
        )

        # Opprett topic i Catenda
        topic = None
        if self.client:
            topic = self.client.create_topic(
                title=f"Endringsordre {eo_nummer}",
                description=beskrivelse,
                topic_type="Endringsordre",
                topic_status="Open"
            )

            if not topic:
                raise RuntimeError("Kunne ikke opprette topic i Catenda")

            # Opprett relasjoner til KOE-saker
            if koe_sak_ids:
                self.client.create_topic_relations(
                    topic_id=topic['guid'],
                    related_topic_guids=koe_sak_ids
                )
            logger.info(f"✅ Endringsordresak opprettet: {topic['guid']}")
        else:
            logger.warning("Ingen Catenda client - returnerer mock-data")

        # Bygg sak-ID
        sak_id = topic['guid'] if topic else f"mock-eo-{datetime.now().timestamp()}"
        dato_utstedt = datetime.now().strftime('%Y-%m-%d')

        # Beregn netto beløp
        komp = kompensasjon_belop or 0.0
        frad = fradrag_belop or 0.0
        netto = komp - frad

        return {
            "sak_id": sak_id,
            "sakstype": SaksType.ENDRINGSORDRE.value,
            "relaterte_saker": [
                {"relatert_sak_id": id}
                for id in koe_sak_ids
            ],
            "endringsordre_data": {
                "relaterte_koe_saker": koe_sak_ids,
                "eo_nummer": eo_nummer,
                "revisjon_nummer": 0,
                "beskrivelse": beskrivelse,
                "vedlegg_ids": [],
                "konsekvenser": eo_konsekvenser.model_dump(),
                "konsekvens_beskrivelse": konsekvens_beskrivelse,
                "oppgjorsform": oppgjorsform,
                "kompensasjon_belop": kompensasjon_belop,
                "fradrag_belop": fradrag_belop,
                "er_estimat": er_estimat,
                "frist_dager": frist_dager,
                "ny_sluttdato": ny_sluttdato,
                "status": EOStatus.UTSTEDT.value,
                "dato_utstedt": dato_utstedt,
                "utstedt_av": utstedt_av,
                "te_akseptert": None,
                "te_kommentar": None,
                "dato_te_respons": None,
                # Computed
                "netto_belop": netto,
                "har_priskonsekvens": eo_konsekvenser.pris or netto != 0,
                "har_fristkonsekvens": eo_konsekvenser.fremdrift or (frist_dager is not None and frist_dager > 0),
            }
        }

    def hent_relaterte_saker(self, sak_id: str) -> List[SakRelasjon]:
        """
        Henter alle relaterte saker (KOE-er) for en endringsordresak.

        Args:
            sak_id: Endringsordresak ID (Catenda topic GUID)

        Returns:
            Liste med SakRelasjon objekter
        """
        if not self.client:
            logger.warning("Ingen Catenda client - returnerer tom liste")
            return []

        related = self.client.list_related_topics(sak_id)

        relasjoner = []
        for rel in related:
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

        logger.info(f"Hentet {len(relasjoner)} relaterte KOE-saker for EO {sak_id}")
        return relasjoner

    def legg_til_koe(self, eo_sak_id: str, koe_sak_id: str) -> bool:
        """
        Legger til en KOE-sak som relatert til endringsordren.

        Args:
            eo_sak_id: Endringsordresak ID
            koe_sak_id: KOE-sak ID som skal legges til

        Returns:
            True hvis vellykket

        Raises:
            RuntimeError: Hvis Catenda-operasjon feiler
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke legge til relasjon")
            return False

        try:
            self.client.create_topic_relations(
                topic_id=eo_sak_id,
                related_topic_guids=[koe_sak_id]
            )
            logger.info(f"✅ KOE {koe_sak_id} lagt til EO {eo_sak_id}")
            return True
        except Exception as e:
            logger.error(f"Feil ved tillegging av KOE: {e}")
            raise RuntimeError(f"Kunne ikke legge til KOE: {e}")

    def fjern_koe(self, eo_sak_id: str, koe_sak_id: str) -> bool:
        """
        Fjerner en KOE-sak fra endringsordren.

        Args:
            eo_sak_id: Endringsordresak ID
            koe_sak_id: KOE-sak ID som skal fjernes

        Returns:
            True hvis vellykket

        Raises:
            RuntimeError: Hvis Catenda-operasjon feiler
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke fjerne relasjon")
            return False

        try:
            self.client.delete_topic_relation(
                topic_id=eo_sak_id,
                related_topic_guid=koe_sak_id
            )
            logger.info(f"✅ KOE {koe_sak_id} fjernet fra EO {eo_sak_id}")
            return True
        except Exception as e:
            logger.error(f"Feil ved fjerning av KOE: {e}")
            raise RuntimeError(f"Kunne ikke fjerne KOE: {e}")

    def hent_hendelser_fra_relaterte_saker(
        self,
        sak_ids: List[str],
        spor_filter: Optional[List[str]] = None
    ) -> Dict[str, List[AnyEvent]]:
        """
        Henter alle hendelser fra en liste med KOE-saker.

        Args:
            sak_ids: Liste med sak-IDs å hente hendelser fra
            spor_filter: Valgfritt filter for spor

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

                if spor_filter:
                    events = [
                        e for e in events
                        if getattr(e, 'spor', None) in spor_filter
                        or e.get('spor') in spor_filter
                    ]

                result[sak_id] = events
                logger.debug(f"Hentet {len(events)} hendelser fra KOE {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved henting av hendelser fra sak {sak_id}: {e}")
                result[sak_id] = []

        total_events = sum(len(events) for events in result.values())
        logger.info(f"Hentet totalt {total_events} hendelser fra {len(sak_ids)} KOE-saker")
        return result

    def hent_state_fra_relaterte_saker(
        self,
        sak_ids: List[str]
    ) -> Dict[str, SakState]:
        """
        Henter SakState for en liste med KOE-saker.

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
                    logger.debug(f"Beregnet state for KOE {sak_id}")

            except Exception as e:
                logger.error(f"Feil ved beregning av state for sak {sak_id}: {e}")

        logger.info(f"Hentet state fra {len(result)} av {len(sak_ids)} KOE-saker")
        return result

    def hent_komplett_eo_kontekst(
        self,
        eo_sak_id: str
    ) -> Dict[str, Any]:
        """
        Henter komplett kontekst for en endringsordresak, inkludert:
        - Relaterte KOE-saker
        - State for hver KOE-sak
        - Hendelser fra KOE-sakene
        - EO-sakens egne hendelser
        - Oppsummering (totalt vederlag, frist, etc.)

        Args:
            eo_sak_id: Endringsordresakens ID

        Returns:
            Dict med:
            - relaterte_saker: Liste med SakRelasjon
            - sak_states: Dict[sak_id, SakState]
            - hendelser: Dict[sak_id, List[Event]]
            - eo_hendelser: List[Event] (EO-sakens egne hendelser)
            - oppsummering: Aggregert info
        """
        # Hent relaterte KOE-saker
        relaterte = self.hent_relaterte_saker(eo_sak_id)
        relaterte_ids = [r.relatert_sak_id for r in relaterte]

        # Hent EO-sakens egne hendelser
        eo_hendelser = []
        if self.event_repository:
            try:
                events, _version = self.event_repository.get_events(eo_sak_id)
                eo_hendelser = events
            except Exception as e:
                logger.error(f"Feil ved henting av EO-hendelser: {e}")

        if not relaterte_ids:
            logger.info(f"Ingen relaterte KOE-saker for EO {eo_sak_id}")
            return {
                "relaterte_saker": [],
                "sak_states": {},
                "hendelser": {},
                "eo_hendelser": eo_hendelser,
                "oppsummering": self._bygg_oppsummering({})
            }

        # Hent state og hendelser fra KOE-saker
        states = self.hent_state_fra_relaterte_saker(relaterte_ids)
        hendelser = self.hent_hendelser_fra_relaterte_saker(relaterte_ids)

        # Bygg oppsummering
        oppsummering = self._bygg_oppsummering(states)

        logger.info(
            f"Hentet komplett kontekst for EO {eo_sak_id}: "
            f"{len(relaterte_ids)} KOE-er"
        )

        return {
            "relaterte_saker": relaterte,
            "sak_states": states,
            "hendelser": hendelser,
            "eo_hendelser": eo_hendelser,
            "oppsummering": oppsummering
        }

    def _bygg_oppsummering(self, states: Dict[str, SakState]) -> Dict[str, Any]:
        """
        Bygger oppsummering fra KOE-saker.

        Args:
            states: Dict med sak_id -> SakState

        Returns:
            Dict med oppsummeringsdata
        """
        total_krevd_vederlag = 0.0
        total_godkjent_vederlag = 0.0
        total_krevd_dager = 0
        total_godkjent_dager = 0
        koe_oversikt = []

        for sak_id, state in states.items():
            koe_info = {
                "sak_id": sak_id,
                "tittel": state.sakstittel,
                "grunnlag_status": state.grunnlag.status if state.grunnlag else None,
                "vederlag_status": state.vederlag.status if state.vederlag else None,
                "frist_status": state.frist.status if state.frist else None,
            }

            # Vederlag
            if state.vederlag:
                if state.vederlag.hovedkrav_belop:
                    total_krevd_vederlag += state.vederlag.hovedkrav_belop
                if state.vederlag.godkjent_belop:
                    total_godkjent_vederlag += state.vederlag.godkjent_belop
                koe_info["krevd_vederlag"] = state.vederlag.hovedkrav_belop
                koe_info["godkjent_vederlag"] = state.vederlag.godkjent_belop

            # Frist
            if state.frist:
                if state.frist.krevd_dager:
                    total_krevd_dager += state.frist.krevd_dager
                if state.frist.godkjent_dager:
                    total_godkjent_dager += state.frist.godkjent_dager
                koe_info["krevd_dager"] = state.frist.krevd_dager
                koe_info["godkjent_dager"] = state.frist.godkjent_dager

            koe_oversikt.append(koe_info)

        return {
            "antall_koe_saker": len(states),
            "total_krevd_vederlag": total_krevd_vederlag,
            "total_godkjent_vederlag": total_godkjent_vederlag,
            "total_krevd_dager": total_krevd_dager,
            "total_godkjent_dager": total_godkjent_dager,
            "koe_oversikt": koe_oversikt
        }

    def hent_kandidat_koe_saker(self) -> List[Dict[str, Any]]:
        """
        Henter KOE-saker som kan legges til i en endringsordre.

        En KOE er kandidat hvis:
        - Den har sakstype='standard' (ikke forsering/endringsordre)
        - kan_utstede_eo er True (alle spor godkjent)

        Returns:
            Liste med kandidat-saker (sak_id, tittel, status)
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke hente kandidater")
            return []

        # Hent alle topics
        # NB: Dette kan bli ineffektivt med mange saker - bør optimaliseres med filtrering
        try:
            topics = self.client.list_topics()
        except Exception as e:
            logger.error(f"Feil ved henting av topics: {e}")
            return []

        kandidater = []

        for topic in topics:
            topic_id = topic.get('guid')
            if not topic_id:
                continue

            # Sjekk om dette er en standard sak med kan_utstede_eo=True
            if self.event_repository and self.timeline_service:
                try:
                    events, _version = self.event_repository.get_events(topic_id)
                    if events:
                        state = self.timeline_service.compute_state(events)

                        # Sjekk kriterier
                        if (state.sakstype == 'standard' or state.sakstype is None) and state.kan_utstede_eo:
                            kandidater.append({
                                "sak_id": topic_id,
                                "tittel": state.sakstittel or topic.get('title', ''),
                                "overordnet_status": state.overordnet_status,
                                "sum_godkjent": state.sum_godkjent,
                                "godkjent_dager": state.frist.godkjent_dager if state.frist else None,
                            })
                except Exception as e:
                    logger.debug(f"Kunne ikke evaluere topic {topic_id}: {e}")

        logger.info(f"Fant {len(kandidater)} kandidat-KOE-saker for EO")
        return kandidater

    def is_configured(self) -> bool:
        """
        Sjekker om servicen er konfigurert med en Catenda client.

        Returns:
            True hvis client er tilgjengelig
        """
        return self.client is not None
