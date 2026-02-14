"""
Repository for BIM link CRUD operations in Supabase.
"""

import os
from datetime import UTC, datetime

try:
    from supabase import Client, create_client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import with_retry
from models.bim_link import BimLink, BimLinkCreate, CatendaModelCache


class BimLinkRepository:
    """CRUD for sak_bim_links table."""

    TABLE_NAME = "sak_bim_links"
    MODELS_CACHE_TABLE = "catenda_models_cache"

    def __init__(self, url: str | None = None, key: str | None = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed")
        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )
        if not self.url or not self.key:
            raise ValueError("Supabase credentials required")
        self.client: Client = create_client(self.url, self.key)

    @with_retry()
    def get_links_for_sak(self, sak_id: str) -> list[BimLink]:
        """Get all BIM links for a case."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("sak_id", sak_id)
            .order("fag")
            .order("model_name")
            .execute()
        )
        return [BimLink(**row) for row in (result.data or [])]

    @with_retry()
    def create_link(
        self, sak_id: str, link: BimLinkCreate, linked_by: str
    ) -> BimLink:
        """Create a new BIM link."""
        row = {
            "sak_id": sak_id,
            "linked_by": linked_by,
            **link.model_dump(exclude_none=True),
        }
        result = self.client.table(self.TABLE_NAME).insert(row).execute()
        return BimLink(**(result.data[0]))

    @with_retry()
    def delete_link(self, link_id: int) -> bool:
        """Delete a BIM link by ID."""
        result = (
            self.client.table(self.TABLE_NAME)
            .delete()
            .eq("id", link_id)
            .execute()
        )
        return len(result.data or []) > 0

    @with_retry()
    def get_cached_models(self, prosjekt_id: str) -> list[CatendaModelCache]:
        """Get cached Catenda models for a project."""
        result = (
            self.client.table(self.MODELS_CACHE_TABLE)
            .select("*")
            .eq("prosjekt_id", prosjekt_id)
            .order("fag")
            .order("model_name")
            .execute()
        )
        return [CatendaModelCache(**row) for row in (result.data or [])]

    @with_retry()
    def upsert_cached_models(self, models: list[CatendaModelCache]) -> int:
        """Upsert model cache entries. Returns count of upserted rows."""
        if not models:
            return 0
        rows = [m.model_dump(exclude={"id"}) for m in models]
        for row in rows:
            row["updated_at"] = datetime.now(UTC).isoformat()
        result = (
            self.client.table(self.MODELS_CACHE_TABLE)
            .upsert(rows, on_conflict="catenda_project_id,model_id")
            .execute()
        )
        return len(result.data or [])
