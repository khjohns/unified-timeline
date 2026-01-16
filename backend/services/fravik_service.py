"""
FravikService - Beregner FravikState fra event-logg.

Dette er "aggregate root" for Fravik-søknader i Event Sourcing-terminologi.
Servicen tar en liste med events og projiserer dem til en FravikState.

Design-prinsipper:
1. Events er immutable - vi endrer aldri historikk
2. State beregnes alltid fra scratch basert på events
3. Godkjenningskjeden: Miljørådgiver → PL → Arbeidsgruppe → Eier
"""
from typing import List, Optional, Dict, Any
from datetime import datetime

from models.fravik_events import (
    FravikEvent,
    FravikEventType,
    FravikStatus,
    FravikBeslutning,
    FravikRolle,
    SoknadOpprettetEvent,
    SoknadOppdatertEvent,
    SoknadSendtInnEvent,
    SoknadTrukketEvent,
    MaskinLagtTilEvent,
    MaskinOppdatertEvent,
    MaskinFjernetEvent,
    MiljoVurderingEvent,
    MiljoReturnertEvent,
    PLVurderingEvent,
    PLReturnertevent,
    ArbeidsgruppeVurderingEvent,
    EierGodkjentEvent,
    EierAvslattEvent,
    EierDelvisGodkjentEvent,
    AnyFravikEvent,
    parse_fravik_event,
)
from models.fravik_state import (
    FravikState,
    MaskinTilstand,
    MaskinMiljoVurdering,
    MaskinArbeidsgruppeVurdering,
    MaskinEierBeslutning,
    GodkjenningsKjedeTilstand,
    VurderingSteg,
    FravikListeItem,
)
from utils.logger import get_logger

logger = get_logger(__name__)


class FravikService:
    """
    Service for å beregne FravikState fra events.

    Hovedmetoden er `compute_state(events)` som tar en liste
    med events og returnerer en ferdig aggregert FravikState.
    """

    def __init__(self):
        """Initialize FravikService"""
        pass

    def compute_state(self, events: List[AnyFravikEvent]) -> FravikState:
        """
        Hovedmetode: Beregn FravikState fra event-liste.

        Args:
            events: Liste med events, må være sortert kronologisk

        Returns:
            Ferdig aggregert FravikState

        Raises:
            ValueError: Hvis events er tom eller mangler SOKNAD_OPPRETTET

        Eksempel:
            >>> service = FravikService()
            >>> events = [soknad_opprettet, maskin_lagt_til, miljo_vurdering]
            >>> state = service.compute_state(events)
            >>> print(state.status)
            FravikStatus.UNDER_MILJO_VURDERING
        """
        if not events:
            raise ValueError("Kan ikke beregne state uten events")

        # Sorter events etter tidsstempel (sikre kronologisk rekkefølge)
        sorted_events = sorted(events, key=lambda e: e.tidsstempel)

        # Første event må være SOKNAD_OPPRETTET
        first_event = sorted_events[0]
        if first_event.event_type != FravikEventType.SOKNAD_OPPRETTET:
            raise ValueError(
                f"Første event må være SOKNAD_OPPRETTET, fikk: {first_event.event_type}"
            )

        # Initialiser state fra første event
        state = self._init_state_from_opprettet(first_event)

        # Prosesser resterende events
        for event in sorted_events[1:]:
            state = self._apply_event(state, event)

        # Oppdater metadata
        state.antall_events = len(sorted_events)
        state.opprettet = sorted_events[0].tidsstempel
        state.siste_oppdatert = sorted_events[-1].tidsstempel

        logger.debug(f"Computed FravikState for {state.sak_id}: {state.status}")
        return state

    def _init_state_from_opprettet(self, event: SoknadOpprettetEvent) -> FravikState:
        """Initialiser FravikState fra SOKNAD_OPPRETTET event."""
        data = event.data
        return FravikState(
            sak_id=event.sak_id,
            prosjekt_id=data.prosjekt_id,
            prosjekt_navn=data.prosjekt_navn,
            prosjekt_nummer=data.prosjekt_nummer,
            rammeavtale=data.rammeavtale,
            hovedentreprenor=data.hovedentreprenor,
            soker_navn=data.soker_navn,
            soker_epost=data.soker_epost,
            soknad_type=data.soknad_type,
            frist_for_svar=data.frist_for_svar,
            er_haste=data.er_haste,
            haste_begrunnelse=data.haste_begrunnelse,
            status=FravikStatus.UTKAST,
            opprettet=event.tidsstempel,
        )

    def _apply_event(self, state: FravikState, event: AnyFravikEvent) -> FravikState:
        """
        Appliserer én event på state og returnerer oppdatert state.

        Dette er en "reducer" i event sourcing-terminologi.
        """
        handlers = {
            FravikEventType.SOKNAD_OPPDATERT: self._handle_soknad_oppdatert,
            FravikEventType.SOKNAD_SENDT_INN: self._handle_soknad_sendt_inn,
            FravikEventType.SOKNAD_TRUKKET: self._handle_soknad_trukket,
            FravikEventType.MASKIN_LAGT_TIL: self._handle_maskin_lagt_til,
            FravikEventType.MASKIN_OPPDATERT: self._handle_maskin_oppdatert,
            FravikEventType.MASKIN_FJERNET: self._handle_maskin_fjernet,
            FravikEventType.MILJO_VURDERING: self._handle_miljo_vurdering,
            FravikEventType.MILJO_RETURNERT: self._handle_miljo_returnert,
            FravikEventType.PL_VURDERING: self._handle_pl_vurdering,
            FravikEventType.PL_RETURNERT: self._handle_pl_returnert,
            FravikEventType.ARBEIDSGRUPPE_VURDERING: self._handle_arbeidsgruppe_vurdering,
            FravikEventType.EIER_GODKJENT: self._handle_eier_godkjent,
            FravikEventType.EIER_AVSLATT: self._handle_eier_avslatt,
            FravikEventType.EIER_DELVIS_GODKJENT: self._handle_eier_delvis_godkjent,
        }

        handler = handlers.get(event.event_type)
        if handler:
            return handler(state, event)
        else:
            logger.warning(f"Ukjent Fravik event-type: {event.event_type}")
            return state

    # ============ SØKNAD HANDLERS ============

    def _handle_soknad_oppdatert(
        self, state: FravikState, event: SoknadOppdatertEvent
    ) -> FravikState:
        """Håndterer oppdatering av søknad (partielle felt)."""
        data = event.data

        # Oppdater bare feltene som er satt
        if data.prosjekt_navn is not None:
            state.prosjekt_navn = data.prosjekt_navn
        if data.prosjekt_nummer is not None:
            state.prosjekt_nummer = data.prosjekt_nummer
        if data.rammeavtale is not None:
            state.rammeavtale = data.rammeavtale
        if data.hovedentreprenor is not None:
            state.hovedentreprenor = data.hovedentreprenor
        if data.soker_navn is not None:
            state.soker_navn = data.soker_navn
        if data.soker_epost is not None:
            state.soker_epost = data.soker_epost
        if data.frist_for_svar is not None:
            state.frist_for_svar = data.frist_for_svar
        if data.er_haste is not None:
            state.er_haste = data.er_haste
        if data.haste_begrunnelse is not None:
            state.haste_begrunnelse = data.haste_begrunnelse
        if data.avbotende_tiltak is not None:
            state.avbotende_tiltak = data.avbotende_tiltak
        if data.konsekvenser_ved_avslag is not None:
            state.konsekvenser_ved_avslag = data.konsekvenser_ved_avslag

        return state

    def _handle_soknad_sendt_inn(
        self, state: FravikState, event: SoknadSendtInnEvent
    ) -> FravikState:
        """Håndterer innsending av søknad."""
        state.status = FravikStatus.SENDT_INN
        state.sendt_inn_tidspunkt = event.tidsstempel
        return state

    def _handle_soknad_trukket(
        self, state: FravikState, event: SoknadTrukketEvent
    ) -> FravikState:
        """Håndterer tilbaketrekking av søknad."""
        state.status = FravikStatus.TRUKKET
        return state

    # ============ MASKIN HANDLERS ============

    def _handle_maskin_lagt_til(
        self, state: FravikState, event: MaskinLagtTilEvent
    ) -> FravikState:
        """Håndterer tillegging av maskin."""
        data = event.data
        maskin = MaskinTilstand(
            maskin_id=data.maskin_id,
            maskin_type=data.maskin_type,
            annet_type=data.annet_type,
            vekt=data.vekt,
            registreringsnummer=data.registreringsnummer,
            start_dato=data.start_dato,
            slutt_dato=data.slutt_dato,
            grunner=data.grunner,
            begrunnelse=data.begrunnelse,
            alternativer_vurdert=data.alternativer_vurdert,
            markedsundersokelse=data.markedsundersokelse,
            undersøkte_leverandorer=data.undersøkte_leverandorer,
            erstatningsmaskin=data.erstatningsmaskin,
            erstatningsdrivstoff=data.erstatningsdrivstoff,
            arbeidsbeskrivelse=data.arbeidsbeskrivelse,
            arbeidskategori=data.arbeidskategori,
            bruksintensitet=data.bruksintensitet,
            estimert_drivstofforbruk=data.estimert_drivstofforbruk,
        )
        state.maskiner[data.maskin_id] = maskin
        return state

    def _handle_maskin_oppdatert(
        self, state: FravikState, event: MaskinOppdatertEvent
    ) -> FravikState:
        """Håndterer oppdatering av maskin."""
        maskin_id = event.maskin_id
        if maskin_id not in state.maskiner:
            logger.warning(f"Maskin {maskin_id} finnes ikke, ignorerer oppdatering")
            return state

        data = event.data
        # Oppdater alle felt
        maskin = MaskinTilstand(
            maskin_id=data.maskin_id,
            maskin_type=data.maskin_type,
            annet_type=data.annet_type,
            vekt=data.vekt,
            registreringsnummer=data.registreringsnummer,
            start_dato=data.start_dato,
            slutt_dato=data.slutt_dato,
            grunner=data.grunner,
            begrunnelse=data.begrunnelse,
            alternativer_vurdert=data.alternativer_vurdert,
            markedsundersokelse=data.markedsundersokelse,
            undersøkte_leverandorer=data.undersøkte_leverandorer,
            erstatningsmaskin=data.erstatningsmaskin,
            erstatningsdrivstoff=data.erstatningsdrivstoff,
            arbeidsbeskrivelse=data.arbeidsbeskrivelse,
            arbeidskategori=data.arbeidskategori,
            bruksintensitet=data.bruksintensitet,
            estimert_drivstofforbruk=data.estimert_drivstofforbruk,
            # Behold eksisterende vurderinger
            miljo_vurdering=state.maskiner[maskin_id].miljo_vurdering,
            arbeidsgruppe_vurdering=state.maskiner[maskin_id].arbeidsgruppe_vurdering,
            eier_beslutning=state.maskiner[maskin_id].eier_beslutning,
        )
        state.maskiner[maskin_id] = maskin
        return state

    def _handle_maskin_fjernet(
        self, state: FravikState, event: MaskinFjernetEvent
    ) -> FravikState:
        """Håndterer fjerning av maskin."""
        maskin_id = event.maskin_id
        if maskin_id in state.maskiner:
            del state.maskiner[maskin_id]
        return state

    # ============ MILJØRÅDGIVER HANDLERS ============

    def _handle_miljo_vurdering(
        self, state: FravikState, event: MiljoVurderingEvent
    ) -> FravikState:
        """Håndterer miljørådgivers vurdering."""
        data = event.data

        # Oppdater vurderingskjeden
        state.godkjenningskjede.miljo_vurdering = VurderingSteg(
            fullfort=True,
            beslutning=data.samlet_anbefaling,
            dokumentasjon_tilstrekkelig=data.dokumentasjon_tilstrekkelig,
            kommentar=data.kommentar,
            manglende_dokumentasjon=data.manglende_dokumentasjon,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Oppdater maskin-spesifikke vurderinger
        for maskin_vurdering in data.maskin_vurderinger:
            maskin_id = maskin_vurdering.maskin_id
            if maskin_id in state.maskiner:
                state.maskiner[maskin_id].miljo_vurdering = MaskinMiljoVurdering(
                    beslutning=maskin_vurdering.beslutning,
                    kommentar=maskin_vurdering.kommentar,
                    vilkar=maskin_vurdering.vilkar or [],
                    vurdert_av=event.aktor,
                    vurdert_tidspunkt=event.tidsstempel,
                )

        # Oppdater status - gå videre til PL
        state.status = FravikStatus.UNDER_PL_VURDERING

        return state

    def _handle_miljo_returnert(
        self, state: FravikState, event: MiljoReturnertEvent
    ) -> FravikState:
        """Håndterer retur fra miljørådgiver (mangler dokumentasjon)."""
        state.godkjenningskjede.miljo_vurdering = VurderingSteg(
            fullfort=False,
            dokumentasjon_tilstrekkelig=False,
            manglende_dokumentasjon=event.manglende_dokumentasjon,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )
        state.status = FravikStatus.RETURNERT_FRA_MILJO
        return state

    # ============ PL HANDLERS ============

    def _handle_pl_vurdering(
        self, state: FravikState, event: PLVurderingEvent
    ) -> FravikState:
        """Håndterer prosjektleders vurdering."""
        data = event.data

        state.godkjenningskjede.pl_vurdering = VurderingSteg(
            fullfort=True,
            beslutning=data.anbefaling,
            dokumentasjon_tilstrekkelig=data.dokumentasjon_tilstrekkelig,
            kommentar=data.kommentar,
            manglende_dokumentasjon=data.manglende_dokumentasjon,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Gå videre til arbeidsgruppen
        state.status = FravikStatus.UNDER_ARBEIDSGRUPPE

        return state

    def _handle_pl_returnert(
        self, state: FravikState, event: PLReturnertevent
    ) -> FravikState:
        """Håndterer retur fra PL."""
        state.godkjenningskjede.pl_vurdering = VurderingSteg(
            fullfort=False,
            dokumentasjon_tilstrekkelig=False,
            manglende_dokumentasjon=event.manglende_dokumentasjon,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )
        state.status = FravikStatus.RETURNERT_FRA_PL
        return state

    # ============ ARBEIDSGRUPPE HANDLERS ============

    def _handle_arbeidsgruppe_vurdering(
        self, state: FravikState, event: ArbeidsgruppeVurderingEvent
    ) -> FravikState:
        """Håndterer arbeidsgruppens vurdering."""
        data = event.data

        # Oppdater vurderingskjeden
        state.godkjenningskjede.arbeidsgruppe_vurdering = VurderingSteg(
            fullfort=True,
            beslutning=data.samlet_innstilling,
            kommentar=data.kommentar,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Oppdater maskin-spesifikke vurderinger
        for maskin_vurdering in data.maskin_vurderinger:
            maskin_id = maskin_vurdering.maskin_id
            if maskin_id in state.maskiner:
                state.maskiner[maskin_id].arbeidsgruppe_vurdering = (
                    MaskinArbeidsgruppeVurdering(
                        beslutning=maskin_vurdering.beslutning,
                        kommentar=maskin_vurdering.kommentar,
                        vilkar=maskin_vurdering.vilkar or [],
                        vurdert_tidspunkt=event.tidsstempel,
                    )
                )

        # Gå videre til eier
        state.status = FravikStatus.UNDER_EIER_BESLUTNING

        return state

    # ============ EIER HANDLERS ============

    def _handle_eier_godkjent(
        self, state: FravikState, event: EierGodkjentEvent
    ) -> FravikState:
        """Håndterer eiers godkjenning."""
        data = event.data

        state.godkjenningskjede.eier_beslutning = VurderingSteg(
            fullfort=True,
            beslutning=FravikBeslutning.GODKJENT,
            kommentar=data.begrunnelse,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Oppdater maskin-beslutninger hvis spesifisert
        if data.maskin_beslutninger:
            for maskin_vurdering in data.maskin_beslutninger:
                maskin_id = maskin_vurdering.maskin_id
                if maskin_id in state.maskiner:
                    state.maskiner[maskin_id].eier_beslutning = MaskinEierBeslutning(
                        beslutning=maskin_vurdering.beslutning,
                        kommentar=maskin_vurdering.kommentar,
                        besluttet_tidspunkt=event.tidsstempel,
                    )
        else:
            # Godkjenn alle maskiner
            for maskin in state.maskiner.values():
                maskin.eier_beslutning = MaskinEierBeslutning(
                    beslutning=FravikBeslutning.GODKJENT,
                    besluttet_tidspunkt=event.tidsstempel,
                )

        state.status = FravikStatus.GODKJENT
        state.endelig_beslutning = FravikBeslutning.GODKJENT
        state.endelig_beslutning_kommentar = data.begrunnelse
        state.endelig_beslutning_tidspunkt = event.tidsstempel
        state.endelig_beslutning_av = event.aktor

        return state

    def _handle_eier_avslatt(
        self, state: FravikState, event: EierAvslattEvent
    ) -> FravikState:
        """Håndterer eiers avslag."""
        data = event.data

        state.godkjenningskjede.eier_beslutning = VurderingSteg(
            fullfort=True,
            beslutning=FravikBeslutning.AVSLATT,
            kommentar=data.begrunnelse,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Avslå alle maskiner
        for maskin in state.maskiner.values():
            maskin.eier_beslutning = MaskinEierBeslutning(
                beslutning=FravikBeslutning.AVSLATT,
                besluttet_tidspunkt=event.tidsstempel,
            )

        state.status = FravikStatus.AVSLATT
        state.endelig_beslutning = FravikBeslutning.AVSLATT
        state.endelig_beslutning_kommentar = data.begrunnelse
        state.endelig_beslutning_tidspunkt = event.tidsstempel
        state.endelig_beslutning_av = event.aktor

        return state

    def _handle_eier_delvis_godkjent(
        self, state: FravikState, event: EierDelvisGodkjentEvent
    ) -> FravikState:
        """Håndterer eiers delvise godkjenning."""
        data = event.data

        state.godkjenningskjede.eier_beslutning = VurderingSteg(
            fullfort=True,
            beslutning=FravikBeslutning.DELVIS_GODKJENT,
            kommentar=data.begrunnelse,
            vurdert_av=event.aktor,
            vurdert_tidspunkt=event.tidsstempel,
        )

        # Oppdater maskin-beslutninger
        if data.maskin_beslutninger:
            for maskin_vurdering in data.maskin_beslutninger:
                maskin_id = maskin_vurdering.maskin_id
                if maskin_id in state.maskiner:
                    state.maskiner[maskin_id].eier_beslutning = MaskinEierBeslutning(
                        beslutning=maskin_vurdering.beslutning,
                        kommentar=maskin_vurdering.kommentar,
                        besluttet_tidspunkt=event.tidsstempel,
                    )

        state.status = FravikStatus.DELVIS_GODKJENT
        state.endelig_beslutning = FravikBeslutning.DELVIS_GODKJENT
        state.endelig_beslutning_kommentar = data.begrunnelse
        state.endelig_beslutning_tidspunkt = event.tidsstempel
        state.endelig_beslutning_av = event.aktor

        return state

    # ============ HJELPEMETODER ============

    def state_to_liste_item(self, state: FravikState) -> FravikListeItem:
        """Konverterer FravikState til FravikListeItem for listevisning."""
        return FravikListeItem(
            sak_id=state.sak_id,
            prosjekt_navn=state.prosjekt_navn,
            prosjekt_nummer=state.prosjekt_nummer,
            soker_navn=state.soker_navn,
            soknad_type=state.soknad_type,
            status=state.status,
            antall_maskiner=len(state.maskiner),
            opprettet=state.opprettet,
            sendt_inn_tidspunkt=state.sendt_inn_tidspunkt,
            siste_oppdatert=state.siste_oppdatert,
        )


# Singleton-instans for enkel bruk
fravik_service = FravikService()
