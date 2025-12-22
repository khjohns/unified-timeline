"""
Azure Functions Adapters

Adapter layer som mapper Azure Functions HTTP requests til
eksisterende Flask-lignende interface for services.

Dette gjør at vi kan gjenbruke all business logic uten endringer.
"""
import json
import logging
from typing import Any, Dict, Optional, Tuple

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

    Initialiserer repository og services for hver request.

    Usage:
        with ServiceContext() as ctx:
            ctx.repository.save_form_data(...)
            events, version = ctx.event_repository.get_events(sak_id)
            state = ctx.timeline_service.compute_state(events)
    """

    def __init__(self, repository_type: str = 'csv'):
        """
        Initialize context.

        Args:
            repository_type: 'csv' eller 'dataverse'
        """
        self.repository_type = repository_type
        self._repository = None
        self._catenda_service = None
        self._event_repository = None
        self._timeline_service = None
        self._metadata_repository = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Cleanup if needed
        pass

    @property
    def repository(self):
        """Lazy-load legacy CSV repository."""
        if self._repository is None:
            if self.repository_type == 'csv':
                from repositories.csv_repository import CSVRepository
                self._repository = CSVRepository()
            # elif self.repository_type == 'dataverse':
            #     from repositories.dataverse_repository import DataverseRepository
            #     self._repository = DataverseRepository()
            else:
                raise ValueError(f"Ukjent repository type: {self.repository_type}")
        return self._repository

    @property
    def event_repository(self):
        """Lazy-load Event Sourcing repository."""
        if self._event_repository is None:
            from repositories.event_repository import JsonFileEventRepository
            self._event_repository = JsonFileEventRepository()
        return self._event_repository

    @property
    def timeline_service(self):
        """Lazy-load TimelineService for state projection."""
        if self._timeline_service is None:
            from services.timeline_service import TimelineService
            self._timeline_service = TimelineService()
        return self._timeline_service

    @property
    def catenda_service(self):
        """Lazy-load CatendaService."""
        if self._catenda_service is None:
            from services.catenda_service import CatendaService
            # CatendaService will use environment variables for config
            self._catenda_service = CatendaService()
        return self._catenda_service

    @property
    def metadata_repository(self):
        """Lazy-load metadata repository for case list."""
        if self._metadata_repository is None:
            from repositories.supabase_sak_metadata_repository import create_metadata_repository
            self._metadata_repository = create_metadata_repository()
        return self._metadata_repository


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
