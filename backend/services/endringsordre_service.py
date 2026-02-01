"""
EndringsordreService - Håndterer endringsordresaker (§31.3).

Endringsordre (EO) er det formelle dokumentet som bekrefter en endring i kontrakten.
En EO kan samle flere KOE-er (Krav om Endringsordre).

Denne servicen håndterer opprettelse og håndtering av endringsordresaker som egne saker
med relasjoner til de KOE-sakene som inngår i endringsordren.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

from utils.logger import get_logger
from lib.helpers import get_all_sak_ids
from models.sak_state import (
    SaksType,
    EOStatus,
    SakState,
    SporStatus,
    SakRelasjon,
)
from models.events import (
    AnyEvent,
    parse_event,
    EventType,
    EOKoeHandlingEvent,
    EOKoeHandlingData,
    SakOpprettetEvent,
    EOOpprettetEvent,
    EOOpprettetData,
    EOUtstedtEvent,
    EOUtstedtData,
    EOKonsekvenser,  # Import from events, not sak_state, for EOUtstedtData compatibility
    VederlagKompensasjon,
    VederlagsMetode,
)
from models.sak_metadata import SakMetadata
from uuid import uuid4
from services.base_sak_service import BaseSakService

logger = get_logger(__name__)


class EndringsordreService(BaseSakService):
    """
    Service for å håndtere endringsordresaker (§31.3).

    Endringsordresaker opprettes som egne Catenda topics med relasjoner
    til de KOE-sakene som inngår i endringsordren.
    """

    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None,
        metadata_repository: Optional[Any] = None
    ):
        """
        Initialiser EndringsordreService.

        Args:
            catenda_client: CatendaClient instance (eller mock)
            event_repository: EventRepository for å hente events fra saker
            timeline_service: TimelineService for å beregne SakState
            metadata_repository: SakMetadataRepository for å mappe topic GUID til sak_id
        """
        super().__init__(
            catenda_client=catenda_client,
            event_repository=event_repository,
            timeline_service=timeline_service
        )
        self.metadata_repository = metadata_repository
        self._log_init_warnings("EndringsordreService")

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

        Local-first: Lagrer events lokalt først, synker til Catenda etterpå.

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
            Dict med den opprettede endringsordresaken inkludert catenda_synced status

        Raises:
            ValueError: Hvis påkrevde felt mangler
            RuntimeError: Hvis lagring av events feiler
        """
        if not eo_nummer:
            raise ValueError("EO-nummer er påkrevd")
        if not beskrivelse:
            raise ValueError("Beskrivelse er påkrevd")

        now = datetime.now(timezone.utc)
        dato_utstedt = now.strftime('%Y-%m-%d')

        # 1. Generer lokal sak-ID
        sak_id = f"EO-{now.strftime('%Y%m%d%H%M%S')}"

        logger.info(
            f"Oppretter endringsordresak {sak_id} (EO-{eo_nummer}) "
            f"med {len(koe_sak_ids)} relaterte KOE-er"
        )

        # 2. Bygg konsekvenser
        eo_konsekvenser = EOKonsekvenser(
            sha=konsekvenser.get('sha', False) if konsekvenser else False,
            kvalitet=konsekvenser.get('kvalitet', False) if konsekvenser else False,
            fremdrift=konsekvenser.get('fremdrift', False) if konsekvenser else False,
            pris=konsekvenser.get('pris', False) if konsekvenser else False,
            annet=konsekvenser.get('annet', False) if konsekvenser else False,
        )

        # Beregn netto beløp
        komp = kompensasjon_belop or 0.0
        frad = fradrag_belop or 0.0
        netto = komp - frad

        # 3. Opprett metadata (vil lagres atomisk med events via UoW)
        metadata = SakMetadata(
            sak_id=sak_id,
            created_at=now,
            created_by=utstedt_av or "BH",
            sakstype="endringsordre",
            cached_title=f"Endringsordre {eo_nummer}",
            cached_status="utstedt",
            last_event_at=now,
        )

        # 4. Opprett events lokalt
        events = []

        # SAK_OPPRETTET
        sak_event = SakOpprettetEvent(
            event_id=str(uuid4()),
            sak_id=sak_id,
            event_type=EventType.SAK_OPPRETTET,
            tidsstempel=now,
            aktor=utstedt_av or "BH",
            aktor_rolle="BH",
            sakstittel=f"Endringsordre {eo_nummer}",
            sakstype="endringsordre",
        )
        events.append(sak_event)

        # EO_OPPRETTET
        eo_opprettet = EOOpprettetEvent(
            event_id=str(uuid4()),
            sak_id=sak_id,
            event_type=EventType.EO_OPPRETTET,
            tidsstempel=now,
            aktor=utstedt_av or "BH",
            aktor_rolle="BH",
            data=EOOpprettetData(
                eo_nummer=eo_nummer,
                beskrivelse=beskrivelse,
                relaterte_koe_saker=koe_sak_ids,
                sakstittel=f"Endringsordre {eo_nummer}",
            ),
        )
        events.append(eo_opprettet)

        # EO_UTSTEDT (hvis utstedt_av er satt, eller alltid for nå)
        vederlag = None
        if oppgjorsform and kompensasjon_belop:
            metode_map = {
                "ENHETSPRISER": VederlagsMetode.ENHETSPRISER,
                "REGNINGSARBEID": VederlagsMetode.REGNINGSARBEID,
                "FASTPRIS_TILBUD": VederlagsMetode.FASTPRIS_TILBUD,
            }
            vederlag = VederlagKompensasjon(
                metode=metode_map.get(oppgjorsform, VederlagsMetode.REGNINGSARBEID),
                kostnads_overslag=kompensasjon_belop,
            )

        eo_utstedt = EOUtstedtEvent(
            event_id=str(uuid4()),
            sak_id=sak_id,
            event_type=EventType.EO_UTSTEDT,
            tidsstempel=now,
            aktor=utstedt_av or "BH",
            aktor_rolle="BH",
            data=EOUtstedtData(
                eo_nummer=eo_nummer,
                revisjon_nummer=0,
                beskrivelse=beskrivelse,
                konsekvenser=eo_konsekvenser,
                konsekvens_beskrivelse=konsekvens_beskrivelse,
                vederlag=vederlag,
                frist_dager=frist_dager,
                ny_sluttdato=ny_sluttdato,
                relaterte_koe_saker=koe_sak_ids,
            ),
        )
        events.append(eo_utstedt)

        # 5. Lagre metadata + events atomisk via SakCreationService
        from services.sak_creation_service import get_sak_creation_service

        creation_service = get_sak_creation_service()
        result = creation_service.create_sak_with_metadata(
            metadata=metadata,
            events=events
        )

        if not result.success:
            raise RuntimeError(f"Kunne ikke opprette endringsordre: {result.error}")

        # 6. Prøv å synke til Catenda (valgfritt, kun hvis enabled)
        catenda_synced = False
        catenda_topic_id = None
        from core.config import settings
        if settings.is_catenda_enabled and self.client:
            try:
                topic = self.client.create_topic(
                    title=f"Endringsordre {eo_nummer}",
                    description=beskrivelse,
                    topic_type="Endringsordre",
                    topic_status="Open"
                )
                if topic:
                    catenda_topic_id = topic.get('guid')

                    # Opprett relasjoner i Catenda
                    if koe_sak_ids and catenda_topic_id:
                        self.client.create_topic_relations(
                            topic_id=catenda_topic_id,
                            related_topic_guids=koe_sak_ids
                        )
                        for koe_id in koe_sak_ids:
                            try:
                                self.client.create_topic_relations(
                                    topic_id=koe_id,
                                    related_topic_guids=[catenda_topic_id]
                                )
                            except Exception:
                                pass  # KOE finnes kanskje ikke i Catenda

                    catenda_synced = True
                    logger.info(f"✅ Catenda topic opprettet: {catenda_topic_id}")
            except Exception as e:
                logger.warning(f"Catenda-synk feilet (fortsetter uten): {e}")

        return {
            "sak_id": sak_id,
            "sakstype": SaksType.ENDRINGSORDRE.value,
            "catenda_synced": catenda_synced,
            "catenda_topic_id": catenda_topic_id,
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
                "netto_belop": netto,
                "har_priskonsekvens": eo_konsekvenser.pris or netto != 0,
                "har_fristkonsekvens": eo_konsekvenser.fremdrift or (frist_dager is not None and frist_dager > 0),
            }
        }

    def legg_til_koe(self, eo_sak_id: str, koe_sak_id: str, aktor: str = "BH") -> Dict[str, Any]:
        """
        Legger til en KOE-sak til endringsordren.

        Local-first: Lagrer event lokalt først, synker til Catenda etterpå.

        Args:
            eo_sak_id: Endringsordresakens ID
            koe_sak_id: KOE-sakens ID som skal legges til
            aktor: Hvem som utfører handlingen

        Returns:
            Dict med success og catenda_synced status
        """
        # 1. Opprett og lagre event lokalt FØRST
        event = EOKoeHandlingEvent(
            event_id=str(uuid4()),
            sak_id=eo_sak_id,
            event_type=EventType.EO_KOE_LAGT_TIL,
            tidsstempel=datetime.now(timezone.utc),
            aktor=aktor,
            aktor_rolle="BH",
            data=EOKoeHandlingData(
                koe_sak_id=koe_sak_id,
            ),
        )

        if self.event_repository:
            try:
                # Hent nåværende versjon
                _, current_version = self.event_repository.get_events(eo_sak_id)
                self.event_repository.append(event, expected_version=current_version)
                logger.info(f"✅ Event EO_KOE_LAGT_TIL lagret lokalt for {eo_sak_id}")
            except Exception as e:
                logger.error(f"Feil ved lagring av event: {e}")
                raise RuntimeError(f"Kunne ikke lagre event: {e}")

        # 2. Prøv å synke til Catenda (valgfritt)
        catenda_synced = False
        if self.client:
            try:
                self.client.create_topic_relations(
                    topic_id=eo_sak_id,
                    related_topic_guids=[koe_sak_id]
                )
                self.client.create_topic_relations(
                    topic_id=koe_sak_id,
                    related_topic_guids=[eo_sak_id]
                )
                catenda_synced = True
                logger.info(f"✅ Catenda-relasjon opprettet: {eo_sak_id} <-> {koe_sak_id}")
            except Exception as e:
                logger.warning(f"Catenda-synk feilet (fortsetter uten): {e}")

        return {
            "success": True,
            "catenda_synced": catenda_synced,
        }

    def fjern_koe(self, eo_sak_id: str, koe_sak_id: str, aktor: str = "BH") -> Dict[str, Any]:
        """
        Fjerner en KOE-sak fra endringsordren.

        Local-first: Lagrer event lokalt først, synker til Catenda etterpå.

        Args:
            eo_sak_id: Endringsordresakens ID
            koe_sak_id: KOE-sakens ID som skal fjernes
            aktor: Hvem som utfører handlingen

        Returns:
            Dict med success og catenda_synced status
        """
        # 1. Opprett og lagre event lokalt FØRST
        event = EOKoeHandlingEvent(
            event_id=str(uuid4()),
            sak_id=eo_sak_id,
            event_type=EventType.EO_KOE_FJERNET,
            tidsstempel=datetime.now(timezone.utc),
            aktor=aktor,
            aktor_rolle="BH",
            data=EOKoeHandlingData(
                koe_sak_id=koe_sak_id,
            ),
        )

        if self.event_repository:
            try:
                _, current_version = self.event_repository.get_events(eo_sak_id)
                self.event_repository.append(event, expected_version=current_version)
                logger.info(f"✅ Event EO_KOE_FJERNET lagret lokalt for {eo_sak_id}")
            except Exception as e:
                logger.error(f"Feil ved lagring av event: {e}")
                raise RuntimeError(f"Kunne ikke lagre event: {e}")

        # 2. Prøv å synke til Catenda (valgfritt)
        catenda_synced = False
        if self.client:
            try:
                self.client.delete_topic_relation(
                    topic_id=eo_sak_id,
                    related_topic_id=koe_sak_id
                )
                self.client.delete_topic_relation(
                    topic_id=koe_sak_id,
                    related_topic_id=eo_sak_id
                )
                catenda_synced = True
                logger.info(f"✅ Catenda-relasjon fjernet: {eo_sak_id} <-> {koe_sak_id}")
            except Exception as e:
                logger.warning(f"Catenda-synk feilet (fortsetter uten): {e}")

        return {
            "success": True,
            "catenda_synced": catenda_synced,
        }

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
        # Hent EO-sakens egne hendelser først (for fallback)
        eo_hendelser: List[AnyEvent] = []
        lokale_relaterte_ids: List[str] = []
        if self.event_repository:
            try:
                events_data, _version = self.event_repository.get_events(eo_sak_id)
                # Parse events from stored data (dicts -> typed Event objects)
                eo_hendelser = [parse_event(e) for e in events_data] if events_data else []

                # Ekstraher relaterte_koe_saker fra EO-hendelser for fallback
                for event in eo_hendelser:
                    if hasattr(event, 'data') and hasattr(event.data, 'relaterte_koe_saker'):
                        lokale_relaterte_ids = event.data.relaterte_koe_saker or []
                        if lokale_relaterte_ids:
                            break  # Bruk første event med relaterte saker
            except Exception as e:
                logger.error(f"Feil ved henting av EO-hendelser: {e}")

        # Prøv Catenda først, fall tilbake til lokale data
        relaterte = []
        try:
            relaterte = self.hent_relaterte_saker(eo_sak_id)
        except (RuntimeError, Exception) as e:
            logger.warning(f"Catenda utilgjengelig for {eo_sak_id}, bruker lokale data: {e}")

        # Fallback: Bruk relaterte_koe_saker fra EO-hendelser
        if not relaterte and lokale_relaterte_ids:
            logger.info(f"Bruker lokale relaterte saker fra EO-data: {lokale_relaterte_ids}")
            relaterte = [
                SakRelasjon(relatert_sak_id=sak_id)
                for sak_id in lokale_relaterte_ids
            ]

        relaterte_ids = [r.relatert_sak_id for r in relaterte]

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
                if state.vederlag.krevd_belop:
                    total_krevd_vederlag += state.vederlag.krevd_belop
                if state.vederlag.godkjent_belop:
                    total_godkjent_vederlag += state.vederlag.godkjent_belop
                koe_info["krevd_vederlag"] = state.vederlag.krevd_belop
                koe_info["godkjent_vederlag"] = state.vederlag.godkjent_belop

            # Frist
            if state.frist:
                if state.frist.krevd_dager:
                    total_krevd_dager += state.frist.krevd_dager
                koe_info["krevd_dager"] = state.frist.krevd_dager

                # Bruk godkjent_dager hvis satt, ellers fallback til krevd_dager
                # når status er godkjent/låst (BH har godkjent hele kravet)
                godkjent = state.frist.godkjent_dager
                if godkjent is None and state.frist.status in (
                    SporStatus.GODKJENT, SporStatus.LAAST
                ):
                    godkjent = state.frist.krevd_dager

                if godkjent:
                    total_godkjent_dager += godkjent
                koe_info["godkjent_dager"] = godkjent

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
        # Hent liste over sak-IDer å søke gjennom
        sak_ids_to_search = get_all_sak_ids(
            catenda_client=self.client,
            event_repository=self.event_repository,
            metadata_repository=self.metadata_repository,
            use_metadata_mapping=True
        )

        if not sak_ids_to_search:
            logger.warning("Ingen saker å søke gjennom for kandidat-KOE-saker")
            return []

        kandidater = []

        for sak_id in sak_ids_to_search:
            # Sjekk om dette er en standard sak med kan_utstede_eo=True
            if self.event_repository and self.timeline_service:
                try:
                    events_data, _version = self.event_repository.get_events(sak_id)
                    if events_data:
                        events = [parse_event(e) for e in events_data]
                        state = self.timeline_service.compute_state(events)

                        # Sjekk kriterier: må være standard sak (ikke forsering/endringsordre) med kan_utstede_eo
                        if (state.sakstype == 'standard' or state.sakstype is None) and state.kan_utstede_eo:
                            kandidater.append({
                                "sak_id": sak_id,
                                "tittel": state.sakstittel or "",
                                "overordnet_status": state.overordnet_status,
                                "sum_godkjent": state.sum_godkjent,
                                "godkjent_dager": state.frist.godkjent_dager if state.frist else None,
                            })
                except Exception as e:
                    logger.debug(f"Kunne ikke evaluere sak {sak_id}: {e}")

        logger.info(f"Fant {len(kandidater)} kandidat-KOE-saker for EO")
        return kandidater

    def finn_eoer_for_koe(self, koe_sak_id: str) -> List[Dict[str, Any]]:
        """
        Finner alle endringsordrer som refererer til en gitt KOE-sak.

        Brukes for å vise back-links fra KOE-saker til deres EO.

        Args:
            koe_sak_id: KOE-sakens ID

        Returns:
            Liste med EO-er som refererer til KOE-saken
        """
        eoer = []

        # Hent liste over sak-IDer å søke gjennom
        sak_ids_to_search = get_all_sak_ids(
            catenda_client=self.client,
            event_repository=self.event_repository
        )

        if not sak_ids_to_search:
            logger.warning("Ingen saker å søke gjennom for EOer")
            return []

        # Søk gjennom sakene
        for candidate_sak_id in sak_ids_to_search:
            if self.event_repository and self.timeline_service:
                try:
                    events, _version = self.event_repository.get_events(candidate_sak_id)
                    if events:
                        state = self.timeline_service.compute_state(events)

                        # Sjekk om det er en endringsordresak
                        if state.sakstype == 'endringsordre' and state.endringsordre_data:
                            # Sjekk om denne EO refererer til vår KOE
                            relaterte = state.endringsordre_data.relaterte_koe_saker or []
                            if koe_sak_id in relaterte:
                                eoer.append({
                                    "eo_sak_id": candidate_sak_id,
                                    "eo_nummer": state.endringsordre_data.eo_nummer,
                                    "dato_utstedt": state.endringsordre_data.dato_utstedt,
                                    "status": state.endringsordre_data.status,
                                })
                except Exception as e:
                    logger.debug(f"Kunne ikke evaluere sak {candidate_sak_id}: {e}")

        logger.info(f"Fant {len(eoer)} EOer som refererer til KOE {koe_sak_id}")
        return eoer

