"""
Comprehensive unit tests for event models.

Tests VarselInfo, GrunnlagData, VederlagData, FristData, and all event types.
Ensures that validators work correctly and that the Port model logic is sound.
"""
import pytest
from datetime import datetime
from models.events import (
    VarselInfo,
    GrunnlagData,
    GrunnlagEvent,
    VederlagData,
    VederlagEvent,
    FristData,
    FristEvent,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
    ResponsEvent,
    SakOpprettetEvent,
    EventType,
    SporType,
    VederlagsMetode,
    FristVarselType,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
)


# ============ VARSELINFO TESTS ============

def test_varselinfo_structure():
    """Test VarselInfo with different methods"""
    varsel = VarselInfo(
        dato_sendt="2025-01-15",
        metode=["epost", "byggemote"]
    )
    assert varsel.dato_sendt == "2025-01-15"
    assert len(varsel.metode) == 2
    assert "epost" in varsel.metode
    assert "byggemote" in varsel.metode


def test_varselinfo_optional_fields():
    """Test that VarselInfo fields are optional"""
    varsel = VarselInfo()
    assert varsel.dato_sendt is None
    assert varsel.metode is None


def test_varselinfo_single_method():
    """Test VarselInfo with single method"""
    varsel = VarselInfo(
        dato_sendt="2025-01-10",
        metode=["telefon"]
    )
    assert len(varsel.metode) == 1
    assert varsel.metode[0] == "telefon"


# ============ GRUNNLAG TESTS ============

def test_grunnlag_data_basic():
    """Test basic GrunnlagData structure"""
    data = GrunnlagData(
        tittel="Test grunnlag",
        hovedkategori="forsinkelse_bh",
        underkategori="prosjektering",
        beskrivelse="Mangler i tegninger",
        dato_oppdaget="2025-01-10"
    )
    assert data.tittel == "Test grunnlag"
    assert data.hovedkategori == "forsinkelse_bh"
    assert data.underkategori == "prosjektering"
    assert data.beskrivelse == "Mangler i tegninger"
    assert data.dato_oppdaget == "2025-01-10"


def test_grunnlag_data_with_varsel():
    """Test GrunnlagData with grunnlag_varsel"""
    data = GrunnlagData(
        tittel="Test varsel",
        hovedkategori="forsinkelse_bh",
        underkategori="prosjektering",
        beskrivelse="Mangler i tegninger",
        dato_oppdaget="2025-01-10",
        grunnlag_varsel=VarselInfo(
            dato_sendt="2025-01-11",
            metode=["epost"]
        )
    )
    assert data.grunnlag_varsel is not None
    assert data.grunnlag_varsel.dato_sendt == "2025-01-11"
    assert data.grunnlag_varsel.metode == ["epost"]


def test_grunnlag_data_with_multiple_underkategorier():
    """Test GrunnlagData with list of underkategorier"""
    data = GrunnlagData(
        tittel="Multiple issues",
        hovedkategori="forsinkelse_bh",
        underkategori=["prosjektering", "arbeidsgrunnlag"],
        beskrivelse="Multiple issues",
        dato_oppdaget="2025-01-10"
    )
    assert isinstance(data.underkategori, list)
    assert len(data.underkategori) == 2


def test_grunnlag_event_creation():
    """Test creating a complete GrunnlagEvent"""
    event = GrunnlagEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=GrunnlagData(
            tittel="Test grunnlag event",
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse="Test beskrivelse",
            dato_oppdaget="2025-01-10",
            grunnlag_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["epost", "byggemote"]
            ),
            kontraktsreferanser=["NS8407 §25.2"],
            vedlegg_ids=["DOK-001"]
        )
    )

    assert event.sak_id == "SAK-001"
    assert event.aktor == "Ole Olsen"
    assert event.aktor_rolle == "TE"
    assert event.event_type == EventType.GRUNNLAG_OPPRETTET
    assert event.data.hovedkategori == "forsinkelse_bh"
    assert event.event_id is not None  # Auto-generated
    assert event.tidsstempel is not None  # Auto-generated


def test_grunnlag_event_invalid_type():
    """Test that invalid event_type for GrunnlagEvent raises error"""
    with pytest.raises(ValueError, match="Ugyldig event_type"):
        GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Ole Olsen",
            aktor_rolle="TE",
            event_type=EventType.VEDERLAG_KRAV_SENDT,  # Wrong type!
            data=GrunnlagData(
                tittel="Invalid type test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10"
            )
        )


# ============ VEDERLAG TESTS ============

def test_vederlag_data_basic():
    """Test basic VederlagData structure"""
    data = VederlagData(
        kostnads_overslag=50000,
        metode=VederlagsMetode.REGNINGSARBEID,
        begrunnelse="Ekstra arbeid"
    )
    assert data.kostnads_overslag == 50000
    assert data.metode == VederlagsMetode.REGNINGSARBEID
    assert data.begrunnelse == "Ekstra arbeid"


def test_vederlag_data_rigg_drift_varsel():
    """Test VederlagData with rigg/drift varsel"""
    from models.events import SaerskiltKrav, SaerskiltKravItem
    data = VederlagData(
        kostnads_overslag=50000,
        metode=VederlagsMetode.REGNINGSARBEID,
        begrunnelse="Ekstra rigg",
        saerskilt_krav=SaerskiltKrav(
            rigg_drift=SaerskiltKravItem(
                belop=15000,
                dato_klar_over="2025-01-12"
            )
        ),
        rigg_drift_varsel=VarselInfo(
            dato_sendt="2025-01-12",
            metode=["byggemote", "epost"]
        )
    )
    assert data.saerskilt_krav.rigg_drift is not None
    assert data.saerskilt_krav.rigg_drift.belop == 15000
    assert data.rigg_drift_varsel.dato_sendt == "2025-01-12"
    assert len(data.rigg_drift_varsel.metode) == 2


def test_vederlag_data_regningsarbeid_varsel():
    """Test VederlagData with regningsarbeid varsel"""
    data = VederlagData(
        kostnads_overslag=75000,
        metode=VederlagsMetode.REGNINGSARBEID,
        begrunnelse="Regningsarbeid",
        regningsarbeid_varsel=VarselInfo(
            dato_sendt="2025-01-11",
            metode=["byggemote"]
        )
    )
    assert data.metode == VederlagsMetode.REGNINGSARBEID
    assert data.regningsarbeid_varsel.dato_sendt == "2025-01-11"


def test_vederlag_data_produktivitetstap_varsel():
    """Test VederlagData with produktivitetstap varsel"""
    from models.events import SaerskiltKrav, SaerskiltKravItem
    data = VederlagData(
        kostnads_overslag=100000,
        metode=VederlagsMetode.REGNINGSARBEID,
        begrunnelse="Produktivitetstap",
        saerskilt_krav=SaerskiltKrav(
            produktivitet=SaerskiltKravItem(
                belop=30000,
                dato_klar_over="2025-01-15"
            )
        ),
        produktivitetstap_varsel=VarselInfo(
            dato_sendt="2025-01-15",
            metode=["epost"]
        )
    )
    assert data.saerskilt_krav.produktivitet is not None
    assert data.saerskilt_krav.produktivitet.belop == 30000
    assert data.produktivitetstap_varsel.dato_sendt == "2025-01-15"


def test_vederlag_data_justert_ep_varsel():
    """Test VederlagData with justert enhetspris varsel"""
    data = VederlagData(
        belop_direkte=80000,
        metode=VederlagsMetode.ENHETSPRISER,
        begrunnelse="Justerte EP",
        krever_justert_ep=True,
        justert_ep_varsel=VarselInfo(
            dato_sendt="2025-01-13",
            metode=["epost", "brev"]
        )
    )
    assert data.krever_justert_ep is True
    assert data.justert_ep_varsel.dato_sendt == "2025-01-13"


def test_vederlag_event_creation():
    """Test creating a complete VederlagEvent"""
    event = VederlagEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=VederlagData(
            kostnads_overslag=50000,
            metode=VederlagsMetode.REGNINGSARBEID,
            begrunnelse="Test",
            regningsarbeid_varsel=VarselInfo(
                dato_sendt="2025-01-11",
                metode=["byggemote"]
            )
        ),
        versjon=1
    )

    assert event.sak_id == "SAK-001"
    assert event.event_type == EventType.VEDERLAG_KRAV_SENDT
    assert event.versjon == 1
    assert event.data.kostnads_overslag == 50000


def test_vederlag_negative_amount_fails():
    """Test that negative kostnads_overslag raises error"""
    with pytest.raises(ValueError):
        VederlagData(
            kostnads_overslag=-1000,  # Negative!
            metode=VederlagsMetode.REGNINGSARBEID,
            begrunnelse="Test"
        )


# ============ FRIST TESTS ============

def test_frist_data_noytralt():
    """Test FristData with nøytralt varsel only"""
    data = FristData(
        varsel_type=FristVarselType.NOYTRALT,
        noytralt_varsel=VarselInfo(
            dato_sendt="2025-01-10",
            metode=["byggemote"]
        ),
        begrunnelse="Foreløpig varsel"
    )
    assert data.varsel_type == FristVarselType.NOYTRALT
    assert data.noytralt_varsel.dato_sendt == "2025-01-10"
    assert data.antall_dager is None  # Not required for nøytralt


def test_frist_data_spesifisert():
    """Test FristData with spesifisert varsel"""
    data = FristData(
        varsel_type=FristVarselType.SPESIFISERT,
        spesifisert_varsel=VarselInfo(
            dato_sendt="2025-01-20",
            metode=["epost", "brev"]
        ),
        antall_dager=14,
        begrunnelse="Spesifisert krav"
    )
    assert data.varsel_type == FristVarselType.SPESIFISERT
    assert data.spesifisert_varsel.dato_sendt == "2025-01-20"
    assert data.antall_dager == 14


def test_frist_data_begge():
    """Test FristData with both nøytralt and spesifisert varsel"""
    data = FristData(
        varsel_type=FristVarselType.BEGGE,
        noytralt_varsel=VarselInfo(
            dato_sendt="2025-01-10",
            metode=["byggemote"]
        ),
        spesifisert_varsel=VarselInfo(
            dato_sendt="2025-01-20",
            metode=["epost", "brev"]
        ),
        antall_dager=14,
        begrunnelse="Forsinkelse pga BH-prosjektering"
    )
    assert data.noytralt_varsel.metode == ["byggemote"]
    assert data.spesifisert_varsel.metode == ["epost", "brev"]
    assert data.antall_dager == 14


def test_frist_data_spesifisert_requires_antall_dager():
    """Test that spesifisert requires antall_dager"""
    with pytest.raises(ValueError, match="antall_dager må være satt"):
        FristData(
            varsel_type=FristVarselType.SPESIFISERT,
            spesifisert_varsel=VarselInfo(
                dato_sendt="2025-01-20",
                metode=["epost"]
            ),
            # Missing antall_dager!
            begrunnelse="Test"
        )


def test_frist_data_with_fremdriftshindring():
    """Test FristData with fremdriftshindring documentation"""
    data = FristData(
        varsel_type=FristVarselType.SPESIFISERT,
        spesifisert_varsel=VarselInfo(
            dato_sendt="2025-01-20",
            metode=["epost"]
        ),
        antall_dager=10,
        begrunnelse="Fremdriftshindring",
        fremdriftshindring_dokumentasjon="Se vedlagt fremdriftsplan",
        ny_sluttdato="2025-03-01",
        vedlegg_ids=["DOK-001", "DOK-002"]
    )
    assert data.fremdriftshindring_dokumentasjon is not None
    assert data.ny_sluttdato == "2025-03-01"
    assert len(data.vedlegg_ids) == 2


def test_frist_event_creation():
    """Test creating a complete FristEvent"""
    event = FristEvent(
        sak_id="SAK-001",
        aktor="Ole Olsen",
        aktor_rolle="TE",
        data=FristData(
            varsel_type=FristVarselType.BEGGE,
            noytralt_varsel=VarselInfo(
                dato_sendt="2025-01-10",
                metode=["byggemote"]
            ),
            spesifisert_varsel=VarselInfo(
                dato_sendt="2025-01-20",
                metode=["epost"]
            ),
            antall_dager=14,
            begrunnelse="Test"
        ),
        versjon=1
    )

    assert event.sak_id == "SAK-001"
    assert event.event_type == EventType.FRIST_KRAV_SENDT
    assert event.versjon == 1


# ============ RESPONS TESTS ============

def test_grunnlag_respons_data():
    """Test GrunnlagResponsData structure"""
    data = GrunnlagResponsData(
        resultat=GrunnlagResponsResultat.GODKJENT,
        begrunnelse="BH aksepterer ansvarsgrunnlaget"
    )
    assert data.resultat == GrunnlagResponsResultat.GODKJENT
    assert data.begrunnelse == "BH aksepterer ansvarsgrunnlaget"
    assert data.varsel_for_sent is False  # Default


def test_grunnlag_respons_with_varsel_vurdering():
    """Test GrunnlagResponsData with varsel timing assessment"""
    data = GrunnlagResponsData(
        resultat=GrunnlagResponsResultat.AVVIST_FOR_SENT,
        begrunnelse="Varselet kom for sent",
        varsel_for_sent=True,
        varsel_begrunnelse="Varselet ble sendt 3 måneder etter oppdagelse"
    )
    assert data.varsel_for_sent is True
    assert data.varsel_begrunnelse is not None


def test_vederlag_respons_data():
    """Test VederlagResponsData with Port model"""
    data = VederlagResponsData(
        krav_fremmet_i_tide=True,
        varsel_start_regning_ok=True,
        beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
        godkjent_belop=50000,
        begrunnelse_beregning="Enig om beløp"
    )
    assert data.krav_fremmet_i_tide is True
    assert data.beregnings_resultat == VederlagBeregningResultat.GODKJENT_FULLT
    assert data.godkjent_belop == 50000


def test_vederlag_respons_delvis_godkjent():
    """Test VederlagResponsData with partial approval"""
    data = VederlagResponsData(
        krav_fremmet_i_tide=True,
        beregnings_resultat=VederlagBeregningResultat.DELVIS_GODKJENT,
        godkjent_belop=30000,  # Less than claimed
        begrunnelse_beregning="Godkjenner timer, men ikke påslag"
    )
    assert data.beregnings_resultat == VederlagBeregningResultat.DELVIS_GODKJENT
    assert data.godkjent_belop == 30000


def test_frist_respons_data():
    """Test FristResponsData with Port model"""
    data = FristResponsData(
        noytralt_varsel_ok=True,
        spesifisert_krav_ok=True,
        vilkar_oppfylt=True,
        beregnings_resultat=FristBeregningResultat.GODKJENT_FULLT,
        godkjent_dager=14,
        ny_sluttdato="2025-03-01"
    )
    assert data.spesifisert_krav_ok is True
    assert data.vilkar_oppfylt is True
    assert data.beregnings_resultat == FristBeregningResultat.GODKJENT_FULLT
    assert data.godkjent_dager == 14


def test_frist_respons_har_bh_etterlyst_validator():
    """Test that validator catches illogical har_bh_etterlyst"""
    with pytest.raises(ValueError, match="kom i tide trenger ikke å etterlyses"):
        FristResponsData(
            spesifisert_krav_ok=True,  # Krav kom i tide
            har_bh_etterlyst=True,     # Men satt til True - logisk feil!
            vilkar_oppfylt=True,
            beregnings_resultat=FristBeregningResultat.GODKJENT_FULLT
        )


def test_frist_respons_etterlyst_allowed_when_late():
    """Test that har_bh_etterlyst is allowed when krav is late"""
    data = FristResponsData(
        spesifisert_krav_ok=False,  # Krav kom for sent
        har_bh_etterlyst=True,      # OK! BH etterlyst
        vilkar_oppfylt=True,
        beregnings_resultat=FristBeregningResultat.DELVIS_GODKJENT,
        godkjent_dager=10
    )
    assert data.har_bh_etterlyst is True


def test_respons_event_creation():
    """Test creating a ResponsEvent"""
    event = ResponsEvent(
        sak_id="SAK-001",
        aktor="BH Manager",
        aktor_rolle="BH",
        event_type=EventType.RESPONS_VEDERLAG,
        spor=SporType.VEDERLAG,
        refererer_til_event_id="original-vederlag-event-id",
        data=VederlagResponsData(
            krav_fremmet_i_tide=True,
            beregnings_resultat=VederlagBeregningResultat.GODKJENT_FULLT,
            godkjent_belop=50000,
            begrunnelse_beregning="OK"
        )
    )

    assert event.aktor_rolle == "BH"
    assert event.spor == SporType.VEDERLAG
    assert event.refererer_til_event_id is not None


# ============ SAK EVENTS ============

def test_sak_opprettet_event():
    """Test SakOpprettetEvent"""
    event = SakOpprettetEvent(
        sak_id="SAK-001",
        sakstittel="Test sak",
        aktor="System",
        aktor_rolle="TE",
        prosjekt_id="PROJ-001",
        catenda_topic_id="topic-guid-123"
    )

    assert event.event_type == EventType.SAK_OPPRETTET
    assert event.sakstittel == "Test sak"
    assert event.prosjekt_id == "PROJ-001"
    assert event.catenda_topic_id == "topic-guid-123"


# ============ SERIALIZATION TESTS ============

def test_event_serialization():
    """Test that events can be serialized to JSON"""
    event = GrunnlagEvent(
        sak_id="SAK-001",
        aktor="Test",
        aktor_rolle="TE",
        data=GrunnlagData(
            tittel="Serialization test",
            hovedkategori="forsinkelse_bh",
            underkategori="prosjektering",
            beskrivelse="Test",
            dato_oppdaget="2025-01-10"
        )
    )

    # Serialize to dict
    event_dict = event.model_dump(mode='json')

    assert event_dict['sak_id'] == "SAK-001"
    assert event_dict['event_type'] == "grunnlag_opprettet"
    assert 'event_id' in event_dict
    assert 'tidsstempel' in event_dict


def test_event_with_varsel_serialization():
    """Test event with VarselInfo serializes correctly"""
    event = VederlagEvent(
        sak_id="SAK-001",
        aktor="Test",
        aktor_rolle="TE",
        data=VederlagData(
            kostnads_overslag=50000,
            metode=VederlagsMetode.REGNINGSARBEID,
            begrunnelse="Test",
            rigg_drift_varsel=VarselInfo(
                dato_sendt="2025-01-15",
                metode=["epost", "byggemote"]
            )
        )
    )

    event_dict = event.model_dump(mode='json')

    assert event_dict['data']['rigg_drift_varsel']['dato_sendt'] == "2025-01-15"
    assert len(event_dict['data']['rigg_drift_varsel']['metode']) == 2
