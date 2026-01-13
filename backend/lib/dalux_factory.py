"""
Dalux Client Factory

Provides factory functions for creating DaluxClient and DaluxSyncService instances.
"""
import os
from typing import Optional

from integrations.dalux import DaluxClient
from utils.logger import get_logger

logger = get_logger(__name__)


def get_dalux_client(
    api_key: Optional[str] = None,
    base_url: Optional[str] = None
) -> Optional[DaluxClient]:
    """
    Factory for creating DaluxClient instances.

    Args:
        api_key: Dalux API key. If not provided, reads from DALUX_TEST_API_KEY env.
        base_url: Dalux base URL. If not provided, reads from DALUX_DEFAULT_BASE_URL env.

    Returns:
        Configured DaluxClient instance, or None if not configured.

    Example:
        # From environment
        client = get_dalux_client()

        # With explicit credentials
        client = get_dalux_client(
            api_key="your-key",
            base_url="https://node1.field.dalux.com/service/api/"
        )
    """
    api_key = api_key or os.environ.get("DALUX_TEST_API_KEY")
    base_url = base_url or os.environ.get("DALUX_DEFAULT_BASE_URL")

    if not api_key:
        logger.debug("Dalux not configured - no API key")
        return None

    if not base_url:
        logger.debug("Dalux not configured - no base URL")
        return None

    return DaluxClient(api_key=api_key, base_url=base_url)


def get_dalux_client_for_mapping(mapping) -> DaluxClient:
    """
    Create DaluxClient from a DaluxCatendaSyncMapping.

    Args:
        mapping: DaluxCatendaSyncMapping instance

    Returns:
        Configured DaluxClient instance

    Raises:
        ValueError: If mapping is missing required fields
    """
    if not mapping.dalux_api_key:
        raise ValueError("Mapping is missing dalux_api_key")

    if not mapping.dalux_base_url:
        raise ValueError("Mapping is missing dalux_base_url")

    return DaluxClient(
        api_key=mapping.dalux_api_key,
        base_url=mapping.dalux_base_url
    )
