"""
Event-basert datamodell for Unified Timeline Architecture.

Dette er kjernen i Event Sourcing Light-tilnærmingen.
I stedet for monolittiske revisjoner har vi atomære hendelser som
kan prosesseres uavhengig på tre parallelle spor:
- Grunnlag (Hvorfor?)
- Vederlag (Hva koster det?)
- Frist (Hvor lang tid?)

Hver event er immutable og representerer en faktisk hendelse i tid.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List, Union
from datetime import datetime
from enum import Enum
from uuid import uuid4


# ============ ENUMS FOR EVENT TYPES ============

class SporType(str, Enum):
    """De tre uavhengige sporene i saksbehandlingen"""
    GRUNNLAG = "grunnlag"
    VEDERLAG = "vederlag"
    FRIST = "frist"


class EventType(str, Enum):
    """Alle mulige event-typer i systemet"""
    # Grunnlag-events (TE)
    GRUNNLAG_OPPRETTET = "grunnlag_opprettet"
    GRUNNLAG_OPPDATERT = "grunnlag_oppdatert"
    GRUNNLAG_TRUKKET = "grunnlag_trukket"

    # Vederlag-events (TE)
    VEDERLAG_KRAV_SENDT = "vederlag_krav_sendt"
    VEDERLAG_KRAV_OPPDATERT = "vederlag_krav_oppdatert"
    VEDERLAG_KRAV_TRUKKET = "vederlag_krav_trukket"

    # Frist-events (TE)
    FRIST_KRAV_SENDT = "frist_krav_sendt"
    FRIST_KRAV_OPPDATERT = "frist_krav_oppdatert"
    FRIST_KRAV_TRUKKET = "frist_krav_trukket"

    # Respons-events (BH)
    RESPONS_GRUNNLAG = "respons_grunnlag"
    RESPONS_VEDERLAG = "respons_vederlag"
    RESPONS_FRIST = "respons_frist"

    # Saks-events
    SAK_OPPRETTET = "sak_opprettet"
    SAK_LUKKET = "sak_lukket"
    EO_UTSTEDT = "eo_utstedt"


class ResponsResultat(str, Enum):
    """Mulige utfall av en BH-respons"""
    GODKJENT = "godkjent"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVIST_UENIG = "avvist_uenig"
    AVVIST_FOR_SENT = "avvist_for_sent"
    KREVER_AVKLARING = "krever_avklaring"


class SporStatus(str, Enum):
    """Mulige statuser for hvert spor"""
    IKKE_RELEVANT = "ikke_relevant"
    UTKAST = "utkast"
    SENDT = "sendt"
    UNDER_BEHANDLING = "under_behandling"
    GODKJENT = "godkjent"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVIST = "avvist"
    UNDER_FORHANDLING = "under_forhandling"
    TRUKKET = "trukket"
    LAAST = "laast"  # Grunnlag kan låses etter godkjenning


# ============ BASE EVENT ============

class SakEvent(BaseModel):
    """
    Base-klasse for alle events i systemet.

    Hver event har:
    - Unik ID (for referanser)
    - Sak-ID (hvilken sak den tilhører)
    - Tidsstempel (når den skjedde)
    - Aktør (hvem som utførte handlingen)
    - Event-type (hva som skjedde)
    """
    event_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unik event-identifikator"
    )
    sak_id: str = Field(
        ...,
        description="Hvilken sak denne eventen tilhører"
    )
    event_type: EventType = Field(
        ...,
        description="Type hendelse"
    )
    tidsstempel: datetime = Field(
        default_factory=datetime.now,
        description="Når hendelsen skjedde"
    )
    aktor: str = Field(
        ...,
        description="Hvem som utførte handlingen (navn eller bruker-ID)"
    )
    aktor_rolle: Literal["TE", "BH"] = Field(
        ...,
        description="Rolle til aktøren (TE=Totalentreprenør, BH=Byggherre)"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Valgfri kommentar/begrunnelse"
    )

    # For å spore hvilken event denne er et svar på
    refererer_til_event_id: Optional[str] = Field(
        default=None,
        description="Event-ID som denne eventen svarer på"
    )

    model_config = {"extra": "allow"}


# ============ GRUNNLAG EVENTS ============

class GrunnlagData(BaseModel):
    """Data for grunnlag (erstatter Varsel)"""
    hovedkategori: str = Field(..., description="Hovedkategori (f.eks. 'Risiko')")
    underkategori: str = Field(..., description="Underkategori (f.eks. 'Grunnforhold')")
    beskrivelse: str = Field(..., min_length=1, description="Beskrivelse av forholdet")
    dato_oppdaget: str = Field(..., description="Når forholdet ble oppdaget (YYYY-MM-DD)")
    kontraktsreferanser: List[str] = Field(
        default_factory=list,
        description="Relevante kontraktsbestemmelser (f.eks. ['NS8407 §25.2', 'Kap. 3.2'])"
    )
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter"
    )


class GrunnlagEvent(SakEvent):
    """
    Event for grunnlag/varsel.

    Erstatter dagens statiske Varsel-modell.
    Grunnlaget kan nå oppdateres over tid, og BH kan
    godkjenne grunnlaget separat fra vederlag/frist.
    """
    event_type: EventType = Field(
        default=EventType.GRUNNLAG_OPPRETTET,
        description="Type grunnlag-event"
    )
    data: GrunnlagData = Field(
        ...,
        description="Grunnlagsdata"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [
            EventType.GRUNNLAG_OPPRETTET,
            EventType.GRUNNLAG_OPPDATERT,
            EventType.GRUNNLAG_TRUKKET,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for GrunnlagEvent: {v}")
        return v


# ============ VEDERLAG EVENTS ============

class VederlagData(BaseModel):
    """Data for vederlagskrav"""
    krav_belop: float = Field(..., ge=0, description="Krevd beløp i NOK")
    metode: str = Field(
        ...,
        description="Vederlagsmetode-kode (ENTREPRENORENS_TILBUD, KONTRAKTENS_ENHETSPRISER, etc.)"
    )
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # Detaljert spesifikasjon
    spesifikasjon: Optional[dict] = Field(
        default=None,
        description="Detaljert kostnadsoppstilling (poster, timer, materialer, etc.)"
    )

    # Tilleggsinfo
    inkluderer_produktivitetstap: bool = Field(
        default=False,
        description="Om kravet inkluderer produktivitetstap"
    )
    inkluderer_rigg_drift: bool = Field(
        default=False,
        description="Om kravet inkluderer rigg/drift"
    )
    rigg_drift_belop: Optional[float] = Field(
        default=None,
        description="Separat beløp for rigg/drift hvis aktuelt"
    )


class VederlagEvent(SakEvent):
    """
    Event for vederlagskrav (penger).

    Kan sendes og oppdateres uavhengig av grunnlag-status.
    BH kan godkjenne grunnlaget men fortsatt forhandle på pris.
    """
    event_type: EventType = Field(
        default=EventType.VEDERLAG_KRAV_SENDT,
        description="Type vederlag-event"
    )
    data: VederlagData = Field(
        ...,
        description="Vederlagsdata"
    )
    versjon: int = Field(
        default=1,
        description="Versjonsnummer for dette kravet (1, 2, 3...)"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [
            EventType.VEDERLAG_KRAV_SENDT,
            EventType.VEDERLAG_KRAV_OPPDATERT,
            EventType.VEDERLAG_KRAV_TRUKKET,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for VederlagEvent: {v}")
        return v


# ============ FRIST EVENTS ============

class FristData(BaseModel):
    """Data for fristforlengelseskrav"""
    antall_dager: int = Field(..., ge=0, description="Antall dager forlengelse")
    frist_type: Literal["kalenderdager", "arbeidsdager"] = Field(
        ...,
        description="Type dager"
    )
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # Fremdriftsinfo
    pavirker_kritisk_linje: bool = Field(
        default=False,
        description="Om forsinkelsen påvirker kritisk linje"
    )
    milepael_pavirket: Optional[str] = Field(
        default=None,
        description="Hvilken milepæl som påvirkes"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Foreslått ny sluttdato (YYYY-MM-DD)"
    )


class FristEvent(SakEvent):
    """
    Event for fristforlengelse (tid).

    Kan behandles uavhengig av vederlag.
    BH kan f.eks. gi fristforlengelse men avslå vederlag.
    """
    event_type: EventType = Field(
        default=EventType.FRIST_KRAV_SENDT,
        description="Type frist-event"
    )
    data: FristData = Field(
        ...,
        description="Fristdata"
    )
    versjon: int = Field(
        default=1,
        description="Versjonsnummer for dette kravet (1, 2, 3...)"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [
            EventType.FRIST_KRAV_SENDT,
            EventType.FRIST_KRAV_OPPDATERT,
            EventType.FRIST_KRAV_TRUKKET,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for FristEvent: {v}")
        return v


# ============ RESPONS EVENTS (BH) ============

class ResponsData(BaseModel):
    """Base data for BH-respons"""
    resultat: ResponsResultat = Field(
        ...,
        description="Utfallet av vurderingen"
    )
    begrunnelse: str = Field(
        default="",
        description="BHs begrunnelse"
    )
    varsel_for_sent: bool = Field(
        default=False,
        description="Om BH mener varselet kom for sent"
    )


class GrunnlagResponsData(ResponsData):
    """Spesifikk data for grunnlag-respons"""
    akseptert_kategori: Optional[str] = Field(
        default=None,
        description="BH kan akseptere men kategorisere annerledes"
    )
    krever_dokumentasjon: List[str] = Field(
        default_factory=list,
        description="Liste over dokumentasjon BH krever"
    )


class VederlagResponsData(ResponsData):
    """Spesifikk data for vederlag-respons"""
    godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent beløp (hvis delvis godkjent)"
    )
    godkjent_metode: Optional[str] = Field(
        default=None,
        description="BH-godkjent vederlagsmetode"
    )
    frist_for_spesifikasjon: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere spesifikasjon (YYYY-MM-DD)"
    )


class FristResponsData(ResponsData):
    """Spesifikk data for frist-respons"""
    godkjent_dager: Optional[int] = Field(
        default=None,
        description="Godkjent antall dager (hvis delvis godkjent)"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="BH-godkjent ny sluttdato"
    )


class ResponsEvent(SakEvent):
    """
    Event for BHs respons på et krav.

    VIKTIG: En respons-event MÅ referere til en spesifikk event
    via refererer_til_event_id. Dette gjør det mulig å:
    - Godkjenne grunnlag, men avslå vederlag
    - Gi delvise godkjenninger
    - Ha parallell saksbehandling
    """
    event_type: EventType = Field(
        ...,
        description="Type respons (RESPONS_GRUNNLAG, RESPONS_VEDERLAG, RESPONS_FRIST)"
    )
    spor: SporType = Field(
        ...,
        description="Hvilket spor denne responsen gjelder"
    )
    data: Union[GrunnlagResponsData, VederlagResponsData, FristResponsData] = Field(
        ...,
        description="Responsdata (type avhenger av spor)"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [
            EventType.RESPONS_GRUNNLAG,
            EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_FRIST,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for ResponsEvent: {v}")
        return v


# ============ SAKS-EVENTS ============

class SakOpprettetEvent(SakEvent):
    """Event når en ny sak opprettes"""
    event_type: EventType = Field(
        default=EventType.SAK_OPPRETTET,
        description="Sak opprettet"
    )
    sakstittel: str = Field(..., description="Sakstittel")
    prosjekt_id: Optional[str] = Field(default=None, description="Prosjekt-ID")
    catenda_topic_id: Optional[str] = Field(default=None, description="Catenda topic GUID")


class EOUtstedtEvent(SakEvent):
    """Event når endringsordre utstedes (saken lukkes positivt)"""
    event_type: EventType = Field(
        default=EventType.EO_UTSTEDT,
        description="EO utstedt"
    )
    eo_nummer: str = Field(..., description="Endringsordre-nummer")
    endelig_vederlag: float = Field(..., description="Endelig godkjent vederlag")
    endelig_frist_dager: Optional[int] = Field(
        default=None,
        description="Endelig godkjent fristforlengelse"
    )
    signert_av_te: str = Field(..., description="Signert av TE")
    signert_av_bh: str = Field(..., description="Signert av BH")


# ============ TYPE UNION ============

# Alle mulige event-typer for typing
AnyEvent = Union[
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    SakOpprettetEvent,
    EOUtstedtEvent,
]


# ============ EVENT PARSING ============

def parse_event(data: dict) -> AnyEvent:
    """
    Parse a dict into the correct event type.

    Uses event_type field to determine which model to instantiate.
    """
    event_type = data.get("event_type")

    if not event_type:
        raise ValueError("Mangler event_type i event-data")

    # Map event types to classes
    type_map = {
        EventType.SAK_OPPRETTET.value: SakOpprettetEvent,
        EventType.GRUNNLAG_OPPRETTET.value: GrunnlagEvent,
        EventType.GRUNNLAG_OPPDATERT.value: GrunnlagEvent,
        EventType.GRUNNLAG_TRUKKET.value: GrunnlagEvent,
        EventType.VEDERLAG_KRAV_SENDT.value: VederlagEvent,
        EventType.VEDERLAG_KRAV_OPPDATERT.value: VederlagEvent,
        EventType.VEDERLAG_KRAV_TRUKKET.value: VederlagEvent,
        EventType.FRIST_KRAV_SENDT.value: FristEvent,
        EventType.FRIST_KRAV_OPPDATERT.value: FristEvent,
        EventType.FRIST_KRAV_TRUKKET.value: FristEvent,
        EventType.RESPONS_GRUNNLAG.value: ResponsEvent,
        EventType.RESPONS_VEDERLAG.value: ResponsEvent,
        EventType.RESPONS_FRIST.value: ResponsEvent,
        EventType.EO_UTSTEDT.value: EOUtstedtEvent,
    }

    event_class = type_map.get(event_type)
    if not event_class:
        raise ValueError(f"Ukjent event_type: {event_type}")

    return event_class.model_validate(data)


def parse_event_from_request(request_data: dict) -> AnyEvent:
    """
    Parse API request into event, adding server-side fields.

    SECURITY: Validates that client doesn't send server-controlled fields.

    Adds:
    - event_id (generated)
    - tidsstempel (server time)
    """
    from uuid import uuid4

    # SIKKERHET: Blokker klient-kontrollerte felter
    forbidden_fields = {'event_id', 'tidsstempel'}
    for field in forbidden_fields:
        if field in request_data:
            raise ValueError(
                f"Feltet '{field}' kan ikke sendes av klient - genereres av server"
            )

    # Add server-controlled fields
    request_data["event_id"] = str(uuid4())
    request_data["tidsstempel"] = datetime.now().isoformat()

    return parse_event(request_data)
