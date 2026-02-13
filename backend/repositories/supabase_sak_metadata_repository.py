"""
Supabase sak metadata repository.

Lagrer sak-metadata i Supabase for effektiv sak-liste og oppslag.

SQL Migration:
```sql
-- ============================================================
-- Sak Metadata Table
-- For case list cache and Catenda topic mapping
-- ============================================================

CREATE TABLE IF NOT EXISTS sak_metadata (
    sak_id TEXT PRIMARY KEY,
    prosjekt_id TEXT,
    catenda_topic_id TEXT,
    catenda_board_id TEXT,
    catenda_project_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT NOT NULL,
    sakstype TEXT DEFAULT 'standard',  -- standard, forsering, endringsordre

    -- Cached fields (oppdateres etter hvert event)
    cached_title TEXT,
    cached_status TEXT,
    last_event_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sak_metadata_prosjekt ON sak_metadata(prosjekt_id);
CREATE INDEX IF NOT EXISTS idx_sak_metadata_catenda_topic ON sak_metadata(catenda_topic_id);
CREATE INDEX IF NOT EXISTS idx_sak_metadata_sakstype ON sak_metadata(sakstype);
CREATE INDEX IF NOT EXISTS idx_sak_metadata_last_event ON sak_metadata(last_event_at DESC);

-- Row Level Security
ALTER TABLE sak_metadata ENABLE ROW LEVEL SECURITY;

-- Service role (backend) has full access
CREATE POLICY "Service role full access on sak_metadata"
ON sak_metadata FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Authenticated users can read
CREATE POLICY "Authenticated users can read sak_metadata"
ON sak_metadata FOR SELECT
USING (auth.role() = 'authenticated');
```
"""

import os
from datetime import datetime

# Supabase Python client
try:
    from supabase import Client, create_client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import with_retry
from models.sak_metadata import SakMetadata


class SupabaseSakMetadataRepository:
    """
    Supabase/PostgreSQL repository for sak metadata.

    Replaces CSV-based storage for cloud deployments.

    Environment variables:
    - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
    - SUPABASE_KEY: Service role key (for backend)
    """

    TABLE_NAME = "sak_metadata"

    def __init__(self, url: str | None = None, key: str | None = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase client not installed. Run: pip install supabase"
            )

        self.url = url or os.environ.get("SUPABASE_URL")
        # Support both SUPABASE_SECRET_KEY (new) and SUPABASE_KEY (legacy)
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_KEY "
                "environment variables or pass them to constructor."
            )

        self.client: Client = create_client(self.url, self.key)

    def _row_to_metadata(self, row: dict) -> SakMetadata:
        """Convert database row to SakMetadata model."""
        return SakMetadata(
            sak_id=row["sak_id"],
            prosjekt_id=row.get("prosjekt_id"),
            catenda_topic_id=row.get("catenda_topic_id"),
            catenda_board_id=row.get("catenda_board_id"),
            catenda_project_id=row.get("catenda_project_id"),
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            if isinstance(row["created_at"], str)
            else row["created_at"],
            created_by=row["created_by"],
            sakstype=row.get("sakstype", "standard"),
            cached_title=row.get("cached_title"),
            cached_status=row.get("cached_status"),
            last_event_at=datetime.fromisoformat(
                row["last_event_at"].replace("Z", "+00:00")
            )
            if row.get("last_event_at") and isinstance(row["last_event_at"], str)
            else row.get("last_event_at"),
            # Cached fields for reporting
            cached_sum_krevd=row.get("cached_sum_krevd"),
            cached_sum_godkjent=row.get("cached_sum_godkjent"),
            cached_dager_krevd=row.get("cached_dager_krevd"),
            cached_dager_godkjent=row.get("cached_dager_godkjent"),
            cached_hovedkategori=row.get("cached_hovedkategori"),
            cached_underkategori=row.get("cached_underkategori"),
            # Forsering-specific cached fields
            cached_forsering_paalopt=row.get("cached_forsering_paalopt"),
            cached_forsering_maks=row.get("cached_forsering_maks"),
        )

    def _metadata_to_row(self, metadata: SakMetadata) -> dict:
        """Convert SakMetadata model to database row."""
        return {
            "sak_id": metadata.sak_id,
            "prosjekt_id": metadata.prosjekt_id,
            "catenda_topic_id": metadata.catenda_topic_id,
            "catenda_board_id": metadata.catenda_board_id,
            "catenda_project_id": metadata.catenda_project_id,
            "created_at": metadata.created_at.isoformat(),
            "created_by": metadata.created_by,
            "sakstype": metadata.sakstype,
            "cached_title": metadata.cached_title,
            "cached_status": metadata.cached_status,
            "last_event_at": metadata.last_event_at.isoformat()
            if metadata.last_event_at
            else None,
            # Cached fields for reporting
            "cached_sum_krevd": metadata.cached_sum_krevd,
            "cached_sum_godkjent": metadata.cached_sum_godkjent,
            "cached_dager_krevd": metadata.cached_dager_krevd,
            "cached_dager_godkjent": metadata.cached_dager_godkjent,
            "cached_hovedkategori": metadata.cached_hovedkategori,
            "cached_underkategori": metadata.cached_underkategori,
            # Forsering-specific cached fields
            "cached_forsering_paalopt": metadata.cached_forsering_paalopt,
            "cached_forsering_maks": metadata.cached_forsering_maks,
        }

    @with_retry()
    def create(self, metadata: SakMetadata) -> None:
        """Create new case metadata entry."""
        row = self._metadata_to_row(metadata)
        self.client.table(self.TABLE_NAME).insert(row).execute()

    @with_retry()
    def get(self, sak_id: str) -> SakMetadata | None:
        """Get case metadata by ID."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("sak_id", sak_id)
            .limit(1)
            .execute()
        )

        if result.data:
            return self._row_to_metadata(result.data[0])
        return None

    @with_retry()
    def update_cache(
        self,
        sak_id: str,
        cached_title: str | None = None,
        cached_status: str | None = None,
        last_event_at: datetime | None = None,
        # Reporting fields
        cached_sum_krevd: float | None = None,
        cached_sum_godkjent: float | None = None,
        cached_dager_krevd: int | None = None,
        cached_dager_godkjent: int | None = None,
        cached_hovedkategori: str | None = None,
        cached_underkategori: str | None = None,
        # Forsering-specific cached fields
        cached_forsering_paalopt: float | None = None,
        cached_forsering_maks: float | None = None,
    ) -> None:
        """
        Update cached fields for a case.

        Called after every event submission to keep metadata in sync.
        """
        updates = {}

        if cached_title is not None:
            updates["cached_title"] = cached_title
        if cached_status is not None:
            updates["cached_status"] = cached_status
        if last_event_at is not None:
            updates["last_event_at"] = last_event_at.isoformat()
        # Reporting fields
        if cached_sum_krevd is not None:
            updates["cached_sum_krevd"] = cached_sum_krevd
        if cached_sum_godkjent is not None:
            updates["cached_sum_godkjent"] = cached_sum_godkjent
        if cached_dager_krevd is not None:
            updates["cached_dager_krevd"] = cached_dager_krevd
        if cached_dager_godkjent is not None:
            updates["cached_dager_godkjent"] = cached_dager_godkjent
        if cached_hovedkategori is not None:
            updates["cached_hovedkategori"] = cached_hovedkategori
        if cached_underkategori is not None:
            updates["cached_underkategori"] = cached_underkategori
        # Forsering-specific cached fields
        if cached_forsering_paalopt is not None:
            updates["cached_forsering_paalopt"] = cached_forsering_paalopt
        if cached_forsering_maks is not None:
            updates["cached_forsering_maks"] = cached_forsering_maks

        if updates:
            self.client.table(self.TABLE_NAME).update(updates).eq(
                "sak_id", sak_id
            ).execute()

    @with_retry()
    def get_by_topic_id(self, topic_id: str) -> SakMetadata | None:
        """Get case metadata by Catenda topic ID."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("catenda_topic_id", topic_id)
            .limit(1)
            .execute()
        )

        if result.data:
            return self._row_to_metadata(result.data[0])
        return None

    def _get_project_id(self, prosjekt_id: str | None = None) -> str:
        """Get project ID from parameter or Flask context."""
        if prosjekt_id:
            return prosjekt_id
        from lib.project_context import get_project_id

        return get_project_id()

    @with_retry()
    def list_all(self, prosjekt_id: str | None = None) -> list[SakMetadata]:
        """List all cases for a project (for case list view)."""
        pid = self._get_project_id(prosjekt_id)
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("prosjekt_id", pid)
            .order("last_event_at", desc=True, nullsfirst=False)
            .execute()
        )

        return [self._row_to_metadata(row) for row in result.data]

    @with_retry()
    def list_by_sakstype(self, sakstype: str, prosjekt_id: str | None = None) -> list[SakMetadata]:
        """List cases filtered by sakstype within a project."""
        pid = self._get_project_id(prosjekt_id)
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("prosjekt_id", pid)
            .eq("sakstype", sakstype)
            .order("last_event_at", desc=True, nullsfirst=False)
            .execute()
        )

        return [self._row_to_metadata(row) for row in result.data]

    @with_retry()
    def count_by_sakstype(self, sakstype: str, prosjekt_id: str | None = None) -> int:
        """Count cases by sakstype within a project. Uses indexed columns."""
        pid = self._get_project_id(prosjekt_id)
        result = (
            self.client.table(self.TABLE_NAME)
            .select("sak_id", count="exact")
            .eq("prosjekt_id", pid)
            .eq("sakstype", sakstype)
            .execute()
        )
        return result.count or 0

    @with_retry()
    def delete(self, sak_id: str) -> bool:
        """Delete case metadata by ID."""
        result = (
            self.client.table(self.TABLE_NAME).delete().eq("sak_id", sak_id).execute()
        )

        # Supabase returns the deleted rows
        return len(result.data) > 0

    @with_retry()
    def exists(self, sak_id: str) -> bool:
        """Check if case exists."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("sak_id")
            .eq("sak_id", sak_id)
            .limit(1)
            .execute()
        )

        return len(result.data) > 0

    @with_retry()
    def upsert(self, metadata: SakMetadata) -> None:
        """
        Insert or update case metadata.

        Useful when you're not sure if the case exists.
        """
        row = self._metadata_to_row(metadata)
        self.client.table(self.TABLE_NAME).upsert(row).execute()


# Factory function for easy switching
def create_metadata_repository(backend: str | None = None, **kwargs):
    """
    Factory for creating metadata repository.

    Args:
        backend: "csv", "supabase", or None (auto-detect from env)
        **kwargs: Backend-specific configuration

    Environment Variables:
        METADATA_STORE_BACKEND: "csv" (default) or "supabase"
        (Falls back to EVENT_STORE_BACKEND if not set)

    Examples:
        # Automatic (reads env vars)
        repo = create_metadata_repository()

        # Local development
        repo = create_metadata_repository("csv", csv_path="koe_data/saker.csv")

        # Supabase
        repo = create_metadata_repository("supabase")
    """
    if backend is None:
        # Check METADATA_STORE_BACKEND first, then fall back to EVENT_STORE_BACKEND
        backend = os.environ.get(
            "METADATA_STORE_BACKEND", os.environ.get("EVENT_STORE_BACKEND", "csv")
        )

    if backend == "csv" or backend == "json":
        from .sak_metadata_repository import SakMetadataRepository

        return SakMetadataRepository(**kwargs)

    elif backend == "supabase":
        return SupabaseSakMetadataRepository(**kwargs)

    else:
        raise ValueError(f"Unknown backend: {backend}")
