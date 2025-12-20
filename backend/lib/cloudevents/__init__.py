"""
CloudEvents HTTP Binding and Serialization Support.

This module provides utilities for:
- JSON Schema export for CloudEvents dataschema
- HTTP content-type negotiation (Accept header parsing)
- Serialization helpers for API responses
"""
from .schemas import (
    get_event_json_schema,
    get_cloudevent_envelope_schema,
    CloudEventsContentType,
)
from .http_binding import (
    wants_cloudevents_format,
    format_event_response,
    format_timeline_response,
)

__all__ = [
    # Schema exports
    'get_event_json_schema',
    'get_cloudevent_envelope_schema',
    'CloudEventsContentType',
    # HTTP binding
    'wants_cloudevents_format',
    'format_event_response',
    'format_timeline_response',
]
