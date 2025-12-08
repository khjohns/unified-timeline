# Backend Refaktoreringsplan

> **Formål:** Denne planen er skrevet for å kunne utføres av en LLM (Claude) i separate kontekstvinduer.
> Hver oppgave er selvstedig og inneholder all nødvendig informasjon.

---

## Oversikt

| Prioritet | Oppgave | Estimert kompleksitet | Filer involvert |
|-----------|---------|----------------------|-----------------|
| 1 | Konsolidere logging | Lav | 6 filer |
| 2 | Slå sammen ValidationError | Lav | 2 filer |
| 3 | Ekstrahere error-handling decorator | Medium | 5+ filer |
| 4 | Splitte CatendaClient | Høy | 1 → 6 filer |
| 5 | Refaktorere event_routes.py | Medium | 1 → 3 filer |
| 6 | Implementere ServiceFactory/DI | Medium | 4+ filer |

---

## Oppgave 1: Konsolidere Logging

### Kontekst
`logging.basicConfig()` kalles på 6 forskjellige steder. Kun det første kallet har effekt - de andre ignoreres stille.

### Filer som må endres

**Fjern `logging.basicConfig()` fra disse filene:**

1. `backend/function_app.py:21`
2. `backend/scripts/setup_webhooks.py:32`
3. `backend/integrations/catenda/client.py:23-30`
4. `backend/scripts/catenda_menu.py:43`
5. `backend/scripts/webhook_listener.py:23`

**Behold kun denne (master config):**
- `backend/core/logging_config.py:20`

### Instruksjoner

```
1. Åpne hver fil listet ovenfor
2. Fjern logging.basicConfig() kallet og tilhørende imports hvis ubrukt
3. Erstatt med:
   from utils.logger import get_logger
   logger = get_logger(__name__)
4. Verifiser at eksisterende logger-kall fortsatt fungerer
```

### Eksempel endring for `integrations/catenda/client.py`

**FØR (linje 19-31):**
```python
import logging

# Konfigurer logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('catenda_api_test.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
```

**ETTER:**
```python
from utils.logger import get_logger

logger = get_logger(__name__)
```

### Verifisering
```bash
cd backend
grep -r "logging.basicConfig" --include="*.py"
# Skal kun returnere core/logging_config.py
```

---

## Oppgave 2: Slå sammen ValidationError-klasser

### Kontekst
`ValidationError` er definert to steder med forskjellig signatur, noe som skaper forvirring.

### Filer involvert

1. `backend/lib/security/validation.py:33-47` - Detaljert ValidationError med `field` og `message`
2. `backend/api/validators.py:23-25` - Enkel ValidationError uten felt-info

### Instruksjoner

```
1. Behold ValidationError fra lib/security/validation.py (den er mer informativ)
2. Oppdater api/validators.py til å importere fra lib/security/validation.py
3. Oppdater alle raise ValidationError() kall i api/validators.py til å inkludere felt-navn
```

### Endringer i `api/validators.py`

**FØR (linje 1-26):**
```python
"""
API validators integrating backend constants.
...
"""
from typing import Dict, Any, Optional
from models.events import (...)
from constants import (...)


class ValidationError(Exception):
    """Custom exception for validation errors."""
    pass
```

**ETTER:**
```python
"""
API validators integrating backend constants.
...
"""
from typing import Dict, Any, Optional
from models.events import (...)
from constants import (...)
from lib.security.validation import ValidationError
```

**Oppdater alle raise-statements, f.eks:**

FØR:
```python
raise ValidationError("Grunnlag data mangler")
```

ETTER:
```python
raise ValidationError("data", "Grunnlag data mangler")
```

### Liste over raise-statements som må oppdateres i `api/validators.py`:
- Linje 39: `"data"` felt
- Linje 45: `"hovedkategori"` felt
- Linje 48: `"underkategori"` felt
- Linje 56, 61: `"kategori"` felt
- Linje 66: `"beskrivelse"` felt
- Linje 69: `"dato_oppdaget"` felt
- Linje 83: `"data"` felt
- Linje 87: `"metode"` felt
- Linje 92: `"metode"` felt
- Linje 100: `"belop_direkte"` felt
- Linje 105: `"begrunnelse"` felt
- osv. (fortsett for alle ValidationError i filen)

### Verifisering
```bash
cd backend
python -c "from api.validators import ValidationError; print(ValidationError.__module__)"
# Skal returnere: lib.security.validation
```

---

## Oppgave 3: Ekstrahere Error-Handling Decorator

### Kontekst
`CatendaService` har 5 metoder med nesten identisk try/except-mønster (~20 linjer hver).

### Fil: `backend/services/catenda_service.py`

### Duplisert mønster (finnes i metodene på linje 70, 96, 144, 181, 210):

```python
def method_name(self, ...):
    if not self.client:
        logger.warning("No Catenda client configured...")
        return None

    try:
        logger.info(f"Doing something...")
        result = self.client.do_something(...)

        if result:
            logger.info(f"✅ Success...")
            return result
        else:
            logger.error(f"❌ Failed...")
            return None

    except Exception as e:
        logger.error(f"❌ Exception...: {e}")
        return None  # eller raise
```

### Løsning: Lag en decorator

**Opprett ny fil: `backend/utils/api_decorators.py`**

```python
"""
API decorators for common patterns.
"""
from functools import wraps
from typing import Callable, Optional, Any
from utils.logger import get_logger

logger = get_logger(__name__)


def require_client(client_attr: str = "client"):
    """
    Decorator that checks if service has a configured client.

    Args:
        client_attr: Name of the client attribute to check

    Returns:
        None if client is not configured, otherwise calls the wrapped function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(self, *args, **kwargs):
            client = getattr(self, client_attr, None)
            if not client:
                logger.warning(f"No {client_attr} configured, skipping {func.__name__}")
                return None
            return func(self, *args, **kwargs)
        return wrapper
    return decorator


def handle_api_errors(
    operation_name: str,
    reraise: bool = False,
    default_return: Any = None
):
    """
    Decorator for consistent API error handling.

    Args:
        operation_name: Human-readable name for logging
        reraise: If True, re-raises exceptions after logging
        default_return: Value to return on failure (default: None)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.error(f"❌ {operation_name} failed: {e}")
                if reraise:
                    raise
                return default_return
        return wrapper
    return decorator
```

### Refaktorert `CatendaService` eksempel

**FØR:**
```python
def get_topic_details(self, topic_guid: str) -> Optional[Dict[str, Any]]:
    if not self.client:
        logger.warning("No Catenda client configured")
        return None

    try:
        logger.info(f"Getting topic details for {topic_guid}")
        result = self.client.get_topic_details(topic_guid)

        if result:
            logger.info(f"✅ Topic details retrieved: {result.get('title', 'N/A')}")
            return result
        else:
            logger.error(f"❌ Failed to get topic details")
            return None

    except Exception as e:
        logger.error(f"❌ Exception getting topic details: {e}")
        return None
```

**ETTER:**
```python
@require_client()
@handle_api_errors("Get topic details")
def get_topic_details(self, topic_guid: str) -> Optional[Dict[str, Any]]:
    logger.info(f"Getting topic details for {topic_guid}")
    result = self.client.get_topic_details(topic_guid)

    if result:
        logger.info(f"✅ Topic details retrieved: {result.get('title', 'N/A')}")
    else:
        logger.warning(f"No topic details returned for {topic_guid}")

    return result
```

### Verifisering
```bash
cd backend
python -m pytest tests/test_services/test_catenda_service.py -v
```

---

## Oppgave 4: Splitte CatendaClient (STOR OPPGAVE)

### Kontekst
`backend/integrations/catenda/client.py` er på **1649 linjer** med 35+ metoder som håndterer 7 forskjellige ansvarsområder.

### Nåværende struktur (én mega-fil):

| Linje | Seksjon | Ansvar |
|-------|---------|--------|
| 34-270 | Authentication | OAuth flows, token management |
| 283-338 | Project/Board Discovery | List/select topic boards |
| 340-419 | Project Management | v2 API project operations |
| 421-483 | Library Management | Document libraries |
| 485-661 | Topic Management | BCF topics CRUD |
| 663-846 | Document Operations | Upload, references |
| 847-928 | Comments | BCF comments |
| 930-1173 | BIM Objects | Viewpoints, IFC extraction |
| 1175-1289 | Webhooks | Webhook management |
| 1291-1416 | ID Mapping Test | Test utilities |

### Foreslått ny struktur:

```
backend/integrations/catenda/
├── __init__.py          # Re-exports for backwards compatibility
├── base.py              # CatendaBaseClient (auth, headers, base URL)
├── auth.py              # CatendaAuthMixin (OAuth flows)
├── topics.py            # CatendaTopicClient (BCF topics)
├── documents.py         # CatendaDocumentClient (upload, refs)
├── comments.py          # CatendaCommentClient (BCF comments)
├── viewpoints.py        # CatendaViewpointClient (BIM objects)
├── webhooks.py          # CatendaWebhookClient
└── client.py            # CatendaClient (facade that combines all)
```

### Del 4.1: Opprett `base.py`

```python
"""
Base client with authentication and common utilities.
"""
from datetime import datetime, timedelta
from typing import Dict, Optional
import requests

from utils.logger import get_logger

logger = get_logger(__name__)


class CatendaBaseClient:
    """Base client with authentication handling."""

    BASE_URL = "https://api.catenda.com"

    def __init__(
        self,
        client_id: str,
        client_secret: Optional[str] = None,
        access_token: Optional[str] = None
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.access_token = access_token
        self.token_expiry: Optional[datetime] = None
        self.refresh_token: Optional[str] = None

        # Context IDs (set during operations)
        self.project_id: Optional[str] = None
        self.topic_board_id: Optional[str] = None
        self.library_id: Optional[str] = None

    def set_access_token(self, token: str, expires_in: int = 3600):
        """Set access token manually."""
        self.access_token = token
        self.token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
        logger.info("Access token set manually")

    def ensure_authenticated(self) -> bool:
        """Check if token is valid."""
        if not self.access_token:
            return False
        if self.token_expiry and datetime.now() >= self.token_expiry:
            return False
        return True

    def get_headers(self) -> Dict[str, str]:
        """Get standard headers for API calls."""
        if not self.ensure_authenticated():
            raise RuntimeError("Not authenticated")
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

    def _get(self, url: str, **kwargs) -> requests.Response:
        """HTTP GET with auth headers."""
        return requests.get(url, headers=self.get_headers(), **kwargs)

    def _post(self, url: str, **kwargs) -> requests.Response:
        """HTTP POST with auth headers."""
        headers = kwargs.pop('headers', self.get_headers())
        return requests.post(url, headers=headers, **kwargs)

    def _delete(self, url: str, **kwargs) -> requests.Response:
        """HTTP DELETE with auth headers."""
        return requests.delete(url, headers=self.get_headers(), **kwargs)
```

### Del 4.2: Opprett `auth.py`

Flytt linje 67-246 fra `client.py` til `auth.py` som en mixin:

```python
"""
OAuth authentication flows for Catenda API.
"""
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode
import requests

from utils.logger import get_logger

logger = get_logger(__name__)


class CatendaAuthMixin:
    """
    Mixin providing OAuth authentication methods.

    Requires: self.client_id, self.client_secret, self.BASE_URL
    """

    def authenticate(self) -> bool:
        """Client Credentials Grant (Boost customers only)."""
        # ... (flytt kode fra linje 67-138)
        pass

    def get_authorization_url(self, redirect_uri: str, state: str = None) -> str:
        """Generate authorization URL for Auth Code Grant."""
        # ... (flytt kode fra linje 144-180)
        pass

    def exchange_code_for_token(self, code: str, redirect_uri: str) -> bool:
        """Exchange auth code for access token."""
        # ... (flytt kode fra linje 182-232)
        pass
```

### Del 4.3: Opprett `topics.py`

Flytt topic-relaterte metoder (linje 485-661):

```python
"""
BCF Topic operations for Catenda API.
"""
from typing import Dict, List, Optional

from .base import CatendaBaseClient
from utils.logger import get_logger

logger = get_logger(__name__)


class CatendaTopicClient(CatendaBaseClient):
    """Client for BCF topic operations."""

    def list_topic_boards(self) -> List[Dict]:
        """List all available topic boards."""
        # ... (fra linje 287-312)
        pass

    def list_topics(self, limit: int = 10) -> List[Dict]:
        """List topics in selected board."""
        # ... (fra linje 518-550)
        pass

    def get_topic_details(self, topic_id: str) -> Optional[Dict]:
        """Get topic details."""
        # ... (fra linje 578-609)
        pass

    def create_topic(self, title: str, **kwargs) -> Optional[Dict]:
        """Create new topic."""
        # ... (fra linje 611-661)
        pass
```

### Del 4.4-4.7: Tilsvarende for documents, comments, viewpoints, webhooks

(Samme mønster som ovenfor)

### Del 4.8: Oppdater facade `client.py`

```python
"""
CatendaClient - Facade combining all Catenda API clients.

For backwards compatibility, this class provides all methods
from the specialized clients.
"""
from .base import CatendaBaseClient
from .auth import CatendaAuthMixin
from .topics import CatendaTopicClient
from .documents import CatendaDocumentClient
from .comments import CatendaCommentClient
from .viewpoints import CatendaViewpointClient
from .webhooks import CatendaWebhookClient


class CatendaClient(
    CatendaAuthMixin,
    CatendaTopicClient,
    CatendaDocumentClient,
    CatendaCommentClient,
    CatendaViewpointClient,
    CatendaWebhookClient
):
    """
    Full-featured Catenda API client.

    Combines all specialized clients via multiple inheritance.
    Use this for general-purpose access, or use specialized
    clients directly for focused operations.
    """
    pass
```

### Del 4.9: Oppdater `__init__.py`

```python
"""
Catenda API integration.
"""
from .client import CatendaClient
from .base import CatendaBaseClient
from .topics import CatendaTopicClient
from .documents import CatendaDocumentClient
from .comments import CatendaCommentClient

__all__ = [
    'CatendaClient',
    'CatendaBaseClient',
    'CatendaTopicClient',
    'CatendaDocumentClient',
    'CatendaCommentClient',
]
```

### Verifisering
```bash
cd backend
# Alle eksisterende imports skal fortsatt fungere:
python -c "from integrations.catenda import CatendaClient; print('OK')"

# Kjør tester:
python -m pytest tests/ -v -k "catenda"
```

---

## Oppgave 5: Refaktorere event_routes.py

### Kontekst
`backend/routes/event_routes.py` er på **592 linjer** og håndterer mange forskjellige operasjoner.

### Nåværende struktur:

| Linje | Funksjon | Ansvar |
|-------|----------|--------|
| 51-236 | `submit_event()` | POST /api/events |
| 239-363 | `submit_batch()` | POST /api/events/batch |
| 366-386 | `get_case_state()` | GET /api/cases/{id}/state |
| 389-407 | `get_case_timeline()` | GET /api/cases/{id}/timeline |
| 414-569 | `_post_to_catenda()` | Intern hjelpefunksjon |
| 572-591 | `get_catenda_service()` | Intern hjelpefunksjon |

### Foreslått struktur:

```
backend/routes/
├── __init__.py
├── event_routes.py      # Kun route-definisjoner (slank)
├── case_routes.py       # GET case state/timeline
└── handlers/
    ├── __init__.py
    ├── event_handler.py     # Logikk for event submission
    └── catenda_handler.py   # Catenda integration helpers
```

### Del 5.1: Opprett `handlers/catenda_handler.py`

Flytt linje 414-591 (Catenda-hjelpefunksjoner):

```python
"""
Catenda integration handlers for event routes.
"""
from typing import Optional, Tuple
import base64
import tempfile
import os
from datetime import datetime

from services.catenda_service import CatendaService
from integrations.catenda import CatendaClient
from repositories.sak_metadata_repository import SakMetadataRepository
from lib.auth.magic_link import get_magic_link_manager
from core.config import settings
from utils.logger import get_logger

logger = get_logger(__name__)

metadata_repo = SakMetadataRepository()
magic_link_manager = get_magic_link_manager()


def get_catenda_service() -> Optional[CatendaService]:
    """Get configured Catenda service or None."""
    # ... (flytt fra linje 572-591)
    pass


def post_to_catenda(
    sak_id: str,
    state,
    event,
    topic_id: str,
    client_pdf_base64: Optional[str] = None,
    client_pdf_filename: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Post PDF and comment to Catenda (hybrid approach).

    Returns:
        (success, pdf_source)
    """
    # ... (flytt fra linje 414-569)
    pass
```

### Del 5.2: Opprett `handlers/event_handler.py`

Ekstraher forretningslogikk fra submit_event():

```python
"""
Event submission handlers.
"""
from typing import Dict, Any, Tuple, List, Optional
from datetime import datetime

from services.timeline_service import TimelineService
from services.business_rules import BusinessRuleValidator
from repositories.event_repository import JsonFileEventRepository, ConcurrencyError
from repositories.sak_metadata_repository import SakMetadataRepository
from models.events import parse_event_from_request, parse_event, EventType
from api.validators import (
    validate_grunnlag_event,
    validate_vederlag_event,
    validate_frist_event,
    validate_respons_event,
    ValidationError as ApiValidationError,
)
from utils.logger import get_logger

logger = get_logger(__name__)


class EventSubmissionHandler:
    """Handles event submission logic."""

    def __init__(self):
        self.event_repo = JsonFileEventRepository()
        self.metadata_repo = SakMetadataRepository()
        self.timeline_service = TimelineService()
        self.validator = BusinessRuleValidator()

    def validate_event_data(self, event_type: str, data: Dict) -> None:
        """Validate event data against constants."""
        # ... (flytt validerings-switch fra linje 119-138)
        pass

    def submit_single(
        self,
        sak_id: str,
        expected_version: int,
        event_data: Dict
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Submit a single event.

        Returns:
            (success, result_dict)
        """
        # ... (ekstraher logikk fra submit_event())
        pass

    def submit_batch(
        self,
        sak_id: str,
        expected_version: int,
        events_data: List[Dict]
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Submit multiple events atomically.

        Returns:
            (success, result_dict)
        """
        # ... (ekstraher logikk fra submit_batch())
        pass
```

### Del 5.3: Forenklet `event_routes.py`

```python
"""
Event submission API routes.
"""
from flask import Blueprint, request, jsonify

from lib.auth.csrf_protection import require_csrf
from lib.auth.magic_link import require_magic_link
from utils.logger import get_logger
from .handlers.event_handler import EventSubmissionHandler
from .handlers.catenda_handler import post_to_catenda

logger = get_logger(__name__)
events_bp = Blueprint('events', __name__)

# Handler instance
handler = EventSubmissionHandler()


@events_bp.route('/api/events', methods=['POST'])
@require_csrf
@require_magic_link
def submit_event():
    """Submit a single event with optional PDF."""
    payload = request.json

    success, result = handler.submit_single(
        sak_id=payload.get('sak_id'),
        expected_version=payload.get('expected_version'),
        event_data=payload.get('event')
    )

    if not success:
        status_code = result.get('status_code', 400)
        return jsonify(result), status_code

    # Optional Catenda integration
    if payload.get('catenda_topic_id'):
        catenda_success, pdf_source = post_to_catenda(
            sak_id=payload['sak_id'],
            state=result['state'],
            event=result['event'],
            topic_id=payload['catenda_topic_id'],
            client_pdf_base64=payload.get('pdf_base64'),
            client_pdf_filename=payload.get('pdf_filename')
        )
        result['pdf_uploaded'] = catenda_success
        result['pdf_source'] = pdf_source

    return jsonify(result), 201


@events_bp.route('/api/events/batch', methods=['POST'])
@require_csrf
@require_magic_link
def submit_batch():
    """Submit multiple events atomically."""
    data = request.json

    success, result = handler.submit_batch(
        sak_id=data.get('sak_id'),
        expected_version=data.get('expected_version'),
        events_data=data.get('events', [])
    )

    status_code = 201 if success else result.get('status_code', 400)
    return jsonify(result), status_code
```

### Del 5.4: Opprett `case_routes.py`

Flytt GET-endepunktene:

```python
"""
Case state and timeline API routes.
"""
from flask import Blueprint, jsonify

from services.timeline_service import TimelineService
from repositories.event_repository import JsonFileEventRepository
from models.events import parse_event
from lib.auth.magic_link import require_magic_link

case_bp = Blueprint('cases', __name__)

event_repo = JsonFileEventRepository()
timeline_service = TimelineService()


@case_bp.route('/api/cases/<sak_id>/state', methods=['GET'])
@require_magic_link
def get_case_state(sak_id: str):
    """Get computed state for a case."""
    events_data, version = event_repo.get_events(sak_id)

    if not events_data:
        return jsonify({"error": "Sak ikke funnet"}), 404

    events = [parse_event(e) for e in events_data]
    state = timeline_service.compute_state(events)

    return jsonify({
        "version": version,
        "state": state.model_dump(mode='json')
    })


@case_bp.route('/api/cases/<sak_id>/timeline', methods=['GET'])
@require_magic_link
def get_case_timeline(sak_id: str):
    """Get full event timeline for UI display."""
    events_data, version = event_repo.get_events(sak_id)

    if not events_data:
        return jsonify({"error": "Sak ikke funnet"}), 404

    events = [parse_event(e) for e in events_data]
    timeline = timeline_service.get_timeline(events)

    return jsonify({
        "version": version,
        "events": timeline
    })
```

### Del 5.5: Registrer ny blueprint i app

Oppdater `backend/app.py` eller tilsvarende:

```python
from routes.event_routes import events_bp
from routes.case_routes import case_bp

app.register_blueprint(events_bp)
app.register_blueprint(case_bp)
```

### Verifisering
```bash
cd backend
python -m pytest tests/test_routes/ -v
# Manuell test:
curl http://localhost:5000/api/cases/TEST-001/state
```

---

## Oppgave 6: Implementere ServiceFactory/DI

### Kontekst
Services instansieres på modul-nivå i routes, noe som gjør testing vanskelig.

### Nåværende problem (fra `event_routes.py` linje 44-48):

```python
# Dependencies (consider DI container for production)
event_repo = JsonFileEventRepository()
metadata_repo = SakMetadataRepository()
timeline_service = TimelineService()
validator = BusinessRuleValidator()
```

### Løsning: Opprett `backend/core/container.py`

```python
"""
Dependency Injection container for services.

Usage:
    from core.container import container

    # Get service instances:
    event_repo = container.event_repository()
    timeline = container.timeline_service()

    # Override for testing:
    container.override(event_repository=MockEventRepository())
"""
from typing import Dict, Any, Optional, Type, Callable
from functools import lru_cache

from utils.logger import get_logger

logger = get_logger(__name__)


class ServiceContainer:
    """
    Simple DI container for service registration and resolution.
    """

    def __init__(self):
        self._factories: Dict[str, Callable] = {}
        self._overrides: Dict[str, Any] = {}
        self._singletons: Dict[str, Any] = {}

    def register(
        self,
        name: str,
        factory: Callable,
        singleton: bool = True
    ):
        """
        Register a service factory.

        Args:
            name: Service name (e.g., 'event_repository')
            factory: Callable that creates the service
            singleton: If True, only create one instance
        """
        self._factories[name] = (factory, singleton)
        logger.debug(f"Registered service: {name}")

    def override(self, **overrides):
        """
        Override services (for testing).

        Example:
            container.override(event_repository=mock_repo)
        """
        self._overrides.update(overrides)

    def clear_overrides(self):
        """Clear all overrides."""
        self._overrides.clear()

    def get(self, name: str) -> Any:
        """
        Get a service instance.

        Args:
            name: Service name

        Returns:
            Service instance

        Raises:
            KeyError: If service not registered
        """
        # Check overrides first
        if name in self._overrides:
            return self._overrides[name]

        # Check singletons
        if name in self._singletons:
            return self._singletons[name]

        # Create from factory
        if name not in self._factories:
            raise KeyError(f"Service not registered: {name}")

        factory, singleton = self._factories[name]
        instance = factory()

        if singleton:
            self._singletons[name] = instance

        return instance

    def __getattr__(self, name: str) -> Any:
        """Allow container.service_name() syntax."""
        return lambda: self.get(name)


# Global container instance
container = ServiceContainer()


def setup_container():
    """
    Register all services with the container.

    Call this once at application startup.
    """
    from repositories.event_repository import JsonFileEventRepository
    from repositories.sak_metadata_repository import SakMetadataRepository
    from services.timeline_service import TimelineService
    from services.business_rules import BusinessRuleValidator
    from services.catenda_service import CatendaService

    container.register('event_repository', JsonFileEventRepository)
    container.register('metadata_repository', SakMetadataRepository)
    container.register('timeline_service', TimelineService)
    container.register('business_rules', BusinessRuleValidator)

    logger.info("Service container initialized")


# Auto-setup on import (can be disabled for testing)
setup_container()
```

### Oppdater routes til å bruke container

**FØR:**
```python
event_repo = JsonFileEventRepository()
timeline_service = TimelineService()
```

**ETTER:**
```python
from core.container import container

def submit_event():
    event_repo = container.event_repository()
    timeline_service = container.timeline_service()
    # ...
```

### Testing med overrides

```python
def test_submit_event():
    # Arrange
    mock_repo = Mock(spec=JsonFileEventRepository)
    container.override(event_repository=mock_repo)

    try:
        # Act
        response = client.post('/api/events', json={...})

        # Assert
        mock_repo.append.assert_called_once()
    finally:
        container.clear_overrides()
```

### Verifisering
```bash
cd backend
python -c "from core.container import container; print(container.event_repository())"
```

---

## Appendiks: Filstørrelser (referanse)

| Fil | Linjer | Anbefalt maks |
|-----|--------|---------------|
| integrations/catenda/client.py | 1649 | 200-300 |
| models/events.py | 992 | OK (datamodeller) |
| services/timeline_service.py | 772 | OK (kompleks logikk) |
| routes/event_routes.py | 592 | 100-150 |
| lib/security/validation.py | 473 | OK |
| api/validators.py | 269 | OK |
| services/catenda_service.py | 268 | OK |

---

## Avsluttende sjekkliste

Etter all refaktorering:

- [ ] Alle eksisterende tester passerer
- [ ] Ingen sirkulære imports
- [ ] `grep -r "logging.basicConfig"` returnerer kun `core/logging_config.py`
- [ ] `grep -r "class ValidationError"` returnerer kun `lib/security/validation.py`
- [ ] CatendaClient imports fungerer bakoverkompatibelt
- [ ] Routes gir samme respons som før
