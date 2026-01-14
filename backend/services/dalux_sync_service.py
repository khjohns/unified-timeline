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
        full_sync: bool = False,
        limit: Optional[int] = None
    ) -> SyncResult:
        """
        Sync all tasks from Dalux to Catenda for a project.

        Args:
            sync_mapping_id: Sync mapping UUID
            full_sync: If True, sync all tasks; if False, only sync changes since last sync
            limit: Optional limit on number of tasks to sync (for testing)

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

            # Apply limit if specified (for testing)
            if limit and limit > 0:
                tasks = tasks[:limit]
                logger.info(f"Limited to {len(tasks)} tasks")

            # Fetch all changes, attachments, and users once (for enrichment)
            logger.info("Fetching changes, attachments, and users for enrichment...")
            all_changes = self._fetch_all_changes(mapping.dalux_project_id)
            all_attachments = self._fetch_all_attachments(mapping.dalux_project_id)
            user_lookup = self._fetch_user_lookup(mapping.dalux_project_id)
            logger.info(f"  Changes: {len(all_changes)}, Attachments: {len(all_attachments)}, Users: {len(user_lookup)}")

            # Index by task ID for fast lookup
            changes_by_task = self._group_by_task_id(all_changes)
            attachments_by_task = self._group_attachments_by_task_id(all_attachments)

            # Process each task
            for task_item in tasks:
                task_data = task_item.get("data", {})
                task_id = task_data.get("taskId", "")

                # Get changes and attachments for this task
                task_changes = changes_by_task.get(task_id, [])
                task_attachments = attachments_by_task.get(task_id, [])

                task_result = self._sync_task(
                    task_data, mapping, task_changes, task_attachments, user_lookup
                )

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
        mapping: DaluxCatendaSyncMapping,
        task_changes: Optional[List[Dict[str, Any]]] = None,
        task_attachments: Optional[List[Dict[str, Any]]] = None,
        user_lookup: Optional[Dict[str, str]] = None,
    ) -> TaskSyncResult:
        """
        Sync a single task from Dalux to Catenda.

        Args:
            dalux_task: Dalux task data (from 'data' field)
            mapping: Sync mapping configuration
            task_changes: List of changes for this task (from changes API)
            task_attachments: List of attachments for this task
            user_lookup: Dict mapping userId to full name

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

            # Map task to BCF topic (with enrichment from changes and attachments)
            topic_data = self._map_task_to_topic(
                dalux_task,
                task_changes or [],
                task_attachments or [],
                user_lookup or {}
            )

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

    def _map_task_to_topic(
        self,
        dalux_task: Dict[str, Any],
        task_changes: Optional[List[Dict[str, Any]]] = None,
        task_attachments: Optional[List[Dict[str, Any]]] = None,
        user_lookup: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Map Dalux task to Catenda BCF topic structure.

        Args:
            dalux_task: Dalux task data
            task_changes: List of changes for this task (for history)
            task_attachments: List of attachments for this task
            user_lookup: Dict mapping userId to full name

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
            description_parts.append("\n---\n**Egendefinerte felt:**")
            for item in items:
                field_name = item.get("name", "Ukjent felt")
                values = item.get("values", [])
                if values:
                    # Extract value(s) from text or reference format
                    value_strs = []
                    for val in values:
                        if "text" in val:
                            value_strs.append(val["text"].strip())
                        elif "reference" in val:
                            value_strs.append(val["reference"].get("value", "?"))
                        elif "date" in val:
                            value_strs.append(val["date"][:10])
                    field_value = ", ".join(value_strs) if value_strs else "(tom)"
                    description_parts.append(f"- **{field_name}:** {field_value}")

        # Add location info if present
        location = dalux_task.get("location", {})
        if location:
            location_str = self._format_location_for_description(location)
            if location_str:
                description_parts.append(location_str)

        # Add attachments list if present
        if task_attachments:
            attachments_str = self._format_attachments_for_description(task_attachments)
            if attachments_str:
                description_parts.append(attachments_str)

        # Add history/changes if present
        if task_changes:
            changes_str = self._format_changes_for_description(task_changes, user_lookup or {})
            if changes_str:
                description_parts.append(changes_str)

        description = "\n".join(description_parts) if description_parts else None

        # Note: Dalux uses 'subject' for title, not 'title'
        title = dalux_task.get("subject") or dalux_task.get("title", "Untitled")

        return {
            "title": title,
            "description": description,
            "topic_type": catenda_type,
            "topic_status": catenda_status,
        }

    def _format_location_for_description(
        self,
        location: Dict[str, Any]
    ) -> Optional[str]:
        """Format location data for inclusion in description."""
        parts = []

        building = location.get("building", {})
        level = location.get("level", {})
        room = location.get("room", {})
        drawing = location.get("drawing", {})
        coord = location.get("coordinate", {}).get("xyz", {})

        if building.get("name"):
            parts.append(f"- Bygning: {building['name']}")
        if level.get("name"):
            parts.append(f"- Etasje: {level['name']}")
        if room.get("name"):
            parts.append(f"- Rom: {room['name']}")
        if drawing.get("name"):
            parts.append(f"- Tegning: {drawing['name']}")
        if coord:
            x, y, z = coord.get("x", 0), coord.get("y", 0), coord.get("z", 0)
            parts.append(f"- Koordinater: X={x:.1f}, Y={y:.1f}, Z={z:.1f}")

        if parts:
            return "\n---\n**Lokasjon:**\n" + "\n".join(parts)
        return None

    def _format_attachments_for_description(
        self,
        attachments: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Format attachments list for inclusion in description.

        Args:
            attachments: List of attachment dicts from Dalux API

        Returns:
            Formatted markdown string or None
        """
        if not attachments:
            return None

        parts = [f"\n---\n**Vedlegg ({len(attachments)} stk):**"]

        for att in attachments:
            media = att.get("mediaFile", {})
            name = media.get("name", "Ukjent fil")
            created = att.get("created", "")[:10]
            parts.append(f"- 📎 {name} ({created})")

        parts.append("*(Nedlasting krever utvidede API-rettigheter)*")

        return "\n".join(parts)

    def _format_changes_for_description(
        self,
        changes: List[Dict[str, Any]],
        user_lookup: Optional[Dict[str, str]] = None
    ) -> Optional[str]:
        """
        Format changes/history for inclusion in description.

        Args:
            changes: List of change dicts from Dalux changes API
            user_lookup: Dict mapping userId to full name

        Returns:
            Formatted markdown string or None
        """
        user_lookup = user_lookup or {}
        if not changes:
            return None

        # Sort by timestamp
        sorted_changes = sorted(
            changes,
            key=lambda c: c.get("timestamp", ""),
        )

        parts = [f"\n---\n**Historikk ({len(changes)} hendelser):**"]

        # Action icons
        icons = {
            "create": "📝",
            "assign": "👤",
            "update": "✏️",
            "complete": "✅",
            "approve": "✓",
            "reject": "✗",
            "reopen": "🔄",
        }

        for change in sorted_changes:
            timestamp = change.get("timestamp", "")[:16].replace("T", " ")
            action = change.get("action", "unknown")
            description = change.get("description", "")
            fields = change.get("fields", {})

            icon = icons.get(action, "•")
            line = f"- {icon} [{timestamp}] **{action.upper()}**"

            # Add description if present
            if description:
                # Truncate long descriptions
                desc = description[:100] + "..." if len(description) > 100 else description
                line += f': "{desc}"'

            parts.append(line)

            # Add role assignment info
            assigned_to = fields.get("assignedTo", {})
            if assigned_to.get("roleName"):
                parts.append(f"  - Tildelt: {assigned_to['roleName']}")

            # Add responsible info (look up user name)
            current_resp = fields.get("currentResponsible", {})
            if current_resp.get("userId"):
                user_id = current_resp["userId"]
                user_name = user_lookup.get(user_id, user_id)
                parts.append(f"  - Ansvarlig: {user_name}")

        return "\n".join(parts)

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

    def _fetch_all_changes(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all available changes from Dalux.

        Note: Due to API limitations, only the 100 oldest changes are returned.

        Args:
            project_id: Dalux project ID

        Returns:
            List of change dicts
        """
        try:
            # Use a very old date to get as many changes as possible
            since = datetime(2020, 1, 1)
            return self.dalux.get_task_changes(project_id, since)
        except Exception as e:
            logger.warning(f"Could not fetch changes: {e}")
            return []

    def _fetch_all_attachments(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all task attachments from Dalux.

        Args:
            project_id: Dalux project ID

        Returns:
            List of attachment dicts
        """
        try:
            return self.dalux.get_task_attachments(project_id)
        except Exception as e:
            logger.warning(f"Could not fetch attachments: {e}")
            return []

    def _fetch_user_lookup(self, project_id: str) -> Dict[str, str]:
        """
        Fetch project users and build a lookup table.

        Args:
            project_id: Dalux project ID

        Returns:
            Dict mapping userId to full name (firstName + lastName)
        """
        try:
            users = self.dalux.get_project_users(project_id)
            lookup = {}
            for user in users:
                user_id = user.get("userId")
                first_name = user.get("firstName", "")
                last_name = user.get("lastName", "")
                if user_id:
                    full_name = f"{first_name} {last_name}".strip()
                    lookup[user_id] = full_name if full_name else user_id
            return lookup
        except Exception as e:
            logger.warning(f"Could not fetch users: {e}")
            return {}

    def _group_by_task_id(
        self,
        changes: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group changes by task ID.

        Args:
            changes: List of change dicts

        Returns:
            Dict mapping task ID to list of changes
        """
        result: Dict[str, List[Dict[str, Any]]] = {}
        for change in changes:
            task_id = change.get("taskId")
            if task_id:
                if task_id not in result:
                    result[task_id] = []
                result[task_id].append(change)
        return result

    def _group_attachments_by_task_id(
        self,
        attachments: List[Dict[str, Any]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Group attachments by task ID.

        Args:
            attachments: List of attachment dicts

        Returns:
            Dict mapping task ID to list of attachments
        """
        result: Dict[str, List[Dict[str, Any]]] = {}
        for att in attachments:
            task_id = att.get("taskId")
            if task_id:
                if task_id not in result:
                    result[task_id] = []
                result[task_id].append(att)
        return result

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
