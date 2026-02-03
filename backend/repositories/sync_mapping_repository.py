"""
Sync Mapping Repository - Supabase storage for Dalux↔Catenda sync metadata.

Tables:
- dalux_catenda_sync_mappings: Per-project sync configuration
- dalux_task_sync_records: Per-task sync status tracking
"""

import os
from datetime import datetime

from utils.logger import get_logger

# Try to import Supabase
try:
    from supabase import Client, create_client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import safe_execute, with_retry
from models.sync_models import (
    DaluxCatendaSyncMapping,
    TaskSyncRecord,
)

logger = get_logger(__name__)


class SyncMappingRepository:
    """
    Repository for Dalux↔Catenda sync mappings and task sync records.

    Uses Supabase (PostgreSQL) as backend.

    Environment variables:
    - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
    - SUPABASE_SECRET_KEY: Service role key (backend only)
    """

    SYNC_MAPPINGS_TABLE = "dalux_catenda_sync_mappings"
    TASK_SYNC_RECORDS_TABLE = "dalux_task_sync_records"
    ATTACHMENT_SYNC_RECORDS_TABLE = "dalux_attachment_sync_records"

    def __init__(
        self,
        url: str | None = None,
        key: str | None = None,
    ):
        if not SUPABASE_AVAILABLE:
            raise ImportError(
                "Supabase client not installed. Run: pip install supabase"
            )

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
            )

        self.client: Client = create_client(self.url, self.key)
        logger.info("SyncMappingRepository initialized")

    # ==========================================
    # SYNC MAPPINGS
    # ==========================================

    @with_retry()
    def create_sync_mapping(self, mapping: DaluxCatendaSyncMapping) -> str:
        """
        Create a new sync mapping.

        Args:
            mapping: Sync mapping to create

        Returns:
            Created mapping ID
        """
        data = {
            "project_id": mapping.project_id,
            "dalux_project_id": mapping.dalux_project_id,
            "dalux_base_url": mapping.dalux_base_url,
            "catenda_project_id": mapping.catenda_project_id,
            "catenda_board_id": mapping.catenda_board_id,
            "sync_enabled": mapping.sync_enabled,
            "sync_interval_minutes": mapping.sync_interval_minutes,
        }

        result = self.client.table(self.SYNC_MAPPINGS_TABLE).insert(data).execute()
        if not result.data or len(result.data) == 0:
            raise ValueError("Insert operation returned no data")
        mapping_id = result.data[0]["id"]
        logger.info(f"Created sync mapping {mapping_id}")
        return mapping_id

    def get_sync_mapping(self, mapping_id: str) -> DaluxCatendaSyncMapping | None:
        """
        Get a sync mapping by ID.

        Args:
            mapping_id: Mapping UUID

        Returns:
            Sync mapping or None if not found
        """

        @with_retry()
        def _execute() -> DaluxCatendaSyncMapping | None:
            result = (
                self.client.table(self.SYNC_MAPPINGS_TABLE)
                .select("*")
                .eq("id", mapping_id)
                .execute()
            )

            if not result.data:
                return None

            return self._row_to_sync_mapping(result.data[0])

        return safe_execute(
            _execute, f"Failed to get sync mapping {mapping_id}", default=None
        )

    def get_sync_mapping_by_project(
        self, project_id: str, dalux_project_id: str | None = None
    ) -> DaluxCatendaSyncMapping | None:
        """
        Get sync mapping by project ID.

        Args:
            project_id: Internal project ID
            dalux_project_id: Optional Dalux project ID for more specific lookup

        Returns:
            Sync mapping or None if not found
        """

        @with_retry()
        def _execute() -> DaluxCatendaSyncMapping | None:
            query = (
                self.client.table(self.SYNC_MAPPINGS_TABLE)
                .select("*")
                .eq("project_id", project_id)
            )

            if dalux_project_id:
                query = query.eq("dalux_project_id", dalux_project_id)

            result = query.limit(1).execute()

            if not result.data:
                return None

            return self._row_to_sync_mapping(result.data[0])

        return safe_execute(
            _execute,
            f"Failed to get sync mapping for project {project_id}",
            default=None,
        )

    def list_sync_mappings(
        self, project_id: str | None = None, enabled_only: bool = False
    ) -> list[DaluxCatendaSyncMapping]:
        """
        List sync mappings.

        Args:
            project_id: Filter by project (optional)
            enabled_only: Only return enabled mappings

        Returns:
            List of sync mappings
        """

        @with_retry()
        def _execute() -> list[DaluxCatendaSyncMapping]:
            query = self.client.table(self.SYNC_MAPPINGS_TABLE).select("*")

            if project_id:
                query = query.eq("project_id", project_id)
            if enabled_only:
                query = query.eq("sync_enabled", True)

            result = query.order("created_at", desc=True).execute()

            return [self._row_to_sync_mapping(row) for row in result.data]

        return safe_execute(_execute, "Failed to list sync mappings", default=[]) or []

    def update_sync_mapping(self, mapping_id: str, updates: dict) -> bool:
        """
        Update a sync mapping.

        Args:
            mapping_id: Mapping UUID
            updates: Fields to update

        Returns:
            True if successful
        """
        # Add updated_at
        updates["updated_at"] = datetime.utcnow().isoformat()

        @with_retry()
        def _execute() -> bool:
            self.client.table(self.SYNC_MAPPINGS_TABLE).update(updates).eq(
                "id", mapping_id
            ).execute()
            logger.info(f"Updated sync mapping {mapping_id}")
            return True

        return (
            safe_execute(
                _execute, f"Failed to update sync mapping {mapping_id}", default=False
            )
            or False
        )

    def update_sync_status(
        self, mapping_id: str, status: str, error: str | None = None
    ) -> bool:
        """
        Update sync status after a sync operation.

        Args:
            mapping_id: Mapping UUID
            status: 'success', 'failed', or 'partial'
            error: Error message if failed

        Returns:
            True if successful
        """
        updates = {
            "last_sync_at": datetime.utcnow().isoformat(),
            "last_sync_status": status,
            "last_sync_error": error,
            "updated_at": datetime.utcnow().isoformat(),
        }

        return self.update_sync_mapping(mapping_id, updates)

    def delete_sync_mapping(self, mapping_id: str) -> bool:
        """
        Delete a sync mapping and all related records.

        Args:
            mapping_id: Mapping UUID

        Returns:
            True if successful
        """

        @with_retry()
        def _execute() -> bool:
            # Task sync records are deleted via CASCADE
            self.client.table(self.SYNC_MAPPINGS_TABLE).delete().eq(
                "id", mapping_id
            ).execute()
            logger.info(f"Deleted sync mapping {mapping_id}")
            return True

        return (
            safe_execute(
                _execute, f"Failed to delete sync mapping {mapping_id}", default=False
            )
            or False
        )

    def _row_to_sync_mapping(self, row: dict) -> DaluxCatendaSyncMapping:
        """Convert database row to Pydantic model."""
        return DaluxCatendaSyncMapping(
            id=row["id"],
            project_id=row["project_id"],
            dalux_project_id=row["dalux_project_id"],
            dalux_base_url=row["dalux_base_url"],
            catenda_project_id=row["catenda_project_id"],
            catenda_board_id=row["catenda_board_id"],
            sync_enabled=row["sync_enabled"],
            sync_interval_minutes=row["sync_interval_minutes"],
            task_filters=row.get("task_filters"),
            last_sync_at=row.get("last_sync_at"),
            last_sync_status=row.get("last_sync_status"),
            last_sync_error=row.get("last_sync_error"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    # ==========================================
    # TASK SYNC RECORDS
    # ==========================================

    @with_retry()
    def create_task_sync_record(self, record: TaskSyncRecord) -> str:
        """
        Create a new task sync record.

        Args:
            record: Task sync record to create

        Returns:
            Created record ID
        """
        data = {
            "sync_mapping_id": record.sync_mapping_id,
            "dalux_task_id": record.dalux_task_id,
            "dalux_updated_at": record.dalux_updated_at.isoformat(),
            "catenda_topic_guid": record.catenda_topic_guid,
            "catenda_updated_at": record.catenda_updated_at.isoformat(),
            "sync_status": record.sync_status,
            "last_error": record.last_error,
            "retry_count": record.retry_count,
        }

        result = (
            self.client.table(self.TASK_SYNC_RECORDS_TABLE).insert(data).execute()
        )
        if not result.data or len(result.data) == 0:
            raise ValueError("Insert operation returned no data")
        record_id = result.data[0]["id"]
        logger.debug(f"Created task sync record {record_id}")
        return record_id

    def get_task_sync_record(
        self, mapping_id: str, dalux_task_id: str
    ) -> TaskSyncRecord | None:
        """
        Get task sync record by Dalux task ID.

        Args:
            mapping_id: Sync mapping UUID
            dalux_task_id: Dalux task ID

        Returns:
            Task sync record or None if not found
        """

        @with_retry()
        def _execute() -> TaskSyncRecord | None:
            result = (
                self.client.table(self.TASK_SYNC_RECORDS_TABLE)
                .select("*")
                .eq("sync_mapping_id", mapping_id)
                .eq("dalux_task_id", dalux_task_id)
                .execute()
            )

            if not result.data:
                return None

            return self._row_to_task_sync_record(result.data[0])

        return safe_execute(_execute, "Failed to get task sync record", default=None)

    def get_task_sync_record_by_catenda_topic(
        self, catenda_topic_guid: str
    ) -> TaskSyncRecord | None:
        """
        Get task sync record by Catenda topic GUID.

        Args:
            catenda_topic_guid: Catenda topic GUID

        Returns:
            Task sync record or None if not found
        """

        @with_retry()
        def _execute() -> TaskSyncRecord | None:
            result = (
                self.client.table(self.TASK_SYNC_RECORDS_TABLE)
                .select("*")
                .eq("catenda_topic_guid", catenda_topic_guid)
                .execute()
            )

            if not result.data:
                return None

            return self._row_to_task_sync_record(result.data[0])

        return safe_execute(
            _execute, "Failed to get task sync record by topic", default=None
        )

    def list_task_sync_records(
        self, mapping_id: str, status: str | None = None
    ) -> list[TaskSyncRecord]:
        """
        List task sync records for a mapping.

        Args:
            mapping_id: Sync mapping UUID
            status: Filter by status (optional)

        Returns:
            List of task sync records
        """

        @with_retry()
        def _execute() -> list[TaskSyncRecord]:
            query = (
                self.client.table(self.TASK_SYNC_RECORDS_TABLE)
                .select("*")
                .eq("sync_mapping_id", mapping_id)
            )

            if status:
                query = query.eq("sync_status", status)

            result = query.order("updated_at", desc=True).execute()

            return [self._row_to_task_sync_record(row) for row in result.data]

        return (
            safe_execute(_execute, "Failed to list task sync records", default=[]) or []
        )

    def update_task_sync_record(self, record_id: str, updates: dict) -> bool:
        """
        Update a task sync record.

        Args:
            record_id: Record UUID
            updates: Fields to update

        Returns:
            True if successful
        """
        updates["updated_at"] = datetime.utcnow().isoformat()

        @with_retry()
        def _execute() -> bool:
            self.client.table(self.TASK_SYNC_RECORDS_TABLE).update(updates).eq(
                "id", record_id
            ).execute()
            logger.debug(f"Updated task sync record {record_id}")
            return True

        return (
            safe_execute(
                _execute,
                f"Failed to update task sync record {record_id}",
                default=False,
            )
            or False
        )

    @with_retry()
    def upsert_task_sync_record(self, record: TaskSyncRecord) -> str:
        """
        Create or update a task sync record.

        Uses (sync_mapping_id, dalux_task_id) as the unique key.

        Args:
            record: Task sync record

        Returns:
            Record ID
        """
        data = {
            "sync_mapping_id": record.sync_mapping_id,
            "dalux_task_id": record.dalux_task_id,
            "dalux_updated_at": record.dalux_updated_at.isoformat(),
            "catenda_topic_guid": record.catenda_topic_guid,
            "catenda_updated_at": record.catenda_updated_at.isoformat(),
            "sync_status": record.sync_status,
            "last_error": record.last_error,
            "retry_count": record.retry_count,
            "updated_at": datetime.utcnow().isoformat(),
        }

        result = (
            self.client.table(self.TASK_SYNC_RECORDS_TABLE)
            .upsert(data, on_conflict="sync_mapping_id,dalux_task_id")
            .execute()
        )
        if not result.data or len(result.data) == 0:
            raise ValueError("Upsert operation returned no data")
        record_id = result.data[0]["id"]
        logger.debug(f"Upserted task sync record {record_id}")
        return record_id

    def mark_task_synced(
        self, record_id: str, dalux_updated_at: datetime, catenda_updated_at: datetime
    ) -> bool:
        """
        Mark a task as successfully synced.

        Args:
            record_id: Record UUID
            dalux_updated_at: Dalux update timestamp
            catenda_updated_at: Catenda update timestamp

        Returns:
            True if successful
        """
        return self.update_task_sync_record(
            record_id,
            {
                "sync_status": "synced",
                "dalux_updated_at": dalux_updated_at.isoformat(),
                "catenda_updated_at": catenda_updated_at.isoformat(),
                "last_error": None,
                "retry_count": 0,
            },
        )

    def mark_task_failed(self, record_id: str, error: str) -> bool:
        """
        Mark a task sync as failed.

        Args:
            record_id: Record UUID
            error: Error message

        Returns:
            True if successful
        """
        # Increment retry count
        existing = self._get_task_sync_record_by_id(record_id)
        retry_count = (existing.retry_count + 1) if existing else 1

        return self.update_task_sync_record(
            record_id,
            {
                "sync_status": "failed",
                "last_error": error,
                "retry_count": retry_count,
            },
        )

    def _get_task_sync_record_by_id(self, record_id: str) -> TaskSyncRecord | None:
        """Get task sync record by ID."""

        @with_retry()
        def _execute() -> TaskSyncRecord | None:
            result = (
                self.client.table(self.TASK_SYNC_RECORDS_TABLE)
                .select("*")
                .eq("id", record_id)
                .execute()
            )
            if not result.data:
                return None
            return self._row_to_task_sync_record(result.data[0])

        return safe_execute(
            _execute, f"Failed to get task sync record {record_id}", default=None
        )

    def _row_to_task_sync_record(self, row: dict) -> TaskSyncRecord:
        """Convert database row to Pydantic model."""
        return TaskSyncRecord(
            id=row["id"],
            sync_mapping_id=row["sync_mapping_id"],
            dalux_task_id=row["dalux_task_id"],
            dalux_updated_at=row["dalux_updated_at"],
            catenda_topic_guid=row["catenda_topic_guid"],
            catenda_updated_at=row["catenda_updated_at"],
            sync_status=row["sync_status"],
            last_error=row.get("last_error"),
            retry_count=row.get("retry_count", 0),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )


def create_sync_mapping_repository() -> SyncMappingRepository:
    """Factory function to create SyncMappingRepository."""
    return SyncMappingRepository()
