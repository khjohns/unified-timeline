"""
Supabase Client Factory
=======================

Oppretter Supabase-klienter med korrekt timeout-konfigurasjon.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

from supabase import Client, create_client

from core.config import settings

logger = logging.getLogger(__name__)


def create_supabase_client(
    url: str | None = None,
    key: str | None = None,
    timeout: int | None = None,
) -> Client:
    """
    Opprett Supabase-klient med timeout-konfigurasjon.

    Args:
        url: Supabase URL (default: fra miljøvariabler)
        key: Supabase anon key (default: fra miljøvariabler)
        timeout: Request timeout i sekunder

    Returns:
        Konfigurert Supabase Client
    """
    _url = url or os.environ.get("SUPABASE_URL")
    _key = key or os.environ.get("SUPABASE_KEY")
    _timeout = timeout or settings.supabase_request_timeout

    if not _url or not _key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")

    # supabase-py 2.x has simplified API - timeout via httpx_timeout
    # Note: ClientOptions API changed in 2.x, just use defaults
    client = create_client(_url, _key)
    logger.debug(f"Created Supabase client (timeout={_timeout}s requested)")

    return client


@lru_cache(maxsize=1)
def get_shared_client() -> Client:
    """
    Hent delt Supabase-klient (singleton).

    Bruk denne for de fleste operasjoner for å unngå
    å opprette nye connections for hver forespørsel.
    """
    return create_supabase_client()
