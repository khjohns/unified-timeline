"""
Integration tests for case routes

Tests:
- GET /api/cases/<sakId>
- PUT /api/cases/<sakId>/draft
"""
import pytest
import json


class TestCaseRoutes:
    """Test case management endpoints"""

    def test_get_case_success(self, client, mock_system, test_sak_with_data):
        """Test getting case data"""
        sak_id = test_sak_with_data['sak_id']

        response = client.get(f'/api/cases/{sak_id}')

        assert response.status_code == 200
        data = response.get_json()
        assert data['sakId'] == sak_id
        assert 'topicGuid' in data
        assert 'formData' in data
        assert 'status' in data

    def test_get_case_not_found(self, client, mock_system):
        """Test getting non-existent case"""
        response = client.get('/api/cases/NON-EXISTENT-ID')

        assert response.status_code == 404
        data = response.get_json()
        assert 'error' in data
        assert 'ikke funnet' in data['error'].lower()

    def test_get_case_returns_topic_guid(self, client, mock_system, test_sak_with_data):
        """Test that case response includes Catenda topic GUID"""
        sak_id = test_sak_with_data['sak_id']

        response = client.get(f'/api/cases/{sak_id}')

        assert response.status_code == 200
        data = response.get_json()
        assert data['topicGuid'] == 'topic-abc-123'

    def test_get_case_returns_form_data(self, client, mock_system, test_sak_with_data):
        """Test that case response includes complete form data"""
        sak_id = test_sak_with_data['sak_id']

        response = client.get(f'/api/cases/{sak_id}')

        assert response.status_code == 200
        data = response.get_json()
        assert 'formData' in data
        form_data = data['formData']
        assert 'versjon' in form_data
        assert 'sak' in form_data
        assert 'varsel' in form_data
        assert 'koe_revisjoner' in form_data

    def test_save_draft_success(self, client, mock_system, test_sak_with_data):
        """Test saving draft case data"""
        sak_id = test_sak_with_data['sak_id']

        updated_data = test_sak_with_data['data'].copy()
        updated_data['varsel'] = {
            'dato_forhold_oppdaget': '2025-11-25',
            'hovedkategori': 'Risiko',
            'varsel_beskrivelse': 'Draft varsel'
        }

        response = client.put(
            f'/api/cases/{sak_id}/draft',
            data=json.dumps({'formData': updated_data}),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'message' in data

        # Verify data was saved
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data['varsel']['varsel_beskrivelse'] == 'Draft varsel'

    def test_save_draft_creates_new_case_if_not_exists(self, client, mock_system):
        """Test that saving draft creates case data if it doesn't exist"""
        sak_id = 'NEW-DRAFT-CASE'

        draft_data = {
            'versjon': '5.0',
            'rolle': 'TE',
            'sak': {
                'sak_id': sak_id,
                'sakstittel': 'New Draft Case'
            },
            'varsel': {},
            'koe_revisjoner': [],
            'bh_svar_revisjoner': []
        }

        response = client.put(
            f'/api/cases/{sak_id}/draft',
            data=json.dumps({'formData': draft_data}),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        # Verify data was created
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data is not None
        assert saved_data['sak']['sakstittel'] == 'New Draft Case'

    def test_save_draft_updates_existing_case(self, client, mock_system, test_sak_with_data):
        """Test that saving draft updates existing case"""
        sak_id = test_sak_with_data['sak_id']

        # Save draft multiple times
        for i in range(3):
            updated_data = test_sak_with_data['data'].copy()
            updated_data['varsel'] = {
                'varsel_beskrivelse': f'Draft version {i}'
            }

            response = client.put(
                f'/api/cases/{sak_id}/draft',
                data=json.dumps({'formData': updated_data}),
                content_type='application/json'
            )

            assert response.status_code == 200

        # Verify last save was persisted
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data['varsel']['varsel_beskrivelse'] == 'Draft version 2'

    def test_save_draft_preserves_other_data(self, client, mock_system, test_sak_with_data):
        """Test that saving draft doesn't lose other case data"""
        sak_id = test_sak_with_data['sak_id']
        original_data = test_sak_with_data['data']

        # Save draft with only varsel update
        updated_data = original_data.copy()
        updated_data['varsel'] = {
            'varsel_beskrivelse': 'Updated varsel'
        }

        response = client.put(
            f'/api/cases/{sak_id}/draft',
            data=json.dumps({'formData': updated_data}),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Verify other data is preserved
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data['sak'] == original_data['sak']
        assert len(saved_data['koe_revisjoner']) == len(original_data['koe_revisjoner'])
