"""
Membership repository for Supabase.

Manages project membership CRUD operations.
"""

import os

try:
    from supabase import Client, create_client

    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

from lib.supabase import with_retry
from models.project_membership import ProjectMembership


class SupabaseMembershipRepository:
    """Supabase repository for project memberships."""

    TABLE_NAME = "project_memberships"

    def __init__(self, url: str | None = None, key: str | None = None):
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase client not installed")

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = (
            key
            or os.environ.get("SUPABASE_SECRET_KEY")
            or os.environ.get("SUPABASE_KEY")
        )

        if not self.url or not self.key:
            raise ValueError("Supabase credentials required")

        self.client: Client = create_client(self.url, self.key)

    def _row_to_model(self, row: dict) -> ProjectMembership:
        return ProjectMembership(
            id=row["id"],
            project_id=row["project_id"],
            user_email=row["user_email"],
            external_id=row.get("external_id"),
            role=row["role"],
            display_name=row.get("display_name"),
            invited_by=row.get("invited_by"),
            created_at=row.get("created_at"),
            updated_at=row.get("updated_at"),
        )

    @with_retry()
    def add(self, membership: ProjectMembership) -> ProjectMembership:
        row = {
            "project_id": membership.project_id,
            "user_email": membership.user_email,
            "role": membership.role,
            "display_name": membership.display_name,
            "invited_by": membership.invited_by,
        }
        if membership.external_id:
            row["external_id"] = membership.external_id
        result = self.client.table(self.TABLE_NAME).insert(row).execute()
        return self._row_to_model(result.data[0])

    @with_retry()
    def get_by_project(self, project_id: str) -> list[ProjectMembership]:
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("project_id", project_id)
            .order("created_at")
            .execute()
        )
        return [self._row_to_model(row) for row in result.data]

    @with_retry()
    def get_user_projects(self, user_email: str) -> list[ProjectMembership]:
        email = user_email.lower().strip()
        result = (
            self.client.table(self.TABLE_NAME)
            .select("*")
            .eq("user_email", email)
            .execute()
        )
        return [self._row_to_model(row) for row in result.data]

    @with_retry()
    def is_member(self, project_id: str, user_email: str) -> bool:
        email = user_email.lower().strip()
        result = (
            self.client.table(self.TABLE_NAME)
            .select("id")
            .eq("project_id", project_id)
            .eq("user_email", email)
            .limit(1)
            .execute()
        )
        return len(result.data) > 0

    @with_retry()
    def get_role(self, project_id: str, user_email: str) -> str | None:
        email = user_email.lower().strip()
        result = (
            self.client.table(self.TABLE_NAME)
            .select("role")
            .eq("project_id", project_id)
            .eq("user_email", email)
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["role"]
        return None

    @with_retry()
    def remove(self, project_id: str, user_email: str) -> bool:
        email = user_email.lower().strip()
        result = (
            self.client.table(self.TABLE_NAME)
            .delete()
            .eq("project_id", project_id)
            .eq("user_email", email)
            .execute()
        )
        return len(result.data) > 0

    @with_retry()
    def update_role(self, project_id: str, user_email: str, role: str) -> bool:
        email = user_email.lower().strip()
        result = (
            self.client.table(self.TABLE_NAME)
            .update({"role": role})
            .eq("project_id", project_id)
            .eq("user_email", email)
            .execute()
        )
        return len(result.data) > 0
