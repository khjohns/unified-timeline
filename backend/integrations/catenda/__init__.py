"""
Catenda API Integration
=======================

Provides the CatendaClient for interacting with Catenda's REST v2 and BCF v3.0 APIs.
"""

from .client import CatendaClient
from .exceptions import CatendaAPIError, CatendaAuthError, CatendaRateLimitError

__all__ = [
    "CatendaClient",
    "CatendaAuthError",
    "CatendaAPIError",
    "CatendaRateLimitError",
]
