"""
Tests for CSVRepository.

These tests verify that the CSV-based repository correctly implements
the BaseRepository interface.
"""
import pytest
import tempfile
import shutil
from pathlib import Path

from repositories.csv_repository import CSVRepository
from generated_constants import SAK_STATUS


class TestCSVRepository:
    """Test suite for CSVRepository"""

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory for test data"""
        temp_path = tempfile.mkdtemp()
        yield temp_path
        shutil.rmtree(temp_path)

    @pytest.fixture
    def repo(self, temp_dir):
        """Create CSVRepository instance with temporary directory"""
        return CSVRepository(data_dir=temp_dir)

    def test_initialization(self, repo, temp_dir):
        """Test that repository initializes correctly"""
        assert repo.data_dir == Path(temp_dir)
        assert repo.saker_file.exists()
        assert repo.historikk_file.exists()
        assert repo.form_data_dir.exists()

    def test_create_case(self, repo):
        """Test creating a new case"""
        case_data = {
            'catenda_topic_id': 'topic-123',
            'catenda_project_id': 'proj-456',
            'sakstittel': 'Test sak',
            'te_navn': 'Test TE'
        }

        case_id = repo.create_case(case_data)

        assert case_id is not None
        assert case_id.startswith('KOE-')
        assert repo.case_exists(case_id)

    def test_get_case(self, repo):
        """Test retrieving a case"""
        # Create case
        case_data = {
            'catenda_topic_id': 'topic-123',
            'sakstittel': 'Test sak',
        }
        case_id = repo.create_case(case_data)

        # Retrieve case
        retrieved = repo.get_case(case_id)

        assert retrieved is not None
        assert retrieved['sak']['sakstittel'] == 'Test sak'
        assert retrieved['versjon'] == '5.0'
        assert 'koe_revisjoner' in retrieved

    def test_get_nonexistent_case(self, repo):
        """Test retrieving non-existent case returns None"""
        result = repo.get_case('nonexistent-id')
        assert result is None

    def test_update_case(self, repo):
        """Test updating a case"""
        # Create case
        case_data = {'sakstittel': 'Original'}
        case_id = repo.create_case(case_data)

        # Get and modify
        data = repo.get_case(case_id)
        data['sak']['sakstittel'] = 'Updated'
        data['sak']['status'] = SAK_STATUS['VARSLET']

        # Update
        repo.update_case(case_id, data)

        # Verify
        updated = repo.get_case(case_id)
        assert updated['sak']['sakstittel'] == 'Updated'
        assert updated['sak']['status'] == SAK_STATUS['VARSLET']

    def test_update_nonexistent_case_raises_error(self, repo):
        """Test updating non-existent case raises ValueError"""
        with pytest.raises(ValueError, match="Case not found"):
            repo.update_case('nonexistent-id', {})

    def test_case_exists(self, repo):
        """Test case_exists method"""
        case_data = {'sakstittel': 'Test'}
        case_id = repo.create_case(case_data)

        assert repo.case_exists(case_id) is True
        assert repo.case_exists('nonexistent-id') is False

    def test_list_cases(self, repo):
        """Test listing all cases"""
        # Create multiple cases
        case_ids = []
        for i in range(3):
            case_data = {
                'sakstittel': f'Test {i}',
                'catenda_project_id': 'proj-123'
            }
            case_ids.append(repo.create_case(case_data))

        # List all
        cases = repo.list_cases()
        assert len(cases) == 3

    def test_list_cases_filtered_by_project(self, repo):
        """Test listing cases filtered by project"""
        # Create cases in different projects
        repo.create_case({'sakstittel': 'Test 1', 'catenda_project_id': 'proj-A'})
        repo.create_case({'sakstittel': 'Test 2', 'catenda_project_id': 'proj-B'})
        repo.create_case({'sakstittel': 'Test 3', 'catenda_project_id': 'proj-A'})

        # Filter by project
        cases_a = repo.list_cases(project_id='proj-A')
        assert len(cases_a) == 2

        cases_b = repo.list_cases(project_id='proj-B')
        assert len(cases_b) == 1

    def test_delete_case(self, repo):
        """Test deleting a case"""
        case_data = {'sakstittel': 'Test'}
        case_id = repo.create_case(case_data)

        assert repo.case_exists(case_id)

        repo.delete_case(case_id)

        assert not repo.case_exists(case_id)
        assert repo.get_case(case_id) is None

    def test_delete_nonexistent_case_raises_error(self, repo):
        """Test deleting non-existent case raises ValueError"""
        with pytest.raises(ValueError, match="Case not found"):
            repo.delete_case('nonexistent-id')

    def test_get_cases_by_catenda_topic(self, repo):
        """Test finding cases by Catenda topic ID"""
        # Create cases with explicit IDs to avoid timestamp collision
        case1_data = {
            'sak_id': 'TEST-001',
            'catenda_topic_id': 'topic-ABC',
            'sakstittel': 'Test 1'
        }
        case2_data = {
            'sak_id': 'TEST-002',
            'catenda_topic_id': 'topic-XYZ',
            'sakstittel': 'Test 2'
        }

        case_id1 = repo.create_case(case1_data)
        case_id2 = repo.create_case(case2_data)

        # Find by topic
        cases_abc = repo.get_cases_by_catenda_topic('topic-ABC')
        assert len(cases_abc) == 1
        assert cases_abc[0]['sak']['sakstittel'] == 'Test 1'

        cases_xyz = repo.get_cases_by_catenda_topic('topic-XYZ')
        assert len(cases_xyz) == 1
        assert cases_xyz[0]['sak']['sakstittel'] == 'Test 2'

        # Non-existent topic
        cases_none = repo.get_cases_by_catenda_topic('topic-NONE')
        assert len(cases_none) == 0

    def test_historikk_logging(self, repo):
        """Test that history is logged correctly"""
        case_data = {'sakstittel': 'Test'}
        case_id = repo.create_case(case_data)

        # Get history for this case
        historikk = repo.get_historikk(sak_id=case_id)

        # Should have at least one entry from creation
        assert len(historikk) >= 1
        assert historikk[0]['sak_id'] == case_id
        assert historikk[0]['hendelse_type'] == 'sak_opprettet'
