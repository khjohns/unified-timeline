"""
CloudEvents HTTP Binding Support.

Implements CloudEvents HTTP Protocol Binding v1.0:
https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/bindings/http-protocol-binding.md

Key features:
- Content-type negotiation via Accept header
- Structured content mode (application/cloudevents+json)
- Batch mode for multiple events
"""
from typing import List, Dict, Any, Union, Optional
from flask import request

from .schemas import CloudEventsContentType, get_dataschema_uri


def wants_cloudevents_format() -> bool:
    """
    Check if client wants CloudEvents format based on Accept header.

    Returns True if the Accept header contains:
    - application/cloudevents+json
    - application/cloudevents-batch+json

    Returns:
        True if CloudEvents format is requested

    Example:
        # With Accept: application/cloudevents+json
        >>> wants_cloudevents_format()
        True

        # With Accept: application/json
        >>> wants_cloudevents_format()
        False
    """
    accept = request.headers.get('Accept', '')

    # Check for CloudEvents content types
    cloudevents_types = [
        CloudEventsContentType.CLOUDEVENTS_JSON.value,
        CloudEventsContentType.CLOUDEVENTS_BATCH.value,
    ]

    for ce_type in cloudevents_types:
        if ce_type in accept:
            return True

    return False


def wants_batch_format() -> bool:
    """
    Check if client wants batch CloudEvents format.

    Returns:
        True if batch format is requested
    """
    accept = request.headers.get('Accept', '')
    return CloudEventsContentType.CLOUDEVENTS_BATCH.value in accept


def format_event_response(
    event,
    include_dataschema: bool = True,
    base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Format a single event as CloudEvents structured content.

    Includes extension attributes for UI display:
    - summary: Human-readable summary of the event
    - spor: Track/category (grunnlag, vederlag, frist)

    Args:
        event: SakEvent instance
        include_dataschema: Whether to include dataschema URI
        base_url: Base URL for dataschema URI

    Returns:
        Dict in CloudEvents format

    Example:
        >>> ce = format_event_response(grunnlag_event)
        >>> ce['type']
        'no.oslo.koe.grunnlag_opprettet'
    """
    ce = event.to_cloudevent()

    # Add dataschema if requested
    if include_dataschema and hasattr(event, 'event_type'):
        event_type = event.event_type
        if hasattr(event_type, 'value'):
            event_type = event_type.value
        ce['dataschema'] = get_dataschema_uri(event_type, base_url or '')

    # Add spor (track) extension attribute
    ce['spor'] = _get_spor_for_event(event)

    # Add summary extension attribute
    ce['summary'] = _get_event_summary(event)

    return ce


def _get_spor_for_event(event) -> Optional[str]:
    """
    Determine which track (spor) an event belongs to.

    Returns:
        'grunnlag', 'vederlag', 'frist', 'forsering', or None
    """
    event_type = event.event_type
    if hasattr(event_type, 'value'):
        event_type = event_type.value

    if 'grunnlag' in event_type:
        return 'grunnlag'
    elif 'vederlag' in event_type:
        return 'vederlag'
    elif 'frist' in event_type:
        return 'frist'
    elif 'forsering' in event_type:
        return 'forsering'
    return None


def _get_event_summary(event) -> str:
    """
    Generate a human-readable summary for the event.
    """
    from models.events import (
        GrunnlagEvent, VederlagEvent, FristEvent,
        ForseringVarselEvent, ResponsEvent, SakOpprettetEvent, EOUtstedtEvent
    )

    if isinstance(event, GrunnlagEvent):
        from constants.grunnlag_categories import get_grunnlag_sammendrag
        return get_grunnlag_sammendrag(event.data.hovedkategori, event.data.underkategori)
    elif isinstance(event, VederlagEvent):
        belop = event.data.belop_direkte or event.data.kostnads_overslag or 0
        return f"Krav: {belop:,.0f} NOK"
    elif isinstance(event, FristEvent):
        return f"Krav: {event.data.antall_dager} dager"
    elif isinstance(event, ForseringVarselEvent):
        return f"Forsering: {event.data.estimert_kostnad:,.0f} NOK"
    elif isinstance(event, ResponsEvent):
        return _get_respons_summary(event)
    elif isinstance(event, SakOpprettetEvent):
        return event.sakstittel
    elif isinstance(event, EOUtstedtEvent):
        # Hent EO-nummer (prøv event først, så data)
        eo_num = event.eo_nummer or (event.data.eo_nummer if event.data else None) or "ukjent"
        # Hent vederlag fra event.endelig_vederlag eller data.vederlag.netto_belop
        vederlag = event.endelig_vederlag
        if vederlag is None and event.data and event.data.vederlag:
            vederlag = event.data.vederlag.netto_belop
        if vederlag is not None:
            return f"EO-{eo_num}: {vederlag:,.0f} NOK"
        return f"EO-{eo_num} utstedt"
    return ""


def _get_respons_summary(event) -> str:
    """Generate readable summary for ResponsEvent."""
    resultat_labels = {
        'godkjent': 'Godkjent',
        'delvis_godkjent': 'Delvis godkjent',
        'avslatt': 'Avslått',
        'frafalt': 'Pålegg frafalt',
    }

    if hasattr(event.data, 'resultat'):
        resultat_value = event.data.resultat.value if hasattr(event.data.resultat, 'value') else str(event.data.resultat)
    elif hasattr(event.data, 'beregnings_resultat'):
        resultat_value = event.data.beregnings_resultat.value if hasattr(event.data.beregnings_resultat, 'value') else str(event.data.beregnings_resultat)
    else:
        resultat_value = 'ukjent'

    return resultat_labels.get(resultat_value, resultat_value)


def format_timeline_response(
    events: List,
    include_dataschema: bool = True,
    base_url: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Format a list of events as CloudEvents array.

    Args:
        events: List of SakEvent instances
        include_dataschema: Whether to include dataschema URI
        base_url: Base URL for dataschema URI

    Returns:
        List of CloudEvents dicts

    Example:
        >>> timeline = format_timeline_response([event1, event2])
        >>> len(timeline)
        2
    """
    return [
        format_event_response(event, include_dataschema, base_url)
        for event in events
    ]


def format_batch_response(
    events: List,
    include_dataschema: bool = True,
    base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Format events as CloudEvents batch format.

    CloudEvents batch is an array of CloudEvents wrapped in an object
    with content-type application/cloudevents-batch+json.

    Args:
        events: List of SakEvent instances
        include_dataschema: Whether to include dataschema URI
        base_url: Base URL for dataschema URI

    Returns:
        Batch response dict
    """
    cloudevents = format_timeline_response(events, include_dataschema, base_url)

    return {
        "batch": cloudevents,
        "count": len(cloudevents)
    }


def get_response_content_type() -> str:
    """
    Determine the appropriate response content type based on Accept header.

    Returns:
        Content type string for the response
    """
    if wants_batch_format():
        return CloudEventsContentType.CLOUDEVENTS_BATCH.value
    elif wants_cloudevents_format():
        return CloudEventsContentType.CLOUDEVENTS_JSON.value
    else:
        return CloudEventsContentType.JSON.value


def create_cloudevents_response(
    data: Union[Dict, List],
    status_code: int = 200
) -> tuple:
    """
    Create a Flask response with proper CloudEvents content type.

    Args:
        data: Response data (single event or batch)
        status_code: HTTP status code

    Returns:
        Tuple of (response_dict, status_code, headers)
    """
    content_type = get_response_content_type()

    headers = {
        'Content-Type': content_type
    }

    return data, status_code, headers
