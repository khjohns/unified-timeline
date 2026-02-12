"""Tests for project access decorator."""

import os

import pytest
from flask import Flask, jsonify
from unittest.mock import MagicMock, patch

from lib.auth.magic_link import require_magic_link
from lib.auth.project_access import require_project_access
from lib.project_context import init_project_context


def _create_test_app(mock_container, min_role="viewer", bp_name="test_bp"):
    """Create a fresh Flask app with a protected test endpoint."""
    app = Flask(__name__)
    app.config["TESTING"] = True

    # Register project context middleware (sets g.project_id from header)
    init_project_context(app)

    @app.route("/protected")
    @require_magic_link
    @require_project_access(min_role=min_role)
    def test_endpoint():
        return jsonify({"ok": True})

    return app


class TestRequireProjectAccess:
    """Test the @require_project_access decorator."""

    @pytest.fixture(autouse=True)
    def setup(self, monkeypatch):
        """Set up test environment with auth disabled."""
        monkeypatch.setenv("DISABLE_AUTH", "true")

    def test_access_granted_when_member(self):
        """User with membership can access project."""
        mock_repo = MagicMock()
        mock_repo.get_role.return_value = "member"

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            app = _create_test_app(mock_container)
            client = app.test_client()

            resp = client.get(
                "/protected",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 200
            assert resp.get_json() == {"ok": True}

    def test_access_denied_when_not_member(self):
        """User without membership gets 403."""
        mock_repo = MagicMock()
        mock_repo.get_role.return_value = None

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            app = _create_test_app(mock_container)
            client = app.test_client()

            resp = client.get(
                "/protected",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 403
            data = resp.get_json()
            assert data["error"] == "FORBIDDEN"

    def test_default_project_bypasses_check(self):
        """The default 'oslobygg' project is open access (backward compat)."""
        # No mock_container needed -- oslobygg bypasses the membership check entirely
        mock_container = MagicMock()

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            app = _create_test_app(mock_container)
            client = app.test_client()

            resp = client.get(
                "/protected",
                headers={"X-Project-ID": "oslobygg"},
            )
            assert resp.status_code == 200
            # Verify the membership repo was never called
            mock_container.membership_repository.get_role.assert_not_called()

    def test_insufficient_role_denied(self):
        """User with viewer role denied when member required."""
        mock_repo = MagicMock()
        mock_repo.get_role.return_value = "viewer"

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            app = _create_test_app(mock_container, min_role="member")
            client = app.test_client()

            resp = client.get(
                "/protected",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 403
            data = resp.get_json()
            assert data["error"] == "FORBIDDEN"

    def test_admin_has_member_access(self):
        """Admin role satisfies member requirement."""
        mock_repo = MagicMock()
        mock_repo.get_role.return_value = "admin"

        mock_container = MagicMock()
        mock_container.membership_repository = mock_repo

        with patch("lib.auth.project_access.get_container", return_value=mock_container):
            app = _create_test_app(mock_container, min_role="member")
            client = app.test_client()

            resp = client.get(
                "/protected",
                headers={"X-Project-ID": "proj1"},
            )
            assert resp.status_code == 200
            assert resp.get_json() == {"ok": True}
