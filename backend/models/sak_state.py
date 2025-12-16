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
    AnyEvent,
)


# ============ SAKSTYPE OG RELASJONER ============

class SaksType(str, Enum):
    """
    Type sak.

    STANDARD: Ordinær endringssak med grunnlag/vederlag/frist-spor
    FORSERING: § 33.8 forseringssak som refererer til avslåtte fristforlengelser
    """
    STANDARD = "standard"
    FORSERING = "forsering"
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
        description="Catenda topic GUID for relatert sak"
    )
    relatert_sak_tittel: Optional[str] = Field(
        default=None,
        description="Cached tittel for display"
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
    bh_resultat: Optional[GrunnlagResponsResultat] = Field(
        default=None,
        description="BHs siste respons på ansvarsgrunnlaget"
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

    # Metadata
    siste_event_id: Optional[str] = Field(default=None)
    siste_oppdatert: Optional[datetime] = Field(default=None)
    antall_versjoner: int = Field(default=0)


class ForseringTilstand(BaseModel):
    """
    Tilstand for forsering (§33.8).

    Når BH avslår fristkrav, kan TE varsle om at de vil iverksette forsering.
    Forseringskostnader kan da kreves dekket (innenfor 30%-grensen).
    """
    er_varslet: bool = Field(default=False)
    dato_varslet: Optional[str] = Field(default=None)
    estimert_kostnad: Optional[float] = Field(default=None)
    begrunnelse: Optional[str] = Field(default=None)
    bekreft_30_prosent_regel: Optional[bool] = Field(
        default=None,
        description="TE bekrefter at kostnad < dagmulkt + 30%"
    )
    er_iverksatt: bool = Field(default=False)
    dato_iverksatt: Optional[str] = Field(default=None)
    er_stoppet: bool = Field(
        default=False,
        description="True hvis BH godkjenner frist etter varsling"
    )
    dato_stoppet: Optional[str] = Field(default=None)
    paalopte_kostnader: Optional[float] = Field(
        default=None,
        description="Costs incurred before stop"
    )


class ForseringData(BaseModel):
    """
    Data spesifikk for forseringssaker (§ 33.8) som egen sak.

    Denne modellen brukes når forsering er modellert som en egen sak
    med relasjoner til avslåtte fristforlengelsessaker (relasjonell modell).

    Forskjell fra ForseringTilstand:
    - ForseringTilstand: Embedded i FristTilstand (gammel modell)
    - ForseringData: For forseringssak som egen sak (ny modell)
    """
    # Referanser til opprinnelige saker
    avslatte_fristkrav: List[str] = Field(
        default_factory=list,
        description="SAK-IDs til avslåtte fristforlengelser"
    )

    # Varsling
    dato_varslet: str = Field(
        ...,
        description="Dato forsering ble varslet (ISO format)"
    )
    estimert_kostnad: float = Field(
        ...,
        description="TE's estimerte forseringskostnad"
    )
    bekreft_30_prosent_regel: bool = Field(
        default=False,
        description="TE bekrefter kostnad < dagmulkt + 30%"
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

    # BH respons
    bh_aksepterer_forsering: Optional[bool] = Field(
        default=None,
        description="Om BH aksepterer forseringskravet"
    )
    bh_godkjent_kostnad: Optional[float] = Field(
        default=None,
        description="Kostnad godkjent av BH"
    )
    bh_begrunnelse: Optional[str] = Field(
        default=None,
        description="BH's begrunnelse"
    )

    # Computed field for visning
    @computed_field
    @property
    def kostnad_innenfor_grense(self) -> bool:
        """Sjekker om estimert kostnad er innenfor 30%-grensen"""
        if self.maks_forseringskostnad <= 0:
            return False
        return self.estimert_kostnad <= self.maks_forseringskostnad


class FristTilstand(BaseModel):
    """Aggregert tilstand for frist-sporet"""
    status: SporStatus = Field(
        default=SporStatus.IKKE_RELEVANT,
        description="Nåværende status for frist"
    )

    # Siste krav fra TE
    varsel_type: Optional[str] = Field(
        default=None,
        description="Type varsel: noytralt, spesifisert, eller begge"
    )
    noytralt_varsel_dato: Optional[str] = Field(default=None)
    spesifisert_krav_dato: Optional[str] = Field(default=None)
    krevd_dager: Optional[int] = Field(default=None)
    begrunnelse: Optional[str] = Field(default=None)
    milepael_pavirket: Optional[str] = Field(default=None)
    fremdriftsanalyse_vedlagt: bool = Field(default=False)

    # BH respons - Port 1 (Varsling)
    noytralt_varsel_ok: Optional[bool] = Field(default=None)
    spesifisert_krav_ok: Optional[bool] = Field(default=None)
    har_bh_etterlyst: Optional[bool] = Field(default=None)
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
    begrunnelse_beregning: Optional[str] = Field(default=None)
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

    # Forsering (§33.8)
    forsering: Optional[ForseringTilstand] = Field(
        default=None,
        description="Forseringstilstand hvis TE har varslet om forsering"
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
    def er_force_majeure(self) -> bool:
        """
        Sjekker om saken er erkjent som Force Majeure (§33.3).

        Force Majeure betyr:
        - TE får fristforlengelse (ingen dagmulkt)
        - TE får IKKE vederlag (§33.3 - partene bærer egne kostnader)

        FRONTEND: Vis dette tydelig - TE kan ikke kreve vederlag.
        """
        return self.grunnlag.bh_resultat == GrunnlagResponsResultat.ERKJENN_FM

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

        NB: Gjelder IKKE ved Force Majeure (da er vederlag alltid avslått)
        eller frafall (da lukkes saken).

        Dette betyr: "BH mener TE har ansvar, men erkjenner at
        beløpet ville vært riktig hvis BH hadde hatt ansvar."

        FRONTEND: Bruk dette for å vise subsidiær status.
        Ikke implementer denne logikken selv i frontend.
        """
        # Force Majeure og frafall håndteres separat
        if self.er_force_majeure or self.er_frafalt:
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
        - "Ikke aktuelt (Force Majeure)"
        """
        if self.vederlag.status == SporStatus.IKKE_RELEVANT:
            return "Ikke aktuelt"

        # Force Majeure: Vederlag er alltid avslått per §33.3
        if self.er_force_majeure:
            return "Ikke aktuelt (Force Majeure - §33.3)"

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
            return f"Delvis godkjent - {self.vederlag.godkjent_belop:,.0f} kr"
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
            return f"Delvis godkjent - {self.frist.godkjent_dager} dager"
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

        # Sjekk om alle er GODKJENT eller LAAST
        godkjent_statuser = {SporStatus.GODKJENT, SporStatus.LAAST}
        if all(s in godkjent_statuser for s in aktive_statuser):
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
