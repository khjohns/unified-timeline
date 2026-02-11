"""
Project model for multi-project support.

Each project is an isolated container for cases (saker).
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class Project(BaseModel):
    """Project entity for multi-project isolation."""

    model_config = ConfigDict(json_encoders={datetime: lambda v: v.isoformat()})

    id: str = Field(..., description="Unique project identifier (e.g. 'oslobygg')")
    name: str = Field(..., description="Human-readable project name")
    description: str | None = Field(default=None, description="Project description")
    settings: dict = Field(default_factory=dict, description="Project settings (integrations etc.)")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    created_by: str | None = Field(default=None, description="Who created the project")
    is_active: bool = Field(default=True, description="Whether the project is active")
