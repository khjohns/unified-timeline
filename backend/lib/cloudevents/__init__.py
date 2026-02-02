"""
CloudEvents HTTP Binding and Serialization Support.

This module provides utilities for:
- JSON Schema export for CloudEvents dataschema
- HTTP content-type negotiation (Accept header parsing)
- Serialization helpers for API responses
"""

from .http_binding import (
    format_event_response,
    format_timeline_response,
    wants_cloudevents_format,
)
from .schemas import (
    CloudEventsContentType,
    get_cloudevent_envelope_schema,
    get_event_json_schema,
)

__all__ = [
    # Schema exports
    "get_event_json_schema",
    "get_cloudevent_envelope_schema",
    "CloudEventsContentType",
    # HTTP binding
    "wants_cloudevents_format",
    "format_event_response",
    "format_timeline_response",
]
