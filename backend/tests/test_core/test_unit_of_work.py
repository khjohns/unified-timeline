"""
Tests for Unit of Work pattern.

Verifiserer at UnitOfWork:
- Committer operasjoner ved suksess
- Ruller tilbake ved exception
- Tracker operasjoner for kompenserende rollback
- Fungerer med InMemoryUnitOfWork for testing
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from dataclasses import dataclass
from datetime import datetime, timezone

from core.unit_of_work import (
    UnitOfWork,
    TrackingUnitOfWork,
    InMemoryUnitOfWork,
    TrackedOperation,
    OperationType,
)
from core.container import Container
from core.config import Settings


# =============================================================================
# Test fixtures and helpers
# =============================================================================

@dataclass
class MockEvent:
    """Mock event for testing."""
    sak_id: str
    event_type: str = "test_event"
    data: dict = None

    def __post_init__(self):
        if self.data is None:
            self.data = {}


@dataclass
class MockMetadata:
    """Mock metadata for testing."""
    sak_id: str
    cached_title: str = "Test"
    created_at: datetime = None
    created_by: str = "test"

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)


@pytest.fixture
def mock_event_repo():
    """Create mock event repository."""
    repo = Mock()
    repo.append = Mock(return_value=1)
    repo.append_batch = Mock(return_value=2)
    repo.get_events = Mock(return_value=([], 0))
    return repo


@pytest.fixture
def mock_metadata_repo():
    """Create mock metadata repository."""
    repo = Mock()
    repo.create = Mock()
    repo.get = Mock(return_value=None)
    repo.delete = Mock(return_value=True)
    repo.update_cache = Mock()
    return repo


@pytest.fixture
def mock_container(mock_event_repo, mock_metadata_repo):
    """Create mock container with mock repositories."""
    container = Container()
    container._event_repo = mock_event_repo
    container._metadata_repo = mock_metadata_repo
    return container


# =============================================================================
# Tests: InMemoryUnitOfWork
# =============================================================================

class TestInMemoryUnitOfWork:
    """Tests for in-memory unit of work (for testing)."""

    def test_commit_persists_events(self):
        """Events should be persisted to store on commit."""
        uow = InMemoryUnitOfWork()
        event = MockEvent(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)
        uow.commit()

        events, version = uow.events.get_events("SAK-001")
        assert len(events) == 1
        assert version == 1

    def test_commit_persists_metadata(self):
        """Metadata should be persisted to store on commit."""
        uow = InMemoryUnitOfWork()
        metadata = MockMetadata(sak_id="SAK-001")

        uow.metadata.create(metadata)
        uow.commit()

        stored = uow.metadata.get("SAK-001")
        assert stored is not None
        assert stored.sak_id == "SAK-001"

    def test_rollback_discards_events(self):
        """Events should be discarded on rollback."""
        uow = InMemoryUnitOfWork()
        event = MockEvent(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)
        uow.rollback()

        events, version = uow.events.get_events("SAK-001")
        assert len(events) == 0
        assert version == 0

    def test_rollback_discards_metadata(self):
        """Metadata should be discarded on rollback."""
        uow = InMemoryUnitOfWork()
        metadata = MockMetadata(sak_id="SAK-001")

        uow.metadata.create(metadata)
        uow.rollback()

        stored = uow.metadata.get("SAK-001")
        assert stored is None

    def test_context_manager_commits_on_success(self):
        """Context manager should commit on successful exit."""
        uow = InMemoryUnitOfWork()
        event = MockEvent(sak_id="SAK-001")

        with uow:
            uow.events.append(event, expected_version=0)

        # Should be committed
        events, _ = uow.events.get_events("SAK-001")
        assert len(events) == 1

    def test_context_manager_rollback_on_exception(self):
        """Context manager should rollback on exception."""
        uow = InMemoryUnitOfWork()
        event = MockEvent(sak_id="SAK-001")

        with pytest.raises(ValueError):
            with uow:
                uow.events.append(event, expected_version=0)
                raise ValueError("Test error")

        # Should be rolled back
        events, _ = uow.events.get_events("SAK-001")
        assert len(events) == 0

    def test_version_conflict_raises_concurrency_error(self):
        """Appending with wrong version should raise ConcurrencyError."""
        from repositories.event_repository import ConcurrencyError

        uow = InMemoryUnitOfWork()
        event = MockEvent(sak_id="SAK-001")

        # First event at version 0 succeeds
        uow.events.append(event, expected_version=0)
        uow.commit()

        # Second event at version 0 should fail
        with pytest.raises(ConcurrencyError) as exc_info:
            uow.events.append(event, expected_version=0)

        assert exc_info.value.expected == 0
        assert exc_info.value.actual == 1


# =============================================================================
# Tests: TrackingUnitOfWork
# =============================================================================

class TestTrackingUnitOfWork:
    """Tests for tracking unit of work (for production)."""

    def test_operations_are_applied_immediately(self, mock_container):
        """Operations should be applied to underlying repositories immediately."""
        uow = TrackingUnitOfWork(mock_container)
        event = MockEvent(sak_id="SAK-001")
        metadata = MockMetadata(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)
        uow.metadata.create(metadata)

        # Should have been called immediately
        mock_container.event_repository.append.assert_called_once()
        mock_container.metadata_repository.create.assert_called_once()

    def test_operations_are_tracked(self, mock_container):
        """Operations should be tracked for potential rollback."""
        uow = TrackingUnitOfWork(mock_container)
        event = MockEvent(sak_id="SAK-001")
        metadata = MockMetadata(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)
        uow.metadata.create(metadata)

        assert len(uow._operations) == 2
        assert uow._operations[0].operation_type == OperationType.EVENT_APPEND
        assert uow._operations[1].operation_type == OperationType.METADATA_CREATE

    def test_commit_clears_operations(self, mock_container):
        """Commit should clear the operations log."""
        uow = TrackingUnitOfWork(mock_container)
        event = MockEvent(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)
        assert len(uow._operations) == 1

        uow.commit()
        assert len(uow._operations) == 0

    def test_rollback_deletes_created_metadata(self, mock_container):
        """Rollback should delete metadata that was created."""
        uow = TrackingUnitOfWork(mock_container)
        metadata = MockMetadata(sak_id="SAK-001")

        uow.metadata.create(metadata)
        uow.rollback()

        # Should have called delete on the underlying repo
        mock_container.metadata_repository.delete.assert_called_once_with("SAK-001")

    def test_rollback_restores_deleted_metadata(self, mock_container):
        """Rollback should restore metadata that was deleted."""
        existing = MockMetadata(sak_id="SAK-001", cached_title="Original")
        mock_container.metadata_repository.get.return_value = existing

        uow = TrackingUnitOfWork(mock_container)
        uow.metadata.delete("SAK-001")
        uow.rollback()

        # Should have called create with the original data
        mock_container.metadata_repository.create.assert_called_once_with(existing)

    def test_context_manager_commits_on_success(self, mock_container):
        """Context manager should commit on successful exit."""
        event = MockEvent(sak_id="SAK-001")

        with TrackingUnitOfWork(mock_container) as uow:
            uow.events.append(event, expected_version=0)

        # Operations should be cleared (committed)
        assert uow._committed is True

    def test_context_manager_rollback_on_exception(self, mock_container):
        """Context manager should rollback on exception."""
        metadata = MockMetadata(sak_id="SAK-001")

        with pytest.raises(ValueError):
            with TrackingUnitOfWork(mock_container) as uow:
                uow.metadata.create(metadata)
                raise ValueError("Test error")

        # Should have rolled back (deleted the metadata)
        mock_container.metadata_repository.delete.assert_called_once_with("SAK-001")

    def test_cannot_commit_after_rollback(self, mock_container):
        """Cannot commit after rollback."""
        uow = TrackingUnitOfWork(mock_container)
        uow.rollback()

        with pytest.raises(RuntimeError, match="Cannot commit after rollback"):
            uow.commit()

    def test_cannot_rollback_after_commit(self, mock_container):
        """Cannot rollback after commit."""
        uow = TrackingUnitOfWork(mock_container)
        uow.commit()

        with pytest.raises(RuntimeError, match="Cannot rollback after commit"):
            uow.rollback()

    def test_get_events_delegates_to_repository(self, mock_container):
        """Read operations should delegate to underlying repository."""
        mock_container.event_repository.get_events.return_value = ([{"test": 1}], 5)

        uow = TrackingUnitOfWork(mock_container)
        events, version = uow.events.get_events("SAK-001")

        assert events == [{"test": 1}]
        assert version == 5
        mock_container.event_repository.get_events.assert_called_once_with("SAK-001")


# =============================================================================
# Tests: Integration with Container
# =============================================================================

class TestContainerUnitOfWork:
    """Tests for Container.create_unit_of_work()."""

    def test_create_unit_of_work_returns_tracking_uow(self, mock_container):
        """Container should create TrackingUnitOfWork."""
        uow = mock_container.create_unit_of_work()

        assert isinstance(uow, TrackingUnitOfWork)

    def test_uow_uses_container_repositories(self, mock_container):
        """UoW should use repositories from container."""
        uow = mock_container.create_unit_of_work()
        event = MockEvent(sak_id="SAK-001")

        uow.events.append(event, expected_version=0)

        mock_container.event_repository.append.assert_called_once()
