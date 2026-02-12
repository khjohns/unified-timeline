"""
Project repository for Supabase.

Manages CRUD operations for the projects table.
"""

import os
from datetime import datetime

try:
    from supabase import Client, create_client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import with_retry
from models.project import Project


class SupabaseProjectRepository:
    """Supabase repository for projects."""

    TABLE_NAME = "projects"

    def __init__(self, url: str | None = None, key: str | None = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed. Run: pip install supabase")

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_KEY."
            )

        self.client: Client = create_client(self.url, self.key)

    def _row_to_project(self, row: dict) -> Project:
        """Convert database row to Project model."""
        return Project(
            id=row["id"],
            name=row["name"],
            description=row.get("description"),
            settings=row.get("settings") or {},
            created_at=datetime.fromisoformat(row["created_at"].replace("Z", "+00:00"))
            if isinstance(row["created_at"], str)
            else row["created_at"],
            created_by=row.get("created_by"),
            is_active=row.get("is_active", True),
        )

    @with_retry()
    def get(self, project_id: str) -> Project | None:
        """Get a project by ID."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return self._row_to_project(result.data[0])
        return None

    @with_retry()
    def list_active(self) -> list[Project]:
        """List all active projects."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("is_active", True)
            .order("name")
            .execute()
        )
        return [self._row_to_project(row) for row in result.data]

    @with_retry()
    def create(self, project: Project) -> None:
        """Create a new project."""
        row = {
            "id": project.id,
            "name": project.name,
            "description": project.description,
            "settings": project.settings,
            "created_at": project.created_at.isoformat(),
            "created_by": project.created_by,
            "is_active": project.is_active,
        }
        self.client.table(self.TABLE_NAME).insert(row).execute()

    @with_retry()
    def exists(self, project_id: str) -> bool:
        """Check if a project exists."""
        result = (
            self.client.table(self.TABLE_NAME)
            .select("id")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0

    @with_retry()
    def update(self, project_id: str, updates: dict) -> Project | None:
        """Update a project's fields. Returns updated Project or None if not found."""
        result = (
            self.client.table(self.TABLE_NAME)
            .update(updates)
            .eq("id", project_id)
            .execute()
        )
        if result.data:
            return self._row_to_project(result.data[0])
        return None

    @with_retry()
    def deactivate(self, project_id: str) -> bool:
        """Soft-delete a project by setting is_active=false."""
        result = (
            self.client.table(self.TABLE_NAME)
            .update({"is_active": False})
            .eq("id", project_id)
            .execute()
        )
        return len(result.data) > 0
