"""Tests for membership management API."""

import pytest
from unittest.mock import MagicMock, patch

from core.container import Container, set_container
from models.project_membership import ProjectMembership


class TestMembershipAPI:
    """Tests for /api/projects/<pid>/members endpoints."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        # Create a mock membership repo that handles both
        # the access decorator check (get_role) and the CRUD operations.
        self.mock_repo = MagicMock()
        # Default: test@example.com (set by DISABLE_AUTH) is admin in proj1
        self.mock_repo.get_role.return_value = "admin"

        # Inject mock repo into the container
        container = Container()
        container._membership_repo = self.mock_repo
        set_container(container)

        yield

        set_container(None)

    def test_list_members(self):
        self.mock_repo.get_by_project.return_value = [
            ProjectMembership(
                id="1",
                project_id="proj1",
                user_email="a@example.com",
                role="admin",
            )
        ]

        resp = self.client.get(
            "/api/projects/proj1/members",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["members"]) == 1
        assert data["members"][0]["user_email"] == "a@example.com"

    def test_add_member(self):
        self.mock_repo.add.return_value = ProjectMembership(
            id="new-id",
            project_id="proj1",
            user_email="new@example.com",
            role="member",
        )

        resp = self.client.post(
            "/api/projects/proj1/members",
            json={"email": "new@example.com", "role": "member"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True
        assert data["member"]["user_email"] == "new@example.com"

    def test_add_member_missing_email(self):
        resp = self.client.post(
            "/api/projects/proj1/members",
            json={"role": "member"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400

    def test_add_member_invalid_role(self):
        resp = self.client.post(
            "/api/projects/proj1/members",
            json={"email": "a@example.com", "role": "superadmin"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400

    def test_add_member_duplicate(self):
        self.mock_repo.add.side_effect = Exception("duplicate key violates unique constraint")

        resp = self.client.post(
            "/api/projects/proj1/members",
            json={"email": "existing@example.com", "role": "member"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 409
        assert resp.get_json()["error"] == "DUPLICATE"

    def test_remove_member(self):
        self.mock_repo.remove.return_value = True

        resp = self.client.delete(
            "/api/projects/proj1/members/user@example.com",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

    def test_remove_nonexistent_member(self):
        self.mock_repo.remove.return_value = False

        resp = self.client.delete(
            "/api/projects/proj1/members/unknown@example.com",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 404

    def test_remove_last_admin_blocked(self):
        """Cannot remove yourself if you are the last admin."""
        self.mock_repo.get_by_project.return_value = [
            ProjectMembership(
                id="1",
                project_id="proj1",
                user_email="test@example.com",
                role="admin",
            )
        ]

        resp = self.client.delete(
            "/api/projects/proj1/members/test@example.com",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400
        assert resp.get_json()["error"] == "LAST_ADMIN"

    def test_update_role(self):
        self.mock_repo.update_role.return_value = True

        resp = self.client.patch(
            "/api/projects/proj1/members/user@example.com",
            json={"role": "admin"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["success"] is True

    def test_update_role_invalid(self):
        resp = self.client.patch(
            "/api/projects/proj1/members/user@example.com",
            json={"role": "superadmin"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400

    def test_update_role_not_found(self):
        self.mock_repo.update_role.return_value = False

        resp = self.client.patch(
            "/api/projects/proj1/members/unknown@example.com",
            json={"role": "viewer"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 404

    def test_viewer_cannot_add_member(self):
        """Viewers should get 403 when trying to add members (requires admin)."""
        self.mock_repo.get_role.return_value = "viewer"

        resp = self.client.post(
            "/api/projects/proj1/members",
            json={"email": "new@example.com", "role": "member"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403

    def test_member_cannot_remove_member(self):
        """Members should get 403 when trying to remove members (requires admin)."""
        self.mock_repo.get_role.return_value = "member"

        resp = self.client.delete(
            "/api/projects/proj1/members/user@example.com",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403
