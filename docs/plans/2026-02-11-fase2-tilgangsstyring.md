# Fase 2: Tilgangsstyring - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add project-level access control so users only see and access projects they're members of.

**Architecture:** Email-based project memberships (works with both magic links and future Entra ID). Backend enforcement via decorator + application-level checks. RLS policies as defense layer. No migration away from magic links required - membership is checked using the email from the existing auth token.

**Tech Stack:** Supabase (PostgreSQL migration), Flask (decorator + middleware), React (filtered project list, admin UI)

**Key Design Decision - Entra ID Compatibility:**
The `project_memberships` table uses `user_email TEXT` (not `user_id UUID REFERENCES auth.users`) because:
- Magic links identify users by email
- Entra ID identifies users by email (preferred_username claim)
- Email is the common denominator across all auth providers
- Optional `external_id TEXT` field reserved for future Entra ID `oid` claim

---

## Task 1: Database Migration - project_memberships table

**Files:**
- Create: `supabase/migrations/20260211_project_memberships.sql`

**Step 1: Write the migration**

```sql
-- ============================================================
-- Project Memberships - Access Control
-- Migration: 20260211_project_memberships.sql
--
-- Email-based membership model compatible with:
-- - Magic links (current auth)
-- - Entra ID / IDA (future auth)
-- ============================================================

CREATE TABLE IF NOT EXISTS project_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Project reference
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- User identification (email is common across all auth providers)
    user_email TEXT NOT NULL,

    -- Optional: External identity provider ID (for future Entra ID)
    external_id TEXT,

    -- Project role (access level, NOT domain role like BH/TE)
    role TEXT NOT NULL DEFAULT 'member'
        CHECK (role IN ('admin', 'member', 'viewer')),

    -- Display name (cached from auth provider)
    display_name TEXT,

    -- Invited by
    invited_by TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Each user can only be member of a project once
    UNIQUE(project_id, user_email)
);

-- Indexes
CREATE INDEX idx_pm_project ON project_memberships(project_id);
CREATE INDEX idx_pm_email ON project_memberships(user_email);
CREATE INDEX idx_pm_external_id ON project_memberships(external_id)
    WHERE external_id IS NOT NULL;

-- RLS
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

-- Service role: full access (backend uses service_role key)
CREATE POLICY "Service role full access on project_memberships"
ON project_memberships
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Authenticated users: read own memberships
CREATE POLICY "Users can read own memberships"
ON project_memberships
FOR SELECT
TO authenticated
USING (
    user_email = (SELECT auth.email())
);

-- Auto-create membership for project creator
-- (project creator becomes admin)
CREATE OR REPLACE FUNCTION auto_create_project_membership()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.created_by IS NOT NULL THEN
        INSERT INTO project_memberships (project_id, user_email, role, invited_by)
        VALUES (NEW.id, NEW.created_by, 'admin', NEW.created_by)
        ON CONFLICT (project_id, user_email) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_membership_on_project_create
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_project_membership();

-- Seed: Add membership for existing project(s)
-- The 'oslobygg' default project gets no auto-membership (open access until migration)
-- Run manually after migration if needed:
-- INSERT INTO project_memberships (project_id, user_email, role)
-- VALUES ('oslobygg', 'your@email.com', 'admin');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_pm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_memberships_updated_at
    BEFORE UPDATE ON project_memberships
    FOR EACH ROW
    EXECUTE FUNCTION update_pm_updated_at();
```

**Step 2: Apply migration via Supabase MCP**

Run the migration using `mcp__supabase__apply_migration` with name `20260211_project_memberships`.

**Step 3: Verify table exists**

Run: `mcp__supabase__execute_sql` with `SELECT count(*) FROM project_memberships;`
Expected: 0 rows, no error.

**Step 4: Commit**

```bash
git add supabase/migrations/20260211_project_memberships.sql
git commit -m "feat(db): add project_memberships table for access control

Email-based membership model compatible with magic links and future Entra ID.
Roles: admin, member, viewer. Auto-creates admin membership for project creators."
```

---

## Task 2: Backend Model - ProjectMembership

**Files:**
- Create: `backend/models/project_membership.py`
- Test: `backend/tests/test_models/test_project_membership.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_models/test_project_membership.py
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
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models/test_project_membership.py -v`
Expected: FAIL (ModuleNotFoundError)

**Step 3: Write the model**

```python
# backend/models/project_membership.py
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
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_models/test_project_membership.py -v`
Expected: All 6 PASS

**Step 5: Commit**

```bash
git add backend/models/project_membership.py backend/tests/test_models/test_project_membership.py
git commit -m "feat: add ProjectMembership model with email normalization"
```

---

## Task 3: Backend Repository - MembershipRepository

**Files:**
- Create: `backend/repositories/membership_repository.py`
- Test: `backend/tests/test_repositories/test_membership_repository.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_repositories/test_membership_repository.py
"""Tests for MembershipRepository.

Uses an in-memory implementation for unit testing.
Integration tests against Supabase are separate.
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
```

**Step 2: Run tests to verify they pass** (these test the in-memory impl only)

Run: `cd backend && python -m pytest tests/test_repositories/test_membership_repository.py -v`
Expected: All PASS

**Step 3: Write the Supabase repository**

```python
# backend/repositories/membership_repository.py
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
```

**Step 4: Commit**

```bash
git add backend/repositories/membership_repository.py backend/tests/test_repositories/test_membership_repository.py
git commit -m "feat: add MembershipRepository with Supabase and in-memory implementations"
```

---

## Task 4: Register MembershipRepository in DI Container

**Files:**
- Modify: `backend/core/container.py`
- Test: Verify container loads correctly

**Step 1: Add membership_repository property to Container**

In `backend/core/container.py`, add:

1. TYPE_CHECKING import:
```python
from repositories.membership_repository import SupabaseMembershipRepository
```

2. Private cache field in Container:
```python
_membership_repo: Optional["SupabaseMembershipRepository"] = field(default=None, repr=False)
```

3. Property (after `project_repository`):
```python
@property
def membership_repository(self) -> "SupabaseMembershipRepository":
    """Lazy-load MembershipRepository."""
    if self._membership_repo is None:
        from repositories.membership_repository import SupabaseMembershipRepository
        self._membership_repo = SupabaseMembershipRepository()
    return self._membership_repo
```

4. Reset in `reset()`:
```python
self._membership_repo = None
```

**Step 2: Verify imports work**

Run: `cd backend && python -c "from core.container import Container; print('OK')"`
Expected: "OK"

**Step 3: Commit**

```bash
git add backend/core/container.py
git commit -m "feat: register MembershipRepository in DI container"
```

---

## Task 5: Backend Auth Decorator - @require_project_access

**Files:**
- Create: `backend/lib/auth/project_access.py`
- Test: `backend/tests/test_auth/test_project_access.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_auth/test_project_access.py
"""Tests for project access decorator."""

import os
import pytest
from unittest.mock import MagicMock, patch


class TestRequireProjectAccess:
    """Test the @require_project_access decorator."""

    @pytest.fixture(autouse=True)
    def setup(self, app, monkeypatch):
        """Set up test environment."""
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.app = app
        self.client = app.test_client()

    def test_access_granted_when_member(self, monkeypatch):
        """User with membership can access project."""
        mock_repo = MagicMock()
        mock_repo.is_member.return_value = True

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            from lib.auth.project_access import require_project_access
            from flask import Blueprint, jsonify

            bp = Blueprint("test_access", __name__)

            @bp.route("/test")
            @require_project_access()
            def test_endpoint():
                return jsonify({"ok": True})

            self.app.register_blueprint(bp, url_prefix="/test_access")

            resp = self.client.get(
                "/test_access/test",
                headers={
                    "X-Project-ID": "proj1",
                },
            )
            assert resp.status_code == 200

    def test_access_denied_when_not_member(self, monkeypatch):
        """User without membership gets 403."""
        mock_repo = MagicMock()
        mock_repo.is_member.return_value = False

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            from lib.auth.project_access import require_project_access
            from flask import Blueprint, jsonify

            bp = Blueprint("test_denied", __name__)

            @bp.route("/test")
            @require_project_access()
            def test_endpoint():
                return jsonify({"ok": True})

            self.app.register_blueprint(bp, url_prefix="/test_denied")

            resp = self.client.get(
                "/test_denied/test",
                headers={
                    "X-Project-ID": "proj1",
                },
            )
            assert resp.status_code == 403

    def test_default_project_bypasses_check(self, monkeypatch):
        """The default 'oslobygg' project is open access (backward compat)."""
        from lib.auth.project_access import require_project_access
        from flask import Blueprint, jsonify

        bp = Blueprint("test_default", __name__)

        @bp.route("/test")
        @require_project_access()
        def test_endpoint():
            return jsonify({"ok": True})

        self.app.register_blueprint(bp, url_prefix="/test_default")

        resp = self.client.get(
            "/test_default/test",
            headers={"X-Project-ID": "oslobygg"},
        )
        assert resp.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_auth/test_project_access.py -v`
Expected: FAIL (import error)

**Step 3: Write the decorator**

```python
# backend/lib/auth/project_access.py
"""
Project access control decorator.

Checks that the current user (identified by email from magic link or Entra ID)
has membership in the project specified by X-Project-ID header.

Backward compatibility: The default project ('oslobygg') is open access
until all users have been migrated to project memberships.
"""

import logging
from functools import wraps

from flask import g, jsonify, request

logger = logging.getLogger(__name__)

# Projects that don't require membership checks (backward compat)
OPEN_ACCESS_PROJECTS = {"oslobygg"}


def _get_user_email() -> str | None:
    """Extract user email from request context.

    Supports:
    - Magic links: request.magic_link_data["email"]
    - Entra ID: g.entra_user.email (future)
    - DISABLE_AUTH: test@example.com
    """
    # Magic link auth
    if hasattr(request, "magic_link_data") and request.magic_link_data:
        return request.magic_link_data.get("email")

    # Entra ID auth (future)
    if hasattr(g, "entra_user") and g.entra_user:
        return g.entra_user.email

    return None


def get_container():
    """Import here to avoid circular imports."""
    from core.container import get_container
    return get_container()


def require_project_access(min_role: str = "viewer"):
    """
    Decorator that checks project membership.

    Must be used AFTER @require_magic_link or @require_entra_auth
    so that user email is available in request context.

    Args:
        min_role: Minimum required role. "viewer" < "member" < "admin"
    """
    ROLE_HIERARCHY = {"viewer": 0, "member": 1, "admin": 2}

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            project_id = getattr(g, "project_id", "oslobygg")

            # Open access projects bypass membership check
            if project_id in OPEN_ACCESS_PROJECTS:
                return f(*args, **kwargs)

            email = _get_user_email()
            if not email:
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": "Bruker-e-post ikke tilgjengelig for tilgangskontroll",
                }), 403

            repo = get_container().membership_repository
            role = repo.get_role(project_id, email)

            if role is None:
                logger.warning(
                    f"Access denied: {email} is not a member of project {project_id}"
                )
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": "Du har ikke tilgang til dette prosjektet",
                }), 403

            # Check role hierarchy
            if ROLE_HIERARCHY.get(role, 0) < ROLE_HIERARCHY.get(min_role, 0):
                logger.warning(
                    f"Insufficient role: {email} has '{role}' but needs '{min_role}' "
                    f"in project {project_id}"
                )
                return jsonify({
                    "error": "FORBIDDEN",
                    "message": f"Krever '{min_role}'-tilgang til dette prosjektet",
                }), 403

            # Store membership info in request context
            g.project_role = role
            g.user_email = email

            return f(*args, **kwargs)

        return decorated_function

    return decorator
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_auth/test_project_access.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/lib/auth/project_access.py backend/tests/test_auth/test_project_access.py
git commit -m "feat: add @require_project_access decorator with role hierarchy"
```

---

## Task 6: Apply @require_project_access to Existing Routes

**Files:**
- Modify: `backend/routes/event_routes.py`
- Modify: `backend/routes/project_routes.py`

**Step 1: Add decorator to project_routes.py**

Import at top:
```python
from lib.auth.project_access import require_project_access
```

Update `list_projects` to return only user's projects:
```python
@projects_bp.route("/api/projects", methods=["GET"])
@require_magic_link
def list_projects():
    """List projects the current user has access to."""
    try:
        email = request.magic_link_data.get("email")
        if not email:
            # Fallback: return all active (backward compat)
            projects = _get_project_repo().list_active()
        else:
            # Get user's memberships
            from core.container import get_container
            memberships = get_container().membership_repository.get_user_projects(email)
            member_project_ids = {m.project_id for m in memberships}

            # Always include open-access projects
            from lib.auth.project_access import OPEN_ACCESS_PROJECTS
            all_projects = _get_project_repo().list_active()
            projects = [
                p for p in all_projects
                if p.id in member_project_ids or p.id in OPEN_ACCESS_PROJECTS
            ]

        return jsonify({
            "projects": [p.model_dump(mode="json") for p in projects]
        })
    except Exception as e:
        logger.error(f"Failed to list projects: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
```

Add `@require_project_access()` to `get_project`:
```python
@projects_bp.route("/api/projects/<project_id>", methods=["GET"])
@require_magic_link
@require_project_access()
def get_project(project_id: str):
```

Add `@require_project_access(min_role="member")` to `create_project`:
(Actually, creating a project doesn't require membership in an existing project,
so this stays as-is. The trigger auto-creates admin membership.)

**Step 2: Add decorator to event_routes.py**

Import at top of `backend/routes/event_routes.py`:
```python
from lib.auth.project_access import require_project_access
```

Add `@require_project_access()` after `@require_magic_link` on all endpoints that are project-scoped:
- `GET /api/cases/<sak_id>/state` - add `@require_project_access()`
- `GET /api/cases/<sak_id>/events` - add `@require_project_access()`
- `POST /api/cases` - add `@require_project_access(min_role="member")`
- `POST /api/cases/<sak_id>/events` - add `@require_project_access(min_role="member")`
- All other project-scoped endpoints

Pattern:
- GET/read endpoints: `@require_project_access()` (viewer is sufficient)
- POST/write endpoints: `@require_project_access(min_role="member")`
- Admin-only endpoints: `@require_project_access(min_role="admin")`

**Step 3: Run existing tests**

Run: `cd backend && make test`
Expected: All existing tests pass (DISABLE_AUTH=true bypasses access check,
and default project "oslobygg" is open access)

**Step 4: Commit**

```bash
git add backend/routes/event_routes.py backend/routes/project_routes.py
git commit -m "feat: enforce project access control on all API routes

Open access for default project 'oslobygg' for backward compatibility.
New projects require explicit membership."
```

---

## Task 7: Membership Management API Routes

**Files:**
- Create: `backend/routes/membership_routes.py`
- Modify: `backend/app.py` (register blueprint)
- Test: `backend/tests/test_api/test_membership_api.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_api/test_membership_api.py
"""Tests for membership management API."""

import os
import pytest
from unittest.mock import MagicMock, patch

from models.project_membership import ProjectMembership


class TestMembershipAPI:
    @pytest.fixture(autouse=True)
    def setup(self, app, client, monkeypatch):
        monkeypatch.setenv("DISABLE_AUTH", "true")
        self.client = client

    def test_list_members(self):
        mock_repo = MagicMock()
        mock_repo.get_by_project.return_value = [
            ProjectMembership(
                id="1",
                project_id="proj1",
                user_email="a@example.com",
                role="admin",
            )
        ]
        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("routes.membership_routes._get_membership_repo", return_value=mock_repo):
            resp = self.client.get(
                "/api/projects/proj1/members",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 200
            data = resp.get_json()
            assert len(data["members"]) == 1
            assert data["members"][0]["user_email"] == "a@example.com"

    def test_add_member(self):
        mock_repo = MagicMock()
        mock_repo.add.return_value = ProjectMembership(
            id="new-id",
            project_id="proj1",
            user_email="new@example.com",
            role="member",
        )
        mock_repo.get_role.return_value = "admin"  # Current user is admin

        with patch("routes.membership_routes._get_membership_repo", return_value=mock_repo):
            resp = self.client.post(
                "/api/projects/proj1/members",
                json={"email": "new@example.com", "role": "member"},
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 201

    def test_remove_member(self):
        mock_repo = MagicMock()
        mock_repo.remove.return_value = True
        mock_repo.get_role.return_value = "admin"  # Current user is admin

        with patch("routes.membership_routes._get_membership_repo", return_value=mock_repo):
            resp = self.client.delete(
                "/api/projects/proj1/members/user@example.com",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 200
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_api/test_membership_api.py -v`
Expected: FAIL

**Step 3: Write the routes**

```python
# backend/routes/membership_routes.py
"""
Membership management routes.

Endpoints:
- GET    /api/projects/<pid>/members           - List members
- POST   /api/projects/<pid>/members           - Add member (admin only)
- DELETE /api/projects/<pid>/members/<email>    - Remove member (admin only)
- PATCH  /api/projects/<pid>/members/<email>    - Update role (admin only)
"""

from flask import Blueprint, jsonify, request

from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from models.project_membership import ProjectMembership
from utils.logger import get_logger

logger = get_logger(__name__)

membership_bp = Blueprint("membership", __name__)


def _get_membership_repo():
    from core.container import get_container
    return get_container().membership_repository


@membership_bp.route("/api/projects/<project_id>/members", methods=["GET"])
@require_magic_link
@require_project_access()
def list_members(project_id: str):
    """List all members of a project."""
    try:
        members = _get_membership_repo().get_by_project(project_id)
        return jsonify({
            "members": [m.model_dump(mode="json") for m in members]
        })
    except Exception as e:
        logger.error(f"Failed to list members for {project_id}: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route("/api/projects/<project_id>/members", methods=["POST"])
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def add_member(project_id: str):
    """Add a member to a project. Requires admin role."""
    try:
        payload = request.json
        if not payload or not payload.get("email"):
            return jsonify({
                "error": "MISSING_PARAMETERS",
                "message": "email is required",
            }), 400

        role = payload.get("role", "member")
        if role not in ("admin", "member", "viewer"):
            return jsonify({
                "error": "INVALID_ROLE",
                "message": "role must be admin, member, or viewer",
            }), 400

        email = request.magic_link_data.get("email", "unknown")

        membership = ProjectMembership(
            project_id=project_id,
            user_email=payload["email"],
            role=role,
            display_name=payload.get("display_name"),
            invited_by=email,
        )

        result = _get_membership_repo().add(membership)
        logger.info(f"Member added: {payload['email']} to {project_id} as {role}")
        return jsonify({
            "success": True,
            "member": result.model_dump(mode="json"),
        }), 201

    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            return jsonify({
                "error": "DUPLICATE",
                "message": "Brukeren er allerede medlem av prosjektet",
            }), 409
        logger.error(f"Failed to add member: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route(
    "/api/projects/<project_id>/members/<path:user_email>", methods=["DELETE"]
)
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def remove_member(project_id: str, user_email: str):
    """Remove a member from a project. Requires admin role."""
    try:
        # Prevent removing yourself if you're the last admin
        current_email = request.magic_link_data.get("email", "")
        if user_email.lower() == current_email.lower():
            members = _get_membership_repo().get_by_project(project_id)
            admin_count = sum(1 for m in members if m.role == "admin")
            if admin_count <= 1:
                return jsonify({
                    "error": "LAST_ADMIN",
                    "message": "Kan ikke fjerne siste admin fra prosjektet",
                }), 400

        removed = _get_membership_repo().remove(project_id, user_email)
        if not removed:
            return jsonify({
                "error": "NOT_FOUND",
                "message": "Medlemskap ikke funnet",
            }), 404

        logger.info(f"Member removed: {user_email} from {project_id}")
        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Failed to remove member: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500


@membership_bp.route(
    "/api/projects/<project_id>/members/<path:user_email>", methods=["PATCH"]
)
@require_csrf
@require_magic_link
@require_project_access(min_role="admin")
def update_member_role(project_id: str, user_email: str):
    """Update a member's role. Requires admin role."""
    try:
        payload = request.json
        if not payload or not payload.get("role"):
            return jsonify({
                "error": "MISSING_PARAMETERS",
                "message": "role is required",
            }), 400

        new_role = payload["role"]
        if new_role not in ("admin", "member", "viewer"):
            return jsonify({
                "error": "INVALID_ROLE",
                "message": "role must be admin, member, or viewer",
            }), 400

        updated = _get_membership_repo().update_role(project_id, user_email, new_role)
        if not updated:
            return jsonify({
                "error": "NOT_FOUND",
                "message": "Medlemskap ikke funnet",
            }), 404

        logger.info(f"Role updated: {user_email} in {project_id} -> {new_role}")
        return jsonify({"success": True})

    except Exception as e:
        logger.error(f"Failed to update role: {e}", exc_info=True)
        return jsonify({"error": "INTERNAL_ERROR", "message": str(e)}), 500
```

**Step 4: Register blueprint in app.py**

In `backend/app.py`, add:
```python
from routes.membership_routes import membership_bp
app.register_blueprint(membership_bp)
```

**Step 5: Run tests**

Run: `cd backend && python -m pytest tests/test_api/test_membership_api.py -v`
Expected: All PASS

Run: `cd backend && make test`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add backend/routes/membership_routes.py backend/tests/test_api/test_membership_api.py backend/app.py
git commit -m "feat: add membership management API (list, add, remove, update role)"
```

---

## Task 8: Frontend - TypeScript Types and API Client

**Files:**
- Create: `src/types/membership.ts`
- Modify: `src/api/client.ts` (add membership API functions, or create new file)

**Step 1: Write the types**

```typescript
// src/types/membership.ts
export interface ProjectMembership {
  id: string;
  project_id: string;
  user_email: string;
  external_id?: string;
  role: 'admin' | 'member' | 'viewer';
  display_name?: string;
  invited_by?: string;
  created_at: string;
  updated_at: string;
}

export type ProjectRole = ProjectMembership['role'];
```

**Step 2: Add API functions**

Create `src/api/membership.ts`:

```typescript
// src/api/membership.ts
import { apiFetch } from './client';
import type { ProjectMembership } from '../types/membership';

export async function listMembers(projectId: string): Promise<ProjectMembership[]> {
  const data = await apiFetch<{ members: ProjectMembership[] }>(
    `/api/projects/${projectId}/members`
  );
  return data.members;
}

export async function addMember(
  projectId: string,
  email: string,
  role: string = 'member',
  displayName?: string
): Promise<ProjectMembership> {
  const data = await apiFetch<{ member: ProjectMembership }>(
    `/api/projects/${projectId}/members`,
    {
      method: 'POST',
      body: JSON.stringify({ email, role, display_name: displayName }),
    }
  );
  return data.member;
}

export async function removeMember(
  projectId: string,
  userEmail: string
): Promise<void> {
  await apiFetch(`/api/projects/${projectId}/members/${encodeURIComponent(userEmail)}`, {
    method: 'DELETE',
  });
}

export async function updateMemberRole(
  projectId: string,
  userEmail: string,
  role: string
): Promise<void> {
  await apiFetch(
    `/api/projects/${projectId}/members/${encodeURIComponent(userEmail)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }
  );
}
```

**Step 3: Commit**

```bash
git add src/types/membership.ts src/api/membership.ts
git commit -m "feat: add membership TypeScript types and API client"
```

---

## Task 9: Frontend - Filter Project Selector by Membership

**Files:**
- Modify: `src/components/ProjectSelector.tsx`

**Step 1: Read current ProjectSelector**

Understand how it currently fetches projects (GET /api/projects).

**Step 2: No change needed in ProjectSelector**

The backend `list_projects` endpoint (Task 6) already filters by membership.
The frontend will automatically only see projects the user has access to.

Verify this works by checking that ProjectSelector uses the same API endpoint.

**Step 3: Commit** (skip if no change needed)

---

## Task 10: Frontend - Project Members Admin UI

**Files:**
- Create: `src/components/ProjectMembers.tsx`

**Step 1: Create the component**

A simple members list with add/remove functionality, shown on a project settings page or as a modal. Use existing Punkt design system patterns.

```typescript
// src/components/ProjectMembers.tsx
// Component that shows project members with admin controls:
// - List members with email, role, invited_by
// - Add member form (email + role dropdown)
// - Remove member button (admin only)
// - Update role dropdown (admin only)
// - "Last admin" protection (can't remove self if last admin)
//
// Uses React Query for data fetching/mutation.
// Only visible to project admins.
```

Implementation details:
- Use `useQuery` with key `['project-members', projectId]`
- Use `useMutation` for add/remove/update with `invalidateQueries`
- Conditional rendering: only show admin controls if current user role is 'admin'
- Use Punkt design system: `rounded-lg` cards, `text-pkt-text-body-default`, etc.
- Add member form: email input + role select (member/viewer/admin)
- Confirmation dialog before removing members

**Step 2: Add route/navigation**

Add a "Members" tab or link in the project settings area.
This depends on existing navigation structure - check `src/pages/` for where to integrate.

**Step 3: Run frontend tests**

Run: `npm run test`
Expected: All pass

**Step 4: Commit**

```bash
git add src/components/ProjectMembers.tsx
git commit -m "feat: add ProjectMembers admin UI component"
```

---

## Task 11: Run Full Test Suite and Static Analysis

**Step 1: Backend tests**

Run: `cd backend && make test`
Expected: All pass

**Step 2: Frontend tests**

Run: `npm run test`
Expected: All pass

**Step 3: Drift check**

Run: `python scripts/check_drift.py`
Expected: No new drift issues (may need to update drift checker for new types)

**Step 4: Lint**

Run: `npm run lint`
Expected: No new warnings

**Step 5: Commit any fixes from test/lint failures**

---

## Summary of Changes

| Layer | What | Files |
|-------|------|-------|
| Database | `project_memberships` table with RLS | `supabase/migrations/20260211_project_memberships.sql` |
| Model | `ProjectMembership` Pydantic model | `backend/models/project_membership.py` |
| Repository | Supabase + in-memory membership repos | `backend/repositories/membership_repository.py` |
| DI Container | Register membership repo | `backend/core/container.py` |
| Auth | `@require_project_access` decorator | `backend/lib/auth/project_access.py` |
| Routes | Apply access control + membership CRUD | `backend/routes/*.py` |
| Frontend Types | `ProjectMembership` TypeScript type | `src/types/membership.ts` |
| Frontend API | Membership API client | `src/api/membership.ts` |
| Frontend UI | Project members admin component | `src/components/ProjectMembers.tsx` |
| Tests | Model, repo, auth, API tests | `backend/tests/test_*/` |

## Entra ID Compatibility

This plan is designed for future Entra ID integration:

1. **`user_email`** is the primary identifier (works with both magic links and Entra ID)
2. **`external_id`** field reserved for Entra ID `oid` claim
3. **`_get_user_email()`** helper already supports Entra ID via `g.entra_user.email`
4. When Entra ID is enabled, the same decorator and membership model work unchanged
5. Only the auth layer changes (JWT validation instead of magic link), not the access control layer

## Backward Compatibility

- Default project `oslobygg` has open access (no membership required)
- `DISABLE_AUTH=true` bypasses all checks (testing)
- Existing magic links continue to work
- New projects created via API auto-assign creator as admin
