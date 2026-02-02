"""
Dalux Client Factory

Provides factory functions for creating DaluxClient and DaluxSyncService instances.
"""

import os

from integrations.dalux import DaluxClient
from utils.logger import get_logger

logger = get_logger(__name__)


def get_dalux_api_key() -> str | None:
    """
    Get Dalux API key from environment.

    Checks DALUX_API_KEY first, then falls back to DALUX_TEST_API_KEY for backwards compatibility.

    Returns:
        API key or None if not configured.
    """
    return os.environ.get("DALUX_API_KEY") or os.environ.get("DALUX_TEST_API_KEY")


def get_dalux_client(
    api_key: str | None = None, base_url: str | None = None
) -> DaluxClient | None:
    """
    Factory for creating DaluxClient instances.

    Args:
        api_key: Dalux API key. If not provided, reads from DALUX_API_KEY env.
        base_url: Dalux base URL. If not provided, reads from DALUX_BASE_URL env.

    Returns:
        Configured DaluxClient instance, or None if not configured/disabled.

    Example:
        # From environment
        client = get_dalux_client()

        # With explicit credentials
        client = get_dalux_client(
            api_key="your-key",
            base_url="https://node1.field.dalux.com/service/api/"
        )
    """
    # Check if Dalux is explicitly disabled
    from core.config import settings

    if not settings.is_dalux_enabled:
        logger.debug("Dalux integration disabled (DALUX_ENABLED=false)")
        return None

    api_key = api_key or get_dalux_api_key()
    base_url = (
        base_url
        or os.environ.get("DALUX_BASE_URL")
        or os.environ.get("DALUX_DEFAULT_BASE_URL")
    )

    if not api_key:
        logger.debug("Dalux not configured - no API key (set DALUX_API_KEY)")
        return None

    if not base_url:
        logger.debug("Dalux not configured - no base URL (set DALUX_BASE_URL)")
        return None

    return DaluxClient(api_key=api_key, base_url=base_url)


def get_dalux_client_for_mapping(mapping) -> DaluxClient:
    """
    Create DaluxClient from a DaluxCatendaSyncMapping.

    API key is read from environment (DALUX_API_KEY), not from the mapping.
    Base URL can come from mapping or environment.

    Args:
        mapping: DaluxCatendaSyncMapping instance

    Returns:
        Configured DaluxClient instance

    Raises:
        ValueError: If required configuration is missing
    """
    api_key = get_dalux_api_key()
    if not api_key:
        raise ValueError("DALUX_API_KEY environment variable not set")

    base_url = mapping.dalux_base_url or os.environ.get("DALUX_BASE_URL")
    if not base_url:
        raise ValueError("Mapping is missing dalux_base_url and DALUX_BASE_URL not set")

    return DaluxClient(api_key=api_key, base_url=base_url)
