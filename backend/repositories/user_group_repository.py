"""
User Group Repository

Fetches user group membership from Supabase user_groups table.
Used for role-based access control (RBAC).
"""

import os
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class UserGroupRepository:
    """
    Repository for user group membership.

    Environment variables required:
    - SUPABASE_URL: Project URL (e.g., https://xxx.supabase.co)
    - SUPABASE_SECRET_KEY: Service role key (for backend)
    """

    def __init__(self, url: Optional[str] = None, key: Optional[str] = None):
        from supabase import create_client, Client

        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_KEY")

        if not self.url or not self.key:
            raise ValueError(
                "Supabase credentials required. Set SUPABASE_URL and SUPABASE_SECRET_KEY."
            )

        self.client: Client = create_client(self.url, self.key)
        self.table_name = "user_groups"

    def get_user_group(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user's group membership by Supabase user ID.

        Args:
            user_id: Supabase auth user ID (UUID)

        Returns:
            Dict with group info or None if not found:
            {
                "user_role": "TE" | "BH",
                "group_name": "entreprenør" | "byggherre",
                "approval_role": "PL" | "SL" | ... | None,
                "display_name": "Kari Nordmann" | None,
                "department": "Prosjekt A" | None
            }
        """
        try:
            response = self.client.table(self.table_name).select(
                "user_role, group_name, approval_role, display_name, department"
            ).eq("user_id", user_id).eq("is_active", True).single().execute()

            if response.data:
                return response.data
            return None

        except Exception as e:
            # PostgREST returns error when no rows found with .single()
            if "PGRST116" in str(e):
                return None
            logger.error(f"Error fetching user group for {user_id}: {e}")
            return None

    def get_user_group_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user's group membership by email address.

        This requires joining with auth.users, so we use a database function.

        Args:
            email: User's email address

        Returns:
            Dict with group info or None if not found
        """
        try:
            # First, look up user ID from Supabase auth
            # This requires service role to access auth.users
            response = self.client.rpc(
                "get_user_role_by_email",
                {"p_email": email}
            ).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Error fetching user group by email {email}: {e}")
            return None

    def create_user_group(
        self,
        user_id: str,
        group_name: str,
        approval_role: Optional[str] = None,
        display_name: Optional[str] = None,
        department: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new user group membership.

        Args:
            user_id: Supabase auth user ID
            group_name: "byggherre" or "entreprenør"
            approval_role: Optional approval role for byggherre users
            display_name: User's display name
            department: User's department/unit

        Returns:
            Created record or None on error
        """
        try:
            data = {
                "user_id": user_id,
                "group_name": group_name,
                "display_name": display_name,
                "department": department,
            }

            # Only set approval_role for byggherre users
            if group_name == "byggherre" and approval_role:
                data["approval_role"] = approval_role

            response = self.client.table(self.table_name).insert(data).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Error creating user group: {e}")
            return None

    def update_user_group(
        self,
        user_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """
        Update user group membership.

        Args:
            user_id: Supabase auth user ID
            **updates: Fields to update (group_name, approval_role, display_name, department)

        Returns:
            Updated record or None on error
        """
        try:
            allowed_fields = {"group_name", "approval_role", "display_name", "department", "is_active"}
            filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}

            if not filtered_updates:
                return None

            response = self.client.table(self.table_name).update(
                filtered_updates
            ).eq("user_id", user_id).execute()

            if response.data and len(response.data) > 0:
                return response.data[0]
            return None

        except Exception as e:
            logger.error(f"Error updating user group: {e}")
            return None


def create_user_group_repository() -> Optional[UserGroupRepository]:
    """
    Factory function to create UserGroupRepository.

    Returns None if Supabase is not configured.
    """
    try:
        return UserGroupRepository()
    except ValueError:
        logger.warning("Supabase not configured, user groups unavailable")
        return None
