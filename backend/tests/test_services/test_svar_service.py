"""
Tests for SvarService.

These tests verify the business logic for Svar (client response) operations
without any Flask dependencies.
"""
import pytest
from unittest.mock import Mock
from datetime import datetime

from services.svar_service import SvarService
from repositories.csv_repository import CSVRepository
from core.generated_constants import SAK_STATUS, KOE_STATUS, BH_SVAR_STATUS, BH_VEDERLAG_SVAR, BH_FRIST_SVAR
import tempfile
import shutil


class TestSvarService:
    """Test suite for SvarService"""

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
        magic_link.generate = Mock(return_value="test-svar-token-789")
        return magic_link

    @pytest.fixture
    def service(self, repo, mock_catenda, mock_magic_link):
        """Create SvarService instance"""
        return SvarService(
            repository=repo,
            catenda_service=mock_catenda,
            magic_link_generator=mock_magic_link,
            react_base_url="http://localhost:3000"
        )

    @pytest.fixture
    def test_case_with_svar(self, repo):
        """Create a test case with KOE and initial BH svar"""
        case_data = {
            'sak_id': 'TEST-SVAR-001',
            'catenda_topic_id': 'topic-789',
            'sakstittel': 'Test Svar sak',
            'status': SAK_STATUS['VENTER_PAA_SVAR'],
            'modus': 'svar',
            'byggherre': 'Test Byggherre'
        }
        case_id = repo.create_case(case_data)

        # Add KOE and BH svar structures
        case = repo.get_case(case_id)
        case['koe_revisjoner'] = [{
            'koe_revisjonsnr': '0',
            'dato_krav_sendt': '2025-11-27',
            'for_entreprenor': 'Test Contractor',
            'status': KOE_STATUS['SENDT_TIL_BH'],
            'vederlag': {
                'krav_vederlag': True,
                'krav_vederlag_belop': '150000'
            },
            'frist': {
                'krav_fristforlengelse': True,
                'krav_frist_antall_dager': '14'
            }
        }]
        case['bh_svar_revisjoner'] = [{
            'vederlag': {
                'bh_svar_vederlag': '',
                'bh_godkjent_vederlag_belop': ''
            },
            'frist': {
                'bh_svar_frist': '',
                'bh_godkjent_frist_dager': ''
            },
            'sign': {},
            'status': BH_SVAR_STATUS['UTKAST']
        }]
        repo.update_case(case_id, case)

        return repo.get_case(case_id)

    @pytest.fixture
    def valid_svar_godkjent(self):
        """Valid form data for fully approved BH svar"""
        return {
            'sak': {
                'sak_id': 'TEST-SVAR-001',
                'status': SAK_STATUS['VENTER_PAA_SVAR'],
                'modus': 'svar',
                'byggherre': 'Test Byggherre'
            },
            'koe_revisjoner': [{
                'koe_revisjonsnr': '0',
                'vederlag': {'krav_vederlag': True, 'krav_vederlag_belop': '150000'},
                'frist': {'krav_fristforlengelse': True, 'krav_frist_antall_dager': '14'}
            }],
            'bh_svar_revisjoner': [{
                'vederlag': {
                    'bh_svar_vederlag': BH_VEDERLAG_SVAR['GODKJENT_FULLT'],
                    'bh_godkjent_vederlag_belop': '150000'
                },
                'frist': {
                    'bh_svar_frist': BH_FRIST_SVAR['GODKJENT_FULLT'],
                    'bh_godkjent_frist_dager': '14'
                },
                'sign': {},
                'status': BH_SVAR_STATUS['UTKAST']
            }]
        }

    @pytest.fixture
    def valid_svar_delvis_godkjent(self):
        """Valid form data for partially approved BH svar (requires revision)"""
        return {
            'sak': {
                'sak_id': 'TEST-SVAR-001',
                'status': SAK_STATUS['VENTER_PAA_SVAR'],
                'modus': 'svar',
                'byggherre': 'Test Byggherre'
            },
            'koe_revisjoner': [{
                'koe_revisjonsnr': '0',
                'vederlag': {'krav_vederlag': True, 'krav_vederlag_belop': '150000'},
                'frist': {'krav_fristforlengelse': True, 'krav_frist_antall_dager': '14'}
            }],
            'bh_svar_revisjoner': [{
                'vederlag': {
                    'bh_svar_vederlag': BH_VEDERLAG_SVAR['DELVIS_GODKJENT'],  # Requires revision!
                    'bh_godkjent_vederlag_belop': '100000'
                },
                'frist': {
                    'bh_svar_frist': BH_FRIST_SVAR['GODKJENT_FULLT'],
                    'bh_godkjent_frist_dager': '14'
                },
                'sign': {},
                'status': BH_SVAR_STATUS['UTKAST']
            }]
        }

    # ========================================================================
    # Test: submit_svar - Success cases with full approval
    # ========================================================================

    def test_submit_svar_full_approval_success(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test successful BH svar submission with full approval"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']
        topic_guid = 'topic-789'

        # Act
        result = service.submit_svar(sak_id, valid_svar_godkjent, topic_guid)

        # Assert
        assert result['success'] is True
        assert result['nextMode'] == 'completed'  # No revision needed
        assert result['requiresRevision'] is False

        # Verify case was updated
        updated_case = service.repo.get_case(sak_id)
        assert updated_case is not None
        assert updated_case['sak']['status'] == SAK_STATUS['VURDERES_AV_TE']
        assert updated_case['sak']['modus'] == 'completed'

    def test_submit_svar_auto_populates_date(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test that BH svar date is auto-populated"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act
        result = service.submit_svar(sak_id, valid_svar_godkjent)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_svar = updated_case['bh_svar_revisjoner'][-1]
        assert 'sign' in siste_svar
        assert siste_svar['sign']['dato_svar_bh'] != ''

        # Check it's today's date
        sent_date = siste_svar['sign']['dato_svar_bh']
        today = datetime.now().strftime('%Y-%m-%d')
        assert sent_date == today

    def test_submit_svar_auto_populates_signature(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test that BH svar signature is auto-populated"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act
        result = service.submit_svar(sak_id, valid_svar_godkjent, submitted_by="Jane Client")

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_svar = updated_case['bh_svar_revisjoner'][-1]
        assert siste_svar['sign']['for_byggherre'] == "Jane Client"

    def test_submit_svar_signature_defaults_to_byggherre(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test that signature defaults to sak byggherre if not provided"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act
        result = service.submit_svar(sak_id, valid_svar_godkjent)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        siste_svar = updated_case['bh_svar_revisjoner'][-1]
        assert siste_svar['sign']['for_byggherre'] == 'Test Byggherre'

    # ========================================================================
    # Test: submit_svar - Partial approval (requires revision)
    # ========================================================================

    def test_submit_svar_partial_approval_creates_revision(self, service, test_case_with_svar, valid_svar_delvis_godkjent):
        """Test that partial approval creates new KOE and BH svar revisions"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act
        result = service.submit_svar(sak_id, valid_svar_delvis_godkjent)

        # Assert
        assert result['success'] is True
        assert result['nextMode'] == 'koe'  # Contractor needs to revise
        assert result['requiresRevision'] is True

        # Verify new revisions were created
        updated_case = service.repo.get_case(sak_id)
        assert len(updated_case['koe_revisjoner']) == 2  # Original + new
        assert len(updated_case['bh_svar_revisjoner']) == 2

        # Verify new KOE revision
        ny_koe = updated_case['koe_revisjoner'][-1]
        assert ny_koe['koe_revisjonsnr'] == '1'
        assert ny_koe['status'] == KOE_STATUS['UTKAST']
        assert ny_koe['dato_krav_sendt'] == ''  # Not yet submitted

        # Verify new BH svar revision
        ny_svar = updated_case['bh_svar_revisjoner'][-1]
        assert ny_svar['status'] == BH_SVAR_STATUS['UTKAST']

    def test_submit_svar_partial_approval_updates_status(self, service, test_case_with_svar, valid_svar_delvis_godkjent):
        """Test that partial approval sets correct status"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act
        result = service.submit_svar(sak_id, valid_svar_delvis_godkjent)

        # Assert
        updated_case = service.repo.get_case(sak_id)
        assert updated_case['sak']['status'] == SAK_STATUS['UNDER_AVKLARING']
        assert updated_case['sak']['modus'] == 'koe'

    def test_submit_svar_posts_catenda_comment_with_decision(self, service, test_case_with_svar, valid_svar_godkjent, mock_catenda):
        """Test that Catenda comment includes decision details"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']
        topic_guid = 'topic-789'

        # Act
        result = service.submit_svar(sak_id, valid_svar_godkjent, topic_guid)

        # Assert
        mock_catenda.create_comment.assert_called_once()
        call_args = mock_catenda.create_comment.call_args
        assert call_args[0][0] == topic_guid

        comment_text = call_args[0][1]
        assert 'Svar fra byggherre' in comment_text
        assert '150000' in comment_text  # Godkjent beløp
        assert '14' in comment_text  # Godkjente dager
        assert 'Sak kan lukkes' in comment_text  # Full approval

    def test_submit_svar_without_catenda_service(self, repo, test_case_with_svar, valid_svar_godkjent):
        """Test that svar submission works without Catenda service"""
        # Arrange
        service_no_catenda = SvarService(repository=repo)
        sak_id = test_case_with_svar['sak']['sak_id']

        # Act - should not raise
        result = service_no_catenda.submit_svar(sak_id, valid_svar_godkjent)

        # Assert
        assert result['success'] is True

    # ========================================================================
    # Test: submit_svar - Error cases
    # ========================================================================

    def test_submit_svar_case_not_found(self, service, valid_svar_godkjent):
        """Test that ValueError is raised if case doesn't exist"""
        # Arrange
        nonexistent_id = 'DOES-NOT-EXIST'

        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.submit_svar(nonexistent_id, valid_svar_godkjent)

    def test_submit_svar_no_revisions_raises_error(self, service, test_case_with_svar):
        """Test that ValueError is raised if no BH svar revisions"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']
        invalid_form_data = {
            'sak': test_case_with_svar['sak'],
            'bh_svar_revisjoner': []  # Empty!
        }

        # Act & Assert
        with pytest.raises(ValueError, match="No BH svar revisions found"):
            service.submit_svar(sak_id, invalid_form_data)

    # ========================================================================
    # Test: get_bh_svar_revisjoner
    # ========================================================================

    def test_get_bh_svar_revisjoner_success(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test getting all BH svar revisions for a case"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']
        service.submit_svar(sak_id, valid_svar_godkjent)

        # Act
        revisjoner = service.get_bh_svar_revisjoner(sak_id)

        # Assert
        assert len(revisjoner) >= 1

    def test_get_bh_svar_revisjoner_case_not_found(self, service):
        """Test that ValueError is raised if case doesn't exist"""
        # Act & Assert
        with pytest.raises(ValueError, match="Case not found"):
            service.get_bh_svar_revisjoner('NONEXISTENT')

    # ========================================================================
    # Test: get_latest_svar
    # ========================================================================

    def test_get_latest_svar_success(self, service, test_case_with_svar, valid_svar_godkjent):
        """Test getting latest BH svar revision"""
        # Arrange
        sak_id = test_case_with_svar['sak']['sak_id']
        service.submit_svar(sak_id, valid_svar_godkjent)

        # Act
        latest = service.get_latest_svar(sak_id)

        # Assert
        assert latest is not None
        assert latest['vederlag']['bh_svar_vederlag'] == BH_VEDERLAG_SVAR['GODKJENT_FULLT']

    def test_get_latest_svar_no_revisions_returns_none(self, service, repo):
        """Test that None is returned if no revisions"""
        # Arrange
        case_data = {'sak_id': 'TEST-EMPTY-SVAR', 'sakstittel': 'Test'}
        case_id = repo.create_case(case_data)

        # Remove bh_svar_revisjoner
        case = repo.get_case(case_id)
        case['bh_svar_revisjoner'] = []
        repo.update_case(case_id, case)

        # Act
        latest = service.get_latest_svar(case_id)

        # Assert
        assert latest is None
