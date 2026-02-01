"""
Azure Functions Adapters

Adapter layer som mapper Azure Functions HTTP requests til
eksisterende Flask-lignende interface for services.

Dette gjør at vi kan gjenbruke all business logic uten endringer.

Refaktorert 2026-02-01:
- ServiceContext bruker nå Container for dependency injection
- Fjernet hardkodede imports i properties
- Bedre testbarhet og Azure Functions-kompatibilitet
"""
import json
import logging
from typing import Any, Dict, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from core.container import Container

try:
    import azure.functions as func
    AZURE_FUNCTIONS_AVAILABLE = True
except ImportError:
    AZURE_FUNCTIONS_AVAILABLE = False
    func = None

logger = logging.getLogger(__name__)


def adapt_request(req: 'func.HttpRequest') -> Dict[str, Any]:
    """
    Adapter Azure Functions HttpRequest til et enkelt dict format.

    Args:
        req: Azure Functions HttpRequest

    Returns:
        Dict med:
        - json: Request body som dict
        - args: Query parameters
        - headers: HTTP headers
        - method: HTTP method
    """
    if not AZURE_FUNCTIONS_AVAILABLE:
        raise RuntimeError("Azure Functions SDK ikke installert")

    try:
        body = req.get_json() if req.get_body() else {}
    except ValueError:
        body = {}

    return {
        'json': body,
        'args': dict(req.params),
        'headers': dict(req.headers),
        'method': req.method,
    }


def create_response(
    data: Dict[str, Any],
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None
) -> 'func.HttpResponse':
    """
    Opprett Azure Functions HttpResponse fra data dict.

    Args:
        data: Response body som dict
        status_code: HTTP status code
        headers: Optional ekstra headers

    Returns:
        Azure Functions HttpResponse
    """
    if not AZURE_FUNCTIONS_AVAILABLE:
        raise RuntimeError("Azure Functions SDK ikke installert")

    response_headers = {
        'Content-Type': 'application/json',
    }
    if headers:
        response_headers.update(headers)

    return func.HttpResponse(
        body=json.dumps(data, ensure_ascii=False),
        status_code=status_code,
        headers=response_headers,
        mimetype='application/json'
    )


def create_error_response(
    error: str,
    status_code: int = 400,
    details: Optional[Dict[str, Any]] = None
) -> 'func.HttpResponse':
    """
    Opprett error response.

    Args:
        error: Error message
        status_code: HTTP status code
        details: Optional ekstra detaljer

    Returns:
        Azure Functions HttpResponse
    """
    data = {'error': error}
    if details:
        data.update(details)
    return create_response(data, status_code)


class ServiceContext:
    """
    Context manager for services i Azure Functions.

    Bruker Container for dependency injection - fjerner hardkodede imports
    og gjør testing enklere.

    Usage:
        with ServiceContext() as ctx:
            ctx.repository.save_form_data(...)
            events, version = ctx.event_repository.get_events(sak_id)
            state = ctx.timeline_service.compute_state(events)

        # Med custom container (for testing)
        mock_container = Container(settings)
        mock_container._event_repo = MockEventRepository()
        with ServiceContext(container=mock_container) as ctx:
            # Bruker mock repository
            ...
    """

    def __init__(
        self,
        repository_type: str = 'csv',
        container: Optional['Container'] = None
    ):
        """
        Initialize context.

        Args:
            repository_type: 'csv' eller 'dataverse' (for legacy repository)
            container: Optional Container for dependency injection.
                       Hvis None, opprettes en default container.
        """
        self.repository_type = repository_type
        self._container = container
        self._legacy_repository = None

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc_val, _exc_tb):
        # Cleanup if needed
        pass

    @property
    def _get_container(self) -> 'Container':
        """Lazy-load container."""
        if self._container is None:
            from core.container import get_container
            self._container = get_container()
        return self._container

    @property
    def repository(self):
        """Lazy-load legacy CSV repository."""
        if self._legacy_repository is None:
            if self.repository_type == 'csv':
                from repositories.csv_repository import CSVRepository
                self._legacy_repository = CSVRepository()
            # elif self.repository_type == 'dataverse':
            #     from repositories.dataverse_repository import DataverseRepository
            #     self._legacy_repository = DataverseRepository()
            else:
                raise ValueError(f"Ukjent repository type: {self.repository_type}")
        return self._legacy_repository

    @property
    def event_repository(self):
        """Hent EventRepository fra Container."""
        return self._get_container.event_repository

    @property
    def timeline_service(self):
        """Hent TimelineService fra Container."""
        return self._get_container.timeline_service

    @property
    def catenda_service(self):
        """Hent CatendaService fra Container."""
        return self._get_container.catenda_service

    @property
    def metadata_repository(self):
        """Hent SakMetadataRepository fra Container."""
        return self._get_container.metadata_repository


def validate_required_fields(
    data: Dict[str, Any],
    required_fields: list
) -> Tuple[bool, Optional[str]]:
    """
    Valider at required fields finnes i data.

    Args:
        data: Input data dict
        required_fields: Liste med påkrevde felt

    Returns:
        Tuple[is_valid, error_message]
    """
    missing = [f for f in required_fields if f not in data or data[f] is None]
    if missing:
        return False, f"Mangler påkrevde felt: {', '.join(missing)}"
    return True, None
