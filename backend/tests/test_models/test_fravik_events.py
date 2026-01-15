"""
Tests for Fravik event models.

Tests event creation, validation, and parsing.
"""
import pytest
from datetime import datetime, timezone
from uuid import uuid4

from models.fravik_events import (
    FravikEventType,
    FravikStatus,
    FravikBeslutning,
    FravikRolle,
    MaskinType,
    MaskinData,
    SoknadOpprettetData,
    SoknadOppdatertData,
    MaskinVurderingData,
    BOIVurderingData,
    PLVurderingData,
    ArbeidsgruppeVurderingData,
    EierBeslutningData,
    SoknadOpprettetEvent,
    SoknadOppdatertEvent,
    SoknadSendtInnEvent,
    SoknadTrukketEvent,
    MaskinLagtTilEvent,
    MaskinFjernetEvent,
    BOIVurderingEvent,
    BOIReturnertevent,
    PLVurderingEvent,
    ArbeidsgruppeVurderingEvent,
    EierGodkjentEvent,
    EierAvslattEvent,
    EierDelvisGodkjentEvent,
    parse_fravik_event,
)


# ============ ENUM TESTS ============

class TestEnums:
    """Test Fravik enums."""

    def test_fravik_event_types(self):
        """Test all event types are defined."""
        assert FravikEventType.SOKNAD_OPPRETTET.value == "fravik_soknad_opprettet"
        assert FravikEventType.BOI_VURDERING.value == "fravik_boi_vurdering"
        assert FravikEventType.EIER_GODKJENT.value == "fravik_eier_godkjent"

    def test_fravik_status_values(self):
        """Test status enum values."""
        assert FravikStatus.UTKAST.value == "utkast"
        assert FravikStatus.GODKJENT.value == "godkjent"
        assert FravikStatus.AVSLATT.value == "avslatt"

    def test_fravik_roller(self):
        """Test rolle enum values."""
        assert FravikRolle.SOKER.value == "SOKER"
        assert FravikRolle.BOI.value == "BOI"
        assert FravikRolle.PL.value == "PL"
        assert FravikRolle.ARBEIDSGRUPPE.value == "ARBEIDSGRUPPE"
        assert FravikRolle.EIER.value == "EIER"


# ============ DATA MODEL TESTS ============

class TestMaskinData:
    """Tests for MaskinData model."""

    def test_maskin_data_basic(self):
        """Test basic MaskinData creation."""
        data = MaskinData(
            maskin_type=MaskinType.GRAVEMASKIN,
            start_dato="2025-01-15",
            slutt_dato="2025-03-15",
            begrunnelse="Ingen tilgjengelige elektriske gravemaskiner",
        )
        assert data.maskin_type == MaskinType.GRAVEMASKIN
        assert data.start_dato == "2025-01-15"
        assert data.maskin_id is not None  # Auto-generated

    def test_maskin_data_with_optional_fields(self):
        """Test MaskinData with all optional fields."""
        data = MaskinData(
            maskin_type=MaskinType.ANNET,
            annet_type="Trommel",
            registreringsnummer="AB12345",
            start_dato="2025-01-15",
            slutt_dato="2025-03-15",
            begrunnelse="Spesialutstyr",
            alternativer_vurdert="Ingen alternativer funnet",
            markedsundersokelse=True,
            undersøkte_leverandorer="Firma A, Firma B",
            erstatningsmaskin="Diesel-maskin",
            erstatningsdrivstoff="HVO100",
            arbeidsbeskrivelse="Komprimering av grunn",
        )
        assert data.annet_type == "Trommel"
        assert data.markedsundersokelse is True

    def test_maskin_data_begrunnelse_required(self):
        """Test that begrunnelse is required."""
        with pytest.raises(ValueError):
            MaskinData(
                maskin_type=MaskinType.GRAVEMASKIN,
                start_dato="2025-01-15",
                slutt_dato="2025-03-15",
                begrunnelse="",  # Empty string should fail
            )


class TestSoknadOpprettetData:
    """Tests for SoknadOpprettetData model."""

    def test_soknad_opprettet_data_basic(self):
        """Test basic SoknadOpprettetData creation."""
        data = SoknadOpprettetData(
            prosjekt_id="PROJ-001",
            prosjekt_navn="Test Prosjekt",
            soker_navn="Ola Nordmann",
            soknad_type="machine",
        )
        assert data.prosjekt_id == "PROJ-001"
        assert data.soknad_type == "machine"
        assert data.er_haste is False  # Default

    def test_soknad_opprettet_data_haste(self):
        """Test SoknadOpprettetData with haste."""
        data = SoknadOpprettetData(
            prosjekt_id="PROJ-001",
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
            soknad_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_id="PROJ-001",
                prosjekt_navn="Test Prosjekt",
                soker_navn="Ola Nordmann",
                soknad_type="machine",
            ),
        )
        assert event.event_type == FravikEventType.SOKNAD_OPPRETTET
        assert event.soknad_id == "FRAVIK-001"
        assert event.event_id is not None
        assert event.tidsstempel is not None

    def test_event_cloudevents_compatibility(self):
        """Test CloudEvents mixin compatibility."""
        event = SoknadOpprettetEvent(
            soknad_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_id="PROJ-001",
                prosjekt_navn="Test Prosjekt",
                soker_navn="Ola Nordmann",
                soknad_type="machine",
            ),
        )
        # sak_id property should map to soknad_id
        assert event.sak_id == "FRAVIK-001"


class TestMaskinLagtTilEvent:
    """Tests for MaskinLagtTilEvent."""

    def test_maskin_event_creation(self):
        """Test creating MaskinLagtTilEvent."""
        maskin_data = MaskinData(
            maskin_type=MaskinType.HJULLASTER,
            start_dato="2025-02-01",
            slutt_dato="2025-04-01",
            begrunnelse="Ingen elektrisk alternativ",
        )
        event = MaskinLagtTilEvent(
            soknad_id="FRAVIK-001",
            aktor="Ola Nordmann",
            aktor_rolle=FravikRolle.SOKER,
            data=maskin_data,
        )
        assert event.event_type == FravikEventType.MASKIN_LAGT_TIL
        assert event.data.maskin_type == MaskinType.HJULLASTER


class TestBOIVurderingEvent:
    """Tests for BOIVurderingEvent."""

    def test_boi_vurdering_godkjent(self):
        """Test BOI vurdering with godkjenning."""
        event = BOIVurderingEvent(
            soknad_id="FRAVIK-001",
            aktor="BOI Rådgiver",
            aktor_rolle=FravikRolle.BOI,
            data=BOIVurderingData(
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
        assert event.event_type == FravikEventType.BOI_VURDERING
        assert event.data.dokumentasjon_tilstrekkelig is True


class TestArbeidsgruppeVurderingEvent:
    """Tests for ArbeidsgruppeVurderingEvent."""

    def test_arbeidsgruppe_vurdering(self):
        """Test arbeidsgruppe vurdering."""
        event = ArbeidsgruppeVurderingEvent(
            soknad_id="FRAVIK-001",
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
            soknad_id="FRAVIK-001",
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
            soknad_id="FRAVIK-001",
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
            soknad_id="FRAVIK-001",
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
            "soknad_id": "FRAVIK-001",
            "aktor": "Test",
            "aktor_rolle": "SOKER",
            "data": {
                "prosjekt_id": "PROJ-001",
                "prosjekt_navn": "Test",
                "soker_navn": "Test Person",
                "soknad_type": "machine",
            },
        }
        event = parse_fravik_event(data)
        assert isinstance(event, SoknadOpprettetEvent)
        assert event.soknad_id == "FRAVIK-001"

    def test_parse_boi_vurdering(self):
        """Test parsing BOI_VURDERING event."""
        data = {
            "event_type": "fravik_boi_vurdering",
            "soknad_id": "FRAVIK-001",
            "aktor": "BOI",
            "aktor_rolle": "BOI",
            "data": {
                "dokumentasjon_tilstrekkelig": True,
                "maskin_vurderinger": [],
                "samlet_anbefaling": "godkjent",
            },
        }
        event = parse_fravik_event(data)
        assert isinstance(event, BOIVurderingEvent)

    def test_parse_unknown_event_type(self):
        """Test parsing unknown event type raises error."""
        data = {
            "event_type": "unknown_event",
            "soknad_id": "FRAVIK-001",
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
            soknad_id="FRAVIK-001",
            aktor="Test",
            aktor_rolle=FravikRolle.SOKER,
            data=SoknadOpprettetData(
                prosjekt_id="PROJ-001",
                prosjekt_navn="Test",
                soker_navn="Test",
                soknad_type="machine",
            ),
        )
        json_data = event.model_dump(mode="json")

        assert json_data["soknad_id"] == "FRAVIK-001"
        assert json_data["event_type"] == "fravik_soknad_opprettet"
        assert "event_id" in json_data
        assert "tidsstempel" in json_data

    def test_roundtrip_serialization(self):
        """Test event roundtrip (serialize + parse)."""
        original = MaskinLagtTilEvent(
            soknad_id="FRAVIK-001",
            aktor="Test",
            aktor_rolle=FravikRolle.SOKER,
            data=MaskinData(
                maskin_type=MaskinType.LIFT,
                start_dato="2025-01-01",
                slutt_dato="2025-02-01",
                begrunnelse="Test",
            ),
        )
        json_data = original.model_dump(mode="json")
        parsed = parse_fravik_event(json_data)

        assert parsed.soknad_id == original.soknad_id
        assert parsed.data.maskin_type == original.data.maskin_type
