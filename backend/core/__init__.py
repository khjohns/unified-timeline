"""
Core configuration, dependency injection, and constants.
"""

from core.config import Settings, settings
from core.container import Container, get_container, set_container
from core.unit_of_work import (
    InMemoryUnitOfWork,
    TrackingUnitOfWork,
    UnitOfWork,
)

__all__ = [
    "Settings",
    "settings",
    "Container",
    "get_container",
    "set_container",
    "UnitOfWork",
    "TrackingUnitOfWork",
    "InMemoryUnitOfWork",
]
