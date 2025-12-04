"""
Mock events for testing and development.

These events demonstrate proper usage of the VarselInfo structure
and NS 8407 compliance for warnings and notifications.
"""
from models.events import (
    SakOpprettetEvent,
    GrunnlagEvent,
    GrunnlagData,
    VederlagEvent,
    VederlagData,
    FristEvent,
    FristData,
    ResponsEvent,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
    VarselInfo,
    VederlagsMetode,
    FristVarselType,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
    SporType,
    EventType,
)


# ============================================================
# MOCK SCENARIO 1: Complete workflow - TE sends, BH approves
# ============================================================

MOCK_EVENTS_SCENARIO_1 = [
    # Event 1: Sak opprettet
    SakOpprettetEvent(
        event_id="evt-001",
        sak_id="SAK-001",
        sakstittel="Svikt i prosjektering - Fundamentering",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        prosjekt_id="PROJ-2025-001",
        catenda_topic_id="topic-guid-abc123",
    ),

    # Event 2: Grunnlag opprettet med varsel
    GrunnlagEvent(
        event_id="evt-002",
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        event_type=EventType.GRUNNLAG_OPPRETTET,
        data=GrunnlagData(
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse=(
                "Mangler i fundamenttegninger for Akse A. "
                "Tegning FUN-01 mangler dimensjonering av søyler S1-S4. "
                "Dette hindrer oss i å starte fundamentarbeider."
            ),
            dato_oppdaget="2025-01-10",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["epost", "byggemote"]
            ),
            kontraktsreferanser=["NS8407 §24.1", "NS8407 §22.3"],
            vedlegg_ids=["DOK-001-tegning", "DOK-002-epost"]
        )
    ),

    # Event 3: Vederlag krav sendt med alle relevante varsler
    VederlagEvent(
        event_id="evt-003",
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        versjon=1,
        data=VederlagData(
            krav_belop=75000,
            metode=VederlagsMetode.REGNING,
            begrunnelse=(
                "Ekstra tid til omprosjektering og utstikking: "
                "- 40 timer ingeniør à 1200 NOK = 48000 NOK\n"
                "- 15 timer utstykkingsingeniør à 1300 NOK = 19500 NOK\n"
                "- Rigg/drift (mobilisering ny utstikking) = 15000 NOK\n"
                "Total: 82500 NOK. Krevd: 75000 NOK (redusert påslag)"
            ),
            inkluderer_rigg_drift=True,
            rigg_drift_belop=15000,
            rigg_drift_varsel=VarselInfo(
                dato_sendt="2025-01-12",
                metode=["epost"]
            ),
            krever_regningsarbeid=True,
            regningsarbeid_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["byggemote"]
            ),
            krav_fremmet_dato="2025-01-18",
            vedlegg_ids=["DOK-003-timeregistrering", "DOK-004-kostnadsoverslag"]
        )
    ),

    # Event 4: Frist krav sendt med både nøytralt og spesifisert varsel
    FristEvent(
        event_id="evt-004",
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        event_type=EventType.FRIST_KRAV_SENDT,
        versjon=1,
        data=FristData(
            varsel_type=FristVarselType.BEGGE,
            noytralt_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["byggemote"]
            ),
            spesifisert_varsel=VarselInfo(
                dato_sendt="2025-01-18",
                metode=["epost", "brev"]
            ),
            antall_dager=10,
            begrunnelse=(
                "Omprosjektering av fundamenter tar 5 virkedager. "
                "Ny utstikking tar 3 virkedager. "
                "Tilleggstid for koordinering: 2 virkedager. "
                "Total forsinkelse: 10 virkedager."
            ),
            fremdriftshindring_dokumentasjon=(
                "Se vedlagt fremdriftsplan rev. 2. "
                "Fundamentarbeider ligger på kritisk linje. "
                "Kan ikke starte neste fase før fundamenter er klare."
            ),
            ny_sluttdato="2025-03-15",
            vedlegg_ids=["DOK-005-fremdriftsplan", "DOK-006-fremdriftsanalyse"]
        )
    ),

    # Event 5: BH godkjenner grunnlag
    ResponsEvent(
        event_id="evt-005",
        sak_id="SAK-001",
        aktor="Kari Hansen",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_GRUNNLAG,
        spor=SporType.GRUNNLAG,
        refererer_til_event_id="evt-002",
        data=GrunnlagResponsData(
            resultat=GrunnlagResponsResultat.GODKJENT,
            begrunnelse=(
                "BH erkjenner at det var mangler i prosjekteringsunderlag. "
                "Varselet ble sendt i tide (1 dag etter oppdagelse). "
                "BH har ansvar for dette forholdet iht. NS8407 §24.1."
            ),
            varsel_for_sent=False
        )
    ),

    # Event 6: BH godkjenner vederlag fullt
    ResponsEvent(
        event_id="evt-006",
        sak_id="SAK-001",
        aktor="Kari Hansen",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_VEDERLAG,
        spor=SporType.VEDERLAG,
        refererer_til_event_id="evt-003",
        data=VederlagResponsData(
            # Port 1: Varsler
            krav_fremmet_i_tide=True,
            varsel_start_regning_ok=True,
            saerskilt_varsel_rigg_drift_ok=True,
            begrunnelse_varsel=(
                "Alle varsler er sendt i tide. "
                "Regningsarbeid varslet før oppstart. "
                "Rigg/drift varslet særskilt."
            ),
            # Port 2: Beregning
            vederlagsmetode=VederlagsMetode.REGNING,
            beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
            godkjent_belop=75000,
            begrunnelse_beregning=(
                "BH er enig om timeforbruk og timepriser. "
                "Rigg/drift er rimelig for denne type arbeid. "
                "Godkjenner beløpet fullt ut."
            )
        )
    ),

    # Event 7: BH godkjenner frist fullt
    ResponsEvent(
        event_id="evt-007",
        sak_id="SAK-001",
        aktor="Kari Hansen",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_FRIST,
        spor=SporType.FRIST,
        refererer_til_event_id="evt-004",
        data=FristResponsData(
            # Port 1: Varsler
            noytralt_varsel_ok=True,
            spesifisert_krav_ok=True,
            begrunnelse_varsel=(
                "Nøytralt varsel sendt dagen etter oppdagelse. "
                "Spesifisert krav sendt innen rimelig tid (7 dager senere)."
            ),
            # Port 2: Vilkår (årsakssammenheng)
            vilkar_oppfylt=True,
            begrunnelse_vilkar=(
                "BH bekrefter at fundamentarbeider ligger på kritisk linje. "
                "Forsinkelsen i prosjektering har medført faktisk fremdriftshindring."
            ),
            # Port 3: Beregning
            beregnings_resultat=FristBeregningResultat.GODKJENT_FULLT,
            godkjent_dager=10,
            ny_sluttdato="2025-03-15",
            begrunnelse_beregning=(
                "BH er enig i tidsvurderingen. "
                "10 virkedager er rimelig for dette omfanget."
            )
        )
    ),
]


# ============================================================
# MOCK SCENARIO 2: Subsidiær godkjenning (grunnlag avvist, men vederlag godkjent)
# ============================================================

MOCK_EVENTS_SCENARIO_2 = [
    SakOpprettetEvent(
        event_id="evt-201",
        sak_id="SAK-002",
        sakstittel="Tvist om ansvar - Subsidiær vurdering",
        aktor="Per Johansen",
        aktor_rolle="TE",
        prosjekt_id="PROJ-2025-002",
    ),

    GrunnlagEvent(
        event_id="evt-202",
        sak_id="SAK-002",
        aktor="Per Johansen",
        aktor_rolle="TE",
        event_type=EventType.GRUNNLAG_OPPRETTET,
        data=GrunnlagData(
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse="TE hevder BH har ansvar for forsinkelse",
            dato_oppdaget="2025-02-01",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-02-02",
                metode=["epost"]
            ),
        )
    ),

    VederlagEvent(
        event_id="evt-203",
        sak_id="SAK-002",
        aktor="Per Johansen",
        aktor_rolle="TE",
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        versjon=1,
        data=VederlagData(
            krav_belop=50000,
            metode=VederlagsMetode.REGNING,
            begrunnelse="Ekstra timer",
            krever_regningsarbeid=True,
            regningsarbeid_varsel=VarselInfo(
                dato_sendt="2025-02-02",
                metode=["byggemote"]
            ),
        )
    ),

    # BH avviser grunnlag (uenig om ansvar)
    ResponsEvent(
        event_id="evt-204",
        sak_id="SAK-002",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_GRUNNLAG,
        spor=SporType.GRUNNLAG,
        refererer_til_event_id="evt-202",
        data=GrunnlagResponsData(
            resultat=GrunnlagResponsResultat.AVVIST_UENIG,
            begrunnelse=(
                "BH er uenig i ansvarsgrunnlaget. "
                "Vi mener forsinkelsen skyldes forhold på TEs side, ikke BHs prosjektering."
            )
        )
    ),

    # Men BH godkjenner vederlag subsidiært (enig om beløp hvis ansvar skulle tillegges BH)
    ResponsEvent(
        event_id="evt-205",
        sak_id="SAK-002",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_VEDERLAG,
        spor=SporType.VEDERLAG,
        refererer_til_event_id="evt-203",
        data=VederlagResponsData(
            krav_fremmet_i_tide=True,
            varsel_start_regning_ok=True,
            vederlagsmetode=VederlagsMetode.REGNING,
            beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
            godkjent_belop=50000,
            begrunnelse_beregning=(
                "SUBSIDIÆRT: BH er enig om at hvis vi hadde hatt ansvar, "
                "er 50000 NOK et rimelig beløp basert på timeforbruk. "
                "Dette er en ren beregningsvurdering, ikke en anerkjennelse av ansvar."
            )
        )
    ),
]


# ============================================================
# MOCK SCENARIO 3: Delvis godkjenning (uenighet om beløp)
# ============================================================

MOCK_EVENTS_SCENARIO_3 = [
    SakOpprettetEvent(
        event_id="evt-301",
        sak_id="SAK-003",
        sakstittel="Uenighet om omfang - Delvis godkjenning",
        aktor="Anne Berg",
        aktor_rolle="TE",
        prosjekt_id="PROJ-2025-003",
    ),

    GrunnlagEvent(
        event_id="evt-302",
        sak_id="SAK-003",
        aktor="Anne Berg",
        aktor_rolle="TE",
        event_type=EventType.GRUNNLAG_OPPRETTET,
        data=GrunnlagData(
            hovedkategori="endring_initiert_bh",
            underkategori="regulaer_endringsordre",
            beskrivelse="BH ønsker endring i fasade",
            dato_oppdaget="2025-02-10",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-02-11",
                metode=["epost"]
            ),
        )
    ),

    VederlagEvent(
        event_id="evt-303",
        sak_id="SAK-003",
        aktor="Anne Berg",
        aktor_rolle="TE",
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        versjon=1,
        data=VederlagData(
            krav_belop=100000,
            metode=VederlagsMetode.TILBUD,
            begrunnelse="Pristilbud for fasadeendring inkludert påslag",
        )
    ),

    # BH godkjenner grunnlag (enig om at det er en endring)
    ResponsEvent(
        event_id="evt-304",
        sak_id="SAK-003",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_GRUNNLAG,
        spor=SporType.GRUNNLAG,
        refererer_til_event_id="evt-302",
        data=GrunnlagResponsData(
            resultat=GrunnlagResponsResultat.GODKJENT,
            begrunnelse="BH bekrefter at dette er en endringsordre iht. §31.1"
        )
    ),

    # Men BH godkjenner kun delvis vederlag (uenig om påslag)
    ResponsEvent(
        event_id="evt-305",
        sak_id="SAK-003",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_VEDERLAG,
        spor=SporType.VEDERLAG,
        refererer_til_event_id="evt-303",
        data=VederlagResponsData(
            krav_fremmet_i_tide=True,
            vederlagsmetode=VederlagsMetode.TILBUD,
            beregnings_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
            godkjent_belop=75000,
            begrunnelse_beregning=(
                "BH godkjenner grunnkostnad (60000 NOK) + 25% påslag (15000 NOK) = 75000 NOK. "
                "TEs krav på 40% påslag anses som urimelig."
            )
        )
    ),
]


# ============================================================
# MOCK SCENARIO 4: Sent varsel (prekludert krav)
# ============================================================

MOCK_EVENTS_SCENARIO_4 = [
    SakOpprettetEvent(
        event_id="evt-401",
        sak_id="SAK-004",
        sakstittel="Sent varsel - Preklusjon",
        aktor="Tom Larsen",
        aktor_rolle="TE",
        prosjekt_id="PROJ-2025-004",
    ),

    GrunnlagEvent(
        event_id="evt-402",
        sak_id="SAK-004",
        aktor="Tom Larsen",
        aktor_rolle="TE",
        event_type=EventType.GRUNNLAG_OPPRETTET,
        data=GrunnlagData(
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse="Oppdaget mangel i oktober, men varsel først i februar",
            dato_oppdaget="2024-10-15",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-02-20",  # 4 måneder sent!
                metode=["epost"]
            ),
        )
    ),

    VederlagEvent(
        event_id="evt-403",
        sak_id="SAK-004",
        aktor="Tom Larsen",
        aktor_rolle="TE",
        event_type=EventType.VEDERLAG_KRAV_SENDT,
        versjon=1,
        data=VederlagData(
            krav_belop=80000,
            metode=VederlagsMetode.REGNING,
            begrunnelse="Ekstra arbeid",
            krever_regningsarbeid=True,
            regningsarbeid_varsel=VarselInfo(
                dato_sendt="2025-02-20",
                metode=["epost"]
            ),
        )
    ),

    # BH avviser grunnlag på grunn av sent varsel
    ResponsEvent(
        event_id="evt-404",
        sak_id="SAK-004",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_GRUNNLAG,
        spor=SporType.GRUNNLAG,
        refererer_til_event_id="evt-402",
        data=GrunnlagResponsData(
            resultat=GrunnlagResponsResultat.AVVIST_FOR_SENT,
            begrunnelse=(
                "Varselet kom 4 måneder for sent. "
                "TE oppdaget forholdet i oktober 2024, men varslet først i februar 2025. "
                "Dette er ugrunnet opphold, og kravet tapes ved preklusjon."
            ),
            varsel_for_sent=True,
            varsel_begrunnelse="4 måneders forsinkelse fra oppdagelse til varsel er ugrunnet opphold"
        )
    ),

    # BH avviser også vederlag (prekludert)
    ResponsEvent(
        event_id="evt-405",
        sak_id="SAK-004",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_VEDERLAG,
        spor=SporType.VEDERLAG,
        refererer_til_event_id="evt-403",
        data=VederlagResponsData(
            krav_fremmet_i_tide=False,  # For sent!
            begrunnelse_varsel="Varselet kom 4 måneder for sent, kravet er prekludert",
            beregnings_resultat=VederlagBeregningResultat.AVSLATT_TOTALT,
            begrunnelse_beregning="Kravet avslås totalt på grunn av preklusjon"
        )
    ),
]


# Export all scenarios
ALL_MOCK_SCENARIOS = {
    "scenario_1_approved": MOCK_EVENTS_SCENARIO_1,
    "scenario_2_subsidiary": MOCK_EVENTS_SCENARIO_2,
    "scenario_3_partial": MOCK_EVENTS_SCENARIO_3,
    "scenario_4_precluded": MOCK_EVENTS_SCENARIO_4,
}
