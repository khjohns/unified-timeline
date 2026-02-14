"""
Catenda Client Base
===================

Base class for Catenda API client with authentication and HTTP helpers.
"""

import json
import logging
import random
import time
from datetime import datetime, timedelta
from typing import TYPE_CHECKING

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .exceptions import CatendaAPIError, CatendaAuthError, CatendaRateLimitError

if TYPE_CHECKING:
    pass

# Default timeout for HTTP requests (seconds)
DEFAULT_TIMEOUT = 30

# Use centralized logging (configured in core/logging_config.py)
logger = logging.getLogger(__name__)


class CatendaClientBase:
    """
    Base class for Catenda API client.

    Provides authentication, token management, and HTTP request helpers with retry logic.
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str | None = None,
        access_token: str | None = None,
        retry_enabled: bool | None = None,
        max_retries: int | None = None,
    ):
        """
        Initialize API client with OAuth credentials.

        Args:
            client_id: OAuth Client ID from Catenda
            client_secret: OAuth Client Secret (only for Boost customers)
            access_token: Pre-fetched access token (if already obtained manually)
            retry_enabled: Override for retry configuration (default: from settings)
            max_retries: Override for max retry attempts (default: from settings)
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = "https://api.catenda.com"
        self.access_token: str | None = access_token
        self.token_expiry: datetime | None = None
        self.refresh_token: str | None = None

        # These are set during usage
        self.project_id: str | None = None
        self.topic_board_id: str | None = None
        self.library_id: str | None = None
        self.test_topic_id: str | None = None

        # Load retry configuration from settings (with fallback defaults
        # so CatendaClient works in standalone scripts without pydantic_settings)
        try:
            from core.config import settings

            _retry_default = settings.catenda_retry_enabled
            _max_retries_default = settings.catenda_retry_max_attempts
            _backoff_base = settings.catenda_retry_backoff_base
            _backoff_max = settings.catenda_retry_backoff_max
            _use_jitter = settings.catenda_retry_jitter
            _timeout = settings.catenda_request_timeout
        except (ImportError, ModuleNotFoundError):
            logger.debug("core.config not available, using default retry settings")
            _retry_default = True
            _max_retries_default = 3
            _backoff_base = 0.5
            _backoff_max = 60.0
            _use_jitter = True
            _timeout = 30

        self._retry_enabled = (
            retry_enabled if retry_enabled is not None else _retry_default
        )
        self._max_retries = (
            max_retries if max_retries is not None else _max_retries_default
        )
        self._backoff_base = _backoff_base
        self._backoff_max = _backoff_max
        self._use_jitter = _use_jitter
        self._timeout = _timeout

        # Create session with retry adapter for 5xx errors
        self._session = self._create_session()

        logger.info("CatendaClient initialisert")

    # ==========================================
    # AUTHENTICATION
    # ==========================================

    def authenticate(self) -> bool:
        """
        Get OAuth access token via Client Credentials Grant.

        NOTE: This method only works for Catenda Boost customers!

        For other users, use get_authorization_url() and set_access_token()
        for Authorization Code Grant flow.

        Returns:
            True if authentication succeeded, False otherwise
        """
        if not self.client_secret:
            logger.error(
                "Client Secret mangler - kan ikke autentisere med Client Credentials Grant"
            )
            logger.info(
                "Bruk get_authorization_url() for Authorization Code Grant i stedet"
            )
            return False

        logger.info("Starter autentisering (Client Credentials Grant)...")
        logger.info("Merk: Dette fungerer kun for Catenda Boost-kunder")

        url = f"{self.base_url}/oauth2/token"

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

        try:
            response = requests.post(
                url, headers=headers, data=data, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            token_data = response.json()
            self.access_token = token_data["access_token"]

            # Calculate expiry time (add some margin)
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)

            logger.info(f"Autentisering vellykket. Token utloper: {self.token_expiry}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Autentisering feilet: {e}")

            if hasattr(e, "response") and e.response is not None:
                error_text = e.response.text
                logger.error(f"Response: {error_text}")

                # Specific handling of unauthorized_client
                if "unauthorized_client" in error_text:
                    logger.error(
                        "DIAGNOSE: Client Credentials Grant er ikke tilgjengelig"
                    )
                    logger.error(
                        "Client Credentials Grant fungerer kun for Catenda Boost-kunder."
                    )
                    logger.error("Du ma bruke Authorization Code Grant i stedet.")

            return False

    # ==========================================
    # AUTHORIZATION CODE GRANT (For non-Boost customers)
    # ==========================================

    def get_authorization_url(self, redirect_uri: str, state: str | None = None) -> str:
        """
        Generate authorization URL for Authorization Code Grant flow.

        Use this method if Client Credentials Grant doesn't work.

        Args:
            redirect_uri: Your registered redirect URI
            state: Optional state parameter for security

        Returns:
            URL the user must open in browser
        """
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
        }

        if state:
            params["state"] = state

        # Build URL
        from urllib.parse import urlencode

        query_string = urlencode(params)
        auth_url = f"{self.base_url}/oauth2/authorize?{query_string}"

        logger.info(f"Authorization URL generert: {auth_url}")

        return auth_url

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> bool:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from redirect
            redirect_uri: Same redirect URI used in get_authorization_url()

        Returns:
            True if successful
        """
        logger.info("Bytter authorization code mot access token...")

        url = f"{self.base_url}/oauth2/token"

        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }

        try:
            response = requests.post(
                url, headers=headers, data=data, timeout=DEFAULT_TIMEOUT
            )
            response.raise_for_status()

            token_data = response.json()
            self.access_token = token_data["access_token"]

            # Store refresh token if available
            if "refresh_token" in token_data:
                self.refresh_token = token_data["refresh_token"]
                logger.info("Refresh token mottatt og lagret")

            # Calculate expiry time
            expires_in = token_data.get("expires_in", 3600)
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)

            logger.info(f"Access token hentet! Utloper: {self.token_expiry}")
            return True

        except requests.exceptions.RequestException as e:
            logger.error(f"Feil ved token exchange: {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Response: {e.response.text}")
            return False

    def set_access_token(self, token: str, expires_in: int = 3600):
        """
        Set access token manually (if obtained another way).

        Args:
            token: Access token
            expires_in: Seconds until token expires (default: 3600)
        """
        self.access_token = token

        # Try to extract actual expiry from JWT token
        expiry_from_jwt = self._extract_jwt_expiry(token)
        if expiry_from_jwt:
            # Use JWT expiry with 5 min safety margin
            self.token_expiry = expiry_from_jwt - timedelta(seconds=300)
            logger.info("Access token satt manuelt (utlopstid fra JWT)")
        else:
            # Fall back to assuming token is fresh
            self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            logger.info("Access token satt manuelt (antatt utlopstid)")
        logger.info(f"   Utloper: {self.token_expiry}")

    def _extract_jwt_expiry(self, token: str) -> datetime | None:
        """
        Try to extract expiry time from JWT token without verification.
        Returns None if token is not a valid JWT or doesn't have exp claim.
        """
        try:
            import base64

            # JWT has 3 parts separated by dots
            parts = token.split(".")
            if len(parts) != 3:
                return None

            # Decode payload (second part) - add padding if needed
            payload_b64 = parts[1]
            padding = 4 - len(payload_b64) % 4
            if padding != 4:
                payload_b64 += "=" * padding

            payload_bytes = base64.urlsafe_b64decode(payload_b64)
            payload = json.loads(payload_bytes.decode("utf-8"))

            exp = payload.get("exp")
            if exp and isinstance(exp, (int, float)):
                expiry = datetime.fromtimestamp(exp)
                logger.debug(f"   JWT exp claim: {expiry}")
                return expiry
            return None
        except Exception as e:
            logger.debug(f"   Could not extract JWT expiry: {e}")
            return None

    # ==========================================
    # TOKEN MANAGEMENT
    # ==========================================

    def ensure_authenticated(self) -> bool:
        """
        Check if token is valid.

        Note: Auto-refresh via client credentials is disabled because most users
        don't have Catenda Boost. If token expires, user must get a new token
        via Authorization Code Grant and update .env.

        Returns:
            True if authenticated, False otherwise
        """
        if not self.access_token or not self.token_expiry:
            logger.warning("Ingen access token konfigurert")
            logger.warning("    Sett CATENDA_ACCESS_TOKEN i .env")
            return False

        if datetime.now() >= self.token_expiry:
            logger.warning("Access token har utlopt!")
            logger.warning("    Hent nytt token via Authorization Code Grant")
            logger.warning("    og oppdater CATENDA_ACCESS_TOKEN i .env")
            return False

        return True

    def get_headers(self) -> dict[str, str]:
        """
        Return standard headers for API calls.
        """
        if not self.ensure_authenticated():
            raise RuntimeError("Kunne ikke autentisere")

        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    # ==========================================
    # HTTP REQUEST HELPERS WITH RETRY
    # ==========================================

    def _create_session(self) -> requests.Session:
        """
        Create a requests Session with retry adapter for 5xx errors.

        The Session uses urllib3.Retry for automatic retry on server errors.
        Rate limit (429) is handled manually in _make_request for Retry-After support.
        """
        session = requests.Session()

        if not self._retry_enabled:
            return session

        # Configure urllib3 Retry for automatic retry on 5xx errors
        retry_strategy = Retry(
            total=self._max_retries,
            status_forcelist=[500, 502, 503, 504],
            allowed_methods=[
                "HEAD",
                "GET",
                "PUT",
                "POST",
                "DELETE",
                "PATCH",
                "OPTIONS",
            ],
            backoff_factor=self._backoff_base,
            backoff_max=self._backoff_max,
            raise_on_status=False,  # Don't raise, we handle status codes ourselves
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("https://", adapter)
        session.mount("http://", adapter)

        return session

    def _calculate_backoff(self, attempt: int, retry_after: int | None = None) -> float:
        """
        Calculate backoff time with optional jitter.

        Args:
            attempt: Current attempt number (0-indexed)
            retry_after: Retry-After header value in seconds (if provided by server)

        Returns:
            Backoff time in seconds
        """
        if retry_after is not None:
            base = retry_after
        else:
            # Exponential backoff: base * 2^attempt
            base = self._backoff_base * (2**attempt)

        # Cap at maximum
        base = min(base, self._backoff_max)

        # Add jitter (+-25%) if enabled
        if self._use_jitter:
            jitter = base * 0.25 * (2 * random.random() - 1)
            base = base + jitter

        return max(0, base)

    def _parse_retry_after(self, response: requests.Response) -> int | None:
        """
        Parse Retry-After header from response.

        Args:
            response: HTTP response object

        Returns:
            Retry time in seconds, or None if not present/parseable
        """
        retry_after = response.headers.get("Retry-After")
        if not retry_after:
            return None

        try:
            # Try parsing as integer (seconds)
            return int(retry_after)
        except ValueError:
            pass

        try:
            # Try parsing as HTTP date
            from email.utils import parsedate_to_datetime

            dt = parsedate_to_datetime(retry_after)
            delta = (dt - datetime.now(dt.tzinfo)).total_seconds()
            return max(0, int(delta))
        except (ValueError, TypeError):
            pass

        return None

    def _make_request(
        self,
        method: str,
        url: str,
        error_message: str = "API request failed",
        **kwargs,
    ) -> requests.Response:
        """
        Make HTTP request with retry logic for transient errors.

        Handles:
        - 429 Rate Limit: Retry with Retry-After header respect
        - 5xx Server Errors: Automatic retry via urllib3 (session adapter)
        - Timeouts/Connection Errors: Retry with exponential backoff

        Does NOT retry:
        - 401/403: Authentication errors (raises CatendaAuthError)
        - 400/404/422: Client errors (raises CatendaAPIError)

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full URL
            error_message: Message prefix for error logging
            **kwargs: Additional arguments for requests (json, params, etc.)

        Returns:
            Response object

        Raises:
            CatendaAuthError: For 401/403 errors
            CatendaAPIError: For non-retryable client errors
            CatendaRateLimitError: When rate limit exceeded after retries
        """
        # Set default timeout if not provided
        kwargs.setdefault("timeout", self._timeout)

        # Get headers (includes auth token)
        kwargs.setdefault("headers", self.get_headers())

        last_exception: Exception | None = None
        last_response: requests.Response | None = None

        for attempt in range(self._max_retries + 1):
            try:
                response = self._session.request(method, url, **kwargs)
                last_response = response

                # Handle authentication errors (no retry)
                if response.status_code == 401:
                    logger.error(f"{error_message}: Token expired or invalid")
                    raise CatendaAuthError("Access token expired or invalid")
                elif response.status_code == 403:
                    logger.error(f"{error_message}: Insufficient permissions")
                    raise CatendaAuthError("Insufficient permissions")

                # Handle client errors (no retry)
                if response.status_code in (400, 404, 422):
                    logger.error(f"{error_message}: HTTP {response.status_code}")
                    if hasattr(response, "text"):
                        logger.error(f"   Response: {response.text[:500]}")
                    raise CatendaAPIError(
                        f"{error_message}: HTTP {response.status_code}",
                        status_code=response.status_code,
                    )

                # Handle rate limit (retry with Retry-After)
                if response.status_code == 429:
                    retry_after = self._parse_retry_after(response)
                    if attempt < self._max_retries:
                        backoff = self._calculate_backoff(attempt, retry_after)
                        logger.warning(
                            f"Rate limit hit, retrying in {backoff:.1f}s "
                            f"(attempt {attempt + 1}/{self._max_retries + 1})"
                        )
                        time.sleep(backoff)
                        continue
                    else:
                        logger.error(
                            f"{error_message}: Rate limit exceeded after retries"
                        )
                        raise CatendaRateLimitError(
                            f"Rate limit exceeded after {self._max_retries + 1} attempts",
                            retry_after=retry_after,
                        )

                # Success or 5xx (which urllib3.Retry already handled)
                if response.ok:
                    return response

                # Other errors (shouldn't happen after urllib3 retry)
                response.raise_for_status()

            except (
                requests.exceptions.Timeout,
                requests.exceptions.ConnectionError,
            ) as e:
                last_exception = e
                if attempt < self._max_retries and self._retry_enabled:
                    backoff = self._calculate_backoff(attempt)
                    logger.warning(
                        f"Connection error, retrying in {backoff:.1f}s "
                        f"(attempt {attempt + 1}/{self._max_retries + 1}): {e}"
                    )
                    time.sleep(backoff)
                    continue
                else:
                    logger.error(f"{error_message}: {e}")
                    raise CatendaAPIError(f"{error_message}: {e}")

            except (CatendaAuthError, CatendaAPIError, CatendaRateLimitError):
                raise

            except requests.exceptions.RequestException as e:
                last_exception = e
                logger.error(f"{error_message}: {e}")
                raise CatendaAPIError(f"{error_message}: {e}")

        # Should not reach here, but just in case
        if last_response is not None:
            raise CatendaAPIError(
                f"{error_message}: HTTP {last_response.status_code}",
                status_code=last_response.status_code,
            )
        raise CatendaAPIError(f"{error_message}: {last_exception}")

    def _safe_request(
        self,
        method: str,
        url: str,
        error_message: str = "API request failed",
        **kwargs,
    ) -> requests.Response | None:
        """
        Wrapper around _make_request that returns None on errors.

        This preserves backward compatibility with existing methods that
        return None on failure instead of raising exceptions.

        Args:
            method: HTTP method (GET, POST, etc.)
            url: Full URL
            error_message: Message prefix for error logging
            **kwargs: Additional arguments for requests

        Returns:
            Response object or None on error
        """
        try:
            return self._make_request(method, url, error_message, **kwargs)
        except (CatendaAuthError, CatendaAPIError, CatendaRateLimitError) as e:
            logger.error(f"{error_message}: {e}")
            return None
