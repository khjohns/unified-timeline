"""
Integration tests for workflow routes (varsel, koe, svar)

Tests complete KOE workflow:
1. Varsel submission
2. KOE submission
3. BH Svar submission
4. Revision cycle
"""
import pytest
import json
from unittest.mock import MagicMock
from core.generated_constants import BH_VEDERLAG_SVAR, BH_FRIST_SVAR


class TestVarselRoutes:
    """Test varsel submission endpoint"""

    def test_varsel_submit_success(self, client, mock_system, test_sak_with_data, test_varsel_data):
        """Test successful varsel submission"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()
        form_data['varsel'] = test_varsel_data

        response = client.post(
            '/api/varsel-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['nextMode'] == 'koe'

        # Verify varsel was saved
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data['varsel']['hovedkategori'] == 'Risiko'

    def test_varsel_submit_auto_populates_date(self, client, mock_system, test_sak_with_data):
        """Test that varsel date is auto-populated"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()
        form_data['varsel'] = {}  # No date

        response = client.post(
            '/api/varsel-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Verify date was auto-populated
        saved_data = mock_system.db.get_case(sak_id)
        assert 'dato_varsel_sendt' in saved_data['varsel']
        assert saved_data['varsel']['dato_varsel_sendt'] != ''

    def test_varsel_submit_creates_first_koe_revision(self, client, mock_system, test_sak_with_data):
        """Test that varsel submission creates first KOE revision template"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()
        form_data['varsel'] = {'hovedkategori': 'Test'}
        form_data['koe_revisjoner'] = []  # Empty

        response = client.post(
            '/api/varsel-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Verify KOE revision was created
        saved_data = mock_system.db.get_case(sak_id)
        assert len(saved_data['koe_revisjoner']) == 1
        assert saved_data['koe_revisjoner'][0]['koe_revisjonsnr'] == '0'

    def test_varsel_submit_missing_data(self, client, mock_system):
        """Test varsel submission with missing data"""
        response = client.post(
            '/api/varsel-submit',
            data=json.dumps({}),
            content_type='application/json'
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data


class TestKoeRoutes:
    """Test KOE submission endpoints"""

    def test_koe_submit_success(self, client, mock_system, test_sak_with_data, test_koe_data):
        """Test successful KOE submission"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()
        form_data['koe_revisjoner'][-1]['vederlag'] = {
            'krav_vederlag': test_koe_data['krav_vederlag'],
            'krav_vederlag_metode': test_koe_data['krav_vederlag_metode'],
            'krav_vederlag_belop': test_koe_data['krav_vederlag_belop'],
            'krav_vederlag_begrunnelse': test_koe_data['krav_vederlag_begrunnelse']
        }
        form_data['koe_revisjoner'][-1]['frist'] = {
            'krav_fristforlengelse': test_koe_data['krav_fristforlengelse'],
            'krav_frist_type': test_koe_data['krav_frist_type'],
            'krav_frist_antall_dager': test_koe_data['krav_frist_antall_dager'],
            'forsinkelse_kritisk_linje': test_koe_data['forsinkelse_kritisk_linje'],
            'krav_frist_begrunnelse': test_koe_data['krav_frist_begrunnelse']
        }

        response = client.post(
            '/api/koe-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['nextMode'] == 'svar'

        # Verify KOE was saved
        saved_data = mock_system.db.get_case(sak_id)
        assert saved_data['koe_revisjoner'][-1]['vederlag']['krav_vederlag'] is True

    def test_koe_submit_creates_first_bh_svar(self, client, mock_system, test_sak_with_data):
        """Test that KOE submission creates first BH svar template"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()
        form_data['bh_svar_revisjoner'] = []  # Empty

        response = client.post(
            '/api/koe-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Verify BH svar was created
        saved_data = mock_system.db.get_case(sak_id)
        assert len(saved_data['bh_svar_revisjoner']) == 1

    def test_koe_revidering_submit(self, client, mock_system, test_sak_with_data):
        """Test submission of revised KOE"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()

        # Add a second revision
        form_data['koe_revisjoner'].append({
            'koe_revisjonsnr': '1',
            'dato_krav_sendt': '',
            'for_entreprenor': '',
            'vederlag': {
                'krav_vederlag': True,
                'krav_vederlag_belop': '45000'  # Revised amount
            },
            'frist': {}
        })

        response = client.post(
            f'/api/cases/{sak_id}/revidering',
            data=json.dumps({'formData': form_data}),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['nextMode'] == 'svar'

    def test_pdf_upload_success(self, client, mock_system, test_sak_with_data, monkeypatch):
        """Test PDF upload to Catenda"""
        sak_id = test_sak_with_data['sak_id']

        # Create a simple base64 PDF (mock data)
        import base64
        pdf_content = b'%PDF-1.4\n%Mock PDF content'
        pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')

        # Create a mock WebhookService
        from unittest.mock import MagicMock
        mock_webhook_service = MagicMock()
        mock_webhook_service.handle_pdf_upload.return_value = {
            'success': True,
            'documentGuid': 'doc-123',
            'filename': 'test.pdf'
        }

        # Mock get_webhook_service to return our mock
        def mock_get_webhook_service():
            return mock_webhook_service

        monkeypatch.setattr('routes.koe_routes.get_webhook_service', mock_get_webhook_service)

        response = client.post(
            f'/api/cases/{sak_id}/pdf',
            data=json.dumps({
                'pdfBase64': pdf_base64,
                'filename': 'test.pdf',
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'documentGuid' in data

        # Verify the service was called with correct arguments
        mock_webhook_service.handle_pdf_upload.assert_called_once_with(
            sak_id, pdf_base64, 'test.pdf', 'topic-abc-123'
        )

    def test_pdf_upload_missing_data(self, client, mock_system, test_sak_with_data):
        """Test PDF upload with missing data"""
        sak_id = test_sak_with_data['sak_id']

        response = client.post(
            f'/api/cases/{sak_id}/pdf',
            data=json.dumps({}),
            content_type='application/json'
        )

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data


class TestSvarRoutes:
    """Test BH svar submission endpoint"""

    def test_svar_submit_full_approval(self, client, mock_system, test_sak_with_data):
        """Test full approval of KOE"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()

        # Add BH svar with full approval
        form_data['bh_svar_revisjoner'] = [{
            'vederlag': {
                'bh_svar_vederlag': BH_VEDERLAG_SVAR['GODKJENT_FULLT'],
                'bh_godkjent_vederlag_belop': '50000'
            },
            'frist': {
                'bh_svar_frist': BH_FRIST_SVAR['GODKJENT_FULLT'],
                'bh_godkjent_frist_dager': '14'
            },
            'sign': {}
        }]

        response = client.post(
            '/api/svar-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        # With full approval, no new revision should be created
        saved_data = mock_system.db.get_case(sak_id)
        assert len(saved_data['koe_revisjoner']) == 1  # Still only first revision

    def test_svar_submit_partial_approval_creates_revision(self, client, mock_system, test_sak_with_data):
        """Test partial approval creates new revision"""
        sak_id = test_sak_with_data['sak_id']
        form_data = test_sak_with_data['data'].copy()

        # Add BH svar with partial approval (vederlag rejected, frist approved)
        form_data['bh_svar_revisjoner'] = [{
            'vederlag': {
                'bh_svar_vederlag': BH_VEDERLAG_SVAR['AVSLÅTT_UENIG'],  # Rejected
                'bh_begrunnelse_vederlag': 'For høyt beløp'
            },
            'frist': {
                'bh_svar_frist': BH_FRIST_SVAR['GODKJENT_FULLT'],  # Approved
                'bh_godkjent_frist_dager': '14'
            },
            'sign': {}
        }]

        response = client.post(
            '/api/svar-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )

        assert response.status_code == 200

        # Verify new revision was created
        saved_data = mock_system.db.get_case(sak_id)
        assert len(saved_data['koe_revisjoner']) == 2
        assert saved_data['koe_revisjoner'][-1]['koe_revisjonsnr'] == '1'

        # Verify new BH svar revision was also created
        assert len(saved_data['bh_svar_revisjoner']) == 2


class TestWorkflowIntegration:
    """Test complete workflow from varsel to svar"""

    def test_complete_workflow_full_approval(self, client, mock_system, test_sak_data, test_varsel_data, test_koe_data):
        """Test complete KOE workflow with full approval"""
        # 1. Create case
        sak_id = mock_system.db.create_case(test_sak_data)
        form_data = mock_system.db.get_case(sak_id)

        # 2. Submit varsel
        form_data['varsel'] = test_varsel_data
        response = client.post(
            '/api/varsel-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        assert response.get_json()['nextMode'] == 'koe'

        # 3. Submit KOE
        form_data = mock_system.db.get_case(sak_id)
        form_data['koe_revisjoner'][-1]['vederlag'] = {
            'krav_vederlag': True,
            'krav_vederlag_belop': '50000'
        }
        response = client.post(
            '/api/koe-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        assert response.get_json()['nextMode'] == 'svar'

        # 4. Submit BH svar with full approval
        form_data = mock_system.db.get_case(sak_id)
        form_data['bh_svar_revisjoner'][-1]['vederlag'] = {
            'bh_svar_vederlag': BH_VEDERLAG_SVAR['GODKJENT_FULLT']
        }
        form_data['bh_svar_revisjoner'][-1]['frist'] = {
            'bh_svar_frist': BH_FRIST_SVAR['GODKJENT_FULLT']
        }
        response = client.post(
            '/api/svar-submit',
            data=json.dumps({
                'sakId': sak_id,
                'formData': form_data,
                'topicGuid': 'topic-abc-123'
            }),
            content_type='application/json'
        )
        assert response.status_code == 200

        # Verify workflow completed successfully
        final_data = mock_system.db.get_case(sak_id)
        assert final_data['varsel']['hovedkategori'] == 'Risiko'
        assert final_data['koe_revisjoner'][-1]['vederlag']['krav_vederlag'] is True
        assert final_data['bh_svar_revisjoner'][-1]['vederlag']['bh_svar_vederlag'] == BH_VEDERLAG_SVAR['GODKJENT_FULLT']
