"""
SakState - Aggregert tilstand for en sak.

Dette er "view"-modellen som frontend bruker.
Den beregnes fra event-loggen og representerer "nå-situasjonen".

SakState er READ-ONLY og regenereres hver gang fra events.
"""
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List, Union
from datetime import datetime

from models.events import (
    SporStatus,
    SporType,
    ResponsResultat,
    VederlagResponsResultat,
    FristResponsResultat,
    AnyEvent,
)


# ============ SPOR-TILSTANDER ============

class GrunnlagTilstand(BaseModel):
    """Aggregert tilstand for grunnlag-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for grunnlag"
    )
    hovedkategori: Optional[str] = Field(default=None)
    underkategori: Optional[Union[str, List[str]]] = Field(
        default=None,
        description="Can be single string or array of codes"
    )
    beskrivelse: Optional[str] = Field(default=None)
    dato_oppdaget: Optional[str] = Field(default=None)
    dato_varsel_sendt: Optional[str] = Field(
        default=None,
        description="When warning was actually sent to BH"
    )
    varsel_metode: Optional[List[str]] = Field(
        default=None,
        description="Methods used to notify BH (e.g., ['epost', 'byggemote'])"
    )
    kontraktsreferanser: List[str] = Field(default_factory=list)

    # BH respons
    bh_resultat: Optional[ResponsResultat] = Field(
        default=None,
        description="BHs siste respons"
    )
    bh_begrunnelse: Optional[str] = Field(default=None)
    laast: bool = Field(
        default=False,
        description="Om grunnlaget er låst (godkjent og kan ikke endres)"
    )

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


class VederlagTilstand(BaseModel):
    """Aggregert tilstand for vederlag-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for vederlag"
    )

    # Siste krav fra TE
    krevd_belop: Optional[float] = Field(default=None)
    metode: Optional[str] = Field(
        default=None,
        description="Uses codes from VEDERLAGSMETODER_OPTIONS"
    )
    begrunnelse: Optional[str] = Field(default=None)
    inkluderer_produktivitetstap: bool = Field(default=False)
    inkluderer_rigg_drift: bool = Field(default=False)
    saerskilt_varsel_rigg_drift: bool = Field(
        default=False,
        description="Separate notification for rigg/drift"
    )

    # BH respons
    bh_resultat: Optional[Union[VederlagResponsResultat, ResponsResultat]] = Field(
        default=None,
        description="Use specific vederlag response type (backward compatible)"
    )
    bh_begrunnelse: Optional[str] = Field(default=None)
    bh_metode: Optional[str] = Field(
        default=None,
        description="If BH approves with different method"
    )
    godkjent_belop: Optional[float] = Field(
        default=None,
        description="Beløp godkjent av BH (hvis delvis/full godkjenning)"
    )
    godkjent_metode: Optional[str] = Field(
        default=None,
        description="Deprecated: use bh_metode instead"
    )

    # Differanse-info (nyttig for UI)
    @computed_field
    @property
    def differanse(self) -> Optional[float]:
        """Differansen mellom krevd og godkjent beløp"""
        if self.krevd_belop is not None and self.godkjent_belop is not None:
            return self.krevd_belop - self.godkjent_belop
        return None

    @computed_field
    @property
    def godkjenningsgrad_prosent(self) -> Optional[float]:
        """Hvor mange prosent av kravet som er godkjent"""
        if self.krevd_belop and self.krevd_belop > 0 and self.godkjent_belop is not None:
            return round((self.godkjent_belop / self.krevd_belop) * 100, 1)
        return None

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


class FristTilstand(BaseModel):
    """Aggregert tilstand for frist-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for frist"
    )

    # Siste krav fra TE
    krevd_dager: Optional[int] = Field(default=None)
    frist_type: Optional[str] = Field(default=None)
    begrunnelse: Optional[str] = Field(default=None)
    pavirker_kritisk_linje: bool = Field(
        default=False,
        description="Whether this affects critical path"
    )
    milepael_pavirket: Optional[str] = Field(default=None)

    # BH respons
    bh_resultat: Optional[Union[FristResponsResultat, ResponsResultat]] = Field(
        default=None,
        description="Use specific frist response type (backward compatible)"
    )
    bh_begrunnelse: Optional[str] = Field(default=None)
    godkjent_dager: Optional[int] = Field(
        default=None,
        description="Dager godkjent av BH"
    )
    ny_sluttdato: Optional[str] = Field(default=None)
    frist_for_spesifisering: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere ytterligere spesifikasjon (YYYY-MM-DD)"
    )

    # Differanse-info
    @computed_field
    @property
    def differanse_dager(self) -> Optional[int]:
        """Differansen mellom krevde og godkjente dager"""
        if self.krevd_dager is not None and self.godkjent_dager is not None:
            return self.krevd_dager - self.godkjent_dager
        return None

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


# ============ HOVEDMODELL ============

class SakState(BaseModel):
    """
    Aggregert tilstand for en hel sak.

    Dette er hovedmodellen som frontend bruker.
    Den beregnes av TimelineService basert på event-loggen.

    Merk: Denne modellen er READ-ONLY. Alle endringer skjer via events.
    """
    sak_id: str = Field(..., description="Sak-ID")
    sakstittel: str = Field(default="", description="Sakstittel")

    # De tre sporene
    grunnlag: GrunnlagTilstand = Field(
        default_factory=GrunnlagTilstand,
        description="Tilstand for grunnlag-sporet"
    )
    vederlag: VederlagTilstand = Field(
        default_factory=VederlagTilstand,
        description="Tilstand for vederlag-sporet"
    )
    frist: FristTilstand = Field(
        default_factory=FristTilstand,
        description="Tilstand for frist-sporet"
    )

    # Overordnet sak-status
    @computed_field
    @property
    def overordnet_status(self) -> str:
        """
        Beregner overordnet sak-status basert på spor-statuser.

        Regler:
        - UTKAST: Ingen spor er sendt ennå
        - SENDT: Minst ett spor er sendt, venter på BH
        - UNDER_BEHANDLING: BH har svart på minst ett spor
        - UNDER_FORHANDLING: BH har avvist/delvis godkjent noe
        - OMFORENT: Alle aktive spor er godkjent
        - LUKKET: Saken er lukket (EO utstedt eller trukket)
        """
        statuser = [
            self.grunnlag.status,
            self.vederlag.status,
            self.frist.status,
        ]

        # Filtrer ut IKKE_RELEVANT
        aktive_statuser = [s for s in statuser if s != SporStatus.IKKE_RELEVANT]

        if not aktive_statuser:
            return "INGEN_AKTIVE_SPOR"

        # Sjekk om alle er GODKJENT eller LAAST
        godkjent_statuser = {SporStatus.GODKJENT, SporStatus.LAAST}
        if all(s in godkjent_statuser for s in aktive_statuser):
            return "OMFORENT"

        # Sjekk om noen er TRUKKET
        if any(s == SporStatus.TRUKKET for s in aktive_statuser):
            if all(s == SporStatus.TRUKKET for s in aktive_statuser):
                return "LUKKET_TRUKKET"

        # Sjekk om noen er under forhandling
        forhandling_statuser = {SporStatus.UNDER_FORHANDLING, SporStatus.DELVIS_GODKJENT, SporStatus.AVVIST}
        if any(s in forhandling_statuser for s in aktive_statuser):
            return "UNDER_FORHANDLING"

        # Sjekk om noen er under behandling
        if any(s == SporStatus.UNDER_BEHANDLING for s in aktive_statuser):
            return "UNDER_BEHANDLING"

        # Sjekk om noen er sendt
        if any(s == SporStatus.SENDT for s in aktive_statuser):
            return "VENTER_PAA_SVAR"

        # Sjekk om alle er utkast
        if all(s == SporStatus.UTKAST for s in aktive_statuser):
            return "UTKAST"

        return "UKJENT"

    @computed_field
    @property
    def kan_utstede_eo(self) -> bool:
        """
        Sjekker om EO kan utstedes.

        Krav: Alle aktive spor må være GODKJENT eller LAAST.
        Grunnlag må være godkjent først.
        """
        if self.grunnlag.status == SporStatus.IKKE_RELEVANT:
            return False

        if self.grunnlag.status not in {SporStatus.GODKJENT, SporStatus.LAAST}:
            return False

        # Sjekk vederlag og frist hvis de er aktive
        for spor in [self.vederlag, self.frist]:
            if spor.status == SporStatus.IKKE_RELEVANT:
                continue
            if spor.status not in {SporStatus.GODKJENT, SporStatus.LAAST, SporStatus.TRUKKET}:
                return False

        return True

    @computed_field
    @property
    def neste_handling(self) -> dict:
        """
        Foreslår neste handling basert på tilstand.

        Returnerer dict med:
        - rolle: "TE" eller "BH"
        - handling: beskrivelse av hva som bør gjøres
        - spor: hvilket spor handlingen gjelder (eller None)
        """
        # Sjekk grunnlag først
        if self.grunnlag.status == SporStatus.UTKAST:
            return {"rolle": "TE", "handling": "Send varsel om grunnlag", "spor": "grunnlag"}

        if self.grunnlag.status == SporStatus.SENDT:
            return {"rolle": "BH", "handling": "Vurder grunnlag", "spor": "grunnlag"}

        if self.grunnlag.status == SporStatus.AVVIST:
            return {"rolle": "TE", "handling": "Oppdater grunnlag eller trekk saken", "spor": "grunnlag"}

        # Sjekk vederlag
        if self.vederlag.status == SporStatus.UTKAST:
            return {"rolle": "TE", "handling": "Send vederlagskrav", "spor": "vederlag"}

        if self.vederlag.status == SporStatus.SENDT:
            return {"rolle": "BH", "handling": "Vurder vederlagskrav", "spor": "vederlag"}

        if self.vederlag.status in {SporStatus.AVVIST, SporStatus.UNDER_FORHANDLING}:
            return {"rolle": "TE", "handling": "Oppdater vederlagskrav", "spor": "vederlag"}

        # Sjekk frist
        if self.frist.status == SporStatus.UTKAST:
            return {"rolle": "TE", "handling": "Send fristkrav", "spor": "frist"}

        if self.frist.status == SporStatus.SENDT:
            return {"rolle": "BH", "handling": "Vurder fristkrav", "spor": "frist"}

        if self.frist.status in {SporStatus.AVVIST, SporStatus.UNDER_FORHANDLING}:
            return {"rolle": "TE", "handling": "Oppdater fristkrav", "spor": "frist"}

        # Alt er klart
        if self.kan_utstede_eo:
            return {"rolle": "BH", "handling": "Utstede endringsordre (EO)", "spor": None}

        return {"rolle": None, "handling": "Ingen ventende handlinger", "spor": None}

    # Aggregerte summer (for oversikt)
    @computed_field
    @property
    def sum_krevd(self) -> float:
        """Total krevd sum"""
        return self.vederlag.krevd_belop or 0.0

    @computed_field
    @property
    def sum_godkjent(self) -> float:
        """Total godkjent sum"""
        return self.vederlag.godkjent_belop or 0.0

    # Tidslinje-info
    opprettet: Optional[datetime] = Field(default=None)
    siste_aktivitet: Optional[datetime] = Field(default=None)
    antall_events: int = Field(default=0)

    # Catenda-integrasjon (beholdt fra gammel modell)
    catenda_topic_id: Optional[str] = Field(default=None)
    catenda_project_id: Optional[str] = Field(default=None)

    # Parter
    te_navn: Optional[str] = Field(default=None)
    bh_navn: Optional[str] = Field(default=None)
    prosjekt_navn: Optional[str] = Field(default=None)


# ============ HELPERS FOR API ============

class SporOversikt(BaseModel):
    """Forenklet oversikt for et spor (brukes i listevisninger)"""
    spor: SporType
    status: SporStatus
    siste_aktivitet: Optional[datetime] = None

    # Spor-spesifikke verdier
    verdi_krevd: Optional[str] = Field(
        default=None,
        description="F.eks. '150 000 NOK' eller '14 dager'"
    )
    verdi_godkjent: Optional[str] = Field(
        default=None,
        description="F.eks. '120 000 NOK' eller '10 dager'"
    )


class SakOversikt(BaseModel):
    """
    Forenklet sak-oversikt for listevisninger.

    Brukes av frontend for å vise saker i en liste uten
    å laste inn full SakState.
    """
    sak_id: str
    sakstittel: str
    overordnet_status: str
    spor: List[SporOversikt]

    sum_krevd: float = 0.0
    sum_godkjent: float = 0.0
    dager_krevd: Optional[int] = None
    dager_godkjent: Optional[int] = None

    opprettet: Optional[datetime] = None
    siste_aktivitet: Optional[datetime] = None
    neste_handling_rolle: Optional[str] = None

    te_navn: Optional[str] = None
    prosjekt_navn: Optional[str] = None
