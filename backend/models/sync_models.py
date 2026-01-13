"""
Sync Models - Data models for Dalux → Catenda synchronization.

These models define the structure for sync configuration and tracking.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from datetime import datetime


class DaluxCatendaSyncMapping(BaseModel):
    """
    Sync configuration linking a Dalux project to a Catenda project.

    Stores API credentials and sync settings per project.
    """
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )

    id: Optional[str] = Field(default=None, description="Database ID (UUID)")
    project_id: str = Field(..., description="Internal project ID")

    # Dalux configuration
    dalux_project_id: str = Field(..., description="Dalux project ID")
    dalux_base_url: str = Field(..., description="Dalux API base URL (e.g., https://node1.field.dalux.com/service/api/)")
    # Note: API key is read from DALUX_API_KEY environment variable, not stored in database

    # Catenda configuration
    catenda_project_id: str = Field(..., description="Catenda project ID")
    catenda_board_id: str = Field(..., description="Catenda BCF topic board ID")

    # Sync settings
    sync_enabled: bool = Field(default=True, description="Whether sync is enabled")
    sync_interval_minutes: int = Field(default=15, description="Polling interval in minutes")

    # Sync status
    last_sync_at: Optional[datetime] = Field(default=None, description="Last sync timestamp")
    last_sync_status: Optional[Literal["success", "failed", "partial"]] = Field(
        default=None,
        description="Last sync result"
    )
    last_sync_error: Optional[str] = Field(default=None, description="Last sync error message")

    # Timestamps
    created_at: Optional[datetime] = Field(default=None, description="Created timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Updated timestamp")


class TaskSyncRecord(BaseModel):
    """
    Tracks sync state for an individual Dalux task.

    Links a Dalux task ID to a Catenda topic GUID and tracks sync status.
    """
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )

    id: Optional[str] = Field(default=None, description="Database ID (UUID)")
    sync_mapping_id: str = Field(..., description="Reference to DaluxCatendaSyncMapping")

    # Dalux reference
    dalux_task_id: str = Field(..., description="Dalux task ID")
    dalux_updated_at: datetime = Field(..., description="Last update time in Dalux")

    # Catenda reference
    catenda_topic_guid: str = Field(..., description="Catenda topic GUID")
    catenda_updated_at: datetime = Field(..., description="Last update time in Catenda")

    # Sync status
    sync_status: Literal["synced", "pending", "failed"] = Field(
        default="pending",
        description="Current sync status"
    )
    last_error: Optional[str] = Field(default=None, description="Last error message")
    retry_count: int = Field(default=0, description="Number of retry attempts")

    # Timestamps
    created_at: Optional[datetime] = Field(default=None, description="Created timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Updated timestamp")


class AttachmentSyncRecord(BaseModel):
    """
    Tracks sync state for a Dalux attachment.

    Links a Dalux media file to a Catenda document.
    """
    model_config = ConfigDict(
        json_encoders={
            datetime: lambda v: v.isoformat() if v else None
        }
    )

    id: Optional[str] = Field(default=None, description="Database ID (UUID)")
    task_sync_record_id: str = Field(..., description="Reference to TaskSyncRecord")

    # Dalux reference
    dalux_media_file_id: str = Field(..., description="Dalux media file ID")
    dalux_filename: Optional[str] = Field(default=None, description="Original filename")

    # Catenda reference
    catenda_document_guid: str = Field(..., description="Catenda document GUID")

    # Sync status
    sync_status: Literal["synced", "pending", "failed"] = Field(
        default="pending",
        description="Current sync status"
    )
    last_error: Optional[str] = Field(default=None, description="Last error message")

    # Timestamps
    created_at: Optional[datetime] = Field(default=None, description="Created timestamp")
    updated_at: Optional[datetime] = Field(default=None, description="Updated timestamp")


# ==========================================
# SYNC RESULT MODELS
# ==========================================

class TaskSyncResult(BaseModel):
    """Result of syncing a single task."""
    success: bool = Field(..., description="Whether sync succeeded")
    action: Literal["created", "updated", "skipped", "failed"] = Field(
        ...,
        description="Action taken"
    )
    dalux_task_id: str = Field(..., description="Dalux task ID")
    catenda_topic_guid: Optional[str] = Field(default=None, description="Catenda topic GUID")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    attachments_synced: int = Field(default=0, description="Number of attachments synced")


class SyncResult(BaseModel):
    """Result of syncing a project."""
    success: bool = Field(..., description="Whether overall sync succeeded")
    status: Literal["success", "partial", "failed"] = Field(
        ...,
        description="Overall sync status"
    )
    sync_mapping_id: str = Field(..., description="Sync mapping ID")

    # Counts
    tasks_processed: int = Field(default=0, description="Total tasks processed")
    tasks_created: int = Field(default=0, description="New tasks created")
    tasks_updated: int = Field(default=0, description="Existing tasks updated")
    tasks_skipped: int = Field(default=0, description="Tasks skipped (no changes)")
    tasks_failed: int = Field(default=0, description="Tasks that failed to sync")
    attachments_synced: int = Field(default=0, description="Total attachments synced")

    # Details
    errors: list[str] = Field(default_factory=list, description="Error messages")
    task_results: list[TaskSyncResult] = Field(
        default_factory=list,
        description="Per-task results"
    )

    # Timing
    started_at: datetime = Field(..., description="Sync start time")
    completed_at: Optional[datetime] = Field(default=None, description="Sync completion time")
    duration_seconds: Optional[float] = Field(default=None, description="Total duration")


# ==========================================
# MAPPING MODELS
# ==========================================

class TypeMapping(BaseModel):
    """Mapping from Dalux type to Catenda topic_type."""
    dalux_type: str = Field(..., description="Dalux task type (e.g., 'task', 'approval')")
    catenda_topic_type: str = Field(..., description="Catenda topic type (e.g., 'Task', 'Approval')")


class StatusMapping(BaseModel):
    """Mapping from Dalux status to Catenda topic_status."""
    dalux_status: str = Field(..., description="Dalux task status (e.g., 'Open', 'Resolved')")
    catenda_topic_status: str = Field(..., description="Catenda topic status (e.g., 'Open', 'Closed')")


# ==========================================
# DEFAULT MAPPINGS
# ==========================================

# Catenda valid topic types: Error, Warning, Info, Unknown,
# Krav om endringsordre, Endringsordre, Forsering
DEFAULT_TYPE_MAPPINGS: list[TypeMapping] = [
    # RUH (Risikobefaring Uønsket Hendelse) -> Warning
    TypeMapping(dalux_type="RUH", catenda_topic_type="Warning"),
    # Standard task types
    TypeMapping(dalux_type="task", catenda_topic_type="Info"),
    TypeMapping(dalux_type="Oppgave produksjon", catenda_topic_type="Info"),
    # Safety types -> Warning/Error
    TypeMapping(dalux_type="safetyissue", catenda_topic_type="Error"),
    TypeMapping(dalux_type="safetyobservation", catenda_topic_type="Warning"),
    TypeMapping(dalux_type="goodpractice", catenda_topic_type="Info"),
    # Approval -> Info
    TypeMapping(dalux_type="approval", catenda_topic_type="Info"),
]

DEFAULT_STATUS_MAPPINGS: list[StatusMapping] = [
    StatusMapping(dalux_status="Open", catenda_topic_status="Open"),
    StatusMapping(dalux_status="In Progress", catenda_topic_status="In Progress"),
    StatusMapping(dalux_status="Resolved", catenda_topic_status="Closed"),
    StatusMapping(dalux_status="Closed", catenda_topic_status="Closed"),
]


def map_dalux_type_to_catenda(dalux_type) -> str:
    """
    Map Dalux task type to Catenda topic_type.

    Args:
        dalux_type: Dalux task type - can be string or dict with 'name' key

    Returns:
        Catenda topic_type (defaults to 'Task' if not found)
    """
    # Handle dict format: {"typeId": "...", "name": "RUH"}
    if isinstance(dalux_type, dict):
        dalux_type = dalux_type.get("name", "Task")

    dalux_type_lower = str(dalux_type).lower()
    for mapping in DEFAULT_TYPE_MAPPINGS:
        if mapping.dalux_type.lower() == dalux_type_lower:
            return mapping.catenda_topic_type
    return "Info"  # Default - must be valid Catenda type


def map_dalux_status_to_catenda(dalux_status: str) -> str:
    """
    Map Dalux task status to Catenda topic_status.

    Args:
        dalux_status: Dalux task status

    Returns:
        Catenda topic_status (defaults to 'Open' if not found)
    """
    for mapping in DEFAULT_STATUS_MAPPINGS:
        if mapping.dalux_status.lower() == dalux_status.lower():
            return mapping.catenda_topic_status
    return "Open"  # Default
