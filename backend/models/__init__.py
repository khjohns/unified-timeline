"""
Domain Models for Skjema Endringsmeldinger.

This package contains both the legacy document-oriented models
and the new event-sourced models.

Legacy Models (will be deprecated):
- Sak: Case container
- Varsel: Notification/warning
- KoeRevisjon: Change order revision
- BHSvarRevisjon: Client response

New Event-Sourced Models:
- events.py: All event types (GrunnlagEvent, VederlagEvent, FristEvent, ResponsEvent)
- sak_state.py: Aggregated state (SakState)
- api_responses.py: API response models for frontend

Migration Path:
1. Use MigrationHelper to convert legacy data to events
2. Store events in new event store
3. Use TimelineService to compute state from events
4. Use SakApiService to generate API responses
"""

# Legacy models (for backward compatibility)
from models.sak import Sak
from models.varsel import Varsel
from models.koe_revisjon import KoeRevisjon, VederlagKrav, FristKrav
from models.bh_svar import BHSvarRevisjon, BHVederlagSvar, BHFristSvar

# New event-sourced models
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
    # Legacy
    'Sak', 'Varsel', 'KoeRevisjon', 'VederlagKrav', 'FristKrav',
    'BHSvarRevisjon', 'BHVederlagSvar', 'BHFristSvar',
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
