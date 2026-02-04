"""
Retry Decorator for Supabase Operations
=======================================

Exponential backoff med jitter for transiente feil.
"""

from __future__ import annotations

import functools
import logging
import random
import time
from collections.abc import Callable
from typing import ParamSpec, TypeVar

from .exceptions import (
    PermanentError,
    RateLimitError,
    SupabaseError,
    TransientError,
    classify_error,
)

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")


def with_retry(
    max_attempts: int | None = None,
    backoff_base: float | None = None,
    backoff_max: float | None = None,
    use_jitter: bool | None = None,
    retryable_exceptions: tuple = (TransientError,),
) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """
    Decorator for retry med exponential backoff.

    Args:
        max_attempts: Max antall forsøk (default: fra settings)
        backoff_base: Base for exponential backoff i sekunder
        backoff_max: Maks backoff i sekunder
        use_jitter: Legg til tilfeldig jitter (±25%)
        retryable_exceptions: Exception-typer som skal retries

    Usage:
        @with_retry()
        def fetch_data():
            ...

        @with_retry(max_attempts=5, backoff_base=1.0)
        def critical_operation():
            ...
    """

    def decorator(func: Callable[P, R]) -> Callable[P, R]:
        @functools.wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            from core.config import settings

            _max_attempts = max_attempts or settings.supabase_retry_max_attempts
            _backoff_base = backoff_base or settings.supabase_retry_backoff_base
            _backoff_max = backoff_max or settings.supabase_retry_backoff_max
            _use_jitter = (
                use_jitter if use_jitter is not None else settings.supabase_retry_jitter
            )

            if not settings.supabase_retry_enabled:
                return func(*args, **kwargs)

            last_exception: Exception | None = None

            for attempt in range(_max_attempts):
                try:
                    return func(*args, **kwargs)

                except retryable_exceptions as e:
                    last_exception = e

                    if attempt == _max_attempts - 1:
                        logger.error(
                            f"{func.__name__} failed after {_max_attempts} attempts: {e}"
                        )
                        raise

                    # Calculate backoff
                    if isinstance(e, RateLimitError) and e.retry_after:
                        backoff = min(e.retry_after, _backoff_max)
                    else:
                        backoff = min(_backoff_base * (2**attempt), _backoff_max)

                    # Add jitter
                    if _use_jitter:
                        jitter = backoff * 0.25 * (2 * random.random() - 1)
                        backoff = max(0, backoff + jitter)

                    logger.warning(
                        f"{func.__name__} attempt {attempt + 1}/{_max_attempts} "
                        f"failed: {e}. Retrying in {backoff:.2f}s..."
                    )
                    time.sleep(backoff)

                except PermanentError:
                    # Already classified as permanent - don't retry
                    raise

                except Exception as e:
                    # Classify unknown exceptions (skip if already a SupabaseError)
                    if isinstance(e, SupabaseError):
                        classified = e
                    else:
                        classified = classify_error(e)

                    if isinstance(classified, TransientError):
                        last_exception = classified

                        if attempt == _max_attempts - 1:
                            raise classified from e

                        backoff = min(_backoff_base * (2**attempt), _backoff_max)
                        if _use_jitter:
                            jitter = backoff * 0.25 * (2 * random.random() - 1)
                            backoff = max(0, backoff + jitter)

                        logger.warning(
                            f"{func.__name__} transient error: {e}. "
                            f"Retrying in {backoff:.2f}s..."
                        )
                        time.sleep(backoff)
                    else:
                        # Permanent error - don't retry
                        raise classified from e

            # Should not reach here
            if last_exception:
                raise last_exception
            raise RuntimeError(f"{func.__name__} failed unexpectedly")

        return wrapper

    return decorator


def safe_execute(
    operation: Callable[[], R],
    error_message: str = "Operation failed",
    default: R | None = None,
) -> R | None:
    """
    Execute operation with error handling, returning default on failure.

    For backward compatibility with existing code that returns None on errors.

    Args:
        operation: Callable to execute
        error_message: Log message on error
        default: Value to return on error

    Returns:
        Result or default value
    """
    try:
        return operation()
    except PermanentError as e:
        logger.error(f"{error_message}: {e}")
        return default
    except TransientError as e:
        logger.error(f"{error_message} (transient): {e}")
        return default
    except Exception as e:
        logger.error(f"{error_message}: {e}")
        return default
