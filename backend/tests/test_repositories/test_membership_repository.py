"""Tests for MembershipRepository.

Uses an in-memory implementation for unit testing.
"""

import pytest

from models.project_membership import ProjectMembership


class InMemoryMembershipRepository:
    """In-memory implementation for testing."""

    def __init__(self):
        self._memberships: list[dict] = []

    def add(self, membership: ProjectMembership) -> ProjectMembership:
        row = membership.model_dump()
        row["id"] = f"fake-{len(self._memberships)}"
        self._memberships.append(row)
        return ProjectMembership(**row)

    def get_by_project(self, project_id: str) -> list[ProjectMembership]:
        return [
            ProjectMembership(**row)
            for row in self._memberships
            if row["project_id"] == project_id
        ]

    def get_user_projects(self, user_email: str) -> list[ProjectMembership]:
        email = user_email.lower().strip()
        return [
            ProjectMembership(**row)
            for row in self._memberships
            if row["user_email"] == email
        ]

    def is_member(self, project_id: str, user_email: str) -> bool:
        email = user_email.lower().strip()
        return any(
            row["project_id"] == project_id and row["user_email"] == email
            for row in self._memberships
        )

    def get_role(self, project_id: str, user_email: str) -> str | None:
        email = user_email.lower().strip()
        for row in self._memberships:
            if row["project_id"] == project_id and row["user_email"] == email:
                return row["role"]
        return None

    def remove(self, project_id: str, user_email: str) -> bool:
        email = user_email.lower().strip()
        before = len(self._memberships)
        self._memberships = [
            row
            for row in self._memberships
            if not (row["project_id"] == project_id and row["user_email"] == email)
        ]
        return len(self._memberships) < before

    def update_role(self, project_id: str, user_email: str, role: str) -> bool:
        email = user_email.lower().strip()
        for row in self._memberships:
            if row["project_id"] == project_id and row["user_email"] == email:
                row["role"] = role
                return True
        return False


class TestMembershipRepository:
    @pytest.fixture
    def repo(self):
        return InMemoryMembershipRepository()

    def test_add_and_list(self, repo):
        m = ProjectMembership(
            project_id="proj1", user_email="a@example.com", role="member"
        )
        repo.add(m)
        members = repo.get_by_project("proj1")
        assert len(members) == 1
        assert members[0].user_email == "a@example.com"

    def test_is_member(self, repo):
        repo.add(ProjectMembership(project_id="proj1", user_email="a@example.com"))
        assert repo.is_member("proj1", "a@example.com") is True
        assert repo.is_member("proj1", "b@example.com") is False
        assert repo.is_member("proj2", "a@example.com") is False

    def test_get_role(self, repo):
        repo.add(
            ProjectMembership(
                project_id="proj1", user_email="admin@example.com", role="admin"
            )
        )
        assert repo.get_role("proj1", "admin@example.com") == "admin"
        assert repo.get_role("proj1", "unknown@example.com") is None

    def test_get_user_projects(self, repo):
        repo.add(ProjectMembership(project_id="proj1", user_email="a@example.com"))
        repo.add(ProjectMembership(project_id="proj2", user_email="a@example.com"))
        repo.add(ProjectMembership(project_id="proj3", user_email="b@example.com"))

        projects = repo.get_user_projects("a@example.com")
        assert len(projects) == 2
        assert {p.project_id for p in projects} == {"proj1", "proj2"}

    def test_remove(self, repo):
        repo.add(ProjectMembership(project_id="proj1", user_email="a@example.com"))
        assert repo.remove("proj1", "a@example.com") is True
        assert repo.is_member("proj1", "a@example.com") is False
        assert repo.remove("proj1", "a@example.com") is False

    def test_update_role(self, repo):
        repo.add(
            ProjectMembership(
                project_id="proj1", user_email="a@example.com", role="member"
            )
        )
        assert repo.update_role("proj1", "a@example.com", "admin") is True
        assert repo.get_role("proj1", "a@example.com") == "admin"

    def test_email_case_insensitive(self, repo):
        repo.add(ProjectMembership(project_id="proj1", user_email="A@Example.COM"))
        assert repo.is_member("proj1", "a@example.com") is True
        assert repo.get_role("proj1", "A@EXAMPLE.COM") == "member"
