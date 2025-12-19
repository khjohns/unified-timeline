"""
Tests for SakMetadataRepository.
"""
import pytest
import tempfile
import os
from pathlib import Path
from datetime import datetime
from repositories.sak_metadata_repository import SakMetadataRepository
from models.sak_metadata import SakMetadata


class TestSakMetadataRepository:
    """Test the SakMetadataRepository."""

    @pytest.fixture
    def temp_csv(self):
        """Create a temporary CSV file for testing."""
        fd, path = tempfile.mkstemp(suffix='.csv')
        os.close(fd)
        # Delete the file so repository can create it fresh
        os.unlink(path)
        yield path
        # Cleanup
        if os.path.exists(path):
            os.unlink(path)

    @pytest.fixture
    def repo(self, temp_csv):
        """Create a repository instance with temporary storage."""
        return SakMetadataRepository(csv_path=temp_csv)

    @pytest.fixture
    def sample_metadata(self):
        """Create sample metadata for testing."""
        return SakMetadata(
            sak_id="TEST-001",
            prosjekt_id="PROJ-123",
            catenda_topic_id="topic-guid-123",
            catenda_project_id="project-guid-456",
            created_at=datetime(2025, 1, 1, 12, 0, 0),
            created_by="Test User",
            cached_title="Test Case Title",
            cached_status="UTKAST",
            last_event_at=datetime(2025, 1, 1, 12, 30, 0)
        )

    def test_initialization_creates_file_with_headers(self, temp_csv):
        """Test that initialization creates CSV file with correct headers."""
        repo = SakMetadataRepository(csv_path=temp_csv)

        assert Path(temp_csv).exists()

        with open(temp_csv, 'r', encoding='utf-8') as f:
            header_line = f.readline().strip()
            expected_headers = [
                'sak_id', 'prosjekt_id', 'catenda_topic_id',
                'catenda_board_id', 'catenda_project_id', 'created_at', 'created_by',
                'cached_title', 'cached_status', 'last_event_at'
            ]
            assert header_line == ','.join(expected_headers)

    def test_create_metadata_entry(self, repo, sample_metadata):
        """Test creating a new metadata entry."""
        repo.create(sample_metadata)

        # Verify it was created
        retrieved = repo.get("TEST-001")
        assert retrieved is not None
        assert retrieved.sak_id == "TEST-001"
        assert retrieved.prosjekt_id == "PROJ-123"
        assert retrieved.catenda_topic_id == "topic-guid-123"
        assert retrieved.created_by == "Test User"
        assert retrieved.cached_title == "Test Case Title"
        assert retrieved.cached_status == "UTKAST"

    def test_create_metadata_with_optional_fields_none(self, repo):
        """Test creating metadata with optional fields set to None."""
        metadata = SakMetadata(
            sak_id="TEST-002",
            prosjekt_id=None,
            catenda_topic_id=None,
            catenda_project_id=None,
            created_at=datetime(2025, 1, 2, 10, 0, 0),
            created_by="Another User",
            cached_title=None,
            cached_status=None,
            last_event_at=None
        )

        repo.create(metadata)
        retrieved = repo.get("TEST-002")

        assert retrieved is not None
        assert retrieved.sak_id == "TEST-002"
        assert retrieved.prosjekt_id is None
        assert retrieved.catenda_topic_id is None
        assert retrieved.cached_title is None
        assert retrieved.cached_status is None
        assert retrieved.last_event_at is None

    def test_get_nonexistent_case(self, repo):
        """Test getting a case that doesn't exist."""
        result = repo.get("NONEXISTENT")
        assert result is None

    def test_update_cache_title(self, repo, sample_metadata):
        """Test updating cached title."""
        repo.create(sample_metadata)

        # Update title
        new_title = "Updated Title"
        repo.update_cache(
            sak_id="TEST-001",
            cached_title=new_title
        )

        # Verify update
        retrieved = repo.get("TEST-001")
        assert retrieved.cached_title == new_title
        # Other fields should remain unchanged
        assert retrieved.cached_status == "UTKAST"

    def test_update_cache_status(self, repo, sample_metadata):
        """Test updating cached status."""
        repo.create(sample_metadata)

        # Update status
        new_status = "SENDT"
        repo.update_cache(
            sak_id="TEST-001",
            cached_status=new_status
        )

        # Verify update
        retrieved = repo.get("TEST-001")
        assert retrieved.cached_status == new_status
        assert retrieved.cached_title == "Test Case Title"  # Unchanged

    def test_update_cachelast_event_at(self, repo, sample_metadata):
        """Test updating last event timestamp."""
        repo.create(sample_metadata)

        # Update timestamp
        new_timestamp = datetime(2025, 1, 2, 14, 0, 0)
        repo.update_cache(
            sak_id="TEST-001",
            last_event_at=new_timestamp
        )

        # Verify update
        retrieved = repo.get("TEST-001")
        assert retrieved.last_event_at == new_timestamp

    def test_update_cache_multiple_fields(self, repo, sample_metadata):
        """Test updating multiple cached fields at once."""
        repo.create(sample_metadata)

        # Update multiple fields
        new_title = "Multi Update Title"
        new_status = "GODKJENT"
        new_timestamp = datetime(2025, 1, 3, 16, 0, 0)

        repo.update_cache(
            sak_id="TEST-001",
            cached_title=new_title,
            cached_status=new_status,
            last_event_at=new_timestamp
        )

        # Verify all updates
        retrieved = repo.get("TEST-001")
        assert retrieved.cached_title == new_title
        assert retrieved.cached_status == new_status
        assert retrieved.last_event_at == new_timestamp

    def test_update_cache_nonexistent_case(self, repo):
        """Test updating cache for a case that doesn't exist (should not error)."""
        # This should not raise an error, just silently do nothing
        repo.update_cache(
            sak_id="NONEXISTENT",
            cached_title="Should Not Appear"
        )

        result = repo.get("NONEXISTENT")
        assert result is None

    def test_list_all_empty(self, repo):
        """Test listing when no cases exist."""
        cases = repo.list_all()
        assert cases == []

    def test_list_all_single_case(self, repo, sample_metadata):
        """Test listing with a single case."""
        repo.create(sample_metadata)

        cases = repo.list_all()
        assert len(cases) == 1
        assert cases[0].sak_id == "TEST-001"

    def test_list_all_multiple_cases(self, repo):
        """Test listing with multiple cases."""
        # Create multiple cases
        for i in range(5):
            metadata = SakMetadata(
                sak_id=f"TEST-{i:03d}",
                prosjekt_id=f"PROJ-{i}",
                catenda_topic_id=None,
                catenda_project_id=None,
                created_at=datetime(2025, 1, i+1, 12, 0, 0),
                created_by=f"User {i}",
                cached_title=f"Case {i}",
                cached_status="UTKAST",
                last_event_at=None
            )
            repo.create(metadata)

        cases = repo.list_all()
        assert len(cases) == 5

        # Verify all case IDs are present
        case_ids = [c.sak_id for c in cases]
        for i in range(5):
            assert f"TEST-{i:03d}" in case_ids

    def test_thread_safety_concurrent_updates(self, repo, sample_metadata):
        """Test that concurrent updates are thread-safe."""
        import threading

        repo.create(sample_metadata)

        def update_title(title_suffix):
            repo.update_cache(
                sak_id="TEST-001",
                cached_title=f"Title {title_suffix}"
            )

        # Run multiple concurrent updates
        threads = []
        for i in range(10):
            t = threading.Thread(target=update_title, args=(i,))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        # Should not crash or corrupt data
        retrieved = repo.get("TEST-001")
        assert retrieved is not None
        assert "Title" in retrieved.cached_title

    def test_csv_format_is_correct(self, repo, sample_metadata):
        """Test that CSV file has correct format."""
        repo.create(sample_metadata)

        # Read the CSV file directly
        with open(repo.csv_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        # Should have header + 1 data row
        assert len(lines) == 2

        # Verify header
        assert 'sak_id' in lines[0]
        assert 'cached_title' in lines[0]

        # Verify data row contains expected values
        assert 'TEST-001' in lines[1]
        assert 'Test User' in lines[1]
