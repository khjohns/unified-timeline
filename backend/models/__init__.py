"""
Domain Models for Skjema Endringsmeldinger.

Event-Sourced Models:
- events.py: All event types (GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent)
- sak_state.py: Aggregated state (SakState)
- api_responses.py: API response models for frontend
- cloudevents.py: CloudEvents v1.0 support (mixin, validation, constants)
"""

# CloudEvents support
from models.cloudevents import (
    CloudEventMixin,
    CloudEventDict,
    validate_cloudevent,
    CLOUDEVENTS_NAMESPACE,
    CLOUDEVENTS_SPECVERSION,
)

# Event-sourced models
from models.events import (
    # Enums
    SporType,
    EventType,
    SporStatus,
    VederlagsMetode,
    FristVarselType,
    GrunnlagResponsResultat,
    VederlagBeregningResultat,
    FristBeregningResultat,
    SubsidiaerTrigger,
    # Base
    SakEvent,
    VederlagKompensasjon,
    # Events
    GrunnlagEvent,
    VederlagEvent,
    FristEvent,
    ResponsEvent,
    SakOpprettetEvent,
    EOUtstedtEvent,
    # Data classes
    VarselInfo,
    GrunnlagData,
    VederlagData,
    FristData,
    GrunnlagResponsData,
    VederlagResponsData,
    FristResponsData,
    # Type union
    AnyEvent,
)

from models.sak_state import (
    # Sakstype og relasjoner
    SaksType,
    SakRelasjon,
    # Spor-tilstander
    SakState,
    GrunnlagTilstand,
    VederlagTilstand,
    FristTilstand,
    ForseringData,
    # Oversikter
    SakOversikt,
    SporOversikt,
)

from models.api_responses import (
    OversiktResponse,
    GrunnlagResponse,
    VederlagResponse,
    FristResponse,
    TidslinjeResponse,
    FullSakResponse,
    StatusBadge,
)

__all__ = [
    # CloudEvents
    'CloudEventMixin', 'CloudEventDict', 'validate_cloudevent',
    'CLOUDEVENTS_NAMESPACE', 'CLOUDEVENTS_SPECVERSION',
    # Enums
    'SporType', 'EventType', 'SporStatus',
    'VederlagsMetode', 'FristVarselType',
    'GrunnlagResponsResultat', 'VederlagBeregningResultat', 'FristBeregningResultat',
    'SubsidiaerTrigger',
    # Base models
    'VederlagKompensasjon',
    # Events
    'SakEvent', 'GrunnlagEvent', 'VederlagEvent', 'FristEvent',
    'ResponsEvent', 'SakOpprettetEvent', 'EOUtstedtEvent', 'AnyEvent',
    # Data
    'VarselInfo', 'GrunnlagData', 'VederlagData', 'FristData',
    'GrunnlagResponsData', 'VederlagResponsData', 'FristResponsData',
    # State & Sakstype
    'SaksType', 'SakRelasjon',
    'SakState', 'GrunnlagTilstand', 'VederlagTilstand', 'FristTilstand',
    'ForseringData',
    'SakOversikt', 'SporOversikt',
    # API
    'OversiktResponse', 'GrunnlagResponse', 'VederlagResponse',
    'FristResponse', 'TidslinjeResponse', 'FullSakResponse', 'StatusBadge',
]
