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
from pydantic import BaseModel, Field, field_validator, model_validator
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
    KONTRAKT_EP = "kontrakt_ep"  # Kontraktens enhetspriser (§34.3.1) - Anvendelse av eksisterende enhetspriser. Indeksregulert iht. §26.2
    JUSTERT_EP = "justert_ep"  # Justerte enhetspriser (§34.3.2) - Enhetspriser justert for endrede forhold. Indeksregulert iht. §26.2
    REGNING = "regning"  # Regningsarbeid (§30.1) - Oppgjør etter medgått tid og materialer. Delvis indeksregulert (kun timerater)
    OVERSLAG = "overslag"  # Regningsarbeid med prisoverslag (§30.2). Delvis indeksregulert (kun timerater)
    TILBUD = "tilbud"  # Entreprenørens tilbud (§34.2.1) - TE gir pristilbud som BH kan akseptere. Ikke indeksregulert
    
class VederlagBeregningResultat(str, Enum):
    """Resultat av beregningsvurdering (Port 2 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt" # Enighet om sum og metode. Brukes også ved subsidiær godkjenning (hvis grunnlag er avvist).
    DELVIS_GODKJENT = "delvis_godkjent" # Enighet om at det skal betales (prinsipalt eller subsidiært), men uenighet om beløpet (f.eks. antall timer eller påslag).
    GODKJENT_ANNEN_METODE = "godkjent_annen_metode" # BH aksepterer beløpet, men endrer forutsetningen (f.eks. fra "Regningsarbeid" til "Fastpris"). Krever ofte aksept fra TE.
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon" # BH kan ikke ta stilling til kravet fordi dokumentasjon mangler. Stopper saksbehandlingstiden ("ballen er hos TE").
    AVSLATT_TOTALT = "avslatt_totalt"  # Kun ved f.eks. dobbeltfakturering, ikke grunnlag
    HOLD_TILBAKE = "hold_tilbake"  # §30.2 - BH holder tilbake betaling inntil kostnadsoverslag mottatt
    AVVIST_PREKLUSJON_RIGG = "avvist_preklusjon_rigg"  # §34.1.3 - Rigg/drift varslet for sent, kravet prekludert


# ============ FRIST ENUMS ============

class FristVarselType(str, Enum):
    """Type varsel for frist (NS 8407 §33)"""
    NOYTRALT = "noytralt"  # §33.4 - Nøytralt/Foreløpig varsel (§33.4) - når omfang ikke er kjent. Bevarer rett til senere krav
    SPESIFISERT = "spesifisert"  # §33.6.1 - Spesifisert krav (med dager)
    BEGGE = "begge"  # Først nøytralt, så spesifisert
    FORCE_MAJEURE = "force_majeure"  # Tilleggsfrist ved force majeure (§33.3) - Frist ved ekstraordinære hendelser utenfor partenes kontroll


class FristBeregningResultat(str, Enum):
    """Resultat av fristberegning (Port 3 - ren utmåling)"""
    GODKJENT_FULLT = "godkjent_fullt"  # Enighet om antall dager. (Prinsipalt eller subsidiært).
    DELVIS_GODKJENT = "delvis_godkjent"  # BH mener forsinkelsen er kortere enn TE krever; uenighet om hvor mye fremdriften hindres
    AVVENTER_SPESIFIKASJON = "avventer_spesifikasjon"  # Brukes ved nøytrale varsler, eller når fremdriftsplan/dokumentasjon mangler for å vurdere konsekvensen.
    AVSLATT_INGEN_HINDRING = "avslatt_ingen_hindring"  # BH erkjenner grunnlaget, men mener det ikke medførte forsinkelse (f.eks. TE hadde slakk). Dette er et avslag på utregningen av tid, ikke ansvaret


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


# ============ VARSEL INFO (Reusable) ============

class VarselInfo(BaseModel):
    """
    Informasjon om når og hvordan et varsel ble sendt.

    Brukes for å dokumentere både formelle og uformelle varsler.
    Samme struktur brukes i både GrunnlagData og VederlagData.
    """
    dato_sendt: Optional[str] = Field(
        default=None,
        description="Når varselet faktisk ble sendt til BH (YYYY-MM-DD)"
    )
    metode: Optional[List[str]] = Field(
        default=None,
        description="Metoder brukt for å varsle (f.eks. ['epost', 'byggemote', 'telefon'])"
    )


# ============ GRUNNLAG EVENTS ============

"""
KOMMENTARER FRA ARKITEKT:

HOVEDKATEGORIER - må flettes inn i modell (kan fjerne tall - men fin referanse til riktig underkategori):
100000000: Endring initiert av BH - Byggherre igangsetter endring (§31.1)
100000001: Forsinkelse eller svikt i BHs ytelser - BH oppfyller ikke sine forpliktelser (§22, §24)
100000002: Risiko for grunnforhold - Uforutsette eller uriktige grunnforhold (§23.1)
100000003: Offentlige pålegg - Myndighetskrav som endrer forutsetninger (§16.3)
100000004: Forsering / Tidsmessig omlegging
100000005: Force majeure - Ekstraordinære hendelser (§33.3)
100000006: Hindringer BH har risikoen for - Forhold som hindrer fremdrift (§33.1c)
100000007: Øvrige forhold - Andre grunnlag for fristforlengelse/vederlag

UNDERKATEGORIER - hører til hovedkategorier over:
For “Endring initiert av BH” (100000000):

110000000: Regulær endringsordre (§31.1, §31.3) - BH har rett til å endre prosjektet
110000001: Irregulær endring/pålegg uten EO (§32.1) - BH gir ordre uten forutgående EO
110000002: Mengdeendring (§31.1 siste avsnitt, §34.3) - Endring i mengde av kontraktsarbeid

For “Forsinkelse eller svikt i BHs ytelser” (100000001):

120000000: Prosjektering (§24.1) - Mangler i prosjekteringsunderlag fra BH
120000001: Svikt i arbeidsgrunnlaget (§22.3, §25) - BH har ikke levert komplett/korrekt arbeidsgrunnlag. TEs plikt til å undersøke og varsle (§25)
120000002: Materialer fra BH (§22.4) - BH-leverte materialer mangler eller er forsinkert
120000003: Tillatelser og godkjenninger (§16.3) - BH har ikke skaffet nødvendige tillatelser
120000004: Fastmerker og utstikking (§18.4) - BH har ikke etablert korrekte fastmerker
120000005: Svikt i BHs foreskrevne løsninger (§24.1) - BHs valgte løsninger er ikke egnet
120000006: Koordinering av sideentreprenører (§21) - BH koordinerer ikke andre entreprenører tilfredsstillende

For “Risiko for grunnforhold” (100000002):

130000000: Uforutsette grunnforhold (§23.1a) - Grunnforhold avviker fra det som var kjent
130000001: Uriktige grunnopplysninger fra BH (§23.1b) - BH har gitt feil informasjon
130000002: Forurensning i grunnen (§23.1) - Uventet forurensning oppdages
130000003: Kulturminner (§23.3) - Funn av kulturminner som krever stans og varsling

For “Forsering / Tidsmessig omlegging” (100000004):

140000000: Pålagt forsering / omlegging (§31.2) - BH pålegger endret tidsplan som en endring
140000001: Forsering ved uberettiget avslag på fristkrav (§33.8) - TE velger å forsere etter avslag


For “Hindringer BH har risikoen for” (100000006):

160000000: Hindringer på byggeplassen (§33.1c) - Fysiske hindringer BH har risikoen for
160000001: Offentlige restriksjoner (§33.1c) - Myndighetspålagte begrensninger
160000002: Tilstøtende arbeider forsinket (§33.1c) - Andre entreprenører forsinker
"""

class GrunnlagData(BaseModel):
    """
    Data for ansvarsgrunnlag (Event 1 - Hvorfor/Hvem).

    Denne modellen beskriver ÅRSAKEN til kravet og TE's vurdering av ANSVAR.
    Kategoriseringen følger NS 8407 og bestemmer hvilke juridiske regler som gjelder.
    """
    hovedkategori: str = Field(
        ...,
        description="Hovedkategori for ansvarsgrunnlag (f.eks. 'endring_initiert_bh', 'forsinkelse_bh')"
    )
    underkategori: Union[str, List[str]] = Field(
        ...,
        description="Underkategori(er) - enkelt kode eller liste av koder (f.eks. 'prosjektering', 'arbeidsgrunnlag')"
    )
    beskrivelse: str = Field(
        ...,
        min_length=1,
        description="Detaljert beskrivelse av forholdet som utløste kravet"
    )
    dato_oppdaget: str = Field(
        ...,
        description="Når forholdet ble oppdaget (YYYY-MM-DD)"
    )

    # Varselinformasjon
    grunnlag_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om når og hvordan BH ble varslet om forholdet"
    )

    # Juridisk dokumentasjon
    kontraktsreferanser: List[str] = Field(
        default_factory=list,
        description="Relevante kontraktsbestemmelser (f.eks. ['NS8407 §25.2', 'Kap. 3.2'])"
    )
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter (bilder, rapporter, etc.)"
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
    # Binær indikator for om kravet inkluderer vederlagsjustering. Styrer synlighet av vederlagsfelter i skjema
    krav_belop: float = Field(..., ge=0, description="Krevd beløp i NOK (ekskl. mva)")
    
    # Klassifisering av oppgjørsmetode iht. NS 8407 kapittel 34 (se ENUMs ovenfor). Påvirker om indeksregulering skal anvendes og hvordan endringsordre håndteres økonomisk
    metode: VederlagsMetode = Field(
        ...,
        description="Vederlagsmetode etter NS 8407"
    )
    
    # Detaljert begrunnelse for vederlagskravet. Skal dokumentere grunnlaget for beløpet med referanse til kostnadsunderlag.
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # Faktisk kostnadsunderlag som vedlegg
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter"
    )

    # ============ PORT 1: SPESIFIKKE VARSLER (NS 8407) ============
    # Disse varselfristene er kritiske for om kravet kan tapes ved preklusjon.
    # BH skal vurdere om disse er sendt i tide.
    #
    # VarselInfo-strukturen gir TE mulighet til å dokumentere både formelle
    # og uformelle varsler (f.eks. varslet muntlig på byggemøte før formelt krav).

    # Rigg & Drift (§34.1.3)
    inkluderer_rigg_drift: bool = Field(
        default=False,
        description="Om kravet inkluderer rigg/drift-kostnader (§34.1.3)"
    )
    rigg_drift_belop: Optional[float] = Field(
        default=None,
        description="Separat beløp for rigg/drift hvis aktuelt"
    )
    rigg_drift_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varselinfo for rigg/drift (§34.1.3) - når og hvordan BH ble varslet"
    )

    # Justerte enhetspriser (§34.3.3)
    krever_justert_ep: bool = Field(
        default=False,
        description="Om kravet krever justering av kontraktens enhetspriser (§34.3.3)"
    )
    justert_ep_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varselinfo for justerte enhetspriser (§34.3.3)"
    )

    # Regningsarbeid (§30.1)
    krever_regningsarbeid: bool = Field(
        default=False,
        description="Om kravet involverer regningsarbeid (§30.1)"
    )
    regningsarbeid_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varselinfo før start av regningsarbeid (§30.1) - BH må varsles FØR oppstart"
    )

    # Produktivitetstap (§34.1.3, andre ledd)
    inkluderer_produktivitetstap: bool = Field(
        default=False,
        description="Om kravet inkluderer produktivitetstap/nedsatt produktivitet (§34.1.3, 2. ledd)"
    )
    produktivitetstap_belop: Optional[float] = Field(
        default=None,
        description="Separat beløp for produktivitetstap hvis aktuelt"
    )
    produktivitetstap_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varselinfo for produktivitetstap (§34.1.3, 2. ledd)"
    )

    # Generelt krav fremmet
    krav_fremmet_dato: Optional[str] = Field(
        default=None,
        description="Dato spesifisert vederlagskrav ble formelt fremmet (YYYY-MM-DD)"
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
   
    KOMMENTAR FRA ARKITEKT:
    // Hvis spesifisert krav er for sent, sjekk om BH har etterlyst det
    If (spesifisert_krav_ok == NEI) {
       Field har_bh_etterlyst: Boolean {
         Label: "Har BH etterlyst kravet skriftlig (§ 33.6.2)?"
         Options: [JA, NEI]
         Note: "Hvis NEI, tapes ikke kravet helt, men reduseres."
       }
    }

    NB! Vi avventer med å ta det ovenfor med i modellen.
    """

    # ============ VARSELTYPE (PORT 1) ============
    varsel_type: FristVarselType = Field(
        ...,
        description="Type varsel sendt til BH"
    )

    # Nøytralt varsel (§33.4) - kan sendes uten dager
    noytralt_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om nøytralt varsel (§33.4) - dato + metode (f.eks. muntlig på byggemøte)"
    )

    # Spesifisert krav (§33.6) - må inneholde dager
    spesifisert_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om spesifisert krav (§33.6) - dato + metode (f.eks. formelt brev/epost)"
    )

    # ============ KRAVET (Kun relevant ved SPESIFISERT eller BEGGE) ============
    antall_dager: Optional[int] = Field(
        default=None,
        ge=0,
        description="Antall dager forlengelse (kun ved spesifisert krav)"
    )

    begrunnelse: str = Field(
        ...,
        min_length=1,
        description="Overordnet begrunnelse for fristkravet"
    )

    # ============ FREMDRIFTSHINDRING/ÅRSAKSSAMMENHENG (PORT 2 - Vilkår) ============
    # Dette brukes av BH for å vurdere om forholdet faktisk har medført hindring, jf. § 33.1
    fremdriftshindring_dokumentasjon: Optional[str] = Field(
        default=None,
        description="Dokumentasjon av fremdriftshindring (f.eks. påvirkning på fremdriftsplan, kritisk linje)"
    )

    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Foreslått ny sluttdato (YYYY-MM-DD)"
    )

    # Vedlegg (f.eks. fremdriftsplaner, analyser)
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter (fremdriftsplan, fremdriftsanalyse, etc.)"
    )

    @model_validator(mode='after')
    def validate_antall_dager(self):
        """Valider at antall_dager er satt hvis varsel_type er SPESIFISERT eller BEGGE"""
        if self.varsel_type in [FristVarselType.SPESIFISERT, FristVarselType.BEGGE]:
            if self.antall_dager is None:
                raise ValueError("antall_dager må være satt for spesifisert krav")
        return self


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

class GrunnlagResponsResultat(str, Enum):
    """Resultat av BH's vurdering av grunnlag (ansvar)"""
    GODKJENT = "godkjent"  # BH aksepterer ansvarsgrunnlaget fullt ut
    DELVIS_GODKJENT = "delvis_godkjent"  # BH aksepterer deler av grunnlaget
    AVVIST_UENIG = "avvist_uenig"  # BH er uenig i ansvarsgrunnlaget
    AVVIST_FOR_SENT = "avvist_for_sent"  # Varselet kom for sent (preklusjon)
    KREVER_AVKLARING = "krever_avklaring"  # BH trenger mer dokumentasjon før beslutning


class GrunnlagResponsData(BaseModel):
    """
    Byggherrens respons på grunnlag/varsel.

    Dette er BH's vurdering av ANSVARET - hvem sin feil er det?
    Hvis BH avviser grunnlaget her, kan Vederlag/Frist fortsatt vurderes subsidiært.
    """
    resultat: GrunnlagResponsResultat = Field(
        ...,
        description="BHs vurdering av ansvarsgrunnlaget"
    )
    begrunnelse: str = Field(
        ...,
        min_length=1,
        description="BHs begrunnelse for vurderingen"
    )

    # Hvis BH aksepterer men ønsker annen kategorisering
    akseptert_kategori: Optional[str] = Field(
        default=None,
        description="BH kan akseptere men kategorisere annerledes (f.eks. fra 'prosjektering' til 'arbeidsgrunnlag')"
    )

    # Hvis BH krever mer dokumentasjon
    krever_dokumentasjon: List[str] = Field(
        default_factory=list,
        description="Liste over dokumentasjon BH krever for å ta stilling (f.eks. ['fremdriftsplan', 'kostnadsoverslag'])"
    )

    # Varsel-vurdering
    varsel_for_sent: bool = Field(
        default=False,
        description="Om BH mener varselet kom for sent (preklusjon)"
    )
    varsel_begrunnelse: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse for varsel-vurdering"
    )


class VederlagResponsData(BaseModel):
    """
    Byggherrens respons på vederlagskrav (Port-modellen).

    VIKTIG: Denne modellen beskriver KUN beregningen/utmålingen av penger.
    Avslag basert på grunnlag (ansvar) håndteres i Grunnlag-sporet.

    Dette muliggjør subsidiære betraktninger:
    - BH kan avvise Grunnlag (ansvar), MEN samtidig godkjenne beregningen
      som subsidiær vurdering ("hvis jeg hadde hatt ansvar, er 50k riktig").
    
    KOMMENTAR FRA ARKITEKT:
    Her mangler et eksplisitt felt for subsidiær godkjenning i tilfeller der vederlagBeregningResultat er GODKJENT_FULLT, men Port 1 (Varsler) er False.
    Modellen fungerer som den er, men frontend må vite at:
    HVIS krav_fremmet_i_tide == False
    OG beregnings_resultat == GODKJENT_FULLT
    SÅ er status: Avslått (Prekludert) (men med subsidiær enighet om beløp)

    NB: MÅ vurderes om dette hører til backend eller frontend. Utgangspunktet er at forretningslogikk hører til backend.
    """

    # ============ PORT 1: SPESIFIKKE VARSLER FOR PENGER ============
    # Sjekk av om kravtypen er varslet i tide (preklusjon).
    # Kommentar fra arkitekt: Sjekk om vi mangler noen spesifikke varsler her, sml. med ovenfor.

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
    """
    KOMMENTAR FRA ARKITEKT:
    # Forslag til validator i FristResponsData
    @field_validator('har_bh_etterlyst')
    def validate_etterlyst(cls, v, info):
        if v is not None and info.data.get('spesifisert_krav_ok') is True:
            # Ikke en feil, men logisk inkonsekvent:
            # Hvorfor etterlyse et krav som kom i tide?
            pass 
    return v

    Vurdering: Ikke strengt nødvendig for databasen, men nyttig for frontend-logikk.
    """
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

    @field_validator('har_bh_etterlyst')
    @classmethod
    def validate_etterlyst(cls, v, info):
        """
        Valider at har_bh_etterlyst bare brukes når spesifisert_krav_ok=False.

        Logikk: Hvis kravet kom i tide (spesifisert_krav_ok=True), er det
        logisk inkonsekvent at BH skulle etterlyst det.
        """
        if v is not None and info.data.get('spesifisert_krav_ok') is True:
            raise ValueError(
                "har_bh_etterlyst er kun relevant når spesifisert_krav_ok=False. "
                "Et krav som kom i tide trenger ikke å etterlyses."
            )
        return v


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
