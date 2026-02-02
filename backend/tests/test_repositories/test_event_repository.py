"""
Tests for Event Repository with optimistic concurrency control.

CRITICAL: These tests verify data integrity under concurrent access.
"""

import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest

from models.events import GrunnlagData, GrunnlagEvent, SakOpprettetEvent
from repositories.event_repository import ConcurrencyError, JsonFileEventRepository


class TestEventRepository:
    """Test the Event Repository."""

    @pytest.fixture
    def temp_dir(self):
        """Create a temporary directory for event storage."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def repo(self, temp_dir):
        """Create a repository instance with temporary storage."""
        return JsonFileEventRepository(base_path=temp_dir)

    @pytest.fixture
    def sample_event(self):
        """Create a sample event for testing."""
        return SakOpprettetEvent(
            sak_id="TEST-001",
            aktor="Test User",
            aktor_rolle="TE",
            sakstittel="Test Case",
            prosjekt_id="PROJ-001",
        )

    def test_append_single_event_new_case(self, repo, sample_event):
        """Test appending a single event to a new case."""
        new_version = repo.append(sample_event, expected_version=0)

        assert new_version == 1

        # Verify event was stored
        events, version = repo.get_events("TEST-001")
        assert len(events) == 1
        assert version == 1
        assert events[0]["sak_id"] == "TEST-001"

    def test_append_batch_events(self, repo):
        """Test appending multiple events atomically."""
        events = [
            SakOpprettetEvent(
                sak_id="TEST-002",
                aktor="User1",
                aktor_rolle="TE",
                sakstittel="Batch Test",
            ),
            GrunnlagEvent(
                sak_id="TEST-002",
                aktor="User1",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Risiko",
                    underkategori="Grunnforhold",
                    beskrivelse="Test beskrivelse",
                    dato_oppdaget="2025-01-01",
                ),
            ),
        ]

        new_version = repo.append_batch(events, expected_version=0)

        assert new_version == 2

        # Verify events
        retrieved_events, version = repo.get_events("TEST-002")
        assert len(retrieved_events) == 2
        assert version == 2

    def test_append_rejects_wrong_expected_version(self, repo, sample_event):
        """Test that appending with wrong expected_version raises error."""
        # Create initial event
        repo.append(sample_event, expected_version=0)

        # Try to append with wrong version
        new_event = GrunnlagEvent(
            sak_id="TEST-001",
            aktor="User2",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test grunnlag",
                hovedkategori="Test",
                underkategori="Test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-01",
            ),
        )

        with pytest.raises(ConcurrencyError) as exc_info:
            repo.append(new_event, expected_version=0)  # Should be 1

        assert exc_info.value.expected == 0
        assert exc_info.value.actual == 1

    def test_append_with_correct_version_succeeds(self, repo, sample_event):
        """Test that appending with correct version succeeds."""
        # Create initial event
        v1 = repo.append(sample_event, expected_version=0)
        assert v1 == 1

        # Append with correct version
        new_event = GrunnlagEvent(
            sak_id="TEST-001",
            aktor="User2",
            aktor_rolle="TE",
            data=GrunnlagData(
                tittel="Test grunnlag",
                hovedkategori="Test",
                underkategori="Test",
                beskrivelse="Test",
                dato_oppdaget="2025-01-01",
            ),
        )

        v2 = repo.append(new_event, expected_version=1)
        assert v2 == 2

        # Verify both events are present
        events, version = repo.get_events("TEST-001")
        assert len(events) == 2
        assert version == 2

    def test_get_events_nonexistent_case(self, repo):
        """Test getting events for a case that doesn't exist."""
        events, version = repo.get_events("NONEXISTENT")

        assert events == []
        assert version == 0

    def test_concurrent_writes_are_detected(self, repo):
        """
        CRITICAL TEST: Verify that concurrent writes are properly detected.

        This tests the core optimistic concurrency control mechanism.
        """
        # Create initial case
        initial_event = SakOpprettetEvent(
            sak_id="TEST-CONCURRENT",
            aktor="InitialUser",
            aktor_rolle="TE",
            sakstittel="Concurrency Test",
        )
        repo.append(initial_event, expected_version=0)

        def concurrent_write(event_data):
            """Attempt to write with expected_version=1."""
            event = GrunnlagEvent(
                sak_id="TEST-CONCURRENT",
                aktor=f"User-{event_data}",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel=f"Test grunnlag {event_data}",
                    hovedkategori="Test",
                    underkategori="Test",
                    beskrivelse=f"Event {event_data}",
                    dato_oppdaget="2025-01-01",
                ),
            )
            try:
                return repo.append(event, expected_version=1)
            except ConcurrencyError as e:
                return e

        # Run 5 concurrent writes
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(concurrent_write, i) for i in range(5)]
            results = [future.result() for future in as_completed(futures)]

        # Count successes and conflicts
        successes = [r for r in results if isinstance(r, int)]
        conflicts = [r for r in results if isinstance(r, ConcurrencyError)]

        # Exactly ONE should succeed, others should conflict
        assert len(successes) == 1, f"Expected 1 success, got {len(successes)}"
        assert len(conflicts) == 4, f"Expected 4 conflicts, got {len(conflicts)}"

        # Verify final state
        events, version = repo.get_events("TEST-CONCURRENT")
        assert version == 2  # Initial + 1 successful write
        assert len(events) == 2

    def test_batch_events_must_have_same_sak_id(self, repo):
        """Test that batch events must all belong to the same case."""
        events = [
            SakOpprettetEvent(
                sak_id="TEST-003", aktor="User1", aktor_rolle="TE", sakstittel="Test"
            ),
            GrunnlagEvent(
                sak_id="TEST-004",  # Different sak_id!
                aktor="User1",
                aktor_rolle="TE",
                data=GrunnlagData(
                    tittel="Test grunnlag",
                    hovedkategori="Test",
                    underkategori="Test",
                    beskrivelse="Test",
                    dato_oppdaget="2025-01-01",
                ),
            ),
        ]

        with pytest.raises(ValueError, match="samme sak_id"):
            repo.append_batch(events, expected_version=0)

    def test_cannot_append_empty_batch(self, repo):
        """Test that appending empty event list raises error."""
        with pytest.raises(ValueError, match="tom event-liste"):
            repo.append_batch([], expected_version=0)

    def test_file_path_sanitization(self, repo):
        """Test that sak_id is properly sanitized for filesystem."""
        # Create event with potentially problematic ID
        event = SakOpprettetEvent(
            sak_id="TEST/WITH\\SLASHES",
            aktor="User",
            aktor_rolle="TE",
            sakstittel="Test",
        )

        repo.append(event, expected_version=0)

        # Should create file without slashes
        file_path = repo._get_file_path("TEST/WITH\\SLASHES")
        assert "/" not in file_path.name
        assert "\\" not in file_path.name
        assert file_path.exists()

    def test_events_are_never_lost(self, repo):
        """
        CRITICAL TEST: Verify that events are never lost during concurrent writes.

        Even if conflicts occur, all successfully appended events must be persisted.
        """
        # Create initial case
        initial_event = SakOpprettetEvent(
            sak_id="TEST-INTEGRITY",
            aktor="InitialUser",
            aktor_rolle="TE",
            sakstittel="Integrity Test",
        )
        repo.append(initial_event, expected_version=0)

        successful_appends = []

        def append_with_retry(event_num):
            """Append event, retrying on concurrency errors."""
            max_retries = 10
            for attempt in range(max_retries):
                _, current_version = repo.get_events("TEST-INTEGRITY")
                event = GrunnlagEvent(
                    sak_id="TEST-INTEGRITY",
                    aktor=f"User-{event_num}",
                    aktor_rolle="TE",
                    data=GrunnlagData(
                        tittel=f"Test grunnlag {event_num}",
                        hovedkategori=f"Cat-{event_num}",
                        underkategori="Test",
                        beskrivelse=f"Event {event_num}",
                        dato_oppdaget="2025-01-01",
                    ),
                )
                try:
                    repo.append(event, expected_version=current_version)
                    return event_num
                except ConcurrencyError:
                    continue
            raise Exception(f"Failed after {max_retries} retries")

        # Run 10 concurrent writes with retry
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(append_with_retry, i) for i in range(10)]
            for future in as_completed(futures):
                successful_appends.append(future.result())

        # All 10 should succeed (with retries)
        assert len(successful_appends) == 10

        # Verify final state: initial + 10 events = 11 total
        events, version = repo.get_events("TEST-INTEGRITY")
        assert len(events) == 11
        assert version == 11

        # Verify all categories are present
        categories = [e["data"]["hovedkategori"] for e in events[1:]]  # Skip initial
        assert len(set(categories)) == 10  # All unique

    def test_json_file_format(self, repo, sample_event):
        """Test that JSON file has correct format."""
        repo.append(sample_event, expected_version=0)

        file_path = repo._get_file_path("TEST-001")
        with open(file_path) as f:
            data = json.load(f)

        assert "version" in data
        assert "events" in data
        assert data["version"] == 1
        assert len(data["events"]) == 1
        assert data["events"][0]["sak_id"] == "TEST-001"


import json


class TestConcurrencyError:
    """Test the ConcurrencyError exception."""

    def test_concurrency_error_attributes(self):
        """Test that ConcurrencyError has correct attributes."""
        error = ConcurrencyError(expected=5, actual=7)

        assert error.expected == 5
        assert error.actual == 7
        assert "5" in str(error)
        assert "7" in str(error)
