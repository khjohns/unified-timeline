"""
Catenda Client Factory

Provides a centralized factory for creating authenticated CatendaClient instances.
This eliminates duplication across routes that need Catenda integration.
"""
from typing import Optional

from integrations.catenda import CatendaClient
from core.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)


def get_catenda_client(with_auth: bool = True) -> Optional[CatendaClient]:
    """
    Factory for creating authenticated CatendaClient instances.

    Creates a CatendaClient configured from settings, optionally with
    authentication already performed.

    Args:
        with_auth: If True (default), authenticate the client before returning.
                   Set to False if you need an unauthenticated client.

    Returns:
        Configured CatendaClient instance, or None if not configured.

    Example:
        client = get_catenda_client()
        if client:
            topics = client.list_topics()
    """
    if not settings.catenda_client_id:
        logger.debug("Catenda not configured - no client_id")
        return None

    client = CatendaClient(
        client_id=settings.catenda_client_id,
        client_secret=settings.catenda_client_secret
    )

    if settings.catenda_topic_board_id:
        client.topic_board_id = settings.catenda_topic_board_id

    if with_auth:
        # Use static access token if available (most common for non-Boost users)
        if settings.catenda_access_token:
            client.set_access_token(settings.catenda_access_token)
        elif settings.catenda_client_secret:
            # Try client credentials (only works for Catenda Boost customers)
            client.authenticate()

    return client
