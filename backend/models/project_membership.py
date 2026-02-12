"""
Project membership model for access control.

Email-based membership compatible with magic links and future Entra ID.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class ProjectMembership(BaseModel):
    """A user's membership in a project."""

    id: str | None = Field(default=None, description="UUID, set by database")
    project_id: str = Field(..., description="Project ID")
    user_email: str = Field(..., description="User email (normalized to lowercase)")
    external_id: str | None = Field(default=None, description="External IdP ID (e.g. Entra oid)")
    role: Literal["admin", "member", "viewer"] = Field(
        default="member",
        description="Project access role (not domain role like BH/TE)",
    )
    display_name: str | None = Field(default=None, description="Cached display name")
    invited_by: str | None = Field(default=None, description="Email of inviter")
    created_at: datetime | None = Field(default=None)
    updated_at: datetime | None = Field(default=None)

    @field_validator("user_email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.lower().strip()
