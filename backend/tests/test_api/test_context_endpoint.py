"""
Tests for the combined /api/cases/<sak_id>/context endpoint.

Verifies that the context endpoint returns state + timeline + historikk
in a single response, using only one fetch of events from the repository.
"""

import sys

sys.path.insert(0, ".")

from unittest.mock import MagicMock, patch

from routes.event_routes import _fetch_and_parse_events


class TestFetchAndParseEvents:
    """Test the shared _fetch_and_parse_events helper."""

    def test_returns_404_when_no_events(self):
        """Empty events list returns 404 response."""
        mock_repo = MagicMock()
        mock_repo.get_events.return_value = ([], 0)

        from flask import Flask

        app = Flask(__name__)
        with app.app_context():
            with patch(
                "routes.event_routes._get_event_repo", return_value=mock_repo
            ):
                result = _fetch_and_parse_events("nonexistent")

        # Should be a tuple of (response, status_code)
        assert len(result) == 2
        assert result[1] == 404

    def test_returns_parsed_events_and_version(self):
        """Valid events are parsed and returned with version."""
        from models.events import EventType, GrunnlagData, GrunnlagEvent

        event = GrunnlagEvent(
            event_type=EventType.GRUNNLAG_OPPRETTET,
            sak_id="TEST-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="ENDRING",
                underkategori="EO",
                beskrivelse="Test desc",
                dato_oppdaget="2025-01-15",
            ),
        )
        stored = event.model_dump(mode="json")

        mock_repo = MagicMock()
        mock_repo.get_events.return_value = ([stored], 1)

        from flask import Flask

        app = Flask(__name__)
        with app.app_context():
            with patch(
                "routes.event_routes._get_event_repo", return_value=mock_repo
            ):
                result = _fetch_and_parse_events("TEST-001")

        events, version = result
        assert isinstance(events, list)
        assert len(events) == 1
        assert version == 1

    def test_returns_500_when_all_events_fail_to_parse(self):
        """All events failing to parse returns 500."""
        mock_repo = MagicMock()
        mock_repo.get_events.return_value = ([{"bad": "data"}], 1)

        from flask import Flask

        app = Flask(__name__)
        with app.app_context():
            with patch(
                "routes.event_routes._get_event_repo", return_value=mock_repo
            ):
                result = _fetch_and_parse_events("TEST-001")

        assert result[1] == 500


class TestContextEndpointShape:
    """Test that context endpoint returns the expected combined shape."""

    def test_context_response_has_all_keys(self):
        """Context response contains state, timeline, and historikk."""
        from models.events import EventType, GrunnlagData, GrunnlagEvent

        event = GrunnlagEvent(
            event_type=EventType.GRUNNLAG_OPPRETTET,
            sak_id="TEST-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="ENDRING",
                underkategori="EO",
                beskrivelse="Test desc",
                dato_oppdaget="2025-01-15",
            ),
        )
        stored = event.model_dump(mode="json")

        mock_repo = MagicMock()
        mock_repo.get_events.return_value = ([stored], 1)

        mock_membership = MagicMock()
        mock_membership.get_role.return_value = "member"

        mock_container = MagicMock()
        mock_container.event_repository = mock_repo
        mock_container.membership_repository = mock_membership

        # Use real TimelineService for accurate state computation
        from services.timeline_service import TimelineService

        mock_container.timeline_service = TimelineService()

        from flask import Flask

        from lib.project_context import init_project_context
        from routes.event_routes import events_bp

        app = Flask(__name__)
        app.config["TESTING"] = True
        init_project_context(app)
        app.register_blueprint(events_bp)

        with patch(
            "routes.event_routes._get_container", return_value=mock_container
        ), patch(
            "lib.auth.project_access.get_container",
            return_value=mock_container,
        ):
            import os

            os.environ["DISABLE_AUTH"] = "true"
            client = app.test_client()
            resp = client.get(
                "/api/cases/TEST-001/context",
                headers={"X-Project-ID": "oslobygg"},
            )
            del os.environ["DISABLE_AUTH"]

        assert resp.status_code == 200
        data = resp.get_json()

        # All three views should be present
        assert "version" in data
        assert "state" in data
        assert "timeline" in data
        assert "historikk" in data

        # Historikk should have all three tracks
        assert "grunnlag" in data["historikk"]
        assert "vederlag" in data["historikk"]
        assert "frist" in data["historikk"]

        # State should contain sak_id
        assert data["state"]["sak_id"] == "TEST-001"

        # Timeline should be a list
        assert isinstance(data["timeline"], list)
        assert len(data["timeline"]) == 1

    def test_context_fetches_events_only_once(self):
        """Context endpoint fetches events from repo exactly once."""
        from models.events import EventType, GrunnlagData, GrunnlagEvent

        event = GrunnlagEvent(
            event_type=EventType.GRUNNLAG_OPPRETTET,
            sak_id="TEST-001",
            aktor="Test User",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test",
                hovedkategori="ENDRING",
                underkategori="EO",
                beskrivelse="Test desc",
                dato_oppdaget="2025-01-15",
            ),
        )
        stored = event.model_dump(mode="json")

        mock_repo = MagicMock()
        mock_repo.get_events.return_value = ([stored], 1)

        mock_membership = MagicMock()
        mock_membership.get_role.return_value = "member"

        mock_container = MagicMock()
        mock_container.event_repository = mock_repo
        mock_container.membership_repository = mock_membership

        from services.timeline_service import TimelineService

        mock_container.timeline_service = TimelineService()

        from flask import Flask

        from lib.project_context import init_project_context
        from routes.event_routes import events_bp

        app = Flask(__name__)
        app.config["TESTING"] = True
        init_project_context(app)
        app.register_blueprint(events_bp)

        with patch(
            "routes.event_routes._get_container", return_value=mock_container
        ), patch(
            "lib.auth.project_access.get_container",
            return_value=mock_container,
        ):
            import os

            os.environ["DISABLE_AUTH"] = "true"
            client = app.test_client()
            resp = client.get(
                "/api/cases/TEST-001/context",
                headers={"X-Project-ID": "oslobygg"},
            )
            del os.environ["DISABLE_AUTH"]

        assert resp.status_code == 200

        # The key assertion: get_events should be called exactly once
        assert mock_repo.get_events.call_count == 1
