"""
Domain Models for Skjema Endringsmeldinger.

Event-Sourced Models:
- events.py: All event types (GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent)
- sak_state.py: Aggregated state (SakState)
- api_responses.py: API response models for frontend
- cloudevents.py: CloudEvents v1.0 support (mixin, validation, constants)
"""

# CloudEvents support
from models.api_responses import (
    FristResponse,
    FullSakResponse,
    GrunnlagResponse,
    OversiktResponse,
    StatusBadge,
    TidslinjeResponse,
    VederlagResponse,
)
from models.cloudevents import (
    CLOUDEVENTS_NAMESPACE,
    CLOUDEVENTS_SPECVERSION,
    CloudEventDict,
    CloudEventMixin,
    validate_cloudevent,
)

# Event-sourced models
from models.events import (
    # Type union
    AnyEvent,
    EOUtstedtEvent,
    EventType,
    FristBeregningResultat,
    FristData,
    FristEvent,
    FristResponsData,
    FristVarselType,
    GrunnlagData,
    # Events
    GrunnlagEvent,
    GrunnlagResponsData,
    GrunnlagResponsResultat,
    ResponsEvent,
    # Base
    SakEvent,
    SakOpprettetEvent,
    SporStatus,
    # Enums
    SporType,
    SubsidiaerTrigger,
    # Data classes
    VarselInfo,
    VederlagBeregningResultat,
    VederlagData,
    VederlagEvent,
    VederlagKompensasjon,
    VederlagResponsData,
    VederlagsMetode,
)
from models.sak_state import (
    ForseringData,
    FristTilstand,
    GrunnlagTilstand,
    # Oversikter
    SakOversikt,
    SakRelasjon,
    # Spor-tilstander
    SakState,
    # Sakstype og relasjoner
    SaksType,
    SporOversikt,
    VederlagTilstand,
)

__all__ = [
    # CloudEvents
    "CloudEventMixin",
    "CloudEventDict",
    "validate_cloudevent",
    "CLOUDEVENTS_NAMESPACE",
    "CLOUDEVENTS_SPECVERSION",
    # Enums
    "SporType",
    "EventType",
    "SporStatus",
    "VederlagsMetode",
    "FristVarselType",
    "GrunnlagResponsResultat",
    "VederlagBeregningResultat",
    "FristBeregningResultat",
    "SubsidiaerTrigger",
    # Base models
    "VederlagKompensasjon",
    # Events
    "SakEvent",
    "GrunnlagEvent",
    "VederlagEvent",
    "FristEvent",
    "ResponsEvent",
    "SakOpprettetEvent",
    "EOUtstedtEvent",
    "AnyEvent",
    # Data
    "VarselInfo",
    "GrunnlagData",
    "VederlagData",
    "FristData",
    "GrunnlagResponsData",
    "VederlagResponsData",
    "FristResponsData",
    # State & Sakstype
    "SaksType",
    "SakRelasjon",
    "SakState",
    "GrunnlagTilstand",
    "VederlagTilstand",
    "FristTilstand",
    "ForseringData",
    "SakOversikt",
    "SporOversikt",
    # API
    "OversiktResponse",
    "GrunnlagResponse",
    "VederlagResponse",
    "FristResponse",
    "TidslinjeResponse",
    "FullSakResponse",
    "StatusBadge",
]
