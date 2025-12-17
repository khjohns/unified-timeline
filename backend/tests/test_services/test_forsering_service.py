"""
Tests for ForseringService.

This service handles forsering cases (§33.8 NS 8407).
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime

from services.forsering_service import ForseringService
from models.sak_state import SakState, SakRelasjon, ForseringData, FristTilstand


class TestForseringService:
    """Test suite for ForseringService."""

    @pytest.fixture
    def mock_catenda_client(self):
        """Create mock Catenda client."""
        client = Mock()
        client.topic_board_id = "board-123"
        client.create_topic = Mock(return_value={'guid': 'forsering-001', 'title': 'Forsering'})
        client.create_topic_relations = Mock(return_value=True)
        client.list_related_topics = Mock(return_value=[])
        client.get_topic_details = Mock(return_value={'title': 'Related Case', 'guid': 'related-001'})
        client.list_topics = Mock(return_value=[])
        return client

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
    def service(self, mock_catenda_client, mock_event_repository, mock_timeline_service):
        """Create ForseringService with mocked dependencies."""
        return ForseringService(
            catenda_client=mock_catenda_client,
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )

    # ========================================================================
    # Test: Initialization
    # ========================================================================

    def test_initialization_with_client(self, mock_catenda_client, mock_event_repository, mock_timeline_service):
        """Test service initializes with Catenda client."""
        service = ForseringService(
            catenda_client=mock_catenda_client,
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )
        assert service.is_configured() is True

    def test_initialization_without_client(self):
        """Test service can initialize without client."""
        service = ForseringService()
        assert service.is_configured() is False

    # ========================================================================
    # Test: opprett_forseringssak
    # ========================================================================

    def test_opprett_forseringssak_success(self, service, mock_catenda_client):
        """Test successful forsering case creation."""
        # Act - 10 days * 10000 * 1.3 = 130000, so 100000 is within limit
        result = service.opprett_forseringssak(
            avslatte_sak_ids=["SAK-001", "SAK-002"],
            estimert_kostnad=100000.0,
            dagmulktsats=10000.0,
            begrunnelse="Test begrunnelse",
            avslatte_dager=10
        )

        # Assert
        assert result["sak_id"] == "forsering-001"
        assert result["sakstype"] == "forsering"
        assert len(result["relaterte_saker"]) == 2
        mock_catenda_client.create_topic.assert_called_once()
        mock_catenda_client.create_topic_relations.assert_called_once()

    def test_opprett_forseringssak_without_client(self, mock_event_repository, mock_timeline_service):
        """Test forsering creation returns mock data without client."""
        service = ForseringService(
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )

        result = service.opprett_forseringssak(
            avslatte_sak_ids=["SAK-001"],
            estimert_kostnad=100000.0,
            dagmulktsats=10000.0,
            begrunnelse="Test",
            avslatte_dager=10  # 10 * 10000 * 1.3 = 130000 max
        )

        # Should return mock data
        assert "sak_id" in result
        assert result["sakstype"] == "forsering"

    def test_opprett_forseringssak_validation_empty_saker(self, service):
        """Test validation requires at least one sak."""
        with pytest.raises(ValueError, match="minst én"):
            service.opprett_forseringssak(
                avslatte_sak_ids=[],
                estimert_kostnad=100000.0,
                dagmulktsats=10000.0,
                begrunnelse="Test",
                avslatte_dager=10
            )

    def test_opprett_forseringssak_validation_over_30_percent(self, service):
        """Test validation rejects cost over 30% limit."""
        # 10 days * 10000 * 1.3 = 130000 max, so 200000 should fail
        with pytest.raises(ValueError, match="overstiger"):
            service.opprett_forseringssak(
                avslatte_sak_ids=["SAK-001"],
                estimert_kostnad=200000.0,
                dagmulktsats=10000.0,
                begrunnelse="Test",
                avslatte_dager=10
            )

    # ========================================================================
    # Test: hent_relaterte_saker
    # ========================================================================

    def test_hent_relaterte_saker_success(self, service, mock_catenda_client):
        """Test fetching related cases."""
        # Arrange
        mock_catenda_client.list_related_topics.return_value = [
            {'related_topic_guid': 'SAK-001'},
            {'related_topic_guid': 'SAK-002'}
        ]
        mock_catenda_client.get_topic_details.return_value = {
            'title': 'Related Case',
            'guid': 'SAK-001'
        }

        # Act
        result = service.hent_relaterte_saker("forsering-001")

        # Assert
        assert len(result) == 2
        assert all(isinstance(r, SakRelasjon) for r in result)

    def test_hent_relaterte_saker_without_client(self):
        """Test returns empty list without client."""
        service = ForseringService()
        result = service.hent_relaterte_saker("forsering-001")
        assert result == []

    # ========================================================================
    # Test: valider_30_prosent_regel
    # ========================================================================

    def test_valider_30_prosent_regel_innenfor(self, service):
        """Test 30% rule validation when within limit."""
        # 15 days * 10000 kr/day * 1.3 = 195000 kr max
        result = service.valider_30_prosent_regel(
            estimert_kostnad=150000.0,
            avslatte_dager=15,
            dagmulktsats=10000.0
        )

        assert result["er_gyldig"] is True
        assert result["maks_kostnad"] == 195000.0
        assert result["differanse"] < 0  # Under limit
        assert result["prosent_av_maks"] < 100

    def test_valider_30_prosent_regel_over(self, service):
        """Test 30% rule validation when over limit."""
        # 10 days * 10000 kr/day * 1.3 = 130000 kr max
        result = service.valider_30_prosent_regel(
            estimert_kostnad=200000.0,
            avslatte_dager=10,
            dagmulktsats=10000.0
        )

        assert result["er_gyldig"] is False
        assert result["maks_kostnad"] == 130000.0
        assert result["differanse"] > 0  # Over limit
        assert result["prosent_av_maks"] > 100

    def test_valider_30_prosent_regel_exactly_at_limit(self, service):
        """Test 30% rule at exactly the limit."""
        # 10 days * 10000 kr/day * 1.3 = 130000 kr max
        result = service.valider_30_prosent_regel(
            estimert_kostnad=130000.0,
            avslatte_dager=10,
            dagmulktsats=10000.0
        )

        assert result["er_gyldig"] is True
        assert result["differanse"] == 0

    def test_valider_30_prosent_regel_breakdown(self, service):
        """Test that breakdown values are correct."""
        result = service.valider_30_prosent_regel(
            estimert_kostnad=100000.0,
            avslatte_dager=10,
            dagmulktsats=10000.0
        )

        assert result["dagmulkt_grunnlag"] == 100000.0  # 10 * 10000
        assert result["tillegg_30_prosent"] == 30000.0  # 100000 * 0.3

    # ========================================================================
    # Test: hent_komplett_forseringskontekst
    # ========================================================================

    def test_hent_komplett_forseringskontekst_success(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test fetching complete forsering context."""
        # Arrange
        mock_catenda_client.list_related_topics.return_value = [
            {'related_topic_guid': 'SAK-001'}
        ]
        mock_catenda_client.get_topic_details.return_value = {
            'title': 'Related Case',
            'guid': 'SAK-001'
        }

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="SAK-001",
            sakstittel="Test",
            frist=FristTilstand(
                status="avslatt",
                bh_resultat="avslatt",
                krevd_dager=10
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        # Act
        result = service.hent_komplett_forseringskontekst("forsering-001")

        # Assert
        assert "relaterte_saker" in result
        assert "sak_states" in result
        assert "hendelser" in result
        assert "oppsummering" in result

    def test_hent_komplett_forseringskontekst_no_related(self, service, mock_catenda_client):
        """Test context when no related cases."""
        # Arrange
        mock_catenda_client.list_related_topics.return_value = []

        # Act
        result = service.hent_komplett_forseringskontekst("forsering-001")

        # Assert
        assert result["relaterte_saker"] == []
        assert result["sak_states"] == {}
        assert result["hendelser"] == {}

    # ========================================================================
    # Test: finn_forseringer_for_sak
    # ========================================================================

    def test_finn_forseringer_for_sak_found(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test finding forseringer that reference a KOE case."""
        # Arrange
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'forsering-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="forsering-001",
            sakstittel="Test Forsering",
            sakstype="forsering",
            forsering_data=ForseringData(
                avslatte_fristkrav=["SAK-001", "SAK-002"],
                dato_varslet="2025-01-15",
                estimert_kostnad=150000.0,
                dagmulktsats=10000.0
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        # Act
        result = service.finn_forseringer_for_sak("SAK-001")

        # Assert
        assert len(result) == 1
        assert result[0]["forsering_sak_id"] == "forsering-001"

    def test_finn_forseringer_for_sak_not_found(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test when no forseringer reference the KOE case."""
        # Arrange
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'forsering-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="forsering-001",
            sakstittel="Test Forsering",
            sakstype="forsering",
            forsering_data=ForseringData(
                avslatte_fristkrav=["SAK-999"],  # Different case
                dato_varslet="2025-01-15",
                estimert_kostnad=150000.0,
                dagmulktsats=10000.0
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        # Act
        result = service.finn_forseringer_for_sak("SAK-001")

        # Assert
        assert len(result) == 0

    def test_finn_forseringer_for_sak_without_client(self):
        """Test returns empty without client."""
        service = ForseringService()
        result = service.finn_forseringer_for_sak("SAK-001")
        assert result == []

    # ========================================================================
    # Test: Delegation to RelatedCasesService
    # ========================================================================

    def test_hent_hendelser_delegates_to_related_cases(self, service):
        """Test that hent_hendelser_fra_relaterte_saker delegates correctly."""
        # The service should delegate to self.related_cases
        with patch.object(service.related_cases, 'hent_hendelser_fra_saker') as mock:
            mock.return_value = {"SAK-001": []}
            result = service.hent_hendelser_fra_relaterte_saker(["SAK-001"])
            mock.assert_called_once_with(["SAK-001"], None)

    def test_hent_state_delegates_to_related_cases(self, service):
        """Test that hent_state_fra_relaterte_saker delegates correctly."""
        with patch.object(service.related_cases, 'hent_state_fra_saker') as mock:
            mock.return_value = {}
            result = service.hent_state_fra_relaterte_saker(["SAK-001"])
            mock.assert_called_once_with(["SAK-001"])
