"""
Domain Models for Skjema Endringsmeldinger.

Event-Sourced Models:
- events.py: All event types (GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent)
- sak_state.py: Aggregated state (SakState)
- api_responses.py: API response models for frontend
"""

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
    SakState,
    GrunnlagTilstand,
    VederlagTilstand,
    FristTilstand,
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
    # Enums
    'SporType', 'EventType', 'SporStatus',
    'VederlagsMetode', 'FristVarselType',
    'GrunnlagResponsResultat', 'VederlagBeregningResultat', 'FristBeregningResultat',
    'SubsidiaerTrigger',
    # Events
    'SakEvent', 'GrunnlagEvent', 'VederlagEvent', 'FristEvent',
    'ResponsEvent', 'SakOpprettetEvent', 'EOUtstedtEvent', 'AnyEvent',
    # Data
    'VarselInfo', 'GrunnlagData', 'VederlagData', 'FristData',
    'GrunnlagResponsData', 'VederlagResponsData', 'FristResponsData',
    # State
    'SakState', 'GrunnlagTilstand', 'VederlagTilstand', 'FristTilstand',
    'SakOversikt', 'SporOversikt',
    # API
    'OversiktResponse', 'GrunnlagResponse', 'VederlagResponse',
    'FristResponse', 'TidslinjeResponse', 'FullSakResponse', 'StatusBadge',
]
