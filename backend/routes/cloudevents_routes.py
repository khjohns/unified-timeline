"""
CloudEvents API endpoints.

Provides:
- JSON Schema endpoints for CloudEvents dataschema attribute
- CloudEvents envelope schema
- Event type listing

These endpoints support CloudEvents interoperability by providing
machine-readable type information for event consumers.
"""
from flask import Blueprint, jsonify, request

from lib.cloudevents.schemas import (
    get_event_json_schema,
    get_all_data_schemas,
    get_cloudevent_envelope_schema,
    get_openapi_cloudevent_schema,
)
from models.events import EventType
from models.cloudevents import CLOUDEVENTS_NAMESPACE, CLOUDEVENTS_SPECVERSION

cloudevents_bp = Blueprint('cloudevents', __name__)


@cloudevents_bp.route('/api/cloudevents/schemas', methods=['GET'])
def list_schemas():
    """
    List all available event data schemas.

    Returns a list of event types with their CloudEvents type names
    and links to their JSON schemas.

    Response:
    {
        "namespace": "no.oslo.koe",
        "specversion": "1.0",
        "event_types": [
            {
                "event_type": "grunnlag_opprettet",
                "cloudevents_type": "no.oslo.koe.grunnlag_opprettet",
                "schema_url": "/api/cloudevents/schemas/grunnlag_opprettet"
            },
            ...
        ]
    }
    """
    event_types = []

    for et in EventType:
        schema = get_event_json_schema(et.value)
        event_types.append({
            "event_type": et.value,
            "cloudevents_type": f"{CLOUDEVENTS_NAMESPACE}.{et.value}",
            "schema_url": f"/api/cloudevents/schemas/{et.value}",
            "has_data_schema": schema is not None
        })

    return jsonify({
        "namespace": CLOUDEVENTS_NAMESPACE,
        "specversion": CLOUDEVENTS_SPECVERSION,
        "event_types": event_types
    })


@cloudevents_bp.route('/api/cloudevents/schemas/<event_type>', methods=['GET'])
def get_schema(event_type: str):
    """
    Get JSON Schema for a specific event type's data payload.

    This endpoint returns the JSON Schema that describes the `data`
    attribute for events of the specified type. It can be used with
    the CloudEvents `dataschema` attribute for validation.

    Path Parameters:
        event_type: Event type (e.g., 'grunnlag_opprettet')

    Response 200:
    {
        "$id": "no.oslo.koe/grunnlag_opprettet/data",
        "title": "GrunnlagData",
        "type": "object",
        "properties": { ... }
    }

    Response 404:
    {
        "error": "SCHEMA_NOT_FOUND",
        "message": "No schema for event type: unknown_type"
    }
    """
    schema = get_event_json_schema(event_type)

    if schema is None:
        # Check if event type exists at all
        valid_types = [et.value for et in EventType]
        if event_type not in valid_types:
            return jsonify({
                "error": "UNKNOWN_EVENT_TYPE",
                "message": f"Unknown event type: {event_type}",
                "valid_types": valid_types
            }), 404

        # Event type exists but has no data schema (e.g., trukket events)
        return jsonify({
            "error": "NO_DATA_SCHEMA",
            "message": f"Event type '{event_type}' has no data payload schema",
            "event_type": event_type,
            "cloudevents_type": f"{CLOUDEVENTS_NAMESPACE}.{event_type}"
        }), 404

    # Return schema with correct content type
    response = jsonify(schema)
    response.headers['Content-Type'] = 'application/schema+json'
    return response


@cloudevents_bp.route('/api/cloudevents/envelope-schema', methods=['GET'])
def get_envelope_schema():
    """
    Get JSON Schema for the CloudEvents envelope structure.

    This schema describes the full CloudEvents envelope including
    all standard and extension attributes used by this application.

    Query Parameters:
        format: 'jsonschema' (default) or 'openapi'

    Response 200:
    {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "CloudEvent",
        "type": "object",
        "properties": { ... }
    }
    """
    format_type = request.args.get('format', 'jsonschema')

    if format_type == 'openapi':
        schema = get_openapi_cloudevent_schema()
    else:
        schema = get_cloudevent_envelope_schema()

    response = jsonify(schema)
    response.headers['Content-Type'] = 'application/schema+json'
    return response


@cloudevents_bp.route('/api/cloudevents/all-schemas', methods=['GET'])
def get_all_schemas():
    """
    Get all event data schemas in a single response.

    Useful for clients that want to cache all schemas at once.

    Response:
    {
        "envelope": { ... CloudEvents envelope schema ... },
        "data_schemas": {
            "grunnlag_opprettet": { ... },
            "vederlag_krav_sendt": { ... },
            ...
        }
    }
    """
    return jsonify({
        "namespace": CLOUDEVENTS_NAMESPACE,
        "specversion": CLOUDEVENTS_SPECVERSION,
        "envelope": get_cloudevent_envelope_schema(),
        "data_schemas": get_all_data_schemas()
    })
