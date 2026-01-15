"""
Event-basert datamodell for Fravik-søknader.

Dette er kjernen i Event Sourcing for fravik fra utslippsfrie krav på byggeplasser.
Hver event er immutable og representerer en faktisk hendelse i tid.

Godkjenningsflyt:
1. Søker sender inn søknad (med maskiner)
2. BOI-rådgiver vurderer (per maskin)
3. Prosjektleder godkjenner
4. Arbeidsgruppe gir innstilling (per maskin)
5. Eier fatter endelig vedtak
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, List, Dict
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from models.cloudevents import CloudEventMixin


# ============ ENUMS ============

class FravikEventType(str, Enum):
    """Alle mulige event-typer for Fravik-søknader"""
    # Søknad-events
    SOKNAD_OPPRETTET = "fravik_soknad_opprettet"
    SOKNAD_OPPDATERT = "fravik_soknad_oppdatert"
    SOKNAD_SENDT_INN = "fravik_soknad_sendt_inn"
    SOKNAD_TRUKKET = "fravik_soknad_trukket"

    # Maskin-events
    MASKIN_LAGT_TIL = "fravik_maskin_lagt_til"
    MASKIN_OPPDATERT = "fravik_maskin_oppdatert"
    MASKIN_FJERNET = "fravik_maskin_fjernet"

    # BOI-rådgiver vurdering (per maskin)
    BOI_VURDERING = "fravik_boi_vurdering"
    BOI_RETURNERT = "fravik_boi_returnert"  # Krever mer dokumentasjon

    # Prosjektleder vurdering
    PL_VURDERING = "fravik_pl_vurdering"
    PL_RETURNERT = "fravik_pl_returnert"

    # Arbeidsgruppe vurdering (per maskin)
    ARBEIDSGRUPPE_VURDERING = "fravik_arbeidsgruppe_vurdering"

    # Eier beslutning
    EIER_GODKJENT = "fravik_eier_godkjent"
    EIER_AVSLATT = "fravik_eier_avslatt"
    EIER_DELVIS_GODKJENT = "fravik_eier_delvis_godkjent"


class FravikStatus(str, Enum):
    """Overordnet status for fravik-søknad"""
    UTKAST = "utkast"
    SENDT_INN = "sendt_inn"
    UNDER_BOI_VURDERING = "under_boi_vurdering"
    RETURNERT_FRA_BOI = "returnert_fra_boi"
    UNDER_PL_VURDERING = "under_pl_vurdering"
    RETURNERT_FRA_PL = "returnert_fra_pl"
    UNDER_ARBEIDSGRUPPE = "under_arbeidsgruppe"
    UNDER_EIER_BESLUTNING = "under_eier_beslutning"
    GODKJENT = "godkjent"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVSLATT = "avslatt"
    TRUKKET = "trukket"


class MaskinType(str, Enum):
    """Typer maskiner som kan søkes fravik for"""
    GRAVEMASKIN = "Gravemaskin"
    HJULLASTER = "Hjullaster"
    LIFT = "Lift"
    ANNET = "Annet"


class FravikBeslutning(str, Enum):
    """Beslutning for vurdering/godkjenning"""
    GODKJENT = "godkjent"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVSLATT = "avslatt"
    KREVER_AVKLARING = "krever_avklaring"


class FravikRolle(str, Enum):
    """Roller i fravik-prosessen"""
    SOKER = "SOKER"  # Entreprenør/søker
    BOI = "BOI"  # BOI-rådgiver
    PL = "PL"  # Prosjektleder
    ARBEIDSGRUPPE = "ARBEIDSGRUPPE"
    EIER = "EIER"  # Prosjekteier


# ============ DATA MODELLER ============

class MaskinData(BaseModel):
    """Data for en maskin i fravik-søknad"""
    maskin_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unik ID for maskinen"
    )
    maskin_type: MaskinType = Field(
        ...,
        description="Type maskin"
    )
    annet_type: Optional[str] = Field(
        default=None,
        description="Spesifisering hvis type er 'Annet'"
    )
    registreringsnummer: Optional[str] = Field(
        default=None,
        description="Registreringsnummer for maskinen"
    )
    start_dato: str = Field(
        ...,
        description="Når maskinen skal brukes fra (YYYY-MM-DD)"
    )
    slutt_dato: str = Field(
        ...,
        description="Når maskinen skal brukes til (YYYY-MM-DD)"
    )
    begrunnelse: str = Field(
        ...,
        min_length=1,
        description="Begrunnelse for hvorfor fravik trengs"
    )
    alternativer_vurdert: Optional[str] = Field(
        default=None,
        description="Hvilke alternativer som er vurdert"
    )
    markedsundersokelse: bool = Field(
        default=False,
        description="Om markedsundersøkelse er gjennomført"
    )
    undersøkte_leverandorer: Optional[str] = Field(
        default=None,
        description="Hvilke leverandører som er undersøkt"
    )
    erstatningsmaskin: Optional[str] = Field(
        default=None,
        description="Foreslått erstatningsmaskin"
    )
    erstatningsdrivstoff: Optional[str] = Field(
        default=None,
        description="Drivstoff for erstatningsmaskin (HVO100, biodrivstoff, etc.)"
    )
    arbeidsbeskrivelse: Optional[str] = Field(
        default=None,
        description="Beskrivelse av arbeidet maskinen skal utføre"
    )


class SoknadOpprettetData(BaseModel):
    """Data for opprettelse av fravik-søknad"""
    prosjekt_id: str = Field(
        ...,
        description="Prosjekt-ID"
    )
    prosjekt_navn: str = Field(
        ...,
        min_length=1,
        description="Navn på prosjektet"
    )
    prosjekt_nummer: Optional[str] = Field(
        default=None,
        description="Prosjektnummer"
    )
    rammeavtale: Optional[str] = Field(
        default=None,
        description="Rammeavtale (Grunnarbeider, Utomhusarbeider, etc.)"
    )
    hovedentreprenor: Optional[str] = Field(
        default=None,
        description="Hovedentreprenør"
    )
    soker_navn: str = Field(
        ...,
        min_length=1,
        description="Navn på søker"
    )
    soker_epost: Optional[str] = Field(
        default=None,
        description="E-post til søker"
    )
    soknad_type: Literal["machine", "infrastructure"] = Field(
        ...,
        description="Type søknad (maskin eller infrastruktur)"
    )
    frist_for_svar: Optional[str] = Field(
        default=None,
        description="Ønsket frist for svar (YYYY-MM-DD)"
    )
    er_haste: bool = Field(
        default=False,
        description="Om søknaden haster"
    )
    haste_begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for hastebehandling"
    )


class SoknadOppdatertData(BaseModel):
    """Data for oppdatering av søknad (partielle felt)"""
    prosjekt_navn: Optional[str] = None
    prosjekt_nummer: Optional[str] = None
    rammeavtale: Optional[str] = None
    hovedentreprenor: Optional[str] = None
    soker_navn: Optional[str] = None
    soker_epost: Optional[str] = None
    frist_for_svar: Optional[str] = None
    er_haste: Optional[bool] = None
    haste_begrunnelse: Optional[str] = None
    avbotende_tiltak: Optional[str] = None
    konsekvenser_ved_avslag: Optional[str] = None


class MaskinVurderingData(BaseModel):
    """Data for vurdering av en maskin (BOI eller Arbeidsgruppe)"""
    maskin_id: str = Field(
        ...,
        description="ID til maskinen som vurderes"
    )
    beslutning: FravikBeslutning = Field(
        ...,
        description="Vurdering/beslutning"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar til vurderingen"
    )
    vilkar: Optional[List[str]] = Field(
        default=None,
        description="Eventuelle vilkår for godkjenning"
    )


class BOIVurderingData(BaseModel):
    """Data for BOI-rådgivers vurdering"""
    dokumentasjon_tilstrekkelig: bool = Field(
        ...,
        description="Om dokumentasjonen er tilstrekkelig"
    )
    maskin_vurderinger: List[MaskinVurderingData] = Field(
        default_factory=list,
        description="Vurdering per maskin"
    )
    samlet_anbefaling: Optional[FravikBeslutning] = Field(
        default=None,
        description="Samlet anbefaling (beregnes automatisk fra maskin-vurderinger)"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Generell kommentar"
    )
    manglende_dokumentasjon: Optional[str] = Field(
        default=None,
        description="Hva som mangler hvis dokumentasjon ikke er tilstrekkelig"
    )


class PLVurderingData(BaseModel):
    """Data for prosjektleders vurdering"""
    dokumentasjon_tilstrekkelig: bool = Field(
        ...,
        description="Om dokumentasjonen er tilstrekkelig"
    )
    anbefaling: FravikBeslutning = Field(
        ...,
        description="Prosjektleders anbefaling"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar"
    )
    manglende_dokumentasjon: Optional[str] = Field(
        default=None,
        description="Hva som mangler hvis dokumentasjon ikke er tilstrekkelig"
    )


class ArbeidsgruppeVurderingData(BaseModel):
    """Data for arbeidsgruppens vurdering"""
    maskin_vurderinger: List[MaskinVurderingData] = Field(
        ...,
        description="Vurdering per maskin"
    )
    samlet_innstilling: FravikBeslutning = Field(
        ...,
        description="Samlet innstilling"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Generell kommentar fra arbeidsgruppen"
    )
    deltakere: Optional[List[str]] = Field(
        default=None,
        description="Deltakere i arbeidsgruppen"
    )


class EierBeslutningData(BaseModel):
    """Data for eiers beslutning"""
    folger_arbeidsgruppen: bool = Field(
        ...,
        description="Om eier følger arbeidsgruppens innstilling"
    )
    beslutning: FravikBeslutning = Field(
        ...,
        description="Eiers beslutning"
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse (påkrevd hvis eier avviker fra arbeidsgruppen)"
    )
    maskin_beslutninger: Optional[List[MaskinVurderingData]] = Field(
        default=None,
        description="Beslutning per maskin (hvis delvis godkjent)"
    )

    @model_validator(mode='after')
    def validate_begrunnelse(self):
        """Krev begrunnelse hvis eier avviker fra arbeidsgruppen"""
        if not self.folger_arbeidsgruppen and not self.begrunnelse:
            raise ValueError("Begrunnelse er påkrevd når eier avviker fra arbeidsgruppens innstilling")
        return self


# ============ BASE FRAVIK EVENT ============

class FravikEvent(CloudEventMixin, BaseModel):
    """
    Base-klasse for alle Fravik-events.

    Følger samme pattern som SakEvent, men med Fravik-spesifikke felt.
    """
    event_id: str = Field(
        default_factory=lambda: str(uuid4()),
        description="Unik event-identifikator"
    )
    soknad_id: str = Field(
        ...,
        description="Hvilken fravik-søknad denne eventen tilhører"
    )
    event_type: FravikEventType = Field(
        ...,
        description="Type hendelse"
    )
    tidsstempel: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Når hendelsen skjedde (UTC)"
    )
    aktor: str = Field(
        ...,
        description="Hvem som utførte handlingen"
    )
    aktor_rolle: FravikRolle = Field(
        ...,
        description="Rolle til aktøren"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Valgfri kommentar"
    )
    refererer_til_event_id: Optional[str] = Field(
        default=None,
        description="Event-ID som denne eventen svarer på"
    )

    # For CloudEvents compatibility - map soknad_id til sak_id
    @property
    def sak_id(self) -> str:
        """CloudEvents mixin bruker sak_id, vi mapper til soknad_id"""
        return self.soknad_id

    model_config = {"extra": "allow"}


# ============ SPESIFIKKE EVENTS ============

class SoknadOpprettetEvent(FravikEvent):
    """Event for opprettelse av fravik-søknad"""
    event_type: Literal[FravikEventType.SOKNAD_OPPRETTET] = Field(
        default=FravikEventType.SOKNAD_OPPRETTET
    )
    data: SoknadOpprettetData = Field(
        ...,
        description="Søknadsdata"
    )


class SoknadOppdatertEvent(FravikEvent):
    """Event for oppdatering av søknad"""
    event_type: Literal[FravikEventType.SOKNAD_OPPDATERT] = Field(
        default=FravikEventType.SOKNAD_OPPDATERT
    )
    data: SoknadOppdatertData = Field(
        ...,
        description="Oppdaterte felt"
    )


class SoknadSendtInnEvent(FravikEvent):
    """Event for innsending av søknad til vurdering"""
    event_type: Literal[FravikEventType.SOKNAD_SENDT_INN] = Field(
        default=FravikEventType.SOKNAD_SENDT_INN
    )


class SoknadTrukketEvent(FravikEvent):
    """Event for tilbaketrekking av søknad"""
    event_type: Literal[FravikEventType.SOKNAD_TRUKKET] = Field(
        default=FravikEventType.SOKNAD_TRUKKET
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for tilbaketrekking"
    )


class MaskinLagtTilEvent(FravikEvent):
    """Event for å legge til maskin i søknad"""
    event_type: Literal[FravikEventType.MASKIN_LAGT_TIL] = Field(
        default=FravikEventType.MASKIN_LAGT_TIL
    )
    data: MaskinData = Field(
        ...,
        description="Maskindata"
    )


class MaskinOppdatertEvent(FravikEvent):
    """Event for oppdatering av maskin"""
    event_type: Literal[FravikEventType.MASKIN_OPPDATERT] = Field(
        default=FravikEventType.MASKIN_OPPDATERT
    )
    maskin_id: str = Field(
        ...,
        description="ID til maskinen som oppdateres"
    )
    data: MaskinData = Field(
        ...,
        description="Oppdatert maskindata"
    )


class MaskinFjernetEvent(FravikEvent):
    """Event for fjerning av maskin fra søknad"""
    event_type: Literal[FravikEventType.MASKIN_FJERNET] = Field(
        default=FravikEventType.MASKIN_FJERNET
    )
    maskin_id: str = Field(
        ...,
        description="ID til maskinen som fjernes"
    )


class BOIVurderingEvent(FravikEvent):
    """Event for BOI-rådgivers vurdering"""
    event_type: Literal[FravikEventType.BOI_VURDERING] = Field(
        default=FravikEventType.BOI_VURDERING
    )
    data: BOIVurderingData = Field(
        ...,
        description="Vurderingsdata"
    )


class BOIReturnertevent(FravikEvent):
    """Event for retur av søknad fra BOI (krever mer dokumentasjon)"""
    event_type: Literal[FravikEventType.BOI_RETURNERT] = Field(
        default=FravikEventType.BOI_RETURNERT
    )
    manglende_dokumentasjon: str = Field(
        ...,
        min_length=1,
        description="Hva som mangler"
    )


class PLVurderingEvent(FravikEvent):
    """Event for prosjektleders vurdering"""
    event_type: Literal[FravikEventType.PL_VURDERING] = Field(
        default=FravikEventType.PL_VURDERING
    )
    data: PLVurderingData = Field(
        ...,
        description="Vurderingsdata"
    )


class PLReturnertevent(FravikEvent):
    """Event for retur av søknad fra PL"""
    event_type: Literal[FravikEventType.PL_RETURNERT] = Field(
        default=FravikEventType.PL_RETURNERT
    )
    manglende_dokumentasjon: str = Field(
        ...,
        min_length=1,
        description="Hva som mangler"
    )


class ArbeidsgruppeVurderingEvent(FravikEvent):
    """Event for arbeidsgruppens vurdering"""
    event_type: Literal[FravikEventType.ARBEIDSGRUPPE_VURDERING] = Field(
        default=FravikEventType.ARBEIDSGRUPPE_VURDERING
    )
    data: ArbeidsgruppeVurderingData = Field(
        ...,
        description="Vurderingsdata"
    )


class EierGodkjentEvent(FravikEvent):
    """Event for eiers godkjenning"""
    event_type: Literal[FravikEventType.EIER_GODKJENT] = Field(
        default=FravikEventType.EIER_GODKJENT
    )
    data: EierBeslutningData = Field(
        ...,
        description="Beslutningsdata"
    )


class EierAvslattEvent(FravikEvent):
    """Event for eiers avslag"""
    event_type: Literal[FravikEventType.EIER_AVSLATT] = Field(
        default=FravikEventType.EIER_AVSLATT
    )
    data: EierBeslutningData = Field(
        ...,
        description="Beslutningsdata"
    )


class EierDelvisGodkjentEvent(FravikEvent):
    """Event for eiers delvise godkjenning"""
    event_type: Literal[FravikEventType.EIER_DELVIS_GODKJENT] = Field(
        default=FravikEventType.EIER_DELVIS_GODKJENT
    )
    data: EierBeslutningData = Field(
        ...,
        description="Beslutningsdata med per-maskin beslutninger"
    )


# ============ TYPE UNIONS ============

AnyFravikEvent = (
    SoknadOpprettetEvent
    | SoknadOppdatertEvent
    | SoknadSendtInnEvent
    | SoknadTrukketEvent
    | MaskinLagtTilEvent
    | MaskinOppdatertEvent
    | MaskinFjernetEvent
    | BOIVurderingEvent
    | BOIReturnertevent
    | PLVurderingEvent
    | PLReturnertevent
    | ArbeidsgruppeVurderingEvent
    | EierGodkjentEvent
    | EierAvslattEvent
    | EierDelvisGodkjentEvent
)


# ============ PARSE HELPERS ============

def parse_fravik_event(data: dict) -> AnyFravikEvent:
    """
    Parser en dict til riktig FravikEvent-type basert på event_type.

    Args:
        data: Dict med event-data

    Returns:
        Riktig event-instans

    Raises:
        ValueError: Hvis event_type er ukjent
    """
    event_type = data.get("event_type")

    if isinstance(event_type, str):
        try:
            event_type = FravikEventType(event_type)
        except ValueError:
            raise ValueError(f"Ukjent event_type: {event_type}")

    event_class_map = {
        FravikEventType.SOKNAD_OPPRETTET: SoknadOpprettetEvent,
        FravikEventType.SOKNAD_OPPDATERT: SoknadOppdatertEvent,
        FravikEventType.SOKNAD_SENDT_INN: SoknadSendtInnEvent,
        FravikEventType.SOKNAD_TRUKKET: SoknadTrukketEvent,
        FravikEventType.MASKIN_LAGT_TIL: MaskinLagtTilEvent,
        FravikEventType.MASKIN_OPPDATERT: MaskinOppdatertEvent,
        FravikEventType.MASKIN_FJERNET: MaskinFjernetEvent,
        FravikEventType.BOI_VURDERING: BOIVurderingEvent,
        FravikEventType.BOI_RETURNERT: BOIReturnertevent,
        FravikEventType.PL_VURDERING: PLVurderingEvent,
        FravikEventType.PL_RETURNERT: PLReturnertevent,
        FravikEventType.ARBEIDSGRUPPE_VURDERING: ArbeidsgruppeVurderingEvent,
        FravikEventType.EIER_GODKJENT: EierGodkjentEvent,
        FravikEventType.EIER_AVSLATT: EierAvslattEvent,
        FravikEventType.EIER_DELVIS_GODKJENT: EierDelvisGodkjentEvent,
    }

    event_class = event_class_map.get(event_type)
    if event_class is None:
        raise ValueError(f"Ingen event-klasse for event_type: {event_type}")

    return event_class.model_validate(data)
