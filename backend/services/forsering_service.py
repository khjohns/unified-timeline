"""
ForseringService - Håndterer forseringssaker (§ 33.8).

Når BH avslår et berettiget krav om fristforlengelse, kan TE varsle om
at de vil iverksette forsering. Forseringskostnader kan kreves dekket
innenfor 30%-grensen (dagmulkt + 30%).

Denne servicen håndterer opprettelse av forseringssaker som egne saker
med relasjoner til de avslåtte fristforlengelsessakene.
"""
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone

from utils.logger import get_logger
from lib.helpers import get_all_sak_ids
from models.sak_state import SaksType, SakState, SakRelasjon
from models.events import parse_event
from services.base_sak_service import BaseSakService

logger = get_logger(__name__)


class ForseringService(BaseSakService):
    """
    Service for å håndtere forseringssaker (§ 33.8).

    Forseringssaker opprettes som egne Catenda topics med relasjoner
    til de avslåtte fristforlengelsessakene de er basert på.
    """

    def __init__(
        self,
        catenda_client: Optional[Any] = None,
        event_repository: Optional[Any] = None,
        timeline_service: Optional[Any] = None,
        metadata_repository: Optional[Any] = None
    ):
        """
        Initialiser ForseringService.

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
        self._log_init_warnings("ForseringService")

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

            # Opprett toveis-relasjoner til avslåtte saker
            # Forsering → KOE (forseringssaken peker på KOE-sakene)
            self.client.create_topic_relations(
                topic_id=topic['guid'],
                related_topic_guids=avslatte_sak_ids
            )
            # KOE → Forsering (hver KOE-sak peker tilbake på forseringssaken)
            for koe_id in avslatte_sak_ids:
                self.client.create_topic_relations(
                    topic_id=koe_id,
                    related_topic_guids=[topic['guid']]
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
                "dato_varslet": datetime.now(timezone.utc).isoformat(),
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
            - forsering_hendelser: Hendelser fra forseringssaken selv
        """
        # Hent forseringssakens egen state først (for fallback)
        forsering_state = self._hent_sak_state(forsering_sak_id)

        # Prøv Catenda først, fall tilbake til lokale data
        relaterte = []
        try:
            relaterte = self.hent_relaterte_saker(forsering_sak_id)
        except (RuntimeError, Exception) as e:
            logger.warning(f"Catenda utilgjengelig for {forsering_sak_id}, bruker lokale data: {e}")

        # Fallback: Bruk avslatte_fristkrav fra forsering_data
        if not relaterte and forsering_state and forsering_state.forsering_data:
            relaterte_ids_from_state = forsering_state.forsering_data.avslatte_fristkrav or []
            logger.info(f"Bruker lokale relaterte saker fra forsering_data: {relaterte_ids_from_state}")
            relaterte = [
                SakRelasjon(relatert_sak_id=sak_id)
                for sak_id in relaterte_ids_from_state
            ]

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

        # Hent hendelser fra forseringssaken selv
        forsering_hendelser = []
        if self.event_repository:
            try:
                events_data, _ = self.event_repository.get_events(forsering_sak_id)
                if events_data:
                    forsering_hendelser = [parse_event(e) for e in events_data]
            except Exception as e:
                logger.warning(f"Kunne ikke hente hendelser for {forsering_sak_id}: {e}")

        logger.info(
            f"Hentet komplett kontekst for {forsering_sak_id}: "
            f"{len(relaterte_ids)} saker, {total_avslatte_dager} avslåtte dager, "
            f"{len(forsering_hendelser)} forseringshendelser"
        )

        return {
            "relaterte_saker": relaterte,
            "sak_states": states,
            "hendelser": hendelser,
            "oppsummering": oppsummering,
            "forsering_hendelser": forsering_hendelser
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

    def finn_forseringer_for_sak(self, sak_id: str) -> List[Dict[str, Any]]:
        """
        Finner alle forseringssaker som refererer til en gitt KOE-sak.

        Brukes for å vise back-links fra KOE-saker til deres forsering.

        Args:
            sak_id: KOE-sakens ID

        Returns:
            Liste med forseringssaker som refererer til KOE-saken
        """
        forseringer = []

        # Hent liste over sak-IDer å søke gjennom
        sak_ids_to_search = get_all_sak_ids(
            catenda_client=self.client,
            event_repository=self.event_repository
        )

        if not sak_ids_to_search:
            logger.warning("Ingen saker å søke gjennom for forseringer")
            return []

        # Søk gjennom sakene
        for candidate_sak_id in sak_ids_to_search:
            if self.event_repository and self.timeline_service:
                try:
                    events_data, _version = self.event_repository.get_events(candidate_sak_id)
                    if events_data:
                        events = [parse_event(e) for e in events_data]
                        state = self.timeline_service.compute_state(events)

                        if state.sakstype == 'forsering' and state.forsering_data:
                            relaterte = state.forsering_data.avslatte_fristkrav or []
                            if sak_id in relaterte:
                                forseringer.append({
                                    "forsering_sak_id": candidate_sak_id,
                                    "forsering_sak_tittel": state.sakstittel,
                                    "dato_varslet": state.forsering_data.dato_varslet,
                                    "er_iverksatt": state.forsering_data.er_iverksatt or False,
                                    "er_stoppet": state.forsering_data.er_stoppet or False,
                                })
                except Exception as e:
                    logger.debug(f"Kunne ikke evaluere sak {candidate_sak_id}: {e}")

        logger.info(f"Fant {len(forseringer)} forseringer som refererer til {sak_id}")
        return forseringer

    def hent_kandidat_koe_saker(self) -> List[Dict[str, Any]]:
        """
        Henter KOE-saker som kan brukes for forsering.

        En KOE er kandidat for forsering hvis:
        - Den har sakstype='standard' (ikke forsering/endringsordre)
        - Fristkravet er avslått av BH (bh_resultat='avslatt')

        Returns:
            Liste med kandidat-saker (sak_id, tittel, avslatte_dager)
        """
        if not self.client:
            logger.warning("Ingen Catenda client - kan ikke hente kandidater")
            return []

        # Hent alle topics
        try:
            topics = self.client.list_topics()
        except Exception as e:
            logger.error(f"Feil ved henting av topics: {e}")
            return []

        kandidater = []

        for topic in topics:
            topic_guid = topic.get('guid')
            if not topic_guid:
                continue

            # Map Catenda topic GUID to internal sak_id via metadata
            sak_id = None
            if self.metadata_repository:
                metadata = self.metadata_repository.get_by_topic_id(topic_guid)
                if metadata:
                    sak_id = metadata.sak_id

            if not sak_id:
                logger.debug(f"Ingen sak funnet for topic {topic_guid}")
                continue

            # Sjekk om dette er en standard sak med avslått fristkrav
            if self.event_repository and self.timeline_service:
                try:
                    events_data, _version = self.event_repository.get_events(sak_id)
                    if events_data:
                        events = [parse_event(e) for e in events_data]
                        state = self.timeline_service.compute_state(events)

                        # Sjekk kriterier for forsering
                        is_standard = state.sakstype == SaksType.STANDARD or state.sakstype is None
                        has_rejected_frist = (
                            state.frist and
                            state.frist.bh_resultat == 'avslatt'
                        )

                        if is_standard and has_rejected_frist:
                            avslatte_dager = state.frist.krevd_dager or 0
                            kandidater.append({
                                "sak_id": sak_id,
                                "tittel": state.sakstittel or topic.get('title', 'Ukjent'),
                                "overordnet_status": state.overordnet_status,
                                "avslatte_dager": avslatte_dager,
                                "frist_bh_resultat": state.frist.bh_resultat if state.frist else None
                            })
                except Exception as e:
                    logger.debug(f"Kunne ikke evaluere sak {sak_id}: {e}")

        logger.info(f"Fant {len(kandidater)} kandidater for forsering")
        return kandidater

    # legg_til_relatert_sak og fjern_relatert_sak er arvet fra BaseSakService

    def registrer_bh_respons(
        self,
        sak_id: str,
        aksepterer: bool,
        godkjent_kostnad: Optional[float],
        begrunnelse: str,
        aktor: str,
        expected_version: Optional[int] = None,
        # Tre-port felter
        grunnlag_fortsatt_gyldig: Optional[bool] = None,
        grunnlag_begrunnelse: Optional[str] = None,
        trettiprosent_overholdt: Optional[bool] = None,
        trettiprosent_begrunnelse: Optional[str] = None,
        # Særskilte krav (§34.1.3)
        rigg_varslet_i_tide: Optional[bool] = None,
        produktivitet_varslet_i_tide: Optional[bool] = None,
        godkjent_rigg_drift: Optional[float] = None,
        godkjent_produktivitet: Optional[float] = None,
        # Subsidiært standpunkt
        subsidiaer_triggers: Optional[List[str]] = None,
        subsidiaer_godkjent_belop: Optional[float] = None,
        subsidiaer_begrunnelse: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Registrerer BHs respons på forseringsvarselet (tre-port modell).

        Args:
            sak_id: Forseringssakens ID
            aksepterer: Om BH aksepterer forseringen
            godkjent_kostnad: BHs godkjente forseringskostnad (kan være lavere enn estimert)
            begrunnelse: BHs begrunnelse
            aktor: Navn på den som registrerer responsen
            expected_version: Forventet versjon for optimistisk låsing
            # Tre-port felter
            grunnlag_fortsatt_gyldig: Port 1 - bekrefter at frist-avslaget fortsatt gjelder
            grunnlag_begrunnelse: BHs begrunnelse hvis grunnlaget bestrides
            trettiprosent_overholdt: Port 2 - bekrefter at estimert kostnad er innenfor 30%-grensen
            trettiprosent_begrunnelse: BHs begrunnelse ved avvik fra 30%-regelen
            # Særskilte krav (§34.1.3)
            rigg_varslet_i_tide: Om rigg/drift-varslet var rettidig
            produktivitet_varslet_i_tide: Om produktivitets-varslet var rettidig
            godkjent_rigg_drift: Godkjent rigg/drift-beløp
            godkjent_produktivitet: Godkjent produktivitetsbeløp
            # Subsidiært standpunkt
            subsidiaer_triggers: Triggere for subsidiær vurdering
            subsidiaer_godkjent_belop: Subsidiært godkjent beløp
            subsidiaer_begrunnelse: Begrunnelse for subsidiært standpunkt

        Returns:
            Dict med oppdatert state, event, old_status og ny versjon

        Raises:
            RuntimeError: Hvis lagring feiler
            ConcurrencyError: Hvis versjonskonflikt
        """
        from models.events import ForseringResponsEvent, ForseringResponsData

        if not self.event_repository:
            raise RuntimeError("EventRepository er ikke konfigurert")

        # Hent versjon hvis ikke oppgitt (bakoverkompatibilitet)
        if expected_version is None:
            _, expected_version = self.event_repository.get_events(sak_id)

        # Hent gammel status før event for Catenda-synkronisering
        old_status = self._get_current_status(sak_id)

        # Opprett typed event med tre-port data
        event = ForseringResponsEvent(
            sak_id=sak_id,
            aktor=aktor,
            aktor_rolle="BH",
            data=ForseringResponsData(
                # Port 1: Grunnlagsvalidering
                grunnlag_fortsatt_gyldig=grunnlag_fortsatt_gyldig,
                grunnlag_begrunnelse=grunnlag_begrunnelse,
                # Port 2: 30%-regel
                trettiprosent_overholdt=trettiprosent_overholdt,
                trettiprosent_begrunnelse=trettiprosent_begrunnelse,
                # Port 3: Beløpsvurdering
                aksepterer=aksepterer,
                godkjent_kostnad=godkjent_kostnad,
                begrunnelse=begrunnelse,
                dato_respons=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                # Særskilte krav (§34.1.3)
                rigg_varslet_i_tide=rigg_varslet_i_tide,
                produktivitet_varslet_i_tide=produktivitet_varslet_i_tide,
                godkjent_rigg_drift=godkjent_rigg_drift,
                godkjent_produktivitet=godkjent_produktivitet,
                # Subsidiært
                subsidiaer_triggers=subsidiaer_triggers,
                subsidiaer_godkjent_belop=subsidiaer_godkjent_belop,
                subsidiaer_begrunnelse=subsidiaer_begrunnelse,
            )
        )

        # Lagre med eksplisitt versjonskontroll
        new_version = self.event_repository.append(event, expected_version)

        logger.info(
            f"BH respons på forsering {sak_id}: "
            f"{'Akseptert' if aksepterer else 'Avslått'}"
        )

        # Returner oppdatert state med event for Catenda-synkronisering
        result = self._get_updated_state(sak_id)
        result["version"] = new_version
        result["event"] = event
        result["old_status"] = old_status
        return result

    def stopp_forsering(
        self,
        sak_id: str,
        begrunnelse: str,
        paalopte_kostnader: Optional[float],
        aktor: str,
        expected_version: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Stopper en pågående forsering.

        Args:
            sak_id: Forseringssakens ID
            begrunnelse: Begrunnelse for stopp
            paalopte_kostnader: Påløpte kostnader ved stopp
            aktor: Navn på den som stopper forseringen
            expected_version: Forventet versjon for optimistisk låsing

        Returns:
            Dict med oppdatert state, event, old_status, dato_stoppet og ny versjon

        Raises:
            RuntimeError: Hvis lagring feiler
            ConcurrencyError: Hvis versjonskonflikt
        """
        from models.events import ForseringStoppetEvent, ForseringStoppetData

        if not self.event_repository:
            raise RuntimeError("EventRepository er ikke konfigurert")

        # Hent versjon hvis ikke oppgitt (bakoverkompatibilitet)
        if expected_version is None:
            _, expected_version = self.event_repository.get_events(sak_id)

        # Hent gammel status før event for Catenda-synkronisering
        old_status = self._get_current_status(sak_id)

        dato_stoppet = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Opprett typed event
        event = ForseringStoppetEvent(
            sak_id=sak_id,
            aktor=aktor,
            aktor_rolle="TE",
            data=ForseringStoppetData(
                dato_stoppet=dato_stoppet,
                paalopte_kostnader=paalopte_kostnader,
                begrunnelse=begrunnelse,
            )
        )

        # Lagre med eksplisitt versjonskontroll
        new_version = self.event_repository.append(event, expected_version)

        logger.info(f"Forsering {sak_id} stoppet, påløpte kostnader: {paalopte_kostnader}")

        # Returner oppdatert state med event for Catenda-synkronisering
        result = self._get_updated_state(sak_id)
        result["dato_stoppet"] = dato_stoppet
        result["version"] = new_version
        result["event"] = event
        result["old_status"] = old_status
        return result

    def oppdater_kostnader(
        self,
        sak_id: str,
        paalopte_kostnader: float,
        kommentar: Optional[str],
        aktor: str,
        expected_version: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Oppdaterer påløpte kostnader for en pågående forsering.

        Args:
            sak_id: Forseringssakens ID
            paalopte_kostnader: Nye påløpte kostnader
            kommentar: Valgfri kommentar til oppdateringen
            aktor: Navn på den som oppdaterer
            expected_version: Forventet versjon for optimistisk låsing

        Returns:
            Dict med oppdatert state, event, old_status og ny versjon

        Raises:
            RuntimeError: Hvis lagring feiler
            ConcurrencyError: Hvis versjonskonflikt
        """
        from models.events import ForseringKostnaderOppdatertEvent, ForseringKostnaderOppdatertData

        if not self.event_repository:
            raise RuntimeError("EventRepository er ikke konfigurert")

        # Hent versjon hvis ikke oppgitt (bakoverkompatibilitet)
        if expected_version is None:
            _, expected_version = self.event_repository.get_events(sak_id)

        # Hent gammel status før event for Catenda-synkronisering
        old_status = self._get_current_status(sak_id)

        # Opprett typed event
        event = ForseringKostnaderOppdatertEvent(
            sak_id=sak_id,
            aktor=aktor,
            aktor_rolle="TE",
            data=ForseringKostnaderOppdatertData(
                paalopte_kostnader=paalopte_kostnader,
                kommentar=kommentar,
            )
        )

        # Lagre med eksplisitt versjonskontroll
        new_version = self.event_repository.append(event, expected_version)

        logger.info(f"Forseringskostnader for {sak_id} oppdatert til {paalopte_kostnader}")

        # Returner oppdatert state med event for Catenda-synkronisering
        result = self._get_updated_state(sak_id)
        result["version"] = new_version
        result["event"] = event
        result["old_status"] = old_status
        return result

    def valider_grunnlag_fortsatt_gyldig(
        self,
        forsering_sak_id: str
    ) -> Dict[str, Any]:
        """
        Sjekker om grunnlaget for forsering fortsatt er gyldig.

        Grunnlaget er UGYLDIG hvis:
        1. BH har snudd og godkjent fristforlengelsen (endret bh_resultat)
        2. TE har trukket fristkravet
        3. Saken er lukket/omforent på annen måte

        Args:
            forsering_sak_id: ID til forseringssaken

        Returns:
            Dict med:
                - er_gyldig: bool
                - grunn: str (hvis ugyldig)
                - pavirket_sak_id: str (hvis ugyldig)
                - ny_status: str (hvis BH har endret standpunkt)
        """
        if not self.event_repository or not self.timeline_service:
            return {
                "er_gyldig": False,
                "grunn": "Kan ikke validere grunnlag (mangler repository/service)"
            }

        # Hent forseringssakens state
        forsering_state = self._hent_sak_state(forsering_sak_id)
        if not forsering_state:
            return {
                "er_gyldig": False,
                "grunn": f"Fant ikke forseringssak {forsering_sak_id}"
            }

        if not forsering_state.forsering_data:
            return {
                "er_gyldig": False,
                "grunn": "Saken mangler forsering_data"
            }

        # Sjekk hver avslått fristsak
        for avslatt_sak_id in forsering_state.forsering_data.avslatte_fristkrav:
            koe_state = self._hent_sak_state(avslatt_sak_id)
            if not koe_state:
                logger.warning(f"Kunne ikke hente state for {avslatt_sak_id}")
                continue

            # Sjekk om frist-sporet fortsatt er avslått
            if koe_state.frist and koe_state.frist.bh_resultat:
                # Sjekk om BH har snudd (ikke lenger avslått)
                if koe_state.frist.bh_resultat.value not in ['avslatt', 'hold_tilbake']:
                    return {
                        "er_gyldig": False,
                        "grunn": f"BH har endret standpunkt på fristforlengelse for {avslatt_sak_id}",
                        "pavirket_sak_id": avslatt_sak_id,
                        "ny_status": koe_state.frist.bh_resultat.value
                    }

        return {"er_gyldig": True}

    def _hent_sak_state(self, sak_id: str) -> Optional[SakState]:
        """
        Hjelpemetode for å hente SakState for en sak.

        Args:
            sak_id: Sakens ID

        Returns:
            SakState eller None hvis ikke funnet
        """
        if not self.event_repository or not self.timeline_service:
            return None

        try:
            events_data, _ = self.event_repository.get_events(sak_id)
            if events_data:
                events = [parse_event(e) for e in events_data]
                return self.timeline_service.compute_state(events)
        except Exception as e:
            logger.warning(f"Kunne ikke hente state for {sak_id}: {e}")

        return None

    def _get_updated_state(self, sak_id: str) -> Dict[str, Any]:
        """
        Henter oppdatert state for en sak etter en event er lagret.

        Args:
            sak_id: Sakens ID

        Returns:
            Dict med state-data
        """
        if not self.event_repository or not self.timeline_service:
            return {"success": True, "message": "Event lagret (state ikke beregnet)"}

        try:
            events_data, _version = self.event_repository.get_events(sak_id)
            if events_data:
                events = [parse_event(e) for e in events_data]
                state = self.timeline_service.compute_state(events)
                return {
                    "success": True,
                    "state": state.model_dump(mode='json') if hasattr(state, 'model_dump') else state
                }
        except Exception as e:
            logger.warning(f"Kunne ikke beregne state for {sak_id}: {e}")

        return {"success": True, "message": "Event lagret"}

    def _get_current_status(self, sak_id: str) -> Optional[str]:
        """
        Henter nåværende overordnet_status for en sak (før ny event legges til).

        Brukes for å detektere statusendringer for Catenda-synkronisering.

        Args:
            sak_id: Sakens ID

        Returns:
            Overordnet status som streng, eller None hvis ikke tilgjengelig
        """
        if not self.event_repository or not self.timeline_service:
            return None

        try:
            events_data, _version = self.event_repository.get_events(sak_id)
            if events_data:
                events = [parse_event(e) for e in events_data]
                state = self.timeline_service.compute_state(events)
                return state.overordnet_status
        except Exception as e:
            logger.warning(f"Kunne ikke hente status for {sak_id}: {e}")

        return None

