"""
Tests for Supabase retry logic.
"""

from unittest.mock import MagicMock, patch

import pytest

from lib.supabase import (
    PermanentError,
    TransientError,
    classify_error,
    safe_execute,
    with_retry,
)


class TestClassifyError:
    def test_timeout_is_transient(self):
        import httpx

        err = httpx.TimeoutException("timeout")
        result = classify_error(err)
        assert isinstance(result, TransientError)

    def test_connect_error_is_transient(self):
        import httpx

        err = httpx.ConnectError("connection failed")
        result = classify_error(err)
        assert isinstance(result, TransientError)

    def test_connection_error_is_transient(self):
        err = ConnectionError("connection reset")
        result = classify_error(err)
        assert isinstance(result, TransientError)

    def test_unknown_error_is_transient(self):
        """Unknown errors default to transient (safer for retry)."""
        err = RuntimeError("something unexpected")
        result = classify_error(err)
        assert isinstance(result, TransientError)

    def test_api_error_with_unique_constraint(self):
        from postgrest import APIError

        err = MagicMock(spec=APIError)
        err.code = "23505"
        err.message = "duplicate key value violates unique constraint"
        err.details = None

        # Patch isinstance to return True for APIError
        with patch("lib.supabase.exceptions.APIError", type(err)):
            # Need to test the actual classify_error logic
            from lib.supabase.exceptions import ConflictError, classify_error

            result = classify_error(err)
            assert isinstance(result, (ConflictError, PermanentError))


class TestWithRetry:
    def test_succeeds_on_first_try(self):
        @with_retry(max_attempts=3)
        def success():
            return "ok"

        with patch("core.config.settings") as mock_settings:
            mock_settings.supabase_retry_enabled = True
            mock_settings.supabase_retry_max_attempts = 3
            mock_settings.supabase_retry_backoff_base = 0.01
            mock_settings.supabase_retry_backoff_max = 1.0
            mock_settings.supabase_retry_jitter = False

            assert success() == "ok"

    def test_retries_on_transient_error(self):
        attempts = []

        @with_retry(max_attempts=3, backoff_base=0.01, use_jitter=False)
        def fails_twice():
            attempts.append(1)
            if len(attempts) < 3:
                raise TransientError("transient")
            return "ok"

        with patch("core.config.settings") as mock_settings:
            mock_settings.supabase_retry_enabled = True
            mock_settings.supabase_retry_max_attempts = 3
            mock_settings.supabase_retry_backoff_base = 0.01
            mock_settings.supabase_retry_backoff_max = 1.0
            mock_settings.supabase_retry_jitter = False

            result = fails_twice()
            assert result == "ok"
            assert len(attempts) == 3

    def test_no_retry_on_permanent_error(self):
        attempts = []

        @with_retry(max_attempts=3)
        def permanent_fail():
            attempts.append(1)
            raise PermanentError("permanent")

        with patch("core.config.settings") as mock_settings:
            mock_settings.supabase_retry_enabled = True
            mock_settings.supabase_retry_max_attempts = 3
            mock_settings.supabase_retry_backoff_base = 0.01
            mock_settings.supabase_retry_backoff_max = 1.0
            mock_settings.supabase_retry_jitter = False

            with pytest.raises(PermanentError):
                permanent_fail()

            assert len(attempts) == 1  # No retry

    def test_respects_retry_disabled_setting(self):
        attempts = []

        @with_retry(max_attempts=3)
        def track_attempts():
            attempts.append(1)
            return "ok"

        with patch("core.config.settings") as mock_settings:
            mock_settings.supabase_retry_enabled = False

            result = track_attempts()
            assert result == "ok"
            assert len(attempts) == 1

    def test_exhausts_all_attempts(self):
        attempts = []

        @with_retry(max_attempts=3, backoff_base=0.01, use_jitter=False)
        def always_fails():
            attempts.append(1)
            raise TransientError("always fails")

        with patch("core.config.settings") as mock_settings:
            mock_settings.supabase_retry_enabled = True
            mock_settings.supabase_retry_max_attempts = 3
            mock_settings.supabase_retry_backoff_base = 0.01
            mock_settings.supabase_retry_backoff_max = 1.0
            mock_settings.supabase_retry_jitter = False

            with pytest.raises(TransientError):
                always_fails()

            assert len(attempts) == 3


class TestSafeExecute:
    def test_returns_result_on_success(self):
        result = safe_execute(lambda: "ok")
        assert result == "ok"

    def test_returns_default_on_permanent_error(self):
        result = safe_execute(
            lambda: (_ for _ in ()).throw(PermanentError("error")),
            default=[],
        )
        assert result == []

    def test_returns_default_on_transient_error(self):
        result = safe_execute(
            lambda: (_ for _ in ()).throw(TransientError("error")),
            default="fallback",
        )
        assert result == "fallback"

    def test_returns_default_on_generic_error(self):
        def raises():
            raise ValueError("generic")

        result = safe_execute(raises, default=None)
        assert result is None

    def test_returns_none_when_no_default_specified(self):
        def raises():
            raise ValueError("error")

        result = safe_execute(raises, error_message="Test error")
        assert result is None
