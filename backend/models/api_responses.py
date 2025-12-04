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
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List, Literal
from datetime import datetime

from models.events import SporStatus, SporType, GrunnlagResponsResultat, VederlagBeregningResultat, FristBeregningResultat


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
    ikon: Optional[str] = None  # f.eks. "check", "clock", "x"


# ============ TAB: OVERSIKT ============

class SporKort(BaseModel):
    """Kort sammendrag av ett spor for oversikt-fanen"""
    spor: SporType
    tittel: str  # "Grunnlag", "Vederlag", "Frist"
    status: StatusBadge
    aktiv: bool  # Om sporet er aktivt i saken

    # Hovedverdi
    verdi_label: str  # "Krevd beløp", "Krevd dager"
    verdi_krevd: Optional[str] = None  # "150 000 NOK", "14 dager"
    verdi_godkjent: Optional[str] = None

    # Neste handling for dette sporet
    neste_handling: Optional[str] = None


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
    spor: List[SporKort]

    # Neste handling globalt
    neste_handling: str
    neste_handling_rolle: Optional[Literal["TE", "BH"]] = None

    # Aggregerte verdier
    total_krevd: float
    total_godkjent: float
    total_dager_krevd: Optional[int] = None
    total_dager_godkjent: Optional[int] = None

    # Metadata
    opprettet: datetime
    siste_aktivitet: datetime

    # Parter
    te_navn: Optional[str] = None
    bh_navn: Optional[str] = None
    prosjekt_navn: Optional[str] = None


# ============ TAB: GRUNNLAG ============

class GrunnlagHistorikkEntry(BaseModel):
    """Én versjon av grunnlaget i historikken"""
    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal["opprettet", "oppdatert", "trukket"]

    # Data på dette tidspunktet
    hovedkategori: str
    underkategori: str
    beskrivelse: str
    kontraktsreferanser: List[str]


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
    kontraktsreferanser: List[str]
    vedlegg: List[dict]  # {id, navn, url}

    # BH respons (hvis finnes)
    bh_har_svart: bool
    bh_resultat: Optional[GrunnlagResponsResultat] = None
    bh_begrunnelse: Optional[str] = None
    bh_svart_dato: Optional[datetime] = None
    bh_svart_av: Optional[str] = None

    # Handlinger tilgjengelig
    kan_redigere: bool  # TE kan redigere hvis ikke låst
    kan_svare: bool  # BH kan svare hvis sendt og ikke besvart

    # Historikk (alle versjoner)
    historikk: List[GrunnlagHistorikkEntry]


# ============ TAB: VEDERLAG ============

class VederlagPostering(BaseModel):
    """Én post i kostnadsoppstillingen"""
    beskrivelse: str
    antall: Optional[float] = None
    enhet: Optional[str] = None  # "timer", "stk", "m2"
    enhetspris: Optional[float] = None
    sum: float


class VederlagHistorikkEntry(BaseModel):
    """Én versjon av vederlagskravet"""
    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal["sendt", "oppdatert", "trukket"]

    krav_belop: float
    metode: str
    metode_label: str


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
    rigg_drift_belop: Optional[float] = None

    # Detaljert spesifikasjon (hvis tilgjengelig)
    spesifikasjon: Optional[List[VederlagPostering]] = None

    # BH respons
    bh_har_svart: bool
    bh_resultat: Optional[VederlagBeregningResultat] = None
    bh_begrunnelse: Optional[str] = None
    bh_godkjent_belop: Optional[float] = None
    bh_godkjent_metode: Optional[str] = None
    bh_godkjent_metode_label: Optional[str] = None
    bh_svart_dato: Optional[datetime] = None

    # Differanse-visning
    @computed_field
    @property
    def differanse(self) -> Optional[float]:
        if self.bh_godkjent_belop is not None:
            return self.krav_belop - self.bh_godkjent_belop
        return None

    @computed_field
    @property
    def godkjenningsgrad(self) -> Optional[float]:
        if self.krav_belop > 0 and self.bh_godkjent_belop is not None:
            return round((self.bh_godkjent_belop / self.krav_belop) * 100, 1)
        return None

    # Handlinger
    kan_redigere: bool
    kan_svare: bool
    krever_grunnlag_godkjent: bool  # Advarsel hvis grunnlag ikke er godkjent

    # Historikk
    historikk: List[VederlagHistorikkEntry]


# ============ TAB: TID (FRIST) ============

class FristHistorikkEntry(BaseModel):
    """Én versjon av fristkravet"""
    versjon: int
    tidsstempel: datetime
    aktor: AktorInfo
    endring_type: Literal["sendt", "oppdatert", "trukket"]

    krav_dager: int
    frist_type: str


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
    frist_type: str  # "kalenderdager" eller "arbeidsdager"
    frist_type_label: str
    krav_begrunnelse: str
    milepael_pavirket: Optional[str] = None
    foreslatt_ny_sluttdato: Optional[str] = None

    # BH respons
    bh_har_svart: bool
    bh_resultat: Optional[FristBeregningResultat] = None
    bh_begrunnelse: Optional[str] = None
    bh_godkjent_dager: Optional[int] = None
    bh_ny_sluttdato: Optional[str] = None
    bh_svart_dato: Optional[datetime] = None

    # Differanse
    @computed_field
    @property
    def differanse_dager(self) -> Optional[int]:
        if self.bh_godkjent_dager is not None:
            return self.krav_dager - self.bh_godkjent_dager
        return None

    # Handlinger
    kan_redigere: bool
    kan_svare: bool

    # Historikk
    historikk: List[FristHistorikkEntry]


# ============ TAB: TIDSLINJE ============

class TidslinjeEntry(BaseModel):
    """Én hendelse i tidslinjen"""
    event_id: str
    tidsstempel: datetime
    type_label: str  # "Grunnlag sendt", "BH svarte på vederlag"
    aktor: AktorInfo
    spor: Optional[SporType] = None

    # Visuell info
    ikon: str  # "file", "money", "clock", "check", "x"
    farge: str  # spor-farge

    # Detaljer (ekspanderbart)
    sammendrag: str
    detaljer: Optional[dict] = None  # Full event-data for ekspandert visning


class TidslinjeResponse(BaseModel):
    """
    API-respons for Tidslinje-fanen.

    Viser full historikk som en kronologisk tidslinje.
    """
    sak_id: str
    antall_events: int
    events: List[TidslinjeEntry]

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
    etag: Optional[str] = None  # For caching


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
    validation_errors: Optional[List[ValidationError]] = None
