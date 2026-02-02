"""
Dependency Injection Container for KOE Backend.

Sentralisert håndtering av alle avhengigheter. Erstatter hardkodede imports
og globale singletons med lazy-loaded, testbare komponenter.

Fordeler:
- Testbarhet: Kan injisere mock-objekter
- Lazy loading: Opprettes kun ved behov
- Sentralisert: Ett sted å konfigurere alle avhengigheter
- Azure-klar: Kan enkelt bytte implementasjoner

Usage:
    # Flask app
    container = Container(settings)
    event_repo = container.event_repository
    timeline = container.timeline_service

    # Azure Functions
    container = Container(settings)
    service = container.get_forsering_service()

    # Testing
    container = Container(settings)
    container._event_repo = MockEventRepository()
    service = container.get_forsering_service()  # Bruker mock
"""

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

from core.config import Settings
from core.config import settings as default_settings

if TYPE_CHECKING:
    from core.unit_of_work import TrackingUnitOfWork
    from integrations.catenda import CatendaClient
    from repositories import EventRepository, SakMetadataRepository
    from services.catenda_service import CatendaService
    from services.endringsordre_service import EndringsordreService
    from services.forsering_service import ForseringService
    from services.timeline_service import TimelineService


@dataclass
class Container:
    """
    Dependency injection container.

    Alle avhengigheter lazy-loades ved første tilgang.
    Kan overstyres for testing ved å sette private felter direkte.

    Attributes:
        config: Application settings (påkrevd)

    Properties (lazy-loaded):
        event_repository: EventRepository instans
        metadata_repository: SakMetadataRepository instans
        timeline_service: TimelineService instans
        catenda_service: CatendaService instans
        catenda_client: CatendaClient instans

    Factory methods:
        get_forsering_service(): Ny ForseringService med avhengigheter
        get_endringsordre_service(): Ny EndringsordreService med avhengigheter
    """

    config: Settings = field(default_factory=lambda: default_settings)

    # Private cache for lazy-loaded instances
    _event_repo: Optional["EventRepository"] = field(default=None, repr=False)
    _metadata_repo: Optional["SakMetadataRepository"] = field(default=None, repr=False)
    _timeline_service: Optional["TimelineService"] = field(default=None, repr=False)
    _catenda_service: Optional["CatendaService"] = field(default=None, repr=False)
    _catenda_client: Optional["CatendaClient"] = field(default=None, repr=False)

    # -------------------------------------------------------------------------
    # Repositories
    # -------------------------------------------------------------------------

    @property
    def event_repository(self) -> "EventRepository":
        """
        Lazy-load EventRepository basert på config.

        Støtter backends:
        - "json": JsonFileEventRepository (lokal utvikling)
        - "supabase": SupabaseEventRepository (dev/test)
        - "azure_sql": AzureSqlEventRepository (fremtidig)
        """
        if self._event_repo is None:
            from repositories import create_event_repository

            self._event_repo = create_event_repository()
        return self._event_repo

    @property
    def metadata_repository(self) -> "SakMetadataRepository":
        """
        Lazy-load SakMetadataRepository basert på config.

        Støtter backends:
        - "csv": SakMetadataRepository (lokal utvikling)
        - "supabase": SupabaseSakMetadataRepository (dev/test)
        """
        if self._metadata_repo is None:
            from repositories import create_metadata_repository

            self._metadata_repo = create_metadata_repository()
        return self._metadata_repo

    # -------------------------------------------------------------------------
    # Services
    # -------------------------------------------------------------------------

    @property
    def timeline_service(self) -> "TimelineService":
        """
        Lazy-load TimelineService.

        TimelineService er stateless og har ingen avhengigheter,
        så dette er en enkel instansiering.
        """
        if self._timeline_service is None:
            from services.timeline_service import TimelineService

            self._timeline_service = TimelineService()
        return self._timeline_service

    @property
    def catenda_service(self) -> "CatendaService":
        """
        Lazy-load CatendaService.

        CatendaService bruker environment variables for config.
        """
        if self._catenda_service is None:
            from services.catenda_service import CatendaService

            self._catenda_service = CatendaService()
        return self._catenda_service

    @property
    def catenda_client(self) -> "CatendaClient":
        """
        Lazy-load CatendaClient.

        Bruker access_token fra config hvis tilgjengelig.
        """
        if self._catenda_client is None:
            from integrations.catenda import CatendaClient

            self._catenda_client = CatendaClient(
                client_id=self.config.catenda_client_id,
                client_secret=self.config.catenda_client_secret,
            )
            if self.config.catenda_access_token:
                self._catenda_client.set_access_token(self.config.catenda_access_token)
        return self._catenda_client

    # -------------------------------------------------------------------------
    # Service Factories (for services med flere avhengigheter)
    # -------------------------------------------------------------------------

    def get_forsering_service(self) -> "ForseringService":
        """
        Opprett ForseringService med alle avhengigheter injisert.

        Returns:
            ForseringService med event_repository, timeline_service, catenda_client
        """
        from services.forsering_service import ForseringService

        return ForseringService(
            catenda_client=self.catenda_client,
            event_repository=self.event_repository,
            timeline_service=self.timeline_service,
        )

    def get_endringsordre_service(self) -> "EndringsordreService":
        """
        Opprett EndringsordreService med alle avhengigheter injisert.

        Returns:
            EndringsordreService med event_repository, timeline_service, catenda_client
        """
        from services.endringsordre_service import EndringsordreService

        return EndringsordreService(
            catenda_client=self.catenda_client,
            event_repository=self.event_repository,
            timeline_service=self.timeline_service,
        )

    def create_unit_of_work(self) -> "TrackingUnitOfWork":
        """
        Opprett ny Unit of Work for koordinerte repository-operasjoner.

        Bruk som context manager for automatisk commit/rollback:

            with container.create_unit_of_work() as uow:
                uow.metadata.create(metadata)
                uow.events.append(event, expected_version=0)
                # Commit ved exit, rollback ved exception

        Returns:
            TrackingUnitOfWork som wrapper event og metadata repositories
        """
        from core.unit_of_work import TrackingUnitOfWork

        return TrackingUnitOfWork(self)

    # -------------------------------------------------------------------------
    # Utility methods
    # -------------------------------------------------------------------------

    def reset(self) -> None:
        """
        Nullstill alle cached instanser.

        Nyttig for testing eller når config endres runtime.
        """
        self._event_repo = None
        self._metadata_repo = None
        self._timeline_service = None
        self._catenda_service = None
        self._catenda_client = None

    def __enter__(self) -> "Container":
        """Context manager support."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Cleanup ved context exit."""
        self.reset()


# ---------------------------------------------------------------------------
# Module-level convenience functions
# ---------------------------------------------------------------------------

# Default container instance (kan overstyres i tester)
_default_container: Container | None = None


def get_container() -> Container:
    """
    Hent default container instans.

    Oppretter en ny container med default settings ved første kall.
    Bruk set_container() for å overstyre i tester.

    Returns:
        Container instans
    """
    global _default_container
    if _default_container is None:
        _default_container = Container()
    return _default_container


def set_container(container: Container | None) -> None:
    """
    Sett default container instans.

    Bruk dette i tester for å injisere mock-avhengigheter.

    Args:
        container: Container instans eller None for å resette

    Example:
        # I test
        mock_container = Container(settings)
        mock_container._event_repo = MockEventRepository()
        set_container(mock_container)

        # Etter test
        set_container(None)
    """
    global _default_container
    _default_container = container
