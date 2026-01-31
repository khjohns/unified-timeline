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

from models.events import (
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
    ForseringBHRespons,
)
from utils.logger import get_logger

logger = get_logger(__name__)


# ============================================================================
# Shared helper functions (reduces cyclomatic complexity)
# ============================================================================

def _copy_fields_if_present(
    source: Any,
    target: Any,
    fields: List[str],
    require_truthy: bool = False
) -> None:
    """
    Copy fields from source to target if they exist on source.

    This helper reduces repetitive hasattr/setattr patterns in event handlers.

    Args:
        source: Source object to copy from (e.g., event.data)
        target: Target object to copy to (e.g., state.vederlag)
        fields: List of field names to copy
        require_truthy: If True, only copy if value is truthy (not None/empty)

    Example:
        _copy_fields_if_present(event.data, vederlag, [
            'saerskilt_varsel_rigg_drift_ok',
            'varsel_justert_ep_ok',
        ])
    """
    for field in fields:
        if hasattr(source, field):
            value = getattr(source, field)
            if require_truthy:
                if value:
                    setattr(target, field, value)
            else:
                if value is not None:
                    setattr(target, field, value)


def _build_state_konsekvenser(data_konsekvenser: Any) -> 'EOKonsekvenser':
    """
    Build EOKonsekvenser for state from event data.

    Safely extracts konsekvenser fields with None-safe access.
    Returns a new EOKonsekvenser with all fields defaulting to False
    if the source is None.

    Args:
        data_konsekvenser: EOKonsekvenser from event data, may be None

    Returns:
        EOKonsekvenser instance for state
    """
    if not data_konsekvenser:
        return EOKonsekvenser()

    return EOKonsekvenser(
        sha=getattr(data_konsekvenser, 'sha', False),
        kvalitet=getattr(data_konsekvenser, 'kvalitet', False),
        fremdrift=getattr(data_konsekvenser, 'fremdrift', False),
        pris=getattr(data_konsekvenser, 'pris', False),
        annet=getattr(data_konsekvenser, 'annet', False),
    )


def _extract_vederlag_from_eo_data(vederlag: Any) -> tuple:
    """
    Extract vederlag fields from EOUtstedtData.vederlag.

    Safely extracts oppgjørsform, beløp, fradrag, and er_estimat
    with None-safe access.

    Args:
        vederlag: VederlagKompensasjon from event data, may be None

    Returns:
        Tuple of (oppgjorsform, kompensasjon_belop, fradrag_belop, er_estimat)
    """
    if not vederlag:
        return (None, None, None, False)

    oppgjorsform = vederlag.metode.value if vederlag.metode else None
    kompensasjon_belop = getattr(vederlag, 'belop_direkte', None)
    fradrag_belop = getattr(vederlag, 'fradrag_belop', None)
    er_estimat = getattr(vederlag, 'er_estimat', False)

    return (oppgjorsform, kompensasjon_belop, fradrag_belop, er_estimat)


def _close_spor_for_reactive_eo(
    state: 'SakState',
    data: Any,
    event: 'EOUtstedtEvent'
) -> None:
    """
    Close all spor for reactive EO from KOE (STANDARD sakstype).

    When an EO is issued reactively based on a KOE, all three tracks
    are closed:
    - Grunnlag: Set to LAAST (unless already IKKE_RELEVANT or TRUKKET)
    - Vederlag: Set to GODKJENT with godkjent_belop
    - Frist: Set to GODKJENT with godkjent_dager

    Args:
        state: Current SakState to modify
        data: EOUtstedtData from the event
        event: The EOUtstedtEvent (for legacy field fallback)
    """
    # Close grunnlag
    if state.grunnlag.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
        state.grunnlag.status = SporStatus.LAAST
        state.grunnlag.laast = True

    # Close vederlag with godkjent_belop
    if state.vederlag.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
        state.vederlag.status = SporStatus.GODKJENT
        godkjent_belop = data.vederlag.netto_belop if data.vederlag else None
        state.vederlag.godkjent_belop = godkjent_belop or event.endelig_vederlag

    # Close frist with godkjent_dager
    if state.frist.status not in {SporStatus.IKKE_RELEVANT, SporStatus.TRUKKET}:
        state.frist.status = SporStatus.GODKJENT
        godkjent_dager = data.frist_dager or event.endelig_frist_dager
        if godkjent_dager:
            state.frist.godkjent_dager = godkjent_dager


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

        # Sett prosjekt- og partsinformasjon fra Catenda
        if event.prosjekt_navn:
            state.prosjekt_navn = event.prosjekt_navn
        if event.leverandor:
            state.entreprenor = event.leverandor  # Leverandør = TE (Totalentreprenør)
        if event.byggherre:
            state.byggherre = event.byggherre  # Byggherre = BH

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

        # Initialize forsering_data for FORSERING saker
        if state.sakstype == SaksType.FORSERING:
            fd = event.forsering_data or {}
            state.forsering_data = ForseringData(
                avslatte_fristkrav=fd.get('avslatte_fristkrav', []),
                dato_varslet=fd.get('dato_varslet'),
                estimert_kostnad=fd.get('estimert_kostnad'),
                begrunnelse=fd.get('begrunnelse'),
                bekreft_30_prosent_regel=fd.get('bekreft_30_prosent_regel', False),
                er_iverksatt=fd.get('er_iverksatt', False),
                dato_iverksatt=fd.get('dato_iverksatt'),
                paalopte_kostnader=fd.get('paalopte_kostnader'),
                er_stoppet=fd.get('er_stoppet', False),
                dato_stoppet=fd.get('dato_stoppet'),
                bh_aksepterer_forsering=fd.get('bh_aksepterer_forsering'),
                bh_godkjent_kostnad=fd.get('bh_godkjent_kostnad'),
                bh_begrunnelse=fd.get('bh_begrunnelse'),
            )
            logger.debug(f"Initialized forsering_data with {len(state.forsering_data.avslatte_fristkrav)} avslatte fristkrav")

        return state

    # ============ GRUNNLAG HANDLERS ============

    def _handle_grunnlag(self, state: SakState, event: GrunnlagEvent) -> SakState:
        """Håndterer GRUNNLAG_OPPRETTET og GRUNNLAG_OPPDATERT"""
        grunnlag = state.grunnlag

        # Oppdater data
        grunnlag.tittel = event.data.tittel
        grunnlag.hovedkategori = event.data.hovedkategori
        grunnlag.underkategori = event.data.underkategori
        grunnlag.beskrivelse = event.data.beskrivelse
        grunnlag.dato_oppdaget = event.data.dato_oppdaget
        grunnlag.grunnlag_varsel = event.data.grunnlag_varsel
        grunnlag.kontraktsreferanser = event.data.kontraktsreferanser

        # Oppdater sakstittel fra grunnlag.tittel hvis den ikke er satt
        if not state.sakstittel and grunnlag.tittel:
            state.sakstittel = grunnlag.tittel

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

        # Copy VarselInfo objects directly (includes dato_sendt and metode)
        if event.data.frist_varsel:
            frist.frist_varsel = event.data.frist_varsel
        if event.data.spesifisert_varsel:
            frist.spesifisert_varsel = event.data.spesifisert_varsel
            # Hvis spesifisert krav sendes uten at varsel (§33.4) er sendt først,
            # regnes det spesifiserte kravet også som varsel
            if frist.frist_varsel is None:
                frist.frist_varsel = event.data.spesifisert_varsel

        frist.krevd_dager = event.data.antall_dager
        frist.begrunnelse = event.data.begrunnelse

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

        # §32.2: Grunnlagsvarslet rettidig (kun ENDRING)
        if hasattr(event.data, 'grunnlag_varslet_i_tide'):
            grunnlag.grunnlag_varslet_i_tide = event.data.grunnlag_varslet_i_tide

        # Map respons til status
        grunnlag.status = self._respons_til_status(event.data.resultat)

        # Hvis godkjent, lås grunnlaget
        if event.data.resultat == GrunnlagResponsResultat.GODKJENT:
            grunnlag.laast = True
            grunnlag.status = SporStatus.LAAST

        # Spor hvilken versjon BH responderte på
        grunnlag.bh_respondert_versjon = max(0, grunnlag.antall_versjoner - 1)

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

        # Port 1: Varselvurderinger (copy boolean fields)
        _copy_fields_if_present(event.data, vederlag, [
            'saerskilt_varsel_rigg_drift_ok',
            'varsel_justert_ep_ok',
            'varsel_start_regning_ok',
            'krav_fremmet_i_tide',
            'begrunnelse_varsel',
        ])

        # Port 2: Beregning
        _copy_fields_if_present(event.data, vederlag, [
            'beregnings_resultat',
        ], require_truthy=False)
        if hasattr(event.data, 'beregnings_resultat') and event.data.beregnings_resultat:
            vederlag.bh_resultat = event.data.beregnings_resultat

        if hasattr(event.data, 'begrunnelse') and event.data.begrunnelse:
            vederlag.bh_begrunnelse = event.data.begrunnelse

        # vederlagsmetode needs special handling for .value extraction
        if hasattr(event.data, 'vederlagsmetode') and event.data.vederlagsmetode:
            vederlag.bh_metode = event.data.vederlagsmetode.value if hasattr(event.data.vederlagsmetode, 'value') else event.data.vederlagsmetode

        # total_godkjent_belop maps to godkjent_belop
        if hasattr(event.data, 'total_godkjent_belop') and event.data.total_godkjent_belop is not None:
            vederlag.godkjent_belop = event.data.total_godkjent_belop

        # Subsidiært standpunkt - triggers needs .value extraction
        if hasattr(event.data, 'subsidiaer_triggers') and event.data.subsidiaer_triggers:
            vederlag.subsidiaer_triggers = [t.value if hasattr(t, 'value') else t for t in event.data.subsidiaer_triggers]

        _copy_fields_if_present(event.data, vederlag, [
            'subsidiaer_resultat',
            'subsidiaer_godkjent_belop',
            'subsidiaer_begrunnelse',
        ], require_truthy=True)

        # Map beregnings_resultat til status
        if hasattr(event.data, 'beregnings_resultat') and event.data.beregnings_resultat:
            vederlag.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)
        elif hasattr(event.data, 'resultat'):
            vederlag.status = self._respons_til_status(event.data.resultat)

        # Spor hvilken versjon BH responderte på
        vederlag.bh_respondert_versjon = max(0, vederlag.antall_versjoner - 1)

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
        _copy_fields_if_present(event.data, frist, [
            'frist_varsel_ok',
            'spesifisert_krav_ok',
            'foresporsel_svar_ok',
            'har_bh_foresporsel',
            'dato_bh_foresporsel',
            'begrunnelse_varsel',
        ])

        # Port 2: Vilkår (Årsakssammenheng)
        _copy_fields_if_present(event.data, frist, ['vilkar_oppfylt'])

        # Port 3: Beregning
        if hasattr(event.data, 'beregnings_resultat') and event.data.beregnings_resultat:
            frist.bh_resultat = event.data.beregnings_resultat

        if hasattr(event.data, 'begrunnelse') and event.data.begrunnelse:
            frist.bh_begrunnelse = event.data.begrunnelse

        _copy_fields_if_present(event.data, frist, [
            'godkjent_dager',
            'ny_sluttdato',
            'frist_for_spesifisering',
        ])

        # Subsidiært standpunkt - triggers needs .value extraction
        if hasattr(event.data, 'subsidiaer_triggers') and event.data.subsidiaer_triggers:
            frist.subsidiaer_triggers = [t.value if hasattr(t, 'value') else t for t in event.data.subsidiaer_triggers]

        _copy_fields_if_present(event.data, frist, [
            'subsidiaer_resultat',
            'subsidiaer_godkjent_dager',
            'subsidiaer_begrunnelse',
        ], require_truthy=True)

        # Map beregnings_resultat til status
        if hasattr(event.data, 'beregnings_resultat') and event.data.beregnings_resultat:
            frist.status = self._beregnings_resultat_til_status(event.data.beregnings_resultat)
        elif hasattr(event.data, 'resultat'):
            frist.status = self._respons_til_status(event.data.resultat)

        # Spor hvilken versjon BH responderte på
        frist.bh_respondert_versjon = max(0, frist.antall_versjoner - 1)

        # Metadata
        frist.siste_event_id = event.event_id
        frist.siste_oppdatert = event.tidsstempel

        state.frist = frist
        return state

    def _handle_forsering_varsel(self, state: SakState, event: ForseringVarselEvent) -> SakState:
        """
        Håndterer FORSERING_VARSEL - TE varsler om forsering (§33.8).

        Når BH avslår fristkrav, kan TE varsle om at de vil iverksette forsering.
        Denne event sendes på saker med SaksType.FORSERING.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_VARSEL uten forsering_data - ignorerer")
            return state

        # Oppdater forsering-data
        state.forsering_data.dato_varslet = event.data.dato_iverksettelse
        state.forsering_data.estimert_kostnad = event.data.estimert_kostnad
        state.forsering_data.begrunnelse = event.data.begrunnelse
        state.forsering_data.bekreft_30_prosent_regel = event.data.bekreft_30_prosent
        state.forsering_data.er_iverksatt = True
        state.forsering_data.dato_iverksatt = event.data.dato_iverksettelse

        # Kalkulasjonsgrunnlag
        state.forsering_data.avslatte_dager = event.data.avslatte_dager
        state.forsering_data.dagmulktsats = event.data.dagmulktsats
        # Beregn maks forseringskostnad (dagmulkt + 30%)
        state.forsering_data.maks_forseringskostnad = (
            event.data.avslatte_dager * event.data.dagmulktsats * 1.3
        )

        return state

    def _handle_forsering_respons(self, state: SakState, event: ForseringResponsEvent) -> SakState:
        """
        Håndterer FORSERING_RESPONS - BH svarer på forsering (§33.8).

        BH aksepterer eller avviser TEs forseringsvarsel.
        Denne event sendes på saker med SaksType.FORSERING.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_RESPONS uten forsering_data - ignorerer")
            return state

        # Legacy fields (bakoverkompatibilitet)
        state.forsering_data.bh_aksepterer_forsering = event.data.aksepterer
        state.forsering_data.bh_godkjent_kostnad = event.data.godkjent_kostnad
        state.forsering_data.bh_begrunnelse = event.data.begrunnelse

        # Populer bh_respons med alle felter fra event
        state.forsering_data.bh_respons = ForseringBHRespons(
            # Port 1: Per-sak vurdering
            vurdering_per_sak=event.data.vurdering_per_sak,
            dager_med_forseringsrett=event.data.dager_med_forseringsrett,
            grunnlag_fortsatt_gyldig=event.data.grunnlag_fortsatt_gyldig,
            grunnlag_begrunnelse=event.data.grunnlag_begrunnelse,
            # Port 2: 30%-regel
            trettiprosent_overholdt=event.data.trettiprosent_overholdt,
            trettiprosent_begrunnelse=event.data.trettiprosent_begrunnelse,
            # Port 3: Beløpsvurdering
            aksepterer=event.data.aksepterer,
            godkjent_belop=event.data.godkjent_kostnad,
            begrunnelse=event.data.begrunnelse,
            # Port 3b: Særskilte krav
            rigg_varslet_i_tide=event.data.rigg_varslet_i_tide,
            produktivitet_varslet_i_tide=event.data.produktivitet_varslet_i_tide,
            godkjent_rigg_drift=event.data.godkjent_rigg_drift,
            godkjent_produktivitet=event.data.godkjent_produktivitet,
            # Subsidiært standpunkt
            subsidiaer_triggers=event.data.subsidiaer_triggers,
            subsidiaer_godkjent_belop=event.data.subsidiaer_godkjent_belop,
            subsidiaer_begrunnelse=event.data.subsidiaer_begrunnelse,
            # Metadata
            dato_respons=event.data.dato_respons,
        )

        return state

    def _handle_forsering_stoppet(self, state: SakState, event: ForseringStoppetEvent) -> SakState:
        """
        Håndterer FORSERING_STOPPET - TE stopper forsering (§33.8).

        TE stopper forseringen og rapporterer påløpte kostnader.
        Denne event sendes på saker med SaksType.FORSERING.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_STOPPET uten forsering_data - ignorerer")
            return state

        # Oppdater stopp-tilstand
        state.forsering_data.er_stoppet = True
        state.forsering_data.dato_stoppet = event.data.dato_stoppet
        if event.data.paalopte_kostnader is not None:
            state.forsering_data.paalopte_kostnader = event.data.paalopte_kostnader

        return state

    def _handle_forsering_kostnader_oppdatert(self, state: SakState, event: ForseringKostnaderOppdatertEvent) -> SakState:
        """
        Håndterer FORSERING_KOSTNADER_OPPDATERT - TE oppdaterer påløpte kostnader (§33.8).

        TE kan oppdatere påløpte kostnader underveis i forseringen.
        Denne event sendes på saker med SaksType.FORSERING.
        """
        if state.forsering_data is None:
            logger.warning("Mottok FORSERING_KOSTNADER_OPPDATERT uten forsering_data - ignorerer")
            return state

        # Oppdater kostnader
        state.forsering_data.paalopte_kostnader = event.data.paalopte_kostnader

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

        if state.sakstype == SaksType.ENDRINGSORDRE:
            # Build state from event data using helpers
            konsekvenser = _build_state_konsekvenser(data.konsekvenser)
            oppgjorsform, kompensasjon_belop, fradrag_belop, er_estimat = \
                _extract_vederlag_from_eo_data(data.vederlag)

            # Handle both relaterte_sak_ids and relaterte_koe_saker
            relaterte = data.relaterte_sak_ids or data.relaterte_koe_saker or []

            state.endringsordre_data = EndringsordreData(
                eo_nummer=data.eo_nummer,
                revisjon_nummer=data.revisjon_nummer,
                beskrivelse=data.beskrivelse,
                vedlegg_ids=data.vedlegg_ids or [],
                konsekvenser=konsekvenser,
                konsekvens_beskrivelse=data.konsekvens_beskrivelse,
                oppgjorsform=oppgjorsform,
                kompensasjon_belop=kompensasjon_belop,
                fradrag_belop=fradrag_belop,
                er_estimat=er_estimat,
                frist_dager=data.frist_dager,
                status=EOStatus.UTSTEDT,
                dato_utstedt=data.dato_utstedt or event.tidsstempel.strftime('%Y-%m-%d'),
                utstedt_av=event.aktor,
                relaterte_koe_saker=relaterte,
            )
            logger.info(f"EO {data.eo_nummer} utstedt med status UTSTEDT")
        else:
            # For STANDARD sakstype (reaktiv EO fra KOE): Lukk alle spor
            _close_spor_for_reactive_eo(state, data, event)

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
            GrunnlagResponsResultat.AVSLATT: SporStatus.AVSLATT,
            GrunnlagResponsResultat.FRAFALT: SporStatus.TRUKKET,  # Pålegg frafalt
        }
        # Default to UNDER_FORHANDLING for unknown results
        return mapping.get(resultat, SporStatus.UNDER_FORHANDLING)

    def _beregnings_resultat_til_status(self, resultat) -> SporStatus:
        """
        Mapper VederlagBeregningResultat eller FristBeregningResultat til SporStatus.

        VIKTIG: Dette mapper KUN beregningsresultatet, ikke grunnlag.
        Kombinasjonen av grunnlag + beregning håndteres av computed fields i SakState.
        """

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
            entreprenor=state.entreprenor,
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
            'avslatt': 'Avslått',
            'frafalt': 'Pålegg frafalt',
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
                    bh_begrunnelse=getattr(event.data, 'begrunnelse', None),
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
                    bh_begrunnelse=getattr(event.data, 'begrunnelse', None),
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
                    bh_begrunnelse=getattr(event.data, 'begrunnelse', None),
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
                    bh_begrunnelse=getattr(event.data, 'begrunnelse', None),
                )
                historikk.append(entry.model_dump(mode='json'))

        return historikk

    def get_grunnlag_historikk(self, events: List[AnyEvent]) -> List[Dict[str, Any]]:
        """
        Bygger revisjonshistorikk for grunnlag fra events.

        Returnerer en kronologisk liste med alle versjoner av grunnlaget
        og BH-responser, med versjonsnummer for hver TE-revisjon.
        """
        from models.api_responses import GrunnlagHistorikkEntry, AktorInfo

        historikk = []
        te_versjon = 0  # Teller for TE-revisjoner

        # Filtrer og sorter grunnlag-relaterte events
        grunnlag_events = [
            e for e in events
            if e.event_type in {
                EventType.GRUNNLAG_OPPRETTET,
                EventType.GRUNNLAG_OPPDATERT,
                EventType.GRUNNLAG_TRUKKET,
                EventType.RESPONS_GRUNNLAG,
                EventType.RESPONS_GRUNNLAG_OPPDATERT,
            }
        ]
        grunnlag_events.sort(key=lambda e: e.tidsstempel)

        for event in grunnlag_events:
            aktor_info = AktorInfo(
                navn=event.aktor,
                rolle=event.aktor_rolle,
                tidsstempel=event.tidsstempel,
            )

            if event.event_type == EventType.GRUNNLAG_OPPRETTET:
                te_versjon = 1
                entry = GrunnlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="opprettet",
                    event_id=event.event_id,
                    hovedkategori=event.data.hovedkategori,
                    underkategori=event.data.underkategori,
                    beskrivelse=event.data.beskrivelse,
                    kontraktsreferanser=event.data.kontraktsreferanser or [],
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.GRUNNLAG_OPPDATERT:
                te_versjon += 1
                entry = GrunnlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="oppdatert",
                    event_id=event.event_id,
                    hovedkategori=event.data.hovedkategori,
                    underkategori=event.data.underkategori,
                    beskrivelse=event.data.beskrivelse,
                    kontraktsreferanser=event.data.kontraktsreferanser or [],
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.GRUNNLAG_TRUKKET:
                entry = GrunnlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="trukket",
                    event_id=event.event_id,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_GRUNNLAG:
                entry = GrunnlagHistorikkEntry(
                    versjon=te_versjon,  # Refererer til hvilken TE-versjon den svarer på
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons",
                    event_id=event.event_id,
                    bh_resultat=event.data.resultat.value if event.data.resultat else None,
                    bh_resultat_label=self._get_grunnlag_resultat_label(event.data.resultat),
                    bh_begrunnelse=event.data.begrunnelse,
                )
                historikk.append(entry.model_dump(mode='json'))

            elif event.event_type == EventType.RESPONS_GRUNNLAG_OPPDATERT:
                entry = GrunnlagHistorikkEntry(
                    versjon=te_versjon,
                    tidsstempel=event.tidsstempel,
                    aktor=aktor_info,
                    endring_type="respons_oppdatert",
                    event_id=event.event_id,
                    bh_resultat=event.data.resultat.value if event.data.resultat else None,
                    bh_resultat_label=self._get_grunnlag_resultat_label(event.data.resultat),
                    bh_begrunnelse=event.data.begrunnelse,
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
            'noytralt': 'Foreløpig varsel (§33.4)',
            'spesifisert': 'Spesifisert krav (§33.6)',
            'begge': 'Foreløpig + Spesifisert',
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

    def _get_grunnlag_resultat_label(self, resultat) -> Optional[str]:
        """Konverter grunnlag-resultat til lesbar label."""
        if not resultat:
            return None
        labels = {
            'godkjent': 'Godkjent',
            'delvis_godkjent': 'Delvis godkjent',
            'avslatt': 'Avslått',
            'frafalt': 'Frafalt (§32.3 c)',
        }
        return labels.get(resultat.value if hasattr(resultat, 'value') else resultat, str(resultat))
