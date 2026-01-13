"""
DaluxSyncService - Orchestrates Dalux → Catenda synchronization.

Handles:
- Task → BCF Topic mapping
- Incremental sync with change detection
- Attachment download and upload
- Conflict resolution (Dalux wins)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from integrations.dalux import DaluxClient, DaluxAuthError, DaluxAPIError
from integrations.catenda.client import CatendaClient
from repositories.sync_mapping_repository import SyncMappingRepository
from models.sync_models import (
    DaluxCatendaSyncMapping,
    TaskSyncRecord,
    SyncResult,
    TaskSyncResult,
    map_dalux_type_to_catenda,
    map_dalux_status_to_catenda,
)
from utils.logger import get_logger

logger = get_logger(__name__)


class DaluxSyncService:
    """
    Service for synchronizing Dalux tasks to Catenda BCF topics.

    Implements one-way sync: Dalux → Catenda.
    Dalux is the source of truth for all synced data.
    """

    def __init__(
        self,
        dalux_client: DaluxClient,
        catenda_client: CatendaClient,
        sync_repo: SyncMappingRepository,
    ):
        """
        Initialize sync service.

        Args:
            dalux_client: Configured Dalux API client
            catenda_client: Configured Catenda API client
            sync_repo: Repository for sync metadata
        """
        self.dalux = dalux_client
        self.catenda = catenda_client
        self.sync_repo = sync_repo

    def sync_project(
        self,
        sync_mapping_id: str,
        full_sync: bool = False
    ) -> SyncResult:
        """
        Sync all tasks from Dalux to Catenda for a project.

        Args:
            sync_mapping_id: Sync mapping UUID
            full_sync: If True, sync all tasks; if False, only sync changes since last sync

        Returns:
            SyncResult with counts and status
        """
        started_at = datetime.utcnow()

        # Load sync mapping
        mapping = self.sync_repo.get_sync_mapping(sync_mapping_id)
        if not mapping:
            logger.error(f"Sync mapping {sync_mapping_id} not found")
            return SyncResult(
                success=False,
                status="failed",
                sync_mapping_id=sync_mapping_id,
                started_at=started_at,
                errors=["Sync mapping not found"],
            )

        if not mapping.sync_enabled:
            logger.warning(f"Sync mapping {sync_mapping_id} is disabled")
            return SyncResult(
                success=False,
                status="failed",
                sync_mapping_id=sync_mapping_id,
                started_at=started_at,
                errors=["Sync is disabled for this mapping"],
            )

        logger.info(f"Starting sync for mapping {sync_mapping_id}")
        logger.info(f"  Dalux project: {mapping.dalux_project_id}")
        logger.info(f"  Catenda board: {mapping.catenda_board_id}")

        # Initialize result
        result = SyncResult(
            success=True,
            status="success",
            sync_mapping_id=sync_mapping_id,
            started_at=started_at,
        )

        try:
            # Configure Catenda client with the right board
            self.catenda.topic_board_id = mapping.catenda_board_id

            # Fetch tasks from Dalux
            if full_sync or not mapping.last_sync_at:
                logger.info("Performing full sync...")
                tasks = self.dalux.get_tasks(mapping.dalux_project_id)
            else:
                logger.info(f"Performing incremental sync since {mapping.last_sync_at}...")
                tasks = self.dalux.get_task_changes(
                    mapping.dalux_project_id,
                    since=mapping.last_sync_at
                )

            logger.info(f"Found {len(tasks)} tasks to process")

            # Process each task
            for task_item in tasks:
                task_data = task_item.get("data", {})
                task_result = self._sync_task(task_data, mapping)

                result.tasks_processed += 1
                result.task_results.append(task_result)

                if task_result.success:
                    if task_result.action == "created":
                        result.tasks_created += 1
                    elif task_result.action == "updated":
                        result.tasks_updated += 1
                    elif task_result.action == "skipped":
                        result.tasks_skipped += 1
                    result.attachments_synced += task_result.attachments_synced
                else:
                    result.tasks_failed += 1
                    if task_result.error:
                        result.errors.append(task_result.error)

            # Determine overall status
            if result.tasks_failed == 0:
                result.status = "success"
                result.success = True
            elif result.tasks_failed < result.tasks_processed:
                result.status = "partial"
                result.success = True  # Partial success is still success
            else:
                result.status = "failed"
                result.success = False

        except DaluxAuthError as e:
            logger.error(f"Dalux authentication failed: {e}")
            result.success = False
            result.status = "failed"
            result.errors.append(f"Dalux authentication failed: {e}")

        except DaluxAPIError as e:
            logger.error(f"Dalux API error: {e}")
            result.success = False
            result.status = "failed"
            result.errors.append(f"Dalux API error: {e}")

        except Exception as e:
            logger.exception(f"Unexpected error during sync: {e}")
            result.success = False
            result.status = "failed"
            result.errors.append(f"Unexpected error: {e}")

        # Finalize result
        result.completed_at = datetime.utcnow()
        result.duration_seconds = (result.completed_at - result.started_at).total_seconds()

        # Update sync mapping status
        self.sync_repo.update_sync_status(
            sync_mapping_id,
            status=result.status,
            error=result.errors[0] if result.errors else None
        )

        logger.info(f"Sync completed: {result.status}")
        logger.info(f"  Processed: {result.tasks_processed}")
        logger.info(f"  Created: {result.tasks_created}")
        logger.info(f"  Updated: {result.tasks_updated}")
        logger.info(f"  Skipped: {result.tasks_skipped}")
        logger.info(f"  Failed: {result.tasks_failed}")
        logger.info(f"  Duration: {result.duration_seconds:.2f}s")

        return result

    def _sync_task(
        self,
        dalux_task: Dict[str, Any],
        mapping: DaluxCatendaSyncMapping
    ) -> TaskSyncResult:
        """
        Sync a single task from Dalux to Catenda.

        Args:
            dalux_task: Dalux task data (from 'data' field)
            mapping: Sync mapping configuration

        Returns:
            TaskSyncResult with action taken
        """
        dalux_task_id = dalux_task.get("taskId", "unknown")
        logger.debug(f"Processing task {dalux_task_id}: {dalux_task.get('title', 'untitled')}")

        try:
            # Check if task already synced
            existing_record = self.sync_repo.get_task_sync_record(
                mapping.id,
                dalux_task_id
            )

            # Parse Dalux timestamp
            dalux_updated_str = dalux_task.get("modified") or dalux_task.get("created")
            dalux_updated_at = self._parse_datetime(dalux_updated_str)

            # Map task to BCF topic
            topic_data = self._map_task_to_topic(dalux_task)

            if existing_record:
                # Check if update needed (use > not >= to handle same-second updates)
                if existing_record.dalux_updated_at > dalux_updated_at:
                    logger.debug(f"Task {dalux_task_id} unchanged, skipping")
                    return TaskSyncResult(
                        success=True,
                        action="skipped",
                        dalux_task_id=dalux_task_id,
                        catenda_topic_guid=existing_record.catenda_topic_guid,
                    )

                # Update existing topic
                logger.debug(f"Updating topic for task {dalux_task_id}")
                result = self.catenda.update_topic(
                    existing_record.catenda_topic_guid,
                    topic_status=topic_data.get("topic_status"),
                    title=topic_data.get("title"),
                    description=topic_data.get("description"),
                )

                if result:
                    now = datetime.utcnow()
                    self.sync_repo.mark_task_synced(
                        existing_record.id,
                        dalux_updated_at,
                        now
                    )

                    # Sync attachments
                    attachments_synced = self._sync_attachments(
                        dalux_task_id,
                        existing_record.catenda_topic_guid,
                        mapping
                    )

                    return TaskSyncResult(
                        success=True,
                        action="updated",
                        dalux_task_id=dalux_task_id,
                        catenda_topic_guid=existing_record.catenda_topic_guid,
                        attachments_synced=attachments_synced,
                    )
                else:
                    self.sync_repo.mark_task_failed(
                        existing_record.id,
                        "Failed to update topic in Catenda"
                    )
                    return TaskSyncResult(
                        success=False,
                        action="failed",
                        dalux_task_id=dalux_task_id,
                        error="Failed to update topic in Catenda",
                    )

            else:
                # Create new topic
                logger.debug(f"Creating topic for task {dalux_task_id}")
                result = self.catenda.create_topic(
                    title=topic_data.get("title"),
                    description=topic_data.get("description"),
                    topic_type=topic_data.get("topic_type"),
                    topic_status=topic_data.get("topic_status"),
                )

                # Validate result contains required GUID
                catenda_topic_guid = result.get("guid") if result else None
                if not catenda_topic_guid:
                    return TaskSyncResult(
                        success=False,
                        action="failed",
                        dalux_task_id=dalux_task_id,
                        error="Failed to create topic in Catenda - no GUID returned",
                    )

                now = datetime.utcnow()

                # Create sync record
                record = TaskSyncRecord(
                    sync_mapping_id=mapping.id,
                    dalux_task_id=dalux_task_id,
                    dalux_updated_at=dalux_updated_at,
                    catenda_topic_guid=catenda_topic_guid,
                    catenda_updated_at=now,
                    sync_status="synced",
                )
                self.sync_repo.create_task_sync_record(record)

                # Sync attachments
                attachments_synced = self._sync_attachments(
                    dalux_task_id,
                    catenda_topic_guid,
                    mapping
                )

                return TaskSyncResult(
                    success=True,
                    action="created",
                    dalux_task_id=dalux_task_id,
                    catenda_topic_guid=catenda_topic_guid,
                    attachments_synced=attachments_synced,
                )

        except Exception as e:
            logger.exception(f"Error syncing task {dalux_task_id}: {e}")
            return TaskSyncResult(
                success=False,
                action="failed",
                dalux_task_id=dalux_task_id,
                error=str(e),
            )

    def _map_task_to_topic(self, dalux_task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map Dalux task to Catenda BCF topic structure.

        Args:
            dalux_task: Dalux task data

        Returns:
            Dict with BCF topic fields
        """
        # Map type and status
        # Note: Dalux 'type' is a dict: {"typeId": "...", "name": "RUH"}
        dalux_type = dalux_task.get("type", "task")
        # Note: Dalux doesn't have a direct status field - uses workflow/userDefinedFields
        # For now, default to "Open" - can be enhanced to parse userDefinedFields
        dalux_status = dalux_task.get("status", "Open")

        catenda_type = map_dalux_type_to_catenda(dalux_type)
        catenda_status = map_dalux_status_to_catenda(dalux_status)

        # Build description with Dalux metadata
        description_parts = []

        # Dalux uses 'description' but may also have workflow info
        if dalux_task.get("description"):
            description_parts.append(dalux_task["description"])

        # Add user-defined fields if present
        # Structure: {"items": [{"name": "...", "values": [{"text": "..."} or {"reference": {"value": "..."}}]}]}
        user_fields = dalux_task.get("userDefinedFields", {})
        items = user_fields.get("items", []) if isinstance(user_fields, dict) else []
        if items:
            description_parts.append("\n\n---\n**Dalux metadata:**")
            for item in items:
                field_name = item.get("name", "Ukjent felt")
                values = item.get("values", [])
                if values:
                    # Extract value from text or reference format
                    val = values[0]
                    if "text" in val:
                        field_value = val["text"]
                    elif "reference" in val:
                        field_value = val["reference"].get("value", "?")
                    else:
                        field_value = str(val)
                    # Clean up any weird unicode spacing
                    field_value = field_value.strip()
                    description_parts.append(f"- **{field_name}:** {field_value}")

        # Add assigned to info
        assigned_to = dalux_task.get("assignedTo", {})
        if assigned_to:
            email = assigned_to.get("email")
            name = assigned_to.get("name")
            if email or name:
                description_parts.append(f"\n**Assigned to:** {name or email}")

        description = "\n".join(description_parts) if description_parts else None

        # Note: Dalux uses 'subject' for title, not 'title'
        title = dalux_task.get("subject") or dalux_task.get("title", "Untitled")

        return {
            "title": title,
            "description": description,
            "topic_type": catenda_type,
            "topic_status": catenda_status,
            # TODO: Add due_date, assigned_to when BCF API supports it
        }

    def _sync_attachments(
        self,
        dalux_task_id: str,
        catenda_topic_guid: str,
        mapping: DaluxCatendaSyncMapping
    ) -> int:
        """
        Sync attachments for a task.

        Downloads from Dalux and uploads to Catenda.

        Args:
            dalux_task_id: Dalux task ID
            catenda_topic_guid: Catenda topic GUID
            mapping: Sync mapping

        Returns:
            Number of attachments synced
        """
        # TODO: Implement attachment sync in phase 2
        # For now, return 0 (no attachments synced)

        # Future implementation:
        # 1. Get attachments for task from Dalux
        # 2. For each attachment:
        #    a. Check if already synced (attachment_sync_records)
        #    b. Download from Dalux
        #    c. Upload to Catenda library
        #    d. Create document_reference on topic
        #    e. Record sync status

        return 0

    def _parse_datetime(self, dt_str: Optional[str]) -> datetime:
        """Parse datetime string from Dalux API."""
        if not dt_str:
            return datetime.utcnow()

        try:
            # Try ISO 8601 format
            if dt_str.endswith("Z"):
                dt_str = dt_str[:-1] + "+00:00"
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except ValueError:
            logger.warning(f"Could not parse datetime: {dt_str}")
            return datetime.utcnow()

    def validate_sync_config(
        self,
        mapping: DaluxCatendaSyncMapping
    ) -> tuple[bool, List[str]]:
        """
        Validate sync configuration by testing API connections.

        Args:
            mapping: Sync mapping to validate

        Returns:
            Tuple of (is_valid, error_messages)
        """
        from lib.dalux_factory import get_dalux_client_for_mapping

        errors = []

        # Validate Dalux connection
        try:
            dalux_client = get_dalux_client_for_mapping(mapping)
            if not dalux_client.health_check():
                errors.append("Dalux API key is invalid or expired")
        except ValueError as e:
            errors.append(str(e))
        except Exception as e:
            errors.append(f"Dalux connection failed: {e}")

        # Validate Catenda connection
        try:
            self.catenda.topic_board_id = mapping.catenda_board_id
            board = self.catenda.get_topic_board(mapping.catenda_board_id)
            if not board:
                errors.append(f"Catenda board {mapping.catenda_board_id} not found")
        except Exception as e:
            errors.append(f"Catenda connection failed: {e}")

        return (len(errors) == 0, errors)


def create_dalux_sync_service(
    catenda_client: Optional[CatendaClient] = None,
    sync_repo: Optional[SyncMappingRepository] = None,
) -> DaluxSyncService:
    """
    Factory function to create DaluxSyncService.

    Dalux API key and base URL are read from environment variables:
    - DALUX_API_KEY: API key for Dalux
    - DALUX_BASE_URL: Base URL for Dalux API

    Args:
        catenda_client: Optional Catenda client (created from factory if not provided)
        sync_repo: Optional sync repository (created if not provided)

    Returns:
        Configured DaluxSyncService

    Raises:
        ValueError: If DALUX_API_KEY or DALUX_BASE_URL not set
    """
    from lib.catenda_factory import get_catenda_client
    from lib.dalux_factory import get_dalux_client
    from repositories.sync_mapping_repository import create_sync_mapping_repository

    dalux_client = get_dalux_client()
    if dalux_client is None:
        raise ValueError("Dalux not configured. Set DALUX_API_KEY and DALUX_BASE_URL.")

    if catenda_client is None:
        catenda_client = get_catenda_client()

    if sync_repo is None:
        sync_repo = create_sync_mapping_repository()

    return DaluxSyncService(dalux_client, catenda_client, sync_repo)
