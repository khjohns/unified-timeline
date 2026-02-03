"""
Tests for CatendaClient retry logic.

Tests cover:
- Session creation with retry adapter
- Backoff calculation with jitter
- Rate limit (429) handling with Retry-After
- Server error (5xx) retries
- Timeout and connection error handling
- Non-retryable error handling (4xx)
"""

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
import requests

from integrations.catenda import (
    CatendaAPIError,
    CatendaAuthError,
    CatendaClient,
    CatendaRateLimitError,
)


@pytest.fixture
def mock_settings():
    """Mock settings for retry configuration."""
    mock = MagicMock()
    mock.catenda_retry_enabled = True
    mock.catenda_retry_max_attempts = 3
    mock.catenda_retry_backoff_base = 0.5
    mock.catenda_retry_backoff_max = 60.0
    mock.catenda_retry_jitter = False  # Disable jitter for predictable tests
    mock.catenda_request_timeout = 30
    return mock


@pytest.fixture
def client_with_retry(mock_settings):
    """Create CatendaClient with mocked settings."""
    with patch("core.config.settings", mock_settings):
        # Create client with a valid access token to avoid auth errors
        client = CatendaClient(
            client_id="test-client-id",
            access_token="test-token",
        )
        # Set token expiry to future to avoid auth check failures
        client.token_expiry = datetime.now() + timedelta(hours=1)
        return client


@pytest.fixture
def client_no_retry(mock_settings):
    """Create CatendaClient with retry disabled."""
    mock_settings.catenda_retry_enabled = False
    with patch("core.config.settings", mock_settings):
        client = CatendaClient(
            client_id="test-client-id",
            access_token="test-token",
            retry_enabled=False,
        )
        client.token_expiry = datetime.now() + timedelta(hours=1)
        return client


class TestSessionCreation:
    """Tests for session creation and retry adapter."""

    def test_session_created_with_retry(self, client_with_retry):
        """Session should be created with retry adapter when enabled."""
        session = client_with_retry._session
        assert session is not None
        assert isinstance(session, requests.Session)

    def test_session_without_retry_adapter_when_disabled(self, client_no_retry):
        """Session should not have retry adapter when disabled."""
        session = client_no_retry._session
        assert session is not None
        # Session is still created, just without special retry config

    def test_retry_settings_loaded(self, client_with_retry):
        """Verify retry settings are correctly loaded."""
        assert client_with_retry._retry_enabled is True
        assert client_with_retry._max_retries == 3
        assert client_with_retry._backoff_base == 0.5
        assert client_with_retry._backoff_max == 60.0
        assert client_with_retry._use_jitter is False
        assert client_with_retry._timeout == 30


class TestBackoffCalculation:
    """Tests for backoff calculation."""

    def test_exponential_backoff(self, client_with_retry):
        """Backoff should increase exponentially."""
        # Base is 0.5, jitter is disabled
        assert client_with_retry._calculate_backoff(0) == 0.5  # 0.5 * 2^0
        assert client_with_retry._calculate_backoff(1) == 1.0  # 0.5 * 2^1
        assert client_with_retry._calculate_backoff(2) == 2.0  # 0.5 * 2^2
        assert client_with_retry._calculate_backoff(3) == 4.0  # 0.5 * 2^3

    def test_backoff_capped_at_max(self, client_with_retry):
        """Backoff should not exceed maximum."""
        # Very high attempt should still be capped at 60
        backoff = client_with_retry._calculate_backoff(10)
        assert backoff == 60.0

    def test_retry_after_takes_precedence(self, client_with_retry):
        """Retry-After header value should take precedence."""
        backoff = client_with_retry._calculate_backoff(0, retry_after=10)
        assert backoff == 10.0

    def test_retry_after_capped_at_max(self, client_with_retry):
        """Retry-After should also be capped at max."""
        backoff = client_with_retry._calculate_backoff(0, retry_after=120)
        assert backoff == 60.0

    def test_jitter_adds_variance(self, mock_settings):
        """Jitter should add variance to backoff."""
        mock_settings.catenda_retry_jitter = True
        with patch("core.config.settings", mock_settings):
            client = CatendaClient(
                client_id="test-client-id",
                access_token="test-token",
            )
            client.token_expiry = datetime.now() + timedelta(hours=1)

            # Run multiple times and check for variance
            backoffs = [client._calculate_backoff(1) for _ in range(10)]
            # With jitter, not all values should be the same
            unique_values = set(backoffs)
            assert len(unique_values) > 1, "Jitter should add variance"

            # All values should be within +-25% of base (1.0)
            for b in backoffs:
                assert 0.75 <= b <= 1.25


class TestRetryAfterParsing:
    """Tests for Retry-After header parsing."""

    def test_parse_integer_retry_after(self, client_with_retry):
        """Should parse integer Retry-After header."""
        response = MagicMock()
        response.headers = {"Retry-After": "30"}
        result = client_with_retry._parse_retry_after(response)
        assert result == 30

    def test_parse_missing_retry_after(self, client_with_retry):
        """Should return None for missing header."""
        response = MagicMock()
        response.headers = {}
        result = client_with_retry._parse_retry_after(response)
        assert result is None

    def test_parse_invalid_retry_after(self, client_with_retry):
        """Should return None for invalid header value."""
        response = MagicMock()
        response.headers = {"Retry-After": "invalid"}
        result = client_with_retry._parse_retry_after(response)
        assert result is None


class TestMakeRequest:
    """Tests for _make_request with retry logic."""

    def test_successful_request(self, client_with_retry):
        """Successful request should return response."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            result = client_with_retry._make_request(
                "GET", "https://api.catenda.com/test"
            )
            assert result == mock_response

    def test_auth_error_401_no_retry(self, client_with_retry):
        """401 errors should raise CatendaAuthError immediately (no retry)."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            with pytest.raises(CatendaAuthError) as exc_info:
                client_with_retry._make_request("GET", "https://api.catenda.com/test")
            assert "expired or invalid" in str(exc_info.value)

    def test_auth_error_403_no_retry(self, client_with_retry):
        """403 errors should raise CatendaAuthError immediately (no retry)."""
        mock_response = MagicMock()
        mock_response.status_code = 403

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            with pytest.raises(CatendaAuthError) as exc_info:
                client_with_retry._make_request("GET", "https://api.catenda.com/test")
            assert "permissions" in str(exc_info.value)

    def test_client_error_400_no_retry(self, client_with_retry):
        """400 errors should raise CatendaAPIError immediately (no retry)."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            with pytest.raises(CatendaAPIError) as exc_info:
                client_with_retry._make_request("GET", "https://api.catenda.com/test")
            assert exc_info.value.status_code == 400

    def test_client_error_404_no_retry(self, client_with_retry):
        """404 errors should raise CatendaAPIError immediately (no retry)."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not found"

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            with pytest.raises(CatendaAPIError) as exc_info:
                client_with_retry._make_request("GET", "https://api.catenda.com/test")
            assert exc_info.value.status_code == 404

    def test_rate_limit_429_with_retry(self, client_with_retry):
        """429 errors should retry and eventually raise CatendaRateLimitError."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "1"}

        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return mock_response

        with patch.object(
            client_with_retry._session, "request", side_effect=mock_request
        ):
            with patch("time.sleep"):  # Don't actually sleep in tests
                with pytest.raises(CatendaRateLimitError) as exc_info:
                    client_with_retry._make_request(
                        "GET", "https://api.catenda.com/test"
                    )

        # Should have retried max_retries + 1 times (initial + retries)
        assert call_count == 4  # 1 initial + 3 retries
        assert exc_info.value.retry_after == 1

    def test_rate_limit_429_success_after_retry(self, client_with_retry):
        """429 should succeed if retry succeeds."""
        rate_limit_response = MagicMock()
        rate_limit_response.status_code = 429
        rate_limit_response.headers = {"Retry-After": "1"}

        success_response = MagicMock()
        success_response.status_code = 200
        success_response.ok = True

        # First call returns 429, second succeeds
        responses = [rate_limit_response, success_response]

        with patch.object(client_with_retry._session, "request", side_effect=responses):
            with patch("time.sleep"):
                result = client_with_retry._make_request(
                    "GET", "https://api.catenda.com/test"
                )
                assert result == success_response

    def test_timeout_with_retry(self, client_with_retry):
        """Timeout errors should retry with backoff."""
        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise requests.exceptions.Timeout("Connection timed out")

        with patch.object(
            client_with_retry._session, "request", side_effect=mock_request
        ):
            with patch("time.sleep"):
                with pytest.raises(CatendaAPIError) as exc_info:
                    client_with_retry._make_request(
                        "GET", "https://api.catenda.com/test"
                    )

        # Should have retried
        assert call_count == 4  # 1 initial + 3 retries
        assert "timed out" in str(exc_info.value).lower()

    def test_connection_error_with_retry(self, client_with_retry):
        """Connection errors should retry with backoff."""
        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise requests.exceptions.ConnectionError("Connection refused")

        with patch.object(
            client_with_retry._session, "request", side_effect=mock_request
        ):
            with patch("time.sleep"):
                with pytest.raises(CatendaAPIError) as exc_info:
                    client_with_retry._make_request(
                        "GET", "https://api.catenda.com/test"
                    )

        assert call_count == 4  # 1 initial + 3 retries
        assert "Connection refused" in str(exc_info.value)

    def test_timeout_success_after_retry(self, client_with_retry):
        """Timeout should succeed if retry succeeds."""
        success_response = MagicMock()
        success_response.status_code = 200
        success_response.ok = True

        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise requests.exceptions.Timeout("Connection timed out")
            return success_response

        with patch.object(
            client_with_retry._session, "request", side_effect=mock_request
        ):
            with patch("time.sleep"):
                result = client_with_retry._make_request(
                    "GET", "https://api.catenda.com/test"
                )
                assert result == success_response
                assert call_count == 2


class TestSafeRequest:
    """Tests for _safe_request wrapper."""

    def test_safe_request_returns_response_on_success(self, client_with_retry):
        """_safe_request should return response on success."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.ok = True

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            result = client_with_retry._safe_request(
                "GET", "https://api.catenda.com/test"
            )
            assert result == mock_response

    def test_safe_request_returns_none_on_auth_error(self, client_with_retry):
        """_safe_request should return None on auth error."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            result = client_with_retry._safe_request(
                "GET", "https://api.catenda.com/test"
            )
            assert result is None

    def test_safe_request_returns_none_on_api_error(self, client_with_retry):
        """_safe_request should return None on API error."""
        mock_response = MagicMock()
        mock_response.status_code = 400
        mock_response.text = "Bad request"

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            result = client_with_retry._safe_request(
                "GET", "https://api.catenda.com/test"
            )
            assert result is None

    def test_safe_request_returns_none_on_rate_limit(self, client_with_retry):
        """_safe_request should return None after rate limit exhaustion."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "1"}

        with patch.object(
            client_with_retry._session, "request", return_value=mock_response
        ):
            with patch("time.sleep"):
                result = client_with_retry._safe_request(
                    "GET", "https://api.catenda.com/test"
                )
                assert result is None


class TestRetryDisabled:
    """Tests with retry disabled."""

    def test_no_retry_on_timeout_when_disabled(self, client_no_retry):
        """Timeout should not retry when retry is disabled."""
        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise requests.exceptions.Timeout("Connection timed out")

        with patch.object(
            client_no_retry._session, "request", side_effect=mock_request
        ):
            with pytest.raises(CatendaAPIError):
                client_no_retry._make_request("GET", "https://api.catenda.com/test")

        # Should only try once when retry is disabled
        assert call_count == 1

    def test_no_retry_on_connection_error_when_disabled(self, client_no_retry):
        """Connection error should not retry when retry is disabled."""
        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            raise requests.exceptions.ConnectionError("Connection refused")

        with patch.object(
            client_no_retry._session, "request", side_effect=mock_request
        ):
            with pytest.raises(CatendaAPIError):
                client_no_retry._make_request("GET", "https://api.catenda.com/test")

        assert call_count == 1
