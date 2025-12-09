#!/usr/bin/env python3
"""
Interaktivt skript for å opprette test-saker for frontend/backend testing.

Brukes slik:
    python -m scripts.create_test_sak

Med argumenter:
    python -m scripts.create_test_sak --preset komplett --sak-id MIN-SAK-001
    python -m scripts.create_test_sak --list

Presets:
    tom       - Kun sak_opprettet (ingen krav sendt)
    grunnlag  - Sak med grunnlag
    vederlag  - Sak med grunnlag + vederlag
    komplett  - Sak med grunnlag + vederlag + frist
    respons   - Sak med alle spor + BH-responser (delvis godkjent)
"""
import sys
import os
from datetime import datetime, timedelta
from uuid import uuid4
from enum import Enum
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
)
from repositories.event_repository import JsonFileEventRepository
from lib.auth.magic_link import MagicLinkManager


class Preset(str, Enum):
    TOM = "tom"
    GRUNNLAG = "grunnlag"
    VEDERLAG = "vederlag"
    KOMPLETT = "komplett"
    RESPONS = "respons"


PRESET_DESCRIPTIONS = {
    Preset.TOM: "Kun sak_opprettet (ingen krav sendt)",
    Preset.GRUNNLAG: "Sak med grunnlag",
    Preset.VEDERLAG: "Sak med grunnlag + vederlag",
    Preset.KOMPLETT: "Sak med grunnlag + vederlag + frist",
    Preset.RESPONS: "Sak med alle spor + BH-responser",
}


def generate_sak_id() -> str:
    """Generer en unik sak-ID."""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"TEST-{timestamp}"


def create_sak_opprettet(sak_id: str, now: datetime) -> SakOpprettetEvent:
    """Opprett sak_opprettet event."""
    return SakOpprettetEvent(
        event_id=str(uuid4()),
        sak_id=sak_id,
        event_type=EventType.SAK_OPPRETTET,
        tidsstempel=now,
        aktor="Test Bruker (TE)",
        aktor_rolle="TE",
        sakstittel="Test-sak for frontend/backend integrasjonstesting",
        kommentar="Denne saken ble opprettet for å teste integrasjon mellom frontend og backend.",
    )


def create_grunnlag_event(sak_id: str, now: datetime, oppdaget_dato: str, varslet_dato: str) -> GrunnlagEvent:
    """Opprett grunnlag_opprettet event."""
    grunnlag_data = GrunnlagData(
        tittel="Forsinket tegningsunderlag uke 45",
        hovedkategori="ENDRING",
        underkategori="PROJ",
        beskrivelse="""BH leverte reviderte tegninger 3 uker etter avtalt dato.

Dette medførte:
- Ventetid for arbeidslag
- Omplanlegging av ressurser
- Forsinkelse i videre fremdrift

Referanse: E-post fra BH datert 2025-11-15.""",
        dato_oppdaget=oppdaget_dato,
        grunnlag_varsel=VarselInfo(
            varslet_dato=varslet_dato,
            varslet_via="e-post",
            referanse="KOE-Varsel-001",
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


def create_vederlag_event(sak_id: str, now: datetime, varslet_dato: str) -> VederlagEvent:
    """Opprett vederlag_krav_sendt event."""
    vederlag_data = VederlagData(
        metode=VederlagsMetode.REGNINGSARBEID,
        kostnads_overslag=125000.0,
        begrunnelse="""Vederlagskrav knyttet til forsinket tegningsunderlag:

- Ventetid arbeidslag: 40 timer x 850 kr = 34.000 kr
- Omplanlegging/koordinering: 20 timer x 950 kr = 19.000 kr
- Ekstra rigg/nedrigg: 25.000 kr
- Materialer i venteperiode: 15.000 kr
- Administrasjon (10%): 9.300 kr
- Paaslag (15%): 15.345 kr
- Usikkerhetsmargin: 7.355 kr

Totalt kostnadsoverslag: 125.000 kr""",
        vedlegg_ids=[],
        krever_justert_ep=False,
        regningsarbeid_varsel=VarselInfo(
            varslet_dato=varslet_dato,
            varslet_via="e-post",
            referanse="KOE-Vederlag-001",
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


def create_frist_event(sak_id: str, now: datetime, varslet_dato: str) -> FristEvent:
    """Opprett frist_krav_sendt event."""
    frist_data = FristData(
        varsel_type=FristVarselType.SPESIFISERT,
        antall_dager=15,
        begrunnelse="""Fristforlengelse knyttet til forsinket tegningsunderlag:

- Faktisk forsinkelse fra BH: 21 dager
- TE kunne begrense konsekvensen til: 15 dager

Kritisk sti-aktiviteter paavirket:
1. Betongarbeider fundament
2. Staalmontasje hovedkonstruksjon

Ny planlagt sluttdato blir dermed forskjoevet tilsvarende.""",
        spesifisert_varsel=VarselInfo(
            varslet_dato=varslet_dato,
            varslet_via="e-post",
            referanse="KOE-Frist-001",
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


def create_grunnlag_respons(sak_id: str, now: datetime, grunnlag_event_id: str) -> ResponsEvent:
    """Opprett respons_grunnlag event (BH godkjenner)."""
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
            resultat=GrunnlagResponsResultat.GODKJENT,
            begrunnelse="Grunnlaget godkjennes. BH aksepterer ansvar for forsinkelsen.",
        ),
    )


def create_vederlag_respons(sak_id: str, now: datetime, vederlag_event_id: str) -> ResponsEvent:
    """Opprett respons_vederlag event (BH godkjenner delvis)."""
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
            beregnings_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
            godkjent_belop=100000.0,
            begrunnelse_beregning="BH godkjenner kr 100.000 av kravet. Paaslaget reduseres til 12%.",
        ),
    )


def create_frist_respons(sak_id: str, now: datetime, frist_event_id: str) -> ResponsEvent:
    """Opprett respons_frist event (BH godkjenner)."""
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
            beregnings_resultat=FristBeregningResultat.GODKJENT,
            godkjente_dager=15,
            begrunnelse_beregning="BH godkjenner fristforlengelsen paa 15 dager.",
        ),
    )


def create_test_sak(preset: Preset = Preset.KOMPLETT, sak_id: str = None) -> str:
    """
    Oppretter en test-sak basert på valgt preset.

    Args:
        preset: Hvilken type test-sak som skal opprettes
        sak_id: Sak-ID, genereres automatisk hvis ikke oppgitt

    Returns:
        sak_id for den opprettede saken
    """
    if not sak_id:
        sak_id = generate_sak_id()

    repo = JsonFileEventRepository()

    now = datetime.now()
    oppdaget_dato = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    varslet_dato = (now - timedelta(days=5)).strftime("%Y-%m-%d")

    events = []
    event_ids = {}  # For referanser

    # 1. SAK_OPPRETTET (alltid med)
    sak_event = create_sak_opprettet(sak_id, now)
    events.append(sak_event)
    print(f"  + sak_opprettet ({sak_event.event_id[:8]}...)")

    if preset == Preset.TOM:
        pass  # Kun sak_opprettet

    elif preset in [Preset.GRUNNLAG, Preset.VEDERLAG, Preset.KOMPLETT, Preset.RESPONS]:
        # 2. GRUNNLAG_OPPRETTET
        grunnlag_event = create_grunnlag_event(sak_id, now, oppdaget_dato, varslet_dato)
        events.append(grunnlag_event)
        event_ids["grunnlag"] = grunnlag_event.event_id
        print(f"  + grunnlag_opprettet ({grunnlag_event.event_id[:8]}...)")

    if preset in [Preset.VEDERLAG, Preset.KOMPLETT, Preset.RESPONS]:
        # 3. VEDERLAG_KRAV_SENDT
        vederlag_event = create_vederlag_event(sak_id, now, varslet_dato)
        events.append(vederlag_event)
        event_ids["vederlag"] = vederlag_event.event_id
        print(f"  + vederlag_krav_sendt ({vederlag_event.event_id[:8]}...)")

    if preset in [Preset.KOMPLETT, Preset.RESPONS]:
        # 4. FRIST_KRAV_SENDT
        frist_event = create_frist_event(sak_id, now, varslet_dato)
        events.append(frist_event)
        event_ids["frist"] = frist_event.event_id
        print(f"  + frist_krav_sendt ({frist_event.event_id[:8]}...)")

    if preset == Preset.RESPONS:
        # 5. BH RESPONSER
        grunnlag_respons = create_grunnlag_respons(sak_id, now, event_ids["grunnlag"])
        events.append(grunnlag_respons)
        print(f"  + respons_grunnlag ({grunnlag_respons.event_id[:8]}...)")

        vederlag_respons = create_vederlag_respons(sak_id, now, event_ids["vederlag"])
        events.append(vederlag_respons)
        print(f"  + respons_vederlag ({vederlag_respons.event_id[:8]}...)")

        frist_respons = create_frist_respons(sak_id, now, event_ids["frist"])
        events.append(frist_respons)
        print(f"  + respons_frist ({frist_respons.event_id[:8]}...)")

    # Lagre alle events i en batch (ny sak = expected_version 0)
    repo.append_batch(events, expected_version=0)

    # Generer magic link for enkel tilgang
    # Bruk samme storage_dir som backend (relativt til backend-mappen)
    backend_dir = Path(__file__).parent.parent
    magic_manager = MagicLinkManager(storage_dir=str(backend_dir / "koe_data"))
    magic_token = magic_manager.generate(sak_id=sak_id, ttl_hours=72)

    return sak_id, magic_token


def interactive_mode():
    """Interaktiv modus for å velge preset og sak-ID."""
    print("\n" + "=" * 50)
    print("  TEST-SAK GENERATOR")
    print("=" * 50)
    print("\nVelg preset:")
    print()

    presets = list(Preset)
    for i, preset in enumerate(presets, 1):
        print(f"  [{i}] {preset.value:12} - {PRESET_DESCRIPTIONS[preset]}")

    print()

    while True:
        try:
            choice = input("Velg nummer (1-5) eller 'q' for aa avslutte: ").strip().lower()
            if choice == 'q':
                print("Avbryter.")
                return

            idx = int(choice) - 1
            if 0 <= idx < len(presets):
                selected_preset = presets[idx]
                break
            else:
                print("Ugyldig valg. Proev igjen.")
        except ValueError:
            print("Ugyldig input. Skriv et tall 1-5.")

    print()
    sak_id_input = input(f"Sak-ID (Enter for auto-generert): ").strip()
    sak_id = sak_id_input if sak_id_input else None

    print()
    print(f"Oppretter test-sak med preset '{selected_preset.value}'...")
    print()

    created_sak_id, magic_token = create_test_sak(preset=selected_preset, sak_id=sak_id)

    print()
    print("=" * 50)
    print(f"  SAK OPPRETTET: {created_sak_id}")
    print("=" * 50)
    print()
    print(f"  Preset:  {selected_preset.value}")
    print(f"  URL:     http://localhost:3000/saker/{created_sak_id}?token={magic_token}")
    print()

    # Spør om brukeren vil lage flere
    again = input("Vil du opprette en ny sak? (j/n): ").strip().lower()
    if again in ['j', 'y', 'ja', 'yes']:
        interactive_mode()


def list_presets():
    """Vis tilgjengelige presets."""
    print("\nTilgjengelige presets:")
    for preset in Preset:
        print(f"  {preset.value:12} - {PRESET_DESCRIPTIONS[preset]}")
    print()


def main():
    """CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Opprett en test-sak for frontend/backend testing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Eksempler:
  python -m scripts.create_test_sak                    # Interaktiv modus
  python -m scripts.create_test_sak --preset tom       # Direkte med preset
  python -m scripts.create_test_sak --list             # Vis alle presets
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
        sak_id, magic_token = create_test_sak(
            preset=Preset(args.preset),
            sak_id=args.sak_id,
        )
        print()
        print(f"Test-sak opprettet: {sak_id}")
        print(f"URL: http://localhost:3000/saker/{sak_id}?token={magic_token}")
    else:
        # Interaktiv modus
        interactive_mode()


if __name__ == "__main__":
    main()
