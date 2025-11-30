"""
Tests for magic link security.

Verifies that:
1. Magic links are generated securely
2. Magic links can be verified
3. Expired links are rejected
4. Tampered links are rejected
"""
import pytest
import json
from unittest.mock import patch, MagicMock


class TestMagicLinkGeneration:
    """Test magic link generation"""

    def test_generate_magic_link(self):
        """Test magic link generation"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()
        token = mgr.generate(sak_id='TEST-123', email='test@example.com')

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 20

    def test_generated_links_are_unique(self):
        """Test that each generated link is unique"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()
        token1 = mgr.generate(sak_id='TEST-123', email='test@example.com')
        token2 = mgr.generate(sak_id='TEST-123', email='test@example.com')

        # Even same sak_id and email should produce different tokens (timestamp)
        assert token1 != token2


class TestMagicLinkVerification:
    """Test magic link verification"""

    def test_verify_valid_token(self):
        """Test verification of a valid token"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()
        sak_id = 'TEST-VERIFY-123'
        email = 'test@example.com'

        token = mgr.generate(sak_id=sak_id, email=email)
        is_valid, error, payload = mgr.verify(token)

        assert is_valid
        assert error is None or error == ''  # Allow empty string or None
        assert payload['sak_id'] == sak_id
        assert payload['email'] == email

    def test_verify_invalid_token_format(self):
        """Test rejection of invalid token format"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()

        # Completely invalid token
        is_valid, error, payload = mgr.verify('not-a-valid-token')
        assert not is_valid
        assert error is not None
        assert payload is None or payload == {}

    def test_verify_tampered_token(self):
        """Test rejection of tampered token"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()
        token = mgr.generate(sak_id='TEST-123', email='test@example.com')

        # Tamper with the token
        tampered_token = token[:-5] + 'xxxxx'

        is_valid, error, payload = mgr.verify(tampered_token)
        assert not is_valid

    def test_verify_missing_token(self):
        """Test handling of missing token"""
        from lib.auth.magic_link import MagicLinkManager

        mgr = MagicLinkManager()

        is_valid, error, payload = mgr.verify('')
        assert not is_valid

        is_valid, error, payload = mgr.verify(None)
        assert not is_valid


class TestMagicLinkEndpoint:
    """Test magic link verification endpoint"""

    def test_verify_magic_link_endpoint_success(self, client, monkeypatch):
        """Test successful magic link verification via API"""
        # Mock the magic_link_mgr instance in utility_routes
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (True, None, {'sak_id': 'TEST-123'})

        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify?token=test-token-123')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'sakId' in data

    def test_verify_magic_link_endpoint_missing_token(self, client, monkeypatch):
        """Test magic link verification with missing token"""
        # Mock the magic_link_mgr to simulate empty token verification
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (False, 'No token provided', None)

        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify')

        # Returns 403 for invalid/missing token (authentication required)
        assert response.status_code == 403
        data = response.get_json()
        assert 'error' in data

    def test_verify_magic_link_endpoint_invalid_token(self, client, monkeypatch):
        """Test magic link verification with invalid token"""
        # Mock the magic_link_mgr to return invalid
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (False, 'Token expired', None)

        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify?token=expired-token')

        # Returns 403 for invalid token (authentication required)
        assert response.status_code == 403
        data = response.get_json()
        assert 'error' in data
        assert 'Invalid or expired link' in data['error']
