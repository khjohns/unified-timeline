"""
Supabase event store implementation med CloudEvents-støtte.

Støtter tre tabeller for ulike sakstyper:
- koe_events: Standard/KOE-saker
- forsering_events: Forseringssaker (§33.8)
- endringsordre_events: Endringsordresaker (§31.3)

Bruker CloudEvents v1.0 format for event serialisering.

Setup required:
1. Create Supabase project at supabase.com
2. Run the SQL migration below
3. Set environment variables

SQL Migration:
```sql
-- ============================================================
-- Unified Timeline Event Tables
-- Supports: Standard/KOE, Forsering, Endringsordre
-- Format: CloudEvents v1.0
-- ============================================================

-- Standard/KOE Events Table
CREATE TABLE IF NOT EXISTS koe_events (
    id SERIAL PRIMARY KEY,

    -- CloudEvents Required Attributes (v1.0)
    specversion TEXT NOT NULL DEFAULT '1.0',
    event_id UUID NOT NULL UNIQUE,  -- 'id' in CloudEvents
    source TEXT NOT NULL,           -- /projects/{prosjekt_id}/cases/{sak_id}
    type TEXT NOT NULL,             -- no.oslo.koe.{event_type}

    -- CloudEvents Optional Attributes
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT NOT NULL,          -- sak_id
    datacontenttype TEXT DEFAULT 'application/json',

    -- CloudEvents Extension Attributes
    actor TEXT NOT NULL,            -- aktor
    actorrole TEXT NOT NULL CHECK (actorrole IN ('TE', 'BH')),
    comment TEXT,                   -- kommentar
    referstoid UUID,                -- refererer_til_event_id

    -- CloudEvents Data Payload
    data JSONB NOT NULL,

    -- Internal: For optimistic locking and queries
    sak_id TEXT NOT NULL,           -- Denormalized for efficient queries
    event_type TEXT NOT NULL,       -- Denormalized for filtering
    versjon INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_koe_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for koe_events
CREATE INDEX IF NOT EXISTS idx_koe_events_sak_id ON koe_events(sak_id);
CREATE INDEX IF NOT EXISTS idx_koe_events_time ON koe_events(time);
CREATE INDEX IF NOT EXISTS idx_koe_events_type ON koe_events(type);
CREATE INDEX IF NOT EXISTS idx_koe_events_subject ON koe_events(subject);

-- Forsering Events Table (same structure)
CREATE TABLE IF NOT EXISTS forsering_events (
    id SERIAL PRIMARY KEY,

    -- CloudEvents Required Attributes (v1.0)
    specversion TEXT NOT NULL DEFAULT '1.0',
    event_id UUID NOT NULL UNIQUE,
    source TEXT NOT NULL,
    type TEXT NOT NULL,

    -- CloudEvents Optional Attributes
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT NOT NULL,
    datacontenttype TEXT DEFAULT 'application/json',

    -- CloudEvents Extension Attributes
    actor TEXT NOT NULL,
    actorrole TEXT NOT NULL CHECK (actorrole IN ('TE', 'BH')),
    comment TEXT,
    referstoid UUID,

    -- CloudEvents Data Payload
    data JSONB NOT NULL,

    -- Internal
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    versjon INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_forsering_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for forsering_events
CREATE INDEX IF NOT EXISTS idx_forsering_events_sak_id ON forsering_events(sak_id);
CREATE INDEX IF NOT EXISTS idx_forsering_events_time ON forsering_events(time);
CREATE INDEX IF NOT EXISTS idx_forsering_events_type ON forsering_events(type);

-- Endringsordre Events Table (same structure)
CREATE TABLE IF NOT EXISTS endringsordre_events (
    id SERIAL PRIMARY KEY,

    -- CloudEvents Required Attributes (v1.0)
    specversion TEXT NOT NULL DEFAULT '1.0',
    event_id UUID NOT NULL UNIQUE,
    source TEXT NOT NULL,
    type TEXT NOT NULL,

    -- CloudEvents Optional Attributes
    time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT NOT NULL,
    datacontenttype TEXT DEFAULT 'application/json',

    -- CloudEvents Extension Attributes
    actor TEXT NOT NULL,
    actorrole TEXT NOT NULL CHECK (actorrole IN ('TE', 'BH')),
    comment TEXT,
    referstoid UUID,

    -- CloudEvents Data Payload
    data JSONB NOT NULL,

    -- Internal
    sak_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    versjon INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_eo_sak_version UNIQUE (sak_id, versjon)
);

-- Indexes for endringsordre_events
CREATE INDEX IF NOT EXISTS idx_eo_events_sak_id ON endringsordre_events(sak_id);
CREATE INDEX IF NOT EXISTS idx_eo_events_time ON endringsordre_events(time);
CREATE INDEX IF NOT EXISTS idx_eo_events_type ON endringsordre_events(type);

-- Row Level Security (optional - for direct client access)
ALTER TABLE koe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE forsering_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE endringsordre_events ENABLE ROW LEVEL SECURITY;

-- Views for current version per case
CREATE OR REPLACE VIEW koe_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version
FROM koe_events
GROUP BY sak_id;

CREATE OR REPLACE VIEW forsering_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version
FROM forsering_events
GROUP BY sak_id;

CREATE OR REPLACE VIEW endringsordre_sak_versions AS
SELECT sak_id, MAX(versjon) as current_version
FROM endringsordre_events
GROUP BY sak_id;
```
"""

from typing import List, Tuple, Optional, Literal
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
from models.cloudevents import CLOUDEVENTS_NAMESPACE, CLOUDEVENTS_SPECVERSION


# Type for table selection
SaksType = Literal["standard", "forsering", "endringsordre", "fravik"]

# Mapping from sakstype to table name
SAKSTYPE_TO_TABLE = {
    "standard": "koe_events",
    "forsering": "forsering_events",
    "endringsordre": "endringsordre_events",
    "fravik": "fravik_events",
}


class SupabaseEventRepository(EventRepository):
    """
    Supabase/PostgreSQL event store med CloudEvents-format.

    Støtter tre tabeller basert på sakstype:
    - koe_events: Standard/KOE-saker
    - forsering_events: Forseringssaker
    - endringsordre_events: Endringsordresaker

    Advantages over JSON files:
    - Native JSONB (no serialization overhead)
    - ACID transactions
    - Row Level Security
    - Indexes for fast queries
    - CloudEvents v1.0 compliant storage

    Environment variables:
    - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
    - SUPABASE_KEY: Service role key (for backend) or anon key
    """

    def __init__(
        self,
        url: Optional[str] = None,
        key: Optional[str] = None,
        default_table: str = "koe_events"
    ):
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase client not installed. Run: pip install supabase"
            )

        self.url = url or os.environ.get("SUPABASE_URL")
        # Support both SUPABASE_SECRET_KEY (new) and SUPABASE_KEY (legacy)
        self.key = key or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")
        self.default_table = default_table

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_KEY "
                "environment variables or pass them to constructor."
            )

        self.client: Client = create_client(self.url, self.key)

    def _get_table_name(self, sakstype: Optional[SaksType] = None) -> str:
        """Get table name based on sakstype."""
        if sakstype is None:
            return self.default_table
        return SAKSTYPE_TO_TABLE.get(sakstype, self.default_table)

    def _detect_sakstype_from_event(self, event) -> SaksType:
        """
        Detect sakstype from event.

        Checks event_type or sakstype attribute to determine correct table.
        """
        event_type = getattr(event, 'event_type', None)
        if event_type:
            event_type_value = event_type.value if hasattr(event_type, 'value') else str(event_type)

            # Fravik events
            if event_type_value.startswith('fravik_'):
                return "fravik"

            # Forsering events
            if event_type_value.startswith('forsering_'):
                return "forsering"

            # Endringsordre events
            if event_type_value.startswith('eo_'):
                return "endringsordre"

        # Check for sakstype attribute (on SakOpprettetEvent)
        sakstype = getattr(event, 'sakstype', None)
        if sakstype:
            if sakstype in SAKSTYPE_TO_TABLE:
                return sakstype

        # Default to standard
        return "standard"

    def _event_to_cloudevent_row(self, event, version: int) -> dict:
        """
        Convert event to CloudEvents-format row for database.

        Uses the event's to_cloudevent() method if available,
        otherwise constructs CloudEvents attributes manually.
        """
        sak_id = event.sak_id

        # Try to use to_cloudevent() if available (from CloudEventMixin)
        if hasattr(event, 'to_cloudevent'):
            ce = event.to_cloudevent()
        else:
            # Manual construction for events without mixin
            event_dict = event.model_dump(mode='json')
            event_type = event_dict.get("event_type")
            if hasattr(event_type, 'value'):
                event_type = event_type.value

            ce = {
                "specversion": CLOUDEVENTS_SPECVERSION,
                "id": str(event_dict.get("event_id")),
                "source": f"/projects/unknown/cases/{sak_id}",
                "type": f"{CLOUDEVENTS_NAMESPACE}.{event_type}",
                "time": event_dict.get("tidsstempel"),
                "subject": sak_id,
                "datacontenttype": "application/json",
                "actor": event_dict.get("aktor"),
                "actorrole": event_dict.get("aktor_rolle"),
                "comment": event_dict.get("kommentar"),
                "referstoid": event_dict.get("referrer_til_event_id"),
                "data": event_dict.get("data"),
            }

        # Build database row from CloudEvent
        row = {
            # CloudEvents Required
            "specversion": ce.get("specversion", CLOUDEVENTS_SPECVERSION),
            "event_id": str(ce.get("id")),
            "source": ce.get("source"),
            "type": ce.get("type"),

            # CloudEvents Optional
            "time": ce.get("time"),
            "subject": ce.get("subject", sak_id),
            "datacontenttype": ce.get("datacontenttype", "application/json"),

            # CloudEvents Extension
            "actor": ce.get("actor"),
            "actorrole": ce.get("actorrole"),
            "comment": ce.get("comment"),
            "referstoid": str(ce.get("referstoid")) if ce.get("referstoid") else None,

            # Data payload
            "data": ce.get("data", {}),

            # Internal fields
            "sak_id": sak_id,
            "event_type": ce.get("type", "").replace(f"{CLOUDEVENTS_NAMESPACE}.", ""),
            "versjon": version,
        }

        return row

    def _row_to_event_dict(self, row: dict) -> dict:
        """
        Convert database row (CloudEvents format) to internal event dict.

        Transforms CloudEvents attributes back to internal model structure.
        """
        # Convert Supabase timestamp format to ISO 8601
        # Supabase returns: "2025-12-22 11:33:01.352433+00"
        # Pydantic expects: "2025-12-22T11:33:01.352433+00:00"
        time_value = row.get("time")
        if time_value and isinstance(time_value, str):
            # Replace space with T for ISO 8601 compliance
            time_value = time_value.replace(" ", "T")
            # Fix timezone format: +00 -> +00:00
            if time_value.endswith("+00"):
                time_value = time_value + ":00"
            elif time_value.endswith("-00"):
                time_value = time_value[:-3] + "-00:00"

        return {
            "event_id": row.get("event_id"),
            "sak_id": row.get("sak_id") or row.get("subject"),
            "event_type": row.get("event_type") or row.get("type", "").replace(f"{CLOUDEVENTS_NAMESPACE}.", ""),
            "tidsstempel": time_value,
            "aktor": row.get("actor"),
            "aktor_rolle": row.get("actorrole"),
            "data": row.get("data"),
            "kommentar": row.get("comment"),
            "refererer_til_event_id": row.get("referstoid"),  # Fixed: was "referrer_til_event_id"
            # Include CloudEvents attributes for clients that want them
            "_cloudevents": {
                "specversion": row.get("specversion"),
                "source": row.get("source"),
                "type": row.get("type"),
                "subject": row.get("subject"),
                "datacontenttype": row.get("datacontenttype"),
            }
        }

    def append(
        self,
        event,
        expected_version: int,
        sakstype: Optional[SaksType] = None
    ) -> int:
        """Append single event with optimistic locking."""
        return self.append_batch([event], expected_version, sakstype)

    def append_batch(
        self,
        events: List,
        expected_version: int,
        sakstype: Optional[SaksType] = None
    ) -> int:
        """
        Atomically append multiple events.

        Uses PostgreSQL's unique constraint for optimistic locking:
        - If version already exists, insert fails
        - Transaction ensures all-or-nothing

        Args:
            events: List of events to append
            expected_version: Expected current version (0 for new case)
            sakstype: Optional sakstype to determine table.
                      If None, auto-detects from first event.
        """
        if not events:
            raise ValueError("Kan ikke legge til tom event-liste")

        sak_id = events[0].sak_id
        if not all(e.sak_id == sak_id for e in events):
            raise ValueError("Alle events må tilhøre samme sak_id")

        # Determine table
        if sakstype is None:
            sakstype = self._detect_sakstype_from_event(events[0])
        table_name = self._get_table_name(sakstype)

        # Check current version first
        current_version = self._get_current_version(sak_id, table_name)

        if current_version != expected_version:
            raise ConcurrencyError(expected_version, current_version)

        # Prepare rows for insert
        rows = []
        for i, event in enumerate(events):
            version = expected_version + i + 1
            row = self._event_to_cloudevent_row(event, version)
            rows.append(row)

        try:
            # Insert all rows - unique constraint handles race conditions
            self.client.table(table_name).insert(rows).execute()
            return expected_version + len(events)

        except Exception as e:
            # Check if it's a unique constraint violation (version conflict)
            error_str = str(e).lower()
            if "unique" in error_str or "duplicate" in error_str:
                # Re-fetch actual version
                actual_version = self._get_current_version(sak_id, table_name)
                raise ConcurrencyError(expected_version, actual_version)
            raise

    def get_events(
        self,
        sak_id: str,
        sakstype: Optional[SaksType] = None
    ) -> Tuple[List[dict], int]:
        """
        Get all events and current version for a case.

        Returns events ordered by version (chronologically).

        Args:
            sak_id: Case ID to fetch events for
            sakstype: Optional sakstype to determine table.
                      If None, searches all tables.

        Returns:
            Tuple of (events_list, current_version)
        """
        if sakstype is not None:
            # Single table lookup
            table_name = self._get_table_name(sakstype)
            return self._get_events_from_table(sak_id, table_name)

        # Try all tables (for backwards compatibility)
        for table in ["koe_events", "forsering_events", "endringsordre_events"]:
            try:
                events, version = self._get_events_from_table(sak_id, table)
                if events:
                    return events, version
            except Exception:
                continue

        return [], 0

    def _get_events_from_table(
        self,
        sak_id: str,
        table_name: str
    ) -> Tuple[List[dict], int]:
        """Get events from a specific table."""
        result = (
            self.client
            .table(table_name)
            .select("*")
            .eq("sak_id", sak_id)
            .order("versjon", desc=False)
            .execute()
        )

        events = result.data if result.data else []

        if not events:
            return [], 0

        # Convert to internal format
        formatted_events = [self._row_to_event_dict(row) for row in events]
        current_version = events[-1]["versjon"] if events else 0

        return formatted_events, current_version

    def _get_current_version(
        self,
        sak_id: str,
        table_name: Optional[str] = None
    ) -> int:
        """Get current version for a case (0 if not exists)."""
        if table_name is None:
            table_name = self.default_table

        result = (
            self.client
            .table(table_name)
            .select("versjon")
            .eq("sak_id", sak_id)
            .order("versjon", desc=True)
            .limit(1)
            .execute()
        )

        if result.data:
            return result.data[0]["versjon"]
        return 0

    def get_all_sak_ids(
        self,
        sakstype: Optional[SaksType] = None
    ) -> List[str]:
        """
        Get all unique sak_ids.

        Args:
            sakstype: Optional filter by sakstype.
                      If None, returns IDs from all tables.
        """
        if sakstype is not None:
            table_name = self._get_table_name(sakstype)
            return self._get_sak_ids_from_table(table_name)

        # Get from all tables
        all_ids = set()
        for table in ["koe_events", "forsering_events", "endringsordre_events"]:
            try:
                ids = self._get_sak_ids_from_table(table)
                all_ids.update(ids)
            except Exception:
                continue

        return list(all_ids)

    def _get_sak_ids_from_table(self, table_name: str) -> List[str]:
        """Get unique sak_ids from a specific table."""
        result = (
            self.client
            .table(table_name)
            .select("sak_id")
            .execute()
        )

        return list(set(row["sak_id"] for row in result.data))

    def get_events_by_type(
        self,
        sak_id: str,
        event_type: str,
        sakstype: Optional[SaksType] = None
    ) -> List[dict]:
        """
        Get events of specific type (useful for debugging).

        Args:
            sak_id: Case ID
            event_type: Event type to filter (e.g., 'grunnlag_opprettet')
            sakstype: Optional sakstype to determine table
        """
        if sakstype is None:
            sakstype = self._detect_sakstype_from_event_type(event_type)

        table_name = self._get_table_name(sakstype)

        result = (
            self.client
            .table(table_name)
            .select("*")
            .eq("sak_id", sak_id)
            .eq("event_type", event_type)
            .order("versjon", desc=False)
            .execute()
        )

        if not result.data:
            return []

        return [self._row_to_event_dict(row) for row in result.data]

    def _detect_sakstype_from_event_type(self, event_type: str) -> SaksType:
        """Detect sakstype from event type string."""
        if event_type.startswith('fravik_'):
            return "fravik"
        if event_type.startswith('forsering_'):
            return "forsering"
        if event_type.startswith('eo_'):
            return "endringsordre"
        return "standard"

    def get_events_as_cloudevents(
        self,
        sak_id: str,
        sakstype: Optional[SaksType] = None
    ) -> List[dict]:
        """
        Get events in CloudEvents format (for external integrations).

        Returns the raw CloudEvents-format data from the database.
        """
        if sakstype is not None:
            table_name = self._get_table_name(sakstype)
            tables = [table_name]
        else:
            tables = ["koe_events", "forsering_events", "endringsordre_events"]

        for table in tables:
            try:
                result = (
                    self.client
                    .table(table)
                    .select("specversion, event_id, source, type, time, subject, "
                            "datacontenttype, actor, actorrole, comment, referstoid, data")
                    .eq("sak_id", sak_id)
                    .order("versjon", desc=False)
                    .execute()
                )

                if result.data:
                    # Rename fields to match CloudEvents spec
                    return [
                        {
                            "specversion": row["specversion"],
                            "id": row["event_id"],
                            "source": row["source"],
                            "type": row["type"],
                            "time": row["time"],
                            "subject": row["subject"],
                            "datacontenttype": row["datacontenttype"],
                            "actor": row["actor"],
                            "actorrole": row["actorrole"],
                            "comment": row["comment"],
                            "referstoid": row["referstoid"],
                            "data": row["data"],
                        }
                        for row in result.data
                    ]
            except Exception:
                continue

        return []

    def find_sak_id_by_catenda_topic(self, catenda_topic_id: str) -> Optional[str]:
        """
        Find local sak_id given a Catenda topic GUID.

        Searches all event tables for SAK_OPPRETTET events with matching
        catenda_topic_id in their data field.

        Args:
            catenda_topic_id: Catenda topic GUID to look up

        Returns:
            Local sak_id if found, None otherwise
        """
        if not catenda_topic_id:
            return None

        # Search all event tables
        for table in ["koe_events", "forsering_events", "endringsordre_events"]:
            try:
                # Look for SAK_OPPRETTET events where data contains the topic_id
                result = (
                    self.client
                    .table(table)
                    .select("sak_id, data")
                    .eq("event_type", "sak_opprettet")
                    .execute()
                )

                for row in result.data:
                    data = row.get("data", {})
                    if isinstance(data, str):
                        import json
                        try:
                            data = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                    if data.get("catenda_topic_id") == catenda_topic_id:
                        return row.get("sak_id")

            except Exception:
                continue

        return None


# Factory function for easy switching
def create_event_repository(backend: str | None = None, **kwargs) -> EventRepository:
    """
    Factory for creating event repository.

    Args:
        backend: "json", "supabase", or "dataverse" (future)
                 If None, reads from EVENT_STORE_BACKEND environment variable
                 Defaults to "json" if not set
        **kwargs: Backend-specific configuration

    Environment Variables:
        EVENT_STORE_BACKEND: "json" (default), "supabase", or "dataverse"

    Examples:
        # Automatic (reads EVENT_STORE_BACKEND env var)
        repo = create_event_repository()

        # Local development (explicit)
        repo = create_event_repository("json", base_path="koe_data/events")

        # Supabase testing
        repo = create_event_repository("supabase")

        # Production (future)
        repo = create_event_repository("dataverse", environment_url="...")
    """
    import logging
    logger = logging.getLogger(__name__)

    if backend is None:
        backend = os.environ.get("EVENT_STORE_BACKEND", "json")

    logger.info(f"🗄️ Creating event repository with backend: {backend}")

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
