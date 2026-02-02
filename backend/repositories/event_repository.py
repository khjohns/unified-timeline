"""
Event store with optimistic concurrency control.

Platform: Requires Linux/macOS/WSL2 (uses fcntl for file locking)
"""

import fcntl  # Unix-only - see platform requirements
import json
import os
from abc import ABC, abstractmethod
from pathlib import Path


class ConcurrencyError(Exception):
    """Kastes når expected_version ikke matcher faktisk versjon."""

    def __init__(self, expected: int, actual: int):
        self.expected = expected
        self.actual = actual
        super().__init__(f"Versjonskonflikt: forventet {expected}, fikk {actual}")


class EventRepository(ABC):
    """Abstract event store with optimistic locking."""

    @abstractmethod
    def append(self, event, expected_version: int) -> int:
        """
        Append event with optimistic concurrency control.

        Args:
            event: The event to append
            expected_version: Expected current version (0 for new case)

        Returns:
            New version number

        Raises:
            ConcurrencyError: If expected_version != current version
        """
        pass

    @abstractmethod
    def append_batch(self, events: list, expected_version: int) -> int:
        """
        Atomically append multiple events.

        All events must be for the same sak_id.
        Either all succeed or none are persisted.
        """
        pass

    @abstractmethod
    def get_events(self, sak_id: str) -> tuple[list, int]:
        """
        Get all events and current version for a case.

        Returns:
            Tuple of (events_list, current_version)
        """
        pass


class JsonFileEventRepository(EventRepository):
    """
    JSON file-based event store with file locking.

    Storage format per case:
    {
        "version": 5,
        "events": [...]
    }
    """

    def __init__(self, base_path: str = "koe_data/events"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, sak_id: str) -> Path:
        # Sanitize sak_id for filesystem
        safe_id = sak_id.replace("/", "_").replace("\\", "_")
        return self.base_path / f"{safe_id}.json"

    def _load_with_lock(self, sak_id: str) -> tuple[dict, any]:
        """Load data with exclusive lock, returns (data, file_handle)."""
        file_path = self._get_file_path(sak_id)

        if not file_path.exists():
            return {"version": 0, "events": []}, None

        f = open(file_path, "r+", encoding="utf-8")
        fcntl.flock(f.fileno(), fcntl.LOCK_EX)
        data = json.load(f)
        return data, f

    def append(self, event, expected_version: int) -> int:
        return self.append_batch([event], expected_version)

    def append_batch(self, events: list, expected_version: int) -> int:
        """
        Atomic batch append with optimistic locking.

        Uses file locking to ensure atomicity.
        """
        if not events:
            raise ValueError("Kan ikke legge til tom event-liste")

        sak_id = events[0].sak_id
        if not all(e.sak_id == sak_id for e in events):
            raise ValueError("Alle events må tilhøre samme sak_id")

        file_path = self._get_file_path(sak_id)

        # Create new file for version 0
        if expected_version == 0:
            if file_path.exists():
                raise ConcurrencyError(0, self._get_current_version(sak_id))

            data = {
                "version": len(events),
                "events": [e.model_dump(mode="json") for e in events],
            }

            # Write atomically
            temp_path = file_path.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            temp_path.rename(file_path)

            return len(events)

        # Existing file - lock and update
        data, f = self._load_with_lock(sak_id)

        try:
            current_version = data.get("version", 0)

            if current_version != expected_version:
                raise ConcurrencyError(expected_version, current_version)

            # Append events
            for event in events:
                data["events"].append(event.model_dump(mode="json"))

            new_version = current_version + len(events)
            data["version"] = new_version

            # Write directly to locked file handle
            f.seek(0)
            f.truncate()
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
            f.flush()
            os.fsync(f.fileno())  # Ensure data is written to disk

            return new_version

        finally:
            if f:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)
                f.close()

    def get_events(self, sak_id: str) -> tuple[list[dict], int]:
        """
        Get all events and current version for a case.

        Returns:
            Tuple of (events_list as dicts, current_version)
        """
        file_path = self._get_file_path(sak_id)

        if not file_path.exists():
            return [], 0

        # Use shared lock for reading to prevent reading during writes
        with open(file_path, encoding="utf-8") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                data = json.load(f)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

        events = data.get("events", [])
        version = data.get("version", len(events))

        return events, version

    def _get_current_version(self, sak_id: str) -> int:
        _, version = self.get_events(sak_id)
        return version

    def find_sak_id_by_catenda_topic(self, catenda_topic_id: str) -> str | None:
        """
        Find local sak_id given a Catenda topic GUID.

        Scans all event files and checks the SAK_OPPRETTET event for
        matching catenda_topic_id.

        Args:
            catenda_topic_id: Catenda topic GUID to look up

        Returns:
            Local sak_id if found, None otherwise
        """
        if not catenda_topic_id:
            return None

        # Scan all event files
        for file_path in self.base_path.glob("*.json"):
            try:
                with open(file_path, encoding="utf-8") as f:
                    data = json.load(f)

                events = data.get("events", [])
                if not events:
                    continue

                # Check first event (SAK_OPPRETTET)
                first_event = events[0]
                if first_event.get("catenda_topic_id") == catenda_topic_id:
                    return first_event.get("sak_id")

            except Exception:
                continue

        return None

    def list_all_sak_ids(self) -> list[str]:
        """
        List all sak_ids in the repository.

        Returns:
            List of sak_id strings
        """
        sak_ids = []
        for file_path in self.base_path.glob("*.json"):
            # Extract sak_id from filename
            sak_id = file_path.stem
            sak_ids.append(sak_id)
        return sak_ids
