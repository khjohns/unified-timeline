#!/usr/bin/env python3
"""
Interaktivt skript for å opprette test-saker for frontend/backend testing.

Brukes slik:
    python -m scripts.create_test_sak
    cd backend && python -m scripts.create_test_sak

Med argumenter:
    python -m scripts.create_test_sak --preset komplett --sak-id MIN-SAK-001
    python -m scripts.create_test_sak --list

Presets (Standard KOE-saker):
    tom           - Kun sak_opprettet (ingen krav sendt)
    grunnlag      - Sak med grunnlag
    vederlag      - Sak med grunnlag + vederlag
    komplett      - Sak med grunnlag + vederlag + frist
    respons       - Sak med alle spor + BH-responser (delvis godkjent)
    avslatt_frist - Sak der BH avslår fristkrav (kan utløse forsering)
    omforent      - Ferdigbehandlet sak (kan inngå i endringsordre)

Presets (Forsering §33.8):
    forsering           - Forseringssak med relatert avslått fristkrav
    forsering_iverksatt - Forsering som er iverksatt (pågående)
    forsering_bh_snudd  - Forsering der BH snur (godkjenner frist etterpå)
                          Tester useStandpunktEndringer-hooken for kompensasjon

Presets (Endringsordre §31.3):
    endringsordre - Endringsordre med relaterte KOE-saker
"""
import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
from enum import Enum
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load .env file to get correct EVENT_STORE_BACKEND
from dotenv import load_dotenv
backend_dir = Path(__file__).parent.parent
load_dotenv(backend_dir / ".env")

from models.events import (
    EventType,
    SporType,
    SakOpprettetEvent,
    GrunnlagEvent,
    GrunnlagData,
    VederlagEvent,
    VederlagData,
    VederlagsMetode,
    FristEvent,
    FristData,
    FristVarselType,
    VarselInfo,
    ResponsEvent,
    GrunnlagResponsData,
    GrunnlagResponsResultat,
    VederlagResponsData,
    VederlagBeregningResultat,
    FristResponsData,
    FristBeregningResultat,
    # Forsering events
    ForseringVarselEvent,
    ForseringVarselData,
    # Endringsordre events
    EOOpprettetEvent,
    EOOpprettetData,
    EOUtstedtEvent,
    EOUtstedtData,
    EOKonsekvenser,
    VederlagKompensasjon,
)
from repositories import create_event_repository, EventRepository, create_metadata_repository
from models.sak_metadata import SakMetadata
from lib.auth.magic_link import MagicLinkManager


class Preset(str, Enum):
    # Standard KOE-saker
    TOM = "tom"
    GRUNNLAG = "grunnlag"
    VEDERLAG = "vederlag"
    KOMPLETT = "komplett"
    RESPONS = "respons"
    AVSLATT_FRIST = "avslatt_frist"
    OMFORENT = "omforent"
    # Spesielle sakstyper
    FORSERING = "forsering"
    FORSERING_IVERKSATT = "forsering_iverksatt"
    FORSERING_BH_SNUDD = "forsering_bh_snudd"
    ENDRINGSORDRE = "endringsordre"


PRESET_DESCRIPTIONS = {
    # Standard KOE-saker
    Preset.TOM: "Kun sak_opprettet (ingen krav sendt)",
    Preset.GRUNNLAG: "Sak med grunnlag",
    Preset.VEDERLAG: "Sak med grunnlag + vederlag",
    Preset.KOMPLETT: "Sak med grunnlag + vederlag + frist",
    Preset.RESPONS: "Sak med alle spor + BH-responser (delvis godkjent)",
    Preset.AVSLATT_FRIST: "Sak der BH avslår fristkrav (trigger for forsering)",
    Preset.OMFORENT: "Ferdigbehandlet sak (kan inngå i endringsordre)",
    # Spesielle sakstyper
    Preset.FORSERING: "Forseringssak (§33.8) med relatert avslått fristkrav",
    Preset.FORSERING_IVERKSATT: "Forsering iverksatt - pågående forsering",
    Preset.FORSERING_BH_SNUDD: "Forsering der BH snur - godkjenner frist etterpå (test standpunktendring)",
    Preset.ENDRINGSORDRE: "Endringsordre (§31.3) med relaterte KOE-saker",
}


def generate_sak_id(prefix: str = "TEST") -> str:
    """Generer en unik sak-ID."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{timestamp}"


def create_sak_opprettet(
    sak_id: str,
    now: datetime,
    tittel: str = None,
    sakstype: str = "standard",
    forsering_data: dict = None
) -> SakOpprettetEvent:
    """Opprett sak_opprettet event."""
    return SakOpprettetEvent(
        event_id=str(uuid4()),
        sak_id=sak_id,
        event_type=EventType.SAK_OPPRETTET,
        tidsstempel=now,
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        sakstittel=tittel or "Test-sak for frontend/backend integrasjonstesting",
        kommentar="Denne saken ble opprettet for å teste integrasjon mellom frontend og backend.",
        sakstype=sakstype,
        forsering_data=forsering_data,
    )


def create_grunnlag_event(sak_id: str, now: datetime, oppdaget_dato: str, varslet_dato: str) -> GrunnlagEvent:
    """Opprett grunnlag_opprettet event."""
    grunnlag_data = GrunnlagData(
        tittel="Forsinket tegningsunderlag uke 45",
        hovedkategori="SVIKT",
        underkategori="MEDVIRK",
        beskrivelse="""BH leverte reviderte tegninger 3 uker etter avtalt dato.

Dette medførte:
- Ventetid for arbeidslag
- Omplanlegging av ressurser
- Forsinkelse i videre fremdrift

Referanse: E-post fra BH datert 2025-11-15.""",
        dato_oppdaget=oppdaget_dato,
        grunnlag_varsel=VarselInfo(
            dato_sendt=varslet_dato,
            metode=["epost"],
        ),
        kontraktsreferanser=["NS8407 §25.2", "Kontraktskap. 3.2"],
        vedlegg_ids=[],
    )

    return GrunnlagEvent(
        event_id=str(uuid4()),
        event_type=EventType.GRUNNLAG_OPPRETTET,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=1),
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        data=grunnlag_data,
    )


def create_vederlag_event(sak_id: str, now: datetime, varslet_dato: str, belop: float = 125000.0) -> VederlagEvent:
    """Opprett vederlag_krav_sendt event."""
    vederlag_data = VederlagData(
        metode=VederlagsMetode.REGNINGSARBEID,
        kostnads_overslag=belop,
        begrunnelse=f"""Vederlagskrav knyttet til forsinket tegningsunderlag:

- Ventetid arbeidslag: 40 timer x 850 kr = 34.000 kr
- Omplanlegging/koordinering: 20 timer x 950 kr = 19.000 kr
- Ekstra rigg/nedrigg: 25.000 kr
- Materialer i venteperiode: 15.000 kr
- Administrasjon (10%): 9.300 kr
- Paaslag (15%): 15.345 kr
- Usikkerhetsmargin: 7.355 kr

Totalt kostnadsoverslag: {belop:,.0f} kr""",
        vedlegg_ids=[],
        krever_justert_ep=False,
        regningsarbeid_varsel=VarselInfo(
            dato_sendt=varslet_dato,
            metode=["epost"],
        ),
    )

    return VederlagEvent(
        event_id=str(uuid4()),
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=2),
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        data=vederlag_data,
    )


def create_frist_event(sak_id: str, now: datetime, varslet_dato: str, dager: int = 15) -> FristEvent:
    """Opprett frist_krav_sendt event."""
    frist_data = FristData(
        varsel_type=FristVarselType.SPESIFISERT,
        antall_dager=dager,
        begrunnelse=f"""Fristforlengelse knyttet til forsinket tegningsunderlag:

- Faktisk forsinkelse fra BH: 21 dager
- TE kunne begrense konsekvensen til: {dager} dager

Kritisk sti-aktiviteter paavirket:
1. Betongarbeider fundament
2. Staalmontasje hovedkonstruksjon

Ny planlagt sluttdato blir dermed forskjoevet tilsvarende.""",
        spesifisert_varsel=VarselInfo(
            dato_sendt=varslet_dato,
            metode=["epost"],
        ),
    )

    return FristEvent(
        event_id=str(uuid4()),
        event_type=EventType.FRIST_KRAV_SENDT,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=3),
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        data=frist_data,
    )


def create_grunnlag_respons(
    sak_id: str,
    now: datetime,
    grunnlag_event_id: str,
    resultat: GrunnlagResponsResultat = GrunnlagResponsResultat.GODKJENT
) -> ResponsEvent:
    """Opprett respons_grunnlag event."""
    begrunnelser = {
        GrunnlagResponsResultat.GODKJENT: "Grunnlaget godkjennes. BH aksepterer ansvar for forsinkelsen.",
        GrunnlagResponsResultat.DELVIS_GODKJENT: "Grunnlaget delvis godkjent. BH aksepterer delvis ansvar.",
        GrunnlagResponsResultat.AVSLATT: "Grunnlaget avslås. BH mener TE burde ha forutsett situasjonen.",
    }

    return ResponsEvent(
        event_id=str(uuid4()),
        event_type=EventType.RESPONS_GRUNNLAG,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=4),
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        spor=SporType.GRUNNLAG,
        refererer_til_event_id=grunnlag_event_id,
        data=GrunnlagResponsData(
            resultat=resultat,
            begrunnelse=begrunnelser.get(resultat, "Vurdering gjennomført."),
        ),
    )


def create_vederlag_respons(
    sak_id: str,
    now: datetime,
    vederlag_event_id: str,
    resultat: VederlagBeregningResultat = VederlagBeregningResultat.DELVIS_GODKJENT,
    godkjent_belop: float = 100000.0
) -> ResponsEvent:
    """Opprett respons_vederlag event."""
    begrunnelser = {
        VederlagBeregningResultat.GODKJENT: f"BH godkjenner hele kravet på kr {godkjent_belop:,.0f}.",
        VederlagBeregningResultat.DELVIS_GODKJENT: f"BH godkjenner kr {godkjent_belop:,.0f} av kravet. Paaslaget reduseres til 12%.",
        VederlagBeregningResultat.AVSLATT: "BH avslår vederlagskravet. Kravet mangler tilstrekkelig dokumentasjon.",
    }

    return ResponsEvent(
        event_id=str(uuid4()),
        event_type=EventType.RESPONS_VEDERLAG,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=5),
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        spor=SporType.VEDERLAG,
        refererer_til_event_id=vederlag_event_id,
        data=VederlagResponsData(
            beregnings_resultat=resultat,
            total_godkjent_belop=godkjent_belop if resultat != VederlagBeregningResultat.AVSLATT else 0,
            begrunnelse=begrunnelser.get(resultat, "Vurdering gjennomført."),
        ),
    )


def create_frist_respons(
    sak_id: str,
    now: datetime,
    frist_event_id: str,
    resultat: FristBeregningResultat = FristBeregningResultat.GODKJENT,
    godkjente_dager: int = 15
) -> ResponsEvent:
    """Opprett respons_frist event."""
    begrunnelser = {
        FristBeregningResultat.GODKJENT: f"BH godkjenner fristforlengelsen på {godkjente_dager} dager.",
        FristBeregningResultat.DELVIS_GODKJENT: f"BH godkjenner {godkjente_dager} av de krevde dagene.",
        FristBeregningResultat.AVSLATT: "BH avslår fristkravet. TE har ikke dokumentert tilstrekkelig hindring.",
    }

    return ResponsEvent(
        event_id=str(uuid4()),
        event_type=EventType.RESPONS_FRIST,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=6),
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        spor=SporType.FRIST,
        refererer_til_event_id=frist_event_id,
        data=FristResponsData(
            beregnings_resultat=resultat,
            godkjent_dager=godkjente_dager if resultat != FristBeregningResultat.AVSLATT else 0,
            begrunnelse=begrunnelser.get(resultat, "Vurdering gjennomført."),
        ),
    )


def create_forsering_varsel(
    sak_id: str,
    now: datetime,
    frist_krav_id: str,
    respons_frist_id: str,
    avslatte_dager: int = 15,
    dagmulktsats: float = 50000.0,
    dato_iverksettelse: str = None,
) -> ForseringVarselEvent:
    """Opprett forsering_varsel event (§33.8)."""
    maks_kostnad = avslatte_dager * dagmulktsats * 1.3
    estimert_kostnad = maks_kostnad * 0.8  # 80% av maks

    # Default til 3 dager i fremtiden, men kan overstyres
    if dato_iverksettelse is None:
        dato_iverksettelse = (now + timedelta(days=3)).strftime("%Y-%m-%d")

    return ForseringVarselEvent(
        event_id=str(uuid4()),
        event_type=EventType.FORSERING_VARSEL,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=7),
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        data=ForseringVarselData(
            frist_krav_id=frist_krav_id,
            respons_frist_id=respons_frist_id,
            estimert_kostnad=estimert_kostnad,
            begrunnelse=f"""TE varsler om forsering iht. NS 8407 §33.8.

BH har avslått fristkrav på {avslatte_dager} dager som TE mener er berettiget.
TE vil derfor iverksette forsering for å overholde kontraktsfestet sluttdato.

Beregning av maks forseringskostnad:
- Avslåtte dager: {avslatte_dager}
- Dagmulktsats: kr {dagmulktsats:,.0f}
- Maks kostnad (dager × sats × 1.3): kr {maks_kostnad:,.0f}

Estimert forseringskostnad: kr {estimert_kostnad:,.0f}""",
            bekreft_30_prosent=True,
            dato_iverksettelse=dato_iverksettelse,
            avslatte_dager=avslatte_dager,
            dagmulktsats=dagmulktsats,
            grunnlag_avslag_trigger=False,
        ),
    )


def create_eo_opprettet(
    sak_id: str,
    now: datetime,
    eo_nummer: str,
    relaterte_koe_saker: list[str],
    tittel: str = None
) -> EOOpprettetEvent:
    """Opprett eo_opprettet event (§31.3)."""
    return EOOpprettetEvent(
        event_id=str(uuid4()),
        event_type=EventType.EO_OPPRETTET,
        sak_id=sak_id,
        tidsstempel=now,
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        data=EOOpprettetData(
            eo_nummer=eo_nummer,
            beskrivelse=f"Endringsordre som samler {len(relaterte_koe_saker)} KOE-sak(er).",
            relaterte_koe_saker=relaterte_koe_saker,
            sakstittel=tittel or f"Endringsordre {eo_nummer}",
        ),
    )


def create_eo_utstedt(
    sak_id: str,
    now: datetime,
    eo_nummer: str,
    relaterte_koe_saker: list[str],
    kompensasjon_belop: float = 200000.0,
    frist_dager: int = 20
) -> EOUtstedtEvent:
    """Opprett eo_utstedt event (§31.3)."""
    return EOUtstedtEvent(
        event_id=str(uuid4()),
        event_type=EventType.EO_UTSTEDT,
        sak_id=sak_id,
        tidsstempel=now + timedelta(seconds=1),
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        data=EOUtstedtData(
            eo_nummer=eo_nummer,
            revisjon_nummer=0,
            beskrivelse=f"""Endringsordre {eo_nummer} utstedes formelt.

Denne endringsordren samler følgende KOE-saker:
{chr(10).join(f'- {sak}' for sak in relaterte_koe_saker)}

Samlet kompensasjon og fristforlengelse er beregnet basert på
godkjente krav i de relaterte sakene.""",
            konsekvenser=EOKonsekvenser(
                sha=False,
                kvalitet=False,
                fremdrift=True,
                pris=True,
                annet=False,
            ),
            konsekvens_beskrivelse="Endringen medfører både pris- og fremdriftskonsekvenser.",
            vederlag=VederlagKompensasjon(
                metode=VederlagsMetode.REGNINGSARBEID,
                kostnads_overslag=kompensasjon_belop,
            ),
            frist_dager=frist_dager,
            relaterte_koe_saker=relaterte_koe_saker,
        ),
    )


def create_standard_sak(preset: Preset, sak_id: str, repo: EventRepository) -> tuple[str, list]:
    """Oppretter en standard KOE-sak basert på preset."""
    now = datetime.now()
    oppdaget_dato = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    varslet_dato = (now - timedelta(days=5)).strftime("%Y-%m-%d")

    events = []
    event_ids = {}

    # 1. SAK_OPPRETTET (alltid med)
    sak_event = create_sak_opprettet(sak_id, now)
    events.append(sak_event)
    print(f"  + sak_opprettet ({sak_event.event_id[:8]}...)")

    if preset == Preset.TOM:
        return sak_id, events

    # 2. GRUNNLAG_OPPRETTET
    if preset in [Preset.GRUNNLAG, Preset.VEDERLAG, Preset.KOMPLETT, Preset.RESPONS,
                  Preset.AVSLATT_FRIST, Preset.OMFORENT]:
        grunnlag_event = create_grunnlag_event(sak_id, now, oppdaget_dato, varslet_dato)
        events.append(grunnlag_event)
        event_ids["grunnlag"] = grunnlag_event.event_id
        print(f"  + grunnlag_opprettet ({grunnlag_event.event_id[:8]}...)")

    # 3. VEDERLAG_KRAV_SENDT
    if preset in [Preset.VEDERLAG, Preset.KOMPLETT, Preset.RESPONS,
                  Preset.AVSLATT_FRIST, Preset.OMFORENT]:
        vederlag_event = create_vederlag_event(sak_id, now, varslet_dato)
        events.append(vederlag_event)
        event_ids["vederlag"] = vederlag_event.event_id
        print(f"  + vederlag_krav_sendt ({vederlag_event.event_id[:8]}...)")

    # 4. FRIST_KRAV_SENDT
    if preset in [Preset.KOMPLETT, Preset.RESPONS, Preset.AVSLATT_FRIST, Preset.OMFORENT]:
        frist_event = create_frist_event(sak_id, now, varslet_dato)
        events.append(frist_event)
        event_ids["frist"] = frist_event.event_id
        print(f"  + frist_krav_sendt ({frist_event.event_id[:8]}...)")

    # 5. BH RESPONSER
    if preset in [Preset.RESPONS, Preset.AVSLATT_FRIST, Preset.OMFORENT]:
        # Grunnlag respons
        grunnlag_resultat = GrunnlagResponsResultat.GODKJENT
        grunnlag_respons = create_grunnlag_respons(sak_id, now, event_ids["grunnlag"], grunnlag_resultat)
        events.append(grunnlag_respons)
        print(f"  + respons_grunnlag [{grunnlag_resultat.value}] ({grunnlag_respons.event_id[:8]}...)")

        # Vederlag respons
        if preset == Preset.OMFORENT:
            vederlag_resultat = VederlagBeregningResultat.GODKJENT
            godkjent_belop = 125000.0
        else:
            vederlag_resultat = VederlagBeregningResultat.DELVIS_GODKJENT
            godkjent_belop = 100000.0

        vederlag_respons = create_vederlag_respons(
            sak_id, now, event_ids["vederlag"], vederlag_resultat, godkjent_belop
        )
        events.append(vederlag_respons)
        print(f"  + respons_vederlag [{vederlag_resultat.value}] ({vederlag_respons.event_id[:8]}...)")

        # Frist respons
        if preset == Preset.AVSLATT_FRIST:
            frist_resultat = FristBeregningResultat.AVSLATT
            godkjente_dager = 0
        elif preset == Preset.OMFORENT:
            frist_resultat = FristBeregningResultat.GODKJENT
            godkjente_dager = 15
        else:
            frist_resultat = FristBeregningResultat.GODKJENT
            godkjente_dager = 15

        frist_respons = create_frist_respons(
            sak_id, now, event_ids["frist"], frist_resultat, godkjente_dager
        )
        events.append(frist_respons)
        event_ids["frist_respons"] = frist_respons.event_id
        print(f"  + respons_frist [{frist_resultat.value}] ({frist_respons.event_id[:8]}...)")

    return sak_id, events


def create_forsering_sak(sak_id: str, repo: EventRepository) -> tuple[str, list, str]:
    """
    Oppretter en forseringssak med tilhørende avslått fristkrav-sak.

    Returns:
        tuple: (forsering_sak_id, events, relatert_sak_id)
    """
    now = datetime.now()

    # Først oppretter vi en sak med avslått frist som forseringen refererer til
    relatert_sak_id = generate_sak_id("KOE")
    print(f"\n  Oppretter relatert KOE-sak: {relatert_sak_id}")

    # Opprett metadata for relatert sak først
    ensure_sak_metadata(relatert_sak_id, "standard", f"KOE med avslått frist - {relatert_sak_id}")

    _, relatert_events = create_standard_sak(Preset.AVSLATT_FRIST, relatert_sak_id, repo)

    # Finn event-IDer fra den relaterte saken
    frist_krav_id = None
    frist_respons_id = None
    for event in relatert_events:
        if event.event_type == EventType.FRIST_KRAV_SENDT:
            frist_krav_id = event.event_id
        elif event.event_type == EventType.RESPONS_FRIST:
            frist_respons_id = event.event_id

    # Lagre relatert sak
    repo.append_batch(relatert_events, expected_version=0)

    # Nå oppretter vi forseringssaken
    print(f"\n  Oppretter forseringssak: {sak_id}")
    events = []

    # Sak opprettet for forsering - VIKTIG: sett sakstype="forsering"
    sak_event = create_sak_opprettet(
        sak_id, now,
        tittel=f"Forsering (§33.8) - ref. {relatert_sak_id}",
        sakstype="forsering",
        forsering_data={
            "avslatte_fristkrav": [relatert_sak_id],
        }
    )
    events.append(sak_event)
    print(f"  + sak_opprettet [sakstype=forsering] ({sak_event.event_id[:8]}...)")

    # Forsering varsel
    forsering_event = create_forsering_varsel(
        sak_id, now, frist_krav_id, frist_respons_id,
        avslatte_dager=15, dagmulktsats=50000.0
    )
    events.append(forsering_event)
    print(f"  + forsering_varsel ({forsering_event.event_id[:8]}...)")

    return sak_id, events, relatert_sak_id


def create_forsering_sak_iverksatt(sak_id: str, repo: EventRepository) -> tuple[str, list, str]:
    """
    Oppretter en forseringssak som er iverksatt (dato_iverksettelse i fortiden).

    Brukes for å teste pågående forsering med påløpte kostnader.

    Returns:
        tuple: (forsering_sak_id, events, relatert_sak_id)
    """
    now = datetime.now()
    # Sett tidspunkt til 10 dager siden for at forseringen skal være "iverksatt"
    start_tid = now - timedelta(days=10)

    # Først oppretter vi en sak med avslått frist som forseringen refererer til
    relatert_sak_id = generate_sak_id("KOE")
    print(f"\n  Oppretter relatert KOE-sak: {relatert_sak_id}")

    ensure_sak_metadata(relatert_sak_id, "standard", f"KOE med avslått frist - {relatert_sak_id}")

    _, relatert_events = create_standard_sak(Preset.AVSLATT_FRIST, relatert_sak_id, repo)

    # Finn event-IDer
    frist_krav_id = None
    frist_respons_id = None
    for event in relatert_events:
        if event.event_type == EventType.FRIST_KRAV_SENDT:
            frist_krav_id = event.event_id
        elif event.event_type == EventType.RESPONS_FRIST:
            frist_respons_id = event.event_id

    repo.append_batch(relatert_events, expected_version=0)

    # Opprett forseringssaken
    print(f"\n  Oppretter forseringssak (iverksatt): {sak_id}")
    events = []

    sak_event = create_sak_opprettet(
        sak_id, start_tid,
        tittel=f"Forsering (§33.8) - iverksatt - ref. {relatert_sak_id}",
        sakstype="forsering",
        forsering_data={
            "avslatte_fristkrav": [relatert_sak_id],
            "er_iverksatt": True,
            "dato_iverksatt": (start_tid + timedelta(days=3)).strftime("%Y-%m-%d"),
        }
    )
    events.append(sak_event)
    print(f"  + sak_opprettet [sakstype=forsering] ({sak_event.event_id[:8]}...)")

    # Forsering varsel med iverksettelsesdato i fortiden
    forsering_event = create_forsering_varsel(
        sak_id, start_tid, frist_krav_id, frist_respons_id,
        avslatte_dager=15, dagmulktsats=50000.0,
        dato_iverksettelse=(start_tid + timedelta(days=3)).strftime("%Y-%m-%d"),  # 7 dager siden
    )
    events.append(forsering_event)
    print(f"  + forsering_varsel [iverksatt {(start_tid + timedelta(days=3)).strftime('%Y-%m-%d')}] ({forsering_event.event_id[:8]}...)")

    return sak_id, events, relatert_sak_id


def create_forsering_sak_bh_snudd(sak_id: str, repo: EventRepository) -> tuple[str, list, str]:
    """
    Oppretter en forseringssak der BH har snudd - godkjenner fristkravet etter forsering.

    Dette tester useStandpunktEndringer-hooken:
    1. KOE-sak opprettes med avslått frist (14 dager siden)
    2. Forsering varsles og iverksettes (10 dager siden)
    3. BH snur og godkjenner fristkravet (2 dager siden)

    TE kan da kreve kompensasjon for påløpte forseringskostnader.

    Returns:
        tuple: (forsering_sak_id, events, relatert_sak_id)
    """
    now = datetime.now()

    # Tidslinje:
    # - 14 dager siden: KOE opprettet, frist avslått
    # - 10 dager siden: Forsering varslet
    # - 7 dager siden: Forsering iverksatt
    # - 2 dager siden: BH snur, godkjenner frist
    koe_tid = now - timedelta(days=14)
    forsering_tid = now - timedelta(days=10)
    bh_snudd_tid = now - timedelta(days=2)

    # 1. Opprett KOE-sak med avslått frist
    relatert_sak_id = generate_sak_id("KOE")
    print(f"\n  Oppretter relatert KOE-sak: {relatert_sak_id}")
    ensure_sak_metadata(relatert_sak_id, "standard", f"KOE med BH-snudd - {relatert_sak_id}")

    # Manuelt opprett events for KOE med riktige tidsstempler
    oppdaget_dato = (koe_tid - timedelta(days=7)).strftime("%Y-%m-%d")
    varslet_dato = (koe_tid - timedelta(days=5)).strftime("%Y-%m-%d")

    koe_events = []

    # Sak opprettet
    koe_sak_event = create_sak_opprettet(relatert_sak_id, koe_tid, tittel="KOE med frist som BH snur på")
    koe_events.append(koe_sak_event)

    # Grunnlag
    grunnlag_event = create_grunnlag_event(relatert_sak_id, koe_tid, oppdaget_dato, varslet_dato)
    grunnlag_event.tidsstempel = koe_tid + timedelta(seconds=1)
    koe_events.append(grunnlag_event)

    # Vederlag
    vederlag_event = create_vederlag_event(relatert_sak_id, koe_tid, varslet_dato)
    vederlag_event.tidsstempel = koe_tid + timedelta(seconds=2)
    koe_events.append(vederlag_event)

    # Frist - 15 dager krevd
    frist_event = create_frist_event(relatert_sak_id, koe_tid, varslet_dato, dager=15)
    frist_event.tidsstempel = koe_tid + timedelta(seconds=3)
    koe_events.append(frist_event)

    # Grunnlag respons - godkjent
    grunnlag_respons = create_grunnlag_respons(
        relatert_sak_id, koe_tid, grunnlag_event.event_id,
        GrunnlagResponsResultat.GODKJENT
    )
    grunnlag_respons.tidsstempel = koe_tid + timedelta(seconds=4)
    koe_events.append(grunnlag_respons)

    # Vederlag respons - delvis godkjent
    vederlag_respons = create_vederlag_respons(
        relatert_sak_id, koe_tid, vederlag_event.event_id,
        VederlagBeregningResultat.DELVIS_GODKJENT, 100000.0
    )
    vederlag_respons.tidsstempel = koe_tid + timedelta(seconds=5)
    koe_events.append(vederlag_respons)

    # Frist respons - AVSLÅTT (trigger for forsering)
    frist_respons_avslatt = create_frist_respons(
        relatert_sak_id, koe_tid, frist_event.event_id,
        FristBeregningResultat.AVSLATT, 0
    )
    frist_respons_avslatt.tidsstempel = koe_tid + timedelta(seconds=6)
    koe_events.append(frist_respons_avslatt)

    # Lagre KOE-sak først
    repo.append_batch(koe_events, expected_version=0)
    print(f"  + KOE opprettet med avslått frist ({len(koe_events)} events)")

    # 2. Opprett forseringssak
    print(f"\n  Oppretter forseringssak (iverksatt): {sak_id}")
    forsering_events = []

    forsering_sak_event = create_sak_opprettet(
        sak_id, forsering_tid,
        tittel=f"Forsering (§33.8) - BH snudde - ref. {relatert_sak_id}",
        sakstype="forsering",
        forsering_data={
            "avslatte_fristkrav": [relatert_sak_id],
            "er_iverksatt": True,
            "dato_iverksatt": (forsering_tid + timedelta(days=3)).strftime("%Y-%m-%d"),
        }
    )
    forsering_events.append(forsering_sak_event)
    print(f"  + sak_opprettet [sakstype=forsering] ({forsering_sak_event.event_id[:8]}...)")

    # Forsering varsel
    forsering_varsel = create_forsering_varsel(
        sak_id, forsering_tid, frist_event.event_id, frist_respons_avslatt.event_id,
        avslatte_dager=15, dagmulktsats=50000.0,
        dato_iverksettelse=(forsering_tid + timedelta(days=3)).strftime("%Y-%m-%d"),
    )
    forsering_events.append(forsering_varsel)
    print(f"  + forsering_varsel [iverksatt] ({forsering_varsel.event_id[:8]}...)")

    # Lagre forsering
    repo.append_batch(forsering_events, expected_version=0)

    # 3. BH snur - godkjenner fristkravet på KOE-saken
    print(f"\n  BH snur og godkjenner frist på KOE-sak...")

    # Versjonen er antall events vi la til (7 events i koe_events)
    koe_version = len(koe_events)

    # Opprett ny frist-respons der BH godkjenner
    frist_respons_godkjent = ResponsEvent(
        event_id=str(uuid4()),
        event_type=EventType.RESPONS_FRIST_OPPDATERT,
        sak_id=relatert_sak_id,
        tidsstempel=bh_snudd_tid,
        aktor="BH Saksbehandler",
        aktor_rolle="BH",
        spor=SporType.FRIST,
        refererer_til_event_id=frist_event.event_id,
        data=FristResponsData(
            beregnings_resultat=FristBeregningResultat.GODKJENT,
            godkjente_dager=15,
            begrunnelse="""BH har revurdert fristkravet og godkjenner nå 15 dagers fristforlengelse.

Etter nærmere gjennomgang av dokumentasjonen erkjenner BH at TE har krav på
fristforlengelse som følge av forsinket tegningsunderlag.

Merk: TE kan ha krav på kompensasjon for påløpte forseringskostnader
som følge av fristforlengelse etter denne bestemmelsen.""",
        ),
    )
    repo.append_batch([frist_respons_godkjent], expected_version=koe_version)
    print(f"  + respons_frist_oppdatert [GODKJENT 15 dager] ({frist_respons_godkjent.event_id[:8]}...)")

    return sak_id, forsering_events, relatert_sak_id


def create_endringsordre_sak(sak_id: str, repo: EventRepository) -> tuple[str, list, list[str]]:
    """
    Oppretter en endringsordre-sak med tilhørende omforente KOE-saker.

    Returns:
        tuple: (eo_sak_id, events, relaterte_koe_ids)
    """
    now = datetime.now()

    # Opprett to omforente KOE-saker som skal inngå i EO
    relaterte_koe_ids = []

    for i in range(2):
        koe_sak_id = generate_sak_id(f"KOE-{i+1}")
        print(f"\n  Oppretter KOE-sak {i+1}: {koe_sak_id}")

        # Opprett metadata for KOE-sak først
        ensure_sak_metadata(koe_sak_id, "standard", f"Omforent KOE-sak {i+1}")

        _, koe_events = create_standard_sak(Preset.OMFORENT, koe_sak_id, repo)
        repo.append_batch(koe_events, expected_version=0)
        relaterte_koe_ids.append(koe_sak_id)

    # Nå oppretter vi endringsordre-saken
    eo_nummer = f"EO-{datetime.now().strftime('%Y%m%d')}"
    print(f"\n  Oppretter endringsordre: {sak_id} ({eo_nummer})")
    events = []

    # Først SAK_OPPRETTET med sakstype="endringsordre"
    sak_event = create_sak_opprettet(
        sak_id, now,
        tittel=f"Endringsordre {eo_nummer}",
        sakstype="endringsordre"
    )
    events.append(sak_event)
    print(f"  + sak_opprettet [sakstype=endringsordre] ({sak_event.event_id[:8]}...)")

    # EO opprettet
    eo_opprettet = create_eo_opprettet(
        sak_id, now, eo_nummer, relaterte_koe_ids,
        tittel=f"Endringsordre {eo_nummer}"
    )
    events.append(eo_opprettet)
    print(f"  + eo_opprettet ({eo_opprettet.event_id[:8]}...)")

    # EO utstedt
    eo_utstedt = create_eo_utstedt(
        sak_id, now, eo_nummer, relaterte_koe_ids,
        kompensasjon_belop=250000.0, frist_dager=30
    )
    events.append(eo_utstedt)
    print(f"  + eo_utstedt ({eo_utstedt.event_id[:8]}...)")

    return sak_id, events, relaterte_koe_ids


def ensure_sak_metadata(sak_id: str, sakstype: str, tittel: str = None):
    """Opprett metadata-oppføring for saken (kreves av Supabase foreign key)."""
    metadata_repo = create_metadata_repository()
    now = datetime.now()

    sak_metadata = SakMetadata(
        sak_id=sak_id,
        created_at=now,
        created_by="Test Bruker (TE)",
        sakstype=sakstype,
        cached_title=tittel or f"Test-sak {sak_id}",
        cached_status="opprettet",
        last_event_at=now,
    )

    # Bruk upsert for å unngå duplikat-feil
    metadata_repo.upsert(sak_metadata)
    print(f"  + metadata opprettet for {sak_id}")


def create_test_sak(preset: Preset = Preset.KOMPLETT, sak_id: str = None) -> tuple[str, str, dict]:
    """
    Oppretter en test-sak basert på valgt preset.

    Args:
        preset: Hvilken type test-sak som skal opprettes
        sak_id: Sak-ID, genereres automatisk hvis ikke oppgitt

    Returns:
        tuple: (sak_id, magic_token, metadata)
    """
    repo = create_event_repository()
    metadata = {"preset": preset.value, "relaterte_saker": []}

    # Forsering-presets
    forsering_presets = {Preset.FORSERING, Preset.FORSERING_IVERKSATT, Preset.FORSERING_BH_SNUDD}

    # Generer sak-ID basert på sakstype
    if not sak_id:
        if preset in forsering_presets:
            sak_id = generate_sak_id("FORS")
        elif preset == Preset.ENDRINGSORDRE:
            sak_id = generate_sak_id("EO")
        else:
            sak_id = generate_sak_id("TEST")

    # Bestem sakstype
    if preset in forsering_presets:
        sakstype = "forsering"
    elif preset == Preset.ENDRINGSORDRE:
        sakstype = "endringsordre"
    else:
        sakstype = "standard"

    # Opprett metadata først (kreves av Supabase foreign key)
    ensure_sak_metadata(sak_id, sakstype)

    # Opprett sak basert på preset
    if preset == Preset.FORSERING:
        sak_id, events, relatert_sak_id = create_forsering_sak(sak_id, repo)
        metadata["relaterte_saker"] = [relatert_sak_id]
        metadata["sakstype"] = "forsering"
    elif preset == Preset.FORSERING_IVERKSATT:
        sak_id, events, relatert_sak_id = create_forsering_sak_iverksatt(sak_id, repo)
        metadata["relaterte_saker"] = [relatert_sak_id]
        metadata["sakstype"] = "forsering"
    elif preset == Preset.FORSERING_BH_SNUDD:
        # Denne funksjonen lagrer events selv (kompleks flyt med flere saker)
        sak_id, events, relatert_sak_id = create_forsering_sak_bh_snudd(sak_id, repo)
        metadata["relaterte_saker"] = [relatert_sak_id]
        metadata["sakstype"] = "forsering"
        events = []  # Tøm events - allerede lagret
    elif preset == Preset.ENDRINGSORDRE:
        sak_id, events, relaterte_koe_ids = create_endringsordre_sak(sak_id, repo)
        metadata["relaterte_saker"] = relaterte_koe_ids
        metadata["sakstype"] = "endringsordre"
    else:
        sak_id, events = create_standard_sak(preset, sak_id, repo)
        metadata["sakstype"] = "standard"

    # Lagre events (noen presets lagrer selv, da er events tom)
    if events:
        repo.append_batch(events, expected_version=0)

    # Generer magic link for enkel tilgang
    backend_dir = Path(__file__).parent.parent
    magic_manager = MagicLinkManager(storage_dir=str(backend_dir / "koe_data"))
    magic_token = magic_manager.generate(sak_id=sak_id, ttl_hours=72)

    return sak_id, magic_token, metadata


def interactive_mode():
    """Interaktiv modus for å velge preset og sak-ID."""
    print("\n" + "=" * 60)
    print("  TEST-SAK GENERATOR")
    print("=" * 60)
    print("\nVelg preset:")
    print()

    # Grupper presets
    forsering_presets = [Preset.FORSERING, Preset.FORSERING_IVERKSATT, Preset.FORSERING_BH_SNUDD]
    standard_presets = [p for p in Preset if p not in forsering_presets and p != Preset.ENDRINGSORDRE]
    special_presets = forsering_presets + [Preset.ENDRINGSORDRE]

    print("  Standard KOE-saker:")
    for i, preset in enumerate(standard_presets, 1):
        print(f"    [{i}] {preset.value:20} - {PRESET_DESCRIPTIONS[preset]}")

    print()
    print("  Forsering (§33.8):")
    offset = len(standard_presets)
    for i, preset in enumerate(forsering_presets, 1):
        print(f"    [{offset + i}] {preset.value:20} - {PRESET_DESCRIPTIONS[preset]}")

    print()
    print("  Endringsordre (§31.3):")
    offset2 = offset + len(forsering_presets)
    print(f"    [{offset2 + 1}] {Preset.ENDRINGSORDRE.value:20} - {PRESET_DESCRIPTIONS[Preset.ENDRINGSORDRE]}")

    print()

    all_presets = standard_presets + special_presets
    max_choice = len(all_presets)

    while True:
        try:
            choice = input(f"Velg nummer (1-{max_choice}) eller 'q' for å avslutte: ").strip().lower()
            if choice == 'q':
                print("Avbryter.")
                return

            idx = int(choice) - 1
            if 0 <= idx < len(all_presets):
                selected_preset = all_presets[idx]
                break
            else:
                print("Ugyldig valg. Prøv igjen.")
        except ValueError:
            print(f"Ugyldig input. Skriv et tall 1-{max_choice}.")

    print()
    sak_id_input = input(f"Sak-ID (Enter for auto-generert): ").strip()
    sak_id = sak_id_input if sak_id_input else None

    print()
    print(f"Oppretter test-sak med preset '{selected_preset.value}'...")
    print()

    created_sak_id, magic_token, metadata = create_test_sak(preset=selected_preset, sak_id=sak_id)

    print()
    print("=" * 60)
    print(f"  SAK OPPRETTET: {created_sak_id}")
    print("=" * 60)
    print()
    print(f"  Preset:    {selected_preset.value}")
    print(f"  Sakstype:  {metadata.get('sakstype', 'standard')}")

    if metadata.get("relaterte_saker"):
        print(f"  Relaterte: {', '.join(metadata['relaterte_saker'])}")

    # URL basert på sakstype
    if metadata.get("sakstype") == "forsering":
        url = f"http://localhost:3000/forsering/{created_sak_id}?token={magic_token}"
    elif metadata.get("sakstype") == "endringsordre":
        url = f"http://localhost:3000/endringsordre/{created_sak_id}?token={magic_token}"
    else:
        url = f"http://localhost:3000/saker/{created_sak_id}?token={magic_token}"

    print(f"  URL:       {url}")
    print()

    # Spør om brukeren vil lage flere
    again = input("Vil du opprette en ny sak? (j/n): ").strip().lower()
    if again in ['j', 'y', 'ja', 'yes']:
        interactive_mode()


def list_presets():
    """Vis tilgjengelige presets."""
    forsering_presets = [Preset.FORSERING, Preset.FORSERING_IVERKSATT, Preset.FORSERING_BH_SNUDD]

    print("\nTilgjengelige presets:")
    print()
    print("  Standard KOE-saker:")
    for preset in Preset:
        if preset not in forsering_presets and preset != Preset.ENDRINGSORDRE:
            print(f"    {preset.value:20} - {PRESET_DESCRIPTIONS[preset]}")

    print()
    print("  Forsering (§33.8):")
    for preset in forsering_presets:
        print(f"    {preset.value:20} - {PRESET_DESCRIPTIONS[preset]}")

    print()
    print("  Endringsordre (§31.3):")
    print(f"    {Preset.ENDRINGSORDRE.value:20} - {PRESET_DESCRIPTIONS[Preset.ENDRINGSORDRE]}")
    print()


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Opprett en test-sak for frontend/backend testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Eksempler:
  python -m scripts.create_test_sak                       # Interaktiv modus
  python -m scripts.create_test_sak --preset komplett     # Standard KOE med alle spor
  python -m scripts.create_test_sak --preset omforent     # Ferdig behandlet KOE
  python -m scripts.create_test_sak --preset forsering    # Forseringssak (§33.8)
  python -m scripts.create_test_sak --preset endringsordre # Endringsordre (§31.3)
  python -m scripts.create_test_sak --list                # Vis alle presets
        """
    )
    parser.add_argument(
        "--preset", "-p",
        type=str,
        choices=[p.value for p in Preset],
        help="Hvilken type test-sak som skal opprettes",
    )
    parser.add_argument(
        "--sak-id", "-s",
        type=str,
        help="Spesifiser sak-ID (genereres automatisk hvis ikke oppgitt)",
    )
    parser.add_argument(
        "--list", "-l",
        action="store_true",
        help="Vis tilgjengelige presets",
    )

    args = parser.parse_args()

    if args.list:
        list_presets()
        return

    if args.preset:
        # Direkte modus med argumenter
        print(f"\nOppretter test-sak med preset '{args.preset}'...")
        print()
        sak_id, magic_token, metadata = create_test_sak(
            preset=Preset(args.preset),
            sak_id=args.sak_id,
        )
        print()
        print(f"Test-sak opprettet: {sak_id}")
        print(f"Sakstype: {metadata.get('sakstype', 'standard')}")

        if metadata.get("relaterte_saker"):
            print(f"Relaterte saker: {', '.join(metadata['relaterte_saker'])}")

        # URL basert på sakstype
        if metadata.get("sakstype") == "forsering":
            url = f"http://localhost:3000/forsering/{sak_id}?token={magic_token}"
        elif metadata.get("sakstype") == "endringsordre":
            url = f"http://localhost:3000/endringsordre/{sak_id}?token={magic_token}"
        else:
            url = f"http://localhost:3000/saker/{sak_id}?token={magic_token}"

        print(f"URL: {url}")
    else:
        # Interaktiv modus
        interactive_mode()


if __name__ == "__main__":
    main()
