"""
Tests for Event Submission API Routes.

These tests verify the complete event submission flow including:
- Optimistic concurrency control
- Business rule validation
- State computation
- Cache updates
"""
import pytest
import tempfile
import json
from flask import Flask
from routes.event_routes import events_bp
from repositories.event_repository import JsonFileEventRepository
from repositories.sak_metadata_repository import SakMetadataRepository
from models.events import EventType


@pytest.fixture
def app():
    """Create Flask app for testing."""
    app = Flask(__name__)
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False  # Disable CSRF for tests
    app.register_blueprint(events_bp)
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return app.test_client()


@pytest.fixture
def temp_dir():
    """Create temporary directory for test data."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture(autouse=True)
def mock_auth(monkeypatch):
    """Mock authentication to bypass checks in tests."""
    # Create a mock manager that always returns True for verify
    class MockMagicLinkManager:
        def verify(self, token):
            return True, "Test token", {"email": "test@example.com", "rolle": "TE"}

    # Patch at the module level where it's used
    import routes.event_routes
    original_manager = routes.event_routes.get_magic_link_manager if hasattr(routes.event_routes, 'get_magic_link_manager') else None

    def mock_get_manager():
        return MockMagicLinkManager()

    # Try to patch the import in the routes module
    try:
        from lib.auth.magic_link import get_magic_link_manager
        monkeypatch.setattr('lib.auth.magic_link.get_magic_link_manager', mock_get_manager)
    except:
        pass  # If import fails, tests will fail anyway


def get_auth_headers():
    """Helper to get authentication headers for requests."""
    return {'Authorization': 'Bearer test-token'}


class TestSubmitEvent:
    """Test POST /api/events endpoint."""

    def test_submit_sak_opprettet_success(self, client, temp_dir, mock_auth, monkeypatch):
        """Test submitting SAK_OPPRETTET event."""
        # Mock repositories to use temp directory
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        event_data = {
            "event_type": "sak_opprettet",
            "sak_id": "TEST-001",
            "expected_version": 0,
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "sakstittel": "Test Case"
        }

        response = client.post(
            '/api/events',
            data=json.dumps(event_data),
            content_type='application/json'
        )

        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert 'event_id' in data
        assert data['new_version'] == 1
        assert 'state' in data
        assert data['state']['sak_id'] == "TEST-001"

    def test_submit_event_missing_expected_version(self, client, mock_auth):
        """Test that missing expected_version returns error."""
        event_data = {
            "event_type": "sak_opprettet",
            "sak_id": "TEST-002",
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "sakstittel": "Test"
        }

        response = client.post(
            '/api/events',
            data=json.dumps(event_data),
            content_type='application/json'
        )

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['error'] == "MISSING_VERSION"

    def test_submit_event_version_conflict(self, client, temp_dir, mock_auth, monkeypatch):
        """Test version conflict detection."""
        from routes import event_routes
        event_repo = JsonFileEventRepository(base_path=temp_dir)
        monkeypatch.setattr(event_routes, 'event_repo', event_repo)
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        # Create initial event
        initial_event = {
            "event_type": "sak_opprettet",
            "sak_id": "TEST-003",
            "expected_version": 0,
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "sakstittel": "Test"
        }
        client.post('/api/events', data=json.dumps(initial_event),
                   content_type='application/json')

        # Try to submit with wrong version
        conflicting_event = {
            "event_type": "grunnlag_opprettet",
            "sak_id": "TEST-003",
            "expected_version": 0,  # Should be 1!
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "data": {
                "hovedkategori": "Test",
                "underkategori": "Test",
                "beskrivelse": "Test",
                "dato_oppdaget": "2025-01-01"
            }
        }

        response = client.post('/api/events', data=json.dumps(conflicting_event),
                             content_type='application/json')

        assert response.status_code == 409
        data = response.get_json()
        assert data['success'] is False
        assert data['error'] == "VERSION_CONFLICT"
        assert data['expected_version'] == 0
        assert data['current_version'] == 1

    def test_submit_event_business_rule_violation(self, client, temp_dir, mock_auth, monkeypatch):
        """Test that business rules are enforced."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        # Create initial case
        initial_event = {
            "event_type": "sak_opprettet",
            "sak_id": "TEST-004",
            "expected_version": 0,
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "sakstittel": "Test"
        }
        client.post('/api/events', data=json.dumps(initial_event),
                   content_type='application/json')

        # Try to send vederlag without grunnlag (should fail)
        vederlag_event = {
            "event_type": "vederlag_krav_sendt",
            "sak_id": "TEST-004",
            "expected_version": 1,
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "versjon": 1,
            "data": {
                "krav_belop": 100000.0,
                "metode": "TEST",
                "begrunnelse": "Test"
            }
        }

        response = client.post('/api/events', data=json.dumps(vederlag_event),
                             content_type='application/json')

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['error'] == "BUSINESS_RULE_VIOLATION"
        assert data['rule'] == "GRUNNLAG_REQUIRED"


class TestSubmitBatch:
    """Test POST /api/events/batch endpoint."""

    def test_submit_batch_success(self, client, temp_dir, mock_auth, monkeypatch):
        """Test atomic batch submission."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        batch_data = {
            "sak_id": "TEST-005",
            "expected_version": 0,
            "events": [
                {
                    "event_type": "sak_opprettet",
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "sakstittel": "Batch Test"
                },
                {
                    "event_type": "grunnlag_opprettet",
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "data": {
                        "hovedkategori": "Test",
                        "underkategori": "Test",
                        "beskrivelse": "Test",
                        "dato_oppdaget": "2025-01-01"
                    }
                }
            ]
        }

        response = client.post('/api/events/batch', data=json.dumps(batch_data),
                             content_type='application/json')

        assert response.status_code == 201
        data = response.get_json()
        assert data['success'] is True
        assert len(data['event_ids']) == 2
        assert data['new_version'] == 2

    def test_submit_batch_missing_fields(self, client, mock_auth):
        """Test that missing required fields returns error."""
        batch_data = {
            "sak_id": "TEST-006",
            # Missing expected_version!
            "events": []
        }

        response = client.post('/api/events/batch', data=json.dumps(batch_data),
                             content_type='application/json')

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['error'] == "INVALID_REQUEST"

    def test_submit_batch_validation_failure_rollback(self, client, temp_dir, mock_auth, monkeypatch):
        """Test that failed validation prevents ALL events from being persisted."""
        from routes import event_routes
        event_repo = JsonFileEventRepository(base_path=temp_dir)
        monkeypatch.setattr(event_routes, 'event_repo', event_repo)
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        # Batch with rule violation (vederlag before grunnlag)
        batch_data = {
            "sak_id": "TEST-007",
            "expected_version": 0,
            "events": [
                {
                    "event_type": "sak_opprettet",
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "sakstittel": "Rollback Test"
                },
                {
                    "event_type": "vederlag_krav_sendt",  # Invalid! No grunnlag
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "versjon": 1,
                    "data": {
                        "krav_belop": 100000.0,
                        "metode": "TEST",
                        "begrunnelse": "Test"
                    }
                }
            ]
        }

        response = client.post('/api/events/batch', data=json.dumps(batch_data),
                             content_type='application/json')

        assert response.status_code == 400
        data = response.get_json()
        assert data['success'] is False
        assert data['error'] == "BUSINESS_RULE_VIOLATION"

        # Verify NO events were persisted
        events, version = event_repo.get_events("TEST-007")
        assert len(events) == 0
        assert version == 0


class TestGetCaseState:
    """Test GET /api/case/<sak_id>/state endpoint."""

    def test_get_case_state_success(self, client, temp_dir, mock_auth, monkeypatch):
        """Test retrieving case state."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        # Create case
        event_data = {
            "event_type": "sak_opprettet",
            "sak_id": "TEST-008",
            "expected_version": 0,
            "aktor": "test@example.com",
            "aktor_rolle": "TE",
            "sakstittel": "State Test"
        }
        client.post('/api/events', data=json.dumps(event_data),
                   content_type='application/json')

        # Get state
        response = client.get('/api/case/TEST-008/state')

        assert response.status_code == 200
        data = response.get_json()
        assert data['version'] == 1
        assert 'state' in data
        assert data['state']['sak_id'] == "TEST-008"

    def test_get_case_state_not_found(self, client, temp_dir, mock_auth, monkeypatch):
        """Test retrieving non-existent case."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))

        response = client.get('/api/case/NONEXISTENT/state')

        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data


class TestGetCaseTimeline:
    """Test GET /api/case/<sak_id>/timeline endpoint."""

    def test_get_case_timeline_success(self, client, temp_dir, mock_auth, monkeypatch):
        """Test retrieving case timeline."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))
        monkeypatch.setattr(event_routes, 'metadata_repo',
                          SakMetadataRepository(csv_path=f"{temp_dir}/metadata.csv"))

        # Create case with multiple events
        batch_data = {
            "sak_id": "TEST-009",
            "expected_version": 0,
            "events": [
                {
                    "event_type": "sak_opprettet",
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "sakstittel": "Timeline Test"
                },
                {
                    "event_type": "grunnlag_opprettet",
                    "aktor": "test@example.com",
                    "aktor_rolle": "TE",
                    "data": {
                        "hovedkategori": "Test",
                        "underkategori": "Test",
                        "beskrivelse": "Test",
                        "dato_oppdaget": "2025-01-01"
                    }
                }
            ]
        }
        client.post('/api/events/batch', data=json.dumps(batch_data),
                   content_type='application/json')

        # Get timeline
        response = client.get('/api/case/TEST-009/timeline')

        assert response.status_code == 200
        data = response.get_json()
        assert data['version'] == 2
        assert 'events' in data
        assert len(data['events']) >= 2

    def test_get_case_timeline_not_found(self, client, temp_dir, mock_auth, monkeypatch):
        """Test retrieving timeline for non-existent case."""
        from routes import event_routes
        monkeypatch.setattr(event_routes, 'event_repo',
                          JsonFileEventRepository(base_path=temp_dir))

        response = client.get('/api/case/NONEXISTENT/timeline')

        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data
