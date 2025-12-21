"""
TimelineService - Beregner SakState fra event-logg.

Dette er "aggregate root" i Event Sourcing-terminologi.
Servicen tar en liste med events og projiserer dem til en SakState.

Design-prinsipper:
1. Events er immutable - vi endrer aldri historikk
2. State beregnes alltid fra scratch basert på events
3. Parallelisme: Hvert spor kan behandles uavhengig
"""
from typing import List, Optional, Dict, Any
from datetime import datetime

from models.events import (
    SakEvent,
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    ForseringVarselEvent,
    ForseringResponsEvent,
    ForseringStoppetEvent,
    ForseringKostnaderOppdatertEvent,
    ForseringKoeHandlingEvent,
    SakOpprettetEvent,
    EOUtstedtEvent,
    EOAkseptertEvent,
    EOKoeHandlingEvent,
    EOBestridtEvent,
    EORevidertEvent,
    EventType,
    SporType,
    SporStatus,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
    AnyEvent,
)
from models.sak_state import (
    SakState,
    SaksType,
    GrunnlagTilstand,
    VederlagTilstand,
    FristTilstand,
    SakOversikt,
    SporOversikt,
    EndringsordreData,
    EOStatus,
    EOKonsekvenser,
    ForseringData,
)
from utils.logger import get_logger

logger = get_logger(__name__)


class TimelineService:
    """
    Service for å beregne SakState fra events.

    Hovedmetoden er `compute_state(events)` som tar en liste
    med events og returnerer en ferdig aggregert SakState.
    """

    def __init__(self):
        """Initialize TimelineService"""
        pass

    def compute_state(self, events: List[AnyEvent]) -> SakState:
        """
        Hovedmetode: Beregn SakState fra event-liste.

        Args:
            events: Liste med events, må være sortert kronologisk

        Returns:
            Ferdig aggregert SakState

        Eksempel:
            >>> service = TimelineService()
            >>> events = [grunnlag_event, vederlag_event, respons_event]
            >>> state = service.compute_state(events)
            >>> print(state.overordnet_status)
            "UNDER_BEHANDLING"
        """
        if not events:
            raise ValueError("Kan ikke beregne state uten events")

        # Sorter events etter tidsstempel (sikre kronologisk rekkefølge)
        sorted_events = sorted(events, key=lambda e: e.tidsstempel)

        # Initialiser tom state
        sak_id = sorted_events[0].sak_id
        state = SakState(
            sak_id=sak_id,
            grunnlag=GrunnlagTilstand(),
            vederlag=VederlagTilstand(),
            frist=FristTilstand(),
        )

        # Prosesser hver event
        for event in sorted_events:
            state = self._apply_event(state, event)

        # Oppdater metadata
        state.antall_events = len(sorted_events)
        state.opprettet = sorted_events[0].tidsstempel
        state.siste_aktivitet = sorted_events[-1].tidsstempel

        logger.debug(f"Computed state for {sak_id}: {state.overordnet_status}")
        return state

    def _apply_event(self, state: SakState, event: AnyEvent) -> SakState:
        """
        Appliserer én event på state og returnerer oppdatert state.

        Dette er en "reducer" i event sourcing-terminologi.
        """
        # Route til riktig handler basert på event-type
        handlers = {
            EventType.SAK_OPPRETTET: self._handle_sak_opprettet,
            EventType.GRUNNLAG_OPPRETTET: self._handle_grunnlag,
            EventType.GRUNNLAG_OPPDATERT: self._handle_grunnlag,
            EventType.GRUNNLAG_TRUKKET: self._handle_grunnlag_trukket,
            EventType.VEDERLAG_KRAV_SENDT: self._handle_vederlag,
            EventType.VEDERLAG_KRAV_OPPDATERT: self._handle_vederlag,
            EventType.VEDERLAG_KRAV_TRUKKET: self._handle_vederlag_trukket,
            EventType.FRIST_KRAV_SENDT: self._handle_frist,
            EventType.FRIST_KRAV_OPPDATERT: self._handle_frist,
            EventType.FRIST_KRAV_SPESIFISERT: self._handle_frist,  # Same handler - updates days
            EventType.FRIST_KRAV_TRUKKET: self._handle_frist_trukket,
            EventType.RESPONS_GRUNNLAG: self._handle_respons_grunnlag,
            EventType.RESPONS_GRUNNLAG_OPPDATERT: self._handle_respons_grunnlag,  # Re-use handler
            EventType.RESPONS_VEDERLAG: self._handle_respons_vederlag,
            EventType.RESPONS_VEDERLAG_OPPDATERT: self._handle_respons_vederlag,  # Re-use handler
            EventType.RESPONS_FRIST: self._handle_respons_frist,
            EventType.RESPONS_FRIST_OPPDATERT: self._handle_respons_frist,  # Re-use handler
            EventType.FORSERING_VARSEL: self._handle_forsering_varsel,
            EventType.FORSERING_RESPONS: self._handle_forsering_respons,
            EventType.FORSERING_STOPPET: self._handle_forsering_stoppet,
            EventType.FORSERING_KOSTNADER_OPPDATERT: self._handle_forsering_kostnader_oppdatert,
            EventType.FORSERING_KOE_LAGT_TIL: self._handle_forsering_koe_lagt_til,
            EventType.FORSERING_KOE_FJERNET: self._handle_forsering_koe_fjernet,
            EventType.EO_UTSTEDT: self._handle_eo_utstedt,
            EventType.EO_AKSEPTERT: self._handle_eo_akseptert,
            EventType.EO_KOE_LAGT_TIL: self._handle_eo_koe_lagt_til,
            EventType.EO_KOE_FJERNET: self._handle_eo_koe_fjernet,
            EventType.EO_BESTRIDT: self._handle_eo_bestridt,
            EventType.EO_REVIDERT: self._handle_eo_revidert,
        }

        handler = handlers.get(event.event_type)
        if handler:
            return handler(state, event)
        else:
            logger.warning(f"Ukjent event-type: {event.event_type}")
            return state

    # ============ SAK HANDLERS ============

    def _handle_sak_opprettet(self, state: SakState, event: SakOpprettetEvent) -> SakState:
        """Håndterer SAK_OPPRETTET event.

        Setter sakstype og grunnlag til UTKAST (klar til å sende).
        Vederlag og frist forblir IKKE_RELEVANT til grunnlag er sendt.
        """
        state.sakstittel = event.sakstittel
        state.catenda_topic_id = event.catenda_topic_id

        # Map string sakstype to SaksType enum
        sakstype_map = {
            "standard": SaksType.STANDARD,
            "koe": SaksType.STANDARD,  # Alias for backwards compatibility
            "forsering": SaksType.FORSERING,
            "endringsordre": SaksType.ENDRINGSORDRE,
        }
        state.sakstype = sakstype_map.get(event.sakstype, SaksType.STANDARD)
        logger.debug(f"Set sakstype to {state.sakstype} (from event: {event.sakstype})")

        # Initialize grunnlag track as draft (ready to send) for standard cases
        if state.sakstype == SaksType.STANDARD:
            state.grunnlag.status = SporStatus.UTKAST

        return state

    # ============ GRUNNLAG HANDLERS ============

    def _handle_grunnlag(self, state: SakState, event: GrunnlagEvent) -> SakState:
        """Håndterer GRUNNLAG_OPPRETTET og GRUNNLAG_OPPDATERT"""
        grunnlag = state.grunnlag

        # Oppdater data
        grunnlag.hovedkategori = event.data.hovedkategori
        grunnlag.underkategori = event.data.underkategori
        grunnlag.beskrivelse = event.data.beskrivelse
        grunnlag.dato_oppdaget = event.data.dato_oppdaget
        grunnlag.kontraktsreferanser = event.data.kontraktsreferanser

        # Oppdater status
        if event.event_type == EventType.GRUNNLAG_OPPRETTET:
            grunnlag.status = SporStatus.SENDT
            grunnlag.antall_versjoner = 1
            # When grunnlag is first sent, enable vederlag and frist tracks
            if state.vederlag.status == SporStatus.IKKE_RELEVANT:
                state.vederlag.status = SporStatus.UTKAST
            if state.frist.status == SporStatus.IKKE_RELEVANT:
                state.frist.status = SporStatus.UTKAST
        else:  # OPPDATERT
            grunnlag.antall_versjoner += 1
            # Hvis det var avslått og TE oppdaterer, går det tilbake til SENDT
            if grunnlag.status == SporStatus.AVSLATT:
                grunnlag.status = SporStatus.SENDT

        # Metadata
        grunnlag.siste_event_id = event.event_id
        grunnlag.siste_oppdatert = event.tidsstempel

        state.grunnlag = grunnlag
        return state

    def _handle_grunnlag_trukket(self, state: SakState, event: GrunnlagEvent) -> SakState:
        """Håndterer GRUNNLAG_TRUKKET"""
        state.grunnlag.status = SporStatus.TRUKKET
        state.grunnlag.siste_event_id = event.event_id
        state.grunnlag.siste_oppdatert = event.tidsstempel
        return state

    # ============ VEDERLAG HANDLERS ============

    def _handle_vederlag(self, state: SakState, event: VederlagEvent) -> SakState:
        """Håndterer VEDERLAG_KRAV_SENDT og VEDERLAG_KRAV_OPPDATERT"""
        vederlag = state.vederlag

        # Oppdater data - VederlagTilstand uses belop_direkte/kostnads_overslag (not krevd_belop)
        vederlag.belop_direkte = event.data.belop_direkte
        vederlag.kostnads_overslag = event.data.kostnads_overslag
        vederlag.metode = event.data.metode.value if hasattr(event.data.metode, 'value') else event.data.metode
        vederlag.begrunnelse = event.data.begrunnelse
        # Handle saerskilt_krav - store as dict in VederlagTilstand
        if event.data.saerskilt_krav:
            vederlag.saerskilt_krav = event.data.saerskilt_krav.model_dump() if hasattr(event.data.saerskilt_krav, 'model_dump') else event.data.saerskilt_krav

        # Handle krever_justert_ep flag
        vederlag.krever_justert_ep = event.data.krever_justert_ep

        # Port 1: Varselinfo (VarselInfo objects serialized as dicts)
        if event.data.rigg_drift_varsel:
            vederlag.rigg_drift_varsel = event.data.rigg_drift_varsel.model_dump() if hasattr(event.data.rigg_drift_varsel, 'model_dump') else event.data.rigg_drift_varsel
        if event.data.justert_ep_varsel:
            vederlag.justert_ep_varsel = event.data.justert_ep_varsel.model_dump() if hasattr(event.data.justert_ep_varsel, 'model_dump') else event.data.justert_ep_varsel
        if event.data.regningsarbeid_varsel:
            vederlag.regningsarbeid_varsel = event.data.regningsarbeid_varsel.model_dump() if hasattr(event.data.regningsarbeid_varsel, 'model_dump') else event.data.regningsarbeid_varsel
        if event.data.produktivitetstap_varsel:
            vederlag.produktivitetstap_varsel = event.data.produktivitetstap_varsel.model_dump() if hasattr(event.data.produktivitetstap_varsel, 'model_dump') else event.data.produktivitetstap_varsel
        vederlag.krav_fremmet_dato = event.data.krav_fremmet_dato

        # Oppdater status
        if event.event_type == EventType.VEDERLAG_KRAV_SENDT:
            vederlag.status = SporStatus.SENDT
            vederlag.antall_versjoner = 1
        else:  # OPPDATERT
            vederlag.antall_versjoner += 1
            # Hvis det var avslått/under forhandling og TE oppdaterer
            if vederlag.status in {SporStatus.AVSLATT, SporStatus.UNDER_FORHANDLING, SporStatus.DELVIS_GODKJENT}:
                vederlag.status = SporStatus.SENDT

        # Metadata
        vederlag.siste_event_id = event.event_id
        vederlag.siste_oppdatert = event.tidsstempel

        state.vederlag = vederlag
        return state

    def _handle_vederlag_trukket(self, state: SakState, event: VederlagEvent) -> SakState:
        """Håndterer VEDERLAG_KRAV_TRUKKET"""
        state.vederlag.status = SporStatus.TRUKKET
        state.vederlag.siste_event_id = event.event_id
        state.vederlag.siste_oppdatert = event.tidsstempel
        return state

    # ============ FRIST HANDLERS ============

    def _handle_frist(self, state: SakState, event: FristEvent) -> SakState:
        """Håndterer FRIST_KRAV_SENDT og FRIST_KRAV_OPPDATERT"""
        frist = state.frist

        # Oppdater data
        frist.varsel_type = event.data.varsel_type.value if hasattr(event.data.varsel_type, 'value') else event.data.varsel_type

        # Extract dates from VarselInfo objects (new model structure)
        # VarselInfo has `dato_sendt` field, not `dato`
        if event.data.noytralt_varsel:
            frist.noytralt_varsel_dato = event.data.noytralt_varsel.dato_sendt
        if event.data.spesifisert_varsel:
            frist.spesifisert_krav_dato = event.data.spesifisert_varsel.dato_sendt

        frist.krevd_dager = event.data.antall_dager
        frist.begrunnelse = event.data.begrunnelse

        # Optional fields - use getattr for backwards compatibility
        frist.milepael_pavirket = getattr(event.data, 'fremdriftshindring_dokumentasjon', None)
        frist.fremdriftsanalyse_vedlagt = getattr(event.data, 'fremdriftsanalyse_vedlagt', None)

        # Oppdater status
        if event.event_type == EventType.FRIST_KRAV_SENDT:
            frist.status = SporStatus.SENDT
            frist.antall_versjoner = 1
        else:  # OPPDATERT
            frist.antall_versjoner += 1
            if frist.status in {SporStatus.AVSLATT, SporStatus.UNDER_FORHANDLING, SporStatus.DELVIS_GODKJENT}:
                frist.status = SporStatus.SENDT

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_frist_trukket(self, state: SakState, event: FristEvent) -> SakState:
        """Håndterer FRIST_KRAV_TRUKKET"""
        state.frist.status = SporStatus.TRUKKET
        state.frist.siste_event_id = event.event_id
        state.frist.siste_oppdatert = event.tidsstempel
        return state

    # ============ RESPONS HANDLERS (BH) ============

    def _handle_respons_grunnlag(self, state: SakState, event: ResponsEvent) -> SakState:
        """Håndterer RESPONS_GRUNNLAG fra BH"""
        grunnlag = state.grunnlag

        # Lagre BH respons
        grunnlag.bh_resultat = event.data.resultat
        grunnlag.bh_begrunnelse = event.data.begrunnelse

        # Map respons til status
        grunnlag.status = self._respons_til_status(event.data.resultat)

        # Hvis godkjent, lås grunnlaget
        if event.data.resultat == GrunnlagResponsResultat.GODKJENT:
            grunnlag.laast = True
            grunnlag.status = SporStatus.LAAST

        # Metadata
        grunnlag.siste_event_id = event.event_id
        grunnlag.siste_oppdatert = event.tidsstempel

        state.grunnlag = grunnlag
        return state

    def _handle_respons_vederlag(self, state: SakState, event: ResponsEvent) -> SakState:
        """
        Håndterer RESPONS_VEDERLAG fra BH.

        Denne handlerne extraherer både Port 1 (varsling) og Port 2 (beregning) data.
        """
        vederlag = state.vederlag

        # Port 1: Varselvurderinger
        if hasattr(event.data, 'saerskilt_varsel_rigg_drift_ok'):
            vederlag.saerskilt_varsel_rigg_drift_ok = event.data.saerskilt_varsel_rigg_drift_ok
        if hasattr(event.data, 'varsel_justert_ep_ok'):
            vederlag.varsel_justert_ep_ok = event.data.varsel_justert_ep_ok
        if hasattr(event.data, 'varsel_start_regning_ok'):
            vederlag.varsel_start_regning_ok = event.data.varsel_start_regning_ok
        if hasattr(event.data, 'krav_fremmet_i_tide'):
            vederlag.krav_fremmet_i_tide = event.data.krav_fremmet_i_tide
        if hasattr(event.data, 'begrunnelse_varsel'):
            vederlag.begrunnelse_varsel = event.data.begrunnelse_varsel

        # Port 2: Beregning
        if hasattr(event.data, 'beregnings_resultat'):
            vederlag.bh_resultat = event.data.beregnings_resultat
        if hasattr(event.data, 'begrunnelse_beregning'):
            vederlag.bh_begrunnelse = event.data.begrunnelse_beregning
        if hasattr(event.data, 'vederlagsmetode'):
            vederlag.bh_metode = event.data.vederlagsmetode.value if hasattr(event.data.vederlagsmetode, 'value') else event.data.vederlagsmetode
        # total_godkjent_belop er summen av alle vederlagstyper (hovedkrav + særskilte krav)
        if hasattr(event.data, 'total_godkjent_belop') and event.data.total_godkjent_belop is not None:
            vederlag.godkjent_belop = event.data.total_godkjent_belop

        # Subsidiært standpunkt (NYE linjer)
        if hasattr(event.data, 'subsidiaer_triggers') and event.data.subsidiaer_triggers:
            vederlag.subsidiaer_triggers = [t.value if hasattr(t, 'value') else t for t in event.data.subsidiaer_triggers]
        if hasattr(event.data, 'subsidiaer_resultat') and event.data.subsidiaer_resultat:
            vederlag.subsidiaer_resultat = event.data.subsidiaer_resultat
        if hasattr(event.data, 'subsidiaer_godkjent_belop') and event.data.subsidiaer_godkjent_belop is not None:
            vederlag.subsidiaer_godkjent_belop = event.data.subsidiaer_godkjent_belop
        if hasattr(event.data, 'subsidiaer_begrunnelse') and event.data.subsidiaer_begrunnelse:
            vederlag.subsidiaer_begrunnelse = event.data.subsidiaer_begrunnelse

        # Map beregnings_resultat til status
        if hasattr(event.data, 'beregnings_resultat'):
            vederlag.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)
        # Fallback for backward compatibility
        elif hasattr(event.data, 'resultat'):
            vederlag.status = self._respons_til_status(event.data.resultat)

        # Metadata
        vederlag.siste_event_id = event.event_id
        vederlag.siste_oppdatert = event.tidsstempel

        state.vederlag = vederlag
        return state

    def _handle_respons_frist(self, state: SakState, event: ResponsEvent) -> SakState:
        """
        Håndterer RESPONS_FRIST fra BH.

        Denne handlerne extraherer Port 1 (varsling), Port 2 (vilkår), og Port 3 (beregning) data.
        """
        frist = state.frist

        # Port 1: Varselvurderinger
        if hasattr(event.data, 'noytralt_varsel_ok'):
            frist.noytralt_varsel_ok = event.data.noytralt_varsel_ok
        if hasattr(event.data, 'spesifisert_krav_ok'):
            frist.spesifisert_krav_ok = event.data.spesifisert_krav_ok
        if hasattr(event.data, 'har_bh_etterlyst'):
            frist.har_bh_etterlyst = event.data.har_bh_etterlyst
        if hasattr(event.data, 'begrunnelse_varsel'):
            frist.begrunnelse_varsel = event.data.begrunnelse_varsel

        # Port 2: Vilkår (Årsakssammenheng)
        if hasattr(event.data, 'vilkar_oppfylt'):
            frist.vilkar_oppfylt = event.data.vilkar_oppfylt
        if hasattr(event.data, 'begrunnelse_vilkar'):
            frist.begrunnelse_vilkar = event.data.begrunnelse_vilkar

        # Port 3: Beregning
        if hasattr(event.data, 'beregnings_resultat'):
            frist.bh_resultat = event.data.beregnings_resultat
        if hasattr(event.data, 'begrunnelse_beregning'):
            frist.begrunnelse_beregning = event.data.begrunnelse_beregning
        if hasattr(event.data, 'godkjent_dager'):
            frist.godkjent_dager = event.data.godkjent_dager
        if hasattr(event.data, 'ny_sluttdato'):
            frist.ny_sluttdato = event.data.ny_sluttdato
        if hasattr(event.data, 'frist_for_spesifisering'):
            frist.frist_for_spesifisering = event.data.frist_for_spesifisering

        # Subsidiært standpunkt (NYE linjer)
        if hasattr(event.data, 'subsidiaer_triggers') and event.data.subsidiaer_triggers:
            frist.subsidiaer_triggers = [t.value if hasattr(t, 'value') else t for t in event.data.subsidiaer_triggers]
        if hasattr(event.data, 'subsidiaer_resultat') and event.data.subsidiaer_resultat:
            frist.subsidiaer_resultat = event.data.subsidiaer_resultat
        if hasattr(event.data, 'subsidiaer_godkjent_dager') and event.data.subsidiaer_godkjent_dager is not None:
            frist.subsidiaer_godkjent_dager = event.data.subsidiaer_godkjent_dager
        if hasattr(event.data, 'subsidiaer_begrunnelse') and event.data.subsidiaer_begrunnelse:
            frist.subsidiaer_begrunnelse = event.data.subsidiaer_begrunnelse

        # Også lagre gammel bh_begrunnelse for backward compatibility
        if hasattr(event.data, 'begrunnelse'):
            frist.bh_begrunnelse = event.data.begrunnelse

        # Map beregnings_resultat til status
        if hasattr(event.data, 'beregnings_resultat'):
            frist.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)
        # Fallback for backward compatibility
        elif hasattr(event.data, 'resultat'):
            frist.status = self._respons_til_status(event.data.resultat)

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_varsel(self, state: SakState, event: ForseringVarselEvent) -> SakState:
        """
        Håndterer FORSERING_VARSEL - TE varsler om forsering (§33.8).

        Når BH avslår fristkrav, kan TE varsle om at de vil iverksette forsering.
        """
        frist = state.frist

        # Opprett forsering-tilstand hvis den ikke finnes
        if frist.forsering is None:
            from models.sak_state import ForseringTilstand
            frist.forsering = ForseringTilstand()

        # Oppdater forsering-tilstand
        frist.forsering.er_varslet = True
        frist.forsering.dato_varslet = event.data.dato_iverksettelse
        frist.forsering.estimert_kostnad = event.data.estimert_kostnad
        frist.forsering.begrunnelse = event.data.begrunnelse
        frist.forsering.bekreft_30_prosent_regel = event.data.bekreft_30_prosent
        frist.forsering.er_iverksatt = True
        frist.forsering.dato_iverksatt = event.data.dato_iverksettelse

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_respons(self, state: SakState, event: ForseringResponsEvent) -> SakState:
        """
        Håndterer FORSERING_RESPONS - BH svarer på forsering (§33.8).

        BH aksepterer eller avviser TEs forseringsvarsel.
        """
        frist = state.frist

        # Opprett forsering-tilstand hvis den ikke finnes
        if frist.forsering is None:
            from models.sak_state import ForseringTilstand
            frist.forsering = ForseringTilstand()

        # Oppdater BH respons
        frist.forsering.bh_aksepterer_forsering = event.data.aksepterer
        frist.forsering.bh_godkjent_kostnad = event.data.godkjent_kostnad
        frist.forsering.bh_begrunnelse = event.data.begrunnelse

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_stoppet(self, state: SakState, event: ForseringStoppetEvent) -> SakState:
        """
        Håndterer FORSERING_STOPPET - TE stopper forsering (§33.8).

        TE stopper forseringen og rapporterer påløpte kostnader.
        """
        frist = state.frist

        # Opprett forsering-tilstand hvis den ikke finnes
        if frist.forsering is None:
            from models.sak_state import ForseringTilstand
            frist.forsering = ForseringTilstand()

        # Oppdater stopp-tilstand
        frist.forsering.er_stoppet = True
        frist.forsering.dato_stoppet = event.data.dato_stoppet
        if event.data.paalopte_kostnader is not None:
            frist.forsering.paalopte_kostnader = event.data.paalopte_kostnader

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_kostnader_oppdatert(self, state: SakState, event: ForseringKostnaderOppdatertEvent) -> SakState:
        """
        Håndterer FORSERING_KOSTNADER_OPPDATERT - TE oppdaterer påløpte kostnader (§33.8).

        TE kan oppdatere påløpte kostnader underveis i forseringen.
        """
        frist = state.frist

        # Opprett forsering-tilstand hvis den ikke finnes
        if frist.forsering is None:
            from models.sak_state import ForseringTilstand
            frist.forsering = ForseringTilstand()

        # Oppdater kostnader
        frist.forsering.paalopte_kostnader = event.data.paalopte_kostnader

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_koe_lagt_til(self, state: SakState, event: ForseringKoeHandlingEvent) -> SakState:
        """Håndterer FORSERING_KOE_LAGT_TIL - KOE legges til forseringssak.

        Oppdaterer avslatte_fristkrav listen i forsering_data.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_KOE_LAGT_TIL uten forsering_data - ignorerer")
            return state

        koe_sak_id = event.data.koe_sak_id

        # Unngå duplikater
        if koe_sak_id not in state.forsering_data.avslatte_fristkrav:
            state.forsering_data.avslatte_fristkrav.append(koe_sak_id)
            logger.info(f"KOE {koe_sak_id} lagt til forseringssak")
        else:
            logger.warning(f"KOE {koe_sak_id} er allerede i forseringssak")

        return state

    def _handle_forsering_koe_fjernet(self, state: SakState, event: ForseringKoeHandlingEvent) -> SakState:
        """Håndterer FORSERING_KOE_FJERNET - KOE fjernes fra forseringssak.

        Fjerner fra avslatte_fristkrav listen i forsering_data.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_KOE_FJERNET uten forsering_data - ignorerer")
            return state

        koe_sak_id = event.data.koe_sak_id

        if koe_sak_id in state.forsering_data.avslatte_fristkrav:
            state.forsering_data.avslatte_fristkrav.remove(koe_sak_id)
            logger.info(f"KOE {koe_sak_id} fjernet fra forseringssak")
        else:
            logger.warning(f"KOE {koe_sak_id} var ikke i forseringssak")

        return state

    def _handle_eo_utstedt(self, state: SakState, event: EOUtstedtEvent) -> SakState:
        """Håndterer EO_UTSTEDT - endringsordre utstedt.

        For ENDRINGSORDRE sakstype: Setter endringsordre_data fra eventet
        For STANDARD sakstype: Lukker alle spor (reaktiv EO fra KOE)
        """
        data = event.data

        # For ENDRINGSORDRE sakstype: Sett endringsordre_data
        if state.sakstype == SaksType.ENDRINGSORDRE:
            # Map EOKonsekvenser from event to state
            konsekvenser = EOKonsekvenser(
                sha=data.konsekvenser.sha if data.konsekvenser else False,
                kvalitet=data.konsekvenser.kvalitet if data.konsekvenser else False,
                fremdrift=data.konsekvenser.fremdrift if data.konsekvenser else False,
                pris=data.konsekvenser.pris if data.konsekvenser else False,
                annet=data.konsekvenser.annet if data.konsekvenser else False,
            )

            # Handle both relaterte_sak_ids and relaterte_koe_saker
            relaterte = data.relaterte_sak_ids or data.relaterte_koe_saker or []

            state.endringsordre_data = EndringsordreData(
                eo_nummer=data.eo_nummer,
                revisjon_nummer=data.revisjon_nummer,
                beskrivelse=data.beskrivelse,
                vedlegg_ids=data.vedlegg_ids or [],
                konsekvenser=konsekvenser,
                konsekvens_beskrivelse=data.konsekvens_beskrivelse,
                oppgjorsform=data.oppgjorsform,
                kompensasjon_belop=data.kompensasjon_belop,
                frist_dager=data.frist_dager,
                status=EOStatus.UTSTEDT,
                dato_utstedt=data.dato_utstedt or event.tidsstempel.strftime('%Y-%m-%d'),
                utstedt_av=event.aktor,
                relaterte_koe_saker=relaterte,
            )
            logger.info(f"EO {data.eo_nummer} utstedt med status UTSTEDT")
        else:
            # For STANDARD sakstype (reaktiv EO fra KOE): Lukk alle spor
            if state.grunnlag.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
                state.grunnlag.status = SporStatus.LAAST
                state.grunnlag.laast = True

            if state.vederlag.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
                state.vederlag.status = SporStatus.GODKJENT
                state.vederlag.godkjent_belop = data.kompensasjon_belop or event.endelig_vederlag

            if state.frist.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
                state.frist.status = SporStatus.GODKJENT
                if data.frist_dager or event.endelig_frist_dager:
                    state.frist.godkjent_dager = data.frist_dager or event.endelig_frist_dager

        return state

    def _handle_eo_akseptert(self, state: SakState, event: EOAkseptertEvent) -> SakState:
        """Håndterer EO_AKSEPTERT - TE aksepterer endringsordre.

        Oppdaterer endringsordre_data med TEs respons.
        """
        if state.endringsordre_data is None:
            logger.warning("Mottok EO_AKSEPTERT uten endringsordre_data - ignorerer")
            return state

        data = event.data

        # Oppdater TE-respons
        state.endringsordre_data.te_akseptert = data.akseptert
        state.endringsordre_data.te_kommentar = data.kommentar
        state.endringsordre_data.dato_te_respons = data.dato_aksept or event.tidsstempel.strftime('%Y-%m-%d')
        state.endringsordre_data.status = EOStatus.AKSEPTERT

        logger.info(f"EO {state.endringsordre_data.eo_nummer} akseptert av TE")

        return state

    def _handle_eo_koe_lagt_til(self, state: SakState, event: EOKoeHandlingEvent) -> SakState:
        """Håndterer EO_KOE_LAGT_TIL - KOE legges til endringsordre.

        Oppdaterer relaterte_koe_saker listen i endringsordre_data.
        """
        if state.endringsordre_data is None:
            logger.warning("Mottok EO_KOE_LAGT_TIL uten endringsordre_data - ignorerer")
            return state

        koe_sak_id = event.data.koe_sak_id

        # Unngå duplikater
        if koe_sak_id not in state.endringsordre_data.relaterte_koe_saker:
            state.endringsordre_data.relaterte_koe_saker.append(koe_sak_id)
            logger.info(f"KOE {koe_sak_id} lagt til EO {state.endringsordre_data.eo_nummer}")
        else:
            logger.warning(f"KOE {koe_sak_id} er allerede i EO {state.endringsordre_data.eo_nummer}")

        return state

    def _handle_eo_koe_fjernet(self, state: SakState, event: EOKoeHandlingEvent) -> SakState:
        """Håndterer EO_KOE_FJERNET - KOE fjernes fra endringsordre.

        Fjerner fra relaterte_koe_saker listen i endringsordre_data.
        """
        if state.endringsordre_data is None:
            logger.warning("Mottok EO_KOE_FJERNET uten endringsordre_data - ignorerer")
            return state

        koe_sak_id = event.data.koe_sak_id

        if koe_sak_id in state.endringsordre_data.relaterte_koe_saker:
            state.endringsordre_data.relaterte_koe_saker.remove(koe_sak_id)
            logger.info(f"KOE {koe_sak_id} fjernet fra EO {state.endringsordre_data.eo_nummer}")
        else:
            logger.warning(f"KOE {koe_sak_id} var ikke i EO {state.endringsordre_data.eo_nummer}")

        return state

    def _handle_eo_bestridt(self, state: SakState, event: EOBestridtEvent) -> SakState:
        """Håndterer EO_BESTRIDT - TE bestrider endringsordre.

        Oppdaterer status til BESTRIDT og lagrer TEs begrunnelse.
        """
        if state.endringsordre_data is None:
            logger.warning("Mottok EO_BESTRIDT uten endringsordre_data - ignorerer")
            return state

        data = event.data

        # Oppdater status og begrunnelse
        state.endringsordre_data.status = EOStatus.BESTRIDT
        state.endringsordre_data.te_akseptert = False
        state.endringsordre_data.te_kommentar = data.begrunnelse
        state.endringsordre_data.dato_te_respons = event.tidsstempel.strftime('%Y-%m-%d')

        logger.info(f"EO {state.endringsordre_data.eo_nummer} bestridt av TE")

        return state

    def _handle_eo_revidert(self, state: SakState, event: EORevidertEvent) -> SakState:
        """Håndterer EO_REVIDERT - BH reviderer endringsordre etter bestridelse.

        Oppdaterer revisjonsnummer og eventuelt andre felt.
        """
        if state.endringsordre_data is None:
            logger.warning("Mottok EO_REVIDERT uten endringsordre_data - ignorerer")
            return state

        data = event.data

        # Oppdater revisjonsnummer og status
        state.endringsordre_data.revisjon_nummer = data.ny_revisjon_nummer
        state.endringsordre_data.status = EOStatus.REVIDERT

        # Nullstill TE-respons (må vurderes på nytt)
        state.endringsordre_data.te_akseptert = None
        state.endringsordre_data.te_kommentar = None
        state.endringsordre_data.dato_te_respons = None

        # Oppdater data hvis ny data er gitt
        if data.oppdatert_data:
            oppdatert = data.oppdatert_data
            if oppdatert.beskrivelse:
                state.endringsordre_data.beskrivelse = oppdatert.beskrivelse
            if oppdatert.kompensasjon_belop is not None:
                state.endringsordre_data.kompensasjon_belop = oppdatert.kompensasjon_belop
            if oppdatert.fradrag_belop is not None:
                state.endringsordre_data.fradrag_belop = oppdatert.fradrag_belop
            if oppdatert.frist_dager is not None:
                state.endringsordre_data.frist_dager = oppdatert.frist_dager
            if oppdatert.ny_sluttdato:
                state.endringsordre_data.ny_sluttdato = oppdatert.ny_sluttdato

        logger.info(f"EO {state.endringsordre_data.eo_nummer} revidert til rev. {data.ny_revisjon_nummer}")

        return state

    # ============ HELPERS ============

    def _respons_til_status(self, resultat: GrunnlagResponsResultat) -> SporStatus:
        """Mapper GrunnlagResponsResultat til SporStatus"""
        mapping = {
            GrunnlagResponsResultat.GODKJENT: SporStatus.GODKJENT,
            GrunnlagResponsResultat.DELVIS_GODKJENT: SporStatus.DELVIS_GODKJENT,
            GrunnlagResponsResultat.AVSLATT: SporStatus.AVSLATT,
            GrunnlagResponsResultat.ERKJENN_FM: SporStatus.GODKJENT,  # Force Majeure erkjent
            GrunnlagResponsResultat.FRAFALT: SporStatus.TRUKKET,  # Pålegg frafalt
            GrunnlagResponsResultat.KREVER_AVKLARING: SporStatus.UNDER_FORHANDLING,
        }
        return mapping.get(resultat, SporStatus.UNDER_BEHANDLING)

    def _beregnings_resultat_til_status(self, resultat) -> SporStatus:
        """
        Mapper VederlagBeregningResultat eller FristBeregningResultat til SporStatus.

        VIKTIG: Dette mapper KUN beregningsresultatet, ikke grunnlag.
        Kombinasjonen av grunnlag + beregning håndteres av computed fields i SakState.
        """
        from models.events import VederlagBeregningResultat, FristBeregningResultat

        # Felles mapping for både vederlag og frist
        if hasattr(resultat, 'value'):
            resultat_value = resultat.value
        else:
            resultat_value = str(resultat)

        # Map til status (forenklede statuskoder)
        if resultat_value == 'godkjent':
            return SporStatus.GODKJENT
        elif resultat_value == 'delvis_godkjent':
            return SporStatus.DELVIS_GODKJENT
        elif resultat_value == 'avslatt':
            return SporStatus.AVSLATT
        else:
            return SporStatus.UNDER_BEHANDLING

    # ============ CONVENIENCE METHODS ============

    def compute_oversikt(self, events: List[AnyEvent]) -> SakOversikt:
        """
        Beregner forenklet oversikt for listevisning.

        Mer effektiv enn full compute_state() for listevisninger.
        """
        state = self.compute_state(events)

        # Bygg spor-oversikter
        spor_oversikter = []

        if state.grunnlag.status != SporStatus.IKKE_RELEVANT:
            spor_oversikter.append(SporOversikt(
                spor=SporType.GRUNNLAG,
                status=state.grunnlag.status,
                siste_aktivitet=state.grunnlag.siste_oppdatert,
                verdi_krevd=state.grunnlag.hovedkategori,
                verdi_godkjent="Godkjent" if state.grunnlag.laast else None,
            ))

        if state.vederlag.status != SporStatus.IKKE_RELEVANT:
            # Calculate krevd value from belop_direkte or kostnads_overslag
            krevd_belop = state.vederlag.belop_direkte or state.vederlag.kostnads_overslag
            spor_oversikter.append(SporOversikt(
                spor=SporType.VEDERLAG,
                status=state.vederlag.status,
                siste_aktivitet=state.vederlag.siste_oppdatert,
                verdi_krevd=f"{krevd_belop:,.0f} NOK" if krevd_belop else None,
                verdi_godkjent=f"{state.vederlag.godkjent_belop:,.0f} NOK" if state.vederlag.godkjent_belop else None,
            ))

        if state.frist.status != SporStatus.IKKE_RELEVANT:
            spor_oversikter.append(SporOversikt(
                spor=SporType.FRIST,
                status=state.frist.status,
                siste_aktivitet=state.frist.siste_oppdatert,
                verdi_krevd=f"{state.frist.krevd_dager} dager" if state.frist.krevd_dager else None,
                verdi_godkjent=f"{state.frist.godkjent_dager} dager" if state.frist.godkjent_dager else None,
            ))

        return SakOversikt(
            sak_id=state.sak_id,
            sakstittel=state.sakstittel,
            overordnet_status=state.overordnet_status,
            spor=spor_oversikter,
            sum_krevd=state.sum_krevd,
            sum_godkjent=state.sum_godkjent,
            dager_krevd=state.frist.krevd_dager,
            dager_godkjent=state.frist.godkjent_dager,
            opprettet=state.opprettet,
            siste_aktivitet=state.siste_aktivitet,
            neste_handling_rolle=state.neste_handling.get("rolle"),
            te_navn=state.te_navn,
            prosjekt_navn=state.prosjekt_navn,
        )

    def get_timeline(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
        """
        Returnerer events formatert som tidslinje for UI.

        Hvert element inneholder:
        - event_id
        - tidsstempel
        - type (lesbar tekst)
        - event_type (maskinlesbar enum-verdi)
        - aktor/rolle
        - spor (hvis relevant)
        - sammendrag (kort beskrivelse)
        - event_data (full skjemadata, hvis tilgjengelig)
        """
        timeline = []
        for event in sorted(events, key=lambda e: e.tidsstempel, reverse=True):
            entry = {
                "event_id": event.event_id,
                "tidsstempel": event.tidsstempel.isoformat(),
                "type": self._event_type_to_label(event.event_type),
                "event_type": event.event_type.value,  # Machine-readable type
                "aktor": event.aktor,
                "rolle": event.aktor_rolle,
                "spor": self._get_spor_for_event(event),
                "sammendrag": self._get_event_summary(event),
                "event_data": self._serialize_event_data(event),  # Full form data
            }
            timeline.append(entry)
        return timeline

    def _serialize_event_data(self, event: AnyEvent) -> Optional[Dict[str, Any]]:
        """
        Serialize event data for frontend consumption.

        Handles different event types and their data structures.
        Returns None for events without data (e.g., sak_opprettet).
        """
        # SakOpprettetEvent - return basic sak info
        if isinstance(event, SakOpprettetEvent):
            return {
                "sakstittel": event.sakstittel,
                "catenda_topic_id": event.catenda_topic_id,
            }

        # EOUtstedtEvent - return EO details
        if isinstance(event, EOUtstedtEvent):
            return {
                "eo_nummer": event.eo_nummer,
                "endelig_vederlag": event.endelig_vederlag,
                "endelig_frist_dager": event.endelig_frist_dager,
            }

        # ForseringVarselEvent - return forsering data
        if isinstance(event, ForseringVarselEvent):
            if hasattr(event, 'data') and event.data is not None:
                try:
                    if hasattr(event.data, 'model_dump'):
                        return event.data.model_dump(mode='json')
                    elif hasattr(event.data, 'dict'):
                        return event.data.dict()
                except Exception as e:
                    logger.warning(f"Failed to serialize ForseringVarselEvent data: {e}")
            return None

        # Events with data attribute (GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent)
        if hasattr(event, 'data') and event.data is not None:
            try:
                if hasattr(event.data, 'model_dump'):
                    # Pydantic v2
                    return event.data.model_dump(mode='json')
                elif hasattr(event.data, 'dict'):
                    # Pydantic v1
                    return event.data.dict()
            except Exception as e:
                logger.warning(f"Failed to serialize event data: {e}")

        return None

    def _event_type_to_label(self, event_type: EventType) -> str:
        """Konverterer event-type til lesbar label"""
        labels = {
            EventType.SAK_OPPRETTET: "Sak opprettet",
            EventType.GRUNNLAG_OPPRETTET: "Grunnlag sendt",
            EventType.GRUNNLAG_OPPDATERT: "Grunnlag oppdatert",
            EventType.GRUNNLAG_TRUKKET: "Grunnlag trukket",
            EventType.VEDERLAG_KRAV_SENDT: "Vederlagskrav sendt",
            EventType.VEDERLAG_KRAV_OPPDATERT: "Vederlagskrav oppdatert",
            EventType.VEDERLAG_KRAV_TRUKKET: "Vederlagskrav trukket",
            EventType.FRIST_KRAV_SENDT: "Fristkrav sendt",
            EventType.FRIST_KRAV_OPPDATERT: "Fristkrav oppdatert",
            EventType.FRIST_KRAV_SPESIFISERT: "Fristkrav spesifisert",
            EventType.FRIST_KRAV_TRUKKET: "Fristkrav trukket",
            EventType.RESPONS_GRUNNLAG: "BH svarte på grunnlag",
            EventType.RESPONS_GRUNNLAG_OPPDATERT: "BH oppdaterte svar på grunnlag",
            EventType.RESPONS_VEDERLAG: "BH svarte på vederlag",
            EventType.RESPONS_VEDERLAG_OPPDATERT: "BH oppdaterte svar på vederlag",
            EventType.RESPONS_FRIST: "BH svarte på frist",
            EventType.RESPONS_FRIST_OPPDATERT: "BH oppdaterte svar på frist",
            EventType.FORSERING_VARSEL: "Varsel om forsering (§33.8)",
            EventType.FORSERING_RESPONS: "BH svarte på forsering (§33.8)",
            EventType.FORSERING_STOPPET: "Forsering stoppet (§33.8)",
            EventType.FORSERING_KOSTNADER_OPPDATERT: "Forseringskostnader oppdatert",
            EventType.EO_UTSTEDT: "Endringsordre utstedt",
        }
        return labels.get(event_type, str(event_type))

    def _get_spor_for_event(self, event: AnyEvent) -> Optional[str]:
        """Returnerer hvilket spor eventen tilhører"""
        if isinstance(event, GrunnlagEvent):
            return "grunnlag"
        elif isinstance(event, VederlagEvent):
            return "vederlag"
        elif isinstance(event, FristEvent):
            return "frist"
        elif isinstance(event, (ForseringVarselEvent, ForseringResponsEvent, ForseringStoppetEvent, ForseringKostnaderOppdatertEvent)):
            return "frist"  # Forsering hører til frist-sporet
        elif isinstance(event, ResponsEvent):
            return event.spor.value
        return None

    def _get_event_summary(self, event: AnyEvent) -> str:
        """Genererer kort sammendrag av eventen"""
        if isinstance(event, GrunnlagEvent):
            from constants.grunnlag_categories import get_grunnlag_sammendrag
            return get_grunnlag_sammendrag(event.data.hovedkategori, event.data.underkategori)
        elif isinstance(event, VederlagEvent):
            belop = event.data.belop_direkte or event.data.kostnads_overslag or 0
            return f"Krav: {belop:,.0f} NOK"
        elif isinstance(event, FristEvent):
            return f"Krav: {event.data.antall_dager} dager"
        elif isinstance(event, ForseringVarselEvent):
            return f"Forsering: {event.data.estimert_kostnad:,.0f} NOK"
        elif isinstance(event, ResponsEvent):
            return self._get_respons_summary(event)
        elif isinstance(event, SakOpprettetEvent):
            return event.sakstittel
        elif isinstance(event, EOUtstedtEvent):
            return f"EO-{event.eo_nummer}: {event.endelig_vederlag:,.0f} NOK"
        return ""

    def _get_respons_summary(self, event: ResponsEvent) -> str:
        """Genererer lesbart sammendrag for ResponsEvent"""
        # Map resultat til lesbar tekst
        resultat_labels = {
            'godkjent': 'Godkjent',
            'delvis_godkjent': 'Delvis godkjent',
            'erkjenn_fm': 'Force Majeure erkjent',
            'avslatt': 'Avslått',
            'frafalt': 'Pålegg frafalt',
            'krever_avklaring': 'Krever avklaring',
        }

        # Handle different result field names for different response types
        if hasattr(event.data, 'resultat'):
            resultat_value = event.data.resultat.value if hasattr(event.data.resultat, 'value') else str(event.data.resultat)
        elif hasattr(event.data, 'beregnings_resultat'):
            resultat_value = event.data.beregnings_resultat.value if hasattr(event.data.beregnings_resultat, 'value') else str(event.data.beregnings_resultat)
        else:
            resultat_value = 'ukjent'

        resultat_label = resultat_labels.get(resultat_value, resultat_value)

        # Legg til beløp/dager hvis tilgjengelig
        if event.spor == SporType.VEDERLAG:
            if hasattr(event.data, 'total_godkjent_belop') and event.data.total_godkjent_belop:
                return f"{resultat_label}: {event.data.total_godkjent_belop:,.0f} kr"
        elif event.spor == SporType.FRIST:
            if hasattr(event.data, 'godkjent_dager') and event.data.godkjent_dager:
                return f"{resultat_label}: {event.data.godkjent_dager} dager"

        return resultat_label

    # ============ REVISJONSHISTORIKK ============

    def get_vederlag_historikk(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
        """
        Bygger revisjonshistorikk for vederlag fra events.

        Returnerer en kronologisk liste med alle versjoner av vederlagskravet
        og BH-responser, med versjonsnummer for hver TE-revisjon.
        """
        from models.api_responses import VederlagHistorikkEntry, AktorInfo

        historikk = []
        te_versjon = 0  # Teller for TE-revisjoner

        # Filtrer og sorter vederlag-relaterte events
        vederlag_events = [
            e for e in events
            if e.event_type in {
                EventType.VEDERLAG_KRAV_SENDT,
                EventType.VEDERLAG_KRAV_OPPDATERT,
                EventType.VEDERLAG_KRAV_TRUKKET,
                EventType.RESPONS_VEDERLAG,
                EventType.RESPONS_VEDERLAG_OPPDATERT,
            }
        ]
        vederlag_events.sort(key=lambda e: e.tidsstempel)

        for event in vederlag_events:
            aktor_info = AktorInfo(
                navn=event.aktor,
                rolle=event.aktor_rolle,
                tidsstempel=event.tidsstempel,
            )

            if event.event_type == EventType.VEDERLAG_KRAV_SENDT:
                te_versjon = 1
                entry = VederlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="sendt",
                    event_id=event.event_id,
                    krav_belop=self._get_vederlag_belop(event),
                    metode=event.data.metode.value if event.data.metode else None,
                    metode_label=self._get_metode_label(event.data.metode) if event.data.metode else None,
                    begrunnelse=event.data.begrunnelse,
                    inkluderer_rigg_drift=bool(event.data.saerskilt_krav and event.data.saerskilt_krav.rigg_drift),
                    inkluderer_produktivitet=bool(event.data.saerskilt_krav and event.data.saerskilt_krav.produktivitet),
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.VEDERLAG_KRAV_OPPDATERT:
                te_versjon += 1
                entry = VederlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="oppdatert",
                    event_id=event.event_id,
                    krav_belop=self._get_vederlag_belop(event),
                    metode=event.data.metode.value if event.data.metode else None,
                    metode_label=self._get_metode_label(event.data.metode) if event.data.metode else None,
                    begrunnelse=event.data.begrunnelse,
                    inkluderer_rigg_drift=bool(event.data.saerskilt_krav and event.data.saerskilt_krav.rigg_drift),
                    inkluderer_produktivitet=bool(event.data.saerskilt_krav and event.data.saerskilt_krav.produktivitet),
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.VEDERLAG_KRAV_TRUKKET:
                entry = VederlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="trukket",
                    event_id=event.event_id,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_VEDERLAG:
                entry = VederlagHistorikkEntry(
                    versjon=te_versjon,  # Refererer til hvilken TE-versjon den svarer på
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons",
                    event_id=event.event_id,
                    bh_resultat=event.data.beregnings_resultat.value if event.data.beregnings_resultat else None,
                    bh_resultat_label=self._get_vederlag_resultat_label(event.data.beregnings_resultat),
                    godkjent_belop=event.data.total_godkjent_belop,
                    bh_begrunnelse=event.data.begrunnelse_beregning,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_VEDERLAG_OPPDATERT:
                entry = VederlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons_oppdatert",
                    event_id=event.event_id,
                    bh_resultat=event.data.beregnings_resultat.value if event.data.beregnings_resultat else None,
                    bh_resultat_label=self._get_vederlag_resultat_label(event.data.beregnings_resultat),
                    godkjent_belop=event.data.total_godkjent_belop,
                    bh_begrunnelse=event.data.begrunnelse_beregning,
                )
                historikk.append(entry.model_dump(mode='json'))

        return historikk

    def get_frist_historikk(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
        """
        Bygger revisjonshistorikk for frist fra events.

        Returnerer en kronologisk liste med alle versjoner av fristkravet
        og BH-responser, med versjonsnummer for hver TE-revisjon.
        """
        from models.api_responses import FristHistorikkEntry, AktorInfo

        historikk = []
        te_versjon = 0  # Teller for TE-revisjoner

        # Filtrer og sorter frist-relaterte events
        frist_events = [
            e for e in events
            if e.event_type in {
                EventType.FRIST_KRAV_SENDT,
                EventType.FRIST_KRAV_OPPDATERT,
                EventType.FRIST_KRAV_SPESIFISERT,
                EventType.FRIST_KRAV_TRUKKET,
                EventType.RESPONS_FRIST,
                EventType.RESPONS_FRIST_OPPDATERT,
            }
        ]
        frist_events.sort(key=lambda e: e.tidsstempel)

        for event in frist_events:
            aktor_info = AktorInfo(
                navn=event.aktor,
                rolle=event.aktor_rolle,
                tidsstempel=event.tidsstempel,
            )

            if event.event_type == EventType.FRIST_KRAV_SENDT:
                te_versjon = 1
                entry = FristHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="sendt",
                    event_id=event.event_id,
                    krav_dager=event.data.antall_dager,
                    varsel_type=event.data.varsel_type.value if event.data.varsel_type else None,
                    varsel_type_label=self._get_frist_varseltype_label(event.data.varsel_type),
                    begrunnelse=event.data.begrunnelse,
                    ny_sluttdato=event.data.ny_sluttdato,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.FRIST_KRAV_OPPDATERT:
                te_versjon += 1
                entry = FristHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="oppdatert",
                    event_id=event.event_id,
                    krav_dager=event.data.antall_dager,
                    varsel_type=event.data.varsel_type.value if event.data.varsel_type else None,
                    varsel_type_label=self._get_frist_varseltype_label(event.data.varsel_type),
                    begrunnelse=event.data.begrunnelse,
                    ny_sluttdato=event.data.ny_sluttdato,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.FRIST_KRAV_SPESIFISERT:
                te_versjon += 1
                entry = FristHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="spesifisert",  # Upgraded from neutral to specified
                    event_id=event.event_id,
                    krav_dager=event.data.antall_dager,
                    varsel_type="spesifisert",  # Now specified
                    varsel_type_label="Spesifisert krav (§33.6)",
                    begrunnelse=event.data.begrunnelse,
                    ny_sluttdato=event.data.ny_sluttdato,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.FRIST_KRAV_TRUKKET:
                entry = FristHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="trukket",
                    event_id=event.event_id,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_FRIST:
                entry = FristHistorikkEntry(
                    versjon=te_versjon,  # Refererer til hvilken TE-versjon den svarer på
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons",
                    event_id=event.event_id,
                    bh_resultat=event.data.beregnings_resultat.value if event.data.beregnings_resultat else None,
                    bh_resultat_label=self._get_frist_resultat_label(event.data.beregnings_resultat),
                    godkjent_dager=event.data.godkjent_dager,
                    bh_begrunnelse=event.data.begrunnelse_vilkar,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_FRIST_OPPDATERT:
                entry = FristHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons_oppdatert",
                    event_id=event.event_id,
                    bh_resultat=event.data.beregnings_resultat.value if event.data.beregnings_resultat else None,
                    bh_resultat_label=self._get_frist_resultat_label(event.data.beregnings_resultat),
                    godkjent_dager=event.data.godkjent_dager,
                    bh_begrunnelse=event.data.begrunnelse_vilkar,
                )
                historikk.append(entry.model_dump(mode='json'))

        return historikk

    def _get_vederlag_belop(self, event: VederlagEvent) -> Optional[float]:
        """Hent krevd beløp basert på metode."""
        if event.data.metode and event.data.metode.value == 'REGNINGSARBEID':
            return event.data.kostnads_overslag
        return event.data.belop_direkte

    def _get_metode_label(self, metode) -> str:
        """Konverter metode-enum til lesbar label."""
        labels = {
            'ENHETSPRISER': 'Enhetspriser (§34.3)',
            'REGNINGSARBEID': 'Regningsarbeid (§30.2/§34.4)',
            'FASTPRIS_TILBUD': 'Fastpris/Tilbud (§34.2.1)',
        }
        return labels.get(metode.value if hasattr(metode, 'value') else metode, str(metode))

    def _get_vederlag_resultat_label(self, resultat) -> Optional[str]:
        """Konverter vederlag-resultat til lesbar label."""
        if not resultat:
            return None
        labels = {
            'godkjent': 'Godkjent',
            'delvis_godkjent': 'Delvis godkjent',
            'avslatt': 'Avslått',
            'hold_tilbake': 'Holdes tilbake (§30.2)',
        }
        return labels.get(resultat.value if hasattr(resultat, 'value') else resultat, str(resultat))

    def _get_frist_varseltype_label(self, varsel_type) -> Optional[str]:
        """Konverter varseltype til lesbar label."""
        if not varsel_type:
            return None
        labels = {
            'noytralt': 'Nøytralt varsel (§33.4)',
            'spesifisert': 'Spesifisert krav (§33.6)',
            'begge': 'Nøytralt + Spesifisert',
            'force_majeure': 'Force Majeure (§33.3)',
        }
        return labels.get(varsel_type.value if hasattr(varsel_type, 'value') else varsel_type, str(varsel_type))

    def _get_frist_resultat_label(self, resultat) -> Optional[str]:
        """Konverter frist-resultat til lesbar label."""
        if not resultat:
            return None
        labels = {
            'godkjent': 'Godkjent',
            'delvis_godkjent': 'Delvis godkjent',
            'avslatt': 'Avslått',
        }
        return labels.get(resultat.value if hasattr(resultat, 'value') else resultat, str(resultat))


# ============ MIGRATION HELPER ============

class MigrationHelper:
    """
    Hjelpeklasse for å migrere fra gammel til ny modell.

    Konverterer Varsel + KoeRevisjon + BHSvarRevisjon til events.
    """

    def __init__(self):
        self.timeline_service = TimelineService()

    def migrate_sak(
        self,
        sak_data: Dict[str, Any],
        varsel_data: Dict[str, Any],
        koe_revisjoner: List[Dict[str, Any]],
        bh_svar_revisjoner: List[Dict[str, Any]],
    ) -> List[AnyEvent]:
        """
        Migrerer en gammel sak til event-format.

        Args:
            sak_data: Gammel Sak-dict
            varsel_data: Gammel Varsel-dict
            koe_revisjoner: Liste med KoeRevisjon-dicts
            bh_svar_revisjoner: Liste med BHSvarRevisjon-dicts

        Returns:
            Liste med events som representerer sakens historikk
        """
        from models.events import (
            GrunnlagData, VederlagData, FristData,
            GrunnlagResponsData, VederlagResponsData, FristResponsData,
        )

        events: List[AnyEvent] = []
        sak_id = sak_data.get('sak_id', '')

        # 1. Opprett sak-event
        sak_event = SakOpprettetEvent(
            sak_id=sak_id,
            sakstittel=sak_data.get('sakstittel', ''),
            aktor=sak_data.get('opprettet_av', 'System'),
            aktor_rolle='TE',
            catenda_topic_id=sak_data.get('catenda_topic_id'),
        )
        events.append(sak_event)

        # 2. Konverter Varsel til GrunnlagEvent
        if varsel_data:
            grunnlag_event = GrunnlagEvent(
                sak_id=sak_id,
                event_type=EventType.GRUNNLAG_OPPRETTET,
                aktor=sak_data.get('opprettet_av', 'System'),
                aktor_rolle='TE',
                data=GrunnlagData(
                    hovedkategori=varsel_data.get('hovedkategori', ''),
                    underkategori=varsel_data.get('underkategori', ''),
                    beskrivelse=varsel_data.get('varsel_beskrivelse', ''),
                    dato_oppdaget=varsel_data.get('dato_forhold_oppdaget', ''),
                ),
            )
            events.append(grunnlag_event)

        # 3. Konverter KoeRevisjoner til Vederlag/Frist events
        for i, koe in enumerate(koe_revisjoner):
            vederlag_info = koe.get('vederlag', {})
            frist_info = koe.get('frist', {})

            # Vederlag-event hvis det er krav
            if vederlag_info.get('krav_vederlag'):
                belop_str = vederlag_info.get('krav_vederlag_belop', '0')
                try:
                    belop = float(belop_str.replace(' ', '').replace(',', '.'))
                except ValueError:
                    belop = 0.0

                vederlag_event = VederlagEvent(
                    sak_id=sak_id,
                    event_type=EventType.VEDERLAG_KRAV_SENDT if i == 0 else EventType.VEDERLAG_KRAV_OPPDATERT,
                    aktor=koe.get('for_entreprenor', 'System'),
                    aktor_rolle='TE',
                    versjon=i + 1,
                    data=VederlagData(
                        krav_belop=belop,
                        metode=vederlag_info.get('krav_vederlag_metode', ''),
                        begrunnelse=vederlag_info.get('krav_vederlag_begrunnelse', ''),
                        inkluderer_produktivitetstap=vederlag_info.get('krav_produktivitetstap', False),
                        inkluderer_rigg_drift=vederlag_info.get('saerskilt_varsel_rigg_drift', False),
                    ),
                )
                events.append(vederlag_event)

            # Frist-event hvis det er krav
            if frist_info.get('krav_fristforlengelse'):
                dager_str = frist_info.get('krav_frist_antall_dager', '0')
                try:
                    dager = int(dager_str)
                except ValueError:
                    dager = 0

                frist_event = FristEvent(
                    sak_id=sak_id,
                    event_type=EventType.FRIST_KRAV_SENDT if i == 0 else EventType.FRIST_KRAV_OPPDATERT,
                    aktor=koe.get('for_entreprenor', 'System'),
                    aktor_rolle='TE',
                    versjon=i + 1,
                    data=FristData(
                        antall_dager=dager,
                        begrunnelse=frist_info.get('krav_frist_begrunnelse', ''),
                    ),
                )
                events.append(frist_event)

        # 4. Konverter BHSvarRevisjoner til ResponsEvents
        for bh_svar in bh_svar_revisjoner:
            vederlag_svar = bh_svar.get('vederlag', {})
            frist_svar = bh_svar.get('frist', {})
            sign = bh_svar.get('sign', {})

            # Vederlag-respons
            if vederlag_svar.get('bh_svar_vederlag'):
                belop_str = vederlag_svar.get('bh_godkjent_vederlag_belop', '0')
                try:
                    godkjent_belop = float(belop_str.replace(' ', '').replace(',', '.'))
                except ValueError:
                    godkjent_belop = None

                respons_event = ResponsEvent(
                    sak_id=sak_id,
                    event_type=EventType.RESPONS_VEDERLAG,
                    aktor=sign.get('for_byggherre', 'System'),
                    aktor_rolle='BH',
                    spor=SporType.VEDERLAG,
                    data=VederlagResponsData(
                        beregnings_resultat=self._map_bh_svar_to_resultat(vederlag_svar.get('bh_svar_vederlag', '')),
                        begrunnelse=vederlag_svar.get('bh_begrunnelse_vederlag', ''),
                        total_godkjent_belop=godkjent_belop,
                        vederlagsmetode=vederlag_svar.get('bh_vederlag_metode'),
                    ),
                )
                events.append(respons_event)

            # Frist-respons
            if frist_svar.get('bh_svar_frist'):
                dager_str = frist_svar.get('bh_godkjent_frist_dager', '0')
                try:
                    godkjent_dager = int(dager_str)
                except ValueError:
                    godkjent_dager = None

                respons_event = ResponsEvent(
                    sak_id=sak_id,
                    event_type=EventType.RESPONS_FRIST,
                    aktor=sign.get('for_byggherre', 'System'),
                    aktor_rolle='BH',
                    spor=SporType.FRIST,
                    data=FristResponsData(
                        resultat=self._map_bh_svar_to_resultat(frist_svar.get('bh_svar_frist', '')),
                        begrunnelse=frist_svar.get('bh_begrunnelse_frist', ''),
                        godkjent_dager=godkjent_dager,
                        ny_sluttdato=frist_svar.get('bh_frist_for_spesifisering'),
                    ),
                )
                events.append(respons_event)

        return events

    def _map_bh_svar_to_resultat(self, svar_kode: str) -> GrunnlagResponsResultat:
        """Mapper gammel BH svar-kode til GrunnlagResponsResultat"""
        # Fra generated_constants.py
        # NB: avslått_for_sent er fjernet - preklusjon håndteres nå via
        # subsidiær_triggers på vederlag/frist-nivå, ikke på grunnlag
        mapping = {
            '100000000': GrunnlagResponsResultat.GODKJENT,           # GODKJENT_FULLT
            '100000001': GrunnlagResponsResultat.DELVIS_GODKJENT,    # DELVIS_GODKJENT
            '100000002': GrunnlagResponsResultat.AVSLATT,            # AVSLÅTT_UENIG
            '100000003': GrunnlagResponsResultat.AVSLATT,            # AVSLÅTT_FOR_SENT -> nå AVSLATT
            '100000004': GrunnlagResponsResultat.KREVER_AVKLARING,   # AVVENTER
            '100000005': GrunnlagResponsResultat.GODKJENT,           # GODKJENT_ANNEN_METODE
        }
        return mapping.get(svar_kode, GrunnlagResponsResultat.KREVER_AVKLARING)
