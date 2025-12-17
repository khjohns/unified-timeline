"""
Tests for EndringsordreService.

This service handles endringsordre cases (§31.3 NS 8407).
"""
import pytest
from unittest.mock import Mock, patch
from datetime import datetime

from services.endringsordre_service import EndringsordreService
from models.sak_state import (
    SakState,
    SakRelasjon,
    EndringsordreData,
    EOKonsekvenser,
    VederlagTilstand,
    FristTilstand,
    GrunnlagTilstand,
)
from models.events import SporStatus


class TestEndringsordreService:
    """Test suite for EndringsordreService."""

    @pytest.fixture
    def mock_catenda_client(self):
        """Create mock Catenda client."""
        client = Mock()
        client.topic_board_id = "board-123"
        client.create_topic = Mock(return_value={'guid': 'eo-001', 'title': 'Endringsordre'})
        client.create_topic_relations = Mock(return_value=True)
        client.delete_topic_relation = Mock(return_value=True)
        client.list_related_topics = Mock(return_value=[])
        client.get_topic_details = Mock(return_value={'title': 'Related KOE', 'guid': 'koe-001'})
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
        """Create EndringsordreService with mocked dependencies."""
        return EndringsordreService(
            catenda_client=mock_catenda_client,
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )

    # ========================================================================
    # Test: Initialization
    # ========================================================================

    def test_initialization_with_client(self, mock_catenda_client, mock_event_repository, mock_timeline_service):
        """Test service initializes with Catenda client."""
        service = EndringsordreService(
            catenda_client=mock_catenda_client,
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )
        assert service.is_configured() is True

    def test_initialization_without_client(self):
        """Test service can initialize without client."""
        service = EndringsordreService()
        assert service.is_configured() is False

    # ========================================================================
    # Test: opprett_endringsordresak
    # ========================================================================

    def test_opprett_endringsordresak_success(self, service, mock_catenda_client):
        """Test successful EO case creation with bidirectional relations."""
        result = service.opprett_endringsordresak(
            eo_nummer="EO-001",
            beskrivelse="Test endringsordre",
            koe_sak_ids=["KOE-001", "KOE-002"],
            kompensasjon_belop=150000.0
        )

        assert result["sak_id"] == "eo-001"
        assert result["sakstype"] == "endringsordre"
        assert len(result["relaterte_saker"]) == 2
        mock_catenda_client.create_topic.assert_called_once()
        # Toveis-relasjoner: 1x EO→KOE + 2x KOE→EO = 3 kall
        assert mock_catenda_client.create_topic_relations.call_count == 3

    def test_opprett_endringsordresak_without_client(self, mock_event_repository, mock_timeline_service):
        """Test EO creation returns mock data without client."""
        service = EndringsordreService(
            event_repository=mock_event_repository,
            timeline_service=mock_timeline_service
        )

        result = service.opprett_endringsordresak(
            eo_nummer="EO-001",
            beskrivelse="Test",
            koe_sak_ids=["KOE-001"]
        )

        assert "sak_id" in result
        assert result["sakstype"] == "endringsordre"

    def test_opprett_endringsordresak_validation_eo_nummer(self, service):
        """Test validation requires EO nummer."""
        with pytest.raises(ValueError, match="EO-nummer"):
            service.opprett_endringsordresak(
                eo_nummer="",
                beskrivelse="Test",
                koe_sak_ids=["KOE-001"]
            )

    def test_opprett_endringsordresak_validation_beskrivelse(self, service):
        """Test validation requires beskrivelse."""
        with pytest.raises(ValueError, match="Beskrivelse"):
            service.opprett_endringsordresak(
                eo_nummer="EO-001",
                beskrivelse="",
                koe_sak_ids=["KOE-001"]
            )

    def test_opprett_endringsordresak_with_konsekvenser(self, service, mock_catenda_client):
        """Test EO creation with konsekvenser."""
        result = service.opprett_endringsordresak(
            eo_nummer="EO-001",
            beskrivelse="Test",
            koe_sak_ids=["KOE-001"],
            konsekvenser={'pris': True, 'fremdrift': True}
        )

        eo_data = result["endringsordre_data"]
        assert eo_data["konsekvenser"]["pris"] is True
        assert eo_data["konsekvenser"]["fremdrift"] is True

    def test_opprett_endringsordresak_netto_calculation(self, service, mock_catenda_client):
        """Test that netto beløp is calculated correctly."""
        result = service.opprett_endringsordresak(
            eo_nummer="EO-001",
            beskrivelse="Test",
            koe_sak_ids=["KOE-001"],
            kompensasjon_belop=200000.0,
            fradrag_belop=50000.0
        )

        eo_data = result["endringsordre_data"]
        assert eo_data["netto_belop"] == 150000.0  # 200000 - 50000

    # ========================================================================
    # Test: hent_relaterte_saker
    # ========================================================================

    def test_hent_relaterte_saker_success(self, service, mock_catenda_client):
        """Test fetching related KOE cases."""
        mock_catenda_client.list_related_topics.return_value = [
            {'related_topic_guid': 'KOE-001'},
            {'related_topic_guid': 'KOE-002'}
        ]

        result = service.hent_relaterte_saker("eo-001")

        assert len(result) == 2
        assert all(isinstance(r, SakRelasjon) for r in result)

    def test_hent_relaterte_saker_without_client(self):
        """Test returns empty list without client."""
        service = EndringsordreService()
        result = service.hent_relaterte_saker("eo-001")
        assert result == []

    # ========================================================================
    # Test: legg_til_koe / fjern_koe
    # ========================================================================

    def test_legg_til_koe_success(self, service, mock_catenda_client):
        """Test adding KOE to EO with bidirectional relations."""
        result = service.legg_til_koe("eo-001", "koe-001")

        assert result is True
        # Toveis-relasjoner: EO→KOE og KOE→EO
        assert mock_catenda_client.create_topic_relations.call_count == 2

    def test_legg_til_koe_without_client(self):
        """Test returns False without client."""
        service = EndringsordreService()
        result = service.legg_til_koe("eo-001", "koe-001")
        assert result is False

    def test_fjern_koe_success(self, service, mock_catenda_client):
        """Test removing KOE from EO with bidirectional relations."""
        result = service.fjern_koe("eo-001", "koe-001")

        assert result is True
        # Toveis-relasjoner: fjern EO→KOE og KOE→EO
        assert mock_catenda_client.delete_topic_relation.call_count == 2

    def test_fjern_koe_without_client(self):
        """Test returns False without client."""
        service = EndringsordreService()
        result = service.fjern_koe("eo-001", "koe-001")
        assert result is False

    # ========================================================================
    # Test: hent_komplett_eo_kontekst
    # ========================================================================

    def test_hent_komplett_eo_kontekst_success(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test fetching complete EO context."""
        mock_catenda_client.list_related_topics.return_value = [
            {'related_topic_guid': 'KOE-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="KOE-001",
            sakstittel="Test KOE",
            vederlag=VederlagTilstand(
                status="godkjent",
                metode="ENHETSPRISER",
                belop_direkte=100000.0,
                godkjent_belop=100000.0
            ),
            frist=FristTilstand(
                status="godkjent",
                krevd_dager=10,
                godkjent_dager=10
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        result = service.hent_komplett_eo_kontekst("eo-001")

        assert "relaterte_saker" in result
        assert "sak_states" in result
        assert "hendelser" in result
        assert "eo_hendelser" in result
        assert "oppsummering" in result

    def test_hent_komplett_eo_kontekst_no_related(self, service, mock_catenda_client):
        """Test context when no related cases."""
        mock_catenda_client.list_related_topics.return_value = []

        result = service.hent_komplett_eo_kontekst("eo-001")

        assert result["relaterte_saker"] == []
        assert result["sak_states"] == {}
        assert result["hendelser"] == {}

    # ========================================================================
    # Test: _bygg_oppsummering
    # ========================================================================

    def test_bygg_oppsummering_with_values(self, service):
        """Test summary building with actual values."""
        states = {
            "KOE-001": SakState(
                sak_id="KOE-001",
                sakstittel="KOE 1",
                vederlag=VederlagTilstand(
                    status="godkjent",
                    metode="ENHETSPRISER",
                    belop_direkte=100000.0,
                    godkjent_belop=80000.0
                ),
                frist=FristTilstand(
                    status="godkjent",
                    krevd_dager=10,
                    godkjent_dager=7
                )
            ),
            "KOE-002": SakState(
                sak_id="KOE-002",
                sakstittel="KOE 2",
                vederlag=VederlagTilstand(
                    status="godkjent",
                    metode="ENHETSPRISER",
                    belop_direkte=50000.0,
                    godkjent_belop=50000.0
                )
            )
        }

        result = service._bygg_oppsummering(states)

        assert result["antall_koe_saker"] == 2
        assert result["total_krevd_vederlag"] == 150000.0
        assert result["total_godkjent_vederlag"] == 130000.0
        assert result["total_krevd_dager"] == 10
        assert result["total_godkjent_dager"] == 7

    def test_bygg_oppsummering_empty(self, service):
        """Test summary with no cases."""
        result = service._bygg_oppsummering({})

        assert result["antall_koe_saker"] == 0
        assert result["total_krevd_vederlag"] == 0
        assert result["total_godkjent_vederlag"] == 0

    # ========================================================================
    # Test: hent_kandidat_koe_saker
    # ========================================================================

    def test_hent_kandidat_koe_saker_found(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test finding candidate KOE cases."""
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'KOE-001', 'title': 'Test KOE'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        # Set up state with proper statuses so kan_utstede_eo computes to True
        # kan_utstede_eo requires: grunnlag=GODKJENT/LAAST, vederlag/frist=GODKJENT/LAAST/TRUKKET/IKKE_RELEVANT
        mock_state = SakState(
            sak_id="KOE-001",
            sakstittel="Test KOE",
            sakstype="standard",
            grunnlag=GrunnlagTilstand(status=SporStatus.GODKJENT),
            vederlag=VederlagTilstand(
                status=SporStatus.GODKJENT,
                metode="ENHETSPRISER",
                belop_direkte=100000.0,
                godkjent_belop=100000.0
            ),
            frist=FristTilstand(
                status=SporStatus.GODKJENT,
                godkjent_dager=5
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        result = service.hent_kandidat_koe_saker()

        assert len(result) == 1
        assert result[0]["sak_id"] == "KOE-001"
        assert result[0]["overordnet_status"] == "OMFORENT"

    def test_hent_kandidat_koe_saker_filters_non_candidates(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test that non-candidate cases are filtered."""
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'KOE-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        # Case where kan_utstede_eo is False
        mock_state = SakState(
            sak_id="KOE-001",
            sakstittel="Test KOE",
            kan_utstede_eo=False  # Not ready for EO
        )
        mock_timeline_service.compute_state.return_value = mock_state

        result = service.hent_kandidat_koe_saker()

        assert len(result) == 0

    def test_hent_kandidat_koe_saker_without_client(self):
        """Test returns empty without client."""
        service = EndringsordreService()
        result = service.hent_kandidat_koe_saker()
        assert result == []

    # ========================================================================
    # Test: finn_eoer_for_koe
    # ========================================================================

    def test_finn_eoer_for_koe_found(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test finding EOer that reference a KOE case."""
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'EO-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="EO-001",
            sakstittel="Test EO",
            sakstype="endringsordre",
            endringsordre_data=EndringsordreData(
                relaterte_koe_saker=["KOE-001", "KOE-002"],
                eo_nummer="EO-001",
                beskrivelse="Test",
                status="utstedt"
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        result = service.finn_eoer_for_koe("KOE-001")

        assert len(result) == 1
        assert result[0]["eo_sak_id"] == "EO-001"

    def test_finn_eoer_for_koe_not_found(
        self, service, mock_catenda_client, mock_event_repository, mock_timeline_service
    ):
        """Test when no EOer reference the KOE case."""
        mock_catenda_client.list_topics.return_value = [
            {'guid': 'EO-001'}
        ]

        mock_events = [Mock()]
        mock_event_repository.get_events.return_value = (mock_events, 1)

        mock_state = SakState(
            sak_id="EO-001",
            sakstittel="Test EO",
            sakstype="endringsordre",
            endringsordre_data=EndringsordreData(
                relaterte_koe_saker=["KOE-999"],  # Different case
                eo_nummer="EO-001",
                beskrivelse="Test"
            )
        )
        mock_timeline_service.compute_state.return_value = mock_state

        result = service.finn_eoer_for_koe("KOE-001")

        assert len(result) == 0

    def test_finn_eoer_for_koe_without_client(self):
        """Test returns empty without client."""
        service = EndringsordreService()
        result = service.finn_eoer_for_koe("KOE-001")
        assert result == []

    # ========================================================================
    # Test: Delegation to RelatedCasesService
    # ========================================================================

    def test_hent_hendelser_delegates_to_related_cases(self, service):
        """Test that hent_hendelser_fra_relaterte_saker delegates correctly."""
        with patch.object(service.related_cases, 'hent_hendelser_fra_saker') as mock:
            mock.return_value = {"KOE-001": []}
            result = service.hent_hendelser_fra_relaterte_saker(["KOE-001"])
            mock.assert_called_once_with(["KOE-001"], None)

    def test_hent_state_delegates_to_related_cases(self, service):
        """Test that hent_state_fra_relaterte_saker delegates correctly."""
        with patch.object(service.related_cases, 'hent_state_fra_saker') as mock:
            mock.return_value = {}
            result = service.hent_state_fra_relaterte_saker(["KOE-001"])
            mock.assert_called_once_with(["KOE-001"])
