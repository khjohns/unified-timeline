"""
Tests for VarselService.

These tests verify the business logic for varsel (notification) operations
without any Flask dependencies.
"""
import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime

from services.varsel_service import VarselService
from repositories.csv_repository import CSVRepository
from constants import SAK_STATUS, KOE_STATUS
import tempfile
import shutil


class TestVarselService:
    """Test suite for VarselService"""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data"""
        temp_path = tempfile.mkdtemp()
        yield temp_path
        shutil.rmtree(temp_path)

    @pytest.fixture
    def repo(self, temp_dir):
        """Create CSVRepository instance"""
        return CSVRepository(data_dir=temp_dir)

    @pytest.fixture
    def mock_catenda(self):
        """Create mock Catenda service"""
        catenda = Mock()
        catenda.create_comment = Mock()
        return catenda

    @pytest.fixture
    def mock_magic_link(self):
        """Create mock magic link generator"""
        magic_link = Mock()
        magic_link.generate = Mock(return_value="test-magic-token-123")
        return magic_link

    @pytest.fixture
    def service(self, repo, mock_catenda, mock_magic_link):
        """Create VarselService instance"""
        return VarselService(
            repository=repo,
            catenda_service=mock_catenda,
            magic_link_generator=mock_magic_link,
            react_base_url="http://localhost:3000"
        )

    @pytest.fixture
    def test_case_data(self, repo):
        """Create a test case and return its data"""
        case_data = {
            'sak_id': 'TEST-VARSEL-001',
            'catenda_topic_id': 'topic-123',
            'sakstittel': 'Test varsel sak',
            'status': SAK_STATUS['UNDER_VARSLING'],
            'modus': 'varsel'
        }
        case_id = repo.create_case(case_data)
        return repo.get_case(case_id)

    @pytest.fixture
    def valid_form_data(self):
        """Valid form data for varsel submission"""
        return {
            'sak': {
                'sak_id': 'TEST-VARSEL-001',
                'status': SAK_STATUS['UNDER_VARSLING'],
                'modus': 'varsel'
            },
            'varsel': {
                'dato_forhold_oppdaget': '2025-11-20',
                'hovedkategori': 'Risiko',
                'underkategori': 'Grunnforhold',
                'varsel_beskrivelse': 'Oppdaget dårlige grunnforhold som kan påvirke fremdrift'
            }
        }

    # ========================================================================
    # Test: submit_varsel - Success cases
    # ========================================================================

    def test_submit_varsel_success(self, service, test_case_data, valid_form_data):
        """Test successful varsel submission"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        topic_guid = 'topic-123'

        # Act
        result = service.submit_varsel(sak_id, valid_form_data, topic_guid)

        # Assert
        assert result['success'] is True
        assert result['nextMode'] == 'koe'
        assert result['sakId'] == sak_id

        # Verify case was updated
        updated_case = service.repo.get_case(sak_id)
        assert updated_case is not None
        assert updated_case['sak']['status'] == SAK_STATUS['VARSLET']
        assert updated_case['sak']['modus'] == 'koe'
        assert 'varsel' in updated_case
        assert updated_case['varsel']['dato_forhold_oppdaget'] == '2025-11-20'

    def test_submit_varsel_auto_populates_sent_date(self, service, test_case_data, valid_form_data):
        """Test that varsel sent date is auto-populated"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        # Don't include dato_varsel_sendt in form data
        assert 'dato_varsel_sendt' not in valid_form_data['varsel']

        # Act
        result = service.submit_varsel(sak_id, valid_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert 'dato_varsel_sendt' in updated_case['varsel']

        # Check it's today's date
        sent_date = updated_case['varsel']['dato_varsel_sendt']
        today = datetime.now().strftime('%Y-%m-%d')
        assert sent_date == today

    def test_submit_varsel_preserves_existing_sent_date(self, service, test_case_data, valid_form_data):
        """Test that existing sent date is preserved (for 'tidligere varslet' case)"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        existing_date = '2025-11-15'
        valid_form_data['varsel']['dato_varsel_sendt'] = existing_date

        # Act
        result = service.submit_varsel(sak_id, valid_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert updated_case['varsel']['dato_varsel_sendt'] == existing_date

    def test_submit_varsel_creates_initial_koe_revision(self, service, test_case_data, valid_form_data):
        """Test that first KOE revision is created if missing"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        # Ensure no koe_revisjoner in form_data
        valid_form_data.pop('koe_revisjoner', None)

        # Act
        result = service.submit_varsel(sak_id, valid_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert 'koe_revisjoner' in updated_case
        assert len(updated_case['koe_revisjoner']) == 1

        # Verify structure of initial revision
        revision = updated_case['koe_revisjoner'][0]
        assert revision['koe_revisjonsnr'] == '0'
        assert revision['status'] == KOE_STATUS['UTKAST']
        assert 'vederlag' in revision
        assert 'frist' in revision

    def test_submit_varsel_preserves_existing_koe_revisions(self, service, test_case_data, valid_form_data):
        """Test that existing KOE revisions are not overwritten"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        valid_form_data['koe_revisjoner'] = [
            {
                'koe_revisjonsnr': '0',
                'status': KOE_STATUS['UTKAST'],
                'vederlag': {'krav_vederlag': True},
                'frist': {'krav_fristforlengelse': False}
            }
        ]

        # Act
        result = service.submit_varsel(sak_id, valid_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert len(updated_case['koe_revisjoner']) == 1
        assert updated_case['koe_revisjoner'][0]['vederlag']['krav_vederlag'] is True

    def test_submit_varsel_posts_catenda_comment(self, service, test_case_data, valid_form_data, mock_catenda, mock_magic_link):
        """Test that Catenda comment is posted"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        topic_guid = 'topic-123'

        # Act
        result = service.submit_varsel(sak_id, valid_form_data, topic_guid)

        # Assert
        mock_catenda.create_comment.assert_called_once()
        call_args = mock_catenda.create_comment.call_args
        assert call_args[0][0] == topic_guid  # First arg is topic_guid

        comment_text = call_args[0][1]  # Second arg is comment text
        assert 'Varsel for krav om endringsordre (KOE) er sendt' in comment_text
        assert sak_id in comment_text
        assert 'test-magic-token-123' in comment_text

    def test_submit_varsel_without_catenda_service(self, repo, test_case_data, valid_form_data):
        """Test that varsel submission works without Catenda service"""
        # Arrange
        service_no_catenda = VarselService(repository=repo)
        sak_id = test_case_data['sak']['sak_id']

        # Act - should not raise
        result = service_no_catenda.submit_varsel(sak_id, valid_form_data)

        # Assert
        assert result['success'] is True

    # ========================================================================
    # Test: submit_varsel - Error cases
    # ========================================================================

    def test_submit_varsel_case_not_found(self, service, valid_form_data):
        """Test that ValueError is raised if case doesn't exist"""
        # Arrange
        nonexistent_id = 'DOES-NOT-EXIST'

        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.submit_varsel(nonexistent_id, valid_form_data)

    def test_submit_varsel_invalid_varsel_data(self, service, test_case_data):
        """Test that ValueError is raised for invalid varsel data"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        invalid_form_data = {
            'sak': test_case_data['sak'],
            'varsel': {
                'dato_forhold_oppdaget': 'invalid-date',  # Invalid date format
                'hovedkategori': '',  # Empty required field
            }
        }

        # Act & Assert
        with pytest.raises(ValueError, match="Invalid varsel data"):
            service.submit_varsel(sak_id, invalid_form_data)

    def test_submit_varsel_catenda_comment_failure_does_not_fail_operation(
        self, service, test_case_data, valid_form_data, mock_catenda
    ):
        """Test that Catenda comment failure doesn't fail the whole operation"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        topic_guid = 'topic-123'
        mock_catenda.create_comment.side_effect = Exception("Catenda API error")

        # Act - should not raise, just log warning
        result = service.submit_varsel(sak_id, valid_form_data, topic_guid)

        # Assert
        assert result['success'] is True  # Operation still succeeds

        # Verify case was updated despite Catenda failure
        updated_case = service.repo.get_case(sak_id)
        assert updated_case['sak']['status'] == SAK_STATUS['VARSLET']

    # ========================================================================
    # Test: get_varsel
    # ========================================================================

    def test_get_varsel_success(self, service, test_case_data, valid_form_data):
        """Test getting varsel data for a case"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']
        service.submit_varsel(sak_id, valid_form_data)

        # Act
        varsel = service.get_varsel(sak_id)

        # Assert
        assert varsel is not None
        assert varsel['dato_forhold_oppdaget'] == '2025-11-20'
        assert varsel['hovedkategori'] == 'Risiko'

    def test_get_varsel_case_not_found(self, service):
        """Test that ValueError is raised if case doesn't exist"""
        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.get_varsel('NONEXISTENT')

    def test_get_varsel_no_varsel_data(self, service, test_case_data):
        """Test getting varsel when none exists returns None"""
        # Arrange
        sak_id = test_case_data['sak']['sak_id']

        # Act
        varsel = service.get_varsel(sak_id)

        # Assert
        assert varsel == {}  # Empty dict from initial case creation

    # ========================================================================
    # Test: validate_varsel_data
    # ========================================================================

    def test_validate_varsel_data_success(self, service, valid_form_data):
        """Test validating valid varsel data"""
        # Act
        is_valid = service.validate_varsel_data(valid_form_data)

        # Assert
        assert is_valid is True

    def test_validate_varsel_data_invalid(self, service):
        """Test validating invalid varsel data"""
        # Arrange
        invalid_form_data = {
            'varsel': {
                'dato_forhold_oppdaget': 'not-a-date',
                'hovedkategori': '',
            }
        }

        # Act & Assert
        with pytest.raises(ValueError, match="Varsel validation failed"):
            service.validate_varsel_data(invalid_form_data)
