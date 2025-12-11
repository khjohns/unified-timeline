"""
Supabase event store implementation.

Uses PostgreSQL via Supabase for event storage with:
- Native JSONB for event payloads
- Row Level Security for TE/BH separation
- Optimistic locking via version constraint

Setup required:
1. Create Supabase project at supabase.com
2. Run the SQL migration below
3. Set environment variables

SQL Migration:
```sql
-- Events table with optimistic locking
CREATE TABLE koe_events (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    tidsstempel TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktor TEXT NOT NULL,
    aktor_rolle TEXT NOT NULL CHECK (aktor_rolle IN ('TE', 'BH')),
    data JSONB NOT NULL,
    kommentar TEXT,
    referrer_til_event_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- For optimistic locking
    versjon INTEGER NOT NULL,
    CONSTRAINT unique_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for common queries
CREATE INDEX idx_events_sak_id ON koe_events(sak_id);
CREATE INDEX idx_events_tidsstempel ON koe_events(tidsstempel);
CREATE INDEX idx_events_event_type ON koe_events(event_type);

-- Row Level Security (optional - for direct client access)
ALTER TABLE koe_events ENABLE ROW LEVEL SECURITY;

-- View for current version per case
CREATE VIEW koe_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version
FROM koe_events
GROUP BY sak_id;
```
"""

from typing import List, Tuple, Optional
import os
from datetime import datetime

# Supabase Python client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from .event_repository import EventRepository, ConcurrencyError


class SupabaseEventRepository(EventRepository):
    """
    Supabase/PostgreSQL event store.

    Advantages over JSON files:
    - Native JSONB (no serialization overhead)
    - ACID transactions
    - Row Level Security
    - Indexes for fast queries
    - Easy migration path to Dataverse (similar concepts)

    Environment variables:
    - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
    - SUPABASE_KEY: Service role key (for backend) or anon key
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
        table_name: str = "koe_events"
    ):
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase client not installed. Run: pip install supabase"
            )

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_KEY")
        self.table_name = table_name

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_KEY "
                "environment variables or pass them to constructor."
            )

        self.client: Client = create_client(self.url, self.key)

    def append(self, event, expected_version: int) -> int:
        """Append single event with optimistic locking."""
        return self.append_batch([event], expected_version)

    def append_batch(self, events: List, expected_version: int) -> int:
        """
        Atomically append multiple events.

        Uses PostgreSQL's unique constraint for optimistic locking:
        - If version already exists, insert fails
        - Transaction ensures all-or-nothing
        """
        if not events:
            raise ValueError("Kan ikke legge til tom event-liste")

        sak_id = events[0].sak_id
        if not all(e.sak_id == sak_id for e in events):
            raise ValueError("Alle events må tilhøre samme sak_id")

        # Check current version first
        current_version = self._get_current_version(sak_id)

        if current_version != expected_version:
            raise ConcurrencyError(expected_version, current_version)

        # Prepare rows for insert
        rows = []
        for i, event in enumerate(events):
            version = expected_version + i + 1

            # Convert Pydantic model to dict
            event_dict = event.model_dump(mode='json')

            rows.append({
                "event_id": str(event_dict.get("event_id")),
                "sak_id": sak_id,
                "event_type": event_dict.get("event_type"),
                "tidsstempel": event_dict.get("tidsstempel"),
                "aktor": event_dict.get("aktor"),
                "aktor_rolle": event_dict.get("aktor_rolle"),
                "data": event_dict.get("data"),  # JSONB - no serialization needed!
                "kommentar": event_dict.get("kommentar"),
                "referrer_til_event_id": str(event_dict.get("referrer_til_event_id"))
                    if event_dict.get("referrer_til_event_id") else None,
                "versjon": version,
            })

        try:
            # Insert all rows - unique constraint handles race conditions
            result = self.client.table(self.table_name).insert(rows).execute()

            return expected_version + len(events)

        except Exception as e:
            # Check if it's a unique constraint violation (version conflict)
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str:
                # Re-fetch actual version
                actual_version = self._get_current_version(sak_id)
                raise ConcurrencyError(expected_version, actual_version)
            raise

    def get_events(self, sak_id: str) -> Tuple[List[dict], int]:
        """
        Get all events and current version for a case.

        Returns events ordered by version (chronologically).
        """
        result = (
            self.client
            .table(self.table_name)
            .select("*")
            .eq("sak_id", sak_id)
            .order("versjon", desc=False)
            .execute()
        )

        events = result.data if result.data else []

        if not events:
            return [], 0

        # Convert back to expected format (matching JsonFileEventRepository)
        formatted_events = []
        for row in events:
            formatted_events.append({
                "event_id": row["event_id"],
                "sak_id": row["sak_id"],
                "event_type": row["event_type"],
                "tidsstempel": row["tidsstempel"],
                "aktor": row["aktor"],
                "aktor_rolle": row["aktor_rolle"],
                "data": row["data"],  # Already dict from JSONB
                "kommentar": row.get("kommentar"),
                "referrer_til_event_id": row.get("referrer_til_event_id"),
            })

        current_version = events[-1]["versjon"] if events else 0

        return formatted_events, current_version

    def _get_current_version(self, sak_id: str) -> int:
        """Get current version for a case (0 if not exists)."""
        result = (
            self.client
            .table(self.table_name)
            .select("versjon")
            .eq("sak_id", sak_id)
            .order("versjon", desc=True)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]["versjon"]
        return 0

    def get_all_sak_ids(self) -> List[str]:
        """Get all unique sak_ids (for sakliste)."""
        result = (
            self.client
            .table(self.table_name)
            .select("sak_id")
            .execute()
        )

        # Unique sak_ids
        return list(set(row["sak_id"] for row in result.data))

    def get_events_by_type(
        self,
        sak_id: str,
        event_type: str
    ) -> List[dict]:
        """Get events of specific type (useful for debugging)."""
        result = (
            self.client
            .table(self.table_name)
            .select("*")
            .eq("sak_id", sak_id)
            .eq("event_type", event_type)
            .order("versjon", desc=False)
            .execute()
        )

        return result.data if result.data else []


# Factory function for easy switching
def create_event_repository(backend: str = "json", **kwargs) -> EventRepository:
    """
    Factory for creating event repository.

    Args:
        backend: "json", "supabase", or "dataverse" (future)
        **kwargs: Backend-specific configuration

    Examples:
        # Local development
        repo = create_event_repository("json", base_path="koe_data/events")

        # Supabase testing
        repo = create_event_repository("supabase")

        # Production (future)
        repo = create_event_repository("dataverse", environment_url="...")
    """
    if backend == "json":
        from .event_repository import JsonFileEventRepository
        return JsonFileEventRepository(**kwargs)

    elif backend == "supabase":
        return SupabaseEventRepository(**kwargs)

    elif backend == "dataverse":
        # Future implementation
        raise NotImplementedError(
            "Dataverse repository not yet implemented. "
            "See docs/TECHNOLOGY_COMPARISON.md for migration plan."
        )

    else:
        raise ValueError(f"Unknown backend: {backend}")
