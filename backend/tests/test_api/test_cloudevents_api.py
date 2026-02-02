"""
Tests for CloudEvents API endpoints and Accept header handling.

Tests:
- JSON Schema endpoints (/api/cloudevents/schemas, etc.)
- Accept header content negotiation
- CloudEvents format output
"""

import sys

sys.path.insert(0, ".")

from lib.cloudevents.http_binding import (
    format_event_response,
    format_timeline_response,
)
from lib.cloudevents.schemas import (
    EVENT_TYPE_TO_DATA_MODEL,
    get_all_data_schemas,
    get_cloudevent_envelope_schema,
    get_dataschema_uri,
    get_event_json_schema,
    get_openapi_cloudevent_schema,
)
from models.cloudevents import CLOUDEVENTS_NAMESPACE, CLOUDEVENTS_SPECVERSION
from models.events import EventType, GrunnlagData, GrunnlagEvent

# ============ SCHEMA GENERATION TESTS ============


class TestSchemaGeneration:
    """Test JSON Schema generation for CloudEvents."""

    def test_get_grunnlag_schema(self):
        """Test getting JSON Schema for grunnlag_opprettet."""
        schema = get_event_json_schema("grunnlag_opprettet")

        assert schema is not None
        assert "$id" in schema
        assert CLOUDEVENTS_NAMESPACE in schema["$id"]
        assert schema["type"] == "object"
        assert "properties" in schema
        assert "tittel" in schema["properties"]
        assert "hovedkategori" in schema["properties"]

    def test_get_vederlag_schema(self):
        """Test getting JSON Schema for vederlag_krav_sendt."""
        schema = get_event_json_schema("vederlag_krav_sendt")

        assert schema is not None
        assert "metode" in schema["properties"]
        assert "begrunnelse" in schema["properties"]

    def test_get_frist_schema(self):
        """Test getting JSON Schema for frist_krav_sendt."""
        schema = get_event_json_schema("frist_krav_sendt")

        assert schema is not None
        assert "varsel_type" in schema["properties"]
        assert "begrunnelse" in schema["properties"]

    def test_get_respons_schema(self):
        """Test getting JSON Schema for respons events."""
        schema = get_event_json_schema("respons_grunnlag")
        assert schema is not None
        assert "resultat" in schema["properties"]

        schema = get_event_json_schema("respons_vederlag")
        assert schema is not None
        assert "beregnings_resultat" in schema["properties"]

    def test_trukket_event_has_no_schema(self):
        """Test that trukket events have no data schema."""
        schema = get_event_json_schema("grunnlag_trukket")
        assert schema is None

        schema = get_event_json_schema("vederlag_krav_trukket")
        assert schema is None

    def test_unknown_event_type_returns_none(self):
        """Test that unknown event types return None."""
        schema = get_event_json_schema("unknown_event_type")
        assert schema is None

    def test_get_all_data_schemas(self):
        """Test getting all data schemas at once."""
        schemas = get_all_data_schemas()

        assert len(schemas) > 0
        assert "grunnlag_opprettet" in schemas
        assert "vederlag_krav_sendt" in schemas
        assert "frist_krav_sendt" in schemas

        # Each schema should have $id
        for event_type, schema in schemas.items():
            assert "$id" in schema
            assert event_type in schema["$id"]


class TestEnvelopeSchema:
    """Test CloudEvents envelope schema generation."""

    def test_envelope_schema_structure(self):
        """Test that envelope schema has correct structure."""
        schema = get_cloudevent_envelope_schema()

        assert schema["type"] == "object"
        assert "specversion" in schema["required"]
        assert "id" in schema["required"]
        assert "source" in schema["required"]
        assert "type" in schema["required"]

    def test_envelope_schema_has_all_attributes(self):
        """Test that envelope schema has all CloudEvents attributes."""
        schema = get_cloudevent_envelope_schema()
        props = schema["properties"]

        # Required attributes
        assert "specversion" in props
        assert "id" in props
        assert "source" in props
        assert "type" in props

        # Optional attributes
        assert "time" in props
        assert "subject" in props
        assert "datacontenttype" in props
        assert "dataschema" in props

        # Extension attributes
        assert "actor" in props
        assert "actorrole" in props
        assert "referstoid" in props

        # Data payload
        assert "data" in props

    def test_openapi_schema_removes_unsupported_fields(self):
        """Test that OpenAPI schema removes unsupported JSON Schema fields."""
        full_schema = get_cloudevent_envelope_schema()
        openapi_schema = get_openapi_cloudevent_schema()

        # $schema and $id should be removed for OpenAPI
        assert "$schema" not in openapi_schema
        assert "$id" not in openapi_schema

        # But properties should still exist
        assert "properties" in openapi_schema
        assert "specversion" in openapi_schema["properties"]


class TestDataschemaUri:
    """Test dataschema URI generation."""

    def test_dataschema_uri_without_base(self):
        """Test dataschema URI generation without base URL."""
        uri = get_dataschema_uri("grunnlag_opprettet")
        assert uri == "/api/cloudevents/schemas/grunnlag_opprettet"

    def test_dataschema_uri_with_base(self):
        """Test dataschema URI generation with base URL."""
        uri = get_dataschema_uri("grunnlag_opprettet", "https://api.example.com")
        assert (
            uri == "https://api.example.com/api/cloudevents/schemas/grunnlag_opprettet"
        )


# ============ HTTP BINDING TESTS ============


class TestHttpBinding:
    """Test CloudEvents HTTP binding utilities."""

    def test_format_event_response(self):
        """Test formatting a single event as CloudEvent."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
            aktor="Test User",
            aktor_rolle="TE",
            prosjekt_id="P-001",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Test",
                dato_oppdaget="2025-01-10",
            ),
        )

        ce = format_event_response(event)

        assert ce["specversion"] == "1.0"
        assert ce["id"] == event.event_id
        assert ce["source"] == "/projects/P-001/cases/SAK-001"
        assert ce["type"] == "no.oslo.koe.grunnlag_opprettet"
        assert "data" in ce

    def test_format_event_response_with_dataschema(self):
        """Test that dataschema is included when requested."""
        event = GrunnlagEvent(
            sak_id="SAK-001",
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

        ce = format_event_response(event, include_dataschema=True)
        assert "dataschema" in ce
        assert "grunnlag_opprettet" in ce["dataschema"]

    def test_format_timeline_response(self):
        """Test formatting multiple events as CloudEvents array."""
        events = [
            GrunnlagEvent(
                sak_id="SAK-001",
                aktor="User 1",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Event 1",
                    hovedkategori="test",
                    underkategori="test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-10",
                ),
            ),
            GrunnlagEvent(
                sak_id="SAK-001",
                aktor="User 2",
                aktor_rolle="BH",
                data=GrunnlagData(
                    tittel="Event 2",
                    hovedkategori="test",
                    underkategori="test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-11",
                ),
            ),
        ]

        timeline = format_timeline_response(events)

        assert len(timeline) == 2
        assert all(ce["specversion"] == "1.0" for ce in timeline)
        assert timeline[0]["actor"] == "User 1"
        assert timeline[1]["actor"] == "User 2"


# ============ EVENT TYPE MAPPING TESTS ============


class TestEventTypeMapping:
    """Test that all event types have correct mapping."""

    def test_all_event_types_are_mapped(self):
        """Test that all EventType enum values are in the mapping."""
        for et in EventType:
            assert et.value in EVENT_TYPE_TO_DATA_MODEL, (
                f"Event type {et.value} is not in EVENT_TYPE_TO_DATA_MODEL"
            )

    def test_event_types_have_correct_models(self):
        """Test that event types map to correct data models."""
        from models.events import FristData, GrunnlagData, VederlagData

        # Grunnlag events -> GrunnlagData
        assert EVENT_TYPE_TO_DATA_MODEL["grunnlag_opprettet"] == GrunnlagData
        assert EVENT_TYPE_TO_DATA_MODEL["grunnlag_oppdatert"] == GrunnlagData

        # Vederlag events -> VederlagData
        assert EVENT_TYPE_TO_DATA_MODEL["vederlag_krav_sendt"] == VederlagData
        assert EVENT_TYPE_TO_DATA_MODEL["vederlag_krav_oppdatert"] == VederlagData

        # Frist events -> FristData
        assert EVENT_TYPE_TO_DATA_MODEL["frist_krav_sendt"] == FristData
        assert EVENT_TYPE_TO_DATA_MODEL["frist_krav_oppdatert"] == FristData

        # Trukket events -> None (no data schema)
        assert EVENT_TYPE_TO_DATA_MODEL["grunnlag_trukket"] is None


# ============ INTEGRATION TESTS ============


class TestCloudEventsIntegration:
    """Integration tests for CloudEvents functionality."""

    def test_full_cloudevent_cycle(self):
        """Test creating event, exporting to CloudEvent, and schema lookup."""
        # Create event
        event = GrunnlagEvent(
            sak_id="KOE-2025-001",
            aktor="Integration Test",
            aktor_rolle="TE",
            prosjekt_id="PROJ-001",
            data=GrunnlagData(
                tittel="Full cycle test",
                hovedkategori="forsinkelse_bh",
                underkategori="prosjektering",
                beskrivelse="Testing full CloudEvents cycle",
                dato_oppdaget="2025-12-20",
            ),
        )

        # Export to CloudEvent
        ce = event.to_cloudevent()
        assert ce["specversion"] == CLOUDEVENTS_SPECVERSION
        assert ce["type"] == f"{CLOUDEVENTS_NAMESPACE}.grunnlag_opprettet"

        # Get schema for this event type
        event_type = ce["type"].split(".")[-1]  # Extract 'grunnlag_opprettet'
        schema = get_event_json_schema(event_type)
        assert schema is not None

        # Verify data matches schema structure
        assert "tittel" in ce["data"]
        assert "tittel" in schema["properties"]

    def test_namespace_consistency(self):
        """Test that namespace is consistent across all components."""
        # Check envelope schema
        envelope = get_cloudevent_envelope_schema()
        assert CLOUDEVENTS_NAMESPACE in envelope["$id"]

        # Check data schemas
        for event_type, schema in get_all_data_schemas().items():
            assert CLOUDEVENTS_NAMESPACE in schema["$id"]

        # Check event export
        event = GrunnlagEvent(
            sak_id="SAK-001",
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
        assert ce["type"].startswith(CLOUDEVENTS_NAMESPACE)
