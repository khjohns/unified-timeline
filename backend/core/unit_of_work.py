"""
Unit of Work pattern for coordinating repository operations.

Gir atomiske operasjoner på tvers av event- og metadata-repositories.
Erstatter manuell rollback-logikk med strukturert transaksjonshåndtering.

Implementasjoner:
- InMemoryUnitOfWork: For testing - full rollback-støtte
- TrackingUnitOfWork: For produksjon - best-effort kompenserende rollback

Bruk:
    # Enkel bruk med context manager
    with uow:
        uow.metadata.create(metadata)
        uow.events.append(event, expected_version=0)
        # Commit skjer automatisk ved exit
        # Rollback skjer automatisk ved exception

    # Eksplisitt commit/rollback
    uow = TrackingUnitOfWork(container)
    try:
        uow.metadata.create(metadata)
        uow.events.append(event, expected_version=0)
        uow.commit()
    except Exception:
        uow.rollback()
        raise

Begrensninger:
- TrackingUnitOfWork gir "best-effort" rollback via kompenserende operasjoner
- For ekte ACID-transaksjoner med Supabase, bruk PostgreSQL RPC-funksjoner
- Se docs/DATABASE_ARCHITECTURE.md for mer info
"""

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from core.container import Container
    from repositories import EventRepository, SakMetadataRepository


class OperationType(Enum):
    """Type of tracked operation for rollback."""

    METADATA_CREATE = "metadata_create"
    METADATA_UPDATE = "metadata_update"
    METADATA_DELETE = "metadata_delete"
    EVENT_APPEND = "event_append"


@dataclass
class TrackedOperation:
    """
    Record of an operation for potential rollback.

    Attributes:
        operation_type: Type of operation performed
        sak_id: ID of affected case
        data: Operation-specific data for rollback
        rollback_fn: Optional custom rollback function
    """

    operation_type: OperationType
    sak_id: str
    data: Any = None
    rollback_fn: Callable[[], None] | None = None


class UnitOfWork(ABC):
    """
    Abstract Unit of Work for coordinating repository operations.

    Provides transaction-like semantics for operations spanning multiple
    repositories. Use as context manager for automatic commit/rollback.
    """

    @property
    @abstractmethod
    def events(self) -> "EventRepository":
        """Event repository for this unit of work."""
        pass

    @property
    @abstractmethod
    def metadata(self) -> "SakMetadataRepository":
        """Metadata repository for this unit of work."""
        pass

    @abstractmethod
    def commit(self) -> None:
        """
        Commit all operations in this unit of work.

        For in-memory: Flushes to backing store
        For tracking: No-op (operations already applied)
        """
        pass

    @abstractmethod
    def rollback(self) -> None:
        """
        Rollback all operations in this unit of work.

        For in-memory: Discards all changes
        For tracking: Executes compensating operations
        """
        pass

    def __enter__(self) -> "UnitOfWork":
        """Enter context manager."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """
        Exit context manager.

        Commits on success, rolls back on exception.
        Does not suppress exceptions.
        """
        if exc_type is not None:
            self.rollback()
        else:
            self.commit()


class TrackingUnitOfWork(UnitOfWork):
    """
    Unit of Work that tracks operations for compensating rollback.

    Operations are applied immediately to underlying repositories.
    On rollback, compensating operations are executed in reverse order.

    This provides "best-effort" atomicity - not true ACID transactions.
    For guaranteed atomicity, use database-level transactions (PostgreSQL RPC).

    Example:
        container = get_container()
        with TrackingUnitOfWork(container) as uow:
            uow.metadata.create(metadata)
            uow.events.append(event, expected_version=0)
            # If append fails, metadata.delete(sak_id) is called automatically
    """

    def __init__(self, container: "Container"):
        """
        Initialize with DI container.

        Args:
            container: DI container providing repositories
        """
        self._container = container
        self._operations: list[TrackedOperation] = []
        self._committed = False
        self._rolled_back = False

        # Wrap repositories with tracking
        self._events_wrapper = TrackingEventRepository(
            container.event_repository, self._operations
        )
        self._metadata_wrapper = TrackingMetadataRepository(
            container.metadata_repository, self._operations
        )

    @property
    def events(self) -> "TrackingEventRepository":
        """Tracking wrapper around event repository."""
        return self._events_wrapper

    @property
    def metadata(self) -> "TrackingMetadataRepository":
        """Tracking wrapper around metadata repository."""
        return self._metadata_wrapper

    def commit(self) -> None:
        """
        Mark unit of work as committed.

        Operations are already applied, so this just clears the rollback log.
        """
        if self._rolled_back:
            raise RuntimeError("Cannot commit after rollback")
        self._operations.clear()
        self._committed = True

    def rollback(self) -> None:
        """
        Execute compensating operations in reverse order.

        Best-effort: Some compensations may fail if underlying
        repository has issues. Logs errors but continues.
        """
        if self._committed:
            raise RuntimeError("Cannot rollback after commit")

        from utils.logger import get_logger

        logger = get_logger(__name__)

        # Execute compensating operations in reverse order
        for op in reversed(self._operations):
            try:
                if op.rollback_fn:
                    op.rollback_fn()
                else:
                    self._default_rollback(op)
            except Exception as e:
                logger.error(
                    f"Rollback failed for {op.operation_type.value} on {op.sak_id}: {e}"
                )
                # Continue with other rollbacks

        self._operations.clear()
        self._rolled_back = True

    def _default_rollback(self, op: TrackedOperation) -> None:
        """Execute default rollback for operation type."""
        repo = self._container

        if op.operation_type == OperationType.METADATA_CREATE:
            # Compensate create by deleting
            repo.metadata_repository.delete(op.sak_id)

        elif op.operation_type == OperationType.METADATA_DELETE:
            # Compensate delete by re-creating (if we saved the data)
            if op.data:
                repo.metadata_repository.create(op.data)

        elif op.operation_type == OperationType.EVENT_APPEND:
            # Events are immutable - cannot truly rollback
            # Log for manual intervention
            from utils.logger import get_logger

            logger = get_logger(__name__)
            logger.warning(
                f"Cannot rollback event append for {op.sak_id}. "
                f"Event sourcing is append-only. Consider compensating event."
            )


class TrackingEventRepository:
    """
    Wrapper that tracks event operations for rollback.

    Delegates to underlying repository while recording operations.
    """

    def __init__(
        self, repository: "EventRepository", operations: list[TrackedOperation]
    ):
        self._repo = repository
        self._operations = operations

    def append(self, event, expected_version: int, **kwargs) -> int:
        """Append event and track for potential rollback."""
        result = self._repo.append(event, expected_version, **kwargs)

        self._operations.append(
            TrackedOperation(
                operation_type=OperationType.EVENT_APPEND,
                sak_id=event.sak_id,
                data={"event": event, "version": result},
            )
        )

        return result

    def append_batch(self, events: list, expected_version: int, **kwargs) -> int:
        """Append batch and track for potential rollback."""
        result = self._repo.append_batch(events, expected_version, **kwargs)

        if events:
            self._operations.append(
                TrackedOperation(
                    operation_type=OperationType.EVENT_APPEND,
                    sak_id=events[0].sak_id,
                    data={"events": events, "version": result},
                )
            )

        return result

    def get_events(self, sak_id: str, **kwargs):
        """Delegate to underlying repository (read-only)."""
        return self._repo.get_events(sak_id, **kwargs)

    def __getattr__(self, name):
        """Delegate unknown attributes to underlying repository."""
        return getattr(self._repo, name)


class TrackingMetadataRepository:
    """
    Wrapper that tracks metadata operations for rollback.

    Delegates to underlying repository while recording operations.
    """

    def __init__(
        self, repository: "SakMetadataRepository", operations: list[TrackedOperation]
    ):
        self._repo = repository
        self._operations = operations

    def create(self, metadata) -> None:
        """Create metadata and track for potential rollback."""
        self._repo.create(metadata)

        self._operations.append(
            TrackedOperation(
                operation_type=OperationType.METADATA_CREATE,
                sak_id=metadata.sak_id,
                data=metadata,
            )
        )

    def delete(self, sak_id: str) -> bool:
        """Delete metadata and track for potential rollback."""
        # Save current state for potential restore
        existing = self._repo.get(sak_id)

        result = self._repo.delete(sak_id)

        if result:
            self._operations.append(
                TrackedOperation(
                    operation_type=OperationType.METADATA_DELETE,
                    sak_id=sak_id,
                    data=existing,  # Saved for restore on rollback
                )
            )

        return result

    def get(self, sak_id: str):
        """Delegate to underlying repository (read-only)."""
        return self._repo.get(sak_id)

    def update_cache(self, sak_id: str, **kwargs):
        """
        Update cache fields.

        Note: Cache updates are not tracked for rollback as they
        are non-critical and will be recalculated from events.
        """
        return self._repo.update_cache(sak_id, **kwargs)

    def __getattr__(self, name):
        """Delegate unknown attributes to underlying repository."""
        return getattr(self._repo, name)


class InMemoryUnitOfWork(UnitOfWork):
    """
    In-memory Unit of Work for testing.

    All operations are buffered until commit. On rollback, buffer is discarded.
    Provides true atomicity within the unit of work scope.

    Example:
        uow = InMemoryUnitOfWork()
        with uow:
            uow.metadata.create(metadata)
            uow.events.append(event, expected_version=0)
            raise ValueError("Test error")
        # metadata and event are NOT persisted
    """

    def __init__(self):
        """Initialize with in-memory storage."""
        self._events_store: dict = {}  # sak_id -> {"version": int, "events": []}
        self._metadata_store: dict = {}  # sak_id -> SakMetadata
        self._pending_events: list = []
        self._pending_metadata: list = []
        self._committed = False

    @property
    def events(self) -> "InMemoryEventRepository":
        """In-memory event repository."""
        if not hasattr(self, "_events_repo"):
            self._events_repo = InMemoryEventRepository(
                self._events_store, self._pending_events
            )
        return self._events_repo

    @property
    def metadata(self) -> "InMemoryMetadataRepository":
        """In-memory metadata repository."""
        if not hasattr(self, "_metadata_repo"):
            self._metadata_repo = InMemoryMetadataRepository(
                self._metadata_store, self._pending_metadata
            )
        return self._metadata_repo

    def commit(self) -> None:
        """Flush pending operations to in-memory store."""
        # Apply pending events
        for sak_id, event, version in self._pending_events:
            if sak_id not in self._events_store:
                self._events_store[sak_id] = {"version": 0, "events": []}
            self._events_store[sak_id]["events"].append(event)
            self._events_store[sak_id]["version"] = version

        # Apply pending metadata
        for sak_id, metadata in self._pending_metadata:
            self._metadata_store[sak_id] = metadata

        self._pending_events.clear()
        self._pending_metadata.clear()
        self._committed = True

    def rollback(self) -> None:
        """Discard all pending operations."""
        self._pending_events.clear()
        self._pending_metadata.clear()


class InMemoryEventRepository:
    """In-memory event repository for testing."""

    def __init__(self, store: dict, pending: list):
        self._store = store
        self._pending = pending

    def append(self, event, expected_version: int) -> int:
        """Buffer event for commit."""
        sak_id = event.sak_id
        current = self._store.get(sak_id, {"version": 0})["version"]

        # Check version including pending
        pending_for_sak = [p for p in self._pending if p[0] == sak_id]
        if pending_for_sak:
            current = pending_for_sak[-1][2]

        if current != expected_version:
            from repositories.event_repository import ConcurrencyError

            raise ConcurrencyError(expected_version, current)

        new_version = expected_version + 1
        self._pending.append((sak_id, event, new_version))
        return new_version

    def append_batch(self, events: list, expected_version: int) -> int:
        """Buffer batch for commit."""
        version = expected_version
        for event in events:
            version = self.append(event, version)
        return version

    def get_events(self, sak_id: str):
        """Get events including pending."""
        stored = self._store.get(sak_id, {"version": 0, "events": []})
        events = list(stored["events"])
        version = stored["version"]

        # Include pending
        for pid, event, ver in self._pending:
            if pid == sak_id:
                events.append(event)
                version = ver

        return events, version


class InMemoryMetadataRepository:
    """In-memory metadata repository for testing."""

    def __init__(self, store: dict, pending: list):
        self._store = store
        self._pending = pending

    def create(self, metadata) -> None:
        """Buffer metadata for commit."""
        self._pending.append((metadata.sak_id, metadata))

    def get(self, sak_id: str):
        """Get metadata including pending."""
        # Check pending first
        for pid, meta in reversed(self._pending):
            if pid == sak_id:
                return meta
        return self._store.get(sak_id)

    def delete(self, sak_id: str) -> bool:
        """Mark for deletion."""
        # Remove from pending
        self._pending = [(p, m) for p, m in self._pending if p != sak_id]
        if sak_id in self._store:
            del self._store[sak_id]
            return True
        return False

    def update_cache(self, sak_id: str, **kwargs):
        """Update cache on pending or stored metadata."""
        pass  # No-op for testing
