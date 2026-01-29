"""
Tests for webhook security.

Verifies that:
1. Webhook endpoint validates secret path
2. Invalid paths return 404
3. Idempotency check works
4. Event structure validation works
"""
import json
import os
from unittest.mock import patch


class TestWebhookSecurity:
    """Test webhook security features"""

    def test_webhook_with_invalid_path_returns_404(self, client):
        """Test that webhook with wrong path returns 404"""
        response = client.post(
            '/webhook/catenda/wrong-secret-path',
            data=json.dumps({
                'event': {'id': 'evt-123', 'type': 'issue.created'},
                'issue': {}
            }),
            content_type='application/json'
        )

        # Should return 404 for invalid path
        assert response.status_code == 404

    def test_webhook_without_secret_configured_returns_404(self, client):
        """Test that webhook returns 404 when secret is not configured"""
        # Clear the environment variable
        with patch.dict(os.environ, {'WEBHOOK_SECRET_PATH': ''}, clear=False):
            response = client.post(
                '/webhook/catenda/any-path',
                data=json.dumps({
                    'event': {'id': 'evt-123', 'type': 'issue.created'},
                    'issue': {}
                }),
                content_type='application/json'
            )

            assert response.status_code == 404

    @patch.dict(os.environ, {'WEBHOOK_SECRET_PATH': 'test-secret-path'})
    def test_webhook_with_valid_path_succeeds(self, client, mock_system):
        """Test that webhook with correct path is accepted"""
        response = client.post(
            '/webhook/catenda/test-secret-path',
            data=json.dumps({
                'event': {'id': 'evt-123', 'type': 'issue.created'},
                'issue': {'id': 'topic-123', 'guid': 'topic-123'}
            }),
            content_type='application/json'
        )

        # Should succeed (or return 200 with result)
        assert response.status_code == 200

    def test_webhook_validates_event_structure(self):
        """Test event structure validation"""
        from lib.security.webhook_security import validate_webhook_event_structure

        # Valid structure
        valid_payload = {
            'event': {'id': 'evt-123', 'type': 'issue.created'},
            'issue': {}
        }
        is_valid, error = validate_webhook_event_structure(valid_payload)
        assert is_valid
        assert error is None or error == ""

        # Missing event
        invalid_payload = {'issue': {}}
        is_valid, error = validate_webhook_event_structure(invalid_payload)
        assert not is_valid
        assert 'event' in error.lower()

        # Missing event.id
        invalid_payload = {'event': {'type': 'issue.created'}, 'issue': {}}
        is_valid, error = validate_webhook_event_structure(invalid_payload)
        assert not is_valid

        # Missing event.type
        invalid_payload = {'event': {'id': 'evt-123'}, 'issue': {}}
        is_valid, error = validate_webhook_event_structure(invalid_payload)
        assert not is_valid

    def test_webhook_idempotency_check(self):
        """Test that duplicate events are detected"""
        from lib.security.webhook_security import is_duplicate_event, clear_processed_events

        # Clear processed events for clean test
        clear_processed_events()

        event_id = 'test-event-idempotency-123'

        # First call should not be duplicate
        assert not is_duplicate_event(event_id)

        # Second call should be duplicate
        assert is_duplicate_event(event_id)

        # Different event ID should not be duplicate
        assert not is_duplicate_event('different-event-456')

    def test_get_webhook_event_id(self):
        """Test event ID extraction from payload"""
        from lib.security.webhook_security import get_webhook_event_id

        # Standard payload
        payload = {'event': {'id': 'evt-abc-123', 'type': 'issue.created'}}
        event_id = get_webhook_event_id(payload)
        assert event_id == 'evt-abc-123'

        # Missing event object
        payload = {}
        event_id = get_webhook_event_id(payload)
        assert event_id == ""

        # Missing id in event
        payload = {'event': {'type': 'issue.created'}}
        event_id = get_webhook_event_id(payload)
        assert event_id == ""


class TestWebhookEventTypes:
    """Test handling of different webhook event types"""

    def test_validate_known_event_types(self):
        """Test that known event types are accepted"""
        from lib.security.webhook_security import validate_webhook_event_structure

        # These are the event types actually supported by the webhook security module
        known_types = [
            'issue.created',
            'issue.modified',
            'issue.status.changed',
            'issue.deleted'
        ]

        for event_type in known_types:
            payload = {
                'event': {'id': 'evt-123', 'type': event_type},
                'issue': {}
            }
            is_valid, _ = validate_webhook_event_structure(payload)
            assert is_valid, f"Event type {event_type} should be valid"

    def test_validate_unknown_event_type(self):
        """Test that unknown event types are rejected"""
        from lib.security.webhook_security import validate_webhook_event_structure

        payload = {
            'event': {'id': 'evt-123', 'type': 'unknown.event.type'},
            'issue': {}
        }
        is_valid, error = validate_webhook_event_structure(payload)
        assert not is_valid
        assert 'unknown' in error.lower()
