"""
Tester for lib/helpers/ hjelpefunksjoner.

Disse testene verifiserer at de felles hjelpefunksjonene for
versjonskontroll og respons-bygging fungerer korrekt.
"""

import pytest
from flask import Flask
from unittest.mock import MagicMock

from lib.helpers.version_control import (
    handle_concurrency_error,
    not_found_response,
    version_conflict_response,
)
from lib.helpers.responses import (
    error_response,
    success_response,
)
from repositories.event_repository import ConcurrencyError


@pytest.fixture
def app():
    """Opprett Flask-app for testing."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    return app


class TestHandleConcurrencyError:
    """Tester for handle_concurrency_error()."""

    def test_returns_409_status(self, app):
        """Skal returnere HTTP 409."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, status = handle_concurrency_error(error)
            assert status == 409

    def test_returns_version_conflict_error(self, app):
        """Skal returnere VERSION_CONFLICT error code."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, status = handle_concurrency_error(error)
            data = response.get_json()
            assert data['error'] == 'VERSION_CONFLICT'

    def test_includes_expected_version(self, app):
        """Skal inkludere expected_version i respons."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, _ = handle_concurrency_error(error)
            data = response.get_json()
            assert data['expected_version'] == 5

    def test_includes_current_version(self, app):
        """Skal inkludere current_version i respons."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, _ = handle_concurrency_error(error)
            data = response.get_json()
            assert data['current_version'] == 7

    def test_includes_user_friendly_message(self, app):
        """Skal inkludere brukervennlig melding."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, _ = handle_concurrency_error(error)
            data = response.get_json()
            assert 'Samtidig endring oppdaget' in data['message']

    def test_success_is_false(self, app):
        """Skal ha success=False."""
        with app.app_context():
            error = ConcurrencyError(expected=5, actual=7)
            response, _ = handle_concurrency_error(error)
            data = response.get_json()
            assert data['success'] is False


class TestNotFoundResponse:
    """Tester for not_found_response()."""

    def test_returns_404_status(self, app):
        """Skal returnere HTTP 404."""
        with app.app_context():
            response, status = not_found_response("Søknad", "SAK-123")
            assert status == 404

    def test_returns_not_found_error(self, app):
        """Skal returnere NOT_FOUND error code."""
        with app.app_context():
            response, _ = not_found_response("Søknad", "SAK-123")
            data = response.get_json()
            assert data['error'] == 'NOT_FOUND'

    def test_includes_resource_in_message(self, app):
        """Skal inkludere ressurstype og ID i melding."""
        with app.app_context():
            response, _ = not_found_response("Søknad", "SAK-123")
            data = response.get_json()
            assert "Søknad" in data['message']
            assert "SAK-123" in data['message']

    def test_success_is_false(self, app):
        """Skal ha success=False."""
        with app.app_context():
            response, _ = not_found_response("Sak", "123")
            data = response.get_json()
            assert data['success'] is False


class TestVersionConflictResponse:
    """Tester for version_conflict_response()."""

    def test_returns_409_status(self, app):
        """Skal returnere HTTP 409."""
        with app.app_context():
            response, status = version_conflict_response(5, 7)
            assert status == 409

    def test_returns_version_conflict_error(self, app):
        """Skal returnere VERSION_CONFLICT error code."""
        with app.app_context():
            response, _ = version_conflict_response(5, 7)
            data = response.get_json()
            assert data['error'] == 'VERSION_CONFLICT'

    def test_includes_both_versions(self, app):
        """Skal inkludere både expected og current versjon."""
        with app.app_context():
            response, _ = version_conflict_response(5, 7)
            data = response.get_json()
            assert data['expected_version'] == 5
            assert data['current_version'] == 7

    def test_includes_reload_message(self, app):
        """Skal inkludere melding om å laste inn på nytt."""
        with app.app_context():
            response, _ = version_conflict_response(5, 7)
            data = response.get_json()
            assert 'last inn' in data['message'].lower()


class TestErrorResponse:
    """Tester for error_response()."""

    def test_returns_default_400_status(self, app):
        """Skal returnere HTTP 400 som default."""
        with app.app_context():
            response, status = error_response("TEST_ERROR", "Test message")
            assert status == 400

    def test_returns_custom_status(self, app):
        """Skal kunne bruke custom status code."""
        with app.app_context():
            response, status = error_response("SERVER_ERROR", "Error", 500)
            assert status == 500

    def test_includes_error_code(self, app):
        """Skal inkludere error code."""
        with app.app_context():
            response, _ = error_response("VALIDATION_ERROR", "Invalid data")
            data = response.get_json()
            assert data['error'] == 'VALIDATION_ERROR'

    def test_includes_message(self, app):
        """Skal inkludere melding."""
        with app.app_context():
            response, _ = error_response("ERROR", "Custom message")
            data = response.get_json()
            assert data['message'] == "Custom message"

    def test_includes_extra_fields(self, app):
        """Skal kunne inkludere ekstra felt."""
        with app.app_context():
            response, _ = error_response(
                "VALIDATION_ERROR",
                "Missing fields",
                missing_fields=["tittel", "beskrivelse"]
            )
            data = response.get_json()
            assert data['missing_fields'] == ["tittel", "beskrivelse"]

    def test_success_is_false(self, app):
        """Skal ha success=False."""
        with app.app_context():
            response, _ = error_response("ERROR", "msg")
            data = response.get_json()
            assert data['success'] is False


class TestSuccessResponse:
    """Tester for success_response()."""

    def test_returns_default_200_status(self, app):
        """Skal returnere HTTP 200 som default."""
        with app.app_context():
            response, status = success_response()
            assert status == 200

    def test_returns_custom_status(self, app):
        """Skal kunne bruke custom status code."""
        with app.app_context():
            response, status = success_response(201)
            assert status == 201

    def test_includes_message_when_provided(self, app):
        """Skal inkludere melding når oppgitt."""
        with app.app_context():
            response, _ = success_response(message="Operasjon vellykket")
            data = response.get_json()
            assert data['message'] == "Operasjon vellykket"

    def test_excludes_message_when_not_provided(self, app):
        """Skal ikke inkludere melding når ikke oppgitt."""
        with app.app_context():
            response, _ = success_response()
            data = response.get_json()
            assert 'message' not in data

    def test_includes_data_fields(self, app):
        """Skal kunne inkludere data-felt."""
        with app.app_context():
            response, _ = success_response(
                201,
                sak_id="SAK-123",
                version=5
            )
            data = response.get_json()
            assert data['sak_id'] == "SAK-123"
            assert data['version'] == 5

    def test_success_is_true(self, app):
        """Skal ha success=True."""
        with app.app_context():
            response, _ = success_response()
            data = response.get_json()
            assert data['success'] is True
