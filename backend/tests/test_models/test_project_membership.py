"""Tests for ProjectMembership model."""

import pytest
from pydantic import ValidationError


class TestProjectMembership:
    def test_create_membership(self):
        from models.project_membership import ProjectMembership

        m = ProjectMembership(
            project_id="oslobygg",
            user_email="test@example.com",
            role="member",
        )
        assert m.project_id == "oslobygg"
        assert m.user_email == "test@example.com"
        assert m.role == "member"

    def test_default_role_is_member(self):
        from models.project_membership import ProjectMembership

        m = ProjectMembership(
            project_id="oslobygg",
            user_email="test@example.com",
        )
        assert m.role == "member"

    def test_invalid_role_rejected(self):
        from models.project_membership import ProjectMembership

        with pytest.raises(ValidationError):
            ProjectMembership(
                project_id="oslobygg",
                user_email="test@example.com",
                role="superadmin",
            )

    def test_email_normalized_to_lowercase(self):
        from models.project_membership import ProjectMembership

        m = ProjectMembership(
            project_id="oslobygg",
            user_email="Test@Example.COM",
        )
        assert m.user_email == "test@example.com"

    def test_admin_role(self):
        from models.project_membership import ProjectMembership

        m = ProjectMembership(
            project_id="oslobygg",
            user_email="admin@example.com",
            role="admin",
        )
        assert m.role == "admin"

    def test_viewer_role(self):
        from models.project_membership import ProjectMembership

        m = ProjectMembership(
            project_id="oslobygg",
            user_email="viewer@example.com",
            role="viewer",
        )
        assert m.role == "viewer"
