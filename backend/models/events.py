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
from pydantic import BaseModel, Field, field_validator, model_validator, computed_field
from typing import Optional, Literal, List, Union
from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from models.cloudevents import CloudEventMixin


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
    AVSLATT = "avslatt"
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
    FRIST_KRAV_SPESIFISERT = "frist_krav_spesifisert"  # TE specifies days for neutral notice (§33.6.1/§33.6.2)
    FRIST_KRAV_TRUKKET = "frist_krav_trukket"

    # Respons-events (BH)
    RESPONS_GRUNNLAG = "respons_grunnlag"
    RESPONS_GRUNNLAG_OPPDATERT = "respons_grunnlag_oppdatert"  # BH's "snuoperasjon"
    RESPONS_VEDERLAG = "respons_vederlag"
    RESPONS_VEDERLAG_OPPDATERT = "respons_vederlag_oppdatert"  # BH opphever tilbakeholdelse
    RESPONS_FRIST = "respons_frist"
    RESPONS_FRIST_OPPDATERT = "respons_frist_oppdatert"  # BH endrer standpunkt

    # Forsering-events (§33.8)
    FORSERING_VARSEL = "forsering_varsel"  # TE varsler om forsering
    FORSERING_RESPONS = "forsering_respons"  # BH aksepterer/avslår forsering
    FORSERING_STOPPET = "forsering_stoppet"  # TE stopper forsering
    FORSERING_KOSTNADER_OPPDATERT = "forsering_kostnader_oppdatert"  # TE oppdaterer påløpte kostnader
    FORSERING_KOE_LAGT_TIL = "forsering_koe_lagt_til"  # KOE lagt til forseringssak
    FORSERING_KOE_FJERNET = "forsering_koe_fjernet"  # KOE fjernet fra forseringssak

    # Saks-events
    SAK_OPPRETTET = "sak_opprettet"

    # Endringsordre-events (§31.3)
    EO_OPPRETTET = "eo_opprettet"          # EO-sak opprettet (av BH)
    EO_KOE_LAGT_TIL = "eo_koe_lagt_til"    # KOE lagt til EO
    EO_KOE_FJERNET = "eo_koe_fjernet"      # KOE fjernet fra EO
    EO_UTSTEDT = "eo_utstedt"              # BH utsteder EO formelt
    EO_AKSEPTERT = "eo_akseptert"          # TE aksepterer EO
    EO_BESTRIDT = "eo_bestridt"            # TE bestrider EO
    EO_REVIDERT = "eo_revidert"            # BH reviderer EO


# ============ VEDERLAG ENUMS ============

class VederlagsMetode(str, Enum):
    """NS 8407 vederlagsmetoder (forenklet til 3 hovedmetoder)"""
    ENHETSPRISER = "ENHETSPRISER"  # Enhetspriser (§34.3) - kontrakts- eller justerte
    REGNINGSARBEID = "REGNINGSARBEID"  # Regningsarbeid med kostnadsoverslag (§30.2/§34.4)
    FASTPRIS_TILBUD = "FASTPRIS_TILBUD"  # Fastpris / Tilbud (§34.2.1)


# ============ VEDERLAG KOMPENSASJON BASE MODEL ============

class VederlagKompensasjon(BaseModel):
    """
    Felles base-modell for vederlagskompensasjon.

    Brukes av både VederlagData (TEs krav) og EOUtstedtData (BHs formelle EO).
    Følger NS 8407 §34 for vederlagsjustering.

    Beløpsstrukturen avhenger av metode:
    - ENHETSPRISER / FASTPRIS_TILBUD: belop_direkte (kan være negativt = fradrag)
    - REGNINGSARBEID: kostnads_overslag (alltid >= 0)

    Fradrag (§34.4): "For fradrag skal det gjøres en reduksjon i vederlaget som
    tilsvarer den besparelsen fradraget har ført til, med en tilsvarende
    reduksjon av fortjenesten."
    """
    metode: VederlagsMetode = Field(
        ...,
        description="Vederlagsmetode etter NS 8407 (§34)"
    )

    # Beløp - avhenger av metode
    belop_direkte: Optional[float] = Field(
        default=None,
        description="For ENHETSPRISER/FASTPRIS_TILBUD: Beløp i NOK"
    )
    kostnads_overslag: Optional[float] = Field(
        default=None,
        ge=0,
        description="For REGNINGSARBEID (§30.2): Kostnadsoverslag i NOK"
    )

    # Fradrag (§34.4) - separat felt for eksplisitt sporing
    fradrag_belop: Optional[float] = Field(
        default=None,
        ge=0,
        description="Fradrag i NOK (§34.4) - reduksjon for besparelser"
    )

    # Estimat-markering
    er_estimat: bool = Field(
        default=False,
        description="Om beløpet er et estimat (endelig oppgjør senere)"
    )

    @computed_field
    @property
    def netto_belop(self) -> float:
        """
        Beregner netto beløp basert på metode.

        For ENHETSPRISER/FASTPRIS_TILBUD: belop_direkte - fradrag
        For REGNINGSARBEID: kostnads_overslag - fradrag
        """
        if self.metode == VederlagsMetode.REGNINGSARBEID:
            brutto = self.kostnads_overslag or 0.0
        else:
            brutto = self.belop_direkte or 0.0
        fradrag = self.fradrag_belop or 0.0
        return brutto - fradrag

    @computed_field
    @property
    def krevd_belop(self) -> float:
        """
        Alias for netto_belop - brukes i state-modellen.
        Returnerer det totale kravet/kompensasjonen.
        """
        return self.netto_belop


class VederlagBeregningResultat(str, Enum):
    """
    Resultat av vederlagsvurdering - forenklet til tre hovedkategorier.

    Årsaken til avslag fanges av `subsidiaer_triggers` i stedet for
    granulære statuskoder. Badge/markering for subsidiær vurdering
    vises i UI når grunnlag er helt eller delvis avslått.
    """
    # Hovedkategorier
    GODKJENT = "godkjent"              # BH aksepterer kravet (sum og metode)
    DELVIS_GODKJENT = "delvis_godkjent"  # BH aksepterer deler (uenighet om beløp/metode)
    AVSLATT = "avslatt"                # BH avviser kravet

    # Spesialstatus
    # NB: 'avventer' er fjernet - BH må enten avslå eller delvis godkjenne med forklaring
    HOLD_TILBAKE = "hold_tilbake"      # §30.2 tilbakeholdelse (kun ved manglende overslag)


# ============ FRIST ENUMS ============

class FristVarselType(str, Enum):
    """Type varsel for frist (NS 8407 §33)"""
    VARSEL = "varsel"  # §33.4 - Varsel om fristforlengelse - når omfang ikke er kjent ennå
    SPESIFISERT = "spesifisert"  # §33.6.1 - Spesifisert krav (med antall dager)
    BEGRUNNELSE_UTSATT = "begrunnelse_utsatt"  # §33.6.2 bokstav b - TE begrunner hvorfor beregning ikke er mulig


class FristBeregningResultat(str, Enum):
    """
    Resultat av fristberegning - forenklet til tre hovedkategorier.

    Årsaken til avslag fanges av `subsidiaer_triggers` i stedet for
    granulære statuskoder. Badge/markering for subsidiær vurdering
    vises i UI når grunnlag er helt eller delvis avslått.

    NB: 'avventer' er fjernet - BH må enten avslå eller delvis godkjenne med forklaring.
    """
    # Hovedkategorier
    GODKJENT = "godkjent"              # BH aksepterer kravet (enighet om antall dager)
    DELVIS_GODKJENT = "delvis_godkjent"  # BH aksepterer deler (uenighet om antall dager)
    AVSLATT = "avslatt"                # BH avviser kravet


class SubsidiaerTrigger(str, Enum):
    """
    Årsaker til at subsidiær vurdering er relevant.
    Kan kombineres - flere triggere kan gjelde samtidig.

    Subsidiært standpunkt brukes når BH tar prinsipal stilling (f.eks. avslag)
    men også vil angi hva resultatet ville vært hvis prinsipalt standpunkt ikke får medhold.
    """
    # Nivå 0: Grunnlag
    GRUNNLAG_AVSLATT = "grunnlag_avslatt"  # BH avslo ansvarsgrunnlaget
    GRUNNLAG_PREKLUDERT_32_2 = "grunnlag_prekludert_32_2"  # Grunnlag varslet for sent (§32.2) - kun ENDRING
    FORSERINGSRETT_AVSLATT = "forseringsrett_avslatt"  # TE har ikke forseringsrett (§33.8)

    # Nivå 1: Preklusjon (Vederlag)
    PREKLUSJON_HOVEDKRAV = "preklusjon_hovedkrav"  # Hovedkrav varslet for sent (§34.1.2) - kun SVIKT/ANDRE
    PREKLUSJON_RIGG = "preklusjon_rigg"  # Rigg/drift varslet for sent (§34.1.3)
    PREKLUSJON_PRODUKTIVITET = "preklusjon_produktivitet"  # Produktivitet varslet for sent (§34.1.3)
    REDUKSJON_EP_JUSTERING = "reduksjon_ep_justering"  # EP-justering varslet for sent (§34.3.3) - begrenset til det BH "måtte forstå"

    # Nivå 1: Preklusjon (Frist)
    PREKLUSJON_VARSEL = "preklusjon_varsel"  # Varsel om fristforlengelse for sent (§33.4)
    PREKLUSJON_SPESIFISERT = "preklusjon_spesifisert"  # Spesifisert krav for sent (§33.6)

    # Nivå 2: Vilkår
    INGEN_HINDRING = "ingen_hindring"  # Ingen reell fremdriftshindring (§33.5)
    METODE_AVSLATT = "metode_avslatt"  # BH aksepterer ikke foreslått metode


# ============ BASE EVENT ============

class SakEvent(CloudEventMixin, BaseModel):
    """
    Base-klasse for alle events i systemet.

    Støtter både intern struktur og CloudEvents-format via CloudEventMixin.

    Hver event har:
    - Unik ID (for referanser)
    - Sak-ID (hvilken sak den tilhører)
    - Tidsstempel (når den skjedde)
    - Aktør (hvem som utførte handlingen)
    - Event-type (hva som skjedde)

    CloudEvents-støtte:
    - event.specversion -> "1.0"
    - event.ce_id -> event_id
    - event.ce_source -> "/projects/{prosjekt_id}/cases/{sak_id}"
    - event.ce_type -> "no.oslo.koe.{event_type}"
    - event.ce_time -> tidsstempel i ISO 8601 format
    - event.to_cloudevent() -> Returnerer CloudEvents dict
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
        default_factory=lambda: datetime.now(timezone.utc),
        description="Når hendelsen skjedde (UTC)"
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


class SaerskiltKravItem(BaseModel):
    """
    Særskilt krav item for rigg/drift eller produktivitetstap (§34.1.3).

    Per standarden kan TE bli klar over rigg/drift og produktivitetstap
    på ulike tidspunkt, så vi trenger separate datoer per type.
    """
    belop: Optional[float] = Field(
        default=None,
        ge=0,
        description="Beløp for dette særskilte kravet"
    )
    dato_klar_over: Optional[str] = Field(
        default=None,
        description="Når TE ble klar over at utgifter ville påløpe (YYYY-MM-DD). Brukes til 7-dagers varslingssjekk."
    )


class SaerskiltKrav(BaseModel):
    """
    Samlet struktur for særskilte krav (§34.1.3).

    Separate objekter for rigg/drift og produktivitetstap,
    hver med eget beløp og dato for når TE ble klar over kravet.
    """
    rigg_drift: Optional[SaerskiltKravItem] = Field(
        default=None,
        description="Rigg/drift krav (§34.1.3 første ledd)"
    )
    produktivitet: Optional[SaerskiltKravItem] = Field(
        default=None,
        description="Produktivitetstap krav (§34.1.3 annet ledd)"
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
    tittel: str = Field(
        ...,
        min_length=1,
        description="Kort beskrivende tittel for varselet (f.eks. 'Forsinket tegningsunderlag uke 45')"
    )
    hovedkategori: str = Field(
        ...,
        description="Hovedkategori for ansvarsgrunnlag (f.eks. 'ENDRING', 'SVIKT')"
    )
    underkategori: Optional[Union[str, List[str]]] = Field(
        default=None,
        description="Underkategori(er) - enkelt kode eller liste av koder. Valgfritt for kategorier uten underkategorier (f.eks. Force Majeure)"
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

class VederlagData(VederlagKompensasjon):
    """
    Data for vederlagskrav (Entreprenørens krav).

    Arver fra VederlagKompensasjon som gir felles struktur for beløp/metode.
    Denne modellen utvider med TEs spesifikke dokumentasjon og varsler
    som kreves etter NS 8407.

    Arvede felter fra VederlagKompensasjon:
    - metode: VederlagsMetode
    - belop_direkte: For ENHETSPRISER/FASTPRIS_TILBUD
    - kostnads_overslag: For REGNINGSARBEID
    - fradrag_belop: Fradrag (§34.4)
    - er_estimat: Om beløpet er et estimat
    - netto_belop: Computed (brutto - fradrag)
    - krevd_belop: Alias for netto_belop
    """
    # Detaljert begrunnelse for vederlagskravet
    begrunnelse: str = Field(..., min_length=1, description="Begrunnelse for kravet")

    # Faktisk kostnadsunderlag som vedlegg
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter"
    )

    # ============ SÆRSKILTE KRAV (§34.1.3) ============
    # Separate beløp og datoer per type - TE kan bli klar over
    # rigg/drift og produktivitetstap på ulike tidspunkt
    saerskilt_krav: Optional[SaerskiltKrav] = Field(
        default=None,
        description="Særskilte krav for rigg/drift og/eller produktivitetstap (§34.1.3)"
    )

    # ============ PORT 1: SPESIFIKKE VARSLER (NS 8407) ============
    # Disse varselfristene er kritiske for om kravet kan tapes ved preklusjon.
    # BH skal vurdere om disse er sendt i tide.

    # Rigg & Drift varsel (§34.1.3)
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
    regningsarbeid_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varselinfo før start av regningsarbeid (§30.1) - BH må varsles FØR oppstart"
    )

    # Produktivitetstap varsel (§34.1.3, andre ledd)
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

    Denne modellen støtter både varsel om fristforlengelse (§33.4) og spesifisert krav (§33.6).

    NS 8407 skiller mellom:
    - Varsel om fristforlengelse (§33.4): Varsler om at det *kan* bli krav, uten å spesifisere antall dager
    - Spesifisert krav (§33.6.1): Konkret krav om X antall dager

    KOMMENTAR FRA ARKITEKT:
    // Hvis spesifisert krav er for sent, sjekk om BH har sendt forespørsel
    If (spesifisert_krav_ok == NEI) {
       Field har_bh_foresporsel: Boolean {
         Label: "Har BH sendt forespørsel om spesifisering (§33.6.2)?"
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

    # Varsel om fristforlengelse (§33.4) - kan sendes uten dager
    frist_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om varsel om fristforlengelse (§33.4) - dato + metode"
    )

    # Spesifisert krav (§33.6) - må inneholde dager
    spesifisert_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om spesifisert krav (§33.6) - dato + metode (f.eks. formelt brev/epost)"
    )

    # ============ KRAVET (Kun relevant ved SPESIFISERT) ============
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
        """Valider at antall_dager er satt hvis varsel_type er SPESIFISERT"""
        if self.varsel_type == FristVarselType.SPESIFISERT:
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
            EventType.FRIST_KRAV_SPESIFISERT,
            EventType.FRIST_KRAV_TRUKKET,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for FristEvent: {v}")
        return v


# ============ RESPONS EVENTS (BH) ============

class GrunnlagResponsResultat(str, Enum):
    """Resultat av byggherrens vurdering av grunnlag (ansvar)"""
    GODKJENT = "godkjent"  # Byggherren aksepterer ansvarsgrunnlaget fullt ut
    DELVIS_GODKJENT = "delvis_godkjent"  # Byggherren aksepterer deler av grunnlaget
    AVSLATT = "avslatt"  # Byggherren avslår ansvarsgrunnlaget
    FRAFALT = "frafalt"  # §32.3 c - Byggherren frafaller pålegget (kun irregulær endring)


class GrunnlagResponsData(BaseModel):
    """
    Byggherrens respons på grunnlag/varsel.

    Dette er BH's vurdering av ANSVARET - hvem sin feil er det?
    Hvis BH avviser grunnlaget her, kan Vederlag/Frist fortsatt vurderes subsidiært.

    Støtter partielle oppdateringer: Hvis original_respons_id er satt,
    er dette en oppdatering og kun feltene som sendes vil oppdateres.
    """
    resultat: Optional[GrunnlagResponsResultat] = Field(
        default=None,
        description="BHs vurdering av ansvarsgrunnlaget"
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse for vurderingen"
    )

    # Hvis BH aksepterer men ønsker annen kategorisering
    akseptert_kategori: Optional[str] = Field(
        default=None,
        description="BH kan akseptere men kategorisere annerledes (f.eks. fra 'prosjektering' til 'arbeidsgrunnlag')"
    )

    # §32.2: Grunnlagsvarsel rettidig (kun ENDRING)
    grunnlag_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="§32.2: Var grunnlagsvarselet rettidig? Kun relevant for ENDRING-kategorien."
    )

    # ============ PARTIELL OPPDATERING ============
    original_respons_id: Optional[str] = Field(
        default=None,
        description="Event-ID til original respons som oppdateres (for RESPONS_*_OPPDATERT)"
    )

    @model_validator(mode='after')
    def validate_full_eller_partiell(self):
        """
        Valider at enten:
        - Dette er en full respons (resultat og begrunnelse satt)
        - Eller en partiell oppdatering (original_respons_id satt)
        """
        if self.original_respons_id is None:
            if self.resultat is None or self.begrunnelse is None:
                raise ValueError("resultat og begrunnelse er påkrevd for nye responser")
        return self


class BelopVurdering(str, Enum):
    """
    Vurdering av enkelt beløpspost.

    NB: 'prekludert' er IKKE en beløpsvurdering - preklusjon bestemmes av
    rigg_varslet_i_tide/produktivitet_varslet_i_tide i Port 1.
    Beløpsvurderingen representerer BH's faktiske vurdering av kravet.
    """
    GODKJENT = "godkjent"
    DELVIS = "delvis"
    AVSLATT = "avslatt"


class VederlagResponsData(BaseModel):
    """
    Byggherrens respons på vederlagskrav (Port-modellen).

    VIKTIG: Denne modellen beskriver KUN beregningen/utmålingen av penger.
    Avslag basert på grunnlag (ansvar) håndteres i Grunnlag-sporet.

    Dette muliggjør subsidiære betraktninger:
    - BH kan avvise Grunnlag (ansvar), MEN samtidig godkjenne beregningen
      som subsidiær vurdering ("hvis jeg hadde hatt ansvar, er 50k riktig").

    Støtter partielle oppdateringer: Hvis original_respons_id er satt,
    er dette en oppdatering og kun feltene som sendes vil oppdateres.
    """

    # ============ PARTIELL OPPDATERING ============
    original_respons_id: Optional[str] = Field(
        default=None,
        description="Event-ID til original respons som oppdateres (for RESPONS_*_OPPDATERT)"
    )

    # ============ REFERANSE ============
    vederlag_krav_id: Optional[str] = Field(
        default=None,
        description="Event-ID til vederlagskravet som besvares"
    )

    # ============ PORT 1: PREKLUSJON (§34.1.2 og §34.1.3) ============
    # §34.1.2: Hovedkrav - kun for SVIKT/ANDRE (ikke ENDRING per §34.1.1)
    hovedkrav_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="Er vederlagskravet varslet i tide? (§34.1.2) - kun relevant for SVIKT/ANDRE"
    )
    # §34.1.3: Særskilte krav
    rigg_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="Er rigg/drift-kravet varslet i tide? (§34.1.3)"
    )
    produktivitet_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="Er produktivitetskravet varslet i tide? (§34.1.3)"
    )
    begrunnelse_preklusjon: Optional[str] = Field(
        default=None,
        description="Begrunnelse for preklusjonsvurdering"
    )

    # Legacy felter (for bakoverkompatibilitet)
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = Field(
        default=None,
        description="DEPRECATED: Bruk rigg_varslet_i_tide"
    )
    varsel_justert_ep_ok: Optional[bool] = Field(
        default=None,
        description="Er det varslet om justerte enhetspriser uten ugrunnet opphold? (§34.3.3)"
    )
    varsel_start_regning_ok: Optional[bool] = Field(
        default=None,
        description="Ble BH varslet før regningsarbeid startet? (§30.1)"
    )
    krav_fremmet_i_tide: Optional[bool] = Field(
        default=True,
        description="Er vederlagskravet fremmet uten ugrunnet opphold?"
    )
    begrunnelse_varsel: Optional[str] = Field(
        default=None,
        description="Begrunnelse for vurdering av varsler/frister"
    )

    # ============ PORT 2: METODE ============
    aksepterer_metode: Optional[bool] = Field(
        default=None,
        description="Aksepterer BH den foreslåtte vederlagsmetoden?"
    )
    oensket_metode: Optional[VederlagsMetode] = Field(
        default=None,
        description="Metode BH ønsker dersom foreslått metode ikke aksepteres"
    )
    ep_justering_akseptert: Optional[bool] = Field(
        default=None,
        description="Aksepterer BH justering av enhetspriser? (§34.3.3)"
    )
    hold_tilbake: Optional[bool] = Field(
        default=None,
        description="Holder BH tilbake betaling? (§30.2)"
    )
    begrunnelse_metode: Optional[str] = Field(
        default=None,
        description="Begrunnelse for metodevalg"
    )
    vederlagsmetode: Optional[VederlagsMetode] = Field(
        default=None,
        description="Hvilken metode BH legger til grunn (legacy)"
    )

    # ============ PORT 3: BELØPSVURDERING - HOVEDKRAV ============
    hovedkrav_vurdering: Optional[BelopVurdering] = Field(
        default=None,
        description="BHs vurdering av hovedkravet"
    )
    hovedkrav_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent beløp for hovedkravet i NOK"
    )
    hovedkrav_begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for hovedkravvurdering"
    )

    # ============ PORT 3: BELØPSVURDERING - SÆRSKILTE KRAV (§34.1.3) ============
    rigg_vurdering: Optional[BelopVurdering] = Field(
        default=None,
        description="BHs vurdering av rigg/drift-kravet"
    )
    rigg_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent beløp for rigg/drift i NOK"
    )
    produktivitet_vurdering: Optional[BelopVurdering] = Field(
        default=None,
        description="BHs vurdering av produktivitetskravet"
    )
    produktivitet_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent beløp for produktivitetstap i NOK"
    )

    # ============ PORT 4: SAMLET RESULTAT ============
    beregnings_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="BHs samlede vurdering av kravets størrelse"
    )
    total_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Totalt godkjent beløp i NOK (hovedkrav + særskilte krav)"
    )
    total_krevd_belop: Optional[float] = Field(
        default=None,
        description="Totalt krevd beløp i NOK"
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="Samlet begrunnelse"
    )
    frist_for_spesifikasjon: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere ytterligere spesifikasjon (YYYY-MM-DD)"
    )

    # ============ SUBSIDIÆRT STANDPUNKT ============
    # Brukes når BH tar et prinsipalt standpunkt (f.eks. avslag pga preklusjon)
    # men også vil angi hva resultatet ville vært subsidiært.

    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over årsaker til subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp i NOK (totalt)"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )

    @model_validator(mode='after')
    def validate_full_eller_partiell(self):
        """
        Valider at enten:
        - Dette er en full respons (beregnings_resultat satt)
        - Eller en partiell oppdatering (original_respons_id satt)
        """
        if self.original_respons_id is None:
            if self.beregnings_resultat is None:
                raise ValueError("beregnings_resultat er påkrevd for nye responser")
        return self


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

    Støtter partielle oppdateringer: Hvis original_respons_id er satt,
    er dette en oppdatering og kun feltene som sendes vil oppdateres.
    """

    # ============ PARTIELL OPPDATERING ============
    original_respons_id: Optional[str] = Field(
        default=None,
        description="Event-ID til original respons som oppdateres (for RESPONS_*_OPPDATERT)"
    )

    # ============ PORT 1: PREKLUSJON (Varslene) ============
    # Sjekker om TE har fulgt spillereglene for tidskrav (NS 8407 §33).

    # Varsel om fristforlengelse (§33.4)
    frist_varsel_ok: Optional[bool] = Field(
        default=None,
        description="Er varsel om fristforlengelse sendt i tide? (§33.4). None hvis ikke relevant."
    )

    # Spesifisert krav (§33.6)
    spesifisert_krav_ok: bool = Field(
        default=True,
        description="Er spesifisert krav sendt i tide? (§33.6)"
    )

    # Svar på forespørsel (§33.6.2/§5)
    foresporsel_svar_ok: Optional[bool] = Field(
        default=None,
        description="Er svar på forespørsel sendt i tide? (§33.6.2/§5). None hvis ikke relevant."
    )

    # Har BH sendt forespørsel om spesifisering?
    har_bh_foresporsel: Optional[bool] = Field(
        default=None,
        description="Har BH sendt forespørsel om spesifisering? (§33.6.2). Relevant kun hvis krav er sent."
    )

    dato_bh_foresporsel: Optional[str] = Field(
        default=None,
        description="Dato BH sendte forespørsel om spesifisering (§33.6.2) - YYYY-MM-DD. Brukes for å beregne om TEs svar kom i tide."
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

    beregnings_resultat: Optional[FristBeregningResultat] = Field(
        default=None,
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

    begrunnelse: Optional[str] = Field(
        default=None,
        description="Samlet begrunnelse"
    )

    frist_for_spesifisering: Optional[str] = Field(
        default=None,
        description="Frist for TE å levere ytterligere spesifikasjon/fremdriftsplan (YYYY-MM-DD)"
    )

    # ============ SUBSIDIÆRT STANDPUNKT ============
    # Brukes når BH tar et prinsipalt standpunkt (f.eks. avslag pga preklusjon)
    # men også vil angi hva resultatet ville vært subsidiært.

    subsidiaer_triggers: Optional[List[SubsidiaerTrigger]] = Field(
        default=None,
        description="Liste over årsaker til subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[FristBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_dager: Optional[int] = Field(
        default=None,
        description="Subsidiært godkjent antall dager"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )

    @field_validator('har_bh_foresporsel')
    @classmethod
    def validate_foresporsel(cls, v, info):
        """
        Valider at har_bh_foresporsel brukes korrekt.

        har_bh_foresporsel har to bruksområder:
        1. Når TE kun har sendt varsel om fristforlengelse: BH sender forespørsel om spesifisering (§33.6.2)
           - I dette tilfellet er spesifisert_krav_ok irrelevant (TE har ikke sendt spesifisert)
        2. Når TE har sendt spesifisert krav som var for sent: BH har sendt forespørsel tidligere
           - I dette tilfellet skal spesifisert_krav_ok=False

        Valideringen tillater nå har_bh_foresporsel=True selv når spesifisert_krav_ok=True,
        fordi dette kan skje når BH sender forespørsel og TE responderer i tide.
        """
        # Fjernet streng validering - har_bh_foresporsel kan være True i flere scenarier
        return v

    @model_validator(mode='after')
    def validate_full_eller_partiell(self):
        """
        Valider at enten:
        - Dette er en full respons (beregnings_resultat satt)
        - Eller en partiell oppdatering (original_respons_id satt)
        """
        if self.original_respons_id is None:
            if self.beregnings_resultat is None:
                raise ValueError("beregnings_resultat er påkrevd for nye responser")
        return self


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
            EventType.RESPONS_GRUNNLAG_OPPDATERT,
            EventType.RESPONS_VEDERLAG,
            EventType.RESPONS_VEDERLAG_OPPDATERT,
            EventType.RESPONS_FRIST,
            EventType.RESPONS_FRIST_OPPDATERT,
        ]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for ResponsEvent: {v}")
        return v

    @model_validator(mode='after')
    def validate_data_matches_spor(self):
        """Valider at data-typen matcher spor."""
        expected_types = {
            SporType.GRUNNLAG: GrunnlagResponsData,
            SporType.VEDERLAG: VederlagResponsData,
            SporType.FRIST: FristResponsData,
        }
        expected_type = expected_types.get(self.spor)
        if expected_type and not isinstance(self.data, expected_type):
            raise ValueError(
                f"Data-type {type(self.data).__name__} matcher ikke spor {self.spor.value}. "
                f"Forventet {expected_type.__name__}."
            )
        return self


# ============ FORSERING EVENTS (§33.8) ============

class ForseringVarselData(BaseModel):
    """
    Data for forsering varsel (§33.8).

    Når BH avslår fristkrav, kan TE varsle om at de vil iverksette forsering.
    Forseringskostnader kan da kreves dekket (innenfor 30%-grensen).
    """
    frist_krav_id: str = Field(
        ...,
        description="Event-ID til fristkravet som ble avslått"
    )
    respons_frist_id: str = Field(
        ...,
        description="Event-ID til BH's frist-respons som utløste forseringen"
    )
    estimert_kostnad: float = Field(
        ...,
        ge=0,
        description="Estimert kostnad for forsering i NOK"
    )
    begrunnelse: str = Field(
        ...,
        min_length=1,
        description="Begrunnelse for forsering"
    )
    bekreft_30_prosent: bool = Field(
        default=False,
        description="TE bekrefter at estimert kostnad er innenfor dagmulkt + 30%"
    )
    dato_iverksettelse: str = Field(
        ...,
        description="Dato forsering iverksettes (YYYY-MM-DD)"
    )
    avslatte_dager: int = Field(
        ...,
        ge=0,
        description="Antall dager som ble avslått av BH"
    )
    dagmulktsats: float = Field(
        ...,
        ge=0,
        description="Dagmulktsats i NOK per dag (påkrevd for 30%-beregning)"
    )
    grunnlag_avslag_trigger: bool = Field(
        default=False,
        description="True hvis forsering utløses av grunnlagsavslag (ikke direkte frist-avslag)"
    )


class ForseringVarselEvent(SakEvent):
    """
    Event for forsering varsel (§33.8).

    TE kan varsle om forsering når BH avslår fristkrav.
    """
    event_type: EventType = Field(
        default=EventType.FORSERING_VARSEL,
        description="Forsering varsel"
    )
    data: ForseringVarselData = Field(
        ...,
        description="Forseringsdata"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.FORSERING_VARSEL:
            raise ValueError(f"Ugyldig event_type for ForseringVarselEvent: {v}")
        return v


class ForseringResponsData(BaseModel):
    """
    Data for BH's respons på forsering (§33.8).

    Utvidet med tre-port struktur:
    - Port 1: Grunnlagsvalidering (er avslaget fortsatt gyldig?)
    - Port 2: 30%-regel (er kostnaden innenfor grensen?)
    - Port 3: Beløpsvurdering (hovedkrav + særskilte krav)
    """
    # === Port 1: Per-sak vurdering av forseringsrett (§33.8) ===
    vurdering_per_sak: Optional[List[dict]] = Field(
        default=None,
        description="BHs vurdering av forseringsrett per sak"
    )
    dager_med_forseringsrett: Optional[int] = Field(
        default=None,
        ge=0,
        description="Antall dager BH mener TE har forseringsrett for"
    )
    # Legacy fields for backward compatibility
    grunnlag_fortsatt_gyldig: Optional[bool] = Field(
        default=None,
        description="BH bekrefter at frist-avslaget fortsatt står ved lag"
    )
    grunnlag_begrunnelse: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse hvis grunnlaget bestrides"
    )

    # === Port 2: 30%-regel validering ===
    trettiprosent_overholdt: Optional[bool] = Field(
        default=None,
        description="BH vurderer om estimert kostnad er innenfor 30%-grensen"
    )
    trettiprosent_begrunnelse: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse ved avvik fra 30%-regelen"
    )

    # === Port 3: Beløpsvurdering ===
    aksepterer: bool = Field(
        ...,
        description="BH aksepterer forsering"
    )
    godkjent_kostnad: Optional[float] = Field(
        default=None,
        ge=0,
        description="BH's godkjente forseringskostnad (kan være lavere enn estimert)"
    )
    begrunnelse: str = Field(
        ...,
        min_length=1,
        description="BH's begrunnelse for aksept/avslag"
    )
    dato_respons: str = Field(
        ...,
        description="Dato for BH's respons (YYYY-MM-DD)"
    )

    # === Port 3b: Særskilte krav vurdering (§34.1.3) ===
    rigg_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="Om rigg/drift-varslet var rettidig"
    )
    produktivitet_varslet_i_tide: Optional[bool] = Field(
        default=None,
        description="Om produktivitets-varslet var rettidig"
    )
    godkjent_rigg_drift: Optional[float] = Field(
        default=None,
        ge=0,
        description="Godkjent rigg/drift-beløp"
    )
    godkjent_produktivitet: Optional[float] = Field(
        default=None,
        ge=0,
        description="Godkjent produktivitetsbeløp"
    )

    # === Subsidiært standpunkt ===
    subsidiaer_triggers: Optional[List[str]] = Field(
        default=None,
        description="Triggere for subsidiær vurdering (f.eks. 'grunnlag_bestridt')"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        ge=0,
        description="Subsidiært godkjent beløp"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for subsidiært standpunkt"
    )


class ForseringResponsEvent(SakEvent):
    """
    Event for BH's respons på forsering (§33.8).

    BH aksepterer eller avviser TE's forseringsvarsel.
    """
    event_type: EventType = Field(
        default=EventType.FORSERING_RESPONS,
        description="Forsering respons"
    )
    data: ForseringResponsData = Field(
        ...,
        description="Responsdata"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.FORSERING_RESPONS:
            raise ValueError(f"Ugyldig event_type for ForseringResponsEvent: {v}")
        return v


class ForseringStoppetData(BaseModel):
    """
    Data for stopp av forsering (§33.8).

    TE kan stoppe forseringen og rapportere påløpte kostnader.
    """
    dato_stoppet: str = Field(
        ...,
        description="Dato forsering ble stoppet (YYYY-MM-DD)"
    )
    paalopte_kostnader: Optional[float] = Field(
        default=None,
        ge=0,
        description="Påløpte kostnader ved stopp i NOK"
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for stopp"
    )


class ForseringStoppetEvent(SakEvent):
    """
    Event når forsering stoppes (§33.8).

    TE kan stoppe forseringen og rapportere påløpte kostnader.
    """
    event_type: EventType = Field(
        default=EventType.FORSERING_STOPPET,
        description="Forsering stoppet"
    )
    data: ForseringStoppetData = Field(
        ...,
        description="Stoppdata"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.FORSERING_STOPPET:
            raise ValueError(f"Ugyldig event_type for ForseringStoppetEvent: {v}")
        return v


class ForseringKostnaderOppdatertData(BaseModel):
    """
    Data for oppdatering av forseringskostnader (§33.8).

    TE kan oppdatere påløpte kostnader underveis i forseringen.
    """
    paalopte_kostnader: float = Field(
        ...,
        ge=0,
        description="Påløpte kostnader i NOK"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar til kostnadsoppdatering"
    )


class ForseringKostnaderOppdatertEvent(SakEvent):
    """
    Event for oppdatering av forseringskostnader (§33.8).

    TE kan oppdatere påløpte kostnader underveis i forseringen.
    """
    event_type: EventType = Field(
        default=EventType.FORSERING_KOSTNADER_OPPDATERT,
        description="Forsering kostnader oppdatert"
    )
    data: ForseringKostnaderOppdatertData = Field(
        ...,
        description="Kostnadsdata"
    )

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.FORSERING_KOSTNADER_OPPDATERT:
            raise ValueError(f"Ugyldig event_type for ForseringKostnaderOppdatertEvent: {v}")
        return v


class ForseringKoeHandlingData(BaseModel):
    """Data for å legge til eller fjerne KOE fra forseringssak"""
    koe_sak_id: str = Field(..., description="SAK-ID til KOE som legges til/fjernes")
    koe_tittel: Optional[str] = Field(default=None, description="Tittel på KOE for visning")


class ForseringKoeHandlingEvent(SakEvent):
    """Event når KOE legges til eller fjernes fra forseringssak"""
    event_type: EventType = Field(
        ...,
        description="FORSERING_KOE_LAGT_TIL eller FORSERING_KOE_FJERNET"
    )
    data: ForseringKoeHandlingData = Field(..., description="KOE-handlingsdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [EventType.FORSERING_KOE_LAGT_TIL, EventType.FORSERING_KOE_FJERNET]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for ForseringKoeHandlingEvent: {v}")
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
    sakstype: str = Field(
        default="standard",
        description="Sakstype: 'standard' (KOE), 'endringsordre' (EO), eller 'forsering'"
    )

    # Prosjekt- og partsinformasjon (hentes fra Catenda)
    prosjekt_navn: Optional[str] = Field(default=None, description="Prosjektnavn fra Catenda")
    byggherre: Optional[str] = Field(default=None, description="Byggherre (BH) - fra topic custom field")
    leverandor: Optional[str] = Field(default=None, description="Leverandør/Entreprenør (TE) - fra topic custom field")

    # Forsering-spesifikk data (kun for sakstype='forsering')
    forsering_data: Optional[dict] = Field(
        default=None,
        description="Forsering-data inkl. avslatte_fristkrav, dato_varslet, estimert_kostnad (kun for forsering-saker)"
    )


# ============ ENDRINGSORDRE EVENTS (§31.3) ============

class EOKonsekvenser(BaseModel):
    """Konsekvenser av endringen (checkboxes fra EO-malen)"""
    sha: bool = Field(default=False, description="SHA-konsekvenser")
    kvalitet: bool = Field(default=False, description="Kvalitetskonsekvenser")
    fremdrift: bool = Field(default=False, description="Fremdriftskonsekvenser")
    pris: bool = Field(default=False, description="Priskonsekvenser")
    annet: bool = Field(default=False, description="Andre konsekvenser")


class EOOpprettetData(BaseModel):
    """
    Data for opprettelse av endringsordre-sak.

    Dette er det initielle datasettet når BH oppretter en EO-sak.
    Kan inkludere referanser til KOE-er som skal samles.
    """
    eo_nummer: str = Field(..., description="Endringsordre-nummer")
    beskrivelse: str = Field(..., description="Beskrivelse av endringen")
    relaterte_koe_saker: List[str] = Field(
        default_factory=list,
        description="SAK-IDs til KOE-er som inngår"
    )
    sakstittel: Optional[str] = Field(default=None, description="Sakstittel for EO-saken")
    prosjekt_id: Optional[str] = Field(default=None, description="Prosjekt-ID")
    catenda_topic_id: Optional[str] = Field(default=None, description="Catenda topic GUID")


class EOOpprettetEvent(SakEvent):
    """Event når en endringsordre-sak opprettes"""
    event_type: EventType = Field(
        default=EventType.EO_OPPRETTET,
        description="EO opprettet"
    )
    data: EOOpprettetData = Field(..., description="Opprettelsesdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.EO_OPPRETTET:
            raise ValueError(f"Ugyldig event_type for EOOpprettetEvent: {v}")
        return v


class EOKoeHandlingData(BaseModel):
    """Data for å legge til eller fjerne KOE fra EO"""
    koe_sak_id: str = Field(..., description="SAK-ID til KOE som legges til/fjernes")
    koe_tittel: Optional[str] = Field(default=None, description="Tittel på KOE for visning")


class EOKoeHandlingEvent(SakEvent):
    """Event når KOE legges til eller fjernes fra EO"""
    event_type: EventType = Field(
        ...,
        description="EO_KOE_LAGT_TIL eller EO_KOE_FJERNET"
    )
    data: EOKoeHandlingData = Field(..., description="KOE-handlingsdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        valid_types = [EventType.EO_KOE_LAGT_TIL, EventType.EO_KOE_FJERNET]
        if v not in valid_types:
            raise ValueError(f"Ugyldig event_type for EOKoeHandlingEvent: {v}")
        return v


class EOUtstedtData(BaseModel):
    """
    Data for formell utstedelse av endringsordre.

    Dette er det komplette datasettet når BH formelt utsteder EO.
    Følger strukturen i Endringsordre.md malen.

    Vederlagskompensasjonen bruker VederlagKompensasjon for konsistens
    med VederlagData (TEs krav). Samme metoder og beløpsstruktur.
    """
    # Identifikasjon
    eo_nummer: str = Field(..., description="Endringsordre-nummer")
    revisjon_nummer: int = Field(default=0, description="Revisjonsnummer")

    # Beskrivelse
    beskrivelse: str = Field(..., description="Beskrivelse av endringen")
    vedlegg_ids: List[str] = Field(default_factory=list, description="Vedlegg-IDer")

    # Konsekvenser
    konsekvenser: EOKonsekvenser = Field(
        default_factory=EOKonsekvenser,
        description="Konsekvenser av endringen"
    )
    konsekvens_beskrivelse: Optional[str] = Field(
        default=None,
        description="Beskrivelse av konsekvensene"
    )

    # Vederlag/oppgjør - bruker felles VederlagKompensasjon for konsistens
    vederlag: Optional[VederlagKompensasjon] = Field(
        default=None,
        description="Vederlagskompensasjon (metode, beløp, fradrag) - konsistent med VederlagData"
    )

    # Legacy-felter for bakoverkompatibilitet (migreres til vederlag-feltet)
    # TODO: Fjern disse når alle eksisterende data er migrert
    oppgjorsform: Optional[str] = Field(
        default=None,
        description="DEPRECATED: Bruk vederlag.metode"
    )
    kompensasjon_belop: Optional[float] = Field(
        default=None,
        description="DEPRECATED: Bruk vederlag.belop_direkte"
    )
    fradrag_belop: Optional[float] = Field(
        default=None,
        description="DEPRECATED: Bruk vederlag.fradrag_belop"
    )
    er_estimat: Optional[bool] = Field(
        default=None,
        description="DEPRECATED: Bruk vederlag.er_estimat"
    )

    # Frist
    frist_dager: Optional[int] = Field(
        default=None,
        description="Fristforlengelse i dager"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Ny sluttdato (YYYY-MM-DD)"
    )

    # Relaterte saker
    relaterte_koe_saker: List[str] = Field(
        default_factory=list,
        description="SAK-IDs til KOE-er som inngår"
    )

    # Alias for konsistens med test-skript
    relaterte_sak_ids: List[str] = Field(
        default_factory=list,
        description="Alias for relaterte_koe_saker (for bakoverkompatibilitet)"
    )

    # Dato for utstedelse
    dato_utstedt: Optional[str] = Field(
        default=None,
        description="Dato EO ble utstedt (YYYY-MM-DD)"
    )

    @computed_field
    @property
    def netto_belop(self) -> float:
        """
        Beregner netto beløp.
        Prioriterer vederlag-feltet, faller tilbake til legacy-felter.
        """
        if self.vederlag:
            return self.vederlag.netto_belop
        # Legacy fallback
        komp = self.kompensasjon_belop or 0.0
        frad = self.fradrag_belop or 0.0
        return komp - frad

    @computed_field
    @property
    def har_priskonsekvens(self) -> bool:
        """Sjekker om EO har priskonsekvens"""
        return self.konsekvenser.pris or self.netto_belop != 0.0

    @computed_field
    @property
    def har_fristkonsekvens(self) -> bool:
        """Sjekker om EO har fristkonsekvens"""
        return self.konsekvenser.fremdrift or (self.frist_dager is not None and self.frist_dager > 0)


class EOUtstedtEvent(SakEvent):
    """
    Event når endringsordre utstedes formelt.

    Dette er hoveddokumentet som bekrefter endringen i kontrakten.
    Kan utstedes reaktivt (basert på KOE) eller proaktivt (direkte fra BH).
    """
    event_type: EventType = Field(
        default=EventType.EO_UTSTEDT,
        description="EO utstedt"
    )
    data: EOUtstedtData = Field(..., description="Utstedelsesdata")

    # Legacy-felter for bakoverkompatibilitet (kan fjernes senere)
    eo_nummer: Optional[str] = Field(default=None, description="DEPRECATED: Bruk data.eo_nummer")
    endelig_vederlag: Optional[float] = Field(default=None, description="DEPRECATED: Bruk data.kompensasjon_belop")
    endelig_frist_dager: Optional[int] = Field(default=None, description="DEPRECATED: Bruk data.frist_dager")
    signert_av_te: Optional[str] = Field(default=None, description="DEPRECATED")
    signert_av_bh: Optional[str] = Field(default=None, description="DEPRECATED")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.EO_UTSTEDT:
            raise ValueError(f"Ugyldig event_type for EOUtstedtEvent: {v}")
        return v


class EOAkseptertData(BaseModel):
    """Data for TEs aksept av endringsordre"""
    akseptert: bool = Field(default=True, description="Om TE aksepterer")
    kommentar: Optional[str] = Field(default=None, description="TEs kommentar")
    dato_aksept: Optional[str] = Field(default=None, description="Dato for aksept (YYYY-MM-DD)")


class EOAkseptertEvent(SakEvent):
    """Event når TE aksepterer endringsordre"""
    event_type: EventType = Field(
        default=EventType.EO_AKSEPTERT,
        description="EO akseptert"
    )
    data: EOAkseptertData = Field(..., description="Akseptdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.EO_AKSEPTERT:
            raise ValueError(f"Ugyldig event_type for EOAkseptertEvent: {v}")
        return v


class EOBestridtData(BaseModel):
    """Data for TEs bestridelse av endringsordre"""
    begrunnelse: str = Field(..., description="Begrunnelse for bestridelse")
    nytt_koe_sak_id: Optional[str] = Field(
        default=None,
        description="SAK-ID til nytt KOE som fremmes som alternativ"
    )


class EOBestridtEvent(SakEvent):
    """Event når TE bestrider endringsordre"""
    event_type: EventType = Field(
        default=EventType.EO_BESTRIDT,
        description="EO bestridt"
    )
    data: EOBestridtData = Field(..., description="Bestridelsesdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.EO_BESTRIDT:
            raise ValueError(f"Ugyldig event_type for EOBestridtEvent: {v}")
        return v


class EORevidertData(BaseModel):
    """Data for BHs revisjon av endringsordre"""
    ny_revisjon_nummer: int = Field(..., description="Nytt revisjonsnummer")
    endringer_beskrivelse: str = Field(..., description="Beskrivelse av endringene")
    # Kan inkludere oppdaterte felt fra EOUtstedtData
    oppdatert_data: Optional[EOUtstedtData] = Field(
        default=None,
        description="Oppdatert EO-data (hvis endret)"
    )


class EORevidertEvent(SakEvent):
    """Event når BH reviderer endringsordre"""
    event_type: EventType = Field(
        default=EventType.EO_REVIDERT,
        description="EO revidert"
    )
    data: EORevidertData = Field(..., description="Revisjonsdata")

    @field_validator('event_type')
    @classmethod
    def validate_event_type(cls, v):
        if v != EventType.EO_REVIDERT:
            raise ValueError(f"Ugyldig event_type for EORevidertEvent: {v}")
        return v


# ============ TYPE UNION ============

# Alle mulige event-typer for typing
AnyEvent = Union[
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    ForseringVarselEvent,
    ForseringResponsEvent,
    ForseringStoppetEvent,
    ForseringKostnaderOppdatertEvent,
    SakOpprettetEvent,
    # Endringsordre events
    EOOpprettetEvent,
    EOKoeHandlingEvent,
    EOUtstedtEvent,
    EOAkseptertEvent,
    EOBestridtEvent,
    EORevidertEvent,
]


# ============ EVENT PARSING ============

def parse_event(data: dict) -> AnyEvent:
    """
    Parse a dict into the correct event type.

    Uses event_type field to determine which model to instantiate.
    Auto-derives 'spor' for ResponsEvent if not present (for backwards compatibility
    with events stored in Supabase without the spor field).
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
        EventType.FRIST_KRAV_SPESIFISERT.value: FristEvent,
        EventType.FRIST_KRAV_TRUKKET.value: FristEvent,
        EventType.RESPONS_GRUNNLAG.value: ResponsEvent,
        EventType.RESPONS_GRUNNLAG_OPPDATERT.value: ResponsEvent,
        EventType.RESPONS_VEDERLAG.value: ResponsEvent,
        EventType.RESPONS_VEDERLAG_OPPDATERT.value: ResponsEvent,
        EventType.RESPONS_FRIST.value: ResponsEvent,
        EventType.RESPONS_FRIST_OPPDATERT.value: ResponsEvent,
        EventType.FORSERING_VARSEL.value: ForseringVarselEvent,
        EventType.FORSERING_RESPONS.value: ForseringResponsEvent,
        EventType.FORSERING_STOPPET.value: ForseringStoppetEvent,
        EventType.FORSERING_KOSTNADER_OPPDATERT.value: ForseringKostnaderOppdatertEvent,
        EventType.FORSERING_KOE_LAGT_TIL.value: ForseringKoeHandlingEvent,
        EventType.FORSERING_KOE_FJERNET.value: ForseringKoeHandlingEvent,
        # Endringsordre events
        EventType.EO_OPPRETTET.value: EOOpprettetEvent,
        EventType.EO_KOE_LAGT_TIL.value: EOKoeHandlingEvent,
        EventType.EO_KOE_FJERNET.value: EOKoeHandlingEvent,
        EventType.EO_UTSTEDT.value: EOUtstedtEvent,
        EventType.EO_AKSEPTERT.value: EOAkseptertEvent,
        EventType.EO_BESTRIDT.value: EOBestridtEvent,
        EventType.EO_REVIDERT.value: EORevidertEvent,
    }

    event_class = type_map.get(event_type)
    if not event_class:
        raise ValueError(f"Ukjent event_type: {event_type}")

    # For ResponsEvent: Auto-derive 'spor' from event_type if not present
    # This handles events stored in Supabase without the spor field
    respons_event_types = [
        EventType.RESPONS_GRUNNLAG.value,
        EventType.RESPONS_GRUNNLAG_OPPDATERT.value,
        EventType.RESPONS_VEDERLAG.value,
        EventType.RESPONS_VEDERLAG_OPPDATERT.value,
        EventType.RESPONS_FRIST.value,
        EventType.RESPONS_FRIST_OPPDATERT.value,
    ]
    if event_type in respons_event_types and "spor" not in data:
        spor_map = {
            EventType.RESPONS_GRUNNLAG.value: SporType.GRUNNLAG.value,
            EventType.RESPONS_GRUNNLAG_OPPDATERT.value: SporType.GRUNNLAG.value,
            EventType.RESPONS_VEDERLAG.value: SporType.VEDERLAG.value,
            EventType.RESPONS_VEDERLAG_OPPDATERT.value: SporType.VEDERLAG.value,
            EventType.RESPONS_FRIST.value: SporType.FRIST.value,
            EventType.RESPONS_FRIST_OPPDATERT.value: SporType.FRIST.value,
        }
        data = dict(data)  # Don't mutate original
        data["spor"] = spor_map.get(event_type)

    # For SakOpprettetEvent: Extract fields from 'data' dict to top level
    # This handles events stored in Supabase where event-specific fields are in 'data'
    if event_type == EventType.SAK_OPPRETTET.value:
        event_data = data.get("data", {})
        if event_data and isinstance(event_data, dict):
            # Fields that should be at top level for SakOpprettetEvent
            sak_opprettet_fields = [
                'sakstittel', 'catenda_topic_id', 'sakstype', 'prosjekt_id',
                'prosjekt_navn', 'byggherre', 'leverandor',  # Prosjekt- og partsinformasjon
                'forsering_data'  # Forsering-spesifikk data (avslatte_fristkrav, estimert_kostnad, etc.)
            ]
            data = dict(data)  # Don't mutate original
            for field in sak_opprettet_fields:
                if field in event_data and field not in data:
                    data[field] = event_data[field]

    return event_class.model_validate(data)


def parse_event_from_request(request_data: dict) -> AnyEvent:
    """
    Parse API request into event, adding server-side fields.

    SECURITY: Validates that client doesn't send server-controlled fields.

    Adds:
    - event_id (generated)
    - tidsstempel (server time)

    Auto-derives:
    - spor (for ResponsEvent, derived from event_type if not provided)
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
    request_data["tidsstempel"] = datetime.now(timezone.utc).isoformat()

    # For ResponsEvent: Auto-derive 'spor' from event_type if not provided
    # This allows frontend to send spor inside 'data' or rely on auto-derivation
    event_type = request_data.get("event_type")
    respons_event_types = [
        EventType.RESPONS_GRUNNLAG.value,
        EventType.RESPONS_GRUNNLAG_OPPDATERT.value,
        EventType.RESPONS_VEDERLAG.value,
        EventType.RESPONS_VEDERLAG_OPPDATERT.value,
        EventType.RESPONS_FRIST.value,
        EventType.RESPONS_FRIST_OPPDATERT.value,
    ]
    if event_type in respons_event_types:
        # Try to extract spor from data (if frontend sent it there)
        data = request_data.get("data", {})
        if isinstance(data, dict) and "spor" in data:
            request_data["spor"] = data.pop("spor")

        # If still no spor, derive from event_type
        if "spor" not in request_data:
            spor_map = {
                EventType.RESPONS_GRUNNLAG.value: SporType.GRUNNLAG.value,
                EventType.RESPONS_GRUNNLAG_OPPDATERT.value: SporType.GRUNNLAG.value,
                EventType.RESPONS_VEDERLAG.value: SporType.VEDERLAG.value,
                EventType.RESPONS_VEDERLAG_OPPDATERT.value: SporType.VEDERLAG.value,
                EventType.RESPONS_FRIST.value: SporType.FRIST.value,
                EventType.RESPONS_FRIST_OPPDATERT.value: SporType.FRIST.value,
            }
            request_data["spor"] = spor_map.get(event_type)

    return parse_event(request_data)
