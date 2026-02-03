"""
Supabase Utilities
==================

Retry-logikk, exceptions og client factory for Supabase.
"""

from .client import create_supabase_client, get_shared_client
from .exceptions import (
    AuthenticationError,
    ConflictError,
    NotFoundError,
    PermanentError,
    RateLimitError,
    SupabaseError,
    TransientError,
    ValidationError,
    classify_error,
)
from .retry import safe_execute, with_retry

__all__ = [
    # Client
    "create_supabase_client",
    "get_shared_client",
    # Exceptions
    "SupabaseError",
    "TransientError",
    "PermanentError",
    "AuthenticationError",
    "NotFoundError",
    "ConflictError",
    "ValidationError",
    "RateLimitError",
    "classify_error",
    # Retry
    "with_retry",
    "safe_execute",
]
