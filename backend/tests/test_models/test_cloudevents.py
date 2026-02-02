"""
Unit tests for CloudEvents v1.0 support.

Tests CloudEventMixin functionality, including:
- CloudEvents attribute mapping (specversion, id, source, type, time, subject)
- to_cloudevent() export method
- from_cloudevent() import class method
- validate_cloudevent() validation function
- Extension attributes (actor, actorrole, referstoid)
"""

from datetime import datetime

import pytest

from models.cloudevents import (
    CLOUDEVENTS_NAMESPACE,
    CLOUDEVENTS_SPECVERSION,
    validate_cloudevent,
)
from models.events import (
    EventType,
    FristData,
    FristEvent,
    FristVarselType,
    GrunnlagData,
    GrunnlagEvent,
    SakOpprettetEvent,
    VarselInfo,
    VederlagData,
    VederlagEvent,
    VederlagsMetode,
)

# ============ CLOUDEVENT MIXIN ATTRIBUTE TESTS ============


class TestCloudEventMixinAttributes:
    """Test computed CloudEvents attributes on SakEvent subclasses."""

    def test_specversion_is_1_0(self):
        """Test that specversion is always '1.0'."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test beskrivelse",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.specversion == CLOUDEVENTS_SPECVERSION
        assert event.specversion == "1.0"

    def test_ce_id_maps_to_event_id(self):
        """Test that ce_id returns the event_id."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_id == event.event_id
        assert len(event.ce_id) > 0  # UUID should not be empty

    def test_ce_source_format(self):
        """Test ce_source URI format."""
        event = GrunnlagEvent(
            sak_id="KOE-2025-042",
            aktor="Test User",
            aktor_rolle="TE",
            prosjekt_id="P-2025-001",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_source == "/projects/P-2025-001/cases/KOE-2025-042"

    def test_ce_source_unknown_project(self):
        """Test ce_source with no prosjekt_id defaults to 'unknown'."""
        event = GrunnlagEvent(
            sak_id="KOE-2025-042",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_source == "/projects/unknown/cases/KOE-2025-042"

    def test_ce_type_has_namespace(self):
        """Test ce_type includes the no.oslo.koe namespace."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            event_type=EventType.GRUNNLAG_OPPRETTET,
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_type == f"{CLOUDEVENTS_NAMESPACE}.grunnlag_opprettet"
        assert event.ce_type == "no.oslo.koe.grunnlag_opprettet"

    def test_ce_time_is_iso8601(self):
        """Test ce_time is in ISO 8601 format with Z suffix."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        # Should end with Z
        assert event.ce_time.endswith("Z")
        # Should be parseable
        time_str = event.ce_time.replace("Z", "")
        parsed = datetime.fromisoformat(time_str)
        assert isinstance(parsed, datetime)

    def test_ce_subject_maps_to_sak_id(self):
        """Test ce_subject returns the sak_id."""
        event = GrunnlagEvent(
            sak_id="KOE-2025-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_subject == "KOE-2025-001"

    def test_ce_datacontenttype_is_json(self):
        """Test ce_datacontenttype is 'application/json'."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )
        assert event.ce_datacontenttype == "application/json"


# ============ TO_CLOUDEVENT TESTS ============


class TestToCloudEvent:
    """Test to_cloudevent() export method."""

    def test_grunnlag_to_cloudevent(self):
        """Test exporting GrunnlagEvent to CloudEvents format."""
        event = GrunnlagEvent(
            sak_id="KOE-2025-001",
            aktor="Ola Nordmann",
            aktor_rolle="TE",
            prosjekt_id="P-2025-001",
            data=GrunnlagData(
                tittel="Forsinket tegningsunderlag",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Tegninger ble levert 3 uker forsinket",
                dato_oppdaget="2025-12-15",
            ),
        )

        ce = event.to_cloudevent()

        # Required attributes
        assert ce["specversion"] == "1.0"
        assert ce["id"] == event.event_id
        assert ce["source"] == "/projects/P-2025-001/cases/KOE-2025-001"
        assert ce["type"] == "no.oslo.koe.grunnlag_opprettet"

        # Optional attributes
        assert "time" in ce
        assert ce["subject"] == "KOE-2025-001"
        assert ce["datacontenttype"] == "application/json"

        # Extension attributes
        assert ce["actor"] == "Ola Nordmann"
        assert ce["actorrole"] == "TE"

        # Data payload
        assert "data" in ce
        assert ce["data"]["tittel"] == "Forsinket tegningsunderlag"
        assert ce["data"]["hovedkategori"] == "forsinkelse_bh"

    def test_vederlag_to_cloudevent(self):
        """Test exporting VederlagEvent to CloudEvents format."""
        event = VederlagEvent(
            sak_id="KOE-2025-002",
            aktor="Per Hansen",
            aktor_rolle="TE",
            data=VederlagData(
                metode=VederlagsMetode.REGNINGSARBEID,
                kostnads_overslag=50000,
                begrunnelse="Ekstra arbeid pga endringer",
            ),
        )

        ce = event.to_cloudevent()

        assert ce["type"] == "no.oslo.koe.vederlag_krav_sendt"
        assert ce["data"]["metode"] == "REGNINGSARBEID"
        assert ce["data"]["kostnads_overslag"] == 50000

    def test_frist_to_cloudevent(self):
        """Test exporting FristEvent to CloudEvents format."""
        event = FristEvent(
            sak_id="KOE-2025-003",
            aktor="Anne Olsen",
            aktor_rolle="TE",
            data=FristData(
                varsel_type=FristVarselType.SPESIFISERT,
                antall_dager=14,
                begrunnelse="Forsinkelse pga manglende tegninger",
                spesifisert_varsel=VarselInfo(
                    dato_sendt="2025-01-20", metode=["epost"]
                ),
            ),
        )

        ce = event.to_cloudevent()

        assert ce["type"] == "no.oslo.koe.frist_krav_sendt"
        assert ce["data"]["antall_dager"] == 14
        assert ce["data"]["varsel_type"] == "spesifisert"

    def test_to_cloudevent_includes_referanse(self):
        """Test that refererer_til_event_id is included as referstoid."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test",
            aktor_rolle="TE",
            refererer_til_event_id="previous-event-uuid",
            data=GrunnlagData(
                tittel="Response",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = event.to_cloudevent()
        assert ce["referstoid"] == "previous-event-uuid"

    def test_to_cloudevent_includes_kommentar(self):
        """Test that kommentar is included as comment extension."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test",
            aktor_rolle="TE",
            kommentar="This is an important note",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = event.to_cloudevent()
        assert ce["comment"] == "This is an important note"

    def test_to_cloudevent_omits_none_values(self):
        """Test that None values are not included in the output."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test",
            aktor_rolle="TE",
            # No kommentar or refererer_til_event_id
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = event.to_cloudevent()
        assert "comment" not in ce
        assert "referstoid" not in ce


# ============ FROM_CLOUDEVENT TESTS ============


class TestFromCloudEvent:
    """Test from_cloudevent() import class method."""

    def test_grunnlag_from_cloudevent(self):
        """Test parsing CloudEvent back to GrunnlagEvent."""
        ce = {
            "specversion": "1.0",
            "id": "test-uuid-123",
            "source": "/projects/P-2025-001/cases/KOE-2025-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "time": "2025-12-20T10:30:00Z",
            "subject": "KOE-2025-001",
            "datacontenttype": "application/json",
            "actor": "Ola Nordmann",
            "actorrole": "TE",
            "data": {
                "tittel": "Forsinket tegningsunderlag",
                "hovedkategori": "forsinkelse_bh",
                "underkategori": "prosjektering",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-12-15",
            },
        }

        event = GrunnlagEvent.from_cloudevent(ce)

        assert event.event_id == "test-uuid-123"
        assert event.sak_id == "KOE-2025-001"
        assert event.aktor == "Ola Nordmann"
        assert event.aktor_rolle == "TE"
        assert event.event_type == "grunnlag_opprettet"
        assert event.prosjekt_id == "P-2025-001"
        assert event.data.tittel == "Forsinket tegningsunderlag"

    def test_from_cloudevent_extracts_prosjekt_id(self):
        """Test that prosjekt_id is extracted from source URI."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "source": "/projects/PROJ-ABC/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "subject": "SAK-001",
            "actor": "Test",
            "actorrole": "TE",
            "data": {
                "tittel": "Test",
                "hovedkategori": "test",
                "underkategori": "test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-10",
            },
        }

        event = GrunnlagEvent.from_cloudevent(ce)
        assert event.prosjekt_id == "PROJ-ABC"

    def test_from_cloudevent_ignores_unknown_prosjekt(self):
        """Test that 'unknown' prosjekt_id is not set."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "source": "/projects/unknown/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "subject": "SAK-001",
            "actor": "Test",
            "actorrole": "TE",
            "data": {
                "tittel": "Test",
                "hovedkategori": "test",
                "underkategori": "test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-10",
            },
        }

        event = GrunnlagEvent.from_cloudevent(ce)
        assert event.prosjekt_id is None

    def test_from_cloudevent_with_referstoid(self):
        """Test parsing CloudEvent with referstoid extension."""
        ce = {
            "specversion": "1.0",
            "id": "response-123",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_oppdatert",
            "subject": "SAK-001",
            "actor": "Test",
            "actorrole": "TE",
            "referstoid": "original-event-456",
            "data": {
                "tittel": "Updated",
                "hovedkategori": "test",
                "underkategori": "test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-10",
            },
        }

        event = GrunnlagEvent.from_cloudevent(ce)
        assert event.refererer_til_event_id == "original-event-456"

    def test_from_cloudevent_parses_time(self):
        """Test that time is parsed correctly."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
            "time": "2025-06-15T14:30:00Z",
            "subject": "SAK-001",
            "actor": "Test",
            "actorrole": "TE",
            "data": {
                "tittel": "Test",
                "hovedkategori": "test",
                "underkategori": "test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-10",
            },
        }

        event = GrunnlagEvent.from_cloudevent(ce)
        assert isinstance(event.tidsstempel, datetime)
        assert event.tidsstempel.year == 2025
        assert event.tidsstempel.month == 6
        assert event.tidsstempel.day == 15


# ============ ROUNDTRIP TESTS ============


class TestCloudEventRoundtrip:
    """Test that events can be exported and imported without data loss."""

    def test_grunnlag_roundtrip(self):
        """Test GrunnlagEvent roundtrip (to_cloudevent -> from_cloudevent)."""
        original = GrunnlagEvent(
            sak_id="KOE-2025-001",
            aktor="Ola Nordmann",
            aktor_rolle="TE",
            prosjekt_id="P-2025-001",
            kommentar="Important note",
            data=GrunnlagData(
                tittel="Test grunnlag",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Detaljert beskrivelse",
                dato_oppdaget="2025-12-15",
                kontraktsreferanser=["NS8407 §25.2"],
            ),
        )

        # Export to CloudEvent
        ce = original.to_cloudevent()

        # Import back
        restored = GrunnlagEvent.from_cloudevent(ce)

        # Verify key fields
        assert restored.event_id == original.event_id
        assert restored.sak_id == original.sak_id
        assert restored.aktor == original.aktor
        assert restored.aktor_rolle == original.aktor_rolle
        assert restored.prosjekt_id == original.prosjekt_id


# ============ VALIDATE_CLOUDEVENT TESTS ============


class TestValidateCloudEvent:
    """Test validate_cloudevent() function."""

    def test_valid_cloudevent(self):
        """Test that valid CloudEvent passes validation."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        assert validate_cloudevent(ce) is True

    def test_missing_specversion_fails(self):
        """Test that missing specversion raises error."""
        ce = {
            "id": "test-123",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        with pytest.raises(
            ValueError, match="Mangler påkrevd CloudEvents-felt: specversion"
        ):
            validate_cloudevent(ce)

    def test_missing_id_fails(self):
        """Test that missing id raises error."""
        ce = {
            "specversion": "1.0",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        with pytest.raises(ValueError, match="Mangler påkrevd CloudEvents-felt: id"):
            validate_cloudevent(ce)

    def test_missing_source_fails(self):
        """Test that missing source raises error."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        with pytest.raises(
            ValueError, match="Mangler påkrevd CloudEvents-felt: source"
        ):
            validate_cloudevent(ce)

    def test_missing_type_fails(self):
        """Test that missing type raises error."""
        ce = {
            "specversion": "1.0",
            "id": "test-123",
            "source": "/projects/P-001/cases/SAK-001",
        }
        with pytest.raises(ValueError, match="Mangler påkrevd CloudEvents-felt: type"):
            validate_cloudevent(ce)

    def test_wrong_specversion_fails(self):
        """Test that wrong specversion raises error."""
        ce = {
            "specversion": "0.3",
            "id": "test-123",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        with pytest.raises(ValueError, match="Ugyldig specversion"):
            validate_cloudevent(ce)

    def test_empty_id_fails(self):
        """Test that empty id raises error."""
        ce = {
            "specversion": "1.0",
            "id": "",
            "source": "/projects/P-001/cases/SAK-001",
            "type": "no.oslo.koe.grunnlag_opprettet",
        }
        with pytest.raises(ValueError, match="'id' kan ikke være tom"):
            validate_cloudevent(ce)


# ============ SERIALIZATION TESTS ============


class TestCloudEventSerialization:
    """Test that CloudEvents attributes are serialized correctly."""

    def test_event_serialization_includes_ce_attributes(self):
        """Test that model_dump includes CloudEvents computed fields."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test",
            aktor_rolle="TE",
            prosjekt_id="PROJ-001",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="test",
                underkategori="test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        data = event.model_dump(mode="json")

        # CloudEvents computed fields should be included
        assert data["specversion"] == "1.0"
        assert data["ce_id"] == event.event_id
        assert data["ce_source"] == "/projects/PROJ-001/cases/SAK-001"
        assert data["ce_type"] == "no.oslo.koe.grunnlag_opprettet"
        assert "ce_time" in data
        assert data["ce_subject"] == "SAK-001"
        assert data["ce_datacontenttype"] == "application/json"

    def test_sak_opprettet_cloudevents(self):
        """Test SakOpprettetEvent with CloudEvents attributes."""
        event = SakOpprettetEvent(
            sak_id="SAK-001",
            sakstittel="Test Sak",
            aktor="System",
            aktor_rolle="TE",
            prosjekt_id="PROJ-001",
        )

        ce = event.to_cloudevent()

        assert ce["type"] == "no.oslo.koe.sak_opprettet"
        assert ce["source"] == "/projects/PROJ-001/cases/SAK-001"
        assert ce["actor"] == "System"


# ============ EDGE CASE TESTS ============


class TestCloudEventEdgeCases:
    """Test edge cases and special scenarios."""

    def test_special_characters_in_sak_id(self):
        """Test handling of special characters in sak_id."""
        event = GrunnlagEvent(
            sak_id="KOE-2025/001-A",
            aktor="Test",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="test",
                underkategori="test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = event.to_cloudevent()
        assert "KOE-2025/001-A" in ce["source"]
        assert ce["subject"] == "KOE-2025/001-A"

    def test_event_with_all_extensions(self):
        """Test event with all possible extension attributes."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Full Extension Test",
            aktor_rolle="BH",
            prosjekt_id="PROJ-EXT",
            kommentar="Full extension test",
            refererer_til_event_id="ref-123",
            data=GrunnlagData(
                tittel="Full extensions",
                hovedkategori="test",
                underkategori="test",
                beskrivelse="Testing all extensions",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = event.to_cloudevent()

        # All extensions should be present
        assert ce["actor"] == "Full Extension Test"
        assert ce["actorrole"] == "BH"
        assert ce["comment"] == "Full extension test"
        assert ce["referstoid"] == "ref-123"
