"""
Integration tests for utility routes

Tests:
- GET /api/csrf-token
- GET /api/magic-link/verify
- GET /api/health
- POST /api/validate-user
"""
import pytest
import json


class TestUtilityRoutes:
    """Test utility endpoints"""

    def test_get_csrf_token_success(self, client):
        """Test CSRF token generation"""
        response = client.get('/api/csrf-token')

        assert response.status_code == 200
        data = response.get_json()
        assert 'csrfToken' in data
        assert 'expiresIn' in data
        assert data['expiresIn'] == 3600
        assert len(data['csrfToken']) > 0

    def test_health_check(self, client):
        """Test health check endpoint"""
        response = client.get('/api/health')

        assert response.status_code == 200
        data = response.get_json()
        assert data['status'] == 'healthy'
        assert data['service'] == 'koe-backend'

    def test_verify_magic_link_success(self, client, monkeypatch):
        """Test magic link verification with valid token"""
        # Mock MagicLinkManager
        from unittest.mock import MagicMock
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (True, None, {'sak_id': 'TEST-123'})

        # Patch the magic_link_mgr in utility_routes
        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify?token=valid-token-123')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['sakId'] == 'TEST-123'

    def test_verify_magic_link_invalid_token(self, client, monkeypatch):
        """Test magic link verification with invalid token"""
        # Mock MagicLinkManager
        from unittest.mock import MagicMock
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (False, 'Token expired', None)

        # Patch the magic_link_mgr in utility_routes
        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify?token=invalid-token')

        assert response.status_code == 403
        data = response.get_json()
        assert 'error' in data
        assert data['error'] == 'Invalid or expired link'

    def test_verify_magic_link_missing_token(self, client, monkeypatch):
        """Test magic link verification without token"""
        # Mock MagicLinkManager
        from unittest.mock import MagicMock
        mock_mgr = MagicMock()
        mock_mgr.verify.return_value = (False, 'No token provided', None)

        # Patch the magic_link_mgr in utility_routes
        import routes.utility_routes as utility_routes
        monkeypatch.setattr(utility_routes, 'magic_link_mgr', mock_mgr)

        response = client.get('/api/magic-link/verify')

        assert response.status_code == 403

    def test_validate_user_success(self, client, mock_system, test_sak_with_data):
        """Test user validation with valid email"""
        response = client.post(
            '/api/validate-user',
            data=json.dumps({
                'email': 'test@example.com',
                'sakId': test_sak_with_data['sak_id']
            }),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['name'] == 'Test User'
        assert data['email'] == 'test@example.com'
        assert data['company'] == 'Test Company'

    def test_validate_user_missing_email(self, client, mock_system):
        """Test user validation without email"""
        response = client.post(
            '/api/validate-user',
            data=json.dumps({
                'sakId': 'TEST-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'email' in data['error'].lower()

    def test_validate_user_missing_sak_id(self, client, mock_system):
        """Test user validation without sakId"""
        response = client.post(
            '/api/validate-user',
            data=json.dumps({
                'email': 'test@example.com'
            }),
            content_type='application/json'
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data
        assert 'sakid' in data['error'].lower()

    def test_validate_user_case_not_found(self, client, mock_system):
        """Test user validation with non-existent case"""
        response = client.post(
            '/api/validate-user',
            data=json.dumps({
                'email': 'test@example.com',
                'sakId': 'NON-EXISTENT'
            }),
            content_type='application/json'
        )

        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data

    def test_validate_user_not_in_project(self, client, mock_system, test_sak_with_data):
        """Test user validation when user is not in Catenda project"""
        # Mock catenda to return None for user not found
        mock_system.catenda.find_user_in_project.return_value = None

        response = client.post(
            '/api/validate-user',
            data=json.dumps({
                'email': 'notfound@example.com',
                'sakId': test_sak_with_data['sak_id']
            }),
            content_type='application/json'
        )

        assert response.status_code == 404
        data = response.get_json()
        assert data['success'] is False
        assert 'medlem' in data['error'].lower()
