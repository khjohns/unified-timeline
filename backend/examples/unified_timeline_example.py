"""
Eksempel: Unified Timeline Architecture

Dette eksempelet viser hvordan den nye event-baserte arkitekturen fungerer.
Det demonstrerer:
1. Opprettelse av events for en sak
2. Beregning av state fra events
3. Parallell behandling (BH godkjenner grunnlag, avslår vederlag)
4. API-responser for frontend
"""
from datetime import datetime, timedelta

# Event modeller
from models.events import (
    SakOpprettetEvent,
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    GrunnlagData,
    VederlagData,
    FristData,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
    EventType,
    SporType,
    ResponsResultat,
)

# Services
from services.timeline_service import TimelineService, MigrationHelper
from services.sak_api_service import SakApiService


def scenario_paralell_behandling():
    """
    Scenario: BH godkjenner grunnlag, men avslår vederlag

    Dette demonstrerer hovedfordelen med ny arkitektur:
    - TE sender varsel om grunnforhold
    - TE sender vederlagskrav på 150 000 NOK
    - BH godkjenner grunnlaget (låser det)
    - BH avslår vederlagskravet (ber om ny pris)
    - TE sender oppdatert vederlagskrav på 120 000 NOK
    - BH godkjenner nytt vederlagskrav
    """
    print("=" * 60)
    print("SCENARIO: Parallell behandling - Godkjent grunnlag, forhandlet vederlag")
    print("=" * 60)

    sak_id = "KOE-2025-001"
    events = []
    base_time = datetime.now()

    # 1. Sak opprettes
    print("\n1. TE oppretter sak")
    events.append(SakOpprettetEvent(
        sak_id=sak_id,
        sakstittel="Avvik i grunnforhold ved bygg A",
        aktor="Ola Nordmann",
        aktor_rolle="TE",
        tidsstempel=base_time,
    ))

    # 2. TE sender grunnlag (varsel)
    print("2. TE sender varsel om grunnlag")
    events.append(GrunnlagEvent(
        sak_id=sak_id,
        event_type=EventType.GRUNNLAG_OPPRETTET,
        aktor="Ola Nordmann",
        aktor_rolle="TE",
        tidsstempel=base_time + timedelta(hours=1),
        data=GrunnlagData(
            hovedkategori="Risiko",
            underkategori="Grunnforhold",
            beskrivelse="Ved graving ble det oppdaget fjell på kote -3.5, mens prosjektert var -5.0. "
                        "Dette medfører behov for sprengning og endret fundamentering.",
            dato_oppdaget="2025-01-15",
            kontraktsreferanser=["NS8407 §25.2", "Prosjektbeskrivelse kap. 3.2"],
        ),
    ))

    # 3. TE sender vederlagskrav
    print("3. TE sender vederlagskrav på 150 000 NOK")
    events.append(VederlagEvent(
        sak_id=sak_id,
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        aktor="Ola Nordmann",
        aktor_rolle="TE",
        tidsstempel=base_time + timedelta(hours=2),
        versjon=1,
        data=VederlagData(
            krav_belop=150000,
            metode="100000000",  # Entreprenørens tilbud
            begrunnelse="Sprengning og endret fundamentering. "
                        "Se vedlagt kalkyle for detaljert kostnadsoppstilling.",
            inkluderer_produktivitetstap=True,
        ),
    ))

    # 4. TE sender fristkrav
    print("4. TE sender fristkrav på 10 dager")
    events.append(FristEvent(
        sak_id=sak_id,
        event_type=EventType.FRIST_KRAV_SENDT,
        aktor="Ola Nordmann",
        aktor_rolle="TE",
        tidsstempel=base_time + timedelta(hours=3),
        versjon=1,
        data=FristData(
            antall_dager=10,
            frist_type="arbeidsdager",
            begrunnelse="Tid for sprengning og herdning av nytt fundament",
            pavirker_kritisk_linje=True,
            milepael_pavirket="M2: Grunnarbeider ferdig",
        ),
    ))

    # Beregn state etter TEs innsendig
    service = TimelineService()
    state = service.compute_state(events)

    print(f"\n--- Status etter TEs innsendinger ---")
    print(f"Overordnet: {state.overordnet_status}")
    print(f"Grunnlag: {state.grunnlag.status.value}")
    print(f"Vederlag: {state.vederlag.status.value} - {state.vederlag.krevd_belop:,.0f} NOK")
    print(f"Frist: {state.frist.status.value} - {state.frist.krevd_dager} dager")

    # 5. BH godkjenner grunnlaget (dette er hovedfunksjonen!)
    print("\n5. BH GODKJENNER grunnlag (låser det)")
    events.append(ResponsEvent(
        sak_id=sak_id,
        event_type=EventType.RESPONS_GRUNNLAG,
        aktor="Kari Hansen",
        aktor_rolle="BH",
        tidsstempel=base_time + timedelta(days=2),
        spor=SporType.GRUNNLAG,
        refererer_til_event_id=events[1].event_id,  # Refererer til grunnlag-event
        data=GrunnlagResponsData(
            resultat=ResponsResultat.GODKJENT,
            begrunnelse="Grunnlaget aksepteres. Fjell på annen kote enn prosjektert "
                        "er et forhold som gir rett til kompensasjon iht. NS8407 §25.2.",
        ),
    ))

    # 6. BH avslår vederlagskravet (men grunnlaget er fortsatt godkjent!)
    print("6. BH AVSLÅR vederlagskrav (ber om ny pris basert på enhetspriser)")
    events.append(ResponsEvent(
        sak_id=sak_id,
        event_type=EventType.RESPONS_VEDERLAG,
        aktor="Kari Hansen",
        aktor_rolle="BH",
        tidsstempel=base_time + timedelta(days=2, hours=1),
        spor=SporType.VEDERLAG,
        refererer_til_event_id=events[2].event_id,
        data=VederlagResponsData(
            resultat=ResponsResultat.KREVER_AVKLARING,
            begrunnelse="Grunnlaget er godkjent, men vi ber om nytt vederlagskrav "
                        "basert på kontraktens enhetspriser (§34.3.1) i stedet for tilbud.",
            frist_for_spesifikasjon="2025-02-01",
        ),
    ))

    # 7. BH godkjenner fristkravet
    print("7. BH GODKJENNER fristkrav (8 av 10 dager)")
    events.append(ResponsEvent(
        sak_id=sak_id,
        event_type=EventType.RESPONS_FRIST,
        aktor="Kari Hansen",
        aktor_rolle="BH",
        tidsstempel=base_time + timedelta(days=2, hours=2),
        spor=SporType.FRIST,
        refererer_til_event_id=events[3].event_id,
        data=FristResponsData(
            resultat=ResponsResultat.DELVIS_GODKJENT,
            begrunnelse="8 arbeidsdager godkjennes. 2 dager trekkes da "
                        "herdning kan skje parallelt med andre arbeider.",
            godkjent_dager=8,
        ),
    ))

    # Beregn state etter BHs svar
    state = service.compute_state(events)

    print(f"\n--- Status etter BHs svar (DETTE ER NØKKELEN!) ---")
    print(f"Overordnet: {state.overordnet_status}")
    print(f"Grunnlag: {state.grunnlag.status.value} (LÅST: {state.grunnlag.laast})")
    print(f"Vederlag: {state.vederlag.status.value} (Krevd: {state.vederlag.krevd_belop:,.0f}, Godkjent: {state.vederlag.godkjent_belop or 'Ingen'})")
    print(f"Frist: {state.frist.status.value} (Krevd: {state.frist.krevd_dager}, Godkjent: {state.frist.godkjent_dager})")
    print(f"Kan utstede EO: {state.kan_utstede_eo}")

    # 8. TE sender oppdatert vederlagskrav
    print("\n8. TE sender OPPDATERT vederlagskrav på 120 000 NOK (enhetspriser)")
    events.append(VederlagEvent(
        sak_id=sak_id,
        event_type=EventType.VEDERLAG_KRAV_OPPDATERT,
        aktor="Ola Nordmann",
        aktor_rolle="TE",
        tidsstempel=base_time + timedelta(days=5),
        versjon=2,
        data=VederlagData(
            krav_belop=120000,
            metode="100000001",  # Kontraktens enhetspriser
            begrunnelse="Revidert kalkyle basert på kontraktens enhetspriser. "
                        "Se vedlagt spesifikasjon med mengder og priser.",
        ),
    ))

    # 9. BH godkjenner nytt vederlagskrav
    print("9. BH GODKJENNER oppdatert vederlagskrav")
    events.append(ResponsEvent(
        sak_id=sak_id,
        event_type=EventType.RESPONS_VEDERLAG,
        aktor="Kari Hansen",
        aktor_rolle="BH",
        tidsstempel=base_time + timedelta(days=7),
        spor=SporType.VEDERLAG,
        refererer_til_event_id=events[7].event_id,
        data=VederlagResponsData(
            resultat=ResponsResultat.GODKJENT,
            begrunnelse="Vederlagskrav på 120 000 NOK basert på enhetspriser godkjennes.",
            godkjent_belop=120000,
            godkjent_metode="100000001",
        ),
    ))

    # Endelig state
    state = service.compute_state(events)

    print(f"\n--- ENDELIG STATUS ---")
    print(f"Overordnet: {state.overordnet_status}")
    print(f"Grunnlag: {state.grunnlag.status.value} (LÅST)")
    print(f"Vederlag: {state.vederlag.status.value} - Godkjent {state.vederlag.godkjent_belop:,.0f} NOK")
    print(f"Frist: {state.frist.status.value} - Godkjent {state.frist.godkjent_dager} dager")
    print(f"Kan utstede EO: {state.kan_utstede_eo}")
    print(f"Neste handling: {state.neste_handling}")

    return events, state


def demo_api_response(events):
    """Demonstrerer API-responser for frontend"""
    print("\n" + "=" * 60)
    print("API RESPONS FOR FRONTEND")
    print("=" * 60)

    api_service = SakApiService()
    full_response = api_service.get_full_sak(events, rolle="TE")

    print("\n--- Oversikt-fanen ---")
    print(f"Status: {full_response.oversikt.status.tekst} ({full_response.oversikt.status.farge})")
    print(f"Total krevd: {full_response.oversikt.total_krevd:,.0f} NOK")
    print(f"Total godkjent: {full_response.oversikt.total_godkjent:,.0f} NOK")
    print(f"Kan utstede EO: {full_response.oversikt.kan_utstede_eo}")

    print("\n--- Spor-status ---")
    for spor in full_response.oversikt.spor:
        print(f"  {spor.tittel}: {spor.status.tekst}")
        if spor.verdi_krevd:
            print(f"    Krevd: {spor.verdi_krevd}")
        if spor.verdi_godkjent:
            print(f"    Godkjent: {spor.verdi_godkjent}")

    print("\n--- Tidslinje (siste 5 events) ---")
    for entry in full_response.tidslinje.events[:5]:
        print(f"  [{entry.tidsstempel.strftime('%d.%m %H:%M')}] {entry.type_label}")
        print(f"    {entry.aktor.navn} ({entry.aktor.rolle}): {entry.sammendrag}")

    return full_response


def demo_migration():
    """Demonstrerer migrering fra gammel til ny modell"""
    print("\n" + "=" * 60)
    print("MIGRERING FRA GAMMEL TIL NY MODELL")
    print("=" * 60)

    # Simuler gammel data
    legacy_sak = {
        "sak_id": "KOE-LEGACY-001",
        "sakstittel": "Gammel sak fra CSV",
        "opprettet_av": "Demo User",
        "opprettet_dato": "2025-01-10",
    }

    legacy_varsel = {
        "hovedkategori": "Prosjektering",
        "underkategori": "Tegningsfeil",
        "varsel_beskrivelse": "Feil i betongarmering på dekkeelement D-12",
        "dato_forhold_oppdaget": "2025-01-08",
    }

    legacy_koe_revisjoner = [{
        "koe_revisjonsnr": "0",
        "for_entreprenor": "Gammel Bruker",
        "vederlag": {
            "krav_vederlag": True,
            "krav_vederlag_metode": "100000001",
            "krav_vederlag_belop": "85000",
            "krav_vederlag_begrunnelse": "Omarbeiding av armering",
        },
        "frist": {
            "krav_fristforlengelse": True,
            "krav_frist_type": "arbeidsdager",
            "krav_frist_antall_dager": "5",
            "krav_frist_begrunnelse": "Tid for omlegging",
        },
    }]

    legacy_bh_svar = [{
        "vederlag": {
            "bh_svar_vederlag": "100000000",  # Godkjent fullt
            "bh_godkjent_vederlag_belop": "85000",
            "bh_begrunnelse_vederlag": "Godkjent",
        },
        "frist": {
            "bh_svar_frist": "100000000",
            "bh_godkjent_frist_dager": "5",
            "bh_begrunnelse_frist": "Godkjent",
        },
        "sign": {
            "for_byggherre": "Gammel BH",
        },
    }]

    # Migrer
    helper = MigrationHelper()
    events = helper.migrate_sak(
        sak_data=legacy_sak,
        varsel_data=legacy_varsel,
        koe_revisjoner=legacy_koe_revisjoner,
        bh_svar_revisjoner=legacy_bh_svar,
    )

    print(f"\nMigrerte {len(events)} events fra legacy-data:")
    for event in events:
        print(f"  - {event.event_type.value}")

    # Beregn state
    service = TimelineService()
    state = service.compute_state(events)

    print(f"\nMigrert state:")
    print(f"  Overordnet: {state.overordnet_status}")
    print(f"  Vederlag godkjent: {state.vederlag.godkjent_belop:,.0f} NOK" if state.vederlag.godkjent_belop else "")

    return events


if __name__ == "__main__":
    # Kjør hovedscenario
    events, state = scenario_paralell_behandling()

    # Vis API-respons
    demo_api_response(events)

    # Demonstrer migrering
    demo_migration()

    print("\n" + "=" * 60)
    print("KONKLUSJON")
    print("=" * 60)
    print("""
Den nye arkitekturen løser følgende problemer:

1. PARTIELL ENIGHET: BH kan godkjenne grunnlag separat fra vederlag/frist
2. FLEKSIBEL FORHANDLING: Vederlag kan forhandles uten å påvirke grunnlag
3. FULL SPORBARHET: Hver endring er en immutable event i tidslinjen
4. ASYNKRON BEHANDLING: Hvert spor kan behandles uavhengig
5. ENKEL MIGRERING: Legacy-data kan konverteres til events

Frontend kan nå vise tre separate faner (Grunnlag, Vederlag, Tid)
hvor hver har sin egen status og historikk.
    """)
