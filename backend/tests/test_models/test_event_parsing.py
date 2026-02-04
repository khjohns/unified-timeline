"""
Tests for event parsing functions.

Tests both parse_event and parse_event_from_request, including
security validation of server-controlled fields.
"""

import pytest

from models.events import (
    FristEvent,
    GrunnlagEvent,
    GrunnlagResponsResultat,
    ResponsEvent,
    SakOpprettetEvent,
    SporType,
    VederlagEvent,
    parse_event,
    parse_event_from_request,
)


class TestParseEvent:
    """Test the parse_event function."""

    def test_parse_sak_opprettet_event(self):
        """Test parsing SAK_OPPRETTET event."""
        data = {
            "event_id": "test-uuid-1",
            "sak_id": "TEST-001",
            "event_type": "sak_opprettet",
            "tidsstempel": "2025-01-01T12:00:00",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case",
            "prosjekt_id": "PROJ-001",
        }

        event = parse_event(data)

        assert isinstance(event, SakOpprettetEvent)
        assert event.sak_id == "TEST-001"
        assert event.sakstittel == "Test Case"

    def test_parse_grunnlag_event(self):
        """Test parsing GRUNNLAG event."""
        data = {
            "event_id": "test-uuid-2",
            "sak_id": "TEST-002",
            "event_type": "grunnlag_opprettet",
            "tidsstempel": "2025-01-01T12:00:00",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "data": {
                "tittel": "Test grunnlag",
                "hovedkategori": "Risiko",
                "underkategori": "Grunnforhold",
                "beskrivelse": "Test beskrivelse",
                "dato_oppdaget": "2025-01-01",
            },
        }

        event = parse_event(data)

        assert isinstance(event, GrunnlagEvent)
        assert event.data.hovedkategori == "Risiko"
        assert event.data.beskrivelse == "Test beskrivelse"

    def test_parse_vederlag_event(self):
        """Test parsing VEDERLAG event."""
        data = {
            "event_id": "test-uuid-3",
            "sak_id": "TEST-003",
            "event_type": "vederlag_krav_sendt",
            "tidsstempel": "2025-01-01T12:00:00",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "versjon": 1,
            "data": {
                "belop_direkte": 150000.0,
                "metode": "FASTPRIS_TILBUD",
                "begrunnelse": "Test begrunnelse",
            },
        }

        event = parse_event(data)

        assert isinstance(event, VederlagEvent)
        assert event.data.belop_direkte == 150000.0
        assert event.versjon == 1

    def test_parse_frist_event(self):
        """Test parsing FRIST event."""
        data = {
            "event_id": "test-uuid-4",
            "sak_id": "TEST-004",
            "event_type": "frist_krav_sendt",
            "tidsstempel": "2025-01-01T12:00:00",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "versjon": 1,
            "data": {
                "varsel_type": "spesifisert",
                "spesifisert_varsel": {"dato_sendt": "2025-01-01", "metode": ["epost"]},
                "antall_dager": 14,
                "begrunnelse": "Test begrunnelse",
            },
        }

        event = parse_event(data)

        assert isinstance(event, FristEvent)
        assert event.data.antall_dager == 14
        assert event.data.varsel_type.value == "spesifisert"

    def test_parse_respons_event(self):
        """Test parsing RESPONS event."""
        data = {
            "event_id": "test-uuid-5",
            "sak_id": "TEST-005",
            "event_type": "respons_grunnlag",
            "tidsstempel": "2025-01-01T12:00:00",
            "aktor": "BH User",
            "aktor_rolle": "BH",
            "spor": "grunnlag",
            "data": {"resultat": "godkjent", "begrunnelse": "Godkjent av BH"},
        }

        event = parse_event(data)

        assert isinstance(event, ResponsEvent)
        assert event.spor == SporType.GRUNNLAG
        assert event.data.resultat == GrunnlagResponsResultat.GODKJENT

    def test_parse_event_missing_event_type(self):
        """Test that parsing fails without event_type."""
        data = {"sak_id": "TEST-006", "aktor": "Test User"}

        with pytest.raises(ValueError, match="Mangler event_type"):
            parse_event(data)

    def test_parse_event_unknown_event_type(self):
        """Test that parsing fails with unknown event_type."""
        data = {
            "event_type": "unknown_event_type",
            "sak_id": "TEST-007",
            "aktor": "Test User",
        }

        with pytest.raises(ValueError, match="Ukjent event_type"):
            parse_event(data)

    def test_parse_all_grunnlag_event_types(self):
        """Test parsing all grunnlag-related event types."""
        for event_type in [
            "grunnlag_opprettet",
            "grunnlag_oppdatert",
            "grunnlag_trukket",
        ]:
            data = {
                "event_id": f"test-{event_type}",
                "sak_id": "TEST-008",
                "event_type": event_type,
                "tidsstempel": "2025-01-01T12:00:00",
                "aktor": "Test User",
                "aktor_rolle": "TE",
                "data": {
                    "tittel": "Test grunnlag",
                    "hovedkategori": "Test",
                    "underkategori": "Test",
                    "beskrivelse": "Test",
                    "dato_oppdaget": "2025-01-01",
                },
            }

            event = parse_event(data)
            assert isinstance(event, GrunnlagEvent)
            assert event.event_type.value == event_type


class TestParseEventFromRequest:
    """Test the parse_event_from_request function."""

    def test_parse_request_adds_server_fields(self):
        """Test that server-controlled fields are added."""
        data = {
            "sak_id": "TEST-009",
            "event_type": "sak_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case",
        }

        event = parse_event_from_request(data)

        assert isinstance(event, SakOpprettetEvent)
        assert event.event_id is not None  # Generated
        assert event.tidsstempel is not None  # Generated
        assert event.sak_id == "TEST-009"

    def test_parse_request_blocks_client_event_id(self):
        """Test that client cannot send event_id."""
        data = {
            "event_id": "client-provided-id",  # Should be blocked!
            "sak_id": "TEST-010",
            "event_type": "sak_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case",
        }

        with pytest.raises(ValueError, match="event_id.*kan ikke sendes av klient"):
            parse_event_from_request(data)

    def test_parse_request_blocks_client_tidsstempel(self):
        """Test that client cannot send tidsstempel."""
        data = {
            "tidsstempel": "2025-01-01T12:00:00",  # Should be blocked!
            "sak_id": "TEST-011",
            "event_type": "sak_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case",
        }

        with pytest.raises(ValueError, match="tidsstempel.*kan ikke sendes av klient"):
            parse_event_from_request(data)

    def test_parse_request_generates_unique_event_ids(self):
        """Test that each request generates a unique event_id."""
        data = {
            "sak_id": "TEST-012",
            "event_type": "sak_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case",
        }

        event1 = parse_event_from_request(data.copy())
        event2 = parse_event_from_request(data.copy())

        assert event1.event_id != event2.event_id

    def test_parse_request_with_complex_event(self):
        """Test parsing complex event from request."""
        data = {
            "sak_id": "TEST-013",
            "event_type": "vederlag_krav_sendt",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "versjon": 1,
            "data": {
                "belop_direkte": 250000.0,
                "metode": "ENHETSPRISER",
                "begrunnelse": "Ekstra arbeid",
                "krever_justert_ep": True,
            },
        }

        event = parse_event_from_request(data)

        assert isinstance(event, VederlagEvent)
        assert event.event_id is not None
        assert event.tidsstempel is not None
        assert event.data.belop_direkte == 250000.0
        assert event.data.krever_justert_ep is True

    def test_parse_request_preserves_optional_fields(self):
        """Test that optional fields are preserved."""
        data = {
            "sak_id": "TEST-014",
            "event_type": "grunnlag_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "kommentar": "Optional comment",  # Optional field
            "data": {
                "tittel": "Test grunnlag",
                "hovedkategori": "Test",
                "underkategori": "Test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-01",
            },
        }

        event = parse_event_from_request(data)

        assert isinstance(event, GrunnlagEvent)
        assert event.kommentar == "Optional comment"


class TestEventParsingSecurity:
    """Test security aspects of event parsing."""

    def test_cannot_inject_server_fields_via_nested_data(self):
        """Test that server fields in nested data structures are allowed."""
        # This is OK - event_id in nested data is different from root event_id
        data = {
            "sak_id": "TEST-015",
            "event_type": "grunnlag_opprettet",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "data": {
                "tittel": "Test grunnlag",
                "hovedkategori": "Test",
                "underkategori": "Test",
                "beskrivelse": "Reference to event_id: xyz",  # OK in text
                "dato_oppdaget": "2025-01-01",
            },
        }

        event = parse_event_from_request(data)
        assert isinstance(event, GrunnlagEvent)
        assert "event_id" in event.data.beskrivelse

    def test_parse_validates_pydantic_constraints(self):
        """Test that Pydantic validation still works."""
        data = {
            "sak_id": "TEST-016",
            "event_type": "vederlag_krav_sendt",
            "aktor": "Test User",
            "aktor_rolle": "TE",
            "versjon": 1,
            "data": {
                "krav_belop": -1000.0,  # Invalid! Must be >= 0
                "metode": "TEST",
                "begrunnelse": "Test",
            },
        }

        with pytest.raises(Exception):  # Pydantic validation error
            parse_event_from_request(data)
