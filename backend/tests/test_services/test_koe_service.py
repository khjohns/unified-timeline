"""
Tests for KoeService.

These tests verify the business logic for KOE (change order request) operations
without any Flask dependencies.
"""
import pytest
from unittest.mock import Mock
from datetime import datetime

from services.koe_service import KoeService
from repositories.csv_repository import CSVRepository
from generated_constants import SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS
import tempfile
import shutil


class TestKoeService:
    """Test suite for KoeService"""

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
        magic_link.generate = Mock(return_value="test-koe-token-456")
        return magic_link

    @pytest.fixture
    def service(self, repo, mock_catenda, mock_magic_link):
        """Create KoeService instance"""
        return KoeService(
            repository=repo,
            catenda_service=mock_catenda,
            magic_link_generator=mock_magic_link,
            react_base_url="http://localhost:3000"
        )

    @pytest.fixture
    def test_case_with_koe(self, repo):
        """Create a test case with initial KOE revision"""
        case_data = {
            'sak_id': 'TEST-KOE-001',
            'catenda_topic_id': 'topic-456',
            'sakstittel': 'Test KOE sak',
            'status': SAK_STATUS['VARSLET'],
            'modus': 'koe',
            'opprettet_av': 'Test User'
        }
        case_id = repo.create_case(case_data)
        return repo.get_case(case_id)

    @pytest.fixture
    def valid_koe_form_data(self):
        """Valid form data for KOE submission"""
        return {
            'sak': {
                'sak_id': 'TEST-KOE-001',
                'status': SAK_STATUS['VARSLET'],
                'modus': 'koe',
                'opprettet_av': 'Test User'
            },
            'koe_revisjoner': [
                {
                    'koe_revisjonsnr': '0',
                    'dato_krav_sendt': '',
                    'for_entreprenor': '',
                    'status': KOE_STATUS['UTKAST'],
                    'vederlag': {
                        'krav_vederlag': True,
                        'krav_produktivitetstap': False,
                        'saerskilt_varsel_rigg_drift': False,
                        'krav_vederlag_metode': '100000000',
                        'krav_vederlag_belop': '150000',
                        'krav_vederlag_begrunnelse': 'Ekstra kostnader'
                    },
                    'frist': {
                        'krav_fristforlengelse': True,
                        'krav_frist_type': 'kalenderdager',
                        'krav_frist_antall_dager': '14',
                        'forsinkelse_kritisk_linje': True,
                        'krav_frist_begrunnelse': 'Venter på leveranse'
                    }
                }
            ]
        }

    # ========================================================================
    # Test: submit_koe - Success cases
    # ========================================================================

    def test_submit_koe_success(self, service, test_case_with_koe, valid_koe_form_data):
        """Test successful KOE submission"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        topic_guid = 'topic-456'

        # Act
        result = service.submit_koe(sak_id, valid_koe_form_data, topic_guid)

        # Assert
        assert result['success'] is True
        assert result['nextMode'] == 'svar'
        assert result['sakId'] == sak_id

        # Verify case was updated
        updated_case = service.repo.get_case(sak_id)
        assert updated_case is not None
        assert updated_case['sak']['status'] == SAK_STATUS['VENTER_PAA_SVAR']
        assert updated_case['sak']['modus'] == 'svar'

    def test_submit_koe_auto_populates_sent_date(self, service, test_case_with_koe, valid_koe_form_data):
        """Test that KOE sent date is auto-populated"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        # Ensure dato_krav_sendt is empty
        assert valid_koe_form_data['koe_revisjoner'][0]['dato_krav_sendt'] == ''

        # Act
        result = service.submit_koe(sak_id, valid_koe_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_koe = updated_case['koe_revisjoner'][-1]
        assert siste_koe['dato_krav_sendt'] != ''

        # Check it's today's date
        sent_date = siste_koe['dato_krav_sendt']
        today = datetime.now().strftime('%Y-%m-%d')
        assert sent_date == today

    def test_submit_koe_auto_populates_signature(self, service, test_case_with_koe, valid_koe_form_data):
        """Test that KOE signature is auto-populated"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']

        # Act
        result = service.submit_koe(sak_id, valid_koe_form_data, submitted_by="John Contractor")

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_koe = updated_case['koe_revisjoner'][-1]
        assert siste_koe['for_entreprenor'] == "John Contractor"

    def test_submit_koe_signature_defaults_to_sak_creator(self, service, test_case_with_koe, valid_koe_form_data):
        """Test that signature defaults to sak creator if not provided"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']

        # Act - don't provide submitted_by
        result = service.submit_koe(sak_id, valid_koe_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_koe = updated_case['koe_revisjoner'][-1]
        assert siste_koe['for_entreprenor'] == 'Test User'  # From opprettet_av

    def test_submit_koe_creates_initial_bh_svar(self, service, test_case_with_koe, valid_koe_form_data):
        """Test that first BH svar-revisjon is created if missing"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        # Ensure no bh_svar_revisjoner in form_data
        valid_koe_form_data.pop('bh_svar_revisjoner', None)

        # Act
        result = service.submit_koe(sak_id, valid_koe_form_data)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert 'bh_svar_revisjoner' in updated_case
        assert len(updated_case['bh_svar_revisjoner']) == 1

        # Verify structure of initial svar
        svar = updated_case['bh_svar_revisjoner'][0]
        assert svar['status'] == BH_SVAR_STATUS['UTKAST']
        assert 'vederlag' in svar
        assert 'frist' in svar
        assert 'sign' in svar

    def test_submit_koe_posts_catenda_comment_with_claims(self, service, test_case_with_koe, valid_koe_form_data, mock_catenda):
        """Test that Catenda comment includes claim details"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        topic_guid = 'topic-456'

        # Act
        result = service.submit_koe(sak_id, valid_koe_form_data, topic_guid)

        # Assert
        mock_catenda.create_comment.assert_called_once()
        call_args = mock_catenda.create_comment.call_args
        assert call_args[0][0] == topic_guid

        comment_text = call_args[0][1]
        assert 'Krav om endringsordre (KOE) sendt' in comment_text
        assert 'Revisjon: 0' in comment_text
        assert '150000' in comment_text  # Vederlag amount
        assert '14' in comment_text  # Frist days

    def test_submit_koe_without_catenda_service(self, repo, test_case_with_koe, valid_koe_form_data):
        """Test that KOE submission works without Catenda service"""
        # Arrange
        service_no_catenda = KoeService(repository=repo)
        sak_id = test_case_with_koe['sak']['sak_id']

        # Act - should not raise
        result = service_no_catenda.submit_koe(sak_id, valid_koe_form_data)

        # Assert
        assert result['success'] is True

    # ========================================================================
    # Test: submit_koe - Error cases
    # ========================================================================

    def test_submit_koe_case_not_found(self, service, valid_koe_form_data):
        """Test that ValueError is raised if case doesn't exist"""
        # Arrange
        nonexistent_id = 'DOES-NOT-EXIST'

        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.submit_koe(nonexistent_id, valid_koe_form_data)

    def test_submit_koe_no_revisions_raises_error(self, service, test_case_with_koe):
        """Test that ValueError is raised if no KOE revisions"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        invalid_form_data = {
            'sak': test_case_with_koe['sak'],
            'koe_revisjoner': []  # Empty!
        }

        # Act & Assert
        with pytest.raises(ValueError, match="No KOE revisions found"):
            service.submit_koe(sak_id, invalid_form_data)

    # ========================================================================
    # Test: get_koe_revisjoner
    # ========================================================================

    def test_get_koe_revisjoner_success(self, service, test_case_with_koe, valid_koe_form_data):
        """Test getting all KOE revisions for a case"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        service.submit_koe(sak_id, valid_koe_form_data)

        # Act
        revisjoner = service.get_koe_revisjoner(sak_id)

        # Assert
        assert len(revisjoner) >= 1
        assert revisjoner[0]['koe_revisjonsnr'] == '0'

    def test_get_koe_revisjoner_case_not_found(self, service):
        """Test that ValueError is raised if case doesn't exist"""
        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.get_koe_revisjoner('NONEXISTENT')

    # ========================================================================
    # Test: get_latest_koe
    # ========================================================================

    def test_get_latest_koe_success(self, service, test_case_with_koe, valid_koe_form_data):
        """Test getting latest KOE revision"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        service.submit_koe(sak_id, valid_koe_form_data)

        # Act
        latest = service.get_latest_koe(sak_id)

        # Assert
        assert latest is not None
        assert latest['koe_revisjonsnr'] == '0'
        assert latest['vederlag']['krav_vederlag_belop'] == '150000'

    def test_get_latest_koe_no_revisions_returns_none(self, service, repo):
        """Test that None is returned if no revisions"""
        # Arrange
        case_data = {'sak_id': 'TEST-EMPTY', 'sakstittel': 'Test'}
        case_id = repo.create_case(case_data)

        # Remove koe_revisjoner
        case = repo.get_case(case_id)
        case['koe_revisjoner'] = []
        repo.update_case(case_id, case)

        # Act
        latest = service.get_latest_koe(case_id)

        # Assert
        assert latest is None

    # ========================================================================
    # Test: create_new_revision
    # ========================================================================

    def test_create_new_revision_based_on_previous(self, service, test_case_with_koe, valid_koe_form_data):
        """Test creating new revision based on previous"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        service.submit_koe(sak_id, valid_koe_form_data)

        # Act
        new_revision = service.create_new_revision(sak_id, base_on_previous=True)

        # Assert
        assert new_revision['koe_revisjonsnr'] == '1'
        assert new_revision['dato_krav_sendt'] == ''  # Reset
        assert new_revision['for_entreprenor'] == ''  # Reset
        assert new_revision['status'] == KOE_STATUS['UTKAST']

        # Verify it copied vederlag data
        assert new_revision['vederlag']['krav_vederlag_belop'] == '150000'

        # Verify it was saved
        revisjoner = service.get_koe_revisjoner(sak_id)
        assert len(revisjoner) == 2

    def test_create_new_revision_fresh(self, service, test_case_with_koe, valid_koe_form_data):
        """Test creating fresh revision without copying"""
        # Arrange
        sak_id = test_case_with_koe['sak']['sak_id']
        service.submit_koe(sak_id, valid_koe_form_data)

        # Act
        new_revision = service.create_new_revision(sak_id, base_on_previous=False)

        # Assert
        assert new_revision['koe_revisjonsnr'] == '1'
        assert new_revision['vederlag']['krav_vederlag'] is False  # Default, not copied

        # Verify it was saved
        revisjoner = service.get_koe_revisjoner(sak_id)
        assert len(revisjoner) == 2

    def test_create_new_revision_case_not_found(self, service):
        """Test that ValueError is raised if case doesn't exist"""
        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.create_new_revision('NONEXISTENT')
