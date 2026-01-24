"""
SakState - Aggregert tilstand for en sak.

Dette er "view"-modellen som frontend bruker.
Den beregnes fra event-loggen og representerer "nå-situasjonen".

SakState er READ-ONLY og regenereres hver gang fra events.
"""
from enum import Enum
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List, Union
from datetime import datetime

from models.events import (
    SporStatus,
    SporType,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
    VarselInfo,
    AnyEvent,
)


# ============ SAKSTYPE OG RELASJONER ============

class SaksType(str, Enum):
    """
    Type sak.

    STANDARD: Ordinær endringssak med grunnlag/vederlag/frist-spor
    FORSERING: § 33.8 forseringssak som refererer til avslåtte fristforlengelser
    ENDRINGSORDRE: Formell endringsordre (§31.3) som samler en eller flere KOE-er
    FRAVIK: Fravik fra utslippsfrie krav på byggeplasser
    """
    STANDARD = "standard"
    FORSERING = "forsering"
    ENDRINGSORDRE = "endringsordre"
    FRAVIK = "fravik"
    # Fremtidige utvidelser:
    # REKLAMASJON = "reklamasjon"
    # SLUTTOPPGJOR = "sluttoppgjor"


class SakRelasjon(BaseModel):
    """
    Relasjon til en annen sak.

    Merk: Catenda API lagrer kun `related_topic_guid` uten semantisk type.
    Relasjonstype utledes fra sakstype:
    - FORSERING sak → relaterte saker er "basert_paa" (avslåtte fristforlengelser)
    - Fremtidige sakstyper kan ha egne utledningsregler
    """
    relatert_sak_id: str = Field(
        ...,
        description="Lokal sak-ID for relatert sak (for event lookup)"
    )
    relatert_sak_tittel: Optional[str] = Field(
        default=None,
        description="Cached tittel for display"
    )
    catenda_topic_id: Optional[str] = Field(
        default=None,
        description="Catenda topic GUID for relatert sak"
    )
    # Fra Catenda API response:
    bimsync_issue_board_ref: Optional[str] = Field(
        default=None,
        description="Topic board ID for cross-board relasjoner"
    )
    bimsync_issue_number: Optional[int] = Field(
        default=None,
        description="Lesbart saksnummer i Catenda"
    )


# ============ SPOR-TILSTANDER ============

class GrunnlagTilstand(BaseModel):
    """Aggregert tilstand for grunnlag-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for grunnlag"
    )
    tittel: Optional[str] = Field(
        default=None,
        description="Kort beskrivende tittel for varselet"
    )
    hovedkategori: Optional[str] = Field(default=None)
    underkategori: Optional[Union[str, List[str]]] = Field(
        default=None,
        description="Can be single string or array of codes"
    )
    beskrivelse: Optional[str] = Field(default=None)
    dato_oppdaget: Optional[str] = Field(default=None)
    grunnlag_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Info om når og hvordan BH ble varslet om forholdet"
    )
    kontraktsreferanser: List[str] = Field(default_factory=list)

    # BH respons
    bh_resultat: Optional[GrunnlagResponsResultat] = Field(
        default=None,
        description="BHs siste respons på ansvarsgrunnlaget"
    )
    bh_begrunnelse: Optional[str] = Field(default=None)
    laast: bool = Field(
        default=False,
        description="Om grunnlaget er låst (godkjent og kan ikke endres)"
    )
    bh_respondert_versjon: Optional[int] = Field(
        default=None,
        description="Hvilken versjon av kravet BH sist responderte på (0-indeksert)"
    )

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


class VederlagTilstand(BaseModel):
    """
    Aggregert tilstand for vederlag-sporet.

    UPDATED (2025-12-06):
    - Replaced krevd_belop with belop_direkte/kostnads_overslag per metode
    - Added saerskilt_krav with nested rigg_drift/produktivitet items
    """
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for vederlag"
    )

    # Siste krav fra TE - hovedbeløp avhenger av metode
    metode: Optional[str] = Field(
        default=None,
        description="Vederlagsmetode kode (ENHETSPRISER, REGNINGSARBEID, FASTPRIS_TILBUD)"
    )
    belop_direkte: Optional[float] = Field(
        default=None,
        description="For ENHETSPRISER/FASTPRIS_TILBUD: Krevd beløp (kan være negativt = fradrag)"
    )
    kostnads_overslag: Optional[float] = Field(
        default=None,
        description="For REGNINGSARBEID (§30.2): Kostnadsoverslag"
    )
    krever_justert_ep: bool = Field(
        default=False,
        description="For ENHETSPRISER: Krever justerte enhetspriser"
    )
    begrunnelse: Optional[str] = Field(default=None)

    # Særskilte krav (§34.1.3) - separate beløp og datoer per type
    saerskilt_krav: Optional[dict] = Field(
        default=None,
        description="Nested struktur: {rigg_drift: {belop, dato_klar_over}, produktivitet: {belop, dato_klar_over}}"
    )

    # Varselinfo fra TE (VarselInfo structure)
    rigg_drift_varsel: Optional[dict] = Field(default=None)
    justert_ep_varsel: Optional[dict] = Field(default=None)
    regningsarbeid_varsel: Optional[dict] = Field(default=None)
    produktivitetstap_varsel: Optional[dict] = Field(default=None)
    krav_fremmet_dato: Optional[str] = Field(default=None)

    # BH respons - Port 1 (Varsling)
    saerskilt_varsel_rigg_drift_ok: Optional[bool] = Field(default=None)
    varsel_justert_ep_ok: Optional[bool] = Field(default=None)
    varsel_start_regning_ok: Optional[bool] = Field(default=None)
    krav_fremmet_i_tide: Optional[bool] = Field(default=None)
    begrunnelse_varsel: Optional[str] = Field(default=None)

    # BH respons - Port 2 (Beregning)
    bh_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="BH vurdering av beregningen (ren utmåling)"
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

    # Subsidiært standpunkt (fra BH respons event)
    subsidiaer_triggers: Optional[List[str]] = Field(
        default=None,
        description="Liste over triggere for subsidiær vurdering"
    )
    subsidiaer_resultat: Optional[VederlagBeregningResultat] = Field(
        default=None,
        description="Subsidiært beregningsresultat"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse for subsidiær vurdering"
    )

    # Computed: Krevd beløp basert på metode
    @computed_field
    @property
    def krevd_belop(self) -> Optional[float]:
        """Returnerer krevd beløp basert på metode (for bakoverkompatibilitet)"""
        if self.metode == "REGNINGSARBEID":
            return self.kostnads_overslag
        return self.belop_direkte

    # Differanse-info (nyttig for UI)
    @computed_field
    @property
    def differanse(self) -> Optional[float]:
        """Differansen mellom krevd og godkjent beløp"""
        krevd = self.krevd_belop
        if krevd is not None and self.godkjent_belop is not None:
            return krevd - self.godkjent_belop
        return None

    @computed_field
    @property
    def godkjenningsgrad_prosent(self) -> Optional[float]:
        """Hvor mange prosent av kravet som er godkjent"""
        krevd = self.krevd_belop
        if krevd and krevd > 0 and self.godkjent_belop is not None:
            return round((self.godkjent_belop / krevd) * 100, 1)
        return None

    @computed_field
    @property
    def har_subsidiaert_standpunkt(self) -> bool:
        """True hvis BH har tatt subsidiær stilling på event-nivå"""
        return self.subsidiaer_resultat is not None

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """
        Kombinert status for UI-visning inkludert subsidiær info.

        Returnerer en av:
        - "godkjent" / "delvis_godkjent" / "avslatt" / "hold_tilbake"
        - "avslatt_subsidiaert_godkjent" (prinsipal avslått, subsidiært godkjent)
        """
        if self.bh_resultat is None:
            return self.status.value

        # Sjekk om prinsipal avslått men subsidiært godkjent
        avslatt_koder = {
            VederlagBeregningResultat.AVSLATT,
        }
        godkjent_koder = {
            VederlagBeregningResultat.GODKJENT,
            VederlagBeregningResultat.DELVIS_GODKJENT,
        }

        if self.bh_resultat in avslatt_koder:
            if self.subsidiaer_resultat in godkjent_koder:
                return "avslatt_subsidiaert_godkjent"

        return self.bh_resultat.value

    # BH respons-versjon tracking
    bh_respondert_versjon: Optional[int] = Field(
        default=None,
        description="Hvilken versjon av kravet BH sist responderte på (0-indeksert)"
    )

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


# ============ FORSERING VEDERLAG (§33.8 + §34.1.3) ============

class ForseringVederlag(BaseModel):
    """
    Vederlagsstruktur for forsering (§33.8).

    Forsering er et pengekrav som følger vederlagsreglene i §34.
    Per §34.4 brukes typisk regningsarbeid når ingen enhetspriser finnes.
    Per §34.1.3 kan særskilte krav (rigg/drift, produktivitet) også gjelde.
    """
    # Metode (§34.4 - typisk regningsarbeid for forsering)
    metode: str = Field(
        default="REGNINGSARBEID",
        description="Vederlagsmetode (typisk REGNINGSARBEID for forsering per §34.4)"
    )

    # Særskilte krav (§34.1.3) - kan også gjelde forsering
    saerskilt_krav: Optional[dict] = Field(
        default=None,
        description="Nested struktur: {rigg_drift: {belop, dato_klar_over}, produktivitet: {belop, dato_klar_over}}"
    )

    # Varselinfo for særskilte krav
    rigg_drift_varsel: Optional[dict] = Field(
        default=None,
        description="VarselInfo for rigg/drift ved forsering"
    )
    produktivitet_varsel: Optional[dict] = Field(
        default=None,
        description="VarselInfo for produktivitetstap ved forsering"
    )


class ForseringBHRespons(BaseModel):
    """
    BHs strukturerte respons på forseringskrav (tre-port modell).

    Port 1: Per-sak vurdering av forseringsrett (§33.8)
    Port 2: Er 30%-regelen overholdt?
    Port 3: Beløpsvurdering (hovedkrav + særskilte krav)
    """
    # Port 1: Per-sak vurdering av forseringsrett (§33.8)
    vurdering_per_sak: Optional[List[dict]] = Field(
        default=None,
        description="BHs vurdering av forseringsrett per sak"
    )
    dager_med_forseringsrett: Optional[int] = Field(
        default=None,
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

    # Port 2: 30%-regel validering (§33.8)
    trettiprosent_overholdt: Optional[bool] = Field(
        default=None,
        description="BH vurderer om estimert kostnad er innenfor 30%-grensen"
    )
    trettiprosent_begrunnelse: Optional[str] = Field(
        default=None,
        description="BHs begrunnelse ved avvik fra 30%-regelen"
    )

    # Port 3: Beløpsvurdering
    aksepterer: bool = Field(
        ...,
        description="Om BH aksepterer forseringskravet"
    )
    godkjent_belop: Optional[float] = Field(
        default=None,
        description="Godkjent forseringskostnad (hovedkrav)"
    )
    begrunnelse: str = Field(
        ...,
        description="BHs begrunnelse for responsen"
    )

    # Port 3b: Særskilte krav vurdering (§34.1.3)
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
        description="Godkjent rigg/drift-beløp"
    )
    godkjent_produktivitet: Optional[float] = Field(
        default=None,
        description="Godkjent produktivitetsbeløp"
    )

    # Subsidiært standpunkt
    subsidiaer_triggers: Optional[List[str]] = Field(
        default=None,
        description="Triggere for subsidiær vurdering (f.eks. 'grunnlag_bestridt')"
    )
    subsidiaer_godkjent_belop: Optional[float] = Field(
        default=None,
        description="Subsidiært godkjent beløp"
    )
    subsidiaer_begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for subsidiært standpunkt"
    )

    # Metadata
    dato_respons: Optional[str] = Field(
        default=None,
        description="Dato for BH respons (ISO format)"
    )

    # Computed: Total godkjent
    @computed_field
    @property
    def total_godkjent(self) -> Optional[float]:
        """Beregner totalt godkjent beløp (hovedkrav + særskilte)"""
        if self.godkjent_belop is None:
            return None
        total = self.godkjent_belop
        if self.godkjent_rigg_drift:
            total += self.godkjent_rigg_drift
        if self.godkjent_produktivitet:
            total += self.godkjent_produktivitet
        return total


class ForseringData(BaseModel):
    """
    Data for forseringssaker (§33.8).

    Forsering er alltid en selvstendig sak med SaksType.FORSERING,
    med relasjoner til avslåtte fristforlengelsessaker.
    """
    # Referanser til opprinnelige saker
    avslatte_fristkrav: List[str] = Field(
        default_factory=list,
        description="SAK-IDs til avslåtte fristforlengelser"
    )

    # Varsling (settes av FORSERING_VARSEL event, ikke ved sak-opprettelse)
    dato_varslet: Optional[str] = Field(
        default=None,
        description="Dato forsering ble varslet (ISO format)"
    )
    estimert_kostnad: Optional[float] = Field(
        default=None,
        description="TE's estimerte forseringskostnad"
    )
    bekreft_30_prosent_regel: bool = Field(
        default=False,
        description="TE bekrefter kostnad < dagmulkt + 30%"
    )
    begrunnelse: Optional[str] = Field(
        default=None,
        description="TE's begrunnelse for forsering"
    )

    # Kalkulasjonsgrunnlag
    avslatte_dager: int = Field(
        default=0,
        description="Sum av avslåtte dager fra fristforlengelsene"
    )
    dagmulktsats: float = Field(
        default=0.0,
        description="Dagmulktsats fra kontrakten (NOK per dag)"
    )
    maks_forseringskostnad: float = Field(
        default=0.0,
        description="Beregnet: avslatte_dager * dagmulktsats * 1.3"
    )

    # Status
    er_iverksatt: bool = Field(
        default=False,
        description="Om forsering er iverksatt"
    )
    dato_iverksatt: Optional[str] = Field(
        default=None,
        description="Dato forsering ble iverksatt"
    )
    er_stoppet: bool = Field(
        default=False,
        description="True hvis BH godkjenner frist etter varsling"
    )
    dato_stoppet: Optional[str] = Field(
        default=None,
        description="Dato forsering ble stoppet"
    )
    paalopte_kostnader: Optional[float] = Field(
        default=None,
        description="Påløpte kostnader ved stopp"
    )

    # BH respons (legacy - beholdes for bakoverkompatibilitet)
    bh_aksepterer_forsering: Optional[bool] = Field(
        default=None,
        description="[Legacy] Om BH aksepterer forseringskravet"
    )
    bh_godkjent_kostnad: Optional[float] = Field(
        default=None,
        description="[Legacy] Kostnad godkjent av BH"
    )
    bh_begrunnelse: Optional[str] = Field(
        default=None,
        description="[Legacy] BH's begrunnelse"
    )

    # Ny vederlagsstruktur (§34)
    vederlag: Optional[ForseringVederlag] = Field(
        default=None,
        description="Vederlagsdetaljer inkl. metode og særskilte krav"
    )

    # Ny strukturert BH-respons (tre-port modell)
    bh_respons: Optional[ForseringBHRespons] = Field(
        default=None,
        description="BHs strukturerte respons med tre-port vurdering"
    )

    # Computed field for visning
    @computed_field
    @property
    def kostnad_innenfor_grense(self) -> bool:
        """Sjekker om estimert kostnad er innenfor 30%-grensen"""
        if self.maks_forseringskostnad <= 0:
            return False
        if self.estimert_kostnad is None:
            return False
        return self.estimert_kostnad <= self.maks_forseringskostnad


# ============ ENDRINGSORDRE (§31.3) ============

class EOStatus(str, Enum):
    """
    Status for endringsordre.

    Livssyklus:
    UTKAST → UTSTEDT → AKSEPTERT/BESTRIDT → (evt. REVIDERT → AKSEPTERT)
    """
    UTKAST = "utkast"              # BH forbereder EO
    UTSTEDT = "utstedt"            # BH har utstedt EO
    AKSEPTERT = "akseptert"        # TE har akseptert EO
    BESTRIDT = "bestridt"          # TE har bestridt EO (fremmer nytt KOE)
    REVIDERT = "revidert"          # BH har revidert EO etter bestridelse


class EOKonsekvenser(BaseModel):
    """
    Konsekvenser av endringen (fra Endringsordre-malen).

    Checkboxes som angir hvilke områder som påvirkes.
    Hvis ingen er valgt, innebærer endringen ingen konsekvenser.
    """
    sha: bool = Field(
        default=False,
        description="Endringen har SHA-konsekvenser (Sikkerhet, Helse, Arbeidsmiljø)"
    )
    kvalitet: bool = Field(
        default=False,
        description="Endringen har kvalitetskonsekvenser"
    )
    fremdrift: bool = Field(
        default=False,
        description="Endringen har fremdriftskonsekvenser (fristforlengelse)"
    )
    pris: bool = Field(
        default=False,
        description="Endringen har priskonsekvenser (vederlag)"
    )
    annet: bool = Field(
        default=False,
        description="Endringen har andre konsekvenser"
    )

    @computed_field
    @property
    def har_konsekvenser(self) -> bool:
        """Sjekker om minst én konsekvens er valgt"""
        return any([self.sha, self.kvalitet, self.fremdrift, self.pris, self.annet])


class EndringsordreData(BaseModel):
    """
    Data spesifikk for endringsordresaker (§31.3) som egen sak.

    Endringsordre (EO) er det formelle dokumentet som bekrefter en endring
    i kontrakten. En EO kan samle flere KOE-er (Krav om Endringsordre).

    Tilsvarende ForseringData, men for endringsordrer i stedet for forsering.

    Oppgjørsform og indeksregulering:
    - ENHETSPRISER: Full indeksregulering (§26.2)
    - REGNINGSARBEID: Delvis indeksregulering (timerater)
    - FASTPRIS_TILBUD: Ingen indeksregulering
    - Se backend/constants/vederlag_methods.py for detaljer
    """
    # Referanser til KOE-saker som inngår i denne EO-en
    relaterte_koe_saker: List[str] = Field(
        default_factory=list,
        description="SAK-IDs til KOE-er som inngår i denne endringsordren"
    )

    # Identifikasjon
    eo_nummer: str = Field(
        ...,
        description="Endringsordre-nummer (prosjektets nummerering)"
    )
    revisjon_nummer: int = Field(
        default=0,
        description="Revisjonsnummer (0 = original, 1+ = revisjoner)"
    )

    # Beskrivelse av endringen (§31.3: hva endringen går ut på)
    beskrivelse: str = Field(
        ...,
        description="Beskrivelse av hva endringen går ut på"
    )
    vedlegg_ids: List[str] = Field(
        default_factory=list,
        description="Referanser til vedlagte dokumenter"
    )

    # Konsekvenser (fra Endringsordre-malen)
    konsekvenser: EOKonsekvenser = Field(
        default_factory=EOKonsekvenser,
        description="Hvilke konsekvenser endringen har"
    )
    konsekvens_beskrivelse: Optional[str] = Field(
        default=None,
        description="Beskrivelse av konsekvensene (hvis konsekvenser finnes)"
    )

    # Oppgjørsform ved priskonsekvens (gjenbruker VederlagsMetode fra constants)
    oppgjorsform: Optional[str] = Field(
        default=None,
        description="Oppgjørsform: ENHETSPRISER, REGNINGSARBEID, FASTPRIS_TILBUD"
    )

    # Beløp
    kompensasjon_belop: Optional[float] = Field(
        default=None,
        description="Kompensasjonsbeløp til TE (positivt = tillegg)"
    )
    fradrag_belop: Optional[float] = Field(
        default=None,
        description="Fradragsbeløp (negativt = fratrekk fra kontraktssum)"
    )
    er_estimat: bool = Field(
        default=False,
        description="Om beløpet er et estimat (endelig oppgjør senere)"
    )

    # Fristkonsekvens
    frist_dager: Optional[int] = Field(
        default=None,
        description="Antall dager fristforlengelse"
    )
    ny_sluttdato: Optional[str] = Field(
        default=None,
        description="Ny sluttdato etter fristforlengelse (YYYY-MM-DD)"
    )

    # Status og metadata
    status: EOStatus = Field(
        default=EOStatus.UTKAST,
        description="Nåværende status for endringsordren"
    )
    dato_utstedt: Optional[str] = Field(
        default=None,
        description="Dato EO ble utstedt (YYYY-MM-DD)"
    )
    utstedt_av: Optional[str] = Field(
        default=None,
        description="Navn på person som utstedte EO (BH-representant)"
    )

    # TE-respons
    te_akseptert: Optional[bool] = Field(
        default=None,
        description="Om TE har akseptert EO"
    )
    te_kommentar: Optional[str] = Field(
        default=None,
        description="TEs kommentar ved aksept/bestridelse"
    )
    dato_te_respons: Optional[str] = Field(
        default=None,
        description="Dato for TEs respons (YYYY-MM-DD)"
    )

    # Computed fields
    @computed_field
    @property
    def netto_belop(self) -> float:
        """Beregner netto beløp (kompensasjon - fradrag)"""
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


class FristTilstand(BaseModel):
    """Aggregert tilstand for frist-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for frist"
    )

    # Siste krav fra TE
    varsel_type: Optional[str] = Field(
        default=None,
        description="Type varsel: varsel (§33.4), spesifisert (§33.6), eller begge"
    )
    frist_varsel: Optional[VarselInfo] = Field(
        default=None,
        description="Varsel om fristforlengelse (§33.4)"
    )
    spesifisert_varsel: Optional[VarselInfo] = Field(default=None)
    krevd_dager: Optional[int] = Field(default=None)
    begrunnelse: Optional[str] = Field(default=None)

    # BH respons - Port 1 (Varsling)
    frist_varsel_ok: Optional[bool] = Field(
        default=None,
        description="Var varsel om fristforlengelse (§33.4) rettidig?"
    )
    spesifisert_krav_ok: Optional[bool] = Field(default=None)
    foresporsel_svar_ok: Optional[bool] = Field(
        default=None,
        description="Var svar på forespørsel (§33.6.2) rettidig?"
    )
    har_bh_foresporsel: Optional[bool] = Field(
        default=None,
        description="Har BH sendt forespørsel om spesifisering (§33.6.2)?"
    )
    dato_bh_foresporsel: Optional[str] = Field(
        default=None,
        description="Dato BH sendte forespørsel om spesifisering (§33.6.2) - YYYY-MM-DD"
    )
    begrunnelse_varsel: Optional[str] = Field(default=None)

    # BH respons - Port 2 (Vilkår/Årsakssammenheng)
    vilkar_oppfylt: Optional[bool] = Field(default=None)
    begrunnelse_vilkar: Optional[str] = Field(default=None)

    # BH respons - Port 3 (Beregning)
    bh_resultat: Optional[FristBeregningResultat] = Field(
        default=None,
        description="BH vurdering av dagberegningen (ren utmåling)"
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

    # Subsidiært standpunkt (fra BH respons event)
    subsidiaer_triggers: Optional[List[str]] = Field(
        default=None,
        description="Liste over triggere for subsidiær vurdering"
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

    # Differanse-info
    @computed_field
    @property
    def differanse_dager(self) -> Optional[int]:
        """Differansen mellom krevde og godkjente dager"""
        if self.krevd_dager is not None and self.godkjent_dager is not None:
            return self.krevd_dager - self.godkjent_dager
        return None

    @computed_field
    @property
    def har_subsidiaert_standpunkt(self) -> bool:
        """True hvis BH har tatt subsidiær stilling på event-nivå"""
        return self.subsidiaer_resultat is not None

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """
        Kombinert status for UI-visning inkludert subsidiær info.

        Returnerer en av:
        - "godkjent" / "delvis_godkjent" / "avslatt"
        - "avslatt_subsidiaert_godkjent" (prinsipal avslått, subsidiært godkjent)
        """
        if self.bh_resultat is None:
            return self.status.value

        # Sjekk om prinsipal avslått men subsidiært godkjent
        avslatt_koder = {
            FristBeregningResultat.AVSLATT,
        }
        godkjent_koder = {
            FristBeregningResultat.GODKJENT,
            FristBeregningResultat.DELVIS_GODKJENT,
        }

        if self.bh_resultat in avslatt_koder:
            if self.subsidiaer_resultat in godkjent_koder:
                return "avslatt_subsidiaert_godkjent"

        return self.bh_resultat.value

    # BH respons-versjon tracking
    bh_respondert_versjon: Optional[int] = Field(
        default=None,
        description="Hvilken versjon av kravet BH sist responderte på (0-indeksert)"
    )

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

    # Sakstype og relasjoner (ny relasjonell modell for forsering)
    sakstype: SaksType = Field(
        default=SaksType.STANDARD,
        description="Type sak: standard endringssak eller forseringssak"
    )
    relaterte_saker: List[SakRelasjon] = Field(
        default_factory=list,
        description="Relasjoner til andre saker (f.eks. forseringssak → avslåtte fristforlengelser)"
    )

    # Forseringsdata (kun for sakstype=FORSERING)
    forsering_data: Optional[ForseringData] = Field(
        default=None,
        description="Data for forseringssak (kun når sakstype=FORSERING)"
    )

    # Endringsordredata (kun for sakstype=ENDRINGSORDRE)
    endringsordre_data: Optional[EndringsordreData] = Field(
        default=None,
        description="Data for endringsordresak (kun når sakstype=ENDRINGSORDRE)"
    )

    # De tre sporene (kun relevant for sakstype=STANDARD)
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

    # ============ SUBSIDIÆR LOGIKK (Computed Fields) ============
    # Disse computed fields håndterer kombinasjonen av Grunnlag-avslag
    # med Vederlag/Frist-godkjenning (subsidiære betraktninger).
    #
    # VIKTIG FOR FRONTEND:
    # Subsidiær logikk er en KOMBINASJON av:
    #   1. Grunnlag-sporet: BH avslår ansvarsgrunnlaget (AVSLATT)
    #   2. Vederlag/Frist-sporet: BH godkjenner beregningen (GODKJENT_FULLT/DELVIS_GODKJENT)
    #
    # Dette betyr: "BH mener TE har ansvaret, MEN erkjenner at hvis BH hadde hatt
    # ansvaret, så ville beløpet/dagene vært riktige."
    #
    # Event-modellene (VederlagResponsData, FristResponsData) inneholder KUN beregningen.
    # De har INGEN "avslått_pga_grunnlag" status - det ville bryte separasjonen av spor.
    #
    # FRONTEND MÅ:
    # 1. Bruke disse computed fields for å detektere subsidiær godkjenning
    # 2. Vise kombinert status: "Avslått pga. ansvar (Subsidiært enighet om X kr/dager)"
    # 3. Ikke legge til logikk i Vederlag/Frist-komponenter som refererer til Grunnlag
    # 4. La SakState være "sannheten" - ikke dupliser logikken i frontend

    @computed_field
    @property
    def er_frafalt(self) -> bool:
        """
        Sjekker om BH har frafalt pålegget (§32.3 c).

        Frafall betyr:
        - BH trekker tilbake den irregulære endringen
        - TE trenger ikke utføre arbeidet
        - TE kan kreve erstatning for påløpte kostnader

        Kun relevant for irregulære endringer (pålegg uten EO).
        """
        return self.grunnlag.bh_resultat == GrunnlagResponsResultat.FRAFALT

    @computed_field
    @property
    def er_subsidiaert_vederlag(self) -> bool:
        """
        Sjekker om vederlag er vurdert subsidiært.

        Returns True hvis:
        - Grunnlag er AVSLATT av BH, MEN
        - Vederlag-beregningen er godkjent (fullt/delvis/annen metode)

        NB: Gjelder IKKE ved frafall (da lukkes saken).

        Dette betyr: "BH mener TE har ansvar, men erkjenner at
        beløpet ville vært riktig hvis BH hadde hatt ansvar."

        FRONTEND: Bruk dette for å vise subsidiær status.
        Ikke implementer denne logikken selv i frontend.
        """
        # Frafall håndteres separat
        if self.er_frafalt:
            return False

        grunnlag_avslatt = self.grunnlag.status == SporStatus.AVSLATT
        beregning_godkjent = self.vederlag.bh_resultat in {
            VederlagBeregningResultat.GODKJENT,
            VederlagBeregningResultat.DELVIS_GODKJENT,
        }
        return grunnlag_avslatt and beregning_godkjent

    @computed_field
    @property
    def er_subsidiaert_frist(self) -> bool:
        """
        Sjekker om frist er vurdert subsidiært.

        Returns True hvis:
        - Grunnlag er AVSLATT av BH, MEN
        - Frist-beregningen er godkjent (fullt/delvis)

        Dette betyr: "BH mener TE har ansvar, men erkjenner at
        dagene ville vært riktige hvis BH hadde hatt ansvar."

        FRONTEND: Bruk dette for å vise subsidiær status.
        Ikke implementer denne logikken selv i frontend.
        """
        grunnlag_avslatt = self.grunnlag.status == SporStatus.AVSLATT
        beregning_godkjent = self.frist.bh_resultat in {
            FristBeregningResultat.GODKJENT,
            FristBeregningResultat.DELVIS_GODKJENT,
        }
        return grunnlag_avslatt and beregning_godkjent

    @computed_field
    @property
    def visningsstatus_vederlag(self) -> str:
        """
        Beregner visningsstatus for Vederlag som tar hensyn til subsidiær logikk.

        Eksempler:
        - "Avslått (Subsidiært enighet om 50 000 kr)"
        - "Godkjent - 120 000 kr"
        - "Under behandling"
        """
        if self.vederlag.status == SporStatus.IKKE_RELEVANT:
            return "Ikke aktuelt"

        # Frafall: Saken er lukket, men TE kan kreve påløpte kostnader
        if self.er_frafalt:
            return "Avventer (pålegg frafalt - §32.3 c)"

        if self.er_subsidiaert_vederlag:
            belop = f"{self.vederlag.godkjent_belop:,.0f} kr" if self.vederlag.godkjent_belop else "beløp"
            if self.vederlag.bh_resultat == VederlagBeregningResultat.GODKJENT:
                return f"Avslått pga. ansvar (Subsidiært enighet om {belop})"
            elif self.vederlag.bh_resultat == VederlagBeregningResultat.DELVIS_GODKJENT:
                return f"Avslått pga. ansvar (Subsidiært delvis enig om {belop})"
            else:
                return f"Avslått pga. ansvar (Subsidiært)"

        # Normal (prinsipal) status
        if self.vederlag.status == SporStatus.GODKJENT:
            belop = f"{self.vederlag.godkjent_belop:,.0f} kr" if self.vederlag.godkjent_belop else ""
            return f"Godkjent - {belop}"
        elif self.vederlag.status == SporStatus.DELVIS_GODKJENT:
            belop = f"{self.vederlag.godkjent_belop:,.0f} kr" if self.vederlag.godkjent_belop else "beløp"
            return f"Delvis godkjent - {belop}"
        elif self.vederlag.status == SporStatus.AVSLATT:
            return "Avvist"
        elif self.vederlag.status == SporStatus.SENDT:
            return "Sendt - venter på svar"
        elif self.vederlag.status == SporStatus.UNDER_BEHANDLING:
            return "Under behandling"
        else:
            return self.vederlag.status.value

    @computed_field
    @property
    def visningsstatus_frist(self) -> str:
        """
        Beregner visningsstatus for Frist som tar hensyn til subsidiær logikk.

        Eksempler:
        - "Avslått (Subsidiært enighet om 14 dager)"
        - "Godkjent - 10 dager"
        - "Under behandling"
        """
        if self.frist.status == SporStatus.IKKE_RELEVANT:
            return "Ikke aktuelt"

        if self.er_subsidiaert_frist:
            dager = f"{self.frist.godkjent_dager} dager" if self.frist.godkjent_dager else "dager"
            if self.frist.bh_resultat == FristBeregningResultat.GODKJENT:
                return f"Avslått pga. ansvar (Subsidiært enighet om {dager})"
            elif self.frist.bh_resultat == FristBeregningResultat.DELVIS_GODKJENT:
                return f"Avslått pga. ansvar (Subsidiært delvis enig om {dager})"

        # Normal (prinsipal) status
        if self.frist.status == SporStatus.GODKJENT:
            dager = f"{self.frist.godkjent_dager} dager" if self.frist.godkjent_dager else ""
            return f"Godkjent - {dager}"
        elif self.frist.status == SporStatus.DELVIS_GODKJENT:
            dager = f"{self.frist.godkjent_dager} dager" if self.frist.godkjent_dager else "dager"
            return f"Delvis godkjent - {dager}"
        elif self.frist.status == SporStatus.AVSLATT:
            return "Avvist"
        elif self.frist.status == SporStatus.SENDT:
            return "Sendt - venter på svar"
        elif self.frist.status == SporStatus.UNDER_BEHANDLING:
            return "Under behandling"
        else:
            return self.frist.status.value

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
        - UNDER_FORHANDLING: BH har avslått/delvis godkjent noe
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

        # En sak er OMFORENT kun hvis alle aktive spor er eksplisitt avsluttet
        # (GODKJENT, LAAST, eller TRUKKET) - UTKAST betyr "kan fortsatt sendes"
        # og skal derfor hindre OMFORENT-status
        ferdig_statuser = {SporStatus.GODKJENT, SporStatus.LAAST, SporStatus.TRUKKET}
        if all(s in ferdig_statuser for s in aktive_statuser):
            # Minst ett spor må være godkjent (ikke bare trukket)
            if any(s in {SporStatus.GODKJENT, SporStatus.LAAST} for s in aktive_statuser):
                return "OMFORENT"

        # Sjekk om noen er TRUKKET
        if any(s == SporStatus.TRUKKET for s in aktive_statuser):
            if all(s == SporStatus.TRUKKET for s in aktive_statuser):
                return "LUKKET_TRUKKET"

        # Sjekk om noen er under forhandling
        forhandling_statuser = {SporStatus.UNDER_FORHANDLING, SporStatus.DELVIS_GODKJENT, SporStatus.AVSLATT}
        if any(s in forhandling_statuser for s in aktive_statuser):
            return "UNDER_FORHANDLING"

        # Sjekk om noen er under behandling
        if any(s == SporStatus.UNDER_BEHANDLING for s in aktive_statuser):
            return "UNDER_BEHANDLING"

        # Sjekk om noen er sendt
        if any(s == SporStatus.SENDT for s in aktive_statuser):
            return "VENTER_PAA_SVAR"

        # Sjekk om noen spor er utkast (og resten er ferdige)
        # Dette dekker tilfellet der f.eks. grunnlag er godkjent men vederlag ikke er sendt
        if any(s == SporStatus.UTKAST for s in aktive_statuser):
            ferdig_eller_utkast = ferdig_statuser | {SporStatus.UTKAST}
            if all(s in ferdig_eller_utkast for s in aktive_statuser):
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
            # Skip tracks that are not relevant or never used (utkast = no claim submitted)
            if spor.status in {SporStatus.IKKE_RELEVANT, SporStatus.UTKAST}:
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

        if self.grunnlag.status == SporStatus.AVSLATT:
            return {"rolle": "TE", "handling": "Oppdater grunnlag eller trekk saken", "spor": "grunnlag"}

        # Sjekk vederlag
        if self.vederlag.status == SporStatus.UTKAST:
            return {"rolle": "TE", "handling": "Send vederlagskrav", "spor": "vederlag"}

        if self.vederlag.status == SporStatus.SENDT:
            return {"rolle": "BH", "handling": "Vurder vederlagskrav", "spor": "vederlag"}

        if self.vederlag.status in {SporStatus.AVSLATT, SporStatus.UNDER_FORHANDLING}:
            return {"rolle": "TE", "handling": "Oppdater vederlagskrav", "spor": "vederlag"}

        # Sjekk frist
        if self.frist.status == SporStatus.UTKAST:
            return {"rolle": "TE", "handling": "Send fristkrav", "spor": "frist"}

        if self.frist.status == SporStatus.SENDT:
            return {"rolle": "BH", "handling": "Vurder fristkrav", "spor": "frist"}

        if self.frist.status in {SporStatus.AVSLATT, SporStatus.UNDER_FORHANDLING}:
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
    entreprenor: Optional[str] = Field(default=None, description="Totalentreprenør (TE)")
    byggherre: Optional[str] = Field(default=None, description="Byggherre (BH)")
    prosjekt_navn: Optional[str] = Field(default=None, description="Prosjektnavn fra Catenda")


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

    entreprenor: Optional[str] = None
    prosjekt_navn: Optional[str] = None
