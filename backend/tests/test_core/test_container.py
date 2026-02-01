"""
Tests for DI Container.

Verifiserer at Container:
- Lazy-loader avhengigheter korrekt
- Kan overstyre avhengigheter for testing
- Gir samme instans ved gjentatte kall (singleton per container)
- Kan resettes
"""
import pytest
from unittest.mock import Mock, MagicMock
from dataclasses import dataclass

# Import container module
from core.container import Container, get_container, set_container
from core.config import Settings


class TestContainer:
    """Test suite for Container."""

    @pytest.fixture
    def settings(self):
        """Create test settings."""
        return Settings()

    @pytest.fixture
    def container(self, settings):
        """Create fresh container for each test."""
        return Container(config=settings)

    # ========================================================================
    # Test: Initialization
    # ========================================================================

    def test_container_initializes_with_default_settings(self):
        """Container should use default settings if none provided."""
        container = Container()
        assert container.config is not None

    def test_container_accepts_custom_settings(self, settings):
        """Container should accept custom settings."""
        container = Container(config=settings)
        assert container.config is settings

    # ========================================================================
    # Test: Lazy Loading
    # ========================================================================

    def test_event_repository_lazy_loaded(self, container):
        """EventRepository should be lazy-loaded on first access."""
        # Before access, internal cache is None
        assert container._event_repo is None

        # Access triggers lazy load
        repo = container.event_repository

        # After access, cache is populated
        assert container._event_repo is not None
        assert repo is container._event_repo

    def test_timeline_service_lazy_loaded(self, container):
        """TimelineService should be lazy-loaded on first access."""
        assert container._timeline_service is None

        service = container.timeline_service

        assert container._timeline_service is not None
        assert service is container._timeline_service

    def test_metadata_repository_lazy_loaded(self, container):
        """SakMetadataRepository should be lazy-loaded on first access."""
        assert container._metadata_repo is None

        repo = container.metadata_repository

        assert container._metadata_repo is not None
        assert repo is container._metadata_repo

    # ========================================================================
    # Test: Singleton Behavior (per container instance)
    # ========================================================================

    def test_event_repository_same_instance_on_repeated_access(self, container):
        """Same EventRepository instance should be returned on repeated access."""
        repo1 = container.event_repository
        repo2 = container.event_repository

        assert repo1 is repo2

    def test_timeline_service_same_instance_on_repeated_access(self, container):
        """Same TimelineService instance should be returned on repeated access."""
        service1 = container.timeline_service
        service2 = container.timeline_service

        assert service1 is service2

    # ========================================================================
    # Test: Mock Injection for Testing
    # ========================================================================

    def test_can_inject_mock_event_repository(self, container):
        """Should be able to inject mock EventRepository for testing."""
        mock_repo = Mock()
        mock_repo.get_events = Mock(return_value=([], 0))

        # Inject mock
        container._event_repo = mock_repo

        # Container should return mock
        assert container.event_repository is mock_repo

    def test_can_inject_mock_timeline_service(self, container):
        """Should be able to inject mock TimelineService for testing."""
        mock_service = Mock()
        mock_service.compute_state = Mock(return_value=None)

        container._timeline_service = mock_service

        assert container.timeline_service is mock_service

    def test_factory_method_uses_injected_mocks(self, container):
        """Factory methods should use injected mocks."""
        mock_repo = Mock()
        mock_timeline = Mock()
        mock_catenda = Mock()

        container._event_repo = mock_repo
        container._timeline_service = mock_timeline
        container._catenda_client = mock_catenda

        # get_forsering_service should use the mocks
        service = container.get_forsering_service()

        # Verify the service was created with our mocks
        # (ForseringService stores references to injected dependencies)
        assert service.event_repository is mock_repo
        assert service.timeline_service is mock_timeline

    # ========================================================================
    # Test: Reset
    # ========================================================================

    def test_reset_clears_all_cached_instances(self, container):
        """Reset should clear all cached instances."""
        # Populate caches
        _ = container.event_repository
        _ = container.timeline_service
        _ = container.metadata_repository

        # Verify populated
        assert container._event_repo is not None
        assert container._timeline_service is not None
        assert container._metadata_repo is not None

        # Reset
        container.reset()

        # Verify cleared
        assert container._event_repo is None
        assert container._timeline_service is None
        assert container._metadata_repo is None

    # ========================================================================
    # Test: Context Manager
    # ========================================================================

    def test_context_manager_returns_container(self, settings):
        """Context manager should return container on enter."""
        with Container(config=settings) as container:
            assert isinstance(container, Container)

    def test_context_manager_resets_on_exit(self, settings):
        """Context manager should reset on exit."""
        container = Container(config=settings)

        with container:
            _ = container.event_repository
            assert container._event_repo is not None

        # After exit, should be reset
        assert container._event_repo is None


class TestGetSetContainer:
    """Test module-level get_container and set_container functions."""

    def teardown_method(self):
        """Reset global container after each test."""
        set_container(None)

    def test_get_container_creates_default_if_none(self):
        """get_container should create default container if none exists."""
        set_container(None)

        container = get_container()

        assert container is not None
        assert isinstance(container, Container)

    def test_get_container_returns_same_instance(self):
        """get_container should return same instance on repeated calls."""
        set_container(None)

        c1 = get_container()
        c2 = get_container()

        assert c1 is c2

    def test_set_container_overrides_default(self):
        """set_container should override the default container."""
        custom = Container()
        custom._event_repo = Mock()  # Make it identifiable

        set_container(custom)

        assert get_container() is custom
        assert get_container()._event_repo is custom._event_repo

    def test_set_container_none_resets(self):
        """set_container(None) should reset to allow new default creation."""
        # Set a custom container
        custom = Container()
        set_container(custom)

        # Reset
        set_container(None)

        # New call should create fresh container
        new_container = get_container()
        assert new_container is not custom
