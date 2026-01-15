"""
FravikState - Aggregert tilstand for en fravik-søknad.

Dette er "view"-modellen som frontend bruker.
Den beregnes fra event-loggen og representerer "nå-situasjonen".

FravikState er READ-ONLY og regenereres hver gang fra events.
"""
from enum import Enum
from pydantic import BaseModel, Field, computed_field
from typing import Optional, List, Dict
from datetime import datetime

from models.fravik_events import (
    FravikStatus,
    FravikBeslutning,
    MaskinType,
    FravikRolle,
)


# ============ MASKIN TILSTAND ============

class MaskinVurderingStatus(str, Enum):
    """Status for vurdering av en maskin"""
    IKKE_VURDERT = "ikke_vurdert"
    GODKJENT = "godkjent"
    AVSLATT = "avslatt"
    DELVIS_GODKJENT = "delvis_godkjent"


class MaskinBOIVurdering(BaseModel):
    """BOI-rådgivers vurdering av en maskin"""
    beslutning: FravikBeslutning = Field(
        ...,
        description="BOI sin anbefaling"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar fra BOI"
    )
    vilkar: List[str] = Field(
        default_factory=list,
        description="Eventuelle vilkår"
    )
    vurdert_av: Optional[str] = Field(
        default=None,
        description="Navn på BOI-rådgiver"
    )
    vurdert_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når vurderingen ble gjort"
    )


class MaskinArbeidsgruppeVurdering(BaseModel):
    """Arbeidsgruppens vurdering av en maskin"""
    beslutning: FravikBeslutning = Field(
        ...,
        description="Arbeidsgruppens innstilling"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar fra arbeidsgruppen"
    )
    vilkar: List[str] = Field(
        default_factory=list,
        description="Eventuelle vilkår"
    )
    vurdert_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når vurderingen ble gjort"
    )


class MaskinEierBeslutning(BaseModel):
    """Eiers beslutning for en maskin"""
    beslutning: FravikBeslutning = Field(
        ...,
        description="Eiers beslutning"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar fra eier"
    )
    besluttet_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når beslutningen ble tatt"
    )


class MaskinTilstand(BaseModel):
    """Aggregert tilstand for en maskin i søknaden"""
    maskin_id: str = Field(
        ...,
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
        description="Registreringsnummer"
    )
    start_dato: str = Field(
        ...,
        description="Start-dato for bruk (YYYY-MM-DD)"
    )
    slutt_dato: str = Field(
        ...,
        description="Slutt-dato for bruk (YYYY-MM-DD)"
    )
    begrunnelse: str = Field(
        ...,
        description="Begrunnelse for fravik"
    )
    alternativer_vurdert: Optional[str] = Field(
        default=None,
        description="Alternativer som er vurdert"
    )
    markedsundersokelse: bool = Field(
        default=False,
        description="Om markedsundersøkelse er gjennomført"
    )
    undersøkte_leverandorer: Optional[str] = Field(
        default=None,
        description="Undersøkte leverandører"
    )
    erstatningsmaskin: Optional[str] = Field(
        default=None,
        description="Foreslått erstatningsmaskin"
    )
    erstatningsdrivstoff: Optional[str] = Field(
        default=None,
        description="Drivstoff for erstatningsmaskin"
    )
    arbeidsbeskrivelse: Optional[str] = Field(
        default=None,
        description="Beskrivelse av arbeidet"
    )

    # Vurderinger
    boi_vurdering: Optional[MaskinBOIVurdering] = Field(
        default=None,
        description="BOI-rådgivers vurdering"
    )
    arbeidsgruppe_vurdering: Optional[MaskinArbeidsgruppeVurdering] = Field(
        default=None,
        description="Arbeidsgruppens vurdering"
    )
    eier_beslutning: Optional[MaskinEierBeslutning] = Field(
        default=None,
        description="Eiers beslutning"
    )

    # Computed status
    @computed_field
    @property
    def samlet_status(self) -> MaskinVurderingStatus:
        """Beregner samlet status for maskinen basert på vurderingskjeden"""
        # Prioriter eiers beslutning
        if self.eier_beslutning:
            return self._beslutning_til_status(self.eier_beslutning.beslutning)

        # Deretter arbeidsgruppens
        if self.arbeidsgruppe_vurdering:
            return self._beslutning_til_status(self.arbeidsgruppe_vurdering.beslutning)

        # Deretter BOI
        if self.boi_vurdering:
            return self._beslutning_til_status(self.boi_vurdering.beslutning)

        return MaskinVurderingStatus.IKKE_VURDERT

    def _beslutning_til_status(self, beslutning: FravikBeslutning) -> MaskinVurderingStatus:
        """Mapper FravikBeslutning til MaskinVurderingStatus"""
        mapping = {
            FravikBeslutning.GODKJENT: MaskinVurderingStatus.GODKJENT,
            FravikBeslutning.DELVIS_GODKJENT: MaskinVurderingStatus.DELVIS_GODKJENT,
            FravikBeslutning.AVSLATT: MaskinVurderingStatus.AVSLATT,
            FravikBeslutning.KREVER_AVKLARING: MaskinVurderingStatus.IKKE_VURDERT,
        }
        return mapping.get(beslutning, MaskinVurderingStatus.IKKE_VURDERT)


# ============ GODKJENNINGSKJEDE TILSTAND ============

class VurderingSteg(BaseModel):
    """Et steg i godkjenningskjeden"""
    fullfort: bool = Field(
        default=False,
        description="Om steget er fullført"
    )
    beslutning: Optional[FravikBeslutning] = Field(
        default=None,
        description="Beslutningen som ble tatt"
    )
    dokumentasjon_tilstrekkelig: Optional[bool] = Field(
        default=None,
        description="Om dokumentasjonen var tilstrekkelig"
    )
    kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar"
    )
    manglende_dokumentasjon: Optional[str] = Field(
        default=None,
        description="Hva som manglet (hvis returnert)"
    )
    vurdert_av: Optional[str] = Field(
        default=None,
        description="Hvem som vurderte"
    )
    vurdert_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når vurderingen skjedde"
    )


class GodkjenningsKjedeTilstand(BaseModel):
    """Tilstand for hele godkjenningskjeden"""
    boi_vurdering: VurderingSteg = Field(
        default_factory=VurderingSteg,
        description="BOI-rådgivers vurdering"
    )
    pl_vurdering: VurderingSteg = Field(
        default_factory=VurderingSteg,
        description="Prosjektleders vurdering"
    )
    arbeidsgruppe_vurdering: VurderingSteg = Field(
        default_factory=VurderingSteg,
        description="Arbeidsgruppens vurdering"
    )
    eier_beslutning: VurderingSteg = Field(
        default_factory=VurderingSteg,
        description="Eiers beslutning"
    )

    @computed_field
    @property
    def gjeldende_steg(self) -> str:
        """Returnerer hvilket steg som er aktivt nå"""
        if not self.boi_vurdering.fullfort:
            return "boi"
        if not self.pl_vurdering.fullfort:
            return "pl"
        if not self.arbeidsgruppe_vurdering.fullfort:
            return "arbeidsgruppe"
        if not self.eier_beslutning.fullfort:
            return "eier"
        return "ferdig"

    @computed_field
    @property
    def neste_godkjenner_rolle(self) -> Optional[FravikRolle]:
        """Returnerer rollen som skal godkjenne neste"""
        steg = self.gjeldende_steg
        mapping = {
            "boi": FravikRolle.BOI,
            "pl": FravikRolle.PL,
            "arbeidsgruppe": FravikRolle.ARBEIDSGRUPPE,
            "eier": FravikRolle.EIER,
        }
        return mapping.get(steg)


# ============ INFRASTRUKTUR TILSTAND ============

class InfrastrukturTilstand(BaseModel):
    """Tilstand for infrastruktur-søknad (ikke maskin)"""
    stromtilgang_beskrivelse: Optional[str] = Field(
        default=None,
        description="Beskrivelse av strømtilgang"
    )
    mobilt_batteri_vurdert: bool = Field(
        default=False,
        description="Om mobilt batteri er vurdert"
    )
    midlertidig_nett_vurdert: bool = Field(
        default=False,
        description="Om midlertidig nettilkobling er vurdert"
    )
    prosjektspesifikke_forhold: Optional[str] = Field(
        default=None,
        description="Prosjektspesifikke forhold"
    )
    kostnadsanalyse: Optional[str] = Field(
        default=None,
        description="Kostnadsanalyse"
    )
    infrastruktur_erstatning: Optional[str] = Field(
        default=None,
        description="Foreslått erstatning"
    )
    alternative_metoder: Optional[str] = Field(
        default=None,
        description="Alternative metoder vurdert"
    )


# ============ HOVEDMODELL: FRAVIK STATE ============

class FravikState(BaseModel):
    """
    Aggregert tilstand for en fravik-søknad.

    Denne modellen representerer "nå-situasjonen" for søknaden
    og beregnes alltid fra event-loggen.
    """
    # Identifikasjon
    soknad_id: str = Field(
        ...,
        description="Unik ID for søknaden"
    )
    sakstype: str = Field(
        default="fravik",
        description="Type sak (alltid 'fravik')"
    )

    # Prosjektinfo
    prosjekt_id: str = Field(
        ...,
        description="Prosjekt-ID"
    )
    prosjekt_navn: str = Field(
        ...,
        description="Prosjektnavn"
    )
    prosjekt_nummer: Optional[str] = Field(
        default=None,
        description="Prosjektnummer"
    )
    rammeavtale: Optional[str] = Field(
        default=None,
        description="Rammeavtale"
    )
    hovedentreprenor: Optional[str] = Field(
        default=None,
        description="Hovedentreprenør"
    )

    # Søkerinfo
    soker_navn: str = Field(
        ...,
        description="Navn på søker"
    )
    soker_epost: Optional[str] = Field(
        default=None,
        description="E-post til søker"
    )

    # Søknadsdetaljer
    soknad_type: str = Field(
        ...,
        description="Type søknad (machine/infrastructure)"
    )
    frist_for_svar: Optional[str] = Field(
        default=None,
        description="Ønsket frist for svar"
    )
    er_haste: bool = Field(
        default=False,
        description="Om søknaden haster"
    )
    haste_begrunnelse: Optional[str] = Field(
        default=None,
        description="Begrunnelse for hastebehandling"
    )

    # Avbøtende tiltak og konsekvenser
    avbotende_tiltak: Optional[str] = Field(
        default=None,
        description="Avbøtende tiltak"
    )
    konsekvenser_ved_avslag: Optional[str] = Field(
        default=None,
        description="Konsekvenser ved avslag"
    )

    # Status
    status: FravikStatus = Field(
        default=FravikStatus.UTKAST,
        description="Nåværende status"
    )

    # Maskiner (for maskin-søknader)
    maskiner: Dict[str, MaskinTilstand] = Field(
        default_factory=dict,
        description="Maskin-tilstander (key: maskin_id)"
    )

    # Infrastruktur (for infrastruktur-søknader)
    infrastruktur: Optional[InfrastrukturTilstand] = Field(
        default=None,
        description="Infrastruktur-tilstand"
    )

    # Godkjenningskjede
    godkjenningskjede: GodkjenningsKjedeTilstand = Field(
        default_factory=GodkjenningsKjedeTilstand,
        description="Tilstand for godkjenningskjeden"
    )

    # Endelig beslutning
    endelig_beslutning: Optional[FravikBeslutning] = Field(
        default=None,
        description="Eiers endelige beslutning"
    )
    endelig_beslutning_kommentar: Optional[str] = Field(
        default=None,
        description="Kommentar til endelig beslutning"
    )
    endelig_beslutning_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når endelig beslutning ble tatt"
    )
    endelig_beslutning_av: Optional[str] = Field(
        default=None,
        description="Hvem som tok endelig beslutning"
    )

    # Metadata
    opprettet: Optional[datetime] = Field(
        default=None,
        description="Når søknaden ble opprettet"
    )
    sendt_inn_tidspunkt: Optional[datetime] = Field(
        default=None,
        description="Når søknaden ble sendt inn"
    )
    siste_oppdatert: Optional[datetime] = Field(
        default=None,
        description="Siste oppdatering"
    )
    antall_events: int = Field(
        default=0,
        description="Antall events i loggen"
    )

    # Catenda-integrasjon
    catenda_topic_id: Optional[str] = Field(
        default=None,
        description="Catenda topic ID"
    )
    catenda_project_id: Optional[str] = Field(
        default=None,
        description="Catenda project ID"
    )

    # ============ COMPUTED FIELDS ============

    @computed_field
    @property
    def antall_maskiner(self) -> int:
        """Antall maskiner i søknaden"""
        return len(self.maskiner)

    @computed_field
    @property
    def antall_godkjente_maskiner(self) -> int:
        """Antall maskiner som er godkjent"""
        return sum(
            1 for m in self.maskiner.values()
            if m.samlet_status == MaskinVurderingStatus.GODKJENT
        )

    @computed_field
    @property
    def antall_avslatte_maskiner(self) -> int:
        """Antall maskiner som er avslått"""
        return sum(
            1 for m in self.maskiner.values()
            if m.samlet_status == MaskinVurderingStatus.AVSLATT
        )

    @computed_field
    @property
    def alle_maskiner_vurdert(self) -> bool:
        """Om alle maskiner har fått en vurdering"""
        if not self.maskiner:
            return True
        return all(
            m.samlet_status != MaskinVurderingStatus.IKKE_VURDERT
            for m in self.maskiner.values()
        )

    @computed_field
    @property
    def samlet_maskin_beslutning(self) -> Optional[FravikBeslutning]:
        """
        Beregner samlet beslutning basert på alle maskin-vurderinger.

        - Alle godkjent → GODKJENT
        - Alle avslått → AVSLATT
        - Blandet → DELVIS_GODKJENT
        - Ingen vurdert → None
        """
        if not self.maskiner or not self.alle_maskiner_vurdert:
            return None

        statuser = [m.samlet_status for m in self.maskiner.values()]
        godkjent_count = sum(1 for s in statuser if s == MaskinVurderingStatus.GODKJENT)
        avslatt_count = sum(1 for s in statuser if s == MaskinVurderingStatus.AVSLATT)

        if godkjent_count == len(statuser):
            return FravikBeslutning.GODKJENT
        elif avslatt_count == len(statuser):
            return FravikBeslutning.AVSLATT
        else:
            return FravikBeslutning.DELVIS_GODKJENT

    @computed_field
    @property
    def kan_sendes_inn(self) -> bool:
        """Sjekker om søknaden kan sendes inn"""
        if self.status != FravikStatus.UTKAST:
            return False
        if self.soknad_type == "machine" and not self.maskiner:
            return False
        return True

    @computed_field
    @property
    def er_ferdigbehandlet(self) -> bool:
        """Sjekker om søknaden er ferdigbehandlet"""
        return self.status in {
            FravikStatus.GODKJENT,
            FravikStatus.DELVIS_GODKJENT,
            FravikStatus.AVSLATT,
            FravikStatus.TRUKKET,
        }

    @computed_field
    @property
    def neste_handling(self) -> dict:
        """
        Foreslår neste handling basert på tilstand.

        Returnerer dict med:
        - rolle: Hvilken rolle som skal handle
        - handling: Beskrivelse av handlingen
        """
        if self.status == FravikStatus.UTKAST:
            return {
                "rolle": FravikRolle.SOKER,
                "handling": "Send inn søknad",
            }

        if self.status == FravikStatus.SENDT_INN:
            return {
                "rolle": FravikRolle.BOI,
                "handling": "Vurder søknaden",
            }

        if self.status == FravikStatus.RETURNERT_FRA_BOI:
            return {
                "rolle": FravikRolle.SOKER,
                "handling": "Oppdater søknad med manglende dokumentasjon",
            }

        if self.status == FravikStatus.UNDER_BOI_VURDERING:
            return {
                "rolle": FravikRolle.BOI,
                "handling": "Fullfør vurdering",
            }

        if self.status == FravikStatus.UNDER_PL_VURDERING:
            return {
                "rolle": FravikRolle.PL,
                "handling": "Godkjenn eller returner",
            }

        if self.status == FravikStatus.RETURNERT_FRA_PL:
            return {
                "rolle": FravikRolle.SOKER,
                "handling": "Oppdater søknad med manglende dokumentasjon",
            }

        if self.status == FravikStatus.UNDER_ARBEIDSGRUPPE:
            return {
                "rolle": FravikRolle.ARBEIDSGRUPPE,
                "handling": "Gi innstilling for hver maskin",
            }

        if self.status == FravikStatus.UNDER_EIER_BESLUTNING:
            return {
                "rolle": FravikRolle.EIER,
                "handling": "Fatt endelig beslutning",
            }

        return {
            "rolle": None,
            "handling": "Ingen ventende handlinger",
        }

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """Lesbar status for UI"""
        status_tekst = {
            FravikStatus.UTKAST: "Utkast",
            FravikStatus.SENDT_INN: "Sendt inn",
            FravikStatus.UNDER_BOI_VURDERING: "Til vurdering hos BOI-rådgiver",
            FravikStatus.RETURNERT_FRA_BOI: "Returnert - mangler dokumentasjon",
            FravikStatus.UNDER_PL_VURDERING: "Til godkjenning hos prosjektleder",
            FravikStatus.RETURNERT_FRA_PL: "Returnert fra prosjektleder",
            FravikStatus.UNDER_ARBEIDSGRUPPE: "Til behandling i arbeidsgruppen",
            FravikStatus.UNDER_EIER_BESLUTNING: "Til beslutning hos eier",
            FravikStatus.GODKJENT: "Godkjent",
            FravikStatus.DELVIS_GODKJENT: "Delvis godkjent",
            FravikStatus.AVSLATT: "Avslått",
            FravikStatus.TRUKKET: "Trukket",
        }
        return status_tekst.get(self.status, self.status.value)


# ============ LISTE-MODELL FOR OVERSIKTER ============

class FravikListeItem(BaseModel):
    """
    Forenklet modell for listevisning.

    Inneholder bare det som trengs for tabelloversikter.
    """
    soknad_id: str
    prosjekt_navn: str
    prosjekt_nummer: Optional[str] = None
    soker_navn: str
    soknad_type: str
    status: FravikStatus
    antall_maskiner: int = 0
    opprettet: Optional[datetime] = None
    sendt_inn_tidspunkt: Optional[datetime] = None
    siste_oppdatert: Optional[datetime] = None

    @computed_field
    @property
    def visningsstatus(self) -> str:
        """Lesbar status for UI"""
        status_tekst = {
            FravikStatus.UTKAST: "Utkast",
            FravikStatus.SENDT_INN: "Sendt inn",
            FravikStatus.UNDER_BOI_VURDERING: "Hos BOI",
            FravikStatus.RETURNERT_FRA_BOI: "Returnert",
            FravikStatus.UNDER_PL_VURDERING: "Hos PL",
            FravikStatus.RETURNERT_FRA_PL: "Returnert",
            FravikStatus.UNDER_ARBEIDSGRUPPE: "Arbeidsgruppe",
            FravikStatus.UNDER_EIER_BESLUTNING: "Hos eier",
            FravikStatus.GODKJENT: "Godkjent",
            FravikStatus.DELVIS_GODKJENT: "Delvis godkjent",
            FravikStatus.AVSLATT: "Avslått",
            FravikStatus.TRUKKET: "Trukket",
        }
        return status_tekst.get(self.status, self.status.value)
