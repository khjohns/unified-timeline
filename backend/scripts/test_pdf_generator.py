#!/usr/bin/env python3
"""
Test script for PDF generator with sample data using begrunnelseGenerator narratives.

Run: python test_pdf_generator.py
Output: test_output_*.pdf files
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime
from models.sak_state import (
    SakState, GrunnlagTilstand, VederlagTilstand, FristTilstand,
    ForseringData, EndringsordreData, EOKonsekvenser, EOStatus, SaksType,
    VarselInfo
)
from models.events import SporStatus, GrunnlagResponsResultat, VederlagBeregningResultat, FristBeregningResultat
from services.reportlab_pdf_generator import generate_koe_pdf


def test_koe_with_bh_response():
    """
    Test Case 1: Full KOE with BH response

    Scenario: TE claims delayed delivery of materials caused work stoppage.
    BH partially accepts the claim.

    Uses narrative style from begrunnelseGenerator:
    - Vederlag: Delvis godkjent with detailed begrunnelse
    - Frist: Godkjent with force majeure consideration
    """
    state = SakState(
        sak_id="KOE-2024-0042",
        sakstittel="Forsinket materialleveranse fra BH - arbeidsstopp uke 45-47",
        sakstype=SaksType.STANDARD,

        grunnlag=GrunnlagTilstand(
            status=SporStatus.GODKJENT,
            hovedkategori="SVIKT",
            underkategori="MEDVIRK",
            beskrivelse="Byggherren leverte stålkonstruksjoner 3 uker forsinket iht. avtalt leveranseplan. "
                       "Dette medførte full arbeidsstopp for montasjearbeid i uke 45-47. "
                       "Entreprenøren hadde disponert mannskap og utstyr som måtte omdirigeres. "
                       "Varslet skriftlig til byggherre 2. november 2024.",
            dato_oppdaget="2024-10-28",
            grunnlag_varsel=VarselInfo(dato_sendt="2024-11-02", metode=["epost"]),
            bh_resultat=GrunnlagResponsResultat.GODKJENT,
            bh_begrunnelse="Byggherren erkjenner forsinkelsen og godkjenner ansvarsgrunnlaget. "
                          "Materialene var forsinket grunnet leverandørproblemer som lå utenfor "
                          "entreprenørens kontroll.",
            siste_oppdatert=datetime(2024, 11, 15, 10, 30),
            antall_versjoner=1,
        ),

        vederlag=VederlagTilstand(
            status=SporStatus.DELVIS_GODKJENT,
            metode="REGNINGSARBEID",
            kostnads_overslag=485000.0,
            begrunnelse="Kostnadsoverslag omfatter:\n"
                       "- Ventekostnader mannskap: 320 000 kr\n"
                       "- Stillestående maskiner: 85 000 kr\n"
                       "- Remobilisering: 45 000 kr\n"
                       "- Administrative kostnader: 35 000 kr",
            saerskilt_krav={
                "rigg_drift": {"belop": 65000, "dato_klar_over": "2024-11-01"},
            },
            bh_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
            godkjent_belop=380000.0,
            bh_begrunnelse="Byggherren godtar den foreslåtte oppgjørsformen regningsarbeid (§30.2/§34.4). "
                          "Hva gjelder beløpet:\n\n"
                          "Hovedkravet godkjennes delvis med 350 000 NOK av krevde 420 000 NOK (83%). "
                          "Timesatsene for ventekostnader reduseres til kontraktsfestede satser.\n\n"
                          "Kravet om dekning av rigg- og driftskostnader på 65 000 NOK avvises prinsipalt "
                          "som prekludert iht. §34.1.3, da varselet ikke ble fremsatt «uten ugrunnet opphold» "
                          "etter at entreprenøren ble eller burde blitt klar over at utgiftene ville påløpe.\n\n"
                          "Subsidiært, dersom kravet ikke anses prekludert, aksepteres 30 000 NOK av krevde 65 000 NOK.\n\n"
                          "Samlet godkjent beløp utgjør etter dette 380 000 NOK av totalt krevde 485 000 NOK.",
            siste_oppdatert=datetime(2024, 11, 20, 14, 45),
            antall_versjoner=2,
        ),

        frist=FristTilstand(
            status=SporStatus.GODKJENT,
            varsel_type="spesifisert",
            krevd_dager=15,
            begrunnelse="Forsinkelsen medførte 15 arbeidsdagers stans i montasjearbeidet. "
                       "Dette påvirker kritisk linje og medfører tilsvarende forskyvning av "
                       "overlevering. Se vedlagt fremdriftsanalyse.",
            noytralt_varsel_ok=True,
            spesifisert_krav_ok=True,
            vilkar_oppfylt=True,
            bh_resultat=FristBeregningResultat.GODKJENT,
            godkjent_dager=15,
            bh_begrunnelse="Varslingskravene i §33.6 anses oppfylt.\n\n"
                          "Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring "
                          "av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.\n\n"
                          "Hva gjelder antall dager: Kravet om 15 dagers fristforlengelse godkjennes i sin helhet.\n\n"
                          "Samlet godkjennes 15 dagers fristforlengelse.",
            siste_oppdatert=datetime(2024, 11, 18, 9, 15),
            antall_versjoner=1,
        ),

        entreprenor="Byggmester AS",
        byggherre="Oslo Kommune",
        prosjekt_navn="Nye Jordal Amfi",
        opprettet=datetime(2024, 10, 28, 8, 0),
        siste_aktivitet=datetime(2024, 11, 20, 14, 45),
        antall_events=8,
    )

    output_path = "test_output_koe_with_response.pdf"
    result = generate_koe_pdf(state, output_path=output_path)
    print(f"Generated: {output_path}")
    return output_path


def test_force_majeure_claim():
    """
    Test Case 2: Force Majeure claim (§33.3)

    Scenario: Weather conditions caused work stoppage.
    BH recognizes force majeure - grants time extension but no compensation.
    """
    state = SakState(
        sak_id="KOE-2024-0058",
        sakstittel="Force majeure - ekstremvær desember 2024",
        sakstype=SaksType.STANDARD,

        grunnlag=GrunnlagTilstand(
            status=SporStatus.GODKJENT,
            hovedkategori="FORCE_MAJEURE",
            underkategori="FM_EGEN",
            beskrivelse="Ekstreme værforhold i perioden 5.-12. desember 2024 med vedvarende "
                       "vindstyrke over 20 m/s og temperaturer under -15°C. Arbeid på tak og "
                       "fasade måtte innstilles av HMS-hensyn. Forholdet var ikke mulig å forutse "
                       "ved kontraktsinngåelse.",
            dato_oppdaget="2024-12-05",
            grunnlag_varsel=VarselInfo(dato_sendt="2024-12-05", metode=["epost", "byggemote"]),
            bh_resultat=GrunnlagResponsResultat.GODKJENT,
            bh_begrunnelse="Byggherren godkjenner at værforholdene utgjør force majeure iht. §33.3. "
                          "Ekstremværet var av ekstraordinær karakter og lå utenfor det entreprenøren "
                          "med rimelighet kunne forutse eller overvinne.",
            siste_oppdatert=datetime(2024, 12, 10, 11, 0),
            antall_versjoner=1,
        ),

        vederlag=VederlagTilstand(
            status=SporStatus.IKKE_RELEVANT,
        ),

        frist=FristTilstand(
            status=SporStatus.GODKJENT,
            varsel_type="spesifisert",
            krevd_dager=6,
            begrunnelse="6 arbeidsdager tapt grunnet værforhold som gjorde arbeid uforsvarlig. "
                       "Alle utendørs aktiviteter måtte stanses.",
            noytralt_varsel_ok=True,
            spesifisert_krav_ok=True,
            vilkar_oppfylt=True,
            bh_resultat=FristBeregningResultat.GODKJENT,
            godkjent_dager=6,
            bh_begrunnelse="Varslingskravene i §33.3 anses oppfylt.\n\n"
                          "Det erkjennes at det påberopte forholdet har forårsaket faktisk hindring "
                          "av fremdriften, og at det foreligger årsakssammenheng mellom forholdet og forsinkelsen.\n\n"
                          "Hva gjelder antall dager: Kravet om 6 dagers fristforlengelse godkjennes i sin helhet.\n\n"
                          "Samlet godkjennes 6 dagers fristforlengelse.\n\n"
                          "Byggherren gjør oppmerksom på at fristforlengelse innvilget etter §33.3 (force majeure) "
                          "ikke gir grunnlag for vederlagsjustering, jf. §33.3 (5).",
            siste_oppdatert=datetime(2024, 12, 10, 11, 30),
            antall_versjoner=1,
        ),

        entreprenor="NCC Norge AS",
        byggherre="Statsbygg",
        prosjekt_navn="Nytt regjeringskvartal",
        opprettet=datetime(2024, 12, 5, 7, 30),
        siste_aktivitet=datetime(2024, 12, 10, 11, 30),
        antall_events=4,
    )

    output_path = "test_output_force_majeure.pdf"
    result = generate_koe_pdf(state, output_path=output_path)
    print(f"Generated: {output_path}")
    return output_path


def test_forsering_sak():
    """
    Test Case 3: Forsering (§33.8)

    Scenario: BH rejected time extension claim. TE chooses to accelerate work
    and treats rejection as acceleration order.
    """
    state = SakState(
        sak_id="FOR-2024-0003",
        sakstittel="Forsering etter avslått fristforlengelse KOE-2024-0035",
        sakstype=SaksType.FORSERING,

        forsering_data=ForseringData(
            avslatte_fristkrav=["KOE-2024-0035"],
            dato_varslet="2024-11-25",
            estimert_kostnad=450000.0,
            bekreft_30_prosent_regel=True,
            avslatte_dager=20,
            dagmulktsats=25000.0,
            maks_forseringskostnad=650000.0,  # 20 * 25000 * 1.3
            er_iverksatt=True,
            dato_iverksatt="2024-11-28",
            bh_aksepterer_forsering=True,
            bh_godkjent_kostnad=420000.0,
            bh_begrunnelse="Byggherren aksepterer forseringen iht. §33.8. Estimert kostnad på 450 000 kr "
                          "er innenfor 30%-grensen (maks 650 000 kr). Godkjent kostnad settes til 420 000 kr "
                          "basert på gjennomgang av kostnadsoppstillingen.",
        ),

        # Empty tracks for forsering
        grunnlag=GrunnlagTilstand(status=SporStatus.IKKE_RELEVANT),
        vederlag=VederlagTilstand(status=SporStatus.IKKE_RELEVANT),
        frist=FristTilstand(status=SporStatus.IKKE_RELEVANT),

        entreprenor="Veidekke Entreprenør AS",
        byggherre="Bane NOR",
        prosjekt_navn="Follobanen - Ski stasjon",
        opprettet=datetime(2024, 11, 25, 9, 0),
        siste_aktivitet=datetime(2024, 12, 2, 14, 20),
        antall_events=5,
    )

    output_path = "test_output_forsering.pdf"
    result = generate_koe_pdf(state, output_path=output_path)
    print(f"Generated: {output_path}")
    return output_path


def test_endringsordre():
    """
    Test Case 4: Endringsordre (§31.3)

    Scenario: BH issues formal change order collecting two KOE claims.
    """
    state = SakState(
        sak_id="EO-2024-0012",
        sakstittel="Endringsordre 12 - Utvidet fundamentering",
        sakstype=SaksType.ENDRINGSORDRE,

        endringsordre_data=EndringsordreData(
            relaterte_koe_saker=["KOE-2024-0028", "KOE-2024-0031"],
            eo_nummer="EO-012",
            revisjon_nummer=0,
            beskrivelse="Utvidet fundamentering grunnet uforutsette grunnforhold. "
                       "Peling må utvides med 12 peler á 18 meter i østre hjørne. "
                       "Arbeidet omfatter boring, armering og støping av tilleggspeler "
                       "samt justering av ringmur.",
            konsekvenser=EOKonsekvenser(
                pris=True,
                fremdrift=True,
                sha=False,
                kvalitet=False,
                annet=False,
            ),
            konsekvens_beskrivelse="Tilleggsarbeidet medfører økte kostnader for peling og "
                                  "forskyvning av fundamenteringsarbeidet med 8 arbeidsdager.",
            oppgjorsform="ENHETSPRISER",
            kompensasjon_belop=780000.0,
            frist_dager=8,
            status=EOStatus.AKSEPTERT,
            dato_utstedt="2024-11-10",
            utstedt_av="Per Hansen, Prosjektleder BH",
            te_akseptert=True,
            te_kommentar="Akseptert. Beløp og fristforlengelse er i samsvar med våre krav.",
            dato_te_respons="2024-11-12",
        ),

        # Empty tracks for endringsordre
        grunnlag=GrunnlagTilstand(status=SporStatus.IKKE_RELEVANT),
        vederlag=VederlagTilstand(status=SporStatus.IKKE_RELEVANT),
        frist=FristTilstand(status=SporStatus.IKKE_RELEVANT),

        entreprenor="Skanska Norge AS",
        byggherre="Omsorgsbygg Oslo KF",
        prosjekt_navn="Nye Ullevål sykehjem",
        opprettet=datetime(2024, 11, 10, 8, 30),
        siste_aktivitet=datetime(2024, 11, 12, 16, 0),
        antall_events=3,
    )

    output_path = "test_output_endringsordre.pdf"
    result = generate_koe_pdf(state, output_path=output_path)
    print(f"Generated: {output_path}")
    return output_path


def test_pending_claim():
    """
    Test Case 5: Pending KOE without BH response

    Scenario: TE has submitted claims, awaiting BH response.
    """
    state = SakState(
        sak_id="KOE-2024-0067",
        sakstittel="Prosjekteringsfeil - VVS kolliderer med bærekonstruksjon",
        sakstype=SaksType.STANDARD,

        grunnlag=GrunnlagTilstand(
            status=SporStatus.SENDT,
            hovedkategori="SVIKT",
            underkategori="PROSJ_RISIKO",
            beskrivelse="Ved oppstart av VVS-montasje ble det avdekket at hovedkanal for "
                       "ventilasjon kolliderer med stålbjelke i akse C-12. Forholdet skyldes "
                       "mangelfull koordinering mellom RIB og RIV i prosjekteringsfasen. "
                       "Omprosjektering og endret trasé er nødvendig.",
            dato_oppdaget="2024-12-10",
            grunnlag_varsel=VarselInfo(dato_sendt="2024-12-11"),
            siste_oppdatert=datetime(2024, 12, 11, 10, 0),
            antall_versjoner=1,
        ),

        vederlag=VederlagTilstand(
            status=SporStatus.SENDT,
            metode="FASTPRIS_TILBUD",
            belop_direkte=125000.0,
            begrunnelse="Tilbud på omlegging av ventilasjonskanal inkludert:\n"
                       "- Demontering eksisterende: 15 000 kr\n"
                       "- Ny trasé med ekstra bend: 85 000 kr\n"
                       "- Tilpasning brannisolasjon: 25 000 kr",
            siste_oppdatert=datetime(2024, 12, 12, 14, 30),
            antall_versjoner=1,
        ),

        frist=FristTilstand(
            status=SporStatus.SENDT,
            varsel_type="spesifisert",
            krevd_dager=5,
            begrunnelse="Omlegging av trasé medfører 5 dagers forsinkelse for VVS-arbeidene. "
                       "Påvirker ikke kritisk linje da buffer eksisterer mot neste aktivitet.",
            siste_oppdatert=datetime(2024, 12, 12, 14, 30),
            antall_versjoner=1,
        ),

        entreprenor="GK Norge AS",
        byggherre="Oslo Kommune Utdanningsetaten",
        prosjekt_navn="Ny ungdomsskole Groruddalen",
        opprettet=datetime(2024, 12, 10, 9, 0),
        siste_aktivitet=datetime(2024, 12, 12, 14, 30),
        antall_events=4,
    )

    output_path = "test_output_pending.pdf"
    result = generate_koe_pdf(state, output_path=output_path)
    print(f"Generated: {output_path}")
    return output_path


def main():
    print("=" * 60)
    print("PDF Generator Test Suite")
    print("Testing with begrunnelseGenerator-style narratives")
    print("=" * 60)
    print()

    tests = [
        ("KOE with BH response (delvis godkjent)", test_koe_with_bh_response),
        ("Force Majeure claim (§33.3)", test_force_majeure_claim),
        ("Forsering (§33.8)", test_forsering_sak),
        ("Endringsordre (§31.3)", test_endringsordre),
        ("Pending claim (no BH response)", test_pending_claim),
    ]

    generated_files = []
    for name, test_fn in tests:
        print(f"Running: {name}")
        try:
            output_file = test_fn()
            generated_files.append(output_file)
            print("  ✓ Success\n")
        except Exception as e:
            print(f"  ✗ Failed: {e}\n")
            import traceback
            traceback.print_exc()

    print("=" * 60)
    print("Generated files:")
    for f in generated_files:
        print(f"  - {f}")
    print()
    print("Open these files to verify formatting and content.")


if __name__ == "__main__":
    main()
