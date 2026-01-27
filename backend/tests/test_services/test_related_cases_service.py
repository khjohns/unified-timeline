"""
Tests for RelatedCasesService.

This service provides shared functionality for fetching state and events
from related cases, used by both ForseringService and EndringsordreService.
"""
import pytest
from unittest.mock import Mock, MagicMock, patch

from services.related_cases_service import RelatedCasesService
from models.sak_state import SakState


class TestRelatedCasesService:
    """Test suite for RelatedCasesService."""

    @pytest.fixture
    def mock_event_repository(self):
        """Create mock event repository."""
        repo = Mock()
        repo.get_events = Mock(return_value=([], 0))
        return repo

    @pytest.fixture
    def mock_timeline_service(self):
        """Create mock timeline service."""
        service = Mock()
        service.compute_state = Mock(return_value=SakState(
            sak_id="TEST-001",
            sakstittel="Test Case"
        ))
        return service

    @pytest.fixture
    def service(self, mock_event_repository, mock_timeline_service):
        """Create RelatedCasesService with mocked dependencies."""
        return RelatedCasesService(
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )

    # ========================================================================
    # Test: Initialization
    # ========================================================================

    def test_initialization_with_dependencies(self, mock_event_repository, mock_timeline_service):
        """Test service initializes with dependencies."""
        service = RelatedCasesService(
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )
        assert service.event_repository is not None
        assert service.timeline_service is not None

    def test_initialization_without_dependencies(self):
        """Test service can initialize without dependencies."""
        service = RelatedCasesService()
        assert service.event_repository is None
        assert service.timeline_service is None

    # ========================================================================
    # Test: hent_state_fra_saker
    # ========================================================================

    @patch('services.related_cases_service.parse_event')
    def test_hent_state_fra_saker_success(self, mock_parse_event, service, mock_event_repository, mock_timeline_service):
        """Test successful state fetching for multiple cases."""
        # Arrange - return raw dicts from repository, parse_event is mocked
        mock_events = [{"event_type": "grunnlag_opprettet"}, {"event_type": "vederlag_krav_sendt"}]
        mock_event_repository.get_events.return_value = (mock_events, 1)
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"))

        mock_state = SakState(sak_id="SAK-001", sakstittel="Test")
        mock_timeline_service.compute_state.return_value = mock_state

        # Act
        result = service.hent_state_fra_saker(["SAK-001", "SAK-002"])

        # Assert
        assert len(result) == 2
        assert "SAK-001" in result
        assert "SAK-002" in result
        assert mock_event_repository.get_events.call_count == 2

    def test_hent_state_fra_saker_empty_list(self, service):
        """Test with empty sak list."""
        result = service.hent_state_fra_saker([])
        assert result == {}

    @patch('services.related_cases_service.parse_event')
    def test_hent_state_fra_saker_handles_errors(self, mock_parse_event, service, mock_event_repository, mock_timeline_service):
        """Test that errors for individual cases don't crash the whole operation."""
        # Arrange - first call succeeds, second fails
        mock_event = {"event_type": "grunnlag_opprettet"}
        mock_event_repository.get_events.side_effect = [
            ([mock_event], 1),
            Exception("Database error")
        ]
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"))
        mock_timeline_service.compute_state.return_value = SakState(sak_id="SAK-001", sakstittel="Test")

        # Act
        result = service.hent_state_fra_saker(["SAK-001", "SAK-002"])

        # Assert - should have one result, not crash
        assert len(result) == 1
        assert "SAK-001" in result

    def test_hent_state_fra_saker_skips_empty_events(self, service, mock_event_repository):
        """Test that cases with no events are skipped."""
        # Arrange - return empty events list
        mock_event_repository.get_events.return_value = ([], 0)

        # Act
        result = service.hent_state_fra_saker(["SAK-001"])

        # Assert - no state computed for empty events
        assert len(result) == 0

    def test_hent_state_without_repository(self):
        """Test returns empty when no repository configured."""
        service = RelatedCasesService()
        result = service.hent_state_fra_saker(["SAK-001"])
        assert result == {}

    # ========================================================================
    # Test: hent_hendelser_fra_saker
    # ========================================================================

    @patch('services.related_cases_service.parse_event')
    def test_hent_hendelser_fra_saker_success(self, mock_parse_event, service, mock_event_repository):
        """Test successful event fetching for multiple cases."""
        # Arrange
        mock_events = [{"event_type": "grunnlag_opprettet"}, {"event_type": "vederlag_krav_sendt"}]
        mock_event_repository.get_events.return_value = (mock_events, 1)
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"), spor="grunnlag")

        # Act
        result = service.hent_hendelser_fra_saker(["SAK-001", "SAK-002"])

        # Assert
        assert len(result) == 2
        assert "SAK-001" in result
        assert "SAK-002" in result
        assert len(result["SAK-001"]) == 2

    @patch('services.related_cases_service.parse_event')
    def test_hent_hendelser_fra_saker_with_spor_filter(self, mock_parse_event, service, mock_event_repository):
        """Test filtering events by spor."""
        # Arrange - mock events as dicts
        mock_events = [
            {"event_type": "grunnlag_opprettet"},
            {"event_type": "vederlag_krav_sendt"},
            {"event_type": "frist_krav_sendt"}
        ]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        # parse_event returns mocks with appropriate spor attributes
        def make_parsed_event(e):
            event_type = e.get("event_type")
            if event_type.startswith("grunnlag"):
                return Mock(event_type=event_type, spor="grunnlag")
            elif event_type.startswith("vederlag"):
                return Mock(event_type=event_type, spor="vederlag")
            else:
                return Mock(event_type=event_type, spor="frist")
        mock_parse_event.side_effect = make_parsed_event

        # Act
        result = service.hent_hendelser_fra_saker(
            ["SAK-001"],
            spor_filter=["grunnlag", "frist"]
        )

        # Assert
        assert len(result["SAK-001"]) == 2

    def test_hent_hendelser_fra_saker_empty_list(self, service):
        """Test with empty sak list."""
        result = service.hent_hendelser_fra_saker([])
        assert result == {}

    def test_hent_hendelser_fra_saker_handles_errors(self, service, mock_event_repository):
        """Test that errors for individual cases return empty list for that case."""
        # Arrange
        mock_event_repository.get_events.side_effect = Exception("Database error")

        # Act
        result = service.hent_hendelser_fra_saker(["SAK-001"])

        # Assert - should return empty list, not crash
        assert "SAK-001" in result
        assert result["SAK-001"] == []

    def test_hent_hendelser_without_repository(self):
        """Test returns empty when no repository configured."""
        service = RelatedCasesService()
        result = service.hent_hendelser_fra_saker(["SAK-001"])
        assert result == {}

    # ========================================================================
    # Test: get_related_cases_context
    # ========================================================================

    @patch('services.related_cases_service.parse_event')
    def test_get_related_cases_context_returns_both(self, mock_parse_event, service, mock_event_repository, mock_timeline_service):
        """Test that context returns both states and events."""
        # Arrange
        mock_events = [{"event_type": "grunnlag_opprettet", "spor": "grunnlag"}]
        mock_event_repository.get_events.return_value = (mock_events, 1)
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"))
        mock_state = SakState(sak_id="SAK-001", sakstittel="Test")
        mock_timeline_service.compute_state.return_value = mock_state

        # Act
        states, hendelser = service.get_related_cases_context(["SAK-001"])

        # Assert
        assert "SAK-001" in states
        assert "SAK-001" in hendelser

    @patch('services.related_cases_service.parse_event')
    def test_get_related_cases_context_with_filter(self, mock_parse_event, service, mock_event_repository, mock_timeline_service):
        """Test context with spor filter."""
        # Arrange - events as dicts that will be parsed
        mock_events = [{"event_type": "grunnlag_opprettet"}]
        mock_event_repository.get_events.return_value = (mock_events, 1)
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"), spor="grunnlag")
        mock_timeline_service.compute_state.return_value = SakState(sak_id="SAK-001")

        # Act
        states, hendelser = service.get_related_cases_context(
            ["SAK-001"],
            spor_filter=["grunnlag"]
        )

        # Assert
        assert len(hendelser["SAK-001"]) == 1

    # ========================================================================
    # Test: hent_egne_hendelser
    # ========================================================================

    @patch('services.related_cases_service.parse_event')
    def test_hent_egne_hendelser_success(self, mock_parse_event, service, mock_event_repository):
        """Test fetching events for a single case."""
        # Arrange
        mock_events = [{"event_type": "grunnlag_opprettet"}, {"event_type": "vederlag_krav_sendt"}]
        mock_event_repository.get_events.return_value = (mock_events, 1)
        mock_parse_event.side_effect = lambda e: Mock(event_type=e.get("event_type"))

        # Act
        result = service.hent_egne_hendelser("SAK-001")

        # Assert
        assert len(result) == 2
        mock_event_repository.get_events.assert_called_once_with("SAK-001")

    def test_hent_egne_hendelser_handles_error(self, service, mock_event_repository):
        """Test returns empty list on error."""
        # Arrange
        mock_event_repository.get_events.side_effect = Exception("Error")

        # Act
        result = service.hent_egne_hendelser("SAK-001")

        # Assert
        assert result == []

    def test_hent_egne_hendelser_without_repository(self):
        """Test returns empty when no repository configured."""
        service = RelatedCasesService()
        result = service.hent_egne_hendelser("SAK-001")
        assert result == []
