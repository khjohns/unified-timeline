"""
Tests for Fravik event models.

Tests event creation, validation, and parsing.
"""

import pytest

from models.fravik_events import (
    ArbeidsgruppeVurderingData,
    ArbeidsgruppeVurderingEvent,
    Arbeidskategori,
    Bruksintensitet,
    Drivstoff,
    EierAvslattEvent,
    EierBeslutningData,
    EierDelvisGodkjentEvent,
    EierGodkjentEvent,
    FravikBeslutning,
    FravikEventType,
    FravikGrunn,
    FravikRolle,
    FravikStatus,
    MaskinData,
    MaskinLagtTilEvent,
    MaskinType,
    MaskinVekt,
    MaskinVurderingData,
    MiljoVurderingData,
    MiljoVurderingEvent,
    SoknadOpprettetData,
    SoknadOpprettetEvent,
    parse_fravik_event,
)

# ============ ENUM TESTS ============


class TestEnums:
    """Test Fravik enums."""

    def test_fravik_event_types(self):
        """Test all event types are defined."""
        assert FravikEventType.SOKNAD_OPPRETTET.value == "fravik_soknad_opprettet"
        assert FravikEventType.MILJO_VURDERING.value == "fravik_miljo_vurdering"
        assert FravikEventType.EIER_GODKJENT.value == "fravik_eier_godkjent"

    def test_fravik_status_values(self):
        """Test status enum values."""
        assert FravikStatus.UTKAST.value == "utkast"
        assert FravikStatus.GODKJENT.value == "godkjent"
        assert FravikStatus.AVSLATT.value == "avslatt"

    def test_fravik_roller(self):
        """Test rolle enum values."""
        assert FravikRolle.SOKER.value == "SOKER"
        assert FravikRolle.MILJO.value == "MILJO"
        assert FravikRolle.PL.value == "PL"
        assert FravikRolle.ARBEIDSGRUPPE.value == "ARBEIDSGRUPPE"
        assert FravikRolle.EIER.value == "EIER"


# ============ DATA MODEL TESTS ============


class TestMaskinData:
    """Tests for MaskinData model."""

    def test_maskin_data_basic(self):
        """Test basic MaskinData creation with all required fields."""
        data = MaskinData(
            maskin_type=MaskinType.GRAVEMASKIN,
            vekt=MaskinVekt.MEDIUM,
            start_dato="2025-01-15",
            slutt_dato="2025-03-15",
            grunner=[FravikGrunn.MARKEDSMANGEL],
            begrunnelse="Ingen tilgjengelige elektriske gravemaskiner",
            alternativer_vurdert="Undersøkt flere leverandører uten resultat",
            erstatningsmaskin="CAT 320",
            erstatningsdrivstoff=Drivstoff.HVO100,
            arbeidsbeskrivelse="Gravearbeid for fundament",
            arbeidskategori=Arbeidskategori.GRAVING,
            bruksintensitet=Bruksintensitet.NORMAL,
        )
        assert data.maskin_type == MaskinType.GRAVEMASKIN
        assert data.start_dato == "2025-01-15"
        assert data.maskin_id is not None  # Auto-generated
        assert FravikGrunn.MARKEDSMANGEL in data.grunner
        assert data.erstatningsdrivstoff == Drivstoff.HVO100

    def test_maskin_data_with_optional_fields(self):
        """Test MaskinData with all optional fields."""
        data = MaskinData(
            maskin_type=MaskinType.ANNET,
            annet_type="Trommel",
            vekt=MaskinVekt.STOR,
            registreringsnummer="AB12345",
            start_dato="2025-01-15",
            slutt_dato="2025-03-15",
            grunner=[FravikGrunn.TEKNISKE_BEGRENSNINGER, FravikGrunn.HMS_KRAV],
            begrunnelse="Spesialutstyr",
            alternativer_vurdert="Ingen alternativer funnet",
            markedsundersokelse=True,
            undersøkte_leverandorer="Firma A, Firma B",
            erstatningsmaskin="Diesel-maskin",
            erstatningsdrivstoff=Drivstoff.DIESEL,
            arbeidsbeskrivelse="Komprimering av grunn",
            arbeidskategori=Arbeidskategori.ASFALT_KOMPRIMERING,
            bruksintensitet=Bruksintensitet.INTENSIV,
        )
        assert data.annet_type == "Trommel"
        assert data.markedsundersokelse is True
        assert len(data.grunner) == 2
        assert data.erstatningsdrivstoff == Drivstoff.DIESEL

    def test_maskin_data_begrunnelse_required(self):
        """Test that begrunnelse is required."""
        with pytest.raises(ValueError):
            MaskinData(
                maskin_type=MaskinType.GRAVEMASKIN,
                vekt=MaskinVekt.MEDIUM,
                start_dato="2025-01-15",
                slutt_dato="2025-03-15",
                grunner=[FravikGrunn.MARKEDSMANGEL],
                begrunnelse="",  # Empty string should fail
                alternativer_vurdert="Undersøkt alternativer",
                erstatningsmaskin="CAT 320",
                erstatningsdrivstoff=Drivstoff.HVO100,
                arbeidsbeskrivelse="Gravearbeid",
                arbeidskategori=Arbeidskategori.GRAVING,
                bruksintensitet=Bruksintensitet.NORMAL,
            )

    def test_maskin_data_grunner_required(self):
        """Test that at least one grunn is required."""
        with pytest.raises(ValueError):
            MaskinData(
                maskin_type=MaskinType.GRAVEMASKIN,
                vekt=MaskinVekt.MEDIUM,
                start_dato="2025-01-15",
                slutt_dato="2025-03-15",
                grunner=[],  # Empty list should fail
                begrunnelse="Test begrunnelse med nok tegn",
                alternativer_vurdert="Undersøkt alternativer",
                erstatningsmaskin="CAT 320",
                erstatningsdrivstoff=Drivstoff.HVO100,
                arbeidsbeskrivelse="Gravearbeid",
                arbeidskategori=Arbeidskategori.GRAVING,
                bruksintensitet=Bruksintensitet.NORMAL,
            )


class TestSoknadOpprettetData:
    """Tests for SoknadOpprettetData model."""

    def test_soknad_opprettet_data_basic(self):
        """Test basic SoknadOpprettetData creation."""
        data = SoknadOpprettetData(
            prosjekt_nummer="PROJ-001",
            prosjekt_navn="Test Prosjekt",
            soker_navn="Ola Nordmann",
            soknad_type="machine",
        )
        assert data.prosjekt_nummer == "PROJ-001"
        assert data.soknad_type == "machine"
        assert data.er_haste is False  # Default

    def test_soknad_opprettet_data_haste(self):
        """Test SoknadOpprettetData with haste."""
        data = SoknadOpprettetData(
            prosjekt_nummer="PROJ-001",
            prosjekt_navn="Test Prosjekt",
            soker_navn="Ola Nordmann",
            soknad_type="machine",
            er_haste=True,
            haste_begrunnelse="Kritisk prosjektfrist",
        )
        assert data.er_haste is True
        assert data.haste_begrunnelse == "Kritisk prosjektfrist"


class TestEierBeslutningData:
    """Tests for EierBeslutningData validation."""

    def test_eier_beslutning_folger_arbeidsgruppen(self):
        """Test EierBeslutningData when following working group."""
        data = EierBeslutningData(
            folger_arbeidsgruppen=True,
            beslutning=FravikBeslutning.GODKJENT,
        )
        assert data.folger_arbeidsgruppen is True

    def test_eier_beslutning_avviker_krever_begrunnelse(self):
        """Test that begrunnelse is required when deviating from group."""
        with pytest.raises(ValueError, match="Begrunnelse er påkrevd"):
            EierBeslutningData(
                folger_arbeidsgruppen=False,
                beslutning=FravikBeslutning.AVSLATT,
                # Missing begrunnelse!
            )

    def test_eier_beslutning_avviker_med_begrunnelse(self):
        """Test EierBeslutningData when deviating with begrunnelse."""
        data = EierBeslutningData(
            folger_arbeidsgruppen=False,
            beslutning=FravikBeslutning.AVSLATT,
            begrunnelse="Prosjektet har ikke tilstrekkelig budsjett",
        )
        assert data.begrunnelse is not None


# ============ EVENT TESTS ============


class TestSoknadOpprettetEvent:
    """Tests for SoknadOpprettetEvent."""

    def test_event_creation(self):
        """Test creating SoknadOpprettetEvent."""
        event = SoknadOpprettetEvent(
            sak_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_nummer="PROJ-001",
                prosjekt_navn="Test Prosjekt",
                soker_navn="Ola Nordmann",
                soknad_type="machine",
            ),
        )
        assert event.event_type == FravikEventType.SOKNAD_OPPRETTET
        assert event.sak_id == "FRAVIK-001"
        assert event.event_id is not None
        assert event.tidsstempel is not None

    def test_event_cloudevents_compatibility(self):
        """Test CloudEvents mixin compatibility."""
        event = SoknadOpprettetEvent(
            sak_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_nummer="PROJ-001",
                prosjekt_navn="Test Prosjekt",
                soker_navn="Ola Nordmann",
                soknad_type="machine",
            ),
        )
        assert event.sak_id == "FRAVIK-001"


class TestMaskinLagtTilEvent:
    """Tests for MaskinLagtTilEvent."""

    def test_maskin_event_creation(self):
        """Test creating MaskinLagtTilEvent."""
        maskin_data = MaskinData(
            maskin_type=MaskinType.HJULLASTER,
            vekt=MaskinVekt.STOR,
            start_dato="2025-02-01",
            slutt_dato="2025-04-01",
            grunner=[FravikGrunn.LEVERINGSTID],
            begrunnelse="Ingen elektrisk alternativ tilgjengelig",
            alternativer_vurdert="Sjekket med flere leverandører",
            erstatningsmaskin="Volvo L90",
            erstatningsdrivstoff=Drivstoff.ANNET_BIODRIVSTOFF,
            arbeidsbeskrivelse="Lasting og transport av materialer",
            arbeidskategori=Arbeidskategori.LASTING,
            bruksintensitet=Bruksintensitet.NORMAL,
        )
        event = MaskinLagtTilEvent(
            sak_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=maskin_data,
        )
        assert event.event_type == FravikEventType.MASKIN_LAGT_TIL
        assert event.data.maskin_type == MaskinType.HJULLASTER
        assert event.data.erstatningsdrivstoff == Drivstoff.ANNET_BIODRIVSTOFF


class TestMiljoVurderingEvent:
    """Tests for MiljoVurderingEvent."""

    def test_miljo_vurdering_godkjent(self):
        """Test miljø vurdering with godkjenning."""
        event = MiljoVurderingEvent(
            sak_id="FRAVIK-001",
            aktor="Miljørådgiver",
            aktor_rolle=FravikRolle.MILJO,
            data=MiljoVurderingData(
                dokumentasjon_tilstrekkelig=True,
                maskin_vurderinger=[
                    MaskinVurderingData(
                        maskin_id="MASKIN-001",
                        beslutning=FravikBeslutning.GODKJENT,
                        kommentar="OK",
                    )
                ],
                samlet_anbefaling=FravikBeslutning.GODKJENT,
            ),
        )
        assert event.event_type == FravikEventType.MILJO_VURDERING
        assert event.data.dokumentasjon_tilstrekkelig is True


class TestArbeidsgruppeVurderingEvent:
    """Tests for ArbeidsgruppeVurderingEvent."""

    def test_arbeidsgruppe_vurdering(self):
        """Test arbeidsgruppe vurdering."""
        event = ArbeidsgruppeVurderingEvent(
            sak_id="FRAVIK-001",
            aktor="Arbeidsgruppe",
            aktor_rolle=FravikRolle.ARBEIDSGRUPPE,
            data=ArbeidsgruppeVurderingData(
                maskin_vurderinger=[
                    MaskinVurderingData(
                        maskin_id="MASKIN-001",
                        beslutning=FravikBeslutning.GODKJENT,
                        vilkar=["Må bruke HVO100"],
                    )
                ],
                samlet_innstilling=FravikBeslutning.GODKJENT,
                deltakere=["Person A", "Person B"],
            ),
        )
        assert event.data.samlet_innstilling == FravikBeslutning.GODKJENT
        assert len(event.data.deltakere) == 2


class TestEierEvents:
    """Tests for eier beslutning events."""

    def test_eier_godkjent(self):
        """Test EierGodkjentEvent."""
        event = EierGodkjentEvent(
            sak_id="FRAVIK-001",
            aktor="Prosjekteier",
            aktor_rolle=FravikRolle.EIER,
            data=EierBeslutningData(
                folger_arbeidsgruppen=True,
                beslutning=FravikBeslutning.GODKJENT,
            ),
        )
        assert event.event_type == FravikEventType.EIER_GODKJENT

    def test_eier_avslatt(self):
        """Test EierAvslattEvent."""
        event = EierAvslattEvent(
            sak_id="FRAVIK-001",
            aktor="Prosjekteier",
            aktor_rolle=FravikRolle.EIER,
            data=EierBeslutningData(
                folger_arbeidsgruppen=False,
                beslutning=FravikBeslutning.AVSLATT,
                begrunnelse="Budsjett ikke tilstrekkelig",
            ),
        )
        assert event.event_type == FravikEventType.EIER_AVSLATT

    def test_eier_delvis_godkjent(self):
        """Test EierDelvisGodkjentEvent."""
        event = EierDelvisGodkjentEvent(
            sak_id="FRAVIK-001",
            aktor="Prosjekteier",
            aktor_rolle=FravikRolle.EIER,
            data=EierBeslutningData(
                folger_arbeidsgruppen=True,
                beslutning=FravikBeslutning.DELVIS_GODKJENT,
                maskin_beslutninger=[
                    MaskinVurderingData(
                        maskin_id="MASKIN-001",
                        beslutning=FravikBeslutning.GODKJENT,
                    ),
                    MaskinVurderingData(
                        maskin_id="MASKIN-002",
                        beslutning=FravikBeslutning.AVSLATT,
                        kommentar="Alternativ finnes",
                    ),
                ],
            ),
        )
        assert event.event_type == FravikEventType.EIER_DELVIS_GODKJENT


# ============ PARSE TESTS ============


class TestParseFravikEvent:
    """Tests for parse_fravik_event helper."""

    def test_parse_soknad_opprettet(self):
        """Test parsing SOKNAD_OPPRETTET event."""
        data = {
            "event_type": "fravik_soknad_opprettet",
            "sak_id": "FRAVIK-001",
            "aktor": "Test",
            "aktor_rolle": "SOKER",
            "data": {
                "prosjekt_nummer": "PROJ-001",
                "prosjekt_navn": "Test",
                "soker_navn": "Test Person",
                "soknad_type": "machine",
            },
        }
        event = parse_fravik_event(data)
        assert isinstance(event, SoknadOpprettetEvent)
        assert event.sak_id == "FRAVIK-001"

    def test_parse_miljo_vurdering(self):
        """Test parsing MILJO_VURDERING event."""
        data = {
            "event_type": "fravik_miljo_vurdering",
            "sak_id": "FRAVIK-001",
            "aktor": "Miljørådgiver",
            "aktor_rolle": "MILJO",
            "data": {
                "dokumentasjon_tilstrekkelig": True,
                "maskin_vurderinger": [],
                "samlet_anbefaling": "godkjent",
            },
        }
        event = parse_fravik_event(data)
        assert isinstance(event, MiljoVurderingEvent)

    def test_parse_unknown_event_type(self):
        """Test parsing unknown event type raises error."""
        data = {
            "event_type": "unknown_event",
            "sak_id": "FRAVIK-001",
            "aktor": "Test",
            "aktor_rolle": "SOKER",
        }
        with pytest.raises(ValueError, match="Ukjent event_type"):
            parse_fravik_event(data)


# ============ SERIALIZATION TESTS ============


class TestEventSerialization:
    """Tests for event serialization."""

    def test_event_to_json(self):
        """Test event serialization to JSON."""
        event = SoknadOpprettetEvent(
            sak_id="FRAVIK-001",
            aktor="Test",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_nummer="PROJ-001",
                prosjekt_navn="Test",
                soker_navn="Test",
                soknad_type="machine",
            ),
        )
        json_data = event.model_dump(mode="json")

        assert json_data["sak_id"] == "FRAVIK-001"
        assert json_data["event_type"] == "fravik_soknad_opprettet"
        assert "event_id" in json_data
        assert "tidsstempel" in json_data

    def test_roundtrip_serialization(self):
        """Test event roundtrip (serialize + parse)."""
        original = MaskinLagtTilEvent(
            sak_id="FRAVIK-001",
            aktor="Test",
            aktor_rolle=FravikRolle.SOKER,
            data=MaskinData(
                maskin_type=MaskinType.LIFT,
                vekt=MaskinVekt.MEDIUM,
                start_dato="2025-01-01",
                slutt_dato="2025-02-01",
                grunner=[FravikGrunn.ANNET],
                begrunnelse="Test begrunnelse for fravik",
                alternativer_vurdert="Ingen tilgjengelige alternativer",
                erstatningsmaskin="JLG 450",
                erstatningsdrivstoff=Drivstoff.HVO100,
                arbeidsbeskrivelse="Arbeid i høyden",
                arbeidskategori=Arbeidskategori.LOFTING,
                bruksintensitet=Bruksintensitet.SPORADISK,
            ),
        )
        json_data = original.model_dump(mode="json")
        parsed = parse_fravik_event(json_data)

        assert parsed.sak_id == original.sak_id
        assert parsed.data.maskin_type == original.data.maskin_type
        assert parsed.data.erstatningsdrivstoff == original.data.erstatningsdrivstoff
