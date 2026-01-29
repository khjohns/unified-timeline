"""
Felles hjelpefunksjoner for backend routes og services.

Disse funksjonene reduserer duplikasjon og sikrer konsistent oppførsel.
"""

from lib.helpers.version_control import (
    handle_concurrency_error,
    not_found_response,
    version_conflict_response,
)
from lib.helpers.responses import (
    error_response,
    success_response,
)

__all__ = [
    "handle_concurrency_error",
    "not_found_response",
    "version_conflict_response",
    "error_response",
    "success_response",
]
