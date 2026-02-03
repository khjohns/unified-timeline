"""
Catenda API Exceptions
======================

Custom exceptions for Catenda API client.
"""


class CatendaAuthError(Exception):
    """Raised when Catenda authentication fails (e.g., token expired)."""

    pass


class CatendaAPIError(Exception):
    """Raised when Catenda API returns a non-retryable error."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class CatendaRateLimitError(Exception):
    """Raised when rate limit exceeded after retries."""

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after
