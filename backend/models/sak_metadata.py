"""
SakMetadata - Lightweight case metadata for list views.

This model stores basic case information and cached fields for
efficient list displays without loading full event logs.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SakMetadata(BaseModel):
    """
    Lightweight case metadata.

    Stored in CSV for quick access in list views.
    Cached fields are updated after each event submission.
    """

    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})

    sak_id: str = Field(..., description="Case ID")
    prosjekt_id: str | None = Field(default=None, description="Project ID")
    catenda_topic_id: str | None = Field(default=None, description="Catenda topic GUID")
    catenda_board_id: str | None = Field(default=None, description="Catenda board GUID")
    catenda_project_id: str | None = Field(
        default=None, description="Catenda project GUID"
    )

    created_at: datetime = Field(..., description="When the case was created")
    created_by: str = Field(..., description="Who created the case (TE name)")

    # Case type
    sakstype: str = Field(
        default="standard", description="Case type: standard, forsering, endringsordre"
    )

    # Cached fields (updated after events)
    cached_title: str | None = Field(default=None, description="Cached case title")
    cached_status: str | None = Field(default=None, description="Cached overall status")
    last_event_at: datetime | None = Field(
        default=None, description="Timestamp of last event"
    )
