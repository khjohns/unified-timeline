"""
JSON Schema exports for CloudEvents dataschema attribute.

Provides JSON Schema definitions for:
- Event data payloads (GrunnlagData, VederlagData, FristData, etc.)
- CloudEvents envelope structure
- Combined schemas for validation

These schemas can be used with the CloudEvents `dataschema` attribute
to provide type information for event consumers.
"""

from enum import Enum
from typing import Any

from models.cloudevents import CLOUDEVENTS_NAMESPACE, CLOUDEVENTS_SPECVERSION

# Import Pydantic models for schema generation
from models.events import (
    EOAkseptertData,
    EOBestridtData,
    EOKoeHandlingData,
    EOOpprettetData,
    EORevidertData,
    EOUtstedtData,
    EventType,
    ForseringKoeHandlingData,
    ForseringKostnaderOppdatertData,
    ForseringResponsData,
    ForseringStoppetData,
    ForseringVarselData,
    FristData,
    FristResponsData,
    GrunnlagData,
    GrunnlagResponsData,
    VederlagData,
    VederlagResponsData,
)


class CloudEventsContentType(str, Enum):
    """Content types for CloudEvents."""

    CLOUDEVENTS_JSON = "application/cloudevents+json"
    CLOUDEVENTS_BATCH = "application/cloudevents-batch+json"
    JSON = "application/json"


# Mapping from event_type to data model class
EVENT_TYPE_TO_DATA_MODEL = {
    # Grunnlag events
    EventType.GRUNNLAG_OPPRETTET.value: GrunnlagData,
    EventType.GRUNNLAG_OPPDATERT.value: GrunnlagData,
    EventType.GRUNNLAG_TRUKKET.value: None,
    # Vederlag events
    EventType.VEDERLAG_KRAV_SENDT.value: VederlagData,
    EventType.VEDERLAG_KRAV_OPPDATERT.value: VederlagData,
    EventType.VEDERLAG_KRAV_TRUKKET.value: None,
    # Frist events
    EventType.FRIST_KRAV_SENDT.value: FristData,
    EventType.FRIST_KRAV_OPPDATERT.value: FristData,
    EventType.FRIST_KRAV_SPESIFISERT.value: FristData,
    EventType.FRIST_KRAV_TRUKKET.value: None,
    # Respons events
    EventType.RESPONS_GRUNNLAG.value: GrunnlagResponsData,
    EventType.RESPONS_GRUNNLAG_OPPDATERT.value: GrunnlagResponsData,
    EventType.RESPONS_VEDERLAG.value: VederlagResponsData,
    EventType.RESPONS_VEDERLAG_OPPDATERT.value: VederlagResponsData,
    EventType.RESPONS_FRIST.value: FristResponsData,
    EventType.RESPONS_FRIST_OPPDATERT.value: FristResponsData,
    # Sak events
    EventType.SAK_OPPRETTET.value: None,  # No data payload
    # EO events (§31.3)
    EventType.EO_OPPRETTET.value: EOOpprettetData,
    EventType.EO_KOE_LAGT_TIL.value: EOKoeHandlingData,
    EventType.EO_KOE_FJERNET.value: EOKoeHandlingData,
    EventType.EO_UTSTEDT.value: EOUtstedtData,
    EventType.EO_AKSEPTERT.value: EOAkseptertData,
    EventType.EO_BESTRIDT.value: EOBestridtData,
    EventType.EO_REVIDERT.value: EORevidertData,
    # Forsering events (§33.8)
    EventType.FORSERING_VARSEL.value: ForseringVarselData,
    EventType.FORSERING_RESPONS.value: ForseringResponsData,
    EventType.FORSERING_STOPPET.value: ForseringStoppetData,
    EventType.FORSERING_KOSTNADER_OPPDATERT.value: ForseringKostnaderOppdatertData,
    EventType.FORSERING_KOE_LAGT_TIL.value: ForseringKoeHandlingData,
    EventType.FORSERING_KOE_FJERNET.value: ForseringKoeHandlingData,
}


def get_event_json_schema(event_type: str) -> dict[str, Any] | None:
    """
    Get JSON Schema for a specific event type's data payload.

    Args:
        event_type: The event type (e.g., 'grunnlag_opprettet')

    Returns:
        JSON Schema dict or None if no schema for this event type

    Example:
        >>> schema = get_event_json_schema('grunnlag_opprettet')
        >>> print(schema['title'])
        'GrunnlagData'
    """
    data_model = EVENT_TYPE_TO_DATA_MODEL.get(event_type)
    if data_model is None:
        return None

    # Generate JSON Schema from Pydantic model
    schema = data_model.model_json_schema(mode="serialization")

    # Add $id for CloudEvents dataschema reference
    schema["$id"] = f"{CLOUDEVENTS_NAMESPACE}/{event_type}/data"

    return schema


def get_all_data_schemas() -> dict[str, dict[str, Any]]:
    """
    Get all event data schemas indexed by event type.

    Returns:
        Dict mapping event_type -> JSON Schema

    Example:
        >>> schemas = get_all_data_schemas()
        >>> print(list(schemas.keys())[:3])
        ['grunnlag_opprettet', 'grunnlag_oppdatert', 'vederlag_krav_sendt']
    """
    schemas = {}
    for event_type, model in EVENT_TYPE_TO_DATA_MODEL.items():
        if model is not None:
            schema = model.model_json_schema(mode="serialization")
            schema["$id"] = f"{CLOUDEVENTS_NAMESPACE}/{event_type}/data"
            schemas[event_type] = schema
    return schemas


def get_cloudevent_envelope_schema() -> dict[str, Any]:
    """
    Get JSON Schema for the CloudEvents envelope structure.

    This schema describes the CloudEvents v1.0 attributes used
    by this application, including custom extension attributes.

    Returns:
        JSON Schema dict for CloudEvents envelope
    """
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "$id": f"{CLOUDEVENTS_NAMESPACE}/cloudevent-envelope",
        "title": "CloudEvent",
        "description": "CloudEvents v1.0 envelope for KOE events",
        "type": "object",
        "required": ["specversion", "id", "source", "type"],
        "properties": {
            # Required CloudEvents attributes
            "specversion": {
                "type": "string",
                "const": CLOUDEVENTS_SPECVERSION,
                "description": "CloudEvents specification version",
            },
            "id": {
                "type": "string",
                "description": "Unique identifier for this event (UUID)",
            },
            "source": {
                "type": "string",
                "format": "uri-reference",
                "description": "Source URI: /projects/{prosjekt_id}/cases/{sak_id}",
                "pattern": "^/projects/[^/]+/cases/[^/]+$",
            },
            "type": {
                "type": "string",
                "description": f"Event type with namespace: {CLOUDEVENTS_NAMESPACE}.<event_type>",
                "pattern": "^no\\.oslo\\.koe\\.[a-z_]+$",
            },
            # Optional CloudEvents attributes
            "time": {
                "type": "string",
                "format": "date-time",
                "description": "Timestamp in RFC 3339 format (ISO 8601 with Z suffix)",
            },
            "subject": {"type": "string", "description": "Subject identifier (sak_id)"},
            "datacontenttype": {
                "type": "string",
                "const": "application/json",
                "description": "Content type of data attribute",
            },
            "dataschema": {
                "type": "string",
                "format": "uri",
                "description": "URI to JSON Schema for data payload",
            },
            # Extension attributes (project-specific)
            "actor": {
                "type": "string",
                "description": "Name of person who performed the action",
            },
            "actorrole": {
                "type": "string",
                "enum": ["TE", "BH"],
                "description": "Role: TE=Totalentreprenor, BH=Byggherre",
            },
            "comment": {
                "type": "string",
                "description": "Optional comment on the event",
            },
            "referstoid": {
                "type": "string",
                "description": "Reference to another event ID (for responses)",
            },
            # Data payload
            "data": {
                "type": "object",
                "description": "Event-specific data payload (see dataschema for structure)",
            },
        },
        "additionalProperties": True,
    }


def get_openapi_cloudevent_schema() -> dict[str, Any]:
    """
    Get OpenAPI 3.0 compatible schema for CloudEvents.

    This is a simplified version without JSON Schema-specific keywords
    that aren't supported in OpenAPI 3.0.

    Returns:
        OpenAPI-compatible schema dict
    """
    base_schema = get_cloudevent_envelope_schema()

    # Remove JSON Schema specific fields not in OpenAPI 3.0
    def clean_for_openapi(obj):
        if isinstance(obj, dict):
            # Remove unsupported keys
            keys_to_remove = ["$schema", "$id", "const", "pattern"]
            for key in keys_to_remove:
                obj.pop(key, None)
            # Recursively clean nested objects
            for key, value in list(obj.items()):
                obj[key] = clean_for_openapi(value)
        elif isinstance(obj, list):
            return [clean_for_openapi(item) for item in obj]
        return obj

    return clean_for_openapi(base_schema.copy())


def get_dataschema_uri(event_type: str, base_url: str = "") -> str:
    """
    Generate a dataschema URI for a given event type.

    Args:
        event_type: The event type (e.g., 'grunnlag_opprettet')
        base_url: Optional base URL for the schema endpoint

    Returns:
        Full URI to the data schema

    Example:
        >>> get_dataschema_uri('grunnlag_opprettet', 'https://api.example.com')
        'https://api.example.com/api/cloudevents/schemas/grunnlag_opprettet'
    """
    if base_url:
        return f"{base_url}/api/cloudevents/schemas/{event_type}"
    return f"/api/cloudevents/schemas/{event_type}"
