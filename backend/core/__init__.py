"""
Core configuration, dependency injection, and constants.
"""
from core.config import Settings, settings
from core.container import Container, get_container, set_container
from core.unit_of_work import (
    UnitOfWork,
    TrackingUnitOfWork,
    InMemoryUnitOfWork,
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
