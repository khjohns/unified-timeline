"""
API Response Models for Frontend.

Disse modellene definerer strukturen på API-responsene
som frontend bruker for å vise saksinformasjon i faner.

Frontend-fanene:
1. Oversikt - Hovedinfo om saken
2. Grunnlag - Juridisk/kontraktuelt grunnlag
3. Vederlag - Økonomi/penger
4. Tid - Fristforlengelse
5. Tidslinje - Full historikk

Hver fane har sin egen respons-type optimert for det visningen trenger.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, computed_field

from models.events import (
    FristBeregningResultat,
    GrunnlagResponsResultat,
    SporType,
    VederlagBeregningResultat,
)

# ============ COMMON TYPES ============


class AktorInfo(BaseModel):
    """Info om en aktør (TE eller BH)"""

    navn: str
    rolle: Literal["TE", "BH"]
    tidsstempel: datetime


class StatusBadge(BaseModel):
    """Visuell status-badge for UI"""

    tekst: str
    farge: Literal["green", "yellow", "red", "blue", "gray"]
    ikon: str | None = None  # f.eks. "check", "clock", "x"


# ============ TAB: OVERSIKT ============


class SporKort(BaseModel):
    """Kort sammendrag av ett spor for oversikt-fanen"""

    spor: SporType
    tittel: str  # "Grunnlag", "Vederlag", "Frist"
    status: StatusBadge
    aktiv: bool  # Om sporet er aktivt i saken

    # Hovedverdi
    verdi_label: str  # "Krevd beløp", "Krevd dager"
    verdi_krevd: str | None = None  # "150 000 NOK", "14 dager"
    verdi_godkjent: str | None = None

    # Neste handling for dette sporet
    neste_handling: str | None = None


class OversiktResponse(BaseModel):
    """
    API-respons for Oversikt-fanen.

    Gir et raskt overblikk over sakens status på alle spor.
    """

    sak_id: str
    sakstittel: str

    # Overordnet status
    status: StatusBadge
    kan_utstede_eo: bool

    # De tre sporene
    spor: list[SporKort]

    # Neste handling globalt
    neste_handling: str
    neste_handling_rolle: Literal["TE", "BH"] | None = None

    # Aggregerte verdier
    total_krevd: float
    total_godkjent: float
    total_dager_krevd: int | None = None
    total_dager_godkjent: int | None = None

    # Metadata
    opprettet: datetime
    siste_aktivitet: datetime

    # Parter
    entreprenor: str | None = None
    byggherre: str | None = None
    prosjekt_navn: str | None = None


# ============ TAB: GRUNNLAG ============


class GrunnlagHistorikkEntry(BaseModel):
    """Én versjon av grunnlaget eller BH-respons i historikken"""

    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal[
        "opprettet", "oppdatert", "trukket", "respons", "respons_oppdatert"
    ]
    event_id: str

    # TE-krav felter (for opprettet/oppdatert/trukket)
    tittel: str | None = None
    hovedkategori: str | None = None
    underkategori: str | list[str] | None = None
    beskrivelse: str | None = None
    dato_oppdaget: str | None = None  # Kritisk for preklusjonsvurdering (§33.4)

    # BH-respons felter (for respons/respons_oppdatert)
    bh_resultat: str | None = None
    bh_resultat_label: str | None = None
    bh_begrunnelse: str | None = None


class GrunnlagResponse(BaseModel):
    """
    API-respons for Grunnlag-fanen.

    Viser juridisk/kontraktuelt grunnlag for saken.
    """

    sak_id: str

    # Nåværende tilstand
    status: StatusBadge
    laast: bool  # Om grunnlaget er låst etter godkjenning

    # Gjeldende grunnlag
    hovedkategori: str
    underkategori: str
    beskrivelse: str
    dato_oppdaget: str
    vedlegg: list[dict]  # {id, navn, url}

    # BH respons (hvis finnes)
    bh_har_svart: bool
    bh_resultat: GrunnlagResponsResultat | None = None
    bh_begrunnelse: str | None = None
    bh_svart_dato: datetime | None = None
    bh_svart_av: str | None = None

    # Handlinger tilgjengelig
    kan_redigere: bool  # TE kan redigere hvis ikke låst
    kan_svare: bool  # BH kan svare hvis sendt og ikke besvart

    # Historikk (alle versjoner)
    historikk: list[GrunnlagHistorikkEntry]


# ============ TAB: VEDERLAG ============


class VederlagPostering(BaseModel):
    """Én post i kostnadsoppstillingen"""

    beskrivelse: str
    antall: float | None = None
    enhet: str | None = None  # "timer", "stk", "m2"
    enhetspris: float | None = None
    sum: float


class VederlagHistorikkEntry(BaseModel):
    """Én versjon av vederlagskravet eller BH-respons"""

    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal[
        "sendt", "oppdatert", "trukket", "respons", "respons_oppdatert"
    ]
    event_id: str

    # TE-krav felter (for sendt/oppdatert/trukket)
    krav_belop: float | None = None
    metode: str | None = None
    metode_label: str | None = None
    begrunnelse: str | None = None
    inkluderer_rigg_drift: bool | None = None
    inkluderer_produktivitet: bool | None = None
    rigg_drift_belop: float | None = None  # Særskilt krav §34.1.3
    produktivitet_belop: float | None = None  # Særskilt krav §34.1.3

    # BH-respons felter (for respons/respons_oppdatert)
    bh_resultat: str | None = None
    bh_resultat_label: str | None = None
    godkjent_belop: float | None = None  # Total (sum av alle komponenter)
    bh_begrunnelse: str | None = None
    hold_tilbake: bool | None = None  # §30.2 tilbakeholdelse

    # BH-respons: Oppdelt godkjent beløp
    hovedkrav_godkjent_belop: float | None = None  # Hovedkrav godkjent
    rigg_godkjent_belop: float | None = None  # Rigg/drift godkjent (§34.1.3)
    produktivitet_godkjent_belop: float | None = None  # Produktivitet godkjent (§34.1.3)

    # Subsidiært standpunkt (når BH avviser men angir hva resultatet ville vært)
    # Inkluderer prekluderte krav som ville blitt godkjent subsidiært
    subsidiaer_resultat: str | None = None
    subsidiaer_godkjent_belop: float | None = None  # Total subsidiært (inkl. prekluderte)


class VederlagResponse(BaseModel):
    """
    API-respons for Vederlag-fanen.

    Viser økonomisk krav og forhandlingsstatus.
    """

    sak_id: str

    # Nåværende tilstand
    status: StatusBadge

    # TE sitt krav
    krav_belop: float
    krav_metode: str
    krav_metode_label: str  # "Entreprenørens tilbud (§34.2.1)"
    krav_begrunnelse: str
    inkluderer_produktivitetstap: bool
    inkluderer_rigg_drift: bool
    rigg_drift_belop: float | None = None

    # Detaljert spesifikasjon (hvis tilgjengelig)
    spesifikasjon: list[VederlagPostering] | None = None

    # BH respons
    bh_har_svart: bool
    bh_resultat: VederlagBeregningResultat | None = None
    bh_begrunnelse: str | None = None
    bh_godkjent_belop: float | None = None
    bh_godkjent_metode: str | None = None
    bh_godkjent_metode_label: str | None = None
    bh_svart_dato: datetime | None = None

    # Differanse-visning
    @computed_field
    @property
    def differanse(self) -> float | None:
        if self.bh_godkjent_belop is not None:
            return self.krav_belop - self.bh_godkjent_belop
        return None

    @computed_field
    @property
    def godkjenningsgrad(self) -> float | None:
        if self.krav_belop > 0 and self.bh_godkjent_belop is not None:
            return round((self.bh_godkjent_belop / self.krav_belop) * 100, 1)
        return None

    # Handlinger
    kan_redigere: bool
    kan_svare: bool
    krever_grunnlag_godkjent: bool  # Advarsel hvis grunnlag ikke er godkjent

    # Historikk
    historikk: list[VederlagHistorikkEntry]


# ============ TAB: TID (FRIST) ============


class FristHistorikkEntry(BaseModel):
    """Én versjon av fristkravet eller BH-respons"""

    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal[
        "sendt", "oppdatert", "trukket", "respons", "respons_oppdatert", "spesifisert"
    ]
    event_id: str

    # TE-krav felter (for sendt/oppdatert/trukket)
    krav_dager: int | None = None
    varsel_type: str | None = None
    varsel_type_label: str | None = None
    begrunnelse: str | None = None
    ny_sluttdato: str | None = None
    frist_varsel_dato: str | None = None  # §33.4 varseldato
    spesifisert_varsel_dato: str | None = None  # §33.6 varseldato

    # BH-respons felter (for respons/respons_oppdatert)
    bh_resultat: str | None = None
    bh_resultat_label: str | None = None
    godkjent_dager: int | None = None
    bh_begrunnelse: str | None = None

    # Subsidiært standpunkt (når BH avviser men angir hva resultatet ville vært)
    subsidiaer_resultat: str | None = None
    subsidiaer_godkjent_dager: int | None = None


class FristResponse(BaseModel):
    """
    API-respons for Tid/Frist-fanen.

    Viser fristforlengelseskrav og status.
    """

    sak_id: str

    # Nåværende tilstand
    status: StatusBadge

    # TE sitt krav
    krav_dager: int
    krav_begrunnelse: str
    foreslatt_ny_sluttdato: str | None = None

    # BH respons
    bh_har_svart: bool
    bh_resultat: FristBeregningResultat | None = None
    bh_begrunnelse: str | None = None
    bh_godkjent_dager: int | None = None
    bh_ny_sluttdato: str | None = None
    bh_svart_dato: datetime | None = None

    # Differanse
    @computed_field
    @property
    def differanse_dager(self) -> int | None:
        if self.bh_godkjent_dager is not None:
            return self.krav_dager - self.bh_godkjent_dager
        return None

    # Handlinger
    kan_redigere: bool
    kan_svare: bool

    # Historikk
    historikk: list[FristHistorikkEntry]


# ============ TAB: TIDSLINJE ============


class TidslinjeEntry(BaseModel):
    """Én hendelse i tidslinjen"""

    event_id: str
    tidsstempel: datetime
    type_label: str  # "Grunnlag sendt", "BH svarte på vederlag"
    aktor: AktorInfo
    spor: SporType | None = None

    # Visuell info
    ikon: str  # "file", "money", "clock", "check", "x"
    farge: str  # spor-farge

    # Detaljer (ekspanderbart)
    sammendrag: str
    detaljer: dict | None = None  # Full event-data for ekspandert visning


class TidslinjeResponse(BaseModel):
    """
    API-respons for Tidslinje-fanen.

    Viser full historikk som en kronologisk tidslinje.
    """

    sak_id: str
    antall_events: int
    events: list[TidslinjeEntry]

    # Filtrering (frontend kan bruke dette for filter-knapper)
    har_grunnlag_events: bool
    har_vederlag_events: bool
    har_frist_events: bool


# ============ FULL SAK RESPONSE ============


class FullSakResponse(BaseModel):
    """
    Komplett API-respons med all informasjon.

    Brukes når frontend laster en sak første gang.
    Inneholder data for alle faner i én respons.
    """

    sak_id: str
    sakstittel: str

    oversikt: OversiktResponse
    grunnlag: GrunnlagResponse
    vederlag: VederlagResponse
    frist: FristResponse
    tidslinje: TidslinjeResponse

    # For å minimere re-fetch
    siste_oppdatert: datetime
    etag: str | None = None  # For caching


# ============ MUTATION RESPONSES ============


class EventCreatedResponse(BaseModel):
    """Respons når en ny event er opprettet"""

    success: bool
    event_id: str
    message: str

    # Oppdatert state (så frontend slipper re-fetch)
    oppdatert_spor_status: StatusBadge
    oppdatert_overordnet_status: StatusBadge


class ValidationError(BaseModel):
    """Valideringsfeil"""

    felt: str
    melding: str


class MutationErrorResponse(BaseModel):
    """Feilrespons for mutations"""

    success: Literal[False] = False
    error_code: str
    message: str
    validation_errors: list[ValidationError] | None = None
