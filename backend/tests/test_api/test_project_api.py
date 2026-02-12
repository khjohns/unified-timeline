"""Tests for project management API."""

import pytest
from unittest.mock import MagicMock

from core.container import Container, set_container
from models.project import Project


class TestCreateProject:
    """Tests for POST /api/projects."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        self.mock_project_repo = MagicMock()
        self.mock_membership_repo = MagicMock()
        # Default: no role needed for create (no @require_project_access)
        self.mock_membership_repo.get_role.return_value = "admin"

        container = Container()
        container._project_repo = self.mock_project_repo
        container._membership_repo = self.mock_membership_repo
        set_container(container)

        yield

        set_container(None)

    def test_create_project_success(self):
        """POST /api/projects with valid name creates project with server-generated UUID."""
        resp = self.client.post(
            "/api/projects",
            json={"name": "My New Project", "description": "A test project"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True
        assert data["project"]["name"] == "My New Project"
        assert data["project"]["description"] == "A test project"
        # ID should be a UUID (36 chars with dashes)
        assert len(data["project"]["id"]) == 36
        assert "-" in data["project"]["id"]
        # created_by should be set from auth
        assert data["project"]["created_by"] == "test@example.com"

        # Verify project repo create was called
        self.mock_project_repo.create.assert_called_once()
        created_project = self.mock_project_repo.create.call_args[0][0]
        assert created_project.name == "My New Project"

    def test_create_project_auto_adds_creator_as_admin(self):
        """Creator should be auto-added as admin member."""
        resp = self.client.post(
            "/api/projects",
            json={"name": "My Project"},
        )
        assert resp.status_code == 201

        # Verify membership repo add was called with admin role
        self.mock_membership_repo.add.assert_called_once()
        membership = self.mock_membership_repo.add.call_args[0][0]
        assert membership.user_email == "test@example.com"
        assert membership.role == "admin"
        assert membership.invited_by == "test@example.com"

    def test_create_project_missing_name(self):
        """POST /api/projects without name returns 400."""
        resp = self.client.post(
            "/api/projects",
            json={"description": "No name provided"},
        )
        assert resp.status_code == 400
        assert resp.get_json()["error"] == "MISSING_PARAMETERS"

    def test_create_project_empty_body(self):
        """POST /api/projects with empty body returns 400."""
        resp = self.client.post(
            "/api/projects",
            json={},
        )
        assert resp.status_code == 400

    def test_create_project_empty_name(self):
        """POST /api/projects with empty name string returns 400."""
        resp = self.client.post(
            "/api/projects",
            json={"name": ""},
        )
        assert resp.status_code == 400

    def test_create_project_with_settings(self):
        """POST /api/projects can include settings."""
        resp = self.client.post(
            "/api/projects",
            json={"name": "Settings Project", "settings": {"theme": "dark"}},
        )
        assert resp.status_code == 201
        created_project = self.mock_project_repo.create.call_args[0][0]
        assert created_project.settings == {"theme": "dark"}

    def test_create_project_no_client_id(self):
        """POST /api/projects ignores client-provided id (server generates UUID)."""
        resp = self.client.post(
            "/api/projects",
            json={"name": "Project With ID", "id": "my-custom-id"},
        )
        assert resp.status_code == 201
        data = resp.get_json()
        # The ID should NOT be "my-custom-id" - it should be a server-generated UUID
        assert data["project"]["id"] != "my-custom-id"
        assert len(data["project"]["id"]) == 36

    def test_create_project_membership_failure_still_creates(self):
        """If membership add fails, project should still be created."""
        self.mock_membership_repo.add.side_effect = Exception("membership error")

        resp = self.client.post(
            "/api/projects",
            json={"name": "Project With Membership Issue"},
        )
        # Project creation should still succeed
        assert resp.status_code == 201
        self.mock_project_repo.create.assert_called_once()


class TestUpdateProject:
    """Tests for PATCH /api/projects/<project_id>."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        self.mock_project_repo = MagicMock()
        self.mock_membership_repo = MagicMock()
        # Default: test@example.com is admin
        self.mock_membership_repo.get_role.return_value = "admin"

        container = Container()
        container._project_repo = self.mock_project_repo
        container._membership_repo = self.mock_membership_repo
        set_container(container)

        yield

        set_container(None)

    def test_update_project_name(self):
        """PATCH /api/projects/<id> updates name."""
        updated = Project(
            id="proj1",
            name="Updated Name",
            description="Old desc",
        )
        self.mock_project_repo.update.return_value = updated

        resp = self.client.patch(
            "/api/projects/proj1",
            json={"name": "Updated Name"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True
        assert data["project"]["name"] == "Updated Name"

        self.mock_project_repo.update.assert_called_once_with(
            "proj1", {"name": "Updated Name"}
        )

    def test_update_project_description(self):
        """PATCH /api/projects/<id> updates description."""
        updated = Project(
            id="proj1",
            name="Name",
            description="New description",
        )
        self.mock_project_repo.update.return_value = updated

        resp = self.client.patch(
            "/api/projects/proj1",
            json={"description": "New description"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["project"]["description"] == "New description"

    def test_update_project_both_fields(self):
        """PATCH /api/projects/<id> updates both name and description."""
        updated = Project(
            id="proj1",
            name="New Name",
            description="New Desc",
        )
        self.mock_project_repo.update.return_value = updated

        resp = self.client.patch(
            "/api/projects/proj1",
            json={"name": "New Name", "description": "New Desc"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        self.mock_project_repo.update.assert_called_once_with(
            "proj1", {"name": "New Name", "description": "New Desc"}
        )

    def test_update_project_empty_body(self):
        """PATCH /api/projects/<id> with empty body returns 400."""
        resp = self.client.patch(
            "/api/projects/proj1",
            json={},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400

    def test_update_project_no_valid_fields(self):
        """PATCH with no recognized fields returns 400."""
        resp = self.client.patch(
            "/api/projects/proj1",
            json={"unknown_field": "value"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400
        assert resp.get_json()["error"] == "MISSING_PARAMETERS"

    def test_update_project_not_found(self):
        """PATCH /api/projects/<id> with nonexistent project returns 404."""
        self.mock_project_repo.update.return_value = None

        resp = self.client.patch(
            "/api/projects/nonexistent",
            json={"name": "New Name"},
            headers={"X-Project-ID": "nonexistent"},
        )
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "NOT_FOUND"

    def test_update_project_viewer_forbidden(self):
        """Viewers cannot update projects (requires admin)."""
        self.mock_membership_repo.get_role.return_value = "viewer"

        resp = self.client.patch(
            "/api/projects/proj1",
            json={"name": "New Name"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403

    def test_update_project_member_forbidden(self):
        """Members cannot update projects (requires admin)."""
        self.mock_membership_repo.get_role.return_value = "member"

        resp = self.client.patch(
            "/api/projects/proj1",
            json={"name": "New Name"},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403

    def test_update_project_empty_name(self):
        """PATCH with empty name string returns 400."""
        resp = self.client.patch(
            "/api/projects/proj1",
            json={"name": ""},
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 400


class TestDeactivateProject:
    """Tests for PATCH /api/projects/<project_id>/deactivate."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        self.mock_project_repo = MagicMock()
        self.mock_membership_repo = MagicMock()
        # Default: test@example.com is admin
        self.mock_membership_repo.get_role.return_value = "admin"

        container = Container()
        container._project_repo = self.mock_project_repo
        container._membership_repo = self.mock_membership_repo
        set_container(container)

        yield

        set_container(None)

    def test_deactivate_project_success(self):
        """PATCH /api/projects/<id>/deactivate soft-deletes project."""
        self.mock_project_repo.deactivate.return_value = True

        resp = self.client.patch(
            "/api/projects/proj1/deactivate",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["success"] is True

        self.mock_project_repo.deactivate.assert_called_once_with("proj1")

    def test_deactivate_project_not_found(self):
        """PATCH /api/projects/<id>/deactivate with nonexistent project returns 404."""
        self.mock_project_repo.deactivate.return_value = False

        resp = self.client.patch(
            "/api/projects/nonexistent/deactivate",
            headers={"X-Project-ID": "nonexistent"},
        )
        assert resp.status_code == 404
        assert resp.get_json()["error"] == "NOT_FOUND"

    def test_deactivate_project_viewer_forbidden(self):
        """Viewers cannot deactivate projects (requires admin)."""
        self.mock_membership_repo.get_role.return_value = "viewer"

        resp = self.client.patch(
            "/api/projects/proj1/deactivate",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403

    def test_deactivate_project_member_forbidden(self):
        """Members cannot deactivate projects (requires admin)."""
        self.mock_membership_repo.get_role.return_value = "member"

        resp = self.client.patch(
            "/api/projects/proj1/deactivate",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403


class TestListProjects:
    """Tests for GET /api/projects."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        self.mock_project_repo = MagicMock()
        self.mock_membership_repo = MagicMock()

        container = Container()
        container._project_repo = self.mock_project_repo
        container._membership_repo = self.mock_membership_repo
        set_container(container)

        yield

        set_container(None)

    def test_list_projects_with_memberships(self):
        """GET /api/projects returns projects user is member of + open access."""
        from models.project_membership import ProjectMembership

        self.mock_membership_repo.get_user_projects.return_value = [
            ProjectMembership(
                id="1",
                project_id="proj1",
                user_email="test@example.com",
                role="admin",
            )
        ]
        self.mock_project_repo.list_active.return_value = [
            Project(id="proj1", name="Project 1"),
            Project(id="oslobygg", name="Oslo Bygg"),
            Project(id="proj2", name="Project 2"),
        ]

        resp = self.client.get("/api/projects")
        assert resp.status_code == 200
        data = resp.get_json()
        project_ids = [p["id"] for p in data["projects"]]
        # Should include proj1 (member) and oslobygg (open access), but NOT proj2
        assert "proj1" in project_ids
        assert "oslobygg" in project_ids
        assert "proj2" not in project_ids


class TestGetProject:
    """Tests for GET /api/projects/<project_id>."""

    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

        self.mock_project_repo = MagicMock()
        self.mock_membership_repo = MagicMock()
        self.mock_membership_repo.get_role.return_value = "admin"

        container = Container()
        container._project_repo = self.mock_project_repo
        container._membership_repo = self.mock_membership_repo
        set_container(container)

        yield

        set_container(None)

    def test_get_project_success(self):
        """GET /api/projects/<id> returns project details."""
        self.mock_project_repo.get.return_value = Project(
            id="proj1",
            name="Project 1",
            description="A project",
        )

        resp = self.client.get(
            "/api/projects/proj1",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["id"] == "proj1"
        assert data["name"] == "Project 1"

    def test_get_project_not_found(self):
        """GET /api/projects/<id> with nonexistent project returns 404."""
        self.mock_project_repo.get.return_value = None

        resp = self.client.get(
            "/api/projects/nonexistent",
            headers={"X-Project-ID": "nonexistent"},
        )
        assert resp.status_code == 404

    def test_get_project_no_access(self):
        """GET /api/projects/<id> without membership returns 403."""
        self.mock_membership_repo.get_role.return_value = None

        resp = self.client.get(
            "/api/projects/proj1",
            headers={"X-Project-ID": "proj1"},
        )
        assert resp.status_code == 403
