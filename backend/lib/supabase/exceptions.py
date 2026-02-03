"""
Supabase Exception Hierarchy
============================

TransientError - Retry-bare feil (nettverksproblemer, timeouts, 5xx)
PermanentError - Ikke retry-bare feil (auth, validering, 4xx)
"""

from __future__ import annotations

from postgrest import APIError


class SupabaseError(Exception):
    """Base exception for Supabase operations."""

    def __init__(self, message: str, original: Exception | None = None):
        super().__init__(message)
        self.original = original


class TransientError(SupabaseError):
    """
    Retry-bar feil - nettverksproblemer, timeouts, 5xx errors.

    Disse feilene bør prøves på nytt med exponential backoff.
    """

    pass


class PermanentError(SupabaseError):
    """
    Ikke retry-bar feil - auth failures, validation errors, 4xx.

    Disse feilene bør IKKE prøves på nytt.
    """

    def __init__(
        self,
        message: str,
        original: Exception | None = None,
        code: str | None = None,
        details: str | None = None,
    ):
        super().__init__(message, original)
        self.code = code
        self.details = details


class AuthenticationError(PermanentError):
    """401/403 - Token invalid eller mangler tilgang."""

    pass


class NotFoundError(PermanentError):
    """404 - Ressurs finnes ikke."""

    pass


class ConflictError(PermanentError):
    """409/Unique violation - Optimistic locking conflict."""

    pass


class ValidationError(PermanentError):
    """400/422 - Ugyldig input."""

    pass


class RateLimitError(TransientError):
    """429 - Rate limit exceeded."""

    def __init__(
        self,
        message: str,
        retry_after: int | None = None,
        original: Exception | None = None,
    ):
        super().__init__(message, original)
        self.retry_after = retry_after


def classify_error(e: Exception) -> SupabaseError:
    """
    Klassifiser en exception som TransientError eller PermanentError.

    Basert på Supabase/PostgREST feilkoder og HTTP statuskoder.
    """
    import httpx

    # Nettverksfeil = Transient
    if isinstance(e, (httpx.TimeoutException, httpx.ConnectError, ConnectionError)):
        return TransientError(f"Network error: {e}", original=e)

    # APIError fra PostgREST
    if isinstance(e, APIError):
        code = getattr(e, "code", None) or ""
        message = getattr(e, "message", str(e))
        details = getattr(e, "details", None)

        # Auth errors (PGRST301, PGRST302)
        if code.startswith("PGRST3") or "JWT" in message.upper():
            return AuthenticationError(message, original=e, code=code)

        # Not found
        if code == "PGRST116" or "404" in str(e):
            return NotFoundError(message, original=e, code=code)

        # Unique constraint violation (23505)
        if code == "23505" or "unique" in message.lower():
            return ConflictError(message, original=e, code=code, details=details)

        # Validation errors
        if code.startswith("22") or code.startswith("23"):
            return ValidationError(message, original=e, code=code, details=details)

        # Server errors (5xx equivalent)
        if code.startswith("5") or code.startswith("PGRST5"):
            return TransientError(message, original=e)

        # Default to permanent for unknown API errors
        return PermanentError(message, original=e, code=code, details=details)

    # httpx HTTPStatusError
    if isinstance(e, httpx.HTTPStatusError):
        status = e.response.status_code
        if status == 429:
            retry_after = e.response.headers.get("Retry-After")
            return RateLimitError(
                "Rate limit exceeded",
                retry_after=int(retry_after) if retry_after else None,
                original=e,
            )
        if status in (500, 502, 503, 504):
            return TransientError(f"Server error: {status}", original=e)
        if status == 401:
            return AuthenticationError("Unauthorized", original=e)
        if status == 403:
            return AuthenticationError("Forbidden", original=e)
        if status == 404:
            return NotFoundError("Not found", original=e)
        if status == 409:
            return ConflictError("Conflict", original=e)
        return PermanentError(f"HTTP {status}", original=e)

    # Unknown errors - default to transient (safer)
    return TransientError(f"Unknown error: {e}", original=e)
