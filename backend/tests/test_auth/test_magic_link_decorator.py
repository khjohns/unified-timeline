"""
Tests for the require_magic_link decorator.
"""
import pytest
from flask import Flask, jsonify
from lib.auth import require_magic_link, get_magic_link_manager


class TestMagicLinkDecorator:
    """Test the require_magic_link decorator."""

    @pytest.fixture
    def app(self):
        """Create a test Flask app."""
        app = Flask(__name__)
        app.config['TESTING'] = True

        @app.route('/protected')
        @require_magic_link
        def protected_route():
            """A protected route that requires magic link."""
            from flask import request
            return jsonify({
                "success": True,
                "sak_id": request.magic_link_data.get("sak_id")
            })

        return app

    @pytest.fixture
    def client(self, app):
        """Create a test client."""
        return app.test_client()

    @pytest.fixture
    def valid_token(self):
        """Generate a valid magic link token."""
        manager = get_magic_link_manager()
        return manager.generate(sak_id="TEST-001", email="test@example.com", ttl_hours=1)

    def test_require_magic_link_missing_token(self, client):
        """Test that decorator blocks requests without token."""
        response = client.get('/protected')
        assert response.status_code == 401
        data = response.get_json()
        assert data["success"] is False
        assert data["error"] == "UNAUTHORIZED"
        assert "Mangler magic link token" in data["message"]

    def test_require_magic_link_with_valid_token(self, client, valid_token):
        """Test that decorator accepts valid tokens."""
        response = client.get(
            '/protected',
            headers={'Authorization': f'Bearer {valid_token}'}
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["success"] is True
        assert data["sak_id"] == "TEST-001"

    def test_require_magic_link_with_invalid_token(self, client):
        """Test that decorator rejects invalid tokens."""
        response = client.get(
            '/protected',
            headers={'Authorization': 'Bearer invalid-token-12345'}
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["success"] is False
        assert data["error"] == "UNAUTHORIZED"
        assert "Ugyldig token" in data["message"]

    def test_require_magic_link_with_expired_token(self, client):
        """Test that decorator rejects expired tokens."""
        # Create a token with very short TTL
        manager = get_magic_link_manager()
        token = manager.generate(sak_id="TEST-002", email="test@example.com", ttl_hours=-1)

        response = client.get(
            '/protected',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert response.status_code == 401
        data = response.get_json()
        assert data["success"] is False
        assert "expired" in data["message"].lower()

    def test_require_magic_link_with_session_based_token(self, client, valid_token):
        """Test that decorator allows session-based token reuse (multiple requests)."""
        # Use the token once
        response1 = client.get(
            '/protected',
            headers={'Authorization': f'Bearer {valid_token}'}
        )
        assert response1.status_code == 200

        # Try to use it again - should succeed (session-based mode)
        response2 = client.get(
            '/protected',
            headers={'Authorization': f'Bearer {valid_token}'}
        )
        assert response2.status_code == 200

        # Third time - should still succeed
        response3 = client.get(
            '/protected',
            headers={'Authorization': f'Bearer {valid_token}'}
        )
        assert response3.status_code == 200

    def test_require_magic_link_without_bearer_prefix(self, client, valid_token):
        """Test that decorator can handle tokens without Bearer prefix."""
        response = client.get(
            '/protected',
            headers={'Authorization': valid_token}
        )
        # Should work as we strip 'Bearer ' and any remaining whitespace
        assert response.status_code == 200

    def test_require_magic_link_with_empty_authorization(self, client):
        """Test that decorator handles empty Authorization header."""
        response = client.get(
            '/protected',
            headers={'Authorization': ''}
        )
        assert response.status_code == 401

    def test_require_magic_link_with_bearer_only(self, client):
        """Test that decorator handles 'Bearer' without token."""
        response = client.get(
            '/protected',
            headers={'Authorization': 'Bearer '}
        )
        assert response.status_code == 401
        data = response.get_json()
        assert "Mangler magic link token" in data["message"]
