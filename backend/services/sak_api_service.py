"""
SakApiService - API-lag for å servere saksdata til frontend.

Denne servicen tar SakState og events fra TimelineService
og transformerer dem til API-responser optimert for frontend.
"""
from typing import List, Optional
from datetime import datetime

from models.events import (
    AnyEvent,
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    SporType,
    SporStatus,
    EventType,
    ResponsResultat,
)
from models.sak_state import SakState
from models.api_responses import (
    OversiktResponse,
    GrunnlagResponse,
    VederlagResponse,
    FristResponse,
    TidslinjeResponse,
    FullSakResponse,
    StatusBadge,
    SporKort,
    AktorInfo,
    GrunnlagHistorikkEntry,
    VederlagHistorikkEntry,
    FristHistorikkEntry,
    TidslinjeEntry,
)
from services.timeline_service import TimelineService
from core.generated_constants import get_vederlagsmetoder_label
from utils.logger import get_logger

logger = get_logger(__name__)


class SakApiService:
    """
    Service for å generere API-responser fra events og state.
    """

    def __init__(self, timeline_service: Optional[TimelineService] = None):
        self.timeline_service = timeline_service or TimelineService()

    # ============ MAIN API METHODS ============

    def get_full_sak(self, events: List[AnyEvent], rolle: str = "TE") -> FullSakResponse:
        """
        Henter komplett saksinfo for alle faner.

        Args:
            events: Alle events for saken
            rolle: Brukerens rolle (TE eller BH) - påvirker handlinger

        Returns:
            FullSakResponse med data for alle faner
        """
        state = self.timeline_service.compute_state(events)

        return FullSakResponse(
            sak_id=state.sak_id,
            sakstittel=state.sakstittel,
            oversikt=self.get_oversikt(state, rolle),
            grunnlag=self.get_grunnlag(events, state, rolle),
            vederlag=self.get_vederlag(events, state, rolle),
            frist=self.get_frist(events, state, rolle),
            tidslinje=self.get_tidslinje(events),
            siste_oppdatert=state.siste_aktivitet or datetime.now(),
        )

    def get_oversikt(self, state: SakState, rolle: str = "TE") -> OversiktResponse:
        """Genererer Oversikt-fane respons"""

        spor_kort = []

        # Grunnlag-spor
        if state.grunnlag.status != SporStatus.IKKE_RELEVANT:
            spor_kort.append(SporKort(
                spor=SporType.GRUNNLAG,
                tittel="Grunnlag",
                status=self._status_til_badge(state.grunnlag.status),
                aktiv=True,
                verdi_label="Kategori",
                verdi_krevd=f"{state.grunnlag.hovedkategori}: {state.grunnlag.underkategori}" if state.grunnlag.hovedkategori else None,
                verdi_godkjent="Godkjent" if state.grunnlag.laast else None,
                neste_handling=self._get_spor_neste_handling(state.grunnlag.status, "grunnlag", rolle),
            ))

        # Vederlag-spor
        if state.vederlag.status != SporStatus.IKKE_RELEVANT:
            spor_kort.append(SporKort(
                spor=SporType.VEDERLAG,
                tittel="Vederlag",
                status=self._status_til_badge(state.vederlag.status),
                aktiv=True,
                verdi_label="Krevd beløp",
                verdi_krevd=f"{state.vederlag.krevd_belop:,.0f} NOK" if state.vederlag.krevd_belop else None,
                verdi_godkjent=f"{state.vederlag.godkjent_belop:,.0f} NOK" if state.vederlag.godkjent_belop else None,
                neste_handling=self._get_spor_neste_handling(state.vederlag.status, "vederlag", rolle),
            ))

        # Frist-spor
        if state.frist.status != SporStatus.IKKE_RELEVANT:
            spor_kort.append(SporKort(
                spor=SporType.FRIST,
                tittel="Fristforlengelse",
                status=self._status_til_badge(state.frist.status),
                aktiv=True,
                verdi_label="Krevde dager",
                verdi_krevd=f"{state.frist.krevd_dager} dager" if state.frist.krevd_dager else None,
                verdi_godkjent=f"{state.frist.godkjent_dager} dager" if state.frist.godkjent_dager else None,
                neste_handling=self._get_spor_neste_handling(state.frist.status, "frist", rolle),
            ))

        neste = state.neste_handling

        return OversiktResponse(
            sak_id=state.sak_id,
            sakstittel=state.sakstittel,
            status=self._overordnet_status_til_badge(state.overordnet_status),
            kan_utstede_eo=state.kan_utstede_eo,
            spor=spor_kort,
            neste_handling=neste.get("handling", ""),
            neste_handling_rolle=neste.get("rolle"),
            total_krevd=state.sum_krevd,
            total_godkjent=state.sum_godkjent,
            total_dager_krevd=state.frist.krevd_dager,
            total_dager_godkjent=state.frist.godkjent_dager,
            opprettet=state.opprettet or datetime.now(),
            siste_aktivitet=state.siste_aktivitet or datetime.now(),
            te_navn=state.te_navn,
            bh_navn=state.bh_navn,
            prosjekt_navn=state.prosjekt_navn,
        )

    def get_grunnlag(
        self,
        events: List[AnyEvent],
        state: Optional[SakState] = None,
        rolle: str = "TE"
    ) -> GrunnlagResponse:
        """Genererer Grunnlag-fane respons"""

        if state is None:
            state = self.timeline_service.compute_state(events)

        # Bygg historikk fra events
        historikk = []
        grunnlag_events = [e for e in events if isinstance(e, GrunnlagEvent)]
        for i, event in enumerate(grunnlag_events):
            historikk.append(GrunnlagHistorikkEntry(
                versjon=i + 1,
                tidsstempel=event.tidsstempel,
                aktor=AktorInfo(navn=event.aktor, rolle=event.aktor_rolle, tidsstempel=event.tidsstempel),
                endring_type="opprettet" if i == 0 else ("trukket" if event.event_type == EventType.GRUNNLAG_TRUKKET else "oppdatert"),
                hovedkategori=event.data.hovedkategori,
                underkategori=event.data.underkategori,
                beskrivelse=event.data.beskrivelse,
                kontraktsreferanser=event.data.kontraktsreferanser,
            ))

        # Finn BH respons
        respons_events = [e for e in events if isinstance(e, ResponsEvent) and e.spor == SporType.GRUNNLAG]
        siste_respons = respons_events[-1] if respons_events else None

        g = state.grunnlag

        return GrunnlagResponse(
            sak_id=state.sak_id,
            status=self._status_til_badge(g.status),
            laast=g.laast,
            hovedkategori=g.hovedkategori or "",
            underkategori=g.underkategori or "",
            beskrivelse=g.beskrivelse or "",
            dato_oppdaget=g.dato_oppdaget or "",
            kontraktsreferanser=g.kontraktsreferanser,
            vedlegg=[],  # TODO: Implementer vedlegg-håndtering
            bh_har_svart=g.bh_resultat is not None,
            bh_resultat=g.bh_resultat,
            bh_begrunnelse=g.bh_begrunnelse,
            bh_svart_dato=siste_respons.tidsstempel if siste_respons else None,
            bh_svart_av=siste_respons.aktor if siste_respons else None,
            kan_redigere=rolle == "TE" and not g.laast and g.status not in {SporStatus.TRUKKET},
            kan_svare=rolle == "BH" and g.status == SporStatus.SENDT,
            historikk=historikk,
        )

    def get_vederlag(
        self,
        events: List[AnyEvent],
        state: Optional[SakState] = None,
        rolle: str = "TE"
    ) -> VederlagResponse:
        """Genererer Vederlag-fane respons"""

        if state is None:
            state = self.timeline_service.compute_state(events)

        # Bygg historikk
        historikk = []
        vederlag_events = [e for e in events if isinstance(e, VederlagEvent)]
        for i, event in enumerate(vederlag_events):
            historikk.append(VederlagHistorikkEntry(
                versjon=event.versjon,
                tidsstempel=event.tidsstempel,
                aktor=AktorInfo(navn=event.aktor, rolle=event.aktor_rolle, tidsstempel=event.tidsstempel),
                endring_type="sendt" if i == 0 else ("trukket" if event.event_type == EventType.VEDERLAG_KRAV_TRUKKET else "oppdatert"),
                krav_belop=event.data.krav_belop,
                metode=event.data.metode,
                metode_label=get_vederlagsmetoder_label(event.data.metode),
            ))

        # Finn BH respons
        respons_events = [e for e in events if isinstance(e, ResponsEvent) and e.spor == SporType.VEDERLAG]
        siste_respons = respons_events[-1] if respons_events else None

        v = state.vederlag

        return VederlagResponse(
            sak_id=state.sak_id,
            status=self._status_til_badge(v.status),
            krav_belop=v.krevd_belop or 0,
            krav_metode=v.metode or "",
            krav_metode_label=get_vederlagsmetoder_label(v.metode) if v.metode else "",
            krav_begrunnelse=v.begrunnelse or "",
            inkluderer_produktivitetstap=v.inkluderer_produktivitetstap,
            inkluderer_rigg_drift=v.inkluderer_rigg_drift,
            bh_har_svart=v.bh_resultat is not None,
            bh_resultat=v.bh_resultat,
            bh_begrunnelse=v.bh_begrunnelse,
            bh_godkjent_belop=v.godkjent_belop,
            bh_godkjent_metode=v.godkjent_metode,
            bh_godkjent_metode_label=get_vederlagsmetoder_label(v.godkjent_metode) if v.godkjent_metode else None,
            bh_svart_dato=siste_respons.tidsstempel if siste_respons else None,
            kan_redigere=rolle == "TE" and v.status not in {SporStatus.GODKJENT, SporStatus.LAAST, SporStatus.TRUKKET},
            kan_svare=rolle == "BH" and v.status == SporStatus.SENDT,
            krever_grunnlag_godkjent=state.grunnlag.status not in {SporStatus.GODKJENT, SporStatus.LAAST},
            historikk=historikk,
        )

    def get_frist(
        self,
        events: List[AnyEvent],
        state: Optional[SakState] = None,
        rolle: str = "TE"
    ) -> FristResponse:
        """Genererer Frist-fane respons"""

        if state is None:
            state = self.timeline_service.compute_state(events)

        # Bygg historikk
        historikk = []
        frist_events = [e for e in events if isinstance(e, FristEvent)]
        for i, event in enumerate(frist_events):
            historikk.append(FristHistorikkEntry(
                versjon=event.versjon,
                tidsstempel=event.tidsstempel,
                aktor=AktorInfo(navn=event.aktor, rolle=event.aktor_rolle, tidsstempel=event.tidsstempel),
                endring_type="sendt" if i == 0 else ("trukket" if event.event_type == EventType.FRIST_KRAV_TRUKKET else "oppdatert"),
                krav_dager=event.data.antall_dager,
                frist_type=event.data.frist_type,
            ))

        # Finn BH respons
        respons_events = [e for e in events if isinstance(e, ResponsEvent) and e.spor == SporType.FRIST]
        siste_respons = respons_events[-1] if respons_events else None

        f = state.frist

        return FristResponse(
            sak_id=state.sak_id,
            status=self._status_til_badge(f.status),
            krav_dager=f.krevd_dager or 0,
            frist_type=f.frist_type or "kalenderdager",
            frist_type_label="Kalenderdager" if f.frist_type == "kalenderdager" else "Arbeidsdager",
            krav_begrunnelse=f.begrunnelse or "",
            milepael_pavirket=f.milepael_pavirket,
            bh_har_svart=f.bh_resultat is not None,
            bh_resultat=f.bh_resultat,
            bh_begrunnelse=f.bh_begrunnelse,
            bh_godkjent_dager=f.godkjent_dager,
            bh_ny_sluttdato=f.ny_sluttdato,
            bh_svart_dato=siste_respons.tidsstempel if siste_respons else None,
            kan_redigere=rolle == "TE" and f.status not in {SporStatus.GODKJENT, SporStatus.LAAST, SporStatus.TRUKKET},
            kan_svare=rolle == "BH" and f.status == SporStatus.SENDT,
            historikk=historikk,
        )

    def get_tidslinje(self, events: List[AnyEvent]) -> TidslinjeResponse:
        """Genererer Tidslinje-fane respons"""

        timeline_entries = []
        sorted_events = sorted(events, key=lambda e: e.tidsstempel, reverse=True)

        for event in sorted_events:
            entry = TidslinjeEntry(
                event_id=event.event_id,
                tidsstempel=event.tidsstempel,
                type_label=self._event_type_label(event.event_type),
                aktor=AktorInfo(navn=event.aktor, rolle=event.aktor_rolle, tidsstempel=event.tidsstempel),
                spor=self._get_event_spor(event),
                ikon=self._get_event_ikon(event),
                farge=self._get_spor_farge(self._get_event_spor(event)),
                sammendrag=self._get_event_sammendrag(event),
                detaljer=event.model_dump() if hasattr(event, 'data') else None,
            )
            timeline_entries.append(entry)

        return TidslinjeResponse(
            sak_id=events[0].sak_id if events else "",
            antall_events=len(events),
            events=timeline_entries,
            har_grunnlag_events=any(isinstance(e, GrunnlagEvent) for e in events),
            har_vederlag_events=any(isinstance(e, VederlagEvent) for e in events),
            har_frist_events=any(isinstance(e, FristEvent) for e in events),
        )

    # ============ HELPERS ============

    def _status_til_badge(self, status: SporStatus) -> StatusBadge:
        """Konverterer SporStatus til visuell badge"""
        badges = {
            SporStatus.IKKE_RELEVANT: StatusBadge(tekst="Ikke relevant", farge="gray", ikon="minus"),
            SporStatus.UTKAST: StatusBadge(tekst="Utkast", farge="gray", ikon="edit"),
            SporStatus.SENDT: StatusBadge(tekst="Sendt", farge="blue", ikon="send"),
            SporStatus.UNDER_BEHANDLING: StatusBadge(tekst="Under behandling", farge="yellow", ikon="clock"),
            SporStatus.GODKJENT: StatusBadge(tekst="Godkjent", farge="green", ikon="check"),
            SporStatus.DELVIS_GODKJENT: StatusBadge(tekst="Delvis godkjent", farge="yellow", ikon="check-partial"),
            SporStatus.AVVIST: StatusBadge(tekst="Avvist", farge="red", ikon="x"),
            SporStatus.UNDER_FORHANDLING: StatusBadge(tekst="Under forhandling", farge="yellow", ikon="refresh"),
            SporStatus.TRUKKET: StatusBadge(tekst="Trukket", farge="gray", ikon="undo"),
            SporStatus.LAAST: StatusBadge(tekst="Låst", farge="green", ikon="lock"),
        }
        return badges.get(status, StatusBadge(tekst="Ukjent", farge="gray"))

    def _overordnet_status_til_badge(self, status: str) -> StatusBadge:
        """Konverterer overordnet status til badge"""
        badges = {
            "UTKAST": StatusBadge(tekst="Utkast", farge="gray", ikon="edit"),
            "VENTER_PAA_SVAR": StatusBadge(tekst="Venter på svar", farge="blue", ikon="clock"),
            "UNDER_BEHANDLING": StatusBadge(tekst="Under behandling", farge="yellow", ikon="clock"),
            "UNDER_FORHANDLING": StatusBadge(tekst="Under forhandling", farge="yellow", ikon="refresh"),
            "OMFORENT": StatusBadge(tekst="Omforent", farge="green", ikon="check"),
            "LUKKET_TRUKKET": StatusBadge(tekst="Trukket", farge="gray", ikon="undo"),
        }
        return badges.get(status, StatusBadge(tekst=status, farge="gray"))

    def _get_spor_neste_handling(self, status: SporStatus, spor: str, rolle: str) -> Optional[str]:
        """Returnerer neste handling for et spor"""
        if status == SporStatus.UTKAST and rolle == "TE":
            return f"Send {spor}"
        if status == SporStatus.SENDT and rolle == "BH":
            return f"Vurder {spor}"
        if status in {SporStatus.AVVIST, SporStatus.UNDER_FORHANDLING} and rolle == "TE":
            return f"Oppdater {spor}"
        return None

    def _event_type_label(self, event_type: EventType) -> str:
        """Lesbar label for event-type"""
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
            EventType.FRIST_KRAV_TRUKKET: "Fristkrav trukket",
            EventType.RESPONS_GRUNNLAG: "BH svarte på grunnlag",
            EventType.RESPONS_VEDERLAG: "BH svarte på vederlag",
            EventType.RESPONS_FRIST: "BH svarte på frist",
            EventType.EO_UTSTEDT: "Endringsordre utstedt",
        }
        return labels.get(event_type, str(event_type))

    def _get_event_spor(self, event: AnyEvent) -> Optional[SporType]:
        """Hvilket spor tilhører eventen"""
        if isinstance(event, GrunnlagEvent):
            return SporType.GRUNNLAG
        if isinstance(event, VederlagEvent):
            return SporType.VEDERLAG
        if isinstance(event, FristEvent):
            return SporType.FRIST
        if isinstance(event, ResponsEvent):
            return event.spor
        return None

    def _get_event_ikon(self, event: AnyEvent) -> str:
        """Ikon for event-type"""
        if isinstance(event, GrunnlagEvent):
            return "file-text"
        if isinstance(event, VederlagEvent):
            return "dollar-sign"
        if isinstance(event, FristEvent):
            return "calendar"
        if isinstance(event, ResponsEvent):
            if hasattr(event.data, 'resultat'):
                if event.data.resultat == ResponsResultat.GODKJENT:
                    return "check-circle"
                if event.data.resultat == ResponsResultat.AVVIST_UENIG:
                    return "x-circle"
            return "message-circle"
        return "circle"

    def _get_spor_farge(self, spor: Optional[SporType]) -> str:
        """Farge for spor"""
        farger = {
            SporType.GRUNNLAG: "purple",
            SporType.VEDERLAG: "green",
            SporType.FRIST: "blue",
        }
        return farger.get(spor, "gray") if spor else "gray"

    def _get_event_sammendrag(self, event: AnyEvent) -> str:
        """Kort sammendrag av event"""
        if isinstance(event, GrunnlagEvent):
            return f"{event.data.hovedkategori}: {event.data.underkategori}"
        if isinstance(event, VederlagEvent):
            return f"{event.data.krav_belop:,.0f} NOK ({get_vederlagsmetoder_label(event.data.metode)})"
        if isinstance(event, FristEvent):
            return f"{event.data.antall_dager} {event.data.frist_type}"
        if isinstance(event, ResponsEvent):
            return event.data.resultat.value if hasattr(event.data, 'resultat') else ""
        return ""
