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


# ============ VEDERLAG ENUMS ============

class VederlagsMetode(str, Enum):
    """NS 8407 vederlagsmetoder"""
    KONTRAKT_EP = "kontrakt_ep"  # Kontraktens enhetspriser
    JUSTERT_EP = "justert_ep"  # Justerte enhetspriser
    REGNING = "regning"  # Regningsarbeid
    TILBUD = "tilbud"  # Fastpris / Tilbud
    SKJONN = "skjonn"  # Skjønnsmessig vurdering


class VederlagBeregningResultat(str, Enum):
    """Resultat av beregningsvurdering (Port 2 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"
    AVSLATT_TOTALT = "avslatt_totalt"  # Kun ved f.eks. dobbeltfakturering, ikke grunnlag


# FJERNET: avslatt_uenig_grunnlag - det hører hjemme i Grunnlag-sporet, ikke her!
# Vederlag-responsen skal kun beskrive beregningen, ikke ansvar.


# ============ FRIST ENUMS ============

class FristVarselType(str, Enum):
    """Type varsel for frist (NS 8407 §33)"""
    NOYTRALT = "noytralt"  # §33.4 - Nøytralt varsel (uten dager)
    SPESIFISERT = "spesifisert"  # §33.6 - Spesifisert krav (med dager)
    BEGGE = "begge"  # Først nøytralt, så spesifisert


class FristBeregningResultat(str, Enum):
    """Resultat av fristberegning (Port 3 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"
    DELVIS_GODKJENT = "delvis_godkjent"
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"


# FJERNET: avslatt_uenig_grunnlag - det hører hjemme i Grunnlag-sporet!
# Frist-responsen skal kun beskrive tid-vurderingen, ikke ansvar.


# Generic response result (for backward compatibility)
class ResponsResultat(str, Enum):
    """Mulige utfall av en BH-respons (generisk)"""
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
    hovedkategori: str = Field(..., description="Hovedkategori (NS 8407 code)")
    underkategori: Union[str, List[str]] = Field(
        ...,
        description="Underkategori - can be single string or array of codes"
    )
    beskrivelse: str = Field(..., min_length=1, description="Beskrivelse av forholdet")
    dato_oppdaget: str = Field(..., description="Når forholdet ble oppdaget (YYYY-MM-DD)")
    dato_varsel_sendt: Optional[str] = Field(
        default=None,
        description="Når varselet faktisk ble sendt til BH (kan være forskjellig fra oppdaget)"
    )
    varsel_metode: Optional[List[str]] = Field(
        default=None,
        description="Metoder brukt for å varsle BH (f.eks. ['epost', 'byggemote'])"
    )
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
    """
    Data for vederlagskrav (Entreprenørens krav).

    Denne modellen inneholder TEs krav på penger, inkludert dokumentasjon
    av alle relevante varsler som kreves etter NS 8407.
    """
    krav_belop: float = Field(..., ge=0, description="Krevd beløp i NOK (ekskl. mva)")
    metode: VederlagsMetode = Field(
        ...,
        description="Vederlagsmetode etter NS 8407"
    )
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # Detaljert spesifikasjon
    spesifikasjon: Optional[dict] = Field(
        default=None,
        description="Detaljert kostnadsoppstilling (poster, timer, materialer, etc.)"
    )

    # ============ PORT 1: SPESIFIKKE VARSLER (NS 8407) ============
    # Disse varselfristene er kritiske for om kravet kan tapes ved preklusjon.
    # BH skal vurdere om disse er sendt i tide.

    # Rigg & Drift (§34.1.3)
    inkluderer_rigg_drift: bool = Field(
        default=False,
        description="Om kravet inkluderer rigg/drift-kostnader"
    )
    saerskilt_varsel_rigg_drift_dato: Optional[str] = Field(
        default=None,
        description="Dato for særskilt varsel om rigg/drift (YYYY-MM-DD) - §34.1.3"
    )
    rigg_drift_belop: Optional[float] = Field(
        default=None,
        description="Separat beløp for rigg/drift hvis aktuelt"
    )

    # Justerte enhetspriser (§34.3.3)
    krever_justert_ep: bool = Field(
        default=False,
        description="Om kravet krever justering av kontraktens enhetspriser"
    )
    varsel_justert_ep_dato: Optional[str] = Field(
        default=None,
        description="Dato for varsel om justerte enhetspriser (YYYY-MM-DD) - §34.3.3"
    )

    # Regningsarbeid (§30.1)
    krever_regningsarbeid: bool = Field(
        default=False,
        description="Om kravet involverer regningsarbeid"
    )
    varsel_start_regning_dato: Optional[str] = Field(
        default=None,
        description="Dato BH ble varslet før regningsarbeid startet (YYYY-MM-DD) - §30.1"
    )

    # Generelt krav fremmet
    krav_fremmet_dato: Optional[str] = Field(
        default=None,
        description="Dato spesifisert vederlagskrav ble fremmet (YYYY-MM-DD)"
    )

    # Tilleggsinfo
    inkluderer_produktivitetstap: bool = Field(
        default=False,
        description="Om kravet inkluderer produktivitetstap"
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
    """
    Data for fristforlengelseskrav (Entreprenørens krav).

    Denne modellen støtter både nøytralt varsel (§33.4) og spesifisert krav (§33.6).

    NS 8407 skiller mellom:
    - Nøytralt varsel: Varsler om at det *kan* bli krav, uten å spesifisere antall dager
    - Spesifisert krav: Konkret krav om X antall dager
    """

    # ============ VARSELTYPE (PORT 1) ============
    varsel_type: FristVarselType = Field(
        ...,
        description="Type varsel sendt til BH"
    )

    # Nøytralt varsel (§33.4) - kan sendes uten dager
    noytralt_varsel_dato: Optional[str] = Field(
        default=None,
        description="Dato for nøytralt varsel (YYYY-MM-DD) - §33.4"
    )

    # Spesifisert krav (§33.6) - må inneholde dager
    spesifisert_krav_dato: Optional[str] = Field(
        default=None,
        description="Dato for spesifisert krav (YYYY-MM-DD) - §33.6"
    )

    # ============ KRAVET (Kun relevant ved SPESIFISERT eller BEGGE) ============
    antall_dager: Optional[int] = Field(
        default=None,
        ge=0,
        description="Antall dager forlengelse (kun ved spesifisert krav)"
    )
    frist_type: Literal["kalenderdager", "arbeidsdager"] = Field(
        default="kalenderdager",
        description="Type dager"
    )
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # ============ FREMDRIFTSINFO (PORT 2 - Vilkår) ============
    # Dette brukes av BH for å vurdere om forholdet faktisk har medført hindring.
    pavirker_kritisk_linje: bool = Field(
        default=False,
        description="Om forsinkelsen påvirker kritisk linje/slutt­frist"
    )
    milepael_pavirket: Optional[str] = Field(
        default=None,
        description="Hvilken milepæl som påvirkes"
    )
    fremdriftsanalyse_vedlagt: bool = Field(
        default=False,
        description="Om det er vedlagt fremdriftsanalyse/planleggingsgrunnlag"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Foreslått ny sluttdato (YYYY-MM-DD)"
    )

    @field_validator('antall_dager')
    @classmethod
    def validate_antall_dager(cls, v, info):
        """Valider at antall_dager er satt hvis varsel_type er SPESIFISERT eller BEGGE"""
        varsel_type = info.data.get('varsel_type')
        if varsel_type in [FristVarselType.SPESIFISERT, FristVarselType.BEGGE]:
            if v is None:
                raise ValueError("antall_dager må være satt for spesifisert krav")
        return v


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


class VederlagResponsData(BaseModel):
    """
    Byggherrens respons på vederlagskrav (Port-modellen).

    VIKTIG: Denne modellen beskriver KUN beregningen/utmålingen av penger.
    Avslag basert på grunnlag (ansvar) håndteres i Grunnlag-sporet.

    Dette muliggjør subsidiære betraktninger:
    - BH kan avvise Grunnlag (ansvar), MEN samtidig godkjenne beregningen
      som subsidiær vurdering ("hvis jeg hadde hatt ansvar, er 50k riktig").
    """

    # ============ PORT 1: SPESIFIKKE VARSLER FOR PENGER ============
    # Sjekk av om kravtypen er varslet i tide (preklusjon).

    # Rigg & Drift (§34.1.3)
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = Field(
        default=None,
        description="Er det varslet særskilt om rigg/drift uten ugrunnet opphold? (§34.1.3)"
    )

    # Justerte enhetspriser (§34.3.3)
    varsel_justert_ep_ok: Optional[bool] = Field(
        default=None,
        description="Er det varslet om justerte enhetspriser uten ugrunnet opphold? (§34.3.3)"
    )

    # Regningsarbeid (§30.1)
    varsel_start_regning_ok: Optional[bool] = Field(
        default=None,
        description="Ble BH varslet før regningsarbeid startet? (§30.1)"
    )

    # Generelt krav fremmet i tide
    krav_fremmet_i_tide: bool = Field(
        default=True,
        description="Er vederlagskravet fremmet uten ugrunnet opphold?"
    )

    begrunnelse_varsel: Optional[str] = Field(
        default=None,
        description="Begrunnelse for vurdering av varsler/frister"
    )

    # ============ PORT 2: BEREGNING & METODE (Utmålingen) ============
    # Dette er den "rene" beregningen - vurderes prinsipalt eller subsidiært.

    vederlagsmetode: Optional[VederlagsMetode] = Field(
        default=None,
        description="Hvilken metode BH legger til grunn"
    )

    beregnings_resultat: VederlagBeregningResultat = Field(
        ...,
        description="BHs vurdering av kravets størrelse (ren beregning)"
    )

    godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent beløp i NOK (ekskl. mva). Utbetales kun hvis Grunnlag også godkjennes."
    )

    begrunnelse_beregning: str = Field(
        default="",
        description="BHs kommentar til beregningen"
    )

    frist_for_spesifikasjon: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere ytterligere spesifikasjon (YYYY-MM-DD)"
    )


class FristResponsData(BaseModel):
    """
    Byggherrens respons på fristforlengelseskrav (Port-modellen).

    VIKTIG: Denne modellen beskriver KUN tid-vurderingen.
    Avslag basert på grunnlag (ansvar) håndteres i Grunnlag-sporet.

    Dette muliggjør subsidiære betraktninger:
    - BH kan avvise Grunnlag (ansvar), MEN samtidig godkjenne dagberegningen
      som subsidiær vurdering ("hvis jeg hadde hatt ansvar, er 14 dager riktig").

    Port-modellen med tre sekvensielle vurderinger:
    1. PORT 1: Er varselet sendt i tide? (Preklusjon)
    2. PORT 2: Har forholdet medført faktisk fremdriftshindring? (Vilkår)
    3. PORT 3: Hvor mange dager godkjennes? (Utmåling)
    """

    # ============ PORT 1: PREKLUSJON (Varslene) ============
    # Sjekker om TE har fulgt spillereglene for tidskrav (NS 8407 §33).

    # Nøytralt varsel (§33.4)
    noytralt_varsel_ok: Optional[bool] = Field(
        default=None,
        description="Er nøytralt varsel sendt i tide? (§33.4). None hvis ikke relevant."
    )

    # Spesifisert krav (§33.6)
    spesifisert_krav_ok: bool = Field(
        default=True,
        description="Er spesifisert krav sendt i tide? (§33.6)"
    )

    # Hvis spesifisert krav er for sent
    har_bh_etterlyst: Optional[bool] = Field(
        default=None,
        description="Har BH etterlyst kravet skriftlig? (§33.6.2). Relevant kun hvis krav er sent."
    )

    begrunnelse_varsel: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse for vurdering av varsling"
    )

    # ============ PORT 2: VILKÅR (Årsakssammenheng) ============
    # Dette er IKKE vurdering av "Grunnlaget" (Event 1), men om grunnlaget
    # faktisk har medført en fremdriftshindring (§33.1).

    vilkar_oppfylt: bool = Field(
        default=True,
        description="Har forholdet medført en faktisk fremdriftshindring? (§33.1)"
    )

    begrunnelse_vilkar: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse for vurdering av årsakssammenheng"
    )

    # ============ PORT 3: UTMÅLING (Beregning av dager) ============
    # Den "rene" dagberegningen - vurderes prinsipalt eller subsidiært.

    beregnings_resultat: FristBeregningResultat = Field(
        ...,
        description="BHs vurdering av antall dager (ren beregning)"
    )

    godkjent_dager: Optional[int] = Field(
        default=None,
        description="Godkjent antall dager. Innvilges kun hvis Grunnlag også godkjennes."
    )

    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="BH-godkjent ny sluttdato (YYYY-MM-DD)"
    )

    begrunnelse_beregning: Optional[str] = Field(
        default=None,
        description="BHs kommentar til dagberegningen"
    )

    frist_for_spesifisering: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere ytterligere spesifikasjon/fremdriftsplan (YYYY-MM-DD)"
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
